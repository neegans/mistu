// Une lecture commune pour la liste, la carte et la fiche : jamais de durée reconstruite.
import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { lireReperes, lireTemps, formaterDureeReperes } from '../domain/reperes.js';

const niveaux = { facile: 'Facile', intermediaire: 'Intermédiaire', avance: 'Avancé', chef: 'Chef' };
const origines = { source: 'Indiqué dans la source', estimation_ia: 'Estimation de l’assistant', manuel: 'Corrigé par toi' };

export function resumeReperes(recipe, version, { detail = false, modifier = false } = {}) {
  const reperes = lireReperes(recipe, version);
  const temps = lireTemps(recipe, version);
  const total = temps?.total;
  const renseignes = Object.values(reperes.champs).some(c => c.etat === 'courant' || c.etat === 'perime');
  const lienModifier = modifier ? el('a', { class: reperes.description_fr ? 'btn link small' : 'btn primary', dataset: { role: 'modifier-reperes' }, href: `#/recipes/${encodeURIComponent(recipe.id)}/reperes${version ? `?v=${encodeURIComponent(version.id)}` : ''}` },
    renseignes ? t('Actualiser les informations — 1 appel') : t('Compléter les informations — 1 appel')) : null;
  const root = el('div', { class: `resume-reperes${detail ? ' detail' : ''}` },
    el('p', { class: `description-recette${detail ? '' : ' deux-lignes'}${reperes.description_fr ? '' : ' muted'}` }, reperes.description_fr || t('Description à compléter')),
    modifier && !reperes.description_fr ? el('div', { class: 'stack' },
      el('p', { class: 'muted' }, t('Une courte description en français pour comprendre le plat, avec son niveau et ses temps.')),
      lienModifier,
      el('small', { class: 'muted', style: { display: 'block' } }, t('Appel à lancer sur l’écran suivant, ou saisie manuelle sans compte.'))) : null,
    el('div', { class: 'reperes-badges' },
      el('span', { class: `badge ${reperes.difficulte ? 'niveau' : 'neutre'}` }, reperes.difficulte ? t(niveaux[reperes.difficulte.niveau]) : t('Niveau à estimer')),
      el('span', { class: `badge ${total ? 'temps' : 'neutre'}` }, total ? `${formaterDureeReperes(total)} · ${total.complet ? t('total') : t('durée enregistrée')}` : t('Temps à estimer')),
      reperes.rapide ? el('span', { class: 'badge niveau', dataset: { role: 'badge-rapide' } }, t('Rapide')) : null),
    temps?.actif || total?.complet && temps?.attentes_incluses === true ? el('small', { class: 'muted' },
      [temps?.actif ? t('Travail actif : {d}', { d: formaterDureeReperes(temps.actif) }) : null,
        total?.complet && temps?.attentes_incluses === true ? t('Repos inclus') : null].filter(Boolean).join(' · ')) : null);
  if (detail) {
    const lignes = [];
    if (reperes.difficulte) lignes.push(el('p', null, reperes.difficulte.raison));
    for (const [cle, nom] of [['total', 'Temps total'], ['actif', 'Travail actif'], ['cuisson', 'Cuisson'], ['attentes', 'Repos et attentes']]) {
      const duree = temps?.[cle];
      lignes.push(el('div', { class: 'repere-detail' }, el('strong', null, t(nom)),
        el('span', null, duree ? formaterDureeReperes(duree) : t('Non renseigné')),
        duree ? el('small', { class: 'muted' }, t(origines[duree.origine])) : null));
    }
    if (temps?.explication) lignes.push(el('p', { class: 'muted' }, temps.explication));
    if (total && !total.complet) lignes.push(el('p', { class: 'muted' }, t('Les attentes ne sont pas toutes confirmées. Cette durée ne sert pas au filtre Rapide.')));
    if (Object.values(reperes.champs).some(c => c.etat === 'perime')) lignes.push(el('p', { class: 'status warn' }, t('Des repères concernent une autre version. Relis-les avant de les réutiliser.')));
    root.append(el('details', { class: 'details-reperes' }, el('summary', null, t('Détails du niveau et des temps')), ...lignes));
  }
  if (modifier && reperes.description_fr) root.append(lienModifier);
  return root;
}

export function lienGestionPhoto(recipe, { connue = !!recipe?.photo_sha256 } = {}) {
  return el('a', { class: 'btn small', dataset: { role: 'gerer-photo' }, href: `#/recipes/${encodeURIComponent(recipe.id)}/photo` }, connue ? t('Modifier photo') : t('Ajouter photo'));
}
