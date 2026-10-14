// Propriétaire des URL blob: d'affichage (spec UX § 6, F4/S15) : chaque vue en crée par urlDeBlob, et app.js révoque tout
// à chaque changement de route ; library.js révoque aussi en tête de chaque draw() (le filtre redessine à chaque touche).
const vivantes = new Set();
export function urlDeBlob(blob) { const u = URL.createObjectURL(blob); vivantes.add(u); return u; }
// Révoquer UNE URL connue : le cas de library.js, qui remplace la grille entière à chaque touche du filtre et ne
// peut donc pas révoquer « tout » (ce serait révoquer les vignettes qu'il vient de créer). D-T9 : la révocation
// vient APRÈS le remplacement des nœuds — une URL révoquée sous un <img> encore dans le document donne une erreur
// de console (net::ERR_FILE_NOT_FOUND). Rend `false` pour une URL inconnue : on ne révoque pas celle d'autrui.
export function revoquerUrlDeBlob(u) { if (!vivantes.has(u)) return false; vivantes.delete(u); URL.revokeObjectURL(u); return true; }
export function revoquerUrlsDeBlob() { const n = vivantes.size; for (const u of vivantes) URL.revokeObjectURL(u); vivantes.clear(); return n; }
