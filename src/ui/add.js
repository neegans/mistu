// Ajouter (spec UX § 4, § 10) : une grille de six cartes (dont « Créer avec l'IA », qui ouvre #/recipes/creer — spec de création § 3.1),
// et — avant un scan parti d'ici — la question « ces pages vont où ? ». Le formulaire « Ajouter un livre » vit dans livre-ajout.js
// (#/add/livre), le signet dans signet.js (#/add/signet). Avant la grille, la section « Imports » (lot A « Importer une recette repérée »,
// spec import-cible § 4.5, tâche 6) : ce qui est en cours, à reprendre ou en échec dans le journal, et les photos conservées d'une séance.
import { el, pickFiles, toast as toastDom, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate as naviguerDom } from '../core/router.js';
import { on } from '../core/bus.js';
import { logError } from '../core/log.js';
import { TransitionRefusee } from '../core/db.js';
import * as repoModule from '../model/repo.js';
import { lignesImports } from '../domain/import-cible.js';
import { pageHeader, carte, libelleLivre, field, select } from './components.js';
import { startScanSession } from './import.js';
import { DOCUMENT_ID, lancerExtraction, annulerVol, phraseEchec, texteRefus, cleLecture } from './import-cible.js';

export const GRILLE_ACTIONS = ['ajouterLivre', 'pages', 'saisir', 'signet', 'creerIA', 'congelateur'];
export const ACCEPT_PHOTOS = 'image/*';
export const ACCEPT_FICHIERS = 'image/*,application/pdf,application/epub+zip';

export function grilleModel() {
  return { cartes: [
    { action: 'ajouterLivre', ico: '📚', titre: t('Ajouter un livre'), sousTitre: t('ISBN (scan ou saisie), ou titre à la main') },
    { action: 'pages', ico: '📷', titre: t('Photographier ou importer des pages'), sousTitre: t('Caméra, photos ou PDF — pour une recette ou un index') },
    { action: 'saisir', ico: '✍️', titre: t('Saisir une recette'), sousTitre: t('À la main') },
    { action: 'signet', ico: '🔗', titre: t('Garder un lien web'), sousTitre: t('Une recette ou une page à retrouver') },
    { action: 'creerIA', ico: '✨', titre: t('Créer avec l’IA'), sousTitre: t('Une proposition à vérifier') },
    { action: 'congelateur', ico: '🧊', titre: t('Ajouter un lot au congélateur'), sousTitre: t('Portions, date, recette source et méthode de réchauffage.') },
  ] };
}

// Une carte sans geste câblé n'est pas rendue (même garde que la porte d'entrée).
export function renderGrille(model, gestes = {}) {
  return el('div', { class: 'grid wide' },
    ...model.cartes.filter((c) => typeof gestes[c.action] === 'function').map((c) => carte(c.ico, c.titre, c.sousTitre, () => gestes[c.action]())));
}

// livres : [{ edition, book, recence }] ; editionImposee : id connu (I-F) ou null ; genre : 'recette' | 'index'.
// `recence` (C8) = l'instant de la DERNIÈRE activité du livre, pas un nombre d'ouvertures : compter rangeait en tête
// un livre consulté dix fois l'an dernier, devant celui d'hier — or on scanne la suite de ce qu'on vient d'ouvrir.
export function selecteurScanModel({ livres = [], editionImposee = null, livreChoisi = '', genre = 'recette' } = {}) {
  const connu = editionImposee && livres.some((l) => l.edition.id === editionImposee) ? editionImposee : null; // S9
  const choisi = connu || livreChoisi || '';
  const tries = [...livres].sort((a, b) => (b.recence || 0) - (a.recence || 0) || libelleLivre(a.edition, a.book).localeCompare(libelleLivre(b.edition, b.book)));
  const options = [{ value: '', label: t('Recette indépendante (sans livre)') }, ...tries.map((l) => ({ value: l.edition.id, label: libelleLivre(l.edition, l.book) }))];
  const indexDisponible = !!choisi;
  return { options, livreChoisi: choisi, livreImpose: !!connu, genre: indexDisponible && genre === 'index' ? 'index' : 'recette', indexDisponible, messageIndex: indexDisponible ? null : t('Un index appartient à un livre : choisis-le d’abord.') };
}

// Ce qui part vraiment à la séance de scan, décidé par le MÊME modèle que l'écran (R-UX-7). L'état brut de la page
// peut porter un genre « index » devenu impossible depuis — le livre a été remis à « sans livre », l'écran affiche
// déjà « recette » — et une édition imposée n'a jamais transité par cet état. Sans ce détour, la séance recevrait
// une intention que personne n'a vue cochée.
export function parametresDeScan(etat) {
  const m = selecteurScanModel(etat);
  return { edition_id: m.livreChoisi || null, intention: m.genre };
}

