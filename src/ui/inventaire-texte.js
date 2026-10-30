import {el,formatDate} from '../core/dom.js';
import {t} from '../core/i18n.js';
export const texteUniteInventaire=u=>({portion:t('portions'),piece:t('pièces'),g:'g',kg:'kg',ml:'ml',l:'l'}[u]||'');
export function quantiteInventaire(p){const q=p?.quantite;if(q?.mode==='connue')return `${q.remaining} ${texteUniteInventaire(q.unit)}`;if(q?.mode==='legacy')return t('À confirmer');if(q?.mode==='invalide')return t('Quantité à revoir');return t('Quantité inconnue');}
export function texteErreurInventaire(r){
 const raison=r?.raison||r?.code;
 if(raison==='quota_stockage')return t('Pas assez de place pour conserver ce changement. Ta saisie reste ici.');
 if(['stock_change','source_changee','cycle_change','restauration_changee'].includes(raison))return t('Ce lot ou sa source a changé. Ta saisie reste ici ; revois le lot avant un nouveau geste.');
 if(['compte_change','contexte_change','bibliotheque_remplacee'].includes(raison))return t('La bibliothèque a changé. Rouvre l’inventaire avant de continuer.');
 if(raison==='quantite_depassee')return t('La quantité utilisée dépasse le restant disponible.');
 if(raison==='precision_invalide')return t('Utilise six décimales au maximum.');
 if(['stock_invalide','forme_invalide','bornes'].includes(raison))return t('Vérifie la quantité, son unité et les champs indiqués.');
 if(raison==='adoption_requise')return t('Confirme d’abord la quantité de cet ancien lot avec Modifier.');
 if(raison==='annulation_indisponible')return t('Cette consommation ne peut plus être annulée. Revois le lot actuel.');
 if(raison==='quantite_inconnue')return t('La quantité de ce lot est inconnue.');
 if(raison==='lot_termine')return t('Ce lot est déjà terminé.');
 if(raison==='lot_absent')return t('Ce lot n’est plus disponible.');
 if(raison==='operations_dependantes')return t('D’autres modifications dépendent de cette copie. Rien n’a été remplacé.');
 if(['confirmation_incomplete','conflit_absent'].includes(raison))return t('Les copies ont changé. Revois la comparaison avant de choisir.');
 return t('Le changement n’a pas été conservé sur cet appareil. Ta saisie reste ici ; réessaie.');
}
export function resumeLotInventaire(p){return el('div',{class:'stack'},el('strong',null,p.label||t('Lot sans nom')),el('p',{dataset:{role:'restant-lot'}},quantiteInventaire(p)),p.etat==='finished'?el('span',{class:'chip'},t('Tout consommé')):null);}
export function dateLotInventaire(date){if(!date||date.origine==='aucune')return t('Non indiquée');if(date.origine==='civil')return date.valeur;if(date.origine==='legacy')return formatDate(date.valeur);return t('Date à revoir');}
