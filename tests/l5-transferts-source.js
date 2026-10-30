export async function runL5TransfertsSourceTests({eq,ok}){
 let M;try{M=await import('../src/domain/transferts-source.js');}catch{ok(false,'L5 transfert : module disponible');return;}
 const {octetsJsonbSources,LIMITES_SOURCES,verifierEmpreinteCommandeSources}=await import('../src/domain/sources-format.js');
 const target={id:'s',edition_id:null,status:'open',document_ids:['d'],page_ids:Array.from({length:700},(_,i)=>'p'+i),recipe_ids:[]};
 const rows=[{store:'source_documents',id:'d',data:{id:'d',scan_session_id:'s',edition_id:null,sha256:'a'.repeat(64)}},...target.page_ids.map(id=>({store:'source_pages',id,data:{id,document_id:'d',edition_id:null,sha256:'a'.repeat(64)}}))];
 const args={purpose:'bootstrap',owner_id:'u',target,rows,baseTarget:null,edition_id:null,base_edition_cycle_id:null,nonce:'n',requested_at:'2026-10-29T00:00:00.000Z'},p=await M.preparerTransfertSources(args);
 eq(p.commandes.map(c=>c.phase),['begin','part','part','finish'],'L5 transfert : 701 lignes réparties en deux parties');eq(p.commandes[0].row_count,701,'L5 transfert : compte exact annoncé');
 ok(p.commandes.every(c=>octetsJsonbSources(c)<=LIMITES_SOURCES.commande),'L5 transfert : commandes sous vraie borne JSONB');
 for(const c of p.commandes)await verifierEmpreinteCommandeSources(c);ok(true,'L5 transfert : toutes empreintes vérifiables');
 eq(p.cible.source_state.active_page_ids,target.page_ids,'L5 transfert : sélection finale complète au-delà500');eq(p.cible.source_state.revision,p.commandes.at(-1).operation_id,'L5 transfert : finish réserve révision sans boucle');
 const encore=await M.preparerTransfertSources(args);eq(encore.commandes,p.commandes,'L5 transfert : même intention donne commandes identiques');
 const autre=await M.preparerTransfertSources({...args,nonce:'autre'});ok(autre.commandes[0].transfer_id!==p.commandes[0].transfer_id,'L5 transfert : nouveau geste distinct');
 const vide=await M.preparerTransfertSources({...args,target:{...target,page_ids:[],document_ids:[]},rows:[]});eq(vide.commandes.map(c=>c.phase),['begin','finish'],'L5 transfert : graphe vide valide sans fausse partie');
 let refus;try{await M.preparerTransfertSources({...args,rows:[...rows,rows[0]]});}catch(e){refus=e.code;}eq(refus,'invalid_shape','L5 transfert : collision interne refuse');
 const current={...target,source_state:{format:1,revision:'avant',active_page_ids:target.page_ids}},a=await M.preparerTransfertSources({...args,baseTarget:current}),b=await M.preparerTransfertSources({...args,baseTarget:{...current,source_state:{...current.source_state,revision:'apres'}}});ok(a.commandes[0].base_target_sha256!==b.commandes[0].base_target_sha256,'L5 transfert : token seul changé garde une base distincte');
 const historique={id:'journal-ancien',kind:'index',status:'enregistre',edition_id:null,scan_session_id:'s',page_ids:['p0'],resultat:{ancien:'résultat payé conservé'}},reference={id:'reference-ancienne',edition_id:null,availability:'reference_only',current_version_id:null,index_import_id:historique.id,source_page_ids:['p0'],favorite:true,display_title:'Mon titre'};
 const archive=await M.preparerSourcesArchive({batch:{scan_sessions:[current],source_pages:rows.filter(r=>r.store==='source_pages').map(r=>r.data),source_documents:[rows[0].data],imports:[historique],recipes:[reference]},snapshot:{},owner_id:'u',purpose:'archive',maintenant:()=>args.requested_at,newId:()=> 'archive'});
 const journals=archive.source_commands.filter(c=>c.store==='imports');
 eq(journals.map(c=>[c.phase,c.purpose??null]),[['begin','archive'],['part',null],['finish',null]],'L5 archive : journal ancien et référence protégée passent par transfert historique explicite');
 eq(journals.find(c=>c.phase==='part')?.rows,[{store:'recipes',id:reference.id,data:reference}],'L5 archive : référence conservée exacte avec favori et titre personnel');
 eq(journals.at(-1)?.target,historique,'L5 archive : aucun résultat ni capture inventé pour ancien journal');
 ok(archive.couvertes.includes('recipes:'+reference.id),'L5 archive : référence couverte ne devient pas vieux put');

}
