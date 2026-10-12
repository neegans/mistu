// Identifiants stables, indépendants des noms affichés (spec §14).
// Un préfixe lisible facilite le débogage sans porter de sens métier.

function fallbackUuid() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function newId(prefix = '') {
  const uuid = globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : fallbackUuid();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export const nowIso = () => new Date().toISOString();
