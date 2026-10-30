// Vecteurs JS/SQL de stock, projections et reçus, sans données privées ni réseau.
import {validerStock,validerLotInventaire,dateCivileInventaire,dateInventaire,microQuantiteInventaire,projectionInventaireSeed,projectionSourceInventaire,lireRecuInventaire,ajouterRecuInventaire} from '../src/domain/inventaire-format.js';
import {empreinteSources} from '../src/domain/sources-format.js';
const q = s => "'" + s.replaceAll("'", "''") + "'";
const j = value => q(JSON.stringify(value)) + '::jsonb';
let count = 0;
let sql = `\\set ON_ERROR_STOP on\nbegin;\ncreate function pg_temp.assert_inventory(got jsonb,want jsonb,label text) returns void language plpgsql as $$begin if got is distinct from want then raise exception '% : obtenu %, attendu %',label,got,want;end if;end$$;\n`;
const check = (label, expression, expected) => {
  sql += `select pg_temp.assert_inventory(to_jsonb(${expression}),${j(expected)},${q(label)});\n`;
  count++;
};
const stock = {format:1,unit:'portion',initial:4,remaining:3,state:'available'};
for (const [label, value, expected] of [
  ['restant réel',stock,true],
  ['terminé',{...stock,remaining:0,state:'finished'},true],
  ['zéro disponible',{...stock,remaining:0},false],
  ['restant supérieur',{...stock,remaining:5},false],
  ['inconnu',{format:1,unit:null,initial:null,remaining:null,state:'available'},true],
  ['inconnu terminé',{format:1,unit:null,initial:null,remaining:null,state:'finished'},true],
  ['initial inconnu',{...stock,initial:null},true],
  ['unité inconnue avec nombre',{...stock,unit:null},false],
  ['unité inventée',{...stock,unit:'bol'},false],
  ['mauvais format',{...stock,format:2},false],
  ['champ supplémentaire',{...stock,autre:1},false],
  ['borne portions',{...stock,initial:1000,remaining:1000},true],
  ['borne portions dépassée',{...stock,initial:1001,remaining:1001},false],
  ['six décimales',{...stock,initial:1.000001,remaining:.000001},true],
  ['septième décimale',{...stock,remaining:.0000001},false],
]) {if(validerStock(value).ok!==expected)throw Error('Divergence JS '+label);check(label,`public.l8_valid_stock(${j(value)})`,expected);}
for (const [date,expected] of [['2028-02-29',true],['2026-02-29',false],['0000-01-01',false],['0001-01-01',true],['2026-04-31',false],['2026-10-30T00:00:00Z',false]])
  {if(dateCivileInventaire(date)!==expected)throw Error('Date JS '+date);check('date civile '+date,`public.l8_civil_date(${j(date)})`,expected);}
