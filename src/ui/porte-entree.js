// Porte d'entrée (spec § 11, R34) : l'écran d'accueil du premier lancement. Première ligne du côté de la personne
// — « Kwe. » et ce que l'app fait pour elle — jamais le mot « synchronisation », qui décrit le système.
// Évaluée au DÉMARRAGE seulement (src/app.js) : se déconnecter depuis Réglages ne la rouvre pas en cours de route.
// L'app reste utilisable sans compte (invariant I4) : « Continuer sans compte » est offert dans tous les cas.
import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';

// Les trois seuls gestes de la porte. Le modèle ne peut nommer qu'eux, et le rendu ignore une action inconnue :
// un renommage donne un bouton manquant (visible), jamais un bouton muet.
export const PORTE_ACTIONS = ['signIn', 'signOut', 'sansCompte'];

// Modèle pur : aucun DOM, aucune base, aucun réseau. Il décide si la porte s'affiche, et ce qu'elle dit.
// Les quatre « non » valent plus que l'écran lui-même : une porte qui s'affiche quand elle ne doit pas enfermerait
// la personne dehors à chaque lancement.
export function porteEntreeModel({ available = false, user = null, guard = null, retour = null, enAttente = false, choixSansCompte = false } = {}) {
  const titre = t('Kwe.');
  const fermee = { afficher: false, titre, lignes: [], boutons: [] };
  // Rien où se connecter : hôte non listé (S1) ou bibliothèque absente. Réglages le dit déjà, à sa place.
  if (!available) return fermee;
  // R28/R30 : le démarrage borné n'a pas abouti — le compte n'est pas CONNU. Barrer l'entrée sur un état qui n'est
  // pas établi serait un état sans événement réel (invariant I5) : l'app s'ouvre, Réglages dit la vérification.
  if (enAttente) return fermee;
  if (user && guard?.ok) return fermee;
  // La personne a tranché sur cet appareil : plus jamais cette porte, quel que soit le reste (R34).
  if (choixSansCompte) return fermee;

  const lignes = [];
  const boutons = [];
  if (guard && guard.ok === false) {
    // Session ouverte mais adresse refusée : la porte reste, avec la sortie douce. Le geste destructeur
    // (« Changer de compte sur cet appareil ») vit dans Réglages, pas sur un écran de premier lancement.
    lignes.push(guard.message || t('Cet appareil ne peut pas vérifier le compte.'));
    boutons.push({ action: 'signOut', label: t('Essayer un autre compte'), tone: 'primary' });
    boutons.push({ action: 'sansCompte', label: t('Continuer sans compte'), tone: 'link' });
  } else {
    lignes.push(t('Ta bibliothèque de recettes, sur tous tes appareils.'));
    boutons.push({ action: 'signIn', label: t('Connexion avec Google'), tone: 'primary' });
    boutons.push({ action: 'sansCompte', label: t('Continuer sans compte'), tone: 'link' });
  }
  // Retour du fournisseur : dit après l'état, sans jamais prétendre en connaître la cause. `retour.error` est déjà
  // une phrase fixe d'auth.js — jamais le texte d'un fournisseur.
  if (retour?.codeSansSession) lignes.push(t('La connexion n’a pas abouti.'));
  if (retour?.error) lignes.push(retour.error);
  return { afficher: true, titre, lignes, boutons };
}

// Le « G » de Google, en SVG inline : aucune image externe (CSP `img-src 'self'`), aucune police importée.
// Construit nœud par nœud (createElementNS) : pas d'innerHTML, même pour une constante.
const G_PATHS = [
  ['M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z', '#4285f4'],
  ['M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z', '#34a853'],
  ['M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z', '#fbbc05'],
  ['M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z', '#ea4335'],
];

function logoGoogle() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'porte-g');
  for (const [d, fill] of G_PATHS) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    svg.append(path);
  }
  return svg;
}

// Rendu : le modèle dit quoi écrire et quels gestes offrir ; les gestes sont câblés par l'appelant (src/app.js).
// Une action que l'appelant ne câble pas n'apparaît pas : un bouton manquant se voit, un bouton muet trompe.
// Chemin de l'icône, relatif comme tout le reste de l'app (elle peut être servie depuis un sous-chemin :
// `/mistu/` sur GitHub Pages). Il est injectable uniquement pour que la page de tests, qui vit dans `tests/`,
// n'aille pas chercher une image un dossier trop bas — la valeur par défaut est ce que l'app affiche.
export const ICONE_APP = './icons/icon.svg';

export function renderPorteEntree(model, gestes = {}, { icone = ICONE_APP } = {}) {
  const offerts = model.boutons.filter((b) => Object.hasOwn(gestes, b.action));
  // Un seul geste compte : le premier clic ferme les deux boutons. Une double tape, ou « Continuer sans compte »
  // tapé pendant que la redirection de Google part déjà, ne doit pas déclencher deux départs.
  const noeuds = [];
  const unSeulGeste = (geste) => () => {
    for (const n of noeuds) n.disabled = true;
    geste();
  };
  for (const b of offerts) noeuds.push(bouton(b, unSeulGeste(gestes[b.action])));
  const boutons = noeuds;
  const lignes = model.lignes.map((ligne) => el('p', { class: 'porte-ligne' }, ligne));
  const logo = el('img', { class: 'porte-logo', src: icone, alt: '', width: '72', height: '72' });
  const nom = el('p', { class: 'porte-nom' }, 'Cuisine OS');
  const titre = el('h1', { class: 'porte-titre' }, model.titre);
  const actions = el('div', { class: 'porte-actions' }, ...boutons);
  return el('div', { class: 'porte' }, logo, nom, titre, ...lignes, actions);
}

// `autofocus` sur le bouton primaire : au clavier comme au lecteur d'écran, le geste principal est déjà sous la
// main. L'attribut seul ne suffit pas sur un nœud inséré après le chargement — app.js appelle focus() après la
// pose ; l'attribut reste la marque que le rendu peut éprouver sans DOM vivant.
function bouton(b, geste) {
  const google = b.action === 'signIn';
  const primaire = b.tone !== 'link';
  const classes = ['btn', primaire ? 'primary' : 'link'];
  if (google) classes.push('porte-google');
  const corps = [google ? logoGoogle() : null, el('span', null, b.label)];
  return el('button', { type: 'button', class: classes.join(' '), autofocus: primaire, onClick: geste }, ...corps);
}
