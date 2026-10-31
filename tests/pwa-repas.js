import {withRepo} from './sync-fixture.js';
import {withDatabase} from './backup.js';
import {renderMeal,renderMeals} from '../src/ui/meals.js';
import {getData,getSyncState,setSyncState} from '../src/ui/state.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';
import {formatDate} from '../src/core/dom.js';

const attendre=async pred=>{for(let n=0;n<200;n++){if(await pred())return;await new Promise(r=>setTimeout(r,5));}throw Error('Le geste du repas n’a pas atteint son état attendu');};
const bouton=(root,texte)=>[...root.querySelectorAll('button')].find(x=>x.textContent===texte);
const volet=root=>root.querySelector('[data-role=organisation-repas]');
const basculer=root=>volet(root)?.querySelector(':scope > summary')?.click();
const fermer=root=>{root?.dispose?.();root?.remove();};
async function fixture(repo){
 const recipe={id:'pwa-repas-r',original_title:'Pain du repas',availability:'available'},version={id:'pwa-repas-v',recipe_id:recipe.id,servings:4,ingredients:[],steps:[{id:'pwa-step',text:'Mélanger puis servir.'}]};
 const meal={id:'pwa-repas',title:'Souper du samedi',servings:4,serve_at:null,planned_on:'2026-10-31',constraints_snapshot:{diets:[]},items:[{id:'pwa-item',recipe_id:recipe.id,recipe_version_id:version.id,role:'plat_principal',servings:4,servings_custom:false,locked:false}]};
 await repo.saveBatch({recipes:[recipe],recipe_versions:[version],meals:[meal]},{conditions:{recipes:[{key:recipe.id,absente:true}]}});
 return{recipe,version,meal};
}

