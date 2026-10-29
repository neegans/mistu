// Une seule cible : l’image réellement montrée. Les notes, les autres photos et la version restent intactes.
import { el, pickFiles as pickDom, confirmDialog as confirmDom } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { sha256Hex } from '../core/hash.js';
import { preparerPhotoLocale, messageErreurImage } from '../core/image.js';
import * as depot from '../model/repo.js';
import { photoPrincipale, photosDeCuisson } from '../domain/cuisine-personnelle.js';
import { capturerRecette } from './recette-garde.js';
import { lireEtatRecette } from '../domain/cycle-edition.js';
import { mentionCycleRecette } from './corbeille.js';
import { contexteFichiers } from './components.js';
import { modifierPhotosCuisson } from './cuisson.js';
import { poserPhotoPlat, retirerPhotoPlat, figurePhotoPlat } from './photo-plat.js';

const identique = (a, b) => (!a && !b) || (!!a && !!b && a.sha256 === b.sha256 && a.personnelle === b.personnelle && a.cuisson_id === b.cuisson_id);
const refuser = raison => ({ issue: 'refuse', raison });
const changement = () => { const e = new Error('fiche_changee'); e.code = 'fiche_changee'; throw e; };
async function lire(repo, id) {
  const recipe = await repo.get('recipes', id);
  const history = recipe ? await repo.byIndex('cook_history', 'recipe_id', id) : [];
  return { recipe, photo: photoPrincipale(recipe, history) };
}

export async function modifierPhotoAffichee(recipeId, attendu, { file = null, retirer = false, origin = 'image' } = {}, { repo = depot, contexte = null } = {}) {
  try {
    const vue = await lire(repo, recipeId);
    if (!vue.recipe) return refuser('fiche_absente');
    if (!identique(vue.photo, attendu)) return refuser('fiche_changee');
    if (!retirer && !file) return refuser('image');
    contexte ??= await capturerRecette(repo, vue.recipe, {historique:!!attendu?.personnelle});
    if (!attendu?.personnelle) {
      const source = { sha256: attendu?.sha256 || null, candidat: vue.recipe.photo_source_url };
      return retirer ? retirerPhotoPlat(recipeId, { repo, attendu: source, contexte }) : poserPhotoPlat(recipeId, file, { repo, origin, attendu: source, contexte });
    }
    let sha = null; const fichiers = [];
    if (!retirer) {
      let jpeg;
      try { jpeg = await preparerPhotoLocale(file); }
      catch (e) { return { ...refuser('image'), code: e?.code || 'indecodable' }; }
      sha = await sha256Hex(jpeg);
      fichiers.push({sha256:sha,blob:jpeg,meta:{mime:'image/jpeg'}});
    }
    // Le helper I2 fusionne la ligne courante. La garde ne dépend ni de sa note ni de ses autres photos.
    const garde = { ...repo, saveBatch: (batch, options) => {
      const conditions = { ...options.conditions, recipes: [{ key: recipeId, fusion: c => { if (!c) changement(); return null; } }],
        cook_history: options.conditions.cook_history.map(c => ({ ...c, fusion: courante => {
          if (courante?.recipe_id !== recipeId || photosDeCuisson(courante).at(-1) !== attendu.sha256) changement();
          if (sha === attendu.sha256) return null;
          const suivante = c.fusion(courante);
          // Choisir une photo déjà présente la replace en dernière position, sans doublon.
          if (sha) suivante.photos = [...suivante.photos.filter(s => s !== sha), sha];
          return suivante;
        } })) };
      return repo.saveBatch(batch, { ...options, conditions });
    } };
    await modifierPhotosCuisson(attendu.cuisson_id, { ajouter: sha ? [sha] : [], retirer: [attendu.sha256] }, { repo: garde, recettes:[contexte], fichiers });
    return { issue: 'ok', ...(sha ? { sha256: sha } : {}) };
  } catch (e) { return ['fiche_changee','cycle_change','cycle_invalide','recette_retiree','compte_change','historique_seul'].includes(e?.code) ? refuser('fiche_changee') : { issue: 'echec', raison: 'ecriture' }; }
}

