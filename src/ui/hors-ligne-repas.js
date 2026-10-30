// Préparation locale d'un repas : une capture en mémoire et des preuves relues, sans écriture métier.
import {el,downloadBlob} from '../core/dom.js';
import {t} from '../core/i18n.js';
import {urlDeBlob,revoquerUrlDeBlob} from '../core/blob-urls.js';
import {sha256Hex} from '../core/hash.js';
import {obtenirControleLivraison} from '../core/livraison.js';
import {typeAffichage,displayUrl,extensionFor} from '../sync/mime.js';
import {remoteValide} from '../sync/tables.js';
import {preparerLectureRecette,projeterLectureRecette} from '../domain/lecture-recette.js';
import {LIMITES_HORS_LIGNE,preparerPerimetreHorsLigne,projeterPreparationHorsLigne,diagnosticPreparationHorsLigne,projectionDonneesHorsLigne,projectionRepasHorsLigne,egalesLecturesHorsLigne} from '../domain/hors-ligne.js';
import {getSyncGeneration,protegerSaisie} from './state.js';
import {lienAvecOrigine} from './navigation-contexte.js';
import {buildQuery,navigate} from '../core/router.js';
import {pageAffichable} from './components.js';
const EPOQUE='editor_library_epoch:v1',copie=x=>structuredClone(x);
const STORES={recettes:'recipes',versions:'recipe_versions',editions:'book_editions',traductions:'recipe_translations',cuissons:'cook_history',pages:'source_pages',documents:'source_documents'};
const erreur=raison=>Object.assign(Error(raison),{code:raison});
// Toutes les requêtes dépendantes sont enchaînées dans les callbacks d'une même transaction readonly.
export async function lireFermetureHorsLigne(db,meal){
 if(!Array.isArray(meal?.items)||meal.items.length>LIMITES_HORS_LIGNE.occurrences)throw erreur('volume_non_verifie');
 const tx=await db.tx([...Object.values(STORES),'meals','sync_state'],'readonly'),d=Object.fromEntries(Object.keys(STORES).map(k=>[k,[]])),vus=new Set();let lignes=0,octets=0,cause=null;
 return new Promise((resolve,reject)=>{
  const retour={donnees:d,meal:null,owner:null,epoch:null};
  tx.oncomplete=()=>resolve(retour);tx.onerror=()=>reject(cause||tx.error||erreur('lecture_impossible'));tx.onabort=()=>reject(cause||tx.error||erreur('lecture_impossible'));
  const garde=fn=>event=>{try{fn(event.target.result);}catch(e){cause=e;tx.abort();}};
  const retenir=(nom,row)=>{if(!row||d[nom].some(x=>x.id===row.id))return;const taille=new TextEncoder().encode(JSON.stringify(row)).length;lignes++;octets+=taille;if(lignes>LIMITES_HORS_LIGNE.lignes||octets>LIMITES_HORS_LIGNE.octets)throw erreur('volume_non_verifie');d[nom].push(row);};
  const fileIds=[];let requetesIds=0;
  const pomperIds=()=>{while(fileIds.length&&requetesIds<LIMITES_HORS_LIGNE.ids){const {nom,id,suite}=fileIds.shift();requetesIds++;tx.objectStore(STORES[nom]).get(id).onsuccess=garde(row=>{retenir(nom,row);if(row)suite?.(row);requetesIds--;pomperIds();});}};
  const get=(nom,id,suite)=>{if(typeof id!=='string'||!id||vus.has(nom+':'+id))return;vus.add(nom+':'+id);fileIds.push({nom,id,suite});pomperIds();};
  const index=(nom,key,id)=>{const cle=nom+':'+key+':'+id;if(vus.has(cle))return;vus.add(cle);const req=tx.objectStore(STORES[nom]).index(key).openCursor(IDBKeyRange.only(id));req.onsuccess=garde(cursor=>{if(!cursor)return;retenir(nom,cursor.value);cursor.continue();});};
  tx.objectStore('meals').get(meal.id).onsuccess=garde(r=>retour.meal=r??null);
  tx.objectStore('sync_state').get('user_id').onsuccess=garde(r=>retour.owner=r??null);
  tx.objectStore('sync_state').get(EPOQUE).onsuccess=garde(r=>retour.epoch=r??null);
  // Au plus64 nouvelles occurrences par tour de requête, dans cette même transaction.
  const items=meal.items;let offset=0;
  const tranche=()=>{for(const it of items.slice(offset,offset+LIMITES_HORS_LIGNE.ids)){
    get('recettes',it.recipe_id,r=>{get('editions',r.edition_id);for(const id of r.source_page_ids||[])get('pages',id,p=>get('documents',p.document_id));});
    get('versions',it.recipe_version_id);if(typeof it.recipe_id==='string')index('cuissons','recipe_id',it.recipe_id);if(typeof it.recipe_version_id==='string')index('traductions','recipe_version_id',it.recipe_version_id);
   }offset+=LIMITES_HORS_LIGNE.ids;if(offset<items.length)tx.objectStore('meals').get(meal.id).onsuccess=garde(tranche);};tranche();
 });
}
const textesEtat=()=>({pret:t('Prêt hors ligne pour cette sélection.'),partiel:t('Préparation partielle : des éléments manquent.'),perime:t('Ce bilan a changé. Vérifie à nouveau le repas.'),inconnu:t('La disponibilité hors ligne n’est pas encore vérifiée.')});
const texteRaison=raison=>({version_absente:t('Version demandée indisponible'),recette_absente:t('Recette indisponible'),recette_retiree:t('Recette retirée : consultation historique seulement.'),contenu_absent:t('Le contenu de cette recette n’est pas encore disponible.'),traduction_absente:t('Traduction demandée indisponible'),traductions_concurrentes:t('Choisis la traduction à consulter.'),page_absente:t('Une page source manque.'),document_absent:t('Un document source manque.'),volume_non_verifie:t('Ce volume dépasse la limite de cette vérification.'),donnees_changees:t('Les données ont changé depuis l’ouverture de ce panneau.'),coquille_inconnue:t('L’application hors ligne n’est pas vérifiée.'),coquille_incomplete:t('L’application hors ligne est incomplète.'),coquille_non_controlee:t('Cette page est ouverte en ligne. Sa disponibilité hors ligne n’est pas vérifiée.'),coquille_incompatible:t('Cette version de l’application ne peut pas être vérifiée hors ligne.'),compte:t('Ce fichier appartient à un autre compte.'),connexion:t('Connecte le compte de cette bibliothèque pour recevoir ses fichiers.'),pause:t('La réception de fichiers est en pause.'),sans_copie:t('Aucune copie distante de ce fichier n’est disponible.'),erreur_envoi:t('Ce fichier a une erreur d’envoi. Consulte Réglages.'),erreur_fichier_changee:t('L’erreur du fichier a changé. Vérifie à nouveau.'),quota:t('Le fichier n’a pas pu être conservé. Vérifie l’espace disponible.'),reseau:t('La réception n’a pas abouti. Vérifie la connexion.'),timeout:t('La vérification de ce fichier n’a pas abouti à temps.')}[raison]||t('Cette vérification n’a pas pu aboutir.'));
export function creerPreparationHorsLigne({meal,ctx,repo,moteur=ctx?.sync?.moteur,estCourante=()=>true,livraison=obtenirControleLivraison(),deps={}}){
 const affiche=copie(meal),base=repo.db,generation=(deps.getGeneration||getSyncGeneration)(),getGeneration=deps.getGeneration||getSyncGeneration;
 const root=el('section',{class:'card stack hors-ligne-repas',dataset:{role:'preparation-hors-ligne'},'aria-label':t('Préparer hors ligne')});
 let dispose=false,passe=0,occupe=false,annule=false,decodagesActifs=0;const attenteDecodage=[],interruptionsDecodage=new Set();let capture=null,fermetureInitiale=null,scope=null,bilan=null,mediasPrives=new Map(),erreurGeste=null,limite=LIMITES_HORS_LIGNE.detail;
 const choix={lectures:(affiche.items||[]).map(()=>({locale:['fr','en'].includes(ctx.settings?.reading_locale)?ctx.settings.reading_locale:'original',translation_id:null})),medias:null};
 const courante=()=>!dispose&&estCourante()&&repo.db===base&&getGeneration()===generation;
 const libererRefresh=protegerSaisie(root);
 const statut=el('p',{role:'status',dataset:{role:'bilan-hors-ligne'}},textesEtat().inconnu),contenu=el('div',{class:'hors-ligne-details stack'});
 const verifierBouton=el('button',{type:'button',class:'btn',onClick:()=>verifier()},t('Vérifier à nouveau'));
 const recevoirBouton=el('button',{type:'button',class:'btn',onClick:()=>telechargerSelection()},t('Télécharger la sélection'));
 const stopBouton=el('button',{type:'button',class:'btn',hidden:true,onClick:()=>{annule=true;stopBouton.disabled=true;}},t('Arrêter après ce fichier'));
 const fermerBouton=el('button',{type:'button',class:'btn',onClick:()=>{root.dispose();root.remove();}},t('Fermer la préparation'));
 root.append(el('h2',null,t('Préparer hors ligne')),el('p',null,t('Vérifie ce repas, ses notes et les médias choisis sur cet appareil. Ce bilan ne confirme pas leur synchronisation.')),statut,el('div',{class:'row hors-ligne-actions'},verifierBouton,recevoirBouton,stopBouton,fermerBouton),contenu);
 const desabonner=livraison?.observer?.(observation=>{if(!courante()||!bilan)return;if(observation?.raison==='worker_change')passe++;bilan={...bilan,etat:'perime',raisons:[...bilan.raisons,'coquille_changee']};dessiner();});
 function poserInconnu(raison){bilan=capture?projeterPreparationHorsLigne({...capture,passe},{passe,fermeture:'inconnue'}):{format:1,etat:'inconnu',observe_le:null,recettes:(affiche.items||[]).map((it,ordinal)=>({ordinal,recipe_id:it.recipe_id,version_id:it.recipe_version_id,etat:'inconnue'})),medias:[],limites:[],raisons:[]};bilan.limites=raison==='volume_non_verifie'?[raison]:[];bilan.raisons=[raison];dessiner();return copie(bilan);}
 function validerScope(lu){if(!courante()||(ctx.proprietaireDonnees??null)!==(lu.owner?.value??null))return false;if(!scope){scope={owner:copie(lu.owner),epoch:copie(lu.epoch)};return (ctx.proprietaireDonnees??null)===(lu.owner?.value??null);}return egalesLecturesHorsLigne(scope.owner,lu.owner)&&egalesLecturesHorsLigne(scope.epoch,lu.epoch);}
 const fermetureEgale=(a,b)=>egalesLecturesHorsLigne(projectionRepasHorsLigne(a.meal||{}),projectionRepasHorsLigne(b.meal||{}))&&egalesLecturesHorsLigne(projectionDonneesHorsLigne(a.donnees),projectionDonneesHorsLigne(b.donnees));
 async function verifier(){
  if(!courante())return{etat:'perime'};const n=++passe;erreurGeste=null;statut.textContent=t('Vérification sur cet appareil…');
  try{
   const lu=await attendre(lireFermetureHorsLigne(base,affiche));if(!courante()||n!==passe)return{etat:'perime'};
   const scopeValide=validerScope(lu);
   if(!scopeValide){bilan={format:1,etat:'perime',observe_le:null,recettes:[],medias:[],limites:[],raisons:['donnees_changees']};dessiner();return copie(bilan);}
   const mealValide=!!lu.meal&&egalesLecturesHorsLigne(projectionRepasHorsLigne(lu.meal),projectionRepasHorsLigne(affiche));
   const change=!scopeValide||!mealValide||(fermetureInitiale&&!fermetureEgale(fermetureInitiale,lu));
   if(!fermetureInitiale)fermetureInitiale=copie(lu);
   const p=preparerPerimetreHorsLigne({meal:affiche,donnees:fermetureInitiale.donnees,choix:{...choix,passe:n,capture_le:new Date().toISOString()}});
   if(p.issue!=='ok')return poserInconnu(p.raison);capture=p.capture;
   if(change){bilan=projeterPreparationHorsLigne(capture,{passe:n,fermeture:'perimee'});dessiner();return copie(bilan);}
   const lectures=[];
   for(const o of capture.occurrences){
    if(o.raison){lectures.push({etat:'indisponible',raison:o.raison});continue;}
    const r=capture.recettes.find(r=>r.id===o.recipe_id),v=capture.versions.find(v=>v.id===o.version_id),lp=await attendre(preparerLectureRecette({recipe:r,version:v,traductions:capture.traductions}));
    if(!courante()||n!==passe)return{etat:'perime'};
    const candidates=lp.lectures.filter(x=>x.row.locale===o.locale),existe=o.translation_id?candidates.find(x=>x.row.id===o.translation_id):candidates.length===1?candidates[0]:null;
    const veut=o.locale!=='original'&&o.locale!==lp.originalLocale?.split('-')[0];let raison=null;
    if(o.locale!=='original'&&o.translation_id&&!existe)raison='traduction_absente';else if(o.locale!=='original'&&candidates.length>1&&!existe)raison='traductions_concurrentes';else if(veut&&!existe)raison=candidates.length>1?'traductions_concurrentes':'traduction_absente';else if(existe&&!['courante','partielle'].includes(existe.lecture.etat))raison='traduction_absente';
    const projection=projeterLectureRecette(lp,{locale:o.locale,translationId:o.translation_id,servings:o.servings??v.servings,system:'original'});
    // Une candidate unique est désormais choisie dans le lien, sans changer le repas.
    o.translation_id=projection.traductionId;lectures.push({etat:raison?'indisponible':'disponible',raison,mixte:projection.manque});
   }
   const ids=[...new Set(capture.usages.map(u=>u.sha256))],observes=[],prives=new Map();let index=0;
   await Promise.all(Array.from({length:Math.min(LIMITES_HORS_LIGNE.decodages,ids.length)},async()=>{while(index<ids.length){const id=ids[index++];if(!courante()||n!==passe)return;if(Array.isArray(choix.medias)&&!choix.medias.includes(id)){observes.push({sha256:id,etat:'inconnu',octets:null});continue;}const r=await observerFichier(id,n);observes.push(r.observation);prives.set(id,r);}}));
   const livraisonVue=await livraison?.verifier?.();if(!courante()||n!==passe)return{etat:'perime'};
   let finale=await attendre(lireFermetureHorsLigne(base,affiche)),stable=validerScope(finale)&&fermetureEgale(lu,finale);
   // Relire les octets observés : une ligne remplacée pendant le décodage n'hérite pas du succès.
   for(const [id,r]of prives){if(!courante()||n!==passe)return{etat:'perime'};const f=await attendre(repo.getFile(id));if(!egalesLecturesHorsLigne(r.meta,metaFichier(f))||r.empreinte!==null&&(!(f?.blob instanceof Blob)||await attendre(sha256Hex(f.blob))!==r.empreinte)){stable=false;break;}}
   finale=await attendre(lireFermetureHorsLigne(base,affiche));stable=stable&&validerScope(finale)&&fermetureEgale(lu,finale);
   if(!courante()||n!==passe)return{etat:'perime'};mediasPrives=prives;
   bilan=projeterPreparationHorsLigne(capture,{passe:n,observe_le:new Date().toISOString(),fermeture:stable?'courante':'perimee',lectures,medias:observes,livraison:{etat:livraisonVue?.etat??'inconnue',courante:livraisonVue?livraison?.estCourante?.(livraisonVue)===true:true}});
   dessiner();return copie(bilan);
  }catch(e){if(!courante()||n!==passe)return{etat:'perime'};return poserInconnu(e?.code||'lecture_impossible');}
 }
 const metaFichier=f=>{if(!f)return null;const m=copie({...f,blob:null});delete m.updated_at;m.blob=f.blob instanceof Blob?{size:f.blob.size,type:f.blob.type}:null;return m;};
 async function attendre(p){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(erreur('timeout')),deps.delai??LIMITES_HORS_LIGNE.delai);})]);}finally{clearTimeout(timer);}}
 function reveillerDecodage(){while(attenteDecodage.length&&decodagesActifs<LIMITES_HORS_LIGNE.decodages){const w=attenteDecodage.shift();if(!courante()||w.n!==passe){w.resolve(false);continue;}decodagesActifs++;w.resolve(true);}}
 function reserverDecodage(n){if(!courante()||n!==passe)return Promise.resolve(false);if(decodagesActifs<LIMITES_HORS_LIGNE.decodages){decodagesActifs++;return Promise.resolve(true);}return new Promise(resolve=>attenteDecodage.push({n,resolve}));}
 async function observerFichier(id,n){
  let f=null,err=null,empreinte=null,observation={sha256:id,etat:'inconnu',octets:null};
  try{[f,err]=await attendre(Promise.all([repo.getFile(id),repo.get('sync_state','file_error:'+id)]));
   if(!courante()||n!==passe)return{fichier:f?{...f,blob:null}:null,present:f?.blob instanceof Blob,meta:metaFichier(f),erreur:err,empreinte,observation};
   if(!(f?.blob instanceof Blob)){observation={...observation,etat:'manquant',raison:err?.value?.sens==='envoi'?'erreur_envoi':!remoteValide(f?.remote)?'sans_copie':f.remote.owner!==(scope.owner?.value??null)?'compte':null};}
   else{const type=typeAffichage(f);empreinte=await attendre(sha256Hex(f.blob));observation={...observation,octets:f.blob.size,type:type?.startsWith('image/')?'image':'document',copie:f.remote?.quality==='reduite'?'reduite':'locale',etat:type?'utilisable':'illisible'};
    if(type?.startsWith('image/')){let u,img,slot=false,interrompre;try{slot=await reserverDecodage(n);if(!slot)throw erreur('passe_changee');u=displayUrl(f,urlDeBlob);img=new Image();img.src=u;const interruption=new Promise((_,reject)=>{interrompre=()=>reject(erreur('passe_changee'));interruptionsDecodage.add(interrompre);});await attendre(Promise.race([deps.decoder?deps.decoder(img,f):img.decode(),interruption]));if(!img.naturalWidth&&!deps.decoder)throw erreur('illisible');}catch(e){observation.etat=['timeout','passe_changee'].includes(e?.code)?'inconnu':'illisible';observation.raison=e?.code||'illisible';}finally{if(interrompre)interruptionsDecodage.delete(interrompre);if(img)img.removeAttribute('src');if(u)revoquerUrlDeBlob(u);if(slot){decodagesActifs--;reveillerDecodage();}}}
   }
  }catch(e){observation={...observation,etat:'inconnu',raison:e?.code||'lecture_impossible'};}
  return{fichier:f?{...f,blob:null}:null,present:f?.blob instanceof Blob,meta:metaFichier(f),erreur:err,empreinte,observation};
 }
 function dessiner(){
  if(dispose)return;statut.textContent=erreurGeste?texteRaison(erreurGeste):textesEtat()[bilan?.etat||'inconnu'];root.dataset.etat=bilan?.etat||'inconnu';recevoirBouton.disabled=occupe||!bilan||bilan.etat==='perime'||!bilan.medias.some(m=>m.selectionne&&m.etat==='manquant');verifierBouton.disabled=occupe;stopBouton.hidden=!occupe;stopBouton.disabled=false;
  const focus=contenu.contains(document.activeElement)?document.activeElement.dataset.hlFocus:null;contenu.replaceChildren();if(!bilan)return;
  if(bilan.etat==='perime')contenu.append(el('button',{class:'btn',onClick:()=>navigate('/meals/'+encodeURIComponent(affiche.id),{replace:true})},t('Revoir le repas')));
  for(const r of bilan.raisons||[])contenu.append(el('p',{class:'muted'},texteRaison(r)));
  const rs=el('div',{class:'hors-ligne-recettes stack'}),ms=el('div',{class:'hors-ligne-medias stack'});
  for(const o of bilan.recettes.slice(0,limite)){
   const recipe=capture?.recettes.find(r=>r.id===o.recipe_id),title=recipe?.display_title||recipe?.original_title||ctx.recipesById?.get(o.recipe_id)?.display_title||ctx.recipesById?.get(o.recipe_id)?.original_title||t('Recette non vérifiée'),choisi=choix.lectures[o.ordinal];
   const langue=el('select',{dataset:{hlFocus:'langue-'+o.ordinal},'aria-label':t('Langue de lecture'),disabled:occupe,onChange:e=>{choisi.locale=e.target.value;choisi.translation_id=null;invaliderChoix();}},...['original','fr','en'].map(v=>el('option',{value:v,selected:v===choisi.locale},v==='original'?t('Original'):v==='fr'?t('Français'):t('Anglais'))));
   const candidates=(capture?.traductions||[]).filter(x=>x.recipe_version_id===o.version_id&&x.locale===choisi.locale),choixTr=candidates.length>1?el('select',{dataset:{hlFocus:'traduction-'+o.ordinal},'aria-label':t('Choisir une traduction'),disabled:occupe,onChange:e=>{choisi.translation_id=e.target.value||null;invaliderChoix();}},el('option',{value:''},t('Choisir une traduction')),...candidates.map((x,i)=>el('option',{value:x.id,selected:choisi.translation_id===x.id},t('Traduction {n}',{n:i+1})))):null;
   const lien=o.etat==='disponible'?el('a',{class:'btn',href:lienAvecOrigine(`/recipes/${encodeURIComponent(o.recipe_id)}${buildQuery({v:o.version_id,lang:o.locale,...(o.translation_id?{translation:o.translation_id}:{})})}`,ctx.navigation?{cleEntree:ctx.navigation.cleEntree}:{})},t('Consulter cette version')):null;
   rs.append(el('div',{class:'card flat stack'},el('strong',null,title),el('div',{class:'row'},langue,choixTr),o.raison?el('p',null,texteRaison(o.raison)):null,o.mixte?el('p',{class:'muted'},t('Lecture partielle : certains passages restent dans la langue d’origine.')):null,lien));
  }
  const roles={photo_plat:t('Photo du plat'),photo_cuisson:t('Photo de cuisson'),page_source:t('Page source'),document_source:t('Document source')};
  for(const m of bilan.medias.slice(0,limite)){
   const p=mediasPrives.get(m.sha256),label=m.usages.map(u=>{const page=u.role==='page_source'?capture.pages.find(p=>p.id===u.id):null,history=u.role==='photo_cuisson'?capture.cuissons.find(h=>h.id===u.id):null;const liees=capture.recettes.filter(r=>u.role==='photo_plat'?r.id===u.id:u.role==='photo_cuisson'?r.id===history?.recipe_id:u.role==='page_source'?(r.source_page_ids||[]).includes(u.id):capture.pages.some(p=>p.document_id===u.id&&(r.source_page_ids||[]).includes(p.id)));const noms=liees.map(r=>r.display_title||r.original_title||t('Sans titre'));const nomPage=page?(pageAffichable(page.printed_page)?t('Page {p}',{p:page.printed_page}):t('page non numérotée')):roles[u.role];return[nomPage,...noms].join(' · ');}).join(' ; '),checkbox=el('input',{type:'checkbox',dataset:{hlFocus:'media-'+m.sha256},checked:m.selectionne,disabled:occupe,onChange:e=>{const selected=new Set(choix.medias||bilan.medias.map(x=>x.sha256));if(e.target.checked)selected.add(m.sha256);else selected.delete(m.sha256);choix.medias=[...selected];invaliderChoix();}});
   ms.append(el('div',{class:'card flat stack'},el('label',{class:'row'},checkbox,el('span',null,label)),el('p',null,!m.selectionne?t('Exclu de cette préparation.'):m.etat==='utilisable'?(m.type==='document'?t('Fichier conservé. Ouvre-le pour vérifier son contenu.'):m.copie==='reduite'?t('Copie réduite disponible sur cet appareil.'):t('Image disponible sur cet appareil.')):m.etat==='manquant'?t('Fichier absent de cet appareil.'):m.etat==='illisible'?t('Fichier conservé mais illisible ici.'):t('Fichier non vérifié.')),
    m.raison?el('p',{class:'muted'},texteRaison(m.raison)):null,
    m.etat==='manquant'&&p?.erreur?.value?.sens==='reception'?el('button',{class:'btn',disabled:occupe,onClick:()=>reessayer(m.sha256)},t('Réessayer ce téléchargement')):null,
    p?.present?el('button',{class:'btn',onClick:async()=>{try{const f=await repo.getFile(m.sha256);if(courante()&&f?.blob instanceof Blob)downloadBlob(f.blob,f.original_filename||`fichier.${extensionFor(typeAffichage(f))}`);}catch{erreurGeste='lecture_impossible';dessiner();}}},t('Télécharger le fichier')):null));
  }
  contenu.append(rs,ms);if(bilan.recettes.length>limite||bilan.medias.length>limite)contenu.append(el('button',{class:'btn',onClick:()=>{limite+=LIMITES_HORS_LIGNE.detail;dessiner();}},t('Voir plus')));
  const d=diagnosticPreparationHorsLigne(bilan);contenu.append(el('p',{class:'muted'},t('{r} recette(s), {n} fichier(s) sélectionné(s), {e} exclu(s).',{r:d.recettes.total,n:d.medias.selectionnes,e:d.medias.exclus})));
  if(focus&&document.activeElement===document.body)[...contenu.querySelectorAll('[data-hl-focus]')].find(n=>n.dataset.hlFocus===focus)?.focus({preventScroll:true});
 }
 function invaliderChoix(){passe++;if(bilan)bilan={...bilan,etat:'perime'};dessiner();void verifier();}
 async function recevoir(ids,retry=null){
  if(occupe||!courante()||!bilan||bilan.etat==='perime')return{etat:'perime'};occupe=true;annule=false;erreurGeste=null;dessiner();
  try{for(const id of ids){if(annule||!courante())break;const p=mediasPrives.get(id);if(p?.present)continue;
    const lu=await attendre(lireFermetureHorsLigne(base,affiche));if(!validerScope(lu)||!fermetureEgale(fermetureInitiale,lu)){passe++;bilan={...bilan,etat:'perime'};break;}
    if(!moteur||ctx.sync?.user?.id!==(scope.owner?.value??null)||!scope.owner?.value){erreurGeste='connexion';break;}
    if(moteur.etat?.()?.pause||moteur.etat?.()?.pauseFichiers||(await repo.get('sync_state','pause_fichiers'))?.value){erreurGeste='pause';break;}
    if(!remoteValide(p?.fichier?.remote)){erreurGeste='sans_copie';continue;}if(p.fichier.remote.owner!==scope.owner.value){erreurGeste='compte';continue;}
    let resultat;if(p.erreur){if(id!==retry||p.erreur.value?.sens!=='reception'){erreurGeste=p.erreur.value?.sens==='envoi'?'erreur_envoi':'erreur_fichier_changee';continue;}resultat=await moteur.reessayerFichier(id,{erreurAttendue:copie(p.erreur),sensAttendu:'reception'});}else resultat=await moteur.telecharger([id]);
    const cause=resultat?.refuse?resultat.raison:resultat?.erreur?.type;const b=await verifier();if(cause)erreurGeste=cause;if(b.etat==='perime'||cause)break;
   }
  }catch(e){erreurGeste=e?.name==='QuotaExceededError'?'quota':e?.code||'reseau';}
  finally{occupe=false;if(courante())dessiner();}return copie(bilan||{etat:'inconnu'});
 }
 const telechargerSelection=()=>recevoir((bilan?.medias||[]).filter(m=>m.selectionne&&m.etat==='manquant').map(m=>m.sha256));
 const reessayer=id=>recevoir([id],id);
 root.verifier=verifier;root.telechargerSelection=telechargerSelection;root.reessayer=reessayer;root.etat=()=>copie(bilan);root.diagnostic=()=>diagnosticPreparationHorsLigne(bilan);
 root.dispose=()=>{if(dispose)return;dispose=true;libererRefresh();passe++;annule=true;desabonner?.();for(const interrompre of interruptionsDecodage)interrompre();for(const w of attenteDecodage.splice(0))w.resolve(false);mediasPrives.clear();};
 // Initialisation uniquement en lecture ; une demande ultérieure invalide cette passe par son numéro.
 void verifier();return root;
}
