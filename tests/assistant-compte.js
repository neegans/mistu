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
  eq([N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'http://api.example.invalid/v1' }), N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'https://u:p@api.example.invalid/v1' }), N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'pas une url' })], [VIDE, VIDE, VIDE], 'normaliser : http hors boucle locale, identifiants, texte libre → configuration ENTIÈRE vidée (S14, R-CPT-4 : jamais de repli vers OpenAI)');
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
  eq(['https://token@h/v1', 'https://:p@h/v1'].map((u) => N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: u })), [VIDE, VIDE], 'normaliser : un identifiant seul, ou un mot de passe seul, vide la configuration entière (S14, R-CPT-4)');
  ok(Object.isFrozen(SYNC_STORES_0001), 'la liste figée de 0001 est gelée');

  // --- R-CPT-4 : une URL refusée ne devient JAMAIS un repli silencieux vers OpenAI (OpenAICompatibleProvider prend
  // https://api.openai.com/v1 quand base_url est vide : la clé d'un Ollama local y partirait). https : tout hôte ;
  // http : boucle locale seulement ; jamais d'identifiants ; une base_url fournie mais refusée vide TOUTE la configuration.
  const oc = (base_url) => ({ provider: 'openai_compatible', model: 'llama3', api_key: 'sk-factice-oc', base_url });
  const garde = (base_url) => ({ provider: 'openai_compatible', model: 'llama3', base_url, api_key: 'sk-factice-oc' });
  eq(['http://localhost:11434/v1', 'http://127.0.0.1:1234/v1', 'https://h/v1'].map((u) => N(oc(u))), ['http://localhost:11434/v1', 'http://127.0.0.1:1234/v1', 'https://h/v1'].map(garde), 'R-CPT-4 : http://localhost, http://127.0.0.1 et https gardés tels quels, configuration intacte');
  eq([new URL('http://[::1]:8080/v1').hostname, N(oc('http://[::1]:8080/v1'))], ['[::1]', garde('http://[::1]:8080/v1')], 'R-CPT-4 : http://[::1] (hostname « [::1] » pour new URL) est la boucle locale : gardé');
  eq(['http://192.168.1.5:11434/v1', 'http://localhost.example.invalid/v1', 'http://localhost:11434@example.invalid/v1', 'ftp://localhost/v1'].map((u) => N(oc(u))), [VIDE, VIDE, VIDE, VIDE], 'R-CPT-4 : http d’un réseau local, faux localhost, identifiants déguisés, autre schéma → configuration vide');
  eq([N({ provider: 'openai_compatible', model: 'm', api_key: 'k' }), N(oc('   ')), N(oc(''))], [{ provider: 'openai_compatible', model: 'm', base_url: '', api_key: 'k' }, garde(''), garde('')], 'R-CPT-4 : base_url absente ou blanche → configuration gardée, base_url vide (défaut du fournisseur), comme avant');
  eq([N(oc(42)), N(oc({ href: 'http://localhost/v1' }))], [VIDE, VIDE], 'R-CPT-4 : une base_url qui n’est pas une chaîne est refusée → configuration vide (jamais un repli silencieux)');
  eq(N({ provider: 'anthropic', model: 'm', api_key: 'k', base_url: 'http://192.168.1.5/v1' }), { provider: 'anthropic', model: 'm', base_url: '', api_key: 'k' }, 'R-CPT-4 : anthropic ignore toute base_url (vidée), la configuration reste');
  const casR4 = [oc('http://localhost:11434/v1'), oc('http://192.168.1.5/v1'), oc('https://u:p@h/v1'), oc(' http://[::1]:8080/v1 ')];
  eq(casR4.map((x) => N(N(x))), casR4.map((x) => N(x)), 'R-CPT-4 : la normalisation reste idempotente (gardée, refusée, identifiants, IPv6 entourée d’espaces)');

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

  // --- T3 : lecture composée, secrets refusés, écriture, passe unique (K-1, § 5.1, § 5.2, § 5.6, S1, F3)
  const { withRepo } = await import('./sync-fixture.js');
  const bus = await import('../src/core/bus.js');
  const { setClockOffset } = await import('../src/sync/clock.js');
  await withRepo(async (repo, db) => {
    eq((await repo.getSettings()).llm, { provider: 'none', model: '', base_url: '', api_key: '' }, 'lecture : sans ligne, configuration vide');
    let levee = null; try { await repo.setSetting('llm', { api_key: 'sk-factice-3' }); } catch (e) { levee = e; }
    ok(!!levee && !(await db.get('settings', 'llm')), 'K-1 : setSetting(llm) lève et n’écrit rien');
    levee = null; try { await repo.getSetting('llm'); } catch (e) { levee = e; }
    ok(!!levee, 'K-1 : getSetting(llm) lève (F15)');
    // Écriture : capturée (fixture = capture posée, user u1), horodatée par syncNow, événements change + settings sans valeur
    const evenements = [];
    const off1 = bus.on('settings', (p) => evenements.push(['settings', p]));
    const off2 = bus.on('change', (p) => evenements.push(['change', p]));
    try {
      // Horodatée par syncNow, pas par l'heure brute : un décalage d'horloge de 2 h est posé autour de l'écriture (nowIso()
      // échouerait). 2 h et non 1 jour : le plancher de syncNow est monotone et survit à setClockOffset(0) — chaque écriture
      // suivante de la suite porterait sinon une heure en avance d'un jour.
      let ligne;
      setClockOffset(7200000);
      try { ligne = await repo.saveAssistantConfig({ provider: 'anthropic', model: ' m ', api_key: ' sk-factice-3 ', base_url: 'https://x.invalid' }); }
      finally { setClockOffset(0); }
      eq([ligne.id, ligne.provider, ligne.model, ligne.api_key, ligne.base_url, typeof ligne.updated_at], ['llm', 'anthropic', 'm', 'sk-factice-3', '', 'string'], 'écriture : ligne normalisée et horodatée');
      ok(Date.parse(ligne.updated_at) - Date.now() > 3600000, 'écriture : horodatée par syncNow (horloge corrigée de +2 h), jamais par l’heure brute');
      eq((await repo.getSettings()).llm, { provider: 'anthropic', model: 'm', base_url: '', api_key: 'sk-factice-3' }, 'lecture : composée depuis assistant_config, sans id ni dates');
      const file = (await db.getAll('outbox')).filter((e) => e.store === 'assistant_config');
      eq(file.map((e) => [e.op, e.id, e.user_id, 'payload' in e]), [['put', 'llm', 'u1', false]], 'écriture : capturée, un put sans copie de la fiche');
      ok(evenements.some(([n, p]) => n === 'change' && p.store === 'assistant_config') && evenements.some(([n, p]) => n === 'settings' && p.key === 'llm' && !('value' in p)), 'écriture : change + settings { key } SANS la valeur (K-2)');
      ok(!JSON.stringify(evenements).includes('sk-factice-3'), 'écriture : aucun événement ne porte la clé');
    } finally { off1(); off2(); }
    // Une ligne settings.llm résiduelle est ignorée à la lecture
    await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', api_key: 'sk-factice-residu' } }] }, origin: 'device' });
    eq((await repo.getSettings()).llm.api_key, 'sk-factice-3', 'lecture : settings.llm résiduel ignoré');
    // Ligne reçue abîmée : la lecture reste saine
    await db.mutate({ puts: { assistant_config: [{ id: 'llm', provider: 'anthropic', model: 7, api_key: 'k\u0007', updated_at: '2026-10-17T10:00:00Z' }] }, origin: 'remote' });
    eq((await repo.getSettings()).llm, { provider: 'anthropic', model: '', base_url: '', api_key: 'k' }, 'lecture : une ligne reçue abîmée est normalisée (F13)');
  });
  // Passe unique § 5.6 : dans l'ordre de boot() — init() SANS capture, puis envoi initial (F3, S10)
  {
    const repoModule = await import('../src/model/repo.js');
    const { envoiInitial } = await import('../src/sync/backfill.js');
    const origine = repoModule.db;
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: ' m ', api_key: ' sk-factice-mac ', base_url: 'https://u:p@x.invalid', extra: 1 }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try {
        await repoModule.init();
        const ligne = await db.get('assistant_config', 'llm');
        eq(ligne, { id: 'llm', provider: 'anthropic', model: 'm', base_url: '', api_key: 'sk-factice-mac', created_at: '2026-10-01T12:00:00.000Z', updated_at: '2026-10-01T12:00:00.000Z' }, 'passe unique : la ligne copiée est la valeur NORMALISÉE (trim, base_url vidée, champ inconnu écarté), ligne entière');
        eq([ligne?.provider, ligne?.api_key, ligne?.updated_at, await db.get('settings', 'llm'), (await db.get('sync_state', 'assistant_config_migre'))?.value, await db.count('outbox')],
          ['anthropic', 'sk-factice-mac', '2026-10-01T12:00:00.000Z', undefined, 1, 0], 'passe unique : copiée avec l’horodatage D’ORIGINE (S1), settings.llm effacé, garde posée, rien en file (init précède la capture)');
        const r = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
        ok(r.tables.includes('assistant_config') && (await db.getAll('outbox')).some((e) => e.store === 'assistant_config' && e.op === 'put' && e.user_id === 'u1'), 'passe unique : c’est l’envoi initial qui met la ligne en file, au nom du compte (F3)');
        await repoModule.init();
        eq((await db.get('assistant_config', 'llm')).updated_at, '2026-10-01T12:00:00.000Z', 'passe unique : idempotente (seconde init)');
      } finally { repoModule.bindDatabase(origine); }
    });
    // Repli 1970 sans horodatage lisible ; rien copié si none / clé vide ; ligne déjà reçue respectée
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-sans-date' } }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq((await db.get('assistant_config', 'llm'))?.updated_at, '1970-01-01T00:00:00.000Z', 'passe unique : sans horodatage lisible → 1970 (toute version du compte gagne)'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'none' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [undefined, undefined], 'passe unique : none → rien copié, settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-vieille' }, updated_at: '2026-10-01T12:00:00.000Z' }], assistant_config: [{ id: 'llm', provider: 'anthropic', model: 'm2', base_url: '', api_key: 'sk-factice-recue', updated_at: '2026-10-17T12:00:00.000Z' }] }, origin: 'remote' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq([(await db.get('assistant_config', 'llm')).api_key, await db.get('settings', 'llm')], ['sk-factice-recue', undefined], 'passe unique : une ligne déjà reçue n’est pas écrasée ; settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
  }
  // T3, durcissement (/verify de l'implémenteur, lentille faux-vert) : trois mutants que le bloc ci-dessus laissait vivre.
  // 1) Origine de la passe : sans capture, « rien en file » vaut même si la passe écrivait en 'local' — capture posée ici
  //    (configSuitLeCompte: () => true, ignoré avant la tâche 4, comme pour l'envoi initial ci-dessus : R-CPT-2).
  // 2) Clé vide sous un vrai fournisseur : rien copié, settings.llm effacé (§ 5.6 « et une api_key non vide »).
  // 3) Horodatage présent mais illisible : repli 1970, jamais la chaîne telle quelle.
  {
    const repoModule = await import('../src/model/repo.js');
    const origine = repoModule.db;
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-capture' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
      try { await repoModule.init(); eq([(await db.get('assistant_config', 'llm'))?.api_key, await db.count('outbox')], ['sk-factice-capture', 0], 'passe unique : origine device — capture posée, la passe ne met rien en file'); }
      finally { uninstallCapture(db); repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: '' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [undefined, undefined], 'passe unique : clé vide → rien copié, settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-date-illisible' }, updated_at: 'pas une date' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq((await db.get('assistant_config', 'llm'))?.updated_at, '1970-01-01T00:00:00.000Z', 'passe unique : horodatage illisible → 1970, jamais la chaîne reçue'); }
      finally { repoModule.bindDatabase(origine); }
    });
    // Fix round 1 : la décision « copier » se prend sur la valeur NORMALISÉE, jamais sur la valeur brute.
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'inconnu', api_key: 'sk-factice-x' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [undefined, undefined], 'passe unique : fournisseur inconnu (clé présente) → rien copié, settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
    // R-CPT-4 : un Ollama local migre avec son URL ; une URL refusée ne migre pas (la clé partirait vers OpenAI).
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'openai_compatible', model: 'llama3', api_key: 'sk-factice-ollama', base_url: 'http://localhost:11434/v1' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [{ id: 'llm', provider: 'openai_compatible', model: 'llama3', base_url: 'http://localhost:11434/v1', api_key: 'sk-factice-ollama', created_at: '2026-10-01T12:00:00.000Z', updated_at: '2026-10-01T12:00:00.000Z' }, undefined], 'passe unique (R-CPT-4) : un Ollama local (http://localhost) migre avec son URL intacte'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'openai_compatible', model: 'llama3', api_key: 'sk-factice-lan', base_url: 'http://192.168.1.5/v1' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [undefined, undefined], 'passe unique (R-CPT-4) : config OpenAI-compatible à URL refusée : non migrée, à retaper (settings.llm effacé)'); }
      finally { repoModule.bindDatabase(origine); }
    });
  }
}
