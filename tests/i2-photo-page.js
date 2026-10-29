// I2 : photos imprimées, données hostiles et recadrage. Aucune requête réelle.
export async function runI2PhotoPageTests({ eq, ok }) {
  const run = async (nom, test) => { try { await test(); } catch (e) { ok(false, `I2 photo page — ${nom} : ${e.message}`); } };
  const H = (c) => c.repeat(64);
  const rectangle = { x: 0.25, y: 0.25, largeur: 0.5, hauteur: 0.5 };
  await run('zones indépendantes et bornées', async () => {
    const P = await import('../src/domain/photo-page.js');
    const zone = { photo: 2, rectangle, incertain: false };
    eq(P.validerZonesPhoto([zone], 2), [zone], 'P01 : zone valide conservée');
    for (const mauvaise of [null, {}, { ...zone, photo: 3 }, { ...zone, photo: '2' }, { ...zone, incertain: true },
      { ...zone, rectangle: { ...rectangle, x: -0.1 } }, { ...zone, rectangle: { ...rectangle, largeur: 2 } },
      { ...zone, rectangle: { ...rectangle, hauteur: 0 } }, { ...zone, rectangle: { ...rectangle, y: NaN } }]) {
      eq(P.validerZonesPhoto([mauvaise, zone], 2), [zone], 'P02 : mauvaise zone écartée seule');
    }
    eq(P.validerZonesPhoto('image', 2), [], 'P02 : liste mal typée ignorée');
    eq(P.validerZonesPhoto(Array(10).fill(zone), 2).length, 1, 'P01 : zones identiques dédoublonnées');
    eq(P.validerZonesPhoto([zone, { ...zone, photo: 1 }, { ...zone, rectangle: { ...rectangle, x: 0 } }, { ...zone, rectangle: { ...rectangle, y: 0 } }], 2).length, 3, 'P01 : trois propositions au plus');
    const sources = [{ page_id: 'p1', sha256: H('a'), rotation: 90, largeur: 600, hauteur: 800 }, { page_id: 'p2', sha256: H('b'), rotation: 0, largeur: 800, hauteur: 600 }];
    const liees = P.lierZonesPhoto([zone], sources);
    eq(liees[0].page_id, 'p2', 'P02 : numéro résolu dans l’ordre envoyé');
    eq(liees[0].sha256, H('b'), 'P02 : empreinte figée à l’envoi');
    ok(P.sourcePhotoIntacte(liees[0], { id: 'p2', sha256: H('b'), rotation: 0 }), 'P02 : page identique admise');
    ok(!P.sourcePhotoIntacte(liees[0], { id: 'p2', sha256: H('a'), rotation: 0 }), 'P02 : page remplacée refusée');
    ok(!P.sourcePhotoIntacte(liees[0], { id: 'p2', sha256: H('b'), rotation: 90 }), 'P02 : rotation changée refusée');
    ok(!P.sourcePhotoIntacte(liees[0], null), 'P02 : page supprimée refusée');
    eq(P.relirePhotosPage({ photo_sources: sources, photo_propositions: liees }, ['p2']).sources.map((s) => s.page_id), ['p2'], 'P02 : relecture limitée aux pages du journal');
  });
  await run('extraction en un appel et absence de couplage', async () => {
    const { extraireRecette } = await import('../src/domain/llm.js');
    let appels = 0; let envoyes;
    const provider = { configured: true, supportsVision: true, complete: async (m) => { appels += 1; envoyes = m; return JSON.stringify({ title: 'Le plat', ingredients: [{ source_text: '1 pomme' }], steps: [], photo_zones: [{ photo: 1, rectangle, incertain: false }, { photo: 99, rectangle, incertain: false }] }); } };
    const r = await extraireRecette(provider, [{ mime: 'image/jpeg', base64: 'AA==' }]);
    eq(appels, 1, 'P01 : recette et image dans un appel');
    eq(r.recette.title, 'Le plat', 'P02 : recette valide indépendante de zone hostile');
    eq(r.zonesPhoto, [{ photo: 1, rectangle, incertain: false }], 'P02 : zone hostile seulement refusée');
    ok(envoyes[1].content.some((c) => c.type === 'text' && c.text === 'Photo 1'), 'P01 : image numérotée avant envoi');
  });
  await run('rectangle et rotation rendent les bons pixels', async () => {
    const I = await import('../src/core/image.js');
    const P = await import('../src/domain/photo-page.js');
    const toile = new OffscreenCanvas(400, 200); const cx = toile.getContext('2d');
    cx.fillStyle = '#f00'; cx.fillRect(0, 0, 200, 200); cx.fillStyle = '#00f'; cx.fillRect(200, 0, 200, 200);
    const blob = await toile.convertToBlob({ type: 'image/png' });
    const crop = await P.preparerRecadragePage(blob, { rotation: 90, rectangle: { x: 0, y: 0.5, largeur: 1, hauteur: 0.5 } });
    const dims = await I.dimensionsImage(crop);
    eq([dims.largeur, dims.hauteur], [200, 200], 'P04 : rectangle après quart de tour');
    const bmp = await createImageBitmap(crop); const preuve = new OffscreenCanvas(1, 1); const px = preuve.getContext('2d');
    px.drawImage(bmp, 0, 0, 1, 1); const couleur = px.getImageData(0, 0, 1, 1).data; bmp.close();
    ok(couleur[2] > 200 && couleur[0] < 40, 'P04 : la moitié bleue est réellement recadrée');
    const bande = await I.reduireImage(blob, { recadrage: { debut: 0, fin: 0.5 } });
    const b = await I.dimensionsImage(bande);
    eq([b.largeur, b.hauteur], [200, 200], 'P04 : bandes verticales I1 conservées');
    let refus = false; try { await P.preparerRecadragePage(blob, { rectangle: { x: 1, y: 0, largeur: 1, hauteur: 1 } }); } catch { refus = true; }
    ok(refus, 'P02 : rectangle débordant refusé sans rabattement');
  });
  await run('confirmation seule et concurrence', async () => {
    const P = await import('../src/domain/photo-page.js');
    const page = { id: 'p1', sha256: H('a'), rotation: 0 }; const recipe = { id: 'r1', source_page_ids: ['p1'], photo_sha256: null, personal_notes: 'À garder' };
    const blob = new Blob(['image'], { type: 'image/jpeg' });
    const hash = await (await import('../src/core/hash.js')).sha256Hex(blob);
    const calls = []; let courant = { ...recipe };
    const repo = { get: async (s) => s === 'source_pages' ? page : courant, putFile: async () => { calls.push('file'); return H('b'); },
      saveBatch: async (_, { conditions, fichiers }) => { courant = conditions.recipes[0].fusion(courant); calls.push([fichiers[0]?.sha256, courant.photo_sha256, fichiers[0]?.blob === blob]); } };
    const source = { page_id: 'p1', sha256: H('a'), rotation: 0, largeur: 400, hauteur: 200, rectangle };
    await P.enregistrerPhotoPage({ repo, recipe, source, blob });
    eq(calls, [[hash, hash, true]], 'P03 : octets et pointeur dans la même écriture conditionnée');
    eq([courant.photo_sha256, courant.photo_origin, courant.personal_notes], [hash, 'image', 'À garder'], 'P03 : photo livre sans effacer Mes notes');
    eq(courant.photo_provenance.rectangle, rectangle, 'P03 : géométrie traçable');
    courant.photo_sha256 = H('c'); let conflit = false;
    try { await P.enregistrerPhotoPage({ repo, recipe, source, blob: new Blob(['image'], { type: 'image/jpeg' }) }); } catch { conflit = true; }
    ok(conflit, 'P03 : photo choisie entre-temps protégée');
    eq(courant.photo_sha256, H('c'), 'P03 : la photo concurrente survit');
  });
  await run('sélection différée et confirmation figée', async () => {
    const { withRepo } = await import('./sync-fixture.js');
    const { panneauPhotoPage } = await import('../src/ui/photo-page.js');
    const { sha256Hex } = await import('../src/core/hash.js');
    const { revoquerUrlsDeBlob } = await import('../src/core/blob-urls.js');
    const { doitRendreApresPasse } = await import('../src/ui/state.js');
    const renduSync = () => doitRendreApresPasse({ avant: true, etat: { derniersEffets: { recues: 1 } }, route: '/recipes/rc_course' });
    const attendre = async (test) => { for (let i = 0; i < 150; i += 1) { if (await test()) return; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente sélection'); };
    await withRepo(async (repo) => {
      const sources = [];
      for (const [id, couleur] of [['pg_rouge', '#f00'], ['pg_bleue', '#00f']]) {
        const c = new OffscreenCanvas(200, 200), x = c.getContext('2d'); x.fillStyle = couleur; x.fillRect(0, 0, 200, 200);
        const blob = await c.convertToBlob({ type: 'image/png' }), sha256 = await sha256Hex(blob);
        await repo.putFile(sha256, blob);
        await repo.save('source_pages', { id, sha256, rotation: 0 });
        sources.push({ page_id: id, sha256, rotation: 0, largeur: 200, hauteur: 200 });
      }
      const recipe = { id: 'rc_course', original_title: 'Plat', availability: 'available', source_page_ids: sources.map((s) => s.page_id), photo_sha256: H('a') };
      await repo.saveBatch({ recipes: [recipe], imports: [{ id: 'im_course', recipe_id: recipe.id, kind: 'recette', status: 'enregistre', page_ids: recipe.source_page_ids,
        resultat: { photo_sources: sources, photo_propositions: sources.map((s) => ({ ...s, rectangle })) } }] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      let ouvrirLecture, fichierDemande = false, decisions = 0, repondre;
      const attenteLecture = new Promise((r) => { ouvrirLecture = r; });
      const espion = { ...repo, getFile: async (sha) => { if (sha === sources[1].sha256) { fichierDemande = true; await attenteLecture; } return repo.getFile(sha); } };
      const vue = await panneauPhotoPage(recipe, {}, { repo: espion, ctxF: {}, confirmDialog: () => { decisions += 1; return new Promise((r) => { repondre = r; }); } });
      document.body.append(vue);
      try {
        const ancien = vue.querySelector('[data-role=utiliser-photo-page]');
        [...vue.querySelectorAll('button')].find((b) => b.textContent === 'Image proposée 2').click();
        await attendre(() => fichierDemande);
        eq(renduSync(), false, 'P03 : la synchronisation garde le cadrage choisi pendant son chargement');
        ok(ancien.disabled, 'P03 : changer de page invalide aussitôt la confirmation de l’ancien aperçu');
        ancien.click();
        eq(decisions, 0, 'P03 : aucun accord demandé sur un aperçu devenu caduc');
        if (decisions) repondre(false); // finit aussi proprement le test rouge
        ouvrirLecture();
        await attendre(() => vue.querySelector('[data-role=utiliser-photo-page]') !== ancien && !vue.querySelector('[data-role=utiliser-photo-page]').disabled);
        vue.querySelector('[data-role=utiliser-photo-page]').click();
        await attendre(() => decisions > 0 && !!repondre);
        const choix = vue.querySelector('select'); choix.value = sources[0].page_id; choix.dispatchEvent(new Event('change', { bubbles: true }));
        repondre(true);
        await attendre(() => vue.textContent.includes('Photo du livre enregistrée.'));
        const relue = await repo.get('recipes', recipe.id);
        eq(relue.photo_provenance.page_id, sources[1].page_id, 'P03 : confirmation différée conserve la source choisie au clic');
        const image = await repo.getFile(relue.photo_sha256), bitmap = await createImageBitmap(image.blob);
        const c = new OffscreenCanvas(1, 1), x = c.getContext('2d'); x.drawImage(bitmap, 0, 0, 1, 1); bitmap.close();
        const px = x.getImageData(0, 0, 1, 1).data;
        ok(px[2] > 200 && px[0] < 40, 'P03 : les pixels enregistrés sont ceux de la source confirmée');
        eq(relue.photo_provenance.rectangle, rectangle, 'P03 : géométrie confirmée figée pendant l’attente');
        eq(renduSync(), true, 'P03 : la synchronisation peut rafraîchir après l’enregistrement du cadrage');
      } finally { ouvrirLecture(); repondre?.(false); vue.remove(); revoquerUrlsDeBlob(); }
    });
  });
  await run('panneau réel, confirmation et journal', async () => {
    const { withRepo } = await import('./sync-fixture.js');
    const { panneauPhotoPage } = await import('../src/ui/photo-page.js');
    const { sha256Hex } = await import('../src/core/hash.js');
    const { revoquerUrlsDeBlob } = await import('../src/core/blob-urls.js');
    const attendre = async (test) => { for (let i = 0; i < 150; i += 1) { if (await test()) return; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente photo'); };
    await withRepo(async (repo, db) => {
      const toile = new OffscreenCanvas(400, 200); const cx = toile.getContext('2d'); cx.fillStyle = '#d55'; cx.fillRect(0, 0, 400, 200);
      const original = await toile.convertToBlob({ type: 'image/png' }), hash = await sha256Hex(original);
      await repo.putFile(hash, original);
      const source = { page_id: 'pg_i2', sha256: hash, rotation: 0, largeur: 400, hauteur: 200 };
      const recipe = { id: 'rc_i2', original_title: 'Plat', availability: 'available', source_page_ids: ['pg_i2'], photo_sha256: null, current_version_id: 'rv_i2', personal_notes: 'Ne pas toucher' };
      const resultat = { title: 'Plat', ingredients: [{ source_text: '1 pomme' }], steps: [], photo_sources: [source], photo_propositions: [{ ...source, rectangle }] };
      await repo.saveBatch({ source_pages: [{ id: 'pg_i2', sha256: hash, rotation: 0, printed_page: 12 }], recipes: [recipe],
        recipe_versions: [{ id: 'rv_i2', recipe_id: recipe.id, ingredients: [], steps: [], notes: 'Texte original' }],
        imports: [{ id: 'im_i2', recipe_id: recipe.id, kind: 'recette', status: 'enregistre', page_ids: ['pg_i2'], resultat }] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const versionAvant = JSON.stringify(await repo.get('recipe_versions', 'rv_i2'));
      const vue = await panneauPhotoPage(recipe, {}, { repo, ctxF: {}, toast: () => {} });
      const cadreMobile = document.createElement('div'); cadreMobile.style.width = '320px'; cadreMobile.append(vue); document.body.append(cadreMobile);
      try {
        eq((await repo.get('recipes', recipe.id)).photo_sha256, null, 'P03 : montage ne pose aucune photo');
        ok(vue.textContent.includes('Utiliser cette image ?'), 'P01 : proposition visible');
        eq(vue.querySelectorAll('input[type=number]').length, 4, 'P01 : quatre réglages clavier');
        ok(vue.querySelector('[aria-label="Déplacer le coin supérieur gauche"]'), 'P01 : poignée tactile et clavier');
        const borne = cadreMobile.getBoundingClientRect();
        ok([...vue.querySelectorAll('input,select,button')].every((n) => { const r = n.getBoundingClientRect(); return r.left >= borne.left - 1 && r.right <= borne.right + 1; }), 'U01 : commandes du cadrage sans débordement à 320 px');
        const bouton = vue.querySelector('[data-role=utiliser-photo-page]');
        ok(!bouton.disabled, 'P01 : aperçu prêt à confirmer');
        bouton.click();
        await attendre(async () => !!(await repo.get('recipes', recipe.id)).photo_sha256);
        await attendre(() => vue.textContent.includes('Photo du livre enregistrée.'));
        const relue = await repo.get('recipes', recipe.id);
        eq(relue.personal_notes, 'Ne pas toucher', 'P03 : note intacte après geste réel');
        eq(relue.photo_provenance.rectangle, rectangle, 'P03 : le cadrage vu est celui enregistré');
        eq((await repo.get('imports', 'im_i2')).resultat.photo_choice, 'utilisee', 'P03 : choix durable sur le résultat');
        eq(JSON.stringify(await repo.get('recipe_versions', 'rv_i2')), versionAvant, 'P03 : version originale strictement intacte');
        eq(await sha256Hex((await repo.getFile(hash)).blob), hash, 'P03 : octets source intacts');
        const nouvelle = await panneauPhotoPage(relue, {}, { repo, ctxF: {} });
        ok(!nouvelle.textContent.includes('Utiliser cette image ?'), 'P03 : choix accepté ne repropose pas au retour');
        ok(nouvelle.textContent.includes('Choisir une zone dans une page'), 'P01 : cadrage manuel reste disponible');
        const filesAvant = (await db.getAll('files')).length;
        const stale = { ...source, rectangle };
        const jpeg = await (await import('../src/domain/photo-page.js')).preparerRecadragePage(original, { rectangle });
        const concurrent = { ...repo, saveBatch: async (...a) => { await repo.save('source_pages', { id: source.page_id, sha256: hash, rotation: 90 }); return repo.saveBatch(...a); } };
        let refuse = false;
        try { await (await import('../src/domain/photo-page.js')).enregistrerPhotoPage({ repo: concurrent, recipe: relue, source: stale, blob: jpeg }); } catch { refuse = true; }
        ok(refuse, 'P02 : rotation modifiée entre préparation et transaction refusée');
        eq((await repo.get('recipes', recipe.id)).photo_sha256, relue.photo_sha256, 'P02 : photo inchangée après refus transactionnel');
        eq((await db.getAll('files')).length, filesAvant, 'P03 : réemploi du même JPEG sans doublon fichier');
      } finally { cadreMobile.remove(); revoquerUrlsDeBlob(); }
    });
  });
}
