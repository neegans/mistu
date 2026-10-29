import { withRepo } from './sync-fixture.js';

const clone = (v) => structuredClone(v);
const input = (node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); };
const cocher = (node, checked = true) => { node.checked = checked; node.dispatchEvent(new Event('change', { bubbles: true })); };
const textesParasites = (root) => {
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), parasites = []; let node;
  while ((node = it.nextNode())) if (/^(?:null|undefined)+$/u.test(node.nodeValue.trim())) parasites.push(node.nodeValue);
  return parasites;
};
const source = () => ({ id: 'v-i3-ui', recipe_id: 'r-i3-ui', kind: 'extraction', status: 'proposed', servings: 2,
  ingredients: [{ id: 'i1', name_text: 'tomates', source_text: '300 g de tomates', quantity: { value: 300, raw: '300' }, unit_id: 'g' },
    { id: 'i2', name_text: 'eau', source_text: '100 g d’eau', quantity: { value: 100, raw: '100' }, unit_id: 'g' }],
  steps: [{ id: 's1', text: 'Mélanger les tomates et l’eau dans une casserole.' }, { id: 's2', text: 'Servir dans les assiettes.' }], constraints: {} });
const proposition = () => ({ type: 'proposition', blocs: [{ source_step_id: 's1', raison: 'La sauce peut être remuée dans le bol.', actions: [
  { type: 'preparation', operation: 'ajouter', ingredients: ['i1', 'i2'], contenant: 'bol' },
  { type: 'reglage', mode: 'manuel', secondes: 480, temperature: 100, vitesse: 1, sens: 'normal', accessoire: 'couteau', ingredients: ['i1', 'i2'] },
] }] });
const recipe = () => ({ id: 'r-i3-ui', original_title: 'Sauce du carnet', original_language: 'fr', current_version_id: 'v-i3-ui', availability: 'available' });
const session = { access_token: 'fixture-i3', user: { id: 'u1' } };
const reponse = (v) => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(v) }], stop_reason: 'end_turn', model: 'test-i3', usage: {} }), { status: 200 });
const config = { url: 'https://assistant.example', anonKey: 'publique-factice' };
const depsDe = (repo, extra = {}) => ({ repo, remplacerAdresse: () => {}, navigate: () => {}, toast: () => {}, sessionAssistant: async () => session,
  enLigne: () => true, config, fetch: async () => reponse(proposition()), ...extra });
async function preparer(repo) { await repo.saveBatch({ recipes: [recipe()], recipe_versions: [source()] }); }
async function versionTM() {
  const D = await import('../src/domain/thermomix.js'); const v = source();
  const contexte = D.construireContexteThermomix({ version: v, selection: ['s1'] });
  const resultat = D.validerReponseThermomix(proposition(), contexte);
  let next = 0;
  return D.fabriquerVersionThermomix({ source: v, contexte, resultat, id: 'v-tm-ui', newId: () => 's-tm-ui-' + (++next), maintenant: '2026-10-28T12:00:00Z', modele: 'test-i3' });
}

