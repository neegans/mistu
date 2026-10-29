import { el, confirmDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getSyncGeneration } from './state.js';
import { capturerRecette, capturerProprietaire } from './recette-garde.js';
import { ignorerPropositionImport } from '../domain/reprise-import.js';
export const texteConfirmationAbandon = () => t('Abandonner ce brouillon ? Un appel déjà lancé sur un autre appareil peut encore se terminer et être compté. Aucun résultat ne sera appliqué automatiquement. Le résultat déjà reçu reste conservé. Aucun nouvel appel ne sera lancé.');
export function texteErreurReprise(e) {
  return ['compte_change','contexte_change'].includes(e?.code)
    ? t('Le compte a changé. Rouvre la recette avant de continuer.')
    : t('Ce brouillon ou la recette a changé. Actualise avant de l’abandonner.');
}
export function panneauAbandonProposition(row, { repo, ctx = {}, contexteRecette = null, confirmer = confirmDialog, role = 'ignorer-proposition', onAbandon = null } = {}) {
  const generation = getSyncGeneration(), base = repo.db, comptePromis = capturerProprietaire(repo,ctx);
  const contextePromis = (async () => {
    const compte = await comptePromis;
    const recipe = ctx.recipesById?.get(row.recipe_id) || await repo.get('recipes',row.recipe_id);
    if (!compte.contexteValide() || getSyncGeneration() !== generation || repo.db !== base) throw Object.assign(new Error('contexte_change'),{code:'contexte_change'});
    const capture = contexteRecette || await capturerRecette(repo,recipe,{ctx:{...ctx,proprietaireDonnees:compte.owner_id},historique:true});
    const valide = capture.contexteValide;
    return {...capture,contexteValide:()=>compte.contexteValide() && (!valide || valide())};
  })();
  contextePromis.catch(()=>{});
  const avis = el('p', {role:'status','aria-live':'polite'});
  let operation = Promise.resolve();
  const bouton = el('button', {type:'button',class:'btn',dataset:{role},disabled:['ignore','enregistre'].includes(row.status),onClick:()=>{
    if (bouton.disabled) return;
    bouton.disabled=true;
    operation = (async()=>{
      const contexte = await contextePromis;
      if (!(await confirmer(texteConfirmationAbandon(),{okLabel:t('Abandonner ce brouillon')}))) return;
      row = await ignorerPropositionImport(row.id, {repo,contexteRecette:contexte,attendu:row});
      avis.textContent=t('Brouillon terminé.'); await onAbandon?.(row);
    })().catch(e=>{avis.textContent=texteErreurReprise(e);}).finally(()=>{bouton.disabled=['ignore','enregistre'].includes(row.status);});
  }},t('Abandonner ce brouillon'));
  const root=el('div',{class:'stack'},bouton,avis);
  root.attendreEcritures=()=>operation;
  return root;
}
