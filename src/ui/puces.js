// Puces « Cuisines » (spec § 7) : une seule normalisation décide de l'union et de l'ajout ; la valeur STOCKÉE reste la
// chaîne en minuscules sans espaces de bord (comme add.js et recipe-edit.js l'écrivaient déjà) ; l'affichage capitalise.
import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';

export const GRAINE_CUISINES = ['québécoise', 'autochtone', 'française', 'italienne', 'levantine', 'marocaine', 'mexicaine', 'indienne', 'chinoise', 'japonaise', 'thaïe', 'vietnamienne', 'grecque', 'espagnole', 'américaine'];

export const normaliser = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
export const capitaliser = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const valeurStockee = (s) => String(s ?? '').trim().toLowerCase();

// Toutes les occurrences (la fréquence sert à l'ordre), livres puis recettes.
export function cuisinesExistantes(ctx) {
  return [...(ctx?.books || []), ...(ctx?.recipes || [])].flatMap((r) => r?.cuisines || []);
}

export function pucesModel({ choisies = [], existantes = [], graine = GRAINE_CUISINES } = {}) {
  const vues = new Map(); // cle → { cle, valeur, libelle, choisie }
  const poser = (valeur, choisie) => {
    const cle = normaliser(valeur);
    if (!cle) return;
    if (!vues.has(cle)) vues.set(cle, { cle, valeur, libelle: capitaliser(t(valeur)), choisie });
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

// Refus = le MÊME tableau (l'appelant compare par identité pour ne pas re-rendre).
export function ajouterPuce(choisies, texte) {
  const valeur = valeurStockee(texte);
  const cle = normaliser(valeur);
  if (!cle || choisies.some((c) => normaliser(c) === cle)) return choisies;
  return [...choisies, valeur];
}

export function renderPuces(model, { basculer, ajouter } = {}) {
  const liste = el('div', { class: 'puces', role: 'group' },
    ...model.puces.map((p) => el('button', { type: 'button', class: 'puce', 'aria-pressed': p.choisie ? 'true' : 'false', onClick: () => basculer && basculer(p.valeur) }, p.libelle)));
  const champ = el('input', { type: 'text', placeholder: t('Autre…'), 'aria-label': t('Autre cuisine') });
  const envoyer = () => { const v = champ.value; if (!v.trim()) return; ajouter && ajouter(v); champ.value = ''; };
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); envoyer(); } });
  return el('div', { class: 'stack' }, liste,
    el('div', { class: 'row' }, champ, el('button', { type: 'button', class: 'btn small', onClick: envoyer }, t('Ajouter'))));
}
