import { lireRendementTexte } from '../domain/rendement.js';
import { capturerRecette } from './recette-garde.js';
import { actionsRecette, menuActions, boutonsActions, texteErreurAction, capturerSelectionRecettes, executerSelectionRecettes } from './actions-contenu.js';
import { lienAvecOrigine, retourConnu, porteeNavigation } from './navigation-contexte.js';
import { lireEtatRecette } from '../domain/cycle-edition.js';
// Fiche recette (spec §17) : Original / Ma version, réglages combinables, unités et langue de lecture, remplacer un ingrédient,
// « Avec quoi on mange ça ? », autres recettes du plat, historique et « Refaire comme la dernière fois ».
import { el, toast, chooseDialog, promptDialog, confirmDialog, formatDate, formatMinutes, downloadBlob } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { currentVersion } from '../domain/search.js';
import { sectionLisible } from '../domain/llm.js';
import { scaleVersion } from '../domain/scaling.js';
import { assessVersion } from '../domain/diet.js';
import { toJsonLd, toPaprikaYaml } from '../domain/exporters.js';
import { DIET_TAGS } from '../model/schema.js';
import { reperesDe } from '../domain/recherche-web.js';
import { lirePage, relireResultat } from '../domain/lecture-web.js';
import { logError } from '../core/log.js';
import { pageHeader, section, sectionPlain, lienOrigine, dureeTotale, availabilityBadge, versionBadge, timeText, provenanceText, segmented, select, ingredientLineEl, timerBlock, dietChip, recipeCard, banniereLecture, sessionAssistant, carteConnexion, ligneReperes, contexteFichiers, vignettesDePages, boutonTelechargerPages, suivreLargeurAuMontage, etoiles } from './components.js';
import { monterPhotoPlat } from './photo-plat.js';
import { demarrerLectureWeb, texteEchecLecture, enLigneLecture, ligneWebOuverte } from './import-web.js';
import { demarrerConnexion } from './settings.js';
import { estCreationIA, etiquetteCreationIA, lireCreation, AVERTISSEMENT_CREATION_IA } from '../domain/creation-ia.js';
import { addToMealFlow } from './meals.js';
import { deviceId } from './import.js';
import { createTimerLaunch } from '../domain/timers.js';
import { lienSignet } from '../core/lien.js';
import { capitaliser } from './puces.js';
import { comparerCuissons, textePersonnel } from '../domain/cuisine-personnelle.js';
import { ouvrirCuissons, monterNotesPersonnelles, monterMesPhotos, boutonModifierObservation } from './cuisson.js';
import { estThermomix, gardeThermomix, etiquetteThermomix } from '../domain/thermomix.js';
import { enregistrerSessionCuisine } from '../domain/thermomix-session.js';
import { renderCopieCookidoo } from './cookidoo.js';
import { BLOCAGE_THERMOMIX, rappelThermomix } from './thermomix-garde.js';
import { resumeReperes, lienGestionPhoto } from './reperes-affichage.js';
import { photoPrincipale } from '../domain/cuisine-personnelle.js';
import { panneauPhotoPage } from './photo-page.js';
import { lireTraduction } from '../domain/traductions.js';
import { lireCycleRecette } from '../domain/cycle-recette.js';
import { panneauCycleRecette, TEXTE_NOUVEL_USAGE_REFUSE } from './corbeille.js';
import { photoVisible } from './photos-visibles.js';

// S7 : une adresse refusée s'affiche INERTE (jamais un <a>), et BORNÉE — une fiche venue d'une archive ou du
// serveur peut en porter 100 000 caractères, qui pousseraient la fiche entière hors de l'écran.
export const adresseInerte = (u) => { const s = String(u ?? ''); return s.length > 200 ? s.slice(0, 200) + '…' : s; };

// UI-1 (D-UI-6, B-I-6) : la durée d'une version, en UN nombre par formatMinutes (jamais la paire « actif · total » de timeText, qui reste dans
// l'en-tête d'Ingrédients). LA règle est celle de la carte-plat, dureeTotale (components.js : total_minutes, sinon prep + cook quand les DEUX sont
// connus — ronde 1 de T3, rien d'inventé ; null sans durée connue, non numérique, ou pour une création IA — C-6 : son estimation est dite à part) ;
// ici seulement la mise en forme, '' si rien ou ≤ 0.
export function dureeVersion(version) {
  const total = dureeTotale(version);
  return total !== null && total > 0 ? formatMinutes(total) : '';
}
// La ligne de repères de l'en-tête : « {n} portions · {durée} », chaque partie seulement si connue ; portions = celles de la VERSION affichée (une donnée,
// entier ≥ 1 — jamais la valeur du −/+, qui recalcule les lignes sans changer la recette) ; null quand rien n'est connu (aucune ligne rendue).
export function texteReperes(version) {
  if (!version) return null;
  const n = Number.isInteger(version.servings) && version.servings >= 1 ? version.servings : null;

  const parties = []; // ronde 1 : les parties sont toujours jointes par « · » (plus de clé combinée « {n} portions · {d} », doublon de « {n} portions »)
  if (n === 1) parties.push(t('1 portion')); else if (n !== null) parties.push(t('{n} portions', { n }));
  const rendement = lireRendementTexte(version);
  if (rendement) parties.push(rendement);
  return parties.length ? parties.join(' · ') : null;
}

// La largeur, suivie sur `change` (F-5) : le details s'ouvre ou se replie, le corps bascule entre colonnes et onglets — sans redessin. Ronde 1 (fuite
// de la revue) : AU PLUS UN abonné de fiche dans toute l'app. L'abonnement attend le MONTAGE (un rendu dépassé, jamais inséré, ne s'abonne pas), RELIT
// la largeur à cet instant (un change reçu entre le rendu et le montage n'est pas perdu) et retire celui de la fiche montée précédente ; une fiche
// quittée se retire au premier change. Depuis T4-R1, UNE aide partagée avec la bibliothèque et la fiche livre (suivreLargeurAuMontage, components.js).
const suivreLargeur = (racine, mq, appliquer) => suivreLargeurAuMontage('fiche-recette', racine, mq, () => appliquer());

// `deps` (lot B, facultatif : le routeur n'en passe pas) : les gestes de la lecture web { repo, navigate, toast, fetch, maintenant, enLigne } — la
// suite n'ouvre ni réseau ni navigation réelle. Lot F (§ 4.1.1) : le MÊME objet porte aussi `pickFiles` ; il est transmis tel quel à monterPhotoPlat
// (les clés que la zone ne connaît pas sont ignorées ; sans deps, ses défauts valent la production).
// Fidélité aux maquettes (28 octobre 2026) : en tête de fiche, les états ORDINAIRES (« Disponible », « Original ») ne s'affichent plus ; ceux qui disent
// quelque chose (« À importer », « Partielle », une version à moi ou de l'assistant, le type, les cuisines) restent. Rangée vide : rien.
// Cases à cocher des ingrédients : en mémoire seulement, par fiche (jamais écrites ; un rechargement les vide).
const COCHES = new Map();
let numeroCoche = 0;
function cochesDe(id) { if (!COCHES.has(id)) COCHES.set(id, new Set()); return COCHES.get(id); }

function rangeeEtat(...enfants) {
  const utiles = enfants.filter((b) => b && !(b.classList?.contains('available') || b.classList?.contains('original')));
  return utiles.length ? el('div', { class: 'row' }, ...utiles) : null;
}

// Les textes historiques restent consultables sans attribuer leurs positions à la source.
function textesTraductionConserves(contenu) {
  const texte = value => typeof value === 'string' ? value : Array.isArray(value)
    ? value.map(part => typeof part === 'string' ? part : t('Ce contenu ne peut pas être affiché.')).join('\n\n')
    : t('Ce contenu ne peut pas être affiché.');
  return el('details', { dataset: { role: 'ancienne-traduction' } }, el('summary', null, t('Consulter les textes conservés')),
    ...[['Titre traduit', contenu?.title], ['Ingrédients traduits', contenu?.ingredients], ['Étapes traduites', contenu?.steps]].map(([nom, valeur]) =>
      el('section', null, el('h4', null, t(nom)), el('div', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, texte(valeur)))));
}

