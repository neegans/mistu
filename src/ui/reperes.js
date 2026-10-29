import { retourConnu, porteeNavigation } from './navigation-contexte.js';
import { destinationApresRecette } from './actions-contenu.js';
import { revoirLectureImport, memeCaptureImport } from '../domain/contexte-import.js';
import { recetteActiveDansContexte } from './state.js';
import { mentionCycleRecette } from './corbeille.js';
import { capturerRecette } from './recette-garde.js';
// Éditeur de présentation : formulaire disponible hors ligne, appel explicite et comparaison avant conservation.
import { el, toast, confirmDialog } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, remplacerAdresse, buildQuery } from '../core/router.js';
import * as depot from '../model/repo.js';
import * as parcours from '../domain/reperes-parcours.js';
import { construireContexteReperes, lireReperes, formaterDureeReperes, CHAMPS_TEMPS_REPERES } from '../domain/reperes.js';
import { cibleReprise } from '../domain/import-cible.js';
import { pageHeader, field, sessionAssistant, texteRefusAssistant } from './components.js';
import { protegerSaisie } from './state.js';
import { prendreVol, libererVol, volEnCours, DOCUMENT_ID, BATTEMENT_MS } from './vol.js';
const CHAMPS = ['description_fr', 'difficulte', 'temps'], TERMINES = ['enregistre', 'ignore'];
const clone = x => structuredClone(x);
const niveaux = () => ({ facile: t('Facile'), intermediaire: t('Intermédiaire'), avance: t('Avancé'), chef: t('Chef') });
const origines = () => ({ source: t('Source'), estimation_ia: t('Estimation IA'), manuel: t('Saisi par moi') });
export function texteErreurReperes(e) {
  const code = e?.code || e?.raison || e?.message, refus = texteRefusAssistant({ ...e, raison: code }); if (refus) return refus;
  if (['cycle_change','lecture_changee','recette_retiree'].includes(code)) return t('La recette a changé. Rouvre sa fiche avant d’enregistrer.');
  if (code === 'hors_ligne') return t('Tu es hors ligne. Ton brouillon est conservé.');
  if (code === 'non_connecte') return t('Connecte-toi pour utiliser l’assistant.');
  if (code === 'annule' || code === 'interrompu') return t('Appel interrompu. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'source_modifiee' || code === 'source_absente') return t('La version source a changé ou n’est plus disponible. Repars de sa fiche.');
  if (code === 'autre_appareil') return t('Ce brouillon se modifie sur l’appareil qui l’a créé.');
  if (code === 'autre_onglet' || code === 'appel_en_cours') return t('Un appel est déjà en cours. Attends sa fin ou annule-le dans son onglet.');
  if (code === 'compte_change') return t('Le compte a changé. Rouvre la recette pour continuer.');
  if (code === 'reseau') return t('La connexion a été interrompue. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'serveur') return t('L’assistant est temporairement indisponible. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'delai') return t('L’assistant n’a pas répondu à temps. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'reponse_illisible') return t('La réponse de l’assistant n’a pas pu être lue. Ton brouillon est conservé ; aucune relance automatique.');
  if (code === 'refus') return t('L’assistant n’a pas proposé de résultat pour cette demande. Aucun nouvel appel n’est lancé.');
  if (code === 'reprise_modifiee' || code === 'brouillon_modifie') return t('Le brouillon a changé. Actualise-le avant de réessayer.');
  if (code === 'resultat_precedent_a_traiter') return t('Reprends ou écarte le résultat précédent avant de lancer une nouvelle demande.');
  if (code === 'reperes_trop_grands') return t('L’historique de ces repères est plein. Rien n’a été supprimé ; ton brouillon reste disponible.');
  return t('Ces informations ne peuvent pas être conservées. Vérifie les champs et les plages de durée.');
}
function saisieDe(valeurs) {
  const temps = valeurs.temps;
  return { description_fr: valeurs.description_fr?.texte || '', niveau: valeurs.difficulte?.niveau || '', raison: valeurs.difficulte?.raison || '',
    ...Object.fromEntries(['total', 'actif', 'cuisson', 'attentes'].flatMap(k => [['min', temps?.[k]?.min], ['max', temps?.[k]?.max]].map(([borne, valeur]) => [`${k}_${borne}`, valeur == null ? '' : String(valeur)]))),
    attentes_incluses: temps?.attentes_incluses == null ? '' : String(temps.attentes_incluses), complet: temps?.total?.complet === true ? 'true' : 'false', explication: temps?.explication || '' };
}
function correctionsDe(saisie, modifies) {
  const corrections = {};
  for (const k of modifies) {
    if (k === 'description_fr') corrections[k] = saisie.description_fr.trim() ? { texte: saisie.description_fr.trim() } : null;
    if (k === 'difficulte') {
      if (!saisie.niveau && saisie.raison.trim()) throw Error('niveau');
      corrections[k] = saisie.niveau ? { niveau: saisie.niveau, raison: saisie.raison.trim() } : null;
    }
    if (k === 'temps') {
      const durees = Object.fromEntries(['total', 'actif', 'cuisson', 'attentes'].map(nom => {
        const a = saisie[`${nom}_min`].trim(), b = saisie[`${nom}_max`].trim();
        if (!a && !b) return [nom, null];
        if (!/^\d{1,5}$/u.test(a) || !/^\d{1,5}$/u.test(b) || +a > +b || +b > 43200) throw Error('plage');
        return [nom, { min: +a, max: +b, origine: 'manuel', ...(nom === 'total' ? { complet: saisie.complet === 'true' } : {}) }];
      }));
      corrections[k] = Object.values(durees).every(v => v === null) && !saisie.explication.trim() && !saisie.attentes_incluses ? null
        : { ...durees, attentes_incluses: saisie.attentes_incluses === '' ? null : saisie.attentes_incluses === 'true', explication: saisie.explication.trim() };
    }
  }
  return corrections;
}
function resume(valeurs) {
  const niveau = niveaux(), origine = origines(), temps = valeurs?.temps;
  const plage = d => !d ? t('Inconnu') : `${formaterDureeReperes(d)} · ${origine[d.origine] || t('Inconnu')}`;
  return el('div', { class: 'stack' }, el('p', null, valeurs?.description_fr?.texte || t('Description non renseignée')),
    el('p', null, valeurs?.difficulte ? `${niveau[valeurs.difficulte.niveau] || t('Inconnu')} — ${valeurs.difficulte.raison}` : t('Difficulté inconnue')),
    el('dl', { class: 'reperes-durees' }, ...[[t('Temps total'), 'total'], [t('Temps actif'), 'actif'], [t('Cuisson'), 'cuisson'], [t('Repos et attentes'), 'attentes']].flatMap(([label, k]) => [el('dt', null, label), el('dd', null, plage(temps?.[k]))])),
    temps?.total && !temps.total.complet ? el('p', { class: 'muted' }, t('Temps total incomplet')) : null,
    el('p', { class: 'muted' }, temps?.attentes_incluses === true ? t('Attentes incluses dans le total') : temps?.attentes_incluses === false ? t('Attentes exclues du total') : t('Inclusion des attentes inconnue')),
    temps?.explication ? el('p', null, temps.explication) : null);
}
export async function renderReperesRoute(params, query = {}, ctx = {}, deps = {}) {
  const repo = deps.repo || depot, P = deps.parcours || parcours, nav = deps.navigate || navigate, adresse = deps.remplacerAdresse || remplacerAdresse, dire = deps.toast || toast;
  const sessionDe = deps.sessionAssistant || (() => sessionAssistant(ctx)), enLigne = deps.enLigne || (() => navigator.onLine !== false);
  let recipe = await repo.get('recipes', params.id);
  if (!recipe) return el('p', { class: 'status warn' }, t('Recette introuvable.'));
  if (!recetteActiveDansContexte(recipe, ctx)) return mentionCycleRecette(recipe, ctx?.editionsById?.get(recipe.edition_id));
  const contexteRecette = await capturerRecette(repo, recipe, { ctx });
  let row = null;
  if (query.import) {
    try { row = await P.lireBrouillonReperes(query.import, { repo }); }
    catch { return el('p', { class: 'status warn' }, t('Ce brouillon de repères ne peut pas être repris. Repars de la recette.')); }
    if (row.recipe_id !== recipe.id) return el('p', { class: 'status warn' }, t('Ce brouillon appartient à une autre recette.'));
  }
  const versionId = row ? row.source_version_id : (typeof query.v === 'string' ? query.v : recipe.current_version_id || null);
  const version = versionId ? await repo.get('recipe_versions', versionId) : null;
  let contexte;
  try { if (versionId && !version || version && version.recipe_id !== recipe.id || !version && recipe.availability !== 'reference_only') throw Error('source_absente'); contexte = construireContexteReperes({ recipe, version }); }
  catch { return el('p', { class: 'status warn' }, t('Ces informations ne sont pas disponibles pour cette version.')); }
  const lu = lireReperes(recipe, version), initial = Object.fromEntries(CHAMPS.map(k => [k, lu.champs[k].valeur]));
  let saisie = { ...saisieDe(initial), ...row?.saisie }, modifies = new Set(row?.champs_modifies || []), modifiesTemps = new Set(row?.champs_temps_modifies || []);
  let importId = row?.id || null, opening = null, queue = Promise.resolve(), busy = false, saving = false, closed = false, accountChanged = false, mounted = false, conflitBrouillon = false;
  let controller = null, tenue = null, heartbeat = null, relecture = false, sessionLive = await sessionDe();
  const compteInitial = ctx.sync?.user?.id ?? sessionLive?.user?.id ?? null, operations = new Set();
  const lien = `/recipes/${encodeURIComponent(recipe.id)}`, retour = destinationApresRecette(recipe.id,query,ctx,versionId ? { v: versionId } : {});
  const root = el('div', { class: 'stack', dataset: { role: 'reperes' } }), proteger = protegerSaisie(root);
  const status = el('p', { class: 'status', role: 'status', 'aria-live': 'polite', dataset: { role: 'etat-reperes' } }), feedback = el('div', { class: 'stack' });
  const disponibilite = el('p', { class: 'status', role: 'status', 'aria-live': 'polite', dataset: { role: 'disponibilite-assistant' } });
  const comparaison = el('div', { class: 'reperes-comparaison', dataset: { role: 'comparaison-reperes' } });
  const resultatPrecedent = el('section', { class: 'reperes-cadre stack', dataset: { role: 'resultat-precedent' } });
  const inputs = new Map(), controls = [], confirmations = [];
  const readonly = () => !!row && row.device_id !== repo.deviceId(), terminal = () => !!row && TERMINES.includes(row.status);
  const cycleDivergent = () => !!row && !memeCaptureImport(row, contexteRecette);
  const perime = () => conflitBrouillon || !!row?.validation_erreur || cycleDivergent(), vivant = () => !closed && (!mounted || root.isConnected);
  const d = extra => ({ ...deps, repo, enLigne, contexteRecette, documentId: DOCUMENT_ID, ...extra });
  const message = texte => { if (vivant()) status.textContent = texte; };
  function erreurGeste(e) { if (e?.code === 'brouillon_modifie') { conflitBrouillon = true; synchroniser(); } message(texteErreurReperes(e)); }
  function geste(fn) { if (!vivant()) return Promise.resolve(); let p; try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); } p = p.catch(erreurGeste); operations.add(p); p.then(() => operations.delete(p)); return p; }
  const action = (texte, role, fn, primary = false) => el('button', { type: 'button', class: primary ? 'btn primary' : 'btn', dataset: { role }, onClick: () => geste(fn) }, texte);
  let unsubscribe;
  function dispose() {
    if (closed) return; closed = true; sessionLive = null; controller?.abort();
    if (tenue && importId && !accountChanged) P.annulerReperes(importId, d()).catch(() => {});
    clearInterval(heartbeat); observer.disconnect(); unsubscribe?.(); proteger(); window.removeEventListener('hashchange', dispose); window.removeEventListener('online', synchroniser); window.removeEventListener('offline', synchroniser);
  }
  const observer = new MutationObserver(() => { if (root.isConnected) mounted = true; else if (mounted) dispose(); }); observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', dispose); window.addEventListener('online', synchroniser); window.addEventListener('offline', synchroniser);
  unsubscribe = ctx.sync?.auth?.onChange?.(state => { if ((state?.user?.id ?? null) !== compteInitial) { accountChanged = true; dispose(); } });
  root.dispose = dispose; root.etatRoute = () => ({ importId, busy, saving, lectureSeule: readonly(), saisie: clone(saisie) });
  root.attendreEcritures = async () => { await queue.catch(() => {}); while (operations.size) await Promise.all([...operations]); await queue.catch(() => {}); };
  async function ensure() {
    if (importId) return importId;
    if (!opening) opening = P.ouvrirReperes({ recipeId: recipe.id, versionId, contexteRecette }, d()).then(r => { row = r; importId = r.id; if (vivant()) adresse(`#${lien}/reperes${buildQuery({ ...query, import: importId, ...(versionId ? { v: versionId } : {}) })}`); return r.id; }).catch(async e => {
      opening = null;
      if (e.code === 'import_ouvert' && vivant()) { const existant = (await repo.all('imports')).find(i => i.recipe_id === recipe.id && !TERMINES.includes(i.status)); const cible = existant && cibleReprise(existant);
        feedback.replaceChildren(el('p', { class: 'status warn' }, t('Un brouillon ou un import est déjà ouvert pour cette recette. Reprends-le ou termine-le explicitement.')), ...(cible ? [el('a', { class: 'btn', href: '#' + cible }, t('Reprendre le brouillon existant'))] : [])); }
      throw e;
    });
    return opening;
  }
  function persist() {
    const snapshot = clone(saisie), champs = [...modifies], champsTemps = [...modifiesTemps];
    queue = queue.catch(() => {}).then(async () => { if (accountChanged || readonly() || terminal() || perime()) return; const id = await ensure(); if (accountChanged) return; row = await P.modifierBrouillonReperes(id, { saisie: snapshot, champs_modifies: champs, champs_temps_modifies: champsTemps }, d({ attendu: row })); });
    queue.catch(erreurGeste); return queue;
  }
  function champTemps(name) { return name === 'complet' ? 'total' : ['attentes_incluses', 'explication'].includes(name) ? name : name.replace(/_(min|max)$/u, ''); }
  function changed(k, name = null) { if (perime()) return; modifies.add(k); if (k === 'temps') for (const c of name ? [champTemps(name)] : CHAMPS_TEMPS_REPERES) modifiesTemps.add(c); relecture = false; relu.checked = false; persist(); synchroniser(); }
  function control(name, champ, type = 'text', options = {}) {
    const node = el(type === 'textarea' ? 'textarea' : 'input', { ...(type === 'textarea' ? { rows: 3 } : { type }), name, value: saisie[name], ...options, onInput: e => { saisie[name] = e.target.value; changed(champ, name); } });
    inputs.set(name, node); controls.push({ node, champ }); return node;
  }
  function choix(name, champ, values) {
    const node = el('select', { name, onChange: e => { saisie[name] = e.target.value; changed(champ, name); } }, ...values.map(([value, label]) => el('option', { value, selected: value === saisie[name] }, label)));
    inputs.set(name, node); controls.push({ node, champ }); return node;
  }
  function confirmer(k) {
    if (lu.champs[k].etat !== 'perime') return null;
    const button = action(t('Confirmer cette valeur pour cette version'), 'confirmer-' + k, () => { changed(k); button.disabled = true; }); confirmations.push(button);
    return el('div', { class: 'status warn' }, el('p', null, t('À revoir après modification de la recette')), button);
  }
  const formulaire = el('div', { class: 'reperes-formulaire' },
    el('section', { class: 'reperes-cadre stack' }, el('h2', null, t('Description française')), field(t('Description'), control('description_fr', 'description_fr', 'textarea', { maxlength: 400 }), t('Laisser vide garde cette information inconnue.')), confirmer('description_fr')),
    el('section', { class: 'reperes-cadre stack' }, el('h2', null, t('Difficulté')), field(t('Niveau'), choix('niveau', 'difficulte', [['', t('Inconnu')], ...Object.entries(niveaux())])), field(t('Pourquoi ce niveau ?'), control('raison', 'difficulte', 'textarea', { maxlength: 300 })), confirmer('difficulte')));
  const temps = el('section', { class: 'reperes-cadre stack' }, el('h2', null, t('Temps et attentes')), el('p', { class: 'muted' }, t('Renseigne les deux bornes en minutes. Une durée exacte utilise deux valeurs identiques.')));
  for (const [k, label] of [['total', t('Temps total')], ['actif', t('Temps actif')], ['cuisson', t('Cuisson')], ['attentes', t('Repos et attentes')]]) {
    temps.append(el('fieldset', { class: 'reperes-plage' }, el('legend', null, label), field(t('Minimum (min)'), control(k + '_min', 'temps', 'text', { inputmode: 'numeric', maxlength: 5 })), field(t('Maximum (min)'), control(k + '_max', 'temps', 'text', { inputmode: 'numeric', maxlength: 5 }))));
  }
  temps.append(field(t('Attentes comprises dans le total'), choix('attentes_incluses', 'temps', [['', t('Inconnu')], ['true', t('Oui')], ['false', t('Non')]])), field(t('Le total couvre toute la recette'), choix('complet', 'temps', [['false', t('Non ou inconnu')], ['true', t('Oui')]])), field(t('Explication des durées'), control('explication', 'temps', 'textarea', { maxlength: 800 })));
  const confirmationTemps = confirmer('temps'); if (confirmationTemps) temps.append(confirmationTemps); formulaire.append(temps);
  const relu = el('input', { type: 'checkbox', name: 'relecture', onChange: e => { relecture = e.target.checked; synchroniser(); } });
  const validation = el('label', { class: 'row' }, relu, t('J’ai relu la proposition et mes corrections.'));
  const manuel = action(t('Enregistrer mes corrections'), 'enregistrer-reperes', async () => {
    if (busy || saving || readonly() || terminal() || (row?.resultat && !relecture)) return; saving = true; synchroniser();
    try { const corrections = correctionsDe(saisie, modifies); await persist(); if (!vivant()) return;
      recipe = await P.enregistrerCorrectionsReperes({ recipeId: recipe.id, versionId, corrections, champsTempsModifies: [...modifiesTemps], relu: relecture, contexte, importId, contexteRecette, attendu: row }, d());
      row = await P.lireBrouillonReperes(importId, d()); if (vivant()) { dire(t('Informations enregistrées')); nav(retour); }
    } finally { saving = false; synchroniser(); }
  });
  const libelleProposer = () => Object.values(lu.champs).some(c => c.etat === 'courant' || c.etat === 'perime') || row?.resultat
    ? t('Actualiser les informations — 1 appel') : t('Compléter les informations — 1 appel');
  const proposer = action(libelleProposer(), 'proposer-reperes', async () => {
    if (busy || saving || readonly() || terminal() || perime()) return;
    const vol = { importId, controller: new AbortController(), repo }; if (!prendreVol(vol)) { message(texteErreurReperes({ code: 'appel_en_cours' })); return; }
    tenue = vol; controller = vol.controller; busy = true; message(t('Préparation de la proposition…')); synchroniser();
    try {
      await persist(); if (!vivant()) return; sessionLive = await sessionDe(); if (!vivant()) return;
      vol.importId = importId;
      heartbeat = setInterval(() => repo.battre(importId, new Date().toISOString()).catch(() => {}), BATTEMENT_MS);
      row = await P.proposerReperes({ importId, session: sessionLive, documentId: DOCUMENT_ID }, d({ signal: controller.signal, sessionCourante: () => sessionLive }));
      row = await P.lireBrouillonReperes(importId, d());
      if (!vivant()) return;
      if (row.status === 'a_verifier') { remplirProposition(); message(t('Proposition reçue. Relis-la avant de la garder.')); }
      else if (row.erreur) message(texteErreurReperes(row.erreur));
    } finally { clearInterval(heartbeat); if (importId) await repo.oublierBattement(importId).catch(() => {}); libererVol(vol); if (tenue === vol) tenue = null; busy = false; synchroniser(); }
  }, true);
  const garder = action(t('Garder ces informations'), 'garder-reperes', async () => {
    if (busy || saving || !relecture || readonly() || terminal()) return;
    saving = true; synchroniser();
    try { const corrections = correctionsDe(saisie, modifies); await persist(); if (!vivant()) return;
      recipe = await P.garderReperes({ importId, relu: true, corrections, champsTempsModifies: [...modifiesTemps], contexteRecette, attendu: row }, d()); row = await P.lireBrouillonReperes(importId, d());
      if (vivant()) { dire(t('Informations enregistrées')); nav(retour); }
    } finally { saving = false; synchroniser(); }
  }, true);
  const annuler = action(t('Annuler l’appel'), 'annuler-reperes', async () => { if (!tenue) return; controller?.abort(); if (importId) row = await P.annulerReperes(importId, d()); synchroniser(); });
  const ignorer = action(t('Ignorer ce brouillon'), 'ignorer-reperes', async () => {
    if (busy || saving || terminal()) return;
    await queue;
    if (!importId) { if (vivant()) nav(retour); return; }
    const attendu = row;
    if (!(await (deps.confirmDialog || confirmDialog)(t('Ignorer ce brouillon ? Son résultat restera dans le journal, sans être appliqué à la recette.'))) || !vivant()) return;
    saving = true; synchroniser();
    try { row = await P.ignorerReperes(importId, d({ attendu })); if (vivant()) nav(retour); }
    finally { saving = false; synchroniser(); }
  });
  const reprendrePrecedent = action(t('Reprendre le résultat précédent'), 'reprendre-resultat-precedent', async () => {
    if (busy || saving || readonly() || terminal()) return;
    await queue; saving = true; synchroniser();
    try { row = await P.reprendrePropositionReperes(importId, d({ attendu: row })); remplirProposition(); message(t('Proposition reçue. Relis-la avant de la garder.')); }
    finally { saving = false; synchroniser(); }
  });
  const ecarterPrecedent = action(t('Écarter le résultat précédent'), 'ecarter-resultat-precedent', async () => {
    if (busy || saving || readonly() || terminal()) return;
    await queue; const attendu = row;
    if (!(await (deps.confirmDialog || confirmDialog)(t('Écarter ce résultat précédent ? Il ne sera plus disponible dans ce brouillon.'))) || !vivant()) return;
    saving = true; synchroniser();
    try { row = await P.ignorerPropositionPrecedenteReperes(importId, d({ attendu })); }
    finally { saving = false; synchroniser(); }
  });
  const actualiser = action(t('Actualiser le brouillon'), 'actualiser-reperes', async () => { if (!importId || busy || saving) return; row = await P.lireBrouillonReperes(importId, d()); conflitBrouillon = false; relecture = false; relu.checked = false; if (row.resultat) remplirProposition(); else afficherComparaison(); synchroniser(); });
  const revoir = action(t('Relire le résultat conservé'), 'revoir-lecture-cycle', async () => {
    if (busy || saving || readonly() || !cycleDivergent()) return;
    saving = true; synchroniser();
    try {
      await queue;
      await revoirLectureImport(importId, {repo, contexte:contexteRecette});
      row = await P.lireBrouillonReperes(importId, d());
      remplirProposition();
      message(t('Le résultat est conservé. Relis-le et confirme les vérifications avant de le garder.'));
    } finally { saving = false; synchroniser(); }
  });
  const avisCycle = el('div', {class:'status warn'}, el('p', null, t('Cette proposition date d’avant le retrait de la recette. Une nouvelle relecture est nécessaire.')), revoir);
  const copier = action(t('Copier ce brouillon sur cet appareil'), 'copier-reperes', async () => { const copie = await P.copierBrouillonReperes(importId, d()); if (vivant()) nav(`${lien}/reperes${buildQuery({ import: copie.id })}`); });
  function afficherComparaison() {
    comparaison.replaceChildren(); if (!row?.resultat) return;
    comparaison.append(el('section', { class: 'reperes-cadre stack' }, el('h2', null, t('Informations précédentes')), resume(initial)),
      el('section', { class: 'reperes-cadre stack' }, el('h2', null, t('Proposition à relire')), resume(row.resultat)));
  }
  function remplirProposition() {
    const proposition = saisieDe(row.resultat);
    for (const k of CHAMPS) if (k === 'temps' || (!modifies.has(k) && !(lu.champs[k].etat === 'courant' && lu.champs[k].origine === 'manuel'))) {
      const cles = k === 'description_fr' ? ['description_fr'] : k === 'difficulte' ? ['niveau', 'raison'] : Object.keys(proposition).filter(n => !['description_fr', 'niveau', 'raison'].includes(n));
      for (const cle of cles) {
        if (k === 'temps' && (modifiesTemps.has(champTemps(cle)) || (lu.champs.temps.etat === 'courant' && lu.champs.temps.origine === 'manuel' && (lu.champs.temps.champs_modifies || CHAMPS_TEMPS_REPERES).includes(champTemps(cle))))) continue;
        saisie[cle] = proposition[cle]; inputs.get(cle).value = proposition[cle];
      }
    }
    relecture = false; relu.checked = false; afficherComparaison();
  }
  function synchroniser() {
    if (closed) return;
    avisCycle.hidden = !(cycleDivergent() && row?.status === 'a_verifier' && row?.resultat);
    revoir.disabled = busy || saving || readonly();
    const verrou = busy || saving || readonly() || terminal() || row?.status === 'en_cours' || perime();
    for (const { node, champ } of controls) node.disabled = verrou || (!version && champ !== 'description_fr');
    for (const b of confirmations) b.disabled = verrou;
    proposer.disabled = verrou || !sessionLive || !enLigne() || !!volEnCours() || !!row?.proposition_precedente?.tentative_suivante_id;
    proposer.textContent = libelleProposer();
    disponibilite.textContent = !enLigne() ? t('Tu es hors ligne. La saisie manuelle reste disponible.')
      : !sessionLive ? t('Connecte-toi pour utiliser l’assistant. Les corrections manuelles restent disponibles.') : '';
    disponibilite.hidden = !disponibilite.textContent;
    manuel.disabled = verrou || !modifies.size || (!!row?.resultat && !relecture); garder.disabled = verrou || row?.status !== 'a_verifier' || !row?.resultat || !relecture;
    garder.hidden = validation.hidden = !row?.resultat; relu.disabled = verrou;
    annuler.hidden = !tenue; annuler.disabled = !busy || !tenue;
    ignorer.disabled = busy || saving || terminal();
    actualiser.hidden = !row || (!conflitBrouillon && !readonly() && row.status !== 'en_cours'); copier.hidden = !row || !terminal();
    resultatPrecedent.replaceChildren();
    const precedent = row?.proposition_precedente;
    resultatPrecedent.hidden = !precedent;
    if (precedent) {
      resultatPrecedent.append(el('h2', null, t('Résultat précédent conservé')), resume(precedent.resultat));
      if (row.validation_precedente) resultatPrecedent.append(el('p', { class: 'status warn' }, t('La recette a changé depuis ce résultat. Il reste consultable mais ne peut pas être repris ici.')));
      if (precedent.tentative_suivante_id) resultatPrecedent.append(el('p', { class: 'status' }, t('Reprends ou écarte le résultat précédent avant de lancer une nouvelle demande.')));
      reprendrePrecedent.disabled = busy || saving || readonly() || terminal() || !!row.validation_precedente;
      ecarterPrecedent.disabled = busy || saving || readonly() || terminal();
      resultatPrecedent.append(el('div', { class: 'actions' }, reprendrePrecedent, ecarterPrecedent));
    }
  }
  root.append(pageHeader(t('Description en français'), { subtitle: recipe.original_title, back: {...retourConnu({query,portee:ctx.navigation?.portee||porteeNavigation(ctx),repli:retour}),label:t('Retour')} }),
    el('p', { class: 'muted' }, t('Une courte description en français pour comprendre le plat, avec son niveau et ses temps.')),
    el('p', { class: 'muted' }, t('Demande une proposition à relire ou saisis tes informations. Tes corrections sont conservées lors des prochaines propositions.')),
    !version ? el('p', { class: 'status' }, t('Cette référence peut recevoir une description. Importe les étapes pour renseigner la difficulté et les durées.')) : el('details', null, el('summary', null, t('Version affichée utilisée pour ces informations')), el('ul', null, ...contexte.source.ingredients.map(s => el('li', null, s))), el('ol', null, ...contexte.source.etapes.map(s => el('li', null, s)))),
    el('div', { class: 'actions' }, proposer, annuler), disponibilite, status, feedback, avisCycle, resultatPrecedent, formulaire, comparaison, validation, el('div', { class: 'actions' }, manuel, garder, ignorer, actualiser, copier));
  if (row?.resultat) remplirProposition();
  if (readonly()) message(t('Ce brouillon se modifie sur l’appareil qui l’a créé.'));
  else if (row?.validation_erreur) message(texteErreurReperes({ code: row.validation_erreur }));
  else if (row?.erreur) message(texteErreurReperes(row.erreur));
  synchroniser(); return root;
}
