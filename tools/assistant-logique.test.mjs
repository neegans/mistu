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
  assert.equal(h['Access-Control-Max-Age'], '600');
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
  assert.equal(lireDemande(JSON.stringify(CREATION), { modele: MODELE }).statut, 400, 'outil absent');
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
  try {
    Object.defineProperty(Object.prototype, 'corps', { value: { messages: [{ role: 'user', content: 'x' }] }, configurable: true, writable: true });
    assert.equal(lire('{}').statut, 400, 'un corps herite du prototype est ignore');
  } finally { delete Object.prototype.corps; }
  assert.equal(Object.prototype.corps, undefined);
});
test('quota', () => {
  assert.deepEqual(decisionQuota(59, 60), { ok: true });
  assert.deepEqual(decisionQuota(60, 60), { ok: false, statut: 429, raison: 'quota' });
  assert.deepEqual(decisionQuota(0, 0), { ok: false, statut: 429, raison: 'quota' });
  assert.deepEqual(decisionQuota(NaN, 60), { ok: false, statut: 429, raison: 'quota' }, 'inconnu = refus');
  assert.deepEqual(decisionQuota(-5, 60), { ok: false, statut: 429, raison: 'quota' }, 'négatif = refus');
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
test('corpsErreur : forme stable, champ erreur non écrasable', () => {
  assert.deepEqual(corpsErreur('quota', { quota: 60 }), { erreur: 'quota', quota: 60 });
  assert.deepEqual(corpsErreur('quota', { erreur: 'x', quota: 60 }), { erreur: 'quota', quota: 60 });
});
test('lireDemande : max_uses toujours présent (plafond 5 si omis)', () => {
  const r = lire({ corps: { ...CREATION.corps, tools: [{ type: 'web_search_20250305', name: 'web_search' }] } }, 'recherche-web');
  assert.equal(r.ok, true);
  assert.equal(r.corps.tools[0].max_uses, 5);
});
test('lireDemande : formes fermées imbriquées, champs en trop retirés', () => {
  const r = lire({ corps: { messages: [{ role: 'user', content: [{ type: 'text', text: 'a', cache_control: { type: 'ephemeral' }, extra: 1 }], name: 'x', bidon: true }] } }, 'creation');
  assert.equal(r.ok, true);
  assert.deepEqual(r.corps.messages, [{ role: 'user', content: [{ type: 'text', text: 'a' }] }]);
  const img = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA', url: 'https://x' }, cache_control: { type: 'ephemeral' } };
  const e = lire({ corps: { messages: [{ role: 'user', content: [img] }] } }, 'extraction');
  assert.equal(e.ok, true);
  assert.deepEqual(e.corps.messages[0].content, [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }]);
  const outil = { type: 'web_search_20250305', name: 'web_search', max_uses: 2, cache_control: { type: 'ephemeral' }, user_location: { type: 'approximate', country: 'CA', ip: '203.0.113.7' } };
  const w = lire({ corps: { ...CREATION.corps, tools: [outil] } }, 'recherche-web');
  assert.equal(w.ok, true);
  assert.deepEqual(Object.keys(w.corps.tools[0]), ['type', 'name', 'max_uses', 'user_location']);
  assert.deepEqual(Object.keys(w.corps.tools[0].user_location), ['type', 'country']);
});
test('lireDemande : tools hostiles et borne du pays (64 accepté, 65 refusé)', () => {
  const base = { messages: [{ role: 'user', content: 'x' }] };
  assert.equal(lire({ corps: { ...base, tools: {} } }, 'recherche-web').statut, 400, 'tools objet');
  assert.equal(lire({ corps: { ...base, tools: null } }, 'recherche-web').statut, 400, 'tools null');
  const loc = (country) => lire({ corps: { ...base, tools: [{ type: 'web_search_20250305', name: 'web_search', user_location: { type: 'approximate', country } }] } }, 'recherche-web');
  assert.equal(loc('x'.repeat(65)).statut, 400, 'pays de 65 caractères');
  assert.equal(loc('x'.repeat(64)).ok, true, 'pays de 64 caractères accepté');
});
test('lireDemande : données base64 hostiles refusées (espace, saut, tiret, souligné, vide)', () => {
  for (const data of ['AA AA', 'AA\nAA', 'AA-AA', 'AA_AA', '']) {
    const r = lire({ corps: { messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }] }] } }, 'extraction');
    assert.equal(r.statut, 400, JSON.stringify(data));
  }
});
test('lireDemande : plafond serveur, modèle obligatoire (502), ordre des contrôles', () => {
  assert.equal(lire({ corps: { messages: [{ role: 'user', content: 'x' }], max_tokens: 999999 } }, 'creation', { maxTokens: 1e9 }).statut, 422, 'plafond appelant ne relève pas LIMITES.maxTokens');
  assert.equal(lire({ corps: { messages: [{ role: 'user', content: 'x' }], max_tokens: 16001 } }, 'creation', { maxTokens: 'n' }).statut, 422, 'plafond invalide = LIMITES.maxTokens');
  assert.deepEqual(lireDemande(JSON.stringify(CREATION), { outil: 'creation', modele: undefined }), { ok: false, statut: 502, raison: 'serveur' });
  assert.equal(lireDemande(JSON.stringify(CREATION), { outil: 'creation', modele: '' }).statut, 502, 'modèle vide');
  assert.equal(lireDemande('{', { outil: 'creation' }).statut, 502, 'modèle vérifié avant le texte');
  assert.equal(lireDemande('{', { outil: 'inconnu', modele: MODELE }).statut, 400, 'outil vérifié avant le modèle');
});
test('lireDemande : borne réelle en octets (R-T1-1)', () => {
  const euros = '€'.repeat(300000);
  const t = JSON.stringify({ corps: { messages: [{ role: 'user', content: euros }] } });
  assert.equal(lireDemande(t, { outil: 'creation', modele: MODELE }).ok, true, 'sous 512 Ki caractères');
  const octets = new TextEncoder().encode(t).length;
  assert.ok(octets > LIMITES.corps);
  assert.equal(lireDemande(t, { outil: 'creation', modele: MODELE, octets }).statut, 413, 'plus de 512 Kio d octets');
  assert.equal(lireDemande(t, { outil: 'creation', modele: MODELE, octets: -1 }).ok, true, 'octets négatifs ignorés');
});
test('journal : garde-fous des champs (outil, statut, compteurs, durée, date)', () => {
  const base = { ownerId: 'u', outil: 'creation', statut: 200, usage: { input_tokens: 1, output_tokens: 1 }, dureeMs: 1, octets: 1, maintenant: '2026-10-18T15:13:01.000Z' };
  assert.equal(ligneJournal({ ...base, outil: '<script>' }).outil, null, 'outil hors liste');
  assert.equal(ligneJournal({ ...base, statut: 'abc' }).statut, null, 'statut non entier');
  assert.equal(ligneJournal({ ...base, usage: { input_tokens: 1e21, output_tokens: 1 } }).jetons_entree, null, 'compteur hors entier sûr');
  assert.equal(ligneJournal({ ...base, dureeMs: Infinity }).duree_ms, 0, 'durée infinie');
  assert.equal(ligneJournal({ ...base, maintenant: new Date('2026-10-18T23:59:59.999Z') }).jour, '2026-10-18', 'Date acceptée');
  assert.equal(ligneJournal({ ...base, maintenant: 'n importe quoi' }).jour, null, 'date invalide');
});