const op='iv_op_'+'a'.repeat(64),hash='b'.repeat(64),date='2026-10-30T12:00:00.000Z';
for(const d of [date,'0000-02-29T00:00:00.000Z','0000-02-30T00:00:00.000Z','1900-02-29T00:00:00.000Z','2000-02-29T00:00:00.000Z','9999-12-31T23:59:59.999Z',date+'\n','2026-10-30T24:00:00.000Z'])check('date technique '+d,`public.l8_date(${j(d)})`,dateInventaire(d));
for(const unit of ['portion','piece','g','kg','ml','l',null,'boîte'])for(const value of [0,1e-6,1.000001,999.999999,1000,1000.000001,999999999.999999,1e9,1e9+.000001,1e-7,-1,'3',null]){
 let want=null;try{want=Number(microQuantiteInventaire(value,unit));}catch{}
 check('quantité '+unit+' '+value,`coalesce(to_jsonb(public.l8_quantity(${j(value)},${unit===null?'null':q(unit)})),'null'::jsonb)`,want);
}
const row={id:'lot-🍞',label:'Pain',stock,stock_revision:op,stock_last_action:null,stock_receipts:[],stock_receipt_floor:0,created_at:date,updated_at:date,extension:{'\u{10000}':1,'\ue000':2,note:'Café\nSoupe'},prepared_at:date,use_by:'2026-11-04T00:00:00.000Z',prepared_on:null,use_by_on:null};
const action={operation_id:op,type:'consume',at:date,before:{...stock,remaining:4},after:stock,undo_of:null};
for(const[name,edit]of [
 ['valide',()=>{}],['extension conservée',r=>r.extension.libre=true],['stock absent',r=>delete r.stock],['stock null',r=>r.stock=null],['révision absente',r=>delete r.stock_revision],['révision fausse',r=>r.stock_revision+='\n'],['id contrôle',r=>r.id='lot\n'],['id201',r=>r.id='a'.repeat(201)],['civil absent',r=>delete r.prepared_on],['civil faux',r=>r.prepared_on='2026-02-31'],['civil valide',r=>r.prepared_on='2028-02-29'],['lien invalide',r=>r.source_recipe_id=9],['histoire sans tuple',r=>r.source_cook_history_id='h'],['tuple histoire valide',r=>{r.source_cook_history_id='h';r.source_recipe_id='r';r.source_recipe_version_id='v';}],
 ['reçu valide',r=>r.stock_receipts=[{operation_id:op,payload_sha256:hash}]],['floor élevé',r=>r.stock_receipt_floor=1],['floor fraction',r=>r.stock_receipt_floor=.5],['floor négatif',r=>r.stock_receipt_floor=-1],['reçu hash manquant',r=>r.stock_receipts=[{operation_id:op}]],['reçu doublon',r=>r.stock_receipts=Array(2).fill({operation_id:op,payload_sha256:hash})],['128 reçus',r=>r.stock_receipts=Array.from({length:128},(_,i)=>({operation_id:'iv_op_'+i.toString(16).padStart(64,'0'),payload_sha256:hash}))],['129 reçus',r=>r.stock_receipts=Array.from({length:129},(_,i)=>({operation_id:'iv_op_'+i.toString(16).padStart(64,'0'),payload_sha256:hash}))],
 ['consommation valide',r=>r.stock_last_action=action],['consommation augmente',r=>r.stock_last_action={...action,after:{...stock,remaining:4}}],['consommation change unité',r=>r.stock_last_action={...action,after:{...stock,unit:'piece'}}],['fin valide',r=>r.stock_last_action={...action,type:'finish',after:{...stock,remaining:0,state:'finished'}}],['fin restante',r=>r.stock_last_action={...action,type:'finish'}],['fin inconnue',r=>r.stock_last_action={...action,type:'finish',before:{format:1,unit:null,initial:null,remaining:null,state:'available'},after:{format:1,unit:null,initial:null,remaining:null,state:'finished'}}],['undo historique valide',r=>r.stock_last_action={...action,type:'undo',undo_of:'iv_op_'+'c'.repeat(64)}],['undo propre ID',r=>r.stock_last_action={...action,type:'undo',undo_of:op}],['undo sans cible',r=>r.stock_last_action={...action,type:'undo'}],['action inconnue',r=>r.stock_last_action={...action,type:'put'}],['action champ absent',r=>{r.stock_last_action={...action};delete r.stock_last_action.undo_of;}],['prototype interdit',r=>r.extension.constructor='hostile'],['ligne trop grande',r=>r.extension.note='a'.repeat(524288)]
]){const r=structuredClone(row);edit(r);check('lot '+name,`public.l8_valid_inventory(${j(r)})`,validerLotInventaire(r).ok);}
check('seed présence et Unicode',`public.l8_project_seed(${j(row)})`,projectionInventaireSeed(row));
check('seed sha',`public.l5_sha256(public.l8_project_seed(${j(row)}))`,await empreinteSources(projectionInventaireSeed(row)));
for(const type of ['recipe','edition','version','history'])for(const r of [{id:'objet-🍞'}, {id:'objet',lifecycle_id:null,trashed_at:null,edition_id:'livre',restored_from_edition:{cycle_id:'cycle'},trash_mode:'keep_recipes',recipe_id:'r',recipe_version_id:'v'}]){
 const projection=projectionSourceInventaire(type,r);check(type+' projection',`public.l8_project_source(${q(type)},${j(r)})`,projection);check(type+' sha',`public.l5_sha256(public.l8_project_source(${q(type)},${j(r)}))`,await empreinteSources(projection));
}
sql+=`create function pg_temp.receipt_verdict(r jsonb,c jsonb)returns jsonb language plpgsql as $$begin return jsonb_build_object('ok',true,'found',public.l8_receipt(r,c));exception when others then return jsonb_build_object('ok',false,'raison',sqlerrm);end$$;\n`;
const command={operation_id:op,payload_sha256:hash},withReceipt=ajouterRecuInventaire(row,command),badCommand={...command,payload_sha256:'c'.repeat(64)};
for(const[name,r,c]of [['absent',row,command],['exact',withReceipt,command],['autre hash',withReceipt,badCommand],['documentaire',{...withReceipt,stock_receipt_floor:1},command],['autre hash documentaire',{...withReceipt,stock_receipt_floor:1},badCommand],['lot invalide',{...withReceipt,stock:null},command]]){
 let want;try{want={ok:true,found:!!lireRecuInventaire(r,c)};}catch(e){want={ok:false,raison:e.code};}check('reçu '+name,`pg_temp.receipt_verdict(${j(r)},${j(c)})`,want);
}
for(const size of [0,1,127,128])for(const restore of [false,true]){
 const r={...row,stock_receipts:Array.from({length:size},(_,i)=>({operation_id:'iv_op_'+i.toString(16).padStart(64,'0'),payload_sha256:hash})),stock_receipt_floor:Math.min(size,3)};
 check('ajout reçu '+size+' restore='+restore,`public.l8_add_receipt(${j(r)},${j(command)},${restore})`,ajouterRecuInventaire(r,command,{restore}));
}
check('ajout exact non dupliqué',`public.l8_add_receipt(${j(withReceipt)},${j(command)},false)`,ajouterRecuInventaire(withReceipt,command));
sql += `select '${count} vecteurs inventaire JS/SQL concordants' as bilan;rollback;\n`;
process.stdout.write(sql);
