// Test COMPORTEMENTAL de supabase/functions/assistant/index.ts sous Node (spec 2026-10-18-passerelle-assistant § 5).
// Principe : on retire les types d'index.ts (node:module.stripTypeScriptTypes), on remplace ses trois imports par les vrais
// logique.js et lecture-web.js et par un faux supabase-js (tools/faux/supabase.mjs), on pose un faux `Deno` et un faux `fetch`, puis on
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
import { LIMITES_LECTURE } from '../supabase/functions/assistant/lecture-web.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.dirname(ICI);
// Vague finale du lot B (comme LECTURE_WEB_JS, ronde 1 de la tache 1) : une copie n'est eprouvee que par un chemin ABSOLU HORS du depot (jamais un
// module mute en place), et le chemin eprouve est imprime — une variable restee exportee ne fait jamais eprouver une copie en silence.
const COPIE_INDEX = process.env.INDEX_TS;
if (COPIE_INDEX !== undefined) {
  if (!path.isAbsolute(COPIE_INDEX) || !path.relative(RACINE, COPIE_INDEX).startsWith('..')) throw new Error('INDEX_TS : chemin absolu hors du depot seulement : ' + COPIE_INDEX);
  console.log('# INDEX_TS : module eprouve = ' + COPIE_INDEX);
}
const INDEX_TS = COPIE_INDEX || path.join(RACINE, 'supabase', 'functions', 'assistant', 'index.ts');
const URL_LOGIQUE = pathToFileURL(path.join(RACINE, 'supabase', 'functions', 'assistant', 'logique.js')).href;
const URL_LECTURE = pathToFileURL(path.join(RACINE, 'supabase', 'functions', 'assistant', 'lecture-web.js')).href;
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
    .replace(/from\s+'\.\/logique\.js'/, `from ${JSON.stringify(URL_LOGIQUE)}`)
    .replace(/from\s+'\.\/lecture-web\.js'/, `from ${JSON.stringify(URL_LECTURE)}`);
  assert.ok(code.includes(URL_FAUX) && code.includes(URL_LOGIQUE) && code.includes(URL_LECTURE), 'les trois imports ont ete remplaces');
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

// --- Lot B « Recette web complète » (spec 2026-10-19-recette-web § 6.3, § 7.2) : l'outil lecture-web ----------------------------------------------------
// Le faux fetch distingue la page (https://site.test/…) d'Anthropic ; `appelsFetch` les garde dans l'ordre. La page est une DONNÉE HOSTILE : jamais relayée
// dans une erreur, jamais journalisée (le journal ne porte que des compteurs).
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const corpsLecture = (url) => JSON.stringify({ outil: 'lecture-web', corps: { url } });
const htmlReponse = (html, { statut = 200, type = 'text/html; charset=utf-8', entetes = {} } = {}) => new Response(html, { status: statut, headers: { 'content-type': type, ...entetes } });
const RECETTE_LD = { '@context': 'https://schema.org', '@type': 'Recipe', name: 'Pâtes puttanesca', recipeIngredient: ['250 g de spaghettis', '2 gousses d’ail'], recipeInstructions: [{ '@type': 'HowToStep', text: 'Cuire.' }, { '@type': 'HowToStep', text: 'Servir.' }], totalTime: 'PT30M', author: { name: 'Ricardo' }, publisher: { name: 'Ricardo Cuisine' }, image: ['https://site.test/i/puttanesca.jpg'] };
const PAGE_LD = `<html><head><title>Puttanesca</title><script type="application/ld+json">${JSON.stringify(RECETTE_LD)}</script></head><body><main><p>Texte.</p></main></body></html>`;
const TEXTE_RECETTE = 'Pâtes du garde-manger. Ingrédients : 250 g de spaghettis, 2 gousses d’ail. Étapes : cuire les pâtes, puis servir chaud.';
const PAGE_TEXTE = `<html><head><title>Blogue</title><meta property="og:image" content="https://cdn.test/og.jpg"></head><body><nav>Menu</nav><div>Inscris-toi à l’infolettre</div><main><h1>Pâtes</h1><p>${TEXTE_RECETTE}</p><script>var secret = 'JS-SENTINELLE';</script></main><div>12 commentaires</div></body></html>`;
const appelsPage = () => appelsFetch.filter((a) => a.url !== ANTHROPIC_URL);
const appelsModele = () => appelsFetch.filter((a) => a.url === ANTHROPIC_URL);
const page = (routes) => { reponseFetch = async (url, options) => (url === ANTHROPIC_URL ? (routes.anthropic ?? (async () => jsonReponse(200, REPONSE_OK)))(url, options) : routes.page(url, options)); };
// Une réponse qui ne vient qu'à l'abandon du signal (pour les délais et l'abandon du client).
const sourde = (url, options) => new Promise((_, rejeter) => { options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError'))); });
// Ronde 1 : un corps qui envoie « <main> » puis cale (en-têtes déjà reçus) ; comme le vrai fetch, il est rompu par une AbortError quand le signal de
// la requête tombe. `entame` est appelé dès que la lecture a pris le premier morceau.
const corpsQuiCale = (signal, entame) => new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('<main>')); signal.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError'))); }, pull() { entame(); } });
const vider = () => new Promise((fini) => setImmediate(fini));

test('t1. lecture-web : http:// → 422 interdit AVANT toute reservation, aucun fetch ; t1bis : l hote de SUPABASE_URL → 422 interdit (S-12)', async () => {
  remise();
  const r = await handler(requete('POST', { texte: corpsLecture('http://site.test/') }));
  assert.equal(r.status, 422); assert.deepEqual(await lire(r), { erreur: 'interdit' });
  assert.equal(reserves().length, 0); assert.equal(appelsFetch.length, 0); assert.equal(faux.MAJ.length, 0);
  remise(); ENV.SUPABASE_URL = 'https://projet.test';
  const r2 = await handler(requete('POST', { texte: corpsLecture('https://projet.test/x') }));
  assert.equal(r2.status, 422); assert.deepEqual(await lire(r2), { erreur: 'interdit' });
  assert.equal(reserves().length, 0); assert.equal(appelsFetch.length, 0);
});

test('t2. page avec JSON-LD Recipe : reservation lecture-web, UN fetch (la page) sans identite, AUCUN fetch Anthropic, 200 jsonld, journal 0/0', async () => {
  remise();
  page({ page: async () => htmlReponse(PAGE_LD) });
  const texte = corpsLecture('https://site.test/r/1');
  const r = await handler(requete('POST', { texte }));
  assert.equal(r.status, 200);
  const corps = await lire(r);
  assert.deepEqual(reserves()[0].args, { p_owner: 'compte-1', p_outil: 'lecture-web', p_octets: Buffer.byteLength(texte), p_quota: 2 });
  assert.equal(reserves()[0].cle, 'sb_secret_factice');
  assert.equal(appelsFetch.length, 1, 'un seul fetch : la page'); assert.equal(appelsModele().length, 0, 'aucun appel au modele');
  const f = appelsPage()[0];
  assert.equal(f.url, 'https://site.test/r/1');
  assert.deepEqual([f.options.method, f.options.redirect, f.options.credentials], ['GET', 'manual', 'omit']);
  assert.deepEqual(Object.keys(f.options).sort(), ['credentials', 'headers', 'method', 'redirect', 'signal'], 'lot F, ronde 1 : les options ENTIERES — jamais referrer ni referrerPolicy (fetch en ferait un en-tete Referer)');
  assert.deepEqual(Object.keys(f.options.headers).sort(), ['accept', 'accept-language', 'user-agent'], 'exactement trois en-tetes poses par le code');
  assert.ok(f.options.headers['user-agent'].startsWith('Mitsu/'));
  assert.deepEqual(f.options.headers, { 'user-agent': 'Mitsu/0.10 (+https://neegans.github.io/mistu/)', accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.5' }, 'ronde 1 : les VALEURS des trois en-tetes (spec § 6.3)');
  for (const k of ['authorization', 'apikey', 'cookie', 'x-api-key']) assert.ok(!Object.keys(f.options.headers).some((h) => h.toLowerCase() === k), 'jamais ' + k);
  assert.equal(corps.source_kind, 'jsonld');
  assert.deepEqual(Object.keys(corps).sort(), ['model', 'page', 'recette', 'source_kind', 'stop_reason', 'usage']);
  assert.deepEqual([corps.usage, corps.stop_reason, corps.model], [{ input_tokens: 0, output_tokens: 0 }, null, null]);
  assert.deepEqual({ ...corps.page, lue_le: typeof corps.page.lue_le }, { url_finale: 'https://site.test/r/1', hote: 'site.test', titre_page: 'Puttanesca', auteur: 'Ricardo', site: 'Ricardo Cuisine', lue_le: 'string', autres_recettes: 0, texte_coupe: false, image_url: 'https://site.test/i/puttanesca.jpg' });
  assert.ok(Number.isFinite(Date.parse(corps.page.lue_le)), 'lue_le : ISO');
  assert.deepEqual([corps.recette.title, corps.recette.ingredients.length, corps.recette.steps.length, corps.recette.total_minutes], ['Pâtes puttanesca', 2, 2, 30]);
  assert.deepEqual(faux.MAJ[0].v, { statut: 200, jetons_entree: 0, jetons_sortie: 0, duree_ms: faux.MAJ[0].v.duree_ms });
  assert.deepEqual(faux.evenements, ['rpc:is_allowed', 'rpc:assistant_reserver', 'fetch', 'update']);
});

test('t2bis. B-2 : la seule Recipe n a ni ligne ni etape → elle n est pas trouvee : deux fetch (page, Anthropic), 200 modele, autres_recettes 0', async () => {
  remise();
  const vide = { '@type': 'Recipe', name: 'Sans contenu', image: 'x.jpg' };
  page({ page: async () => htmlReponse(`<script type="application/ld+json">${JSON.stringify(vide)}</script><main><p>${TEXTE_RECETTE}</p></main>`), anthropic: async () => jsonReponse(200, { model: 'claude-sonnet-5-5', stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 2 }, content: [{ type: 'text', text: '{}' }] }) });
  const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/r/2') }));
  const corps = await lire(r);
  assert.deepEqual([r.status, corps.source_kind, corps.page.autres_recettes, appelsPage().length, appelsModele().length], [200, 'modele', 0, 1, 1]);
});

test('t3. page sans JSON-LD : deux fetch (page, puis Anthropic : modele du serveur, CONSIGNE_LECTURE_WEB, 6000, le texte entre delimiteurs, jamais le HTML ni le script) → 200 modele, journal avec jetons', async () => {
  remise();
  const { CONSIGNE_LECTURE_WEB } = await import(URL_LOGIQUE);
  page({ page: async () => htmlReponse(PAGE_TEXTE), anthropic: async () => jsonReponse(200, { model: 'claude-sonnet-5-5', stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 2 }, content: [{ type: 'text', text: 'texte des blocs ' }, { type: 'tool_use', id: 'x' }, { type: 'text', text: 'text concaténé' }] }) });
  const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/r/3') }));
  assert.equal(r.status, 200);
  const corps = await lire(r);
  assert.deepEqual(appelsFetch.map((a) => a.url), ['https://site.test/r/3', ANTHROPIC_URL]);
  const envoye = JSON.parse(appelsModele()[0].options.body);
  assert.deepEqual(Object.keys(envoye).sort(), ['max_tokens', 'messages', 'model', 'system']);
  assert.deepEqual([envoye.model, envoye.system, envoye.max_tokens, envoye.messages.length, envoye.messages[0].role], ['claude-sonnet-5-5', CONSIGNE_LECTURE_WEB, 6000, 1, 'user']);
  const message = envoye.messages[0].content;
  assert.ok(message.includes('<<<PAGE>>>\nPâtes\n' + TEXTE_RECETTE + '\n<<<FIN>>>'), 'le texte de la page, entre les delimiteurs');
  assert.ok(!message.includes('<main>') && !message.includes('JS-SENTINELLE') && !message.includes('Menu'), 'ni le HTML, ni le script, ni la navigation');
  assert.ok(!message.includes('infolettre') && !message.includes('commentaires'), 'ni le reste du body hors de <main>');
  assert.deepEqual({ ...corps, page: undefined }, { source_kind: 'modele', page: undefined, recette: 'texte des blocs text concaténé', usage: { input_tokens: 1, output_tokens: 2 }, stop_reason: 'end_turn', model: 'claude-sonnet-5-5' });
  // Ronde 1 : l'objet page ENTIER, comme t2 — lue_le compris (spec § 3.5 ; la tâche 3 le relit pour source_fetched_at).
  assert.deepEqual({ ...corps.page, lue_le: typeof corps.page.lue_le }, { url_finale: 'https://site.test/r/3', hote: 'site.test', titre_page: 'Blogue', auteur: null, site: null, lue_le: 'string', autres_recettes: 0, texte_coupe: false, image_url: 'https://cdn.test/og.jpg' });
  assert.ok(Number.isFinite(Date.parse(corps.page.lue_le)), 'lue_le : ISO, sur le chemin modele aussi');
  assert.deepEqual([faux.MAJ[0].v.statut, faux.MAJ[0].v.jetons_entree, faux.MAJ[0].v.jetons_sortie], [200, 1, 2]);
  // Ronde 1 : stop_reason et model non textuels → null (chaineOuNul), jamais relayés tels quels.
  remise();
  page({ page: async () => htmlReponse(PAGE_TEXTE), anthropic: async () => jsonReponse(200, { model: {}, stop_reason: 7, usage: { input_tokens: 1, output_tokens: 2 }, content: [{ type: 'text', text: '{}' }] }) });
  const hostile = await lire(await handler(requete('POST', { texte: corpsLecture('https://site.test/r/3') })));
  assert.deepEqual([hostile.source_kind, hostile.stop_reason, hostile.model], ['modele', null, null], 'stop_reason 7 et model {} → null');
});

test('t3bis. B-9 : une page de 50 000 points de code de texte → le message au modele en porte 40 000, page.texte_coupe vrai', async () => {
  remise();
  page({ page: async () => htmlReponse('<main><p>' + 'é'.repeat(50000) + '</p></main>'), anthropic: async () => jsonReponse(200, { model: 'm', stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: '{}' }] }) });
  const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/long') }));
  const corps = await lire(r);
  const message = JSON.parse(appelsModele()[0].options.body).messages[0].content;
  const texte = message.slice(message.indexOf('<<<PAGE>>>\n') + 11, message.lastIndexOf('\n<<<FIN>>>'));
  assert.deepEqual([Array.from(texte).length, corps.page.texte_coupe], [40000, true]);
});

