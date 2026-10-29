import { capturerRecette, capturerEdition } from './recette-garde.js';
// Corbeille individuelle : le contenu reste en base ; seule une commande explicite change son cycle de vie.
import { el, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { refresh } from '../core/router.js';
import * as repoModule from '../model/repo.js';
import { lireCycleRecette } from '../domain/cycle-recette.js';
import { lireCycleEdition, lireEtatRecette } from '../domain/cycle-edition.js';
import { preparerRetraitLivre, mettreLivreALaCorbeille, restaurerLivre, restaurerRecetteDuLivre, chargerCorbeilleLivres } from '../domain/corbeille-livres.js';
import { mettreALaCorbeille, restaurerRecette, chargerCorbeille } from '../domain/corbeille.js';
import { capaciteCycleConnue } from '../sync/cycle.js';
import { capaciteEditionConnue } from '../sync/cycle-edition.js';
import { protegerSaisie } from './state.js';
import { pageHeader, provenanceText, emptyState } from './components.js';

const retraitsAnnulables = new Map();
const livresAnnulables = new Map(), restaurationsLivres = new Map();
export const TEXTE_RECETTE_RETIREE = 'Cette recette est dans la corbeille';
export const TEXTE_CYCLE_INVALIDE = 'L’état de cette recette est à vérifier. Son contenu est conservé.';
export const TEXTE_NOUVEL_USAGE_REFUSE = 'Restaure les recettes dans la corbeille avant de les utiliser dans une nouvelle préparation.';

export function mentionCycleRecette(recipe, edition = null) {
  const cycle = lireEtatRecette(recipe, edition);
  if (cycle.etat === 'active') return null;
  return el('p', { class: 'status warn', dataset: { role: 'mention-corbeille' } },
    cycle.etat === 'retiree' ? cycle.origine === 'edition' ? t('Recette dans la corbeille avec son livre') : t(TEXTE_RECETTE_RETIREE) : t(TEXTE_CYCLE_INVALIDE), ' ',
    el('a', { href: `#/recipes/${encodeURIComponent(recipe.id)}` }, t('Consulter')));
}

export async function panneauCycleRecette(recipe, ctx, deps = {}) {
  const R = deps.repo ?? repoModule, edition = ctx.editionsById?.get(recipe.edition_id), cycle = lireEtatRecette(recipe, edition);
  const root = el('div', { class: 'stack', dataset: { role: 'cycle-recette' } });
  if (!['active','retiree'].includes(cycle.etat)) {
    root.append(el('p', { class: 'status warn', role: 'status' }, t(TEXTE_CYCLE_INVALIDE)), el('a', { class: 'btn', href: '#/corbeille' }, t('Ouvrir la corbeille')));
    return root;
  }
  const retiree = cycle.etat === 'retiree';
  const message = el('p', { class: 'muted', role: 'status' });
  const annuler = retiree && retraitsAnnulables.has(recipe.id) && retraitsAnnulables.get(recipe.id) === lireCycleRecette(recipe).id;
  const depuisLivre = retiree && lireCycleEdition(edition).etat === 'retiree' && edition.trash_mode === 'with_recipes';
  const bouton = el('button', { type: 'button', class: `btn ${retiree ? '' : 'danger'}`, dataset: { role: retiree ? 'restaurer-recette' : 'retirer-recette' } }, retiree ? depuisLivre ? t('Restaurer cette recette') : t('Restaurer') : t('Mettre à la corbeille'));
  const retour = annuler ? el('button', { type: 'button', class: 'btn', onClick: () => agir() }, t('Annuler')) : null;
  if (retiree) root.append(el('p', { class: 'status warn' }, cycle.origine === 'edition' ? t('Recette dans la corbeille avec son livre') : t(TEXTE_RECETTE_RETIREE)));
  if (lireCycleEdition(edition).etat === 'retiree') root.append(el('p', {class:'muted'}, t('Livre dans la corbeille'), ' ', el('a', {href:`#/books/${encodeURIComponent(edition.id)}`}, t('Consulter le livre'))));
  root.append(el('div', { class: 'row' }, bouton, retour), message);
  let enCours = false;
  const disponible = async () => {
    // Se déconnecter conserve le propriétaire de la base et sa capacité confirmée.
    const proprietaire = Object.hasOwn(ctx, 'proprietaireDonnees') ? ctx.proprietaireDonnees
      : (await R.get('sync_state', 'user_id'))?.value ?? null;
    return proprietaire == null || (deps.capacite ? await deps.capacite(proprietaire) : await (recipe.edition_id ? capaciteEditionConnue : capaciteCycleConnue)(R.db, proprietaire));
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
      const resultat = await (depuisLivre ? restaurerRecetteDuLivre : retiree ? restaurerRecette : mettreALaCorbeille)(recipe, { repo: R, contexte, edition });
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

function texteBilanRestauration(bilan) {
  return t('{n} recette(s) rétablie(s) · {a} déjà active(s) · {r} laissée(s) dans la corbeille · {i} à vérifier', {n:bilan.retablies,a:bilan.dejaActives,r:bilan.laisseesRetirees,i:bilan.invalides});
}

export async function panneauCycleLivre(edition, ctx, deps = {}) {
  const R = deps.repo ?? repoModule, cycle = lireCycleEdition(edition);
  const root = el('div', {class:'stack',dataset:{role:'cycle-livre'}});
  if (cycle.etat === 'invalide') return el('div', {class:'status warn',role:'status'}, t('L’état de ce livre est à vérifier. Son contenu est conservé.'));
  const retire = cycle.etat === 'retiree', message = el('p', {class:'muted',role:'status'});
  const bouton = el('button', {type:'button',class:retire?'btn':'btn danger',dataset:{role:retire?'restaurer-livre':'retirer-livre'},onClick:agir}, retire?t('Restaurer le livre'):t('Mettre à la corbeille'));
  const annuler = retire && livresAnnulables.get(edition.id) === cycle.id ? el('button', {type:'button',class:'btn',onClick:agir}, t('Annuler')) : null;
  if (retire) root.append(el('p', {class:'status warn'}, t('Livre dans la corbeille')));
  root.append(el('div', {class:'row'}, bouton, annuler), message);
  const bilanRestauration = restaurationsLivres.get(edition.id);
  if (!retire && bilanRestauration) message.textContent = texteBilanRestauration(bilanRestauration);
  let autorise = false, enCours = false;
  const disponible = async () => {
    const owner = Object.hasOwn(ctx,'proprietaireDonnees') ? ctx.proprietaireDonnees : (await R.get('sync_state','user_id'))?.value ?? null;
    return owner == null || (deps.capaciteEdition ? await deps.capaciteEdition(owner) : await capaciteEditionConnue(R.db,owner));
  };
  const verrouiller = () => {bouton.disabled=enCours||!autorise;if(annuler)annuler.disabled=bouton.disabled;};
  try {autorise=await disponible();}catch{}verrouiller();
  if (!autorise) {
    message.textContent=t('La corbeille des livres n’est pas encore disponible pour ce compte. Connecte-toi avec une application à jour pour vérifier sa disponibilité.');
    if(ctx.sync?.moteur?.envoyerMaintenant)root.append(el('button',{type:'button',class:'btn',onClick:async e=>{
      e.currentTarget.disabled=true;try{await ctx.sync.moteur.envoyerMaintenant();autorise=await disponible();verrouiller();if(autorise){e.target.remove();message.textContent='';bouton.focus();}}catch{}finally{e.target.disabled=false;}
    }},t('Vérifier la disponibilité')));
  }
  async function terminer(resultat) {
    const apres=resultat.edition;
    if(retire){livresAnnulables.delete(edition.id);if(resultat.bilanRestauration)restaurationsLivres.set(edition.id,resultat.bilanRestauration);}
    else {livresAnnulables.set(edition.id,lireCycleEdition(apres).id);restaurationsLivres.delete(edition.id);}
    message.textContent=retire?t('Livre restauré sur cet appareil.'):t('Livre mis à la corbeille sur cet appareil.');
    if(deps.apres)await deps.apres(apres,resultat);
    else {await (deps.refresh??refresh)();requestAnimationFrame(()=>{const titre=document.querySelector('main h1');if(titre){titre.tabIndex=-1;titre.focus();}});}
  }
  async function agir() {
    if(enCours||!autorise)return;enCours=true;verrouiller();
    try {
      const contexte=await capturerEdition(R,edition,{ctx});
      if(retire){await terminer(await (deps.restaurerLivre??restaurerLivre)(edition,{repo:R,contexte}));return;}
      let bilan=await (deps.preparerRetraitLivre??preparerRetraitLivre)(edition,{repo:R,contexte});
      if(bilan.vide){
        try {await terminer(await (deps.mettreLivreALaCorbeille??mettreLivreALaCorbeille)(edition,{repo:R,contexte,bilan,mode:'keep_recipes'}));return;}
        catch(e){if(e?.code!=='bilan_change')throw e;bilan=await (deps.preparerRetraitLivre??preparerRetraitLivre)(edition,{repo:R,contexte});}
      }
      await choisir(bilan,contexte);
    }catch{message.textContent=retire?t('Le livre n’a pas pu être restauré. Il a peut-être changé ; recharge sa fiche avant de réessayer.'):t('Le livre n’a pas pu être mis à la corbeille. Recharge sa fiche avant de réessayer.');}
    finally{enCours=false;verrouiller();}
  }
  function choisir(initial,contexte) {
    return new Promise(resolve=>{
      let bilan=initial,occupe=false,ferme=false;
      const compteurs=el('ul',{class:'list plain',dataset:{role:'bilan-retrait-livre'}}),statut=el('p',{role:'status',class:'status warn',hidden:true});
      const dlg=el('dialog',{dataset:{role:'dialogue-corbeille-livre'},style:{maxWidth:'min(42rem, calc(100vw - 2rem))'}},
        el('h2',null,t('Que veux-tu garder dans ta bibliothèque ?')),compteurs,
        el('p',{class:'muted'},t('Les sources, les photos et les anciens repas sont conservés. Ces nombres décrivent les données présentes sur cet appareil.')),statut);
      const liberer=protegerSaisie(dlg);
      const fermer=()=>{if(ferme)return;ferme=true;dlg.close();dlg.remove();liberer();requestAnimationFrame(()=>{if(bouton.isConnected)bouton.focus();});resolve();};
      const dessiner=()=>{const c=bilan.compteurs;compteurs.replaceChildren(...[
        ['{n} recette(s) disponible(s)',c.disponibles],['{n} recette(s) partielle(s)',c.partielles],['{n} référence(s)',c.references],['{n} recette(s) déjà retirée(s)',c.dejaRetirees],['{n} page(s) source',c.pages],['{n} import(s) ouvert(s)',c.importsOuverts],['{n} import(s) en cours',c.importsEnCours],['{n} import(s) à l’état à vérifier',c.importsInconnus]
      ].map(([texte,n])=>el('li',null,t(texte,{n}))));};
      const action=mode=>async()=>{
        if(occupe)return;occupe=true;for(const b of dlg.querySelectorAll('button'))b.disabled=true;
        try{const resultat=await (deps.mettreLivreALaCorbeille??mettreLivreALaCorbeille)(edition,{repo:R,contexte,mode,bilan});fermer();await terminer(resultat);}
        catch(e){statut.hidden=false;
          if(e?.code==='bilan_change'){
            try{bilan=await (deps.preparerRetraitLivre??preparerRetraitLivre)(edition,{repo:R,contexte});dessiner();statut.textContent=t('Le contenu du livre a changé. Vérifie les nouveaux nombres puis choisis à nouveau.');}
            catch{statut.textContent=t('Le livre a changé. Ferme ce dialogue puis rouvre sa fiche.');}
          }else statut.textContent=t('Le retrait a échoué. Rien n’a été détaché ; tu peux réessayer.');
        }finally{occupe=false;for(const b of dlg.querySelectorAll('button'))b.disabled=false;}
      };
      dlg.append(el('div',{class:'stack'},
        el('button',{type:'button',class:'btn',dataset:{role:'retirer-livre-garder-recettes'},onClick:action('keep_recipes')},t('Retirer le livre, garder mes recettes')),
        el('button',{type:'button',class:'btn danger',dataset:{role:'retirer-livre-avec-recettes'},onClick:action('with_recipes')},t('Mettre le livre et ses recettes dans la corbeille')),
        el('button',{type:'button',class:'btn',onClick:()=>{if(!occupe)fermer();}},t('Annuler'))));
      dlg.addEventListener('cancel',e=>{e.preventDefault();if(!occupe)fermer();});
      const routeAvant=location.hash,quitter=()=>{if(location.hash!==routeAvant&&!occupe)fermer();};
      window.addEventListener('hashchange',quitter);dlg.addEventListener('close',()=>window.removeEventListener('hashchange',quitter),{once:true});
      dessiner();document.body.append(dlg);dlg.showModal();dlg.querySelector('button').focus();
    });
  }
  return root;
}

export async function renderCorbeille(params, query, ctx, deps = {}) {
  const R = deps.repo ?? repoModule;
  const root = el('div', null, pageHeader(t('Corbeille'), { back: { href: '/library', label: t('Bibliothèque') } }));
  root.append(el('p', { class: 'muted' }, t('Les livres, les recettes, leurs sources, leurs photos et leur historique sont conservés. Tu peux les restaurer.')));
  const contenu = el('div', { class: 'stack' }); root.append(contenu);
  await dessiner();
  return root;
  async function dessiner(focusIndex = null) {
    const [recettes,livres,toutes,editions] = await Promise.all([chargerCorbeille({repo:R}),chargerCorbeilleLivres({repo:R}),R.all('recipes'),R.all('book_editions')]);
    const courant={...ctx,book_editions:editions,editionsById:new Map(editions.map(e=>[e.id,e]))};
    const livresRetires=new Set(livres.retirees.map(e=>e.id));
    const retirees=recettes.retirees.filter(r=>!livresRetires.has(r.edition_id));
    const invalides=toutes.filter(r=>!['active','retiree'].includes(lireEtatRecette(r,courant.editionsById.get(r.edition_id)).etat));
    contenu.replaceChildren();
    const lignes = el('ul', { class: 'list' });
    for(const edition of livres.retirees){
      const book=ctx.booksById?.get(edition.book_id),membres=toutes.filter(r=>r.edition_id===edition.id);
      const groupe=el('li',{class:'stack',dataset:{role:'livre-corbeille'}},el('h2',null,book?.title||t('Sans titre')),el('p',{class:'muted'},formatDate(edition.trashed_at,{withTime:true})),
        el('p',null,edition.trash_mode==='with_recipes'?t('Livre retiré avec ses recettes'):t('Livre retiré ; recettes gardées')),el('a',{class:'btn',href:`#/books/${encodeURIComponent(edition.id)}`},t('Consulter le livre')));
      groupe.append(await panneauCycleLivre(edition,courant,{...deps,apres:async()=>dessiner(0)}));
      const details=el('details',null,el('summary',null,t('{n} recette(s) liées à ce livre',{n:membres.length}))),liste=el('ul',{class:'list'});
      for(const r of membres){
        const etat=lireEtatRecette(r,edition),propre=lireCycleRecette(r);
        const ligne=el('li',{class:'stack'},el('a',{href:`#/recipes/${encodeURIComponent(r.id)}`},r.display_title||r.original_title||t('Sans titre')),
          el('p',{class:'muted'},propre.etat==='retiree'?t('Retrait individuel'):etat.exception?t('Restaurée individuellement'):etat.etat==='active'?t('Recette gardée active'):etat.origine==='edition'&&etat.etat==='retiree'?t('Recette dans la corbeille avec son livre'):t(TEXTE_CYCLE_INVALIDE)));
        if(etat.etat==='retiree')ligne.append(await panneauCycleRecette(r,courant,{...deps,apres:async()=>dessiner(0)}));
        liste.append(ligne);
      }
      details.append(liste);groupe.append(details);lignes.append(groupe);
    }
    const triees = [...retirees].sort((a,b) => (b.trashed_at || '').localeCompare(a.trashed_at || '') || String(a.original_title || '').localeCompare(String(b.original_title || '')));
    for (const [index, recipe] of triees.entries()) {
      const edition = courant.editionsById?.get(recipe.edition_id), book = edition ? ctx.booksById?.get(edition.book_id) : null;
      const ligne = el('li', { class: 'stack',dataset:{role:'recette-corbeille'} }, el('p', null, el('strong', null, recipe.display_title || recipe.original_title || t('Sans titre'))),
        el('p', { class: 'muted' }, provenanceText(recipe, book, edition)), el('p', { class: 'muted' }, formatDate(recipe.trashed_at, { withTime: true })),
        el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(recipe.id)}` }, t('Consulter')));
      ligne.append(await panneauCycleRecette(recipe, courant, { ...deps, apres: async () => { await dessiner(index); } }));
      lignes.append(ligne);
    }
    if (triees.length||livres.retirees.length) contenu.append(lignes);
    else contenu.append(emptyState('assiette', t('La corbeille est vide.')));
    if (invalides.length) contenu.append(el('section', { class: 'stack', dataset: { role: 'cycles-a-verifier' } }, el('h2', null, t('À vérifier')),
      el('p', null, t(TEXTE_CYCLE_INVALIDE)), ...invalides.map(recipe => el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(recipe.id)}` }, recipe.display_title || recipe.original_title || t('Sans titre')))));
    if(livres.invalides.length)contenu.append(el('section',{class:'stack',dataset:{role:'livres-a-verifier'}},el('h2',null,t('À vérifier')),el('p',null,t('L’état de ce livre est à vérifier. Son contenu est conservé.')),...livres.invalides.map(e=>el('a',{class:'btn',href:`#/books/${encodeURIComponent(e.id)}`},ctx.booksById?.get(e.book_id)?.title||t('Sans titre')))));
    if (focusIndex !== null) {
      const boutons = [...lignes.querySelectorAll('[data-role=restaurer-recette], [data-role=restaurer-livre]')].filter(b=>!b.closest('details:not([open])'));
      const cible = boutons[Math.min(focusIndex,boutons.length-1)] || root.querySelector('h1');
      if (cible && !boutons.length) cible.tabIndex = -1;
      cible?.focus();
    }
  }
}
