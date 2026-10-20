// Fiche recette (spec §17) : Original / Ma version, réglages combinables, unités et langue de lecture, remplacer un ingrédient,
// « Avec quoi on mange ça ? », autres recettes du plat, historique et « Refaire comme la dernière fois ».
import { el, toast, chooseDialog, promptDialog, confirmDialog, formatDate, downloadBlob } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { displayUrl, safeDisplayType } from '../sync/mime.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { currentVersion } from '../domain/search.js';
import { scaleVersion } from '../domain/scaling.js';
import { assessVersion } from '../domain/diet.js';
import { toJsonLd, toPaprikaYaml } from '../domain/exporters.js';
import { DIET_TAGS } from '../model/schema.js';
import { reperesDe } from '../domain/recherche-web.js';
import { lirePage } from '../domain/lecture-web.js';
import { logError } from '../core/log.js';
import { pageHeader, section, availabilityBadge, versionBadge, timeText, provenanceText, segmented, select, ingredientLineEl, timerBlock, dietChip, recipeCard, banniereLecture, sessionAssistant, carteConnexion, ligneReperes } from './components.js';
import { demarrerLectureWeb, texteEchecLecture, enLigneLecture, ligneWebOuverte } from './import-web.js';
import { demarrerConnexion } from './settings.js';
import { estCreationIA, etiquetteCreationIA, lireCreation, AVERTISSEMENT_CREATION_IA } from '../domain/creation-ia.js';
import { addToMealFlow } from './meals.js';
import { deviceId } from './import.js';
import { createTimerLaunch } from '../domain/timers.js';
import { lienSignet } from '../core/lien.js';
import { capitaliser } from './puces.js';

// S7 : une adresse refusée s'affiche INERTE (jamais un <a>), et BORNÉE — une fiche venue d'une archive ou du
// serveur peut en porter 100 000 caractères, qui pousseraient la fiche entière hors de l'écran.
export const adresseInerte = (u) => { const s = String(u ?? ''); return s.length > 200 ? s.slice(0, 200) + '…' : s; };

