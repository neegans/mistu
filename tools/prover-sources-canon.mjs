// Émet des assertions exécutables sur PostgreSQL, comparées au vrai contrat JavaScript.
// Usage : node tools/prover-sources-canon.mjs > preuve.sql ; psql -v ON_ERROR_STOP=1 -f preuve.sql
import * as F from '../src/domain/sources-format.js';
const lit = s => "'" + s.replaceAll("'", "''") + "'";
const json = v => lit(JSON.stringify(v))+'::jsonb';
const exemples = [null,true,false,0,-0,1e-7,1e21,-1.25e-12,1.2300,Number.MAX_SAFE_INTEGER,'é','e\u0301','"\\\b\t\n\r\f',[],{},[1,{b:null,a:[]}],{'\u{10000}':1,'\ue000':2}, {z:'🍞',a:'&< >'}, {'é':1,'e\u0301':2},'\u2028\u2029'];
const assertions = [];
for(const value of exemples){
  assertions.push(['canon',`public.l5_canonical(${json(value)})`,lit(F.canoniqueSources(value))]);
  assertions.push(['hash',`public.l5_sha256(${json(value)})`,lit(await F.empreinteSources(value))]);
}
const row={id:'r-é',edition_id:null,document_id:'d',sha256:'a'.repeat(64),rotation:90,position:2,printed_page:8,kind:'index',source_revision:{format:1,family_id:'p',parent_page_id:'p',operation_id:'op',reason:'rotate'},source_copy:{format:1,operation_id:'copie',source_id:'avant',source_identity_sha256:'b'.repeat(64)},page_ids:['p','r-é'],document_ids:['d'],recipe_ids:['rec'],source_state:{format:1,revision:'exacte',active_page_ids:['r-é']},created_at:'2026-10-29T00:00:00Z',updated_at:'2026-10-30T00:00:00Z',source_receipts:[],original_title:'Pain',display_title:null,printed_pages:[{debut:8,fin:9}],availability:'reference_only',favorite:true,started_at:'2026-10-29T01:00:00Z',source_capture:null,model:'modèle',extensions:{note:'\u0001à conserver'}};
const extra=[{store:'source_pages',id:'p',identity_sha256:'c'.repeat(64),annotation_sha256:'d'.repeat(64)}];
const projections=[['page',F.projectionIdentitePage],['annotation',F.projectionAnnotationPage],['document',F.projectionIdentiteDocument],['session_identity',F.projectionIdentiteSeance],['recipe',F.projectionRecetteIndex],['seed',F.projectionSeedSource],['target',F.projectionCibleSources],['transfer_base',F.projectionBaseTransfertSources]];
for(const value of [{},row,{id:'absent',edition_id:null,rotation:null}])for(const [name,fn] of projections)assertions.push(['projection '+name,`public.l5_canonical(public.l5_project_${name}(${json(value)}))`,lit(F.canoniqueSources(fn(value)))]);
assertions.push(['projection session',`public.l5_canonical(public.l5_project_session(${json(row)},${json(extra)}))`,lit(F.canoniqueSources(F.projectionSessionSources(row,extra)))]);
const resultat={format:2,pages:[],texte:'é\n"'};
assertions.push(['projection reading',`public.l5_canonical(public.l5_project_reading(${json(row)},${json(resultat)}))`,lit(F.canoniqueSources(F.projectionLectureIndex(row,resultat)))]);
const refus=[`public.l5_canonical(NULL::jsonb)`,`public.l5_canonical(${json({constructor:'refus'})})`,`public.l5_project_page(${json({rotation:45})})`,`public.l5_canonical(${lit('"\\ud800"')}::jsonb)`,`public.l5_canonical(${lit('"\\u0000"')}::jsonb)`];
let sql='-- Généré par tools/prover-sources-canon.mjs ; aucune donnée utilisateur.\nDO $proof$\nBEGIN\n';
for(const [i,[nom,got,want]] of assertions.entries())sql+=` IF ${got} IS DISTINCT FROM ${want} THEN RAISE EXCEPTION ${lit('Échec '+nom+' '+i)}; END IF;\n`;
for(const [i,expression]of refus.entries())sql+=` BEGIN PERFORM ${expression}; RAISE EXCEPTION ${lit('Refus manquant '+i)}; EXCEPTION WHEN SQLSTATE '22023' OR SQLSTATE '22P02' OR SQLSTATE '22P05' THEN NULL; END;\n`;
sql+=`END;\n$proof$;\nSELECT ${lit('L5 canon/projections : '+(assertions.length+refus.length)+' assertions réussies')} AS bilan;\n`;
process.stdout.write(sql);
