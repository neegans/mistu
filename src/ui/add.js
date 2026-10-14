// Ajouter (spec UX § 4, § 10) : une grille de cinq cartes, et — avant un scan parti d'ici — la question « ces pages vont
// où ? ». Le formulaire « Ajouter un livre » vit dans livre-ajout.js (#/add/livre), le signet dans signet.js (#/add/signet).
import { el, pickFiles } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate } from '../core/router.js';
import { pageHeader, carte, libelleLivre, field, select } from './components.js';
import { startScanSession } from './import.js';

export const GRILLE_ACTIONS = ['ajouterLivre', 'pages', 'saisir', 'signet', 'congelateur'];
export const ACCEPT_PHOTOS = 'image/*';
export const ACCEPT_FICHIERS = 'image/*,application/pdf,application/epub+zip';

export function grilleModel() {
  return { cartes: [
    { action: 'ajouterLivre', ico: '📚', titre: t('Ajouter un livre'), sousTitre: t('ISBN (scan ou saisie), ou titre à la main') },
    { action: 'pages', ico: '📷', titre: t('Photographier ou importer des pages'), sousTitre: t('Caméra, photos ou PDF — pour une recette ou un index') },
    { action: 'saisir', ico: '✍️', titre: t('Saisir une recette'), sousTitre: t('À la main') },
    { action: 'signet', ico: '🔗', titre: t('Garder un lien web'), sousTitre: t('Une recette ou une page à retrouver') },
    { action: 'congelateur', ico: '🧊', titre: t('Ajouter un lot au congélateur'), sousTitre: t('Portions, date, recette source et méthode de réchauffage.') },
  ] };
}

// Une carte sans geste câblé n'est pas rendue (même garde que la porte d'entrée).
export function renderGrille(model, gestes = {}) {
  return el('div', { class: 'grid wide' },
    ...model.cartes.filter((c) => typeof gestes[c.action] === 'function').map((c) => carte(c.ico, c.titre, c.sousTitre, () => gestes[c.action]())));
}

// livres : [{ edition, book, activite }] ; editionImposee : id connu (I-F) ou null ; genre : 'recette' | 'index'.
export function selecteurScanModel({ livres = [], editionImposee = null, livreChoisi = '', genre = 'recette' } = {}) {
  const connu = editionImposee && livres.some((l) => l.edition.id === editionImposee) ? editionImposee : null; // S9
  const choisi = connu || livreChoisi || '';
  const tries = [...livres].sort((a, b) => (b.activite || 0) - (a.activite || 0) || libelleLivre(a.edition, a.book).localeCompare(libelleLivre(b.edition, b.book)));
  const options = [{ value: '', label: t('Recette indépendante (sans livre)') }, ...tries.map((l) => ({ value: l.edition.id, label: libelleLivre(l.edition, l.book) }))];
  const indexDisponible = !!choisi;
  return { options, livreChoisi: choisi, livreImpose: !!connu, genre: indexDisponible && genre === 'index' ? 'index' : 'recette', indexDisponible, messageIndex: indexDisponible ? null : t('Un index appartient à un livre : choisis-le d’abord.') };
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

export async function renderAdd(params, query, ctx) {
  const root = el('div', null, pageHeader(t('Ajouter')));
  const zone = el('div', null);
  root.append(zone);
  const activite = new Map();
  for (const a of ctx.library_activity || []) activite.set(a.edition_id, (activite.get(a.edition_id) || 0) + 1);
  const livres = ctx.book_editions.map((edition) => ({ edition, book: ctx.booksById.get(edition.book_id), activite: activite.get(edition.id) || 0 }));
  const editionImposee = query.edition && ctx.editionsById.has(query.edition) ? query.edition : null; // S9
  const etat = { livreChoisi: editionImposee || '', genre: 'recette' };
  const lancer = async (accept, capture) => {
    const files = await pickFiles({ accept, multiple: true, capture });
    if (files.length) await startScanSession(files, { edition_id: etat.livreChoisi || null, intention: etat.genre });
  };
  const gestesScan = {
    changerLivre: (v) => { etat.livreChoisi = v; dessinerSelecteur(); },
    changerGenre: (v) => { etat.genre = v; dessinerSelecteur(); },
    photographier: () => lancer(ACCEPT_PHOTOS, 'environment'),
    choisir: () => lancer(ACCEPT_FICHIERS, null),
    retour: () => dessinerGrille(),
  };
  // ?edition connu (« Scanner cette recette ») : le MÊME sélecteur, le livre déjà fixé (select désactivé, genre
  // « recette ») — « Photographier » est à une tape, sans écran de plus. Un seul chemin, donc aucune branche
  // morte à côté de celle que les tests éprouvent (F14, R-UX-6).
  const dessinerSelecteur = () => zone.replaceChildren(renderSelecteurScan(selecteurScanModel({ livres, editionImposee, livreChoisi: etat.livreChoisi, genre: etat.genre }), gestesScan));
  const dessinerGrille = () => zone.replaceChildren(renderGrille(grilleModel(), {
    ajouterLivre: () => navigate('/add/livre'),
    pages: () => dessinerSelecteur(),
    saisir: () => navigate('/recipes/new' + (editionImposee ? `?edition=${editionImposee}` : '')),
    signet: () => navigate('/add/signet'),
    congelateur: () => navigate('/kitchen?tab=inventory&add=1'),
  }));
  dessinerGrille();
  return root;
}
