import { capturerRecette } from './recette-garde.js';
import { recetteActiveDansContexte } from './state.js';
import { mentionCycleRecette, TEXTE_NOUVEL_USAGE_REFUSE } from './corbeille.js';
import { documentsActifs } from './state.js';
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
import { groupesRepas,jourRepas,jourCivilValide,portionsSaisies,fusionChampsRepas,itemsCoursesRepas,empreinteBaseCourses,validerVolumeRepas } from '../domain/repas-courses.js';
import {creerGardeRepas,protectionFormulaireRepas} from './repas-garde.js';
import {protegerSortieEditeur} from './sortie-editeur.js';
import {lienAvecOrigine} from './navigation-contexte.js';

export async function renderMeals(params, query, ctx) {
  const root=el('div',{class:'repas-groupes'},pageHeader(t('Repas'),{actions:[el('button',{class:'btn primary',onClick:()=>newMeal(ctx)},t('Nouveau repas'))]}));
  const labels={envies:t('À cuisiner bientôt'),prevus:t('Prévus'),passes:t('Passés'),archives:t('Archives')};
  if(!ctx.meals.length)root.append(emptyState('couverts',t('Aucun repas composé. Depuis une recette : « Ajouter à mon repas » ou « Avec quoi on mange ça ? ».')));
  for(const g of groupesRepas(ctx.meals)){if(!g.rows.length)continue;const body=el('div',{class:'stack'},...g.rows.map(m=>el('a',{class:'item-link card flat',href:lienAvecOrigine('/meals/'+encodeURIComponent(m.id))},el('div',{class:'row between'},el('strong',null,m.title||t('Repas')),el('span',{class:'muted'},m.serve_at?formatDate(m.serve_at,{withTime:true}):jourRepas(m)||t('Sans date'))),el('div',{class:'muted'},(m.items||[]).map(it=>ctx.recipesById.get(it.recipe_id)?.display_title||ctx.recipesById.get(it.recipe_id)?.original_title||t('Recette indisponible')).join(' · ')))));
   root.append(g.id==='archives'?el('details',{class:'card'},el('summary',null,labels[g.id]),body):section(labels[g.id],body));}
  const lists=[...ctx.shopping_lists].sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));if(lists.length)root.append(section(t('Courses'),...lists.slice(0,10).map(l=>el('a',{class:'item-link card flat',href:lienAvecOrigine('/lists/'+encodeURIComponent(l.id))},el('strong',null,l.title||t('Courses')),el('span',{class:'muted'},formatDate(l.created_at))))));
  return root;
}

async function newMeal(ctx, { navigateTo = true } = {}) {
  const garde=creerGardeRepas(repo,ctx);
  const title = await promptDialog(t('Titre du repas'), { value: t('Souper') });
  if (title === null) return null;
  const meal = { id: repo.newId('meal'), title: title.trim() || t('Repas'), servings: 2, serve_at: null, constraints_snapshot: { diets: [] }, items: [] };
  await repo.save('meals',validerVolumeRepas(meal),await garde.options({meals:[{key:meal.id,absente:true}]}));
  if (navigateTo) navigate(`/meals/${meal.id}`);
  return meal;
}

