// Ajouter (spec UX § 4, § 10) : une grille de six cartes (dont « Créer avec l'IA », qui ouvre #/recipes/creer — spec de création § 3.1),
// et — avant un scan parti d'ici — la question « ces pages vont où ? ». Le formulaire « Ajouter un livre » vit dans livre-ajout.js
// (#/add/livre), le signet dans signet.js (#/add/signet). Avant la grille, la section « Imports » (lot A « Importer une recette repérée »,
// spec import-cible § 4.5, tâche 6) : ce qui est en cours, à reprendre ou en échec dans le journal, et les photos conservées d'une séance — et,
// depuis le lot B (spec recette-web § 4.7), les lectures web (relancées et annulées par import-web.js).
import { el, pickFiles, toast as toastDom, formatDate, confirmDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate as naviguerDom } from '../core/router.js';
import { on } from '../core/bus.js';
import { logError } from '../core/log.js';
import { TransitionRefusee } from '../core/db.js';
import * as repoModule from '../model/repo.js';
import { lignesImports, dateReception } from '../domain/import-cible.js';
import { progressionLots, blocsImports, REFUS_ARRET_LOT } from '../domain/classement.js';
import { pageHeader, carte, libelleLivre, field, select } from './components.js';
import { startScanSession } from './import.js';
import { DOCUMENT_ID, lancerExtraction, annulerVol, phraseEchec, texteRefus, cleLecture, volEnCours } from './import-cible.js';
import { texteEchecClassement, lotEnCours, lireLeLot } from './regroupement.js';
import { lancerLecture, annulerLecture, texteEchecLecture } from './import-web.js';
import { texteEchecIndex } from './table-matieres.js';
import { texteEchecCouverture } from './livre-ajout.js';

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
  // Lot E (§ 4.6) : « Couverture photographiée », puis le titre lu (borné par lignesImports, rendu en nœud texte).
  if (l.titre.type === 'couverture') return t('Couverture photographiée') + (l.titre.texte ? ` — ${l.titre.texte}` : '');
  const livre = l.titre.livre ?? t('Sans livre');
  if (l.titre.type === 'classement') return t('Classement · {l}', { l: livre }); // lot D
  if (l.titre.type === 'seance') return t('Photos conservées : {n} page(s)', { n: l.pages }) + (l.titre.livre ? ` · ${l.titre.livre}` : '');
  if (l.titre.type === 'index') return t('Index · {l}', { l: livre });
  if (l.titre.type === 'regrouper' && l.lot) return l.lot.titre ?? t('Recette {k} sur {n}', { k: l.lot.rang, n: l.lot.total }); // lot D (§ 4.7) : une ligne de lot sans référence
  if (l.titre.type === 'regrouper') return t('Recette à regrouper · {l}', { l: livre });
  // Ronde 1 : le titre du signet (donnée reçue : ses Cf peuvent rester) est isolé dans un <bdi> — un U+202E n'y réordonne pas l'hôte recalculé (I-B5).
  if (l.titre.type === 'web' && !l.referenceAbsente) return [el('bdi', null, l.titre.texte ?? t('Sans titre')), ` — ${l.titre.livre ? t('Lien web · {h}', { h: l.titre.livre }) : t('Lien web')}`];
  return l.referenceAbsente ? t('(référence pas encore reçue)') : (l.titre.texte ?? t('Sans titre'));
}
// Lot D (§ 4.7) : « Recette {k} sur {n} » sous le titre d'une ligne de lot — sauf quand c'est déjà son titre (ligne sans référence ni lot.titre :
// titreLigne rend alors ce rang). Ronde 1 : décidé par la STRUCTURE de la ligne, jamais en comparant des textes rendus.
function rangDuLot(l) {
  if (!l.lot || (l.titre.type === 'regrouper' && !l.lot.titre)) return null;
  return el('small', { class: 'muted', dataset: { role: 'rang-lot' } }, t('Recette {k} sur {n}', { k: l.lot.rang, n: l.lot.total }));
}
// L'état dit en clair ; `brute` : la ligne du journal (sa date et son erreur, avec le nombre du quota ou « trop lourd » — que la ligne du domaine ne
// porte pas). I-4 : interrompu, annule et incertain disent la même phrase (phraseEchec, une définition avec l'écran ciblé, l'éditeur et le panneau).
function etatLigne(l, brute) {
  if (l.kind === 'seance') return null;
  // Lot E (P-10) : une couverture a ses phrases (spec couverture § 5) — jamais « 0 photo ajoutée », jamais « essaie avec moins de pages ».
  if (l.kind === 'couverture' && l.etat === 'a_lancer') return t('La couverture n’a pas encore été lue.');
  if (l.kind === 'couverture' && l.etat === 'en_cours' && !l.ailleurs) return t('Lecture de la couverture par l’assistant…');
  if (l.kind === 'couverture' && l.etat === 'echec') { const { texte, code } = texteEchecCouverture(brute?.erreur ?? { raison: l.raison }); return code ? `${texte} ${code}` : texte; }
  if (l.kind === 'classement') { // lot D (§ 4.7) : ce qui diffère d'une lecture de pages — « à lancer » et « ailleurs » suivent les règles communes ci-dessous (ronde 1)
    if (l.etat === 'en_cours' && !l.ailleurs) return t('Classement des photos par l’assistant…');
    if (l.etat === 'a_verifier') return t('Classement reçu le {d}', { d: formatDate(dateReception(brute), { withTime: true }) }); // comme « Lecture reçue le » (vague finale du lot A, m7) : jamais updated_at, que chaque geste du brouillon réécrit
    if (l.etat === 'echec') { const { texte, code } = texteEchecClassement(brute?.erreur ?? { raison: l.raison }); return code ? `${texte} ${code}` : texte; }
  }
  if (l.kind === 'web') { // lot B : ni photos ni pages ; l'échec dit le texte de l'écran de lecture (texteEchecLecture, une définition, I-B6)
    if (l.etat === 'a_lancer') return t('L’app n’a pas encore lu la page.');
    if (l.etat === 'en_cours') return l.ailleurs ? t('En cours sur un autre écran') : t('Lecture de la page par l’assistant…');
    if (l.etat === 'echec') { const { texte, code } = texteEchecLecture(brute?.erreur ?? { raison: l.raison }); return code ? `${texte} ${code}` : texte; }
  }
  if (l.etat === 'a_lancer') return l.pages <= 1 ? t('{n} photo ajoutée', { n: l.pages }) : t('{n} photos ajoutées', { n: l.pages });
  if (l.etat === 'en_cours') return l.ailleurs ? t('En cours sur un autre écran') : t('Lecture des pages par l’assistant…');
  if (l.etat === 'a_verifier') return t('Lecture reçue le {d}', { d: formatDate(dateReception(brute), { withTime: true }) }); // vague finale (m7) : jamais updated_at
  if (l.etat === 'echec' && l.kind === 'index') { const { texte, code } = texteEchecIndex(brute?.erreur ?? { raison: l.raison }); return code ? `${texte} ${code}` : texte; } // lot C (D-C1, vague finale, constat 3) : la phrase du panneau d'index
  if (l.etat === 'echec') return phraseEchec(brute?.erreur ?? { raison: l.raison });
  return null;
}
const LIBELLES = { reprendre: () => t('Reprendre'), relancer: () => t('Relancer'), annuler: () => t('Annuler'), ignorer: () => t('Ignorer'), ouvrir_seance: () => t('Ouvrir la séance') };
// Lot B (spec recette-web § 4.7) : pour une lecture web, le geste « relancer » s'appelle « Réessayer ».
const libelle = (g, l) => (g === 'relancer' && l.kind === 'web' ? t('Réessayer') : LIBELLES[g]());
// Le vol d'une ligne, par sorte (ronde 1) : une lecture web part et s'annule par import-web.js, une lecture de pages par import-cible.js (lot A). Les
// deux « annuler » agissent sur LE vol partagé de vol.js (seuls l'étiquette du journal et les abonnés notifiés diffèrent : non observable ici).
const volDe = (l) => (l.kind === 'web' ? { lancer: lancerLecture, annuler: annulerLecture } : { lancer: lancerExtraction, annuler: annulerVol });
// Ce qu'un « Relancer » (ou « Réessayer ») refusé dit : texteRefus (src/ui/import-cible.js, une définition, le refus `interdit` d'une lecture
// web compris) ; un refus sans phrase (ligne changée ailleurs) se voit au redessin.

