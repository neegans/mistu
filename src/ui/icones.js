// Icônes au trait (lot UI-1 « Carnet », D-UI-9, spec 2026-10-23-experience-carnet § 3.3) : vingt-trois SVG inline monochromes, 24 × 24, trait
// currentColor — elles prennent la couleur du texte qui les porte (onglet actif olive, pastille « Ajouter » papier, état vide gris). Module FEUILLE :
// aucun import, aucun texte d'écran. icone(nom) lève une TypeError sur un nom inconnu (une faute de frappe ou un émoji ne rend jamais une icône
// vide en silence) ; les noms sont lus par Object.hasOwn (« constructor » n'est pas une icône). Les tracés sont des <path d> seulement — les
// cercles en arcs — et tiennent dans la boîte 0 0 24 24 (tests/carnet.js les mesure) ; feather-like, trait 1,75, bouts et joints ronds.
const NS = 'http://www.w3.org/2000/svg';
const TRACES = Object.freeze({
  // navigation (app.js)
  soleil: ['M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  bibliotheque: ['M3 20h18', 'M5 20V5h3v15', 'M9 20V3h4v17', 'M15 20 13 6.5l3.5-.8L19.5 19.4z'],
  calendrier: ['M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M8 3v4M16 3v4M4 10h16'],
  toque: ['M7 15.5a3.5 3.5 0 0 1-.8-6.9A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 5.8 3.6 3.5 3.5 0 0 1-.8 6.9', 'M7 15.5V21h10v-5.5', 'M7 18h10'],
  plus: ['M12 5v14M5 12h14'],
  roue: ['M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6', 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1'],
  // grille Ajouter (add.js, tâche 5)
  livres: ['M4 4h5v16H4z', 'M9 4h5v16H9z', 'M14 5.2l4.4-1.2L21 19l-4.4 1.2z'],
  'appareil-photo': ['M3 8a2 2 0 0 1 2-2h2.5l1.5-2.5h6L16.5 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M12 9.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7'],
  crayon: ['M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', 'M14.5 5.5l3 3'],
  lien: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5'],
  etincelle: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z'],
  flocon: ['M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7', 'M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5M4 10.3 7 12l-3 1.7M20 10.3 17 12l3 1.7'],
  // accueil d'un livre (accueil-livre.js, tâche 5)
  page: ['M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M14 2v6h6'],
  horloge: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M12 7v5l3 2'],
  // états vides (emptyState, components.js)
  panier: ['M2 3h3l2.6 12.6a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.5L22 7H6', 'M9 21a1 1 0 1 0 0-2a1 1 0 1 0 0 2M18 21a1 1 0 1 0 0-2a1 1 0 1 0 0 2'],
  assiette: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9'],
  couverts: ['M6 2v7a3 3 0 0 0 6 0V2', 'M9 2v20', 'M18 2c-2 2.5-3 5.5-3 9h3v11'],
  salade: ['M3 12h18a9 9 0 0 1-18 0z', 'M7 12a5 5 0 0 1 10 0', 'M12 7V4'],
  'livre-ouvert': ['M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z', 'M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z'],
  loupe: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14', 'M21 21l-4.3-4.3'],
  // cartes et repères (tâches 2 à 4)
  globe: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'],
  personnes: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'],
  image: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M8.5 7a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3', 'M21 15l-5-5L5 21'],
});
// Les vingt-trois noms, dans l'ordre de la spec § 3.3 (le test en compte exactement 23).
export const NOMS_ICONES = Object.freeze(Object.keys(TRACES));
const ATTRIBUTS = Object.freeze({ viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });

// icone(nom) → un svg NEUF (jamais un nœud partagé : chaque site a le sien) ; TypeError sur un nom inconnu.
export function icone(nom) {
  if (typeof nom !== 'string' || !Object.hasOwn(TRACES, nom)) throw new TypeError(`icône inconnue : ${typeof nom === 'string' ? nom : typeof nom}`);
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, val] of Object.entries(ATTRIBUTS)) svg.setAttribute(k, val);
  svg.setAttribute('class', `icone icone-${nom}`);
  for (const d of TRACES[nom]) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.append(p); }
  return svg;
}
