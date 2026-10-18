// Garder un lien web (spec UX § 11) : une adresse et un titre suffisent pour retrouver une page dans ta bibliothèque.
// L'app n'ouvre pas la page et n'en lit rien — c'est la personne qui la nomme : aucun réseau, aucune version créée (I-E).
// L'adresse est validée dans le modèle ET à l'écriture (S13) ; la vue recette la revalide encore au rendu par
// lienSignet (S6), parce qu'une fiche venue d'une archive ou du serveur peut porter n'importe quoi (I-G).
import { borner } from '../core/bornes.js';
import { el, toast } from '../core/dom.js';
import { t, getUiLocale } from '../core/i18n.js';
import { lienSignet } from '../core/lien.js';
import { logError } from '../core/log.js';
import { navigate } from '../core/router.js';
import * as repo from '../model/repo.js';
import { assertVocabulaire } from '../domain/vocabulaire.js';
import { pageHeader, field, select, libelleLivre } from './components.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes } from './puces.js';

export const LIMITES_SIGNET = { adresse: 2048, titre: 300 };

// La lecture d'une adresse vit dans core/lien.js (R-UX-11) : components.js en a besoin pour les cartes de liste, et
// ce module importe components.js — la fonction ne peut pas vivre ici sans créer un cycle. Ré-exportée pour que
// l'API du signet reste d'un seul tenant.
export { lienSignet } from '../core/lien.js';

export function signetModel({ adresse = '', titre = '', editionId = '', cuisines = [], enCours = false } = {}) {
  const erreurs = {};
  const lien = lienSignet(String(adresse ?? '').trim());
  if (!lien.ok) erreurs.adresse = t('Adresse non reconnue.');
  else if (lien.href.length > LIMITES_SIGNET.adresse) erreurs.adresse = t('Adresse trop longue.');
  const titreNet = String(titre ?? '').trim();
  if (!titreNet) erreurs.titre = t('Donne un titre au lien.');
  // En POINTS DE CODE, comme borner() qui préremplit le champ : 151 emoji passent la borne du préremplissage et ne
  // doivent pas être refusés ici (l'adresse, elle, est ASCII après new URL : sa longueur en unités suffit).
  else if (Array.from(titreNet).length > LIMITES_SIGNET.titre) erreurs.titre = t('Titre trop long.');
  const valide = Object.keys(erreurs).length === 0;
  // D-T7 : `enCours` vit DANS l'état, comme dans livre-ajout.js — le bouton se ferme parce que le MODÈLE le dit,
  // pas parce qu'un geste a touché un nœud au passage. `valide` reste la validité de la SAISIE (ce que l'écriture
  // revérifie, S13) ; `peutEnregistrer` est ce que le bouton suit.
  return {
    valide, erreurs, enCours: !!enCours, peutEnregistrer: valide && !enCours,
    href: erreurs.adresse ? null : lien.href, hote: erreurs.adresse ? null : lien.hote,
    titre: titreNet, editionId: editionId || '', cuisines: Array.isArray(cuisines) ? [...cuisines] : [],
  };
}

// Une recette-référence et rien d'autre : pas de version, pas d'ingrédient, pas de durée — l'app n'a rien lu (I-E).
// source_label garde l'hôte pour les listes, mais aucun affichage ne lui fait confiance : tout est recalculé (S7).
export function fabriquerSignet(m, { newId, langue }) {
  const fiche = {
    id: newId('rc'), edition_id: m.editionId || null, original_title: m.titre, original_language: langue,
    availability: 'reference_only', verification_state: 'unverified', printed_page: null, section: null, type: null,
    tags: [], cuisines: [...m.cuisines], favorite: false, source_page_ids: [], current_version_id: null,
    ingredient_ids: [], source_url: m.href, source_label: m.hote,
  };
  assertVocabulaire(fiche, 'recipes'); // D-12 : le fabricant vérifie le vocabulaire fermé avant toute écriture
  return fiche;
}

