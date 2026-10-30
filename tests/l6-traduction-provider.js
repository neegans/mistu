import {PasserelleProvider} from '../src/domain/llm.js';
export async function runL6TraductionProviderTests({eq,ok}){
  const requetes=[],bytes=new TextEncoder().encode(JSON.stringify({model:'claude-fixture',stop_reason:'end_turn',content:[{type:'text',text:'Texte avant '},{type:'text',text:'```json\n{"format":1,"segments":[]}\n```'}]}));
  const p=new PasserelleProvider({}, {session:{access_token:'factice'},fetch:async(_url,init)=>{requetes.push(JSON.parse(init.body));return new Response(bytes);}});
  const r=await p.completeTranslation({system:'Traduire fidèlement.',messages:[{role:'user',content:'Source'}],maxTokens:8000});
  eq(requetes[0].outil,'creation','L6 provider : outil creation existant');eq(requetes[0].corps.max_tokens,8000,'L6 provider : plafond tokens');eq(requetes[0].corps.system,'Traduire fidèlement.','L6 provider : consigne exacte');eq([r.raison,r.model,r.stopReason],[null,'claude-fixture','end_turn'],'L6 provider : métadonnées bornées');eq([...r.reponseBrute],[...bytes],'L6 provider : conserve corps complet exact');ok(r.text.startsWith('Texte avant ```'),'L6 provider : habillage reste au parseur');
  const count=requetes.length;eq((await p.completeTranslation({system:'x',messages:[],maxTokens:8001})).raison,'requete','L6 provider : surborne refusée avant coût');eq(requetes.length,count,'L6 provider : aucun POST surborne');
  const malformed=new PasserelleProvider({}, {session:{access_token:'factice'},fetch:async()=>new Response('{non json')});
  const bad=await malformed.completeTranslation({system:'x',messages:[]});eq(bad.raison,'reponse_illisible','L6 provider : échec de parsing transmis');eq(new TextDecoder().decode(bad.reponseBrute),'{non json','L6 provider : parsing raté garde bytes');
  const failed=new PasserelleProvider({}, {session:{access_token:'factice'},fetch:async()=>new Response('privé',{status:502})});eq(await failed.completeTranslation({system:'x',messages:[]}),{text:null,stopReason:null,model:null,reponseBrute:null,raison:'serveur'},'L6 provider : aucune donnée HTTPerreur');
  const ac=new AbortController(),cancelled=new PasserelleProvider({}, {session:{access_token:'factice'},fetch:async()=>({status:200,arrayBuffer:async()=>{ac.abort();return bytes.buffer;}})});
  const annule=await cancelled.completeTranslation({system:'x',messages:[],signal:ac.signal});eq([annule.raison,annule.text,annule.reponseBrute.byteLength],['annule',null,bytes.length],'L6 provider : abandon reçu ne perd pas brut');
}
