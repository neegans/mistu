// Point d'entrée : initialise la base, la langue de l'interface, la coquille et le routeur ; enregistre le service worker.
import { el, replace, toast } from './core/dom.js';
import { route, setNotFound, start, parseHash, refresh } from './core/router.js';
import { setUiLocale, t } from './core/i18n.js';
import * as repo from './model/repo.js';
import { on } from './core/bus.js';
import { logError } from './core/log.js';
import { revoquerUrlsDeBlob } from './core/blob-urls.js';
import { getData, invalidate, getSyncState, routeApresRetour, relireReglages, isActivitySynced, demarrerSync, setSyncState, poserMoteur, passeAEcrit, doitRendreApresPasse, SYNC_ROUTE_KEY, qualiteEnvoi } from './ui/state.js';
import { installCapture } from './sync/outbox.js';
import { createAuth } from './sync/auth.js';
import { createMoteur } from './sync/moteur.js';
import { createTransport, createStockage } from './sync/transport.js';
import { configAssistantSuitLeCompte } from './sync/config.js';
import { pastille, majPastille } from './ui/components.js';
import { icone } from './ui/icones.js';

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
import { renderSettings, demarrerConnexion, archiveEnCours } from './ui/settings.js';
import { renderShoppingList } from './ui/grocery.js';
import { renderAdd } from './ui/add.js';
import { renderLivreAjoutRoute } from './ui/livre-ajout.js';
import { renderSignetRoute } from './ui/signet.js';
import { renderCreerIA } from './ui/creer-ia.js';
import { renderImportCible } from './ui/import-cible.js';
import { porteEntreeModel, renderPorteEntree } from './ui/porte-entree.js';

// D-UI-4 : « Bibliothèque » (l'écran s'ouvre sur les plats, tâche 2) ; D-UI-9 : ico = un nom d'icones.js, plus un émoji (les émojis ne prennent pas la couleur de l'onglet actif).
const NAV = [
  { href: '/', label: 'Aujourd’hui', ico: 'soleil', match: (p) => p === '/' || p.startsWith('/search') },
  { href: '/library', label: 'Bibliothèque', ico: 'bibliotheque', match: (p) => p.startsWith('/library') || p.startsWith('/books') || p.startsWith('/dishes') || p.startsWith('/recipes') },
  { href: '/meals', label: 'Ma semaine', ico: 'calendrier', match: (p) => p.startsWith('/meals') || p.startsWith('/lists') },
  { href: '/kitchen', label: 'Ma cuisine', ico: 'toque', match: (p) => p.startsWith('/kitchen') },
  { href: '/add', label: 'Ajouter', ico: 'plus', add: true, match: (p) => p.startsWith('/add') || p.startsWith('/import') },
];

function navLinks(path, cls) {
  return NAV.map((n) => el('a', { href: `#${n.href}`, class: `${cls} ${n.add ? 'add' : ''} ${n.match(path) ? 'active' : ''}` }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone(n.ico)), el('span', null, t(n.label))));
}

