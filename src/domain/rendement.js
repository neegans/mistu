// Le rendement textuel décrit une version ; il ne sert jamais à calculer des portions.
export function lireRendementTexte(version) {
  const texte = version?.yield_text;
  return typeof texte === 'string' && texte.trim() && [...texte].length <= 200 ? texte : null;
}
