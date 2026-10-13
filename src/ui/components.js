// Composants partagés : en-têtes, badges d'état, cartes, pastilles de filtres, quantités avec hypothèses, minuteries.
import { el, formatMinutes, downloadBlob, toast } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { displayQuantity, REASON_LABELS } from '../domain/units.js';
import { shortcutUrl, siriPhrase, describeDuration, isAppleTouchDevice } from '../domain/timers.js';
import { navigate } from '../core/router.js';
import { displayUrl } from '../sync/mime.js';
import * as repo from '../model/repo.js';

export function pageHeader(title, { subtitle = null, actions = [], back = null } = {}) {
  return el('header', { class: 'stack', style: { marginBottom: '1rem' } },
    back ? el('a', { href: `#${back.href}`, class: 'muted', style: { textDecoration: 'none', fontSize: '.9rem' } }, `← ${back.label}`) : null,
    el('div', { class: 'row between top' },
      el('div', null, el('h1', null, title), subtitle ? el('p', { class: 'muted' }, subtitle) : null),
      actions.length ? el('div', { class: 'row' }, ...actions) : null));
}

export function section(title, ...children) {
  return el('section', { class: 'card' }, title ? el('h2', null, title) : null, ...children);
}

export function emptyState(icon, text, action = null) {
  return el('div', { class: 'empty' }, el('div', { class: 'ico' }, icon), el('p', null, text), action);
}

export function availabilityBadge(recipe) {
  const cls = recipe.availability === 'available' ? 'available' : recipe.availability === 'partial' ? 'partial' : 'reference';
  const text = recipe.availability === 'reference_only' && recipe.printed_page ? t('Repérée dans ton livre — page {p}', { p: recipe.printed_page }) : label('availability', recipe.availability);
  return el('span', { class: `badge ${cls}` }, text);
}

export function versionBadge(version) {
  if (!version) return null;
  if (version.kind === 'extraction' || version.kind === 'correction') return el('span', { class: 'badge original' }, t('Original'));
  if (version.kind === 'translation') return el('span', { class: 'badge' }, t('Traduction'));
  const who = version.provenance?.generated_by === 'ai' ? el('span', { class: 'badge ai' }, t('Adaptation IA')) : el('span', { class: 'badge personal' }, t('Ma version'));
  return el('span', { class: 'row', style: { gap: '.3rem' } }, who, el('span', { class: 'badge' }, label('version_status', version.status || 'proposed')));
}

export function timeText(version) {
  if (!version) return '';
  const parts = [];
  const active = version.active_minutes ?? version.prep_minutes;
  if (active != null) parts.push(`${t('actif')} ${formatMinutes(active)}`);
  const total = version.total_minutes ?? ((version.prep_minutes != null || version.cook_minutes != null) ? (version.prep_minutes || 0) + (version.cook_minutes || 0) : null);
  if (total != null) parts.push(`${t('total')} ${formatMinutes(total)}`);
  return parts.join(' · ');
}

export function provenanceText(recipe, book, edition) {
  if (book) return `${book.title}${book.author ? ` — ${book.author}` : ''}${recipe.printed_page ? ` · ${t('page')} ${recipe.printed_page}` : ''}`;
  if (recipe.source_label) return recipe.source_label;
  return t('Source personnelle');
}

// doc : { recipe, version, book, edition, cooked }
export function recipeCard(doc, { extra = null, href = null, reasons = null } = {}) {
  const { recipe, version, book, edition } = doc;
  return el('a', { class: 'item-link card', href: href || `#/recipes/${recipe.id}` },
    el('div', { class: 'row between top' },
      el('div', { style: { flex: '1', minWidth: '0' } },
        el('h3', null, recipe.display_title || recipe.original_title),
        el('div', { class: 'muted', style: { fontSize: '.85rem' } }, provenanceText(recipe, book, edition)),
        version ? el('div', { class: 'muted', style: { fontSize: '.85rem' } }, timeText(version)) : null,
        reasons?.length ? el('div', { class: 'muted', style: { fontSize: '.8rem' } }, `${t('Correspond à')} : ${reasons.slice(0, 4).join(', ')}`) : null),
      el('div', { class: 'col', style: { alignItems: 'flex-end', gap: '.3rem' } },
        availabilityBadge(recipe),
        recipe.favorite ? el('span', { class: 'badge' }, '★ ' + t('Favori')) : null,
        doc.cooked ? el('span', { class: 'badge' }, t('Cuisinée {n}×', { n: doc.cooked })) : null)),
    extra);
}

