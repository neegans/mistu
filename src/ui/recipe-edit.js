// Éditeur de version : extraction (saisie ou IA), correction ciblée, adaptation personnelle, traduction (spec §3.3, §6, §16).
// L'original n'est jamais réécrit : chaque enregistrement crée une nouvelle RecipeVersion liée à son parent.
import { el, toast, promptDialog, confirmDialog } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate } from '../core/router.js';
import * as repo from '../model/repo.js';
import { displayUrl } from '../sync/mime.js';
import { parseIngredientBlock, parseIngredientLine, parseStepsBlock } from '../domain/lines.js';
import { currentVersion } from '../domain/search.js';
import { getConvention } from '../domain/units.js';
import { providerFrom, extractRecipeFromImages, blobToBase64 } from '../domain/llm.js';
import { RECIPE_TYPES } from '../model/schema.js';
import { pageHeader, field, select, aiNotice, section, pdfFrame, sessionAssistant } from './components.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';

const SUBRECIPE_RE = /(?:voir|see|cf\.?)\s+(?:la\s+)?(?:page|p\.)\s*(\d{1,4})|\bp\.\s*(\d{1,4})\b/gi;

// § 7 : même geste que le livre pour les cuisines (puces.js). Pure : un tableau est repris tel quel, une ancienne
// chaîne CSV (avant ce lot) est découpée — pour que save() n'ait qu'un seul chemin de lecture.
export const cuisinesDepuis = (f) => Array.isArray(f?.cuisines) ? [...f.cuisines] : String(f?.cuisines || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export async function renderRecipeEdit(params, query, ctx) {
  const recipe = params.id ? ctx.recipesById.get(params.id) : null;
  if (params.id && !recipe) return el('div', { class: 'card' }, t('Recette introuvable.'));
  const versions = recipe ? (ctx.versionsByRecipe.get(recipe.id) || []) : [];
  const kind = query.kind || (recipe && versions.length ? 'correction' : 'extraction');
  const base = recipe ? (query.v ? ctx.versionsById.get(query.v) : currentVersion(recipe, versions)) : null;
  const editionId = query.edition || recipe?.edition_id || null;
  const edition = editionId ? ctx.editionsById.get(editionId) : null;
  const book = edition ? ctx.booksById.get(edition.book_id) : null;
  const pageIds = query.pages ? query.pages.split(',').filter(Boolean) : (recipe?.source_page_ids || []);
  const pages = pageIds.map((id) => ctx.pagesById.get(id)).filter(Boolean);
  const doc = query.doc ? ctx.source_documents.find((d) => d.id === query.doc) : null;
  const provider = providerFrom(ctx.settings, { session: await sessionAssistant(ctx) }); // la passerelle (R-T3-1) : la session décide

  // Référence en attente (bouton « Scanner cette recette » depuis la fiche du livre)
  let pendingRef = null;
  const pendingId = sessionStorage.getItem('cuisineos.pending_recipe');
  if (!recipe && pendingId) { const r = ctx.recipesById.get(pendingId); if (r && r.edition_id === editionId && r.availability === 'reference_only') pendingRef = r; }
  let attachToPending = !!pendingRef;

  const f = {
    title: recipe?.original_title || '', language: recipe?.original_language || edition?.language || 'fr', type: recipe?.type || '', cuisines: [...(recipe?.cuisines || [])],
    printed_page: recipe?.printed_page ?? pages.find((p) => p.printed_page)?.printed_page ?? '', source_label: recipe?.source_label || '',
    servings: base?.servings ?? '', prep: base?.prep_minutes ?? '', cook: base?.cook_minutes ?? '', active: base?.active_minutes ?? '', total: base?.total_minutes ?? '',
    ingredientsText: (base?.ingredients || []).map((i) => i.source_text).join('\n'), stepsText: (base?.steps || []).map((s) => s.text).join('\n'),
    notes: base?.notes || '', changes: '', status: 'proposed', translationLocale: f_defaultTranslation(recipe), aiUsed: false, aiModel: null,
  };
  if (kind === 'adaptation') { f.changes = ''; }
  let parsedLines = (base?.ingredients || []).map((i) => ({ ...i, id: repo.newId('ri') }));
  if (kind === 'translation') return translationEditor({ recipe, base, ctx, f });

  const root = el('div', null);
  root.append(pageHeader(recipe ? (kind === 'adaptation' ? t('Créer ma version') : t('Corriger la recette')) : t('Nouvelle recette'), {
    subtitle: [book ? book.title : t('Sans livre'), base ? `${t('à partir de')} : ${label('version_kind', base.kind)} ${base.created_at ? new Date(base.created_at).toLocaleDateString() : ''}` : null].filter(Boolean).join(' · '),
    back: recipe ? { href: `/recipes/${recipe.id}`, label: t('Fiche recette') } : { href: '/add', label: t('Ajouter') },
  }));
  if (pendingRef) root.append(el('div', { class: 'card sage row between' },
    el('span', null, t('Ces pages complètent la référence « {t} »{p} ?', { t: pendingRef.original_title, p: pendingRef.printed_page ? ` (${t('page')} ${pendingRef.printed_page})` : '' })),
    el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: true, onChange: (e) => { attachToPending = e.target.checked; if (attachToPending && !f.title) { f.title = pendingRef.original_title; titleInput.value = f.title; } } }), t('Oui, rattacher'))));
  if (!f.title && pendingRef) { f.title = pendingRef.original_title; f.printed_page = pendingRef.printed_page ?? f.printed_page; }

  // Colonne gauche : original (pages ou PDF)
  const left = el('div', { class: 'stack' });
  if (pages.length) {
    for (const p of pages) {
      const img = el('img', { class: 'page-view', alt: t('Page originale'), loading: 'lazy' });
      repo.getFile(p.sha256).then((fl) => { const u = displayUrl(fl); if (u) img.src = u; });
      left.append(el('figure', { style: { margin: 0 } }, img, el('figcaption', { class: 'muted' }, p.printed_page ? `${t('p.')} ${p.printed_page}` : t('page non numérotée'))));
    }
  } else if (doc && doc.source_type === 'pdf') {
    left.append(pdfFrame({ sha256: doc.sha256, filename: doc.original_filename }), el('small', { class: 'muted' }, t('Indique la page imprimée et, si utile, la position dans le fichier.')));
  } else left.append(el('div', { class: 'card flat muted' }, t('Aucune page source jointe. Tu peux saisir la recette et rattacher des pages plus tard.')));

  // Colonne droite : formulaire
  const titleInput = el('input', { type: 'text', value: f.title, onInput: (e) => { f.title = e.target.value; } });
  const ingTa = el('textarea', { rows: 10, value: f.ingredientsText, placeholder: '2 c. à soupe d’huile d’olive\n400 g de spaghetti\n1 boîte (400 g) de tomates italiennes\nsel, au goût', onInput: (e) => { f.ingredientsText = e.target.value; } });
  const stepsTa = el('textarea', { rows: 10, value: f.stepsText, placeholder: t('Une étape par ligne ou par paragraphe.'), onInput: (e) => { f.stepsText = e.target.value; } });
  const linesPreview = el('div', null);
  const stepsPreview = el('div', null);
  const num = (k) => el('input', { type: 'number', min: 0, value: f[k], onInput: (e) => { f[k] = e.target.value; } });

  const reparse = () => {
    const fresh = parseIngredientBlock(f.ingredientsText);
    const prior = new Map(parsedLines.map((l) => [l.source_text, l]));
    parsedLines = fresh.map((l) => {
      const p = prior.get(l.source_text);
      return p ? { ...l, ingredient_id: p.ingredient_id, unit_id: p.unit_id ?? l.unit_id, unit_candidates: p.unit_id ? null : l.unit_candidates, verification_state: p.verification_state, id: p.id } : l;
    });
    drawLines();
  };
  const drawLines = () => {
    linesPreview.replaceChildren();
    if (!parsedLines.length) return;
    const toVerify = parsedLines.filter((l) => l.verification_state !== 'verified').length;
    linesPreview.append(el('div', { class: `status ${toVerify ? 'warn' : 'ok'}`, style: { marginBottom: '.5rem' } }, toVerify ? t('{n} ligne(s) à vérifier', { n: toVerify }) : t('Toutes les lignes sont vérifiées')));
    const ingOptions = [{ value: '', label: t('— non identifié —') }, ...[...ctx.ingredients].sort((a, b) => a.labels.fr.label.localeCompare(b.labels.fr.label)).map((i) => ({ value: i.id, label: `${i.labels.fr.label}${i.labels.en?.label && i.labels.en.label !== i.labels.fr.label ? ` / ${i.labels.en.label}` : ''}` })), { value: '__new__', label: t('+ Créer un ingrédient…') }];
    const table = el('table', { class: 'compare' }, el('thead', null, el('tr', null, el('th', null, t('Texte source')), el('th', null, t('Quantité')), el('th', null, t('Unité')), el('th', null, t('Ingrédient')), el('th', null, t('Vérifié')))));
    const tbody = el('tbody', null);
    for (const l of parsedLines) {
      const qty = l.quantity ? (l.quantity.qualitative ? l.quantity.raw : (l.quantity.min != null ? `${l.quantity.min}–${l.quantity.max}` : l.quantity.raw)) : el('span', { class: 'muted' }, t('aucune'));
      const unitCell = l.unit_candidates
        ? select([{ value: '', label: `${l.unit_text} — ${t('ambigu')}` }, { value: 'oz_mass', label: t('once (masse)') }, { value: 'fl_oz', label: t('once liquide') }], '', (v) => { l.unit_id = v || null; if (v) l.unit_candidates = null; drawLines(); })
        : el('span', null, l.unit_id || (l.unit_text || '—'));
      const ingSel = select(ingOptions, l.ingredient_id || '', async (v) => {
        if (v === '__new__') {
          const name = await promptDialog(t('Nom de l’ingrédient ({l})', { l: f.language }), { value: l.name_text });
          if (!name) { drawLines(); return; }
          const other = await promptDialog(t('Nom dans l’autre langue (facultatif)'), { value: '' });
          const labels = f.language === 'en' ? { en: { label: name.trim(), aliases: [] }, fr: { label: (other || '').trim() || name.trim(), aliases: [] } } : { fr: { label: name.trim(), aliases: [] }, en: { label: (other || '').trim() || name.trim(), aliases: [] } };
          const ing = { id: repo.newId('ing'), category: 'autre', contains: null, labels, equivalences: [] };
          await repo.save('ingredients', ing);
          ctx.ingredients.push(ing); ctx.ingredientsById.set(ing.id, ing);
          l.ingredient_id = ing.id; l.verification_state = 'verified'; drawLines(); return;
        }
        l.ingredient_id = v || null; l.verification_state = 'verified'; drawLines();
      });
      const row = el('tr', { class: l.verification_state === 'verified' ? '' : 'to-verify' },
        el('td', null, l.source_text, l.preparation ? el('div', { class: 'muted', style: { fontSize: '.8rem' } }, `${t('préparation')} : ${l.preparation}`) : null, l.optional ? el('div', { class: 'muted', style: { fontSize: '.8rem' } }, t('facultatif')) : null),
        el('td', null, qty), el('td', null, unitCell), el('td', null, ingSel, l.ingredient_id && l.verification_state !== 'verified' ? el('div', { class: 'chip warn' }, t('proposé — à confirmer')) : null),
        el('td', null, el('input', { type: 'checkbox', checked: l.verification_state === 'verified', onChange: (e) => { l.verification_state = e.target.checked ? 'verified' : 'to_verify'; drawLines(); } })));
      tbody.append(row);
    }
    table.append(tbody);
    linesPreview.append(el('div', { style: { overflowX: 'auto' } }, table),
      el('small', { class: 'muted' }, t('Une quantité manquante reste absente : rien n’est inventé. Une identité d’ingrédient proposée n’est retenue qu’après confirmation.')));
  };
  const drawSteps = () => {
    const steps = parseStepsBlock(f.stepsText);
    stepsPreview.replaceChildren();
    if (!steps.length) return;
    const timers = steps.flatMap((s) => (s.timers || []).map((tm) => tm.label));
    const subs = [];
    for (const s of steps) { let m; SUBRECIPE_RE.lastIndex = 0; while ((m = SUBRECIPE_RE.exec(s.text))) subs.push(m[1] || m[2]); }
    stepsPreview.append(el('div', { class: 'chips' },
      el('span', { class: 'chip' }, t('{n} étape(s)', { n: steps.length })),
      timers.length ? el('span', { class: 'chip' }, `${t('durées détectées')} : ${[...new Set(timers)].join(', ')}`) : null,
      ...[...new Set(subs)].map((p) => el('span', { class: 'chip warn' }, t('Sous-recette : renvoie à la page {p}', { p })))));
  };
  ingTa.addEventListener('input', () => { clearTimeout(ingTa._t); ingTa._t = setTimeout(reparse, 400); });
  stepsTa.addEventListener('input', () => { clearTimeout(stepsTa._t); stepsTa._t = setTimeout(drawSteps, 400); });

  const aiBtn = el('button', { class: 'btn', disabled: !provider.configured || (!pages.length), onClick: async () => {
    aiBtn.disabled = true; aiStatus.textContent = t('Lecture des pages par l’assistant…');
    try {
      const images = [];
      for (const p of pages) { const fl = await repo.getFile(p.sha256); images.push({ mime: fl.mime, base64: await blobToBase64(fl.blob) }); }
      const courant = providerFrom(ctx.settings, { session: await sessionAssistant(ctx) }); // relue au clic : un jeton expiré se rafraîchit
      const r = await extractRecipeFromImages(courant, images);
      if (r.title && !f.title) { f.title = r.title; titleInput.value = r.title; }
      if (r.language) f.language = r.language;
      if (r.servings != null) f.servings = r.servings; if (r.prep_minutes != null) f.prep = r.prep_minutes; if (r.cook_minutes != null) f.cook = r.cook_minutes; if (r.printed_page != null && !f.printed_page) f.printed_page = r.printed_page;
      f.ingredientsText = r.ingredients.map((i) => i.source_text).join('\n'); ingTa.value = f.ingredientsText;
      f.stepsText = r.steps.map((s) => s.text).join('\n'); stepsTa.value = f.stepsText;
      f.aiUsed = true; f.aiModel = courant.modele || (courant.name === 'openai_compatible' ? ctx.settings.llm?.model : null) || courant.name; // le modèle choisi par le SERVEUR (passerelle) quand il l'a dit
      parsedLines = []; reparse(); drawSteps();
      const uncertain = r.ingredients.filter((i) => i.uncertain).map((i) => i.source_text).concat(r.uncertain_fields);
      aiStatus.textContent = t('Extraction proposée par l’assistant — toutes les lignes sont à vérifier.') + (uncertain.length ? ` ${t('Incertain')} : ${uncertain.join(' ; ')}` : '');
      for (const k of ['servings', 'prep', 'cook', 'printed_page']) { const inp = numInputs[k]; if (inp) inp.value = f[k]; }
    } catch (e) { aiStatus.textContent = `${t('Échec')} : ${e.message}`; }
    aiBtn.disabled = false;
  } }, t('Extraire avec l’assistant IA'));
  const aiStatus = el('div', { class: 'muted', style: { fontSize: '.9rem' } });
  const numInputs = { servings: num('servings'), prep: num('prep'), cook: num('cook'), active: num('active'), total: num('total'), printed_page: num('printed_page') };

  const right = el('div', { class: 'stack' },
    aiNotice(ctx), el('div', { class: 'row' }, aiBtn, aiStatus),
    field(t('Titre original *'), titleInput),
    el('div', { class: 'two-col' },
      field(t('Langue du texte'), select([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }], f.language, (v) => { f.language = v; })),
      field(t('Type'), select([{ value: '', label: t('— à préciser —') }, ...RECIPE_TYPES.map((v) => ({ value: v, label: label('recipe_type', v) }))], f.type, (v) => { f.type = v; })),
      field(t('Page imprimée'), numInputs.printed_page),
      // R-UX-8 : les puces ne vont JAMAIS dans un label — field() rend un <label>, et un clic sur « Cuisines »
      // activerait alors la première puce. Même habillage (.field), sans l'enveloppe qui vole le clic.
      el('div', { class: 'field' }, el('span', null, t('Cuisines / régions')), (() => {
        const box = el('div', null);
        const dessiner = () => box.replaceChildren(renderPuces(pucesModel({ choisies: f.cuisines, existantes: cuisinesExistantes(ctx) }), {
          basculer: (v) => { f.cuisines = basculerPuce(f.cuisines, v); dessiner(); },
          ajouter: (v) => { const a = ajouterPuce(f.cuisines, v); if (a !== f.cuisines) { f.cuisines = a; dessiner(); } },
        }));
        dessiner();
        return box;
      })()),
      !edition ? field(t('Source (si pas un livre)'), el('input', { type: 'text', value: f.source_label, placeholder: t('Recette de famille, site web…'), onInput: (e) => { f.source_label = e.target.value; } })) : null),
    el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' } },
      field(t('Portions'), numInputs.servings), field(t('Préparation (min)'), numInputs.prep), field(t('Cuisson (min)'), numInputs.cook), field(t('Actif (min)'), numInputs.active), field(t('Total (min)'), numInputs.total)),
    field(t('Ingrédients (une ligne par ingrédient, texte tel qu’imprimé)'), ingTa),
    el('button', { class: 'btn small', onClick: reparse }, t('Analyser les lignes')), linesPreview,
    field(t('Étapes'), stepsTa), stepsPreview,
    kind === 'adaptation' ? field(t('Résumé des changements, raisons et compromis *'), el('textarea', { rows: 3, value: f.changes, onInput: (e) => { f.changes = e.target.value; } })) : null,
    kind === 'adaptation' ? field(t('Statut'), select([{ value: 'proposed', label: t('Proposée') }, { value: 'tested', label: t('Testée par Neegan') }], f.status, (v) => { f.status = v; })) : null,
    field(t('Notes'), el('textarea', { rows: 2, value: f.notes, onInput: (e) => { f.notes = e.target.value; } })),
    el('div', { class: 'row' }, el('button', { class: 'btn primary big', onClick: save }, recipe ? t('Enregistrer une nouvelle version') : t('Enregistrer la recette')),
      recipe ? el('a', { class: 'btn', href: `#/recipes/${recipe.id}` }, t('Annuler')) : null));

  root.append(el('div', { class: 'two-col' }, left, right));
  reparse(); drawSteps();
  return root;

  async function save() {
    if (!f.title.trim()) { toast(t('Le titre original est requis')); return; }
    if (kind === 'adaptation' && !f.changes.trim()) { toast(t('Décris les changements de ta version')); return; }
    if (!f.ingredientsText.trim() && !f.stepsText.trim() && kind !== 'extraction') { toast(t('Rien à enregistrer')); return; }
    reparse();
    const steps = parseStepsBlock(f.stepsText);
    const n = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const targetRecipe = recipe || (attachToPending && pendingRef) || null;
    const recipeId = targetRecipe?.id || repo.newId('rc');
    const hasIng = parsedLines.length > 0, hasSteps = steps.length > 0;
    const availability = hasIng && hasSteps ? 'available' : (hasIng || hasSteps) ? 'partial' : 'reference_only';
    const convention = edition?.unit_convention_id ? getConvention(edition.unit_convention_id) : null;
    // Doublon d'import dans cette édition (même titre et page) pour une nouvelle recette
    if (!targetRecipe && editionId) {
      const dup = ctx.recipes.find((r) => r.edition_id === editionId && r.original_title.trim().toLowerCase() === f.title.trim().toLowerCase() && String(r.printed_page ?? '') === String(f.printed_page ?? ''));
      if (dup && !(await confirmDialog(t('Une recette « {t} » existe déjà dans ce livre à la même page. Créer quand même ?', { t: dup.original_title }), { okLabel: t('Créer un doublon') }))) return;
    }
    const version = {
      id: repo.newId('rv'), recipe_id: recipeId, kind: recipe && kind !== 'adaptation' && versions.length ? 'correction' : kind, parent_version_id: base?.id || null,
      status: kind === 'adaptation' ? f.status : null, servings: n(f.servings), prep_minutes: n(f.prep), cook_minutes: n(f.cook), active_minutes: n(f.active), total_minutes: n(f.total),
      ingredients: parsedLines.map((l) => ({ ...l, unit_candidates: l.unit_candidates || null })), steps, constraints: {}, changes: f.changes.trim(), notes: f.notes.trim(),
      provenance: { source_page_ids: pageIds, source_document_id: doc?.id || null, generated_by: f.aiUsed ? 'ai' : 'manual', model: f.aiModel, edition_id: editionId, convention_snapshot: convention ? { id: convention.id, revision: convention.revision, values: convention.values } : null },
      verification_state: parsedLines.some((l) => l.verification_state !== 'verified') ? 'to_verify' : 'verified',
    };
    const rec = targetRecipe ? { ...targetRecipe } : { id: recipeId, edition_id: editionId, favorite: false, tags: [], source_page_ids: [], ingredient_ids: [] };
    Object.assign(rec, {
      original_title: f.title.trim(), original_language: f.language, type: f.type || null, cuisines: cuisinesDepuis(f),
      printed_page: n(f.printed_page), source_label: f.source_label.trim() || rec.source_label || null,
      source_page_ids: [...new Set([...(rec.source_page_ids || []), ...pageIds])],
    });
    if (kind !== 'adaptation') {
      rec.availability = availability === 'reference_only' && rec.availability ? rec.availability : availability;
      rec.current_version_id = version.id;
      rec.verification_state = version.verification_state;
      rec.ingredient_ids = [...new Set(parsedLines.map((l) => l.ingredient_id).filter(Boolean))];
    }
    const pageUpdates = pages.map((p) => ({ ...p, kind: 'recipe', printed_page: p.printed_page ?? n(f.printed_page) }));
    await repo.saveBatch({ recipes: [rec], recipe_versions: [version], source_pages: pageUpdates });
    sessionStorage.removeItem('cuisineos.pending_recipe');
    if (query.session) { const s = ctx.scan_sessions.find((x) => x.id === query.session); if (s) { s.recipe_ids = [...new Set([...(s.recipe_ids || []), recipeId])]; await repo.save('scan_sessions', s); } }
    toast(kind === 'adaptation' ? t('Ma version enregistrée') : t('Recette enregistrée'));
    navigate(`/recipes/${recipeId}?v=${version.id}`);
  }
}