export async function renderRecipe(params, query, ctx, deps = {}) {
  const recipe = ctx.recipesById.get(params.id);
  if (!recipe) return el('div', { class: 'card' }, t('Recette introuvable.'));
  // Ronde 1 : l'identifiant d'une fiche reçue ou restaurée peut porter « & », « ? » ou « # » — les adresses l'encodent (le geste ouvert est celui annoncé).
  const rid = encodeURIComponent(recipe.id);
  const cycle = lireEtatRecette(recipe, ctx.editionsById.get(recipe.edition_id)), lectureSeule = cycle.etat !== 'active';
  const origine=ctx.navigation?{cleEntree:ctx.navigation.cleEntree}:{};
  const lienEdition = (kind, v, locale) => lienAvecOrigine(`/recipes/${rid}/edit${buildQuery({ kind, v, locale })}`,origine);
  // Lot B (§ 4.1, § 4.5) : une fiche à adresse lisible porte « Voir la page d’origine » partout (I-B5, D-UI-10) ; la lecture par l'assistant a besoin de la session.
  const lienFiche = recipe.source_url ? lienSignet(recipe.source_url) : null;
  const lisibleParLAssistant = !!lienFiche?.ok && lienFiche.href.startsWith('https:');
  const sessionWeb = !lectureSeule && lisibleParLAssistant ? await sessionAssistant(ctx) : null;
  const gestesLecture = { repo: deps.repo ?? repo, fetch: deps.fetch, maintenant: deps.maintenant, enLigne: deps.enLigne };
  const naviguer = deps.navigate ?? navigate;
  const dire = deps.toast ?? toast;
  const enLigneWeb = () => (deps.enLigne ?? enLigneLecture)();
  let cuissonOuverte = false;
  // Ronde 1 : l'état en ligne est RELU à la tape (la fiche n'écoute pas online / offline : le bouton peut être resté allumé) — hors ligne, rien
  // n'est écrit (§ 4.4 : « Journal : rien ») ; une erreur qui n'est pas un refus (base indisponible, quota) est journalisée et dite, jamais un rejet
  // sans gestionnaire depuis un onClick.
  const lireWeb = async () => {
    if (!enLigneWeb()) { dire(t('Tu es hors ligne.')); return; }
    try {
      const r = await demarrerLectureWeb({ recipe: (await gestesLecture.repo.get('recipes', recipe.id)) ?? recipe, ctx }, gestesLecture);
      if (r.issue === 'ok') naviguer(lienAvecOrigine(`/recipes/${encodeURIComponent(recipe.id)}/importer`,origine).slice(1));
      else if (r.issue === 'refuse') dire(texteEchecLecture({ raison: r.raison === 'adresse' ? 'interdit' : r.raison }).texte);
    } catch (e) { logError('recipe.lire_web', { error: e, id: recipe.id }); dire(texteEchecLecture({ raison: 'interne' }).texte); }
  };
  const connecterWeb = () => demarrerConnexion(ctx?.sync?.auth);
  await repo.recordActivity(recipe.edition_id, 'open_recipe', { recipe_id: recipe.id });
  const versions = [...(ctx.versionsByRecipe.get(recipe.id) || [])].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const edition = recipe.edition_id ? ctx.editionsById.get(recipe.edition_id) : null;
  const book = edition ? ctx.booksById.get(edition.book_id) : null;
  const pages = (recipe.source_page_ids || []).map((id) => ctx.pagesById.get(id)).filter(Boolean);
  const history = ctx.cook_history.filter((h) => h.recipe_id === recipe.id).sort(comparerCuissons);
  const links = ctx.dish_recipe_links.filter((l) => l.recipe_id === recipe.id);
  const dishLink = links.find((l) => l.state === 'confirmed');
  const dish = dishLink ? ctx.dishesById.get(dishLink.dish_id) : null;
  const original = currentVersion(recipe, versions.filter((v) => v.kind !== 'adaptation' && v.kind !== 'synthesis')) || null;
  const adaptations = versions.filter((v) => v.kind === 'adaptation' || v.kind === 'synthesis');
  // `?v=` n'est suivi que pour une version de CETTE fiche (ronde 1) : une version d'une autre recette (adresse forgée, lien ancien) n'est jamais
  // affichée ici — sa lecture, son bandeau et son import ne sont pas ceux de cette fiche ; retour à la version courante.
  const demandee = query.v ? ctx.versionsById.get(query.v) : null;
  let version = (demandee?.recipe_id === recipe.id ? demandee : null) || original || versions[0] || null;
  const actionsCommunes=actionsRecette({recipe,version,ctx,origine},deps);
  const state = { servings: query.servings ? Number(query.servings) : version?.servings || null, units: ctx.settings.units, lang: query.lang || ctx.settings.reading_locale, diet: '', onglet: 'ingredients' };
  if(version&&!lectureSeule){
    const secondaire=(id,libelle,extra)=>({id,libelle:t(libelle),nomAccessible:t(libelle),eligible:true,...extra});
    const lienSecondaire=(id,libelle,href)=>{const a=secondaire(id,libelle,{verifier:actionsCommunes.find(a=>a.id==='modifier')?.verifier});Object.defineProperty(a,'href',{get:href});return a;};
    actionsCommunes.push(
      lienSecondaire('traduction','Traduction',()=>lienEdition('translation',version.id,['fr','en'].includes(state.lang)?state.lang:recipe.original_language==='fr'?'en':'fr')),
      lienSecondaire('variante','Créer ma version',()=>lienEdition('adaptation',version.id)),
      ...(version.steps?.length?[lienSecondaire('thermomix','Adapter au Thermomix',()=>lienAvecOrigine(`/recipes/${rid}/thermomix${buildQuery({v:version.id,servings:state.servings??''})}`,origine))]:[]),
      secondaire('courses','Liste d’épicerie',{executer:()=>makeList()}),
      secondaire('export-jsonld','Exporter JSON-LD',{actualise:false,executer:()=>exporter('jsonld')}),
      secondaire('export-yaml','Exporter YAML (Paprika)',{actualise:false,executer:()=>exporter('yaml')}),
    );
  }
  const conventionId = ctx.conventionFor(recipe);
  const root = el('div', null);

  // Lot F (D-F16) : ★ Favori n'écrit que `favorite`, sur la fiche RELUE — ronde 1 : DANS la transaction d'écriture (condition { key, fusion } par
  // saveBatch, comme photo-plat.js) : une photo du plat posée depuis le rendu (descente web, autre onglet), même pendant ce geste, survit. La valeur
  // écrite est celle que l'écran annonce (« ☆ » → favori), jamais l'inverse de la base. Le repo et le toast injectés (deps) servent ici aussi.
  let favoriEnCours=false;
  const favBtn = el('button', { class: 'btn discret', title: t('Favori'), 'aria-pressed': recipe.favorite ? 'true' : 'false', onClick: async () => {
    if(favoriEnCours)return;favoriEnCours=true;favBtn.disabled=true;
    try {
      const resultat=await actionsCommunes.find(a=>a.id==='favori').executer();
      if(resultat.issue!=='succes'){dire(resultat.raison==='source_absente'?t('Recette introuvable.'):texteErreurAction(resultat.raison,t('Favori')));return;}
      (deps.refresh??refresh)();
    } catch (e) { logError('recipe.favori', { error: e, id: recipe.id }); dire(texteErreurAction(e?.code,t('Favori'))); }
    finally{favoriEnCours=false;favBtn.disabled=false;}
  } }, recipe.favorite ? '★' : '☆', el('span', { class: 'fav-libelle' }, ' ' + t('Favori'))); // maquettes : sur iPhone, l'étoile seule à côté du titre (le mot reste lu)
  // UI-1 (D-UI-6, F-5) : la largeur par un matchMedia INJECTABLE (deps.matchMedia ; défaut : celui de la fenêtre, appelé SUR window — jamais la fonction
  // nue : « Illegal invocation »). Une seule requête, celle de .two-col (760 px, le motif de dish.js) ; `large()` la relit à chaque usage.
  const mq = (deps.matchMedia ?? ((requete) => window.matchMedia(requete)))('(min-width: 760px)');
  const large = () => !!mq.matches;
  // R-UI-P2 : le sous-titre reste la provenance (« {titre} — {auteur} · page N », hôte recalculé, étiquette IA) ; « Du web · » / « De mon livre · » sont les préfixes de la
  // CARTE-PLAT (ligneSource), pas de la fiche — § 4.2 amendé par T6 ; tests/creer-ia.js:1338, 1375, 1397, 1400 lisent ce header p tel quel.
  // Fidélité aux maquettes (28 octobre 2026) : le titre vit dans la colonne de gauche de l'en-tête, en face de la photo (posé plus bas, dans .fiche-etat).
  const entete = pageHeader(recipe.display_title || recipe.original_title, {
    subtitle: provenanceText(recipe, book, edition), back: (()=>{const repli=edition?`/books/${encodeURIComponent(edition.id)}`:'/library';const back=retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli});return {...back,label:back.cleEntree?t('Retour'):edition?book?.title||t('Livre'):t('Bibliothèque')};})(),
    actions: lectureSeule ? [] : [favBtn], classeTitre: 'titre-fiche',
  });

  // Conflit de version (spec § 5.5) : les deux appareils ont adapté cette recette en parallèle. AUCUNE version
  // n'est masquée — la liste des versions plus bas reste entière, et l'original n'est jamais réécrit ; seule une
  // ligne le dit, ici, là où la personne regarde la recette. La décision se prend dans Réglages, nulle part ailleurs.
  const conflit = await repo.get('sync_conflicts', 'recipes:' + params.id);
  let avisConflit = null; // posé dans la colonne de l'état, après sa rangée et ses bandeaux : avant la photo et « Commencer à cuisiner » en étroit (revue du 28 octobre)
  if (conflit?.kind === 'version') {
    avisConflit = (el('div', { class: 'card warn stack' },
      el('p', null, t('Une autre version a été créée ailleurs — les deux versions sont conservées.')),
      el('a', { class: 'btn', href: '#/settings' }, t('Trancher dans Réglages'))));
  }
  // Import ciblé (spec § 4.3.6-4.3.7) : ce que l'assistant a lu — l'état de vérification de la VERSION AFFICHÉE, le bandeau de lecture (daté de
  // la lecture, « Incertain : … » lu dans la ligne du journal par import_id, pointeur souple) et la photo du plat. `lecture` est null hors import.
  // Lot B : la ligne d'une lecture WEB porte sa recette sous resultat.recette (resultat = { source_kind, page, recette }) — la bannière lit ses champs incertains là.
  // Vague finale (I-B2, S-7) : ce résultat revenu du journal (synchro, archive) est RELU par relireResultat avant tout usage, comme à l'écran — une entrée
  // d'uncertain_fields qui porte une adresse est écartée ; illisible, il vaut null (la bannière retombe sur provenance.uncertain_fields).
  const ligneLue = (ctx.imports || []).find((i) => i?.id === version?.provenance?.import_id) || null;
  const lecture = banniereLecture(version, ligneLue?.kind === 'web' ? { ...ligneLue, resultat: relireResultat(ligneLue.resultat)?.recette ?? null } : ligneLue);
  // UI-1 (D-UI-6) : l'en-tête en deux colonnes — UN ordre de DOM : l'état (badges, bandeaux), la photo, les gestes (repères, « Voir la page d’origine »,
  // « Commencer à cuisiner » + « Corriger »). La feuille met la photo à droite dès 760 px et, en étroit, la laisse entre l'état et les gestes (sous la
  // provenance, avant les repères : la maquette mobile). Les gestes ne sont posés qu'avec une version (plus bas).
  const etat = el('div', { class: 'stack fiche-etat', dataset: { role: 'fiche-etat' } }, entete,
    rangeeEtat(availabilityBadge(recipe), versionBadge(version, recipe), lecture ? etatVerification(version) : null, recipe.type ? el('span', { class: 'badge' }, label('recipe_type', recipe.type)) : null, ...(recipe.cuisines || []).map((c) => el('span', { class: 'chip outline' }, capitaliser(c)))));
  if (recipe.original_title && recipe.display_title && recipe.display_title !== recipe.original_title) etat.append(el('p', { class: 'muted alias-recette' }, t('Titre original : {titre}', { titre: recipe.original_title })));
  etat.append(resumeReperes(recipe, version, { detail: true, modifier: !lectureSeule }));
  const web = bandeauWeb(version);
  if (web) etat.append(web); // lot B (§ 4.5) : la source d'une version lue sur le web, d'abord — puis la bannière du lot A
  if (lecture) etat.append(bandeauLecture(lecture));
  if (avisConflit) etat.append(avisConflit);
  const ctxF = await contexteFichiers(ctx); // lot G : compte, file_error et moteur, pour les vignettes et la photo du plat (§ 4.4)
  // Lot F (§ 4.1.1) : l'emplacement de tête (un div, jamais null : aucun nœud texte direct) ; la zone est insérée plus bas, après la préparation.
  const photo = lectureSeule ? { entete: photoVisible(photoPrincipale(recipe, history)?.sha256, {ctxF, classe:'photo-plat', personnelle:!!photoPrincipale(recipe, history)?.personnelle}) } : await monterPhotoPlat(recipe, ctx, { ...deps, ctxF });
  const photoFiche = el('div', { class: 'fiche-photo' }, photo.entete, lectureSeule ? null : lienGestionPhoto(recipe, { connue: !!photoPrincipale(recipe, history)?.sha256 }));
  const tete = el('div', { class: 'two-col fiche-tete', dataset: { role: 'fiche-tete' } }, etat, photoFiche);
  root.append(tete);
  const panneauCycle = lectureSeule ? await panneauCycleRecette(recipe, ctx, deps) : null; if (panneauCycle) root.prepend(panneauCycle);
  root.append(lectureSeule ? sectionPlain(t('Mes notes'), el('div', {style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}, textePersonnel(recipe.personal_notes))) : await monterNotesPersonnelles(recipe, { ctx, repo: gestesLecture.repo, toast: dire }));

  if (!version) {
    if(!lectureSeule)etat.insertBefore(el('div',{class:'row geste-principal',dataset:{role:'geste-principal'}},boutonsActions(actionsCommunes,['modifier']),menuActions(actionsCommunes,{titre:titreRecetteAffichee(),onResultat:()=> (deps.refresh??refresh)()})),etat.querySelector('.resume-reperes'));
    root.append(lectureSeule ? el('div', {class:'stack'}, lienOrigine(lienFiche), pages.length ? el('div', {class:'thumbs'}, ...((await vignettesDePages(pages, ctxF)).places.values())) : null) : await referenceOnly());
    if (!lectureSeule) root.append(el('p', { class: 'muted', dataset: { role: 'cuisson-reference' } }, t('Importe cette recette avant d’enregistrer une cuisson. Tes notes personnelles restent disponibles.')));
    // F-9 : la carte « Connecte-toi » et le bouton de lecture sont rendus cachée / éteint ; la session (déjà lue plus haut) les bascule ici —
    // jamais de flash « Connecte-toi » pour une personne connectée, jamais de carte retirée (le motif d'import.js).
    basculerSessionSignet(root, sessionWeb, enLigneWeb());
    return root;
  }

  // Sélecteur Original / Ma version — C-2 : sur une création IA (ou une fiche origine 'ia'), chaque version porte son étiquette, jamais
  // « Original » ; une version manuelle d'une fiche IA garde son statut.
  const statutDe = (v) => (v.status === 'tested' ? t('testée') : t('proposée'));
  const libelleOption = (v, { adaptation }) => {
    const ia = etiquetteCreationIA(v, recipe);
    if (!ia) return adaptation ? `${t('Ma version')} — ${statutDe(v)} ${formatDate(v.created_at)}` : t('Original');
    const statut = adaptation && !estCreationIA(v) ? ` — ${statutDe(v)}` : '';
    return adaptation ? `${t(ia)}${statut} ${formatDate(v.created_at)}` : t(ia);
  };
  const versionOptions = [];
  if (original) versionOptions.push({ value: original.id, label: libelleOption(original, { adaptation: false }) });
  for (const a of adaptations) versionOptions.push({ value: a.id, label: libelleOption(a, { adaptation: true }) });
  const estUneCreation = estCreationIA(version);
  const selectVersion = (id) => navigate(`/recipes/${rid}${buildQuery({ ...query, v: id, servings: state.servings || '', lang:state.lang })}`, { replace: true });
  // Les gestes de tête (D-UI-6, B-I-8) : les repères, le lien d'origine (toute adresse lisible, http compris : I-B5), puis « Commencer à cuisiner » pleine
  // largeur et, tant que la version AFFICHÉE n'est pas vérifiée, « Corriger » en lien texte à côté — le seul geste que « — vérifie » et « {n} lignes à
  // vérifier » réclament ; il reste aussi dans « autres gestes ».
  const reperes = texteReperes(version);
  const modifierTete=boutonsActions(actionsCommunes,['modifier']);
  const lienModifierTete=modifierTete.querySelector('[data-action=modifier]');if(lienModifierTete)lienModifierTete.dataset.role='corriger-tete';
  if (!lectureSeule) etat.insertBefore(el('div', { class: 'stack fiche-gestes', dataset: { role: 'fiche-gestes' } },
    reperes ? el('div', { class: 'reperes muted', dataset: { role: 'reperes' } }, reperes) : null,
    lienOrigine(lienFiche),
    el('div', { class: 'geste-principal', dataset: { role: 'geste-principal' } },
      el('button', { class: 'btn primary big block', onClick: startCooking }, t('Commencer à cuisiner')),
      modifierTete,menuActions(actionsCommunes,{titre:titreRecetteAffichee(),onResultat:()=> (deps.refresh??refresh)()})),
    el('button', { type: 'button', class: 'btn', dataset: { role: 'jai-cuisine' }, onClick: async () => {
      if (cuissonOuverte) return;
      cuissonOuverte = true;
      try { if (await ouvrirCuissons([{ recipe, version, servings: state.servings }], { ...deps, ctx, repo: gestesLecture.repo, toast: dire })) (deps.refresh ?? refresh)(); }
      finally { cuissonOuverte = false; }
    } }, t('J’ai cuisiné ce plat'))),etat.querySelector('.resume-reperes'));

  // « Portions, versions et autres gestes » (D-UI-6, § 13 point 4) : TOUT l'ancien contenu de la carte des contrôles et de la rangée d'actions, sauf
  // « Commencer à cuisiner » et le « Corriger » de tête — replié sous 760 px, ouvert au-dessus (le matchMedia, relu sur change) ; jamais « Réglages »
  // (l'app a déjà un écran de ce nom). L'Export reste en bas de la fiche, hors du details (H-3).
  const langues = [{ value: 'original', label: t('Original') }, { value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }];
  const langueLecture = segmented(langues, state.lang, (valeur) => {
    state.lang = valeur;
    // Le corps se redessine, mais ce contrôle reste monté dans le volet : son état doit suivre la lecture.
    for (const [i, bouton] of [...langueLecture.children].entries()) bouton.classList.toggle('active', langues[i].value === valeur);
    drawBody();
  });
  const autresGestes = el('details', { class: 'autres-gestes', open: false, dataset: { role: 'autres-gestes' } },
    el('summary', null, t('Portions, versions et autres gestes')),
    el('div', { class: 'stack' },
      el('div', { class: 'row between' },
        versionOptions.length > 1 ? select(versionOptions, version.id, selectVersion) : (etiquetteThermomix(version) || etiquetteCreationIA(version, recipe)) ? versionBadge(version, recipe) : el('span', { class: 'badge original' }, t('Original')),
        lectureSeule ? null : el('div', { class: 'row' },
          el('a', { class: 'btn small', href: lienEdition('adaptation', version.id) }, t('Créer ma version')),
          version.steps?.length ? el('a', { class: 'btn small', href: `#/recipes/${rid}/thermomix${buildQuery({ v: version.id, servings: state.servings ?? '' })}`, dataset: { role: 'adapter-thermomix' } }, t('Adapter au Thermomix')) : null,
          el('a', { class: 'btn small', href: lienEdition('correction', version.id) }, t('Corriger')),
          // Import ciblé (spec import-cible § 4.1, D-11) : une recette partielle se relit par l'écran déjà rattaché (import à refaire) ; une recette complète n'a pas d'entrée.
          recipe.availability === 'partial' && !recipe.source_url ? el('a', { class: 'btn small', href: `#/recipes/${encodeURIComponent(recipe.id)}/importer` }, t('Relire les pages')) : null,
          // Lot B (D-B18) : une fiche à adresse https qui a déjà une version se relit par l'assistant — absent sans session.
          lisibleParLAssistant && sessionWeb ? el('button', { type: 'button', class: 'btn small', dataset: { role: 'relire-web' }, onClick: lireWeb }, t('Relire la page avec l’assistant')) : null)),
      el('div', { class: 'row' },
        el('label', { class: 'field' }, el('span', null, t('Portions')), el('div', { class: 'row' },
          el('button', { class: 'btn small', onClick: () => setServings((state.servings || 1) - 1) }, '−'),
          el('strong', { id: 'servings-val' }, state.servings ?? t('inconnues')),
          el('button', { class: 'btn small', onClick: () => setServings((state.servings || 0) + 1) }, '+'))),
        el('label', { class: 'field' }, el('span', null, t('Unités')), segmented([{ value: 'original', label: t('Original') }, { value: 'metric', label: t('Métrique') }, { value: 'us', label: 'US' }], state.units, (v) => { state.units = v; drawBody(); })),
        el('label', { class: 'field' }, el('span', null, t('Langue de lecture')), langueLecture)),
      // N-5 : une création IA s'adapte par l'assistant (version enfant, original intact) ; les puces V1 s'effacent devant ce geste réel.
      lectureSeule ? null : estUneCreation
        ? el('div', { class: 'row' }, el('a', { class: 'btn small', href: `#/recipes/creer${buildQuery({ adapter: version.id })}`, dataset: { role: 'adapter-ia' } }, t('Adapter avec l’IA')))
        : el('div', { class: 'chips' },
          ...[t('Rapide'), t('On se gâte'), t('Meal prep')].map((n) => el('span', { class: 'chip neutral', title: t('Adaptation assistée : palier V1, non disponible dans cette version. Utilise « Créer ma version » pour décrire toi-même les changements.') }, `${n} · V1`))),
      el('small', { class: 'muted' }, t('Changer les portions, les unités ou la langue ne crée pas de nouvelle version. Les durées ne sont pas multipliées.')),
      lectureSeule ? null : el('div', { class: 'row', dataset: { role: 'autres-actions' } },
        el('a', { class: 'btn', href: `#/search${buildQuery({ for: recipe.id, role: 'salade', mode: 'all' })}` }, t('Avec quoi on mange ça ?')),
        el('button', { class: 'btn', onClick: () => addToMealFlow(ctx, { recipe, version, book, edition }, { role: recipe.type === 'salade' || recipe.type === 'soupe' || recipe.type === 'legumes' || recipe.type === 'feculent' ? 'accompagnement' : 'plat_principal' }) }, t('Ajouter à mon repas')),
        el('button', { class: 'btn', onClick: makeList }, t('Liste d’épicerie')),
        dish ? el('a', { class: 'btn', href: `#/dishes/${dish.id}` }, t('Autres recettes de ce plat')) : el('button', { class: 'btn', onClick: () => modifier(attachDish) }, t('Rattacher à un plat')))));
  root.append(autresGestes);

  const body = el('div', { class: 'recipe-body' }); // C-7 : overflow-wrap (styles.css)
  root.append(body);
  drawBody();
  if (!lectureSeule) root.append(el('details', { class: 'photo-source-details' }, el('summary', null, t('Image de la recette')), photo.zone)); // lot F (D-F2, D-F8) : seulement quand la fiche a une version
  const photoPage = lectureSeule ? null : await panneauPhotoPage(recipe, ctx, { ...deps, repo: gestesLecture.repo, ctxF, onPhotoChange: () => photo.redessiner?.() });
  if (photoPage) root.append(photoPage);
  root.append(await monterMesPhotos(recipe, history, { ...deps, ctx, lectureSeule:cycle.etat === 'invalide', consultation:lectureSeule, repo: gestesLecture.repo, toast: dire, ctxF, apres: () => photo.redessiner?.() }));
  const pagesOriginal = recipe.availability === 'reference_only' ? pages : pages.filter((p) => p.id !== recipe.index_page_id); // lot D (§ 4.8.4) : une fiche lue n'a pas sa photo d'index dans « Original » ; une référence la garde (D-C5)
  // Pages originales
  if (pagesOriginal.length) {
    const vignettes = await vignettesDePages(pagesOriginal, ctxF, { alt: () => t('Page originale') }); // ronde 1 : l'alt d'avant le lot G
    root.append(sectionPlain(t('Sources'), el('h3',null,t('Original')),el('p', { class: 'muted' }, t('Pages du livre telles que photographiées. Une adaptation n’est jamais présentée comme le texte original.')),
      boutonTelechargerPages(vignettes.distantes, { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
      el('div', { class: 'thumbs' }, ...pagesOriginal.map((p) => el('figure', null, vignettes.places.get(p.id), el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : ''))))));
  }
  // C-2 : une fiche origine 'ia' n'a pas de livre — un numéro de page tapé dans « Corriger » (champ « Page imprimée ») ne la fait pas passer pour une page d'original.
  else if (recipe.printed_page && recipe.origine !== 'ia') root.append(el('p', { class: 'muted' }, t('Original : page {p} du livre (pages non photographiées).', { p: recipe.printed_page })));

  // Versions
  root.append(sectionPlain(t('Versions'), el('ul', { class: 'list' }, ...versions.map((v) => el('li', { class: 'row between' },
    el('div', null, el('div', { class: 'row' }, versionBadge(v, recipe), el('span', { class: 'muted' }, `${label('version_kind', v.kind)} · ${formatDate(v.created_at, { withTime: true })}`), v.verification_state === 'to_verify' ? el('span', { class: 'chip warn' }, t('À vérifier')) : null),
      v.changes ? el('div', { style: { fontSize: '.9rem' } }, v.changes) : null,
      v.provenance?.generated_by === 'ai' && !estCreationIA(v) && !estThermomix(v) ? el('div', { class: 'muted', style: { fontSize: '.8rem' } }, t('Extraction IA ({m}) — vérifiée à la main ensuite ?', { m: v.provenance.model || 'IA' })) : null),
    el('div', { class: 'row' }, v.id !== version.id ? el('button', { class: 'btn small', onClick: () => selectVersion(v.id) }, t('Afficher')) : el('span', { class: 'chip ok' }, t('affichée')),
      !lectureSeule && (v.kind === 'adaptation' || v.kind === 'synthesis') && v.status !== 'tested' ? el('button', { class: 'btn small', onClick: () => modifier(async contexte => { await gestesLecture.repo.save('recipe_versions', { ...v, status: 'tested' }, {recettes:[contexte]}); refresh(); }) }, t('Marquer testée')) : null))))));

  // Historique
  if (history.length) root.append(sectionPlain(t('Mémoire culinaire'), el('ul', { class: 'list' }, ...history.map((h) => {
    const observation = el('div', { style: { fontSize: '.9rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, textePersonnel(h.notes));
    return el('li', { class: 'row between top' },
      el('div', null, el('strong', null, formatDate(h.cooked_at)), ` · ${h.servings ? t('{n} portions', { n: h.servings }) : ''}${etoiles(h.rating) ? ` · ${etoiles(h.rating)}` : ''}${h.redo === false ? ` · ${t('à ne pas refaire')}` : h.redo ? ` · ${t('à refaire')}` : ''}${Number.isFinite(h.actual_minutes) && h.actual_minutes >= 0 ? ` · ${h.actual_minutes} min` : ''}`,
        observation, el('div', { class: 'muted', style: { fontSize: '.8rem' } }, t('Observation liée à cette cuisson ; elle ne devient pas une règle universelle.'))),
      el('div', { class: 'row' }, cycle.etat === 'invalide' ? null : boutonModifierObservation(h, { recipe, ctx, repo: gestesLecture.repo, toast: dire, apres: texte => { observation.textContent = texte; } }),
        el('a', { class: 'btn small', href: `#/recipes/${rid}${buildQuery({ v: h.recipe_version_id, servings: h.servings || '' })}` }, lectureSeule ? t('Consulter cette cuisson') : t('Refaire comme la dernière fois'))));
  }))));

  // Export
  root.append(el('div', { class: 'row', style: { marginTop: '.5rem' } },
    el('button', { class: 'btn small', onClick: () => exporter('jsonld') }, t('Exporter JSON-LD')),
    el('button', { class: 'btn small', onClick: () => exporter('yaml') }, t('Exporter YAML (Paprika)')),
    el('span', { class: 'muted', style: { fontSize: '.85rem' } }, t('Version et langue affichées ; inconnues omises.'))));
  // Ronde 1 : la largeur suivie au MONTAGE (suivreLargeur, plus haut), posé APRÈS le dernier await du rendu — le routeur insère la racine juste après.
  suivreLargeur(root, mq, () => { appliquerCorps(); }); // le panneau des autres gestes reste replié à toutes les largeurs (maquettes) : seule la bascule du corps suit la largeur
  return root;

  function titreRecetteAffichee(){return recipe.display_title||recipe.original_title||t('Sans titre');}
  function exporter(format){
    if(format==='jsonld')downloadBlob(new Blob([JSON.stringify(toJsonLd({recipe,version,book,edition},{documentaire:true}),null,2)],{type:'application/ld+json'}),`${slug(recipe.original_title)}.jsonld`);
    else downloadBlob(new Blob([toPaprikaYaml([{recipe,version,book,edition}],{documentaire:true})],{type:'text/yaml;charset=utf-8'}),`${slug(recipe.original_title)}.yml`);
    return{issue:'succes',id:recipe.id};
  }

  function setServings(n) { if (n < 1) return; state.servings = n; document.getElementById('servings-val').textContent = n; drawBody(); }

  function drawBody() {
    body.replaceChildren();
    const lienTM = root.querySelector('[data-role=adapter-thermomix]');
    if (lienTM) lienTM.href = lienAvecOrigine(`/recipes/${rid}/thermomix${buildQuery({ v: version.id, servings: state.servings ?? '' })}`,origine);
    const rappelTM = rappelThermomix(version); if (rappelTM) body.append(rappelTM);
    if (estThermomix(version)) {
      if (!gardeThermomix(version, state.servings).ok) body.append(el('div', { class: 'status warn', dataset: { role: 'thermomix-portions' } }, t(BLOCAGE_THERMOMIX), el('button', { class: 'btn small', onClick: () => { state.servings = version.servings ?? null; root.querySelector('#servings-val').textContent = state.servings ?? t('inconnues'); drawBody(); } }, t('Revenir aux quantités adaptées'))));
      body.append(el('details', { class: 'autres-gestes', dataset: { role: 'ouvrir-cookidoo' } },
        el('summary', null, t('Copier pour Cookidoo')), renderCopieCookidoo({ recipe, version, book, edition }, { ...deps, portions: state.servings })));
    }
    const scaled = scaleVersion(version, state.servings);
    const translation = state.lang !== 'original' ? ctx.recipe_translations.find((tr) => tr.recipe_version_id === version.id && tr.locale === state.lang) : null;
    const lectureTraduction = lireTraduction(translation, version);
    const contenuTraduction = lectureTraduction.etat === 'courante' ? lectureTraduction.contenu : null;
    const wantsTranslation = state.lang !== 'original' && state.lang !== recipe.original_language;
    const ctxQty = { system: state.units, locale: state.lang === 'original' ? (recipe.original_language || 'fr') : state.lang, convention_id: conventionId, readingLocale: state.lang, originalLocale: recipe.original_language || 'fr', showSource: true };
    const ingList = el('ul', { class: 'list plain coches' });
    scaled.ingredients.forEach((ri, i) => {
      const li = ingredientLineEl(ri, ctxQty, ctx.ingredientsById);
      // Fidélité aux maquettes : une case à cocher par ingrédient, pour suivre pendant qu'on prépare. Rien n'est écrit : l'état vit en mémoire
      // (COCHES, par fiche), survit aux redessins et aux passes, se perd au rechargement. Nommée par la ligne RENDUE (quantité ajustée), pas par
      // source_text ; l'étiquette de 44 px est la cible (revue du 28 octobre).
      const ligne = li.firstElementChild; const idLigne = `coche-${++numeroCoche}`; ligne.id = idLigne;
      const cles = cochesDe(recipe.id); const cle = ri.id || `#${i}`;
      const caseL = el('input', { type: 'checkbox', class: 'coche', 'aria-labelledby': idLigne, onChange: (e) => { if (e.target.checked) cles.add(cle); else cles.delete(cle); } });
      caseL.checked = cles.has(cle);
      li.prepend(el('label', { class: 'coche-cible' }, caseL));
      if (contenuTraduction) li.append(el('div', { class: 'muted', style: { fontSize: '.85rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, dataset: { role: 'traduction-ingredient' } },
        contenuTraduction.ingredients[i] ? `${t('Traduction')} : ${contenuTraduction.ingredients[i]}` : t('Traduction à compléter')));
      if (!lectureSeule) li.append(el('button', { class: 'btn link small remplacer', onClick: () => modifier(contexte => replaceIngredient(ri, contexte)) }, t('Remplacer')));
      ingList.append(li);
    });
    // § 3.3, C-6, C-9 : sur une création, ce que l'assistant a dit (préfixé « Selon l’assistant »), sa durée ESTIMÉE (jamais dans
    // timeText), et l'avertissement fixe — relus et rebornés par lireCreation (une ligne reçue peut porter n'importe quoi), en texte seul.
    const lc = lireCreation(version);
    if (lc) body.append(el('section', { class: 'card stack', dataset: { role: 'creation-ia' } },
      lc.description ? el('p', { dataset: { role: 'description-ia' } }, t('Selon l’assistant : {texte}', { texte: lc.description })) : null,
      lc.minutes ? el('div', { class: 'muted', dataset: { role: 'minutes-ia' } }, t('environ {m} min (estimé par l’assistant)', { m: lc.minutes })) : null,
      el('div', { class: 'status warn', dataset: { role: 'avertissement-ia' } }, t(AVERTISSEMENT_CREATION_IA))));
    const dietSel = select([{ value: '', label: t('Évaluer une restriction…') }, ...DIET_TAGS.map((d) => ({ value: d, label: label('diet', d) }))], state.diet, (v) => { state.diet = v; drawBody(); });
    const assessment = state.diet ? assessVersion(version, ctx.ingredientsById, state.diet) : null;
    // UI-1 (D-UI-6, D-UI-8) : Ingrédients et Préparation en sections `plain`, côte à côte dès 760 px (.two-col), en onglets au-dessous (segmented ;
    // la section non choisie cachée par hidden, les deux toujours dans le DOM). Le segmented est reconstruit à chaque drawBody ; le choix (state.onglet)
    // survit. La liste garde ingredientLineEl et « Remplacer » ; le select « Évaluer une restriction… » et timeText (« actif · total ») restent dans l'en-tête de la section.
    const ingredients = sectionPlain(`${t('Ingrédients')}${scaled.ok && scaled.factor !== 1 ? ` — ${t('recalculés pour {n} portions', { n: state.servings })}` : version.servings ? ` — ${t('{n} portions', { n: version.servings })}` : ''}`,
      el('div', { class: 'row between' }, el('span', { class: 'muted' }, timeText(version, recipe)), dietSel),
      assessment ? el('div', { style: { margin: '.4rem 0' } }, dietChip(assessment), assessment.unknown.length ? el('div', { class: 'muted', style: { fontSize: '.85rem' } }, `${t('Inconnus')} : ${assessment.unknown.join(', ')}`) : null) : null,
      wantsTranslation && !translation ? el('div', { class: 'status warn' }, t('Aucune traduction {l} pour cette version.', { l: state.lang.toUpperCase() }), lectureSeule ? null : el('a', { class: 'btn small', href: lienEdition('translation', version.id, state.lang) }, t('Traduire'))) : null,
      translation && !contenuTraduction ? el('div', { class: 'status warn' },
        t('Les correspondances de cette traduction sont à vérifier. Le texte original reste affiché.'),
        lectureSeule ? null : el('a', { class: 'btn small', href: lienEdition('translation', version.id, state.lang) }, t('Vérifier l’ancienne traduction')),
        textesTraductionConserves(translation.translated_content)) : null,
      contenuTraduction ? el('div', { class: 'row' }, el('span', { class: 'badge' }, t('Traduction')), el('span', { class: 'muted' }, contenuTraduction.title || '')) : null,
      ingList, ...scaled.notes.map((n) => el('small', { class: 'muted', style: { display: 'block' } }, n)),
      !conventionId && scaled.ingredients.some((i) => ['cup', 'tbsp', 'tsp', 'fl_oz'].includes(i.unit_id)) ? el('div', { class: 'status warn', style: { marginTop: '.5rem' } }, t('Tasses/cuillères : convention non confirmée pour cette édition — quantités d’origine affichées.'), edition ? el('a', { class: 'btn small', href: `#/books/${edition.id}` }, t('Préciser')) : null) : null);
    ingredients.dataset.role = 'section-ingredients';
    const steps = el('ol', { class: 'list steps' });
    (version.steps || []).forEach((s, i) => {
      const li = el('li', null, el('span', { class: 'step-num' }, String(i + 1)), el('div', { style: { flex: 1 } },
        el('div', { style: { whiteSpace: 'pre-line' }, dataset: { role: 'texte-etape' } }, s.text), // m10 : une étape lue entière garde ses sauts de ligne
        contenuTraduction ? el('div', { class: 'muted', style: { fontSize: '.9rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, dataset: { role: 'traduction-etape' } }, contenuTraduction.steps[i] || t('Traduction à compléter')) : null,
        ...(!lectureSeule && gardeThermomix(version, state.servings).ok ? s.timers || [] : []).slice(0, 2).map((tm) => timerBlock(tm.seconds, { seconds_max: tm.seconds_max, locale: ctx.settings?.ui_locale || 'fr', compact: true, onRequest: async (channel, seconds) => {const contexte=await capturerRecette(gestesLecture.repo, recipe, {ctx});return gestesLecture.repo.save('timer_launches', createTimerLaunch({ recipe_version_id: version.id, step_id: s.id, device_id: deviceId(), duration_seconds: seconds, channel }),{recettes:[contexte]});} }))));
      steps.append(li);
    });
    const preparation = sectionPlain(t('Préparation'), estThermomix(version) ? el('small', { class: 'muted' }, t('Durée proposée par l’assistant, à vérifier pendant la cuisson.')) : null, (version.steps || []).length ? steps : el('p', { class: 'muted' }, t('Étapes non numérisées.')), version.notes ? el('p', { class: 'muted' }, version.notes) : null);
    preparation.dataset.role = 'section-preparation';
    const onglets = segmented([{ value: 'ingredients', label: t('Ingrédients') }, { value: 'preparation', label: t('Préparation') }], state.onglet, (v) => { state.onglet = v; appliquerCorps(); });
    onglets.dataset.role = 'onglets-corps';
    onglets.classList.add('onglets');
    onglets.querySelectorAll('button').forEach((b, i) => { b.dataset.value = ['ingredients', 'preparation'][i]; }); // segmented() ne pose pas la valeur : le segment actif se retrouve par elle
    body.append(onglets, el('div', { class: 'two-col', dataset: { role: 'colonnes-corps' } }, ingredients, preparation));
    appliquerCorps();
    if (lc?.conseils.length) body.append(section(t('Conseils'), el('ul', { dataset: { role: 'conseils-ia' } }, ...lc.conseils.map((c) => el('li', null, t('Selon l’assistant : {texte}', { texte: c }))))));
    if (lc?.notes.length) body.append(section(t('À vérifier avant de servir'), el('ul', { dataset: { role: 'notes-ia' } }, ...lc.notes.map((n) => el('li', null, n)))));
  }

  // La bascule Ingrédients / Préparation (D-UI-6, F-5) : LOCALE — ni navigation, ni appel, ni redessin. En large : les deux sections visibles, le segmented
  // caché ; en étroit : la section non choisie cachée ([hidden]), le segment actif suit state.onglet. Appelée par drawBody, par la tape, par le change du matchMedia.
  function appliquerCorps() {
    const onglets = body.querySelector('[data-role="onglets-corps"]');
    if (!onglets) return;
    const etroit = !large();
    onglets.hidden = !etroit;
    for (const b of onglets.querySelectorAll('button')) b.classList.toggle('active', b.dataset.value === state.onglet);
    body.querySelector('[data-role="section-ingredients"]').hidden = etroit && state.onglet !== 'ingredients';
    body.querySelector('[data-role="section-preparation"]').hidden = etroit && state.onglet !== 'preparation';
  }

  async function modifier(travail) {
    try { const contexte = await capturerRecette(gestesLecture.repo, recipe, {ctx}); await travail(contexte);return{issue:'succes',id:recipe.id}; }
    catch(e) { dire(texteErreurAction(e?.code,t('Modifier')));return{issue:'refuse',id:recipe.id,raison:e?.code||'ecriture_refusee'}; }
  }

  async function startCooking() {
    if (!gardeThermomix(version, state.servings).ok) { dire(t(BLOCAGE_THERMOMIX)); return; }
    const session = { id: repo.newId('cs'), recipe_id: recipe.id, meal_id: null, selected_version_ids: [version.id], servings: state.servings, progress: { current_step_id: version.steps?.[0]?.id || null, done_step_ids: [], total_steps: (version.steps || []).length }, started_at: repo.nowIso(), active_device_id: deviceId(), status: 'active', units: state.units, lang: state.lang };
    try { const contexte = await capturerRecette(gestesLecture.repo, recipe, {ctx}); await enregistrerSessionCuisine(session, { repo: gestesLecture.repo, recettes:[contexte] }); naviguer(`/cook/${session.id}`); }
    catch { dire(t(TEXTE_NOUVEL_USAGE_REFUSE)); }
  }

  async function makeList() {
    const list = { id: repo.newId('sl'), title: `${recipe.display_title || recipe.original_title}`, items: [{ recipe_id: recipe.id, recipe_version_id: version.id, servings: state.servings, title: recipe.display_title || recipe.original_title }], checked: {} };
    return modifier(async contexte => { await gestesLecture.repo.save('shopping_lists', list, {recettes:[contexte]}); navigate(`/lists/${list.id}`); });
  }

  async function attachDish(contexte) {
    const captures=await capturerSelectionRecettes([recipe],ctx,{repo:gestesLecture.repo});
    const options = [...ctx.dishes].sort((a, b) => a.labels.fr.label.localeCompare(b.labels.fr.label)).map((d) => ({ value: d.id, label: d.labels.fr.label }));
    options.push({ value: '__new__', label: t('+ Nouveau plat…') });
    let dishId = await chooseDialog(t('Rattacher cette recette à quel plat ?'), options);
    if (!dishId) return;
    let nouveauPlat = null;
    if (dishId === '__new__') {
      const fr = await promptDialog(t('Nom du plat (français)'), { value: recipe.original_title });
      if (!fr) return;
      const d = { id: repo.newId('dish'), labels: { fr: { label: fr.trim(), aliases: [] }, en: { label: fr.trim(), aliases: [] } } };
      nouveauPlat = d; dishId = d.id;
    }
    const existing = links.find((l) => l.dish_id === dishId);
    if(!nouveauPlat){const result=(await executerSelectionRecettes(captures,{action:'rattacher',platId:dishId},{repo:gestesLecture.repo}))[0];if(result.issue!=='succes'){const e=new Error(result.raison);e.code=result.raison;throw e;}}
    else await gestesLecture.repo.saveBatch({dishes:[nouveauPlat],dish_recipe_links:[{ id: repo.newId('drl'), dish_id: dishId, recipe_id: recipe.id, state: 'confirmed', proposed_by: 'user', evidence: t('Rattachement manuel'), reviewed_at: repo.nowIso() }]}, {recettes:[contexte],conditions:{dishes:[{key:dishId,absente:true}]}});
    toast(t('Recette rattachée au plat')); refresh();
  }

  // Remplacer un ingrédient dans son contexte (spec §29.3) : nouvelle version attribuée, original préservé, effets décrits.
  async function replaceIngredient(ri, contexte) {
    const options = [...ctx.ingredients].sort((a, b) => a.labels.fr.label.localeCompare(b.labels.fr.label)).map((i) => ({ value: i.id, label: `${i.labels.fr.label}${i.labels.en?.label && i.labels.en.label !== i.labels.fr.label ? ` / ${i.labels.en.label}` : ''}` }));
    options.unshift({ value: '__text__', label: t('Autre (texte libre)…') });
    const choice = await chooseDialog(t('Remplacer « {s} » par :', { s: ri.name_text || ri.source_text }), options);
    if (!choice) return;
    let newId = null, newLabel = '';
    if (choice === '__text__') { newLabel = await promptDialog(t('Ingrédient de remplacement')); if (!newLabel) return; }
    else { newId = choice; newLabel = ctx.ingredientsById.get(choice).labels[recipe.original_language || 'fr']?.label || ctx.ingredientsById.get(choice).labels.fr.label; }
    const effects = await promptDialog(t('Effets attendus (goût, texture, méthode, durée) et raison du remplacement'), { multiline: true, placeholder: t('Je n’en ai pas ; texture un peu plus ferme ; même cuisson.') });
    if (effects === null) return;
    if (!(await confirmDialog(t('Créer « Ma version » avec ce remplacement ? L’original reste inchangé.'), { okLabel: t('Accepter') }))) return;
    const newVersion = {
      ...structuredClone(version), id: repo.newId('rv'), kind: 'adaptation', parent_version_id: version.id, status: 'proposed', created_at: undefined, updated_at: undefined,
      changes: t('Remplacement : {a} → {b}. {e}', { a: ri.name_text || ri.source_text, b: newLabel, e: effects || '' }).trim(),
      provenance: { ...(version.provenance || {}), generated_by: 'manual', derived_from: version.id, substitution: true, ...(estThermomix(version) ? { thermomix_invalide: true } : {}) },
    };
    newVersion.ingredients = version.ingredients.map((x) => x.id === ri.id || x.source_text === ri.source_text ? { ...x, id: repo.newId('ri'), ingredient_id: newId, name_text: newLabel, source_text: `${newLabel} (${t('remplace')} : ${x.source_text})`, verification_state: 'verified', substituted_from: x.source_text } : x);
    const sub = { id: repo.newId('sub'), recipe_version_id: newVersion.id, parent_version_id: version.id, ingredient_id: ri.ingredient_id || null, replacement_ingredient_id: newId, replacement_text: newLabel, role: ri.preparation || null, effects: effects || '', state: 'accepted', created_at: repo.nowIso() };
    await gestesLecture.repo.saveBatch({ recipe_versions: [newVersion], substitutions: [sub] }, {recettes:[contexte]});
    toast(t('Ma version créée ; contraintes et courses à réévaluer sur cette version.'));
    navigate(`/recipes/${rid}${buildQuery({ v: newVersion.id })}`);
  }

  async function referenceOnly() {
    // Un signet web n'est pas une référence d'index : il n'y a pas de page de livre à ouvrir, il y a un lien (F8).
    if (recipe.source_url) return el('div', null, blocSignet(recipe, ctx, { lire: lireWeb, connecter: connecterWeb, moi: gestesLecture.repo.deviceId?.() ?? null }));
    // Lot G (§ 4.4) : les pages d'index par vignettePage, avec « Télécharger les {n} pages » quand ≥ 2 manquent (la branche signet ci-dessus rend avant).
    const vignettes = pages.length ? await vignettesDePages(pages, ctxF) : null;
    const sectionLue = sectionLisible(recipe.section); // lot C (D-C6) : nettoyée et bornée, sinon null (ronde 1)
    return el('div', null,
      el('div', { class: 'card warn stack' },
        el('h2', null, recipe.printed_page ? t('Repérée dans ton livre — page {p}', { p: recipe.printed_page }) : t('Repérée dans l’index de ton livre')),
        sectionLue ? el('p', { class: 'muted' }, t('Section : {s}', { s: sectionLue })) : null,
        el('p', null, t('Cette référence vient de l’index : ingrédients, durées et compatibilités alimentaires sont inconnus tant que la recette n’est pas numérisée. Ouvre le livre à cette page pour cuisiner, ou scanne la recette.')),
        el('div', { class: 'row' },
          // D-8 : la voie « Scanner cette recette » (Ajouter + clé de session) est remplacée par l'écran d'import ciblé, déjà rattaché à la référence.
          el('a', { class: 'btn primary', href: `#/recipes/${encodeURIComponent(recipe.id)}/importer` }, t('Importer cette recette')),
          el('a', { class: 'btn', href: lienEdition('extraction') }, t('Saisir à la main')),
          dish ? el('a', { class: 'btn', href: `#/dishes/${dish.id}` }, t('Autres recettes de ce plat')) : el('button', { class: 'btn', onClick: () => modifier(attachDish) }, t('Rattacher à un plat')))),
      vignettes ? section(t('Pages d’index'), boutonTelechargerPages(vignettes.distantes, { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
        el('div', { class: 'thumbs' }, ...pages.map((p) => el('figure', null, vignettes.places.get(p.id))))) : null);
  }
}

// Signet web (spec § 11 ; lot B § 4.1 a) : revalidé AU RENDU — une fiche venue d'une archive peut porter n'importe quoi (S6) ; l'hôte affiché
// vient de l'adresse, jamais de source_label (S7). Aucun geste de scan (F8). Selon l'import web OUVERT de la fiche (au plus un, I-2) : « Lire la
// recette avec l’assistant » (aucun, ou a_lancer), « Voir » (en_cours), « Vérifier et enregistrer » (a_verifier), « Réessayer » (echec, avec la
// phrase du cas). Synchrone (F-9) : la carte « Connecte-toi » est rendue CACHÉE et le bouton de lecture ÉTEINT — basculerSessionSignet les règle
// une fois la session lue. Une adresse en http: n'a aucun bouton de lecture (B-20). « Voir la page d’origine » (lien texte, D-UI-10) est toujours là, http: compris. Ronde 1 : `web_reperes` est
// RELU au rendu par reperesDe (ficheDe : présentation bornée au mot à 400, écartée si elle porte une adresse, Cc/Cf retirés ; repères typés) — une
// fiche reçue ou restaurée peut porter n'importe quoi ; la ligne ouverte est choisie par ligneWebOuverte (import-web.js : la même règle que l'écran,
// R-B-18 et R-B-20 ; `moi` = l'appareil d'ici).
export function blocSignet(recipe, ctx = null, { lire = null, connecter = () => {}, moi = null } = {}) {
  const lien = lienSignet(recipe.source_url);
  const bloc = el('div', { class: 'card warn stack', dataset: { role: 'bloc-signet' } }, el('h2', null, t('Lien web gardé.')));
  if (!lien.ok) { bloc.append(el('p', { class: 'muted' }, t('Adresse non reconnue : '), adresseInerte(recipe.source_url))); return bloc; }
  const id = encodeURIComponent(recipe.id);
  const ouvrir = () => lienOrigine(lien); // D-UI-10 (I-B5) : « Voir la page d’origine », lien texte — le même sur la fiche et l'écran d'import web
  const hote = el('span', { class: 'muted' }, lien.hote);
  const reperes = reperesDe(recipe.web_reperes);
  const presentation = reperes?.presentation ?? null;
  const ligneR = reperes ? ligneReperes(reperes) : '';
  const extraits = [presentation ? el('p', { dataset: { role: 'presentation-web' } }, t('Lors de la recherche, l’assistant disait : {p}', { p: presentation })) : null,
    ligneR ? el('p', { class: 'muted', dataset: { role: 'reperes-web' } }, t('Estimé par l’assistant : {r}', { r: ligneR })) : null].filter(Boolean);
  if (!lien.href.startsWith('https:')) {
    bloc.append(el('p', null, t('L’app n’a pas encore lu la page.')), el('div', { class: 'row' }, ouvrir(), hote),
      el('div', { class: 'status warn', dataset: { role: 'interdit' } }, texteEchecLecture({ raison: 'interdit' }).texte), ...extraits);
    return bloc;
  }
  // R-B-18 : « ouvert » = importOuvert (une définition, jamais la négation des statuts terminés : une ligne reçue au statut inconnu ou nul ne compte
  // pas) — par ouverteWeb d'import-web.js : importOuvert(i) && kind 'web' && même recipe_id, sans substitution de sorte depuis la tâche 6.
  const ligne = ligneWebOuverte(ctx?.imports, recipe.id, { moi });
  const statut = ligne?.status ?? null;
  const carte = carteConnexion(connecter, ctx); carte.hidden = true; carte.dataset.bascule = 'carte';
  const boutonLire = (libelle, classe) => el('button', { type: 'button', class: classe, disabled: true, dataset: { role: 'lire-web', bascule: 'bouton' }, onClick: () => lire?.() }, libelle);
  if (statut === 'en_cours') bloc.append(el('p', null, t('Lecture de la page en cours…')), el('div', { class: 'row' }, el('a', { class: 'btn', href: `#/recipes/${id}/importer` }, t('Voir')), ouvrir(), hote));
  else if (statut === 'a_verifier') bloc.append(el('p', null, t('Lecture reçue : vérifie-la et enregistre.')), el('div', { class: 'row' }, el('a', { class: 'btn primary', href: `#/recipes/${id}/importer` }, t('Vérifier et enregistrer')), ouvrir(), hote));
  else if (statut === 'echec') bloc.append(el('p', null, t('Contenu non récupéré : ouvre la page.')), el('div', { class: 'row' }, ouvrir(), boutonLire(t('Réessayer'), 'btn'), hote),
    el('small', { class: 'muted', dataset: { role: 'raison' } }, texteEchecLecture(ligne.erreur).texte), carte, el('div', { dataset: { bascule: 'hors-ligne' } }));
  else bloc.append(el('p', null, t('L’app n’a pas encore lu la page.')), el('div', { class: 'row' }, boutonLire(t('Lire la recette avec l’assistant'), 'btn primary'), ouvrir(), hote),
    el('small', { class: 'muted' }, t('Une lecture = un appel à l’assistant, compté dans ton quota du jour.')), carte, el('div', { dataset: { bascule: 'hors-ligne' } }));
  bloc.append(...extraits);
  return bloc;
}
// La bascule de F-9 : session → bouton allumé (si en ligne), carte cachée ; sans session → carte montrée, bouton éteint ; hors ligne → bouton
// éteint et « Tu es hors ligne. ».
export function basculerSessionSignet(racine, session, enLigne = true) {
  const bouton = racine.querySelector('[data-bascule="bouton"]');
  const carte = racine.querySelector('[data-bascule="carte"]');
  const zone = racine.querySelector('[data-bascule="hors-ligne"]');
  if (bouton) bouton.disabled = !session || !enLigne;
  if (carte) carte.hidden = !!session;
  if (zone) zone.replaceChildren(...(enLigne ? [] : [el('div', { class: 'status warn' }, t('Tu es hors ligne.'))]));
}

// La source d'une version lue sur le web (lot B § 4.5, I-B5, S-2, B-25) : lue dans la PROVENANCE de CETTE version, jamais dans les champs
// source_* de la fiche ; l'hôte recalculé d'abord, le site et l'auteur déclarés ensuite, étiquetés « Selon la page ». null hors lecture web.
// Ronde 1 (I-B2, S-2) : la provenance d'une version reçue ou restaurée est RELUE au rendu par la règle de la page (lirePage : hôte recalculé, site et
// auteur bornés à 200, Cc/Cf retirés, mis à null s'ils portent une adresse ; une date qui n'est pas la forme ISO du serveur → null) ; sans date
// lisible, la phrase la tait (« Lue sur {h} · {m} — vérifie. », jamais un « le » orphelin).
function bandeauWeb(version) {
  const p = version?.provenance;
  if (!p || typeof p.source_url !== 'string' || !p.source_url) return null;
  const { page } = lirePage({ page: { url_finale: p.url_finale ?? p.source_url, site: p.site, auteur: p.auteur, lue_le: p.lue_le } });
  if (!page.hote) return null;
  const mode = p.source_kind === 'jsonld' ? t('données de la page') : t('texte lu par l’assistant');
  const declares = [page.site, page.auteur].filter(Boolean).join(' · ');
  return el('div', { class: 'stack', style: { marginBottom: '.8rem' }, dataset: { role: 'bandeau-web' } },
    el('div', { class: 'status' }, page.lue_le ? t('Lue sur {h} le {d} · {m} — vérifie.', { h: page.hote, d: formatDate(page.lue_le), m: mode }) : t('Lue sur {h} · {m} — vérifie.', { h: page.hote, m: mode })),
    declares ? el('div', { class: 'muted', dataset: { role: 'selon-la-page' } }, t('Selon la page : {s}', { s: declares })) : null);
}

// État de vérification de la VERSION AFFICHÉE (spec § 4.3.6 ; I3 de la revue : jamais celui de la fiche) : « Vérifiée », ou le nombre de lignes à vérifier.
function etatVerification(version) {
  if (version?.verification_state === 'verified') return el('span', { class: 'chip ok', dataset: { role: 'etat-verification' } }, t('Vérifiée'));
  const n = (version?.ingredients || []).filter((l) => l?.verification_state !== 'verified').length;
  return el('span', { class: 'chip warn', dataset: { role: 'etat-verification' } }, n === 0 ? t('À vérifier') : n === 1 ? t('1 ligne à vérifier') : t('{n} lignes à vérifier', { n }));
}

// Bandeau « Lue par l'assistant le {d} · … » : les parties présentes seulement, jointes par « · » ; « Incertain : … » (texte du modèle, borné par
// banniereLecture) dessous, en nœud texte. `.status` est en inline-flex : posé en colonne pour ses deux lignes.
function bandeauLecture(lecture) {
  // Une date illisible (ligne reçue ou restaurée mal formée) n'est pas dite : jamais « le » suivi de rien (ronde 1).
  const parts = [lecture.date ? t('Lue par l’assistant le {d}', { d: formatDate(lecture.date) }) : t('Lue par l’assistant')];
  if (lecture.incertaines > 0) parts.push(t('{n} ligne(s) incertaine(s)', { n: lecture.incertaines }));
  if (lecture.missing_page) parts.push(t('page possiblement manquante'));
  if (lecture.incomplete) parts.push(t('lecture incomplète'));
  return el('div', { class: 'status warn', dataset: { role: 'bandeau-lecture' }, style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '.2rem', marginBottom: '.8rem' } },
    el('div', { dataset: { role: 'ligne-lecture' } }, parts.join(' · ')),
    lecture.incertain ? el('div', { dataset: { role: 'incertain-lecture' }, style: { fontSize: '.9rem' } }, t('Incertain : {t}', { t: lecture.incertain })) : null);
}

function slug(s) { return (s || 'recette').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }

export { recipeCard };
