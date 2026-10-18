// Test COMPORTEMENTAL de supabase/functions/assistant/index.ts sous Node (spec 2026-10-18-passerelle-assistant § 5).
// Principe : on retire les types d'index.ts (node:module.stripTypeScriptTypes), on remplace ses deux imports par le vrai
// logique.js et par un faux supabase-js (tools/faux/supabase.mjs), on pose un faux `Deno` et un faux `fetch`, puis on
// appelle le gestionnaire passe a Deno.serve avec de vraies `Request`. Aucun reseau, aucune cle reelle (ANTHROPIC_API_KEY
// de test = valeur FACTICE). Chaque cas affirme aussi le nombre d'appels sortants vers Anthropic.
// INDEX_TS (variable d'environnement) designe un autre index.ts : c'est ainsi que les mutants sont rejoues sur une copie.
import test, { before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as faux from './faux/supabase.mjs';
import { LIMITES } from '../supabase/functions/assistant/logique.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.dirname(ICI);
const INDEX_TS = process.env.INDEX_TS || path.join(RACINE, 'supabase', 'functions', 'assistant', 'index.ts');
const URL_LOGIQUE = pathToFileURL(path.join(RACINE, 'supabase', 'functions', 'assistant', 'logique.js')).href;
const URL_FAUX = pathToFileURL(path.join(ICI, 'faux', 'supabase.mjs')).href;
const URL_FONCTION = 'https://x.supabase.co/functions/v1/assistant';
const ORIGINE = 'https://neegans.github.io';
const MIO = 1024 * 1024;

const ENV_DEFAUT = Object.freeze({
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_PUBLISHABLE_KEYS: '[{"api_key":"sb_publishable_factice"}]',
  SUPABASE_SECRET_KEYS: '[{"api_key":"sb_secret_factice"}]',
  ANTHROPIC_API_KEY: 'sk-factice-serveur',   // valeur FACTICE de test
  ASSISTANT_QUOTA_JOUR: '2',
});
const ENV = {};
const appelsFetch = [];
let reponseFetch;
let handler = null;
let dossier = null;
const fetchOrigine = globalThis.fetch;

// stripTypeScriptTypes est experimentale et le dit sur stderr : on retire CET avertissement-la, le temps de l'appel
// (pas de --no-warnings global : tout autre avertissement reste visible).
function retirerLesTypes(source) {
  const emettre = process.emitWarning;
  process.emitWarning = function (w, ...reste) {
    const msg = typeof w === 'string' ? w : (w && w.message) || '';
    if (/stripTypeScriptTypes/.test(msg)) return undefined;
    return emettre.call(process, w, ...reste);
  };
  try { return stripTypeScriptTypes(source); } finally { process.emitWarning = emettre; }
}

before(async () => {
  const source = retirerLesTypes(readFileSync(INDEX_TS, 'utf8'));
  const code = source
    .replace(/from\s+'@supabase\/supabase-js'/, `from ${JSON.stringify(URL_FAUX)}`)
    .replace(/from\s+'\.\/logique\.js'/, `from ${JSON.stringify(URL_LOGIQUE)}`);
  assert.ok(code.includes(URL_FAUX) && code.includes(URL_LOGIQUE), 'les deux imports ont ete remplaces');
  dossier = mkdtempSync(path.join(tmpdir(), 'assistant-index-'));
  const fichier = path.join(dossier, 'index.mjs');
  writeFileSync(fichier, code);
  globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { handler = h; } };
  globalThis.fetch = async (url, options) => {
    // Comme le vrai fetch : un signal DEJA abandonne ne part jamais sur le reseau (rejet immediat, aucun appel enregistre).
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    appelsFetch.push({ url, options });
    faux.evenements.push('fetch');
    return reponseFetch(url, options);
  };
  await import(pathToFileURL(fichier).href);
  assert.equal(typeof handler, 'function', 'Deno.serve a recu un gestionnaire');
});
after(() => {
  globalThis.fetch = fetchOrigine;
  delete globalThis.Deno;
  if (dossier) rmSync(dossier, { recursive: true, force: true });
});

const jsonReponse = (statut, corps) => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } });
const REPONSE_OK = { id: 'msg', usage: { input_tokens: 1, output_tokens: 2 }, content: [] };
function remise() {
  for (const k of Object.keys(ENV)) delete ENV[k];
  Object.assign(ENV, ENV_DEFAUT);
  faux.registre.length = 0; faux.RPC.length = 0; faux.MAJ.length = 0; faux.evenements.length = 0; appelsFetch.length = 0;
  faux.REPONSES.getUser = async () => ({ data: { user: { id: 'compte-1' } }, error: null });
  faux.REPONSES.rpc = async (nom) => (nom === 'is_allowed' ? { data: true, error: null } : { data: 7, error: null });
  reponseFetch = async () => jsonReponse(200, REPONSE_OK);
}
const corpsCreation = (extra = {}) => JSON.stringify({ outil: 'creation', corps: { messages: [{ role: 'user', content: 'x' }], ...extra } });
function requete(methode = 'POST', { origine = ORIGINE, jeton = 'jeton.valide-1', texte, entetes = {}, body, signal } = {}) {
  const h = { 'content-type': 'application/json', ...entetes };
  if (origine) h.origin = origine;
  if (jeton) h.authorization = 'Bearer ' + jeton;
  const init = { method: methode, headers: h };
  if (signal) init.signal = signal;
  if (body !== undefined) { init.body = body; init.duplex = 'half'; }
  else if (methode !== 'GET' && methode !== 'OPTIONS') init.body = texte ?? corpsCreation();
  return new Request(URL_FONCTION, init);
}
const lire = async (rep) => JSON.parse(await rep.text());
const reserves = () => faux.RPC.filter((a) => a.nom === 'assistant_reserver');