export function renderSelecteurScan(model, gestes = {}) {
  const radio = (valeur, libelle, disabled) => el('label', { class: 'check' },
    el('input', { type: 'radio', name: 'genre', value: valeur, checked: model.genre === valeur, disabled, onChange: () => gestes.changerGenre && gestes.changerGenre(valeur) }), ' ', libelle);
  const sel = select(model.options, model.livreChoisi, (v) => gestes.changerLivre && gestes.changerLivre(v));
  sel.disabled = model.livreImpose;
  return el('section', { class: 'card stack selecteur-scan' },
    el('h2', null, t('Ces pages vont où ?')),
    field(t('Livre'), sel),
    el('div', { class: 'stack' }, el('span', null, t('Genre de pages')),
      radio('recette', t('Page(s) de recette'), false), radio('index', t('Index ou table des matières'), !model.indexDisponible),
      model.messageIndex ? el('small', { class: 'muted' }, model.messageIndex) : null),
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn primary', onClick: () => gestes.photographier && gestes.photographier() }, t('Photographier')),
      el('button', { type: 'button', class: 'btn', onClick: () => gestes.choisir && gestes.choisir() }, t('Choisir des photos ou un PDF')),
      el('button', { type: 'button', class: 'btn link', onClick: () => gestes.retour && gestes.retour() }, t('← Retour'))));
}

// --- Section « Imports » (spec import-cible § 4.5) : les lignes viennent du domaine (lignesImports, pur) ; ici seulement leurs textes et leurs gestes.
const ATTENDUS_IGNORER = ['a_lancer', 'a_verifier', 'echec']; // « Ignorer » n'est jamais offert pendant un vol (§ 3.1 : en_cours → echec seulement)
const ageTexte = (age) => (age?.unite === 'j' ? t('il y a {n} j', { n: age.n }) : age?.unite === 'h' ? t('il y a {n} h', { n: age.n }) : t('il y a {n} min', { n: age?.n ?? 0 }));
function titreLigne(l) {
  const livre = l.titre.livre ?? t('Sans livre');
  if (l.titre.type === 'seance') return t('Photos conservées : {n} page(s)', { n: l.pages }) + (l.titre.livre ? ` · ${l.titre.livre}` : '');
  if (l.titre.type === 'index') return t('Index · {l}', { l: livre });
  if (l.titre.type === 'regrouper') return t('Recette à regrouper · {l}', { l: livre });
  return l.referenceAbsente ? t('(référence pas encore reçue)') : (l.titre.texte ?? t('Sans titre'));
}
// L'état dit en clair ; `brute` : la ligne du journal (sa date et son erreur, avec le nombre du quota ou « trop lourd » — que la ligne du domaine ne
// porte pas). I-4 : interrompu, annule et incertain disent la même phrase (phraseEchec, une définition avec l'écran ciblé, l'éditeur et le panneau).
function etatLigne(l, brute) {
  if (l.kind === 'seance') return null;
  if (l.etat === 'a_lancer') return l.pages <= 1 ? t('{n} photo ajoutée', { n: l.pages }) : t('{n} photos ajoutées', { n: l.pages });
  if (l.etat === 'en_cours') return l.ailleurs ? t('En cours sur un autre écran') : t('Lecture des pages par l’assistant…');
  if (l.etat === 'a_verifier') return t('Lecture reçue le {d}', { d: formatDate(brute?.updated_at, { withTime: true }) });
  if (l.etat === 'echec') return phraseEchec(brute?.erreur ?? { raison: l.raison });
  return null;
}
const LIBELLES = { reprendre: () => t('Reprendre'), relancer: () => t('Relancer'), annuler: () => t('Annuler'), ignorer: () => t('Ignorer'), ouvrir_seance: () => t('Ouvrir la séance') };
// Ce qu'un « Relancer » refusé dit : texteRefus (src/ui/import-cible.js, une définition) ; un refus sans phrase (ligne changée ailleurs) se voit au redessin.

