const attendre=async fn=>{for(let n=0;n<200;n++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Statut de mise à jour absent');};
export async function runL10MiseAJourTests({eq,ok}){
  const {creerStatutMiseAJour}=await import('../src/ui/mise-a-jour.js');
  let courant=null,listener=null,verifications=0,recherches=0,disposes=0,demande,liberer;
  const service={etat:()=>courant,estCourante:o=>o===courant,observer:f=>{listener=f;return()=>{listener=null;}},verifier:async()=>{verifications++;return courant;},rechercherMiseAJour:async()=>{recherches++;return{issue:'ok',observation:courant};},dispose:()=>disposes++};
  const vue=document.createElement('div');document.body.append(vue);let valide=true;
  const racine=creerStatutMiseAJour({livraison:service,lireVue:()=>({racine:vue,estCourante:()=>valide}),demander:args=>{demande=args;return new Promise(r=>liberer=r);}});document.body.append(racine);
  try{
    ok(racine.hidden,'L10 mise à jour : aucune attente inventée au montage');eq(verifications,0,'L10 mise à jour : aucun polling ni vérification implicite du panneau');
    courant={etat:'verifiee',execution:{release:'0.31.0-1',mode:'controlee'},controleur:{release:'0.31.0-1',complete:true},attente:{release:'0.32.0-1',complete:true}};listener(courant);
    ok(!racine.hidden,'L10 mise à jour : attente complète visible');ok(racine.textContent.includes('0.32.0-1')&&racine.textContent.includes('0.31.0-1'),'L10 mise à jour : attente et écran exécuté distingués');
    const verifier=[...racine.querySelectorAll('button')].find(b=>b.textContent==='Vérifier la mise à jour');verifier.click();await attendre(()=>!verifier.disabled);
    eq(recherches,1,'Actualisation : vérifier demande une vraie recherche de publication');eq(verifications,0,'Actualisation : bouton ne se limite pas à relire le cache local');
    const conserver=racine.querySelector('[data-role=conserver-avant-fermeture]');conserver.focus();conserver.click();await attendre(()=>demande);
    eq(demande.intention,'conserver','L10 mise à jour : demande de conservation sans navigation');ok(demande.racine===vue,'L10 mise à jour : racine réellement courante');ok(conserver.disabled,'L10 mise à jour : un geste en cours');liberer({issue:'refuse',raison:'formulaire_ouvert'});await attendre(()=>!conserver.disabled);
    ok(racine.textContent.includes('Termine ou annule'),'L10 mise à jour : formulaire protégé expliqué');ok(vue.isConnected,'L10 mise à jour : refus ne dispose pas la vue');
    racine.querySelector('[data-role=revoir-avant-fermeture]').click();await attendre(()=>demande.intention==='revoir_sortie');liberer({issue:'quitter_sans_conserver'});await attendre(()=>!conserver.disabled);
    ok(racine.textContent.includes('n’est pas conservée'),'L10 mise à jour : abandon ne devient pas conservé');
    conserver.click();await attendre(()=>demande.intention==='conserver');liberer({issue:'conserve'});await attendre(()=>!conserver.disabled);ok(racine.textContent.includes('Conservation confirmée'),'L10 mise à jour : succès après résultat seulement');
    vue.dispatchEvent(new Event('input',{bubbles:true}));ok(!racine.textContent.includes('Conservation confirmée'),'L10 mise à jour : nouvelle saisie retire ancien succès');
    const ancienne=courant;courant={...courant,attente:{release:null,complete:null},etat:'inconnue'};listener(courant);ok(!racine.textContent.includes('Mise à jour prête'),'L10 mise à jour : inconnue ne dit pas prête');listener(ancienne);ok(!racine.textContent.includes('Mise à jour prête'),'L10 mise à jour : ancien constat ignoré');
    courant={...courant,attente:{release:'0.32.0-secret',complete:true}};listener(courant);ok(!racine.textContent.includes('0.32.0-secret')&&!racine.textContent.includes('Mise à jour prête'),'L10 mise à jour : suffixe arbitraire refusé comme protocole A');
    racine.dispose();eq(listener,null,'L10 mise à jour : souscription nettoyée');eq(disposes,0,'L10 mise à jour : singleton global conservé');
  }finally{valide=false;racine.dispose();racine.remove();vue.remove();}
  await runRechercheMiseAJourTests({eq,ok});
}

async function runRechercheMiseAJourTests({eq,ok}){
 const api=await import('../src/ui/mise-a-jour.js');if(!api.creerRechercheMiseAJour){ok(false,'Actualisation : recherche accessible sans worker en attente');return;}
 let observation={execution:{release:'0.32.0-5'},attente:null},listener,liberer,recherches=0;
 const service={etat:()=>observation,estCourante:o=>o===observation,observer:f=>{listener=f;return()=>listener=null;},rechercherMiseAJour:()=>{recherches++;return new Promise(r=>liberer=r);}};
 const panneau=api.creerRechercheMiseAJour({livraison:service});document.body.append(panneau);
 try{
  const bouton=panneau.querySelector('button');ok(!!bouton&&!bouton.closest('[hidden]'),'Actualisation : recherche visible sans attente connue');
  ok(panneau.textContent.includes('0.32.0-5'),'Actualisation : version de cette fenêtre indiquée');eq(recherches,0,'Actualisation : monter le panneau ne lance pas un second détecteur');
  bouton.click();ok(bouton.disabled,'Actualisation : recherche désactivée pendant son attente');ok(panneau.retientVue(),'Actualisation : recherche protégée des refresh moteur');
  listener(observation);ok(panneau.textContent.includes('Recherche de mise à jour…'),'Actualisation : observation intermédiaire ne masque pas la recherche');
  bouton.click();eq(recherches,1,'Actualisation : double clic ne lance pas deux recherches');
  liberer({issue:'echec',raison:'indisponible',observation});await attendre(()=>!bouton.disabled);
  ok(panneau.textContent.includes('Impossible de rechercher'),'Actualisation : erreur réseau explicitée');ok(!panneau.textContent.includes('à jour.'),'Actualisation : réseau en échec ne certifie pas une absence de mise à jour');
  bouton.click();listener(observation);ok(panneau.textContent.includes('Recherche de mise à jour…'),'Actualisation : réessai ne réaffiche pas l’ancienne erreur pendant la recherche');liberer({issue:'ok',observation});await attendre(()=>!bouton.disabled);
  ok(panneau.textContent.includes('Recherche terminée'),'Actualisation : fin de recherche rendue');ok(panneau.retientVue(),'Actualisation : résultat reste lisible malgré le moteur');
  observation={...observation,attente:{release:'0.32.0-6',complete:true}};listener(observation);
  ok(panneau.textContent.includes('Mise à jour prête : 0.32.0-6'),'Actualisation : attente arrivée ensuite affichée');
  ok(panneau.textContent.includes('Cette fenêtre utilise encore la version 0.32.0-5'),'Actualisation : version en attente jamais confondue avec version exécutée');
  ok(panneau.textContent.includes('ferme toutes les fenêtres Mistu'),'Actualisation : geste nécessaire expliqué');
  panneau.dispose();eq(listener,null,'Actualisation : abonnement disposé');ok(!panneau.retientVue(),'Actualisation : panneau disposé ne retient plus la vue');
 }finally{panneau.dispose();panneau.remove();}
}
