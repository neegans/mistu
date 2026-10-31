import {egalesCopiesInventaire} from '../domain/comparaison-inventaire.js';
import {preparerInventaireArchive} from '../domain/inventaire-archive.js';
import {estCommandeInventaire} from './commandes-inventaire.js';
import {estLotProtege} from '../domain/inventaire-format.js';
import {estLectureSourceSignee} from './lots.js';
import {preparerPremiereLiaisonTransfert} from '../domain/transfert-premiere-liaison.js';
import {preparerSourcesArchive} from '../domain/transferts-source.js';
import {preparerTraductionsArchive} from '../domain/traductions-archive.js';
import {preparerCuisineArchive} from '../domain/cuisine-archive.js';
import {estCommandeCuisine} from './commandes-cuisine.js';
import {estLigneCuisine} from '../domain/cuisine-format.js';
import {estCommandeProtegee,ciblesCommandeProtegee} from './commandes-traduction.js';
import {estCommandeSources,ciblesCommandeSources,CLE_SOURCE_CONFIRMEE} from './commandes-sources.js';
// Envoi initial (spec § 5.2) : tout ce qui existait AVANT la connexion est mis en file, table par table, commandé
// par des marqueurs — pas par user_id. Reprenable : une table interrompue est rejouée en entier (le dédoublonnage de
// l'envoi absorbe les doublons) ; le marqueur part dans la MÊME transaction que le dernier morceau.
import { SYNC_STORES } from '../model/schema.js';
import { keyOf, remoteDeCeCompte } from './tables.js';
import { gardeCompteCycle } from './cycle.js';
import { capturerContextesInitiaux, contexteInitialPour, dependancesInitialesPour } from './contexte-initial.js';
import { estDeCeCompte } from './outbox.js';

const MARQUEUR = (table) => `backfill:${table}`;

// L4 (D-G8) : `files` est candidate — mais seules ses lignes syncables à remote valide de CE compte entrent en file (les
// octets sont déjà au serveur) ; son marqueur `backfill:files` est posé comme les autres. (R-L3-22, L3 : `files` en était
// écartée, faute d'octets à envoyer.) Les tables candidates sont nommées une fois, et c'est aussi elles que compte la
// progression affichée.
// Spec assistant-par-le-compte K-3 : `assistant_config` n'est candidate que sur un appareil de production
// (`configSuitLeCompte`, faux par défaut — R-CPT-1).
export function tablesCandidates({ isActivitySynced = () => false, configSuitLeCompte = () => false } = {}) {
  return SYNC_STORES.filter((t) => (t !== 'library_activity' || isActivitySynced()) && (t !== 'assistant_config' || configSuitLeCompte()));
}

export function tablesAEnvoyer({ marqueurs = {}, isActivitySynced = () => false, configSuitLeCompte = () => false }) {
  return tablesCandidates({ isActivitySynced, configSuitLeCompte }).filter((t) => marqueurs[MARQUEUR(t)] !== 'fait');
}

export async function lireMarqueurs(db) {
  const lignes = await db.getAll('sync_state');
  return Object.fromEntries(lignes.filter((l) => String(l.key).startsWith('backfill:')).map((l) => [l.key, l.value]));
}

export async function retirerMarqueur(db, table) {
  await db.mutate({ deletes: { sync_state: [MARQUEUR(table)] }, origin: 'device' });
}

