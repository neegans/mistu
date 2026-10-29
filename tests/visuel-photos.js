import { withRepo } from './sync-fixture.js';

export async function runVisuelPhotosTests({ eq, ok }) {
  const { photoVisible, LIMITES_PHOTOS_VISIBLES } = await import('../src/ui/photos-visibles.js');
  const sha = 'a'.repeat(64), autre = 'b'.repeat(64), date = '2026-10-28T12:00:00.000Z';
  const jpeg = async () => { const c = new OffscreenCanvas(30, 30); c.getContext('2d').fillRect(0, 0, 30, 30); return c.convertToBlob({ type: 'image/jpeg' }); };
  const distante = (s = sha) => ({ sha256: s, mime: 'image/jpeg', size: 500, remote: { sha256: s, mime: 'image/jpeg', size: 500, quality: 'originale', uploaded_at: date, owner: 'u1' } });
  const scene = document.createElement('div'); document.body.append(scene);
  const racines = [];
  const monter = (s, o) => { const n = photoVisible(s, o); racines.push(n); if (n) scene.append(n); return n; };
  const tick = () => new Promise(r => setTimeout(r, 10));
  try {
    const blob = await jpeg();
    let visible, appels = 0;
    const rows = new Map([[sha, distante()]]);
    const repo = { getFile: async s => rows.get(s), get: async () => null };
    const moteur = { etat: () => ({}), telecharger: async ([s]) => { appels++; rows.set(s, { ...rows.get(s), blob }); return { recus: 1 }; } };
    const ctxF = { uid: 'u1', connecte: true, moteur, erreurs: new Map() };
    const a = monter(sha, { repo, ctxF, observer: (_, f) => { visible = f; return () => {}; } });
    await a.attendre();
    eq(appels, 0, 'Photos visibles : aucune réception avant visibilité');
    ok(a.textContent.includes('Photo à télécharger'), 'Photos visibles : distante annoncée, jamais Ajouter une photo');
    visible(true); await a.attendre(); await tick();
    eq(appels, 1, 'Photos visibles : la visibilité déclenche la réception');
    ok(!!a.querySelector('img[src]'), 'Photos visibles : octets reçus affichés sans recharger la route');
    const locale = monter(sha, { fichier: rows.get(sha), repo, ctxF, enLigne: () => false, observer: () => () => {} });
    await locale.attendre(); eq(!!locale.querySelector('img[src]'), true, 'Photos visibles : image locale visible hors ligne');
    const pending = new Map(); let actifs = 0, max = 0, demandes = 0;
    const engine = { etat: () => ({}), telecharger: async ([s]) => { demandes++; actifs++; max = Math.max(max, actifs); await new Promise(r => pending.set(s, r)); rows.set(s, { ...rows.get(s), blob }); actifs--; return { recus: 1 }; } };
    const nodes = [];
    for (const s of [autre, autre, 'c'.repeat(64), 'd'.repeat(64)]) { rows.set(s, distante(s)); nodes.push(monter(s, { repo, ctxF: { ...ctxF, moteur: engine }, observer: (_, f) => { queueMicrotask(() => f(true)); return () => {}; } })); }
    await tick(); eq(demandes, 2, 'Photos visibles : dédoublonnage et deux vols au plus');
    eq(max, LIMITES_PHOTOS_VISIBLES.concurrence, 'Photos visibles : concurrence bornée');
    for (const r of pending.values()) r(); await tick(); for (const r of pending.values()) r(); await Promise.all(nodes.map(n => n.attendre()));
    eq(demandes, 3, 'Photos visibles : une seule réception pour deux vues de la même empreinte');
    for (const depart of ['retirée', 'masquée', 'toutes retirées']) {
      const ciblePartagee = 'e'.repeat(64), bloqueurs = ['1'.repeat(64), '2'.repeat(64)];
      const attenteRows = new Map([...bloqueurs, ciblePartagee].map(s => [s, distante(s)]));
      const releases = [], demandesFile = [], observateurs = new Map(); let enVol = 0, maxVol = 0;
      const attenteRepo = { getFile: async s => attenteRows.get(s), get: async () => null };
      const moteurFile = { etat: () => ({}), telecharger: async ([s]) => {
        demandesFile.push(s); maxVol = Math.max(maxVol, ++enVol);
        if (bloqueurs.includes(s)) await new Promise(resolve => releases.push(resolve));
        attenteRows.set(s, { ...attenteRows.get(s), blob }); enVol--;
      } };
      const optionsFile = { repo: attenteRepo, ctxF: { ...ctxF, moteur: moteurFile }, observer: (n, f) => { observateurs.set(n, f); return () => {}; } };
      const prises = bloqueurs.map(s => monter(s, optionsFile));
      await Promise.all(prises.map(n => n.attendre())); prises.forEach(n => observateurs.get(n)(true)); await tick();
      const premiere = monter(ciblePartagee, optionsFile), seconde = monter(ciblePartagee, optionsFile);
      await Promise.all([premiere.attendre(), seconde.attendre()]);
      observateurs.get(premiere)(true); observateurs.get(seconde)(true); await tick();
      eq(demandesFile, bloqueurs, `Photos visibles : empreinte partagée attend derrière deux vols avant première vue ${depart}`);
      if (depart !== 'masquée') { premiere.dispose(); premiere.remove(); } else observateurs.get(premiere)(false);
      if (depart === 'toutes retirées') { seconde.dispose(); seconde.remove(); }
      releases.forEach(resolve => resolve());
      await Promise.all([...prises, premiere, seconde].map(n => n.attendre()));
      eq([demandesFile.filter(s => s === ciblePartagee).length, !!seconde.querySelector('img'), maxVol], depart === 'toutes retirées' ? [0, false, 2] : [1, true, 2], depart === 'toutes retirées' ? 'Photos visibles : toutes les vues retirées annulent la réception en attente' : `Photos visibles : première vue ${depart}, la seconde reçoit une seule fois sans nouvel événement`);
    }
    let blocages = 0;
    const blockedEngine = { etat: () => ({ pauseFichiers: true }), telecharger: async () => { blocages++; } };
    const cases = [
      { ...ctxF, moteur: blockedEngine },
      { ...ctxF, moteur: { ...blockedEngine, etat: () => ({}) }, uid: 'autre-compte' },
      { ...ctxF, moteur: { ...blockedEngine, etat: () => ({}) }, connecte: false },
      { ...ctxF, moteur: { ...blockedEngine, etat: () => ({}) }, erreurs: new Map([[sha, { motif: 'introuvable' }]]) },
    ];
    for (const c of cases) { rows.set(sha, distante()); const n = monter(sha, { repo, ctxF: c, observer: (_, f) => { queueMicrotask(() => f(true)); return () => {}; } }); await n.attendre(); }
    eq(blocages, 0, 'Photos visibles : pause, autre compte, déconnexion et erreur empêchent la réception automatique');
    let current = 'u1', unblock, turns = 0;
    const changing = { etat: () => ({}), telecharger: async () => { turns++; await new Promise(r => { unblock = r; }); rows.set(sha, { ...distante(), blob }); } };
    rows.set(sha, distante());
    const old = monter(sha, { repo, ctxF: { ...ctxF, moteur: changing, courant: () => ({ uid: current, connecte: true, moteur: changing }) }, observer: (_, f) => { queueMicrotask(() => f(true)); return () => {}; } });
    await tick(); current = 'u2'; unblock(); await old.attendre();
    eq(turns, 1, 'Photos visibles : demande initiale du bon compte');
    eq(old.querySelector('img'), null, 'Photos visibles : résultat tardif du compte précédent non affiché');
    const unreadable = monter(sha, { fichier: { ...distante(), blob: new Blob(['invalide'], { type: 'image/heic' }) }, repo, ctxF, observer: () => () => {} });
    await unreadable.attendre(); unreadable.querySelector('img').dispatchEvent(new Event('error'));
    ok(unreadable.textContent.includes('Cette image ne peut pas être affichée'), 'Photos visibles : échec de décodage explicite');
    ok(!!unreadable.querySelector('button[data-role=telecharger-image]'), 'Photos visibles : fichier original accessible si aperçu illisible');
    const pdfRow = { ...distante(), mime: 'application/pdf', remote: { ...distante().remote, mime: 'application/pdf' } };
    const pdf = monter(sha, { fichier: pdfRow, repo: { getFile: async () => pdfRow, get: async () => null }, ctxF: { ...ctxF, moteur: { etat: () => ({}), telecharger: async () => { blocages++; } } }, observer: (_, f) => { queueMicrotask(() => f(true)); return () => {}; } });
    await pdf.attendre(); await tick(); eq([blocages, !!pdf.querySelector('button')], [0, false], 'Photos visibles : aucun PDF téléchargé automatiquement malgré compte actif et connecté');
    const horsLigne = monter(sha, { fichier: distante(), repo: { getFile: async () => distante(), get: async () => null }, ctxF: { ...ctxF, moteur: { etat: () => ({}), telecharger: async () => { blocages++; } } }, enLigne: () => false, observer: (_, f) => { queueMicrotask(() => f(true)); return () => {}; } });
    await horsLigne.attendre(); await tick();
    eq([blocages, horsLigne.textContent.includes('Photo à télécharger'), !!horsLigne.querySelector('button')], [0, true, false], 'Photos visibles : hors ligne, photo distante annoncée sans requête ni bouton actif');
    let bloquee = true, avertirPause, reprises = 0;
    const pauseRows = new Map([[sha, distante()]]);
    const pauseRepo = { getFile: async s => pauseRows.get(s), get: async () => ({ value: bloquee }) };
    const pauseMoteur = { etat: () => ({}), onEtat: f => { avertirPause = f; return () => {}; }, telecharger: async () => { reprises++; pauseRows.set(sha, { ...distante(), blob }); } };
    const pauseNode = monter(sha, { repo: pauseRepo, ctxF: { ...ctxF, moteur: pauseMoteur }, observer: (_, f) => { queueMicrotask(() => f(true)); return () => {}; } });
    await pauseNode.attendre(); await tick();
    eq([reprises, pauseNode.textContent.includes('en pause')], [0, true], 'Photos visibles : pause persistée relue même si état moteur pas encore actualisé');
    bloquee = false; avertirPause(); await pauseNode.attendre();
    eq([reprises, !!pauseNode.querySelector('img')], [1, true], 'Photos visibles : reprise réelle de la pause reçoit la photo encore visible');
    const imgPause = pauseNode.querySelector('img');
    await pauseNode.actualiser();
    eq(pauseNode.querySelector('img'), imgPause, 'Photos visibles : actualisation des métadonnées garde l’image existante sans scintillement');
    let reessais = 0; const erreurRows = new Map([[autre, distante(autre)]]);
    const erreurRepo = { getFile: async s => erreurRows.get(s), get: async () => null };
    const erreurMoteur = { etat: () => ({}), telecharger: async () => { throw Error('appel automatique interdit'); }, reessayerFichier: async () => { reessais++; erreurRows.set(autre, { ...distante(autre), blob }); } };
    const erreurNode = monter(autre, { repo: erreurRepo, ctxF: { ...ctxF, moteur: erreurMoteur, erreurs: new Map([[autre, {}]]) }, observer: (_, f) => { queueMicrotask(() => f(true)); return () => {}; } });
    await erreurNode.attendre(); erreurNode.querySelector('button').click(); await erreurNode.attendre();
    eq([reessais, !!erreurNode.querySelector('img')], [1, true], 'Photos visibles : seul le réessai explicite lève une erreur fichier');
    const G = await import('../src/ui/photo-gestion.js');
    await withRepo(async (R) => {
      await R.save('recipes', { id: 'photo-r', original_title: 'Pain', availability: 'reference_only', photo_sha256: sha, photo_origin: 'image', personal_notes: 'Garder' }, {conditions:{recipes:[{key:'photo-r',absente:true}]}});
      await R.putFile(sha, blob); await R.putFile(autre, blob);
      const source = { sha256: sha, personnelle: false, cuisson_id: null };
      const sourceAvant = await R.get('recipes', 'photo-r');
      const vide = await G.modifierPhotoAffichee('photo-r', source, { retirer: true }, { repo: R });
      eq(vide.issue, 'ok', 'Photo gestion : retrait de la photo affichée sur référence');
      eq((await R.get('recipes', 'photo-r')).availability, 'reference_only', 'Photo gestion : ajouter/retirer ne complète pas une recette');
      await R.save('recipes', sourceAvant);
      const changee = await G.modifierPhotoAffichee('photo-r', { ...source, sha256: autre }, { retirer: true }, { repo: R });
      eq(changee.raison, 'fiche_changee', 'Photo gestion : cible modifiée refusée sans retirer une autre image');
      await R.save('cook_history', { id: 'photo-h', recipe_id: 'photo-r', cooked_at: '2026-10-28', notes: 'Note intacte', photos: [sha, autre] });
      const cible = { sha256: autre, personnelle: true, cuisson_id: 'photo-h' };
      const result = await G.modifierPhotoAffichee('photo-r', cible, { retirer: true }, { repo: R });
      eq(result.issue, 'ok', 'Photo gestion : retrait cible la cuisson affichée');
      eq((await R.get('cook_history', 'photo-h')).photos, [sha], 'Photo gestion : les autres photos de cuisson restent');
      eq((await R.get('cook_history', 'photo-h')).notes, 'Note intacte', 'Photo gestion : note de cuisson intacte');
      eq((await R.get('recipes', 'photo-r')).photo_sha256, sha, 'Photo gestion : image du livre intacte');
      await R.save('cook_history', { id: 'photo-h', recipe_id: 'photo-r', cooked_at: '2026-10-28', notes: 'Note intacte', photos: [sha, autre] });
      let injectee = false;
      const racing = { ...R, saveBatch: async (batch, options) => { if (!injectee && options?.conditions?.cook_history) { injectee = true; await R.save('cook_history', { ...(await R.get('cook_history', 'photo-h')), photos: [sha, 'c'.repeat(64)] }); } return R.saveBatch(batch, options); } };
      const raced = await G.modifierPhotoAffichee('photo-r', cible, { retirer: true }, { repo: racing });
      eq(raced.raison, 'fiche_changee', 'Photo gestion : garde de cuisson relue dans la transaction');
      eq((await R.get('cook_history', 'photo-h')).photos, [sha, 'c'.repeat(64)], 'Photo gestion : autre photo arrivée pendant le geste conservée');
      await R.save('cook_history', { id: 'photo-h', recipe_id: 'photo-r', cooked_at: '2026-10-28', notes: 'Note intacte', photos: [sha, autre] });
      const remplace = await G.modifierPhotoAffichee('photo-r', cible, { file: blob, origin: 'image' }, { repo: R });
      eq(remplace.issue, 'ok', 'Photo gestion : remplacement de la photo personnelle');
      const photos = (await R.get('cook_history', 'photo-h')).photos;
      ok(photos.includes(sha) && !photos.includes(autre), 'Photo gestion : seul le pointeur remplacé change');
      eq((await R.all('cook_history')).length, 1, 'Photo gestion : aucune fausse cuisson créée');
      await R.save('recipes', { id: 'vide-r', original_title: 'Référence', availability: 'reference_only' }, {conditions:{recipes:[{key:'vide-r',absente:true}]}});
      const ajoute = await G.modifierPhotoAffichee('vide-r', null, { file: blob, origin: 'photo' }, { repo: R });
      eq([ajoute.issue, (await R.get('recipes', 'vide-r')).availability, (await R.byIndex('cook_history', 'recipe_id', 'vide-r')).length], ['ok', 'reference_only', 0], 'Photo gestion : une référence vide accepte une photo sans version ni cuisson');
      let raceSource = false;
      const sourceRepo = { ...R, saveBatch: async (batch, options) => { if (!raceSource && options?.conditions?.recipes) { raceSource = true; await R.save('recipes', { ...(await R.get('recipes', 'vide-r')), photo_sha256: autre }); } return R.saveBatch(batch, options); } };
      const concurrent = await G.modifierPhotoAffichee('vide-r', { sha256: ajoute.sha256, personnelle: false, cuisson_id: null }, { file: blob }, { repo: sourceRepo });
      eq([concurrent.raison, (await R.get('recipes', 'vide-r')).photo_sha256], ['fiche_changee', autre], 'Photo gestion : remplacement refuse la photo changée au dernier instant de la transaction');
      const node = await G.renderPhotoGestion({ id: 'photo-r' }, {}, { sync: {} }, { repo: R, ctxF: {}, pickFiles: async () => [] }); scene.append(node);
      const avantAnnuler = JSON.stringify(await R.get('cook_history', 'photo-h'));
      [...node.querySelectorAll('button')].find(b => b.textContent === 'Choisir une photo').click(); await node.attendreEcritures();
      eq(JSON.stringify(await R.get('cook_history', 'photo-h')), avantAnnuler, 'Photo gestion : annuler le sélecteur ne change rien');
      ok(!node.textContent.includes('null'), 'Photo gestion : aucun texte null issu des éléments facultatifs');
      ok(node.textContent.includes('Ma photo du plat') && node.textContent.includes('Image de la recette'), 'Photo gestion : provenance et image de recette séparées');
      node.dispose(); node.remove();
      let terminerChoix;
      const quitte = await G.renderPhotoGestion({ id: 'photo-r' }, {}, { sync: {} }, { repo: R, ctxF: {}, pickFiles: () => new Promise(resolve => { terminerChoix = resolve; }) }); scene.append(quitte); await tick();
      const avantDepart = JSON.stringify(await R.get('cook_history', 'photo-h'));
      [...quitte.querySelectorAll('button')].find(b => b.textContent === 'Choisir une photo').click();
      quitte.remove(); await tick();
      const autreToile = new OffscreenCanvas(30, 30); autreToile.getContext('2d').fillStyle = '#fff'; autreToile.getContext('2d').fillRect(0, 0, 30, 30);
      terminerChoix([await autreToile.convertToBlob({ type: 'image/jpeg' })]); await quitte.attendreEcritures();
      eq(JSON.stringify(await R.get('cook_history', 'photo-h')), avantDepart, 'Photo gestion : quitter la route annule le résultat tardif du sélecteur');
      quitte.dispose();

    });
    // Métadonnées et octets passent par les vrais moteurs, entre deux bases et un serveur/stockage factices.
    const { withDatabase } = await import('./backup.js');
    const { creerTransportFactice } = await import('./transport-factice.js');
    const { creerStockageFactice } = await import('./stockage-factice.js');
    const { createMoteur } = await import('../src/sync/moteur.js');
    const { sha256Hex } = await import('../src/core/hash.js');
    const { photoPrincipale } = await import('../src/domain/cuisine-personnelle.js');
    const { recipeCard } = await import('../src/ui/components.js');
    await withRepo(async (R, premier) => {
      const shaPersonnel = await sha256Hex(blob);
      const toile = new OffscreenCanvas(30, 30); toile.getContext('2d').fillStyle = 'red'; toile.getContext('2d').fillRect(0, 0, 30, 30);
      const livre = await toile.convertToBlob({ type: 'image/jpeg' }), shaLivre = await sha256Hex(livre);
      await R.putFile(shaPersonnel, blob); await R.putFile(shaLivre, livre);
      await R.save('recipes', { id: 'r-deux', original_title: 'Ma recette', photo_sha256: shaLivre, availability: 'reference_only' }, {conditions:{recipes:[{key:'r-deux',absente:true}]}});
      await R.save('cook_history', { id: 'ch-deux', recipe_id: 'r-deux', cooked_at: '2026-10-28', photos: [shaPersonnel], notes: 'À garder' });
      const transport = creerTransportFactice({ serveur: true }), stockage = creerStockageFactice();
      const moteur1 = createMoteur({ db: premier, getUserId: () => 'u1', transport, stockage, qualite: () => 'originale', fenetre: { document: { visibilityState: 'hidden' } } });
      try {
        await moteur1.executer('test'); await moteur1.executer('test-metadonnees');
        ok(!!transport.ligne('files', shaPersonnel)?.data?.remote, 'Photos deux bases : empreinte distante envoyée avec les métadonnées par le vrai moteur');
        await withDatabase(async second => {
          const moteur2 = createMoteur({ db: second, getUserId: () => 'u1', transport, stockage, fenetre: { document: { visibilityState: 'hidden' } } });
          let card;
          try {
            await moteur2.executer('test-reception');
            const r = await second.get('recipes', 'r-deux'), h = await second.getAll('cook_history');
            const principale = photoPrincipale(r, h), meta = await second.get('files', shaPersonnel);
            eq([principale.sha256, meta.blob instanceof Blob], [shaPersonnel, false], 'Photos deux bases : recette et cuisson reçues avant les octets personnels');
            await second.mutate({ puts: { files: [{ ...(await second.get('files', shaLivre)), blob: livre }] }, origin: 'remote' });
            R.bindDatabase(second);
            card = recipeCard({ recipe: r, photo_principale: principale, version: null }, { photoEnTete: true, fichier: meta, ctxF: { uid: 'u1', connecte: true, moteur: moteur2, erreurs: new Map() } });
            eq([!!card.querySelector('img'), card.textContent.includes('Ma photo du plat')], [false, true], 'Photos deux bases : carte en attente de la photo personnelle, aucune substitution par le livre local');
            for (const n of racines) n?.dispose(); scene.replaceChildren(card); scene.style.cssText = 'position:fixed;top:0;left:0;width:320px;height:400px;overflow:auto';
            const image = card.querySelector('[data-role=photo-visible]'); image.scrollIntoView();
            for (let i = 0; i < 200 && !image.querySelector('img'); i++) await tick();
            const img = image.querySelector('img'); if (img) await img.decode();
            const recu = await second.get('files', shaPersonnel);
            eq([!!img, recu.blob instanceof Blob ? await sha256Hex(recu.blob) : null], [true, shaPersonnel], 'Photos deux bases : visibilité reçoit et décode réellement la photo personnelle, sans clic');
            eq(stockage.journal.filter(x => x.methode === 'recevoir').length, 1, 'Photos deux bases : une seule image distante reçue, pas la bibliothèque');
          } finally { card?.querySelector('[data-role=photo-visible]')?.dispose(); card?.remove(); R.bindDatabase(premier); await moteur2.arreter(); }
        });
      } finally { await moteur1.arreter(); }
    });
  } finally { for (const n of racines) n?.dispose(); scene.remove(); }
}