export async function runPwaRepasTests({eq,ok}){
 const locale=getUiLocale();setUiLocale('fr');
 try{
  await withRepo(async(repo,db)=>{
   const f=await fixture(repo),messages=[];let panne=false;
   const root=await renderMeal({id:f.meal.id},{},await getData(true),{refresh:()=>{},toast:m=>messages.push(m),repo:{...repo,saveBatch:async(...args)=>{if(panne)throw new DOMException('Stockage simulé indisponible','QuotaExceededError');try{return await repo.saveBatch(...args);}catch(e){messages.push(e.message);throw e;}}}});document.body.append(root);
   try{
    const initial=await db.getAll('meals'),outbox=await db.getAll('outbox'),sources=await db.getAll('recipe_versions');
    const organisation=volet(root),summary=organisation?.querySelector(':scope > summary'),jour=root.querySelector('[data-role=jour-repas]'),portion=root.querySelector('.card.sage input[type=number]'),heure=root.querySelector('[data-role=heure-repas]'),contraintes=root.querySelector('[data-role=contraintes-repas]');
    eq(organisation?.tagName,'DETAILS','PWA repas : organisation dans un volet natif');
    eq(organisation?.open,false,'PWA repas : configuration fermée au premier affichage');
    eq(summary?.textContent,'Organisation du repas','PWA repas : volet nommé explicitement');
    ok(['Renommer','Refaire ce repas','Archiver ce repas'].every(t=>organisation?.contains(bouton(root,t))),'PWA repas : actions secondaires regroupées');
    ok([jour,portion,heure,contraintes].every(x=>organisation?.contains(x)),'PWA repas : contrôles de configuration regroupés sans suppression');
    const plats=root.querySelector('[data-role=plats-repas]');
    ok(!!plats&&!organisation?.contains(plats)&&plats.textContent.includes('Pain du repas'),'PWA repas : plats accessibles hors organisation');
    ok(!!plats&&!!organisation&&!!(organisation.compareDocumentPosition(plats)&Node.DOCUMENT_POSITION_FOLLOWING),'PWA repas : accès à l’organisation avant les plats, configuration repliée');
    eq(root.querySelector('[data-role=apercu-repas]')?.textContent,`4 portions · ${formatDate('2026-10-31')}`,'PWA repas : portions et jour conservés restent visibles');
    eq(root.querySelector('header')?.querySelectorAll('button').length,0,'PWA repas : titre sans les trois actions secondaires');
    eq([await db.getAll('meals'),await db.getAll('outbox')],[initial,outbox],'PWA repas : premier affichage sans écriture métier');
    summary?.focus();basculer(root);
    eq(organisation?.open,true,'PWA repas : ouverture par le résumé');
    eq(document.activeElement===summary,true,'PWA repas : focus conservé sur le résumé');
    eq([await db.getAll('meals'),await db.getAll('outbox')],[initial,outbox],'PWA repas : ouverture sans écriture');
    jour.value='2026-11-03';jour.dispatchEvent(new Event('input'));
    ok(root.etatEditeur().sale,'PWA repas : date en cours protégée');
    basculer(root);basculer(root);
    eq([root.querySelector('[data-role=jour-repas]')===jour,root.querySelector('[data-role=heure-repas]')===heure,root.querySelector('[data-role=contraintes-repas]')===contraintes],[true,true,true],'PWA repas : fermer et rouvrir conserve les contrôleurs');
    eq(jour.value,'2026-11-03','PWA repas : fermeture conserve la saisie non enregistrée');
    ok(root.etatEditeur().sale,'PWA repas : fermer ne fait pas croire la saisie enregistrée');
    portion.value='6';portion.dispatchEvent(new Event('change'));
    await attendre(async()=>messages.length||(await repo.get('meals',f.meal.id)).servings===6);eq(messages,[],'PWA repas : portion atteint sa conservation sans autre garde');
    eq((await repo.get('meals',f.meal.id)).items[0].servings,6,'PWA repas : portions et élément hérité réellement conservés');
    eq((await repo.get('meals',f.meal.id)).planned_on,'2026-10-31','PWA repas : portions ne sauvegardent pas la date encore en saisie');
    bouton(root,'Enregistrer le jour').click();await attendre(()=>root.textContent.includes('Date du repas enregistrée.'));
    eq([(await repo.get('meals',f.meal.id)).planned_on,(await repo.get('meals',f.meal.id)).serve_at],['2026-11-03',null],'PWA repas : jour enregistré sans heure inventée');
    bouton(root,'Végétarien').click();await attendre(()=>root.querySelector('[data-role=etat-contraintes]').textContent==='Contraintes enregistrées.');
    eq((await repo.get('meals',f.meal.id)).constraints_snapshot.diets,['vegetarien'],'PWA repas : contrainte réellement conservée');
    eq(organisation?.open,true,'PWA repas : gestes conservés ne recréent pas le volet dans la vue courante');
    panne=true;const avantEchec=await repo.get('meals',f.meal.id);portion.value='7';portion.dispatchEvent(new Event('change'));await attendre(()=>messages.length>0);
    eq(await repo.get('meals',f.meal.id),avantEchec,'PWA repas : rejet de sauvegarde ne modifie pas le repas');
    basculer(root);basculer(root);
    eq([portion.value,root.etatEditeur().sale],['7',true],'PWA repas : erreur puis fermeture conserve la saisie et sa protection');
    eq(await db.getAll('recipe_versions'),sources,'PWA repas : versions sources intactes après les gestes');
   }finally{fermer(root);}
  });

  await withRepo(async(repo,db)=>{
   const f=await fixture(repo),ctx=await getData(true),chemin='/meals/'+f.meal.id;
   let adresse=chemin+'?origine=source&vue=courte';const changements=[];
   const deps={refresh:()=>{},routeCourante:()=>adresse,remplacerAdresse:valeur=>{changements.push(valeur);adresse=valeur;}};
   const basculerUrl=async root=>{const d=volet(root);if(!d)return;await new Promise(resolve=>{d.addEventListener('toggle',resolve,{once:true});basculer(root);});};
   const old=await renderMeal({id:f.meal.id},{origine:'source',vue:'courte'},ctx,deps);document.body.append(old);
   try{
    const avant=await db.getAll('meals'),file=await db.getAll('outbox');
    await basculerUrl(old);
    eq(Object.fromEntries(new URLSearchParams(adresse.split('?')[1])),{origine:'source',vue:'courte',organisation:'ouverte'},'PWA repas : ouvrir conserve origine et autres paramètres dans l’adresse');
    eq(changements.length,1,'PWA repas : un toggle remplace une adresse sans nouvelle navigation');
    fermer(old);
    const fresh=await renderMeal({id:f.meal.id},{origine:'source',vue:'courte',organisation:'ouverte'},ctx,deps);document.body.append(fresh);
    try{
     eq(volet(fresh)?.open,true,'PWA repas : après destruction de la vue, query reprend l’organisation ouverte');
     adresse=chemin+'?origine=source&vue=courte&organisation=ouverte';const count=changements.length;
     await basculerUrl(fresh);
     eq([Object.fromEntries(new URLSearchParams(adresse.split('?')[1])),changements.length-count],[{origine:'source',vue:'courte'},1],'PWA repas : fermer retire seulement le paramètre de présentation');
     adresse='/library?origine=ailleurs';const avantRoute=changements.length;await basculerUrl(fresh);
     eq([adresse,changements.length],['/library?origine=ailleurs',avantRoute],'PWA repas : ancienne vue ne modifie pas une autre route');
     adresse=chemin;const state=getSyncState();setSyncState({});
     try{await basculerUrl(fresh);eq(changements.length,avantRoute,'PWA repas : changement de génération refuse la modification d’adresse');}finally{setSyncState(state);}
    }finally{fermer(fresh);}
    const direct=await renderMeal({id:f.meal.id},{},ctx,deps);document.body.append(direct);
    try{
     eq(volet(direct)?.open,false,'PWA repas : retour depuis la liste sans paramètre commence replié');
     const count=changements.length;await withDatabase(async other=>{repo.bindDatabase(other);try{await basculerUrl(direct);eq(changements.length,count,'PWA repas : autre base refuse la modification d’adresse');}finally{repo.bindDatabase(db);}});
     direct.dispose();await basculerUrl(direct);eq(changements.length,count,'PWA repas : vue détruite ne modifie plus l’adresse');
    }finally{fermer(direct);}
    const detached=await renderMeal({id:f.meal.id},{},ctx,deps);try{const count=changements.length;await basculerUrl(detached);eq(changements.length,count,'PWA repas : vue non montée ne modifie pas l’adresse');}finally{fermer(detached);}
    const inconnue=await renderMeal({id:f.meal.id},{organisation:'autre'},ctx,deps);try{eq(volet(inconnue)?.open,false,'PWA repas : seule la valeur ouverte déplie le volet');}finally{fermer(inconnue);}
    eq([await db.getAll('meals'),await db.getAll('outbox')],[avant,file],'PWA repas : présentation URL sans écriture métier ni envoi');
   }finally{fermer(old);}
   const autre={...f.meal,id:'pwa-repas-autre',servings:null,planned_on:null};await repo.save('meals',autre);
   const autreRoot=await renderMeal({id:autre.id},{},await getData(true),{refresh:()=>{}});
   try{eq(autreRoot.querySelector('[data-role=apercu-repas]')?.textContent,'Portions inconnues · Sans date','PWA repas : valeurs absentes dites inconnues sans date déduite');}finally{fermer(autreRoot);}
   const dated={...f.meal,planned_on:null,serve_at:'2026-11-02T18:30:00.000Z'};await repo.save('meals',dated);
   const dateRoot=await renderMeal({id:f.meal.id},{},await getData(true),{refresh:()=>{}});
   try{eq(dateRoot.querySelector('[data-role=apercu-repas]')?.textContent,`4 portions · ${formatDate(dated.serve_at,{withTime:true})}`,'PWA repas : heure conservée affichée en heure locale');}finally{fermer(dateRoot);}
   const list={id:'pwa-liste',title:'Courses du souper',items:[],created_at:'2026-10-31T12:00:00.000Z'};await repo.save('shopping_lists',list);
   const rows=await renderMeals({}, {},await getData(true)),link=rows.querySelector('a[href*="/lists/pwa-liste"]');
   eq(link?.textContent,`Courses du souper ${formatDate(list.created_at)}`,'PWA repas : titre de courses séparé de sa date dans la lecture textuelle');
   eq((await db.getAll('cook_sessions')).length,0,'PWA repas : lecture et organisation ne lancent aucune cuisson');
  });
 }finally{setUiLocale(locale);}
}