function f_defaultTranslation(recipe) { return recipe?.original_language === 'en' ? 'fr' : 'en'; }

// Traduction d'une version précise : signalée comme telle, sans devenir une adaptation culinaire (spec §14, §29.1).
function translationEditor({ recipe, base, ctx, f }) {
  if (!base) return el('div', { class: 'card' }, t('Aucune version à traduire.'));
  const existing = ctx.recipe_translations.find((tr) => tr.recipe_version_id === base.id && tr.locale === f.translationLocale);
  const tr = { title: existing?.translated_content?.title || '', ingredients: (existing?.translated_content?.ingredients || []).join('\n'), steps: (existing?.translated_content?.steps || []).join('\n') };
  const root = el('div', null, pageHeader(t('Traduire — {l}', { l: f.translationLocale.toUpperCase() }), { back: { href: `/recipes/${recipe.id}`, label: t('Fiche recette') } }));
  root.append(el('div', { class: 'two-col' },
    section(t('Original'), el('h3', null, recipe.original_title), el('ul', { class: 'list plain' }, ...(base.ingredients || []).map((i) => el('li', null, i.source_text))), el('ol', null, ...(base.steps || []).map((s) => el('li', null, s.text)))),
    el('div', { class: 'stack' },
      field(t('Titre traduit'), el('input', { type: 'text', value: tr.title, onInput: (e) => { tr.title = e.target.value; } })),
      field(t('Ingrédients traduits (même ordre, une ligne par ingrédient)'), el('textarea', { rows: 10, value: tr.ingredients, onInput: (e) => { tr.ingredients = e.target.value; } })),
      field(t('Étapes traduites (même ordre)'), el('textarea', { rows: 10, value: tr.steps, onInput: (e) => { tr.steps = e.target.value; } })),
      el('button', { class: 'btn primary', onClick: async () => {
        const row = { id: existing?.id || repo.newId('tr'), recipe_version_id: base.id, locale: f.translationLocale, translated_content: { title: tr.title.trim(), ingredients: tr.ingredients.split('\n').map((s) => s.trim()).filter(Boolean), steps: tr.steps.split('\n').map((s) => s.trim()).filter(Boolean) }, origin: 'manual', verification_state: 'unverified' };
        await repo.save('recipe_translations', row); toast(t('Traduction enregistrée')); navigate(`/recipes/${recipe.id}?v=${base.id}&lang=${f.translationLocale}`);
      } }, t('Enregistrer la traduction')))));
  return root;
}

export { parseIngredientLine };
