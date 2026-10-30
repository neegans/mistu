import { el, downloadBlob, confirmDialog, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';

export function texteErreurBrouillon(resultat){
 const raison=typeof resultat==='string'?resultat:resultat?.raison;
 if(['compte_change','contexte_change'].includes(raison))return t('Le compte ou la bibliothèque a changé. Ta saisie reste ici, sans être enregistrée sous le nouveau compte.');
 if(raison==='bibliotheque_remplacee')return t('La bibliothèque a été remplacée. Tu peux récupérer ton texte avant de reprendre sur la nouvelle bibliothèque.');
 if(['revision_changee','source_changee','cycle_change','association_changee','champ_change','pointeur_change','journal_change','journal_terminal'].includes(raison))return t('Le contenu a changé ailleurs. Ta saisie est conservée ici ; compare les valeurs avant de continuer.');
 if(['limite_brouillon','limite_nombre','limite_totale','quota_stockage'].includes(raison))return t('Le stockage disponible ne permet pas de conserver ce brouillon. Copie ton texte ou libère un ancien brouillon, puis réessaie.');
 if(raison==='limite_publication')return t('Ce contenu est trop volumineux pour être publié. Ton brouillon reste disponible sur cet appareil.');
 if(['format_inconnu','contenu_invalide'].includes(raison))return t('Ce brouillon ne peut pas être repris sous cette forme. Tu peux récupérer son texte.');
 if(raison==='absent')return t('Ce brouillon ou sa source n’est plus disponible.');
 return t('La saisie n’a pas pu être conservée sur cet appareil. Elle reste dans le formulaire. Réessaie.');
}

export function creerControleurEditeur({service,session,revision=null,id=null,lirePayload,delai=400}){
 let numero=0,confirme=0,enCours=false,timer=null,detruit=false,publie=false,pending=null,saved_at=null,dernierResultat=null;
 const listeners=new Set();
 const etat=()=>({sale:!publie&&numero!==confirme,enCours,id,revision,saved_at,dernierResultat,publie});
 const emettre=()=>{if(!detruit)for(const fn of listeners)fn(etat());};
 const echec=e=>({issue:'echec',raison:e?.name==='QuotaExceededError'?'quota_stockage':'stockage_indisponible',reessayable:true});
 const flush=()=>{
  clearTimeout(timer);timer=null;if(pending)return pending;
  if(detruit)return Promise.resolve({issue:'refuse',raison:'contexte_change'});
  if(publie||numero===confirme)return Promise.resolve({issue:'ok',id,revision,saved_at});
  pending=(async()=>{
   enCours=true;emettre();
   await Promise.resolve(); // laisser pending prendre sa valeur avant toute erreur synchrone de sérialisation
   try{while(!detruit&&!publie&&numero!==confirme){
    const cible=numero;let result;
    try{const payload=structuredClone(lirePayload());result=await service.conserverBrouillon({session,expectedRevision:revision,payload});}catch(e){result=echec(e);}
    dernierResultat=result;
    if(result.issue!=='ok')return result;
    id=result.id;revision=result.revision;saved_at=result.saved_at;confirme=cible;emettre();
   }return{issue:'ok',id,revision,saved_at};
   }finally{enCours=false;pending=null;if(numero===confirme)clearTimeout(timer);emettre();}
  })();return pending;
 };
 return{etat,flush,lireTexte:()=>texteModeleEditeur(lirePayload()),modifier(){if(detruit||publie)return;numero++;dernierResultat=null;if(!timer)timer=setTimeout(()=>{timer=null;flush().catch(()=>{});},delai);emettre();},
  souscrire(fn){listeners.add(fn);fn(etat());return()=>listeners.delete(fn);},
  reprendre(next){if(enCours)throw Error('conservation_en_cours');clearTimeout(timer);session=next.session;revision=next.revision??null;id=next.id??null;numero=0;confirme=0;saved_at=null;dernierResultat=null;publie=false;emettre();},
  confirmerPublication(resultat){if(!['publie','deja_publie'].includes(resultat?.issue))return false;clearTimeout(timer);publie=true;confirme=numero;emettre();return true;},
  detruire(){detruit=true;clearTimeout(timer);listeners.clear();},
 };
}

export function statutBrouillon(controleur){
 const node=el('p',{class:'editeur-statut status',role:'status','aria-live':'polite',dataset:{role:'statut-brouillon'}});
 const stop=controleur.souscrire(e=>{node.textContent=e.publie?t('Modifications enregistrées'):e.enCours?t('Enregistrement sur cet appareil…'):e.dernierResultat&&e.dernierResultat.issue!=='ok'?texteErreurBrouillon(e.dernierResultat):e.sale?t('Saisie à conserver sur cet appareil'):e.id?t('Brouillon conservé sur cet appareil'):t('Aucune modification à conserver');});
 node.dispose=stop;return node;
}

export function boutonsRecuperationTexte(lireTexte){
 const manuel=el('textarea',{readOnly:true,hidden:true,rows:10,'aria-label':t('Ma saisie à récupérer')});
 const status=el('p',{role:'status'});
 const texte=async()=>String(await lireTexte()??'');
 return el('div',{class:'stack'},el('div',{class:'row'},
  el('button',{type:'button',class:'btn',onClick:async()=>{let value;try{value=await texte();}catch{status.textContent=t('Le texte n’a pas pu être récupéré. Réessaie.');return;}try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(value);status.textContent=t('Texte copié');}catch{manuel.value=value;manuel.hidden=false;manuel.focus();manuel.select();}}},t('Copier ma saisie')),
  el('button',{type:'button',class:'btn',onClick:async()=>{try{downloadBlob(new Blob([await texte()],{type:'text/plain;charset=utf-8'}),'brouillon-mistu.txt');}catch{status.textContent=t('Le texte n’a pas pu être récupéré. Réessaie.');}}},t('Télécharger mon texte'))),manuel,status);
}

