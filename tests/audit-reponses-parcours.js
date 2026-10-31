import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';
import { sourceThermomix, propositionThermomix } from './i3-thermomix.js';
import { recetteReperesTest, versionReperesTest, reponseReperesTest } from './visuel-parcours.js';
import { sha256Hex } from '../src/core/hash.js';
import { octetsJsonbSources } from '../src/domain/sources-format.js';
import { composerLots } from '../src/sync/lots.js';

const SESSION = { access_token: 'session-synthetique-refus', user: { id: 'u1' } };
const CONFIG = { url: 'https://assistant.example', anonKey: 'publique-factice' };
const EPOQUE = 'editor_library_epoch:v1', PREFIXE = 'assistant_rejected:v1:';
const DATE = '2026-10-30T17:00:00.000Z', encoder = new TextEncoder();
const enveloppe = (r, extra = {}) => encoder.encode(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(r) }], stop_reason: 'end_turn', model: 'modele-fixture', ...extra }));
const differe = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

async function fixture(repo, genre) {
  const tm = genre === 'thermomix';
  const source = tm ? sourceThermomix() : versionReperesTest();
  if (tm) source.ingredients = [
    { id: 'a', source_text: '1,5 l de bouillon', name_text: 'bouillon', quantity: { value: 1.5 }, unit_id: 'l' },
    { id: 'b', source_text: '1 l de lait', name_text: 'lait', quantity: { value: 1 }, unit_id: 'l' },
  ];
  const recipe = tm ? { id: source.recipe_id, original_title: 'Soupe', availability: 'available', current_version_id: source.id } : recetteReperesTest();
  await repo.db.mutate({ origin: 'remote', puts: { recipes: [recipe], recipe_versions: [source], sync_state: [{ key: 'user_id', value: 'u1' }, { key: EPOQUE, value: 'epoque-refus-parcours' }] } });
  const P = tm ? await import('../src/domain/thermomix-parcours.js') : await import('../src/domain/reperes-parcours.js');
  const deps = { repo, config: CONFIG, enLigne: () => true, maintenant: () => DATE, sessionCourante: () => SESSION };
  const journal = await (tm ? P.ouvrirThermomix : P.ouvrirReperes)({ recipeId: recipe.id, versionId: source.id, ...(tm ? { selection: ['s1'] } : {}) }, deps);
  const resultat = tm ? propositionThermomix() : reponseReperesTest();
  if (!tm) resultat.temps.actif = { min: 40, max: 40, origine: 'estimation_ia' };
  return { tm, source, recipe, deps, journal, octets: enveloppe(resultat), motif: tm ? 'capacite' : 'actif_incompatible', limite: tm ? 1024 * 1024 : 128 * 1024,
    proposer: d => (tm ? P.proposerThermomix : P.proposerReperes)({ importId: journal.id, session: SESSION, documentId: 'document-refus' }, { ...deps, ...d }),
    modifier: () => (tm ? P.modifierThermomix(journal.id, { demande: 'Seulement cette partie.' }, deps) : P.modifierBrouillonReperes(journal.id, { saisie: { description_fr: 'Ma description.' } }, deps)),
    reprendre: () => (tm ? P.lireBrouillonThermomix : P.lireBrouillonReperes)(journal.id, deps),
    valide: () => enveloppe(tm ? { type: 'refus', raison: 'Cette préparation dépasse le profil disponible.' } : reponseReperesTest()),
  };
}

