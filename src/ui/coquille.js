// La coquille de l'app : barre du haut (marque, onglets dès 900 px, pastille, recherche, roue), zone principale et onglets bas (sous 900 px).
// Sortie d'app.js le 28 octobre 2026 (lot « fidélité aux maquettes ») pour que la suite puisse la monter et la mesurer : app.js lance
// l'application à l'import et reste hors suite.
import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { pastille } from './components.js';
import { lienBibliotheque } from './navigation-contexte.js';
import { icone } from './icones.js';

// D-UI-4 : « Bibliothèque » (l'écran s'ouvre sur les plats, tâche 2) ; D-UI-9 : ico = un nom d'icones.js, plus un émoji (les émojis ne prennent pas la couleur de l'onglet actif).
export const NAV = [
  { href: '/', label: 'Aujourd’hui', ico: 'soleil', match: (p) => p === '/' || p.startsWith('/search') },
  { href: '/library', label: 'Bibliothèque', ico: 'bibliotheque', match: (p) => p.startsWith('/corbeille') || p.startsWith('/library') || p.startsWith('/books') || p.startsWith('/dishes') || p.startsWith('/recipes') },
  { href: '/meals', label: 'Repas', ico: 'calendrier', match: (p) => p.startsWith('/meals') || p.startsWith('/lists') },
  { href: '/kitchen', label: 'Ma cuisine', ico: 'toque', match: (p) => p.startsWith('/kitchen') },
  { href: '/add', label: 'Ajouter', ico: 'plus', add: true, match: (p) => p.startsWith('/add') || p.startsWith('/import') },
];

export function navLinks(path, cls) {
  return NAV.map((n) => el('a', { href: n.href === '/library' ? lienBibliotheque() : `#${n.href}`, 'data-nav-destination': n.href, 'aria-current': n.match(path) ? 'page' : null, class: `${cls} ${n.add ? 'add' : ''} ${n.match(path) ? 'active' : ''}` }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone(n.ico)), el('span', null, t(n.label))));
}

export function coquille(path, { fenetre = window } = {}) {
  const main = el('main', { class: 'content', id: 'main', tabindex: '-1' });
  // Fidélité aux maquettes (28 octobre 2026) : dès 900 px, la navigation est une rangée d'onglets DANS la barre du haut (plus de panneau latéral) ;
  // les Réglages restent sur la roue de la barre. Sous 900 px, cette rangée est cachée (règle aside.sidenav d'origine) et nav.tabs sert, comme avant.
  // Revue du 28 octobre : un aside est un repère « complémentaire » ; role navigation le dit pour ce qu'il est.
  const side = el('aside', { class: 'sidenav', role: 'navigation', 'aria-label': 'Navigation' }, ...navLinks(path, ''));
  const tabs = el('nav', { class: 'tabs', 'aria-label': 'Navigation' }, ...navLinks(path, ''));
  const top = el('div', { class: 'topbar' },
    el('a', { class: 'brand', href: '#/' }, 'Mistu'),
    side,
    el('span', { class: 'spacer' }),
    // Pastille « N modifications à envoyer » (spec § 4.2 ; B04, lot I1) : cachée tant que la file est vide — rien n'est affiché sans fait.
    pastille(),
    el('a', { class: 'btn small', href: '#/search', title: t('Recherche') }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone('loupe')), el('span', { class: 'nowrap' }, t('Qu’est-ce qu’on cuisine ?'))),
    el('a', { href: '#/settings', class: 'btn small', title: t('Réglages'), 'aria-label': t('Réglages') }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone('roue'))));
  const lien = el('a', { class: 'lien-evitement', href: '#main', onClick: event => {
    event.preventDefault(); main.focus({ preventScroll: true }); main.scrollIntoView({ block: 'start', behavior: 'instant' });
  } }, t('Aller au contenu'));
  const root = el('div', { class: 'coquille' }, lien, top, el('div', { class: 'frame' }, main), tabs);
  const dispose = installerGeometrieCoquille({ root, tabs, topbar: top, fenetre });
  return { root, main, side, tabs, dispose };
}

// Le contenu réserve seulement l'espace réellement occupé par la navigation fixe.
export function installerGeometrieCoquille({ root, tabs, topbar, fenetre = window }) {
  let frame = null, detruit = false;
  const mesurer = () => {
    frame = null; if (detruit) return;
    const visible = fenetre.getComputedStyle(tabs).display !== 'none';
    const hauteur = visible ? Math.ceil(tabs.getBoundingClientRect().height) : 0;
    const viewport = fenetre.visualViewport?.height || fenetre.innerHeight;
    const flux = hauteur > viewport / 4;
    if (topbar) {
      const fixable = fenetre.getComputedStyle(root).getPropertyValue('--barre-fixable').trim() === '1';
      const hauteurHaute = Math.ceil(topbar.getBoundingClientRect().height);
      const hauteDansFlux = fixable && hauteurHaute > viewport / 4;
      if (root.classList.contains('barre-dans-flux') !== hauteDansFlux) root.classList.toggle('barre-dans-flux', hauteDansFlux);
      const marge = `${fixable && !hauteDansFlux ? hauteurHaute : 0}px`;
      if (root.style.getPropertyValue('--topbar-h') !== marge) root.style.setProperty('--topbar-h', marge);
    }
    if (root.classList.contains('nav-dans-flux') !== flux) root.classList.toggle('nav-dans-flux', flux);
    const valeur = `${flux ? 0 : hauteur}px`;
    if (root.style.getPropertyValue('--nav-h') !== valeur) root.style.setProperty('--nav-h', valeur);
  };
  const programmer = () => { if (!detruit && frame === null) frame = fenetre.requestAnimationFrame(mesurer); };
  const observer = fenetre.ResizeObserver ? new fenetre.ResizeObserver(programmer) : null;
  observer?.observe(tabs); if (topbar) observer?.observe(topbar); fenetre.addEventListener('resize', programmer); fenetre.visualViewport?.addEventListener('resize', programmer); programmer();
  return () => { if (detruit) return; detruit = true; observer?.disconnect(); fenetre.removeEventListener('resize', programmer); fenetre.visualViewport?.removeEventListener('resize', programmer); if (frame !== null) fenetre.cancelAnimationFrame(frame); frame = null; };
}
