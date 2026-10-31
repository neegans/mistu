import { syncSectionModel, syncSectionL3, renderSettings } from '../src/ui/settings.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';
import { formatDate } from '../src/core/dom.js';
import { getData, getSyncState, setSyncState } from '../src/ui/state.js';
import { withRepo } from './sync-fixture.js';
import { fixtureLectureL6 } from './l6-lecture-ecrans.js';

export function fixtureConflitLisible() {
  const f = fixtureLectureL6(), recipeId = 'recette-conflit-lisible';
  const ici = { ...f.version, id: 'version-ici', recipe_id: recipeId, servings: 4, ingredients: structuredClone(f.version.ingredients), steps: [{ id: 'etape-ici', position: 1, text: 'Mélanger.' }] };
  const ailleurs = { ...structuredClone(ici), id: 'version-ailleurs', servings: 8, ingredients: [], steps: [{ id: 'etape-a1', position: 1, text: 'Préparer.' }, { id: 'etape-a2', position: 2, text: 'Servir.' }] };
  const local = { ...f.recipe, id: recipeId, original_title: 'Pain source', display_title: 'Pain d’ici', current_version_id: ici.id, updated_at: '2026-10-30T10:00:00.000Z' };
  const distant = { ...local, display_title: 'Pain d’ailleurs', current_version_id: ailleurs.id, updated_at: '2020-01-01T01:00:00.000Z' };
  return { conflit: { id: 'recipes:' + recipeId, store: 'recipes', record_id: recipeId, kind: 'donnees', user_id: 'u1', local, server: { data: distant, updated_at: '2026-10-30T11:00:00.000Z', deleted_at: null }, at: '2026-10-31T14:00:00.000Z' },
    versions: [ici, ailleurs, { ...structuredClone(ici), id: 'version-courante', servings: 99 }], recetteCourante: { ...local, display_title: 'Courante à ignorer', current_version_id: 'version-courante' } };
}
const base = { available: true, user: { id: 'u1' }, guard: { ok: true }, moteur: { enCours: false } };
const cellule = (root, cote, champ) => root.querySelector(`[data-role=comparaison-conflit-recette] td[data-cote=${cote}][data-champ=${champ}]`)?.textContent;
const tableau = (root, cote) => ['titre', 'portions', 'ingredients', 'etapes', 'modification'].map(champ => cellule(root, cote, champ));

