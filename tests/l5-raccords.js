import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { vignettePage } from '../src/ui/components.js';
import { renderRecipeEdit } from '../src/ui/recipe-edit.js';
import { sourceEditeurL4 } from './l4-editeur-recette.js';
import { sha256Hex } from '../src/core/hash.js';
import { renderBook } from '../src/ui/book.js';
import { panneauClassement, creerLesLectures } from '../src/ui/regroupement.js';
import { cleClassement, regroupementInitial } from '../src/domain/classement.js';
import { statutSeanceApres } from '../src/domain/import-cible.js';

const matrice = angle => {
  const r = angle * Math.PI / 180;
  return [Math.round(Math.cos(r)), Math.round(Math.sin(r)), -Math.round(Math.sin(r)), Math.round(Math.cos(r))];
};
const orientation = img => {
  const m = new DOMMatrix(getComputedStyle(img).transform);
  return [m.a, m.b, m.c, m.d].map(x => Math.round(x));
};

export async function runL5RaccordsTests({eq,ok}) {
  // La suite du domaine ne charge pas les styles de l’application ; cette preuve mesure le rendu réel.
  const styles=document.createElement('link');styles.rel='stylesheet';styles.href=new URL('../styles.css',import.meta.url).href;
  const charge=new Promise((resolve,reject)=>{styles.onload=resolve;styles.onerror=reject;});document.head.append(styles);await charge;
  try { await withRepo(async(repo,db)=>{
    const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#586447';ctx.fillRect(0,0,120,80);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const sha=await sha256Hex(blob),fichier={sha256:sha,blob,mime:'image/png'};
    await repo.putFile(sha,blob,{mime:'image/png'});
    const scene=document.createElement('div');document.body.append(scene);
    try {
      for(const rotation of [0,90,180,270]) {
        const page={id:'p-'+rotation,edition_id:null,document_id:null,sha256:sha,rotation,position:1};
        for(const avecMoteur of [false,true]) {
          const vue=vignettePage(page,fichier,{...(avecMoteur?{moteur:{}}:{})});scene.append(vue);
          const img=vue.matches('img')?vue:vue.querySelector('img');
          eq(orientation(img),matrice(rotation),'L5 vignette : orientation réelle '+rotation+' avec réception '+avecMoteur);
          vue.dispose?.();vue.remove();
        }
      }
      const f=sourceEditeurL4(),page={id:'l5-page-originale',edition_id:null,document_id:null,sha256:sha,rotation:90,position:1};
      f.recipe.source_page_ids=[page.id];
      await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version],source_pages:[page]}});
      const avantPage=await repo.get('source_pages',page.id),avantVersion=await repo.get('recipe_versions',f.version.id);
      const editeur=await renderRecipeEdit({id:f.recipe.id},{},await getData(true));scene.append(editeur);
      const img=editeur.querySelector('.editeur-source img');
      eq(orientation(img),matrice(90),'L5 éditeur : ouverture suit la révision source à 90 degrés');
      [...editeur.querySelectorAll('button')].find(b=>b.textContent==='Pivoter la vue').click();
      eq(orientation(img),matrice(180),'L5 éditeur : consultation tourne depuis l’orientation réelle');
      eq(await repo.get('source_pages',page.id),avantPage,'L5 consultation : tourner la vue ne change pas la source');
      eq(await repo.get('recipe_versions',f.version.id),avantVersion,'L5 consultation : la version originale reste exacte');
      ok(editeur.querySelector('[data-role=enregistrer-editeur]')?.disabled,'L5 consultation : aucun changement de recette à publier');
      editeur.dispose();editeur.remove();
    } finally {
      for(const n of scene.querySelectorAll('.editeur-recette,.photo-visible'))n.dispose?.();
      scene.remove();
    }
  }); } finally { styles.remove(); }
}

