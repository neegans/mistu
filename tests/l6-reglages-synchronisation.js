import {syncSectionModel,syncSectionL3} from '../src/ui/settings.js';
export async function runL6ReglagesSynchronisationTests({eq,ok}){
 const ctx={available:true,user:{id:'u'},guard:{ok:true},moteur:{enCours:false}},appels=[];
 const gestes=Object.fromEntries(['garderIci','garderAilleurs','ignorerConflit','abandonner','reessayer'].map(k=>[k,id=>appels.push([k,id])]));
 const conflit={id:'c-tr',kind:'translation',store:'recipe_translations',record_id:'tr',local:{op:'translation_apply',recipe_id:'r/1',recipe_version_id:'v/1',translation:{translated_content:{segments:[{text:'Pain conservé'}]}}},server:null,at:'2026-10-30T00:00:00Z'};
 const phase={seq:1,op:'put',store:'imports',id:'j',snapshot:{kind:'traduction',recipe_id:'r/1',resultat:{segments:[{text:'Réponse conservée'}]}},last_error:'translation_reserved'},commande={seq:2,op:'translation_apply',store:'recipe_translations',id:'tr',payload:conflit.local,last_error:'source_changee'};
 const model=syncSectionModel({...ctx,conflits:[conflit],quarantaine:[phase,commande]});
 const root=document.createElement('div');root.append(...syncSectionL3(model,gestes));
 eq(root.querySelectorAll('[data-conflit] button').length,0,'L6 réglages : copie traduction sans faux choix générique');
 ok(root.querySelector('[data-conflit] pre')?.textContent.includes('Pain conservé'),'L6 réglages : traduction refusée consultable en texte');
 eq(root.querySelector('[data-conflit] a')?.getAttribute('href'),'#/recipes/r%2F1','L6 réglages : lien recette exacte de la commande');
 eq([...root.querySelectorAll('[data-quarantaine] button')].filter(b=>b.textContent==='Abandonner cet envoi').length,0,'L6 réglages : phase et commande signées sans abandon inopérant');
 eq([...root.querySelectorAll('[data-quarantaine] button')].filter(b=>b.textContent==='Réessayer').length,2,'L6 réglages : réessai conservé pour les envois protégés');
 eq(root.querySelectorAll('[data-quarantaine] a[href="#/recipes/r%2F1"]').length,2,'L6 réglages : chaque envoi protégé renvoie à sa recette');
 ok(!root.textContent.includes('Choisis celle qui compte'),'L6 réglages : copie documentaire sans consigne de fusion générique');
 const journal={...conflit,id:'c-j',store:'imports',local:{kind:'traduction',recipe_id:'r-j',resultat:{segments:[{text:'Réponse en attente'}]}}},source={...conflit,id:'c-source',kind:'source',store:'scan_sessions',local:{op:'source_revision',id:'session/1',edition_id:'ed/1'}};
 const autre=document.createElement('div');autre.append(...syncSectionL3(syncSectionModel({...ctx,conflits:[journal,source]}),gestes));
 ok(autre.querySelector('[data-conflit="c-j"] pre')?.textContent.includes('Réponse en attente'),'L6 réglages : réponse de journal consultable');
 eq(autre.querySelector('[data-conflit="c-j"] a')?.getAttribute('href'),'#/recipes/r-j','L6 réglages : recette du journal conservée');
 eq(autre.querySelector('[data-conflit="c-source"] button'),null,'L6 réglages : conflit source sans faux gestes génériques');
 eq(autre.querySelector('[data-conflit="c-source"] a')?.getAttribute('href'),'#/import?session=session%2F1','L6 réglages : comparaison source dans son écran');
 const ancien=document.createElement('div');ancien.append(...syncSectionL3(syncSectionModel({...ctx,conflits:[{...conflit,id:'legacy',kind:'same_time'}],quarantaine:[{seq:3,store:'books',id:'b',op:'put'}]}),gestes));
 eq(ancien.querySelectorAll('[data-conflit] button').length,2,'L6 réglages : anciens choix encore disponibles');
 ok([...ancien.querySelectorAll('button')].some(b=>b.textContent==='Abandonner cet envoi'),'L6 réglages : abandon ordinaire conservé');
 eq(appels.length,0,'L6 réglages : aucune action au simple rendu');
}
