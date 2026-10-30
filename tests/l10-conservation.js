import * as routeur from '../src/core/router.js';
import {protegerSortieEditeur} from '../src/ui/sortie-editeur.js';
import {protegerSaisie} from '../src/ui/state.js';
import {withRepo} from './sync-fixture.js';

const attendre=async fn=>{for(let n=0;n<250;n++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Résultat de conservation attendu absent');};

const creerControleur = (options={}) => {
  let e={sale:true,enCours:false,id:'brouillon',publie:false,...options.etat},appels=0;
  const abonnes=new Set();
  return {etat:()=>({...e}),get appels(){return appels;},modifier:patch=>{e={...e,...patch};for(const f of abonnes)f({...e});},
    souscrire:f=>{abonnes.add(f);f({...e});return()=>abonnes.delete(f);},lireTexte:()=> 'Texte conservable exact 🍞',
    async flush(){appels++;if(options.flush)return options.flush(this);this.modifier({sale:false});return{issue:'ok'};}};
};
const demande=(racine,intention='conserver',estCourante=()=>true)=>routeur.demanderGardeExplicite?.({racine,intention,estCourante})||Promise.resolve({issue:'absente'});

export async function runL10ConservationTests({eq,ok}){
  const hote=document.createElement('div');document.body.append(hote);const stops=[];
  const monter=(c,demander)=>{const r=document.createElement('div');hote.append(r);r.flushEditeur=()=>c.flush();r.etatEditeur=c.etat;stops.push(protegerSortieEditeur({racine:r,controleur:c,...(demander?{demander}:{} )}));return r;};
  try{
    const c=creerControleur(),r=monter(c),url=location.href;
    eq((await demande(r)).issue,'conserve','L10 conservation : vrai flush confirmé distinct de sortie');
    eq(c.appels,1,'L10 conservation : un seul flush');ok(r.isConnected,'L10 conservation : racine jamais démontée');eq(location.href,url,'L10 conservation : aucune navigation');
    const photo=document.createElement('section');hote.append(photo);const libererPhoto=protegerSaisie(photo);stops.push(libererPhoto);
    c.modifier({sale:true});eq((await demande(r)).raison,'formulaire_ouvert','L10 conservation : photo hors contrôleur refuse avant flush');eq(c.appels,1,'L10 conservation : aucune sauvegarde métier du dialogue');
    libererPhoto();photo.remove();
    const livre=document.createElement('div');r.before(livre);livre.append(r);livre.flushEditeur=r.flushEditeur;livre.etatEditeur=r.etatEditeur;
    eq((await demande(livre)).issue,'conserve','L10 conservation : livre encapsulé consulte son unique contrôleur exact');
    livre.remove();const inconnu=document.createElement('div');hote.append(inconnu);eq((await demande(inconnu)).issue,'sans_saisie_suivie','L10 conservation : vue sans saisie ne promet pas un commit');
    const libererInconnu=protegerSaisie(inconnu);stops.push(libererInconnu);eq((await demande(inconnu)).issue,'refuse','L10 conservation : protection sans contrat jamais assimilée à une conservation');libererInconnu();
    const gardeOpaque=routeur.enregistrerGardeSortie(()=>false);stops.push(gardeOpaque);eq((await demande(inconnu)).raison,'contrat_incomplet','L10 conservation : garde ancienne opaque ne devient pas absence de saisie');gardeOpaque();
    let choix=0;const quota=creerControleur({flush:async()=>({issue:'refuse',raison:'a_conserver'})}),rq=monter(quota,async()=>{choix++;return true;});
    eq((await demande(rq)).issue,'refuse','L10 conservation : quota refuse sans abandon automatique');eq(choix,0,'L10 conservation : Conserver ne demande pas de quitter');
    eq((await demande(rq,'revoir_sortie')).issue,'quitter_sans_conserver','L10 conservation : abandon explicitement distinct du commit');eq(choix,1,'L10 conservation : décision existante appelée une fois');ok(quota.etat().sale,'L10 conservation : abandon ne marque pas le contenu durable');
    rq.remove();let liberer;const attente=new Promise(r=>liberer=r);const enVol=creerControleur({flush:async ctrl=>{await attente;ctrl.modifier({sale:false});return{issue:'ok'};}}),rv=monter(enVol);
    const p1=demande(rv),p2=demande(rv);await attendre(()=>enVol.appels>0);eq(enVol.appels,1,'L10 conservation : demandes identiques partagent le flush');
    const formulaire=document.createElement('div');hote.append(formulaire);const stopForm=protegerSaisie(formulaire);stops.push(stopForm);liberer();
    eq((await p1).raison,'formulaire_ouvert','L10 conservation : formulaire arrivé pendant flush invalide succès');eq((await p2).issue,'refuse','L10 conservation : deuxième demande observe le même refus');stopForm();formulaire.remove();
    rv.remove();let fin;const delai=new Promise(r=>fin=r),nouvelle=creerControleur({flush:async ctrl=>{await delai;ctrl.modifier({sale:false});return{issue:'ok'};}}),rn=monter(nouvelle);
    const pn=demande(rn);await new Promise(r=>setTimeout(r));rn.dispatchEvent(new Event('input',{bubbles:true}));fin();eq((await pn).issue,'refuse','L10 conservation : nouvelle frappe pendant flush interdit ancien succès');
    rn.remove();let courant=true,done;const attenteTardive=new Promise(r=>done=r),tardif=creerControleur({flush:async ctrl=>{await attenteTardive;ctrl.modifier({sale:false});return{issue:'ok'};}}),rt=monter(tardif);
    const pt=demande(rt,'conserver',()=>courant);await new Promise(r=>setTimeout(r));courant=false;done();eq((await pt).raison,'contexte_change','L10 conservation : portée remplacée refuse le résultat tardif');
    rt.remove();hote.append(livre);const seconde=creerControleur(),rs=monter(seconde);livre.append(rs);eq((await demande(livre)).raison,'contrat_incomplet','L10 conservation : plusieurs contrôleurs ne sont pas choisis arbitrairement');
  }finally{for(const stop of stops)stop();hote.remove();}
}

export async function runL10ReponseBruteTests({eq,ok}){
  await withRepo(async(repo,db)=>{
    const {getData}=await import('../src/ui/state.js'),{renderTraductionEditeur}=await import('../src/ui/traduction-editeur.js');
    const recipe={id:'l10-q-r',original_title:'Bread',original_language:'en',availability:'available',current_version_id:'l10-q-v'},version={id:'l10-q-v',recipe_id:recipe.id,ingredients:[],steps:[{id:'l10-q-s',text:'Stir.'}]};
    await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version],sync_state:[{key:'user_id',value:'l10-q-owner'}]}});
    let quota=false,appels=0,repondre,node;const reponse=new Promise(r=>repondre=r),original=db.mutate.bind(db),bytes=new TextEncoder().encode('REPONSE BRUTE EXACTE 🍞'),blobs=[],url=URL.createObjectURL;
    db.mutate=async(...args)=>{if(quota)throw new DOMException('Quota simulé','QuotaExceededError');return original(...args);};
    URL.createObjectURL=b=>{blobs.push(b);return url.call(URL,b);};
    const provider={configured:true,completeTranslation:async({messages})=>{appels++;await reponse;const plan=JSON.parse(messages[0].content);quota=true;return{text:JSON.stringify({format:1,segments:plan.segments.map((s,i)=>({ref:s.ref,text:i?'Remuer.':'Pain'}))}),reponseBrute:bytes,stopReason:'end_turn'};}};
    try{
      node=await renderTraductionEditeur({id:recipe.id},{kind:'translation',format:'2',locale:'fr',v:version.id},await getData(true),{provider,naviguer:()=>{},confirmer:async()=>true});document.body.append(node);
      node.querySelector('[data-role=preparer-traduction]').click();await attendre(()=>node.querySelector('[data-role=lancer-traduction]'));node.querySelector('[data-role=lancer-traduction]').click();await attendre(()=>appels===1);
      eq((await demande(node)).issue,'refuse','L10 brut : HTTP en vol ne donne pas conservé');ok(node.etatEditeur().enCours,'L10 brut : vol courant reste présent');eq(appels,1,'L10 brut : aucune seconde requête pendant vol');
      repondre();await attendre(()=>node.textContent.includes('sa conservation a échoué'));
      eq((await demande(node)).issue,'refuse','L10 brut : réponse payée en mémoire sous quota refuse');ok(node.etatEditeur().sale,'L10 brut : réponse non durable reste sale');eq(appels,1,'L10 brut : flush retente uniquement les mêmes octets');
      const sortie=demande(node,'revoir_sortie');await attendre(()=>document.querySelector('[data-role=sortie-editeur]'));
      [...document.querySelectorAll('[data-role=sortie-editeur] button')].find(b=>b.textContent==='Rester').click();eq((await sortie).raison,'rester','L10 brut : Rester conserve la réponse et sa vue');ok(node.isConnected,'L10 brut : aucun dispose pendant refus');
      [...node.querySelectorAll('button')].find(b=>b.textContent==='Récupérer la réponse non conservée').click();await attendre(()=>blobs.length>0);eq([...new Uint8Array(await blobs[0].arrayBuffer())],[...bytes],'L10 brut : récupération exacte après refus');
      quota=false;const r=await demande(node);eq(r.issue,'conserve','L10 brut : même réponse conservée après levée quota');eq(appels,1,'L10 brut : aucun nouvel appel même après récupération');
      const journal=(await repo.all('imports')).find(j=>j.kind==='traduction');eq(journal?.status,'a_verifier','L10 brut : journal durable reste à relire');eq((await repo.get('sync_state','translation_response:v1:'+journal.id))?.value.state,'received','L10 brut : reçu brut confirmé en base');
    }finally{repondre();quota=false;db.mutate=original;URL.createObjectURL=url;node?.dispose();node?.remove();}
  });
}

