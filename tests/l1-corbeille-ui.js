import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderRecipe } from '../src/ui/recipe.js';
import { renderLibrary } from '../src/ui/library.js';
import { renderMeal } from '../src/ui/meals.js';
import { renderShoppingList } from '../src/ui/grocery.js';
import { renderKitchen } from '../src/ui/kitchen.js';
import { renderCook } from '../src/ui/cook.js';
import { panneauCycleRecette, renderCorbeille } from '../src/ui/corbeille.js';
import { mettreALaCorbeille, restaurerRecette } from '../src/domain/corbeille.js';
import { renderSignet, signetModel, majSignet } from '../src/ui/signet.js';
import { enregistrerCuissons, enregistrerTextePersonnel, modifierPhotosCuisson } from '../src/ui/cuisson.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';

const recette = (id, cycle = {}) => ({id, original_title:id, original_language:'fr', edition_id:null, availability:'available', current_version_id:`v-${id}`, source_page_ids:[], favorite:true, ...cycle});
const version = id => ({id:`v-${id}`,recipe_id:id,kind:'extraction',servings:2,ingredients:[{id:'sel',source_text:'Sel',name_text:'Sel'}],steps:[{id:`s-${id}`,position:1,text:'Remuer doucement.',timers:[]}]});
const retiree = {lifecycle_id:'cycle-retiree-l1',trashed_at:'2026-10-29T12:00:00.000Z'};
const bouton = (root, text) => [...root.querySelectorAll('button')].find(n=>n.textContent===text);
const attendre = async fn => {for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Résultat non observé');};
const monter = root => { document.body.append(root);return ()=>{root.dispose?.();root.remove();};};
export async function runL1CorbeilleUiTests({eq,ok}) {
  const locale=getUiLocale();setUiLocale('fr');
  const run=async(name,fn)=>{try{await fn();}catch(e){ok(false,`L1 UI ${name} : ${e.stack||e}`);}};
  try {
    await run('projections',()=>withRepo(async(repo,db)=>{
      await db.mutate({origin:'remote',puts:{recipes:[recette('active'),recette('retiree',retiree),recette('invalide',{trashed_at:'hier'})],recipe_versions:['active','retiree','invalide'].map(version)}});
      const ctx=await getData(true);
      eq(ctx.recettesActives?.map(r=>r.id),['active'],'L1 UI : seule la recette active reste dans les nouveaux choix');
      eq(ctx.docsActifs?.map(d=>d.recipe.id),['active'],'L1 UI : documents actifs distincts du catalogue conservé');
      eq([ctx.recipesById.size,ctx.docsByRecipe.size,ctx.versionsById.size],[3,3,3],'L1 UI : maps historiques exhaustives');
      const root=await renderLibrary({}, {},ctx),dispose=monter(root);
      try {eq([...root.querySelectorAll('h3 a')].map(n=>n.textContent),['active'],'L1 bibliothèque : recettes retirée et invalide exclues');ok([...root.querySelectorAll('a')].some(a=>a.getAttribute('href')==='#/corbeille'),'L1 bibliothèque : accès durable à la corbeille');}finally{dispose();}
    }));
    await run('fiche conservée',()=>withRepo(async(repo,db)=>{
      await db.mutate({origin:'remote',puts:{recipes:[recette('retiree',{...retiree,personal_notes:'Ma note conservée'})],recipe_versions:[version('retiree')]}});
      const avant=await repo.get('recipes','retiree');
      const root=await renderRecipe({id:'retiree'},{v:'v-retiree'},await getData(true)),dispose=monter(root);
      try {
        ok(root.textContent.includes('Cette recette est dans la corbeille'),'L1 fiche : état de corbeille explicite');
        ok(bouton(root,'Restaurer'),'L1 fiche : restauration explicite accessible');
        ok(root.textContent.includes('Remuer doucement.')&&root.textContent.includes('Ma note conservée'),'L1 fiche : étape et note restent consultables');
        eq([...root.querySelectorAll('a')].filter(a=>/\/(edit|photo|reperes|thermomix|importer)(?:\?|$)/.test(a.getAttribute('href')||'')).length,0,'L1 fiche : aucun lien de mutation sur la recette retirée');
        ok(!bouton(root,'Commencer à cuisiner')&&!bouton(root,'Ajouter à mon repas'),'L1 fiche : pas de nouvel usage depuis la consultation historique');
        eq(await repo.get('recipes','retiree'),avant,'L1 fiche : consulter ne restaure ni ne modifie la recette');
      } finally {dispose();}
    }));
    await run('anciennes références',()=>withRepo(async(repo,db)=>{
      const meal={id:'m-l1',title:'Ancien repas',items:[{id:'mi-l1',recipe_id:'retiree',recipe_version_id:'v-retiree'}],servings:2,constraints_snapshot:{diets:[]}};
      const list={id:'l-l1',title:'Anciennes courses',items:meal.items,checked:{}};
      const session={id:'cs-l1',status:'active',recipe_id:'retiree',selected_version_ids:['v-retiree'],servings:2,progress:{done_step_ids:[],by_version:{}}};
      await db.mutate({origin:'remote',puts:{recipes:[recette('retiree',retiree)],recipe_versions:[version('retiree')],meals:[meal],shopping_lists:[list],cook_sessions:[session]}});
      const ctx=await getData(true);
      for(const [nom,render,id] of [['repas',renderMeal,meal.id],['courses',renderShoppingList,list.id],['cuisine',renderCook,session.id]]){
        const root=await render({id},{},ctx),dispose=monter(root);
        try {ok(root.textContent.includes('retiree')||root.textContent.includes('Remuer doucement.'),`L1 ${nom} : ancienne recette toujours présente`);ok(root.textContent.includes('corbeille'),`L1 ${nom} : mention du retrait`);}finally{dispose();}
      }
    }));
    await run('mentions de corbeille sans texte parasite',()=>withRepo(async(repo,db)=>{
      const recettes=[recette('mention-active'),recette('mention-retiree',retiree)];
      const listes=recettes.map(r=>({id:`liste-${r.id}`,title:'Courses',items:[{recipe_id:r.id,recipe_version_id:r.current_version_id,servings:2}],checked:{}}));
      const sessions=recettes.map(r=>({id:`session-${r.id}`,status:'active',selected_version_ids:[r.current_version_id],servings:2,progress:{done_step_ids:[],by_version:{}}}));
      await db.mutate({origin:'remote',puts:{recipes:recettes,recipe_versions:recettes.map(r=>version(r.id)),shopping_lists:listes,cook_sessions:sessions}});
      const ctx=await getData(true);
      for(const [i,r] of recettes.entries())for(const [nom,render,id] of [['courses',renderShoppingList,listes[i].id],['cuisine',renderCook,sessions[i].id]]){
        const root=await render({id},{},ctx),dispose=monter(root);
        try {
          const textes=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),parasites=[];let texte;
          while((texte=textes.nextNode()))if(/^(?:null|undefined)$/.test(texte.textContent.trim()))parasites.push(texte.textContent);
          eq(parasites,[],`L1 ${nom} : aucun texte parasite pour une recette ${i?'retirée':'active'}`);
          eq([...root.querySelectorAll('[data-role=mention-corbeille] a')].map(a=>a.getAttribute('href')),i?[`#/recipes/${r.id}`]:[],`L1 ${nom} : mention et accès à la fiche uniquement pour la recette retirée`);
        }finally{dispose();}
      }
    }));
    await run('retrait et annulation durables',()=>withRepo(async(repo,db)=>{
      const r=recette('commande',{personal_notes:'Note privée conservée'}),v=version('commande');
      await db.mutate({origin:'remote',puts:{recipes:[r],recipe_versions:[v]}});
      const ctx=await getData(true);let refreshes=0;
      const root=await panneauCycleRecette(r,ctx,{refresh:()=>{refreshes++;}}),dispose=monter(root);
      try {
        bouton(root,'Mettre à la corbeille').click();bouton(root,'Mettre à la corbeille').click();
        await attendre(()=>refreshes===1);
        const retiree=await repo.get('recipes',r.id);
        ok(retiree.trashed_at&&retiree.lifecycle_id,'L1 commande : marqueur réellement écrit avant succès');
        eq(retiree.personal_notes,r.personal_notes,'L1 commande : note préservée');
        eq(await repo.get('recipe_versions',v.id),v,'L1 commande : version originale intacte');
        eq((await repo.all('outbox')).filter(x=>x.op==='lifecycle').length,1,'L1 commande : double clic ne crée qu’une commande');
        const seconde=await panneauCycleRecette(retiree,await getData(true),{refresh:()=>{refreshes++;}}),nettoyer=monter(seconde);
        try {ok(bouton(seconde,'Annuler'),'L1 commande : vraie action Annuler après retrait');bouton(seconde,'Annuler').click();await attendre(()=>refreshes===2);eq((await repo.get('recipes',r.id)).trashed_at,null,'L1 Annuler : restauration durable sans suppression du jeton');}finally{nettoyer();}
      } finally {dispose();}
    }));
    await run('corbeille et états à vérifier',()=>withRepo(async(repo,db)=>{
      await db.mutate({origin:'remote',puts:{recipes:[recette('retiree',retiree),recette('invalide',{trashed_at:'hier'})],recipe_versions:[version('retiree'),version('invalide')]}});
      const root=await renderCorbeille({}, {},await getData(true)),dispose=monter(root);
      try {
        ok(root.querySelector('[data-role=cycles-a-verifier]')?.textContent.includes('invalide'),'L1 corbeille : cycle mal formé toujours retrouvable');
        eq(root.querySelectorAll('[data-role=restaurer-recette]').length,1,'L1 corbeille : pas de réparation automatique d’un cycle invalide');
        root.querySelector('[data-role=restaurer-recette]').click();
        await attendre(()=>root.textContent.includes('La corbeille est vide.'));
        eq(document.activeElement,root.querySelector('h1'),'L1 corbeille : focus au titre après dernière restauration');
      }finally{dispose();}
    }));
    await run('capacité et refus visibles',()=>withRepo(async(repo,db)=>{
      const r=recette('cap');await db.mutate({origin:'remote',puts:{recipes:[r]}});
      const ctx=await getData(true);
      const inconnu=await panneauCycleRecette(r,{...ctx,proprietaireDonnees:'compte-inconnu',sync:{user:{id:'compte-inconnu'}}});
      ok(bouton(inconnu,'Mettre à la corbeille').disabled&&inconnu.textContent.includes('pas encore disponible'),'L1 capacité : compte inconnu ne promet pas une corbeille synchronisable');
      let connue=false,passes=0;
      await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'compte-inconnu'}]}});
      const verifiable=await panneauCycleRecette(r,{...ctx,proprietaireDonnees:'compte-inconnu',sync:{user:{id:'compte-inconnu'},moteur:{envoyerMaintenant:async()=>{passes++;connue=true;}}}},{capacite:async()=>connue});
      const finVerification=monter(verifiable);
      const verifier=bouton(verifiable,'Vérifier la disponibilité');
      try {
        ok(verifier,'L1 capacité : vérification explicite proposée sans recharger la fiche');
        if(verifier){verifier.click();await attendre(()=>!bouton(verifiable,'Mettre à la corbeille').disabled);eq(passes,1,'L1 capacité : bouton activé après confirmation du serveur');}
      } finally {finVerification();await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:null}]}});}

      const casse=await panneauCycleRecette(r,ctx,{repo:{...repo,commanderCycleRecette:async()=>{throw Error('disque');}},refresh:()=>{throw Error('succès fictif');}});
      bouton(casse,'Mettre à la corbeille').click();await attendre(()=>!bouton(casse,'Mettre à la corbeille').disabled);
      ok(casse.textContent.includes('n’a pas pu être mise'),'L1 panne : refus visible sans faux succès');
      eq(await repo.get('recipes',r.id),r,'L1 panne : recette inchangée');
      const parentAbsent=await panneauCycleRecette({...r,edition_id:'ed'},ctx);
      ok(parentAbsent.textContent.includes('à vérifier')&&!parentAbsent.querySelector('button'),'L2 : édition absente expliquée, aucune commande sur son membre');
    }));
    await run('capacité du propriétaire après déconnexion',()=>withRepo(async(repo,db)=>{
      const active=recette('deconnectee-active'),retireeLocale=recette('deconnectee-retiree',retiree);
      await db.mutate({origin:'remote',puts:{recipes:[active,retireeLocale],sync_state:[{key:'user_id',value:'proprietaire-deconnecte'}]}});
      const ctx={...await getData(true),sync:{user:null,moteur:null}};
      const absente=await panneauCycleRecette(active,ctx),restaurationAbsente=await panneauCycleRecette(retireeLocale,ctx);
      eq([bouton(absente,'Mettre à la corbeille').disabled,bouton(restaurationAbsente,'Restaurer').disabled],[true,true],'L1 déconnexion : retrait et restauration désactivés sans capacité du propriétaire des données');
      ok(absente.textContent.includes('Connecte-toi avec une application à jour'),'L1 déconnexion : indisponibilité expliquée avant un geste');
      await db.put('sync_state',{key:'lifecycle-capability:autre-compte',value:{protocol:1}});
      const autre=await panneauCycleRecette(active,ctx);
      eq(bouton(autre,'Mettre à la corbeille').disabled,true,'L1 déconnexion : la capacité d’un autre compte n’active pas la corbeille');
      await db.put('sync_state',{key:'lifecycle-capability:proprietaire-deconnecte',value:{protocol:1}});
      let refreshes=0;
      const connue=await panneauCycleRecette(active,ctx,{refresh:()=>{refreshes++;}}),restaurationConnue=await panneauCycleRecette(retireeLocale,ctx,{refresh:()=>{refreshes++;}});
      eq([bouton(connue,'Mettre à la corbeille').disabled,bouton(restaurationConnue,'Restaurer').disabled],[false,false],'L1 déconnexion : capacité déjà confirmée autorise les gestes locaux pour ce propriétaire');
      bouton(connue,'Mettre à la corbeille').click();await attendre(()=>refreshes===1);
      ok(!!(await repo.get('recipes',active.id)).trashed_at,'L1 déconnexion : retrait réellement enregistré avec la capacité connue');
      bouton(restaurationConnue,'Restaurer').click();await attendre(()=>refreshes===2);
      eq((await repo.get('recipes',retireeLocale.id)).trashed_at,null,'L1 déconnexion : restauration réellement enregistrée avec la capacité connue');
    }));
    await run('restauration périmée',()=>withRepo(async(repo,db)=>{
      const r=recette('perimee',retiree);await db.mutate({origin:'remote',puts:{recipes:[r]}});
      const root=await panneauCycleRecette(r,await getData(true),{refresh:()=>{throw Error('succès périmé');}});
      const active=(await restaurerRecette(r)).recipe;
      const nouvelle=(await mettreALaCorbeille(active)).recipe;
      bouton(root,'Restaurer').click();await attendre(()=>!bouton(root,'Restaurer').disabled);
      eq((await repo.get('recipes',r.id)).lifecycle_id,nouvelle.lifecycle_id,'L1 restauration : ancienne commande ne défait pas un retrait indépendant');
      ok(root.textContent.includes('n’a pas pu être restaurée'),'L1 restauration périmée : refus explicite');
    }));
    await run('doublon web en corbeille',async()=>{
      const r=recette('url',{...retiree,source_url:'https://example.org/recette'});
      const m=signetModel({adresse:r.source_url,titre:'Plat',doublon:r});
      const root=renderSignet(m);
      ok(root.textContent.includes('Cette recette est dans la corbeille'),'L1 URL : statut du doublon retiré explicite');
      ok(root.querySelector('[data-role=enregistrer]').disabled,'L1 URL : aucun doublon ajouté automatiquement');
      ok([...root.querySelectorAll('a')].some(a=>a.textContent==='Consulter et restaurer'),'L1 URL : restauration proposée par la fiche');
      majSignet(root,{...m,doublon:{...r,trashed_at:null}});
      ok(root.textContent.includes('Tu as déjà gardé cette adresse.'),'L1 URL : mise à jour en place suit l’état du doublon');
    });
    await run('ancien favori et ancien repas',()=>withRepo(async(repo,db)=>{
      const r=recette('ancienne'),v=version('ancienne'),meal={id:'ancien-repas-l1',title:'Repas',items:[{id:'mi',recipe_id:r.id,recipe_version_id:v.id}],servings:2,constraints_snapshot:{diets:[]}};
      await db.mutate({origin:'remote',puts:{recipes:[r],recipe_versions:[v],meals:[meal]}});
      const ctx=await getData(true),messages=[];
      const fiche=await renderRecipe({id:r.id},{},ctx,{toast:m=>messages.push(m)}),nettoyer=monter(fiche);
      const repas=await renderMeal({id:meal.id},{},ctx,{toast:m=>messages.push(m),navigate:()=>{throw Error('navigation refusée');}});
      try {
        await mettreALaCorbeille(r);const avant=await repo.get('recipes',r.id);
        fiche.querySelector('button[title=Favori]').click();await attendre(()=>messages.length===1);
        eq(await repo.get('recipes',r.id),avant,'L1 ancien favori : refus sans restauration ni modification');
        bouton(repas,'Voir mes courses').click();await attendre(()=>messages.length===2);
        eq(await repo.all('shopping_lists'),[],'L1 ancien repas : aucune nouvelle liste avec cible retirée');
      }finally{nettoyer();repas.dispose?.();}
    }));
    await run('session déjà créée',()=>withRepo(async(repo,db)=>{
      const r=recette('session',retiree),v=version('session');v.steps.push({id:'s-suite',position:2,text:'Servir.',timers:[]});
      const cs={id:'cs-suite',recipe_id:r.id,status:'active',selected_version_ids:[v.id],servings:2,progress:{done_step_ids:[],by_version:{}}};
      await db.mutate({origin:'remote',puts:{recipes:[r],recipe_versions:[v],cook_sessions:[cs]}});
      const root=await renderCook({id:cs.id},{},await getData(true)),dispose=monter(root);
      try {bouton(root,'Suivant →').click();await attendre(()=>root.textContent.includes('Servir.'));eq((await repo.get('cook_sessions',cs.id)).progress.by_version[v.id].current_step_id,'s-suite','L1 historique : progression d’une session existante conservée');eq((await repo.get('recipes',r.id)).trashed_at,r.trashed_at,'L1 historique : avancer ne restaure jamais la recette');}finally{dispose();}
    }));
    await run('gestes de cuisson et fichiers atomiques',()=>withRepo(async(repo,db)=>{
      const r=recette('memoire'),v=version('memoire'),h={id:'h-memoire',recipe_id:r.id,recipe_version_id:v.id,notes:'Avant',photos:[],cooked_at:'2026-10-28T12:00:00.000Z'};
      await db.mutate({origin:'remote',puts:{recipes:[r],recipe_versions:[v],cook_history:[h]}});
      const contexte=await repo.capturerContexteRecette(r);
      const retiree=(await mettreALaCorbeille(r)).recipe;
      await restaurerRecette(retiree);
      let refus=false;
      try {await enregistrerTextePersonnel('recipes',r.id,'personal_notes','','Trop tard',{repo,recettes:[contexte]});}catch{refus=true;}
      ok(refus,'L1 note personnelle : ancien dialogue refusé après retrait puis restauration');
      refus=false;
      try {await enregistrerCuissons([{recipe:r,version:v,id:'h-nouvelle',form:{date:'2026-10-28',notes:'',photos:[]}}],{repo,recettes:[contexte]});}catch{refus=true;}
      ok(refus&&!(await repo.get('cook_history','h-nouvelle')),'L1 cuisson : ancien nouveau bilan refusé après cycle différent');
      const actuelle=(await mettreALaCorbeille(await repo.get('recipes',r.id))).recipe;
      const historique=await repo.capturerContexteRecette(actuelle,{historique:true});
      await enregistrerTextePersonnel('cook_history',h.id,'notes','Avant','Après',{repo,recettes:[historique]});
      eq((await repo.get('cook_history',h.id)).notes,'Après','L1 observation : modification historique autorisée dans la corbeille');
      const sha='e'.repeat(64),blob=new Blob(['photo historique'],{type:'image/jpeg'});
      await modifierPhotosCuisson(h.id,{ajouter:[sha]},{repo,recettes:[historique],fichiers:[{sha256:sha,blob,meta:{mime:blob.type}}]});
      ok((await repo.getFile(sha))?.blob&& (await repo.get('cook_history',h.id)).photos.includes(sha),'L1 photo historique : fichier et lien enregistrés dans la même transaction');
      const orphan='f'.repeat(64);refus=false;
      try {await modifierPhotosCuisson('h-absente',{ajouter:[orphan]},{repo,recettes:[historique],fichiers:[{sha256:orphan,blob,meta:{mime:blob.type}}]});}catch{refus=true;}
      ok(refus&&!(await repo.getFile(orphan)),'L1 photo refusée : aucun fichier orphelin');
    }));
    for (const kind of ['reperes','thermomix']) await run('relecture explicite '+kind,()=>withRepo(async(repo,db)=>{
      const P=await import('../src/domain/'+kind+'-parcours.js');
      const UI=await import('../src/ui/'+kind+'.js');
      const F=await import(kind==='reperes'?'./visuel-reperes.js':'./i3-thermomix.js');
      const source=kind==='reperes'?F.sourceReperes():{recipe:{id:'recipe-source',original_title:'Tomates',availability:'available'},version:F.sourceThermomix()};
      const {recipe:r,version:v}=source;
      await db.mutate({origin:'remote',puts:{recipes:[r],recipe_versions:[v]}});
      const row=await (kind==='reperes'?P.ouvrirReperes:P.ouvrirThermomix)({recipeId:r.id,versionId:v.id,selection:['s1']},{repo});
      const ancienContexte=await repo.capturerContexteRecette(r);
      const resultat=kind==='reperes'?F.reponseReperes():F.propositionThermomix();
      await db.mutate({origin:'remote',puts:{imports:[{...row,status:'a_verifier',resultat}],recipes:[{...r,lifecycle_id:'restauree-pour-relire',trashed_at:null}]}});
      let calls=0;
      const root=await (kind==='reperes'?UI.renderReperesRoute:UI.renderThermomixRoute)({id:r.id},{import:row.id},{},{repo,sessionAssistant:async()=>null,fetch:async()=>{calls++;throw Error('appel interdit');},navigate:()=>{},remplacerAdresse:()=>{},toast:()=>{}}),dispose=monter(root);
      try {
        const revoir=root.querySelector('[data-role=revoir-lecture-cycle]');
        ok(revoir&&!revoir.disabled,'L1 '+kind+' : nouvelle relecture proposée après restauration');
        if (!revoir) return;
        const gardeur=root.querySelector(kind==='reperes'?'[data-role=garder-reperes]':'[data-role=garder-tm7]');
        ok(!gardeur||gardeur.disabled,'L1 '+kind+' : ancien résultat impossible à garder directement');
        revoir.click();await root.attendreEcritures();
        eq((await repo.get('imports',row.id)).expected_cycle_id,'restauree-pour-relire','L1 '+kind+' : cycle courant accepté par geste explicite');
        eq((await repo.get('imports',row.id)).resultat,resultat,'L1 '+kind+' : résultat déjà reçu conservé');
        ok(!root.querySelector('[name=relecture]').checked,'L1 '+kind+' : confirmation de relecture remise à zéro');
        eq(calls,0,'L1 '+kind+' : aucun nouvel appel assistant');
        const journalAvant=await repo.get('imports',row.id),recetteAvant=await repo.get('recipes',r.id),versionsAvant=await repo.all('recipe_versions');
        let refuse=false;
        try {await (kind==='reperes'?P.garderReperes:P.garderThermomix)({importId:row.id,relu:true,contexteRecette:ancienContexte},{repo});}catch{refuse=true;}
        ok(refuse,'L1 '+kind+' : ancienne confirmation refusée après relecture dans un autre onglet');
        eq([await repo.get('recipes',r.id),await repo.all('recipe_versions')],[recetteAvant,versionsAvant],'L1 '+kind+' : ancienne confirmation sans mutation culinaire');
        await db.mutate({origin:'remote',puts:{imports:[journalAvant]}});
        refuse=false;
        try {await (kind==='reperes'?P.modifierBrouillonReperes:P.modifierThermomix)(row.id,kind==='reperes'?{saisie:{description_fr:'Ancien écran'}}:{demande:'Ancien écran'},{repo,contexteRecette:ancienContexte});}catch{refuse=true;}
        ok(refuse,'L1 '+kind+' : ancien éditeur ne modifie pas un résultat remis en relecture ailleurs');

      }finally{dispose();}
    }));
    await run('anciens usages modifiables',()=>withRepo(async(repo,db)=>{
      const r=recette('ancien-usage',retiree),v=version('ancien-usage');
      const items=[{id:'mi',recipe_id:r.id,recipe_version_id:v.id,servings:2}];
      const m={id:'meal-h',title:'Soupe',items,servings:2,constraints_snapshot:{diets:[]}};
      await db.mutate({origin:'remote',puts:{recipes:[r],recipe_versions:[v],meals:[m],shopping_lists:[{id:'list-h',title:'Courses',items,checked:{}}],inventory:[{id:'inv-h',source_recipe_id:r.id,source_recipe_version_id:v.id,label:'Soupe',portions:3,location:'frigo'}]}});
      const ctx=await getData(true),liste=await renderShoppingList({id:'list-h'},{},ctx),d1=monter(liste);
      try {const cb=liste.querySelector('input[type=checkbox]');cb.click();await attendre(()=>!cb.disabled);ok(Object.values((await repo.get('shopping_lists','list-h')).checked).includes(true),'L1 courses historiques : une case reste enregistrable après retrait');}finally{d1();}
      const repas=await renderMeal({id:m.id},{},ctx,{refresh:()=>{}}),d2=monter(repas);
      try {const champ=repas.querySelector('input[type=number]');champ.value='3';champ.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,60));eq((await repo.get('meals',m.id)).servings,3,'L1 repas historique : les portions du repas restent modifiables');}finally{d2();}
      const cuisine=await renderKitchen({},{tab:'inventory'},ctx),d3=monter(cuisine);
      try {
        cuisine.querySelector('[data-role=modifier-lot]').click();await attendre(()=>document.querySelector('[data-role=formulaire-lot]'));let d=document.querySelector('[data-role=formulaire-lot]');d.querySelector('[data-role=enregistrer-lot]').click();await attendre(()=>!d.isConnected);await attendre(()=>cuisine.querySelector('[data-role=consommer-lot]'));eq((await repo.get('inventory','inv-h')).stock.remaining,3,'L1 inventaire historique : adoption explicite après retrait sans consommation');
        // La liste peut être redessinée avant la fin de la comparaison qui libère le geste précédent.
        await attendre(()=>cuisine.querySelector('[data-role=ajouter-lot]')?.disabled===false);
        cuisine.querySelector('[data-role=consommer-lot]').click();d=document.querySelector('[data-role=mouvement-lot]');d.querySelector('[name=amount]').value='1';const b=d.querySelector('[data-role=confirmer-mouvement]');b.click();await attendre(()=>b.textContent==='Confirmer'&&!b.disabled);b.click();await attendre(()=>!d.isConnected);eq((await repo.get('inventory','inv-h')).stock.remaining,2,'L1 inventaire historique : consommer une portion reste possible');
      }finally{for(const d of document.querySelectorAll('[data-role=formulaire-lot],[data-role=mouvement-lot]'))d.dispatchEvent(new Event('cancel',{cancelable:true}));d3();}
    }));
    await run('copie de conflit de cycle',async()=>{
      const S=await import('../src/ui/settings.js');
      const conflit={id:'cycle-ui',kind:'cycle',store:'recipes',record_id:'r-cycle',local:{id:'r-cycle',original_title:'Mon titre conservé',personal_notes:'Ma note à récupérer'},recipe_id:'r-cycle'};
      const model=S.syncSectionModel({available:true,user:{id:'compte'},guard:{ok:true},moteur:{enCours:false},conflits:[conflit]});
      const root=document.createElement('div');root.append(...S.syncSectionL3(model,{garderIci:()=>{},garderAilleurs:()=>{},abandonnerConflitCycle:()=>{}}));
      ok(root.querySelector('pre')?.textContent.includes('Ma note à récupérer'),'L1 conflit : copie locale consultable et récupérable');
      ok(!root.textContent.includes('Garder celle d’ici')&&!root.textContent.includes('Garder celle d’ailleurs'),'L1 conflit : aucun choix ordinaire qui serait refusé');
      ok(bouton(root,'Abandonner ces modifications'),'L1 conflit : abandon explicite de copie proposé');
      let mutations=0;
      const resultat=await S.abandonnerCopieConflit({db:{get:async()=>conflit},id:conflit.id,confirm:async()=>false,appliquer:async()=>{mutations++;return true;}});
      eq([resultat,mutations],[false,0],'L1 conflit : annuler la confirmation conserve la copie');
    });
    await run('retour de lecture après changement de compte',()=>withRepo(async(repo,db)=>{
      const {lancerVol}=await import('../src/ui/import-cible.js');
      const r=recette('vol-compte');
      const row={id:'imp-vol-compte',recipe_id:r.id,kind:'recette',status:'a_lancer',page_ids:['p'],device_id:repo.deviceId()};
      await db.mutate({origin:'remote',puts:{recipes:[r],imports:[row]}});
      const ctx={recipesById:new Map([[r.id,r]]),proprietaireDonnees:null,sync:{user:{id:'compte'},auth:{jeton:async()=>({access_token:'test',user:{id:'compte'}})}}};
      await lancerVol(row.id,async()=>{await db.put('sync_state',{key:'user_id',value:'autre-compte'});return {resultat:{title:'Résultat ancien'},texteBrut:'résultat payé'};},{repo,ctx,enLigne:()=>true,preparer:async()=>({images:[{}],pageIds:['p']})});
      eq((await repo.get('imports',row.id)).status,'en_cours','L1 lecture : retour tardif ne modifie pas le journal sous un autre propriétaire');
    }));
  } finally {setUiLocale(locale);}
}
