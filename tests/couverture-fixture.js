// Fixtures du lot E « Un livre reconnu depuis sa couverture » (spec docs/superpowers/specs/2026-10-19-couverture-lue-design.md, § 7) : partagées par
// tests/couverture.js et par le bloc « La ROUTE, partie C » de tests/ajouter.js. Copies PROPRES à E (F-13) : tests/import-cible.js n'est pas touché.
// Les documents d'Open Library sont ceux mesurés le 19 octobre 2026 (spec § 3.4, remesurés par l'auteur du plan le même jour, mêmes `fields`).
export const LECTURE = Object.freeze({ title: 'À la di Stasio', subtitle: null, authors: ['Josée Di Stasio'], publisher: 'Flammarion Québec', language: 'fr', uncertain: [] });
export const LECTURE_BERBER = Object.freeze({ title: 'Berber & Q', subtitle: null, authors: ['Josh Katz'], publisher: null, language: 'en', uncertain: [] });
export const LECTURE_JERUSALEM = Object.freeze({ title: 'Jerusalem', subtitle: null, authors: ['Yotam Ottolenghi', 'Sami Tamimi'], publisher: null, language: 'en', uncertain: [] });

export const OL_DOCS = Object.freeze([
  { author_name: ['Josée Di Stasio'], edition_count: 1, first_publish_year: 2004, isbn: ['9782890772816', '2890772810'], language: ['fre'], publisher: ['Flammarion Québec'], title: 'À la di Stasio', subject: ['Cooking', 'Cuisine'] },
  { author_name: ['Josee Di Stasio'], edition_count: 1, isbn: ['9782890774247', '2890774244'], publisher: ['n/a'], title: 'À LA DI STASIO 3' },
  { author_name: ['Josee Di Stasio'], edition_count: 1, isbn: ['9780980992489', '0980992486'], publisher: ['Transcontinental'], title: 'Pasta Et Cetera a la Di Stasio', subject: ['Cooking (Pasta)', 'Italian Cooking', 'Cuisine (Pâtes alimentaires)', 'Cuisine italienne'] },
  { author_name: ['Josh Katz'], edition_count: 1, first_publish_year: 2022, isbn: ['9780857839879', '085783987X'], language: ['eng'], publisher: ['Octopus Publishing Group'], title: 'Berber&Q' },
  { author_name: ['Josh Katz'], edition_count: 2, first_publish_year: 2018, isbn: ['9781785035289', '9781473550773', '1785035282', '1473550777'], language: ['eng'], publisher: ['Ebury Publishing', 'Penguin Random House'], title: 'Berber and Q', subject: ['Barbecuing'] },
  { author_name: ['Yotam Ottolenghi', 'Sami Tamimi'], edition_count: 8, first_publish_year: 2012,
    isbn: ['8416295026', '9788416295029', '044901567X', '9781607743941', '9781448148585', '9783831023332', '3831023336', '9780449015674', '1607743949', '1448148588', '0091943744', '9780091943745'],
    language: ['eng', 'spa'], publisher: ['Ebury Publishing', 'Dorling Kindersley Verlag', 'DK Verlag', 'Ten Speed Press', 'Appetite by Random House', 'Salamandra', 'Penguin Random House'], title: 'Jerusalem',
    subject: ['COOKING / Regional & Ethnic / Mediterranean', 'COOKING / Regional & Ethnic / Middle Eastern', 'Description and travel', 'Middle Eastern Cooking', 'COOKING / Regional & Ethnic / Jewish & Kosher', 'nyt:hardcover-advice=2012-11-04', 'New York Times bestseller', 'Cooking, middle eastern', 'Jerusalem, description and travel', 'Cooking', 'Food habits', 'Hábitos alimenticios'] },
]);
export const OL_STASIO = Object.freeze({ numFound: 4, docs: OL_DOCS.slice(0, 3) });
export const OL_BERBER = Object.freeze({ numFound: 2, docs: OL_DOCS.slice(3, 5) });
export const OL_JERUSALEM = Object.freeze({ numFound: 1, docs: OL_DOCS.slice(5) });

