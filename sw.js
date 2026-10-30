// Service worker : coquille applicative en cache pour consultation hors connexion des recettes déjà chargées.
// Les nouvelles demandes IA et les recherches de métadonnées ne fonctionnent pas hors connexion (spec §15).
importScripts('./sw-rules.js');
const VERSION = 'cuisine-os-v0.31.0-1';
// Tous les modules de production sont inclus ; tests/ reste chargé à la demande.
// La complétude de cette liste est vérifiée par tests/sync.js (graphe d'imports depuis src/app.js) : un chemin
// manquant ferait répondre 404 à cache.addAll et l'installation entière échouerait.
const SHELL = [
  './src/domain/comparaison-inventaire.js', './src/domain/inventaire-archive.js',
  './src/ui/inventaire.js', './src/ui/inventaire-formulaire.js', './src/ui/inventaire-restes.js', './src/ui/repas-garde.js', './src/ui/inventaire-comparaison.js', './src/ui/inventaire-texte.js', './src/sync/commandes-inventaire.js', './src/domain/inventaire-mutations.js', './src/domain/inventaire-persistance.js', './src/domain/inventaire-sources.js', './src/domain/inventaire-format.js', './src/domain/repas-courses.js',
  './src/domain/comparaison-cuisine.js',
  './src/ui/comparaison-cuisine.js',

  './src/domain/depot-traductions.js', './src/domain/journal-traductions.js', './src/domain/traductions-archive.js', './src/domain/traductions-locales-format.js', './src/domain/versions-structurees.js', './src/sync/commandes-traduction.js',
  './src/domain/structure-ingredients.js', './src/domain/traductions-format.js', './src/domain/plan-traduction.js', './src/domain/lecture-recette.js',
  './src/domain/lecture-traduction.js', './src/ui/traduction-editeur.js',
  './src/domain/comparaison-sources.js', './src/domain/transfert-premiere-liaison.js',
  './src/domain/index-application.js', './src/domain/index-stockage.js', './src/domain/revisions-source.js', './src/domain/sources-locaux.js', './src/domain/transferts-source.js', './src/sync/commandes-sources.js', './src/ui/index-vol.js',
  './src/domain/brouillons-editeur.js', './src/domain/brouillons-format.js', './src/domain/editeur-recette.js', './src/domain/edition-livre.js', './src/ui/brouillon-editeur.js', './src/ui/livre-editeur.js', './src/ui/recette-editeur.js', './src/ui/sortie-editeur.js',
  './src/domain/rendement.js', './src/ui/brouillons-liste.js',
  './src/domain/bibliotheque.js', './src/ui/navigation-contexte.js', './src/ui/actions-contenu.js', './src/ui/bibliotheque-liste.js',
  './src/domain/cycle-edition.js', './src/domain/corbeille-livres.js', './src/sync/cycle-edition.js', './src/sync/contexte-initial.js', './src/sync/lot-sources.js', './src/domain/sources-import.js',
  './src/domain/index-lecture.js',
  './src/domain/sources-format.js', './src/ui/revisions-source.js',
  './src/domain/cycle-recette.js', './src/domain/corbeille.js', './src/domain/contexte-import.js',
  './src/sync/cycle.js', './src/ui/corbeille.js', './src/ui/recette-garde.js',
  './', './index.html', './styles.css', './manifest.webmanifest', './icons/icon.svg', './icons/apple-touch-icon.png', './sw-rules.js',
  './src/app.js',
  './src/domain/traductions.js', './src/domain/heure-locale.js',
  './src/domain/reperes.js', './src/domain/reperes-parcours.js', './src/ui/reperes.js', './src/ui/reperes-affichage.js', './src/ui/photos-visibles.js', './src/ui/photo-gestion.js',
  './src/domain/thermomix.js',
  './src/domain/reponse-json.js', './src/domain/reprise-import.js', './src/domain/version-personnelle.js', './src/domain/thermomix-parcours.js', './src/domain/thermomix-session.js',
  './src/ui/reprise-import.js',
  './src/ui/thermomix.js', './src/ui/cookidoo.js', './src/ui/thermomix-garde.js',
  './src/vendor/supabase-2.117.3.umd.js',
  './src/core/blob-urls.js', './src/core/bornes.js', './src/core/bus.js', './src/core/observations-base.js',
  './src/domain/cuisine-archive.js', './src/domain/cuisine-format.js', './src/domain/cuisine-mutations.js', './src/domain/cuisine-persistance.js', './src/sync/commandes-cuisine.js', './src/ui/ecran-allume.js', './src/ui/minuteurs-session.js', './src/ui/voix-cuisine.js', './src/core/db.js', './src/core/dom.js', './src/core/hash.js', './src/core/i18n.js', './src/core/ids.js', './src/core/image.js', './src/core/isbn.js', './src/core/lien.js', './src/core/log.js', './src/core/router.js', './src/core/zip.js',
  './src/sync/auth.js', './src/sync/backfill.js', './src/sync/clock.js', './src/sync/config.js', './src/sync/conflits.js', './src/sync/fichiers.js', './src/sync/lots.js', './src/sync/mime.js', './src/sync/moteur.js',
  './src/sync/outbox.js', './src/sync/pull.js', './src/sync/push.js', './src/sync/reponses.js', './src/sync/imports-clos.js', './src/sync/tables.js', './src/sync/transport.js',
  './src/i18n/en.js',
  './src/model/repo.js', './src/model/schema.js', './src/model/seed.js',
  './src/domain/cuisine-personnelle.js', './src/domain/livre-bibliographie.js', './src/domain/livre-parcours.js', './src/domain/photo-page.js',
  './src/ui/cuisson.js', './src/ui/livre-sans-saisie.js', './src/ui/photo-page.js',
  './src/domain/apercu-web.js', './src/domain/assistant-config.js', './src/domain/backup.js', './src/domain/base64.js', './src/domain/classement.js', './src/domain/couverture.js', './src/domain/creation-ia.js', './src/domain/diet.js', './src/domain/dishes.js', './src/domain/exporters.js', './src/domain/grocery.js', './src/domain/import-cible.js', './src/domain/index-livre.js', './src/domain/lecture-web.js', './src/domain/lines.js', './src/domain/llm.js',
  './src/domain/pairing.js', './src/domain/passerelle.js', './src/domain/photo-web.js', './src/domain/quantity.js', './src/domain/recherche-web.js', './src/domain/rediscover.js', './src/domain/scaling.js', './src/domain/search.js', './src/domain/table-matieres.js', './src/domain/timers.js', './src/domain/units.js', './src/domain/vocabulaire.js',
  './src/ui/accueil-livre.js', './src/ui/add.js', './src/ui/book.js', './src/ui/components.js', './src/ui/cook.js', './src/ui/coquille.js', './src/ui/creer-ia.js', './src/ui/dish.js', './src/ui/grocery.js', './src/ui/home.js', './src/ui/icones.js', './src/ui/import-cible.js', './src/ui/import-web.js', './src/ui/import.js', './src/ui/index-livre.js', './src/ui/kitchen.js',
  './src/ui/library.js', './src/ui/livre-ajout.js', './src/ui/meals.js', './src/ui/photo-plat.js', './src/ui/porte-entree.js', './src/ui/puces.js', './src/ui/recipe-edit.js', './src/ui/recipe.js', './src/ui/regroupement.js', './src/ui/search.js', './src/ui/settings.js', './src/ui/signet.js', './src/ui/state.js', './src/ui/table-matieres.js', './src/ui/vol.js',
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
