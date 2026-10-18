// Vocabulaire fermé des états (spec import-cible § 3.3, D-12) : une fonction PURE appelée par les FABRICANTS de fiches (import ciblé,
// création IA, signet, éditeur) AVANT toute écriture — jamais un mur dans db.mutate : la restauration, la réception et les passes du
// démarrage restent tolérantes. Une valeur hors liste lève une erreur nommée (magasin, champ, valeur). Pour une recette, un champ absent
// (ou nul) est toléré : une fiche ancienne peut ne pas le porter. Pour un import, le statut est obligatoire : un journal sans état n'existe pas.
import { AVAILABILITY, VERIFICATION, STATUTS_IMPORT } from '../model/schema.js';

// Le message ne recopie jamais une valeur hostile en entier : une chaîne est coupée à 80 points de code, le reste est décrit par son type.
const decrire = (valeur) => (typeof valeur === 'string' ? [...valeur].slice(0, 80).join('') : (valeur === null || ['number', 'boolean', 'undefined'].includes(typeof valeur) ? String(valeur) : typeof valeur));

export class ErreurVocabulaire extends Error {
  constructor(magasin, champ, valeur) {
    super(`Vocabulaire : ${magasin}.${champ} = « ${decrire(valeur)} » hors liste`);
    this.name = 'ErreurVocabulaire';
    this.magasin = magasin;
    this.champ = champ;
    this.valeur = valeur;
  }
}

// Par magasin : champ → { liste, obligatoire }. Un magasin absent d'ici n'a pas de vocabulaire fermé à vérifier.
const VOCABULAIRE = {
  recipes: {
    availability: { liste: AVAILABILITY, obligatoire: false },
    verification_state: { liste: VERIFICATION, obligatoire: false },
  },
  imports: {
    status: { liste: STATUTS_IMPORT, obligatoire: true },
  },
};

// Rend true, ou lève ErreurVocabulaire { magasin, champ, valeur }.
export function assertVocabulaire(fiche, magasin) {
  const regles = VOCABULAIRE[magasin];
  if (!regles) return true;
  const f = fiche && typeof fiche === 'object' ? fiche : {};
  for (const [champ, { liste, obligatoire }] of Object.entries(regles)) {
    const valeur = f[champ];
    if (valeur == null && !obligatoire) continue;
    if (!liste.includes(valeur)) throw new ErreurVocabulaire(magasin, champ, valeur);
  }
  return true;
}