export async function runAuditConflitsLisiblesTests({ eq, ok }) {
  const locale = getUiLocale(), sync = getSyncState(), racines = [];
  const monter = (f, gestes = {}, extra = {}) => {
    const model = syncSectionModel({ ...base, conflits: [f.conflit], versionsById: new Map(f.versions.map(v => [v.id, v])), ...extra }), root = document.createElement('div');
    root.append(...syncSectionL3(model, gestes)); document.body.append(root); racines.push(root); return { root, model };
  };
  const run = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, `Conflits lisibles11.4 ${nom} : ${e.stack || e}`); } finally { for (const r of racines.splice(0)) { r.dispose?.(); r.remove(); } } };
  try {
    setUiLocale('fr');
    await run('deux copies', async () => {
      const f = fixtureConflitLisible(), avant = structuredClone(f), gestes = [], { root, model } = monter(f, { garderIci: id => gestes.push(['ici', id]), garderAilleurs: id => gestes.push(['ailleurs', id]) });
      eq(tableau(root, 'ici'), ['Pain d’ici', '4', String(f.versions[0].ingredients.length), '1', formatDate(f.conflit.local.updated_at, { withTime: true })], 'Conflits lisibles11.4 : champs exacts de la copie locale');
      eq(tableau(root, 'ailleurs'), ['Pain d’ailleurs', '8', '0', '2', formatDate(f.conflit.server.updated_at, { withTime: true })], 'Conflits lisibles11.4 : copie distante et date de son enveloppe');
      ok(!root.querySelector('[data-role=comparaison-conflit-recette]')?.textContent.includes('99'), 'Conflits lisibles11.4 : aucune portion de version courante empruntée');
      const details = root.querySelector('[data-role=details-conflit-recette]');
      eq(details?.querySelector('summary')?.textContent, 'Détails techniques', 'Conflits lisibles11.4 : détails nommés'); eq(details?.open, false, 'Conflits lisibles11.4 : JSON replié initialement');
      let copie; try { copie = JSON.parse(details?.querySelector('pre')?.textContent); } catch {}
      eq(copie, { ici: f.conflit.local, ailleurs: f.conflit.server }, 'Conflits lisibles11.4 : deux copies complètes et métadonnées conservées');
      eq(gestes, [], 'Conflits lisibles11.4 : aucune résolution au montage');
      for (const b of root.querySelectorAll('button')) b.click(); eq(gestes, [['ici', f.conflit.id], ['ailleurs', f.conflit.id]], 'Conflits lisibles11.4 : arbitrage conserve les identifiants exacts');
      eq(f, avant, 'Conflits lisibles11.4 : projection sans normalisation des copies'); ok(model.lines.includes('Conflits : 1'), 'Conflits lisibles11.4 : conflit ordinaire toujours compté');
    });
    for (const variation of ['sans_version', 'autre_recette', 'mauvais_id', 'sans_pointeur', 'tableaux_absents', 'portions_nulles']) await run(variation, () => {
      const f = fixtureConflitLisible();
      if (variation === 'sans_version') f.versions = f.versions.filter(v => v.id !== 'version-ailleurs');
      if (variation === 'autre_recette') f.versions[1].recipe_id = 'autre';
      if (variation === 'sans_pointeur') delete f.conflit.server.data.current_version_id;
      if (variation === 'tableaux_absents') { delete f.versions[1].ingredients; f.versions[1].steps = null; }
      if (variation === 'portions_nulles') f.versions[1].servings = null;
      const extra = variation === 'mauvais_id' ? { versionsById: new Map(f.versions.map(v => [v.id, v.id === 'version-ailleurs' ? { ...v, id: 'faux' } : v])) } : {};
      const { root } = monter(f, {}, extra);
      eq(cellule(root, 'ici', 'portions'), '4', `Conflits lisibles11.4 ${variation} : voisin local indépendant`);
      const attendus = variation === 'tableaux_absents' ? ['8', 'Inconnu', 'Inconnu'] : variation === 'portions_nulles' ? ['Inconnu', '0', '2'] : ['Inconnu', 'Inconnu', 'Inconnu'];
      eq(['portions', 'ingredients', 'etapes'].map(k => cellule(root, 'ailleurs', k)), attendus, `Conflits lisibles11.4 ${variation} : absence distincte de zéro`);
    });
    for (const cote of ['ici', 'ailleurs']) await run('copie absente ' + cote, () => {
      const f = fixtureConflitLisible(); if (cote === 'ici') f.conflit.local = null; else { f.conflit.server.data = null; f.conflit.server.deleted_at = f.conflit.server.updated_at; }
      const { root } = monter(f); eq(cellule(root, cote, 'titre'), 'Copie absente', `Conflits lisibles11.4 ${cote} : absence de copie explicitement nommée`);
      eq(['portions', 'ingredients', 'etapes'].map(k => cellule(root, cote, k)), ['Inconnu', 'Inconnu', 'Inconnu'], `Conflits lisibles11.4 ${cote} : copie absente n’invente aucun zéro`);
    });
    await run('dates absentes', () => {
      const f = fixtureConflitLisible(); delete f.conflit.local.updated_at; f.conflit.server.updated_at = 'pas-une-date';
      const { root } = monter(f, { garderIci() {}, garderAilleurs() {} });
      eq([cellule(root, 'ici', 'modification'), cellule(root, 'ailleurs', 'modification')], ['Inconnu', 'Inconnu'], 'Conflits lisibles11.4 : dates inconnues sans c.at');
      ok(!root.textContent.replace(root.querySelector('[data-role=details-conflit-recette]')?.textContent || '', '').includes(formatDate(f.conflit.at, { withTime: true })), 'Conflits lisibles11.4 : aucun libellé ni bouton ne date la copie par le constat');
      eq(root.querySelector('button')?.textContent, 'Garder celle d’ici', 'Conflits lisibles11.4 : bouton sans date inventée');
    });
    await run('texte hostile', () => {
      const f = fixtureConflitLisible(); f.conflit.local.display_title = '<img src=x onerror="void 0">'; f.conflit.server.data.display_title = '<script>hostile</script>';
      const { root } = monter(f); eq([cellule(root, 'ici', 'titre'), cellule(root, 'ailleurs', 'titre')], [f.conflit.local.display_title, f.conflit.server.data.display_title], 'Conflits lisibles11.4 : titres en texte seul');
      eq(root.querySelectorAll('img,script').length, 0, 'Conflits lisibles11.4 : aucun élément injecté');
    });
    for (const tombe of [false, true]) await run('renvoi ' + tombe, () => {
      const f = fixtureConflitLisible(), gestes = []; f.conflit.renvoye = true;
      if (tombe) { f.conflit.server.data = null; f.conflit.server.deleted_at = f.conflit.server.updated_at; }
      const { root } = monter(f, { garderIci: id => gestes.push(['ici', id]), garderAilleurs: id => gestes.push(['ailleurs', id]), ignorerConflit: id => gestes.push(['ignorer', id]) });
      eq([...root.querySelectorAll('button')].map(b => b.textContent), tombe ? ['Supprimer ici aussi', 'Ignorer'] : ['Ignorer'], `Conflits lisibles11.4 ${tombe} : gestes du renvoi inchangés`);
      root.querySelectorAll('button').forEach(b => b.click()); eq(gestes, tombe ? [['ailleurs', f.conflit.id], ['ignorer', f.conflit.id]] : [['ignorer', f.conflit.id]], `Conflits lisibles11.4 ${tombe} : cibles du renvoi exactes`);
    });
    for (const choix of ['abandon', 'envoye']) await run('documentaire ' + choix, () => {
      const f = fixtureConflitLisible(); f.conflit = { ...f.conflit, kind: 'translation', origine: 'abandon_envoi', resolution: { choix }, copie_locale: f.conflit.local, entree: { op: 'translation_apply', payload: { copie: 'entière' } } };
      const { root, model } = monter(f, { garderIci() {}, garderAilleurs() {}, ignorerConflit() {} });
      eq(root.querySelector('[data-role=comparaison-conflit-recette]'), null, `Conflits lisibles11.4 ${choix} : documentaire sans arbitrage de recette`);
      eq(root.querySelectorAll('button').length, 0, `Conflits lisibles11.4 ${choix} : copie documentaire sans geste générique`);
      ok(model.lines.includes('Conflits : 0') && root.querySelector('pre')?.textContent.includes('entière'), `Conflits lisibles11.4 ${choix} : compteur0 et copie complète conservés`);
    });
    await run('vraie couture Réglages', () => withRepo(async (repo, db) => {
      const f = fixtureConflitLisible(); await db.mutate({ origin: 'remote', puts: { recipes: [f.recetteCourante], recipe_versions: f.versions, sync_conflicts: [f.conflit], sync_state: [{ key: 'user_id', value: 'u1' }] } });
      const avant = await db.getSnapshot(['recipes', 'recipe_versions', 'sync_conflicts', 'outbox']); let reseau = 0;
      const moteur = { etat: () => ({ enCours: false }), subscribe: () => () => {}, envoyerMaintenant: async () => { reseau++; } };
      setSyncState({ moteur }); const ctx = { ...await getData(true), sync: { user: { id: 'u1' }, guard: { ok: true }, auth: { available: true } } };
      const root = await renderSettings({}, {}, ctx); document.body.append(root); racines.push(root);
      eq([cellule(root, 'ici', 'portions'), cellule(root, 'ailleurs', 'portions')], ['4', '8'], 'Conflits lisibles11.4 : vraie route transmet son catalogue de versions');
      eq(await db.getSnapshot(['recipes', 'recipe_versions', 'sync_conflicts', 'outbox']), avant, 'Conflits lisibles11.4 : affichage Réglages sans écriture métier'); eq(reseau, 0, 'Conflits lisibles11.4 : aucune synchronisation automatique au montage');
    }));
    await run('anglais', () => {
      setUiLocale('en'); const f = fixtureConflitLisible(); delete f.conflit.local.updated_at; const { root } = monter(f, { garderIci() {} });
      eq([...root.querySelectorAll('[data-role=comparaison-conflit-recette] thead th')].map(n => n.textContent), ['Field', 'On this device', 'Received from server'], 'Conflits lisibles11.4 EN : colonnes traduites');
      eq(root.querySelector('[data-role=details-conflit-recette] summary')?.textContent, 'Technical details', 'Conflits lisibles11.4 EN : détails traduits');
      eq(cellule(root, 'ici', 'modification'), 'Unknown', 'Conflits lisibles11.4 EN : inconnue traduite'); eq(root.querySelector('button')?.textContent, 'Keep the one from here', 'Conflits lisibles11.4 EN : bouton sans date traduit');
    });
  } finally { for (const r of racines) { r.dispose?.(); r.remove(); } setUiLocale(locale); setSyncState(sync); }
}
