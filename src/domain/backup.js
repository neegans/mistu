// Sauvegarde complète et restauration (spec §31.1). Archive ZIP documentée : manifeste, données par magasin,
// fichiers sources avec empreinte SHA-256. Validation en mémoire avant toute écriture ; réimport idempotent (upsert par identifiant).
import { createZip, readZip, textOf } from '../core/zip.js';
import { sha256Hex } from '../core/hash.js';
import { ARCHIVE_FORMAT, ARCHIVE_FORMAT_VERSION, SUPPORTED_ARCHIVE_VERSIONS, ARCHIVE_DATA_STORES, SECRET_SETTING_KEYS, RELATIONS, STORES, APP_VERSION, SYNC_INTERNAL_STORES, SYNC_STORES, MAGASINS_AJOUTES_APRES_V1 } from '../model/schema.js';
import { nettoyerChaines } from '../sync/lots.js';
import { syncNow } from '../sync/clock.js';
import { remoteValide, HASH_FICHIER } from '../sync/tables.js';
import { estOriginalIci } from '../sync/fichiers.js';
import { capturerContextesInitiaux } from '../sync/contexte-initial.js';
import { isAllowed } from '../sync/mime.js';
import { lireCycleRecette, memeCycleRecette } from './cycle-recette.js';
import { lireCycleEdition, memeCycleEdition, exceptionEditionValide, memeExceptionEdition } from './cycle-edition.js';
import { ligneEpoqueEditeur,CLE_EPOQUE_EDITEUR } from './brouillons-format.js';
import { canoniqueSources, empreinteSources, validerRevisionSource, validerCopieSource, validerEtatSources, validerCaptureSources, validerAppelIndex, historiquePage, pagesActivesSeance, projectionIdentitePage, projectionIdentiteDocument, projectionIdentiteSeance } from './sources-format.js';
import { validerStockageIndex } from './index-stockage.js';
import { preparerSourcesArchive } from './transferts-source.js';
import { contientTraductionsExactes, estLigneTraductionReservee, validerFormesTraductionsArchive, verifierPreuvesTraductionsArchive, verifierIdentitesTraductionsArchive, preparerTraductionsArchive } from './traductions-archive.js';
import { contientCuisineExacte, estLigneCuisineReservee, validerFormesCuisineArchive, verifierIdentitesCuisineArchive, preparerCuisineArchive } from './cuisine-archive.js';
import {contientInventaireProtege,validerFormesInventaireArchive,verifierIdentitesInventaireArchive,preparerInventaireArchive} from './inventaire-archive.js';
import {estLotProtege} from './inventaire-format.js';
import {validerTransitionVersionStructuree} from './versions-structurees.js';

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf', 'application/epub+zip': 'epub', 'text/plain': 'txt' };
export const extFor = (mime) => MIME_EXT[mime] || 'bin';

const README_TXT = `Archive Cuisine OS
==================
manifest.json  : format, version du format, date, décomptes, liste des fichiers avec empreinte SHA-256.
data/*.json    : un tableau JSON par magasin (identifiants stables, relations par identifiant).
files/<sha256>.<ext> : scans, photos et PDF originaux, nommés par leur empreinte.
Le manifeste peut porter l'identifiant technique du compte qui a envoyé un fichier (un uuid, pas un secret).
Aucun secret d'accès n'est inclus. Cette archive est privée ; sa création ne publie rien.
Les brouillons locaux et les copies brutes des réponses de traduction ne sont pas inclus.
`;

const DATA_STORES = [...ARCHIVE_DATA_STORES, 'settings'];
const HASH = HASH_FICHIER; // I-G10 : une définition (src/sync/tables.js)
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validKey = (value) => typeof value === 'string' && value.trim().length > 0;
const validCount = (value) => Number.isSafeInteger(value) && value >= 0;
const MOTIFS_EXCLUSION = new Set(['cle_invalide','serialisation_invalide','cycle_recette_invalide','exception_livre_invalide','cycle_livre_invalide','source_invalide','version_invalide','traduction_invalide','cuisine_invalide','stock_invalide','relation_invalide','relation_absente','dependance_exclue','fichier_invalide']);
const refusArchive = code => {throw Object.assign(new Error(code),{code});};
function lireExclusions(manifest,stores,files=[]) {
  if(manifest==null||!own(manifest,'exclues'))return [];
  if(!Array.isArray(manifest.exclues))refusArchive('exclusions_archive_invalides');
  const vues=new Set();
  for(const r of manifest.exclues){
    if(!record(r)||Object.keys(r).length!==3||!['store','id','motif'].every(k=>own(r,k))||![...DATA_STORES,'files'].includes(r.store)
      ||r.id!==null&&!validKey(r.id)||!MOTIFS_EXCLUSION.has(r.motif))refusArchive('exclusions_archive_invalides');
    if(r.id!==null){
      const cle=JSON.stringify([r.store,r.id]),presentes=r.store==='files'?files:stores[r.store]||[];
      if(vues.has(cle)||presentes.some(x=>x?.[STORES[r.store].keyPath]===r.id))refusArchive('exclusions_archive_invalides');
      vues.add(cle);
    }
  }
  return structuredClone(manifest.exclues);
}
// Vague finale du lot G (chef d'orchestre, revue finale) : `upload_quality` est « par appareil, jamais synchronisé » (spec G § 3.3) — il ne voyage pas
// dans l'archive et une archive qui le porte ne l'écrit pas à la restauration (une seule définition pour les deux sens).
const CLES_PAR_APPAREIL = ['upload_quality'];
const publicSettings = (rows) => rows.filter((r) => !SECRET_SETTING_KEYS.includes(r.key) && !CLES_PAR_APPAREIL.includes(r.key));
const champsSourcesL5 = ['source_revision','source_copy','source_state','source_receipts','source_capture','index_call','index_storage','index_decision_revision','index_decisions','index_application_receipts','index_resolved_occurrences'];
const porteSourcesL5 = row => record(row) && champsSourcesL5.some(k=>own(row,k));
const exigeArchive4 = (stores,version) => version<4 && ['source_pages','source_documents','scan_sessions','imports'].some(s=>(stores[s]||[]).some(porteSourcesL5));
const contientSourcesExactes = stores => ['source_pages','source_documents','scan_sessions'].some(s=>(stores[s]||[]).some(porteSourcesL5));
const restaurationsSources = new WeakMap();
const observationsArchives = new WeakMap();
const MAGASINS_CAPTURE_SOURCES = ['source_documents','source_pages','scan_sessions','imports','book_editions','recipes','recipe_versions','recipe_translations','cook_sessions','timer_launches','cook_history','inventory'];
async function verifierPreuvesSources(stores) {
  await verifierPreuvesTraductionsArchive(stores);
  await validerStockageIndex(stores.imports||[]);
  const pages=new Map((stores.source_pages||[]).map(p=>[p.id,p])),sessions=new Map((stores.scan_sessions||[]).map(s=>[s.id,s]));
  for(const journal of stores.imports||[])if(journal.source_capture) {
    const capture=journal.source_capture,session=sessions.get(capture.session_id);
    validerCaptureSources(capture);
    if(!session||journal.scan_session_id!==session.id||(journal.edition_id??null)!==(session.edition_id??null)
      ||capture.selected_page_ids.some(id=>!session.page_ids?.includes(id)))throw new Error('Séance de capture historique incohérente : '+journal.id);
    // Le choix actif et les annotations peuvent avoir changé ; l’image historique reste exacte.
    for(const source of capture.pages) {
      const page=pages.get(source.id);
      if(!page||(page.edition_id??null)!==(session.edition_id??null)||await empreinteSources(projectionIdentitePage(page))!==source.identity_sha256)throw new Error('Identité de capture historique incohérente : '+journal.id);
    }
  }
  for(const [store,projection] of [['source_pages',projectionIdentitePage],['source_documents',projectionIdentiteDocument],['scan_sessions',projectionIdentiteSeance]]) {
    const rows=new Map((stores[store]||[]).map(r=>[r.id,r]));
    for(const row of rows.values())if(row.source_copy) {
      const origine=rows.get(row.source_copy.source_id);
      if(!origine||await empreinteSources(projection(origine))!==row.source_copy.source_identity_sha256)throw new Error('Provenance de copie de source incohérente : '+row.id);
      if(store!=='scan_sessions') {
        const champs=store==='source_pages'?['sha256','rotation','file_position','locator','document_page_number']:['source_type','sha256','blob_path','size','mime','original_filename','captured_at'];
        const actuelle=projection(row).fields,ancienne=projection(origine).fields;
        for(const champ of champs)if(canoniqueSources(actuelle.find(([k])=>k===champ))!==canoniqueSources(ancienne.find(([k])=>k===champ)))throw new Error('Identité de copie de source différente : '+row.id);
        const parent=store==='source_pages'?'document_id':'scan_session_id',magasin=store==='source_pages'?'source_documents':'scan_sessions';
        const correspond=(copie,id)=>copie?.source_copy?.source_id===id&&copie.source_copy.operation_id===row.source_copy.operation_id&&copie.edition_id===row.edition_id;
        if(origine[parent]==null?row[parent]!=null:!(stores[magasin]||[]).some(p=>p.id===row[parent]&&correspond(p,origine[parent])))throw new Error('Parent de copie de source incohérent : '+row.id);
        if(store==='source_pages') {
          const revision=row.source_revision,precedente=origine.source_revision;
          if(!revision||revision.operation_id!==row.source_copy.operation_id
            ||!correspond(rows.get(revision.family_id),precedente?.family_id||origine.id)
            ||(precedente?.parent_page_id==null?revision.parent_page_id!=null:!correspond(rows.get(revision.parent_page_id),precedente.parent_page_id))
            ||revision.reason!==(precedente?.parent_page_id?(precedente.reason==='attach'?'replace':precedente.reason):'attach'))throw new Error('Historique de copie de source incohérent : '+row.id);
        } else if(origine.replaces_document_id==null?row.replaces_document_id!=null:!correspond(rows.get(row.replaces_document_id),origine.replaces_document_id))throw new Error('Remplacement de document copié incohérent : '+row.id);
      }
    }
  }
}