export async function renderPhotoGestion({ id }, query = {}, ctx = {}, deps = {}) {
  const repo = deps.repo || depot, pickFiles = deps.pickFiles || pickDom, confirmDialog = deps.confirmDialog || confirmDom;
  const ctxF = deps.ctxF || await contexteFichiers(ctx);
  let vue = await lire(repo, id), fermee = false, occupe = false, travail = Promise.resolve();
  if (!vue.recipe) return el('div', { class: 'card' }, t('Recette introuvable.'));
  const contenu = el('div', { class: 'stack' });
  const message = el('p', { role: 'status', class: 'status', hidden: true });
  const retour = `#/recipes/${encodeURIComponent(id)}`;
  const root = el('div', { class: 'stack photo-gestion', dataset: { role: 'photo-gestion' } },
    el('a', { href: retour, class: 'btn link' }, t('Retour à la recette')),
    el('h1', null, t('Photo de la recette')), contenu, message);
  const libererImages = () => { for (const image of contenu.querySelectorAll('[data-role="photo-visible"]')) image.dispose?.(); };
  const signaler = texte => { if (fermee) return; message.textContent = texte; message.hidden = false; };
  const erreur = r => r.raison === 'image' ? messageErreurImage({ code: r.code || 'indecodable' })
    : r.raison === 'fiche_changee' ? t('La photo a changé. Le gestionnaire a été actualisé.')
      : r.raison === 'fiche_absente' ? t('Recette introuvable.') : t('La photo du plat n’a pas pu être changée. Réessaie.');
  const verrouiller = valeur => { occupe = valeur; for (const b of contenu.querySelectorAll('button')) b.disabled = valeur; };
  async function dessiner() {
    const suivante = await lire(repo, id); if (fermee) return;
    vue = suivante;
    if (!vue.recipe) { libererImages(); contenu.replaceChildren(el('p', null, t('Recette introuvable.'))); return; }
    const photo = vue.photo, edition = ctx.editionsById?.get(vue.recipe.edition_id), cycle = lireEtatRecette(vue.recipe, edition);
    const editable = cycle.etat === 'active' || (cycle.etat === 'retiree' && photo?.personnelle);
    const titre = vue.recipe.original_title || vue.recipe.display_title || t('Recette');
    const figure = photo ? await figurePhotoPlat({ ...vue.recipe, photo_sha256: photo.sha256 }, { repo, ctxF, personnelle: photo.personnelle }) : null;
    const source = photo?.personnelle && vue.recipe.photo_sha256 ? await figurePhotoPlat(vue.recipe, { repo, ctxF }) : null;
    if (fermee) { figure?.dispose(); source?.dispose(); return; }
    libererImages();
    contenu.replaceChildren(...[mentionCycleRecette(vue.recipe, edition), el('h2', { class: 'recipe-title' }, titre),
      photo ? el('p', { class: 'muted' }, photo.personnelle ? t('Ma photo du plat') : t('Image de la recette')) : null,
      figure || el('div', { class: 'photo-absente' }, t('Ajouter une photo')),
      editable ? el('div', { class: 'row photo-gestion-actions' },
        el('button', { type: 'button', class: 'btn primary', onClick: () => choisir(false) }, t('Choisir une photo')),
        el('button', { type: 'button', class: 'btn', onClick: () => choisir(true) }, t('Prendre une photo')),
        photo ? el('button', { type: 'button', class: 'btn danger', onClick: retirer }, t('Retirer la photo')) : null) : null,
      source ? el('details', { class: 'card' }, el('summary', null, t('Image de la recette')), source) : null,
      el('a', { href: retour, class: 'btn' }, t('Terminer'))].filter(Boolean));
    verrouiller(occupe);
  }
  async function appliquer(attendu, changement, contexte) {
    if (fermee || occupe || !root.isConnected) return;
    verrouiller(true); message.hidden = true;
    try {
      const r = await modifierPhotoAffichee(id, attendu, changement, { repo, contexte });
      await dessiner();
      if (r.issue !== 'ok') signaler(erreur(r));
      else if (changement.retirer) signaler(vue.photo ? t('Photo retirée. Une autre photo est maintenant affichée.') : t('Photo retirée.'));
      else signaler(t('Photo du plat enregistrée.'));
    } finally { verrouiller(false); }
  }
  function choisir(capture) {
    if (fermee || occupe) return;
    const attendu = vue.photo;
    // Le sélecteur peut rester sans résolution après Annuler ; il ne verrouille donc pas l’écran.
    travail = (async () => {
      try {
        const contexte = await capturerRecette(repo, vue.recipe, {ctx, historique:!!attendu?.personnelle});
        const files = await pickFiles({ accept: 'image/*', multiple: false, ...(capture ? { capture: 'environment' } : {}) });
        if (files?.length && !fermee) await appliquer(attendu, { file: files[0], origin: capture ? 'photo' : 'image' }, contexte);
      } catch { signaler(t('La photo du plat n’a pas pu être changée. Réessaie.')); }
    })();
  }
  function retirer() {
    if (fermee || occupe || !vue.photo) return;
    const attendu = vue.photo;
    travail = (async () => { try { const contexte = await capturerRecette(repo, vue.recipe, {ctx, historique:!!attendu?.personnelle}); if (await confirmDialog(t('Retirer la photo affichée ?'), { okLabel: t('Retirer la photo'), danger: true })) await appliquer(attendu, { retirer: true }, contexte); } catch { signaler(t('La photo du plat n’a pas pu être changée. Réessaie.')); } })();
  }
  root.dispose = () => { if (fermee) return; fermee = true; libererImages(); };
  root.attendreEcritures = () => travail;
  await dessiner(); return root;
}
