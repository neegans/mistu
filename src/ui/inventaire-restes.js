import {el,toast,ouvrirDialogue} from '../core/dom.js';
import {t} from '../core/i18n.js';
import * as repoModule from '../model/repo.js';
import {getSyncGeneration,protegerSaisie} from './state.js';
import {ouvrirCuissons} from './cuisson.js';
import {ouvrirFormulaireLot} from './inventaire-formulaire.js';
import {texteErreurInventaire} from './inventaire-texte.js';
export async function ouvrirRestesApresCuisson({recu,ctx={},repo=repoModule,getGeneration=getSyncGeneration,estCourante=()=>true,service}){
 const rows=structuredClone(recu?.rows||[]);if(!rows.length||!estCourante())return false;
 const base=repo.db,generation=getGeneration(),courante=()=>repo.db===base&&getGeneration()===generation&&estCourante();
 service??=(await import('../domain/inventaire-persistance.js')).creerServiceInventaire({repo,getGeneration});
 const scope=await service.capturerPortee({owner_id:ctx.proprietaireDonnees??null,estCourante:courante});if(scope.issue!=='ok'||!courante())return false;
 const refs=await Promise.all(rows.map(async history=>{const[recipe,version]=await Promise.all([repo.get('recipes',history.recipe_id),repo.get('recipe_versions',history.recipe_version_id)]),edition=recipe?.edition_id?await repo.get('book_editions',recipe.edition_id):null;return structuredClone({history,recipe:recipe||null,version:version||null,edition:edition||null});}));if(!courante())return false;
 const dlg=el('dialog',{class:'inventaire-restes stack',dataset:{role:'restes-cuisson'},style:{maxWidth:'min(40rem, calc(100vw - 2rem))'}},el('h2',null,t('Cuisson enregistrée')),el('p',null,t('Il reste quelque chose ? Indique la quantité réelle dans un nouveau lot. Aucun stock n’a été modifié.'))),message=el('p',{role:'status',hidden:true});dlg.append(message);
 const liberer=protegerSaisie(dlg);let occupe=false,ferme=false,conserve=false,presentation;
 return new Promise(resolve=>{const fermer=()=>{if(ferme||occupe)return;ferme=true;presentation?.fermer();dlg.remove();liberer();resolve(conserve);};
  for(const reference of refs){const title=reference.recipe?.display_title||reference.recipe?.original_title||t('Recette source indisponible');const button=el('button',{class:'btn',type:'button',dataset:{role:'restes-lot'},onClick:()=>{void(async()=>{
   if(occupe||ferme||!courante())return;occupe=true;for(const b of dlg.querySelectorAll('button'))b.disabled=true;
   try{if(!reference.recipe||!reference.version){message.hidden=false;message.textContent=t('La source de cette cuisson n’est plus disponible. Tu peux ajouter un lot sans source depuis l’inventaire.');return;}
    const r=await ouvrirFormulaireLot({service,portee:scope.portee,references:reference,ctx,estCourante:courante});if(!courante()||!r)return;message.hidden=false;if(['conserve','deja_conserve'].includes(r.issue)){conserve=true;message.textContent=t('Lot conservé. Un autre lot demande un nouveau geste.');}else message.textContent=texteErreurInventaire(r);
   }catch{message.hidden=false;message.textContent=texteErreurInventaire({});}finally{occupe=false;for(const b of dlg.querySelectorAll('button'))b.disabled=false;}
  })();}},t('Enregistrer des restes'));dlg.append(el('div',{class:'card stack'},el('strong',null,title),button));}
  dlg.append(el('button',{class:'btn primary',type:'button',dataset:{role:'fermer-restes'},onClick:fermer},t('Terminer')));dlg.addEventListener('cancel',e=>{e.preventDefault();fermer();});presentation=ouvrirDialogue(dlg,{focusInitial:dlg.querySelector('[data-role=fermer-restes]'),estCourante:courante});
 });
}
// Façade de présentation : conserve le booléen historique et n'écrit jamais la cuisson une seconde fois.
export async function ouvrirCuissonsAvecRestes(items,options={}){
 const depot=options.repo??repoModule,base=depot.db,generation=getSyncGeneration(),estCourante=()=>depot.db===base&&getSyncGeneration()===generation&&options.estCourante?.()!==false;let recu=null;
 const ok=await (options.ouvrirCuissons??ouvrirCuissons)(items,{...options,estCourante,onEnregistre:r=>{recu=structuredClone(r);try{const resultat=options.onEnregistre?.(structuredClone(r));if(resultat?.then)Promise.resolve(resultat).catch(()=>{});}catch{}}});
 if(ok&&recu?.rows.length&&estCourante())try{await (options.ouvrirRestes??ouvrirRestesApresCuisson)({recu,ctx:options.ctx,repo:depot,getGeneration:getSyncGeneration,estCourante,service:options.inventaireService});}catch{(options.toast??toast)(t('La cuisson est conservée. Rouvre l’inventaire pour enregistrer des restes.'));}
 return ok;
}
