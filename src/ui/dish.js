// Fiche Plat (spec §30) : recettes attribuées de plusieurs livres, rapprochements à confirmer, comparaison de 2–3 recettes.
import { el, toast, chooseDialog, promptDialog, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { proposeRecipesForDish, compareBundles } from '../domain/dishes.js';
import { currentVersion } from '../domain/search.js';
import { pageHeader, section, recipeCard, contexteFichiers, remplacerEnRevoquant, field, emptyState, libelleDisponibilite, etoiles } from './components.js';
import { etiquetteCreationIA } from '../domain/creation-ia.js';
import { comparerCuissons } from '../domain/cuisine-personnelle.js';

// C-2 (vague finale, B6) : la comparaison et les rattachements proposés disent la lignée IA d'une fiche `origine: 'ia'` — jamais un livre ni
// « p. {page} » (une page tapée par « Corriger » reste dans la fiche, elle n'en devient pas la provenance). Textes purs, épinglés par les tests.
// T5 ronde 1 (H-19, I-UI-1) : l'état passe par libelleDisponibilite (components.js) — un signet dit « Lien web », comme son badge, jamais « À importer » ; un
// état hors vocabulaire ne dit rien.
export function provenanceComparee({ recipe, version = null, book = null }) {
  if (recipe?.origine === 'ia') return [t(etiquetteCreationIA(version, recipe)), libelleDisponibilite(recipe)].filter(Boolean).join(' · ');
  return [book?.title, book?.author, recipe.printed_page ? `p. ${recipe.printed_page}` : null, libelleDisponibilite(recipe)].filter(Boolean).join(' · ');
}
export function lieuRattachement(recipe, editionTexte) {
  if (recipe?.origine === 'ia') return t(etiquetteCreationIA(null, recipe));
  return `${editionTexte}${recipe.printed_page ? ` · p. ${recipe.printed_page}` : ''}`;
}

export async function renderDish(params, query, ctx) {
  const ctxF = await contexteFichiers(ctx);
  const dish = ctx.dishesById.get(params.id);
  if (!dish) return el('div', { class: 'card' }, t('Plat introuvable.'));
  const links = ctx.dish_recipe_links.filter((l) => l.dish_id === dish.id);
  const confirmed = links.filter((l) => l.state === 'confirmed').map((l) => ctx.docsByRecipe.get(l.recipe_id)).filter(Boolean);
  const proposedLinks = links.filter((l) => l.state === 'proposed');
  const refused = links.filter((l) => l.state === 'refused');
  const proposals = proposeRecipesForDish(dish, ctx.recipes, links);
  const selected = new Set((query.cmp || '').split(',').filter(Boolean));
  const root = el('div', null);
  const editionsCount = new Set(confirmed.map((d) => d.recipe.edition_id).filter(Boolean)).size;
  root.append(pageHeader(dish.labels.fr.label, {
    subtitle: `${dish.labels.en?.label && dish.labels.en.label !== dish.labels.fr.label ? dish.labels.en.label + ' · ' : ''}${t('{n} recette(s) dans {m} livre(s)', { n: confirmed.length, m: editionsCount })}`,
    back: { href: '/library?tab=dishes', label: t('Plats') },
    actions: [el('button', { class: 'btn', onClick: editLabels }, t('Libellés')), el('button', { class: 'btn primary', onClick: attachRecipe }, t('Rattacher une recette'))],
  }));

  const compareBox = el('div', null);
  const listBox = el('div', null);
  const drawList = () => {
    remplacerEnRevoquant(listBox);
    if (!confirmed.length) { listBox.append(emptyState('assiette', t('Aucune recette rattachée. Rattache les recettes de tes livres pour les comparer.'))); return; }
    for (const d of confirmed) {
      const check = el('input', { type: 'checkbox', checked: selected.has(d.recipe.id), onChange: (e) => { if (e.target.checked) { if (selected.size >= 3) { e.target.checked = false; toast(t('Trois recettes au maximum')); return; } selected.add(d.recipe.id); } else selected.delete(d.recipe.id); drawCompare(); } });
      const hist = ctx.cook_history.filter((h) => h.recipe_id === d.recipe.id);
      const extra = el('div', { class: 'row between', style: { marginTop: '.4rem' } },
        el('label', { class: 'check', onClick: (e) => e.stopPropagation() }, check, t('Comparer')),
        el('span', { class: 'muted', style: { fontSize: '.85rem' } }, hist.length ? t('Cuisinée {n}× · dernière le {d}', { n: hist.length, d: formatDate(hist.sort(comparerCuissons)[0].cooked_at) }) : t('Jamais cuisinée')),
        el('button', { class: 'btn small', onClick: async (e) => { e.preventDefault(); e.stopPropagation(); const l = links.find((x) => x.recipe_id === d.recipe.id); await repo.save('dish_recipe_links', { ...l, state: 'refused', reviewed_at: repo.nowIso() }); refresh(); } }, t('Détacher')));
      listBox.append(recipeCard(d, { extra, ctxF }));
    }
  };
  const drawCompare = () => {
    compareBox.replaceChildren();
    if (selected.size < 2) { compareBox.append(el('p', { class: 'muted' }, t('Sélectionne deux ou trois recettes pour les comparer.'))); return; }
    const bundles = [...selected].map((id) => { const d = ctx.docsByRecipe.get(id); return d ? { ...d, history: ctx.cook_history.filter((h) => h.recipe_id === id).sort(comparerCuissons) } : null; }).filter(Boolean);
    const norm = el('input', { type: 'number', min: 1, placeholder: t('Mêmes portions ?'), style: { maxWidth: '160px' } });
    const out = el('div', null);
    const draw = () => {
      out.replaceChildren();
      const n = norm.value ? Number(norm.value) : null;
      const c = compareBundles(bundles, ctx.ingredientsById, { normalizeServings: n });
      const wide = window.matchMedia('(min-width: 760px)').matches;
      const heads = c.cols.map((col) => `${col.recipe.display_title || col.recipe.original_title}`);
      const prov = c.cols.map(provenanceComparee);
      const rows = [
        [t('Provenance'), prov],
        [t('Portions'), c.technique.map((x, i) => (c.cols[i].normalized ? `${n} (${t('normalisées depuis')} ${x.servings})` : x.servings ?? t('inconnues')))],
        [t('Temps'), c.technique.map((x) => [x.prep != null ? `${t('prép.')} ${x.prep} min` : null, x.cook != null ? `${t('cuisson')} ${x.cook} min` : null, x.total != null ? `${t('total')} ${x.total} min` : null].filter(Boolean).join(' · ') || t('inconnu'))],
        [t('Étapes'), c.technique.map((x) => (x.steps != null ? `${x.steps}` : t('non numérisées')))],
        [t('Ingrédients communs'), c.cols.map(() => c.common.map((x) => x.label).join(', ') || '—')],
        [t('Ingrédients propres'), c.only.map((ids) => ids.map((x) => x.label).join(', ') || '—')],
        [t('Non identifiés'), c.unresolved.map((u) => u.join(', ') || '—')],
        ...c.qtyRows.map((r) => [r.label, r.cells.map((cell) => `${cell.text}${cell.optional ? ` (${t('facultatif')})` : ''}${cell.preparation ? ` · ${cell.preparation}` : ''}`)]),
        [t('Expérience'), c.experience.map((x) => (x.cooked ? `${t('cuisinée')} ${x.cooked}× · ${formatDate(x.last_at)}${etoiles(x.rating) ? ' · ' + etoiles(x.rating) : ''}${x.notes ? ' · ' + x.notes : ''}` : t('jamais cuisinée')) + (x.preferred ? ` · ★ ${t('favori')}` : ''))],
      ];
      if (wide) {
        out.append(el('div', { style: { overflowX: 'auto' } }, el('table', { class: 'compare' },
          el('thead', null, el('tr', null, el('th', null, ''), ...heads.map((h) => el('th', null, h)))),
          el('tbody', null, ...rows.map(([lab, cells]) => el('tr', null, el('th', null, lab), ...cells.map((v) => el('td', null, v))))))));
      } else {
        for (const [lab, cells] of rows) out.append(el('div', { class: 'card flat' }, el('strong', null, lab), el('ul', { class: 'list plain' }, ...cells.map((v, i) => el('li', null, el('span', { class: 'badge' }, heads[i]), ' ', v)))));
      }
      out.append(el('small', { class: 'muted' }, t('Les inconnues restent visibles ; aucune normalisation fictive. Une étiquette au niveau du plat ne certifie pas toutes ses variantes.')));
    };
    norm.addEventListener('input', draw);
    compareBox.append(el('div', { class: 'row' }, field(t('Normaliser les quantités'), norm), el('button', { class: 'btn', disabled: true, title: t('Palier V1 : synthèse volontaire avec provenance de chaque emprunt.') }, t('Créer ma synthèse · V1'))), out);
    draw();
  };
  root.append(section(t('Recettes de ce plat'), listBox), section(t('Comparer'), compareBox));
  drawList(); drawCompare();

  if (proposedLinks.length || proposals.length) {
    root.append(section(t('Rapprochements proposés'), el('p', { class: 'muted' }, t('Confirmer tient compte des ingrédients et de la préparation quand ils sont disponibles ; une référence d’index rattachée garde ses différences culinaires inconnues.')),
      ...proposedLinks.map((l) => proposalRow(ctx.recipesById.get(l.recipe_id), l.evidence, async (state) => { await repo.save('dish_recipe_links', { ...l, state, reviewed_at: repo.nowIso() }); refresh(); })),
      ...proposals.map((p) => proposalRow(p.recipe, p.evidence, async (state) => { await repo.save('dish_recipe_links', { id: repo.newId('drl'), dish_id: dish.id, recipe_id: p.recipe.id, state, proposed_by: 'title_similarity', evidence: p.evidence, reviewed_at: repo.nowIso() }); refresh(); }))));
  }
  if (refused.length) root.append(el('details', { class: 'card' }, el('summary', null, t('Rattachements refusés ({n})', { n: refused.length })),
    ...refused.map((l) => { const r = ctx.recipesById.get(l.recipe_id); return el('div', { class: 'row between' }, el('span', null, r?.original_title || l.recipe_id), el('button', { class: 'btn small', onClick: async () => { await repo.save('dish_recipe_links', { ...l, state: 'confirmed', reviewed_at: repo.nowIso() }); refresh(); } }, t('Rétablir'))); })));
  return root;

  function proposalRow(recipe, evidence, onDecide) {
    if (!recipe) return null;
    return el('div', { class: 'row between card flat' },
      el('div', null, el('strong', null, recipe.display_title || recipe.original_title), el('div', { class: 'muted', style: { fontSize: '.85rem' } }, `${lieuRattachement(recipe, ctx.editionLabel(ctx.editionsById.get(recipe.edition_id)))} · ${evidence}`)),
      el('div', { class: 'row' }, el('button', { class: 'btn small primary', onClick: () => onDecide('confirmed') }, t('Confirmer')), el('button', { class: 'btn small', onClick: () => onDecide('refused') }, t('Refuser'))));
  }
  async function attachRecipe() {
    const linkedIds = new Set(links.filter((l) => l.state !== 'refused').map((l) => l.recipe_id));
    const options = ctx.recipes.filter((r) => !linkedIds.has(r.id)).sort((a, b) => a.original_title.localeCompare(b.original_title)).map((r) => ({ value: r.id, label: r.original_title, hint: ctx.editionLabel(ctx.editionsById.get(r.edition_id)) }));
    if (!options.length) { toast(t('Toutes les recettes sont déjà rattachées ou refusées')); return; }
    const id = await chooseDialog(t('Quelle recette rattacher à ce plat ?'), options);
    if (!id) return;
    const existing = links.find((l) => l.recipe_id === id);
    await repo.save('dish_recipe_links', { ...(existing || { id: repo.newId('drl'), dish_id: dish.id, recipe_id: id }), state: 'confirmed', proposed_by: 'user', evidence: t('Rattachement manuel'), reviewed_at: repo.nowIso() });
    refresh();
  }
  async function editLabels() {
    const fr = await promptDialog(t('Libellé français (alias séparés par des virgules après un « | »)'), { value: `${dish.labels.fr.label}${dish.labels.fr.aliases?.length ? ' | ' + dish.labels.fr.aliases.join(', ') : ''}` });
    if (fr === null) return;
    const en = await promptDialog(t('Libellé anglais (idem)'), { value: `${dish.labels.en?.label || ''}${dish.labels.en?.aliases?.length ? ' | ' + dish.labels.en.aliases.join(', ') : ''}` });
    const parse = (s) => { const [lab, al = ''] = s.split('|'); return { label: lab.trim(), aliases: al.split(',').map((x) => x.trim()).filter(Boolean) }; };
    await repo.save('dishes', { ...dish, labels: { fr: parse(fr), en: en ? parse(en) : dish.labels.en } });
    refresh();
  }
}

export { currentVersion };
