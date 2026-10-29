import { recetteActive } from '../domain/cycle-recette.js';
import { mentionCycleRecette } from './corbeille.js';
// Éditeur de version : extraction (saisie ou IA), correction ciblée, adaptation personnelle, traduction (spec §3.3, §6, §16).
// L'original n'est jamais réécrit : chaque enregistrement crée une nouvelle RecipeVersion liée à son parent.
import { estThermomix } from '../domain/thermomix.js';
import { el, toast, promptDialog, confirmDialog } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate } from '../core/router.js';
import { TransitionRefusee } from '../core/db.js';
import * as repo from '../model/repo.js';
import { displayUrl } from '../sync/mime.js';
import { parseIngredientBlock, parseIngredientLine, parseStepsBlock } from '../domain/lines.js';
import { currentVersion } from '../domain/search.js';
import { getConvention } from '../domain/units.js';
import { providerFrom, extractRecipeFromImages, pagePourEnvoi, BORNES_EXTRACTION } from '../domain/llm.js';
import { RECIPE_TYPES } from '../model/schema.js';
import { assertVocabulaire, originePhotoAdmise } from '../domain/vocabulaire.js';
import { statutSeanceApres } from '../domain/import-cible.js';
import { logError } from '../core/log.js';
import { pageHeader, field, select, carteConnexion, texteEchecAssistant, section, pdfFrame, sessionAssistant, isoLisible } from './components.js';
import { demarrerConnexion } from './settings.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';
import { lireDansLeJournal, relireDuJournal, phraseEchec, cleLecture, tenirVol, libererVol } from './import-cible.js';
import { blocApparierLecture } from './regroupement.js';
import { lireTraduction, verifierSourceTraduction, validerContenuTraduction, projectionSourceTraduction } from '../domain/traductions.js';
import { capturerRecette } from './recette-garde.js';

const SUBRECIPE_RE = /(?:voir|see|cf\.?)\s+(?:la\s+)?(?:page|p\.)\s*(\d{1,4})|\bp\.\s*(\d{1,4})\b/gi;