// La section : absente quand il n'y a rien ; sinon une ligne par import ouvert et par séance libre, avec ses gestes (.btn, ≥ 44 px). Le premier dessin
// vient du contexte de la route (getData charge imports et scan_sessions : sans eux, la page ne lit aucune base) ; chaque écriture du journal ou des
// séances (bus `change`) et chaque geste la redessinent DEPUIS LA BASE : un vol lancé d'ici montre « Annuler » tant qu'il court, puis son issue. Le
// focus d'un geste survit au redessin (même ligne, même geste), sinon il revient à la section.
// Dépendances injectables { repo, navigate, toast, fetch, maintenant, battementMs } : la suite n'ouvre ni réseau ni routeur.
function sectionImports(ctx, { repo, navigate, toast, fetch, maintenant, battementMs }) {
  const hote = el('div', null);
  let file = Promise.resolve();
  // Ronde 1 : les références visées sont relues aussi — une fiche reçue (synchro) pendant que la page est montée donne son titre et ses gestes au redessin.
  const lireBase = async () => {
    const [imports, scan_sessions] = await Promise.all([repo.all('imports'), repo.all('scan_sessions')]);
    const ids = [...new Set((Array.isArray(imports) ? imports : []).map((i) => i?.recipe_id).filter((id) => typeof id === 'string' && id))];
    const recipesById = new Map(ctx?.recipesById instanceof Map ? ctx.recipesById : []);
    for (const [id, r] of await Promise.all(ids.map(async (id) => [id, await repo.get('recipes', id)]))) { if (r) recipesById.set(id, r); else recipesById.delete(id); }
    return { imports, scan_sessions, recipesById };
  };
  const redessiner = () => { file = file.then(async () => dessiner(await lireBase())).catch((e) => logError('add.imports', { error: e })); return file; };
  async function agir(geste, l, brute) {
    if (geste === 'reprendre' || geste === 'ouvrir_seance') { if (l.cible) navigate(l.cible); return; }
    if (geste === 'annuler') await annulerVol(l.id); // rien si ce document ne tient pas ce vol : le redessin dit l'état réel
    else if (geste === 'ignorer') {
      // « Ignorer » vaut pour LA lecture affichée (T4-R2, ronde 1) : une ligne relancée ailleurs depuis le dessin (autre lecture, autre départ) n'est pas
      // ignorée sans avoir été vue — le redessin la montre, et un second « Ignorer » vaudra pour elle.
      const cle = cleLecture(brute);
      const patch = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', l.id, c.status); return { status: 'ignore', finished_at: maintenant() }; };
      try { await repo.transitionner('imports', l.id, { attendus: ATTENDUS_IGNORER, patch }); }
      catch (e) { if (!(e instanceof TransitionRefusee)) logError('add.ignorer', { error: e, id: l.id }); }
    } else if (geste === 'relancer') {
      // UN appel par le vol de l'écran ciblé (spec § 4.5) : aucune page ni séance n'est écrite ; la ligne s'arrête à a_verifier (« Reprendre » ensuite).
      const r = await lancerExtraction(l.id, { ctx, repo, fetch, maintenant, battementMs });
      const dit = r.issue === 'refuse' ? texteRefus(r) : null;
      if (dit) toast(dit);
    }
    await redessiner();
  }
  function ligneEl(l, brute) {
    const etat = etatLigne(l, brute);
    return el('div', { class: 'card flat stack', dataset: { role: 'ligne-import', id: l.id } },
      el('div', { class: 'row between' }, el('strong', null, titreLigne(l)), el('span', { class: 'muted' }, ageTexte(l.age))),
      etat ? el('span', { class: l.etat === 'echec' ? 'status warn' : 'muted' }, etat) : null,
      l.autreAppareil && l.kind !== 'seance' ? el('small', { class: 'muted' }, t('Photos sur un autre appareil')) : null,
      l.gestes.length ? el('div', { class: 'row' }, ...l.gestes.map((g) => el('button', { type: 'button', class: g === 'reprendre' || g === 'ouvrir_seance' ? 'btn primary' : 'btn', dataset: { geste: g }, onClick: () => agir(g, l, brute) }, LIBELLES[g]()))) : null);
  }
  function dessiner({ imports = [], scan_sessions = [], recipesById = ctx?.recipesById } = {}) {
    const brutes = new Map((Array.isArray(imports) ? imports : []).filter((i) => i && typeof i.id === 'string').map((i) => [i.id, i]));
    const lignes = lignesImports({ ...ctx, imports, scan_sessions, recipesById }, { maintenant: maintenant(), documentId: DOCUMENT_ID, deviceId: repo.deviceId() });
    const actif = hote.contains(document.activeElement) ? document.activeElement : null;
    const repere = actif ? { id: actif.closest('[data-role="ligne-import"]')?.dataset.id ?? null, geste: actif.dataset?.geste ?? null } : null;
    if (!lignes.length) { hote.replaceChildren(); return; }
    const section = el('section', { class: 'card stack', tabindex: '-1', dataset: { role: 'imports' } }, el('h2', null, t('Imports')), ...lignes.map((l) => ligneEl(l, brutes.get(l.id))));
    hote.replaceChildren(section);
    if (repere) ((repere.id && repere.geste && section.querySelector(`[data-role="ligne-import"][data-id="${CSS.escape(repere.id)}"] button[data-geste="${CSS.escape(repere.geste)}"]`)) || section).focus();
  }
  return { hote, redessiner, dessiner };
}

