import { el, confirmDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { refresh, remplacerAdresse } from '../core/router.js';
import * as repo from '../model/repo.js';
import { getSyncGeneration } from './state.js';
import { projeterBibliotheque, normaliserEtatBibliotheque } from '../domain/bibliotheque.js';
import { photosPersonnellesParRecette, photoPrincipale } from '../domain/cuisine-personnelle.js';
import { recipeCard, grilleCartes, contexteFichiers, empreintesPhotos, fichierPhoto, remplacerEnRevoquant, availabilityBadge, emptyState, aUneAdresse } from './components.js';
import { photoVisible } from './photos-visibles.js';
import { resumeReperes } from './reperes-affichage.js';
import { plagesLisibles, textePlages } from '../domain/index-livre.js';
import { sectionLisible } from '../domain/llm.js';
import { icone } from './icones.js';
import { logError } from '../core/log.js';
import { actionsRecette, menuActions, boutonsActions, capturerSelectionRecettes, executerSelectionRecettes } from './actions-contenu.js';
import { memoriserListe, lienAvecOrigine } from './navigation-contexte.js';

export function texteCompteurs(c) {
  return [t('{n} disponible(s)',{n:c.available}),t('{n} partielle(s)',{n:c.partial}),t('{n} référence(s)',{n:c.reference_only}),t('{n} état(s) inconnu(s)',{n:c.unknown})].join(' · ');
}
export function ligneBibliotheque(d,{fichier=null,photo=null,ctxF={},ctx,origine,onResultat}={}){
  const r=d.recipe,href=lienAvecOrigine(`/recipes/${encodeURIComponent(r.id)}`,origine||{}),titre=r.display_title||r.original_title||t('Sans titre');
  const actions=el('div',{class:'row recette-ligne-actions',dataset:{role:'etat-recette'}},availabilityBadge({...r,printed_page:null}));
  const importable=['reference_only','partial'].includes(r.availability)&&!aUneAdresse(r);
  if(importable)actions.append(el('a',{class:'btn small',href:lienAvecOrigine(`/recipes/${encodeURIComponent(r.id)}/importer`,origine||{})},r.availability==='partial'?t('Compléter'):t('Importer')));
  if(r.favorite)actions.append(el('span',{class:'badge'},'★ '+t('Favori')));
  if(ctx){const disponibles=actionsRecette({recipe:r,version:d.version,ctx,origine});actions.append(boutonsActions(disponibles,['modifier'],{onResultat}),menuActions(disponibles,{titre,onResultat}));}
  return el('div',{class:'recette-ligne',dataset:{recette:r.id}},
    el('div',{class:'recette-ligne-entete'},photoVisible(photo?.sha256??r.photo_sha256,{fichier,ctxF,classe:'recette-miniature',personnelle:!!photo?.personnelle}),
      el('div',{class:'recette-ligne-texte'},el('a',{class:'titre',href,dataset:{navFocus:'element'}},titre),
        r.original_title&&r.display_title&&r.display_title!==r.original_title?el('small',{class:'muted'},t('Titre original : {titre}',{titre:r.original_title})):null,
        el('div',{class:'row muted'},d.book?.title?el('span',null,d.book.title):null,plagesLisibles(r).length?el('span',{class:'muted'},`${t('p.')} ${textePlages(plagesLisibles(r))}`):null,
          r.availability==='reference_only'&&!aUneAdresse(r)&&sectionLisible(r.section)?el('span',{class:'chip neutral',dataset:{role:'section'}},sectionLisible(r.section)):null))),
    resumeReperes(r,d.version,{compact:true}),actions);
}

// Le même écran de résultats équipe la bibliothèque et un livre. Seule la portée du livre est fixée.
export async function renderListeBibliotheque(ctx,{etat={},route='/library',editionId=null,origine={},placeholder=t('Une recette, un ingrédient…'),deps={}}={}){
  const depot=deps.repo||repo,ctxF=await contexteFichiers(ctx),photos=photosPersonnellesParRecette(ctx.cook_history),fichiers=new Map();
  let state={...normaliserEtatBibliotheque(etat),...(editionId?{editionId}:{})},generation=0,occupe=false,modeSelection=false;
  const syncGeneration=getSyncGeneration(),base=depot.db,selection=new Map();
  const root=el('section',{class:'bibliotheque-resultats'}),liste=el('div'),suite=el('div',{class:'row'}),compte=el('p',{class:'muted bibliotheque-compteurs',dataset:{role:'compte-resultats'}});
  const bilan=el('p',{role:'status'}),barre=el('div',{class:'bibliotheque-selection',hidden:true}),checks=[],controls=[];
  let page=[],dernierRendu=Promise.resolve(),dernierGeste=Promise.resolve();
  const courante=()=>root.isConnected&&getSyncGeneration()===syncGeneration&&depot.db===base;
  const memoriser=()=>{
    memoriserListe({...etat,...state,route,onglet:'recettes'});
    // Les paramètres fournis par un ancien lien ne doivent pas supplanter le dernier geste au prochain rendu.
    if(location.hash.split('?')[0]===`#${route}`){const q=new URLSearchParams(location.hash.split('?')[1]||'');for(const k of Object.keys(state))q.delete(k);remplacerAdresse(`#${route}${q.size?'?'+q:''}`);}
  };
  const modifier=(patch,{garder=false}={})=>{state={...state,...patch};if(!garder){state.limite=60;selection.clear();modeSelection=false;barre.hidden=true;mode.textContent=t('Sélectionner');generation++;bilan.textContent='';}memoriser();return dessiner();};
  const input=el('input',{name:'q',type:'search',value:state.q,placeholder,'aria-label':placeholder,dataset:{navFocus:'recherche'},onInput:e=>modifier({q:e.target.value})});
  const choisir=(name,label,values,value,change)=>{
    const node=el('select',{name,'aria-label':label,onChange:e=>change(e.target.value)},...values.map(([v,l])=>el('option',{value:v,selected:v===value},l)));controls.push(node);return el('label',{class:'field'},el('span',null,label),node);
  };
  const command=el('div',{class:'bibliotheque-commandes filtre-recettes'},el('label',{class:'champ-recherche'},icone('loupe'),input),
    choisir('tri',t('Trier'),[['modification',t('Dernière modification')],['titre',t('Titre')],...(editionId?[['page',t('Page')]]:[])],state.tri,v=>modifier({tri:v})),
    choisir('presentation',t('Présentation'),[['grille',t('Grille')],['liste',t('Liste')]],state.presentation,v=>modifier({presentation:v},{garder:true})));
  const mode=el('button',{type:'button',class:'btn',dataset:{role:'mode-selection'},onClick:()=>{if(occupe)return;modeSelection=!modeSelection;selection.clear();generation++;barre.hidden=!modeSelection;mode.textContent=modeSelection?t('Annuler la sélection'):t('Sélectionner');dessiner();}},t('Sélectionner'));
  command.append(mode);
  const champs=el('div',{class:'bibliotheque-filtres-champs'}),filtres=el('details',{class:'bibliotheque-filtres'},el('summary',null,t('Filtres')),champs);
  const groupe=(name,label,values)=>{
    const field=el('fieldset',null,el('legend',null,label));
    for(const [value,label]of values){const box=el('input',{type:'checkbox',name,value,checked:state[name].includes(value),onChange:e=>modifier({[name]:e.target.checked?[...state[name],value]:state[name].filter(x=>x!==value)})});checks.push(box);field.append(el('label',{class:'row'},box,label));}return field;
  };
  champs.append(groupe('sources',t('Source'),[['livres',t('De mes livres')],['web',t('Du web')],['ia',t('Créées avec l’IA')],['personnelles',t('Personnelles')]]),
    groupe('disponibilites',t('Disponibilité'),[['available',t('Disponibles')],['partial',t('Partielles')],['reference_only',t('Références')],['unknown',t('État inconnu')]]));
  const toggles=el('fieldset',null,el('legend',null,t('Mes repères')));
  for(const [name,label]of [['favoris',t('Favoris')],['aRelire',t('À relire')],['cuisinees',t('Déjà cuisinées')],['rapide',t('Rapides (30 min maximum)')]]){const box=el('input',{type:'checkbox',name,checked:state[name],onChange:e=>modifier({[name]:e.target.checked})});checks.push(box);toggles.append(el('label',{class:'row'},box,label));}
  champs.append(toggles);
  if(!editionId){const editions=ctx.book_editions||[],values=[['',t('Tous les livres')],...editions.map(e=>[e.id,String(ctx.editionLabel?.(e)||ctx.booksById?.get(e.book_id)?.title||t('Sans titre'))])];if(state.editionId&&!editions.some(e=>e.id===state.editionId))values.push([state.editionId,t('Livre indisponible')]);champs.append(choisir('editionId',t('Livre'),values,state.editionId||'',v=>modifier({editionId:v||null})));}
  const temps=el('input',{type:'number',name:'maxMinutes',min:1,max:10080,value:state.maxMinutes??'','aria-label':t('Durée totale maximum (min)'),onInput:e=>modifier({maxMinutes:e.target.value?Number(e.target.value):null})});controls.push(temps);
  champs.append(el('label',{class:'field'},el('span',null,t('Durée totale maximum (min)')),temps),choisir('appareil',t('Appareil'),[['',t('Tous les appareils')],['tm7','Thermomix TM7']],state.appareil||'',v=>modifier({appareil:v||null})));
  const ingredient=el('select',{name:'ingredientIds',multiple:true,'aria-label':t('Ingrédients'),onChange:e=>modifier({ingredientIds:[...e.target.selectedOptions].map(o=>o.value)})},...(ctx.ingredients||[]).map(i=>el('option',{value:i.id,selected:state.ingredientIds.includes(i.id)},i.labels?.fr?.label||i.labels?.en?.label||i.id)));
  controls.push(ingredient);champs.append(el('label',{class:'field'},el('span',null,t('Ingrédients')),ingredient));
  const effacer=el('button',{class:'btn',type:'button',dataset:{role:'effacer-filtres'},onClick:()=>{
    const presentation=state.presentation,tri=state.tri;state={...normaliserEtatBibliotheque({presentation,tri}),...(editionId?{editionId}:{})};input.value='';checks.forEach(x=>x.checked=false);for(const n of controls){if(n.multiple)[...n.options].forEach(o=>o.selected=false);else n.value=state[n.name]??'';}modifier({});
  }},t('Effacer les filtres'));
  champs.append(effacer);
  const prendre=async recipes=>{const g=generation, captures=await (deps.capturerSelectionRecettes||capturerSelectionRecettes)(recipes,ctx,{repo:depot});if(g!==generation||!courante())return;for(const c of captures)selection.set(c.id,c);dessinerBarre();synchroniserCases();};
  const choisirAffiches=el('button',{type:'button',class:'btn',dataset:{role:'selectionner-affiches'},onClick:()=>{dernierGeste=prendre(page.map(d=>d.recipe));}},t('Sélectionner les recettes affichées'));
  const choixPlat=el('select',{'aria-label':t('Plat existant'),name:'platSelection'},el('option',{value:''},t('Choisir un plat existant')),...(ctx.dishes||[]).map(d=>el('option',{value:d.id},d.labels?.fr?.label||d.labels?.en?.label||t('Sans titre'))));
  const appliquer=action=>async()=>{
    if(occupe||!selection.size||!courante())return;occupe=true;dessinerBarre();
    const captures=[...selection.values()],g=generation;
    try{
      if(action==='retirer'&&!await (deps.confirmDialog||confirmDialog)(t('Mettre les {n} recettes sélectionnées à la corbeille ?', {n:captures.length})))return;
      if(g!==generation||!courante())return;
      const resultats=await (deps.executerSelectionRecettes||executerSelectionRecettes)(captures,{action,platId:choixPlat.value,estCourante:()=>g===generation&&courante()},{repo:depot});
      const succes=resultats.filter(r=>r.issue==='succes');for(const r of succes)selection.delete(r.id);
      bilan.textContent=t('{n} effectuée(s), {m} refusée(s), {k} non traitée(s).',{n:succes.length,m:resultats.filter(r=>r.issue==='refuse').length,k:resultats.filter(r=>r.issue==='non_traite').length});
      if(action==='retirer'){const retires=new Set(succes.map(r=>r.id));ctx={...ctx,recipes:(ctx.recipes||[]).filter(r=>!retires.has(r.id))};}
      await dessiner();
    }catch{bilan.textContent=t('L’action n’a pas pu être terminée. Les recettes non traitées restent sélectionnées.');}
    finally{occupe=false;dessinerBarre();}
  };
  const retirer=el('button',{type:'button',class:'btn danger',dataset:{role:'retirer-selection'},onClick:()=>{dernierGeste=appliquer('retirer')();}},t('Mettre à la corbeille'));
  const rattacher=el('button',{type:'button',class:'btn',dataset:{role:'rattacher-selection'},onClick:()=>{dernierGeste=appliquer('rattacher')();}},t('Rattacher au plat'));
  const nombre=el('span');barre.append(nombre,choisirAffiches,choixPlat,rattacher,retirer,bilan);
  const dessinerBarre=()=>{nombre.textContent=t('{n} sélectionnée(s) parmi {m} affichée(s).',{n:selection.size,m:page.length});retirer.disabled=occupe||!selection.size;rattacher.disabled=occupe||!selection.size||!choixPlat.value;choisirAffiches.disabled=occupe||!page.length;choixPlat.disabled=occupe;};
  choixPlat.addEventListener('change',dessinerBarre);
  const synchroniserCases=()=>root.querySelectorAll('.selection-recette input').forEach(c=>{c.checked=selection.has(c.value);c.disabled=occupe;});
  const redessiner=async()=>{
    const g=++generation,projection=projeterBibliotheque(ctx,state);page=projection.items.slice(0,state.limite);
    const shas=empreintesPhotos(page.map(d=>d.recipe),photos).filter(s=>!fichiers.has(s));if(shas.length){const lus=await depot.getFiles(shas);for(const s of shas)fichiers.set(s,lus.get(s)||null);}if(g!==generation)return;
    compte.textContent=t('{n} résultat(s)',{n:projection.total});
    const nodes=page.map(d=>{
      const checked=el('input',{type:'checkbox',value:d.recipe.id,checked:selection.has(d.recipe.id),'aria-label':t('Sélectionner {titre}',{titre:d.recipe.display_title||d.recipe.original_title||t('Sans titre')}),onChange:e=>{if(!e.target.checked){selection.delete(d.recipe.id);dessinerBarre();}else{dernierGeste=prendre([d.recipe]);}}});
      const options={fichier:fichierPhoto(d.recipe,photos,fichiers),photo:photoPrincipale(d.recipe,photos),ctxF,ctx,origine,onResultat:()=>refresh()};
      return el(state.presentation==='liste'?'li':'div',{class:'bibliotheque-item',dataset:{navId:d.recipe.id,recette:d.recipe.id}},el('label',{class:'selection-recette',hidden:!modeSelection},checked,el('span',{class:'sr-only'},t('Sélectionner'))),state.presentation==='liste'?ligneBibliotheque(d,options):recipeCard(d,{...options,photoEnTete:d.disponibilite!=='reference_only'}));
    });
    const contenu=state.presentation==='liste'?el('ul',{class:'liste-compacte bibliotheque-liste'},...nodes):grilleCartes(nodes);
    const aucune=emptyState('livre-ouvert',projeterBibliotheque(ctx,{...(editionId?{editionId}:{})}).total?t('Aucune recette ne correspond.'):editionId?t('Aucune recette liée à ce livre.'):t('Aucune recette pour l’instant.'));
    aucune.dataset.role='aucune-correspondance';
    remplacerEnRevoquant(liste,...(nodes.length?[contenu]:[aucune]));
    suite.replaceChildren(...(projection.total>page.length?[el('button',{type:'button',class:'btn',dataset:{role:'voir-plus'},onClick:async()=>{const avant=page.length;await modifier({limite:state.limite+60},{garder:true});root.querySelectorAll('.bibliotheque-item')[avant]?.querySelector('a.titre,h3 a')?.focus();}},t('Voir plus'))]:[]));
    dessinerBarre();
  };
  const dessiner=()=>{dernierRendu=redessiner().catch(error=>{logError('library.redessin',{error});bilan.textContent=t('La liste n’a pas pu être actualisée. Réessaie.');barre.hidden=false;});return dernierRendu;};
  root.append(command,filtres,compte,barre,liste,suite);await dessiner();
  root.attendreAffichage=async()=>{await dernierGeste;await dernierRendu;};root.etatBibliotheque=()=>({...state});
  return root;
}
