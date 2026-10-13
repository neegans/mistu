// Réglages : préférences (langue de l'interface, langue de lecture, unités), sauvegarde complète et restauration vérifiée,
// exports d'échange, assistant IA, minuterie système, données locales (spec §29.1, §31, §33).
import { el, toast, confirmDialog, promptDialog, pickFiles, downloadBlob, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { createArchive, inspectArchive, applyArchive, verifyRestored } from '../domain/backup.js';
import { toJsonLd, toPaprikaYaml, toReadableSite } from '../domain/exporters.js';
import { createZip } from '../core/zip.js';
import { extFor } from '../domain/backup.js';
import { providerFrom } from '../domain/llm.js';
import { shortcutUrl, SHORTCUT_NAME, isAppleTouchDevice } from '../domain/timers.js';
import { STORES, SYNC_INTERNAL_STORES, APP_VERSION, ARCHIVE_FORMAT_VERSION } from '../model/schema.js';
import { pageHeader, section, field, select, segmented } from './components.js';
import { invalidate, setSyncState, relireReglages, SYNC_ROUTE_KEY } from './state.js';

// Évite deux opérations d’archive concurrentes, même après un changement d’écran.
let archiveOperation = false;

// Archive créée pendant cette session de navigation : seule preuve acceptée avant de changer de compte (spec § 4.1).
// Posée par le bouton d’archive de cette page, jamais déduite d’un réglage ni d’une date.
const ARCHIVE_FLAG = 'cuisineos.archive_created';

export async function renderSettings(params, query, ctx) {
  const s = ctx.settings;
  const root = el('div', null, pageHeader(t('Réglages'), { subtitle: `Cuisine OS ${APP_VERSION}` }));

  // Préférences
  root.append(section(t('Préférences'),
    el('div', { class: 'two-col' },
      field(t('Langue de l’interface'), segmented([{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }], s.ui_locale, (v) => repo.setSetting('ui_locale', v)), t('L’anglais couvre les libellés principaux ; le reste s’affiche en français.')),
      field(t('Langue de lecture des recettes'), segmented([{ value: 'original', label: t('Original') }, { value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }], s.reading_locale, async (v) => { await repo.setSetting('reading_locale', v); refresh(); }), t('Une traduction est affichée avec la mention « Traduction » ; l’original reste conservé.')),
      field(t('Unités souhaitées'), segmented([{ value: 'original', label: t('Original') }, { value: 'metric', label: t('Métrique') }, { value: 'us', label: 'US' }], s.units, async (v) => { await repo.setSetting('units', v); refresh(); }), t('Conversions déterministes ; hypothèses visibles au toucher ; aucune conversion volume↔masse sans équivalence documentée.')),
      field(t('Redécouvrir'), el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: s.rediscover_enabled, onChange: async (e) => { await repo.setSetting('rediscover_enabled', e.target.checked); refresh(); } }), t('Proposer occasionnellement un livre peu consulté (aucune notification, aucun quota).'))),
      field(t('Nom de cet appareil'), el('input', { type: 'text', value: s.device_name || '', placeholder: 'iPhone de Neegan', onChange: (e) => repo.setSetting('device_name', e.target.value.trim()) })))));

  // Synchronisation (spec § 4.2, ensemble L2) : avant « Sauvegarde », car une synchronisation ne la remplace pas.
  const sync = ctx.sync || {};
  const auth = sync.auth || null;
  const pending = await repo.db.count('outbox');
  root.append(syncSection({
    available: !!auth?.available,
    reason: auth ? auth.reason : 'config',
    user: sync.user || null,
    guard: sync.guard || null,
    retour: sync.retour || null,
    pending,
  }, auth, s));

  // Le navigateur ne confirme pas que le téléchargement a été enregistré dans Fichiers.
  const backupStatus = el('div', { class: 'stack' });
  const lb = s.last_backup;
  backupStatus.append(lb
    ? el('div', { class: 'status info' }, t('Dernière archive générée') + ' : ' + formatDate(lb.at, { withTime: true }) + ' — ' + (lb.files || 0) + ' ' + t('fichier(s)') + ', ' + ((lb.bytes || 0) / 1048576).toFixed(1) + ' Mo')
    : el('div', { class: 'status warn' }, t('Aucune génération d’archive enregistrée.')));
  backupStatus.append(el('small', { class: 'muted' }, t('La génération ne confirme pas l’enregistrement du fichier. Retrouve le ZIP dans tes téléchargements ou dans Fichiers ; une restauration dans une base vide permet de vérifier sa récupération.')));
  const showExportWarnings = (warnings) => {
    backupStatus.querySelector('[data-export-warnings]')?.remove();
    if (!warnings?.length) return;
    backupStatus.append(el('div', { class: 'status warn', 'data-export-warnings': true },
      el('p', null, t('Cette copie contient des références incohérentes. Conserve le ZIP ; sa restauration sera refusée tant que ces incohérences ne sont pas résolues.')),
      el('ul', null, ...warnings.slice(0, 10).map((warning) => el('li', null, warning)))));
  };
  showExportWarnings(lb?.warnings);
  const restoreBox = el('div', null);
  const archiveControls = el('div', { class: 'row' });
  const setArchiveBusy = (busy) => {
    archiveOperation = busy;
    for (const button of [...archiveControls.querySelectorAll('button'), ...restoreBox.querySelectorAll('button')]) button.disabled = busy;
  };
  archiveControls.append(
    el('button', { class: 'btn primary', onClick: async (e) => {
      if (archiveOperation) { toast(t('Une opération d’archive est déjà en cours.')); return; }
      const button = e.currentTarget;
      setArchiveBusy(true);
      button.textContent = t('Préparation de l’archive…');
      let generated = false;
      try {
        const { blob, manifest, bytes, warnings } = await createArchive(repo.db, { deviceName: s.device_name });
        downloadBlob(blob, 'cuisine-os-' + manifest.created_at.slice(0, 19).replace(/[:T]/g, '-') + '.zip');
        generated = true;
        // Une archive existe pour cette session : « Changer de compte sur cet appareil » l’exige.
        try { sessionStorage.setItem(ARCHIVE_FLAG, manifest.created_at); } catch { /* stockage indisponible */ }
        showExportWarnings(warnings);
        await repo.setSetting('last_backup', { at: manifest.created_at, counts: manifest.counts, files: manifest.files.length, bytes, state: 'generated', warnings });
        backupStatus.firstChild.replaceWith(el('div', { class: 'status info' }, t('Dernière archive générée') + ' : ' + formatDate(manifest.created_at, { withTime: true }) + ' — ' + (bytes / 1048576).toFixed(1) + ' Mo'));
        toast(t('Archive générée ({n} Mo). Vérifie qu’elle est bien enregistrée.', { n: (bytes / 1048576).toFixed(1) }));
      } catch (err) {
        toast((generated ? t('Archive générée, mais son suivi n’a pas pu être enregistré.') : t('Échec de la sauvegarde')) + ' : ' + err.message);
      } finally {
        button.textContent = t('Sauvegarder toute ma bibliothèque');
        setArchiveBusy(false);
      }
    } }, t('Sauvegarder toute ma bibliothèque')),
    el('button', { class: 'btn', onClick: async () => {
      if (archiveOperation) { toast(t('Une opération d’archive est déjà en cours.')); return; }
      const files = await pickFiles({ accept: '.zip,application/zip', multiple: false });
      if (!files.length) return;
      if (archiveOperation) { toast(t('Une opération d’archive est déjà en cours.')); return; }
      setArchiveBusy(true);
      restoreBox.replaceChildren(el('p', { class: 'muted' }, t('Validation de l’archive… rien n’est écrit.')));
      try {
        const insp = await inspectArchive(await files[0].arrayBuffer());
        restoreBox.replaceChildren(await restoreReport(insp));
      } catch (err) {
        restoreBox.replaceChildren(el('div', { class: 'status danger' }, t('Lecture de l’archive impossible. Rien n’a été modifié.') + ' ' + err.message));
      } finally { setArchiveBusy(false); }
    } }, t('Restaurer une sauvegarde…')));
  root.append(section(t('Sauvegarde'),
    el('p', { class: 'muted' }, t('Archive ZIP privée : manifeste, données par entité, photos et PDF avec empreinte SHA-256. Les secrets d’accès ne sont pas exportés. Une synchronisation ne remplace pas une sauvegarde restaurable.')),
    backupStatus, archiveControls, restoreBox));

  // Exports
  root.append(section(t('Exporter des recettes'),
    el('p', { class: 'muted' }, t('Formats d’échange : la version courante de chaque recette disponible, dans sa langue d’origine. Durées ou portions inconnues omises ; provenance et statut d’adaptation dans les champs source/notes.')),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onClick: () => { const bundles = exportBundles(ctx); downloadBlob(new Blob([JSON.stringify(bundles.map((b) => toJsonLd(b)), null, 2)], { type: 'application/ld+json' }), 'cuisine-os-recettes.jsonld'); } }, t('Recipe / JSON-LD')),
      el('button', { class: 'btn', onClick: () => { const bundles = exportBundles(ctx); downloadBlob(new Blob([toPaprikaYaml(bundles)], { type: 'text/yaml;charset=utf-8' }), 'cuisine-os-recettes.yml'); } }, t('YAML compatible Paprika')),
      el('button', { class: 'btn', onClick: async () => {
        const bundles = exportBundles(ctx, { includeReferences: true }).map((b) => ({ ...b, pages: (b.recipe.source_page_ids || []).map((id) => ctx.pagesById.get(id)).filter(Boolean) }));
        const shas = new Set(bundles.flatMap((b) => b.pages.map((p) => p.sha256)));
        const filesBySha = new Map();
        for (const sha of shas) { const f = await repo.getFile(sha); if (f) filesBySha.set(sha, f); }
        const site = toReadableSite(bundles, filesBySha, { locale: s.ui_locale });
        const entries = [...site.entries];
        for (const [path, f] of site.images) entries.push({ path, data: new Uint8Array(await f.blob.arrayBuffer()) });
        downloadBlob(new Blob([createZip(entries)], { type: 'application/zip' }), 'cuisine-os-copie-lisible.zip');
      } }, t('Créer une copie lisible (HTML)'))),
    el('small', { class: 'muted' }, t('À tester dans les applications cibles (Paprika : Fichier → Importer, YAML). Le HTML se lit hors connexion sans Cuisine OS.'))));

  // Assistant IA
  const llm = { provider: 'none', base_url: '', model: '', api_key: '', ...(s.llm || {}) };
  const llmStatus = el('div', { class: 'muted' });
  root.append(section(t('Assistant IA'),
    el('p', { class: 'muted' }, t('Fournisseur-agnostique. Sans configuration, tout fonctionne à la main. La clé reste sur cet appareil et n’est jamais incluse dans les sauvegardes. Les appels distants n’ont pas été exercés lors du développement : à valider avec une clé réelle.')),
    el('div', { class: 'two-col' },
      field(t('Fournisseur'), select([{ value: 'none', label: t('Aucun (manuel)') }, { value: 'openai_compatible', label: t('API compatible OpenAI (OpenAI, Ollama, LM Studio…)') }, { value: 'anthropic', label: 'Anthropic' }], llm.provider, (v) => { llm.provider = v; })),
      field(t('Modèle'), el('input', { type: 'text', value: llm.model, placeholder: 'ex. gpt-4o / claude-…', onInput: (e) => { llm.model = e.target.value.trim(); } })),
      field(t('URL de base (compatible OpenAI seulement)'), el('input', { type: 'text', value: llm.base_url, placeholder: 'https://api.openai.com/v1', onInput: (e) => { llm.base_url = e.target.value.trim(); } })),
      field(t('Clé API'), el('input', { type: 'password', value: llm.api_key, autocomplete: 'off', onInput: (e) => { llm.api_key = e.target.value.trim(); } }))),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onClick: async () => { await repo.setSetting('llm', llm); toast(t('Assistant enregistré')); } }, t('Enregistrer')),
      el('button', { class: 'btn', onClick: async () => {
        llmStatus.textContent = t('Test en cours…');
        try { const p = providerFrom({ llm }); if (!p.configured) throw new Error(t('Configuration incomplète')); const out = await p.complete([{ role: 'user', content: 'Réponds uniquement : OK' }], { maxTokens: 5 }); llmStatus.textContent = `${t('Réponse')} : ${String(out).slice(0, 80)}`; }
        catch (e) { llmStatus.textContent = `${t('Échec')} : ${e.message}`; }
      } }, t('Tester')),
      llmStatus)));

  // Minuterie système
  root.append(section(t('Minuterie système (iPhone / iPad)'),
    el('p', null, t('Deux voies : demander à Siri toi-même, ou un raccourci nommé « {n} » installé une fois dans l’app Raccourcis. L’app ouvre le raccourci ; elle ne peut pas confirmer que l’alarme a démarré.', { n: SHORTCUT_NAME })),
    el('ol', null,
      el('li', null, t('Raccourcis → + → nom « {n} ».', { n: SHORTCUT_NAME })),
      el('li', null, t('Activer « Recevoir l’entrée depuis » (Texte), puis action « Nombre » depuis l’entrée du raccourci.')),
      el('li', null, t('Action « Démarrer une minuterie » avec la durée = ce nombre, unité réglée sur secondes.')),
      el('li', null, t('Tester ci-dessous : une minuterie de 10 secondes doit apparaître dans Horloge, écran verrouillé ou non.'))),
    el('div', { class: 'row' },
      isAppleTouchDevice() ? el('a', { class: 'btn primary', href: shortcutUrl(10) }, t('Tester le raccourci (10 s)')) : el('span', { class: 'muted' }, t('Le test s’exécute sur iPhone ou iPad.')),
      el('code', { class: 'mono', style: { fontSize: '.8rem' } }, shortcutUrl(480))),
    el('small', { class: 'muted' }, t('Détails et cas à vérifier : docs/raccourci-minuterie.md.'))));

  // Données. Les magasins internes de la synchronisation ne sont pas la bibliothèque : hors des puces (spec § 4.2).
  const visibleStores = Object.keys(STORES).filter((n) => !SYNC_INTERNAL_STORES.includes(n));
  const counts = await Promise.all(visibleStores.map(async (n) => [n, await repo.db.count(n)]));
  root.append(section(t('Données sur cet appareil'),
    el('p', { class: 'muted' }, `${t('Base locale')} « cuisine-os » v${repo.db.version} · ${t('format d’archive')} v${ARCHIVE_FORMAT_VERSION}`),
    el('div', { class: 'chips' }, ...counts.filter(([, c]) => c).map(([n, c]) => el('span', { class: 'chip neutral' }, `${n} : ${c}`))),
    // Promesse de serveur seulement s'il y a un serveur : sans session acceptée, ces données ne sont nulle part ailleurs.
    el('p', { class: 'muted' }, sync.user
      ? t('Cet appareil sera déconnecté ; ta bibliothèque reste sur le serveur.')
      : t('Ces données ne sont que sur cet appareil : fais une sauvegarde avant de les effacer.')),
    el('div', { class: 'row', style: { marginTop: '.8rem' } },
      el('button', { class: 'btn danger', onClick: async () => {
        if (archiveOperation) { toast(t('Une opération d’archive est déjà en cours.')); return; }
        await effacerDonnees({
          user: sync.user || null,
          pending: () => repo.db.count('outbox'),
          confirm: confirmDialog,
          demanderMot: promptDialog,
          toast,
          clearDevice: repo.clearDevice,
          signOut: auth?.signOut || null,
          reload: () => { location.hash = '#/'; location.reload(); },
        });
      } }, t('Effacer les données de cet appareil')))));
  return root;

  async function restoreReport(insp) {
    const box = el('div', { class: 'card flat stack' });
    if (!insp.manifest) { box.append(el('div', { class: 'status danger' }, insp.errors.join(' · '))); return box; }
    const m = insp.manifest;
    box.append(el('div', null, el('strong', null, t('Archive du {d}', { d: formatDate(m.created_at, { withTime: true }) })), ' · ' + t('format') + ' v' + m.format_version));
    if (insp.summary) box.append(el('div', { class: 'chips' },
      ...Object.entries(insp.summary.counts).filter(([, count]) => count).map(([name, count]) => el('span', { class: 'chip neutral' }, name + ' : ' + count)),
      el('span', { class: 'chip neutral' }, t('fichiers vérifiés') + ' : ' + insp.summary.files_ok)));
    for (const warning of insp.warnings) box.append(el('div', { class: 'status warn' }, warning));
    if (!insp.ok) {
      box.append(el('div', { class: 'status danger' }, t('Archive refusée : rien n’a été modifié. Aucune réparation automatique.')),
        el('ul', null, ...insp.errors.slice(0, 30).map((error) => el('li', null, error))));
      return box;
    }
    const controls = el('div', { class: 'row' });
    const result = el('div', { class: 'stack', role: 'status' });
    let appliedOnce = false;
    const apply = async (mode) => {
      if (appliedOnce || archiveOperation) return;
      setArchiveBusy(true);
      let committed = false;
      try {
        const message = mode === 'replace'
          ? t('Remplacer toute la bibliothèque actuelle par l’archive ?')
          : t('Fusionner l’archive par identifiants (aucun doublon, les fiches existantes sont écrasées par celles de l’archive) ?');
        if (!(await confirmDialog(message, { danger: mode === 'replace', okLabel: t('Restaurer') }))) return;
        result.replaceChildren(el('p', { class: 'muted' }, t('Restauration…')));
        await applyArchive(repo.db, insp, { mode });
        committed = true;
        appliedOnce = true;
        controls.remove();
        // L’archive réécrit le magasin « settings » sans passer par setSetting : la porte de confidentialité
        // de la capture (« synchroniser mon historique ») doit suivre la base restaurée, tout de suite.
        await relireReglages();
        invalidate();
        // La vérification peut durer : bloquer immédiatement les commandes fondées sur l’ancien contexte.
        for (const control of root.querySelectorAll('button, input, select, textarea')) control.disabled = true;
        result.replaceChildren(el('p', { class: 'muted' }, t('Données restaurées. Vérification en cours…')));
        const check = await verifyRestored(repo.db, insp, { mode });
        result.replaceChildren(check.ok
          ? el('div', { class: 'status ok' }, t('Restauration vérifiée : contenu des fiches, relations et fichiers contrôlés.'))
          : el('div', { class: 'status danger' }, t('La restauration a été écrite, mais des écarts subsistent. Conserve l’archive et ce bilan.')));
        if (!check.ok) result.append(el('ul', null, ...check.diffs.slice(0, 30).map((diff) => el('li', null, diff))));
        else if (mode === 'merge') result.append(el('small', { class: 'muted' }, t('Les fiches supplémentaires déjà présentes ont été conservées.')));
      } catch (err) {
        result.replaceChildren(el('div', { class: 'status danger' },
          (committed ? t('Données restaurées, mais la vérification n’a pas pu se terminer. Conserve l’archive.') : t('Restauration annulée : aucune écriture de cet import n’a été conservée.')) + ' ' + err.message));
      } finally {
        setArchiveBusy(false);
        if (committed) {
          // Les contrôles ont été construits avec l’ancien contexte : aucun export
          // ni réglage ne doit le réutiliser après remplacement de la bibliothèque.
          for (const control of root.querySelectorAll('button, input, select, textarea')) control.disabled = true;
          result.append(el('p', { class: 'muted' }, t('Recharge l’application pour utiliser les données restaurées.')),
            el('button', { class: 'btn', onClick: () => location.reload() }, t('Recharger l’application')));
        }
      }
    };
    const empty = await repo.db.isEmpty(['unit_definitions', 'unit_conventions', 'ingredients', 'settings']);
    controls.append(
      el('button', { class: 'btn primary', onClick: () => apply('merge') }, empty ? t('Restaurer dans cette base vide') : t('Fusionner avec la bibliothèque actuelle')),
      empty ? null : el('button', { class: 'btn danger', onClick: () => apply('replace') }, t('Remplacer toute la bibliothèque')));
    box.append(controls, result);
    return box;
  }
}