// Deuxième porte de la borne S13 : une adresse hostile ou trop longue qui arriverait d'ailleurs que de l'écran
// (un état bricolé, un appel direct) est refusée ICI, avant toute écriture.
export async function enregistrerSignet(etat, { repo: r = repo, langue = getUiLocale() } = {}) {
  const m = signetModel(etat);
  if (!m.valide) throw new Error('signet_invalide');
  return r.save('recipes', fabriquerSignet(m, { newId: r.newId, langue }));
}

// Un champ texte reste un <label> (field() en rend un) : correct autour d'un input. Son erreur vit dans un <small>
// stable et nommé, pour que la frappe la mette à jour SUR PLACE (majSignet) sans redessiner le champ ni voler le curseur.
function champTexte(libelle, cle, model, input) {
  const f = field(libelle, input);
  f.append(el('small', { dataset: { erreur: cle }, hidden: !model.erreurs[cle] }, model.erreurs[cle] || ''));
  return f;
}

export function renderSignet(model, gestes = {}) {
  const g = (nom) => (...a) => (typeof gestes[nom] === 'function' ? gestes[nom](...a) : undefined);
  const livres = model.livres?.length ? model.livres : [{ value: '', label: t('Aucun — recette indépendante') }];
  return el('section', { class: 'card stack signet' },
    el('p', null, t('Une recette ou une page que tu veux retrouver dans ta bibliothèque.')),
    el('small', { class: 'muted' }, t('L’app n’ouvre pas la page : donne-lui le titre.')),
    champTexte(t('Adresse *'), 'adresse', model, el('input', { type: 'url', inputmode: 'url', value: model.adresse ?? model.href ?? '', onInput: (e) => g('changerAdresse')(e.target.value) })),
    champTexte(t('Titre *'), 'titre', model, el('input', { type: 'text', value: model.titre, onInput: (e) => g('changerTitre')(e.target.value) })),
    field(t('Livre (facultatif)'), select(livres, model.editionId, (v) => g('changerLivre')(v))),
    // R-UX-8 : les puces ne vont JAMAIS dans un <label> — field() en rend un, et un clic sur le mot « Cuisines »
    // cocherait alors la première puce. Même habillage .field, sans l'enveloppe qui vole le clic.
    el('div', { class: 'field' }, el('span', null, t('Cuisines')),
      renderPuces(pucesModel({ choisies: model.cuisines, existantes: model.existantes || [] }), { basculer: g('basculerCuisine'), ajouter: g('ajouterCuisine') })),
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn primary', dataset: { role: 'enregistrer' }, disabled: !model.peutEnregistrer, onClick: g('enregistrer') }, t('Garder le lien'))));
}

// Mise à jour sur place pendant la frappe : l'écran ne doit jamais contredire l'état réel — une erreur affichée
// sous un bouton actif, ou un bouton éteint sans rien qui le dise, serait un mensonge. Rend le bouton, comme
// majBoutonEnregistrer de livre-ajout.js, pour que l'appelant puisse le fermer le temps d'une écriture.
export function majSignet(zone, model) {
  for (const cle of ['adresse', 'titre']) {
    const noeud = zone?.querySelector?.(`[data-erreur="${cle}"]`);
    if (!noeud) continue;
    noeud.textContent = model.erreurs[cle] || '';
    noeud.hidden = !model.erreurs[cle];
  }
  const bouton = zone?.querySelector?.('[data-role="enregistrer"]');
  if (bouton) bouton.disabled = !model.peutEnregistrer;
  return bouton || null;
}

// I-H : les trois gestes du monde extérieur sont injectables, avec les vrais par défaut — « Garder le lien » mène
// à la fiche de la recette créée, et c'est mesurable sans toucher à l'adresse.
export async function renderSignetRoute(params, query, ctx, { repo: r = repo, navigate: nav = navigate, toast: dire = toast } = {}) {
  // § 6 : préremplissage par la query (depuis « Garder ce lien » de la recherche web — ou un lien profond venu de
  // l'extérieur, S4). L'adresse arrive TELLE QUELLE (jamais tronquée : trop longue, signetModel la refuse — I-A/F9) ;
  // le titre est borné par points de code, Cc/Cf retirés (S2). Rien n'est écrit avant « Enregistrer ».
  const recue = typeof query?.adresse === 'string' && query.adresse.trim() !== '';
  const etat = { adresse: recue ? query.adresse : '', titre: borner(typeof query?.titre === 'string' ? query.titre : '', LIMITES_SIGNET.titre), editionId: '', cuisines: [], enCours: false };
  const livres = [{ value: '', label: t('Aucun — recette indépendante') },
    ...(ctx?.book_editions || []).map((e) => ({ value: e.id, label: libelleLivre(e, ctx?.booksById?.get(e.book_id)) }))];
  const existantes = cuisinesExistantes(ctx);
  const root = el('div', null, pageHeader(t('Garder un lien web'), { back: { href: '/add', label: t('Ajouter') } }));
  if (recue) {
    // R-WEB-8 : l'hôte vient de la MÊME décision que l'enregistrement (signetModel rogne par trim(), que l'analyseur d'URL ne
    // fait pas pour NBSP/U+FEFF/U+2028 ; il refuse aussi une adresse trop longue) — `hote` y vaut null pour toute adresse
    // refusée. La bannière est volontairement STATIQUE : « reçue » = l'adresse telle qu'elle est arrivée, la modifier dans
    // le champ ne la met pas à jour.
    const m = signetModel(etat);
    root.append(el('div', { class: 'status', dataset: { role: 'adresse-recue' } }, t('Adresse reçue : vérifie-la avant d’enregistrer.'), ' ', el('strong', null, m.hote || '')));
  }
  const zone = el('div', null);
  root.append(zone);
  // Une erreur ne s'affiche pas sur un champ encore vide : l'étoile du libellé et le bouton éteint disent déjà
  // qu'il manque quelque chose. « Adresse non reconnue. » sur un champ vide accuserait une saisie qui n'existe pas.
  const modelVu = () => {
    const m = signetModel(etat);
    const erreurs = {};
    for (const cle of ['adresse', 'titre']) if (String(etat[cle] ?? '').trim() && m.erreurs[cle]) erreurs[cle] = m.erreurs[cle];
    return { ...m, erreurs, adresse: etat.adresse, livres, existantes };
  };
  const dessiner = () => zone.replaceChildren(renderSignet(modelVu(), gestes));
  const gestes = {
    changerAdresse: (v) => { etat.adresse = v; majSignet(zone, modelVu()); },
    changerTitre: (v) => { etat.titre = v; majSignet(zone, modelVu()); },
    changerLivre: (v) => { etat.editionId = v; },
    basculerCuisine: (v) => { etat.cuisines = basculerPuce(etat.cuisines, v); dessiner(); },
    ajouterCuisine: (v) => { const apres = ajouterPuce(etat.cuisines, v); if (apres !== etat.cuisines) { etat.cuisines = apres; dessiner(); } },
    // Rien n'est annoncé avant l'écriture (I-B). Le bouton se ferme pendant : deux tapes pressées ne font pas deux
    // signets ; il se rouvre si l'écriture échoue, et la saisie reste intacte.
    enregistrer: async () => {
      const m = signetModel(etat);
      if (!m.peutEnregistrer) { dessiner(); return; }
      etat.enCours = true;
      majSignet(zone, modelVu());
      let rec;
      try {
        rec = await enregistrerSignet({ ...etat, enCours: false }, { repo: r });
      } catch (e) {
        etat.enCours = false;
        majSignet(zone, modelVu());
        logError('signet.enregistrer', { error: e });
        dire(t('Le lien n’a pas pu être gardé. Réessaie.'));
        return;
      }
      dire(t('Lien gardé'));
      nav(`/recipes/${encodeURIComponent(rec.id)}`);
    },
  };
  dessiner();
  return root;
}
