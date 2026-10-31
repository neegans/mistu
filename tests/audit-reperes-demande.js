import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';
import * as P from '../src/domain/reperes-parcours.js';
import { construireContexteReperes, lireReperes } from '../src/domain/reperes.js';
import { creerConservationReponseRefusee } from '../src/domain/reponses-refusees.js';
import { sha256Hex } from '../src/core/hash.js';
import { recetteReperesTest, versionReperesTest, reponseReperesTest, reponseAssistantReperes, CONFIG_REPERES } from './visuel-parcours.js';
const EPOQUE = 'editor_library_epoch:v1', PREFIXE = 'assistant_rejected:v1:';
const SESSION = () => ({ access_token: 'session-sha-synthetique', user: { id: 'u1' } });
const differe = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const resultatDe = p => Promise.resolve(p).then(valeur => ({ valeur }), e => ({ raison: e.raison ?? e.code ?? e.message }));
async function avecShaSuspendu(signature, lancer, pendant) {
  const subtle = crypto.subtle, descriptor = Object.getOwnPropertyDescriptor(subtle, 'digest'), digest = subtle.digest.bind(subtle);
  const parti = differe(), reprise = differe(); let hashes = 0, tache;
  Object.defineProperty(subtle, 'digest', { configurable: true, value: async (algorithme, bytes) => {
    if (new TextDecoder().decode(bytes) === signature) { hashes++; parti.resolve(); await reprise.promise; }
    return digest(algorithme, bytes); // vrai SHA natif, seulement son attente est contrôlée
  } });
  try {
    tache = resultatDe(Promise.resolve().then(lancer));
    const atteint = await Promise.race([parti.promise.then(() => true), tache.then(() => false)]);
    if (atteint) await pendant();
    reprise.resolve(); return { atteint, hashes, resultat: await tache };
  } finally {
    reprise.resolve(); if (tache) await tache;
    if (descriptor) Object.defineProperty(subtle, 'digest', descriptor); else delete subtle.digest;
  }
}
async function fixture(repo, db) {
  const recipe = recetteReperesTest(), source = versionReperesTest(); source.steps[1].text = 'Servir le témoin UNIQUE_SOURCE_TEXTE.';
  await db.mutate({ origin: 'remote', puts: { recipes: [recipe], recipe_versions: [source], sync_state: [{ key: 'user_id', value: 'u1' }, { key: EPOQUE, value: 'epoque-sha-reperes' }] } });
  const controle = creerConservationReponseRefusee({ repo });
  const deps = { repo, reponsesRefusees: controle, enLigne: () => true, config: CONFIG_REPERES };
  const row = await P.ouvrirReperes({ recipeId: recipe.id, versionId: source.id }, deps), journal = await repo.get('imports', row.id);
  const session = SESSION(); let appels = 0, corps = null;
  const proposer = extra => P.proposerReperes({ importId: row.id, session, documentId: 'doc-sha-reperes' }, { ...deps, sessionCourante: () => session, fetch: async (_url, init) => { appels++; corps = JSON.parse(init.body); return reponseAssistantReperes(reponseReperesTest()); }, ...extra });
  return { recipe, source, journal, contexte: construireContexteReperes({ recipe, version: source }), controle, session, proposer, appels: () => appels, corps: () => corps };
}
export async function runAuditReperesDemandeTests({ eq, ok }) {
  const run = async (nom, f) => { try { await withRepo(f); } catch (e) { ok(false, `Demande repères — ${nom} : ${e.stack || e.message}`); } };
  await run('projection immuable pendant SHA', async () => {
    const contexte = construireContexteReperes({ recipe: recetteReperesTest(), version: versionReperesTest() }), avant = structuredClone(contexte), hash = await sha256Hex(contexte.signature);
    const r = await avecShaSuspendu(contexte.signature, () => P.construireDemandeReperes(contexte), async () => { contexte.source.titre = 'Mutation volontaire du demandeur'; contexte.signature = 'signature modifiée après départ'; });
    eq(r.atteint, true, 'Repères SHA : vrai digest attendu sur la signature canonique');
    eq(r.hashes, 1, 'Repères SHA : un seul digest de signature');
    const projection = r.resultat.valeur && JSON.parse(r.resultat.valeur.user).contexte;
    eq(projection?.signature, hash, 'Repères SHA : projection contient hex64 du JSON canonique initial');
    eq(projection?.source, avant.source, 'Repères SHA : source copiée avant la première attente');
    if (r.atteint) eq(contexte.source.titre, 'Mutation volontaire du demandeur', 'Repères SHA : constructeur ne réécrit pas son appelant');
    else eq(false, true, 'Repères SHA : couture de copie réellement traversée');
  });
  await run('demande réelle et signature locale', async (repo, db) => {
    const f = await fixture(repo, db), initial = structuredClone(f.journal.contexte.signature), hash = await sha256Hex(initial);
    let maintenant = '2026-10-30T12:00:00.000Z';
    const r = await avecShaSuspendu(initial, () => f.proposer({ maintenant: () => maintenant }), async () => { maintenant = '2026-10-30T13:00:00.000Z'; });
    eq(r.atteint, true, 'Repères SHA : parcours attend le vrai calcul');
    eq(f.appels(), 1, 'Repères SHA : un seul POST après calcul');
    eq(r.resultat.valeur?.status, 'a_verifier', 'Repères SHA : réponse utilisable après le départ');
    const user = f.corps()?.corps?.messages?.[0]?.content, demande = user && JSON.parse(user);
    eq(demande?.contexte.signature, hash, 'Repères SHA : corps réellement envoyé porte le SHA');
    eq((user?.match(/UNIQUE_SOURCE_TEXTE/gu) || []).length, 1, 'Repères SHA : recette envoyée une seule fois');
    eq((await repo.get('imports', f.journal.id)).contexte.signature, initial, 'Repères SHA : signature JSON persistée intacte');
    eq((await repo.get('imports', f.journal.id)).started_at, '2026-10-30T13:00:00.000Z', 'Repères SHA : date de départ prise après le calcul');
    await P.garderReperes({ importId: f.journal.id, relu: true }, { repo });
    const gardee = await repo.get('recipes', f.recipe.id);
    eq(gardee.reperes.proposition.source.signature, initial, 'Repères SHA : enveloppe conservée garde sa signature JSON historique');
    eq(lireReperes(gardee, f.source).description_fr, reponseReperesTest().description_fr.texte, 'Repères SHA : enveloppe toujours relisible');
    eq(await repo.get('recipe_versions', f.source.id), f.source, 'Repères SHA : version culinaire strictement intacte');
    eq(gardee.personal_notes, f.recipe.personal_notes, 'Repères SHA : notes privées conservées localement');
    ok(!user?.includes(f.recipe.personal_notes), 'Repères SHA : aucune note privée envoyée');
  });
  await run('source ample et garde défensive de taille', async () => {
    const source = versionReperesTest(); source.steps = Array.from({ length: 12 }, (_, i) => ({ id: 's' + i, text: ('étape complète ' + i + ' ').repeat(90) }));
    const contexte = construireContexteReperes({ recipe: recetteReperesTest(), version: source }), avant = structuredClone(contexte);
    const d = await P.construireDemandeReperes(contexte), projection = JSON.parse(d.user).contexte;
    eq(projection.source, contexte.source, 'Repères SHA : source ample entière, aucune troncature');
    eq(contexte, avant, 'Repères SHA : grand contexte original inchangé');
    ok(new TextEncoder().encode(d.system + d.user).length < 120 * 1024, 'Repères SHA : demande finale sous sa borne');
    // Entrée synthétique hors des bornes culinaires publiques, pour la garde du constructeur exporté.
    const tropGrand = { ...contexte, source: { ...contexte.source, titre: 'x'.repeat(120 * 1024) } };
    eq((await resultatDe(Promise.resolve().then(() => P.construireDemandeReperes(tropGrand)))).raison, 'hors_bornes', 'Repères SHA : borne défensive atteinte sur la projection finale');
  });
  for (const nom of ['source', 'journal', 'annulation', 'session', 'session-mutable', 'owner', 'epoque', 'connexion']) await run('attente ' + nom, async (repo, db) => {
    const f = await fixture(repo, db), controller = new AbortController(); let sessionCourante = f.session, attendu = f.journal;
    const codes = { source: 'source_modifiee', journal: 'brouillon_modifie', annulation: 'annule', session: 'compte_change', 'session-mutable': 'compte_change', owner: 'compte_change', epoque: 'bibliotheque_remplacee', connexion: 'contexte_change' };
    const r = await avecShaSuspendu(f.contexte.signature, () => f.proposer({ signal: controller.signal, sessionCourante: () => sessionCourante }), async () => {
      if (nom === 'source') await db.mutate({ origin: 'device', puts: { recipe_versions: [{ ...f.source, steps: [{ ...f.source.steps[0], text: 'Texte concurrent' }, f.source.steps[1]] }] } });
      if (nom === 'journal') { attendu = { ...f.journal, revision_brouillon: (f.journal.revision_brouillon || 0) + 1, saisie: { description_fr: 'Saisie concurrente' } }; await db.mutate({ origin: 'device', puts: { imports: [attendu] } }); }
      if (nom === 'annulation') controller.abort();
      if (nom === 'session') sessionCourante = { access_token: 'autre-session', user: { id: 'u2' } };
      if (nom === 'session-mutable') f.session.user.id = 'u2';
      if (nom === 'owner') await db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'u2' }] } });
      if (nom === 'epoque') await db.mutate({ origin: 'device', puts: { sync_state: [{ key: EPOQUE, value: 'epoque-suivante' }] } });
      if (nom === 'connexion') { db.idb.close(); db.idb = null; await db.open(); }
    });
    eq(r.atteint, true, `Repères SHA ${nom} : modification pendant le vrai digest`);
    eq(r.resultat.raison, codes[nom], `Repères SHA ${nom} : refus exact avant départ`);
    eq(f.appels(), 0, `Repères SHA ${nom} : aucun POST`);
    eq(await db.get('imports', f.journal.id), attendu, `Repères SHA ${nom} : journal concurrent intact, aucun faux départ`);
  });
  await run('base pendant SHA', async (repo, db) => {
    const f = await fixture(repo, db);
    await withDatabase(async autre => {
      try {
        const r = await avecShaSuspendu(f.contexte.signature, () => f.proposer(), async () => { repo.bindDatabase(autre); });
        eq(r.atteint, true, 'Repères SHA base : changement pendant digest');
        eq(r.resultat.raison, 'contexte_change', 'Repères SHA base : ancienne base non adoptée');
        eq(f.appels(), 0, 'Repères SHA base : aucun POST');
        eq(await db.get('imports', f.journal.id), f.journal, 'Repères SHA base : ancien journal intact');
        eq(await autre.getAll('imports'), [], 'Repères SHA base : nouvelle base intacte');
      } finally { repo.bindDatabase(db); }
    });
  });
  for (const nom of ['owner', 'epoque']) await run('transaction ' + nom, async (repo, db) => {
    const f = await fixture(repo, db), muter = db.mutate.bind(db); let pret = false, injections = 0;
    const controle = { ...f.controle, preparerDepart: async args => {
      if (!f.controle.preparerDepart) return { issue: 'refuse', raison: 'api_absente' };
      const r = await f.controle.preparerDepart(args); pret = r.issue === 'ok'; return r;
    } };
    db.mutate = async args => {
      if (pret && args.conditions?.imports?.some(c => c.key === f.journal.id)) { pret = false; injections++; await muter({ origin: 'device', puts: { sync_state: [{ key: nom === 'owner' ? 'user_id' : EPOQUE, value: nom === 'owner' ? 'u2' : 'epoque-commit' }] } }); }
      return muter(args);
    };
    try {
      const r = await resultatDe(f.proposer({ reponsesRefusees: controle }));
      eq(injections, 1, `Repères SHA transaction ${nom} : course après préparation réellement atteinte`);
      eq(r.raison, nom === 'owner' ? 'compte_change' : 'bibliotheque_remplacee', `Repères SHA transaction ${nom} : condition portée dans la transaction`);
      eq(f.appels(), 0, `Repères SHA transaction ${nom} : aucun POST`);
      eq(await db.get('imports', f.journal.id), f.journal, `Repères SHA transaction ${nom} : aucune transition partielle`);
    } finally { db.mutate = muter; }
  });
  await run('ancien reçu retiré pendant SHA', async (repo, db) => {
    const f = await fixture(repo, db);
    await f.proposer({ fetch: async () => new Response('{') });
    const journal = await repo.get('imports', f.journal.id), cle = PREFIXE + journal.id; ok(!!await db.get('sync_state', cle), 'Repères SHA reçu : ancien reçu réel préparé');
    const r = await avecShaSuspendu(f.contexte.signature, () => f.proposer(), async () => { await db.mutate({ origin: 'device', deletes: { sync_state: [cle] } }); });
    eq(r.atteint, true, 'Repères SHA reçu : retrait concurrent pendant digest');
    eq(r.resultat.raison, 'reponse_changee', 'Repères SHA reçu : ancienne capture refusée avant nouvel appel');
    eq(f.appels(), 0, 'Repères SHA reçu : aucun POST avec une capture périmée');
    eq(await db.get('imports', journal.id), journal, 'Repères SHA reçu : ancien journal conservé sans faux départ');
    eq(await db.get('sync_state', cle) ?? null, null, 'Repères SHA reçu : suppression concurrente conservée');
  });
}
