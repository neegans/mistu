import {capturerSourceTraduction} from '../src/domain/traductions-format.js';
export async function runL6TraductionPortionsTests({eq,ok}){
  const {planifierTraduction}=await import('../src/domain/plan-traduction.js');
  const source=await capturerSourceTraduction({recipe:{id:'r',original_title:'Bread',original_language:'en'},version:{id:'v',recipe_id:'r',ingredients:[],steps:Array.from({length:50},(_,i)=>({id:'s'+i,text:'Bake for 20 to 25 min.\nDo not cover.'}))}});
  const args={source,selection:source.segments.map(s=>s.ref),limiteAppels:32,budgetSortie:{pointsDisponibles:200000}};
  const p=planifierTraduction(args);ok(p.ok,'L6 plan : source exacte admise');eq(p.portions.map(x=>x.segment_refs.length),[24,24,3],'L6 plan : 24 segments maximum sans perte');eq(p.bilan.appelsMax,3,'L6 plan : coût maximal déterministe');eq(p.bilan.reserve,{entrees:8,octets:8388608},'L6 plan : annonce pause réserve locale');eq(p.portions.flatMap(x=>x.segment_refs.map(s=>s.ref)),args.selection,'L6 plan : aucune ref supprimée ni dupliquée');
  ok(p.portions.every(x=>x.maxTokens===8000),'L6 plan : limite requête8000');ok(p.portions[0].messages[0].content.includes('⟦M6:'),'L6 plan : chiffres protégés dans données envoyées');ok(!p.portions[0].messages[0].content.includes('20 to 25 min'),'L6 plan : valeurs brutes pas données à reformuler');
  eq(planifierTraduction({...args,limiteAppels:1}).raison,'limite_appels','L6 plan : coût trop grand refusé entier, pas troncature');
  eq(planifierTraduction({...args,selection:[...args.selection,args.selection[0]]}).raison,'selection_invalide','L6 plan : doublon refusé');eq(planifierTraduction({...args,selection:['inconnue']}).raison,'selection_invalide','L6 plan : ref étrangère refusée');
  eq(planifierTraduction({...args,budgetSortie:{pointsDisponibles:1}}).raison,'budget_sortie','L6 plan : enveloppe impossible refuse avant paiement');
  const parRef=Object.fromEntries(source.segments.map(s=>[s.ref,10]));const fixe=planifierTraduction({...args,budgetSortie:{pointsDisponibles:510,parRef}});ok(fixe.ok,'L6 plan : plafonds exacts mesurés par dépôt admis');ok(fixe.portions.flatMap(p=>p.segment_refs).every(s=>s.output_max_points===10),'L6 plan : budget exact pas augmenté');
  const enorme=await capturerSourceTraduction({recipe:{id:'r2',original_title:'Huge'},version:{id:'v2',recipe_id:'r2',ingredients:[],steps:[{id:'s',text:'é'.repeat(6001)}]}});
  const trop=planifierTraduction({source:enorme,selection:enorme.segments.map(s=>s.ref),limiteAppels:32,budgetSortie:{pointsDisponibles:200000}});eq(trop.raison,'segments_non_eligibles','L6 plan : étape indivisible trop grande annoncée avant appel');eq(trop.nonEligibles[0].ref,enorme.segments[1].ref,'L6 plan : ref manuelle exacte disponible');
  eq(planifierTraduction({...args,selection:[]}).raison,'selection_vide','L6 plan : choix vide ne paie rien');
  eq(source.segments[1].text,'Bake for 20 to 25 min.\nDo not cover.','L6 plan : source originale jamais masquée dans capture');
}
