import {withRepo} from './sync-fixture.js';
import {withDatabase,supprimerBase} from './backup.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {coquille} from '../src/ui/coquille.js';
import {porteEntreeModel,renderPorteEntree} from '../src/ui/porte-entree.js';
import {suivreTitreVue} from '../src/ui/navigation-contexte.js';
import {renderHome} from '../src/ui/home.js';
import {renderMeal} from '../src/ui/meals.js';
import {renderShoppingList} from '../src/ui/grocery.js';
import {getData} from '../src/ui/state.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';
import {createArchive,inspectArchive} from '../src/domain/backup.js';
import {toPaprikaYaml,toReadableSite} from '../src/domain/exporters.js';
import {createZip,readZip,textOf} from '../src/core/zip.js';
import {Database} from '../src/core/db.js';
import {DB_VERSION,DB_NAME,STORES,ARCHIVE_FORMAT} from '../src/model/schema.js';
import {shortcutUrl} from '../src/domain/timers.js';

export function fixtureMarqueNavigation(){
 const f=fixtureLectureL6(),now=new Date(),avant=new Date(now.getTime()-100*86400000).toISOString();
 f.recipe.original_title='Cuisine OS — mon pain personnel';f.recipe.edition_id='marque-edition';
 return{...f,book:{id:'marque-livre',title:'Cuisine OS — mon livre personnel'},edition:{id:'marque-edition',book_id:'marque-livre',owned:true},
  activity:{id:'marque-lecture',edition_id:'marque-edition',event_type:'open_book',occurred_at:avant},pref:{id:'marque-pref',edition_id:'marque-edition',last_suggested_at:now.toISOString()},
  meal:{id:'marque-repas',title:'Souper Cuisine OS',servings:2,items:[],constraints_snapshot:{diets:[]}},
  list:{id:'marque-liste',title:'Courses Cuisine OS',meal_id:null,items:[],checked:{},manual_lines:[],row_overrides:{}}};
}
const borner=(promise,message)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),15000)})]).finally(()=>clearTimeout(timer));};
function attendreErreur(frame,name){
 let observer,verifier;
 const promise=new Promise((resolve,reject)=>{
  verifier=()=>{const doc=frame.contentDocument,f=frame.contentWindow?.fixture,e=frame.contentWindow?.fixtureErreur;
   if(e?.name===name)return reject(Error(e.message));
   if(f?.name!==name||f.documentInitial!==doc)return;
   const node=doc.querySelector('#app > .danger h2');if(node)return resolve({doc,f,node});
   if(!observer){observer=new MutationObserver(verifier);observer.observe(doc,{childList:true,subtree:true});}
  };
  for(const event of ['load','audit-pret','audit-echec'])frame.addEventListener(event,verifier);verifier();
 });
 return borner(promise,'Erreur de démarrage réelle non observée').finally(()=>{observer?.disconnect();for(const event of ['load','audit-pret','audit-echec'])frame.removeEventListener(event,verifier);});
}
export async function runAuditMarqueNavigationTests({eq,ok}){
 const locale=getUiLocale(),titre=document.title,scene=document.createElement('div');document.body.append(scene);
 const run=async(nom,fn)=>{try{await fn();}catch(e){ok(false,'Marque11.5 '+nom+' : '+(e.stack||e));}finally{scene.firstElementChild?.dispose?.();scene.replaceChildren();}};
 try{
  for(const lang of ['fr','en']){
   setUiLocale(lang);
   await run('coquille '+lang,async()=>{
    const c=coquille('/meals');scene.append(c.root);
    try{eq(c.root.querySelector('.brand')?.textContent,'Mistu','Marque11.5 '+lang+' : marque de la vraie coquille');
     eq([...c.root.querySelectorAll('[data-nav-destination="/meals"]')].map(n=>n.textContent),[lang==='fr'?'Repas':'Meals',lang==='fr'?'Repas':'Meals'],'Marque11.5 '+lang+' : onglets haut et bas nommés Repas');
     eq([...c.root.querySelectorAll('[data-nav-destination="/meals"]')].map(n=>n.getAttribute('href')),['#/meals','#/meals'],'Marque11.5 : routes des repas conservées');
     c.main.innerHTML='<h1>Cuisine OS — titre choisi par moi</h1>';const stop=suivreTitreVue({racine:c.main});
     eq(document.title,'Cuisine OS — titre choisi par moi — Mistu','Marque11.5 '+lang+' : seul suffixe du titre change');
     eq(c.main.querySelector('h1').textContent,'Cuisine OS — titre choisi par moi','Marque11.5 : titre utilisateur intact');stop();
    }finally{c.dispose();}
   });
   await run('porte '+lang,()=>{const model=porteEntreeModel({available:true}),p=renderPorteEntree(model,{signIn(){},sansCompte(){}},{icone:new URL('../icons/icon.svg',import.meta.url).href});scene.append(p);eq(p.querySelector('.porte-nom')?.textContent,'Mistu','Marque11.5 '+lang+' : porte nomme Mistu');eq(p.querySelectorAll('.porte-actions button').length,2,'Marque11.5 : deux issues de porte conservées');});
   await run('parcours '+lang,()=>withRepo(async(repo,db)=>{
    const f=fixtureMarqueNavigation();await db.mutate({origin:'remote',puts:{books:[f.book],book_editions:[f.edition],recipes:[f.recipe],recipe_versions:[f.version],library_activity:[f.activity],rediscovery_prefs:[f.pref],meals:[f.meal],shopping_lists:[f.list]}});
    const ctx=await getData(true);ctx.settings={...ctx.settings,ui_locale:lang,rediscover_enabled:true};
    const avant=await db.getSnapshot(['books','book_editions','recipes','recipe_versions','meals','shopping_lists']);
    const home=await renderHome({}, {},ctx,{repo});scene.append(home);
    const texte=[...home.querySelectorAll('h2')].map(n=>n.textContent).find(s=>s.includes('Mistu')||s.includes('Cuisine OS'));
    ok(lang==='fr'?texte?.includes('dans Mistu depuis'):texte?.includes('in Mistu for'),'Marque11.5 '+lang+' : redécouverte nomme Mistu dans la langue affichée '+texte);
    ok(home.textContent.includes(f.book.title)&&home.textContent.includes(f.recipe.original_title),'Marque11.5 : titres de livre et recette conservés');home.dispose();home.remove();
    const meal=await renderMeal({id:f.meal.id},{},ctx,{repo});scene.append(meal);
    eq(meal.querySelector('header > a')?.textContent,'← '+(lang==='fr'?'Repas':'Meals'),'Marque11.5 '+lang+' : retour du repas nommé Repas');eq(meal.querySelector('header > a')?.getAttribute('href'),'#/meals','Marque11.5 : retour repas sur route existante');meal.dispose();meal.remove();
    const list=await renderShoppingList({id:f.list.id},{},ctx,{repo});scene.append(list);
    eq(list.querySelector('header > a')?.textContent,'← '+(lang==='fr'?'Repas':'Meals'),'Marque11.5 '+lang+' : courses indépendantes retournent aux Repas');
    eq(list.querySelector('header > a')?.getAttribute('href'),'#/meals','Marque11.5 : retour courses conserve destination');list.dispose();
    eq(await db.getSnapshot(['books','book_editions','recipes','recipe_versions','meals','shopping_lists']),avant,'Marque11.5 : consultation ne réécrit aucun contenu utilisateur');
   }));
  }
  await run('métadonnées réellement servies',async()=>{
   const [html,manifest,readme]=await Promise.all([fetch(new URL('../index.html',import.meta.url)).then(r=>r.text()),fetch(new URL('../manifest.webmanifest',import.meta.url)).then(r=>r.json()),fetch(new URL('../README.md',import.meta.url)).then(r=>r.text())]);
   const doc=new DOMParser().parseFromString(html,'text/html');eq(doc.title,'Mistu','Marque11.5 : titre du document livré');
   ok(doc.querySelector('meta[name=description]')?.content.startsWith('Mistu —'),'Marque11.5 : description de l’application livrée');
   eq(doc.querySelector('meta[name=apple-mobile-web-app-title]')?.content,'Mistu','Marque11.5 : nom pour installation Apple');
   eq(doc.querySelector('noscript')?.textContent,'Mistu nécessite JavaScript.','Marque11.5 : écran sans JavaScript');
   eq([manifest.name,manifest.short_name],['Mistu','Mistu'],'Marque11.5 : deux noms du manifeste');
   eq([manifest.start_url,manifest.scope],['./index.html#/','./'],'Marque11.5 : identité des routes installées conservée');
   eq(readme.split('\n')[0],'# Mistu','Marque11.5 : titre du document d’accueil');
  });
  await run('exports remis à la personne',async()=>{
   const f=fixtureMarqueNavigation(),bundle={recipe:f.recipe,version:f.version,book:f.book};
   const yaml=toPaprikaYaml([bundle]);ok(yaml.includes('Exporté de Mistu — recette '+f.recipe.id),'Marque11.5 : provenance du vrai export Paprika');
   ok(yaml.includes(f.recipe.original_title),'Marque11.5 : export conserve titre utilisateur');
   const site=toReadableSite([bundle],new Map()),index=new DOMParser().parseFromString(site.entries.find(e=>e.path==='index.html').data,'text/html'),page=new DOMParser().parseFromString(site.entries.find(e=>e.path==='recipes/'+f.recipe.id+'.html').data,'text/html');
   eq(index.title,'Mes recettes — Mistu','Marque11.5 : titre de la copie HTML hors ligne');ok(index.body.textContent.includes('produite par Mistu.'),'Marque11.5 : attribution de l’index exporté');
   ok(page.body.textContent.includes('Exporté de Mistu le '),'Marque11.5 : attribution de la recette HTML exportée');eq(page.querySelector('h1').textContent,f.recipe.original_title,'Marque11.5 : titre utilisateur HTML inchangé');
   await withDatabase(async db=>{const archive=await createArchive(db),bytes=await archive.blob.arrayBuffer(),zip=readZip(bytes);
    eq(textOf(zip.get('README.txt')).split('\n')[0],'Archive Mistu','Marque11.5 : aide réellement incluse dans le ZIP');
    eq(JSON.parse(textOf(zip.get('manifest.json'))).format,'cuisine-os-archive','Marque11.5 : format d’archive historique préservé');ok((await inspectArchive(bytes)).ok,'Marque11.5 : archive toujours inspectable');
   });
   eq((await inspectArchive(createZip([{path:'README.txt',data:'Sans manifeste'}]))).errors,['manifest.json absent : ce n’est pas une archive Mistu'],'Marque11.5 : erreur d’archive remise à la personne');
  });
  for(const lang of ['fr-CA','en-CA'])await run('fatal réel '+lang,async()=>{
   const name='audit-version-'+crypto.randomUUID(),db=new Database(name,DB_VERSION+1,STORES),frame=document.createElement('iframe');await db.open();db.idb.close();db.idb=null;
   const url=new URL('./fixtures/version-base.html',import.meta.url);url.searchParams.set('base',name);url.searchParams.set('langue',lang);frame.src=url.href;frame.title='Erreur de démarrage isolée pour la marque';
   const attente=attendreErreur(frame,name);scene.append(frame);
   try{const {f,node}=await attente;eq(node.textContent,lang==='fr-CA'?'Mistu ne peut pas démarrer':'Mistu cannot start','Marque11.5 '+lang+' : vrai écran fatal nommé et traduit');eq(f.erreurs,[{code:'[cuisine-os] boot',name:'VersionError'}],'Marque11.5 : vrai refus natif, identité du journal conservée');eq(f.exceptions,[],'Marque11.5 : aucune exception non gérée');}
   finally{frame.contentWindow?.fixture?.db.idb?.close();frame.remove();await supprimerBase(name);}
  });
  eq([DB_NAME,ARCHIVE_FORMAT,shortcutUrl(480)],['cuisine-os','cuisine-os-archive','shortcuts://run-shortcut?name=CuisineOS-Minuterie&input=text&text=480'],'Marque11.5 : identités persistantes et raccourci configuré inchangés');
 }finally{scene.firstElementChild?.dispose?.();scene.remove();document.title=titre;setUiLocale(locale);}
}