function shell() {
  const path = parseHash().path;
  const main = el('main', { class: 'content', id: 'main' });
  // Fidélité aux maquettes (28 octobre 2026) : dès 900 px, la navigation est une rangée d'onglets DANS la barre du haut (plus de panneau latéral) ;
  // les Réglages restent sur la roue de la barre. Sous 900 px, cette rangée est cachée (règle aside.sidenav d'origine) et nav.tabs sert, comme avant.
  const side = el('aside', { class: 'sidenav', 'aria-label': 'Navigation' }, ...navLinks(path, ''));
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

let current = null;
let renderSeq = 0;

async function onRoute({ handler, params, query, path }) {
  // La coquille est reconstruite au premier rendu et après un changement de langue : la pastille neuve est remise
  // à l'état RÉEL du moteur tout de suite, sinon elle resterait vide jusqu'à la prochaine passe.
  if (!current) { current = shell(); replace(document.getElementById('app'), current.root); majPastille(getSyncState().moteur?.etat(), !!getSyncState().user); }
  for (const a of [...current.side.querySelectorAll('a'), ...current.tabs.querySelectorAll('a')]) {
    const href = a.getAttribute('href').slice(1);
    const nav = NAV.find((n) => n.href === href);
    a.classList.toggle('active', nav ? nav.match(path) : path.startsWith(href));
  }
  const seq = ++renderSeq;
  // Les URL blob: de la vue qu'on quitte n'ont plus de lecteur (spec § 6, F4/S15) : elles sont révoquées ICI, au
  // seul endroit qui voit tous les changements de vue. Sans cela, chaque couverture affichée retiendrait ses octets
  // en mémoire jusqu'au rechargement de la page.
  revoquerUrlsDeBlob();
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
  route('/recipes/creer', renderCreerIA); // AVANT /recipes/:id (F1) : sinon « creer » serait lu comme un identifiant de fiche
  route('/recipes/:id', renderRecipe);
  route('/recipes/:id/edit', renderRecipeEdit);
  route('/recipes/:id/importer', renderImportCible); // import ciblé (lot A, spec § 4.1) : regex ancrée, l'ordre n'importe pas
  route('/cook/:id', renderCook);
  route('/import', renderImport);
  route('/meals', renderMeals);
  route('/meals/:id', renderMeal);
  route('/kitchen', renderKitchen);
  route('/settings', renderSettings);
  route('/lists/:id', renderShoppingList);
  route('/add/livre', renderLivreAjoutRoute);
  route('/add/signet', renderSignetRoute);
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
        // Différé d'un tour : l'état ci-dessus doit être POSÉ avant que le moteur lise getSyncState().user — et un
        // appel au moteur depuis l'intérieur d'un événement de session n'a pas à retarder la suite de cet événement.
        setTimeout(suivreSession, 0);
      })().catch((error) => logError('sync.etat', { error }));
    });
  } catch (error) {
    logError('boot.sync', { error });
    setSyncState({ auth: null, user: null, guard: null, retour: null, enAttente: false });
  }
}

// --- Moteur de synchronisation (spec § 5.3, § 5.5, § 4.2) -----------------
// Lancé après la porte d'entrée, et seulement quand un client existe (origine configurée, bibliothèque chargée) :
// sans client, rien ne serait tenté et un moteur posé dans l'état ferait croire à Réglages qu'il y a de quoi
// synchroniser. Il vit dans l'état de connexion : Réglages et la pastille le lisent là, et nulle part ailleurs.
let passeEnCours = false;

function surEtatMoteur(etat) {
  majPastille(etat, !!getSyncState().user); // R-L3-20 : la pastille n'existe qu'avec un compte
  const avant = passeEnCours;
  passeEnCours = etat.enCours === true;
  // Le cache de lecture est périmé dès que la passe a ÉCRIT, qu'un rendu suive ou non : une archive en cours ou une
  // saisie en cours empêchent le RENDU, pas la péremption — le prochain rendu doit lire la base, pas le cache.
  if (passeAEcrit({ avant, etat })) invalidate();
  // R-L3-16 et R-L3-19 : la règle du rendu (archive, écran de saisie, Réglages) vit dans state.js.
  if (doitRendreApresPasse({ avant, etat, archive: archiveEnCours(), route: parseHash().path })) refresh();
}

// Idempotent : un compte arrivé pendant la porte d'entrée a pu en démarrer un (auth.onChange → suivreSession), et
// un second jeu d'écouteurs ferait deux passes concurrentes. La garde vit dans state.js (poserMoteur), éprouvée.
function demarrerMoteur() {
  const { auth } = getSyncState();
  const client = auth?.getClient?.() || null;
  if (!client) return null;
  const existant = getSyncState().moteur;
  const moteur = poserMoteur(() => createMoteur({
    db: repo.db,
    transport: createTransport(client),
    stockage: createStockage(client), // lot G : le client ne sort de app.js que vers transport.js (R53)
    qualite: qualiteEnvoi,
    getUserId: () => getSyncState().user?.id || null,
    isActivitySynced,
    configSuitLeCompte: () => configAssistantSuitLeCompte(),
    fenetre: window,
    bus: { on },
  }));
  if (!moteur || moteur === existant) return moteur; // déjà posé et démarré : ni réabonnement ni seconde passe
  moteur.onEtat(surEtatMoteur);
  // `demarrer()` n'est pas attendu : il lit la base puis appelle le réseau, et le démarrage de l'app ne doit jamais
  // attendre le réseau (R28). Il ne rejette pas (le moteur attrape et rend un état).
  moteur.demarrer();
  return moteur;
}

