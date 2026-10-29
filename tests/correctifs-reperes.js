import { withRepo } from './sync-fixture.js';
import { sourceReperes, reponseReperes } from './visuel-reperes.js';
import { seedReperes, reponseReperesTest, reponseAssistantReperes, SESSION_REPERES, CONFIG_REPERES } from './visuel-parcours.js';
import * as R from '../src/domain/reperes.js';
import * as P from '../src/domain/reperes-parcours.js';
import { renderReperesRoute, texteErreurReperes } from '../src/ui/reperes.js';
const input = (n, v) => { n.value = v; n.dispatchEvent(new Event(n.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
const refuse = fn => { try { fn(); return false; } catch { return true; } };
const deps = repo => ({ repo, sessionAssistant: async () => SESSION_REPERES, config: CONFIG_REPERES, enLigne: () => true, navigate: () => {}, remplacerAdresse: () => {}, toast: () => {}, fetch: async () => reponseAssistantReperes(reponseReperesTest()) });

export async function runCorrectifsReperesTests({ eq, ok }) {
  for (const [code, attendu] of [['reseau', 'connexion'], ['serveur', 'indisponible'], ['delai', 'à temps'], ['reponse_illisible', 'pu être lue'], ['refus', 'pas proposé']]) {
    ok(texteErreurReperes({ code }).includes(attendu), 'Correctifs repères : erreur ' + code + ' expliquée sans demander de modifier les durées');
  }
  const { recipe, version } = sourceReperes();
  for (const texte of ['Cuire 20 à 25 minutes.', 'Cuire de 20 à 25 min.', 'Cuire 20–25 min.', 'Cuire 20-25 minutes.']) {
    const source = { ...version, steps: [{ text: texte }] }, contexte = R.construireContexteReperes({ recipe, version: source });
    const raw = { description_fr: null, difficulte: null, temps: { total: null, actif: null, cuisson: { min: 20, max: 25, origine: 'source' }, attentes: null, attentes_incluses: null, explication: '', references: [{ type: 'etape', index: 0, extrait: texte }] } };
    let lu; try { lu = R.validerReponseReperes(raw, contexte); } catch {}
    eq(lu?.temps.cuisson, raw.temps.cuisson, 'Correctifs repères : fourchette explicite conservée ' + texte);
    ok(refuse(() => R.validerReponseReperes({ ...raw, temps: { ...raw.temps, cuisson: { min: 20, max: 20, origine: 'source' } } }, contexte)), 'Correctifs repères : une borne de la fourchette ne devient pas durée exacte');
  }
  const c1 = R.construireContexteReperes({ recipe, version }), v2 = { ...version, id: 'autre-version' }, c2 = R.construireContexteReperes({ recipe, version: v2 });
  const corr = (texte, c) => R.fabriquerCorrectionsReperes({ description_fr: { texte } }, c);
  let enveloppe = R.fusionnerReperes(null, { corrections: corr('Description de la première version.', c1) });
  enveloppe = R.fusionnerReperes(enveloppe, { corrections: corr('Description de la seconde version.', c2) });
  eq(R.lireReperes({ ...recipe, reperes: enveloppe }, version).description_fr, 'Description de la première version.', 'Correctifs repères : première version conserve sa description');
  eq(R.lireReperes({ ...recipe, reperes: enveloppe }, v2).description_fr, 'Description de la seconde version.', 'Correctifs repères : seconde version conserve sa description');
  const sourceChangee = { ...version, steps: [{ text: 'Autre préparation.' }] };
  eq(R.lireReperes({ ...recipe, reperes: enveloppe }, sourceChangee).description_fr, null, 'Correctifs repères : même identifiant et signature différente restent périmés');
  eq(R.lireReperes({ ...recipe, reperes: { revision: 1, proposition: null, corrections: corr('Ancienne description conservée.', c1) } }, version).description_fr, 'Ancienne description conservée.', 'Correctifs repères : anciennes données revision1 lisibles');
  const raw = reponseReperes(), proposition = R.fabriquerPropositionReperes({ contexte: c1, resultat: raw, modele: 'fixture' });
  const premiere = R.fabriquerCorrectionsReperes({ temps: { ...raw.temps, actif: { min: 6, max: 6, origine: 'manuel' } } }, c1, undefined, { champsTempsModifies: ['actif'], baseTemps: raw.temps });
  const seconde = R.fabriquerCorrectionsReperes({ temps: { ...raw.temps, total: { min: 30, max: 35, origine: 'manuel', complet: true } } }, c1, undefined, { champsTempsModifies: ['total'], baseTemps: raw.temps });
  const ensemble = R.fusionnerReperes(R.fusionnerReperes(null, { proposition, corrections: premiere }), { corrections: seconde });
  eq(R.lireReperes({ ...recipe, reperes: ensemble }, version).temps.actif, { min: 6, max: 6, origine: 'manuel' }, 'Correctifs repères : correction d’un autre champ depuis copie ancienne garde la correction concurrente');
  const nouvelleEstimation = { ...raw, temps: { ...raw.temps, total: { min: 50, max: 55, origine: 'estimation_ia', complet: true }, actif: { min: 40, max: 40, origine: 'estimation_ia' } } };
  const totalCorrige = R.fusionnerReperes(null, { proposition, corrections: seconde });
  ok(refuse(() => R.fusionnerReperes(totalCorrige, { proposition: R.fabriquerPropositionReperes({ contexte: c1, resultat: nouvelleEstimation, modele: 'fixture' }) })), 'Correctifs repères : nouvelle estimation incompatible avec total corrigé demande relecture sans fausse durée rapide');

  const { createArchive, inspectArchive, applyArchive } = await import('../src/domain/backup.js');
  const { withDatabase } = await import('./backup.js');
  await withRepo(async (repo, db) => {
    await repo.saveBatch({ recipes: [{ ...recipe, reperes: enveloppe }], recipe_versions: [version, v2] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
    const archive = await createArchive(db), inspection = await inspectArchive(await archive.blob.arrayBuffer());
    ok(inspection.ok, 'Correctifs repères : archive accepte enveloppe2 et ses deux versions');
    await withDatabase(async cible => {
      await applyArchive(cible, inspection);
      const restauree = await cible.get('recipes', recipe.id);
      eq([R.lireReperes(restauree, version).description_fr, R.lireReperes(restauree, v2).description_fr], ['Description de la première version.', 'Description de la seconde version.'], 'Correctifs repères : archive restaure chaque description avec sa source');
    });
  });

  let volumineux = null, dernier = null, premiereVersion = null, limite = null;
  for (let i = 0; i < 100; i++) {
    const v = { ...version, id: 'version-longue-' + i, steps: [{ text: 'Cuire. ' + 'a'.repeat(7000) }] };
    premiereVersion ||= v;
    const c = R.construireContexteReperes({ recipe, version: v });
    dernier = JSON.stringify(volumineux);
    try { volumineux = R.fusionnerReperes(volumineux, { corrections: corr('Description longue ' + i + '.', c) }); }
    catch (e) { limite = e; break; }
  }
  eq(limite?.raison, 'reperes_trop_grands', 'Correctifs repères : limite annoncée sans purge de l’historique');
  eq(JSON.stringify(volumineux), dernier, 'Correctifs repères : dépassement laisse ancienne enveloppe intacte');
  eq(R.lireReperes({ ...recipe, reperes: volumineux }, premiereVersion).description_fr, 'Description longue 0.', 'Correctifs repères : première description encore lisible à la limite');

  await withRepo(async repo => {
    await seedReperes(repo); const root = await renderReperesRoute({ id: 'r-reperes' }, {}, {}, deps(repo)); document.body.append(root);
    try {
      root.querySelector('[data-role=proposer-reperes]').click(); await root.attendreEcritures();
      input(root.querySelector('[name=actif_min]'), '6'); input(root.querySelector('[name=actif_max]'), '6'); await root.attendreEcritures();
      eq(root.querySelector('[data-role=enregistrer-reperes]').disabled, true, 'Correctifs repères : corrections d’une proposition attendent la relecture');
      const relu = root.querySelector('[name=relecture]'); relu.checked = true; relu.dispatchEvent(new Event('change', { bubbles: true }));
      root.querySelector('[data-role=enregistrer-reperes]').click(); await root.attendreEcritures();
      const saved = await repo.get('recipes', 'r-reperes'), version = await repo.get('recipe_versions', 'v-reperes'), lu = R.lireReperes(saved, version);
      eq(lu.description_fr, reponseReperesTest().description_fr.texte, 'Correctifs repères : enregistrer corrections conserve description proposée non touchée');
      eq(lu.difficulte?.niveau, 'facile', 'Correctifs repères : difficulté proposée non touchée conservée');
      eq(lu.temps?.actif, { min: 6, max: 6, origine: 'manuel' }, 'Correctifs repères : durée corrigée attribuée à la personne');
      eq(lu.temps?.total?.origine, 'estimation_ia', 'Correctifs repères : total non touché reste estimation');
      eq(lu.temps?.cuisson?.origine, 'estimation_ia', 'Correctifs repères : cuisson non touchée reste estimation');
      ok(R.formaterDureeReperes(lu.temps?.total)?.startsWith('≈ '), 'Correctifs repères : marque approximative du total conservée');
    } finally { root.dispose(); root.remove(); }
  });
  await withRepo(async repo => {
    await seedReperes(repo);
    const autre = { ...repo, deviceId: () => 'ancien-appareil' }, row = await P.ouvrirReperes({ recipeId: 'r-reperes', versionId: 'v-reperes' }, { repo: autre });
    await repo.transitionner('imports', row.id, { attendus: ['a_lancer'], patch: { status: 'a_verifier', resultat: reponseReperesTest(), reponse_brute: 'réponse conservée' } });
    let confirmations = 0;
    const root = await renderReperesRoute({ id: 'r-reperes' }, { import: row.id }, {}, { ...deps(repo), confirmDialog: async () => { confirmations++; return true; } }); document.body.append(root);
    try {
      eq(root.querySelector('[data-role=ignorer-reperes]').disabled, false, 'Correctifs repères : ancien appareil n’empêche pas abandon volontaire');
      root.querySelector('[data-role=ignorer-reperes]').click(); await root.attendreEcritures();
      const ferme = await repo.get('imports', row.id);
      eq([confirmations, ferme.status], [1, 'ignore'], 'Correctifs repères : clôture distante après confirmation explicite');
      eq([ferme.resultat, ferme.reponse_brute], [reponseReperesTest(), 'réponse conservée'], 'Correctifs repères : abandon conserve réponse payée du journal');
    } finally { root.dispose(); root.remove(); }
  });
  await withRepo(async repo => {
    await seedReperes(repo); let appels = 0;
    const d = { ...deps(repo), fetch: async () => { appels++; if (appels === 2) throw new TypeError('Réseau interrompu'); return reponseAssistantReperes(reponseReperesTest()); } };
    const row = await P.ouvrirReperes({ recipeId: 'r-reperes', versionId: 'v-reperes' }, d);
    await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc-test' }, d);
    const modifie = await P.modifierBrouillonReperes(row.id, { saisie: { description_fr: 'Ma précision.' }, champs_modifies: ['description_fr'] }, d);
    eq(modifie.proposition_precedente?.resultat, reponseReperesTest(), 'Correctifs repères : première saisie met la réponse payée à l’abri');
    await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc-test' }, d);
    const echec = await P.lireBrouillonReperes(row.id, d);
    eq([echec.status, echec.erreur?.raison, echec.proposition_precedente?.resultat], ['echec', 'reseau', reponseReperesTest()], 'Correctifs repères : échec de relance conserve réponse précédente consultable');
    let code; try { await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc-test' }, d); } catch (e) { code = e.code; }
    eq([code, appels], ['resultat_precedent_a_traiter', 2], 'Correctifs repères : troisième départ refusé sans écraser ni payer');
    if (typeof P.reprendrePropositionReperes !== 'function') { ok(false, 'Correctifs repères : reprise explicite disponible'); return; }
    const reprise = await P.reprendrePropositionReperes(row.id, { ...d, attendu: echec });
    eq([reprise.status, reprise.resultat, appels], ['a_verifier', reponseReperesTest(), 2], 'Correctifs repères : reprendre résultat précédent sans nouvel appel');
  });
  await withRepo(async repo => {
    await seedReperes(repo); let appels = 0;
    const d = { ...deps(repo), fetch: async () => { appels++; if (appels === 2) throw new TypeError('Réseau interrompu'); return reponseAssistantReperes(reponseReperesTest()); } };
    let root = await renderReperesRoute({ id: 'r-reperes' }, {}, {}, d); document.body.append(root);
    try {
      root.querySelector('[data-role=proposer-reperes]').click(); await root.attendreEcritures();
      input(root.querySelector('[name=description_fr]'), 'Précision manuelle conservée.'); await root.attendreEcritures();
      root.querySelector('[data-role=proposer-reperes]').click(); await root.attendreEcritures();
      const id = root.etatRoute().importId; root.dispose(); root.remove();
      root = await renderReperesRoute({ id: 'r-reperes' }, { import: id }, {}, d); document.body.append(root);
      ok(root.querySelector('[data-role=resultat-precedent]').textContent.includes(reponseReperesTest().description_fr.texte), 'Correctifs repères : réponse précédente visible après échec et rechargement');
      eq(root.querySelector('[data-role=proposer-reperes]').disabled, true, 'Correctifs repères : écran bloque nouveau paiement tant que précédent à traiter');
      root.querySelector('[data-role=reprendre-resultat-precedent]').click(); await root.attendreEcritures();
      eq([(await repo.get('imports', id)).status, appels], ['a_verifier', 2], 'Correctifs repères : reprise écran avec contexte courant sans appel');
      eq(root.querySelector('[name=description_fr]').value, 'Précision manuelle conservée.', 'Correctifs repères : reprise conserve aussi la saisie manuelle');
      eq(root.querySelector('[name=relecture]').checked, false, 'Correctifs repères : reprise exige une nouvelle relecture');
    } finally { root.dispose(); root.remove(); }
  });
  await withRepo(async repo => {
    await seedReperes(repo); let appels = 0;
    const seconde = reponseReperesTest(); seconde.description_fr.texte = 'Une seconde description à relire.';
    const d = { ...deps(repo), fetch: async () => reponseAssistantReperes(++appels === 1 ? reponseReperesTest() : seconde) };
    const row = await P.ouvrirReperes({ recipeId: 'r-reperes', versionId: 'v-reperes' }, d);
    await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc-test' }, d);
    await P.proposerReperes({ importId: row.id, session: SESSION_REPERES, documentId: 'doc-test' }, d);
    const courant = await P.lireBrouillonReperes(row.id, d);
    const retour = await P.reprendrePropositionReperes(row.id, { ...d, attendu: courant });
    eq([retour.resultat.description_fr.texte, retour.proposition_precedente.resultat.description_fr.texte, appels], [reponseReperesTest().description_fr.texte, seconde.description_fr.texte, 2], 'Correctifs repères : reprendre A échange B au lieu de le perdre');
    await repo.save('recipe_versions', { ...await repo.get('recipe_versions', 'v-reperes'), steps: [{ text: 'Autre préparation.' }] });
    let code; try { await P.reprendrePropositionReperes(row.id, d); } catch (e) { code = e.code; }
    eq(code, 'source_modifiee', 'Correctifs repères : ancienne source interdit reprise automatique');
    eq((await repo.get('imports', row.id)).proposition_precedente.resultat.description_fr.texte, seconde.description_fr.texte, 'Correctifs repères : refus source conserve le résultat précédent');
  });
  for (const action of ['garder-reperes', 'enregistrer-reperes']) await withRepo(async repo => {
    await seedReperes(repo);
    const d = deps(repo), root = await renderReperesRoute({ id: 'r-reperes' }, {}, {}, d); document.body.append(root);
    try {
      root.querySelector('[data-role=proposer-reperes]').click(); await root.attendreEcritures();
      if (action === 'enregistrer-reperes') { input(root.querySelector('[name=description_fr]'), 'Ma correction de la première réponse.'); await root.attendreEcritures(); }
      const relu = root.querySelector('[name=relecture]'); relu.checked = true; relu.dispatchEvent(new Event('change', { bubbles: true }));
      const id = root.etatRoute().importId, affiche = await P.lireBrouillonReperes(id, d), autre = reponseReperesTest(); autre.description_fr.texte = 'Nouvelle réponse reçue dans un autre onglet.';
      await P.proposerReperes({ importId: id, session: SESSION_REPERES, documentId: 'autre-onglet' }, { ...d, fetch: async () => reponseAssistantReperes(autre) });
      let refus;
      try {
        if (action === 'garder-reperes') await P.garderReperes({ importId: id, relu: true, attendu: affiche }, d);
        else await P.enregistrerCorrectionsReperes({ recipeId: 'r-reperes', versionId: 'v-reperes', importId: id, relu: true, corrections: {}, attendu: affiche }, d);
      } catch (e) { refus = e.code; }
      eq(refus, 'brouillon_modifie', 'Correctifs repères : ' + action + ' protège aussi la conservation après la persistance du formulaire');
      root.querySelector(`[data-role=${action}]`).click(); await root.attendreEcritures();
      const journal = await repo.get('imports', id);
      eq([(await repo.get('recipes', 'r-reperes')).reperes ?? null, journal.status], [null, 'a_verifier'], 'Correctifs repères : ' + action + ' refuse une réponse remplacée après relecture');
      eq([journal.resultat.description_fr.texte, journal.proposition_precedente.resultat.description_fr.texte], [autre.description_fr.texte, reponseReperesTest().description_fr.texte], 'Correctifs repères : conflit conserve les deux réponses payées');
      eq(root.querySelector('[data-role=actualiser-reperes]').hidden, false, 'Correctifs repères : conflit rend l’actualisation accessible');
      root.querySelector('[data-role=actualiser-reperes]').click(); await root.attendreEcritures();
      eq(root.querySelector('[name=relecture]').checked, false, 'Correctifs repères : nouvelle réponse exige nouvelle relecture après actualisation');
    } finally { root.dispose(); root.remove(); }
  });
}
