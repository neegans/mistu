import { renderPhotoGestion, modifierPhotoAffichee } from '../src/ui/photo-gestion.js';
import { preparerPhotoLocale } from '../src/core/image.js';
import { sha256Hex } from '../src/core/hash.js';
import { getSyncState, setSyncState } from '../src/ui/state.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';
import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';

const clone = v => structuredClone(v);
const differe = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const bouton = (root, capture = false) => [...root.querySelectorAll('button')].find(b => b.textContent === (capture ? 'Prendre une photo' : 'Choisir une photo'));
const snapshot = async db => Object.fromEntries(await Promise.all(['recipes', 'recipe_versions', 'cook_history', 'files', 'outbox'].map(async s => [s, await db.getAll(s)])));
async function image(couleur, nom) {
  const canvas = new OffscreenCanvas(80, 60), c = canvas.getContext('2d'); c.fillStyle = couleur; c.fillRect(0, 0, 80, 60);
  c.fillStyle = '#fff'; c.fillRect(2, 2, 12, 10);
  return new File([await canvas.convertToBlob({ type: 'image/jpeg', quality: .9 })], nom, { type: 'image/jpeg' });
}
export async function fixturePhotosRemplacement(repo, db, { personnelle = true } = {}) {
  const couleurs = ['#e31', '#1b6', '#36c', '#c81'], shas = [];
  for (let i = 0; i < couleurs.length; i++) { const blob = await image(couleurs[i], `ancienne-${i}.jpg`), sha = await sha256Hex(blob); shas.push(sha); await repo.putFile(sha, blob); }
  const recipe = { id: 'photo-audit-r', original_title: 'Pain de la maison', availability: 'available', current_version_id: 'photo-audit-v', photo_sha256: shas[0], photo_origin: 'image', personal_notes: 'Ma note de recette' };
  const version = { id: 'photo-audit-v', recipe_id: recipe.id, kind: 'extraction', ingredients: [{ id: 'i-photo', source_text: '100 g de farine', quantity: { value: 100 }, unit_id: 'g' }], steps: [{ id: 's-photo', text: 'Mélanger.' }] };
  const cuisson = { id: 'photo-audit-h', recipe_id: recipe.id, cooked_at: '2026-10-29', photos: [shas[1], shas[2]], notes: 'Ma note de cuisson' };
  await db.mutate({ origin: 'remote', puts: { recipes: [recipe], recipe_versions: [version], cook_history: personnelle ? [cuisson] : [] } });
  const file = await image('#a3c', 'photo-choisie.jpg'), jpeg = await preparerPhotoLocale(file), sha = await sha256Hex(jpeg);
  let preparations = 0; const slice = file.slice.bind(file); Object.defineProperty(file, 'slice', { value: (...args) => { preparations++; return slice(...args); } });
  return { recipe, version, cuisson, shas, file, jpeg, sha, preparations: () => preparations, attendu: { sha256: shas[2], personnelle: true, cuisson_id: cuisson.id } };
}

