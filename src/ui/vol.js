// Le vol du document (lot B « Recette web complète », spec § 4.3.0, D-B13, I-B3 ; I-7 du lot A) : UN appel d'assistant à la fois par onglet,
// qu'il s'agisse d'une extraction de pages (src/ui/import-cible.js) ou d'une lecture de page web (src/ui/import-web.js). Module FEUILLE, sans
// vue et sans import : une seule variable de vol et un seul identifiant de document pour les deux écrans — un vol web refuse une extraction
// photo dans le même document, et l'inverse.
// Le document (onglet) : tiré au chargement du module, écrit dans imports.document_id_vol pendant un vol ; « Annuler » n'est offert que par lui.
export const DOCUMENT_ID = crypto.randomUUID();
// Le battement d'un vol : toutes les 15 s, la ligne interne `battement:<id>` de sync_state est réécrite (repo.battre, origine device : jamais en
// file ; la ligne imports ne bouge pas — vague finale du lot A, R-B-17) ; au démarrage, une ligne en_cours dont le battement a plus de 90 s passe
// interrompu (lot A, tâche 6).
export const BATTEMENT_MS = 15000;
let vol = null; // la tenue : { importId, controller, repo }
// Pose le vol si personne ne le tient : l'appelant appelle prendreVol AVANT tout await (une seconde tape pendant ses gardes voit le vol).
export function prendreVol(tenue) {
  if (vol) return false;
  vol = tenue;
  return true;
}
// Ne libère que SA tenue : un vol repris entre-temps par une autre tenue n'est jamais effacé par la première.
export function libererVol(tenue) { if (vol === tenue) vol = null; }
export const volEnCours = () => (vol ? { importId: vol.importId } : null);
// La tenue de ce document pour cet import (pour « Annuler »), sinon null.
export const volTenu = (importId) => (vol && vol.importId === importId ? vol : null);
export function reinitialiserVol() { vol?.controller?.abort(); vol = null; } // tests seulement
