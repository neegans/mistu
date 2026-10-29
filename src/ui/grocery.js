import { capturerRecette } from './recette-garde.js';
import { mentionCycleRecette } from './corbeille.js';
// Liste d'épicerie : consolidation par ingrédient et dimension compatible, quantités par recette consultables, cases persistantes.
import { el, toast } from '../core/dom.js';
import { t } from '../core/i18n.js';
import * as repo from '../model/repo.js';
import { buildShoppingList, preparerSortieCourses } from '../domain/grocery.js';
import { pageHeader, section, emptyState, estExtractionNonRelue, field, select } from './components.js';
import { TransitionRefusee } from '../core/db.js';

export async function renderShoppingList(params, query, ctx, deps = {}) {
  const list = ctx.shopping_lists.find((l) => l.id === params.id);
  if (!list) return el('div', { class: 'card' }, t('Liste introuvable.'));
  list.checked = list.checked || {};
  const R = deps.repo ?? repo, navigateur = deps.navigator ?? navigator, informer = deps.toast ?? toast;
  const items = (list.items || []).map((it) => { const version = ctx.versionsById.get(it.recipe_version_id); const recipe = ctx.recipesById.get(it.recipe_id); return version && recipe ? { version, servings: it.servings, title: it.title || recipe.original_title, convention_id: ctx.conventionFor(recipe) } : null; }).filter(Boolean);
  const rows = buildShoppingList(items, ctx.ingredientsById, { locale: ctx.settings.ui_locale });
  let mode = 'restants', actionEnCours = false;
  const casesEnCours = new Set(), lignesVisibles = new Map();
  const vide = el('p', { class: 'muted', role: 'status', dataset: { role: 'courses-vides' } });
  const copier = el('button', { class: 'btn', onClick: () => transmettre('copier') }, t('Copier'));
  const partager = typeof navigateur.share === 'function' ? el('button', { class: 'btn', onClick: () => transmettre('partager') }, t('Partager')) : null;
  const root = el('div', null, pageHeader(list.title, { back: { href: list.meal_id ? `/meals/${list.meal_id}` : '/meals', label: list.meal_id ? t('Repas') : t('Ma semaine') }, actions: [copier, partager].filter(Boolean) }));
  root.append(...[...new Set((list.items || []).map(it=>it.recipe_id))].map(id=>ctx.recipesById.get(id)).filter(Boolean).map(r => mentionCycleRecette(r, ctx?.editionsById?.get(r.edition_id))).filter(Boolean));
  root.append(field(t('Contenu à copier ou partager'), select([{ value: 'restants', label: t('Ce qu’il reste à acheter') }, { value: 'complet', label: t('Liste complète') }], mode, value => { mode = value; actualiserSortie(); })), vide);
  actualiserSortie();
  root.append(el('p', { class: 'muted' }, `${items.map((it) => `${it.title}${it.servings ? ` (${it.servings} ${t('portions')})` : ''}`).join(' · ')}`));
  // D-3 (import ciblé) : une version lue par l'assistant et non relue le dit au-dessus de la liste — ses quantités viennent d'une lecture à vérifier.
  if (items.some((it) => estExtractionNonRelue(it.version))) root.append(el('div', { class: 'status warn', style: { marginBottom: '.6rem' }, dataset: { role: 'bandeau-non-relue' } }, t('Lue par l’assistant, non relue')));
  if (!rows.length) { root.append(emptyState('panier', t('Aucun ingrédient structuré dans ces recettes.'))); return root; }
  const ul = el('ul', { class: 'list' });
  for (const r of rows) {
    const cb = el('input', { type: 'checkbox', checked: !!list.checked[r.key], onChange: async (e) => {
      const valeur = e.target.checked;
      if (casesEnCours.has(r.key)) return;
      cb.disabled = true; casesEnCours.add(r.key); actualiserSortie();
      try {
        const recettes = await Promise.all([...new Set((list.items || []).map(it => it.recipe_id))].map(id => capturerRecette(R, ctx.recipesById.get(id), {ctx, historique:true})));
        let casesSauvees;
        await R.saveBatch({}, { recettes, conditions: { shopping_lists: [{ key: list.id, fusion: courant => {
          if (!courant) throw new TransitionRefusee('shopping_lists', list.id, undefined);
          casesSauvees = { ...(courant.checked || {}), [r.key]: valeur };
          return { ...courant, checked: casesSauvees };
        } }] } });
        list.checked = casesSauvees;
      } catch { cb.checked = !!list.checked[r.key]; informer(t('La case n’a pas pu être enregistrée. Réessaie.')); }
      finally {
        cb.disabled = false; casesEnCours.delete(r.key);
        // La fusion peut avoir relu les achats d’un autre onglet. Les commandes et TOUTES les cases racontent le même état.
        // Un autre geste local encore en cours garde toutefois sa valeur visible jusqu’à sa propre confirmation/refus.
        for (const [key, ligne] of lignesVisibles) if (!casesEnCours.has(key)) {
          ligne.cb.checked = !!list.checked[key];
          ligne.li.style.opacity = ligne.cb.checked ? '.5' : '1';
        }
        actualiserSortie();
      }
    } });
    const li = el('li', { style: { opacity: list.checked[r.key] ? '.5' : '1' } },
      el('label', { class: 'check', style: { alignItems: 'flex-start' } }, cb,
        el('div', null,
          el('div', { class: 'row' }, el('strong', null, r.label), ...r.totals.map((tot) => el('span', { class: 'qty' }, tot.text)), !r.ingredient_id ? el('span', { class: 'chip neutral', title: t('Ingrédient non identifié : regroupé par nom seulement') }, t('non identifié')) : null),
          el('details', null, el('summary', { class: 'muted', style: { fontSize: '.85rem', cursor: 'pointer' } }, t('Par recette ({n})', { n: r.entries.length })),
            el('ul', { class: 'list plain' }, ...r.entries.map((e) => el('li', { style: { fontSize: '.9rem' } }, el('span', { class: 'muted' }, `${e.recipe_title} : `), e.display || e.source_text, e.optional ? el('span', { class: 'muted' }, ` (${t('facultatif')})`) : null, e.scaled ? el('span', { class: 'muted' }, ` · ${t('recalculé')}`) : null)))),
          ...r.notes.map((n) => el('div', { class: 'muted', style: { fontSize: '.8rem' } }, n)))));
    lignesVisibles.set(r.key, { cb, li }); ul.append(li);
  }
  root.append(section(null, ul, el('small', { class: 'muted' }, t('Additionnés seulement lorsque l’ingrédient est identique et l’unité convertible. Bouillon et eau restent distincts ; une plage compte sa borne haute.'))));
  return root;

  function actualiserSortie() {
    const sortie = preparerSortieCourses(rows, list.checked, mode);
    vide.textContent = !sortie.nombre && mode === 'restants' ? t('Rien à acheter') : '';
    copier.disabled = actionEnCours || casesEnCours.size > 0 || !sortie.nombre;
    if (partager) partager.disabled = copier.disabled;
  }
  async function transmettre(action) {
    if (actionEnCours || casesEnCours.size) return;
    const sortie = preparerSortieCourses(rows, list.checked, mode);
    if (!sortie.nombre) { actualiserSortie(); return; }
    actionEnCours = true; actualiserSortie();
    try {
      if (action === 'copier') { await navigateur.clipboard.writeText(sortie.texte); informer(t('Liste copiée')); }
      else await navigateur.share({ title: list.title, text: sortie.texte });
    } catch (e) {
      if (action === 'copier') informer(t('Copie impossible'));
      else if (e?.name !== 'AbortError') informer(t('Partage impossible. Tu peux copier la liste.'));
    } finally { actionEnCours = false; actualiserSortie(); }
  }
}
