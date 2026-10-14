// Fiche recette (spec §17) : Original / Ma version, réglages combinables, unités et langue de lecture, remplacer un ingrédient,
// « Avec quoi on mange ça ? », autres recettes du plat, historique et « Refaire comme la dernière fois ».
import { el, toast, chooseDialog, promptDialog, confirmDialog, formatDate, downloadBlob } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { displayUrl } from '../sync/mime.js';
import { currentVersion } from '../domain/search.js';
import { scaleVersion } from '../domain/scaling.js';
import { assessVersion } from '../domain/diet.js';
import { toJsonLd, toPaprikaYaml } from '../domain/exporters.js';
import { DIET_TAGS } from '../model/schema.js';
import { pageHeader, section, availabilityBadge, versionBadge, timeText, provenanceText, segmented, select, ingredientLineEl, timerBlock, dietChip, recipeCard } from './components.js';
import { addToMealFlow } from './meals.js';
import { deviceId } from './import.js';
import { createTimerLaunch } from '../domain/timers.js';

export async function renderRecipe(params, query, ctx) {
  const recipe = ctx.recipesById.get(params.id);
  if (!recipe) return el('div', { class: 'card' }, t('Recette introuvable.'));
  await repo.recordActivity(recipe.edition_id, 'open_recipe', { recipe_id: recipe.id });
  const versions = [...(ctx.versionsByRecipe.get(recipe.id) || [])].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const edition = recipe.edition_id ? ctx.editionsById.get(recipe.edition_id) : null;
  const book = edition ? ctx.booksById.get(edition.book_id) : null;
  const pages = (recipe.source_page_ids || []).map((id) => ctx.pagesById.get(id)).filter(Boolean);
  const history = ctx.cook_history.filter((h) => h.recipe_id === recipe.id).sort((a, b) => (b.cooked_at || '').localeCompare(a.cooked_at || ''));
  const links = ctx.dish_recipe_links.filter((l) => l.recipe_id === recipe.id);
  const dishLink = links.find((l) => l.state === 'confirmed');
  const dish = dishLink ? ctx.dishesById.get(dishLink.dish_id) : null;
  const original = currentVersion(recipe, versions.filter((v) => v.kind !== 'adaptation' && v.kind !== 'synthesis')) || null;
  const adaptations = versions.filter((v) => v.kind === 'adaptation' || v.kind === 'synthesis');
  let version = (query.v && ctx.versionsById.get(query.v)) || original || versions[0] || null;
  const state = { servings: query.servings ? Number(query.servings) : version?.servings || null, units: ctx.settings.units, lang: query.lang || ctx.settings.reading_locale, diet: '' };
  const conventionId = ctx.conventionFor(recipe);
  const root = el('div', null);

  const favBtn = el('button', { class: 'btn', title: t('Favori'), onClick: async () => { await repo.save('recipes', { ...recipe, favorite: !recipe.favorite }); refresh(); } }, recipe.favorite ? '★ ' + t('Favori') : '☆ ' + t('Favori'));
  root.append(pageHeader(recipe.display_title || recipe.original_title, {
    subtitle: provenanceText(recipe, book, edition), back: edition ? { href: `/books/${edition.id}`, label: book?.title || t('Livre') } : { href: '/library', label: t('Mes livres') },
    actions: [favBtn],
  }));

  // Conflit de version (spec § 5.5) : les deux appareils ont adapté cette recette en parallèle. AUCUNE version
  // n'est masquée — la liste des versions plus bas reste entière, et l'original n'est jamais réécrit ; seule une
  // ligne le dit, ici, là où la personne regarde la recette. La décision se prend dans Réglages, nulle part ailleurs.
  const conflit = await repo.get('sync_conflicts', 'recipes:' + params.id);
  if (conflit?.kind === 'version') {
    root.append(el('div', { class: 'card warn stack' },
      el('p', null, t('Une autre version a été créée ailleurs — les deux versions sont conservées.')),
      el('a', { class: 'btn', href: '#/settings' }, t('Trancher dans Réglages'))));
  }
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } }, availabilityBadge(recipe), versionBadge(version), recipe.type ? el('span', { class: 'badge' }, label('recipe_type', recipe.type)) : null, ...(recipe.cuisines || []).map((c) => el('span', { class: 'chip outline' }, c))));

  if (!version) { root.append(referenceOnly()); return root; }

  // Sélecteur Original / Ma version
  const versionOptions = [];
  if (original) versionOptions.push({ value: original.id, label: t('Original') });
  for (const a of adaptations) versionOptions.push({ value: a.id, label: `${t('Ma version')} — ${a.status === 'tested' ? t('testée') : t('proposée')} ${formatDate(a.created_at)}` });
  const selectVersion = (id) => navigate(`/recipes/${recipe.id}${buildQuery({ v: id, servings: state.servings || '' })}`, { replace: true });
  const controls = el('div', { class: 'card sage stack' },
    el('div', { class: 'row between' },
      versionOptions.length > 1 ? select(versionOptions, version.id, selectVersion) : el('span', { class: 'badge original' }, t('Original')),
      el('div', { class: 'row' },
        el('a', { class: 'btn small', href: `#/recipes/${recipe.id}/edit?kind=adaptation&v=${version.id}` }, t('Créer ma version')),
        el('a', { class: 'btn small', href: `#/recipes/${recipe.id}/edit?kind=correction&v=${version.id}` }, t('Corriger')))),
    el('div', { class: 'row' },
      el('label', { class: 'field' }, el('span', null, t('Portions')), el('div', { class: 'row' },
        el('button', { class: 'btn small', onClick: () => setServings((state.servings || 1) - 1) }, '−'),
        el('strong', { id: 'servings-val' }, state.servings ?? t('inconnues')),
        el('button', { class: 'btn small', onClick: () => setServings((state.servings || 0) + 1) }, '+'))),
      el('label', { class: 'field' }, el('span', null, t('Unités')), segmented([{ value: 'original', label: t('Original') }, { value: 'metric', label: t('Métrique') }, { value: 'us', label: 'US' }], state.units, (v) => { state.units = v; drawBody(); })),
      el('label', { class: 'field' }, el('span', null, t('Langue de lecture')), segmented([{ value: 'original', label: t('Original') }, { value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }], state.lang, (v) => { state.lang = v; drawBody(); }))),
    el('div', { class: 'chips' },
      ...[t('Rapide'), t('On se gâte'), t('Meal prep')].map((n) => el('span', { class: 'chip neutral', title: t('Adaptation assistée : palier V1, non disponible dans cette version. Utilise « Créer ma version » pour décrire toi-même les changements.') }, `${n} · V1`))),
    el('small', { class: 'muted' }, t('Changer les portions, les unités ou la langue ne crée pas de nouvelle version. Les durées ne sont pas multipliées.')));
  root.append(controls);

  root.append(el('div', { class: 'row', style: { marginBottom: '1rem' } },
    el('button', { class: 'btn primary big', onClick: startCooking }, t('Commencer à cuisiner')),
    el('a', { class: 'btn', href: `#/search${buildQuery({ for: recipe.id, role: 'salade', mode: 'all' })}` }, t('Avec quoi on mange ça ?')),
    el('button', { class: 'btn', onClick: () => addToMealFlow(ctx, { recipe, version, book, edition }, { role: recipe.type === 'salade' || recipe.type === 'soupe' || recipe.type === 'legumes' || recipe.type === 'feculent' ? 'accompagnement' : 'plat_principal' }) }, t('Ajouter à mon repas')),
    el('button', { class: 'btn', onClick: makeList }, t('Liste d’épicerie')),
    dish ? el('a', { class: 'btn', href: `#/dishes/${dish.id}` }, t('Autres recettes de ce plat')) : el('button', { class: 'btn', onClick: attachDish }, t('Rattacher à un plat'))));

  const body = el('div', null);
  root.append(body);
  drawBody();

  // Pages originales
  if (pages.length) root.append(section(t('Original'), el('p', { class: 'muted' }, t('Pages du livre telles que photographiées. Une adaptation n’est jamais présentée comme le texte original.')),
    el('div', { class: 'thumbs' }, ...pages.map((p) => { const img = el('img', { alt: t('Page originale'), loading: 'lazy' }); repo.getFile(p.sha256).then((f) => { const u = displayUrl(f); if (u) img.src = u; }); return el('figure', null, img, el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : '')); }))));
  else if (recipe.printed_page) root.append(el('p', { class: 'muted' }, t('Original : page {p} du livre (pages non photographiées).', { p: recipe.printed_page })));

  // Versions
  root.append(section(t('Versions'), el('ul', { class: 'list' }, ...versions.map((v) => el('li', { class: 'row between' },
    el('div', null, el('div', { class: 'row' }, versionBadge(v), el('span', { class: 'muted' }, `${label('version_kind', v.kind)} · ${formatDate(v.created_at, { withTime: true })}`), v.verification_state === 'to_verify' ? el('span', { class: 'chip warn' }, t('À vérifier')) : null),
      v.changes ? el('div', { style: { fontSize: '.9rem' } }, v.changes) : null,
      v.provenance?.generated_by === 'ai' ? el('div', { class: 'muted', style: { fontSize: '.8rem' } }, t('Extraction IA ({m}) — vérifiée à la main ensuite ?', { m: v.provenance.model || 'IA' })) : null),
    el('div', { class: 'row' }, v.id !== version.id ? el('button', { class: 'btn small', onClick: () => selectVersion(v.id) }, t('Afficher')) : el('span', { class: 'chip ok' }, t('affichée')),
      v.kind === 'adaptation' && v.status !== 'tested' ? el('button', { class: 'btn small', onClick: async () => { await repo.save('recipe_versions', { ...v, status: 'tested' }); refresh(); } }, t('Marquer testée')) : null))))));

  // Historique
  if (history.length) root.append(section(t('Mémoire culinaire'), el('ul', { class: 'list' }, ...history.map((h) => el('li', { class: 'row between top' },
    el('div', null, el('strong', null, formatDate(h.cooked_at)), ` · ${h.servings ? t('{n} portions', { n: h.servings }) : ''}${h.rating ? ` · ${'★'.repeat(h.rating)}` : ''}${h.redo === false ? ` · ${t('à ne pas refaire')}` : h.redo ? ` · ${t('à refaire')}` : ''}${h.actual_minutes ? ` · ${h.actual_minutes} min` : ''}`,
      h.notes ? el('div', { style: { fontSize: '.9rem' } }, h.notes) : null,
      el('div', { class: 'muted', style: { fontSize: '.8rem' } }, t('Observation liée à cette cuisson ; elle ne devient pas une règle universelle.'))),
    el('a', { class: 'btn small', href: `#/recipes/${recipe.id}${buildQuery({ v: h.recipe_version_id, servings: h.servings || '' })}` }, t('Refaire comme la dernière fois')))))));

  // Export
  root.append(el('div', { class: 'row', style: { marginTop: '.5rem' } },
    el('button', { class: 'btn small', onClick: () => downloadBlob(new Blob([JSON.stringify(toJsonLd({ recipe, version, book, edition }), null, 2)], { type: 'application/ld+json' }), `${slug(recipe.original_title)}.jsonld`) }, t('Exporter JSON-LD')),
    el('button', { class: 'btn small', onClick: () => downloadBlob(new Blob([toPaprikaYaml([{ recipe, version, book, edition }])], { type: 'text/yaml;charset=utf-8' }), `${slug(recipe.original_title)}.yml`) }, t('Exporter YAML (Paprika)')),
    el('span', { class: 'muted', style: { fontSize: '.85rem' } }, t('Version et langue affichées ; inconnues omises.'))));
  return root;

  function setServings(n) { if (n < 1) return; state.servings = n; document.getElementById('servings-val').textContent = n; drawBody(); }

  function drawBody() {
    body.replaceChildren();
    const scaled = scaleVersion(version, state.servings);
    const translation = state.lang !== 'original' ? ctx.recipe_translations.find((tr) => tr.recipe_version_id === version.id && tr.locale === state.lang) : null;
    const wantsTranslation = state.lang !== 'original' && state.lang !== (recipe.original_language || 'fr');
    const ctxQty = { system: state.units, locale: state.lang === 'original' ? (recipe.original_language || 'fr') : state.lang, convention_id: conventionId, readingLocale: state.lang, originalLocale: recipe.original_language || 'fr', showSource: true };
    const ingList = el('ul', { class: 'list plain' });
    scaled.ingredients.forEach((ri, i) => {
      const li = ingredientLineEl(ri, ctxQty, ctx.ingredientsById);
      if (translation?.translated_content?.ingredients?.[i]) li.append(el('div', { class: 'muted', style: { fontSize: '.85rem' } }, `${t('Traduction')} : ${translation.translated_content.ingredients[i]}`));
      li.append(el('button', { class: 'btn small', style: { marginLeft: '.4rem' }, onClick: () => replaceIngredient(ri) }, t('Remplacer')));
      ingList.append(li);
    });
    const dietSel = select([{ value: '', label: t('Évaluer une restriction…') }, ...DIET_TAGS.map((d) => ({ value: d, label: label('diet', d) }))], state.diet, (v) => { state.diet = v; drawBody(); });
    const assessment = state.diet ? assessVersion(version, ctx.ingredientsById, state.diet) : null;
    body.append(section(`${t('Ingrédients')}${scaled.ok && scaled.factor !== 1 ? ` — ${t('recalculés pour {n} portions', { n: state.servings })}` : version.servings ? ` — ${t('{n} portions', { n: version.servings })}` : ''}`,
      el('div', { class: 'row between' }, el('span', { class: 'muted' }, timeText(version)), dietSel),
      assessment ? el('div', { style: { margin: '.4rem 0' } }, dietChip(assessment), assessment.unknown.length ? el('div', { class: 'muted', style: { fontSize: '.85rem' } }, `${t('Inconnus')} : ${assessment.unknown.join(', ')}`) : null) : null,
      wantsTranslation && !translation ? el('div', { class: 'status warn' }, t('Aucune traduction {l} pour cette version.', { l: state.lang.toUpperCase() }), el('a', { class: 'btn small', href: `#/recipes/${recipe.id}/edit?kind=translation&v=${version.id}` }, t('Traduire'))) : null,
      translation ? el('div', { class: 'row' }, el('span', { class: 'badge' }, t('Traduction')), el('span', { class: 'muted' }, translation.translated_content.title || '')) : null,
      ingList, ...scaled.notes.map((n) => el('small', { class: 'muted', style: { display: 'block' } }, n)),
      !conventionId && scaled.ingredients.some((i) => ['cup', 'tbsp', 'tsp', 'fl_oz'].includes(i.unit_id)) ? el('div', { class: 'status warn', style: { marginTop: '.5rem' } }, t('Tasses/cuillères : convention non confirmée pour cette édition — quantités d’origine affichées.'), edition ? el('a', { class: 'btn small', href: `#/books/${edition.id}` }, t('Préciser')) : null) : null));
    const steps = el('ol', { class: 'list steps' });
    (version.steps || []).forEach((s, i) => {
      const li = el('li', null, el('span', { class: 'step-num' }, String(i + 1)), el('div', { style: { flex: 1 } },
        el('div', null, s.text),
        translation?.translated_content?.steps?.[i] ? el('div', { class: 'muted', style: { fontSize: '.9rem' } }, translation.translated_content.steps[i]) : null,
        ...(s.timers || []).slice(0, 2).map((tm) => timerBlock(tm.seconds, { compact: true, onRequest: (channel) => repo.save('timer_launches', createTimerLaunch({ recipe_version_id: version.id, step_id: s.id, device_id: deviceId(), duration_seconds: tm.seconds, channel })) }))));
      steps.append(li);
    });
    body.append(section(t('Préparation'), (version.steps || []).length ? steps : el('p', { class: 'muted' }, t('Étapes non numérisées.')), version.notes ? el('p', { class: 'muted' }, version.notes) : null));
  }

  async function startCooking() {
    const session = { id: repo.newId('cs'), recipe_id: recipe.id, meal_id: null, selected_version_ids: [version.id], servings: state.servings, progress: { current_step_id: version.steps?.[0]?.id || null, done_step_ids: [], total_steps: (version.steps || []).length }, started_at: repo.nowIso(), active_device_id: deviceId(), status: 'active', units: state.units, lang: state.lang };
    await repo.save('cook_sessions', session);
    navigate(`/cook/${session.id}`);
  }

  async function makeList() {
    const list = { id: repo.newId('sl'), title: `${recipe.display_title || recipe.original_title}`, items: [{ recipe_id: recipe.id, recipe_version_id: version.id, servings: state.servings, title: recipe.display_title || recipe.original_title }], checked: {} };
    await repo.save('shopping_lists', list);
    navigate(`/lists/${list.id}`);
  }

  async function attachDish() {
    const options = [...ctx.dishes].sort((a, b) => a.labels.fr.label.localeCompare(b.labels.fr.label)).map((d) => ({ value: d.id, label: d.labels.fr.label }));
    options.push({ value: '__new__', label: t('+ Nouveau plat…') });
    let dishId = await chooseDialog(t('Rattacher cette recette à quel plat ?'), options);
    if (!dishId) return;
    if (dishId === '__new__') {
      const fr = await promptDialog(t('Nom du plat (français)'), { value: recipe.original_title });
      if (!fr) return;
      const d = { id: repo.newId('dish'), labels: { fr: { label: fr.trim(), aliases: [] }, en: { label: fr.trim(), aliases: [] } } };
      await repo.save('dishes', d); dishId = d.id;
    }
    const existing = links.find((l) => l.dish_id === dishId);
    await repo.save('dish_recipe_links', { ...(existing || { id: repo.newId('drl'), dish_id: dishId, recipe_id: recipe.id }), state: 'confirmed', proposed_by: 'user', evidence: t('Rattachement manuel'), reviewed_at: repo.nowIso() });
    toast(t('Recette rattachée au plat')); refresh();
  }

  // Remplacer un ingrédient dans son contexte (spec §29.3) : nouvelle version attribuée, original préservé, effets décrits.
  async function replaceIngredient(ri) {
    const options = [...ctx.ingredients].sort((a, b) => a.labels.fr.label.localeCompare(b.labels.fr.label)).map((i) => ({ value: i.id, label: `${i.labels.fr.label}${i.labels.en?.label && i.labels.en.label !== i.labels.fr.label ? ` / ${i.labels.en.label}` : ''}` }));
    options.unshift({ value: '__text__', label: t('Autre (texte libre)…') });
    const choice = await chooseDialog(t('Remplacer « {s} » par :', { s: ri.name_text || ri.source_text }), options);
    if (!choice) return;
    let newId = null, newLabel = '';
    if (choice === '__text__') { newLabel = await promptDialog(t('Ingrédient de remplacement')); if (!newLabel) return; }
    else { newId = choice; newLabel = ctx.ingredientsById.get(choice).labels[recipe.original_language || 'fr']?.label || ctx.ingredientsById.get(choice).labels.fr.label; }
    const effects = await promptDialog(t('Effets attendus (goût, texture, méthode, durée) et raison du remplacement'), { multiline: true, placeholder: t('Je n’en ai pas ; texture un peu plus ferme ; même cuisson.') });
    if (effects === null) return;
    if (!(await confirmDialog(t('Créer « Ma version » avec ce remplacement ? L’original reste inchangé.'), { okLabel: t('Accepter') }))) return;
    const newVersion = {
      ...structuredClone(version), id: repo.newId('rv'), kind: 'adaptation', parent_version_id: version.id, status: 'proposed', created_at: undefined, updated_at: undefined,
      changes: t('Remplacement : {a} → {b}. {e}', { a: ri.name_text || ri.source_text, b: newLabel, e: effects || '' }).trim(),
      provenance: { ...(version.provenance || {}), generated_by: 'manual', derived_from: version.id, substitution: true },
    };
    newVersion.ingredients = version.ingredients.map((x) => x.id === ri.id || x.source_text === ri.source_text ? { ...x, id: repo.newId('ri'), ingredient_id: newId, name_text: newLabel, source_text: `${newLabel} (${t('remplace')} : ${x.source_text})`, verification_state: 'verified', substituted_from: x.source_text } : x);
    const sub = { id: repo.newId('sub'), recipe_version_id: newVersion.id, parent_version_id: version.id, ingredient_id: ri.ingredient_id || null, replacement_ingredient_id: newId, replacement_text: newLabel, role: ri.preparation || null, effects: effects || '', state: 'accepted', created_at: repo.nowIso() };
    await repo.saveBatch({ recipe_versions: [newVersion], substitutions: [sub] });
    toast(t('Ma version créée ; contraintes et courses à réévaluer sur cette version.'));
    navigate(`/recipes/${recipe.id}?v=${newVersion.id}`);
  }

  function referenceOnly() {
    return el('div', null,
      el('div', { class: 'card warn stack' },
        el('h2', null, recipe.printed_page ? t('Repérée dans ton livre — page {p}', { p: recipe.printed_page }) : t('Repérée dans l’index de ton livre')),
        el('p', null, t('Cette référence vient de l’index : ingrédients, durées et compatibilités alimentaires sont inconnus tant que la recette n’est pas numérisée. Ouvre le livre à cette page pour cuisiner, ou scanne la recette.')),
        el('div', { class: 'row' },
          el('a', { class: 'btn primary', href: `#/add?edition=${recipe.edition_id || ''}`, onClick: () => sessionStorage.setItem('cuisineos.pending_recipe', recipe.id) }, t('Scanner cette recette')),
          el('a', { class: 'btn', href: `#/recipes/${recipe.id}/edit?kind=extraction` }, t('Saisir à la main')),
          dish ? el('a', { class: 'btn', href: `#/dishes/${dish.id}` }, t('Autres recettes de ce plat')) : el('button', { class: 'btn', onClick: attachDish }, t('Rattacher à un plat')))),
      pages.length ? section(t('Pages d’index'), el('div', { class: 'thumbs' }, ...pages.map((p) => { const img = el('img', { loading: 'lazy' }); repo.getFile(p.sha256).then((f) => { const u = displayUrl(f); if (u) img.src = u; }); return el('figure', null, img); }))) : null);
  }
}

function slug(s) { return (s || 'recette').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }

export { recipeCard };
