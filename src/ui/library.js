// Mes livres : grille de couvertures, progrès utiles sans culpabilité, vue Plats (spec §17, §30, §32).
import { el, promptDialog, toast } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { pageHeader, bookCover, segmented, emptyState, section, recipeCard } from './components.js';
import { revoquerUrlDeBlob } from '../core/blob-urls.js';
import { proposeDishesForRecipe } from '../domain/dishes.js';

export async function renderLibrary(params, query, ctx) {
  const tab = query.tab || 'books';
  const root = el('div', null,
    pageHeader(t('Mes livres'), { actions: [el('a', { class: 'btn primary', href: '#/add' }, t('Ajouter'))] }),
    el('div', { style: { marginBottom: '1rem' } }, segmented([{ value: 'books', label: t('Livres') }, { value: 'dishes', label: t('Plats') }], tab, (v) => navigate('/library' + buildQuery({ tab: v })))));
  if (tab === 'dishes') root.append(await dishesTab(ctx));
  else {
    root.append(await booksTab(ctx));
    // APRÈS booksTab, y compris quand il rend l'état vide : un signet sans livre n'a pas d'autre place, et le bouton
    // « ← Mes livres » de sa fiche y ramène (confort après preuve, 17 octobre).
    const liens = liensWebGardes(ctx);
    if (liens) root.append(liens);
    const creees = recettesCreeesIA(ctx); // N-7 : après « Liens web gardés »
    if (creees) root.append(creees);
  }
  return root;
}

// Les signets sans livre (edition_id nul, source_url posé), le dernier GARDÉ d'abord : created_at, updated_at en repli
// (un favori touché ne réordonne pas la liste — ronde 1) ; sans horodatage, en dernier. Aucun : rien n'est rendu.
const quand = (r) => String(r.created_at || r.updated_at || '');
const plusRecentesDabord = (a, b) => (quand(a) < quand(b) ? 1 : quand(a) > quand(b) ? -1 : 0);
const carteOuLien = (ctx, r) => {
  const doc = ctx.docsByRecipe?.get(r.id);
  return doc ? recipeCard(doc) : el('a', { class: 'btn', href: `#/recipes/${r.id}` }, r.display_title || r.original_title || t('Sans titre'));
};
function liensWebGardes(ctx) {
  const signets = (ctx.recipes || []).filter((r) => !r.edition_id && typeof r.source_url === 'string' && r.source_url).sort(plusRecentesDabord);
  if (!signets.length) return null;
  return section(t('Liens web gardés'), ...signets.map((r) => carteOuLien(ctx, r)));
}

// N-7 / N-10 : les fiches créées avec l'assistant, filtrées sur `origine` (pas sur la version courante : une fiche corrigée y reste),
// la plus récemment créée d'abord (même ordre que les signets) ; la carte dit l'étiquette C-2. Aucune : rien n'est rendu.
function recettesCreeesIA(ctx) {
  const creees = (ctx.recipes || []).filter((r) => r.origine === 'ia').sort(plusRecentesDabord);
  if (!creees.length) return null;
  return section(t('Recettes créées avec l’IA'), ...creees.map((r) => carteOuLien(ctx, r)));
}