// `deps` (lot B, facultatif : le routeur n'en passe pas) : les gestes de la lecture web { repo, navigate, toast, fetch, maintenant, enLigne } — la
// suite n'ouvre ni réseau ni navigation réelle.
export async function renderRecipe(params, query, ctx, deps = {}) {
  const recipe = ctx.recipesById.get(params.id);
  if (!recipe) return el('div', { class: 'card' }, t('Recette introuvable.'));
  // Lot B (§ 4.1, § 4.5) : une fiche à adresse lisible porte « Ouvrir le lien » partout (I-B5) ; la lecture par l'assistant a besoin de la session.
  const lienFiche = recipe.source_url ? lienSignet(recipe.source_url) : null;
  const lisibleParLAssistant = !!lienFiche?.ok && lienFiche.href.startsWith('https:');
  const sessionWeb = lisibleParLAssistant ? await sessionAssistant(ctx) : null;
  const gestesLecture = { repo: deps.repo ?? repo, fetch: deps.fetch, maintenant: deps.maintenant, enLigne: deps.enLigne };
  const naviguer = deps.navigate ?? navigate;
  const dire = deps.toast ?? toast;
  const enLigneWeb = () => (deps.enLigne ?? enLigneLecture)();
  // Ronde 1 : l'état en ligne est RELU à la tape (la fiche n'écoute pas online / offline : le bouton peut être resté allumé) — hors ligne, rien
  // n'est écrit (§ 4.4 : « Journal : rien ») ; une erreur qui n'est pas un refus (base indisponible, quota) est journalisée et dite, jamais un rejet
  // sans gestionnaire depuis un onClick.
  const lireWeb = async () => {
    if (!enLigneWeb()) { dire(t('Tu es hors ligne.')); return; }
    try {
      const r = await demarrerLectureWeb({ recipe: (await gestesLecture.repo.get('recipes', recipe.id)) ?? recipe, ctx }, gestesLecture);
      if (r.issue === 'ok') naviguer(`/recipes/${encodeURIComponent(recipe.id)}/importer`);
      else if (r.issue === 'refuse') dire(texteEchecLecture({ raison: r.raison === 'adresse' ? 'interdit' : r.raison }).texte);
    } catch (e) { logError('recipe.lire_web', { error: e, id: recipe.id }); dire(texteEchecLecture({ raison: 'interne' }).texte); }
  };
  const connecterWeb = () => demarrerConnexion(ctx?.sync?.auth);
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
  // `?v=` n'est suivi que pour une version de CETTE fiche (ronde 1) : une version d'une autre recette (adresse forgée, lien ancien) n'est jamais
  // affichée ici — sa lecture, son bandeau et son import ne sont pas ceux de cette fiche ; retour à la version courante.
  const demandee = query.v ? ctx.versionsById.get(query.v) : null;
  let version = (demandee?.recipe_id === recipe.id ? demandee : null) || original || versions[0] || null;
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
  // Import ciblé (spec § 4.3.6-4.3.7) : ce que l'assistant a lu — l'état de vérification de la VERSION AFFICHÉE, le bandeau de lecture (daté de
  // la lecture, « Incertain : … » lu dans la ligne du journal par import_id, pointeur souple) et la photo du plat. `lecture` est null hors import.
  // Lot B : la ligne d'une lecture WEB porte sa recette sous resultat.recette (resultat = { source_kind, page, recette }) — la bannière lit ses champs incertains là.
  const ligneLue = (ctx.imports || []).find((i) => i?.id === version?.provenance?.import_id) || null;
  const lecture = banniereLecture(version, ligneLue?.kind === 'web' ? { ...ligneLue, resultat: ligneLue.resultat?.recette ?? null } : ligneLue);
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } }, availabilityBadge(recipe), versionBadge(version, recipe), lecture ? etatVerification(version) : null, recipe.type ? el('span', { class: 'badge' }, label('recipe_type', recipe.type)) : null, ...(recipe.cuisines || []).map((c) => el('span', { class: 'chip outline' }, capitaliser(c)))));
  const web = bandeauWeb(version);
  if (web) root.append(web); // lot B (§ 4.5) : la source d'une version lue sur le web, d'abord — puis la bannière du lot A
  if (lecture) root.append(bandeauLecture(lecture));
  const photo = await photoDuPlat(recipe); // ronde 1 : jamais root.append(null) — le DOM natif écrirait le nœud texte « null »
  if (photo) root.append(photo);

  if (!version) {
    root.append(referenceOnly());
    // F-9 : la carte « Connecte-toi » et le bouton de lecture sont rendus cachée / éteint ; la session (déjà lue plus haut) les bascule ici —
    // jamais de flash « Connecte-toi » pour une personne connectée, jamais de carte retirée (le motif d'import.js).
    basculerSessionSignet(root, sessionWeb, enLigneWeb());
    return root;
  }

  // Sélecteur Original / Ma version — C-2 : sur une création IA (ou une fiche origine 'ia'), chaque version porte son étiquette, jamais
  // « Original » ; une version manuelle d'une fiche IA garde son statut.
  const statutDe = (v) => (v.status === 'tested' ? t('testée') : t('proposée'));
  const libelleOption = (v, { adaptation }) => {
    const ia = etiquetteCreationIA(v, recipe);
    if (!ia) return adaptation ? `${t('Ma version')} — ${statutDe(v)} ${formatDate(v.created_at)}` : t('Original');
    const statut = adaptation && !estCreationIA(v) ? ` — ${statutDe(v)}` : '';
    return adaptation ? `${t(ia)}${statut} ${formatDate(v.created_at)}` : t(ia);
  };
  const versionOptions = [];
  if (original) versionOptions.push({ value: original.id, label: libelleOption(original, { adaptation: false }) });
  for (const a of adaptations) versionOptions.push({ value: a.id, label: libelleOption(a, { adaptation: true }) });
  const estUneCreation = estCreationIA(version);
  const selectVersion = (id) => navigate(`/recipes/${recipe.id}${buildQuery({ v: id, servings: state.servings || '' })}`, { replace: true });
  const controls = el('div', { class: 'card sage stack' },
    el('div', { class: 'row between' },
      versionOptions.length > 1 ? select(versionOptions, version.id, selectVersion) : etiquetteCreationIA(version, recipe) ? versionBadge(version, recipe) : el('span', { class: 'badge original' }, t('Original')),
      el('div', { class: 'row' },
        el('a', { class: 'btn small', href: `#/recipes/${recipe.id}/edit?kind=adaptation&v=${version.id}` }, t('Créer ma version')),
        el('a', { class: 'btn small', href: `#/recipes/${recipe.id}/edit?kind=correction&v=${version.id}` }, t('Corriger')),
        // Import ciblé (spec import-cible § 4.1, D-11) : une recette partielle se relit par l'écran déjà rattaché (import à refaire) ; une recette complète n'a pas d'entrée.
        recipe.availability === 'partial' && !recipe.source_url ? el('a', { class: 'btn small', href: `#/recipes/${encodeURIComponent(recipe.id)}/importer` }, t('Relire les pages')) : null,
        // Lot B (D-B18) : une fiche à adresse https qui a déjà une version se relit par l'assistant — absent sans session.
        lisibleParLAssistant && sessionWeb ? el('button', { type: 'button', class: 'btn small', dataset: { role: 'relire-web' }, onClick: lireWeb }, t('Relire la page avec l’assistant')) : null)),
    el('div', { class: 'row' },
      el('label', { class: 'field' }, el('span', null, t('Portions')), el('div', { class: 'row' },
        el('button', { class: 'btn small', onClick: () => setServings((state.servings || 1) - 1) }, '−'),
        el('strong', { id: 'servings-val' }, state.servings ?? t('inconnues')),
        el('button', { class: 'btn small', onClick: () => setServings((state.servings || 0) + 1) }, '+'))),
      el('label', { class: 'field' }, el('span', null, t('Unités')), segmented([{ value: 'original', label: t('Original') }, { value: 'metric', label: t('Métrique') }, { value: 'us', label: 'US' }], state.units, (v) => { state.units = v; drawBody(); })),
      el('label', { class: 'field' }, el('span', null, t('Langue de lecture')), segmented([{ value: 'original', label: t('Original') }, { value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }], state.lang, (v) => { state.lang = v; drawBody(); }))),
    // N-5 : une création IA s'adapte par l'assistant (version enfant, original intact) ; les puces V1 s'effacent devant ce geste réel.
    estUneCreation
      ? el('div', { class: 'row' }, el('a', { class: 'btn small', href: `#/recipes/creer${buildQuery({ adapter: version.id })}`, dataset: { role: 'adapter-ia' } }, t('Adapter avec l’IA')))
      : el('div', { class: 'chips' },
        ...[t('Rapide'), t('On se gâte'), t('Meal prep')].map((n) => el('span', { class: 'chip neutral', title: t('Adaptation assistée : palier V1, non disponible dans cette version. Utilise « Créer ma version » pour décrire toi-même les changements.') }, `${n} · V1`))),
    el('small', { class: 'muted' }, t('Changer les portions, les unités ou la langue ne crée pas de nouvelle version. Les durées ne sont pas multipliées.')));
  root.append(controls);

  root.append(el('div', { class: 'row', style: { marginBottom: '1rem' } },
    el('button', { class: 'btn primary big', onClick: startCooking }, t('Commencer à cuisiner')),
    el('a', { class: 'btn', href: `#/search${buildQuery({ for: recipe.id, role: 'salade', mode: 'all' })}` }, t('Avec quoi on mange ça ?')),
    el('button', { class: 'btn', onClick: () => addToMealFlow(ctx, { recipe, version, book, edition }, { role: recipe.type === 'salade' || recipe.type === 'soupe' || recipe.type === 'legumes' || recipe.type === 'feculent' ? 'accompagnement' : 'plat_principal' }) }, t('Ajouter à mon repas')),
    el('button', { class: 'btn', onClick: makeList }, t('Liste d’épicerie')),
    dish ? el('a', { class: 'btn', href: `#/dishes/${dish.id}` }, t('Autres recettes de ce plat')) : el('button', { class: 'btn', onClick: attachDish }, t('Rattacher à un plat')),
    // I-B5 (lot B) : « Ouvrir le lien » reste sur TOUTE fiche à adresse lisible (l'audit § 1.4 notait sa perte dès qu'une version existe).
    lienFiche?.ok ? el('a', { class: 'btn', href: lienFiche.href, target: '_blank', rel: 'noopener noreferrer', dataset: { role: 'ouvrir-lien' } }, t('Ouvrir le lien')) : null));

  const body = el('div', { class: 'recipe-body' }); // C-7 : overflow-wrap (styles.css)
  root.append(body);
  drawBody();

  // Pages originales
  if (pages.length) root.append(section(t('Original'), el('p', { class: 'muted' }, t('Pages du livre telles que photographiées. Une adaptation n’est jamais présentée comme le texte original.')),
    el('div', { class: 'thumbs' }, ...pages.map((p) => { const img = el('img', { alt: t('Page originale'), loading: 'lazy' }); repo.getFile(p.sha256).then((f) => { const u = displayUrl(f); if (u) img.src = u; }); return el('figure', null, img, el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : '')); }))));
  // C-2 : une fiche origine 'ia' n'a pas de livre — un numéro de page tapé dans « Corriger » (champ « Page imprimée ») ne la fait pas passer pour une page d'original.
  else if (recipe.printed_page && recipe.origine !== 'ia') root.append(el('p', { class: 'muted' }, t('Original : page {p} du livre (pages non photographiées).', { p: recipe.printed_page })));

  // Versions
  root.append(section(t('Versions'), el('ul', { class: 'list' }, ...versions.map((v) => el('li', { class: 'row between' },
    el('div', null, el('div', { class: 'row' }, versionBadge(v, recipe), el('span', { class: 'muted' }, `${label('version_kind', v.kind)} · ${formatDate(v.created_at, { withTime: true })}`), v.verification_state === 'to_verify' ? el('span', { class: 'chip warn' }, t('À vérifier')) : null),
      v.changes ? el('div', { style: { fontSize: '.9rem' } }, v.changes) : null,
      v.provenance?.generated_by === 'ai' && !estCreationIA(v) ? el('div', { class: 'muted', style: { fontSize: '.8rem' } }, t('Extraction IA ({m}) — vérifiée à la main ensuite ?', { m: v.provenance.model || 'IA' })) : null),
    el('div', { class: 'row' }, v.id !== version.id ? el('button', { class: 'btn small', onClick: () => selectVersion(v.id) }, t('Afficher')) : el('span', { class: 'chip ok' }, t('affichée')),
      (v.kind === 'adaptation' || v.kind === 'synthesis') && v.status !== 'tested' ? el('button', { class: 'btn small', onClick: async () => { await repo.save('recipe_versions', { ...v, status: 'tested' }); refresh(); } }, t('Marquer testée')) : null))))));

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
    // § 3.3, C-6, C-9 : sur une création, ce que l'assistant a dit (préfixé « Selon l’assistant »), sa durée ESTIMÉE (jamais dans
    // timeText), et l'avertissement fixe — relus et rebornés par lireCreation (une ligne reçue peut porter n'importe quoi), en texte seul.
    const lc = lireCreation(version);
    if (lc) body.append(el('section', { class: 'card stack', dataset: { role: 'creation-ia' } },
      lc.description ? el('p', { dataset: { role: 'description-ia' } }, t('Selon l’assistant : {texte}', { texte: lc.description })) : null,
      lc.minutes ? el('div', { class: 'muted', dataset: { role: 'minutes-ia' } }, t('environ {m} min (estimé par l’assistant)', { m: lc.minutes })) : null,
      el('div', { class: 'status warn', dataset: { role: 'avertissement-ia' } }, t(AVERTISSEMENT_CREATION_IA))));
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
        el('div', { style: { whiteSpace: 'pre-line' }, dataset: { role: 'texte-etape' } }, s.text), // m10 : une étape lue entière garde ses sauts de ligne
        translation?.translated_content?.steps?.[i] ? el('div', { class: 'muted', style: { fontSize: '.9rem' } }, translation.translated_content.steps[i]) : null,
        ...(s.timers || []).slice(0, 2).map((tm) => timerBlock(tm.seconds, { compact: true, onRequest: (channel) => repo.save('timer_launches', createTimerLaunch({ recipe_version_id: version.id, step_id: s.id, device_id: deviceId(), duration_seconds: tm.seconds, channel })) }))));
      steps.append(li);
    });
    body.append(section(t('Préparation'), (version.steps || []).length ? steps : el('p', { class: 'muted' }, t('Étapes non numérisées.')), version.notes ? el('p', { class: 'muted' }, version.notes) : null));
    if (lc?.conseils.length) body.append(section(t('Conseils'), el('ul', { dataset: { role: 'conseils-ia' } }, ...lc.conseils.map((c) => el('li', null, t('Selon l’assistant : {texte}', { texte: c }))))));
    if (lc?.notes.length) body.append(section(t('À vérifier avant de servir'), el('ul', { dataset: { role: 'notes-ia' } }, ...lc.notes.map((n) => el('li', null, n)))));
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
    // Un signet web n'est pas une référence d'index : il n'y a pas de page de livre à ouvrir, il y a un lien (F8).
    if (recipe.source_url) return el('div', null, blocSignet(recipe, ctx, { lire: lireWeb, connecter: connecterWeb, moi: gestesLecture.repo.deviceId?.() ?? null }));
    return el('div', null,
      el('div', { class: 'card warn stack' },
        el('h2', null, recipe.printed_page ? t('Repérée dans ton livre — page {p}', { p: recipe.printed_page }) : t('Repérée dans l’index de ton livre')),
        el('p', null, t('Cette référence vient de l’index : ingrédients, durées et compatibilités alimentaires sont inconnus tant que la recette n’est pas numérisée. Ouvre le livre à cette page pour cuisiner, ou scanne la recette.')),
        el('div', { class: 'row' },
          // D-8 : la voie « Scanner cette recette » (Ajouter + clé de session) est remplacée par l'écran d'import ciblé, déjà rattaché à la référence.
          el('a', { class: 'btn primary', href: `#/recipes/${encodeURIComponent(recipe.id)}/importer` }, t('Importer cette recette')),
          el('a', { class: 'btn', href: `#/recipes/${recipe.id}/edit?kind=extraction` }, t('Saisir à la main')),
          dish ? el('a', { class: 'btn', href: `#/dishes/${dish.id}` }, t('Autres recettes de ce plat')) : el('button', { class: 'btn', onClick: attachDish }, t('Rattacher à un plat')))),
      pages.length ? section(t('Pages d’index'), el('div', { class: 'thumbs' }, ...pages.map((p) => { const img = el('img', { loading: 'lazy' }); repo.getFile(p.sha256).then((f) => { const u = displayUrl(f); if (u) img.src = u; }); return el('figure', null, img); }))) : null);
  }
}