test('t4. redirections : 301 / 302 / 303 / 307 / 308 suivies et revalidees, corps du 3xx annule ; 300 et 304 ni suivis ni lus → 502 ; http, IP, localhost, SUPABASE_URL → 422 interdit (apres reservation) ; sans location ou illisible → 502 ; quatre sauts → 502 ; relative resolue', async () => {
  // Ronde 1 : les cinq statuts de la spec § 6.3, chacun joué (un 303 ou un 308 retiré de la liste deviendrait `inaccessible`).
  for (const s of [301, 302, 303, 307, 308]) {
    remise();
    let annule = false;
    page({ page: async (url) => (url === 'https://site.test/a' ? new Response(new ReadableStream({ cancel() { annule = true; } }), { status: s, headers: { location: 'https://site.test/b' } }) : htmlReponse(PAGE_LD)) });
    const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
    await vider();
    const corps = await lire(r);
    assert.deepEqual([r.status, corps.page.url_finale, appelsPage().map((a) => a.url), annule], [200, 'https://site.test/b', ['https://site.test/a', 'https://site.test/b'], true], 'statut ' + s);
  }
  // Ronde 1 : un 3xx hors de la liste n'est ni une redirection ni une page (hors 2xx → inaccessible), même avec un corps HTML et une location.
  for (const s of [300, 304]) {
    remise();
    page({ page: async () => new Response(s === 304 ? null : PAGE_LD, { status: s, headers: { 'content-type': 'text/html', location: 'https://site.test/b' } }) });
    const x = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
    assert.deepEqual([x.status, await lire(x), appelsPage().length, appelsModele().length], [502, { erreur: 'inaccessible' }, 1, 0], 'statut ' + s);
  }
  for (const cible of ['http://site.test/b', 'https://127.0.0.1/', 'https://localhost/', 'https://projet.test/x']) {
    remise(); ENV.SUPABASE_URL = 'https://projet.test';
    page({ page: async () => new Response(null, { status: 302, headers: { location: cible } }) });
    const x = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
    assert.equal(x.status, 422, cible); assert.deepEqual(await lire(x), { erreur: 'interdit' });
    assert.deepEqual([reserves().length, appelsPage().length, faux.MAJ[0].v.statut], [1, 1, 422], cible + ' : reservation faite, cible jamais demandee, journal 422');
  }
  for (const entetes of [{}, { location: 'https://' }]) {
    remise();
    page({ page: async () => new Response(null, { status: 301, headers: entetes }) });
    const x = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
    assert.equal(x.status, 502, JSON.stringify(entetes)); assert.deepEqual(await lire(x), { erreur: 'inaccessible' });
    assert.deepEqual([appelsPage().length, reserves().length], [1, 1], JSON.stringify(entetes) + ' : refus au premier saut, aucune cible suivie');
  }
  remise();
  let n = 0;
  page({ page: async () => { n += 1; return new Response(null, { status: 301, headers: { location: `https://site.test/s${n}` } }); } });
  const chaine = await handler(requete('POST', { texte: corpsLecture('https://site.test/s0') }));
  assert.deepEqual([chaine.status, await lire(chaine), appelsPage().length], [502, { erreur: 'inaccessible' }, 4], 'quatre 301 en chaine : trois suivis, le quatrieme refuse');
  remise();
  page({ page: async (url) => (url === 'https://site.test/x/a' ? new Response(null, { status: 307, headers: { location: '/c' } }) : htmlReponse(PAGE_LD)) });
  const rel = await handler(requete('POST', { texte: corpsLecture('https://site.test/x/a') }));
  assert.deepEqual([rel.status, appelsPage().map((a) => a.url)], [200, ['https://site.test/x/a', 'https://site.test/c']], 'location relative resolue contre l adresse courante');
});

test('t4bis. R-B-23 : l alias <ref>.functions.supabase.co derive de SUPABASE_URL est refuse — tape : 422 avant reservation ; cible de redirection : 422 apres reservation, jamais demandee, journal 422 ; <ref>.functions.supabase.co.evil.test reste admis par la regle de l hote', async () => {
  const ALIAS = 'https://abc123.functions.supabase.co/x';
  // (a) l'alias tapé, et ses variantes (casse, point final, sous-domaine) : refusés par lireDemande, avant la réservation (rien ne coûte).
  for (const u of [ALIAS, 'https://ABC123.Functions.Supabase.CO/x', 'https://abc123.functions.supabase.co./x', 'https://x.abc123.functions.supabase.co/x']) {
    remise(); ENV.SUPABASE_URL = 'https://abc123.supabase.co';
    const r = await handler(requete('POST', { texte: corpsLecture(u) }));
    assert.deepEqual([r.status, await lire(r), reserves().length, appelsFetch.length, faux.MAJ.length], [422, { erreur: 'interdit' }, 0, 0, 0], 'tape : ' + u);
  }
  // (b) l'alias en cible d'une redirection : la page est demandée, la cible JAMAIS (son corps n'est jamais téléchargé), 422 interdit, journal 422.
  remise(); ENV.SUPABASE_URL = 'https://abc123.supabase.co';
  let demandee = false;
  page({ page: async (url) => { if (url !== 'https://site.test/a') { demandee = true; return htmlReponse(PAGE_LD); } return new Response(null, { status: 302, headers: { location: ALIAS } }); } });
  const b = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
  assert.deepEqual([b.status, await lire(b), reserves().length, appelsPage().map((a) => a.url), demandee, appelsModele().length, faux.MAJ[0].v.statut], [422, { erreur: 'interdit' }, 1, ['https://site.test/a'], false, 0, 422], 'redirection vers l alias');
  // (c) l'hôte du projet lui-même reste refusé (S-12, inchangé).
  remise(); ENV.SUPABASE_URL = 'https://abc123.supabase.co';
  const c = await handler(requete('POST', { texte: corpsLecture('https://abc123.supabase.co/rest/v1/') }));
  assert.deepEqual([c.status, await lire(c), reserves().length, appelsFetch.length], [422, { erreur: 'interdit' }, 0, 0], 'hote de SUPABASE_URL');
  // (d) admis par la règle de l'hôte, et lus (aucune autre règle ne les refuse : https, nom public à points, ni IP ni suffixe interne) :
  // l'alias suivi d'un autre domaine (ce n'est ni l'alias ni un de ses sous-domaines), l'alias d'un AUTRE projet, et un nom voisin.
  for (const u of ['https://abc123.functions.supabase.co.evil.test/', 'https://autre.functions.supabase.co/x', 'https://abc1234.functions.supabase.co/x']) {
    remise(); ENV.SUPABASE_URL = 'https://abc123.supabase.co';
    page({ page: async () => htmlReponse(PAGE_LD) });
    const d = await handler(requete('POST', { texte: corpsLecture(u) }));
    const corps = await lire(d);
    assert.deepEqual([d.status, corps.source_kind, reserves().length, appelsPage().map((a) => a.url)], [200, 'jsonld', 1, [u]], 'admis : ' + u);
  }
  // (e) aucun alias n'est dérivé d'un SUPABASE_URL qui n'a pas la forme <ref>.supabase.co (domaine propre) : seul l'hôte lui-même est refusé.
  remise(); ENV.SUPABASE_URL = 'https://projet.test';
  page({ page: async () => htmlReponse(PAGE_LD) });
  const e = await handler(requete('POST', { texte: corpsLecture('https://projet.functions.supabase.co/x') }));
  assert.deepEqual([e.status, reserves().length], [200, 1], 'SUPABASE_URL hors supabase.co : aucun alias derive');
});

