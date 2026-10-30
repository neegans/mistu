import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderBook, ligneCompacte } from '../src/ui/book.js';
export async function runL4LivreEditeurTests({eq,ok}){
 const ligne=ligneCompacte({id:'titre',original_title:'Titre imprimé',display_title:'Mon titre affiché',availability:'available',source_page_ids:[]});
 eq(ligne.querySelector('a.titre')?.textContent,'Mon titre affiché','L4 livre ligne : titre affiché prioritaire');
 ok(ligne.textContent.includes('Titre original : Titre imprimé'),'L4 livre ligne : original toujours accessible et nommé');
 let M;try{M=await import('../src/domain/edition-livre.js');}catch(e){ok(false,'L4 modèle livre absent : '+e.message);return;}
 const source={book:{id:'b',title:'Livre',author:'Auteur',cuisines:['française'],tags:['pain']},edition:{id:'e',book_id:'b',year:2020,isbn:null,publisher:'Éditeur',language:'fr',unit_convention_id:null}};
 const modele=M.creerModeleLivre(source);eq(modele.edition.year,'2020','L4 livre : année éditable en texte sans perte');
 modele.book.tags.push('note');eq(source.book.tags,['pain'],'L4 livre : modifier modèle ne change pas source');
 const incomplet={...modele,edition:{...modele.edition,year:'20'}};
 eq(M.validerModeleLivre(incomplet).ok,true,'L4 livre : brouillon conserve une année incomplète');
 eq(M.validerModeleLivre(incomplet,{publication:true,maintenant:'2026-10-29T00:00:00Z'}).ok,false,'L4 livre : publication refuse année incomplète');
 const valide=M.validerModeleLivre(modele,{publication:true,maintenant:'2026-10-29T00:00:00Z'});
 eq([valide.ok,valide.modele.edition.year,valide.modele.edition.isbn],[true,2020,null],'L4 livre : projection métier normalisée seulement à publication');
 eq(M.validerModeleLivre({...modele,edition:{...modele.edition,year:'2020x'}},{publication:true}).ok,false,'L4 livre : année invalide jamais tronquée par parseInt');
 eq(M.validerModeleLivre({...modele,book:{...modele.book,photo_sha256:'injecte'}}).ok,false,'L4 livre : champs hors formulaire refusés');
 eq(M.decrireChangementsLivre({base:M.creerModeleLivre(source),payload:modele}),['book.tags'],'L4 livre : seuls champs modifiés annoncés');
 await withRepo(async(repo,db)=>{
  await db.mutate({origin:'remote',puts:{books:[source.book],book_editions:[source.edition]}});let sauve=null;
  const serviceBrouillons={capturerPortee:async()=>({issue:'ok',portee:{}}),ouvrirBrouillon:async()=>({issue:'ok',session:{},modele:M.creerModeleLivre(source),revision:null}),conserverBrouillon:async({payload})=>{sauve=structuredClone(payload);return{issue:'ok',id:'d',revision:1,saved_at:'date'};}};
  const adresse=location.href,etat=history.state;history.replaceState(etat,'','#/books/e?panel=modifier');
  const root=await renderBook({id:'e'},{panel:'modifier'},await getData(true),{repo,serviceBrouillons});document.body.append(root);
  try{const input=[...root.querySelectorAll('label')].find(n=>n.textContent.startsWith('Titre'))?.querySelector('input');input.value='Titre en cours';input.dispatchEvent(new Event('input',{bubbles:true}));await root.flushEditeur?.();
   eq(sauve?.book.title,'Titre en cours','L4 livre écran : titre saisi confirmé dans brouillon');
   eq((await repo.get('books','b')).title,'Livre','L4 livre écran : autosave ne publie pas les métadonnées');
   ok(root.querySelector('[data-role=statut-brouillon]')?.textContent.includes('conservé'),'L4 livre écran : statut après confirmation du stockage');
   eq(new URLSearchParams(location.hash.split('?')[1]).get('draft'),'d','L4 livre écran : adresse conserve identité du brouillon après commit');
  }finally{root.dispose?.();root.remove();history.replaceState(etat,'',adresse);}
 });
 for(const conflit of [false,true])await withRepo(async(repo,db)=>{
  await db.mutate({origin:'remote',puts:{books:[source.book],book_editions:[source.edition,{...source.edition,id:'e2'}]}});let publie=null;
  const root=await renderBook({id:'e'},{panel:'modifier'},await getData(true),{repo,apresPublication:r=>{publie=r;}});document.body.append(root);
  const attendre=async fn=>{for(let i=0;i<120;i++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Attente éditeur livre dépassée');};
  try{
   const ed=root.querySelector('[data-role=modifier-livre]'),titre=ed.querySelector('input[name=title]');titre.value='Mon titre';titre.dispatchEvent(new Event('input',{bubbles:true}));const conservation=await root.flushEditeur();
   eq(conservation.issue,'ok','L4 livre réel : brouillon enregistré avant publication');
   await db.mutate({origin:'remote',puts:{books:[{...source.book,title:conflit?'Titre ailleurs':'Livre',author:'Auteur ailleurs',metadata_provenance:{author:{origin:'catalogue'}}}],book_editions:[{...source.edition,cover_sha256:'a'.repeat(64),description_locale:'Note ailleurs'}]}});
   [...ed.querySelectorAll('button')].find(b=>b.textContent==='Enregistrer').click();
   await attendre(()=>publie||ed.querySelector('[data-role=comparaison-brouillon]'));
   const b=await repo.get('books','b'),e=await repo.get('book_editions','e');
   eq([b.title,b.author,e.cover_sha256,e.description_locale],[conflit?'Titre ailleurs':'Mon titre','Auteur ailleurs','a'.repeat(64),'Note ailleurs'],'L4 livre réel : conflit exact ou fusion des seuls champs touchés');
   eq(b.metadata_provenance.author,{origin:'catalogue'},'L4 livre réel : provenance non touchée préservée');
   eq((await repo.all('recipe_versions')).length,0,'L4 livre réel : aucune version culinaire créée');
   if(conflit){ok(!publie&&ed.querySelector('[data-role=comparaison-brouillon]').textContent.includes('Mon titre'),'L4 livre réel : comparaison conserve la saisie refusée');}
   else{eq(publie.issue,'publie','L4 livre réel : publication confirmée');eq((await repo.get('book_editions','e2')).book_id,'b','L4 livre réel : livre partagé conserve ses éditions');}
  }finally{root.dispose?.();root.remove();}
 });
}
