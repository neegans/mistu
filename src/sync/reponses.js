// Une réponse de sync_push → des effets, sans toucher à la base (spec § 5.3). Rend exactement cinq clés —
// `{ retirer, reecrire, conflits, quarantaine, retirerConflits }` — et `src/sync/push.js` les applique en UNE
// transaction. Clés par (store, id) ; une clé que le serveur nomme hors du lot envoyé n'a AUCUN effet (R-L3-8) : ni
// retrait, ni réécriture, ni conflit, ni quarantaine. Exception K-5 (spec assistant-par-le-compte § 5.5) : un refus
// `conflit` sur assistant_config — et sur files (lot G, vague finale et ronde 2) — ne produit JAMAIS d'entrée `conflits`
// — retirer, et réécrire la version du serveur seulement aux conditions écrites dans la branche `conflit` ci-dessous.
import { cleDe } from './lots.js';
import { fusionnerFichier } from './fichiers.js';

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
    if (a.store === 'files') {
      // D-G16 : `element.data` est la projection, sans blob — un { ...data } remplacerait la ligne et perdrait l'original. Sans fiche locale
      // connue (appel sans contexte), rien n'est réécrit pour files.
      const locale = fichesLocales[k];
      if (!Object.hasOwn(fichesLocales, k) || !locale || locale.updated_at !== element.updated_at) continue;
      (reecrire.files ||= []).push(fusionnerFichier(locale, element.data, a.updated_at));
      continue;
    }
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
      if (r.store === 'assistant_config' || r.store === 'files') {
        // K-5 (§ 5.5, S11/F7) — et files depuis la vague finale du lot G : aucun journal. La version du serveur est réécrite ici
        // seulement si elle est lisible, au moins aussi récente, ET si la fiche n'a pas bougé pendant l'aller-retour (R-L3-7) —
        // sinon rien : une saisie faite entre-temps a sa propre entrée de file. Jamais remettre en file la version
        // refusée : elle n'est pas plus récente, le serveur la refuserait encore.
        const element = lot.elements.find((e) => cleDe(e) === k);
        const locale = fichesLocales[k];
        const serveur = r.server;
        const inchangee = !!locale && !!element && locale.updated_at === element.updated_at;
        // Une data qui n'est pas un objet nu (chaîne, tableau) serait ÉTALÉE dans le magasin, caractère par caractère :
        // jamais réécrite. Les deux instants doivent être lisibles — aucun repli : une fiche sans heure ne se compare à rien.
        const objetNu = !!serveur?.data && typeof serveur.data === 'object' && !Array.isArray(serveur.data);
        const instantServeur = Date.parse(serveur?.updated_at), instantLocal = Date.parse(locale?.updated_at);
        const aussiRecente = inchangee && Number.isFinite(instantServeur) && Number.isFinite(instantLocal) && instantServeur >= instantLocal;
        if (r.store === 'assistant_config') {
          // Serveur en tombale : retirer seulement — sa data porte l'ancienne clé, et c'est la réception qui appliquera la suppression.
          // `id` forcé (revue Neegan 1.3) : la clé primaire ne dépend jamais de ce que `data` porte.
          if (aussiRecente && objetNu && !serveur.deleted_at) (reecrire[r.store] ||= []).push({ ...serveur.data, id: element.id, updated_at: serveur.updated_at });
        } else if (aussiRecente && (serveur.deleted_at || objetNu)) {
          // files — vague finale du lot G : sync_push refuse aussi une version plus ANCIENNE que la sienne (`u < cur_updated` → conflit), pas seulement
          // l'instant égal de D-G16 ; une ligne files n'a rien à trancher (« Conflits à trancher » nommerait une empreinte, I-G8). Ronde 2 (R-G-24 bis) :
          // la convergence ne dépend plus du curseur — si la version du serveur a DÉJÀ été reçue, la réception ne la rapporte plus : elle est adoptée
          // ICI par fusionnerFichier (blob, clé, taille et type d'ici, D-G16), que push.js refond par conditionFichier dans la transaction ; une
          // tombale pose remote: null (D-G15 : ligne et blob restent, la ligne redevient candidate à l'envoi).
          (reecrire.files ||= []).push(fusionnerFichier(locale, serveur.deleted_at ? { remote: null } : serveur.data, serveur.updated_at));
        }
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
