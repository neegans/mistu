// Service worker : coquille applicative en cache pour consultation hors connexion des recettes déjà chargées.
// Les nouvelles demandes IA et les recherches de métadonnées ne fonctionnent pas hors connexion (spec §15).
importScripts('./sw-rules.js');
const VERSION = 'cuisine-os-v0.11.0-4';
// Tous les modules de production sont inclus ; tests/ reste chargé à la demande.
// La complétude de cette liste est vérifiée par tests/sync.js (graphe d'imports depuis src/app.js) : un chemin
// manquant ferait répondre 404 à cache.addAll et l'installation entière échouerait.
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icons/icon.svg', './icons/apple-touch-icon.png', './sw-rules.js',
  './src/app.js',
  './src/vendor/supabase-2.117.3.umd.js',
  './src/core/blob-urls.js', './src/core/bornes.js', './src/core/bus.js', './src/core/db.js', './src/core/dom.js', './src/core/hash.js', './src/core/i18n.js', './src/core/ids.js', './src/core/image.js', './src/core/isbn.js', './src/core/lien.js', './src/core/log.js', './src/core/router.js', './src/core/zip.js',
  './src/sync/auth.js', './src/sync/backfill.js', './src/sync/clock.js', './src/sync/config.js', './src/sync/conflits.js', './src/sync/fichiers.js', './src/sync/lots.js', './src/sync/mime.js', './src/sync/moteur.js',
  './src/sync/outbox.js', './src/sync/pull.js', './src/sync/push.js', './src/sync/reponses.js', './src/sync/tables.js', './src/sync/transport.js',
  './src/i18n/en.js',
  './src/model/repo.js', './src/model/schema.js', './src/model/seed.js',
  './src/domain/assistant-config.js', './src/domain/backup.js', './src/domain/creation-ia.js', './src/domain/diet.js', './src/domain/dishes.js', './src/domain/exporters.js', './src/domain/grocery.js', './src/domain/import-cible.js', './src/domain/lecture-web.js', './src/domain/lines.js', './src/domain/llm.js',
  './src/domain/pairing.js', './src/domain/passerelle.js', './src/domain/quantity.js', './src/domain/recherche-web.js', './src/domain/rediscover.js', './src/domain/scaling.js', './src/domain/search.js', './src/domain/timers.js', './src/domain/units.js', './src/domain/vocabulaire.js',
  './src/ui/accueil-livre.js', './src/ui/add.js', './src/ui/book.js', './src/ui/components.js', './src/ui/cook.js', './src/ui/creer-ia.js', './src/ui/dish.js', './src/ui/grocery.js', './src/ui/home.js', './src/ui/import-cible.js', './src/ui/import-web.js', './src/ui/import.js', './src/ui/kitchen.js',
  './src/ui/library.js', './src/ui/livre-ajout.js', './src/ui/meals.js', './src/ui/porte-entree.js', './src/ui/puces.js', './src/ui/recipe-edit.js', './src/ui/recipe.js', './src/ui/search.js', './src/ui/settings.js', './src/ui/signet.js', './src/ui/state.js', './src/ui/vol.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Coquille : réseau d'abord quand disponible (pour recevoir les mises à jour), cache en repli. Tout le reste passe au réseau.
// Une requête avec chaîne de requête (ex. retour OAuth « ?code=… ») n'est jamais mise en cache (spec § 5.6, sw-rules.js).
self.addEventListener('fetch', (event) => {
  if (!self.CuisineSwRules.shouldCache(event.request, self.location.origin)) {
    if (self.CuisineSwRules.isSameOriginGet(event.request, self.location.origin)) {
      event.respondWith(fetch(event.request).catch(() => (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
    }
    return;
  }
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(event.request, copy)); }
      return res;
    }).catch(() => caches.match(event.request).then((hit) => hit || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
