// Brouillons locaux : le service contrôle propriétaire, époque et révision. Aucune lecture du namespace ici.
import { el, confirmDialog, downloadBlob, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { buildQuery } from '../core/router.js';

const messageParDefaut = r => r?.raison === 'revision_changee'
  ? t('Ce brouillon a changé dans un autre onglet. Recharge la liste avant de l’écarter.')
  : t('Impossible de terminer cette action. Le brouillon reste conservé sur cet appareil.');

function destination(b) {
  if (!['reprenable', 'bloque', 'anonyme'].includes(b.etat)) return null;
  if (b.kind === 'book_metadata' && b.edition_id) return `/books/${encodeURIComponent(b.edition_id)}${buildQuery({ panel: 'modifier', draft: b.id })}`;
  if (b.kind === 'recipe_new') return `/recipes/new${buildQuery({ draft: b.id })}`;
  if (b.kind === 'recipe_translation' && b.entity_id) return `/recipes/${encodeURIComponent(b.entity_id)}/edit${buildQuery({ kind: 'translation', format: 2, draft: b.id, v: b.recipe_version_id, locale: b.locale })}`;
  if (['recipe_metadata', 'recipe_version'].includes(b.kind) && b.entity_id) return `/recipes/${encodeURIComponent(b.entity_id)}/edit${buildQuery({ draft: b.id })}`;
  return null;
}

export async function renderBrouillonsListe({ service, portee, services = [], estCourante = () => true, confirmer = confirmDialog,
  telecharger = downloadBlob, messageErreur = messageParDefaut, lien = href => '#' + href } = {}) {
  const root = el('section', { class: 'card stack brouillons-liste', hidden: true, dataset: { role: 'brouillons-editeur' } });
  let numeroLecture = 0;
  const erreur = r => messageErreur(r) || messageParDefaut(r);
  async function dessiner() {
    const numero = ++numeroLecture;
    // Chaque saisie garde son dépôt et sa portée : les identifiants seuls ne suffisent pas.
    const lectures = await Promise.all([{ service, portee }, ...services].map(async depot => {
      try { return { ...depot, resultat: await depot.service.listerBrouillons({ portee: depot.portee, inclureDetaches: true }) }; }
      catch { return { ...depot, resultat: { issue: 'echec', raison: 'stockage_indisponible' } }; }
    }));
    if (!estCourante()) { root.replaceChildren(); root.hidden = true; return; }
    if (numero !== numeroLecture) return;
    root.replaceChildren(el('h2', null, t('Mes brouillons sur cet appareil')));
    const lectureIncomplete = lectures.some(l => l.resultat.issue !== 'ok');
    if (lectureIncomplete) {
      root.append(el('p', { role: 'status', class: 'status warn' }, t('La liste des brouillons n’a pas pu être lue. Recharge cette page pour réessayer.')));
    }
    const lignes = lectures.flatMap(l => l.resultat.issue === 'ok' ? (l.resultat.brouillons || []).map(b => ({ b, service: l.service, portee: l.portee })) : []);
    root.hidden = !lignes.length && !lectureIncomplete;
    if (!lignes.length) return;
    root.append(el('p', { class: 'muted' }, t('Ces saisies restent sur cet appareil. Elles ne sont ni synchronisées ni incluses dans l’archive de la bibliothèque.')));
    for (const { b, service, portee } of lignes) {
      const statut = el('p', { role: 'status', class: 'muted', hidden: true });
      const controls = el('div', { class: 'row' });
      const card = el('article', { class: 'stack brouillon-resume', dataset: { draftId: b.id } },
        el('h3', null, typeof b.titre === 'string' && b.titre.trim() ? b.titre : t('Saisie sans titre')),
        el('p', { class: 'muted' }, [b.kind === 'book_metadata' ? t('Livre') : b.kind === 'recipe_translation' ? t('Traduction') : t('Recette'), formatDate(b.saved_at, { withTime: true })].filter(Boolean).join(' · ')),
        b.etat === 'invalide' ? el('p', { class: 'status warn' }, t('Ce brouillon ne peut pas être repris sous cette forme. Tu peux récupérer son texte.'))
          : b.etat === 'detache' ? el('p', { class: 'status warn' }, t('Bibliothèque remplacée : cette saisie peut être récupérée en texte.'))
          : b.etat === 'bloque' ? el('p', { class: 'status warn' }, t('La cible de cette saisie a changé. Relis les différences avant de l’enregistrer.'))
          : b.etat === 'anonyme' ? el('p', { class: 'status warn' }, t('Ce brouillon a été saisi sans compte. Relis-le avant de choisir ce que tu veux reprendre avec ce compte.')) : null,
        controls, statut);
      let occupe = false;
      const action = async fn => {
        if (occupe || !estCourante()) return;
        occupe = true; statut.hidden = true;
        for (const n of controls.querySelectorAll('button')) n.disabled = true;
        try { await fn(); }
        catch { if (estCourante()) { statut.hidden = false; statut.textContent = erreur({ issue: 'echec', raison: 'stockage_indisponible' }); } }
        finally {
          occupe = false;
          for (const n of controls.querySelectorAll('button')) n.disabled = false;
          if (!estCourante()) { root.replaceChildren(); root.hidden = true; }
        }
      };
      const cible = destination(b);
      if (cible) controls.append(el('a', { class: 'btn', href: lien(cible) }, b.etat === 'anonyme' ? t('Revoir ce brouillon') : t('Reprendre')));
      controls.append(el('button', { class: 'btn', type: 'button', dataset: { action: 'exporter' }, onClick: () => action(async () => {
        const r = await service.exporterTexteBrouillon({ id: b.id, portee });
        if (!estCourante()) return;
        if (r.issue !== 'ok') { statut.hidden = false; statut.textContent = erreur(r); return; }
        telecharger(new Blob([r.texte], { type: 'text/plain;charset=utf-8' }), r.nomFichier);
        statut.hidden = false; statut.textContent = r.tronque ? t('Le texte récupérable a été préparé. Cette copie est partielle car le brouillon était trop volumineux ou endommagé.') : t('Le texte a été préparé pour le téléchargement.');
      }) }, t('Télécharger mon texte')),
      el('button', { class: 'btn', type: 'button', dataset: { action: 'ecarter' }, onClick: () => action(async () => {
        if (!(await confirmer(t('Écarter ce brouillon sur cet appareil ? La recette ou le livre enregistré reste conservé.'), { danger: true, okLabel: t('Écarter le brouillon') })) || !estCourante()) return;
        const r = await service.ecarterBrouillon({ id: b.id, portee, expectedRevision: b.revision, ...(b.attendu ? { attendu: b.attendu } : {}) });
        if (!estCourante()) return;
        if (r.issue !== 'ok') { statut.hidden = false; statut.textContent = erreur(r); return; }
        await dessiner();
      }) }, t('Écarter le brouillon')));
      root.append(card);
    }
  }
  await dessiner();
  root.recharger = dessiner;
  return root;
}