test('a. OPTIONS : 204 + CORS sans jeton pour une origine admise ; origine refusee : 204 sans Allow-Origin ; aucun client, aucun fetch', async () => {
  remise();
  const ok = await handler(requete('OPTIONS', { jeton: null }));
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGINE);
  assert.equal(ok.headers.get('access-control-allow-headers'), 'authorization, apikey, content-type, x-client-info');
  assert.equal(ok.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  const non = await handler(requete('OPTIONS', { origine: 'https://evil.example', jeton: null }));
  assert.equal(non.status, 204);
  assert.equal(non.headers.get('access-control-allow-origin'), null);
  assert.equal(faux.registre.length, 0, 'aucun client Supabase pour un OPTIONS');
  assert.equal(appelsFetch.length, 0);
});

test('b. origine refusee : 403 origine ; methode inconnue : 405 ; aucun fetch ni client', async () => {
  remise();
  const r1 = await handler(requete('POST', { origine: 'https://evil.example' }));
  assert.equal(r1.status, 403); assert.deepEqual(await lire(r1), { erreur: 'origine' });
  assert.equal(r1.headers.get('access-control-allow-origin'), null);
  const r2 = await handler(requete('POST', { origine: null }));
  assert.equal(r2.status, 403, 'sans Origin : refuse');
  const r3 = await handler(requete('PUT'));
  assert.equal(r3.status, 405); assert.deepEqual(await lire(r3), { erreur: 'methode' });
  assert.equal(faux.registre.length, 0); assert.equal(appelsFetch.length, 0);
});

test('c. session : sans jeton 401, jeton mal forme 401 (sans client), jeton refuse 401 ; le client utilisateur recoit la cle PUBLIQUE et le jeton', async () => {
  remise();
  const r1 = await handler(requete('POST', { jeton: null }));
  assert.equal(r1.status, 401); assert.deepEqual(await lire(r1), { erreur: 'non_connecte' });
  const r2 = await handler(requete('POST', { jeton: 'a b;c' }));
  assert.equal(r2.status, 401);
  assert.equal(faux.registre.length, 0, 'un jeton mal forme ne cree aucun client');
  faux.REPONSES.getUser = async () => ({ data: { user: null }, error: {} });
  const r3 = await handler(requete('POST'));
  assert.equal(r3.status, 401); assert.deepEqual(await lire(r3), { erreur: 'non_connecte' });
  assert.equal(faux.registre.length, 1);
  assert.equal(faux.registre[0].key, 'sb_publishable_factice', 'cle publique, jamais la secrete');
  assert.equal(faux.registre[0].opts.global.headers.Authorization, 'Bearer jeton.valide-1');
  assert.equal(faux.RPC.length, 0, 'is_allowed n est pas appele sans session');
  assert.equal(appelsFetch.length, 0);
});

test('d. liste admise : false, erreur, ou erreur avec true -> 403 non_admis ; aucun fetch ni reservation', async () => {
  for (const reponse of [{ data: false, error: null }, { data: null, error: { message: 'x' } }, { data: true, error: { message: 'x' } }, { data: 'true', error: null }]) {
    remise();
    faux.REPONSES.rpc = async () => reponse;
    const r = await handler(requete('POST'));
    assert.equal(r.status, 403, JSON.stringify(reponse));
    assert.deepEqual(await lire(r), { erreur: 'non_admis' });
    assert.equal(appelsFetch.length, 0, JSON.stringify(reponse));
    assert.equal(reserves().length, 0);
  }
});

test('e. GET admis : modele et quota du jour, sans fetch ni reservation ; secrets relus a chaque requete', async () => {
  remise();
  const r = await handler(requete('GET'));
  assert.equal(r.status, 200); assert.deepEqual(await lire(r), { modele: 'claude-sonnet-5-5', quotaJour: 2, cles: 'nouvelles' });
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGINE);
  assert.equal(appelsFetch.length, 0); assert.equal(reserves().length, 0);
  // Fix 4 : un secret change est pris au prochain appel, sans redeploiement.
  ENV.ASSISTANT_QUOTA_JOUR = '5'; ENV.ASSISTANT_MODELE = 'claude-autre-modele';
  assert.deepEqual(await lire(await handler(requete('GET'))), { modele: 'claude-autre-modele', quotaJour: 5, cles: 'nouvelles' });
  for (const mauvais of ['abc', '0', '-3', '', '1.5x']) {
    ENV.ASSISTANT_QUOTA_JOUR = mauvais;
    const q = (await lire(await handler(requete('GET')))).quotaJour;
    assert.equal(q, mauvais === '1.5x' ? 1 : LIMITES.quotaJour, 'quota illisible ou nul : defaut ' + mauvais);
  }
  ENV.ASSISTANT_ORIGINES = 'https://a.example, http://localhost:8083';
  assert.equal((await handler(requete('GET', { origine: 'http://localhost:8083' }))).status, 200);
  assert.equal((await handler(requete('GET', { origine: ORIGINE }))).status, 403, 'ASSISTANT_ORIGINES REMPLACE la valeur par defaut');
});

