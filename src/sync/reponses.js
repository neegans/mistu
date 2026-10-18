// Une réponse de sync_push → des effets, sans toucher à la base (spec § 5.3). Rend exactement quatre clés —
// `{ retirer, reecrire, conflits, quarantaine }` — et `src/sync/push.js` les applique en UNE transaction.
// Clés par (store, id) ; une clé que le serveur nomme hors du lot envoyé n'a AUCUN effet (R-L3-8) : ni retrait,
// ni réécriture, ni conflit, ni quarantaine.
import { cleDe } from './lots.js';

export function appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales = {}, conflitsRenvoyes = new Set() }) {
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
  // R-L3-29 : les conflits à RANGER. Un conflit journalisé « renvoyé » (la version d'ici est repartie, § 5.5) n'a
  // plus de raison d'être dès que le serveur accuse cette clé : la version d'ici est arrivée, il n'y a plus rien à
  // trancher. Sans cela l'entrée de journal restait affichée dans Réglages jusqu'à la purge des 30 jours, et le
  // seul moyen de s'en défaire était un geste — sur un conflit qui n'existait déjà plus.
  const retirerConflits = [];
  const rangerSiRenvoye = (cle) => { if (conflitsRenvoyes.has(cle)) retirerConflits.push(cle); };
  const at = reponse.server_time || new Date().toISOString();
  for (const a of reponse.accepted || []) {
    const k = cleDe(a);
    const seqs = seqsParCle.get(k) || [];
    if (!seqs.length) continue; // R-L3-8 : clé hors du lot
    for (const s of seqs) retirer.push(s);
    rangerSiRenvoye(k);
  }
  for (const a of reponse.adjusted || []) {
    const k = cleDe(a);
    const seqs = seqsParCle.get(k) || [];
    if (!seqs.length) continue; // R-L3-8
    for (const s of seqs) retirer.push(s);
    rangerSiRenvoye(k); // le serveur a bien pris cette version, seule son heure a changé
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
      if (r.store === 'assistant_config') {
        // K-5 (§ 5.5, S11/F7) : aucun journal. La version du compte est réécrite ici seulement si elle existe, n'est pas
        // une tombale, est au moins aussi récente, ET si la fiche n'a pas bougé pendant l'aller-retour (R-L3-7) —
        // sinon rien : une saisie faite entre-temps a sa propre entrée de file. Jamais remettre en file la version
        // refusée : elle n'est pas plus récente, le serveur la refuserait encore. Serveur en tombale : retirer
        // seulement — sa data porte l'ancienne clé, et c'est la réception qui appliquera la suppression.
        const element = lot.elements.find((e) => cleDe(e) === k);
        const locale = fichesLocales[k];
        const serveur = r.server;
        const inchangee = !!locale && !!element && locale.updated_at === element.updated_at;
        const aussiRecente = !!serveur?.data && !serveur.deleted_at && Number.isFinite(Date.parse(serveur.updated_at)) && Date.parse(serveur.updated_at) >= Date.parse(locale?.updated_at || 0);
        // `id` forcé (revue Neegan 1.3) : la clé primaire ne dépend jamais de ce que `data` porte.
        if (inchangee && aussiRecente) (reecrire[r.store] ||= []).push({ ...serveur.data, id: element.id, updated_at: serveur.updated_at });
        continue;
      }
      conflits.push({ id: k, store: r.store, record_id: r.id, local: fichesLocales[k] ?? null, server: r.server || null, at, kind: 'donnees' });
    } else {
      // updated_at | cle | forme | taille (R9) : permanent, la fiche est nommée, la personne décide (Réglages).
      const seq = Math.max(...seqs);
      quarantaine.push({ seq, motif: String(r.reason || 'forme') });
      for (const s of seqs) if (s !== seq) retirer.push(s); // les doublons plus anciens de la même clé partent
    }
  }
  // Un conflit que cette même réponse vient de journaliser n'est jamais rangé du même geste : la transaction
  // porterait un put et un delete pour la même clé, et la personne perdrait le conflit sans l'avoir vu.
  const nouveaux = new Set(conflits.map((c) => c.id));
  return { retirer, reecrire, conflits, quarantaine, retirerConflits: retirerConflits.filter((k) => !nouveaux.has(k)) };
}