// Une description de fichier (§ 3.4), UNE définition relue par inspectArchive et requireInspection (ronde 1, #18, #25). `bytes_*` ensemble ou
// aucun ; une entrée qui se dit l'original (bytes_sha256 === sha256, forme que createArchive n'écrit jamais) porte la taille de ses octets (#6) ;
// `remote` absent ou valide. Vague finale (chef d'orchestre, revue finale sécurité) : une COPIE (bytes_sha256 ≠ sha256) ne porte JAMAIS la taille de
// l'original — sinon une archive fabriquée ferait passer des octets quelconques pour l'original d'une page (estOriginalIci lit la taille) ; createArchive
// écrit alors `size: 0`, comme pour une copie sans taille (#7).
const remoteAdmis = (f) => !own(f, 'remote') || remoteValide(f.remote);
const bytesValides = (f) => {
  const n = ['bytes_sha256', 'bytes_size', 'bytes_mime'].filter((k) => own(f, k)).length;
  return n === 0 || (n === 3 && HASH.test(f.bytes_sha256) && validCount(f.bytes_size) && validKey(f.bytes_mime) && (f.bytes_sha256 !== f.sha256 ? f.bytes_size !== f.size : f.bytes_size === f.size));
};
const fichierValide = (f) => record(f) && HASH.test(f.sha256) && validCount(f.size) && validKey(f.mime) && bytesValides(f) && remoteAdmis(f);
const manquanteValide = (mf) => record(mf) && HASH.test(mf.sha256) && validKey(mf.mime) && validCount(mf.size) && remoteAdmis(mf);

function validateRows(stores) {
  const errors = [];
  if (!record(stores)) return ['Données par magasin absentes ou invalides'];
  for (const name of Object.keys(stores)) {
    if (!DATA_STORES.includes(name)) errors.push('Magasin inattendu : ' + name);
  }
  for (const name of DATA_STORES) {
    // C1 (spec import-cible § 3.7) : une archive faite avant qu'un magasin existe ne le porte pas ; absent, il vaut [] — présent, il
    // doit être un tableau comme les autres.
    if (!own(stores, name) && MAGASINS_AJOUTES_APRES_V1.includes(name)) continue;
    if (!own(stores, name) || !Array.isArray(stores[name])) {
      errors.push('Magasin absent ou invalide : ' + name);
      continue;
    }
    const key = STORES[name].keyPath;
    const ids = new Set();
    for (const row of stores[name]) {
      if (!record(row) || !validKey(row[key])) {
        errors.push(name + ' : chaque fiche doit avoir une clé ' + key + ' non vide');
        continue;
      }
      if (ids.has(row[key])) errors.push(name + ' : clé répétée ' + row[key]);
      if (name === 'recipes' && lireCycleRecette(row).etat === 'invalide') errors.push('Cycle de recette invalide : ' + row[key]);
      if (name === 'recipes' && !exceptionEditionValide(row)) errors.push('Exception de livre invalide : ' + row[key]);
      if (name === 'book_editions' && lireCycleEdition(row).etat === 'invalide') errors.push('Cycle de livre invalide : ' + row[key]);
      if (['source_pages','source_documents','scan_sessions','imports'].includes(name) && porteSourcesL5(row)) {
        try {
          canoniqueSources(row);
          if(name!=='imports')validerCopieSource(row);
          if(name==='source_pages')validerRevisionSource(row);
          if(name==='scan_sessions'&&own(row,'source_state'))pagesActivesSeance(row);
          if(name==='imports'&&row.source_capture!=null)validerCaptureSources(row.source_capture);
          if(name==='imports'&&row.index_call!=null)validerAppelIndex(row.index_call);
        } catch { errors.push('Format de source invalide : '+name+' '+row[key]); }
      }
      ids.add(row[key]);
    }
  }
  try { validerFormesTraductionsArchive(stores); }
  catch (e) { errors.push('Structure ou traduction invalide : ' + (e.code || 'forme_invalide')); }
  try { validerFormesCuisineArchive(stores); }
  catch (e) { errors.push('Séance ou minuteur invalide : ' + (e.code || 'forme_invalide')); }
  try { validerFormesInventaireArchive({stores,archiveVersion:ARCHIVE_FORMAT_VERSION}); }
  catch(e){ errors.push('Stock invalide : '+(e.code||'forme_invalide')); }
  return errors;
}

// Les points traversent des objets ; [] traverse un tableau de références ou d’objets.
// Une relation absente/nulle reste optionnelle ; une structure présente mais invalide est refusée.
function relationValues(value, parts) {
  if (!parts.length) return [value];
  if (value == null) return [];
  if (!record(value)) throw new Error('objet attendu');
  const [part, ...rest] = parts;
  const many = part.endsWith('[]');
  const key = many ? part.slice(0, -2) : part;
  if (!own(value, key) || value[key] == null) return [];
  const next = value[key];
  if (!many) return relationValues(next, rest);
  if (!Array.isArray(next)) throw new Error('tableau attendu');
  if (rest.length && next.some((item) => !record(item))) throw new Error('liste d’objets attendue');
  return next.flatMap((item) => relationValues(item, rest));
}

export function checkRelations(stores, fileHashes, {signaler=()=>{}}={}) {
  const errors = [];
  const ids = new Map();
  for (const [name, rows] of Object.entries(stores)) {
    if (!own(STORES, name) || !Array.isArray(rows)) continue;
    const key = STORES[name].keyPath;
    ids.set(name, new Set(rows.filter(record).map((row) => row[key])));
  }
  for (const [child, field, parent] of RELATIONS) {
    const rows = stores[child];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      let values;
      try { values = relationValues(row, field.split('.')); }
      catch (e) { errors.push(child + '.' + field + ' : ' + e.message);signaler({store:child,row,motif:'relation_invalide'});continue; }
      for (const value of values) {
        if (value == null || value === '') continue;
        if (!validKey(value)) {
          errors.push(child + '.' + field + ' : identifiant invalide');
          signaler({store:child,row,motif:'relation_invalide'});
        } else if (parent === 'files' ? !fileHashes.has(value) : !ids.get(parent)?.has(value)) {
          errors.push(child + '.' + field + ' → ' + parent + ' ' + value + ' introuvable');
          signaler({store:child,row,motif:'relation_absente',parent,id:value});
        }
      }
    }
  }
  const pages = new Map((stores.source_pages||[]).filter(record).map(p=>[p.id,p]));
  const documents = new Map((stores.source_documents||[]).filter(record).map(d=>[d.id,d]));
  for(const page of pages.values())if(own(page,'source_revision')) {
    try {
      historiquePage(page.id,pages);
      const doc=documents.get(page.document_id);
      if(page.document_id==null){
        const parent=pages.get(page.source_revision.parent_page_id),origine=pages.get(page.source_copy?.source_id);
        if(!(page.source_revision.reason==='rotate'&&parent&&parent.document_id==null||page.source_revision.reason==='attach'&&origine&&origine.document_id==null))throw new Error();
      }else if(!doc||(doc.edition_id??null)!==(page.edition_id??null)||doc.sha256!==page.sha256)throw new Error();
    } catch { errors.push('Historique de source incomplet ou incohérent : '+page.id);signaler({store:'source_pages',row:page,motif:'source_invalide'}); }
  }
  for(const session of stores.scan_sessions||[])if(record(session)&&own(session,'source_state')) {
    try {
      validerEtatSources(session,pages);
      for(const id of session.page_ids) {
        const p=pages.get(id),doc=p&&documents.get(p.document_id);
        if(!p||(p.edition_id??null)!==(session.edition_id??null)||p.document_id!=null&&(!doc||!session.document_ids?.includes(doc.id)||doc.scan_session_id!==session.id))throw new Error();
      }
    } catch { errors.push('Sélection de sources incomplète ou incohérente : '+session.id);signaler({store:'scan_sessions',row:session,motif:'source_invalide'}); }
  }
  return errors;
}