// La section : absente quand il n'y a rien ; sinon une ligne par import ouvert et par séance libre, avec ses gestes (.btn, ≥ 44 px). Le premier dessin
// vient du contexte de la route (getData charge imports et scan_sessions : sans eux, la page ne lit aucune base) ; chaque écriture du journal ou des
// séances (bus `change`) et chaque geste la redessinent DEPUIS LA BASE : un vol lancé d'ici montre « Annuler » tant qu'il court, puis son issue. Le
// focus d'un geste survit au redessin (même ligne, même geste), sinon il revient à la section.
// Dépendances injectables { repo, navigate, toast, fetch, maintenant, battementMs, confirmer } : la suite n'ouvre ni réseau, ni routeur, ni dialogue.
function sectionImports(ctx, { repo, navigate, toast, fetch, maintenant, battementMs, confirmer }) {
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
    if (geste === 'annuler') await volDe(l).annuler(l.id); // rien si ce document ne tient pas ce vol : le redessin dit l'état réel
    else if (geste === 'ignorer') {
      // « Ignorer » vaut pour LA lecture affichée (T4-R2, ronde 1) : une ligne relancée ailleurs depuis le dessin (autre lecture, autre départ) n'est pas
      // ignorée sans avoir été vue — le redessin la montre, et un second « Ignorer » vaudra pour elle.
      // Lot D, ronde 1 de T2 (I-D4, D-D20) : un classement REÇU s'ignore ici comme dans le panneau — la même question (il a coûté un appel ; « non » → rien
      // d'écrit), et son brouillon effacé avec lui.
      // Vague finale (revue de branche, constat 2) : un « non » ne sort plus avant le redessin — CHAQUE geste finit par un redessin depuis la base (le fait
      // qu'un test attend, jamais des ticks : R-D-10).
      const classement = l.kind === 'classement';
      const refuse = classement && brute?.status === 'a_verifier' && !(await confirmer(t('Ignorer ce classement ? Il a coûté un appel ; le refaire en coûtera un autre.'), { okLabel: t('Ignorer') }));
      const cle = cleLecture(brute);
      const patch = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', l.id, c.status); return { status: 'ignore', finished_at: maintenant(), ...(classement ? { brouillon: null } : {}) }; };
      if (!refuse) {
        try { await repo.transitionner('imports', l.id, { attendus: ATTENDUS_IGNORER, patch }); }
        catch (e) { if (!(e instanceof TransitionRefusee)) logError('add.ignorer', { error: e, id: l.id }); }
      }
    } else if (geste === 'relancer') {
      // UN appel par le vol de l'écran ciblé (spec § 4.5) : aucune page ni séance n'est écrite ; la ligne s'arrête à a_verifier (« Reprendre » ensuite).
      // Lot B : une lecture web repart par lancerLecture (même forme de retour), aussi depuis une ligne d'un autre appareil (§ 4.7).
      const r = await volDe(l).lancer(l.id, { ctx, repo, fetch, maintenant, battementMs });
      const dit = r.issue === 'refuse' ? texteRefus(r) : null;
      if (dit) toast(dit);
    }
    await redessiner();
  }
  // Lot D (§ 4.7, D-D22) : un bloc par lot — l'en-tête (« Lot de {n} recettes · {l} », la progression sur TOUTES les lignes relues), « Lecture du lot en
  // cours… » quand CE document lit ce lot, sinon « Continuer la lecture ({r} appels) » s'il reste des lignes à lancer ICI et qu'aucun vol ni lot n'est
  // tenu (un lot par document : lireLeLot refuserait) ; puis ses lignes, par rang. La prise et la libération du lot passent par le bus : la section se
  // redessine seule, même pour un lot lancé ailleurs (« Lire ces recettes »).
  // Ronde 1 : un arrêt sur un REFUS (hors ligne, sans session, vol tenu ailleurs : REFUS_ARRET_LOT) n'écrit rien — il est DIT, comme le refus de
  // « Relancer » (texteRefus) ; un échec écrit (quota, requête…) se voit sur sa ligne.
  async function continuer(classementId) {
    try {
      const r = await lireLeLot(classementId, { ctx, repo, fetch, maintenant, battementMs });
      if (REFUS_ARRET_LOT.includes(r?.arret)) toast(texteRefus({ issue: 'refuse', raison: r.arret }));
    } catch (e) { logError('add.lot', { error: e, id: classementId }); }
    await redessiner();
  }
  function blocLot(b, p, brutes) {
    const n = p?.total ?? b.lignes.length;
    const livre = b.lignes[0]?.titre?.livre ?? t('Sans livre');
    const lues = t('{k} sur {n} lues', { k: p?.lues ?? 0, n });
    const r = p?.restantesIci ?? 0;
    const geste = lotEnCours()?.classementId === b.classementId
      ? el('div', { class: 'status', role: 'status' }, t('Lecture du lot en cours…'))
      : (r > 0 && !volEnCours() && !lotEnCours()
        ? el('button', { type: 'button', class: 'btn primary', dataset: { geste: 'continuer' }, onClick: () => continuer(b.classementId) }, r === 1 ? t('Continuer la lecture (1 appel)') : t('Continuer la lecture ({r} appels)', { r }))
        : null);
    return el('div', { class: 'card flat stack', dataset: { role: 'lot', classement: b.classementId } },
      el('div', { class: 'row between' }, el('strong', null, n === 1 ? t('Lot de 1 recette · {l}', { l: livre }) : t('Lot de {n} recettes · {l}', { n, l: livre })),
        el('span', { class: 'muted' }, p?.echecs ? `${lues} ${t('· {e} en échec', { e: p.echecs })}` : lues)),
      geste, ...b.lignes.map((l) => ligneEl(l, brutes.get(l.id))));
  }
  function ligneEl(l, brute) {
    const etat = etatLigne(l, brute);
    return el('div', { class: 'card flat stack', dataset: { role: 'ligne-import', id: l.id } },
      el('div', { class: 'row between' }, el('strong', null, titreLigne(l)), el('span', { class: 'muted' }, ageTexte(l.age))),
      rangDuLot(l),
      etat ? el('span', { class: l.etat === 'echec' ? 'status warn' : 'muted' }, etat) : null,
      l.autreAppareil && l.kind !== 'seance' && l.kind !== 'web' ? el('small', { class: 'muted' }, t('Photos sur un autre appareil')) : null,
      l.gestes.length ? el('div', { class: 'row' }, ...l.gestes.map((g) => el('button', { type: 'button', class: g === 'reprendre' || g === 'ouvrir_seance' ? 'btn primary' : 'btn', dataset: { geste: g }, onClick: () => agir(g, l, brute) }, libelle(g, l)))) : null);
  }
  function dessiner({ imports = [], scan_sessions = [], recipesById = ctx?.recipesById } = {}) {
    const brutes = new Map((Array.isArray(imports) ? imports : []).filter((i) => i && typeof i.id === 'string').map((i) => [i.id, i]));
    const lignes = lignesImports({ ...ctx, imports, scan_sessions, recipesById }, { maintenant: maintenant(), documentId: DOCUMENT_ID, deviceId: repo.deviceId() });
    const actif = hote.contains(document.activeElement) ? document.activeElement : null;
    const repere = actif ? { id: actif.closest('[data-role="ligne-import"]')?.dataset.id ?? null, lot: actif.closest('[data-role="lot"]')?.dataset.classement ?? null, geste: actif.dataset?.geste ?? null } : null;
    if (!lignes.length) { hote.replaceChildren(); return; }
    const progression = progressionLots(imports, { deviceId: repo.deviceId(), recipesById }); // lot D : sur TOUTES les lignes relues ; ronde 1 : les références relues
    const section = el('section', { class: 'card stack', tabindex: '-1', dataset: { role: 'imports' } }, el('h2', null, t('Imports')),
      ...blocsImports(lignes).map((b) => (b.type === 'lot' ? blocLot(b, progression.get(b.classementId), brutes) : ligneEl(b.ligne, brutes.get(b.ligne.id)))));
    hote.replaceChildren(section);
    // Ronde 1 : un geste de BLOC de lot (« Continuer », hors de toute ligne) garde aussi son focus, retrouvé par le classement de son bloc.
    if (repere) ((repere.id && repere.geste && section.querySelector(`[data-role="ligne-import"][data-id="${CSS.escape(repere.id)}"] button[data-geste="${CSS.escape(repere.geste)}"]`))
      || (!repere.id && repere.lot && repere.geste && section.querySelector(`[data-role="lot"][data-classement="${CSS.escape(repere.lot)}"] > button[data-geste="${CSS.escape(repere.geste)}"]`))
      || section).focus();
  }
  return { hote, redessiner, dessiner };
}

export async function renderAdd(params, query, ctx, { repo = repoModule, navigate = naviguerDom, toast = toastDom, fetch = undefined, maintenant = () => new Date().toISOString(), battementMs = undefined, veilleMs = repoModule.BATTEMENT_MORT_MS + 1000, confirmer = confirmDialog } = {}) {
  const root = el('div', null, pageHeader(t('Ajouter')));
  const zone = el('div', null);
  const imports = sectionImports(ctx, { repo, navigate, toast, fetch, maintenant, battementMs, confirmer });
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
  // Vague finale (m1) : puis une fois encore après BATTEMENT_MORT_MS (+ 1 s) si la page est toujours montée — une ligne dont le document vient de mourir
  // (battement de moins de 90 s à l'affichage : PWA tuée puis relancée) est levée sans quitter la page.
  const passeInterrompus = () => repo.marquerInterrompus().then((n) => { if (n) imports.redessiner(); }).catch((e) => logError('add.interrompus', { error: e }));
  if ((ctx?.imports || []).some((i) => i?.status === 'en_cours') && typeof repo.marquerInterrompus === 'function') { passeInterrompus(); setTimeout(() => { if (root.isConnected) passeInterrompus(); }, veilleMs); }
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