test('f. borne AVANT lecture : content-length declare trop grand -> 413 sans reservation ; flux de 8 Mio + 1 coupe en route', async () => {
  remise();
  const r1 = await handler(requete('POST', { entetes: { 'content-length': '9000000' } }));
  assert.equal(r1.status, 413); assert.deepEqual(await lire(r1), { erreur: 'trop_lourd' });
  assert.equal(reserves().length, 0, '413 avant la reservation');
  assert.equal(appelsFetch.length, 0);
  // Flux sans content-length : 12 morceaux de 1 Mio ; la lecture s'arrete des que 8 Mio sont depasses et annule le flux.
  let tires = 0; let annule = false;
  const flux = new ReadableStream({
    pull(c) { if (tires >= 12) { c.close(); return; } tires += 1; c.enqueue(new Uint8Array(MIO)); },
    cancel() { annule = true; },
  });
  const r2 = await handler(requete('POST', { body: flux }));
  assert.equal(r2.status, 413); assert.deepEqual(await lire(r2), { erreur: 'trop_lourd' });
  assert.ok(annule, 'le flux est annule');
  assert.ok(tires <= 10, 'lecture coupee apres ' + tires + ' morceaux sur 12');
  assert.equal(reserves().length, 0); assert.equal(appelsFetch.length, 0);
  // Borne par outil (512 Kio hors extraction) : elle reste celle de lireDemande, apres lecture et avant reservation.
  const gros = JSON.stringify({ outil: 'creation', corps: { messages: [{ role: 'user', content: 'x'.repeat(600 * 1024) }] } });
  const r3 = await handler(requete('POST', { texte: gros }));
  assert.equal(r3.status, 413); assert.deepEqual(await lire(r3), { erreur: 'trop_lourd' });
  assert.equal(reserves().length, 0); assert.equal(appelsFetch.length, 0);
});

test('g. appel admis : reservation atomique par la cle secrete, UN fetch Anthropic, modele force, mise a jour de 4 champs, relais tel quel', async () => {
  remise();
  const texte = corpsCreation({ model: 'claude-opus-5-5', temperature: 1 });
  const r = await handler(requete('POST', { texte }));
  assert.equal(r.status, 200);
  assert.deepEqual(await lire(r), REPONSE_OK);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGINE);
  assert.equal(appelsFetch.length, 1);
  const f = appelsFetch[0];
  assert.equal(f.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(f.options.method, 'POST');
  assert.equal(f.options.headers['x-api-key'], 'sk-factice-serveur');
  assert.equal(f.options.headers['anthropic-version'], '2023-06-01');
  assert.equal(f.options.redirect, 'error');
  assert.ok(f.options.signal instanceof AbortSignal, 'delai : un signal d abandon');
  const envoye = JSON.parse(f.options.body);
  assert.equal(envoye.model, 'claude-sonnet-5-5', 'le modele du serveur, jamais celui du client');
  assert.ok(!('temperature' in envoye), 'champ inconnu ecarte');
  assert.deepEqual(envoye.messages, [{ role: 'user', content: 'x' }]);
  // La reservation : un seul appel rpc, par le client a cle SECRETE, avec le quota du serveur.
  assert.equal(reserves().length, 1);
  assert.deepEqual(reserves()[0].args, { p_owner: 'compte-1', p_outil: 'creation', p_octets: Buffer.byteLength(texte), p_quota: 2 });
  assert.equal(reserves()[0].cle, 'sb_secret_factice');
  assert.equal(faux.RPC.find((a) => a.nom === 'is_allowed').cle, 'sb_publishable_factice', 'is_allowed : comme l utilisateur');
  assert.equal(faux.registre[1].opts.global, undefined, 'le client secret ne porte aucun jeton utilisateur');
  // Ordre reel : liste admise, reservation, Anthropic, mise a jour.
  assert.deepEqual(faux.evenements, ['rpc:is_allowed', 'rpc:assistant_reserver', 'fetch', 'update']);
  // La mise a jour ne pose que quatre champs, sur la ligne reservee.
  assert.equal(faux.MAJ.length, 1);
  assert.equal(faux.MAJ[0].table, 'assistant_journal'); assert.equal(faux.MAJ[0].c, 'id'); assert.equal(faux.MAJ[0].id, 7);
  assert.deepEqual(Object.keys(faux.MAJ[0].v).sort(), ['duree_ms', 'jetons_entree', 'jetons_sortie', 'statut']);
  assert.equal(faux.MAJ[0].v.statut, 200); assert.equal(faux.MAJ[0].v.jetons_entree, 1); assert.equal(faux.MAJ[0].v.jetons_sortie, 2);
  assert.ok(Number.isInteger(faux.MAJ[0].v.duree_ms) && faux.MAJ[0].v.duree_ms >= 0);
  // Le modele du serveur suit son secret, sans redeploiement.
  ENV.ASSISTANT_MODELE = 'claude-autre-modele';
  await handler(requete('POST'));
  assert.equal(JSON.parse(appelsFetch[1].options.body).model, 'claude-autre-modele');
});

