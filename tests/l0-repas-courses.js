import { withRepo } from './sync-fixture.js';
import { renderMeal } from '../src/ui/meals.js';
import { renderShoppingList } from '../src/ui/grocery.js';
import { buildShoppingList, preparerSortieCourses } from '../src/domain/grocery.js';
import { formaterHeureLocale, analyserHeureLocale, decalageUTC } from '../src/domain/heure-locale.js';
import { setUiLocale, getUiLocale } from '../src/core/i18n.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const bouton = (vue, nom) => [...vue.querySelectorAll('button')].find(b => b.textContent === nom);
const contexte = (meals = []) => ({ meals, recipesById: new Map(), versionsById: new Map(), ingredientsById: new Map(), editionsById: new Map(), settings: { ui_locale: 'fr', units: 'original' }, meal_feedback: [], cook_history: [], conventionFor: () => null });
const attendre = async fn => { for (let i = 0; i < 100; i += 1) { if (await fn()) return; await new Promise(r => setTimeout(r, 5)); } throw Error('Résultat attendu non observé'); };
const ecrire = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
const repas = serve_at => ({ id: 'meal-l0', title: 'Souper', servings: 2, items: [], serve_at });
const saveHeure = async (vue) => { bouton(vue, 'Enregistrer l’heure').click(); await attendre(() => !bouton(vue, 'Enregistrer l’heure').disabled); };

function fixtureCourses() {
  const version = { id: 'v', recipe_id: 'r', servings: 2, ingredients: [{ id: 'i1', source_text: 'Sel', name_text: 'Sel' }, { id: 'i2', source_text: 'Beurre', name_text: 'Beurre' }], steps: [] };
  const recipe = { id: 'r', original_title: 'Plat' };
  const rows = buildShoppingList([{ version, servings: 2, title: 'Plat' }], new Map());
  const checked = { [rows.find(r => r.label === 'Sel').key]: true };
  const list = { id: 'l', title: 'Courses', items: [{ recipe_id: 'r', recipe_version_id: 'v', servings: 2 }], checked };
  return { rows, list, ctx: { ...contexte(), shopping_lists: [list], recipesById: new Map([['r', recipe]]), versionsById: new Map([['v', version]]) } };
}

