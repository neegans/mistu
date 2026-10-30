// Fiche d'un livre (édition possédée) : en-tête (titre, sous-titre, deux menus d'ajout), couverture et sommaire à gauche, les recettes à droite, pages sources en bas.
import { renderListeBibliotheque, texteCompteurs } from './bibliotheque-liste.js';
import { renderLivreEditeur } from './livre-editeur.js';
import { projeterBibliotheque } from '../domain/bibliotheque.js';
import { actionsLivre, boutonsActions, menuActions } from './actions-contenu.js';
import { lireContexteListe, porteeNavigation, retourConnu, memoriserListe, capturerVue, restaurerVue } from './navigation-contexte.js';
import { el, toast, pickFiles, confirmDialog, promptDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, refresh, remplacerAdresse } from '../core/router.js';
import * as repo from '../model/repo.js';
import { etatFichier } from '../sync/fichiers.js';
import { typeAffichage, displayUrl } from '../sync/mime.js';
import { listConventions } from '../domain/units.js';
import { pageHeader, section, sectionPlain, field, select, availabilityBadge, emptyState, bookCover, contexteFichiers, vignettesDePages, boutonTelechargerPages, relireErreurs, texteErreurFichier, remplacerEnRevoquant, suivreLargeurAuMontage, pageAffichable } from './components.js';
import { invalidate } from './state.js';
import { urlDeBlob, revoquerUrlDeBlob } from '../core/blob-urls.js';
import { estAImporter, aUneAdresse } from './library.js';
import { poserCouverture, renderZoneCouverture, messageErreurImage } from './livre-ajout.js';
import { startScanSession } from './import.js';
import { saisieIndexManuelle } from './index-livre.js';
import { plagesLisibles, textePlages } from '../domain/index-livre.js';
import { accueilLivreModel, renderAccueilLivre } from './accueil-livre.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes, motsClesExistants } from './puces.js';
import { tagsDe } from '../domain/search.js';
import { sectionLisible } from '../domain/llm.js';
import { seanceDUnImportCible, importOuvert } from '../domain/import-cible.js';
import { ligneOuverteDeSeance } from '../domain/table-matieres.js';
import { pointeurValide } from '../domain/photo-web.js';
import { ACCEPT_PHOTOS, ACCEPT_FICHIERS } from './add.js';
import { STATUTS_IMPORT } from '../model/schema.js';
import { TransitionRefusee } from '../core/db.js';
import { photosPersonnellesParRecette, photoPrincipale } from '../domain/cuisine-personnelle.js';
import { empreintesPhotos, fichierPhoto } from './components.js';
import { renderSourcesLivre } from './livre-sans-saisie.js';
import { currentVersion } from '../domain/search.js';
import { photoVisible } from './photos-visibles.js';
import { resumeReperes, lienGestionPhoto } from './reperes-affichage.js';
import { shaLivre } from '../domain/livre-bibliographie.js';
import { lireCycleEdition, recetteActiveEffective } from '../domain/cycle-edition.js';
import { panneauCycleLivre, mentionCycleRecette } from './corbeille.js';
import { capturerEdition } from './recette-garde.js';

// C8 : la plus RÉCENTE d'abord. La fiche ne rappelle qu'UNE séance et « Reprendre » doit mener à celle qu'on vient
// de laisser, pas à la plus vieille restée ouverte (l'ordre de la base est celui des clés, pas du temps).
// Import ciblé (spec import-cible § 4.1, N3) : la séance d'un import CIBLÉ non terminé n'est pas rappelée ici — elle se reprend par la section
// « Imports » d'Ajouter ; elle revient après ignore. Les séances de « Regrouper en recette » et du panneau d'index restent rappelées.
export const seancesOuvertes = (ctx, editionId) => (ctx.scan_sessions || [])
  .filter((s) => s.status === 'open' && s.edition_id === editionId && !seanceDUnImportCible(s, ctx.imports))
  .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));

// « Ajouter des pages de sommaire » / « Ajouter des recettes » : un <details> dont le résumé est le bouton, les sources dessous (spec UX § 9 ; textes D-UI-10).
function menuSource(libelle, ...boutons) {
  return el('details', { class: 'menu-source' }, el('summary', { class: 'btn primary' }, libelle), el('div', { class: 'row', style: { marginTop: '.5rem' } }, ...boutons));
}

// Ancien C09 : aucun appel hérité ne peut effacer ou détacher les sources.
export async function supprimerLivreVide() {
  return { refus: 'corbeille_requise' };
}

// D-UI-7 : sous 900 px, la liste des recettes montre LIGNES_REPLIEES lignes puis « Voir les {n} recettes », qui déplie sur place (aucune navigation) ; la même
// borne que .two-col.livre (styles.css), lue par un matchMedia INJECTABLE (deps.matchMedia, le motif de la fiche recette) et réécoutée sur `change`.
export const LIGNES_REPLIEES = 8;
export const LARGEUR_DEUX_COLONNES = '(min-width: 900px)';

