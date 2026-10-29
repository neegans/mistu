// I3 : un texte à reporter dans l'éditeur officiel. Aucun compte Cookidoo ni envoi au robot.
import { el } from '../core/dom.js';
import { t, getUiLocale } from '../core/i18n.js';
import { copieCookidooThermomix } from '../domain/thermomix.js';

export function renderCopieCookidoo(bundle, deps = {}) {
  const root = el('section', { class: 'card stack', dataset: { role: 'copie-cookidoo' } }, el('h2', null, t('Copier pour Cookidoo')));
  const lienSource = () => el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(bundle?.recipe?.id || '')}` }, t('Revoir la recette source'));
  if (bundle?.recipe?.availability !== 'available') {
    root.append(el('p', { class: 'status warn' }, t('Recette incomplète : complète la source puis crée une nouvelle adaptation avant de copier pour Cookidoo.')), lienSource());
    root.attendreCopie = () => Promise.resolve(); return root;
  }
  const lire = () => copieCookidooThermomix(bundle, { locale: getUiLocale(), portions: Object.hasOwn(deps, 'portions') ? deps.portions : bundle?.version?.servings ?? null });
  let copie;
  try { copie = lire(); } catch {
    root.append(el('p', { class: 'status warn' }, t('Ces réglages ne correspondent plus à cette recette. Crée une nouvelle adaptation avant de les copier.')), lienSource());
    root.attendreCopie = () => Promise.resolve(); return root;
  }
  const status = el('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const selection = el('textarea', { readOnly: true, rows: 10, 'aria-label': t('Texte à copier manuellement'), style: { width: '100%', boxSizing: 'border-box' } });
  const manuel = el('div', { class: 'stack', hidden: true }, el('p', null, t('Sélectionne ce texte puis utilise la commande Copier de ton appareil.')), selection);
  const boutons = []; let pending = Promise.resolve(), busy = false;
  function bouton(texte, role, obtenir) {
    const node = el('button', { type: 'button', class: 'btn small', dataset: { role }, onClick: () => {
      if (busy) return;
      let valeur;
      try { valeur = obtenir(lire()); } catch { status.textContent = t('Ces réglages ne correspondent plus à cette recette. Crée une nouvelle adaptation avant de les copier.'); return; }
      busy = true; boutons.forEach(b => { b.disabled = true; }); status.textContent = t('Copie en cours…'); manuel.hidden = true;
      pending = (async () => {
        try {
          const clipboard = Object.hasOwn(deps, 'clipboard') ? deps.clipboard : globalThis.navigator?.clipboard;
          if (!clipboard?.writeText) throw new Error('indisponible');
          await clipboard.writeText(valeur); status.textContent = t('Texte copié');
        } catch {
          status.textContent = t('La copie automatique n’est pas disponible. Le texte reste sélectionnable.');
          selection.value = valeur; manuel.hidden = false; selection.focus(); selection.select();
        } finally { busy = false; boutons.forEach(b => { b.disabled = false; }); }
      })();
    } }, texte);
    boutons.push(node); return node;
  }
  root.append(el('p', { class: 'muted' }, t('À reporter dans Recettes créées ; réglages à renseigner dans Cookidoo.')),
    el('p', { class: 'status warn' }, copie.mention),
    el('div', { class: 'row between' }, el('strong', null, copie.titre), bouton(t('Copier le titre'), 'copier-titre', c => c.titre)),
    el('p', { class: 'muted' }, copie.portions == null ? t('Portions non renseignées : quantités d’origine conservées.') : t('{n} portions', { n: copie.portions })),
    el('h3', null, t('Ingrédients')),
    el('ul', { class: 'stack' }, ...copie.ingredients.map((texte, i) => el('li', null,
      el('div', { class: 'row between' }, el('span', null, texte), bouton(t('Copier cet ingrédient'), 'copier-ingredient', c => c.ingredients[i]))))),
    el('h3', null, t('Étapes')),
    ...copie.etapes.map((texte, i) => el('div', { class: 'card flat stack' },
      el('div', { class: 'row between' }, el('strong', null, t('Étape {n}', { n: i + 1 })), bouton(t('Copier cette étape'), 'copier-etape', c => c.etapes[i])),
      el('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, texte))),
    bouton(t('Copier tout le texte'), 'copier-tout', c => c.texte), status, manuel,
    el('details', null, el('summary', null, t('Comment utiliser ce texte dans Cookidoo ?')),
      el('ol', null,
        el('li', null, t('Dans Cookidoo Canada, ouvre Mes recettes → Recettes créées, puis crée une recette.')),
        el('li', null, t('Renseigne le titre, les portions, les ingrédients et les étapes dans leurs champs respectifs. Un collage global ne crée pas automatiquement ces champs.')),
        el('li', null, t('Garde un champ par étape source. Les sous-actions restent dans son texte ; plusieurs réglages programmés dans ce champ ne sont pas garantis.')),
        el('li', null, t('Ajoute uniquement les réglages proposés par le bouton de cuisson. Les autres, notamment le sens inverse et les modes, restent des consignes à régler manuellement sur le TM7.')),
        el('li', null, t('Enregistre dans Cookidoo puis retrouve la recette dans les Recettes créées du TM7. Vérifie les réglages sur l’appareil avant de cuisiner.'))),
      el('p', { class: 'muted' }, t('Cookidoo annonce jusqu’à 100 Recettes créées avec un abonnement actif. Ce parcours et les réglages disponibles restent à vérifier sur ton compte canadien.'))),
    el('a', { class: 'btn', href: 'https://cookidoo.ca/foundation/en-CA/pages/discover-created-recipes', target: '_blank', rel: 'noopener noreferrer' }, t('Ouvrir Cookidoo Canada')));
  root.attendreCopie = () => pending;
  return root;
}
