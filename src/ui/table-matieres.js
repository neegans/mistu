// Le texte d'une lecture d'index en échec (section « Imports », src/ui/add.js). Lot C à l'origine (spec docs/superpowers/specs/2026-10-19-table-des-
// matieres-design.md) ; le panneau d'index du lot C (« Ordre des photos », tableau à cocher, « Créer {n} références ») est remplacé par le lot I1
// « index fiable » (src/ui/index-livre.js, spec docs/superpowers/specs/2026-10-28-index-fiable-design.md) : il ne reste ici que cette phrase.
// B01 du 28 octobre : « Lecture coupée : lis moins de photos à la fois. » était faux dès qu'une seule photo était lue — une page coupée se relit
// désormais en deux moitiés (D-I2) ; la phrase dit ce qui s'est passé, jamais un conseil impossible.
import { t } from '../core/i18n.js';
import { texteEchec } from './import-cible.js';

// Rend { texte, code } : coupe et vide ont LEUR phrase ; tout le reste (illisible, hors_bornes et « Code : … », les phrases I-4, les raisons de la
// passerelle) est texteEchec du lot A (une définition, jamais une copie).
export function texteEchecIndex(erreur) {
  const raison = typeof erreur?.raison === 'string' ? erreur.raison : 'interne';
  if (raison === 'coupe') return { texte: t('Lecture coupée : une page est trop dense pour une seule lecture. Reprends la lecture : elle sera relue en deux moitiés.'), code: null };
  if (raison === 'vide') return { texte: t('Aucune entrée lue sur ces photos.'), code: null };
  return texteEchec(erreur);
}
