import { withRepo } from './sync-fixture.js';
import * as B from '../src/domain/livre-bibliographie.js';
import * as P from '../src/domain/livre-parcours.js';
import { renderLivreSansSaisieRoute } from '../src/ui/livre-sans-saisie.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';
import { filterChips } from '../src/ui/components.js';

const SOURCE='https://editeur.example/classement';
const source={href:SOURCE,hote:'editeur.example',titre:'Livre'};
const valeur=value=>({value,sources:[SOURCE],uncertain:false});
const attendre=async(f,nom)=>{for(let i=0;i<200;i++){if(await f())return;await new Promise(r=>setTimeout(r,5));}throw Error(nom);};
const saisie=(input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
const groupe=(root,key)=>root.querySelector(`[data-role=ajouter-${key}]`).parentElement.parentElement;
const champ=(root,key)=>groupe(root,key).querySelector('input');
const bouton=(root,role)=>root.querySelector(`[data-role=${role}]`);
const proposition=(root,key,value)=>[...groupe(root,key).querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===`Ajouter ${value}`);
const etat=(root,key)=>groupe(root,key).querySelector('[data-role=etat-categorie]')?.textContent||'';
const croix=node=>(node.textContent.match(/×/g)||[]).length+(getComputedStyle(node,'::after').content.match(/×/g)||[]).length;

export function fixtureSuggestionsLivre(){
  const candidate=B.validerBibliographie({candidates:[{fields:{title:valeur('Titre proposé')},cuisine_facets:{origines:[valeur('Française')],styles:[valeur('Maison')],preparations:[valeur('Rôtis'),valeur('Cuisson douce')]},tags:[valeur('Pains'),valeur('Tartes'),valeur('Soupes'),{...valeur('Sans gluten'),uncertain:true}]}]},{sources:[source]}).candidates[0];
  let d=B.appliquerCandidateLivre(B.brouillonLivre(),candidate);
  d=B.modifierChampLivre(d,'title','Mon livre');
  d=B.modifierChampLivre(d,'tags',['Pains']);
  d=B.modifierChampLivre(d,'cuisine_facets',{origines:['Française'],styles:['Maison'],preparations:['Rôtis']});
  return B.appliquerCandidateLivre(d,candidate);
}

async function monter(repo,db,draft=fixtureSuggestionsLivre(),deps={}){
  const row=P.fabriquerImportLivre({id:repo.newId('imp'),deviceId:repo.deviceId(),brouillon:draft});await db.mutate({origin:'remote',puts:{imports:[row]}});
  const root=await renderLivreSansSaisieRoute({},{import:row.id},{books:[]},{repo,remplacerAdresse:()=>{},navigate:()=>{},toast:()=>{},fetch:async()=>{throw Error('Réseau interdit');},...deps});document.body.append(root);
  return{root,row,fermer(){root.dispose();root.remove();}};
}

export async function runBoutonsSuggestionsTests({eq,ok}){
 const locale=getUiLocale();setUiLocale('fr');
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('../styles.css',import.meta.url).href;
 try{
  await new Promise((resolve,reject)=>{css.onload=resolve;css.onerror=()=>reject(Error('Styles suggestions indisponibles'));document.head.append(css);});
  await withRepo(async(repo,db)=>{const f=await monter(repo,db),{root,row}=f;try{
   const tags=groupe(root,'tags'),pains=tags.querySelector('[aria-label="Retirer Pains"]');
   ok(tags.textContent.includes('Ajoutée au brouillon'),'Suggestions : une valeur présente est annoncée comme retenue');
   ok([...tags.querySelectorAll('small')].some(x=>x.textContent==='Suggestion de classement'),'Suggestions : provenance sourcée conservée séparément');
   eq(croix(pains),1,'Suggestions : une seule croix réellement rendue');
   const filtre=filterChips([{kind:'text',value:'pain'}],new Map(),()=>{});document.body.append(filtre);eq(croix(filtre.querySelector('button')),1,'Suggestions : la croix du filtre partagé reste visible');filtre.remove();
   eq(bouton(root,'ajouter-tags').disabled,true,'Suggestions : ajout manuel vide désactivé');
   ok(groupe(root,'preparations').textContent.includes('Ajouter une autre catégorie')&&tags.textContent.includes('Ajouter un autre mot-clé'),'Suggestions : saisie libre nommée selon sa dimension');
   const avant=await db.getSnapshot();saisie(champ(root,'tags'),'   ');champ(root,'tags').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await root.attendreEcritures();
   eq(bouton(root,'ajouter-tags').disabled,true,'Suggestions : espaces seuls ne proposent aucun geste');eq(await db.getSnapshot(),avant,'Suggestions : saisie vide ne change pas le brouillon');
   saisie(champ(root,'tags'),'PÁINS');bouton(root,'ajouter-tags').click();await root.attendreEcritures();
   eq(champ(root,'tags').value,'PÁINS','Suggestions : doublon conserve le texte à corriger');ok(etat(root,'tags').includes('déjà'),'Suggestions : doublon normalisé expliqué');eq(await db.getSnapshot(),avant,'Suggestions : doublon ne touche ni provenance ni propositions ni file');
   saisie(champ(root,'tags'),'a'.repeat(81));bouton(root,'ajouter-tags').click();await root.attendreEcritures();
   eq(champ(root,'tags').value,'a'.repeat(81),'Suggestions : valeur trop longue non effacée');ok(etat(root,'tags').includes('80'),'Suggestions : borne de longueur annoncée');
   saisie(champ(root,'tags'),'Viennoiseries');champ(root,'tags').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await root.attendreEcritures();
   eq(root.etatRoute().brouillon.fields.tags,['Pains','Viennoiseries'],'Suggestions : Entrée ajoute une seule valeur manuelle');eq(champ(root,'tags').value,'','Suggestions : saisie vidée après conservation réussie');
   eq((await repo.get('imports',row.id)).brouillon.fields.tags,['Pains','Viennoiseries'],'Suggestions : ajout manuel réellement conservé');
   eq(root.etatRoute().brouillon.provenance.tags.values.Pains.origin,'suggestion','Suggestions : ajout manuel préserve la provenance précédente');
  }finally{f.fermer();}});
  await withRepo(async(repo,db)=>{const f=await monter(repo,db),{root,row}=f;try{
   ok(!!proposition(root,'tags','Tartes'),'Suggestions : vraie proposition absente dotée d’un ajout');
   eq(proposition(root,'tags','Pains')??null,null,'Suggestions : aucune proposition d’ajout pour une valeur retenue');
   eq(proposition(root,'tags','Sans gluten')??null,null,'Suggestions : valeur incertaine non transformée en action');
   proposition(root,'tags','Tartes')?.click();await root.attendreEcritures();
   eq(root.etatRoute().brouillon.fields.tags,['Pains','Tartes'],'Suggestions : accepter ajoute sans remplacer la liste');
   ok(!!proposition(root,'tags','Soupes')&&!proposition(root,'tags','Tartes'),'Suggestions : seule proposition consommée disparaît');
   eq(root.etatRoute().brouillon.provenance.tags.values?.Tartes?.sources?.[0]?.href,SOURCE,'Suggestions : ajout proposé conserve sa source');
   proposition(root,'preparations','Cuisson douce')?.click();await root.attendreEcritures();
   eq(root.etatRoute().brouillon.fields.cuisine_facets,{origines:['Française'],styles:['Maison'],preparations:['Rôtis','Cuisson douce']},'Suggestions : ajout de facette préserve les autres dimensions');
   eq(root.etatRoute().brouillon.fields.cuisines,['Française','Maison','Rôtis','Cuisson douce'],'Suggestions : union historique des cuisines conservée');
   eq(root.etatRoute().brouillon.fields.title,'Mon livre','Suggestions : proposition de titre ne remplace rien implicitement');
   ok(!!bouton(root,'utiliser-title')&&!bouton(root,'utiliser-tags')&&!bouton(root,'utiliser-cuisine_facets'),'Suggestions : remplacement explicite réservé aux champs simples');
   groupe(root,'tags').querySelector('[aria-label="Retirer Tartes"]')?.click();await root.attendreEcritures();
   eq(root.etatRoute().brouillon.fields.tags,['Pains'],'Suggestions : retrait effectif de la valeur retenue');
   eq(root.etatRoute().brouillon.provenance.tags.values?.Pains?.origin,'suggestion','Suggestions : retrait préserve la provenance restante');
   bouton(root,'enregistrer-livre').click();await root.attendreEcritures();
   const saved=await repo.get('imports',row.id),edition=await repo.get('book_editions',saved.edition_id),book=edition?await repo.get('books',edition.book_id):null;
   eq(book?.cuisine_facets?.preparations,['Rôtis','Cuisson douce'],'Suggestions : ajout proposé dans la fiche finale');eq(book?.tags,['Pains'],'Suggestions : retrait conservé dans la fiche finale');
   if(edition){const reprise=await renderLivreSansSaisieRoute({},{edition:edition.id},{books:[book]},{repo,fetch:async()=>{throw Error('interdit');}});document.body.append(reprise);try{eq(reprise.etatRoute().brouillon.fields.cuisine_facets.preparations,['Rôtis','Cuisson douce'],'Suggestions : réouverture retrouve les valeurs finales');}finally{reprise.dispose();reprise.remove();}}else ok(false,'Suggestions : réouverture retrouve les valeurs finales');
  }finally{f.fermer();}});
  await withRepo(async(repo,db)=>{let d=B.modifierChampLivre(B.brouillonLivre(),'title','Bornes');d=B.modifierChampLivre(d,'tags',Array.from({length:20},(_,i)=>'Valeur '+i));const f=await monter(repo,db,d);try{
   const input=champ(f.root,'tags'),avant=await db.getSnapshot();saisie(input,'Une vingt-et-unième');bouton(f.root,'ajouter-tags').click();await f.root.attendreEcritures();
   eq(input.value,'Une vingt-et-unième','Suggestions : liste pleine conserve le texte');ok(etat(f.root,'tags').includes('20'),'Suggestions : limite de liste expliquée');eq(await db.getSnapshot(),avant,'Suggestions : limite ne réécrit pas le brouillon');
   groupe(f.root,'tags').querySelector('[aria-label="Retirer Valeur 0"]').click();await f.root.attendreEcritures();saisie(input,'🍞'.repeat(80));bouton(f.root,'ajouter-tags').click();await f.root.attendreEcritures();
   ok(f.root.etatRoute().brouillon.fields.tags.includes('🍞'.repeat(80)),'Suggestions : borne inclusive de80 points de code');eq(f.root.etatRoute().brouillon.fields.tags.length,20,'Suggestions :20 valeurs conservées sans troncature');
  }finally{f.fermer();}});
  await withRepo(async(repo,db)=>{
   let d=B.modifierChampLivre(B.brouillonLivre(),'title','Union des cuisines');
   d=B.modifierChampLivre(d,'cuisine_facets',{origines:['Française'],styles:[],preparations:[]});
   d=B.modifierChampLivre(d,'cuisines',['Française',...Array.from({length:19},(_,i)=>'Cuisine '+i)]);
   const f=await monter(repo,db,d);try{
    const avant=await db.getSnapshot(),input=champ(f.root,'preparations');saisie(input,'Nouvelle famille');bouton(f.root,'ajouter-preparations').click();await f.root.attendreEcritures();
    eq(etat(f.root,'preparations'),'Les cuisines contiennent déjà 20 valeurs. Retire une cuisine avant d’ajouter cette catégorie.','Suggestions : limite de l’union nommée sans prétendre que la facette est pleine');
    eq(input.value,'Nouvelle famille','Suggestions : union pleine conserve le texte saisi');
    eq(await db.getSnapshot(),avant,'Suggestions : nouvelle facette ne tronque pas les autres cuisines');
    saisie(input,'Française');bouton(f.root,'ajouter-preparations').click();await f.root.attendreEcritures();
    eq(f.root.etatRoute().brouillon.fields.cuisine_facets,{origines:['Française'],styles:[],preparations:['Française']},'Suggestions : même libellé permis dans des dimensions distinctes');
    eq(f.root.etatRoute().brouillon.fields.cuisines,d.fields.cuisines,'Suggestions : ajout déjà dans l’union préserve ses20 valeurs et leur ordre');
   }finally{f.fermer();}
  });
  await withRepo(async(repo,db)=>{let ecrire=(...args)=>repo.saveBatch(...args);const facade={...repo,saveBatch:(...args)=>ecrire(...args)},f=await monter(facade,db);let refuser;const attente=new Promise((_,reject)=>{refuser=reject;});let atteint=false;ecrire=async(...args)=>{atteint=true;return attente;};try{
   saisie(champ(f.root,'tags'),'Saisi malgré le quota');bouton(f.root,'ajouter-tags').click();await attendre(()=>atteint,'Commit du brouillon attendu');
   ok(f.root.querySelector('[data-role=conservation-brouillon-livre]')?.textContent.includes('Sauvegarde en cours'),'Suggestions : état pendant écriture réellement suspendue');
   ok(!(await repo.get('imports',f.row.id)).brouillon.fields.tags.includes('Saisi malgré le quota'),'Suggestions : avant commit la nouvelle valeur n’est pas durable');
   refuser(new DOMException('Quota simulé','QuotaExceededError'));await f.root.attendreEcritures().catch(()=>{});
   ok(f.root.querySelector('[data-role=conservation-brouillon-livre]')?.textContent.includes('n’a pas pu être sauvegardé'),'Suggestions : refus de stockage explicite');
   eq(champ(f.root,'tags').value,'Saisi malgré le quota','Suggestions : texte conservé après refus d’écriture');
   ecrire=(...args)=>repo.saveBatch(...args);bouton(f.root,'reessayer-brouillon-livre')?.click();await f.root.attendreEcritures().catch(()=>{});
   ok((await repo.get('imports',f.row.id)).brouillon.fields.tags.includes('Saisi malgré le quota'),'Suggestions : réessai conserve sans nouvel ajout ni réseau');
   ok(f.root.querySelector('[data-role=conservation-brouillon-livre]')?.textContent.includes('Brouillon sauvegardé'),'Suggestions : succès annoncé uniquement après la transaction');
   eq(etat(f.root,'tags'),'','Suggestions : réessai réussi sans ancien message local de sauvegarde refusée');
  }finally{ecrire=(...args)=>repo.saveBatch(...args);f.fermer();}});
  await withRepo(async(repo,db)=>{
   const appels=[];let rejeter=false;const notifications=[];
   const f=await monter(repo,db,fixtureSuggestionsLivre(),{pickFiles:options=>{appels.push(options);return rejeter?Promise.reject(Error('Sélecteur indisponible')):Promise.resolve([]);},toast:s=>notifications.push(s)});
   try{
    const avant=await db.getSnapshot();
    for(const [role,capture] of [['photo-livre','environment'],['image-livre',null],['changer-couverture',null]]){
     const n=appels.length;bouton(f.root,role).click();
     eq(appels.length,n+1,`Livre I2 ${role} : sélecteur appelé avant le retour du clic`);
     await f.root.attendreEcritures();
     eq(appels.at(-1),{accept:'image/*',multiple:false,capture},`Livre I2 ${role} : options conservées et annulation terminée`);
    }
    eq(await db.getSnapshot(),avant,'Livre I2 : annulations des sélecteurs sans écriture');
    rejeter=true;bouton(f.root,'photo-livre').click();await f.root.attendreEcritures();
    eq(f.root.querySelector('[data-role=etat-livre]').textContent,'Cette image ne peut pas être lue ici. Essaie une autre photo.','Livre I2 : rejet asynchrone du sélecteur expliqué');
    eq(await db.getSnapshot(),avant,'Livre I2 : rejet du sélecteur sans écriture');
    rejeter=false;const n=appels.length;bouton(f.root,'photo-livre').click();eq(appels.length,n+1,'Livre I2 : nouveau clic possible après rejet');await f.root.attendreEcritures();
    eq(notifications,[],'Livre I2 : annulation et refus pris en charge sans erreur générique');
   }finally{f.fermer();}
  });
 }finally{css.remove();setUiLocale(locale);}
}
