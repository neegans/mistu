// Composants partagés : en-têtes, badges d'état, cartes, pastilles de filtres, quantités avec hypothèses, minuteries.
import { el, formatMinutes, downloadBlob, toast } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { lienSignet } from '../core/lien.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { displayQuantity, REASON_LABELS } from '../domain/units.js';
import { shortcutUrl, siriPhrase, describeDuration, isAppleTouchDevice } from '../domain/timers.js';
import { navigate } from '../core/router.js';
import { displayUrl, safeDisplayType } from '../sync/mime.js';
import * as repo from '../model/repo.js';
import { pastilleModel } from './state.js';
import { estCreationIA, etiquetteCreationIA } from '../domain/creation-ia.js';
import { DIFFICULTES, LIMITES_WEB } from '../domain/recherche-web.js';

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
  // Un signet web n'est pas « Repérée dans ton livre » : il n'y a pas de page de livre, il y a un lien (spec § 11, F8).
  if (recipe.availability === 'reference_only' && recipe.source_url) return el('span', { class: 'badge reference' }, t('Lien web'));
  const cls = recipe.availability === 'available' ? 'available' : recipe.availability === 'partial' ? 'partial' : 'reference';
  const text = recipe.availability === 'reference_only' && recipe.printed_page ? t('Repérée dans ton livre — page {p}', { p: recipe.printed_page }) : label('availability', recipe.availability);
  return el('span', { class: `badge ${cls}` }, text);
}

// C-2 / R-CRE-4 : l'étiquette d'une création IA (ou d'une version d'une fiche origine 'ia'), TEXTE de etiquetteCreationIA rendu par t() ;
// null quand les données ne disent rien d'une création — jamais lue dans source_label.
export function etiquetteIA(version, recipe = null) {
  const texte = etiquetteCreationIA(version, recipe);
  return texte ? el('span', { class: 'badge ai', dataset: { role: 'etiquette-ia' } }, t(texte)) : null;
}

// Le second paramètre (la fiche) est facultatif : sans lui, une création reste une création, mais une version manuelle d'une fiche
// origine 'ia' ne peut pas dire sa lignée (N-10). Une extraction IA de livre reste « Original » (F6).
export function versionBadge(version, recipe = null) {
  if (!version) return null;
  const ia = etiquetteIA(version, recipe);
  if (ia && estCreationIA(version)) return ia; // l'étiquette porte déjà « testée / non testée »
  if (ia && version.kind !== 'adaptation' && version.kind !== 'synthesis') return ia;
  if (ia) return el('span', { class: 'row', style: { gap: '.3rem' } }, ia, el('span', { class: 'badge' }, label('version_status', version.status || 'proposed')));
  if (version.kind === 'extraction' || version.kind === 'correction') return el('span', { class: 'badge original' }, t('Original'));
  if (version.kind === 'translation') return el('span', { class: 'badge' }, t('Traduction'));
  const who = version.provenance?.generated_by === 'ai' ? el('span', { class: 'badge ai' }, t('Adaptation IA')) : el('span', { class: 'badge personal' }, t('Ma version'));
  return el('span', { class: 'row', style: { gap: '.3rem' } }, who, el('span', { class: 'badge' }, label('version_status', version.status || 'proposed')));
}

export function timeText(version) {
  if (!version || estCreationIA(version)) return ''; // C-6 : la durée d'une création n'est qu'une estimation, dite à part (recipe.js)
  const parts = [];
  const active = version.active_minutes ?? version.prep_minutes;
  if (active != null) parts.push(`${t('actif')} ${formatMinutes(active)}`);
  const total = version.total_minutes ?? ((version.prep_minutes != null || version.cook_minutes != null) ? (version.prep_minutes || 0) + (version.cook_minutes || 0) : null);
  if (total != null) parts.push(`${t('total')} ${formatMinutes(total)}`);
  return parts.join(' · ');
}

