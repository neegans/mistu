import {estCommandeSources,ciblesCommandeSources,CLE_SOURCE_CONFIRMEE} from './commandes-sources.js';
import {estCommandeProtegee,ciblesCommandeProtegee,estCommandeTraduction,idsVersionsSourcesTraduction,estPhaseJournalTraduction} from './commandes-traduction.js';
// Envoi d'une passe (spec § 5.3) : la file est lue, dédoublonnée, relue, envoyée par lots ; chaque réponse est
// appliquée en UNE transaction (retraits, réécritures non capturées, conflits, quarantaine). I5 : une fiche n'est
// « envoyée » que par l'absence d'entrée la concernant.
import { estLotSources } from './lot-sources.js';
import { composerLots, cleDe } from './lots.js';
import { fileDe } from './outbox.js';
import { appliquerReponse } from './reponses.js';
import { conditionFichier } from './fichiers.js';
import { appliquerHeureServeur, reculMs } from './clock.js';
import { logError } from '../core/log.js';
import { commandeCycle, idCycle, fusionCycle, CLE_CYCLE_CONFIRME, gardeCompteCycle } from './cycle.js';
import { lireCycleRecette } from '../domain/cycle-recette.js';
import { preparerFermetureImport, importConcerne, gardeImportRelu } from './imports-clos.js';
import { commandeEdition, cibleCommune, CLE_EDITION_CONFIRMEE, fusionEdition } from './cycle-edition.js';
import { lireCycleEdition } from '../domain/cycle-edition.js';

// Recul exponentiel (spec § 5.3) : défini dans clock.js (module feuille, lot G tâche 3 ronde 1), réexporté ici pour ses lecteurs.
export { reculMs };

// Le bilan se compte depuis les EFFETS, jamais depuis la réponse brute (R-L3-8) : ce que le serveur annonce pour
// une clé hors du lot ne produit rien et ne compte donc pour rien. « envoyés » = clés réellement retirées de la
// file, moins celles retirées pour une autre raison (conflit à trancher, doublon d'une clé mise en quarantaine) et
// moins les fiches réécrites, comptées en « ajustés ».
function compter(effets, entreesParSeq) {
  const clesRetirees = new Set();
  for (const s of effets.retirer) { const e = entreesParSeq.get(s); if (e) clesRetirees.add(cleDe(e)); }
  const horsAccuse = new Set(effets.conflits.map((c) => c.id));
  for (const { seq } of effets.quarantaine) { const e = entreesParSeq.get(seq); if (e) horsAccuse.add(cleDe(e)); }
  const ajustes = Object.values(effets.reecrire).reduce((n, rows) => n + rows.length, 0);
  const accusees = [...clesRetirees].filter((k) => !horsAccuse.has(k)).length;
  return { envoyes: accusees - ajustes, ajustes };
}