test('h. reservation : quota atteint (null) -> 429 quota ; erreur ou exception de la reservation -> 502 serveur ; jamais de fetch', async () => {
  remise();
  faux.REPONSES.rpc = async (nom) => (nom === 'is_allowed' ? { data: true, error: null } : { data: null, error: null });
  const r1 = await handler(requete('POST'));
  assert.equal(r1.status, 429); assert.deepEqual(await lire(r1), { erreur: 'quota', quota: 2 });
  faux.REPONSES.rpc = async (nom) => (nom === 'is_allowed' ? { data: true, error: null } : { data: null, error: { message: 'boom' } });
  const r2 = await handler(requete('POST'));
  assert.equal(r2.status, 502); assert.deepEqual(await lire(r2), { erreur: 'serveur' });
  faux.REPONSES.rpc = async (nom) => { if (nom === 'is_allowed') return { data: true, error: null }; throw new Error('reseau'); };
  const r3 = await handler(requete('POST'));
  assert.equal(r3.status, 502); assert.deepEqual(await lire(r3), { erreur: 'serveur' });
  assert.equal(r3.headers.get('access-control-allow-origin'), ORIGINE, 'meme une exception garde le CORS');
  assert.equal(appelsFetch.length, 0); assert.equal(faux.MAJ.length, 0);
});

test('i. statuts d Anthropic : 429 et 400 relayes tels quels ; 500, 401, 404 -> 502 serveur ; 529 -> 503 serveur ; corps de panne JAMAIS relaye', async () => {
  remise();
  const erreur429 = { type: 'error', error: { type: 'rate_limit_error', message: 'x' } };
  reponseFetch = async () => jsonReponse(429, erreur429);
  const r429 = await handler(requete('POST'));
  assert.equal(r429.status, 429); assert.deepEqual(await lire(r429), erreur429);
  assert.equal(faux.MAJ.at(-1).v.statut, 429); assert.equal(faux.MAJ.at(-1).v.jetons_entree, null);
  const erreur400 = { type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens' } };
  reponseFetch = async () => jsonReponse(400, erreur400);
  const r400 = await handler(requete('POST'));
  assert.equal(r400.status, 400); assert.deepEqual(await lire(r400), erreur400);
  for (const [recu, rendu] of [[500, 502], [401, 502], [404, 502], [529, 503]]) {
    reponseFetch = async () => jsonReponse(recu, { error: { message: 'cle sk-factice-serveur invalide' } });
    const r = await handler(requete('POST'));
    const texte = await r.text();
    assert.equal(r.status, rendu, 'Anthropic ' + recu);
    assert.deepEqual(JSON.parse(texte), { erreur: 'serveur' }, 'Anthropic ' + recu);
    assert.ok(!texte.includes('sk-factice-serveur'), 'la panne ne fuit jamais : ' + recu);
    assert.equal(faux.MAJ.at(-1).v.statut, rendu);
  }
  // 200 dont le corps n'est pas du JSON : panne de la passerelle, rien de relaye.
  reponseFetch = async () => new Response('<html>erreur sk-factice-serveur</html>', { status: 200 });
  const rHtml = await handler(requete('POST'));
  assert.equal(rHtml.status, 502); assert.deepEqual(await lire(rHtml), { erreur: 'serveur' });
});

test('j. delai : 120 s exactes -> abandon -> 504 delai, ligne mise a jour en 504', async () => {
  remise();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let signal = null; let appele;
    const fetchAppele = new Promise((res) => { appele = res; });
    reponseFetch = (url, options) => new Promise((_, rejeter) => {
      signal = options.signal;
      options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
      appele();
    });
    const enCours = handler(requete('POST'));
    await fetchAppele;
    assert.equal(LIMITES.attenteMs, 120000);
    mock.timers.tick(LIMITES.attenteMs - 1);
    assert.equal(signal.aborted, false, 'pas encore abandonne a 119,999 s');
    mock.timers.tick(1);
    assert.equal(signal.aborted, true, 'abandonne a 120 s');
    const r = await enCours;
    assert.equal(r.status, 504); assert.deepEqual(await lire(r), { erreur: 'delai' });
    assert.equal(faux.MAJ[0].v.statut, 504);
    assert.equal(r.headers.get('access-control-allow-origin'), ORIGINE);
  } finally { mock.timers.reset(); }
});

