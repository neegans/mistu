import {withRepo} from './sync-fixture.js';
import {getData} from '../src/ui/state.js';
import {renderRecipe} from '../src/ui/recipe.js';
import {setUiLocale} from '../src/core/i18n.js';
import {parseHash} from '../src/core/router.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {traductionLectureL6} from './l6-lecture-recette.js';

export async function runCorrectifLangueRecetteTests({eq,ok}){
 const scene=document.createElement('div'),roots=[];document.body.append(scene);setUiLocale('fr');
 const langue=(root,valeur)=>root.querySelector(`[data-role=langue-recette] button[data-value="${valeur}"]`);
 try{await withRepo(async repo=>{
  const f=fixtureLectureL6();f.recipe.availability='partial';
  const adaptation={...f.version,id:'langue-adaptation',kind:'adaptation'};
  await repo.db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version,adaptation]}});
  const ctx={...await getData(true),sync:{}};ctx.settings={...ctx.settings,reading_locale:'fr'};
  const adresses=[],deps={historique:{remplacer:href=>adresses.push(href)}};
  let root=await renderRecipe({id:f.recipe.id},{origine:'retour-test',v:f.version.id},ctx,deps);roots.push(root);scene.append(root);
  const avant=JSON.stringify(await repo.db.getAll('recipe_translations'));
  const avis=()=>root.querySelector('[data-role=etat-lecture]');
  ok(!!avis()?.closest('.lecture-langue'),'Langue : état et accès traduction auprès des boutons');
  ok(!avis()?.closest('[data-role=section-ingredients]'),'Langue : état indépendant de l’onglet Ingrédients');
  ok(avis()?.textContent.includes('Crée une version française'),'Langue : absence de traduction propose sa création');
  eq(root.querySelector('h1')?.textContent,'Bread','Langue : absence ne fabrique pas un titre traduit');
  const action=avis()?.querySelector('a[href*="assistant=1"]');
  eq(action?.textContent,'Créer la version française','Langue : action annonce le résultat enregistré attendu');
  ok(action?.classList.contains('primary'),'Langue : création française est l’action principale');
  ok(!!action?.closest('[data-role=fiche-etat]'),'Langue : préparation assistant visible dans l’en-tête');
  ok(avis()?.textContent.includes('avant de lancer la traduction'),'Langue : coût annoncé avant lancement sans nombre inventé');
  eq(new URLSearchParams(action?.hash.split('?')[1]).get('locale'),'fr','Langue : préparation vise le français');
  langue(root,'en').click();
  ok(avis()?.textContent.includes('déjà en anglais'),'Langue : anglais original explique pourquoi le texte reste identique');
  const choixAnglais=parseHash(adresses.at(-1)||'');
  eq(choixAnglais.query.lang,'en','Langue : adresse conserve le choix anglais');
  eq(choixAnglais.query.origine,'retour-test','Langue : contexte de retour conservé');
  eq(choixAnglais.query.v,f.version.id,'Langue : version conservée');
  root.dispose?.();root.remove();root=await renderRecipe({id:f.recipe.id},choixAnglais.query,ctx,deps);roots.push(root);scene.append(root);
  eq(langue(root,'en')?.getAttribute('aria-pressed'),'true','Langue : reconstruction conserve anglais malgré préférence française');
  langue(root,'original').click();
  ok(avis()?.textContent.includes('Texte original affiché'),'Langue : retour original confirmé près des boutons');
  langue(root,'fr').focus();langue(root,'fr').click();
  ok(document.activeElement===langue(root,'fr'),'Langue : focus conservé lors du changement');
  eq(JSON.stringify(await repo.db.getAll('recipe_translations')),avant,'Langue : aucune traduction enregistrée au changement');
  root.dispose?.();root.remove();
  const tr=await traductionLectureL6(f);ctx.recipe_translations=[tr,{...tr,id:'langue-seconde'}];
  root=await renderRecipe({id:f.recipe.id},{lang:'fr'},ctx,deps);roots.push(root);scene.append(root);
  const choix=avis()?.querySelector('select');
  ok(!!choix?.closest('.lecture-langue'),'Langue : choix concurrent près du sélecteur de langue');
  if(choix){choix.value='langue-seconde';choix.dispatchEvent(new Event('change',{bubbles:true}));}
  eq(root.querySelector('h1')?.textContent,'Pain','Langue : traduction choisie réellement affichée');
  const lire=avis()?.querySelector('a[data-role=version-francaise]');
  ok(lire?.hash.includes('translation=langue-seconde')&&!lire.hash.includes('assistant=1'),'Langue : version française complète se relit sans refaire la traduction');
  eq(parseHash(adresses.at(-1)||'').query.translation,'langue-seconde','Langue : candidate choisie conservée dans l’adresse');
  const adresseChoisie=parseHash(adresses.at(-1)||'');root.dispose?.();root.remove();
  root=await renderRecipe({id:f.recipe.id},adresseChoisie.query,ctx,deps);roots.push(root);scene.append(root);
  eq(root.querySelector('h1')?.textContent,'Pain','Langue : titre traduit conservé après reconstruction');
  eq(avis()?.querySelector('select')?.value,'langue-seconde','Langue : candidate exacte conservée après reconstruction');
  const hashAvant=location.hash;
  try{
   const versions=[...root.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value===adaptation.id));
   versions.value=adaptation.id;versions.dispatchEvent(new Event('change',{bubbles:true}));
   eq(parseHash().query.v,adaptation.id,'Langue : changer de version ouvre la version choisie');
   eq(parseHash().query.lang,'fr','Langue : changement de version conserve la langue');
   ok(!Object.hasOwn(parseHash().query,'translation'),'Langue : changement de version retire la candidate liée à l’ancienne version');
  }finally{history.replaceState(history.state,'',hashAvant||location.pathname);}
  langue(root,'en').click();
  ok(!Object.hasOwn(parseHash(adresses.at(-1)||'').query,'translation'),'Langue : autre langue efface la candidate précédente');
 });}finally{for(const root of roots)root.dispose?.();scene.remove();setUiLocale('fr');}
}
