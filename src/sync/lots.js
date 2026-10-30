import {estCommandeSources,ciblesCommandeSources} from './commandes-sources.js';
import {verifierEmpreinteCommandeSources} from '../domain/sources-format.js';
// Composition des lots d'envoi (spec § 5.3) : pur, sans base ni réseau. L'ordre est celui de la file (seq), chaque
// (store, id) part une fois (la version la plus récente), un put est RELU au moment de l'envoi (la file ne garde
// pas la fiche), une suppression part avec son payload. Bornes du serveur appliquées avec une marge pour le lot ;
// la dichotomie de l'envoi reste le filet.
import { estLotSources } from './lot-sources.js';
import { projectionFichier, remoteDeCeCompte } from './tables.js';
import { commandeCycle, recettesDe } from './cycle.js';
import { commandeEdition, editionsDe, cibleCommune } from './cycle-edition.js';

export const estLectureSourceSignee=(store,row)=>store==='imports'&&!!row&&(row.source_capture!==undefined||row.index_call!==undefined||row.index_storage!==undefined);

export const LIMITES = { elements: 500, lot: 921600, element: 524288 };
const evenement = e => commandeCycle(e) || estLotSources(e) || estCommandeSources(e);
const CONTROLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const encodeur = new TextEncoder();

// PostgreSQL refuse \u0000 dans un jsonb ; les autres caractères de contrôle ne portent aucun sens dans une fiche.
export function nettoyerChaines(valeur) {
  if (typeof valeur === 'string') return valeur.replace(CONTROLE, '');
  if (Array.isArray(valeur)) return valeur.map(nettoyerChaines);
  // Un `Blob` et une `Date` ne sont pas des objets nus : parcourus comme tels, ils ressortaient en `{}` — les
  // octets d'une photo perdus, une date devenue vide. Ce ne sont pas des chaînes : ils traversent intacts.
  if (valeur && typeof valeur === 'object' && !(valeur instanceof Blob) && !(valeur instanceof Date)) {
    const sortie = {};
    for (const [k, v] of Object.entries(valeur)) sortie[k] = nettoyerChaines(v);
    return sortie;
  }
  return valeur;
}

// R-L3-27 : « est-ce que nettoyer changerait quelque chose ? » — la question posée par la passe unique de
// `repo.init()`, qui ne réécrit une fiche QUE si la réponse est oui. La classe de caractères n'est pas redéfinie
// ici : la question est posée à `nettoyerChaines` lui-même, donc il n'y a toujours qu'une seule définition de ce
// qu'est un caractère de contrôle. Un `Blob` n'est jamais parcouru (ses octets ne sont pas du texte).
export function porteDesCaracteresDeControle(valeur) {
  if (typeof valeur === 'string') return nettoyerChaines(valeur) !== valeur;
  if (Array.isArray(valeur)) return valeur.some(porteDesCaracteresDeControle);
  if (valeur && typeof valeur === 'object' && !(valeur instanceof Blob) && !(valeur instanceof Date)) return Object.values(valeur).some(porteDesCaracteresDeControle);
  return false;
}

export const tailleJson = (valeur) => encodeur.encode(JSON.stringify(valeur)).length;

// Une clé de synchronisation, nommée ici une fois pour toutes : reponses.js et push.js la reprennent telle quelle.
export const cleDe = (e) => `${e.store}:${e.id}`;
const contexteCycle = entree => ({
  ...(Object.hasOwn(entree,'expected_cycle_id')?{recipe_id:entree.recipe_id,expected_cycle_id:entree.expected_cycle_id,historique:entree.historique===true,...(Object.hasOwn(entree,'expected_edition_id')?{expected_edition_id:entree.expected_edition_id}:{})}:{}),
  ...(entree.recipe_contexts?{recipe_contexts:entree.recipe_contexts}:{}),
  ...(entree.edition_contexts?{edition_contexts:entree.edition_contexts}:{}),
  ...(entree.archive_import?{archive_import:true}:{})
});