test('t5. statuts et delais : 404 / 500 / 403 / DNS → 502 inaccessible, corps annule, aucune minuterie laissee ; 15 s d un saut → 502 ; 30 s en tout → 502, pendant les en-tetes ET pendant la lecture du corps ; corps rompu → 502 ; un abandon deja porte par ctl est relance → 504 delai', async () => {
  // Ronde 1 : le corps d'un non-2xx est annulé (spec § 6.3), et une réponse rendue ne laisse aucune minuterie en vol (saut 15 s, total 30 s,
  // budget 120 s : retirées en `finally`) — vraies minuteries, comptées par une enveloppe le temps des trois appels.
  const st = globalThis.setTimeout; const ct = globalThis.clearTimeout; const enVol = new Map();
  globalThis.setTimeout = (f, ms, ...a) => { const h = st(f, ms, ...a); enVol.set(h, ms); return h; };
  globalThis.clearTimeout = (h) => { enVol.delete(h); return ct(h); };
  try {
    for (const s of [404, 500, 403]) {
      remise();
      let annule = false;
      page({ page: async () => new Response(new ReadableStream({ cancel() { annule = true; } }), { status: s, headers: { 'content-type': 'text/html' } }) });
      const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
      await vider();
      assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut, annule], [502, { erreur: 'inaccessible' }, 502, true], 'statut ' + s);
      assert.deepEqual([...enVol.values()], [], 'statut ' + s + ' : aucune minuterie laissee en vol');
    }
  } finally { globalThis.setTimeout = st; globalThis.clearTimeout = ct; }
  remise();
  page({ page: async () => htmlReponse(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('<main>')); }, pull(c) { c.error(new TypeError('connexion rompue')); } })) });
  const rompu = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
  assert.deepEqual([rompu.status, await lire(rompu), faux.MAJ[0].v.statut], [502, { erreur: 'inaccessible' }, 502], 'corps rompu en route : inaccessible, jamais serveur');
  remise(); page({ page: async () => { throw new TypeError('getaddrinfo ENOTFOUND'); } });
  assert.equal((await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }))).status, 502, 'DNS');
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    let signalPage = null; let appele; const parti = new Promise((res) => { appele = res; });
    page({ page: (url, options) => { signalPage = options.signal; appele(); return sourde(url, options); } });
    const enCours = handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
    await parti;
    mock.timers.tick(LIMITES_LECTURE.delaiSautMs - 1);
    assert.equal(signalPage.aborted, false, 'pas encore a 14,999 s');
    mock.timers.tick(1);
    assert.equal(signalPage.aborted, true, 'abandonne a 15 s');
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [502, { erreur: 'inaccessible' }, 502]);
  } finally { mock.timers.reset(); }
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    const signaux = []; let prochain; const attendreAppel = () => new Promise((res) => { prochain = res; });
    let appel = attendreAppel();
    page({ page: (url, options) => { signaux.push(options.signal); prochain(); return new Promise((resoudre, rejeter) => {
      options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
      setTimeout(() => resoudre(new Response(null, { status: 301, headers: { location: `https://site.test/n${signaux.length}` } })), 12000);
    }); } });
    const enCours = handler(requete('POST', { texte: corpsLecture('https://site.test/n0') }));
    await appel; appel = attendreAppel(); mock.timers.tick(12000); await appel;
    appel = attendreAppel(); mock.timers.tick(12000); await appel;
    mock.timers.tick(5999);
    assert.equal(signaux[2].aborted, false, 'troisieme saut : pas encore abandonne a 29,999 s');
    mock.timers.tick(1);
    assert.equal(signaux[2].aborted, true, 'D-B26 : abandonne a 30 s en tout');
    // Ronde 1 : les sauts finis ne sont plus touchés — leur minuterie de 15 s et leurs écouteurs sont retirés en `finally`.
    assert.deepEqual([signaux[0].aborted, signaux[1].aborted], [false, false], 'sauts finis : ni minuterie ni ecouteur laisses');
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), signaux.length], [502, { erreur: 'inaccessible' }, 3]);
  } finally { mock.timers.reset(); }
  // Ronde 1 (D-B26) : les bornes de temps valent aussi PENDANT LA LECTURE DU CORPS — une page qui envoie ses en-têtes tout de suite puis distille
  // son corps est coupée à 15 s du saut, et à 30 s en tout après deux sauts de 12 s.
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    let signalPage = null; let entame; const corpsEntame = new Promise((res) => { entame = res; });
    page({ page: async (url, options) => { signalPage = options.signal; return htmlReponse(corpsQuiCale(options.signal, entame)); } });
    const enCours = handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
    await corpsEntame;
    mock.timers.tick(LIMITES_LECTURE.delaiSautMs - 1);
    assert.equal(signalPage.aborted, false, 'corps qui cale : pas encore a 14,999 s');
    mock.timers.tick(1);
    assert.equal(signalPage.aborted, true, 'corps qui cale : abandonne a 15 s du saut, pendant la lecture');
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [502, { erreur: 'inaccessible' }, 502], 'corps qui cale : 502 inaccessible');
  } finally { mock.timers.reset(); }
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    const signaux = []; let prochain; const attendre = () => new Promise((res) => { prochain = res; });
    let etape = attendre();
    page({ page: (url, options) => {
      signaux.push(options.signal);
      if (signaux.length === 3) return Promise.resolve(htmlReponse(corpsQuiCale(options.signal, prochain)));
      prochain();
      return new Promise((resoudre, rejeter) => {
        options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
        setTimeout(() => resoudre(new Response(null, { status: 301, headers: { location: `https://site.test/m${signaux.length}` } })), 12000);
      });
    } });
    const enCours = handler(requete('POST', { texte: corpsLecture('https://site.test/m0') }));
    await etape; etape = attendre(); mock.timers.tick(12000); await etape;
    etape = attendre(); mock.timers.tick(12000); await etape; // le troisième saut répond tout de suite ; son corps est entamé, puis cale
    mock.timers.tick(5999);
    assert.equal(signaux[2].aborted, false, 'corps du troisieme saut : pas encore abandonne a 29,999 s');
    mock.timers.tick(1);
    assert.equal(signaux[2].aborted, true, 'D-B26 : corps abandonne a 30 s en tout');
    assert.deepEqual([signaux[0].aborted, signaux[1].aborted], [false, false]);
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), signaux.length], [502, { erreur: 'inaccessible' }, 3]);
  } finally { mock.timers.reset(); }
  // Ronde 1 : le budget de ctl tombé PENDANT la lecture du corps est relancé lui aussi (second `catch` de telechargerPage) → 504, jamais inaccessible.
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    let entame; const corpsEntame = new Promise((res) => { entame = res; });
    page({ page: async (url, options) => htmlReponse(corpsQuiCale(options.signal, entame)) });
    const enCours = handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
    await corpsEntame;
    mock.timers.tick(LIMITES.attenteMs);
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [504, { erreur: 'delai' }, 504], 'pendant la lecture du corps : un abandon par ctl est 504');
  } finally { mock.timers.reset(); }
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    let appele; const parti = new Promise((res) => { appele = res; });
    page({ page: (url, options) => { appele(); return sourde(url, options); } });
    const enCours = handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
    await parti;
    // Le saut (15 s), le total (30 s) et le budget (120 s) tombent dans le même tour : l'abandon que ctl porte déjà est RELANCÉ par le catch, jamais
    // classé inaccessible. (En vrai, ctl ne tombe jamais PENDANT le téléchargement, coupé à 30 s au plus : ce cas prouve le relancement, rien de plus.)
    mock.timers.tick(LIMITES.attenteMs);
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [504, { erreur: 'delai' }, 504], 'D-B26 : un abandon par ctl est 504, jamais inaccessible');
  } finally { mock.timers.reset(); }
});

test('t6. content-type pdf → 422 pas_une_page, corps annule, aucun fetch Anthropic ; charset iso-8859-1 decode', async () => {
  remise();
  let annule = false;
  page({ page: async () => new Response(new ReadableStream({ cancel() { annule = true; } }), { status: 200, headers: { 'content-type': 'application/pdf' } }) });
  const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/doc.pdf') }));
  await vider();
  assert.deepEqual([r.status, await lire(r), annule, appelsModele().length, faux.MAJ[0].v.statut], [422, { erreur: 'pas_une_page' }, true, 0, 422]);
  remise();
  const LD_ASCII = { '@type': 'Recipe', name: 'Creme', recipeIngredient: ['1 l de creme'], recipeInstructions: 'Cuire.' }; // tout en ASCII : seul le titre porte des octets latin-1
  const latin1 = Uint8Array.from(`<title>Cr\u{00E8}me br\u{00FB}l\u{00E9}e</title><script type="application/ld+json">${JSON.stringify(LD_ASCII)}</script>`, (c) => c.charCodeAt(0));
  assert.equal(latin1[9], 0xe8, 'le è est bien l octet 0xE8');
  page({ page: async () => new Response(latin1, { status: 200, headers: { 'content-type': 'text/html; charset=iso-8859-1' } }) });
  const r2 = await handler(requete('POST', { texte: corpsLecture('https://site.test/latin') }));
  assert.equal((await lire(r2)).page.titre_page, 'Crème brûlée');
});

test('t7. page de 2 Mio + 1 : content-length declare, puis flux sans content-length → 413 trop_lourde, flux annule, lecture coupee', async () => {
  remise();
  page({ page: async () => htmlReponse('x', { entetes: { 'content-length': String(LIMITES_LECTURE.page + 1) } }) });
  const r1 = await handler(requete('POST', { texte: corpsLecture('https://site.test/gros') }));
  assert.deepEqual([r1.status, await lire(r1), faux.MAJ[0].v.statut], [413, { erreur: 'trop_lourde' }, 413]);
  remise();
  let tires = 0; let annule = false;
  page({ page: async () => new Response(new ReadableStream({ pull(c) { if (tires >= 8) { c.close(); return; } tires += 1; c.enqueue(new Uint8Array(MIO)); }, cancel() { annule = true; } }), { status: 200, headers: { 'content-type': 'text/html' } }) });
  const r2 = await handler(requete('POST', { texte: corpsLecture('https://site.test/gros') }));
  await vider();
  assert.deepEqual([r2.status, await lire(r2), annule, tires <= 5], [413, { erreur: 'trop_lourde' }, true, true], 'coupee apres ' + tires + ' morceaux de 1 Mio sur 8');
});

test('t8. page sans texte utile → 422 vide, aucun fetch Anthropic, journal 422 ; borne texteMin en POINTS DE CODE : 39 → vide, 40 → modele, 20 emojis (40 unites UTF-16) → vide', async () => {
  remise();
  page({ page: async () => htmlReponse('<html><body><nav>Accueil · Recettes · Contact</nav></body></html>') });
  const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/vide') }));
  assert.deepEqual([r.status, await lire(r), appelsModele().length, faux.MAJ[0].v.statut, faux.MAJ[0].v.jetons_entree], [422, { erreur: 'vide' }, 0, 422, null]);
  // Ronde 1 : la borne exacte (spec § 6.3 : moins de 40 points de code → vide) et son unité.
  assert.equal(LIMITES_LECTURE.texteMin, 40);
  const tomate = String.fromCodePoint(0x1F345);
  for (const [texte, statut, modele] of [['a'.repeat(39), 422, 0], ['a'.repeat(40), 200, 1], [tomate.repeat(20), 422, 0]]) {
    remise(); page({ page: async () => htmlReponse(`<main><p>${texte}</p></main>`) });
    const x = await handler(requete('POST', { texte: corpsLecture('https://site.test/borne') }));
    assert.deepEqual([x.status, appelsModele().length], [statut, modele], Array.from(texte).length + ' points de code, ' + texte.length + ' unites UTF-16');
  }
});

test('t9. abandon du client pendant le telechargement → fetch de la page abandonne, 499 sans corps, journal 499 ; pendant l appel au modele → 499 ; deja parti pendant la reservation → aucune page demandee', { timeout: 8000 }, async () => {
  // Ronde 1 (s3 rejoué sur lecture-web) : un client parti pendant la réservation ne fait demander AUCUNE page (un écouteur posé sur un signal déjà
  // levé ne se déclenche jamais : c'est la pré-vérification de chaque saut qui le dit).
  remise();
  const parti0 = new AbortController();
  faux.REPONSES.rpc = async (nom) => { if (nom === 'assistant_reserver') parti0.abort(); return nom === 'is_allowed' ? { data: true, error: null } : { data: 7, error: null }; };
  page({ page: async () => htmlReponse(PAGE_LD) });
  const r0 = await handler(requete('POST', { texte: corpsLecture('https://site.test/a'), signal: parti0.signal }));
  assert.deepEqual([r0.status, await r0.text(), appelsPage().length, appelsModele().length, faux.MAJ.at(-1).v.statut], [499, '', 0, 0, 499]);
  remise();
  // Ronde 1 : un premier saut (301) fini AVANT l'abandon ; son écouteur sur le signal du client a été retiré : seul le saut en cours tombe.
  const signaux = []; let appele; const parti = new Promise((res) => { appele = res; });
  page({ page: (url, options) => { signaux.push(options.signal); if (url === 'https://site.test/a') return Promise.resolve(new Response(null, { status: 301, headers: { location: 'https://site.test/b' } })); appele(); return sourde(url, options); } });
  const client = new AbortController();
  const enCours = handler(requete('POST', { texte: corpsLecture('https://site.test/a'), signal: client.signal }));
  await parti;
  client.abort();
  const r = await enCours;
  assert.deepEqual([signaux.map((s) => s.aborted), r.status, await r.text(), faux.MAJ[0].v.statut, appelsModele().length], [[false, true], 499, '', 499, 0]);
  remise();
  let appeleModele; const modeleParti = new Promise((res) => { appeleModele = res; });
  page({ page: async () => htmlReponse(PAGE_TEXTE), anthropic: (url, options) => { appeleModele(); return sourde(url, options); } });
  const client2 = new AbortController();
  const enCours2 = handler(requete('POST', { texte: corpsLecture('https://site.test/b'), signal: client2.signal }));
  await modeleParti;
  client2.abort();
  const r2 = await enCours2;
  assert.deepEqual([r2.status, await r2.text(), faux.MAJ[0].v.statut], [499, '', 499]);
});

test('t10. jamais le corps de la page dans une reponse d erreur ni dans le journal', async () => {
  remise();
  page({ page: async () => htmlReponse('<p>PAGE-SENTINELLE</p>', { statut: 500 }) });
  const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
  const texte = await r.text();
  assert.equal(r.status, 502);
  assert.ok(!texte.includes('PAGE-SENTINELLE'), 'reponse');
  assert.ok(!JSON.stringify(faux.MAJ).includes('PAGE-SENTINELLE') && !JSON.stringify(faux.RPC).includes('PAGE-SENTINELLE'), 'journal et reservation');
});

test('t11. bornes relayees : titre_page 300, notes ≤ 2 000, 100 recipeIngredient → 81', async () => {
  remise();
  const ld = { '@type': 'Recipe', name: 'B', description: 'mot '.repeat(1500), recipeIngredient: Array.from({ length: 100 }, (_, i) => 'ligne ' + i), recipeInstructions: 'Faire.' };
  page({ page: async () => htmlReponse(`<title>${'t'.repeat(1000)}</title><script type="application/ld+json">${JSON.stringify(ld)}</script>`) });
  const corps = await lire(await handler(requete('POST', { texte: corpsLecture('https://site.test/b') })));
  assert.deepEqual([corps.page.titre_page.length, Array.from(corps.recette.notes).length <= 2000, corps.recette.ingredients.length], [300, true, 81]);
});

