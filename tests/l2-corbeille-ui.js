import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderBook, supprimerLivreVide } from '../src/ui/book.js';
import { renderLibrary } from '../src/ui/library.js';
import { renderRecipe } from '../src/ui/recipe.js';
import { renderCorbeille, panneauCycleLivre, panneauCycleRecette } from '../src/ui/corbeille.js';
import { mettreLivreALaCorbeille, restaurerLivre } from '../src/domain/corbeille-livres.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';

const date='2026-10-29T12:00:00.000Z';
const edition=(id,mode=null)=>({id,book_id:'livre-l2',...(mode?{lifecycle_id:`cycle-${id}`,trashed_at:date,trash_mode:mode}:{})});
const recette=(id,ed,plus={})=>({id,edition_id:ed,original_title:id,original_language:'fr',availability:'available',current_version_id:`v-${id}`,source_page_ids:[],...plus});
const version=r=>({id:r.current_version_id,recipe_id:r.id,kind:'extraction',servings:2,ingredients:[{id:'sel',source_text:'Sel',name_text:'Sel'}],steps:[{id:`s-${r.id}`,position:1,text:'Remuer.',timers:[]}]});
const bouton=(root,texte)=>[...root.querySelectorAll('button')].find(b=>b.textContent===texte);
const attendre=async fn=>{for(let i=0;i<120;i++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Résultat non observé');};
const monter=root=>{document.body.append(root);return()=>{root.dispose?.();root.remove();};};
async function base(db,eds,rs,autres={}){await db.mutate({origin:'remote',puts:{books:[{id:'livre-l2',title:'Livre témoin L2',author:'Auteure'}],book_editions:eds,recipes:rs,recipe_versions:rs.map(version),...autres}});}

export async function runL2CorbeilleUiTests({eq,ok}){
  const locale=getUiLocale();setUiLocale('fr');
  // La page /tests ne charge que tests.css ; la mesure de couverture doit utiliser le vrai CSS de l’application.
  const feuille = document.createElement('link');feuille.rel='stylesheet';feuille.href=new URL('../styles.css',import.meta.url).href;
  await new Promise((resolve,reject)=>{feuille.onload=resolve;feuille.onerror=()=>reject(Error('Styles de l’application non chargés'));document.head.append(feuille);});
  const run=async(nom,fn)=>{try{await fn();}catch(e){ok(false,`L2 UI ${nom} : ${e.stack||e}`);}};
  try{
    await run('projections effectives',()=>withRepo(async(repo,db)=>{
      const eds=[edition('active'),edition('gardee','keep_recipes'),edition('groupe','with_recipes')];
      const rs=[recette('r-active','active'),recette('r-gardee','gardee'),recette('r-groupe','groupe'),recette('r-exception','groupe',{restored_from_edition:{edition_id:'groupe',lifecycle_id:'cycle-groupe'}}),recette('r-absente','absente'),recette('r-propre','active',{lifecycle_id:'cycle-propre',trashed_at:date})];
      await base(db,eds,rs);const ctx=await getData(true);
      eq(ctx.recettesActives.map(r=>r.id).sort(),['r-active','r-exception','r-gardee'],'L2 projections : seuls membres effectivement actifs sélectionnables');
      eq(ctx.docsActifs.map(d=>d.recipe.id).sort(),['r-active','r-exception','r-gardee'],'L2 recherche : même projection effective');
      eq(ctx.editionsActives?.map(e=>e.id),['active'],'L2 livres : seule édition active dans les nouveaux choix');
      eq([ctx.recipesById.size,ctx.editionsById.size,ctx.docsByRecipe.size],[6,3,6],'L2 historique : maps exhaustives conservées');
      const root=await renderLibrary({},{tab:'books'},ctx),fin=monter(root);
      try{eq([...root.querySelectorAll('a[href^="#/books/"]')].map(a=>a.getAttribute('href')),['#/books/active'],'L2 bibliothèque : éditions retirées absentes de Livres');}finally{fin();}
    }));
    await run('livre retiré consultable',()=>withRepo(async(repo,db)=>{
      const ed=edition('groupe','with_recipes'),r=recette('membre','groupe',{personal_notes:'Note conservée'});await base(db,[ed],[r]);
      const root=await renderBook({id:ed.id},{},await getData(true)),fin=monter(root);
      try{
        ok(root.textContent.includes('Livre dans la corbeille'),'L2 livre : état retiré visible');
        ok(bouton(root,'Restaurer le livre'),'L2 livre : restauration explicite accessible');
        eq(root.querySelectorAll('a[href^="#/recipes/new"],a[href^="#/add/livre"],input,textarea').length,0,'L2 livre : administration et ajout absents de la consultation');
        ok([...root.querySelectorAll('a')].some(a=>a.getAttribute('href')==='#/recipes/membre'),'L2 livre : membre encore consultable');
        ok(root.querySelector('.cover-wrap').getBoundingClientRect().width<=201,'L2 livre : couverture historique bornée pour laisser les recettes accessibles');
        eq(await repo.get('book_editions',ed.id),ed,'L2 livre : lecture sans restauration');
      }finally{fin();}
    }));
    await run('membre hérité et source gardée',()=>withRepo(async(repo,db)=>{
      const ed=edition('groupe','with_recipes'),r=recette('membre','groupe',{personal_notes:'Note conservée'});await base(db,[ed],[r]);
      let root=await renderRecipe({id:r.id},{},await getData(true)),fin=monter(root);
      try{
        ok(root.textContent.includes('Recette dans la corbeille avec son livre'),'L2 membre : origine du retrait indiquée');
        ok(bouton(root,'Restaurer cette recette'),'L2 membre : restauration seule proposée');
        ok(!bouton(root,'Commencer à cuisiner')&&!bouton(root,'Modifier mes notes'),'L2 membre : aucun nouvel usage ou modification permanente');
      }finally{fin();}
      await db.mutate({origin:'remote',puts:{book_editions:[{...ed,trash_mode:'keep_recipes'}]}});
      root=await renderRecipe({id:r.id},{},await getData(true));fin=monter(root);
      try{
        ok(root.textContent.includes('Livre dans la corbeille'),'L2 source : livre retiré signalé sur recette gardée');
        ok(bouton(root,'Commencer à cuisiner')&&bouton(root,'Modifier mes notes'),'L2 recette gardée : contenu actif utilisable');
        ok([...root.querySelectorAll('a')].some(a=>a.getAttribute('href')==='#/books/groupe'),'L2 source : attribution et accès au livre conservés');
      }finally{fin();}
    }));
    await run('corbeille groupée',()=>withRepo(async(repo,db)=>{
      const ed=edition('groupe','with_recipes');
      const rs=[recette('heritee','groupe'),recette('individuelle','groupe',{lifecycle_id:'cycle-individuel',trashed_at:date}),recette('seule','groupe',{restored_from_edition:{edition_id:'groupe',lifecycle_id:'cycle-groupe'}})];
      await base(db,[ed],rs);const root=await renderCorbeille({},{},await getData(true)),fin=monter(root);
      try{
        eq(root.querySelectorAll('[data-role=livre-corbeille]').length,1,'L2 corbeille : une entrée de groupe pour l’édition');
        ok(root.textContent.includes('heritee')&&root.textContent.includes('individuelle')&&root.textContent.includes('seule'),'L2 groupe : membres et exceptions visibles');
        eq(root.querySelectorAll('[data-role=recette-corbeille] [href="#/recipes/heritee"]').length,0,'L2 corbeille : membre hérité non répété hors groupe');
        ok(!root.textContent.includes('La corbeille est vide.'),'L2 corbeille : pas de faux état vide avec livre retiré');
      }finally{fin();}
    }));
    await run('ancien C09 sans destruction',()=>withRepo(async(repo,db)=>{
      const ed=edition('vide'),journal={id:'journal-l2',edition_id:ed.id,status:'statut-inconnu',reponse_brute:'Résultat conservé'};
      await base(db,[ed],[],{imports:[journal]});
      const avant=await repo.all('imports');const res=await supprimerLivreVide({book:await repo.get('books','livre-l2'),edition:ed},{repo});
      ok(!!res.refus,'L2 C09 : ancien appel physique refusé');
      eq([await repo.get('book_editions',ed.id),await repo.all('imports')],[ed,avant],'L2 C09 : édition et import inconnu conservés sans détachement');
    }));
    await run('dialogue et annulation',()=>withRepo(async(repo,db)=>{
      const ed=edition('choix'),rs=[recette('disponible',ed.id),recette('partielle',ed.id,{availability:'partial'}),recette('reference',ed.id,{availability:'reference_only'}),recette('retiree',ed.id,{lifecycle_id:'cycle-r',trashed_at:date})];
      const imports=['a_lancer','en_cours','inconnu','enregistre'].map((status,i)=>({id:`imp-${i}`,edition_id:ed.id,status,reponse_brute:'Conservée'}));
      await base(db,[ed],rs,{imports,source_pages:[{id:'page-choix',edition_id:ed.id}]});
      const root=await panneauCycleLivre(ed,await getData(true)),fin=monter(root),avant=await repo.all('imports');
      try{
        bouton(root,'Mettre à la corbeille').click();await attendre(()=>document.querySelector('[data-role=dialogue-corbeille-livre]'));
        const dlg=document.querySelector('[data-role=dialogue-corbeille-livre]');
        eq([...dlg.querySelectorAll('[data-role=bilan-retrait-livre] li')].map(n=>n.textContent),['1 recette(s) disponible(s)','1 recette(s) partielle(s)','1 référence(s)','1 recette(s) déjà retirée(s)','1 page(s) source','1 import(s) ouvert(s)','1 import(s) en cours','1 import(s) à l’état à vérifier'],'L2 dialogue : comptages réels et import inconnu nommé');
        ok(bouton(dlg,'Retirer le livre, garder mes recettes')&&bouton(dlg,'Mettre le livre et ses recettes dans la corbeille'),'L2 dialogue : deux conséquences explicites');
        dlg.dispatchEvent(new Event('cancel',{cancelable:true}));await attendre(()=>!document.querySelector('[data-role=dialogue-corbeille-livre]'));
        eq([await repo.get('book_editions',ed.id),await repo.all('imports')],[ed,avant],'L2 Échap : aucune mutation ni réponse payée effacée');
        await attendre(()=>document.activeElement===bouton(root,'Mettre à la corbeille'));
        eq(document.activeElement,bouton(root,'Mettre à la corbeille'),'L2 dialogue : focus revenu au bouton après Échap');
      }finally{fin();document.querySelector('[data-role=dialogue-corbeille-livre]')?.remove();}
    }));
    for(const mode of ['keep_recipes','with_recipes'])await run('retrait '+mode,()=>withRepo(async(repo,db)=>{
      const ed=edition('mode-'+mode),r=recette('membre-'+mode,ed.id);await base(db,[ed],[r]);
      let resultat=null;const root=await panneauCycleLivre(ed,await getData(true),{apres:(e,res)=>{resultat=res;}}),fin=monter(root);
      try{
        bouton(root,'Mettre à la corbeille').click();await attendre(()=>document.querySelector('[data-role=dialogue-corbeille-livre]'));
        document.querySelector(mode==='keep_recipes'?'[data-role=retirer-livre-garder-recettes]':'[data-role=retirer-livre-avec-recettes]').click();await attendre(()=>resultat);
        eq((await repo.get('book_editions',ed.id)).trash_mode,mode,`L2 ${mode} : choix réellement enregistré`);
        eq((await getData(true)).recettesActives.map(x=>x.id),mode==='keep_recipes'?[r.id]:[],`L2 ${mode} : effet visible exact sur nouveaux choix`);
        eq(await repo.get('recipes',r.id),r,`L2 ${mode} : aucune cascade de marqueurs ou détachement`);
        const apres=await repo.get('book_editions',ed.id);let restauree=false;
        const undo=await panneauCycleLivre(apres,await getData(true),{apres:()=>{restauree=true;}}),nettoyer=monter(undo);
        try{ok(bouton(undo,'Annuler'),`L2 ${mode} : Annuler proposé après écriture`);bouton(undo,'Annuler').click();await attendre(()=>restauree);eq((await repo.get('book_editions',ed.id)).trashed_at,null,`L2 ${mode} : Annuler restaure durablement`);}finally{nettoyer();}
      }finally{fin();}
    }));
    await run('bilan changé avant écriture',()=>withRepo(async(repo,db)=>{
      const ed=edition('race'),r=recette('r-race',ed.id);await base(db,[ed],[r]);
      let passages=0,termine=false;const root=await panneauCycleLivre(ed,await getData(true),{mettreLivreALaCorbeille:async(e,options)=>{
        if(++passages===1)await db.mutate({origin:'remote',puts:{source_pages:[{id:'page-tardive',edition_id:ed.id}]}});
        return mettreLivreALaCorbeille(e,options);
      },apres:()=>{termine=true;}}),fin=monter(root);
      try{
        bouton(root,'Mettre à la corbeille').click();await attendre(()=>document.querySelector('[data-role=dialogue-corbeille-livre]'));
        document.querySelector('[data-role=retirer-livre-avec-recettes]').click();await attendre(()=>document.querySelector('[data-role=dialogue-corbeille-livre]')?.textContent.includes('nouveaux nombres'));
        eq(await repo.get('book_editions',ed.id),ed,'L2 race : bilan périmé refusé sans retrait partiel');
        ok(document.querySelector('[data-role=bilan-retrait-livre]').textContent.includes('1 page(s) source'),'L2 race : nouveau bilan montré avant de reprendre le choix');
        document.querySelector('[data-role=retirer-livre-avec-recettes]').click();await attendre(()=>termine);
        eq(passages,2,'L2 race : deuxième geste explicite exigé');
      }finally{fin();document.querySelector('[data-role=dialogue-corbeille-livre]')?.remove();}
    }));
    await run('membre seul et restauration du groupe',()=>withRepo(async(repo,db)=>{
      const ed=edition('restauration','with_recipes'),rs=[recette('heritage',ed.id),recette('propre',ed.id,{lifecycle_id:'cycle-propre',trashed_at:date}),recette('autre',ed.id)];await base(db,[ed],rs);
      let seul=false;const root=await panneauCycleRecette(rs[0],await getData(true),{apres:()=>{seul=true;}}),fin=monter(root);
      try{bouton(root,'Restaurer cette recette').click();await attendre(()=>seul);
        eq(await repo.get('book_editions',ed.id),ed,'L2 membre : restauration seule ne restaure pas le livre');
        const r=await repo.get('recipes',rs[0].id);eq([r.edition_id,r.restored_from_edition],[ed.id,{edition_id:ed.id,lifecycle_id:ed.lifecycle_id}],'L2 membre : provenance intacte et exception exacte');
        let resultat=null;const livre=await panneauCycleLivre(ed,await getData(true),{apres:(_,res)=>{resultat=res;}}),nettoyer=monter(livre);
        try{bouton(livre,'Restaurer le livre').click();await attendre(()=>resultat);eq(resultat.bilanRestauration,{retablies:1,dejaActives:1,laisseesRetirees:1,invalides:0},'L2 restauration : bilan distingue rétablie, exception active et retrait propre');
          eq((await getData(true)).recettesActives.map(r=>r.id).sort(),['autre','heritage'],'L2 restauration : retrait individuel reste retiré');
        }finally{nettoyer();}
      }finally{fin();}
    }));
    await run('capacité liée aux données',()=>withRepo(async(repo,db)=>{
      const ed=edition('capacite');await base(db,[ed],[]);await db.put('sync_state',{key:'user_id',value:'owner-l2'});await db.put('sync_state',{key:'lifecycle-capability:owner-l2',value:{protocol:1}});
      const ctx={...await getData(true),sync:{user:null,moteur:null}};
      let root=await panneauCycleLivre(ed,ctx);ok(bouton(root,'Mettre à la corbeille').disabled,'L2 capacité : seule capacité recette insuffisante même déconnecté');
      await db.put('sync_state',{key:'edition-lifecycle-capability:owner-l2',value:{protocol:1}});root=await panneauCycleLivre(ed,ctx);
      ok(!bouton(root,'Mettre à la corbeille').disabled,'L2 capacité : confirmation édition du propriétaire autorise local hors ligne');
    }));
    await run('compte changé dans le dialogue',()=>withRepo(async(repo,db)=>{
      const ed=edition('compte'),r=recette('r-compte',ed.id);await base(db,[ed],[r]);
      const root=await panneauCycleLivre(ed,await getData(true)),fin=monter(root);
      try{bouton(root,'Mettre à la corbeille').click();await attendre(()=>document.querySelector('[data-role=dialogue-corbeille-livre]'));
        await db.put('sync_state',{key:'user_id',value:'autre-owner'});document.querySelector('[data-role=retirer-livre-avec-recettes]').click();
        await attendre(()=>document.querySelector('[data-role=dialogue-corbeille-livre]')?.textContent.includes('retrait a échoué'));
        eq(await repo.get('book_editions',ed.id),ed,'L2 compte : le dialogue ne peut adopter un nouveau propriétaire');
        bouton(document.querySelector('[data-role=dialogue-corbeille-livre]'),'Annuler').click();
      }finally{fin();}
    }));
    await run('conflit édition consultable',async()=>{
      const S=await import('../src/ui/settings.js'),conflit={id:'cycle-edition-ui',kind:'cycle',store:'book_editions',record_id:'ed-conflit',local:{id:'ed-conflit',book_id:'livre-conflit',trash_mode:'with_recipes'}};
      const model=S.syncSectionModel({available:true,user:{id:'compte'},guard:{ok:true},moteur:{enCours:false},conflits:[conflit]});
      const root=document.createElement('div');root.append(...S.syncSectionL3(model,{abandonnerConflitCycle:()=>{}}));
      ok(root.querySelector('pre')?.textContent.includes('with_recipes'),'L2 conflit : copie du retrait d’édition consultable');
      ok([...root.querySelectorAll('a')].some(a=>a.getAttribute('href')==='#/books/ed-conflit'),'L2 conflit : accès au livre conservé');
      ok(bouton(root,'Abandonner ces modifications'),'L2 conflit : abandon du parent proposé avec confirmation');
    });
    await run('couverture préparée sans écriture',async()=>{
      const {poserCouverture}=await import('../src/ui/livre-ajout.js');const canvas=new OffscreenCanvas(40,30);canvas.getContext('2d').fillRect(0,0,40,30);
      let ecrits=0;const r=await poserCouverture(await canvas.convertToBlob({type:'image/jpeg'}),{prepareOnly:true,repo:{putFile:async()=>{ecrits++;}}});
      eq(ecrits,0,'L2 couverture : préparation seule ne pose aucun octet avant la transaction de l’édition');
      ok(r.fichier?.blob instanceof Blob&&r.fichier.sha256===r.sha256,'L2 couverture : octets préparés rendus avec leur empreinte');
    });
    await run('scan ouvert avant un cycle',()=>withRepo(async(repo,db)=>{
      const {startScanSession}=await import('../src/ui/import.js'),ed=edition('scan-perime');await base(db,[ed],[]);
      const contexteEdition=await repo.capturerContexteEdition(ed),retire=await mettreLivreALaCorbeille(ed,{repo,mode:'keep_recipes'});await restaurerLivre(retire.edition,{repo});
      let refus=false;try{await startScanSession([new File(['%PDF-1.4\n'], 'temoin.pdf',{type:'application/pdf'})],{edition_id:ed.id,contexteEdition,naviguer:()=>{},notifier:()=>{}});}catch{refus=true;}
      ok(refus,'L2 scan : capture prise avant le sélecteur refusée après retrait/restauration');
      eq([await repo.all('source_pages'),await repo.all('source_documents'),await repo.all('files')],[[],[],[]],'L2 scan périmé : aucun fichier ou lien orphelin');
    }));
  }finally{feuille.remove();setUiLocale(locale);}
}
