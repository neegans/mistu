export const sourceEditeurL4 = () => ({
  recipe:{id:'r4',original_title:'Soupe originale',original_language:'fr',current_version_id:'v4',type:'soupe',cuisines:['québec'],tags:[],edition_id:null},
  version:{id:'v4',recipe_id:'r4',kind:'extraction',servings:4,prep_minutes:10,ingredients:[
    {id:'i4-a',source_text:'1 carotte, en dés',name_text:'carotte',quantity:{raw:'1',value:1},unit_id:null,preparation:'en dés',ingredient_id:'carotte',verification_state:'verified'},
    {id:'i4-b',source_text:'sel, au goût',name_text:'sel',quantity:{raw:'au goût',qualitative:true},verification_state:'verified',uncertain:false},
  ],steps:[{id:'s4-a',position:1,text:'Couper.\n\nGarder les feuilles.',timers:[{label:'Repos',seconds:60}]},{id:'s4-b',position:2,text:'Cuire.'}],provenance:{generated_by:'ai',model:'fixture'},constraints:{allergies:[]}},
});

export async function runL4EditeurRecetteTests({eq,ok}) {
  let M;try {M=await import('../src/domain/editeur-recette.js');} catch {ok(false,'L4 : modèle structuré disponible');return;}
  const affiche=sourceEditeurL4(),avant=JSON.stringify(affiche),p=M.creerModeleRecette(affiche);
  eq(p.contenu.ingredients,affiche.version.ingredients,'L4 : lignes et identités vérifiées conservées à l’ouverture');
  eq(p.contenu.steps,affiche.version.steps,'L4 : paragraphes internes et minuteurs conservés sans reparsing');
  eq([Object.hasOwn(p.metadata,'original_title'),Object.hasOwn(p.metadata,'display_title')],[false,false],'L4 : original non éditable et titre d’affichage absent reste absent');
  eq([Object.hasOwn(p.contenu,'yield_text'),Object.hasOwn(p.contenu,'cook_minutes')],[false,false],'L4 : rendement et durée absents non fabriqués');
  eq(M.decrireChangementsRecette(p,p).sansChangement,true,'L4 : ouverture sans changement ne produit pas de publication');
  const meta=structuredClone(p);meta.metadata.display_title='Ma soupe';
  eq(M.decrireChangementsRecette(meta,p),{metadata:['display_title'],contenu:[],sansChangement:false,metadataSeules:true},'L4 : titre affiché seul est une modification de métadonnées');
  const mod=M.modifierIngredient(p,'i4-a',{preparation:'en rondelles'});
  eq([mod.contenu.ingredients[0].id,mod.contenu.ingredients[0].source_text,mod.contenu.ingredients[0].verification_state],['i4-a','1 carotte, en dés','to_verify'],'L4 : seule la ligne touchée perd sa vérification, source gardée');
  eq(mod.contenu.ingredients[1],p.contenu.ingredients[1],'L4 : voisine intacte conserve toute sa provenance');
  eq(M.modifierIngredient(p,'i4-a',{preparation:'en dés'}),p,'L4 : retaper même valeur ne modifie pas la vérification');
  const etape=M.modifierEtape(p,'s4-a','Couper.\n\nPuis rincer.');
  eq(etape.contenu.steps.map(s=>[s.id,s.text]),[['s4-a','Couper.\n\nPuis rincer.'],['s4-b','Cuire.']],'L4 : saisie multiligne reste un bloc identifié');
  eq(M.deplacerElement(p,'steps','s4-b',-1).contenu.steps.map(s=>[s.id,s.position]),[['s4-b',1],['s4-a',2]],'L4 : déplacement conserve les identités et remet positions');
  eq(M.retirerElement(p,'ingredients','i4-a').contenu.ingredients.map(i=>i.id),['i4-b'],'L4 : retrait touche seulement la ligne voulue');
  eq(JSON.stringify(affiche),avant,'L4 : édition pure ne modifie jamais les objets source');
  eq(M.validerModeleRecette(p).ok,true,'L4 : modèle source admis');
  const trans=structuredClone(p);trans.contenu.servings='1,';
  eq([M.validerModeleRecette(trans).ok,M.validerModeleRecette(trans,{publication:true}).ok],[true,false],'L4 : saisie numérique transitoire conservable mais non publiable');
  trans.contenu.servings='1,5';
  eq(M.validerModeleRecette(trans,{publication:true}).modele.contenu.servings,1.5,'L4 : décimale française normalisée seulement à la publication');
  const yieldP=structuredClone(p);yieldP.contenu.yield_text='2 pains de 450 g';
  eq(M.validerModeleRecette(yieldP,{publication:true}).modele.contenu.yield_text,'2 pains de 450 g','L4 : rendement libre intact sans conversion en portions');
  yieldP.contenu.yield_text='é'.repeat(201);
  eq([M.validerModeleRecette(yieldP).ok,M.validerModeleRecette(yieldP,{publication:true}).ok],[true,false],'L4 : rendement trop long reste récupérable sans publication');
  const grand=structuredClone(p);grand.contenu.steps[0].text='é'.repeat(250000);
  eq(M.validerModeleRecette(grand).ok,true,'L4 : source manuelle de 500 Ko non limitée aux bornes assistant');
  const dup=structuredClone(p);dup.contenu.steps[1].id=dup.contenu.steps[0].id;
  eq(M.validerModeleRecette(dup).ok,false,'L4 : identités dupliquées refusées');
  eq(M.validerModeleRecette({...p,url:'https://example.invalid'}).ok,false,'L4 : champ libre hors modèle refusé');
  eq(M.validerModeleRecette({...p,metadata:{...p.metadata,personal_notes:'intruse'}}).ok,false,'L4 : notes personnelles hors patch');
  const nouveau=M.creerModeleRecette({}, {intention:'extraction'});
  eq([nouveau.metadata.original_title,nouveau.contenu.ingredients,nouveau.contenu.steps],['',[],[]],'L4 : nouvelle recette n’invente aucun contenu');
  const normal=M.construireContenuRecette(p,{base:affiche.version,intention:'correction'});
  eq(normal.ingredients,affiche.version.ingredients,'L4 : publication préserve les lignes exactes');
  eq([normal.provenance.model,normal.prep_minutes,Object.hasOwn(normal,'cook_minutes')],['fixture',10,false],'L4 : provenance et absences de durées gardées');
  eq([Object.hasOwn(normal,'id'),Object.hasOwn(normal,'recipe_id'),Object.hasOwn(normal,'parent_version_id')],[false,false,false],'L4 : identités réservées restent au service de publication');
  eq(M.construireContenuRecette(etape,{base:affiche.version}).verification_state,'to_verify','L4 : préparation modifiée jamais vérifiée par simple conservation');
  eq(M.construireContenuRecette(p,{base:{...affiche.version,verification_state:'to_verify'}}).verification_state,'verified','L4 : lignes explicitement vérifiées et préparation intacte restent vérifiées');
  const {toJsonLd}=await import('../src/domain/exporters.js');
  const change=M.modifierIngredient(p,'i4-a',{quantity:{raw:'2',value:2},name_text:'navet',preparation:'en rondelles'});
  const publie=M.construireContenuRecette(change,{base:affiche.version});
  eq(toJsonLd({recipe:affiche.recipe,version:publie}).recipeIngredient[0],'2 navet, en rondelles','L4 : export utilise quantité et nom corrigés, jamais ancien texte source');
  eq(publie.ingredients[1].source_text,'sel, au goût','L4 : source intacte reste verbatim dans publication');
  eq([change.contenu.ingredients[0].source_text,affiche.version.ingredients[0].source_text],['1 carotte, en dés','1 carotte, en dés'],'L4 : source consultée et version parente restent intactes');
  const {ligneIngredientThermomix}=await import('../src/domain/thermomix.js');
  eq(ligneIngredientThermomix(publie.ingredients[0]),'2 navet, en rondelles','L4 : texte Thermomix prend aussi la ligne réellement corrigée');
  const remplace=structuredClone(affiche);remplace.recipe.original_language='it';remplace.version.ingredients[0].substituted_from='1 pomme';
  const fidele=M.creerModeleRecette(remplace);
  eq(M.validerModeleRecette(fidele,{publication:true}).ok,true,'L4 : langue italienne et remplacement manuel existants restent éditables');
  eq(M.construireContenuRecette(fidele,{base:remplace.version}).ingredients[0],remplace.version.ingredients[0],'L4 : origine remplacement intacte dans ligne inchangée');
}