// D-UI-7, D-UI-10, I-UI-5 : une ligne de la liste compacte des recettes d'un livre. La vignette (D-F9 tenu) se décide AU RENDU, de façon synchrone, sur la ligne
// `files` que l'appelant a lue en une fois (repo.getFiles, comme les couvertures de la bibliothèque) : octets ICI et d'un type d'image (typeAffichage, la règle du
// lot G, displayUrl par urlDeBlob pour la révocation D-T9) → img.plat-vignette.petite, décorative (alt vide : le titre est à côté) ; sinon rien — jamais un cadre
// vide, jamais une lecture en base depuis la ligne. T4-R1 : des octets admis que le navigateur ne décode pas (HEIC hors Safari, octets tronqués) lèvent error —
// l'img est retirée et son URL révoquée (le motif de vignettePlat et de la carte-plat, I-F6). Le titre serif est le lien de la fiche (« Sans titre » à défaut,
// comme library.js : jamais un lien vide) ; « p. N » seulement avec une page affichable (pageAffichable, la règle du badge : un entier de 1 à 9999 — vague
// finale) ; la section lue dans la table des matières (lot C, sectionLisible : une fiche reçue ou restaurée peut porter autre chose qu'une chaîne) pour une
// référence seulement ; le badge est celui d'availabilityBadge (UNE définition des textes, D-UI-10), COURT : sans la page, déjà dite à côté du titre (§ 4.3,
// vague finale — le motif de l'en-tête de l'import ciblé) ; « Importer » et « Saisir à la main » sur une référence ou une partielle SANS adresse (aUneAdresse de library.js, la définition de l'onglet
// « À importer » ; mêmes href qu'au lot A, T4-R1 : un signet devenu partiel n'a pas d'entrée), hors du <a> du titre (jamais un lien dans un lien, m4).
export function ligneCompacte(r, { fichier = null, version = null, photo = null, ctxF = {}, edition = null } = {}) {
  const sha = photo?.sha256 ?? r.photo_sha256;
  const vignette = photoVisible(sha, { fichier, ctxF, classe: 'recette-miniature', personnelle: !!photo?.personnelle });
  const active = recetteActiveEffective(r,edition);
  const importable = active && (r.availability === 'reference_only' || r.availability === 'partial') && !aUneAdresse(r);
  const sectionLue = r.availability === 'reference_only' && !aUneAdresse(r) ? sectionLisible(r.section) : null;
  const id = encodeURIComponent(r.id);
  return el('li', { class: 'recette-ligne', dataset: { recette: r.id } },
    el('div', { class: 'recette-ligne-entete' }, vignette,
      el('div', { class: 'recette-ligne-texte' },
        el('a', { class: 'titre', href: `#/recipes/${id}` }, r.display_title || r.original_title || t('Sans titre')),
        r.original_title && r.display_title && r.display_title !== r.original_title ? el('small', { class: 'muted' }, t('Titre original : {titre}', { titre: r.original_title })) : null,
        el('div', { class: 'row' },
          plagesLisibles(r).length ? el('span', { class: 'muted', dataset: { role: 'pages' } }, `${t('p.')} ${textePlages(plagesLisibles(r))}`) : null,
          sectionLue ? el('span', { class: 'chip neutral', dataset: { role: 'section' } }, sectionLue) : null))),
    resumeReperes(r, version),
    el('div', { class: 'row recette-ligne-actions', dataset: { role: 'etat-recette' } },
      availabilityBadge({ ...r, printed_page: null }),
      importable ? el('a', { class: 'btn small', href: `#/recipes/${id}/importer` }, r.availability === 'partial' ? t('Compléter') : t('Importer')) : null,
      importable ? el('a', { class: 'btn small', href: `#/recipes/${id}/edit?kind=extraction` }, t('Saisir à la main')) : null,
      active ? lienGestionPhoto(r, { connue: !!sha }) : null,
      r.favorite ? el('span', { class: 'badge' }, '★ ' + t('Favori')) : null), mentionCycleRecette(r,edition));
}

async function livreConserve(edition,book,ctx,deps){
  const root=el('div',{class:'fiche-livre'},pageHeader(book.title,{back:{href:'/library?tab=books',label:t('Bibliothèque')}}));
  root.append(await panneauCycleLivre(edition,ctx,deps));
  const ctxF=await contexteFichiers(ctx),fichier=edition.cover_sha256?await repo.getFile(edition.cover_sha256):null;
  const gauche=el('div',{class:'stack'},bookCover(edition,book,{fichier,ctxF})),droite=el('div');
  root.append(el('div',{class:'two-col livre'},gauche,droite));
  const rs=ctx.recipes.filter(r=>r.edition_id===edition.id),photos=photosPersonnellesParRecette(ctx.cook_history),fichiers=await repo.getFiles(empreintesPhotos(rs,photos));
  droite.append(sectionPlain(t('Recettes'),rs.length?el('ul',{class:'liste-compacte'},...rs.map(r=>ligneCompacte(r,{edition,ctxF,version:currentVersion(r,ctx.versionsByRecipe?.get(r.id)||[]),photo:photoPrincipale(r,photos),fichier:fichierPhoto(r,photos,fichiers)}))):el('p',null,t('Aucune recette liée à ce livre.'))));
  const pages=ctx.source_pages.filter(p=>p.edition_id===edition.id);
  if(pages.length){const v=await vignettesDePages(pages,ctxF);root.append(sectionPlain(t('Pages et fichiers sources'),boutonTelechargerPages(v.distantes,{connecte:ctxF.connecte,telecharger:v.telecharger}),el('div',{class:'thumbs'},...pages.map(p=>el('figure',null,v.places.get(p.id),el('figcaption',null,p.printed_page?`${t('p.')} ${p.printed_page}`:t('page non numérotée')))))));}
  const documents=ctx.source_documents.filter(d=>d.edition_id===edition.id);
  if(documents.length)root.append(sectionPlain(t('Documents conservés'),el('ul',{class:'list'},...documents.map(d=>el('li',null,d.original_filename||t('Document'))))));
  return root;
}

