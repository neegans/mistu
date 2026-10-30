import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderImport } from '../src/ui/import.js';
import { sha256Hex } from '../src/core/hash.js';

const attendre = async (fn, limite=1600) => {const fin=performance.now()+limite;while(performance.now()<fin){if(await fn())return true;await new Promise(r=>setTimeout(r,5));}return false;};
const bouton = (root,texte) => [...root.querySelectorAll('button')].find(b=>b.textContent.trim()===texte);
const image = async (couleur='#345',nom='source.jpg') => {const c=new OffscreenCanvas(40,60),x=c.getContext('2d');x.fillStyle=couleur;x.fillRect(0,0,40,60);return new File([await c.convertToBlob({type:'image/jpeg'})],nom,{type:'image/jpeg'});};
const actives=s=>s.source_state?.active_page_ids??s.page_ids;
async function fixture(repo,db,{livre=true,historique=false}={}){
 const fichier=await image(),sha=await sha256Hex(fichier),edition=livre?{id:'ed-source',book_id:'book-source'}:null;
 const page={id:'pg-source',edition_id:edition?.id??null,document_id:'doc-source',sha256:sha,rotation:0,position:1,printed_page:12,kind:'recette'};
 const document={id:page.document_id,edition_id:page.edition_id,scan_session_id:'seance-source',source_type:'photo',sha256:sha,size:fichier.size,mime:fichier.type,original_filename:fichier.name,captured_at:'2026-10-29T12:00:00.000Z'};
 const session={id:'seance-source',edition_id:page.edition_id,status:'open',page_ids:[page.id],document_ids:[document.id],recipe_ids:['recette-source'],started_at:'2026-10-29T12:00:00.000Z',device_id:repo.deviceId()};
 const actuelle={...page,id:'pg-actuelle',rotation:90,source_revision:{format:1,family_id:page.id,parent_page_id:page.id,operation_id:'revision-initiale',reason:'rotate'}};
 if(historique){session.page_ids.push(actuelle.id);session.source_state={format:1,revision:'revision-initiale',active_page_ids:[actuelle.id]};}
 const recette={id:'recette-source',edition_id:page.edition_id,original_title:'Recette historique',availability:'reference_only',verification_state:'unverified',source_page_ids:[page.id],index_page_id:page.id,current_version_id:null};
 await db.mutate({origin:'remote',puts:{...(edition?{books:[{id:edition.book_id,title:'Livre source'}],book_editions:[edition]}:{}),source_documents:[document],source_pages:[page,...(historique?[actuelle]:[])],scan_sessions:[session],recipes:[recette],files:[{sha256:sha,blob:fichier,mime:fichier.type}]}});
 return {page,document,session,edition,fichier,recette,actuelle};
}
async function choisirFichier(fichier){const trouve=await attendre(()=>document.querySelector('input[type=file]'));if(!trouve)return false;const input=document.querySelector('input[type=file]');Object.defineProperty(input,'files',{value:[fichier]});input.dispatchEvent(new Event('change'));return true;}
const cocher=(root,id)=>{const check=root.querySelector(`figure[data-page="${id}"] input[type=checkbox]`);if(check){check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));}return !!check;};