// Un élément en attente ou plusieurs : deux phrases, jamais un pluriel calculé sur une chaîne traduite.
const messageEnAttente = (n) => (n === 1
  ? t('1 élément n’est pas encore envoyé.')
  : t('{n} éléments ne sont pas encore envoyés.', { n }));

// Même règle pour la perte annoncée avant « Changer de compte » : zéro et un prennent le singulier en français.
const messagePerte = (n) => (n > 1
  ? t('{n} envois en attente seront perdus — ils sont dans l’archive.', { n })
  : t('{n} envoi en attente sera perdu — il est dans l’archive.', { n }));

// « Effacer les données de cet appareil » (spec § 4.2) : décision et effets, sans DOM ni base — toutes les
// dépendances sont injectées, pour que le geste le plus destructeur de l'app soit éprouvé plutôt que relu.
// R24 : le refus pour file non vide ne vaut QUE s'il existe un compte. Sans compte, rien ne videra jamais la file
// (il n'y a pas d'envoi en L2, et « Abandonner cet envoi » est L3) : le refus rendrait le bouton mort pour toujours,
// dès la première écriture ordinaire. Sans compte, on passe donc au double contrôle, qui dit déjà la perte.
export async function effacerDonnees({ user = null, pending, confirm, demanderMot, toast: dire, clearDevice, signOut = null, reload }) {
  // La file est relue au moment du geste : elle a pu bouger depuis le rendu de la page.
  const enAttente = await pending();
  if (user && enAttente > 0) { dire(messageEnAttente(enAttente)); return false; }
  if (!(await confirm(t('Effacer les données de cet appareil ? Fais d’abord une sauvegarde.'), { danger: true, okLabel: t('Continuer') }))) return false;
  const mot = await demanderMot(t('Tape EFFACER pour confirmer'));
  if (mot !== 'EFFACER') { dire(t('Annulé')); return false; }
  await clearDevice({ signOut });
  dire(t('Données effacées'));
  reload();
  return true;
}

