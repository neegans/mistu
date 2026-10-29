// Composer un repas (spec §26) : éléments avec rôle, portions et verrouillage ; remplacer cible un élément précis ;
// résumé du temps et des conflits d'appareils ; contraintes du repas distinctes du profil ; duo réussi mémorisé.
import { el, toast, chooseDialog, promptDialog, confirmDialog, formatDate } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { summarizeMeal } from '../domain/pairing.js';
import { assessMeal } from '../domain/diet.js';
import { MEAL_ROLES, DIET_TAGS, RECIPE_TYPES } from '../model/schema.js';
import { pageHeader, section, emptyState, select, field, dietChip, versionBadge, vignettePlat, contexteFichiers } from './components.js';
import { libelleSource } from '../core/lien.js';
import { deviceId } from './import.js';
import { estThermomix, gardeThermomix } from '../domain/thermomix.js';
import { portionsRepas, enregistrerSessionCuisine } from '../domain/thermomix-session.js';
import { BLOCAGE_THERMOMIX, rappelThermomix } from './thermomix-garde.js';
import { photosPersonnellesParRecette, photoPrincipale } from '../domain/cuisine-personnelle.js';
import { formaterHeureLocale, analyserHeureLocale, decalageUTC } from '../domain/heure-locale.js';
import { TransitionRefusee } from '../core/db.js';

export async function renderMeals(params, query, ctx) {
  const root = el('div', null, pageHeader(t('Ma semaine'), { actions: [el('button', { class: 'btn primary', onClick: () => newMeal(ctx) }, t('Nouveau repas'))] }));
  root.append(el('div', { class: 'status info', style: { marginBottom: '.8rem' } }, t('Planificateur multi-repas : palier V1.5. Ici : composer un repas, sa liste de courses et sa préparation.')));
  const meals = [...ctx.meals].sort((a, b) => (b.serve_at || b.created_at || '').localeCompare(a.serve_at || a.created_at || ''));
  if (!meals.length) root.append(emptyState('couverts', t('Aucun repas composé. Depuis une recette : « Ajouter à mon repas » ou « Avec quoi on mange ça ? ».')));
  else root.append(section(t('Repas'), ...meals.map((m) => el('a', { class: 'item-link card flat', href: `#/meals/${m.id}` },
    el('div', { class: 'row between' }, el('strong', null, m.title || t('Repas')), el('span', { class: 'muted' }, m.serve_at ? formatDate(m.serve_at, { withTime: true }) : formatDate(m.created_at))),
    el('div', { class: 'muted', style: { fontSize: '.85rem' } }, (m.items || []).map((it) => ctx.recipesById.get(it.recipe_id)?.original_title).filter(Boolean).join(' · ') || t('vide'))))));
  const lists = [...ctx.shopping_lists].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  if (lists.length) root.append(section(t('Listes d’épicerie'), ...lists.slice(0, 10).map((l) => el('a', { class: 'item-link card flat', href: `#/lists/${l.id}` }, el('div', { class: 'row between' }, el('strong', null, l.title), el('span', { class: 'muted' }, formatDate(l.created_at)))))));
  return root;
}

async function newMeal(ctx, { navigateTo = true } = {}) {
  const title = await promptDialog(t('Titre du repas'), { value: t('Souper') });
  if (title === null) return null;
  const meal = { id: repo.newId('meal'), title: title.trim() || t('Repas'), servings: 2, serve_at: null, constraints_snapshot: { diets: [] }, items: [] };
  await repo.save('meals', meal);
  if (navigateTo) navigate(`/meals/${meal.id}`);
  return meal;
}