// --- Lecture par l'assistant (lot import ciblé, spec § 4.3.6-4.3.7, D-3) ------------------------------------------------------------
// banniereLecture(version, ligne = null) : PURE. Ce que la fiche dit d'une version lue par l'assistant — { date, incertaines, missing_page,
// incomplete, incertain } — ou null quand la version ne vient pas d'un import (provenance.import_id absent : saisie à la main, extraction
// d'avant le lot). La date est celle de la LECTURE : `provenance.lu_le` quand la version le porte (une correction l'hérite), sinon created_at
// (l'extraction elle-même) ; une date illisible vaut null, et une lu_le présente mais illisible ne retombe jamais sur created_at (la date d'une
// correction n'est pas celle de la lecture ; rien d'inventé, ronde 1). `incertaines` ne compte que les lignes uncertain === true. `incertain` :
// texteIncertain(ligne, import_id) ci-dessous (deux arguments, décision 2 de la tâche 5, consignée en spec § 12).
export const INCERTAIN_MAX = 300;
const CONTROLES_INCERTAIN = /[\p{Cc}\p{Cf}]/gu;
// Une date ISO lisible (chaîne que Date.parse comprend), sinon null — pour une valeur reçue, restaurée ou héritée.
export const isoLisible = (d) => (typeof d === 'string' && Number.isFinite(Date.parse(d)) ? d : null);
// Vague finale (m6) : une LECTURE seulement — une extraction ou une correction, de l'assistant (generated_by ai) ou héritière d'une lecture (lu_le) ;
// jamais une adaptation qui recopie la provenance (« Ma version », remplacement d'ingrédient). Importée (import_id), ou portant ce que la lecture a dit
// d'incomplet : une lecture de l'éditeur détachée de sa ligne (T6-R1-e) montre quand même « page possiblement manquante » / « lecture incomplète » (I-1).
// « Incertain » : la ligne du journal d'abord, puis les incertitudes gardées dans la version (m8 : la ligne peut avoir été purgée à 30 jours).
export function banniereLecture(version, ligne = null) {
  const p = version?.provenance;
  if (!p || typeof p !== 'object') return null;
  const lecture = (version.kind === 'extraction' || version.kind === 'correction') && (p.generated_by === 'ai' || Object.hasOwn(p, 'lu_le'));
  if (!lecture || !((typeof p.import_id === 'string' && p.import_id) || p.incomplete === true || p.missing_page === true)) return null;
  const date = Object.hasOwn(p, 'lu_le') ? isoLisible(p.lu_le) : isoLisible(version.created_at);
  const incertaines = (Array.isArray(version.ingredients) ? version.ingredients : []).filter((l) => l?.uncertain === true).length;
  return { date, incertaines, missing_page: p.missing_page === true, incomplete: p.incomplete === true, incertain: texteIncertain(ligne, p.import_id) ?? texteDesChamps(p.uncertain_fields) };
}

