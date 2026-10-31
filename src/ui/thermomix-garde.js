import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { gardeThermomix, estThermomix, lireThermomix } from '../domain/thermomix.js';

export const RAPPEL_THERMOMIX = 'Réglages estimés pour ces quantités. Vérifie le niveau du bol, le montage des accessoires et la cuisson sur le TM7.';
export const BLOCAGE_THERMOMIX = 'Ces réglages TM7 ne correspondent plus à cette version ou à ces quantités. Reviens aux quantités adaptées ou crée une nouvelle adaptation.';

export function panneauGardeThermomix(items) {
  const bloques = items.filter(it => !gardeThermomix(it.version, it.servings ?? null).ok);
  if (!bloques.length) return null;
  const groupes = new Map();
  for (const it of bloques) {
    const message = lireThermomix(it.version)?.etat === 'a_revoir'
      ? 'Ces anciens réglages Thermomix doivent être revus. Ouvre la fiche pour les corriger ou utilise la recette d’origine.'
      : BLOCAGE_THERMOMIX;
    if (!groupes.has(message)) groupes.set(message, []);
    groupes.get(message).push(it);
  }
  return el('div', { class: 'card stack', role: 'status', dataset: { role: 'thermomix-bloque' } },
    ...[...groupes].flatMap(([message, versions]) => [el('p', null, t(message)),
      ...versions.map(it => el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(it.recipe.id)}?v=${encodeURIComponent(it.version.id)}` },
        t('Revenir à la fiche'), ' — ', it.recipe.display_title || it.recipe.original_title))]));
}

export function rappelThermomix(version) {
  return estThermomix(version) ? el('p', { class: 'status warn', dataset: { role: 'rappel-thermomix' } }, t(RAPPEL_THERMOMIX)) : null;
}
