import {el} from '../core/dom.js';
import {t} from '../core/i18n.js';
import {demanderGardeExplicite} from '../core/router.js';
import {releaseValide} from '../core/livraison-format.js';

const releaseAffichable=v=>releaseValide(v)?v:null;
export function texteResultatConservation(r) {
  if(r?.issue==='conserve')return t('Conservation confirmée pour cette saisie. Une nouvelle modification devra être conservée à son tour.');
  if(r?.issue==='sans_saisie_suivie')return t('Aucune saisie suivie détectée sur cet écran. Vérifie les autres fenêtres avant de les fermer.');
  if(r?.issue==='quitter_sans_conserver')return t('Cette saisie n’est pas conservée. Tu as choisi de pouvoir fermer cette fenêtre sans la garder.');
  if(r?.raison==='formulaire_ouvert')return t('Termine ou annule le formulaire ouvert avec ses propres commandes avant de fermer.');
  if(r?.raison==='contexte_change')return t('L’écran ou le compte a changé. Vérifie la saisie affichée avant de fermer.');
  if(r?.raison==='lecture_en_cours')return t('Une lecture est en cours. Attends sa fin avant de fermer cette fenêtre.');
  if(r?.raison==='rester')return t('Tu restes sur cet écran. La saisie non conservée est toujours présente.');
  return t('La conservation n’est pas confirmée. Garde cette fenêtre ouverte pour revoir ou récupérer ta saisie.');
}

export function creerStatutMiseAJour({livraison=null,lireVue,demander=demanderGardeExplicite}) {
  let detruit=false,enCours=false,sequence=0,vueSuivie=null;
  const racine=el('aside',{class:'mise-a-jour card stack',hidden:true,'aria-label':t('Mise à jour de l’application')}),titre=el('strong'),versions=el('p',{class:'muted'}),
    instructions=el('p',null,t('Pour utiliser cette mise à jour, conserve ton travail puis ferme toutes les fenêtres Mistu, y compris l’app installée. Rouvre ensuite Mistu.')),
    resultat=el('p',{role:'status',class:'muted',dataset:{role:'resultat-conservation'}});
  const effacerResultat=()=>{resultat.textContent='';revoir.hidden=true;};
  const suivreVue=()=>{const prochaine=lireVue?.()?.racine||null;if(prochaine===vueSuivie)return;for(const nom of['input','change'])vueSuivie?.removeEventListener(nom,effacerResultat,true);vueSuivie=prochaine;for(const nom of['input','change'])vueSuivie?.addEventListener(nom,effacerResultat,true);effacerResultat();};
  const courant=vue=>{try{return!detruit&&vue?.racine?.isConnected&&vue.estCourante?.()===true&&lireVue?.()?.racine===vue.racine;}catch{return false;}};
  const boutons=()=>{conserver.disabled=enCours;revoir.disabled=enCours;verifier.disabled=enCours;};
  async function conserverSaisie(intention){
    if(enCours||detruit)return;suivreVue();const vue=lireVue?.(),id=++sequence;if(!courant(vue)){resultat.textContent=texteResultatConservation({raison:'contexte_change'});return;}
    enCours=true;boutons();
    try{const r=await demander({intention,racine:vue.racine,estCourante:()=>courant(vue)});if(id!==sequence||!courant(vue))return;resultat.textContent=texteResultatConservation(r);revoir.hidden=r?.issue!=='refuse'||r?.raison==='formulaire_ouvert';}
    catch{if(id===sequence&&courant(vue))resultat.textContent=texteResultatConservation({issue:'refuse'});}
    finally{if(id===sequence){enCours=false;boutons();}}
  }
  const conserver=el('button',{type:'button',class:'btn',dataset:{role:'conserver-avant-fermeture'},onClick:()=>conserverSaisie('conserver')},t('Conserver mon travail')),
    revoir=el('button',{type:'button',class:'btn',hidden:true,dataset:{role:'revoir-avant-fermeture'},onClick:()=>conserverSaisie('revoir_sortie')},t('Revoir avant de fermer')),
    verifier=el('button',{type:'button',class:'btn',onClick:async()=>{if(enCours||detruit)return;enCours=true;boutons();recherche.textContent=t('Recherche de mise à jour…');try{const r=await livraison?.rechercherMiseAJour();if(detruit)return;if(r?.observation)dessiner(r.observation);recherche.textContent=r?.issue==='ok'?t('Recherche terminée.'):t('Impossible de rechercher une mise à jour pour le moment. Réessaie.');}catch{if(!detruit)recherche.textContent=t('Impossible de rechercher une mise à jour pour le moment. Réessaie.');}finally{enCours=false;if(!detruit)boutons();}}},t('Vérifier la mise à jour'));
  const recherche=el('p',{role:'status',class:'muted'});
  racine.append(titre,versions,instructions,el('div',{class:'row'},conserver,revoir,verifier),recherche,resultat);
  function dessiner(o){
    if(detruit)return;const actuelle=o&&livraison?.estCourante(o)===true,attente=actuelle?o.attente:null;
    // Une observation ancienne ne doit ni certifier l'attente, ni effacer une demande courante.
    if(o&&!actuelle)return;
    racine.hidden=!attente;const release=releaseAffichable(attente?.release),execution=releaseAffichable(o?.execution?.release);
    const prete=attente?.complete===true&&release;
    titre.textContent=prete?t('Mise à jour prête : {version}',{version:release}):t('La mise à jour reste à vérifier.');
    versions.textContent=execution?t('Cette fenêtre utilise encore la version {version}.',{version:execution}):t('La version de cette fenêtre n’est pas vérifiée.');
    instructions.hidden=!prete;conserver.hidden=!prete;suivreVue();
  }
  const stop=livraison?.observer(dessiner);dessiner(livraison?.etat());
  racine.actualiserVue=()=>{sequence++;enCours=false;suivreVue();boutons();};
  racine.dispose=()=>{if(detruit)return;detruit=true;sequence++;stop?.();for(const nom of['input','change'])vueSuivie?.removeEventListener(nom,effacerResultat,true);vueSuivie=null;};
  return racine;
}

