// Le moteur (spec § 5.3, § 5.5, § 4.2) : sur chaque déclencheur, UNE passe — envoi initial (marqueurs) → envoi →
// réception — jamais deux en même temps (un vol en cours est rejoint, pas doublé). L'état est observable par
// Réglages et par la pastille ; ce qu'il affiche vient toujours d'un fait (accusé, lignes reçues, erreur classée).
import { envoiInitial } from './backfill.js';
import { fileDe } from './outbox.js';
import { createPush } from './push.js';
import { createPull } from './pull.js';
import { purgerAnciens } from './conflits.js';
import { createFichiers, compterFichiers, lireErreursFichiers, MAGASINS_FICHIERS } from './fichiers.js';
import { setClockOffset } from './clock.js';
import { logError } from '../core/log.js';

// Lot G (§ 3.6) : les compteurs de fichiers au repos — toujours présents, à zéro tant qu'aucune passe n'a compté.
const FICHIERS_AU_REPOS = Object.freeze({ aEnvoyer: 0, aTelecharger: 0, octetsATelecharger: 0, enErreur: 0, typeInconnu: 0, copiesPerimees: 0, copiesSansServeur: 0, aRenvoyer: 0 });
// D-G13 : la réponse de toute API de fichiers appelée après arreter() — sans appel, sans écriture.
const ARRETE = Object.freeze({ erreur: Object.freeze({ type: 'arrete' }) });

// L'état au repos : rien n'est affiché avant qu'un fait l'ait posé (I5). Les noms sont ceux que Réglages et la
// pastille liront ; aucune chaîne d'interface ici, le moteur ne rend que des faits.
const AU_REPOS = {
  enCours: false,
  phase: null,
  progression: null,
  dernierEchange: null,
  aEnvoyer: 0,
  enQuarantaine: 0,
  conflits: 0,
  pause: null,
  attenteConnexion: false,
  horloge: null,
  derniereErreur: null,
  // R-L3-16 : ce que la DERNIÈRE passe a réellement écrit. Posé en fin de passe, c'est lui qui permet à la coquille
  // de redemander un rendu quand (et seulement quand) quelque chose est arrivé de l'autre appareil. Null au repos :
  // aucune passe n'a encore eu lieu, donc rien n'est affirmé.
  derniersEffets: null,
  // Lot G (§ 3.6) : toujours présentes, à leur valeur de repos tant qu'aucun fait ne les a posées.
  fichiers: FICHIERS_AU_REPOS,
  progressionFichiers: null,
  espaceServeur: null,
  telechargementGlobal: false,
  pauseFichiers: null,
};

// Le seuil au-delà duquel une horloge faussée se dit à la personne. Il est tenu par `appliquerHeureServeur`
// (src/sync/clock.js, qui rend `avertir`) ; il est repris ici pour décider si un avertissement DÉJÀ donné a encore
// lieu d'être affiché au démarrage — une horloge remise à l'heure ne doit plus rien afficher.
const SEUIL_HORLOGE_MS = 5 * 60000;

