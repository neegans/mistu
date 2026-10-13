// Journal des incidents : jamais un objet d'erreur réseau ni une fiche, seulement un code et des identifiants (spec § 6.4).
const SAFE = ['store', 'id', 'status', 'reason', 'table', 'count'];
export function logError(code, details = {}) {
  const safe = {};
  for (const key of SAFE) if (details[key] !== undefined) safe[key] = String(details[key]).slice(0, 120);
  if (details.error instanceof Error) safe.name = details.error.name;
  console.error('[cuisine-os] ' + code, safe);
}