test('t12. Anthropic pendant une lecture : 429 et 400 relayes tels quels ; 500 → 502 serveur sans corps ; journal au statut rendu', async () => {
  for (const [recu, rendu, corpsAttendu] of [[429, 429, { type: 'error', error: { type: 'rate_limit_error', message: 'x' } }], [400, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'x' } }], [500, 502, { erreur: 'serveur' }]]) {
    remise();
    page({ page: async () => htmlReponse(PAGE_TEXTE), anthropic: async () => jsonReponse(recu, recu === 500 ? { error: { message: 'panne sk-factice-serveur' } } : corpsAttendu) });
    const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
    const texte = await r.text();
    assert.deepEqual([r.status, JSON.parse(texte), faux.MAJ[0].v.statut], [rendu, corpsAttendu, rendu], 'Anthropic ' + recu);
    assert.ok(!texte.includes('sk-factice-serveur'));
  }
});

test('t13. vague finale (SSRF, defense en profondeur) : une reponse SUIVIE malgre redirect manual (r.redirected) → 422 interdit, corps annule, jamais lu, aucun appel au modele, journal 422', async () => {
  remise();
  let annule = false; let lu = false;
  page({ page: async () => {
    const r = new Response(new ReadableStream({ pull(c) { lu = true; c.enqueue(new TextEncoder().encode(PAGE_LD)); c.close(); }, cancel() { annule = true; } }, { highWaterMark: 0 }), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }); // highWaterMark 0 : pull seulement sur une lecture
    Object.defineProperty(r, 'redirected', { value: true }); // un runtime qui aurait suivi la redirection (vers une adresse jamais revalidee)
    return r;
  } });
  const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/a') }));
  await vider();
  assert.deepEqual([r.status, await lire(r), annule, appelsPage().length, appelsModele().length, faux.MAJ[0].v.statut], [422, { erreur: 'interdit' }, true, 1, 0, 422]);
  assert.equal(lu, false, 'le corps d une reponse suivie n est jamais lu');
});

// --- Lot F « Les plats en images » (spec § 6.3, § 7.2) : l'outil image-web ------------------------------------------------------------------------
// La boucle de redirections est PARTAGÉE avec lecture-web (suivreRedirections) : les minuteries d'un saut et du téléchargement entier courent
// pendant TOUTE la lecture du corps (D-B26, R-F-6). Le modèle n'est jamais appelé pour image-web.
const corpsImage = (url) => JSON.stringify({ outil: 'image-web', corps: { url } });
const JPEG = (n) => { const u = new Uint8Array(n); u.set([0xff, 0xd8, 0xff, 0xe0].slice(0, n)); for (let i = 4; i < n; i += 1) u[i] = i % 251; return u; };
const PNG = (n) => { const u = new Uint8Array(n); u.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return u; };
const WEBP = (n, quatre = 'WEBP') => { const u = new Uint8Array(n); u.set([...'RIFF'].map((c) => c.charCodeAt(0))); u.set([...quatre].map((c) => c.charCodeAt(0)), 8); return u; };
const imageReponse = (octets, { statut = 200, type = 'image/jpeg', entetes = {} } = {}) => new Response(octets, { status: statut, headers: { 'content-type': type, ...entetes } });
const OUTILS_TELECHARGES = [['image-web', corpsImage, 'image/jpeg', 0xff], ['lecture-web', corpsLecture, 'text/html; charset=utf-8', 0x3c]];
// Un corps qui GOUTTE : un octet par seconde (minuteries simulées), jamais fermé ; l'abandon du signal du saut le fait échouer (comme undici).
function goutte(options, octet) {
  const etat = { annule: false };
  const corps = new ReadableStream({
    start(c) {
      const un = () => { if (options.signal.aborted) return; c.enqueue(Uint8Array.of(octet)); setTimeout(un, 1000); };
      options.signal.addEventListener('abort', () => { etat.annule = true; try { c.error(new DOMException('Aborted', 'AbortError')); } catch { /* deja en erreur */ } }, { once: true });
      setTimeout(un, 1000);
    },
    cancel() { etat.annule = true; },
  });
  return { corps, etat };
}

test('u1. image-web : http:// → 422 interdit AVANT toute reservation, aucun fetch ; u1bis : l hote de SUPABASE_URL → 422 (S-12)', async () => {
  remise();
  const r = await handler(requete('POST', { texte: corpsImage('http://site.test/i.jpg') }));
  assert.deepEqual([r.status, await lire(r), reserves().length, appelsFetch.length, faux.MAJ.length], [422, { erreur: 'interdit' }, 0, 0, 0]);
  remise(); ENV.SUPABASE_URL = 'https://projet.test';
  const r2 = await handler(requete('POST', { texte: corpsImage('https://projet.test/i.jpg') }));
  assert.deepEqual([r2.status, await lire(r2), reserves().length, appelsFetch.length], [422, { erreur: 'interdit' }, 0, 0]);
});

test('u2. une JPEG : reservation image-web par la cle secrete, UN fetch (trois en-tetes EXACTEMENT), AUCUN fetch du fournisseur, 200 base64, journal jetons null', async () => {
  remise();
  const octets = JPEG(1000);
  page({ page: async () => imageReponse(octets) });
  const texte = corpsImage('https://site.test/i.jpg');
  const r = await handler(requete('POST', { texte }));
  assert.equal(r.status, 200);
  const corps = await lire(r);
  assert.deepEqual(reserves()[0].args, { p_owner: 'compte-1', p_outil: 'image-web', p_octets: Buffer.byteLength(texte), p_quota: 2 });
  assert.equal(reserves()[0].cle, 'sb_secret_factice');
  assert.deepEqual([appelsFetch.length, appelsModele().length], [1, 0], 'un seul fetch : l image ; aucun appel au modele');
  const f = appelsPage()[0];
  assert.deepEqual([f.url, f.options.method, f.options.redirect, f.options.credentials], ['https://site.test/i.jpg', 'GET', 'manual', 'omit']);
  assert.deepEqual(Object.keys(f.options).sort(), ['credentials', 'headers', 'method', 'redirect', 'signal'], 'ronde 1 : les options ENTIERES — jamais referrer ni referrerPolicy (fetch en ferait un en-tete Referer, spec § 6.3)');
  assert.deepEqual(Object.keys(f.options.headers).sort(), ['accept', 'accept-language', 'user-agent'], 'exactement trois en-tetes : jamais referer, origin, cookie, authorization, apikey');
  assert.ok(f.options.headers['user-agent'].startsWith('Mitsu/') && f.options.headers.accept.startsWith('image/jpeg'));
  assert.deepEqual(Object.keys(corps).sort(), ['octets', 'taille', 'type', 'url_finale']);
  assert.deepEqual([corps.type, corps.taille, corps.url_finale], ['image/jpeg', 1000, 'https://site.test/i.jpg']);
  assert.ok(Buffer.from(corps.octets, 'base64').equals(Buffer.from(octets)), 'les octets relus du base64');
  assert.deepEqual(faux.MAJ[0].v, { statut: 200, jetons_entree: null, jetons_sortie: null, duree_ms: faux.MAJ[0].v.duree_ms });
  assert.deepEqual(faux.evenements, ['rpc:is_allowed', 'rpc:assistant_reserver', 'fetch', 'update']);
});

test('u3. redirections : suivies et revalidees, corps du 3xx annule ; http, localhost, IP, SUPABASE_URL → 422 apres reservation ; quatre 301 → 502 ; sans location → 502 ; relative resolue', async () => {
  remise();
  let annule = false;
  page({ page: async (url) => (url === 'https://site.test/i.jpg' ? new Response(new ReadableStream({ cancel() { annule = true; } }), { status: 301, headers: { location: 'https://cdn.test/i.jpg' } }) : imageReponse(JPEG(50))) });
  const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
  await vider();
  assert.deepEqual([r.status, (await lire(r)).url_finale, appelsPage().map((a) => a.url), annule], [200, 'https://cdn.test/i.jpg', ['https://site.test/i.jpg', 'https://cdn.test/i.jpg'], true]);
  for (const cible of ['http://cdn.test/i.jpg', 'https://localhost/i.jpg', 'https://127.0.0.1/i.jpg', 'https://projet.test/i.jpg']) {
    remise(); ENV.SUPABASE_URL = 'https://projet.test';
    page({ page: async () => new Response(null, { status: 302, headers: { location: cible } }) });
    const x = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    assert.deepEqual([x.status, await lire(x), reserves().length, appelsPage().length, faux.MAJ[0].v.statut], [422, { erreur: 'interdit' }, 1, 1, 422], cible + ' : reservation faite, cible jamais demandee');
  }
  remise(); let n = 0;
  page({ page: async () => { n += 1; return new Response(null, { status: 301, headers: { location: `https://site.test/s${n}.jpg` } }); } });
  const chaine = await handler(requete('POST', { texte: corpsImage('https://site.test/s0.jpg') }));
  assert.deepEqual([chaine.status, await lire(chaine), appelsPage().length], [502, { erreur: 'inaccessible' }, 4], 'quatre 301 : trois suivis, le quatrieme refuse');
  remise(); page({ page: async () => new Response(null, { status: 301 }) });
  const sans = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
  assert.deepEqual([sans.status, await lire(sans)], [502, { erreur: 'inaccessible' }], '3xx sans location');
  remise();
  page({ page: async (url) => (url === 'https://site.test/x/a.jpg' ? new Response(null, { status: 307, headers: { location: '/c.jpg' } }) : imageReponse(JPEG(20))) });
  const rel = await handler(requete('POST', { texte: corpsImage('https://site.test/x/a.jpg') }));
  assert.deepEqual([rel.status, appelsPage().map((a) => a.url)], [200, ['https://site.test/x/a.jpg', 'https://site.test/c.jpg']], 'location relative resolue');
});

test('u4. type et signature : text/html, svg, gif, PNG de 0 octet → 422 pas_une_image (corps annule) ; u4bis : HTML ou PNG annonces jpeg → 422 sans rien relayer ; RIFF…WEBP → 200 ; RIFF…AVI → 422', async () => {
  for (const type of ['text/html', 'image/svg+xml', 'image/gif']) {
    remise(); let annule = false;
    page({ page: async () => new Response(new ReadableStream({ cancel() { annule = true; } }), { status: 200, headers: { 'content-type': type } }) });
    const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i') }));
    await vider();
    assert.deepEqual([r.status, await lire(r), annule, faux.MAJ[0].v.statut], [422, { erreur: 'pas_une_image' }, true, 422], type);
  }
  remise(); page({ page: async () => imageReponse(new Uint8Array(0), { type: 'image/png' }) });
  assert.deepEqual(await lire(await handler(requete('POST', { texte: corpsImage('https://site.test/vide.png') }))), { erreur: 'pas_une_image' }, 'corps de 0 octet');
  const html = new TextEncoder().encode('<!doctype html><p>IMAGE-SENTINELLE</p>');
  for (const [octets, type, attendu, nom] of [[html, 'image/jpeg', 422, 'HTML annonce jpeg'], [PNG(64), 'image/jpeg', 422, 'PNG annoncee jpeg'], [WEBP(64), 'image/webp', 200, 'RIFF…WEBP'], [WEBP(64, 'AVI '), 'image/webp', 422, 'RIFF…AVI']]) {
    remise(); page({ page: async () => imageReponse(octets, { type }) });
    const r = await handler(requete('POST', { texte: corpsImage('https://site.test/x') }));
    const t = await r.text();
    assert.equal(r.status, attendu, nom);
    if (attendu === 422) assert.deepEqual([JSON.parse(t), t.includes('SENTINELLE'), JSON.stringify(faux.MAJ).includes('SENTINELLE')], [{ erreur: 'pas_une_image' }, false, false], nom + ' : rien du corps, ni dans la reponse ni au journal');
  }
});