test('k. reponse d Anthropic : exactement LIMITES.reponse octets passe, un octet de plus -> 502 serveur ; la borne se lit en octets', async () => {
  remise();
  // Des corps JSON VALIDES : un corps illisible serait refuse de toute facon (502) et masquerait la borne.
  const enveloppe = (texte) => JSON.stringify({ id: 'msg', usage: { input_tokens: 1, output_tokens: 2 }, content: [{ type: 'text', text: texte }] });
  const vide = Buffer.byteLength(enveloppe(''));
  const pile = enveloppe('a'.repeat(LIMITES.reponse - vide));
  assert.equal(Buffer.byteLength(pile), LIMITES.reponse);
  reponseFetch = async () => new Response(pile, { status: 200 });
  const ok = await handler(requete('POST'));
  assert.equal(ok.status, 200, 'pile a la borne : relaye');
  assert.equal((await ok.text()).length, LIMITES.reponse);
  reponseFetch = async () => new Response(enveloppe('a'.repeat(LIMITES.reponse - vide + 1)), { status: 200 });
  const trop = await handler(requete('POST'));
  assert.equal(trop.status, 502); assert.deepEqual(await lire(trop), { erreur: 'serveur' });
  assert.equal(faux.MAJ.at(-1).v.statut, 502);
  // Des caracteres a deux octets : moins de LIMITES.reponse unites UTF-16, plus de LIMITES.reponse octets.
  const deux = enveloppe('\u00e9'.repeat((LIMITES.reponse - vide) / 2 + 1));
  assert.ok(deux.length < LIMITES.reponse && Buffer.byteLength(deux) > LIMITES.reponse);
  reponseFetch = async () => new Response(deux, { status: 200 });
  const r2 = await handler(requete('POST'));
  assert.equal(r2.status, 502, 'borne en octets, pas en unites UTF-16');
  // Un content-length declare trop grand suffit, sans rien lire.
  reponseFetch = async () => new Response(pile, { status: 200, headers: { 'content-length': String(LIMITES.reponse + 1) } });
  assert.equal((await handler(requete('POST'))).status, 502);
});

test('l. exception interne (createClient leve) : 502 serveur AVEC les en-tetes CORS, jamais de fetch', async () => {
  remise();
  delete ENV.SUPABASE_URL;
  const r = await handler(requete('POST'));
  assert.equal(r.status, 502); assert.deepEqual(await lire(r), { erreur: 'serveur' });
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGINE);
  assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(appelsFetch.length, 0);
});

test('m. cles legacy : SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY quand les nouvelles listes sont absentes', async () => {
  remise();
  delete ENV.SUPABASE_PUBLISHABLE_KEYS; delete ENV.SUPABASE_SECRET_KEYS;
  ENV.SUPABASE_ANON_KEY = 'anon-legacy'; ENV.SUPABASE_SERVICE_ROLE_KEY = 'service-legacy';
  const r = await handler(requete('POST'));
  assert.equal(r.status, 200);
  assert.equal(faux.registre[0].key, 'anon-legacy');
  assert.equal(faux.registre[1].key, 'service-legacy');
  assert.equal(reserves()[0].cle, 'service-legacy');
  assert.equal((await lire(await handler(requete('GET')))).cles, 'legacy', 'F-1 : le GET dit que les deux cles viennent du repli legacy');
});

test('n. corps invalide : JSON illisible, outil inconnu, forme -> 400 requete, bornes -> 422 ; reservation et fetch jamais', async () => {
  remise();
  for (const [texte, statut, erreur] of [
    ['pas du json', 400, 'requete'],
    [JSON.stringify({ outil: 'inconnu', corps: { messages: [{ role: 'user', content: 'x' }] } }), 400, 'requete'],
    [JSON.stringify({ outil: 'creation', corps: { messages: 'x' } }), 400, 'requete'],
    [JSON.stringify({ outil: 'creation', corps: { messages: [{ role: 'user', content: 'x' }], max_tokens: LIMITES.maxTokens + 1 } }), 422, 'bornes'],
  ]) {
    const r = await handler(requete('POST', { texte }));
    assert.equal(r.status, statut, texte.slice(0, 40)); assert.deepEqual(await lire(r), { erreur });
  }
  assert.equal(reserves().length, 0); assert.equal(appelsFetch.length, 0);
});

test('o. quota du jour : borne a l int4 (2147483647) ; au-dela, le defaut LIMITES.quotaJour (P-5)', async () => {
  remise();
  const quota = async (valeur) => { ENV.ASSISTANT_QUOTA_JOUR = valeur; return (await lire(await handler(requete('GET')))).quotaJour; };
  assert.equal(await quota('99999999999'), LIMITES.quotaJour, 'au-dela de l int4 : 60, jamais 99999999999');
  assert.equal(LIMITES.quotaJour, 60);
  assert.equal(await quota('2147483648'), 60, 'int4 + 1');
  assert.equal(await quota('2147483647'), 2147483647, 'exactement l int4 : accepte');
  assert.equal(await quota('12'), 12, 'une valeur ordinaire reste prise');
  // Le meme nombre part a la reservation (p_quota est un integer cote SQL) : un hors-borne n y arrive jamais.
  ENV.ASSISTANT_QUOTA_JOUR = '99999999999';
  await handler(requete('POST'));
  assert.equal(reserves()[0].args.p_quota, 60);
});

