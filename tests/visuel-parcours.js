import { withRepo } from './sync-fixture.js';

export const recetteReperesTest = () => ({ id: 'r-reperes', original_title: 'Tomates mijotées', availability: 'available', current_version_id: 'v-reperes', personal_notes: 'Note privée à ne pas envoyer' });
export const versionReperesTest = () => ({ id: 'v-reperes', recipe_id: 'r-reperes', kind: 'extraction', servings: 2, ingredients: [{ id: 'i1', source_text: '200 g de tomates', name_text: 'tomates', quantity: { value: 200 }, unit_id: 'g' }], steps: [{ id: 's1', text: 'Faire mijoter les tomates pendant 20 minutes.' }, { id: 's2', text: 'Servir.' }], provenance: {} });
export const SESSION_REPERES = { access_token: 'session-synthetique-reperes', user: { id: 'user-reperes' } };
export const CONFIG_REPERES = { url: 'https://assistant.example', anonKey: 'publique-factice' };
export const reponseReperesTest = () => ({ description_fr: { texte: 'Des tomates doucement mijotées, à servir chaudes.', references: [{type:'titre',extrait:'Tomates'}] }, difficulte: { niveau: 'facile', raison: 'Une cuisson simple à surveiller.', references: [{type:'etape',index:0,extrait:'mijoter'}] }, temps: { total: { min: 20, max: 25, origine: 'estimation_ia', complet: true }, actif: { min: 5, max: 5, origine: 'estimation_ia' }, cuisson: { min: 20, max: 20, origine: 'estimation_ia' }, attentes: null, attentes_incluses: true, explication: 'La préparation active précède la cuisson.', references: [{type:'etape',index:0,extrait:'20 minutes'}] } });
export const reponseAssistantReperes = (v, extra = {}) => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(v) }], stop_reason: 'end_turn', model: 'modele-fixture', ...extra }), { status: 200 });
export async function seedReperes(repo) { await repo.saveBatch({ recipes: [recetteReperesTest()], recipe_versions: [versionReperesTest()] }, { conditions: { recipes: [{ key: 'r-reperes', absente: true }] } }); }
const options = (repo, extra = {}) => ({ repo, enLigne: () => true, config: CONFIG_REPERES, maintenant: () => '2026-10-28T12:00:00.000Z', ...extra });
const entree = () => ({ recipeId: 'r-reperes', versionId: 'v-reperes' });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

