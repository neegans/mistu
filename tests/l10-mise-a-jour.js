const attendre=async fn=>{for(let n=0;n<200;n++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Statut de mise à jour absent');};
export async function runL10MiseAJourTests({eq,ok}){
  const {creerStatutMiseAJour}=await import('../src/ui/mise-a-jour.js');
  let courant=null,listener=null,verifications=0,disposes=0,demande,liberer;
  const service={etat:()=>courant,estCourante:o=>o===courant,observer:f=>{listener=f;return()=>{listener=null;}},verifier:async()=>{verifications++;return courant;},dispose:()=>disposes++};
  const vue=document.createElement('div');document.body.append(vue);let valide=true;
  const racine=creerStatutMiseAJour({livraison:service,lireVue:()=>({racine:vue,estCourante:()=>valide}),demander:args=>{demande=args;return new Promise(r=>liberer=r);}});document.body.append(racine);
  try{
    ok(racine.hidden,'L10 mise à jour : aucune attente inventée au montage');eq(verifications,0,'L10 mise à jour : aucun polling ni vérification implicite du panneau');
    courant={etat:'verifiee',execution:{release:'0.31.0-1',mode:'controlee'},controleur:{release:'0.31.0-1',complete:true},attente:{release:'0.32.0-1',complete:true}};listener(courant);
    ok(!racine.hidden,'L10 mise à jour : attente complète visible');ok(racine.textContent.includes('0.32.0-1')&&racine.textContent.includes('0.31.0-1'),'L10 mise à jour : attente et écran exécuté distingués');
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
}
