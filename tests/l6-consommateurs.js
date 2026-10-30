import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {scaleVersion} from '../src/domain/scaling.js';
import {buildShoppingList} from '../src/domain/grocery.js';
import {assessVersion} from '../src/domain/diet.js';
import {buildDocs} from '../src/domain/search.js';
import {construireContexteReperes} from '../src/domain/reperes.js';
export async function runL6ConsommateursTests({eq,ok}){
 const f=fixtureLectureL6();f.version.ingredient_structure.blocks[0].text='Levain';f.version.ingredients[0].name_text='Levain';f.version.ingredients[0].ingredient_id='i-levain';const before=JSON.stringify(f);
 const scaled=scaleVersion(f.version,6);eq(scaled.ingredients.length,2,'L6 audit : scaling reçoit seulement les aliments');eq(scaled.ingredients[0].quantity.value,450,'L6 audit : aliment Levain reste calculé sans être inféré titre');
 const grocery=buildShoppingList([{version:f.version,servings:6,title:'Pain'}],new Map());eq(grocery.length,2,'L6 audit : aucun heading dans courses');ok(grocery.find(x=>x.label==='Levain')?.entries.length===1,'L6 audit : aliment Levain présent une fois');
 const diet=assessVersion(f.version,new Map(),'sans_gluten');eq(diet.unknown.length,2,'L6 audit : headings ne deviennent pas aliments inconnus');eq(diet.state,'to_verify','L6 audit : groupe ne certifie aucun aliment');
 const doc=buildDocs({recipes:[f.recipe],versions:[f.version],editions:[],books:[],dishes:[],links:[]})[0];eq([...doc.ingredientIds],['i-levain'],'L6 audit : recherche utilise identités des aliments seules');
 const ctx=construireContexteReperes(f);eq(ctx.source.ingredients.length,2,'L6 audit : repères reçoivent aliments sans titre');eq(JSON.stringify(f),before,'L6 audit : consommateurs ne mutent aucune structure');
}
