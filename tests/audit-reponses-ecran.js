import { withRepo } from './sync-fixture.js';
import { setUiLocale, getUiLocale } from '../src/core/i18n.js';
import { renderThermomixRoute, texteErreurThermomix } from '../src/ui/thermomix.js';
import { renderReperesRoute, texteErreurReperes } from '../src/ui/reperes.js';
const copier = x => structuredClone(x);
const octetsTexte = new TextEncoder().encode('<script>window.reponseExecutee=true</script>\nRéponse refusée complète.');
async function preparer(repo, kind, capacite = false) {
  const recipe = { id: 'r-reponse', original_title: 'Tomates', original_language: 'fr', availability: 'available', current_version_id: 'v-reponse' };
  const version = { id: 'v-reponse', recipe_id: recipe.id, kind: 'extraction', status: 'proposed', servings: 2, ingredients: [{ id: 'i1', name_text: 'tomates', source_text: '300 g de tomates', quantity: { value: 300, raw: '300' }, unit_id: 'g' }], steps: [{ id: 's1', text: 'Cuire les tomates 20 minutes.' }], constraints: {} };
  if (capacite) version.ingredients = [{ id: 'a', name_text: 'bouillon', source_text: '1,5 l de bouillon', quantity: { value: 1.5 }, unit_id: 'l' }, { id: 'b', name_text: 'lait', source_text: '1 l de lait', quantity: { value: 1 }, unit_id: 'l' }];
  await repo.saveBatch({ recipes: [recipe], recipe_versions: [version] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
  const P = await import(`../src/domain/${kind}-parcours.js`);
  const row = kind === 'thermomix' ? await P.ouvrirThermomix({ recipeId: recipe.id, versionId: version.id, selection: ['s1'] }, { repo }) : await P.ouvrirReperes({ recipeId: recipe.id, versionId: version.id }, { repo });
  await repo.db.mutate({ origin: 'device', puts: { imports: [{ ...await repo.get('imports', row.id), status: 'echec' }] } });
  return { recipe, version, row: await repo.get('imports', row.id) };
}
// Contrôleur documentaire simulé ici ; le dépôt et les deux routes sont réels.
// Les octets, CAS et transactions réels sont éprouvés dans audit-reponses-refusees/parcours.
function controleSimule({ etat = 'disponible', octets = octetsTexte, motif = 'capacite', retry, lire } = {}) {
  let courant = etat; const appels = { lectures: 0, retries: 0, abandons: 0 }, attendu = {};
  const dto = () => ({ issue: 'ok', etat: courant, motif, reference: { reference: 'ref', motif }, octets: new Uint8Array(octets), attendu });
  return { appels, presenceEnAttente: () => courant === 'en_attente', reponseEnAttente: async () => courant === 'en_attente' ? dto() : { issue: 'ok', etat: 'aucune' },
    lire: async args => { appels.lectures++; return lire ? lire(args, dto()) : dto(); },
    reessayerConservation: async () => { appels.retries++; const r = retry ? await retry() : { issue: 'a_conserver', raison: 'quota', reessayable: true }; if (r.issue === 'conserve') courant = 'disponible'; return r; },
    abandonner: async ({ attendu: token }) => { if (token !== attendu) throw Error('token'); appels.abandons++; courant = 'aucune'; return { issue: 'abandonne' }; } };
}
async function monter(repo, kind, fixture, controle, extra = {}) {
  const fichiers = [], deps = { repo, reponsesRefusees: controle, sessionAssistant: async () => null, enLigne: () => false, navigate: () => {}, remplacerAdresse: () => {}, toast: () => {}, confirmer: async () => true,
    telechargerReponse: (blob, nom) => fichiers.push({ blob, nom }), ...extra };
  const render = kind === 'thermomix' ? renderThermomixRoute : renderReperesRoute;
  const root = await render({ id: fixture.recipe.id }, { import: fixture.row.id }, {}, deps); document.body.append(root); await root.attendreEcritures?.(); return { root, fichiers, fermer: () => { root.dispose?.(); root.remove(); } };
}
export async function runAuditReponsesEcranTests({ eq, ok }) {
  const langue = getUiLocale(); setUiLocale('fr');
  const run = async (nom, f) => { try { await withRepo(f); } catch (e) { ok(false, `Réponses écran — ${nom} : ${e.stack || e.message}`); } };
  try {
    for (const kind of ['thermomix', 'reperes']) {
      await run(kind + ' reçu documentaire', async repo => {
        const f = await preparer(repo, kind), c = controleSimule(), m = await monter(repo, kind, f, c);
        try {
          const panneau = m.root.querySelector('[data-role=reponse-refusee]'), details = panneau?.querySelector('details');
          ok(!!panneau, `${kind} : reçu documentaire visible`); eq(details?.open, false, `${kind} : texte reçu replié par défaut`);
          eq(panneau?.querySelector('pre')?.textContent, new TextDecoder().decode(octetsTexte), `${kind} : texte brut complet et inerte`);
          eq(panneau?.querySelectorAll('script,a').length, 0, `${kind} : aucun script ni lien issu du brut`);
          ok(panneau?.textContent.includes('La quantité proposée dépasse la capacité autorisée.'), `${kind} : motif exact près du reçu`);
          ok(panneau?.textContent.includes('sur cet appareil'), `${kind} : portée locale explicite`);
          eq(panneau?.querySelector('[data-role=garder-reponse]') ?? null, null, `${kind} : aucune adoption documentaire`);
          panneau?.querySelector('[data-role=recuperer-reponse]')?.click(); await m.root.attendreEcritures?.();
          eq(m.fichiers.length, 1, `${kind} : récupération volontaire sans assistant`);
          eq(m.fichiers[0] ? [...new Uint8Array(await m.fichiers[0].blob.arrayBuffer())] : null, [...octetsTexte], `${kind} : récupération conserve tous les octets`);
        } finally { m.fermer(); }
      });
      await run(kind + ' attente de conservation', async repo => {
        const f = await preparer(repo, kind); await repo.db.mutate({ origin: 'device', puts: { imports: [{ ...f.row, status: 'en_cours' }] } });
        let peutConserver = false;
        const c = controleSimule({ etat: 'en_attente', retry: async () => peutConserver ? { issue: 'conserve', journal: f.row } : { issue: 'a_conserver', raison: 'quota_stockage', reessayable: true } }), m = await monter(repo, kind, f, c);
        try {
          ok(m.root.textContent.includes('encore en mémoire'), `${kind} : mémoire distincte du reçu durable`);
          eq(m.root.etatEditeur?.().sale, true, `${kind} : attente protège la sortie`);
          eq(m.root.querySelector(`[data-role=${kind === 'thermomix' ? 'ignorer-tm7' : 'ignorer-reperes'}]`)?.disabled, true, `${kind} : abandon du brouillon indisponible pendant attente`);
          eq(m.root.querySelector('[data-role=abandonner-reponse]') ?? null, null, `${kind} : aucun faux abandon de mémoire`);
          const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); eq(event.defaultPrevented, true, `${kind} : fermeture avertie tant que non durable`);
          m.root.querySelector('[data-role=reessayer-reponse]')?.click(); await m.root.attendreEcritures?.();
          ok(m.root.textContent.includes('L’enregistrement n’a pas réussi.'), `${kind} : nouvel échec de conservation expliqué`);
          peutConserver = true; m.root.querySelector('[data-role=reessayer-reponse]')?.click(); await m.root.attendreEcritures?.();
          eq(c.appels.retries, 2, `${kind} : réessais de conservation seuls`); eq(m.root.etatEditeur?.().sale, false, `${kind} : sortie libérée après conservation`);
          eq(m.root.textContent.includes('L’enregistrement n’a pas réussi.'), false, `${kind} : conservation réussie retire l’ancien message d’échec`);
        } finally { m.fermer(); }
      });
      await run(kind + ' reçu absent', async repo => {
        const f = await preparer(repo, kind), m = await monter(repo, kind, f, controleSimule({ etat: 'absente' }));
        try { ok(m.root.textContent.includes('Cette réponse est absente de cet appareil.'), `${kind} : absence locale explicite`); eq(m.root.querySelector('[data-role=recuperer-reponse]') ?? null, null, `${kind} : absence ne promet pas de fichier`); } finally { m.fermer(); }
      });
      await run(kind + ' octets non UTF8', async repo => {
        const f = await preparer(repo, kind), m = await monter(repo, kind, f, controleSimule({ octets: new Uint8Array([255, 254, 0, 65]) }));
        try { eq(m.root.querySelector('[data-role=reponse-refusee] pre') ?? null, null, `${kind} : octets invalides sans texte fabriqué`); m.root.querySelector('[data-role=recuperer-reponse]')?.click(); await m.root.attendreEcritures?.(); eq(m.fichiers[0]?.nom.endsWith('.bin'), true, `${kind} : récupération binaire`); eq(m.fichiers[0] ? [...new Uint8Array(await m.fichiers[0].blob.arrayBuffer())] : null, [255,254,0,65], `${kind} : binaire intact`); } finally { m.fermer(); }
      });
      await run(kind + ' source absente', async repo => {
        const f = await preparer(repo, kind); await repo.db.mutate({ origin: 'device', deletes: { recipe_versions: [f.version.id] } });
        const m = await monter(repo, kind, f, controleSimule()); try { ok(!!m.root.querySelector('[data-role=reponse-refusee] pre'), `${kind} : reçu accessible malgré source absente`); eq(m.root.querySelector('[data-role=garder-tm7],[data-role=garder-reperes]') ?? null, null, `${kind} : source absente sans adoption`); } finally { m.fermer(); }
        const attente = await monter(repo, kind, f, controleSimule({ etat: 'en_attente' }));
        try { eq(attente.root.etatEditeur?.().sale, true, `${kind} : source absente garde aussi la mémoire protégée`); eq(attente.root.querySelector('[data-role=ignorer-tm7]:not(:disabled),[data-role=ignorer-reperes]:not(:disabled)') ?? null, null, `${kind} : source absente ne permet pas d’abandonner le journal de la réponse en mémoire`); } finally { attente.fermer(); }
      });
      await run(kind + ' autre recette', async repo => {
        const f = await preparer(repo, kind); await repo.db.mutate({ origin: 'device', puts: { imports: [{ ...f.row, recipe_id: 'autre-recette' }] } });
        const c = controleSimule(), m = await monter(repo, kind, f, c); try { eq(c.appels.lectures, 0, `${kind} : identifiant étranger non lu`); eq(m.root.querySelector('[data-role=reponse-refusee] pre') ?? null, null, `${kind} : identifiant étranger ne révèle aucun octet`); } finally { m.fermer(); }
      });
      await run(kind + ' abandon explicite', async repo => {
        const f = await preparer(repo, kind), c = controleSimule(); let accepter = false;
        const m = await monter(repo, kind, f, c, { confirmer: async () => accepter });
        try { m.root.querySelector('[data-role=abandonner-reponse]')?.click(); await m.root.attendreEcritures?.(); eq(c.appels.abandons, 0, `${kind} : annulation garde le reçu`); accepter = true; m.root.querySelector('[data-role=abandonner-reponse]')?.click(); await m.root.attendreEcritures?.(); eq(c.appels.abandons, 1, `${kind} : confirmation transmet le jeton exact`); eq(m.root.querySelector('[data-role=reponse-refusee]')?.hidden, true, `${kind} : abandon réussi retire la copie documentaire`); } finally { m.fermer(); }
      });

      await run(kind + ' navigation refusée puis autorisée', async repo => {
        const f = await preparer(repo, kind), router = await import('../src/core/router.js');
        let accepterEnregistrement = false, demandes = 0, routes = 0, m;
        const c = controleSimule({ etat: 'en_attente', retry: async () => accepterEnregistrement ? { issue: 'conserve', journal: f.row } : { issue: 'a_conserver', raison: 'quota_stockage', reessayable: true } });
        const ancienHash = location.hash, ancienEtat = history.state, origine = '#/recu-' + kind;
        history.replaceState({}, '', origine);
        const stop = router.start(() => { routes++; if (routes > 1) m.root.remove(); });
        const attendre = pred => new Promise((resolve, reject) => { const debut = performance.now(); const timer = setInterval(() => { if (pred()) { clearInterval(timer); resolve(); } else if (performance.now() - debut > 2000) { clearInterval(timer); reject(Error('navigation non terminée')); } }, 10); });
        try {
          m = await monter(repo, kind, f, c, { demanderSortieReponse: async () => { demandes++; return false; } });
          location.hash = '#/suite-' + kind;
          await attendre(() => demandes === 1 && location.hash === origine);
          eq(routes, 1, `${kind} : Rester refuse la vraie navigation`);
          eq(m.root.etatEditeur().sale, true, `${kind} : Rester garde la protection et le reçu en mémoire`);
          eq(m.root.querySelector('[data-role=reponse-refusee] pre')?.textContent, new TextDecoder().decode(octetsTexte), `${kind} : Rester garde les octets visibles`);
          ok(!!m.root.querySelector('[data-role=reessayer-reponse]'), `${kind} : Rester permet encore le réessai`);
          accepterEnregistrement = true; location.hash = '#/suite-' + kind;
          await attendre(() => !m.root.isConnected);
          eq(routes, 2, `${kind} : conservation réussie autorise la navigation`);
          eq(m.root.querySelector('[data-role=reponse-refusee]')?.hidden, true, `${kind} : vrai démontage libère le panneau et ses octets`);
          const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e);
          eq(e.defaultPrevented, false, `${kind} : vrai démontage retire la garde de fermeture`);
        } finally { stop(); m?.fermer(); history.replaceState(ancienEtat, '', ancienHash || location.pathname); }
      });
      await run(kind + ' portée changée pendant lecture', async repo => {
        const f = await preparer(repo, kind), c = controleSimule({ lire: async (_args, dto) => { await repo.db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'autre-compte' }] } }); return dto; } });
        const m = await monter(repo, kind, f, c); try { eq(m.root.querySelector('[data-role=reponse-refusee] pre') ?? null, null, `${kind} : ancienne réponse non affichée après changement de compte pendant lecture`); } finally { m.fermer(); }
      });
      await run(kind + ' réponse réelle et transaction refusée', async (repo, db) => {
        await db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'u1' }, { key: 'editor_library_epoch:v1', value: 'epoque-ecran-refus' }] } });
        const f = await preparer(repo, kind, kind === 'thermomix');
        const { creerConservationReponseRefusee } = await import('../src/domain/reponses-refusees.js'), c = creerConservationReponseRefusee({ repo });
        const brut = kind === 'thermomix' ? new TextEncoder().encode(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ type: 'proposition', blocs: [{ source_step_id: 's1', raison: 'Mélanger dans le bol.', actions: [{ type: 'preparation', operation: 'ajouter', contenant: 'bol', ingredients: ['i1','i2'] }, { type: 'reglage', mode: 'manuel', secondes: 60, temperature: 100, vitesse: 1, sens: 'normal', accessoire: 'couteau', ingredients: ['i1','i2'] }] }] }) }], stop_reason: 'end_turn', model: 'test-ui-refus' })) : new Uint8Array([123,34,120,34,58,34,255,34,125]);
        const muter = db.mutate.bind(db), cle = 'assistant_rejected:v1:' + f.row.id; let quota = true, appels = 0, transactionsRefusees = 0;
        // Faute QuotaExceededError injectée DANS la transaction IndexedDB, pas saturation du disque.
        db.mutate = args => muter({ ...args, conditions: { ...args.conditions, ...(args.conditions?.sync_state ? { sync_state: args.conditions.sync_state.map(cond => cond.key !== cle ? cond : { ...cond, fusion: (...lectures) => { const r = cond.fusion(...lectures); if (quota && r != null) { transactionsRefusees++; throw new DOMException('quota de fixture', 'QuotaExceededError'); } return r; } }) } : {}) } });
        const session = { access_token: 'session-ui-synthetique', user: { id: 'u1' } };
        let m, cause = null, correctionErreur = null;
        const P = await import(`../src/domain/${kind}-parcours.js`), proposerNom = kind === 'thermomix' ? 'proposerThermomix' : 'proposerReperes', modifierNom = kind === 'thermomix' ? 'modifierThermomix' : 'modifierBrouillonReperes';
        const parcours = { ...P, [modifierNom]: async (...args) => { try { return await P[modifierNom](...args); } catch (e) { correctionErreur = e.code || e.message; throw e; } }, [proposerNom]: async (...args) => { try { return await P[proposerNom](...args); } catch (e) { cause = e.code || e.message; throw e; } } };
        try {
          m = await monter(repo, kind, f, c, { parcours, sessionAssistant: async () => session, sessionCourante: () => session, enLigne: () => true, config: { url: 'https://assistant.example', anonKey: 'publique-factice' }, fetch: async () => { appels++; return new Response(brut); } });
          m.root.querySelector(`[data-role=${kind === 'thermomix' ? 'proposer-tm7' : 'proposer-reperes'}]`).click(); await m.root.attendreEcritures();
          eq(cause, 'conservation_en_attente', `${kind} réel : seule la conservation refusée explique l’échec d’écran`);
          eq(appels, 1, `${kind} réel : un seul appel volontaire`);
          eq(transactionsRefusees, 1, `${kind} réel : garde de conservation réellement atteinte dans la transaction`);
          eq((await repo.get('imports', f.row.id)).status, 'en_cours', `${kind} réel : quota ne prétend pas terminer le journal`);
          eq((await repo.get('imports', f.row.id)).reponse_refusee ?? null, null, `${kind} réel : référence non écrite à moitié`);
          eq(await db.get('sync_state', cle) ?? null, null, `${kind} réel : reçu non écrit à moitié`);
          eq(m.root.etatEditeur().sale, true, `${kind} réel : réponse payée en mémoire protège la sortie`);
          m.root.querySelector('[data-role=recuperer-reponse]').click(); await m.root.attendreEcritures();
          eq([...new Uint8Array(await m.fichiers[0].blob.arrayBuffer())], [...brut], `${kind} réel : reçu intégral récupérable malgré quota`);
          quota = false; m.root.querySelector('[data-role=reessayer-reponse]').click(); await m.root.attendreEcritures();
          eq(appels, 1, `${kind} réel : réessai de conservation sans second POST`);
          eq((await repo.get('imports', f.row.id)).erreur?.raison, kind === 'thermomix' ? 'capacite' : 'reponse_illisible', `${kind} réel : motif refusé exact conservé`);
          eq(m.root.etatEditeur().sale, false, `${kind} réel : succès durable libère la sortie`);
          eq((await c.lire({ importId: f.row.id })).etat, 'disponible', `${kind} réel : reçu durable relisible`);
          m.fermer();
          await db.mutate({ origin: 'device', puts: { recipe_versions: [{ ...f.version, steps: [] }] } });
          m = await monter(repo, kind, f, creerConservationReponseRefusee({ repo }));
          ok(!m.root.querySelector('[data-role=reponse-refusee]').hidden, `${kind} réel : réouverture documentaire possible avec source devenue invalide`);
          eq(m.root.querySelector('[data-role=garder-tm7]:not([hidden]):not(:disabled),[data-role=garder-reperes]:not([hidden]):not(:disabled)') ?? null, null, `${kind} réel : réouverture périmée ne permet aucune adoption`);
          m.root.querySelector('[data-role=recuperer-reponse]').click(); await m.root.attendreEcritures();
          eq([...new Uint8Array(await m.fichiers[0].blob.arrayBuffer())], [...brut], `${kind} réel : octets récupérés après réouverture et source invalide`);
          eq(appels, 1, `${kind} réel : réouverture sans appel assistant`);
          m.fermer(); await db.mutate({ origin: 'device', puts: { recipe_versions: [f.version] } });
          m = await monter(repo, kind, f, creerConservationReponseRefusee({ repo }));
          m.root.querySelector('[data-role=abandonner-reponse]').click(); await m.root.attendreEcritures();
          eq((await repo.get('imports', f.row.id)).reponse_refusee, null, `${kind} réel : abandon confirmé retire la référence`);
          eq(await db.get('sync_state', cle) ?? null, null, `${kind} réel : abandon confirmé retire le reçu local`);
          // Le brouillon reste utilisable après le CAS d'abandon : son attente doit suivre la transaction exacte.
          const champ = m.root.querySelector(kind === 'thermomix' ? '[name=demande]' : '[name=description_fr]');
          champ.value = 'Correction après récupération'; champ.dispatchEvent(new Event('input', { bubbles: true })); await m.root.attendreEcritures();
          eq(correctionErreur, null, `${kind} réel : correction ne rencontre aucune ancienne garde`);
          eq((await repo.get('imports', f.row.id))[kind === 'thermomix' ? 'contexte' : 'saisie'][kind === 'thermomix' ? 'demande' : 'description_fr'], 'Correction après récupération', `${kind} réel : correction possible après abandon, sans attente CAS périmée`);
          eq(appels, 1, `${kind} réel : récupération et abandon sans appel caché`);
        } finally { db.mutate = muter; m?.fermer(); }
      });
    }
    eq(texteErreurThermomix({ code: 'eau_vapeur' }), 'La quantité d’eau proposée pour la vapeur n’est pas autorisée.', 'Motif vapeur expliqué exactement');
    eq(texteErreurReperes({ code: 'total_incompatible' }), 'Les durées proposées ne sont pas cohérentes entre elles.', 'Motif des durées expliqué exactement');
    const { texteMotifReponseRefusee } = await import('../src/ui/reponse-refusee.js');
    eq(texteMotifReponseRefusee('interrompu'), 'La réponse reçue est incomplète.', 'Reçu interrompu décrit la sortie incomplète');
    eq(texteMotifReponseRefusee('refus'), 'L’assistant n’a pas proposé de résultat pour cette demande. Aucun nouvel appel n’est lancé.', 'Refus fournisseur distingué des réglages invalides');
    ok(!texteErreurReperes({ code: 'reseau' }).includes('Vérifie'), 'Erreur réseau ne met pas en cause les champs');
  } finally { setUiLocale(langue); }
}
