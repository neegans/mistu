// Gestes sur un conflit (spec § 5.5). « Garder celle d'ici » : la version locale est restaurée avec un updated_at
// NEUF et mise en file (le serveur l'acceptera : plus récente). « Garder celle d'ailleurs » : la version du serveur
// est écrite sans remise en file. Dans les deux cas le conflit disparaît. Plus de 30 jours : retiré.
import { syncNow } from './clock.js';
import { nettoyerChaines } from './lots.js';

// Rend `true` si le geste a été appliqué. `garderIci` écrit avec origin 'local' EXPRÈS : c'est la capture qui remet
// la fiche en file, et c'est précisément le renvoi voulu. Le retrait du conflit voyage dans la même transaction et
// reste interne (sync_conflicts n'est pas un magasin synchronisé : la capture ne le regarde pas).
export async function garderIci(db, conflit) {
  // Version locale nulle : la fiche a été supprimée ici pendant l'aller-retour. « Garder celle d'ici » veut alors
  // dire garder la suppression — jamais écrire une fiche sans clé, que la base refuserait. Le payload porte un
  // updated_at NEUF : sans lui, la capture mettrait en file une tombale sans heure, que le serveur refuserait
  // (motif « updated_at ») et qui finirait en quarantaine. La version du serveur sert de corps à la tombale.
  if (!conflit.local || typeof conflit.local !== 'object') {
    await db.mutate({
      deletes: { [conflit.store]: [conflit.record_id], sync_conflicts: [conflit.id] },
      origin: 'local',
      payloads: { [conflit.store]: { [conflit.record_id]: nettoyerChaines({ ...(conflit.server?.data || {}), updated_at: syncNow() }) } },
    });
    return true;
  }
  // R-L3-27 : la fiche restaurée est NETTOYÉE avant d'être écrite. Un conflit ne porte que des magasins
  // synchronisés, donc la question ne se pose pas ailleurs. Raison : R61 nettoie à l'écriture et à la restauration,
  // mais une fiche écrite AVANT cette vague est encore sale en base ; son écho propre (le serveur reçoit ce que
  // `lots.js` nettoie) fait un conflit à instants égaux, et renvoyer la version sale faisait renettoyer le serveur,
  // revenir le conflit, indéfiniment — la boucle I4, ici même, dans le geste censé la clore. Un `Blob` traverse
  // intact : les octets d'une photo ne sont pas du texte.
  const fiche = nettoyerChaines({ ...conflit.local, updated_at: syncNow() });
  await db.mutate({ puts: { [conflit.store]: [fiche] }, deletes: { sync_conflicts: [conflit.id] }, origin: 'local' });
  return true;
}

export async function garderAilleurs(db, conflit) {
  const serveur = conflit.server;
  // Un conflit dont le serveur n'a pas joint sa version (clé nommée sans contenu) : il n'y a rien à appliquer. Aucune
  // fiche n'est inventée et le conflit RESTE — mieux vaut un conflit qui attend qu'une perte muette.
  if (!serveur || (!serveur.deleted_at && (!serveur.data || typeof serveur.data !== 'object'))) return false;
  const puts = {};
  const deletes = { sync_conflicts: [conflit.id] };
  // Tombale : la suppression du serveur est appliquée ici. Sinon la version du serveur est écrite avec EXACTEMENT
  // son updated_at. Origine 'remote' dans les deux cas : rien ne repart (le serveur a déjà cette version).
  if (serveur.deleted_at) deletes[conflit.store] = [conflit.record_id];
  else puts[conflit.store] = [{ ...serveur.data, updated_at: serveur.updated_at }];
  await db.mutate({ puts, deletes, origin: 'remote' });
  return true;
}

export async function purgerAnciens(db, maintenantMs = Date.now(), joursMax = 30) {
  const limite = maintenantMs - joursMax * 86400000;
  // Un `at` illisible ne se date pas : le conflit reste plutôt que d'être retiré par accident (la personne le voit
  // dans Réglages et peut trancher). Origine 'remote' : un retrait de journal n'est pas un geste sur les données.
  const vieux = (await db.getAll('sync_conflicts')).filter((c) => Date.parse(c.at) < limite).map((c) => c.id);
  if (vieux.length) await db.mutate({ deletes: { sync_conflicts: vieux }, origin: 'remote' });
  return vieux.length;
}
