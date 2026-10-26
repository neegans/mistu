// Liste d'épicerie : consolidation par ingrédient et dimension compatible, quantités par recette consultables, cases persistantes.
import { el, toast } from '../core/dom.js';
import { t } from '../core/i18n.js';
import * as repo from '../model/repo.js';
import { buildShoppingList, shoppingListToText } from '../domain/grocery.js';
import { pageHeader, section, emptyState, estExtractionNonRelue } from './components.js';

export async function renderShoppingList(params, query, ctx) {
  const list = ctx.shopping_lists.find((l) => l.id === params.id);
  if (!list) return el('div', { class: 'card' }, t('Liste introuvable.'));
  list.checked = list.checked || {};
  const items = (list.items || []).map((it) => { const version = ctx.versionsById.get(it.recipe_version_id); const recipe = ctx.recipesById.get(it.recipe_id); return version && recipe ? { version, servings: it.servings, title: it.title || recipe.original_title, convention_id: ctx.conventionFor(recipe) } : null; }).filter(Boolean);
  const rows = buildShoppingList(items, ctx.ingredientsById, { locale: ctx.settings.ui_locale });
  const root = el('div', null, pageHeader(list.title, { back: { href: list.meal_id ? `/meals/${list.meal_id}` : '/meals', label: list.meal_id ? t('Repas') : t('Ma semaine') }, actions: [
    el('button', { class: 'btn', onClick: async () => { const text = shoppingListToText(rows.map((r) => ({ ...r, checked: !!list.checked[r.key] }))); try { await navigator.clipboard.writeText(text); toast(t('Liste copiée')); } catch { toast(t('Copie impossible')); } } }, t('Copier')),
    navigator.share ? el('button', { class: 'btn', onClick: () => navigator.share({ title: list.title, text: shoppingListToText(rows) }).catch(() => {}) }, t('Partager')) : null,
  ] }));
  root.append(el('p', { class: 'muted' }, `${items.map((it) => `${it.title}${it.servings ? ` (${it.servings} ${t('portions')})` : ''}`).join(' · ')}`));
  // D-3 (import ciblé) : une version lue par l'assistant et non relue le dit au-dessus de la liste — ses quantités viennent d'une lecture à vérifier.
  if (items.some((it) => estExtractionNonRelue(it.version))) root.append(el('div', { class: 'status warn', style: { marginBottom: '.6rem' }, dataset: { role: 'bandeau-non-relue' } }, t('Lue par l’assistant, non relue')));
  if (!rows.length) { root.append(emptyState('panier', t('Aucun ingrédient structuré dans ces recettes.'))); return root; }
  const ul = el('ul', { class: 'list' });
  for (const r of rows) {
    const cb = el('input', { type: 'checkbox', checked: !!list.checked[r.key], onChange: async (e) => { list.checked[r.key] = e.target.checked; await repo.save('shopping_lists', list); li.style.opacity = e.target.checked ? '.5' : '1'; } });
    const li = el('li', { style: { opacity: list.checked[r.key] ? '.5' : '1' } },
      el('label', { class: 'check', style: { alignItems: 'flex-start' } }, cb,
        el('div', null,
          el('div', { class: 'row' }, el('strong', null, r.label), ...r.totals.map((tot) => el('span', { class: 'qty' }, tot.text)), !r.ingredient_id ? el('span', { class: 'chip neutral', title: t('Ingrédient non identifié : regroupé par nom seulement') }, t('non identifié')) : null),
          el('details', null, el('summary', { class: 'muted', style: { fontSize: '.85rem', cursor: 'pointer' } }, t('Par recette ({n})', { n: r.entries.length })),
            el('ul', { class: 'list plain' }, ...r.entries.map((e) => el('li', { style: { fontSize: '.9rem' } }, el('span', { class: 'muted' }, `${e.recipe_title} : `), e.display || e.source_text, e.optional ? el('span', { class: 'muted' }, ` (${t('facultatif')})`) : null, e.scaled ? el('span', { class: 'muted' }, ` · ${t('recalculé')}`) : null)))),
          ...r.notes.map((n) => el('div', { class: 'muted', style: { fontSize: '.8rem' } }, n)))));
    ul.append(li);
  }
  root.append(section(null, ul, el('small', { class: 'muted' }, t('Additionnés seulement lorsque l’ingrédient est identique et l’unité convertible. Bouillon et eau restent distincts ; une plage compte sa borne haute.'))));
  return root;
}