// Chaque diagnostic vise une seule ligne. Une preuve portant sur plusieurs lignes reste
// contrôlée à la fin : on ne devine jamais laquelle supprimer pour faire passer une signature.
function motifFicheExport(store,row,versions) {
  if(store==='recipes'){
    if(lireCycleRecette(row).etat==='invalide')return 'cycle_recette_invalide';
    if(!exceptionEditionValide(row))return 'exception_livre_invalide';
  }
  if(store==='book_editions'&&lireCycleEdition(row).etat==='invalide')return 'cycle_livre_invalide';
  if(['source_pages','source_documents','scan_sessions','imports'].includes(store)&&porteSourcesL5(row))try{
    canoniqueSources(row);if(store!=='imports')validerCopieSource(row);
    if(store==='source_pages')validerRevisionSource(row);
    if(store==='scan_sessions'&&own(row,'source_state'))pagesActivesSeance(row);
    if(store==='imports'&&row.source_capture!=null)validerCaptureSources(row.source_capture);
    if(store==='imports'&&row.index_call!=null)validerAppelIndex(row.index_call);
  }catch{return 'source_invalide';}
  if(store==='recipe_versions')try{validerTransitionVersionStructuree(null,row,{parents:versions});}catch{return 'version_invalide';}
  if(['recipe_translations','imports'].includes(store))try{validerFormesTraductionsArchive({[store]:[row]});}catch{return 'traduction_invalide';}
  if(['cook_sessions','timer_launches'].includes(store))try{validerFormesCuisineArchive({[store]:[row]});}catch{return 'cuisine_invalide';}
  if(store==='inventory')try{validerFormesInventaireArchive({stores:{inventory:[row]},archiveVersion:ARCHIVE_FORMAT_VERSION});}catch{return 'stock_invalide';}
  return null;
}
async function selectionExport(snapshot) {
  const exclues=[],retirees=new Set(),cle=(store,id)=>JSON.stringify([store,id]);
  const ecarter=(store,row,motif)=>{const id=validKey(row?.[STORES[store].keyPath])?row[STORES[store].keyPath]:null;exclues.push({store,id,motif});if(id!==null)retirees.add(cle(store,id));};
  const stores=Object.fromEntries(DATA_STORES.map(store=>{
    const rows=snapshot[store]??(MAGASINS_AJOUTES_APRES_V1.includes(store)?[]:null);
    if(!Array.isArray(rows))refusArchive('preuve_archive_non_attribuable');
    const selection=[];
    for(const row of store==='settings'?publicSettings(rows):rows){
      if(!record(row)||!validKey(row[STORES[store].keyPath])){ecarter(store,row,'cle_invalide');continue;}
      try{selection.push(JSON.parse(JSON.stringify(row)));}catch{ecarter(store,row,'serialisation_invalide');}
    }
    return[store,selection];
  }));
  const files=(snapshot.files||[]).filter(row=>{if(record(row)&&typeof row.sha256==='string'&&HASH.test(row.sha256))return true;ecarter('files',row,'fichier_invalide');return false;}),hashes=new Set(files.map(f=>f.sha256));
  const versions=new Map(stores.recipe_versions.map(r=>[r.id,r]));
  for(const store of DATA_STORES)stores[store]=stores[store].filter(row=>{const motif=motifFicheExport(store,row,versions);if(!motif)return true;ecarter(store,row,motif);return false;});
  let change=true;
  while(change){
    const invalides=new Map();
    checkRelations(stores,hashes,{signaler:({store,row,motif,parent,id})=>{if(!invalides.has(row))invalides.set(row,{store,motif:parent&&retirees.has(cle(parent,id))?'dependance_exclue':motif});}});
    // Ces pointeurs historiques sont souples en général. S'ils ciblent une ligne que cet
    // export écarte, leur dépendance connue ne peut pas servir à annoncer une restauration complète.
    for(const store of DATA_STORES)for(const row of stores[store]){
      const refs=[];
      if(store==='recipes')refs.push(['imports',row.index_import_id],['source_pages',row.index_page_id]);
      if(store==='imports'&&row.source_capture)refs.push(['scan_sessions',row.source_capture.session_id],...(row.source_capture.selected_page_ids||[]).map(id=>['source_pages',id]),...(row.source_capture.pages||[]).map(p=>['source_pages',p.id]));
      if(store==='recipe_translations')for(const s of row.translated_content?.segments||[])if(s.origin==='ai')refs.push(['imports',s.journal_id]);
      if(!invalides.has(row)&&refs.some(([s,id])=>validKey(id)&&retirees.has(cle(s,id))))invalides.set(row,{store,motif:'dependance_exclue'});
    }
    change=invalides.size>0;
    for(const store of DATA_STORES)stores[store]=stores[store].filter(row=>{const invalid=invalides.get(row);if(!invalid)return true;ecarter(store,row,invalid.motif);return false;});
  }
  try{
    if(validateRows(stores).length||checkRelations(stores,hashes).length)refusArchive('preuve_archive_non_attribuable');
    await verifierPreuvesSources(stores);await verifierIdentitesInventaireArchive({batch:stores,snapshot:{}});
  }catch{refusArchive('preuve_archive_non_attribuable');}
  return{stores,files,exclues};
}

// Une seule lecture IndexedDB cohérente ; le hachage et le ZIP se font après la transaction.
export async function createArchive(db, { deviceName = '' } = {}) {
  // Les magasins internes (spec § 5.1) n'existent pas forcément sur une base plus ancienne : lire ceux de la base, pas du schéma courant.
  const snapshot = await db.getSnapshot(Object.keys(db.stores));
  const {stores,files:fichiersValables,exclues}=await selectionExport(snapshot);
  // Conserver le compteur historique R-E-11 des traces vers une édition absente. Le bilan
  // B3 décrit désormais aussi les autres exclusions, sans aucune suppression dans la base.
  const editionsPresentes = new Set((snapshot.book_editions || []).map((e) => e?.id).filter(validKey));
  let tracesOrphelines = 0;
  for (const name of ['library_activity', 'rediscovery_prefs']) {
    tracesOrphelines += (snapshot[name]||[]).filter(row=>record(row)&&validKey(row.edition_id)&&!editionsPresentes.has(row.edition_id)).length;
  }
  const warnings = [];
  const entries = [], dataFiles = [], files = [];
  const counts = {};
  const enc = new TextEncoder();
  for (const name of DATA_STORES) {
    const data = enc.encode(JSON.stringify(stores[name]));
    const path = 'data/' + name + '.json';
    counts[name] = stores[name].length;
    entries.push({ path, data });
    dataFiles.push({ path, store: name, count: counts[name], sha256: await sha256Hex(data) });
  }
  let bytesTotal = 0;
  const manquantes = [];
  const copies = { serveur: 0, inconnues: 0 };
  for (const file of fichiersValables) {
    const remote = remoteValide(file.remote) ? file.remote : undefined;
    const mime = validKey(file.mime) ? file.mime : (validKey(file.blob?.type) ? file.blob.type : 'application/octet-stream');
    if (!(file.blob instanceof Blob)) {
      // D-G7 (R18) : une ligne sans octets ici entre dans missing_files, QUELLE QUE SOIT la valeur de remote (D-G12).
      manquantes.push({ sha256: file.sha256, mime, size: validCount(file.size) ? file.size : 0, ...(remote ? { remote } : {}) });
      continue;
    }
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const h = await sha256Hex(data);
    // Ronde 1 (#7) : une copie sans taille valide prend 0, comme missing_files — jamais la longueur de ses octets, qui la ferait passer pour l'original.
    const entree = { sha256: file.sha256, size: h === file.sha256 ? data.length : (validCount(file.size) ? file.size : 0), mime };
    if (h !== file.sha256) {
      if (entree.size === data.length) entree.size = 0; // vague finale : une copie de la taille de l'original est décrite sans taille (bytesValides la refuserait)
      // S-1 : des octets qui ne sont pas l'original sont décrits par bytes_*, quel que soit remote — jamais une levée (« Fichier source endommagé »
      // reste à l'inspection, pour un ZIP abîmé). Copie du serveur connue, ou autre chose (octets abîmés, copie périmée) : archivée telle quelle.
      Object.assign(entree, { bytes_sha256: h, bytes_size: data.length, bytes_mime: validKey(file.blob.type) ? file.blob.type : mime });
      if (remote && remote.sha256 === h) copies.serveur += 1; else copies.inconnues += 1;
    }
    if (remote) entree.remote = remote;
    const path = 'files/' + file.sha256 + '.' + extFor(entree.bytes_mime ?? mime);
    entries.push({ path, data });
    files.push({ path, ...entree });
    bytesTotal += data.length;
  }
  counts.files = files.length; // missing_files n'entre PAS dans counts : un client plus ancien refuse tout décompte de magasin inconnu
  const manifest = {
    format: ARCHIVE_FORMAT, format_version: ARCHIVE_FORMAT_VERSION, app_version: APP_VERSION,
    created_at: new Date().toISOString(), device_name: deviceName || null, counts, data_files: dataFiles, files, missing_files: manquantes,...(exclues.length?{exclues}:{}),
  };
  entries.unshift({ path: 'manifest.json', data: JSON.stringify(manifest, null, 2) });
  entries.push({ path: 'README.txt', data: README_TXT });
  const zip = createZip(entries);
  return { blob: new Blob([zip], { type: 'application/zip' }), manifest, bytes: zip.length, filesBytes: bytesTotal, warnings, tracesOrphelines, missingFiles: manquantes.length, copies,exclues };
}

