import { recetteActiveDansContexte } from './state.js';
import { mentionCycleRecette } from './corbeille.js';
// Écran « Créer une recette avec l'assistant IA » (spec 2026-10-18-creer-avec-l-ia § 3.2, § 5 ; table de décision P7 des
// amendements). L'état vit AU NIVEAU DU MODULE, comme la recherche web (search.js) : UN vol pour toute l'app (C-1), une mémoire de
// session (C-4), des vues abonnées purgées par isConnected (P6). Rien n'est écrit avant « Garder » ; « Garder » n'est pas rejouable
// (memoire.gardee posé AVANT l'écriture). Tout ce qui vient du modèle est rendu en TEXTE (el(), jamais innerHTML) ; le jeton de la
// session ne fait que passer de ctx.sync.auth.jeton() à creer() (R-T3-1) : il n'entre ni dans la mémoire, ni dans l'adresse, ni dans le DOM (C-8).
import { el, toast } from '../core/dom.js';
import { t, label, getUiLocale } from '../core/i18n.js';
import { navigate, remplacerAdresse, buildQuery } from '../core/router.js';
import { borner } from '../core/bornes.js';
import { logError } from '../core/log.js';
import * as repo from '../model/repo.js';
import { providerFrom } from '../domain/llm.js';
import { creerRecetteIA, construireDemandeCreation, fabriquerRecetteIA, estCreationIA, etiquetteCreationIA, conventionCreation, LIMITES_CREATION } from '../domain/creation-ia.js';
import { assessVersion } from '../domain/diet.js';
import { DIET_TAGS, RECIPE_TYPES } from '../model/schema.js';
import { pageHeader, field, select, sessionAssistant, carteConnexion, texteRefusAssistant } from './components.js';
import { demarrerConnexion } from './settings.js';
import { capturerRecette } from './recette-garde.js';

let memoire = null; // { cle, demande, filtres, langue, parente, changement, issue, gardee, echec } — ce qui est PARTI, jamais le formulaire
let vol = null;     // { cle, controller, promesse }
const vues = new Set(); // { root, redessiner }
export const etatCreation = () => ({ memoire: memoire ? { ...memoire } : null, enCours: !!vol });
export function reinitialiserCreation() { vol?.controller.abort(); vol = null; memoire = null; vues.clear(); } // tests seulement
function notifier() { for (const v of [...vues]) { if (!v.root.isConnected) { vues.delete(v); continue; } v.redessiner(); } }

const ISSUE_INTERNE = Object.freeze({ etat: 'indisponible', raison: 'interne', motif: null, recette: null, avertissements: Object.freeze([]), modele: null, usage: null });
const ISSUE_HORS_LIGNE = Object.freeze({ ...ISSUE_INTERNE, raison: 'hors_ligne' });
// Textes des raisons connues (lus par Object.hasOwn : « constructor » n'est pas une raison connue) ; les autres : texte générique + code.
// Les refus de la passerelle (non_admis, quota, trop lourd) ont leur texte dans components.js (texteRefusAssistant, R-T4-4) ; non_connecte
// (la session a disparu entre le rendu et le clic) a sa carte « Connecte-toi » : ni l'un ni l'autre n'offre « Réessayer ».
const TEXTES_INDISPONIBLE = {
  hors_ligne: 'Tu es hors ligne.',
  trop_de_demandes: 'Trop de demandes pour l’instant. Réessaie dans une minute.',
  refus: 'L’assistant a refusé cette demande.',
  interrompu: 'Réponse coupée : réessaie avec une demande plus courte.',
  illisible: 'L’assistant n’a pas rendu une recette lisible. Recommence.',
};
const SANS_REESSAI = ['refus', 'non_admis', 'quota'];

// C-16 : la demande (et, en adaptation, le changement) préremplie est nettoyée comme construireDemandeCreation la nettoiera (fins de
// ligne en espaces, Cc/Cf retirés, NFC, espaces repliés), puis bornée à 500 points de code.
const nettoyerDemande = (v, max = LIMITES_CREATION.demande) => (typeof v === 'string' ? borner(borner(v.replace(/[\t\n\v\f\r\x85\p{Zl}\p{Zp}]/gu, ' '), Number.MAX_SAFE_INTEGER).normalize('NFC').replace(/\s+/g, ' ').trim(), max) : '');
const entierDans = (v, [min, max]) => { const s = String(v ?? '').trim(); if (!/^\d{1,4}$/.test(s)) return null; const n = Number(s); return n >= min && n <= max ? n : null; };