// Ajouter une recette à un repas (jamais un remplacement implicite). doc = { recipe, version }.
export async function addToMealFlow(ctx, doc, { role = 'accompagnement', mainDoc = null, mealId = null } = {}) {
  let choice = mealId && ctx.meals.some((m) => m.id === mealId) ? mealId : null;
  if (!choice) {
    const options = [...ctx.meals].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 12).map((m) => ({ value: m.id, label: m.title, hint: (m.items || []).length + ' ' + t('élément(s)') }));
    options.unshift({ value: '__new__', label: t('+ Nouveau repas') });
    choice = await chooseDialog(t('Ajouter « {r} » à quel repas ?', { r: doc.recipe.display_title || doc.recipe.original_title }), options);
  }
  if (!choice) return;
  let meal = choice === '__new__' ? await newMeal(ctx, { navigateTo: false }) : ctx.meals.find((m) => m.id === choice);
  if (!meal) return;
  meal.items = meal.items || [];
  if (mainDoc && !meal.items.some((it) => it.recipe_id === mainDoc.recipe.id)) {
    meal.items.push({ id: repo.newId('mi'), recipe_id: mainDoc.recipe.id, recipe_version_id: mainDoc.version.id, role: 'plat_principal', servings: meal.servings, locked: false, position: meal.items.length + 1 });
  }
  if (meal.items.some((it) => it.recipe_version_id === doc.version?.id)) { toast(t('Déjà dans ce repas')); navigate(`/meals/${meal.id}`); return; }
  meal.items.push({ id: repo.newId('mi'), recipe_id: doc.recipe.id, recipe_version_id: doc.version?.id || null, role, servings: meal.servings, locked: false, position: meal.items.length + 1 });
  await repo.save('meals', meal);
  toast(t('Ajouté au repas'));
  navigate(`/meals/${meal.id}`);
}

