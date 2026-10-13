// Une réponse de sync_push → des effets, sans toucher à la base (spec § 5.3). Le moteur applique les effets en
// UNE transaction. Clés par (store, id) ; un accusé pour une clé hors du lot est ignoré (jamais de retrait aveugle).
const cle = (x) => `${x.store}:${x.id}`;

export function appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales = {} }) {
  const seqsParCle = new Map();
  for (const seq of lot.seqs) {
    const e = entreesParSeq.get(seq);
    if (!e) continue;
    const k = cle(e);
    if (!seqsParCle.has(k)) seqsParCle.set(k, []);
    seqsParCle.get(k).push(seq);
  }
  const retirer = [];
  const reecrire = {};
  const conflits = [];
  const quarantaine = [];
  const at = reponse.server_time || new Date().toISOString();
  for (const a of reponse.accepted || []) for (const s of seqsParCle.get(cle(a)) || []) retirer.push(s);
  for (const a of reponse.adjusted || []) {
    const k = cle(a);
    for (const s of seqsParCle.get(k) || []) retirer.push(s);
    const element = lot.elements.find((e) => cle(e) === k);
    if (element && element.data && !element.deleted) {
      (reecrire[a.store] ||= []).push({ ...element.data, updated_at: a.updated_at });
    }
  }
  for (const r of reponse.rejected || []) {
    const k = cle(r);
    const seqs = seqsParCle.get(k) || [];
    if (r.reason === 'conflit') {
      for (const s of seqs) retirer.push(s);
      conflits.push({ id: k, store: r.store, record_id: r.id, local: fichesLocales[k] ?? null, server: r.server || null, at, kind: 'donnees' });
    } else {
      // updated_at | cle | forme | taille (R9) : permanent, la fiche est nommée, la personne décide (Réglages).
      const seq = seqs.length ? Math.max(...seqs) : null;
      if (seq !== null) quarantaine.push({ seq, motif: String(r.reason || 'forme') });
      for (const s of seqs) if (s !== seq) retirer.push(s); // les doublons plus anciens de la même clé partent
    }
  }
  return { retirer, reecrire, conflits, quarantaine };
}