// Signet web (spec § 11 ; lot B § 4.1 a) : revalidé AU RENDU — une fiche venue d'une archive peut porter n'importe quoi (S6) ; l'hôte affiché
// vient de l'adresse, jamais de source_label (S7). Aucun geste de scan (F8). Selon l'import web OUVERT de la fiche (au plus un, I-2) : « Lire la
// recette avec l’assistant » (aucun, ou a_lancer), « Voir » (en_cours), « Vérifier et enregistrer » (a_verifier), « Réessayer » (echec, avec la
// phrase du cas). Synchrone (F-9) : la carte « Connecte-toi » est rendue CACHÉE et le bouton de lecture ÉTEINT — basculerSessionSignet les règle
// une fois la session lue. Une adresse en http: n'a aucun bouton de lecture (B-20). « Ouvrir le lien » est toujours là. Ronde 1 : `web_reperes` est
// RELU au rendu par reperesDe (ficheDe : présentation bornée au mot à 400, écartée si elle porte une adresse, Cc/Cf retirés ; repères typés) — une
// fiche reçue ou restaurée peut porter n'importe quoi ; la ligne ouverte est choisie par ligneWebOuverte (import-web.js : la même règle que l'écran,
// R-B-18 et R-B-20 ; `moi` = l'appareil d'ici).
export function blocSignet(recipe, ctx = null, { lire = null, connecter = () => {}, moi = null } = {}) {
  const lien = lienSignet(recipe.source_url);
  const bloc = el('div', { class: 'card warn stack', dataset: { role: 'bloc-signet' } }, el('h2', null, t('Lien web gardé.')));
  if (!lien.ok) { bloc.append(el('p', { class: 'muted' }, t('Adresse non reconnue : '), adresseInerte(recipe.source_url))); return bloc; }
  const id = encodeURIComponent(recipe.id);
  const ouvrir = (classe) => el('a', { class: classe, href: lien.href, target: '_blank', rel: 'noopener noreferrer' }, t('Ouvrir le lien'));
  const hote = el('span', { class: 'muted' }, lien.hote);
  const reperes = reperesDe(recipe.web_reperes);
  const presentation = reperes?.presentation ?? null;
  const ligneR = reperes ? ligneReperes(reperes) : '';
  const extraits = [presentation ? el('p', { dataset: { role: 'presentation-web' } }, t('Lors de la recherche, l’assistant disait : {p}', { p: presentation })) : null,
    ligneR ? el('p', { class: 'muted', dataset: { role: 'reperes-web' } }, t('Estimé par l’assistant : {r}', { r: ligneR })) : null].filter(Boolean);
  if (!lien.href.startsWith('https:')) {
    bloc.append(el('p', null, t('L’app n’a pas encore lu la page.')), el('div', { class: 'row' }, ouvrir('btn primary'), hote),
      el('div', { class: 'status warn', dataset: { role: 'interdit' } }, texteEchecLecture({ raison: 'interdit' }).texte), ...extraits);
    return bloc;
  }
  // R-B-18 : « ouvert » = importOuvert (une définition, jamais la négation des statuts terminés : une ligne reçue au statut inconnu ou nul ne compte
  // pas) — par ouverteWeb d'import-web.js, seule copie de la substitution de sorte (la tâche 6 n'a qu'elle à changer).
  const ligne = ligneWebOuverte(ctx?.imports, recipe.id, { moi });
  const statut = ligne?.status ?? null;
  const carte = carteConnexion(connecter, ctx); carte.hidden = true; carte.dataset.bascule = 'carte';
  const boutonLire = (libelle, classe) => el('button', { type: 'button', class: classe, disabled: true, dataset: { role: 'lire-web', bascule: 'bouton' }, onClick: () => lire?.() }, libelle);
  if (statut === 'en_cours') bloc.append(el('p', null, t('Lecture de la page en cours…')), el('div', { class: 'row' }, el('a', { class: 'btn', href: `#/recipes/${id}/importer` }, t('Voir')), ouvrir('btn'), hote));
  else if (statut === 'a_verifier') bloc.append(el('p', null, t('Lecture reçue : vérifie-la et enregistre.')), el('div', { class: 'row' }, el('a', { class: 'btn primary', href: `#/recipes/${id}/importer` }, t('Vérifier et enregistrer')), ouvrir('btn'), hote));
  else if (statut === 'echec') bloc.append(el('p', null, t('Contenu non récupéré : ouvre la page.')), el('div', { class: 'row' }, ouvrir('btn primary'), boutonLire(t('Réessayer'), 'btn'), hote),
    el('small', { class: 'muted', dataset: { role: 'raison' } }, texteEchecLecture(ligne.erreur).texte), carte, el('div', { dataset: { bascule: 'hors-ligne' } }));
  else bloc.append(el('p', null, t('L’app n’a pas encore lu la page.')), el('div', { class: 'row' }, boutonLire(t('Lire la recette avec l’assistant'), 'btn primary'), ouvrir('btn'), hote),
    el('small', { class: 'muted' }, t('Une lecture = un appel à l’assistant, compté dans ton quota du jour.')), carte, el('div', { dataset: { bascule: 'hors-ligne' } }));
  bloc.append(...extraits);
  return bloc;
}
// La bascule de F-9 : session → bouton allumé (si en ligne), carte cachée ; sans session → carte montrée, bouton éteint ; hors ligne → bouton
// éteint et « Tu es hors ligne. ».
export function basculerSessionSignet(racine, session, enLigne = true) {
  const bouton = racine.querySelector('[data-bascule="bouton"]');
  const carte = racine.querySelector('[data-bascule="carte"]');
  const zone = racine.querySelector('[data-bascule="hors-ligne"]');
  if (bouton) bouton.disabled = !session || !enLigne;
  if (carte) carte.hidden = !!session;
  if (zone) zone.replaceChildren(...(enLigne ? [] : [el('div', { class: 'status warn' }, t('Tu es hors ligne.'))]));
}

