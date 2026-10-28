// Mode cuisine (spec §17, §33) : ingrédients et étape visibles ensemble, grandes commandes, progression conservée,
// minuterie confiée au système avec états honnêtes, note après cuisson (« À refaire ? »).
import { el, toast, confirmDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { scaleVersion } from '../domain/scaling.js';
import { normalizeText } from '../domain/units.js';
import { createTimerLaunch, shortcutUrl, siriPhrase, describeDuration, isAppleTouchDevice, TIMER_STATE_HELP } from '../domain/timers.js';
import { label } from '../core/i18n.js';
import { qtyEl, section, field, etiquetteIA, estExtractionNonRelue } from './components.js';
import { estCreationIA, AVERTISSEMENT_CREATION_IA } from '../domain/creation-ia.js';
import { deviceId } from './import.js';
import { ouvrirCuissons, noteEnCuisine } from './cuisson.js';

export async function renderCook(params, query, ctx, deps = {}) {
  const session = ctx.cook_sessions.find((s) => s.id === params.id);
  if (!session) return el('div', { class: 'card' }, t('Session introuvable.'));
  const items = session.selected_version_ids.map((vid) => {
    const version = ctx.versionsById.get(vid);
    const recipe = version ? ctx.recipesById.get(version.recipe_id) : null;
    const servings = session.servings_by_version?.[vid] ?? session.servings ?? version?.servings;
    return version && recipe ? { version, recipe, servings, scaled: scaleVersion(version, servings), convention_id: ctx.conventionFor(recipe) } : null;
  }).filter(Boolean);
  if (!items.length) return el('div', { class: 'card' }, t('Version introuvable.'));
  let activeIdx = Math.max(0, items.findIndex((it) => it.version.id === (session.active_version_id || session.selected_version_ids[0])));
  const progress = session.progress || {};
  progress.done_step_ids = progress.done_step_ids || [];
  progress.by_version = progress.by_version || {};
  const root = el('div', null);
  const title = items.length === 1 ? (items[0].recipe.display_title || items[0].recipe.original_title) : t('Repas — {n} recettes', { n: items.length });
  root.append(el('div', { class: 'row between', style: { marginBottom: '.6rem' } },
    el('h1', null, title),
    el('div', { class: 'row' },
      el('span', { class: 'muted', style: { fontSize: '.85rem' } }, t('Progression conservée sur cet appareil')),
      el('button', { class: 'btn', onClick: finish }, t('Terminer')),
      el('a', { class: 'btn', href: `#/recipes/${items[activeIdx].recipe.id}?v=${items[activeIdx].version.id}` }, t('Fiche')))));
  // C-2 / R-CRE-10 : toute fiche origine 'ia' (et toute création) dit sa lignée EN TÊTE, sous la rangée du titre (cook.js n'a pas de
  // pageHeader — P16) — une correction dit « Corrigée par toi — d’après une création IA » ; dans un repas, chacune est nommée par son
  // titre. L'avertissement C-9 (« n'a pas cuisiné cette recette ») reste réservé aux versions estCreationIA.
  const lignees = items.map((it) => ({ it, etiquette: etiquetteIA(it.version, it.recipe) })).filter((x) => x.etiquette);
  if (lignees.length) root.append(el('div', { class: 'stack', style: { marginBottom: '.6rem' }, dataset: { role: 'cuisine-ia' } },
    el('div', { class: 'row' }, ...lignees.map(({ it, etiquette }) => (items.length > 1 ? el('span', null, `${it.recipe.display_title || it.recipe.original_title} · `, etiquette) : etiquette))),
    items.some((it) => estCreationIA(it.version)) ? el('div', { class: 'status warn' }, t(AVERTISSEMENT_CREATION_IA)) : null));
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

  const tabs = items.length > 1 ? el('div', { class: 'row', style: { marginBottom: '.6rem' } }, ...items.map((it, i) => el('button', { class: `btn small ${i === activeIdx ? 'active' : ''}`, onClick: () => { activeIdx = i; session.active_version_id = it.version.id; draw(); } }, it.recipe.display_title || it.recipe.original_title)), el('button', { class: 'btn small', onClick: () => { planOpen = !planOpen; draw(); } }, t('Plan commun'))) : null;
  let planOpen = false;
  if (tabs) root.append(tabs);
  const area = el('div', null);
  let bilanOuvert = false;
  root.append(area);
  draw();
  return root;

  function stepsOf(it) { return it.version.steps || []; }
  function currentStepIndex(it) {
    const st = progress.by_version[it.version.id] || {};
    const steps = stepsOf(it);
    const idx = steps.findIndex((s) => s.id === st.current_step_id);
    return idx >= 0 ? idx : 0;
  }
  async function persist() {
    progress.total_steps = items.reduce((n, it) => n + stepsOf(it).length, 0);
    session.progress = progress;
    await repo.saveBatch({}, { conditions: { cook_sessions: [{ key: session.id, fusion: c => c?.status === 'active' ? { ...c, progress, active_version_id: session.active_version_id } : null }] } });
  }

  function draw() {
    area.replaceChildren();
    if (planOpen) { area.append(commonPlan()); return; }
    const it = items[activeIdx];
    const steps = stepsOf(it);
    const idx = currentStepIndex(it);
    const step = steps[idx];
    const ingUl = el('ul', { class: 'ingredients list plain' });
    const stepNorm = step ? normalizeText(step.text) : '';
    const recalled = [];
    for (const ri of it.scaled.ingredients) {
      const ing = ri.ingredient_id ? ctx.ingredientsById.get(ri.ingredient_id) : null;
      const names = [ri.name_text, ing?.labels?.fr?.label, ing?.labels?.en?.label, ...(ing?.labels?.fr?.aliases || []), ...(ing?.labels?.en?.aliases || [])].filter(Boolean).map(normalizeText);
      const hit = step && names.some((n) => n.length >= 3 && stepNorm.includes(n));
      const li = el('li', { class: hit ? 'hit' : '' }, el('span', null, ing && ri.verification_state === 'verified' ? ing.labels.fr.label : (ri.name_text || ri.source_text), ri.preparation ? el('span', { class: 'muted' }, `, ${ri.preparation}`) : null), qtyEl(ri, { system: session.units || 'original', convention_id: it.convention_id, ingredient: ing && ri.verification_state === 'verified' ? ing : null }));
      if (hit) recalled.push(li.cloneNode(true));
      ingUl.append(li);
    }
    const left = el('div', null, section(t('Ingrédients'), el('div', { class: 'muted', style: { fontSize: '.85rem' } }, it.servings ? t('{n} portions', { n: it.servings }) : ''), ingUl, ...it.scaled.notes.map((n) => el('small', { class: 'muted', style: { display: 'block' } }, n))));
    const right = el('div', { class: 'stack' });
    const personnelle = noteEnCuisine(it.recipe);
    if (personnelle) right.append(personnelle);
    right.append(el('div', { class: 'progress' }, el('div', { style: { width: steps.length ? `${Math.round(progress.done_step_ids.filter((id) => steps.some((s) => s.id === id)).length / steps.length * 100)}%` : '0%' } })));
    if (!step) right.append(el('div', { class: 'step-big' }, t('Aucune étape numérisée pour cette version.')));
    else {
      right.append(el('div', { class: 'step-big' }, el('div', { class: 'muted', style: { fontSize: '.9rem', marginBottom: '.4rem' } }, `${t('Étape')} ${idx + 1} / ${steps.length}`), el('div', { style: { whiteSpace: 'pre-line' }, dataset: { role: 'texte-etape' } }, step.text), // m10 : étape entière, sauts de ligne gardés
        recalled.length ? el('ul', { class: 'ingredients list plain', style: { fontSize: '1rem', marginTop: '.8rem' } }, ...recalled) : null));
      for (const tm of step.timers || []) right.append(timerCard(tm, it, step));
    }
    const speak = 'speechSynthesis' in window && step ? el('button', { class: 'btn', onClick: () => { const u = new SpeechSynthesisUtterance(step.text); u.lang = (it.recipe.original_language || 'fr') === 'en' ? 'en-CA' : 'fr-CA'; speechSynthesis.cancel(); speechSynthesis.speak(u); } }, t('Lire à voix haute')) : null;
    right.append(el('div', { class: 'controls' },
      el('button', { class: 'btn', disabled: idx === 0, onClick: () => go(it, idx - 1) }, `← ${t('Précédent')}`),
      idx < steps.length - 1 ? el('button', { class: 'btn primary', onClick: () => go(it, idx + 1, step) }, `${t('Suivant')} →`) : el('button', { class: 'btn primary', onClick: () => { if (step) markDone(step); finish(); } }, t('Terminer'))),
      el('div', { class: 'row' }, speak, el('small', { class: 'muted' }, t('Commandes vocales : à venir après validation sur iOS. Pour une minuterie, parle à Siri directement.'))));
    area.append(el('div', { class: 'cook' }, left, right));
  }

  function markDone(step) { if (!progress.done_step_ids.includes(step.id)) progress.done_step_ids.push(step.id); }
  async function go(it, newIdx, doneStep = null) {
    if (doneStep) markDone(doneStep);
    const steps = stepsOf(it);
    progress.by_version[it.version.id] = { current_step_id: steps[newIdx]?.id || null };
    await persist();
    draw();
  }

  // Bloc minuterie avec états : requested → opening → unconfirmed | failed. Compte à rebours miroir indicatif.
  function timerCard(tm, it, step) {
    const seconds = tm.seconds;
    let launch = null;
    const stateEl = el('div', { class: 'muted', style: { fontSize: '.9rem' } });
    const mirror = el('div', { class: 'mirror', style: { display: 'none' } });
    let mirrorTimer = null;
    const setState = async (state) => { if (!launch) return; launch.handoff_state = state; launch = await repo.save('timer_launches', launch); stateEl.textContent = `${label('timer_state', state)} — ${TIMER_STATE_HELP[state]}`; };
    const request = async (channel) => {
      launch = createTimerLaunch({ cook_session_id: session.id, recipe_version_id: it.version.id, step_id: step.id, device_id: deviceId(), duration_seconds: seconds, channel });
      launch = await repo.save('timer_launches', launch);
      if (channel === 'shortcut') { await setState('opening'); setTimeout(() => { if (launch.handoff_state === 'opening') setState('unconfirmed'); }, 2500); }
      else stateEl.textContent = `${label('timer_state', 'siri')} — ${TIMER_STATE_HELP.siri}`;
      startMirror();
    };
    const startMirror = () => {
      const end = Date.now() + seconds * 1000;
      mirror.style.display = 'block';
      clearInterval(mirrorTimer);
      mirrorTimer = setInterval(() => {
        const left = Math.max(0, Math.round((end - Date.now()) / 1000));
        mirror.textContent = `${t('Indicatif')} : ${describeDuration(left)}`;
        if (left <= 0) { clearInterval(mirrorTimer); mirror.textContent = t('Indicatif : temps écoulé — fie-toi à l’alarme d’Horloge.'); }
      }, 500);
    };
    const apple = isAppleTouchDevice();
    return el('div', { class: 'card flat stack' },
      el('div', { class: 'row between' }, el('strong', null, `⏱ ${tm.label}${tm.seconds_max ? ` (${t('jusqu’à')} ${describeDuration(tm.seconds_max)})` : ''}`),
        apple ? el('a', { class: 'btn primary', href: shortcutUrl(seconds), onClick: () => request('shortcut') }, t('Lancer la minuterie système')) : null),
      el('div', null, `${t('Dis à Siri')} : « ${siriPhrase(seconds)} » `, el('button', { class: 'btn small', onClick: () => request('siri') }, t('Fait'))),
      stateEl, mirror,
      el('div', { class: 'row' },
        el('button', { class: 'btn small', onClick: () => launch && setState('failed') }, t('Ça n’a pas démarré')),
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
      const ok = await ouvrirCuissons(items, { ...deps, repo: deps.repo ?? repo, session });
      if (ok) (deps.navigate ?? navigate)(session.meal_id ? `/meals/${encodeURIComponent(session.meal_id)}` : `/recipes/${encodeURIComponent(it.recipe.id)}`);
    } finally { bilanOuvert = false; }
  }
}

export { refresh };
