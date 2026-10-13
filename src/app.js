// Point d'entrée : initialise la base, la langue de l'interface, la coquille et le routeur ; enregistre le service worker.
import { el, replace, toast } from './core/dom.js';
import { route, setNotFound, start, parseHash, refresh } from './core/router.js';
import { setUiLocale, t } from './core/i18n.js';
import * as repo from './model/repo.js';
import { on } from './core/bus.js';
import { logError } from './core/log.js';
import { getData, invalidate, setSyncState, getSyncState, routeApresRetour, relireReglages, isActivitySynced, demarrerSync, SYNC_ROUTE_KEY } from './ui/state.js';
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
import { renderSettings, demarrerConnexion } from './ui/settings.js';
import { renderShoppingList } from './ui/grocery.js';
import { renderAdd } from './ui/add.js';
import { porteEntreeModel, renderPorteEntree } from './ui/porte-entree.js';

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

// Route d'avant la connexion : demarrerConnexion() la mémorise, le retour du fournisseur arrive sans fragment.
// La clé est consommée une seule fois ; la décision elle-même est dans routeApresRetour (R21, R23).
function restoreRoute(retour) {
  let memo = null;
  try {
    memo = sessionStorage.getItem(SYNC_ROUTE_KEY);
    if (memo !== null) sessionStorage.removeItem(SYNC_ROUTE_KEY);
  } catch { return; } // stockage indisponible : la route par défaut s'applique
  const cible = routeApresRetour({ retour, memorisee: memo, hashActuel: location.hash });
  if (cible) location.hash = cible;
}

// Connexion : isolée du démarrage. L'app doit s'ouvrir sans compte (invariant I4), même si ce bloc casse — et
// même s'il PEND : demarrerSync borne le départ dans le temps (R28) et rattrape l'affichage s'il aboutit plus tard.
async function bootSync() {
  try {
    const auth = createAuth({ db: repo.db });
    // L'ordre handleReturn → session → guard vit dans demarrerSync. La route mémorisée est restaurée dès que le
    // retour est réellement connu : au démarrage, ou plus tard si la borne a été dépassée (la clé n'est pas
    // consommée entre-temps, donc aucune route n'est perdue).
    await demarrerSync({ auth, surEtat: ({ retour }) => restoreRoute(retour) });
    // Changement de session (jeton rafraîchi, déconnexion) : la garde est refaite avant d'exposer l'utilisateur.
    auth.onChange(({ user: suivant }) => {
      const avant = getSyncState().user?.id || null;
      (async () => {
        const g = suivant?.id ? await auth.guard(suivant.id, suivant.email) : null;
        // Les lignes du retour parlaient du démarrage : une session qui change les périme, on ne les garde pas.
        // `enAttente: false` : un changement de session est un événement réel, le compte est connu — sans cela la
        // section resterait sur « Vérification du compte… » (R30) si la borne du démarrage avait été dépassée.
        setSyncState({ user: g?.ok ? suivant : null, guard: g, retour: null, enAttente: false });
        invalidate();
        if ((getSyncState().user?.id || null) !== avant) refresh(); // l'écran affiché parle du compte : il doit suivre
      })().catch((error) => logError('sync.etat', { error }));
    });
  } catch (error) {
    logError('boot.sync', { error });
    setSyncState({ auth: null, user: null, guard: null, retour: null, enAttente: false });
  }
}

// Porte d'entrée (spec § 11, R34) : évaluée au DÉMARRAGE seulement, à la place de la coquille (aucune navigation
// derrière elle). Elle ATTEND un geste ; les trois sont nommés par PORTE_ACTIONS et câblés ici.
// Rend quand il n'y a plus de porte à montrer — le démarrage reprend alors son cours (registerRoutes, start).
async function porteDEntree() {
  let choix = null;
  try { choix = await repo.lirePorteEntree(); }
  catch (error) { logError('porte.lecture', { error }); } // base muette : la porte s'affiche, l'app reste utilisable
  const auth = getSyncState().auth;
  // Une boucle, pas une récursion : « Essayer un autre compte » recalcule le modèle et réaffiche la même porte.
  for (;;) {
    const etat = getSyncState();
    const model = porteEntreeModel({
      available: !!auth?.available,
      user: etat.user,
      guard: etat.guard,
      retour: etat.retour,
      enAttente: etat.enAttente === true,
      choixSansCompte: choix === 'sans_compte',
    });
    if (!model.afficher) return;
    // Le geste de la personne est la seule chose qui fait avancer ce bloc : rien n'est décidé pour elle.
    const geste = await new Promise((resolve) => {
      replace(document.getElementById('app'), renderPorteEntree(model, {
        signIn: () => resolve('signIn'),
        signOut: () => resolve('signOut'),
        sansCompte: () => resolve('sansCompte'),
      }));
    });
    if (geste === 'sansCompte') {
      // Le choix est écrit avant d'ouvrir l'app. S'il ne s'écrit pas, on ouvre quand même (invariant I4) : la porte
      // reviendra au prochain lancement — rien n'est affirmé qui ne soit arrivé.
      try { await repo.choisirSansCompte(); }
      catch (error) { logError('porte.choix', { error }); }
      choix = 'sans_compte';
      continue;
    }
    if (geste === 'signIn') {
      // Départ chez Google : la page est quittée. Si rien ne part, demarrerConnexion le dit (toast) et la porte reste.
      await demarrerConnexion(auth, '#/');
      continue;
    }
    // signOut : la session de cet appareil est fermée ; ni les données ni la file ne sont touchées (spec § 4.1).
    const essai = await auth?.signOut();
    if (essai?.error) { toast(t('La déconnexion n’a pas abouti.')); continue; }
    setSyncState({ user: null, guard: null });
  }
}

async function boot() {
  try {
    await repo.init();
    // Une seule lecture : state.js garde les réglages pour la capture et les relit à chaque événement qui
    // peut les réécrire (réglage touché, restauration d'archive, vidage d'appareil).
    const settings = await relireReglages();
    setUiLocale(settings.ui_locale);
    on('settings', ({ key, value }) => { if (key === 'ui_locale') { setUiLocale(value); current = null; refresh(); } });
    // Capture posée avant toute écriture de l'application : une seule porte, la mutation de db.js (spec § 5.2).
    // L'historique de consultation n'entre en file que si le réglage le dit, à chaque écriture.
    installCapture(repo.db, { getUserId: () => getSyncState().user?.id || null, isActivitySynced });
    // Avant la porte (R34) : l'app doit être installable dès la première visite, même si la personne reste devant
    // l'écran d'accueil sans rien toucher.
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker non enregistré', e));
    }
    await bootSync();
    // La porte attend un geste ; si elle casse, l'app s'ouvre quand même (invariant I4).
    try { await porteDEntree(); }
    catch (error) { logError('porte', { error }); }
    registerRoutes();
    start(onRoute);
  } catch (e) {
    logError('boot', { error: e });
    replace(document.getElementById('app'), el('div', { class: 'card danger', style: { margin: '1rem' } }, el('h2', null, 'Cuisine OS ne peut pas démarrer'), el('p', { class: 'muted' }, t('Code : {c}', { c: e?.name || 'Erreur' })), el('button', { class: 'btn', onClick: () => location.reload() }, t('Recharger'))));
  }
}

boot();