// Ajouter une recette à un repas (jamais un remplacement implicite). doc = { recipe, version }.
export async function addToMealFlow(ctx, doc, { role = 'accompagnement', mainDoc = null, mealId = null, repo: R = repo, toast: dire = toast, navigate: nav = navigate } = {}) {
  const garde=creerGardeRepas(R,ctx),source=structuredClone(doc),principal=mainDoc?structuredClone(mainDoc):null;
  doc=source;mainDoc=principal;
  try {
  const cibles = [...new Map([doc, mainDoc].filter(Boolean).map(d => [d.recipe.id,d.recipe])).values()];
  if (cibles.some(r => !recetteActiveDansContexte(r, ctx))) { dire(t(TEXTE_NOUVEL_USAGE_REFUSE)); return; }
  const recettes = await Promise.all(cibles.map(r => capturerRecette(R, r, {ctx})));
  let choice = mealId && ctx.meals.some((m) => m.id === mealId) ? mealId : null;
  if (!choice) {
    const options = ctx.meals.filter(m=>!m.archived_at).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 12).map((m) => ({ value: m.id, label: m.title, hint: (m.items || []).length + ' ' + t('élément(s)') }));
    options.unshift({ value: '__new__', label: t('+ Nouveau repas') });
    choice = await chooseDialog(t('Ajouter « {r} » à quel repas ?', { r: doc.recipe.display_title || doc.recipe.original_title }), options);
  }
  if (!choice) return;
  let meal = choice === '__new__' ? null : structuredClone(ctx.meals.find((m) => m.id === choice));
  if (choice === '__new__') { const titre = await promptDialog(t('Nom du repas'), {value:t('Repas')}); if (titre === null) return; meal={id:R.newId('meal'),title:titre.trim()||t('Repas'),servings:2,serve_at:null,constraints_snapshot:{diets:[]},items:[]}; }
  if (!meal) return;
  const baseMeal=choice==='__new__'?null:structuredClone(meal);
  meal.items = meal.items || [];
  if(meal.items.length>=100)throw Error('limite_repas');
  if (mainDoc && !meal.items.some((it) => it.recipe_id === mainDoc.recipe.id)) {
    meal.items.push({ id: R.newId('mi'), recipe_id: mainDoc.recipe.id, recipe_version_id: mainDoc.version.id, role: 'plat_principal', servings: meal.servings??null, servings_custom:false, locked: false, position: meal.items.length + 1 });
  }
  if (meal.items.some((it) => it.recipe_id===doc.recipe.id&&(it.recipe_version_id??null)===(doc.version?.id??null))) { toast(t('Déjà dans ce repas')); navigate(`/meals/${meal.id}`); return; }
  meal.items.push({ id: R.newId('mi'), recipe_id: doc.recipe.id, recipe_version_id: doc.version?.id || null, role, servings: meal.servings??null, servings_custom:false, locked: false, position: meal.items.length + 1 });
  const idsActifs = new Set(recettes.map(c => c.recipe_id));
  const anciennes = [...new Set((meal.items || []).map(it => it.recipe_id))].filter(id => !idsActifs.has(id));
  recettes.push(...await Promise.all(anciennes.map(id => capturerRecette(R, ctx.recipesById.get(id), {ctx,historique:true}))));
  if(meal.items.length>100)throw Error('limite_repas');
  const versions=[doc,mainDoc].filter(d=>d?.version).map(d=>({key:d.version.id,fusion:r=>{if(JSON.stringify(r)!==JSON.stringify(d.version))throw Error('version_changee');return null;}}));
  if(baseMeal)await R.saveBatch({},await garde.options({meals:[{key:meal.id,fusion:fusionChampsRepas(baseMeal,{items:meal.items})}],recipe_versions:versions},recettes));
  else await R.save('meals',validerVolumeRepas(meal),await garde.options({meals:[{key:meal.id,absente:true}],recipe_versions:versions},recettes));
  dire(t('Ajouté au repas'));
  nav(`/meals/${meal.id}`);
  } catch { dire(t(TEXTE_NOUVEL_USAGE_REFUSE)); }
}

