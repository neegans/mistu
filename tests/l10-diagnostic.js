export async function runL10DiagnosticTests({eq,ok}){
  const {projeterDiagnosticApp,texteDiagnosticApp}=await import('../src/domain/diagnostic-app.js');
  const secret='secret-recette-jeton-https://prive.example/',livraison={etat:'verifiee',execution:{release:'0.32.0-1',mode:'controlee',manifest_sha256:secret},controleur:{release:'0.32.0-1',complete:true},actif:{release:'0.32.0-1',complete:true},attente:{release:'0.32.1-1',complete:true},raison:null,url:secret};
  const source={version:'0.32.0',observe_le:'2026-10-30T12:00:00.000Z',reseau:'en_ligne',proprietaire:'present',livraison,envois:{en_attente:3,bloques:1,conflits:2,token:secret},fichiers:{declares:4,locaux:3,manquants:1,octets_locaux:1234,sha:secret},stockage:{utilisation_estimee:10000,quota_estime:20000},erreurs:{reseau:2,quota:1,refus:0,autre:1,message:secret},preparation:{format:1,etat:'partiel',observe_le:'2026-10-30T12:00:00.000Z',recettes:{total:2,disponibles:1,indisponibles:1,inconnues:0},medias:{selectionnes:2,exclus:1,utilisables:1,manquants:1,illisibles:0,inconnus:0},octets_connus:null},notes:secret,owner_id:secret};
  const d=projeterDiagnosticApp(source),texte=texteDiagnosticApp(d);
  ok(!texte.includes(secret),'L10 diagnostic : aucune donnée secrète hors projection');ok(!texte.includes('manifest_sha256')&&!texte.includes('owner_id'),'L10 diagnostic : hashes et identité exclus');eq(d.envois,{en_attente:3,bloques:1,conflits:2},'L10 diagnostic : seuls compteurs conservés');eq(d.preparation.medias.exclus,1,'L10 diagnostic : exclusions explicites du bilan');eq(d.stockage.quota_estime,20000,'L10 diagnostic : taille nommée estimation');
  const inconnu=projeterDiagnosticApp({version:secret,reseau:secret,proprietaire:secret,envois:{en_attente:NaN,bloques:-1,conflits:0.3},fichiers:{declares:Infinity},stockage:{quota_estime:secret},livraison:{...livraison,execution:{release:secret,mode:secret},attente:{release:secret,complete:'true'}}});
  eq(inconnu.envois,{en_attente:null,bloques:null,conflits:null},'L10 diagnostic : lectures invalides donnent inconnu pas zéro');eq(inconnu.proprietaire,'inconnu','L10 diagnostic : propriétaire inconnu sans identité');eq(inconnu.livraison.attente,{release:null,complete:null},'L10 diagnostic : worker malformé non positif');ok(!texteDiagnosticApp(inconnu).includes(secret),'L10 diagnostic : aucune interpolation brute en repli');
  eq(projeterDiagnosticApp({...source,preparation:{...source.preparation,texte:secret}}).preparation,null,'L10 diagnostic : DTO B ouvert refusé entier');eq(projeterDiagnosticApp({...source,preparation:{...source.preparation,medias:{...source.preparation.medias.utilisables,selectionnes:2}}}).preparation,null,'L10 diagnostic : compteurs B incohérents refusés');
  eq(projeterDiagnosticApp({}).preparation,null,'L10 diagnostic : absence de panneau sans ancien certificat');eq(projeterDiagnosticApp({observe_le:secret}).observe_le,null,'L10 diagnostic : horodatage arbitraire refusé');
  eq(projeterDiagnosticApp({...source,livraison:{...livraison,attente:{release:'0.32.0-secret',complete:true}}}).livraison.attente.release,null,'L10 diagnostic : suffixe texte interdit par format A');
  eq(projeterDiagnosticApp({...source,version:'0.32.0-secret'}).version,null,'L10 diagnostic : version applicative sans suffixe libre');
}
import {withRepo} from './sync-fixture.js';
const attendre=async fn=>{for(let n=0;n<250;n++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Diagnostic attendu absent');};

export async function runL10DiagnosticCollecteTests({eq,ok}){
  const {collecterDiagnosticApp,creerPanneauDiagnostic}=await import('../src/ui/settings.js');
  await withRepo(async(repo,db)=>{
    const sha='a'.repeat(64),absent='b'.repeat(64),secret='prive-jeton-recette';
    await db.mutate({origin:'remote',puts:{recipes:[{id:'l10-d1',original_title:secret,photo_sha256:sha},{id:'l10-d2',original_title:secret,photo_sha256:absent}],files:[{sha256:sha,blob:new Blob(['123']),size:3}],outbox:[{user_id:secret,store:'recipes',id:'l10-d1',op:'put',lifecycle_blocked:true,payload:{title:secret}},{user_id:'autre-prive',store:'recipes',id:'l10-d2',op:'put'}],sync_state:[{key:'user_id',value:secret},{key:'file_error:'+absent,value:{motif:'quota',sens:'reception'}}]}});
    let verifications=0;const observation={etat:'inconnue',execution:{release:'0.32.0-1',mode:'en_ligne_non_verifiee'},controleur:null,actif:null,attente:null};
    const livraison={verifier:async()=>{verifications++;return observation;},estCourante:o=>o===observation};
    const d=await collecterDiagnosticApp({depot:repo,livraison,navigateur:{onLine:false,storage:{estimate:async()=>{throw Error(secret);}}}});
    eq(d.envois.en_attente,1,'L10 diagnostic réel : file du propriétaire seulement');eq(d.envois.bloques,1,'L10 diagnostic réel : commande bloquée comptée');eq(d.fichiers,{declares:2,locaux:1,manquants:1,octets_locaux:3},'L10 diagnostic réel : référence sans ligne fichier reste manquante');eq(d.stockage,{utilisation_estimee:null,quota_estime:null},'L10 diagnostic réel : quota illisible reste inconnu');eq(d.erreurs.quota,1,'L10 diagnostic réel : code connu agrégé');ok(!JSON.stringify(d).includes(secret),'L10 diagnostic réel : aucun titre/compte/exception dans la sortie');eq(verifications,1,'L10 diagnostic réel : un contrôle explicite de livraison');eq(await db.count('outbox'),2,'L10 diagnostic réel : collecte sans écriture');
    let copies=0;const p=creerPanneauDiagnostic({collecter:async()=>d,navigateur:{clipboard:{writeText:async()=>{copies++;throw Error(secret);}}}});document.body.append(p);
    try{p.querySelector('[data-role=copier-diagnostic]').click();await attendre(()=>p.querySelector('textarea').value);const texte=p.querySelector('textarea');ok(!texte.hidden&&texte.readOnly,'L10 diagnostic écran : repli textuel sélectionnable');ok(!texte.value.includes(secret),'L10 diagnostic écran : repli déjà expurgé');eq(copies,1,'L10 diagnostic écran : une seule demande presse-papiers');ok(p.textContent.includes('Copie impossible'),'L10 diagnostic écran : aucun faux copié');}
    finally{p.dispose();p.remove();}
    let continuer;const attente=new Promise(r=>continuer=r),autre=document.createElement('button');autre.textContent='Autre commande';document.body.append(autre);
    const tardif=creerPanneauDiagnostic({collecter:async()=>{await attente;return d;},navigateur:{clipboard:{writeText:async()=>{throw Error('refus');}}}});document.body.append(tardif);
    try{tardif.querySelector('button').focus();tardif.querySelector('button').click();autre.focus();continuer();await attendre(()=>tardif.textContent.includes('Copie impossible'));ok(document.activeElement===autre,'L10 diagnostic écran : refus tardif ne vole pas un nouveau focus');}
    finally{continuer();tardif.dispose();tardif.remove();autre.remove();}
    const rate=creerPanneauDiagnostic({collecter:async()=>{throw Error('lecture refusee');}});document.body.append(rate);
    try{rate.querySelector('button').click();await attendre(()=>rate.textContent.includes('Le diagnostic n’a pas pu être relu.'));eq([rate.retientVue(),rate.querySelector('textarea').hidden],[false,true],'L10 diagnostic : collecte refusée sans résultat libère la rétention');}
    finally{rate.dispose();rate.remove();}
  });
}

// Le moteur existe sur l'hôte public même sans compte : son abonnement Réglages
// ne doit pas détruire une collecte ou le texte que la personne vient de demander.
export async function runL10DiagnosticActualisationTests({eq,ok}) {
  const {renderSettings} = await import('../src/ui/settings.js');
  const etat = await import('../src/ui/state.js');
  await withRepo(async (repo) => {
    const avant = etat.getSyncState(), adresse = location.href, historique = history.state;
    const stockage = navigator.storage, description = Object.getOwnPropertyDescriptor(stockage, 'estimate');
    let terminer, estimationCommencee = false, listener = null, rendus = 0, root = null;
    const attente = new Promise(resolve => { terminer = resolve; });
    const moteur = {etat: () => ({enCours:false}), onEtat(fn) { listener = fn; return () => { listener = null; }; }};
    const compter = () => { rendus++; };
    const pause = () => new Promise(resolve => setTimeout(resolve, 360));
    try {
      history.replaceState(historique, '', '#/settings');
      Object.defineProperty(stockage, 'estimate', {configurable:true, value:() => { estimationCommencee = true; return attente; }});
      etat.setSyncState({...avant, moteur, user:null, guard:null});
      root = await renderSettings({}, {}, {settings:await repo.getSettings(), sync:{user:null, auth:null, guard:null}});
      document.body.append(root);window.addEventListener('cuisineos:refresh', compter);
      listener();await pause();eq(rendus, 1, 'L10 diagnostic : Réglages au repos continue de suivre le moteur');rendus = 0;
      const panneau = root.querySelector('.diagnostic-app');listener();panneau.querySelector('button').click();
      await attendre(() => estimationCommencee);await pause();
      eq(rendus, 0, 'L10 diagnostic : le moteur ne remonte pas Réglages pendant la collecte');
      terminer({usage:1, quota:2});await attendre(() => panneau.querySelector('textarea').value && !panneau.querySelector('button').disabled);
      ok(!panneau.querySelector('textarea').hidden, 'L10 diagnostic : texte demandé disponible après la collecte');
      listener();await pause();eq(rendus, 0, 'L10 diagnostic : le résultat affiché reste disponible après un état moteur');
      root.dispose();root.remove();listener();await pause();
      eq(rendus, 1, 'L10 diagnostic : dispose libère la rétention sans bloquer une navigation');
    } finally {
      terminer({});window.removeEventListener('cuisineos:refresh', compter);root?.dispose();root?.remove();
      if (description) Object.defineProperty(stockage, 'estimate', description); else delete stockage.estimate;
      history.replaceState(historique, '', adresse);listener?.();etat.setSyncState(avant);
    }
  });
}