test('p. content-length declare trop grand : le corps est ANNULE avant le 413, sans rien lire (P-4)', async () => {
  remise();
  // La demande du client : flux avec un content-length de 9 Mo declare ; le flux n est pas consomme, il est annule.
  let tires = 0; let annule = false;
  const flux = new ReadableStream({
    pull(c) { tires += 1; c.enqueue(new Uint8Array(1024)); },
    cancel() { annule = true; },
  });
  const r = await handler(requete('POST', { body: flux, entetes: { 'content-length': '9000000' } }));
  assert.equal(r.status, 413); assert.deepEqual(await lire(r), { erreur: 'trop_lourd' });
  await new Promise((fini) => setImmediate(fini));
  assert.ok(annule, 'le flux de la demande est annule des que le content-length depasse');
  assert.ok(tires <= 1, 'rien n a ete lu au-dela de l amorce du flux : ' + tires);
  assert.equal(reserves().length, 0); assert.equal(appelsFetch.length, 0);
  // La reponse d Anthropic : meme fonction, meme annulation (la connexion est liberee), 502 serveur.
  let annuleReponse = false;
  const fluxReponse = new ReadableStream({
    pull(c) { c.enqueue(new Uint8Array(1024)); },
    cancel() { annuleReponse = true; },
  });
  reponseFetch = async () => new Response(fluxReponse, { status: 200, headers: { 'content-length': String(LIMITES.reponse + 1) } });
  const r2 = await handler(requete('POST'));
  assert.equal(r2.status, 502); assert.deepEqual(await lire(r2), { erreur: 'serveur' });
  await new Promise((fini) => setImmediate(fini));
  assert.ok(annuleReponse, 'le flux de la reponse d Anthropic est annule');
  assert.equal(appelsFetch.length, 1);
});

// --- Vague finale : F-1 (forme des cles injectees), F-10 (GET), F-5 (abandon par le client) ---------------------------------------
// Une variable de cles injectee peut avoir plusieurs formes (liste d'objets { api_key }, liste de chaines, chaine nue, objet) : le
// lecteur est tolerant, mais une cle n'est prise que si elle porte SON prefixe (sb_publishable_ / sb_secret_) — une cle secrete
// posee dans la variable publique n'est jamais prise pour une cle publique. Tout le reste retombe sur la cle legacy.
const FORMES = (p) => [
  // (a) une chaine commencant par le prefixe : nue, ou entre guillemets JSON
  [`${p}brut`, `${p}brut`, 'chaine nue'],
  [JSON.stringify(`${p}json`), `${p}json`, 'chaine JSON'],
  // (b) une liste : chaines, objets { api_key }, ou un objet sans api_key AVANT l'objet qui en a une
  [JSON.stringify([`${p}liste`]), `${p}liste`, 'liste de chaines'],
  [JSON.stringify([{ api_key: `${p}listeobj` }]), `${p}listeobj`, 'liste d objets { api_key }'],
  [JSON.stringify([{ name: 'x' }, 7, null, { api_key: `${p}second` }]), `${p}second`, 'liste : le premier element utilisable'],
  [JSON.stringify([{ api_key: 'autre_prefixe_x' }, { api_key: `${p}apres` }]), `${p}apres`, 'liste : un element au mauvais prefixe est saute'],
  // (c) un objet : .default, une autre valeur, ou { api_key }
  [JSON.stringify({ default: `${p}defaut` }), `${p}defaut`, 'objet { default }'],
  [JSON.stringify({ web: 'pas_une_cle', mobile: `${p}valeur` }), `${p}valeur`, 'objet : une valeur au bon prefixe'],
  [JSON.stringify({ api_key: `${p}objet` }), `${p}objet`, 'objet { api_key }'],
];
const REPLIS = ['', '   ', '[]', '{}', 'pas du json', 'null', '42', 'true', '["autre_prefixe_x"]', '[{"api_key":""}]', '[{"api_key":5}]', '{"default":""}',
  JSON.stringify({ a: { b: { c: { d: { api_key: 'sb_publishable_trop_profond' } } } } })];

