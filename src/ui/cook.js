import { lireCycleRecette } from '../domain/cycle-recette.js';
import { capturerRecette } from './recette-garde.js';
import { mentionCycleRecette } from './corbeille.js';
// Mode cuisine (spec §17, §33) : ingrédients et étape visibles ensemble, grandes commandes, progression conservée,
// minuterie confiée au système avec états honnêtes, note après cuisson (« À refaire ? »).
import { el, toast, confirmDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { scaleVersion } from '../domain/scaling.js';
import { createTimerLaunch, describeDuration, TIMER_STATE_HELP } from '../domain/timers.js';
import { label } from '../core/i18n.js';
import { qtyEl, section, field, etiquetteIA, estExtractionNonRelue, contexteFichiers, empreintesPhotos, fichierPhoto, timerBlock } from './components.js';
import { estCreationIA, AVERTISSEMENT_CREATION_IA } from '../domain/creation-ia.js';
import { deviceId } from './import.js';
import { estThermomix } from '../domain/thermomix.js';
import { portionsSession } from '../domain/thermomix-session.js';
import { panneauGardeThermomix, rappelThermomix } from './thermomix-garde.js';
import { photosPersonnellesParRecette, photoPrincipale } from '../domain/cuisine-personnelle.js';
import { photoVisible } from './photos-visibles.js';
import { ouvrirCuissons, noteEnCuisine } from './cuisson.js';
import { getSyncGeneration } from './state.js';

export async function renderCook(params, query, ctx, deps = {}) {
  const depot = deps.repo ?? repo;
  const generation = getSyncGeneration();
  const session = ctx.cook_sessions.find((s) => s.id === params.id);
  if (!session) return el('div', { class: 'card' }, t('Session introuvable.'));
  const items = session.selected_version_ids.map((vid) => {
    const version = ctx.versionsById.get(vid);
    const recipe = version ? ctx.recipesById.get(version.recipe_id) : null;
    const servings = version ? portionsSession(session, version) : null;
    return version && recipe ? { version, recipe, servings, scaled: scaleVersion(version, servings), convention_id: ctx.conventionFor(recipe) } : null;
  }).filter(Boolean);
  if (!items.length) return el('div', { class: 'card' }, t('Version introuvable.'));
  if (items.some(it => lireCycleRecette(it.recipe).etat === 'invalide')) {
    return el('div', {class:'stack'}, ...items.map(it => el('section', {class:'card stack'},
      el('h2', null, it.recipe.display_title || it.recipe.original_title), mentionCycleRecette(it.recipe), noteEnCuisine(it.recipe),
      el('ol', null, ...(it.version.steps || []).map(s => el('li', null, s.text))),
      el('a', {class:'btn', href:`#/recipes/${encodeURIComponent(it.recipe.id)}?v=${encodeURIComponent(it.version.id)}`}, t('Fiche')))));
  }
  const blocageThermomix = panneauGardeThermomix(items);
  if (blocageThermomix) return blocageThermomix;
  let activeIdx = Math.max(0, items.findIndex((it) => it.version.id === (session.active_version_id || session.selected_version_ids[0])));
  let selectionConfirmee = activeIdx, selectionNumero = 0, selections = Promise.resolve(), dispose = false;
  let progress = session.progress || {};
  progress.done_step_ids = progress.done_step_ids || [];
  progress.by_version = progress.by_version || {};
  const root = el('div', { class: 'mode-cuisine' });
  root.append(...items.map(it=>mentionCycleRecette(it.recipe)).filter(Boolean));
  const contextesHistoriques = await Promise.all([...new Map(items.map(it => [it.recipe.id,it.recipe])).values()].map(r => capturerRecette(depot, r, {ctx, historique:true})));
  const ctxF = await contexteFichiers(ctx);
  const photos = photosPersonnellesParRecette(ctx.cook_history);
  const fichiers = await (deps.repo ?? repo).getFiles(empreintesPhotos(items.map(it => it.recipe), photos));
  const nettoyages = [];
  const nettoyer = () => { for (const photo of area.querySelectorAll('[data-role="photo-visible"]')) photo.dispose?.(); for (const fn of nettoyages.splice(0)) fn(); };
  root.dispose = () => { dispose = true; nettoyer(); };
  const title = items.length === 1 ? (items[0].recipe.original_title || items[0].recipe.display_title) : t('Repas — {n} recettes', { n: items.length });
  const titre = el('h1', null, title);
  const fiche = el('a', { class: 'btn' }, t('Fiche'));
  const etatSelection = el('div', { role: 'status', class: 'status warn', hidden: true });
  root.append(el('div', { class: 'row between', style: { marginBottom: '.6rem' } },
    titre,
    el('div', { class: 'row' },
      el('span', { class: 'muted', style: { fontSize: '.85rem' } }, t('Progression conservée sur cet appareil')),
      el('button', { class: 'btn', onClick: finish }, t('Terminer')),
      fiche)), etatSelection);
  // C-2 / R-CRE-10 : toute fiche origine 'ia' (et toute création) dit sa lignée EN TÊTE, sous la rangée du titre (cook.js n'a pas de
  // pageHeader — P16) — une correction dit « Corrigée par toi — d’après une création IA » ; dans un repas, chacune est nommée par son
  // titre. L'avertissement C-9 (« n'a pas cuisiné cette recette ») reste réservé aux versions estCreationIA.
  const lignees = items.map((it) => ({ it, etiquette: etiquetteIA(it.version, it.recipe) })).filter((x) => x.etiquette);
  if (lignees.length) root.append(el('div', { class: 'stack', style: { marginBottom: '.6rem' }, dataset: { role: 'cuisine-ia' } },
    el('div', { class: 'row' }, ...lignees.map(({ it, etiquette }) => (items.length > 1 ? el('span', null, `${it.recipe.display_title || it.recipe.original_title} · `, etiquette) : etiquette))),
    items.some((it) => estCreationIA(it.version)) ? el('div', { class: 'status warn' }, t(AVERTISSEMENT_CREATION_IA)) : null));
  for (const it of items) { const rappel = rappelThermomix(it.version); if (rappel) root.append(rappel); }
  // D-3 (import ciblé) : tant qu'une version est une extraction de l'assistant non relue, le mode cuisine le dit en tête (les quantités et les
  // étapes viennent d'une lecture à vérifier) ; dans un repas, la recette concernée est nommée.
  const nonRelues = items.filter((it) => estExtractionNonRelue(it.version));
  if (nonRelues.length) root.append(el('div', { class: 'status warn', style: { marginBottom: '.6rem' }, dataset: { role: 'bandeau-non-relue' } },
    ...nonRelues.map((it, i) => el('span', null, `${i ? ' · ' : ''}${items.length > 1 ? `${it.recipe.display_title || it.recipe.original_title} · ` : ''}${t('Lue par l’assistant, non relue')}`))));

  // Avant de commencer : attentes longues ou préparations préalables
  const warnings = [];
  for (const it of items) for (const s of it.version.steps || []) {
    const long = (s.timers || []).find((tm) => tm.seconds >= 3600);
    if (long) warnings.push(`${it.recipe.original_title} — ${t('étape')} ${s.position} : ${long.label}`);
    if (/la veille|overnight|toute une nuit|\b(\d+)\s*h(eures)?\s+de\s+(repos|marinade)|réfrigérer\s+\d+\s*h/i.test(s.text)) warnings.push(`${it.recipe.original_title} — ${t('étape')} ${s.position} : ${t('préparation ou repos long')}`);
  }
  if (warnings.length && !progress.done_step_ids.length) root.append(el('div', { class: 'card warn' }, el('strong', null, t('Avant de commencer')), el('ul', null, ...warnings.map((w) => el('li', null, w)))));

  const boutonsRecettes = items.map((it, i) => el('button', { class: 'btn small', type: 'button', onClick: () => choisirRecette(i) }, it.recipe.display_title || it.recipe.original_title));
  const boutonPlan = el('button', { class: 'btn small', type: 'button', onClick: () => { planOpen = !planOpen; draw(); } }, t('Plan commun'));
  const tabs = items.length > 1 ? el('div', { class: 'row', style: { marginBottom: '.6rem' } }, ...boutonsRecettes, boutonPlan) : null;
  let planOpen = false;
  if (tabs) root.append(tabs);
  const area = el('div', null);
  let bilanOuvert = false;
  root.append(area);
  draw();
  return root;

  function stepsOf(it) { return it.version.steps || []; }
  function modifierSession(it, fusion) {
    const refuser = () => { throw new Error('Recette de la session devenue indisponible'); };
    const contexteValide = () => { if (getSyncGeneration() !== generation) refuser(); };
    return depot.saveBatch({}, { recettes: contextesHistoriques, conditions: {
      recipes: [{ key: it.recipe.id, fusion: courant => { contexteValide(); if (!courant) refuser(); return null; } }],
      recipe_versions: [{ key: it.version.id, fusion: courant => { contexteValide(); if (!courant || courant.recipe_id !== it.recipe.id) refuser(); return null; } }],
      cook_sessions: [{ key: session.id, fusion: courant => {
        contexteValide();
        if (!courant || courant.status !== 'active' || !Array.isArray(courant.selected_version_ids) || !courant.selected_version_ids.includes(it.version.id)) refuser();
        return fusion(courant);
      } }],
    } });
  }
  function choisirRecette(index) {
    activeIdx = index;
    const it = items[index], numero = ++selectionNumero;
    session.active_version_id = it.version.id;
    planOpen = false; etatSelection.hidden = true; draw();
    // Sérialiser les gestes, mais ne fusionner que le choix : la progression d'un autre onglet reste intacte.
    selections = selections.then(async () => {
      await modifierSession(it, courant => ({ ...courant, active_version_id: it.version.id }));
      selectionConfirmee = index;
    }).catch(() => {
      if (dispose || numero !== selectionNumero) return;
      activeIdx = selectionConfirmee;
      session.active_version_id = items[activeIdx].version.id;
      etatSelection.textContent = t('La sélection n’a pas été enregistrée. La session ou la recette a changé ; réessaie après rechargement.');
      etatSelection.hidden = false;
      draw();
    });
    return selections;
  }
  function currentStepIndex(it) {
    const st = progress.by_version[it.version.id] || {};
    const steps = stepsOf(it);
    const idx = steps.findIndex((s) => s.id === st.current_step_id);
    return idx >= 0 ? idx : 0;
  }
  async function persist(it, newIdx, doneStep) {
    let ecrite;
    await modifierSession(it, courant => {
      const avant = courant.progress || {};
      ecrite = {
        ...avant,
        total_steps: items.filter(item => courant.selected_version_ids.includes(item.version.id)).reduce((n, item) => n + stepsOf(item).length, 0),
        by_version: { ...(avant.by_version || {}), [it.version.id]: { ...(avant.by_version?.[it.version.id] || {}), current_step_id: stepsOf(it)[newIdx]?.id || null } },
        done_step_ids: [...new Set([...(Array.isArray(avant.done_step_ids) ? avant.done_step_ids : []), ...(doneStep ? [doneStep.id] : [])])],
      };
      return { ...courant, progress: ecrite, active_version_id: it.version.id };
    });
    // L'état visible n'avance qu'après l'écriture ; une transaction refusée conserve l'étape affichée.
    progress = ecrite;
    session.progress = progress;
  }

  function draw() {
    const courant = items[activeIdx];
    fiche.setAttribute('href', `#/recipes/${courant.recipe.id}?v=${courant.version.id}`);
    titre.textContent = items.length === 1 ? title : `${title} · ${courant.recipe.display_title || courant.recipe.original_title}`;
    boutonsRecettes.forEach((bouton, i) => { bouton.classList.toggle('active', i === activeIdx); bouton.setAttribute('aria-pressed', String(i === activeIdx)); });
    boutonPlan.classList.toggle('active', planOpen); boutonPlan.setAttribute('aria-pressed', String(planOpen));
    nettoyer();
    area.replaceChildren();
    if (planOpen) { area.append(commonPlan()); return; }
    const it = items[activeIdx];
    const steps = stepsOf(it);
    const idx = currentStepIndex(it);
    const step = steps[idx];
    const ingUl = el('ul', { class: 'ingredients list plain' });

    for (const ri of it.scaled.ingredients) {
      const ing = ri.ingredient_id ? ctx.ingredientsById.get(ri.ingredient_id) : null;
      const li = el('li', null, el('span', null, ing && ri.verification_state === 'verified' ? ing.labels.fr.label : (ri.name_text || ri.source_text), ri.preparation ? el('span', { class: 'muted' }, `, ${ri.preparation}`) : null), qtyEl(ri, { system: session.units || 'original', convention_id: it.convention_id, ingredient: ing && ri.verification_state === 'verified' ? ing : null }));
      ingUl.append(li);
    }
    const ingredients = el('details', { class: 'ingredients-cuisine', dataset: { role: 'ingredients-cuisine' } },
      el('summary', null, t('Ingrédients de la recette')),
      el('div', { class: 'muted' }, it.servings ? t('{n} portions', { n: it.servings }) : ''), ingUl,
      ...it.scaled.notes.map(n => el('small', { class: 'muted' }, n)));
    const right = el('div', { class: 'stack' });
    const personnelle = noteEnCuisine(it.recipe);
    if (personnelle) right.append(personnelle);
    right.append(el('div', { class: 'progress' }, el('div', { style: { width: steps.length ? `${Math.round(progress.done_step_ids.filter((id) => steps.some((s) => s.id === id)).length / steps.length * 100)}%` : '0%' } })));
    if (!step) right.append(el('div', { class: 'step-big' }, t('Aucune étape numérisée pour cette version.')));
    else {
      right.append(el('div', { class: 'step-big' }, el('div', { class: 'muted', style: { fontSize: '.9rem', marginBottom: '.4rem' } }, `${t('Étape')} ${idx + 1} / ${steps.length}`), el('div', { style: { whiteSpace: 'pre-line' }, dataset: { role: 'texte-etape' } }, step.text), // m10 : étape entière, sauts de ligne gardés
        null));
      for (const tm of step.timers || []) right.append(timerCard(tm, it, step));
    }
    const speak = 'speechSynthesis' in window && step ? el('button', { class: 'btn', onClick: () => { const u = new SpeechSynthesisUtterance(step.text); u.lang = (it.recipe.original_language || 'fr') === 'en' ? 'en-CA' : 'fr-CA'; speechSynthesis.cancel(); speechSynthesis.speak(u); } }, t('Lire à voix haute')) : null;
    const navigation = el('div', { class: 'controls navigation-cuisine' },
      el('button', { class: 'btn', disabled: idx === 0, onClick: () => go(it, idx - 1) }, `← ${t('Précédent')}`),
      idx < steps.length - 1 ? el('button', { class: 'btn primary', onClick: () => go(it, idx + 1, step) }, `${t('Suivant')} →`) : el('button', { class: 'btn primary', onClick: () => { if (step) markDone(step); finish(); } }, t('Terminer')));
    right.append(ingredients, el('div', { class: 'row' }, speak, el('small', { class: 'muted' }, t('Commandes vocales : à venir après validation sur iOS. Pour une minuterie, parle à Siri directement.'))));
    const sha = photoPrincipale(it.recipe, photos)?.sha256;
    const photo = el('details', { class: 'photo-cuisine', dataset: { role: 'photo-cuisine' } }, el('summary', null, t('Voir la photo du plat')));
    photo.append(photoVisible(sha, { fichier: fichierPhoto(it.recipe, photos, fichiers), ctxF, classe: 'photo-cuisine-image', personnelle: !!photos.get(it.recipe.id) }) || el('p', { class: 'muted' }, t('Aucune photo pour cette recette.')));
    right.append(photo);
    area.append(el('div', { class: 'cook' }, right), navigation);
  }

  function markDone(step) { if (!progress.done_step_ids.includes(step.id)) progress.done_step_ids.push(step.id); }
  function go(it, newIdx, doneStep = null) {
    if (it.version.id !== items[activeIdx].version.id) return Promise.resolve();
    const numero = ++selectionNumero;
    etatSelection.hidden = true;
    // Même file et même garde que les onglets : une progression tardive ne réactive pas une version retirée.
    selections = selections.then(async () => {
      await persist(it, newIdx, doneStep);
      if (!dispose) draw();
    }).catch(() => {
      if (dispose || numero !== selectionNumero) return;
      etatSelection.textContent = t('La progression n’a pas été enregistrée. La session ou la recette a changé ; réessaie après rechargement.');
      etatSelection.hidden = false;
    });
    return selections;
  }

  // Bloc minuterie avec états : requested → opening → unconfirmed | failed. Compte à rebours miroir indicatif.
  function timerCard(tm, it, step) {
    let launch = null;
    const stateEl = el('div', { class: 'muted', style: { fontSize: '.9rem' } });
    const mirror = el('div', { class: 'mirror', style: { display: 'none' } });
    let mirrorTimer = null, handoffTimeout = null, carteActive = true;
    nettoyages.push(() => { carteActive = false; clearInterval(mirrorTimer); clearTimeout(handoffTimeout); });
    const setState = async (state) => { if (!launch) return; launch.handoff_state = state; launch = await depot.save('timer_launches', launch, {recettes:contextesHistoriques}); stateEl.textContent = `${label('timer_state', state)} — ${TIMER_STATE_HELP[state]}`; };
    const request = async (channel, seconds) => {
      launch = createTimerLaunch({ cook_session_id: session.id, recipe_version_id: it.version.id, step_id: step.id, device_id: deviceId(), duration_seconds: seconds, channel });
      launch = await depot.save('timer_launches', launch, {recettes:contextesHistoriques});
      if (!carteActive) return;
      if (channel === 'shortcut') {
        await setState('opening');
        if (!carteActive) return;
        handoffTimeout = setTimeout(() => { if (launch.handoff_state === 'opening') setState('unconfirmed').catch(() => {}); }, 2500);
      }
      else stateEl.textContent = `${label('timer_state', 'siri')} — ${TIMER_STATE_HELP.siri}`;
      if (carteActive) startMirror(seconds);
    };
    const startMirror = (seconds) => {
      const end = Date.now() + seconds * 1000;
      mirror.style.display = 'block';
      clearInterval(mirrorTimer);
      mirrorTimer = setInterval(() => {
        const left = Math.max(0, Math.round((end - Date.now()) / 1000));
        mirror.textContent = `${t('Indicatif')} : ${describeDuration(left)}`;
        if (left <= 0) { clearInterval(mirrorTimer); mirror.textContent = t('Indicatif : temps écoulé — fie-toi à l’alarme d’Horloge.'); }
      }, 500);
    };
    return el('div', { class: 'card flat stack' },
      timerBlock(tm.seconds, { seconds_max: tm.seconds_max, locale: ctx.settings?.ui_locale || 'fr', onRequest: request, compact: true }),
      estThermomix(it.version) ? el('small', { class: 'muted' }, t('Durée proposée par l’assistant, à vérifier pendant la cuisson.')) : null,
      stateEl, mirror,
      el('div', { class: 'row' },
        el('button', { class: 'btn small', onClick: () => { if (launch) setState('failed').catch(() => { stateEl.textContent = t('La demande de minuterie n’a pas été enregistrée. Réessaie.'); }); } }, t('Ça n’a pas démarré')),
        el('small', { class: 'muted' }, t('Le compte à rebours ci-dessus n’est pas une alarme : l’alarme vit dans Horloge et continue quand l’app est fermée.'))));
  }

  // Plan commun simple : étapes de toutes les recettes avec durées ; les attentes longues indiquent ce qui peut se chevaucher.
  function commonPlan() {
    const rows = [];
    for (const it of items) for (const s of stepsOf(it)) {
      const wait = (s.timers || []).reduce((m, tm) => Math.max(m, tm.seconds), 0);
      rows.push({ it, s, wait, done: progress.done_step_ids.includes(s.id) });
    }
    return section(t('Plan commun'),
      el('p', { class: 'muted' }, t('Vue par recette conservée. Les étapes avec attente longue libèrent du temps pour l’autre recette ; rien n’est parallélisé automatiquement.')),
      el('ul', { class: 'list' }, ...rows.map((r) => el('li', { class: 'row between' },
        el('div', null, el('span', { class: 'badge' }, r.it.recipe.display_title || r.it.recipe.original_title), ' ', el('span', { style: { textDecoration: r.done ? 'line-through' : 'none' } }, `${r.s.position}. ${r.s.text.slice(0, 140)}${r.s.text.length > 140 ? '…' : ''}`)),
        r.wait >= 600 ? el('span', { class: 'chip' }, `${t('attente')} ${describeDuration(r.wait)} — ${t('pendant ce temps : autre recette')}`) : null))),
      el('button', { class: 'btn', onClick: () => { planOpen = false; draw(); } }, t('Retour aux étapes')));
  }

  // Un formulaire PAR recette ; la fermeture et toutes les cuissons partagent une transaction.
  async function finish() {
    if (bilanOuvert) return;
    bilanOuvert = true;
    const it = items[activeIdx];
    try {
      const ok = await ouvrirCuissons(items, { ...deps, repo: deps.repo ?? repo, session, recettes: contextesHistoriques });
      if (ok) (deps.navigate ?? navigate)(session.meal_id ? `/meals/${encodeURIComponent(session.meal_id)}` : `/recipes/${encodeURIComponent(it.recipe.id)}`);
    } finally { bilanOuvert = false; }
  }
}

export { refresh };
