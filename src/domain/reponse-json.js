// Un objet JSON complet, éventuellement précédé de prose ou entouré d'une clôture JSON.
// Aucun champ réparé, aucun choix entre plusieurs objets, aucun code exécuté.
export function extraireObjetJson(texte, { maxOctets = 1024 * 1024, maxHabillage = 1000 } = {}) {
  if (typeof texte !== 'string' || new TextEncoder().encode(texte).byteLength > maxOctets) throw new Error('json');
  const s = texte.trim();
  try {
    const value = JSON.parse(s);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('json');
    return value;
  } catch { /* L'habillage seul peut être retiré ; le JSON intérieur reste strict. */ }
  const debut = s.indexOf('{'), fin = s.lastIndexOf('}');
  if (debut < 0 || fin < debut) throw new Error('json');
  const avant = s.slice(0, debut).replace(/```(?:json)?\s*$/iu, '').trim();
  const apres = s.slice(fin + 1).replace(/^\s*```/u, '').trim();
  if (avant.length + apres.length > maxHabillage || /[\[\]{}]|```/u.test(avant + apres)) throw new Error('json');
  const value = JSON.parse(s.slice(debut, fin + 1));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('json');
  return value;
}