test('q. F-1 : cles injectees tolerantes — trois formes pour chaque variable, prefixe exige, repli legacy, champ cles du GET', async () => {
  for (const [variable, prefixe, indice, legacy, nomLegacy] of [
    ['SUPABASE_PUBLISHABLE_KEYS', 'sb_publishable_', 0, 'anon-legacy', 'SUPABASE_ANON_KEY'],
    ['SUPABASE_SECRET_KEYS', 'sb_secret_', 1, 'service-legacy', 'SUPABASE_SERVICE_ROLE_KEY'],
  ]) {
    for (const [brut, attendue, nom] of FORMES(prefixe)) {
      remise();
      ENV[variable] = brut; ENV.SUPABASE_ANON_KEY = 'anon-legacy'; ENV.SUPABASE_SERVICE_ROLE_KEY = 'service-legacy';
      const r = await handler(requete('POST'));
      assert.equal(r.status, 200, `${variable} ${nom}`);
      assert.equal(faux.registre[indice].key, attendue, `${variable} (${nom}) : la cle lue`);
      assert.notEqual(faux.registre[indice].key, legacy, `${variable} (${nom}) : pas le repli`);
    }
    for (const brut of REPLIS) {
      remise();
      ENV[variable] = brut; ENV.SUPABASE_ANON_KEY = 'anon-legacy'; ENV.SUPABASE_SERVICE_ROLE_KEY = 'service-legacy';
      const r = await handler(requete('POST'));
      assert.equal(r.status, 200, `${variable} repli ${JSON.stringify(brut)}`);
      assert.equal(faux.registre[indice].key, legacy, `${variable} = ${JSON.stringify(brut).slice(0, 60)} : repli sur ${nomLegacy}`);
    }
  }
  // Une cle d'un AUTRE prefixe n'est jamais prise : la cle secrete dans la variable publique (et l'inverse) retombe sur le legacy.
  remise();
  ENV.SUPABASE_PUBLISHABLE_KEYS = '[{"api_key":"sb_secret_dans_la_publique"}]'; ENV.SUPABASE_SECRET_KEYS = '[{"api_key":"sb_publishable_dans_la_secrete"}]';
  ENV.SUPABASE_ANON_KEY = 'anon-legacy'; ENV.SUPABASE_SERVICE_ROLE_KEY = 'service-legacy';
  await handler(requete('POST'));
  assert.deepEqual([faux.registre[0].key, faux.registre[1].key], ['anon-legacy', 'service-legacy'], 'les prefixes ne se croisent jamais');
  // Sans aucune cle (ni nouvelle ni legacy) : createClient recoit une chaine vide, jamais undefined (le vrai createClient la refuse : 502, cas l).
  remise();
  delete ENV.SUPABASE_PUBLISHABLE_KEYS; delete ENV.SUPABASE_SECRET_KEYS;
  const sans = await handler(requete('GET'));
  assert.equal(sans.status, 200);
  assert.equal(faux.registre[0].key, '');
});

test('q2. F-1 : le GET dit quelle voie a servi (nouvelles / legacy / mixte), jamais une cle', async () => {
  const cles = async () => { const r = await handler(requete('GET')); assert.equal(r.status, 200); const t = await r.text(); for (const secret of ['sb_publishable', 'sb_secret', 'anon-legacy', 'service-legacy']) assert.ok(!t.includes(secret), 'le GET ne porte aucune cle : ' + secret); return JSON.parse(t).cles; };
  remise();
  assert.equal(await cles(), 'nouvelles', 'les deux cles viennent des nouvelles listes');
  ENV.SUPABASE_ANON_KEY = 'anon-legacy'; ENV.SUPABASE_SERVICE_ROLE_KEY = 'service-legacy';
  assert.equal(await cles(), 'nouvelles', 'les cles legacy presentes mais inutilisees : nouvelles');
  delete ENV.SUPABASE_PUBLISHABLE_KEYS;
  assert.equal(await cles(), 'mixte', 'publique legacy + secrete nouvelle');
  ENV.SUPABASE_PUBLISHABLE_KEYS = '[{"api_key":"sb_publishable_factice"}]'; delete ENV.SUPABASE_SECRET_KEYS;
  assert.equal(await cles(), 'mixte', 'publique nouvelle + secrete legacy');
  delete ENV.SUPABASE_PUBLISHABLE_KEYS;
  assert.equal(await cles(), 'legacy', 'les deux viennent du repli');
  ENV.SUPABASE_PUBLISHABLE_KEYS = 'pas du json'; ENV.SUPABASE_SECRET_KEYS = '[]';
  assert.equal(await cles(), 'legacy', 'des formes illisibles = repli = legacy');
  // Le repere n'existe que sur le GET admis : une 401 ou une 403 ne le porte pas.
  remise();
  const refus = await handler(requete('GET', { jeton: null }));
  assert.ok(!('cles' in await lire(refus)));
});

