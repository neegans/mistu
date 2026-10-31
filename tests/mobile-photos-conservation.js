import { renderLivreSansSaisieRoute } from '../src/ui/livre-sans-saisie.js';
import { preparerPhotoLocale } from '../src/core/image.js';
import { sha256Hex } from '../src/core/hash.js';
import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';

const differe = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const snapshot = async db => Object.fromEntries(await Promise.all(['imports','files','outbox','books','book_editions'].map(async s => [s, await db.getAll(s)])));
const attendre = async root => { try { await root.attendreEcritures(); } catch { /* le refus est observé dans le DOM et la base */ } };
const geste = (root, role) => root.querySelector(`[data-role="${role}"]`)?.click();
const titre = (root, texte) => { const input=root.querySelector('[name=title]'); input.value=texte; input.dispatchEvent(new Event('input',{bubbles:true})); };
async function photo(couleur) { const c=new OffscreenCanvas(64,48),x=c.getContext('2d');x.fillStyle=couleur;x.fillRect(0,0,64,48);return new File([await c.convertToBlob({type:'image/jpeg'})],`couverture-${couleur.slice(1)}.jpg`,{type:'image/jpeg'}); }

export async function runMobilePhotosConservationTests({eq,ok}) {
  const locale=getUiLocale();setUiLocale('fr');const scene=document.createElement('div');document.body.append(scene);
  const run=async(nom,fn)=>{try{await withRepo(fn);}catch(e){ok(false,`Photos conservation ${nom} : ${e.stack||e}`);}finally{for(const r of scene.children)r.dispose?.();scene.replaceChildren();}};
  const monter=async(repo,files,query={})=>{let picks=0,appels=0;const root=await renderLivreSansSaisieRoute({},query,{}, {repo,pickFiles:async()=>{const f=files[Math.min(picks++,files.length-1)];return f?[f]:[];},sessionAssistant:()=>null,fetch:async()=>{appels++;throw Error('appel interdit');},toast:()=>{},remplacerAdresse:()=>{}});scene.append(root);return{root,picks:()=>picks,appels:()=>appels};};
  // Le refus est levé DANS la vraie transaction IndexedDB, après la fusion du fichier ; toutes les écritures doivent être annulées.
  const quota=(db)=>{const native=db.mutate.bind(db);let actif=true,atteint=0;db.mutate=args=>native({...args,conditions:{...args.conditions,...(actif&&args.conditions?.files?.length?{files:args.conditions.files.map(c=>({...c,fusion:(...xs)=>{const row=c.fusion(...xs);if(row){atteint++;throw new DOMException('quota injecté dans la transaction fichier','QuotaExceededError');}return row;}}))}:{})}});return{liberer:()=>{actif=false;},atteint:()=>atteint,restaurer:()=>{db.mutate=native;}};};
  try {
    const f=await photo('#c43'),autre=await photo('#27b'),sha=await sha256Hex(await preparerPhotoLocale(f)),shaAutre=await sha256Hex(await preparerPhotoLocale(autre));
    await run('première conservation atomique et réessai',async(repo,db)=>{
      const v=await monter(repo,[f]),avant=await snapshot(db),q=quota(db);geste(v.root,'photo-livre');await attendre(v.root);
      eq(q.atteint(),1,'Photo livre : le quota atteint la vraie fusion du fichier');
      eq(await snapshot(db),avant,'Photo livre : quota annule import, fichier et outbox ensemble');
      eq(v.root.etatRoute().importId,null,'Photo livre : aucun import fictivement conservé après quota');
      ok(v.root.querySelector('[data-role=conservation-photo-livre]')?.textContent.includes('La photo n’a pas pu être enregistrée.'),'Photo livre : panne de stockage distincte du décodage');
      ok(!!v.root.querySelector('[data-role=reessayer-photo-livre]'),'Photo livre : réessai de conservation proposé');
      eq(v.appels(),0,'Photo livre : aucun appel assistant pendant la panne');
      q.liberer();geste(v.root,'reessayer-photo-livre');await attendre(v.root);
      const row=await repo.get('imports',v.root.etatRoute().importId),saved=await repo.getFile(sha);
      eq([v.picks(),v.appels()],[1,0],'Photo livre : réessai sans sélecteur ni appel assistant');
      eq([row?.brouillon?.cover_sha256,row?.source_photo_sha256,row?.photo_sha256],[sha,sha,sha],'Photo livre : import conservé avec ses trois références exactes');
      eq(saved?.blob?await sha256Hex(saved.blob):null,sha,'Photo livre : octets préparés conservés au réessai');
      eq(!!v.root.querySelector('[data-role=reessayer-photo-livre]'),false,'Photo livre : succès retire le réessai périmé');
      const id=v.root.etatRoute().importId;v.root.dispose();v.root.remove();const reprise=await monter(repo,[f],{import:id});
      eq(reprise.root.etatRoute().brouillon.cover_sha256,sha,'Photo livre : couverture retrouvée à la réouverture');
      ok(!!reprise.root.querySelector('img[alt=Couverture]'),'Photo livre : aperçu réel après réouverture');q.restaurer();
    });
    await run('saisie pendant attente et commit',async(repo,db)=>{
      const v=await monter(repo,[f]),q=quota(db);geste(v.root,'photo-livre');await attendre(v.root);
      titre(v.root,'Titre saisi pendant la panne');await attendre(v.root);
      const avant=await repo.get('imports',v.root.etatRoute().importId);
      eq([avant?.brouillon?.fields?.title,avant?.brouillon?.cover_sha256],['Titre saisi pendant la panne',null],'Photo livre : saisie durable sans pointeur vers la photo en attente');
      q.restaurer();const nat=db.mutate.bind(db),entree=differe(),suite=differe();let suspendu=false;
      db.mutate=async args=>{if(!suspendu&&args.conditions?.files?.length){suspendu=true;entree.resolve(true);await suite.promise;}return nat(args);};
      geste(v.root,'reessayer-photo-livre');const demarre=await Promise.race([entree.promise,v.root.attendreEcritures().catch(()=>{}).then(()=>false)]);
      eq(demarre,true,'Photo livre : réessai réellement suspendu avant transaction');
      titre(v.root,'Titre changé pendant le commit');suite.resolve();await attendre(v.root);db.mutate=nat;
      const row=await repo.get('imports',v.root.etatRoute().importId);
      eq([row?.brouillon?.fields?.title,row?.brouillon?.cover_sha256,row?.source_photo_sha256],['Titre changé pendant le commit',sha,sha],'Photo livre : persist déjà en file conserve nouveau titre et nouveaux pointeurs');
      eq(v.root.querySelector('[name=title]').value,'Titre changé pendant le commit','Photo livre : le succès ne remplace pas la saisie récente à l’écran');
      eq([v.picks(),v.appels()],[1,0],'Photo livre : saisie et réessai sans nouveau choix ni coût');
    });
    for(const operation of ['nouvelle','retirer'])await run(operation,async(repo,db)=>{
      const v=await monter(repo,[f,autre]),q=quota(db);geste(v.root,'photo-livre');await attendre(v.root);const ancienRetry=v.root.querySelector('[data-role=reessayer-photo-livre]');q.liberer();
      geste(v.root,operation==='nouvelle'?'changer-couverture':'retirer-couverture');await attendre(v.root);ancienRetry?.click();await attendre(v.root);
      const row=await repo.get('imports',v.root.etatRoute().importId);
      eq(row?.brouillon?.cover_sha256,operation==='nouvelle'?shaAutre:null,`Photo livre ${operation} : ancien geste ne rétablit pas la première photo`);
      eq(!!(await repo.getFile(sha)),false,`Photo livre ${operation} : octets abandonnés jamais écrits`);
      eq(!!v.root.querySelector('[data-role=reessayer-photo-livre]'),false,`Photo livre ${operation} : ancien réessai retiré`);
      eq(v.appels(),0,`Photo livre ${operation} : aucun appel assistant`);q.restaurer();
    });
    for(const operation of ['annuler','invalide','pivoter','catalogue'])await run(`préparation retenue ${operation}`,async(repo,db)=>{
      const v=await monter(repo,[f,operation==='invalide'?new File(['invalide'],'photo.jpg',{type:'image/jpeg'}):null]),q=quota(db);
      geste(v.root,'photo-livre');await attendre(v.root);const avant=await snapshot(db);
      const role=operation==='pivoter'?'pivoter-couverture':operation==='catalogue'?'couverture-catalogue':'changer-couverture';
      if(['pivoter','catalogue'].includes(operation))eq(v.root.querySelector(`[data-role=${role}]`).disabled,true,`Photo livre ${operation} : transformation indisponible tant que la sélection attend sa conservation`);
      geste(v.root,role);await attendre(v.root);
      eq(await snapshot(db),avant,`Photo livre ${operation} : aucun changement durable après geste sans autre photo valide`);
      ok(!!v.root.querySelector('[data-role=reessayer-photo-livre]'),`Photo livre ${operation} : préparation précédente toujours récupérable`);
      q.liberer();geste(v.root,'reessayer-photo-livre');await attendre(v.root);
      eq((await repo.getFile(sha))?.blob?await sha256Hex((await repo.getFile(sha)).blob):null,sha,`Photo livre ${operation} : même photo conservée au réessai`);
      eq(v.appels(),0,`Photo livre ${operation} : aucune relance payée`);q.restaurer();
    });
    for(const changement of ['route','compte','epoque','base','retrait'])await run(`course ${changement}`,async(repo,db)=>{
      const v=await monter(repo,[f]),q=quota(db);geste(v.root,'photo-livre');await attendre(v.root);q.restaurer();
      const native=db.mutate.bind(db),entree=differe(),suite=differe();let suspendu=false;
      db.mutate=async args=>{if(!suspendu&&args.conditions?.files?.length){suspendu=true;entree.resolve(true);await suite.promise;}return native(args);};
      geste(v.root,'reessayer-photo-livre');const demarre=await Promise.race([entree.promise,v.root.attendreEcritures().catch(()=>{}).then(()=>false)]);eq(demarre,true,`Photo livre ${changement} : transaction différée atteinte`);
      const finir=async autreDb=>{
        if(changement==='route'){v.root.dispose();v.root.remove();}
        if(changement==='compte')await native({origin:'device',puts:{sync_state:[{key:'user_id',value:'autre-compte'}]}});
        if(changement==='epoque')await native({origin:'device',puts:{sync_state:[{key:'editor_library_epoch:v1',value:'autre-bibliotheque'}]}});
        if(changement==='base')repo.bindDatabase(autreDb);
        if(changement==='retrait')geste(v.root,'retirer-couverture');
        const before=await snapshot(db),other=autreDb?await snapshot(autreDb):null;suite.resolve();await attendre(v.root);
        if(changement!=='retrait')eq(await snapshot(db),before,`Photo livre ${changement} : ancienne base inchangée par réponse tardive`);
        else eq(!!(await repo.getFile(sha)),false,'Photo livre retrait pendant commit : ancien fichier jamais conservé');
        if(autreDb)eq(await snapshot(autreDb),other,'Photo livre base : nouvelle bibliothèque intacte');
        eq(v.appels(),0,`Photo livre ${changement} : zéro appel assistant tardif`);
      };
      try{if(changement==='base')await withDatabase(async autreDb=>{try{await finir(autreDb);}finally{repo.bindDatabase(db);}});else await finir();}finally{suite.resolve();db.mutate=native;}
    });
    await run('import existant et image invalide',async(repo,db)=>{
      const v=await monter(repo,[f]);titre(v.root,'Déjà saisi');await attendre(v.root);const id=v.root.etatRoute().importId,avant=await snapshot(db),q=quota(db);
      geste(v.root,'photo-livre');await attendre(v.root);eq(await snapshot(db),avant,'Photo livre existant : quota conserve exactement journal, fichiers et outbox');
      q.liberer();geste(v.root,'reessayer-photo-livre');await attendre(v.root);eq(v.root.etatRoute().importId,id,'Photo livre existant : réessai garde le même import');q.restaurer();v.root.dispose();v.root.remove();
      const bad=await monter(repo,[new File(['invalide'],'photo.jpg',{type:'image/jpeg'})]);geste(bad.root,'photo-livre');await attendre(bad.root);
      eq(bad.root.querySelector('[data-role=etat-livre]').textContent,'Cette image ne peut pas être lue ici. Essaie une autre photo.','Photo invalide : le refus de décodage conserve son message');
      eq(!!bad.root.querySelector('[data-role=reessayer-photo-livre]'),false,'Photo invalide : aucun faux réessai de stockage');
    });
    await run('dernière saisie avant sortie',async(repo,db)=>{
      const v=await monter(repo,[f]);titre(v.root,'Dernier titre avant de quitter');v.root.dispose();v.root.remove();await attendre(v.root);
      eq((await repo.all('imports')).map(r=>r.brouillon.fields.title),['Dernier titre avant de quitter'],'Livre : autosauvegarde de texte déjà demandée conservée après fermeture de la vue');
      eq([(await repo.all('files')).length,v.appels()],[0,0],'Livre : sortie pendant autosauvegarde ne conserve ni photo ni appel automatique');
    });
  } finally { for(const root of scene.children)root.dispose?.();scene.remove();setUiLocale(locale); }
}
