// Aujourd'hui : recherche, reprendre ma recette, Redécouvrir, favoris, dernières cuissons, ingrédients à utiliser (spec §17).
import { el, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { emit } from '../core/bus.js';
import { pickSuggestion, snoozeUntil } from '../domain/rediscover.js';
import { parseQuery } from '../domain/search.js';
import { recipeCard, section, emptyState, availabilityBadge, provenanceText } from './components.js';

export async function renderHome(params, query, ctx) {
  const root = el('div', null);
  const input = el('input', { type: 'search', placeholder: t('Qu’est-ce qu’on cuisine ?'), 'aria-label': t('Recherche'), enterkeyhint: 'search' });
  const go = () => { if (input.value.trim()) navigate('/search' + buildQuery({ q: input.value.trim(), mode: 'all' })); else navigate('/search'); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.append(el('div', { class: 'card sage' },
    el('h1', null, t('Qu’est-ce qu’on cuisine ?')),
    el('div', { class: 'search-bar' }, input, el('button', { class: 'btn primary', onClick: go }, t('Chercher'))),
    el('div', { class: 'chips', style: { marginTop: '.6rem' } },
      ...['saumon fenouil', 'salade concombre sans gluten 15 minutes', 'soupe rapide', 'puttanesca'].map((ex) => el('span', { class: 'chip clickable', onClick: () => { input.value = ex; go(); } }, ex)))));

  // Reprendre ma recette
  const active = ctx.cook_sessions.filter((s) => s.status === 'active').sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  if (active.length) {
    root.append(section(t('Reprendre ma recette'), ...active.slice(0, 3).map((s) => {
      const doc = ctx.docsByRecipe.get(s.recipe_id);
      const total = s.progress?.total_steps || doc?.version?.steps?.length || 0;
      const done = s.progress?.done_step_ids?.length || 0;
      return el('a', { class: 'item-link card flat', href: `#/cook/${s.id}` },
        el('div', { class: 'row between' }, el('strong', null, doc?.recipe.display_title || doc?.recipe.original_title || t('Recette')), el('span', { class: 'muted' }, t('{d}/{n} étapes', { d: done, n: total }))),
        el('div', { class: 'progress', style: { marginTop: '.4rem' } }, el('div', { style: { width: total ? `${Math.round(done / total * 100)}%` : '0%' } })));
    })));
  }

  // Redécouvrir
  if (ctx.settings.rediscover_enabled) root.append(await rediscoverCard(ctx, query));

  // Favoris
  const favs = ctx.docs.filter((d) => d.recipe.favorite).slice(0, 6);
  if (favs.length) root.append(section(t('Favoris'), ...favs.map((d) => recipeCard(d))));

  // Dernières cuissons → Refaire comme la dernière fois
  const recent = [...ctx.cook_history].sort((a, b) => (b.cooked_at || '').localeCompare(a.cooked_at || '')).slice(0, 4);
  if (recent.length) {
    root.append(section(t('Dernières cuissons'), el('ul', { class: 'list' }, ...recent.map((h) => {
      const doc = ctx.docsByRecipe.get(h.recipe_id);
      if (!doc) return null;
      return el('li', { class: 'row between' },
        el('div', null, el('a', { href: `#/recipes/${h.recipe_id}` }, el('strong', null, doc.recipe.display_title || doc.recipe.original_title)),
          el('div', { class: 'muted', style: { fontSize: '.85rem' } }, `${formatDate(h.cooked_at)}${h.rating ? ` · ${'★'.repeat(h.rating)}` : ''}${h.redo === false ? ` · ${t('à ne pas refaire')}` : ''}`)),
        el('a', { class: 'btn small', href: `#/recipes/${h.recipe_id}${buildQuery({ v: h.recipe_version_id, servings: h.servings || '' })}` }, t('Refaire comme la dernière fois')));
    }))));
  }

  // Ingrédients à utiliser (inventaire)
  const soon = ctx.inventory.filter((i) => i.use_by && (Date.parse(i.use_by) - Date.now()) < 4 * 86400000).sort((a, b) => a.use_by.localeCompare(b.use_by)).slice(0, 5);
  if (soon.length) {
    root.append(section(t('À utiliser en priorité'), el('ul', { class: 'list' }, ...soon.map((i) => el('li', { class: 'row between' },
      el('span', null, `${i.label}${i.quantity_text ? ` — ${i.quantity_text}` : ''}`),
      el('span', { class: `chip ${Date.parse(i.use_by) < Date.now() ? 'danger' : 'warn'}` }, `${t('à consommer avant le')} ${formatDate(i.use_by)}`)))),
      el('a', { class: 'btn small', href: '#/kitchen?tab=inventory' }, t('Voir l’inventaire'))));
  }

  if (!ctx.recipes.length) {
    root.append(section(t('Bienvenue'), el('p', null, t('Ta bibliothèque est vide. Commence par ajouter un livre, puis photographie sa table des matières ou une recette.')),
      el('div', { class: 'row' }, el('a', { class: 'btn primary', href: '#/add' }, t('Ajouter')), el('a', { class: 'btn', href: '#/settings' }, t('Restaurer une sauvegarde')))));
  }
  return root;
}

async function rediscoverCard(ctx, query) {
  const context = query.q ? parseQuery(query.q).filters : {};
  const s = pickSuggestion({ editions: ctx.book_editions, books: ctx.books, recipes: ctx.recipes, activity: ctx.library_activity, prefs: ctx.rediscovery_prefs, context });
  if (!s) return el('div');
  const pref = ctx.rediscovery_prefs.find((p) => p.edition_id === s.edition.id) || { edition_id: s.edition.id };
  if (!pref.last_suggested_at || Date.now() - Date.parse(pref.last_suggested_at) > 86400000) {
    await repo.db.put('rediscovery_prefs', { ...pref, last_suggested_at: new Date().toISOString() });
  }
  const title = s.mode === 'rediscover'
    ? t('À redécouvrir : ce livre n’a pas été consulté dans Cuisine OS depuis {n} mois.', { n: s.months_since })
    : t('À explorer dans ta bibliothèque');
  const savePref = async (patch) => { await repo.db.put('rediscovery_prefs', { ...pref, ...patch }); emit('change', { store: 'rediscovery_prefs' }); refresh(); };
  return el('div', { class: 'card', style: { borderLeft: '4px solid var(--sage)' } },
    el('div', { class: 'muted', style: { fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.04em' } }, t('Redécouvrir')),
    el('h2', null, title),
    el('p', null, el('strong', null, s.book?.title || ''), s.book?.author ? ` — ${s.book.author}` : ''),
    s.recipe ? el('div', { class: 'card flat' },
      el('div', { class: 'row between' }, el('strong', null, s.recipe.display_title || s.recipe.original_title), availabilityBadge(s.recipe)),
      el('p', { class: 'muted', style: { fontSize: '.9rem' } }, s.reason)) : null,
    el('div', { class: 'row' },
      s.recipe ? el('a', { class: 'btn primary', href: `#/recipes/${s.recipe.id}` }, s.recipe.availability === 'reference_only' ? t('Voir la page du livre') : t('Voir la recette')) : null,
      el('button', { class: 'btn', onClick: () => refresh() }, t('Autre idée')),
      el('button', { class: 'btn', onClick: () => savePref({ snoozed_until: snoozeUntil(14) }) }, t('Plus tard')),
      el('button', { class: 'btn', onClick: () => savePref({ hidden: true }) }, t('Masquer ce livre'))));
}

export { emptyState, provenanceText };