// La source d'une version lue sur le web (lot B § 4.5, I-B5, S-2, B-25) : lue dans la PROVENANCE de CETTE version, jamais dans les champs
// source_* de la fiche ; l'hôte recalculé d'abord, le site et l'auteur déclarés ensuite, étiquetés « Selon la page ». null hors lecture web.
// Ronde 1 (I-B2, S-2) : la provenance d'une version reçue ou restaurée est RELUE au rendu par la règle de la page (lirePage : hôte recalculé, site et
// auteur bornés à 200, Cc/Cf retirés, mis à null s'ils portent une adresse ; une date qui n'est pas la forme ISO du serveur → null) ; sans date
// lisible, la phrase la tait (« Lue sur {h} · {m} — vérifie. », jamais un « le » orphelin).
function bandeauWeb(version) {
  const p = version?.provenance;
  if (!p || typeof p.source_url !== 'string' || !p.source_url) return null;
  const { page } = lirePage({ page: { url_finale: p.url_finale ?? p.source_url, site: p.site, auteur: p.auteur, lue_le: p.lue_le } });
  if (!page.hote) return null;
  const mode = p.source_kind === 'jsonld' ? t('données de la page') : t('texte lu par l’assistant');
  const declares = [page.site, page.auteur].filter(Boolean).join(' · ');
  return el('div', { class: 'stack', style: { marginBottom: '.8rem' }, dataset: { role: 'bandeau-web' } },
    el('div', { class: 'status' }, page.lue_le ? t('Lue sur {h} le {d} · {m} — vérifie.', { h: page.hote, d: formatDate(page.lue_le), m: mode }) : t('Lue sur {h} · {m} — vérifie.', { h: page.hote, m: mode })),
    declares ? el('div', { class: 'muted', dataset: { role: 'selon-la-page' } }, t('Selon la page : {s}', { s: declares })) : null);
}

