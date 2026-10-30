import {segmented, filterChips, field} from '../src/ui/components.js';
import {withRepo} from './sync-fixture.js';

const attendre = async fn => {
  for (let n = 0; n < 200; n++) { if (await fn()) return; await new Promise(r => setTimeout(r, 5)); }
  throw Error('Résultat du sélecteur attendu absent');
};

export async function runL9SelecteursTests({eq, ok}) {
  let appels = 0, valeur = null;
  const choix = segmented([{value:'original',label:'Original'},{value:'fr',label:'Français'}], 'original', v => {
    appels++; valeur = v; choix.selectionner?.(v);
  }, {nom:'Langue de lecture'});
  const hote = document.createElement('div'); hote.append(choix); document.body.append(hote);
  try {
    eq(choix.getAttribute('role'), 'group', 'L9 sélecteur : choix sans faux tablist');
    eq(choix.getAttribute('aria-label'), 'Langue de lecture', 'L9 sélecteur : groupe nommé');
    const boutons = [...choix.querySelectorAll('button')];
    eq(boutons.map(b => [b.type,b.tabIndex,b.getAttribute('aria-pressed')]), [['button',0,'true'],['button',0,'false']], 'L9 sélecteur : boutons natifs et état initial exact');
    boutons[1].focus(); boutons[1].click();
    eq([appels,valeur], [1,'fr'], 'L9 sélecteur : un geste appelle une fois le choix');
    eq(boutons.map(b => [b.classList.contains('active'),b.getAttribute('aria-pressed')]), [[false,'false'],[true,'true']], 'L9 sélecteur : choix confirmé actualise état visuel et accessible');
    ok(document.activeElement === boutons[1], 'L9 sélecteur : actualiser garde le même bouton focalisé');
    choix.selectionner?.('original');
    eq(appels, 1, 'L9 sélecteur : projection ne réexécute pas le geste');
    const groupe = segmented([{value:'a',label:'A'}], 'a', () => {});
    const champ = field('Unités souhaitées', groupe, 'Aide'); hote.append(champ);
    eq(champ.tagName, 'DIV', 'L9 champ groupe : aucun label visant arbitrairement premier bouton');
    eq(groupe.getAttribute('aria-label'), 'Unités souhaitées', 'L9 champ groupe : nom fourni par le champ');
    const input = document.createElement('input'), champInput = field('Titre', input); hote.append(champInput);
    eq(champInput.tagName, 'LABEL', 'L9 champ simple : label natif conservé');
    const puce = {kind:'include',value:'farine'}, lexique = new Map([['farine',{labels:{fr:{label:'farine'}}}]]);
    let retraits = 0, retiree = null;
    const filtres = filterChips([puce],lexique,c => {retraits++;retiree=c;}); hote.append(filtres);
    const b = filtres.firstElementChild;
    eq([b.tagName,b.type,b.tabIndex], ['BUTTON','button',0], 'L9 filtre : retrait natif atteignable au clavier');
    eq(b.getAttribute('aria-label'), 'Retirer le filtre : avec farine', 'L9 filtre : nom comprend action et filtre');
    b.focus(); b.click(); eq([retraits,retiree], [1,puce], 'L9 filtre : retrait unique avec même filtre');
    const lecture = filterChips([puce],lexique); hote.append(lecture);
    eq(lecture.firstElementChild.tagName, 'SPAN', 'L9 filtre documentaire : aucun faux bouton sans retrait');
    ok(!lecture.querySelector('[tabindex],button'), 'L9 filtre documentaire : aucune étape clavier inutile');
  } finally { hote.remove(); }
}

