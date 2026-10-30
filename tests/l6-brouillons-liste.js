import {renderBrouillonsListe} from '../src/ui/brouillons-liste.js';
import {routeInterne} from '../src/ui/navigation-contexte.js';

export async function runL6BrouillonsListeTests({eq,ok}) {
  const portee={owner_id:null,database_name:'liste-l6',library_epoch:'source'},porteeTr={...portee,library_epoch:'traductions'};
  const saisie={id:'meme-id',kind:'recipe_version',entity_id:'recette',titre:'Recette',etat:'reprenable',revision:2};
  const traduction={...saisie,kind:'recipe_translation',titre:'Traduction',recipe_version_id:'version/1',locale:'fr',revision:7};
  const actions=[],copies=[];
  const service={listerBrouillons:async()=>({issue:'ok',brouillons:[saisie]}),ecarterBrouillon:async a=>{actions.push(['saisie',a]);return{issue:'refuse',raison:'revision_changee'};}};
  const depot={listerBrouillons:async()=>({issue:'ok',brouillons:[traduction]}),exporterTexteBrouillon:async a=>{actions.push(['texte-traduction',a]);return{issue:'ok',texte:'Texte français conservé',nomFichier:'traduction.txt'};},ecarterBrouillon:async a=>{actions.push(['traduction',a]);return{issue:'refuse',raison:'revision_changee'};}};
  const root=await renderBrouillonsListe({service,portee,services:[{service:depot,portee:porteeTr}],confirmer:async()=>true,telecharger:(blob,nom)=>copies.push({blob,nom})});
  document.body.append(root);
  try {
    const cards=[...root.querySelectorAll('[data-draft-id]')],tr=cards.find(c=>c.querySelector('h3')?.textContent==='Traduction');
    eq(cards.length,2,'L6 brouillons : deux dépôts visibles même si identifiants égaux');
    const href=tr?.querySelector('a')?.getAttribute('href'),url=new URL(href?.slice(1)||'/',location.origin);
    eq(url.pathname,'/recipes/recette/edit','L6 brouillon traduit : recette exacte');
    eq(Object.fromEntries(url.searchParams),{kind:'translation',format:'2',draft:'meme-id',v:'version/1',locale:'fr'},'L6 brouillon traduit : version, langue et nouveau formulaire exacts');
    eq(routeInterne('/recipes/recette/edit?kind=translation&format=2&assistant=1&intrus=non'),'/recipes/recette/edit?kind=translation&format=2&assistant=1','L6 navigation : préparation conservée, paramètres inconnus retirés');
    eq(routeInterne('/recipes/recette/edit?kind=translation&format=2&translation=candidate%2F2&v=version%2F1'),'/recipes/recette/edit?kind=translation&format=2&translation=candidate%2F2&v=version%2F1','L6 navigation : candidat explicitement choisi conservé avec sa version');
    tr?.querySelector('[data-action=exporter]')?.click();
    for(let i=0;i<30&&!copies.length;i++)await new Promise(r=>setTimeout(r,5));
    eq(copies.length?await copies[0].blob.text():null,'Texte français conservé','L6 brouillon traduit : téléchargement par son dépôt');
    eq(actions.find(a=>a[0]==='texte-traduction')?.[1],{id:'meme-id',portee:porteeTr},'L6 brouillon traduit : portée propre pour récupérer le texte');
    tr?.querySelector('[data-action=ecarter]')?.click();
    for(let i=0;i<30&&!actions.some(a=>a[0]==='traduction');i++)await new Promise(r=>setTimeout(r,5));
    eq(actions.find(a=>a[0]==='traduction')?.[1],{id:'meme-id',portee:porteeTr,expectedRevision:7},'L6 écarter : dépôt, portée et révision exacts');
    eq(actions.filter(a=>a[0]==='saisie').length,0,'L6 écarter : aucune action sur le brouillon de recette homonyme');
    ok(tr?.querySelector('[role=status]')?.textContent,'L6 écarter refusé : avertissement visible sans perdre le brouillon');
  } finally {root.remove();}
  const partiel=await renderBrouillonsListe({service,portee,services:[{service:{listerBrouillons:async()=>{throw Error('disque');}},portee:porteeTr}]});
  eq(partiel.querySelectorAll('[data-draft-id]').length,1,'L6 lecture partielle : les saisies lisibles restent visibles');
  ok(!!partiel.querySelector('[role=status]')?.textContent,'L6 lecture partielle : erreur de lecture signalée');
  let courante=true,terminer;
  const attente=renderBrouillonsListe({service,portee,services:[{service:{listerBrouillons:()=>new Promise(r=>terminer=r)},portee:porteeTr}],estCourante:()=>courante});
  await Promise.resolve();courante=false;terminer?.({issue:'ok',brouillons:[traduction]});
  const obsolete=await attente;eq(obsolete.querySelectorAll('[data-draft-id]').length,0,'L6 réponse tardive des dépôts : aucun ancien titre après changement de contexte');
}

export async function runL6BrouillonsAjouterTests({eq,ok}) {
 const {withRepo}=await import('./sync-fixture.js'),{fixtureLectureL6}=await import('./l6-lecture-ecrans.js'),{creerDepotTraductions}=await import('../src/domain/depot-traductions.js'),{creerServiceBrouillons}=await import('../src/domain/brouillons-editeur.js'),{getData,getSyncGeneration}=await import('../src/ui/state.js'),{renderAdd}=await import('../src/ui/add.js');
 await withRepo(async(repo,db)=>{
  const f=fixtureLectureL6();for(const ingredient of f.version.ingredients)ingredient.verification_state='to_verify';await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version]}});
  const depot=creerDepotTraductions({repo,getGeneration:getSyncGeneration}),portee=(await depot.capturerPortee({owner_id:null})).portee;
  const o=await depot.ouvrirTraduction({portee,affiche:{recipe:f.recipe,version:f.version,traductions:[]},locale:'fr'});eq(o.issue,'ok','L6 Ajouter : vraie traduction ouverte');if(o.issue!=='ok')return;
  o.modele.segments[0].text='Pain à traduire';const saved=await depot.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});eq(saved.issue,'ok','L6 Ajouter : vrai brouillon durable');
  const legacy=creerServiceBrouillons({repo,getGeneration:getSyncGeneration}),p=(await legacy.capturerPortee({owner_id:null})).portee,edit=await legacy.ouvrirBrouillon({kind:'recipe_version',intention:'correction',portee:p,affiche:{recipe:f.recipe,version:f.version}});
  eq(edit.issue,'ok','L6 Ajouter : brouillon de recette ouvert — '+edit.raison);if(edit.issue!=='ok')return;
  edit.modele.metadata.display_title='Autre saisie locale';await legacy.conserverBrouillon({session:edit.session,expectedRevision:null,payload:edit.modele});
  const root=await renderAdd({},{section:'brouillons'},await getData(true));
  try {
   eq(root.querySelectorAll('[data-draft-id]').length,2,'L6 Ajouter : recettes et traductions dans une seule liste réelle');
   const card=root.querySelector('[data-draft-id="'+saved.id+'"]'),href=card?.querySelector('a')?.getAttribute('href');
   ok(!!href?.includes('format=2')&&href.includes('draft='+saved.id),'L6 Ajouter : reprise vers le bon brouillon de traduction');
   eq(await db.getAll('recipe_translations'),[],'L6 Ajouter : lire les brouillons ne publie aucune traduction');
  } finally {root.dispose?.();}
 });
}