export async function panneauRepriseBrouillon({service,id,portee,onReprendre,onComparer,onEcarter,estCourante=()=>true}){
 const node=el('section',{class:'card stack editeur-reprise',dataset:{role:'reprise-brouillon'}}),lu=await service.lireBrouillon({id,portee});
 if(!estCourante())return node;
 if(lu.issue!=='ok'){node.append(el('p',{role:'status'},texteErreurBrouillon(lu)));return node;}
 if(lu.etat==='committed'){node.append(el('p',{role:'status'},t('Ce brouillon a déjà été publié.')));return node;}
 const draft=lu.brouillon,revision=draft?.revision??lu.revision;
 node.append(el('h2',null,t('Brouillon sur cet appareil')),el('p',null,lu.etat==='invalide'?texteErreurBrouillon(lu.raisons?.[0]||'format_inconnu'):lu.etat==='detache'?t('La bibliothèque a été remplacée. Ce texte reste récupérable.'):lu.etat==='anonyme'?t('Ce brouillon a été saisi sans compte. Compare les valeurs avant de le reprendre.'):lu.etat==='bloque'?t('La source de ce brouillon a changé. Compare les valeurs avant de reprendre.'):t('Reprendre la saisie conservée ?')));
 if(draft?.saved_at)node.append(el('p',{class:'muted'},t('Conservé le {date}',{date:formatDate(draft.saved_at,{withTime:true})})));
 const boutons=el('div',{class:'row'}),status=el('p',{role:'status'});node.append(boutons);
 if(lu.etat==='reprenable')boutons.append(el('button',{type:'button',class:'btn primary',onClick:async()=>{try{const actuelle=await service.lireBrouillon({id,portee});if(!estCourante())return;if(actuelle.issue!=='ok'||actuelle.etat!=='reprenable'||(actuelle.brouillon?.revision??actuelle.revision)!==revision){status.textContent=texteErreurBrouillon(actuelle.issue==='ok'?actuelle.raisons?.[0]||'revision_changee':actuelle);return;}await onReprendre?.({...lu,modele:lu.modele??draft?.payload,id,revision});}catch{status.textContent=texteErreurBrouillon('stockage_indisponible');}}},t('Reprendre')));
 if(['bloque','anonyme'].includes(lu.etat)&&onComparer)boutons.append(el('button',{type:'button',class:'btn',onClick:async()=>{try{const r=await service.comparerBrouillon({id,portee,expectedRevision:revision});if(!estCourante())return;if(r.issue==='ok')await onComparer(r);else status.textContent=texteErreurBrouillon(r);}catch{status.textContent=texteErreurBrouillon('stockage_indisponible');}}},t('Comparer les valeurs')));
 node.append(boutonsRecuperationTexte(async()=>{if(service.exporterTexteBrouillon){const r=await service.exporterTexteBrouillon({id,portee});if(!estCourante()||r.issue!=='ok')throw Error('recuperation_refusee');if(r.tronque)status.textContent=t('Le texte récupéré est partiel. Le brouillon original reste sur cet appareil.');return r.texte;}if(draft)return texteModeleEditeur(draft.payload??{});throw Error('recuperation_indisponible');}));
 let pending=false;const ecart=el('button',{type:'button',class:'btn',onClick:async()=>{if(pending)return;pending=true;ecart.disabled=true;try{if(!await confirmDialog(t('Écarter définitivement ce brouillon sur cet appareil ?'),{danger:true,okLabel:t('Écarter le brouillon')}))return;if(!estCourante())return;const r=await service.ecarterBrouillon({id,portee,expectedRevision:revision,attendu:lu.attendu});if(!estCourante())return;if(r.issue==='ok'){node.remove();await onEcarter?.({id});}else status.textContent=texteErreurBrouillon(r);}catch{status.textContent=texteErreurBrouillon('stockage_indisponible');}finally{pending=false;ecart.disabled=false;}}},t('Écarter ce brouillon'));
 boutons.append(ecart);node.append(status);return node;
}

