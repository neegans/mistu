import { documentsActifs } from './state.js';
// Réglages : préférences (langue de l'interface, langue de lecture, unités), sauvegarde complète et restauration vérifiée,
// exports d'échange, assistant IA, minuterie système, données locales (spec §29.1, §31, §33).
import { el, toast, confirmDialog, promptDialog, pickFiles, downloadBlob, formatDate } from '../core/dom.js';
import { t, getUiLocale } from '../core/i18n.js';
import { refresh, currentPath } from '../core/router.js';
import * as repo from '../model/repo.js';
import { logError } from '../core/log.js';
import { reprendreEnvoi, retirerEnvoi, fileDe } from '../sync/outbox.js';
import { garderIci, garderAilleurs, ignorerRenvoye, abandonnerConflitCycle } from '../sync/conflits.js';
import { retirerMarqueur } from '../sync/backfill.js';
import { referencesFichiers, nomFichier, lireErreursFichiers, MAGASINS_FICHIERS } from '../sync/fichiers.js';
import { createArchive as createArchiveReel, inspectArchive, applyArchive, verifyRestored, compterFichesSynchronisees } from '../domain/backup.js';
import { syncNow } from '../sync/clock.js';
import { toJsonLd, toPaprikaYaml, toReadableSite } from '../domain/exporters.js';
import { gardeThermomix } from '../domain/thermomix.js';
import { createZip } from '../core/zip.js';
import { extFor } from '../domain/backup.js';
import { etatAssistant, sessionValide } from '../domain/passerelle.js';
import { shortcutUrl, SHORTCUT_NAME, isAppleTouchDevice } from '../domain/timers.js';
import { STORES, SYNC_INTERNAL_STORES, APP_VERSION, ARCHIVE_FORMAT_VERSION } from '../model/schema.js';
import { pageHeader, section, field, segmented, majPastille, sessionAssistant, TEXTE_CONNEXION, boutonSeConnecter, messageGardeRefusee, motifFichier } from './components.js';
import { invalidate, setSyncState, getSyncState, relireReglages, SYNC_ROUTE_KEY } from './state.js';

// Évite deux opérations d’archive concurrentes, même après un changement d’écran.
let archiveOperation = false;

// Lu par la coquille (app.js) : une opération d’archive porte un état qui ne vit QUE dans le DOM — contrôles
// désactivés, bilan de restauration, bouton « Recharger l’application ». Un rendu demandé par le moteur au milieu
// reconstruirait la page et emporterait tout cela, pendant que l’archive écrit (R-L3-16).
export const archiveEnCours = () => archiveOperation;

// Archive créée pendant cette session de navigation : seule preuve acceptée avant de changer de compte (spec § 4.1).
// Posée par le bouton d’archive de cette page, jamais déduite d’un réglage ni d’une date.
const ARCHIVE_FLAG = 'cuisineos.archive_created';

