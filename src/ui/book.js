// Fiche d'un livre (édition possédée) : métadonnées, convention d'unités, recettes repérées et disponibles, pages sources.
import { el, toast, pickFiles, confirmDialog, promptDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, refresh, remplacerAdresse } from '../core/router.js';
import * as repo from '../model/repo.js';
import { displayUrl } from '../sync/mime.js';
import { listConventions } from '../domain/units.js';
import { pageHeader, section, field, select, recipeCard, emptyState } from './components.js';
import { startScanSession, indexEntriesPanel } from './import.js';
import { accueilLivreModel, renderAccueilLivre } from './accueil-livre.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';
import { ACCEPT_PHOTOS, ACCEPT_FICHIERS } from './add.js';

export const seancesOuvertes = (ctx, editionId) => (ctx.scan_sessions || []).filter((s) => s.status === 'open' && s.edition_id === editionId);

// « + Pages d'index » / « + Recette » : un <details> dont le résumé est le bouton, les sources dessous (spec § 9).
function menuSource(libelle, ...boutons) {
  return el('details', { class: 'menu-source' }, el('summary', { class: 'btn primary' }, libelle), el('div', { class: 'row', style: { marginTop: '.5rem' } }, ...boutons));
}

export async function renderBook(params, query, ctx) {
  const edition = ctx.editionsById.get(params.id);
  if (!edition) return el('div', { class: 'card' }, t('Livre introuvable.'));
  const book = ctx.booksById.get(edition.book_id) || { title: t('Sans titre') };
  if (query.nouveau === undefined) await repo.recordActivity(edition.id, 'open_book'); // S16 : l'arrivée après création n'est pas une ouverture volontaire
  const recipes = ctx.recipes.filter((r) => r.edition_id === edition.id);
  const docs = ctx.source_documents.filter((d) => d.edition_id === edition.id);
  const pages = ctx.source_pages.filter((p) => p.edition_id === edition.id);
  const pref = ctx.rediscovery_prefs.find((p) => p.edition_id === edition.id);
  const root = el('div', null);
  // I-F : un scan parti d'ici porte le livre ET l'intention (index ou recette) ; le menu ne décide que de la SOURCE.
  const lancer = (intention) => async (accept, capture) => {
    const f = await pickFiles({ accept, multiple: true, capture });
    if (f.length) startScanSession(f, { edition_id: edition.id, intention });
  };
  root.append(pageHeader(book.title, {
    subtitle: [book.author, edition.publisher, edition.year, edition.isbn ? `ISBN ${edition.isbn}` : null, edition.language ? edition.language.toUpperCase() : null].filter(Boolean).join(' · '),
    back: { href: '/library', label: t('Mes livres') },
    actions: [
      menuSource(t('+ Pages d’index'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF'))),
      menuSource(t('+ Recette'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF')),
        el('a', { class: 'btn', href: `#/recipes/new?edition=${edition.id}` }, t('Saisir à la main'))),
    ],
  }));
  root.append(renderAccueilLivre(accueilLivreModel({ nouveau: query.nouveau }), {
    photographier: (intention) => lancer(intention)(ACCEPT_PHOTOS, 'environment'),
    choisir: (intention) => lancer(intention)(ACCEPT_FICHIERS, null),
    plusTard: () => navigate('/library'),
    fermer: () => remplacerAdresse(`#/books/${edition.id}`),
  }));
  const ouvertes = seancesOuvertes(ctx, edition.id);
  if (ouvertes.length) root.append(el('div', { class: 'card flat row between' },
    el('span', null, t('Séance en cours : {n} page(s)', { n: ouvertes[0].page_ids.length })),
    el('a', { class: 'btn small', href: `#/import?session=${ouvertes[0].id}` }, t('Reprendre'))));

  const usesCups = ctx.recipe_versions.some((v) => recipes.some((r) => r.id === v.recipe_id) && (v.ingredients || []).some((i) => ['cup', 'tbsp', 'tsp', 'fl_oz'].includes(i.unit_id)));
  if (!edition.unit_convention_id && usesCups) {
    root.append(el('div', { class: 'card warn stack' },
      el('strong', null, t('Quelle convention pour les tasses et cuillères de cette édition ?')),
      el('p', { class: 'muted', style: { margin: 0 } }, t('Des recettes de ce livre utilisent des tasses ou des cuillères. Sans convention confirmée, ces quantités restent affichées telles quelles.')),
      el('div', { class: 'row' }, select([{ value: '', label: t('Choisir…') }, ...listConventions().map((c) => ({ value: c.id, label: c.labels.fr }))], '', async (v) => { if (!v) return; await repo.save('book_editions', { ...edition, unit_convention_id: v, convention_evidence: 'confirmed_by_user' }); toast(t('Convention confirmée')); refresh(); }))));
  }

  const available = recipes.filter((r) => r.availability !== 'reference_only');
  const refs = recipes.filter((r) => r.availability === 'reference_only');
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    el('span', { class: 'status ok' }, t('{n} recette(s) disponible(s)', { n: available.length })),
    el('span', { class: 'status warn' }, t('{n} repérée(s) dans l’index', { n: refs.length })),
    el('span', { class: 'status info' }, t('{n} page(s) source', { n: pages.length }))));

  // Recettes
  const filterState = { mode: 'all', q: '' };
  const list = el('div', null);
  const drawList = () => {
    list.replaceChildren();
    let rows = recipes;
    if (filterState.mode === 'available') rows = available; if (filterState.mode === 'refs') rows = refs; if (filterState.mode === 'fav') rows = recipes.filter((r) => r.favorite);
    if (filterState.q) rows = rows.filter((r) => (r.original_title + ' ' + (r.display_title || '')).toLowerCase().includes(filterState.q.toLowerCase()));
    rows = [...rows].sort((a, b) => (a.printed_page ?? 99999) - (b.printed_page ?? 99999) || a.original_title.localeCompare(b.original_title));
    if (!rows.length) { list.append(emptyState('📖', t('Aucune recette dans cette vue. Photographie l’index ou une recette pour commencer.'))); return; }
    for (const r of rows) {
      const doc = ctx.docsByRecipe.get(r.id);
      const extra = r.availability === 'reference_only' ? el('div', { class: 'row', style: { marginTop: '.4rem' } },
        el('button', { class: 'btn small', onClick: async (e) => { e.preventDefault(); const f = await pickFiles({ accept: 'image/*', capture: 'environment' }); if (f.length) { const s = await startScanSession(f, { edition_id: edition.id }); sessionStorage.setItem('cuisineos.pending_recipe', r.id); } } }, t('Scanner cette recette')),
        el('a', { class: 'btn small', href: `#/recipes/${r.id}/edit?kind=extraction`, onClick: (e) => e.stopPropagation() }, t('Saisir à la main'))) : null;
      list.append(recipeCard(doc || { recipe: r, version: null, book, edition }, { extra }));
    }
  };
  const q = el('input', { type: 'search', placeholder: t('Filtrer les recettes de ce livre'), onInput: (e) => { filterState.q = e.target.value; drawList(); } });
  root.append(section(t('Recettes'),
    el('div', { class: 'row', style: { marginBottom: '.6rem' } },
      ...[['all', t('Toutes')], ['available', t('Disponibles')], ['refs', t('Repérées')], ['fav', t('Favoris')]].map(([v, l]) => el('button', { class: 'btn small', onClick: (e) => { filterState.mode = v; for (const b of e.target.parentNode.children) b.classList.remove('active'); e.target.classList.add('active'); drawList(); } }, l)),
      q),
    list));
  drawList();

  // Index : ajouter des entrées directement depuis la fiche du livre
  const indexPanel = indexEntriesPanel(null, ctx, () => [], { editionId: edition.id });
  const details = el('details', null, el('summary', { class: 'btn' }, t('Ajouter des entrées d’index à la main')), indexPanel);
  root.append(details);

  // Pages et documents
  if (docs.length) {
    const thumbs = el('div', { class: 'thumbs' });
    for (const p of [...pages].sort((a, b) => (a.printed_page ?? 9999) - (b.printed_page ?? 9999))) {
      const img = el('img', { alt: t('Page'), loading: 'lazy' });
      repo.getFile(p.sha256).then((f) => { const u = displayUrl(f); if (u) img.src = u; });
      thumbs.append(el('figure', null, img, el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : t('page non numérotée'), p.kind ? ` · ${p.kind === 'index' ? t('index') : t('recette')}` : '')));
    }
    root.append(section(t('Pages et fichiers sources'),
      el('p', { class: 'muted' }, t('{n} document(s). Les originaux restent consultables depuis chaque recette.', { n: docs.length })),
      thumbs,
      ...docs.filter((d) => d.source_type !== 'photo').map((d) => el('div', { class: 'row between card flat' }, el('span', null, `${d.original_filename} (${d.source_type.toUpperCase()})`), el('a', { class: 'btn small', href: `#/recipes/new?doc=${d.id}&edition=${edition.id}` }, t('Créer une recette depuis ce fichier'))))));
  }

  // Métadonnées
  const meta = { title: book.title, author: book.author || '', isbn: edition.isbn || '', publisher: edition.publisher || '', year: edition.year || '', language: edition.language || 'fr', convention: edition.unit_convention_id || '', cuisines: [...(book.cuisines || [])] };
  const inp = (k, type = 'text') => el('input', { type, value: meta[k], onInput: (e) => { meta[k] = e.target.value; } });
  root.append(el('details', { class: 'card' }, el('summary', null, el('strong', null, t('Métadonnées et convention'))),
    el('div', { class: 'two-col', style: { marginTop: '.8rem' } },
      field(t('Titre'), inp('title')), field(t('Auteur / chef'), inp('author')), field(t('ISBN'), inp('isbn')), field(t('Éditeur'), inp('publisher')), field(t('Année'), inp('year', 'number')),
      field(t('Langue'), select([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'other', label: t('Autre') }], meta.language, (v) => { meta.language = v; })),
      // R-UX-8 : les puces ne vont JAMAIS dans un label — field() rend un <label>, et un clic sur « Cuisines »
      // activerait alors la première puce. Même habillage (.field), sans l'enveloppe qui vole le clic.
      el('div', { class: 'field' }, el('span', null, t('Cuisines')), (() => {
        const box = el('div', null);
        const dessiner = () => box.replaceChildren(renderPuces(pucesModel({ choisies: meta.cuisines, existantes: cuisinesExistantes(ctx) }), {
          basculer: (v) => { meta.cuisines = basculerPuce(meta.cuisines, v); dessiner(); },
          ajouter: (v) => { const a = ajouterPuce(meta.cuisines, v); if (a !== meta.cuisines) { meta.cuisines = a; dessiner(); } },
        }));
        dessiner();
        return box;
      })()),
      field(t('Convention de mesure'), select([{ value: '', label: t('Non confirmée') }, ...listConventions().map((c) => ({ value: c.id, label: c.labels.fr }))], meta.convention, (v) => { meta.convention = v; }), t('Ordre de décision : équivalences imprimées → convention décrite dans le livre → convention confirmée ici.'))),
    el('div', { class: 'row', style: { marginTop: '.8rem' } },
      el('button', { class: 'btn primary', onClick: async () => {
        await repo.saveBatch({ books: [{ ...book, title: meta.title.trim() || book.title, author: meta.author.trim(), cuisines: [...meta.cuisines] }],
          book_editions: [{ ...edition, isbn: meta.isbn.trim() || null, publisher: meta.publisher.trim() || null, year: meta.year ? parseInt(meta.year, 10) || null : null, language: meta.language, unit_convention_id: meta.convention || null, convention_evidence: meta.convention ? (edition.unit_convention_id === meta.convention ? edition.convention_evidence : 'confirmed_by_user') : null }] });
        toast(t('Enregistré')); refresh();
      } }, t('Enregistrer')),
      pref?.hidden ? el('button', { class: 'btn', onClick: async () => { await repo.save('rediscovery_prefs', { ...pref, hidden: false }); toast(t('Livre de nouveau proposé dans Redécouvrir')); refresh(); } }, t('Réafficher dans Redécouvrir')) : null,
      !recipes.length && !docs.length ? el('button', { class: 'btn danger', onClick: async () => {
        if (!(await confirmDialog(t('Supprimer ce livre ? Il n’a aucune recette ni page.'), { danger: true, okLabel: t('Supprimer') }))) return;
        await repo.remove('book_editions', edition.id);
        if (!ctx.book_editions.some((e) => e.book_id === book.id && e.id !== edition.id)) await repo.remove('books', book.id);
        navigate('/library');
      } }, t('Supprimer')) : el('small', { class: 'muted' }, t('Un livre avec des recettes ou des pages ne se supprime pas d’un geste.')))));
  return root;
}

export { promptDialog };
