const pause = () => new Promise(resolve => setTimeout(resolve, 0));
export function ligneMinuteurL7({ id = 'timer-a', duree = 90, version = 'version-a', channel = 'mirror' } = {}) {
  const at = '2026-10-30T10:00:00.000Z', op = 'ck_op_' + 'a'.repeat(64);
  return { id, timer_format: 1, cook_session_id: 'session', recipe_version_id: version, step_id: 'step', device_id: 'device', duration_seconds: duree, channel, requested_at: channel === 'mirror' ? null : at, handoff_state: channel === 'mirror' ? null : 'requested', source_timer: { ordinal: 0, seconds: duree, seconds_max: null, sha256: 'b'.repeat(64) }, legacy_launch_id: null, recipe_title_snapshot: version, task_label_snapshot: 'Repos', mirror: channel === 'mirror' ? { format: 1, started_at: at, deadline_at: new Date(Date.parse(at) + duree * 1000).toISOString() } : null, cooking_incarnation: op, cooking_revision: op, cooking_receipts: [], cooking_receipt_floor: 0, created_at: at, updated_at: at };
}
export async function runL7MinuteursEcranTests({ eq, ok }) {
  const { creerPanneauMinuteurs, commandesMinuteurEtape } = await import('../src/ui/minuteurs-session.js');
  const lignes = [ligneMinuteurL7(), ligneMinuteurL7({ id: 'timer-b', duree: 120, version: 'version-b' })], at = Date.parse(lignes[0].mirror.started_at);
  let maintenant = at, lectures = 0, tick, effaces = 0;
  const fenetre = new EventTarget(); fenetre.setInterval = fn => { tick = fn; return 9; }; fenetre.clearInterval = () => { effaces++; };
  const item = ligne => ({ lancement: Object.freeze({ id: ligne.id }), affiche: { ligne, etat: 'en_cours', raison: null, synchronisation: 'locale', confirmee: null } });
  const service = { lireMinuteurs: async () => { lectures++; return { issue: 'ok', actifs: lignes.map(item), demandes: [{ lancement: {}, affiche: { ligne: { id: 'ancien', cook_session_id: 'session', duration_seconds: 30, channel: 'siri' }, etat: 'sans_suivi', raison: null, synchronisation: 'locale', confirmee: null } }], historique: [], prochainCurseur: null, totalHistorique: 0 }; } };
  const node = creerPanneauMinuteurs({ sessionId: 'session', ctx: {}, service, portee: {}, estCourante: () => true, maintenant: () => maintenant, fenetre }); document.body.append(node);
  try {
    await node.actualiser(); eq(node.querySelectorAll('[data-role=minuteur-ligne]').length, 3, 'L7 panneau : deux suivis et demande sans ancre visibles');
    const compteurs = () => [...node.querySelectorAll('[data-role=minuteur-compteur]')].map(n => n.textContent);
    ok(compteurs().some(x => x.includes('1 min') && x.includes('30 s')), 'L7 panneau : première échéance affichée');
    maintenant = at + 70001; const avant = lectures; tick(); eq(lectures, avant, 'L7 panneau : tick sans lecture de base'); ok(compteurs().some(x => x.includes('20 s')), 'L7 panneau : ticks manqués, plafond depuis échéance');
    maintenant = at + 150000; tick(); ok(node.textContent.includes('Temps indicatif écoulé'), 'L7 panneau : écoulement sans inventer de sonnerie');
    eq(node.querySelector('[data-id=ancien] [data-role=minuteur-compteur]')?.textContent, 'Aucun suivi démarré.', 'L7 panneau : ancienne demande ne ressuscite pas un départ');
    const annonces = node.querySelector('[data-role=annonce-minuteurs]')?.textContent; tick(); eq(node.querySelector('[data-role=annonce-minuteurs]')?.textContent, annonces, 'L7 panneau : expiration annoncée une fois par montage');
    ok([...node.querySelectorAll('[data-role=minuteur-compteur]')].every(n => !n.hasAttribute('aria-live')), 'L7 panneau : compteurs hors région live');
  } finally { node.dispose(); node.remove(); }
  eq(effaces, 1, 'L7 panneau : intervalle libéré au dispose');
  {
    const n = creerPanneauMinuteurs({ sessionId: 'absente', ctx: {}, service: { lireMinuteurs: async () => ({ issue: 'echec', raison: 'stockage_indisponible', reessayable: true }) }, portee: {}, fenetre }); document.body.append(n);
    try { await n.actualiser(); ok(n.textContent.includes('Impossible'), 'L7 panneau : échec de lecture distinct d’aucune minuterie'); }
    finally { n.dispose(); n.remove(); }
  }
  for (const cas of ['terminee', 'invalide']) {
    const ligne = ligneMinuteurL7({ channel: 'shortcut' });
    const s = {
      lireSession: async () => ({ issue: 'ok', lecture: {}, projection: { etat: cas === 'terminee' ? 'terminee' : 'active', versions: [{ version_id: ligne.recipe_version_id, execution_autorisee: true }] } }),
      lireMinuteurs: async () => ({ issue: 'ok', actifs: [], demandes: [{ ...item(ligne), affiche: { ...item(ligne).affiche, etat: cas === 'invalide' ? 'invalide' : 'sans_suivi' } }], historique: [], prochainCurseur: null }),
    };
    const n = creerPanneauMinuteurs({ sessionId: 'session', service: s, portee: {}, fenetre, maintenant: () => at }); document.body.append(n);
    try { await n.actualiser(); eq([...n.querySelectorAll('button')].some(b => b.textContent.includes('Démarrer')), false, `L7 panneau : ${cas} sans nouveau départ proposé`); if (cas === 'invalide') eq(n.querySelector('[data-role=minuteur-ligne]').querySelectorAll('a[href],button:not([hidden])').length, 0, 'L7 panneau : ligne refusée par le service reste consultable sans gestes'); }
    finally { n.dispose(); n.remove(); }
  }
  {
    let terminer; const p = new Promise(r => { terminer = r; });
    const n = creerPanneauMinuteurs({ sessionId: 'session', service: { lireMinuteurs: () => p }, portee: {}, fenetre }); document.body.append(n);
    const lecture = n.actualiser(); n.dispose(); terminer({ issue: 'ok', actifs: lignes.map(item), demandes: [], historique: [], prochainCurseur: null }); await lecture;
    eq(n.querySelectorAll('[data-role=minuteur-ligne]').length, 0, 'L7 panneau : lecture après dispose ne rend pas les anciennes données'); n.remove();
  }
  {
    const doc = new EventTarget(); doc.visibilityState = 'hidden';
    let ticks = 0, arrets = 0, rappel, wall = at + 10000, monotone = 0;
    const win = new EventTarget(); win.setInterval = fn => { ticks++; rappel = fn; return ticks; }; win.clearInterval = () => { arrets++; };
    const n = creerPanneauMinuteurs({ sessionId: 'session', service, portee: {}, document: doc, fenetre: win, maintenant: () => wall, performanceNow: () => monotone }); document.body.append(n);
    try {
      await n.actualiser(); eq(ticks, 0, 'L7 panneau : aucun intervalle pendant montage masqué');
      doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); await n.actualiser(); eq(ticks, 1, 'L7 panneau : retour visible reprend un intervalle');
      wall += 60000; monotone += 500; rappel(); ok(n.querySelector('[data-role=horloge-minuteurs]')?.textContent.includes('Heure de l’appareil modifiée'), 'L7 horloge : avance discontinue visible annoncée');
      doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); eq(arrets, 1, 'L7 panneau : masquage suspend réellement les ticks');
      wall += 300000; monotone += 5; doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); await n.actualiser();
      eq(n.querySelector('[data-role=horloge-minuteurs]')?.hidden, true, 'L7 horloge : retour après sommeil sans diagnostic inventé');
      wall -= 5000; monotone += 500; rappel(); ok(n.querySelector('[data-role=horloge-minuteurs]')?.textContent.includes('Heure de l’appareil modifiée'), 'L7 horloge : recul visible annoncé même après heure de départ');
      eq(lignes[0].mirror.deadline_at, '2026-10-30T10:01:30.000Z', 'L7 horloge : diagnostic ne déplace pas échéance');
    } finally { n.dispose(); n.remove(); }
  }
  {
    let inverse = false;
    const s = { lireMinuteurs: async () => ({ issue: 'ok', actifs: (inverse ? [...lignes].reverse() : lignes).map(item), demandes: [], historique: [], prochainCurseur: null }) };
    const n = creerPanneauMinuteurs({ sessionId: 'session', service: s, portee: {}, fenetre, maintenant: () => at }); document.body.append(n);
    try { await n.actualiser(); const anciens = [...n.querySelectorAll('[data-role=minuteur-ligne]')]; inverse = true; await n.actualiser(); const suivants = [...n.querySelectorAll('[data-role=minuteur-ligne]')]; eq(suivants.map(x => x.dataset.id), ['timer-b', 'timer-a'], 'L7 panneau : ordre DOM suit ordre reçu'); ok(suivants[1] === anciens[0], 'L7 panneau : réordonner conserve les mêmes nœuds'); }
    finally { n.dispose(); n.remove(); }
  }
  {
    let prepares = 0, conserves = 0, premieres = null, quota = true; const intention = Object.freeze({ id: 'intention-exacte' });
    const s = { preparerLancement: async args => { prepares++; premieres = args; return { issue: 'ok', intention }; }, conserverLancement: async args => { conserves++; ok(args.intention === intention, 'L7 commande : conserve la même intention opaque'); return quota ? { issue: 'echec', raison: 'quota_stockage', reessayable: true } : { issue: 'conserve', lancement: {}, affiche: item(lignes[0]).affiche }; } };
    const n = commandesMinuteurEtape({ service: s, portee: {}, lecture: {}, version: { id: 'version-a' }, recipe: {}, step: { id: 'step', position: 1, timers: [{ seconds: 90 }] }, ordinal: 0, recipeTitle: 'Pain', estCourante: () => true, onConserve: () => {} }); document.body.append(n);
    try {
      const trouver = texte => [...n.querySelectorAll('button')].find(b => b.textContent === texte);
      trouver('Démarrer un suivi indicatif')?.click(); await pause(); eq(prepares, 1, 'L7 commande : préparation au geste'); eq(premieres?.channel, 'mirror', 'L7 commande : suivi autonome, sans système');
      quota = false; trouver('Réessayer l’enregistrement')?.click(); await pause(); eq(prepares, 1, 'L7 commande : quota ne prépare pas une nouvelle date'); eq(conserves, 2, 'L7 commande : réessai reprend la conservation');
    } finally { n.dispose(); n.remove(); }
  }
  {
    let commits = 0;
    const n = commandesMinuteurEtape({ service: { preparerLancement: async () => ({ issue: 'ok', intention: {} }), conserverLancement: async () => { commits++; return { issue: 'conserve', lancement: {}, affiche: item(lignes[0]).affiche }; } }, portee: {}, lecture: {}, version: { id: 'version-a' }, step: { id: 'step', timers: [{ seconds: 90 }] }, ordinal: 0, onConserve: () => { throw Error('affichage indisponible'); } }); document.body.append(n);
    try { [...n.querySelectorAll('button')].find(b => b.textContent === 'Démarrer un suivi indicatif').click(); await pause(); eq(commits, 1, 'L7 commande : commit terminé malgré erreur d’affichage'); ok(!n.textContent.includes('n’a pas pu être enregistrée'), 'L7 commande : erreur après commit ne nie pas la conservation'); }
    finally { n.dispose(); n.remove(); }
  }
}