// Inspection isolée : aucune écriture. Les archives v1 complètes existantes restent acceptées.
export async function inspectArchive(arrayBuffer, {db = null} = {}) {
  const errors = [], warnings = [];
  let manifest = null;
  const payload = { stores: Object.create(null), files: [], missing: [] };
  const fail = () => ({ ok: false, errors, warnings, manifest });
  try {
    const zip = readZip(arrayBuffer);
    const entry = zip.get('manifest.json');
    if (!entry) { errors.push('manifest.json absent : ce n’est pas une archive Cuisine OS'); return fail(); }
    if (!entry.crcOk) { errors.push('CRC invalide : manifest.json'); return fail(); }
    const parsed = JSON.parse(textOf(entry));
    if (!record(parsed)) { errors.push('Manifeste invalide : objet attendu'); return fail(); }
    manifest = parsed;
    if (manifest.format !== ARCHIVE_FORMAT) errors.push('Format inconnu : ' + manifest.format);
    if (!SUPPORTED_ARCHIVE_VERSIONS.includes(manifest.format_version)) errors.push('Version de format non prise en charge : ' + manifest.format_version);
    if (!Array.isArray(manifest.data_files) || !Array.isArray(manifest.files) || !record(manifest.counts)) errors.push('Manifeste incomplet : listes de données, fichiers et décomptes requis');
    if (errors.length) return fail();
    const paths = new Set(['manifest.json', 'README.txt']);
    const seenStores = new Set();
    for (const df of manifest.data_files) {
      if (!record(df) || !DATA_STORES.includes(df.store)) { errors.push('Description de magasin absente ou inconnue'); continue; }
      if (seenStores.has(df.store)) { errors.push('Magasin répété : ' + df.store); continue; }
      seenStores.add(df.store);
      if (df.path !== 'data/' + df.store + '.json' || paths.has(df.path)) { errors.push('Chemin de données invalide : ' + df.path); continue; }
      paths.add(df.path);
      if (!HASH.test(df.sha256) || !validCount(df.count)) { errors.push('Empreinte ou décompte invalide : ' + df.store); continue; }
      const dataEntry = zip.get(df.path);
      if (!dataEntry) { errors.push('Fichier de données manquant : ' + df.path); continue; }
      if (!dataEntry.crcOk || await sha256Hex(dataEntry.data) !== df.sha256) { errors.push('Données endommagées : ' + df.path); continue; }
      const rows = JSON.parse(textOf(dataEntry));
      if (!Array.isArray(rows)) { errors.push(df.path + ' ne contient pas un tableau'); continue; }
      payload.stores[df.store] = rows;
      if (rows.length !== df.count || !validCount(manifest.counts[df.store]) || rows.length !== manifest.counts[df.store]) errors.push('Décompte différent : ' + df.store);
    }
    errors.push(...validateRows(payload.stores));
    if(exigeArchive4(payload.stores,manifest.format_version))errors.push('Les révisions de source et lectures exactes exigent le format 4.');
    if(manifest.format_version<5&&contientTraductionsExactes(payload.stores))errors.push('Les groupes d’ingrédients et traductions exactes exigent le format 5.');
    if(manifest.format_version<6&&contientCuisineExacte(payload.stores))errors.push('Les séances et minuteurs persistants exigent le format 6.');
    if(manifest.format_version<7&&contientInventaireProtege(payload.stores))errors.push('Les stocks structurés exigent le format 7.');
    try{await verifierIdentitesInventaireArchive({batch:payload.stores,snapshot:{}});}catch(e){errors.push('Provenance du stock invalide : '+(e.code||'forme_invalide'));}
    if (manifest.format_version === 1 && (payload.stores.recipes || []).some(r => lireCycleRecette(r).id !== null)) errors.push('Une archive de format 1 ne porte pas de cycle de corbeille.');
    if (manifest.format_version < 3 && ((payload.stores.book_editions || []).some(e => lireCycleEdition(e).id !== null) || (payload.stores.recipes || []).some(r => r.restored_from_edition != null))) errors.push('Le cycle des livres exige le format 3.');
    const hashes = new Set();
    let missing = 0, hashMismatch = 0;
    for (const f of manifest.files) {
      if (!fichierValide(f)) { errors.push('Description de fichier invalide'); continue; }
      if (hashes.has(f.sha256)) { errors.push('Empreinte de fichier répétée : ' + f.sha256); continue; }
      hashes.add(f.sha256);
      const copie = own(f, 'bytes_sha256');
      if (f.path !== 'files/' + f.sha256 + '.' + extFor(copie ? f.bytes_mime : f.mime) || paths.has(f.path)) { errors.push('Chemin de fichier invalide : ' + f.path); continue; }
      paths.add(f.path);
      const fileEntry = zip.get(f.path);
      if (!fileEntry) { missing++; errors.push('Fichier source manquant : ' + f.path); continue; }
      if (!fileEntry.crcOk || await sha256Hex(fileEntry.data) !== (copie ? f.bytes_sha256 : f.sha256)) { hashMismatch++; errors.push('Fichier source endommagé : ' + f.path); continue; }
      if (fileEntry.data.length !== (copie ? f.bytes_size : f.size)) { errors.push('Taille différente : ' + f.path); continue; }
      payload.files.push({ sha256: f.sha256, bytes: fileEntry.data, mime: f.mime, size: f.size,
        ...(copie ? { bytes_sha256: f.bytes_sha256, bytes_size: f.bytes_size, bytes_mime: f.bytes_mime } : {}), ...(own(f, 'remote') ? { remote: f.remote } : {}) });
    }
    const listeManquantes = own(manifest, 'missing_files') ? manifest.missing_files : []; // archive d'avant le lot : absente = []
    if (!Array.isArray(listeManquantes)) errors.push('Description de fichier invalide');
    else for (const mf of listeManquantes) {
      if (!manquanteValide(mf)) { errors.push('Description de fichier invalide'); continue; }
      if (hashes.has(mf.sha256)) { errors.push('Empreinte de fichier répétée : ' + mf.sha256); continue; }
      hashes.add(mf.sha256);
      payload.missing.push({ sha256: mf.sha256, mime: mf.mime, size: mf.size, ...(own(mf, 'remote') ? { remote: mf.remote } : {}) });
    }
    if (!validCount(manifest.counts.files) || manifest.counts.files !== manifest.files.length) errors.push('Décompte différent : files');
    for (const name of Object.keys(manifest.counts)) if (!own(STORES, name)) errors.push('Décompte de magasin inconnu : ' + name);
    for (const path of zip.keys()) if (!paths.has(path)) errors.push('Entrée non déclarée dans le manifeste : ' + path);
    const relationErrors = checkRelations(payload.stores, new Set([...payload.files.map((f) => f.sha256), ...payload.missing.map((m) => m.sha256)]));
    errors.push(...relationErrors);
    try { await verifierPreuvesSources(payload.stores); } catch(e) { errors.push('Preuve de source invalide : '+e.message); }
    if (payload.stores.settings?.some((r) => record(r) && SECRET_SETTING_KEYS.includes(r.key))) warnings.push('Les réglages secrets présents dans cette archive seront ignorés.');
    let exclues=[];try{exclues=lireExclusions(manifest,payload.stores,[...payload.files,...payload.missing]);}catch(e){errors.push(e.code);}
    const inspection = {
      ok: errors.length === 0, errors, warnings, manifest, payload,exclues,
      summary: { counts: Object.fromEntries(Object.entries(payload.stores).map(([name, rows]) => [name, rows.length])),
        files_ok: payload.files.length, files_missing: missing, hash_mismatches: hashMismatch, relation_errors: relationErrors.length,
        files_distants: payload.missing.length, files_copies: payload.files.filter((f) => own(f, 'bytes_sha256')).length },
    };
    if (inspection.ok && db) {
      const snapshot = await db.getSnapshot([...MAGASINS_GRAPHE_ARCHIVE, 'sync_state']);
      const divergences = conflitsDansSnapshot(snapshot, payload.stores, 'merge');
      observationsArchives.set(inspection, {db, snapshot});
      if (divergences.length) {
        inspection.recettes = divergences.filter(d => d.entite !== 'edition').map(d => d.id);
        inspection.editions = divergences.filter(d => d.entite === 'edition').map(d => d.id);
        const anciennes = new Map(payload.stores.recipes.map(r => [r.id, r]));
        inspection.refus = !inspection.editions.length && inspection.recettes.length && inspection.recettes.every(id =>
          lireCycleRecette(anciennes.get(id)).id === null && lireCycleRecette(snapshot.recipes.find(r => r.id === id)).id !== null)
          ? 'retrait_posterieur' : 'cycles_divergents';
        if (!inspection.editions.length && inspection.recettes.length) {
          const selection = selectionFusion(payload.stores, snapshot, inspection.recettes);
          inspection.fusionSansRecettes = {ecartees:selection.ecartees,
            recettes:selection.ecartees.filter(r=>r.store==='recipes').map(r=>{const fiche=snapshot.recipes.find(x=>x.id===r.id)||anciennes.get(r.id);return {...r,titre:fiche?.display_title||fiche?.original_title||''};}),
            fiches:compterFichesSynchronisees({payload:{...payload,stores:selection.stores}})};
        }
      }
    }
    return inspection;
  } catch (e) {
    errors.push('Archive illisible : ' + e.message);
    return fail();
  }
}