// Une clé par (store, id) : l'entrée la plus récente (seq le plus haut) représente la clé, tous les seq la suivent
// pour être retirés ensemble à l'accusé. L'ordre des clés est celui de leur PREMIÈRE apparition dans la file.
export function dedoublonner(entrees) {
  const parCle = new Map();
  for (const e of [...entrees].sort((a, b) => a.seq - b.seq)) {
    const cle = cleDe(e);
    const actuel = parCle.get(cle);
    if (!actuel) parCle.set(cle, { cle, entree: e, seqs: [e.seq] });
    else { actuel.seqs.push(e.seq); if (e.seq > actuel.entree.seq) actuel.entree = e; }
  }
  return [...parCle.values()];
}

// Une entrée → un élément de sync_push, ou une retenue (ligne files : L4 confirme l'empreinte avant l'envoi).
// R-L3-21 : pour une TOMBALE, l'heure envoyée est celle de l'ENTRÉE (l'instant du geste, posé par la capture), et
// jamais celle du payload — qui est l'heure de la dernière écriture de la fiche, donc exactement celle que le
// serveur possède déjà. Le payload part quand même avec son heure : il est la copie de la fiche (spec § 5.1).
const tombaleDe = (entree) => ({
  element: {
    store: entree.store,
    id: entree.id,
    data: entree.payload ? (estLectureSourceSignee(entree.store,entree.payload)?structuredClone(entree.payload):nettoyerChaines(entree.payload)) : null,
    updated_at: entree.updated_at,
    deleted: true,
    ...contexteCycle(entree),
  },
});

// Lot G (D-G8) : une entrée files part avec la PROJECTION serveur, relue au moment de l'envoi ; sans remote de ce compte (ou disparue), elle est
// retenue « fichier en attente » — la retenue PRÉCÈDE la branche « fiche disparue » (R-L3-28 : l. 99-101 de tests/sync-l3.js). Jamais une tombale.
async function elementFichier(entree, relire) {
  if (entree.op !== 'put') return { retenue: true };
  const fiche = await relire('files', entree.id);
  if (!fiche || !remoteDeCeCompte(fiche.remote, entree.user_id)) return { retenue: true };
  const data = nettoyerChaines(projectionFichier(fiche));
  return { element: { store: 'files', id: entree.id, data, updated_at: data.updated_at || entree.updated_at, deleted: false } };
}

async function elementDe(entree, relire) {
  if(estCommandeSources(entree)){await verifierEmpreinteCommandeSources(entree.payload);return{element:structuredClone(entree.payload)};}
  if (estLotSources(entree)) return { element: nettoyerChaines(entree.payload) };
  if (commandeCycle(entree)) return {element:{store:entree.store,id:entree.id,op:'lifecycle',...nettoyerChaines(entree.payload)}};
  if (entree.store === 'files') return elementFichier(entree, relire);
  if (entree.op === 'delete') return tombaleDe(entree);
  const fiche = entree.snapshot??await relire(entree.store, entree.id);
  if (fiche === undefined || fiche === null) {
    // R-L3-28 : la fiche n'existe plus ICI, et AUCUNE entrée `delete` ne la concerne (sinon celle-là aurait gagné
    // au dédoublonnage, étant plus récente). Elle a donc disparu par un chemin que la capture ignore : une
    // RÉCEPTION (origine 'remote' — le serveur a déjà cette suppression) ou un vidage d'appareil. L'entrée est
    // ABANDONNÉE, sans aucun envoi. L'envoyer en tombale avec l'heure de sa dernière écriture écrivait au serveur
    // une ligne supprimée pour une fiche qu'il ne connaissait peut-être même pas — et si une autre copie l'avait
    // modifiée depuis, cette tombale plus ancienne revenait en conflit à trancher pour rien.
    return { abandonnee: true };
  }
  // Un ancien put sans copie ne peut adopter les décisions appliquées depuis sa capture.
  if(estLectureSourceSignee(entree.store,fiche)&&!entree.snapshot)return{retenue:true,raison:'copie de lecture absente'};
  const data = estLectureSourceSignee(entree.store,fiche)?structuredClone(fiche):nettoyerChaines(fiche);
  return { element: { store: entree.store, id: entree.id, data, updated_at: data.updated_at || entree.updated_at, deleted: false,
    ...contexteCycle(entree) } };
}

