import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';
import { createMoteur } from '../src/sync/moteur.js';
import { createPush } from '../src/sync/push.js';
import { createPull } from '../src/sync/pull.js';
import { installCapture } from '../src/sync/outbox.js';
import { creerTransportFactice } from './transport-factice.js';
import { creerStockageFactice } from './stockage-factice.js';
import { ignorerPropositionImport } from '../src/domain/reprise-import.js';
import { garderIci, garderAilleurs, ignorerRenvoye, purgerAnciens } from '../src/sync/conflits.js';

export async function runCorrectifsImportsSyncTests({ eq, ok }) {
  const run = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, nom + ' : ' + (e.stack || e)); } };
  for (const kind of ['thermomix', 'reperes']) await run('Deux moteurs ' + kind, () => withRepo(async (repo, a) => withDatabase(async b => {
    const serveur = creerTransportFactice({ serveur: true }), stockage = creerStockageFactice();
    const ma = createMoteur({ db: a, transport: serveur, stockage, getUserId: () => 'u1' });
    const mb = createMoteur({ db: b, transport: serveur, stockage, getUserId: () => 'u1' });
    for (const db of [a, b]) await db.put('sync_state', { key: 'user_id', value: 'u1' }, { origin: 'device' });
    installCapture(b, { getUserId: () => 'u1' });
    const recipe = { id: 'fermeture-r', original_title: 'Tomates', availability: 'available' };
    const journal = { id: 'fermeture-i', kind, recipe_id: recipe.id, status: 'en_cours', revision_brouillon: 0, tentative_id: 'appel-a', document_id_vol: 'doc-a' };
    try {
      await repo.saveBatch({ recipes: [recipe], imports: [journal] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      await ma.executer(); await mb.executer();
      repo.bindDatabase(b); await ignorerPropositionImport(journal.id, { repo }); repo.bindDatabase(a);
      await mb.executer();
      eq(serveur.ligne('imports', journal.id).data.status, 'ignore', kind + ' : abandon B réellement envoyé');
      await repo.transitionner('imports', journal.id, { attendus: ['en_cours'], patch: { status: 'a_verifier', resultat: { texte: 'Réponse tardive payée' } } });
      await ma.executer();
      const ancienne = structuredClone(serveur.ligne('imports', journal.id));
      await mb.executer();
      eq((await b.get('imports', journal.id)).status, 'ignore', kind + ' : réponse tardive reçue ne rouvre pas le journal abandonné');
      const copies = (await b.getAll('sync_conflicts')).filter(c => c.kind === 'import_cloture');
      eq(copies.length, 1, kind + ' : une copie documentaire de la réponse tardive');
      ok(copies[0]?.server?.data?.resultat?.texte === 'Réponse tardive payée', kind + ' : résultat payé conservé sans application');
      await mb.executer(); await ma.executer();
      eq([(await a.get('imports', journal.id)).status, (await b.get('imports', journal.id)).status, serveur.ligne('imports', journal.id).data.status], ['ignore', 'ignore', 'ignore'], kind + ' : deux moteurs et serveur convergent vers clôture connue');
      const seq = serveur.ligne('imports', journal.id).server_seq;
      await ma.executer(); await mb.executer();
      eq(serveur.ligne('imports', journal.id).server_seq, seq, kind + ' : écho fermé sans boucle de renvoi');
      if (copies[0]) {
        eq(await garderIci(b, copies[0]), false, kind + ' : copie documentaire sans garder ici');
        eq(await garderAilleurs(b, copies[0]), false, kind + ' : copie documentaire sans garder ailleurs');
        eq(await ignorerRenvoye(b, { ...copies[0], renvoye: true }), false, kind + ' : copie ne se supprime pas par ancien bouton Ignorer');
        await purgerAnciens(b, Date.now() + 366 * 86400000);
        ok(!!await b.get('sync_conflicts', copies[0].id), kind + ' : copie conservée après trente jours et après accusé');
      }
      const echographe = creerTransportFactice({ lire: { imports: [[ancienne], []] } });
      await createPull({ db: b, transport: echographe, getUserId: () => 'u1' }).recevoir();
      eq([(await b.get('imports', journal.id)).status, (await b.getAll('outbox')).length], ['ignore', 0], kind + ' : ancien écho ouvert ne rouvre rien et ne refait pas un renvoi');
      eq((await b.getAll('sync_conflicts')).filter(c => c.kind === 'import_cloture').length, 1, kind + ' : ancien écho ne duplique pas la copie');
      const vieux = { id: 'ancien-conflit', store: 'imports', record_id: journal.id, kind: 'donnees', local: ancienne.data, server: ancienne };
      eq(await garderIci(b, vieux), false, kind + ' : ancienne résolution générique ne remet pas une réponse ouverte');
      eq(await garderAilleurs(b, vieux), false, kind + ' : ancienne copie serveur ne contourne pas la clôture');
    } finally { repo.bindDatabase(a); await ma.arreter(); await mb.arreter(); }
  })));
  await runCorrectifsImportsSyncReponsesTests({ eq, ok });
}

export async function runCorrectifsImportsSyncReponsesTests({ eq, ok }) {
  const run = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, nom + ' : ' + (e.stack || e)); } };
  const base = { id: 'i-push', kind: 'thermomix', recipe_id: 'r-push', status: 'a_verifier', resultat: { texte: 'Payée' }, updated_at: '2026-01-01T00:00:00.000Z' };
  const mettre = async (db, row, user = 'u1') => {
    await db.put('sync_state', { key: 'user_id', value: user }, { origin: 'device' });
    await db.put('imports', row, { origin: 'remote' });
    await db.put('outbox', { user_id: user, store: 'imports', id: row.id, op: 'put', updated_at: row.updated_at, tries: 0 }, { origin: 'remote' });
  };
  for (const [localeStatus, serveurStatus] of [['ignore', 'a_verifier'], ['a_verifier', 'ignore'], ['ignore', 'enregistre'], ['enregistre', 'ignore']]) await run('Rejet ' + localeStatus + '/' + serveurStatus, () => withDatabase(async db => {
    await mettre(db, { ...base, status: localeStatus });
    const server = { data: { ...base, status: serveurStatus }, updated_at: '2026-01-02T00:00:00.000Z', deleted_at: null };
    const transport = creerTransportFactice({ pousser: [{ reponse: { rejected: [{ store: 'imports', id: base.id, reason: 'conflit', server }] } }] });
    await createPush({ db, transport, getUserId: () => 'u1' }).envoyer();
    const attendu = [localeStatus, serveurStatus].includes('enregistre') ? 'enregistre' : 'ignore';
    eq((await db.get('imports', base.id)).status, attendu, 'Rejet push : état terminal ' + localeStatus + '/' + serveurStatus);
    const copies = await db.getAll('sync_conflicts');
    eq(copies.map(c => c.kind), ['import_cloture'], 'Rejet push : copie documentaire sans résolution réouvrante');
    const outbox = await db.getAll('outbox');
    eq(outbox.length, localeStatus === attendu ? 1 : 0, 'Rejet push : seul un terminal local renvoyé attend');
    if (outbox.length) ok(Date.parse(outbox[0].updated_at) > Date.parse(server.updated_at), 'Renvoi terminal postérieur au serveur');
  }));
  await run('Ajustement pendant abandon', () => withDatabase(async db => {
    await mettre(db, base);
    const transport = { async pousser() {
      await db.put('imports', { ...base, status: 'ignore', updated_at: '2026-01-02T00:00:00.000Z' }, { origin: 'remote' });
      return { reponse: { adjusted: [{ store: 'imports', id: base.id, updated_at: '2026-01-03T00:00:00.000Z' }] } };
    } };
    await createPush({ db, transport, getUserId: () => 'u1' }).envoyer();
    eq((await db.get('imports', base.id)).status, 'ignore', 'Ajustement tardif ne rouvre pas le brouillon');
    eq((await db.getAll('sync_conflicts')).map(c => c.kind), ['import_cloture'], 'Ajustement conserve la réponse envoyée');
    eq((await db.getAll('outbox')).length, 1, 'Ajustement remet la fermeture en file');
  }));
  await run('Compte pendant réponse', () => withDatabase(async db => {
    await mettre(db, { ...base, status: 'ignore' }); let owner = 'u1';
    const transport = { async pousser() { owner = 'u2'; return { reponse: { rejected: [{ store: 'imports', id: base.id, reason: 'conflit', server: { data: base, updated_at: '2026-01-03T00:00:00.000Z' } }] } }; } };
    const bilan = await createPush({ db, transport, getUserId: () => owner }).envoyer();
    eq(bilan.erreur?.type, 'auth', 'Changement compte pendant push refuse la réponse');
    eq([(await db.getAll('outbox')).length, (await db.getAll('sync_conflicts')).length, (await db.get('imports', base.id)).status], [1, 0, 'ignore'], 'Changement compte conserve exactement file et état');
  }));
  await run('Périmètre exact et tombale', () => withDatabase(async db => {
    await db.put('sync_state', { key: 'user_id', value: 'u1' }, { origin: 'device' });
    const cas = [
      { id: 'autre-nature', local: { kind: 'extraction' }, distant: { kind: 'extraction', status: 'a_verifier' } },
      { id: 'autre-recette', local: {}, distant: { recipe_id: 'r-autre', status: 'a_verifier' } },
      { id: 'nature-changee', local: {}, distant: { kind: 'reperes', status: 'a_verifier' } },
      { id: 'meme-rang', local: {}, distant: { status: 'ignore', resultat: { texte: 'Autre clôture' } } },
      { id: 'tombe', local: {}, distant: {}, deleted_at: '2026-01-02T00:00:00.000Z' },
    ];
    const lignes = [];
    for (const [index, c] of cas.entries()) {
      await db.put('imports', { ...base, id: c.id, status: 'ignore', ...c.local }, { origin: 'remote' });
      lignes.push({ id: c.id, data: { ...base, id: c.id, ...c.distant }, updated_at: '2026-01-02T00:00:00.000Z', deleted_at: c.deleted_at || null, server_seq: index + 1 });
    }
    const transport = creerTransportFactice({ lire: { imports: [lignes, []] } });
    await createPull({ db, transport, getUserId: () => 'u1' }).recevoir();
    eq((await db.get('imports', 'autre-nature')).status, 'a_verifier', 'Autre outil conserve sa règle usuelle');
    eq((await db.get('imports', 'autre-recette')).recipe_id, 'r-autre', 'La règle terminale ne fusionne pas deux identités recette');
    eq((await db.get('imports', 'nature-changee')).kind, 'reperes', 'La règle terminale ne fusionne pas deux natures');
    eq((await db.get('imports', 'meme-rang')).resultat.texte, 'Autre clôture', 'Clôtures de même rang suivent encore la date');
    ok(!await db.get('imports', 'tombe'), 'Une tombale reçue reste une suppression explicite');
    eq((await db.getAll('sync_conflicts')).length, 0, 'Périmètre extérieur sans fausses copies terminales');
  }));
  await run('Réessai après accusé perdu', () => withDatabase(async db => {
    const serveur = creerTransportFactice({ serveur: true });
    await serveur.pousser([{ store: 'imports', id: base.id, data: base, updated_at: base.updated_at }]);
    await mettre(db, { ...base, status: 'ignore', updated_at: '2026-01-02T00:00:00.000Z' });
    let perdue = true;
    const transport = { async pousser(rows) { const r = await serveur.pousser(rows); if (perdue) { perdue = false; return { erreur: { type: 'reseau' } }; } return r; } };
    let horloge = Date.now();
    const push = createPush({ db, transport, getUserId: () => 'u1', maintenant: () => horloge });
    await push.envoyer();
    const seq = serveur.ligne('imports', base.id).server_seq;
    eq([(await db.getAll('outbox')).length, serveur.ligne('imports', base.id).data.status], [1, 'ignore'], 'Accusé perdu : clôture serveur et file locale conservées');
    horloge += 3000; await push.envoyer();
    eq([(await db.getAll('outbox')).length, serveur.ligne('imports', base.id).server_seq], [0, seq], 'Réessai idempotent sans seconde fermeture ni boucle');
  }));
  for (const canal of ['push', 'pull']) await run('Course atomique ' + canal, () => withDatabase(async db => {
    await mettre(db, base);
    const distante = { id: base.id, data: { ...base, status: 'ignore' }, updated_at: '2026-01-02T00:00:00.000Z', deleted_at: null, server_seq: 1 };
    const transport = creerTransportFactice({ pousser: [{ reponse: { rejected: [{ store: 'imports', id: base.id, reason: 'conflit', server: distante }] } }], lire: { imports: [[distante], []] } });
    const mutation = db.mutate.bind(db); let injectee = false;
    db.mutate = async options => {
      if (!injectee && options.conditions?.imports?.length) {
        injectee = true;
        await mutation({ puts: { imports: [{ ...base, status: 'enregistre', resultat: { texte: 'Gardée entre lecture et écriture' } }] }, origin: 'remote' });
      }
      return mutation(options);
    };
    let refus = null;
    try { if (canal === 'push') await createPush({ db, transport, getUserId: () => 'u1' }).envoyer();
      else await createPull({ db, transport, getUserId: () => 'u1' }).recevoir(); } catch (e) { refus = e; }
    ok(!!refus, canal + ' : état modifié après lecture refuse atomiquement');
    eq([(await db.get('imports', base.id)).status, (await db.getAll('sync_conflicts')).length, (await db.getAll('outbox')).length], ['enregistre', 0, 1], canal + ' : garde, copie et accusé restent atomiques');
    eq((await db.get('sync_state', 'cursor:imports'))?.value ?? 0, 0, canal + ' : aucun curseur ne saute la réception refusée');
  }));
  await run('Compte pendant résolution ancienne', () => withDatabase(async db => {
    await mettre(db, base);
    const c = { id: 'ancien', store: 'imports', record_id: base.id, kind: 'donnees', local: base, server: { data: base, updated_at: base.updated_at } };
    await db.put('sync_conflicts', c, { origin: 'remote' });
    const mutation = db.mutate.bind(db); let injectee = false;
    db.mutate = async options => {
      if (!injectee && options.conditions?.imports?.length) { injectee = true; await mutation({ puts: { sync_state: [{ key: 'user_id', value: 'u2' }] }, origin: 'remote' }); }
      return mutation(options);
    };
    let refus = null; try { await garderIci(db, c); } catch (e) { refus = e; }
    ok(!!refus, 'Ancien conflit : changement compte pendant résolution refuse atomiquement');
    eq((await db.get('imports', base.id)).updated_at, base.updated_at, 'Ancien conflit : aucun contenu réhorodaté pour le nouveau compte');
    ok(!!await db.get('sync_conflicts', c.id), 'Ancien conflit : copie conservée après refus de compte');
  }));
  await run('Interface documentaire', async () => {
    const { syncSectionL3, syncSectionModel } = await import('../src/ui/settings.js');
    const c = { id: 'doc-1', store: 'imports', record_id: base.id, kind: 'import_cloture', local: { ...base, status: 'ignore' }, server: { data: base }, at: base.updated_at };
    const scene = document.createElement('section'); scene.append(...syncSectionL3(syncSectionModel({ available: true, user: { id: 'u1' }, guard: { ok: true }, moteur: {}, conflits: [c] }), { garderIci() {}, garderAilleurs() {}, ignorerConflit() {} }));
    const copie = scene.querySelector('[data-conflit="doc-1"]');
    ok(copie?.textContent.includes('Payée'), 'La réponse tardive reste consultable dans les réglages');
    eq(copie?.querySelectorAll('button').length, 0, 'Copie documentaire sans boutons de résolution');
    ok(!scene.textContent.includes('Choisis celle qui compte'), 'Copie documentaire ne réclame pas un arbitrage utilisateur');
  });
}
