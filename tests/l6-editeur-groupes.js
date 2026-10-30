import {withRepo} from './sync-fixture.js';
import {sourceEditeurL4} from './l4-editeur-recette.js';
export async function runL6EditeurGroupesTests({eq,ok}){
  const state=await import('../src/ui/state.js'),{renderRecipeEdit}=await import('../src/ui/recipe-edit.js');
  await withRepo(async repo=>{
    const f=sourceEditeurL4();f.version.ingredient_structure={format:1,blocks:[{kind:'heading',id:'h6',text:'Pour la soupe'},...f.version.ingredients.map(x=>({kind:'ingredient',ingredient_id:x.id}))]};
    await repo.saveBatch({recipes:[f.recipe],recipe_versions:[f.version]},{conditions:{recipes:[{key:f.recipe.id,absente:true}]}});
    const ctx=await state.getData(true),node=await renderRecipeEdit({id:f.recipe.id},{kind:'correction'},ctx);document.body.append(node);
    try{
      node.querySelector('button[data-section=ingredients]').click();await new Promise(resolve=>setTimeout(resolve,20));
      const titre=node.querySelector('[data-role=editeur-heading]');ok(titre,'L6 éditeur : titre de groupe séparé');
      eq(node.querySelectorAll('[data-role=editeur-ingredient]').length,2,'L6 éditeur : titres exclus des lignes alimentaires');
      ok(!titre?.querySelector('[data-role=ingredient-quantite]'),'L6 éditeur : titre sans quantité');
      const champ=titre?.querySelector('input');if(!champ)throw new Error('Champ de groupe absent');
      champ.value='Garniture';champ.dispatchEvent(new Event('input',{bubbles:true}));await node.flushEditeur();
      let rows=await repo.db.getAll('sync_state'),brouillon=rows.find(x=>x.key?.startsWith('editor_draft:v1:'))?.value;
      eq(brouillon?.payload?.contenu?.ingredient_structure?.blocks[0].text,'Garniture','L6 éditeur : titre saisi durable avant publication');
      const bas=titre.querySelector('[data-role=descendre-bloc]');bas.click();
      eq([...node.querySelectorAll('[data-role=editeur-heading],[data-role=editeur-ingredient]')].map(x=>x.dataset.id),['i4-a','h6','i4-b'],'L6 éditeur : déplacement visuel de bloc exact');
      ok(document.activeElement?.closest('[data-id=h6]'),'L6 éditeur : focus restauré au bloc déplacé');
      const ajouter=node.querySelector('[data-role=ajouter-titre-groupe]');ok(ajouter,'L6 éditeur : action ajouter titre disponible');
      ajouter.click();eq(node.querySelectorAll('[data-role=editeur-heading]').length,2,'L6 éditeur : ajout titre sans aliment fictif');
      const derniers=[...node.querySelectorAll('[data-role=editeur-heading]')].at(-1);eq(derniers.querySelector('input').value,'','L6 éditeur : nouveau titre n’invente pas texte');
      await node.flushEditeur();eq((await repo.get('recipe_versions',f.version.id)).ingredient_structure,f.version.ingredient_structure,'L6 éditeur : parent immuable pendant brouillon');
    }finally{node.dispose?.();node.remove();}
  });
}
