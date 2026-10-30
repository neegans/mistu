// Les anciennes preuves de lecture donnaient leur bibliothèque en mémoire à Cook.
// L7 relit IndexedDB : semer ces mêmes lignes dans une base jetable, puis arrêter
// les contrôleurs avant de rendre le DOM aux assertions de lecture seulement.
import {withRepo} from './sync-fixture.js';
import {renderCook} from '../src/ui/cook.js';
export async function renderCookFixture(params,query,ctx) {
  return withRepo(async(repo,db)=>{
    const puts={cook_sessions:ctx.cook_sessions||[],recipes:[...(ctx.recipesById?.values()||[])],recipe_versions:[...(ctx.versionsById?.values()||[])],recipe_translations:ctx.recipe_translations||[],book_editions:[...(ctx.editionsById?.values()||[])],books:[...(ctx.booksById?.values()||[])],source_pages:[...(ctx.pagesById?.values()||[])],cook_history:ctx.cook_history||[]};
    if(ctx.proprietaireDonnees!=null)puts.sync_state=[{key:'user_id',value:ctx.proprietaireDonnees}];
    await db.mutate({origin:'remote',puts});
    const root=await renderCook(params,query,ctx,{repo});root.dispose?.();return root;
  });
}
