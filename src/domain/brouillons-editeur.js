// Brouillons locaux : aucune vue, aucun appel assistant ; publication par la porte atomique du dépôt.
import { newId as idDefaut, nowIso } from '../core/ids.js';
import { CLE_EPOQUE_EDITEUR, PREFIXE_BROUILLON, LIMITES_BROUILLONS, ErreurBrouillon, cleBrouillon, ligneEpoqueEditeur, validerLigneEditeur, canoniqueEditeur, empreinteEditeur, octetsEditeur, valeurChamp, objet, idEditeur } from './brouillons-format.js';
import { creerModeleRecette, validerModeleRecette, construireContenuRecette, CHAMPS_METADATA_RECETTE, CHAMPS_CONTENU_RECETTE } from './editeur-recette.js';
import { lireCycleEdition, lireEtatRecette } from './cycle-edition.js';
import { lireCycleRecette } from './cycle-recette.js';
import { LIMITES as LIMITES_SYNC } from '../sync/lots.js';
import { originePhotoAdmise, assertVocabulaire } from './vocabulaire.js';
import { conditionsSourcesImport } from './sources-import.js';
const copie=x=>structuredClone(x),egal=(a,b)=>canoniqueEditeur(a)===canoniqueEditeur(b);
const METADATA=CHAMPS_METADATA_RECETTE.filter(k=>k!=='original_title');
const cheminsRecette=[...CHAMPS_METADATA_RECETTE.map(k=>'metadata.'+k),...CHAMPS_CONTENU_RECETTE.map(k=>'contenu.'+k),'source_sans_thermomix'];
const cheminsLivre=['book.title','book.author','book.cuisines','book.tags','edition.isbn','edition.publisher','edition.year','edition.language','edition.unit_convention_id'];
const champModele=(payload,path)=>{const [g,k]=path.split('.');return k?valeurChamp(payload[g],k):valeurChamp(payload,g);};
const projection=(row,type)=>{if(!row)return null;const c=copie(row);delete c.updated_at;if(type==='journal-v1')delete c.reponse_brute;if(type==='session-v1')for(const k of ['status','page_ids','recipe_ids','document_ids'])delete c[k];return c;};
const verifierSession=(row,ref)=>{if(!row||!['open','done'].includes(row.status)||!['page_ids','recipe_ids','document_ids'].every(k=>Array.isArray(row[k]||[])&&(row[k]||[]).every(idEditeur)&&(ref[k]||[]).every(id=>(row[k]||[]).includes(id))))throw new ErreurBrouillon('source_changee');};
const cibleChamp=(d,path)=>{const[g,k]=path.split('.');return {store:g==='book'?'books':g==='edition'?'book_editions':g==='metadata'?'recipes':'recipe_versions',id:g==='book'?d.book_id:g==='edition'?d.edition_id:g==='metadata'?d.entity_id:d.base_version_id,key:k||path};};
const issueErreur=e=>{const code=typeof e?.code==='string'?e.code:null;if(code)return{issue:'refuse',raison:code,...(e.details?{conflits:e.details}:{})};return{issue:'echec',raison:e?.name==='QuotaExceededError'?'quota_stockage':'stockage_indisponible',reessayable:true};};
export function creerServiceBrouillons({repo,getGeneration,maintenant=nowIso,newId=idDefaut}={}){
 if(!repo||typeof getGeneration!=='function')throw new TypeError('Dépôt et génération requis');
 const sessions=new WeakMap(),comparaisons=new WeakMap(),plans=new WeakMap(),portees=new WeakMap(),recuperations=new WeakMap();
 const encadrer=fn=>async(...args)=>{try{return await fn(...args);}catch(e){return issueErreur(e);}};
 const garde=portee=>{const base=repo.db,generation=getGeneration(),extra=portees.get(portee);const valide=()=>repo.db===base&&getGeneration()===generation&&(!extra||extra());return{base,valide,verifier(){if(!valide())throw new ErreurBrouillon('contexte_change');}};};
 async function scope(portee,{detache=false}={}){
  if(!objet(portee)||!idEditeur(portee.database_name)||!idEditeur(portee.library_epoch)||!(portee.owner_id===null||idEditeur(portee.owner_id)))throw new ErreurBrouillon('contexte_change');
  const g=garde(portee),[owner,epoque]=await Promise.all([g.base.get('sync_state','user_id'),g.base.get('sync_state',CLE_EPOQUE_EDITEUR)]);g.verifier();
  if(g.base.name!==portee.database_name)throw new ErreurBrouillon('contexte_change');
  if((owner?.value??null)!==portee.owner_id)throw new ErreurBrouillon('compte_change');
  if(!detache&&epoque?.value!==portee.library_epoch)throw new ErreurBrouillon('bibliotheque_remplacee');
  return g;
 }
 const conditionsPortee=(p,g,{detache=false}={})=>[
  {key:'user_id',fusion:r=>{g.verifier();if((r?.value??null)!==p.owner_id)throw new ErreurBrouillon('compte_change');return null;}},
  {key:CLE_EPOQUE_EDITEUR,fusion:r=>{g.verifier();if(!detache&&r?.value!==p.library_epoch)throw new ErreurBrouillon('bibliotheque_remplacee');return null;}}
 ];
 async function model(kind,affiche,intention){return kind==='book_metadata'?(await import('./edition-livre.js')).creerModeleLivre(affiche):creerModeleRecette(affiche,{intention});}
 async function valider(d,payload,publication=false){
  const v=d.kind==='book_metadata'?(await import('./edition-livre.js')).validerModeleLivre(payload,{publication,maintenant:maintenant()}):validerModeleRecette(payload,{publication});
  if(!v.ok||d.kind!=='recipe_new'&&d.kind!=='book_metadata'&&Object.hasOwn(payload.metadata||{},'original_title'))throw new ErreurBrouillon('contenu_invalide',v.erreurs);
  canoniqueEditeur(v.modele);return v.modele;
 }
 const anonymeAdmissible=(d,p)=>d?.owner_id===null&&p.owner_id!==null&&d.database_name===p.database_name&&d.library_epoch===p.library_epoch;
 const sessionDe=(d,p)=>{const s={};sessions.set(s,{draft:copie(d),portee:p});return s;};
 const donneesSession=s=>{const x=sessions.get(s);if(!x)throw new ErreurBrouillon('contexte_change');return x;};
 async function lire(id,p,{detache=false,anonyme=false}={}){
  const g=await scope(p,{detache}),row=await g.base.get('sync_state',cleBrouillon(id));g.verifier();
  if(!row||(row.value?.owner_id!==p.owner_id&&!(anonyme&&anonymeAdmissible(row.value,p)))||row.value?.database_name!==p.database_name)throw new ErreurBrouillon('absent');
  validerLigneEditeur(row);if(!detache&&row.value.library_epoch!==p.library_epoch)throw new ErreurBrouillon('bibliotheque_remplacee');
  if(row.value.state!=='committed')await valider(row.value,row.value.payload);g.verifier();return{g,row,d:row.value};
 }
 async function ligneRecuperable(id,p){const g=await scope(p),row=await g.base.get('sync_state',cleBrouillon(id));g.verifier();if(!row||(row.value?.owner_id!==p.owner_id&&!anonymeAdmissible(row.value,p))||row.value?.database_name!==p.database_name)throw new ErreurBrouillon('absent');return{g,row};}
 function attenteRecuperation(row){const attendu={};recuperations.set(attendu,copie(row));return attendu;}
 function resumeInvalide(row,raison){return{id:row.key.slice(PREFIXE_BROUILLON.length),kind:null,titre:'',saved_at:typeof row.value?.saved_at==='string'&&Number.isFinite(Date.parse(row.value.saved_at))?row.value.saved_at:'',revision:Number.isSafeInteger(row.value?.revision)?row.value.revision:null,etat:'invalide',entity_id:null,edition_id:null,book_id:null,raisons:[raison],attendu:attenteRecuperation(row)};}
 async function changements(d,payload){const result=[];for(const path of d.kind==='book_metadata'?cheminsLivre:cheminsRecette){const f=d.base_fields[path];if(!f||await empreinteEditeur(champModele(payload,path))!==f.modele_sha256)result.push(path);}return result;}
 async function capturerPortee({owner_id,estCourante=()=>true}={}){
  const base=repo.db,generation=getGeneration(),verifier=()=>{if(repo.db!==base||getGeneration()!==generation||!estCourante())throw new ErreurBrouillon('contexte_change');};
  const owner=(await base.get('sync_state','user_id'))?.value??null;verifier();if(owner!==owner_id)throw new ErreurBrouillon('compte_change');
  let e=await base.get('sync_state',CLE_EPOQUE_EDITEUR);verifier();
  if(!e){const ligne=ligneEpoqueEditeur(newId('epoque'));await repo.muterEditeur({internes:{conditions:[{key:'user_id',fusion:r=>{verifier();if((r?.value??null)!==owner)throw new ErreurBrouillon('compte_change');return null;}},{key:ligne.key,fusion:r=>r?null:ligne}]}},{origin:'device',baseAttendue:base,contexteValide:()=>{verifier();return true;}});e=await base.get('sync_state',CLE_EPOQUE_EDITEUR);}
  verifier();validerLigneEditeur(e);const p={owner_id:owner,database_name:base.name,library_epoch:e.value};portees.set(p,estCourante);return{issue:'ok',portee:p};
 }
 async function ouvrirBrouillon({kind,intention,portee,affiche={}}){
  const a=copie(affiche),g=await scope(portee);if(!['recipe_metadata','recipe_version','recipe_new','book_metadata'].includes(kind)||!['metadata','correction','adaptation','extraction'].includes(intention))throw new ErreurBrouillon('contenu_invalide');
  if(kind==='book_metadata'&&(!a.book||!a.edition||a.edition.book_id!==a.book.id||lireCycleEdition(a.edition).etat!=='active'))throw new ErreurBrouillon('source_changee');
  if(kind!=='book_metadata'&&kind!=='recipe_new'&&(!a.recipe||lireEtatRecette(a.recipe,a.edition).etat!=='active'))throw new ErreurBrouillon('cycle_change');
  if(kind==='recipe_new'&&(a.recipe||a.version)||a.version&&a.version.recipe_id!==a.recipe?.id)throw new ErreurBrouillon('association_changee');
  if(kind==='recipe_new'&&a.edition&&lireCycleEdition(a.edition).etat!=='active')throw new ErreurBrouillon('cycle_change');
  if(a.journal){
   if(!['recipe_new','recipe_version'].includes(kind)||a.journal.kind!=='recette'||a.journal.status!=='a_verifier'||!a.journal.resultat||(a.journal.recipe_id??null)!==(kind==='recipe_new'?null:a.recipe?.id))throw new ErreurBrouillon('journal_change');
   if((a.journal.owner_id??null)!==portee.owner_id)throw new ErreurBrouillon('compte_change');
   if((a.journal.expected_cycle_id??null)!==(a.recipe?.lifecycle_id??null)||(a.journal.expected_edition_id??a.journal.edition_id??null)!==(a.recipe?.edition_id??a.edition?.id??null)||(a.journal.expected_edition_cycle_id??null)!==(a.edition?.lifecycle_id??null))throw new ErreurBrouillon('cycle_change');
   const pages=new Map((a.pages||[]).map(p=>[p.id,p]));for(const c of conditionsSourcesImport(a.journal.sources_attendues).source_pages||[])c.fusion(pages.get(c.key)||null);
   if(kind==='recipe_version'&&(a.journal.editor_base_version_id!==a.version?.id||a.journal.editor_source_signature!==await empreinteEditeur(projection(a.version,'version-v1'))))throw new ErreurBrouillon('source_changee');
  }
  const id=newId('ed'),recipeId=kind==='recipe_new'?newId('rec'):a.recipe?.id||null,versionId=kind.startsWith('recipe')?newId('rv'):null;
  const d={id,format:1,kind,intention,owner_id:portee.owner_id,database_name:portee.database_name,library_epoch:portee.library_epoch,revision:0,state:'editing',created_at:maintenant(),saved_at:maintenant(),entity_id:kind==='book_metadata'?a.edition.id:recipeId,base_version_id:a.version?.id||null,edition_id:a.edition?.id||a.recipe?.edition_id||null,book_id:a.book?.id||a.edition?.book_id||null,import_id:a.journal?.id||null,base_recipe_cycle_id:a.recipe?.lifecycle_id??null,base_edition_cycle_id:a.edition?.lifecycle_id??null,
   base_association:{edition_id:a.recipe?.edition_id??a.edition?.id??null,book_id:a.edition?.book_id??null,source_page_ids:copie(a.recipe?.source_page_ids||a.pages?.map(p=>p.id)||[]),lecture_page_ids:copie((a.journal?.page_ids||a.version?.provenance?.source_page_ids||a.pages?.map(p=>p.id)||a.recipe?.source_page_ids||[]).filter(id=>id!==a.recipe?.index_page_id)),source_document_id:a.document?.id||a.version?.provenance?.source_document_id||null,scan_session_id:a.sessionScan?.id||null},base_source_signature:{format:1,records:[]},base_fields:{},changed_fields:[],payload:{},publication:{operation_id:newId('publication'),...(recipeId?{recipe_id:recipeId}:{}),...(versionId?{version_id:versionId}:{})}};
  if(kind==='recipe_version')d.pointer_decision={mode:intention==='adaptation'?'preserve':(a.recipe.current_version_id??null)===(a.version?.id??null)?'replace':'preserve',expected_current_version_id:a.recipe.current_version_id??null,reviewed:false};
  d.payload=await model(kind,a,intention);await valider(d,d.payload);
  for(const path of kind==='book_metadata'?cheminsLivre:cheminsRecette){const c=cibleChamp(d,path),source=c.store==='recipes'?a.recipe:c.store==='recipe_versions'?a.version:c.store==='books'?a.book:a.edition,raw=valeurChamp(source,c.key);d.base_fields[path]={present:raw.present,sha256:await empreinteEditeur(raw),modele_sha256:await empreinteEditeur(champModele(d.payload,path))};}
  const records=[...(a.version?[['recipe_versions',a.version,'version-v1']]:[]),...(a.ancetres||[]).map(v=>['recipe_versions',v,'version-v1']),...(a.pages||[]).map(p=>['source_pages',p,'source-v1']),...(a.document?[['source_documents',a.document,'source-v1']]:[]),...(a.sessionScan?[['scan_sessions',a.sessionScan,'session-v1']]:[]),...(a.journal?[['imports',a.journal,'journal-v1']]:[])];
  const vus=new Set();for(const [store,row,pr]of records){if(!idEditeur(row.id)||vus.has(store+':'+row.id))continue;vus.add(store+':'+row.id);if(store==='scan_sessions')verifierSession(row,{});d.base_source_signature.records.push({store,id:row.id,projection:pr,sha256:await empreinteEditeur(projection(row,pr)),...(store==='scan_sessions'?Object.fromEntries(['page_ids','recipe_ids','document_ids'].map(k=>[k,copie(row[k]||[])])):{})});}
  g.verifier();return{issue:'ok',session:sessionDe(d,portee),modele:copie(d.payload),revision:null};
 }
 async function conserverBrouillon({session,expectedRevision,payload}){
  const s=donneesSession(session),d=copie(s.draft),g=await scope(s.portee),p=await valider(d,payload);g.verifier();
  d.payload=p;d.changed_fields=await changements(d,p);d.revision=expectedRevision===null?1:expectedRevision+1;d.saved_at=maintenant();g.verifier();
  const row={key:cleBrouillon(d.id),value:d};validerLigneEditeur(row);
  const condition={key:row.key,fusion:r=>{if(expectedRevision===null?r!==null:!r||r.value?.revision!==expectedRevision||r.value?.state==='committed'||r.value?.owner_id!==d.owner_id||r.value?.library_epoch!==d.library_epoch)throw new ErreurBrouillon('revision_changee');if(r&&!egal(r.value,s.draft))throw new ErreurBrouillon('revision_changee');return row;}};
  await repo.muterEditeur({internes:{conditions:[...conditionsPortee(s.portee,g),condition]}},{origin:'device',baseAttendue:g.base,contexteValide:g.valide});s.draft=copie(d);
  return{issue:'ok',id:d.id,revision:d.revision,saved_at:d.saved_at,state:d.state,octets:octetsEditeur(row)};
 }
 async function compatibilite(d,g){
  const raisons=[],r=d.kind==='book_metadata'?null:await g.base.get('recipes',d.entity_id),e=d.edition_id?await g.base.get('book_editions',d.edition_id):null;
  if(d.kind==='recipe_new'){if(r)raisons.push('source_changee');}else if(d.kind!=='book_metadata'&&!r)raisons.push('absent');
  if(d.kind==='book_metadata'&&(!e||e.book_id!==d.book_id))raisons.push('association_changee');
  if(r&&((r.edition_id??null)!==d.edition_id||!egal(r.source_page_ids||[],d.base_association.source_page_ids)))raisons.push('association_changee');
  if(r&&(lireEtatRecette(r,e).etat!=='active'||lireCycleRecette(r).id!==d.base_recipe_cycle_id)||d.edition_id&&(!e||lireCycleEdition(e).id!==d.base_edition_cycle_id||d.kind==='book_metadata'&&lireCycleEdition(e).etat!=='active'))raisons.push('cycle_change');
  const contenu=d.kind==='recipe_new'||!!d.import_id||d.changed_fields.some(p=>p.startsWith('contenu.')||p==='source_sans_thermomix');
  if(contenu)for(const ref of d.base_source_signature.records){const source=await g.base.get(ref.store,ref.id);if(ref.store==='scan_sessions'){try{verifierSession(source,ref);}catch{raisons.push('source_changee');}}if(ref.store==='imports'&&source?.status!=='a_verifier')raisons.push('journal_terminal');else if(!source||await empreinteEditeur(projection(source,ref.projection))!==ref.sha256)raisons.push(ref.store==='imports'?'journal_change':'source_changee');}
  if(contenu&&d.pointer_decision&&d.intention!=='adaptation'&&r&&(r.current_version_id??null)!==d.pointer_decision.expected_current_version_id){const base=d.base_version_id?await g.base.get('recipe_versions',d.base_version_id):null;if(!base?.provenance?.thermomix&&base?.provenance?.thermomix_invalide!==true)raisons.push('pointeur_change');}
  for(const path of d.changed_fields){if(path.startsWith('contenu.')||path==='source_sans_thermomix'||d.kind==='recipe_new')continue;const c=cibleChamp(d,path),row=await g.base.get(c.store,c.id);if(!row||await empreinteEditeur(valeurChamp(row,c.key))!==d.base_fields[path]?.sha256)raisons.push('champ_change');}
  g.verifier();return [...new Set(raisons)];
 }
 async function lireBrouillon({id,portee}){
  let lu;try{lu=await lire(id,portee,{detache:true,anonyme:true});}catch(e){if(!['format_inconnu','contenu_invalide','limite_brouillon'].includes(e.code))throw e;const {row}=await ligneRecuperable(id,portee);return{issue:'ok',...resumeInvalide(row,e.code)};}
  const {g,d}=lu;if(d.state==='committed')return{issue:'ok',etat:'committed',recu:copie(d),raisons:[]};
  const anonyme=anonymeAdmissible(d,portee),detache=d.library_epoch!==portee.library_epoch,raisons=detache?['bibliotheque_remplacee']:await compatibilite(d,g);g.verifier();
  return{issue:'ok',etat:anonyme?'anonyme':detache?'detache':raisons.length?'bloque':'reprenable',brouillon:copie(d),...(!detache&&!anonyme?{session:sessionDe(d,portee)}:{}),raisons};
 }
 const titre=d=>d.kind==='book_metadata'?d.payload.book?.title:d.payload.metadata?.display_title||d.payload.metadata?.original_title||d.entity_id;
 async function listerBrouillons({portee,inclureDetaches=false}){
  const g=await scope(portee),rows=await g.base.getAll('sync_state'),brouillons=[];g.verifier();
  for(const row of rows){if(!row.key?.startsWith(PREFIXE_BROUILLON)||!idEditeur(row.key.slice(PREFIXE_BROUILLON.length))||(row.value?.owner_id!==portee.owner_id&&!anonymeAdmissible(row.value,portee))||row.value?.database_name!==portee.database_name)continue;
   try{validerLigneEditeur(row);if(row.value.state==='committed')continue;await valider(row.value,row.value.payload);}catch(e){brouillons.push(resumeInvalide(row,e.code||'contenu_invalide'));continue;}
   const d=row.value,detache=d.library_epoch!==portee.library_epoch;if(detache&&!inclureDetaches)continue;const raisons=detache?['bibliotheque_remplacee']:await compatibilite(d,g);
   brouillons.push({id:d.id,kind:d.kind,titre:String(titre(d)||''),saved_at:d.saved_at,revision:d.revision,etat:anonymeAdmissible(d,portee)?'anonyme':detache?'detache':raisons.length?'bloque':'reprenable',entity_id:d.entity_id,edition_id:d.edition_id,book_id:d.book_id,raisons});
  }g.verifier();return{issue:'ok',brouillons:brouillons.sort((a,b)=>b.saved_at.localeCompare(a.saved_at))};
 }
 async function ecarterBrouillon({id,portee,expectedRevision,attendu=null}){
  if(attendu){const row=recuperations.get(attendu);if(!row||row.key!==cleBrouillon(id)||(row.value?.owner_id!==portee.owner_id&&!anonymeAdmissible(row.value,portee))||row.value?.database_name!==portee.database_name||(Number.isSafeInteger(row.value?.revision)?row.value.revision:null)!==expectedRevision)throw new ErreurBrouillon('revision_changee');const g=await scope(portee);
   await repo.muterEditeur({internes:{deletes:[row.key],conditions:[...conditionsPortee(portee,g),{key:row.key,fusion:r=>{if(!r||!egal(r,row))throw new ErreurBrouillon('revision_changee');return null;}}]}},{origin:'device',baseAttendue:g.base,contexteValide:g.valide});return{issue:'ok',id};}
  const {g,row,d}=await lire(id,portee,{detache:true,anonyme:true});if(d.revision!==expectedRevision)throw new ErreurBrouillon('revision_changee');
  await repo.muterEditeur({internes:{deletes:[row.key],conditions:[...conditionsPortee(portee,g),{key:row.key,fusion:r=>{if(!egal(r,row))throw new ErreurBrouillon('revision_changee');return null;}}]}},{origin:'device',baseAttendue:g.base,contexteValide:g.valide});return{issue:'ok',id};
 }
 async function exporterTexteBrouillon({id,portee}){
  const nomFichier='brouillon-'+id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.txt';
  try{const {d}=await lire(id,portee,{detache:true,anonyme:true});if(d.state==='committed')throw new ErreurBrouillon('absent');return{issue:'ok',texte:JSON.stringify({titre:String(titre(d)||''),date:d.saved_at,saisie:d.payload},null,2),nomFichier};}
  catch(e){if(!['format_inconnu','contenu_invalide','limite_brouillon'].includes(e.code))throw e;const {row}=await ligneRecuperable(id,portee),p=row.value?.payload,parts=[];let reste=LIMITES_BROUILLONS.ligne,tronque=false;
   const ajouter=v=>{if(typeof v!=='string')return;const net=v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');let sortie='';for(const c of net){const n=new TextEncoder().encode(c).length;if(n+2>reste){tronque=true;break;}sortie+=c;reste-=n;}if(sortie){parts.push(sortie);reste-=2;}};
   for(const v of [p?.metadata?.display_title,p?.metadata?.original_title,p?.book?.title,p?.book?.author,p?.contenu?.notes])ajouter(v);
   for(const l of Array.isArray(p?.contenu?.ingredients)?p.contenu.ingredients:[])ajouter(typeof l?.source_text==='string'?l.source_text:l?.name_text);
   for(const s of Array.isArray(p?.contenu?.steps)?p.contenu.steps:[])ajouter(s?.text);
   return{issue:'ok',texte:parts.join('\n\n'),nomFichier,tronque};}
 }
 const destination=d=>d.kind==='book_metadata'?'/books/'+encodeURIComponent(d.publication.edition_id||d.edition_id):'/recipes/'+encodeURIComponent(d.publication.recipe_id)+(d.publication.version_id?'?v='+encodeURIComponent(d.publication.version_id):'');
 async function preparerPublication({id,portee,expectedRevision}){
  const {g,row,d}=await lire(id,portee);
  if(d.state==='committed'){if(d.publication.published_revision!==expectedRevision)throw new ErreurBrouillon('revision_changee');return{issue:'deja_publie',recu:copie(d),destination:destination(d)};}
  if(d.revision!==expectedRevision)throw new ErreurBrouillon('revision_changee');
  const payload=await valider(d,d.payload,true),changes=[];
  for(const path of await changements(d,d.payload))if(path==='source_sans_thermomix'||await empreinteEditeur(champModele(payload,path))!==d.base_fields[path]?.sha256)changes.push(path);
  if(!changes.length&&d.kind!=='recipe_new'&&!d.import_id)return{issue:'sans_changement'};
  const contenu=d.kind==='recipe_new'||!!d.import_id||changes.some(p=>p.startsWith('contenu.')||p==='source_sans_thermomix');
  if(d.kind==='recipe_metadata'&&contenu)throw new ErreurBrouillon('contenu_invalide');
  const problemes=await compatibilite(d,g);if(problemes.length)throw new ErreurBrouillon(problemes[0]);
  const lect=new Map(),exactes=new Map();
  const prendre=async(store,key)=>{if(key==null)return null;const cle=store+':'+key;if(!lect.has(cle))lect.set(cle,await g.base.get(store,key)||null);return lect.get(cle);};
  const recipe=d.kind==='book_metadata'?null:await prendre('recipes',d.entity_id),edition=await prendre('book_editions',d.edition_id),book=await prendre('books',d.book_id);
  for(const ref of d.base_source_signature.records){if(ref.store==='recipe_versions'&&!contenu)continue;const r=await prendre(ref.store,ref.id);if(ref.store==='scan_sessions')verifierSession(r,ref);if(ref.store==='imports'&&r?.status!=='a_verifier')throw new ErreurBrouillon(r&&['enregistre','ignore'].includes(r.status)?'journal_terminal':'journal_change');if(!r||await empreinteEditeur(projection(r,ref.projection))!==ref.sha256)throw new ErreurBrouillon(ref.store==='imports'?'journal_change':'source_changee');exactes.set(ref.store+':'+ref.id,{...ref,...(ref.store==='scan_sessions'?Object.fromEntries(['page_ids','recipe_ids','document_ids'].map(k=>[k,copie(r[k]||[])])):{}),value:canoniqueEditeur(projection(r,ref.projection))});}
  const champs=[];for(const path of changes){if(path.startsWith('contenu.')||path==='source_sans_thermomix')continue;const c=cibleChamp(d,path);if(d.kind==='recipe_new')continue;const courant=await prendre(c.store,c.id);if(!courant||await empreinteEditeur(valeurChamp(courant,c.key))!==d.base_fields[path]?.sha256)throw new ErreurBrouillon('champ_change',[{champ:path,raison:'champ_change',saisie:champModele(payload,path).value,actuel:courant?.[c.key]}]);champs.push({...c,path,value:canoniqueEditeur(valeurChamp(courant,c.key))});}
  const base=contenu&&d.base_version_id?await prendre('recipe_versions',d.base_version_id):null;
  const tm=!!base?.provenance?.thermomix||base?.provenance?.thermomix_invalide===true;
  const adaptation=d.intention==='adaptation'||tm;
  if(contenu&&d.kind!=='recipe_new'&&!adaptation){if(!d.pointer_decision||(recipe.current_version_id??null)!==d.pointer_decision.expected_current_version_id)throw new ErreurBrouillon('pointeur_change');if(d.pointer_decision.mode==='replace'&&d.base_version_id!==d.pointer_decision.expected_current_version_id&&!d.pointer_decision.reviewed)throw new ErreurBrouillon('pointeur_change');}
  const journal=d.import_id?await prendre('imports',d.import_id):null;
  if(journal&&(journal.kind!=='recette'||(journal.recipe_id??null)!==(d.kind==='recipe_new'?null:d.entity_id)||d.kind!=='recipe_new'&&journal.editor_base_version_id!==d.base_version_id))throw new ErreurBrouillon('journal_change');
  let lecture=null;if(journal){const {validateParsedRecipe}=await import('./llm.js');lecture=validateParsedRecipe(copie(journal.resultat));}
  let sansTM=null;if(contenu&&payload.source_sans_thermomix){const {lireSourceSansThermomix}=await import('./version-personnelle.js');const source=await lireSourceSansThermomix(base,{lire:id=>Promise.resolve(lect.get('recipe_versions:'+id)||null)});if(!source.ok)throw new ErreurBrouillon('source_changee');sansTM=source.source;}
  const contenuVersion=contenu?construireContenuRecette(payload,{base,intention:adaptation?'adaptation':d.intention,sourceSansThermomix:sansTM,journal}):null;
  if(contenu&&!contenuVersion)throw new ErreurBrouillon('contenu_invalide');
  const session=d.base_association.scan_session_id?await prendre('scan_sessions',d.base_association.scan_session_id):null;
  if(session)for(const id of session.page_ids||[]){const page=await prendre('source_pages',id);if(!page)throw new ErreurBrouillon('source_changee');const cle='source_pages:'+id;if(!exactes.has(cle))exactes.set(cle,{store:'source_pages',id,projection:'source-v1',value:canoniqueEditeur(projection(page,'source-v1'))});}
  g.verifier();const payloadHash=await empreinteEditeur(d.payload);g.verifier();
  const plan={};plans.set(plan,{d:copie(d),row:copie(row),g,portee,payload,changes,contenu,adaptation,recipe,edition,book,base,journal,lecture,session,contenuVersion,exactes,champs,lect,payloadHash});
  return{issue:'ok',plan,apercu:{kind:d.kind==='book_metadata'?'book_metadata':contenu?d.kind:'recipe_metadata',cible:d.entity_id,changements:changes,versionCourante:recipe?.current_version_id??null}};
 }
 const contexteMetier=(d,g)=>({recettes:d.kind==='book_metadata'?[]:[{recipe_id:d.entity_id,expected_cycle_id:d.base_recipe_cycle_id,expected_edition_id:d.edition_id,expected_edition_cycle_id:d.base_edition_cycle_id,owner_id:d.owner_id,creation:d.kind==='recipe_new',historique:false,contexteValide:g.valide}],editions:d.edition_id?[{edition_id:d.edition_id,expected_cycle_id:d.base_edition_cycle_id,owner_id:d.owner_id,historique:false,contexteValide:g.valide,...(d.kind==='book_metadata'?{}:{recipe_id:d.entity_id})}]:[]});
 async function publierBrouillon({plan}){
  const p=plans.get(plan);if(!p)throw new ErreurBrouillon('contexte_change');const {d,g,portee,payload,changes}=p;await scope(portee);g.verifier();
  const conditions={},fusions=new Map(),puts={},now=maintenant();
  const ajouter=(store,id,fn)=>{const cle=store+':'+id,ancienne=fusions.get(cle);fusions.set(cle,{store,id,fn:(courant,lecture)=>{const precedent=ancienne?.fn(courant,lecture);return fn(precedent??courant,lecture)??precedent??null;}});};
  for(const ref of p.exactes.values())ajouter(ref.store,ref.id,c=>{if(ref.store==='scan_sessions')verifierSession(c,ref);if(canoniqueEditeur(projection(c,ref.projection))!==ref.value)throw new ErreurBrouillon(ref.store==='imports'?'journal_change':'source_changee');return null;});
  for(const c of p.champs)ajouter(c.store,c.id,r=>{if(!r||canoniqueEditeur(valeurChamp(r,c.key))!==c.value)throw new ErreurBrouillon('champ_change',[{champ:c.path,raison:'champ_change'}]);return null;});
  const prendrePatch=(groupe,keys)=>Object.fromEntries(keys.map(k=>[k,champModele(payload,groupe+'.'+k)]));
  const fusionPatch=(courant,patch,{provenance=false}={})=>{if(!courant)throw new ErreurBrouillon('absent');const r=copie(courant),prov={...r.metadata_provenance};for(const[k,v]of Object.entries(patch)){if(v.present)r[k]=copie(v.value);else delete r[k];if(provenance)prov[k]={origin:'manual',retrieved_at:null,sources:[],uncertain:false,justification:''};}if(provenance)r.metadata_provenance=prov;return r;};
  let version=null;
  if(d.kind==='book_metadata'){
   ajouter('book_editions',d.edition_id,e=>{if(!e||e.book_id!==d.book_id)throw new ErreurBrouillon('association_changee');return null;});
   for(const [groupe,store,id]of [['book','books',d.book_id],['edition','book_editions',d.edition_id]]){const keys=changes.filter(x=>x.startsWith(groupe+'.')).map(x=>x.split('.')[1]);if(keys.length)ajouter(store,id,r=>{const row=fusionPatch(r,prendrePatch(groupe,keys),{provenance:true});if(keys.includes('unit_convention_id'))row.convention_evidence=row.unit_convention_id?'confirmed_by_user':null;return row;});}
  }else{
   if(p.contenu){
    const kind=p.adaptation?'adaptation':p.base?'correction':'extraction';
    const modeleJournal=p.journal?.model||p.journal?.modele,modeleNet=typeof modeleJournal==='string'?modeleJournal.replace(/[\p{Cc}\p{Cf}]/gu,'').trim():'';
    const provenance={...(p.contenuVersion.provenance||{}),generated_by:p.journal?'ai':'manual',...(p.base?{derived_from:p.base.id}:{}),...(d.import_id?{import_id:d.import_id,model:modeleNet&&[...modeleNet].length<=80?modeleNet:null,incomplete:p.lecture.incomplete,missing_page:p.lecture.missing_page,titre_lu:p.lecture.title||null,lu_le:typeof p.journal.started_at==='string'&&Number.isFinite(Date.parse(p.journal.started_at))?p.journal.started_at:null,uncertain_fields:copie(p.lecture.uncertain_fields)}:{}),source_page_ids:copie(d.base_association.lecture_page_ids||d.base_association.source_page_ids),source_document_id:d.base_association.source_document_id,edition_id:d.edition_id};
    version={...p.contenuVersion,id:d.publication.version_id,recipe_id:d.entity_id,parent_version_id:d.base_version_id,kind,provenance};puts.recipe_versions=[version];
    conditions.recipe_versions=[{key:version.id,absente:true}];
   }
   const keys=changes.filter(x=>x.startsWith('metadata.')).map(x=>x.split('.')[1]),patch=prendrePatch('metadata',keys);
   const fusionRecette=c=>{
    const r=d.kind==='recipe_new'?{id:d.entity_id,edition_id:d.edition_id,favorite:false,tags:[],source_page_ids:copie(d.base_association.source_page_ids),ingredient_ids:[]}:c;
    if(!r)throw new ErreurBrouillon('absent');
    if(d.kind!=='recipe_new'&&((r.edition_id??null)!==d.edition_id||!egal(r.source_page_ids||[],d.base_association.source_page_ids)))throw new ErreurBrouillon('association_changee');
    if(p.contenu&&d.kind!=='recipe_new'&&!p.adaptation&&(r.current_version_id??null)!==d.pointer_decision.expected_current_version_id)throw new ErreurBrouillon('pointeur_change');
    const next=fusionPatch(r,d.kind==='recipe_new'?prendrePatch('metadata',Object.keys(payload.metadata)):patch);
    if(Object.hasOwn(next,'photo_origin'))next.photo_origin=originePhotoAdmise(next.photo_origin);
    if(p.journal)next.source_page_ids=[...new Set([...(r.source_page_ids||[]),...(d.base_association.lecture_page_ids||[])])];
    if(version&&(d.kind==='recipe_new'||!p.adaptation&&d.pointer_decision.mode==='replace')){next.current_version_id=version.id;next.availability=version.ingredients.length&&version.steps.length?'available':version.ingredients.length||version.steps.length?'partial':'reference_only';if(next.availability==='available'&&(version.provenance.incomplete||version.provenance.missing_page))next.availability='partial';next.verification_state=version.verification_state;next.ingredient_ids=[...new Set(version.ingredients.map(i=>i.ingredient_id).filter(Boolean))];}
    assertVocabulaire(next,'recipes');return next;
   };
   if(d.kind==='recipe_new'){conditions.recipes=[{key:d.entity_id,absente:true}];puts.recipes=[fusionRecette(null)];}else ajouter('recipes',d.entity_id,c=>keys.length||version?fusionRecette(c):null);
  }
  if(p.journal)ajouter('imports',d.import_id,c=>{if(c?.status!=='a_verifier')throw new ErreurBrouillon('journal_terminal');return{...c,status:'enregistre',reponse_brute:null,finished_at:now};});
  if(d.kind==='recipe_new'||p.journal)for(const [index,id] of (d.base_association.lecture_page_ids||d.base_association.source_page_ids).entries())ajouter('source_pages',id,c=>{if(!c)throw new ErreurBrouillon('source_changee');return{...c,kind:'recipe',role:'recette',printed_page:c.printed_page??(index===0?payload.metadata.printed_page??null:null)};});
  if(p.session){const {statutSeanceApres}=await import('./import-cible.js');ajouter('scan_sessions',p.session.id,c=>{if(!c)throw new ErreurBrouillon('source_changee');return{...c,recipe_ids:[...new Set([...(c.recipe_ids||[]),d.entity_id])],status:statutSeanceApres(c,new Map((c.page_ids||[]).map(id=>[id,p.lect.get('source_pages:'+id)])),new Set(d.kind==='recipe_new'||p.journal?d.base_association.lecture_page_ids:[]))};});}
  for(const {store,id,fn}of fusions.values())(conditions[store]||=[]).push({key:id,fusion:fn});
  const nature=d.kind==='book_metadata'?'book_metadata':p.contenu?d.kind:'recipe_metadata';
  const recu={id:d.id,format:1,kind:nature,owner_id:d.owner_id,database_name:d.database_name,library_epoch:d.library_epoch,revision:d.revision+1,state:'committed',created_at:d.created_at,saved_at:now,publication:{operation_id:d.publication.operation_id,published_revision:d.revision,payload_sha256:p.payloadHash,kind:nature,...(d.kind==='book_metadata'?{book_id:d.book_id,edition_id:d.edition_id}:{recipe_id:d.entity_id,...(version?{version_id:version.id}:{})}),...(d.import_id?{import_id:d.import_id}:{}),committed_at:now}};
  let deja=null;
  const conditionDraft={key:cleBrouillon(d.id),fusion:r=>{
   if(r?.value?.state==='committed'&&r.value.owner_id===d.owner_id&&r.value.library_epoch===d.library_epoch&&r.value.publication?.operation_id===d.publication.operation_id&&r.value.publication.published_revision===d.revision&&r.value.publication.payload_sha256===p.payloadHash){validerLigneEditeur(r);deja=copie(r.value);throw new ErreurBrouillon('publication_deja_effectuee');}
   if(!r||!egal(r,p.row))throw new ErreurBrouillon('revision_changee');return{key:r.key,value:recu};
  }};
  try{await repo.muterEditeur({metier:{puts,conditions,...contexteMetier(d,g)},internes:{conditions:[...conditionsPortee(portee,g),conditionDraft]}},{origin:'local',baseAttendue:g.base,contexteValide:g.valide});}
  catch(e){if(e?.code!=='publication_deja_effectuee'||!deja)throw e;await scope(portee);g.verifier();return{issue:'deja_publie',recu:deja,destination:destination(deja)};}
  return{issue:'publie',recu:copie(recu),destination:destination(recu)};
 }
 async function comparerBrouillon({id,portee,expectedRevision}){
  const {g,row,d}=await lire(id,portee,{detache:true,anonyme:true});if(d.state==='committed'||d.revision!==expectedRevision)throw new ErreurBrouillon('revision_changee');
  const recipe=d.kind==='book_metadata'||d.kind==='recipe_new'?null:await g.base.get('recipes',d.entity_id),edition=d.edition_id?await g.base.get('book_editions',d.edition_id):null,book=d.book_id?await g.base.get('books',d.book_id):null;
  const versionId=d.base_version_id||recipe?.current_version_id,version=versionId?await g.base.get('recipe_versions',versionId):null;
  const affiche={...(recipe?{recipe}:{}),...(edition?{edition}:{}),...(book?{book}:{}),...(version?{version}:{}),pages:[]};
  for(const id of d.base_association.source_page_ids||[]){const p=await g.base.get('source_pages',id);if(p)affiche.pages.push(p);}
  if(d.base_association.source_document_id)affiche.document=await g.base.get('source_documents',d.base_association.source_document_id);
  if(d.base_association.scan_session_id)affiche.sessionScan=await g.base.get('scan_sessions',d.base_association.scan_session_id);
  if(d.import_id){const j=await g.base.get('imports',d.import_id);if(j?.status==='a_verifier')affiche.journal=j;}
  const actuel=await model(d.kind,affiche,d.intention),champs=(d.kind==='book_metadata'?cheminsLivre:cheminsRecette).map(champ=>({champ,saisie:champModele(d.payload,champ).value??null,actuel:champModele(actuel,champ).value??null}));
  const raisons=d.library_epoch!==portee.library_epoch?['bibliotheque_remplacee']:await compatibilite(d,g),conflits=raisons.map(raison=>({champ:'source',raison}));
  for(const c of champs)if(!egal(c.saisie,c.actuel))conflits.push({...c,raison:'champ_change'});
  if(d.pointer_decision&&(recipe?.current_version_id??null)!==d.pointer_decision.expected_current_version_id)conflits.push({champ:'current_version_id',raison:'pointeur_change',saisie:d.base_version_id,actuel:recipe?.current_version_id??null});
  g.verifier();const comparaison={};comparaisons.set(comparaison,{g,d:copie(d),row:copie(row),portee,affiche:copie(affiche),actuel});
  return{issue:'ok',comparaison,conflits,...(anonymeAdmissible(d,portee)?{anonyme:true}:{}),courantAffichable:{champs,versionCourante:recipe?.current_version_id?{id:recipe.current_version_id,titre:recipe.display_title||recipe.original_title}:null}};
 }
 async function choisirVersionCourante({session,expectedRevision,comparaison,choix}){
  const s=donneesSession(session),c=comparaisons.get(comparaison);if(!c||c.d.id!==s.draft.id||c.d.revision!==expectedRevision||!['preserve','replace'].includes(choix)||c.d.kind!=='recipe_version'||c.d.intention==='adaptation')throw new ErreurBrouillon('revision_changee');
  const g=await scope(s.portee),d=copie(c.d);d.pointer_decision={mode:choix,expected_current_version_id:c.affiche.recipe?.current_version_id??null,reviewed:true};d.revision++;d.saved_at=maintenant();
  await repo.muterEditeur({metier:{conditions:{recipes:[{key:d.entity_id,fusion:r=>{if(!r||(r.current_version_id??null)!==d.pointer_decision.expected_current_version_id)throw new ErreurBrouillon('pointeur_change');return null;}}]},...contexteMetier(d,g)},internes:{conditions:[...conditionsPortee(s.portee,g),{key:cleBrouillon(d.id),fusion:r=>{if(!r||!egal(r,c.row))throw new ErreurBrouillon('revision_changee');return{key:r.key,value:d};}}]}},{origin:'local',baseAttendue:g.base,contexteValide:g.valide});s.draft=copie(d);return{issue:'ok',revision:d.revision,pointer_decision:copie(d.pointer_decision)};
 }
 async function reprendreSurBaseCourante({comparaison,choixRepris,portee,reprendreAnonyme=false}){
  const c=comparaisons.get(comparaison);if(!c||!Array.isArray(choixRepris))throw new ErreurBrouillon('contexte_change');
  if(c.d.owner_id!==portee.owner_id&&!(reprendreAnonyme&&c.d.owner_id===null&&portee.owner_id!==null&&c.d.library_epoch===portee.library_epoch))throw new ErreurBrouillon('compte_change');
  const g=await scope(portee),ancienne=await g.base.get('sync_state',cleBrouillon(c.d.id));if(!ancienne||!egal(ancienne,c.row))throw new ErreurBrouillon('revision_changee');
  const verifier=async(store,row)=>{if(row&&!egal(await g.base.get(store,row.id)||null,row))throw new ErreurBrouillon('source_changee');};
  await Promise.all([verifier('recipes',c.affiche.recipe),verifier('recipe_versions',c.affiche.version),verifier('books',c.affiche.book),verifier('book_editions',c.affiche.edition),verifier('imports',c.affiche.journal),verifier('source_documents',c.affiche.document),verifier('scan_sessions',c.affiche.sessionScan),...c.affiche.pages.map(p=>verifier('source_pages',p))]);g.verifier();
  const o=await ouvrirBrouillon({kind:c.d.kind,intention:c.d.intention,portee,affiche:c.affiche}),admis=c.d.kind==='book_metadata'?cheminsLivre:cheminsRecette;
  for(const path of choixRepris){if(!admis.includes(path))throw new ErreurBrouillon('contenu_invalide');const[groupe,key]=path.split('.'),v=champModele(c.d.payload,path),dest=key?o.modele[groupe]:o.modele,k=key||groupe;if(v.present)dest[k]=copie(v.value);else delete dest[k];}
  return o;
 }
 async function copierBrouillon({session,payload}){const s=donneesSession(session),g=await scope(s.portee),d=copie(s.draft);d.payload=await valider(d,payload);g.verifier();d.id=newId('ed');d.revision=0;d.state='editing';d.created_at=maintenant();d.saved_at=d.created_at;d.publication={...d.publication,operation_id:newId('publication')};if(d.publication.version_id)d.publication.version_id=newId('rv');if(d.kind==='recipe_new'){d.entity_id=newId('rec');d.publication.recipe_id=d.entity_id;}return{issue:'ok',session:sessionDe(d,s.portee),modele:copie(d.payload),revision:null};}
 const api={capturerPortee,ouvrirBrouillon,listerBrouillons,lireBrouillon,conserverBrouillon,ecarterBrouillon,comparerBrouillon,choisirVersionCourante,reprendreSurBaseCourante,copierBrouillon,preparerPublication,publierBrouillon,exporterTexteBrouillon};
 return Object.fromEntries(Object.entries(api).map(([nom,fn])=>[nom,encadrer(fn)]));
}