export async function runL10GardesMetierTests({eq,ok}){
  const {getData}=await import('../src/ui/state.js'),{renderBook}=await import('../src/ui/book.js'),{renderMeal}=await import('../src/ui/meals.js'),{renderShoppingList}=await import('../src/ui/grocery.js'),{ouvrirCuissons}=await import('../src/ui/cuisson.js');
  await withRepo(async(repo,db)=>{
    await db.mutate({origin:'remote',puts:{books:[{id:'l10-book',title:'Livre original',cuisines:[],tags:[]}],book_editions:[{id:'l10-ed',book_id:'l10-book',language:'fr'}]}});
    const root=await renderBook({id:'l10-ed'},{panel:'modifier'},await getData(true));document.body.append(root);
    try{const titre=root.querySelector('[data-role=modifier-livre] input[name=title]');titre.value='Mon titre en cours';titre.dispatchEvent(new Event('input',{bubbles:true}));eq((await demande(root)).issue,'conserve','L10 livre réel : éditeur encapsulé conserve le brouillon');ok(!!root.etatEditeur().id&&!root.etatEditeur().sale,'L10 livre réel : identité durable après flush');eq((await repo.get('books','l10-book')).title,'Livre original','L10 livre réel : conservation ne publie pas métadonnées');}
    finally{root.dispose();root.remove();}
    const list={id:'l10-list',title:'Courses',items:[],manual_lines:[],checked:{}};await repo.save('shopping_lists',list);
    const courses=await renderShoppingList({id:list.id},{},await getData(true),{toast:()=>{}});document.body.append(courses);
    try{const input=courses.querySelector('[data-role=libelle-ligne-libre]');input.value='Café à garder';input.dispatchEvent(new Event('input',{bubbles:true}));eq((await demande(courses)).issue,'refuse','L10 courses réelles : ligne en mémoire refuse');eq(input.value,'Café à garder','L10 courses réelles : aucun remplacement de saisie');eq((await repo.get('shopping_lists',list.id)).manual_lines,[],'L10 courses réelles : aucun clic implicite Ajouter');}
    finally{courses.dispose();courses.remove();}
    const meal={id:'l10-meal',title:'Envie',items:[],servings:null,serve_at:null,planned_on:null};await repo.save('meals',meal);
    const repas=await renderMeal({id:meal.id},{},await getData(true),{refresh:()=>{},toast:()=>{}});document.body.append(repas);
    try{const input=repas.querySelector('[data-role=jour-repas]');input.value='2026-11-03';input.dispatchEvent(new Event('input',{bubbles:true}));eq((await demande(repas)).issue,'refuse','L10 repas réel : jour non validé reste en mémoire');eq((await repo.get('meals',meal.id)).planned_on,null,'L10 repas réel : date non écrite par mise à jour');eq(input.value,'2026-11-03','L10 repas réel : date affichée conservée');}
    finally{repas.dispose();repas.remove();}
    const recipe={id:'l10-cuisson',original_title:'Pain',availability:'available'},version={id:'l10-cuisson-v',recipe_id:recipe.id,ingredients:[],steps:[],servings:4};await repo.saveBatch({recipes:[recipe],recipe_versions:[version]},{conditions:{recipes:[{key:recipe.id,absente:true}]}});
    const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;canvas.getContext('2d').fillRect(0,0,2,2);const image=await new Promise(r=>canvas.toBlob(r,'image/png'));
    const fiche=document.createElement('div');document.body.append(fiche);let bilan;
    try{bilan=ouvrirCuissons([{recipe,version}],{repo,toast:()=>{},pickFiles:async()=>[new File([image],'plat.png',{type:'image/png'})]});const dlg=[...document.querySelectorAll('dialog')].at(-1),note=dlg.querySelector('textarea');note.value='Note exacte avant fermeture';note.dispatchEvent(new Event('input',{bubbles:true}));[...dlg.querySelectorAll('button')].find(b=>b.textContent==='Choisir des photos').click();await attendre(()=>dlg.querySelector('[data-role=photos-cuisson] img'));
      eq((await demande(fiche)).raison,'formulaire_ouvert','L10 bilan réel : protection du dialogue refuse sans faux aucune saisie');eq(note.value,'Note exacte avant fermeture','L10 bilan réel : note toujours accessible');ok(!!dlg.querySelector('[data-role=photos-cuisson] img'),'L10 bilan réel : photo non validée toujours affichée');eq(await repo.db.count('cook_history'),0,'L10 bilan réel : aucun bilan enregistré implicitement');eq(await repo.db.count('files'),0,'L10 bilan réel : aucun octet photo écrit implicitement');[...dlg.querySelectorAll('button')].find(b=>b.textContent==='Annuler').click();eq(await bilan,false,'L10 bilan réel : annulation métier reste le seul geste');
    }finally{for(const dlg of document.querySelectorAll('dialog'))[...dlg.querySelectorAll('button')].find(b=>b.textContent==='Annuler')?.click();fiche.remove();}
  });
}

