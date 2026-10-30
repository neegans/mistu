import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { timerBlock } from './components.js';
import { describeDuration, normaliserDuree, shortcutUrl } from '../domain/timers.js';
import { projeterSuiviMinuteur } from '../domain/cuisine-format.js';

const succes = r => r?.issue === 'conserve' || r?.issue === 'deja_conserve';
const courante = fn => { try { return fn(); } catch { return false; } };
export function texteErreurMinuteur(resultat) {
  switch (resultat?.raison) {
    case 'quota_stockage': return t('L’espace de stockage est insuffisant. La demande n’est pas enregistrée.');
    case 'compte_change': case 'contexte_change': case 'bibliotheque_remplacee': return t('Le contexte a changé. Reviens à la cuisine avant de préparer une nouvelle demande.');
    case 'session_absente': case 'session_terminee': return t('Cette séance ne permet plus de démarrer un suivi. Les suivis conservés restent consultables.');
    case 'source_changee': case 'cycle_change': return t('La recette a changé. Reviens à l’étape pour préparer une nouvelle demande.');
    case 'ancre_changee': return t('Ce suivi a déjà une autre heure de départ. Revois les minuteries.');
    case 'handoff_change': return t('L’état de cette demande a changé ailleurs. Revois les minuteries.');
    case 'forme_invalide': case 'bornes': return t('Cette demande ne peut pas être enregistrée dans ce format.');
    default: return t('La demande n’a pas pu être enregistrée sur cet appareil. Réessaie.');
  }
}

// Une intention reste la même entre deux tentatives de conservation, dates de départ comprises.
function gesteDurable({ estCourante, statut, boutonReessai, surConserve }) {
  let action = null, enCours = false, detruit = false;
  const vivante = () => !detruit && courante(estCourante);
  const afficherErreur = resultat => {
    if (!vivante()) return;
    statut.textContent = texteErreurMinuteur(resultat); statut.hidden = false;
    boutonReessai.hidden = !action || resultat?.reessayable === false;
  };
  async function executer(proposition = null) {
    if (!vivante() || enCours) return { issue: 'refuse', raison: 'contexte_change' };
    if (proposition && (!action || action.cle !== proposition.cle)) action = { ...proposition, intention: null };
    if (!action) return { issue: 'refuse', raison: 'contexte_change' };
    const choisie = action;
    enCours = true; boutonReessai.disabled = true;
    try {
      if (!choisie.intention) {
        const preparation = await choisie.preparer();
        if (preparation?.issue !== 'ok') { afficherErreur(preparation); return preparation; }
        choisie.intention = preparation.intention;
      }
      if (!vivante()) return { issue: 'refuse', raison: 'contexte_change' };
      const resultat = await choisie.conserver({ intention: choisie.intention });
      if (!succes(resultat)) { afficherErreur(resultat); return resultat; }
      action = null;
      if (vivante()) {
        statut.textContent = t('Conservé sur cet appareil.'); statut.hidden = false; boutonReessai.hidden = true;
        try { await choisie.apres?.(resultat); if (vivante()) await surConserve?.(resultat); }
        catch { if (vivante()) statut.textContent = t('Demande conservée. L’affichage n’a pas pu être actualisé.'); }
      }
      return resultat;
    } catch {
      const resultat = { issue: 'echec', raison: 'stockage_indisponible', reessayable: true };
      afficherErreur(resultat); return resultat;
    } finally { enCours = false; if (vivante()) boutonReessai.disabled = false; }
  }
  boutonReessai.addEventListener('click', () => { void executer(); });
  return { executer, enCours: () => enCours, oublier: () => { if (!enCours) { action = null; boutonReessai.hidden = true; } }, dispose: () => { detruit = true; } };
}

