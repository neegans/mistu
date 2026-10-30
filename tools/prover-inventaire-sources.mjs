// Sources synthétiques ; semis privilégié seulement, toutes commandes sous authenticated.
import * as F from '../src/domain/inventaire-format.js';
import {empreinteSources} from '../src/domain/sources-format.js';
import {verifierLiensInventaire} from '../src/domain/inventaire-sources.js';
const uid='00000000-0000-0000-0000-000000000001',at='2026-10-30T10:00:00.000Z';
const q=x=>"'"+x.replaceAll("'","''")+"'",j=x=>q(JSON.stringify(x))+'::jsonb';
const r={id:'l8-source-r',edition_id:null},v={id:'l8-source-v',recipe_id:r.id},h={id:'l8-source-h',recipe_id:r.id,recipe_version_id:v.id};
const lot={id:'l8-source-i',label:'Restes',ingredient_id:null,source_recipe_id:r.id,source_recipe_version_id:v.id,source_cook_history_id:null,quantity_text:'',portions:null,location:'frigo',prepared_at:null,use_by:null,use_by_origin:null,prepared_on:null,use_by_on:null,reheat_method:'',expected_quality:'',notes:'',stock:{format:1,unit:'portion',initial:4,remaining:4,state:'available'},created_at:at,updated_at:at};
const cases=[
 ['source active',{recipe:r,version:v,edition:null,history:null},null],
 ['recette retirée sans histoire',{recipe:{...r,lifecycle_id:'cycle',trashed_at:at},version:v,edition:null,history:null},'cycle_change'],
 ['recette retirée historique',{recipe:{...r,lifecycle_id:'cycle',trashed_at:at},version:v,edition:null,history:h},null],
 ['cycle numérique',{recipe:{...r,lifecycle_id:3,trashed_at:null},version:v,edition:null,history:h},'cycle_change'],
 ['cycle sans présence date',{recipe:{...r,lifecycle_id:'cycle'},version:v,edition:null,history:h},'cycle_change'],
 ['date seule',{recipe:{...r,trashed_at:at},version:v,edition:null,history:h},'cycle_change'],
 ['date calendrier invalide',{recipe:{...r,lifecycle_id:'cycle',trashed_at:'2026-02-30T10:00:00.000Z'},version:v,edition:null,history:h},'cycle_change'],
 ['version déplacée',{recipe:r,version:{...v,recipe_id:'autre'},edition:null,history:h},'source_changee'],
 ['histoire autre version',{recipe:r,version:v,edition:null,history:{...h,recipe_version_id:'autre'}},'source_changee'],
 ['édition retirée conservant recettes',{recipe:{...r,edition_id:'l8-source-e'},version:v,edition:{id:'l8-source-e',lifecycle_id:'ed-cycle',trashed_at:at,trash_mode:'keep_recipes'},history:null},null],
 ['édition retirée avec recettes',{recipe:{...r,edition_id:'l8-source-e'},version:v,edition:{id:'l8-source-e',lifecycle_id:'ed-cycle',trashed_at:at,trash_mode:'with_recipes'},history:null},'cycle_change'],
 ['édition absente sans histoire',{recipe:{...r,edition_id:'l8-source-e'},version:v,edition:null,history:null},'cycle_change'],
 ['édition absente historique',{recipe:{...r,edition_id:'l8-source-e'},version:v,edition:null,history:h},null],
];
let sql=String.raw`\set ON_ERROR_STOP on
begin;set app.proof_uid='00000000-0000-0000-0000-000000000001';
insert into private.allowed_users(email)values('l1@example.test')on conflict do nothing;
insert into auth.users(id,email)values('00000000-0000-0000-0000-000000000001','l1@example.test')on conflict do nothing;
create function pg_temp.expect_inventory_source(c jsonb,reason text)returns void language plpgsql as $$declare response jsonb;begin
 response:=public.sync_push_v2(jsonb_build_array(c));
 if reason is null then if jsonb_array_length(response->'accepted')<>1 then raise exception 'Témoin source refusé %',response;end if;
 elsif response->'rejected'->0->>'reason' is distinct from reason then raise exception 'Motif source attendu %, reçu %',reason,response;end if;end$$;
`;let count=0;
for(const [name,refs,reason] of cases){
 const target={...lot,source_cook_history_id:refs.history?.id??null},ids={recipe:r.id,version:v.id,edition:refs.recipe?.edition_id??null,history:refs.history?.id??null},source={mode:refs.history?'historical':'active'};
 for(const k of ['recipe','edition','version','history'])source[k]=ids[k]===null?null:{id:ids[k],sha256:refs[k]?await empreinteSources(F.projectionSourceInventaire(k,refs[k])):null};
 let observed=null;try{verifierLiensInventaire(target,refs,source,'create');}catch(e){observed=e.code;}if(observed!==reason)throw Error(name+': JS '+observed+' attendu '+reason);count++;
 const c=await F.signerCommandeInventaire({protocol:1,op:'inventory_change',store:'inventory',id:lot.id,action:'create',nonce:'source-'+count,base:{target:null},change:{lot:target},source});
 sql+='savepoint source_case;\n';
 for(const[k,store]of Object.entries({recipe:'recipes',edition:'book_editions',version:'recipe_versions',history:'cook_history'}))if(refs[k])sql+=`alter table public.${store} disable trigger user;insert into public.${store}(owner_id,id,data,updated_at)values(${q(uid)},${q(refs[k].id)},${j(refs[k])},clock_timestamp());alter table public.${store} enable trigger user;\n`;
 sql+=`set role authenticated;select pg_temp.expect_inventory_source(${j(c)},${reason===null?'null':q(reason)});reset role;rollback to source_case;\n`;count++;
}
sql+=`rollback;select '${count} contrôles sources JS/SQL' as bilan;\n`;process.stdout.write(sql);
