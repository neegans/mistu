// Fiche d'un livre (édition possédée) : métadonnées, convention d'unités, recettes repérées et disponibles, pages sources.
import { el, toast, pickFiles, confirmDialog, promptDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, refresh, remplacerAdresse } from '../core/router.js';
import * as repo from '../model/repo.js';
import { etatFichier } from '../sync/fichiers.js';
import { listConventions } from '../domain/units.js';
import { pageHeader, section, field, select, recipeCard, emptyState, bookCover, contexteFichiers, vignettesDePages, boutonTelechargerPages, relireErreurs, texteErreurFichier, remplacerEnRevoquant } from './components.js';
import { invalidate } from './state.js';
import { urlDeBlob } from '../core/blob-urls.js';
import { poserCouverture, renderZoneCouverture, messageErreurImage } from './livre-ajout.js';
import { startScanSession, indexEntriesPanel } from './import.js';
import { accueilLivreModel, renderAccueilLivre } from './accueil-livre.js';
import { pucesModel, renderPuces, basculerPuce, ajouterPuce, cuisinesExistantes, motsClesExistants } from './puces.js';
import { tagsDe } from '../domain/search.js';
import { sectionLisible } from '../domain/llm.js';
import { seanceDUnImportCible, importOuvert } from '../domain/import-cible.js';
import { ACCEPT_PHOTOS, ACCEPT_FICHIERS } from './add.js';
import { STATUTS_IMPORT } from '../model/schema.js';
import { TransitionRefusee } from '../core/db.js';

// C8 : la plus RÉCENTE d'abord. La fiche ne rappelle qu'UNE séance et « Reprendre » doit mener à celle qu'on vient
// de laisser, pas à la plus vieille restée ouverte (l'ordre de la base est celui des clés, pas du temps).
// Import ciblé (spec import-cible § 4.1, N3) : la séance d'un import CIBLÉ non terminé n'est pas rappelée ici — elle se reprend par la section
// « Imports » d'Ajouter ; elle revient après ignore. Les séances de « Regrouper en recette » et du panneau d'index restent rappelées.
export const seancesOuvertes = (ctx, editionId) => (ctx.scan_sessions || [])
  .filter((s) => s.status === 'open' && s.edition_id === editionId && !seanceDUnImportCible(s, ctx.imports))
  .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));

// « + Pages d'index » / « + Recette » : un <details> dont le résumé est le bouton, les sources dessous (spec § 9).
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