const clesSources=e=>estCommandeSources(e)?[...ciblesCommandeSources(e.payload),...(e.payload.base_sources||[])].map(r=>r.store+':'+r.id):[cleDe(e)];
// Les préconditions de lecture d'un transfert sont portées par ses octets immuables,
// même quand begin/part n'embarquent pas encore la cible. Elles attendent aussi son finish accusé.
function lecturesSources(file){
 const groupes=new Map(),parEntree=new Map();
 const lire=(store,row,keys)=>{if(!row)return;if(row.source_copy?.source_id)keys.add(store+':'+row.source_copy.source_id);if(row.scan_session_id)keys.add('scan_sessions:'+row.scan_session_id);if(store==='imports')for(const id of row.page_ids||[])keys.add('source_pages:'+id);};
 for(const e of file){const c=e.payload,keys=c?.op==='source_transfer'?(groupes.get(c.transfer_id)||new Set()):new Set();
  if(c?.op==='source_transfer'){groupes.set(c.transfer_id,keys);lire(c.store,c.target,keys);for(const r of c.rows||[])lire(r.store,r.data,keys);}
  else if(c?.op==='index_apply'){keys.add('scan_sessions:'+c.session_id);for(const r of c.read_set||[])keys.add('imports:'+r.journal_id);}
  else if(estLectureSourceSignee(e.store,e.snapshot))lire(e.store,e.snapshot,keys);
  parEntree.set(e,keys);
 }return parEntree;
}