export function bookCover(edition, book, { href = null } = {}) {
  return el('a', { class: 'cover-wrap', href: href || `#/books/${edition.id}` },
    el('div', { class: 'cover' },
      el('div', { class: 'title' }, book?.title || t('Sans titre')),
      el('div', { class: 'author' }, [book?.author, edition.year].filter(Boolean).join(' · '))));
}

export function chipLabel(chip, ingredientsById) {
  const ingName = (id) => ingredientsById?.get(id)?.labels?.fr?.label || id;
  switch (chip.kind) {
    case 'type': return label('recipe_type', chip.value);
    case 'diet': return label('diet', chip.value);
    case 'include': return `${t('avec')} ${ingName(chip.value)}`;
    case 'exclude': return `${t('sans')} ${ingName(chip.value)}`;
    case 'exclude_text': return `${t('sans')} « ${chip.value} »`;
    case 'max_total': return `${t('prêt en')} ≤ ${chip.value} min`;
    case 'max_active': return `≤ ${chip.value} min ${t('actives')}`;
    default: return `${chip.kind}: ${chip.value}`;
  }
}

export function filterChips(chips, ingredientsById, onRemove) {
  if (!chips.length) return null;
  return el('div', { class: 'chips' }, ...chips.map((c) => el('span', { class: `chip ${onRemove ? 'removable' : ''} ${c.kind === 'diet' || c.kind === 'exclude' ? 'warn' : ''}`, onClick: onRemove ? () => onRemove(c) : null, title: onRemove ? t('Retirer ce filtre') : '' }, chipLabel(c, ingredientsById))));
}

export function field(labelText, input, hint = null) {
  return el('label', { class: 'field' }, el('span', null, labelText), input, hint ? el('small', null, hint) : null);
}

export function select(options, value, onChange, { placeholder = null } = {}) {
  const s = el('select', { onChange: (e) => onChange(e.target.value) },
    placeholder ? el('option', { value: '' }, placeholder) : null,
    ...options.map((o) => el('option', { value: o.value, selected: o.value === value }, o.label)));
  if (value != null) s.value = value;
  return s;
}

export function segmented(options, value, onChange) {
  return el('div', { class: 'segmented', role: 'tablist' }, ...options.map((o) => el('button', { type: 'button', class: o.value === value ? 'active' : '', onClick: () => onChange(o.value) }, o.label)));
}

// Quantité d'un ingrédient dans les unités souhaitées, avec hypothèses au toucher (spec §29.2).
export function qtyEl(ri, { system = 'original', locale = 'fr', convention_id = null, ingredient = null } = {}) {
  const d = displayQuantity(ri.quantity, ri.unit_id, { system, locale, convention_id, ingredient });
  const span = el('span', { class: 'qty' }, d.text || (ri.quantity?.raw ?? ''));
  if (ri.unit_candidates) {
    span.append(' ', el('span', { class: 'chip warn', title: t('Unité ambiguë : once de masse ou once liquide ? À confirmer.') }, `${ri.unit_text} ?`));
  }
  if (d.converted) {
    span.append(' ', el('span', { class: 'est', title: [t('Original : {s}', { s: d.source_text }), ...d.assumptions].join('\n') }, d.estimate ? '≈' : '↺'));
  } else if (d.blocked && system !== 'original') {
    span.append(' ', el('span', { class: 'chip neutral', title: REASON_LABELS[d.blocked] || d.blocked }, t('orig.')));
  }
  if (ri.scaled && ri.quantity?.scaled_from) span.title = t('Recalculé à partir de « {s} »', { s: ri.quantity.scaled_from });
  return span;
}

