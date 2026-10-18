# Passerelle de l'assistant — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une seule clé Anthropic, côté serveur, qui sert tous les comptes admis de `mitsu` sans que personne ne configure quoi que ce soit ; l'app n'appelle plus jamais `api.anthropic.com`.

**Architecture:** Une fonction Supabase `assistant` (Deno) = un fichier d'entrée `index.ts` + un module PUR `logique.js` (liste blanche, plafonds, quota, CORS, statuts, journal) testé sous Node ; une table `public.assistant_journal` sans accès client (migration `0004`, preuve) ; côté app un module `src/domain/passerelle.js` (`appelerAssistant`) qui remplace les en-têtes et l'URL Anthropic dans `recherche-web.js`, `creation-ia.js` et `llm.js`, avec une issue `non_connecte` ; Réglages sans clé ; passe unique qui efface la clé locale.

**Tech Stack:** PWA sans build (modules ES natifs), suite navigateur `tests/index.html` (lanceur `node .superpowers/sdd/2026-10-18-passerelle-assistant/suite.cjs 8086`), `node --test tools/*.test.mjs`, Supabase Edge Functions (Deno 2.1 compatible), CLI Supabase 2.121.0 (`~/.local/bin/supabase`, session de Neegan), Anthropic Messages API.

**Spec:** `docs/superpowers/specs/2026-10-18-passerelle-assistant-design.md` (rév. 1, § 0 décisions de Neegan ; § 3 P-1…P-7 ; § 5 erreurs ; § 9 décisions tranchées le 18 octobre : CLI par le contrôleur, quota 60/jour, `claude-sonnet-5-5`, origine = site public seul).

## Global Constraints

- Branche `passerelle-assistant`, worktree `~/projects/mistu-passerelle`, base `main` `cdbd6e0`. Serveur `python3 -m http.server 8086` (lancé). Jamais `~/projects/mistu`.
- **P-1** : aucune clé réelle nulle part (fichiers, tests, journaux, rapports, chat). Les tests utilisent `sk-factice-…` pour les FAUX serveurs Anthropic seulement ; la fonction lit `Deno.env.get('ANTHROPIC_API_KEY')`, jamais un fichier.
- **P-6** : zéro réseau dans les suites : `fetch` injecté partout ; `logique.js` n'importe aucune API Deno (`Deno.*`), aucun `npm:` : il tourne sous Node tel quel (`import` relatif depuis `tools/assistant-logique.test.mjs`).
- Total épinglé `tests/tests.js:210` (2632 à `cdbd6e0`) relu dans « obtenu » à chaque tâche ; `sw.js VERSION = 'cuisine-os-v0.8.0-N'` (N = tâche), `APP_VERSION = '0.8.0'` (T3 ; pins `v0\.7\.0` → `v0\.8\.0` dans `tests/ajouter.js`, `tests/sync-l3.js`, `tests/recherche-web.js`, `tests/assistant-compte.js`, `tests/creer-ia.js`), `SHELL` + `./src/domain/passerelle.js`.
- Caractères invisibles : jamais `grep` (fonction → ugrep UTF-8, faux vert) ; commande Python de la ligne 21 de `docs/superpowers/plans/2026-10-17-assistant-par-le-compte.md`, extraite par script. Commits ASCII sans accents, fichiers nommés, trailer du modèle réel. Jamais réécrire l'historique. Push = Neegan.
- Les faits Supabase/Anthropic qui fondent ce plan (fiche du 18 octobre, revue par le contrôleur) : Verify JWT de la plateforme peut refuser le `OPTIONS` sans `Authorization` → déployer `--no-verify-jwt` et vérifier la session en code ; `getUser()` = un appel réseau à Auth (accepté : ~50-100 ms) ; secrets auto-injectés `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` (JSON) et legacy `SUPABASE_SERVICE_ROLE_KEY` (valide jusqu'à fin 2026) ; idle timeout 150 s → 504, wall clock 400 s, CPU 2 s hors I/O, mémoire 256 Mo ; CORS = `OPTIONS` traité en premier ; `private` n'est pas joignable par PostgREST → table du journal dans `public`, RLS activée SANS règle, `revoke all … from anon, authenticated` (seule la clé secrète écrit) ; Anthropic : `x-api-key` toujours accepté, en-tête `anthropic-dangerous-direct-browser-access` sans objet côté serveur, `temperature`/`top_p`/`top_k` non par défaut → 400 sur Sonnet 5.5 (donc retirés), `web_search_20250305` toujours valide, requête ≤ 32 Mo. `mitsu` utilise les NOUVELLES clés API (`sb_publishable_…` dans `src/sync/config.js:9`) : la fonction lit d'abord `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` (JSON injecté), les noms legacy restent en repli.

## Review Focus

1. **Un appel sans session ou hors liste dépense la clé** (401/403 avant tout `fetch` Anthropic ; `OPTIONS` ne dépense rien) → T1 (logique) + T2 (ordre des gardes) + T5 (sondes réelles).
2. **Un champ hostile du client atteint Anthropic** (`model`, `temperature`, `tools` sur `creation`, clés inconnues) → T1 liste blanche par outil, tests par outil.
3. **Le journal garde du contenu** (demande, réponse, clé, erreur brute) → T1 `ligneJournal` n'accepte que des compteurs ; test « aucune chaîne du corps dans la ligne ».
4. **L'app appelle encore `api.anthropic.com`** (chemin oublié : extraction, « Tester », recherche) → T3 : le faux `fetch` rougit sur tout hôte ≠ `/functions/v1/assistant` ; `git grep ANTHROPIC_MESSAGES_URL src` = vide.
5. **La clé locale survit** (IndexedDB `assistant_config.data.api_key`, `settings.llm`) → T4 passe unique d'effacement, test « après init, aucune ligne ne porte une clé ».

---

### Task 1 : Le module pur de la fonction + ses tests Node

**Files:**
- Create: `supabase/functions/assistant/logique.js`, `tools/assistant-logique.test.mjs`

**Interfaces (Produces):**
```js
export const OUTILS = Object.freeze(['recherche-web', 'creation', 'extraction']);
export const LIMITES = Object.freeze({ corps: 512 * 1024, corpsExtraction: 8 * 1024 * 1024, maxTokens: 16000, quotaJour: 60, attenteMs: 120000, reponse: 2 * 1024 * 1024 });
export function origineAdmise(origine, admises) → boolean            // admises = ['https://neegans.github.io'] (secret ASSISTANT_ORIGINES, virgules) ; comparaison exacte
export function entetesCors(origine, admises) → objet d'en-têtes       // Access-Control-Allow-Origin = origine si admise, sinon absent ; Allow-Headers 'authorization, apikey, content-type, x-client-info' ; Allow-Methods 'POST, OPTIONS' ; Vary 'Origin'
export function lireDemande(texte, { outil, modele, maxTokens }) → { ok: true, corps } | { ok: false, statut: 400|413|422, raison }
  // texte = corps brut ; borne par outil (corps / corpsExtraction) ; JSON objet nu ; outil ∈ OUTILS ; corps.corps = objet nu ;
  // liste blanche : system (string ≤ 20000), messages (tableau 1..20 de { role: 'user'|'assistant', content: string | tableau de blocs { type:'text', text } | { type:'image', source:{ type:'base64', media_type ∈ image/jpeg|png|webp|gif, data } } — images seulement pour 'extraction' }),
  // max_tokens (entier 1..maxTokens, défaut 4000), tools (pour 'recherche-web' seulement : tableau de 1 objet { type: 'web_search_20250305', name: 'web_search', max_uses ≤ 5, user_location ? }) ;
  // model TOUJOURS forcé = modele ; temperature/top_p/top_k/metadata/stream/stop_sequences IGNORÉS ; toute autre clé ignorée.
export function decisionQuota(appelsDuJour, quotaJour) → { ok: true } | { ok: false, statut: 429, raison: 'quota' }
export function statutRelaye(statutAnthropic) → statut HTTP renvoyé à l'app (identique : 200, 400, 401→502 (clé serveur), 403, 404→502, 413, 429, 500→502, 529→503 ; autre → 502)
export function ligneJournal({ ownerId, outil, statut, usage, dureeMs, octets, maintenant }) → { owner_id, outil, statut, jetons_entree, jetons_sortie, duree_ms, octets, jour }  // entiers seulement ; jamais une chaîne du corps
export function corpsErreur(raison, extra = {}) → { erreur: raison, ...extra }  // forme stable renvoyée à l'app : { erreur: 'non_connecte'|'non_admis'|'quota'|'requete'|'trop_lourd'|'delai'|'serveur'|'origine' }
```

- [ ] **Step 1 : tests rouges** — `tools/assistant-logique.test.mjs` (Node `node:test`, `assert/strict`) :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTILS, LIMITES, origineAdmise, entetesCors, lireDemande, decisionQuota, statutRelaye, ligneJournal, corpsErreur } from '../supabase/functions/assistant/logique.js';