// Disponible dans Réglages même lorsqu'aucune publication en attente n'a encore été découverte.
export function creerRechercheMiseAJour({livraison=null,estCourante=()=>true}={}){
  let detruit=false,enCours=false,resultat=null;
  const version=el('p',{class:'muted'}),etat=el('p',{role:'status'}),instructions=el('p',{hidden:true},t('Pour utiliser cette mise à jour, conserve ton travail puis ferme toutes les fenêtres Mistu, y compris l’app installée. Rouvre ensuite Mistu.'));
  const bouton=el('button',{type:'button',class:'btn',disabled:typeof livraison?.rechercherMiseAJour!=='function',onClick:async()=>{
    if(detruit||enCours||!estCourante())return;enCours=true;bouton.disabled=true;etat.textContent=t('Recherche de mise à jour…');
    try{resultat=await livraison.rechercherMiseAJour();}
    catch{resultat={issue:'echec'};}
    finally{enCours=false;if(!detruit){bouton.disabled=false;if(estCourante())dessiner(livraison?.estCourante(resultat?.observation)?resultat.observation:livraison?.etat());}}
  }},t('Rechercher une mise à jour'));
  const racine=el('section',{class:'card stack',dataset:{role:'recherche-mise-a-jour'}},el('h2',null,t('Mise à jour de l’application')),version,bouton,etat,instructions);
  function dessiner(o){
    if(detruit)return;const courante=o&&livraison?.estCourante(o),execution=courante?releaseAffichable(o.execution?.release):null,attente=courante?o.attente:null,prete=attente?.complete===true&&releaseAffichable(attente.release);
    version.textContent=execution?(prete?t('Cette fenêtre utilise encore la version {version}.',{version:execution}):t('Version de cette fenêtre : {version}.',{version:execution})):t('La version de cette fenêtre n’est pas vérifiée.');
    instructions.hidden=!prete;
    etat.textContent=prete?t('Mise à jour prête : {version}',{version:attente.release}):enCours?t('Recherche de mise à jour…'):resultat?resultat.issue==='ok'?t('Recherche terminée.'):t('Impossible de rechercher une mise à jour pour le moment. Réessaie.'):'';
  }
  const stop=livraison?.observer(dessiner);dessiner(livraison?.etat());
  racine.retientVue=()=>!detruit&&racine.isConnected&&(enCours||!!resultat);
  racine.dispose=()=>{detruit=true;stop?.();};return racine;
}
