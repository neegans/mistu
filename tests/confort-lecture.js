import {withRepo} from './sync-fixture.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {getData} from '../src/ui/state.js';
import {renderRecipe} from '../src/ui/recipe.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';

export async function runConfortLectureTests({ok,eq}) {
  const locale=getUiLocale();
  try { for(const langue of ['fr','en']) {
    setUiLocale(langue);
    await withRepo(async(repo,db)=>{
      const f=fixtureLectureL6();
      await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version]}});
      const ctx={...await getData(true),sync:{}};
      ctx.settings={...ctx.settings,ui_locale:langue,reading_locale:'original'};
      const avant=await db.getSnapshot(['recipes','recipe_versions','recipe_translations','cook_sessions','outbox']);
      const root=await renderRecipe({id:f.recipe.id},{lang:'original'},ctx,{repo,historique:{remplacer:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
      document.body.append(root);
      try {
        const lire=root.querySelector('[data-role=lire-recette]'),body=root.querySelector('.recipe-body');
        eq(lire?.textContent,langue==='fr'?'Lire la recette':'Read the recipe','Confort : accès direct dans la langue de l’interface');
        ok(!!lire && lire.tagName==='BUTTON' && lire.type==='button','Confort : lecture directe accessible au clavier sans lien de route');
        const coche=body.querySelector('input[type=checkbox]');coche.checked=true;coche.dispatchEvent(new Event('change',{bubbles:true}));
        const adresse=location.href,texte=body.textContent;
        let defilements=0;body.scrollIntoView=()=>{defilements++;};
        lire?.focus();lire?.click();
        ok(document.activeElement===body,'Confort : le focus rejoint le contenu de la recette');
        eq(defilements,1,'Confort : le contenu vient à l’écran sur le geste explicite');
        ok(body.querySelector('input[type=checkbox]')===coche&&coche.checked,'Confort : lire conserve les ingrédients cochés');
        eq(body.textContent,texte,'Confort : lire conserve la version, la langue et les quantités affichées');
        eq(location.href,adresse,'Confort : lire ne change ni route ni historique');
        body.querySelector('[data-role=onglets-corps] button:last-child').click();
        lire?.focus();lire?.click();
        ok(body.querySelector('[data-role=section-ingredients]').hidden&&!body.querySelector('[data-role=section-preparation]').hidden,'Confort : reprendre la lecture conserve l’onglet Préparation choisi');
        ok(document.activeElement===body,'Confort : reprendre Préparation ramène le focus au contenu');
        eq(await db.getSnapshot(['recipes','recipe_versions','recipe_translations','cook_sessions','outbox']),avant,'Confort : lire ne crée aucune cuisson, version ou écriture');
      } finally {root.dispose?.();root.remove();}
    });
  } } finally {setUiLocale(locale);}
}