// Injections (lot G, tâche 2) : createArchive, pickFiles (le choix de l’archive à restaurer) et telechargerArchive (l’enregistrement de l’archive
// créée) — le bilan de création et le vrai rapport d’inspection s’éprouvent sans téléchargement réel dans le Chrome sans tête.
export async function renderSettings(params, query, ctx, { fetch, createArchive = createArchiveReel, pickFiles: choisirArchive = pickFiles, telechargerArchive = downloadBlob, telechargerRecettes = downloadBlob } = {}) {
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

  // Synchronisation (spec § 4.2, ensembles L2 et L3) : avant « Sauvegarde », car une synchronisation ne la remplace
  // pas. La file est lue UNE fois : son compte et ses entrées en quarantaine viennent de la même lecture.
  const sync = ctx.sync || {};
  const auth = sync.auth || null;
  // R-L3-24 : « À envoyer » et la liste de quarantaine portent sur la file de CE compte (`fileDe`, une seule
  // définition, celle que l'envoi relit). Une entrée d'un autre compte ne partira jamais d'ici : l'annoncer serait
  // une attente que personne ne tient. Les gardes des gestes destructeurs, elles, comptent la file ENTIÈRE — voir
  // plus bas : ce qu'elles protègent, c'est tout ce qui attend encore sur cet appareil, à qui qu'il appartienne.
  const file = await fileDe(repo.db, sync.user?.id || null);
  const quarantaine = file.filter((e) => e.quarantined_at);
  const conflits = await repo.db.getAll('sync_conflicts');
  // Le moteur est posé par le démarrage (L3, tâche 9) : tant qu'il n'est pas là, rien de L3 n'est affiché.
  const moteur = getSyncState().moteur || null;
  suivreMoteurDeLaPage(moteur);
  // Lot G (§ 4.1) : les erreurs de fichiers et le snapshot (pour nomFichier) sont lus au rendu, comme la quarantaine — seulement s'il y a un moteur.
  // Ronde 1 : le snapshot (sept magasins, `files` entier) n'est lu que s'il y a une erreur à nommer — c'est son seul usage. Réglages se redessine
  // au plus toutes les 300 ms pendant une passe : sans cette garde, l'écran relirait `files` à chaque fois (S-12 contournée par l'écran).
  const etatMoteur = moteur?.etat() || null;
  const fichiersErreurs = etatMoteur ? [...(await lireErreursFichiers(repo.db))].map(([sha256, v]) => ({ sha256, motif: v?.motif, sens: v?.sens })) : [];
  // Vague finale (chef d'orchestre, I-G8) : une ligne files en quarantaine ou en conflit est nommée comme une erreur de fichier (nomFichier), jamais
  // par son empreinte — le snapshot est donc lu aussi dans ces deux cas, rares.
  const ligneFiles = (e) => e?.store === 'files';
  const snapshotFichiers = fichiersErreurs.length || quarantaine.some(ligneFiles) || conflits.some(ligneFiles) ? await repo.db.getSnapshot(MAGASINS_FICHIERS) : null;
  root.append(syncSection({
    available: !!auth?.available,
    reason: auth ? auth.reason : 'config',
    user: sync.user || null,
    guard: sync.guard || null,
    retour: sync.retour || null,
    pending: file.length,
    enAttente: sync.enAttente === true, // R28 : le démarrage n’a pas abouti dans sa borne de temps
    moteur: etatMoteur,
    quarantaine,
    conflits,
    fichiersErreurs,
    qualite: s.upload_quality,
    snapshot: snapshotFichiers,
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
        const { blob, manifest, bytes, warnings, missingFiles = 0, copies, tracesOrphelines = 0 } = await createArchive(repo.db, { deviceName: s.device_name });
        telechargerArchive(blob, 'cuisine-os-' + manifest.created_at.slice(0, 19).replace(/[:T]/g, '-') + '.zip');
        generated = true;
        // § 4.6 : le bilan de création, une phrase par cas (pages manquantes, copies du serveur, octets inconnus) ; rien à dire, rien de dit. Posé
        // juste après le téléchargement (ronde 1, #16) : un suivi qui échoue plus bas ne le fait pas taire ; l'ancien bilan part d'abord.
        backupStatus.querySelector('[data-role="bilan-archive"]')?.remove();
        const bilanArchive = messagesArchive({ missingFiles, copies, tracesOrphelines }); // lot E (R-E-11) : les traces écartées, dans le même bilan
        if (bilanArchive.length) backupStatus.append(el('div', { class: 'status warn', dataset: { role: 'bilan-archive' } }, ...bilanArchive.map((p) => el('p', null, p))));
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
      const files = await choisirArchive({ accept: '.zip,application/zip', multiple: false });
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
  const etatExport = el('div', { class: 'stack', role: 'status', 'aria-live': 'polite', dataset: { role: 'etat-export-recettes' } });
  const preparerExport = async (includeReferences, exporter) => {
    try {
      const bundles = exportBundles(ctx, { includeReferences });
      const invalides = bundles.filter(b => !gardeThermomix(b.version).ok);
      if (invalides.length) {
        etatExport.replaceChildren(el('p', { class: 'status warn' }, t('L’export est bloqué : ces recettes contiennent des réglages TM7 à revoir. Aucune recette n’a été exportée.')),
          ...invalides.map(b => el('a', { class: 'btn link', href: `#/recipes/${encodeURIComponent(b.recipe.id)}?v=${encodeURIComponent(b.version.id)}` },
            t('Revoir la recette source'), ' — ', b.recipe.display_title || b.recipe.original_title)));
        return;
      }
      etatExport.replaceChildren();
      await exporter(bundles);
    } catch {
      etatExport.replaceChildren(el('p', { class: 'status warn' }, t('L’export n’a pas pu être préparé. Réessaie.')));
    }
  };
  root.append(section(t('Exporter des recettes'),
    el('p', { class: 'muted' }, t('Formats d’échange : la version courante de chaque recette disponible, dans sa langue d’origine. Durées ou portions inconnues omises ; provenance et statut d’adaptation dans les champs source/notes.')),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onClick: () => preparerExport(false, bundles => telechargerRecettes(new Blob([JSON.stringify(bundles.map((b) => toJsonLd(b)), null, 2)], { type: 'application/ld+json' }), 'cuisine-os-recettes.jsonld')) }, t('Recipe / JSON-LD')),
      el('button', { class: 'btn', onClick: () => preparerExport(false, bundles => telechargerRecettes(new Blob([toPaprikaYaml(bundles)], { type: 'text/yaml;charset=utf-8' }), 'cuisine-os-recettes.yml')) }, t('YAML compatible Paprika')),
      el('button', { class: 'btn', onClick: () => preparerExport(true, async disponibles => {
        const bundles = disponibles.map((b) => ({ ...b, pages: (b.recipe.source_page_ids || []).map((id) => ctx.pagesById.get(id)).filter(Boolean) }));
        const shas = new Set(bundles.flatMap((b) => b.pages.map((p) => p.sha256)));
        const filesBySha = new Map();
        for (const sha of shas) { const f = await repo.getFile(sha); if (f) filesBySha.set(sha, f); }
        const site = toReadableSite(bundles, filesBySha, { locale: s.ui_locale });
        const entries = [...site.entries];
        for (const [path, f] of site.images) entries.push({ path, data: new Uint8Array(await f.blob.arrayBuffer()) });
        telechargerRecettes(new Blob([createZip(entries)], { type: 'application/zip' }), 'cuisine-os-copie-lisible.zip');
      }) }, t('Créer une copie lisible (HTML)'))), etatExport,
    el('small', { class: 'muted' }, t('À tester dans les applications cibles (Paprika : Fichier → Importer, YAML). Le HTML se lit hors connexion sans Cuisine OS.'))));

  // Assistant IA (Passerelle T4) : plus de configuration ici — la clé vit côté serveur. La section dit si l'assistant est actif pour ce
  // compte (session lue, bornée à 2 s, comme les écrans) et l'état vient d'un GET de la passerelle. `fetch` : injecté par les tests.
  root.append(sectionAssistant({ sync, session: await sessionAssistant(ctx) }, { fetch }));

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
      // Vague finale du lot G, ronde 2 (R-G-28 bis) : la perte est dite — fichiers pas encore envoyés (photos, PDF, EPUB : D-G8, seuls ceux à remote de
      // ce compte sont partis) et, en qualité réduite, l'original d'une photo envoyée (le serveur n'en a que la copie réduite).
      ? t('Cet appareil sera déconnecté ; ta bibliothèque reste sur le serveur, sauf les photos et documents pas encore envoyés (une photo envoyée en qualité réduite n’y garde que sa copie réduite).')
      : t('Ces données ne sont que sur cet appareil : fais une sauvegarde avant de les effacer.')),
    el('div', { class: 'row', style: { marginTop: '.8rem' } },
      el('button', { class: 'btn danger', onClick: async () => {
        if (archiveOperation) { toast(t('Une opération d’archive est déjà en cours.')); return; }
        // La file est relue AU MOMENT du geste (elle a pu bouger depuis le rendu) et une seule fois : les deux
        // nombres doivent venir du même instant, sinon le refus pourrait annoncer une quarantaine qui n'est plus
        // dans le total qu'il chiffre.
        // R-L3-24 ne s'applique PAS ici, et c'est voulu : ce geste efface la base, donc tout ce qui attend sur cet
        // appareil — à qui qu'il appartienne. Un filtre par compte affaiblirait la garde au lieu de la préciser.
        let fileDuGeste = null;
        const lireFile = async () => (fileDuGeste ??= await repo.db.getAll('outbox'));
        await effacerDonnees({
          user: sync.user || null,
          pending: async () => (await lireFile()).length,
          enQuarantaine: async () => (await lireFile()).filter((e) => e.quarantined_at).length,
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
    // § 4.6 (lot G) : pages manquantes et copies du serveur, en puces ; la phrase dessous ne promet aucun téléchargement (B-8). Sur une archive
    // REFUSÉE, ni l'une ni l'autre (ronde 1, #15 : I5, rien n'est annoncé sans fait).
    const ins = insp.ok ? phrasesInspection(insp.summary || {}) : { puces: [], phrases: [] };
    if (insp.summary) box.append(el('div', { class: 'chips' },
      ...Object.entries(insp.summary.counts).filter(([, count]) => count).map(([name, count]) => el('span', { class: 'chip neutral' }, name + ' : ' + count)),
      el('span', { class: 'chip neutral' }, t('fichiers vérifiés') + ' : ' + insp.summary.files_ok),
      ...ins.puces.map((p) => el('span', { class: 'chip neutral' }, p))));
    for (const phrase of ins.phrases) box.append(el('div', { class: 'status info' }, phrase));
    // Avec un compte, une restauration n’est pas seulement locale : tout ce qu’elle écrit repart au serveur, donc
    // sur les autres appareils. La personne doit le savoir AVANT le geste, et avec un nombre, pas une allusion.
    const renvoi = getSyncState().user ? messageRenvoi(compterFichesSynchronisees(insp)) : null;
    if (renvoi) box.append(el('div', { class: 'status info' }, renvoi));
    for (const warning of insp.warnings) box.append(el('div', { class: 'status warn' }, warning));
    if (!insp.ok) {
      box.append(el('div', { class: 'status danger' }, t('Archive refusée : rien n’a été modifié. Aucune réparation automatique.')),
        el('ul', null, ...insp.errors.slice(0, 30).map((error) => el('li', null, error))));
      return box;
    }
    const controls = el('div', { class: 'row' });
    const result = el('div', { class: 'stack', role: 'status' });
    let appliedOnce = false;
    // Le geste : la décision (R31) vit dans restaurerArchive(), les effets dans appliquerArchive().
    const apply = (mode) => restaurerArchive({
      mode,
      pending: () => repo.db.count('outbox'),
      toast,
      appliquer: () => appliquerArchive(mode),
    });
    const appliquerArchive = async (mode) => {
      if (appliedOnce || archiveOperation) return;
      setArchiveBusy(true);
      let committed = false;
      try {
        const message = mode === 'replace'
          ? t('Remplacer toute la bibliothèque actuelle par l’archive ?')
          : t('Fusionner l’archive par identifiants (aucun doublon, les fiches existantes sont écrasées par celles de l’archive) ?');
        if (!(await confirmDialog(message, { danger: mode === 'replace', okLabel: t('Restaurer') }))) return;
        result.replaceChildren(el('p', { class: 'muted' }, t('Restauration…')));
        // Renvoi voulu (spec § 5.2, R-L3-18) : connectée, une restauration réhorodate ce qu’elle écrit — en fusion
        // comme en remplacement — sinon le serveur garderait sa version (I7) et rien ne se verrait ailleurs.
        // Le compte est relu AU MOMENT du geste : la session a pu changer depuis le rendu de la page.
        const reHorodatage = !!getSyncState().user;
        const bilanRestauration = await applyArchive(repo.db, insp, { mode, horodater: reHorodatage ? syncNow : null });
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
        const check = await verifyRestored(repo.db, insp, { mode, horodate: reHorodatage });
        result.replaceChildren(check.ok
          ? el('div', { class: 'status ok' }, t('Restauration vérifiée : contenu des fiches, relations et fichiers contrôlés.'))
          : el('div', { class: 'status danger' }, t('La restauration a été écrite, mais des écarts subsistent. Conserve l’archive et ce bilan.')));
        if (!check.ok) result.append(el('ul', null, ...check.diffs.slice(0, 30).map((diff) => el('li', null, diff))));
        else if (mode === 'merge') result.append(el('small', { class: 'muted' }, t('Les fiches supplémentaires déjà présentes ont été conservées.')));
        // R-G-6 : les originaux de cet appareil gardés (l’archive portait des copies), dits après le statut de verifyRestored.
        const conserves = messageOriginauxConserves(bilanRestauration?.originauxConserves);
        if (conserves) result.append(el('p', { class: 'muted' }, conserves));
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
    box.append(controls);
    // Ce qu’un remplacement ne fait PAS (R-L3-18) : il vide cet appareil, pas le serveur. Aucune tombale n’est
    // envoyée pour ce qui manque à l’archive, donc ces fiches reviendront à la prochaine réception. Dit à côté du
    // bouton qui en décide, et pas dans le bilan — celui-ci est commun aux deux modes.
    const horsArchive = empty ? null : messageRemplacementServeur(!!getSyncState().user);
    if (horsArchive) box.append(el('small', { class: 'muted' }, horsArchive));
    // B-28 (lot G) : un remplacement vide `files` puis réécrit — les octets locaux des pages absentes de l’archive partent d’ici ; une page que
    // l’archive nomme sans ses octets (missing_files) garde ceux d’ici (ronde 1, #4, #8 : decisionManquante), la phrase reste donc exacte.
    if (!empty) box.append(el('small', { class: 'muted' }, t('Les pages de cet appareil absentes de l’archive seront retirées d’ici.')));
    box.append(result);
    return box;
  }
}

// Un élément en attente ou plusieurs : deux phrases, jamais un pluriel calculé sur une chaîne traduite.
// L3 : s'il y a de la quarantaine, le refus doit dire POURQUOI la file ne se videra pas d'elle-même et où est la
// sortie — « Envoyer maintenant » ne débloquera jamais une entrée refusée, seul « Abandonner cet envoi » le fait.
const messageEnAttente = (n, m = 0) => {
  if (m > 0) {
    return n === 1
      ? t('1 élément n’est pas encore envoyé, et il est en quarantaine : « Abandonner » d’abord.')
      : t('{n} éléments ne sont pas encore envoyés (dont {m} en quarantaine : « Abandonner » d’abord).', { n, m });
  }
  return n === 1
    ? t('1 élément n’est pas encore envoyé.')
    : t('{n} éléments ne sont pas encore envoyés.', { n });
};

// Remplacement d'archive refusé (R31) : deux chaînes, jamais un pluriel calculé sur une chaîne traduite.
const messageRemplacementRefuse = (n) => (n === 1
  ? t('1 élément est en attente d’envoi. Restaure en fusion, ou efface d’abord les données de cet appareil.')
  : t('{n} éléments sont en attente d’envoi. Restaure en fusion, ou efface d’abord les données de cet appareil.', { n }));

// Ce qu’une restauration va renvoyer au serveur (spec § 5.2) : deux chaînes, jamais un pluriel calculé sur une
// chaîne traduite. Rien du tout à zéro — une archive sans fiche synchronisée ne promet aucun envoi.
export const messageRenvoi = (n) => {
  if (!(n > 0)) return null;
  return n === 1 ? t('1 fiche sera renvoyée au serveur.') : t('{n} fiches seront renvoyées au serveur.', { n });
};

// R-E-11 (lot E, § 3.7) : le bilan d'une sauvegarde qui a écarté des traces de consultation orphelines. null hors entier ≥ 1 (rien à dire).
export function texteTracesOrphelines(n) {
  if (!Number.isInteger(n) || n < 1) return null;
  return n === 1 ? t('{n} trace de consultation orpheline ignorée', { n }) : t('{n} traces de consultation orphelines ignorées', { n });
}

// Bilan de création (§ 4.6) : une phrase par cas, jamais un pluriel calculé sur une chaîne traduite. Rien à dire → rien de dit. Lot E (R-E-11) : les
// traces de consultation écartées de l'archive sont un cas de plus (texteTracesOrphelines), dans le même bilan.
export function messagesArchive({ missingFiles = 0, copies = { serveur: 0, inconnues: 0 }, tracesOrphelines = 0 } = {}) {
  const sortie = [];
  if (missingFiles === 1) sortie.push(t('1 page n’est pas encore téléchargée sur cet appareil et n’est pas dans l’archive.'));
  else if (missingFiles > 1) sortie.push(t('{n} pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l’archive.', { n: missingFiles }));
  if (copies?.serveur > 0) sortie.push(t('{n} fichier(s) archivé(s) sont des copies du serveur, pas l’original.', { n: copies.serveur }));
  if (copies?.inconnues > 0) sortie.push(t('{n} fichier(s) archivé(s) ont des octets qui ne sont ni l’original ni la copie du serveur connue : archivés tels quels.', { n: copies.inconnues }));
  const traces = texteTracesOrphelines(tracesOrphelines);
  if (traces) sortie.push(traces);
  return sortie;
}

// Inspection (§ 4.6, B-8) : rien n'est promis comme « se téléchargera » — une entrée sans remote ne viendra de nulle part (I5).
export function phrasesInspection(summary = {}) {
  const puces = []; const phrases = [];
  if (summary.files_distants > 0) {
    puces.push(t('pages manquantes : {n}', { n: summary.files_distants }));
    phrases.push(summary.files_distants === 1 // ronde 1 (#35) : jamais « 1 pages »
      ? t('Cette archive renvoie à 1 page qui n’est pas dedans : si elle est sur le serveur, elle pourra être téléchargée (sur la fiche, ou Réglages → Télécharger toutes les photos et fichiers).')
      : t('Cette archive renvoie à {n} pages qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les photos et fichiers).', { n: summary.files_distants }));
  }
  if (summary.files_copies > 0) puces.push(t('copies du serveur : {n}', { n: summary.files_copies }));
  return { puces, phrases };
}

// R-G-6 : le bilan de restauration dit les originaux gardés (l'archive portait des copies). Singulier sur le gabarit de messageRenvoi.
export const messageOriginauxConserves = (n) => {
  if (!(n > 0)) return null;
  return n === 1 ? t('1 original de cet appareil conservé (l’archive portait une copie).') : t('{n} originaux de cet appareil conservés (l’archive portait des copies).', { n });
};

// Ce qu’un remplacement ne fait pas (R-L3-18) : il vide cet appareil, jamais le serveur. Rien à dire sans compte.
export const messageRemplacementServeur = (connecte) => (connecte ? t('Les fiches absentes de l’archive restent sur le serveur.') : null);

// Arrêt du moteur de synchronisation, avant les deux gestes qui ferment la session (spec § 4.1). Sans cela, ses
// déclencheurs — retour du réseau, retour au premier plan, écriture — continueraient d’appeler le serveur avec un
// jeton qui n’existe plus, et l’appareil se retrouverait avec un moteur sans compte. Il est arrêté PUIS retiré de
// l’état : la passe en vol est attendue avant que la base puisse être vidée. Dépendances injectées pour être éprouvé.
// m1 : la pastille est REDESSINÉE muette dans le même geste. Sans cela, « Se déconnecter » laissait « N non
// envoyés » dans la barre du haut, sans compte, jusqu'au prochain rechargement — contraire à R52, qui cache la
// pastille sans compte précisément pour ne pas annoncer une attente que personne ne tient. Les deux autres gestes
// qui arrêtent le moteur (« Effacer les données de cet appareil », « Changer de compte ») rechargent la page, mais
// ils passent par ici aussi : un seul endroit décide, et c'est celui qui sait que plus rien ne tourne.
export async function arreterMoteur({ obtenir = () => getSyncState().moteur, poser = setSyncState, pastille = majPastille } = {}) {
  const moteur = obtenir();
  if (!moteur) return false;
  await moteur.arreter();
  poser({ moteur: null });
  pastille(null);
  return true;
}

// Même règle pour la perte annoncée avant « Changer de compte » : zéro et un prennent le singulier en français.
const messagePerte = (n) => (n > 1
  ? t('{n} envois en attente seront perdus — ils sont dans l’archive.', { n })
  : t('{n} envoi en attente sera perdu — il est dans l’archive.', { n }));

// S-11 / F-24 (lot G) : un envoi ou un téléchargement de fichier est en vol tant que `progressionFichiers` est non nul. Une seule définition,
// défaut des deux gestes destructeurs ci-dessous (ronde 1 : elle était écrite deux fois).
const transfertEnVol = () => !!getSyncState().moteur?.etat?.()?.progressionFichiers;

// « Effacer les données de cet appareil » (spec § 4.2) : décision et effets, sans DOM ni base — toutes les
// dépendances sont injectées, pour que le geste le plus destructeur de l'app soit éprouvé plutôt que relu.
// R24 : le refus pour file non vide ne vaut QUE s'il existe un compte. Sans compte rien n'envoie, donc rien ne
// videra jamais la file : le refus rendrait le bouton mort pour toujours, dès la première écriture ordinaire. Sans
// compte, on passe donc au double contrôle, qui dit déjà la perte.
// L3 : avec un compte, le refus doit nommer la quarantaine quand il y en a. Une entrée en quarantaine ne partira
// par aucun envoi — seul « Abandonner cet envoi » la retire — et sans cette phrase le bouton resterait refusé sans
// jamais dire par où sortir.
// `arreterSync` est appelé juste AVANT l’effacement, et seulement si le geste va au bout : une passe déclenchée
// entre le vidage et le rechargement écrirait dans une base qu’on vient d’effacer, ou enverrait ce qui n’existe plus.
export async function effacerDonnees({ user = null, pending, enQuarantaine = async () => 0, confirm, demanderMot, toast: dire, clearDevice, signOut = null, reload, arreterSync = arreterMoteur, transfertEnCours = transfertEnVol }) {
  // La file est relue au moment du geste : elle a pu bouger depuis le rendu de la page.
  const enAttente = await pending();
  if (user && enAttente > 0) { dire(messageEnAttente(enAttente, await enQuarantaine())); return false; }
  // Vague finale du lot G : avec un compte, la file ne compte que les fiches (D-G8) — les photos et documents pas encore envoyés, ou refusés à l'envoi,
  // seraient perdus sans un mot : la confirmation le dit, et (ronde 2, R-G-28 bis) qu'une photo envoyée en qualité réduite ne garde au serveur que sa
  // copie réduite. Sans compte, la phrase d'avant (tout est perdu, la sauvegarde d'abord).
  const question = user ? t('Effacer les données de cet appareil ? Les photos et documents pas encore envoyés seront perdus ; une photo envoyée en qualité réduite ne garde que sa copie réduite. Fais d’abord une sauvegarde.') : t('Effacer les données de cet appareil ? Fais d’abord une sauvegarde.');
  if (!(await confirm(question, { danger: true, okLabel: t('Continuer') }))) return false;
  const mot = await demanderMot(t('Tape EFFACER pour confirmer'));
  if (mot !== 'EFFACER') { dire(t('Annulé')); return false; }
  // S-11 / F-24 : upload() et download() ne prennent pas de signal ; arreter() attend le fichier en cours — on le dit avant d'attendre.
  if (transfertEnCours()) dire(t('Envoi en cours…'));
  await arreterSync();
  await clearDevice({ signOut });
  dire(t('Données effacées'));
  reload();
  return true;
}

// Restauration d'une archive (spec § 5.2, R31) : décision seule, dépendances injectées — ni DOM ni base.
// Le mode « remplacement » vide la bibliothèque : il est refusé dès qu'une entrée d'outbox existe, CONNECTÉ OU NON.
// Sans ce refus, ce qui attendait d'être envoyé disparaîtrait avec les fiches qui le justifient, et l'appareil
// repartirait avec une file qui ne correspond plus à rien. La fusion, elle, reste permise : elle écrit par-dessus.
// La file est relue au moment du geste (elle a pu se remplir depuis le rendu de la page), comme pour effacerDonnees.
// En L2 rien ne vide la file : le message renvoie donc vers les deux issues qui existent aujourd'hui — restaurer en
// fusion, ou « Effacer les données de cet appareil » (qui purge la file). Un geste « vider la file » est L3.
export async function restaurerArchive({ mode, pending, toast: dire, appliquer }) {
  if (mode === 'replace') {
    const enAttente = await pending();
    if (enAttente > 0) { dire(messageRemplacementRefuse(enAttente)); return false; }
  }
  await appliquer();
  return true;
}

// « Changer de compte sur cet appareil » (spec § 4.1) : l’archive est exigée, la perte est nommée, puis tout
// ce qui est local est effacé. Aucune donnée n’est envoyée nulle part : la file en attente est perdue, dite perdue.
// `archiveCreated` est une lecture, pas une valeur : si elle lève (stockage de session inaccessible), on refuse —
// échec fermé, cohérent avec le reste du lot.
// `arreterSync` est appelé juste AVANT l’effacement, et seulement si le geste est allé au bout : un refus (archive
// manquante, confirmation annulée) ne doit pas laisser la synchronisation arrêtée sur un appareil qui reste en place.
export async function changerDeCompte({ confirm, toast: dire, pending, archiveCreated, clearDevice, signOut = null, reload, arreterSync = arreterMoteur, transfertEnCours = transfertEnVol }) {
  let archive = null;
  try { archive = archiveCreated(); }
  catch { dire(t('Le stockage de session est inaccessible : ce geste n’est pas possible ici.')); return false; }
  if (!archive) { dire(t('Fais d’abord une archive sur cette page.')); return false; }
  if (!(await confirm(t('Changer de compte sur cet appareil ? Toutes les données de cet appareil seront effacées.'), { danger: true, okLabel: t('Continuer') }))) return false;
  const enAttente = await pending(); // compté au moment du geste : la file a pu bouger depuis le rendu
  if (!(await confirm(messagePerte(enAttente), { danger: true, okLabel: t('Changer de compte') }))) return false;
  // S-11 / F-24 : upload() et download() ne prennent pas de signal ; arreter() attend le fichier en cours — on le dit avant d'attendre.
  if (transfertEnCours()) dire(t('Envoi en cours…'));
  await arreterSync();
  await clearDevice({ signOut });
  reload();
  return true;
}

// Consentement à l'historique de consultation (spec § 4.2, D6 ; R27). Le réglage est écrit D'ABORD — la capture le
// relit et se referme — puis ce qui attendait de partir est retiré de la file : un retrait de consentement qui
// laisse partir la file n'est pas un retrait. Rend le nombre d'entrées retirées.
// L3 : à l'ACTIVATION, l'historique déjà sur cet appareil n'a jamais été mis en file — la capture était fermée
// quand il s'est écrit. Retirer son marqueur d'envoi initial le fait rattraper à la prochaine passe ; sans cela,
// seules les consultations à venir partiraient, et le consentement dirait moins que ce qu'il promet. Le marqueur
// n'est PAS reposé au retrait (R27) : décocher vide la file, et un nouveau « oui » doit rattraper de nouveau.
export async function reglerHistorique(actif, {
  setSetting = repo.setSetting,
  oublierEnvois = repo.oublierEnvois,
  db = repo.db,
  retirerMarqueur: retirer = retirerMarqueur,
  moteur = getSyncState().moteur,
} = {}) {
  await setSetting('sync_activity', actif === true);
  if (actif !== true) return await oublierEnvois('library_activity');
  await retirer(db, 'library_activity');
  moteur?.planifier();
  return 0;
}

// « Réessayer » sur une entrée en quarantaine (spec § 4.2) : l'entrée est RELUE au moment du geste (la passe en
// cours a pu la retirer), remise à zéro, puis une passe est demandée tout de suite — un geste de la personne qui
// n'est suivi d'aucune tentative serait un bouton muet. Rend `true` si quelque chose a été fait.
export async function reessayerEnvoi({ db, seq, moteur = null, reprendre = reprendreEnvoi }) {
  const entree = await db.get('outbox', seq);
  if (!entree) return false;
  await reprendre(db, entree);
  moteur?.executer('reessai');
  return true;
}

// « Abandonner cet envoi » : la seule façon de vider une entrée que le serveur refuse. La confirmation dit les deux
// moitiés de la vérité — l'envoi est abandonné, la fiche reste ici. L'entrée est relue d'abord : rien n'est demandé
// pour une entrée déjà partie.
export async function abandonnerEnvoi({ db, seq, confirm, retirer = retirerEnvoi }) {
  const entree = await db.get('outbox', seq);
  if (!entree) return false;
  const message = t('L’envoi de cette fiche sera abandonné ; la fiche reste sur cet appareil.');
  if (!(await confirm(message, { danger: true, okLabel: t('Abandonner cet envoi') }))) return false;
  await retirer(db, seq);
  return true;
}

// Trancher un conflit (spec § 5.5) : le conflit est RELU au moment du geste — l'autre bouton, un autre onglet ou la
// purge des vieux conflits ont pu le faire disparaître. « Garder celle d'ici » remet la fiche en file : une passe
// est planifiée, sinon le choix attendrait le prochain déclencheur. « Garder celle d'ailleurs » ne remet rien en
// file — le serveur a déjà cette version — et rend `false` quand il n'y a rien à appliquer : le conflit reste.
// Les deux issues ÉCRIVENT une fiche de la bibliothèque, et elles l'écrivent par la porte d'écriture de la base,
// qui ne passe par aucun bus : le cache de lecture de state.js garderait la version que la personne vient
// justement d'écarter. Il est donc invalidé, et seulement quand quelque chose a été écrit.
export async function abandonnerCopieConflit({db, id, confirm = confirmDialog, appliquer = abandonnerConflitCycle, invalider = invalidate}) {
  const conflit = await db.get('sync_conflicts', id);
  if (!conflit || conflit.kind !== 'cycle' || conflit.store !== 'recipes') return false;
  if (!await confirm(t('Abandonner ces modifications et reprendre l’état reçu ? Consulte la copie avant de confirmer.'), {okLabel:t('Abandonner ces modifications'),danger:true})) return false;
  const applique = await appliquer(db, conflit);
  if (applique) invalider();
  return applique;
}

export async function garderVersionDIci({ db, id, moteur = null, appliquer = garderIci, invalider = invalidate }) {
  const conflit = await db.get('sync_conflicts', id);
  if (!conflit) return false;
  const applique = await appliquer(db, conflit);
  if (applique) { invalider(); moteur?.planifier(); }
  return applique;
}

// R-L3-29 : « Ignorer » sur un conflit DÉJÀ RENVOYÉ. Comme ses deux voisins, le conflit est RELU au moment du
// geste (un autre onglet, un accusé du serveur ou la purge des vieux conflits ont pu le faire disparaître) et
// l'effet vit dans `src/sync/conflits.js` — aucune vue n'écrit en base (spec § 5.2, test statique). Rien à
// invalider : le cache de lecture ne porte pas les conflits (Réglages les lit en base à chaque rendu).
export async function rangerConflitRenvoye({ db, id, appliquer = ignorerRenvoye }) {
  const conflit = await db.get('sync_conflicts', id);
  if (!conflit) return false;
  return appliquer(db, conflit);
}

export async function garderVersionDAilleurs({ db, id, appliquer = garderAilleurs, invalider = invalidate }) {
  const conflit = await db.get('sync_conflicts', id);
  if (!conflit) return false;
  const applique = await appliquer(db, conflit);
  if (applique) invalider();
  return applique;
}

// Un geste de Réglages protégé (L3, L4, bascule de qualité) : une levée est journalisée (`sync.geste.<nom>`) et dite, jamais un rejet non
// traité. Ronde 1 de la tâche 5 : une seule définition (elle était copiée à l'octet dans gestesL3Pour et gestesL4Pour).
const protegerGeste = (dire, journaliser) => (nom, fn) => async (cle) => {
  try { await fn(cle); }
  catch (error) { journaliser('sync.geste.' + nom, { error }); dire(t('Ce geste n’a pas abouti.')); }
};

// Le câblage des gestes L3 (spec § 4.2) : une fonction par geste NOMMÉ, toutes les dépendances injectées — c'est
// cet objet que le rendu reçoit, et c'est lui que le test éprouve (sans quoi le fil entre les décisions et les
// boutons ne serait vérifié par personne). `obtenirMoteur` est une fonction : le moteur est posé par le démarrage,
// parfois après ce rendu, et un geste doit parler au moteur de l'instant du clic, pas à celui du rendu.
// Chaque geste est PROTÉGÉ : un gestionnaire d'onClick qui rejette ne serait vu de personne (rejet non traité) et
// la personne resterait devant un bouton qui n'a rien fait sans le dire. Le code est journalisé, la phrase est fixe.
// Ni « Réessayer » ni « Abandonner » ne touchent une fiche (seulement la file) : rien à invalider pour eux.
export function gestesL3Pour({
  db = repo.db,
  obtenirMoteur = () => getSyncState().moteur,
  confirm = confirmDialog,
  dire = toast,
  rafraichir = refresh,
  invalider = invalidate,
  journaliser = logError,
} = {}) {
  const protege = protegerGeste(dire, journaliser);
  return {
    envoyerMaintenant: protege('envoyer_maintenant', async () => { await obtenirMoteur()?.envoyerMaintenant(); rafraichir(); }),
    reessayer: protege('reessayer', async (seq) => { await reessayerEnvoi({ db, seq, moteur: obtenirMoteur() }); rafraichir(); }),
    abandonner: protege('abandonner', async (seq) => { await abandonnerEnvoi({ db, seq, confirm }); rafraichir(); }),
    garderIci: protege('garder_ici', async (id) => { await garderVersionDIci({ db, id, moteur: obtenirMoteur(), invalider }); rafraichir(); }),
    garderAilleurs: protege('garder_ailleurs', async (id) => {
      // Un conflit dont le serveur n'a pas joint sa version ne peut pas être appliqué : il RESTE, et on le dit —
      // mieux vaut un conflit qui attend qu'une fiche écrasée par rien. Un conflit déjà tranché ailleurs ne dit
      // rien du tout : il est relu pour ne pas annoncer un conflit qui n'existe plus.
      const applique = await garderVersionDAilleurs({ db, id, invalider });
      if (!applique && await db.get('sync_conflicts', id)) dire(t('Cette version n’a pas été reçue en entier : le conflit reste.'));
      rafraichir();
    }),
    // R-L3-29 : ranger l'entrée de journal d'un conflit déjà renvoyé. Rien à invalider — aucune fiche n'est touchée.
    abandonnerConflitCycle: protege('abandonner_conflit_cycle', async id => {
      let confirme = false;
      const applique = await abandonnerCopieConflit({db,id,confirm:async (...args) => (confirme = await confirm(...args)),invalider});
      if (!applique && confirme && await db.get('sync_conflicts',id)) dire(t('L’état reçu n’a pas pu être confirmé. La copie et le conflit sont conservés ; synchronise puis réessaie.'));
      rafraichir();
    }),
    ignorerConflit: protege('ignorer_conflit', async (id) => { await rangerConflitRenvoye({ db, id }); rafraichir(); }),
  };
}

// === Assistant IA (section de Réglages)
// K-12 : la page n'est pas reconstruite sous les doigts — le focus dans cette section vaut « occupé » pour suivreMoteur.
export const occupeParAssistant = (doc = document) => !!doc.activeElement?.closest?.('[data-section="assistant"]');

// Section « Assistant IA » (Passerelle T4, R-T4-2) : DEUX états, aucun champ — la clé n'existe plus côté app. Première ligne = à quoi sert la
// section. Sans session : « Connecte-toi… » + « Se connecter » (le geste de la section Compte), aucun appel — sauf garde de compte refusée
// (F-7) : le message de la garde, sans bouton (il bouclerait sur le même refus). Avec une session : un GET de la passerelle (elle ne demande
// rien au fournisseur d'IA) dit l'état, et RIEN n'est affirmé avant sa réponse (F-4) : « Vérification de l’assistant… » pendant l'attente ;
// puis, selon la réponse — 200 : « L’assistant est actif pour <adresse>. » + le modèle et le quota ; compte non admis : « Ce compte n’a pas
// accès à l’assistant. » seul ; 401 : « Connecte-toi… » + « Se connecter » (le jeton local est refusé par le serveur) ; tout le reste :
// « L’assistant est indisponible pour le moment. » seul. Dépendances injectées : `fetch` (les tests n'ont jamais de réseau) et `connecter`
// (défaut : demarrerConnexion).
export function sectionAssistant({ sync = {}, session = null } = {}, { fetch = undefined, connecter = demarrerConnexion } = {}) {
  const geste = () => el('div', { class: 'row' }, boutonSeConnecter(() => connecter(sync.auth), { classe: 'btn primary' }));
  let contenu;
  if (sessionValide(session)) contenu = assistantActif(sync, session, fetch, geste);
  else {
    const gardeRefusee = messageGardeRefusee(sync);
    contenu = gardeRefusee ? [el('p', null, gardeRefusee)] : [el('p', null, t(TEXTE_CONNEXION)), geste()];
  }
  const sec = section(t('Assistant IA'), ...contenu);
  sec.dataset.section = 'assistant';
  return sec;
}

function assistantActif(sync, session, fetch, geste) {
  const adresse = [session.user?.email, sync.user?.email].find((a) => typeof a === 'string' && a !== '');
  const etat = el('p', { class: 'muted', role: 'status', dataset: { role: 'etat-assistant' } }, t('Vérification de l’assistant…'));
  const indisponible = () => { etat.textContent = t('L’assistant est indisponible pour le moment.'); };
  // Rien n'est rendu du corps d'une erreur : seule la raison classe.
  etatAssistant({ fetch, session }).then((r) => {
    if (r.raison === 'non_admis') etat.textContent = t('Ce compte n’a pas accès à l’assistant.');
    else if (r.raison === 'non_connecte') { etat.textContent = t(TEXTE_CONNEXION); etat.after(geste()); }
    else if (r.raison) indisponible();
    else {
      const { modele, quotaJour } = r.corps;
      const dit = [modele ? t('Modèle en service : {m}.', { m: modele }) : null, quotaJour == null ? null : (quotaJour === 1 ? t('Quota : 1 appel par jour.') : t('Quota : {n} appels par jour.', { n: quotaJour }))].filter(Boolean).join(' ');
      if (!dit) { indisponible(); return; } // un 200 sans modèle ni quota lisibles n'est pas une réponse de la passerelle : « actif » n'est pas dit
      etat.before(el('p', null, adresse ? t('L’assistant est actif pour {adresse}.', { adresse }) : t('L’assistant est actif sur ton compte.')));
      etat.textContent = dit;
    }
  }, indisponible);
  return [etat];
}
// === fin Assistant IA

// Abonnement à l'état du moteur : plusieurs changements rapprochés ne font qu'UN rendu, et l'abonné se retire de
// lui-même dès que la vue affichée n'est plus Réglages. Le routeur ne démonte pas les vues (aucun crochet de
// nettoyage) : sans ce retrait, chaque navigation laisserait un abonné de plus, et chaque passe rafraîchirait un
// écran qui ne parle pas de synchronisation. Rend de quoi arrêter, ou null s'il n'y a rien à suivre.
// `occupe` est le garde-fou le plus important : une opération d'archive dure, et son écran porte un état qui ne
// vit QUE dans le DOM — contrôles désactivés, bilan de restauration, bouton « Recharger l'application ». Un rendu
// demandé par le moteur au milieu reconstruirait la page et emporterait tout cela, pendant que l'archive écrit.
// Le rendu est alors abandonné, pas mis en attente : la prochaine passe du moteur en redemandera un.
export function suivreMoteur({ moteur, surReglages, rafraichir, occupe = () => false, delaiMs = 300 }) {
  if (typeof moteur?.onEtat !== 'function') return null;
  let minuterie = null;
  let retirer = null;
  const arreter = () => {
    if (minuterie) { clearTimeout(minuterie); minuterie = null; }
    const r = retirer;
    retirer = null;
    r?.();
  };
  retirer = moteur.onEtat(() => {
    if (!surReglages()) { arreter(); return; }
    if (minuterie) return; // regroupement : le premier changement fixe l'heure du rendu
    minuterie = setTimeout(() => {
      minuterie = null;
      // Relus à l'instant du rendu, pas à celui du changement : l'archive a pu commencer entre les deux.
      if (surReglages() && !occupe()) rafraichir();
    }, delaiMs);
  });
  return arreter;
}

// Un seul abonné pour toute l'application, remplacé à chaque rendu de Réglages : il vit au niveau du module, pas
// dans le nœud rendu, parce que c'est le seul endroit qui survit au remplacement de la vue.
let abonnementMoteur = null;

function suivreMoteurDeLaPage(moteur) {
  abonnementMoteur?.();
  abonnementMoteur = suivreMoteur({
    moteur,
    surReglages: () => currentPath() === '/settings',
    rafraichir: refresh,
    occupe: () => archiveOperation || occupeParAssistant(), // K-12 : ni sous une archive, ni sous les doigts
  });
}

// Les quatre seuls gestes nommés par le modèle, et les cinq gestes de l'ensemble L3. Le rendu ne câble que ce qu'il
// trouve dans l'objet de gestes : un renommage donne un bouton manquant (visible), jamais un bouton muet.
export const SYNC_ACTIONS = ['signIn', 'signOut', 'changeAccount', 'envoyerMaintenant'];
export const SYNC_L3_ACTIONS = ['envoyerMaintenant', 'reessayer', 'abandonner', 'garderIci', 'garderAilleurs', 'ignorerConflit', 'abandonnerConflitCycle'];

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
  const gestesL3 = gestesL3Pour();
  const gestesL4 = gestesL4Pour();
  const gestes = {
    signIn: () => demarrerConnexion(auth),
    signOut: async () => {
      // Le moteur est arrêté AVANT de fermer la session : un déclencheur qui partirait entre les deux appellerait
      // le serveur avec un jeton qui n’existe plus.
      const moteur = getSyncState().moteur;
      await arreterMoteur();
      const essai = await auth?.signOut();
      if (essai?.error) {
        toast(t('La déconnexion n’a pas abouti.'));
        // La session est toujours là : la synchronisation REPREND, sinon elle resterait arrêtée jusqu’au prochain
        // lancement sans que rien ne le dise. `arreter()` ne retire que les écouteurs de fenêtre et du bus ; les
        // abonnés `onEtat` restent, donc `demarrer()` reprend sans réabonnement (il réinstalle ses écouteurs,
        // recharge ce que l’appareil sait déjà et relance une passe).
        if (moteur) { setSyncState({ moteur }); moteur.demarrer(); }
        return;
      }
      setSyncState({ user: null, guard: null }); // la file d’envoi et les données restent intactes (spec § 4.1)
      refresh();
    },
    changeAccount: () => changeAccount(auth),
    // Le même geste que la liste, pris dans le câblage éprouvé : un seul endroit décide ce que « Envoyer
    // maintenant » fait, qu'on y arrive par le bouton du modèle ou par un bouton de liste.
    envoyerMaintenant: gestesL3.envoyerMaintenant,
  };
  const boutons = model.buttons.filter((b) => Object.hasOwn(gestes, b.action));
  return section(model.title,
    ...model.lines.map((line) => el('p', { class: 'muted' }, line)),
    boutons.length
      ? el('div', { class: 'row' }, ...boutons.map((b) => el('button', { class: 'btn' + (b.tone ? ' ' + b.tone : ''), onClick: gestes[b.action] }, b.label)))
      : null,
    ...syncSectionL3(model, gestesL3),
    ...syncSectionL4(model, gestesL4),
    field(t('Historique de consultation'),
      el('label', { class: 'check' },
        el('input', { type: 'checkbox', checked: settings.sync_activity === true, onChange: async (e) => { await reglerHistorique(e.target.checked); refresh(); } }),
        t('Synchroniser mon historique de consultation')),
      // Le cocher ne vaut pas seulement pour la suite : il fait aussi partir l'historique DÉJÀ sur cet appareil
      // (le marqueur d'envoi initial est retiré). C'est une porte de confidentialité : elle se dit avant le geste.
      t('Désactivé, ce que tu consultes reste sur cet appareil. Le décocher retire aussi ce qui attendait d’être envoyé ; le cocher envoie aussi l’historique déjà sur cet appareil.')));
}

// Rendu de l'ensemble L3 (spec § 4.2) : progression, pause, liste de quarantaine, liste de conflits. Rend un
// tableau de nœuds (vide quand le modèle n'a rien de L3), exporté pour être éprouvé tel quel : une liste juste dans
// le modèle mais affichée nulle part serait un faux vert. Aucune lecture de base, aucun état : seulement le modèle
// et les gestes reçus. Un geste absent ne casse rien — le bouton existe et ne fait rien de visible.
export function syncSectionL3(model, gestes = {}) {
  const noeuds = [];
  // Un bouton n'existe que si son geste a été câblé : jamais de `gestes.x?.()`, qui donnerait un bouton qui a l'air
  // d'agir et ne fait rien. Un geste manquant se voit — c'est la même règle que pour les boutons du modèle.
  const bouton = (action, libelle, cle, classe = 'btn') => (Object.hasOwn(gestes, action)
    ? el('button', { class: classe, onClick: () => gestes[action](cle) }, libelle)
    : null);
  const rangee = (...boutons) => { const vus = boutons.filter(Boolean); return vus.length ? el('div', { class: 'row' }, ...vus) : null; };
  if (model.progression) noeuds.push(el('p', { class: 'muted' }, model.progression));
  if (model.pause) noeuds.push(el('div', { class: 'card warn' }, model.pause));
  const quarantaine = model.quarantaine || [];
  if (quarantaine.length) {
    noeuds.push(el('h3', null, t('En quarantaine')),
      el('p', { class: 'muted' }, t('Ces fiches restent sur cet appareil ; elles n’iront pas au serveur tant que ce n’est pas réglé.')));
    for (const q of quarantaine) {
      noeuds.push(el('div', { class: 'status warn', dataset: { quarantaine: String(q.seq) } },
        el('p', null, `${q.libelle} — ${q.motif}`),
        rangee(bouton('reessayer', t('Réessayer'), q.seq), bouton('abandonner', t('Abandonner cet envoi'), q.seq, 'btn danger'))));
    }
  }
  const conflits = model.conflits || [];
  if (conflits.length) {
    noeuds.push(el('h3', null, t('Conflits à trancher')),
      el('p', { class: 'muted' }, t('Choisis celle qui compte ; rien n’est fusionné.')));
    for (const c of conflits) {
      if (c.kind === 'cycle') {
        noeuds.push(el('div', {class:'status warn stack',dataset:{conflit:String(c.id)}},
          el('p', null, t('Cette modification a été faite avant un retrait ou une restauration. Ta copie est conservée.')),
          el('p', null, c.libelle),
          el('details', null, el('summary', null, t('Consulter la copie conservée')), el('pre', {style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:'22rem',overflow:'auto'}}, c.copieLocale)),
          c.recipeId ? el('a', {class:'btn',href:`#/recipes/${encodeURIComponent(c.recipeId)}`}, t('Consulter la recette')) : null,
          c.peutAbandonnerCycle ? rangee(bouton('abandonnerConflitCycle', t('Abandonner ces modifications'), c.id, 'btn danger'))
            : el('p', {class:'muted'}, t('Restaure la recette si nécessaire, puis reprends les modifications voulues depuis sa fiche. Cette copie reste disponible ici.'))));
        continue;
      }
      noeuds.push(el('div', { class: 'status warn', dataset: { conflit: String(c.id) } },
        // R-L3-29 : un conflit DÉJÀ RENVOYÉ n'est pas une question — la version d'ici est repartie et le serveur
        // l'acceptera (elle est plus récente). « Garder celle d'ici » la réhorodaterait et la renverrait encore ;
        // « Garder celle d'ailleurs » écraserait ce qu'on vient d'envoyer par la version qui a perdu. Le seul geste
        // est donc de ranger l'entrée de journal — et l'accusé du serveur le fait tout seul.
        // I5 : la phrase dit « EN COURS de renvoi », pas « renvoyée ». Ce qui est établi, c'est l'entrée en file ;
        // l'accusé, personne ne l'a encore vu — et si l'envoi tombe en quarantaine, il n'y en aura pas (la
        // quarantaine nomme alors la fiche juste à côté, avec ses propres gestes). La ligne disparaît d'elle-même
        // à l'accusé : aucun état affiché sans un événement réel.
        // Sinon, la nature du conflit d'abord : « même heure, contenus différents » et « une autre version a été
        // créée ailleurs » ne demandent pas la même décision, et rien ne permet de deviner l'une depuis l'autre.
        // R-L3-30 : renvoyé ET supprimé ailleurs garde une vraie question — accepter la suppression, ou non. Sans
        // ce cas, l'issue que R-L3-26 a donnée à la personne n'existerait nulle part dans l'interface, et
        // « Ignorer » ferait disparaître le journal pendant que la fiche locale repart : la suppression venue
        // d'ailleurs annulée sans un mot.
        el('p', null, c.renvoye && c.suppressionAilleurs
          ? t('Supprimée ailleurs ; la version d’ici est en cours de renvoi au serveur.')
          : (c.renvoye ? t('Version d’ici en cours de renvoi au serveur.') : phraseConflit(c.kind))),
        el('p', null, t('{l} — version d’ici du {a}, version d’ailleurs du {b}', { l: c.libelle, a: c.dateIci, b: c.dateAilleurs })),
        c.renvoye && c.suppressionAilleurs
          ? rangee(bouton('garderAilleurs', t('Supprimer ici aussi'), c.id, 'btn danger'), bouton('ignorerConflit', t('Ignorer'), c.id))
          : (c.renvoye
            ? rangee(bouton('ignorerConflit', t('Ignorer'), c.id))
            : rangee(bouton('garderIci', t('Garder celle d’ici ({d})', { d: c.dateIci }), c.id), bouton('garderAilleurs', t('Garder celle d’ailleurs'), c.id)))));
    }
  }
  return noeuds;
}

// Ce que dit un conflit selon sa nature (spec § 5.5). Un `kind` inattendu reçoit la phrase la plus générale :
// jamais celle d'un autre cas, jamais une cause devinée.
const PHRASES_CONFLIT = {
  donnees: 'Deux versions portent la même heure.',
  version: 'Une autre version de cette recette a été créée ailleurs.',
};

const phraseConflit = (kind) => t(Object.hasOwn(PHRASES_CONFLIT, kind) ? PHRASES_CONFLIT[kind] : 'Deux versions existent pour cette fiche.');

// Lot G (§ 4.1) : des mégaoctets arrondis au dixième, dans la langue de l'interface (« 1,6 », « 850 ») — une MESURE, jamais un plafond (R-G-5).
const enMo = (octets) => new Intl.NumberFormat(getUiLocale() === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 1 }).format(Math.round((Number(octets) || 0) / 104857.6) / 10);
const compte = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);

function modeleFichiers(moteur, { qualite, refuses }) {
  const f = moteur.fichiers || {};
  const prog = moteur.progressionFichiers;
  const aTelecharger = compte(f.aTelecharger);
  const mo = enMo(f.octetsATelecharger);
  return {
    aEnvoyer: t('Photos à envoyer : {n}', { n: compte(f.aEnvoyer) }),
    envoi: prog?.sens === 'envoi' ? t('Envoi des photos : {n}/{m}', { n: prog.n, m: prog.total }) : null,
    pause: moteur.pauseFichiers ? t('Espace photos plein sur le serveur : les photos attendent sur cet appareil, les fiches continuent de partir.') : null,
    aTelecharger: aTelecharger ? t('Photos et fichiers à télécharger : {n} (~{m} Mo)', { n: aTelecharger, m: mo }) : null,
    // Ronde 1 (§ 3.2) : sous `pause_fichiers`, la passe fichiers entière est suspendue, téléchargement global compris — le bouton ne ferait rien
    // descendre : il n'est pas offert (« Arrêter le téléchargement » reste si le global était demandé ; la tape sur une page, elle, marche).
    telechargerTout: aTelecharger && moteur.telechargementGlobal !== true && !moteur.pauseFichiers ? t('Télécharger toutes les photos et fichiers ({n} fichiers, ~{m} Mo)', { n: aTelecharger, m: mo }) : null,
    reception: prog?.sens === 'reception' ? t('Téléchargement des pages : {n}/{m}', { n: prog.n, m: prog.total }) : null,
    arreter: moteur.telechargementGlobal === true,
    renvoi: qualite === 'originale' && compte(f.aRenvoyer) ? t('Renvoyer en originale les {n} photos de cet appareil envoyées en réduite', { n: f.aRenvoyer }) : null,
    refuses: refuses ? t('Fichiers refusés : {n}', { n: refuses }) : null,
    typeInconnu: compte(f.typeInconnu) ? t('{n} fichier(s) de type inconnu ne seront pas synchronisés.', { n: f.typeInconnu }) : null,
    copiesSansServeur: compte(f.copiesSansServeur) ? t('{n} copie(s) de photos ici dont le serveur n’a plus trace : l’appareil qui a l’original les renverra.', { n: f.copiesSansServeur }) : null,
    copiesPerimees: compte(f.copiesPerimees) ? t('{n} photo(s) ici sont une copie plus ancienne que celle du serveur.', { n: f.copiesPerimees }) : null,
  };
}

function phraseEspace(e) {
  if (!e || !Number.isFinite(e.octets) || !Number.isFinite(e.objets)) return t('Espace serveur : pas encore mesuré.');
  const v = { x: enMo(e.octets), n: e.objets };
  return e.tronque ? t('au moins {x} Mo ({n} fichiers)', v) : t('Tes photos sur le serveur : {x} Mo ({n} fichiers)', v);
}

// Motifs d'un fichier refusé (§ 4.10) : la table et `motifFichier` vivent dans components.js depuis la tâche 6, ronde 1 (UNE définition pour
// Réglages et les écrans : vignettes, couverture, cadre PDF) ; réexportés ici, la signature d'avant tient.
export { motifFichier };
// B-22 : pas de « Réessayer » qui échouera pareil — trop_gros (les mêmes octets restent trop gros) et, ronde 1, forme à l'envoi (les mêmes octets
// ne porteraient pas plus de remote valide : la passe reposerait la même clé). `illisible` garde le sien : le blob peut redevenir lisible.
// Ronde 2 (R-G-31) : `taille` à la réception non plus — l'objet est nommé par son empreinte, le serveur rendrait les mêmes octets (un remote qui
// change lève l'erreur, F-7).
const sansReessai = (motif, sens) => motif === 'trop_gros' || (sens === 'envoi' && motif === 'forme') || (sens === 'reception' && motif === 'taille');

export const SYNC_L4_ACTIONS = ['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerOriginale', 'reessayerFichier'];

// Le câblage des gestes L4 (§ 4.1), protégé comme gestesL3Pour : l'écran n'a ni le client ni le stockage (R53), tout passe par le moteur.
// Ronde 1 : l'API du moteur rend ses échecs EN VALEUR (`{ erreur }`, ARRETE après l'arrêt), jamais en levée : ils sont dits après le redessin —
// sinon un « Réessayer » hors réseau retire la ligne de refus sans un mot et se lit comme un succès. Un moteur absent (arrêté entre le rendu et la
// tape) n'est plus avalé par `?.` : il lève, donc il est journalisé et dit.
export function gestesL4Pour({ obtenirMoteur = () => getSyncState().moteur, dire = toast, rafraichir = refresh, journaliser = logError } = {}) {
  const protege = protegerGeste(dire, journaliser);
  const appeler = (nom, api) => protege(nom, async (cle) => {
    const moteur = obtenirMoteur();
    if (!moteur) throw new Error('moteur absent');
    const r = await moteur[api](cle);
    rafraichir();
    if (r?.erreur) dire(t('Ce geste n’a pas abouti.'));
  });
  return {
    telechargerTout: appeler('telecharger_tout', 'telechargerTout'),
    arreterTelechargement: appeler('arreter_telechargement', 'arreterTelechargement'),
    actualiserEspace: appeler('actualiser_espace', 'actualiserEspace'),
    renvoyerOriginale: appeler('renvoyer_originale', 'renvoyerEnOriginale'),
    reessayerFichier: appeler('reessayer_fichier', 'reessayerFichier'),
  };
}

// La bascule de qualité (§ 4.1 item 4) : écrit le réglage PUIS redessine — le segmented n'a pas d'état propre (sa classe active est celle du
// rendu) et la relecture des réglages par le bus ne redessine pas Réglages. Ronde 1 : protégée comme les gestes L4 ; une écriture refusée est
// journalisée et dite, et l'écran reste sur la valeur réellement écrite (aucun redessin). Dépendances injectables pour être éprouvée.
export function choisirQualitePour({ ecrire = (valeur) => repo.setSetting('upload_quality', valeur), rafraichir = refresh, dire = toast, journaliser = logError } = {}) {
  return protegerGeste(dire, journaliser)('qualite', async (valeur) => { await ecrire(valeur); rafraichir(); });
}

// Rendu de l'ensemble L4 (§ 4.1), exporté pour être éprouvé tel quel. Un bouton n'existe que si son geste est câblé (la règle de L3).
export function syncSectionL4(model, gestes = {}, { choisirQualite = choisirQualitePour() } = {}) {
  const f = model?.fichiers;
  if (!f) return [];
  const bouton = (action, libelle, cle) => (Object.hasOwn(gestes, action) ? el('button', { class: 'btn', onClick: () => gestes[action](cle) }, libelle) : null);
  const rangee = (...b) => { const vus = b.filter(Boolean); return vus.length ? el('div', { class: 'row' }, ...vus) : null; };
  const bloc = el('div', { class: 'stack', dataset: { role: 'sync-l4' } }, el('p', { class: 'muted' }, f.aEnvoyer));
  if (f.envoi) bloc.append(el('p', { class: 'muted' }, f.envoi));
  if (f.pause) bloc.append(el('div', { class: 'card warn' }, f.pause));
  if (f.aTelecharger) bloc.append(el('p', { class: 'muted' }, f.aTelecharger));
  if (f.reception) bloc.append(el('p', { class: 'muted' }, f.reception));
  const telechargement = rangee(f.telechargerTout ? bouton('telechargerTout', f.telechargerTout) : null, f.arreter ? bouton('arreterTelechargement', t('Arrêter le téléchargement')) : null);
  if (telechargement) bloc.append(telechargement);
  bloc.append(el('p', { class: 'muted' }, model.espace));
  const actualiser = rangee(bouton('actualiserEspace', t('Actualiser')));
  if (actualiser) bloc.append(actualiser);
  // R-UX-8 / B-15 : le segmented n'est JAMAIS dans un <label> (field() en rend un) : même habillage .field, par un div.
  bloc.append(el('div', { class: 'field' }, el('span', null, t('Qualité d’envoi des photos')),
    segmented([{ value: 'reduite', label: t('Réduite (≈ 400 Ko, 2 000 px)') }, { value: 'originale', label: t('Originale') }], model.qualite, (v) => choisirQualite(v)),
    // Ronde 1 (S-9, R-G-4 ; à ratifier, spec § 4.1 item 4, § 5 et § 11 à amender) : « Réduite » n'est pas toujours réduite — octetsAEnvoyer envoie
    // tel quel une image petite et légère, une photo au-delà du mur de pixels ou que ce navigateur ne décode pas, une réduction qui serait plus lourde,
    // un PDF ou un EPUB. L'aide le dit au lieu de promettre « métadonnées retirées » sans exception.
    el('small', null, t('L’original reste toujours sur l’appareil qui a pris la photo. Réduite : JPEG de 2 000 px au plus, environ 400 Ko par page, métadonnées retirées, quand la réduction est possible et utile ; sinon le fichier part tel quel, métadonnées comprises : une image déjà petite (2 000 px et 600 Ko au plus), une photo de plus de 16 Mpx ou que ce navigateur ne sait pas lire, un PDF ou un EPUB. Originale : le fichier tel quel, avec ses métadonnées (dont la position GPS si la photo en porte).'))));
  const renvoi = f.renvoi ? rangee(bouton('renvoyerOriginale', f.renvoi)) : null;
  if (renvoi) bloc.append(renvoi);
  if (f.refuses) {
    bloc.append(el('p', null, f.refuses));
    for (const e of model.erreursFichiers || []) {
      bloc.append(el('div', { class: 'status warn', dataset: { fichier: e.sha256 } }, el('p', null, e.texte), e.reessayer ? rangee(bouton('reessayerFichier', t('Réessayer'), e.sha256)) : null));
    }
  }
  for (const phrase of [f.typeInconnu, f.copiesSansServeur, f.copiesPerimees]) if (phrase) bloc.append(el('p', { class: 'muted' }, phrase));
  return [bloc];
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
// L3 : le modèle reçoit en plus l'état du moteur (null tant qu'il n'existe pas), les entrées en quarantaine et les
// conflits. Rien de L3 n'apparaît hors de l'état « connectée + garde ok » — avant lui le compte n'est pas établi —
// et SANS moteur le modèle est exactement celui de L2, pas même une clé de plus : la section de L2 reste intacte
// tant que le moteur n'est pas branché.
export function syncSectionModel({ available = false, reason = null, user = null, pending = 0, guard = null, retour = null, enAttente = false, moteur = null, quarantaine: enQuarantaine = [], conflits: aTrancher = [], fichiersErreurs = [], qualite = 'reduite', snapshot = null } = {}) {
  const lines = [];
  const buttons = [];
  let connectee = false;
  if (!available) {
    // Deux indisponibilités distinctes, nommées : elles n’appellent pas la même suite.
    lines.push(reason === 'bibliotheque'
      ? t('La bibliothèque de synchronisation n’a pas été chargée.')
      : t('Synchronisation non configurée sur cette adresse.'));
  } else if (enAttente) {
    // R30 : le démarrage borné (R28) n’a pas encore abouti — le compte n’est pas CONNU. Dire « Tes données restent
    // sur cet appareil. » et offrir « Activer la synchronisation » serait un état sans événement réel (spec I5).
    // Aucun geste n’est offert : il porterait sur un état qui n’est pas encore établi. Le résultat tardif
    // redemande un rendu (state.js), et la section redevient alors celle de tous les jours.
    lines.push(t('Vérification du compte…'));
  } else if (guard && guard.ok === false) {
    // Garde de compte refusée : la synchronisation reste désactivée, avec deux issues (R22). La douce d'abord :
    // se déconnecter ne touche ni les données ni la file ; changer de compte efface l'appareil.
    lines.push(guard.message || t('Cet appareil ne peut pas vérifier le compte.'));
    buttons.push({ action: 'signOut', label: t('Se déconnecter'), tone: '' });
    buttons.push({ action: 'changeAccount', label: t('Changer de compte sur cet appareil'), tone: 'danger' });
  } else if (user && guard?.ok) {
    lines.push(t('Connectée : {e}', { e: user.email || '' }));
    // « À envoyer » est la file ENTIÈRE, quarantaine comprise : additionner les deux compterait deux fois.
    lines.push(t('À envoyer : {n}', { n: pending }));
    if (moteur) {
      // I5 : chaque ligne vient d'un fait du moteur (un appel abouti, une entrée refusée, une mesure d'horloge).
      lines.push(moteur.dernierEchange
        ? t('Dernier échange : {h}', { h: formatDate(moteur.dernierEchange, { withTime: true }) })
        : t('Aucun échange encore.'));
      // Les deux comptes viennent des LISTES affichées, pas de l'instantané du moteur : c'est la liste que la
      // personne peut compter, et un instantané pris à un autre instant contredirait ce qu'elle a sous les yeux.
      lines.push(t('En quarantaine : {n}', { n: enQuarantaine.length }));
      lines.push(t('Conflits : {n}', { n: aTrancher.length }));
      if (moteur.attenteConnexion) lines.push(t('En attente de connexion — l’envoi reprendra après la prochaine connexion.'));
      if (moteur.horloge) lines.push(t('L’heure de cet appareil semble fausse (± {m} min).', { m: moteur.horloge.minutes }));
      buttons.push({ action: 'envoyerMaintenant', label: t('Envoyer maintenant'), tone: '' });
    }
    buttons.push({ action: 'signOut', label: t('Se déconnecter'), tone: '' });
    connectee = true;
  } else {
    lines.push(t('Tes données restent sur cet appareil.'));
    buttons.push({ action: 'signIn', label: t('Activer la synchronisation'), tone: 'primary' });
  }
  // Retour du fournisseur : dit après l’état, sans jamais prétendre en connaître la cause.
  if (retour?.codeSansSession) lines.push(t('La connexion n’a pas abouti.'));
  if (retour?.error) lines.push(retour.error);
  const title = t('Synchronisation');
  if (!connectee || !moteur) return { title, lines, buttons };
  // Une progression ne s'affiche que PENDANT une passe : une passe terminée laisserait un compteur figé. Les trois
  // valeurs sont nommées une fois, pour les deux phrases qui peuvent les porter.
  const avancement = moteur.enCours && moteur.progression
    ? { t: moteur.progression.table, n: moteur.progression.n, total: moteur.progression.total }
    : null;
  // Lot G (§ 4.1, I-G8) : une erreur de fichier n'est dite que pour une ligne RÉFÉRENCÉE (un orphelin n'est pas nommé), par le nom que la
  // personne reconnaît (nomFichier) et son motif en phrase ; trop_gros et forme à l'envoi n'offrent pas « Réessayer » (B-22). Ronde 1 : le nom
  // vient de fiches reçues (titre du livre, de la recette, nom de fichier) : il est BORNÉ comme les libellés de L3 (NOM_MAX, la coupe se voit).
  const refsFichiers = snapshot ? referencesFichiers(snapshot) : new Set();
  const erreursReferencees = (fichiersErreurs || []).filter((e) => refsFichiers.has(e?.sha256))
    .map((e) => ({ sha256: e.sha256, texte: `${tronquer(nomFichier(e.sha256, snapshot), NOM_MAX)} — ${motifFichier(e.motif, e.sens)}`, reessayer: !sansReessai(e.motif, e.sens) }));
  return {
    title,
    lines,
    buttons,
    // Le libellé ne lit rien en base : le magasin et l'identifiant borné suffisent à reconnaître la fiche, et le
    // motif est une phrase — le jeton ASCII du serveur ne se montre jamais (R9).
    quarantaine: enQuarantaine.map((e) => ({
      seq: e.seq,
      // Vague finale (I-G8) : une ligne files est nommée par nomFichier dès qu'un snapshot est là (sans snapshot : la forme de L3, bornée).
      libelle: e.store === 'files' && snapshot ? tronquer(nomFichier(e.id, snapshot), NOM_MAX) : `${e.store} · ${tronquer(e.id, CLE_MAX)}`,
      motif: motifEnvoi(e.last_error),
    })),
    conflits: aTrancher.map((c) => {
      const nom = c.local?.title || c.local?.name || null;
      return {
        id: c.id,
        libelle: c.store === 'files' && snapshot ? tronquer(nomFichier(c.record_id, snapshot), NOM_MAX) : `${c.store} · ${nom ? tronquer(nom, NOM_MAX) : tronquer(c.record_id, CLE_MAX)}`,
        dateIci: formatDate(c.local?.updated_at || c.at, { withTime: true }),
        dateAilleurs: formatDate(c.server?.updated_at || c.at, { withTime: true }),
        kind: c.kind,
        ...(c.kind === 'cycle' ? {copieLocale:JSON.stringify(c.local ?? {},null,2),peutAbandonnerCycle:c.store === 'recipes',recipeId:c.store === 'recipes' ? c.record_id : c.local?.recipe_id || c.server?.data?.id || null} : {}),
        // R-L3-29 : la version d'ici est DÉJÀ repartie — ce n'est pas une question posée à la personne. Jamais
        // deviné : seule la réception pose ce drapeau, et faux veut dire « il y a vraiment un choix à faire ».
        renvoye: c.renvoye === true,
        // R-L3-30 : la version d'ailleurs est une TOMBALE. Même renvoyé, ce conflit garde alors une vraie question —
        // « est-ce que j'accepte la suppression ? » — et c'est la seule que R-L3-26 ait laissée à la personne.
        suppressionAilleurs: !!c.server?.deleted_at,
      };
    }),
    progression: avancement
      ? (moteur.phase === 'reception' ? t('Réception : {t} {n}/{total}', avancement) : t('Envoi initial : {t} {n}/{total}', avancement))
      : null,
    pause: moteur.pause?.raison === 'quota'
      ? t('Espace serveur plein — rien n’est perdu, tout reste sur cet appareil.')
      : null,
    // Lot G (§ 4.1) : l'ensemble L4 — des faits du moteur, des phrases ici ; aucun plan, palier ni prix (R-G-5).
    fichiers: modeleFichiers(moteur, { qualite, refuses: erreursReferencees.length }),
    espace: phraseEspace(moteur.espaceServeur),
    qualite: qualite === 'originale' ? 'originale' : 'reduite',
    erreursFichiers: erreursReferencees,
  };
}

// Un libellé vient des données : il est BORNÉ, et la coupe se voit — un nom tronqué ne doit pas passer pour le nom
// entier. Une clé opaque se reconnaît en 12 caractères ; un titre est fait pour être lu, on lui en laisse 40.
const CLE_MAX = 12;
const NOM_MAX = 40;
// Ronde 2 du lot G (re-revue sécurité) : la coupe se fait par POINTS DE CODE — jamais une paire de substitution coupée en deux.
const tronquer = (valeur, max) => { const s = String(valeur ?? ''); const points = [...s]; return points.length > max ? points.slice(0, max).join('') + '…' : s; };

// Vocabulaire des motifs de rejet (spec § 5.3, R9) : le serveur renvoie des jetons ASCII, la personne lit une
// phrase qui dit QUOI regarder. Un jeton inattendu (serveur plus récent que cette version de l'app) tombe sur la
// phrase la plus générale — jamais sur le jeton brut, et jamais sur une cause inventée.
const MOTIFS_ENVOI = {
  taille: 'Fiche trop grosse (plus de 512 Ko)',
  updated_at: 'Fiche sans date',
  cle: 'Clé incohérente',
  forme: 'Fiche mal formée',
  refus: 'Refusée par le serveur',
};

export const motifEnvoi = (code) => t(Object.hasOwn(MOTIFS_ENVOI, code) ? MOTIFS_ENVOI[code] : 'Envoi refusé');

function exportBundles(ctx, { includeReferences = false } = {}) {
  return documentsActifs(ctx).filter((d) => includeReferences || d.version).map((d) => ({ recipe: d.recipe, version: d.version, book: d.book, edition: d.edition }));
}

export { extFor };