const LIBELLES={book:'Livre',edition:'Édition',metadata:'Informations',contenu:'Recette',title:'Titre',display_title:'Titre',original_title:'Titre original',author:'Auteur',isbn:'ISBN',publisher:'Éditeur',year:'Année',language:'Langue',original_language:'Langue',unit_convention_id:'Convention de mesure',cuisines:'Cuisines',tags:'Mots-clés',ingredients:'Ingrédients',steps:'Étapes',text:'Texte',source_text:'Texte source',notes:'Notes',changes:'Résumé des changements',servings:'Portions',yield_text:'Rendement',prep_minutes:'Préparation',cook_minutes:'Cuisson',active_minutes:'Temps actif',total_minutes:'Temps total',type:'Catégorie',printed_page:'Page imprimée',source_label:'Source',status:'Statut',current_version_id:'Version courante'};
export function libelleChampEditeur(champ){return t(LIBELLES[String(champ).split('.').at(-1)]||'Valeur');}
export function texteModeleEditeur(payload){
 const rendre=x=>x==null?'':Array.isArray(x)?x.map(rendre).filter(Boolean).join('\n'):typeof x==='object'?Object.entries(x).filter(([k])=>!['id','ingredient_id','unit_id','verification_state','source_sans_thermomix'].includes(k)).map(([k,v])=>`${libelleChampEditeur(k)} : ${rendre(v)}`).join('\n'):String(x);
 return rendre(payload);
}

export function panneauComparaisonBrouillon({service,id,portee,revision,session,resultat,onReprendre,onDecision,estCourante=()=>true}){
 const node=el('section',{class:'card stack editeur-comparaison',dataset:{role:'comparaison-brouillon'}},el('h2',null,t('Comparer avant de reprendre'))),status=el('p',{role:'status'});
 const champs=resultat?.courantAffichable?.champs||resultat?.conflits||[],choix=new Set(),boutons=[];
 for(const c of champs){if(!c.champ||c.champ==='current_version_id')continue;
  const check=el('input',{type:'checkbox',onChange:e=>{if(e.target.checked)choix.add(c.champ);else choix.delete(c.champ);}});
  node.append(el('div',{class:'editeur-comparaison-champ'},el('h3',null,libelleChampEditeur(c.champ)),el('p',null,t('Votre saisie'),el('span',{class:'texte-saisie'},texteModeleEditeur(c.saisie))),el('p',null,t('Valeur actuelle'),el('span',{class:'texte-saisie'},texteModeleEditeur(c.actuel))),el('label',null,check,t('Reprendre ma saisie pour ce champ'))));
 }
 let pending=false;
 const agir=async fn=>{if(pending||!estCourante())return;pending=true;boutons.forEach(b=>b.disabled=true);try{const r=await fn();if(!estCourante())return;if(r.issue!=='ok')status.textContent=texteErreurBrouillon(r);}catch{status.textContent=texteErreurBrouillon('stockage_indisponible');}finally{pending=false;boutons.forEach(b=>b.disabled=false);}};
 const bouton=(texte,fn)=>{const b=el('button',{type:'button',class:'btn',onClick:()=>agir(fn)},t(texte));boutons.push(b);return b;};
 if(session&&resultat?.anonyme!==true&&resultat?.conflits?.some(c=>c.raison==='pointeur_change')){
  node.append(el('p',null,t('La version courante a changé. Ta correction reste liée à la version que tu avais ouverte.')),
   bouton('Garder la version courante',async()=>{const r=await service.choisirVersionCourante({session,expectedRevision:revision,comparaison:resultat.comparaison,choix:'preserve'});if(r.issue==='ok'&&estCourante())onDecision?.(r);return r;}),
   bouton('Utiliser ma correction comme version courante',async()=>{const r=await service.choisirVersionCourante({session,expectedRevision:revision,comparaison:resultat.comparaison,choix:'replace'});if(r.issue==='ok'&&estCourante())onDecision?.(r);return r;}));
 }
 if(champs.some(c=>c.champ!=='current_version_id'))node.append(bouton('Créer un brouillon avec mes choix',async()=>{if(!choix.size)return{issue:'refuse',raison:'contenu_invalide'};const r=await service.reprendreSurBaseCourante({comparaison:resultat.comparaison,choixRepris:[...choix],portee,...(resultat.anonyme===true?{reprendreAnonyme:true}:{})});if(r.issue==='ok'&&estCourante())await onReprendre?.({...r,aConserver:true});return r;}));
 node.append(status);return node;
}
