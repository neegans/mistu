import {withRepo} from './sync-fixture.js';
import {renderHome} from '../src/ui/home.js';
import {renderLivreSansSaisieRoute} from '../src/ui/livre-sans-saisie.js';
import {getData} from '../src/ui/state.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';
import {parseHash} from '../src/core/router.js';

const exemples=['saumon fenouil','salade concombre sans gluten 15 minutes','soupe rapide','puttanesca'];
const tick=()=>new Promise(r=>setTimeout(r,0));
const attendre=async fn=>{const fin=performance.now()+3000;while(performance.now()<fin){if(fn())return;await tick();}throw Error('Conservation différée non atteinte');};
const differe=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const magasins=['recipes','recipe_versions','books','book_editions','source_pages','source_documents','files'];

export async function runConfortEntreesTests({eq,ok}){
 const locale=getUiLocale(),href=location.href,state=history.state,scene=document.createElement('div');document.body.append(scene);setUiLocale('fr');
 const cas=async(nom,fn)=>{try{await withRepo(fn);}catch(e){ok(false,`Confort entrées ${nom} : ${e.stack||e}`);}finally{for(const r of scene.children)r.dispose?.();scene.replaceChildren();history.replaceState(state,'',href);}};
 try{
  await cas('exemples de recherche',async(repo,db)=>{
   const ctx=await getData(true);ctx.settings={...ctx.settings,rediscover_enabled:false};
   const root=await renderHome({}, {},ctx,{repo});scene.append(root);const avant=await db.getSnapshot([...magasins,'imports','outbox']);
   ok(root.classList.contains('accueil-page'),'Confort accueil : portée de présentation propre à la page');
   const choix=[...root.querySelector('.recherche-accueil .chips').children],input=root.querySelector('input[type=search]');
   eq(choix.map(n=>n.textContent),exemples,'Confort accueil : les quatre exemples gardent leurs textes exacts');
   ok(choix.every(n=>n.tagName==='BUTTON'&&n.type==='button'&&n.tabIndex===0),'Confort accueil : exemples natifs au clavier, sans soumission implicite');
   for(const [i,ex] of exemples.entries()){
    choix[i].focus();ok(document.activeElement===choix[i],`Confort accueil : exemple ${i+1} peut recevoir le focus`);
    choix[i].click();await tick();eq([input.value,parseHash()], [ex,{path:'/search',query:{q:ex,mode:'all'}}],`Confort accueil : exemple ${i+1} ouvre la vraie recherche exacte`);
   }
   input.value='  mon plat  ';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();
   eq(parseHash(),{path:'/search',query:{q:'mon plat',mode:'all'}},'Confort accueil : Entrée dans la recherche conserve le geste historique');
   eq(await db.getSnapshot([...magasins,'imports','outbox']),avant,'Confort accueil : navigation sans écriture de recette, import ou envoi');
  });
  for(const quota of [false,true])await cas('saisie manuelle '+(quota?'refusée':'conservée'),async(repo,db)=>{
   const attente=differe();let bloque=false,appels=0,root;const avant=await db.getSnapshot(magasins),outbox=await db.getAll('outbox');
   const depot={...repo,saveBatch:async(...args)=>{if(!bloque){bloque=true;await attente.promise;if(quota)throw new DOMException('Stockage refusé pour ce témoin','QuotaExceededError');}return repo.saveBatch(...args);}};
   const deps={repo:depot,fetch:async()=>{appels++;throw Error('Réseau interdit');},enLigne:()=>false,remplacerAdresse:()=>{},toast:()=>{}};
   const autre=document.createElement('button');autre.textContent='Geste précédent';scene.append(autre);autre.focus();
   try{
    root=await renderLivreSansSaisieRoute({}, {},{books:[]},deps);scene.append(root);
    const title=root.querySelector('[name=title]'),author=root.querySelector('[name=author]'),zone=title.closest('section'),focus=title.focus.bind(title),scroll=title.scrollIntoView.bind(title),focalisations=[],defilements=[];
    title.focus=options=>{focalisations.push(options);focus(options);};title.scrollIntoView=options=>{defilements.push(options);scroll(options);};
    ok(document.activeElement===autre,`Confort livre ${quota} : le montage ne vole pas le focus`);
    eq(zone.hidden,true,`Confort livre ${quota} : champs manuels initialement repliés`);
    root.querySelector('[data-role=saisir-livre]').click();await attendre(()=>bloque);
    eq(zone.hidden,false,`Confort livre ${quota} : geste explicite révèle les champs`);
    ok(document.activeElement===title,`Confort livre ${quota} : titre focalisé avant la fin du stockage`);
    eq(focalisations,[{preventScroll:true}],`Confort livre ${quota} : focus sans défilement implicite`);
    eq(defilements,[{block:'start'}],`Confort livre ${quota} : titre amené explicitement au début de la vue`);
    eq((await repo.all('imports')).length,0,`Confort livre ${quota} : focus disponible pendant la véritable attente d’écriture`);
    if(!quota){title.value='Carnet personnel';title.dispatchEvent(new Event('input',{bubbles:true}));}
    author.focus();attente.resolve();await root.attendreEcritures().catch(()=>{});
    ok(document.activeElement===author,`Confort livre ${quota} : fin d’écriture ne reprend pas le focus d’un autre champ`);
    eq([focalisations.length,defilements.length],[1,1],`Confort livre ${quota} : aucun focus ou défilement tardif`);
    eq(appels,0,`Confort livre ${quota} : aucun appel réseau pour la saisie manuelle`);
    eq(await db.getSnapshot(magasins),avant,`Confort livre ${quota} : aucune recette, source, image ou édition modifiée`);
    if(quota)eq([await repo.all('imports'),await db.getAll('outbox')],[[],outbox],'Confort livre : refus de sauvegarde sans faux brouillon conservé');
    else{
     const rows=await repo.all('imports');eq([rows.length,rows[0]?.brouillon?.fields?.title],[1,'Carnet personnel'],'Confort livre : titre saisi pendant l’attente réellement conservé');
     const id=root.etatRoute().importId;root.dispose();root.remove();autre.focus();
     root=await renderLivreSansSaisieRoute({}, {import:id},{books:[]},deps);scene.append(root);
     eq(root.querySelector('[name=title]').value,'Carnet personnel','Confort livre : titre relu après réouverture');
     ok(document.activeElement===autre,'Confort livre : réouverture ne déclenche pas de focus automatique');
    }
   }finally{attente.resolve();await root?.attendreEcritures().catch(()=>{});root?.dispose();root?.remove();}
  });
 }finally{scene.remove();history.replaceState(state,'',href);setUiLocale(locale);}
}
