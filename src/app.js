// Point d'entrée : initialise la base, la langue de l'interface, la coquille et le routeur ; enregistre le service worker.
import { el, replace } from './core/dom.js';
import { route, setNotFound, start, parseHash, refresh } from './core/router.js';
import { setUiLocale, t } from './core/i18n.js';
import * as repo from './model/repo.js';
import { on } from './core/bus.js';
import { getData } from './ui/state.js';

import { renderHome } from './ui/home.js';
import { renderSearch } from './ui/search.js';
import { renderLibrary } from './ui/library.js';
import { renderBook } from './ui/book.js';
import { renderDish } from './ui/dish.js';
import { renderRecipe } from './ui/recipe.js';
import { renderRecipeEdit } from './ui/recipe-edit.js';
import { renderCook } from './ui/cook.js';
import { renderImport } from './ui/import.js';
import { renderMeals, renderMeal } from './ui/meals.js';
import { renderKitchen } from './ui/kitchen.js';
import { renderSettings } from './ui/settings.js';
import { renderShoppingList } from './ui/grocery.js';
import { renderAdd } from './ui/add.js';

const NAV = [
  { href: '/', label: 'Aujourd’hui', ico: '☀︎', match: (p) => p === '/' || p.startsWith('/search') },
  { href: '/library', label: 'Mes livres', ico: '📚', match: (p) => p.startsWith('/library') || p.startsWith('/books') || p.startsWith('/dishes') || p.startsWith('/recipes') },
  { href: '/meals', label: 'Ma semaine', ico: '🗓', match: (p) => p.startsWith('/meals') || p.startsWith('/lists') },
  { href: '/kitchen', label: 'Ma cuisine', ico: '🍳', match: (p) => p.startsWith('/kitchen') },
  { href: '/add', label: 'Ajouter', ico: '＋', add: true, match: (p) => p.startsWith('/add') || p.startsWith('/import') },
];

function navLinks(path, cls) {
  return NAV.map((n) => el('a', { href: `#${n.href}`, class: `${cls} ${n.add ? 'add' : ''} ${n.match(path) ? 'active' : ''}` }, el('span', { class: 'ico', 'aria-hidden': 'true' }, n.ico), el('span', null, t(n.label))));
}

function shell() {
  const path = parseHash().path;
  const main = el('main', { class: 'content', id: 'main' });
  const side = el('aside', { class: 'sidenav' }, ...navLinks(path, ''), el('a', { href: '#/settings', class: path.startsWith('/settings') ? 'active' : '' }, el('span', { class: 'ico' }, '⚙︎'), el('span', null, t('Réglages'))));
  const tabs = el('nav', { class: 'tabs', 'aria-label': 'Navigation' }, ...navLinks(path, ''));
  const top = el('div', { class: 'topbar' },
    el('a', { class: 'brand', href: '#/' }, 'Cuisine OS'),
    el('span', { class: 'spacer' }),
    el('a', { class: 'btn small', href: '#/search', title: t('Recherche') }, '⌕ ', el('span', { class: 'nowrap' }, t('Qu’est-ce qu’on cuisine ?'))),
    el('a', { class: 'btn small', href: '#/settings', title: t('Réglages'), 'aria-label': t('Réglages') }, '⚙︎'));
  return { root: el('div', null, top, el('div', { class: 'frame' }, side, main), tabs), main, side, tabs };
}

let current = null;
let renderSeq = 0;

async function onRoute({ handler, params, query, path }) {
  if (!current) { current = shell(); replace(document.getElementById('app'), current.root); }
  for (const a of [...current.side.querySelectorAll('a'), ...current.tabs.querySelectorAll('a')]) {
    const href = a.getAttribute('href').slice(1);
    const nav = NAV.find((n) => n.href === href);
    a.classList.toggle('active', nav ? nav.match(path) : path.startsWith(href));
  }
  const seq = ++renderSeq;
  replace(current.main, el('p', { class: 'muted' }, t('Chargement…')));
  try {
    const ctx = await getData();
    const node = await handler(params, query, ctx);
    if (seq !== renderSeq) return; // une navigation plus récente a eu lieu
    replace(current.main, node);
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    if (seq !== renderSeq) return;
    replace(current.main, el('div', { class: 'card danger' }, el('h2', null, t('Une erreur est survenue')), el('pre', null, String(e && e.stack || e))));
  }
}

function registerRoutes() {
  route('/', renderHome);
  route('/search', renderSearch);
  route('/library', renderLibrary);
  route('/books/:id', renderBook);
  route('/dishes/:id', renderDish);
  route('/recipes/new', (p, q, c) => renderRecipeEdit({ id: null }, q, c));
  route('/recipes/:id', renderRecipe);
  route('/recipes/:id/edit', renderRecipeEdit);
  route('/cook/:id', renderCook);
  route('/import', renderImport);
  route('/meals', renderMeals);
  route('/meals/:id', renderMeal);
  route('/kitchen', renderKitchen);
  route('/settings', renderSettings);
  route('/lists/:id', renderShoppingList);
  route('/add', renderAdd);
  setNotFound(async () => el('div', { class: 'card' }, el('h2', null, t('Page introuvable')), el('a', { class: 'btn', href: '#/' }, t('Retour à l’accueil'))));
}

async function boot() {
  try {
    await repo.init();
    const settings = await repo.getSettings();
    setUiLocale(settings.ui_locale);
    on('settings', ({ key, value }) => { if (key === 'ui_locale') { setUiLocale(value); current = null; refresh(); } });
    registerRoutes();
    start(onRoute);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker non enregistré', e));
    }
  } catch (e) {
    console.error(e);
    replace(document.getElementById('app'), el('div', { class: 'card danger', style: { margin: '1rem' } }, el('h2', null, 'Cuisine OS ne peut pas démarrer'), el('pre', null, String(e && e.stack || e))));
  }
}

boot();
