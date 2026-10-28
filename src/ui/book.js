// Fiche d'un livre (édition possédée) : en-tête (titre, sous-titre, deux menus d'ajout), couverture et sommaire à gauche, les recettes à droite, pages sources en bas.
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
import { photosPersonnellesParRecette } from '../domain/cuisine-personnelle.js';
import { empreintesPhotos, fichierPhoto } from './components.js';
import { renderSourcesLivre } from './livre-sans-saisie.js';
import { shaLivre } from '../domain/livre-bibliographie.js';

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

// D-E23 (R-E-2, R-E-8, R-E-12, R-E-15) : supprimer un livre vide sans laisser d'orphelin. Rien n'est cru du rendu (ronde 1) : AVANT toute écriture,
// l'édition est relue VIDE (aucune recette, aucun document, aucune page par l'index edition_id ; sinon refus non_vide) et le livre relu par book_id
// (une autre édition en base le garde, comme garderLivre ; un livre de repli sans identifiant n'est jamais listé). Temps 1 — les lignes du journal qui
// pointent l'édition en sont DÉTACHÉES avant toute suppression : une ligne ouverte (importOuvert, R-B-18) passe ignore AVEC edition_id null, reponse_brute
// null et finished_at, en UNE écriture ; toute autre — terminale, ou à un statut hors vocabulaire (relu tel quel : jamais une transition inventée) —
// reçoit le seul patch edition_id null ; une ligne en_cours fait REFUSER avant toute écriture (TRANSITIONS : en_cours → ignore n'existe pas), une ligne au
// statut illisible aussi (aucune condition ne le relit : import_lie). Seule une ligne DISPARUE entre la lecture et la transition se tait ; toute autre
// transition refusée fait refuser avant le temps 2. Temps 2 — UNE transaction (repo.removeBatch) retire les traces de consultation de l'édition
// (library_activity, sa préférence de Redécouvrir), listées AVANT elle, puis l'édition et, sauf garder, le livre, SOUS LA CONDITION qu'aucune ligne du
// journal à un statut CONNU (STATUTS_IMPORT) ne la pointe plus (une telle ligne arrivée entre les deux temps fait refuser, rien n'est supprimé ; une ligne
// glissée au statut hors vocabulaire ou non-chaîne n'est pas vue par cette condition, et la vacuité de l'édition est relue hors transaction : limites
// nommées en spec § 11, vague finale du lot E). La capture garde son filtre : l'historique ne part
// au serveur que sous « Synchroniser mon historique de consultation » (R27). Rend { ok: true } ou { refus: 'lecture_en_cours' | 'non_vide' | 'import_lie' }.
export async function supprimerLivreVide({ book, edition, garderLivre = false }, { repo: r = repo } = {}) {
  const repo = r; // le dépôt injecté sous le nom littéral que le test statique du lot A exige (contrainte globale) ; le défaut ci-dessus lit le module
  const cle = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!cle(edition?.id)) throw new TypeError('supprimerLivreVide : une édition sans identifiant');
  const livre = cle(book?.id) ? book.id : null;
  const [recettes, documents, pages, editions] = await Promise.all([
    repo.byIndex('recipes', 'edition_id', edition.id), repo.byIndex('source_documents', 'edition_id', edition.id),
    repo.byIndex('source_pages', 'edition_id', edition.id), livre ? repo.byIndex('book_editions', 'book_id', livre) : [],
  ]);
  if ([recettes, documents, pages].some((fiches) => fiches.some(Boolean))) return { refus: 'non_vide' };
  const garder = garderLivre || !livre || editions.some((e) => e && e.id !== edition.id);
  const lignes = (await repo.byIndex('imports', 'edition_id', edition.id)).filter(Boolean);
  if (lignes.some((l) => l.status === 'en_cours')) return { refus: 'lecture_en_cours' };
  if (lignes.some((l) => typeof l.status !== 'string' || !l.status)) return { refus: 'import_lie' };
  for (const l of lignes) {
    const attendus = STATUTS_IMPORT.includes(l.status) ? STATUTS_IMPORT.filter((s) => s !== 'en_cours') : [l.status];
    const patch = (c) => (importOuvert(c) ? { status: 'ignore', edition_id: null, reponse_brute: null, finished_at: repo.nowIso() } : { edition_id: null });
    try { await repo.transitionner('imports', l.id, { attendus, patch }); }
    catch (e) {
      if (!(e instanceof TransitionRefusee)) throw e;
      if (e.statut === 'en_cours') return { refus: 'lecture_en_cours' }; // passée en vol entre la lecture et la transition
      if (e.statut !== undefined || (await repo.get('imports', l.id)) != null) return { refus: 'import_lie' }; // seule une ligne disparue se tait
    }
  }
  const activites = (await repo.byIndex('library_activity', 'edition_id', edition.id)).filter((a) => a && typeof a.id === 'string').map((a) => a.id);
  const preference = await repo.get('rediscovery_prefs', edition.id);
  try {
    await repo.removeBatch({ library_activity: activites, ...(preference ? { rediscovery_prefs: [edition.id] } : {}), book_editions: [edition.id], ...(garder ? {} : { books: [livre] }) },
      { conditions: { imports: [{ index: 'edition_id', valeur: edition.id, exclus: STATUTS_IMPORT }] } });
  } catch (e) {
    if (!(e instanceof TransitionRefusee)) throw e;
    return { refus: e.statut === 'en_cours' ? 'lecture_en_cours' : 'import_lie' };
  }
  return { ok: true };
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
export function ligneCompacte(r, { fichier = null } = {}) {
  const type = typeAffichage(fichier);
  const u = type && type.startsWith('image/') ? displayUrl(fichier, urlDeBlob) : null;
  const vignette = u ? el('img', { class: 'plat-vignette petite', alt: '', loading: 'lazy', src: u }) : null;
  vignette?.addEventListener('error', () => { vignette.remove(); revoquerUrlDeBlob(u); }, { once: true });
  const importable = (r.availability === 'reference_only' || r.availability === 'partial') && !aUneAdresse(r);
  const sectionLue = r.availability === 'reference_only' && !aUneAdresse(r) ? sectionLisible(r.section) : null; // la règle d'avant : jamais sur un signet rangé
  const id = encodeURIComponent(r.id);
  return el('li', { class: 'row between', dataset: { recette: r.id } },
    el('div', { class: 'row top', style: { flex: '1', minWidth: '0' } },
      vignette,
      el('div', { style: { flex: '1', minWidth: '0' } },
        el('a', { class: 'titre', href: `#/recipes/${id}` }, r.display_title || r.original_title || t('Sans titre')),
        el('div', { class: 'row', style: { gap: '.4rem' } },
          plagesLisibles(r).length ? el('span', { class: 'muted', dataset: { role: 'pages' } }, `${t('p.')} ${textePlages(plagesLisibles(r))}`) : null,
          sectionLue ? el('span', { class: 'chip neutral', dataset: { role: 'section' } }, sectionLue) : null))),
    el('div', { class: 'row', dataset: { role: 'etat-recette' } },
      availabilityBadge({ ...r, printed_page: null }),
      importable ? el('a', { class: 'btn small', href: `#/recipes/${id}/importer` }, t('Importer')) : null,
      importable ? el('a', { class: 'btn small', href: `#/recipes/${id}/edit?kind=extraction` }, t('Saisir à la main')) : null,
      r.favorite ? el('span', { class: 'badge' }, '★ ' + t('Favori')) : null));
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
  if (!edition) return el('div', { class: 'card' }, t('Livre introuvable.'));
  const book = ctx.booksById.get(edition.book_id) || { title: t('Sans titre') };
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
  const root = el('div', null);
  // I-F : un scan parti d'ici porte le livre ET l'intention (index ou recette) ; le menu ne décide que de la SOURCE.
  const lancer = (intention) => async (accept, capture) => {
    const f = await pickFiles({ accept, multiple: true, capture });
    if (f.length) startScanSession(f, { edition_id: edition.id, intention });
  };
  // D-UI-7, H-21 : le sous-titre dit l'auteur, l'éditeur et l'année — ce qui est connu, dans cet ordre ; l'ISBN et la langue restent dans « Métadonnées et
  // convention ». Les deux menus d'ajout restent les ACTIONS de l'en-tête (markup inchangé, textes D-UI-10) ; le titre de fiche porte classeTitre (D-UI-3).
  // R-UI-11 tranché (vague finale) : les retours propres à un livre (« ← Bibliothèque », « Plus tard », après la suppression) mènent au segment Livres, d'où
  // vient la fiche et où un livre neuf se voit ; #/library (Recettes) reste celui de la NAV et de la fiche recette.
  root.append(pageHeader(book.title, {
    subtitle: [book.author, edition.publisher, edition.year].filter(Boolean).join(' · '),
    back: { href: '/library?tab=books', label: t('Bibliothèque') },
    classeTitre: 'titre-fiche',
    actions: [
      menuSource(t('Ajouter des pages de sommaire'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF'))),
      menuSource(t('Ajouter des recettes'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF')),
        el('a', { class: 'btn', href: `#/recipes/new?edition=${encodeURIComponent(edition.id)}` }, t('Saisir à la main'))),
    ],
  }));
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
  gauche.append(bookCover(edition, book, { fichier: fichierCouverture }));
  gauche.append(el('a', { class: 'btn', href: `#/add/livre?edition=${encodeURIComponent(edition.id)}` }, t('Compléter les informations')));
  if (typeof book.subtitle === 'string' && book.subtitle) gauche.append(el('p', null, book.subtitle));
  if (typeof book.description === 'string' && book.description) gauche.append(el('p', null, book.description));
  if (book.metadata_provenance || edition.metadata_provenance) gauche.append(el('details', null, el('summary', null, t('Sources')), renderSourcesLivre({ ...book.metadata_provenance, ...edition.metadata_provenance })));
  const shaSource = shaLivre(edition.source_photo_sha256);
  if (shaSource) {
    const source = await repo.getFile(shaSource);
    const photo = bookCover({ ...edition, cover_sha256: shaSource }, { ...book, title: t('Photo source') }, { fichier: source });
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
          await repo.saveBatch({}, { conditions: { book_editions: [{ key: edition.id, fusion: (courante) => {
            if (!courante) throw new Error('edition_absente');
            return { ...courante, unit_convention_id: v, convention_evidence: 'confirmed_by_user' };
          } }] } });
          toast(t('Convention confirmée')); refresh();
        } catch { toast(t('Le livre n’a pas pu être enregistré. Réessaie.')); }
      }))));
  }

  // Les recettes de ce livre (D-UI-7, D-UI-10) : « disponibles » = tout ce qui n'est pas une simple référence (la partielle comprise, comme le compteur d'avant) ;
  // « à importer » = les références SANS adresse (un signet rangé dans le livre est un lien web, pas une page à importer) — estAImporter de library.js, la même
  // définition que l'onglet « À importer » de la bibliothèque (T4-R1). Les trois chips d'état ont disparu : la phrase sous le titre les remplace.
  const disponibles = recipes.filter((r) => r.availability !== 'reference_only');
  const aImporter = recipes.filter(estAImporter);
  // I-UI-5 : les octets des photos de plat sont lus UNE fois, en une transaction (comme les couvertures de la bibliothèque, library.js) ; la ligne décide au rendu.
  const photosPersonnelles = photosPersonnellesParRecette(ctx.cook_history);
  const photos = await repo.getFiles(empreintesPhotos(recipes, photosPersonnelles));
  const filterState = { mode: 'all', q: '', tout: false };
  const list = el('div', { dataset: { role: 'liste-recettes' } });
  let largeDessinee = null; // la largeur que la liste montre (relue au montage et à chaque change : on ne redessine que si elle a changé)
  const drawList = () => {
    largeDessinee = !!large.matches;
    let rows = recipes;
    if (filterState.mode === 'available') rows = disponibles; if (filterState.mode === 'refs') rows = aImporter; if (filterState.mode === 'fav') rows = recipes.filter((r) => r.favorite);
    if (filterState.q) rows = rows.filter((r) => (r.original_title + ' ' + (r.display_title || '')).toLowerCase().includes(filterState.q.toLowerCase()));
    rows = [...rows].sort((a, b) => (a.printed_page ?? 99999) - (b.printed_page ?? 99999) || a.original_title.localeCompare(b.original_title));
    // Lot F (§ 4.2, D-T9) : le filtre redessine à chaque touche ; les URL des vignettes précédentes sont révoquées APRÈS le remplacement, elles seules.
    if (!rows.length) { remplacerEnRevoquant(list, emptyState('livre-ouvert', t('Aucune recette dans cette vue. Photographie l’index ou une recette pour commencer.'))); return; }
    // Sous 900 px : LIGNES_REPLIEES lignes, puis « Voir les {n} recettes » déplie l'instance pour de bon (un filtre changé ensuite reste déplié) ; ≥ 900 px : tout.
    const repliee = !large.matches && !filterState.tout && rows.length > LIGNES_REPLIEES;
    const visibles = repliee ? rows.slice(0, LIGNES_REPLIEES) : rows;
    const noeuds = [el('ul', { class: 'liste-compacte' }, ...visibles.map((r) => ligneCompacte(r, { fichier: fichierPhoto(r, photosPersonnelles, photos) })))];
    // T4-R1 (I-UI-4) : le bouton se retire en dépliant — le focus passe au titre de la première ligne montrée par le dépli, jamais à body.
    if (repliee) noeuds.push(el('button', { type: 'button', class: 'btn', dataset: { role: 'voir-tout' }, onClick: () => { filterState.tout = true; drawList(); list.querySelectorAll('ul.liste-compacte > li')[LIGNES_REPLIEES]?.querySelector('a.titre')?.focus(); } }, t('Voir les {n} recettes', { n: rows.length })));
    remplacerEnRevoquant(list, ...noeuds);
  };
  const q = el('input', { type: 'search', placeholder: t('Filtrer les recettes de ce livre'), onInput: (e) => { filterState.q = e.target.value; drawList(); } });
  droite.append(sectionPlain(t('Les recettes de ce livre'),
    el('p', { class: 'muted', dataset: { role: 'compte-recettes' } }, t('{n} disponible(s) · {m} à importer', { n: disponibles.length, m: aImporter.length })),
    el('div', { class: 'row', style: { marginBottom: '.6rem' } },
      ...[['all', t('Toutes')], ['available', t('Disponibles')], ['refs', t('À importer')], ['fav', t('Favoris')]].map(([v, l]) => el('button', { type: 'button', class: `btn small${v === 'all' ? ' active' : ''}`, onClick: (e) => { filterState.mode = v; for (const b of e.target.parentNode.children) b.classList.remove('active'); e.target.classList.add('active'); drawList(); } }, l)),
      q),
    list));
  drawList();

  // Couverture (spec § 6) : visible, hors du <details> replié ; « Retirer » ne touche que le pointeur.
  const etatCouv = { sha256: edition.cover_sha256 || null, apercu: fichierCouverture?.blob ? urlDeBlob(fichierCouverture.blob) : null, enCours: false,
    telechargement: false, ...decrireCouverture(fichierCouverture) };
  // Le ré-encodage d'une photo de téléphone prend un instant : les boutons se ferment pendant (aucune double pose),
  // et l'état réel est redessiné sur place. En cas de succès, refresh() rend la fiche entière.
  const zoneCouv = el('div', null);
  const dessinerCouv = () => zoneCouv.replaceChildren(renderZoneCouverture(etatCouv, gestesCouv));
  // C4 / I2 : la fusion relit l'édition DANS la transaction et ne change que le pointeur décoratif.
  const ecrirePointeur = async (sha256) => {
    try {
      await repo.saveBatch({}, { conditions: { book_editions: [{ key: edition.id, fusion: (courante) => {
        if (!courante) throw new Error('edition_absente');
        return { ...courante, cover_sha256: sha256 };
      } }] } });
      return true;
    } catch { return false; }
  };
  const poser = async (capture) => {
    const files = await pickFiles({ accept: 'image/*', multiple: false, capture });
    if (!files.length) return;
    etatCouv.enCours = true; dessinerCouv();
    let empreinte;
    // Deux phases, deux phrases : une image refusée n'est pas une écriture refusée (I-B).
    try { empreinte = (await poserCouverture(files[0], { origine: 'locale' })).sha256; }
    catch (e) { etatCouv.enCours = false; dessinerCouv(); toast(messageErreurImage(e)); return; }
    if (!(await ecrirePointeur(empreinte))) { etatCouv.enCours = false; dessinerCouv(); toast(t('La couverture n’a pas pu être changée. Réessaie.')); return; }
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
      if (!(await ecrirePointeur(null))) { etatCouv.enCours = false; dessinerCouv(); toast(t('La couverture n’a pas pu être changée. Réessaie.')); return; }
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
  const meta = { title: book.title, author: book.author || '', isbn: edition.isbn || '', publisher: edition.publisher || '', year: edition.year || '', language: edition.language || 'fr', convention: edition.unit_convention_id || '', cuisines: [...(book.cuisines || [])], tags: tagsDe(book.tags) }; // S2 : tagsDe rend toujours un tableau neuf
  const valeursMeta = () => ({ title: meta.title.trim() || book.title, author: meta.author.trim(), isbn: meta.isbn.trim() || null,
    publisher: meta.publisher.trim() || null, year: meta.year ? parseInt(meta.year, 10) || null : null, language: meta.language,
    convention: meta.convention || null, cuisines: [...meta.cuisines], tags: [...meta.tags] });
  const metaInitiale = valeursMeta();
  const inp = (k, type = 'text') => el('input', { type, value: meta[k], onInput: (e) => { meta[k] = e.target.value; } });
  gauche.append(el('details', { class: 'card' }, el('summary', null, el('strong', null, t('Métadonnées et convention'))),
    el('div', { class: 'two-col', style: { marginTop: '.8rem' } },
      field(t('Titre'), inp('title')), field(t('Auteur / chef'), inp('author')), field(t('ISBN'), inp('isbn')), field(t('Éditeur'), inp('publisher')), field(t('Année'), inp('year', 'number')),
      field(t('Langue'), select([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'other', label: t('Autre') }], meta.language, (v) => { meta.language = v; })),
      // R-UX-8 : les puces ne vont JAMAIS dans un label — field() rend un <label>, et un clic sur « Cuisines »
      // activerait alors la première puce. Même habillage (.field), sans l'enveloppe qui vole le clic.
      el('div', { class: 'field' }, el('span', null, t('Cuisines')), (() => {
        const box = el('div', null);
        const dessiner = () => box.replaceChildren(renderPuces(pucesModel({ choisies: meta.cuisines, existantes: cuisinesExistantes(ctx) }), {
          basculer: (v) => { meta.cuisines = basculerPuce(meta.cuisines, v); dessiner(); },
          ajouter: (v) => { const a = ajouterPuce(meta.cuisines, v); if (a !== meta.cuisines) { meta.cuisines = a; dessiner(); } },
        }));
        dessiner();
        return box;
      })()),
      el('div', { class: 'field' }, el('span', null, t('Mots-clés')), (() => {
        const box = el('div', null);
        const dessiner = () => box.replaceChildren(renderPuces(pucesModel({ choisies: meta.tags, existantes: motsClesExistants(ctx), graine: [] }), {
          basculer: (v) => { meta.tags = basculerPuce(meta.tags, v); dessiner(); },
          ajouter: (v) => { const a = ajouterPuce(meta.tags, v); if (a !== meta.tags) { meta.tags = a; dessiner(); } },
        }, { libelleAutre: t('Autre mot-clé') }));
        dessiner();
        return box;
      })()),
      field(t('Convention de mesure'), select([{ value: '', label: t('Non confirmée') }, ...listConventions().map((c) => ({ value: c.id, label: c.labels.fr }))], meta.convention, (v) => { meta.convention = v; }), t('Ordre de décision : équivalences imprimées → convention décrite dans le livre → convention confirmée ici.'))),
    el('div', { class: 'row', style: { marginTop: '.8rem' } },
      el('button', { class: 'btn primary', onClick: async () => {
        // I2 : champs effectivement modifiés depuis le rendu seulement. Les autres valeurs et leurs sources
        // sont relues dans la même transaction, y compris une source photo ou une note ajoutée entre-temps.
        const valeurs = valeursMeta();
        const modifies = Object.keys(valeurs).filter((k) => JSON.stringify(valeurs[k]) !== JSON.stringify(metaInitiale[k]));
        const fusion = (champs) => (courant) => {
          if (!courant) throw new Error('fiche_absente');
          const patch = {}, provenance = {};
          for (const k of champs.filter((champ) => modifies.includes(champ))) {
            const champ = k === 'convention' ? 'unit_convention_id' : k;
            if (JSON.stringify(courant[champ] ?? null) === JSON.stringify(valeurs[k])) continue;
            patch[champ] = valeurs[k];
            if (k === 'convention') patch.convention_evidence = valeurs[k] ? 'confirmed_by_user' : null;
            provenance[k] = { origin: 'manual', retrieved_at: null, sources: [], uncertain: false, justification: '' };
          }
          return { ...courant, ...patch, ...(Object.keys(provenance).length ? { metadata_provenance: { ...courant.metadata_provenance, ...provenance } } : {}) };
        };
        const champsLivre = ['title', 'author', 'cuisines', 'tags'], champsEdition = ['isbn', 'publisher', 'year', 'language', 'convention'];
        const conditions = {};
        if (champsLivre.some((k) => modifies.includes(k))) conditions.books = [{ key: book.id, fusion: fusion(champsLivre) }];
        if (champsEdition.some((k) => modifies.includes(k))) conditions.book_editions = [{ key: edition.id, fusion: fusion(champsEdition) }];
        try {
          if (Object.keys(conditions).length) { await repo.saveBatch({}, { conditions }); toast(t('Enregistré')); }
          refresh();
        }
        catch { toast(t('Le livre n’a pas pu être enregistré. Réessaie.')); }
      } }, t('Enregistrer')),
      pref?.hidden ? el('button', { class: 'btn', onClick: async () => { await repo.save('rediscovery_prefs', { ...pref, hidden: false }); toast(t('Livre de nouveau proposé dans Redécouvrir')); refresh(); } }, t('Réafficher dans Redécouvrir')) : null,
      !recipes.length && !docs.length ? el('button', { class: 'btn danger', onClick: async () => {
        if (!(await confirmDialog(t('Supprimer ce livre ? Il n’a aucune recette ni page.'), { danger: true, okLabel: t('Supprimer') }))) return;
        // Lot E (D-E23) : sans orphelin — les lignes du journal détachées, l'historique et la préférence retirés avec l'édition, en une transaction.
        const res = await supprimerLivreVide({ book, edition, garderLivre: ctx.book_editions.some((e) => e.book_id === book.id && e.id !== edition.id) }, { repo });
        // Ronde 1 : chaque refus est dit ; rien n'est supprimé et la fiche reste.
        if (res?.refus) {
          toast(res.refus === 'lecture_en_cours' ? t('Une lecture est déjà en cours : annule-la d’abord.')
            : res.refus === 'non_vide' ? t('Un livre avec des recettes ou des pages ne se supprime pas d’un geste.') : t('Un import est encore lié à ce livre : rien n’a été supprimé.'));
          return;
        }
        navigate('/library?tab=books');
      } }, t('Supprimer')) : el('small', { class: 'muted' }, t('Un livre avec des recettes ou des pages ne se supprime pas d’un geste.')))));

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
  const vignettesDe = (liste, numerotees) => el('div', { class: 'thumbs' }, ...liste.map((p, i) => el('figure', null,
    numerotees ? el('span', { class: 'num' }, String(i + 1)) : null,
    vignettes.places.get(p.id),
    el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : t('page non numérotée'), p.kind ? ` · ${p.kind === 'index' ? t('index') : t('recette')}` : ''))));
  // « Sommaire » (plain) : seulement quand il y a quelque chose à montrer — des pages d'index, ou une séance de SOMMAIRE ouverte à reprendre (rien d'inventé).
  // Vague finale : l'intention d'une séance n'est pas stockée (import.js) — une séance ouverte n'est rappelée ICI que si elle porte une page d'index ou une
  // lecture d'index ouverte (ligneOuverteDeSeance, la règle du panneau d'index) ; une séance de recettes reste rappelée à droite seulement (« Reprendre »).
  const idsIndex = new Set(pagesIndex.map((p) => p.id));
  const seanceSommaire = ouvertes.find((s) => (Array.isArray(s.page_ids) ? s.page_ids : []).some((id) => idsIndex.has(id)) || ligneOuverteDeSeance(ctx.imports, s.id));
  if (pagesIndex.length || seanceSommaire) gauche.append(sectionPlain(t('Sommaire'),
    seanceSommaire ? el('div', { class: 'row' }, el('a', { class: 'btn small', href: `#/import?session=${encodeURIComponent(seanceSommaire.id)}` }, t('Reprendre la séance'))) : null,
    boutonTelechargerPages(distantesDe(pagesIndex), { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
    pagesIndex.length ? vignettesDe(pagesIndex, true) : null));

  // Index : ajouter des entrées directement depuis la fiche du livre — sous le Sommaire, dont c'est la saisie à la main (lot I1 : « Titre — 116–19 »,
  // les recettes déjà dans le livre ne sont pas recréées ; la fiche se redessine par le bus).
  gauche.append(el('details', null, el('summary', { class: 'btn' }, t('Ajouter des entrées d’index à la main')), saisieIndexManuelle(edition, { repo, toast, apres: () => refresh() })));

  // Pages et documents (plain, en bas) : les pages qui ne sont pas d'index, et les documents non-photo (spec § 4.3). T4-R1 : la section ne paraît que s'il y a
  // l'un ou l'autre — un livre dont on n'a photographié que la table des matières (ses pages sont dans le Sommaire) n'a pas, en bas, une section vide.
  const docsNonPhoto = docs.filter((d) => d.source_type !== 'photo');
  if (pagesAutres.length || docsNonPhoto.length) {
    root.append(sectionPlain(t('Pages et fichiers sources'),
      docs.length ? el('p', { class: 'muted' }, t('{n} document(s). Les originaux restent consultables depuis chaque recette.', { n: docs.length })) : null,
      boutonTelechargerPages(distantesDe(pagesAutres), { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
      pagesAutres.length ? vignettesDe(pagesAutres, false) : null,
      ...docsNonPhoto.map((d) => el('div', { class: 'row between card flat' }, el('span', null, `${d.original_filename} (${d.source_type.toUpperCase()})`), el('a', { class: 'btn small', href: `#/recipes/new?doc=${encodeURIComponent(d.id)}&edition=${encodeURIComponent(edition.id)}` }, t('Créer une recette depuis ce fichier'))))));
  }
  // EI-T4-1, T4-R1 : une rotation ou un redimensionnement redessine la liste — seulement si la largeur a changé depuis le dernier dessin. L'abonnement est posé au
  // MONTAGE, APRÈS le dernier await du rendu (suivreLargeurAuMontage, l'aide partagée avec la bibliothèque et la fiche recette) : la largeur y est relue (un
  // change reçu entre le rendu et le montage n'est pas perdu), un rendu jamais inséré ne prend pas l'abonnement de la fiche affichée, et une fiche quittée se
  // retire au premier change sans rien redessiner — au plus UNE fiche livre retenue par la MediaQueryList de la fenêtre.
  suivreLargeurAuMontage('fiche-livre', root, large, () => { if (!!large.matches !== largeDessinee) drawList(); });
  return root;
}

export { promptDialog };