export async function renderMeal(params, query, ctx, deps = {}) {
  const ctxF = await contexteFichiers(ctx);
  const meal = ctx.meals.find((m) => m.id === params.id);
  if (!meal) return el('div', { class: 'card' }, t('Repas introuvable.'));
  meal.items = meal.items || [];
  meal.constraints_snapshot = meal.constraints_snapshot || { diets: [] };
  const items = meal.items.map((it) => ({ ...it, recipe: ctx.recipesById.get(it.recipe_id), version: it.recipe_version_id ? ctx.versionsById.get(it.recipe_version_id) : null })).filter((it) => it.recipe);
  const main = items.find((it) => it.role === 'plat_principal') || items[0];
  const root = el('div', null);
  const save = async champs => {
    const changements = Object.fromEntries(champs.map(champ => [champ, structuredClone(meal[champ])]));
    try {
      await (deps.repo ?? repo).saveBatch({}, { conditions: { meals: [{ key: meal.id, fusion: courant => {
        if (!courant) throw new TransitionRefusee('meals', meal.id, undefined);
        return { ...courant, ...changements };
      } }] } });
      (deps.refresh ?? refresh)(); return true;
    } catch { (deps.toast ?? toast)(t('Les modifications du repas n’ont pas pu être enregistrées. Réessaie après rechargement.')); return false; }
  };
  root.append(pageHeader(meal.title, { back: { href: '/meals', label: t('Ma semaine') }, actions: [
    el('button', { class: 'btn', onClick: async () => { const v = await promptDialog(t('Titre'), { value: meal.title }); if (v) { meal.title = v.trim(); save(['title']); } } }, t('Renommer')),
    el('button', { class: 'btn', onClick: redo }, t('Refaire ce repas')),
  ] }));
  root.append(el('div', { class: 'card sage row' },
    field(t('Portions du repas'), el('input', { type: 'number', min: 1, value: meal.servings, onChange: async (e) => { meal.servings = Number(e.target.value) || 1; for (const it of meal.items) if (!it.servings_custom) it.servings = meal.servings; save(['servings', 'items']); } })),
    champHeureRepas(meal, deps),
    field(t('Contraintes de ce repas (invités inclus)'), el('div', { class: 'chips' }, ...DIET_TAGS.map((d) => el('span', { class: `chip clickable ${meal.constraints_snapshot.diets.includes(d) ? 'warn' : 'outline'}`, onClick: () => { const s = meal.constraints_snapshot.diets; meal.constraints_snapshot.diets = s.includes(d) ? s.filter((x) => x !== d) : [...s, d]; save(['constraints_snapshot']); } }, label('diet', d)))),
      t('Liées à ce repas seulement ; le profil personnel n’est pas modifié.'))));

  // Éléments
  const photosPersonnelles = photosPersonnellesParRecette(ctx.cook_history);
  const list = el('div', null);
  if (!items.length) list.append(emptyState('salade', t('Ajoute un plat principal depuis sa fiche, puis « Avec quoi on mange ça ? ».')));
  for (const it of items) {
    // Lot F (§ 4.2) : une vignette à gauche du titre quand les octets sont ici ; sans photo, le DOM de la carte est celui d'avant le lot. Ronde 1 : à côté
    // d'une vignette, le bloc prend la place qui reste (flex 1, min-width 0) — sans quoi l'enveloppe .row (flex-wrap) le renvoyait SOUS la vignette dès
    // que le titre ne tenait plus sur sa ligne (D-F9 : la vignette à gauche du titre) ; sans vignette, aucun style.
    const vignette = vignettePlat(it.recipe, { photo: photoPrincipale(it.recipe, photosPersonnelles), ctxF });
    const bloc = el('div', vignette ? { style: { flex: '1', minWidth: '0' } } : null, el('a', { href: `#/recipes/${it.recipe.id}?v=${it.recipe_version_id || ''}` }, el('strong', null, it.recipe.display_title || it.recipe.original_title)), ' ', versionBadge(it.version, it.recipe),
      // S8 : l'hôte d'un signet est RECALCULÉ depuis l'adresse, ici comme ailleurs — `source_label` stocké peut
      // venir d'une archive ou du serveur et nommer n'importe quel site (S7). C-2 : une fiche IA est « Créée avec l’IA », texte de
      // libelleSource rendu ici par t() (seul ce texte-là est une clé ; un libellé libre de la personne n'est jamais traduit).
      el('div', { class: 'muted', style: { fontSize: '.85rem' } }, it.recipe.origine === 'ia' ? t(libelleSource(it.recipe)) : (ctx.editionLabel(ctx.editionsById.get(it.recipe.edition_id)) || libelleSource(it.recipe))));
    const card = el('div', { class: 'card flat stack' },
      el('div', { class: 'row between top' },
        vignette ? el('div', { class: 'row top', style: { flex: '1', minWidth: '0' } }, vignette, bloc) : bloc,
        el('div', { class: 'row' },
          select(MEAL_ROLES.map((r) => ({ value: r, label: label('meal_role', r) })), it.role, (v) => { meal.items.find((x) => x.id === it.id).role = v; save(['items']); }),
          el('input', { type: 'number', min: 1, value: portionsRepas(it, meal) ?? '', placeholder: t('inconnues'), style: { width: '80px' }, title: t('Portions de cet élément'), onChange: (e) => { const x = meal.items.find((y) => y.id === it.id); x.servings = Number(e.target.value) || meal.servings; x.servings_custom = true; save(['items']); } }),
          el('button', { class: `btn small ${it.locked ? 'active' : ''}`, title: t('Verrouiller ce plat : jamais remplacé automatiquement'), onClick: () => { meal.items.find((x) => x.id === it.id).locked = !it.locked; save(['items']); } }, it.locked ? '🔒' : '🔓'),
          el('button', { class: 'btn small', disabled: it.locked, onClick: () => replaceItem(it) }, t('Remplacer')),
          el('button', { class: 'btn small danger', disabled: it.locked, onClick: async () => { if (await confirmDialog(t('Retirer « {r} » du repas ? Les autres éléments restent.', { r: it.recipe.original_title }), { okLabel: t('Retirer') })) { meal.items = meal.items.filter((x) => x.id !== it.id); save(['items']); } } }, t('Retirer')))),
      !it.version ? el('div', { class: 'status warn' }, t('Référence d’index seulement : ingrédients et durées inconnus.')) : null);
    const rappelTM = rappelThermomix(it.version); if (rappelTM) card.append(rappelTM);
    if (!gardeThermomix(it.version, portionsRepas(it, meal)).ok) card.append(el('div', { class: 'status warn', dataset: { role: 'thermomix-portions' } }, t(BLOCAGE_THERMOMIX), el('button', { class: 'btn small', onClick: async () => { const cible = meal.items.find(x => x.id === it.id); cible.servings = it.version.servings ?? null; cible.servings_custom = true; await save(['items']); } }, t('Revenir aux quantités adaptées'))));
    list.append(card);
  }
  root.append(section(t('Mon repas — {n} élément(s)', { n: items.length }), list,
    el('div', { class: 'row' },
      main ? el('a', { class: 'btn', href: `#/search${buildQuery({ for: main.recipe.id, role: 'salade', mode: 'all', meal: meal.id })}` }, t('Chercher un accompagnement')) : null,
      el('a', { class: 'btn', href: '#/search?mode=all' }, t('Choisir moi-même')))));

  // Résumé : temps, conflits, contraintes
  const summary = summarizeMeal(items.map((it) => ({ version: it.version, recipe: it.recipe, title: it.recipe.original_title })));
  const dietRows = meal.constraints_snapshot.diets.map((d) => ({ diet: d, res: assessMeal(items.filter((it) => it.version).map((it) => ({ version: it.version, title: it.recipe.original_title })), ctx.ingredientsById, d) }));
  root.append(section(t('Résumé du repas'),
    el('ul', { class: 'list plain' }, ...summary.notes.map((n) => el('li', null, n)), ...summary.conflicts.map((c) => el('li', { class: 'status warn' }, c))),
    summary.notes.length || summary.conflicts.length ? null : el('p', { class: 'muted' }, t('Aucune durée connue.')),
    ...dietRows.map((r) => el('div', { class: 'stack', style: { marginTop: '.5rem' } },
      el('div', { class: 'row' }, el('strong', null, label('diet', r.diet)), el('span', { class: `chip ${r.res.state === 'compatible' ? 'ok' : r.res.state === 'incompatible' ? 'danger' : 'warn'}` }, `${t('repas entier')} : ${label('diet_assessment', r.res.state)}`)),
      el('div', { class: 'chips' }, ...r.res.per.map((p) => el('span', { class: 'chip neutral' }, `${p.item.title} — ${label('diet_assessment', p.assessment.state)}`))),
      r.res.state !== 'compatible' ? el('small', { class: 'muted' }, t('Le périmètre compte : un accompagnement compatible ne rend pas le repas entier compatible. Adapter le plat principal est un choix explicite.')) : null)),
    el('div', { class: 'row', style: { marginTop: '.8rem' } },
      el('button', { class: 'btn primary', onClick: makeList, disabled: !items.some((it) => it.version) }, t('Liste de courses commune')),
      el('button', { class: 'btn', onClick: startCooking, disabled: !items.some((it) => it.version) }, t('Commencer la préparation')),
      el('button', { class: 'btn', onClick: feedback }, t('Noter ce repas')))));

  const fb = ctx.meal_feedback.filter((f) => f.meal_id === meal.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  if (fb.length) root.append(section(t('Retours'), el('ul', { class: 'list' }, ...fb.map((f) => el('li', null, `${formatDate(f.created_at)} · ${f.liked ? '👍' : '👎'} ${f.kind === 'pair' ? t('duo') : t('repas')} — ${f.comment || ''}`)))));
  return root;

  async function replaceItem(it) {
    const type = it.recipe.type;
    const candidates = ctx.docs.filter((d) => d.version && d.recipe.id !== it.recipe.id && (!type || d.recipe.type === type || !d.recipe.type)).sort((a, b) => (a.recipe.type === type ? -1 : 1) - (b.recipe.type === type ? -1 : 1));
    if (!candidates.length) { toast(t('Aucune autre recette disponible')); return; }
    const id = await chooseDialog(t('Remplacer « {r} » par :', { r: it.recipe.original_title }), candidates.slice(0, 200).map((d) => ({ value: d.recipe.id, label: d.recipe.display_title || d.recipe.original_title, hint: d.recipe.type ? label('recipe_type', d.recipe.type) : '' })));
    if (!id) return;
    const d = ctx.docsByRecipe.get(id);
    const x = meal.items.find((y) => y.id === it.id);
    x.recipe_id = d.recipe.id; x.recipe_version_id = d.version.id;
    if (!(await save(['items']))) return;
    toast(t('Élément remplacé ; portions, courses et contraintes recalculées.'));
  }
  async function makeList() {
    const list = { id: repo.newId('sl'), title: `${meal.title} — ${t('courses')}`, meal_id: meal.id, items: items.filter((it) => it.version).map((it) => ({ recipe_id: it.recipe.id, recipe_version_id: it.version.id, servings: it.servings || meal.servings, title: it.recipe.display_title || it.recipe.original_title })), checked: {} };
    await repo.save('shopping_lists', list);
    navigate(`/lists/${list.id}`);
  }
  async function startCooking() {
    const R = deps.repo ?? repo;
    try {
      const actuelle = await R.get('meals', meal.id);
      if (!actuelle) return;
      const withV = (await Promise.all((actuelle.items || []).map(async it => ({ ...it, version: it.recipe_version_id ? await R.get('recipe_versions', it.recipe_version_id) : null })))).filter(it => it.version);
      if (!withV.length) return;
      if (withV.some(it => !gardeThermomix(it.version, portionsRepas(it, actuelle)).ok)) { (deps.toast ?? toast)(t(BLOCAGE_THERMOMIX)); return; }
      const session = { id: R.newId('cs'), recipe_id: withV[0].recipe_id, meal_id: meal.id, selected_version_ids: withV.map(it => it.version.id), servings_by_version: Object.fromEntries(withV.map(it => [it.version.id, portionsRepas(it, actuelle)])), servings: actuelle.servings, progress: { done_step_ids: [], by_version: {}, total_steps: withV.reduce((n, it) => n + (it.version.steps || []).length, 0) }, started_at: R.nowIso(), active_device_id: deviceId(), status: 'active', units: ctx.settings.units };
      await enregistrerSessionCuisine(session, { repo: R });
      (deps.navigate ?? navigate)(`/cook/${session.id}`);
    } catch { (deps.toast ?? toast)(t(BLOCAGE_THERMOMIX)); }
  }
  async function feedback() {
    const liked = await chooseDialog(t('Ce repas ?'), [{ value: 'yes', label: t('Excellent — à refaire') }, { value: 'no', label: t('Pas convaincant') }]);
    if (!liked) return;
    const comment = await promptDialog(t('Commentaire (facultatif)'), { multiline: true });
    const rows = [{ id: repo.newId('mf'), meal_id: meal.id, kind: 'meal', liked: liked === 'yes', comment: comment || '', recipe_ids: items.map((it) => it.recipe.id), version_ids: items.map((it) => it.recipe_version_id), created_at: repo.nowIso() }];
    if (liked === 'yes' && main) for (const it of items) if (it.id !== main.id) rows.push({ id: repo.newId('mf'), meal_id: meal.id, kind: 'pair', liked: true, comment: comment || '', recipe_ids: [main.recipe.id, it.recipe.id], version_ids: [main.recipe_version_id, it.recipe_version_id], created_at: repo.nowIso() });
    await repo.saveBatch({ meal_feedback: rows });
    toast(liked === 'yes' ? t('Duo mémorisé avec son contexte') : t('Retour enregistré'));
    refresh();
  }
  async function redo() {
    const copy = { ...structuredClone(meal), id: repo.newId('meal'), title: `${meal.title} (${t('refait')})`, serve_at: null, created_at: undefined, updated_at: undefined };
    copy.items = copy.items.map((it) => ({ ...it, id: repo.newId('mi') }));
    await repo.save('meals', copy);
    toast(t('Repas recopié avec ses versions exactes ; l’historique est conservé.'));
    navigate(`/meals/${copy.id}`);
  }
}

export { RECIPE_TYPES };

// Une heure ambiguë doit pouvoir être choisie AVANT l’écriture. Seule cette donnée est fusionnée dans le repas relu.
function champHeureRepas(meal, deps) {
  const R = deps.repo ?? repo;
  const initial = meal.serve_at ?? null;
  const initialLocal = formaterHeureLocale(initial);
  const saisie = el('input', { type: 'datetime-local', value: initialLocal, step: 60, onInput: actualiser, onChange: actualiser });
  const choix = el('div', { class: 'stack' });
  const statut = el('p', { class: 'muted', role: 'status', style: { margin: '0' } });
  let occurrences = [], selection = null, enregistrement = false;
  const enregistrer = el('button', { type: 'button', class: 'btn small', onClick: conserver }, t('Enregistrer l’heure'));
  const racine = el('div', { class: 'stack', dataset: { role: 'heure-repas' }, style: { minWidth: '0' } }, field(t('Servi le'), saisie), choix, statut, enregistrer);
  actualiser();
  return racine;

  function actualiser() {
    const resultat = analyserHeureLocale(saisie.value);
    occurrences = resultat.occurrences;
    const invalide = saisie.validity.badInput || !['vide', 'valide'].includes(resultat.etat);
    saisie.setAttribute('aria-invalid', String(invalide));
    enregistrer.disabled = invalide || enregistrement;
    choix.replaceChildren();
    if (invalide) {
      selection = null;
      statut.textContent = resultat.etat === 'inexistante' ? t('Cette heure n’existe pas dans le fuseau de cet appareil. Choisis une autre heure.') : t('Saisis une date et une heure valides.');
      return;
    }
    const gardeInitial = initial && saisie.value === initialLocal && Number.isFinite(Date.parse(initial));
    const correspondance = gardeInitial ? occurrences.find(x => new Date(x.iso).getTimezoneOffset() === new Date(initial).getTimezoneOffset()) : null;
    selection = correspondance?.iso ?? occurrences[0]?.iso ?? null;
    statut.textContent = occurrences.length > 1 ? t('Cette heure se produit deux fois. Choisis le décalage avant d’enregistrer.') : t('Heure locale de cet appareil.');
    if (occurrences.length > 1) {
      // Le select natif peut tronquer son option sur un téléphone : le décalage choisi reste lisible en dehors du contrôle.
      const retenu = el('small', { dataset: { role: 'decalage-repas' } });
      const afficherDecalage = () => { const x = occurrences.find(o => o.iso === selection); retenu.textContent = x ? t('Décalage choisi : {decalage}', { decalage: decalageUTC(x.offset_minutes) }) : ''; };
      const menu = select(occurrences.map((x, i) => ({ value: x.iso, label: i === 0 ? t('Première occurrence ({decalage})', { decalage: decalageUTC(x.offset_minutes) }) : t('Seconde occurrence ({decalage})', { decalage: decalageUTC(x.offset_minutes) }) })), selection, value => { selection = value; afficherDecalage(); });
      afficherDecalage();
      choix.append(field(t('Occurrence de l’heure'), menu), retenu);
    }
  }

  async function conserver() {
    if (enregistrement || enregistrer.disabled) return;
    const resultat = analyserHeureLocale(saisie.value);
    if (saisie.validity.badInput || !['vide', 'valide'].includes(resultat.etat)) { actualiser(); return; }
    let instant = resultat.etat === 'vide' ? null : resultat.occurrences.find(x => x.iso === selection)?.iso;
    if (instant === undefined) { actualiser(); return; }
    // Un formulaire à la minute ne doit pas effacer des secondes existantes ni changer l’occurrence choisie auparavant.
    if (initial && saisie.value === initialLocal && instant && new Date(instant).getTimezoneOffset() === new Date(initial).getTimezoneOffset()) instant = initial;
    enregistrement = true; enregistrer.disabled = true; saisie.disabled = true;
    for (const menu of choix.querySelectorAll('select')) menu.disabled = true;
    try {
      await R.saveBatch({}, { conditions: { meals: [{ key: meal.id, fusion: courant => {
        if (!courant || (courant.serve_at ?? null) !== initial) throw new TransitionRefusee('meals', meal.id, courant?.status);
        return { ...courant, serve_at: instant };
      } }] } });
      meal.serve_at = instant;
      statut.textContent = t('Heure du repas enregistrée.');
      (deps.refresh ?? refresh)();
    } catch (e) {
      statut.textContent = e instanceof TransitionRefusee ? t('Ce repas a changé ou n’est plus disponible. Recharge sa fiche avant de réessayer.') : t('L’heure n’a pas pu être enregistrée. Ta saisie est conservée.');
    } finally {
      enregistrement = false; enregistrer.disabled = false; saisie.disabled = false;
      for (const menu of choix.querySelectorAll('select')) menu.disabled = false;
    }
  }
}
