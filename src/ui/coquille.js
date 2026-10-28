// La coquille de l'app : barre du haut (marque, onglets dès 900 px, pastille, recherche, roue), zone principale et onglets bas (sous 900 px).
// Sortie d'app.js le 28 octobre 2026 (lot « fidélité aux maquettes ») pour que la suite puisse la monter et la mesurer : app.js lance
// l'application à l'import et reste hors suite.
import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { pastille } from './components.js';
import { icone } from './icones.js';

// D-UI-4 : « Bibliothèque » (l'écran s'ouvre sur les plats, tâche 2) ; D-UI-9 : ico = un nom d'icones.js, plus un émoji (les émojis ne prennent pas la couleur de l'onglet actif).
export const NAV = [
  { href: '/', label: 'Aujourd’hui', ico: 'soleil', match: (p) => p === '/' || p.startsWith('/search') },
  { href: '/library', label: 'Bibliothèque', ico: 'bibliotheque', match: (p) => p.startsWith('/library') || p.startsWith('/books') || p.startsWith('/dishes') || p.startsWith('/recipes') },
  { href: '/meals', label: 'Ma semaine', ico: 'calendrier', match: (p) => p.startsWith('/meals') || p.startsWith('/lists') },
  { href: '/kitchen', label: 'Ma cuisine', ico: 'toque', match: (p) => p.startsWith('/kitchen') },
  { href: '/add', label: 'Ajouter', ico: 'plus', add: true, match: (p) => p.startsWith('/add') || p.startsWith('/import') },
];

export function navLinks(path, cls) {
  return NAV.map((n) => el('a', { href: `#${n.href}`, class: `${cls} ${n.add ? 'add' : ''} ${n.match(path) ? 'active' : ''}` }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone(n.ico)), el('span', null, t(n.label))));
}

export function coquille(path) {
  const main = el('main', { class: 'content', id: 'main' });
  // Fidélité aux maquettes (28 octobre 2026) : dès 900 px, la navigation est une rangée d'onglets DANS la barre du haut (plus de panneau latéral) ;
  // les Réglages restent sur la roue de la barre. Sous 900 px, cette rangée est cachée (règle aside.sidenav d'origine) et nav.tabs sert, comme avant.
  // Revue du 28 octobre : un aside est un repère « complémentaire » ; role navigation le dit pour ce qu'il est.
  const side = el('aside', { class: 'sidenav', role: 'navigation', 'aria-label': 'Navigation' }, ...navLinks(path, ''));
  const tabs = el('nav', { class: 'tabs', 'aria-label': 'Navigation' }, ...navLinks(path, ''));
  const top = el('div', { class: 'topbar' },
    el('a', { class: 'brand', href: '#/' }, 'Cuisine OS'),
    side,
    el('span', { class: 'spacer' }),
    // Pastille « N non envoyés » (spec § 4.2) : cachée tant que la file est vide — rien n'est affiché sans fait.
    pastille(),
    el('a', { class: 'btn small', href: '#/search', title: t('Recherche') }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone('loupe')), el('span', { class: 'nowrap' }, t('Qu’est-ce qu’on cuisine ?'))),
    el('a', { href: '#/settings', class: 'btn small', title: t('Réglages'), 'aria-label': t('Réglages') }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone('roue'))));
  return { root: el('div', null, top, el('div', { class: 'frame' }, main), tabs), main, side, tabs };
}