export async function renderMeal(params, query, ctx, deps = {}) {
  const ctxF = await contexteFichiers(ctx);
  const meal = ctx.meals.find((m) => m.id === params.id);
  if (!meal) return el('div', { class: 'card' }, t('Repas introuvable.'));
  let creationListe=null,envoiListe=false,copieRepas=null,recopieEnCours=false;
  const mealAffiche = structuredClone(meal);
  let confirme=structuredClone(mealAffiche),dispose=false;const planification={serve_at:meal.serve_at??null,planned_on:meal.planned_on??null};
  const R={...repo,...(deps.repo||{})},garde=creerGardeRepas(R,ctx,()=>!dispose);
  meal.items = meal.items || [];
  meal.constraints_snapshot = meal.constraints_snapshot || { diets: [] };
  const items = meal.items.map((it) => ({ ...it, recipe: ctx.recipesById.get(it.recipe_id), version: it.recipe_version_id ? ctx.versionsById.get(it.recipe_version_id) : null }));
  const mentions = items.filter(it=>it.recipe&&!recetteActiveDansContexte(it.recipe, ctx)).map(it=>mentionCycleRecette(it.recipe, ctx?.editionsById?.get(it.recipe.edition_id)));
  const main = items.find((it) => it.recipe&&it.role === 'plat_principal') || items.find(it=>it.recipe);
  const root = el('div', {class:'repas-fiche'}),saisie=protectionFormulaireRepas(root,()=>[...root.querySelectorAll('input')].map(i=>i.value).join('\n')),liberer=protegerSortieEditeur({racine:root,controleur:saisie.controleur});root.dispose=()=>{dispose=true;liberer();};root.flushEditeur=()=>saisie.controleur.flush();root.etatEditeur=saisie.controleur.etat;
  const save = async (champs, recettes = []) => {
    const attendu=structuredClone(confirme);const generations=new Map(champs.map(k=>[k,saisie.modifier(k)]));
    const changements = Object.fromEntries(champs.map(champ => [champ, structuredClone(meal[champ])]));
    try {
      const actifs = new Set(recettes.map(c => c.recipe_id));
      recettes = [...recettes, ...await contextesHistoriques(actifs)];
      await R.saveBatch({},await garde.options({meals:[{key:meal.id,fusion:fusionChampsRepas(attendu,changements)}]},recettes));
      confirme={...confirme,...structuredClone(changements)};for(const[k,n]of generations)saisie.confirmer(k,n);
      (deps.refresh ?? refresh)(); return true;
    } catch { (deps.toast ?? toast)(t('Les modifications du repas n’ont pas pu être enregistrées. Réessaie après rechargement.')); return false; }
  };
  root.append(pageHeader(meal.title, { back: { href: '/meals', label: t('Ma semaine') }, actions: [
    el('button', { class: 'btn', onClick: async () => { const v = await promptDialog(t('Titre'), { value: meal.title }); if (v) { meal.title = v.trim(); save(['title']); } } }, t('Renommer')),
    el('button', { class: 'btn', onClick: redo }, t('Refaire ce repas')),
    el('button',{class:'btn',onClick:async()=>{meal.archived_at=meal.archived_at?null:R.nowIso();await save(['archived_at']);}},meal.archived_at?t('Rouvrir ce repas'):t('Archiver ce repas')),
  ] }));
  root.append(el('div', { class: 'card sage row' },
    field(t('Portions du repas'), el('input', { type: 'number', min: 1, value: meal.servings??'', placeholder:t('inconnues'), onChange: async (e) => { try{meal.servings=portionsSaisies(e.target.value);for(const it of meal.items)if(!it.servings_custom){it.servings=meal.servings;it.servings_custom=false;}await save(['servings','items']);}catch{(deps.toast??toast)(t('Indique des portions valides ou laisse vide.'));} } })),
    champPlanificationRepas(meal,{...deps,repo:R,garde,saisie,planification,capturerHistorique:contextesHistoriques}),
    champHeureRepas(meal, {...deps,repo:R,garde,saisie,planification,capturerHistorique:contextesHistoriques}),
    field(t('Contraintes de ce repas (invités inclus)'), el('div', { class: 'chips' }, ...DIET_TAGS.map((d) => el('span', { class: `chip clickable ${meal.constraints_snapshot.diets.includes(d) ? 'warn' : 'outline'}`, onClick: () => { const s = meal.constraints_snapshot.diets; meal.constraints_snapshot.diets = s.includes(d) ? s.filter((x) => x !== d) : [...s, d]; save(['constraints_snapshot']); } }, label('diet', d)))),
      t('Liées à ce repas seulement ; le profil personnel n’est pas modifié.'))));

  root.append(...mentions);
  // Éléments
  const photosPersonnelles = photosPersonnellesParRecette(ctx.cook_history);
  const list = el('div', null);
  if (!items.length) list.append(emptyState('salade', t('Ajoute un plat principal depuis sa fiche, puis « Avec quoi on mange ça ? ».')));
  for (const it of items) {
    if(!it.recipe){list.append(el('div',{class:'card status warn'},t('Recette indisponible'),el('button',{class:'btn',onClick:async()=>{meal.items=meal.items.filter(x=>x.id!==it.id);await save(['items']);}},t('Retirer'))));continue;}
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
          el('input', { type: 'number', min: 1, value: portionsRepas(it, meal) ?? '', placeholder: t('inconnues'), style: { width: '80px' }, title: t('Portions de cet élément'), onChange: (e) => { const x = meal.items.find((y) => y.id === it.id); try{x.servings=portionsSaisies(e.target.value);x.servings_custom=true;save(['items']);}catch{(deps.toast??toast)(t('Indique des portions valides ou laisse vide.'));} } }),
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
      el('a', { class: 'btn', href: '#/search'+buildQuery({mode:'all',meal:meal.id}) }, t('Ajouter un plat')))));

  // Résumé : temps, conflits, contraintes
  const summary = summarizeMeal(items.filter(it=>it.recipe).map((it) => ({ version: it.version, recipe: it.recipe, title: it.recipe.original_title })));
  const dietRows = meal.constraints_snapshot.diets.map((d) => ({ diet: d, res: assessMeal(items.filter((it) => it.version&&it.recipe).map((it) => ({ version: it.version, title: it.recipe.original_title })), ctx.ingredientsById, d) }));
  root.append(section(t('Résumé du repas'),
    el('ul', { class: 'list plain' }, ...summary.notes.map((n) => el('li', null, n)), ...summary.conflicts.map((c) => el('li', { class: 'status warn' }, c))),
    summary.notes.length || summary.conflicts.length ? null : el('p', { class: 'muted' }, t('Aucune durée connue.')),
    ...dietRows.map((r) => el('div', { class: 'stack', style: { marginTop: '.5rem' } },
      el('div', { class: 'row' }, el('strong', null, label('diet', r.diet)), el('span', { class: `chip ${r.res.state === 'compatible' ? 'ok' : r.res.state === 'incompatible' ? 'danger' : 'warn'}` }, `${t('repas entier')} : ${label('diet_assessment', r.res.state)}`)),
      el('div', { class: 'chips' }, ...r.res.per.map((p) => el('span', { class: 'chip neutral' }, `${p.item.title} — ${label('diet_assessment', p.assessment.state)}`))),
      r.res.state !== 'compatible' ? el('small', { class: 'muted' }, t('Le périmètre compte : un accompagnement compatible ne rend pas le repas entier compatible. Adapter le plat principal est un choix explicite.')) : null)),
    el('div', { class: 'row', style: { marginTop: '.8rem' } },
      el('button', { class: 'btn primary', onClick: makeList, disabled: !items.some((it) => it.version) }, t('Voir mes courses')),
      el('button', { class: 'btn', onClick: startCooking, disabled: !items.some((it) => it.version) }, t('Cuisiner ensemble')),
      el('button', { class: 'btn', onClick: feedback }, t('Noter ce repas')))));

  const fb = ctx.meal_feedback.filter((f) => f.meal_id === meal.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  if (fb.length) root.append(section(t('Retours'), el('ul', { class: 'list' }, ...fb.map((f) => el('li', null, `${formatDate(f.created_at)} · ${f.liked ? '👍' : '👎'} ${f.kind === 'pair' ? t('duo') : t('repas')} — ${f.comment || ''}`)))));
  return root;

  async function replaceItem(it) {
    const type = it.recipe.type;
    const candidates = documentsActifs(ctx).filter((d) => d.version && d.recipe.id !== it.recipe.id && (!type || d.recipe.type === type || !d.recipe.type)).sort((a, b) => (a.recipe.type === type ? -1 : 1) - (b.recipe.type === type ? -1 : 1));
    if (!candidates.length) { toast(t('Aucune autre recette disponible')); return; }
    try {
    const contextes = new Map(await Promise.all(candidates.slice(0,200).map(async d => [d.recipe.id, await capturerRecette(deps.repo ?? repo, d.recipe, {ctx})])));
    const id = await chooseDialog(t('Remplacer « {r} » par :', { r: it.recipe.original_title }), candidates.slice(0, 200).map((d) => ({ value: d.recipe.id, label: d.recipe.display_title || d.recipe.original_title, hint: d.recipe.type ? label('recipe_type', d.recipe.type) : '' })));
    if (!id) return;
    const d = ctx.docsByRecipe.get(id);
    const x = meal.items.find((y) => y.id === it.id);
    x.recipe_id = d.recipe.id; x.recipe_version_id = d.version.id;
    if (!(await save(['items'], [contextes.get(id)]))) return;
    toast(t('Élément remplacé. Les courses existantes restent conservées.'));
    } catch { (deps.toast ?? toast)(t(TEXTE_NOUVEL_USAGE_REFUSE)); }
  }
  async function makeList() {
   if(envoiListe)return;envoiListe=true;
   try{
    const existantes=(ctx.shopping_lists||[]).filter(l=>l.meal_id===meal.id);if(existantes.length){let id=existantes[0].id;if(existantes.length>1)id=await(deps.chooseDialog??chooseDialog)(t('Choisis une liste de courses'),existantes.map(l=>({value:l.id,label:l.title||t('Courses'),hint:formatDate(l.created_at)})));if(id)(deps.navigate??navigate)(`/lists/${id}`);return;}
    const recettes=await contextesActifs(),entries=itemsCoursesRepas(mealAffiche,ctx);if(entries.some(it=>it.recipe_version_id&&!ctx.versionsById.get(it.recipe_version_id)))throw Error('version_absente');if(entries.some(it=>it.recipe_version_id&&!gardeThermomix(ctx.versionsById.get(it.recipe_version_id),it.servings).ok))throw Error('thermomix_invalide');
    creationListe??={id:R.newId('sl'),title:`${meal.title} — ${t('courses')}`,meal_id:meal.id,items:entries,checked:{},manual_lines:[],row_overrides:{},meal_basis_sha256:await empreinteBaseCourses(entries)};
    await R.saveBatch({},await garde.options({recipe_versions:entries.filter(it=>it.recipe_version_id).map(it=>{const v=structuredClone(ctx.versionsById.get(it.recipe_version_id));return{key:it.recipe_version_id,fusion:c=>{if(JSON.stringify(c)!==JSON.stringify(v))throw Error('version_changee');return null;}};}),meals:[{key:meal.id,fusion:current=>{if(JSON.stringify(current?.items)!==JSON.stringify(mealAffiche.items)||current?.servings!==mealAffiche.servings)throw Error('contenu_change');return null;}}],shopping_lists:[{key:creationListe.id,fusion:r=>{if(r){if(JSON.stringify(r.items)!==JSON.stringify(creationListe.items))throw Error('contenu_change');return null;}return validerVolumeRepas(creationListe);}}]},recettes));(deps.navigate??navigate)(`/lists/${creationListe.id}`);
   }catch{(deps.toast??toast)(t(TEXTE_NOUVEL_USAGE_REFUSE));}finally{envoiListe=false;}
  }
  async function contextesHistoriques(exclus = new Set()) {
    const sources = new Map(items.filter(it => it.recipe&&!exclus.has(it.recipe.id)).map(it => [it.recipe.id, it.recipe]));
    return Promise.all([...sources.values()].map(r => capturerRecette(deps.repo ?? repo, r, {ctx, historique:true})));
  }
  async function contextesActifs() {
    if (items.some(it => !it.recipe||!recetteActiveDansContexte(it.recipe, ctx))) throw new Error('recette_retiree');
    return Promise.all([...new Map(items.map(it => [it.recipe.id,it.recipe])).values()].map(r => capturerRecette(deps.repo ?? repo, r, {ctx})));
  }
  async function startCooking() {
    const R = deps.repo ?? repo;
    const affiche = structuredClone(mealAffiche), sources = structuredClone(items);
    try {
      const recettes = await contextesActifs();
      if (sources.some(it => it.recipe_version_id && !it.version) || sources.length !== (affiche.items || []).length) throw new Error('version_absente');
      const withV = sources.filter(it => it.version);
      if (!withV.length) return;
      if (withV.some(it => !gardeThermomix(it.version, portionsRepas(it, affiche)).ok)) { (deps.toast ?? toast)(t(BLOCAGE_THERMOMIX)); return; }
      const session = { id: R.newId('cs'), recipe_id: withV[0].recipe_id, meal_id: affiche.id, selected_version_ids: withV.map(it => it.version.id), active_version_id: withV[0].version.id, servings_by_version: Object.fromEntries(withV.map(it => [it.version.id, portionsRepas(it, affiche)])), servings: affiche.servings ?? null, progress: { done_step_ids: [], by_version: {}, total_steps: withV.reduce((n, it) => n + (it.version.steps || []).length, 0) }, started_at: R.nowIso(), active_device_id: deviceId(), status: 'active', units: ctx.settings?.units || 'original', lang: ctx.settings?.reading_locale || 'original' };
      await enregistrerSessionCuisine(session, { repo: R, recettes, versionsAffichees:withV.map(it => it.version), repasAffiche:affiche });
      (deps.navigate ?? navigate)(`/cook/${session.id}`);
    } catch { (deps.toast ?? toast)(t(TEXTE_NOUVEL_USAGE_REFUSE)); }
  }
  async function feedback() {
    try {
    const recettes = await contextesHistoriques();
    const liked = await chooseDialog(t('Ce repas ?'), [{ value: 'yes', label: t('Excellent — à refaire') }, { value: 'no', label: t('Pas convaincant') }]);
    if (!liked) return;
    const comment = await promptDialog(t('Commentaire (facultatif)'), { multiline: true });
    const rows = [{ id: repo.newId('mf'), meal_id: meal.id, kind: 'meal', liked: liked === 'yes', comment: comment || '', recipe_ids: items.map((it) => it.recipe.id), version_ids: items.map((it) => it.recipe_version_id), created_at: repo.nowIso() }];
    if (liked === 'yes' && main) for (const it of items) if (it.id !== main.id) rows.push({ id: repo.newId('mf'), meal_id: meal.id, kind: 'pair', liked: true, comment: comment || '', recipe_ids: [main.recipe.id, it.recipe.id], version_ids: [main.recipe_version_id, it.recipe_version_id], created_at: repo.nowIso() });
    await (deps.repo ?? repo).saveBatch({ meal_feedback: rows }, {recettes});
    toast(liked === 'yes' ? t('Duo mémorisé avec son contexte') : t('Retour enregistré'));
    refresh();
    } catch { (deps.toast ?? toast)(t('La recette a changé. Recharge sa fiche avant de réessayer.')); }
  }
  async function redo() {
    if(recopieEnCours)return;recopieEnCours=true;
    try {
    const recettes = await contextesActifs();
    const copy = copieRepas||{ ...structuredClone(meal), id: R.newId('meal'), title: `${meal.title} (${t('refait')})`, serve_at: null, planned_on:null, archived_at:null };
    delete copy.created_at;delete copy.updated_at;
    if(!copieRepas)copy.items = copy.items.map((it) => ({ ...it, id: R.newId('mi') }));copieRepas=copy;
    await R.save('meals',validerVolumeRepas(copy),await garde.options({meals:[{key:copy.id,absente:true}]},recettes));
    toast(t('Repas recopié avec ses versions exactes ; l’historique est conservé.'));
    (deps.navigate ?? navigate)(`/meals/${copy.id}`);
    } catch { (deps.toast ?? toast)(t(TEXTE_NOUVEL_USAGE_REFUSE)); }finally{recopieEnCours=false;}
  }
}

