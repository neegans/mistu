// Accueil d'un livre qui vient d'être créé (spec UX § 8) : pas de modale, un panneau au-dessus de la fiche, tenu par
// ?nouveau=1 — « × » le retire du DOM et le geste `fermer` retire le paramètre de l'adresse sans re-rendu (F19).
import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { carte } from './components.js';

export const ACCUEIL_ACTIONS = ['index', 'recette', 'plusTard'];

export function accueilLivreModel({ nouveau = undefined } = {}) {
  const afficher = nouveau !== undefined && nouveau !== null && nouveau !== '';
  return { afficher, titre: t('Le livre est dans ta bibliothèque. Et maintenant ?'), cartes: afficher ? [
    { action: 'index', ico: '📸', titre: t('Photographier l’index ou la table des matières'), texte: t('Pour que l’app connaisse les recettes du livre.') },
    { action: 'recette', ico: '📄', titre: t('Photographier ou importer des pages de recettes'), texte: t('Seulement celles qui t’intéressent, tout de suite.') },
    { action: 'plusTard', ico: '🕒', titre: t('Plus tard'), texte: t('Aller à Mes livres.') },
  ] : [] };
}

export function renderAccueilLivre(model, gestes = {}) {
  const root = el('div', null);
  if (!model.afficher) return root;
  const sources = el('div', { class: 'row sources' });
  const devoiler = (intention) => sources.replaceChildren(
    el('button', { type: 'button', class: 'btn primary', onClick: () => gestes.photographier && gestes.photographier(intention) }, t('Photographier')),
    el('button', { type: 'button', class: 'btn', onClick: () => gestes.choisir && gestes.choisir(intention) }, t('Choisir des photos ou un PDF')));
  const panneau = el('section', { class: 'card accueil-livre stack' },
    el('div', { class: 'row between top' }, el('h2', null, model.titre),
      el('button', { type: 'button', class: 'btn small fermer', 'aria-label': t('Fermer'), onClick: () => { panneau.remove(); gestes.fermer && gestes.fermer(); } }, '×')),
    el('div', { class: 'grid wide' }, ...model.cartes.map((c) => carte(c.ico, c.titre, c.texte, () => (c.action === 'plusTard' ? gestes.plusTard && gestes.plusTard() : devoiler(c.action))))),
    sources);
  root.append(panneau);
  return root;
}