// État de vérification de la VERSION AFFICHÉE (spec § 4.3.6 ; I3 de la revue : jamais celui de la fiche) : « Vérifiée », ou le nombre de lignes à vérifier.
function etatVerification(version) {
  if (version?.verification_state === 'verified') return el('span', { class: 'chip ok', dataset: { role: 'etat-verification' } }, t('Vérifiée'));
  const n = (version?.ingredients || []).filter((l) => l?.verification_state !== 'verified').length;
  return el('span', { class: 'chip warn', dataset: { role: 'etat-verification' } }, n === 0 ? t('À vérifier') : n === 1 ? t('1 ligne à vérifier') : t('{n} lignes à vérifier', { n }));
}

// Bandeau « Lue par l'assistant le {d} · … » : les parties présentes seulement, jointes par « · » ; « Incertain : … » (texte du modèle, borné par
// banniereLecture) dessous, en nœud texte. `.status` est en inline-flex : posé en colonne pour ses deux lignes.
function bandeauLecture(lecture) {
  // Une date illisible (ligne reçue ou restaurée mal formée) n'est pas dite : jamais « le » suivi de rien (ronde 1).
  const parts = [lecture.date ? t('Lue par l’assistant le {d}', { d: formatDate(lecture.date) }) : t('Lue par l’assistant')];
  if (lecture.incertaines > 0) parts.push(t('{n} ligne(s) incertaine(s)', { n: lecture.incertaines }));
  if (lecture.missing_page) parts.push(t('page possiblement manquante'));
  if (lecture.incomplete) parts.push(t('lecture incomplète'));
  return el('div', { class: 'status warn', dataset: { role: 'bandeau-lecture' }, style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '.2rem', marginBottom: '.8rem' } },
    el('div', { dataset: { role: 'ligne-lecture' } }, parts.join(' · ')),
    lecture.incertain ? el('div', { dataset: { role: 'incertain-lecture' }, style: { fontSize: '.9rem' } }, t('Incertain : {t}', { t: lecture.incertain })) : null);
}

