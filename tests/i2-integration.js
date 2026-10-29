import { withDatabase } from './backup.js';
import { withRepo } from './sync-fixture.js';
import { Database } from '../src/core/db.js';
import { STORES, DB_VERSION } from '../src/model/schema.js';
import { referencesFichiers, candidatsEnvoi, compterFichiers, nomFichier, MAGASINS_FICHIERS, createFichiers } from '../src/sync/fichiers.js';
import { creerStockageFactice } from './stockage-factice.js';
import { formatDate } from '../src/core/dom.js';

export async function runI2IntegrationTests({eq,ok}) {
  const run = async (nom, fn) => { try { await fn(); } catch(e) { ok(false, `I2 ${nom}: ${e.message}`); } };
  await run('journal livre', async () => {
    const {lignesImports,cibleReprise,ligneImportNeuve}=await import('../src/domain/import-cible.js');
    const line={id:'i&2',kind:'livre',status:'a_lancer',phase:'relecture',device_id:'ailleurs',brouillon:{fields:{title:'Trinity'}}};
    eq(cibleReprise(line),'/add/livre?import=i%262','I2 L10: reprise livre vers bonne route et identifiant encodé');
    const lines=lignesImports({imports:[line]},{deviceId:'ici'});
    eq(lines[0]?.gestes,['reprendre','ignorer'],'I2 L10: brouillon livre reprenable sans page et depuis autre appareil');
    eq(lines[0]?.titre,{type:'livre',texte:'Trinity',livre:null},'I2 L10: titre du brouillon au journal');
    eq(ligneImportNeuve({id:'i2',kind:'livre'}).kind,'livre','I2 L10: vocabulaire accepte le nouveau journal sans magasin');
  });
  await run('ISBN concurrent', () => withDatabase(async db => {
    const autre = new Database(db.name, DB_VERSION, STORES);
    try {
      await autre.open();
      const ajouter = (base,id) => base.mutate({puts:{books:[{id:'bk-'+id,title:'Trinity'}],book_editions:[{id,book_id:'bk-'+id,isbn:'9781837836222'}]},conditions:{book_editions:[{index:'isbn',valeur:'9781837836222',absente:true}]}});
      const results = await Promise.allSettled([ajouter(db,'ed-1'),ajouter(autre,'ed-2')]);
      eq(results.map(x=>x.status).sort(), ['fulfilled','rejected'], 'I2 L01: deux connexions, une création ISBN seulement');
      eq(await db.count('books'), 1, 'I2 L01: refus atomique, aucun livre orphelin');
      eq(await db.count('book_editions'), 1, 'I2 L01: édition non dupliquée');
      eq(results.find(x=>x.status==='rejected')?.reason?.name, 'TransitionRefusee', 'I2 L01: refus nommé, pas une erreur générique');
    } finally { autre.idb?.close(); autre.idb=null; }
  }));
  const A='a'.repeat(64), B='b'.repeat(64), C='c'.repeat(64), D='d'.repeat(64);
  const blob=new Blob(['image'],{type:'image/jpeg'});
  const snap={books:[{id:'bk',title:'Trinity'}],book_editions:[{id:'ed',book_id:'bk',source_photo_sha256:B}],recipes:[{id:'r',original_title:'Mon plat'}],cook_history:[{id:'ch',recipe_id:'r',cooked_at:'2026-10-28',photos:[A,A,'invalide',{}]}],imports:[{id:'i',kind:'livre',source_photo_sha256:C}],files:[A,B,C,D].map(sha256=>({sha256,blob,size:blob.size,mime:blob.type,syncable:true}))};
  eq([...referencesFichiers(snap)].sort(),[A,B,C], 'I2 S01: photos personnelles et sources de livre référencées, orphelin exclu');
  eq([...referencesFichiers({cook_history:[{photos:['invalide',null,{},A,A,A,B,C,D]}]})].sort(),[A,B,C,D], 'I2 S01: même règle de photos valides et uniques que leur affichage, avant la borne de six');
  eq(candidatsEnvoi(snap,{uid:'u1'}).map(x=>x.sha256).sort(),[A,B,C], 'I2 S01: nouveaux pointeurs réellement candidats à envoi');
  eq(compterFichiers(snap,{uid:'u1'}).aEnvoyer,3,'I2 S01: compteurs comprennent les photos de cuisson et sources');
  ok(MAGASINS_FICHIERS.includes('cook_history'),'I2 S01: snapshot réel inclut les cuissons');
  ok(nomFichier(A,snap).includes('Mon plat'),'I2 S01: photo personnelle nommée par recette');
  ok(nomFichier(B,snap).includes('Trinity'),'I2 S01: source nommée par livre');
  eq(formatDate('2026-10-28'),formatDate(new Date(2026,9,28,12).toISOString()),'I2 C01: date civile sans décalage UTC');
  eq(formatDate('2026-02-31'),'','I2 C01: date civile inexistante refusée');
  eq(formatDate('2026-10-28',{withTime:true}),formatDate('2026-10-28'),'I2 C01: aucune heure inventée pour une date civile');
  await run('octets entre appareils', () => withRepo(async (repo,db) => {
    const {sha256Hex}=await import('../src/core/hash.js');
    const sha=await sha256Hex(blob);
    await repo.saveBatch({recipes:[{id:'r',original_title:'Mon plat',current_version_id:'v'}],recipe_versions:[{id:'v',recipe_id:'r',kind:'extraction',ingredients:[],steps:[]}]},{conditions:{recipes:[{key:'r',absente:true}]}});
    await repo.putFile(sha,blob,{});
    await repo.save('cook_history',{id:'ch-perso',recipe_id:'r',recipe_version_id:'v',cooked_at:'2026-10-28',photos:[sha]});
    await repo.saveBatch({books:[{id:'bk-i2',title:'Livre consulté'}],book_editions:[{id:'ed-i2',book_id:'bk-i2'}]},{conditions:{book_editions:[{key:'ed-i2',absente:true}]}});
    await repo.save('library_activity',{id:'consultation-locale-i2',edition_id:'ed-i2',viewed_at:'2026-10-28T12:00:00Z'});
    const file=await db.getAll('outbox');
    ok(file.some(row=>row.store==='cook_history' && row.id==='ch-perso'),'I2 S01: cuisson synchronisée malgré historique de consultation désactivé');
    ok(!file.some(row=>row.store==='library_activity'),'I2 S01: historique de consultation désactivé reste local');
    const stockage=creerStockageFactice();
    const envoi=createFichiers({db,stockage,getUserId:()=> 'u1',qualite:()=> 'originale'});
    await envoi.envoyer({snapshot:await db.getSnapshot(MAGASINS_FICHIERS)});
    const fichier=await db.get('files',sha);
    ok(!!fichier.remote,'I2 S01: les octets personnels sont effectivement envoyés au Storage factice');
    await withDatabase(async second => {
      const {blob:_blob,...metadata}=fichier;
      await second.putBatch({files:[metadata],cook_history:[{id:'ch-perso',recipe_id:'r',recipe_version_id:'v',photos:[sha]}]});
      await createFichiers({db:second,stockage,getUserId:()=> 'u1'}).telecharger([sha]);
      const recu=await second.get('files',sha);
      eq(await recu?.blob?.text(),await blob.text(),'I2 S01: octets réellement téléchargés sur le second appareil');
    });
  }));
  await run('photo personnelle sur les cartes', () => withRepo(async repo => {
    const {buildDocs}=await import('../src/domain/search.js');
    const {renderLibrary}=await import('../src/ui/library.js');
    const {sha256Hex}=await import('../src/core/hash.js');
    const image=async couleur => { const c=document.createElement('canvas');c.width=2;c.height=2;c.getContext('2d').fillStyle=couleur;c.getContext('2d').fillRect(0,0,2,2);return new Promise(r=>c.toBlob(r)); };
    const perso=await image('red'),livre=await image('blue');
    const shaP=await sha256Hex(perso),shaL=await sha256Hex(livre);
    await repo.putFile(shaP,perso,{});await repo.putFile(shaL,livre,{});
    const recipes=[{id:'r',original_title:'Mon plat',availability:'available',photo_sha256:shaL}];
    const history=[{id:'ch',recipe_id:'r',cooked_at:'2026-10-28',photos:[shaP]}];
    const docs=buildDocs({recipes,versions:[],editions:[],books:[],dishes:[],links:[],history});
    eq(docs[0].photo_principale?.sha256,shaP,'I2 C05: document partagé sélectionne la photo personnelle');
    eq(recipes[0].photo_sha256,shaL,'I2 C05: sélection ne remplace jamais le pointeur du livre');
    const ctx={recipes,docs,cook_history:history};
    // La CSP de la vraie page de tests interdit fetch(blob:). Observer les octets confiés au navigateur, puis son décodage réel.
    const urls=new Map(),creer=URL.createObjectURL;
    URL.createObjectURL=bytes=>{const url=creer.call(URL,bytes);urls.set(url,bytes);return url;};
    let root;
    try {
      root=await renderLibrary({}, {},ctx,{matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
      document.body.append(root);
      const img=root.querySelector('img.plat-vignette');
      if(img) await img.decode();
      const bytes=urls.get(img?.src);
      eq(bytes ? await sha256Hex(bytes) : null,shaP,'I2 C05: carte bibliothèque affiche les vrais octets personnels');
    } finally { URL.createObjectURL=creer;root?.cleanup?.();root?.remove();for(const url of urls.keys())URL.revokeObjectURL(url); }
  }));
  await run('archive notes photos et sources', () => withDatabase(async source => {
    const {createArchive,inspectArchive,applyArchive,verifyRestored}=await import('../src/domain/backup.js');
    const {sha256Hex}=await import('../src/core/hash.js');
    const sha=await sha256Hex(blob);
    const books=[{id:'bk',title:'Trinity',description:'Résumé sourcé',cuisine_facets:{styles:['restaurant']},metadata_provenance:{title:{origin:'photo',retrieved_at:'2026-10-28T12:00:00Z'}}}];
    const editions=[{id:'ed',book_id:'bk',source_photo_sha256:sha}];
    const recipes=[{id:'r',edition_id:'ed',original_title:'Mon plat',current_version_id:'v',personal_notes:'Moins saler\nLa prochaine fois.'}];
    const history=[{id:'ch',recipe_id:'r',recipe_version_id:'v',cooked_at:'2026-10-28',photos:[sha],notes:'Bon résultat'}];
    await source.putBatch({books,book_editions:editions,recipes,recipe_versions:[{id:'v',recipe_id:'r',kind:'extraction',ingredients:[],steps:[]}],cook_history:history,files:[{sha256:sha,blob,size:blob.size,mime:blob.type}]});
    const archive=await createArchive(source);
    const inspection=await inspectArchive(await archive.blob.arrayBuffer());
    await withDatabase(async cible => {
      await applyArchive(cible,inspection,{mode:'replace'});
      ok((await verifyRestored(cible,inspection,{mode:'replace'})).ok,'I2 S02: archive restaurée sans écart');
      eq((await cible.get('recipes','r')).personal_notes,recipes[0].personal_notes,'I2 S02: note permanente et retours de ligne conservés');
      eq((await cible.get('cook_history','ch')).photos,[sha],'I2 S02: photos liées à la cuisson');
      eq((await cible.get('books','bk')).metadata_provenance,books[0].metadata_provenance,'I2 S02: provenance du livre conservée');
      eq(await (await cible.get('files',sha)).blob.text(),await blob.text(),'I2 S02: octets personnels et source réellement restaurés');
    });
  }));
}
