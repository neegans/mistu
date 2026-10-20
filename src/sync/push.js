// Envoi d'une passe (spec § 5.3) : la file est lue, dédoublonnée, relue, envoyée par lots ; chaque réponse est
// appliquée en UNE transaction (retraits, réécritures non capturées, conflits, quarantaine). I5 : une fiche n'est
// « envoyée » que par l'absence d'entrée la concernant.
import { composerLots, cleDe } from './lots.js';
import { fileDe } from './outbox.js';
import { appliquerReponse } from './reponses.js';
import { conditionFichier } from './fichiers.js';
import { appliquerHeureServeur, reculMs } from './clock.js';
import { logError } from '../core/log.js';

// Recul exponentiel (spec § 5.3) : défini dans clock.js (module feuille, lot G tâche 3 ronde 1), réexporté ici pour ses lecteurs.
export { reculMs };

// Le bilan se compte depuis les EFFETS, jamais depuis la réponse brute (R-L3-8) : ce que le serveur annonce pour
// une clé hors du lot ne produit rien et ne compte donc pour rien. « envoyés » = clés réellement retirées de la
// file, moins celles retirées pour une autre raison (conflit à trancher, doublon d'une clé mise en quarantaine) et
// moins les fiches réécrites, comptées en « ajustés ».
function compter(effets, entreesParSeq) {
  const clesRetirees = new Set();
  for (const s of effets.retirer) { const e = entreesParSeq.get(s); if (e) clesRetirees.add(cleDe(e)); }
  const horsAccuse = new Set(effets.conflits.map((c) => c.id));
  for (const { seq } of effets.quarantaine) { const e = entreesParSeq.get(seq); if (e) horsAccuse.add(cleDe(e)); }
  const ajustes = Object.values(effets.reecrire).reduce((n, rows) => n + rows.length, 0);
  const accusees = [...clesRetirees].filter((k) => !horsAccuse.has(k)).length;
  return { envoyes: accusees - ajustes, ajustes };
}

