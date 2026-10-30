import { withRepo } from './sync-fixture.js';
export async function runL5IndexVolTests({ eq, ok }) {
  const M = await import('../src/ui/index-vol.js'), F = await import('../src/domain/sources-format.js');
  const H = await import('../src/core/hash.js'), S = await import('../src/domain/revisions-source.js');
  const run = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, `L5 vol ${nom} : ${e.stack || e}`); } };
  async function fixture(repo, db) {
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; canvas.getContext('2d').fillRect(0, 0, 120, 80);
    const blob = await new Promise(resolve => canvas.toBlob(resolve)), sha256 = await H.sha256Hex(blob);
    const edition = { id: 'ed', book_id: 'bk', language: 'fr' }, session = { id: 'ss', edition_id: 'ed', status: 'open', page_ids: ['p'], document_ids: ['d'], recipe_ids: [] };
    const page = { id: 'p', edition_id: 'ed', document_id: 'd', sha256, position: 1, printed_page: 10, rotation: 0 };
    const sourceDocument = { id: 'd', scan_session_id: 'ss', edition_id: 'ed', sha256, source_type: 'photo' };
    await db.mutate({ origin: 'remote', puts: { books: [{ id: 'bk', title: 'Livre' }], book_editions: [edition], scan_sessions: [session], source_pages: [page], source_documents: [sourceDocument] } });
    await db.mutate({ origin: 'device', puts: { files: [{ sha256, blob }], sync_state: [{ key: 'user_id', value: 'u1' }] } });
    const ctx = { proprietaireDonnees: 'u1', sync: { user: { id: 'u1' }, auth: { jeton: async () => ({ access_token: 'fake', user: { id: 'u1' } }) } }, pagesById: new Map([['p', page]]), editionsById: new Map([['ed', edition]]) };
    const serviceSources = S.creerServiceRevisionsSource({ repo, getGeneration: () => 0 });
    const captured = await serviceSources.capturerSources({ session, pages: [page], documents: [sourceDocument], contexte: { owner_id: 'u1', edition } });
    return { repo, ctx, edition, session, page, serviceSources, captureSources: captured.capture, enLigne: () => true, fetch: async () => { throw Error('aucun réseau réel'); } };
  }
  const reponse = titre => ({ page: { sorte_page: 'index', page_imprimee: 10, suite_rubrique: false, incertain: [], ecartees: { adresse: 0, longueur: 0, forme: 0 }, entrees: [{ titre, renvois: '12', rubrique: null, sorte: 'recette', incertain: false }] }, modele: 'claude-sonnet-5-5', texteBrut: '{}' });
  await run('demi-pages conservées puis reprise', async (repo, db) => {
    const f = await fixture(repo, db), appels = [];
    const service = M.creerLectureIndexCapturee({ ...f, lire: async (provider, image, options) => {
      appels.push(options.moitie);
      if (!options.moitie) throw Object.assign(Error('coupe'), { raison: 'coupe' });
      if (options.moitie === 'droite') {
        const saved = (await repo.all('imports')).find(r => r.index_call?.kind === 'left_half');
        eq(saved?.resultat?.pages[0]?.entrees[0]?.titre, 'Gauche', 'L5 vrai vol : gauche durable avant démarrage droite');
        throw Object.assign(Error('reseau'), { raison: 'reseau' });
      }
      return reponse('Gauche');
    } });
    const first = await service.lire({ series_id: 'series' });
    eq({appels:[...appels],raison:first.raison}, {appels:[null, 'gauche', 'droite'],raison:'reseau'}, 'L5 vrai vol : trois appels distincts au maximum');
    const saved = await repo.all('imports');
    eq(saved.length, 3, 'L5 vrai vol : journal distinct dès le départ pour chaque zone');
    ok(saved.every(r => r.source_capture && r.index_call), 'L5 vrai vol : chaque journal possède la capture exacte dès son ouverture');
    eq(saved.find(r => r.index_call.kind === 'left_half').status, 'a_verifier', 'L5 vrai vol : moitié réussie reste reprenable après réseau');
    const retry = M.creerLectureIndexCapturee({ ...f, lire: async (p, i, options) => { appels.push(options.moitie); return reponse('Droite'); } });
    const second = await retry.lire({ series_id: 'series', appels: saved });
    eq([first.issue, second.issue, appels], ['interrompu', 'termine', [null, 'gauche', 'droite', 'droite']], 'L5 vrai vol : reprise ne repaie que la moitié manquante');
    eq((await repo.all('imports')).length, 3, 'L5 vrai vol : reprise CAS du seul échec, aucune substitution du journal gauche');
  });
  await run('quota conserve réponse en mémoire sans prochain appel', async (repo, db) => {
    const f = await fixture(repo, db); let quota = true, calls = 0;
    const port = { ...repo, get db() { return repo.db; }, transitionner: async (store, id, opts) => {
      if (quota && (opts.patch?.status === 'a_verifier'||typeof opts.patch==='function'&&opts.attendus?.[0]==='en_cours')) throw new DOMException('plein', 'QuotaExceededError');
      return repo.transitionner(store, id, opts);
    } };
    const service = M.creerLectureIndexCapturee({ ...f, repo: port, lire: async () => { calls++; return reponse('Réponse payée'); } });
    const result = await service.lire({ series_id: 'quota' });
    eq([result.issue, calls,result.raison], ['conservation_echec', 1,'quota'], 'L5 vrai vol : aucun succès annoncé avant conservation');
    quota = false; const retry = await service.reessayerConservation();
    eq([retry.issue, calls, (await repo.all('imports'))[0].resultat.pages[0].entrees[0].titre], ['conserve', 1, 'Réponse payée'], 'L5 vrai vol : conservation répétée sans nouvel appel payé');
  });
  await run('capture périmée avant appel', async (repo, db) => {
    const f = await fixture(repo, db); let calls = 0;
    const service = M.creerLectureIndexCapturee({ ...f, lire: async () => { calls++; return reponse('Jamais'); } });
    await db.mutate({ origin: 'remote', puts: { source_pages: [{ ...f.page, rotation: 90 }] } });
    const result = await service.lire({ series_id: 'ancienne' });
    eq([result.issue, calls, (await repo.all('imports')).length], ['interrompu', 0, 0], 'L5 vrai vol : rotation concurrente refuse avant le moindre journal/appel');
  });
  await run('réponse arrivée après fermeture du panneau',async(repo,db)=>{
    const f=await fixture(repo,db);let active=true,arrivee,terminer;const attente=new Promise(r=>{terminer=r;}),depart=new Promise(r=>{arrivee=r;});
    const service=M.creerLectureIndexCapturee({...f,estCourante:()=>active,lire:async()=>{arrivee();await attente;return reponse('Déjà payée');}});
    const travail=service.lire({series_id:'fermeture'});await depart;active=false;terminer();await travail;
    eq((await repo.all('imports'))[0]?.resultat?.pages[0].entrees[0].titre,'Déjà payée','L5 : fin de vue arrête les prochains appels mais conserve la réponse déjà arrivée dans sa bibliothèque');
  });
  await run('grande réponse conservée dans le vrai vol', async (repo, db) => {
    const f=await fixture(repo,db), reply=reponse('base');
    reply.page.entrees=Array.from({length:600},(_,i)=>({titre:'菜'.repeat(190)+i,renvois:'12',rubrique:'界'.repeat(120),sorte:'recette',incertain:false}));
    const service=M.creerLectureIndexCapturee({...f,lire:async()=>reply});
    const result=await service.lire({series_id:'grande'}), rows=await repo.all('imports');
    eq([result.issue,result.issue==='termine'?null:await service.reessayerConservation()],['termine',null],'L5 vrai vol : réponse valide >512Kio durable avant succès');
    const manifest=rows.find(r=>r.index_storage?.role==='page_manifest');
    ok(!!manifest&&rows.some(r=>r.index_storage?.role==='result_fragment'),'L5 vrai vol : manifeste et fragments présents ensemble');
    const K=await import('../src/domain/index-stockage.js');
    eq((await K.reconstruireResultatIndex({journal:manifest,imports:rows})).pages[0].entrees.length,600,'L5 vrai vol : les600 entrées longues retrouvées sans nouvel appel');
    ok((await repo.all('outbox')).some(r=>r.op==='source_transfer'),'L5 vrai vol : transfert fermé en file, aucun fragment put orphelin');
  });
  await run('panneau réel', async (repo, db) => {
    const f = await fixture(repo, db), P = await import('../src/ui/index-livre.js'); let calls = 0;
    Object.assign(f.ctx, { imports: [], recipes: [], source_pages: [f.page], source_documents: await repo.all('source_documents'), booksById: new Map([['bk',{id:'bk',title:'Livre'}]]) });
    const panel = P.panneauIndex(f.session, f.ctx, () => ['p'], { repo, enLigne: () => true, toast: () => {}, lirePage: async () => { calls++; return reponse('Pain'); } });
    document.body.append(panel);
    const attendre = async predicate => { for (let i=0;i<300;i++){if(await predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('attente panneau expirée'); };
    try {
      await attendre(()=>panel.querySelector('[data-role=lire]'));
      ok(panel.querySelector('[data-role=lire]').textContent.includes('3 appels au plus'), 'L5 panneau : coût maximum annoncé avant le premier appel');
      panel.querySelector('[data-role=lire]').click();
      await attendre(async()=>!panel.etatPanneau().occupe&&(await repo.all('imports')).length>0);
      eq([calls,(await repo.all('recipes')).length,(await repo.all('imports'))[0]?.index_call?.kind], [1,1,'full'], 'L5 panneau : vrai bouton lit puis applique via le nouveau contrat');
      eq((await repo.all('outbox')).filter(r=>r.op==='index_apply').length,1,'L5 panneau : références appliquées par une commande atomique');
      const before=panel.textContent;
      panel.actualiserSources({session:{...f.session,source_state:{format:1,revision:'other',active_page_ids:['p']}},pages:[f.page],selectedPageIds:['p']});
      await attendre(()=>panel.querySelector('[data-role=revoir-sources]'));
      eq(calls,1,'L5 panneau : changement des sources ne déclenche aucune nouvelle lecture');
      ok(panel.textContent.includes('1 recettes dans le livre')&&before.includes('1 recettes dans le livre'),'L5 panneau : résultat conservé pendant la comparaison de sources');
    } finally { panel.dispose?.(); panel.remove(); }
  });
}