const MODELE = 'claude-sonnet-5-5';
const lire = (objet, outil = 'creation', extra = {}) => lireDemande(typeof objet === 'string' ? objet : JSON.stringify(objet), { outil, modele: MODELE, maxTokens: LIMITES.maxTokens, ...extra });
const CREATION = { corps: { system: 'Tu es…', messages: [{ role: 'user', content: 'saumon fenouil' }], max_tokens: 16000 } };

test('origines : comparaison exacte, sans chemin ni sous-domaine', () => {
  const admises = ['https://neegans.github.io'];
  assert.equal(origineAdmise('https://neegans.github.io', admises), true);
  for (const o of ['https://neegans.github.io/', 'http://neegans.github.io', 'https://evil.neegans.github.io', 'https://neegans.github.io.evil.com', '', null, undefined, 'null']) assert.equal(origineAdmise(o, admises), false, String(o));
  assert.equal(origineAdmise('http://localhost:8086', admises), false, 'localhost refusé sans secret');
  assert.equal(origineAdmise('http://localhost:8086', ['https://neegans.github.io', 'http://localhost:8086']), true);
});
test('CORS : en-têtes pour une origine admise, aucun Allow-Origin sinon', () => {
  const h = entetesCors('https://neegans.github.io', ['https://neegans.github.io']);
  assert.equal(h['Access-Control-Allow-Origin'], 'https://neegans.github.io');
  assert.equal(h['Access-Control-Allow-Headers'], 'authorization, apikey, content-type, x-client-info');
  assert.equal(h['Access-Control-Allow-Methods'], 'POST, OPTIONS');
  assert.equal(h.Vary, 'Origin');
  assert.equal('Access-Control-Allow-Origin' in entetesCors('https://evil.example', ['https://neegans.github.io']), false);
});
test('lireDemande : liste blanche, modèle forcé, champs interdits ignorés', () => {
  const r = lire({ corps: { ...CREATION.corps, model: 'claude-opus-5-5', temperature: 1, top_p: 0.5, top_k: 3, stream: true, metadata: { user_id: 'x' }, stop_sequences: ['x'], inconnu: 1 } });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.corps).sort(), ['max_tokens', 'messages', 'model', 'system']);
  assert.equal(r.corps.model, MODELE);
  assert.equal(r.corps.max_tokens, 16000);
});
test('lireDemande : refus de forme (400) et bornes (422)', () => {
  for (const [nom, texte] of [['pas du JSON', '{'], ['tableau', '[]'], ['nu', 'null'], ['corps absent', '{}'], ['corps chaîne', '{"corps":"x"}'], ['messages vides', JSON.stringify({ corps: { messages: [] } })], ['rôle inconnu', JSON.stringify({ corps: { messages: [{ role: 'system', content: 'x' }] } })], ['contenu objet', JSON.stringify({ corps: { messages: [{ role: 'user', content: {} }] } })], ['bloc inconnu', JSON.stringify({ corps: { messages: [{ role: 'user', content: [{ type: 'tool_use' }] }] } })]]) {
    const r = lire(texte); assert.equal(r.ok, false, nom); assert.equal(r.statut, 400, nom);
  }
  assert.deepEqual([lire({ corps: { messages: [{ role: 'user', content: 'x' }], max_tokens: 16001 } }).statut, lire({ corps: { messages: [{ role: 'user', content: 'x' }], max_tokens: 0 } }).statut, lire({ corps: { system: 'x'.repeat(20001), messages: [{ role: 'user', content: 'x' }] } }).statut, lire({ corps: { messages: Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' })) } }).statut], [422, 422, 422, 422]);
  assert.equal(lire({ corps: { messages: [{ role: 'user', content: 'x' }] } }).corps.max_tokens, 4000, 'défaut 4000');
  assert.equal(lire({ corps: { messages: [{ role: 'user', content: 'x' }], max_tokens: 2.5 } }).statut, 400, 'entier exigé');
});
test('lireDemande : outil', () => {
  assert.equal(lire(CREATION, 'inconnu').statut, 400);
  assert.equal(lire(CREATION, undefined).statut, 400);
  assert.deepEqual(OUTILS, ['recherche-web', 'creation', 'extraction']);
});
test('lireDemande : tools seulement pour recherche-web, forme fermée', () => {
  const outil = { type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'CA', timezone: 'America/Toronto' } };
  const web = lire({ corps: { ...CREATION.corps, tools: [outil] } }, 'recherche-web');
  assert.equal(web.ok, true); assert.deepEqual(web.corps.tools, [outil]);
  assert.equal('tools' in lire({ corps: { ...CREATION.corps, tools: [outil] } }, 'creation').corps, false, 'création : tools retirés sans refus');
  assert.equal(lire({ corps: { ...CREATION.corps, tools: [{ type: 'computer_20250124', name: 'x' }] } }, 'recherche-web').statut, 400, 'autre outil refusé');
  assert.equal(lire({ corps: { ...CREATION.corps, tools: [{ ...outil, max_uses: 50 }] } }, 'recherche-web').statut, 422, 'max_uses > 5');
  assert.equal(lire({ corps: { ...CREATION.corps, tools: [outil, outil] } }, 'recherche-web').statut, 422, 'un seul outil');
});
test('lireDemande : images seulement pour extraction, types fermés, taille', () => {
  const img = (data = 'AAAA', media_type = 'image/jpeg') => ({ role: 'user', content: [{ type: 'text', text: 'Extrais' }, { type: 'image', source: { type: 'base64', media_type, data } }] });
  assert.equal(lire({ corps: { messages: [img()] } }, 'extraction').ok, true);
  assert.equal(lire({ corps: { messages: [img()] } }, 'creation').statut, 400, 'image hors extraction');
  assert.equal(lire({ corps: { messages: [img('AAAA', 'image/svg+xml')] } }, 'extraction').statut, 400, 'svg refusé');
  assert.equal(lire({ corps: { messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://x' } }] }] } }, 'extraction').statut, 400, 'source url refusée');
  const gros = JSON.stringify({ corps: { messages: [{ role: 'user', content: 'x'.repeat(LIMITES.corps + 1) }] } });
  assert.equal(lire(gros, 'creation').statut, 413, 'création > 512 Kio');
  assert.equal(lire(gros, 'extraction').ok, true, 'extraction accepte jusqu à 8 Mio');
  assert.equal(lire(JSON.stringify({ corps: { messages: [{ role: 'user', content: 'x'.repeat(LIMITES.corpsExtraction + 1) }] } }), 'extraction').statut, 413);
});
test('lireDemande : propriétés héritées et __proto__ ignorées', () => {
  const r = lire('{"__proto__":{"corps":{"messages":[{"role":"user","content":"x"}]}}}');
  assert.equal(r.ok, false); assert.equal(r.statut, 400);
  assert.equal(Object.prototype.corps, undefined);
});
test('quota', () => {
  assert.deepEqual(decisionQuota(59, 60), { ok: true });
  assert.deepEqual(decisionQuota(60, 60), { ok: false, statut: 429, raison: 'quota' });
  assert.deepEqual(decisionQuota(0, 0), { ok: false, statut: 429, raison: 'quota' });
  assert.deepEqual(decisionQuota(NaN, 60), { ok: false, statut: 429, raison: 'quota' }, 'inconnu = refus');
});
test('statuts relayés : la clé serveur ne devient jamais une clé refusée côté app', () => {
  assert.deepEqual([200, 400, 401, 403, 404, 413, 429, 500, 529, 302, 999].map(statutRelaye), [200, 400, 502, 403, 502, 413, 429, 502, 503, 502, 502]);
});
test('journal : compteurs seulement, jamais une chaîne du corps', () => {
  const l = ligneJournal({ ownerId: '00000000-0000-0000-0000-000000000001', outil: 'creation', statut: 200, usage: { input_tokens: 900, output_tokens: 700 }, dureeMs: 12345.6, octets: 2048, maintenant: '2026-10-18T15:13:01.000Z' });
  assert.deepEqual(l, { owner_id: '00000000-0000-0000-0000-000000000001', outil: 'creation', statut: 200, jetons_entree: 900, jetons_sortie: 700, duree_ms: 12345, octets: 2048, jour: '2026-10-18' });
  const l2 = ligneJournal({ ownerId: 'u', outil: 'recherche-web', statut: 502, usage: { input_tokens: 'sk-factice-clef', output_tokens: null }, dureeMs: -1, octets: 'x', maintenant: '2026-10-18T23:59:59.999Z' });
  assert.deepEqual([l2.jetons_entree, l2.jetons_sortie, l2.duree_ms, l2.octets, l2.jour], [null, null, 0, null, '2026-10-18']);
  assert.equal(JSON.stringify(l2).includes('sk-factice'), false);
  for (const v of Object.values(l)) assert.ok(v === null || typeof v === 'number' || /^[0-9a-f-]{36}$|^[a-z-]+$|^\d{4}-\d{2}-\d{2}$/.test(String(v)));
});
test('corpsErreur : forme stable', () => { assert.deepEqual(corpsErreur('quota', { quota: 60 }), { erreur: 'quota', quota: 60 }); });
```

- [ ] **Step 2 : rouge** (`node --test tools/assistant-logique.test.mjs`, module absent). **Step 3 : code** `supabase/functions/assistant/logique.js` — module ES PUR (aucun `Deno`, aucun import) :

```js
// Logique pure de la passerelle de l'assistant (spec 2026-10-18-passerelle-assistant § 2-5). Tourne sous Node (tests) et sous Deno (index.ts).
// Le client est une DONNÉE HOSTILE : liste blanche par outil, modèle forcé, plafonds, propriétés propres seulement. Le journal ne porte que des compteurs.
export const OUTILS = Object.freeze(['recherche-web', 'creation', 'extraction']);
export const LIMITES = Object.freeze({ corps: 512 * 1024, corpsExtraction: 8 * 1024 * 1024, maxTokens: 16000, quotaJour: 60, attenteMs: 120000, reponse: 2 * 1024 * 1024, system: 20000, messages: 20, maxUses: 5 });
const TYPES_IMAGE = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const OUTIL_WEB = 'web_search_20250305';
const own = (o, k) => (o && typeof o === 'object' && !Array.isArray(o) && Object.hasOwn(o, k) ? o[k] : undefined);
const objetNu = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

export function origineAdmise(origine, admises) {
  return typeof origine === 'string' && origine !== '' && Array.isArray(admises) && admises.includes(origine);
}
export function entetesCors(origine, admises) {
  const h = { 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
  if (origineAdmise(origine, admises)) h['Access-Control-Allow-Origin'] = origine;
  return h;
}
const refus = (statut, raison) => ({ ok: false, statut, raison });
function bloc(b, outil) {
  if (!objetNu(b)) return null;
  const type = own(b, 'type');
  if (type === 'text') { const t = own(b, 'text'); return typeof t === 'string' ? { type: 'text', text: t } : null; }
  if (type === 'image' && outil === 'extraction') {
    const s = own(b, 'source'); if (!objetNu(s) || own(s, 'type') !== 'base64') return null;
    const mt = own(s, 'media_type'), data = own(s, 'data');
    if (!TYPES_IMAGE.includes(mt) || typeof data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
    return { type: 'image', source: { type: 'base64', media_type: mt, data } };
  }
  return null;
}
export function lireDemande(texte, { outil, modele, maxTokens = LIMITES.maxTokens } = {}) {
  if (!OUTILS.includes(outil)) return refus(400, 'outil');
  if (typeof texte !== 'string') return refus(400, 'forme');
  const borne = outil === 'extraction' ? LIMITES.corpsExtraction : LIMITES.corps;
  if (texte.length > borne) return refus(413, 'trop_lourd');
  let enveloppe; try { enveloppe = JSON.parse(texte); } catch { return refus(400, 'forme'); }
  const corps = own(enveloppe, 'corps');
  if (!objetNu(corps)) return refus(400, 'forme');
  const out = { model: modele };
  const system = own(corps, 'system');
  if (system !== undefined) { if (typeof system !== 'string') return refus(400, 'forme'); if (system.length > LIMITES.system) return refus(422, 'bornes'); out.system = system; }
  const msgs = own(corps, 'messages');
  if (!Array.isArray(msgs) || msgs.length < 1) return refus(400, 'forme');
  if (msgs.length > LIMITES.messages) return refus(422, 'bornes');
  out.messages = [];
  for (const m of msgs) {
    if (!objetNu(m)) return refus(400, 'forme');
    const role = own(m, 'role'), content = own(m, 'content');
    if (role !== 'user' && role !== 'assistant') return refus(400, 'forme');
    if (typeof content === 'string') { out.messages.push({ role, content }); continue; }
    if (!Array.isArray(content) || content.length < 1) return refus(400, 'forme');
    const blocs = content.map((b) => bloc(b, outil));
    if (blocs.some((b) => b === null)) return refus(400, 'forme');
    out.messages.push({ role, content: blocs });
  }
  const mt = own(corps, 'max_tokens');
  if (mt === undefined) out.max_tokens = 4000;
  else if (!Number.isInteger(mt)) return refus(400, 'forme');
  else if (mt < 1 || mt > maxTokens) return refus(422, 'bornes');
  else out.max_tokens = mt;
  if (outil === 'recherche-web') {
    const tools = own(corps, 'tools');
    if (tools !== undefined) {
      if (!Array.isArray(tools)) return refus(400, 'forme');
      if (tools.length !== 1) return refus(422, 'bornes');
      const t = tools[0];
      if (!objetNu(t) || own(t, 'type') !== OUTIL_WEB || own(t, 'name') !== 'web_search') return refus(400, 'forme');
      const mu = own(t, 'max_uses');
      if (mu !== undefined && (!Number.isInteger(mu) || mu < 1 || mu > LIMITES.maxUses)) return refus(422, 'bornes');
      const outilNu = { type: OUTIL_WEB, name: 'web_search' };
      if (mu !== undefined) outilNu.max_uses = mu;
      const loc = own(t, 'user_location');
      if (loc !== undefined) {
        if (!objetNu(loc) || own(loc, 'type') !== 'approximate') return refus(400, 'forme');
        const l = { type: 'approximate' };
        for (const k of ['country', 'timezone', 'city', 'region']) { const v = own(loc, k); if (v !== undefined) { if (typeof v !== 'string' || v.length > 64) return refus(400, 'forme'); l[k] = v; } }
        outilNu.user_location = l;
      }
      out.tools = [outilNu];
    }
  }
  return { ok: true, corps: out };
}
export function decisionQuota(appelsDuJour, quotaJour) {
  return Number.isInteger(appelsDuJour) && Number.isInteger(quotaJour) && appelsDuJour < quotaJour ? { ok: true } : { ok: false, statut: 429, raison: 'quota' };
}
export function statutRelaye(s) {
  if (s === 200 || s === 400 || s === 403 || s === 413 || s === 429) return s;
  if (s === 529) return 503;
  return 502;   // 401 (clé serveur refusée), 404, 5xx, redirections : panne de la passerelle, jamais « ta clé »
}
const entierOuNul = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
export function ligneJournal({ ownerId, outil, statut, usage, dureeMs, octets, maintenant }) {
  return { owner_id: ownerId, outil, statut, jetons_entree: entierOuNul(own(usage, 'input_tokens')), jetons_sortie: entierOuNul(own(usage, 'output_tokens')), duree_ms: Math.max(0, Math.floor(Number(dureeMs) || 0)), octets: entierOuNul(octets), jour: String(maintenant).slice(0, 10) };
}
export function corpsErreur(raison, extra = {}) { return { erreur: raison, ...extra }; }
```

- [ ] **Step 4 : vert** (`node --test tools/*.test.mjs` : 45 + les nouveaux). **Step 5 : commit** `Passerelle 1 : logique pure de la fonction (liste blanche, quota, CORS, statuts, journal) et tests Node`

---

### Task 2 : La fonction `index.ts`, la migration `0004`, sa preuve, le README

**Files:**
- Create: `supabase/functions/assistant/index.ts`, `supabase/functions/assistant/deno.json`, `supabase/migrations/0004_assistant_journal.sql`, `supabase/proofs/0004_assistant_journal.sql`
- Modify: `supabase/README.md` (étape « 10. La passerelle de l'assistant »), `tools/generer-migrations.test.mjs` (tests de forme de `0004` et du README), `.gitignore` : `supabase/.temp/` (état local du CLI : `linked-project.json`, `cli-latest` ; posé au commit du plan)

**Interfaces (Produces):** `POST {SUPABASE_URL}/functions/v1/assistant` avec `Authorization: Bearer <access_token>`, `apikey: <clé publique>`, `content-type: application/json`, corps `{ "outil": "recherche-web"|"creation"|"extraction", "corps": { …Messages sans model… } }` → statut relayé + corps JSON d'Anthropic tel quel (200/400/403/413/429) ou `{ erreur }` (401 `non_connecte`, 403 `non_admis` | `origine`, 413 `trop_lourd`, 422 `bornes`, 429 `quota`, 502 `serveur`, 504 `delai`) ; `GET` → `{ modele, quotaJour }` (sans appel Anthropic, session exigée). `OPTIONS` → 204 + CORS.

- [ ] **Step 1 : tests rouges** (Node, `tools/generer-migrations.test.mjs`, bloc « 0004 et passerelle ») : `0004` existe, contient `create table public.assistant_journal`, `enable row level security`, aucune `create policy`, `revoke all on public.assistant_journal from anon, authenticated;`, un index `(owner_id, jour)`, une vue `public.assistant_usage_jour` avec `revoke` idem ; la preuve finit par `rollback;` et ne contient aucune adresse réelle ; `index.ts` n'importe que `./logique.js` et `npm:@supabase/supabase-js@2` (version épinglée `@2.95.0` ou plus — relire la doc CORS : `corsHeaders` existe à partir de 2.95.0, mais on n'en a pas besoin), ne contient ni `sk-`, ni `Deno.serve(` ABSENT (on l'utilise : vérifier sa présence), ni `anthropic-dangerous-direct-browser-access`, ni `console.log(` d'un corps ; README : étape 10 avec « `--no-verify-jwt` », « ANTHROPIC_API_KEY », « OPTIONS », « 0004 ».
- [ ] **Step 2 : rouge.** **Step 3 : code** —

`supabase/migrations/0004_assistant_journal.sql` (à ajout seul, une transaction) :
```sql
-- 0004 — journal de la passerelle de l'assistant (spec 2026-10-18-passerelle-assistant § 4). Compteurs seulement : jamais de contenu.
-- Aucun client ne lit ni n'écrit cette table : RLS activée SANS règle + revoke ; seule la fonction « assistant » écrit, par la clé secrète du projet.
begin;
create table public.assistant_journal (
  id bigserial primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  outil text not null check (outil in ('recherche-web', 'creation', 'extraction')),
  statut integer not null,
  jetons_entree integer,
  jetons_sortie integer,
  duree_ms integer not null default 0,
  octets integer,
  jour date not null,
  cree_le timestamptz not null default now()
);
create index assistant_journal_owner_jour on public.assistant_journal (owner_id, jour);
alter table public.assistant_journal enable row level security;
revoke all on public.assistant_journal from anon, authenticated;
revoke all on sequence public.assistant_journal_id_seq from anon, authenticated;
create view public.assistant_usage_jour with (security_invoker = true) as
  select owner_id, jour, count(*) as appels, coalesce(sum(jetons_entree), 0) as jetons_entree, coalesce(sum(jetons_sortie), 0) as jetons_sortie
  from public.assistant_journal group by owner_id, jour;
revoke all on public.assistant_usage_jour from anon, authenticated;
commit;
```
`supabase/proofs/0004_assistant_journal.sql` (même squelette que `0003` : table `pg_temp.preuve`, verdicts, `rollback;`) : 1.01 table présente + RLS ; 1.02 aucune policy ; 1.03 `has_table_privilege('anon'|'authenticated', 'public.assistant_journal', 'select, insert, update, delete')` = false ; 1.04 index ; 1.05 vue présente, aucun privilège client ; 2.01 sous `set local role authenticated` + jwt d'un compte de preuve : `select count(*) from public.assistant_journal` LÈVE 42501 (attrapé) ; 2.02 `insert` lève aussi ; 3.01 sous `postgres` : insert d'une ligne de preuve puis `select appels from assistant_usage_jour` = 1 ; `999 BILAN` ; `rollback`.

`supabase/functions/assistant/deno.json` : `{ "imports": { "@supabase/supabase-js": "npm:@supabase/supabase-js@2.95.0" } }` (épinglée ; relire la dernière 2.x sur npm au moment de T2 et l'écrire ici).

`supabase/functions/assistant/index.ts` :
```ts
// Passerelle de l'assistant (spec 2026-10-18-passerelle-assistant). Ordre des gardes : OPTIONS → origine → méthode → session → liste admise → corps → quota → Anthropic.
// Jamais : la clé dans une réponse ou un journal ; un corps de demande ou de réponse dans le journal ; un appel Anthropic avant la dernière garde.
import { createClient } from '@supabase/supabase-js';
import { LIMITES, OUTILS, corpsErreur, decisionQuota, entetesCors, ligneJournal, lireDemande, origineAdmise, statutRelaye } from './logique.js';

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const env = (k: string) => Deno.env.get(k) ?? '';
const ORIGINES = (env('ASSISTANT_ORIGINES') || 'https://neegans.github.io').split(',').map((s) => s.trim()).filter(Boolean);
const MODELE = env('ASSISTANT_MODELE') || 'claude-sonnet-5-5';
const QUOTA = Number.parseInt(env('ASSISTANT_QUOTA_JOUR') || String(LIMITES.quotaJour), 10);
const cleSecrete = (): string => {
  try { const j = JSON.parse(env('SUPABASE_SECRET_KEYS') || '[]'); const k = Array.isArray(j) ? j.find((x: { api_key?: string }) => typeof x?.api_key === 'string')?.api_key : null; if (k) return k; } catch { /* legacy */ }
  return env('SUPABASE_SERVICE_ROLE_KEY');
};
const clePublique = (): string => {
  try { const j = JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '[]'); const k = Array.isArray(j) ? j.find((x: { api_key?: string }) => typeof x?.api_key === 'string')?.api_key : null; if (k) return k; } catch { /* legacy */ }
  return env('SUPABASE_ANON_KEY');
};
const json = (statut: number, corps: unknown, entetes: Record<string, string>) => new Response(JSON.stringify(corps), { status: statut, headers: { ...entetes, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

Deno.serve(async (req: Request): Promise<Response> => {
  const origine = req.headers.get('origin') ?? '';
  const cors = entetesCors(origine, ORIGINES);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!origineAdmise(origine, ORIGINES)) return json(403, corpsErreur('origine'), cors);
  if (req.method !== 'POST' && req.method !== 'GET') return json(405, corpsErreur('methode'), cors);
  const jeton = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jeton || !/^[A-Za-z0-9._-]+$/.test(jeton)) return json(401, corpsErreur('non_connecte'), cors);
  const url = env('SUPABASE_URL');
  const commeUtilisateur = createClient(url, clePublique(), { global: { headers: { Authorization: `Bearer ${jeton}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u, error: eu } = await commeUtilisateur.auth.getUser(jeton);
  if (eu || !u?.user?.id) return json(401, corpsErreur('non_connecte'), cors);
  // La liste admise : la même règle que la synchronisation (is_allowed() lit l'adresse du jeton), appelée COMME l'utilisateur.
  const { data: admis, error: ea } = await commeUtilisateur.rpc('is_allowed');
  if (ea || admis !== true) return json(403, corpsErreur('non_admis'), cors);
  if (req.method === 'GET') return json(200, { modele: MODELE, quotaJour: QUOTA }, cors);
  const texte = await req.text();
  let enveloppe: { outil?: unknown } = {};
  try { enveloppe = JSON.parse(texte); } catch { return json(400, corpsErreur('requete'), cors); }
  const outil = typeof enveloppe?.outil === 'string' && OUTILS.includes(enveloppe.outil) ? enveloppe.outil : '';
  const lu = lireDemande(texte, { outil, modele: MODELE, maxTokens: LIMITES.maxTokens });
  if (!lu.ok) return json(lu.statut, corpsErreur(lu.statut === 413 ? 'trop_lourd' : lu.statut === 422 ? 'bornes' : 'requete'), cors);
  const admin = createClient(url, cleSecrete(), { auth: { persistSession: false, autoRefreshToken: false } });
  const jour = new Date().toISOString().slice(0, 10);
  const { count, error: ec } = await admin.from('assistant_journal').select('id', { count: 'exact', head: true }).eq('owner_id', u.user.id).eq('jour', jour);
  if (ec) return json(502, corpsErreur('serveur'), cors);
  const q = decisionQuota(count ?? NaN, QUOTA);
  if (!q.ok) return json(429, corpsErreur('quota', { quota: QUOTA }), cors);
  // Réservation : la ligne est écrite AVANT l'appel (statut 0 = en vol) ; mise à jour après. Un plantage laisse une ligne « en vol » qui compte.
  const debut = Date.now();
  const { data: ins, error: ei } = await admin.from('assistant_journal').insert(ligneJournal({ ownerId: u.user.id, outil, statut: 0, usage: null, dureeMs: 0, octets: texte.length, maintenant: new Date().toISOString() })).select('id').single();
  if (ei || !ins?.id) return json(502, corpsErreur('serveur'), cors);
  const ctl = new AbortController(); const minuterie = setTimeout(() => ctl.abort(), LIMITES.attenteMs);
  let statut = 504; let corpsReponse = ''; let usage: unknown = null;
  try {
    const r = await fetch(ANTHROPIC, { method: 'POST', redirect: 'error', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, body: JSON.stringify(lu.corps) });
    statut = statutRelaye(r.status);
    corpsReponse = await r.text();
    if (corpsReponse.length > LIMITES.reponse) { statut = 502; corpsReponse = ''; }
    if (r.status === 200) { try { usage = JSON.parse(corpsReponse)?.usage ?? null; } catch { statut = 502; corpsReponse = ''; } }
    else if (statut === 502 || statut === 503) corpsReponse = '';   // jamais le message brut d'une panne (il peut nommer la clé)
  } catch { statut = ctl.signal.aborted ? 504 : 502; corpsReponse = ''; }
  finally { clearTimeout(minuterie); }
  await admin.from('assistant_journal').update(ligneJournal({ ownerId: u.user.id, outil, statut, usage, dureeMs: Date.now() - debut, octets: texte.length, maintenant: new Date().toISOString() })).eq('id', ins.id);
  if (!corpsReponse) return json(statut, corpsErreur(statut === 504 ? 'delai' : 'serveur'), cors);
  return new Response(corpsReponse, { status: statut, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
});
```
Précisions : `is_allowed()` est déjà exécutable par `authenticated` (`0001` l. 22 : `grant execute on function public.is_allowed() to authenticated`) : rien à ajouter dans `0004` ; le `select … head: true` avec `count: 'exact'` passe par PostgREST avec la clé secrète (la table est en `public`, RLS sans règle : le rôle de service la contourne) ; `redirect: 'error'` ; aucun `console.log`. Le `GET` sert à Réglages (modèle en service) et à une sonde sans dépense.

`supabase/README.md` étape 10 : secrets (nom, où, jamais en fichier), `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt` (préalable : `supabase login` dans Terminal), coller `0004` puis sa preuve, sondes sans dépense (`OPTIONS` → 204 ; `POST` sans jeton → 401 ; `GET` avec un jeton de session → `{ modele, quotaJour }`), `supabase secrets set ASSISTANT_QUOTA_JOUR=…` pour changer le quota sans redéploiement ; rotation de la clé = remplacer le secret, rien d'autre.

- [ ] **Step 4 : vert** (tests Node) ; `deno` absent du Mac : la **syntaxe** d'`index.ts` est vérifiée par `node --check` IMPOSSIBLE (TS) → vérifier par `npx -y -p typescript@5.6.3 tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck supabase/functions/assistant/index.ts` avec un `deno.d.ts` minimal déclarant `Deno.env.get` et `Deno.serve` (fichier `supabase/functions/assistant/deno.d.ts`, 6 lignes, commité) — si `npx` ne peut pas télécharger (réseau), le dire et laisser la vérification au déploiement (le CLI bundle et refuse une syntaxe fausse). **Step 5 : commit** `Passerelle 2 : fonction assistant (index.ts), migration 0004 journal, preuve, README etape 10`

---

### Task 3 : Le client — `src/domain/passerelle.js`, recherche web, création, extraction, « Tester »

**Files:**
- Create: `src/domain/passerelle.js`, `tests/passerelle.js`
- Modify: `src/domain/llm.js` (retirer `ANTHROPIC_MESSAGES_URL`, `anthropicHeaders` ; `AnthropicProvider` devient `PasserelleProvider` : `complete()` via `appelerAssistant('extraction', …)` ; `providerFrom(settings, { session })` rend `PasserelleProvider` si une session existe, sinon `NoneProvider` ; `name` reste `'anthropic'` pour les gardes des écrans), `src/domain/recherche-web.js` (`chercherRecettesWeb(args, deps)` : plus de `cfg` → `deps.session` ; `non_connecte` sans session ; appel par `appelerAssistant('recherche-web', corps, deps)` ; classements : 401 → `non_connecte`, 403 → `non_admis`, 429 avec `erreur: 'quota'` → `quota`, 413 → `requete`, 504 → `delai`, 502/503 → `serveur`), `src/domain/creation-ia.js` (`creerRecetteIA` idem), `src/sync/auth.js` (exporter `sessionCourante()` → `{ access_token, user } | null`, sans réseau : `client.auth.getSession()`), `src/model/schema.js` (`APP_VERSION = '0.8.0'`), pins, `sw.js` (`SHELL` + `./src/domain/passerelle.js`, `-3`), `tests/recherche-web.js`, `tests/creer-ia.js`, `tests/ajouter.js` (extraction), `tests/tests.js`

**Interfaces (Produces):**
```js
// src/domain/passerelle.js — pur, fetch injecté, jamais de clé.
export const CHEMIN_ASSISTANT = '/functions/v1/assistant';
export function urlAssistant(config = currentConfig()) → `${config.url}${CHEMIN_ASSISTANT}` | null
export async function appelerAssistant(outil, corps, { fetch, session, config, signal, tentativeMs, corpsMax }) → { statut, corps: objet | null, raison: 'non_connecte'|'non_admis'|'quota'|'requete'|'trop_lourd'|'delai'|'serveur'|'reseau'|'reponse_illisible'|null, quota }
  // sans session (pas de access_token) → { statut: 0, raison: 'non_connecte' } SANS fetch ; sinon POST urlAssistant avec { ...OPTIONS_FETCH, redirect: 'error', headers: { 'content-type': 'application/json', apikey: config.anonKey, authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ outil, corps }) }, corps lu en flux et borné (lireBornee), JSON ; 200 → { statut: 200, corps } ; { erreur } → raison ; délai/abandon → 'delai'/'annule' ; TypeError → 'reseau'.
```

- [ ] **Step 1 : tests rouges** — `tests/passerelle.js` (`runPasserelleTests({ eq, ok })`) : sans session → `non_connecte`, 0 fetch ; avec session : URL = `https://ybdooerfeziiabsbfxtb.supabase.co/functions/v1/assistant`, en-têtes `authorization` Bearer + `apikey` = `SUPABASE.prod.anonKey`, JAMAIS `x-api-key`, `redirect: 'error'`, `credentials: 'omit'`, corps `{ outil, corps }` ; statuts → raisons (401, 403 `non_admis`, 429 `{ erreur:'quota', quota: 60 }` → `quota` + `quota: 60`, 413, 422 → `requete`, 502, 504 → `delai`, 200 corps JSON) ; corps > `corpsMax` → `reponse_illisible` ; `TypeError` → `reseau` ; abandon → `annule` ; `JSON.stringify(résultat)` ne contient jamais `access_token`. Puis dans `tests/recherche-web.js` et `tests/creer-ia.js` : remplacer les fixtures `cfg: { api_key: 'sk-factice-…' }` par `session: { access_token: 'jeton-factice', user: { id: 'u1', email: 'a@exemple.invalid' } }` ; chaque assertion qui lisait `appels[0].options.headers['x-api-key']` lit désormais `authorization` ; toute requête vers un hôte ≠ `…/functions/v1/assistant` fait rougir (`ok(appels.every(a => a.url.endsWith(CHEMIN_ASSISTANT)))`) ; `git grep -n "api.anthropic.com\|x-api-key\|anthropic-dangerous" src tests` → seulement `tests/passerelle.js` (assertion d'absence) ; extraction (`tests/ajouter.js` si un test couvre `extractRecipeFromImages`, sinon en ajouter un dans `tests/passerelle.js`) : `PasserelleProvider.complete()` poste `outil: 'extraction'` avec les blocs image ; « Tester » (Réglages) disparaît (T4).
- [ ] **Step 2 : rouge.** **Step 3 : code** — `passerelle.js` calqué sur le transport de `recherche-web.js` (`OPTIONS_FETCH`, `lireBornee`, `signalDelai`, `ctl.abort()` en `finally`, corps d'erreur JAMAIS relayé sauf le champ `erreur` de la passerelle) ; `recherche-web.js` et `creation-ia.js` gardent TOUTE leur logique (demande, validation, issues) et ne changent que le transport (≈ 30 lignes chacun) ; `llm.js` : `PasserelleProvider` ; `providerFrom(settings, { session } = {})` ; les écrans passent `{ session: ctx.session }` (T4 fournit `ctx.session`). Aucune autre surface ne lit `settings.llm.api_key`.
- [ ] **Step 4 : vert**, pins `0.8.0`, `SHELL`, `-3`, total. **Step 5 : commit** `Passerelle 3 : l app appelle la passerelle (session, apikey publique), plus jamais api.anthropic.com`

---

### Task 4 : Réglages sans clé, gardes « Connecte-toi », passe d'effacement, `ctx.session`

**Files:**
- Modify: `src/ui/settings.js` (la section « Assistant IA » : deux états — connecté : « L’assistant est actif pour {adresse}. Modèle en service : {modele}. Quota : {n} appels par jour. » (par `GET` de la passerelle, `fetch` injecté, affiché « … » en attendant, « indisponible » sur erreur) ; non connecté : « Connecte-toi pour utiliser l’assistant. » + bouton « Se connecter » (= `demarrerConnexion(auth)` existant) — plus de champs fournisseur/modèle/clé/URL, plus de « Tester », plus de confirmation « Retirer… »), `src/ui/state.js` + `src/app.js` (`ctx.session` = `sessionCourante()` relue à chaque rendu de route et sur `auth.onChange`), `src/ui/search.js`, `src/ui/creer-ia.js`, `src/ui/recipe-edit.js`, `src/ui/import.js` (garde : sans session → carte « Connecte-toi pour utiliser l’assistant. » + « Se connecter », aucun appel ; `non_admis` → « Ce compte n’a pas accès à l’assistant. » ; `quota` → « Tu as atteint la limite du jour pour l’assistant ({n} appels). »), `src/model/repo.js` (passe unique `effacerCleLocale()` dans `init()` : si `assistant_config.llm.data.api_key` non vide → écrire la ligne avec `api_key: ''` (origine `local`, pour qu'elle parte au compte et efface la clé partout) ; garde `sync_state.cle_locale_effacee = 1` ; `settings.llm` ignoré), `src/i18n/en.js`, `tests/assistant-compte.js` (les blocs qui testaient le formulaire de clé : retournés en assertions sur les DEUX états et sur la passe d'effacement ; les blocs de synchronisation de `assistant_config` restent : le magasin existe toujours), `tests/sync-l3.js:1600` (rendu Réglages), `sw.js -4`, `tests/tests.js`

- [ ] **Step 1 : tests rouges** : Réglages non connecté (texte + bouton, aucun champ `input[type=password]` dans la section, `git grep -n "type: 'password'" src/ui/settings.js` vide) ; connecté : `GET` factice `{ modele: 'claude-sonnet-5-5', quotaJour: 60 }` → texte exact ; `GET` 403 → « Ce compte n’a pas accès à l’assistant. » ; passe d'effacement : une base avec `assistant_config.llm.data.api_key = 'sk-factice-vieille'` → après `init()`, `api_key === ''`, une entrée d'outbox (origine `local`) pour `assistant_config`, garde posée, seconde `init()` n'écrit rien ; gardes des quatre écrans sans session (0 appel) ; `search.js` : `recherche_desactivee`/`cle_refusee` disparaissent des issues possibles (la passerelle les classe `requete`/`serveur`) — adapter les boucles d'issues des tests web ; mutants : garde retirée sur un écran → le faux `fetch` voit un appel → rouge.
- [ ] **Step 2 : rouge.** **Step 3 : code.** **Step 4 : vert**, `-4`, total, `en.js` couverture (test T4 du lot 2). **Step 5 : commit** `Passerelle 4 : Reglages sans cle, gardes Connecte-toi, passe d effacement de la cle locale, ctx.session`

---

### Task 5 : Déploiement, sondes réelles sans dépense, clôture

**Files:** `supabase/proofs/RESULTATS-mitsu.md` (section « Passerelle `assistant` » : déploiement, sondes, preuve `0004`), `CLAUDE.md` (section du lot : pour toi, où, ce qui marche, non prouvé, dettes, gestes), `STATE.md`, `docs/architecture.md`, spec § 10 (rulings R-PAS-n), `sw.js -5` si `src/` touché.

- [ ] **Step 1 (contrôleur)** : `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt` (depuis le worktree ; sans `config.toml`, le CLI déploie par API) ; relire `supabase functions list --project-ref …` (version, `verify_jwt: false`).
- [ ] **Step 2 (contrôleur, sans dépense)** : `curl -i -X OPTIONS -H 'Origin: https://neegans.github.io' -H 'Access-Control-Request-Method: POST' https://ybdooerfeziiabsbfxtb.supabase.co/functions/v1/assistant` → 204 + `Access-Control-Allow-Origin: https://neegans.github.io` ; même `OPTIONS` avec `Origin: https://evil.example` → pas d'Allow-Origin ; `POST` sans jeton → 401 `{"erreur":"non_connecte"}` ; `POST` avec `Origin` refusée → 403 `origine` ; `POST` avec un jeton bidon → 401. Consigner dans RESULTATS.
- [ ] **Step 3 (Neegan)** : coller `0004` puis sa preuve (comme `0003`) ; dire le BILAN.
- [ ] **Step 4 (Neegan, preuve réelle sur le site public, après fusion et push)** : connecté, onglet Web « saumon fenouil » → un POST `/functions/v1/assistant` 200, ZÉRO requête vers `api.anthropic.com` ; Réglages dit « actif … claude-sonnet-5-5 … 60 » ; `select owner_id, jour, appels, jetons_entree, jetons_sortie from public.assistant_usage_jour;` dans l'éditeur SQL montre la ligne ; iPhone avec l'autre compte : même chose, sans rien configurer.
- [ ] **Step 5** : docs (faits mesurés seulement ; « non prouvé » : tout ce que Step 4 n'a pas encore mesuré), rulings, dettes (retrait du magasin `assistant_config` ; quotas par jetons ; `pause_turn` non géré par la passerelle (relayé tel quel) ; `getUser()` = un appel réseau par requête ; une ligne « en vol » (statut 0) compte dans le quota si la fonction plante ; CSP `connect-src https:` couvre `*.supabase.co`). **Commit** `Passerelle 5 : cloture, deploiement et sondes consignes, docs`.

---

## Self-review

- **Couverture de la spec** : § 2 (T1-T4), P-1 (T1/T2/T3 : aucun fichier ne porte de clé ; tests), P-2 (T2 ordre des gardes, T5 sondes), P-3 (T1 liste blanche), P-4 (T1 journal), P-5 (T3/T4 issues), P-6 (T1 Node, T3/T4 fetch injecté), P-7 (T5 Step 4), § 4 (T2), § 5 (T3/T4), § 6 (T5, README), § 7 (T1-T5), § 8 dettes (T5).
- **Noms** : `appelerAssistant`, `CHEMIN_ASSISTANT`, `urlAssistant`, `PasserelleProvider`, `providerFrom(settings, { session })`, `sessionCourante`, `lireDemande`, `decisionQuota`, `statutRelaye`, `ligneJournal`, `entetesCors`, `origineAdmise`, `corpsErreur`, `effacerCleLocale` — identiques de T1 à T5.
- **Placeholders** : T1 et T2 portent leur code ; T3 et T4 décrivent les changements de transport et d'écran en nommant chaque fonction et chaque test ; aucun « à compléter ».
- **Review Focus** : 1 → T1/T2/T5 ; 2 → T1 ; 3 → T1 ; 4 → T3 ; 5 → T4.