export async function runI3EcranTests({ eq, ok }) {
  const { getUiLocale, setUiLocale } = await import('../src/core/i18n.js'); const ancienne = getUiLocale(); setUiLocale('fr');
  const run = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, `I3 écran — ${nom} : ${e.stack || e.message}`); } };
  try {
    await run('sélection vide et brouillon persistant', async () => {
      const { renderThermomixRoute } = await import('../src/ui/thermomix.js');
      await withRepo(async (repo) => {
        await preparer(repo); let calls = 0;
        const deps = depsDe(repo, { fetch: async () => { calls++; return reponse(proposition()); } });
        const root = await renderThermomixRoute({ id: recipe().id }, { v: source().id }, {}, deps); document.body.append(root);
        try {
          eq(textesParasites(root), [], 'I3 : aucun null ou undefined ajouté comme texte dans le chef');
          eq(root.querySelectorAll('[name=etape]:checked').length, 0, 'I3 : aucune étape présélectionnée');
          ok([...root.querySelectorAll('[name=froid]')].every(n => n.closest('label').hidden), 'I3 : confirmations de départ froid masquées avant sélection');
          eq(root.querySelector('[data-role=proposer-tm7]').disabled, true, 'I3 : appel impossible sans sélection');
          input(root.querySelector('[name=demande]'), 'Seulement la sauce'); cocher(root.querySelector('[name=etape]'));
          await root.attendreEcritures();
          eq(root.querySelector('[name=froid][value=s1]').closest('label').hidden, false, 'I3 : confirmation froide visible pour l’étape sélectionnée');
          eq(root.querySelector('[name=froid][value=s1]').checked, false, 'I3 : aucun départ froid supposé par défaut');
          eq(root.querySelector('[name=froid][value=s2]').closest('label').hidden, true, 'I3 : confirmation froide masquée pour l’autre étape');
          const row = await repo.get('imports', root.etatRoute().importId);
          eq(row.contexte.demande, 'Seulement la sauce', 'I3 : demande sauvegardée avant appel');
          eq(row.contexte.selection, ['s1'], 'I3 : sélection par identifiant conservée');
          eq(calls, 0, 'I3 : saisir ne lance aucun appel');
          root.dispose(); root.remove();
          const retour = await renderThermomixRoute({ id: recipe().id }, { import: row.id }, {}, deps); document.body.append(retour);
          try { eq(retour.querySelector('[name=demande]').value, 'Seulement la sauce', 'I3 : demande reprise après fermeture'); eq(retour.querySelectorAll('[name=etape]:checked').length, 1, 'I3 : sélection reprise'); eq(calls, 0, 'I3 : reprise sans appel'); }
          finally { retour.dispose(); retour.remove(); }
        } finally { root.dispose(); root.remove(); }
      });
    });
    await run('retour explicite aux portions source', async () => {
      const { renderThermomixRoute } = await import('../src/ui/thermomix.js');
      await withRepo(async (repo) => {
        await preparer(repo);
        const root = await renderThermomixRoute({ id: recipe().id }, { v: source().id, servings: '6' }, {}, depsDe(repo)); document.body.append(root);
        try { cocher(root.querySelector('[name=etape]')); await root.attendreEcritures(); eq(root.querySelector('[data-role=proposer-tm7]').disabled, true, 'I3 : portions différentes bloquent l’appel');
          root.querySelector('[data-role=quantites-source-tm7]').click(); await root.attendreEcritures(); eq(root.querySelector('[data-role=proposer-tm7]').disabled, false, 'I3 : retour volontaire aux quantités source ouvre l’appel'); }
        finally { root.dispose(); root.remove(); }
      });
    });
    await run('proposition relue puis conservée', async () => {
      const { renderThermomixRoute } = await import('../src/ui/thermomix.js');
      await withRepo(async (repo) => {
        await preparer(repo); let calls = 0; const navigations = [];
        const root = await renderThermomixRoute({ id: recipe().id }, { v: source().id }, {}, depsDe(repo, { navigate: p => navigations.push(p), fetch: async (_u, init) => { calls++; eq(JSON.parse(init.body).outil, 'creation', 'I3 : outil de passerelle existant'); return reponse(proposition()); } })); document.body.append(root);
        try { cocher(root.querySelector('[name=etape]')); await root.attendreEcritures(); root.querySelector('[data-role=proposer-tm7]').click(); await root.attendreEcritures();
          eq(calls, 1, 'I3 : un seul appel sur proposition'); ok(root.textContent.includes('100 °C'), 'I3 : paramètres validés affichés');
          eq(root.querySelector('[data-role=garder-tm7]').disabled, true, 'I3 : relecture nécessaire');
          cocher(root.querySelector('[name=relecture]')); cocher(root.querySelector('[name=montage]'));
          root.querySelector('[data-role=garder-tm7]').click(); await root.attendreEcritures();
          const versions = (await repo.all('recipe_versions')).filter(v => v.recipe_id === recipe().id);
          eq(versions.length, 2, 'I3 : une nouvelle version conservée');
          const adapted = versions.find(v => v.id !== source().id); eq(adapted.steps[1].text, source().steps[1].text, 'I3 : étape non cochée intacte');
          eq((await repo.get('recipes', recipe().id)).current_version_id, source().id, 'I3 : original toujours courant');
          ok(navigations[0]?.includes(encodeURIComponent(adapted.id)), 'I3 : navigation vers la version réellement écrite');
        } finally { root.dispose(); root.remove(); }
      });
    });
    await run('presse-papiers et texte sélectionnable', async () => {
      const { renderCopieCookidoo } = await import('../src/ui/cookidoo.js'); const version = await versionTM(); const copied = [];
      let resoudre; const pending = new Promise(resolve => { resoudre = resolve; });
      const panel = renderCopieCookidoo({ recipe: recipe(), version }, { clipboard: { writeText: async text => { copied.push(text); await pending; } } }); document.body.append(panel);
      try { eq(textesParasites(panel), [], 'I3 : aucun null ou undefined ajouté au panneau Cookidoo'); panel.querySelector('[data-role=copier-titre]').click(); await Promise.resolve();
        ok(!panel.querySelector('[role=status]').textContent.includes('Texte copié'), 'I3 : pas de faux succès avant le presse-papiers');
        resoudre(); await panel.attendreCopie(); eq(copied, ['Sauce du carnet'], 'I3 : seul le titre demandé est copié');
        eq(panel.querySelector('[role=status]').textContent, 'Texte copié', 'I3 : succès après résolution réelle');
        eq(panel.querySelectorAll('[data-role=copier-etape]').length, 2, 'I3 : un champ par étape extérieure');
      } finally { panel.remove(); }
      const denied = renderCopieCookidoo({ recipe: recipe(), version }, { clipboard: { writeText: async () => { throw Error('denied'); } } }); document.body.append(denied);
      try { denied.querySelector('[data-role=copier-tout]').click(); await denied.attendreCopie();
        ok(denied.querySelector('textarea').value.includes('Servir dans les assiettes.'), 'I3 : repli lisible comprend aussi les étapes source');
        ok(!denied.querySelector('[role=status]').textContent.includes('Texte copié'), 'I3 : refus du presse-papiers jamais annoncé réussi');
      } finally { denied.remove(); }
    });
    await run('copie partielle et plan altéré refusés', async () => {
      const { renderCopieCookidoo } = await import('../src/ui/cookidoo.js'); const v = await versionTM();
      const partial = renderCopieCookidoo({ recipe: { ...recipe(), availability: 'partial' }, version: v });
      eq(textesParasites(partial), [], 'I3 : refus de copie partielle sans texte parasite');
      eq(partial.querySelectorAll('button[data-role^=copier]').length, 0, 'I3 : aucun geste de copie d’une recette partielle');
      const altered = clone(v); altered.steps[0].text += ' autre consigne';
      const bad = renderCopieCookidoo({ recipe: recipe(), version: altered });
      eq(textesParasites(bad), [], 'I3 : refus de plan altéré sans texte parasite');
      eq(bad.querySelectorAll('button[data-role^=copier]').length, 0, 'I3 : plan altéré interdit à la copie');
    });
    await run('questions reprises avec les réponses', async () => {
      const { renderThermomixRoute } = await import('../src/ui/thermomix.js');
      await withRepo(async repo => {
        await preparer(repo); let appels = 0;
        const deps = depsDe(repo, { fetch: async () => { appels++; return reponse({ type: 'questions', questions: ['Les ingrédients seront-ils froids ?'] }); } });
        const root = await renderThermomixRoute({ id: recipe().id }, {}, {}, deps); document.body.append(root);
        let id;
        try {
          cocher(root.querySelector('[name=etape]')); await root.attendreEcritures();
          root.querySelector('[data-role=proposer-tm7]').click(); await root.attendreEcritures();
          eq(root.querySelector('[data-role=garder-tm7]'), null, 'I3 : les questions ne se conservent pas comme adaptation');
          input(root.querySelector('[name=reponse-0]'), 'Oui, avant la chauffe.'); await root.attendreEcritures();
          eq(appels, 1, 'I3 : répondre ne relance pas automatiquement'); id = root.etatRoute().importId;
        } finally { root.dispose(); root.remove(); }
        const retour = await renderThermomixRoute({ id: recipe().id }, { import: id }, {}, deps); document.body.append(retour);
        try {
          eq(retour.querySelector('[name=reponse-0]').value, 'Oui, avant la chauffe.', 'I3 : réponse retrouvée après fermeture');
          ok(retour.textContent.includes('Les ingrédients seront-ils froids ?'), 'I3 : question correspondante durable');
          eq(appels, 1, 'I3 : reprise des questions sans appel');
        } finally { retour.dispose(); retour.remove(); }
      });
    });
    await run('annulation avant réponse tardive', async () => {
      const { renderThermomixRoute } = await import('../src/ui/thermomix.js');
      await withRepo(async repo => {
        await preparer(repo); let resoudre, parti;
        const started = new Promise(resolve => { parti = resolve; }); const attendu = new Promise(resolve => { resoudre = resolve; });
        const root = await renderThermomixRoute({ id: recipe().id }, {}, {}, depsDe(repo, { fetch: async () => { parti(); return attendu; } })); document.body.append(root);
        try {
          cocher(root.querySelector('[name=etape]')); await root.attendreEcritures(); root.querySelector('[data-role=proposer-tm7]').click(); await started;
          root.querySelector('[data-role=annuler-tm7]').click(); resoudre(reponse(proposition())); await root.attendreEcritures();
          eq((await repo.get('imports', root.etatRoute().importId)).status, 'echec', 'I3 : annulation conservée malgré réponse tardive');
          eq(root.querySelector('[data-role=garder-tm7]'), null, 'I3 : réponse annulée jamais conservable');
          eq((await repo.all('recipe_versions')).filter(v => v.recipe_id === recipe().id).length, 1, 'I3 : annuler ne fabrique pas de version');
        } finally { root.dispose(); root.remove(); }
      });
    });
    await run('lecture seule distante et recette sans portions', async () => {
      const { renderThermomixRoute } = await import('../src/ui/thermomix.js'); const P = await import('../src/domain/thermomix-parcours.js');
      await withRepo(async repo => {
        await preparer(repo); const ligne = await P.ouvrirThermomix({ recipeId: recipe().id, versionId: source().id, selection: ['s1'] }, { repo });
        await repo.save('imports', { ...ligne, device_id: 'autre-appareil' });
        const root = await renderThermomixRoute({ id: recipe().id }, { import: ligne.id }, {}, depsDe(repo)); document.body.append(root);
        try {
          eq(root.querySelector('[name=demande]').disabled, true, 'I3 : brouillon distant consultable sans modification');
          eq(root.querySelector('[data-role=proposer-tm7]').disabled, true, 'I3 : pas de nouvel appel depuis le brouillon distant');
          eq(root.querySelector('[data-role=copier-brouillon-tm7]').hidden, true, 'I3 : la copie attend la clôture reçue');
        } finally { root.dispose(); root.remove(); }
      });
      await withRepo(async repo => {
        await preparer(repo); await repo.save('recipe_versions', { ...source(), servings: null });
        const root = await renderThermomixRoute({ id: recipe().id }, { servings: '4' }, {}, depsDe(repo)); document.body.append(root);
        try {
          cocher(root.querySelector('[name=etape]')); await root.attendreEcritures();
          eq(root.querySelector('[data-role=proposer-tm7]').disabled, true, 'I3 : valeur d’URL interdite quand portions source inconnues');
          root.querySelector('[data-role=quantites-source-tm7]').click(); await root.attendreEcritures();
          eq(root.querySelector('[data-role=proposer-tm7]').disabled, false, 'I3 : quantités source sans portions rétablies explicitement');
          input(root.querySelector('[name=volume_bol_l]'), '2.3'); eq(root.querySelector('[data-role=proposer-tm7]').disabled, true, 'I3 : volume au-delà du profil bloque l’appel sans correction');
          eq(root.querySelector('[name=volume_bol_l]').value, '2.3', 'I3 : valeur invalide jamais abaissée silencieusement');
        } finally { root.dispose(); root.remove(); }
      });
    });
    await run('copie aux portions demandées et langue anglaise', async () => {
      const { renderCopieCookidoo } = await import('../src/ui/cookidoo.js'); const v = await versionTM();
      const wrong = renderCopieCookidoo({ recipe: recipe(), version: v }, { portions: 6 });
      eq(wrong.querySelectorAll('button[data-role^=copier]').length, 0, 'I3 : copie bloquée aux portions recalculées');
      setUiLocale('en');
      try { const panel = renderCopieCookidoo({ recipe: recipe(), version: v }); ok(panel.querySelector('textarea'), 'I3 : panneau anglais monte sans erreur'); }
      finally { setUiLocale('fr'); }
    });
    await run('échec d’écriture corrigeable sans nouvel appel', async () => {
      const { renderThermomixRoute } = await import('../src/ui/thermomix.js'); const P = await import('../src/domain/thermomix-parcours.js');
      await withRepo(async repo => {
        await preparer(repo); let essais = 0, appels = 0;
        const root = await renderThermomixRoute({ id: recipe().id }, {}, {}, depsDe(repo, {
          fetch: async () => { appels++; return reponse(proposition()); },
          parcours: { ...P, garderThermomix: async (...args) => { if (++essais === 1) throw Error('stockage'); return P.garderThermomix(...args); } },
        })); document.body.append(root);
        try {
          cocher(root.querySelector('[name=etape]')); await root.attendreEcritures(); root.querySelector('[data-role=proposer-tm7]').click(); await root.attendreEcritures();
          cocher(root.querySelector('[name=relecture]')); cocher(root.querySelector('[name=montage]'));
          root.querySelector('[data-role=garder-tm7]').click(); await root.attendreEcritures();
          eq(root.querySelector('[data-role=garder-tm7]').disabled, false, 'I3 : garder redevient disponible après un échec d’écriture');
          eq((await repo.all('recipe_versions')).filter(v => v.recipe_id === recipe().id).length, 1, 'I3 : écriture échouée sans faux succès');
          root.querySelector('[data-role=garder-tm7]').click(); await root.attendreEcritures();
          eq(appels, 1, 'I3 : réessayer la sauvegarde ne rappelle pas l’assistant');
          eq((await repo.all('recipe_versions')).filter(v => v.recipe_id === recipe().id).length, 2, 'I3 : sauvegarde retentée conserve une version');
        } finally { root.dispose(); root.remove(); }
      });
    });
  } finally { setUiLocale(ancienne); }
}
