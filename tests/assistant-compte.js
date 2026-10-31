// Tests du lot « la configuration de l'assistant suit le compte » (spec 2026-10-17-assistant-par-le-compte).
// Bases jetables seulement ; aucun réseau ; clés FACTICES uniquement.
import { STORES, SYNC_STORES, ARCHIVE_DATA_STORES, DB_VERSION, APP_VERSION, SECRET_SETTING_KEYS } from '../src/model/schema.js';
import { SYNC_STORES_0001 } from '../src/sync/tables.js';

export async function runAssistantCompteTests({ eq, ok }) {
  // --- T1 : schéma (K-9, § 4.1)
  eq([DB_VERSION, APP_VERSION], [6, '0.32.6'], 'T1 (lot UI-1, carnet) : DB_VERSION 6 (index corbeille des livres), APP_VERSION 0.32.6');
  eq(STORES.assistant_config, { keyPath: 'id', indexes: [], noDelete: true }, 'T1 : magasin assistant_config, clé id, noDelete');
  eq([SYNC_STORES.length, SYNC_STORES.slice(-2)], [27, ['assistant_config', 'imports']], 'K-9 (lot A) : 27 magasins synchronisés, assistant_config puis imports DERNIER');
  eq(SYNC_STORES.slice(0, 25), [...SYNC_STORES_0001], 'K-9 : les 25 premiers = la liste figée de 0001, dans l’ordre');
  ok(!ARCHIVE_DATA_STORES.includes('assistant_config'), 'K-7 : hors archive');
  eq(SECRET_SETTING_KEYS, ['llm'], 'la liste des réglages secrets reste (filtre des vieilles archives)');
  const ordre = Object.keys(STORES);
  ok(ordre.indexOf('assistant_config') === ordre.indexOf('files') + 1 && ordre.indexOf('imports') === ordre.indexOf('assistant_config') + 1 && ordre.indexOf('settings') === ordre.indexOf('imports') + 1, 'K-9 : déclaré après files ; puis imports (lot A, dernier synchronisé), puis settings');

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
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true }); // R-CPT-1 : sinon la capture ignore ce magasin et « rien en file » ne mesure plus rien
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
  // La passe d'effacement de la clé locale (Passerelle T4, bloc plus bas) suit la migration dans init() ET, depuis F-9, s'exécute à CHAQUE
  // init() : elle viderait aussitôt la ligne copiée. Ces blocs éprouvent donc la MIGRATION seule (`migrerConfigAssistant`, exportée pour
  // cela) : la ligne copiée reste lisible. La suite des deux passes ensemble est éprouvée dans le bloc d'effacement.
  // Passe unique § 5.6 : dans l'ordre de boot() — init() SANS capture, puis envoi initial (F3, S10)
  {
    const repoModule = await import('../src/model/repo.js');
    const { envoiInitial } = await import('../src/sync/backfill.js');
    const origine = repoModule.db;
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: ' m ', api_key: ' sk-factice-mac ', base_url: 'https://u:p@x.invalid', extra: 1 }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try {
        await repoModule.migrerConfigAssistant();
        const ligne = await db.get('assistant_config', 'llm');
        eq(ligne, { id: 'llm', provider: 'anthropic', model: 'm', base_url: '', api_key: 'sk-factice-mac', created_at: '2026-10-01T12:00:00.000Z', updated_at: '2026-10-01T12:00:00.000Z' }, 'passe unique : la ligne copiée est la valeur NORMALISÉE (trim, base_url vidée, champ inconnu écarté), ligne entière');
        eq([ligne?.provider, ligne?.api_key, ligne?.updated_at, await db.get('settings', 'llm'), (await db.get('sync_state', 'assistant_config_migre'))?.value, await db.count('outbox')],
          ['anthropic', 'sk-factice-mac', '2026-10-01T12:00:00.000Z', undefined, 1, 0], 'passe unique : copiée avec l’horodatage D’ORIGINE (S1), settings.llm effacé, garde posée, rien en file (init précède la capture)');
        const r = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
        ok(r.tables.includes('assistant_config') && (await db.getAll('outbox')).some((e) => e.store === 'assistant_config' && e.op === 'put' && e.user_id === 'u1'), 'passe unique : c’est l’envoi initial qui met la ligne en file, au nom du compte (F3)');
        await repoModule.migrerConfigAssistant();
        eq((await db.get('assistant_config', 'llm')).updated_at, '2026-10-01T12:00:00.000Z', 'passe unique : idempotente (seconde init)');
      } finally { repoModule.bindDatabase(origine); }
    });
    // Repli 1970 sans horodatage lisible ; rien copié si none / clé vide ; ligne déjà reçue respectée
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-sans-date' } }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.migrerConfigAssistant(); eq((await db.get('assistant_config', 'llm'))?.updated_at, '1970-01-01T00:00:00.000Z', 'passe unique : sans horodatage lisible → 1970 (toute version du compte gagne)'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'none' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.migrerConfigAssistant(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [undefined, undefined], 'passe unique : none → rien copié, settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-vieille' }, updated_at: '2026-10-01T12:00:00.000Z' }], assistant_config: [{ id: 'llm', provider: 'anthropic', model: 'm2', base_url: '', api_key: 'sk-factice-recue', updated_at: '2026-10-17T12:00:00.000Z' }] }, origin: 'remote' });
      repoModule.bindDatabase(db);
      try { await repoModule.migrerConfigAssistant(); eq([(await db.get('assistant_config', 'llm')).api_key, await db.get('settings', 'llm')], ['sk-factice-recue', undefined], 'passe unique : une ligne déjà reçue n’est pas écrasée ; settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
  }
  // T3, durcissement (/verify de l'implémenteur, lentille faux-vert) : trois mutants que le bloc ci-dessus laissait vivre.
  // 1) Origine de la passe : sans capture, « rien en file » vaut même si la passe écrivait en 'local' — capture posée ici
  //    (configSuitLeCompte: () => true : un appareil de production, sans quoi la capture écarterait assistant_config et
  //    « rien en file » vaudrait pour une autre raison ; même pose que pour l'envoi initial ci-dessus : R-CPT-2).
  // 2) Clé vide sous un vrai fournisseur : rien copié, settings.llm effacé (§ 5.6 « et une api_key non vide »).
  // 3) Horodatage présent mais illisible : repli 1970, jamais la chaîne telle quelle.
  {
    const repoModule = await import('../src/model/repo.js');
    const origine = repoModule.db;
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-capture' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
      try { await repoModule.migrerConfigAssistant(); eq([(await db.get('assistant_config', 'llm'))?.api_key, await db.count('outbox')], ['sk-factice-capture', 0], 'passe unique : origine device — capture posée, la passe ne met rien en file'); }
      finally { uninstallCapture(db); repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: '' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.migrerConfigAssistant(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [undefined, undefined], 'passe unique : clé vide → rien copié, settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-date-illisible' }, updated_at: 'pas une date' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.migrerConfigAssistant(); eq((await db.get('assistant_config', 'llm'))?.updated_at, '1970-01-01T00:00:00.000Z', 'passe unique : horodatage illisible → 1970, jamais la chaîne reçue'); }
      finally { repoModule.bindDatabase(origine); }
    });
    // Fix round 1 : la décision « copier » se prend sur la valeur NORMALISÉE, jamais sur la valeur brute.
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'inconnu', api_key: 'sk-factice-x' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.migrerConfigAssistant(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [undefined, undefined], 'passe unique : fournisseur inconnu (clé présente) → rien copié, settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
    // R-CPT-4 : un Ollama local migre avec son URL ; une URL refusée ne migre pas (la clé partirait vers OpenAI).
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'openai_compatible', model: 'llama3', api_key: 'sk-factice-ollama', base_url: 'http://localhost:11434/v1' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.migrerConfigAssistant(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [{ id: 'llm', provider: 'openai_compatible', model: 'llama3', base_url: 'http://localhost:11434/v1', api_key: 'sk-factice-ollama', created_at: '2026-10-01T12:00:00.000Z', updated_at: '2026-10-01T12:00:00.000Z' }, undefined], 'passe unique (R-CPT-4) : un Ollama local (http://localhost) migre avec son URL intacte'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'openai_compatible', model: 'llama3', api_key: 'sk-factice-lan', base_url: 'http://192.168.1.5/v1' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.migrerConfigAssistant(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [undefined, undefined], 'passe unique (R-CPT-4) : config OpenAI-compatible à URL refusée : non migrée, à retaper (settings.llm effacé)'); }
      finally { repoModule.bindDatabase(origine); }
    });
  }

  // --- Passerelle T4 : passe d'effacement de la clé locale (R-T4-3). La clé n'est plus lue nulle part (la passerelle tient la
  // sienne côté serveur) : une clé restée dans assistant_config est VIDÉE, par une écriture d'origine 'local' — capturée, donc envoyée au
  // compte, qui efface la clé du serveur et des autres appareils. F-9 : la passe tourne à CHAQUE init() (plus de garde à usage unique) —
  // une ligne-clé reçue APRÈS le premier démarrage (un appareil en ancienne version qui réécrit sa clé, une réception tardive) est effacée
  // au démarrage suivant ; l'idempotence tient à la ligne elle-même, déjà vide : le second init() n'écrit RIEN. La capture est posée AVANT
  // init(), comme app.js la pose (l'écriture est de la personne : sans capture posée d'abord, la ligne vide ne partirait jamais).
  {
    const repoModule = await import('../src/model/repo.js');
    const origine = repoModule.db;
    const GARDE = 'cle_locale_effacee';
    const sansDates = (l) => { const { created_at, updated_at, ...reste } = l; return reste; };
    const VIDE_LIGNE = { id: 'llm', provider: 'none', model: '', base_url: '', api_key: '' };
    const sur = (preparer, test, { prod = true, userId = 'u1' } = {}) => withDatabase(async (db) => {
      await preparer(db);
      repoModule.bindDatabase(db);
      installCapture(db, { getUserId: () => userId, isActivitySynced: () => false, configSuitLeCompte: () => prod });
      try { await test(db); } finally { uninstallCapture(db); repoModule.bindDatabase(origine); }
    });
    const ligne = (extra) => ({ id: 'llm', provider: 'anthropic', model: 'm', base_url: '', api_key: 'sk-factice-vieille', created_at: '2026-10-01T12:00:00.000Z', updated_at: '2026-10-01T12:00:00.000Z', ...extra });
    const poser = (l) => (db) => db.mutate({ puts: { assistant_config: [l] }, origin: 'device' });
    const fichierEntree = async (db) => (await db.getAll('outbox')).filter((e) => e.store === 'assistant_config').map((e) => [e.op, e.id, e.user_id, 'payload' in e]);

    // Une clé locale → ligne vide, UNE entrée d'outbox (origine local), AUCUNE garde ; la seconde init() n'écrit rien
    await sur(poser(ligne()), async (db) => {
      await repoModule.init();
      const apres = await db.get('assistant_config', 'llm');
      eq(sansDates(apres), VIDE_LIGNE, 'effacement : la ligne devient { provider none, model, base_url et api_key vides }');
      ok(Date.parse(apres.updated_at) > Date.parse('2026-10-01T12:00:00.000Z'), 'effacement : horodatée MAINTENANT (la ligne vide bat la vieille clé du compte)');
      eq(await fichierEntree(db), [['put', 'llm', 'u1', false]], 'effacement : UNE entrée d’outbox pour assistant_config — origine local, donc capturée (le compte reçoit la ligne vide)');
      eq(await db.get('sync_state', GARDE), undefined, 'F-9 effacement : plus de garde à usage unique — aucune ligne sync_state.cle_locale_effacee');
      ok(!JSON.stringify(await db.getAll('assistant_config')).includes('sk-factice-vieille') && !JSON.stringify(await db.getAll('outbox')).includes('sk-factice-vieille'), 'effacement : la clé n’est ni dans la ligne ni dans la file');
      const avantSeconde = { ligne: apres, file: await db.getAll('outbox') };
      await repoModule.init();
      eq([await db.get('assistant_config', 'llm'), await db.getAll('outbox')], [avantSeconde.ligne, avantSeconde.file], 'effacement : idempotent — une seconde init() n’écrit rien (ligne identique, même file)');
    });
    // Une configuration sans clé mais avec un fournisseur est vidée aussi (R-T4-3 : api_key non vide OU provider différent de none)
    await sur(poser(ligne({ provider: 'openai_compatible', model: 'llama3', base_url: 'http://localhost:11434/v1', api_key: '' })), async (db) => {
      await repoModule.init();
      eq([sansDates(await db.get('assistant_config', 'llm')), (await fichierEntree(db)).length], [VIDE_LIGNE, 1], 'effacement : un fournisseur sans clé est vidé aussi');
    });
    // Lue BRUTE : une ligne reçue abîmée (fournisseur inconnu, clé gardée) ne se normalise pas en « vide » à la lecture — sa clé est effacée
    await sur(poser({ id: 'llm', provider: 'inconnu', api_key: 'sk-factice-brute', updated_at: '2026-10-01T12:00:00.000Z' }), async (db) => {
      await repoModule.init();
      const apres = await db.get('assistant_config', 'llm');
      eq([sansDates(apres), JSON.stringify(apres).includes('sk-factice-brute'), (await fichierEntree(db)).length], [VIDE_LIGNE, false, 1], 'effacement : une clé sous un fournisseur inconnu (ligne abîmée) est effacée elle aussi, lue brute');
    });
    await sur(poser({ id: 'llm', api_key: 'sk-factice-sans-fournisseur', updated_at: '2026-10-01T12:00:00.000Z' }), async (db) => {
      await repoModule.init();
      eq([sansDates(await db.get('assistant_config', 'llm')), (await fichierEntree(db)).length], [VIDE_LIGNE, 1], 'effacement : une ligne sans fournisseur mais avec une clé est effacée');
    });
    // Pas de ligne : RIEN n'est écrit (aucune ligne créée, aucune entrée de file, aucune garde)
    await sur(async () => {}, async (db) => {
      await repoModule.init();
      eq([await db.getAll('assistant_config'), (await db.getAll('outbox')).length, await db.get('sync_state', GARDE)], [[], 0, undefined], 'F-9 effacement : sans ligne, rien n’est écrit (aucune ligne créée, aucune entrée de file, aucune garde)');
    });
    // Ligne déjà vide : rien n'est réécrit (pas d'horodatage neuf, pas d'entrée de file)
    const dejaVide = ligne({ provider: 'none', model: '', base_url: '', api_key: '' });
    await sur(poser(dejaVide), async (db) => {
      await repoModule.init();
      eq([await db.get('assistant_config', 'llm'), (await db.getAll('outbox')).length, await db.get('sync_state', GARDE)], [dejaVide, 0, undefined], 'F-9 effacement : une ligne déjà vide n’est pas réécrite (même horodatage), 0 entrée de file, aucune garde');
    });
    // Une ligne sans clé ni fournisseur (champs absents, à la façon d'une ligne reçue incomplète) est « déjà vide » aussi : la passe ne la réécrit
    // pas à chaque démarrage (un `undefined !== ''` ferait réécrire — et renvoyer au compte — la même ligne à chaque init()).
    const incomplete = { id: 'llm', provider: 'none', updated_at: '2026-10-01T12:00:00.000Z' };
    await sur(poser(incomplete), async (db) => {
      await repoModule.init(); await repoModule.init();
      eq([await db.get('assistant_config', 'llm'), (await db.getAll('outbox')).length], [incomplete, 0], 'F-9 effacement : une ligne incomplète sans clé ni fournisseur n’est jamais réécrite (deux init(), 0 entrée de file)');
    });
    // F-9 (M6) — le cas qui motive le changement : une ligne-clé REÇUE après le premier démarrage est effacée au démarrage suivant
    await sur(async () => {}, async (db) => {
      await repoModule.init();
      eq([await db.getAll('assistant_config'), (await db.getAll('outbox')).length], [[], 0], 'F-9 premier démarrage : rien à effacer, rien d’écrit');
      await db.mutate({ puts: { assistant_config: [ligne({ api_key: 'sk-factice-tardive', updated_at: '2026-10-02T09:00:00.000Z' })] }, origin: 'remote' });
      eq((await db.get('assistant_config', 'llm')).api_key, 'sk-factice-tardive', 'F-9 : la ligne-clé est bien arrivée (origine remote, rien en file)');
      eq((await db.getAll('outbox')).length, 0, 'F-9 : une réception n’entre pas en file');
      await repoModule.init();
      const apres = await db.get('assistant_config', 'llm');
      eq([sansDates(apres), JSON.stringify(await db.getAll('outbox')).includes('sk-factice-tardive'), await fichierEntree(db)], [VIDE_LIGNE, false, [['put', 'llm', 'u1', false]]], 'F-9 démarrage suivant : la ligne-clé reçue entre-temps est effacée, UNE entrée d’outbox (la ligne vide part au compte)');
      await repoModule.init();
      eq([await db.get('assistant_config', 'llm'), (await db.getAll('outbox')).length], [apres, 1], 'F-9 : le démarrage d’après n’écrit rien (idempotent par la ligne vide)');
    });
    // F-9 : « 0 écriture » MESURÉ au point d'écriture (db.mutate), pas déduit d'une garde
    await sur(async () => {}, async (db) => {
      const vrai = db.mutate.bind(db); let n = 0; db.mutate = (...a) => { n += 1; return vrai(...a); };
      try {
        eq([await repoModule.effacerCleLocale(), n], [false, 0], 'F-9 effacerCleLocale : sans ligne → faux, 0 écriture');
        await poser(ligne())(db); n = 0;
        eq([await repoModule.effacerCleLocale(), n], [true, 1], 'F-9 effacerCleLocale : une ligne-clé → vrai, UNE écriture');
        n = 0;
        eq([await repoModule.effacerCleLocale(), await repoModule.effacerCleLocale(), n], [false, false, 0], 'F-9 effacerCleLocale : la ligne est vide ensuite → faux, faux, 0 écriture');
      } finally { db.mutate = vrai; }
    });
    // F-13 (M11) — appareil JAMAIS connecté (getUserId nul) : l'écriture est quand même capturée, avec un user_id NUL ; l'entrée part sous le
    // PREMIER compte qui se connecte ici (R-L3-24 : `fileDe` garde les entrées sans compte) — la clé locale est effacée du serveur à la première connexion
    await sur(poser(ligne()), async (db) => {
      await repoModule.init();
      eq([sansDates(await db.get('assistant_config', 'llm')), await fichierEntree(db)], [VIDE_LIGNE, [['put', 'llm', null, false]]], 'F-13 effacement sans compte (getUserId nul) : la ligne est vidée et l’entrée d’outbox existe, avec user_id NUL (chemin R-L3-24)');
      const { fileDe } = await import('../src/sync/outbox.js');
      eq([(await fileDe(db, 'u1')).length, (await fileDe(db, 'u2')).length, (await fileDe(db, null)).length], [1, 1, 1], 'F-13 : cette entrée sans compte est dans la file de N’IMPORTE QUEL compte qui se connecte ici (R-L3-24)');
    }, { userId: null });
    // Hors production (localhost) : la clé est effacée ICI, mais la ligne ne part nulle part (K-3)
    await sur(poser(ligne()), async (db) => {
      await repoModule.init();
      eq([sansDates(await db.get('assistant_config', 'llm')), (await db.getAll('outbox')).length], [VIDE_LIGNE, 0], 'effacement : hors production la clé locale est effacée aussi, sans entrée de file (le magasin ne part qu’en production)');
    }, { prod: false });
    // Les deux passes ensemble : un settings.llm jamais migré (clé) → la migration le copie, l'effacement le vide, UNE entrée de file
    await sur(async (db) => { await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-jamais-migre' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' }); }, async (db) => {
      await repoModule.init();
      eq([sansDates(await db.get('assistant_config', 'llm')), await db.get('settings', 'llm'), (await db.get('sync_state', 'assistant_config_migre'))?.value, (await db.get('sync_state', GARDE))?.value, await fichierEntree(db)],
        [VIDE_LIGNE, undefined, 1, undefined, [['put', 'llm', 'u1', false]]], 'migration PUIS effacement : un settings.llm jamais migré ne laisse aucune clé (ni settings ni assistant_config) et envoie la ligne vide au compte (F-9 : aucune garde d’effacement)');
    });
    // L'ordre du démarrage (app.js n'est jamais importé par la suite : il lance l'application à l'import) est lu au SOURCE, comme le câblage
    // de K-12 — c'est un test faible (il ne voit pas l'exécution), mais il fait rougir le retour de installCapture APRÈS repo.init(), qui
    // laisserait la passe d'effacement sans capture : la ligne vide ne partirait jamais au compte.
    {
      const reponse = await fetch(new URL('../src/app.js', import.meta.url), { cache: 'no-store' });
      const code = (await reponse.text()).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
      const captureA = code.indexOf('installCapture(repo.db'); const initA = code.indexOf('await repo.init()');
      ok(reponse.ok && captureA > 0 && initA > 0 && captureA < initA, 'effacement : app.js pose la capture AVANT repo.init() (lu au source, hors commentaires) — sinon la ligne vide de la passe ne serait jamais mise en file');
    }
  }

  // --- T4 : production seulement (K-3, S3) — prédicat injecté, faux par défaut (R-CPT-1)
  const cfgMod = await import('../src/sync/config.js');
  // Ce bloc éprouve le prédicat à hôte explicite. Le défaut sans argument lit location.hostname, qui ne se simule pas
  // dans le navigateur : la valeur par hôte est éprouvée ici, et seule la suite servie sur le site public éprouve le défaut.
  // (Passerelle T4 : le texte K-10 de Réglages, qui lisait ce prédicat, a disparu avec le formulaire de clé.)
  eq([cfgMod.configAssistantSuitLeCompte('neegans.github.io'), cfgMod.configAssistantSuitLeCompte('NEEGANS.GITHUB.IO'), cfgMod.configAssistantSuitLeCompte('localhost'), cfgMod.configAssistantSuitLeCompte('127.0.0.1'), cfgMod.configAssistantSuitLeCompte('')],
    [true, true, false, false, false], 'K-3 : vrai seulement pour les hôtes de production (prod.hosts), insensible à la casse');
  ok(cfgMod.SUPABASE.prod.hosts.length > 0 && cfgMod.SUPABASE.prod.hosts.every((h) => cfgMod.configAssistantSuitLeCompte(h)) && cfgMod.SUPABASE.dev.hosts.every((h) => !cfgMod.configAssistantSuitLeCompte(h)), 'K-3 : chaque hôte de prod.hosts de la configuration suit le compte, aucun hôte de dev.hosts ne le suit (dérivé de la configuration, pas d’une liste copiée)');
  const { tablesAEnvoyer, envoiInitial } = await import('../src/sync/backfill.js');
  const { createPull } = await import('../src/sync/pull.js');
  const { creerTransportFactice } = await import('./transport-factice.js');
  const LIGNE = (k) => ({ id: 'llm', provider: 'anthropic', model: 'm', base_url: '', api_key: k, updated_at: '2026-10-17T10:00:00Z' });
  await withDatabase(async (db) => {
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false }); // défaut : hors production
    await db.mutate({ puts: { assistant_config: [LIGNE('sk-factice-dev')] } });
    eq((await db.getAll('outbox')).length, 0, 'capture : hors production (défaut), assistant_config n’entre pas en file');
    uninstallCapture(db);
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
    await db.mutate({ puts: { assistant_config: [LIGNE('sk-factice-prod')] } });
    eq((await db.getAll('outbox')).map((e) => [e.store, e.op, e.user_id]), [['assistant_config', 'put', 'u1']], 'capture : en production, capturée comme les autres');
    await db.mutate({ puts: { assistant_config: [LIGNE('sk-factice-recu')] }, origin: 'remote' });
    eq((await db.getAll('outbox')).length, 1, 'capture : une réception n’est pas recapturée');
    uninstallCapture(db);
  });
  eq([tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false }).includes('assistant_config'), tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false, configSuitLeCompte: () => true }).includes('assistant_config'), tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => true, configSuitLeCompte: () => true }).length], [false, true, 27], 'envoi initial : hors production exclue ; en production incluse (27 avec l’historique, imports et files)');
  // L'envoi initial lui-même (pas seulement la liste des tables) : la ligne d'ici est mise en file en production, au nom
  // du compte, et la progression « n/total » compte la même liste que celle qui est parcourue.
  await withDatabase(async (db) => {
    await db.mutate({ puts: { assistant_config: [LIGNE('sk-factice-envoi')] }, origin: 'device' });
    const prog = [];
    const r = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true, surProgression: (p) => prog.push(p) });
    eq([r.tables.length, r.tables.slice(-2), prog.every((p) => p.total === 26), (await db.getAll('outbox')).map((e) => [e.store, e.op, e.user_id])], [26, ['assistant_config', 'imports'], true, [['assistant_config', 'put', 'u1']]], 'envoi initial : en production, 26 tables (files comprise depuis L4), assistant_config puis imports (dernière, lot A) sont parcourues, la ligne mise en file au nom du compte, progression sur 26');
  });
  await withDatabase(async (db) => {
    await db.mutate({ puts: { assistant_config: [LIGNE('sk-factice-envoi-dev')] }, origin: 'device' });
    const prog = [];
    const r = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, surProgression: (p) => prog.push(p) });
    eq([r.tables.includes('assistant_config'), prog.every((p) => p.total === 25), await db.count('outbox'), await db.get('sync_state', 'backfill:assistant_config')], [false, true, 0, undefined], 'envoi initial : hors production (défaut), rien en file, aucun marqueur posé, progression sur 25 (imports et files comprises)');
  });
  // Réception : hors production la table n'est pas lue ; en production elle est lue EN DERNIER (K-9)
  const tf = creerTransportFactice({ serveur: true });
  await tf.pousser([{ store: 'assistant_config', id: 'llm', data: LIGNE('sk-factice-serveur'), updated_at: '2026-10-17T10:00:00Z' }]);
  await withDatabase(async (db) => {
    // Capture posée en production : « rien en file » mesure alors l'origine 'remote' de la réception, pas un vide.
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
    try {
      const lues = [];
      const r0 = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', surProgression: (p) => lues.push(p.table) }).recevoir();
      eq([r0.recues, lues.includes('assistant_config'), await db.get('assistant_config', 'llm')], [0, false, undefined], 'réception : hors production, la table n’est ni lue ni écrite');
      lues.length = 0;
      const r1 = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', configSuitLeCompte: () => true, surProgression: (p) => lues.push(p.table) }).recevoir();
      eq([r1.recues, lues.slice(-2), await db.get('assistant_config', 'llm'), (await db.getAll('outbox')).length], [1, ['assistant_config', 'imports'], LIGNE('sk-factice-serveur'), 0], 'réception : en production, assistant_config lue après les 25 de 0001 puis imports EN DERNIER (K-9, lot A), la ligne entière écrite telle quelle, rien en file (capture posée)');
    } finally { uninstallCapture(db); }
  });
  // Le moteur porte le prédicat jusqu'à l'envoi initial ET à la réception (R-CPT-1 : faux par défaut). Sans ce
  // câblage, les deux modules ci-dessus seraient justes et l'application ne les verrait jamais « en production ».
  const { createMoteur } = await import('../src/sync/moteur.js');
  const fenetreM = { addEventListener() {}, removeEventListener() {}, document: { visibilityState: 'visible' } };
  const busM = { on: () => () => {} };
  try {
    for (const suit of [false, true]) {
      const options = suit ? { configSuitLeCompte: () => true } : {};
      // Envoi : la ligne d'ici (écrite sans capture) part par l'envoi initial, en production seulement.
      const tfEnvoi = creerTransportFactice({ serveur: true });
      await withDatabase(async (db) => {
        await db.mutate({ puts: { assistant_config: [LIGNE('sk-factice-moteur-ici')] }, origin: 'device' });
        await createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tfEnvoi, fenetre: fenetreM, bus: busM, ...options }).executer('t');
        eq([tfEnvoi.ligne('assistant_config', 'llm')?.data?.api_key ?? null, tfEnvoi.journal.some((a) => a.appel === 'pousser' && a.rows.some((r) => r.store === 'assistant_config'))], suit ? ['sk-factice-moteur-ici', true] : [null, false], `moteur : envoi initial de assistant_config ${suit ? 'en production' : 'hors production (défaut)'}`);
      });
      // Réception : la ligne du serveur arrive ici, en production seulement.
      const tfRecu = creerTransportFactice({ serveur: true });
      await tfRecu.pousser([{ store: 'assistant_config', id: 'llm', data: LIGNE('sk-factice-moteur-serveur'), updated_at: '2026-10-17T10:00:00Z' }]);
      await withDatabase(async (db) => {
        await createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tfRecu, fenetre: fenetreM, bus: busM, ...options }).executer('t');
        eq([(await db.get('assistant_config', 'llm'))?.api_key ?? null, tfRecu.journal.some((a) => a.appel === 'lire' && a.table === 'assistant_config')], suit ? ['sk-factice-moteur-serveur', true] : [null, false], `moteur : réception de assistant_config ${suit ? 'en production' : 'hors production (défaut)'}`);
      });
    }
  } finally { setClockOffset(0); }

  // --- T5 : jamais de conflit à trancher (K-5, § 5.5), tombale (§ 5.4, S5/F6), S1 « K2 reste partout »
  // Instants FIXES et passés (le plancher monotone de syncNow reste ≈ 2 h en avance après le test T3) : chaque égalité
  // ou inégalité d'instant est fabriquée par `db.mutate` sur des lignes à `updated_at` fixe (F15), jamais par repo.save.
  const { createPush } = await import('../src/sync/push.js');
  const { decider } = await import('../src/sync/pull.js');
  const { appliquerReponse } = await import('../src/sync/reponses.js');
  const H = { t1: '2026-10-17T10:00:00.000Z', t2: '2026-10-17T11:00:00.000Z', t3: '2026-10-17T12:00:00.000Z' };
  const L = (k, t) => ({ id: 'llm', provider: 'anthropic', model: 'm', base_url: '', api_key: k, updated_at: t });
  // decider reste PUR et générique : ses verdicts ne changent pas (F7)
  eq(decider({ locale: L('a', H.t1), distante: { data: L('b', H.t1), updated_at: H.t1, deleted_at: null } }), 'conflit', 'decider : inchangé (égalité différente → conflit) ; la règle du magasin vit dans appliquerPage');
  // S5/F6 : une tombale ne rend JAMAIS 'conflit' — le seul verdict que la règle du magasin change en 'ecrire'. Absente
  // ici, plus récente, égale, plus ancienne : aucune tombale ne peut donc être écrite.
  const tombaleRecue = (t) => ({ data: L('sk-factice-tombale', t), updated_at: t, deleted_at: t });
  eq([decider({ locale: undefined, distante: tombaleRecue(H.t2) }), decider({ locale: L('a', H.t1), distante: tombaleRecue(H.t2) }), decider({ locale: L('a', H.t2), distante: tombaleRecue(H.t2) }), decider({ locale: L('a', H.t3), distante: tombaleRecue(H.t2) })],
    ['ignorer', 'supprimer', 'supprimer', 'conflit_renvoyer'], 'S5 : une tombale ne rend jamais « conflit », donc jamais « ecrire » après la règle du magasin');
  // reponses.js, en unité : l'id réécrit est TOUJOURS celui de l'élément envoyé (revue Neegan 1.3), jamais celui de data.
  {
    const element = { store: 'assistant_config', id: 'llm', data: L('sk-factice-envoye', H.t1), updated_at: H.t1, deleted: false };
    const effets = appliquerReponse({
      lot: { elements: [element], seqs: [7] },
      reponse: { server_time: H.t3, accepted: [], adjusted: [], rejected: [{ store: 'assistant_config', id: 'llm', reason: 'conflit', server: { data: { id: 'autre', provider: 'anthropic', api_key: 'sk-factice-serveur' }, updated_at: H.t2, deleted_at: null } }] },
      entreesParSeq: new Map([[7, { seq: 7, store: 'assistant_config', id: 'llm', op: 'put' }]]),
      fichesLocales: { 'assistant_config:llm': L('sk-factice-envoye', H.t1) },
    });
    eq([effets.retirer, effets.conflits, (effets.reecrire.assistant_config || []).map((x) => [x.id, x.updated_at, x.api_key])], [[7], [], [['llm', H.t2, 'sk-factice-serveur']]], 'reponses : refus conflit → entrée retirée, id forcé à celui de l’élément, heure du serveur, aucun conflit');
  }
  // Ronde 1 : la réécriture exige une data OBJET NU (jamais une chaîne ni un tableau étalés dans le magasin) et DEUX
  // instants lisibles (aucun repli : une fiche sans heure ne se compare à rien). Dans les deux cas : retirer seulement.
  {
    const refus = (data) => [{ store: 'assistant_config', id: 'llm', reason: 'conflit', server: { data, updated_at: H.t2, deleted_at: null } }];
    const effetsDe = ({ element, locale, data }) => appliquerReponse({
      lot: { elements: [element], seqs: [7] },
      reponse: { server_time: H.t3, accepted: [], adjusted: [], rejected: refus(data) },
      entreesParSeq: new Map([[7, { seq: 7, store: 'assistant_config', id: 'llm', op: 'put' }]]),
      fichesLocales: { 'assistant_config:llm': locale },
    });
    const envoye = { store: 'assistant_config', id: 'llm', data: L('sk-factice-envoye', H.t1), updated_at: H.t1, deleted: false };
    const resume = (e) => [e.retirer, e.conflits.length, Object.keys(e.reecrire)];
    eq([effetsDe({ element: envoye, locale: L('sk-factice-envoye', H.t1), data: 'chaîne' }), effetsDe({ element: envoye, locale: L('sk-factice-envoye', H.t1), data: ['sk-factice-tableau'] })].map(resume),
      [[[7], 0, []], [[7], 0, []]], 'reponses : data du serveur chaîne ou tableau → entrée retirée, rien réécrit, aucun conflit');
    const { updated_at: _h, ...sansHeure } = L('sk-factice-sans-heure', H.t1);
    eq(resume(effetsDe({ element: { store: 'assistant_config', id: 'llm', data: sansHeure, deleted: false }, locale: sansHeure, data: L('sk-factice-serveur', H.t2) })),
      [[7], 0, []], 'reponses : fiche locale sans updated_at (élément sans heure) → rien réécrit, aucun conflit (aucun repli sur une heure par défaut)');
  }
  const deuxAppareils = async (scenario) => withRepo(async (repo, dbA) => withDatabase(async (dbB) => {
    const tf = creerTransportFactice({ serveur: true });
    installCapture(dbB, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
    uninstallCapture(dbA); installCapture(dbA, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
    const push = (db) => createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
    const pull = (db) => createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', configSuitLeCompte: () => true }).recevoir();
    try { return await scenario({ dbA, dbB, tf, push, pull, repo }); } finally { uninstallCapture(dbB); }
  }));
  const propre = async (db) => [(await db.getAll('sync_conflicts')).length, (await db.getAll('outbox')).filter((e) => e.store === 'assistant_config').length];
  // 1. Plus récent ailleurs → écrit ici
  await deuxAppareils(async ({ dbA, dbB, push, pull }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-A', H.t1)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-B', H.t2)] } }); await push(dbB);
    await pull(dbA);
    eq([(await dbA.get('assistant_config', 'llm')).api_key, ...(await propre(dbA))], ['sk-factice-B', 0, 0], 'K-5 : plus récent ailleurs → écrit ici, aucun conflit, rien en file');
  });
  // 2. Égalité différente → le COMPTE gagne, sans écran (réception, puis l'envoi qui suit : un réessai idempotent ACCEPTÉ,
  // pas un refus — le refus conflit est le cas 2b)
  await deuxAppareils(async ({ dbA, dbB, push, pull, tf }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-compte', H.t2)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-local', H.t2)] } });
    const rp = await pull(dbB);
    eq([(await dbB.get('assistant_config', 'llm')).api_key, ...(await propre(dbB)), rp.recues], ['sk-factice-compte', 0, 1, 1], 'K-5 réception : égalité différente → la version du compte est écrite ici, comptée en reçues (passeAEcrit invalide le cache), aucun conflit (l’entrée de file locale reste : l’envoi la réglera)');
    const r = await push(dbB);
    eq([r.envoyes, r.conflits, ...(await propre(dbB)), (await dbB.get('assistant_config', 'llm')).api_key, tf.ligne('assistant_config', 'llm').data.api_key], [1, 0, 0, 0, 'sk-factice-compte', 'sk-factice-compte'], 'K-5 envoi après réception : réessai idempotent accepté (envoyes 1, conflits 0) → entrée retirée, aucun conflit journalisé, le compte reste');
  });
  // 2b. Égalité différente, ENVOI d'abord (aucune réception avant) : le refus conflit de l'arbitre réécrit ici la version
  // du compte (reponses.js), comptée en « ajustés » — c'est ce compte qui fait invalider le cache (passeAEcrit).
  await deuxAppareils(async ({ dbA, dbB, push, tf }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-compte', H.t2)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-local', H.t2)] } });
    const r = await push(dbB);
    eq([r.conflits, r.ajustes, ...(await propre(dbB)), await dbB.get('assistant_config', 'llm'), tf.ligne('assistant_config', 'llm').data.api_key], [0, 1, 0, 0, L('sk-factice-compte', H.t2), 'sk-factice-compte'], 'K-5 envoi : égalité différente refusée → la version du compte réécrite ici (ligne entière), comptée en ajustés, aucun conflit, rien en file');
  });
  // 3. Plus récent ici → repart, sans journal. La fiche d'ici est écrite SANS capture (origine device) : seule la remise en
  // file de la réception peut la faire repartir — une entrée de capture laissée par l'écriture la masquerait.
  await deuxAppareils(async ({ dbA, dbB, push, pull }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-vieux', H.t1)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-neuf', H.t3)] }, origin: 'device' });
    await pull(dbB);
    eq([(await dbB.get('assistant_config', 'llm')).api_key, ...(await propre(dbB))], ['sk-factice-neuf', 0, 1], 'K-5 : plus récent ici → conservé, aucun conflit, remis en file par la réception');
    await push(dbB); await pull(dbA);
    eq([(await dbA.get('assistant_config', 'llm')).api_key, ...(await propre(dbA))], ['sk-factice-neuf', 0, 0], 'K-5 : … et il arrive sur l’autre appareil');
  });
  // 4. Refus conflit au push alors que la fiche a BOUGÉ pendant l'aller-retour (R-L3-7, S11) : rien réécrit
  await deuxAppareils(async ({ dbA, dbB, push, tf }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-compte', H.t2)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-perdant', H.t2)] } });
    // simuler l'édition pendant l'aller-retour : le transport pousse puis on modifie la fiche locale avant l'application
    const vraiPousser = tf.pousser.bind(tf);
    tf.pousser = async (rows) => { const rep = await vraiPousser(rows); await dbB.mutate({ puts: { assistant_config: [L('sk-factice-tape-pendant', H.t3)] } }); return rep; };
    let r;
    try { r = await push(dbB); } finally { tf.pousser = vraiPousser; }
    eq([r.conflits, r.ajustes, (await dbB.get('assistant_config', 'llm')).api_key, (await dbB.getAll('sync_conflicts')).length], [0, 0, 'sk-factice-tape-pendant', 0], 'S11 : la fiche a bougé pendant l’aller-retour → la version du serveur n’écrase pas la saisie ; aucun conflit');
    await push(dbB);
    eq(tf.ligne('assistant_config', 'llm').data.api_key, 'sk-factice-tape-pendant', 'S11 : … et la saisie (plus récente) part à son tour');
  });
  // 4b. Même course, mais la saisie faite pendant l'aller-retour est PLUS ANCIENNE que la version du compte : seule la
  // règle « la fiche n'a pas bougé » (R-L3-7) empêche alors la réécriture pendant l'aller-retour. La saisie garde sa
  // propre entrée ; à l'envoi suivant elle est refusée à son tour et, la fiche n'ayant plus bougé, le compte est écrit.
  await deuxAppareils(async ({ dbA, dbB, push, tf }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-compte', H.t2)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-perdant', H.t1)] } });
    const vraiPousser = tf.pousser.bind(tf);
    tf.pousser = async (rows) => { const rep = await vraiPousser(rows); await dbB.mutate({ puts: { assistant_config: [L('sk-factice-tape-pendant', '2026-10-17T10:30:00.000Z')] } }); return rep; };
    let r;
    try { r = await push(dbB); } finally { tf.pousser = vraiPousser; }
    eq([r.conflits, r.ajustes, (await dbB.get('assistant_config', 'llm')).api_key, ...(await propre(dbB))], [0, 0, 'sk-factice-tape-pendant', 0, 1], 'S11 : saisie pendant l’aller-retour, plus ancienne que le compte → pas écrasée pendant l’aller-retour, son entrée reste, aucun conflit');
    const r2 = await push(dbB);
    eq([r2.conflits, r2.ajustes, await dbB.get('assistant_config', 'llm'), ...(await propre(dbB))], [0, 1, L('sk-factice-compte', H.t2), 0, 0], 'S11 : … son envoi est refusé à son tour ; la fiche n’a plus bougé → la version du compte (plus récente) est écrite, rien en file');
  });
  // 5. Tombale reçue : JAMAIS écrite (elle porte l'ancienne clé) ; plus récente → suppression locale d'origine remote
  await deuxAppareils(async ({ dbA, dbB, push, pull, tf }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-ancienne', H.t1)] } }); await push(dbA); await pull(dbB);
    // un autre client (hors de ce code) supprime : le serveur garde data (coalesce) — simulé par le factice
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: L('sk-factice-ancienne', H.t2), updated_at: H.t2, deleted: true }]);
    ok(tf.ligne('assistant_config', 'llm').deleted_at && tf.ligne('assistant_config', 'llm').data.api_key === 'sk-factice-ancienne', 'tombale : le serveur porte deleted_at ET l’ancienne data (comme sync_push)');
    const r = await pull(dbB);
    eq([await dbB.get('assistant_config', 'llm'), ...(await propre(dbB)), r.supprimees], [undefined, 0, 0, 1], 'tombale plus récente → ligne locale SUPPRIMÉE (origine remote, noDelete laisse passer), rien écrit, rien en file');
    // tombale data {} (après purge) : ni erreur ni blocage. Le factice refuse `data: {}` (motif « cle » : un objet sans
    // id) — la tombale part donc sans data, puis la ligne du serveur reçoit `data = {}` (l'objet rendu est la ligne vive).
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: null, updated_at: H.t3, deleted: true }]);
    tf.ligne('assistant_config', 'llm').data = {};
    const r2 = await pull(dbB);
    eq([r2.erreur, await dbB.get('assistant_config', 'llm'), (await dbB.get('sync_state', 'cursor:assistant_config'))?.value, tf.ligne('assistant_config', 'llm').server_seq], [null, undefined, tf.ligne('assistant_config', 'llm').server_seq, 3], 'tombale data {} → pas d’erreur, le curseur avance');
    // tombale PLUS ANCIENNE qu'une saisie locale : remise en file, pas de journal (§ 5.4). Saisie écrite sans capture
    // (origine device) : l'entrée `put` mesurée ne peut venir que de la remise en file de la réception.
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-apres', '2026-10-18T00:00:00.000Z')] }, origin: 'device' });
    eq((await propre(dbB))[1], 0, 'tombale plus ancienne : avant la réception, rien en file (saisie sans capture)');
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: null, updated_at: '2026-10-17T23:00:00.000Z', deleted: true }]);
    tf.ligne('assistant_config', 'llm').data = {};
    ok(tf.ligne('assistant_config', 'llm').updated_at === '2026-10-17T23:00:00.000Z' && tf.ligne('assistant_config', 'llm').deleted_at, 'tombale plus ancienne : le serveur la porte bien (le factice l’a acceptée)');
    await pull(dbB);
    eq([(await dbB.get('assistant_config', 'llm'))?.api_key, (await dbB.getAll('sync_conflicts')).length, (await dbB.getAll('outbox')).some((e) => e.store === 'assistant_config' && e.op === 'put')], ['sk-factice-apres', 0, true], 'tombale plus ancienne → la saisie locale reste et repart, aucun conflit');
  });
  // 5b. Refus conflit au push face à une TOMBALE du serveur : retirer seulement. Sa data porte l'ancienne clé : elle n'est
  // jamais réécrite ici (§ 5.5 « serveur en tombale : retirer seulement »), et la réception applique ensuite la tombale.
  await deuxAppareils(async ({ dbB, push, pull, tf }) => {
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: L('sk-factice-ancienne', H.t1), updated_at: H.t1 }]);
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: L('sk-factice-ancienne', H.t3), updated_at: H.t3, deleted: true }]);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-ici', H.t2)] } });
    const r = await push(dbB);
    eq([r.conflits, r.ajustes, ...(await propre(dbB)), (await dbB.get('assistant_config', 'llm')).api_key], [0, 0, 0, 0, 'sk-factice-ici'], 'K-5 envoi : serveur en tombale → entrée retirée, rien réécrit (l’ancienne clé de la tombale n’arrive pas ici), aucun conflit');
    const r2 = await pull(dbB);
    eq([await dbB.get('assistant_config', 'llm'), r2.supprimees, ...(await propre(dbB))], [undefined, 1, 0, 0], 'K-5 : … puis la réception applique la tombale plus récente (ligne supprimée, origine remote), rien en file');
  });
  // 6. S1 : le serveur porte K2 (tournée) ; une base monte avec K1 dans settings → K2 reste partout
  {
    const repoModule = await import('../src/model/repo.js');
    const origine = repoModule.db;
    const tf = creerTransportFactice({ serveur: true });
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: L('sk-factice-K2', H.t3), updated_at: H.t3 }]);
    await withDatabase(async (db) => {
      // Migration seule (F-9) : ce bloc éprouve l'horodatage D'ORIGINE de la migration. La passe d'effacement (Passerelle T4) viderait
      // aussitôt la ligne, et sa ligne vide, plus récente que K2, effacerait K2 aussi — voir le bloc suivant, qui l'éprouve de bout en bout.
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-K1' }, updated_at: H.t1 }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try {
        await repoModule.migrerConfigAssistant();
        installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
        await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
        const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
        await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', configSuitLeCompte: () => true }).recevoir();
        eq([tf.ligne('assistant_config', 'llm').data.api_key, (await db.get('assistant_config', 'llm')).api_key, r.conflits, (await db.getAll('sync_conflicts')).length], ['sk-factice-K2', 'sk-factice-K2', 0, 0], 'S1 : K1 (horodatage d’origine, plus vieux) ne bat pas K2 ; K2 arrive ici ; aucun conflit');
      } finally { uninstallCapture(db); repoModule.bindDatabase(origine); }
    });
  }
  // 7. Passerelle T4 : la passe d'effacement, de bout en bout. La ligne vide est écrite MAINTENANT : plus récente que toute clé du compte,
  //    elle vide la ligne du serveur (K2 comprise) et celle d'un autre appareil — la clé ne traîne plus nulle part. La capture est posée
  //    AVANT init(), comme app.js (sinon la ligne vide ne partirait jamais).
  {
    const repoModule = await import('../src/model/repo.js');
    const origine = repoModule.db;
    const tf = creerTransportFactice({ serveur: true });
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: L('sk-factice-K2', H.t3), updated_at: H.t3 }]);
    await withDatabase(async (db) => {
      await db.mutate({ puts: { assistant_config: [L('sk-factice-K1', H.t1)] }, origin: 'device' });
      repoModule.bindDatabase(db);
      installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
      try {
        await repoModule.init();
        const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
        const serveur = tf.ligne('assistant_config', 'llm');
        eq([serveur.data.api_key, serveur.data.provider, r.conflits, (await db.get('assistant_config', 'llm')).api_key, (await db.getAll('outbox')).length, (await db.getAll('sync_conflicts')).length], ['', 'none', 0, '', 0, 0], 'effacement de bout en bout : la ligne vide bat K2 sur le serveur, la file est vidée, aucun conflit');
        // Un autre appareil qui porte encore K2 reçoit la ligne vide (plus récente que la sienne) : sa clé disparaît aussi
        await withDatabase(async (dbB) => {
          await dbB.mutate({ puts: { assistant_config: [L('sk-factice-K2', H.t3)] }, origin: 'device' });
          await createPull({ db: dbB, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', configSuitLeCompte: () => true }).recevoir();
          const b = await dbB.get('assistant_config', 'llm');
          eq([b.api_key, b.provider], ['', 'none'], 'effacement de bout en bout : un autre appareil qui porte encore K2 reçoit la ligne vide, sa clé disparaît');
        });
      } finally { uninstallCapture(db); repoModule.bindDatabase(origine); }
    });
  }

  // --- T6 : archives (K-7) et cycle du compte (K-8)
  const B = await import('../src/domain/backup.js');
  await withRepo(async (repo, db) => {
    await repo.saveAssistantConfig({ provider: 'anthropic', model: 'm', api_key: 'sk-factice-archive' });
    await repo.save('books', { id: 'b_arch', title: 'Livre' });
    const archive = await B.createArchive(db, { deviceName: 'Appareil de test' });
    await repo.save('books', { id: 'b_locale', title: 'Locale' }); // fiche locale HORS archive : seul un vrai vidage la fait disparaître
    const texte = new TextDecoder().decode(await archive.blob.arrayBuffer());
    ok(!texte.includes('sk-factice-archive') && !texte.includes('assistant_config'), 'K-7 : ni la clé ni le magasin dans les octets du ZIP');
    const inspection = await B.inspectArchive(await archive.blob.arrayBuffer());
    ok(inspection.ok, 'K-7 : une archive sans ce magasin (comme toute archive d’avant ce lot) reste valide à l’inspection');
    ok(!('assistant_config' in (inspection.payload?.stores || {})), 'K-7 : l’inspection ne connaît pas ce magasin');
    // Une archive fabriquée qui porterait ce magasin est refusée AVANT toute écriture : la configuration ne bouge pas.
    const forgee = { ...inspection, payload: { ...inspection.payload, stores: { ...inspection.payload.stores, assistant_config: [{ id: 'llm', provider: 'anthropic', model: 'm', api_key: 'sk-factice-hostile' }] } } };
    let refus = '';
    try { await B.applyArchive(db, forgee, { mode: 'replace' }); } catch (e) { refus = e.message; }
    ok(refus.includes('Magasin inattendu : assistant_config'), 'K-7 : une archive fabriquée qui porte assistant_config est refusée à la restauration');
    eq((await repo.getSettings()).llm.api_key, 'sk-factice-archive', 'K-7 : … et la configuration n’a pas bougé');
    // La configuration ne prouve rien ici (un remplacement ne la vide jamais) : c'est la fiche locale hors archive, encore
    // là, qui prouve que le refus est tombé AVANT toute écriture.
    ok(!!(await db.get('books', 'b_locale')), 'K-7 : … et la bibliothèque n’a pas été vidée (refus AVANT toute écriture : la fiche locale hors archive est encore là)');
    // remplacement : la ligne reste ; fusion : aussi
    await B.applyArchive(db, inspection, { mode: 'replace' });
    eq((await repo.getSettings()).llm.api_key, 'sk-factice-archive', 'K-7 : une restauration en REMPLACEMENT garde la configuration');
    eq(await db.get('books', 'b_locale'), undefined, 'K-7 : le remplacement a bien vidé la bibliothèque (la fiche locale hors archive a disparu) et seule la configuration est restée');
    await B.applyArchive(db, inspection, { mode: 'merge' });
    eq((await repo.getSettings()).llm.api_key, 'sk-factice-archive', 'K-7 : une fusion aussi');
    ok((await B.verifyRestored(db, inspection, { mode: 'replace' })).ok, 'K-7 : le bilan de restauration reste vert malgré le magasin hors archive');
    eq(B.compterFichesSynchronisees(inspection) >= 1, true, 'K-7 : compterFichesSynchronisees tolère l’absence du magasin');
    // K-8 : effacer l'appareil vide la ligne. La file est vidée par clearDevice lui-même (outbox est dans STORES) et la capture
    // ne lit jamais `clearStores` : le vidage ne peut donc rien mettre en file pour effacer le compte. « 0 » mesure l'état final,
    // pas une absence d'envoi observée (aucun transport ici).
    await repo.clearDevice();
    eq([await db.get('assistant_config', 'llm'), (await db.getAll('outbox')).length, (await repo.getSettings()).llm.provider], [undefined, 0, 'none'], 'K-8 : clearDevice vide assistant_config, la file est vide ensuite et la configuration redevient « aucun »');
  });

  // --- Passerelle T4 : Réglages → Assistant IA (R-T4-2). DEUX états, AUCUN champ : la clé n'existe plus côté app (K-6, K-10, S14 et
  // R-CPT-4 portaient le formulaire de clé, retiré avec lui). Première ligne = à quoi sert la section ; l'état vient d'un GET de la
  // passerelle (fetch INJECTÉ — jamais le réseau), affiché « Vérification de l’assistant… » pendant l'attente ; « L’assistant est actif pour X. »
  // n'est dit qu'APRÈS un GET 200 (F-4 : avant, ou sur un refus, ce serait annoncer un état que personne n'a constaté).
  const S = await import('../src/ui/settings.js');
  const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
  const avantLocale = getUiLocale();
  setUiLocale('fr'); // une suite antérieure peut basculer 'en' ; ce bloc compare des textes français (rendue dans le finally)
  const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
  const JETON = 'jeton-factice-0123'; // jamais un vrai jeton ; il ne doit apparaître dans AUCUN rendu
  const SESSION = { access_token: JETON, user: { id: 'u1', email: 'a@exemple.invalid' } };
  const { SYNC_ROUTE_KEY } = await import('../src/ui/state.js');
  try {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const attendre = async (pred) => { for (let i = 0; i < 100 && !(await pred()); i += 1) await new Promise((r) => setTimeout(r, 5)); return pred(); };
    const reponse = (statut, corps) => ({ ok: statut >= 200 && statut < 300, status: statut, headers: new Headers(), text: async () => JSON.stringify(corps) });
    const monter = (sync, session, deps) => { const sec = S.sectionAssistant({ sync, session }, deps); scene.append(sec); return sec; };
    const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom);
    const compteur = (suite) => { const c = { appels: [], f: null }; c.f = async (url, options) => { c.appels.push({ url, options }); return suite(url, options); }; return c; };
    const ligneEtat = (sec) => sec.querySelector('[data-role="etat-assistant"]');
    const ATTENTE = 'Vérification de l’assistant…';
    const ACTIF = 'L’assistant est actif pour a@exemple.invalid.';
    const finDeLAttente = (sec) => attendre(() => ligneEtat(sec)?.textContent !== ATTENTE);
    const sansChamp = (sec) => sec.querySelectorAll('input, select, textarea').length;
    const U = SESSION.user;

    eq([typeof S.texteAssistant, typeof S.sectionAssistant, typeof S.occupeParAssistant], ['undefined', 'function', 'function'], 'Réglages : texteAssistant (les quatre textes K-10) n’existe plus ; la section et K-12 restent');

    // ÉTAT 1 — sans session : le but d'abord, un bouton, AUCUN champ, AUCUN appel
    {
      const reseau = compteur(async () => reponse(200, {}));
      const connexions = [];
      const auth = { signIn: async () => ({ error: null }) };
      const sec = monter({ auth }, null, { fetch: reseau.f, connecter: (a) => { connexions.push(a); } });
      await tick(); await tick();
      eq(sec.dataset.section, 'assistant', 'sans session : la section reste marquée data-section="assistant" (K-12)');
      eq(sec.querySelector('p')?.textContent, 'Connecte-toi pour utiliser l’assistant.', 'sans session : la première ligne dit à quoi sert la section');
      eq([...sec.querySelectorAll('button')].map((b) => b.textContent), ['Se connecter'], 'sans session : un seul bouton, « Se connecter »');
      eq(sansChamp(sec), 0, 'sans session : aucun champ (ni input, ni select, ni textarea) — plus de fournisseur, de modèle, d’URL ni de clé');
      for (const mot of ['Fournisseur', 'Clé API', 'URL de base', 'Enregistrer', 'Tester', 'Aucun (manuel)', 'Fournisseur-agnostique', 'sauvegardes ZIP', 'Retirer']) ok(!sec.textContent.includes(mot), `sans session : « ${mot} » a disparu`);
      eq(reseau.appels.length, 0, 'sans session : AUCUN appel réseau');
      bouton(sec, 'Se connecter').click(); await tick();
      eq([connexions.length, connexions[0] === auth], [1, true], '« Se connecter » appelle le chemin de la section Compte avec le module d’auth du contexte');
      sec.remove();
      // le chemin par défaut est demarrerConnexion (même geste que « Connexion avec Google ») : signIn du module d'auth, route mémorisée
      const signIns = []; let memorisee = null;
      const sec2 = monter({ auth: { signIn: async () => { signIns.push(1); return { error: null }; } } }, null, { fetch: reseau.f });
      try { bouton(sec2, 'Se connecter').click(); await tick(); await tick(); memorisee = sessionStorage.getItem(SYNC_ROUTE_KEY); }
      finally { try { sessionStorage.removeItem(SYNC_ROUTE_KEY); } catch { /* stockage indisponible */ } }
      eq([signIns.length, typeof memorisee], [1, 'string'], '« Se connecter » (chemin par défaut) : auth.signIn() une fois, la route courante mémorisée pour le retour de Google');
      sec2.remove();
    }

    // Un geste de connexion qui échoue (rejet ou levée) n'échappe jamais d'un onClick : une phrase fixe, jamais le message du fournisseur
    {
      let nonTraites = 0; const surRejet = (e) => { nonTraites += 1; e.preventDefault(); };
      window.addEventListener('unhandledrejection', surRejet);
      try {
        for (const [nom, connecter] of [['rejet', async () => { throw new Error('boom-fournisseur'); }], ['levée', () => { throw new Error('boom-fournisseur'); }]]) {
          const sec = monter({ auth: {} }, null, { fetch: compteur(async () => reponse(200, {})).f, connecter });
          bouton(sec, 'Se connecter').click();
          await tick(); await tick(); await tick();
          const dit = document.querySelector('.toast')?.textContent;
          eq([dit, nonTraites], ['La connexion n’a pas pu démarrer.', 0], `« Se connecter » (${nom}) : phrase fixe, jamais « boom-fournisseur », aucun rejet non traité`);
          sec.remove();
        }
      } finally { window.removeEventListener('unhandledrejection', surRejet); const t = document.querySelector('.toast'); if (t) t.style.display = 'none'; }
    }

    // ÉTAT 2 — avec session : « actif pour <adresse> », puis le GET de la passerelle (« … » pendant l'attente)
    {
      let resoudre; const attente = new Promise((r) => { resoudre = r; });
      const reseau = compteur(() => attente);
      const sec = monter({ user: U, auth: {} }, SESSION, { fetch: reseau.f });
      eq([sec.querySelector('p')?.textContent, ligneEtat(sec)?.textContent, sec.textContent.includes('est actif'), sec.querySelectorAll('button').length], [ATTENTE, ATTENTE, false, 0], 'F-4 avec session : pendant que le GET est en vol, « Vérification de l’assistant… » SEUL — « actif » n’est pas dit avant la réponse');
      eq(reseau.appels.length, 1, 'avec session : un seul GET au rendu');
      const a = reseau.appels[0];
      eq([a.options.method, new URL(a.url).host.endsWith('.supabase.co'), a.url.endsWith('/functions/v1/assistant'), a.options.headers.authorization, 'body' in a.options], ['GET', true, true, 'Bearer ' + JETON, false], 'avec session : GET /functions/v1/assistant avec le jeton de la session, sans corps');
      resoudre(reponse(200, { modele: 'claude-sonnet-5-5', quotaJour: 60 }));
      ok(await finDeLAttente(sec), 'avec session : la ligne d’état se remplit à la réponse');
      eq([sec.querySelector('p').textContent, ligneEtat(sec).textContent, sec.textContent.includes(ATTENTE)], [ACTIF, 'Modèle en service : claude-sonnet-5-5. Quota : 60 appels par jour.', false], 'F-4 avec session, GET 200 : la première ligne dit pour qui l’assistant est actif, puis le modèle et le quota (texte exact), plus de « Vérification… »');
      eq([sansChamp(sec), !!bouton(sec, 'Se connecter'), [...sec.querySelectorAll('button')].length], [0, false, 0], 'avec session : aucun champ, aucun bouton');
      ok(!sec.textContent.includes(JETON) && !sec.outerHTML.includes(JETON), 'avec session : le jeton n’est ni dans le texte ni dans le HTML');
      sec.remove();
    }
    // Le GET dit non (403 non_admis), ou ne répond pas : le texte juste, jamais le corps de l'erreur
    for (const [nom, suite, attendu, avecBouton = false] of [
      ['403 non_admis', async () => reponse(403, { erreur: 'non_admis', detail: 'CORPS-SENTINELLE' }), 'Ce compte n’a pas accès à l’assistant.'],
      ['403 origine (la passerelle écrit origine : F-6, une panne de configuration, pas un compte refusé)', async () => reponse(403, { erreur: 'origine' }), 'L’assistant est indisponible pour le moment.'],
      ['réseau coupé', async () => { throw new TypeError('Failed to fetch'); }, 'L’assistant est indisponible pour le moment.'],
      ['502', async () => reponse(502, { erreur: 'serveur' }), 'L’assistant est indisponible pour le moment.'],
      ['401 non_connecte (jeton refusé par le serveur)', async () => reponse(401, { erreur: 'non_connecte' }), 'Connecte-toi pour utiliser l’assistant.', true],
      ['429', async () => reponse(429, { erreur: 'quota', quota: 60 }), 'L’assistant est indisponible pour le moment.'],
      ['200 illisible', async () => reponse(200, 'pas du json'), 'L’assistant est indisponible pour le moment.'],
    ]) {
      const reseau = compteur(suite);
      const connexions = [];
      const sec = monter({ user: U, auth: { signIn: async () => ({ error: null }) } }, SESSION, { fetch: reseau.f, connecter: (a) => { connexions.push(a); } });
      await finDeLAttente(sec);
      eq([ligneEtat(sec).textContent, sec.querySelector('p').textContent, sec.textContent.includes('est actif'), [...sec.querySelectorAll('button')].map((b) => b.textContent)], [attendu, attendu, false, avecBouton ? ['Se connecter'] : []], `F-4 avec session, GET ${nom} : « ${attendu} » SEUL — jamais « L’assistant est actif… » sur un refus ou une panne${avecBouton ? ', avec « Se connecter »' : ', sans bouton'}`);
      if (avecBouton) { bouton(sec, 'Se connecter').click(); await tick(); eq(connexions.length, 1, `F-4 GET ${nom} : « Se connecter » lance la connexion`); }
      ok(!sec.textContent.includes('CORPS-SENTINELLE') && !sec.textContent.includes(JETON), `avec session, GET ${nom} : ni corps d’erreur ni jeton à l’écran`);
      sec.remove();
    }
    // Formes du 200 : quota de 1 au singulier ; modèle ou quota absents : seule la partie connue est dite ; les deux absents : « indisponible », jamais une ligne vide
    for (const [corps, attendu] of [[{ modele: 'm', quotaJour: 1 }, 'Modèle en service : m. Quota : 1 appel par jour.'], [{ modele: 'm', quotaJour: null }, 'Modèle en service : m.'], [{ modele: null, quotaJour: 60 }, 'Quota : 60 appels par jour.'], [{ modele: null, quotaJour: null }, 'L’assistant est indisponible pour le moment.'], [{}, 'L’assistant est indisponible pour le moment.'], [{ modele: 7, quotaJour: -1 }, 'L’assistant est indisponible pour le moment.']]) {
      const sec = monter({ user: U, auth: {} }, SESSION, { fetch: compteur(async () => reponse(200, corps)).f });
      await finDeLAttente(sec);
      const lisible = attendu !== 'L’assistant est indisponible pour le moment.';
      eq([ligneEtat(sec).textContent, sec.textContent.includes('est actif')], [attendu, lisible], `avec session, 200 ${JSON.stringify(corps)} : « ${attendu} »${lisible ? ' (avec la ligne « actif »)' : ' SEUL : un 200 sans modèle ni quota lisibles n’est pas une réponse de la passerelle, « actif » n’est pas dit'}`);
      sec.remove();
    }
    // Adresse absente de la session : la phrase reste vraie (celle du compte du contexte, sinon sans adresse)
    {
      const bon = compteur(async () => reponse(200, { modele: 'm', quotaJour: 60 }));
      const sec = monter({ user: { id: 'u1', email: 'b@exemple.invalid' }, auth: {} }, { access_token: JETON, user: { id: 'u1', email: '' } }, { fetch: bon.f });
      await finDeLAttente(sec);
      eq(sec.querySelector('p').textContent, 'L’assistant est actif pour b@exemple.invalid.', 'adresse : celle du compte du contexte quand la session n’en porte pas');
      sec.remove();
      const sec2 = monter({ user: { id: 'u1' }, auth: {} }, { access_token: JETON, user: { id: 'u1' } }, { fetch: bon.f });
      await finDeLAttente(sec2);
      eq(sec2.querySelector('p').textContent, 'L’assistant est actif sur ton compte.', 'adresse : aucune adresse connue → « sur ton compte », jamais « pour undefined »');
      sec2.remove();
    }
    // Un jeton qui n'est pas une session (vide, espace) : l'état « sans session », aucun appel
    for (const mauvaise of [{ access_token: '' }, { access_token: 'a b' }, { user: U }]) {
      const reseau = compteur(async () => reponse(200, {}));
      const sec = monter({ user: U, auth: {} }, mauvaise, { fetch: reseau.f });
      await tick();
      eq([sec.querySelector('p').textContent, reseau.appels.length], ['Connecte-toi pour utiliser l’assistant.', 0], `session invalide (${JSON.stringify(mauvaise)}) : état « sans session », aucun appel`);
      sec.remove();
    }
    // F-7 (M4) : appareil dont la garde de compte a refusé l'adresse — « Se connecter » renverrait au même refus (boucle OAuth) :
    // le message de la garde, sans bouton, aucun appel
    {
      const MESSAGE_GARDE = 'Cet appareil a été synchronisé avec b@exemple.invalid.';
      const reseau = compteur(async () => reponse(200, {}));
      const sec = monter({ auth: { signIn: async () => ({ error: null }) }, guard: { ok: false, message: MESSAGE_GARDE } }, null, { fetch: reseau.f, connecter: () => { throw new Error('aucune connexion attendue'); } });
      await tick();
      eq([sec.querySelector('p')?.textContent, sec.querySelectorAll('button').length, reseau.appels.length, sec.dataset.section], [MESSAGE_GARDE, 0, 0, 'assistant'], 'F-7 sans session, garde de compte refusée : le message de la garde, aucun bouton « Se connecter », aucun appel');
      sec.remove();
      const sec2 = monter({ auth: {}, guard: { ok: true } }, null, { fetch: reseau.f, connecter: () => {} });
      eq([sec2.querySelector('p')?.textContent, [...sec2.querySelectorAll('button')].map((b) => b.textContent)], ['Connecte-toi pour utiliser l’assistant.', ['Se connecter']], 'F-7 garde acceptée : « Connecte-toi » + « Se connecter » (inchangé)');
      sec2.remove();
    }
    // K-12 : la page n'est pas reconstruite sous les doigts — le focus RÉEL dans la section vaut « occupé »
    {
      const sec = monter({ auth: {} }, null, { fetch: compteur(async () => reponse(200, {})).f, connecter: () => {} });
      scene.hidden = false; // un nœud sous `hidden` ne reçoit jamais le focus
      const b = bouton(sec, 'Se connecter');
      b.focus();
      ok(document.activeElement === b, 'K-12 : le bouton a réellement reçu le focus'); // identité : eq sérialise, tout nœud vaut « {} »
      eq(S.occupeParAssistant(), true, 'K-12 : occupé quand le focus est dans la section');
      b.blur();
      scene.hidden = true;
      eq(S.occupeParAssistant(), false, 'K-12 : libre sans focus');
      sec.remove();
    }
    // La page entière : renderSettings lit la session, passe le fetch injecté, et ne rend jamais un champ de clé — même si un
    // réglage hérité en portait une (ctx.settings.llm) : la clé ne va ni dans le texte ni dans le HTML.
    await withRepo(async (repoTemp) => {
      const base = { ...(await repoTemp.getSettings()), llm: { provider: 'anthropic', model: 'm', base_url: '', api_key: 'sk-factice-page' } };
      const sans = compteur(async () => reponse(200, {}));
      const pageSans = await S.renderSettings({}, {}, { settings: base, sync: {} }, { fetch: sans.f });
      const secSans = pageSans.querySelector('[data-section="assistant"]');
      eq([!!secSans, secSans?.querySelector('p')?.textContent, pageSans.querySelectorAll('input[type="password"]').length, sans.appels.length], [true, 'Connecte-toi pour utiliser l’assistant.', 0, 0], 'renderSettings sans compte : section marquée, « Connecte-toi… », aucun champ de mot de passe sur la page, aucun appel');
      ok(!pageSans.textContent.includes('sk-factice-page') && !pageSans.outerHTML.includes('sk-factice-page'), 'renderSettings : un réglage hérité ne fuit ni dans le texte ni dans le HTML de la page');
      const avec = compteur(async () => reponse(200, { modele: 'claude-sonnet-5-5', quotaJour: 60 }));
      const lectures = [];
      const ctxCompte = { settings: base, sync: { user: U, auth: { jeton: async () => { lectures.push(1); return SESSION; } } } };
      const pageAvec = await S.renderSettings({}, {}, ctxCompte, { fetch: avec.f });
      scene.append(pageAvec);
      const secAvec = pageAvec.querySelector('[data-section="assistant"]');
      await finDeLAttente(secAvec);
      eq([secAvec.querySelector('p').textContent, ligneEtat(secAvec).textContent, avec.appels.length, lectures.length, pageAvec.querySelectorAll('input[type="password"]').length], ['L’assistant est actif pour a@exemple.invalid.', 'Modèle en service : claude-sonnet-5-5. Quota : 60 appels par jour.', 1, 1, 0], 'renderSettings avec compte : la session est lue UNE fois, un GET, l’état à l’écran');
      pageAvec.remove();
    });
  } finally { scene.remove(); setUiLocale(avantLocale); }
  // en.js : chaque chaîne neuve de la section a sa traduction
  const { EN } = await import('../src/i18n/en.js'); // export nommé `EN` (src/i18n/en.js:3)
  for (const fr of ['Connecte-toi pour utiliser l’assistant.', 'Se connecter', 'L’assistant est actif pour {adresse}.', 'L’assistant est actif sur ton compte.', 'Modèle en service : {m}.', 'Quota : {n} appels par jour.', 'Quota : 1 appel par jour.', 'Ce compte n’a pas accès à l’assistant.', 'L’assistant est indisponible pour le moment.', 'Vérification de l’assistant…']) ok(typeof EN[fr] === 'string' && EN[fr].length > 0, 'en.js : ' + fr.slice(0, 40));
}
