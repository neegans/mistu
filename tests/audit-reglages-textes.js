import {syncSectionModel,syncSectionL3,renderSettings,creerPanneauDiagnostic,archiveEnCours} from '../src/ui/settings.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';
import {getData,getSyncState,setSyncState} from '../src/ui/state.js';
import {withRepo} from './sync-fixture.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {inspectArchive,verifyRestored} from '../src/domain/backup.js';
import {projeterDiagnosticApp} from '../src/domain/diagnostic-app.js';
import {APP_VERSION,DB_NAME,ARCHIVE_FORMAT} from '../src/model/schema.js';

const noms=[['books','Livres','Books'],['book_editions','Éditions de livres','Book editions'],['source_documents','Documents sources','Source documents'],['source_pages','Pages sources','Source pages'],['scan_sessions','Imports de pages','Page imports'],['dishes','Plats','Dishes'],['dish_recipe_links','Liens entre plats et recettes','Dish and recipe links'],['recipes','Recettes','Recipes'],['recipe_versions','Versions de recettes','Recipe versions'],['recipe_translations','Traductions de recettes','Recipe translations'],['ingredients','Ingrédients','Ingredients'],['unit_definitions','Unités','Units'],['unit_conventions','Conventions de mesure','Measurement conventions'],['substitutions','Remplacements d’ingrédients','Ingredient substitutions'],['appliances','Appareils','Appliances'],['cook_history','Historique de cuisine','Cooking history'],['cook_sessions','Séances de cuisine','Cooking sessions'],['inventory','Inventaire','Inventory'],['meals','Repas','Meals'],['meal_feedback','Notes sur les repas','Meal feedback'],['shopping_lists','Listes de courses','Shopping lists'],['library_activity','Activité de la bibliothèque','Library activity'],['rediscovery_prefs','Préférences de redécouverte','Rediscovery preferences'],['timer_launches','Minuteurs','Timers'],['files','Fichiers','Files'],['assistant_config','Configuration de l’assistant','Assistant settings'],['imports','Imports','Imports'],['settings','Réglages','Settings']];
const base={available:true,user:{id:'u1'},guard:{ok:true},moteur:{enCours:false}};
const bouton=(root,texte)=>[...root.querySelectorAll('button')].find(b=>b.textContent===texte);
const section=(root,texte)=>[...root.querySelectorAll('section')].find(s=>s.querySelector('h2')?.textContent===texte);
const attendre=async(p,description)=>{const fin=performance.now()+5000;while(!p()){if(performance.now()>fin)throw Error('attente dépassée : '+description);await new Promise(r=>setTimeout(r,10));}};
const details=(root,texte)=>[...root.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent===texte);
const AT='2026-10-28T12:00:00.000Z';