export function commandesMinuteurEtape({ service, portee, lecture, version, recipe, step, ordinal, recipeTitle, locale = 'fr', estCourante = () => true, onConserve, deps = {} }) {
  let detruit = false, choix = null;
  const tm = step?.timers?.[ordinal], min = normaliserDuree(tm?.seconds), max = tm?.seconds_max == null ? null : normaliserDuree(tm.seconds_max);
  const vivante = () => !detruit && courante(estCourante);
  const statut = el('div', { class: 'status warn', role: 'status', hidden: true });
  const reessai = el('button', { type: 'button', class: 'btn', hidden: true }, t('Réessayer l’enregistrement'));
  const geste = gesteDurable({ estCourante: vivante, statut, boutonReessai: reessai, surConserve: onConserve });
  const sourceValide = min !== null && (tm?.seconds_max == null || max !== null && max >= min);
  if (sourceValide && (max === null || max === min)) choix = min;
  const autonome = el('button', { class: 'btn', type: 'button', disabled: !sourceValide || choix === null, onClick: () => { void lancer('mirror', choix); } }, t('Démarrer un suivi indicatif'));
  const lancer = async (channel, seconds) => {
    if (!vivante() || !sourceValide || ![min, max].includes(seconds)) return { issue: 'refuse', raison: 'forme_invalide' };
    const borne = max !== null && max > min && seconds === max ? 'max' : 'min';
    return geste.executer({ cle: channel + ':' + seconds,
      preparer: () => service.preparerLancement({ portee, lecture, versionId: version.id, stepId: step.id, ordinal, choix: borne, channel,
        snapshots: { recipe_title: recipeTitle || recipe?.display_title || recipe?.original_title || '', task_label: tm.label || (Number.isFinite(step.position) ? t('Étape {n}', { n: step.position }) : t('Durée choisie')) } }),
      conserver: args => service.conserverLancement(args),
    });
  };
  const commandes = timerBlock(tm?.seconds, {
    seconds_max: tm?.seconds_max, locale, compact: true, estCourante: vivante,
    ...(Object.hasOwn(deps, 'apple') ? { apple: deps.apple } : {}),
    onChoice: seconds => { choix = seconds; autonome.disabled = choix === null; geste.oublier(); },
    onRequest: lancer,
    onOpen: conservee => geste.executer({ cle: 'opening:' + conservee.affiche.ligne.id,
      preparer: () => service.preparerSignalement({ portee, lancement: conservee.lancement, etat: 'opening' }),
      conserver: args => service.signalerDemande(args),
    }),
  });
  const node = el('div', { class: 'minuteur-commandes stack', dataset: { role: 'commandes-minuteur' } }, commandes, autonome, statut, reessai);
  node.dispose = () => { detruit = true; geste.dispose(); commandes.dispose?.(); };
  return node;
}

function texteDemande(row) {
  if (row.channel === 'mirror') return t('Suivi indicatif, sans alarme système.');
  if (row.handoff_state === 'failed') return t('Tu as indiqué que la minuterie système n’a pas démarré.');
  if (row.channel === 'siri') return t('Demande à Siri déclarée par toi ; l’app ne peut pas la confirmer.');
  if (row.handoff_state === 'requested') return t('Demande préparée. Raccourcis n’a pas encore été actionné ici.');
  return t('Ouverture non confirmée : vérifie dans Horloge.');
}