// C-16 : préremplissage depuis l'adresse = liste blanche (restrictions ⊂ DIET_TAGS, type ∈ RECIPE_TYPES, portions 1-12, max 5-240 ;
// hors bornes : portions de la parente sinon 4, max retiré). Pur ; le nom est celui du plan (T4 et T8 le citent).
export function filtresDepuisQuery(query = {}, parente = null) {
  const diets = [...new Set(String(query?.diets ?? '').split(',').map((s) => s.trim()).filter((d) => DIET_TAGS.includes(d)))];
  const type = RECIPE_TYPES.includes(query?.type) ? query.type : null;
  const servings = entierDans(query?.portions, LIMITES_CREATION.portions) ?? entierDans(parente?.servings, LIMITES_CREATION.portions) ?? 4;
  return { diets, type, servings, maxMinutes: entierDans(query?.max, LIMITES_CREATION.minutes) };
}
// L'état du formulaire garde le TEXTE des champs numériques, et s'ils sont illisibles (validity.badInput : « 3- » rend value '').
const formulaireDe = ({ demande, filtres: f, changement }) => ({ demande, diets: [...f.diets], type: f.type || '', portions: String(f.servings), max: f.maxMinutes == null ? '' : String(f.maxMinutes), changement: changement || '', illisible: { portions: false, max: false } });
// R-CRE-11 : les filtres de la création de départ, mis en forme d'ADRESSE pour passer par la même liste blanche que C-16 (filtresDepuisQuery) ;
// seules des valeurs de la bonne nature sont reprises (une ligne reçue peut porter n'importe quoi : rien n'est converti en texte au hasard).
function filtresDeLaParente(parente) {
  const f = parente?.provenance?.creation?.filtres;
  if (!f || typeof f !== 'object') return {};
  return { diets: Array.isArray(f.diets) ? f.diets.filter((d) => DIET_TAGS.includes(d)).join(',') : '', type: typeof f.type === 'string' ? f.type : '', max: Number.isInteger(f.maxMinutes) ? String(f.maxMinutes) : '' };
}
// T7 : en adaptation, le changement est relu de l'adresse (posé par lancer(), F2) — sinon une reconstruction ou un retour arrière perdrait la
// clé de ce qui est parti et afficherait K1 à tort. Sans ?adapter valide, il est ignoré (C-16). R-CRE-11 : adresse FRAÎCHE (pas de
// `changement`) → restrictions, type et temps maximal de la parente, un champ présent dans l'adresse l'emportant ; dès que `changement` est
// dans l'adresse (lancer()), SEULE l'adresse compte (une restriction retirée avant le lancement ne revient pas au retour arrière).
const formulaireInitial = (query, parente) => {
  const q = query && typeof query === 'object' ? query : {};
  const fraiche = !!parente && !Object.hasOwn(q, 'changement');
  return formulaireDe({ demande: nettoyerDemande(q.q) || (parente ? nettoyerDemande(parente.provenance?.creation?.demande) : ''), filtres: filtresDepuisQuery(fraiche ? { ...filtresDeLaParente(parente), ...q } : q, parente), changement: parente ? nettoyerDemande(q.changement, LIMITES_CREATION.changement) : '' });
};
// « Recommencer » relance ce qui est PARTI (memoire), pas un formulaire modifié depuis (§ 3.2).
const formulaireDepuis = (m) => formulaireDe(m);
// C-10 : la demande part comme elle est affichée — une valeur que construireDemandeCreation remplacerait (portions 13 → 4) ou qu'une
// saisie illisible a vidée (« 3- » dans Temps maximal partait SANS maximum) n'est pas envoyable.
function lireFormulaire(form) {
  const servings = form.illisible?.portions ? null : entierDans(form.portions, LIMITES_CREATION.portions);
  const maxVide = !form.illisible?.max && String(form.max ?? '').trim() === '';
  const maxMinutes = maxVide || form.illisible?.max ? null : entierDans(form.max, LIMITES_CREATION.minutes);
  return { filtres: { diets: [...form.diets], type: form.type || null, servings, maxMinutes }, erreur: servings === null ? 'portions' : (!maxVide && maxMinutes === null ? 'max' : null) };
}
// Une issue reçue est relue avant d'être rangée : une forme inattendue est « interne », jamais un écran qui lève au rendu.
function issueSure(x) {
  if (!x || typeof x !== 'object' || typeof x.etat !== 'string') return ISSUE_INTERNE;
  if (x.etat !== 'trouve') return x;
  const r = x.recette;
  const lignesOk = Array.isArray(r?.ingredients) && r.ingredients.every((i) => i && typeof i === 'object' && typeof i.name === 'string' && typeof i.unit === 'string' && Number.isFinite(i.quantity));
  const ok = lignesOk && typeof r.title === 'string' && typeof r.description === 'string' && Number.isFinite(r.servings) && Number.isFinite(r.estimated_minutes) && Array.isArray(r.steps) && r.steps.every((s) => typeof s === 'string');
  return ok ? x : ISSUE_INTERNE;
}
// P7, résolution d'un vol : annule → mémoire inchangée ; un échec alors qu'une proposition payée n'est pas gardée → elle reste, l'échec
// s'affiche au-dessus (F21 élargi, quelle que soit la clé) ; sinon la mémoire devient ce qui vient de partir et ce qui en est revenu.
function resoudre(parti, brute) {
  const issue = issueSure(brute);
  if (issue.raison === 'annule') return;
  if (issue.etat !== 'trouve' && memoire?.issue?.etat === 'trouve' && !memoire.gardee) { memoire.echec = issue; return; }
  memoire = { ...parti, issue, gardee: null, echec: null };
}
const portionsTexte = (n) => (n === 1 ? t('1 portion') : t('{n} portions', { n }));