// Cette suite ne suppose pas le fuseau du navigateur de la personne. Les transitions Toronto ont leur suite dédiée plus bas.
export async function runL0RepasCoursesTests({ eq, ok }) {
  const langue = getUiLocale(); setUiLocale('fr');
  const run = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, `L0 repas/courses ${nom} : ${e.stack || e.message}`); } };
  try {
    await run('restitution locale', () => withRepo(async repo => {
      for (const valeur of ['2026-10-29T19:00', '2026-01-20T19:00', '2026-07-20T19:00']) {
        const instant = new Date(valeur).toISOString();
        const meal = repas(instant);
        await repo.save('meals', meal);
        const vue = await renderMeal({ id: meal.id }, {}, contexte([meal]));
        eq(vue.querySelector('input[type=datetime-local]')?.value, valeur, 'L0 C03 : un repas local à 19 h se rouvre à 19 h, hiver et été');
        eq(analyserHeureLocale(valeur).occurrences[0]?.iso, instant, 'L0 C03 : conversion locale préserve l’instant de la saisie');
      }
      eq(analyserHeureLocale(''), { etat: 'vide', occurrences: [] }, 'L0 C03 : heure facultative vide sans instant inventé');
      for (const bad of [null, 42, '2026-02-30T19:00', '2026-01-20T25:00', '2026-01-20T19:70', '0000-01-01T10:00', '2026-01-20', 'texte']) eq(analyserHeureLocale(bad).etat, 'invalide', 'L0 C03 : date/heure invalide refusée');
      eq(formaterHeureLocale('texte'), '', 'L0 C03 : instant illisible sans exception');
      eq([decalageUTC(-240), decalageUTC(330), decalageUTC(0)], ['UTC−04:00', 'UTC+05:30', 'UTC+00:00'], 'L0 C03 : décalages entiers et demi-heure nommés précisément');
    }));
    await run('enregistrement heure', () => withRepo(async repo => {
      const initial = new Date('2026-10-29T19:00').toISOString();
      let meal = repas(initial); await repo.save('meals', meal);
      let vue = await renderMeal({ id: meal.id }, {}, contexte([meal]), { refresh: () => {} });
      ecrire(vue.querySelector('input[type=datetime-local]'), '2026-10-29T20:15');
      eq((await repo.get('meals', meal.id)).serve_at, initial, 'L0 C03 : la saisie précède la confirmation et ne change pas encore le repas');
      await repo.save('meals', { ...(await repo.get('meals', meal.id)), title: 'Titre corrigé ailleurs' });
      await saveHeure(vue);
      meal = await repo.get('meals', meal.id);
      eq(meal.serve_at, new Date('2026-10-29T20:15').toISOString(), 'L0 C03 : l’heure choisie est réellement écrite');
      eq(meal.title, 'Titre corrigé ailleurs', 'L0 C03 : la fusion de l’heure conserve le titre concurrent');
      vue = await renderMeal({ id: meal.id }, {}, contexte([meal]), { refresh: () => {} });
      eq(vue.querySelector('input[type=datetime-local]').value, '2026-10-29T20:15', 'L0 C03 : rouvrir le repas restitue sa nouvelle heure');
      ecrire(vue.querySelector('input[type=datetime-local]'), ''); await saveHeure(vue);
      eq((await repo.get('meals', meal.id)).serve_at, null, 'L0 C03 : vider le champ retire seulement l’heure du repas');
      meal = { ...meal, serve_at: new Date('2026-10-29T19:00:37').toISOString() }; await repo.save('meals', meal);
      vue = await renderMeal({ id: meal.id }, {}, contexte([meal]), { refresh: () => {} });
      await saveHeure(vue);
      eq((await repo.get('meals', meal.id)).serve_at, meal.serve_at, 'L0 C03 : une heure inchangée conserve les secondes stockées');
      ecrire(vue.querySelector('input[type=datetime-local]'), '2026-10-29T22:00');
      await repo.save('meals', { ...meal, serve_at: new Date('2026-10-29T21:00').toISOString() });
      await saveHeure(vue);
      eq((await repo.get('meals', meal.id)).serve_at, new Date('2026-10-29T21:00').toISOString(), 'L0 C03 : une heure concurrente n’est pas écrasée');
      ok(vue.textContent.includes('Ce repas a changé') && vue.querySelector('input[type=datetime-local]').value === '2026-10-29T22:00', 'L0 C03 : refus visible et saisie conservée');
      const erreur = await renderMeal({ id: meal.id }, {}, contexte([meal]), { repo: { saveBatch: async () => { throw Error('disque'); } }, refresh: () => {} });
      ecrire(erreur.querySelector('input[type=datetime-local]'), '2026-10-29T23:00'); await saveHeure(erreur);
      ok(erreur.textContent.includes('Ta saisie est conservée') && erreur.querySelector('input[type=datetime-local]').value === '2026-10-29T23:00', 'L0 C03 : panne d’écriture ne perd pas le formulaire');
    }));
    await run('heure et portions simultanées', () => withRepo(async repo => {
      const meal = repas(new Date('2026-10-29T19:00').toISOString()); await repo.save('meals', meal);
      const vue = await renderMeal({ id: meal.id }, {}, contexte([meal]), { refresh: () => {} });
      ecrire(vue.querySelector('input[type=datetime-local]'), '2026-10-29T20:00');
      bouton(vue, 'Enregistrer l’heure').click();
      ecrire(vue.querySelector('input[type=number]'), '3');
      await attendre(async () => (await repo.get('meals', meal.id)).servings === 3 && !bouton(vue, 'Enregistrer l’heure').disabled);
      const courant = await repo.get('meals', meal.id);
      eq(courant.serve_at, new Date('2026-10-29T20:00').toISOString(), 'L0 C03 : une modification immédiate des portions ne rétablit pas l’ancienne heure');
      eq(courant.servings, 3, 'L0 C03 : la nouvelle heure ne perd pas les portions saisies simultanément');
    }));
    await run('copie et partage', () => withRepo(async repo => {
      const { list, ctx, rows } = fixtureCourses(); await repo.save('shopping_lists', list);
      const copies = [], partages = [], messages = [];
      const navigateur = { clipboard: { writeText: async text => copies.push(text) }, share: async data => partages.push(data.text) };
      const vue = await renderShoppingList({ id: 'l' }, {}, ctx, { navigator: navigateur, toast: msg => messages.push(msg) }); document.body.append(vue);
      try {
        bouton(vue, 'Copier').click(); await pause(); bouton(vue, 'Partager').click(); await pause();
        eq(copies[0], partages[0], 'L0 C08 : copier et partager transmettent exactement le même texte');
        ok(copies[0]?.includes('Beurre') && !copies[0]?.includes('Sel'), 'L0 C08 : par défaut seuls les éléments restant à acheter sont transmis');
        const choix = vue.querySelector('select'); ecrire(choix, 'complet');
        bouton(vue, 'Copier').click(); await pause(); bouton(vue, 'Partager').click(); await pause();
        eq(copies[1], partages[1], 'L0 C08 : la liste complète est identique par les deux commandes');
        ok(copies[1].includes('[x] Sel') && copies[1].includes('[ ] Beurre'), 'L0 C08 : la liste complète conserve les deux états');
        eq((await repo.get('shopping_lists', 'l')).checked, list.checked, 'L0 C08 : copier/partager n’écrivent aucune case');
        const beurre = [...vue.querySelectorAll('li')].find(li => li.querySelector('strong')?.textContent === 'Beurre');
        const caseBeurre = beurre.querySelector('input[type=checkbox]'); caseBeurre.checked = true; caseBeurre.dispatchEvent(new Event('change'));
        await attendre(() => !caseBeurre.disabled); ecrire(choix, 'restants');
        eq((await repo.get('shopping_lists', 'l')).checked[rows.find(r => r.label === 'Beurre').key], true, 'L0 C08 : cocher est conservé dans la base');
        ok(vue.textContent.includes('Rien à acheter') && bouton(vue, 'Copier').disabled && bouton(vue, 'Partager').disabled, 'L0 C08 : tout coché indique le résultat vide sans partager un texte vide');
        ecrire(choix, 'complet');
        ok(!bouton(vue, 'Copier').disabled, 'L0 C08 : la liste complète reste disponible après tous les achats');
        const avant = JSON.stringify(rows);
        eq(preparerSortieCourses(rows, list.checked, 'restants').nombre, 0, 'L0 C08 : préparation commune ne conserve que les cases non cochées');
        eq(JSON.stringify(rows), avant, 'L0 C08 : préparation du texte ne modifie pas les lignes calculées');
      } finally { vue.remove(); }
    }));
    await run('erreurs et capacités', () => withRepo(async () => {
      const { ctx } = fixtureCourses(); const messages = [];
      let resolveCopie;
      const pending = await renderShoppingList({ id: 'l' }, {}, ctx, { navigator: { clipboard: { writeText: () => new Promise(resolve => { resolveCopie = resolve; }) } }, toast: msg => messages.push(msg) });
      ok(!bouton(pending, 'Partager'), 'L0 C08 : sans partage natif, Copier reste seul disponible');
      bouton(pending, 'Copier').click();
      eq(messages.length, 0, 'L0 C08 : pas de succès avant résolution du presse-papiers');
      ok(bouton(pending, 'Copier').disabled, 'L0 C08 : un geste en cours ne se duplique pas');
      resolveCopie(); await pause();
      eq(messages, ['Liste copiée'], 'L0 C08 : copie annoncée après réussite');
      messages.length = 0;
      const missing = await renderShoppingList({ id: 'l' }, {}, ctx, { navigator: {}, toast: msg => messages.push(msg) });
      bouton(missing, 'Copier').click(); await pause();
      eq(messages, ['Copie impossible'], 'L0 C08 : presse-papiers absent produit un échec maîtrisé');
      messages.length = 0;
      const cancelled = await renderShoppingList({ id: 'l' }, {}, ctx, { navigator: { share: async () => { throw new DOMException('Annulé', 'AbortError'); } }, toast: msg => messages.push(msg) });
      bouton(cancelled, 'Partager').click(); await pause();
      eq(messages.length, 0, 'L0 C08 : annuler le partage ne produit ni succès ni erreur');
      const failed = await renderShoppingList({ id: 'l' }, {}, ctx, { navigator: { share: async () => { throw Error('réseau'); } }, toast: msg => messages.push(msg) });
      ecrire(failed.querySelector('select'), 'complet'); bouton(failed, 'Partager').click(); await pause();
      eq(messages, ['Partage impossible. Tu peux copier la liste.'], 'L0 C08 : échec réel du partage nommé avec repli');
      eq(failed.querySelector('select').value, 'complet', 'L0 C08 : l’échec conserve le choix de sortie');
      ok(!bouton(failed, 'Partager').disabled, 'L0 C08 : une nouvelle tentative reste disponible');
    }));
    await run('cases concurrentes reflétées', () => withRepo(async repo => {
      const { list, ctx, rows } = fixtureCourses(); list.checked = {}; await repo.save('shopping_lists', list);
      const vue = await renderShoppingList({ id: 'l' }, {}, ctx);
      const ligne = nom => [...vue.querySelectorAll('li')].find(li => li.querySelector('strong')?.textContent === nom);
      const beurre = ligne('Beurre'), sel = ligne('Sel');
      const caseBeurre = beurre.querySelector('input[type=checkbox]'), caseSel = sel.querySelector('input[type=checkbox]');
      const cleSel = rows.find(row => row.label === 'Sel').key;
      await repo.save('shopping_lists', { ...(await repo.get('shopping_lists', 'l')), checked: { [cleSel]: true } });
      caseBeurre.checked = true; caseBeurre.dispatchEvent(new Event('change'));
      await attendre(() => !caseBeurre.disabled);
      eq([caseBeurre.checked, caseSel.checked], [true, true], 'L0 C08 : la fusion d’une case réconcilie aussi la case cochée dans l’autre onglet');
      eq([beurre.style.opacity, sel.style.opacity], ['0.5', '0.5'], 'L0 C08 : toutes les lignes reflètent les cases effectivement enregistrées');
      ok(vue.textContent.includes('Rien à acheter') && bouton(vue, 'Copier').disabled, 'L0 C08 : état vide et commandes concordent avec les cases visibles');
    }));
    await run('geste de case encore en cours', () => withRepo(async repo => {
      const { list, ctx, rows } = fixtureCourses(); list.checked = {}; await repo.save('shopping_lists', list);
      let liberer, numero = 0;
      const attente = new Promise(resolve => { liberer = resolve; });
      const lent = { ...repo, saveBatch: async (...args) => { numero += 1; if (numero === 2) await attente; return repo.saveBatch(...args); } };
      const vue = await renderShoppingList({ id: 'l' }, {}, ctx, { repo: lent });
      const caseDe = nom => [...vue.querySelectorAll('li')].find(li => li.querySelector('strong')?.textContent === nom).querySelector('input[type=checkbox]');
      const beurre = caseDe('Beurre'), sel = caseDe('Sel');
      beurre.checked = true; beurre.dispatchEvent(new Event('change'));
      sel.checked = true; sel.dispatchEvent(new Event('change'));
      try {
        await attendre(() => !beurre.disabled);
        eq([sel.checked, sel.disabled], [true, true], 'L0 C08 : réconcilier une première case ne change pas le geste local encore en cours');
        ok(bouton(vue, 'Copier').disabled, 'L0 C08 : copie suspendue tant qu’une case visible attend son écriture');
      } finally { liberer(); }
      await attendre(() => !sel.disabled);
      eq([beurre.checked, sel.checked], [true, true], 'L0 C08 : les deux gestes successifs restent cochés après leur confirmation');
      const enBase = (await repo.get('shopping_lists', 'l')).checked;
      ok(rows.every(row => enBase[row.key] === true), 'L0 C08 : la base conserve les deux cases sans écrasement');
    }));
  } finally { setUiLocale(langue); }
}

