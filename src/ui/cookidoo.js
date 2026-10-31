// I3 : un texte à reporter dans l’éditeur officiel. Aucun compte Cookidoo ni envoi au robot.
import { el } from '../core/dom.js';
import { t, getUiLocale } from '../core/i18n.js';
import { copieCookidooThermomix, lireThermomix, ligneIngredientThermomix } from '../domain/thermomix.js';
import { resoudreVersionThermomix, gardesAscendanceThermomix } from '../domain/thermomix-reprise.js';
import { CLE_EPOQUE_EDITEUR } from '../domain/brouillons-format.js';
import { capturerRecette } from './recette-garde.js';
import * as depot from '../model/repo.js';

function copieOrigine({recipe,version,book,edition}) {
  if (recipe?.availability !== 'available' || version?.incomplete || version?.provenance?.incomplete || version?.provenance?.missing_page
    || lireThermomix(version) || !Array.isArray(version?.ingredients) || !Array.isArray(version?.steps) || !version.steps.length
    || version.steps.some(s => typeof s?.text !== 'string')) throw Error('source_modifiee');
  const titre=recipe.display_title||recipe.original_title, portions=version.servings??null, mention=t('Recette d’origine');
  if (typeof titre !== 'string' || !titre.trim()) throw Error('source_modifiee');
  const ingredients=version.ingredients.map(i=>ligneIngredientThermomix(i,{locale:getUiLocale()})),etapes=version.steps.map(s=>s.text);
  const origine=[book?.title,book?.author,recipe.printed_page?t('Page {p}',{p:recipe.printed_page}):null,edition?.isbn?`ISBN ${edition.isbn}`:null].filter(x=>typeof x==='string'&&x).join(' · ');
  const texte=[titre,mention,origine,portions==null?t('Portions inconnues : quantités de la version source.'):t('{n} portions',{n:portions}),t('Ingrédients'),...ingredients,t('Préparation'),...etapes.map((s,i)=>`${i+1}. ${s}`)].filter(Boolean).join('\n\n');
  return {titre,portions,mention,ingredients,etapes,texte};
}