function requireInspection(inspection, mode) {
  if (!['merge', 'replace'].includes(mode)) throw new Error('Mode de restauration inconnu');
  const payload = inspection?.payload;
  // Ronde 1 (#25) : un `missing` présent qui n'est pas un tableau est refusé ici, nommé — pas plus loin, par une clé invalide.
  if (!inspection?.ok || !record(payload) || !Array.isArray(payload.files) || (payload.missing != null && !Array.isArray(payload.missing))) throw new Error('Archive non validée');
  lireExclusions(inspection.manifest,payload.stores,[...payload.files,...payload.missing||[]]);
  const errors = validateRows(payload.stores);
  if(exigeArchive4(payload.stores,inspection.manifest?.format_version))errors.push('Les révisions de source et lectures exactes exigent le format 4.');
  if(inspection.manifest?.format_version<5&&contientTraductionsExactes(payload.stores))errors.push('Les groupes d’ingrédients et traductions exactes exigent le format 5.');
  if(inspection.manifest?.format_version<6&&contientCuisineExacte(payload.stores))errors.push('Les séances et minuteurs persistants exigent le format 6.');
  if(inspection.manifest?.format_version<7&&contientInventaireProtege(payload.stores))errors.push('Les stocks structurés exigent le format 7.');
  if (inspection.manifest?.format_version === 1 && (payload.stores.recipes || []).some(r => lireCycleRecette(r).id !== null)) errors.push('Une archive de format 1 ne porte pas de cycle de corbeille.');
  if (inspection.manifest?.format_version < 3 && ((payload.stores.book_editions || []).some(e => lireCycleEdition(e).id !== null) || (payload.stores.recipes || []).some(r => r.restored_from_edition != null))) errors.push('Le cycle des livres exige le format 3.');
  const hashes = new Set();
  // Mêmes règles qu'à l'inspection (fichierValide, manquanteValide), plus les octets : F-8, (bytes_size ?? size) === bytes.length.
  for (const file of payload.files) {
    const taille = record(file) && own(file, 'bytes_size') ? file.bytes_size : file?.size;
    if (!fichierValide(file) || !(file.bytes instanceof Uint8Array) || taille !== file.bytes.length || hashes.has(file.sha256)) errors.push('Fichier de restauration invalide');
    else hashes.add(file.sha256);
  }
  for (const mf of payload.missing ?? []) {
    if (!manquanteValide(mf) || hashes.has(mf.sha256)) errors.push('Fichier de restauration invalide');
    else hashes.add(mf.sha256);
  }
  errors.push(...checkRelations(payload.stores, hashes)); // B-6 : files ∪ missing
  if (errors.length) throw new Error('Archive non validée : ' + errors.slice(0, 10).join(' · '));
}

// C1 (spec import-cible § 3.7) : SEUL un magasin ajouté après le format 1 peut manquer à l'archive (validateRows, par requireInspection,
// exige tous les autres) ; absent, il vaut [] — en remplacement, il est donc vidé.
function restoredStores(inspection) {
  return Object.fromEntries(DATA_STORES.map((name) => [name,
    name === 'settings' ? publicSettings(inspection.payload.stores[name]) : (MAGASINS_AJOUTES_APRES_V1.includes(name) ? (inspection.payload.stores[name] ?? []) : inspection.payload.stores[name]),
  ]));
}

// Fiches d'une archive qui relèvent de la synchronisation (spec § 5.2) : celles-là repartiront au serveur après
// une restauration, et c'est ce nombre que le bilan annonce avant le geste. Les réglages n'en sont pas ; les
// fichiers sources comptent pour une fiche chacun (ils voyagent dans le manifeste, pas dans data/*.json).
// Pure : aucune lecture de base, aucun DOM.
export function compterFichesSynchronisees(inspection) {
  const stores = inspection?.payload?.stores;
  if (!stores) return 0;
  let total = 0;
  for (const name of SYNC_STORES) {
    if (name === 'files') total += (inspection.payload.files?.length || 0) + (inspection.payload.missing?.length || 0);
    else total += stores[name]?.length || 0;
  }
  return total;
}

// R61 (complément) : ce qu'une fiche restaurée doit devenir, pour un magasin synchronisé. Nommé une fois, et relu
// par `verifyRestored` : le bilan de restauration doit comparer la base à ce que la restauration PROMET d'écrire,
// sinon un nettoyage voulu serait annoncé comme un écart et toute restauration d'une vieille archive finirait en
// rouge. Raison du nettoyage : R61 retire les caractères de contrôle à l'écriture (`repo.save`/`saveBatch`), mais
// `applyArchive` écrit par `db.putBatch` sans passer par `repo` — une archive d'avant cette vague ramenait donc des
// fiches sales, et la fiche locale (sale) différait de la copie du serveur (que `lots.js` nettoie à l'envoi) à
// instants ÉGAUX : le conflit perpétuel revenait par la porte de l'archive. Un `Blob` traverse intact.
const historiquesInventaireExacts = stores => new Set((stores.inventory||[]).filter(estLotProtege).map(r=>r.source_cook_history_id).filter(Boolean));
const ficheRestauree = (name, row, {sourcesExactes=false,traductionsExactes=false,cuisineExacte=false,historiquesInventaire=null}={}) => {
  if(name==='cook_history'&&historiquesInventaire?.has(row.id))return structuredClone(row);
  if(name==='inventory'&&estLotProtege(row))return structuredClone(row);
  if(estLigneCuisineReservee(name,row))return structuredClone(row);
  if(((traductionsExactes||cuisineExacte)&&name==='recipe_versions')||(cuisineExacte&&name==='cook_history')||estLigneTraductionReservee(name,row))return structuredClone(row);
  if((sourcesExactes&&['source_pages','source_documents','scan_sessions'].includes(name))||(name==='imports'&&porteSourcesL5(row)))return structuredClone(row);
  return SYNC_STORES.includes(name)&&record(row)?nettoyerChaines(row):row;
};

// Normalisation des fiches restaurées (spec § 5.2, § 5.3) — trois règles, sur les magasins synchronisés, dans la
// même boucle :
//  1. NETTOYAGE (R61), dans tous les modes, avec ou sans compte : les caractères de contrôle sont retirés, pour que
//     la fiche écrite ici soit identique, octet pour octet, à celle que le serveur recevra.
//  2. COMPLÉTUDE (R-L3-10), dans tous les modes, avec ou sans compte : une fiche sans `updated_at` en reçoit un.
//     Les fiches d'avant ce lot et toutes les lignes « files » (dont les métadonnées sont reconstruites ici) en
//     sont dépourvues ; sync_push les rejetterait pour le motif « updated_at » et elles partiraient en quarantaine.
//  3. RENVOI VOULU (R-L3-18) : avec un compte connecté, `horodater` est fourni et TOUTES les fiches en reçoivent
//     un neuf — en fusion comme en remplacement. Sans cela le serveur garderait sa version (I7 : updated_at
//     strictement supérieur gagne) et la restauration ne se verrait sur aucun autre appareil. Un remplacement ne
//     supprime rien chez le fournisseur pour autant : ce qui n'est pas dans l'archive y reste (dit par Réglages).
const normaliserFiche = (name, row, { horodater, sourcesExactes=false, traductionsExactes=false, cuisineExacte=false, historiquesInventaire=null }) => {
  const fiche = ficheRestauree(name, row, {sourcesExactes,traductionsExactes,cuisineExacte,historiquesInventaire});
  if (typeof horodater === 'function') fiche.updated_at = horodater();
  else if (!fiche.updated_at) fiche.updated_at = syncNow();
  return fiche;
};
function normaliserFiches(batch, { horodater, sourcesExactes=false, traductionsExactes=false, cuisineExacte=false, historiquesInventaire=null }) {
  for (const name of SYNC_STORES) {
    const rows = batch[name];
    if (!Array.isArray(rows)) continue;
    for (const [i, row] of rows.entries()) if (record(row)) rows[i] = normaliserFiche(name, row, { horodater, sourcesExactes, traductionsExactes, cuisineExacte, historiquesInventaire });
  }
}

// R-G-6 (C-1) : ce que la restauration écrit pour une entrée `files`, NOMMÉ UNE FOIS et relu par applyArchive (dans la transaction, sur la ligne
// relue : ronde 1, #9) ET verifyRestored (le gabarit de ficheRestauree, R61 : le bilan compare la base à ce que la restauration a PROMIS). La
// DÉCISION seule, sans octets (ronde 1, #17 : verifyRestored ne recopie plus aucun blob). Un blob local ORIGINAL n'est jamais remplacé par une
// copie venue d'une archive, ni en fusion ni en remplacement, et il garde sa taille et son type (ceux de ses octets : une archive ne fait jamais
// d'un original une « copie », #6) ; une copie locale cède à ce que l'archive porte (l'original, ou une autre copie).
export function decisionRestauration(entry, ligne) {
  const entreeOriginale = (entry.bytes_sha256 ?? entry.sha256) === entry.sha256;
  if (!entreeOriginale && estOriginalIci(ligne)) return { garder: true, size: ligne.size, mime: ligne.mime ?? entry.mime, attendu: { sha256: entry.sha256, size: ligne.size } };
  return { garder: false, size: entry.size, mime: entry.mime, attendu: { sha256: entry.bytes_sha256 ?? entry.sha256, size: entry.bytes_size ?? entry.size } };
}
// La décision et ses octets : le blob d'ici gardé, ou un blob neuf des octets de l'archive (typé par bytes_mime : F-9 sert le blob).
export function octetsRestaures(entry, ligne) {
  const d = decisionRestauration(entry, ligne);
  return { ...d, blob: d.garder ? ligne.blob : new Blob([entry.bytes], { type: entry.bytes_mime ?? entry.mime }) };
}
// D-G7 (ronde 1, #4, #5, #8 — ruling à ratifier) : une page de missing_files est restaurée SANS octets ; un blob d'ici est gardé, en fusion COMME
// en remplacement (I-G3 : l'archive nomme la page sans ses octets, elle n'en dit rien — l'original d'ici ne s'efface pas), et avec lui sa taille
// et son type (la règle de fusionnerFichier : « avec un blob local, la taille et le type locaux restent »).
export function decisionManquante(entry, ligne) {
  if (ligne?.blob instanceof Blob) return { garder: true, size: ligne.size ?? entry.size, mime: ligne.mime ?? entry.mime };
  return { garder: false, size: entry.size, mime: entry.mime };
}