// « Changer de compte sur cet appareil » (spec § 4.1) : l’archive est exigée, la perte est nommée, puis tout
// ce qui est local est effacé. Aucune donnée n’est envoyée nulle part : la file en attente est perdue, dite perdue.
// `archiveCreated` est une lecture, pas une valeur : si elle lève (stockage de session inaccessible), on refuse —
// échec fermé, cohérent avec le reste du lot.
export async function changerDeCompte({ confirm, toast: dire, pending, archiveCreated, clearDevice, signOut = null, reload }) {
  let archive = null;
  try { archive = archiveCreated(); }
  catch { dire(t('Le stockage de session est inaccessible : ce geste n’est pas possible ici.')); return false; }
  if (!archive) { dire(t('Fais d’abord une archive sur cette page.')); return false; }
  if (!(await confirm(t('Changer de compte sur cet appareil ? Toutes les données de cet appareil seront effacées.'), { danger: true, okLabel: t('Continuer') }))) return false;
  const enAttente = await pending(); // compté au moment du geste : la file a pu bouger depuis le rendu
  if (!(await confirm(messagePerte(enAttente), { danger: true, okLabel: t('Changer de compte') }))) return false;
  await clearDevice({ signOut });
  reload();
  return true;
}

// Consentement à l'historique de consultation (spec § 4.2, D6 ; R27). Le réglage est écrit D'ABORD — la capture le
// relit et se referme — puis ce qui attendait de partir est retiré de la file : un retrait de consentement qui
// laisse partir la file n'est pas un retrait. Rend le nombre d'entrées retirées.
export async function reglerHistorique(actif, { setSetting = repo.setSetting, oublierEnvois = repo.oublierEnvois } = {}) {
  await setSetting('sync_activity', actif === true);
  return actif === true ? 0 : await oublierEnvois('library_activity');
}

