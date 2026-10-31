import * as T from '../src/domain/thermomix.js';
import {enregistrerSessionCuisine} from '../src/domain/thermomix-session.js';
import {fixtureThermomixHistorique, ORIGINE_THERMOMIX_HISTORIQUE} from './fixtures/thermomix-0.23.1.js';
import {fixtureChaineThermomixHistorique} from './fixtures/thermomix-0.23.1-chaine.js';
import {fixtureCapaciteThermomixHistorique} from './fixtures/thermomix-0.23.1-capacite.js';
import {withRepo} from './sync-fixture.js';
const copie = value => structuredClone(value);
const raison = async fn => {try {await fn(); return null;} catch (e) {return e.raison || e.message;}};
const seance = f => ({id:'cs-historique-original',recipe_id:f.recipe.id,selected_version_ids:[f.original.id],servings:8,status:'active',progress:{}});
export async function runAuditThermomixHistoriqueTests({eq,ok}) {
 const f=fixtureThermomixHistorique(), avant=copie(f), lu=T.lireThermomix(f.version);
 eq(ORIGINE_THERMOMIX_HISTORIQUE.commit,'752566d02a3bdddf6ec7a7afeae5d9280f3cc3d5','audit TM7 : fixture figée issue du vrai code avant 0.23.2');
 eq([lu.ok,lu.etat,lu.motifs],[false,'a_revoir',['eau_vapeur']],'audit TM7 : un plan conserve avant 0.23.2 devient a_revoir, pas invalide');
 eq(lu.document?.plan,f.version.provenance.thermomix,'audit TM7 : document historique complet consultable après validation d’intégrité');
 eq(lu.document?.contexte.precisions.eau_vapeur_g,3000,'audit TM7 : ancienne eau conservée, jamais corrigée silencieusement');
 eq(T.gardeThermomix(f.version),{ok:false,raison:'eau_vapeur'},'audit TM7 : a_revoir reste inexécutable');
 eq(await raison(()=>T.copieCookidooThermomix({recipe:f.recipe,version:f.version})),'eau_vapeur','audit TM7 : copie stricte ne diffuse pas les anciens réglages');
 eq(f,avant,'audit TM7 : lecture et refus ne modifient aucune donnée historique');
 const chaine=fixtureChaineThermomixHistorique(), lc=T.lireThermomix(chaine.version);
 eq([lc.etat,lc.motifs,lc.document?.blocs.length],['a_revoir',['eau_vapeur'],2],'audit TM7 : eau historique héritée relue sur la seconde génération');
 const tested=copie(f.version);tested.status='tested';eq(T.lireThermomix(tested).etat,'a_revoir','audit TM7 : statut testé ne valide pas un ancien réglage');
 eq(T.lireThermomix(JSON.parse(JSON.stringify(f.version))),lu,'audit TM7 : relecture après JSON identique');
 const liquides=fixtureCapaciteThermomixHistorique(), capacite=T.lireThermomix(liquides.version);
 eq([capacite.ok,capacite.etat,capacite.motifs],[false,'a_revoir',['capacite']],'audit TM7 : somme historique de 2,5 L documentaire, jamais utilisable');
 eq(await raison(()=>T.validerReponseThermomix(liquides.version.provenance.thermomix.resultat,liquides.version.provenance.thermomix.contexte)),'capacite','audit TM7 : nouvelle proposition conserve le calcul du volume total');
 const liquideCorrompu=copie(liquides.version);liquideCorrompu.provenance.thermomix.version_signature+='autre';
 eq(T.lireThermomix(liquideCorrompu),{ok:false,raison:'version_modifiee'},'audit TM7 : volume excessif ne masque pas une signature invalide');
 for(const [nom,mutation,attendu] of [
  ['signature source',v=>{v.provenance.thermomix.contexte.source_signature+='x'},'source_modifiee'],
  ['signature version',v=>{v.provenance.thermomix.version_signature+='x'},'version_modifiee'],
  ['texte régénéré',v=>{v.steps[0].text+=' Autre.'},'version_modifiee'],
  ['minuteur régénéré',v=>{v.steps[0].timers[0].seconds++},'version_modifiee'],
  ['ingrédient',v=>{v.ingredients[0].quantity.value++},'version_modifiee'],
  ['parent',v=>{v.parent_version_id='parent-invente'},'source_modifiee'],
  ['recette',v=>{v.recipe_id='autre-recette'},'source_modifiee'],
  ['modèle',v=>{v.provenance.model='autre'},'modele'],
  ['correspondance',v=>{v.provenance.thermomix.correspondance[0].source_step_id='invente'},'correspondance'],
  ['blocs documentaires',v=>{v.provenance.thermomix.blocs[0].raison='Autre raison.'},'plan_modifie'],
  ['forme eau',v=>{v.provenance.thermomix.contexte.precisions.eau_vapeur_g='3000'},'eau_vapeur'],
  ['hors ancienne borne',v=>{v.provenance.thermomix.contexte.precisions.eau_vapeur_g=10001},'eau_vapeur'],
 ]) {const v=copie(f.version);mutation(v);eq(T.lireThermomix(v),{ok:false,raison:attendu},`audit TM7 : ${nom} corrompu reste invalide malgré l’ancienne eau`);}
 const contexte=f.version.provenance.thermomix.contexte,resultat=f.version.provenance.thermomix.resultat;
 eq(await raison(()=>T.construireContexteThermomix({version:f.original,selection:['s1'],precisions:{eau_vapeur_g:3000}})),'eau_vapeur','audit TM7 : nouveau contexte garde la limite actuelle');
 eq(await raison(()=>T.validerReponseThermomix(resultat,contexte)),'eau_vapeur','audit TM7 : proposition ancienne jamais admise comme réponse neuve');
 eq(await raison(()=>T.fabriquerVersionThermomix({source:f.original,contexte,resultat,id:'neuve',newId:()=>crypto.randomUUID(),maintenant:'2026-10-30T12:00:00Z'})),'eau_vapeur','audit TM7 : constructeur conserve son contrôle strict');
 const sain=T.construireContexteThermomix({version:f.original,selection:['s1'],precisions:{eau_vapeur_g:500}});
 const actuelle=T.fabriquerVersionThermomix({source:f.original,contexte:sain,resultat,id:'rv-valide-actuelle',newId:()=>crypto.randomUUID(),maintenant:'2026-10-30T12:00:00Z'});
 eq(T.lireThermomix(actuelle)?.ok,true,'audit TM7 : témoin actuel valide reste utilisable');
 eq(T.gardeThermomix(actuelle,8),{ok:false,raison:'portions'},'audit TM7 : désaccord de portions ne devient pas repli historique');
 // Couture existante, éprouvée même avant l’arrivée du nouveau résolveur.
 for(const cible of ['enfant','parent']) await withRepo(async(repo,db)=>{
  const f=fixtureThermomixHistorique();await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.original,f.version]}});
  const recettes=[await repo.capturerContexteRecette(f.recipe)];const mutation=db.mutate.bind(db);let atteint=false;const concurrent=copie(cible==='enfant'?f.version:f.original);concurrent.updated_at='2026-10-30T12:00:00.000Z';
  db.mutate=async options=>{if(!atteint&&options.puts?.cook_sessions){atteint=true;await mutation({origin:'remote',puts:{recipe_versions:[concurrent]}});}return mutation(options)};
  try {eq(await raison(()=>enregistrerSessionCuisine(seance(f),{repo,recettes,versionsAffichees:[f.original],ancetresThermomix:[f.version,f.original]})),cible==='enfant'?'source_modifiee':'version_modifiee',`audit TM7 : ${cible} changé dans la transaction refuse la reprise`);
   eq(atteint,true,`audit TM7 : course ${cible} atteint bien la transaction cuisine`);eq(await db.get('cook_sessions',seance(f).id),undefined,`audit TM7 : course ${cible} n’ouvre aucune séance`);eq(await db.get('recipe_versions',concurrent.id),concurrent,`audit TM7 : course ${cible} conserve la modification concurrente`);
  } finally {db.mutate=mutation;}
 });
 let api;try {api=await import('../src/domain/thermomix-reprise.js');} catch {ok(false,'audit TM7 : résolveur de reprise disponible');return;}
 const {resoudreVersionThermomix:resoudre,gardesAscendanceThermomix:gardes}=api;
 const deposer=rows=>{const map=new Map(rows.map(v=>[v.id,copie(v)]));return {map,lire:async id=>copie(map.get(id))};};
 let depot=deposer([f.original,f.version]);const resolution=await resoudre(f.version,{lire:depot.lire});
 eq(resolution,{ok:true,version:f.original,repli:{version_id:f.version.id,motifs:['eau_vapeur']},ancetres:[f.version,f.original]},'audit TM7 : reprise choisit le vrai original et capture toute l’ascendance');
 eq(await resoudre(f.original,{lire:depot.lire}),{ok:true,version:f.original,repli:null,ancetres:[f.original]},'audit TM7 : version ordinaire relue sans repli');
 depot=deposer([actuelle]);eq(await resoudre(actuelle,{lire:depot.lire}),{ok:true,version:actuelle,repli:null,ancetres:[actuelle]},'audit TM7 : version actuelle valide n’exige pas son parent');
 depot=deposer([chaine.original,chaine.parent,chaine.version]);
 eq((await resoudre(chaine.version,{lire:depot.lire})).ancetres,[chaine.version,chaine.parent,chaine.original],'audit TM7 : chaîne de deux générations capturée dans son ordre réel');
 depot=deposer([f.version]);eq(await resoudre(f.version,{lire:depot.lire}),{ok:false,raison:'source_absente'},'audit TM7 : snapshot du plan ne remplace jamais un parent absent');
 depot=deposer([{...f.original,recipe_id:'ailleurs'},f.version]);eq(await resoudre(f.version,{lire:depot.lire}),{ok:false,raison:'source_absente'},'audit TM7 : parent d’une autre recette refusé');
 depot=deposer([f.original,{...f.version,updated_at:'autre'}]);eq(await resoudre(f.version,{lire:depot.lire}),{ok:false,raison:'source_modifiee'},'audit TM7 : enfant changé après affichage refusé');
 const originalModifie=copie(f.original);originalModifie.steps[0].text+=' Une autre instruction.';
 depot=deposer([originalModifie,f.version]);eq(await resoudre(f.version,{lire:depot.lire}),{ok:false,raison:'source_modifiee'},'audit TM7 : parent réel déjà différent de la source du plan refusé');
 depot=deposer([{...f.original,updated_at:'2026-10-30T13:00:00Z'},f.version]);
 eq((await resoudre(f.version,{lire:depot.lire})).version?.updated_at,'2026-10-30T13:00:00Z','audit TM7 : date documentaire du parent sans changement de contenu capturée');
 const corrompue=copie(f.version);corrompue.steps[0].text+=' autre';depot=deposer([f.original,corrompue]);
 eq(await resoudre(corrompue,{lire:depot.lire}),{ok:false,raison:'version_modifiee'},'audit TM7 : document corrompu ne bénéficie pas du repli');
 const parentCorrompu=copie(chaine.parent);parentCorrompu.steps[0].text+=' autre';depot=deposer([chaine.original,parentCorrompu,chaine.version]);
 eq(await resoudre(chaine.version,{lire:depot.lire}),{ok:false,raison:'version_modifiee'},'audit TM7 : corruption d’un parent intermédiaire refuse la chaîne');
 const gs=gardes([f.version,f.original,copie(f.version)]);eq(gs.map(g=>g.key),[f.version.id,f.original.id],'audit TM7 : gardes d’ascendance dédupliquées par vraie identité');
 eq(gs.map(g=>g.fusion(copie(g.key===f.version.id?f.version:f.original))),[null,null],'audit TM7 : garde d’ascendance n’écrit aucune version');
 const input=[copie(f.version)];const captures=gardes(input);input[0].steps[0].text+=' muté';eq(captures[0].fusion(f.version),null,'audit TM7 : garde capture avant les mutations de l’appelant');
 eq(await raison(()=>gardes([f.original,{...f.original,updated_at:'autre'}])),'source_modifiee','audit TM7 : deux captures contradictoires du même parent refusées');
 eq(await raison(()=>gs[0].fusion({...f.version,updated_at:'autre'})),'source_modifiee','audit TM7 : garde refuse une version divergente');
 eq(await raison(()=>gs[1].fusion(undefined)),'source_modifiee','audit TM7 : garde refuse un parent disparu');
 await withRepo(async(repo,db)=>{
  await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.original,f.version]}});
  let cles;const depot={get:repo.get,saveBatch:(rows,options)=>{cles=options.conditions.recipe_versions.map(c=>c.key);return repo.saveBatch(rows,options)}};
  const creee=await enregistrerSessionCuisine(seance(f),{repo:depot,recettes:[await repo.capturerContexteRecette(f.recipe)],versionsAffichees:[f.original],ancetresThermomix:[f.version,f.original,f.original]});
  eq(creee.selected_version_ids,[f.original.id],'audit TM7 : nouvelle séance désigne l’original réel');
  eq([creee.servings,creee.progress],[8,{}],'audit TM7 : portions explicites et progression vide conservées');
  eq(new Set(cles).size,cles.length,'audit TM7 : couture cuisine déduplique aussi le parent sélectionné');
  eq(await db.get('recipe_versions',f.version.id),f.version,'audit TM7 : ancien plan intégralement conservé après reprise');
  eq(await db.get('recipe_versions',f.original.id),f.original,'audit TM7 : original intégralement conservé après reprise');
 });
}