export async function runL10ConservationConcurrenceTests({eq,ok}){
  const racine=document.createElement('div');document.body.append(racine);const resolutions=[],c=creerControleur({flush:async()=>({issue:'refuse',raison:'a_conserver'})});
  const stop=protegerSortieEditeur({racine,controleur:c,demander:()=>new Promise(r=>resolutions.push(r))});
  const fenetre=new EventTarget();fenetre.location={hash:'#/l10-editeur'};fenetre.history={state:{},replaceState(s,_,h){this.state=s;fenetre.location.hash=h;},go(){}};const rendus=[];
  const arreter=routeur.start(r=>rendus.push(r.path),{fenetre});
  try{const explicite=demande(racine,'revoir_sortie');await attendre(()=>resolutions.length);
    fenetre.location.hash='#/l10-autre';fenetre.dispatchEvent(new Event('hashchange'));await new Promise(r=>setTimeout(r,30));
    eq(resolutions.length,1,'L10 conservation : retour pendant décision ne crée pas un second dialogue');
    for(const r of resolutions)r(false);eq((await explicite).raison,'rester','L10 conservation : première décision reste seule autorité');await new Promise(r=>setTimeout(r));eq(rendus,['/l10-editeur'],'L10 conservation : retour refusé ne démonte pas avant choix');ok(racine.isConnected,'L10 conservation : même saisie pendant deux demandes');
  }finally{for(const r of resolutions)r(false);arreter();stop();racine.remove();}
}
