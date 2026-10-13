// Point d'entrée : initialise la base, la langue de l'interface, la coquille et le routeur ; enregistre le service worker.
import { el, replace } from './core/dom.js';
import { route, setNotFound, start, parseHash, refresh } from './core/router.js';
import { setUiLocale, t } from './core/i18n.js';
import * as repo from './model/repo.js';
import { on } from './core/bus.js';
import { logError } from './core/log.js';
import { getData, invalidate, setSyncState, getSyncState, SYNC_ROUTE_KEY } from './ui/state.js';
import { installCapture } from './sync/outbox.js';
import { createAuth } from './sync/auth.js';

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
    logError('route', { error: e });
    if (seq !== renderSeq) return;
    replace(current.main, el('div', { class: 'card danger' }, el('h2', null, t('Une erreur est survenue')), el('p', { class: 'muted' }, t('Code : {c}', { c: e?.name || 'Erreur' })), el('button', { class: 'btn', onClick: () => location.reload() }, t('Recharger'))));
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

// Réglages gardés en mémoire : la capture des écritures les lit à chaque mutation, sans toucher la base (spec § 5.2).
let settingsCache = {};

// Route d'avant la connexion : signIn() la mémorise, le retour du fournisseur arrive sans fragment.
// La clé est consommée une seule fois ; elle ne s'applique jamais par-dessus une route déjà présente.
function restoreRoute(retour) {
  let memo = null;
  try {
    memo = sessionStorage.getItem(SYNC_ROUTE_KEY);
    if (memo !== null) sessionStorage.removeItem(SYNC_ROUTE_KEY);
  } catch { return; } // stockage indisponible : la route par défaut s'applique
  if (!memo || !(retour?.error === null || retour?.codeSansSession)) return;
  if ((location.hash || '').replace(/^#/, '')) return;
  location.hash = memo;
}

async function boot() {
  try {
    await repo.init();
    const settings = await repo.getSettings();
    settingsCache = settings;
    setUiLocale(settings.ui_locale);
    on('settings', ({ key, value }) => {
      settingsCache = { ...settingsCache, [key]: value };
      if (key === 'ui_locale') { setUiLocale(value); current = null; refresh(); }
    });
    // Capture posée avant toute écriture de l'application : une seule porte, la mutation de db.js (spec § 5.2).
    // L'historique de consultation n'entre en file que si le réglage le dit, à chaque écriture.
    installCapture(repo.db, {
      getUserId: () => getSyncState().user?.id || null,
      isActivitySynced: () => settingsCache.sync_activity === true,
    });
    const auth = createAuth({ db: repo.db });
    // Retour du fournisseur AVANT le premier rendu : le code est échangé, puis retiré de l'historique.
    const retour = await auth.handleReturn();
    let user = null;
    let guard = null;
    if (auth.available) {
      const s = await auth.session();
      // La garde de compte décide : un autre compte que celui connu de l'appareil ne devient jamais « connecté ».
      if (s?.user) { guard = await auth.guard(s.user.id, s.user.email); user = guard.ok ? s.user : null; }
    }
    setSyncState({ auth, user, guard, retour });
    restoreRoute(retour);
    // Changement de session (jeton rafraîchi, déconnexion) : la garde est refaite avant d'exposer l'utilisateur.
    auth.onChange(({ user: suivant }) => {
      const avant = getSyncState().user?.id || null;
      (async () => {
        const g = suivant?.id ? await auth.guard(suivant.id, suivant.email) : null;
        setSyncState({ user: g?.ok ? suivant : null, guard: g });
        invalidate();
        if ((getSyncState().user?.id || null) !== avant) refresh(); // l'écran affiché parle du compte : il doit suivre
      })().catch((error) => logError('sync.etat', { error }));
    });
    registerRoutes();
    start(onRoute);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker non enregistré', e));
    }
  } catch (e) {
    logError('boot', { error: e });
    replace(document.getElementById('app'), el('div', { class: 'card danger', style: { margin: '1rem' } }, el('h2', null, 'Cuisine OS ne peut pas démarrer'), el('p', { class: 'muted' }, t('Code : {c}', { c: e?.name || 'Erreur' })), el('button', { class: 'btn', onClick: () => location.reload() }, t('Recharger'))));
  }
}

boot();