export async function runL5ImportSourcesTests({eq,ok}){
 const scene=document.createElement('div');document.body.append(scene);let root=null;
 const run=async(nom,fn)=>{try{await withRepo(fn);}catch(e){ok(false,`L5 Import ${nom} : ${e.stack||e}`);}finally{root?.dispose?.();root?.remove();root=null;scene.replaceChildren();document.querySelectorAll('input[type=file],dialog').forEach(x=>x.remove());}};
 const monter=async(base,deps={})=>{root=await renderImport({}, {session:base.session.id},await getData(true),deps);scene.append(root);return root;};
 try{
  for(const livre of [true,false])await run('rotation '+livre,async(repo,db)=>{
   const b=await fixture(repo,db,{livre});await monter(b);bouton(root,'↻ Pivoter')?.click();
   await attendre(async()=>{const ps=await repo.all('source_pages');return ps.length>1||ps[0]?.rotation!==0;});
   const ancienne=await repo.get('source_pages',b.page.id),s=await repo.get('scan_sessions',b.session.id),p=await repo.get('source_pages',actives(s)[0]);
   eq(ancienne.rotation,0,`L5 Import rotation ${livre?'livre':'sans livre'} : ancienne image citée intacte`);
   ok(p?.id!==b.page.id&&p?.rotation===90,'L5 Import rotation : nouvelle révision active');
   eq((await repo.get('recipes',b.recette.id)).source_page_ids,[b.page.id],'L5 Import rotation : référence historique inchangée');
  });
  await run('remplacement',async(repo,db)=>{
   const b=await fixture(repo,db),nouveau=await image('#b54','remplacement.jpg');await monter(b);cocher(root,b.page.id);bouton(root,'Remplacer cette page')?.click();await choisirFichier(nouveau);
   await attendre(async()=>actives(await repo.get('scan_sessions',b.session.id))[0]!==b.page.id);
   const avant=await repo.get('source_pages',b.page.id),s=await repo.get('scan_sessions',b.session.id),apres=await repo.get('source_pages',actives(s)[0]);
   eq([avant.document_id,avant.sha256],[b.document.id,b.page.sha256],'L5 Import remplacement : document et octets de l’ancienne page intacts');
   ok(apres?.id!==b.page.id&&apres?.sha256===await sha256Hex(nouveau),'L5 Import remplacement : nouveau fichier dans une autre révision');
   eq((await repo.get('recipes',b.recette.id)).source_page_ids,[b.page.id],'L5 Import remplacement : recette conserve source exacte');
  });
  await run('retrait cité',async(repo,db)=>{
   const b=await fixture(repo,db);await monter(b);cocher(root,b.page.id);(bouton(root,'Retirer de la séance')||bouton(root,'Retirer'))?.click();
   await attendre(()=>document.querySelector('dialog')||document.querySelector('#toast')?.textContent);
   const dlg=document.querySelector('dialog');if(dlg)(bouton(dlg,'Retirer de la séance')||bouton(dlg,'Retirer')||bouton(dlg,'Confirmer'))?.click();
   await attendre(async()=>actives(await repo.get('scan_sessions',b.session.id)).length===0);
   const s=await repo.get('scan_sessions',b.session.id);eq(actives(s),[],'L5 Import retrait : source citée peut quitter seulement la sélection');
   eq(s.page_ids,[b.page.id],'L5 Import retrait : historique de séance conservé');
   ok(!!await repo.get('source_pages',b.page.id)&&!!await repo.get('source_documents',b.document.id),'L5 Import retrait : page et document conservés');
   eq((await repo.get('recipes',b.recette.id)).source_page_ids,[b.page.id],'L5 Import retrait : recette conservée avec sa source');
  });
  await run('branche concurrente',async(repo,db)=>{
   const b=await fixture(repo,db),photo=await image('#129','ma-photo.jpg');let repondre,picker=false;
   const choix=new Promise(r=>{repondre=r;});await monter(b,{pickFiles:()=>{picker=true;return choix;}});cocher(root,b.page.id);bouton(root,'Remplacer cette page').click();await attendre(()=>picker);
   const {creerServiceRevisionsSource}=await import('../src/domain/revisions-source.js'),{getSyncGeneration}=await import('../src/ui/state.js');
   const autre=creerServiceRevisionsSource({repo,getGeneration:getSyncGeneration}),c=await autre.capturerSources({session:b.session,pages:[b.page],documents:[b.document],contexte:{owner_id:null,edition:b.edition,estCourante:()=>true}}),p=await autre.preparerRevision({capture:c.capture,action:'rotate',pageId:b.page.id,rotation:90}),accepte=await autre.appliquerRevision({plan:p.plan});
   eq(accepte.issue,'applique','L5 Import conflit : autre vue a réellement changé la sélection');const autrePage=actives(accepte.session)[0];
   repondre([photo]);await attendre(()=>bouton(root,'Comparer les sources'));
   eq(actives(await repo.get('scan_sessions',b.session.id)),[autrePage],'L5 Import conflit : ancien remplacement ne remplace pas le choix concurrent');
   eq((await repo.all('files')).length,1,'L5 Import conflit : aucun octet orphelin écrit au refus');
   bouton(root,'Comparer les sources')?.click();await attendre(()=>document.querySelector('dialog.source-comparison'));
   const dlg=document.querySelector('dialog.source-comparison');ok(!!dlg?.querySelector('img'),'L5 Import conflit : comparaison montre réellement les images');
   bouton(dlg||root,'Utiliser mon choix')?.click();await attendre(async()=>actives(await repo.get('scan_sessions',b.session.id))[0]!==autrePage);
   const session=await repo.get('scan_sessions',b.session.id),maPage=await repo.get('source_pages',actives(session)[0]);
   eq(maPage.source_revision?.parent_page_id,b.page.id,'L5 Import reprise : parent historique conservé, jamais reparenté vers choix concurrent');
   eq(maPage.sha256,await sha256Hex(photo),'L5 Import reprise : fichier refusé réutilisé sans nouveau choix');
   ok(session.page_ids.includes(autrePage)&&!!await repo.get('source_pages',autrePage),'L5 Import reprise : branche concurrente conservée dans historique');
  });
  await run('sélection explicite',async(repo,db)=>{
   const b=await fixture(repo,db),deux={...b.page,id:'autre-famille',position:2};await db.mutate({origin:'remote',puts:{source_pages:[deux],scan_sessions:[{...b.session,page_ids:[b.page.id,deux.id]}]}});
   await monter(b);cocher(root,b.page.id);bouton(root,'↻ Pivoter')?.click();await attendre(async()=>actives(await repo.get('scan_sessions',b.session.id))[0]!==b.page.id);
   await attendre(async()=>!!root.querySelector(`figure[data-page="${actives(await repo.get('scan_sessions',b.session.id))[0]}"]`));
   const choisies=[...root.querySelectorAll('figure input[type=checkbox]:checked')].map(x=>x.closest('figure').dataset.page);
   eq(choisies,actives(await repo.get('scan_sessions',b.session.id)).slice(0,1),'L5 Import rotation : sélection de lecture non élargie aux autres photos');
  });
  await run('histoire et focus',async(repo,db)=>{
   const b=await fixture(repo,db,{historique:true});await monter(b);const ouvre=bouton(root,'Historique');ouvre.focus();ouvre.click();await attendre(()=>document.querySelector('dialog.source-revision-panel'));
   let dlg=document.querySelector('dialog.source-revision-panel');eq([...dlg.querySelectorAll('[data-revision]')].map(e=>e.dataset.revision),[b.page.id,b.actuelle.id],'L5 Import historique : anciennes et nouvelles photos consultables');
   dlg.dispatchEvent(new Event('cancel',{cancelable:true}));if(dlg.open)dlg.close();await attendre(()=>!dlg.isConnected);
   ok(document.activeElement===ouvre,'L5 Import historique : fermeture rend le focus au déclencheur');
   ouvre.click();await attendre(()=>document.querySelector('dialog.source-revision-panel'));dlg=document.querySelector('dialog.source-revision-panel');
   bouton(dlg.querySelector(`[data-revision="${b.page.id}"]`),'Utiliser cette révision').click();await attendre(async()=>actives(await repo.get('scan_sessions',b.session.id))[0]===b.page.id);
   eq(actives(await repo.get('scan_sessions',b.session.id)),[b.page.id],'L5 Import historique : choix explicite de l’ancienne révision');
   eq((await repo.get('source_pages',b.actuelle.id)).rotation,90,'L5 Import historique : nouvelle révision reste intacte après retour à l’ancienne');
   await attendre(()=>!dlg.isConnected);ok(root.contains(document.activeElement),'L5 Import historique : focus revient à la séance même si miniature remplacée');
  });
  await run('affichage après commit',async(repo,db)=>{
   const b=await fixture(repo,db),{creerCommandesSources}=await import('../src/ui/revisions-source.js');let commit=0;
   const gestion=await creerCommandesSources({repo,ctx:await getData(true),compte:Promise.resolve({owner_id:null}),lire:()=>({session:b.session,pages:[b.page],documents:[b.document],edition:b.edition}),estCourante:()=>true,
     onResultat:async()=>{throw new Error('affichage indisponible après commit');},deps:{serviceRevisions:{capturerSources:async()=>({issue:'ok',capture:{}}),preparerRevision:async()=>({issue:'ok',plan:{}}),appliquerRevision:async()=>{commit++;return{issue:'applique',session:b.session,recu:{operation_id:'confirmee'}};}}}});
   scene.append(gestion.racine);try{await gestion.modifier({action:'rotate',pageId:b.page.id,rotation:90});eq(commit,1,'L5 Import affichage : commit déjà confirmé');
    ok(gestion.racine.textContent.includes('Sources conservées')&&!gestion.racine.textContent.includes('L’enregistrement n’a pas abouti'),'L5 Import affichage : erreur de rendu ne nie pas le commit confirmé');
   }finally{gestion.dispose();gestion.racine.remove();}
  });
  await run('préparation interrompue',async(repo,db)=>{
   const b=await fixture(repo,db),f=await image('#863','memoire.jpg');let choix=0,preparations=0,captureInitiale=null,captureReessayee=null;
   const capture={marque:'source-affichee'},serviceRevisions={capturerSources:async()=>({issue:'ok',capture}),
    preparerRevision:async args=>{preparations++;if(preparations===1){captureInitiale=args.capture;throw new DOMException('stockage indisponible','QuotaExceededError');}captureReessayee=args.capture;return{issue:'refuse',raison:'source_changed'};}};
   await monter(b,{serviceRevisions,pickFiles:async()=>{choix++;return[f];}});cocher(root,b.page.id);bouton(root,'Remplacer cette page').click();
   await attendre(()=>root.querySelector('[data-role=etat-sources]')?.textContent.includes('L’enregistrement n’a pas abouti'));
   ok(!!bouton(root,'Récupérer ma photo'),'L5 Import préparation : photo choisie récupérable après erreur');
   const retry=bouton(root,'Réessayer l’enregistrement');ok(!!retry,'L5 Import préparation : reprise possible sans nouvelle photo');retry?.click();await attendre(()=>preparations===2);
   eq([choix,preparations,captureInitiale===captureReessayee],[1,2,true],'L5 Import préparation : réessai conserve fichier et capture initiale');
  });
  await run('rattachement réel',async(repo,db)=>{
   const b=await fixture(repo,db,{livre:false,historique:true});await db.mutate({origin:'remote',puts:{books:[{id:'cible-livre',title:'Livre cible'}],book_editions:[{id:'cible-edition',book_id:'cible-livre'}]}});
   const avant=await db.getSnapshot(['source_pages','source_documents','scan_sessions','recipes']);let destination=null;await monter(b,{navigate:p=>{destination=p;}});
   const select=root.querySelector('select');select.value='cible-edition';select.dispatchEvent(new Event('change',{bubbles:true}));await attendre(()=>document.querySelector('dialog'));
   const dlg=document.querySelector('dialog');ok(dlg?.textContent.includes('Les recettes déjà créées restent'),'L5 Import rattachement réel : conséquence annoncée avant copie');bouton(dlg,'Associer les sources')?.click();await attendre(()=>destination);
   ok(destination?.includes('/import?session='),'L5 Import rattachement réel : navigation vers nouvelle séance après commit');
   const neuve=(await repo.all('scan_sessions')).find(s=>s.id!==b.session.id);eq(neuve?.edition_id,'cible-edition','L5 Import rattachement réel : édition choisie sur copie neuve');
   eq(neuve?.recipe_ids,[],'L5 Import rattachement réel : recettes historiques non déplacées');
   eq((await repo.get('scan_sessions',b.session.id)).edition_id,null,'L5 Import rattachement réel : séance d’origine sans livre inchangée');
   ok(neuve?.page_ids.every(id=>!b.session.page_ids.includes(id)),'L5 Import rattachement réel : identités de page neuves');
   eq((await repo.all('files')).length,1,'L5 Import rattachement réel : mêmes octets réutilisés');
   for(const store of ['source_pages','source_documents','scan_sessions','recipes'])for(const row of avant[store])eq(await repo.get(store,row.id),row,'L5 Import rattachement réel : ligne historique intacte '+store+'/'+row.id);
  });
  await run('réessai rattachement',async(repo,db)=>{
   const b=await fixture(repo,db,{livre:false});await db.mutate({origin:'remote',puts:{books:[{id:'cible-livre',title:'Livre cible'}],book_editions:[{id:'cible-edition',book_id:'cible-livre'}]}});
   let capture=null,preparations=0,ecritures=0,mauvaiseCommande=0,destination=null;const plan={identite:'copie-exacte'};
   const serviceRevisions={capturerSources:async x=>{capture=x;return{issue:'ok',capture:x};},preparerRattachementSources:async()=>{preparations++;return{issue:'ok',plan};},
     appliquerRattachementSources:async p=>{ecritures++;return ecritures===1?{issue:'echec',raison:'quota',reessayable:true}:{issue:'applique',session:{...b.session,id:'copie-nouvelle',edition_id:'cible-edition'}};},
     appliquerRevision:async()=>{mauvaiseCommande++;return{issue:'refuse',raison:'invalid_shape'};}};
   await monter(b,{serviceRevisions,confirmDialog:async()=>true,navigate:p=>{destination=p;}});
   const select=root.querySelector('select');select.value='cible-edition';select.dispatchEvent(new Event('change',{bubbles:true}));
   await attendre(()=>bouton(root,'Réessayer l’enregistrement'));
   ok(root.querySelector('[data-role=etat-sources]').textContent.includes('L’enregistrement n’a pas abouti'),'L5 Import quota : message écriture sans accuser la saisie ou une source changée');
   bouton(root,'Réessayer l’enregistrement')?.click();await attendre(()=>destination||mauvaiseCommande);
   eq([preparations,ecritures,mauvaiseCommande],[1,2,0],'L5 Import rattachement : même plan et même commande au réessai après quota');
   ok(destination?.includes('copie-nouvelle'),'L5 Import rattachement : navigation uniquement vers reçu de la copie');
   eq(capture.session.edition_id,null,'L5 Import rattachement : capture de la séance affichée sans déplacer son parent');
  });
  await run('choix fichier après sortie',async(repo,db)=>{
   const b=await fixture(repo,db);let terminer,preparations=0;
   const attente=new Promise(r=>{terminer=r;}),serviceRevisions={capturerSources:async()=>({issue:'ok',capture:{}}),preparerRevision:async()=>{preparations++;return{issue:'refuse'};}};
   await monter(b,{serviceRevisions,pickFiles:()=>attente});cocher(root,b.page.id);bouton(root,'Remplacer cette page').click();await new Promise(r=>setTimeout(r,20));
   root.dispose?.();root.remove();terminer([await image('#752','tardive.jpg')]);await new Promise(r=>setTimeout(r,20));
   eq(preparations,0,'L5 Import sortie : aucun ancien fichier appliqué après dispose');
   eq((await repo.all('source_pages')).length,1,'L5 Import sortie : bibliothèque inchangée après choix tardif');
  });
  await run('historique actif',async(repo,db)=>{
   const b=await fixture(repo,db,{historique:true});await monter(b);
   eq([...root.querySelectorAll('.thumbs > figure')].map(x=>x.dataset.page),[b.actuelle.id],'L5 Import séance gérée : miniature seulement pour la révision active');
   ok(!!bouton(root,'Historique'),'L5 Import : accès explicite à l’ancienne révision');
  });
 }finally{root?.dispose?.();scene.remove();}
}