export async function renderBook(params, query, ctx) {
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
  const root = el('div', null);
  // I-F : un scan parti d'ici porte le livre ET l'intention (index ou recette) ; le menu ne décide que de la SOURCE.
  const lancer = (intention) => async (accept, capture) => {
    const f = await pickFiles({ accept, multiple: true, capture });
    if (f.length) startScanSession(f, { edition_id: edition.id, intention });
  };
  const enTete = pageHeader(book.title, {
    subtitle: [book.author, edition.publisher, edition.year, edition.isbn ? `ISBN ${edition.isbn}` : null, edition.language ? edition.language.toUpperCase() : null].filter(Boolean).join(' · '),
    back: { href: '/library', label: t('Mes livres') },
    actions: [
      menuSource(t('+ Pages d’index'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('index')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF'))),
      menuSource(t('+ Recette'),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_PHOTOS, 'environment') }, t('Photographier')),
        el('button', { type: 'button', class: 'btn', onClick: () => lancer('recette')(ACCEPT_FICHIERS, null) }, t('Choisir des photos ou un PDF')),
        el('a', { class: 'btn', href: `#/recipes/new?edition=${encodeURIComponent(edition.id)}` }, t('Saisir à la main'))),
    ],
  });
  // La couverture est à GAUCHE du titre (F15) : c'est le livre qu'on reconnaît, avant de lire son nom.
  root.append(el('div', { class: 'row top' },
    el('div', { style: { width: '96px', flex: '0 0 auto' } }, bookCover(edition, book, { fichier: fichierCouverture })),
    enTete));
  root.append(renderAccueilLivre(accueil, {
    photographier: (intention) => lancer(intention)(ACCEPT_PHOTOS, 'environment'),
    choisir: (intention) => lancer(intention)(ACCEPT_FICHIERS, null),
    plusTard: () => navigate('/library'),
    fermer: () => remplacerAdresse(`#/books/${encodeURIComponent(edition.id)}`),
  }));
  // Spec import-cible § 4.5 : les imports ouverts de CE livre se reprennent dans la section « Imports » d'Ajouter (rendue en premier, avec le focus).
  const aReprendre = (ctx.imports || []).filter((i) => importOuvert(i) && i.edition_id === edition.id).length;
  if (aReprendre) root.append(el('div', { class: 'row', dataset: { role: 'imports-a-reprendre' }, style: { marginBottom: '.8rem' } },
    el('a', { class: 'btn small', href: '#/add?section=imports' }, aReprendre === 1 ? t('{n} import à reprendre', { n: aReprendre }) : t('{n} imports à reprendre', { n: aReprendre }))));
  const ouvertes = seancesOuvertes(ctx, edition.id);
  if (ouvertes.length) root.append(el('div', { class: 'card flat row between' },
    el('span', null, t('Séance en cours : {n} page(s)', { n: (ouvertes[0].page_ids || []).length })),
    el('a', { class: 'btn small', href: `#/import?session=${encodeURIComponent(ouvertes[0].id)}` }, t('Reprendre'))));

  const usesCups = ctx.recipe_versions.some((v) => recipes.some((r) => r.id === v.recipe_id) && (v.ingredients || []).some((i) => ['cup', 'tbsp', 'tsp', 'fl_oz'].includes(i.unit_id)));
  if (!edition.unit_convention_id && usesCups) {
    root.append(el('div', { class: 'card warn stack' },
      el('strong', null, t('Quelle convention pour les tasses et cuillères de cette édition ?')),
      el('p', { class: 'muted', style: { margin: 0 } }, t('Des recettes de ce livre utilisent des tasses ou des cuillères. Sans convention confirmée, ces quantités restent affichées telles quelles.')),
      el('div', { class: 'row' }, select([{ value: '', label: t('Choisir…') }, ...listConventions().map((c) => ({ value: c.id, label: c.labels.fr }))], '', async (v) => { if (!v) return; await repo.save('book_editions', { ...edition, unit_convention_id: v, convention_evidence: 'confirmed_by_user' }); toast(t('Convention confirmée')); refresh(); }))));
  }

  const available = recipes.filter((r) => r.availability !== 'reference_only');
  const refs = recipes.filter((r) => r.availability === 'reference_only');
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    el('span', { class: 'status ok' }, t('{n} recette(s) disponible(s)', { n: available.length })),
    el('span', { class: 'status warn' }, t('{n} repérée(s) dans l’index', { n: refs.length })),
    el('span', { class: 'status info' }, t('{n} page(s) source', { n: pages.length }))));

  // Recettes
  const filterState = { mode: 'all', q: '' };
  const list = el('div', null);
  const drawList = () => {
    // Lot F (§ 4.2, D-T9) : le filtre redessine à chaque touche ; les URL des vignettes précédentes sont révoquées APRÈS le vidage, elles seules.
    remplacerEnRevoquant(list);
    let rows = recipes;
    if (filterState.mode === 'available') rows = available; if (filterState.mode === 'refs') rows = refs; if (filterState.mode === 'fav') rows = recipes.filter((r) => r.favorite);
    if (filterState.q) rows = rows.filter((r) => (r.original_title + ' ' + (r.display_title || '')).toLowerCase().includes(filterState.q.toLowerCase()));
    rows = [...rows].sort((a, b) => (a.printed_page ?? 99999) - (b.printed_page ?? 99999) || a.original_title.localeCompare(b.original_title));
    if (!rows.length) { list.append(emptyState('📖', t('Aucune recette dans cette vue. Photographie l’index ou une recette pour commencer.'))); return; }
    for (const r of rows) {
      const doc = ctx.docsByRecipe.get(r.id);
      list.append(recipeCard(doc || { recipe: r, version: null, book, edition }));
      // Lot C (D-C6) : la section lue dans la table des matières, en libellé discret, pour une `reference_only` seulement ; regrouper par section est
      // hors périmètre. Ronde 1 : lue par sectionLisible (une fiche reçue ou restaurée peut porter autre chose qu'une chaîne).
      const sectionLue = r.availability === 'reference_only' ? sectionLisible(r.section) : null;
      // Import ciblé (spec import-cible § 4.1, m4 ; D-8) : la rangée est SOUS la carte, hors du <a> — recipeCard met `extra` à l'intérieur, ce qui
      // faisait un lien dans un lien. Une référence ou une recette partielle SANS lien web s'importe par l'écran déjà rattaché (même règle que
      // « Relire les pages » de recipe.js : un signet devenu partiel n'a pas d'entrée, T4-R1) ; « Saisir à la main » reste.
      if ((r.availability === 'reference_only' || r.availability === 'partial') && !r.source_url) list.append(el('div', { class: 'row', style: { margin: '-.4rem 0 .8rem' } },
        el('a', { class: 'btn small', href: `#/recipes/${encodeURIComponent(r.id)}/importer` }, t('Importer')),
        el('a', { class: 'btn small', href: `#/recipes/${encodeURIComponent(r.id)}/edit?kind=extraction` }, t('Saisir à la main')),
        sectionLue ? el('span', { class: 'chip neutral', dataset: { role: 'section' } }, sectionLue) : null));
    }
  };
  const q = el('input', { type: 'search', placeholder: t('Filtrer les recettes de ce livre'), onInput: (e) => { filterState.q = e.target.value; drawList(); } });
  root.append(section(t('Recettes'),
    el('div', { class: 'row', style: { marginBottom: '.6rem' } },
      ...[['all', t('Toutes')], ['available', t('Disponibles')], ['refs', t('Repérées')], ['fav', t('Favoris')]].map(([v, l]) => el('button', { class: 'btn small', onClick: (e) => { filterState.mode = v; for (const b of e.target.parentNode.children) b.classList.remove('active'); e.target.classList.add('active'); drawList(); } }, l)),
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
  // C4 : chaque geste RELIT l'édition et n'écrit que SON champ. Réécrire `{ ...edition }` — l'édition lue au RENDU —
  // effaçait ce que l'autre geste de la même fiche venait d'écrire : enregistrer les métadonnées remettait le
  // `cover_sha256` d'avant (couverture perdue), et poser une couverture remettait les métadonnées d'avant.
  const ecrirePointeur = async (sha256) => {
    try {
      const courante = (await repo.get('book_editions', edition.id)) || edition;
      await repo.save('book_editions', { ...courante, cover_sha256: sha256 });
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
  root.append(section(t('Couverture'), zoneCouv));

  // Index : ajouter des entrées directement depuis la fiche du livre
  const indexPanel = indexEntriesPanel(null, ctx, () => [], { editionId: edition.id });
  const details = el('details', null, el('summary', { class: 'btn' }, t('Ajouter des entrées d’index à la main')), indexPanel);
  root.append(details);

  // Pages et documents
  if (docs.length) {
    const triees = [...pages].sort((a, b) => (a.printed_page ?? 9999) - (b.printed_page ?? 9999));
    const vignettes = await vignettesDePages(triees, ctxF);
    const thumbs = el('div', { class: 'thumbs' }, ...triees.map((p) => el('figure', null, vignettes.places.get(p.id),
      el('figcaption', null, p.printed_page ? `${t('p.')} ${p.printed_page}` : t('page non numérotée'), p.kind ? ` · ${p.kind === 'index' ? t('index') : t('recette')}` : ''))));
    root.append(section(t('Pages et fichiers sources'),
      el('p', { class: 'muted' }, t('{n} document(s). Les originaux restent consultables depuis chaque recette.', { n: docs.length })),
      boutonTelechargerPages(vignettes.distantes, { connecte: ctxF.connecte, telecharger: vignettes.telecharger }),
      thumbs,
      ...docs.filter((d) => d.source_type !== 'photo').map((d) => el('div', { class: 'row between card flat' }, el('span', null, `${d.original_filename} (${d.source_type.toUpperCase()})`), el('a', { class: 'btn small', href: `#/recipes/new?doc=${encodeURIComponent(d.id)}&edition=${encodeURIComponent(edition.id)}` }, t('Créer une recette depuis ce fichier'))))));
  }

  // Métadonnées
  const meta = { title: book.title, author: book.author || '', isbn: edition.isbn || '', publisher: edition.publisher || '', year: edition.year || '', language: edition.language || 'fr', convention: edition.unit_convention_id || '', cuisines: [...(book.cuisines || [])], tags: tagsDe(book.tags) }; // S2 : tagsDe rend toujours un tableau neuf
  const inp = (k, type = 'text') => el('input', { type, value: meta[k], onInput: (e) => { meta[k] = e.target.value; } });
  root.append(el('details', { class: 'card' }, el('summary', null, el('strong', null, t('Métadonnées et convention'))),
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
        // C4 : livre et édition RELUS juste avant l'écriture, et seuls les champs de CE formulaire sont écrits —
        // le `cover_sha256` posé entre le rendu et ce clic survit (il n'est pas dans ce formulaire).
        const courantLivre = (await repo.get('books', book.id)) || book;
        const courante = (await repo.get('book_editions', edition.id)) || edition;
        await repo.saveBatch({ books: [{ ...courantLivre, title: meta.title.trim() || courantLivre.title, author: meta.author.trim(), cuisines: [...meta.cuisines], tags: [...meta.tags] }],
          book_editions: [{ ...courante, isbn: meta.isbn.trim() || null, publisher: meta.publisher.trim() || null, year: meta.year ? parseInt(meta.year, 10) || null : null, language: meta.language, unit_convention_id: meta.convention || null, convention_evidence: meta.convention ? (courante.unit_convention_id === meta.convention ? courante.convention_evidence : 'confirmed_by_user') : null }] });
        toast(t('Enregistré')); refresh();
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
        navigate('/library');
      } }, t('Supprimer')) : el('small', { class: 'muted' }, t('Un livre avec des recettes ou des pages ne se supprime pas d’un geste.')))));
  return root;
}

export { promptDialog };