// La ligne restaurée, une règle pour files et missing_files (#18) : en fusion, la ligne d'ici sous l'entrée (...existing), son remote quand
// l'entrée n'en porte pas, son created_at ; en remplacement, la ligne d'ici ne sert QU'À la décision — ni ...existing, ni son remote, ni son
// created_at (§ 3.4). `syncable` suit le type quand il ne vient pas de la ligne d'ici (#24, la règle de fusionnerOctetsRecus).
function ligneRestauree(entree, existing, d, blob, { fusion, maintenant }) {
  const ici = fusion && record(existing) ? existing : {};
  return { ...ici, sha256: entree.sha256, mime: d.mime, size: d.size, remote: entree.remote ?? ici.remote ?? null, created_at: ici.created_at || maintenant,
    syncable: ici.syncable ?? isAllowed(d.mime), ...(blob instanceof Blob ? { blob } : {}) };
}

// Tout ce qui s'attend se fait AVANT la transaction : chaque octet de l'archive est revérifié (« modifié depuis la validation »), gardé ou non.
// La décision R-G-6 se prend DANS la transaction, sur la ligne RELUE (ronde 1, #9 : la condition `fusion` de db.mutate, comme putFile et la
// réception — un original importé depuis n'est jamais remplacé ; ecrireConditionne lit avant de vider, donc le remplacement aussi) ; le blob
// d'une entrée qui n'est pas gardée y est construit (synchrone). Effacement et écritures sont validés ou annulés ensemble.
export class ErreurCycleArchive extends Error {
  constructor(recettes) { super('La sauvegarde et cet appareil ont des cycles de recette différents.'); this.name = 'ErreurCycleArchive'; this.code = 'cycles_divergents'; this.recettes = recettes; }
}
export class ErreurSourcesArchive extends Error {
  constructor(store,id) { super('La sauvegarde et cet appareil ne portent pas la même image ou provenance pour cette source.'); this.name='ErreurSourcesArchive'; this.code='sources_divergentes'; this.store=store; this.id=id; }
}
function verifierIdentitesSources(stores,locales) {
  for(const [store,projection] of [['source_pages',projectionIdentitePage],['source_documents',projectionIdentiteDocument]]) {
    const entrantes=new Map((stores[store]||[]).map(row=>[row.id,row]));
    for(const actuelle of locales[store]||[]) {
      const entree=entrantes.get(actuelle.id);
      if(entree&&canoniqueSources(projection(entree))!==canoniqueSources(projection(actuelle)))throw new ErreurSourcesArchive(store,actuelle.id);
    }
  }
}
// Une collision de clé ne peut détacher une copie d'un parent protégé, y compris dans un historique ou un repas.
const MAGASINS_GRAPHE_ARCHIVE = DATA_STORES.filter(store => store !== 'settings');
function deplacementsGraphes(stores, locales, mode) {
  const avant = capturerContextesInitiaux(locales), apres = capturerContextesInitiaux(mode==='merge'?combinerArchives(locales,stores):stores);
  const cles = new Set(Object.entries(stores).flatMap(([store, rows]) => (rows || []).map(row => JSON.stringify([store, row[STORES[store].keyPath]]))));
  const parentsSources = { source_documents:['edition_id','scan_session_id'],source_pages:['edition_id','document_id'],scan_sessions:['edition_id'] };
  const collisionsSources = new Set();
  for(const [store,champs] of Object.entries(parentsSources)) {
    const entrantes=new Map((stores[store]||[]).map(row=>[row.id,row]));
    for(const row of locales[store]||[]) {
      const entree=entrantes.get(row.id);
      if(entree&&champs.some(champ=>(entree[champ]??null)!==(row[champ]??null)))collisionsSources.add(JSON.stringify([store,row.id]));
    }
  }
  const deplaces = (nom, champ) => {
    const appartenances = new Map();
    for (const contexte of apres[nom]) for (const r of contexte.records) {
      const cle = JSON.stringify([r.store, r.id]);
      if (!appartenances.has(cle)) appartenances.set(cle, new Set());
      appartenances.get(cle).add(contexte[champ]);
    }
    return new Set(avant[nom].filter(c => c.records.some(r => {
      const cle = JSON.stringify([r.store, r.id]);
      return collisionsSources.has(cle) || (cles.has(cle) && !appartenances.get(cle)?.has(c[champ]));
    })).map(c => c[champ]));
  };
  return { recettes: deplaces('recettes', 'recipe_id'), editions: deplaces('editions', 'edition_id') };
}
function conflitsEditions(courantes, entrantes, mode, deplacees = new Set()) {
  const parId = new Map(entrantes.map(e => [e.id, e]));
  return courantes.filter(e => {
    const entree = parId.get(e.id), cycle = lireCycleEdition(e), protege = cycle.id !== null || cycle.etat !== 'active';
    return (protege && deplacees.has(e.id)) || (entree ? !memeCycleEdition(e, entree) || e.book_id !== entree.book_id : mode === 'replace' && protege);
  }).map(e => ({ id: e.id, titre: e.title || e.id, entite: 'edition', cycle: lireCycleEdition(e) }));
}
function conflitsCycles(courantes, entrantes, mode, deplaces = new Set(), editionsProtegees = new Set()) {
  const parId = new Map(entrantes.map(r => [r.id, r]));
  return courantes.filter(r => {
    const entree = parId.get(r.id);
    const protege = lireCycleRecette(r).id !== null || lireCycleRecette(r).etat !== 'active' || editionsProtegees.has(r.edition_id);
    return (protege && deplaces.has(r.id)) || (entree ? !memeCycleRecette(r, entree) || !memeExceptionEdition(r, entree) || (r.edition_id ?? null) !== (entree.edition_id ?? null) : mode === 'replace' && protege);
  }).map(r => ({ id: r.id, titre: typeof r.original_title === 'string' ? r.original_title : r.id, cycle: lireCycleRecette(r) }));
}
const editionsAvecCycle = locales => new Set((locales.book_editions || []).filter(e => lireCycleEdition(e).id !== null || lireCycleEdition(e).etat !== 'active').map(e => e.id));
function conflitsDansSnapshot(locales, stores, mode) {
  const deplaces = deplacementsGraphes(stores, locales, mode);
  return [...conflitsCycles(locales.recipes || [], stores.recipes || [], mode, deplaces.recettes, editionsAvecCycle(locales)),
    ...conflitsEditions(locales.book_editions || [], stores.book_editions || [], mode, deplaces.editions)];
}
const erreurExclusion = code => { throw Object.assign(new Error(code), {code}); };
const cleFiche = (store, row) => JSON.stringify([store, row[STORES[store].keyPath]]);
function combinerArchives(locales, entrantes) {
  return Object.fromEntries(DATA_STORES.map(store => [store, [...new Map([...(locales[store] || []), ...(entrantes[store] || [])]
    .map(row => [row[STORES[store].keyPath], row])).values()]]));
}
// Les sources et repas partagés ne sont jamais réécrits pour enlever une référence : leurs
// copies locales restent utilisables. Une dépendance absente de la base écarte la fiche entière.
function selectionFusion(stores, locales, recettes) {
  const ids = new Set(recettes), interdites = new Set(), ecartees = new Map();
  for (const graphe of [stores, locales]) for (const contexte of capturerContextesInitiaux(graphe).recettes) {
    if (ids.has(contexte.recipe_id)) for (const r of contexte.records) if (r.store !== 'files') interdites.add(JSON.stringify([r.store,r.id]));
  }
  const ajouter=(store,id)=>{if(validKey(id))interdites.add(JSON.stringify([store,id]));};
  const sources=new Set(['source_pages','source_documents','scan_sessions','imports']);
  // Les anciennes captures n'avaient pas toujours recipe_ids sur leur séance. Partir aussi
  // des pointeurs de la recette/version et préserver toute la chaîne source, sans en réécrire les liens.
  for(const graphe of [stores,locales]){
    for(const row of graphe.recipes||[])if(ids.has(row.id)){
      for(const id of row.source_page_ids||[])ajouter('source_pages',id);
      ajouter('source_pages',row.index_page_id);ajouter('imports',row.index_import_id);
    }
    for(const row of graphe.recipe_versions||[])if(ids.has(row.recipe_id)){
      for(const id of row.provenance?.source_page_ids||[])ajouter('source_pages',id);
      ajouter('source_documents',row.provenance?.source_document_id);
    }
  }
  let taille=-1;
  while(taille!==interdites.size){
    taille=interdites.size;
    for(const graphe of [stores,locales])for(const store of sources)for(const row of graphe[store]||[]){
      const liens=RELATIONS.filter(([enfant,,parent])=>enfant===store&&sources.has(parent))
        .flatMap(([,champ,parent])=>relationValues(row,champ.split('.')).filter(validKey).map(id=>[parent,id]));
      if(store==='imports')for(const id of row.page_ids||[])if(validKey(id))liens.push(['source_pages',id]);
      const cle=cleFiche(store,row);
      if(liens.some(([parent,id])=>interdites.has(JSON.stringify([parent,id]))))interdites.add(cle);
      if(interdites.has(cle))for(const [parent,id]of liens)ajouter(parent,id);
    }
  }
  let selection = Object.fromEntries(DATA_STORES.map(store => [store, (stores[store] || []).filter(row => {
    const key = cleFiche(store,row);
    if (!interdites.has(key)) return true;
    ecartees.set(key,{store,id:row[STORES[store].keyPath],motif:'recette_exclue'});return false;
  })]));
  let change = true;
  while (change) {
    change = false;
    const effectif = combinerArchives(locales, selection), presents = new Map(DATA_STORES.map(store => [store,new Set(effectif[store].map(r=>r[STORES[store].keyPath]))]));
    for (const store of DATA_STORES) selection[store] = selection[store].filter(row => {
      const manque = RELATIONS.some(([enfant,champ,parent]) => enfant === store && parent !== 'files' &&
        relationValues(row,champ.split('.')).some(id => id != null && id !== '' && !presents.get(parent)?.has(id)));
      if (!manque) return true;
      ecartees.set(cleFiche(store,row),{store,id:row[STORES[store].keyPath],motif:'dependance_exclue'});change=true;return false;
    });
  }
  return {stores:selection,ecartees:[...ecartees.values()]};
}
export async function conflitsCyclesArchive(db, inspection, { mode = 'merge' } = {}) {
  requireInspection(inspection, mode);
  return conflitsDansSnapshot(await db.getSnapshot(MAGASINS_GRAPHE_ARCHIVE),inspection.payload.stores,mode);
}