// Exécuter ce complément dans un profil isolé America/Toronto ; il ne dépend pas du fuseau de la suite publique.
export async function runL0HeureTorontoTests({ eq, ok }) {
  const langue = getUiLocale(); setUiLocale('fr');
  try {
    eq(Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Toronto', 'L0 C03 : profil de preuve réellement dans America/Toronto');
    eq(analyserHeureLocale('2026-03-08T02:30').etat, 'inexistante', 'L0 C03 : heure sautée du printemps refusée');
    eq(analyserHeureLocale('2026-11-01T01:30').occurrences, [{ iso: '2026-11-01T05:30:00.000Z', offset_minutes: -240 }, { iso: '2026-11-01T06:30:00.000Z', offset_minutes: -300 }], 'L0 C03 : les deux occurrences d’automne restent distinctes');
    eq(analyserHeureLocale('2026-03-08T03:30').occurrences.map(x => x.iso), ['2026-03-08T07:30:00.000Z'], 'L0 C03 : une heure valide après changement d’heure est acceptée');
    eq(formaterHeureLocale('2026-10-29T23:00:00Z'), '2026-10-29T19:00', 'L0 C03 : 23 h UTC s’affiche 19 h à Toronto');
    await withRepo(async repo => {
      let meal = repas('2026-10-29T23:00:00.000Z'); await repo.save('meals', meal);
      let vue = await renderMeal({ id: meal.id }, {}, contexte([meal]), { refresh: () => {} });
      ecrire(vue.querySelector('input[type=datetime-local]'), '2026-03-08T02:30');
      ok(bouton(vue, 'Enregistrer l’heure').disabled && vue.textContent.includes('Cette heure n’existe pas'), 'L0 C03 : heure sautée bloquée dans le formulaire');
      eq((await repo.get('meals', meal.id)).serve_at, meal.serve_at, 'L0 C03 : une heure sautée n’a aucune écriture');
      ecrire(vue.querySelector('input[type=datetime-local]'), '2026-11-01T01:30');
      const choix = vue.querySelector('[data-role=heure-repas] select');
      eq(choix?.value, '2026-11-01T05:30:00.000Z', 'L0 C03 : première occurrence proposée avant confirmation');
      ok(choix?.textContent.includes('UTC−04:00') && choix?.textContent.includes('UTC−05:00'), 'L0 C03 : les décalages sont visibles avant enregistrement');
      ecrire(choix, '2026-11-01T06:30:00.000Z');
      eq(vue.querySelector('[data-role=decalage-repas]')?.textContent, 'Décalage choisi : UTC−05:00', 'L0 C03 : le décalage choisi reste lisible hors du select étroit');
      await saveHeure(vue);
      eq((await repo.get('meals', meal.id)).serve_at, '2026-11-01T06:30:00.000Z', 'L0 C03 : choix explicite de la seconde occurrence enregistré');
      meal = await repo.get('meals', meal.id); vue = await renderMeal({ id: meal.id }, {}, contexte([meal]), { refresh: () => {} });
      eq(vue.querySelector('[data-role=heure-repas] select')?.value, meal.serve_at, 'L0 C03 : réouverture conserve la seconde occurrence');
      await saveHeure(vue);
      eq((await repo.get('meals', meal.id)).serve_at, meal.serve_at, 'L0 C03 : sauvegarde sans modification ne décale pas d’une heure');
    });
  } finally { setUiLocale(langue); }
}