export async function runL4EditeurRecetteUITests({eq,ok}) {
  const {withRepo}=await import('./sync-fixture.js'),state=await import('../src/ui/state.js'),{renderRecipeEdit}=await import('../src/ui/recipe-edit.js');
  await withRepo(async repo=>{
  const f=sourceEditeurL4();await repo.saveBatch({recipes:[f.recipe],recipe_versions:[f.version]},{conditions:{recipes:[{key:f.recipe.id,absente:true}]}});
  const ctx=await state.getData(true),scene=document.createElement('div');document.body.append(scene);
  try {
    const node=await renderRecipeEdit({id:f.recipe.id},{kind:'correction'},ctx);scene.append(node);
    ok(node.querySelector('[data-role=editeur-ingredient] option[value="__new__"]'),'L4 écran : création d’un ingrédient du catalogue reste accessible');
    eq(node.querySelectorAll('[data-role="editeur-ingredient"]').length,2,'L4 écran : deux ingrédients en lignes indépendantes');
    eq([...node.querySelectorAll('[data-role="editeur-etape-texte"]')].map(n=>n.value),f.version.steps.map(s=>s.text),'L4 écran : blocs étapes exacts, y compris double saut');
    ok(node.querySelector('[data-role="enregistrer-editeur"]')?.disabled,'L4 écran : ouverture sans modification garde publication désactivée');
    eq([...node.querySelectorAll('.editeur-sections button')].map(n=>n.textContent),['Informations','Ingrédients','Préparation','Photos','Sources'],'L4 écran : cinq sections dont gestionnaires photo et sources');
    const liensGestion=[...node.querySelectorAll('[data-role=gestion-editeur]')].map(n=>n.getAttribute('href'));
    eq(liensGestion.map(h=>h?.split('?')[0]),['#/recipes/r4/photo'],'L4 écran : photo gérable et aucun faux lien importer pour une recette complète autonome');
    ok(liensGestion.every(h=>new URLSearchParams(h.split('?')[1]).get('v')==='v4'),'L4 écran : liens gestion gardent version capturée');

    const routeAvant=location.hash;history.replaceState(history.state,'','#/recipes/r4/edit?kind=correction&v=v4&origine=retour-fixture');
    const titre=node.querySelector('[data-role="editeur-display_title"]');
    titre.value='Ma soupe conservée';titre.dispatchEvent(new Event('input',{bubbles:true}));
    const sauvegarde=await node.flushEditeur();
    eq(sauvegarde.issue,'ok','L4 écran : premier champ conservé par transaction locale');
    const adresse=new URLSearchParams(location.hash.split('?')[1]);
    eq([adresse.get('draft'),adresse.get('v'),adresse.get('origine')],[sauvegarde.id,'v4','retour-fixture'],'L4 écran : adresse porte brouillon confirmé sans perdre version et retour');
    node.dispose();node.remove();
    const repris=await renderRecipeEdit({id:f.recipe.id},{draft:sauvegarde.id,kind:'correction',v:'v4'},await state.getData(true));scene.append(repris);
    eq(repris.querySelector('[data-role="editeur-display_title"]'),null,'L4 écran : reprise proposée avant formulaire vierge');
    [...repris.querySelectorAll('button')].find(b=>b.textContent==='Reprendre').click();
    for(let i=0;i<100&&!repris.querySelector('[data-role="editeur-display_title"]');i++)await new Promise(r=>setTimeout(r,5));
    eq(repris.querySelector('[data-role="editeur-display_title"]')?.value,'Ma soupe conservée','L4 écran : reprise explicite retrouve texte exact');
    repris.querySelector('[data-role="enregistrer-editeur"]').click();
    for(let i=0;i<200&&(await repo.get('recipes','r4')).display_title!=='Ma soupe conservée';i++)await new Promise(r=>setTimeout(r,5));
    const recette=await repo.get('recipes','r4');
    eq([recette.original_title,recette.display_title,(await repo.all('recipe_versions')).length],['Soupe originale','Ma soupe conservée',1],'L4 écran : publier titre affiché seul garde original et ne crée pas de version');
    eq((await repo.get('recipe_versions','v4')).steps,f.version.steps,'L4 écran : métadonnées n’altèrent pas étapes source');
    repris.dispose();repris.remove();
    const culinary=await renderRecipeEdit({id:'r4'},{kind:'correction'},await state.getData(true));scene.append(culinary);
    const qty=culinary.querySelector('[data-role="ingredient-quantite"]');qty.value='2';qty.dispatchEvent(new Event('input',{bubbles:true}));
    const etape=culinary.querySelector('[data-role="editeur-etape-texte"]');etape.value='Couper.\n\nGarder les feuilles.\nPuis rincer.';etape.dispatchEvent(new Event('input',{bubbles:true}));
    await culinary.flushEditeur();culinary.querySelector('[data-role="enregistrer-editeur"]').click();
    for(let i=0;i<200&&(await repo.all('recipe_versions')).length===1;i++)await new Promise(r=>setTimeout(r,5));
    const toutes=await repo.all('recipe_versions'),nouvelle=toutes.find(v=>v.id!=='v4');
    eq([toutes.length,nouvelle?.parent_version_id,nouvelle?.kind],[2,'v4','correction'],'L4 écran : contenu modifié crée une correction liée');
    eq(nouvelle?.ingredients.map(i=>[i.id,i.verification_state]),[['i4-a','to_verify'],['i4-b','verified']],'L4 écran : identités intactes et vérification de la seule ligne touchée');
    eq(nouvelle?.steps.map(s=>[s.id,s.text]),[['s4-a','Couper.\n\nGarder les feuilles.\nPuis rincer.'],['s4-b','Cuire.']],'L4 écran : publication préserve toutes les étapes et leurs paragraphes');
    eq((await repo.get('recipe_versions','v4')).ingredients,f.version.ingredients,'L4 écran : original ne reçoit aucune correction en place');
    history.replaceState(history.state,'',routeAvant||'#');
  } finally {scene.querySelector('.editeur-recette')?.dispose?.();scene.remove();}
  });
  await withRepo(async repo=>{
    const f=sourceEditeurL4();await repo.saveBatch({recipes:[f.recipe],recipe_versions:[f.version]},{conditions:{recipes:[{key:f.recipe.id,absente:true}]}});
    const scene=document.createElement('div');document.body.append(scene);const hash=location.hash;
    const saisir=(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));};
    const attendre=async fn=>{for(let i=0;i<200;i++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Attente UI deux éditeurs');};
    try{
      const initial=await renderRecipeEdit({id:'r4'},{},await state.getData(true));scene.append(initial);saisir(initial.querySelector('[data-role=editeur-display_title]'),'Premier texte');const garde=await initial.flushEditeur();initial.dispose();initial.remove();
      const ouvre=async()=>{const n=await renderRecipeEdit({id:'r4'},{draft:garde.id},await state.getData(true));scene.append(n);[...n.querySelectorAll('button')].find(b=>b.textContent==='Reprendre').click();await attendre(()=>n.querySelector('[data-role=editeur-display_title]'));return n;};
      const a=await ouvre(),b=await ouvre();
      saisir(a.querySelector('[data-role=editeur-display_title]'),'Texte du premier onglet');await a.flushEditeur();
      saisir(b.querySelector('[data-role=editeur-display_title]'),'Texte du second onglet');b.querySelector('[data-role=enregistrer-editeur]').click();
      await attendre(()=>[...b.querySelectorAll('button')].some(n=>n.textContent==='Conserver une copie séparée'));
      eq(b.querySelector('[data-role=editeur-display_title]').value,'Texte du second onglet','L4 UI CAS : refus garde la saisie locale perdante');
      [...b.querySelectorAll('button')].find(n=>n.textContent==='Conserver une copie séparée').click();
      await attendre(()=>b.etatEditeur()?.id&&b.etatEditeur().id!==garde.id);
      const ancien=(await repo.get('sync_state','editor_draft:v1:'+garde.id)).value,copie=(await repo.get('sync_state','editor_draft:v1:'+b.etatEditeur().id)).value;
      eq([ancien.payload.metadata.display_title,copie.payload.metadata.display_title],['Texte du premier onglet','Texte du second onglet'],'L4 UI CAS : copie distincte conserve les deux saisies');
      eq(copie.base_source_signature,ancien.base_source_signature,'L4 UI CAS : copie ne renouvelle pas la base source');
      a.dispose();a.remove();b.dispose();b.remove();
      const liste=await renderRecipeEdit({id:'r4'},{},await state.getData(true));scene.append(liste);
      eq([liste.querySelectorAll('a[href*="draft="]').length,!!liste.querySelector('[data-role=editeur-display_title]')],[2,false],'L4 UI : retour sans paramètre propose anciens brouillons avant formulaire neuf');
    }finally{for(const n of scene.querySelectorAll('.editeur-recette'))n.dispose?.();scene.remove();history.replaceState(history.state,'',hash||'#');}
  });
  await withRepo(async repo=>{
    const f=sourceEditeurL4();await repo.saveBatch({recipes:[f.recipe],recipe_versions:[f.version]},{conditions:{recipes:[{key:f.recipe.id,absente:true}]}});
    const ctx=await state.getData(true),scene=document.createElement('div'),ancien=location.hash;document.body.append(scene);
    try{
      history.replaceState(history.state,'','#/recipes/r4/edit?v=v4');const n=await renderRecipeEdit({id:'r4'},{v:'v4'},ctx);scene.append(n);
      const titre=n.querySelector('[data-role=editeur-display_title]');titre.value='Avant gestion photo';titre.dispatchEvent(new Event('input',{bubbles:true}));
      n.querySelector('[data-role=gestion-editeur]').click();
      for(let i=0;i<100&&!location.hash.startsWith('#/recipes/r4/photo');i++)await new Promise(r=>setTimeout(r,5));
      const garde=n.etatEditeur();eq([location.hash.startsWith('#/recipes/r4/photo'),(await repo.get('sync_state','editor_draft:v1:'+garde.id))?.value.payload.metadata.display_title], [true,'Avant gestion photo'],'L4 gestion : clic photo conserve la dernière frappe avant départ');n.dispose();n.remove();
      const neuf=await renderRecipeEdit({}, {},await state.getData(true));scene.append(neuf);
      eq([neuf.querySelectorAll('[data-role=gestion-editeur]').length,neuf.textContent.includes('disponible après l’enregistrement de cette recette.'),(await repo.all('recipes')).length],[0,true,1],'L4 création : sections expliquées sans lien à une identité métier inventée');neuf.dispose();
    }finally{for(const n of scene.querySelectorAll('.editeur-recette'))n.dispose?.();scene.remove();history.replaceState(history.state,'',ancien||'#');}
  });
  await withRepo(async(repo,db)=>{
    const f=sourceEditeurL4();f.recipe={...f.recipe,availability:'available',edition_id:'e4',source_page_ids:['p4']};
    await db.mutate({puts:{books:[{id:'b4',title:'Livre source'}],book_editions:[{id:'e4',book_id:'b4',language:'fr'}],recipes:[f.recipe],recipe_versions:[f.version],source_pages:[{id:'p4',edition_id:'e4',sha256:'source-l4',printed_page:12,kind:'recipe',role:'recette'}],scan_sessions:[{id:'ss4',edition_id:'e4',page_ids:['p4'],document_ids:[],recipe_ids:['r4'],status:'open'}]},origin:'device'});
    const ctx=await state.getData(true),scene=document.createElement('div');document.body.append(scene);
    try{
      const n=await renderRecipeEdit({id:'r4'},{v:'v4'},ctx);scene.append(n);
      const liens=[...n.querySelectorAll('[data-section=sources] a')].map(a=>a.getAttribute('href'));
      eq(liens.map(h=>h.split('?')[0]),['#/import','#/books/e4'],'L4 sources : recette complète ouvre séance réelle ou livre, jamais import ciblé refusé');
      const {renderBook}=await import('../src/ui/book.js');const qLivre=Object.fromEntries(new URLSearchParams(liens[1].split('?')[1]));
      const livre=await renderBook({id:'e4'},qLivre,ctx);scene.append(livre);eq(livre.querySelector('[data-role=pages-source]')?.hidden,false,'L4 sources : destination livre rend réellement son onglet Sources');
      const {renderImport}=await import('../src/ui/import.js'),qSeance=Object.fromEntries(new URLSearchParams(liens[0].split('?')[1]));const seance=await renderImport({},qSeance,ctx);scene.append(seance);
      ok(!seance.textContent.includes('Séance introuvable.')&&seance.querySelector('[data-page="p4"]'),'L4 sources : destination séance rend sa page réelle');
      n.dispose();livre.dispose?.();seance.dispose?.();
    }finally{for(const n of scene.querySelectorAll('.editeur-recette'))n.dispose?.();scene.remove();}
  });
  await withRepo(async repo=>{
    const f=sourceEditeurL4();await repo.saveBatch({recipes:[f.recipe],recipe_versions:[f.version]},{conditions:{recipes:[{key:'r4',absente:true}]}});
    const scene=document.createElement('div');document.body.append(scene);
    const attendre=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('dialogue catalogue');};
    try{const n=await renderRecipeEdit({id:'r4'},{},await state.getData(true));scene.append(n);const sel=n.querySelector('[data-role=editeur-ingredient] select');sel.value='__new__';sel.dispatchEvent(new Event('change',{bubbles:true}));
      await attendre(()=>document.querySelector('dialog[open]'));let dlg=document.querySelector('dialog[open]');dlg.querySelector('input').value='Courge locale';dlg.querySelector('.primary').click();
      await attendre(()=>document.querySelector('dialog[open]')!==dlg);dlg=document.querySelector('dialog[open]');dlg.querySelector('input').value='Local squash';dlg.querySelector('.primary').click();
      await attendre(async()=>(await repo.all('ingredients')).some(i=>i.labels?.fr?.label==='Courge locale'));const conserve=await n.flushEditeur(),draft=(await repo.get('sync_state','editor_draft:v1:'+conserve.id)).value,ing=await repo.get('ingredients',draft.payload.contenu.ingredients[0].ingredient_id);
      eq([ing.labels.fr.label,ing.labels.en.label,draft.payload.contenu.ingredients[0].name_text,draft.payload.contenu.ingredients[0].verification_state],['Courge locale','Local squash','Courge locale','to_verify'],'L4 catalogue : création explicite conserve les deux noms, lie la saisie et demande sa relecture');
      eq((await repo.get('recipe_versions','v4')).ingredients,f.version.ingredients,'L4 catalogue : création dans catalogue ne réécrit pas la version parente');n.dispose();
    }finally{for(const n of scene.querySelectorAll('.editeur-recette'))n.dispose?.();for(const d of document.querySelectorAll('dialog[open]'))d.close();scene.remove();}
  });
  await withRepo(async(repo,db)=>{
    const f=sourceEditeurL4();f.recipe.source_page_ids=['p4'];
    await db.mutate({puts:{recipes:[f.recipe],recipe_versions:[f.version],source_pages:[{id:'p4',edition_id:null,sha256:'absente-l4',printed_page:null}]},origin:'device'});
    const contexte=await state.getData(true),get=db.get;let erreurs=0;const intercepter=e=>{erreurs++;e.preventDefault();};window.addEventListener('unhandledrejection',intercepter);
    db.get=async(s,k)=>{if(s==='files'&&k==='absente-l4')throw new Error('lecture fichier indisponible');return get.call(db,s,k);};
    const scene=document.createElement('div');document.body.append(scene);
    try{const n=await renderRecipeEdit({id:'r4'},{},contexte);scene.append(n);await new Promise(r=>setTimeout(r,30));eq([erreurs,!!n.querySelector('[data-role=source-indisponible]'),n.querySelector('.editeur-source img')?.getAttribute('src')??null],[0,true,null],'L4 source : échec stockage visible, aucun rejet non traité ni fausse image');n.dispose();}
    finally{delete db.get;window.removeEventListener('unhandledrejection',intercepter);scene.remove();}
  });

}

