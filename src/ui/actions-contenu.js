// Actions communes : les captures appartiennent à la fiche affichée, jamais à une relecture tardive.
import { el, chooseDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { refresh, navigate, buildQuery } from '../core/router.js';
import * as depot from '../model/repo.js';
import { capturerRecette, capturerEdition } from './recette-garde.js';
import { lireEtatRecette, lireCycleEdition } from '../domain/cycle-edition.js';
import { ErreurCycleRecette } from '../domain/cycle-recette.js';
import { mettreALaCorbeille, restaurerRecette } from '../domain/corbeille.js';
import { capaciteCycleConnue } from '../sync/cycle.js';
import { capaciteEditionConnue } from '../sync/cycle-edition.js';
import { lienAvecOrigine, retourConnu, porteeNavigation } from './navigation-contexte.js';

const TEXTE_PERIME = 'La recette a changé. Recharge sa fiche avant de réessayer.';
const TEXTE_CAPACITE = 'La corbeille n’est pas encore disponible pour ce compte. Connecte-toi avec une application à jour pour vérifier sa disponibilité.';
export function texteErreurAction(raison,action,{livre=false}={}){
  if(raison==='compte_change'||raison==='contexte_change')return t('Le compte ou la bibliothèque a changé. Rouvre cet écran pour continuer.');
  if(raison==='serveur_incompatible')return t(TEXTE_CAPACITE);
  if(['cycle_change','cycle_invalide','edition_retiree','recette_retiree','source_modifiee','source_absente','edition_absente','bilan_change'].includes(raison))return livre?t('Le livre a changé. Recharge sa fiche avant de réessayer.'):t(TEXTE_PERIME);
  return t('« {action} » n’a pas pu être enregistré sur cet appareil. Réessaie.',{action});
}
const copies = new WeakMap(), executions = new WeakMap();
const signature = r => JSON.stringify([r?.id,r?.original_title,r?.display_title,r?.availability,r?.edition_id,r?.current_version_id,r?.source_page_ids]);
const titreRecette = r => r.display_title || r.original_title || t('Sans titre');
const lien = (href,origine) => lienAvecOrigine(href, origine || {});

// La nouvelle version garde l’origine de sa fiche, sans reboucler sur le formulaire quitté.
export function destinationApresRecette(id,query,ctx,champs={}) {
  const path=`/recipes/${encodeURIComponent(id)}`,retour=retourConnu({query,portee:ctx?.navigation?.portee||porteeNavigation(ctx),repli:path});
  const [base,params='']=retour.href.split('?');
  const cleEntree=base===path?new URLSearchParams(params).get('origine'):retour.cleEntree;
  return lienAvecOrigine(path+buildQuery(champs),{cleEntree:cleEntree||null}).slice(1);
}

export async function capturerSelectionRecettes(recipes, ctx, {repo = depot} = {}) {
  return Promise.all([...new Map(recipes.map(r=>[r.id,r])).values()].map(async recipe => {
    const copie = structuredClone(recipe), edition = ctx?.editionsById?.get(recipe.edition_id);
    const capture = {id:copie.id,titre:titreRecette(copie)};
    try {
      if(lireEtatRecette(copie,edition).etat!=='active') throw new ErreurCycleRecette('recette_retiree',copie.id);
      copies.set(capture,{recipe:copie,edition:edition?structuredClone(edition):null,contexte:await capturerRecette(repo,copie,{ctx}),signature:signature(copie)});
    } catch(e) {copies.set(capture,{erreur:e});}
    return capture;
  }));
}

function verifierSignature(capture,courante) {
  const c=copies.get(capture);
  if(!courante || signature(courante)!==c.signature)throw new ErreurCycleRecette('source_modifiee',capture.id);
  return true;
}

async function rattacher(capture,platId,repo) {
  if(typeof platId!=='string'||!platId)throw new ErreurCycleRecette('source_absente');
  const c=copies.get(capture), liens=(await repo.all('dish_recipe_links')).filter(x=>x.recipe_id===capture.id&&x.dish_id===platId);
  const avant=JSON.stringify(liens), existing=liens.find(x=>x.state==='confirmed')||liens[0];
  const row={...(existing||{id:repo.newId('drl'),dish_id:platId,recipe_id:capture.id}),state:'confirmed',proposed_by:'user',evidence:t('Rattachement manuel'),reviewed_at:repo.nowIso()};
  await repo.saveBatch({dish_recipe_links:[row]},{recettes:[c.contexte],conditions:{
    recipes:[{key:capture.id,fusion:r=>{verifierSignature(capture,r);return null;}}],
    dishes:[{key:platId,fusion:plat=>{if(!plat)throw new ErreurCycleRecette('source_absente');return null;}}],
    dish_recipe_links:[{toutes:true,verifier:rows=>{if(JSON.stringify(rows.filter(x=>x.recipe_id===capture.id&&x.dish_id===platId))!==avant)throw new ErreurCycleRecette('source_modifiee');}}],
  }});
}

export async function executerSelectionRecettes(captures,{action,valeur,platId,estCourante=()=>true}={}, {repo=depot}={}) {
  const resultats=[]; let interrompu=false;
  for(const capture of captures){
    if(interrompu||!estCourante()){interrompu=true;resultats.push({id:capture.id,issue:'non_traite',raison:'contexte_change'});continue;}
    const cle=JSON.stringify([action,valeur,platId]);let memoire=executions.get(capture);
    if(!memoire){memoire=new Map();executions.set(capture,memoire);}
    if(!memoire.has(cle)){
      const promise=(async()=>{
        try{
          const c=copies.get(capture);if(!c)throw new ErreurCycleRecette('contexte_change');if(c.erreur)throw c.erreur;
          if(action==='retirer')await mettreALaCorbeille(c.recipe,{repo,contexte:c.contexte,edition:c.edition,verifierCourante:r=>verifierSignature(capture,r)});
          else if(action==='favori'){
            if(typeof valeur!=='boolean')throw new TypeError('Valeur de favori attendue');
            await repo.saveBatch({},{recettes:[c.contexte],conditions:{recipes:[{key:capture.id,fusion:r=>{
              if(!r)throw new ErreurCycleRecette('source_absente',capture.id);return {...r,favorite:valeur};
            }}]}});
          }else if(action==='rattacher')await rattacher(capture,platId,repo);
          else throw new TypeError('Action inconnue');
          return {id:capture.id,issue:'succes'};
        }catch(e){return {id:capture.id,issue:'refuse',raison:typeof e?.code==='string'?e.code:'ecriture_refusee'};}
      })();
      memoire.set(cle,promise);
    }
    const resultat=await memoire.get(cle);resultats.push(resultat);
    if(resultat.issue==='refuse'&&resultat.raison==='ecriture_refusee')memoire.delete(cle);
    if(resultat.issue==='refuse'&&['compte_change','contexte_change'].includes(resultat.raison))interrompu=true;
  }
  return resultats;
}

async function verifierLien(capture,repo) {
  const c=copies.get(capture);if(c?.erreur)throw c.erreur;
  if(!c||!c.contexte.contexteValide?.())throw new ErreurCycleRecette('contexte_change');
  const [r,e,owner]=await Promise.all([repo.get('recipes',capture.id),c.recipe.edition_id?repo.get('book_editions',c.recipe.edition_id):null,repo.get('sync_state','user_id')]);
  if((owner?.value??null)!==(c.contexte.owner_id??null))throw new ErreurCycleRecette('compte_change');
  if(!r||r.lifecycle_id!==c.recipe.lifecycle_id||(r.edition_id??null)!==(c.recipe.edition_id??null)||lireCycleEdition(e).id!==(c.contexte.expected_edition_cycle_id??null)||lireEtatRecette(r,e).etat!=='active')throw new ErreurCycleRecette('source_modifiee');
}

export function actionsRecette({recipe,version,ctx,origine}={},deps={}) {
  if(!recipe?.id)return [];
  const repo=deps.repo||depot,edition=ctx?.editionsById?.get(recipe.edition_id),etat=lireEtatRecette(recipe,edition),titre=titreRecette(recipe),rid=encodeURIComponent(recipe.id);
  if(!['active','retiree'].includes(etat.etat))return [];
  const descriptor=(id,libelle,extra={})=>({id,libelle:t(libelle),nomAccessible:t('{action} — {titre}',{action:t(libelle),titre}),eligible:true,...extra});
  const capacite=async()=>{const owner=Object.hasOwn(ctx||{},'proprietaireDonnees')?ctx.proprietaireDonnees:(await repo.get('sync_state','user_id'))?.value??null;return owner==null||await (edition?capaciteEditionConnue:capaciteCycleConnue)(repo.db,owner);};
  if(etat.etat==='retiree'){
    const contexte=capturerRecette(repo,recipe,{ctx});contexte.catch(()=>{});
    const a=descriptor('restaurer','Restaurer cette recette',{executer:async()=>{await restaurerRecette(recipe,{repo,contexte:await contexte,edition});return{id:recipe.id,issue:'succes'};}});
    a.pret=capacite().then(ok=>{a.eligible=ok;a.motif=ok?null:t(TEXTE_CAPACITE);});a.pret.catch(()=>{});return [a];
  }
  const captures=capturerSelectionRecettes([recipe],ctx,{repo});
  const v=version?.recipe_id===recipe.id?version:null;
  const empreinteVersion=v?JSON.stringify({...v,updated_at:null}):null;
  const garderLien=async()=>{
    await verifierLien((await captures)[0],repo);
    if(v){const actuelle=await repo.get('recipe_versions',v.id);if(!actuelle||JSON.stringify({...actuelle,updated_at:null})!==empreinteVersion)throw new ErreurCycleRecette('source_modifiee',recipe.id);}
  };
  const commande=options=>async()=>(await executerSelectionRecettes(await captures,options,{repo}))[0];
  const routes=[
    descriptor('modifier','Modifier',{href:lien(`/recipes/${rid}/edit${buildQuery(v?{kind:'correction',v:v.id}:{})}`,origine)}),
    descriptor('favori',recipe.favorite?'Retirer des favoris':'Ajouter aux favoris',{executer:commande({action:'favori',valeur:!recipe.favorite})}),
    descriptor('photo','Gérer la photo',{href:lien(`/recipes/${rid}/photo${buildQuery(v?{v:v.id}:{})}`,origine)}),
    descriptor('reperes','Informations et temps',{href:lien(`/recipes/${rid}/reperes${buildQuery(v?{v:v.id}:{})}`,origine)}),
    descriptor('rattacher','Rattacher à un plat',{executer:async()=>{
      const options=(ctx?.dishes||[]).map(d=>({value:d.id,label:d.labels?.fr?.label||d.id}));
      const platId=await (deps.chooseDialog||chooseDialog)(t('Rattacher cette recette à quel plat ?'),options);
      return platId?commande({action:'rattacher',platId})():{id:recipe.id,issue:'annule'};
    }}),
    descriptor('retirer','Mettre à la corbeille',{executer:commande({action:'retirer'})}),
  ];
  for(const a of routes)if(a.href)a.verifier=garderLien;
  const retrait=routes.find(a=>a.id==='retirer');retrait.pret=capacite().then(ok=>{retrait.eligible=ok;retrait.motif=ok?null:t(TEXTE_CAPACITE);});
  retrait.pret.catch(()=>{}); // Une carte peut être quittée avant ouverture de son menu ; le refus sera relu au geste.
  return routes;
}

export function actionsLivre({edition,ctx,origine}={},deps={}){
  if(!edition?.id)return [];
  const etat=lireCycleEdition(edition),titre=ctx?.booksById?.get(edition.book_id)?.title||t('Livre');
  if(etat.etat==='invalide')return [];
  const action=(id,libelle,panel)=>({id,libelle:t(libelle),livre:true,nomAccessible:t('{action} — {titre}',{action:t(libelle),titre}),eligible:true,href:lien(`/books/${encodeURIComponent(edition.id)}${buildQuery({panel})}`,origine)});
  const repo=deps.repo||depot,contexte=capturerEdition(repo,edition,{ctx});contexte.catch(()=>{});
  const cycle=action(etat.etat==='retiree'?'restaurer-livre':'retirer-livre',etat.etat==='retiree'?'Restaurer le livre':'Mettre à la corbeille','corbeille');
  delete cycle.href;
  cycle.pret=(async()=>{const owner=(await contexte).owner_id;cycle.eligible=owner==null||await capaciteEditionConnue(repo.db,owner);if(!cycle.eligible)cycle.motif=t(TEXTE_CAPACITE);})();
  cycle.pret.catch(()=>{});
  cycle.executer=async()=>{
    const {panneauCycleLivre}=await import('./corbeille.js');
    const panneau=await panneauCycleLivre(edition,ctx,{...deps,repo,contexte:await contexte,apres:()=>{}});
    panneau.hidden=true;document.body.append(panneau);
    try{return await panneau.agir();}finally{panneau.remove();}
  };
  const actions=etat.etat==='retiree'?[cycle]:[
    action('modifier-livre','Modifier le livre','modifier'),action('ajouter-index','Ajouter des pages d’index','index'),action('ajouter-recette','Ajouter une recette','recette'),cycle,
  ];
  for(const a of actions)if(a.href)a.verifier=async()=>{
    const capture=await contexte,[courante,owner]=await Promise.all([repo.get('book_editions',edition.id),repo.get('sync_state','user_id')]);
    if(!capture.contexteValide?.()||(owner?.value??null)!==(capture.owner_id??null))throw new ErreurCycleRecette('compte_change');
    if(!courante||lireCycleEdition(courante).etat!=='active'||lireCycleEdition(courante).id!==capture.expected_cycle_id)throw new ErreurCycleRecette('source_modifiee');
  };
  return actions;
}

function boutonAction(a,{onResultat=()=>refresh(),fermer=()=>{},message}={}){
  let occupe=false,pret=!a.pret;
  const attributes={class:`btn${a.id.startsWith('retirer')?' danger':''}`,dataset:{action:a.id},'aria-label':a.nomAccessible};
  const node=a.href?el('a',{...attributes,href:a.href},a.libelle):el('button',{...attributes,type:'button'},a.libelle);
  const etat=()=>{if(node.tagName==='BUTTON')node.disabled=occupe||!pret||!a.eligible;else node.setAttribute('aria-disabled',String(!pret||!a.eligible));if(a.motif)node.title=a.motif;};
  if(a.pret){etat();a.pret.then(()=>{pret=true;etat();}).catch(()=>{pret=true;a.eligible=false;etat();});}else etat();
  node.addEventListener('click',async e=>{
    if(a.href&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0))return;
    e.preventDefault();if(occupe||!pret||!a.eligible)return;occupe=true;etat();
    try{
      if(a.href){if(a.verifier)await a.verifier();fermer();navigate(a.href.slice(1));return;}
      const result=await a.executer();
      if(result?.issue==='refuse'){if(message)message.textContent=texteErreurAction(result.raison,a.libelle,a);return;}
      if(result?.issue!=='annule'){fermer();if(a.actualise!==false)await onResultat(result);}
    }catch(e){if(message)message.textContent=texteErreurAction(e?.code,a.libelle,a);}
    finally{occupe=false;etat();if(node.isConnected&&node.closest('dialog[open]'))node.focus();}
  });
  return node;
}