export function createMoteur({
  db,
  getUserId,
  isActivitySynced = () => false,
  configSuitLeCompte = () => false,
  transport,
  fenetre = globalThis,
  bus = null,
  maintenant = Date.now,
  delaiRegroupementMs = 2000,
  stockage = null,
  qualite = () => 'reduite',
  reduire = null,
}) {
  let etat = { ...AU_REPOS };
  const abonnes = new Set();
  let vol = null; // la passe en vol : il n'y en a qu'une
  let minuterie = null; // regroupement des écritures
  let reprise = null; // reprise après un recul annoncé par l'envoi
  let actif = false; // entre demarrer() et arreter()
  let arrete = false; // arreter() a été appelé : plus aucune minuterie n'est reposée (m2)
  let demarrage = null; // la promesse du démarrage (chargement puis première passe)
  let heureVue = null; // dernière mesure d'horloge rapportée par l'envoi
  let appelsReussis = 0;
  const desabonner = [];

  // L'état sort TOUJOURS en copie figée, ses objets compris : un abonné (Réglages, pastille) garde l'objet reçu sans
  // le voir changer sous lui, et personne ne peut écrire dans l'état du moteur depuis l'extérieur.
  const fige = (valeur) => (valeur ? Object.freeze({ ...valeur }) : null);
  const instantane = () => Object.freeze({
    ...etat,
    progression: fige(etat.progression),
    pause: fige(etat.pause),
    horloge: fige(etat.horloge),
    derniereErreur: fige(etat.derniereErreur),
    derniersEffets: fige(etat.derniersEffets),
    fichiers: fige(etat.fichiers),
    progressionFichiers: fige(etat.progressionFichiers),
    espaceServeur: fige(etat.espaceServeur),
    pauseFichiers: fige(etat.pauseFichiers),
  });

  function poser(partiel) {
    etat = { ...etat, ...partiel };
    const vu = instantane();
    // Un abonné qui jette ne doit pas emporter la passe : l'incident est journalisé par son code, sans contenu.
    for (const fn of abonnes) {
      try { fn(vu); } catch (error) { logError('sync.etat', { error }); }
    }
    return vu;
  }

  // Compteur d'appels RÉELLEMENT aboutis. « Dernier échange » = heure du dernier appel réussi (I5) : une file vide
  // ne fait aucun appel, et une passe entièrement hors ligne ne doit pas dater un échange qui n'a pas eu lieu.
  // Sans ce compteur, un envoi sans rien à envoyer suivi d'une réception en panne afficherait « à l'instant ».
  const compte = {
    async pousser(elements) {
      const r = await transport.pousser(elements);
      // Une réponse absente sans erreur n'est pas un échange : l'envoi la traite déjà en « inconnu ».
      if (!r.erreur && r.reponse) appelsReussis += 1;
      return r;
    },
    async lire(table, apres, limite) {
      const r = await transport.lire(table, apres, limite);
      if (!r.erreur) appelsReussis += 1;
      return r;
    },
  };

  // Le stockage passe par le même compteur que le transport : un envoi ou un téléchargement abouti date « Dernier échange » (I5).
  const compteStockage = stockage ? {
    async envoyer(chemin, blob, options) { const r = await stockage.envoyer(chemin, blob, options); if (!r.erreur) appelsReussis += 1; return r; },
    async recevoir(chemin) { const r = await stockage.recevoir(chemin); if (!r.erreur) appelsReussis += 1; return r; },
    async lister(prefixe, options) { const r = await stockage.lister(prefixe, options); if (!r.erreur) appelsReussis += 1; return r; },
  } : null;
  // Sans stockage (suites L3, appareil sans client), aucune passe fichiers : le moteur est exactement celui de L3.
  const fichiers = compteStockage ? createFichiers({ db, stockage: compteStockage, getUserId, qualite, maintenant, ...(reduire ? { reduire } : {}) }) : null;
  const vols = new Set(); // D-G13 : téléchargements par tape et mesures d'espace — arreter() les attend tous, avec la passe
  let generationTelechargement = 0; // « Arrêter le téléchargement » : la passe en vol s'arrête à son prochain fichier

  const lirePauseFichiers = async () => (await db.get('sync_state', 'pause_fichiers'))?.value || null;
  async function etatFichiers(snapshot = null) {
    const snap = snapshot ?? await db.getSnapshot(MAGASINS_FICHIERS);
    return compterFichiers(snap, { uid: getUserId(), erreurs: await lireErreursFichiers(db) });
  }
  async function appliquerEspace(r) {
    if (!r || r.erreur) { if (r?.erreur) logError('sync.fichiers.espace', { reason: r.erreur.type, status: r.erreur.status }); return r; }
    if (arrete) return ARRETE; // rien ne s'écrit après l'arrêt
    const valeur = { octets: r.octets, objets: r.objets, at: r.at, tronque: r.tronque };
    await db.mutate({ puts: { sync_state: [{ key: 'storage_usage', value: valeur }] }, origin: 'device' });
    poser({ espaceServeur: valeur });
    return valeur;
  }
  function tenir(promesse) {
    vols.add(promesse);
    promesse.then(() => vols.delete(promesse), () => vols.delete(promesse));
    return promesse;
  }

  const push = createPush({ db, transport: compte, getUserId, maintenant, surHeure: (h) => { heureVue = h; } });
  const pull = createPull({
    db,
    transport: compte,
    isActivitySynced,
    configSuitLeCompte,
    getUserId,
    surProgression: (p) => poser({ phase: p.phase, progression: { table: p.table, n: p.n, total: p.total } }),
  });

  // R-L3-24 : les comptes affichés portent sur le MÊME sous-ensemble que l'envoi — la file de ce compte (`fileDe`).
  // Une entrée d'un autre compte ne partira jamais d'ici : l'annoncer en « À envoyer » ou dans la pastille serait
  // une attente que personne ne tient.
  async function compter() {
    const file = await fileDe(db, getUserId());
    return {
      aEnvoyer: file.length,
      enQuarantaine: file.filter((e) => e.quarantined_at).length,
      conflits: await db.count('sync_conflicts'),
    };
  }

  const lirePause = async () => (await db.get('sync_state', 'pause'))?.value || null;

  async function toucherEchange() {
    const iso = new Date(maintenant()).toISOString();
    await db.mutate({ puts: { sync_state: [{ key: 'last_exchange_at', value: iso }] }, origin: 'device' });
    poser({ dernierEchange: iso });
  }

  // Horloge (spec § 5.3, R-L3-14) : le décalage mesuré est gardé à CHAQUE mesure qui le change — c'est lui qui
  // corrige syncNow() au prochain démarrage, avant le premier appel, même quand l'écart est petit. Au-delà du seuil,
  // la personne est avertie UNE fois (clock_warned_at n'est jamais réhorodaté) et l'avertissement reste affiché
  // tant que l'écart dure. Une mesure qui ne change rien n'écrit rien.
  async function appliquerMesure(h) {
    if (!h) return;
    const connu = await db.get('sync_state', 'clock_offset_ms');
    const marque = h.avertir ? await db.get('sync_state', 'clock_warned_at') : null;
    const puts = [];
    if (connu?.value !== h.decalageMs) puts.push({ key: 'clock_offset_ms', value: h.decalageMs });
    if (h.avertir && !marque) puts.push({ key: 'clock_warned_at', value: new Date(maintenant()).toISOString() });
    if (puts.length) await db.mutate({ puts: { sync_state: puts }, origin: 'device' });
    poser({ horloge: h.avertir ? { minutes: h.minutes } : null });
  }

  // Ce que l'appareil sait déjà au démarrage, avant tout appel : la pause posée, le dernier échange, le décalage
  // d'horloge mesuré (réappliqué à l'horloge) et l'avertissement déjà donné, puis les comptes de la file.
  async function charger() {
    const pause = await lirePause();
    const dernier = (await db.get('sync_state', 'last_exchange_at'))?.value || null;
    const decalage = (await db.get('sync_state', 'clock_offset_ms'))?.value;
    if (Number.isFinite(decalage)) setClockOffset(decalage);
    const marque = await db.get('sync_state', 'clock_warned_at');
    const avertir = !!marque && Number.isFinite(decalage) && Math.abs(decalage) > SEUIL_HORLOGE_MS;
    // Lot G (§ 3.6) : la pause du seau, la dernière mesure d'espace, le téléchargement global demandé et les compteurs de fichiers.
    const fichiersConnus = fichiers ? {
      pauseFichiers: await lirePauseFichiers(),
      espaceServeur: (await db.get('sync_state', 'storage_usage'))?.value || null,
      telechargementGlobal: !!(await db.get('sync_state', 'telecharger_tout')),
      fichiers: await etatFichiers(),
    } : {};
    poser({
      pause,
      dernierEchange: dernier,
      horloge: avertir ? { minutes: Math.round(Math.abs(decalage) / 60000) } : null,
      ...(await compter()),
      ...fichiersConnus,
    });
  }

  async function passe(raison) {
    // Sans compte, rien ne part et rien n'est tenté : seuls les comptes de la file sont rafraîchis. Aucune passe
    // n'a eu lieu, donc aucun effet à annoncer — et `enCours` n'est jamais passé à vrai : personne ne rendra.
    if (!getUserId()) { poser({ derniersEffets: null, ...(await compter()) }); return instantane(); }
    // R-L3-14 : la pause est RELUE dans sync_state à chaque passe, pas seulement au chargement — un autre onglet a
    // pu la poser, un « online » a pu arriver pendant charger(), et executer() peut être appelé sans demarrer().
    const pause = await lirePause();
    // R-L3-15 : en pause de quota, seul l'ENVOI est suspendu. Lire ne consomme pas d'espace chez le fournisseur, et
    // ce qui arrive des autres appareils n'a pas à attendre un geste de la personne : la réception continue.
    poser({ pause, enCours: true, phase: pause ? 'reception' : 'envoi_initial', derniereErreur: null, attenteConnexion: false, derniersEffets: null });
    const avantPasse = appelsReussis;
    // Déclarés hors du `try` : le `finally` les lit pour annoncer ce que la passe a écrit, même quand elle a jeté.
    let bilanEnvoi = null;
    let bilanReception = null;
    let bilanFichiers = null;
    let bilanTelechargement = null;
    let snapshotFichiers = null;
    try {
      if (!pause) {
        await envoiInitial({
          db,
          getUserId,
          isActivitySynced,
          configSuitLeCompte,
          surProgression: (p) => poser({ progression: { table: p.table, n: p.n, total: p.total } }),
        });
        poser({ phase: 'envoi', progression: null });
        heureVue = null;
        bilanEnvoi = await push.envoyer();
        await appliquerMesure(heureVue);
        if (bilanEnvoi.pause) poser({ pause: (await lirePause()) || { raison: 'quota', at: new Date(maintenant()).toISOString() } });
        if (bilanEnvoi.attenteConnexion) poser({ attenteConnexion: true });
        if (bilanEnvoi.erreur) poser({ derniereErreur: { type: bilanEnvoi.erreur.type } });
        if (bilanEnvoi.recul) programmerReprise(bilanEnvoi.recul);
      }
      // La réception n'est tentée que si l'envoi a pu aboutir : une file en recul, une connexion à refaire ou un
      // quota découvert à l'instant ne doivent pas être suivis d'un appel qui butera sur le même mur. La pause déjà
      // posée AVANT la passe, elle, ne l'empêche pas (R-L3-15) — la prochaine passe relira la nouvelle.
      const envoiBloque = !!bilanEnvoi && !!(bilanEnvoi.erreur || bilanEnvoi.pause || bilanEnvoi.attenteConnexion);
      if (!envoiBloque) {
        poser({ phase: 'reception' });
        bilanReception = await pull.recevoir();
        if (bilanReception.erreur) poser({ derniereErreur: { type: bilanReception.erreur.type } });
      }
      // Lot G (§ 4.7) : après la réception, seulement avec un stockage, hors pause_fichiers et sans envoi bloqué. Les fiches sont parties AVANT.
      if (fichiers && !envoiBloque && !arrete) {
        const pauseF = await lirePauseFichiers();
        poser({ pauseFichiers: pauseF });
        if (!pauseF) {
          poser({ phase: 'fichiers', progression: null });
          snapshotFichiers = await db.getSnapshot(MAGASINS_FICHIERS); // UNE lecture par passe (S-12)
          const surProgression = (p) => poser({ progressionFichiers: p });
          bilanFichiers = await fichiers.envoyer({ stop: () => arrete, surProgression, snapshot: snapshotFichiers });
          const bloque = bilanFichiers.attenteConnexion || bilanFichiers.pauseFichiers || !!bilanFichiers.erreur;
          if (!bloque && !arrete && await db.get('sync_state', 'telecharger_tout')) {
            const g = generationTelechargement;
            bilanTelechargement = await fichiers.telechargerTout({ stop: () => arrete || g !== generationTelechargement, surProgression, snapshot: snapshotFichiers });
          }
          poser({ progressionFichiers: null });
          if (!arrete && (bilanFichiers.confirmes > 0 || !(await db.get('sync_state', 'storage_usage')))) await appliquerEspace(await fichiers.mesurerEspace());
          const erreurFichiers = bilanFichiers.erreur || bilanTelechargement?.erreur || null;
          if (bilanFichiers.attenteConnexion) poser({ attenteConnexion: true });
          if (bilanFichiers.pauseFichiers) poser({ pauseFichiers: await lirePauseFichiers() });
          else if (erreurFichiers) poser({ derniereErreur: { type: erreurFichiers.type } });
          if (bilanFichiers.recul) programmerReprise(bilanFichiers.recul);
          else if (!erreurFichiers && (bilanFichiers.restants > 0 || bilanTelechargement?.restants > 0) && fenetre.document?.visibilityState !== 'hidden') programmerReprise(1000);
          if (bilanFichiers.confirmes > 0) planifier(); // les lignes confirmées partent à la passe suivante
        }
      }
      // UN seul « Dernier échange » par passe, et seulement si un appel a RÉELLEMENT abouti (I5).
      if (appelsReussis > avantPasse) await toucherEchange();
      await purgerAnciens(db, maintenant());
    } catch (error) {
      logError('sync.passe', { error, reason: raison });
      poser({ derniereErreur: { type: 'inconnu' } });
    } finally {
      // Les comptes finaux sont lus à part : une base devenue illisible (onglet fermé, appareil éteint) ne doit pas
      // transformer la fin d'une passe en rejet silencieux.
      let fin = {};
      try { fin = await compter(); } catch (error) { logError('sync.passe', { error, reason: 'file illisible' }); }
      if (fichiers) {
        try {
          fin.fichiers = await etatFichiers(snapshotFichiers); // le snapshot de la passe, mis à jour par envoyer/telechargerTout ; lu une fois sinon
          fin.telechargementGlobal = !!(await db.get('sync_state', 'telecharger_tout'));
          fin.progressionFichiers = null;
        } catch (error) { logError('sync.passe', { error, reason: 'fichiers illisibles' }); }
      }
      // R-L3-16 : ce que la passe a écrit, compté depuis les bilans de l'envoi et de la réception — jamais depuis
      // une réponse brute. Une passe interrompue annonce ce qu'elle avait écrit avant de s'arrêter, pas zéro.
      const derniersEffets = {
        recues: bilanReception?.recues || 0,
        supprimees: bilanReception?.supprimees || 0,
        ajustes: bilanEnvoi?.ajustes || 0,
        conflits: (bilanEnvoi?.conflits || 0) + (bilanReception?.conflits || 0),
        fichiersRecus: bilanTelechargement?.recus || 0, // § 3.6 : toujours présent, forme fixe
      };
      poser({ enCours: false, phase: null, progression: null, derniersEffets, ...fin });
    }
    return instantane();
  }

  // Une seule minuterie de reprise à la fois : un recul annoncé remplace l'attente précédente, il ne s'empile pas.
  // m2 : et AUCUNE après un arrêt. `arreter()` annule bien la minuterie existante à cet instant, mais `passe()`
  // pose la sienne plus tard — quand l'envoi annonce son recul —, donc une passe encore en vol au moment de
  // l'arrêt en reposait une que plus personne n'annulait. Après « Effacer les données de cet appareil »
  // (arrêt → clearDevice), cet `executer('reprise')` tardif lançait une passe sur une base vidée : au mieux du
  // journal, au pire la réception complète d'une bibliothèque sur un appareil qu'on vient d'effacer, si la
  // déconnexion avait échoué. La garde est posée ici plutôt qu'en tête d'`executer()` : Réglages, la pastille et
  // les tests appellent `executer()` sans jamais `demarrer()`, et un refus là leur rendrait un moteur muet.
  function programmerReprise(ms) {
    if (reprise) clearTimeout(reprise);
    if (arrete) return;
    reprise = setTimeout(() => { reprise = null; executer('reprise'); }, ms);
  }

  // Un seul vol : un appel pendant une passe rejoint la passe en cours (sa promesse), sans en lancer une seconde.
  // R-L3-14 : ce vol ne REJETTE jamais. Réglages, la pastille et les déclencheurs appellent sans filet ; les deux
  // retours courts de la passe lisent la file hors de son `try`, et une base devenue illisible doit rendre un état.
  function executer(raison = 'manuel') {
    if (vol) return vol;
    vol = passe(raison)
      .catch((error) => { logError('sync.passe', { error, reason: raison }); return instantane(); })
      .finally(() => { vol = null; });
    return vol;
  }

  // Regroupement : plusieurs écritures rapprochées ne font qu'UNE passe. Si une passe est déjà en vol, la minuterie
  // est REPOUSSÉE plutôt que de rejoindre ce vol : la passe en cours a peut-être déjà lu la file avant cette
  // écriture, qui attendrait alors le prochain déclencheur — parfois très loin.
  function planifier() {
    if (minuterie) clearTimeout(minuterie);
    // m2, même garde : la branche « une passe est en vol, on repousse » se rejoue DANS la minuterie, donc après un
    // arrêt elle se reposait indéfiniment. Un arrêt met fin au regroupement comme au recul.
    if (arrete) return;
    minuterie = setTimeout(() => {
      minuterie = null;
      if (vol) planifier();
      else executer('ecriture');
    }, delaiRegroupementMs);
  }

  // Le geste « Envoyer maintenant » : la seule façon de lever une pause de quota, et elle est explicite. La pause est
  // relue dans sync_state (un autre onglet a pu la poser) et un vol en cours est ATTENDU, pas rejoint : il a pu être
  // court-circuité par la pause, le rejoindre ne ferait donc rien partir.
  async function envoyerMaintenant() {
    const aLever = [];
    if (await lirePause()) aLever.push('pause');
    if (await lirePauseFichiers()) aLever.push('pause_fichiers'); // B-5 : le geste lève aussi la pause du seau
    if (aLever.length) { await db.mutate({ deletes: { sync_state: aLever }, origin: 'device' }); poser({ pause: null, pauseFichiers: null }); }
    if (vol) await vol;
    return executer('manuel');
  }

  // D-G13 : tout ce qu'une tape lance entre dans `vols` ; après arreter(), rien n'appelle et rien n'écrit. Hors brief (§ 4.8 « Arrêt »,
  // à ratifier) : les gestes qui écrivent une clé puis lancent une passe sont tenus eux aussi, et relisent `arrete` après chaque attente — un
  // geste lancé juste avant l'arrêt (« Effacer les données » derrière une tape) ne lance plus de passe derrière lui, et arreter() attend sa clé.
  function telecharger(shas) {
    if (arrete) return Promise.resolve(ARRETE);
    if (!fichiers) return Promise.resolve({ rien: true });
    return tenir((async () => {
      const avant = appelsReussis;
      const r = await fichiers.telecharger(Array.isArray(shas) ? shas : [], { stop: () => arrete });
      if (!arrete) {
        if (appelsReussis > avant) await toucherEchange();
        poser({ fichiers: await etatFichiers() });
      }
      return r;
    })());
  }
  function telechargerTout() {
    if (arrete) return Promise.resolve(ARRETE);
    if (!fichiers) return Promise.resolve({ rien: true });
    return tenir((async () => {
      await db.mutate({ puts: { sync_state: [{ key: 'telecharger_tout', value: { at: new Date(maintenant()).toISOString() } }] }, origin: 'device' });
      if (arrete) return ARRETE;
      poser({ telechargementGlobal: true });
      if (vol) await vol; // une passe déjà en vol a pu lire la clé avant qu'elle existe : la suivante la lira
      return arrete ? ARRETE : executer('telechargement');
    })());
  }
  function arreterTelechargement() {
    generationTelechargement += 1; // la passe en vol s'arrête à son prochain fichier (stop relit la génération)
    if (arrete) return Promise.resolve(ARRETE);
    return tenir((async () => {
      await db.mutate({ deletes: { sync_state: ['telecharger_tout'] }, origin: 'device' });
      if (arrete) return ARRETE;
      poser({ telechargementGlobal: false });
      return instantane();
    })());
  }
  function actualiserEspace() {
    if (arrete) return Promise.resolve(ARRETE);
    if (!fichiers) return Promise.resolve({ rien: true });
    return tenir((async () => appliquerEspace(await fichiers.mesurerEspace()))()); // hors passe : lister ne touche pas la base avant la fin
  }
  function renvoyerEnOriginale() {
    if (arrete) return Promise.resolve(ARRETE);
    if (!fichiers) return Promise.resolve({ rien: true });
    return tenir((async () => {
      await db.mutate({ puts: { sync_state: [{ key: 'renvoi_originale', value: { at: new Date(maintenant()).toISOString() } }] }, origin: 'device' });
      if (vol) await vol;
      return arrete ? ARRETE : executer('renvoi');
    })());
  }
  function reessayerFichier(sha256) {
    if (arrete) return Promise.resolve(ARRETE);
    const cle = 'file_error:' + sha256;
    return tenir((async () => {
      const ligne = await db.get('sync_state', cle);
      if (arrete) return ARRETE; // la clé n'est pas retirée après l'arrêt
      if (!ligne) return { rien: true };
      await db.mutate({ deletes: { sync_state: [cle] }, origin: 'device' });
      if (ligne.value?.sens === 'reception') return telecharger([sha256]); // tenu lui aussi ; rend arrete si l'arrêt est arrivé entre-temps
      if (vol) await vol;
      return arrete ? ARRETE : executer('reessai');
    })());
  }

  function demarrer() {
    if (actif) return demarrage;
    actif = true;
    arrete = false; // une reprise de la synchronisation (déconnexion refusée) repose ses minuteries
    const surOnline = () => executer('online');
    const surVisibilite = () => (fenetre.document?.visibilityState === 'visible' ? executer('premier_plan') : undefined);
    fenetre.addEventListener('online', surOnline);
    fenetre.addEventListener('visibilitychange', surVisibilite);
    desabonner.push(() => fenetre.removeEventListener('online', surOnline), () => fenetre.removeEventListener('visibilitychange', surVisibilite));
    if (bus) desabonner.push(bus.on('change', () => planifier()));
    // `actif` est relu après le chargement : un arrêt demandé entre-temps ne doit pas lancer de passe.
    demarrage = charger()
      .then(() => (actif ? executer('demarrage') : instantane()))
      .catch((error) => { logError('sync.demarrer', { error }); return instantane(); });
    return demarrage;
  }

  // L'arrêt retire tout ce qui pourrait relancer une passe, et rend la passe en vol avec les vols des gestes (D-G13) : l'appelant
  // peut attendre qu'ils soient tous terminés avant de fermer la base.
  function arreter() {
    actif = false;
    arrete = true; // m2 : ce qui est encore en vol ne reposera plus de minuterie derrière l'arrêt
    for (const d of desabonner.splice(0)) d();
    if (minuterie) { clearTimeout(minuterie); minuterie = null; }
    if (reprise) { clearTimeout(reprise); reprise = null; }
    return Promise.allSettled([vol, ...vols].filter(Boolean)).then(() => instantane()); // D-G13 : la passe ET les vols
  }

  return {
    demarrer,
    arreter,
    executer,
    planifier,
    envoyerMaintenant,
    telecharger,
    telechargerTout,
    arreterTelechargement,
    actualiserEspace,
    renvoyerEnOriginale,
    reessayerFichier,
    etat: instantane,
    onEtat: (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); },
  };
}
