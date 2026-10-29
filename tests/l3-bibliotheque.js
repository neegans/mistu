import { sourceReperes, reponseReperes } from './visuel-reperes.js';
import * as R from '../src/domain/reperes.js';

export async function runL3BibliothequeTests({ eq, ok }) {
  let B; try { B = await import('../src/domain/bibliotheque.js'); } catch { ok(false, 'L3 : projection bibliothèque disponible'); return; }
  const recipes = [
    { id:'a', original_title:'Épinards', edition_id:'ed', availability:'available', current_version_id:'va', favorite:true },
    { id:'b', original_title:'Bouillon', edition_id:'ed', availability:'partial', source_url:'https://example.invalid/b' },
    { id:'c', original_title:'Carottes', edition_id:'ed', availability:'reference_only' },
    { id:'d', original_title:'Dahl', availability:'futur', origine:'ia' },
    { id:'e', original_title:'Omelette', availability:'available', current_version_id:'ve' },
  ];
  const editions = [{id:'ed',book_id:'livre'}];
  const versions = [{id:'va',recipe_id:'a',ingredients:[{ingredient_id:'epinard',name_text:'Épinards'}],steps:[{text:'Cuire'}],verification_state:'to_verify'}, {id:'ve',recipe_id:'e',ingredients:[{ingredient_id:'oeuf',name_text:'Œuf'}],steps:[{text:'Cuire'}],verification_state:'verified'}];
  const ctx = {recipes,recipe_versions:versions,book_editions:editions,books:[{id:'livre',title:'Cuisine verte'}],cook_history:[{id:'h',recipe_id:'a'}]};
  const p = (s={},c=ctx) => B.projeterBibliotheque(c,B.normaliserEtatBibliotheque(s));
  const ids = x => x.items.map(i=>i.recipe.id);
  eq(p().total,5,'L3 : références incluses sans recherche');
  eq(p({}, {...ctx,cook_history:[{recipe_id:'a'},{recipe_id:'a'}]}).items.find(i=>i.recipe.id==='a').cooked,2,'L3 : nombre réel de cuissons conservé');
  eq(p().compteurs,{available:2,partial:1,reference_only:1,unknown:1},'L3 : compteurs séparent inconnues et partielles');
  eq(ids(p({sources:['livres','ia']})),['b','c','d','a'],'L3 : union des sources, ordre titre stable sans dates');
  eq(ids(p({sources:['livres'],favoris:true,cuisinees:true,aRelire:true})),['a'],'L3 : intersection des filtres réels');
  eq(ids(p({sources:['web']})),['b'],'L3 : livre et web peuvent coexister');
  eq(ids(p({sources:['personnelles']})),['e'],'L3 : personnelle sans origine livre web ou IA');
  eq(ids(p({disponibilites:['unknown']})),['d'],'L3 : disponibilité inconnue explicite');
  eq(ids(p({q:'epinards'})),['a'],'L3 : texte normalisé sans accents');
  eq(ids(p({q:'Cuisine verte',ingredientIds:['epinard']})),['a'],'L3 : livre et ingrédient réel croisés');
  eq(p({ingredientIds:['epinard','oeuf']}).total,0,'L3 : ingrédients tous requis');
  eq(p({rapide:true}).total,0,'L3 : durée inconnue non rapide');
  eq(p({maxMinutes:30}).total,0,'L3 : durée inconnue exclue du maximum');
  eq(p({appareil:'tm7'}).total,0,'L3 : aucune compatibilité appareil inférée');
  const T=await import('../src/domain/thermomix.js'),fixture=await import('./i3-thermomix.js'),source=fixture.sourceThermomix(),contexte=T.construireContexteThermomix({version:source,selection:['s1']});
  let seq=0;const tm=T.fabriquerVersionThermomix({source,contexte,resultat:fixture.propositionThermomix(),id:'tm-courant',newId:()=>`etape-${++seq}`,maintenant:'2026-10-29T12:00:00Z',modele:'test'});
  const tmRecipe={id:source.recipe_id,original_title:'Sauce',availability:'available',current_version_id:tm.id},tmCtx={recipes:[tmRecipe],recipe_versions:[source,tm]};
  eq(p({appareil:'tm7'},tmCtx).total,1,'L3 : appareil retient adaptation TM7 courante validée');
  eq(p({appareil:'tm7'},{...tmCtx,recipes:[{...tmRecipe,current_version_id:source.id}]}).total,0,'L3 : adaptation TM7 d’une autre version ne qualifie pas original courant');
  eq(p({appareil:'tm7'},{...tmCtx,recipe_versions:[source,{...tm,steps:[{...tm.steps[0],text:'Étape changée sans revalidation.'},...tm.steps.slice(1)]}]}).total,0,'L3 : plan TM7 invalidé ne qualifie pas appareil');
  const missing = p({editionId:'efface'});
  eq([missing.total,missing.filtresIndisponibles],[0,[{champ:'editionId',valeur:'efface'}]],'L3 : édition absente ne retire pas le filtre');
  const keep={...ctx,book_editions:[{...editions[0],lifecycle_id:'keep',trashed_at:'2026-10-29T10:00:00.000Z',trash_mode:'keep_recipes'}]};
  eq(p({editionId:'ed'},keep).total,3,'L3 : recettes conservées dans livre retiré filtrables');
  const group={...ctx,book_editions:[{...editions[0],lifecycle_id:'group',trashed_at:'2026-10-29T10:00:00.000Z',trash_mode:'with_recipes'}],recipes:recipes.map(r=>r.id==='a'?{...r,restored_from_edition:{edition_id:'ed',lifecycle_id:'group'}}:r)};
  eq(ids(p({editionId:'ed'},group)),['a'],'L3 : exception de restauration membre courante');
  group.book_editions[0].lifecycle_id='autre';
  eq(p({editionId:'ed'},group).total,0,'L3 : exception ancienne non réutilisée');
  eq(p({}, {...ctx,recipes:[{...recipes[0],lifecycle_id:33}]}).total,0,'L3 : cycle invalide hors de la liste active');
  const {recipe,version}=sourceReperes(),c=R.construireContexteReperes({recipe,version});
  const ready={...recipe,current_version_id:version.id,reperes:R.fusionnerReperes(null,{proposition:R.fabriquerPropositionReperes({contexte:c,resultat:reponseReperes(),modele:'test'})})};
  const timed={recipes:[ready],recipe_versions:[version]};
  eq(p({rapide:true},timed).total,1,'L3 : rapide utilise repères de la bonne version');
  eq(p({maxMinutes:24},timed).total,0,'L3 : maximum applique borne haute de la plage');
  eq(p({maxMinutes:25},timed).total,1,'L3 : borne haute égale admise');
  timed.recipes=[{...ready,current_version_id:'v2'}];timed.recipe_versions.push({...version,id:'v2'});
  eq(p({rapide:true},timed).total,0,'L3 : autre version ne reprend pas ancienne estimation');
  timed.recipes=[{...ready,current_version_id:'intruse'}];timed.recipe_versions.push({...version,id:'intruse',recipe_id:'autre'});
  eq(p({rapide:true},timed).total,0,'L3 : version désignée étrangère non remplacée silencieusement');
  const many={recipes:Array.from({length:125},(_,i)=>({id:'r'+String(i).padStart(3,'0'),original_title:'Même titre',availability:'reference_only'}))};
  eq(p({limite:60},many).total,125,'L3 : domaine projette avant pagination');
  eq(ids(p({presentation:'grille'},many)),ids(p({presentation:'liste'},many)),'L3 : même ordre et identités grille/liste');
  eq(ids(p({tri:'titre'},many)).slice(0,3),['r000','r001','r002'],'L3 : identifiant départage titres identiques');
  const dates={recipes:[{id:'invalid',original_title:'A',updated_at:'zzz'},{id:'old',updated_at:'2025-01-01T00:00:00Z'},{id:'new',updated_at:'2026-01-01T00:00:00Z'}]};
  eq(ids(p({},dates)),['new','old','invalid'],'L3 : dates invalides après dates valides');
  const before=JSON.stringify(ctx);p({sources:['livres'],tri:'page'});eq(JSON.stringify(ctx),before,'L3 : projection pure sans modification des données');
  const n=B.normaliserEtatBibliotheque({sources:['web','web','inconnu'],disponibilites:['partial','bidon'],limite:121,maxMinutes:-5,ingredientIds:[null,'x','x'],appareil:'four',tri:'fake'});
  eq([n.sources,n.disponibilites,n.limite,n.maxMinutes,n.ingredientIds,n.appareil,n.tri],[['web'],['partial'],120,null,['x'],null,'modification'],'L3 : filtres bornés et enums validées');
}
