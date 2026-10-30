import { portionsRepas, enregistrerSessionCuisine } from '../src/domain/thermomix-session.js';
export async function runL7CuisineDepartTests({eq,ok}) {
 const v={id:'v-depart',recipe_id:'r-depart',steps:[{id:'s-depart',text:'Texte affiché'}],ingredients:[],servings:4},session={id:'cs-depart',recipe_id:v.recipe_id,selected_version_ids:[v.id],status:'active',servings:null,progress:{done_step_ids:[]}},meal={id:'m-depart',items:[{recipe_version_id:v.id,servings:null}],servings:6};
 eq(portionsRepas({version:v,servings:null},meal),null,'L7 départ : portions null explicites non remplacées');eq(portionsRepas({version:v},meal),6,'L7 départ : absence du champ conserve compat portions repas');
 let writes=0,conditions;const mock={get:async()=>({...v,steps:[{id:'s-depart',text:'Texte arrivé ailleurs'}]}),saveBatch:async()=>{writes++;}};
 let refused=false;try{await enregistrerSessionCuisine(session,{repo:mock,versionsAffichees:[v]});}catch{refused=true;}ok(refused&&writes===0,'L7 départ : source affichée périmée refuse avant écriture');
 const source=structuredClone(v);let liberer;const attente=new Promise(r=>{liberer=r;});const repo={get:async()=>{await attente;return structuredClone(v);},saveBatch:async(_,o)=>{conditions=o.conditions;writes++;}};
 const travail=enregistrerSessionCuisine(session,{repo,versionsAffichees:[source],repasAffiche:meal});source.steps[0].text='Mutation après geste';liberer();await travail;
 ok(conditions?.recipe_versions?.length===1,'L7 départ : toute version possède garde transactionnelle');let changed=false;try{conditions?.recipe_versions?.[0]?.fusion({...v,steps:[]});}catch{changed=true;}ok(changed,'L7 départ : changement non Thermomix entre lecture et commit refusé');
 let mealChanged=false;try{conditions?.meals?.[0].fusion({...meal,servings:8});}catch{mealChanged=true;}ok(mealChanged,'L7 départ : portions et sélection du repas protégées au commit');
 ok(!source.cooking_state&&!session.cooking_state&&session.progress.format===undefined,'L7 départ : création reste legacy sans adoption implicite');
}
