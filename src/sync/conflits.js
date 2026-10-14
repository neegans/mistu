// Gestes sur un conflit (spec § 5.5). « Garder celle d'ici » : la version locale est restaurée avec un updated_at
// NEUF et mise en file (le serveur l'acceptera : plus récente). « Garder celle d'ailleurs » : la version du serveur
// est écrite sans remise en file. Dans les deux cas le conflit disparaît. Plus de 30 jours : retiré.
// R-L3-30 : sur un conflit `renvoye` (R64), les deux gestes « Garder… » REFUSENT — à une exception, nommée dans
// `garderAilleurs` : une tombale venue d'ailleurs reste acceptable, parce que c'est la seule décision que R-L3-26
// ait laissée à la personne. Le drapeau est relu ici, À L'EXÉCUTION, parce que c'est là que la course se joue : le
// rendu peut avoir montré un conflit ordinaire, puis une passe de réception l'upgrader en « renvoyé » avant le
// clic — et « Garder celle d'ailleurs » écrirait alors la version qui vient de PERDRE l'arbitrage I7.
import { syncNow } from './clock.js';
import { nettoyerChaines } from './lots.js';

// Rend `true` si le geste a été appliqué. `garderIci` écrit avec origin 'local' EXPRÈS : c'est la capture qui remet
// la fiche en file, et c'est précisément le renvoi voulu. Le retrait du conflit voyage dans la même transaction et
// reste interne (sync_conflicts n'est pas un magasin synchronisé : la capture ne le regarde pas).
export async function garderIci(db, conflit) {
  if (conflit?.renvoye === true) return false; // R-L3-30 : la version d'ici part déjà, rien à trancher ici
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
  // R-L3-30 : refusé sur un conflit renvoyé — c'est ce geste-là qui écrasait la version d'ici par celle qui a
  // perdu l'arbitrage. SAUF quand la version d'ailleurs est une TOMBALE : là, le choix n'est pas « une version plus
  // vieille des données », c'est « est-ce que j'accepte la suppression ? » — la seule décision que R-L3-26 ait
  // laissée à la personne quand une tombale plus ancienne que la fiche locale arrive. La lui retirer ferait
  // disparaître l'entrée de journal pendant que la fiche locale repart : la suppression venue d'ailleurs serait
  // annulée sans un mot, le miroir exact de la perte muette que R-L3-26 a supprimée.
  if (conflit?.renvoye === true && !serveur?.deleted_at) return false;
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

// R-L3-29 : « Ignorer » un conflit DÉJÀ RENVOYÉ (la version d'ici est repartie, § 5.5). Il retire l'entrée de
// journal et RIEN d'autre : le serveur acceptera cette version (elle est plus récente), et il n'y a aucune
// décision à prendre. Le drapeau est REVÉRIFIÉ ici — défense en profondeur : même appelé par erreur sur un conflit
// ordinaire, ce geste refuse, parce que celui-là attend vraiment une décision de la personne. Origine 'remote' :
// un retrait de journal n'est pas un geste sur les données et ne repart jamais au serveur.
export async function ignorerRenvoye(db, conflit) {
  if (conflit?.renvoye !== true) return false;
  await db.mutate({ deletes: { sync_conflicts: [conflit.id] }, origin: 'remote' });
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
