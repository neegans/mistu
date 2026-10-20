// Déclaration du schéma serveur, dérivée du schéma local (spec § 3.1). Source de vérité du générateur de migrations.
// generated : une colonne par index de STORES (même nom, texte), plus les colonnes listées ici ; required : champs de
// relation que l'app pose toujours (vérifié dans le code : un champ qui peut être nul n'est PAS listé).
import { STORES, SYNC_STORES } from '../model/schema.js';
import { ALLOWED_MIME } from './mime.js';

const EXTRA_GENERATED = {
  files: [{ name: 'size', sql: "((data->>'size')::bigint)", type: 'bigint' }, { name: 'mime', sql: "(data->>'mime')", type: 'text' }],
};
// Champs de relation toujours posés à la création (grep -n des créations de fiches dans src/ui et src/domain).
// timer_launches.cook_session_id est exclu : src/ui/recipe.js (minuterie d'une étape, hors séance de cuisson) appelle
// createTimerLaunch sans cook_session_id, et src/domain/timers.js lui donne alors la valeur null (champ réellement nul).
const REQUIRED = {
  book_editions: ['book_id'],
  source_pages: ['document_id'],
  recipe_versions: ['recipe_id'],
  recipe_translations: ['recipe_version_id'],
  dish_recipe_links: ['dish_id', 'recipe_id'],
  cook_history: ['recipe_id', 'recipe_version_id'],
  cook_sessions: ['recipe_id'],
  meal_feedback: ['meal_id'],
  library_activity: ['edition_id'],
  substitutions: ['recipe_version_id'],
};

export const TABLES = Object.fromEntries(SYNC_STORES.map((store) => [store, {
  key: STORES[store].keyPath,
  generated: [
    ...(STORES[store].indexes || []).map(([name, keyPath]) => ({ name, sql: `(data->>'${keyPath}')`, type: 'text' })),
    ...(EXTRA_GENERATED[store] || []),
  ],
  required: REQUIRED[store] || [],
}]));

export const keyOf = (store, record) => record[STORES[store].keyPath];

// Lot G (spec § 3.1, D-G8) : les champs d'une ligne `files` que le serveur porte — ce que lots.js envoie, ce que `identiques` compare.
export const CHAMPS_FILES_SERVEUR = Object.freeze(['sha256', 'mime', 'size', 'original_filename', 'remote', 'updated_at']);
const HASH = /^[a-f0-9]{64}$/;
const QUALITES = ['reduite', 'originale'];
const OCTETS_MAX = 52428800; // file_size_limit du seau `pages` (0002)

// La copie serveur d'une ligne `files` (D-G12) : objet nu, lu par Object.hasOwn ; un champ en plus est ignoré (F-23 : une version future qui
// enrichit `remote` ne fait pas renvoyer chaque photo) ; tout le reste — dont le booléen `true` de L3 — vaut « aucune copie serveur connue ».
// Une ligne reçue est une donnée hostile : rien ne se télécharge sur un remote invalide. `uploaded_at` n'est jamais interprété.
export function remoteValide(remote) {
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return false;
  const proto = Object.getPrototypeOf(remote);
  if (proto !== Object.prototype && proto !== null) return false;
  const lu = (cle) => (Object.hasOwn(remote, cle) ? remote[cle] : undefined);
  const sha = lu('sha256'), size = lu('size'), mime = lu('mime'), quality = lu('quality'), uploaded = lu('uploaded_at'), owner = lu('owner');
  return typeof sha === 'string' && HASH.test(sha)
    && Number.isSafeInteger(size) && size >= 1 && size <= OCTETS_MAX
    && ALLOWED_MIME.includes(mime) && QUALITES.includes(quality) && typeof uploaded === 'string'
    && typeof owner === 'string' && owner.length > 0 && owner.length <= 64;
}

// R-G-2 : un remote d'un autre compte vaut « aucune copie serveur connue » (ses octets sont dans un dossier que pages_select interdit).
export const remoteDeCeCompte = (remote, uid) => remoteValide(remote) && typeof uid === 'string' && remote.owner === uid;

// Ce qui part et ce qui se compare (D-G8) : les champs serveur seulement, `remote` tel quel s'il est valide (quel que soit owner : S-8), null
// sinon. Jamais `blob` (contrainte not (data ? 'blob') de 0001), ni `syncable`, ni `created_at`.
export function projectionFichier(row) {
  const sortie = {};
  for (const champ of CHAMPS_FILES_SERVEUR) {
    if (champ !== 'remote' && row && Object.hasOwn(row, champ) && row[champ] !== undefined) sortie[champ] = row[champ];
  }
  sortie.remote = remoteValide(row?.remote) ? row.remote : null;
  return sortie;
}

// Les 25 magasins de la migration 0001, FIGÉS : 0001 est appliquée sur mitsu et doit rester identique octet pour octet
// (spec assistant-par-le-compte § 6.1). Toute table neuve va dans une migration à ajout seul (0003, …).
export const SYNC_STORES_0001 = Object.freeze(['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files']);

// Les 26 magasins de la migration 0003, FIGÉS (lot A « import ciblé », spec § 3.5) : 0003 est appliquée sur mitsu (18 octobre 2026) et doit
// rester identique octet pour octet — son empreinte SHA-256 est épinglée dans tools/generer-migrations.test.mjs. Toute table neuve va dans
// une migration à ajout seul (0005, …), rendue pour les magasins de SYNC_STORES absents de cette liste.
export const SYNC_STORES_0003 = Object.freeze(['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files', 'assistant_config']);