test('u5. 2 Mio (R-F-4) : content-length 2 097 153 → 413 sans lire (cancel) ; flux de 2 Mio + 1 sans content-length → 413 ; 2 097 152 exactement → 200, 2 796 204 caracteres', async () => {
  remise(); let annule = false;
  page({ page: async () => new Response(new ReadableStream({ pull(c) { c.enqueue(JPEG(16)); }, cancel() { annule = true; } }), { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '2097153' } }) });
  const r1 = await handler(requete('POST', { texte: corpsImage('https://site.test/gros.jpg') }));
  await vider();
  assert.deepEqual([r1.status, await lire(r1), annule], [413, { erreur: 'image_trop_lourde' }, true]);
  remise();
  const TOTAL = 2 * MIO + 1; let envoyes = 0; let annule2 = false; let finDemandee = false;
  // Rejeu (D-1) : la fermeture est differee d'un tirage — fermé juste après le dernier octet, le flux serait déjà CLOS quand le lecteur franchit la
  // borne (reader.cancel() sur un flux clos n'appelle jamais cancel) ; différée, un lecteur qui ne coupe pas reçoit quand même la fin (aucun blocage).
  page({ page: async () => new Response(new ReadableStream({
    pull(c) { if (envoyes >= TOTAL) { if (finDemandee) c.close(); finDemandee = true; return; } const n = Math.min(64 * 1024, TOTAL - envoyes); const m = new Uint8Array(n); if (envoyes === 0) m.set([0xff, 0xd8, 0xff]); envoyes += n; c.enqueue(m); },
    cancel() { annule2 = true; },
  }), { status: 200, headers: { 'content-type': 'image/jpeg' } }) });
  const r2 = await handler(requete('POST', { texte: corpsImage('https://site.test/flux.jpg') }));
  await vider();
  assert.deepEqual([r2.status, await lire(r2), annule2], [413, { erreur: 'image_trop_lourde' }, true], 'flux de 2 Mio + 1 : coupe en route');
  remise();
  page({ page: async () => imageReponse(JPEG(2097152)) });
  const r3 = await handler(requete('POST', { texte: corpsImage('https://site.test/juste.jpg') }));
  const c3 = await lire(r3);
  assert.deepEqual([r3.status, c3.taille, c3.octets.length], [200, 2097152, 2796204]);
});

test('u6. 404 / 500 / 403 / DNS → 502 inaccessible ; un saut a 15 s → 502 ; trois sauts de 12 s → 502 a 30 s ; ctl a 120 s pendant les en-tetes → 504', async () => {
  for (const s of [404, 500, 403]) {
    remise(); page({ page: async () => imageReponse(JPEG(10), { statut: s }) });
    const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [502, { erreur: 'inaccessible' }, 502], 'statut ' + s);
  }
  remise(); page({ page: async () => { throw new TypeError('getaddrinfo ENOTFOUND'); } });
  assert.equal((await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }))).status, 502, 'DNS');
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    let signalSaut = null; let parti; const appele = new Promise((res) => { parti = res; });
    page({ page: (url, options) => { signalSaut = options.signal; parti(); return sourde(url, options); } });
    const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    await appele;
    mock.timers.tick(LIMITES_LECTURE.delaiSautMs - 1);
    assert.equal(signalSaut.aborted, false, 'pas encore a 14,999 s');
    mock.timers.tick(1);
    assert.equal(signalSaut.aborted, true, 'abandonne a 15 s');
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r)], [502, { erreur: 'inaccessible' }]);
  } finally { mock.timers.reset(); }
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    const signaux = []; let prochain; const attendreAppel = () => new Promise((res) => { prochain = res; });
    let appel = attendreAppel();
    page({ page: (url, options) => { signaux.push(options.signal); prochain(); return new Promise((resoudre, rejeter) => {
      options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
      setTimeout(() => resoudre(new Response(null, { status: 301, headers: { location: `https://site.test/n${signaux.length}.jpg` } })), 12000);
    }); } });
    const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/n0.jpg') }));
    await appel; appel = attendreAppel(); mock.timers.tick(12000); await appel;
    appel = attendreAppel(); mock.timers.tick(12000); await appel;
    mock.timers.tick(5999);
    assert.equal(signaux[2].aborted, false, 'troisieme saut : rien a 29,999 s');
    mock.timers.tick(1);
    assert.equal(signaux[2].aborted, true, 'abandonne a 30 s en tout');
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), signaux.length], [502, { erreur: 'inaccessible' }, 3]);
  } finally { mock.timers.reset(); }
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    let parti; const appele = new Promise((res) => { parti = res; });
    page({ page: (url, options) => { parti(); return sourde(url, options); } });
    const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    await appele;
    mock.timers.tick(LIMITES.attenteMs); // le saut, le total et le budget tombent dans le même tour : le budget l'emporte (D-B26)
    const r = await enCours;
    assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [504, { erreur: 'delai' }, 504]);
  } finally { mock.timers.reset(); }
});

test('u6 bis (a). R-F-6 / D-B26 : en-tetes en 1 s puis un corps qui goutte → coupe a 15 s EXACTES (la minuterie du saut court pendant le corps), 502 — image-web ET lecture-web', async () => {
  for (const [nom, corpsDe, type, octet] of OUTILS_TELECHARGES) {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      remise();
      let signalSaut = null; let parti; const appele = new Promise((res) => { parti = res; });
      page({ page: (url, options) => { signalSaut = options.signal; parti(); return new Promise((resoudre) => { setTimeout(() => resoudre(new Response(goutte(options, octet).corps, { status: 200, headers: { 'content-type': type } })), 1000); }); } });
      const enCours = handler(requete('POST', { texte: corpsDe('https://site.test/g') }));
      await appele;
      mock.timers.tick(1000); await vider();
      mock.timers.tick(LIMITES_LECTURE.delaiSautMs - 1000 - 1); await vider();
      assert.equal(signalSaut.aborted, false, nom + ' : rien a 14,999 s');
      mock.timers.tick(1);
      assert.equal(signalSaut.aborted, true, nom + ' : coupe a 15 s, corps compris');
      const r = await enCours;
      assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [502, { erreur: 'inaccessible' }, 502], nom + ' : 502 (jamais 504 a 120 s)');
    } finally { mock.timers.reset(); }
  }
});

test('u6 bis (b). la minuterie GLOBALE pendant le corps : deux 301 de 12 s, puis en-tetes en 1 s et un corps qui goutte → coupe a 30 s exactes, 502 — pour les deux outils', async () => {
  for (const [nom, corpsDe, type, octet] of OUTILS_TELECHARGES) {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      remise();
      const signaux = []; let prochain; const attendreAppel = () => new Promise((res) => { prochain = res; });
      let appel = attendreAppel();
      page({ page: (url, options) => {
        signaux.push(options.signal); prochain();
        if (signaux.length <= 2) return new Promise((resoudre, rejeter) => { options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError'))); setTimeout(() => resoudre(new Response(null, { status: 301, headers: { location: `https://site.test/n${signaux.length}` } })), 12000); });
        return new Promise((resoudre) => { setTimeout(() => resoudre(new Response(goutte(options, octet).corps, { status: 200, headers: { 'content-type': type } })), 1000); });
      } });
      const enCours = handler(requete('POST', { texte: corpsDe('https://site.test/n0') }));
      await appel; appel = attendreAppel(); mock.timers.tick(12000); await appel;
      appel = attendreAppel(); mock.timers.tick(12000); await appel;
      mock.timers.tick(1000); await vider();
      mock.timers.tick(4999); await vider();
      assert.equal(signaux[2].aborted, false, nom + ' : rien a 29,999 s');
      mock.timers.tick(1);
      assert.equal(signaux[2].aborted, true, nom + ' : coupe a 30 s en tout, corps compris');
      const r = await enCours;
      assert.deepEqual([r.status, await lire(r), signaux.length], [502, { erreur: 'inaccessible' }, 3], nom);
    } finally { mock.timers.reset(); }
  }
});

test('u6 bis (c). abandon par ctl (120 s) PENDANT le corps → 504 delai — pour les deux outils', async () => {
  for (const [nom, corpsDe, type, octet] of OUTILS_TELECHARGES) {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      remise();
      let parti; const appele = new Promise((res) => { parti = res; });
      page({ page: (url, options) => { parti(); return new Promise((resoudre) => { setTimeout(() => resoudre(new Response(goutte(options, octet).corps, { status: 200, headers: { 'content-type': type } })), 1000); }); } });
      const enCours = handler(requete('POST', { texte: corpsDe('https://site.test/c') }));
      await appele;
      mock.timers.tick(1000); await vider();
      mock.timers.tick(LIMITES.attenteMs - 1000); // le saut (15 s), le total (30 s) et le budget (120 s) tombent dans le même tour : le budget l'emporte
      const r = await enCours;
      assert.deepEqual([r.status, await lire(r), faux.MAJ[0].v.statut], [504, { erreur: 'delai' }, 504], nom);
    } finally { mock.timers.reset(); }
  }
});

test('u6 bis (d). le client part PENDANT le corps → flux annule (lecteur factice), aucun corps, journal 499 — pour les deux outils', { timeout: 8000 }, async () => {
  for (const [nom, corpsDe, type, octet] of OUTILS_TELECHARGES) {
    remise();
    const etat = { annule: false }; let parti; const appele = new Promise((res) => { parti = res; });
    page({ page: (url, options) => {
      parti();
      const corps = new ReadableStream({ start(c) { c.enqueue(Uint8Array.of(octet)); options.signal.addEventListener('abort', () => { etat.annule = true; try { c.error(new DOMException('Aborted', 'AbortError')); } catch { /* deja en erreur */ } }, { once: true }); }, cancel() { etat.annule = true; } });
      return Promise.resolve(new Response(corps, { status: 200, headers: { 'content-type': type } }));
    } });
    const client = new AbortController();
    const enCours = handler(requete('POST', { texte: corpsDe('https://site.test/d'), signal: client.signal }));
    await appele; await vider();
    client.abort();
    const r = await enCours;
    assert.deepEqual([r.status, await r.text(), etat.annule, faux.MAJ[0].v.statut], [499, '', true, 499], nom);
  }
});

test('u7. abandon du client pendant les en-tetes → fetch abandonne, 499 sans corps, journal 499', { timeout: 8000 }, async () => {
  remise();
  let signalSaut = null; let parti; const appele = new Promise((res) => { parti = res; });
  page({ page: (url, options) => { signalSaut = options.signal; parti(); return sourde(url, options); } });
  const client = new AbortController();
  const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg'), signal: client.signal }));
  await appele;
  client.abort();
  const r = await enCours;
  assert.deepEqual([r.status, await r.text(), signalSaut.aborted, faux.MAJ[0].v.statut], [499, '', true, 499]);
});

test('u8. jamais le corps d une page d erreur : un 500 qui porte IMAGE-SENTINELLE → 502 inaccessible, absent de la reponse et du journal', async () => {
  remise();
  page({ page: async () => new Response('IMAGE-SENTINELLE', { status: 500, headers: { 'content-type': 'text/plain' } }) });
  const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
  const t = await r.text();
  assert.deepEqual([r.status, JSON.parse(t), t.includes('SENTINELLE'), JSON.stringify(faux.MAJ).includes('SENTINELLE')], [502, { erreur: 'inaccessible' }, false, false]);
});

test('u9. lecture-web : une page sans image → page.image_url null ; une og:image relative est resolue contre l adresse finale', async () => {
  const modele = async () => jsonReponse(200, { model: 'm', stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: '{}' }] });
  remise();
  page({ page: async () => htmlReponse(`<html><head><title>T</title></head><body><main><p>${TEXTE_RECETTE}</p></main></body></html>`), anthropic: modele });
  assert.equal((await lire(await handler(requete('POST', { texte: corpsLecture('https://site.test/sans') })))).page.image_url, null);
  remise();
  page({ page: async () => htmlReponse(`<html><head><meta property="og:image" content="/img/og.jpg"></head><body><main><p>${TEXTE_RECETTE}</p></main></body></html>`), anthropic: modele });
  assert.equal((await lire(await handler(requete('POST', { texte: corpsLecture('https://site.test/r/og') })))).page.image_url, 'https://site.test/img/og.jpg');
  // Ronde 1 (S-12) : traiter() RELAIE hotesRefuses à lirePageHtml — une image (og:image, ou image du JSON-LD) sur l'hôte de SUPABASE_URL, ou sur
  // un de ses sous-domaines, rend page.image_url null ; le témoin (la même page, image sur un autre hôte) rend l'adresse.
  const avecOg = (img) => `<html><head><meta property="og:image" content="${img}"></head><body><main><p>${TEXTE_RECETTE}</p></main></body></html>`;
  const avecLd = (img) => `<html><head><script type="application/ld+json">${JSON.stringify({ ...RECETTE_LD, image: img })}</script></head><body><main><p>Texte.</p></main></body></html>`;
  const issues = [];
  for (const [nom, html] of [['og:image projet', avecOg('https://projet.test/storage/i.jpg')], ['og:image sous-domaine', avecOg('https://cdn.projet.test/i.jpg')],
    ['JSON-LD projet', avecLd('https://projet.test/i.jpg')], ['og:image temoin', avecOg('https://cdn.test/i.jpg')], ['JSON-LD temoin', avecLd('https://cdn.test/j.jpg')]]) {
    remise(); ENV.SUPABASE_URL = 'https://projet.test';
    page({ page: async () => htmlReponse(html), anthropic: modele });
    const r = await handler(requete('POST', { texte: corpsLecture('https://site.test/r/projet') }));
    const corps = await lire(r);
    issues.push([nom, r.status, corps.source_kind, corps.page.image_url]);
  }
  assert.deepEqual(issues, [['og:image projet', 200, 'modele', null], ['og:image sous-domaine', 200, 'modele', null], ['JSON-LD projet', 200, 'jsonld', null],
    ['og:image temoin', 200, 'modele', 'https://cdn.test/i.jpg'], ['JSON-LD temoin', 200, 'jsonld', 'https://cdn.test/j.jpg']]);
});