// Les trois seuls gestes de la section. Le modèle ne peut nommer qu'eux, et le rendu ignore une action inconnue :
// un renommage donne un bouton manquant (visible), jamais un bouton muet.
export const SYNC_ACTIONS = ['signIn', 'signOut', 'changeAccount'];

// Départ chez le fournisseur. La route courante est mémorisée (redirectTo part sans fragment, le retour atterrirait
// sur l’accueil) et RETIRÉE si rien ne part : une route fantôme détournerait le prochain démarrage de cet onglet.
export async function demarrerConnexion(auth, hash = location.hash) {
  try { sessionStorage.setItem(SYNC_ROUTE_KEY, hash || ''); } catch { /* stockage indisponible */ }
  const essai = await auth?.signIn();
  // signIn() rend l’erreur brute du fournisseur : jamais affichée, seulement une phrase fixe.
  if (!essai || essai.error) {
    try { sessionStorage.removeItem(SYNC_ROUTE_KEY); } catch { /* stockage indisponible */ }
    toast(t('La connexion n’a pas pu démarrer.'));
  }
}

// Rendu de la section : le modèle dit quoi écrire et quels gestes offrir ; les gestes sont câblés ici.
function syncSection(state, auth, settings) {
  const model = syncSectionModel(state);
  const gestes = {
    signIn: () => demarrerConnexion(auth),
    signOut: async () => {
      const essai = await auth?.signOut();
      if (essai?.error) { toast(t('La déconnexion n’a pas abouti.')); return; }
      setSyncState({ user: null, guard: null }); // la file d’envoi et les données restent intactes (spec § 4.1)
      refresh();
    },
    changeAccount: () => changeAccount(auth),
  };
  const boutons = model.buttons.filter((b) => Object.hasOwn(gestes, b.action));
  return section(model.title,
    ...model.lines.map((line) => el('p', { class: 'muted' }, line)),
    boutons.length
      ? el('div', { class: 'row' }, ...boutons.map((b) => el('button', { class: 'btn' + (b.tone ? ' ' + b.tone : ''), onClick: gestes[b.action] }, b.label)))
      : null,
    field(t('Historique de consultation'),
      el('label', { class: 'check' },
        el('input', { type: 'checkbox', checked: settings.sync_activity === true, onChange: async (e) => { await reglerHistorique(e.target.checked); refresh(); } }),
        t('Synchroniser mon historique de consultation')),
      t('Désactivé, ce que tu consultes reste sur cet appareil. Le décocher retire aussi ce qui attendait d’être envoyé.')));
}

