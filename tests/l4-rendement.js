import { scaleVersion } from '../src/domain/scaling.js';
import { buildShoppingList } from '../src/domain/grocery.js';
import { texteReperes } from '../src/ui/recipe.js';
import { toJsonLd, toPaprikaYaml, toReadableSite } from '../src/domain/exporters.js';

export async function runL4RendementTests({eq,ok}) {
  const version = { id:'rv-rendement', recipe_id:'r-rendement', kind:'extraction', servings:null, yield_text:'50 pains', ingredients:[{id:'ri',source_text:'1 kg de farine',name_text:'farine',unit_id:'g',quantity:{raw:'1000',value:1000},verification_state:'to_verify'}], steps:[{id:'s',text:'Façonner les pains.',timers:[]}] };
  const bundle = { recipe:{id:'r-rendement',original_title:'Pains'},version,versions:[version],pages:[] };
  eq(texteReperes(version),'50 pains','L4 rendement : texte manuel visible tel quel dans la fiche');
  eq(texteReperes({...version,servings:2}),'2 portions · 50 pains','L4 rendement : portions explicites restent distinctes du rendement');
  eq(scaleVersion(version,100).reason,'servings_unknown','L4 rendement : 50 pains ne deviennent pas 50 portions');
  eq(scaleVersion(version,100).ingredients,version.ingredients,'L4 rendement : quantités inchangées sans portions source');
  const courses=buildShoppingList([{version,servings:100,title:'Pains'}],new Map());
  eq(courses[0]?.entries[0]?.quantity?.value,1000,'L4 rendement : les courses gardent la quantité sans facteur déduit');
  eq(toJsonLd(bundle).recipeYield,'50 pains','L4 rendement : export Recipe conserve le texte');
  ok(toPaprikaYaml([bundle]).includes('50 pains'),'L4 rendement : export YAML conserve le texte');
  ok(toReadableSite([bundle],new Map()).entries.find(e=>e.path==='recipes/r-rendement.html').data.includes('50 pains'),'L4 rendement : document lisible conserve le texte');
  const hostile={...version,yield_text:'<img src=x onerror=alert(1)>'};
  const html=toReadableSite([{...bundle,version:hostile}],new Map()).entries.find(e=>e.path==='recipes/r-rendement.html').data;
  ok(html.includes('&lt;img src=x')&&!html.includes('<img src=x'),'L4 rendement : texte échappé dans le document HTML');
  eq(texteReperes({...version,yield_text:'x'.repeat(201)}),null,'L4 rendement : forme reçue hors borne non affichée');
  eq(toJsonLd({...bundle,version:{...version,yield_text:50}}).recipeYield,undefined,'L4 rendement : nombre hostile non interprété');
  eq(toJsonLd({...bundle,version:{...version,yield_text:undefined,servings:2}}).recipeYield,'2','L4 rendement : ancien export portions inchangé');
}