test('u10. une seule boucle : image-web et lecture-web rediriges vers https://localhost/ rendent le meme 422 interdit', async () => {
  const issues = [];
  for (const corpsDe of [corpsImage, corpsLecture]) {
    remise(); page({ page: async () => new Response(null, { status: 302, headers: { location: 'https://localhost/x' } }) });
    const r = await handler(requete('POST', { texte: corpsDe('https://site.test/a') }));
    issues.push([r.status, await lire(r), appelsPage().length, faux.MAJ[0].v.statut]);
  }
  assert.deepEqual(issues, [[422, { erreur: 'interdit' }, 1, 422], [422, { erreur: 'interdit' }, 1, 422]]);
});

test('u11. image-web n atteint JAMAIS le modele : pour chaque issue, zero fetch vers le fournisseur, aucun x-api-key', { timeout: 8000 }, async () => {
  const sansModele = (nom) => {
    assert.equal(appelsModele().length, 0, nom + ' : aucun appel au modele');
    assert.ok(appelsFetch.every((a) => !Object.keys(a.options?.headers || {}).some((h) => h.toLowerCase() === 'x-api-key')), nom + ' : aucun x-api-key');
  };
  const issues = [
    ['200', async () => imageReponse(JPEG(40)), 200],
    ['interdit (redirection)', async () => new Response(null, { status: 302, headers: { location: 'https://localhost/' } }), 422],
    ['pas_une_image', async () => imageReponse(new TextEncoder().encode('<p>x</p>'), { type: 'text/html' }), 422],
    ['image_trop_lourde', async () => imageReponse(JPEG(10), { entetes: { 'content-length': '2097153' } }), 413],
    ['inaccessible', async () => imageReponse(JPEG(10), { statut: 404 }), 502],
    ['exception levee par telechargerImage', async () => ({ status: 301, headers: { get: () => { throw new Error('en-tete hostile'); } }, body: null }), 502],
  ];
  for (const [nom, rep, statut] of issues) {
    remise(); page({ page: rep });
    const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    assert.equal(r.status, statut, nom);
    await r.text();
    sansModele(nom);
  }
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise(); let parti; const appele = new Promise((res) => { parti = res; });
    page({ page: (url, options) => { parti(); return sourde(url, options); } });
    const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
    await appele; mock.timers.tick(LIMITES.attenteMs);
    assert.equal((await enCours).status, 504, '504');
    sansModele('504');
  } finally { mock.timers.reset(); }
  remise(); let parti; const appele = new Promise((res) => { parti = res; });
  page({ page: (url, options) => { parti(); return sourde(url, options); } });
  const client = new AbortController();
  const enCours = handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg'), signal: client.signal }));
  await appele; client.abort();
  assert.equal((await enCours).status, 499, '499');
  sansModele('499');
});

test('u12. ronde 1 : une image SUIVIE malgre redirect manual (r.redirected) → 422 interdit, corps annule, jamais lu, aucun appel au modele, journal 422 (la garde de B vaut pour image-web, R-F-13)', async () => {
  remise();
  let annule = false; let lu = false;
  page({ page: async () => {
    const r = new Response(new ReadableStream({ pull(c) { lu = true; c.enqueue(JPEG(40)); c.close(); }, cancel() { annule = true; } }, { highWaterMark: 0 }), { status: 200, headers: { 'content-type': 'image/jpeg' } }); // highWaterMark 0 : pull seulement sur une lecture
    Object.defineProperty(r, 'redirected', { value: true }); // un runtime qui aurait suivi la redirection (vers une adresse jamais revalidee)
    return r;
  } });
  const r = await handler(requete('POST', { texte: corpsImage('https://site.test/i.jpg') }));
  await vider();
  assert.deepEqual([r.status, await lire(r), annule, appelsPage().length, appelsModele().length, faux.MAJ[0].v.statut], [422, { erreur: 'interdit' }, true, 1, 0, 422]);
  assert.equal(lu, false, 'le corps d une image suivie n est jamais lu');
});

// --- Lot UI-2 « Aperçus des résultats web » (spec 2026-10-23-experience-carnet § 6, D-UI-12, D-UI-14, I-UI-6) : apercu-web, cinq adresses, zéro jeton ----------
const corpsApercu = (urls) => JSON.stringify({ outil: 'apercu-web', corps: { urls } });
const pageOg = (image, texte = TEXTE_RECETTE) => `<html><head><title>Blogue</title><meta property="og:image" content="${image}"></head><body><main><h1>Plat</h1><p>${texte}</p></main></body></html>`;
const pageLd = (image) => `<html><head><title>Puttanesca</title><script type="application/ld+json">${JSON.stringify({ ...RECETTE_LD, image })}</script></head><body><main><p>Texte.</p></main></body></html>`;
const { image: _imageLd, ...RECETTE_SANS_IMAGE } = RECETTE_LD;
const PAGE_LD_SANS_IMAGE = `<html><head><title>Sans</title><script type="application/ld+json">${JSON.stringify(RECETTE_SANS_IMAGE)}</script></head><body><main><p>Texte.</p></main></body></html>`;
// Une page de LISTE : deux Recipe lisibles sans image, et une og:image (celle d'une autre recette : écartée par la règle de F, D-F3).
const pageListe = (og) => `<html><head><title>Liste</title><meta property="og:image" content="${og}"></head><body><main><script type="application/ld+json">${JSON.stringify([{ ...RECETTE_SANS_IMAGE, name: 'A' }, { ...RECETTE_SANS_IMAGE, name: 'B' }])}</script><p>${TEXTE_RECETTE}</p></main></body></html>`;
const PAGE_RIEN = '<html><head><title>Rien</title></head><body><main><p>Un texte sans recette ni image.</p></main></body></html>';
// Un routeur par adresse : chaque entrée est (url, options) → Response ; une adresse absente répond 404 (donc inaccessible).
const routeur = (routes) => page({ page: (url, options) => (Object.hasOwn(routes, url) ? routes[url](url, options) : Promise.resolve(new Response('absent', { status: 404, headers: { 'content-type': 'text/plain' } }))) });
// Vide les micro-tâches ET quelques tours de boucle : une page lue déclenche une chaîne (lecture du corps, lirePageHtml, fetch de l'image, base64) avant qu'une adresse suivante parte.
const drainer = async () => { for (let i = 0; i < 8; i += 1) await vider(); };
const BUDGET_APERCU_MS = 60000; // LIMITES_APERCU.budgetMs (logique.js), en littéral ici : un budget changé dans index.ts rougit v7
const B64_UN_MIO = 1398104;     // ceil(1 048 576 / 3) × 4

test('v1. apercu-web : adresses toutes refusees → 422 interdit AVANT toute reservation, aucun fetch ; forme (urls absent, chaine, vide, six, non-chaine, 2 049 unites) → 400 requete sans reservation', async () => {
  remise(); ENV.SUPABASE_URL = 'https://projet.test';
  const r = await handler(requete('POST', { texte: corpsApercu(['http://a.test/', 'https://127.0.0.1/', 'https://localhost/x', 'https://projet.test/x', 'https://a.test:8443/']) }));
  assert.deepEqual([r.status, await lire(r), reserves().length, appelsFetch.length, faux.MAJ.length], [422, { erreur: 'interdit' }, 0, 0, 0]);
  for (const [nom, texte] of [['absent', JSON.stringify({ outil: 'apercu-web', corps: {} })], ['chaine', corpsApercu('https://a.test/')], ['vide', corpsApercu([])],
    ['six', corpsApercu(Array.from({ length: 6 }, (_, i) => `https://a.test/${i}`))], ['non-chaine', corpsApercu(['https://a.test/', 7])], ['2 049 unites', corpsApercu(['https://a.test/' + 'x'.repeat(2034)])]]) {
    remise();
    const x = await handler(requete('POST', { texte }));
    assert.deepEqual([x.status, await lire(x), reserves().length, appelsFetch.length, faux.MAJ.length], [400, { erreur: 'requete' }, 0, 0, 0], nom);
  }
});

test('v2. une admise et quatre interdites : UNE reservation apercu-web (cle secrete), deux fetch (la page, puis son image), AUCUN fetch du modele, 200 avec cinq entrees dans l ordre, url = chaine recue, journal 200 jetons null', async () => {
  remise(); ENV.SUPABASE_URL = 'https://projet.test';
  const octets = JPEG(1000);
  routeur({ 'https://site.test/r1': async () => htmlReponse(pageLd('https://site.test/i/p.jpg')), 'https://site.test/i/p.jpg': async () => imageReponse(octets) });
  const urls = ['https://site.test/r1#frag', 'http://b.test/', 'https://127.0.0.1/', 'https://u:p@c.test/', 'https://projet.test/x'];
  const texte = corpsApercu(urls);
  const minuteries = () => process.getActiveResourcesInfo().filter((x) => x === 'Timeout').length; // ronde 1 : le budget (60 s) et l attente (120 s) sont ici de VRAIES minuteries (v7 seul les simule)
  const minuteriesAvant = minuteries();
  const r = await handler(requete('POST', { texte }));
  assert.equal(r.status, 200);
  assert.equal(minuteries(), minuteriesAvant, 'ronde 1 : aucune minuterie laissee derriere la reponse (clearTimeout du budget de 60 s ET de l attente de 120 s) ; sans le clearTimeout du budget, chaque appel tiendrait une minuterie orpheline 60 s de plus');
  const corps = await lire(r);
  assert.deepEqual(reserves().map((a) => a.args), [{ p_owner: 'compte-1', p_outil: 'apercu-web', p_octets: Buffer.byteLength(texte), p_quota: 2 }], 'une seule reservation pour les cinq (I-UI-6)');
  assert.equal(reserves()[0].cle, 'sb_secret_factice');
  assert.deepEqual([appelsPage().map((a) => a.url), appelsModele().length], [['https://site.test/r1', 'https://site.test/i/p.jpg'], 0], 'la page (fragment retire) puis son image ; jamais le modele');
  for (const f of appelsPage()) {
    assert.deepEqual([f.options.method, f.options.redirect, f.options.credentials], ['GET', 'manual', 'omit']);
    assert.deepEqual(Object.keys(f.options).sort(), ['credentials', 'headers', 'method', 'redirect', 'signal'], 'les options ENTIERES : jamais referrer ni referrerPolicy');
    assert.deepEqual(Object.keys(f.options.headers).sort(), ['accept', 'accept-language', 'user-agent'], 'exactement trois en-tetes : jamais referer, cookie, authorization, apikey, x-api-key');
    assert.equal(f.options.headers['user-agent'], 'Mitsu/0.10 (+https://neegans.github.io/mistu/)');
  }
  assert.ok(appelsPage()[0].options.headers.accept.startsWith('text/html') && appelsPage()[1].options.headers.accept.startsWith('image/jpeg'), 'l accept de la page, puis celui de l image');
  assert.deepEqual(Object.keys(corps), ['apercus'], 'une seule cle (S-17) : ni usage, ni model, ni url_finale');
  assert.deepEqual(corps.apercus.map((a) => Object.keys(a).sort()), Array.from({ length: 5 }, () => ['image', 'raison', 'url']));
  assert.deepEqual(corps.apercus.map((a) => [a.url, a.raison, a.image === null]), [['https://site.test/r1#frag', null, false], ['http://b.test/', 'interdit', true], ['https://127.0.0.1/', 'interdit', true], ['https://u:p@c.test/', 'interdit', true], ['https://projet.test/x', 'interdit', true]], 'une entree par chaine recue, dans l ordre, url telle quelle (fragment garde) ; raison nulle si et seulement si image presente');
  assert.deepEqual([corps.apercus[0].image.type, corps.apercus[0].image.taille, Object.keys(corps.apercus[0].image).sort()], ['image/jpeg', 1000, ['octets', 'taille', 'type']]);
  assert.ok(Buffer.from(corps.apercus[0].image.octets, 'base64').equals(Buffer.from(octets)), 'les octets relus du base64');
  assert.equal(corps.apercus[0].image.octets.length, 1336, 'ronde 1 : 1 000 octets → 1 336 caracteres, remplissage compris (Buffer.from tolere un = final manquant ; la longueur, non)');
  assert.deepEqual(faux.MAJ[0].v, { statut: 200, jetons_entree: null, jetons_sortie: null, duree_ms: faux.MAJ[0].v.duree_ms });
  assert.deepEqual(faux.evenements, ['rpc:is_allowed', 'rpc:assistant_reserver', 'fetch', 'fetch', 'update'], 'validation, reservation, page, image, journal : dans cet ordre');
});

