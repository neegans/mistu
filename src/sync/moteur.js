// Le moteur (spec § 5.3, § 5.5, § 4.2) : sur chaque déclencheur, UNE passe — envoi initial (marqueurs) → envoi →
// réception — jamais deux en même temps (un vol en cours est rejoint, pas doublé). L'état est observable par
// Réglages et par la pastille ; ce qu'il affiche vient toujours d'un fait (accusé, lignes reçues, erreur classée).
import { envoiInitial } from './backfill.js';
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
};

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

  // L'état sort TOUJOURS en copie figée : un abonné (Réglages, pastille) garde l'objet reçu sans le voir changer
  // sous lui, et personne ne peut écrire dans l'état du moteur depuis l'extérieur.
  const instantane = () => Object.freeze({ ...etat });

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

  const push = createPush({ db, transport: compte, maintenant, surHeure: (h) => { heureVue = h; } });
  const pull = createPull({
    db,
    transport: compte,
    isActivitySynced,
    getUserId,
    surProgression: (p) => poser({ phase: p.phase, progression: { table: p.table, n: p.n, total: p.total } }),
  });

  async function compter() {
    const file = await db.getAll('outbox');
    return {
      aEnvoyer: file.length,
      enQuarantaine: file.filter((e) => e.quarantined_at).length,
      conflits: await db.count('sync_conflicts'),
    };
  }

  async function toucherEchange() {
    const iso = new Date(maintenant()).toISOString();
    await db.mutate({ puts: { sync_state: [{ key: 'last_exchange_at', value: iso }] }, origin: 'device' });
    poser({ dernierEchange: iso });
  }

  // Horloge faussée de plus de 5 minutes (spec § 5.3) : la personne est avertie UNE fois (clock_warned_at), et le
  // décalage mesuré est gardé pour que l'horloge reste corrigée au prochain démarrage, avant le premier appel.
  // Rien n'est réécrit si la marque est déjà posée et le décalage inchangé : une passe qui ne change rien n'écrit rien.
  async function avertirHorloge(h) {
    if (!h?.avertir) return;
    const marque = await db.get('sync_state', 'clock_warned_at');
    const connu = await db.get('sync_state', 'clock_offset_ms');
    const puts = [];
    if (!marque) puts.push({ key: 'clock_warned_at', value: new Date(maintenant()).toISOString() });
    if (connu?.value !== h.decalageMs) puts.push({ key: 'clock_offset_ms', value: h.decalageMs });
    if (puts.length) await db.mutate({ puts: { sync_state: puts }, origin: 'device' });
    poser({ horloge: { minutes: h.minutes } });
  }

  // Ce que l'appareil sait déjà au démarrage, avant tout appel : la pause posée, le dernier échange, le décalage
  // d'horloge mesuré (réappliqué à l'horloge) et l'avertissement déjà donné, puis les comptes de la file.
  async function charger() {
    const pause = (await db.get('sync_state', 'pause'))?.value || null;
    const dernier = (await db.get('sync_state', 'last_exchange_at'))?.value || null;
    const decalage = (await db.get('sync_state', 'clock_offset_ms'))?.value;
    if (Number.isFinite(decalage)) setClockOffset(decalage);
    const marque = await db.get('sync_state', 'clock_warned_at');
    poser({
      pause,
      dernierEchange: dernier,
      horloge: marque && Number.isFinite(decalage) ? { minutes: Math.round(Math.abs(decalage) / 60000) } : null,
      ...(await compter()),
    });
  }

  async function passe(raison) {
    // Sans compte, rien ne part et rien n'est tenté : seuls les comptes de la file sont rafraîchis.
    if (!getUserId()) { poser({ ...(await compter()) }); return instantane(); }
    // En pause (quota), AUCUN appel réseau : la file reste entière et comptée. Seul « Envoyer maintenant » lève la
    // pause — c'est un geste de la personne, pas une reprise automatique qui retomberait sur le même mur.
    if (etat.pause) { poser({ ...(await compter()) }); return instantane(); }
    poser({ enCours: true, phase: 'envoi_initial', derniereErreur: null, attenteConnexion: false });
    try {
      await envoiInitial({
        db,
        getUserId,
        isActivitySynced,
        surProgression: (p) => poser({ progression: { table: p.table, n: p.n, total: p.total } }),
      });
      poser({ phase: 'envoi', progression: null });
      heureVue = null;
      const avantEnvoi = appelsReussis;
      const r = await push.envoyer();
      await avertirHorloge(heureVue);
      if (r.pause) poser({ pause: (await db.get('sync_state', 'pause'))?.value || { raison: 'quota', at: new Date(maintenant()).toISOString() } });
      if (r.attenteConnexion) poser({ attenteConnexion: true });
      if (r.erreur) poser({ derniereErreur: { type: r.erreur.type } });
      if (r.recul) programmerReprise(r.recul);
      if (appelsReussis > avantEnvoi) await toucherEchange();
      // La réception n'est tentée que si l'envoi a pu aboutir : une file en recul, une connexion à refaire ou une
      // pause de quota ne doivent pas être suivies d'un second appel qui butera sur le même mur.
      if (!r.erreur && !r.pause && !r.attenteConnexion) {
        poser({ phase: 'reception' });
        const avantReception = appelsReussis;
        const p = await pull.recevoir();
        if (p.erreur) poser({ derniereErreur: { type: p.erreur.type } });
        if (appelsReussis > avantReception) await toucherEchange();
      }
      await purgerAnciens(db, maintenant());
    } catch (error) {
      logError('sync.passe', { error, reason: raison });
      poser({ derniereErreur: { type: 'inconnu' } });
    } finally {
      // Les comptes finaux sont lus à part : une base devenue illisible (onglet fermé, appareil éteint) ne doit pas
      // transformer la fin d'une passe en rejet silencieux.
      let fin = {};
      try { fin = await compter(); } catch (error) { logError('sync.passe', { error, reason: 'file illisible' }); }
      poser({ enCours: false, phase: null, progression: null, ...fin });
    }
    return instantane();
  }

  // Une seule minuterie de reprise à la fois : un recul annoncé remplace l'attente précédente, il ne s'empile pas.
  function programmerReprise(ms) {
    if (reprise) clearTimeout(reprise);
    reprise = setTimeout(() => { reprise = null; executer('reprise'); }, ms);
  }

  // Un seul vol : un appel pendant une passe rejoint la passe en cours (sa promesse), sans en lancer une seconde.
  function executer(raison = 'manuel') {
    if (vol) return vol;
    vol = passe(raison).finally(() => { vol = null; });
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

  // Le geste « Envoyer maintenant » : la seule façon de lever une pause de quota, et elle est explicite.
  async function envoyerMaintenant() {
    if (etat.pause) {
      await db.mutate({ deletes: { sync_state: ['pause'] }, origin: 'device' });
      poser({ pause: null });
    }
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