// Photo du plat (spec D-4, § 4.3.6) : rendue seulement quand files a les octets — un pointeur sans octets (ligne reçue avant L4) ne rend rien, pas
// même un cadre ; un type d'image seulement, retypé par la liste blanche (S3, displayUrl : une seule copie de la règle), URL blob: suivie (urlDeBlob,
// révoquée au changement de route). Rend null sinon : l'appelant n'ajoute rien (Element.append(null) écrirait « null »).
async function photoDuPlat(recipe) {
  if (typeof recipe?.photo_sha256 !== 'string' || !recipe.photo_sha256) return null;
  let fichier = null;
  try { fichier = await repo.getFile(recipe.photo_sha256); } catch { fichier = null; }
  if (!safeDisplayType(fichier?.mime)?.startsWith('image/')) return null;
  const src = displayUrl(fichier, urlDeBlob);
  if (!src) return null;
  return el('figure', { class: 'photo-plat', dataset: { role: 'photo-plat' }, style: { margin: '0 0 .8rem' } },
    el('img', { alt: t('Photo du plat'), src, loading: 'lazy', style: { display: 'block', width: '320px', maxWidth: '100%', borderRadius: 'var(--radius)' } }));
}

function slug(s) { return (s || 'recette').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }

export { recipeCard };