export async function applyArchive(db, inspection, { mode = 'merge', horodater = null, exclure = [], estCourante = () => true } = {}) {
  requireInspection(inspection, mode);
  if (!Array.isArray(exclure) || exclure.some(id => !validKey(id)) || new Set(exclure).size !== exclure.length) erreurExclusion('exclusion_invalide');
  if (exclure.length && mode !== 'merge') erreurExclusion('exclusion_fusion_seulement');
  const observation = observationsArchives.get(inspection);
  if(!estCourante()||observation&&observation.db!==db)erreurExclusion('contexte_archive_change');
  const connexion = await db.open();
  const verifierPortee = () => {if (!estCourante() || db.idb !== connexion || observation && observation.db !== db) erreurExclusion('contexte_archive_change');};
  verifierPortee();
  await verifierPreuvesSources(inspection.payload.stores);
  const snapshotAvant=await db.getSnapshot([...MAGASINS_GRAPHE_ARCHIVE,'sync_state']);
  verifierPortee();
  const owner = snapshotAvant.sync_state.find(r=>r.key==='user_id')?.value ?? null;
  const epoqueAvant=snapshotAvant.sync_state.find(r=>r.key===CLE_EPOQUE_EDITEUR);
  if (observation && (canonical(observation.snapshot.sync_state.find(r=>r.key==='user_id')??null)!==canonical(snapshotAvant.sync_state.find(r=>r.key==='user_id')??null)
    || canonical(observation.snapshot.sync_state.find(r=>r.key===CLE_EPOQUE_EDITEUR)??null)!==canonical(epoqueAvant??null))) erreurExclusion('contexte_archive_change');
  const divergentes = new Set(conflitsDansSnapshot(snapshotAvant,inspection.payload.stores,mode).filter(r=>r.entite!=='edition').map(r=>r.id));
  if (exclure.some(id=>!divergentes.has(id))) erreurExclusion('exclusion_invalide');
  if (observation && exclure.some(id=>!memeCycleRecette(observation.snapshot.recipes.find(r=>r.id===id),snapshotAvant.recipes.find(r=>r.id===id)))) erreurExclusion('contexte_archive_change');
  const selection = exclure.length ? selectionFusion(restoredStores(inspection),snapshotAvant,exclure) : {stores:restoredStores(inspection),ecartees:[]};
  const divergences = conflitsDansSnapshot(snapshotAvant,selection.stores,mode);
  if (divergences.length) throw new ErreurCycleArchive(divergences);
  const sourcesAvant=Object.fromEntries(MAGASINS_CAPTURE_SOURCES.map(store=>[store,snapshotAvant[store]]));
  verifierIdentitesSources(selection.stores,sourcesAvant);
  verifierIdentitesTraductionsArchive(selection.stores,sourcesAvant);
  verifierIdentitesCuisineArchive(selection.stores,sourcesAvant);
  await verifierIdentitesInventaireArchive({batch:selection.stores,snapshot:sourcesAvant});
  let batch = structuredClone(selection.stores);
  normaliserFiches(batch, { horodater, sourcesExactes:contientSourcesExactes(batch), traductionsExactes:contientTraductionsExactes(batch), cuisineExacte:contientCuisineExacte(batch), historiquesInventaire:historiquesInventaireExacts({inventory:[...(sourcesAvant.inventory||[]),...(batch.inventory||[])]}) });
  const transfert=await preparerSourcesArchive({batch,snapshot:sourcesAvant,owner_id:owner});
  const traductions=await preparerTraductionsArchive({batch:transfert.batch,snapshot:sourcesAvant,owner_id:owner});
  const cuisine=await preparerCuisineArchive({batch:traductions.batch,snapshot:sourcesAvant,owner_id:owner});
  const inventaire=await preparerInventaireArchive({batch:cuisine.batch,snapshot:sourcesAvant,owner_id:owner,purpose:'archive'});
  batch=inventaire.batch;
  const fusion = mode === 'merge';
  const maintenant = new Date().toISOString();
  for (const file of inspection.payload.files) {
    if (await sha256Hex(file.bytes) !== (file.bytes_sha256 ?? file.sha256)) throw new Error('Fichier modifié depuis la validation : ' + file.sha256);
  }
  let originauxConserves = 0;
  const ecrire = (entree, courant, d, blob) => normaliserFiche('files', ligneRestauree(entree, courant, d, blob, { fusion, maintenant }), { horodater });
  const conditions = [
    ...inspection.payload.files.map((entree) => ({ key: entree.sha256, fusion: (courant) => {
      const o = octetsRestaures(entree, courant);
      if (o.garder) originauxConserves += 1;
      return ecrire(entree, courant, o, o.blob);
    } })),
    ...(inspection.payload.missing ?? []).map((entree) => ({ key: entree.sha256, fusion: (courant) => {
      const d = decisionManquante(entree, courant);
      return ecrire(entree, courant, d, d.garder ? courant.blob : null);
    } })),
  ];
  // K-7 (spec assistant-par-le-compte) : la configuration de l'assistant n'est pas de la bibliothèque — une
  // restauration en remplacement ne la vide pas (elle n'est dans aucune archive : il n'y aurait rien pour la réécrire).
  const locales = {};
  const liensGardes = Object.fromEntries(MAGASINS_GRAPHE_ARCHIVE.filter(store => store !== 'recipes').map(store => [store, [{ toutes: true, verifier: rows => { locales[store] = rows; } }]]));
  const cycleGarde = { toutes: true, verifier: courantes => {
    verifierPortee();
    locales.recipes = courantes;
    verifierIdentitesSources(batch,locales);
    for(const store of exclure.length?MAGASINS_GRAPHE_ARCHIVE:MAGASINS_CAPTURE_SOURCES) {
      if(canonical(locales[store])!==canonical(snapshotAvant[store]))throw new ErreurSourcesArchive(store,null);
    }
    const deplaces = deplacementsGraphes(batch, locales, mode);
    const ecarts = [...conflitsCycles(courantes, batch.recipes || [], mode, deplaces.recettes, editionsAvecCycle(locales)), ...conflitsEditions(locales.book_editions, batch.book_editions || [], mode, deplaces.editions)];
    if (ecarts.length) throw new ErreurCycleArchive(ecarts);
  } };
  const { recettes: contextes, editions } = capturerContextesInitiaux(batch, { owner_id: owner });
  const epoqueEditeur=mode==='replace'?ligneEpoqueEditeur():null;
  await db.mutate({ puts: {...batch,...(epoqueEditeur?{sync_state:[epoqueEditeur]}:{})}, origin: 'local', archive_import: true, source_commands:[...transfert.source_commands,...traductions.source_commands], translation_commands:traductions.translation_commands, cooking_commands:cuisine.cooking_commands, inventory_commands:inventaire.inventory_commands, recettes: contextes, editions, conditions: { ...(conditions.length ? { files: conditions } : {}), ...liensGardes, recipes: [cycleGarde],
    sync_state: [{ key: 'user_id', fusion: courant => { if ((courant?.value ?? null) !== owner) throw new Error('Le compte a changé pendant la restauration.'); return null; } },{key:CLE_EPOQUE_EDITEUR,fusion:c=>{if(canonical(c??null)!==canonical(epoqueAvant??null))throw new Error('La bibliothèque a changé pendant la restauration.');return null;}}] },
    clearStores: mode === 'replace' ? Object.keys(STORES).filter((s) => !SYNC_INTERNAL_STORES.includes(s) && s !== 'assistant_config') : [] });
  const normalisationsSources=(batch.scan_sessions||[]).filter(s=>s.source_state).map(s=>({id:s.id,source_state:structuredClone(s.source_state),source_receipts:structuredClone(s.source_receipts||[])}));
  const normalisationsTraductions=(batch.recipe_translations||[]).filter(t=>t.alignment_format===2).map(t=>({id:t.id,revision:t.revision,publication_receipts:structuredClone(t.publication_receipts),publication_receipt_floor:t.publication_receipt_floor}));
  // Seuls les jetons et reçus dérivés sont normalisés. Ne pas mémoriser toute la progression :
  // sa comparaison doit encore détecter une étape cochée ou une ancre modifiée après le commit.
  const normalisationsCuisine=['cook_sessions','timer_launches'].flatMap(store=>(batch[store]||[]).filter(row=>estLigneCuisineReservee(store,row)).map(row=>store==='timer_launches'
    ?{store,id:row.id,cooking_incarnation:row.cooking_incarnation,cooking_revision:row.cooking_revision,cooking_receipts:structuredClone(row.cooking_receipts),cooking_receipt_floor:row.cooking_receipt_floor}
    :{store,id:row.id,cooking_state:structuredClone(row.cooking_state),progress_revisions:Object.fromEntries(Object.entries(row.progress.by_version).map(([id,p])=>[id,p.revision]))}));
  const normalisationsInventaire=(batch.inventory||[]).filter(estLotProtege).map(r=>({id:r.id,stock_revision:r.stock_revision,stock_receipts:structuredClone(r.stock_receipts),stock_receipt_floor:r.stock_receipt_floor}));
  restaurationsSources.set(inspection,{db,normalisationsSources,normalisationsTraductions,normalisationsCuisine,normalisationsInventaire,
    selection:structuredClone(selection.stores),archiveSignature:canonical(inspection.payload.stores)});
  return { ...Object.fromEntries(Object.entries(batch).map(([name, rows]) => [name, rows.length])), files: conditions.length, originauxConserves, normalisationsSources, normalisationsTraductions, normalisationsCuisine, normalisationsInventaire,ecartees:selection.ecartees };
}