// Rien de ce raccord ne s'applique à un propriétaire déjà nommé ou à un transfert essayé.
async function lierTransfertsAnonymes({db,getUserId,snapshot,user_id}){
 if(!user_id)return false;const file=snapshot.outbox||[],identique=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null),groupes=new Map(),puts=[],conditions={sync_state:[gardeCompteCycle(user_id,getUserId)]},cibles={scan_sessions:[],imports:[]},conflits=[],bloquees=new Set();
 for(const e of file)if(e.op==='source_transfer'&&e.payload?.transfer_id){const id=e.payload.transfer_id;if(!groupes.has(id))groupes.set(id,[]);groupes.get(id).push(e);}
 const epoch=(snapshot.sync_state||[]).find(r=>r.key==='editor_library_epoch:v1');conditions.sync_state.push({key:'editor_library_epoch:v1',fusion:r=>{if(!identique(r,epoch))throw Error('Bibliothèque changée pendant première liaison');return null;}});
 // Une archive historique conserve sa capture ancienne : elle ne publie aucune décision sur le nouveau token actif.
 const historiques=new Map();for(const xs of groupes.values()){xs.sort((a,b)=>a.seq-b.seq);const debut=xs[0]?.payload;if(debut?.store!=='imports'||!['archive','bootstrap'].includes(debut.purpose)||xs.some(e=>e.user_id!=null||(e.tries??0)!==0||e.lifecycle_blocked||e.last_error||e.quarantined_at)||!(snapshot.imports||[]).some(j=>j.id===debut.id))continue;try{historiques.set(debut.transfer_id,await preparerPremiereLiaisonTransfert({commandes:xs.map(e=>e.payload),owner_id:user_id}));}catch{/* Intention non démontrée : elle ne bénéficie pas de l’exception historique. */}}
 for(const xs of [...groupes.values()].sort((a,b)=>Math.min(...a.map(e=>e.seq))-Math.min(...b.map(e=>e.seq)))){
  xs.sort((a,b)=>a.seq-b.seq);const debut=xs[0]?.payload;if(xs.some(e=>e.user_id!=null||(e.tries??0)!==0||e.lifecycle_blocked||e.last_error||e.quarantined_at||bloquees.has(e.seq))||debut?.phase!=='begin'||!['archive','bootstrap','attach'].includes(debut.purpose))continue;
  let prep;try{prep=historiques.get(debut.transfer_id)||await preparerPremiereLiaisonTransfert({commandes:xs.map(e=>e.payload),owner_id:user_id});}catch{continue;}
  const session=(snapshot[debut.store]||[]).find(s=>s.id===debut.id);if(!session)continue;
  for(const [i,e]of xs.entries())puts.push({...e,user_id,payload:prep.commandes[i]});
  const cles=new Set(xs.flatMap(e=>ciblesCommandeSources(e.payload).map(r=>r.store+':'+r.id)));
  const journalLie=id=>debut.store==='imports'?id===debut.id:(snapshot.imports||[]).some(j=>j.id===id&&(j.source_capture?.session_id??j.scan_session_id)===debut.id);
  const deps=file.filter(e=>e.seq>xs.at(-1).seq&&estCommandeSources(e)&&estDeCeCompte(e,user_id)&&!(e.op==='source_transfer'&&historiques.has(e.payload.transfer_id))&&(ciblesCommandeSources(e.payload).some(r=>cles.has(r.store+':'+r.id))||e.op==='index_apply'&&(e.payload.read_set||[]).some(r=>journalLie(r.journal_id))||e.op==='source_transfer'&&e.store==='imports'&&journalLie(e.id)));
  for(const e of deps){bloquees.add(e.seq);puts.push({...e,lifecycle_blocked:true,last_error:'owner_bound_dependency'});const id='source:'+e.payload.operation_id,ancien=(snapshot.sync_conflicts||[]).find(c=>c.id===id);if(!ancien)conflits.push({id,kind:'source',operation_id:e.payload.operation_id,user_id,store:e.store,record_id:e.id,local:structuredClone(e.payload),server:null,reason:'owner_bound_dependency',at:new Date().toISOString()});}
  const token=debut.store==='scan_sessions'&&session.source_state?.revision===prep.revisionAvant,finish=prep.commandes.at(-1);
  const next=token?{...session,source_state:{...session.source_state,revision:prep.revisionApres},...(session.source_receipts?{source_receipts:session.source_receipts.map(r=>r.operation_id===prep.revisionAvant?{...r,operation_id:finish.operation_id,payload_sha256:finish.payload_sha256,result_revision:finish.operation_id}:r)}:{})}:null;
  cibles[debut.store].push({key:session.id,fusion:row=>{if(!identique(row,session))throw Error('Cible locale changée pendant première liaison');return next;}});
 }
 if(!puts.length)return false;
 conditions.outbox=[{toutes:true,verifier:rows=>{if(!identique(rows,file))throw Error('File changée pendant première liaison');}}];for(const[store,guards]of Object.entries(cibles))if(guards.length)conditions[store]=guards;
 if(conflits.length)conditions.sync_conflicts=conflits.map(c=>({key:c.id,absente:true}));
 await db.mutate({origin:'device',puts:{outbox:puts,...(conflits.length?{sync_conflicts:conflits}:{})},conditions});return true;
}

