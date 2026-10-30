// L2 : formulaires réellement montés, bases jetables, aucun appel assistant.
import { withRepo } from './sync-fixture.js';
import { renderRecipeEdit } from '../src/ui/recipe-edit.js';
import { getData, getSyncGeneration } from '../src/ui/state.js';
import { creerServiceBrouillons } from '../src/domain/brouillons-editeur.js';
import { enregistrerPhotoPage } from '../src/domain/photo-page.js';
import { renderPhotoGestion } from '../src/ui/photo-gestion.js';

const attendre = async f => { for (let i=0;i<200;i++) { if(await f())return; await new Promise(r=>setTimeout(r,5)); } throw Error('L2 : attente du formulaire'); };
const donnees = () => ({
  books:[{id:'l2-form-book',title:'Livre témoin'}],
  book_editions:[{id:'l2-form-edition',book_id:'l2-form-book'}],
  recipes:[{id:'l2-form-recipe',edition_id:'l2-form-edition',original_title:'Bread',original_language:'en',availability:'available',current_version_id:'l2-form-version',source_page_ids:['l2-form-page']}],
  recipe_versions:[{id:'l2-form-version',recipe_id:'l2-form-recipe',kind:'extraction',ingredients:[{id:'i1',source_text:'salt',name_text:'salt'}],steps:[{id:'s1',position:1,text:'Mix.',timers:[]}]}],
  source_pages:[{id:'l2-form-page',edition_id:'l2-form-edition',sha256:'a'.repeat(64),role:'recipe',rotation:0}],
});
const lire = async(repo,db)=>({recettes:await repo.all('recipes'),versions:await repo.all('recipe_versions'),traductions:await repo.all('recipe_translations'),fichiers:await repo.all('files'),file:await db.getAll('outbox')});

export async function runL2CorbeilleMutationsTests({eq,ok}) {
  const scene=document.createElement('div');document.body.append(scene);const hash=location.hash;
  const bloc=async(nom,fn)=>{try{await withRepo(fn);}catch(e){ok(false,`L2 mutation ${nom} : ${e.stack||e}`);}finally{for(const vue of scene.children)vue.dispose?.();scene.replaceChildren();}};
  try {
    await bloc('correction active',async(repo,db)=>{
      const batch=donnees();await db.mutate({puts:batch,origin:'remote'});
      const vue=await renderRecipeEdit({id:batch.recipes[0].id},{kind:'correction'},await getData(true));scene.append(vue);
      const etape=vue.querySelector('[data-role=editeur-etape-texte]');etape.value='Mélanger lentement.';etape.dispatchEvent(new Event('input',{bubbles:true}));
      vue.querySelector('[data-role=enregistrer-editeur]').click();
      await attendre(async()=> (await repo.all('recipe_versions')).length===2 || vue.querySelector('[data-role=erreur-enregistrement]')?.textContent);
      eq((await repo.all('recipe_versions')).length,2,'L2 : une correction depuis un livre actif reste enregistrable');
      eq(await repo.get('recipe_versions','l2-form-version'),batch.recipe_versions[0],'L2 : la correction ne réécrit pas la version originale');
    });
    for(const kind of ['correction','translation'])for(const retour of [false,true])await bloc(`${kind} après changement du livre`,async(repo,db)=>{
      const batch=donnees();await db.mutate({puts:batch,origin:'remote'});
      const vue=await renderRecipeEdit({id:batch.recipes[0].id},{kind,locale:'fr'},await getData(true));scene.append(vue);
      const champ=kind==='translation'?vue.querySelector('[data-role=traduction-ingredient]'):vue.querySelector('[data-role=editeur-etape-texte]');
      champ.value='Saisie à conserver';champ.dispatchEvent(new Event('input',{bubbles:true}));
      await db.mutate({puts:{book_editions:[{...batch.book_editions[0],lifecycle_id:retour?'edition-retour':'edition-retrait',trashed_at:retour?null:'2026-10-29T12:00:00.000Z',trash_mode:retour?null:'with_recipes'}]},origin:'remote'});
      const avant=await lire(repo,db),adresse=location.hash;
      const toast=document.querySelector('.toast');if(toast)toast.textContent='';
      (kind==='translation'?[...vue.querySelectorAll('button')].find(b=>b.textContent==='Enregistrer la traduction'):vue.querySelector('[data-role=enregistrer-editeur]')).click();
      await attendre(()=>vue.querySelector('[data-role=erreur-enregistrement], [data-role=etat-traduction]')?.textContent || document.querySelector('.toast')?.textContent);
      eq(await lire(repo,db),avant,`L2 ${kind} : aucun objet/envoi après ${retour?'restauration':'retrait'} du livre`);
      eq(champ.value,'Saisie à conserver',`L2 ${kind} : saisie conservée`);
      eq(location.hash,adresse,`L2 ${kind} : aucune navigation après refus`);
      ok(!!vue.querySelector('[data-role=erreur-enregistrement], [data-role=etat-traduction]')?.textContent,`L2 ${kind} : motif du refus visible`);
      if(kind==='correction'){
        const service=creerServiceBrouillons({repo,getGeneration:getSyncGeneration}),{portee}=await service.capturerPortee({owner_id:null}),e=vue.etatEditeur();
        eq((await service.preparerPublication({id:e.id,portee,expectedRevision:e.revision})).raison,'cycle_change',`L2 correction : refus dû exactement au cycle du livre ${retour?'restauré':'retiré'}`);
      }
    });
    await bloc('photo de page après retrait du livre',async(repo,db)=>{
      const batch=donnees();await db.mutate({puts:batch,origin:'remote'});
      await db.mutate({puts:{book_editions:[{...batch.book_editions[0],lifecycle_id:'livre-retire',trashed_at:'2026-10-29T12:00:00.000Z',trash_mode:'with_recipes'}]},origin:'remote'});
      const avant=await lire(repo,db);let refuse=false;
      try{await enregistrerPhotoPage({repo,recipe:batch.recipes[0],blob:new Blob(['image témoin'],{type:'image/jpeg'}),source:{page_id:'l2-form-page',sha256:'a'.repeat(64),rotation:0,largeur:100,hauteur:100,rectangle:{x:0,y:0,largeur:1,hauteur:1}}});}catch{refuse=true;}
      ok(refuse,'L2 : une photo préparée depuis un livre retiré est refusée');
      eq(await lire(repo,db),avant,'L2 : le refus de photo ne crée aucun octet, lien ou envoi');
    });
    await bloc('photo de source dans livre retiré',async(repo,db)=>{
      const batch=donnees();batch.book_editions[0]={...batch.book_editions[0],lifecycle_id:'livre-retire',trashed_at:'2026-10-29T12:00:00.000Z',trash_mode:'with_recipes'};
      await db.mutate({puts:batch,origin:'remote'});
      const vue=await renderPhotoGestion({id:batch.recipes[0].id},{},await getData(true));scene.append(vue);
      try {
        ok(![...vue.querySelectorAll('button')].some(b=>b.textContent==='Choisir une photo'),'L2 : gestion directe de photo source retirée sans geste de modification');
        ok(vue.textContent.includes('Recette dans la corbeille avec son livre'),'L2 : le gestionnaire de photo explique le retrait hérité');
      }finally{vue.dispose();}
    });
  }finally{scene.remove();history.replaceState(null,'',hash||'#');}
}
