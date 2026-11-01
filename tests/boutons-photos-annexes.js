import { renderPhotoGestion } from '../src/ui/photo-gestion.js';
import { monterMesPhotos } from '../src/ui/cuisson.js';
import { fixturePhotosRemplacement } from './audit-photos-remplacement.js';
import { withRepo } from './sync-fixture.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';

const differe = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setTimeout(r, 0));
const attendre = async fn => { const fin = performance.now() + 3000; while (performance.now() < fin) { if (await fn()) return true; await tick(); } throw new Error('État attendu non atteint'); };
const bouton = (root, texte) => [...root.querySelectorAll('button')].find(b => b.textContent.trim() === texte);
const input = () => document.querySelector('input[type=file]');
const annuler = () => input()?.dispatchEvent(new Event('cancel'));
const choisir = file => { const n = input(); Object.defineProperty(n, 'files', { value: [file], configurable: true }); n.dispatchEvent(new Event('change')); };
const snapshot = async db => Object.fromEntries(await Promise.all(['recipes','recipe_versions','cook_history','files','outbox'].map(async s => [s, await db.getAll(s)])));

// Le vrai helper reste utilisé ; seule la présentation du sélecteur système est simulée.
// Le témoin mesure l'ordre dans le geste, pas une autorisation de caméra Safari physique.
export async function runBoutonsPhotosAnnexesTests({ eq, ok }) {
  const locale = getUiLocale(), click = HTMLInputElement.prototype.click, scene = document.createElement('main');
  let ouvertures = 0;
  setUiLocale('fr'); document.body.append(scene);
  HTMLInputElement.prototype.click = function () { if (this.type === 'file') { ouvertures++; return; } return click.call(this); };
  const cas = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, `Photos annexes ${nom} : ${e.stack || e}`); } finally { annuler(); for (const d of document.querySelectorAll('dialog[data-role=dialogue-photos-cuisson]')) bouton(d, 'Annuler')?.click(); for (const n of scene.children) n.dispose?.(); scene.replaceChildren(); await tick(); } };
  async function monter(repo, f, genre, { gate = null, refus = false } = {}) {
    let captures = 0, capture = null, termine = 0, attendu = 0, portee = Promise.resolve(); const ecritures = [], messages = [];
    const r = { ...repo,
      capturerContexteRecette: (...args) => { captures++; return portee = repo.capturerContexteRecette(...args).then(async c => { capture = c; if (gate) await gate.promise; return c; }); },
      saveBatch: (batch, options) => { if (options?.recettes) ecritures.push(...options.recettes); return repo.saveBatch(batch, options); }
    };
    Object.defineProperty(r, 'db', { get: () => repo.db });
    const ctx = refus ? { proprietaireDonnees: 'autre-compte' } : {};
    const root = genre === 'recette'
      ? await renderPhotoGestion({ id: f.recipe.id }, {}, ctx, { repo: r, ctxF: {} })
      : await monterMesPhotos(f.recipe, [f.cuisson], { repo: r, ctxF: {}, ctx, toast: m => messages.push(m), apres: () => { termine++; } });
    scene.append(root);
    return { root, captures: () => captures, capture: () => capture, ecritures, messages,
      portee: () => portee, lancer: () => { attendu = termine + 1; const b = bouton(root, genre === 'recette' ? 'Prendre une photo' : 'Ajouter une photo à cette cuisson'); b.focus(); b.click(); },
      finit: () => genre === 'recette' ? root.attendreEcritures() : attendre(() => termine >= attendu),
      termine: () => termine
    };
  }
  try {
    await cas('recette ancienne sélection après nouvelle annulation', async (repo, db) => {
      const f = await fixturePhotosRemplacement(repo, db, { personnelle: false }), gate = differe(), vue = await monter(repo, f, 'recette', { gate }), avant = await snapshot(db);
      vue.lancer(); choisir(f.file); const premier = vue.finit(); await tick();
      vue.lancer(); eq(vue.captures(), 2, 'Photos recette : deuxième geste distinct pendant la première capture');
      annuler(); await vue.finit(); gate.resolve(); await premier;
      eq(await snapshot(db), avant, 'Photos recette : ancienne sélection ne ressuscite pas après annulation du nouveau geste');
      eq(vue.ecritures.length, 0, 'Photos recette : aucune transaction tardive de la tentative remplacée');
    });
    for (const genre of ['recette','cuisson']) {
      await cas(`${genre} annulation`, async (repo, db) => {
        const f = await fixturePhotosRemplacement(repo, db, { personnelle: genre === 'cuisson' }), gate = differe(), vue = await monter(repo, f, genre, { gate }), avant = await snapshot(db), n = ouvertures;
        vue.lancer();
        eq(ouvertures, n + 1, `Photos ${genre} : sélecteur ouvert dans le geste avant résolution de la capture`);
        eq(vue.captures(), 1, `Photos ${genre} : une seule capture commencée avant le choix`);
        // Sur le produit initial, libérer la capture permet de finir le scénario sans masquer le rouge d'ordre.
        if (!input()) { gate.resolve(); await attendre(input); }
        annuler(); await vue.finit();
        eq(input(), null, `Photos ${genre} : annulation nettoie le vrai input`);
        eq(await snapshot(db), avant, `Photos ${genre} : annulation sans fichier, modification ni outbox`);
        gate.resolve(); await tick(); const precedent = ouvertures; vue.lancer();
        eq(ouvertures, precedent + 1, `Photos ${genre} : seconde ouverture immédiate après annulation`);
        if (!input()) await attendre(input); annuler(); await vue.finit();
        eq(vue.captures(), 2, `Photos ${genre} : la seconde tentative possède sa propre capture`);
      });
      await cas(`${genre} JPEG`, async (repo, db) => {
        const f = await fixturePhotosRemplacement(repo, db, { personnelle: genre === 'cuisson' }), gate = differe(), vue = await monter(repo, f, genre, { gate }), avant = await snapshot(db), n = ouvertures;
        vue.lancer(); eq(ouvertures, n + 1, `Photos ${genre} JPEG : ouverture avant lecture terminée`);
        if (!input()) { gate.resolve(); await attendre(input); }
        choisir(f.file); await tick();
        eq(await snapshot(db), avant, `Photos ${genre} JPEG : aucune conservation avant la capture`);
        gate.resolve();
        if (genre === 'cuisson') {
          await attendre(() => document.querySelector('[data-role=dialogue-photos-cuisson] [data-role=photos-cuisson] img'));
          const d = document.querySelector('[data-role=dialogue-photos-cuisson]');
          await attendre(() => !bouton(d, 'Ajouter une photo de mon plat').disabled); bouton(d, 'Enregistrer').click();
        }
        await vue.finit();
        eq(genre === 'recette' ? (await repo.get('recipes', f.recipe.id)).photo_sha256 : (await repo.get('cook_history', f.cuisson.id)).photos.at(-1), f.sha, `Photos ${genre} JPEG : vrai fichier conservé sur la cible initiale`);
        ok((await repo.getFile(f.sha))?.blob instanceof Blob, `Photos ${genre} JPEG : octets réellement présents`);
        eq(vue.captures(), 1, `Photos ${genre} JPEG : aucune recapture après sélection`);
        ok(vue.ecritures.length > 0 && vue.ecritures.every(c => c === vue.capture()), `Photos ${genre} JPEG : même contexte transmis à la transaction`);
        eq(await repo.get('recipe_versions', f.version.id), f.version, `Photos ${genre} JPEG : original intact`);
      });
      await cas(`${genre} refus de capture puis annulation`, async (repo, db) => {
        const f = await fixturePhotosRemplacement(repo, db, { personnelle: genre === 'cuisson' }), vue = await monter(repo, f, genre, { refus: true }), avant = await snapshot(db), n = ouvertures;
        vue.lancer(); eq(ouvertures, n + 1, `Photos ${genre} refus : ouverture demandée sans attendre le rejet de portée`);
        await tick(); await tick(); annuler(); await vue.finit();
        eq(vue.captures(), 1, `Photos ${genre} refus : pas de recapture ni réadoption du compte`);
        eq(await snapshot(db), avant, `Photos ${genre} refus : aucune conservation ou outbox`);
        eq(vue.messages, [], `Photos ${genre} refus : annulation silencieuse même si capture rejetée`);
      });
      await cas(`${genre} compte changé après capture`, async (repo, db) => {
        const f = await fixturePhotosRemplacement(repo, db, { personnelle: genre === 'cuisson' }), gate = differe(), vue = await monter(repo, f, genre, { gate });
        vue.lancer(); if (!input()) { gate.resolve(); await attendre(input); }
        await attendre(() => vue.capture()); await db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'compte-suivant' }] } });
        const avant = await snapshot(db); choisir(f.file); gate.resolve();
        if (genre === 'cuisson') {
          await attendre(() => document.querySelector('[data-role=dialogue-photos-cuisson] [data-role=photos-cuisson] img'));
          const d = document.querySelector('[data-role=dialogue-photos-cuisson]'); await attendre(() => !bouton(d, 'Ajouter une photo de mon plat').disabled); bouton(d, 'Enregistrer').click();
          await attendre(() => !d.querySelector('[role=alert]').hidden && !bouton(d, 'Annuler').disabled); bouton(d, 'Annuler').click();
        }
        await vue.finit();
        eq(await snapshot(db), avant, `Photos ${genre} compte : zéro fichier ni écriture dans le nouveau compte`);
        eq(vue.captures(), 1, `Photos ${genre} compte : le refus garde la capture initiale`);
      });
      await cas(`${genre} vue retirée pendant capture`, async (repo, db) => {
        const f = await fixturePhotosRemplacement(repo, db, { personnelle: genre === 'cuisson' }), gate = differe(), vue = await monter(repo, f, genre, { gate }), avant = await snapshot(db);
        vue.lancer(); if (!input()) { gate.resolve(); await attendre(input); }
        choisir(f.file); vue.root.dispose?.(); vue.root.remove(); gate.resolve();
        if (genre === 'recette') await vue.finit(); else { await vue.portee(); await tick(); }
        eq(document.querySelector('[data-role=dialogue-photos-cuisson]'), null, `Photos ${genre} sortie : aucun dialogue tardif`);
        eq(await snapshot(db), avant, `Photos ${genre} sortie : aucune conservation après démontage`);
      });
    }
  } finally { annuler(); HTMLInputElement.prototype.click = click; scene.remove(); setUiLocale(locale); }
}
