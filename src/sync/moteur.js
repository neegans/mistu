// Le moteur (spec § 5.3, § 5.5, § 4.2) : sur chaque déclencheur, UNE passe — envoi initial (marqueurs) → envoi →
// réception — jamais deux en même temps (un vol en cours est rejoint, pas doublé). L'état est observable par
// Réglages et par la pastille ; ce qu'il affiche vient toujours d'un fait (accusé, lignes reçues, erreur classée).
import { envoiInitial } from './backfill.js';
import { fileDe } from './outbox.js';
import { createPush } from './push.js';
import { createPull } from './pull.js';
import { purgerAnciens } from './conflits.js';
import { setClockOffset } from './clock.js';
import { logError } from '../core/log.js';

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
};

// Le seuil au-delà duquel une horloge faussée se dit à la personne. Il est tenu par `appliquerHeureServeur`
// (src/sync/clock.js, qui rend `avertir`) ; il est repris ici pour décider si un avertissement DÉJÀ donné a encore
// lieu d'être affiché au démarrage — une horloge remise à l'heure ne doit plus rien afficher.
const SEUIL_HORLOGE_MS = 5 * 60000;

export function createMoteur({
  db,
  getUserId,
  isActivitySynced = () => false,
  transport,
  fenetre = globalThis,
  bus = null,
  maintenant = Date.now,
  delaiRegroupementMs = 2000,
}) {
  let etat = { ...AU_REPOS };
  const abonnes = new Set();
  let vol = null; // la passe en vol : il n'y en a qu'une
  let minuterie = null; // regroupement des écritures
  let reprise = null; // reprise après un recul annoncé par l'envoi
  let actif = false; // entre demarrer() et arreter()
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

  const push = createPush({ db, transport: compte, getUserId, maintenant, surHeure: (h) => { heureVue = h; } });
  const pull = createPull({
    db,
    transport: compte,
    isActivitySynced,
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
    poser({
      pause,
      dernierEchange: dernier,
      horloge: avertir ? { minutes: Math.round(Math.abs(decalage) / 60000) } : null,
      ...(await compter()),
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
    try {
      if (!pause) {
        await envoiInitial({
          db,
          getUserId,
          isActivitySynced,
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
      // R-L3-16 : ce que la passe a écrit, compté depuis les bilans de l'envoi et de la réception — jamais depuis
      // une réponse brute. Une passe interrompue annonce ce qu'elle avait écrit avant de s'arrêter, pas zéro.
      const derniersEffets = {
        recues: bilanReception?.recues || 0,
        supprimees: bilanReception?.supprimees || 0,
        ajustes: bilanEnvoi?.ajustes || 0,
        conflits: (bilanEnvoi?.conflits || 0) + (bilanReception?.conflits || 0),
      };
      poser({ enCours: false, phase: null, progression: null, derniersEffets, ...fin });
    }
    return instantane();
  }

  // Une seule minuterie de reprise à la fois : un recul annoncé remplace l'attente précédente, il ne s'empile pas.
  function programmerReprise(ms) {
    if (reprise) clearTimeout(reprise);
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
    if (await lirePause()) {
      await db.mutate({ deletes: { sync_state: ['pause'] }, origin: 'device' });
      poser({ pause: null });
    }
    if (vol) await vol;
    return executer('manuel');
  }

  function demarrer() {
    if (actif) return demarrage;
    actif = true;
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

  // L'arrêt retire tout ce qui pourrait relancer une passe, et rend la passe en vol : l'appelant peut attendre
  // qu'elle soit terminée avant de fermer la base.
  function arreter() {
    actif = false;
    for (const d of desabonner.splice(0)) d();
    if (minuterie) { clearTimeout(minuterie); minuterie = null; }
    if (reprise) { clearTimeout(reprise); reprise = null; }
    return vol || Promise.resolve(instantane());
  }

  return {
    demarrer,
    arreter,
    executer,
    planifier,
    envoyerMaintenant,
    etat: instantane,
    onEtat: (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); },
  };
}