// § 7 : même geste que le livre pour les cuisines (puces.js). Pure : un tableau est repris tel quel, une ancienne
// chaîne CSV (avant ce lot) est découpée — pour que save() n'ait qu'un seul chemin de lecture.
export const cuisinesDepuis = (f) => Array.isArray(f?.cuisines) ? [...f.cuisines] : String(f?.cuisines || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export async function renderRecipeEdit(params, query, ctx) {
  const recipe = params.id ? ctx.recipesById.get(params.id) : null;
  if (params.id && !recipe) return el('div', { class: 'card' }, t('Recette introuvable.'));
  if (recipe && !recetteActive(recipe)) return mentionCycleRecette(recipe);
  const recipeIdOuvert = recipe?.id || repo.newId('rc');
  const gardeRecette = await capturerRecette(repo, recipe || { id: recipeIdOuvert }, { ctx, creation: !recipe });
  const versions = recipe ? (ctx.versionsByRecipe.get(recipe.id) || []) : [];
  const kind = query.kind || (recipe && versions.length ? 'correction' : 'extraction');
  // `?v=` n'est suivi que pour une version de CETTE fiche (ronde 1) : jamais la base, ni l'héritage de lecture, d'une autre recette — retour à la courante.
  const demandee = recipe && query.v ? ctx.versionsById.get(query.v) : null;
  const base = recipe ? ((demandee?.recipe_id === recipe.id ? demandee : null) || currentVersion(recipe, versions)) : null;
  const translationLocale = ['fr', 'en'].includes(query.locale) ? query.locale : f_defaultTranslation(recipe);
  // La traduction vérifie ses bornes et sa structure AVANT les jointures des champs de l'éditeur culinaire.
  if (kind === 'translation') return translationEditor({ recipe, base, ctx, gardeRecette, f: { translationLocale } });
  // Import ciblé (spec § 4.3.7, N5) : une étape de la version de départ qui porte un saut de ligne a été lue ENTIÈRE par l'assistant ; l'éditeur
  // passe alors en « une étape par paragraphe » (zone jointe par une ligne vide, aide adaptée, aperçu et save() par parseStepsBlock parParagraphe) ;
  // sinon rien ne change (une étape par ligne ou par paragraphe, aide actuelle : une étape ajoutée sur une nouvelle ligne reste une étape).
  // Vague finale (Important) : le mode dépend aussi de la LECTURE posée ensuite (?import=, « Extraire avec l'assistant IA ») — remplir() le bascule dès
  // qu'une étape lue porte un saut de ligne (§ 3.4 : une étape gardée entière dans un seul text), pour que l'éditeur et l'écran ciblé (I5) enregistrent
  // le même nombre d'étapes.
  const porteUnSaut = (liste) => (liste || []).some((s) => typeof s?.text === 'string' && s.text.includes('\n'));
  let parParagraphe = porteUnSaut(base?.steps);
  const aideDe = () => (parParagraphe ? t('Une étape par paragraphe (ligne vide entre deux étapes).') : t('Une étape par ligne ou par paragraphe.'));
  const aideEtapes = aideDe();
  // En « par paragraphe », une ligne vide INTERNE d'une étape (sous-titre puis texte) est repliée en un saut de ligne : sinon parseStepsBlock la
  // couperait en deux au save() (ronde 1). Sert aussi au remplissage par l'assistant, pour que ses étapes restent séparées par une ligne vide.
  const joindreEtapes = (liste) => (parParagraphe
    ? liste.map((s) => (typeof s?.text === 'string' ? s.text.replace(/\n\s*\n/g, '\n') : '')).join('\n\n')
    : liste.map((s) => s?.text).join('\n'));
  // Import ciblé, tâche 6 (spec § 4.5, § 4.6) : #/recipes/new?import=<imp> reprend une lecture « Regrouper en recette » du journal — ses pages, son
  // livre, sa séance, et son résultat REVALIDÉ (I-1 : hostile → echec(illisible), rien de prérempli) pour remplir le formulaire, SANS appel. Une
  // recette existante (correction) ne lit ni n'écrit le journal.
  const reprise = !recipe && query.import ? await relireDuJournal(query.import, 'recette') : null;
  const ligneImport = reprise?.ligne ?? null;
  let importCourant = ligneImport?.id ?? null; // la ligne du journal de cet éditeur : reprise, ou ouverte au premier « Extraire avec l'assistant IA »
  // LA lecture du journal posée dans le formulaire (ronde 1) : sa clé (cleLecture — « Enregistrer » ne clôt qu'elle, T4-R2) et ce qu'elle a dit
  // d'incomplet (I-1 : montré à l'écran, porté par la version, jamais comblé).
  let lecturePosee = null; // { cle, resultat } | null
  let seanceRefusee = false; // lot D, ronde 1 : la séance refusée dans la transaction (disparue, statut hors open/done) — le geste suivant écrit sans elle
  const editionId = query.edition || recipe?.edition_id || ligneImport?.edition_id || null;
  const edition = editionId ? ctx.editionsById.get(editionId) : null;
  const book = edition ? ctx.booksById.get(edition.book_id) : null;
  const pageIds = query.pages ? query.pages.split(',').filter(Boolean) : recipe ? (recipe.source_page_ids || []) : (Array.isArray(ligneImport?.page_ids) ? ligneImport.page_ids : []);
  const sessionId = query.session || ligneImport?.scan_session_id || null;
  const pages = pageIds.map((id) => ctx.pagesById.get(id)).filter(Boolean);
  const doc = query.doc ? ctx.source_documents.find((d) => d.id === query.doc) : null;
  const provider = providerFrom(ctx.settings, { session: await sessionAssistant(ctx) }); // la passerelle (R-T3-1) : la session décide
  // D-8 (lot import ciblé) : plus de « référence en attente » posée par la fiche du livre — une référence s'importe par #/recipes/<id>/importer.

  const f = {
    title: recipe?.original_title || '', language: recipe?.original_language || edition?.language || 'fr', type: recipe?.type || '', cuisines: [...(recipe?.cuisines || [])],
    printed_page: recipe?.printed_page ?? pages.find((p) => p.printed_page)?.printed_page ?? '', source_label: recipe?.source_label || '',
    servings: base?.servings ?? '', prep: base?.prep_minutes ?? '', cook: base?.cook_minutes ?? '', active: base?.active_minutes ?? '', total: base?.total_minutes ?? '',
    ingredientsText: (base?.ingredients || []).map((i) => i.source_text).join('\n'), stepsText: joindreEtapes(base?.steps || []),
    notes: base?.notes || '', changes: '', status: 'proposed', aiUsed: false, aiModel: null,
  };
  if (kind === 'adaptation') { f.changes = ''; }
  let parsedLines = (base?.ingredients || []).map((i) => ({ ...i, id: repo.newId('ri') }));

  const root = el('div', null);
  root.append(pageHeader(recipe ? (kind === 'adaptation' ? t('Créer ma version') : t('Corriger la recette')) : t('Nouvelle recette'), {
    subtitle: [book ? book.title : t('Sans livre'), base ? `${t('à partir de')} : ${label('version_kind', base.kind)} ${base.created_at ? new Date(base.created_at).toLocaleDateString() : ''}` : null].filter(Boolean).join(' · '),
    back: recipe ? { href: `/recipes/${recipe.id}`, label: t('Fiche recette') } : { href: '/add', label: t('Ajouter') },
  }));
  const erreurEnregistrement = el('div', { class: 'status warn', role: 'status', hidden: true, dataset: { role: 'erreur-enregistrement' } });
  root.append(erreurEnregistrement);
  let enregistrementEnCours = false;
  const sourceOuverte = projectionSourceTraduction(base);

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
  const stepsTa = el('textarea', { rows: 10, value: f.stepsText, placeholder: aideEtapes, onInput: (e) => { f.stepsText = e.target.value; } });
  const notesTa = el('textarea', { rows: 2, value: f.notes, onInput: (e) => { f.notes = e.target.value; } }); // lot D : gardée pour y poser les notes lues
  const champEtapes = field(t('Étapes'), stepsTa, parParagraphe ? aideEtapes : null);
  const linesPreview = el('div', null);
  const stepsPreview = el('div', null);
  const num = (k) => el('input', { type: 'number', min: 0, value: f[k], onInput: (e) => { f[k] = e.target.value; } });

  const reparse = () => {
    const fresh = parseIngredientBlock(f.ingredientsText);
    const prior = new Map(parsedLines.map((l) => [l.source_text, l]));
    parsedLines = fresh.map((l) => {
      const p = prior.get(l.source_text);
      // Import ciblé (spec § 4.3.7, I4) : `uncertain` suit la ligne dont le texte n'a pas changé (retypé en booléen : une forme reçue hostile ne se
      // recopie pas, ronde 1) ; une ligne retapée repart sans incertitude.
      return p ? { ...l, ingredient_id: p.ingredient_id, unit_id: p.unit_id ?? l.unit_id, unit_candidates: p.unit_id ? null : l.unit_candidates, verification_state: p.verification_state, id: p.id, ...(Object.hasOwn(p, 'uncertain') ? { uncertain: p.uncertain === true } : {}) } : l;
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
    const steps = parseStepsBlock(f.stepsText, { parParagraphe });
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

  // Une lecture VALIDÉE (par validateParsedRecipe, à la réponse ou à la relecture du journal) posée dans le formulaire : rien n'est écrit ici, la
  // personne relit puis enregistre. `modele` : celui que le SERVEUR a choisi (passerelle), borné.
  const remplir = (r, modele, importId = null) => {
    if (r.title && !f.title) { f.title = r.title; titleInput.value = r.title; }
    if (r.servings != null) f.servings = r.servings; if (r.prep_minutes != null) f.prep = r.prep_minutes; if (r.cook_minutes != null) f.cook = r.cook_minutes; if (r.printed_page != null && !f.printed_page) f.printed_page = r.printed_page;
    if (!parParagraphe && porteUnSaut(r.steps)) { // bascule (vague finale) : zone jointe par une ligne vide, aide et placeholder alignés, aperçu et save() par paragraphe
      parParagraphe = true; stepsTa.placeholder = aideDe();
      if (!champEtapes.querySelector('small')) champEtapes.append(el('small', null, aideDe()));
    }
    // Lot D (§ 4.8.2 point 2) : une lecture du JOURNAL (importId) a ses lignes PLIÉES — texteBorne garde un saut de ligne que parseIngredientBlock
    // couperait en deux lignes ; `uncertain` est reposé après le reparse sur les lignes dont le texte plié est celui d'une ligne incertaine du modèle.
    const plier = (s) => (importId && typeof s === 'string' ? s.replace(/\s*\n\s*/g, ' ') : s);
    f.ingredientsText = r.ingredients.map((i) => plier(i.source_text)).join('\n'); ingTa.value = f.ingredientsText;
    f.stepsText = joindreEtapes(r.steps); stepsTa.value = f.stepsText;
    f.aiUsed = true; f.aiModel = modele ?? null;
    parsedLines = []; reparse();
    if (importId) {
      const incertaines = new Set(r.ingredients.filter((i) => i.uncertain === true).map((i) => plier(i.source_text)));
      parsedLines = parsedLines.map((l) => ({ ...l, uncertain: incertaines.has(l.source_text) })); // reparse() la garde ensuite sur une ligne inchangée (I4)
      drawLines();
      if (!f.notes) { f.notes = r.notes ?? ''; notesTa.value = f.notes; } // une lecture sans notes rend null : jamais posé tel quel (f.notes.trim())
    }
    drawSteps();
    const uncertain = r.ingredients.filter((i) => i.uncertain).map((i) => i.source_text).concat(r.uncertain_fields);
    const manques = [r.missing_page === true ? t('page possiblement manquante') : null, r.incomplete === true ? t('lecture incomplète') : null].filter(Boolean); // I-1 : montrés, jamais comblés
    aiStatus.textContent = t('Extraction proposée par l’assistant — toutes les lignes sont à vérifier.') + (manques.length ? ` ${manques.join(' · ')}.` : '') + (uncertain.length ? ` ${t('Incertain')} : ${uncertain.join(' ; ')}` : '');
    for (const k of ['servings', 'prep', 'cook', 'printed_page']) { const inp = numInputs[k]; if (inp) inp.value = f[k]; }
  };
  const aiBtn = el('button', { class: 'btn', disabled: !provider.configured || (!pages.length), onClick: async () => {
    if (aiBtn.disabled) return;
    aiBtn.disabled = true; aiStatus.textContent = t('Lecture des pages par l’assistant…'); // verrou AVANT tout await : un double clic ne fait qu'un POST
    let configure = provider.configured; // F-8 : le bouton ne se rallume que si le fournisseur est (encore) configuré
    try {
      if (!recipe) {
        // Tâche 6 (spec § 4.6) : une recette SANS référence (« Regrouper en recette ») lit DANS LE JOURNAL (kind recette, recipe_id null) — le vol de
        // l'écran ciblé (signal, battement, appels, « Annuler » depuis la section « Imports ») ; la lecture est écrite (a_verifier) AVANT le formulaire.
        const r = await lireDansLeJournal({ kind: 'recette', importId: importCourant, pageIds: pages.map((p) => p.id), editionId, sessionId, ctx });
        importCourant = r.importId;
        if (!r.connecte) configure = false;
        if (r.resultat) { remplir(r.resultat, r.modele, r.importId); lecturePosee = { cle: r.cle, resultat: r.resultat }; proposer().catch((e) => logError('recipe_edit.apparier', { error: e })); } else aiStatus.textContent = r.texte;
      } else {
        // Une relecture depuis « Corriger » (recette existante) reste hors journal : sa cible est la fiche ouverte, pas une ligne « à regrouper ».
        // I-7 dans les deux sens (vague finale) : elle TIENT le vol du document le temps de son appel (tenirVol, sans ligne) — refusée si un vol est
        // tenu (ronde 1), et tant qu'elle court, aucun vol du journal ne part de ce document (lancerExtraction rend vol_tenu).
        const jeton = tenirVol();
        if (!jeton) aiStatus.textContent = t('Une lecture est déjà en cours : annule-la d’abord.');
        else {
          try {
            const images = [];
            for (const p of pages) { const fl = await repo.getFile(p.sha256); images.push(await pagePourEnvoi(fl.blob)); } // F-3 : la copie envoyée est réduite
            const courant = providerFrom(ctx.settings, { session: await sessionAssistant(ctx) }); // relue au clic : un jeton expiré se rafraîchit
            configure = courant.configured;
            await repo.saveBatch({}, { recettes: [gardeRecette] });
            remplir(await extractRecipeFromImages(courant, images), courant.modele || courant.name);
          } finally { libererVol(jeton); }
        }
      }
    } catch (e) { aiStatus.textContent = texteEchecAssistant(e); }
    aiBtn.disabled = !configure; // une session disparue au clic : le bouton reste éteint, la phrase « Connecte-toi » est à l'écran
  } }, t('Extraire avec l’assistant IA'));
  const aiStatus = el('div', { class: 'muted', style: { fontSize: '.9rem' } });
  const numInputs = { servings: num('servings'), prep: num('prep'), cook: num('cook'), active: num('active'), total: num('total'), printed_page: num('printed_page') };

  const right = el('div', { class: 'stack' },
    provider.configured ? null : carteConnexion(() => demarrerConnexion(ctx.sync?.auth), ctx), el('div', { class: 'row' }, aiBtn, aiStatus),
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
    champEtapes, stepsPreview, // l'aide « par paragraphe » reste visible : une zone préremplie cache son placeholder
    kind === 'adaptation' ? field(t('Résumé des changements, raisons et compromis *'), el('textarea', { rows: 3, value: f.changes, onInput: (e) => { f.changes = e.target.value; } })) : null,
    kind === 'adaptation' ? field(t('Statut'), select([{ value: 'proposed', label: t('Proposée') }, { value: 'tested', label: t('Testée par Neegan') }], f.status, (v) => { f.status = v; })) : null,
    field(t('Notes'), notesTa),
    el('div', { class: 'row' }, el('button', { class: 'btn primary big', onClick: save }, recipe ? t('Enregistrer une nouvelle version') : t('Enregistrer la recette')),
      recipe ? el('a', { class: 'btn', href: `#/recipes/${recipe.id}` }, t('Annuler')) : null));

  // Lot D (§ 4.8.2 point 6, D-D19) : une lecture du journal a_verifier SANS référence, dans une édition connue → la proposition de référence au-dessus du
  // formulaire (rien sans candidate) ; la ligne est relue à chaque lecture posée. Ne rien choisir EST la nouvelle recette ; l'éditeur ne porte aucun texte neuf.
  const apparierHote = el('div', null);
  const proposer = async () => {
    const ligne = !recipe && importCourant && lecturePosee?.cle ? await repo.get('imports', importCourant) : null;
    const tenue = !!ligne && ligne.status === 'a_verifier' && ligne.kind === 'recette' && ligne.recipe_id == null && typeof ligne.edition_id === 'string' && cleLecture(ligne) === lecturePosee.cle;
    const bloc = tenue ? blocApparierLecture({ ligne, resultat: lecturePosee.resultat, ctx, repo, navigate, toast }) : null;
    apparierHote.replaceChildren(...(bloc ? [bloc] : []));
  };
  root.append(apparierHote, el('div', { class: 'two-col' }, left, right));
  reparse(); drawSteps();
  if (reprise?.resultat) { remplir(reprise.resultat, reprise.modele, reprise.ligne.id); lecturePosee = { cle: cleLecture(reprise.ligne), resultat: reprise.resultat }; proposer().catch((e) => logError('recipe_edit.apparier', { error: e })); } // ?import= : la lecture reçue, revalidée, sans appel
  else if (ligneImport?.status === 'echec') aiStatus.textContent = phraseEchec(ligneImport.erreur);
  return root;

  async function save() {
    if (enregistrementEnCours) return;
    enregistrementEnCours = true;
    erreurEnregistrement.hidden = true; erreurEnregistrement.textContent = '';
    try { await enregistrer(); }
    catch (error) {
      erreurEnregistrement.textContent = error instanceof TransitionRefusee
        ? error.store === 'recipes' ? t('Cette recette n’est plus disponible. Tes modifications restent dans ce formulaire.')
          : t('La version source a changé ou n’est plus disponible. Tes modifications restent dans ce formulaire.')
        : t('L’enregistrement a échoué. Tes modifications restent dans ce formulaire.');
      erreurEnregistrement.hidden = false;
    } finally { enregistrementEnCours = false; }
  }

  async function enregistrer() {
    if (!f.title.trim()) { toast(t('Le titre original est requis')); return; }
    if (kind === 'adaptation' && !f.changes.trim()) { toast(t('Décris les changements de ta version')); return; }
    if (!f.ingredientsText.trim() && !f.stepsText.trim() && kind !== 'extraction') { toast(t('Rien à enregistrer')); return; }
    reparse();
    const steps = parseStepsBlock(f.stepsText, { parParagraphe });
    const n = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const targetRecipe = recipe || null;
    const recipeId = recipeIdOuvert;
    const hasIng = parsedLines.length > 0, hasSteps = steps.length > 0;
    const availability = hasIng && hasSteps ? 'available' : (hasIng || hasSteps) ? 'partial' : 'reference_only';
    const convention = edition?.unit_convention_id ? getConvention(edition.unit_convention_id) : null;
    // Doublon d'import dans cette édition (même titre et page) pour une nouvelle recette
    if (!targetRecipe && editionId) {
      const dup = ctx.recipes.find((r) => r.edition_id === editionId && r.original_title.trim().toLowerCase() === f.title.trim().toLowerCase() && String(r.printed_page ?? '') === String(f.printed_page ?? ''));
      if (dup && !(await confirmDialog(t('Une recette « {t} » existe déjà dans ce livre à la même page. Créer quand même ?', { t: dup.original_title }), { okLabel: t('Créer un doublon') }))) return;
    }
    const kindVersion = recipe && kind !== 'adaptation' && versions.length ? 'correction' : kind;
    // Import ciblé (spec § 4.3.7, I4) : une correction hérite de sa parente ce que la lecture a dit — import_id (souple), incomplete, missing_page,
    // titre_lu — et la date de la lecture (lu_le : celle que la parente porte, sinon sa création), pour que le bandeau de la fiche date la LECTURE ;
    // rien hors d'une lecture (une parente sans import_id ne lègue rien), rien pour une adaptation, et RIEN pour une relecture par l'assistant faite
    // ici (f.aiUsed : ce n'est pas cette lecture-là ; ronde 1). Revalidé à l'héritage (I-1) : titre_lu ≤ 200 points de code, lu_le lisible.
    const parente = base?.provenance;
    // Les incertitudes de la lecture (vague finale, m8) : revalidées aux bornes de validateParsedRecipe (≤ 40 × 200 points de code), sinon aucune.
    const champsIncertains = (x) => (Array.isArray(x) && x.length <= BORNES_EXTRACTION.champsIncertains && x.every((u) => typeof u === 'string' && Array.from(u).length <= BORNES_EXTRACTION.champIncertain) ? [...x] : []);
    const heritageLecture = kindVersion === 'correction' && !f.aiUsed && typeof parente?.import_id === 'string' && parente.import_id
      ? { import_id: parente.import_id, incomplete: parente.incomplete === true, missing_page: parente.missing_page === true,
        titre_lu: typeof parente.titre_lu === 'string' && Array.from(parente.titre_lu).length <= BORNES_EXTRACTION.titre ? parente.titre_lu : null,
        lu_le: Object.hasOwn(parente, 'lu_le') ? isoLisible(parente.lu_le) : isoLisible(base.created_at), uncertain_fields: champsIncertains(parente.uncertain_fields) }
      : {};
    // Une lecture du JOURNAL posée dans ce formulaire (ronde 1, I-1) : la version garde ce qu'elle a dit d'incomplet (titre lu compris), et la fiche reste
    // partial au plus (comme fabriquerExtraction) ; elle nomme la ligne (import_id, pointeur souple) seulement quand c'est CETTE lecture qui est close.
    const lu = !targetRecipe && f.aiUsed && lecturePosee ? lecturePosee.resultat : null;
    const ligneLue = lu && importCourant && lecturePosee.cle ? await repo.get('imports', importCourant) : null;
    const fermer = ligneLue?.status === 'a_verifier' && ligneLue.kind === 'recette' && ligneLue.recipe_id == null && cleLecture(ligneLue) === lecturePosee.cle;
    const lectureJournal = lu ? { ...(fermer ? { import_id: ligneLue.id } : {}), incomplete: lu.incomplete === true, missing_page: lu.missing_page === true, titre_lu: typeof lu.title === 'string' ? lu.title : null, uncertain_fields: champsIncertains(lu.uncertain_fields) } : {};
    const version = {
      id: repo.newId('rv'), recipe_id: recipeId, kind: kindVersion, parent_version_id: base?.id || null,
      status: kind === 'adaptation' ? f.status : null, servings: n(f.servings), prep_minutes: n(f.prep), cook_minutes: n(f.cook), active_minutes: n(f.active), total_minutes: n(f.total),
      // Une ligne VÉRIFIÉE n'est plus incertaine (ronde 1, une seule règle) : la personne l'a relue — la fiche ne dit jamais « Vérifiée » et « incertaine ».
      ingredients: parsedLines.map((l) => ({ ...l, unit_candidates: l.unit_candidates || null, ...(Object.hasOwn(l, 'uncertain') ? { uncertain: l.uncertain === true && l.verification_state !== 'verified' } : {}) })), steps, constraints: estThermomix(base) ? structuredClone(base.constraints || {}) : {}, changes: f.changes.trim(), notes: f.notes.trim(),
      provenance: { source_page_ids: pageIds, source_document_id: doc?.id || null, generated_by: f.aiUsed ? 'ai' : 'manual', model: f.aiModel, edition_id: editionId, convention_snapshot: convention ? { id: convention.id, revision: convention.revision, values: convention.values } : null, ...heritageLecture, ...lectureJournal, ...(estThermomix(base) ? { thermomix: structuredClone(base.provenance.thermomix), thermomix_invalide: true } : {}) },
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
      // I-1 : une page possiblement manquante ou une lecture incomplète n'est jamais comblée par une correction — la fiche reste partial au plus.
      if ((heritageLecture.incomplete || heritageLecture.missing_page || lectureJournal.incomplete || lectureJournal.missing_page) && rec.availability === 'available') rec.availability = 'partial';
      rec.current_version_id = version.id;
      rec.verification_state = version.verification_state;
      rec.ingredient_ids = [...new Set(parsedLines.map((l) => l.ingredient_id).filter(Boolean))];
    }
    // Lot D (§ 4.8.2 points 3 et 4, I-D3) : role recette avec kind recipe ; le numéro de la fiche ne va qu'à la PREMIÈRE page sans numéro ; la photo
    // d'index de la fiche corrigée n'est jamais réécrite (ni kind, ni role, ni printed_page).
    const pageUpdates = pages.filter((p) => p.id !== recipe?.index_page_id).map((p, i) => ({ ...p, kind: 'recipe', role: 'recette', printed_page: p.printed_page ?? (i === 0 ? n(f.printed_page) : null) }));
    // Lots F et I2 : les champs photo et Mes notes viennent de la fiche RELUE — l'éditeur ne les édite pas, la base fait foi. Une photo ou note
    // posée pendant l'édition survit ; une origine hors liste se lit null ; une clé absente en base reste absente (P-6).
    // Ronde 1 de la tâche 5 : relus DANS la transaction d'écriture (condition { key, fusion } de saveBatch, le motif de ★ Favori) — une écriture qui
    // s'engage pendant les lectures de save() n'est plus écrasée. L0 : une fiche disparue annule TOUT le lot, jamais de repli sur l'ancienne copie.
    // D-12 : le vocabulaire fermé est vérifié sur la fiche qui s'écrit, avant l'écriture (dans la transaction pour une fiche relue).
    const avecPhotoDe = (relue) => {
      const r = { ...rec };
      for (const champ of ['photo_sha256', 'photo_origin', 'photo_source_url', 'photo_provenance', 'personal_notes', 'favorite', 'reperes']) {
        if (Object.hasOwn(relue, champ)) r[champ] = champ === 'photo_origin' ? originePhotoAdmise(relue[champ]) : relue[champ];
        else delete r[champ];
      }
      assertVocabulaire(r, 'recipes');
      return r;
    };
    // Une fiche existante n'entre pas dans les puts : la condition l'écrit (fermer exige une recette neuve, donc le chemin de la clôture garde ses puts).
    const lot = { ...(targetRecipe ? {} : { recipes: [avecPhotoDe(rec)] }), recipe_versions: [version], source_pages: pageUpdates };
    const conditionFiche = targetRecipe ? {
      recipes: [{ key: targetRecipe.id, fusion: c => { if (!c) throw new TransitionRefusee('recipes', targetRecipe.id, null); return avecPhotoDe(c); } }],
      ...(base ? { recipe_versions: [{ key: base.id, fusion: c => {
        if (!c || c.recipe_id !== targetRecipe.id || projectionSourceTraduction(c) !== sourceOuverte) throw new TransitionRefusee('recipe_versions', base.id, null);
        return null; // contrôle seul : ne réécrit ni la version ni sa date
      } }] } : {}),
    } : null;
    // La séance (recipe_ids) s'écrit dans la MÊME transaction que la recette (I-10, ronde 1), relue juste avant (leçon C4).
    const seance = sessionId && !seanceRefusee ? await repo.get('scan_sessions', sessionId) : null;
    // Lot D (§ 4.8.2 point 5, N-1) : quand « Enregistrer » ferme une lecture du journal, la séance entre dans LA transaction par le sac `conditions` (relue
    // dedans, recipe_ids réunis, done seulement quand plus aucune de ses photos n'est sans rôle — statutSeanceApres sur ses pages relues juste avant ;
    // les positions ne sont jamais réécrites) ; sans lecture du journal, la copie relue comme avant.
    let conditionsSeance = null;
    if (seance && fermer) {
      const pagesSeance = new Map();
      for (const id of Array.isArray(seance.page_ids) ? seance.page_ids : []) { const p = await repo.get('source_pages', id); if (p) pagesSeance.set(id, p); }
      const ecrites = new Set(pageUpdates.map((p) => p.id));
      conditionsSeance = { scan_sessions: [{ key: seance.id, attendus: ['open', 'done'], patch: (c) => ({ recipe_ids: [...new Set([...(Array.isArray(c.recipe_ids) ? c.recipe_ids : []), recipeId])], status: statutSeanceApres(c, pagesSeance, ecrites) }) }] };
    } else if (seance) lot.scan_sessions = [{ ...seance, recipe_ids: [...new Set([...(Array.isArray(seance.recipe_ids) ? seance.recipe_ids : []), recipeId])] }];
    // Tâche 6 : LA lecture du journal posée dans ce formulaire (a_verifier, sa clé) est CLOSE avec la recette — enregistre, réponse brute effacée — dans
    // UNE transaction conditionnée (I-10) à cette même lecture (T4-R2, ronde 1 : une lecture plus récente, arrivée d'un autre onglet, n'est jamais close
    // sans avoir été vue ; la recette relue s'enregistre alors sans elle). Refusée (close ou ignorée entre-temps) : rien n'est écrit, l'éditeur se détache
    // de la ligne et « Enregistrer » écrira à nouveau sans elle.
    if (fermer) {
      const cle = lecturePosee.cle;
      const cloture = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', ligneLue.id, c.status); return { status: 'enregistre', reponse_brute: null, finished_at: repo.nowIso() }; };
      try { await repo.transitionner('imports', ligneLue.id, { attendus: ['a_verifier'], patch: cloture, puts: lot, recettes: [gardeRecette], ...(conditionsSeance ? { conditions: conditionsSeance } : {}) }); }
      catch (e) {
        if (!(e instanceof TransitionRefusee)) throw e;
        // Ronde 1 (§ 4.8.1 point 2, repris par § 4.8.2 point 5) : un refus de la SÉANCE garde la lecture posée — le geste suivant la clôt sans la séance.
        if (e.store === 'scan_sessions') { seanceRefusee = true; toast(t('La recette n’a pas pu être enregistrée. Réessaie.')); return; }
        importCourant = null; lecturePosee = { ...lecturePosee, cle: null }; // détachée de la ligne ; ce que la lecture a dit d'incomplet reste porté
        toast(t('La recette n’a pas pu être enregistrée. Réessaie.'));
        return;
      }
    } else await repo.saveBatch(lot, { recettes: [gardeRecette], ...(conditionFiche ? { conditions: conditionFiche } : {}) });
    toast(kind === 'adaptation' ? t('Ma version enregistrée') : t('Recette enregistrée'));
    navigate(`/recipes/${recipeId}?v=${version.id}`);
  }
}

function f_defaultTranslation(recipe) { return recipe?.original_language === 'en' ? 'fr' : 'en'; }

// Traduction d'une version précise : signalée comme telle, sans devenir une adaptation culinaire (spec §14, §29.1).
function translationEditor({ recipe, base, ctx, f, gardeRecette }) {
  if (!base) return el('div', { class: 'card' }, t('Aucune version à traduire.'));
  const existing = ctx.recipe_translations.find((tr) => tr.recipe_version_id === base.id && tr.locale === f.translationLocale);
  const lecture = lireTraduction(existing, base);
  const sourceValide = verifierSourceTraduction(base, recipe.original_title || '');
  const ancien = existing?.translated_content;
  const contenuAncien = ancien && typeof ancien === 'object' && !Array.isArray(ancien)
    ? { title: ancien.title ?? '', ingredients: ancien.ingredients, steps: ancien.steps } : null;
  // Les tableaux de longueur différente ne sont pas associés : la personne retrouve les textes dans le panneau de revue.
  const ancienValide = contenuAncien ? validerContenuTraduction(contenuAncien, base) : null;
  const sourceOuverte = projectionSourceTraduction(base), traductionOuverte = JSON.stringify(existing ?? null);
  const sourceTitre = recipe.original_title;
  const root = el('div', null, pageHeader(t('Traduire — {l}', { l: f.translationLocale.toUpperCase() }), { back: { href: `/recipes/${recipe.id}`, label: t('Fiche recette') } }));
  const montrerBrut = (titre, contenu) => {
    const panneau = el('details', { class: 'card', dataset: { role: 'ancienne-traduction' } }, el('summary', null, titre));
    // La consultation est explicite : une source hors bornes ne fabrique pas des milliers de contrôles au chargement.
    let ouvert = false;
    panneau.addEventListener('toggle', () => {
      if (!panneau.open || ouvert) return;
      ouvert = true;
      const textes = valeur => typeof valeur === 'string' ? valeur : Array.isArray(valeur) ? valeur.map(textes).join('\n\n') : valeur && typeof valeur === 'object' ? Object.values(valeur).map(textes).filter(Boolean).join('\n\n') : '';
      const ajouter = (label, valeur) => panneau.append(field(label, el('textarea', { rows: 6, readOnly: true, value: textes(valeur), style: { whiteSpace: 'pre-wrap' } })));
      if (contenu && typeof contenu === 'object' && !Array.isArray(contenu) && ['title', 'ingredients', 'steps'].some(k => Object.hasOwn(contenu, k))) {
        ajouter(t('Titre'), contenu.title); ajouter(t('Ingrédients'), contenu.ingredients); ajouter(t('Étapes'), contenu.steps);
      } else ajouter(t('Texte conservé'), contenu);
    });
    root.append(panneau);
  };
  if (existing && lecture.etat !== 'courante') {
    root.append(el('p', { class: 'status warn' }, t('Ancienne traduction à vérifier : les correspondances ne sont pas garanties.')));
    montrerBrut(t('Consulter les textes conservés'), existing.translated_content ?? existing);
  }
  const horsLimites = !sourceValide.ok || (existing && (!ancienValide || (!ancienValide.ok && ancienValide.raison !== 'alignement')));
  if (horsLimites) {
    root.append(el('p', { class: 'status warn', role: 'status', dataset: { role: 'etat-traduction' } }, t('Ce contenu dépasse les limites de l’éditeur de traduction ou sa structure est invalide. Les textes sont conservés, sans modification.')));
    montrerBrut(t('Consulter la source conservée'), { title: recipe.original_title,
      ingredients: Array.isArray(base.ingredients) ? base.ingredients.map(i => i?.source_text ?? i?.name_text ?? '') : base.ingredients,
      steps: Array.isArray(base.steps) ? base.steps.map(s => s?.text ?? '') : base.steps });
    if (existing && lecture.etat === 'courante') montrerBrut(t('Consulter les textes conservés'), existing.translated_content);
    return root;
  }
  // Une ancienne correspondance complète est seulement proposée à la relecture ; un format inconnu n'est jamais prérempli.
  const contenu = lecture.contenu || (lecture.etat === 'ancienne' && ancienValide?.ok ? contenuAncien : null);
  const tr = { title: contenu?.title ?? (typeof ancien?.title === 'string' ? ancien.title : ''),
    ingredients: base.ingredients.map((_, i) => contenu?.ingredients[i] ?? ''), steps: base.steps.map((_, i) => contenu?.steps[i] ?? '') };
  const etat = el('p', { class: 'status warn', role: 'status', hidden: true, dataset: { role: 'etat-traduction' } });
  const ecrireEtat = texte => { etat.textContent = texte; etat.hidden = !texte; };
  const champs = el('div', { class: 'stack' });
  champs.append(field(t('Titre traduit'), el('input', { type: 'text', value: tr.title, dataset: { role: 'traduction-titre' }, onInput: e => { tr.title = e.target.value; } }), recipe.original_title || ''));
  const segments = (liste, cle, role, texte) => {
    const bloc = el('section', { class: 'stack' }, el('h2', null, texte));
    liste.forEach((item, i) => {
      const original = cle === 'ingredients' ? item.source_text ?? item.name_text ?? '' : item.text ?? '';
      const entree = el('textarea', { rows: cle === 'ingredients' ? 2 : 4, value: tr[cle][i], dataset: { role, index: i }, onInput: e => { tr[cle][i] = e.target.value; } });
      bloc.append(el('div', { class: 'card stack' },
        el('div', { class: 'muted', style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, original),
        field(cle === 'ingredients' ? t('Traduction de l’ingrédient {n}', { n: i + 1 }) : t('Traduction de l’étape {n}', { n: i + 1 }), entree)));
    });
    champs.append(bloc);
  };
  segments(base.ingredients, 'ingredients', 'traduction-ingredient', t('Ingrédients'));
  segments(base.steps, 'steps', 'traduction-etape', t('Étapes'));
  let enCours = false;
  const enregistrer = el('button', { class: 'btn primary', onClick: async () => {
    if (enCours) return;
    ecrireEtat('');
    const content = { title: tr.title.trim(), ingredients: tr.ingredients.map(s => s.trim()), steps: tr.steps.map(s => s.trim()) };
    const valide = validerContenuTraduction(content, base);
    if (!valide.ok) { ecrireEtat(t('La traduction dépasse les limites autorisées ou contient des segments invalides. Ta saisie reste dans ce formulaire.')); return; }
    enCours = true; enregistrer.disabled = true;
    try {
      const row = { id: existing?.id || repo.newId('tr'), recipe_version_id: base.id, locale: f.translationLocale, alignment_format: 1, translated_content: content, origin: 'manual', verification_state: 'unverified' };
      await repo.saveBatch({ recipe_translations: [row] }, { recettes: [gardeRecette], conditions: {
        recipes: [{ key: recipe.id, fusion: courante => {
          if (!courante) throw new TransitionRefusee('recipes', recipe.id, null);
          if (courante.original_title !== sourceTitre) throw new TransitionRefusee('recipe_versions', base.id, null);
          return null;
        } }],
        recipe_versions: [{ key: base.id, fusion: courante => {
          if (!courante || courante.recipe_id !== recipe.id || projectionSourceTraduction(courante) !== sourceOuverte) throw new TransitionRefusee('recipe_versions', base.id, null);
          return null;
        } }],
        recipe_translations: [existing ? { key: existing.id, fusion: courante => {
          if (JSON.stringify(courante) !== traductionOuverte) throw new TransitionRefusee('recipe_translations', existing.id, null);
          return null;
        } } : { key: row.id, absente: true }],
      } });
      toast(t('Traduction enregistrée')); navigate(`/recipes/${recipe.id}?v=${base.id}&lang=${f.translationLocale}`);
    } catch (error) {
      ecrireEtat(error instanceof TransitionRefusee
        ? error.store === 'recipes' ? t('Cette recette n’est plus disponible. Tes modifications restent dans ce formulaire.')
          : error.store === 'recipe_translations' ? t('Cette traduction a changé ailleurs. Ta saisie est conservée ; recharge la traduction pour comparer.')
            : t('La version source a changé ou n’est plus disponible. Tes modifications restent dans ce formulaire.')
        : t('L’enregistrement a échoué. Tes modifications restent dans ce formulaire.'));
    } finally { enCours = false; enregistrer.disabled = false; }
  } }, t('Enregistrer la traduction'));
  root.append(champs, etat, enregistrer);
  return root;
}

export { parseIngredientLine };