// Câblage du geste « Changer de compte sur cet appareil » : la décision et les effets vivent dans changerDeCompte().
async function changeAccount(auth) {
  if (archiveOperation) { toast(t('Une opération d’archive est déjà en cours.')); return; }
  await changerDeCompte({
    confirm: confirmDialog,
    toast,
    pending: () => repo.db.count('outbox'),
    archiveCreated: () => sessionStorage.getItem(ARCHIVE_FLAG), // peut lever : changerDeCompte refuse alors le geste
    clearDevice: repo.clearDevice,
    signOut: auth?.signOut || null,
    reload: () => location.reload(),
  });
}

// Modèle pur de la section « Synchronisation » (spec § 4.2, ensemble L2) : ce que la section dit et ce qu’elle offre.
// Aucun DOM, aucun appel réseau, aucune lecture de base : testable tel quel, consommé par syncSection().
// Rien n’est deviné : sans adresse connue la ligne reste vide, et un refus du fournisseur n’est jamais détaillé.
export function syncSectionModel({ available = false, reason = null, user = null, pending = 0, guard = null, retour = null } = {}) {
  const lines = [];
  const buttons = [];
  if (!available) {
    // Deux indisponibilités distinctes, nommées : elles n’appellent pas la même suite.
    lines.push(reason === 'bibliotheque'
      ? t('La bibliothèque de synchronisation n’a pas été chargée.')
      : t('Synchronisation non configurée sur cette adresse.'));
  } else if (guard && guard.ok === false) {
    // Garde de compte refusée : la synchronisation reste désactivée, avec deux issues (R22). La douce d'abord :
    // se déconnecter ne touche ni les données ni la file ; changer de compte efface l'appareil.
    lines.push(guard.message || t('Cet appareil ne peut pas vérifier le compte.'));
    buttons.push({ action: 'signOut', label: t('Se déconnecter'), tone: '' });
    buttons.push({ action: 'changeAccount', label: t('Changer de compte sur cet appareil'), tone: 'danger' });
  } else if (user && guard?.ok) {
    lines.push(t('Connectée : {e}', { e: user.email || '' }));
    lines.push(t('À envoyer : {n}', { n: pending }));
    buttons.push({ action: 'signOut', label: t('Se déconnecter'), tone: '' });
  } else {
    lines.push(t('Tes données restent sur cet appareil.'));
    buttons.push({ action: 'signIn', label: t('Activer la synchronisation'), tone: 'primary' });
  }
  // Retour du fournisseur : dit après l’état, sans jamais prétendre en connaître la cause.
  if (retour?.codeSansSession) lines.push(t('La connexion n’a pas abouti.'));
  if (retour?.error) lines.push(retour.error);
  return { title: t('Synchronisation'), lines, buttons };
}

function exportBundles(ctx, { includeReferences = false } = {}) {
  return ctx.docs.filter((d) => includeReferences || d.version).map((d) => ({ recipe: d.recipe, version: d.version, book: d.book, edition: d.edition }));
}

export { extFor };
