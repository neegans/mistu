import {withRepo} from './sync-fixture.js';
import {getData} from '../src/ui/state.js';
import {renderHome} from '../src/ui/home.js';
export async function runL8InventaireAccueilTests({eq,ok}){
 await withRepo(async(repo,db)=>{
  const maintenant=()=>new Date(2026,9,30,12).getTime(),op='iv_op_'+'a'.repeat(64),stock={format:1,unit:'portion',initial:4,remaining:3,state:'available'};
  const lot={id:'l8-home',label:'Soupe L8',quantity_text:'4 bols au départ',use_by:'2026-10-29T00:00:00.000Z',use_by_on:'2026-10-31',stock,stock_revision:op,stock_last_action:null,stock_receipts:[],stock_receipt_floor:0};
  const contexte={...await getData(true),settings:{rediscover_enabled:false},cook_sessions:[],cook_history:[],recipes:[],docs:[],docsByRecipe:new Map()};
  async function rendre(row){const root=await renderHome({}, {},{...contexte,inventory:[row]},{repo,maintenant});try{return root.textContent;}finally{root.dispose?.();}}
  const texte=await rendre(lot);ok(texte.includes('3 portions'),'L8 accueil : restant confirmé plutôt que quantité initiale');ok(!texte.includes('4 bols au départ'),'L8 accueil : mention documentaire ne se fait pas passer pour restant');ok(texte.includes('2026-10-31'),'L8 accueil : date civile affichée sans conversion de fuseau');
  ok(!(await rendre({...lot,use_by_on:null})).includes('Soupe L8'),'L8 accueil : date retirée ne réutilise pas ancien ISO');
  ok(!(await rendre({...lot,stock:{...stock,remaining:0,state:'finished'}})).includes('Soupe L8'),'L8 accueil : terminé exclu des lots à utiliser');
  ok(!(await rendre({...lot,use_by_on:'2026-11-03'})).includes('Soupe L8'),'L8 accueil : au-delà de trois jours sans rappel prématuré');
  const legacy={id:'ancien',label:'Ancien lot L8',quantity_text:'2 boîtes',use_by:'2026-10-31T12:00:00.000Z'};
  const ancien=await rendre(legacy);ok(ancien.includes('Ancien lot L8')&&ancien.includes('À confirmer'),'L8 accueil : ancien lot documentaire avec quantité à confirmer');
  eq((await db.getAll('outbox')).length,0,'L8 accueil : projections sans écriture de stock');
 });
}