export function createPush({ db, transport, getUserId = () => null, maintenant = Date.now, surHeure = () => {} }) {
  // Une heure de reprise illisible (fiche bricolée, restauration d'archive) immobiliserait l'entrée pour toujours :
  // elle est prête maintenant. La quarantaine, elle, attend un geste de la personne.
  function prete(e) {
    if (!e.next_try_at) return true;
    const t = Date.parse(e.next_try_at);
    return !Number.isFinite(t) || t <= maintenant();
  }

  // R-L3-24 : la file de CE compte, et rien d'autre (`fileDe`, src/sync/outbox.js — une seule définition, partagée
  // avec les compteurs du moteur et « À envoyer » de Réglages). Puis les deux retenues de l'envoi : la quarantaine
  // attend un geste de la personne, une heure de reprise pas encore venue attend son heure.
  async function lireFile() {
    const miennes = await fileDe(db, getUserId());
    return miennes.filter((e) => !e.quarantined_at && prete(e)).sort((a, b) => a.seq - b.seq);
  }

  // R-L3-5 : une ligne retenue (files, tant que L4 n'a pas confirmé l'empreinte) n'est ni envoyée ni retirée —
  // elle est NOMMÉE dans la file, pour que Réglages puisse dire pourquoi elle attend. Origine 'remote' : jamais
  // recapturée. Rien n'est réécrit si le motif est déjà posé : une passe qui ne change rien n'écrit rien.
  async function marquerRetenues(retenues, entreesParSeq) {
    const rows = [];
    for (const { seqs, raison } of retenues) {
      for (const seq of seqs) {
        const e = entreesParSeq.get(seq);
        if (e && e.last_error !== raison) rows.push({ ...e, last_error: raison });
      }
    }
    if (rows.length) await db.mutate({ puts: { outbox: rows }, origin: 'remote' });
  }

  // R-L3-28 : les entrées dont la fiche n'existe plus ici sont RETIRÉES, avant tout envoi, et sans appel réseau.
  // Origine 'remote' : ce retrait n'est pas un geste de la personne et ne repart jamais vers le serveur. Rien
  // n'est journalisé : ce n'est pas un incident, c'est l'ordre normal des choses quand une suppression arrive
  // d'ailleurs (origine 'remote', jamais capturée) ou qu'on vide l'appareil.
  async function retirerAbandonnees(abandonnees) {
    const seqs = abandonnees.flatMap((a) => a.seqs);
    if (seqs.length) await db.mutate({ deletes: { outbox: seqs }, origin: 'remote' });
  }

  async function appliquer(lot, reponse, entreesParSeq) {
    // Lectures AVANT la transaction : la version locale d'un conflit est celle du moment où la réponse arrive, et
    // c'est elle qui décide si un ajustement a le droit de réécrire la fiche (R-L3-7).
    const fichesLocales = {};
    for (const e of lot.elements) fichesLocales[cleDe(e)] = (await db.get(e.store, e.id)) ?? null;
    // R-L3-29 : les clés dont le conflit est « renvoyé » (§ 5.5). Le journal est lu EN UNE fois : les conflits sont
    // peu nombreux par conception (purgés à 30 jours), et une lecture par élément en ferait 500 de plus par lot.
    const conflitsRenvoyes = new Set((await db.getAll('sync_conflicts')).filter((c) => c?.renvoye).map((c) => c.id));
    const effets = appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales, conflitsRenvoyes });
    const puts = { ...effets.reecrire };
    // Lot G, ronde 1 (#4, I-G3) : une ligne files ajustée n'est pas écrite telle que calculée sur `fichesLocales` (lues plus haut, hors
    // transaction) mais refondue sur la ligne RELUE dans la transaction : une copie téléchargée pendant l'aller-retour reste ; une ligne qui a
    // bougé ici depuis (R-L3-7) n'est pas réécrite.
    let conditions = null;
    if (puts.files) {
      conditions = { files: puts.files.map((ligne) => conditionFichier(ligne.sha256, fichesLocales[cleDe({ store: 'files', id: ligne.sha256 })] ?? null, ligne, ligne.updated_at)) };
      delete puts.files;
    }
    if (effets.conflits.length) puts.sync_conflicts = effets.conflits;
    if (effets.quarantaine.length) {
      puts.outbox = effets.quarantaine.map(({ seq, motif }) => ({ ...entreesParSeq.get(seq), quarantined_at: new Date(maintenant()).toISOString(), last_error: motif }));
    }
    // origin 'remote' : rien de ceci ne repart vers le serveur (réécriture d'un ajustement, journal, quarantaine).
    const deletes = {};
    if (effets.retirer.length) deletes.outbox = effets.retirer;
    if (effets.retirerConflits.length) deletes.sync_conflicts = effets.retirerConflits; // R-L3-29, même transaction
    await db.mutate({ puts, deletes, origin: 'remote', conditions });
    return effets;
  }

  // Un échec passager (réseau, 5xx, 429) : chaque entrée du lot compte l'essai et porte son heure de reprise.
  // `tries` AVANT incrément gouverne l'attente, donc le premier échec rend la main dans 2 s. Origine 'remote' :
  // ce marquage n'est pas un geste de la personne et ne repart jamais vers le serveur.
  async function reporter(seqs, entreesParSeq, erreur) {
    const puts = [];
    for (const s of seqs) {
      const e = entreesParSeq.get(s);
      if (!e) continue;
      const avant = e.tries || 0;
      puts.push({ ...e, tries: avant + 1, next_try_at: new Date(maintenant() + reculMs(avant)).toISOString(), last_error: erreur.type });
    }
    if (puts.length) await db.mutate({ puts: { outbox: puts }, origin: 'remote' });
  }

  // Les seq de la file qui correspondent aux éléments d'une moitié de lot (une clé peut en porter plusieurs).
  function seqsDe(lot, elements, entreesParSeq) {
    const cles = new Set(elements.map(cleDe));
    return lot.seqs.filter((s) => { const e = entreesParSeq.get(s); return e && cles.has(cleDe(e)); });
  }

  // Un lot → le serveur. Rend `true` si la passe peut continuer, `false` s'il faut l'arrêter (réseau, « inconnu »,
  // connexion à refaire, pause de quota). SEUL un `refus` dichotomise, et il n'arrête pas la passe.
  async function envoyerLot(lot, entreesParSeq, bilan) {
    const appel = await transport.pousser(lot.elements);
    const reponse = appel.reponse;
    // Pas d'erreur et pas de réponse : le serveur n'a rien accusé, donc rien n'est retiré (I5). Traité comme un
    // « inconnu » — donc en recul (R-L3-9), jamais en quarantaine : on ne parque pas pour un silence.
    const vide = !appel.erreur && !reponse;
    const erreur = appel.erreur || (vide ? { type: 'inconnu', status: null, message: '' } : null);
    if (!erreur) {
      if (reponse.server_time) surHeure(appliquerHeureServeur(reponse.server_time, maintenant()));
      const effets = await appliquer(lot, reponse, entreesParSeq);
      const { envoyes, ajustes } = compter(effets, entreesParSeq);
      bilan.envoyes += envoyes;
      bilan.ajustes += ajustes;
      bilan.conflits += effets.conflits.length;
      bilan.quarantaine += effets.quarantaine.length;
      return true;
    }
    logError('sync.push', { reason: vide ? 'reponse vide' : erreur.type, status: erreur.status });
    // 401, 403, « adresse non autorisée » : aucun essai n'est compté — c'est la garde de compte qui doit rejouer,
    // pas la file qui doit reculer. Rien n'est perdu, rien n'est marqué.
    if (erreur.type === 'auth') { bilan.erreur = erreur; bilan.attenteConnexion = true; return false; }
    // 413, 507, « exceeded » : la place manque. On s'arrête et on le dit ; la file reste entière (I5).
    if (erreur.type === 'quota') {
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: new Date(maintenant()).toISOString() } }] }, origin: 'remote' });
      bilan.erreur = erreur; bilan.pause = true; return false;
    }
    // R-L3-9 : tout ce qui n'est pas un `refus` nommé RECULE — réseau, 5xx, 429, et « inconnu » (un 404, un cache
    // de schéma PostgREST périmé, une réponse vide). Parquer la file pour un déploiement en retard l'enterrerait ;
    // seule une règle du serveur qui refuse une fiche justifie une quarantaine.
    if (erreur.type !== 'refus') {
      await reporter(lot.seqs, entreesParSeq, erreur);
      bilan.erreur = erreur;
      // Annoncé à l'interface : l'attente que les entrées viennent de se donner (tries d'avant l'incrément).
      bilan.recul = reculMs(Math.max(0, ...lot.seqs.map((s) => entreesParSeq.get(s)?.tries || 0)));
      return false;
    }
    // refus : le serveur refuse le lot ENTIER, sans nommer le fautif. Dichotomie jusqu'à l'isoler : une seule fiche
    // finit en quarantaine (nommée, la personne décide), les autres passent.
    if (lot.elements.length <= 1) {
      const seq = lot.seqs.length ? Math.max(...lot.seqs) : null;
      const entree = seq === null ? null : entreesParSeq.get(seq);
      // Un lot sans seq lisible ne peut désigner personne : rien n'est parqué, et c'est journalisé.
      if (!entree) { logError('sync.push', { reason: 'refus sans entree' }); return true; }
      await db.mutate({
        puts: { outbox: [{ ...entree, quarantined_at: new Date(maintenant()).toISOString(), last_error: 'refus' }] },
        deletes: { outbox: lot.seqs.filter((s) => s !== seq) },
        origin: 'remote',
      });
      bilan.quarantaine += 1;
      return true;
    }
    const milieu = Math.ceil(lot.elements.length / 2);
    const gauche = lot.elements.slice(0, milieu);
    const droite = lot.elements.slice(milieu);
    const okG = await envoyerLot({ elements: gauche, seqs: seqsDe(lot, gauche, entreesParSeq) }, entreesParSeq, bilan);
    // Une moitié qui rend `false` a rencontré un arrêt (réseau, connexion, pause, réponse vide) : la seconde moitié
    // n'est pas tentée, et rien n'est mis en quarantaine par accident.
    if (!okG) return false;
    return envoyerLot({ elements: droite, seqs: seqsDe(lot, droite, entreesParSeq) }, entreesParSeq, bilan);
  }

  async function envoyer() {
    const bilan = { envoyes: 0, ajustes: 0, conflits: 0, quarantaine: 0, retenues: 0, abandonnees: 0, recul: null, erreur: null, pause: false, attenteConnexion: false };
    const file = await lireFile();
    if (!file.length) return bilan;
    const entreesParSeq = new Map(file.map((e) => [e.seq, e]));
    const { lots, retenues, abandonnees } = await composerLots(file, (store, id) => db.get(store, id));
    bilan.retenues = retenues.length;
    bilan.abandonnees = abandonnees.length;
    await marquerRetenues(retenues, entreesParSeq);
    await retirerAbandonnees(abandonnees);
    for (const lot of lots) {
      const continuer = await envoyerLot(lot, entreesParSeq, bilan);
      if (!continuer) break;
    }
    return bilan;
  }

  return { envoyer };
}
