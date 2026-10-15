// Puces « Cuisines » (spec § 7) : une seule normalisation décide de l'union et de l'ajout ; la valeur STOCKÉE reste la
// chaîne en minuscules sans espaces de bord (comme add.js et recipe-edit.js l'écrivaient déjà) ; l'affichage capitalise.
import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { tagsDe } from '../domain/search.js';

export const GRAINE_CUISINES = ['québécoise', 'autochtone', 'française', 'italienne', 'levantine', 'marocaine', 'mexicaine', 'indienne', 'chinoise', 'japonaise', 'thaïe', 'vietnamienne', 'grecque', 'espagnole', 'américaine'];

// S10 : une valeur libre vient d'un champ texte — donc bornée, comme toute saisie (longueur) et en nombre (une
// collection de puces n'est plus un choix passé 50 entrées, c'est une liste illisible).
export const LIMITES_PUCES = { longueur: 60, nombre: 50 };

export const normaliser = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
export const capitaliser = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const valeurStockee = (s) => String(s ?? '').trim().toLowerCase();

// Toutes les occurrences (la fréquence sert à l'ordre), livres puis recettes.
export function cuisinesExistantes(ctx) {
  return [...(ctx?.books || []), ...(ctx?.recipes || [])].flatMap((r) => r?.cuisines || []);
}

// § 12 : les mots-clés des LIVRES seulement (les tags de recette sont un autre écran). Même rôle que cuisinesExistantes.
export function motsClesExistants(ctx) {
  return [...(ctx?.books || [])].flatMap((b) => tagsDe(b?.tags)); // S2 : un `tags` qui n'est pas un tableau de chaînes ne fait rien tomber
}

// Propositions reçues d'une source (Open Library, Google Books) : étiquetées, dédoublonnées, sans ce qui est déjà
// choisi (à la casse et à l'accent près), 10 au plus ; null quand il n'y a rien à montrer. Rien n'est écrit ici.
export const SUGGESTIONS_MAX = 10;
export function suggestionsModel({ proposees = [], source = null, choisies = [] } = {}) {
  const prises = new Set(choisies.map(normaliser));
  const vues = new Map();
  for (const v of proposees) {
    const valeur = String(v ?? '').trim();
    const cle = normaliser(valeur);
    if (!cle || prises.has(cle) || vues.has(cle)) continue;
    vues.set(cle, { valeur, cle });
    if (vues.size >= SUGGESTIONS_MAX) break;
  }
  if (!vues.size) return null;
  const libelle = source === 'googlebooks' ? t('Proposé par Google Books') : t('Proposé par Open Library');
  return { source, libelle, puces: [...vues.values()] };
}

// S10 : une valeur proposée n'est pas une clé de traduction — affichée telle quelle, capitalisée. Jamais dans un label.
export function renderSuggestions(model, { ajouter } = {}) {
  return el('div', { class: 'suggestions' },
    el('small', { class: 'muted' }, model.libelle),
    el('div', { class: 'puces', role: 'group' },
      ...model.puces.map((p) => el('button', { type: 'button', class: 'puce suggestion', 'aria-pressed': 'false', onClick: () => ajouter && ajouter(p.valeur) }, capitaliser(p.valeur)))));
}

export function pucesModel({ choisies = [], existantes = [], graine = GRAINE_CUISINES } = {}) {
  const vues = new Map(); // cle → { cle, valeur, libelle, choisie }
  // S10 : seule la GRAINE est traduisible — elle est fermée et ses quinze clés vivent dans en.js. Une valeur libre
  // (« Autre… », ou une cuisine héritée d'une fiche) n'est pas une clé de traduction : la passer à t() reviendrait à
  // chercher dans le dictionnaire un texte que la personne vient de taper. Elle est affichée telle quelle, capitalisée.
  // La clé de traduction est la valeur de la GRAINE, pas l'orthographe reçue : « Italienne » déjà choisie sur une
  // fiche doit s'afficher « Italian » en anglais comme la puce de graine « italienne ».
  const canonique = new Map(graine.map((g) => [normaliser(g), g]));
  const poser = (valeur, choisie) => {
    const cle = normaliser(valeur);
    if (!cle) return;
    if (!vues.has(cle)) vues.set(cle, { cle, valeur, libelle: capitaliser(canonique.has(cle) ? t(canonique.get(cle)) : valeur), choisie });
    else if (choisie) vues.get(cle).choisie = true;
  };
  for (const v of choisies) poser(v, true);
  const freq = new Map();
  for (const v of existantes) { const c = normaliser(v); if (c) freq.set(c, { n: (freq.get(c)?.n || 0) + 1, valeur: freq.get(c)?.valeur ?? valeurStockee(v) }); }
  for (const [, { valeur }] of [...freq.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))) poser(valeur, false);
  for (const v of graine) poser(v, false);
  return { puces: [...vues.values()] };
}

export function basculerPuce(choisies, valeur) {
  const cle = normaliser(valeur);
  return choisies.some((c) => normaliser(c) === cle) ? choisies.filter((c) => normaliser(c) !== cle) : [...choisies, valeur];
}

// Refus = le MÊME tableau (l'appelant compare par identité pour ne pas re-rendre). S10 : une valeur plus longue que
// LIMITES_PUCES.longueur ou une 51e puce sont refusées de la même façon — rien n'est tronqué en silence.
export function ajouterPuce(choisies, texte) {
  const valeur = valeurStockee(texte);
  const cle = normaliser(valeur);
  if (!cle || valeur.length > LIMITES_PUCES.longueur) return choisies;
  if (choisies.length >= LIMITES_PUCES.nombre) return choisies;
  if (choisies.some((c) => normaliser(c) === cle)) return choisies;
  return [...choisies, valeur];
}

export function renderPuces(model, { basculer, ajouter } = {}, { libelleAutre = t('Autre cuisine') } = {}) {
  const liste = el('div', { class: 'puces', role: 'group' },
    ...model.puces.map((p) => el('button', { type: 'button', class: 'puce', 'aria-pressed': p.choisie ? 'true' : 'false', onClick: () => basculer && basculer(p.valeur) }, p.libelle)));
  const champ = el('input', { type: 'text', placeholder: t('Autre…'), 'aria-label': libelleAutre });
  const envoyer = () => { const v = champ.value; if (!v.trim()) return; ajouter && ajouter(v); champ.value = ''; };
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); envoyer(); } });
  return el('div', { class: 'stack' }, liste,
    el('div', { class: 'row' }, champ, el('button', { type: 'button', class: 'btn small', onClick: envoyer }, t('Ajouter'))));
}
