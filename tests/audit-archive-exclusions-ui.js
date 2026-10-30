import {withRepo} from './sync-fixture.js';
import {withDatabase,rewriteArchive} from './backup.js';
import {createArchive} from '../src/domain/backup.js';
import {renderSettings,archiveEnCours} from '../src/ui/settings.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';

const AT='2026-10-30T12:00:00.000Z';
const attendre=async predicate=>{for(let i=0;i<300&&!predicate();i++)await new Promise(r=>setTimeout(r,5));};
const bouton=(root,texte)=>[...root.querySelectorAll('button')].find(b=>b.textContent===texte);
const exclusion={store:'recipes',id:'recette-ecartee',motif:'cycle_recette_invalide'};
const archiveFictive=exclues=>({blob:new Blob(['zip'],{type:'application/zip'}),manifest:{created_at:AT,counts:{},files:[],exclues},bytes:3,warnings:[],exclues});

export async function runAuditArchiveExclusionsUITests({eq,ok}){
 const langue=getUiLocale();
 try{
  for(const locale of ['fr','en'])await withRepo(async(repo,db)=>{
   setUiLocale(locale);let n=0;const telecharges=[];
   const root=await renderSettings({}, {},{settings:await repo.getSettings(),sync:{}},{createArchive:async()=>archiveFictive(n++?[]:[exclusion]),telechargerArchive:(blob,nom)=>telecharges.push({blob,nom})});
   document.body.append(root);
   try{
    bouton(root,locale==='fr'?'Sauvegarder toute ma bibliothèque':'Back up my whole library').click();await attendre(()=>!archiveEnCours());
    const bilan=root.querySelector('[data-role="exclusions-archive"]');
    ok(bilan?.textContent.includes(locale==='fr'?'1 fiche exclue (cycle de recette invalide)':'1 record excluded (invalid recipe removal history)'),`audit 9.3 UI ${locale} : exclusion et motif lisibles après création`);
    ok(bilan?.textContent.includes('recette-ecartee'),`audit 9.3 UI ${locale} : identifiant consultable`);
    eq(telecharges.length,1,`audit 9.3 UI ${locale} : archive réellement confiée au téléchargement`);
    eq((await repo.getSettings()).last_backup?.exclues,[exclusion],`audit 9.3 UI ${locale} : exclusion du dernier export conservée dans son bilan`);
    const reprise=await renderSettings({}, {},{settings:await repo.getSettings(),sync:{}});
    try{ok(!!reprise.querySelector('[data-role="exclusions-archive"]'),`audit 9.3 UI ${locale} : bilan partiel retrouvé après réouverture`);}finally{reprise.dispose?.();}
    bouton(root,locale==='fr'?'Sauvegarder toute ma bibliothèque':'Back up my whole library').click();await attendre(()=>!archiveEnCours());
    eq(root.querySelector('[data-role="exclusions-archive"]'),null,`audit 9.3 UI ${locale} : export complet suivant enlève ancien avertissement`);
   }finally{root.dispose?.();root.remove();}
  });
  await withRepo(async(repo,db)=>{
   setUiLocale('fr');const lignes=[{...exclusion,id:'<img src=x onerror=alert(1)>'},{...exclusion,id:null}];
   const muter=db.mutate.bind(db);db.mutate=async args=>{if(args.puts?.settings?.some(r=>r.key==='last_backup'))throw new DOMException('suivi indisponible','QuotaExceededError');return muter(args);};
   const root=await renderSettings({}, {},{settings:await repo.getSettings(),sync:{}},{createArchive:async()=>archiveFictive(lignes),telechargerArchive:()=>{}});document.body.append(root);
   try{
    bouton(root,'Sauvegarder toute ma bibliothèque').click();await attendre(()=>!archiveEnCours());const bilan=root.querySelector('[data-role="exclusions-archive"]');
    ok(bilan?.textContent.includes('2 fiches exclues (cycle de recette invalide)'),'audit 9.3 UI : pluriel et bilan conservé malgré échec du suivi');
    ok(bilan?.textContent.includes('<img src=x onerror=alert(1)>'),'audit 9.3 UI : identifiant hostile rendu en texte');
    eq(bilan?.querySelector('img')??null,null,'audit 9.3 UI : aucun HTML depuis le manifeste');
    ok(bilan?.textContent.includes('Fiche non identifiable'),'audit 9.3 UI : clé non représentable annoncée sans inventer un identifiant');
    eq((await repo.getSettings()).last_backup??null,null,'audit 9.3 UI : suivi refusé jamais présenté comme conservé');
   }finally{db.mutate=muter;root.dispose?.();root.remove();}
  });
  let archive;await withDatabase(async db=>{archive=await createArchive(db);});
  const bytes=await rewriteArchive(archive.blob,({manifest})=>{manifest.exclues=[exclusion];});
  for(const locale of ['fr','en'])await withRepo(async repo=>{
   setUiLocale(locale);const root=await renderSettings({}, {},{settings:await repo.getSettings(),sync:{}},{pickFiles:async()=>[new File([bytes],'partielle.zip',{type:'application/zip'})]});document.body.append(root);
   try{
    bouton(root,locale==='fr'?'Restaurer une sauvegarde…':'Restore a backup…').click();await attendre(()=>!!root.querySelector('[data-role="exclusions-archive"]')&&!archiveEnCours());
    const bilan=root.querySelector('[data-role="exclusions-archive"]');
    ok(bilan?.textContent.includes(locale==='fr'?'1 fiche exclue (cycle de recette invalide)':'1 record excluded (invalid recipe removal history)'),`audit 9.3 UI ${locale} : exclusions de l’archive affichées avant restauration`);
    ok(bilan?.textContent.includes(locale==='fr'?'Ces fiches ne sont pas dans cette archive.':'These records are not in this archive.'),`audit 9.3 UI ${locale} : portée de la sauvegarde explicitée`);
    eq(await repo.db.get('recipes','recette-ecartee'),undefined,`audit 9.3 UI ${locale} : inspection ne recrée pas une fiche exclue`);
   }finally{root.dispose?.();root.remove();}
  });
 }finally{setUiLocale(langue);}
}