test('r. F-10 : GET sans jeton -> 401 ; GET d une session valide NON admise -> 403 ; ni fetch ni reservation', async () => {
  remise();
  const r1 = await handler(requete('GET', { jeton: null }));
  assert.equal(r1.status, 401); assert.deepEqual(await lire(r1), { erreur: 'non_connecte' });
  assert.equal(r1.headers.get('access-control-allow-origin'), ORIGINE);
  assert.equal(faux.registre.length, 0, 'sans jeton : aucun client');
  const r2 = await handler(requete('GET', { jeton: 'a b;c' }));
  assert.equal(r2.status, 401, 'jeton mal forme');
  faux.REPONSES.getUser = async () => ({ data: { user: null }, error: { message: 'jwt expired' } });
  const r2b = await handler(requete('GET'));
  assert.equal(r2b.status, 401, 'jeton refuse par getUser'); assert.deepEqual(await lire(r2b), { erreur: 'non_connecte' });
  assert.equal(faux.RPC.length, 0, 'sans session valide, is_allowed n est pas interroge');
  faux.REPONSES.getUser = async () => ({ data: { user: { id: 'compte-1' } }, error: null });
  faux.REPONSES.rpc = async (nom) => (nom === 'is_allowed' ? { data: false, error: null } : { data: 7, error: null });
  const r3 = await handler(requete('GET'));
  assert.equal(r3.status, 403); assert.deepEqual(await lire(r3), { erreur: 'non_admis' });
  assert.ok(!('modele' in await lire(await handler(requete('GET')))), 'un compte non admis ne lit ni le modele ni le quota');
  assert.equal(appelsFetch.length, 0); assert.equal(reserves().length, 0);
  assert.deepEqual(faux.RPC.map((a) => a.nom), ['is_allowed', 'is_allowed'], 'seule la liste admise est interrogee');
});

// F-5 : « Annuler » dans l'app ferme la connexion de la requete ; sans propagation, la passerelle attendrait Anthropic (et le facturerait)
// jusqu'a 120 s pour personne. req.signal abandonne l'appel amont ; la ligne du journal passe a 499 et rien n'est relaye.
test('s. F-5 : abandon par le client (req.signal) -> appel amont abandonne, journal 499, aucun corps relaye', { timeout: 8000 }, async () => {
  remise();
  let signalAmont = null; let appele;
  const fetchAppele = new Promise((res) => { appele = res; });
  reponseFetch = (url, options) => new Promise((_, rejeter) => {
    signalAmont = options.signal;
    options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
    appele();
  });
  const client = new AbortController();
  const enCours = handler(requete('POST', { signal: client.signal }));
  await fetchAppele;
  assert.equal(signalAmont.aborted, false, 'tant que le client est la, l appel amont tient');
  client.abort();
  assert.equal(signalAmont.aborted, true, 'le client part : l appel amont est abandonne');
  const r = await enCours;
  assert.equal(r.status, 499);
  assert.equal(await r.text(), '', 'le client est parti : aucun corps relaye');
  assert.equal(faux.MAJ.length, 1); assert.equal(faux.MAJ[0].v.statut, 499, 'journal 499, pas 504');
  assert.equal(faux.MAJ[0].id, 7);
  assert.equal(appelsFetch.length, 1);
});

test('s2. F-5 : abandon PENDANT la lecture de la reponse d Anthropic -> 499 aussi (pas 502), corps jamais relaye', { timeout: 8000 }, async () => {
  remise();
  let atteinte; const lectureCommencee = new Promise((res) => { atteinte = res; });
  reponseFetch = (url, options) => {
    const flux = new ReadableStream({ start(c) { options.signal.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError'))); }, pull() { atteinte(); } });
    return new Response(flux, { status: 200 });
  };
  const client = new AbortController();
  const enCours = handler(requete('POST', { signal: client.signal }));
  await lectureCommencee;
  client.abort();
  const r = await enCours;
  assert.equal(r.status, 499); assert.equal(await r.text(), '');
  assert.equal(faux.MAJ.at(-1).v.statut, 499);
});

test('s3. F-5 : le client est deja parti avant l appel amont (pendant la reservation) -> Anthropic n est jamais appele, journal 499', { timeout: 8000 }, async () => {
  remise();
  const client = new AbortController();
  faux.REPONSES.rpc = async (nom) => { if (nom === 'assistant_reserver') client.abort(); return nom === 'is_allowed' ? { data: true, error: null } : { data: 7, error: null }; };
  const r = await handler(requete('POST', { signal: client.signal }));
  assert.equal(r.status, 499); assert.equal(await r.text(), '');
  assert.equal(appelsFetch.length, 0, 'aucun appel a Anthropic pour un client parti');
  assert.equal(faux.MAJ.at(-1).v.statut, 499);
});

test('s4. F-5 : sans abandon, rien ne change — 200 relaye, signal propre intact ; le delai de 120 s reste 504 (pas 499)', { timeout: 8000 }, async () => {
  remise();
  const client = new AbortController();
  const ok = await handler(requete('POST', { signal: client.signal }));
  assert.equal(ok.status, 200); assert.deepEqual(await lire(ok), REPONSE_OK);
  assert.equal(faux.MAJ.at(-1).v.statut, 200);
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let appele; const fetchAppele = new Promise((res) => { appele = res; });
    reponseFetch = (url, options) => new Promise((_, rejeter) => { options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError'))); appele(); });
    const enCours = handler(requete('POST', { signal: new AbortController().signal }));
    await fetchAppele;
    mock.timers.tick(LIMITES.attenteMs);
    const r = await enCours;
    assert.equal(r.status, 504, 'le delai du serveur n est pas un abandon du client');
    assert.equal(faux.MAJ.at(-1).v.statut, 504);
  } finally { mock.timers.reset(); }
});
