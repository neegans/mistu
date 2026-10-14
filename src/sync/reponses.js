// Une réponse de sync_push → des effets, sans toucher à la base (spec § 5.3). Rend exactement quatre clés —
// `{ retirer, reecrire, conflits, quarantaine }` — et `src/sync/push.js` les applique en UNE transaction.
// Clés par (store, id) ; une clé que le serveur nomme hors du lot envoyé n'a AUCUN effet (R-L3-8) : ni retrait,
// ni réécriture, ni conflit, ni quarantaine.
import { cleDe } from './lots.js';

export function appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales = {} }) {
  const seqsParCle = new Map();
  for (const seq of lot.seqs) {
    const e = entreesParSeq.get(seq);
    if (!e) continue;
    const k = cleDe(e);
    if (!seqsParCle.has(k)) seqsParCle.set(k, []);
    seqsParCle.get(k).push(seq);
  }
  const retirer = [];
  const reecrire = {};
  const conflits = [];
  const quarantaine = [];
  const at = reponse.server_time || new Date().toISOString();
  for (const a of reponse.accepted || []) {
    const seqs = seqsParCle.get(cleDe(a)) || [];
    if (!seqs.length) continue; // R-L3-8 : clé hors du lot
    for (const s of seqs) retirer.push(s);
  }
  for (const a of reponse.adjusted || []) {
    const k = cleDe(a);
    const seqs = seqsParCle.get(k) || [];
    if (!seqs.length) continue; // R-L3-8
    for (const s of seqs) retirer.push(s);
    const element = lot.elements.find((e) => cleDe(e) === k);
    if (!element || !element.data || element.deleted) continue;
    // R-L3-7 : l'ajustement ne réécrit la fiche que si elle n'a pas bougé ICI pendant l'aller-retour. Si la personne
    // l'a modifiée (updated_at différent) ou supprimée (null), rien n'est réécrit : cette version-là a sa propre
    // entrée de file et repartira. Un appel sans contexte (la clé n'est pas dans fichesLocales) réécrit comme avant.
    const connue = Object.hasOwn(fichesLocales, k);
    if (connue && !(fichesLocales[k] && fichesLocales[k].updated_at === element.updated_at)) continue;
    (reecrire[a.store] ||= []).push({ ...element.data, updated_at: a.updated_at });
  }
  for (const r of reponse.rejected || []) {
    const k = cleDe(r);
    const seqs = seqsParCle.get(k) || [];
    if (!seqs.length) continue; // R-L3-8
    if (r.reason === 'conflit') {
      for (const s of seqs) retirer.push(s);
      conflits.push({ id: k, store: r.store, record_id: r.id, local: fichesLocales[k] ?? null, server: r.server || null, at, kind: 'donnees' });
    } else {
      // updated_at | cle | forme | taille (R9) : permanent, la fiche est nommée, la personne décide (Réglages).
      const seq = Math.max(...seqs);
      quarantaine.push({ seq, motif: String(r.reason || 'forme') });
      for (const s of seqs) if (s !== seq) retirer.push(s); // les doublons plus anciens de la même clé partent
    }
  }
  return { retirer, reecrire, conflits, quarantaine };
}
