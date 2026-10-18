// Tests du lot « la configuration de l'assistant suit le compte » (spec 2026-10-17-assistant-par-le-compte).
// Bases jetables seulement ; aucun réseau ; clés FACTICES uniquement.
import { STORES, SYNC_STORES, ARCHIVE_DATA_STORES, DB_VERSION, APP_VERSION, SECRET_SETTING_KEYS } from '../src/model/schema.js';
import { SYNC_STORES_0001 } from '../src/sync/tables.js';

export async function runAssistantCompteTests({ eq, ok }) {
  // --- T1 : schéma (K-9, § 4.1)
  eq([DB_VERSION, APP_VERSION], [3, '0.6.0'], 'T1 : DB_VERSION 3, APP_VERSION 0.6.0');
  eq(STORES.assistant_config, { keyPath: 'id', indexes: [], noDelete: true }, 'T1 : magasin assistant_config, clé id, noDelete');
  eq([SYNC_STORES.length, SYNC_STORES.at(-1)], [26, 'assistant_config'], 'K-9 : 26 magasins synchronisés, assistant_config DERNIER');
  eq(SYNC_STORES.slice(0, 25), [...SYNC_STORES_0001], 'K-9 : les 25 premiers = la liste figée de 0001, dans l’ordre');
  ok(!ARCHIVE_DATA_STORES.includes('assistant_config'), 'K-7 : hors archive');
  eq(SECRET_SETTING_KEYS, ['llm'], 'la liste des réglages secrets reste (filtre des vieilles archives)');
  const ordre = Object.keys(STORES);
  ok(ordre.indexOf('assistant_config') === ordre.indexOf('files') + 1 && ordre.indexOf('settings') === ordre.indexOf('assistant_config') + 1, 'K-9 : déclaré après files, avant settings');

  // --- T1 : normalisation (§ 4.1, S14, F13)
  const A = await import('../src/domain/assistant-config.js');
  const N = A.normaliserConfigAssistant;
  const VIDE = { provider: 'none', model: '', base_url: '', api_key: '' };
  eq(A.LIGNE_ASSISTANT, 'llm', 'T1 : une ligne, id llm');
  eq([N(undefined), N(null), N(42), N('x'), N({})], [VIDE, VIDE, VIDE, VIDE, VIDE], 'normaliser : rien, nul, nombre, chaîne, objet vide → configuration vide');
  eq(N({ provider: 'anthropic', model: ' claude-sonnet-5-5 ', api_key: ' sk-factice-1 ', base_url: 'https://example.invalid/v1' }), { provider: 'anthropic', model: 'claude-sonnet-5-5', base_url: '', api_key: 'sk-factice-1' }, 'normaliser : trim, base_url vidée pour anthropic (S14)');
  eq(N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'https://api.example.invalid/v1' }).base_url, 'https://api.example.invalid/v1', 'normaliser : base_url https gardée pour openai_compatible');
  eq([N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'http://api.example.invalid/v1' }).base_url, N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'https://u:p@api.example.invalid/v1' }).base_url, N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'pas une url' }).base_url], ['', '', ''], 'normaliser : http, identifiants, texte libre → base_url vidée (S14)');
  eq(N({ provider: 'inconnu', model: 'm', api_key: 'k' }), VIDE, 'normaliser : fournisseur inconnu → none, et none vide les champs (K-6)');
  eq(N({ provider: 'none', model: 'm', api_key: 'k', base_url: 'https://x.invalid' }), VIDE, 'normaliser : none vide les trois champs');
  eq(N({ provider: 'anthropic', model: 'a\u200Bb\u0007c', api_key: 'k\u202Ek' }), { provider: 'anthropic', model: 'abc', base_url: '', api_key: 'kk' }, 'normaliser : Cc/Cf retirés (I-H)');
  eq([N({ provider: 'anthropic', model: 'm'.repeat(300), api_key: 'k' }).model.length, N({ provider: 'anthropic', model: 'm', api_key: 'k'.repeat(600) }).api_key.length], [200, 500], 'normaliser : bornes 200 / 500 points de code');
  eq(N({ provider: 'anthropic', model: 7, api_key: ['k'], base_url: {} }), { provider: 'anthropic', model: '', base_url: '', api_key: '' }, 'normaliser : types faux → chaînes vides, jamais une levée');
  eq([A.configVide(VIDE), A.configVide(null), A.configVide({ provider: 'anthropic', api_key: 'k' }), A.configVide({ provider: 'inconnu', api_key: 'k' })], [true, true, false, true], 'configVide : délègue à la normalisation (fournisseur inconnu = vide)');

  // --- Fix 1 : la normalisation est idempotente (N(N(x)) = N(x)) ; le blanc laissé par un invisible retiré, ou par la
  // troncature, ne survit pas.
  const clef = (api_key) => ({ provider: 'anthropic', model: 'm', api_key });
  const bord = [clef('\u200B k'), clef(' \u200B x '), clef('k'.repeat(499) + ' k')];
  eq(bord.map((x) => N(N(x))), bord.map((x) => N(x)), 'normaliser : idempotent (invisible puis espace ; invisible entre deux espaces ; troncature qui finit sur une espace)');
  eq(bord.map((x) => N(x).api_key), ['k', 'x', 'k'.repeat(499)], 'normaliser : aucune espace de tête ni de fin ne survit à la suppression des invisibles ni à la troncature');
  eq(N({ provider: 'anthropic', model: 'm', api_key: '\u200B k' }).api_key === 'k', true, 'normaliser : invisible suivi d’une espace → clé sans espace de tête');

  // --- Fix 2 : bornes par points de code (astral), URL longue, identifiant seul, liste figée
  const astral = N({ provider: 'anthropic', model: '😀'.repeat(300), api_key: 'k' }).model;
  ok(Array.from(astral).length === 200 && astral === '😀'.repeat(200), 'normaliser : 300 emoji → exactement 200 points de code, aucune moitié de paire orpheline');
  const longue = N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'https://api.example.invalid/' + 'a'.repeat(572) }).base_url;
  ok(Array.from(longue).length === 500 && longue.startsWith('https://'), 'normaliser : une URL https de 600 points de code est TRONQUÉE à 500 (et reste une URL https), jamais gardée entière');
  eq(['https://token@h/v1', 'https://:p@h/v1'].map((u) => N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: u }).base_url), ['', ''], 'normaliser : un identifiant seul, ou un mot de passe seul, vide la base_url (S14)');
  ok(Object.isFrozen(SYNC_STORES_0001), 'la liste figée de 0001 est gelée');

  // --- T2 : jamais de suppression d'origine locale (K-6, § 5.4, S6) — garde de COMPORTEMENT dans db.mutate
  const { withDatabase } = await import('./backup.js');
  const T2_STORES = { a: { keyPath: 'id', indexes: [] }, verrou: { keyPath: 'id', indexes: [], noDelete: true } };
  await withDatabase(async (db) => {
    await db.mutate({ puts: { verrou: [{ id: 'llm', api_key: 'sk-factice-2' }], a: [{ id: 'x' }] } });
    let levee = null;
    try { await db.mutate({ deletes: { verrou: ['llm'] } }); } catch (e) { levee = e; }
    ok(levee instanceof Error && /Suppression interdite sur verrou \(noDelete\)/.test(levee.message), 'noDelete : une suppression d’origine local lève, en nommant le magasin');
    levee = null;
    try { await db.mutate({ deletes: { verrou: ['llm'] }, origin: 'device' }); } catch (e) { levee = e; }
    ok(levee instanceof Error && /Suppression interdite sur verrou \(noDelete\)/.test(levee.message), 'noDelete : origine device → lève aussi, même message');
    levee = null;
    try { await db.delete('verrou', 'llm'); } catch (e) { levee = e; }
    ok(!!levee && !!(await db.get('verrou', 'llm')), 'noDelete : db.delete lève et la ligne est intacte');
    await db.mutate({ deletes: { a: ['x'] } });
    eq(await db.get('a', 'x'), undefined, 'noDelete : un autre magasin se supprime normalement');
    await db.mutate({ deletes: { verrou: ['llm'] }, origin: 'remote' });
    eq(await db.get('verrou', 'llm'), undefined, 'noDelete : une suppression d’origine remote (tombale reçue) passe');
    await db.mutate({ puts: { verrou: [{ id: 'llm' }] } });
    await db.mutate({ clearStores: ['verrou'], origin: 'device' });
    eq(await db.count('verrou'), 0, 'noDelete : clearStores reste permis (K-8, clearDevice)');
    // La levée précède la transaction : une capture posée ne voit rien.
    let captures = 0; db.onMutate = () => { captures += 1; return null; };
    try { await db.mutate({ deletes: { verrou: ['llm'] } }); } catch { /* attendu */ }
    eq(captures, 0, 'noDelete : la garde précède onMutate — rien n’entre en file');
    db.onMutate = null;
  }, T2_STORES);
  // Les gestes de conflit refusent ce magasin par son nom (K-5) — avec la CAPTURE posée, pour que « rien en file » soit
  // une mesure et non un vide : sans capture, l'outbox serait vide même si un geste avait écrit.
  const C = await import('../src/sync/conflits.js');
  const { installCapture, uninstallCapture } = await import('../src/sync/outbox.js');
  await withDatabase(async (db) => {
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false });
    try {
      const conflit = { id: 'assistant_config:llm', store: 'assistant_config', record_id: 'llm', local: { id: 'llm', api_key: 'sk-factice-l' }, server: { data: { id: 'llm', api_key: 'sk-factice-s' }, updated_at: '2026-10-17T10:00:00Z', deleted_at: null }, at: 'x', kind: 'donnees' };
      await db.mutate({ puts: { sync_conflicts: [conflit] }, origin: 'device' });
      eq([await C.garderIci(db, conflit), await C.garderAilleurs(db, conflit), await C.ignorerRenvoye(db, conflit)], [false, false, false], 'conflits : les trois gestes refusent assistant_config');
      // ignorerRenvoye refuse déjà un conflit SANS `renvoye` : seule cette fixture (renvoye: true) éprouve sa garde de magasin.
      eq([await C.ignorerRenvoye(db, { ...conflit, renvoye: true }), !!(await db.get('sync_conflicts', conflit.id))], [false, true], 'conflits : ignorerRenvoye refuse aussi un conflit renvoyé de ce magasin, le journal reste');
      eq([await db.get('assistant_config', 'llm'), (await db.getAll('outbox')).length, !!(await db.get('sync_conflicts', conflit.id))], [undefined, 0, true], 'conflits : rien écrit, rien en file (capture posée), le conflit reste au journal');
      // Le vrai magasin (STORES) porte bien noDelete : sa suppression d'origine locale lève, la ligne reste, rien en file.
      await db.mutate({ puts: { assistant_config: [{ id: 'llm', provider: 'none', model: '', base_url: '', api_key: '', updated_at: '2026-10-17T10:00:00Z' }] }, origin: 'device' });
      let levee = null;
      try { await db.delete('assistant_config', 'llm'); } catch (e) { levee = e; }
      ok(levee instanceof Error && /Suppression interdite sur assistant_config \(noDelete\)/.test(levee.message) && !!(await db.get('assistant_config', 'llm')), 'noDelete : le vrai magasin assistant_config refuse db.delete, la ligne est intacte');
      eq((await db.getAll('outbox')).length, 0, 'noDelete : la suppression refusée du vrai magasin n’a rien mis en file');
    } finally { uninstallCapture(db); }
  });
}