export function ingredientLineEl(ri, ctx, ingredientsById) {
  const ing = ri.ingredient_id ? ingredientsById?.get(ri.ingredient_id) : null;
  const locale = ctx.readingLocale === 'original' ? (ctx.originalLocale || 'fr') : ctx.readingLocale;
  const name = ing ? (ing.labels?.[locale]?.label || ing.labels?.fr?.label) : (ri.name_text || ri.source_text);
  const translated = ing && ri.name_text && locale !== ri.match_locale && ctx.readingLocale !== 'original';
  return el('li', null,
    el('div', { class: 'row', style: { gap: '.4rem' } },
      qtyEl(ri, { ...ctx, ingredient: ing }),
      el('span', null, name, ri.preparation ? el('span', { class: 'muted' }, `, ${ri.preparation}`) : null, ri.optional ? el('span', { class: 'muted' }, ` (${t('facultatif')})`) : null),
      translated ? el('span', { class: 'badge' }, t('Traduction')) : null,
      ri.verification_state === 'to_verify' ? el('span', { class: 'chip warn', title: t('Ligne à vérifier') }, t('À vérifier')) : null),
    ri.source_text && (ri.source_text !== `${ri.quantity?.raw || ''} ${ri.unit_text || ''} ${ri.name_text || ''}`.replace(/\s+/g, ' ').trim()) && ctx.showSource
      ? el('div', { class: 'src-text' }, `${t('Texte source')} : ${ri.source_text}`) : null);
}

// Bloc minuterie (spec §33) : Siri par l'utilisateur, ou raccourci installé. Aucun compteur JS n'est présenté comme alarme.
export function timerBlock(seconds, { onRequest = null, locale = 'fr', compact = false } = {}) {
  const apple = isAppleTouchDevice();
  const dur = describeDuration(seconds, locale);
  const box = el('div', { class: 'card flat stack' },
    el('div', { class: 'row between' },
      el('strong', null, `${t('Minuterie')} — ${dur}`),
      apple ? el('a', { class: 'btn primary', href: shortcutUrl(seconds), onClick: () => onRequest && onRequest('shortcut') }, t('Lancer la minuterie système')) : null),
    el('div', { class: 'muted', style: { fontSize: '.9rem' } }, `${t('Ou dis à Siri')} : « ${siriPhrase(seconds, locale)} »`, ' ',
      el('button', { class: 'btn small', type: 'button', onClick: () => onRequest && onRequest('siri') }, t('J’ai demandé à Siri'))),
    apple ? null : el('div', { class: 'muted', style: { fontSize: '.85rem' } }, t('Sur Mac, utilise Horloge ou Siri directement ; le raccourci s’exécute sur iPhone et iPad.')),
    compact ? null : el('small', { class: 'muted' }, t('Le raccourci « CuisineOS-Minuterie » doit être installé une fois (voir Réglages). L’app ne peut pas confirmer qu’Horloge a bien démarré.')));
  return box;
}

export function aiNotice(ctx) {
  const configured = ctx?.settings?.llm?.provider && ctx.settings.llm.provider !== 'none';
  if (configured) return null;
  return el('div', { class: 'status warn' }, t('Assistant IA non configuré : saisie et corrections manuelles. Réglages → Assistant IA.'),
    el('a', { class: 'btn small', href: '#/settings' }, t('Réglages')));
}

export function linkButton(label, href, cls = 'btn') { return el('a', { class: cls, href: `#${href}` }, label); }

export function goto(path) { navigate(path); }

// Cadre PDF isolé : sandbox vide, bouton et phrase de repli toujours présents de façon synchrone — l'absence du blob
// (ligne « files » reçue, octets pas encore téléchargés, cf. L4) n'est pas détectable à l'avance (spec I5, § 6.2).
export function pdfFrame({ sha256, filename }) {
  const frame = el('iframe', { class: 'pdf', title: filename, sandbox: '' });
  repo.getFile(sha256).then((f) => { const u = displayUrl(f); if (u) frame.src = u; });
  return el('div', { class: 'stack' }, frame,
    el('div', { class: 'row' },
      el('button', { class: 'btn', onClick: async () => { const f = await repo.getFile(sha256); if (f) downloadBlob(f.blob, filename); else toast(t('Ce fichier n’est pas encore sur cet appareil.')); } }, t('Télécharger le fichier')),
      el('small', { class: 'muted' }, t('Si l’aperçu reste vide, télécharge le fichier.'))));
}

export function dietChip(assessment) {
  const cls = { compatible: 'ok', adaptation: 'warn', to_verify: 'warn', incompatible: 'danger' }[assessment.state] || 'neutral';
  const detail = assessment.state === 'to_verify' ? ` (${assessment.unknown.length} ${t('inconnu(s)')})` : assessment.blocking?.length ? ` : ${assessment.blocking.map((b) => b.label).join(', ')}` : '';
  return el('span', { class: `chip ${cls}`, title: t('Évaluation des ingrédients identifiés. Ne certifie ni les produits utilisés ni l’environnement de préparation.') }, `${label('diet', assessment.diet)} — ${label('diet_assessment', assessment.state)}${detail}`);
}