export async function runAuditPhotosRemplacementTests({ eq, ok }) {
  const locale = getUiLocale(), sync = getSyncState(), scene = document.createElement('div'); setUiLocale('fr'); document.body.append(scene);
  const run = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, `10.6 photo ${nom} : ${e.stack || e}`); } finally { for (const root of scene.children) root.dispose?.(); scene.replaceChildren(); } };
  const monter = async (repo, f, deps = {}) => { const root = await renderPhotoGestion({ id: f.recipe.id }, {}, {}, { repo, ctxF: {}, ...deps }); scene.append(root); return root; };
  try {
    for (const capture of [false, true]) for (const accepte of [false, true]) await run(`confirmation ${capture}/${accepte}`, async (repo, db) => {
      const f = await fixturePhotosRemplacement(repo, db), avant = await snapshot(db), choix = differe(), reponse = differe(), entree = differe(), dialogues = [], selections = [];
      const root = await monter(repo, f, { pickFiles: options => { selections.push(options); return choix.promise; }, confirmDialog: (texte, options) => { dialogues.push([texte, options.okLabel]); entree.resolve('dialogue'); return reponse.promise; } });
      bouton(root, capture).click(); const travail = root.attendreEcritures();
      eq(dialogues.length, 0, `10.6 photo ${capture}/${accepte} : aucun dialogue avant le fichier choisi`);
      choix.resolve([f.file]);
      eq(await Promise.race([entree.promise, travail.then(() => 'termine')]), 'dialogue', `10.6 photo ${capture}/${accepte} : confirmation réellement atteinte`);
      eq(dialogues, [['Remplacer la photo affichée ?', 'Remplacer la photo']], `10.6 photo ${capture}/${accepte} : dialogue explicite unique`);
      eq(f.preparations(), 0, `10.6 photo ${capture}/${accepte} : aucun en-tête lu avant confirmation`);
      eq(await snapshot(db), avant, `10.6 photo ${capture}/${accepte} : aucune écriture avant confirmation`);
      eq(selections[0], { accept: 'image/*', multiple: false, ...(capture ? { capture: 'environment' } : {}) }, `10.6 photo ${capture}/${accepte} : vrai geste choisir ou appareil photo`);
      reponse.resolve(accepte); await travail;
      if (!accepte) {
        eq(await snapshot(db), avant, `10.6 photo ${capture} : annulation conserve toutes les données et fichiers`);
        eq(f.preparations(), 0, `10.6 photo ${capture} : annulation ne prépare pas le fichier`);
      } else {
        eq((await repo.get('cook_history', f.cuisson.id)).photos, [f.shas[1], f.sha], `10.6 photo ${capture} : seule la photo affichée est remplacée`);
        eq((await repo.get('cook_history', f.cuisson.id)).notes, f.cuisson.notes, `10.6 photo ${capture} : note conservée`);
        eq([await repo.get('recipes', f.recipe.id), await repo.get('recipe_versions', f.version.id), (await repo.all('cook_history')).length], [f.recipe, f.version, 1], `10.6 photo ${capture} : recette, version et nombre de cuissons intacts`);
        eq(await sha256Hex((await repo.getFile(f.sha)).blob), await sha256Hex(f.jpeg), `10.6 photo ${capture} : octets du vrai fichier choisi après préparation`);
        ok(f.preparations() > 0 && root.textContent.includes('Photo du plat enregistrée.'), `10.6 photo ${capture} : préparation et succès seulement après écriture`);
      }
    });
    for (const capture of [false, true]) await run('sélecteur annulé', async (repo, db) => {
      const f = await fixturePhotosRemplacement(repo, db), avant = await snapshot(db); let confirmations = 0;
      const root = await monter(repo, f, { pickFiles: async () => [], confirmDialog: async () => { confirmations++; return true; } });
      bouton(root, capture).click(); await root.attendreEcritures();
      eq([confirmations, f.preparations()], [0, 0], `10.6 photo ${capture} : sélecteur annulé sans confirmation ni préparation`);
      eq(await snapshot(db), avant, `10.6 photo ${capture} : sélecteur annulé sans écriture`);
    });
    for (const detruire of [false, true]) await run('route fermée avant fichier', async (repo, db) => {
      const f = await fixturePhotosRemplacement(repo, db), avant = await snapshot(db), choix = differe(); let confirmations = 0;
      const root = await monter(repo, f, { pickFiles: () => choix.promise, confirmDialog: async () => { confirmations++; return true; } });
      bouton(root).click(); const travail = root.attendreEcritures();
      if (detruire) root.dispose(); root.remove(); choix.resolve([f.file]); await travail;
      eq([confirmations, f.preparations()], [0, 0], `10.6 photo route ${detruire} : aucun dialogue ni préparation après sortie du sélecteur`);
      eq(await snapshot(db), avant, `10.6 photo route ${detruire} : aucune écriture après sortie du sélecteur`);
      root.dispose();
    });
    await run('image de recette', async (repo, db) => {
      const f = await fixturePhotosRemplacement(repo, db, { personnelle: false }); let confirmations = 0;
      const root = await monter(repo, f, { pickFiles: async () => [f.file], confirmDialog: async () => { confirmations++; return true; } });
      bouton(root).click(); await root.attendreEcritures();
      eq(confirmations, 0, '10.6 photo : image de recette sans nouvelle confirmation de cuisson');
      eq([(await repo.get('recipes', f.recipe.id)).photo_sha256, (await repo.all('cook_history')).length], [f.sha, 0], '10.6 photo : image choisie hors cuisson, aucune fausse cuisson');
    });
    for (const changement of ['photo', 'note', 'compte', 'generation', 'route']) await run(`pendant dialogue ${changement}`, async (repo, db) => {
      const f = await fixturePhotosRemplacement(repo, db), reponse = differe(), entree = differe();
      const root = await monter(repo, f, { pickFiles: async () => [f.file], confirmDialog: () => { entree.resolve('dialogue'); return reponse.promise; } });
      bouton(root).click(); const travail = root.attendreEcritures();
      const atteint = await Promise.race([entree.promise, travail.then(() => 'termine')]);
      eq(atteint, 'dialogue', `10.6 photo ${changement} : vraie attente de confirmation atteinte`);
      if (changement === 'photo') await db.mutate({ origin: 'remote', puts: { cook_history: [{ ...f.cuisson, photos: [f.shas[1], f.shas[3]] }] } });
      if (changement === 'note') await db.mutate({ origin: 'remote', puts: { cook_history: [{ ...f.cuisson, notes: 'Note concurrente', photos: [f.shas[1], f.shas[3], f.shas[2]] }] } });
      if (changement === 'compte') await db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'autre-compte' }] } });
      if (changement === 'generation') setSyncState({});
      if (changement === 'route') { root.dispose(); root.remove(); }
      const concurrent = await snapshot(db); reponse.resolve(true); await travail;
      if (changement === 'note') eq([(await repo.get('cook_history', f.cuisson.id)).notes, (await repo.get('cook_history', f.cuisson.id)).photos], ['Note concurrente', [f.shas[1], f.shas[3], f.sha]], '10.6 photo : note et autre photo concurrentes conservées');
      else {
        eq(await snapshot(db), concurrent, `10.6 photo ${changement} : aucune écriture après changement de cible ou de portée`);
        if (changement !== 'route') ok(root.textContent.includes('La photo a changé.'), `10.6 photo ${changement} : refus de concurrence visible`);
      }
    });
    await run('base pendant dialogue', async (repo, db) => {
      const f = await fixturePhotosRemplacement(repo, db), reponse = differe(), entree = differe();
      const root = await monter(repo, f, { pickFiles: async () => [f.file], confirmDialog: () => { entree.resolve('dialogue'); return reponse.promise; } });
      bouton(root).click(); const travail = root.attendreEcritures();
      eq(await Promise.race([entree.promise, travail.then(() => 'termine')]), 'dialogue', '10.6 photo base : attente de confirmation atteinte');
      await withDatabase(async autre => {
        await autre.mutate({ origin: 'remote', puts: { recipes: [f.recipe], recipe_versions: [f.version], cook_history: [f.cuisson] } });
        const avant = await snapshot(autre), ancien = await snapshot(db); repo.bindDatabase(autre);
        try { reponse.resolve(true); await travail; eq(await snapshot(autre), avant, '10.6 photo base : aucun fichier ni pointeur écrit dans la nouvelle base'); eq(await snapshot(db), ancien, '10.6 photo base : ancienne base intacte'); }
        finally { repo.bindDatabase(db); }
      });
    });
    for (const changement of ['principale', 'note', 'autre_recette']) await run(`après relecture ${changement}`, async (repo, db) => {
      const f = await fixturePhotosRemplacement(repo, db); let atteint = false, concurrent;
      const garde = { ...repo, saveBatch: async (batch, options) => {
        if (!atteint && options.fichiers?.length) {
          atteint = true;
          if (changement === 'principale') await db.mutate({ origin: 'remote', puts: { cook_history: [{ id: 'photo-audit-plus-recente', recipe_id: f.recipe.id, cooked_at: '2026-10-30', photos: [f.shas[3]], notes: 'Nouvelle cuisson' }] } });
          if (changement === 'note') await db.mutate({ origin: 'remote', puts: { cook_history: [{ ...f.cuisson, notes: 'Note tardive' }] } });
          if (changement === 'autre_recette') await db.mutate({ origin: 'remote', puts: { recipes: [{ id: 'photo-ailleurs', availability: 'reference_only', original_title: 'Autre plat' }], cook_history: [{ id: 'photo-h-ailleurs', recipe_id: 'photo-ailleurs', cooked_at: '2026-10-30', photos: [f.shas[3]] }] } });
          concurrent = await snapshot(db);
        }
        return repo.saveBatch(batch, options);
      } };
      const resultat = await modifierPhotoAffichee(f.recipe.id, f.attendu, { file: f.file }, { repo: garde });
      eq(atteint, true, `10.6 photo tardive ${changement} : course atteint le vrai commit`);
      if (changement === 'principale') {
        eq(resultat, { issue: 'refuse', raison: 'fiche_changee' }, '10.6 photo tardive : autre cuisson devenue principale refusée exactement');
        eq(await snapshot(db), concurrent, '10.6 photo tardive : cible ancienne, nouvelle cuisson et fichiers inchangés');
      } else {
        eq(resultat.issue, 'ok', `10.6 photo tardive ${changement} : modification indépendante ne bloque pas le remplacement`);
        eq((await repo.get('cook_history', f.cuisson.id)).photos, [f.shas[1], f.sha], `10.6 photo tardive ${changement} : photo ciblée remplacée`);
        if (changement === 'note') eq((await repo.get('cook_history', f.cuisson.id)).notes, 'Note tardive', '10.6 photo tardive : note concurrente intacte');
        else eq(await repo.get('cook_history', 'photo-h-ailleurs'), concurrent.cook_history.find(h => h.id === 'photo-h-ailleurs'), '10.6 photo tardive : autre recette intacte');
      }
    });
  } finally { for (const root of scene.children) root.dispose?.(); scene.remove(); setUiLocale(locale); setSyncState(sync); }
}