export async function runAuditReponsesParcoursTests({ eq, ok }) {
  const { creerConservationReponseRefusee } = await import('../src/domain/reponses-refusees.js');
  const run = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, `10.2 parcours — ${nom} : ${e.stack || e}`); } };
  const erreurDe = async fn => { try { await fn(); return null; } catch (e) { return e; } };
  for (const genre of ['thermomix', 'reperes']) {
    await run(`${genre} refus complet et durée de vie`, async (repo, db) => {
      const f = await fixture(repo, genre), controle = creerConservationReponseRefusee({ repo, maintenant: () => DATE }); let appels = 0;
      const deps = { reponsesRefusees: controle, fetch: async () => { appels++; return new Response(f.octets); } };
      const row = await f.proposer(deps), lecture = await controle.lire({ importId: row.id });
      eq([row.status, row.resultat, row.erreur?.raison, appels], ['echec', null, f.motif, 1], `${genre} : refus réellement atteint, un POST, aucun résultat adoptable`);
      eq([lecture.issue, lecture.etat, lecture.motif], ['ok', 'disponible', f.motif], `${genre} : reçu complet disponible sur cet appareil`);
      eq(lecture.octets ? await sha256Hex(lecture.octets) : null, await sha256Hex(f.octets), `${genre} : octets HTTP exacts avant extraction JSON`);
      eq(row.reponse_refusee?.sha256, await sha256Hex(f.octets), `${genre} : référence vers empreinte exacte`);
      eq(row.reponse_refusee?.byte_length, f.octets.length, `${genre} : longueur complète`);
      eq(Object.keys(row.reponse_refusee || {}).sort(), ['format', 'reference', 'tentative_id', 'motif', 'byte_length', 'sha256', 'saved_at'].sort(), `${genre} : référence fermée sans corps brut`);
      eq(await repo.get('recipe_versions', f.source.id), f.source, `${genre} : original strictement intact`);
      ok(!JSON.stringify(row).includes(SESSION.access_token), `${genre} : aucun jeton dans le journal`);
      const ref = row.reponse_refusee, local = await db.get('sync_state', PREFIXE + row.id);
      await f.modifier(); await f.reprendre();
      eq((await repo.get('imports', row.id)).reponse_refusee, ref, `${genre} : correction et réouverture gardent le dernier refus`);
      const panne = await f.proposer({ reponsesRefusees: controle, fetch: async () => { appels++; throw new TypeError('panne simulée'); } });
      eq([panne.erreur?.raison, panne.reponse_refusee], ['reseau', ref], `${genre} : panne suivante ne remplace pas le reçu payé`);
      const valide = await f.proposer({ reponsesRefusees: controle, fetch: async () => { appels++; return new Response(f.valide()); } });
      eq([valide.status, valide.reponse_refusee], ['a_verifier', ref], `${genre} : réponse valide ultérieure garde le reçu jusqu’à abandon explicite`);
      eq(await db.get('sync_state', PREFIXE + row.id), local, `${genre} : corps historique inchangé après correction, réseau et succès`);
      eq(appels, 3, `${genre} : lecture et correction sans appel caché`);
    });
    for (const [nom, corps, motif] of [
      ['corps vide', new Uint8Array(), 'reponse_illisible'],
      ['JSON incomplet', encoder.encode('{"content":'), 'reponse_illisible'],
      ['UTF8 invalide', new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125]), 'reponse_illisible'],
      ['sortie interrompue', enveloppe({}, { stop_reason: 'max_tokens' }), 'interrompu'],
      ['refus fournisseur', enveloppe({}, { stop_reason: 'refusal' }), 'refus'],
    ]) await run(`${genre} ${nom}`, async repo => {
      const f = await fixture(repo, genre), controle = creerConservationReponseRefusee({ repo });
      const row = await f.proposer({ reponsesRefusees: controle, fetch: async () => new Response(corps) });
      eq([row.status, row.resultat, row.erreur?.raison], ['echec', null, motif], `${genre} ${nom} : motif précis, validation maintenue`);
      const lecture = await controle.lire({ importId: row.id });
      eq(lecture.etat, 'disponible', `${genre} ${nom} : reçu consultable sans valider le corps`);
      eq(lecture.octets ? [...lecture.octets] : null, [...corps], `${genre} ${nom} : aucun décodage destructeur`);
    });
    for (const [nom, fetch, motif] of [
      ['HTTP 429', async () => new Response('{}', { status: 429 }), 'trop_de_demandes'],
      ['flux interrompu', async () => new Response(new ReadableStream({ start(c) { c.enqueue(encoder.encode('{')); c.error(new Error('lecture simulée interrompue')); } })), 'reseau'],
    ]) await run(`${genre} ${nom}`, async repo => {
      const f = await fixture(repo, genre), controle = creerConservationReponseRefusee({ repo });
      const r = await f.proposer({ reponsesRefusees: controle, fetch });
      eq([r.status, r.erreur?.raison, r.resultat], ['echec', motif, null], `${genre} ${nom} : échec réseau conservant sa raison`);
      eq((await controle.lire({ importId: r.id })).etat, 'aucune', `${genre} ${nom} : aucun reçu complet inventé`);
    });
    await run(`${genre} borne et synchronisation`, async (repo, db) => {
      const f = await fixture(repo, genre), controle = creerConservationReponseRefusee({ repo });
      const corps = new Uint8Array(f.limite); corps.fill(32); corps.set(f.octets);
      const row = await f.proposer({ reponsesRefusees: controle, fetch: async () => new Response(corps) });
      eq([row.erreur?.raison, row.reponse_refusee?.byte_length], [f.motif, f.limite], `${genre} : borne HTTP inclusive, même validation culinaire`);
      const lecture = await controle.lire({ importId: row.id });
      eq(lecture.octets ? await sha256Hex(lecture.octets) : null, await sha256Hex(corps), `${genre} : dernier octet conservé à la borne`);
      ok(octetsJsonbSources(row) < 524288, `${genre} : import sous la borne synchronisable malgré le corps local`);
      const file = (await db.getAll('outbox')).filter(e => e.store === 'imports' && e.id === row.id);
      const lots = await composerLots(file, (store, id) => db.get(store, id));
      eq([lots.lots.length, lots.retenues.length, lots.abandonnees.length], [1, 0, 0], `${genre} : référence réellement composée sans retenue`);
      eq(lots.lots[0]?.elements.map(e => [e.store, e.id, e.data.reponse_refusee]), [['imports', row.id, row.reponse_refusee]], `${genre} : lot exact avec référence complète`);
      ok(!JSON.stringify(file).includes('base64') && !JSON.stringify(lots).includes('encoding'), `${genre} : aucun corps local dans la file ni le lot`);
      const ref = row.reponse_refusee;
      const trop = await f.proposer({ reponsesRefusees: controle, fetch: async () => new Response(new Uint8Array(f.limite + 1).fill(32)) });
      eq([trop.erreur?.raison, trop.reponse_refusee], ['reponse_illisible', ref], `${genre} : dépassement non tronqué, ancien reçu conservé`);
    });
    await run(`${genre} quota direct et réessai`, async (repo, db) => {
      const f = await fixture(repo, genre), mutation = db.mutate.bind(db); let quota = true, ecritures = 0, appels = 0;
      // La même clé peut seulement être vérifiée avant l'appel : le quota vise une écriture réelle du reçu.
      db.mutate = args => mutation({ ...args, conditions: { ...args.conditions, ...(args.conditions?.sync_state ? {
        sync_state: args.conditions.sync_state.map(c => c.key !== PREFIXE + f.journal.id ? c : { ...c, fusion: (...lectures) => {
          const r = c.fusion(...lectures);
          if (r != null) { ecritures++; if (quota) throw new DOMException('quota simulé', 'QuotaExceededError'); }
          return r;
        } }),
      } : {}) } });
      try {
        const e = await erreurDe(() => f.proposer({ fetch: async () => { appels++; return new Response(f.octets); } }));
        eq(e?.code, 'conservation_en_attente', `${genre} : quota annonce une réponse non encore conservée`);
        eq((await repo.get('imports', f.journal.id)).status, 'en_cours', `${genre} : quota ne réécrit pas un faux échec terminal`);
        eq(await db.get('sync_state', PREFIXE + f.journal.id), undefined, `${genre} : aucune moitié de reçu durable`);
        eq(ecritures, 1, `${genre} : une tentative de conservation, aucun second ecrireEchec`);
        const controle = e?.conservationReponseRefusee;
        ok(!!controle, `${genre} : appel direct garde un accès au contrôleur de récupération`);
        ok(!Object.keys(e || {}).includes('conservationReponseRefusee'), `${genre} : contrôleur non sérialisé dans l’erreur`);
        if (!controle) return;
        const pending = await controle.reponseEnAttente({ importId: f.journal.id });
        eq([pending.etat, pending.motif], ['en_attente', f.motif], `${genre} : motif initial et attente réelle`);
        eq(await sha256Hex(pending.octets), await sha256Hex(f.octets), `${genre} : réponse encore récupérable en mémoire`);
        const bloque = await erreurDe(() => f.proposer({ reponsesRefusees: controle, fetch: async () => { appels++; return new Response(f.octets); } }));
        eq(bloque?.code, 'conservation_en_attente', `${genre} : nouveau POST refusé tant que la réponse attend`);
        quota = false;
        const res = await Promise.all([controle.reessayerConservation({ importId: f.journal.id }), controle.reessayerConservation({ importId: f.journal.id })]);
        eq(res.map(x => x.issue), ['conserve', 'conserve'], `${genre} : doubles réessais rejoignent la même conservation`);
        eq([ecritures, appels], [2, 1], `${genre} : un seul commit de réessai et aucun appel payé supplémentaire`);
        const row = await repo.get('imports', f.journal.id);
        eq([row.status, row.resultat, row.erreur?.raison], ['echec', null, f.motif], `${genre} : état terminal seulement après vraie conservation`);
      } finally { db.mutate = mutation; }
    });
    await run(`${genre} nouveau refus en attente et source devenue différente`, async (repo, db) => {
      const f = await fixture(repo, genre), controle = creerConservationReponseRefusee({ repo });
      const premier = await f.proposer({ reponsesRefusees: controle, fetch: async () => new Response(f.octets) });
      const ancien = await db.get('sync_state', PREFIXE + premier.id), mutation = db.mutate.bind(db);
      let quota = true;
      db.mutate = args => mutation({ ...args, conditions: { ...args.conditions, ...(args.conditions?.sync_state ? {
        sync_state: args.conditions.sync_state.map(c => c.key !== PREFIXE + premier.id ? c : { ...c, fusion: (...lectures) => {
          const r = c.fusion(...lectures);
          if (quota && r != null) throw new DOMException('quota simulé', 'QuotaExceededError');
          return r;
        } }),
      } : {}) } });
      const nouveau = encoder.encode('{"reponse":"incomplète mais payée"');
      try {
        const e = await erreurDe(() => f.proposer({ reponsesRefusees: controle, fetch: async () => {
          await mutation({ origin: 'remote', puts: { recipe_versions: [{ ...f.source, steps: [{ id: 'autre', text: 'Une nouvelle source.' }] }] } });
          return new Response(nouveau);
        } }));
        eq(e?.code, 'conservation_en_attente', `${genre} : nouveau refus payé gardé en attente malgré source périmée`);
        eq((await repo.get('imports', premier.id)).reponse_refusee, premier.reponse_refusee, `${genre} : quota conserve exactement l’ancienne référence`);
        eq(await db.get('sync_state', PREFIXE + premier.id), ancien, `${genre} : quota conserve exactement les anciens octets`);
        eq([...(await controle.reponseEnAttente({ importId: premier.id })).octets], [...nouveau], `${genre} : nouveau corps récupérable sans adopter la source`);
        quota = false;
        const fin = await controle.reessayerConservation({ importId: premier.id });
        eq([fin.issue, fin.journal?.erreur?.raison, fin.journal?.resultat], ['conserve', 'reponse_illisible', null], `${genre} : conservation documentaire possible sans valider la nouvelle source`);
        const lecture = await controle.lire({ importId: premier.id });
        eq([...lecture.octets], [...nouveau], `${genre} : consultation indépendante de la source culinaire`);
        eq((await repo.get('recipe_versions', f.source.id)).steps, [{ id: 'autre', text: 'Une nouvelle source.' }], `${genre} : conservation du brut n’écrase jamais la source concurrente`);
      } finally { db.mutate = mutation; }
    });
    await run(`${genre} source modifiée avant adoption`, async (repo, db) => {
      const f = await fixture(repo, genre), controle = creerConservationReponseRefusee({ repo }), corps = f.valide();
      const r = await f.proposer({ reponsesRefusees: controle, fetch: async () => {
        await db.mutate({ origin: 'remote', puts: { recipe_versions: [{ ...f.source, steps: [{ id: 'autre', text: 'Une source corrigée pendant l’appel.' }] }] } });
        return new Response(corps);
      } });
      eq([r.status, r.resultat, r.erreur?.raison], ['echec', null, 'source_modifiee'], `${genre} : réponse valide refusée si la source a changé`);
      const lu = await controle.lire({ importId: r.id });
      eq([lu.etat, lu.motif, lu.octets ? await sha256Hex(lu.octets) : null], ['disponible', 'source_modifiee', await sha256Hex(corps)], `${genre} : refus d’adoption conserve quand même la réponse payée exacte`);
      eq((await repo.get('recipe_versions', f.source.id)).steps[0].id, 'autre', `${genre} : aucune restauration de l’ancienne source`);
    });
    for (const cible of ['owner', 'epoque', 'tentative', 'connexion', 'session']) await run(`${genre} course ${cible}`, async (repo, db) => {
      const f = await fixture(repo, genre), controle = creerConservationReponseRefusee({ repo }), parti = differe(), retour = differe();
      let session = SESSION, appels = 0;
      const vol = erreurDe(() => f.proposer({ reponsesRefusees: controle, sessionCourante: () => session, fetch: async () => { appels++; parti.resolve(); await retour.promise; return new Response(f.octets); } }));
      await parti.promise;
      if (cible === 'connexion') { db.idb.close(); db.idb = null; await db.open(); }
      else if (cible === 'session') session = { ...SESSION, user: { id: 'u2' } };
      else await db.mutate({ origin: 'remote', puts: cible === 'tentative' ? { imports: [{ ...await db.get('imports', f.journal.id), tentative_id: 'autre-tentative' }] } : { sync_state: [{ key: cible === 'owner' ? 'user_id' : EPOQUE, value: cible === 'owner' ? 'u2' : 'epoque-apres-post' }] } });
      const avant = await db.getSnapshot(['imports', 'sync_state', 'outbox', 'recipe_versions']);
      retour.resolve(); const e = await vol;
      const raison = { owner: 'compte_change', epoque: 'bibliotheque_remplacee', tentative: 'tentative_perimee', connexion: 'contexte_change', session: 'compte_change' }[cible];
      eq(cible === 'session' ? e?.code : e?.extra?.raison, raison, `${genre} ${cible} : portée ou tentative initiale contrôlée au retour`);
      eq(await db.getSnapshot(['imports', 'sync_state', 'outbox', 'recipe_versions']), avant, `${genre} ${cible} : état concurrent exact, aucune réadoption`);
      eq(appels, 1, `${genre} ${cible} : course sans second appel`);
      if (cible !== 'tentative') {
        const attente = await controle.reponseEnAttente({ importId: f.journal.id });
        eq(attente.octets, undefined, `${genre} ${cible} : aucun octet livré sous un compte ou contexte remplacé`);
      }
    });
    await run(`${genre} base remplacée`, async (repo, db) => withDatabase(async autre => {
      const f = await fixture(repo, genre), controle = creerConservationReponseRefusee({ repo }), parti = differe(), retour = differe();
      const vol = erreurDe(() => f.proposer({ reponsesRefusees: controle, fetch: async () => { parti.resolve(); await retour.promise; return new Response(f.octets); } }));
      await parti.promise; const avant = await db.getSnapshot(['imports', 'sync_state', 'outbox']); repo.bindDatabase(autre);
      try {
        const nouvelle = await autre.getSnapshot(['imports', 'sync_state', 'outbox']); retour.resolve(); const e = await vol;
        eq(e?.extra?.raison, 'contexte_change', `${genre} : nouvelle liaison refusée par la capture d’avant POST`);
        eq(await db.getSnapshot(['imports', 'sync_state', 'outbox']), avant, `${genre} : ancienne base inchangée après retour tardif`);
        eq(await autre.getSnapshot(['imports', 'sync_state', 'outbox']), nouvelle, `${genre} : nouvelle base jamais adoptée`);
        eq((await controle.reponseEnAttente({ importId: f.journal.id })).octets, undefined, `${genre} : réponse inaccessible sur une autre base`);
      } finally { repo.bindDatabase(db); retour.resolve(); }
    }));
    await run(`${genre} époque entre capture et départ`, async (repo, db) => {
      const f = await fixture(repo, genre), controle = creerConservationReponseRefusee({ repo }), mutation = db.mutate.bind(db); let atteint = false, apres;
      db.mutate = async args => {
        const debut = !atteint && args.conditions?.imports?.some(c => c.key === f.journal.id && c.attendus?.includes('a_lancer'));
        const r = await mutation(args);
        if (debut) { atteint = true; await mutation({ origin: 'remote', puts: { sync_state: [{ key: EPOQUE, value: 'epoque-apres-transition' }] } }); apres = await db.getSnapshot(['imports', 'sync_state', 'outbox']); }
        return r;
      };
      try {
        const e = await erreurDe(() => f.proposer({ reponsesRefusees: controle, fetch: async () => new Response(f.octets) }));
        eq([atteint, e?.extra?.raison], [true, 'bibliotheque_remplacee'], `${genre} : capture précède vraiment la transition en_cours`);
        eq(await db.getSnapshot(['imports', 'sync_state', 'outbox']), apres, `${genre} : pas de recapture de l’époque d’après le départ`);
      } finally { db.mutate = mutation; }
    });
  }
  await run('repères sans version culinaire', async (repo, db) => {
    const P = await import('../src/domain/reperes-parcours.js'), recipe = { id: 'reference-seule', availability: 'reference_only', original_title: 'Pain du carnet' };
    await db.mutate({ origin: 'remote', puts: { recipes: [recipe], sync_state: [{ key: 'user_id', value: 'u1' }, { key: EPOQUE, value: 'epoque-reference' }] } });
    const controle = creerConservationReponseRefusee({ repo }), deps = { repo, reponsesRefusees: controle, config: CONFIG, enLigne: () => true, fetch: async () => new Response('{') };
    const j = await P.ouvrirReperes({ recipeId: recipe.id }, deps);
    const r = await P.proposerReperes({ importId: j.id, session: SESSION, documentId: 'doc' }, deps);
    eq([r.status, r.source_version_id, r.erreur?.raison], ['echec', null, 'reponse_illisible'], 'Repères : référence sans version garde son parcours existant');
    eq([...(await controle.lire({ importId: j.id })).octets], [123], 'Repères : reçu payé conservé même avant import des instructions');
    const texte = 'Un pain du carnet.', raw = { description_fr: { texte, references: [{ type: 'titre', extrait: 'Pain du carnet' }] }, difficulte: null, temps: null };
    const valide = await P.proposerReperes({ importId: j.id, session: SESSION, documentId: 'doc' }, { ...deps, fetch: async () => new Response(enveloppe(raw)) });
    eq([valide.status, valide.resultat?.description_fr?.texte, valide.resultat?.temps], ['a_verifier', texte, null], 'Repères : vraie proposition sans durée inventée sur référence sans version');
    await P.garderReperes({ importId: j.id, relu: true }, deps);
    const { lireReperes } = await import('../src/domain/reperes.js');
    eq(lireReperes(await repo.get('recipes', recipe.id), null).description_fr, texte, 'Repères : description réellement conservée sans RecipeVersion');
    eq((await controle.lire({ importId: j.id })).etat, 'disponible', 'Repères : Garder la description ne détruit pas le refus précédent');
  });
}