export { RECIPE_TYPES };

// Une heure ambiguë doit pouvoir être choisie AVANT l’écriture. Seule cette donnée est fusionnée dans le repas relu.
function champHeureRepas(meal, deps) {
  const R = deps.repo ?? repo;
  const planification=deps.planification||{serve_at:meal.serve_at??null,planned_on:meal.planned_on??null};let initial=planification.serve_at;
  let initialLocal = formaterHeureLocale(initial);
  const saisie = el('input', { type: 'datetime-local', value: initialLocal, step: 60, onInput: actualiser, onChange: actualiser });
  const choix = el('div', { class: 'stack' });
  const statut = el('p', { class: 'muted', role: 'status', style: { margin: '0' } });
  let occurrences = [], selection = null, enregistrement = false;
  const enregistrer = el('button', { type: 'button', class: 'btn small', onClick: conserver }, t('Enregistrer l’heure'));
  const racine = el('div', { class: 'stack', dataset: { role: 'heure-repas' }, style: { minWidth: '0' } }, field(t('Servi le'), saisie), choix, statut, enregistrer);
  actualiser();
  return racine;

  function actualiser(event) {
    if(event)deps.saisie?.modifier('heure');
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
    const attendu=structuredClone(planification);enregistrement = true; enregistrer.disabled = true; saisie.disabled = true;
    for (const menu of choix.querySelectorAll('select')) menu.disabled = true;
    try {
      const recettes = deps.capturerHistorique ? await deps.capturerHistorique() : [];
      await R.saveBatch({}, await deps.garde.options({ meals: [{ key: meal.id, fusion: courant => {
        if (!courant || (courant.serve_at ?? null) !== attendu.serve_at || (courant.planned_on??null)!==attendu.planned_on) throw new TransitionRefusee('meals', meal.id, courant?.status);
        return validerVolumeRepas({ ...courant, serve_at: instant, planned_on:null });
      } }] },recettes));
      meal.serve_at = instant;meal.planned_on=null;Object.assign(planification,{serve_at:instant,planned_on:null});initial=instant;initialLocal=formaterHeureLocale(instant);deps.saisie?.confirmer('heure');
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

function champPlanificationRepas(meal,deps){
 const initial=deps.planification||{serve_at:meal.serve_at??null,planned_on:meal.planned_on??null},input=el('input',{type:'date',value:initial.planned_on||'',dataset:{role:'jour-repas'},onInput:()=>deps.saisie?.modifier('jour')}),statut=el('p',{role:'status',class:'muted'});let busy=false;
 const conserver=async(effacer=false)=>{if(busy)return;const jour=effacer?null:input.value||null;if(jour&&!jourCivilValide(jour)){statut.textContent=t('Choisis un jour valide.');return;}const attendu=structuredClone(initial),generation=deps.saisie?.generation('jour');busy=true;input.disabled=true;try{const recettes=await deps.capturerHistorique();await deps.repo.saveBatch({},await deps.garde.options({meals:[{key:meal.id,fusion:c=>{if(!c||(c.serve_at??null)!==attendu.serve_at||(c.planned_on??null)!==attendu.planned_on)throw Error('contenu_change');return validerVolumeRepas({...c,serve_at:null,planned_on:jour});}}]},recettes));Object.assign(initial,{serve_at:null,planned_on:jour});meal.serve_at=null;meal.planned_on=jour;deps.saisie?.confirmer('jour',generation);statut.textContent=t('Date du repas enregistrée.');(deps.refresh??refresh)();}catch{statut.textContent=t('Ce repas a changé ou n’est plus disponible. Recharge sa fiche avant de réessayer.');}finally{busy=false;input.disabled=false;}};
 return el('div',{class:'repas-planification stack'},field(t('Planifier — jour sans heure'),input),el('div',{class:'row'},el('button',{class:'btn small',dataset:{role:'enregistrer-jour'},onClick:()=>conserver()},t('Enregistrer le jour')),el('button',{class:'btn small',onClick:()=>conserver(true)},t('Retirer la date'))),statut);
}

export function boutonEnvie(ctx,doc,deps={}){
 const R={...repo,...(deps.repo||{})},source=structuredClone(doc);let detruit=false,busy=false,termine=false,meal=null;const garde=creerGardeRepas(R,ctx,()=>!detruit);
 const b=el('button',{class:'btn small',dataset:{role:'garder-envie'},onClick:async e=>{e.preventDefault();e.stopPropagation();if(busy||termine)return;busy=true;b.disabled=true;try{
  const recettes=[await capturerRecette(R,source.recipe,{ctx})];meal??={id:R.newId('meal'),title:source.recipe.display_title||source.recipe.original_title||t('Repas'),servings:null,serve_at:null,planned_on:null,archived_at:null,constraints_snapshot:{diets:[]},items:[{id:R.newId('mi'),recipe_id:source.recipe.id,recipe_version_id:source.version?.id??null,role:'plat_principal',servings:null,servings_custom:false,locked:false,position:1}]};
  await R.saveBatch({},await garde.options({meals:[{key:meal.id,fusion:c=>{if(c){if(JSON.stringify(c.items)!==JSON.stringify(meal.items))throw Error('contenu_change');return null;}return validerVolumeRepas(meal);}}],...(source.version?{recipe_versions:[{key:source.version.id,fusion:c=>{if(JSON.stringify(c)!==JSON.stringify(source.version))throw Error('version_changee');return null;}}]}:{})},recettes));termine=true;(deps.toast??toast)(t('Envie enregistrée.'));
 }catch{(deps.toast??toast)(t('L’envie n’a pas pu être enregistrée. Réessaie.'));}finally{busy=false;b.disabled=termine;}}},t('À cuisiner bientôt'));b.dispose=()=>{detruit=true;};return b;
}