// L'ordre du Sommaire (D-UI-7, T4-R1) : « l'ordre se corrige dans le panneau de la séance, pas ici » — la position APPLIQUÉE dans la séance (un entier) d'abord,
// puis le numéro imprimé ; une page sans l'un ni l'autre vient en dernier, dans l'ordre reçu (tri stable). Les autres pages : le numéro imprimé seul (inchangé).
// Vague finale (R-UI-23 complété) : `position` est numérotée PAR SÉANCE (repo.ajouterPages : une séance neuve repart à 1) — deux séances d'index (une page
// oubliée, photographiée plus tard) s'entrelaçaient. Les pages se rangent donc d'abord par SÉANCE, la plus ancienne d'abord : le début de la séance de leur
// document (started_at), sinon la capture du document (captured_at : séance absente du contexte, fiche reçue) ; sans moment lisible, après les autres ; à
// moment égal, une séance à la fois (par sa clé) ; puis la position, puis le numéro imprimé. Champs lus comme des chaînes seulement (une fiche reçue peut porter
// autre chose) ; aucune lecture en base.
const rangPosition = (p) => (Number.isInteger(p?.position) ? p.position : Infinity);
const parPositionPuisPage = (a, b) => (rangPosition(a) - rangPosition(b)) || ((a.printed_page ?? 9999) - (b.printed_page ?? 9999));
const chaine = (v) => (typeof v === 'string' ? v : '');
const parSeancePuisPosition = (ctx) => {
  const documents = new Map((ctx.source_documents || []).filter((d) => typeof d?.id === 'string').map((d) => [d.id, d]));
  const seances = new Map((ctx.scan_sessions || []).filter((s) => typeof s?.id === 'string').map((s) => [s.id, s]));
  const seanceDe = (p) => { const d = documents.get(p?.document_id); const cle = chaine(d?.scan_session_id); return { cle, quand: chaine(seances.get(cle)?.started_at) || chaine(d?.captured_at) }; };
  return (a, b) => {
    const [x, y] = [seanceDe(a), seanceDe(b)];
    if (x.quand !== y.quand) return !x.quand ? 1 : !y.quand ? -1 : x.quand < y.quand ? -1 : 1;
    if (x.cle !== y.cle) return x.cle < y.cle ? -1 : 1;
    return parPositionPuisPage(a, b);
  };
};