export function boutonsActions(actions,ids,{onResultat}={}){
  const root=el('div',{class:'row actions-directes'}),message=el('p',{role:'status',class:'muted'});
  for(const id of ids){const action=actions.find(a=>a.id===id);if(action)root.append(boutonAction(action,{onResultat,message}));}
  root.append(message);return root;
}

export function menuActions(actions,{titre=t('Recette'),onResultat}={}){
  const trigger=el('button',{type:'button',class:'btn actions-contenu',dataset:{role:'actions-contenu'},'aria-label':t('Actions pour {titre}',{titre}),'aria-expanded':'false'},t('Actions'));
  trigger.addEventListener('click',()=>{
    if(trigger.getAttribute('aria-expanded')==='true')return;
    const message=el('p',{role:'status',class:'status warn'}),dialogue=el('dialog',{class:'dialogue-actions',dataset:{role:'dialogue-actions'},'aria-label':t('Actions pour {titre}',{titre})},el('h2',null,titre));
    const fermer=()=>{dialogue.close();dialogue.remove();trigger.setAttribute('aria-expanded','false');if(trigger.isConnected)trigger.focus();};
    dialogue.append(el('div',{class:'stack'},...actions.map(a=>boutonAction(a,{onResultat,fermer,message}))),message,el('button',{type:'button',class:'btn',onClick:fermer},t('Fermer')));
    dialogue.addEventListener('cancel',e=>{e.preventDefault();fermer();});
    document.body.append(dialogue);trigger.setAttribute('aria-expanded','true');dialogue.showModal();dialogue.querySelector('a,button')?.focus();
  });
  return trigger;
}