export async function runL5SourcesLecteursTests({eq,ok}) {
  await withRepo(async(repo,db)=>{
    const livre={id:'l5-livre',title:'Livre des sources'},edition={id:'l5-edition',book_id:livre.id};
    const documentSource={id:'l5-document',edition_id:edition.id,scan_session_id:'l5-seance',source_type:'photo',sha256:'a'.repeat(64)};
    const ancienne={id:'l5-page-avant',edition_id:edition.id,document_id:documentSource.id,sha256:documentSource.sha256,rotation:0,kind:'index',position:1};
    const actuelle={...ancienne,id:'l5-page-apres',rotation:90,position:2,source_revision:{format:1,family_id:ancienne.id,parent_page_id:ancienne.id,operation_id:'l5-rotation',reason:'rotate'}};
    const seance={id:'l5-seance',edition_id:edition.id,status:'open',started_at:'2026-10-29T12:00:00Z',page_ids:[ancienne.id,actuelle.id],document_ids:[documentSource.id],recipe_ids:[],source_state:{format:1,revision:'l5-rotation',active_page_ids:[actuelle.id]}};
    await db.mutate({origin:'remote',puts:{books:[livre],book_editions:[edition],source_documents:[documentSource],source_pages:[ancienne,actuelle],scan_sessions:[seance]}});
    const ctx=await getData(true),scene=document.createElement('div');document.body.append(scene);
    try {
      const vue=await renderBook({id:edition.id},{onglet:'sources'},ctx);scene.append(vue);
      ok(vue.textContent.includes('Séance en cours : 1 page(s)'),'L5 livre : le compteur représente la sélection active');
      eq([...vue.querySelectorAll('figure[data-nav-id]')].map(n=>n.dataset.navId),[actuelle.id],'L5 livre : la miniature courante ne présente pas l’ancienne image comme une autre page active');
      ok(vue.querySelector('a[href*="session=l5-seance"]'),'L5 livre : accès conservé à la séance et à son historique');
      let selection=[ancienne.id,actuelle.id];
      const classement=panneauClassement(seance,ctx,()=>selection,{repo,enLigne:()=>false});scene.append(classement);
      eq(classement.actionsSelection().length,0,'L5 classement : sélection ancienne filtrée avant le coût et le geste');
      eq(classement.regrouperPermis([ancienne.id]),false,'L5 classement : une ancienne case cochée n’ouvre pas une création sur l’image retirée');
      eq((await repo.get('scan_sessions',seance.id)).page_ids,[ancienne.id,actuelle.id],'L5 lecteurs : l’historique reste intégral en stockage');
      eq(statutSeanceApres(seance,new Map([[ancienne.id,{...ancienne,kind:null}],[actuelle.id,actuelle]]),new Set()),'done','L5 séance : une ancienne image sans rôle ne bloque pas la fin des pages actives');
      eq(statutSeanceApres(seance,new Map([[ancienne.id,ancienne]]),new Set()),'open','L5 séance : une image active pas encore reçue empêche une fin prématurée');
      const autre={...ancienne,id:'l5-autre-page'},nouvelleSeance={...seance,page_ids:[...seance.page_ids,autre.id],source_state:{format:1,revision:'l5-ajout',active_page_ids:[actuelle.id,autre.id]}};
      selection=[actuelle.id,autre.id];
      ok(typeof classement.actualiserSources==='function','L5 classement : porte de mise à jour sans détruire le panneau');
      classement.actualiserSources?.({session:nouvelleSeance,pages:[ancienne,actuelle,autre],selectedPageIds:selection});
      eq(classement.actionsSelection().length,2,'L5 classement : nouvelle page utilisable après un ajout dans la même vue');
      classement.dispose?.();vue.dispose?.();
    } finally {
      for(const n of scene.querySelectorAll('.photo-visible,[data-role=classement]'))n.dispose?.();
      scene.remove();
    }
  });
  for(const changement of ['aucun','avant-clic','pendant-commit','retire-puis-rechoisi'])await withRepo(async(repo,db)=>{
    const blob=new Blob(['photo de classement'],{type:'image/png'}),sha256=await sha256Hex(blob);
    await repo.putFile(sha256,blob,{mime:blob.type});
    const pages=['p1','p2'].map(id=>({id,edition_id:null,document_id:null,sha256,rotation:0}));
    const session={id:'s-classement',edition_id:null,status:'open',page_ids:['p1','p2'],document_ids:[],recipe_ids:[],source_state:{format:1,revision:'selection-vue',active_page_ids:['p1','p2']}};
    const resultat={groupes:[{page_ids:['p1','p2'],title:'Pain',printed_page:null,uncertain:false}],orphelines:[],non_classees:[],partagees:[],uncertain:[]};
    const ligne={id:'cl-paye',kind:'classement',scan_session_id:session.id,edition_id:null,page_ids:['p1','p2'],status:'a_verifier',started_at:'2026-10-29T12:00:00Z',resultat,appels:1};
    await db.mutate({origin:'remote',puts:{source_pages:pages,scan_sessions:[session],imports:[ligne]}});
    const modifier=()=>db.mutate({origin:'remote',puts:{scan_sessions:[{...session,source_state:{...session.source_state,revision:'autre-selection',active_page_ids:changement==='retire-puis-rechoisi'?['p1','p2']:['p1']}}]}});
    if(changement==='avant-clic'||changement==='retire-puis-rechoisi')await modifier();
    let transitions=0,numero=0;
    const r=await creerLesLectures(ligne.id,{cle:cleClassement(ligne),etat:regroupementInitial(resultat,new Map(pages.map(p=>[p.id,p]))),choix:new Map(),sessionAffichee:session,newId:()=>`nouvelle-lecture-${++numero}`,repo:{...repo,transitionner:async(...args)=>{transitions++;if(changement==='pendant-commit')await modifier();return repo.transitionner(...args);}}});
    eq(r.issue,changement==='aucun'?'cree':'refuse','L5 classement '+changement+' : le geste dépend de la sélection réellement vue');
    const imports=await repo.all('imports');
    eq(imports.length,changement==='aucun'?2:1,'L5 classement '+changement+' : aucune lecture payante préparée sur un état devenu ancien');
    eq((await repo.get('imports',ligne.id)).resultat,resultat,'L5 classement '+changement+' : le résultat payé reste intact');
    if(changement==='pendant-commit')eq(transitions,1,'L5 classement : la course atteint vraiment la transaction finale');
  });
}