export async function composerLots(entrees, relire) {
  const lots = [];
  const retenues = [];
  const abandonnees = []; // R-L3-28 : rien à envoyer pour ces clés, et leurs entrées sont à retirer
  let courant = { elements: [], seqs: [], octets: 2 }; // « [] »
  const fermer = () => { if (courant.elements.length) lots.push({ elements: courant.elements, seqs: courant.seqs }); courant = { elements: [], seqs: [], octets: 2 }; };
  const commandes=new Map(),ordonnee=[...entrees].sort((a,b)=>a.seq-b.seq);
  for (const e of ordonnee) if(evenement(e)&&!commandes.has(cleDe(e))) commandes.set(cleDe(e),e);
  const editionsInitiales=new Map();
  for(const e of ordonnee) if(commandeEdition(e)&&e.payload.seed&&e.payload.base_cycle_id===null&&!editionsInitiales.has(e.id)) editionsInitiales.set(e.id,e);
  // La première publication conserve le parent actif capturé avant le retrait. La commande attend ensuite tous ses anciens contenus.
  const preparer=async e=>{
    if(e.store==='book_editions'&&e.op==='put') {
      const command=editionsInitiales.get(e.id);
      const snapshot=e.snapshot||(command&&e.seq<command.seq?command.payload.seed:await relire(e.store,e.id));
      return {...e,snapshot};
    }
    return e;
  };
  const file=[];for(const e of ordonnee)file.push(await preparer(e));
  const lectures=lecturesSources(file),cles=new Map(file.map(e=>[e,clesSources(e)]));
  // Une archive contient des transferts dont les lectures désignent d'autres graphes.
  // Le sens de cette dépendance prime leur ordre matériel dans la file, jamais l'inverse.
  const transferts=new Map();for(const e of file)if(e.payload?.op==='source_transfer'){const id=e.payload.transfer_id,g=transferts.get(id)||{writes:new Set(),reads:new Set()};for(const k of cles.get(e))g.writes.add(k);for(const k of lectures.get(e)||[])g.reads.add(k);transferts.set(id,g);}
  const dependances=new Map();for(const[id,g]of transferts){const deps=new Set();for(const[other,h]of transferts)if(other!==id&&[...g.reads].some(k=>!g.writes.has(k)&&h.writes.has(k)))deps.add(other);dependances.set(id,deps);}
  // Fermeture transitive pour ne pas bloquer l'origine derrière une copie de copie.
  for(const[id,deps]of dependances){const pend=[...deps];for(let n=0;n<pend.length;n++)for(const next of dependances.get(pend[n])||[])if(!deps.has(next)){deps.add(next);pend.push(next);}}
  const transfertId=e=>e.payload?.op==='source_transfer'?e.payload.transfer_id:null;
  const dependDe=(a,b)=>{const x=transfertId(a),y=transfertId(b);return !!x&&!!y&&x!==y&&dependances.get(x)?.has(y);};
  const communeSources=(a,b)=>{if(cibleCommune(a,b))return true;if(!estCommandeSources(a)&&!estCommandeSources(b))return false;const ca=cles.get(a)||clesSources(a),cb=cles.get(b)||clesSources(b),la=lectures.get(a)||new Set(),lb=lectures.get(b)||new Set();return ca.some(k=>cb.includes(k)||lb.has(k))||cb.some(k=>la.has(k));};
  const admissibles=[];
  for (const e of file) {
    const first=[...commandes.values()].filter(c=>communeSources(c,e)).sort((a,b)=>a.seq-b.seq)[0];
    const avant=file.filter(x=>x.seq<e.seq);
    const attendCommande=file.some(x=>dependDe(e,x))||avant.some(x=>evenement(x)&&communeSources(x,e)&&!dependDe(x,e));
    const attendContenu=(commandeEdition(e)||estLotSources(e)||estCommandeSources(e))&&avant.some(x=>!evenement(x)&&communeSources(x,e));
    const attendParent=editionsDe(e).some(id=>file.some(x=>x.op==='put'&&x.store==='book_editions'&&x.id===id&&x.seq!==e.seq&&(!commandeCycle(e)||x.seq<e.seq)))&&!['book_editions','books'].includes(e.store);
    const bookId=e.store==='book_editions'?(e.snapshot||e.payload?.seed)?.book_id:null;
    const attendLivre=!!bookId&&file.some(x=>x.store==='books'&&x.id===bookId&&x.op==='put');
    if (e.lifecycle_blocked || e.lifecycle_waiting || e.quarantined_at || attendCommande||attendContenu||attendParent||attendLivre) {retenues.push({seq:e.seq,seqs:[e.seq],raison:'cycle en attente'});continue;}
    // La création non encore reçue sera portée par le seed de la première commande. Ces séquences ne sont retirées qu'avec son accusé.
    if (!commandeEdition(first)&&first?.payload?.seed && e.store==='recipes' && e.op==='put' && e.seq<first.seq && first.payload.base_cycle_id==null) continue;
    admissibles.push(e);
  }
  const groupes=dedoublonner(admissibles.filter(e=>!evenement(e))).concat(admissibles.filter(evenement).map(entree=>({entree,seqs:[entree.seq,...entrees.filter(e=>!commandeEdition(entree)&&e.store==='recipes'&&e.id===entree.id&&e.op==='put'&&e.seq<entree.seq&&entree.payload?.seed&&entree.payload.base_cycle_id==null).map(e=>e.seq)]})));
  const ordre=g=>evenement(g.entree)?g.entree.seq:Math.min(...g.seqs);
  groupes.sort((a,b)=>ordre(a)-ordre(b));
  for (const { entree, seqs } of groupes) {
    const r = await elementDe(entree, relire);
    if (r.retenue) { retenues.push({ seq: entree.seq, seqs, raison: r.raison||'fichier en attente' }); continue; }
    if (r.abandonnee) { abandonnees.push({ seq: entree.seq, seqs, raison: 'fiche disparue' }); continue; }
    if (evenement(entree)) {fermer();lots.push({elements:[r.element],seqs});continue;}
    const taille = tailleJson(r.element) + 1;
    const seul = tailleJson(r.element.data ?? {}) > LIMITES.element;
    if (seul) { fermer(); lots.push({ elements: [r.element], seqs }); continue; }
    if (courant.elements.length >= LIMITES.elements || courant.octets + taille > LIMITES.lot) fermer();
    courant.elements.push(r.element); courant.seqs.push(...seqs); courant.octets += taille;
  }
  fermer();
  return { lots, retenues, abandonnees };
}
