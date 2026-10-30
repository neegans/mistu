import {el} from '../core/dom.js';
import {t} from '../core/i18n.js';

// Ajouter l'avis laisse en place la vue, ses contrôleurs, sa saisie et son focus.
export function afficherAvisVersionBase(app){
 let avis=[...app.children].find(n=>n.dataset.role==='bandeau-version');
 if(!avis){
  avis=el('p',{class:'status warn',role:'alert','data-role':'bandeau-version',style:{display:'block',margin:'1rem'}});
  const demarrage=[...app.children].find(n=>n.dataset.role==='demarrage-non-verifie');
  app.insertBefore(avis,demarrage?demarrage.nextSibling:app.firstChild);
 }
 avis.textContent=t('Une version plus récente est ouverte dans un autre onglet. Recharge cette page.');
 return avis;
}
