// La traduction manuelle conserve ses gardes L0 ; le formulaire culinaire utilise les brouillons L4.
import { retourConnu, porteeNavigation } from './navigation-contexte.js';
import { destinationApresRecette } from './actions-contenu.js';
import { recetteActiveDansContexte } from './state.js';
import { mentionCycleRecette } from './corbeille.js';
import { el, toast } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate } from '../core/router.js';
import { TransitionRefusee } from '../core/db.js';
import * as repo from '../model/repo.js';
import { parseIngredientLine } from '../domain/lines.js';
import { currentVersion } from '../domain/search.js';
import { pageHeader, field } from './components.js';
import { lireTraduction, verifierSourceTraduction, validerContenuTraduction, projectionSourceTraduction } from '../domain/traductions.js';
import { capturerRecette } from './recette-garde.js';

export const cuisinesDepuis = (f) => Array.isArray(f?.cuisines) ? [...f.cuisines] : String(f?.cuisines || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export async function renderRecipeEdit(params, query, ctx) {
  if (query.kind !== 'translation') {
    const { renderEditeurRecette } = await import('./recette-editeur.js');
    return renderEditeurRecette(params, query, ctx);
  }
  if(query.format==='2'||query.draft){
    const {renderTraductionEditeur}=await import('./traduction-editeur.js');
    return renderTraductionEditeur(params,query,ctx);
  }
  const recipe = params.id ? ctx.recipesById.get(params.id) : null;
  if (params.id && !recipe) return el('div', { class: 'card' }, t('Recette introuvable.'));
  if (recipe && !recetteActiveDansContexte(recipe, ctx)) return mentionCycleRecette(recipe, ctx?.editionsById?.get(recipe.edition_id));
  const gardeRecette = await capturerRecette(repo, recipe, { ctx });
  const versions = recipe ? (ctx.versionsByRecipe.get(recipe.id) || []) : [];
  const demandee = recipe && query.v ? ctx.versionsById.get(query.v) : null;
  const base = recipe ? ((demandee?.recipe_id === recipe.id ? demandee : null) || currentVersion(recipe, versions)) : null;
  const translationLocale = ['fr', 'en'].includes(query.locale) ? query.locale : f_defaultTranslation(recipe);
  return translationEditor({ recipe, base, ctx, gardeRecette, query, f: { translationLocale } });
}

function f_defaultTranslation(recipe) { return recipe?.original_language === 'en' ? 'fr' : 'en'; }

// Traduction d'une version précise : signalée comme telle, sans devenir une adaptation culinaire (spec §14, §29.1).
function translationEditor({ recipe, base, ctx, f, gardeRecette, query = {} }) {
  if (!base) return el('div', { class: 'card' }, t('Aucune version à traduire.'));
  const candidates = ctx.recipe_translations.filter(tr=>tr.recipe_version_id===base.id&&tr.locale===f.translationLocale);
  const candidatesOuvertes=JSON.stringify([...candidates].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
  if(candidates.length>1&&!query.translation){
    const choix=el('div',{class:'stack'},el('h2',null,t('Plusieurs traductions existent pour cette version. Choisis celle à comparer.')));
    for(const tr of candidates){const q=new URLSearchParams(query);q.set('translation',tr.id);if(tr.alignment_format===2)q.set('format','2');choix.append(el('a',{class:'btn',href:`#/recipes/${encodeURIComponent(recipe.id)}/edit?${q}`},t('Traduction conservée : {id}',{id:tr.id})));}return choix;
  }
  const existing = query.translation?candidates.find(tr=>tr.id===query.translation):candidates[0];
  if(query.translation&&!existing)return el('p',{role:'status'},t('Cette traduction a changé ailleurs. Ta saisie est conservée ; recharge la traduction pour comparer.'));
  if(existing?.alignment_format===2){const q=new URLSearchParams(query);q.set('format','2');q.set('translation',existing.id);return el('a',{class:'btn',href:`#/recipes/${encodeURIComponent(recipe.id)}/edit?${q}`},t('Comparer cette traduction'));}
  const lecture = lireTraduction(existing, base);
  const sourceValide = verifierSourceTraduction(base, recipe.original_title || '');
  const ancien = existing?.translated_content;
  const contenuAncien = ancien && typeof ancien === 'object' && !Array.isArray(ancien)
    ? { title: ancien.title ?? '', ingredients: ancien.ingredients, steps: ancien.steps } : null;
  // Les tableaux de longueur différente ne sont pas associés : la personne retrouve les textes dans le panneau de revue.
  const ancienValide = contenuAncien ? validerContenuTraduction(contenuAncien, base) : null;
  const sourceOuverte = projectionSourceTraduction(base), traductionOuverte = JSON.stringify(existing ?? null);
  const sourceTitre = recipe.original_title;
  const root = el('div', null, pageHeader(t('Traduire — {l}', { l: f.translationLocale.toUpperCase() }), { back: {...retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli:`/recipes/${encodeURIComponent(recipe.id)}`}),label:t('Retour')} }));
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
        } } : { key: row.id, absente: true },{index:'recipe_version_id',valeur:base.id,verifier:rows=>{
          const courantes=JSON.stringify(rows.filter(r=>r.locale===f.translationLocale).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
          if(courantes!==candidatesOuvertes)throw new TransitionRefusee('recipe_translations',row.id,null);
        }}],
      } });
      toast(t('Traduction enregistrée')); navigate(destinationApresRecette(recipe.id,query,ctx,{v:base.id,lang:f.translationLocale}));
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
