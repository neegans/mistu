// Cache de lecture : charge la bibliothèque en mémoire, construit les index de recherche ; invalidé à chaque écriture.
import * as repo from '../model/repo.js';
import { on } from '../core/bus.js';
import { refresh } from '../core/router.js';
import { logError } from '../core/log.js';
import { t } from '../core/i18n.js';
import { buildDocs, buildLabelIndex } from '../domain/search.js';
import { buildIngredientIndex } from '../domain/lines.js';
import { loadUnits } from '../domain/units.js';

let cache = null;
on('change', () => { cache = null; });
on('settings', () => { cache = null; });

// --- État de la connexion (spec § 4.1) -------------------------------------
// Une seule source : posée au démarrage par app.js, lue par les vues sous ctx.sync. Rien n'est gardé ailleurs.
// « auth » est le module de connexion ; « user » vaut null tant que la garde de compte n'a pas accepté.
// « enAttente » : le démarrage de la connexion a dépassé sa borne de temps et n'a pas encore abouti (R28).
// « moteur » : l'instance du moteur de synchronisation, posée par le démarrage de app.js quand un client existe
// (L3, tâche 9) et retirée par « Se déconnecter » / « Changer de compte ». Null = rien ne tourne.
let sync = { auth: null, user: null, guard: null, retour: null, enAttente: false, moteur: null };

// Clé de la route mémorisée avant un départ chez le fournisseur (redirectTo est sans fragment : la route serait
// perdue au retour). Écrite par Réglages, consommée une seule fois au démarrage.
export const SYNC_ROUTE_KEY = 'cuisineos.route';

// Compteur de générations (R32) : incrémenté à CHAQUE pose d'état de SESSION, d'où qu'elle vienne (démarrage,
// auth.onChange, déconnexion depuis Réglages). Un travail tardif compare la génération qu'il a quittée à celle du
// moment où il aboutit : si quelqu'un a posé un état depuis, le sien est périmé et n'est pas appliqué.
let syncGen = 0;

export function setSyncState(next) {
  sync = { ...sync, ...next };
  syncGen += 1;
  cache = null; // le contexte des vues porte une copie de cet état : il doit être reconstruit
  return sync;
}

export const getSyncState = () => sync;
export const getSyncGeneration = () => syncGen;

