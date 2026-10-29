import { withRepo } from './sync-fixture.js';
import { seedReperes, reponseReperesTest, reponseAssistantReperes, SESSION_REPERES, CONFIG_REPERES } from './visuel-parcours.js';
const input = (n, v) => { n.value = v; n.dispatchEvent(new Event(n.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
const cocher = n => { n.checked = true; n.dispatchEvent(new Event('change', { bubbles: true })); };
const depsDe = (repo, extra = {}) => ({ repo, sessionAssistant: async () => SESSION_REPERES, config: CONFIG_REPERES, enLigne: () => true, navigate: () => {}, remplacerAdresse: () => {}, toast: () => {}, ...extra });
export async function runVisuelReperesEcranTests({ eq, ok }) {
  const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js'); const avant = getUiLocale(); setUiLocale('fr');
  const { renderReperesRoute } = await import('../src/ui/reperes.js');
  const run = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, `Repères écran — ${nom} : ${e.stack || e.message}`); } };
  try {
    await run('saisie manuelle hors ligne et reprise', async repo => {
      await seedReperes(repo); let calls = 0, online = false; const deps = depsDe(repo, { sessionAssistant: async () => null, enLigne: () => online, fetch: async () => { calls++; } });
      let root = await renderReperesRoute({ id: 'r-reperes' }, { v: 'v-reperes' }, {}, deps); document.body.append(root);
      try {
        eq(calls, 0, 'Repères écran : aucun appel à ouverture');
        eq(root.querySelector('header > a').getAttribute('href'), '#/recipes/r-reperes?v=v-reperes', 'Repères écran : retour à la version affichée sans adresse indéfinie');
        eq(root.querySelector('[data-role=proposer-reperes]').disabled, true, 'Repères écran : appel indisponible hors ligne');
        eq(root.querySelector('h1').textContent, 'Description en français', 'Repères écran : titre court indique ce que la personne va compléter');
        const indisponible = root.querySelector('[data-role=disponibilite-assistant]');
        eq(indisponible?.textContent, 'Tu es hors ligne. La saisie manuelle reste disponible.', 'Repères écran : raison hors ligne visible près du bouton');
        ok(indisponible && (indisponible.compareDocumentPosition(root.querySelector('.reperes-formulaire')) & Node.DOCUMENT_POSITION_FOLLOWING), 'Repères écran : raison visible avant le long formulaire');
        online = true; window.dispatchEvent(new Event('online'));
        eq(indisponible?.textContent, 'Connecte-toi pour utiliser l’assistant. Les corrections manuelles restent disponibles.', 'Repères écran : retour en ligne sans compte explique la connexion nécessaire');
        eq(root.querySelector('[name=description_fr]').disabled, false, 'Repères écran : description modifiable sans compte malgré assistant indisponible');
        online = false; window.dispatchEvent(new Event('offline'));
        input(root.querySelector('[name=description_fr]'), 'Mes tomates mijotées.'); await root.attendreEcritures();
        const importId = root.etatRoute().importId; ok(!!importId, 'Repères écran : saisie durable'); root.dispose(); root.remove();
        root = await renderReperesRoute({ id: 'r-reperes' }, { import: importId }, {}, deps); document.body.append(root);
        eq(root.querySelector('[name=description_fr]').value, 'Mes tomates mijotées.', 'Repères écran : saisie retrouvée sans compte');
        root.querySelector('[data-role=enregistrer-reperes]').click(); await root.attendreEcritures();
        eq((await repo.get('recipes', 'r-reperes')).reperes.corrections.description_fr.valeur.texte, 'Mes tomates mijotées.', 'Repères écran : correction écrite hors ligne');
        eq((await repo.get('imports', importId)).status, 'enregistre', 'Repères écran : saisie réellement conservée'); eq(calls, 0, 'Repères écran : manuel sans assistant');
      } finally { root.dispose(); root.remove(); }
    });
    await run('retour en ligne sans appel automatique', async repo => {
      await seedReperes(repo); let online = false, calls = 0;
      const root = await renderReperesRoute({ id: 'r-reperes' }, {}, {}, depsDe(repo, { enLigne: () => online, fetch: async () => { calls++; return reponseAssistantReperes(reponseReperesTest()); } })); document.body.append(root);
      try {
        const bouton = root.querySelector('[data-role=proposer-reperes]'), raison = root.querySelector('[data-role=disponibilite-assistant]');
        eq([bouton.disabled, raison?.hidden], [true, false], 'Repères écran : compte connecté hors ligne garde une raison affichée');
        bouton.click(); await root.attendreEcritures();
        eq(calls, 0, 'Repères écran : bouton indisponible ne lance pas de requête');
        online = true; window.dispatchEvent(new Event('online'));
        eq([bouton.disabled, raison?.hidden], [false, true], 'Repères écran : retour en ligne rend le bouton disponible et retire la raison obsolète');
        eq(calls, 0, 'Repères écran : retour en ligne ne déclenche aucun appel');
        online = false; window.dispatchEvent(new Event('offline'));
        eq([bouton.disabled, raison?.hidden], [true, false], 'Repères écran : nouvelle perte réseau réaffiche la raison');
      } finally { root.dispose(); root.remove(); }
    });
    await run('appel explicite et relecture', async repo => {
      await seedReperes(repo); let calls = 0;
      const root = await renderReperesRoute({ id: 'r-reperes' }, {}, {}, depsDe(repo, { fetch: async () => { calls++; return reponseAssistantReperes(reponseReperesTest()); } })); document.body.append(root);
      try {
        root.querySelector('[data-role=proposer-reperes]').click(); root.querySelector('[data-role=proposer-reperes]').click(); await root.attendreEcritures();
        eq(calls, 1, 'Repères écran : double clic un seul appel');
        ok(root.querySelector('[data-role=comparaison-reperes]').textContent.includes('Des tomates doucement'), 'Repères écran : proposition comparée avant écriture');
        eq((await repo.get('recipes', 'r-reperes')).reperes, undefined, 'Repères écran : proposition non enregistrée automatiquement');
        eq(root.querySelector('[data-role=garder-reperes]').disabled, true, 'Repères écran : relecture exigée');
        input(root.querySelector('[name=description_fr]'), 'Ma description corrigée.'); await root.attendreEcritures(); cocher(root.querySelector('[name=relecture]'));
        root.querySelector('[data-role=garder-reperes]').click(); await root.attendreEcritures();
        const recipe = await repo.get('recipes', 'r-reperes'); eq(recipe.reperes.corrections.description_fr.valeur.texte, 'Ma description corrigée.', 'Repères écran : proposition conservée avec correction choisie');
        eq(recipe.reperes.proposition.difficulte.niveau, 'facile', 'Repères écran : proposition complète conservée');
      } finally { root.dispose(); root.remove(); }
    });
    await run('champs invalides et référence sans version', async repo => {
      await repo.save('recipes', { id: 'reference', original_title: 'Tomates confites', availability: 'reference_only' });
      const root = await renderReperesRoute({ id: 'reference' }, {}, {}, depsDe(repo)); document.body.append(root);
      try { eq(root.querySelector('[name=niveau]').disabled, true, 'Repères écran : référence sans version description seule'); input(root.querySelector('[name=description_fr]'), 'Une recette de tomates.'); await root.attendreEcritures(); root.querySelector('[data-role=enregistrer-reperes]').click(); await root.attendreEcritures(); ok(!!(await repo.get('recipes', 'reference')).reperes, 'Repères écran : référence descriptive enregistrée'); }
      finally { root.dispose(); root.remove(); }
    });

    await run('plages invalides conservées', async repo => {
      await seedReperes(repo); const root = await renderReperesRoute({ id: 'r-reperes' }, {}, {}, depsDe(repo, { enLigne: () => false })); document.body.append(root);
      try {
        input(root.querySelector('[name=total_min]'), '30'); input(root.querySelector('[name=total_max]'), '10'); await root.attendreEcritures();
        root.querySelector('[data-role=enregistrer-reperes]').click(); await root.attendreEcritures();
        eq((await repo.get('recipes', 'r-reperes')).reperes, undefined, 'Repères écran : plage inversée ne produit pas faux enregistrement');
        eq(root.querySelector('[name=total_min]').value, '30', 'Repères écran : valeur invalide reste corrigeable');
        eq((await repo.get('imports', root.etatRoute().importId)).saisie.total_max, '10', 'Repères écran : saisie invalide reprise durablement');
        input(root.querySelector('[name=total_max]'), '35'); input(root.querySelector('[name=attentes_incluses]'), 'true'); input(root.querySelector('[name=complet]'), 'true'); await root.attendreEcritures();
        root.querySelector('[data-role=enregistrer-reperes]').click(); await root.attendreEcritures();
        eq((await repo.get('recipes', 'r-reperes')).reperes.corrections.temps.valeur.total, { min: 30, max: 35, origine: 'manuel', complet: true }, 'Repères écran : bornes et provenance manuelles conservées');
      } finally { root.dispose(); root.remove(); }
    });
    await run('appareil distant en lecture seule', async repo => {
      await seedReperes(repo); const P = await import('../src/domain/reperes-parcours.js');
      const autre = { ...repo, deviceId: () => 'appareil-distant' }, row = await P.ouvrirReperes({ recipeId: 'r-reperes', versionId: 'v-reperes' }, { repo: autre });
      const navigations = [], root = await renderReperesRoute({ id: 'r-reperes' }, { import: row.id }, {}, depsDe(repo, { navigate: p => navigations.push(p) })); document.body.append(root);
      try {
        eq(root.querySelector('[name=description_fr]').disabled, true, 'Repères écran : saisie distante désactivée');
        eq(root.querySelector('[data-role=ignorer-reperes]').disabled, true, 'Repères écran : clôture distante désactivée');
        eq(root.querySelector('[data-role=proposer-reperes]').disabled, true, 'Repères écran : appareil distant sans appel');
        await P.ignorerReperes(row.id, { repo: autre }); root.querySelector('[data-role=actualiser-reperes]').click(); await root.attendreEcritures();
        eq(root.querySelector('[data-role=copier-reperes]').hidden, false, 'Repères écran : copie offerte après clôture distante');
        root.querySelector('[data-role=copier-reperes]').click(); await root.attendreEcritures();
        const copie = (await repo.all('imports')).find(i => i.id !== row.id);
        eq(copie.device_id, repo.deviceId(), 'Repères écran : copie écrite pour cet appareil'); ok(navigations[0]?.includes(copie.id), 'Repères écran : navigation vers copie réelle');
      } finally { root.dispose(); root.remove(); }
    });
    await run('correction périmée confirmée explicitement', async repo => {
      await seedReperes(repo); const P = await import('../src/domain/reperes-parcours.js'), R = await import('../src/domain/reperes.js');
      await P.enregistrerCorrectionsReperes({ recipeId: 'r-reperes', versionId: 'v-reperes', corrections: { description_fr: { texte: 'Mon texte antérieur.' } } }, { repo });
      const version = { ...await repo.get('recipe_versions', 'v-reperes'), id: 'v-autre' }; await repo.save('recipe_versions', version);
      const root = await renderReperesRoute({ id: 'r-reperes' }, { v: version.id }, {}, depsDe(repo)); document.body.append(root);
      try {
        eq(root.querySelector('[name=description_fr]').value, 'Mon texte antérieur.', 'Repères écran : ancienne valeur disponible pour relecture');
        ok(root.textContent.includes('À revoir après modification'), 'Repères écran : péremption explicitement visible');
        eq(root.querySelector('[data-role=enregistrer-reperes]').disabled, true, 'Repères écran : ancienne correction non confirmée à ouverture');
        root.querySelector('[data-role=confirmer-description_fr]').click(); await root.attendreEcritures(); root.querySelector('[data-role=enregistrer-reperes]').click(); await root.attendreEcritures();
        eq(R.lireReperes(await repo.get('recipes', 'r-reperes'), version).description_fr, 'Mon texte antérieur.', 'Repères écran : confirmation volontaire lie nouvelle version affichée');
      } finally { root.dispose(); root.remove(); }
    });
    await run('changement de compte ferme les gestes', async repo => {
      await seedReperes(repo); let changement, signalParti, signalRetour;
      const parti = new Promise(r => { signalParti = r; }), retour = new Promise(r => { signalRetour = r; });
      const ctx = { sync: { user: SESSION_REPERES.user, auth: { onChange: fn => { changement = fn; return () => {}; } } } };
      const root = await renderReperesRoute({ id: 'r-reperes' }, {}, ctx, depsDe(repo, { fetch: async () => { signalParti(); await retour; return reponseAssistantReperes(reponseReperesTest()); } })); document.body.append(root);
      try {
        root.querySelector('[data-role=proposer-reperes]').click(); await parti; const id = root.etatRoute().importId, avant = await repo.get('imports', id);
        changement({ user: { id: 'autre-compte' } }); signalRetour(); await root.attendreEcritures();
        root.querySelector('[data-role=ignorer-reperes]').click(); await root.attendreEcritures();
        eq(await repo.get('imports', id), avant, 'Repères écran : réponse et clic tardifs n’écrivent plus après changement de compte');
        eq((await repo.get('recipes', 'r-reperes')).reperes, undefined, 'Repères écran : aucune information tardive conservée');
      } finally { root.dispose(); root.remove(); }
    });

    await run('interface anglaise et description française', async repo => {
      await seedReperes(repo); setUiLocale('en');
      const root = await renderReperesRoute({ id: 'r-reperes' }, {}, {}, depsDe(repo, { fetch: async () => reponseAssistantReperes(reponseReperesTest()) })); document.body.append(root);
      try {
        eq(root.querySelector('[data-role=proposer-reperes]').textContent, 'Complete the details — 1 request', 'Repères écran : bouton traduit en anglais');
        root.querySelector('[data-role=proposer-reperes]').click(); await root.attendreEcritures();
        ok(root.querySelector('[data-role=comparaison-reperes]').textContent.includes('Des tomates doucement mijotées'), 'Repères écran : description toujours française');
        ok(root.querySelector('[data-role=comparaison-reperes]').textContent.includes('≈ 20–25 min'), 'Repères écran : estimation signalée sans certitude');
        ok(root.querySelector('[data-role=comparaison-reperes]').textContent.includes('AI estimate'), 'Repères écran : origine du temps traduite');
      } finally { root.dispose(); root.remove(); setUiLocale('fr'); }
    });

    await run('actualiser des repères déjà renseignés', async repo => {
      await seedReperes(repo); const P = await import('../src/domain/reperes-parcours.js'); let appels = 0;
      const deps = depsDe(repo, { fetch: async () => { appels++; return reponseAssistantReperes(reponseReperesTest()); } });
      await P.enregistrerCorrectionsReperes({ recipeId: 'r-reperes', versionId: 'v-reperes', corrections: { description_fr: { texte: 'Ma description manuelle.' } } }, { repo });
      let root = await renderReperesRoute({ id: 'r-reperes' }, {}, {}, deps); document.body.append(root);
      try {
        eq(root.querySelector('[data-role=proposer-reperes]').textContent, 'Actualiser les informations — 1 appel', 'Repères écran : correction manuelle existante propose Actualiser');
      } finally { root.dispose(); root.remove(); }
      await P.enregistrerCorrectionsReperes({ recipeId: 'r-reperes', versionId: 'v-reperes', corrections: { description_fr: null } }, { repo });
      setUiLocale('en'); root = await renderReperesRoute({ id: 'r-reperes' }, {}, {}, deps); document.body.append(root);
      try {
        eq(root.querySelector('[data-role=proposer-reperes]').textContent, 'Update the details — 1 request', 'Repères écran : effacement manuel existant propose Actualiser en anglais');
        eq(appels, 0, 'Repères écran : repères existants ne déclenchent aucun appel à ouverture');
      } finally { root.dispose(); root.remove(); setUiLocale('fr'); }
    });
  } finally { setUiLocale(avant); }
}