export async function renderBook(params, query, ctx, deps = {}) {
  const edition = ctx.editionsById.get(params.id);
  if (!edition) return query.draft ? renderLivreEditeur({edition:null,book:null,ctx,query,deps}) : el('div', { class: 'card' }, t('Livre introuvable.'));
  const book = ctx.booksById.get(edition.book_id) || { title: t('Sans titre') };
  if(lireCycleEdition(edition).etat!=='active'){
    const conserve=await livreConserve(edition,book,ctx,deps);
    if(query.draft){const editeur=await renderLivreEditeur({book,edition,ctx,query,deps});conserve.append(editeur);conserve.dispose=()=>editeur.dispose?.();}
    return conserve;
  }
  // R-UX-10 : un seul fait (« on arrive après création »), donc une seule condition — le MODÈLE décide, et la même
  // décision sert à poser le panneau plus bas. S16 : une arrivée après création n'est pas une ouverture volontaire.
  const accueil = accueilLivreModel({ nouveau: query.nouveau });
  if (!accueil.afficher) await repo.recordActivity(edition.id, 'open_book');
  const recipes = ctx.recipes.filter((r) => r.edition_id === edition.id);
  const docs = ctx.source_documents.filter((d) => d.edition_id === edition.id);
  const pages = ctx.source_pages.filter((p) => p.edition_id === edition.id);
  const pref = ctx.rediscovery_prefs.find((p) => p.edition_id === edition.id);
  // Une empreinte de couverture sans ligne files est un état NORMAL (fiche reçue d'un autre appareil, octets en L4) :
  // ici ça se dit, parce que la personne peut agir ; dans la grille de Mes livres, la vignette reste muette (§ 6).
  const fichierCouverture = edition.cover_sha256 ? await repo.getFile(edition.cover_sha256) : null;
  // Lot G (§ 4.2) : l'état de la couverture dit ce que la personne peut faire — télécharger (distante, compte), se connecter, ou attendre l'appareil
  // qui l'a prise. Sans ligne files du tout (pointeur arrivé avant sa ligne), le texte d'avant (tests/ajouter.js « un pointeur sans ligne files le DIT »).
  const ctxF = await contexteFichiers(ctx);
  const decrireCouverture = (fichier) => {
    const rien = { message: null, telechargeable: false, reessayable: false };
    if (!edition.cover_sha256 || fichier?.blob instanceof Blob) return rien;
    if (!fichier) return { ...rien, message: t('La couverture n’est pas sur cet appareil.') };
    const etat = etatFichier(fichier, ctxF);
    // Ronde 1 : la phrase du motif (un 404 n'est pas « illisible reçu ») ; « Réessayer » avec un compte ET le moteur (sans compte, la tape effaçait
    // le diagnostic sans rien retenter, R52 ; sans moteur, elle ne pouvait rien).
    if (etat === 'erreur') return { ...rien, message: texteErreurFichier(edition.cover_sha256, ctxF.erreurs), reessayable: ctxF.connecte };
    if (etat === 'distant') return ctxF.connecte ? { ...rien, message: t('La couverture n’est pas sur cet appareil.'), telechargeable: true } : { ...rien, message: t('La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.') };
    return { ...rien, message: t('La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.') };
  };
  // D-UI-7 : la largeur décide de la liste repliée (LIGNES_REPLIEES sous 900 px) ; injectable, jamais window.matchMedia nu (appel sans this : « Illegal invocation »).
  const matchMedia = deps.matchMedia || ((q) => window.matchMedia(q));
  const large = matchMedia(LARGEUR_DEUX_COLONNES);
  const root = el('div', { class: 'fiche-livre' });
  const route=`/books/${encodeURIComponent(edition.id)}`,portee=porteeNavigation(ctx);
  const etat=lireContexteListe({route,query,portee}),origine={cleEntree:etat.cleEntree};
  const actions=actionsLivre({edition,ctx,origine},deps);
  // I-F : un scan parti d'ici porte le livre ET l'intention (index ou recette) ; le menu ne décide que de la SOURCE.
  const lancer = (intention) => async (accept, capture) => {
    try {
      const contexteEdition=await capturerEdition(repo,edition,{ctx});
      const f = await pickFiles({ accept, multiple: true, capture });
      if (f.length) await startScanSession(f, { edition_id: edition.id, intention, contexteEdition, ctx });
    }catch{toast(t('Le livre a changé. Rouvre sa fiche avant d’ajouter des pages.'));}
  };
  // D-UI-7, H-21 : le sous-titre dit l'auteur, l'éditeur et l'année — ce qui est connu, dans cet ordre ; l'ISBN et la langue restent dans « Métadonnées et
  // convention ». Les deux menus d'ajout restent les ACTIONS de l'en-tête (markup inchangé, textes D-UI-10) ; le titre de fiche porte classeTitre (D-UI-3).
  // R-UI-11 tranché (vague finale) : les retours propres à un livre (« ← Bibliothèque », « Plus tard », après la suppression) mènent au segment Livres, d'où
  // vient la fiche et où un livre neuf se voit ; #/library (Recettes) reste celui de la NAV et de la fiche recette.
  root.append(pageHeader(book.title, {
    subtitle: [book.author, edition.publisher, edition.year].filter(Boolean).join(' · '),
    back: { href: retourConnu({query,portee,repli:'/library?tab=books'}).href, label: t('Bibliothèque') },
    classeTitre: 'titre-fiche',
    actions:[boutonsActions(actions,['modifier-livre','ajouter-index','ajouter-recette']),menuActions(actions,{titre:book.title})],
  }));
  if(['index','recette'].includes(query.panel)){
    const intention=query.panel;
    root.append(el('section',{class:'card stack',dataset:{role:'ajout-livre'}},el('h2',null,intention==='index'?t('Ajouter des pages d’index'):t('Ajouter une recette')),
      el('div',{class:'row'},el('button',{type:'button',class:'btn',onClick:()=>lancer(intention)(ACCEPT_PHOTOS,'environment')},t('Photographier')),
        el('button',{type:'button',class:'btn',onClick:()=>lancer(intention)(ACCEPT_FICHIERS,null)},t('Choisir des photos ou un PDF')),
        intention==='recette'?el('a',{class:'btn',href:`#/recipes/new?edition=${encodeURIComponent(edition.id)}`},t('Saisir à la main')):null)));
  }
  root.append(renderAccueilLivre(accueil, {
    photographier: (intention) => lancer(intention)(ACCEPT_PHOTOS, 'environment'),
    choisir: (intention) => lancer(intention)(ACCEPT_FICHIERS, null),
    plusTard: () => navigate('/library?tab=books'),
    fermer: () => remplacerAdresse(`#/books/${encodeURIComponent(edition.id)}`),
  }));
  // D-UI-7 : deux colonnes dès 900 px (.two-col.livre, 200px 1fr), empilées en dessous — gauche puis droite. Gauche = le livre (couverture, zone « Couverture »,
  // métadonnées, sommaire) ; droite = ce qu'on en fait (rappels, puis les recettes).
  const gauche = el('div', { class: 'stack', dataset: { role: 'colonne-livre' } });
  const droite = el('div', { dataset: { role: 'colonne-recettes' } });
  root.append(el('div', { class: 'two-col livre' }, gauche, droite));
  // La couverture ouvre la colonne de gauche (≈ 200 px, la largeur de la colonne) : c'est le livre qu'on reconnaît, avant de lire son nom (F15).
  gauche.append(bookCover(edition, book, { fichier: fichierCouverture, ctxF }));
  gauche.append(el('a', { class: 'btn', href: `#/add/livre?edition=${encodeURIComponent(edition.id)}` }, t('Compléter les informations')));
  if (typeof book.subtitle === 'string' && book.subtitle) gauche.append(el('p', null, book.subtitle));
  if (typeof book.description === 'string' && book.description) gauche.append(el('p', null, book.description));
  if (book.metadata_provenance || edition.metadata_provenance) gauche.append(el('details', null, el('summary', null, t('Sources')), renderSourcesLivre({ ...book.metadata_provenance, ...edition.metadata_provenance })));
  const shaSource = shaLivre(edition.source_photo_sha256);
  if (shaSource) {
    const source = await repo.getFile(shaSource);
    const photo = bookCover({ ...edition, cover_sha256: shaSource }, { ...book, title: t('Photo source') }, { fichier: source, ctxF });
    const bloc = el('details', null, el('summary', null, t('Photo source')), photo);
    if (!typeAffichage(source)?.startsWith('image/') && ctxF.connecte) bloc.append(el('button', { type: 'button', class: 'btn', onClick: async () => {
      await ctxF.moteur?.telecharger([shaSource]); invalidate(); refresh();
    } }, t('Télécharger')));
    gauche.append(bloc);
  }
  // Spec import-cible § 4.5 : les imports ouverts de CE livre se reprennent dans la section « Imports » d'Ajouter (rendue en premier, avec le focus).
  const aReprendre = (ctx.imports || []).filter((i) => importOuvert(i) && i.edition_id === edition.id).length;
  if (aReprendre) droite.append(el('div', { class: 'row', dataset: { role: 'imports-a-reprendre' }, style: { marginBottom: '.8rem' } },
    el('a', { class: 'btn small', href: '#/add?section=imports' }, aReprendre === 1 ? t('{n} import à reprendre', { n: aReprendre }) : t('{n} imports à reprendre', { n: aReprendre }))));
  const ouvertes = seancesOuvertes(ctx, edition.id);
  if (ouvertes.length) droite.append(el('div', { class: 'card flat row between' },
    el('span', null, t('Séance en cours : {n} page(s)', { n: (ouvertes[0].page_ids || []).length })),
    el('a', { class: 'btn small', href: `#/import?session=${encodeURIComponent(ouvertes[0].id)}` }, t('Reprendre'))));

  const usesCups = ctx.recipe_versions.some((v) => recipes.some((r) => r.id === v.recipe_id) && (v.ingredients || []).some((i) => ['cup', 'tbsp', 'tsp', 'fl_oz'].includes(i.unit_id)));
  if (!edition.unit_convention_id && usesCups) {
    droite.append(el('div', { class: 'card warn stack' },
      el('strong', null, t('Quelle convention pour les tasses et cuillères de cette édition ?')),
      el('p', { class: 'muted', style: { margin: 0 } }, t('Des recettes de ce livre utilisent des tasses ou des cuillères. Sans convention confirmée, ces quantités restent affichées telles quelles.')),
      el('div', { class: 'row' }, select([{ value: '', label: t('Choisir…') }, ...listConventions().map((c) => ({ value: c.id, label: c.labels.fr }))], '', async (v) => {
        if (!v) return;
        try {
          const contexte=await capturerEdition(repo,edition,{ctx});
          await repo.saveBatch({}, { editions:[contexte], conditions: { book_editions: [{ key: edition.id, fusion: (courante) => {
            if (!courante) throw new Error('edition_absente');
            return { ...courante, unit_convention_id: v, convention_evidence: 'confirmed_by_user' };
          } }] } });
          toast(t('Convention confirmée')); refresh();
        } catch { toast(t('Le livre n’a pas pu être enregistré. Réessaie.')); }
      }))));
  }

  const projection=projeterBibliotheque(ctx,{editionId:edition.id});
  const etatRecettes=etat.onglet==='sources'?lireContexteListe({route,query:{onglet:'recettes'},portee}):etat;
  const listeRecettes=await renderListeBibliotheque(ctx,{etat:etatRecettes,route,editionId:edition.id,origine,placeholder:t('Filtrer les recettes de ce livre'),deps});
  droite.append(sectionPlain(null,el('p',{class:'muted',dataset:{role:'compte-recettes'}},texteCompteurs(projection.compteurs)),listeRecettes));

  // Couverture (spec § 6) : visible, hors du <details> replié ; « Retirer » ne touche que le pointeur.
  const etatCouv = { sha256: edition.cover_sha256 || null, apercu: fichierCouverture?.blob ? urlDeBlob(fichierCouverture.blob) : null, enCours: false,
    telechargement: false, ...decrireCouverture(fichierCouverture) };
  // Le ré-encodage d'une photo de téléphone prend un instant : les boutons se ferment pendant (aucune double pose),
  // et l'état réel est redessiné sur place. En cas de succès, refresh() rend la fiche entière.
  const zoneCouv = el('div', null);
  const dessinerCouv = () => zoneCouv.replaceChildren(renderZoneCouverture(etatCouv, gestesCouv));
  // C4 / I2 : la fusion relit l'édition DANS la transaction et ne change que le pointeur décoratif.
  const ecrirePointeur = async (sha256,contexte,fichier=null) => {
    try {
      await repo.saveBatch({}, { editions:[contexte], ...(fichier?{fichiers:[fichier]}:{}), conditions: { book_editions: [{ key: edition.id, fusion: (courante) => {
        if (!courante) throw new Error('edition_absente');
        return { ...courante, cover_sha256: sha256 };
      } }] } });
      return true;
    } catch { return false; }
  };
  const poser = async (capture) => {
    let contexte,files;
    try{contexte=await capturerEdition(repo,edition,{ctx});files=await pickFiles({ accept: 'image/*', multiple: false, capture });}
    catch{toast(t('La couverture n’a pas pu être changée. Réessaie.'));return;}
    if (!files.length) return;
    etatCouv.enCours = true; dessinerCouv();
    let image;
    // Deux phases, deux phrases : une image refusée n'est pas une écriture refusée (I-B).
    try { image = await poserCouverture(files[0], { origine: 'locale',prepareOnly:true }); }
    catch (e) { etatCouv.enCours = false; dessinerCouv(); toast(messageErreurImage(e)); return; }
    if (!(await ecrirePointeur(image.sha256,contexte,image.fichier))) { etatCouv.enCours = false; dessinerCouv(); toast(t('La couverture n’a pas pu être changée. Réessaie.')); return; }
    toast(t('Couverture enregistrée.')); refresh();
  };
  const gestesCouv = {
    photographier: () => poser('environment'),
    choisir: () => poser(null),
    // RF-m4 : « Retirer » écrit aussi — il se ferme donc pendant, comme les deux autres (deux tapes pressées ne
    // font pas deux écritures), et il relit l'édition avant d'écrire (C4).
    retirer: async () => {
      if (etatCouv.enCours) return;
      etatCouv.enCours = true; dessinerCouv();
      let contexte;try{contexte=await capturerEdition(repo,edition,{ctx});}catch{etatCouv.enCours=false;dessinerCouv();toast(t('La couverture n’a pas pu être changée. Réessaie.'));return;}
      if (!(await ecrirePointeur(null,contexte))) { etatCouv.enCours = false; dessinerCouv(); toast(t('La couverture n’a pas pu être changée. Réessaie.')); return; }
      toast(t('Couverture retirée.')); refresh();
    },
    // Sur une tape seulement (R-G-1). Succès : la zone se redessine avec l'image, le cache est invalidé et la fiche se rend (bookCover de l'en-tête).
    telecharger: async (reessayer = false) => {
      if (etatCouv.telechargement) return;
      etatCouv.telechargement = true; dessinerCouv();
      try { if (reessayer) await ctxF.moteur?.reessayerFichier(edition.cover_sha256); else await ctxF.moteur?.telecharger([edition.cover_sha256]); } catch { /* dit plus bas */ }
      // Ronde 1 : une relecture qui lève (base fermée, quota) ne laisse plus la zone figée sur « Téléchargement… » : l'état d'avant, et l'échec dit.
      let f = null; let lu = true;
      try { f = await repo.getFile(edition.cover_sha256); } catch { lu = false; }
      etatCouv.telechargement = false;
      if (lu && f?.blob instanceof Blob) { invalidate(); Object.assign(etatCouv, { apercu: urlDeBlob(f.blob) }, decrireCouverture(f)); dessinerCouv(); refresh(); return; }
      if (lu) { await relireErreurs(ctxF); Object.assign(etatCouv, decrireCouverture(f)); }
      dessinerCouv();
      toast(t('Le téléchargement n’a pas abouti.'));
    },
    reessayer: () => gestesCouv.telecharger(true),
  };
  dessinerCouv();
  gauche.append(section(t('Couverture'), zoneCouv)); // reste .card : un panneau d'action (D-UI-8)

  // Métadonnées (le details d'avant, inchangé ; il passe dans la colonne de gauche, avant le Sommaire : D-UI-7)
  const metadonnees = await renderLivreEditeur({book,edition,ctx,query,deps});
  gauche.append(metadonnees);
  root.dispose = () => metadonnees.dispose?.();
  root.flushEditeur = () => metadonnees.flushEditeur?.();
  root.etatEditeur = () => metadonnees.etatEditeur?.();
  if (pref?.hidden) gauche.append(el('button', { class: 'btn', onClick: async () => { const contexte=await capturerEdition(repo,edition,{ctx}); await repo.save('rediscovery_prefs', { ...pref, hidden: false }, {editions:[contexte]}); toast(t('Livre de nouveau proposé dans Redécouvrir')); refresh(); } }, t('Réafficher dans Redécouvrir')));



  // D-UI-7 : UNE lecture des octets des pages (vignettesDePages, le motif du lot G) ; les pages d'index font le « Sommaire » (gauche, numérotées séance par
  // séance, dans l'ordre appliqué dans chacune puis celui des pages imprimées — parSeancePuisPosition, T4-R1 et vague finale ; l'ordre se corrige dans le
  // panneau de la séance, pas ici), les autres
  // restent dans « Pages et fichiers sources » (bas). Chaque groupe n'offre « Télécharger les {n} pages » que pour SES pages distantes.
  const triees = [...pages].sort((a, b) => (a.printed_page ?? 9999) - (b.printed_page ?? 9999));
  const pagesIndex = triees.filter((p) => p.kind === 'index').sort(parSeancePuisPosition(ctx));
  const pagesAutres = triees.filter((p) => p.kind !== 'index');
  // T4-R1 : chaque page est montrée par l'un des deux groupes (le Sommaire pour une page d'index, les sources pour les autres) — une lecture dès qu'il y a une page.
  const vignettes = triees.length ? await vignettesDePages(triees, ctxF) : { places: new Map(), distantes: [], telecharger: null };
  const distantesDe = (liste) => { const shas = new Set(liste.map((p) => p.sha256)); return vignettes.distantes.filter((s) => shas.has(s)); };
  const vignettesDe = (liste, numerotees) => el('div', { class: 'thumbs' }, ...liste.map((p, i) => el('figure', {dataset:{navId:p.id,rechercheSource:[p.printed_page,p.kind,p.original_filename].filter(Boolean).join(' ')}},
    numerotees ? el('span', { class: 'num' }, String(i + 1)) : null,
    vignettes.places.get(p.id),
    el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : t('page non numérotée'), p.kind ? ` · ${p.kind === 'index' ? t('index') : t('recette')}` : ''))));
  // « Sommaire » (plain) : seulement quand il y a quelque chose à montrer — des pages d'index, ou une séance de SOMMAIRE ouverte à reprendre (rien d'inventé).
  // Vague finale : l'intention d'une séance n'est pas stockée (import.js) — une séance ouverte n'est rappelée ICI que si elle porte une page d'index ou une
  // lecture d'index ouverte (ligneOuverteDeSeance, la règle du panneau d'index) ; une séance de recettes reste rappelée à droite seulement (« Reprendre »).
  const idsIndex = new Set(pagesIndex.map((p) => p.id));
  const seanceSommaire = ouvertes.find((s) => (Array.isArray(s.page_ids) ? s.page_ids : []).some((id) => idsIndex.has(id)) || ligneOuverteDeSeance(ctx.imports, s.id));
  const sources = el('section', { class: 'pages-source stack', hidden: true, dataset: { role: 'pages-source' } },
    el('h2', null, t('Pages source')),
    el('p', { class: 'muted' }, t('{n} page(s) photographiée(s)', { n: pages.length })),
    menuSource(t('Ajouter des pages'),
      el('button', { class: 'btn', onClick: () => lancer('recette')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
      el('button', { class: 'btn', onClick: () => lancer('recette')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF'))),
    menuSource(t('Mettre à jour l’index avec l’assistant'),
      el('p', { class: 'muted' }, t('Choisis les pages d’index ou de sommaire. Le nombre d’appels sera affiché avant la lecture.')),
      seanceSommaire ? el('a', { class: 'btn', href: `#/import?session=${encodeURIComponent(seanceSommaire.id)}` }, t('Reprendre la séance')) : null,
      el('button', { class: 'btn', onClick: () => lancer('index')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
      el('button', { class: 'btn', onClick: () => lancer('index')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF'))));
  if (pagesIndex.length || seanceSommaire) sources.append(sectionPlain(t('Sommaire'),
    seanceSommaire ? el('div', { class: 'row' }, el('a', { class: 'btn small', href: `#/import?session=${encodeURIComponent(seanceSommaire.id)}` }, t('Reprendre la séance'))) : null,
    boutonTelechargerPages(distantesDe(pagesIndex), { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
    pagesIndex.length ? vignettesDe(pagesIndex, true) : null));

  // Index : ajouter des entrées directement depuis la fiche du livre — sous le Sommaire, dont c'est la saisie à la main (lot I1 : « Titre — 116–19 »,
  // les recettes déjà dans le livre ne sont pas recréées ; la fiche se redessine par le bus).
  gauche.append(el('details', null, el('summary', { class: 'btn' }, t('Ajouter des entrées d’index à la main')), saisieIndexManuelle(edition, { repo, ctx, toast, apres: () => refresh() })));

  // Pages et documents (plain, en bas) : les pages qui ne sont pas d'index, et les documents non-photo (spec § 4.3). T4-R1 : la section ne paraît que s'il y a
  // l'un ou l'autre — un livre dont on n'a photographié que la table des matières (ses pages sont dans le Sommaire) n'a pas, en bas, une section vide.
  const docsNonPhoto = docs.filter((d) => d.source_type !== 'photo');
  if (pagesAutres.length || docsNonPhoto.length) {
    sources.append(sectionPlain(t('Pages et fichiers sources'),
      docs.length ? el('p', { class: 'muted' }, t('{n} document(s). Les originaux restent consultables depuis chaque recette.', { n: docs.length })) : null,
      boutonTelechargerPages(distantesDe(pagesAutres), { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
      pagesAutres.length ? vignettesDe(pagesAutres, false) : null,
      ...docsNonPhoto.map((d) => el('div', { class: 'row between card flat' }, el('span', null, `${d.original_filename} (${d.source_type.toUpperCase()})`), el('a', { class: 'btn small', href: `#/recipes/new?doc=${encodeURIComponent(d.id)}&edition=${encodeURIComponent(edition.id)}` }, t('Créer une recette depuis ce fichier'))))));
  }
  const etatSources=lireContexteListe({route,query:{onglet:'sources'},portee});
  const sourceRecherche=el('input',{type:'search',name:'qSources',value:etatSources.q||'','aria-label':t('Filtrer les pages source'),placeholder:t('Filtrer les pages source'),dataset:{navFocus:'recherche'}});
  const sourceSuite=el('div',{class:'row'}),sourceCompte=el('p',{class:'muted'});
  const dessinerSources=()=>{
    const toutes=[...sources.querySelectorAll('figure[data-nav-id]')],q=sourceRecherche.value.trim().toLowerCase();
    const retenues=toutes.filter(n=>!q||n.dataset.rechercheSource.toLowerCase().includes(q));
    for(const n of toutes)n.hidden=!retenues.slice(0,etatSources.limite).includes(n);
    sourceCompte.textContent=t('{n} page(s) photographiée(s)',{n:retenues.length});
    sourceSuite.replaceChildren(...(retenues.length>etatSources.limite?[el('button',{type:'button',class:'btn',onClick:()=>{etatSources.limite+=60;memoriserListe({...etatSources,route,onglet:'sources'});dessinerSources();}},t('Voir plus'))]:[]));
  };
  sourceRecherche.addEventListener('input',()=>{etatSources.q=sourceRecherche.value;etatSources.limite=60;memoriserListe({...etatSources,route,onglet:'sources'});dessinerSources();});
  sources.prepend(el('div',{class:'bibliotheque-commandes'},sourceRecherche,sourceCompte));sources.append(sourceSuite);dessinerSources();
  // EI-T4-1, T4-R1 : une rotation ou un redimensionnement redessine la liste — seulement si la largeur a changé depuis le dernier dessin. L'abonnement est posé au
  // MONTAGE, APRÈS le dernier await du rendu (suivreLargeurAuMontage, l'aide partagée avec la bibliothèque et la fiche recette) : la largeur y est relue (un
  // change reçu entre le rendu et le montage n'est pas perdu), un rendu jamais inséré ne prend pas l'abonnement de la fiche affichée, et une fiche quittée se
  // retire au premier change sans rien redessiner — au plus UNE fiche livre retenue par la MediaQueryList de la fenêtre.
  const contenu = root.querySelector('.two-col.livre');
  const onglets = el('div', { class: 'onglets-livre', role: 'tablist', 'aria-label': t('Contenu du livre') });
  let ongletCourant=etat.onglet;
  const afficher = (source,initial=false) => {
    if(!initial)capturerVue(root);
    ongletCourant=source?'sources':'recettes';
    if(contenu)contenu.hidden=source; sources.hidden=!source;
    [...onglets.children].forEach((bouton,i)=>{bouton.setAttribute('aria-selected',String(source===(i===1)));bouton.classList.toggle('active',source===(i===1));});
    if(!initial){const sousEtat=lireContexteListe({route,query:{onglet:ongletCourant},portee});memoriserListe({...sousEtat,route,portee,onglet:ongletCourant});restaurerVue({racine:root,cleEntree:etat.cleEntree,portee,estCourante:()=>root.isConnected});}
  };
  onglets.append(el('button',{role:'tab','aria-selected':'true',dataset:{role:'ouvrir-recettes'},onClick:()=>afficher(false)},t('Recettes')),
    el('button',{role:'tab','aria-selected':'false',onClick:()=>afficher(true),dataset:{role:'ouvrir-pages-source'}},t('Pages source ({n})',{n:pages.length})));
  if(contenu)contenu.before(onglets);else root.append(onglets);root.append(sources);afficher(etat.onglet==='sources',true);
  return root;
}

export { promptDialog };