export function createPush({ db, transport, getUserId = () => null, maintenant = Date.now, surHeure = () => {} }) {
  // Une heure de reprise illisible (fiche bricolée, restauration d'archive) immobiliserait l'entrée pour toujours :
  // elle est prête maintenant. La quarantaine, elle, attend un geste de la personne.
  function prete(e) {
    if (!e.next_try_at) return true;
    const t = Date.parse(e.next_try_at);
    return !Number.isFinite(t) || t <= maintenant();
  }

  // R-L3-24 : la file de CE compte, et rien d'autre (`fileDe`, src/sync/outbox.js — une seule définition, partagée
  // avec les compteurs du moteur et « À envoyer » de Réglages). Puis les deux retenues de l'envoi : la quarantaine
  // attend un geste de la personne, une heure de reprise pas encore venue attend son heure.
  async function lireFile() {
    const miennes = await fileDe(db, getUserId()),sources=miennes.some(e=>estCommandeProtegee(e)||estPhaseJournalTraduction(e));
    // Une phase en recul reste visible au composeur : ni ses suivantes, ni les lecteurs
    // de ses sources ne peuvent dépasser un accusé perdu. Cela inclut leurs bases ordinaires.
    return miennes.filter((e) => sources||commandeCycle(e)||e.lifecycle_blocked||((!e.quarantined_at || e.last_error==='cycle') && prete(e)))
      .map(e=>(sources||commandeCycle(e))&&!prete(e)?{...e,lifecycle_waiting:true}:e).sort((a, b) => a.seq - b.seq);
  }

  // R-L3-5 : une ligne retenue (files, tant que L4 n'a pas confirmé l'empreinte) n'est ni envoyée ni retirée —
  // elle est NOMMÉE dans la file, pour que Réglages puisse dire pourquoi elle attend. Origine 'remote' : jamais
  // recapturée. Rien n'est réécrit si le motif est déjà posé : une passe qui ne change rien n'écrit rien.
  async function marquerRetenues(retenues, entreesParSeq) {
    const rows = [];
    for (const { seqs, raison } of retenues) {
      for (const seq of seqs) {
        const e = entreesParSeq.get(seq);
        if (e && !e.quarantined_at && !e.lifecycle_blocked && !e.lifecycle_waiting && e.last_error !== raison) rows.push({ ...e, last_error: raison });
      }
    }
    if (rows.length) await db.mutate({ puts: { outbox: rows }, origin: 'remote' });
  }

  // R-L3-28 : les entrées dont la fiche n'existe plus ici sont RETIRÉES, avant tout envoi, et sans appel réseau.
  // Origine 'remote' : ce retrait n'est pas un geste de la personne et ne repart jamais vers le serveur. Rien
  // n'est journalisé : ce n'est pas un incident, c'est l'ordre normal des choses quand une suppression arrive
  // d'ailleurs (origine 'remote', jamais capturée) ou qu'on vide l'appareil.
  async function retirerAbandonnees(abandonnees) {
    const seqs = abandonnees.flatMap((a) => a.seqs);
    if (seqs.length) await db.mutate({ deletes: { outbox: seqs }, origin: 'remote' });
  }

  async function appliquer(lot, reponse, entreesParSeq) {
    if(estCommandeProtegee(lot.elements[0]))return appliquerSourcesL5(lot,reponse,entreesParSeq);
    if(lot.seqs.some(seq=>estPhaseJournalTraduction(entreesParSeq.get(seq))))return appliquerJournalTraduction(lot,reponse,entreesParSeq);
    if (estLotSources(lot.elements[0])) return appliquerSources(lot, reponse, entreesParSeq);
    if(lot.elements[0]?.op==='lifecycle') return appliquerCommande(lot,reponse,entreesParSeq);
    const owner=getUserId();
    // Lectures AVANT la transaction : la version locale d'un conflit est celle du moment où la réponse arrive, et
    // c'est elle qui décide si un ajustement a le droit de réécrire la fiche (R-L3-7).
    const fichesLocales = {};
    for (const e of lot.elements) fichesLocales[cleDe(e)] = (await db.get(e.store, e.id)) ?? null;
    // R-L3-29 : les clés dont le conflit est « renvoyé » (§ 5.5). Le journal est lu EN UNE fois : les conflits sont
    // peu nombreux par conception (purgés à 30 jours), et une lecture par élément en ferait 500 de plus par lot.
    const conflitsRenvoyes = new Set((await db.getAll('sync_conflicts')).filter((c) => c?.renvoye).map((c) => c.id));
    const fermetures = new Map();
    for (const e of lot.elements) {
      if (e.store !== 'imports' || e.deleted) continue;
      const locale = fichesLocales[cleDe(e)];
      const rejet = (reponse.rejected || []).find(r => r.store === e.store && r.id === e.id && r.reason === 'conflit');
      const ajustement = (reponse.adjusted || []).find(r => r.store === e.store && r.id === e.id);
      const distante = rejet?.server || (ajustement ? { data: e.data, updated_at: ajustement.updated_at, deleted_at: null } : null);
      const fermeture = distante && await preparerFermetureImport(locale, distante, owner);
      if (fermeture) fermetures.set(cleDe(e), fermeture);
    }
    const reponseOrdinaire = { ...reponse,
      rejected: (reponse.rejected || []).filter(r => !fermetures.has(cleDe(r))),
      adjusted: (reponse.adjusted || []).filter(r => !fermetures.has(cleDe(r))) };
    const effets = appliquerReponse({ lot, reponse: reponseOrdinaire, entreesParSeq, fichesLocales, conflitsRenvoyes });
    const puts = { ...effets.reecrire };
    // Lot G, ronde 1 (#4, I-G3) : une ligne files ajustée n'est pas écrite telle que calculée sur `fichesLocales` (lues plus haut, hors
    // transaction) mais refondue sur la ligne RELUE dans la transaction : une copie téléchargée pendant l'aller-retour reste ; une ligne qui a
    // bougé ici depuis (R-L3-7) n'est pas réécrite.
    let conditions = null;
    const importsRelus = lot.elements.filter(e => e.store === 'imports' && (importConcerne(e.data) || importConcerne(fichesLocales[cleDe(e)])));
    if (importsRelus.length) conditions = { imports: importsRelus.map(e => ({ key: e.id, fusion: gardeImportRelu(fichesLocales[cleDe(e)]) })) };
    for (const [cle, fermeture] of fermetures) {
      (puts.imports ||= []).push(fermeture.row);
      effets.retirer.push(...lot.seqs.filter(seq => cleDe(entreesParSeq.get(seq) || {}) === cle));
      if (!await db.get('sync_conflicts', fermeture.copie.id)) effets.conflits.push(fermeture.copie);
      if (fermeture.entree) (puts.outbox ||= []).push(fermeture.entree);
    }
    if (puts.files) {
      conditions = { ...(conditions || {}), files: puts.files.map((ligne) => conditionFichier(ligne.sha256, fichesLocales[cleDe({ store: 'files', id: ligne.sha256 })] ?? null, ligne, ligne.updated_at)) };
      delete puts.files;
    }
    for(const store of ['recipes','book_editions'])if(puts[store]) {
      conditions={...(conditions||{}),[store]:puts[store].map(row=>({key:row.id,fusion:current=>{
        const sent=lot.elements.find(e=>e.store===store&&e.id===row.id)?.data;
        return idCycle(current)===idCycle(sent)&&current?.updated_at===fichesLocales[`${store}:${row.id}`]?.updated_at?row:null;
      }}))};
      delete puts[store];
    }
    if (effets.conflits.length) puts.sync_conflicts = effets.conflits;
    if (effets.quarantaine.length) {
      (puts.outbox ||= []).push(...effets.quarantaine.map(({ seq, motif }) => ({ ...entreesParSeq.get(seq), quarantined_at: new Date(maintenant()).toISOString(), last_error: motif })));
    }
    // origin 'remote' : rien de ceci ne repart vers le serveur (réécriture d'un ajustement, journal, quarantaine).
    const deletes = {};
    if (effets.retirer.length) deletes.outbox = effets.retirer;
    if (effets.retirerConflits.length) deletes.sync_conflicts = effets.retirerConflits; // R-L3-29, même transaction
    conditions={...(conditions||{}),sync_state:[gardeCompteCycle(owner,getUserId)]};
    await db.mutate({ puts, deletes, origin: 'remote', conditions });
    return effets;
  }

  async function appliquerJournalTraduction(lot,reponse,entreesParSeq){
    const effets={retirer:[],reecrire:{},conflits:[],quarantaine:[],retirerConflits:[]},owner=getUserId(),entry=entreesParSeq.get(lot.seqs[0]);
    if(lot.elements.length!==1||lot.seqs.length!==1||!estPhaseJournalTraduction(entry))return effets;
    const meme=r=>r.store===entry.store&&r.id===entry.id,rejete=(reponse.rejected||[]).find(meme),accuse=[...(reponse.accepted||[]),...(reponse.adjusted||[])].some(meme);
    if(!rejete&&!accuse)return effets;
    const conditions={sync_state:[gardeCompteCycle(owner,getUserId)],outbox:[{key:entry.seq,fusion:r=>{if(JSON.stringify(r)!==JSON.stringify(entry))throw Error('Phase de traduction changée pendant envoi');return null;}}]};
    if(rejete){
      const conflit={id:'translation-journal:'+entry.id+':'+entry.seq,kind:'translation',store:entry.store,record_id:entry.id,user_id:owner,local:structuredClone(entry.snapshot),server:rejete.server??null,reason:rejete.reason,at:new Date(maintenant()).toISOString()};
      effets.conflits.push(conflit);await db.mutate({origin:'remote',puts:{outbox:[{...entry,lifecycle_blocked:true,last_error:rejete.reason||'conflit'}],sync_conflicts:[conflit]},conditions});
    }else{effets.retirer.push(entry.seq);await db.mutate({origin:'remote',deletes:{outbox:[entry.seq]},conditions});}
    return effets;
  }

  async function appliquerSourcesL5(lot,reponse,entreesParSeq){
    const c=lot.elements[0],owner=getUserId(),entree=lot.seqs.map(s=>entreesParSeq.get(s)).find(e=>estCommandeProtegee(e)&&e.payload.operation_id===c.operation_id);
    const effets={retirer:[],reecrire:{},conflits:[],quarantaine:[],retirerConflits:[]};if(!entree)return effets;
    const match=r=>r.store===c.store&&r.id===c.id&&r.operation_id===c.operation_id&&r.payload_sha256===c.payload_sha256;
    const ack=(reponse.accepted||[]).find(match),refus=(reponse.rejected||[]).find(match);if(!ack&&!refus)return effets;
    const puts={},deletes={},conditions={sync_state:[gardeCompteCycle(owner,getUserId)],outbox:[{key:entree.seq,fusion:r=>{if(JSON.stringify(r)!==JSON.stringify(entree))throw Error('Intention source modifiée pendant envoi');return null;}}]};
    if(ack){
      const attendus=c.op==='source_transfer'?(c.phase==='part'?c.rows.map(r=>({store:r.store,id:r.id})):c.phase==='finish'?[{store:c.store,id:c.id}]:[]):ciblesCommandeProtegee(c),rows=ack.server_rows;
      if(!Array.isArray(rows)||rows.length!==attendus.length||new Set(rows.map(cleDe)).size!==rows.length||rows.some(r=>!attendus.some(a=>cleDe(a)===cleDe(r))||r.deleted_at||r.data?.id!==r.id||!Number.isFinite(Date.parse(r.updated_at))||!Number.isFinite(r.server_seq)))return effets;
      for(const r of rows){const key=CLE_SOURCE_CONFIRMEE(r.store,r.id);conditions.sync_state.push({key,fusion:current=>current?.value?.user_id===owner&&current.value.server_seq>r.server_seq?null:{key,value:{user_id:owner,data:r.data,server_seq:r.server_seq,updated_at:r.updated_at,deleted_at:null}}});}
      deletes.outbox=[entree.seq];effets.retirer=[entree.seq];
    }else{
      const file=await fileDe(db,owner),cles=new Set(ciblesCommandeProtegee(c).map(cleDe));
      puts.outbox=file.filter(e=>e.seq>=entree.seq&&(e.seq===entree.seq||estCommandeProtegee(e)&&ciblesCommandeProtegee(e.payload).some(r=>cles.has(cleDe(r))))).map(e=>({...e,lifecycle_blocked:true,last_error:refus.reason||'source_changed'}));
      const kind=estCommandeTraduction(c)?'translation':'source';
      const conflit={id:kind+':'+c.operation_id,store:c.store,record_id:c.id,operation_id:c.operation_id,user_id:owner,local:c,server:refus.server||null,reason:refus.reason||'source_changed',at:reponse.server_time||new Date().toISOString(),kind};puts.sync_conflicts=[conflit];effets.conflits=[conflit];
      const serveur=refus.server;if(serveur?.data?.id===c.id&&Number.isFinite(serveur.server_seq)){const key=CLE_SOURCE_CONFIRMEE(c.store,c.id);conditions.sync_state.push({key,fusion:current=>current?.value?.user_id===owner&&current.value.server_seq>serveur.server_seq?null:{key,value:{user_id:owner,data:serveur.data,server_seq:serveur.server_seq,updated_at:serveur.updated_at,deleted_at:serveur.deleted_at??null}}});}
    }
    await db.mutate({puts,deletes,conditions,origin:'remote'});return effets;
  }

  async function appliquerSources(lot, reponse, entreesParSeq) {
    const c = lot.elements[0], owner = getUserId();
    const entree = lot.seqs.map(seq => entreesParSeq.get(seq)).find(e => estLotSources(e) && e.payload.operation_id === c.operation_id);
    const effets = { retirer: [], reecrire: {}, conflits: [], quarantaine: [], retirerConflits: [] };
    if (!entree) return effets;
    const correspond = r => r.store === c.store && r.id === c.id && r.operation_id === c.operation_id;
    const ack = reponse.accepted?.find(correspond), refus = reponse.rejected?.find(correspond);
    if (!ack && !refus) return effets;
    const puts = {}, deletes = {}, conditions = { sync_state: [gardeCompteCycle(owner, getUserId)], outbox: [{ key: entree.seq, fusion: row => {
      if (JSON.stringify(row) !== JSON.stringify(entree)) throw Error('Lot de sources modifié pendant son envoi'); return null;
    } }] };
    if (ack) {
      const records = ack.server_rows;
      if (!Array.isArray(records) || records.length !== c.rows.length || new Set(records.map(cleDe)).size !== records.length) return effets;
      if (records.some(r => !c.rows.some(x => cleDe(x) === cleDe(r)) || r.deleted_at || r.data?.id !== r.id || !Number.isFinite(Date.parse(r.updated_at)))) return effets;
      for (const record of records) {
        const sent = c.rows.find(x => cleDe(x) === cleDe(record));
        (conditions[record.store] ||= []).push({ key: record.id, fusion: row => {
          // L'heure peut être ajustée ; une saisie postérieure conserve son propre envoi.
          return JSON.stringify(row) === JSON.stringify(sent.data) ? { ...row, updated_at: record.updated_at } : null;
        } });
      }
      effets.retirer.push(entree.seq); deletes.outbox = [entree.seq];
    } else {
      const file = await fileDe(db, owner);
      puts.outbox = file.filter(e => e.seq >= entree.seq && cibleCommune(e, entree)).map(e => ({ ...e, lifecycle_blocked: true, last_error: 'cycle' }));
      effets.conflits.push({ id: `source_batch:${c.operation_id}`, store: c.store, record_id: c.id, local: c,
        server: refus.server || null, edition_server: refus.edition_server || null, at: reponse.server_time || new Date().toISOString(), kind: 'cycle' });
      puts.sync_conflicts = effets.conflits;
    }
    await db.mutate({ puts, deletes, conditions, origin: 'remote' });
    return effets;
  }

  async function appliquerCommande(lot,reponse,entreesParSeq) {
    if(lot.elements[0]?.entity==='edition'||lot.elements[0]?.edition_id) return appliquerCommandeLiee(lot,reponse,entreesParSeq);
    const owner=getUserId();
    const c=lot.elements[0];
    const entree=lot.seqs.map(s=>entreesParSeq.get(s)).find(e=>commandeCycle(e)&&e.payload?.operation_id===c.operation_id);
    const effets={retirer:[],reecrire:{},conflits:[],quarantaine:[],retirerConflits:[]};
    if(!entree) return effets;
    const ack=(reponse.accepted||[]).find(a=>a.store==='recipes'&&a.id===c.id&&a.operation_id===c.operation_id);
    const rejet=(reponse.rejected||[]).find(a=>a.store==='recipes'&&a.id===c.id&&a.operation_id===c.operation_id);
    if(!ack&&!rejet) return effets;
    const locale=await db.get('recipes',c.id);
    const file=(await fileDe(db,getUserId())).filter(e=>e.op==='lifecycle'&&e.id===c.id);
    const serveur=(ack||rejet).server;
    const puts={},deletes={};let conditions=null;
    if(ack) {
      if(serveur?.data?.id!==c.id||idCycle(serveur.data)!==c.operation_id||lireCycleRecette(serveur.data).etat!==(c.action==='trash'?'retiree':'active')||!Number.isFinite(Date.parse(serveur.updated_at))) return effets; // accusé tronqué ou d'une autre époque
      effets.retirer.push(entree.seq);
      for(const seq of lot.seqs) if(seq!==entree.seq) {
        const e=entreesParSeq.get(seq);
        if(ack.seed_used===true) effets.retirer.push(seq);
        else if(e) {
          (puts.outbox ||= []).push({...e,lifecycle_blocked:true,last_error:'cycle',payload:c.seed});
          effets.conflits.push({id:`recipes:${c.id}`,store:'recipes',record_id:c.id,local:c.seed,server:serveur,at:reponse.server_time||new Date().toISOString(),kind:'cycle'});
          puts.sync_conflicts=effets.conflits;
        }
      }
      deletes.outbox=effets.retirer;
    } else {
      puts.outbox=file.map(e=>({...e,lifecycle_blocked:true,last_error:'cycle'}));
      effets.conflits.push({id:`recipes:${c.id}`,store:'recipes',record_id:c.id,local:locale,server:serveur||null,at:reponse.server_time||new Date().toISOString(),kind:'cycle'});
      puts.sync_conflicts=effets.conflits;
    }
    if(serveur?.data?.id===c.id&&lireCycleRecette(serveur.data).etat!=='invalide') {
      const data={...serveur.data,updated_at:serveur.updated_at};
      puts.sync_state=[{key:CLE_CYCLE_CONFIRME(c.id),value:{data,user_id:getUserId()}}];
      const restants=ack?file.filter(e=>e.seq!==entree.seq):[];
      conditions={recipes:[{key:c.id,fusion:current=>idCycle(current)!==idCycle(locale)?current:fusionCycle(current,data,restants).row}]};
    }
    conditions={...(conditions||{}),sync_state:[gardeCompteCycle(owner,getUserId)]};
    await db.mutate({puts,deletes,conditions,origin:'remote'});
    return effets;
  }

  async function appliquerCommandeLiee(lot,reponse,entreesParSeq,tentative=0) {
    const owner=getUserId(),c=lot.elements[0],edition=c.entity==='edition',store=edition?'book_editions':'recipes';
    const entree=lot.seqs.map(s=>entreesParSeq.get(s)).find(e=>e?.op==='lifecycle'&&e.payload?.operation_id===c.operation_id);
    const effets={retirer:[],reecrire:{},conflits:[],quarantaine:[],retirerConflits:[]};if(!entree)return effets;
    const correspond=a=>a.store===store&&a.id===c.id&&a.operation_id===c.operation_id;
    const ack=reponse.accepted?.find(correspond),refus=reponse.rejected?.find(correspond),resultat=ack||refus;
    if(!resultat)return effets;
    const valide=(row,s,id)=>row?.data?.id===id&&Number.isFinite(row.server_seq)&&Number.isFinite(Date.parse(row.updated_at))&&(s==='book_editions'?lireCycleEdition(row.data):lireCycleRecette(row.data)).etat!=='invalide';
    if(ack&&(!valide(ack.server,store,c.id)||idCycle(ack.server.data)!==c.operation_id||!Number.isFinite(Date.parse(ack.server.updated_at))||(!edition&&!valide(ack.edition_server,'book_editions',c.edition_id))))return effets;
    if(ack&&(ack.server.data.trashed_at!=null)!==(c.action==='trash'))return effets;
    if(ack&&c.action==='trash'&&edition&&ack.server.data.trash_mode!==c.mode)return effets;
    if(ack&&c.action==='restore_from_edition'&&(ack.server.data.restored_from_edition?.edition_id!==c.edition_id||ack.server.data.restored_from_edition?.lifecycle_id!==c.base_edition_cycle_id))return effets;
    const file=await fileDe(db,owner),locale=await db.get(store,c.id),puts={},deletes={},conditions={sync_state:[gardeCompteCycle(owner,getUserId)]};
    if(ack){effets.retirer.push(entree.seq);deletes.outbox=[entree.seq];}
    else {
      puts.outbox=file.filter(e=>e.seq>=entree.seq&&cibleCommune(e,entree)).map(e=>({...e,lifecycle_blocked:true,last_error:'cycle'}));
      effets.conflits.push({id:`${store}:${c.id}`,store,record_id:c.id,local:locale,server:refus.server||null,edition_server:refus.edition_server||null,at:reponse.server_time||new Date().toISOString(),kind:'cycle'});
      puts.sync_conflicts=effets.conflits;
    }
    const confirmer=async(s,id,serveur)=>{
      if(!valide(serveur,s,id))return;
      const cle=s==='book_editions'?CLE_EDITION_CONFIRMEE(id):CLE_CYCLE_CONFIRME(id),connu=await db.get('sync_state',cle);
      const utilise=connu?.value?.user_id===owner&&Number.isFinite(connu?.value?.server_seq)&&connu.value.server_seq>serveur.server_seq?connu.value:{data:{...serveur.data,updated_at:serveur.updated_at},server_seq:serveur.server_seq,user_id:owner};
      const avant=await db.get(s,id),commandes=file.filter(e=>e.op==='lifecycle'&&e.store===s&&e.id===id&&(!ack||e.seq!==entree.seq));
      const fusion=s==='book_editions'?fusionEdition:fusionCycle;
      (conditions[s]||=[]).push({key:id,fusion:row=>idCycle(row)!==idCycle(avant)?row:fusion(row,utilise.data,refus?[]:commandes).row});
      conditions.sync_state.push({key:cle,fusion:row=>{
        if(JSON.stringify(row??null)!==JSON.stringify(connu??null))throw Object.assign(new Error('Confirmation reçue pendant l’accusé'),{code:'SYNC_CONFIRMATION_CHANGED'});
        return {key:cle,value:utilise};
      }});
    };
    await confirmer(store,c.id,resultat.server);
    if(!edition)await confirmer('book_editions',c.edition_id,resultat.edition_server);
    try { await db.mutate({puts,deletes,conditions,origin:'remote'}); }
    catch(error) { if(error.code==='SYNC_CONFIRMATION_CHANGED'&&tentative<3)return appliquerCommandeLiee(lot,reponse,entreesParSeq,tentative+1);throw error; }
    return effets;
  }

  // Un échec passager (réseau, 5xx, 429) : chaque entrée du lot compte l'essai et porte son heure de reprise.
  // `tries` AVANT incrément gouverne l'attente, donc le premier échec rend la main dans 2 s. Origine 'remote' :
  // ce marquage n'est pas un geste de la personne et ne repart jamais vers le serveur.
  async function reporter(seqs, entreesParSeq, erreur) {
    const puts = [];
    for (const s of seqs) {
      const e = entreesParSeq.get(s);
      if (!e) continue;
      const avant = e.tries || 0;
      puts.push({ ...e, tries: avant + 1, next_try_at: new Date(maintenant() + reculMs(avant)).toISOString(), last_error: erreur.type });
    }
    if (puts.length) await db.mutate({ puts: { outbox: puts }, origin: 'remote' });
  }

  // Les seq de la file qui correspondent aux éléments d'une moitié de lot (une clé peut en porter plusieurs).
  function seqsDe(lot, elements, entreesParSeq) {
    const cles = new Set(elements.map(cleDe));
    return lot.seqs.filter((s) => { const e = entreesParSeq.get(s); return e && cles.has(cleDe(e)); });
  }

  // Un lot → le serveur. Rend `true` si la passe peut continuer, `false` s'il faut l'arrêter (réseau, « inconnu »,
  // connexion à refaire, pause de quota). SEUL un `refus` dichotomise, et il n'arrête pas la passe.
  async function envoyerLot(lot, entreesParSeq, bilan) {
    const owner=getUserId();
    const appel = await transport.pousser(lot.elements);
    if(getUserId()!==owner) {bilan.erreur={type:'auth',status:null};bilan.attenteConnexion=true;return false;}
    const reponse = appel.reponse;
    // Pas d'erreur et pas de réponse : le serveur n'a rien accusé, donc rien n'est retiré (I5). Traité comme un
    // « inconnu » — donc en recul (R-L3-9), jamais en quarantaine : on ne parque pas pour un silence.
    const vide = !appel.erreur && !reponse;
    const erreur = appel.erreur || (vide ? { type: 'inconnu', status: null, message: '' } : null);
    if (!erreur) {
      if (reponse.server_time) surHeure(appliquerHeureServeur(reponse.server_time, maintenant()));
      const effets = await appliquer(lot, reponse, entreesParSeq);
      const { envoyes, ajustes } = compter(effets, entreesParSeq);
      bilan.envoyes += envoyes;
      bilan.ajustes += ajustes;
      bilan.conflits += effets.conflits.length;
      bilan.quarantaine += effets.quarantaine.length;
      return true;
    }
    logError('sync.push', { reason: vide ? 'reponse vide' : erreur.type, status: erreur.status });
    // 401, 403, « adresse non autorisée » : aucun essai n'est compté — c'est la garde de compte qui doit rejouer,
    // pas la file qui doit reculer. Rien n'est perdu, rien n'est marqué.
    if (erreur.type === 'auth') { bilan.erreur = erreur; bilan.attenteConnexion = true; return false; }
    // 413, 507, « exceeded » : la place manque. On s'arrête et on le dit ; la file reste entière (I5).
    if (erreur.type === 'quota') {
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: new Date(maintenant()).toISOString() } }] }, origin: 'remote' });
      bilan.erreur = erreur; bilan.pause = true; return false;
    }
    // R-L3-9 : tout ce qui n'est pas un `refus` nommé RECULE — réseau, 5xx, 429, et « inconnu » (un 404, un cache
    // de schéma PostgREST périmé, une réponse vide). Parquer la file pour un déploiement en retard l'enterrerait ;
    // seule une règle du serveur qui refuse une fiche justifie une quarantaine.
    if (erreur.type !== 'refus') {
      await reporter(lot.seqs, entreesParSeq, erreur);
      bilan.erreur = erreur;
      // Annoncé à l'interface : l'attente que les entrées viennent de se donner (tries d'avant l'incrément).
      bilan.recul = reculMs(Math.max(0, ...lot.seqs.map((s) => entreesParSeq.get(s)?.tries || 0)));
      return false;
    }
    // refus : le serveur refuse le lot ENTIER, sans nommer le fautif. Dichotomie jusqu'à l'isoler : une seule fiche
    // finit en quarantaine (nommée, la personne décide), les autres passent.
    if (lot.elements.length <= 1) {
      const seq = lot.seqs.length ? Math.max(...lot.seqs) : null;
      const entree = seq === null ? null : entreesParSeq.get(seq);
      // Un lot sans seq lisible ne peut désigner personne : rien n'est parqué, et c'est journalisé.
      if (!entree) { logError('sync.push', { reason: 'refus sans entree' }); return true; }
      await db.mutate({
        puts: { outbox: [{ ...entree, quarantined_at: new Date(maintenant()).toISOString(), last_error: 'refus' }] },
        deletes: { outbox: lot.seqs.filter((s) => s !== seq) },
        origin: 'remote',
      });
      bilan.quarantaine += 1;
      return true;
    }
    const milieu = Math.ceil(lot.elements.length / 2);
    const gauche = lot.elements.slice(0, milieu);
    const droite = lot.elements.slice(milieu);
    const okG = await envoyerLot({ elements: gauche, seqs: seqsDe(lot, gauche, entreesParSeq) }, entreesParSeq, bilan);
    // Une moitié qui rend `false` a rencontré un arrêt (réseau, connexion, pause, réponse vide) : la seconde moitié
    // n'est pas tentée, et rien n'est mis en quarantaine par accident.
    if (!okG) return false;
    return envoyerLot({ elements: droite, seqs: seqsDe(lot, droite, entreesParSeq) }, entreesParSeq, bilan);
  }

  async function envoyer() {
    const bilan = { envoyes: 0, ajustes: 0, conflits: 0, quarantaine: 0, retenues: 0, abandonnees: 0, recul: null, erreur: null, pause: false, attenteConnexion: false };
    const file = await lireFile();
    if (!file.length) return bilan;
    if(file.some(estCommandeSources)){
      const owner=getUserId(),key='source-capability:'+owner,cached=await db.get('sync_state',key);
      if(cached?.value?.protocol!==1){const r=typeof transport.capacites==='function'?await transport.capacites():null;if(r?.erreur||r?.capacites?.source_revisions!==1){bilan.erreur=r?.erreur||{type:'incompatible'};return bilan;}await db.mutate({origin:'remote',puts:{sync_state:[{key,value:{protocol:1}}]},conditions:{sync_state:[gardeCompteCycle(owner,getUserId)]}});}
    }
    if(file.some(e=>estCommandeTraduction(e)||estPhaseJournalTraduction(e))){
      const owner=getUserId(),key='translation-capability:'+owner,cached=await db.get('sync_state',key);
      if(cached?.value?.protocol!==1){const r=typeof transport.capacites==='function'?await transport.capacites():null;if(r?.erreur||r?.capacites?.recipe_language!==1){bilan.erreur=r?.erreur||{type:'incompatible'};return bilan;}await db.mutate({origin:'remote',puts:{sync_state:[{key,value:{protocol:1}}]},conditions:{sync_state:[gardeCompteCycle(owner,getUserId)]}});}
    }
    const entreesParSeq = new Map(file.map((e) => [e.seq, e]));
    const sources=await db.getSnapshot(['imports','recipe_translations']);
    const { lots, retenues, abandonnees } = await composerLots(file, (store, id) => db.get(store, id),{versionsSources:idsVersionsSourcesTraduction(sources,file)});
    bilan.retenues = retenues.length;
    bilan.abandonnees = abandonnees.length;
    await marquerRetenues(retenues, entreesParSeq);
    await retirerAbandonnees(abandonnees);
    for (const lot of lots) {
      const continuer = await envoyerLot(lot, entreesParSeq, bilan);
      if (!continuer) break;
    }
    return bilan;
  }

  return { envoyer };
}