async function booksTab(ctx) {
  if (!ctx.book_editions.length) return emptyState('📚', t('Aucun livre pour l’instant.'), el('a', { class: 'btn primary', href: '#/add' }, t('Ajouter un livre')));
  const recipesByEdition = repo.groupBy(ctx.recipes.filter((r) => r.edition_id), 'edition_id');
  // Les octets des couvertures sont lus UNE fois, en une transaction : la grille se redessine à chaque touche du
  // filtre et ne peut pas aller en base à chaque fois. Une empreinte sans ligne ici = couverture pas sur l'appareil.
  const fichiers = await repo.getFiles(ctx.book_editions.map((e) => e.cover_sha256).filter(Boolean));
  const filter = el('input', { type: 'search', placeholder: t('Filtrer par titre, auteur, cuisine…') });
  const grid = el('div', { class: 'grid' });
  const draw = () => {
    const q = filter.value.trim().toLowerCase();
    const eds = [...ctx.book_editions].sort((a, b) => (ctx.editionLabel(a) || '').localeCompare(ctx.editionLabel(b) || ''));
    const noeuds = [];
    for (const ed of eds) {
      const book = ctx.booksById.get(ed.book_id);
      const hay = `${book?.title || ''} ${book?.author || ''} ${(book?.cuisines || []).join(' ')} ${(book?.tags || []).join(' ')}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const list = recipesByEdition.get(ed.id) || [];
      const available = list.filter((r) => r.availability !== 'reference_only').length;
      const refs = list.length - available;
      noeuds.push(el('div', null, bookCover(ed, book, { fichier: ed.cover_sha256 ? fichiers.get(ed.cover_sha256) : null }),
        el('div', { class: 'muted', style: { fontSize: '.78rem', marginTop: '.3rem' } },
          list.length ? `${available ? t('{n} disponible(s)', { n: available }) : ''}${available && refs ? ' · ' : ''}${refs ? t('{n} repérée(s)', { n: refs }) : ''}` : t('Aucune recette indexée'))));
    }
    if (!noeuds.length) noeuds.push(el('p', { class: 'muted' }, t('Aucun livre ne correspond.')));
    // D-T9 : les URL blob: de la génération précédente sont révoquées APRÈS le remplacement des nœuds — avant, un
    // <img> encore dans le document pointait sur une URL morte (erreur de console). Et seules les anciennes sont
    // révoquées : « tout révoquer » ici emporterait les vignettes qu'on vient de créer (le filtre redessine à
    // chaque touche).
    const anciennes = [...grid.querySelectorAll('img.cover-img')].map((i) => i.src);
    grid.replaceChildren(...noeuds);
    for (const u of anciennes) revoquerUrlDeBlob(u);
  };
  filter.addEventListener('input', draw);
  draw();
  return el('div', null, el('div', { style: { marginBottom: '.8rem' } }, filter), grid);
}

async function dishesTab(ctx) {
  const links = ctx.dish_recipe_links;
  const root = el('div', null);
  const newDish = async () => {
    const fr = await promptDialog(t('Nom du plat (français)'), { placeholder: 'Puttanesca' });
    if (!fr) return;
    const en = await promptDialog(t('Nom du plat (anglais, facultatif)'), { placeholder: 'Puttanesca' });
    await repo.save('dishes', { id: repo.newId('dish'), labels: { fr: { label: fr.trim(), aliases: [] }, en: { label: (en || fr).trim(), aliases: [] } } });
    toast(t('Plat créé'));
    refresh();
  };
  root.append(el('div', { class: 'row between', style: { marginBottom: '.8rem' } },
    el('p', { class: 'muted', style: { margin: 0 } }, t('Un plat rassemble des recettes apparentées de plusieurs livres, sans écraser leurs sources.')),
    el('button', { class: 'btn', onClick: newDish }, t('Nouveau plat'))));
  if (!ctx.dishes.length) { root.append(emptyState('🍝', t('Aucun plat défini. Crée « Puttanesca », puis rattache-lui les recettes de tes livres.'))); return root; }
  const list = el('ul', { class: 'list' });
  for (const dish of [...ctx.dishes].sort((a, b) => a.labels.fr.label.localeCompare(b.labels.fr.label))) {
    const confirmed = links.filter((l) => l.dish_id === dish.id && l.state === 'confirmed');
    const proposed = links.filter((l) => l.dish_id === dish.id && l.state === 'proposed').length;
    const editions = new Set(confirmed.map((l) => ctx.recipesById.get(l.recipe_id)?.edition_id).filter(Boolean));
    list.append(el('li', null, el('a', { class: 'item-link', href: `#/dishes/${dish.id}` },
      el('div', { class: 'row between' },
        el('div', null, el('h3', null, dish.labels.fr.label, dish.labels.en?.label && dish.labels.en.label !== dish.labels.fr.label ? el('span', { class: 'muted' }, ` · ${dish.labels.en.label}`) : null),
          el('div', { class: 'muted', style: { fontSize: '.85rem' } }, t('{n} recette(s) dans {m} livre(s)', { n: confirmed.length, m: editions.size }))),
        proposed ? el('span', { class: 'chip warn' }, t('{n} à confirmer', { n: proposed })) : null))));
  }
  root.append(list);
  // Propositions de rapprochement pour les recettes sans plat
  const linkedRecipeIds = new Set(links.filter((l) => l.state !== 'refused').map((l) => l.recipe_id));
  const proposals = [];
  for (const r of ctx.recipes) {
    if (linkedRecipeIds.has(r.id)) continue;
    const p = proposeDishesForRecipe(r, ctx.dishes, links)[0];
    if (p) proposals.push({ recipe: r, ...p });
  }
  if (proposals.length) {
    root.append(section(t('Rapprochements proposés'), el('p', { class: 'muted' }, t('Similarité de titre seulement. Confirmer ou refuser ; un refus est mémorisé et reste réversible.')),
      ...proposals.slice(0, 10).map((p) => el('div', { class: 'row between card flat' },
        el('div', null, el('strong', null, p.recipe.display_title || p.recipe.original_title), el('div', { class: 'muted', style: { fontSize: '.85rem' } }, `→ ${p.dish.labels.fr.label} · ${p.evidence}`)),
        el('div', { class: 'row' },
          el('button', { class: 'btn small primary', onClick: async () => { await repo.save('dish_recipe_links', { id: repo.newId('drl'), dish_id: p.dish.id, recipe_id: p.recipe.id, state: 'confirmed', proposed_by: 'title_similarity', evidence: p.evidence, reviewed_at: repo.nowIso() }); refresh(); } }, t('Confirmer')),
          el('button', { class: 'btn small', onClick: async () => { await repo.save('dish_recipe_links', { id: repo.newId('drl'), dish_id: p.dish.id, recipe_id: p.recipe.id, state: 'refused', proposed_by: 'title_similarity', evidence: p.evidence, reviewed_at: repo.nowIso() }); refresh(); } }, t('Refuser')))))));
  }
  return root;
}