export async function runAuditReglagesTextesTests({eq,ok}){
 const langue=getUiLocale(),sync=getSyncState(),racines=[];let archive;
 const run=async(nom,fn)=>{try{await fn();}catch(e){ok(false,`Textes11.5 ${nom} : ${e.stack||e}`);}finally{for(const r of racines.splice(0)){r.dispose?.();r.remove();}document.querySelectorAll('dialog').forEach(d=>d.remove());}};
 const monter=root=>{document.body.append(root);racines.push(root);return root;};
 try{
  setSyncState({moteur:null});
  for(const locale of ['fr','en'])await run('modèle '+locale,()=>{
   setUiLocale(locale);const colonne=locale==='fr'?1:2;
   const quarantaine=noms.map(([store],i)=>({seq:i+1,store,id:'id-'+i,last_error:'forme'})),conflits=noms.map(([store],i)=>({id:'c-'+i,store,record_id:'id-'+i,kind:'translation',origine:'abandon_envoi',resolution:{choix:'abandon'},local:{store},entree:{store,op:'put'}}));
   const avant=structuredClone({quarantaine,conflits}),model=syncSectionModel({...base,quarantaine,conflits});
   eq(model.quarantaine.map(x=>x.libelle),noms.map((row,i)=>`${row[colonne]} · id-${i}`),`Textes11.5 ${locale} : tous les types affichés dans la file`);
   eq(model.conflits.map(x=>x.libelle),noms.map((row,i)=>`${row[colonne]} · id-${i}`),`Textes11.5 ${locale} : mêmes types dans les conflits`);
   const initial=syncSectionModel({...base,moteur:{enCours:true,phase:'initial',progression:{table:'recipes',n:2,total:8}}}),reception=syncSectionModel({...base,moteur:{enCours:true,phase:'reception',progression:{table:'books',n:1,total:4}}});
   eq(initial.progression,locale==='fr'?'Envoi initial : Recettes 2/8':'Initial upload: Recipes 2/8',`Textes11.5 ${locale} : progression initiale traduite`);
   eq(reception.progression,locale==='fr'?'Réception : Livres 1/4':'Receiving: Books 1/4',`Textes11.5 ${locale} : réception traduite`);
   const hostiles=['__proto__','constructor','<img src=x onerror=alert(1)>'],repli=locale==='fr'?'Données':'Data';
   const inconnus=syncSectionModel({...base,quarantaine:hostiles.map((store,i)=>({seq:i,store,id:'inconnu'})),moteur:{enCours:true,phase:'reception',progression:{table:'__proto__',n:1,total:2}}});
   eq(inconnus.quarantaine.map(q=>q.libelle),hostiles.map(()=>repli+' · inconnu'),`Textes11.5 ${locale} : magasin inconnu et propriétés héritées ont un repli neutre`);
   ok(inconnus.progression.includes(repli)&&!inconnus.progression.includes('__proto__'),`Textes11.5 ${locale} : progression inconnue neutre`);
   const appels=[],root=monter(document.createElement('div'));root.append(...syncSectionL3(model,{reessayer:id=>appels.push(id),abandonner:()=>{}}));
   const brut=root.querySelector('[data-conflit="c-0"] pre');eq(JSON.parse(brut?.textContent??'null')?.envoi?.store,'books',`Textes11.5 ${locale} : copie technique conserve le nom de magasin`);
   eq({quarantaine,conflits},avant,`Textes11.5 ${locale} : aucune réécriture des commandes ou copies`);
  });
  for(const locale of ['fr','en'])await run('Réglages réels '+locale,()=>withRepo(async(repo,db)=>{
   setUiLocale(locale);const f=fixtureLectureL6();f.recipe.updated_at=AT;f.version.updated_at=AT;
   await db.mutate({origin:'remote',puts:{books:[{id:'livre-11-5',title:'Cuisine OS est mon titre utilisateur'}],recipes:[f.recipe],recipe_versions:[f.version]}});
   const avant=await db.getSnapshot(['books','recipes','recipe_versions','outbox']),telecharges=[],ctx={...await getData(true),sync:{}};
   const root=monter(await renderSettings({}, {},ctx,{telechargerArchive:(blob,nom)=>telecharges.push({blob,nom}),telechargerRecettes:(blob,nom)=>telecharges.push({blob,nom})}));
   ok(root.querySelector('header')?.textContent.includes('Mistu '+APP_VERSION)||root.textContent.includes('Mistu '+APP_VERSION),`Textes11.5 ${locale} : marque et version dans Réglages`);
   const donnees=section(root,locale==='fr'?'Données sur cet appareil':'Data on this device');
   ok(donnees?.textContent.includes(locale==='fr'?'Ta bibliothèque sur cet appareil':'Your library on this device'),`Textes11.5 ${locale} : phrase locale compréhensible`);
   ok(!donnees?.textContent.includes('cuisine-os')&&!donnees?.textContent.includes('v6'),`Textes11.5 ${locale} : identité technique absente de la phrase locale`);
   const puces=[...donnees?.querySelectorAll('.chip')??[]].map(n=>n.textContent);
   ok(puces.includes((locale==='fr'?'Recettes':'Recipes')+' : 1')&&puces.includes((locale==='fr'?'Livres':'Books')+' : 1'),`Textes11.5 ${locale} : comptes des types réels`);
   ok(!puces.some(s=>/outbox|sync_state|sync_conflicts/.test(s)),`Textes11.5 ${locale} : magasins internes toujours exclus`);
   eq(await db.getSnapshot(['books','recipes','recipe_versions','outbox']),avant,`Textes11.5 ${locale} : montage sans écriture métier`);
   const diagnostic=root.querySelector('.diagnostic-app');eq(diagnostic?.querySelector('p')?.textContent,locale==='fr'?'À envoyer si Mistu se comporte mal : ce diagnostic ne contient aucune recette.':'Send this if Mistu misbehaves: this diagnostic contains no recipes.',`Textes11.5 ${locale} : diagnostic première phrase exacte`);
   ok(root.textContent.includes(locale==='fr'?'Le HTML se lit hors connexion sans Mistu.':'The HTML can be read offline without Mistu.'),`Textes11.5 ${locale} : aide HTML à la marque Mistu`);
   if(locale==='fr'){
    bouton(root,'Sauvegarder toute ma bibliothèque').click();await attendre(()=>telecharges.length===1&&!archiveEnCours(),'archive générée');
    ok(/^mistu-.*\.zip$/.test(telecharges[0].nom),'Textes11.5 : archive téléchargée sous marque Mistu');archive=telecharges[0].blob;
    const inspection=await inspectArchive(await archive.arrayBuffer());eq(inspection.manifest.format,ARCHIVE_FORMAT,'Textes11.5 : identité du format d’archive inchangée');eq(DB_NAME,'cuisine-os','Textes11.5 : identité de la base inchangée');
    const formats=[['Recipe / JSON-LD','mistu-recettes.jsonld'],['YAML compatible Paprika','mistu-recettes.yml'],['Exporter Markdown','mistu-recettes.md'],['Exporter le texte','mistu-recettes.txt'],['Créer une copie lisible (HTML)','mistu-copie-lisible.zip']];
    for(const [label,nom]of formats){const n=telecharges.length;bouton(root,label).click();await attendre(()=>telecharges.length>n,label);eq(telecharges[n].nom,nom,'Textes11.5 : nom téléchargement '+label);ok(telecharges[n].blob.size>0,'Textes11.5 : contenu réellement produit '+label);}
    eq((await db.get('books','livre-11-5')).title,'Cuisine OS est mon titre utilisateur','Textes11.5 : marque du contenu utilisateur inchangée');
   }
  }));
  await run('inspection et restauration réelles',()=>withRepo(async(repo,db)=>{
   setUiLocale('fr');if(!archive)throw Error('archive du témoin précédent absente');const ctx={...await getData(true),sync:{}};
   const root=monter(await renderSettings({}, {},ctx,{pickFiles:async()=>[new File([archive],'test.zip',{type:'application/zip'})]}));
   const restaurer=()=>bouton(root,'Restaurer dans cette base vide')||bouton(root,'Fusionner avec la bibliothèque actuelle');
   bouton(root,'Restaurer une sauvegarde…').click();await attendre(()=>!!restaurer()&&!archiveEnCours(),'inspection réelle');
   const puces=[...root.querySelectorAll('.card.flat .chip')].map(n=>n.textContent);ok(puces.includes('Recettes : 1')&&puces.includes('Versions de recettes : 1')&&puces.includes('Livres : 1'),'Textes11.5 : inspection affiche les mêmes libellés');
   restaurer().click();await attendre(()=>!!document.querySelector('dialog[open]'),'confirmation restauration');bouton(document.querySelector('dialog[open]'),'Restaurer').click();await attendre(()=>!archiveEnCours()&&root.textContent.includes('Restauration vérifiée'),'fin restauration vérifiée');
   ok(root.textContent.includes('Restauration vérifiée'),'Textes11.5 : geste existant de restauration conservé');
   const insp=await inspectArchive(await archive.arrayBuffer());ok((await verifyRestored(db,insp)).ok,'Textes11.5 : contenu réellement relu après restauration');
  }));
  await run('exclusions réelles',()=>withRepo(async(repo,db)=>{
   setUiLocale('fr');const f=fixtureLectureL6();await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version]}});
   await new Promise((resolve,reject)=>{const tx=db.idb.transaction(['recipes'],'readwrite');tx.objectStore('recipes').put({id:'invalide-11-5',lifecycle_id:'cycle',trashed_at:'date-invalide'});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
   const avant=await db.getSnapshot(['recipes','recipe_versions']);let zip;
   const root=monter(await renderSettings({}, {},{...await getData(true),sync:{}},{telechargerArchive:blob=>{zip=blob;}}));bouton(root,'Sauvegarder toute ma bibliothèque').click();await attendre(()=>!!zip&&!archiveEnCours(),'archive partielle réelle');
   ok(root.querySelector('[data-role=exclusions-archive]')?.textContent.includes('Recettes · invalide-11-5'),'Textes11.5 : exclusion de création nommée par type');
   const insp=await inspectArchive(await zip.arrayBuffer());eq(insp.exclues,[{store:'recipes',id:'invalide-11-5',motif:'cycle_recette_invalide'}],'Textes11.5 : exclusion technique du manifeste inchangée');
   const reprise=monter(await renderSettings({}, {},{...await getData(true),sync:{}},{pickFiles:async()=>[new File([zip],'partielle.zip')]}));bouton(reprise,'Restaurer une sauvegarde…').click();await attendre(()=>!!bouton(reprise,'Fusionner avec la bibliothèque actuelle')&&!archiveEnCours(),'inspection partielle');
   const bilans=[...reprise.querySelectorAll('[data-role=exclusions-archive]')];ok(bilans.length>=2&&bilans.every(n=>n.textContent.includes('Recettes · invalide-11-5')),'Textes11.5 : dernier export et inspection partagent le libellé');
   eq(await db.getSnapshot(['recipes','recipe_versions']),avant,'Textes11.5 : affichage des exclusions ne retire aucune fiche locale');
  }));
  await run('fusion partielle',()=>withRepo(async(repo,db)=>{
   setUiLocale('fr');const insp=await inspectArchive(await archive.arrayBuffer()),r=insp.payload.stores.recipes[0];await db.mutate({origin:'remote',puts:{recipes:[{...r,lifecycle_id:'retrait-11-5',trashed_at:'2026-10-30T13:00:00.000Z',updated_at:'2026-10-30T13:00:00.000Z'}],recipe_versions:insp.payload.stores.recipe_versions}});
   const avant=await db.getSnapshot(['recipes','recipe_versions']);const root=monter(await renderSettings({}, {},{...await getData(true),sync:{}},{pickFiles:async()=>[new File([archive],'ancienne.zip')]}));bouton(root,'Restaurer une sauvegarde…').click();await attendre(()=>!!root.querySelector('[data-role=recettes-ecartees]')&&!archiveEnCours(),'proposition fusion partielle');
   const lignes=details(root,'Voir les fiches écartées de cette fusion')?.textContent;ok(lignes?.includes('Recettes · '+r.id)&&lignes?.includes('Versions de recettes · '+r.current_version_id),'Textes11.5 : dépendances écartées nommées par type');
   ok(!!bouton(root,'Fusionner sans les recettes retirées'),'Textes11.5 : geste de fusion partielle préservé');eq(await db.getSnapshot(['recipes','recipe_versions']),avant,'Textes11.5 : proposition de fusion sans écriture');
  }));
  await run('copie diagnostic',async()=>{
   setUiLocale('fr');let copie;const root=monter(creerPanneauDiagnostic({collecter:async()=>projeterDiagnosticApp({version:APP_VERSION,recette:'SECRET',envois:{en_attente:2}}),navigateur:{clipboard:{writeText:async texte=>{copie=texte;}}}}));bouton(root,'Copier le diagnostic').click();await attendre(()=>!!copie,'copie diagnostic');
   ok(!copie.includes('SECRET')&&!copie.includes('recette'),'Textes11.5 : diagnostic copié reste expurgé');eq(JSON.parse(copie).envois.en_attente,2,'Textes11.5 : compte diagnostic conservé');
  });
 }finally{for(const r of racines){r.dispose?.();r.remove();}setUiLocale(langue);setSyncState(sync);}
}