export async function runL9ContraintesRepasTests({eq,ok}) {
  const {renderMeal} = await import('../src/ui/meals.js'), {getData} = await import('../src/ui/state.js');
  for (const scenario of ['confirme','quota','conflit']) await withRepo(async (repo) => {
    const repas = {id:'l9-repas-'+scenario,title:'Souper',items:[],servings:4,planned_on:null,serve_at:null,constraints_snapshot:{diets:[]}};
    await repo.save('meals',repas);
    const profilAvant=await repo.all('settings'), messages=[]; let ecritures=0, terminee=false, liberer;
    const pause = new Promise(r => liberer=r);
    const racine=await renderMeal({id:repas.id},{},await getData(true),{refresh:()=>{},toast:t=>messages.push(t),repo:{
      saveBatch:async(...args)=>{ecritures++;await pause;try{if(scenario==='quota')throw new DOMException('plein','QuotaExceededError');return await repo.saveBatch(...args);}finally{terminee=true;}}
    }});
    document.body.append(racine);
    try {
      const groupe=racine.querySelector('[data-role=contraintes-repas]');
      ok(!!groupe, `L9 contraintes ${scenario} : groupe nommé présent`);
      const bouton=groupe?.querySelector('button')??racine.querySelector('.chip.clickable');
      eq([bouton?.tagName,groupe?.getAttribute('aria-label')],['BUTTON','Contraintes de ce repas (invités inclus)'],`L9 contraintes ${scenario} : bouton et groupe accessibles`);
      const jour=racine.querySelector('[data-role=jour-repas]'); jour.value='2026-11-08';jour.dispatchEvent(new Event('input'));
      if(scenario==='conflit') await repo.save('meals',{...(await repo.get('meals',repas.id)),constraints_snapshot:{diets:['vegetarien']}});
      bouton.focus();bouton.click();await attendre(()=>ecritures===1);
      eq(bouton.getAttribute('aria-pressed'),'true',`L9 contraintes ${scenario} : choix affiché dès geste`);
      ok(racine.querySelector('[data-role=etat-contraintes]')?.textContent.includes('Conservation'),`L9 contraintes ${scenario} : attente annoncée sans réussite`);
      liberer();
      await attendre(()=>terminee); await new Promise(r=>setTimeout(r,0));
      eq(ecritures,1,`L9 contraintes ${scenario} : une seule demande de conservation`);
      eq(jour.value,'2026-11-08',`L9 contraintes ${scenario} : jour non conservé intact`);
      ok(racine.etatEditeur().sale,`L9 contraintes ${scenario} : autre saisie reste protégée`);
      ok(document.activeElement===bouton,`L9 contraintes ${scenario} : focus reste sur nœud utilisable`);
      eq(await repo.all('settings'),profilAvant,`L9 contraintes ${scenario} : profil personnel intact`);
      const sauve=(await repo.get('meals',repas.id)).constraints_snapshot.diets;
      if(scenario==='confirme') {
        eq(sauve.length,1,'L9 contraintes : choix effectivement enregistré');
        const relue=await renderMeal({id:repas.id},{},await getData(true),{refresh:()=>{},toast:()=>{}});
        try{eq(relue.querySelector('[data-role=contraintes-repas] button')?.getAttribute('aria-pressed'),'true','L9 contraintes : sélection relue depuis base');}finally{relue.dispose();relue.remove();}
      } else {
        eq(sauve,scenario==='quota'?[]:['vegetarien'],`L9 contraintes ${scenario} : base concurrente ou refusée intacte`);
        ok(racine.querySelector('[data-role=etat-contraintes]')?.textContent.includes('non enregistrées'),`L9 contraintes ${scenario} : refus distinct du choix affiché`);
        eq(bouton.getAttribute('aria-pressed'),'true',`L9 contraintes ${scenario} : saisie refusée gardée sans remonter formulaire`);
      }
    } finally {liberer();racine.dispose();racine.remove();}
  });
}

export async function runL9RaccordsSelecteursTests({eq,ok}) {
  const {getData} = await import('../src/ui/state.js');
  const {renderRecipe}=await import('../src/ui/recipe.js'),{renderSettings}=await import('../src/ui/settings.js');
  const {renderSearch}=await import('../src/ui/search.js'),{renderLibrary}=await import('../src/ui/library.js'),{renderKitchen}=await import('../src/ui/kitchen.js');
  await withRepo(async repo=>{
    const recette={id:'l9-r',original_title:'Pain',original_language:'fr',availability:'available',current_version_id:'l9-v'},version={id:'l9-v',recipe_id:'l9-r',kind:'manual',servings:4,ingredients:[{id:'l9-i',name_text:'Farine',source_text:'100 g farine',quantity:{value:100},unit_id:'g'}],steps:[{id:'l9-s',text:'Mélanger.'}]};
    await repo.saveBatch({recipes:[recette],recipe_versions:[version]},{conditions:{recipes:[{key:recette.id,absente:true}]}});
    const source=await repo.get('recipe_versions',version.id),ctx=await getData(true);
    for(const [nom,render,params,query] of [['fiche',renderRecipe,{id:recette.id},{v:version.id}],['réglages',renderSettings,{},{}],['recherche',renderSearch,{},{}],['bibliothèque',renderLibrary,{},{}],['cuisine',renderKitchen,{},{}]]){
      const racine=await render(params,query,ctx);document.body.append(racine);
      try{
        const groupes=[...racine.querySelectorAll('.segmented')];
        ok(groupes.length>0,`L9 raccord ${nom} : contrôles réels montés`);
        ok(groupes.every(g=>g.getAttribute('role')==='group'&&!!g.getAttribute('aria-label')),`L9 raccord ${nom} : tous les groupes nommés`);
        ok(groupes.every(g=>[...g.querySelectorAll('button')].every(b=>['true','false'].includes(b.getAttribute('aria-pressed')))),`L9 raccord ${nom} : tous les états explicites`);
        if(nom==='fiche'){
          const unites=groupes.find(g=>g.getAttribute('aria-label')==='Unités');
          unites.querySelector('[data-value=metric]').click();
          eq(unites.querySelector('[data-value=metric]').getAttribute('aria-pressed'),'true','L9 raccord fiche : unité choisie reste projetée après redessin du corps');
          const onglets=racine.querySelector('[data-role=onglets-corps]');onglets.querySelector('[data-value=preparation]').click();
          eq(onglets.querySelector('[data-value=preparation]').getAttribute('aria-pressed'),'true','L9 raccord fiche : panneau préparation sans faux onglets');
          eq(await repo.get('recipe_versions',version.id),source,'L9 raccord fiche : lecture ne réécrit pas la version');
        }
      }finally{racine.dispose?.();racine.remove();}
    }
  });
}
