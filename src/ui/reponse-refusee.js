// Lecture documentaire uniquement : les octets ne deviennent jamais une proposition.
import { el, confirmDialog, downloadBlob } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getSyncGeneration } from './state.js';
import { protegerSortieEditeur } from './sortie-editeur.js';

const MOTIFS = {
  capacite: 'La quantité proposée dépasse la capacité autorisée.',
  eau_vapeur: 'La quantité d’eau proposée pour la vapeur n’est pas autorisée.',
  vapeur_cumulee: 'La durée cumulée de vapeur proposée dépasse la limite autorisée.',
  huile_seule: 'La proposition chauffe de l’huile seule, ce qui n’est pas autorisé.',
  graisse_chaude: 'La proposition combine de la graisse chaude avec un réglage non autorisé.',
  froid_non_etabli: 'La température des ingrédients n’est pas assez établie pour ce mixage.',
  froid_invalide: 'Les précisions sur les ingrédients froids ne correspondent pas aux étapes.',
  temperature: 'La température proposée n’est pas autorisée.',
  vitesse: 'La vitesse proposée n’est pas autorisée.',
  accessoire: 'L’accessoire proposé ne convient pas à ce réglage.',
  instruction_libre: 'L’explication propose un geste qui n’est pas autorisé.',
  texte_interdit: 'La réponse contient une indication qui ne peut pas être retenue.',
  quantite_inconnue: 'Une quantité nécessaire aux vérifications n’est pas connue.',
  contenu_non_etabli: 'Le contenu du bol n’est pas assez établi pour vérifier ce réglage.',
  contenu_incoherent: 'Le contenu proposé ne correspond pas aux ingrédients ajoutés.',
  double_ajout: 'La proposition ajoute plusieurs fois le même ingrédient.',
  fouet_cumule: 'La proposition dépasse la durée autorisée avec le fouet.',
  total_incompatible: 'Les durées proposées ne sont pas cohérentes entre elles.',
  actif_incompatible: 'Le temps actif proposé n’est pas cohérent avec le temps total.',
  duree_non_sourcee: 'Une durée présentée comme issue de la recette n’y a pas été retrouvée.',
  reference_inventee: 'La réponse cite un passage qui n’existe pas dans la recette.',
  plage: 'Une plage de durée proposée n’est pas valide.',
  minutes: 'Une durée proposée n’est pas valide.',
  niveau: 'Le niveau de difficulté proposé n’est pas reconnu.',
  explication_absente: 'Une estimation proposée n’est pas expliquée.',
  json: 'La réponse reçue n’a pas le format attendu.',
  structure: 'La réponse reçue n’a pas le format attendu.',
  structure_invalide: 'La réponse reçue n’a pas le format attendu.',
  reponse_illisible: 'La réponse reçue n’a pas pu être lue.',
  reponse_trop_grande: 'La réponse reçue dépasse la taille autorisée.',
  reponse_incomplete: 'La réponse reçue est incomplète.',
  max_tokens: 'La réponse reçue est incomplète.',
  interrompu: 'La réponse reçue est incomplète.',
  refus: 'L’assistant n’a pas proposé de résultat pour cette demande. Aucun nouvel appel n’est lancé.',
  conservation_en_attente: 'La réponse reçue est encore en mémoire. Enregistre-la sur cet appareil avant de quitter.'
};
export function texteMotifReponseRefusee(motif) { return MOTIFS[motif] ? t(MOTIFS[motif]) : null; }
const erreurLecture = () => t('Cette réponse ne peut pas être relue dans le contexte actuel. Rouvre la recette.');

