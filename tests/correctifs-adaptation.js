import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';
import { createArchive, inspectArchive, applyArchive } from '../src/domain/backup.js';
import { toJsonLd, toPaprikaYaml, toReadableSite } from '../src/domain/exporters.js';
import { gardeThermomix } from '../src/domain/thermomix.js';
import { renderRecipeEdit } from '../src/ui/recipe-edit.js';
import { getData } from '../src/ui/state.js';

const at='2026-10-29T12:00:00.000Z';
const fixture=()=>{
  const recipe={id:'correctif-recette',original_title:'Sauce',availability:'available',current_version_id:'correctif-personnelle',source_page_ids:[]};
  const original={id:'correctif-source',recipe_id:recipe.id,kind:'extraction',servings:2,ingredients:[{id:'i',source_text:'400 g de tomates'}],steps:[{id:'s',text:'Faire cuire les tomates.',timers:[]}],provenance:{},updated_at:at};
  const version={...structuredClone(original),id:recipe.current_version_id,kind:'correction',parent_version_id:original.id,steps:[{id:'tm',text:'ANCIEN REGLAGE TM7 A NE PAS EXECUTER',timers:[{seconds:30}]}],provenance:{generated_by:'manual',thermomix:{corrompu:true},thermomix_invalide:true}};
  return {recipe,original,version};
};

