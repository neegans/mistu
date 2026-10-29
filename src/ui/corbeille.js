import { capturerRecette } from './recette-garde.js';
// Corbeille individuelle : le contenu reste en base ; seule une commande explicite change son cycle de vie.
import { el, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { refresh } from '../core/router.js';
import * as repoModule from '../model/repo.js';
import { lireCycleRecette, estRecetteAutonome } from '../domain/cycle-recette.js';
import { mettreALaCorbeille, restaurerRecette, chargerCorbeille } from '../domain/corbeille.js';
import { capaciteCycleConnue } from '../sync/cycle.js';
import { pageHeader, provenanceText, emptyState } from './components.js';

const retraitsAnnulables = new Map();
export const TEXTE_RECETTE_RETIREE = 'Cette recette est dans la corbeille';
export const TEXTE_CYCLE_INVALIDE = 'L’état de cette recette est à vérifier. Son contenu est conservé.';
export const TEXTE_NOUVEL_USAGE_REFUSE = 'Restaure les recettes dans la corbeille avant de les utiliser dans une nouvelle préparation.';

export function mentionCycleRecette(recipe) {
  const cycle = lireCycleRecette(recipe);
  if (cycle.etat === 'active') return null;
  return el('p', { class: 'status warn', dataset: { role: 'mention-corbeille' } },
    cycle.etat === 'retiree' ? t(TEXTE_RECETTE_RETIREE) : t(TEXTE_CYCLE_INVALIDE), ' ',
    el('a', { href: `#/recipes/${encodeURIComponent(recipe.id)}` }, t('Consulter')));
}

export async function panneauCycleRecette(recipe, ctx, deps = {}) {
  const R = deps.repo ?? repoModule, cycle = lireCycleRecette(recipe);
  if (cycle.etat === 'active' && !estRecetteAutonome(recipe)) return null;
  const root = el('div', { class: 'stack', dataset: { role: 'cycle-recette' } });
  if (cycle.etat === 'invalide') {
    root.append(el('p', { class: 'status warn', role: 'status' }, t(TEXTE_CYCLE_INVALIDE)), el('a', { class: 'btn', href: '#/corbeille' }, t('Ouvrir la corbeille')));
    return root;
  }
  const retiree = cycle.etat === 'retiree';
  const message = el('p', { class: 'muted', role: 'status' });
  const annuler = retiree && retraitsAnnulables.get(recipe.id) === cycle.id;
  const bouton = el('button', { type: 'button', class: `btn ${retiree ? '' : 'danger'}`, dataset: { role: retiree ? 'restaurer-recette' : 'retirer-recette' } }, retiree ? t('Restaurer') : t('Mettre à la corbeille'));
  const retour = annuler ? el('button', { type: 'button', class: 'btn', onClick: () => agir() }, t('Annuler')) : null;
  if (retiree) root.append(el('p', { class: 'status warn' }, t(TEXTE_RECETTE_RETIREE)));
  root.append(el('div', { class: 'row' }, bouton, retour), message);
  let enCours = false;
  const disponible = async () => {
    // Se déconnecter conserve le propriétaire de la base et sa capacité confirmée.
    const proprietaire = Object.hasOwn(ctx, 'proprietaireDonnees') ? ctx.proprietaireDonnees
      : (await R.get('sync_state', 'user_id'))?.value ?? null;
    return proprietaire == null || (deps.capacite ? await deps.capacite(proprietaire) : await capaciteCycleConnue(R.db, proprietaire));
  };
  let autorise = false;
  try { autorise = await disponible(); } catch { /* Aucun succès supposé lorsque l’état local est illisible. */ }
  bouton.disabled = !autorise; if (retour) retour.disabled = !autorise;
  if (!autorise) message.textContent = t('La corbeille n’est pas encore disponible pour ce compte. Connecte-toi avec une application à jour pour vérifier sa disponibilité.');
  if (!autorise && ctx.sync?.moteur?.envoyerMaintenant) {
    const verifier = el('button', {type:'button', class:'btn', onClick:async () => {
      verifier.disabled = true;
      try {
        await ctx.sync.moteur.envoyerMaintenant();
        autorise = await disponible();
        bouton.disabled = !autorise; if (retour) retour.disabled = !autorise;
        if (autorise) { verifier.remove(); message.textContent = ''; bouton.focus(); }
      } catch { /* Le motif de disponibilité reste affiché et aucun geste n'est autorisé. */ }
      finally { verifier.disabled = false; }
    }}, t('Vérifier la disponibilité'));
    root.append(verifier);
  }
  bouton.addEventListener('click', agir);
  async function agir() {
    if (enCours || !autorise) return;
    enCours = true; bouton.disabled = true; if (retour) retour.disabled = true;
    try {
      const contexte = await capturerRecette(R, recipe, {ctx});
      const resultat = await (retiree ? restaurerRecette : mettreALaCorbeille)(recipe, { repo: R, contexte });
      const apres = resultat.recipe;
      if (!retiree) retraitsAnnulables.set(recipe.id, lireCycleRecette(apres).id);
      else retraitsAnnulables.delete(recipe.id);
      message.textContent = retiree ? t('Recette restaurée sur cet appareil.') : t('Recette mise à la corbeille sur cet appareil.');
      if (deps.apres) await deps.apres(apres);
      else (deps.refresh ?? refresh)();
    } catch {
      message.textContent = retiree ? t('La recette n’a pas pu être restaurée. Elle a peut-être changé ; recharge sa fiche avant de réessayer.') : t('La recette n’a pas pu être mise à la corbeille. Réessaie.');
    } finally { enCours = false; bouton.disabled = !autorise; if (retour) retour.disabled = !autorise; }
  }
  return root;
}

export async function renderCorbeille(params, query, ctx, deps = {}) {
  const R = deps.repo ?? repoModule;
  const root = el('div', null, pageHeader(t('Corbeille'), { back: { href: '/library', label: t('Bibliothèque') } }));
  root.append(el('p', { class: 'muted' }, t('Les recettes, leurs photos et leur historique sont conservés. Tu peux les restaurer.')));
  const contenu = el('div', { class: 'stack' }); root.append(contenu);
  await dessiner();
  return root;
  async function dessiner(focusIndex = null) {
    const { retirees, invalides } = await chargerCorbeille({ repo: R });
    contenu.replaceChildren();
    const lignes = el('ul', { class: 'list' });
    const triees = [...retirees].sort((a,b) => (b.trashed_at || '').localeCompare(a.trashed_at || '') || String(a.original_title || '').localeCompare(String(b.original_title || '')));
    for (const [index, recipe] of triees.entries()) {
      const edition = ctx.editionsById?.get(recipe.edition_id), book = edition ? ctx.booksById?.get(edition.book_id) : null;
      const ligne = el('li', { class: 'stack' }, el('p', null, el('strong', null, recipe.display_title || recipe.original_title || t('Sans titre'))),
        el('p', { class: 'muted' }, provenanceText(recipe, book, edition)), el('p', { class: 'muted' }, formatDate(recipe.trashed_at, { withTime: true })),
        el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(recipe.id)}` }, t('Consulter')));
      ligne.append(await panneauCycleRecette(recipe, ctx, { ...deps, apres: async () => { await dessiner(index); } }));
      lignes.append(ligne);
    }
    if (triees.length) contenu.append(lignes);
    else contenu.append(emptyState('assiette', t('La corbeille est vide.')));
    if (invalides.length) contenu.append(el('section', { class: 'stack', dataset: { role: 'cycles-a-verifier' } }, el('h2', null, t('À vérifier')),
      el('p', null, t(TEXTE_CYCLE_INVALIDE)), ...invalides.map(recipe => el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(recipe.id)}` }, recipe.display_title || recipe.original_title || t('Sans titre')))));
    if (focusIndex !== null) {
      const boutons = [...lignes.querySelectorAll('[data-role=restaurer-recette]')];
      const cible = boutons[Math.min(focusIndex,boutons.length-1)] || root.querySelector('h1');
      if (cible && !boutons.length) cible.tabIndex = -1;
      cible?.focus();
    }
  }
}
