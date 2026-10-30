import {cibleReprise,importOuvert,lignesImports} from '../src/domain/import-cible.js';
import {withRepo} from './sync-fixture.js';
import {getData} from '../src/ui/state.js';
import {renderRecipeEdit} from '../src/ui/recipe-edit.js';
export async function runL6TraductionRepriseTests({eq,ok}){
  const row={id:'j?1',kind:'traduction',recipe_id:'r/6',source_version_id:'v&6',target_locale:'fr',status:'a_verifier',resultat:{format:1,segments:[{ref:'ts_'+'a'.repeat(64),text:'Ne pas couvrir.',issue:'admis'}]}};
  eq(cibleReprise(row),'/recipes/r%2F6/edit?kind=translation&format=2&locale=fr&v=v%266&import=j%3F1','L6 reprise : recette/version/journal exacts encodés');ok(importOuvert(row),'L6 reprise : résultat payé visible dans imports');
  const lignes=lignesImports({imports:[row],recipesById:new Map(),editionsById:new Map(),booksById:new Map(),scanSessionsById:new Map()});eq(lignes[0]?.gestes,['reprendre'],'L6 reprise : source absente garde récupération, sans Ignorer générique ni relance');
  const {renderTraductionEditeur}=await import('../src/ui/traduction-editeur.js');let lectures=0;
  const depot={capturerPortee:async()=>({issue:'ok',portee:{}}),lireLectureTraduction:async()=>{lectures++;return{issue:'ok',lecture:{journalId:row.id,resultat:row.resultat,remaining_refs:[row.resultat.segments[0].ref]},recuperationDisponible:true};}};
  const ctx={recipesById:new Map(),versionsById:new Map(),versionsByRecipe:new Map(),recipe_translations:[],proprietaireDonnees:null};
  const n=await renderTraductionEditeur({id:row.recipe_id},{kind:'translation',format:'2',v:row.source_version_id,import:row.id},ctx,{depot});document.body.append(n);
  try{eq(lectures,1,'L6 reprise : source absente ne masque pas réponse payée');ok(n.textContent.includes('Ne pas couvrir.'),'L6 reprise : résultat exact consultable');ok([...n.querySelectorAll('button')].some(b=>b.textContent==='Récupérer la réponse reçue'),'L6 reprise : récupération brute proposée sans publication');ok([...n.querySelectorAll('button')].find(b=>b.textContent==='Utiliser cette proposition')?.disabled,'L6 reprise : source absente jamais recréée par adoption');}finally{n.dispose();n.remove();}
  await withRepo(async(repo,db)=>{
    const recipe={id:'l6-legacy-r',original_title:'Bread',current_version_id:'l6-legacy-v',original_language:'en',availability:'available'},version={id:recipe.current_version_id,recipe_id:recipe.id,ingredients:[],steps:[]};
    const trs=['a','b'].map(id=>({id:'legacy-'+id,recipe_version_id:version.id,locale:'fr',alignment_format:1,translated_content:{title:'Pain '+id,ingredients:[],steps:[]},origin:'manual',verification_state:'unverified'}));
    await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version],recipe_translations:trs}});const ctx={...await getData(true),sync:{}};
    const ambiguous=await renderRecipeEdit({id:recipe.id},{kind:'translation',locale:'fr'},ctx);eq(ambiguous.querySelectorAll('[data-role=traduction-titre]').length,0,'L6 L0 : plusieurs traductions imposent un choix explicite');eq(ambiguous.querySelectorAll('a[href*="translation=legacy-"]').length,2,'L6 L0 : chaque traduction historique reste accessible');
    const exact=await renderRecipeEdit({id:recipe.id},{kind:'translation',locale:'fr',translation:'legacy-b'},ctx);document.body.append(exact);try{eq(exact.querySelector('[data-role=traduction-titre]')?.value,'Pain b','L6 L0 : retour de conversion cible la candidate choisie');
      const input=exact.querySelector('[data-role=traduction-titre]');if(input){input.value='Pain corrigé';input.dispatchEvent(new Event('input',{bubbles:true}));await db.mutate({origin:'remote',puts:{recipe_translations:[{...trs[0],id:'legacy-c'}]}});[...exact.querySelectorAll('button')].find(b=>b.textContent==='Enregistrer la traduction').click();for(let i=0;i<100&&!exact.querySelector('[data-role=etat-traduction]')?.textContent;i++)await new Promise(r=>setTimeout(r,5));eq((await repo.get('recipe_translations','legacy-b')).translated_content.title,'Pain b','L6 L0 : nouvelle candidate concurrente refuse sans écraser la saisie');ok(!!exact.querySelector('[data-role=etat-traduction]')?.textContent,'L6 L0 : collision de candidats expliquée');}
    }finally{exact.remove();}
  });
}
