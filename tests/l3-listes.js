import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderLibrary } from '../src/ui/library.js';
import { renderBook } from '../src/ui/book.js';
const attendre=async f=>{for(let i=0;i<200;i++){if(await f())return;await new Promise(r=>setTimeout(r,5));}throw Error('Affichage attendu absent');};
const change=(el,value)=>{el.value=value;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
const ids=n=>[...n.querySelectorAll('.bibliotheque-item')].map(x=>x.dataset.navId);
export async function runL3ListesTests({eq,ok}){
  await withRepo(async(repo,db)=>{
    const recipes=Array.from({length:125},(_,i)=>({id:'r'+String(i).padStart(3,'0'),edition_id:'ed',original_title:'Recette '+String(i).padStart(3,'0'),availability:i===0?'available':i===1?'partial':i===2?'inconnue':'reference_only',favorite:i<2,current_version_id:i===0?'v0':null}));
    await db.mutate({puts:{books:[{id:'b',title:'Livre L3'}],book_editions:[{id:'ed',book_id:'b'}],recipes,recipe_versions:[{id:'v0',recipe_id:'r000',ingredients:[{name_text:'Sel'}],steps:[{text:'Cuire.'}]}]}});
    const ctx=await getData(true);let root=await renderLibrary({},{},ctx);document.body.append(root);
    try{
      eq(ids(root).length,60,'L3 listes : première page 60 références comprises');
      const more=root.querySelector('[data-role=voir-plus]');ok(more,'L3 listes : voir plus accessible');if(!more)return;
      more.click();await attendre(()=>ids(root).length===120);eq(ids(root).length,120,'L3 listes : deuxième page 120');
      root.querySelector('[data-role=voir-plus]').click();await attendre(()=>ids(root).length===125);eq(new Set(ids(root)).size,125,'L3 listes : dernière page sans doublon');
      const before=ids(root);change(root.querySelector('[name=presentation]'),'liste');await attendre(()=>root.querySelector('.bibliotheque-liste'));eq(ids(root),before,'L3 listes : bascule conserve identités et pagination');
      change(root.querySelector('[name=q]'),'Recette 12');await attendre(()=>ids(root).length===5);eq(ids(root),['r120','r121','r122','r123','r124'],'L3 listes : filtre exact sans résultat caché');
      root.querySelector('[data-role=effacer-filtres]').click();await attendre(()=>ids(root).length===60);eq(root.querySelector('[name=presentation]').value,'liste','L3 listes : effacer conserve présentation');
      eq(root.querySelector('.bibliotheque-selection').hidden,true,'L3 listes : lecture sans barre de sélection');
      root.querySelector('[data-role=mode-selection]').click();await root.querySelector('.bibliotheque-resultats').attendreAffichage();
      const select=root.querySelector('[data-role=selectionner-affiches]');select.click();await attendre(()=>root.querySelectorAll('.selection-recette input:checked').length===60);eq(root.querySelectorAll('.selection-recette input:checked').length,60,'L3 listes : sélectionner borné à affichés');
      root.querySelector('[data-role=mode-selection]').click();await root.querySelector('.bibliotheque-resultats').attendreAffichage();eq([root.querySelector('.bibliotheque-selection').hidden,root.querySelectorAll('.selection-recette input:checked').length],[true,0],'L3 listes : annuler masque et vide sélection');
      root.querySelector('[data-role=mode-selection]').click();await root.querySelector('.bibliotheque-resultats').attendreAffichage();
      root.querySelector('[data-role=selectionner-affiches]').click();await root.querySelector('.bibliotheque-resultats').attendreAffichage();
      change(root.querySelector('[name=presentation]'),'grille');await root.querySelector('.bibliotheque-resultats').attendreAffichage();
      eq([root.querySelector('.bibliotheque-selection').hidden,root.querySelectorAll('.selection-recette input:checked').length],[false,60],'L3 listes : changer présentation conserve mode et sélection');
      root.querySelector('[data-role=voir-plus]').click();await root.querySelector('.bibliotheque-resultats').attendreAffichage();
      eq([root.querySelector('.bibliotheque-selection').hidden,root.querySelectorAll('.selection-recette input:checked').length],[false,60],'L3 listes : voir plus conserve mode et sélection sans sélectionner les nouvelles recettes');
      change(root.querySelector('[name=q]'),'Recette 12');await attendre(()=>ids(root).length===5);eq(root.querySelectorAll('.selection-recette input:checked').length,0,'L3 listes : filtre abandonne sélection');
      eq([root.querySelector('.bibliotheque-selection').hidden,root.querySelectorAll('.selection-recette:not([hidden])').length,root.querySelector('[data-role=mode-selection]').textContent],[true,0,'Sélectionner'],'L3 listes : changement de filtre ferme barre et cases du mode sélection');
      change(root.querySelector('[name=q]'),'aucune');await attendre(()=>ids(root).length===0);
      ok(root.textContent.includes('Aucune recette ne correspond.'),'L3 listes : vide filtré explicite');
    }finally{root.remove();}
    root=await renderLibrary({},{tab:'books'},ctx);document.body.append(root);
    try{ok(!root.textContent.includes('Liens web gardés')&&!root.textContent.includes('Recettes créées avec l’IA'),'L3 Livres : seulement livres');ok(root.textContent.includes('1 partielle')&&root.textContent.includes('1 état(s) inconnu'),'L3 Livres : compteurs réels séparés');}finally{root.remove();}
    root=await renderBook({id:'ed'},{},ctx);document.body.append(root);
    try{
      ok([...root.querySelectorAll('a,button')].some(a=>a.textContent==='Modifier le livre'),'L3 livre : modifier visible');
      eq(ids(root).length,60,'L3 livre : même pagination bornée');
      ok(root.querySelector('[data-role=compte-recettes]').textContent.includes('1 partielle'),'L3 livre : partielle séparée');
      change(root.querySelector('[name=q]'),'Recette 12');await attendre(()=>ids(root).length===5);
      root.querySelector('[data-role=ouvrir-pages-source]').click();ok(!root.querySelector('[data-role=pages-source]').hidden,'L3 livre : pages source ouvertes');
      root.querySelector('[data-role=ouvrir-recettes]').click();eq(root.querySelector('[name=q]').value,'Recette 12','L3 livre : sous-onglet garde filtre recettes');
    }finally{root.remove();}
  });
  await withRepo(async(repo,db)=>{
    const recipes=[{id:'a',original_title:'A',availability:'reference_only'},{id:'b',original_title:'B',availability:'reference_only'}];await db.mutate({puts:{recipes}});
    const ctx=await getData(true),root=await renderLibrary({},{},ctx,{confirmDialog:async()=>true});document.body.append(root);
    try{
      root.querySelector('[data-role=mode-selection]').click();await root.querySelector('.bibliotheque-resultats').attendreAffichage();
      root.querySelector('[data-role=selectionner-affiches]').click();await root.querySelector('.bibliotheque-resultats').attendreAffichage();
      await db.mutate({origin:'remote',puts:{recipes:[{...recipes[1],original_title:'B corrigée ailleurs',personal_notes:'Nouvelle note reçue'}]}});
      root.querySelector('[data-role=retirer-selection]').click();await root.querySelector('.bibliotheque-resultats').attendreAffichage();
      eq([(await repo.get('recipes','a')).trashed_at!=null,(await repo.get('recipes','b')).trashed_at??null],[true,null],'L3 sélection : un retrait valide et un refus concurrent');
      ok(root.querySelector('.bibliotheque-selection [role=status]').textContent.includes('1 effectuée(s), 1 refusée(s), 0 non traitée(s).'),'L3 sélection : bilan partiel honnête');
      eq([...root.querySelectorAll('.selection-recette input:checked')].map(x=>x.value),['b'],'L3 sélection : seul refus conservé sélectionné');
      const cycle=(await repo.get('recipes','a')).lifecycle_id;root.querySelector('[data-role=retirer-selection]').click();await root.querySelector('.bibliotheque-resultats').attendreAffichage();
      eq((await repo.get('recipes','a')).lifecycle_id,cycle,'L3 sélection : réessai ne rejoue pas succès');
      eq((await repo.get('recipes','b')).personal_notes,'Nouvelle note reçue','L3 sélection : note concurrente intacte');
    }finally{root.remove();}
  });
  await withRepo(async(repo,db)=>{
    const r={id:'quitter',original_title:'Recette quittée',availability:'reference_only'};await db.mutate({puts:{recipes:[r]}});
    let confirmer;const attente=new Promise(resolve=>{confirmer=resolve;});
    const root=await renderLibrary({},{},await getData(true),{confirmDialog:()=>attente});document.body.append(root);
    const liste=root.querySelector('.bibliotheque-resultats');
    root.querySelector('[data-role=mode-selection]').click();await liste.attendreAffichage();root.querySelector('[data-role=selectionner-affiches]').click();await liste.attendreAffichage();
    root.querySelector('[data-role=retirer-selection]').click();root.remove();confirmer(true);await liste.attendreAffichage();
    eq((await repo.get('recipes',r.id)).trashed_at??null,null,'L3 sélection : route quittée pendant confirmation arrête les commandes');
  });
  await withRepo(async(repo,db)=>{
    await db.mutate({puts:{books:[{id:'livre-memoire',title:'Livre mémoire'}],book_editions:[{id:'memoire',book_id:'livre-memoire'}],recipes:[{id:'recette-memoire',edition_id:'memoire',original_title:'Soupe',availability:'reference_only'}],source_pages:[{id:'page-memoire',edition_id:'memoire',printed_page:24,sha256:'1'.repeat(64)}]}});
    const N=await import('../src/ui/navigation-contexte.js'),ctx=await getData(true),route='/books/memoire',portee=N.porteeNavigation(ctx);
    N.activerEntree({route,portee,cleEntree:crypto.randomUUID(),query:{}});
    let root=await renderBook({id:'memoire'},{},ctx);document.body.append(root);
    change(root.querySelector('[name=q]'),'Soupe');await root.querySelector('.bibliotheque-resultats').attendreAffichage();
    root.querySelector('[data-role=ouvrir-pages-source]').click();change(root.querySelector('[name=qSources]'),'24');root.remove();
    root=await renderBook({id:'memoire'},{},ctx);document.body.append(root);
    try{eq([root.querySelector('[data-role=pages-source]').hidden,root.querySelector('[name=qSources]').value,root.querySelector('[name=q]').value],[false,'24','Soupe'],'L3 livre : remonter depuis Sources garde les deux recherches indépendantes');}
    finally{root.remove();N.invaliderNavigation({motif:'fin_test_liste'});}
  });
}