export function creerAffichageReponseRefusee({ repo, conservation, recipeId, kind, deps = {} }) {
  const base = repo.db, connexion = base.idb, generation = getSyncGeneration();
  return async function installer(root, { getImportId, estCourante = () => true, onJournal = () => {}, onEtat = () => {} } = {}) {
    let detruit = false, lecture = 0, dto = null, texte = '', encours = false;
    const operations = new Set(), abonnes = new Set();
    const courant = () => !detruit && repo.db === base && base.idb === connexion && getSyncGeneration() === generation && estCourante();
    const pending = () => courant() && !!getImportId() && conservation.presenceEnAttente({ importId: getImportId() });
    const etat = () => ({ sale: pending(), enCours: encours, publie: false });
    const notifier = () => { const bouton = panneau.querySelector('[data-role=reessayer-reponse]'); if (bouton) bouton.disabled = encours; for (const f of abonnes) f(etat()); onEtat(); };
    const panneau = el('section', { class: 'card stack', hidden: true, dataset: { role: 'reponse-refusee' } });
    const retour = el('p', { class: 'status warn', role: 'status', hidden: true });
    const afficherRetour = message => { retour.textContent = message; retour.hidden = !message; };
    const position = root.querySelector('[data-role=etat-tm7],[data-role=etat-reperes]');
    if (position) position.after(panneau); else root.append(panneau);
    async function identite(id) {
      if (!id || !courant()) return false;
      const row = await repo.get('imports', id);
      return courant() && getImportId() === id && row?.kind === kind && row.recipe_id === recipeId;
    }
    async function lireCourante() {
      const id = getImportId();
      if (!await identite(id)) return null;
      const bornes = async () => Promise.all(['user_id', 'editor_library_epoch:v1'].map(key => base.get('sync_state', key).then(r => r?.value ?? null)));
      const avant = await bornes(); if (!courant()) return null;
      const result = pending() ? await conservation.reponseEnAttente({ importId: id }) : await conservation.lire({ importId: id });
      const valide = await identite(id), apres = await bornes();
      return courant() && valide && JSON.stringify(avant) === JSON.stringify(apres) ? result : null;
    }
    const agir = f => {
      const p = Promise.resolve().then(f).catch(() => { if (courant()) afficherRetour(erreurLecture()); }).finally(() => operations.delete(p));
      operations.add(p); return p;
    };
    async function recuperer() {
      // Relire la portée et les octets au geste : aucun ancien corps après un changement de bibliothèque.
      const lu = await lireCourante(); if (!courant() || lu?.issue !== 'ok' || !['disponible', 'en_attente'].includes(lu.etat)) return;
      let extension = 'txt'; try { new TextDecoder('utf-8', { fatal: true }).decode(lu.octets); } catch { extension = 'bin'; }
      (deps.telechargerReponse || downloadBlob)(new Blob([lu.octets], { type: extension === 'txt' ? 'text/plain;charset=utf-8' : 'application/octet-stream' }), `reponse-assistant.${extension}`);
    }
    async function actualiser() {
      const ticket = ++lecture; notifier();
      const result = await lireCourante();
      if (!courant() || ticket !== lecture) return;
      dto = result; texte = ''; afficherRetour(''); panneau.replaceChildren(); panneau.hidden = !result || result.issue === 'ok' && result.etat === 'aucune';
      if (panneau.hidden) return;
      panneau.append(el('h2', null, t('Réponse refusée')), el('p', { dataset: { role: 'motif-reponse-refusee' } }, texteMotifReponseRefusee(result.motif) || t('La réponse reçue ne respecte pas les vérifications de cette demande.')));
      if (result.issue !== 'ok') { panneau.append(el('p', { class: 'status warn' }, erreurLecture())); return; }
      if (result.etat === 'absente') { panneau.append(el('p', null, t('Cette réponse est absente de cet appareil. Ouvre l’appareil qui l’a reçue pour la consulter.'))); return; }
      const memoire = result.etat === 'en_attente';
      panneau.append(el('p', { class: memoire ? 'status warn' : 'muted', style: { display: 'block' } }, memoire
        ? t('La réponse reçue est encore en mémoire. Enregistre-la sur cet appareil avant de quitter.')
        : t('Cette réponse refusée est conservée sur cet appareil. Elle ne peut pas être appliquée à la recette.')));
      try { texte = new TextDecoder('utf-8', { fatal: true }).decode(result.octets); }
      catch { panneau.append(el('p', null, t('Ces octets ne peuvent pas être affichés comme du texte. Tu peux récupérer le fichier complet.'))); }
      if (texte) panneau.append(el('details', null, el('summary', null, t('Voir la réponse reçue')), el('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '100%' } }, texte)));
      const actions = el('div', { class: 'actions' }, el('button', { type: 'button', class: 'btn', dataset: { role: 'recuperer-reponse' }, onClick: () => agir(recuperer) }, t('Récupérer la réponse reçue')));
      if (memoire) actions.append(el('button', { type: 'button', class: 'btn primary', disabled: encours, dataset: { role: 'reessayer-reponse' }, onClick: () => agir(flush) }, t('Réessayer l’enregistrement — sans appel')));
      else actions.append(el('button', { type: 'button', class: 'btn', dataset: { role: 'abandonner-reponse' }, onClick: () => agir(async () => {
        if (!courant() || pending()) return;
        const attendu = dto?.attendu;
        if (!attendu || !await (deps.confirmer || deps.confirmDialog || confirmDialog)(t('Supprimer cette réponse refusée de cet appareil ? Cette suppression ne modifie pas la recette.'), { okLabel: t('Supprimer cette réponse') }) || !courant() || pending() || !await identite(getImportId())) return;
        const r = await conservation.abandonner({ attendu });
        if (!courant()) return;
        if (r.issue !== 'abandonne') afficherRetour(erreurLecture());
        else { if (r.journal) onJournal(r.journal); afficherRetour(''); await actualiser(); }
      }) }, t('Supprimer cette réponse')));
      panneau.append(actions, retour); notifier();
    }
    async function flush() {
      if (!courant()) return { issue: 'refuse', raison: 'contexte_change' };
      if (!pending()) return { issue: 'ok' };
      if (!await identite(getImportId())) return { issue: 'refuse', raison: 'contexte_change' };
      encours = true; notifier();
      try {
        const r = await conservation.reessayerConservation({ importId: getImportId() });
        if (!courant()) return { issue: 'refuse', raison: 'contexte_change' };
        if (r.issue === 'conserve') onJournal(r.journal);
        await actualiser();
        if (r.issue === 'conserve') return { issue: 'ok' };
        afficherRetour(t('L’enregistrement n’a pas réussi. La réponse reste en mémoire ; récupère-la ou réessaie sans nouvel appel.'));
        return { issue: 'refuse', raison: r.raison || 'conservation_echouee' };
      } finally { encours = false; notifier(); }
    }
    const controleur = { etat, flush, lireTexte: () => texte, souscrire: f => { abonnes.add(f); f(etat()); return () => abonnes.delete(f); } };
    const stop = protegerSortieEditeur({ racine: root, controleur, demander: () => (deps.demanderSortieReponse || confirmDialog)(t('La réponse reçue est encore en mémoire. Quitter peut la perdre. Reste pour récupérer le fichier ou réessayer son enregistrement.'), { okLabel: t('Quitter sans la conserver'), cancelLabel: t('Rester') }) });
    const attendreAvant = root.attendreEcritures, disposeAvant = root.dispose;
    let monte = false;
    const observer = new MutationObserver(() => { if (root.isConnected) monte = true; else if (monte) dispose(); });
    observer.observe(document.body, { childList: true, subtree: true });
    function dispose() { if (detruit) return; observer.disconnect(); detruit = true; lecture++; dto = null; texte = ''; panneau.replaceChildren(); panneau.hidden = true; stop(); }
    root.disposerReponseRefusee = dispose;
    root.dispose = () => { dispose(); disposeAvant?.(); };
    root.actualiserReponseRefusee = () => agir(actualiser);
    root.etatEditeur = etat; root.flushEditeur = () => agir(flush);
    root.attendreEcritures = async () => { await attendreAvant?.(); while (operations.size) await Promise.all([...operations]); };
    await actualiser(); return root;
  };
}