// texteIncertain(ligne, importId) : PURE (ronde 1, extraite de banniereLecture). Le « Incertain : … » d'une lecture = resultat.uncertain_fields de la
// ligne du journal de CET import (pointeur souple : null quand la ligne est absente, purgée, ou celle d'un autre import) — une DONNÉE HOSTILE (reçue,
// restaurée) : chaînes seulement, Cc/Cf retirés, espaces repliées, jointes par « ; », bornée à INCERTAIN_MAX points de code (coupée avec « … »,
// total ≤ INCERTAIN_MAX), null quand il ne reste rien. Rendue en nœud texte par l'appelant. texteDesChamps : la même règle sur une liste (m8).
export function texteIncertain(ligne, importId) {
  if (typeof importId !== 'string' || !importId) return null;
  return texteDesChamps(ligne && ligne.id === importId && ligne.resultat && typeof ligne.resultat === 'object' ? ligne.resultat.uncertain_fields : null);
}
export function texteDesChamps(champs) {
  if (!Array.isArray(champs)) return null;
  const texte = champs.filter((c) => typeof c === 'string').map((c) => c.replace(CONTROLES_INCERTAIN, '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ; ');
  const points = Array.from(texte);
  return points.length === 0 ? null : points.length <= INCERTAIN_MAX ? texte : points.slice(0, INCERTAIN_MAX - 1).join('') + '…';
}

// estExtractionNonRelue(version) : PURE. D-3 : le mode cuisine et les courses disent « Lue par l'assistant, non relue » tant que la version est
// une LECTURE de l'assistant (generated_by ai) dont les lignes restent à vérifier : une extraction, ou une relecture par l'assistant depuis
// « Corriger » (écrite en `correction`, ronde 1) ; une correction à la main, une saisie à la main, une adaptation, une création (synthesis, qui a
// sa propre étiquette) ou une version vérifiée ne le sont pas.
export function estExtractionNonRelue(version) {
  return !!version && (version.kind === 'extraction' || version.kind === 'correction') && version.provenance?.generated_by === 'ai' && version.verification_state === 'to_verify';
}

// La ligne de repères d'une carte de l'onglet Web, et désormais d'un signet gardé par « Garder et lire » (lot B, D-B5 : déménagée de search.js, même
// rendu, même texte) : temps estimé, difficulté, nombre d'ingrédients — les parties PRÉSENTES, jointes par « · », dans cet ordre ; '' s'il n'y en a
// aucune. Chaque partie est revalidée ici : une valeur illisible ou hors des bornes du domaine (1440 min, 99 ingrédients) ne fait rien paraître.
export function ligneReperes(lien) {
  const parties = [];
  const n = lien?.temps_min;
  if (Number.isInteger(n) && n >= 1 && n <= LIMITES_WEB.tempsMax) {
    if (n < 60) parties.push(t('≈ {n} min', { n }));
    else {
      const h = Math.floor(n / 60); const m = n % 60;
      parties.push(m === 0 ? t('≈ {h} h', { h }) : t('≈ {h} h {m}', { h, m: String(m).padStart(2, '0') }));
    }
  }
  if (DIFFICULTES.includes(lien?.difficulte)) parties.push({ facile: t('facile'), moyen: t('moyen'), exigeant: t('exigeant') }[lien.difficulte]);
  const k = lien?.ingredients;
  if (Number.isInteger(k) && k >= 1 && k <= LIMITES_WEB.ingredientsMax) parties.push(k === 1 ? t('1 ingrédient') : t('{n} ingrédients', { n: k }));
  return parties.join(' · ');
}

export function provenanceText(recipe, book, edition) {
  // C-2 : une fiche créée avec l'assistant le dit EN TÊTE — ni son source_label (une valeur stockée n'est pas une preuve), ni un
  // livre, ni un site ne prennent sa place. Le texte vient de etiquetteCreationIA (fiche seule).
  if (recipe?.origine === 'ia') return t(etiquetteCreationIA(null, recipe));
  // Signet web (R-UX-11, S7) : l'hôte est RECALCULÉ depuis l'adresse, ici comme dans la vue recette — source_label
  // peut venir d'une archive ou du serveur et nommer n'importe quoi. Une adresse illisible le dit, et n'emprunte
  // pas le libellé stocké pour se faire passer pour un site.
  const lien = recipe.source_url ? lienSignet(recipe.source_url) : null;
  // C10 : un signet rattaché à un livre portait le livre et PERDAIT son hôte (alors que la spec, F22, demande les
  // deux : c'est une page web rangée dans un livre, pas une page du livre). Les deux s'affichent, dans cet ordre.
  if (book) {
    const duLivre = `${book.title}${book.author ? ` — ${book.author}` : ''}${recipe.printed_page ? ` · ${t('page')} ${recipe.printed_page}` : ''}`;
    return lien ? `${duLivre} · ${lien.ok ? lien.hote : t('Adresse non reconnue')}` : duLivre;
  }
  if (lien) return lien.ok ? lien.hote : t('Adresse non reconnue');
  if (recipe.source_label) return recipe.source_label;
  return t('Source personnelle');
}

// doc : { recipe, version, book, edition, cooked }
export function recipeCard(doc, { extra = null, href = null, reasons = null } = {}) {
  const { recipe, version, book, edition } = doc;
  const etiquette = etiquetteIA(version, recipe); // C-2 : depuis doc.version ou recipe.origine
  return el('a', { class: 'item-link card', href: href || `#/recipes/${recipe.id}` },
    el('div', { class: 'row between top' },
      el('div', { style: { flex: '1', minWidth: '0' } },
        el('h3', null, recipe.display_title || recipe.original_title),
        el('div', { class: 'muted', style: { fontSize: '.85rem' } }, provenanceText(recipe, book, edition)),
        etiquette ? el('div', null, etiquette) : null,
        version ? el('div', { class: 'muted', style: { fontSize: '.85rem' } }, timeText(version)) : null,
        reasons?.length ? el('div', { class: 'muted', style: { fontSize: '.8rem' } }, `${t('Correspond à')} : ${reasons.slice(0, 4).join(', ')}`) : null),
      el('div', { class: 'col', style: { alignItems: 'flex-end', gap: '.3rem' } },
        availabilityBadge(recipe),
        recipe.favorite ? el('span', { class: 'badge' }, '★ ' + t('Favori')) : null,
        doc.cooked ? el('span', { class: 'badge' }, t('Cuisinée {n}×', { n: doc.cooked })) : null)),
    extra);
}

// La vignette d'un livre (spec § 6) : l'image si la LIGNE files est là, sinon le titre sur le fond — et rien de plus.
// Un pointeur cover_sha256 sans octets (fiche reçue d'un autre appareil, avant L4) n'est pas un manque à signaler ici :
// une grille de livres n'est pas l'endroit pour dire ce qui n'est pas arrivé (la fiche du livre, elle, le dit).
// R-UX-14 : quand l'image est là, le titre et l'auteur passent en display:none — c'est l'IMAGE qui doit alors porter
// le nom, sinon le lien n'a plus de nom du tout pour qui ne voit pas la couverture. Sans titre connu : alt vide
// (décorative), jamais un nom inventé.
export function bookCover(edition, book, { href = null, fichier = null } = {}) {
  // S3 : une ligne `files` peut venir d'une archive ou du serveur et porter n'importe quel `mime` sur n'importe quel
  // blob. Le type d'affichage passe par la liste blanche et DOIT être une image ; le blob est retypé avec lui (un
  // blob text/html dans un <img> ne s'afficherait pas, mais l'URL existerait quand même). Hors liste : vignette texte.
  const type = safeDisplayType(fichier?.mime);
  const affichable = fichier?.blob instanceof Blob && !!type && type.startsWith('image/');
  const image = affichable
    ? el('img', { class: 'cover-img', alt: book?.title || '', src: urlDeBlob(fichier.blob.type === type ? fichier.blob : new Blob([fichier.blob], { type })) })
    : null;
  // D-T9 : sans titre connu, l'image reste décorative (alt vide, jamais un nom inventé) — mais le texte passe en
  // display:none quand l'image est là, et le lien n'aurait alors plus aucun nom. L'ancre le porte donc toujours.
  return el('a', { class: 'cover-wrap', href: href || `#/books/${encodeURIComponent(edition.id)}`, 'aria-label': book?.title || t('Sans titre') },
    el('div', { class: `cover${image ? ' with-img' : ''}` }, image,
      el('div', { class: 'title' }, book?.title || t('Sans titre')),
      el('div', { class: 'author' }, [book?.author, edition.year].filter(Boolean).join(' · '))));
}

// Carte d'action de la page « Ajouter » (spec § 4) et de l'accueil d'un livre (§ 8).
export function carte(ico, titre, sousTitre, onClick) {
  return el('button', { type: 'button', class: 'card carte', onClick },
    el('div', { class: 'carte-ico', 'aria-hidden': 'true' }, ico), el('h3', null, titre), sousTitre ? el('p', { class: 'muted' }, sousTitre) : null);
}

// Un seul libellé pour désigner un livre dans une liste (spec § 10, F18) : titre · auteur · année.
export function libelleLivre(edition, book) {
  return [book?.title || t('Sans titre'), book?.author, edition?.year].filter(Boolean).join(' · ');
}

export function libellePuce(chip, ingredientsById) {
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
  return el('div', { class: 'chips' }, ...chips.map((c) => el('span', { class: `chip ${onRemove ? 'removable' : ''} ${c.kind === 'diet' || c.kind === 'exclude' ? 'warn' : ''}`, onClick: onRemove ? () => onRemove(c) : null, title: onRemove ? t('Retirer ce filtre') : '' }, libellePuce(c, ingredientsById))));
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
  // N-9 : une ligne non vérifiée s'affiche telle qu'écrite ; l'identité que le parseur propose n'est qu'une mention. Le badge « Traduction »
  // ne vaut que pour un libellé du lexique (une ligne vérifiée) : un texte écrit n'est pas traduit (P11).
  const verifiee = ri.verification_state === 'verified';
  const libelle = ing ? (ing.labels?.[locale]?.label || ing.labels?.fr?.label) : null;
  const name = ing && verifiee ? libelle : (ri.name_text || ri.source_text);
  const translated = ing && verifiee && ri.name_text && locale !== ri.match_locale && ctx.readingLocale !== 'original';
  return el('li', null,
    el('div', { class: 'row', style: { gap: '.4rem' } },
      qtyEl(ri, { ...ctx, ingredient: verifiee ? ing : null }), // N-9 : jamais l'identité proposée pour une conversion
      el('span', null, name, ri.preparation ? el('span', { class: 'muted' }, `, ${ri.preparation}`) : null, ri.optional ? el('span', { class: 'muted' }, ` (${t('facultatif')})`) : null,
        ing && !verifiee ? el('span', { class: 'muted' }, ` (${t('identité proposée')} : ${libelle} ?)`) : null),
      translated ? el('span', { class: 'badge' }, t('Traduction')) : null,
      !verifiee ? el('span', { class: 'chip warn', title: t('Ligne à vérifier') }, t('À vérifier')) : null,
      // Import ciblé (spec § 4.3.6) : l'incertitude dite par le modèle sur CETTE ligne — uncertain === true seulement, jamais une autre forme reçue.
      ri.uncertain === true ? el('span', { class: 'chip warn', title: t('Ligne incertaine selon l’assistant') }, t('incertain')) : null),
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

// La session de l'assistant (R-T3-1) : une DONNÉE { access_token, user } lue de ctx.sync.auth.jeton() que les écrans passent à
// providerFrom / aux modules de domaine. Jamais le module d'auth, jamais le contexte. Trois murs :
//  - garde de compte : sans ctx.sync.user (aucun compte, ou la garde de compte a refusé l'adresse sur cet appareil) → null, et
//    jeton() n'est même pas appelé — aucun jeton ne part pour un compte refusé ;
//  - délai : jeton() peut rafraîchir le jeton PAR LE RÉSEAU (supabase-js) ; au-delà de `delaiMs` (2 s, comme demarrerSync, R28)
//    → null, l'écran se rend « sans session » cette fois et le rendu suivant réessaie ;
//  - jamais de levée : toute erreur → null.
export async function sessionAssistant(ctx, { delaiMs = 2000 } = {}) {
  let minuterie = null;
  try {
    if (!ctx?.sync?.user) return null;
    const lecture = Promise.resolve(ctx.sync.auth?.jeton?.()).catch(() => null);
    const delai = new Promise((fin) => { minuterie = setTimeout(() => fin(null), delaiMs); });
    return (await Promise.race([lecture, delai])) ?? null;
  } catch { return null; } finally { clearTimeout(minuterie); }
}

// === Assistant sans session et refus de la passerelle (R-T4-4) : UNE définition pour search.js, creer-ia.js, import.js et recipe-edit.js.
// Le but d'abord (règle d'écran : dire à quoi sert la chose, pas comment le système marche) : sans session, la phrase et le geste
// de connexion ; avec une session que la passerelle refuse, le refus en clair — jamais le corps de la réponse ni un mot de code.
export const TEXTE_CONNEXION = 'Connecte-toi pour utiliser l’assistant.';

// Le geste de connexion est celui de la section Compte de Réglages : il est passé par l'appelant (`demarrerConnexion` vit dans
// settings.js, qui importe ce module — l'importer ici ferait un cycle).
export function boutonSeConnecter(connecter, { classe = 'btn' } = {}) {
  // Appelé sur le geste lui-même (pas différé), et aucun rejet ne s'échappe d'un onClick : une phrase fixe, jamais le message du fournisseur.
  const echec = () => toast(t('La connexion n’a pas pu démarrer.'));
  return el('button', { type: 'button', class: classe, dataset: { role: 'se-connecter' }, onClick: () => { try { Promise.resolve(connecter()).catch(echec); } catch { echec(); } } }, t('Se connecter'));
}

// Garde de compte REFUSÉE sur cet appareil (F-7) : l'adresse connectée n'est pas celle que cet appareil sert — `ctx.sync.user` est nul et
// la session de l'assistant aussi, comme sans compte. « Se connecter » renverrait Google, puis la même garde, puis le même refus : une
// boucle OAuth. Le message de la garde (qui dit à quel compte l'appareil est lié) remplace donc la phrase et le bouton ; les deux issues de
// la garde (« Se déconnecter », « Changer de compte sur cet appareil ») vivent dans Réglages → Synchronisation.
export function messageGardeRefusee(sync) {
  const garde = sync?.guard;
  if (!garde || garde.ok !== false) return null;
  return typeof garde.message === 'string' && garde.message ? garde.message : t('Cet appareil ne peut pas vérifier le compte.');
}

export function carteConnexion(connecter, ctx = null) {
  const gardeRefusee = messageGardeRefusee(ctx?.sync);
  if (gardeRefusee) return el('div', { class: 'status warn', dataset: { role: 'connexion-ia' } }, el('span', null, gardeRefusee));
  return el('div', { class: 'status warn', dataset: { role: 'connexion-ia' } }, el('span', null, t(TEXTE_CONNEXION)), ' ', boutonSeConnecter(connecter));
}

// Le texte du refus d'une issue de domaine — { raison, quota, trop_lourd } — ou null pour toute autre raison (leurs textes restent à l'écran
// qui les connaît). `quota` : le nombre du jour quand la passerelle l'a donné, sinon la phrase sans nombre (R-T4-9).
export function texteRefusAssistant(issue) {
  if (issue?.raison === 'non_admis') return t('Ce compte n’a pas accès à l’assistant.');
  if (issue?.raison === 'quota') return Number.isInteger(issue.quota) && issue.quota >= 0 ? t('Tu as atteint la limite du jour pour l’assistant ({n} appels).', { n: issue.quota }) : t('Tu as atteint la limite du jour pour l’assistant.');
  if (issue?.raison === 'requete' && issue.trop_lourd === true) return t('La demande est trop lourde.');
  return null;
}

// Le texte d'un échec de l'extraction : PasserelleProvider.complete lève Error(raison d'issue) avec ses extras (`quota`, `trop_lourd`), le même
// classement que les écrans de recherche et de création (echecDomaine) — le refus en clair avec son nombre, « Trop de demandes… » pour un 429
// relayé, la phrase de connexion sans session ; toute raison technique (serveur, delai, reseau…) est le texte générique + « Code : {c} »,
// jamais le mot de code seul. {c} est BORNÉ : une raison connue tient en un mot ; tout autre message (une exception du navigateur, du parseur…)
// est coupé à 40 caractères (points de code), ses retours à la ligne et suites d'espaces ramenés à une espace, et un message vide est « inconnu ».
const CODE_ASSISTANT_MAX = 40;
const codeAssistant = (message) => Array.from(message.replace(/\s+/g, ' ').trim()).slice(0, CODE_ASSISTANT_MAX).join('') || 'inconnu';
export function texteEchecAssistant(erreur) {
  const raison = typeof erreur?.message === 'string' ? erreur.message : '';
  if (raison === 'non_connecte') return t(TEXTE_CONNEXION);
  // Une demande trop lourde est ici une LECTURE DE PAGES (seuls import.js et recipe-edit.js passent par cette fonction) : la phrase dit quoi faire
  // (F-3). La recherche web et la création, sans pages, gardent « La demande est trop lourde. » (texteRefusAssistant).
  if (raison === 'requete' && erreur?.trop_lourd === true) return t('La demande est trop lourde : choisis moins de pages.');
  const refus = texteRefusAssistant({ raison, quota: erreur?.quota, trop_lourd: erreur?.trop_lourd });
  if (refus) return refus;
  if (raison === 'trop_de_demandes') return t('Trop de demandes pour l’instant. Réessaie dans une minute.');
  return `${t('L’assistant n’a pas répondu. Réessaie.')} ${t('Code : {c}', { c: codeAssistant(raison) })}`;
}
// === fin Assistant

// --- Pastille « N non envoyés » de la barre du haut (spec § 4.2) ----------
// Un seul nœud dans toute l'application, posé par la coquille (app.js) et mis à jour par le moteur. La mise à jour
// le RETROUVE par son identifiant à chaque appel : la coquille entière est reconstruite au changement de langue, et
// une référence gardée en variable désignerait alors un nœud détaché — la pastille ne bougerait plus jamais.
// Le texte vient de pastilleModel (src/ui/state.js) : null = rien à dire, donc nœud caché (jamais « 0 »).
export const PASTILLE_ID = 'pastille';

export function pastille() {
  return el('span', { class: 'pastille', id: PASTILLE_ID, hidden: true });
}

export function majPastille(etat, connecte = false) {
  const noeud = document.getElementById(PASTILLE_ID);
  if (!noeud) return null;
  const texte = pastilleModel({ aEnvoyer: etat?.aEnvoyer || 0, connecte });
  noeud.textContent = texte || '';
  noeud.hidden = texte === null;
  return texte;
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
