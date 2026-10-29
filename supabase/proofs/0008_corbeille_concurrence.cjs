// Preuve PostgreSQL à deux sessions, réservée au cluster jetable local préparé pour L1.
// L1_PROOF_LOCAL=1 PROOF_PSQL=/chemin/psql node supabase/proofs/0008_corbeille_concurrence.cjs
const {spawn,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
if(process.env.L1_PROOF_LOCAL!=='1') throw Error('Preuve locale seulement : L1_PROOF_LOCAL=1 requis');
const psql=process.env.PROOF_PSQL||'psql';
const args=['-h','127.0.0.1','-p','55439','-d','postgres','-v','ON_ERROR_STOP=1','-At'];
const auth="set app.proof_uid='00000000-0000-0000-0000-000000000001';set role authenticated;";
const q=s=>"'"+s.replaceAll("'","''")+"'";
const call=x=>`select public.sync_push_v2(${q(JSON.stringify([x]))}::jsonb);`;
const r={id:'proof-l1-race',original_title:'Concurrence',updated_at:new Date().toISOString()};
const command=id=>({store:'recipes',id:r.id,recipe_id:r.id,op:'lifecycle',action:'trash',operation_id:id,base_cycle_id:null,at:new Date().toISOString()});
const run=s=>execFileSync(psql,[...args,'-c',s],{encoding:'utf8'});
const clean=()=>run("set app.l1_purge_all='on';delete from public.recipes where id='proof-l1-race';");
(async()=>{
 if(run("select count(*) from public.recipes where id='proof-l1-race';").trim()!=='0')throw Error('Fixture déjà présente : preuve annulée');
 run(auth+call({store:'recipes',id:r.id,data:r,updated_at:r.updated_at}));
 let stdout='';
 const verrou="select pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':proof-l1-race',0));";
 const a=spawn(psql,[...args,'-c','begin;'+auth+verrou+'select pg_sleep(1);'+call(command('race-a'))+'commit;']);
 const doneA=new Promise((resolve,reject)=>{a.stdout.on('data',d=>{stdout+=d;});a.stderr.on('data',d=>process.stderr.write(d));a.on('close',code=>code===0?resolve(stdout):reject(Error('sessionA '+code)));});
 for(let i=0;i<100;i++){if(run("select count(*) from pg_locks where locktype='advisory' and granted;").trim()==='1')break;await new Promise(r=>setTimeout(r,10));}
 const started=Date.now();
 const b=spawn(psql,[...args,'-c',auth+call(command('race-b'))]);let outB='';
 const doneB=new Promise((resolve,reject)=>{b.stdout.on('data',d=>outB+=d);b.stderr.on('data',d=>process.stderr.write(d));b.on('close',code=>code===0?resolve(outB):reject(Error('sessionB '+code)));});
 const [oa,ob]=await Promise.all([doneA,doneB]);
 const json=s=>JSON.parse(s.split('\n').find(l=>l.startsWith('{')));
 const ra=json(oa),rb=json(ob);assert.equal(ra.accepted[0].operation_id,'race-a');assert.equal(rb.rejected[0].reason,'cycle');
 assert.ok(Date.now()-started>600,'la seconde session a attendu le verrou');
 const final=run(auth+`select data->>'lifecycle_id' from public.recipes where id=${q(r.id)};`);
 assert.ok(final.includes('race-a'));
 const result={sessions:2,premiereAcceptee:true,secondeRefusee:true,attenteVerrou:true,cycleFinal:'race-a'};
 console.log(JSON.stringify(result,null,2));clean();
})().catch(e=>{console.error(e);process.exitCode=1;});