// Comparaison JSON indépendante de l’ordre des propriétés, sensible à l’ordre des tableaux.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

// Comparaison sans l’heure de modification : une fiche réhorodatée par la restauration elle-même n’est pas une
// fiche différente. Tout le reste du contenu est comparé strictement (quantités, étapes, relations).
function canonicalSansHeure(value) {
  const { updated_at: _heure, ...reste } = value;
  return canonical(reste);
}

// Vérifie un instantané cohérent après écriture : contenu complet, clés, relations et fichiers.
// En fusion, les autres fiches sont conservées ; en remplacement, aucun surplus n’est attendu.
// `horodate` : la restauration a réhorodaté les magasins synchronisés (compte connecté, cf. applyArchive).
// La SEULE différence tolérée est alors l’heure de modification, et seulement sur un magasin synchronisé — sans
// cette tolérance, chaque restauration d’un compte connecté serait annoncée comme une restauration en écart.
export async function verifyRestored(db, inspection, { mode = 'merge', horodate = false, normalisationsSources = null, normalisationsTraductions = null, normalisationsCuisine = null, normalisationsInventaire=null } = {}) {
  requireInspection(inspection, mode);
  const synchronises = new Set(SYNC_STORES);
  const diffs = [];
  const snapshot = await db.getSnapshot(Object.keys(STORES));
  const preuve=restaurationsSources.get(inspection);
  if(preuve?.db===db&&preuve.archiveSignature!==canonical(inspection.payload.stores))throw new Error('Archive modifiée depuis la restauration.');
  const expected = preuve?.db===db ? preuve.selection : restoredStores(inspection);
  const sourcesExactes=contientSourcesExactes(expected);
  const traductionsExactes=contientTraductionsExactes(expected);
  const cuisineExacte=contientCuisineExacte(expected);
  const historiquesInventaire=historiquesInventaireExacts({inventory:[...(snapshot.inventory||[]),...(expected.inventory||[])]});
  const normalisations=normalisationsSources||(preuve?.db===db?preuve.normalisationsSources:[]);
  const traductions=normalisationsTraductions||(preuve?.db===db?preuve.normalisationsTraductions:[])||[];
  const cuisine=normalisationsCuisine||(preuve?.db===db?preuve.normalisationsCuisine:[])||[];
  const inventaire=normalisationsInventaire||(preuve?.db===db?preuve.normalisationsInventaire:[])||[];
  const currentStores = Object.fromEntries(DATA_STORES.map((name) => [name, snapshot[name]]));
  diffs.push(...validateRows(currentStores));
  for (const name of DATA_STORES) {
    const key = STORES[name].keyPath;
    const rows = snapshot[name];
    const byId = new Map(rows.map((row) => [row[key], row]));
    if (mode === 'replace' && rows.length !== expected[name].length) diffs.push(name + ' : décompte différent après restauration');
    for (const brute of expected[name]) {
      // R61 : la fiche attendue est celle que la restauration a PROMIS d'écrire — nettoyée pour un magasin
      // synchronisé. Comparer la fiche brute de l'archive annoncerait un écart pour chaque caractère de contrôle
      // délibérément retiré, et toute restauration d'une vieille archive finirait en rouge.
      const row = ficheRestauree(name, brute, {sourcesExactes,traductionsExactes,cuisineExacte,historiquesInventaire});
      if(name==='inventory'&&estLotProtege(row)){const n=inventaire.find(x=>x.id===row.id);if(n)for(const k of['stock_revision','stock_receipts','stock_receipt_floor'])row[k]=structuredClone(n[k]);}
      if(estLigneCuisineReservee(name,row)){
        const n=cuisine.find(x=>x.store===name&&x.id===row.id);
        if(n&&name==='timer_launches')for(const k of ['cooking_incarnation','cooking_revision','cooking_receipts','cooking_receipt_floor'])row[k]=structuredClone(n[k]);
        if(n&&name==='cook_sessions'){
          row.cooking_state=structuredClone(n.cooking_state);
          for(const [id,revision]of Object.entries(n.progress_revisions))if(row.progress.by_version[id])row.progress.by_version[id].revision=revision;
        }
      }
      if(name==='recipe_translations'&&row.alignment_format===2){const n=traductions.find(t=>t.id===row.id);if(n){row.revision=n.revision;row.publication_receipts=structuredClone(n.publication_receipts);row.publication_receipt_floor=n.publication_receipt_floor;}}
      if(name==='scan_sessions'&&row.source_state) {
        const normalisation=normalisations.find(s=>s.id===row.id);
        if(normalisation){row.source_state=structuredClone(normalisation.source_state);row.source_receipts=structuredClone(normalisation.source_receipts);}
      }
      const current = byId.get(row[key]);
      if (!current) { diffs.push(name + ' : ' + row[key] + ' absent après restauration'); continue; }
      if (canonical(current) === canonical(row)) continue;
      // Une heure posée par la restauration (renvoi voulu, ou complétude d’une fiche d’avant le lot) est la seule
      // différence admise, et seulement là où elle a pu être posée : un magasin synchronisé, une heure présente.
      const heurePosee = synchronises.has(name) && (horodate || !row.updated_at) && !!current.updated_at;
      if (heurePosee && canonicalSansHeure(current) === canonicalSansHeure(row)) continue;
      diffs.push(name + ' : contenu différent pour ' + row[key]);
    }
  }
  const filesBySha = new Map(snapshot.files.map((row) => [row.sha256, row]));
  const manquantes = inspection.payload.missing ?? [];
  const shaManquantes = new Set(manquantes.map((mf) => mf.sha256));
  // Une ligne sans octets (missing_files, ou reçue sans être téléchargée) n'entre pas dans le décompte (spec § 3.4), ni le blob d'ici gardé pour
  // une page de missing_files (ronde 1, #4, #8 : decisionManquante).
  const comparableFiles = snapshot.files.filter((row) => row.blob instanceof Blob && !shaManquantes.has(row.sha256));
  if (mode === 'replace' && comparableFiles.length !== inspection.payload.files.length) diffs.push('files : décompte différent après restauration');
  // N-1 : un remote n'est comparé que si l'entrée en porte un (en fusion, une entrée sans remote laisse celui de la ligne locale).
  const memeRemote = (row, entree) => !own(entree, 'remote') || canonical(row.remote ?? null) === canonical(entree.remote);
  for (const file of inspection.payload.files) {
    const row = filesBySha.get(file.sha256);
    if (!row) { diffs.push('Fichier absent : ' + file.sha256); continue; }
    if (!(row.blob instanceof Blob)) { diffs.push('Fichier illisible : ' + file.sha256); continue; }
    const d = decisionRestauration(file, row); // R-G-6 : la même décision qu'à l'application, jamais bytes_sha256 ?? sha256 en brut
    if (row.size !== d.size || row.mime !== d.mime || row.blob.size !== d.attendu.size) diffs.push('Métadonnées de fichier différentes : ' + file.sha256);
    if (await sha256Hex(row.blob) !== d.attendu.sha256) diffs.push('Empreinte différente : ' + file.sha256);
    if (!memeRemote(row, file)) diffs.push('Copie serveur différente : ' + file.sha256);
  }
  for (const mf of manquantes) {
    const row = filesBySha.get(mf.sha256);
    if (!row) { diffs.push('Fichier absent : ' + mf.sha256); continue; }
    // Sans octets ici, la ligne porte la taille et le type de l'archive ; avec, ceux d'ici (decisionManquante) — rien à comparer.
    if (!(row.blob instanceof Blob) && (row.size !== mf.size || row.mime !== mf.mime)) diffs.push('Métadonnées de fichier différentes : ' + mf.sha256);
    if (!memeRemote(row, mf)) diffs.push('Copie serveur différente : ' + mf.sha256);
  }
  diffs.push(...checkRelations(currentStores, new Set(filesBySha.keys())));
  return { ok: diffs.length === 0, diffs };
}
