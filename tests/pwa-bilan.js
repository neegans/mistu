import {withRepo} from './sync-fixture.js';
import {fixtureCuisineL7} from './l7-cuisine-ecran.js';
import {ouvrirCuissons} from '../src/ui/cuisson.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';

const prochaineImage=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

export async function runPwaBilanTests({eq,ok}) {
 const locale=getUiLocale();setUiLocale('fr');
 try { for(const mode of ['apres-coup','fin-seance','repli'])await withRepo(async(repo,db)=>{
  const f=fixtureCuisineL7(),items=mode==='fin-seance'?[f.a,f.b]:[f.a];
  await db.mutate({origin:'remote',puts:{recipes:[f.a.recipe,f.b.recipe],recipe_versions:[f.a.version,f.b.version],cook_sessions:[f.session]}});
  const magasins=['recipes','recipe_versions','cook_sessions','cook_history','files','outbox'],avant=await db.getSnapshot(magasins);
  const scene=document.createElement('main'),trigger=document.createElement('button');trigger.type='button';trigger.textContent='Ouvrir le bilan';scene.append(trigger);document.body.append(scene);
  const descriptor=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal');let pending,dialogue;
  try{
   if(mode==='repli')Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:undefined});
   trigger.focus();pending=ouvrirCuissons(items,{repo,toast:()=>{},...(mode==='fin-seance'?{session:f.session}:{} )});
   dialogue=document.querySelector('[data-role=dialogue-cuissons]');const titre=dialogue.querySelector('h2');
   await prochaineImage();
   eq(titre.textContent,mode==='fin-seance'?'Cuisson terminée — à refaire ?':'J’ai cuisiné ce plat',`PWA bilan ${mode} : titre adapté au geste conservé`);
   ok(document.activeElement===titre,`PWA bilan ${mode} : ouverture focalise le titre avant le formulaire`);
   eq(titre.getAttribute('tabindex'),'-1',`PWA bilan ${mode} : titre focalisable sans étape Tab supplémentaire`);
   eq(dialogue.getAttribute('aria-labelledby'),titre.id,`PWA bilan ${mode} : nom accessible lié au titre visible`);
   eq(await db.getSnapshot(magasins),avant,`PWA bilan ${mode} : ouvrir n’enregistre ni bilan ni progression ni fichier`);
   const notes=dialogue.querySelector('textarea');notes.value='Observation temporaire du bilan';notes.dispatchEvent(new Event('input',{bubbles:true}));
   eq(notes.value,'Observation temporaire du bilan',`PWA bilan ${mode} : formulaire toujours saisissable après le focus du titre`);
   [...dialogue.querySelectorAll('button')].find(b=>b.textContent==='Annuler').click();
   eq(await pending,false,`PWA bilan ${mode} : Annuler conserve le résultat historique`);pending=null;
   await prochaineImage();ok(document.activeElement===trigger,`PWA bilan ${mode} : annulation rend le focus au déclencheur`);
   eq(await db.getSnapshot(magasins),avant,`PWA bilan ${mode} : annuler laisse sources, séance, photos et file exactes`);
  }finally{
   if(pending){dialogue?.dispatchEvent(new Event('cancel',{cancelable:true}));await pending;}
   if(mode==='repli')Object.defineProperty(HTMLDialogElement.prototype,'showModal',descriptor);
   dialogue?.remove();scene.remove();
  }
 }); }finally{setUiLocale(locale);}
}