export function renderCopieCookidoo(bundle, deps = {}) {
  const root = el('section', { class: 'card stack', dataset: { role: 'copie-cookidoo' } }), repo=deps.repo||depot;
  const titre=el('h2',null,t('Copier pour Cookidoo'));root.append(titre);
  let sourceId=null,pending=Promise.resolve(),initialisation=Promise.resolve(),detruit=false;
  const lienSource = () => el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(bundle?.recipe?.id || '')}${sourceId?'?v='+encodeURIComponent(sourceId):''}` }, t('Revoir la recette source'));
  const refus = () => t('Ces réglages ne correspondent plus à cette recette. Crée une nouvelle adaptation avant de les copier.');
  root.attendreCopie=()=>pending;root.attendreLecture=()=>initialisation;root.dispose=()=>{detruit=true;};
  if (bundle?.recipe?.availability !== 'available') {
    root.append(el('p', { class: 'status warn' }, t('Recette incomplète : complète la source puis crée une nouvelle adaptation avant de copier pour Cookidoo.')), lienSource());
    return root;
  }
  const portionsDemandees=Object.hasOwn(deps,'portions')?deps.portions:bundle?.version?.servings??null;
  if (lireThermomix(bundle?.version)?.etat==='a_revoir') {
    titre.textContent=t('Copier la recette d’origine pour Cookidoo');
    const chargement=el('p',{class:'status',role:'status'},t('Lecture de la recette d’origine…'));root.append(chargement);
    const affichee=structuredClone(bundle),base=repo.db;
    initialisation=(async()=>{
      try {
        const [resolution,capture,epoque]=await Promise.all([
          resoudreVersionThermomix(affichee.version,{lire:id=>repo.get('recipe_versions',id)}),
          capturerRecette(repo,affichee.recipe,{ctx:deps.ctx,edition:affichee.edition??null}),
          repo.get('sync_state',CLE_EPOQUE_EDITEUR),
        ]);
        if (!resolution.ok||!resolution.repli||resolution.version.recipe_id!==affichee.recipe.id) throw Error('source_modifiee');
        const copie=copieOrigine({...affichee,version:resolution.version});
        const verifier=async()=>{
          if(detruit||repo.db!==base||capture?.contexteValide?.()===false||JSON.stringify(bundle)!==JSON.stringify(affichee))throw Error('source_modifiee');
          await repo.saveBatch({}, {recettes:[capture],conditions:{
            recipe_versions:gardesAscendanceThermomix(resolution.ancetres),
            recipes:[{key:affichee.recipe.id,fusion:r=>{if(JSON.stringify(r)!==JSON.stringify(affichee.recipe))throw Error('source_modifiee');return null;}}],
            sync_state:[{key:CLE_EPOQUE_EDITEUR,fusion:r=>{if(JSON.stringify(r??null)!==JSON.stringify(epoque??null))throw Error('source_modifiee');return null;}}],
          }});
          if(detruit||repo.db!==base||capture?.contexteValide?.()===false)throw Error('source_modifiee');
        };
        await verifier();if(detruit)return;
        sourceId=resolution.version.id;chargement.remove();afficher(copie,()=>copie,verifier,true);
      } catch {if(!detruit){chargement.textContent=refus();root.append(lienSource());}}
    })();
    return root;
  }
  const lire=()=>copieCookidooThermomix(bundle,{locale:getUiLocale(),portions:portionsDemandees});
  try{afficher(lire(),lire);}catch{root.append(el('p',{class:'status warn'},refus()),lienSource());}
  return root;

  function afficher(copie,lire,verifier=null,original=false){
    const status = el('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    const selection = el('textarea', { readOnly: true, rows: 10, 'aria-label': t('Texte à copier manuellement'), style: { width: '100%', boxSizing: 'border-box' } });
    const manuel = el('div', { class: 'stack', hidden: true }, el('p', null, t('Sélectionne ce texte puis utilise la commande Copier de ton appareil.')), selection);
    const boutons=[];let busy=false;
    function bouton(texte,role,obtenir){
      const node=el('button',{type:'button',class:'btn small',dataset:{role},onClick:()=>{
        if(busy||detruit)return;let valeur;
        try{valeur=obtenir(lire());}catch{status.textContent=refus();return;}
        busy=true;boutons.forEach(b=>{b.disabled=true;});status.textContent=t('Copie en cours…');manuel.hidden=true;
        pending=(async()=>{
          try{
            if(verifier){try{await verifier();if(!root.isConnected)throw Error('source_modifiee');}catch{status.textContent=refus();selection.value='';return;}}
            try{
              const clipboard=Object.hasOwn(deps,'clipboard')?deps.clipboard:globalThis.navigator?.clipboard;
              if(!clipboard?.writeText)throw Error('indisponible');
              await clipboard.writeText(valeur);if(!detruit)status.textContent=t('Texte copié');
            }catch{
              if(detruit)return;status.textContent=t('La copie automatique n’est pas disponible. Le texte reste sélectionnable.');selection.value=valeur;manuel.hidden=false;selection.focus();selection.select();
            }
          }finally{busy=false;boutons.forEach(b=>{b.disabled=false;});}
        })();
      }},texte);boutons.push(node);return node;
    }
    root.append(el('p',{class:'muted'},original?t('À reporter dans Recettes créées avec les ingrédients et les étapes de la recette d’origine.'):t('À reporter dans Recettes créées ; réglages à renseigner dans Cookidoo.')),
      el('p',{class:'status warn'},copie.mention));
    if(original&&portionsDemandees!==copie.portions)root.append(el('p',{class:'status warn'},t('Les portions affichées ont changé. Cette copie utilise les quantités de la recette d’origine.')));
    root.append(
      el('div',{class:'row between'},el('strong',null,copie.titre),bouton(t('Copier le titre'),'copier-titre',c=>c.titre)),
      el('p',{class:'muted'},copie.portions==null?t('Portions non renseignées : quantités d’origine conservées.'):t('{n} portions',{n:copie.portions})),
      el('h3',null,t('Ingrédients')),
      el('ul',{class:'stack'},...copie.ingredients.map((texte,i)=>el('li',null,el('div',{class:'row between'},el('span',null,texte),bouton(t('Copier cet ingrédient'),'copier-ingredient',c=>c.ingredients[i]))))),
      el('h3',null,t('Étapes')),
      ...copie.etapes.map((texte,i)=>el('div',{class:'card flat stack'},el('div',{class:'row between'},el('strong',null,t('Étape {n}',{n:i+1})),bouton(t('Copier cette étape'),'copier-etape',c=>c.etapes[i])),el('p',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},texte))),
      bouton(original?t('Copier la recette d’origine'):t('Copier tout le texte'),'copier-tout',c=>c.texte),status,manuel,
      el('details',null,el('summary',null,t('Comment utiliser ce texte dans Cookidoo ?')),
        el('ol',null,
          el('li',null,t('Dans Cookidoo Canada, ouvre Mes recettes → Recettes créées, puis crée une recette.')),
          el('li',null,t('Renseigne le titre, les portions, les ingrédients et les étapes dans leurs champs respectifs. Un collage global ne crée pas automatiquement ces champs.')),
          ...(!original?[
            el('li',null,t('Garde un champ par étape source. Les sous-actions restent dans son texte ; plusieurs réglages programmés dans ce champ ne sont pas garantis.')),
            el('li',null,t('Ajoute uniquement les réglages proposés par le bouton de cuisson. Les autres, notamment le sens inverse et les modes, restent des consignes à régler manuellement sur le TM7.')),
            el('li',null,t('Enregistre dans Cookidoo puis retrouve la recette dans les Recettes créées du TM7. Vérifie les réglages sur l’appareil avant de cuisiner.')),
          ]:[])),
        el('p',{class:'muted'},t('Cookidoo annonce jusqu’à 100 Recettes créées avec un abonnement actif. Ce parcours et les réglages disponibles restent à vérifier sur ton compte canadien.'))),
      el('a',{class:'btn',href:'https://cookidoo.ca/foundation/en-CA/pages/discover-created-recipes',target:'_blank',rel:'noopener noreferrer'},t('Ouvrir Cookidoo Canada')));
  }
}