// Un changement de session (connexion dans un autre onglet, jeton rafraîchi, déconnexion) : le moteur suit. Un
// compte qui arrive alors qu'il n'y a pas de moteur le démarre — c'est le cas d'une première connexion, et celui
// d'un moteur arrêté par « Se déconnecter ». Un compte déjà servi reçoit une passe : la session a changé, ce que
// l'autre appareil a écrit entre-temps doit arriver sans attendre un autre déclencheur.
function suivreSession() {
  const { user, moteur } = getSyncState();
  if (!user) return; // sans compte accepté par la garde, il n'y a rien à lancer ni à relancer
  if (!moteur) { demarrerMoteur(); return; }
  moteur.executer('session');
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
    const gestes = { signIn: null, signOut: null, sansCompte: null };
    // Garde : la porte ATTEND un geste. Si aucun bouton du modèle n'est câblé ici (action renommée d'un côté
    // seulement), personne ne pourrait plus jamais ouvrir l'app sur cet appareil. On journalise et on ouvre (I4).
    if (!model.boutons.some((b) => Object.hasOwn(gestes, b.action))) { logError('porte.sans_geste', {}); return; }
    // Le geste de la personne est la seule chose qui fait avancer ce bloc : rien n'est décidé pour elle.
    const geste = await new Promise((resolve) => {
      const racine = renderPorteEntree(model, {
        signIn: () => resolve('signIn'),
        signOut: () => resolve('signOut'),
        sansCompte: () => resolve('sansCompte'),
      });
      replace(document.getElementById('app'), racine);
      // `autofocus` ne prend pas sur un nœud inséré après le chargement : le focus est posé une fois en place.
      racine.querySelector('button[autofocus]')?.focus();
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
      // R35 : la route COURANTE est mémorisée (le défaut de demarrerConnexion), pas l'accueil — un lien profond
      // ouvert au premier lancement survit au détour par le fournisseur (routeApresRetour fait le reste).
      await demarrerConnexion(auth);
      continue;
    }
    // signOut : la session de cet appareil est fermée ; ni les données ni la file ne sont touchées (spec § 4.1).
    const essai = await auth?.signOut();
    if (essai?.error) { toast(t('La déconnexion n’a pas abouti.')); continue; }
    // `retour: null` : les lignes du retour parlaient de la session qu'on vient de fermer — elles ne lui survivent pas.
    setSyncState({ user: null, guard: null, retour: null });
  }
}

async function boot() {
  try {
    // Capture posée avant toute écriture de l'application, init() compris : une seule porte, la mutation de db.js (spec § 5.2).
    // L'historique de consultation n'entre en file que si le réglage le dit, à chaque écriture. Les passes d'init() écrivent toutes en
    // origine 'device' (jamais capturées) SAUF l'effacement de la clé locale (Passerelle T4) : écriture d'origine 'local', elle doit
    // être capturée pour que la ligne vide parte au compte et efface la clé du serveur. Poser la capture après init() la perdrait.
    installCapture(repo.db, { getUserId: () => getSyncState().user?.id || null, isActivitySynced, configSuitLeCompte: () => configAssistantSuitLeCompte() });
    await repo.init();
    // Une seule lecture : state.js garde les réglages pour la capture et les relit à chaque événement qui
    // peut les réécrire (réglage touché, restauration d'archive, vidage d'appareil).
    const settings = await relireReglages();
    setUiLocale(settings.ui_locale);
    on('settings', ({ key, value }) => { if (key === 'ui_locale') { setUiLocale(value); current = null; refresh(); } });
    // Avant la porte (R34) : l'app doit être installable dès la première visite, même si la personne reste devant
    // l'écran d'accueil sans rien toucher.
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker non enregistré', e));
    }
    await bootSync();
    // La porte attend un geste ; si elle casse, l'app s'ouvre quand même (invariant I4).
    try { await porteDEntree(); }
    catch (error) { logError('porte', { error }); }
    // Après la porte, avant les routes : la synchronisation ne doit jamais empêcher l'app de s'ouvrir (I4).
    try { demarrerMoteur(); }
    catch (error) { logError('sync.moteur', { error }); }
    registerRoutes();
    start(onRoute);
  } catch (e) {
    logError('boot', { error: e });
    replace(document.getElementById('app'), el('div', { class: 'card danger', style: { margin: '1rem' } }, el('h2', null, 'Cuisine OS ne peut pas démarrer'), el('p', { class: 'muted' }, t('Code : {c}', { c: e?.name || 'Erreur' })), el('button', { class: 'btn', onClick: () => location.reload() }, t('Recharger'))));
  }
}

boot();
