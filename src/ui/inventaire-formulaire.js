import {el,ouvrirDialogue} from '../core/dom.js';
import {t,label} from '../core/i18n.js';
import {field,select as selectComposant} from './components.js';
import {protegerSaisie,recettesActives} from './state.js';
import {lireQuantiteInventaire} from '../domain/inventaire-format.js';
import {texteErreurInventaire,texteUniteInventaire,quantiteInventaire,dateLotInventaire} from './inventaire-texte.js';
const clone=structuredClone;
const select=(options,valeur,onChange=()=>{})=>selectComposant(options,valeur,onChange);
const referencesVides=()=>({recipe:null,version:null,edition:null,history:null});
export async function ouvrirFormulaireLot({service,portee,lu=null,references=null,ctx={},estCourante=()=>true}){
 let refs=clone(references||referencesVides()),creation=null;
 if(!lu){const r=await service.ouvrirCreation({portee});if(r.issue!=='ok')return r;creation=r.creation;}
 if(!estCourante())return{issue:'refuse',raison:'contexte_change'};
 const lot=lu?.affiche.lot||{},q=lu?.projection.quantite,legacy=lu?.projection.adoption_requise===true;
 const mode=select([{value:'inconnue',label:t('Je ne sais pas')},{value:'connue',label:t('Quantité connue')}],q?.mode==='connue'||legacy&&q?.portions_anciennes>0?'connue':'inconnue');mode.name='mode_quantite';
 const nombre=el('input',{name:'remaining',type:'text',inputmode:'decimal',value:q?.remaining??(legacy?q?.portions_anciennes??'':'')});
 const initial=el('input',{name:'initial',type:'text',inputmode:'decimal',value:q?.initial??''});
 const unit=select(['portion','piece','g','kg','ml','l'].map(value=>({value,label:texteUniteInventaire(value)})),q?.unit||'portion');unit.name='unit';
 const etat=select([{value:'available',label:t('Disponible')},{value:'finished',label:t('Tout consommé')}],lu?.projection.etat==='finished'?'finished':'available');etat.name='state';
 const champs={label:el('input',{name:'label',type:'text',value:lot.label||refs.recipe?.display_title||refs.recipe?.original_title||'',maxlength:1000}),quantity_text:el('input',{name:'quantity_text',type:'text',value:lot.quantity_text||'',maxlength:10000}),location:select([{value:'congelateur',label:t('Congélateur')},{value:'frigo',label:t('Frigo')},{value:'garde_manger',label:t('Garde-manger')}],lot.location||'frigo'),prepared_on:el('input',{name:'prepared_on',type:'date',value:lot.prepared_on||''}),use_by_on:el('input',{name:'use_by_on',type:'date',value:lot.use_by_on||''}),reheat_method:el('input',{name:'reheat_method',value:lot.reheat_method||'',maxlength:10000}),expected_quality:el('input',{name:'expected_quality',value:lot.expected_quality||'',maxlength:10000}),notes:el('textarea',{name:'notes',rows:3,value:lot.notes||'',maxlength:10000})};champs.location.name='location';
 const quantite=el('div',{class:'row'},field(t('Quantité restante'),nombre),field(t('Unité'),unit));
 const details=el('details',{class:'card'},el('summary',null,t('Détails facultatifs')),el('div',{class:'stack'},field(t('Mention d’origine'),champs.quantity_text),...(lu?[field(t('Quantité initiale, si connue'),initial),field(t('État du lot'),etat)]:[]),field(t('Préparé le — date indiquée par toi'),champs.prepared_on),field(t('À utiliser avant — date indiquée par toi'),champs.use_by_on),field(t('Réchauffage'),champs.reheat_method),field(t('Qualité attendue'),champs.expected_quality),field(t('Notes'),champs.notes)));
 const datesRetirees=new Set();
 for(const[k,d]of[['prepared_on',lu?.projection.dates.prepared],['use_by_on',lu?.projection.dates.use_by]])if(d&&d.origine!=='aucune'){
  const ancien=el('p',{class:'muted'},t('Date conservée : {date}',{date:dateLotInventaire(d)})),retirer=el('button',{class:'btn',type:'button',dataset:{role:'retirer-'+k},onClick:()=>{champs[k].value='';datesRetirees.add(k);ancien.textContent=t('Cette date sera retirée à l’enregistrement.');}},t('Retirer cette date'));
  champs[k].addEventListener('input',()=>{if(champs[k].value)datesRetirees.delete(k);});details.append(el('div',{class:'stack'},ancien,retirer));
 }
 const source=el('p',{class:'muted'}),afficherSource=()=>{source.textContent=refs.recipe?t('Source : {titre}',{titre:refs.recipe.display_title||refs.recipe.original_title||t('Recette')}):t('Sans recette source');};afficherSource();details.append(source);
 if(!lu&&!refs.history){const versions=(ctx.recipe_versions||[]).filter(v=>recettesActives(ctx).some(r=>r.id===v.recipe_id)),choice=select([{value:'',label:t('Sans recette source')},...versions.map(v=>({value:v.id,label:(ctx.recipesById?.get(v.recipe_id)?.display_title||ctx.recipesById?.get(v.recipe_id)?.original_title||t('Recette'))+' · '+label('version_kind',v.kind)}))],refs.version?.id||'',id=>{const v=versions.find(x=>x.id===id),r=ctx.recipesById?.get(v?.recipe_id);refs=v&&r?clone({recipe:r,version:v,edition:ctx.editionsById?.get(r.edition_id)||null,history:null}):referencesVides();afficherSource();});details.append(field(t('Recette source'),choice));}
 const message=el('p',{role:'alert',class:'status warn',hidden:true}),contenu=el('fieldset',{class:'stack'},field(t('Quoi'),champs.label),field(t('Combien'),mode),quantite,field(t('Où'),champs.location),legacy?el('p',{class:'status warn'},t('Confirme la quantité de cet ancien lot. Aucun stock ne sera utilisé à cet enregistrement.')):null,details);
 const dlg=el('dialog',{class:'inventaire-formulaire',dataset:{role:'formulaire-lot'},style:{maxWidth:'min(42rem, calc(100vw - 2rem))'}},el('h2',null,lu?t('Modifier le lot'):t('Ajouter un lot')),contenu,message);
 let occupe=false,ferme=false,intention=null,signature=null,presentation;const liberer=protegerSaisie(dlg);const nombreVisible=()=>{quantite.hidden=mode.value!=='connue';initial.disabled=mode.value!=='connue';};mode.addEventListener('change',nombreVisible);nombreVisible();
 return new Promise(resolve=>{
  const fermer=r=>{if(ferme)return;ferme=true;presentation?.fermer();dlg.remove();liberer();resolve(r);};
  const annuler=el('button',{type:'button',class:'btn',onClick:()=>{if(!occupe)fermer(null);}},t('Annuler'));
  const enregistrer=el('button',{type:'button',class:'btn primary',dataset:{role:'enregistrer-lot'},onClick:()=>{void(async()=>{
   if(occupe||ferme)return;occupe=true;contenu.disabled=true;annuler.disabled=true;enregistrer.disabled=true;message.hidden=true;
   try{if(!estCourante())throw{code:'contexte_change'};
    let stock={format:1,unit:null,initial:null,remaining:null,state:lu?etat.value:'available'};
    if(mode.value==='connue'){const n=lireQuantiteInventaire(nombre.value,unit.value);if(!n.ok)throw{code:n.raison};let debut=n.valeur;if(lu){if(initial.value==='')debut=null;else{const d=lireQuantiteInventaire(initial.value,unit.value);if(!d.ok)throw{code:d.raison};debut=d.valeur;}}stock={...stock,unit:unit.value,initial:debut,remaining:n.valeur};}
    const payload=Object.fromEntries(Object.entries(champs).map(([k,input])=>[k,k.endsWith('_on')?input.value||null:input.value]));payload.stock=stock;
    const sig=JSON.stringify({payload,refs,datesRetirees:[...datesRetirees]});if(signature!==sig){intention=null;signature=sig;}
    if(!intention){let p;if(lu){const patch={};for(const[k,input]of Object.entries(champs)){const valeur=payload[k],before=k.endsWith('_on')?(lot[k]??null):lot[k]??'';if(valeur!==before||datesRetirees.has(k))patch[k]=valeur;}if(Object.hasOwn(patch,'use_by_on'))patch.use_by_origin=patch.use_by_on?'user':null;
     p=await service.preparerModification({portee,lecture:lu.lecture,patch,stock:!legacy&&JSON.stringify(stock)===JSON.stringify(lot.stock)?null:stock});
    }else p=await service.preparerCreation({portee,creation,affiche:refs,payload});
    if(p.issue==='sans_changement'){fermer(p);return;}if(p.issue!=='ok')throw{code:p.raison};intention=p.intention;}
    const r=await service.appliquer({intention});if(!['conserve','deja_conserve'].includes(r.issue)){message.hidden=false;message.textContent=texteErreurInventaire(r);return;}fermer(r);
   }catch(e){message.hidden=false;message.textContent=texteErreurInventaire(e);}finally{occupe=false;if(!ferme){contenu.disabled=false;nombreVisible();annuler.disabled=false;enregistrer.disabled=false;}}
  })();}},t('Enregistrer'));
  dlg.append(el('div',{class:'row'},annuler,enregistrer));dlg.addEventListener('cancel',e=>{e.preventDefault();if(!occupe)fermer(null);});presentation=ouvrirDialogue(dlg,{focusInitial:champs.label,estCourante});
 });
}
export function ouvrirMouvementLot({service,portee,lu,action,estCourante=()=>true}){
 const amount=el('input',{type:'text',name:'amount',inputmode:'decimal'}),message=el('p',{class:'status warn',role:'alert',hidden:true}),apercu=el('div',{class:'stack'}),dlg=el('dialog',{class:'inventaire-formulaire',dataset:{role:'mouvement-lot'}},el('h2',null,action==='consume'?t('Utiliser une quantité'):action==='finish'?t('Tout consommé'):t('Annuler cette consommation')),el('p',null,lu.projection.label),el('p',null,t('Restant : {quantite}',{quantite:quantiteInventaire(lu.projection)})),...(action==='consume'?[field(t('Quantité utilisée'),amount)]:[]),apercu,message);
 const liberer=protegerSaisie(dlg);let intention=null,occupe=false,ferme=false,presentation;
 return new Promise(resolve=>{const fermer=r=>{if(ferme)return;ferme=true;presentation?.fermer();dlg.remove();liberer();resolve(r);};
  const annuler=el('button',{class:'btn',type:'button',onClick:()=>{if(!occupe)fermer(null);}},t('Annuler'));
  const confirmer=el('button',{class:'btn primary',type:'button',dataset:{role:'confirmer-mouvement'},onClick:()=>{void(async()=>{
   if(occupe||ferme)return;occupe=true;confirmer.disabled=true;annuler.disabled=true;amount.disabled=true;message.hidden=true;
   try{if(!estCourante())throw{code:'contexte_change'};if(!intention){let r;if(action==='consume'){const q=lireQuantiteInventaire(amount.value,lu.projection.quantite.unit);if(!q.ok)throw{code:q.raison};r=await service.preparerConsommation({portee,lecture:lu.lecture,amount:q.valeur});}else r=await service[action==='finish'?'preparerFin':'preparerAnnulation']({portee,lecture:lu.lecture});if(r.issue!=='ok')throw{code:r.raison};intention=r.intention;apercu.replaceChildren(el('p',null,t('Après confirmation : {quantite}',{quantite:quantiteInventaire(r.apercu.after)})));confirmer.textContent=t('Confirmer');return;}
    const r=await service.appliquer({intention});if(!['conserve','deja_conserve'].includes(r.issue)){message.hidden=false;message.textContent=texteErreurInventaire(r);return;}fermer(r);
   }catch(e){message.hidden=false;message.textContent=texteErreurInventaire(e);}finally{occupe=false;if(!ferme){confirmer.disabled=false;annuler.disabled=false;amount.disabled=false;}}
  })();}},t('Voir le résultat'));
  amount.addEventListener('input',()=>{intention=null;apercu.replaceChildren();confirmer.textContent=t('Voir le résultat');});dlg.append(el('div',{class:'row'},annuler,confirmer));dlg.addEventListener('cancel',e=>{e.preventDefault();if(!occupe)fermer(null);});presentation=ouvrirDialogue(dlg,{focusInitial:action==='consume'?amount:annuler,estCourante});
 });
}
