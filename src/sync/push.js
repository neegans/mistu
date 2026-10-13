// Envoi d'une passe (spec § 5.3) : la file est lue, dédoublonnée, relue, envoyée par lots ; chaque réponse est
// appliquée en UNE transaction (retraits, réécritures non capturées, conflits, quarantaine). I5 : une fiche n'est
// « envoyée » que par l'absence d'entrée la concernant.
import { composerLots } from './lots.js';
import { appliquerReponse } from './reponses.js';
import { appliquerHeureServeur } from './clock.js';
import { logError } from '../core/log.js';

const cle = (x) => `${x.store}:${x.id}`;

export function createPush({ db, transport, maintenant = Date.now, surHeure = () => {} }) {
  async function lireFile() {
    const toutes = await db.getAll('outbox');
    // Les entrées en quarantaine attendent un geste ; celles dont l'heure de reprise n'est pas venue attendent.
    return toutes.filter((e) => !e.quarantined_at && (!e.next_try_at || Date.parse(e.next_try_at) <= maintenant())).sort((a, b) => a.seq - b.seq);
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

  async function appliquer(lot, reponse, entreesParSeq) {
    // Lectures AVANT la transaction : la version locale d'un conflit est celle du moment de l'envoi.
    const fichesLocales = {};
    for (const e of lot.elements) fichesLocales[cle(e)] = (await db.get(e.store, e.id)) ?? null;
    const effets = appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales });
    const puts = { ...effets.reecrire };
    if (effets.conflits.length) puts.sync_conflicts = effets.conflits;
    if (effets.quarantaine.length) {
      puts.outbox = effets.quarantaine.map(({ seq, motif }) => ({ ...entreesParSeq.get(seq), quarantined_at: new Date(maintenant()).toISOString(), last_error: motif }));
    }
    // origin 'remote' : rien de ceci ne repart vers le serveur (réécriture d'un ajustement, journal, quarantaine).
    await db.mutate({ puts, deletes: effets.retirer.length ? { outbox: effets.retirer } : {}, origin: 'remote' });
    return effets;
  }

  async function envoyer() {
    const bilan = { envoyes: 0, ajustes: 0, conflits: 0, quarantaine: 0, retenues: 0, erreur: null, pause: false, attenteConnexion: false };
    const file = await lireFile();
    if (!file.length) return bilan;
    const entreesParSeq = new Map(file.map((e) => [e.seq, e]));
    const { lots, retenues } = await composerLots(file, (store, id) => db.get(store, id));
    bilan.retenues = retenues.length;
    await marquerRetenues(retenues, entreesParSeq);
    for (const lot of lots) {
      const { reponse, erreur } = await transport.pousser(lot.elements);
      if (erreur) { bilan.erreur = erreur; logError('sync.push', { reason: erreur.type, status: erreur.status }); break; }
      // Pas d'erreur et pas de réponse : le serveur n'a rien accusé, donc rien n'est retiré (I5). Le traitement
      // complet des échecs (recul, dichotomie, pause) vient avec le moteur.
      if (!reponse) { bilan.erreur = { type: 'inconnu', status: null, message: '' }; logError('sync.push', { reason: 'reponse vide' }); break; }
      if (reponse.server_time) surHeure(appliquerHeureServeur(reponse.server_time, maintenant()));
      const effets = await appliquer(lot, reponse, entreesParSeq);
      bilan.envoyes += (reponse.accepted || []).length;
      bilan.ajustes += (reponse.adjusted || []).length;
      bilan.conflits += effets.conflits.length;
      bilan.quarantaine += effets.quarantaine.length;
    }
    return bilan;
  }

  return { envoyer };
}
