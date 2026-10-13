// Valeurs publiques par conception (clé anon + URL) : prod = origine dédiée (D5) ; dev = projet « mistu-dev » (D8).
// À remplir par Neegan ; une entrée vide désactive la synchronisation sur cette origine.
// Liste BLANCHE d'hôtes (S1) : une origine qui n'est pas nommée ici n'a aucune configuration — elle ne retombe pas
// sur « prod ». Sans cette liste, le jour où prod sera rempli, toute origine servant ces fichiers (un miroir, un
// sous-domaine oublié, une copie) créerait un client avec la clé du vrai projet.
// Neegan ajoute l'hôte du sous-domaine (D5) dans `prod.hosts` en même temps que l'URL et la clé.
export const SUPABASE = {
  prod: { url: '', anonKey: '', hosts: [] },
  dev:  { url: '', anonKey: '', hosts: ['localhost', '127.0.0.1'] },
};

// Rend l'entrée dont `hosts` contient l'hôte (comparaison exacte, en minuscules), ou null : hôte inconnu, hôte vide,
// ou entrée listée mais encore incomplète (une URL sans clé ne donne pas un client à moitié).
export function currentConfig(hostname = globalThis.location?.hostname || '') {
  const hote = String(hostname || '').toLowerCase();
  if (!hote) return null;
  for (const entry of Object.values(SUPABASE)) {
    if (!entry.hosts?.some((h) => String(h).toLowerCase() === hote)) continue;
    return entry.url && entry.anonKey ? entry : null;
  }
  return null;
}