export async function runVisuelParcoursTests({ eq, ok }) {
  const P = await import('../src/domain/reperes-parcours.js');
  const run = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, `Repères parcours — ${nom} : ${e.stack || e.message}`); } };
  const refuse = async (fn, code, nom) => { try { await fn(); ok(false, nom); } catch (e) { eq(e.code, code, nom); } };
  await run('brouillon durable et source intacte', async repo => {
    await seedReperes(repo); const source = await repo.get('recipe_versions', 'v-reperes');
    let row = await P.ouvrirReperes(entree(), options(repo));
    eq([row.kind, row.status], ['reperes', 'a_lancer'], 'Repères : journal ouvert sans appel');
    row = await P.modifierBrouillonReperes(row.id, { saisie: { description_fr: 'Ma description.' } }, options(repo));
    eq((await P.lireBrouillonReperes(row.id, options(repo))).saisie.description_fr, 'Ma description.', 'Repères : saisie reprise après fermeture');
    eq(await repo.get('recipe_versions', 'v-reperes'), source, 'Repères : aucune écriture de la version culinaire');
    await refuse(() => P.ouvrirReperes(entree(), options(repo)), 'import_ouvert', 'Repères : un seul brouillon par recette');
  });
  await run('appel, lecture et conservation', async repo => {
    await seedReperes(repo); let calls = 0, corps;
    const d = options(repo, { fetch: async (_url, init) => { calls++; corps = JSON.parse(init.body); return reponseAssistantReperes(reponseReperesTest()); } });
    const row = await P.ouvrirReperes(entree(), d);
    const lu = await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, d);
    eq([lu.status, calls, corps.outil], ['a_verifier', 1, 'creation'], 'Repères : un appel explicite creation');
    ok(!JSON.stringify(corps).includes('Note privée'), 'Repères : notes privées exclues du contexte');
    ok(!JSON.stringify(lu).includes(SESSION_REPERES.access_token), 'Repères : jeton absent du journal');
    await P.lireBrouillonReperes(row.id, d); eq(calls, 1, 'Repères : reprise sans appel');
    await refuse(() => P.garderReperes({ importId: row.id, relu: false }, d), 'relecture_requise', 'Repères : relecture avant conservation');
    const results = await Promise.all([P.garderReperes({ importId: row.id, relu: true }, d), P.garderReperes({ importId: row.id, relu: true }, d)]);
    eq(results[0].id, results[1].id, 'Repères : conservation idempotente');
    eq((await repo.get('imports', row.id)).status, 'enregistre', 'Repères : clôture réelle du journal');
    eq((await repo.all('recipe_versions')).length, 1, 'Repères : aucune nouvelle version culinaire pour présentation');
    eq((await repo.get('recipes', 'r-reperes')).personal_notes, recetteReperesTest().personal_notes, 'Repères : notes privées préservées');
  });
  await run('absence de session et réseau', async repo => {
    await seedReperes(repo); let calls = 0; const d = options(repo, { fetch: async () => { calls++; return reponseAssistantReperes(reponseReperesTest()); } });
    const row = await P.ouvrirReperes(entree(), d);
    await refuse(() => P.proposerReperes({ importId: row.id, session: null, documentId: 'doc' }, d), 'non_connecte', 'Repères : session requise avant réseau');
    await refuse(() => P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, { ...d, enLigne: () => false }), 'hors_ligne', 'Repères : hors ligne sans appel');
    eq(calls, 0, 'Repères : aucune requête sur garde préalable');
  });
  await run('annulation tardive et double appel', async repo => {
    await seedReperes(repo); const parti = deferred(), retour = deferred(); let calls = 0;
    const d = options(repo, { fetch: async () => { calls++; parti.resolve(); await retour.promise; return reponseAssistantReperes(reponseReperesTest()); } });
    const row = await P.ouvrirReperes(entree(), d);
    const p = P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, d); await parti.promise;
    await refuse(() => P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'autre' }, d), 'appel_en_cours', 'Repères : deuxième onglet bloqué');
    await refuse(() => P.annulerReperes(row.id, { ...d, documentId: 'autre' }), 'autre_onglet', 'Repères : seul onglet propriétaire annule');
    await P.annulerReperes(row.id, { ...d, documentId: 'doc' }); retour.resolve(); await p;
    const current = await repo.get('imports', row.id);
    eq([calls, current.status, current.erreur.raison, current.resultat], [1, 'echec', 'annule', null], 'Repères : réponse tardive ne ressuscite pas un appel annulé');
  });
  await run('source et compte changés pendant appel', async repo => {
    await seedReperes(repo); const parti = deferred(), retour = deferred();
    const d = options(repo, { fetch: async () => { parti.resolve(); await retour.promise; return reponseAssistantReperes(reponseReperesTest()); } });
    const row = await P.ouvrirReperes(entree(), d); const p = P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, d); await parti.promise;
    await repo.save('recipes', { ...await repo.get('recipes', 'r-reperes'), original_title: 'Une autre préparation' }); retour.resolve(); await p;
    eq((await repo.get('imports', row.id)).erreur.raison, 'source_modifiee', 'Repères : réponse liée à source périmée refusée');
  });
  await run('réponses non utilisables', async repo => {
    await seedReperes(repo); const row = await P.ouvrirReperes(entree(), options(repo));
    let current = await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, options(repo, { fetch: async () => reponseAssistantReperes({ libre: '<script>' }) }));
    eq([current.status, current.resultat, current.reponse_brute], ['echec', null, null], 'Repères : réponse hostile non conservée');
    current = await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, options(repo, { fetch: async () => reponseAssistantReperes(reponseReperesTest(), { stop_reason: 'max_tokens' }) }));
    eq(current.erreur.raison, 'interrompu', 'Repères : réponse tronquée refusée');
  });
  await run('corrections concurrentes et null durable', async repo => {
    await seedReperes(repo); const parti = deferred(), retour = deferred();
    const d = options(repo, { fetch: async () => { parti.resolve(); await retour.promise; return reponseAssistantReperes(reponseReperesTest()); } });
    const row = await P.ouvrirReperes(entree(), d); const p = P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, d); await parti.promise;
    await P.enregistrerCorrectionsReperes({ ...entree(), corrections: { description_fr: null } }, d);
    await repo.save('recipes', { ...await repo.get('recipes', 'r-reperes'), favorite: true, personal_notes: 'Correction concurrente privée' });
    retour.resolve(); await p; await P.garderReperes({ importId: row.id, relu: true }, d);
    let recipe = await repo.get('recipes', 'r-reperes');
    eq(recipe.reperes.corrections.description_fr.valeur, null, 'Repères : effacement manuel pendant appel conservé');
    eq([recipe.favorite, recipe.personal_notes], [true, 'Correction concurrente privée'], 'Repères : fiche fusionnée depuis dernier état');
    const { lireReperes } = await import('../src/domain/reperes.js');
    eq(lireReperes(recipe, await repo.get('recipe_versions', 'v-reperes')).description_fr, null, 'Repères : null masque durablement la proposition');
    const suivant = await P.ouvrirReperes(entree(), options(repo));
    await P.proposerReperes({ importId: suivant.id, session: SESSION_REPERES, documentId: 'doc' }, options(repo, { fetch: async () => reponseAssistantReperes(reponseReperesTest()) }));
    await P.garderReperes({ importId: suivant.id, relu: true }, options(repo)); recipe = await repo.get('recipes', 'r-reperes');
    eq(recipe.reperes.corrections.description_fr.valeur, null, 'Repères : nouvelle proposition ne restaure pas champ effacé');
  });
  await run('correction ancienne jamais réactivée', async repo => {
    await seedReperes(repo); const d = options(repo);
    await P.enregistrerCorrectionsReperes({ ...entree(), corrections: { description_fr: { texte: 'Mon ancienne description.' } } }, d);
    const avant = (await repo.get('recipes', 'r-reperes')).reperes.corrections.description_fr;
    const sourceB = { ...versionReperesTest(), id: 'v-reperes-b', steps: [{ id: 's1', text: 'Faire mijoter les tomates pendant 30 minutes.' }, { id: 's2', text: 'Servir.' }] };
    await repo.save('recipe_versions', sourceB);
    const row = await P.ouvrirReperes({ recipeId: 'r-reperes', versionId: sourceB.id }, d), raw = reponseReperesTest(); raw.temps = null;
    await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, { ...d, fetch: async () => reponseAssistantReperes(raw) });
    await P.garderReperes({ importId: row.id, relu: true }, d);
    const recipe = await repo.get('recipes', 'r-reperes'), { lireReperes } = await import('../src/domain/reperes.js'); const lu = lireReperes(recipe, sourceB);
    eq(recipe.reperes.historiques.find(h => h.corrections.description_fr)?.corrections.description_fr, avant, 'Repères : chaque correction conservée garde sa propre signature');
    eq([lu.description_fr, lu.champs.description_fr.etat], [raw.description_fr.texte, 'courant'], 'Repères : proposition B s’affiche sur B sans réattribuer la correction A');
    eq(lireReperes(recipe, versionReperesTest()).description_fr, avant.valeur.texte, 'Repères : correction A toujours disponible sur sa version A');
    await P.enregistrerCorrectionsReperes({ recipeId: recipe.id, versionId: sourceB.id, corrections: { description_fr: avant.valeur } }, d);
    eq(lireReperes(await repo.get('recipes', recipe.id), sourceB).description_fr, avant.valeur.texte, 'Repères : confirmation explicite peut lier correction à B');
  });
  await run('source relue dans transaction de conservation', async repo => {
    await seedReperes(repo); const d = options(repo, { fetch: async () => reponseAssistantReperes(reponseReperesTest()) });
    const row = await P.ouvrirReperes(entree(), d); await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, d);
    const concurrent = { ...repo, transitionner: async (...args) => { await repo.save('recipes', { ...await repo.get('recipes', 'r-reperes'), original_title: 'Titre changé avant transaction' }); return repo.transitionner(...args); } };
    await refuse(() => P.garderReperes({ importId: row.id, relu: true }, { ...d, repo: concurrent }), 'source_modifiee', 'Repères : source changée juste avant commit refusée');
    eq((await repo.get('imports', row.id)).status, 'a_verifier', 'Repères : clôture annulée atomiquement avec refus source');
    eq((await repo.get('recipes', 'r-reperes')).reperes, undefined, 'Repères : aucune proposition partielle écrite');
    const lu = await P.lireBrouillonReperes(row.id, d); eq(lu.validation_erreur, 'source_modifiee', 'Repères : brouillon périmé reste lisible pour récupération');
  });
  await run('compte changé pendant appel', async repo => {
    await seedReperes(repo); const parti = deferred(), retour = deferred(); let session = SESSION_REPERES;
    const d = options(repo, { sessionCourante: () => session, fetch: async () => { parti.resolve(); await retour.promise; return reponseAssistantReperes(reponseReperesTest()); } });
    const row = await P.ouvrirReperes(entree(), d), p = P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, d); await parti.promise;
    const avant = await repo.get('imports', row.id); session = null; retour.resolve(); await refuse(() => p, 'compte_change', 'Repères : changement de compte refuse retour');
    eq(await repo.get('imports', row.id), avant, 'Repères : aucune écriture tardive après changement de compte');
  });
  await run('appareil propriétaire et copie terminée', async repo => {
    await seedReperes(repo); const d = options(repo), row = await P.ouvrirReperes(entree(), d), autre = { ...repo, deviceId: () => 'autre-appareil-reperes' };
    eq((await P.lireBrouillonReperes(row.id, { repo: autre })).lecture_seule, true, 'Repères : brouillon distant en lecture seule');
    await refuse(() => P.modifierBrouillonReperes(row.id, { saisie: { description_fr: 'Ne pas écrire' } }, { repo: autre }), 'autre_appareil', 'Repères : autre appareil ne modifie pas');
    await refuse(() => P.copierBrouillonReperes(row.id, { repo: autre }), 'brouillon_ouvert', 'Repères : copie seulement après clôture');
    eq((await P.ignorerReperes(row.id, { repo: autre })).status, 'ignore', 'Repères : autre appareil peut clôturer volontairement sans appliquer le résultat');
    eq((await repo.all('imports')).length, 1, 'Repères : abandon ne copie pas automatiquement un brouillon terminal');
    await P.ignorerReperes(row.id, d); const copie = await P.copierBrouillonReperes(row.id, { repo: autre });
    eq([copie.copie_de, copie.device_id, copie.status], [row.id, 'autre-appareil-reperes', 'a_lancer'], 'Repères : copie distincte appartient au nouvel appareil');
  });
  await run('référence et contexte manuel périmé', async repo => {
    await repo.save('recipes', { id: 'reference', original_title: 'Tomates confites', availability: 'reference_only' }, { conditions: { recipes: [{ key: 'reference', absente: true }] } }); const d = options(repo);
    const row = await P.ouvrirReperes({ recipeId: 'reference' }, d);
    eq(row.contexte.version_id, null, 'Repères : référence seule sans version fictive');
    await P.enregistrerCorrectionsReperes({ recipeId: 'reference', corrections: { description_fr: { texte: 'Une recette de tomates.' } }, importId: row.id }, d);
    eq((await repo.all('recipe_versions')).length, 0, 'Repères : description de référence ne crée aucune version');
    await seedReperes(repo); const { construireContexteReperes } = await import('../src/domain/reperes.js'); const contexte = construireContexteReperes({ recipe: recetteReperesTest(), version: versionReperesTest() });
    await repo.save('recipes', { ...recetteReperesTest(), original_title: 'Titre changé' });
    await refuse(() => P.enregistrerCorrectionsReperes({ ...entree(), contexte, corrections: { description_fr: null } }, d), 'source_modifiee', 'Repères : formulaire ancien ne réassocie pas correction silencieusement');
  });

  await run('idempotence avec preuve de conservation', async repo => {
    await seedReperes(repo); const d = options(repo, { fetch: async () => reponseAssistantReperes(reponseReperesTest()) });
    const row = await P.ouvrirReperes(entree(), d); await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc' }, d); await P.garderReperes({ importId: row.id, relu: true }, d);
    const recipe = await repo.get('recipes', 'r-reperes'); delete recipe.reperes; await repo.save('recipes', recipe);
    await refuse(() => P.garderReperes({ importId: row.id, relu: true }, d), 'conservation_absente', 'Repères : journal terminal seul ne prouve pas la proposition enregistrée');
    eq((await repo.get('recipes', 'r-reperes')).reperes, undefined, 'Repères : reprise terminale ne réécrit jamais proposition disparue');
  });

}
