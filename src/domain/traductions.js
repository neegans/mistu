// Traduction manuelle liée à une version. Le marqueur atteste l'alignement, jamais la fidélité linguistique.
export const LIMITES_TRADUCTION = Object.freeze({ ingredients: 200, etapes: 200, titre: 1000, ingredient: 2000, etape: 10000, total: 200000, octets: 500000 });
const encodeur = new TextEncoder();
const objet = value => !!value && typeof value === 'object' && !Array.isArray(value);
const refus = raison => ({ ok: false, raison });

// Compter sans fabriquer un tableau aussi gros qu'une chaîne reçue ; refuser dès la première borne dépassée.
function taille(texte, maximum) {
  if (typeof texte !== 'string') return -1;
  let n = 0;
  for (const _ of texte) if (++n > maximum) return -1;
  return n;
}

function verifierTextes(contenu) {
  if (!objet(contenu) || !Array.isArray(contenu.ingredients) || !Array.isArray(contenu.steps)) return refus('structure');
  const B = LIMITES_TRADUCTION;
  if (contenu.ingredients.length > B.ingredients || contenu.steps.length > B.etapes) return refus('limites');
  let total = taille(contenu.title, B.titre);
  if (total < 0) return refus(typeof contenu.title === 'string' ? 'limites' : 'structure');
  for (const [liste, maximum] of [[contenu.ingredients, B.ingredient], [contenu.steps, B.etape]]) {
    for (const texte of liste) {
      const n = taille(texte, maximum);
      if (n < 0) return refus(typeof texte === 'string' ? 'limites' : 'structure');
      total += n;
      if (total > B.total) return refus('limites');
    }
  }
  // La synchronisation borne une fiche à 512 Kio : garder une marge pour son identité et ses métadonnées.
  if (encodeur.encode(JSON.stringify({ title: contenu.title, ingredients: contenu.ingredients, steps: contenu.steps })).byteLength > B.octets) return refus('limites');
  return { ok: true, raison: null };
}

export function verifierSourceTraduction(version, title = '') {
  if (!objet(version) || !Array.isArray(version.ingredients) || !Array.isArray(version.steps)) return refus('source');
  if (version.ingredients.length > LIMITES_TRADUCTION.ingredients || version.steps.length > LIMITES_TRADUCTION.etapes) return refus('limites');
  const ingredient = i => objet(i) ? (i.source_text ?? i.name_text ?? '') : null;
  return verifierTextes({ title, ingredients: version.ingredients.map(ingredient), steps: version.steps.map(s => objet(s) ? (s.text ?? '') : null) });
}

export function validerContenuTraduction(contenu, version) {
  const source = verifierSourceTraduction(version);
  if (!source.ok) return source;
  const valide = verifierTextes(contenu);
  if (!valide.ok) return valide;
  if (contenu.ingredients.length !== version.ingredients.length || contenu.steps.length !== version.steps.length) return refus('alignement');
  return { ok: true, raison: null };
}

export function lireTraduction(row, version) {
  const resultat = (etat, raison = null, contenu = null) => ({ etat, raison, contenu });
  if (row == null) return resultat('absente');
  if (!objet(row) || !objet(version) || typeof version.id !== 'string' || !version.id || row.recipe_version_id !== version.id) return resultat('invalide', 'version');
  if (!Object.hasOwn(row, 'alignment_format')) return resultat('ancienne');
  if (row.alignment_format !== 1) return resultat('invalide', 'format');
  const valide = validerContenuTraduction(row.translated_content, version);
  return valide.ok ? resultat('courante', null, row.translated_content) : resultat('invalide', valide.raison);
}

// Comparaison synchrone des contenus sources relus dans la transaction, sans faux conflit dû à l'ordre des propriétés.
const canon = value => Array.isArray(value) ? value.map(canon) : objet(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canon(value[key])])) : value;
export function projectionSourceTraduction(version) {
  if (!objet(version)) return null;
  return JSON.stringify(canon({ id: version.id, recipe_id: version.recipe_id, ingredients: version.ingredients, steps: version.steps }));
}