test('v3. dedoublonnage pour le TELECHARGEMENT seulement (S-9) : trois chaines pour la meme page → deux fetch (page, image), trois entrees ; casse et fragment de la chaine recue rendus tels quels', async () => {
  remise();
  routeur({ 'https://site.test/R1': async () => htmlReponse(pageOg('https://cdn.test/og.jpg')), 'https://cdn.test/og.jpg': async () => imageReponse(JPEG(40)) });
  const urls = ['https://Site.test/R1#x', 'https://site.test/R1', 'https://SITE.test/R1#y'];
  const r = await handler(requete('POST', { texte: corpsApercu(urls) }));
  const corps = await lire(r);
  assert.deepEqual([r.status, appelsPage().map((a) => a.url), appelsModele().length, reserves().length], [200, ['https://site.test/R1', 'https://cdn.test/og.jpg'], 0, 1]);
  assert.deepEqual(corps.apercus.map((a) => a.url), urls, 'url = la chaine recue, jamais le href normalise (le client indexe par lien.href)');
  assert.deepEqual(corps.apercus.map((a) => [a.raison, a.image.taille, a.image.octets === corps.apercus[0].image.octets]), [[null, 40, true], [null, 40, true], [null, 40, true]], 'la meme image pour les trois entrees');
});

test('v4. une raison par adresse, sans faire echouer les autres (page : inaccessible, pas_de_recette, pas_d_image, interdit ; image : inaccessible, pas_d_image, image_trop_lourde, interdit) ; une page sans JSON-LD n appelle JAMAIS le modele ; jamais un corps d erreur dans la reponse ni au journal', async () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const html = new TextEncoder().encode('<!doctype html><p>APERCU-SENTINELLE</p>');
  const routes = {
    'https://site.test/p404': async () => new Response('APERCU-SENTINELLE', { status: 404, headers: { 'content-type': 'text/html' } }),
    'https://site.test/pdf': async () => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200, headers: { 'content-type': 'application/pdf' } }),
    'https://site.test/liste': async () => htmlReponse(pageListe('https://cdn.test/liste.jpg')),
    'https://site.test/sans': async () => htmlReponse(PAGE_LD_SANS_IMAGE),
    'https://site.test/rien': async () => htmlReponse(PAGE_RIEN),
    'https://site.test/og': async () => htmlReponse(pageOg('https://cdn.test/og.jpg')),
    'https://cdn.test/og.jpg': async () => imageReponse(JPEG(40)),
    'https://site.test/img404': async () => htmlReponse(pageOg('https://cdn.test/404.jpg')),
    'https://cdn.test/404.jpg': async () => new Response('APERCU-SENTINELLE', { status: 404, headers: { 'content-type': 'text/plain' } }),
    'https://site.test/svg': async () => htmlReponse(pageOg('https://cdn.test/i.svg')),
    'https://cdn.test/i.svg': async () => imageReponse(svg, { type: 'image/svg+xml' }),
    'https://site.test/menteuse': async () => htmlReponse(pageOg('https://cdn.test/menteuse.jpg')),
    'https://cdn.test/menteuse.jpg': async () => imageReponse(html, { type: 'image/jpeg' }),
    'https://site.test/lourde': async () => htmlReponse(pageOg('https://cdn.test/lourde.jpg')),
    'https://cdn.test/lourde.jpg': async () => imageReponse(JPEG(16), { entetes: { 'content-length': String(MIO + 1) } }),
    'https://site.test/redir': async () => htmlReponse(pageOg('https://cdn.test/redir.jpg')),
    'https://cdn.test/redir.jpg': async () => new Response(null, { status: 302, headers: { location: 'https://localhost/x' } }),
    'https://site.test/pageredir': async () => new Response(null, { status: 301, headers: { location: 'https://127.0.0.1/x' } }),
    'https://site.test/pagelourde': async () => htmlReponse('<main>x</main>', { entetes: { 'content-length': String(2 * MIO + 1) } }),
    'https://site.test/dns': async () => { throw new TypeError('getaddrinfo ENOTFOUND'); },
  };
  const attendu = {
    'https://site.test/p404': ['inaccessible', false], 'https://site.test/pdf': ['pas_de_recette', false], 'https://site.test/liste': ['pas_de_recette', false],
    'https://site.test/sans': ['pas_d_image', false], 'https://site.test/rien': ['pas_de_recette', false],
    'https://site.test/og': [null, true], 'https://site.test/img404': ['inaccessible', false], 'https://site.test/svg': ['pas_d_image', false],
    'https://site.test/menteuse': ['pas_d_image', false], 'https://site.test/lourde': ['image_trop_lourde', false],
    'https://site.test/redir': ['interdit', false], 'https://site.test/pageredir': ['interdit', false], 'https://site.test/pagelourde': ['inaccessible', false], 'https://site.test/dns': ['inaccessible', false],
  };
  const urls = Object.keys(attendu);
  const issues = {}; const demandees = [];
  for (let i = 0; i < urls.length; i += 5) {
    remise(); routeur(routes);
    const lot = urls.slice(i, i + 5);
    const r = await handler(requete('POST', { texte: corpsApercu(lot) }));
    const t = await r.text();
    assert.equal(r.status, 200, lot.join(' '));
    assert.ok(!t.includes('SENTINELLE') && !JSON.stringify(faux.MAJ).includes('SENTINELLE'), 'jamais le corps d une page ou d une image d erreur, ni dans la reponse ni au journal');
    for (const a of JSON.parse(t).apercus) issues[a.url] = [a.raison, a.image !== null];
    demandees.push(...appelsPage().map((a) => a.url));
    assert.deepEqual([reserves().length, appelsModele().length, faux.MAJ[0].v.statut], [1, 0, 200], 'une reservation, aucun appel au modele (meme pour une page sans JSON-LD), journal 200 : ' + lot.join(' '));
  }
  assert.deepEqual(issues, attendu);
  assert.equal(demandees.includes('https://cdn.test/liste.jpg'), false, 'l og:image d une page de liste n est jamais demandee (D-F3)');
  assert.equal(demandees.includes('https://localhost/x'), false, 'une cible de redirection refusee n est jamais demandee');
});

test('v4 bis. S-12 dans apercuDe : l hote du projet et ses sous-domaines sont refuses par les TROIS relais de hotesRefuses (lirePageHtml, telechargerPage, telechargerImage) — og:image sur l hote du projet → pas_de_recette ; image JSON-LD sur un sous-domaine du projet → pas_d_image ; 301 de page vers le projet → interdit ; 302 d image vers le projet → interdit ; aucun fetch dont l hote finit par projet.test', async () => {
  remise(); ENV.SUPABASE_URL = 'https://projet.test';
  const servie = async () => imageReponse(JPEG(12)); // ce que la fonction rendrait si un relais tombait : une image du projet, telechargee par elle-meme
  routeur({
    'https://site.test/og-projet': async () => htmlReponse(pageOg('https://projet.test/storage/v1/object/public/plats/p.jpg')),
    'https://site.test/ld-projet': async () => htmlReponse(pageLd('https://cdn.projet.test/i.jpg')),
    'https://site.test/301-projet': async () => new Response(null, { status: 301, headers: { location: 'https://projet.test/functions/v1/assistant' } }),
    'https://site.test/302-image': async () => htmlReponse(pageOg('https://cdn.test/vers-projet.jpg')),
    'https://cdn.test/vers-projet.jpg': async () => new Response(null, { status: 302, headers: { location: 'https://projet.test/i.jpg' } }),
    'https://projet.test/storage/v1/object/public/plats/p.jpg': servie, 'https://cdn.projet.test/i.jpg': servie, 'https://projet.test/i.jpg': servie,
    'https://projet.test/functions/v1/assistant': async () => htmlReponse(pageOg('https://cdn.test/x.jpg')), 'https://cdn.test/x.jpg': servie,
  });
  const urls = ['https://site.test/og-projet', 'https://site.test/ld-projet', 'https://site.test/301-projet', 'https://site.test/302-image'];
  const r = await handler(requete('POST', { texte: corpsApercu(urls) }));
  const corps = await lire(r);
  assert.deepEqual([r.status, corps.apercus.map((a) => [a.url, a.raison, a.image])], [200, [[urls[0], 'pas_de_recette', null], [urls[1], 'pas_d_image', null], [urls[2], 'interdit', null], [urls[3], 'interdit', null]]], 'une raison par relais : lirePageHtml (og:image, image JSON-LD), telechargerPage (301), telechargerImage (302)');
  assert.deepEqual(appelsPage().map((a) => new URL(a.url).hostname).filter((h) => h === 'projet.test' || h.endsWith('.projet.test')), [], 'aucune requete vers l hote du projet ni un sous-domaine : la fonction ne se rappelle jamais elle-meme (S-12)');
  assert.deepEqual([reserves().length, appelsModele().length, faux.MAJ[0].v.statut], [1, 0, 200]);
});

test('v5. borne de 1 Mio par apercu (H-18, F-19, S-11) : 1 048 577 octets → image_trop_lourde ; 1 048 576 → image rendue (1 398 104 caracteres) ; cinq images a la borne → corps ≤ 8 Mio (le corpsMax du client) ; image-web garde ses 2 Mio (u5)', { timeout: 20000 }, async () => {
  remise();
  routeur({ 'https://site.test/un': async () => htmlReponse(pageOg('https://cdn.test/un.jpg')), 'https://cdn.test/un.jpg': async () => imageReponse(JPEG(MIO + 1)),
    'https://site.test/juste': async () => htmlReponse(pageOg('https://cdn.test/juste.jpg')), 'https://cdn.test/juste.jpg': async () => imageReponse(JPEG(MIO)) });
  const r = await handler(requete('POST', { texte: corpsApercu(['https://site.test/un', 'https://site.test/juste']) }));
  const corps = await lire(r);
  assert.deepEqual([r.status, corps.apercus[0].raison, corps.apercus[0].image, corps.apercus[1].raison, corps.apercus[1].image.taille, corps.apercus[1].image.octets.length], [200, 'image_trop_lourde', null, null, MIO, B64_UN_MIO]);
  assert.ok(Buffer.from(corps.apercus[1].image.octets, 'base64').equals(Buffer.from(JPEG(MIO))), 'base64 relu a l octet (tranches multiples de 3 : un seul remplissage, a la fin)');
  remise();
  const routes = {};
  const cinq = [1, 2, 3, 4, 5].map((i) => `https://site.test/b${i}`);
  for (const [i, u] of cinq.entries()) { routes[u] = async () => htmlReponse(pageOg(`https://cdn.test/b${i + 1}.jpg`)); routes[`https://cdn.test/b${i + 1}.jpg`] = async () => imageReponse(JPEG(MIO)); }
  routeur(routes);
  const r5 = await handler(requete('POST', { texte: corpsApercu(cinq) }));
  const texte = await r5.text();
  assert.equal(r5.status, 200);
  assert.ok(Buffer.byteLength(texte) <= 8 * MIO, 'cinq images a la borne : ' + Buffer.byteLength(texte) + ' octets, sous les 8 Mio du client (≈ 7 Mio de base64)');
  assert.deepEqual(JSON.parse(texte).apercus.map((a) => [a.raison, a.image.taille, a.image.octets.length]), Array.from({ length: 5 }, () => [null, MIO, B64_UN_MIO]));
});

