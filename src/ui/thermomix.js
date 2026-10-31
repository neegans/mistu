import { retourConnu, porteeNavigation } from './navigation-contexte.js';
import { destinationApresRecette } from './actions-contenu.js';
import { panneauAbandonProposition, texteConfirmationAbandon, texteErreurReprise } from './reprise-import.js';
import { recetteActiveDansContexte } from './state.js';
import { revoirLectureImport, memeCaptureImport } from '../domain/contexte-import.js';
import { mentionCycleRecette } from './corbeille.js';
import { capturerRecette } from './recette-garde.js';
// I3 : sélection, brouillon durable, proposition et relecture. Aucun démarrage du robot.
import { el, append, toast, confirmDialog } from '../core/dom.js';
import { t, getUiLocale } from '../core/i18n.js';
import { navigate, remplacerAdresse, buildQuery } from '../core/router.js';
import * as depot from '../model/repo.js';
import * as parcours from '../domain/thermomix-parcours.js';
import { validerReponseThermomix, formaterBlocThermomix, explicationBlocThermomix, lireThermomix, AVERTISSEMENT_TM7 } from '../domain/thermomix.js';
import { resoudreVersionThermomix } from '../domain/thermomix-reprise.js';
import { formatQuantity } from '../domain/quantity.js';
import { unitLabel } from '../domain/units.js';
import { cibleReprise } from '../domain/import-cible.js';
import { pageHeader, field, sessionAssistant, carteConnexion, texteRefusAssistant } from './components.js';
import { demarrerConnexion } from './settings.js';
import { protegerSaisie } from './state.js';
import { prendreVol, libererVol, volEnCours, DOCUMENT_ID, BATTEMENT_MS } from './vol.js';

const TERMINE = ['enregistre', 'ignore'];
const copier = (v) => structuredClone(v);
const portionsDe = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
const ingredientsTexte = (v) => (v.ingredients || []).map(i => i.source_text || [formatQuantity(i.quantity), i.unit_id ? unitLabel(i.unit_id, 'fr') : i.unit_text, i.name_text].filter(Boolean).join(' '));

function brouillonReparation(resolution) {
  const documents = resolution.ancetres.slice(0, -1).map(v => { const lu = lireThermomix(v); return lu?.ok ? lu : lu?.document; });
  if (documents.some(d => !d)) throw Error('source_modifiee');
  const premier = documents[0], courant = id => premier.plan.correspondance.find(c => c.source_step_id === id)?.step_id;
  const remonter = ids => {
    let selection = [...ids];
    for (let i = 0; i < documents.length; i++) {
      selection = selection.map(id => documents[i].plan.correspondance.find(c => c.step_id === id)?.source_step_id);
      if (selection.some(id => !id || !resolution.ancetres[i + 1].steps.some(s => s.id === id))) throw Error('source_modifiee');
    }
    return resolution.version.steps.filter(s => selection.includes(s.id)).map(s => s.id);
  };
  const precisionsBlocs = premier.blocs.map(b => premier.contexte.selection.includes(b.source_step_id) ? premier.contexte.precisions : premier.contexte.anciennes_precisions[b.source_step_id]);
  const selection = remonter(premier.blocs.map(b => courant(b.source_step_id))), precisions = { reponses: [] }, divergences = {};
  for (const cle of ['eau_vapeur_g', 'volume_bol_l', 'volume_panier_l']) {
    const valeurs = [...new Set(precisionsBlocs.map(p => p?.[cle]).filter(v => v != null))];
    precisions[cle] = valeurs.length === 1 ? valeurs[0] : null;
    if (valeurs.length > 1) divergences[cle] = valeurs;
  }
  precisions.froid_confirme = remonter([...new Set(precisionsBlocs.flatMap(p => p?.froid_confirme || []).map(courant))]).filter(id => selection.includes(id));
  return { draft: { selection, precisions, demande: premier.contexte.demande, langue: premier.contexte.langue }, divergences };
}