export async function renderAdd(params, query, ctx, { repo = repoModule, navigate = naviguerDom, toast = toastDom, fetch = undefined, maintenant = () => new Date().toISOString(), battementMs = undefined } = {}) {
  const root = el('div', null, pageHeader(t('Ajouter')));
  const zone = el('div', null);
  const imports = sectionImports(ctx, { repo, navigate, toast, fetch, maintenant, battementMs });
  root.append(imports.hote, zone); // la section AVANT la grille (spec § 4.5)
  imports.dessiner({ imports: ctx?.imports, scan_sessions: ctx?.scan_sessions });
  // Redessin à chaque écriture du journal ou des séances, tant que la page est montée ; désabonné dès qu'elle ne l'est plus (ou ne l'a jamais été).
  let montee = false;
  const desabonner = on('change', ({ store } = {}) => {
    if (!root.isConnected) { if (montee) desabonner(); return; }
    montee = true;
    if (store === 'imports' || store === 'scan_sessions' || store === 'recipes' || store === '*') imports.redessiner();
  });
  // Ronde 1 : la passe `interrompu` du démarrage est rejouée à l'affichage quand le journal porte un vol (repo.marquerInterrompus, mêmes règles) : un
  // rechargement dans les 90 s, ou une ligne d'un appareil perdu, ne reste plus bloqué « En cours… » sans geste jusqu'au prochain démarrage.
  // Le redessin suit la passe elle-même (et pas seulement le bus) : finie avant que la page soit montée, elle serait sinon perdue.
  if ((ctx?.imports || []).some((i) => i?.status === 'en_cours') && typeof repo.marquerInterrompus === 'function') repo.marquerInterrompus().then((n) => { if (n) imports.redessiner(); }).catch((e) => logError('add.interrompus', { error: e }));
  // ?section=imports (fiche du livre, « {n} imports à reprendre » ; parseHash ne porte pas d'ancre, m3) : la section reçoit le focus une fois montée.
  setTimeout(() => {
    if (!root.isConnected) { desabonner(); return; }
    montee = true;
    if (query?.section === 'imports') root.querySelector('[data-role="imports"]')?.focus();
  }, 0);
  // C8 : la RÉCENCE, pas le nombre — l'instant de la dernière activité de chaque livre. Une date illisible (fiche
  // venue d'ailleurs, I-G) ne compte pas plutôt que de valoir « 1970 ».
  const recence = new Map();
  for (const a of ctx.library_activity || []) {
    const quand = Date.parse(a.occurred_at || '');
    if (!Number.isFinite(quand)) continue;
    if (quand > (recence.get(a.edition_id) || 0)) recence.set(a.edition_id, quand);
  }
  const livres = ctx.book_editions.map((edition) => ({ edition, book: ctx.booksById.get(edition.book_id), recence: recence.get(edition.id) || 0 }));
  // D-8 (lot import ciblé) : plus de `?edition` lu dans l'adresse — son seul appelant, « Scanner cette recette », a disparu (R-UX-16 retiré) ;
  // le livre se choisit dans le sélecteur. `/recipes/new?edition=` (saisie à la main depuis la fiche du livre) reste.
  const etat = { livreChoisi: '', genre: 'recette' };
  const lancer = async (accept, capture) => {
    const files = await pickFiles({ accept, multiple: true, capture });
    if (files.length) await startScanSession(files, parametresDeScan({ livres, livreChoisi: etat.livreChoisi, genre: etat.genre }));
  };
  const gestesScan = {
    changerLivre: (v) => { etat.livreChoisi = v; dessinerSelecteur(); },
    changerGenre: (v) => { etat.genre = v; dessinerSelecteur(); },
    photographier: () => lancer(ACCEPT_PHOTOS, 'environment'),
    choisir: () => lancer(ACCEPT_FICHIERS, null),
    retour: () => dessinerGrille(),
  };
  const dessinerSelecteur = () => zone.replaceChildren(renderSelecteurScan(selecteurScanModel({ livres, livreChoisi: etat.livreChoisi, genre: etat.genre }), gestesScan));
  const dessinerGrille = () => zone.replaceChildren(renderGrille(grilleModel(), {
    ajouterLivre: () => navigate('/add/livre'),
    pages: () => dessinerSelecteur(),
    saisir: () => navigate('/recipes/new'),
    signet: () => navigate('/add/signet'),
    creerIA: () => navigate('/recipes/creer'),
    congelateur: () => navigate('/kitchen?tab=inventory&add=1'),
  }));
  dessinerGrille();
  return root;
}