test('v6. parallelisme 2 (PARALLELISME_APERCU, S-2) : deux pages en vol, jamais trois ; la troisieme part quand une des deux premieres finit ; l ordre des entrees est celui des chaines recues', async () => {
  remise();
  const attentes = new Map();
  // Ronde 1 : une taille d image DISTINCTE par page (10 × son numero), deduite de l adresse de l image : l alignement resultat ↔ adresse est affirme par index.
  const tailleDe = (url) => 10 * Number(/(\d+)\.jpg$/.exec(url)[1]);
  page({ page: (url) => (url.startsWith('https://cdn.test/') ? Promise.resolve(imageReponse(JPEG(tailleDe(url)))) : new Promise((res) => { attentes.set(url, res); })) });
  const urls = [1, 2, 3, 4, 5].map((i) => `https://site.test/p${i}`);
  const enCours = handler(requete('POST', { texte: corpsApercu(urls) }));
  await drainer();
  assert.deepEqual([...attentes.keys()], urls.slice(0, 2), 'deux pages en vol apres la reservation, pas trois');
  attentes.get(urls[1])(htmlReponse(pageOg('https://cdn.test/2.jpg'))); await drainer();
  assert.deepEqual([...attentes.keys()], urls.slice(0, 3), 'p2 finie (page puis image) : p3 part, p1 toujours en vol');
  attentes.get(urls[0])(htmlReponse(pageOg('https://cdn.test/1.jpg'))); await drainer();
  assert.deepEqual([...attentes.keys()], urls.slice(0, 4));
  attentes.get(urls[2])(htmlReponse(pageOg('https://cdn.test/3.jpg'))); attentes.get(urls[3])(htmlReponse(pageOg('https://cdn.test/4.jpg'))); await drainer();
  assert.deepEqual([...attentes.keys()], urls, 'la cinquieme part en dernier');
  attentes.get(urls[4])(htmlReponse(pageOg('https://cdn.test/5.jpg')));
  const r = await enCours;
  const corps = await lire(r);
  assert.deepEqual([r.status, corps.apercus.map((a) => [a.url, a.raison, a.image?.taille ?? null]), appelsPage().length, appelsModele().length], [200, urls.map((u, i) => [u, null, 10 * (i + 1)]), 10, 0], 'chaque entree porte l image de SA page (taille 10 × i), dans l ordre des chaines recues, meme quand p2 finit avant p1 (un enParallele en ordre d achevement rougit ici)');
});

test('v7. budget serveur de 60 s (S-1) : UN AbortController par appel, relaye a chaque suivreRedirections — (a) les adresses lues avant restent, celle en vol est abandonnee a 60 s EXACTES (delai) ; (b) une adresse jamais commencee rend delai sans fetch ; 200, journal 200', async () => {
  // (a) Chaque page = un 301 a 11 s puis un 200 (og:image) a 11 s : 22 s par adresse, sous les 15 s par saut et les 30 s par page ; deux a la fois (v6) :
  // p1-p2 0-22 s, p3-p4 22-44 s, p5 44 s → son second saut est en vol a 60 s.
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    const signaux = [];
    const saut = (url, options) => new Promise((resoudre, rejeter) => {
      options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
      setTimeout(() => resoudre(url.endsWith('/a') ? new Response(null, { status: 301, headers: { location: url.slice(0, -2) + '/b' } }) : htmlReponse(pageOg('https://cdn.test/' + url.split('/')[3] + '.jpg'))), 11000);
    });
    page({ page: (url, options) => { if (url.startsWith('https://cdn.test/')) return Promise.resolve(imageReponse(JPEG(10 * Number(/p(\d+)\.jpg$/.exec(url)[1])))); signaux.push(options.signal); return saut(url, options); } });
    const urls = [1, 2, 3, 4, 5].map((i) => `https://site.test/p${i}/a`);
    const enCours = handler(requete('POST', { texte: corpsApercu(urls) }));
    await drainer();
    assert.equal(signaux.length, 2, 't = 0 : p1 et p2');
    for (const [t, n] of [[11, 4], [22, 6], [33, 8], [44, 9]]) { mock.timers.tick(11000); await drainer(); assert.equal(signaux.length, n, 't = ' + t + ' s'); }
    mock.timers.tick(11000); await drainer();
    assert.equal(signaux.length, 10, 't = 55 s : le second saut de p5 est en vol');
    mock.timers.tick(BUDGET_APERCU_MS - 55000 - 1); await drainer();
    assert.equal(signaux[9].aborted, false, 'rien a 59,999 s');
    mock.timers.tick(1); await drainer();
    assert.equal(signaux[9].aborted, true, 'a 60 s exactes, la requete en vol est abandonnee par le budget');
    const r = await enCours;
    const corps = await lire(r);
    assert.deepEqual([r.status, corps.apercus.map((a) => [a.raison, a.image?.taille ?? null]), faux.MAJ[0].v.statut, appelsModele().length], [200, [[null, 10], [null, 20], [null, 30], [null, 40], ['delai', null]], 200, 0], 'ronde 1 : chaque image a sa carte (taille 10 × le numero de la page)');
    assert.equal(appelsPage().length, 14, 'dix fetch de page (deux sauts par adresse) et quatre images ; rien apres le budget');
  } finally { mock.timers.reset(); }
  // (b) Chaque page = 301 a 12 s, 301 a 12 s, puis un troisieme saut coupe par les 30 s de la page (inaccessible) : p1-p2 0-30 s (inaccessible), p3-p4
  // 30-60 s (coupees a 60 s par le budget : delai, meme si leur propre minuterie de 30 s tombe dans le meme tour), p5 jamais commencee (delai, zero fetch).
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    const signaux = [];
    page({ page: (url, options) => { signaux.push(options.signal); return new Promise((resoudre, rejeter) => {
      options.signal.addEventListener('abort', () => rejeter(new DOMException('Aborted', 'AbortError')));
      setTimeout(() => resoudre(new Response(null, { status: 301, headers: { location: url + '/s' } })), 12000);
    }); } });
    const enCours = handler(requete('POST', { texte: corpsApercu([1, 2, 3, 4, 5].map((i) => `https://site.test/q${i}`)) }));
    await drainer();
    for (const [t, n] of [[12, 4], [24, 6], [30, 8], [42, 10], [54, 12]]) { mock.timers.tick(t === 30 ? 6000 : 12000); await drainer(); assert.equal(signaux.length, n, 't = ' + t + ' s'); }
    mock.timers.tick(BUDGET_APERCU_MS - 54000 - 1); await drainer();
    assert.deepEqual([signaux[10].aborted, signaux[11].aborted], [false, false], 'rien a 59,999 s');
    mock.timers.tick(1); await drainer();
    assert.deepEqual([signaux[10].aborted, signaux[11].aborted], [true, true], 'a 60 s : les deux troisiemes sauts de p3 et p4 tombent');
    const r = await enCours;
    const corps = await lire(r);
    assert.deepEqual([r.status, corps.apercus.map((a) => a.raison), appelsPage().length, faux.MAJ[0].v.statut], [200, ['inaccessible', 'inaccessible', 'delai', 'delai', 'delai'], 12, 200], 'p5 jamais demandee : douze fetch en tout (trois par adresse commencee)');
  } finally { mock.timers.reset(); }
});

test('v8. le client part pendant les apercus (F-5) : les requetes en vol sont abandonnees (relais ctl → budget), les adresses restantes ne sont jamais demandees, 499 sans corps, journal 499 (appel compte)', { timeout: 8000 }, async () => {
  remise();
  const signaux = []; let deux; const posees = new Promise((res) => { deux = res; });
  page({ page: (url, options) => { signaux.push(options.signal); if (signaux.length === 2) deux(); return sourde(url, options); } });
  const client = new AbortController();
  const enCours = handler(requete('POST', { texte: corpsApercu([1, 2, 3, 4, 5].map((i) => `https://site.test/s${i}`)), signal: client.signal }));
  await posees;
  client.abort();
  const r = await enCours;
  assert.deepEqual([r.status, await r.text(), signaux.map((s) => s.aborted), appelsPage().length, faux.MAJ[0].v.statut, appelsModele().length], [499, '', [true, true], 2, 499, 0]);
});

test('v8 bis. le client part PENDANT la reservation (F-5) : ctl deja leve avant le premier fetch → budget leve d emblee, aucune page demandee, 499 sans corps, journal 499 (appel compte)', async () => {
  remise();
  const client = new AbortController();
  faux.REPONSES.rpc = async (nom) => { if (nom === 'assistant_reserver') { client.abort(); return { data: 7, error: null }; } return { data: true, error: null }; };
  routeur({ 'https://site.test/r1': async () => htmlReponse(pageOg('https://cdn.test/og.jpg')), 'https://cdn.test/og.jpg': async () => imageReponse(JPEG(10)) });
  const r = await handler(requete('POST', { texte: corpsApercu(['https://site.test/r1', 'https://site.test/r2']), signal: client.signal }));
  assert.deepEqual([r.status, await r.text(), appelsFetch.length, reserves().length, faux.MAJ[0].v.statut], [499, '', 0, 1, 499], 'reservation faite (compte), client parti : rien n est telecharge pour personne (un addEventListener seul, pose sur un signal deja leve, ne tirerait jamais)');
});

test('v8 ter. le depart du client coupe aussi l IMAGE en vol (F-5 : relais ctl → budget → suivreRedirections dans la phase image d apercuDe) : page immediate, image sourde, client parti → le signal de l image est leve aussitot, 499 sans corps, journal 499', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    remise();
    const signaux = [];
    page({ page: (url, options) => { if (url.startsWith('https://cdn.test/')) { signaux.push(options.signal); return sourde(url, options); } return Promise.resolve(htmlReponse(pageOg('https://cdn.test/lente.jpg'))); } });
    const client = new AbortController();
    const enCours = handler(requete('POST', { texte: corpsApercu(['https://site.test/p1']), signal: client.signal }));
    await drainer();
    assert.deepEqual([appelsPage().map((a) => a.url), signaux.length, signaux[0]?.aborted], [['https://site.test/p1', 'https://cdn.test/lente.jpg'], 1, false], 'la page est lue, l image est en vol');
    client.abort(); await drainer();
    assert.equal(signaux[0].aborted, true, 'le depart du client coupe l image en vol (un telechargerImage sans relais du budget la laisserait courir jusqu a sa minuterie de 15 s / 30 s, pour personne)');
    mock.timers.tick(31000); await drainer(); // sans relais, seule la minuterie de 30 s couperait l image : ici il ne reste rien a couper
    const r = await enCours;
    assert.deepEqual([r.status, await r.text(), appelsPage().length, faux.MAJ[0].v.statut, appelsModele().length], [499, '', 2, 499, 0]);
  } finally { mock.timers.reset(); }
});

test('v9. D-UI-14 / K-7 : la reservation en erreur (0007 absente : 23514 sur l insert d assistant_reserver) → 502 serveur, aucune page demandee ; quota atteint → 429 quota, aucune page demandee', async () => {
  remise(); routeur({ 'https://site.test/r1': async () => htmlReponse(pageLd('https://site.test/i/p.jpg')) });
  faux.REPONSES.rpc = async (nom) => (nom === 'is_allowed' ? { data: true, error: null } : { data: null, error: { code: '23514', message: 'new row for relation "assistant_journal" violates check constraint "assistant_journal_outil_check"' } });
  const r = await handler(requete('POST', { texte: corpsApercu(['https://site.test/r1', 'https://site.test/r2']) }));
  const t = await r.text();
  assert.deepEqual([r.status, JSON.parse(t), reserves().length, appelsFetch.length, faux.MAJ.length, t.includes('23514'), t.includes('check constraint')], [502, { erreur: 'serveur' }, 1, 0, 0, false, false], 'la validation des adresses a eu lieu (une reservation tentee), rien d autre ; le message SQL ne sort jamais');
  remise(); routeur({ 'https://site.test/r1': async () => htmlReponse(pageLd('https://site.test/i/p.jpg')) });
  faux.REPONSES.rpc = async (nom) => (nom === 'is_allowed' ? { data: true, error: null } : { data: null, error: null });
  const q = await handler(requete('POST', { texte: corpsApercu(['https://site.test/r1']) }));
  assert.deepEqual([q.status, await lire(q), appelsFetch.length, faux.MAJ.length], [429, { erreur: 'quota', quota: 2 }, 0, 0], 'S-15 : le 429 ecrit par la passerelle porte quota ; le client dit « Quota du jour atteint : photos indisponibles. »');
});
