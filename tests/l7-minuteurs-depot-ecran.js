import { withRepo } from './sync-fixture.js';
import { fixtureLectureL6 } from './l6-lecture-ecrans.js';
import { creerServiceCuisine } from '../src/domain/cuisine-persistance.js';
import { commandesMinuteurEtape, creerPanneauMinuteurs } from '../src/ui/minuteurs-session.js';
const attendre = async f => { for (let i = 0; i < 150; i++) { if (await f()) return; await new Promise(r => setTimeout(r, 10)); } throw Error('État attendu non atteint'); };
const bouton = (n, texte) => [...n.querySelectorAll('button')].find(b => b.textContent === texte);
export async function runL7MinuteursDepotEcranTests({ eq, ok }) {
  await withRepo(async (repo, db) => {
    const f = fixtureLectureL6(), at = '2026-10-30T10:00:00.000Z'; let temps = Date.parse(at), quota = true, id = 0;
    f.version.steps = [{ id: 'l7-etape', position: 1, text: 'Laisser reposer.', timers: [{ seconds: 90, label: 'Repos' }] }];
    const session = { id: 'l7-ui-session', recipe_id: f.recipe.id, meal_id: null, selected_version_ids: [f.version.id], active_version_id: f.version.id, servings: f.version.servings, units: 'original', lang: 'fr', status: 'active', started_at: at, progress: { done_step_ids: [] } };
    await db.mutate({ origin: 'remote', puts: { recipes: [f.recipe], recipe_versions: [f.version], cook_sessions: [session] } });
    const service = creerServiceCuisine({ repo, getGeneration: () => 0, maintenant: () => new Date(temps).toISOString(), newId: prefix => prefix + '-ui-' + (++id) });
    const capture = await service.capturerPortee({ owner_id: null }), portee = capture.portee, lecture = await service.lireSession({ portee, sessionId: session.id });
    eq(capture.issue, 'ok', 'L7 vrai dépôt : portée capturée'); eq(lecture.issue, 'ok', 'L7 vrai dépôt : lecture de séance capturée');
    const panneau = creerPanneauMinuteurs({ sessionId: session.id, ctx: {}, service, portee, maintenant: () => temps });
    const commandes = commandesMinuteurEtape({ service, portee, lecture: lecture.lecture, version: f.version, recipe: f.recipe, step: f.version.steps[0], ordinal: 0, recipeTitle: 'Pain', onConserve: () => panneau.actualiser() });
    const scene = document.createElement('div'); scene.append(panneau, commandes); document.body.append(scene);
    const muter = db.mutate.bind(db);
    db.mutate = args => { if (quota && args.conditions?.timer_launches?.length) return Promise.reject(new DOMException('quota injecté', 'QuotaExceededError')); return muter(args); };
    try {
      bouton(commandes, 'Démarrer un suivi indicatif').click();
      await attendre(() => commandes.textContent.includes('stockage est insuffisant'));
      eq((await repo.all('timer_launches')).length, 0, 'L7 vrai dépôt : quota ne laisse aucune minuterie'); eq((await repo.get('cook_sessions', session.id)).progress, session.progress, 'L7 vrai dépôt : quota ne laisse pas adoption seule');
      const reserve = id; temps += 60000; quota = false;
      bouton(commandes, 'Réessayer l’enregistrement').click(); await attendre(async () => (await repo.all('timer_launches')).length === 1); await panneau.actualiser();
      const row = (await repo.all('timer_launches'))[0];
      eq(id, reserve, 'L7 vrai dépôt : réessai ne réserve aucune nouvelle identité'); eq(row.mirror.started_at, at, 'L7 vrai dépôt : réessai garde le départ du premier geste'); eq(row.mirror.deadline_at, '2026-10-30T10:01:30.000Z', 'L7 vrai dépôt : échéance conservée après quota');
      ok(panneau.textContent.includes('30 s'), 'L7 vrai dépôt : temps restant depuis échéance et non réessai');
      panneau.dispose(); panneau.remove();
      const repris = creerPanneauMinuteurs({ sessionId: session.id, ctx: {}, service, portee, maintenant: () => temps }); scene.prepend(repris);
      try { await repris.actualiser(); eq(repris.querySelector('[data-role=minuteur-ligne]')?.dataset.id, row.id, 'L7 vrai dépôt : remontage retrouve même suivi'); eq((await repo.all('timer_launches')).length, 1, 'L7 vrai dépôt : reprise sans nouvelle ligne'); }
      finally { repris.dispose(); repris.remove(); }
      const lu = await service.lireSession({ portee, sessionId: session.id });
      const siri = commandesMinuteurEtape({ service, portee, lecture: lu.lecture, version: f.version, recipe: f.recipe, step: f.version.steps[0], ordinal: 0, recipeTitle: 'Pain' }); scene.append(siri);
      try { bouton(siri, 'J’ai demandé à Siri').click(); await attendre(async () => (await repo.all('timer_launches')).length === 2); const demande = (await repo.all('timer_launches')).find(r => r.channel === 'siri'); eq(demande.mirror, null, 'L7 vrai dépôt : déclaration Siri sans miroir automatique'); eq(demande.handoff_state, 'siri', 'L7 vrai dépôt : déclaration humaine conservée'); }
      finally { siri.dispose(); siri.remove(); }
      const lectureRaccourci = await service.lireSession({ portee, sessionId: session.id });
      const raccourci = commandesMinuteurEtape({ service, portee, lecture: lectureRaccourci.lecture, version: f.version, recipe: f.recipe, step: f.version.steps[0], ordinal: 0, recipeTitle: 'Pain', deps: { apple: true } }); scene.append(raccourci);
      let shortcutId;
      try {
        bouton(raccourci, 'Préparer Raccourcis').click(); await attendre(() => !!raccourci.querySelector('a[href]'));
        const demande = (await repo.all('timer_launches')).find(r => r.channel === 'shortcut'); shortcutId = demande.id;
        eq(demande.mirror, null, 'L7 vrai dépôt : préparation Raccourcis sans suivi implicite'); eq(demande.handoff_state, 'requested', 'L7 vrai dépôt : préparation ne prétend pas ouvrir le système');
        const lien = raccourci.querySelector('a[href]'); lien.addEventListener('click', event => event.preventDefault()); lien.click();
        await attendre(async () => (await repo.get('timer_launches', shortcutId)).handoff_state === 'opening');
        eq((await repo.get('timer_launches', shortcutId)).mirror, null, 'L7 vrai dépôt : clic natif enregistré sans départ de miroir');
      } finally { raccourci.dispose(); raccourci.remove(); }
      const nouveauPanneau = creerPanneauMinuteurs({ sessionId: session.id, service, portee, maintenant: () => temps }); scene.append(nouveauPanneau);
      try {
        await nouveauPanneau.actualiser(); temps += 5000;
        const ligne = [...nouveauPanneau.querySelectorAll('[data-role=minuteur-ligne]')].find(n => n.dataset.id === shortcutId);
        bouton(ligne, 'Démarrer le suivi indicatif maintenant').click(); await attendre(async () => !!(await repo.get('timer_launches', shortcutId)).mirror);
        eq((await repo.get('timer_launches', shortcutId)).mirror.started_at, '2026-10-30T10:01:05.000Z', 'L7 vrai dépôt : ancre au geste distinct après Raccourcis');
        eq((await repo.all('timer_launches')).length, 3, 'L7 vrai dépôt : première ancre conserve identité de la demande moderne');
      } finally { nouveauPanneau.dispose(); nouveauPanneau.remove(); }
    } finally { db.mutate = muter; panneau.dispose(); commandes.dispose(); scene.remove(); }
  });
}