export async function renderCreerIA(params, query, ctx, { creer = creerRecetteIA, repo: r = repo, navigate: nav = navigate, toast: dire = toast, enLigne = () => navigator.onLine !== false, remplacerAdresse: remplacer = remplacerAdresse } = {}) {
  // C-15 : ?adapter n'est accepté que pour une création IA dont la fiche existe ; la parente porte le titre de sa fiche (P15).
  const idParente = typeof query?.adapter === 'string' && query.adapter ? query.adapter : null;
  const versionParente = idParente ? ctx?.versionsById?.get(idParente) : null;
  const ficheParente = versionParente ? ctx?.recipesById?.get(versionParente.recipe_id) : null;
  const parente = versionParente && ficheParente && estCreationIA(versionParente) ? { ...versionParente, title: ficheParente.original_title } : null;
  if (ficheParente && !recetteActiveDansContexte(ficheParente, ctx)) return mentionCycleRecette(ficheParente, ctx?.editionsById?.get(ficheParente.edition_id));
  const contexteRecette = await capturerRecette(r, parente ? ficheParente : { id: 'nouvelle-recette' }, { ctx, creation: !parente });
  const fournisseur = providerFrom(ctx?.settings, { session: await sessionAssistant(ctx) }); // la passerelle (R-T3-1) : la session décide
  const connecter = () => demarrerConnexion(ctx?.sync?.auth);
  // P7.2 (C-14, P29) : décidée une fois par instance ; jamais un appel derrière une garde.
  // T7 : une parente sans listes d'ingrédients et d'étapes (ligne reçue informe) est refusée comme C-15 ; une parente que
  // construireDemandeCreation refuserait (hors bornes C-7 : parenteBornee) est dite d'emblée — la sonde passe une demande et un
  // changement non vides, seule la parente peut donc faire refuser.
  const formeParente = !!parente && Array.isArray(parente.ingredients) && Array.isArray(parente.steps);
  const parenteTropLongue = formeParente && !!construireDemandeCreation({ demande: '.', parente, changement: '.' }).erreur;
  const garde = !fournisseur.configured ? { connexion: true } // R-T4-4 : sans session, « Connecte-toi… » + « Se connecter »
    : idParente && !formeParente ? { texte: 'Cette version ne peut pas être adaptée ici.' }
      : parenteTropLongue ? { texte: 'Cette recette est trop longue pour être adaptée par l’assistant.' } : null;
  let form = formulaireInitial(query, parente);
  let ouvert = false; // « Modifier la demande » (P7.4) : le formulaire replié devient visible

  const root = el('div', null, pageHeader(parente ? t('Adapter avec l’IA') : t('Créer une recette avec l’assistant IA'), { back: parente ? { href: `/recipes/${encodeURIComponent(ficheParente.id)}?v=${encodeURIComponent(parente.id)}`, label: t('Retour à la recette') } : { href: '/add', label: t('Ajouter') } }));
  const zone = el('div', { class: 'stack' });
  root.append(zone);
  const partout = () => { notifier(); if (!root.isConnected) render(); };

  const demandeCourante = () => {
    const { filtres, erreur } = lireFormulaire(form);
    if (erreur) return { erreur };
    const langue = getUiLocale();
    return { ...construireDemandeCreation({ demande: form.demande, filtres, langue, parente, changement: form.changement }), langue };
  };
  const cleCourante = () => demandeCourante().cle ?? null;
  const k1Cache = (C) => !(memoire?.issue?.etat === 'trouve' && memoire.cle !== C);
  const messageAide = () => {
    if (parente && !nettoyerDemande(form.changement, LIMITES_CREATION.changement)) return t('Écris ce que tu veux changer dans cette recette.'); // P15 : rien ne part sans changement
    if (!nettoyerDemande(form.demande)) return t('Écris d’abord ce que tu veux cuisiner.');
    const { erreur } = lireFormulaire(form);
    if (erreur === 'portions') return t('Portions : un nombre entier de 1 à 12.');
    if (erreur === 'max') return t('Temps maximal : de 5 à 240 minutes, ou vide.');
    return '';
  };
  // La saisie ne redessine JAMAIS (focus et clavier de l'iPhone) : elle bascule sur place le bouton, l'aide et la mention K1.
  function majSaisie() {
    const C = cleCourante();
    const b = root.querySelector('[data-role="creer-ia"]'); if (b) b.disabled = C === null;
    const aide = root.querySelector('[data-role="aide-ia"]'); if (aide) { const m = messageAide(); aide.textContent = m; aide.hidden = !m; }
    const k1 = root.querySelector('[data-role="k1"]'); if (k1) k1.hidden = k1Cache(C);
  }

  // C-1 : la garde est SYNCHRONE et au module — un vol en cours refuse toute nouvelle création, d'où qu'elle vienne (l'abandon côté
  // client n'est pas garanti non facturé : rien n'est annulé à la place de la personne). `vol` est posé avant tout `await`.
  function lancer(depsForces = {}) {
    if (vol) { dire(t('Une création est déjà en cours : annule-la d’abord.')); partout(); return; }
    const d = demandeCourante();
    if (!d.cle) { render(); return; }
    const parti = { cle: d.cle, demande: d.demande, filtres: d.filtres, langue: d.langue, parente, changement: d.changement, contexteRecette };
    ouvert = false;
    // F2 / C-10 : l'adresse porte ce qui part — les seuls champs de la liste blanche C-16 — pour qu'une reconstruction retrouve la clé.
    remplacer('/recipes/creer' + buildQuery({ q: d.demande, diets: d.filtres.diets.join(','), type: d.filtres.type || '', portions: d.filtres.servings, max: d.filtres.maxMinutes || '', adapter: parente?.id || '', changement: d.changement || '' }));
    const enLigneIci = depsForces.enLigne ?? enLigne;
    if (!enLigneIci()) { resoudre(parti, ISSUE_HORS_LIGNE); partout(); return; } // C-14 : dit avant tout appel
    const controller = new AbortController();
    const promesse = Promise.resolve()
      .then(async () => {
        const session = await sessionAssistant(ctx);
        if (parente) await r.saveBatch({}, { recettes: [contexteRecette] });
        if (contexteRecette.contexteValide && !contexteRecette.contexteValide()) throw Error('compte_change');
        return creer({ demande: d.demande, filtres: d.filtres, langue: d.langue, session, parente, changement: d.changement }, { enLigne: enLigneIci, signal: controller.signal });
      })
      .catch(() => ISSUE_INTERNE)
      .then((issue) => {
        if (vol?.promesse !== promesse) return; // abandonnée ou remplacée : muette
        vol = null;
        resoudre(parti, issue);
        notifier();
      });
    vol = { cle: d.cle, controller, promesse };
    partout();
  }
  const annuler = () => { vol?.controller.abort(); vol = null; partout(); };
  const recommencer = () => { if (!memoire) return; if (!vol) form = formulaireDepuis(memoire); lancer(); }; // pendant un vol : lancer() refuse et le dit

  // C-4 : UNE écriture ; gardee posé de façon synchrone AVANT l'écriture (un second clic, un bouton périmé d'une autre vue n'écrivent
  // pas), remis à null si elle échoue ; rien n'est annoncé avant qu'elle ait réussi. Fabriqué depuis la mémoire (ce qui est parti).
  async function garder() {
    const m = memoire;
    if (!m || m.issue?.etat !== 'trouve' || m.gardee || vol) return;
    let fab;
    try {
      fab = fabriquerRecetteIA({ recette: m.issue.recette, demande: m.demande, filtres: m.filtres, langue: m.langue, modele: m.issue.modele ?? null, usage: m.issue.usage ?? null, convention: conventionCreation(), parente: m.parente, changement: m.changement, newId: r.newId, maintenant: new Date().toISOString() });
    } catch (e) { logError('creer_ia.fabriquer', { error: e }); dire(t('La recette n’a pas pu être gardée. Réessaie.')); return; }
    const gardee = { recipeId: fab.version.recipe_id, versionId: fab.version.id, ecrite: false };
    m.gardee = gardee;
    for (const v of vues) for (const b of v.root.querySelectorAll('[data-role="garder-ia"], [data-role="recommencer-ia"]')) b.disabled = true;
    try {
      await r.saveBatch(fab.recipe ? { recipes: [fab.recipe], recipe_versions: [fab.version] } : { recipe_versions: [fab.version] }, {
        recettes: [{ ...m.contexteRecette, recipe_id: fab.version.recipe_id }],
        ...(fab.recipe ? { conditions: { recipes: [{ key: fab.recipe.id, absente: true }] } } : {}),
      });
    } catch (e) {
      if (m.gardee === gardee) m.gardee = null;
      logError('creer_ia.garder', { error: e });
      dire(t('La recette n’a pas pu être gardée. Réessaie.'));
      partout();
      return;
    }
    gardee.ecrite = true;
    dire(t('Recette gardée'));
    partout();
    nav(cheminFiche(gardee));
  }
  const cheminFiche = (g) => `/recipes/${encodeURIComponent(g.recipeId)}?v=${encodeURIComponent(g.versionId)}`;

  // P7 — table de décision (première ligne qui s'applique). V = vol, M = mémoire, C = clé du formulaire, T = M trouvé, G = M gardé.
  function render() {
    for (const v of [...vues]) if (!v.root.isConnected) vues.delete(v);
    if (![...vues].some((v) => v.root === root)) vues.add({ root, redessiner: render });
    zone.replaceChildren(...[garde ? null : resumeParente(), ...contenu()].filter(Boolean));
  }
  function contenu() {
    const M = memoire;
    const T = M?.issue?.etat === 'trouve';
    const G = !!M?.gardee;
    if (vol) return [ecranDuVol(), T && !G ? proposition(M) : null]; // 1 : toute instance, toute clé
    if (garde) return [carteGarde(garde)]; // 2
    const C = cleCourante();
    const egal = !!M && C !== null && M.cle === C;
    if (T && G) return egal ? [blocGardee(M.gardee), proposition(M)] : [formulaire({ k1: true }), blocGardee(M.gardee), proposition(M)]; // 3
    if (T && egal) return [ouvert ? formulaire({ k1: true }) : null, M.echec ? blocIssue(M.echec) : null, proposition(M, { actions: 'toutes' })]; // 4
    if (T) return [formulaire({ k1: true }), M.echec ? blocIssue(M.echec) : null, proposition(M, { actions: 'garder' })]; // 5
    if (M && egal) return [blocIssue(M.issue), formulaire()]; // 6
    return [formulaire()]; // 7
  }

  const libelleCreer = () => (parente ? t('Créer cette adaptation') : t('Créer ma recette'));
  // T7 : la recette de départ (titre de sa FICHE, portions de la version), en texte seul ; rappel que l'original ne bouge pas (C-12).
  const resumeParente = () => (parente ? el('div', { class: 'card flat stack', dataset: { role: 'parente-ia' } },
    el('small', { class: 'muted' }, t('Recette de départ')),
    el('strong', null, typeof parente.title === 'string' ? parente.title : ''),
    Number.isInteger(parente.servings) && parente.servings > 0 ? el('span', { class: 'muted' }, portionsTexte(parente.servings)) : null,
    el('small', { class: 'muted' }, t('L’original reste tel quel : l’adaptation s’ajoute comme une autre version de la recette.'))) : null);
  const carteGarde = (g) => el('div', { class: 'card flat stack', dataset: { role: 'garde-ia' } },
    g.connexion ? carteConnexion(connecter, ctx) : el('div', { class: 'status warn' }, el('span', null, t(g.texte))));
  const ecranDuVol = () => el('div', { class: 'card flat stack' },
    el('div', { class: 'status', role: 'status' }, t('L’assistant compose une recette…')),
    // Sans data-role : ni la frappe ni une autre vue ne peuvent rallumer ce bouton pendant le vol (C-1).
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', disabled: true }, libelleCreer()),
      el('button', { type: 'button', class: 'btn', dataset: { role: 'annuler-ia' }, onClick: annuler }, t('Annuler'))));

  function formulaire({ k1 = false } = {}) {
    const C = cleCourante();
    const message = messageAide();
    const demande = el('textarea', { dataset: { role: 'demande-ia' }, maxlength: LIMITES_CREATION.demande, placeholder: t('Ex. : saumon et fenouil au four, croûte aux herbes'), onInput: (e) => { form.demande = e.target.value; majSaisie(); } });
    demande.value = form.demande;
    const puce = (d) => {
      const b = el('button', { type: 'button', class: 'puce', dataset: { diet: d }, 'aria-pressed': form.diets.includes(d) ? 'true' : 'false' }, label('diet', d));
      b.addEventListener('click', () => { form.diets = form.diets.includes(d) ? form.diets.filter((x) => x !== d) : [...form.diets, d]; b.setAttribute('aria-pressed', form.diets.includes(d) ? 'true' : 'false'); majSaisie(); });
      return b;
    };
    const type = select([{ value: '', label: t('Au choix de l’assistant') }, ...RECIPE_TYPES.map((v) => ({ value: v, label: label('recipe_type', v) }))], form.type, (v) => { form.type = v; majSaisie(); });
    type.name = 'type'; // P14
    const nombre = (nom, [min, max]) => el('input', { type: 'number', name: nom, min, max, step: 1, value: form[nom], onInput: (e) => { form[nom] = e.target.value; form.illisible = { ...form.illisible, [nom]: !!e.target.validity?.badInput }; majSaisie(); } });
    // T7 : en adaptation, le changement d'abord (c'est le but de l'écran) ; la frappe ne redessine jamais (focus iPhone), comme la demande.
    const changement = parente ? el('textarea', { dataset: { role: 'changement-ia' }, maxlength: LIMITES_CREATION.changement, placeholder: t('Ex. : sans four, plus épicé, avec du poulet'), onInput: (e) => { form.changement = e.target.value; majSaisie(); } }) : null;
    if (changement) changement.value = form.changement;
    return el('div', { class: 'card stack', dataset: { role: 'formulaire-ia' } },
      changement ? field(t('Ce que tu veux changer'), changement, t('Pour changer les portions, modifie Portions.')) : null, // R-CRE-12
      // R-CRE-15 : l'exemple ne parle ni de portions, ni de durée, ni de restriction (ce qui est vérifié se règle dans les champs dessous).
      field(t('Ce que tu as, ce que tu veux'), demande, t('Portions, durée et restrictions se règlent ci-dessous.')),
      // R-UX-8 : un groupe de boutons ne va jamais dans un <label> (le clic sur le libellé presserait la première puce).
      el('div', { class: 'field' }, el('span', null, t('Restrictions')), el('div', { class: 'puces', role: 'group', 'aria-label': t('Restrictions') }, ...DIET_TAGS.map(puce))),
      field(t('Type de recette'), type),
      el('div', { class: 'row' }, field(t('Portions'), nombre('portions', LIMITES_CREATION.portions)), field(t('Temps maximal (minutes, facultatif)'), nombre('max', LIMITES_CREATION.minutes))),
      k1 ? el('div', { class: 'status warn', dataset: { role: 'k1' }, hidden: k1Cache(C) }, t('La demande a changé depuis cette proposition.')) : null,
      el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', dataset: { role: 'creer-ia' }, disabled: C === null, onClick: () => lancer() }, k1 ? t('Créer à nouveau') : libelleCreer())),
      el('small', { class: 'muted', dataset: { role: 'aide-ia' }, hidden: !message }, message),
      el('small', { class: 'muted' }, t('Une création = un appel à l’assistant, compté dans ton quota du jour.')));
  }

  function blocIssue(issue) {
    const reessayer = () => el('button', { type: 'button', class: 'btn', dataset: { role: 'reessayer-ia' }, onClick: () => lancer({ enLigne: () => true }) }, t('Réessayer')); // navigator.onLine peut mentir
    // La session a disparu entre le rendu et le clic : la carte « Connecte-toi » ; relancer sans session ne mènerait à rien.
    if (issue.raison === 'non_connecte') return el('div', { class: 'card flat stack', dataset: { role: 'issue-ia' } }, carteConnexion(connecter, ctx));
    const refus = texteRefusAssistant(issue); // non_admis, quota (avec ou sans nombre), demande trop lourde (R-T4-4, R-T4-9)
    const raison = typeof issue.raison === 'string' && issue.raison ? issue.raison : 'inconnu';
    const connue = Object.hasOwn(TEXTES_INDISPONIBLE, raison);
    const code = refus ? null : (raison === 'illisible' ? (issue.motif || raison) : (connue ? null : raison)); // K3 : le code reste lisible sous le texte générique
    return el('div', { class: 'card flat stack', dataset: { role: 'issue-ia' } },
      el('div', { class: 'status warn', role: 'status' }, el('span', null, refus ?? t(connue ? TEXTES_INDISPONIBLE[raison] : 'L’assistant n’a pas répondu. Réessaie.'))),
      code ? el('small', { class: 'muted' }, t('Code : {c}', { c: String(code) })) : null,
      SANS_REESSAI.includes(raison) || issue.trop_lourd === true ? null : reessayer());
  }

  const blocGardee = (g) => el('div', { class: 'card flat stack', dataset: { role: 'gardee-ia' } },
    g.ecrite
      ? [el('div', { class: 'status ok' }, t('Recette gardée')), el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn primary', dataset: { role: 'ouvrir-fiche' }, onClick: () => nav(cheminFiche(g)) }, t('Ouvrir la fiche')))]
      : el('div', { class: 'status', role: 'status' }, t('Enregistrement de la recette…')));

  // L'aperçu est fabriqué comme « Garder » le fera (mêmes lignes, mêmes étapes) mais avec des identifiants jetables : jamais écrit.
  const apercu = (m) => fabriquerRecetteIA({ recette: m.issue.recette, demande: m.demande, filtres: m.filtres, langue: m.langue, modele: m.issue.modele ?? null, usage: m.issue.usage ?? null, convention: null, parente: m.parente, changement: m.changement, newId: (p) => `${p}_apercu`, maintenant: null }).version;
  const demandeEnvoyee = (m) => [m.demande, m.filtres.diets.length ? m.filtres.diets.map((d) => label('diet', d)).join(' ; ') : null, m.filtres.type ? label('recipe_type', m.filtres.type) : null, portionsTexte(m.filtres.servings), m.filtres.maxMinutes ? t('au plus {m} min', { m: m.filtres.maxMinutes }) : null, m.changement ? t('Changement : {c}', { c: m.changement }) : null].filter(Boolean).join(' · ');
  // C-9 / S1 / P9 : les restrictions DEMANDÉES, évaluées par assessVersion (N-8) ; jamais « Compatible » sur une proposition — tout état
  // autre qu'« incompatible » se dit « À vérifier », avec la ligne à retirer quand seul un facultatif bloque. La ligne est celle ÉCRITE.
  function evaluation(m, version) {
    const diets = Array.isArray(m.filtres?.diets) ? m.filtres.diets : [];
    if (!diets.length) return null;
    const parIds = ctx?.ingredientsById instanceof Map ? ctx.ingredientsById : new Map();
    return el('div', { class: 'stack', dataset: { role: 'evaluation-ia' } }, el('h3', null, t('Restrictions demandées')),
      el('ul', null, ...diets.map((d) => {
        const a = assessVersion(version, parIds, d);
        const lignes = a.blocking.map((b) => (b.source_text || b.label) + (b.proposed ? ` (${t('identité proposée')} : ${b.label} ?)` : '')).join(', ');
        // R-CRE-9 : un facultatif à retirer ne se lit jamais comme la liste complète — les lignes inconnues sont nommées avant lui.
        // Deux clés à une seule variable : un texte du modèle qui contiendrait « {lignes} » n'est jamais substitué une seconde fois.
        const etat = a.state === 'incompatible' ? t('Incompatible : {lignes}', { lignes })
          : a.blocking.length && a.unknown.length ? `${t('À vérifier : {inconnues}', { inconnues: a.unknown.join(', ') })} ; ${t('à retirer : {lignes}', { lignes })}`
            : a.blocking.length ? t('À vérifier, à retirer : {lignes}', { lignes }) : t('À vérifier');
        return el('li', null, `${label('diet', d)} — ${etat}`);
      })));
  }
  function proposition(m, { actions = null } = {}) { // actions : null (inerte) | 'garder' | 'toutes'
    const rec = m.issue.recette;
    const version = apercu(m);
    const conseils = Array.isArray(rec.tips) ? rec.tips : [];
    const notes = Array.isArray(rec.restrictions_notes) ? rec.restrictions_notes : [];
    const avertissements = Array.isArray(m.issue.avertissements) ? m.issue.avertissements : [];
    const u = m.issue.usage;
    return el('section', { class: 'card stack proposition', dataset: { role: 'proposition-ia' } },
      el('div', null, el('span', { class: 'badge ai', dataset: { role: 'etiquette-ia' } }, t(etiquetteCreationIA(version)))),
      el('h2', null, m.parente ? (typeof m.parente.title === 'string' ? m.parente.title : '') : rec.title), // T7 : une version n'a pas de titre — la fiche garde le sien
      el('p', { dataset: { role: 'description-ia' } }, t('Selon l’assistant : {texte}', { texte: rec.description })),
      el('div', { class: 'muted', dataset: { role: 'portions-ia' } }, `${portionsTexte(rec.servings)} · ${t('environ {m} min (estimé par l’assistant)', { m: rec.estimated_minutes })}`),
      ...avertissements.map((a) => el('div', { class: 'status warn' }, String(a))),
      el('h3', null, t('Ingrédients')), el('ul', { dataset: { role: 'ingredients-ia' } }, ...version.ingredients.map((l) => el('li', null, l.source_text))),
      el('h3', null, t('Étapes')), el('ol', { dataset: { role: 'etapes-ia' } }, ...version.steps.map((s) => el('li', null, s.text))),
      conseils.length ? [el('h3', null, t('Conseils')), el('ul', { dataset: { role: 'conseils-ia' } }, ...conseils.map((c) => el('li', null, t('Selon l’assistant : {texte}', { texte: c }))))] : null,
      notes.length ? [el('h3', null, t('À vérifier avant de servir')), el('ul', { dataset: { role: 'notes-ia' } }, ...notes.map((n) => el('li', null, String(n))))] : null,
      evaluation(m, version),
      el('div', { class: 'status warn', dataset: { role: 'avertissement-ia' } }, t('L’assistant n’a pas cuisiné cette recette : vérifie les quantités, les cuissons et les étiquettes avant de la servir.')),
      el('div', { class: 'muted', dataset: { role: 'demande-envoyee' } }, t('Demande envoyée : {q}', { q: demandeEnvoyee(m) })),
      Number.isInteger(u?.entree) && Number.isInteger(u?.sortie) ? el('small', { class: 'muted', dataset: { role: 'jetons-ia' } }, t('{u} jetons', { u: u.entree + u.sortie })) : null,
      m.gardee ? null : el('small', { class: 'muted', dataset: { role: 'memoire-ia' } }, t('Cette proposition n’est pas enregistrée : elle sera perdue à la fermeture de l’app.')),
      actions ? el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary', dataset: { role: 'garder-ia' }, onClick: garder }, t('Garder cette recette')),
        actions === 'toutes' ? el('button', { type: 'button', class: 'btn', dataset: { role: 'recommencer-ia' }, onClick: recommencer }, t('Recommencer')) : null,
        actions === 'toutes' && !ouvert ? el('button', { type: 'button', class: 'btn', dataset: { role: 'modifier-demande' }, onClick: () => { ouvert = true; render(); } }, t('Modifier la demande')) : null) : null);
  }

  render();
  // P6 : le routeur insère la racine APRÈS la fin de la route ; si un vol se résout dans cet intervalle, notifier() écarte la racine
  // encore détachée. Une fois montée, elle se réabonne et se redessine (sinon elle resterait figée sur l'écran du vol).
  setTimeout(() => { if (root.isConnected && ![...vues].some((v) => v.root === root)) render(); }, 0);
  return root;
}