export function texteErreurThermomix(erreur) {
  const code = erreur?.code || erreur?.raison || erreur?.message;
  const refus = texteRefusAssistant({ ...erreur?.extra, ...erreur, raison: code }); if (refus) return refus;
  if (['cycle_change','compte_change','lecture_changee','recette_retiree'].includes(code)) return t('La recette a changé. Rouvre sa fiche avant d’enregistrer.');
  if (['reprise_modifiee','reprise_absente'].includes(code)) return texteErreurReprise(erreur);
  if (code === 'proposition_precedente') return t('Un résultat précédent est conservé. Reprends-le ou écarte-le explicitement avant un nouvel appel.');
  if (code === 'questions_modifiees') return t('Les questions ont changé. Actualise et réponds au nouveau tour avant de proposer.');
  if (code === 'brouillon_modifie' || code === 'tentative_perimee') return t('La proposition a changé. Actualise et relis le résultat avant de le garder.');
  if (code === 'reseau') return t('La connexion a été interrompue. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'serveur' || code === 'interne') return t('L’assistant est temporairement indisponible. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'delai') return t('L’assistant n’a pas répondu à temps. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'reponse_illisible') return t('La réponse de l’assistant n’a pas pu être lue. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'refus') return t('L’assistant n’a pas proposé de résultat pour cette demande. Aucun nouvel appel n’est lancé.');
  if (code === 'hors_ligne') return t('Tu es hors ligne. Ton brouillon est conservé.');
  if (code === 'non_connecte') return t('Connecte-toi pour utiliser l’assistant.');
  if (code === 'annule' || code === 'interrompu') return t('Appel interrompu. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'autre_appareil' || code === 'lecture_seule') return t('Ce brouillon se modifie sur l’appareil qui l’a créé.');
  if (code === 'source_modifiee' || code === 'source_absente') return t('La version source a changé ou n’est plus disponible. Repars de sa fiche.');
  if (code === 'relecture_requise') return t('Relis les étapes et confirme les vérifications avant de garder cette adaptation.');
  return t('Cette proposition n’a pas pu être utilisée. Vérifie la sélection, les quantités et le profil TM7, puis réessaie explicitement.');
}

export async function renderThermomixRoute(params, query = {}, ctx = {}, deps = {}) {
  const repo = deps.repo || depot, P = deps.parcours || parcours;
  const nav = deps.navigate || navigate, adresse = deps.remplacerAdresse || remplacerAdresse, dire = deps.toast || toast;
  const sessionDe = deps.sessionAssistant || (() => sessionAssistant(ctx));
  const enLigne = deps.enLigne || (() => navigator.onLine !== false);
  const propreRecette = await repo.get('recipes', params.id);
  if (!propreRecette) return el('p', { class: 'status warn' }, t('Recette introuvable.'));
  if (!recetteActiveDansContexte(propreRecette, ctx)) return mentionCycleRecette(propreRecette, ctx?.editionsById?.get(propreRecette.edition_id));
  const contexteRecette = await capturerRecette(repo, propreRecette, {ctx});
  let row = null;
  if (typeof query.import === 'string' && query.import) {
    try { row = await P.lireBrouillonThermomix(query.import, { repo }); }
    catch {
      const brute = await repo.get('imports', query.import);
      const retour = el('div', {class:'stack'}, el('p', {class:'status warn'}, t('Ce brouillon Thermomix ne peut pas être repris. Repars de la recette source.')));
      if (brute?.kind === 'thermomix' && brute.recipe_id === propreRecette.id) {
        const abandon = panneauAbandonProposition(brute, {repo,ctx,contexteRecette,confirmer:deps.confirmer,role:'ignorer-tm7'});
        retour.append(abandon); retour.attendreEcritures=abandon.attendreEcritures;
      }
      retour.append(el('a',{class:'btn',href:'#/recipes/'+encodeURIComponent(propreRecette.id)},t('Revoir la recette source')));
      return retour;
    }
    if (row?.recipe_id !== propreRecette.id) return el('p', { class: 'status warn' }, t('Ce brouillon appartient à une autre recette.'));
  }
  const versionId = row?.source_version_id || (typeof query.v === 'string' ? query.v : propreRecette.current_version_id);
  let version = versionId ? await repo.get('recipe_versions', versionId) : null, reparation = null;
  const rid = encodeURIComponent(propreRecette.id), lien = `/recipes/${rid}`;
  const lecturePlan = lireThermomix(version);
  if (lecturePlan?.ok === false && lecturePlan.etat !== 'a_revoir' && version?.provenance?.thermomix_invalide !== true) {
    return el('div', { class: 'stack' }, el('p', { class: 'status warn' }, t('La version source a changé ou n’est plus disponible. Repars de sa fiche.')),
      el('a', { class: 'btn', href: `#${lien}` }, t('Revoir la recette source')));
  }
  if (!row && lecturePlan?.etat === 'a_revoir') {
    try {
      const resolution = await resoudreVersionThermomix(version, { lire: id => repo.get('recipe_versions', id) });
      if (!resolution.ok || !resolution.repli || resolution.version.recipe_id !== propreRecette.id) throw Error('source_modifiee');
      reparation = { ...brouillonReparation(resolution), ancetres: resolution.ancetres };
      version = resolution.version;
    } catch {
      return el('div', { class: 'stack' }, el('p', { class: 'status warn' }, t('La version source a changé ou n’est plus disponible. Repars de sa fiche.')),
        el('a', { class: 'btn', href: `#${lien}` }, t('Revoir la recette source')));
    }
  }
  if (!version || version.recipe_id !== propreRecette.id || !Array.isArray(version.steps) || !version.steps.length || propreRecette.availability === 'reference_only') {
    return el('div', { class: 'stack' }, el('p', { class: 'status warn' }, t('Importe d’abord les étapes de cette recette pour les adapter au Thermomix.')),
      el('a', { class: 'btn', href: `#${lien}` }, t('Revoir la recette source')));
  }
  if (version.steps.length > 40 || (version.ingredients || []).length > 60 || version.steps.some(s => typeof s?.text !== 'string' || s.text.length > 2000)) {
    return el('div', { class: 'stack' }, el('p', { class: 'status warn' }, t('Cette recette dépasse les limites du chef Thermomix. Son contexte ne sera pas tronqué.')),
      el('a', { class: 'btn', href: `#${lien}` }, t('Revoir la recette source')));
  }
  let draft = { selection: [], demande: '', precisions: { eau_vapeur_g: null, volume_bol_l: null, volume_panier_l: null, froid_confirme: [], reponses: [] }, langue: getUiLocale() };
  if (reparation) draft = copier(reparation.draft);
  if (row?.contexte) draft = { selection: [...row.contexte.selection], demande: row.contexte.demande, precisions: copier(row.contexte.precisions), langue: row.contexte.langue };
  let importId = row?.id || null, opening = null, queue = Promise.resolve();
  const operations = new Set();
  let busy = false, saving = false, closed = false, connectedOnce = false, generation = 0, controller = null, tenue = null, heartbeat = null;
  let questions = row?.questions || (row?.resultat?.type === 'questions' ? row.resultat.questions : []);
  let resultat = row?.resultat || null, relecture = false, montage = false;
  const originalPortions = portionsDe(version.servings);
  let quantitesAcceptees = !Object.hasOwn(query, 'servings') || (originalPortions !== null && String(originalPortions) === String(query.servings));
  const sessionInitiale = await sessionDe(); let sessionDisponible = !!sessionInitiale;
  const compteInitial = ctx.sync?.user?.id ?? sessionInitiale?.user?.id ?? null;
  const root = el('div', { class: 'stack', dataset: { role: 'thermomix-i3' } });
  const proteger = protegerSaisie(root);
  const status = el('p', { class: 'status', role: 'status', 'aria-live': 'polite', dataset: { role: 'etat-tm7' } });
  const feedback = el('div', { class: 'stack' });
  const propositionZone = el('div', { class: 'stack', dataset: { role: 'proposition-tm7' } });
  const precedentZone = el('div', {class:'stack',dataset:{role:'precedent-tm7'}});
  const questionsZone = el('div', { class: 'stack', dataset: { role: 'questions-tm7' } });
  const readonly = () => !!row && row.device_id !== repo.deviceId();
  const cycleDivergent = () => !!row && !memeCaptureImport(row, contexteRecette);
  const perime = () => cycleDivergent() || !!row?.validation_erreur;
  const terminal = () => !!row && TERMINE.includes(row.status);
  const vivant = () => !closed && (!connectedOnce || root.isConnected);
  const controls = [], steps = new Map(), cold = new Map(), invalidNumbers = new Set();
  const patchDeps = (extra = {}) => ({ ...deps, repo, enLigne, contexteRecette, documentId: DOCUMENT_ID, ...extra });
  const message = (texte) => { if (vivant()) status.textContent = texte; };
  const lancerGeste = (fn) => {
    const operation = Promise.resolve().then(fn).catch(e => { message(texteErreurThermomix(e)); });
    operations.add(operation); operation.then(() => operations.delete(operation));
    return operation;
  };
  const action = (texte, role, fn, primary = false) => el('button', { type: 'button', class: primary ? 'btn primary' : 'btn', dataset: { role }, onClick: () => lancerGeste(fn) }, texte);
  let unsubscribe, retirerReseau = () => {};
  function dispose() {
    if (closed) return; closed = true; generation++; controller?.abort();
    if (tenue && importId) P.annulerThermomix(importId, patchDeps()).catch(() => {});
    clearInterval(heartbeat); observer.disconnect(); unsubscribe?.(); proteger(); retirerReseau(); window.removeEventListener('hashchange', dispose);
  }
  const observer = new MutationObserver(() => { if (root.isConnected) connectedOnce = true; else if (connectedOnce) dispose(); });
  observer.observe(document.body, { childList: true, subtree: true }); window.addEventListener('hashchange', dispose);
  unsubscribe = ctx.sync?.auth?.onChange?.(state => { if ((state?.user?.id ?? null) !== compteInitial) dispose(); });
  root.dispose = dispose;
  root.etatRoute = () => ({ importId, busy, saving, lectureSeule: readonly(), brouillon: copier(draft) });
  root.attendreEcritures = async () => { await queue; while (operations.size) await Promise.all([...operations]); await queue; };

  async function montrerConflit() {
    const existant = (await repo.all('imports')).find(i => i.recipe_id === propreRecette.id && !TERMINE.includes(i.status) && i.id !== importId);
    if (existant && vivant()) {
      const cible = cibleReprise(existant);
      feedback.replaceChildren(...[el('p', { class: 'status warn' }, t('Un brouillon ou un import est déjà ouvert pour cette recette. Reprends-le ou termine-le explicitement.')),
        cible ? el('a', { class: 'btn', href: '#' + cible }, t('Reprendre le brouillon existant')) : null].filter(Boolean));
    }
  }
  async function ensure(snapshot) {
    if (importId) return importId;
    if (!opening) opening = P.ouvrirThermomix({ recipeId: propreRecette.id, versionId: version.id, contexteRecette, ancetresThermomix: reparation?.ancetres || [], ...snapshot }, patchDeps()).then(r => {
      row = r; importId = r.id;
      if (vivant()) adresse(`#${lien}/thermomix${buildQuery({ ...query, import: importId })}`);
      return r.id;
    }).catch(async e => { opening = null; await montrerConflit(); throw e; });
    return opening;
  }
  function persist() {
    if (invalidNumbers.size) return Promise.resolve();
    const snapshot = copier(draft), questionsAttendues = row?.questions_tour_id ?? null;
    queue = queue.catch(() => {}).then(async () => {
      if (closed || readonly() || terminal() || perime()) return;
      const id = await ensure(snapshot);
      row = await P.modifierThermomix(id, snapshot, patchDeps({questionsAttendues}));
      renderPrecedent(); synchroniser();
    });
    queue.catch(e => message(texteErreurThermomix(e))); return queue;
  }
  function changed() {
    if (perime()) return;
    generation++; relecture = false; montage = false; resultat = null;
    if (busy) { controller?.abort(); if (importId) P.annulerThermomix(importId, patchDeps()).catch(() => {}); }
    propositionZone.replaceChildren(); persist(); synchroniser();
  }
  const demande = el('textarea', { rows: 3, maxlength: 500, name: 'demande', value: draft.demande, onInput: e => { draft.demande = e.target.value; changed(); } }); controls.push(demande);
  const ficheSource = el('details', null, el('summary', null, t('Quantités de la version source')),
    el('p', { class: 'muted' }, originalPortions === null ? t('Portions non renseignées : quantités d’origine conservées.') : t('{n} portions', { n: originalPortions })),
    el('ul', null, ...ingredientsTexte(version).map(i => el('li', null, i))));
  const quantites = el('div', { class: 'status warn', hidden: quantitesAcceptees },
    el('p', null, t('Les portions affichées ont changé. Le chef utilise uniquement les quantités enregistrées dans cette version.')),
    action(t('Revenir aux quantités d’origine pour adapter'), 'quantites-source-tm7', () => { quantitesAcceptees = true; quantites.hidden = true; synchroniser(); }));
  const selection = el('fieldset', { class: 'stack' }, el('legend', null, t('Quelles étapes veux-tu adapter ?')));
  version.steps.forEach((step, i) => {
    const checkbox = el('input', { type: 'checkbox', name: 'etape', value: step.id, checked: draft.selection.includes(step.id), onChange: () => {
      draft.selection = version.steps.filter(s => steps.get(s.id)?.checked).map(s => s.id);
      draft.precisions.froid_confirme = (draft.precisions.froid_confirme || []).filter(id => draft.selection.includes(id));
      for (const [id, node] of cold) if (!draft.selection.includes(id)) node.checked = false;
      changed();
    } }); steps.set(step.id, checkbox); controls.push(checkbox);
    const froid = el('input', { type: 'checkbox', name: 'froid', value: step.id, checked: (draft.precisions.froid_confirme || []).includes(step.id), onChange: () => {
      draft.precisions.froid_confirme = version.steps.filter(s => cold.get(s.id)?.checked && draft.selection.includes(s.id)).map(s => s.id); changed();
    } }); cold.set(step.id, froid); controls.push(froid);
    selection.append(el('div', { class: 'card flat stack' },
      el('label', { class: 'row top' }, checkbox, el('span', null, el('strong', null, t('Étape {n}', { n: i + 1 })), el('span', { style: { display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, step.text))),
      el('label', { class: 'row top muted' }, froid, el('span', null, t('Le bol et les ingrédients seront froids au début de cette étape.')))));
  });
  const materiel = el('details', null, el('summary', null, t('Précisions sur la préparation du TM7')));
  for (const [key, label, max] of [['eau_vapeur_g', t('Eau vapeur distincte des ingrédients : quantité totale pour la séquence (g)'), 2200], ['volume_bol_l', t('Volume prévu dans le bol, si connu (L)'), 2.2], ['volume_panier_l', t('Volume prévu dans le panier, si connu (L)'), 1.4]]) {
    const number = el('input', { type: 'number', min: '0', max, step: 'any', name: key, value: draft.precisions[key] ?? '', onInput: e => {
      const n = e.target.value === '' && !e.target.validity.badInput ? null : e.target.valueAsNumber;
      if (n !== null && (!Number.isFinite(n) || n < 0 || n > max)) {
        invalidNumbers.add(key); e.target.setAttribute('aria-invalid', 'true'); generation++; resultat = null; relecture = false; montage = false;
        propositionZone.replaceChildren(); message(t('Cette valeur dépasse les limites du profil TM7 ou n’est pas un nombre valide.')); synchroniser(); return;
      }
      invalidNumbers.delete(key); e.target.removeAttribute('aria-invalid'); draft.precisions[key] = n; changed();
    } }); controls.push(number); materiel.append(field(label, number));
    const initiale = draft.precisions[key];
    if ((initiale != null && (!Number.isFinite(initiale) || initiale < 0 || initiale > max)) || reparation?.divergences[key]) {
      invalidNumbers.add(key); number.setAttribute('aria-invalid', 'true'); materiel.open = true;
      message(t('Cette valeur dépasse les limites du profil TM7 ou n’est pas un nombre valide.'));
    }
    if (reparation?.divergences[key]) materiel.append(el('p', { class: 'status warn' }, t('Valeurs conservées : {valeurs}. Renseigne la valeur à utiliser.', { valeurs: reparation.divergences[key].join(' · ') })));
  }
  materiel.append(el('p', { class: 'muted' }, t('Laisse vide ce que tu ne connais pas. Les grammes ne permettent pas de déduire le volume ; vérifie les repères sur les contenants.')));
  const proposer = action(t('Proposer l’adaptation — 1 appel'), 'proposer-tm7', proposerAdaptation, true);
  const annuler = action(t('Annuler l’appel'), 'annuler-tm7', async () => {
    generation++; controller?.abort();
    if (importId) row = await P.annulerThermomix(importId, patchDeps());
    message(t('Appel interrompu. Ton brouillon est conservé ; aucune relance automatique.')); synchroniser();
  });
  const ignorer = action(t('Abandonner ce brouillon'), 'ignorer-tm7', async () => {
    if (!importId || saving || terminal()) return;
    await queue;
    const attendu = row;
    if (!(await (deps.confirmer || confirmDialog)(texteConfirmationAbandon(), {okLabel:t('Abandonner ce brouillon')}))) return;
    row = await P.ignorerThermomix(importId, patchDeps({attendu}));
    generation++; controller?.abort(); resultat=null; questions=[];
    renderQuestions(); synchroniser(); renderResultat(); message(t('Brouillon terminé.'));
  });
  const actualiser = action(t('Actualiser'), 'actualiser-tm7', async () => {
    if (!importId || busy) return;
    await queue;
    await repo.marquerInterrompus?.(); row = await P.lireBrouillonThermomix(importId, { repo });
    draft = { selection: [...row.contexte.selection], demande: row.contexte.demande, precisions: copier(row.contexte.precisions), langue: row.contexte.langue };
    demande.value = draft.demande;
    for (const [id, node] of steps) node.checked = draft.selection.includes(id);
    for (const [id, node] of cold) node.checked = draft.precisions.froid_confirme.includes(id);
    for (const key of ['eau_vapeur_g', 'volume_bol_l', 'volume_panier_l']) {
      const node = root.querySelector(`[name=${key}]`); node.value = draft.precisions[key] ?? ''; node.removeAttribute('aria-invalid');
    }
    invalidNumbers.clear();
    resultat = row.resultat; questions = row.questions || []; renderQuestions(); renderResultat(); synchroniser();
  });
  const revoir = action(t('Relire le résultat conservé'), 'revoir-lecture-cycle', async () => {
    if (busy || saving || readonly() || !cycleDivergent()) return;
    saving = true; synchroniser();
    try {
      await queue;
      await revoirLectureImport(importId, {repo, contexte:contexteRecette});
      row = await P.lireBrouillonThermomix(importId, {repo});
      resultat = row.resultat; questions = row.questions || [];
      renderQuestions(); renderResultat();
      message(t('Le résultat est conservé. Relis-le et confirme les vérifications avant de le garder.'));
    } finally { saving = false; synchroniser(); }
  });
  const avisCycle = el('div', {class:'status warn'}, el('p', null, t('Cette proposition date d’avant le retrait de la recette. Une nouvelle relecture est nécessaire.')), revoir);
  const copieBrouillon = action(t('Créer une copie de ce brouillon sur cet appareil'), 'copier-brouillon-tm7', async () => {
    if (!importId || !terminal()) return;
    const nouvelle = await P.copierBrouillonThermomix(importId, patchDeps()); nav(`${lien}/thermomix${buildQuery({ ...query, import: nouvelle.id })}`);
  });
  append(root, [pageHeader(t('Chef Thermomix'), { subtitle: propreRecette.display_title || propreRecette.original_title, back: {...retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli:lien+buildQuery({v:version.id})}),label:t('Retour')} }),
    el('div', { class: 'status' }, t('TM7 · Amérique du Nord · 120 V. Manuel et vapeur, sans chauffe ou 100 °C. Les autres modes restent hors de cette version.')),
    el('p', { class: 'muted' }, t('Adapte seulement les étapes choisies. Les ingrédients et les autres étapes resteront inchangés.')),
    reparation ? el('p', { class: 'status warn', dataset: { role: 'reparation-tm7' } }, t('Revoir les réglages depuis la recette d’origine. L’ancien plan reste conservé. Corrige les valeurs signalées avant de demander une nouvelle proposition.')) : null,
    propreRecette.availability === 'partial' ? el('p', { class: 'status warn' }, t('Cette recette est partielle. Les informations nécessaires doivent être complétées avant toute proposition qui en dépend.')) : null,
    lireThermomix(version)?.ok === false ? el('p', { class: 'status warn' }, t('Cette version a modifié une adaptation TM7. Sélectionne toutes ses étapes pour proposer un nouveau plan complet.')) : null,
    avisCycle, quantites, ficheSource, selection, field(t('Ce que tu voudrais faire (facultatif)'), demande), materiel, questionsZone,
    !sessionDisponible ? carteConnexion(deps.connecter || (() => demarrerConnexion(ctx.sync?.auth)), ctx) : null,
    el('div', { class: 'row' }, proposer, annuler, ignorer, actualiser), status, feedback, precedentZone, propositionZone, copieBrouillon]);

  function synchroniser() {
    if (!vivant()) return;
    const verrou = busy || saving || readonly() || terminal() || row?.status === 'en_cours' || perime() || (!!row?.proposition_precedente && row?.resultat?.type === 'proposition');
    avisCycle.hidden = !(cycleDivergent() && row?.status === 'a_verifier' && row?.resultat);
    revoir.disabled = busy || saving || readonly();
    controls.forEach(n => { n.disabled = verrou; });
    for (const [id, n] of cold) {
      const choisie = draft.selection.includes(id);
      n.disabled = verrou || !choisie; n.closest('label').hidden = !choisie;
    }
    proposer.disabled = verrou || !!row?.proposition_precedente?.tentative_suivante_id || !sessionDisponible || !enLigne() || !quantitesAcceptees || !draft.selection.length || !!invalidNumbers.size;
    proposer.textContent = row?.status === 'echec' ? t('Réessayer — 1 appel') : t('Proposer l’adaptation — 1 appel');
    annuler.hidden = !busy; annuler.disabled = !busy; ignorer.disabled = !importId || saving || terminal();
    precedentZone.querySelectorAll('button').forEach(b=>{b.disabled=busy||saving||readonly()||terminal()||row?.status==='en_cours';});
    actualiser.hidden = !importId; actualiser.disabled = busy || saving;
    copieBrouillon.hidden = !terminal(); copieBrouillon.disabled = busy || saving;
    if (readonly() && !terminal()) message(t('Ce brouillon vient d’un autre appareil. Tu peux consulter son résultat ou l’abandonner explicitement pour débloquer la recette.'));
    else if (row?.status === 'en_cours' && !busy) message(t('Un appel est en cours sur un autre écran. Actualise pour retrouver son résultat, ou abandonne explicitement ce brouillon.'));
  }
  function renderQuestions() {
    questionsZone.replaceChildren();
    if (!Array.isArray(questions) || !questions.length) return;
    questionsZone.append(el('h2', null, t('Précisions demandées')));
    questions.slice(0, 4).forEach((texte, i) => {
      const answer = el('textarea', { name: 'reponse-' + i, rows: 2, maxlength: 500, value: draft.precisions.reponses?.[i] || '', onInput: e => {
        const next = [...(draft.precisions.reponses || [])]; while (next.length <= i) next.push(''); next[i] = e.target.value; draft.precisions.reponses = next; changed();
      } }); controls.push(answer); questionsZone.append(field(texte, answer));
    });
  }
  function renderPrecedent() {
    precedentZone.replaceChildren();
    const ancien = row?.proposition_precedente;
    if (!ancien || terminal()) return;
    const details = el('details',null,el('summary',null,t('Résultat précédent conservé')));
    try {
      const relu = validerReponseThermomix(ancien.resultat,ancien.contexte);
      if (relu.type !== 'proposition') throw new Error('proposition');
      for (const bloc of relu.blocs) details.append(el('p',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},formaterBlocThermomix(bloc,ancien.contexte,{locale:getUiLocale()})));
    } catch { details.append(el('p',{class:'status warn'},t('Le résultat précédent est conservé, mais ne peut pas être utilisé dans son état actuel.'))); }
    const reprendre = action(t('Reprendre le résultat précédent'),'reprendre-resultat-tm7',async()=>{
      if (busy||saving||readonly()||terminal()) return;
      await queue; const attendu=row; saving=true; synchroniser();
      try {
        row=await P.reprendrePropositionThermomix(importId,patchDeps({attendu}));
        draft={selection:[...row.contexte.selection],demande:row.contexte.demande,precisions:copier(row.contexte.precisions),langue:row.contexte.langue};
        demande.value=draft.demande;
        for(const [id,n] of steps)n.checked=draft.selection.includes(id);
        for(const [id,n] of cold)n.checked=draft.precisions.froid_confirme.includes(id);
        for(const key of ['eau_vapeur_g','volume_bol_l','volume_panier_l']){const n=root.querySelector('[name='+key+']');n.value=draft.precisions[key]??'';n.removeAttribute('aria-invalid');}
        invalidNumbers.clear();resultat=row.resultat;questions=row.questions||[];renderQuestions();renderResultat();
        message(t('Résultat précédent repris. Relis-le avant de le conserver.'));
      } finally {saving=false;synchroniser();}
    });
    const ecarter = action(t('Écarter le résultat précédent'),'ecarter-resultat-tm7',async()=>{
      if(busy||saving||readonly()||terminal())return;
      await queue;const attendu=row;
      if(!(await (deps.confirmer||confirmDialog)(t('Écarter ce résultat précédent ? Cette copie ne pourra plus être reprise.'),{okLabel:t('Écarter le résultat précédent')})))return;
      saving=true;synchroniser();
      try {row=await P.ignorerPropositionPrecedenteThermomix(importId,patchDeps({attendu}));renderPrecedent();}
      finally{saving=false;synchroniser();}
    });
    precedentZone.append(details,el('div',{class:'row'},reprendre,ecarter));
  }
  function renderResultat() {
    renderPrecedent();
    propositionZone.replaceChildren(); relecture = false; montage = false;
    if (row?.status === 'enregistre' && row.version_id) {
      propositionZone.append(el('p', null, t('Adaptation conservée.')), el('a', { class: 'btn', href: '#'+destinationApresRecette(propreRecette.id,query,ctx,{v:row.version_id}) }, t('Ouvrir cette adaptation'))); return;
    }
    if (terminal()) return;
    if (!resultat) { if (row?.validation_erreur) message(texteErreurThermomix({ code: row.validation_erreur })); return; }
    try { resultat = validerReponseThermomix(resultat, row.contexte); } catch { resultat = null; message(texteErreurThermomix(null)); return; }
    if (resultat.type === 'questions') { questions = resultat.questions; renderQuestions(); return; }
    if (resultat.type === 'refus') { propositionZone.append(el('h2', null, t('Cette adaptation n’est pas proposée')), el('p', null, resultat.raison)); return; }
    propositionZone.append(el('h2', null, t('Comparer avant de garder')), el('p', { class: 'status warn' }, t(AVERTISSEMENT_TM7)));
    for (const bloc of resultat.blocs) {
      const index = version.steps.findIndex(s => s.id === bloc.source_step_id), source = version.steps[index];
      propositionZone.append(el('section', { class: 'card stack' }, el('h3', null, t('Étape {n}', { n: index + 1 })),
        el('strong', null, t('Texte source')), el('p', { style: { whiteSpace: 'pre-wrap' } }, source.text),
        el('strong', null, t('Proposition TM7 · réglages estimés')),
        el('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, formaterBlocThermomix(bloc, row.contexte, { locale: getUiLocale() })),
        el('p', { class: 'muted' }, explicationBlocThermomix(bloc, row.contexte, { locale: getUiLocale() }))));
    }
    const journalRelu = copier(row.journal_attendu || row);
    const relu = el('input', { type: 'checkbox', name: 'relecture', onChange: e => { relecture = e.target.checked; garder.disabled = !relecture || !montage || readonly() || saving || perime(); } });
    const monte = el('input', { type: 'checkbox', name: 'montage', onChange: e => { montage = e.target.checked; garder.disabled = !relecture || !montage || readonly() || saving || perime(); } });
    const garder = action(t('Garder cette adaptation'), 'garder-tm7', async () => {
      if (!relecture || !montage || saving || readonly() || perime()) return;
      saving = true; garder.disabled = true; relu.disabled = true; monte.disabled = true; synchroniser();
      try {
        await queue; if (!vivant()) return;
        const gardee = await P.garderThermomix({ importId, relu: true, contexteRecette, attendu: journalRelu }, patchDeps());
        if (vivant()) { dire(t('Adaptation conservée')); nav(destinationApresRecette(propreRecette.id,query,ctx,{v:gardee.id})); row = await P.lireBrouillonThermomix(importId, { repo }); renderResultat(); }
      } finally { saving = false; relu.disabled = readonly() || perime(); monte.disabled = readonly() || perime(); garder.disabled = !relecture || !montage || readonly() || perime(); synchroniser(); }
    }, true); garder.disabled = true; relu.disabled = readonly() || perime(); monte.disabled = readonly() || perime();
    propositionZone.append(el('label', { class: 'row top' }, relu, el('span', null, t('J’ai relu les étapes et les réglages proposés.'))),
      el('label', { class: 'row top' }, monte, el('span', null, t('Je vérifierai le couvercle, le montage des accessoires et les repères de remplissage avant de cuisiner.'))), garder);
  }
  async function proposerAdaptation() {
    if (busy || saving || readonly() || perime() || terminal() || !quantitesAcceptees || !draft.selection.length || invalidNumbers.size) return;
    if (!enLigne()) { message(t('Tu es hors ligne. Ton brouillon est conservé.')); return; }
    controller = new AbortController(); const courante = { importId, controller, repo };
    if (!prendreVol(courante)) { message(t('Un appel à l’assistant est déjà en cours. Attends sa fin.')); return; }
    tenue = courante; busy = true; synchroniser(); const g = generation;
    try {
      await persist(); if (!vivant() || g !== generation) return;
      const session = await sessionDe(); sessionDisponible = !!session;
      if (!session) { message(t('Connecte-toi pour utiliser l’assistant.')); return; }
      if (!vivant() || g !== generation) return;
      courante.importId = importId; message(t('Le chef prépare une proposition…'));
      heartbeat = setInterval(() => { repo.battre?.(importId, (deps.maintenant || (() => new Date().toISOString()))()).catch(() => {}); }, BATTEMENT_MS);
      row = await P.proposerThermomix({ importId, session, documentId: DOCUMENT_ID }, patchDeps({ signal: controller.signal, surDepart: depart => { if (vivant() && g === generation) row = depart; },
        sessionCourante: () => vivant() ? (deps.sessionCourante ? deps.sessionCourante() : session) : null }));
      if (!vivant() || g !== generation) return;
      resultat = row.resultat; questions = row.questions || [];
      if (row.contexte?.precisions) draft.precisions = copier(row.contexte.precisions);
      if (row.status === 'echec') message(texteErreurThermomix(row.erreur));
      else if (resultat?.type === 'questions') message(t('Le chef a besoin de précisions. Répondre ne lance pas de nouvel appel.'));
      else if (resultat?.type === 'refus') message(t('Le chef ne propose pas cette adaptation dans le profil actuel.'));
      else message(t('Proposition reçue. Relis-la avant de la conserver.'));
      renderQuestions(); renderResultat();
    } finally {
      clearInterval(heartbeat); heartbeat = null;
      if (courante.importId) await repo.oublierBattement?.(courante.importId).catch(() => {});
      libererVol(courante); if (tenue === courante) tenue = null; controller = null; busy = false; synchroniser();
    }
  }
  const online = () => synchroniser(); window.addEventListener('online', online); window.addEventListener('offline', online);
  retirerReseau = () => { window.removeEventListener('online', online); window.removeEventListener('offline', online); };
  if (row?.status === 'en_cours') { await repo.marquerInterrompus?.(); row = await P.lireBrouillonThermomix(importId, { repo }); resultat = row.resultat; }
  if (row?.status === 'echec') message(texteErreurThermomix(row.erreur));
  renderQuestions(); renderResultat(); synchroniser();
  return root;
}
