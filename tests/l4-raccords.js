import { withRepo } from './sync-fixture.js';
import { getData, getSyncGeneration } from '../src/ui/state.js';
import { renderAdd } from '../src/ui/add.js';
import { renderRecipe } from '../src/ui/recipe.js';
import { recipeCard } from '../src/ui/components.js';
import { ligneBibliotheque } from '../src/ui/bibliotheque-liste.js';
import { renderCook } from '../src/ui/cook.js';

export async function runL4RaccordsTests({eq,ok}) {
  await withRepo(async(repo,db)=>{
    const {creerServiceBrouillons}=await import('../src/domain/brouillons-editeur.js');
    const recette={id:'l4-raccord',original_title:'Pain original',source_page_ids:[],current_version_id:'l4-raccord-v',availability:'available'};
    const version={id:'l4-raccord-v',recipe_id:recette.id,kind:'extraction',ingredients:[],steps:[{id:'s',text:'Laisser reposer.',timers:[]}]};
    await db.mutate({origin:'remote',puts:{recipes:[recette],recipe_versions:[version]}});
    const service=creerServiceBrouillons({repo,getGeneration:getSyncGeneration});
    const capture=await service.capturerPortee({owner_id:null});
    const o=await service.ouvrirBrouillon({kind:'recipe_version',intention:'correction',portee:capture.portee,affiche:{recipe:recette,version}});
    o.modele.metadata.display_title='Pain à reprendre';
    const conserve=await service.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});
    eq(conserve.issue,'ok','L4 raccord : brouillon réel conservé avant fermeture');
    const root=await renderAdd({}, {}, await getData(true));
    const card=root.querySelector(`[data-draft-id="${conserve.id}"]`);
    ok(card?.textContent.includes('Pain à reprendre'),'L4 Ajouter : retrouve le brouillon réel de cet appareil');
    ok(card?.querySelector('a[href]')?.getAttribute('href').includes('draft='+conserve.id),'L4 Ajouter : lien vers la reprise exacte');
    eq((await repo.get('recipes',recette.id)).original_title,'Pain original','L4 Ajouter : lire les brouillons ne publie aucune saisie');
    root.dispose?.();
    const p=await service.preparerPublication({id:conserve.id,portee:capture.portee,expectedRevision:conserve.revision});
    const publie=p.issue==='ok'?await service.publierBrouillon({plan:p.plan}):p;
    eq(publie.issue,'publie','L4 raccord : publication réelle des seules métadonnées');
    const contexte=await getData(true),renommee=contexte.recipesById.get(recette.id);
    const fiche=await renderRecipe({id:recette.id},{},contexte);
    eq(fiche.querySelector('h1')?.textContent,'Pain à reprendre','L4 titre affiché : devient le titre principal de la fiche');
    ok(fiche.textContent.includes('Titre original : Pain original'),'L4 titre affiché : original reste explicitement consultable');
    for(const photoEnTete of [false,true])eq(recipeCard({recipe:renommee,version},{photoEnTete}).querySelector('h3 a')?.textContent,'Pain à reprendre','L4 titre affiché : utilisé dans la carte '+photoEnTete);
    const ligne=ligneBibliotheque({recipe:renommee,version});
    eq(ligne.querySelector('a.titre')?.textContent,'Pain à reprendre','L4 titre affiché : la présentation liste suit la carte');
    ok(ligne.textContent.includes('Titre original : Pain original'),'L4 titre affiché : liste conserve la mention originale');
    await db.mutate({origin:'remote',puts:{cook_sessions:[{id:'l4-session-titre',recipe_id:recette.id,selected_version_ids:[version.id],status:'active',progress:{}}]}});
    const cuisson=await renderCook({id:'l4-session-titre'},{},await getData(true));
    eq(cuisson.querySelector('h1')?.textContent,'Pain à reprendre','L4 titre affiché : recette active garde le titre corrigé en cuisine');
    cuisson.dispose?.();fiche.dispose?.();
    const apres=await renderAdd({}, {}, await getData(true));
    eq(apres.querySelectorAll('[data-draft-id]').length,0,'L4 Ajouter : reçu publié retiré de la liste des saisies à reprendre');
    eq((await repo.all('recipe_versions')).length,1,'L4 métadonnées : aucune version culinaire supplémentaire');
    apres.dispose?.();
  });
}