export async function runL4LectureEditeurTests({eq,ok}) {
  const {withRepo}=await import('./sync-fixture.js'),D=await import('../src/domain/import-cible.js'),UI=await import('../src/ui/import-cible.js');
  eq(D.cibleReprise({id:'imp4',kind:'recette',recipe_id:'r4',editor_base_version_id:'v4'}),'/recipes/r4/edit?kind=correction&v=v4&import=imp4','L4 lecture : reprise ouvre la version exacte dans éditeur');
  const reprise=D.lignesImports({imports:[{id:'imp4',kind:'recette',recipe_id:'r4',editor_base_version_id:'v4',status:'a_verifier',resultat:{title:'Soupe'},device_id:'ici'}],recipesById:new Map([['r4',{id:'r4',original_title:'Soupe',availability:'available'}]]),editionsById:new Map(),booksById:new Map()},{deviceId:'ici'});
  ok(reprise[0]?.gestes.includes('reprendre'),'L4 lecture : recette disponible conserve accès à sa relecture éditeur');
  await withRepo(async(repo,db)=>{
    const f=sourceEditeurL4();await repo.saveBatch({recipes:[f.recipe],recipe_versions:[f.version]},{conditions:{recipes:[{key:f.recipe.id,absente:true}]}});
    const version=await repo.get('recipe_versions','v4'),recipe=await repo.get('recipes','r4');
    const token={access_token:'sentinelle-locale-non-secret',user:{id:'fixture'}};
    const ctx={recipesById:new Map([['r4',recipe]]),versionsById:new Map([['v4',version]]),sync:{user:token.user,auth:{jeton:async()=>token}}};
    const lecture={kind:'recette',recipeId:'r4',versionAffichee:version,pageIds:[]};
    let appels=0;
    const result=await UI.lancerVol(null,async()=>{appels++;return{resultat:{title:'Soupe',ingredients:[{source_text:'1 carotte',uncertain:false}],steps:[{text:'Cuire.'}],uncertain_fields:[]},texteBrut:'{}',modele:'fixture'};},{ctx,repo,lecture,preparer:async()=>({images:[{}],pageIds:[]}),enLigne:()=>true});
    const ligne=await repo.get('imports',result.importId);
    eq([result.issue,ligne?.recipe_id,ligne?.editor_base_version_id,appels],['a_verifier','r4','v4',1],'L4 lecture : cible et version exactes dans journal durable avant usage');
    ok(/^[a-f0-9]{64}$/.test(ligne?.editor_source_signature||''),'L4 lecture : empreinte source persistée pour relance');
    eq(await UI.relireDuJournal(ligne.id,'recette',{repo}),null,'L4 lecture : ancien chemin sans cible n’adopte pas résultat éditeur');
    const lu=await UI.relireDuJournal(ligne.id,'recette',{repo,recipeId:'r4',baseVersionId:'v4'});
    eq(lu?.resultat?.title,'Soupe','L4 lecture : reprise avec cible exacte sans appel');
    eq(await UI.relireDuJournal(ligne.id,'recette',{repo,recipeId:'r4',baseVersionId:'autre'}),null,'L4 lecture : autre version ne reprend pas la réponse');
    await repo.transitionner('imports',ligne.id,{attendus:['a_verifier'],patch:{status:'ignore'}});
    await db.put('recipe_versions',{...version,steps:[{id:'s4-a',text:'Autre recette.'}]},{origin:'device'});
    const avant=(await repo.all('imports')).length;
    const refuse=await UI.lancerVol(null,async()=>{appels++;return{resultat:{},texteBrut:''};},{ctx,repo,lecture,preparer:async()=>({images:[{}],pageIds:[]}),enLigne:()=>true});
    eq([refuse.issue,appels,(await repo.all('imports')).length],['refuse',1,avant],'L4 lecture : source modifiée avant départ refuse avant journal et appel');
  });
}