export async function envoiInitial({ db, getUserId, isActivitySynced = () => false, configSuitLeCompte = () => false, surProgression = () => {}, tailleMorceau = 500 }) {
  const tables = tablesAEnvoyer({ marqueurs: await lireMarqueurs(db), isActivitySynced, configSuitLeCompte });
  const total = tablesCandidates({ isActivitySynced, configSuitLeCompte }).length;
  let mises = 0;
  const user_id = getUserId();
  let snapshot = await db.getSnapshot();
  if(await lierTransfertsAnonymes({db,getUserId,snapshot,user_id}))snapshot=await db.getSnapshot();
  let file = (snapshot.outbox || []).filter(e => estDeCeCompte(e, user_id));
  if(tables.length){
    const couverts=new Set(file.filter(estCommandeSources).flatMap(e=>ciblesCommandeSources(e.payload).map(r=>r.store+':'+r.id)));
    const confirme=(store,id)=>(snapshot.sync_state||[]).some(r=>r.key===CLE_SOURCE_CONFIRMEE(store,id)&&r.value?.user_id===user_id&&r.value.data);
    const sessions=(snapshot.scan_sessions||[]).filter(s=>s.source_state&&!couverts.has('scan_sessions:'+s.id)&&!confirme('scan_sessions',s.id));
    const seances=new Map((snapshot.scan_sessions||[]).map(r=>[r.id,r]));
    const imports=(snapshot.imports||[]).filter(r=>r.kind==='index'&&r.index_storage?.role!=='result_fragment'&&(r.source_capture||r.index_call||r.index_storage?.role==='page_manifest'||seances.get(r.scan_session_id)?.source_state&&(snapshot.recipes||[]).some(x=>x.index_import_id===r.id))&&!couverts.has('imports:'+r.id)&&!confirme('imports',r.id));
    const idsImports=new Set(imports.map(r=>r.id)),recipes=(snapshot.recipes||[]).filter(r=>idsImports.has(r.index_import_id));
    if(sessions.length||imports.length){
      const p=await preparerSourcesArchive({batch:{scan_sessions:sessions,source_pages:snapshot.source_pages||[],source_documents:snapshot.source_documents||[],recipes,imports:[...imports,...(snapshot.imports||[]).filter(r=>r.index_storage?.role==='result_fragment')]},snapshot:{book_editions:snapshot.book_editions||[],scan_sessions:(snapshot.scan_sessions||[]).filter(r=>confirme('scan_sessions',r.id)),imports:(snapshot.imports||[]).filter(r=>confirme('imports',r.id)),recipes:(snapshot.recipes||[]).filter(r=>confirme('recipes',r.id))},owner_id:user_id,purpose:'bootstrap'});
      const cles=new Set(p.couvertes),anciens=file.filter(e=>e.op==='put'&&cles.has(e.store+':'+e.id)),puts={outbox:p.source_commands.map(c=>({user_id,store:c.store,id:c.id,op:c.op,payload:c,tries:0})),scan_sessions:p.batch.scan_sessions};
      const identique=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null),conditions={sync_state:[gardeCompteCycle(user_id,getUserId)],outbox:anciens.map(e=>({key:e.seq,fusion:r=>{if(!identique(r,e))throw Error('Intention initiale changée');return null;}}))};
      for(const store of ['scan_sessions','source_pages','source_documents','imports','recipes','book_editions'])conditions[store]=(snapshot[store]||[]).filter(r=>store==='book_editions'||cles.has(store+':'+r.id)).map(r=>({key:r.id,fusion:current=>{if(!identique(current,r))throw Error('Graphe initial changé');return null;}}));
      await db.mutate({origin:'device',puts,deletes:{outbox:anciens.map(e=>e.seq)},conditions});snapshot=await db.getSnapshot();file=(snapshot.outbox||[]).filter(e=>estDeCeCompte(e,user_id));
    }
  }
  if(tables.length){
    const couverts=new Set(file.filter(estCommandeProtegee).flatMap(e=>ciblesCommandeProtegee(e.payload).map(r=>r.store+':'+r.id)));
    const confirme=(store,id)=>(snapshot.sync_state||[]).some(r=>r.key===CLE_SOURCE_CONFIRMEE(store,id)&&r.value?.user_id===user_id&&r.value.data);
    // Une chaîne locale déjà capturée garde ses phases. Seuls les historiques sans intention deviennent des restores.
    const capturesImports=new Set(file.filter(e=>e.store==='imports').map(e=>e.id));
    const imports=(snapshot.imports||[]).filter(r=>r.kind==='traduction'&&!capturesImports.has(r.id)&&!couverts.has('imports:'+r.id)&&!confirme('imports',r.id));
    const traductions=(snapshot.recipe_translations||[]).filter(r=>r.alignment_format===2&&!couverts.has('recipe_translations:'+r.id)&&!confirme('recipe_translations',r.id));
    if(imports.length||traductions.length){
      const idsImports=new Set(imports.map(r=>r.id)),idsTraductions=new Set(traductions.map(r=>r.id));
      const p=await preparerTraductionsArchive({batch:{imports,recipe_translations:traductions},snapshot:{...snapshot,imports:(snapshot.imports||[]).filter(r=>!idsImports.has(r.id)),recipe_translations:(snapshot.recipe_translations||[]).filter(r=>!idsTraductions.has(r.id))},owner_id:user_id,purpose:'bootstrap'});
      const cles=p.couvertes,anciens=file.filter(e=>e.op==='put'&&cles.has(e.store+':'+e.id)),identique=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
      const conditions={sync_state:[gardeCompteCycle(user_id,getUserId)],outbox:[{toutes:true,verifier:rows=>{const cible=rows.filter(e=>estDeCeCompte(e,user_id));if(!identique(cible,file))throw Error('File changée pendant la préparation des traductions');}}]};
      for(const store of ['recipes','recipe_versions','recipe_translations','imports','book_editions'])conditions[store]=[{toutes:true,verifier:rows=>{if(!identique(rows,snapshot[store]||[]))throw Error('Sources de traduction changées pendant la préparation');}}];
      await db.mutate({origin:'device',puts:{outbox:[...p.source_commands,...p.translation_commands].map(c=>({user_id,store:c.store,id:c.id,op:c.op,payload:c,tries:0})),recipe_translations:p.batch.recipe_translations},deletes:{outbox:anciens.map(e=>e.seq)},conditions});
      snapshot=await db.getSnapshot();file=(snapshot.outbox||[]).filter(e=>estDeCeCompte(e,user_id));
    }
  }
  if(tables.length){
    const couverts=new Set(file.filter(estCommandeCuisine).map(e=>e.store+':'+e.id));
    const confirme=(store,id)=>(snapshot.sync_state||[]).some(r=>r.key===CLE_SOURCE_CONFIRMEE(store,id)&&r.value?.user_id===user_id&&r.value.data);
    const batch=Object.fromEntries(['cook_sessions','timer_launches'].map(store=>[store,(snapshot[store]||[]).filter(row=>estLigneCuisine(store,row)&&!couverts.has(store+':'+row.id)&&!confirme(store,row.id))]));
    if(batch.cook_sessions.length||batch.timer_launches.length){
      const cle=new Set(Object.entries(batch).flatMap(([store,rows])=>rows.map(row=>store+':'+row.id)));
      const base={...snapshot,...Object.fromEntries(['cook_sessions','timer_launches'].map(store=>[store,(snapshot[store]||[]).filter(row=>!cle.has(store+':'+row.id))]))};
      const preparee=await preparerCuisineArchive({batch,snapshot:base,owner_id:user_id,purpose:'bootstrap'}),anciens=file.filter(e=>e.op==='put'&&cle.has(e.store+':'+e.id));
      const egaux=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null),conditions={sync_state:[gardeCompteCycle(user_id,getUserId)],outbox:[{toutes:true,verifier:rows=>{if(!egaux(rows.filter(e=>estDeCeCompte(e,user_id)),file))throw Error('File de cuisine modifiée');}}]};
      for(const store of ['cook_sessions','timer_launches','recipes','recipe_versions','book_editions'])conditions[store]=[{toutes:true,verifier:rows=>{if(!egaux(rows,snapshot[store]||[]))throw Error('Cuisine initiale modifiée');}}];
      await db.mutate({origin:'device',puts:{...preparee.batch,outbox:preparee.cooking_commands.map(c=>({user_id,store:c.store,id:c.id,op:c.op,payload:c,tries:0}))},deletes:{outbox:anciens.map(e=>e.seq)},conditions});
      snapshot=await db.getSnapshot();file=(snapshot.outbox||[]).filter(e=>estDeCeCompte(e,user_id));
    }
  }
  if(tables.length){
    const couverts=new Set(file.filter(estCommandeInventaire).map(e=>e.id)),confirme=id=>(snapshot.sync_state||[]).some(r=>r.key===CLE_SOURCE_CONFIRMEE('inventory',id)&&r.value?.user_id===user_id&&r.value.data);
    const inventory=(snapshot.inventory||[]).filter(r=>estLotProtege(r)&&!couverts.has(r.id)&&!confirme(r.id));
    if(inventory.length){
      const ids=new Set(inventory.map(r=>r.id)),base={...snapshot,inventory:(snapshot.inventory||[]).filter(r=>!ids.has(r.id))};
      const p=await preparerInventaireArchive({batch:{inventory},snapshot:base,owner_id:user_id,purpose:'bootstrap'}),anciens=file.filter(e=>e.op==='put'&&e.store==='inventory'&&ids.has(e.id));
      const egaux=egalesCopiesInventaire,conditions={sync_state:[gardeCompteCycle(user_id,getUserId)],outbox:[{toutes:true,verifier:rows=>{if(!egaux(rows.filter(e=>estDeCeCompte(e,user_id)),file))throw Error('File inventaire modifiée');}}]};
      for(const store of ['inventory','recipes','recipe_versions','book_editions','cook_history'])conditions[store]=[{toutes:true,verifier:rows=>{if(!egaux(rows,snapshot[store]||[]))throw Error('Inventaire initial modifié');}}];
      await db.mutate({origin:'device',puts:{...p.batch,outbox:p.inventory_commands.map(c=>({user_id,store:c.store,id:c.id,op:c.op,payload:c,tries:0}))},deletes:{outbox:anciens.map(e=>e.seq)},conditions});snapshot=await db.getSnapshot();file=(snapshot.outbox||[]).filter(e=>estDeCeCompte(e,user_id));
    }
  }
  // Une intention déjà capturée garde son contenu et sa base, même incomplète : jamais de second put rebasé.
  const captures = new Set(file.flatMap(e => [`${e.store}:${e.id}`, ...(e.op === 'source_batch' ? (e.payload?.rows || []).map(r => `${r.store}:${r.id}`) : estCommandeProtegee(e)?ciblesCommandeProtegee(e.payload).map(r=>`${r.store}:${r.id}`):[])]));
  const capture = capturerContextesInitiaux(snapshot, { owner_id: user_id });
  const identique = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const garde = attendu => current => { if (!identique(current, attendu)) throw new Error('Données initiales modifiées pendant la capture'); return null; };
  // Ancienne file L1 : ne compléter que les bases initiales démontrables. Une entrée périmée reste
  // conservée, bloquée et nommée, plutôt que recevoir les droits du livre tel qu'il est aujourd'hui.
  const anciens = [], copies = [];
  for (const e of file) {
    if (estCommandeProtegee(e) || ['lifecycle', 'source_batch'].includes(e.op) || e.edition_contexts || e.lifecycle_blocked || e.store === 'files') continue;
    const contexte = contexteInitialPour(capture, e.store, e.id);
    if (!contexte.edition_contexts?.length) continue;
    const current = (snapshot[e.store] || []).find(r => keyOf(e.store, r) === e.id);
    let contenu = e.snapshot || (e.op === 'delete' ? e.payload : current), sur = e.op === 'put';
    const editions = contexte.edition_contexts.map(c => {
      const premiere = file.filter(x => x.op === 'lifecycle' && x.store === 'book_editions' && x.id === c.edition_id)
        .sort((a, b) => a.seq - b.seq)[0];
      const avant = premiere && e.seq < premiere.seq && premiere.payload?.seed && premiere.payload.base_cycle_id === null;
      if (avant) {
        if (e.store === 'book_editions' && e.id === c.edition_id) contenu = premiere.payload.seed;
        return { ...c, expected_cycle_id: null };
      }
      if (c.expected_cycle_id !== null) sur = false;
      return c;
    });
    const recettes = contexte.recipe_contexts || (contexte.recipe_id ? [contexte] : []);
    for (const r of recettes) {
      const ancien = e.recipe_contexts?.find(c => c.recipe_id === r.recipe_id) || (e.recipe_id === r.recipe_id && Object.hasOwn(e, 'expected_cycle_id') ? e : null);
      if (r.expected_cycle_id !== (ancien?.expected_cycle_id ?? null)) sur = false;
      if (ancien && Object.hasOwn(ancien, 'expected_edition_id') && ancien.expected_edition_id !== r.expected_edition_id) sur = false;
    }
    if (!contenu || (!e.snapshot && e.store !== 'book_editions' && contenu.updated_at !== e.updated_at)) sur = false;
    if (sur) anciens.push({ ...e, ...contexte, edition_contexts: editions, snapshot: structuredClone(contenu) });
    else {
      anciens.push({ ...e, lifecycle_blocked: true, last_error: 'cycle' });
      const id = `${e.store}:${e.id}`;
      if (!(snapshot.sync_conflicts || []).some(c => c.id === id)) copies.push({ id, store: e.store, record_id: e.id,
        local: structuredClone(contenu ?? null), server: null, at: new Date().toISOString(), user_id, kind: 'cycle' });
    }
  }
  if (anciens.length) await db.mutate({ puts: { outbox: anciens, ...(copies.length ? { sync_conflicts: copies } : {}) }, origin: 'device',
    conditions: { outbox: anciens.map(e => ({ key: e.seq, fusion: garde(file.find(x => x.seq === e.seq)) })),
      sync_state: [gardeCompteCycle(user_id, getUserId)],
      book_editions: (snapshot.book_editions || []).map(r => ({ key: r.id, fusion: garde(r) })),
      recipes: (snapshot.recipes || []).map(r => ({ key: r.id, fusion: garde(r) })) } });
  for (const [i, table] of tables.entries()) {
    surProgression({ phase: 'envoi_initial', table, n: i + 1, total });
    const lignes = (snapshot[table] || []).filter(r => !captures.has(`${table}:${keyOf(table, r)}`) && (table !== 'files' || (r?.syncable !== false && remoteDeCeCompte(r?.remote, user_id))));
    for (let debut = 0; debut < Math.max(lignes.length, 1); debut += tailleMorceau) {
      const morceau = lignes.slice(debut, debut + tailleMorceau);
      const dernier = debut + tailleMorceau >= lignes.length;
      const puts = { outbox: morceau.map(r => {
        const contexte = contexteInitialPour(capture, table, keyOf(table, r));
        return { user_id, store: table, id: keyOf(table, r), op: 'put', updated_at: r.updated_at || null, tries: 0,
          ...contexte, ...(contexte.edition_contexts||['recipe_versions','cook_history'].includes(table)||estLectureSourceSignee(table,r) ? { snapshot: structuredClone(r) } : {}) };
      }) };
      if (!puts.outbox.length) delete puts.outbox;
      if (dernier) puts.sync_state = [{ key: MARQUEUR(table), value: 'fait' }];
      const conditions = { sync_state: [gardeCompteCycle(user_id, getUserId)] }, vues = new Set(), livres = new Map();
      const proteger = (store, id, row) => {
        const cle = store + ':' + id;
        if (vues.has(cle)) return;
        vues.add(cle);
        (conditions[store] ??= []).push({ key: id, fusion: garde(row) });
      };
      for (const row of morceau) {
        const id = keyOf(table, row);
        proteger(table, id, row);
        const deps = dependancesInitialesPour(capture, table, id);
        for (const parent of deps.lignes) proteger(parent.store, parent.id, parent.row);
        for (const livre of deps.livres) livres.set(livre.book_id, livre.ids);
      }
      for (const [book_id, ids] of livres) {
        (conditions.book_editions ??= []).push({ index: 'book_id', valeur: book_id, verifier: rows => {
          if (!identique(rows.map(r => r.id).sort(), ids)) throw new Error('Données initiales modifiées pendant la capture');
        } });
      }
      await db.mutate({ puts, conditions, origin: 'device' });
      mises += morceau.length;
    }
  }
  return { tables, mises };
}
