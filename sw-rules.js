// Règles du service worker, partagées avec les tests : seules les requêtes GET de même origine SANS chaîne de requête sont mises en cache (spec § 5.6).
(function (root) {
  function shouldCache(request, origin) {
    if (request.method !== 'GET') return false;
    var url = new URL(request.url);
    return url.origin === origin && url.search === '';
  }
  root.CuisineSwRules = { shouldCache: shouldCache };
})(typeof self !== 'undefined' ? self : globalThis);
