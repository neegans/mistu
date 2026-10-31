import {capturerRecette} from './recette-garde.js';
import {mentionCycleRecette} from './corbeille.js';
import {el,toast,confirmDialog} from '../core/dom.js';
import {t} from '../core/i18n.js';
import * as repo from '../model/repo.js';
import {buildShoppingList,preparerSortieCourses} from '../domain/grocery.js';
import {capturerConventionCourses,portionsSaisies,fusionCaseCourses,fusionLigneLibre,fusionRayonCourses,fusionActualisationCourses,validerVolumeRepas,lignesCoursesAffichees,comparerCourses,itemsCoursesRepas,empreinteBaseCourses} from '../domain/repas-courses.js';
import {creerGardeRepas,protectionFormulaireRepas} from './repas-garde.js';
import {protegerSortieEditeur} from './sortie-editeur.js';
import {pageHeader,section,emptyState,estExtractionNonRelue,field,select} from './components.js';
import {lienAvecOrigine} from './navigation-contexte.js';
import {listConventions} from '../domain/units.js';
import {gardeThermomix,lireThermomix} from '../domain/thermomix.js';
import {resoudreVersionThermomix,gardesAscendanceThermomix} from '../domain/thermomix-reprise.js';

export async function renderShoppingList(params,query,ctx,deps={}){
 const list=ctx.shopping_lists.find(l=>l.id===params.id);if(!list)return el('div',{class:'card'},t('Liste introuvable.'));
 const R={...repo,...(deps.repo||{})},navigateur=deps.navigator??navigator,informer=deps.toast??toast;let dispose=false;
 const garde=creerGardeRepas(R,ctx,()=>!dispose),root=el('div',{class:'courses-fiche'});const saisie=protectionFormulaireRepas(root,()=>[...root.querySelectorAll('input[type=text]')].map(i=>i.value).join('\n'));const liberer=protegerSortieEditeur({racine:root,controleur:saisie.controleur});root.dispose=()=>{dispose=true;liberer();};root.flushEditeur=()=>saisie.controleur.flush();root.etatEditeur=saisie.controleur.etat;
 list.checked??={};let mode='restants',actionEnCours=false,editionLibre=null,idLibre=null,busyLibre=false,annulation=null;
 const casesEnCours=new Set(),lignesVisibles=new Map(),hote=el('div',{class:'courses-sections'}),statut=el('p',{role:'status',class:'status warn',hidden:true}),vide=el('p',{class:'muted',role:'status',dataset:{role:'courses-vides'}}),comparaison=el('div',{class:'courses-comparaison'});
 const copier=el('button',{class:'btn',onClick:()=>transmettre('copier')},t('Copier')),partager=typeof navigateur.share==='function'?el('button',{class:'btn',onClick:()=>transmettre('partager')},t('Partager')):null;
 root.append(pageHeader(list.title,{back:{href:list.meal_id?`/meals/${list.meal_id}`:'/meals',label:t('Repas')},actions:[copier,partager].filter(Boolean)}));
 root.append(...[...new Set((list.items||[]).map(it=>it.recipe_id))].map(id=>ctx.recipesById.get(id)).filter(Boolean).map(r=>mentionCycleRecette(r,ctx.editionsById?.get(r.edition_id))).filter(Boolean));
 const items=()=> (list.items||[]).map(it=>{const version=ctx.versionsById.get(it.recipe_version_id),recipe=ctx.recipesById.get(it.recipe_id);return version&&recipe?{version,servings:it.servings??null,title:it.title||recipe.display_title||recipe.original_title,convention_snapshot:it.convention_snapshot??null}:null;}).filter(Boolean);
 const versionsResolues=new Map();let lectureComparaison=false;
 const calculer=entries=>buildShoppingList(entries.map(it=>{const version=versionsResolues.get(it.recipe_version_id)||ctx.versionsById.get(it.recipe_version_id),r=ctx.recipesById.get(it.recipe_id);return version&&r?{version,servings:it.servings??null,title:it.title||r.display_title||r.original_title,convention_snapshot:it.convention_snapshot??null}:null;}).filter(Boolean),ctx.ingredientsById,{locale:ctx.settings?.ui_locale||'fr'});
 let rows=lignesCoursesAffichees(calculer(list.items||[]),list);
 root.append(field(t('Contenu à copier ou partager'),select([{value:'restants',label:t('Ce qu’il reste à acheter')},{value:'complet',label:t('Liste complète')}],mode,v=>{mode=v;actualiserSortie();})),vide);
 root.append(el('p',{class:'muted'},items().map(it=>`${it.title}${it.servings?` (${it.servings} ${t('portions')})`:''}`).join(' · ')));
 const absents=(list.items||[]).filter(it=>!ctx.versionsById.get(it.recipe_version_id)||!ctx.recipesById.get(it.recipe_id));if(absents.length)root.append(el('div',{class:'status warn',dataset:{role:'courses-indisponibles'}},t('{n} élément(s) sans ingrédients disponibles. La liste reste partielle.',{n:absents.length})));
 if(items().some(it=>estExtractionNonRelue(it.version)))root.append(el('div',{class:'status warn',dataset:{role:'bandeau-non-relue'}},t('Lue par l’assistant, non relue')));
 const anciennes=(list.items||[]).filter(it=>lireThermomix(ctx.versionsById.get(it.recipe_version_id))?.etat==='a_revoir');
 if(anciennes.length)root.append(el('div',{class:'status warn',dataset:{role:'thermomix-reprise'}},t('Cette liste utilise une adaptation à revoir. Revois les courses pour utiliser la recette d’origine ; rien ne change sans ta confirmation.')));
 const meal=ctx.meals?.find(m=>m.id===list.meal_id),proposes=meal?itemsCoursesRepas(structuredClone(meal),ctx):null;
 if(meal){const signature=await empreinteBaseCourses(proposes);if(dispose)return root;if(signature!==list.meal_basis_sha256)root.append(el('p',{class:'status info',dataset:{role:'repas-change'}},t('La composition ou la convention diffère du repas.')));root.append(el('button',{class:'btn',dataset:{role:'revoir-courses'},onClick:()=>revoir(meal,proposes,signature)},t('Revoir les courses')));}
 else if(anciennes.length||(list.items||[]).some(it=>!Object.hasOwn(it,'convention_snapshot')))root.append(el('button',{class:'btn',onClick:()=>revoir(null,(list.items||[]).map(it=>({...it,convention_snapshot:Object.hasOwn(it,'convention_snapshot')?it.convention_snapshot:itemsCoursesRepas({items:[{...it,servings_custom:true}],servings:it.servings},ctx)[0].convention_snapshot})),null)},t('Revoir les courses')));
 root.append(comparaison,statut,hote);
 const libelle=el('input',{type:'text',maxLength:1000,dataset:{role:'libelle-ligne-libre'}}),quantite=el('input',{type:'text',maxLength:10000}),rayon=el('input',{type:'text',maxLength:100});
 const enregistrerLibre=el('button',{class:'btn',dataset:{role:'ajouter-ligne-libre'},onClick:conserverLibre},t('Ajouter une ligne'));
 for(const input of [libelle,quantite,rayon])input.addEventListener('input',()=>{saisie.modifier('libre');annulerLibre.hidden=false;});
 const annulerLibre=el('button',{class:'btn',hidden:true,onClick:viderFormulaire},t('Annuler'));
 root.append(el('details',{class:'card courses-libre',open:true},el('summary',null,t('Ligne libre')),field(t('Quoi'),libelle),field(t('Quantité (texte)'),quantite),field(t('Rayon'),rayon),el('div',{class:'row'},enregistrerLibre,annulerLibre)));
 const annulerRetrait=el('button',{class:'btn',hidden:true,onClick:async()=>{if(!annulation)return;const a=annulation;try{await ecrire(c=>{if(!c||(c.manual_lines||[]).some(r=>r.id===a.row.id)||JSON.stringify(c.checked?.['manual:'+a.row.id])!==JSON.stringify(a.checked))throw Error('contenu_change');return{...c,manual_lines:[...(c.manual_lines||[]),a.row]};});annulation=null;annulerRetrait.hidden=true;dessiner(true);}catch{erreur();}}},t('Annuler le retrait'));
 root.append(annulerRetrait,el('small',{class:'muted'},t('Additionnés seulement lorsque l’ingrédient est identique et l’unité convertible. Bouillon et eau restent distincts ; une plage compte sa borne haute.')));
 dessiner(true);return root;

 function erreur(){statut.hidden=false;statut.textContent=t('La liste a changé ou l’enregistrement a échoué. Ta saisie est conservée.');}
 async function contextes(active=false,entries=list.items||[]){const rs=[...new Set(entries.map(it=>it.recipe_id))].map(id=>ctx.recipesById.get(id)).filter(Boolean);return Promise.all(rs.map(r=>capturerRecette(R,r,{ctx,historique:!active})));}
 async function ecrire(fusion,{active=false,entries=list.items||[],conditions={}}={}){const recettes=await contextes(active,entries);let saved;await R.saveBatch({},await garde.options({...conditions,shopping_lists:[{key:list.id,fusion:c=>{const n=fusion(c);if(n)validerVolumeRepas(n);saved=n||c;return n;}}]},recettes));if(dispose)return;Object.assign(list,structuredClone(saved));statut.hidden=true;}
 function dessiner(reconstruire=false){rows=lignesCoursesAffichees(calculer(list.items||[]),list);const restants=el('div',{class:'stack'}),achetes=el('div',{class:'stack'}),groupes=new Map();for(const r of rows){let ligne=lignesVisibles.get(r.key);const signature=JSON.stringify(r);if(!ligne||ligne.signature!==signature){const ancienRayon=ligne?.li.querySelector('input[type=text]')?.value;ligne=creerLigne(r);ligne.signature=signature;if(saisie.generation('rayon:'+r.key)!==undefined&&ancienRayon!==undefined)ligne.li.querySelector('input[type=text]').value=ancienRayon;lignesVisibles.set(r.key,ligne);}if(!casesEnCours.has(r.key))ligne.cb.checked=!!list.checked[r.key];ligne.li.style.opacity=ligne.cb.checked?'.5':'1';const zone=ligne.cb.checked?'oui':'non',cle=zone+':'+r.aisle;if(!groupes.has(cle)){const ul=el('ul',{class:'list'}),bloc=section(r.aisle||t('Sans rayon'),ul);(zone==='oui'?achetes:restants).append(bloc);groupes.set(cle,ul);}groupes.get(cle).append(ligne.li);}
 const n=rows.filter(r=>!!list.checked[r.key]).length;hote.replaceChildren(section(t('Encore à acheter — {n}',{n:rows.length-n}),restants),section(t('Acheté — {n}',{n}),achetes));if(!rows.length)hote.append(emptyState('panier',t('Aucun ingrédient structuré dans ces recettes.')));actualiserSortie();}
 function creerLigne(r){const protection=saisie;const cb=el('input',{type:'checkbox',checked:!!list.checked[r.key],onChange:async()=>{const valeur=cb.checked,base=structuredClone(list);if(casesEnCours.has(r.key))return;cb.disabled=true;casesEnCours.add(r.key);actualiserSortie();try{await ecrire(fusionCaseCourses(base,r.key,valeur));}catch{cb.checked=!!list.checked[r.key];informer(t('La case n’a pas pu être enregistrée. Réessaie.'));}finally{cb.disabled=false;casesEnCours.delete(r.key);if(!dispose)dessiner();}}});
  const details=el('details',null,el('summary',{class:'muted'},t('Par recette ({n})',{n:r.entries.length})),el('ul',{class:'list plain'},...r.entries.map(e=>el('li',null,el('a',{href:lienAvecOrigine(`/recipes/${encodeURIComponent(e.recipe_id)}?v=${encodeURIComponent(e.recipe_version_id)}`)},e.recipe_title),` : ${e.display||e.source_text}`,e.documentaire?el('span',{class:'muted'},' · '+t('Quantités d’origine, portions non ajustées')):null,e.optional?el('span',{class:'muted'},' · '+t('facultatif')):null,e.scaled?el('span',{class:'muted'},' · '+t('recalculé')):null))));
  const actions=el('div',{class:'row'});if(r.manual){actions.append(el('button',{class:'btn small',onClick:()=>{if(busyLibre||saisie.generation('libre')!==undefined){informer(t('Conserve ou annule cette saisie avant de modifier une autre ligne.'));return;}editionLibre=structuredClone(list.manual_lines.find(l=>l.id===r.id));libelle.value=editionLibre.label;quantite.value=editionLibre.quantity_text;rayon.value=editionLibre.aisle;enregistrerLibre.textContent=t('Enregistrer');annulerLibre.hidden=false;libelle.focus();}},t('Modifier')),el('button',{class:'btn small',onClick:async()=>{const base=structuredClone(list),row=base.manual_lines.find(l=>l.id===r.id);if(!(await(deps.confirmDialog??confirmDialog)(t('Retirer cette ligne ?'),{okLabel:t('Retirer')})))return;try{await ecrire(fusionLigneLibre(base,row,null));annulation={row,checked:base.checked?.[r.key]};annulerRetrait.hidden=false;dessiner(true);}catch{erreur();}}},t('Retirer')));}else{const saisie=el('input',{type:'text',maxLength:100,value:r.aisle,'aria-label':t('Rayon')});saisie.addEventListener('input',()=>protection.modifier('rayon:'+r.key));actions.append(saisie,el('button',{class:'btn small',onClick:async()=>{const base=structuredClone(list);try{const seq=protection.generation('rayon:'+r.key);await ecrire(fusionRayonCourses(base,r.key,saisie.value.trim()));protection.confirmer('rayon:'+r.key,seq);dessiner(true);}catch{erreur();}}},t('Enregistrer le rayon')));}
  const li=el('li',{class:'courses-ligne',dataset:{rowKey:r.key}},el('label',{class:'check'},cb,el('div',null,el('div',{class:'row'},el('strong',null,r.label),...r.totals.map(total=>el('span',{class:'qty'},total.text))))),r.manual?null:details,...r.notes.map(n=>el('div',{class:'muted'},n)),actions);return{cb,li};}
 function viderFormulaire(){editionLibre=null;idLibre=null;libelle.value='';quantite.value='';rayon.value='';enregistrerLibre.textContent=t('Ajouter une ligne');annulerLibre.hidden=true;saisie.confirmer('libre');}
 async function conserverLibre(){if(busyLibre)return;const generation=saisie.generation('libre');const text=libelle.value.trim();if(!text||[...text].length>1000||[...quantite.value].length>10000||[...rayon.value].length>100){erreur();return;}const base=structuredClone(list),before=structuredClone(editionLibre);idLibre??=R.newId('course');const row={id:before?.id||idLibre,label:text,quantity_text:quantite.value.trim(),aisle:rayon.value.trim()};busyLibre=true;enregistrerLibre.disabled=true;try{await ecrire(fusionLigneLibre(base,before,row));if(saisie.generation('libre')===generation)viderFormulaire();else{editionLibre=structuredClone(row);idLibre=row.id;enregistrerLibre.textContent=t('Enregistrer');annulerLibre.hidden=false;}dessiner(true);}catch{erreur();}finally{busyLibre=false;enregistrerLibre.disabled=false;}}
 function actualiserSortie(){const sortie=preparerSortieCourses(rows,list.checked,mode);vide.textContent=!sortie.nombre&&mode==='restants'?t('Rien à acheter'):'';copier.disabled=actionEnCours||casesEnCours.size>0||!sortie.nombre;if(partager)partager.disabled=copier.disabled;}
 async function transmettre(action){if(actionEnCours||casesEnCours.size)return;const sortie=preparerSortieCourses(rows,list.checked,mode);if(!sortie.nombre){actualiserSortie();return;}actionEnCours=true;actualiserSortie();try{if(action==='copier'){await navigateur.clipboard.writeText(sortie.texte);informer(t('Liste copiée'));}else await navigateur.share({title:list.title,text:sortie.texte});}catch(e){if(action==='copier')informer(t('Copie impossible'));else if(e?.name!=='AbortError')informer(t('Partage impossible. Tu peux copier la liste.'));}finally{actionEnCours=false;actualiserSortie();}}
 async function revoir(sourceMeal,entries,hash){
  if(lectureComparaison)return;
  if(comparaison.firstChild){comparaison.querySelector('button')?.focus();return;}
  lectureComparaison=true;
  try{
  const base=structuredClone(list),mealAffiche=structuredClone(sourceMeal),next=structuredClone(entries),versions=new Map(next.filter(it=>it.recipe_version_id).map(it=>[it.recipe_version_id,structuredClone(ctx.versionsById.get(it.recipe_version_id))]));
  const ancetres=[];
  for(const it of next){
   if(!it.recipe_version_id)continue;
   const v=versions.get(it.recipe_version_id);
   if(!v||v.recipe_id!==it.recipe_id)throw Error('version_absente');
   if(lireThermomix(v)?.etat==='a_revoir'){
    const resolution=await resoudreVersionThermomix(v,{lire:id=>R.get('recipe_versions',id)});
    if(!resolution.ok)throw Error(resolution.raison);
    portionsSaisies(it.servings);
    if(!gardeThermomix(resolution.version,it.servings).ok)throw Error('thermomix_invalide');
    it.recipe_version_id=resolution.version.id;versionsResolues.set(resolution.version.id,resolution.version);ancetres.push(...resolution.ancetres);
   }else{if(!gardeThermomix(v,it.servings).ok)throw Error('thermomix_invalide');ancetres.push(v);}
  }
  if(dispose)return;
  saisie.modifier('comparaison');
  const bloc=el('div',{class:'card stack'},el('h2',null,t('Revoir les courses'))),differences=el('div',{class:'stack'}),checked={...base.checked},choixCases=new Map();
  for(const [i,it]of next.entries())bloc.append(field(t('Convention de mesure — {r}',{r:it.title||t('Recette')}),select([{value:'',label:t('Convention inconnue')},...listConventions().map(c=>({value:c.id,label:c.labels?.[ctx.settings?.ui_locale||'fr']||c.labels?.fr||c.id}))],it.convention_snapshot?.id||'',id=>{next[i].convention_snapshot=capturerConventionCourses(id);montrerDifferences();})));
  function montrerDifferences(){differences.replaceChildren();const changes=comparerCourses(calculer(base.items||[]),calculer(next));Object.assign(checked,base.checked);for(const d of changes){const li=el('div',{class:'stack'},el('strong',null,d.after?.label||d.before?.label),el('p',null,`${d.before?.totals.map(x=>x.text).join(' + ')||'—'} → ${d.after?.totals.map(x=>x.text).join(' + ')||'—'}`));if(base.checked?.[d.key]&&d.after){checked[d.key]=choixCases.get(d.key)??false;li.append(el('label',{class:'check'},el('input',{type:'checkbox',checked:checked[d.key],onChange:e=>{checked[d.key]=e.target.checked;choixCases.set(d.key,e.target.checked);}}),t('Garder cette ligne achetée')));}differences.append(li);}if(!changes.length)differences.append(el('p',null,t('Aucune quantité ne change. La base de la liste sera confirmée.')));}
  montrerDifferences();bloc.append(differences);
  const garder=el('button',{class:'btn primary',dataset:{role:'conserver-courses'},onClick:async()=>{if(garder.disabled)return;const controles=[...bloc.querySelectorAll('input,select,button')];for(const c of controles)c.disabled=true;const copie=structuredClone(next),cases=structuredClone(checked);try{
   const conditions={...(mealAffiche?{meals:[{key:mealAffiche.id,fusion:c=>{if(!c||JSON.stringify(c.items)!==JSON.stringify(mealAffiche.items)||c.servings!==mealAffiche.servings)throw Error('contenu_change');return null;}}]}:{}),recipe_versions:gardesAscendanceThermomix(ancetres)};
   await ecrire(fusionActualisationCourses(base,{items:copie,checked:cases,meal_basis_sha256:mealAffiche?await empreinteBaseCourses(copie):null}),{active:true,entries:copie,conditions});comparaison.replaceChildren();saisie.confirmer('comparaison');dessiner(true);
  }catch{erreur();}finally{for(const c of controles)c.disabled=false;}}},t('Conserver ces courses'));
  bloc.append(el('div',{class:'row'},garder,el('button',{class:'btn',onClick:()=>{comparaison.replaceChildren();saisie.confirmer('comparaison');}},t('Annuler'))));comparaison.replaceChildren(bloc);garder.focus();
  }catch{erreur();}finally{lectureComparaison=false;}
 }
}
