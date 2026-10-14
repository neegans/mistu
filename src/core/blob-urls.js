// Propriétaire des URL blob: d'affichage (spec UX § 6, F4/S15) : chaque vue en crée par urlDeBlob, et app.js révoque tout
// à chaque changement de route ; library.js révoque aussi en tête de chaque draw() (le filtre redessine à chaque touche).
const vivantes = new Set();
export function urlDeBlob(blob) { const u = URL.createObjectURL(blob); vivantes.add(u); return u; }
export function revoquerUrlsDeBlob() { const n = vivantes.size; for (const u of vivantes) URL.revokeObjectURL(u); vivantes.clear(); return n; }