export const SESSION = Object.freeze({ access_token: 'jeton-couverture-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } });
export const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
export const corpsOk = (lecture, extra = {}) => ({ model: 'claude-x', stop_reason: 'end_turn', content: [{ type: 'text', text: typeof lecture === 'string' ? lecture : JSON.stringify(lecture) }], ...extra });

// Une fausse fetch qui AIGUILLE par adresse et HONORE le signal (rejet AbortError). `assistant` (…/functions/v1/assistant) et `ol`
// (openlibrary.org/search.json) : [statut, corps] | (appel) => [statut, corps] (une fonction peut lever : réseau coupé) | null = SUSPENDU, résolu à la main
// par a.rendre.shift()(statut, corps) (resp. a.rendreOl). Une requête suspendue puis ABANDONNÉE (signal) quitte sa file : rendre.shift() ne sert
// jamais un résolveur mort, toujours la requête vivante suivante. Tout le reste — covers.openlibrary.org, api/books — répond 404. Chaque appel est
// journalisé avec son corps JSON lu ; a.vers(morceau) filtre par adresse, a.posts() rend les appels à la passerelle.
export function fauxFetch({ assistant = [200, corpsOk(LECTURE)], ol = [200, { numFound: 0, docs: [] }] } = {}) {
  const a = { appels: [], rendre: [], rendreOl: [], assistant, ol };
  a.fetch = (url, options) => new Promise((resolve, reject) => {
    const u = String(url);
    const appel = { url: u, options, corps: typeof options?.body === 'string' ? JSON.parse(options.body) : null };
    a.appels.push(appel);
    let file = null; // la file où `fin` attend (requête suspendue) ; null tant qu'elle n'y est pas
    const fin = (status, corps) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(status, corps)); };
    const abandon = () => {
      if (file) { const i = file.indexOf(fin); if (i >= 0) file.splice(i, 1); }
      reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
    };
    if (options?.signal?.aborted) { abandon(); return; }
    options?.signal?.addEventListener('abort', abandon, { once: true });
    const servir = (regle, attente) => {
      let d;
      try { d = typeof regle === 'function' ? regle(appel) : regle; } catch (e) { options?.signal?.removeEventListener('abort', abandon); reject(e); return; }
      if (d) fin(d[0], d[1]); else { file = attente; attente.push(fin); }
    };
    if (u.endsWith('/functions/v1/assistant')) servir(a.assistant, a.rendre);
    else if (u.startsWith('https://openlibrary.org/search.json')) servir(a.ol, a.rendreOl);
    else fin(404, '');
  });
  a.vers = (morceau) => a.appels.filter((x) => x.url.includes(morceau));
  a.posts = () => a.vers('/functions/v1/assistant');
  return a;
}

// De VRAIES images (poserCouverture et pagePourEnvoi décodent) : une couleur différente → des octets et une empreinte différents.
export async function imageDe(nom = 'couverture.jpg', couleur = '#a33', l = 300, h = 400) {
  const c = new OffscreenCanvas(l, h);
  const cx = c.getContext('2d');
  cx.fillStyle = couleur; cx.fillRect(0, 0, l, h);
  cx.fillStyle = '#fff'; cx.fillRect(20, 20, Math.round(l / 2), Math.round(h / 3));
  return new File([await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' });
}

// Le contexte d'une route : `sync.user` (null = aucun compte, ou garde refusée), `sync.auth.jeton()` (rend la session, ou la fonction injectée — lente,
// nulle au clic…), `sync.guard` (F-7). Les livres et recettes vides suffisent aux puces.
export function ctxDe(session = SESSION, { jeton = null, guard = null, user } = {}) {
  const u = user !== undefined ? user : (session ? { id: 'u1', email: 'a@exemple.invalid' } : null);
  return { books: [], recipes: [], sync: { user: u, guard, auth: { jeton: jeton ?? (async () => session), signIn: async () => ({ error: null }) } } };
}