export async function runCorrectifsAdaptationTests({eq,ok}) {
  const run=async(nom,fn)=>{try{await fn();}catch(e){ok(false,nom+' : '+(e.stack||e));}};
  await run('Archive documentaire',()=>withRepo(async(repo,db)=>{
    const f=fixture();await repo.saveBatch({recipes:[f.recipe],recipe_versions:[f.original,f.version]},{conditions:{recipes:[{key:f.recipe.id,absente:true}]}});
    const avant=await repo.get('recipe_versions',f.version.id),archive=await createArchive(db),inspection=await inspectArchive(await archive.blob.arrayBuffer());
    ok(inspection.ok,'Correctif adaptation : archive intégrale accepte le document Thermomix invalidé');
    await withDatabase(async destination=>{
      await applyArchive(destination,inspection,{mode:'replace'});
      const apres=await destination.get('recipe_versions',f.version.id);
      eq(apres,avant,'Correctif adaptation : archive restaure exactement le document, sans effacer ses anciens réglages');
      eq(gardeThermomix(apres).ok,false,'Correctif adaptation : restaurer le document ne valide jamais son plan TM7');
    });
  }));
  await run('Export documentaire JSON-LD',()=>{
    const f=fixture(),sortie=toJsonLd(f,{documentaire:true});
    eq(sortie.recipeInstructions,undefined,'Correctif export : plan invalide sans instruction exécutable JSON-LD');
    ok(sortie.description?.includes('Document à revoir'),'Correctif export : JSON-LD signale explicitement le document à revoir');
    ok(JSON.stringify(sortie['cuisineos:document_conserve']).includes(f.version.steps[0].text),'Correctif export : texte invalide conservé uniquement dans document balisé');
  });
  await run('Export documentaire YAML',()=>{
    const f=fixture(),sortie=toPaprikaYaml([f,{recipe:{...f.recipe,id:'autre',original_title:'Recette ordinaire'},version:f.original}],{documentaire:true});
    ok(sortie.includes('Recette ordinaire')&&sortie.includes('Document à revoir'),'Correctif export : bibliothèque YAML entière exportée avec mention');
    const premiere=sortie.split('- name:')[1];
    ok(!premiere.split('  directions:')[1]?.includes(f.version.steps[0].text),'Correctif export : anciens réglages absents des directions Paprika');
    ok(premiere.split('  directions:')[0].includes(f.version.steps[0].text),'Correctif export : texte conservé dans les notes documentaires');
  });
  await run('Export documentaire HTML',()=>{
    const f=fixture(),sortie=toReadableSite([f],new Map(),{documentaire:true});
    const html=sortie.entries.find(x=>x.path.startsWith('recipes/')).data;
    ok(html.includes('Document à revoir')&&html.includes(f.version.steps[0].text),'Correctif export : HTML conserve le texte dans un document à revoir');
    ok(!html.includes('<h2>Préparation</h2>')&&!html.includes('Adaptée au TM7 avec'),'Correctif export : document HTML ne présente pas un plan TM7 approuvé');
  });
  await run('Garde des usages culinaires',()=>{
    for(const exporter of [b=>toJsonLd(b),b=>toPaprikaYaml([b]),b=>toReadableSite([b],new Map())]) {
      let refus=false;try{exporter(fixture());}catch{refus=true;}
      ok(refus,'Correctif export : export culinaire direct conserve la garde du plan invalide');
    }
  });
  await run('Repères révision2 exportés',async()=>{
    const R=await import('../src/domain/reperes.js'),f=fixture(),version={...f.original,steps:[{id:'s',text:'Cuire 20 à 25 minutes.'}]};
    const contexte=R.construireContexteReperes({recipe:f.recipe,version});
    const raw={description_fr:null,difficulte:null,temps:{total:null,actif:null,cuisson:{min:20,max:25,origine:'source'},attentes:null,attentes_incluses:null,explication:'',references:[{type:'etape',index:0,extrait:'Cuire 20 à 25 minutes.'}]}};
    const resultat=R.validerReponseReperes(raw,contexte),proposition=R.fabriquerPropositionReperes({contexte,resultat,modele:'fixture'});
    const recipe={...f.recipe,reperes:R.fusionnerReperes(null,{proposition})};
    const sortie=toJsonLd({recipe,version});
    ok(sortie.description.includes('20–25 min'),'Correctif export : révision2 conserve la fourchette sans choisir une borne');
    eq(sortie.cookTime,undefined,'Correctif export : fourchette de durée jamais exportée comme durée exacte');
  });
  await run('Source réelle et ancêtres',async()=>{
    const {lireSourceSansThermomix}=await import('../src/domain/version-personnelle.js');
    const f=fixture(),rows=new Map([[f.original.id,f.original],[f.version.id,f.version]]),lire=id=>Promise.resolve(rows.get(id));
    const source=await lireSourceSansThermomix(f.version,{lire});
    eq(source.source?.id,f.original.id,'Correctif adaptation : retrouve la version source réelle de la même recette');
    eq(source.ancetres?.map(v=>v.id),[f.version.id,f.original.id],'Correctif adaptation : capture tous les ancêtres pour la transaction');
    rows.delete(f.original.id);eq((await lireSourceSansThermomix(f.version,{lire})).ok,false,'Correctif adaptation : aucun recours au snapshot TM si parent absent');
    rows.set(f.original.id,{...f.original,recipe_id:'autre'});eq((await lireSourceSansThermomix(f.version,{lire})).ok,false,'Correctif adaptation : parent d’une autre recette refusé');
    rows.set(f.original.id,{...f.version,id:f.original.id,parent_version_id:f.version.id});eq((await lireSourceSansThermomix(f.version,{lire})).ok,false,'Correctif adaptation : boucle d’ascendance refusée');
  });
  const attendre=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Attente dépassée');};
  for(const mutation of [null,'source','compte','cycle'])await run('Éditeur personnel '+mutation,()=>withRepo(async(repo,db)=>{
    const f=fixture();await repo.saveBatch({recipes:[f.recipe],recipe_versions:[f.original,f.version]},{conditions:{recipes:[{key:f.recipe.id,absente:true}]}});
    const avant=await repo.get('recipe_versions',f.original.id),parente=await repo.get('recipe_versions',f.version.id),ancienHash=location.hash;
    const ed=await renderRecipeEdit({id:f.recipe.id},{v:f.version.id,kind:mutation?'correction':'adaptation'},{...await getData(true),sync:{}});document.body.append(ed);
    try {
      const bouton=ed.querySelector('[data-role=reprendre-source-sans-thermomix]');ok(!!bouton,'Correctif adaptation : geste explicite pour reprendre les étapes source');if(!bouton)return;
      if(!mutation){const resume=[...ed.querySelectorAll('label')].find(n=>n.textContent.startsWith('Résumé des changements'))?.querySelector('textarea');resume.value='Adaptation au TM7 avec une correction personnelle.';resume.dispatchEvent(new Event('input',{bubbles:true}));}
      bouton.click();
      const champ=[...ed.querySelectorAll('label')].find(n=>n.textContent.startsWith('Étapes'))?.querySelector('textarea');
      eq(champ?.value,f.original.steps[0].text,'Correctif adaptation : anciens réglages remplacés dans le formulaire à relire');
      if(mutation==='source')await db.put('recipe_versions',{...avant,steps:[{id:'s',text:'Source changée ailleurs'}]},{origin:'remote'});
      if(mutation==='compte')await db.put('sync_state',{key:'user_id',value:'autre'},{origin:'remote'});
      if(mutation==='cycle')await db.put('recipes',{...await repo.get('recipes',f.recipe.id),lifecycle_id:'retiree',trashed_at:at},{origin:'remote'});
      const count=(await repo.all('recipe_versions')).length;
      [...ed.querySelectorAll('button')].find(b=>b.textContent==='Enregistrer une nouvelle version').click();
      await attendre(async()=> (await repo.all('recipe_versions')).length>count||!ed.querySelector('[data-role=erreur-enregistrement]').hidden);
      if(mutation) {
        eq((await repo.all('recipe_versions')).length,count,'Correctif adaptation : modification '+mutation+' refuse toute création');
        eq(champ.value,f.original.steps[0].text,'Correctif adaptation : refus garde la saisie');
      } else {
        const enfant=(await repo.all('recipe_versions')).find(v=>![f.original.id,f.version.id].includes(v.id));
        ok(enfant.changes.includes('Adaptation au TM7 avec une correction personnelle.')&&enfant.changes.includes('Étapes source reprises sans les réglages Thermomix générés.'),'Correctif adaptation : résumé antérieur conservé et retour à la source toujours explicite');
        eq([enfant.kind,enfant.parent_version_id,enfant.provenance.derived_from,enfant.provenance.thermomix_source_version_id],['adaptation',f.version.id,f.version.id,f.original.id],'Correctif adaptation : version personnelle et double trace de dérivation');
        eq([enfant.provenance.thermomix,enfant.provenance.thermomix_invalide],[undefined,undefined],'Correctif adaptation : aucun ancien réglage structuré dans version personnelle');
        eq(gardeThermomix(enfant).ok,true,'Correctif adaptation : version source relue utilisable en cuisine ordinaire');
        const {enregistrerSessionCuisine}=await import('../src/domain/thermomix-session.js');
        const session={id:'session-source',recipe_id:f.recipe.id,selected_version_ids:[enfant.id],servings:2,status:'active',progress:{}};
        await enregistrerSessionCuisine(session,{repo});
        const {renderCook}=await import('../src/ui/cook.js');
        const cuisine=await renderCook({id:session.id},{},await getData(true),{repo});
        ok(!cuisine.matches('[data-role=thermomix-bloque]')&&cuisine.textContent.includes(f.original.steps[0].text),'Correctif adaptation : vraie session de cuisine affiche les étapes source');
        ok(!cuisine.textContent.includes(f.version.steps[0].text),'Correctif adaptation : aucun ancien réglage TM7 dans la cuisson ordinaire');
        cuisine.remove();
        eq(await repo.get('recipe_versions',f.original.id),avant,'Correctif adaptation : original intact');
        eq(await repo.get('recipe_versions',f.version.id),parente,'Correctif adaptation : document invalidé parent intact');
      }
    }finally{ed.remove();location.hash=ancienHash;}
  }));

  await run('Correction TM garde la version originale concurrente',()=>withRepo(async(repo)=>{
    const f=fixture();f.recipe.current_version_id=f.original.id;
    await repo.saveBatch({recipes:[f.recipe],recipe_versions:[f.original,f.version]},{conditions:{recipes:[{key:f.recipe.id,absente:true}]}});
    const ed=await renderRecipeEdit({id:f.recipe.id},{v:f.version.id,kind:'correction'},{...await getData(true),sync:{}}),ancienHash=location.hash;document.body.append(ed);
    try{
      ed.querySelector('[data-role=reprendre-source-sans-thermomix]').click();
      const suivante={...f.original,id:'correction-concurrente',kind:'correction',parent_version_id:f.original.id,steps:[{id:'nouvelle',text:'Nouvelle correction originale.'}]};
      const relue={...await repo.get('recipes',f.recipe.id),current_version_id:suivante.id,availability:'partial',verification_state:'to_verify',ingredient_ids:['nouvel-ingredient']};
      await repo.saveBatch({recipes:[relue],recipe_versions:[suivante]});
      [...ed.querySelectorAll('button')].find(b=>b.textContent==='Enregistrer une nouvelle version').click();
      await attendre(async()=>(await repo.all('recipe_versions')).length>3||!ed.querySelector('[data-role=erreur-enregistrement]').hidden);
      const apres=await repo.get('recipes',f.recipe.id);
      eq(apres.current_version_id,suivante.id,'Correctif adaptation : originale courante concurrente conservée');
      eq([apres.availability,apres.verification_state,apres.ingredient_ids],[relue.availability,relue.verification_state,relue.ingredient_ids],'Correctif adaptation : métadonnées de l’originale concurrente conservées');
      eq((await repo.all('recipe_versions')).length,4,'Correctif adaptation : version personnelle créée sans remplacer l’originale');
    }finally{ed.remove();location.hash=ancienHash;}
  }));

}