export function creerPanneauMinuteurs({ sessionId, ctx = {}, service, portee, estCourante = () => true, maintenant = () => Date.now(), fenetre = globalThis.window, document: doc = globalThis.document, performanceNow = () => globalThis.performance?.now(), surChangement }) {
  let detruit = false, numero = 0, lectureVol = null, relire = false, lectureSession = null, projectionSession = null, prochainCurseur = null, erreur = null;
  let intervalle = null, mesureHorloge = null, horlogeModifiee = false;
  const lignes = new Map(), annoncees = new Set(), liensUtilises = new Set();
  const vivante = () => !detruit && courante(estCourante);
  const statut = el('p', { class: 'muted', role: 'status' }, t('Chargement des minuteries…'));
  const liste = el('div', { class: 'minuteurs-liste stack' });
  const annonce = el('p', { class: 'sr-only', role: 'status', dataset: { role: 'annonce-minuteurs' } });
  const horloge = el('p', { class: 'status warn', role: 'status', hidden: true, dataset: { role: 'horloge-minuteurs' } });
  const historique = el('button', { class: 'btn', type: 'button', hidden: true, onClick: () => { void actualiser({ suite: true }); } }, t('Voir les suivis précédents'));
  const relecture = el('button', { class: 'btn', type: 'button', hidden: true, onClick: () => { void actualiser(); } }, t('Réessayer la lecture'));
  const node = el('section', { class: 'cuisine-minuteurs', dataset: { role: 'panneau-minuteurs' }, 'aria-label': t('Minuteurs de cette séance') }, el('h2', null, t('Minuteurs')), statut, horloge, liste, annonce, historique, relecture);
  const etat = () => ({ lectureEnCours: !!lectureVol, erreur, suivisActifs: [...lignes.values()].filter(x => x.item.affiche.etat !== 'invalide' && projeterSuiviMinuteur(x.item.affiche.ligne, maintenant()).etat === 'en_cours').length });

  function rafraichirTemps() {
    if (!vivante() || doc?.visibilityState === 'hidden') return;
    const maintenantMs = maintenant(), nouvelles = [];
    const monotone = performanceNow();
    // Deux secondes de discontinuité visible ; jamais une comparaison à travers un masquage/sommeil.
    if (mesureHorloge && Number.isFinite(maintenantMs) && Number.isFinite(monotone) && monotone >= mesureHorloge.monotone
      && Math.abs((maintenantMs - mesureHorloge.wall) - (monotone - mesureHorloge.monotone)) > 2000) horlogeModifiee = true;
    mesureHorloge = Number.isFinite(monotone) && Number.isFinite(maintenantMs) ? { wall: maintenantMs, monotone } : null;
    if (horlogeModifiee) { horloge.hidden = false; horloge.textContent = t('Heure de l’appareil modifiée : vérifie dans Horloge.'); }
    for (const vue of lignes.values()) {
      const row = vue.item.affiche.ligne, p = vue.item.affiche.etat === 'invalide' ? { etat: 'invalide' } : projeterSuiviMinuteur(row, maintenantMs);
      vue.compteur.textContent = p.etat === 'en_cours' ? t('Suivi indicatif : {d}', { d: describeDuration(p.reste_secondes, ctx.settings?.ui_locale || 'fr') })
        : p.etat === 'ecoule' ? t('Temps indicatif écoulé') : p.etat === 'sans_suivi' ? t('Aucun suivi démarré.') : t('Suivi non interprétable.');
      if (p.raison === 'horloge_modifiee') vue.compteur.textContent += ' ' + t('Heure de l’appareil modifiée : vérifie dans Horloge.');
      if (p.etat === 'ecoule' && !annoncees.has(row.id)) { annoncees.add(row.id); nouvelles.push(row.task_label_snapshot || t('Durée choisie')); }
    }
    if (nouvelles.length) annonce.textContent = t('Temps indicatif écoulé : {taches}', { taches: nouvelles.join(', ') });
  }

  function creerLigne(item) {
    const row = item.affiche.ligne;
    const titre = el('h3'), contexte = el('p', { class: 'muted' }), compteur = el('p', { class: 'minuteur-compteur', dataset: { role: 'minuteur-compteur' } });
    const demande = el('p', { class: 'muted' }), synchronisation = el('p', { class: 'muted' }), confirmation = el('p', { class: 'status warn', hidden: true });
    const actions = el('div', { class: 'row minuteur-actions' });
    const avis = el('p', { role: 'status', hidden: true }), reessai = el('button', { class: 'btn', type: 'button', hidden: true }, t('Réessayer l’enregistrement'));
    const element = el('article', { class: 'minuteur-ligne', dataset: { role: 'minuteur-ligne', id: row.id } }, titre, contexte, compteur, demande, synchronisation, confirmation, actions, avis, reessai);
    const vue = { item, element, titre, contexte, compteur, demande, synchronisation, confirmation, actions, lecture: lectureSession };
    vue.geste = gesteDurable({ estCourante: vivante, statut: avis, boutonReessai: reessai, surConserve: async () => { await actualiser(); } });
    return vue;
  }

  function dessinerLigne(vue) {
    const { ligne: row, synchronisation: synchro, confirmee } = vue.item.affiche;
    vue.lecture = lectureSession;
    vue.titre.textContent = row.task_label_snapshot || t('Durée choisie');
    vue.contexte.textContent = [row.recipe_title_snapshot || t('Recette indisponible'), describeDuration(row.duration_seconds, ctx.settings?.ui_locale || 'fr')].join(' · ');
    vue.demande.textContent = texteDemande(row);
    vue.synchronisation.textContent = synchro === 'confirmee' ? t('Confirmé par la synchronisation.') : synchro === 'en_attente' ? t('Conservé ici, en attente d’envoi.') : synchro === 'conflit' ? t('Modification en conflit. Les deux états restent distincts.') : t('Conservé sur cet appareil.');
    vue.confirmation.hidden = synchro !== 'conflit';
    if (synchro === 'conflit') vue.confirmation.textContent = [row.mirror ? t('Départ local : {date}', { date: row.mirror.started_at }) : t('Aucun départ local conservé.'), confirmee?.mirror ? t('Départ confirmé ailleurs : {date}', { date: confirmee.mirror.started_at }) : t('Aucun départ confirmé reçu pour comparer ce suivi.')].join(' ');
    vue.actions.replaceChildren();
    const p = projeterSuiviMinuteur(row, maintenant());
    if (vue.item.affiche.etat === 'invalide' || p.etat === 'invalide' || synchro === 'conflit') return;
    const execution = projectionSession?.etat === 'active' && projectionSession.versions?.some(v => v.version_id === row.recipe_version_id && v.execution_autorisee === true);
    if (p.etat === 'sans_suivi' && vue.lecture && execution) {
      vue.actions.append(el('button', { class: 'btn', type: 'button', onClick: () => {
        const lancement = vue.item.lancement, lecture = vue.lecture;
        void vue.geste.executer({ cle: 'ancre:' + row.id, preparer: () => service.preparerAncre({ portee, lecture, lancement }), conserver: args => service.conserverAncre(args) });
      } }, row.timer_format === 1 ? t('Démarrer le suivi indicatif maintenant') : t('Démarrer un nouveau suivi indicatif')));
    }
    if (row.channel !== 'mirror' && row.handoff_state !== 'failed') {
      vue.actions.append(el('button', { class: 'btn', type: 'button', onClick: () => {
        const lancement = vue.item.lancement;
        void vue.geste.executer({ cle: 'failed:' + row.id, preparer: () => service.preparerSignalement({ portee, lancement, etat: 'failed' }), conserver: args => service.signalerDemande(args) });
      } }, t('Ça n’a pas démarré')));
    }
    if (row.channel === 'shortcut' && row.handoff_state === 'requested' && !liensUtilises.has(row.id)) {
      const href = shortcutUrl(row.duration_seconds);
      if (href) vue.actions.prepend(el('a', { class: 'btn', href, onClick: event => {
        if (!vivante() || liensUtilises.has(row.id)) { event.preventDefault(); return; }
        liensUtilises.add(row.id); const lancement = vue.item.lancement;
        void vue.geste.executer({ cle: 'opening:' + row.id, preparer: () => service.preparerSignalement({ portee, lancement, etat: 'opening' }), conserver: args => service.signalerDemande(args) });
        fenetre.setTimeout?.(() => { if (vivante()) dessinerLigne(vue); }, 0);
      } }, t('Ouvrir Raccourcis')));
    }
  }

  async function actualiser({ suite = false } = {}) {
    if (!vivante()) return;
    if (lectureVol) { relire = true; return lectureVol; }
    const attendu = ++numero, curseur = suite ? prochainCurseur : null;
    historique.disabled = true;
    lectureVol = (async () => {
      try {
        const [resultat, session] = await Promise.all([
          service.lireMinuteurs({ portee, sessionId, curseur, limiteHistorique: 30 }),
          service.lireSession ? service.lireSession({ portee, sessionId }) : Promise.resolve(null),
        ]);
        if (!vivante() || attendu !== numero) return;
        if (resultat?.issue !== 'ok') { erreur = resultat?.raison || 'stockage_indisponible'; statut.textContent = t('Impossible de relire les minuteries. Réessaie.'); relecture.hidden = false; return; }
        erreur = null; lectureSession = session?.issue === 'ok' ? session.lecture : null; projectionSession = session?.issue === 'ok' ? session.projection : null;
        const items = [...resultat.actifs, ...resultat.demandes, ...resultat.historique], ids = new Set(items.map(x => x.affiche.ligne.id));
        if (!suite) for (const [id, vue] of lignes) if (!ids.has(id)) { vue.geste.dispose(); vue.element.remove(); lignes.delete(id); }
        for (const item of items) {
          const id = item.affiche.ligne.id;
          let vue = lignes.get(id);
          if (!vue) { vue = creerLigne(item); lignes.set(id, vue); liste.append(vue.element); }
          vue.item = item; dessinerLigne(vue);
        }
        const principaux = [...resultat.actifs, ...resultat.demandes].map(x => x.affiche.ligne.id), fin = resultat.historique.map(x => x.affiche.ligne.id);
        const precedents = suite ? [...lignes.keys()].filter(id => !principaux.includes(id) && !fin.includes(id)) : [];
        for (const id of [...new Set([...principaux, ...precedents, ...fin])]) { const vue = lignes.get(id); if (vue) liste.append(vue.element); }
        prochainCurseur = resultat.prochainCurseur;
        historique.hidden = !prochainCurseur; relecture.hidden = true;
        statut.textContent = lignes.size ? t('Suivis indicatifs : aucune alarme système n’est confirmée par Mistu.') : t('Aucune minuterie conservée pour cette séance.');
        rafraichirTemps(); surChangement?.(etat());
      } catch { if (vivante()) { erreur = 'stockage_indisponible'; statut.textContent = t('Impossible de relire les minuteries. Réessaie.'); relecture.hidden = false; } }
      finally { lectureVol = null; if (vivante()) { historique.disabled = false; if (relire) { relire = false; void actualiser(); } } }
    })();
    return lectureVol;
  }
  function suspendre() {
    if (intervalle !== null) { fenetre?.clearInterval?.(intervalle); intervalle = null; }
    mesureHorloge = null; horlogeModifiee = false; horloge.hidden = true;
  }
  const retour = () => {
    suspendre();
    if (vivante() && doc?.visibilityState !== 'hidden') { intervalle = fenetre?.setInterval?.(rafraichirTemps, 500) ?? null; rafraichirTemps(); void actualiser(); }
  };
  doc?.addEventListener('visibilitychange', retour); fenetre?.addEventListener('pageshow', retour);
  if (doc?.visibilityState !== 'hidden') intervalle = fenetre?.setInterval?.(rafraichirTemps, 500) ?? null;
  node.actualiser = actualiser; node.etat = etat;
  node.dispose = node.detruire = () => {
    if (detruit) return; detruit = true; numero++;
    suspendre(); doc?.removeEventListener('visibilitychange', retour); fenetre?.removeEventListener('pageshow', retour);
    for (const vue of lignes.values()) { vue.geste.dispose(); for (const a of vue.element.querySelectorAll('a[href]')) a.removeAttribute('href'); }
  };
  void actualiser();
  return node;
}
