// Valeurs publiques par conception (clé anon + URL) : prod = GitHub Pages / origine dédiée ; dev = projet « mistu-dev » (D8).
// À remplir par Neegan ; une entrée vide désactive la synchronisation sur cette origine.
export const SUPABASE = {
  prod: { url: '', anonKey: '' },
  dev:  { url: '', anonKey: '' },
};
export function currentConfig(hostname = globalThis.location?.hostname || '') {
  const entry = ['localhost', '127.0.0.1'].includes(hostname) ? SUPABASE.dev : SUPABASE.prod;
  return entry.url && entry.anonKey ? entry : null;
}
