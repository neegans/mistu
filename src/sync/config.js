// Valeurs publiques par conception (clé publique « sb_publishable_… » + URL du projet). Un SEUL projet Supabase,
// « mitsu », sert le site et le poste de travail (D8 révoquée le 13 octobre 2026, R33) : les deux entrées pointent
// le même projet, seule la liste d'hôtes diffère. Une entrée vide désactive la synchronisation sur cette origine.
// Liste BLANCHE d'hôtes (S1) : une origine qui n'est pas nommée ici n'a aucune configuration — elle ne retombe pas
// sur « prod ». Sans cette liste, le jour où prod sera rempli, toute origine servant ces fichiers (un miroir, un
// sous-domaine oublié, une copie) créerait un client avec la clé du vrai projet.
// Le sous-domaine (D5) s'ajoute dans `prod.hosts` le jour où son CNAME est actif.
export const SUPABASE = {
  prod: { url: 'https://ybdooerfeziiabsbfxtb.supabase.co', anonKey: 'sb_publishable_xyOfPxFvvn7MU8WaxQsG3A_Iayh0B5I', hosts: ['neegans.github.io'] },
  dev:  { url: 'https://ybdooerfeziiabsbfxtb.supabase.co', anonKey: 'sb_publishable_xyOfPxFvvn7MU8WaxQsG3A_Iayh0B5I', hosts: ['localhost', '127.0.0.1'] },
};

// Clé d'API Google Books, PUBLIQUE PAR CONCEPTION (spec « Identifier un livre, fiable » § 7) : vide = Google Books
// jamais appelé. Le jour où elle est posée, elle vient d'un projet Google Cloud DÉDIÉ et SANS facturation, restreinte
// à l'API Books, à un quota abaissé et aux référents du site — la restriction par référent seule est un dos-d'âne,
// pas un mur (S1). Jamais une clé sans restriction d'API. Procédure : docs/google-books.md.
export const GOOGLE_BOOKS = { key: '' };

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

// Spec assistant-par-le-compte K-3 (S3) : la configuration de l'assistant ne suit le compte que sur les hôtes de
// PRODUCTION. Une origine localhost:<port> est partagée par tout autre projet servi sur ce port — IndexedDB et jeton
// de session compris : s'y connecter y déposerait la clé. Hors production, le magasin reste local à l'appareil.
export function configAssistantSuitLeCompte(hostname = globalThis.location?.hostname || '') {
  const hote = String(hostname || '').toLowerCase();
  return !!hote && SUPABASE.prod.hosts.some((h) => String(h).toLowerCase() === hote);
}