// Route à appliquer après un retour du fournisseur (R21, R23). Pure : elle décide, elle n'écrit rien.
// La route mémorisée est restaurée à TOUT retour RÉEL — session obtenue, retour muet ou refus de l'adresse : le
// bouton « Activer la synchronisation » vit dans Réglages, et c'est là que les lignes du retour s'affichent.
// Trois garde-fous : un retour réel (`present`, R23 — un chargement ordinaire ne restaure rien), la mémoire lue une
// seule fois (l'appelant la retire avant d'appeler ici), et une route déjà portée par l'URL jamais écrasée.
export function routeApresRetour({ retour = null, memorisee = null, hashActuel = '' } = {}) {
  if (!retour?.present || !memorisee) return null;
  if (String(hashActuel || '').replace(/^#/, '')) return null;
  return memorisee;
}

// --- Pastille « N non envoyés » de la barre du haut (spec § 4.2) -----------
// Modèle pur, ici plutôt que dans app.js : app.js lance boot() à l'import et ne peut pas être chargé par un test.
// Rien n'est affiché sans file réelle (I5) : zéro, un nombre illisible ou négatif ne disent rien du tout. Le
// singulier est une chaîne à part — jamais un pluriel calculé sur une chaîne traduite.
// R-L3-20 : et rien du tout SANS COMPTE. Sans compte la file ne part jamais — elle se remplit à chaque écriture,
// par conception (spec § 5.2) — et « 3 non envoyés » annoncerait une attente que personne ne tient, en permanence,
// sur un appareil qui fonctionne exactement comme prévu.
export function pastilleModel({ aEnvoyer = 0, connecte = false } = {}) {
  if (!connecte) return null;
  if (!(aEnvoyer > 0)) return null;
  return aEnvoyer === 1 ? t('1 modification à envoyer') : t('{n} modifications à envoyer', { n: aEnvoyer });
}
// B04 (lot I1, D-I14) : la pastille compte des FICHES modifiées, pas des photos — « 1 non envoyé » se lisait à côté de « 1/1 photos envoyées » comme une
// contradiction. La forme courte sert là où la barre du haut est serrée (styles.css) ; le texte entier reste celui que lisent les lecteurs d'écran.
export function pastilleCourteModel({ aEnvoyer = 0, connecte = false } = {}) {
  if (pastilleModel({ aEnvoyer, connecte }) === null) return null;
  return t('{n} à envoyer', { n: aEnvoyer });
}

// --- Rendu après une passe du moteur (R-L3-16, R-L3-19) -------------------
// Écrans où la personne SAISIT : leur état ne vit que dans le DOM — texte tapé, lignes analysées pas encore
// enregistrées, étape de cuisson en cours, fichiers choisis. Un rendu demandé par le moteur les reconstruirait et
// emporterait tout cela, sans que personne l'ait demandé. Nommés une fois, ici ; `*` vaut UN segment.
export const ROUTES_DE_SAISIE = ['/recipes/new', '/recipes/creer', '/recipes/*/edit', '/recipes/*/importer', '/import', '/cook/*', '/add', '/add/livre'];

export function estRouteDeSaisie(path) {
  const segments = String(path || '').split('/').filter(Boolean);
  if (!segments.length) return false;
  return ROUTES_DE_SAISIE.some((motif) => {
    const attendus = motif.split('/').filter(Boolean);
    return attendus.length === segments.length && attendus.every((a, i) => a === '*' || a === segments[i]);
  });
}

// La passe vient-elle de se terminer en ayant ÉCRIT quelque chose ? Question à part, et volontairement séparée de
// celle du rendu : le cache de lecture doit être invalidé DÈS qu'il est périmé, même quand aucun rendu ne suit —
// sinon le prochain rendu, quel qu'il soit, relirait un cache d'avant la passe.
// `avant` = la valeur de `enCours` au changement d'état précédent.
export function passeAEcrit({ avant = false, etat = null } = {}) {
  if (!avant || etat?.enCours === true) return false; // seule la fin d'une passe compte
  const effets = etat?.derniersEffets;
  if (!effets) return false;
  // Lot G (§ 3.6) : une page arrivée (fichiersRecus) redessine la fiche affichée, comme une fiche reçue.
  return (effets.recues > 0) || (effets.supprimees > 0) || (effets.ajustes > 0) || (effets.conflits > 0) || (effets.fichiersRecus > 0);
}

// R-L3-16 : l'écran affiché doit montrer ce qui vient d'arriver de l'autre appareil — sauf s'il est de ceux qu'un
// rendu abîmerait. Trois refus, pour trois raisons distinctes :
//   `archive` : une opération d'archive travaille, et son écran porte un état qui ne vit QUE dans le DOM
//               (contrôles désactivés, bilan de restauration, bouton « Recharger l'application ») ;
//   `route` de saisie (R-L3-19) : la personne est en train d'écrire, et rien ne justifie de lui prendre sa saisie ;
//   `route` = /settings : la section se rafraîchit déjà par son propre abonnement (suivreMoteur), avec son
//               regroupement et sa garde d'archive — deux rendus pour une passe n'en valent pas mieux qu'un.
// Pure : elle décide, app.js rend. Le cache, lui, est invalidé par passeAEcrit, quoi que celle-ci réponde.
export function doitRendreApresPasse({ avant = false, etat = null, archive = false, route = '' } = {}) {
  if (!passeAEcrit({ avant, etat })) return false;
  if (archive) return false;
  if (estRouteDeSaisie(route)) return false;
  return route !== '/settings';
}

// Un seul moteur par appareil : la fabrique n'est appelée QUE s'il n'y en a pas encore. Sans cette garde, un compte
// qui arrive pendant la porte d'entrée en démarre un (auth.onChange → suivreSession), puis le démarrage en pose un
// second : deux jeux d'écouteurs, deux passes concurrentes, deux fois les appels au serveur. La garde vit ici, et
// pas dans app.js, pour être éprouvée — app.js lance boot() à l'import.
// R-L3-23 : poser le moteur n'est PAS un changement de session, et ne fait donc pas avancer la génération de R32.
// Avec `setSyncState`, la séquence suivante figeait Réglages : au démarrage hors ligne, la borne de 8 s (R28) est
// dépassée, le démarrage s'ouvre « en attente » et retient `generationQuittee` ; la porte d'entrée se referme, puis
// `demarrerMoteur()` appelle `poserMoteur` → `syncGen += 1` ; quand `getSession()` aboutit enfin, sa génération ne
// correspond plus et son résultat est JETÉ — « Vérification du compte… » reste affiché, sans aucun geste (R30),
// jusqu'au prochain rechargement. L'impasse était rattrapée en pratique par `INITIAL_SESSION` de supabase-js :
// l'invariant tenait par un événement d'une bibliothèque tierce, pas par le code. L'écriture reste volontairement
// directe (et invalide le cache des vues) : la génération ne compte que les clés de session.
export function poserMoteur(fabrique) {
  if (sync.moteur) return sync.moteur;
  const moteur = fabrique();
  if (!moteur) return null;
  sync = { ...sync, moteur };
  cache = null; // le contexte des vues porte une copie de cet état : il doit être reconstruit
  return moteur;
}

// --- Démarrage de la connexion, borné dans le temps (R28) ------------------
// Le démarrage de l'app ne doit JAMAIS attendre le réseau : `getSession()` rafraîchit le jeton quand il est périmé,
// et hors ligne il ne rend rien avant le délai propre du navigateur (dizaines de secondes) — pendant lequel l'écran
// reste blanc. Un bloc qui PEND n'est pas un bloc qui CASSE, et le try/catch de l'appelant ne couvre que le second.
// Au dépassement, l'app s'ouvre sans compte (invariant I4) ; quand le travail tardif aboutit, son résultat est
// appliqué et un nouveau rendu est demandé, exactement comme un changement de session (auth.onChange).
// L'ordre handleReturn → session → guard est inchangé ; `surEtat` reçoit l'état réel, tôt ou tard (route mémorisée).
export async function demarrerSync({ auth, delaiMs = 8000, surEtat = null } = {}) {
  const travail = (async () => {
    // Retour du fournisseur d'abord : le code est échangé, puis retiré de l'historique.
    const retour = await auth.handleReturn();
    let user = null;
    let guard = null;
    if (auth.available) {
      const s = await auth.session();
      // La garde de compte décide : un autre compte que celui connu de l'appareil ne devient jamais « connecté ».
      if (s?.user) { guard = await auth.guard(s.user.id, s.user.email); user = guard.ok ? s.user : null; }
    }
    return { auth, user, guard, retour, enAttente: false };
  })();
  const DEPASSE = Symbol('borne de demarrage depassee');
  let minuteur = null;
  const borne = new Promise((resolve) => { minuteur = setTimeout(() => resolve(DEPASSE), delaiMs); });
  const issue = await Promise.race([travail, borne]);
  if (issue !== DEPASSE) {
    clearTimeout(minuteur);
    const etat = setSyncState(issue);
    if (surEtat) surEtat(issue);
    return etat;
  }
  logError('sync_boot_timeout', {});
  const etatAttente = setSyncState({ auth, user: null, guard: null, retour: null, enAttente: true });
  // Génération quittée (R32) : tout ce qui est posé après cette ligne est PLUS RÉCENT que le travail tardif.
  const generationQuittee = syncGen;
  travail.then((tardif) => {
    // Un auth.onChange (jeton rafraîchi, déconnexion, connexion dans un autre onglet) a posé un état depuis le
    // dépassement : il dit la session d'aujourd'hui, le résultat tardif celle d'il y a dix secondes. On l'ignore.
    if (syncGen !== generationQuittee) return;
    setSyncState(tardif);
    if (surEtat) surEtat(tardif);
    invalidate();
    refresh(); // l'écran affiché parle du compte : il doit suivre
  }).catch(() => {
    // Le travail tardif a échoué : l'attente doit être levée, sinon la section reste sur « Vérification du
    // compte… » et n'offre plus aucun geste (R30), pour toujours. Journalisé par son code seul.
    logError('sync_boot_failed', {});
    if (syncGen !== generationQuittee) return;
    setSyncState({ enAttente: false });
    invalidate();
    refresh();
  });
  return etatAttente;
}

// --- Réglages lus par la capture (spec § 5.2) ------------------------------
// Copie en mémoire : la capture décide DANS la transaction d'écriture, elle ne peut pas attendre une lecture.
// Elle est RELUE depuis la base à chaque fois que les réglages peuvent avoir changé — un réglage touché, une
// restauration d'archive, un vidage d'appareil — et jamais corrigée à la main : « synchroniser mon historique »
// est un consentement, une copie en retard le trahirait.
let reglages = {};

export async function relireReglages() {
  try { reglages = await repo.getSettings(); }
  catch (error) { logError('reglages', { error }); }
  cache = null;
  return reglages;
}

export const isActivitySynced = () => reglages.sync_activity === true;
// Qualité d'envoi des photos (lot G, § 3.3) : relue à CHAQUE fichier par la passe (B-16) ; une valeur inconnue vaut Réduite.
export const qualiteEnvoi = () => (reglages.upload_quality === 'originale' ? 'originale' : 'reduite');

// Relecture demandée par le BUS (par opposition aux appels explicites, que leur appelant attend) : différée d'un
// tour de boucle, puis abandonnée si plus aucune base n'est ouverte. Raison (R-L3-17) : `Database.open()` rouvre
// dès que `idb` est nul, et une relecture que personne n'attend rouvrait la base jetable d'un test juste après sa
// fermeture — la connexion ainsi créée bloquait le nettoyage, et la suite échouait au hasard, toujours loin de son
// vrai coupable. En production la base de l'app est ouverte au démarrage et ne se referme pas : les réglages sont
// bel et bien relus sur `settings` comme sur `change`, un tour de boucle plus tard.
// Les relectures sont enchaînées (jamais deux lectures concurrentes) et la chaîne est observable : un test attend
// `relectureEnCours()` au lieu de deviner un délai.
let relecture = Promise.resolve();
export const relectureEnCours = () => relecture;

function demanderRelecture() {
  relecture = relecture
    .then(() => new Promise((resolve) => setTimeout(resolve, 0)))
    .then(() => (repo.db?.idb ? relireReglages() : undefined));
}

// Un réglage touché nomme sa clé ; une écriture annonce son magasin (`*` = tout). Dans les deux cas on relit.
on('settings', () => { demanderRelecture(); });
on('change', ({ store } = {}) => { if (!store || store === 'settings' || store === '*') demanderRelecture(); });

export async function getData(force = false) {
  if (cache && !force) return cache;
  const names = ['recipes', 'recipe_versions', 'book_editions', 'books', 'dishes', 'dish_recipe_links', 'ingredients', 'recipe_translations', 'cook_history', 'unit_definitions', 'unit_conventions', 'library_activity', 'rediscovery_prefs', 'meals', 'meal_feedback', 'inventory', 'appliances', 'cook_sessions', 'source_pages', 'source_documents', 'shopping_lists', 'scan_sessions', 'substitutions', 'imports'];
  const rows = await Promise.all(names.map((n) => repo.all(n)));
  const d = Object.fromEntries(names.map((n, i) => [n, rows[i]]));
  loadUnits(d.unit_definitions, d.unit_conventions);
  buildLabelIndex(d.ingredients);
  buildIngredientIndex(d.ingredients);
  const settings = await repo.getSettings();
  const ingredientsById = repo.indexBy(d.ingredients);
  const editionsById = repo.indexBy(d.book_editions);
  const booksById = repo.indexBy(d.books);
  const dishesById = repo.indexBy(d.dishes);
  const recipesById = repo.indexBy(d.recipes);
  const versionsById = repo.indexBy(d.recipe_versions);
  const versionsByRecipe = repo.groupBy(d.recipe_versions, 'recipe_id');
  const pagesById = repo.indexBy(d.source_pages);
  const docs = buildDocs({ recipes: d.recipes, versions: d.recipe_versions, editions: d.book_editions, books: d.books, dishes: d.dishes, links: d.dish_recipe_links, translations: d.recipe_translations, history: d.cook_history });
  const docsByRecipe = new Map(docs.map((x) => [x.recipe.id, x]));
  cache = {
    ...d, settings, sync, ingredientsById, editionsById, booksById, dishesById, recipesById, versionsById, versionsByRecipe, pagesById, docs, docsByRecipe,
    editionLabel(edition) {
      if (!edition) return '';
      const book = booksById.get(edition.book_id);
      return book ? book.title : '';
    },
    conventionFor(recipe) {
      const ed = recipe?.edition_id ? editionsById.get(recipe.edition_id) : null;
      return recipe?.unit_convention_id || ed?.unit_convention_id || null;
    },
  };
  return cache;
}

export function invalidate() { cache = null; }
