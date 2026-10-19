// Tests du lot A « Importer une recette repérée », tâche 1 (spec docs/superpowers/specs/2026-10-18-import-cible-design.md, rév. 3.1) :
// schéma (DB_VERSION 4, magasin imports, K-9), primitives (db.mutate à conditions, repo.transitionner, saveBatch conditionné), archives
// tolérantes aux magasins ajoutés après le format 1 (Review Focus 1), vocabulaire fermé des fabricants (D-12), test statique « transitionner( ».
// Bases jetables seulement ; aucun réseau ; aucune écriture dans la bibliothèque de la personne.
import { withDatabase, rewriteArchive } from './backup.js';
import { withRepo } from './sync-fixture.js';
import { on } from '../src/core/bus.js';
import { resetClock } from '../src/sync/clock.js';
import { t } from '../src/core/i18n.js';

const DATE = '2026-10-18T00:00:00.000Z';
// Bibliothèque minimale et cohérente (relations vérifiées par inspectArchive) pour fabriquer des archives au vol.
const BIBLIO_MIN = {
  books: [{ id: 'b1', title: 'Livre', author: 'A', updated_at: DATE }],
  book_editions: [{ id: 'ed1', book_id: 'b1', language: 'fr', updated_at: DATE }],
  recipes: [{ id: 'rc1', edition_id: 'ed1', original_title: 'Tarte aux pommes', availability: 'reference_only', verification_state: 'unverified', updated_at: DATE }],
};

export async function runImportCibleTests({ eq, ok }) {
  // Ronde 1 : les suites antérieures laissent le plancher monotone de syncNow() poussé de plusieurs jours (heures serveur futures) ; ici
  // les horodatages posés sont ceux de l'instant réel, pour que toute assertion sur une durée (battement, purge) parte d'une horloge saine.
  resetClock();
  const run = async (name, test) => {
    try { await test(); }
    catch (error) { ok(false, `Import ciblé \u2014 ${name} : ${error?.name || 'Erreur'} \u2014 ${error?.message || String(error)}`); }
  };
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };

  // --- Schéma (spec § 3.1, § 3.7, K-9)
  const S = await import('../src/model/schema.js');
  eq(S.DB_VERSION, 4, 'schéma : DB_VERSION 4');
  const noms = Object.keys(S.STORES);
  eq([noms[noms.indexOf('assistant_config') + 1], noms[noms.indexOf('imports') + 1]], ['imports', 'settings'], 'schéma : imports juste après assistant_config, avant settings');
  eq(S.STORES.imports, { keyPath: 'id', indexes: [['edition_id', 'edition_id'], ['recipe_id', 'recipe_id'], ['status', 'status']] }, 'schéma : clé et index d’imports');
  eq([S.SYNC_STORES.at(-1), S.SYNC_STORES.length, S.ARCHIVE_DATA_STORES.includes('imports')], ['imports', 27, true], 'schéma : [dernier synchronisé, nombre de synchronisés, imports archivé]');
  eq(S.RELATIONS.filter(([c]) => c === 'imports').map(([, p, m]) => [p, m]).sort(), [['edition_id', 'book_editions'], ['scan_session_id', 'scan_sessions']], 'schéma : recipe_id et page_ids sont des pointeurs souples (hors RELATIONS)');
  eq(S.MAGASINS_AJOUTES_APRES_V1, ['imports'], 'schéma : magasins ajoutés après le format 1');
  eq(S.STATUTS_IMPORT, ['a_lancer', 'en_cours', 'a_verifier', 'enregistre', 'echec', 'ignore'], 'schéma : statuts du journal');

  // --- Montée 3 → 4 sur une base peuplée (spec § 7) : le seul chemin capable de rendre une bibliothèque illisible.
  const { Database } = await import('../src/core/db.js');
  const STORES_V3 = Object.fromEntries(Object.entries(S.STORES).filter(([n]) => n !== 'imports'));
  await run('montée 3 → 4', () => withDatabase(async (v3) => {
    const recette = { id: 'rc_v3', edition_id: null, original_title: 'Avant imports', availability: 'reference_only', updated_at: DATE };
    const livre = { id: 'b_v3', title: 'Livre v3', updated_at: DATE };
    await v3.mutate({ puts: { recipes: [recette], books: [livre] } });
    eq([v3.idb.version, v3.idb.objectStoreNames.contains('imports')], [3, false], 'montée : la base de départ est en v3, sans magasin imports');
    v3.idb.close(); v3.idb = null; // la montée a besoin de la base libre
    const v4 = new Database(v3.name, S.DB_VERSION, S.STORES);
    await v4.open();
    try {
      eq(v4.idb.version, S.DB_VERSION, 'montée : la base est passée à la version courante sans rejet');
      ok(v4.idb.objectStoreNames.contains('imports'), 'montée : le magasin imports est créé');
      eq([...v4.idb.transaction('imports').objectStore('imports').indexNames].sort(), ['edition_id', 'recipe_id', 'status'], 'montée : les trois index d’imports existent');
      eq([await v4.get('recipes', 'rc_v3'), await v4.get('books', 'b_v3')], [recette, livre], 'montée : la recette et le livre sont intacts, champ pour champ');
      eq(await v4.byIndex('imports', 'status', 'a_lancer'), [], 'montée : l’index status est utilisable');
    } finally { v4.idb.close(); v4.idb = null; }
  }, STORES_V3, 3));

  // --- db.mutate({ conditions }) : lecture, vérification, capture et écritures dans UNE transaction (spec § 3.6, I-10, Review Focus 3)
  await run('db.mutate conditions', () => withDatabase(async (db) => {
    await db.put('imports', { id: 'imp_1', status: 'a_lancer', updated_at: '2026-10-18T00:00:00.000Z' });
    await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] } });
    eq((await db.get('imports', 'imp_1')).status, 'en_cours', 'conditions : écrit quand le statut est attendu');
    let refus = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] }, puts: { recipes: [{ id: 'rc_non' }] } }); } catch (e) { refus = e; }
    eq([refus?.name, refus?.statut, await db.get('recipes', 'rc_non')], ['TransitionRefusee', 'en_cours', undefined], 'conditions : condition fausse → refus nommé, RIEN d’écrit, pas même les puts');
    eq([refus?.store, refus?.key], ['imports', 'imp_1'], 'conditions : le refus nomme le magasin et la clé');
    const entrees = []; db.onMutate = ({ puts, origin }) => { entrees.push([Object.keys(puts).sort(), origin]); return {}; };
    await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['en_cours'], patch: (c) => ({ status: 'a_verifier', appels: (c.appels || 0) + 1 }) }] }, puts: { recipes: [{ id: 'rc_x', availability: 'available' }] } });
    eq([entrees, (await db.get('recipes', 'rc_x'))?.id, (await db.get('imports', 'imp_1')).appels], [[[['imports', 'recipes'], 'local']], 'rc_x', 1], 'conditions : patch-fonction, puts et capture dans une seule transaction');
    db.onMutate = null;
    let absente = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_absente', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] } }); } catch (e) { absente = e; }
    eq([absente?.name, absente?.statut, await db.get('imports', 'imp_absente')], ['TransitionRefusee', undefined, undefined], 'conditions : fiche absente → refus nommé (statut indéfini), rien d’écrit');

    // Ronde 1 \u2014 K-6 sur le chemin conditionné : la garde noDelete (assistant_config porte un secret) précède l'écriture conditionnée ;
    // ni la suppression ni la transition ne sont écrites.
    await db.put('assistant_config', { id: 'llm', provider: 'none' });
    let garde = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['a_verifier'], patch: { status: 'enregistre' } }] }, deletes: { assistant_config: ['llm'] } }); } catch (e) { garde = e; }
    eq([/Suppression interdite/.test(garde?.message || ''), (await db.get('assistant_config', 'llm'))?.id, (await db.get('imports', 'imp_1')).status], [true, 'llm', 'a_verifier'], 'conditions (K-6) : une suppression sur assistant_config glissée dans une écriture conditionnée est refusée, la ligne est intacte et la transition n’est PAS écrite');
    // Ronde 1 \u2014 un patch ne change jamais la clé : sinon la fiche fusionnée s'écrirait À CÔTÉ de l'originale (deux lignes pour un import).
    let cle = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['a_verifier'], patch: { id: 'imp_autre', status: 'enregistre' } }] } }); } catch (e) { cle = e; }
    eq([cle?.name, (await db.get('imports', 'imp_1')).status, await db.get('imports', 'imp_autre')], ['TypeError', 'a_verifier', undefined], 'conditions : un patch qui change la clé est refusé (TypeError), rien d’écrit, aucune fiche dupliquée');
    // Ronde 1 \u2014 deux conditions sur la même fiche : la seconde écraserait la première en silence ; refusées.
    let doublon = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['a_verifier'], patch: { status: 'enregistre' } }, { key: 'imp_1', attendus: ['a_verifier'], patch: { n: 1 } }] } }); } catch (e) { doublon = e; }
    eq([doublon?.name, (await db.get('imports', 'imp_1')).status], ['TypeError', 'a_verifier'], 'conditions : deux conditions sur le même magasin/clé sont refusées (TypeError), rien d’écrit');
    // Ronde 1 \u2014 `attendus` : des chaînes non vides, au moins une. `[undefined]` laisserait passer une ligne SANS statut (reçue, restaurée).
    await db.put('imports', { id: 'imp_sans' });
    const formes = [];
    for (const attendus of [[undefined], [], ['a_lancer', ''], 'a_lancer', [null]]) {
      try { await db.mutate({ conditions: { imports: [{ key: 'imp_sans', attendus, patch: { status: 'en_cours' } }] } }); formes.push('écrit'); } catch (e) { formes.push(e.name); }
    }
    eq([formes, (await db.get('imports', 'imp_sans')).status], [['TypeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError'], undefined], 'conditions : attendus mal formés ([undefined], [], chaîne vide, pas un tableau, [null]) → TypeError, la ligne sans statut n’est jamais écrite');
    // Ronde 1 \u2014 le message du refus ne recopie pas un statut hostile en entier (la ligne vient de la base : reçue ou restaurée).
    const long = 'x'.repeat(50000);
    await db.put('imports', { id: 'imp_long', status: long });
    let eLong = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_long', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] } }); } catch (e) { eLong = e; }
    eq([eLong?.name, eLong?.statut?.length, (eLong?.message || '').length < 200], ['TransitionRefusee', 50000, true], 'conditions : le refus garde le statut lu en propriété, son message est borné (80 points de code)');
    // Ronde 1 \u2014 `conditions: null` (option facultative non renseignée) vaut « aucune condition » : écriture ordinaire.
    await db.mutate({ puts: { imports: [{ id: 'imp_nul', status: 'a_lancer' }] }, conditions: null });
    eq((await db.get('imports', 'imp_nul'))?.status, 'a_lancer', 'conditions : null vaut « aucune condition », l’écriture ordinaire passe');
    // Ronde 1 de la tâche 3 : deux formes de plus, pour qu'une CRÉATION soit conditionnée comme une transition (I-10, I-2) — « absente » (la fiche n'existe pas :
    // jamais d'écrasement, quel que soit son statut) et « index / valeur / exclus » (aucune fiche de l'index à cette valeur n'a un statut exclu).
    { let occupee = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_1', absente: true }] }, puts: { recipes: [{ id: 'rc_abs' }], imports: [{ id: 'imp_1', status: 'a_lancer' }] } }); } catch (e) { occupee = e; }
      await db.mutate({ conditions: { imports: [{ key: 'imp_neuve', absente: true }] }, puts: { imports: [{ id: 'imp_neuve', status: 'a_lancer', recipe_id: 'rc_i' }] } });
      eq([occupee?.name, occupee?.store, occupee?.key, occupee?.statut, (await db.get('imports', 'imp_1')).status, await db.get('recipes', 'rc_abs'), (await db.get('imports', 'imp_neuve'))?.status], ['TransitionRefusee', 'imports', 'imp_1', 'a_verifier', 'a_verifier', undefined, 'a_lancer'], 'conditions « absente » : une fiche qui existe (a_verifier) refuse — rien d’écrit, pas même les puts, la fiche intacte ; une clé libre laisse écrire');
      let doublee = null; try { await db.mutate({ conditions: { imports: [{ index: 'recipe_id', valeur: 'rc_i', exclus: ['a_lancer', 'en_cours'] }] }, puts: { imports: [{ id: 'imp_bis', status: 'a_lancer', recipe_id: 'rc_i' }] } }); } catch (e) { doublee = e; }
      await db.mutate({ conditions: { imports: [{ index: 'recipe_id', valeur: 'rc_i', exclus: ['enregistre'] }, { index: 'recipe_id', valeur: 'rc_libre', exclus: ['a_lancer'] }] }, puts: { imports: [{ id: 'imp_ter', status: 'echec', recipe_id: 'rc_i' }] } });
      eq([doublee?.name, doublee?.store, doublee?.key, doublee?.statut, await db.get('imports', 'imp_bis'), (await db.get('imports', 'imp_ter'))?.status], ['TransitionRefusee', 'imports', 'recipe_id=rc_i', 'a_lancer', undefined, 'echec'], 'conditions « index » : une fiche de l’index recipe_id=rc_i au statut exclu (a_lancer) refuse, nommée par index=valeur ; aucun statut exclu (ou aucune fiche à cette valeur) laisse écrire');
      const formes = [];
      for (const c of [{ key: 'k', absente: true, attendus: ['a'] }, { key: 'k', absente: true, patch: { x: 1 } }, { index: 'recipe_id', valeur: 'x' }, { index: 'recipe_id', valeur: 'x', exclus: [] }, { index: 'recipe_id', valeur: 'x', exclus: [''] }, { index: 'recipe_id', key: 'k', valeur: 'x', exclus: ['a'] }, { index: 'recipe_id', exclus: ['a'] }, { index: 'recipe_id', valeur: 'x', exclus: ['a'] }, { index: 'recipe_id', valeur: 'x', exclus: ['a'] }]) {
        try { await db.mutate({ conditions: { imports: [c] } }); formes.push('écrit'); } catch (e) { formes.push(e.name); }
      }
      eq(formes, ['TypeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError', 'écrit', 'écrit'], 'conditions : « absente » avec attendus ou patch, index sans valeur, sans exclus, exclus vide ou blanc, index avec clé, index sans valeur → TypeError ; une forme d’index bien formée sur une valeur libre passe');
      let deuxIndex = null; try { await db.mutate({ conditions: { imports: [{ index: 'recipe_id', valeur: 'x', exclus: ['a'] }, { index: 'recipe_id', valeur: 'x', exclus: ['b'] }] } }); } catch (e) { deuxIndex = e; }
      eq(deuxIndex?.name, 'TypeError', 'conditions : deux conditions d’index sur la même valeur sont refusées, comme deux conditions sur la même fiche'); }
    // Ronde 1 \u2014 le chemin conditionné rend les fiches fusionnées, par magasin (l'écran n'a pas à relire la base dans une autre transaction).
    const rendu = await db.mutate({ conditions: { imports: [{ key: 'imp_nul', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] } });
    eq([rendu, await db.get('imports', 'imp_nul')], [{ imports: [{ id: 'imp_nul', status: 'en_cours' }] }, { id: 'imp_nul', status: 'en_cours' }], 'conditions : db.mutate rend les fiches fusionnées par magasin, égales à ce qui est écrit');

    await db.put('imports', { id: 'imp_2', status: 'echec' });
    const res = await Promise.allSettled([1, 2].map(() => db.mutate({ conditions: { imports: [{ key: 'imp_2', attendus: ['echec'], patch: { status: 'en_cours' } }] } })));
    eq(res.map((x) => x.status).sort(), ['fulfilled', 'rejected'], 'conditions (Review Focus 3) : deux transitions entrelacées, une seule écrit');
    eq(res.find((x) => x.status === 'rejected')?.reason?.name, 'TransitionRefusee', 'conditions (Review Focus 3) : la seconde est refusée par son nom, pas par un rejet générique');
  }));

  // --- repo.transitionner et repo.saveBatch(…, { conditions }) : nettoyage, horodatage, change, capture (spec § 3.6)
  await run('repo.transitionner', () => withRepo(async (repo, db) => {
    await db.mutate({ puts: { imports: [{ id: 'imp_t', status: 'a_lancer', created_at: DATE, updated_at: DATE }], assistant_config: [{ id: 'llm', provider: 'none' }] }, origin: 'device' }); // hors capture : seule la transition doit entrer en file
    const notifs = [];
    let off = on('change', (p) => notifs.push(p));
    let rendu;
    try {
      rendu = await repo.transitionner('imports', 'imp_t', { attendus: ['a_lancer'], patch: { status: 'en_cours', erreur: { raison: 'x\u0007' } }, puts: { recipes: [{ id: 'rc_t', availability: 'available', original_title: 'T\u0007' }] } });
    } finally { off(); }
    const apres = await db.get('imports', 'imp_t');
    const rc = await db.get('recipes', 'rc_t');
    eq([apres.status, apres.erreur, apres.updated_at > DATE, apres.created_at], ['en_cours', { raison: 'x' }, true, DATE], 'transitionner : patch appliqué, chaînes de contrôle retirées, updated_at posé, created_at conservé');
    eq(rendu, apres, 'transitionner : rend la fiche écrite (égale à la relecture), sans seconde transaction (ronde 1)');
    eq([rc?.original_title, typeof rc?.updated_at, rc?.created_at === rc?.updated_at], ['T', 'string', true], 'transitionner : les puts sont nettoyés et horodatés comme par saveBatch');
    eq(notifs, [{ store: 'imports', id: 'imp_t' }, { store: 'recipes' }], 'transitionner : un change pour la fiche conditionnée, puis un par magasin des puts (comme saveBatch) \u2014 ronde 1');
    eq((await db.getAll('outbox')).map((e) => [e.store, e.id, e.op]).sort(), [['imports', 'imp_t', 'put'], ['recipes', 'rc_t', 'put']], 'transitionner : la capture voit la fiche conditionnée ET les puts (même transaction)');
    let refus = null;
    try { await repo.transitionner('imports', 'imp_t', { attendus: ['a_lancer'], patch: { status: 'echec' }, puts: { recipes: [{ id: 'rc_non', availability: 'available' }] } }); } catch (e) { refus = e; }
    eq([refus?.name, refus?.store, refus?.key, refus?.statut, (await db.get('imports', 'imp_t')).status, await db.get('recipes', 'rc_non'), (await db.getAll('outbox')).length], ['TransitionRefusee', 'imports', 'imp_t', 'en_cours', 'en_cours', undefined, 2], 'transitionner : condition fausse → TransitionRefusee nommée, rien d’écrit, rien en file');
    // Ronde 1 \u2014 K-6 par repo.transitionner : la garde noDelete tient aussi derrière l'enveloppe du repo.
    let garde = null;
    try { await repo.transitionner('imports', 'imp_t', { attendus: ['en_cours'], patch: { status: 'echec' }, deletes: { assistant_config: ['llm'] } }); } catch (e) { garde = e; }
    eq([/Suppression interdite/.test(garde?.message || ''), (await db.get('assistant_config', 'llm'))?.id, (await db.get('imports', 'imp_t')).status, (await db.getAll('outbox')).length], [true, 'llm', 'en_cours', 2], 'transitionner (K-6) : une suppression sur assistant_config est refusée, la ligne intacte, la transition non écrite, rien en file');
    // Ronde 1 \u2014 sans puts, UN seul change ; et `payloads` traverse : une suppression passée par transitionner est capturée AVEC sa copie (spec § 5.1).
    const notifs2 = [];
    off = on('change', (p) => notifs2.push(p));
    try { await repo.transitionner('imports', 'imp_t', { attendus: ['en_cours'], patch: (c) => ({ appels: (c.appels || 0) + 1 }) }); } finally { off(); }
    eq([notifs2, (await db.get('imports', 'imp_t')).appels], [[{ store: 'imports', id: 'imp_t' }], 1], 'transitionner : sans puts ni deletes, un abonné change est notifié une fois');
    await repo.transitionner('imports', 'imp_t', { attendus: ['en_cours'], patch: {}, deletes: { recipes: ['rc_t'] }, payloads: { recipes: { rc_t: rc } } });
    const tombale = (await db.getAll('outbox')).find((e) => e.op === 'delete');
    eq([await db.get('recipes', 'rc_t'), tombale?.store, tombale?.id, tombale?.payload], [undefined, 'recipes', 'rc_t', rc], 'transitionner : `payloads` est relayé à la capture \u2014 la tombale porte la copie de la fiche supprimée');
    // saveBatch conditionné : vérification seule.
    let refus2 = null;
    try { await repo.saveBatch({ imports: [{ id: 'imp_s', status: 'a_lancer' }] }, { conditions: { imports: [{ key: 'imp_t', attendus: ['a_lancer'] }] } }); } catch (e) { refus2 = e; }
    eq([refus2?.name, await db.get('imports', 'imp_s')], ['TransitionRefusee', undefined], 'saveBatch conditionné : condition fausse → refus nommé, rien d’écrit');
    const avantLot = await db.get('imports', 'imp_t');
    await repo.saveBatch({ imports: [{ id: 'imp_s', status: 'a_lancer' }] }, { conditions: { imports: [{ key: 'imp_t', attendus: ['en_cours'] }] } });
    const s = await db.get('imports', 'imp_s');
    eq([s?.status, typeof s?.updated_at, (await db.get('imports', 'imp_t')).updated_at === avantLot.updated_at], ['a_lancer', 'string', true], 'saveBatch conditionné : condition vraie → le lot est écrit et horodaté ; la fiche vérifiée sans patch n’est pas réécrite');
    // Ronde 1 \u2014 un patch glissé dans une condition de saveBatch contournerait `propre` et `updated_at` : refusé AVANT toute écriture.
    let patchRefuse = null;
    const enFile = (await db.getAll('outbox')).length;
    try { await repo.saveBatch({ imports: [{ id: 'imp_s2', status: 'a_lancer' }] }, { conditions: { imports: [{ key: 'imp_t', attendus: ['en_cours'], patch: { status: 'echec' } }] } }); } catch (e) { patchRefuse = e; }
    eq([patchRefuse?.name, /transitionner/.test(patchRefuse?.message || ''), await db.get('imports', 'imp_s2'), (await db.get('imports', 'imp_t')).status, (await db.getAll('outbox')).length], ['TypeError', true, undefined, 'en_cours', enFile], 'saveBatch conditionné : un patch est refusé (TypeError qui renvoie à repo.transitionner), rien d’écrit, rien en file');
    eq(typeof db.transitionner, 'undefined', 'une seule primitive : db.transitionner n’existe pas');
    // Ronde 1 \u2014 getData charge le magasin imports (ctx.imports pour l'écran de la tâche 4).
    const { getData } = await import('../src/ui/state.js');
    eq((await getData(true)).imports.map((i) => i.id).sort(), ['imp_s', 'imp_t'], 'getData : le cache de lecture charge le magasin imports');
  }));

  // --- Test statique : transitionner( n'existe que dans repo.js et, ailleurs, sous la forme repo.transitionner( (spec § 7, I-10)
  await run('statique transitionner(', async () => {
    const sw = await lire('../sw.js');
    const modules = [...sw.matchAll(/'\.\/(src\/[^']+\.js)'/g)].map((m) => m[1]);
    ok(modules.length > 30, 'statique : SHELL lu (' + modules.length + ' modules) avant de conclure');
    const fautifs = [];
    let dansRepo = 0;
    for (const m of modules) {
      const src = await lire('../' + m);
      for (const x of src.matchAll(/transitionner\(/g)) {
        if (m === 'src/model/repo.js') { dansRepo += 1; continue; }
        if (src.slice(Math.max(0, x.index - 5), x.index) !== 'repo.') fautifs.push(`${m}:${x.index}`);
      }
    }
    ok(dansRepo >= 1, 'statique : repo.js définit transitionner(');
    eq(fautifs, [], 'statique : hors repo.js, transitionner( n’apparaît que sous la forme repo.transitionner(');
  });

  // --- Archives (spec § 3.7, Review Focus 1) : une archive FAITE AVANT LE LOT (format 1, sans data/imports.json) se restaure.
  const { createArchive, inspectArchive, applyArchive, verifyRestored } = await import('../src/domain/backup.js');
  await run('archive réelle 0.8.1 sans imports', async () => {
    const r = await fetch(new URL('./fixtures/archive-0.8.1-sans-imports.zip', import.meta.url), { cache: 'no-store' });
    if (!r.ok) throw new Error('fixture : HTTP ' + r.status);
    const insp = await inspectArchive(await r.arrayBuffer());
    eq([insp.manifest?.app_version, insp.manifest?.format_version, insp.manifest?.data_files?.some((d) => d.store === 'imports'), 'imports' in (insp.manifest?.counts || {})], ['0.8.1', 1, false, false], 'fixture : archive réelle de 0.8.1, format 1, sans data/imports.json ni counts.imports');
    eq(insp.errors, [], 'fixture (Review Focus 1) : l’archive d’avant le lot passe l’inspection');
    ok(insp.ok && insp.payload?.stores.recipes?.length === 2, 'fixture : inspection ok, deux recettes (une référence, une disponible)');
    for (const mode of ['merge', 'replace']) {
      await withDatabase(async (db) => {
        // Une ligne imports LOCALE préexistante : la fusion la garde, le remplacement la vide (l'archive n'en porte aucune) \u2014 ronde 1.
        const locale = { id: 'imp_avant', status: 'echec', updated_at: DATE };
        await db.put('imports', locale);
        await applyArchive(db, insp, { mode });
        eq((await verifyRestored(db, insp, { mode })).diffs, [], `fixture (Review Focus 1) : restauration en ${mode} sans écart`);
        eq(await db.getAll('imports'), mode === 'merge' ? [locale] : [], `fixture : après restauration en ${mode}, imports vaut ${mode === 'merge' ? '[la ligne locale]' : '[]'}`);
        eq([(await db.get('recipes', 'rc_fix_ref'))?.availability, (await db.get('recipes', 'rc_fix_dispo'))?.current_version_id], ['reference_only', 'rv_fix'], `fixture : les recettes sont restaurées (${mode})`);
      });
    }
  });
  await run('archives au vol (rewriteArchive)', () => withDatabase(async (source) => {
    await source.putBatch(BIBLIO_MIN);
    const archive = await createArchive(source);
    ok(archive.manifest.data_files.some((d) => d.store === 'imports') && archive.manifest.counts.imports === 0, 'archive courante : data/imports.json et counts.imports présents (ce que la réécriture retire)');
    const sans = await rewriteArchive(archive.blob, ({ manifest, entries }) => {
      manifest.data_files = manifest.data_files.filter((d) => d.store !== 'imports');
      entries.delete('data/imports.json');
      delete manifest.counts.imports;
    });
    const insp = await inspectArchive(sans);
    eq(insp.errors, [], 'archive au vol sans imports : acceptée');
    await withDatabase(async (cible) => {
      await applyArchive(cible, insp, { mode: 'merge' });
      eq([(await verifyRestored(cible, insp, { mode: 'merge' })).ok, await cible.getAll('imports'), (await cible.get('recipes', 'rc1'))?.original_title], [true, [], 'Tarte aux pommes'], 'archive au vol sans imports : restaurée, imports vaut []');
    });
    // Aller-retour AVEC une ligne imports : archivée, comptée, retrouvée telle quelle.
    const ligne = { id: 'imp_ar', kind: 'recette', edition_id: 'ed1', recipe_id: 'rc1', scan_session_id: null, page_ids: ['pg_absente'], status: 'a_verifier', updated_at: DATE };
    await source.put('imports', ligne);
    const insp2 = await inspectArchive(await (await createArchive(source)).blob.arrayBuffer());
    eq([insp2.ok, insp2.errors, insp2.manifest?.counts.imports], [true, [], 1], 'aller-retour : une ligne imports est archivée et comptée ; recipe_id et page_ids ne sont pas des relations (une page absente ne bloque pas)');
    await withDatabase(async (cible) => {
      await applyArchive(cible, insp2, { mode: 'replace' });
      eq([await cible.get('imports', 'imp_ar'), (await verifyRestored(cible, insp2, { mode: 'replace' })).ok], [ligne, true], 'aller-retour : la ligne imports est retrouvée telle quelle');
    });
    // Une ligne imports dont l'édition manque est une relation cassée : refusée comme les autres.
    await source.put('imports', { ...ligne, id: 'imp_orpheline', edition_id: 'ed_absente' });
    const insp3 = await inspectArchive(await (await createArchive(source)).blob.arrayBuffer());
    ok(!insp3.ok && insp3.errors.some((e) => e.startsWith('imports.edition_id → book_editions ed_absente')), 'archive : imports.edition_id est une relation vérifiée');
    // data/recipes.json absent : toujours refusé, nommé.
    const sansRecettes = await rewriteArchive(archive.blob, ({ manifest, entries }) => {
      manifest.data_files = manifest.data_files.filter((d) => d.store !== 'recipes');
      entries.delete('data/recipes.json');
      delete manifest.counts.recipes;
    });
    const insp4 = await inspectArchive(sansRecettes);
    ok(!insp4.ok && insp4.errors.includes('Magasin absent ou invalide : recipes'), 'archive sans data/recipes.json : toujours refusée, nommée');
  }));
  // Ronde 1 \u2014 C1 au sens « base » : une base ouverte avec un STORES d'avant (sans le magasin imports) s'archive quand même, imports vaut [].
  await run('createArchive sur une base sans le magasin imports', () => withDatabase(async (v3) => {
    await v3.putBatch(BIBLIO_MIN);
    const a = await createArchive(v3);
    eq([a.manifest.counts.imports, a.manifest.data_files.some((d) => d.store === 'imports'), (await inspectArchive(await a.blob.arrayBuffer())).ok], [0, true, true], 'archive : une base sans le magasin imports (STORES d’avant, version 3) s’archive avec data/imports.json vide et counts.imports 0');
  }, STORES_V3, 3));

  // --- Vocabulaire (spec § 3.3, D-12) : une fonction pure appelée par les fabricants, jamais un mur dans db.mutate.
  await run('vocabulaire', async () => {
    const V = await import('../src/domain/vocabulaire.js');
    let e = null; try { V.assertVocabulaire({ availability: 'dispo' }, 'recipes'); } catch (x) { e = x; }
    eq([e?.name, e?.champ, e?.valeur], ['ErreurVocabulaire', 'availability', 'dispo'], 'vocabulaire : valeur hors liste refusée, nommée');
    eq(e?.magasin, 'recipes', 'vocabulaire : l’erreur nomme le magasin');
    e = null; try { V.assertVocabulaire({ verification_state: 'ok' }, 'recipes'); } catch (x) { e = x; } eq(e?.champ, 'verification_state', 'vocabulaire : état de vérification hors liste refusé');
    eq(V.assertVocabulaire({ original_title: 'x' }, 'recipes'), true, 'vocabulaire : champ absent toléré, rend true');
    eq(V.assertVocabulaire({ availability: null, verification_state: null }, 'recipes'), true, 'vocabulaire : null vaut absent pour une recette (fiche ancienne, chemin adaptation) \u2014 ronde 1');
    eq(V.assertVocabulaire({ availability: 'available', verification_state: 'to_verify' }, 'recipes'), true, 'vocabulaire : valeurs de la liste acceptées');
    e = null; try { V.assertVocabulaire({ status: 'fini' }, 'imports'); } catch (x) { e = x; } eq(e?.champ, 'status', 'vocabulaire : statut d’import hors liste refusé');
    e = null; try { V.assertVocabulaire({ id: 'imp' }, 'imports'); } catch (x) { e = x; } eq(e?.champ, 'status', 'vocabulaire : un import sans statut est refusé (le statut est obligatoire)');
    eq(V.assertVocabulaire({ status: 'a_lancer' }, 'imports'), true, 'vocabulaire : statut d’import de la liste accepté');
    eq(V.assertVocabulaire({ status: 'nimporte' }, 'books'), true, 'vocabulaire : magasin sans vocabulaire fermé → rien à vérifier');
    // Test de source (faible, admis) : chaque fabricant de `recipes` appelle assertVocabulaire( HORS commentaire \u2014 un appel commenté ne compte
    // pas (ronde 1). Quatre fabricants aujourd'hui : création IA, signet, éditeur, « Créer les références » du panneau d'index.
    const sansCommentaires = (s) => s.replace(/\/\/.*$/gm, '');
    // Tâche 3 : fabriquerExtraction (src/domain/import-cible.js) est le cinquième fabricant épinglé (spec § 3.3 : « appelée par fabriquerExtraction »).
    const fabricants = ['../src/domain/creation-ia.js', '../src/ui/signet.js', '../src/ui/recipe-edit.js', '../src/ui/import.js', '../src/domain/import-cible.js'];
    const appels = await Promise.all(fabricants.map(async (f) => (sansCommentaires(await lire(f)).match(/assertVocabulaire\(/g) || []).length >= 1));
    eq(appels, [true, true, true, true, true], 'vocabulaire : les cinq fabricants (dont fabriquerExtraction de import-cible.js) appellent assertVocabulaire( hors commentaire (test de source, faible, admis)');
    // Fiche valide par comportement : le fabricant du signet (pur) rend une fiche du vocabulaire \u2014 valeurs codées en dur, ne prouve PAS l'appel.
    const { fabriquerSignet, signetModel } = await import('../src/ui/signet.js');
    const m = signetModel({ adresse: 'https://exemple.test/recette', titre: 'Signet' });
    eq(V.assertVocabulaire(fabriquerSignet(m, { newId: (p) => p + '_1', langue: 'fr' }), 'recipes'), true, 'vocabulaire : la fiche rendue par fabriquerSignet est une fiche valide du vocabulaire');
  });

  // =====================================================================================================================================
  // Tâche 3 \u2014 domaine pur de l'import ciblé (spec § 3.1 transitions, § 4.3.3 discordance, § 4.3.4 fabrication, § 4.5 âge, § 4.1 séance exclue)
  await run('domaine import-cible : transitions, discordance, ordre, âge', async () => {
    const D = await import('../src/domain/import-cible.js');
    for (const de of Object.keys(D.TRANSITIONS)) for (const vers of Object.keys(D.TRANSITIONS)) eq(D.transitionPermise(de, vers), D.TRANSITIONS[de].includes(vers), `transitions : ${de} → ${vers}`);
    eq(D.TRANSITIONS, { a_lancer: ['en_cours', 'ignore'], en_cours: ['a_verifier', 'echec'], a_verifier: ['enregistre', 'a_lancer', 'ignore'], echec: ['en_cours', 'a_lancer', 'ignore'], enregistre: [], ignore: [] }, 'transitions : la table exacte de la spec');
    eq([D.transitionPermise('inconnu', 'en_cours'), D.transitionPermise('a_lancer', 'inconnu'), D.transitionPermise(undefined, 'ignore'), D.transitionPermise('constructor', 'ignore')], [false, false, false, false], 'transitions : un état inconnu (ou une clé héritée) ne permet rien');
    eq([Object.isFrozen(D.TRANSITIONS), Object.values(D.TRANSITIONS).every((v) => Object.isFrozen(v))], [true, true], 'transitions (ronde 1) : la table ET chacun de ses tableaux sont gelés \u2014 un push sur a_lancer lève au lieu de changer les transitions de toute l’app');
    eq(D.MOTS_VIDES, ['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'au', 'aux', 'à', 'et', 'en', 'un', 'une', 'ma', 'mon', 'mes', 'ta', 'ton', 'tes', 'sa', 'son', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'the', 'of', 'and', 'with', 'a', 'an', 'my', 'your', 'our'], 'discordance : la liste fermée des mots vides de la spec § 4.3.3, possessifs compris');
    eq(D.motsDistinctifs('Tarte aux pommes de ma grand-mère'), ['tarte', 'pommes', 'grand', 'mere'], 'discordance : mots vides et possessifs retirés, accents aplatis, trait d’union coupé');
    eq(D.motsDistinctifs("Soupe à l'oignon"), ['soupe', 'oignon'], 'discordance : apostrophe coupée');
    eq(D.motsDistinctifs('Soupe à l’oignon. The Best!'), ['soupe', 'oignon', 'best'], 'discordance : apostrophe typographique, point et point d’exclamation coupés (toute ponctuation est un séparateur, ronde 1), mots vides anglais retirés');
    eq(D.motsDistinctifs('Tarte (grand\u2011mère) \u2013 pommes, poires\u2014et « noix » : 2 \u2015 3'), ['tarte', 'grand', 'mere', 'pommes', 'poires', 'noix', '2', '3'], 'discordance (ronde 1) : tirets Unicode U+2011, U+2013, U+2014, U+2015, parenthèses, virgule, guillemets et deux-points coupent \u2014 jamais collés à un mot');
    eq([D.motsDistinctifs(''), D.motsDistinctifs(null), D.motsDistinctifs('de la')], [[], [], []], 'discordance : titre vide, nul ou fait de mots vides → aucun mot distinctif');
    eq([D.discordance({ title: 'Soupe à l’ail' }, { original_title: '' }).raison, D.discordance({ title: 'Soupe à l’ail' }, { original_title: 'De la' }).raison, D.discordance({ title: 'Soupe à l’ail' }, undefined).raison, D.discordance({ title: 'Soupe à l’ail' }, null).raison, D.discordance({ title: 'Soupe à l’ail' }, { original_title: 7 }).raison], ['titre', 'titre', 'titre', 'titre', 'titre'], 'discordance (ronde 1) : une référence SANS mot distinctif (titre vide, fait de mots vides, absente, non chaîne) est une discordance de titre \u2014 jamais une concordance par vérité vide');
    const ref = { original_title: 'Tarte aux pommes', printed_page: 132 };
    eq(D.discordance({ title: 'Tarte aux poires', printed_page: 133 }, ref).raison, 'titre', 'discordance (Review Focus 2) : poires sur pommes → dialogue');
    eq(D.discordance({ title: 'Soupe à l’ail', printed_page: null }, { original_title: 'Soupe à l’oignon', printed_page: null }).raison, 'titre', 'discordance : ail sur oignon → dialogue');
    eq(D.discordance({ title: 'Tarte aux pommes de ma grand-mère', printed_page: 132 }, ref).ok, true, 'discordance : titre plus long qui contient tous les mots → concordant');
    eq(D.discordance({ title: 'TARTE AUX POMMES', printed_page: 136 }, ref).raison, 'page', 'discordance : page à plus de 3 → dialogue');
    eq(D.discordance({ title: 'TARTE AUX POMMES', printed_page: 135 }, ref), { ok: true, raison: null, titreLu: 'TARTE AUX POMMES', pageLue: 135 }, 'discordance : casse ignorée, page à 3 exactement → concordant, verdict complet { ok, raison, titreLu, pageLue }');
    eq(D.discordance({ title: 'Tarte aux pommes', printed_page: null }, ref).ok, true, 'discordance : page lue nulle → le critère de page ne joue pas');
    eq(D.discordance({ title: 'Tarte aux pommes', printed_page: 200 }, { original_title: 'Tarte aux pommes', printed_page: null }).ok, true, 'discordance : page de la référence inconnue → le critère de page ne joue pas');
    eq(D.discordance({ title: null, printed_page: 132 }, ref).raison, 'titre_nul', 'discordance : titre illisible → dialogue');
    eq([D.discordance({ title: '   ', printed_page: 132 }, ref).raison, D.discordance({}, ref).raison, D.discordance({ title: 7 }, ref).raison], ['titre_nul', 'titre_nul', 'titre_nul'], 'discordance : titre blanc, absent ou non chaîne → titre_nul');
    eq(D.discordance({ title: 'Tarte aux poires', printed_page: 140 }, ref).raison, 'titre', 'discordance : le titre est jugé avant la page');
    eq([D.discordance({ title: 'Tarte, aux pommes !', printed_page: 132 }, ref).ok, D.discordance({ title: 'Tarte aux pommes', printed_page: 132 }, { original_title: 'Tarte (aux pommes)', printed_page: 132 }).ok], [true, true], 'discordance (ronde 1) : la ponctuation d’un côté ou de l’autre ne fait pas un faux dialogue (« Tarte, aux pommes ! », « Tarte (aux pommes) »)');
    eq(D.deplacerPage(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b'], 'ordre : monter'); eq(D.deplacerPage(['a', 'b'], 'a', -1), ['a', 'b'], 'ordre : monter en tête ne change rien');
    eq([D.deplacerPage(['a', 'b', 'c'], 'a', 1), D.deplacerPage(['a', 'b', 'c'], 'c', 1), D.deplacerPage(['a', 'b', 'c'], 'z', -1), D.retirerPage(['a', 'b', 'c'], 'b'), D.retirerPage(['a', 'b', 'c'], 'z')], [['b', 'a', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'c'], ['a', 'b', 'c']], 'ordre : descendre, descendre en queue et page inconnue sans effet ; retirer une page, retirer une page inconnue sans effet');
    { const source = ['a', 'b']; const r1 = D.deplacerPage(source, 'b', -1); const r2 = D.retirerPage(source, 'a'); eq([source, r1 !== source, r2 !== source], [['a', 'b'], true, true], 'ordre : deplacerPage et retirerPage rendent un NOUVEAU tableau, le tableau donné n’est jamais modifié'); }
    eq(D.ageDepuis('2026-10-18T10:00:00Z', '2026-10-18T12:30:00Z'), { n: 2, unite: 'h' }, 'âge : heures, valeur structurée');
    eq([D.ageDepuis('2026-10-18T10:00:00Z', '2026-10-18T10:05:30Z'), D.ageDepuis('2026-10-18T10:00:00Z', '2026-10-18T10:59:59Z'), D.ageDepuis('2026-10-18T10:00:00Z', '2026-10-18T11:00:00Z'), D.ageDepuis('2026-10-15T10:00:00Z', '2026-10-18T12:30:00Z'), D.ageDepuis('2026-10-17T10:00:00Z', '2026-10-18T09:59:00Z')], [{ n: 5, unite: 'min' }, { n: 59, unite: 'min' }, { n: 1, unite: 'h' }, { n: 3, unite: 'j' }, { n: 23, unite: 'h' }], 'âge : minutes sous l’heure, heures sous le jour, jours ensuite, arrondis vers le bas');
    eq([D.ageDepuis('2026-10-18T10:00:00Z', '2026-10-18T09:00:00Z'), D.ageDepuis('pas une date', '2026-10-18T09:00:00Z'), D.ageDepuis(null, '2026-10-18T09:00:00Z'), D.ageDepuis('2026-10-18T10:00:00Z', new Date('2026-10-18T10:03:00Z'))], [{ n: 0, unite: 'min' }, { n: 0, unite: 'min' }, { n: 0, unite: 'min' }, { n: 3, unite: 'min' }], 'âge : horloge en avance ou date illisible → 0 min (jamais négatif, jamais NaN) ; « maintenant » accepte une Date');
    eq(D.RAISONS_ECHEC, ['non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'coupe', 'illisible', 'hors_bornes', 'vide', 'interrompu', 'incertain'], 'raisons d’échec : la liste fermée § 4.4 \u2014 celles de la passerelle (echecDomaine : un 413 est `requete` + extra trop_lourd, jamais une raison), puis annule, coupe, illisible, hors_bornes, vide, interrompu, incertain');
    ok(Object.isFrozen(D.RAISONS_ECHEC) && !D.RAISONS_ECHEC.includes('trop_lourd'), 'raisons d’échec (ronde 1) : aucune valeur morte \u2014 trop_lourd n’est produit par aucun chemin');
    // Séance exclue des rappels génériques (spec § 4.1, N3) : import ciblé = kind recette AVEC recipe_id, non terminé, même séance.
    const seance = { id: 'ss1' };
    const imp = (over = {}) => ({ id: 'imp', kind: 'recette', recipe_id: 'rc1', scan_session_id: 'ss1', status: 'a_lancer', ...over });
    eq(['a_lancer', 'en_cours', 'a_verifier', 'echec'].map((status) => D.seanceDUnImportCible(seance, [imp({ status })])), [true, true, true, true], 'séance d’un import ciblé : vrai pour un import ciblé non terminé (a_lancer, en_cours, a_verifier, echec)');
    eq([D.seanceDUnImportCible(seance, [imp({ kind: 'index' })]), D.seanceDUnImportCible(seance, [imp({ recipe_id: null })]), D.seanceDUnImportCible(seance, [imp({ status: 'enregistre' })]), D.seanceDUnImportCible(seance, [imp({ status: 'ignore' })]), D.seanceDUnImportCible(seance, [imp({ scan_session_id: 'ss2' })]), D.seanceDUnImportCible(seance, []), D.seanceDUnImportCible(seance, null), D.seanceDUnImportCible(seance, [null, imp({ status: 'ignore' }), imp()])], [false, false, false, false, false, false, false, true], 'séance d’un import ciblé : faux pour kind index, pour recipe_id nul, pour enregistre / ignore, pour une autre séance, sans import ; une ligne nulle est ignorée, un import ouvert parmi d’autres suffit');
  });

  await run('domaine import-cible : fabriquerExtraction', async () => {
    const D = await import('../src/domain/import-cible.js');
    const { detectTimers } = await import('../src/domain/lines.js');
    const reference = { id: 'rc1', edition_id: 'ed1', original_title: 'Tarte aux pommes', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, source_page_ids: ['pg0'], current_version_id: null, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE };
    const pages = [{ id: 'pg1', document_id: 'doc1', edition_id: 'ed1', sha256: 'a', printed_page: null, position: 1, kind: null }, { id: 'pg2', document_id: 'doc1', edition_id: 'ed1', sha256: 'b', printed_page: 133, position: 2, kind: null }];
    const resultat = { title: 'Tarte aux pommes de ma grand-mère', servings: 6, prep_minutes: 20, cook_minutes: 45, ingredients: [{ source_text: '4 pommes', uncertain: false }, { source_text: '? g de sucre', uncertain: true }], steps: [{ text: 'Peler les pommes.\nLes couper en quartiers.' }, { text: 'Cuire 45 min.' }], printed_page: 132, sub_recipes: [], uncertain_fields: ['sucre'], notes: 'Servir tiède.', incomplete: false, missing_page: false };
    const opts = { reference, versions: [], pages, pageIds: ['pg2', 'pg1', 'pg_absente'], edition: { id: 'ed1', unit_convention_id: 'metric_ca' }, convention: { id: 'metric_ca', revision: 1, values: { x: 1 }, autre: 'ignoré' }, importId: 'imp1', modele: 'claude-x', photo: { sha256: 'ph', origin: 'photo' }, maintenant: '2026-10-18T12:00:00.000Z' };
    const f = D.fabriquerExtraction(resultat, opts);
    eq(Object.keys(f).sort(), ['pageUpdates', 'recipe', 'remplacement', 'version'], 'fabrication : rend { recipe, version, pageUpdates, remplacement }');
    eq([f.recipe.id, f.recipe.original_title, f.version.provenance.titre_lu], ['rc1', 'Tarte aux pommes', 'Tarte aux pommes de ma grand-mère'], 'fabrication : la fiche garde le titre de la RÉFÉRENCE, le titre lu va en provenance.titre_lu');
    eq(f.version.ingredients.map((l) => [l.source_text, l.uncertain, l.verification_state, typeof l.id, l.quantity?.value ?? l.quantity]), [['4 pommes', false, 'to_verify', 'string', 4], ['? g de sucre', true, 'to_verify', 'string', null]], 'fabrication : lignes par parseIngredientLine, uncertain recopié par ligne, toutes à vérifier');
    eq(f.version.steps.map((s) => [s.position, s.text, typeof s.id]), [[1, 'Peler les pommes.\nLes couper en quartiers.', 'string'], [2, 'Cuire 45 min.', 'string']], 'fabrication : une étape par entrée du modèle, texte multi-lignes INTACT (jamais parseStepsBlock), position 1..n');
    eq([f.version.steps[1].timers, 'timers' in f.version.steps[0]], [detectTimers('Cuire 45 min.').timers, false], 'fabrication : les clés de detectTimers sont posées sur chaque étape (timers quand une durée est lue, rien sinon)');
    eq([f.version.kind, f.version.recipe_id, f.version.parent_version_id, f.version.verification_state, f.version.notes, f.version.servings, f.version.prep_minutes, f.version.cook_minutes, f.version.created_at, typeof f.version.id], ['extraction', 'rc1', null, 'to_verify', 'Servir tiède.', 6, 20, 45, '2026-10-18T12:00:00.000Z', 'string'], 'fabrication : version extraction, parent nul sans version courante, notes du modèle → version.notes, portions et durées recopiées, created_at = maintenant');
    eq(f.version.provenance, { source_page_ids: ['pg2', 'pg1'], source_document_id: 'doc1', generated_by: 'ai', model: 'claude-x', edition_id: 'ed1', convention_snapshot: { id: 'metric_ca', revision: 1, values: { x: 1 } }, import_id: 'imp1', incomplete: false, missing_page: false, titre_lu: 'Tarte aux pommes de ma grand-mère' }, 'fabrication : provenance complète (pages présentes dans l’ordre choisi, document, ai, modèle, édition, convention figée, import_id souple, incomplete, missing_page, titre_lu)');
    eq([f.recipe.printed_page, f.recipe.source_page_ids, f.recipe.photo_sha256, f.recipe.photo_origin, f.recipe.availability, f.recipe.verification_state, f.recipe.current_version_id === f.version.id, f.recipe.edition_id, f.recipe.original_language], [132, ['pg0', 'pg2', 'pg1'], 'ph', 'photo', 'available', 'to_verify', true, 'ed1', 'fr'], 'fabrication : printed_page posé (vide avant), union des pages, photo du plat posée, available, à vérifier, la version devient courante, le reste de la fiche conservé');
    eq(f.pageUpdates.map((p) => [p.id, p.kind, p.position, p.printed_page, p.sha256]), [['pg2', 'recipe', 1, 133, 'b'], ['pg1', 'recipe', 2, null, 'a']], 'fabrication : pages dans l’ordre de pageIds, kind recipe, position réécrite, printed_page de la page gardé ; une page sans numéro qui n’est pas la première reste nulle (rien d’inventé, ronde 1) ; une page absente de `pages` est ignorée');
    eq(D.fabriquerExtraction(resultat, { ...opts, pageIds: ['pg1', 'pg2'] }).pageUpdates.map((p) => [p.id, p.printed_page]), [['pg1', 132], ['pg2', 133]], 'fabrication (ronde 1) : seule la PREMIÈRE page de l’ordre reçoit le printed_page de la fiche quand elle n’en a pas ; les suivantes gardent le leur ou null');
    eq(f.remplacement, false, 'fabrication : sans aucune version, pas de « Remplacer ? »');
    eq([D.fabriquerExtraction({ ...resultat, incomplete: true }, opts).recipe.availability, D.fabriquerExtraction({ ...resultat, missing_page: true }, opts).recipe.availability, D.fabriquerExtraction({ ...resultat, steps: [] }, opts).recipe.availability, D.fabriquerExtraction({ ...resultat, ingredients: [] }, opts).recipe.availability], ['partial', 'partial', 'partial', 'partial'], 'fabrication : partial sur incomplete, sur missing_page, sans étape ou sans ligne');
    eq([D.fabriquerExtraction({ ...resultat, incomplete: true, missing_page: 'oui' }, opts).version.provenance.incomplete, D.fabriquerExtraction({ ...resultat, incomplete: true, missing_page: 'oui' }, opts).version.provenance.missing_page], [true, false], 'fabrication : incomplete et missing_page sont des booléens stricts en provenance');
    eq(D.fabriquerExtraction(resultat, { ...opts, reference: { ...reference, printed_page: 130 } }).recipe.printed_page, 130, 'fabrication : un printed_page déjà posé sur la référence est conservé');
    eq(D.fabriquerExtraction({ ...resultat, printed_page: null }, opts).pageUpdates.map((p) => p.printed_page), [133, null], 'fabrication : sans page lue ni page de fiche, la page sans numéro reste nulle (rien d’inventé)');
    { const avecCourante = D.fabriquerExtraction(resultat, { ...opts, reference: { ...reference, current_version_id: 'rv0', availability: 'partial' }, versions: [{ id: 'rv0', kind: 'extraction', provenance: { generated_by: 'ai' } }] });
      eq([avecCourante.version.parent_version_id, avecCourante.remplacement, avecCourante.recipe.current_version_id === avecCourante.version.id], ['rv0', false, true], 'fabrication (I-5) : parent = la version courante ; une extraction ai seule → pas de « Remplacer ? », la nouvelle devient courante'); }
    { // I-5 « non » (ronde 1) : remplacer: false → la fiche ne reçoit QUE l’union des pages et la photo du plat ; tout le reste intact ; la version est fabriquée (ajoutée sans devenir courante).
      const versions = [{ id: 'rv0', kind: 'extraction', provenance: { generated_by: 'ai' } }, { id: 'rv1', kind: 'correction', parent_version_id: 'rv0', provenance: { generated_by: 'manual' } }];
      const refCorr = { ...reference, current_version_id: 'rv1', availability: 'partial', verification_state: 'verified', ingredient_ids: ['ing_x'], printed_page: null, photo_sha256: null, photo_origin: null };
      const non = D.fabriquerExtraction(resultat, { ...opts, reference: refCorr, versions, remplacer: false });
      eq([non.remplacement, non.recipe.current_version_id, non.recipe.availability, non.recipe.verification_state, non.recipe.ingredient_ids, non.recipe.printed_page, non.recipe.source_page_ids, non.recipe.photo_sha256, non.recipe.photo_origin, non.version.parent_version_id, non.version.kind, non.version.verification_state], [true, 'rv1', 'partial', 'verified', ['ing_x'], null, ['pg0', 'pg2', 'pg1'], 'ph', 'photo', 'rv1', 'extraction', 'to_verify'], 'fabrication (I-5, « non ») : remplacer: false → union des pages et photo du plat seulement ; current_version_id, availability, verification_state, ingredient_ids et printed_page INTACTS ; la version extraction est quand même rendue (parent = la courante)');
      eq(non.pageUpdates.map((p) => [p.id, p.kind, p.position, p.printed_page]), [['pg2', 'recipe', 1, 133], ['pg1', 'recipe', 2, null]], 'fabrication (I-5, « non ») : les pages reçoivent kind recipe et leur position ; aucun printed_page inventé depuis une fiche qui n’en a pas');
      eq(Object.keys(non.recipe).sort(), Object.keys(refCorr).sort(), 'fabrication (I-5, « non ») : aucune clé ajoutée à la fiche (ni availability, ni current_version_id neufs)');
      const oui = D.fabriquerExtraction(resultat, { ...opts, reference: refCorr, versions, remplacer: true });
      eq([oui.remplacement, oui.recipe.current_version_id === oui.version.id, oui.recipe.availability, oui.recipe.verification_state, oui.recipe.printed_page], [true, true, 'available', 'to_verify', 132], 'fabrication (I-5, « oui ») : remplacer: true (le défaut) → la nouvelle version devient courante, fiche recomposée'); }
    eq([D.fabriquerExtraction(resultat, { ...opts, versions: [{ id: 'rv0', kind: 'extraction', provenance: { generated_by: 'manual' } }] }).remplacement, D.fabriquerExtraction(resultat, { ...opts, versions: [{ id: 'rv0', kind: 'extraction', provenance: { generated_by: 'ai' } }, { id: 'rv1', kind: 'correction', parent_version_id: 'rv0', provenance: { generated_by: 'manual' } }] }).remplacement, D.fabriquerExtraction(resultat, { ...opts, versions: [{ id: 'rv0', kind: 'extraction', provenance: null }] }).remplacement], [true, true, true], 'fabrication (I-5, N4) : « Remplacer ? » dès qu’une version non produite par l’assistant existe \u2014 saisie à la main, correction, ou provenance absente');
    eq([D.fabriquerExtraction(resultat, { ...opts, photo: null }).recipe.photo_sha256, D.fabriquerExtraction(resultat, { ...opts, photo: null }).recipe.photo_origin, D.fabriquerExtraction(resultat, { ...opts, photo: null, reference: { ...reference, photo_sha256: 'ancienne', photo_origin: 'image' } }).recipe.photo_sha256, D.fabriquerExtraction(resultat, { ...opts, photo: { sha256: 'p2', origin: 'nimporte' } }).recipe.photo_origin], [null, null, 'ancienne', null], 'fabrication : sans photo, la fiche garde la sienne (ou null) ; un geste hors liste (photo | image) vaut null');
    eq(D.fabriquerExtraction(resultat, { ...opts, convention: null, edition: null, modele: null, importId: null }).version.provenance, { ...f.version.provenance, convention_snapshot: null, edition_id: 'ed1', model: null, import_id: null }, 'fabrication : sans convention ni édition ni modèle, provenance à null (edition_id retombe sur celui de la fiche)');
    eq(D.fabriquerExtraction(resultat, { ...opts, pages: new Map(pages.map((p) => [p.id, p])) }).pageUpdates.map((p) => p.id), ['pg2', 'pg1'], 'fabrication : `pages` accepte aussi une Map (ctx.pagesById)');
    eq([f.recipe.ingredient_ids, Array.isArray(f.recipe.ingredient_ids)], [[...new Set(f.version.ingredients.map((l) => l.ingredient_id).filter(Boolean))], true], 'fabrication : ingredient_ids de la fiche = ceux reconnus dans la nouvelle version (comme l’éditeur)');
    ok(f.version.id !== D.fabriquerExtraction(resultat, opts).version.id, 'fabrication : chaque appel tire des identifiants neufs');
  });

  // --- repo.ajouterPages (spec § 3.6) : les octets par putFile avant, puis les lignes de séance \u2014 et la ligne du journal \u2014 en UNE transaction ; aucune navigation.
  await run('repo.ajouterPages', () => withRepo(async (repo, db) => {
    const fichier = (nom, octets = 100) => new File([new Uint8Array(octets).map((_, i) => (i * 7 + nom.length) & 255)], nom, { type: 'image/jpeg' });
    const horsFiles = (vus) => vus.filter(([k]) => !(k.length === 1 && k[0] === 'files')); // les octets passent par putFile (un mutate `files` chacun) : seuls les lots de lignes comptent ici
    const capture = db.onMutate;
    const espionner = (vus, lire = () => null) => { db.onMutate = (m) => { vus.push([Object.keys(m.puts).sort(), lire(m)]); return capture ? capture(m) : {}; }; };
    const hashAvant = location.hash;
    // 1) Sans import_id ni import : le chemin existant (saveBatch), séance neuve, aucune navigation.
    const vus1 = []; espionner(vus1, (m) => m.origin);
    let r1; try { r1 = await repo.ajouterPages([fichier('a.jpg', 100)], { edition_id: 'ed1' }); } finally { db.onMutate = capture; }
    eq([r1.session.status, r1.session.edition_id, r1.pages.length, r1.docs.length, r1.importId, r1.session.page_ids, r1.session.document_ids, r1.pages[0].position, r1.docs[0].source_type], ['open', 'ed1', 1, 1, null, [r1.pages[0].id], [r1.docs[0].id], 1, 'photo'], 'ajouterPages : séance ouverte neuve, une page et un document, importId null sans import');
    eq(horsFiles(vus1), [[['scan_sessions', 'source_documents', 'source_pages'], 'local']], 'ajouterPages sans import : UN lot pour les trois magasins de séance (les octets par putFile avant)');
    eq([location.hash, (await db.get('scan_sessions', r1.session.id))?.page_ids, (await db.get('source_pages', r1.pages[0].id))?.sha256, (await db.get('files', r1.docs[0].sha256))?.blob instanceof Blob], [hashAvant, [r1.pages[0].id], r1.docs[0].sha256, true], 'ajouterPages : aucune navigation (adresse inchangée), séance, page et octets écrits');
    // Ronde 1 : le signalement « Image très légère » est une DONNÉE (issues) posée par ajouterPages \u2014 épinglé sous et à la borne, et par le helper que replacePage partage.
    eq([r1.pages[0].issues.length, (await db.get('source_pages', r1.pages[0].id)).issues, repo.issuesPourImage(repo.SMALL_IMAGE_BYTES - 1).length, repo.issuesPourImage(repo.SMALL_IMAGE_BYTES).length, repo.issuesPourImage(100)[0]], [1, [t('Image très légère : possiblement floue ou trop petite')], 1, 0, t('Image très légère : possiblement floue ou trop petite')], 'ajouterPages (ronde 1) : une image de 100 octets porte le signalement « Image très légère » dans issues ; à SMALL_IMAGE_BYTES, aucun ; issuesPourImage est le seul endroit qui en décide');
    { await db.put('scan_sessions', { ...(await db.get('scan_sessions', r1.session.id)), status: 'done' });
      const rr = await repo.ajouterPages([fichier('a2.jpg', 101)], { session_id: r1.session.id });
      eq([rr.session.id, rr.session.status, (await db.get('scan_sessions', r1.session.id)).status], [r1.session.id, 'open', 'open'], 'ajouterPages (ronde 1) : des pages ajoutées à une séance `done` la ROUVRENT (comme startScanSession avant) \u2014 elle réapparaît dans « Séances à reprendre »'); }
    // 2) Première photo d’un import ciblé (`import: {…}`, la ligne n’existe pas) : la ligne a_lancer AVEC scan_session_id et page_ids, dans le MÊME lot que la séance.
    const vus2 = []; espionner(vus2, (m) => m.puts.imports?.map((i) => [i.status, i.scan_session_id, i.page_ids]) ?? null);
    let r2; try { r2 = await repo.ajouterPages([fichier('b.jpg', 120), fichier('c.jpg', repo.SMALL_IMAGE_BYTES)], { edition_id: 'ed1', import: { id: 'imp_n', kind: 'recette', recipe_id: 'rc1', edition_id: 'ed1', device_id: 'dev_x' } }); } finally { db.onMutate = capture; }
    const ligne = await db.get('imports', 'imp_n');
    eq(r2.pages.map((p) => p.issues.length), [1, 0], 'première photo (ronde 1) : 120 octets → signalée, 80 Kio → pas de signalement');
    eq([r2.importId, ligne?.status, ligne?.kind, ligne?.recipe_id, ligne?.edition_id, ligne?.device_id, ligne?.scan_session_id, ligne?.page_ids, ligne?.appels, ligne?.photo_sha256, ligne?.resultat, ligne?.erreur, typeof ligne?.created_at, typeof ligne?.updated_at], ['imp_n', 'a_lancer', 'recette', 'rc1', 'ed1', 'dev_x', r2.session.id, r2.pages.map((p) => p.id), 0, null, null, null, 'string', 'string'], 'première photo : la ligne a_lancer porte la séance, les deux pages dans l’ordre, appels 0, horodatée');
    eq(horsFiles(vus2), [[['imports', 'scan_sessions', 'source_documents', 'source_pages'], [['a_lancer', r2.session.id, r2.pages.map((p) => p.id)]]]], 'première photo : la ligne du journal et les lignes de séance dans UN SEUL lot (même appel de mutate)');
    eq((await db.getAll('outbox')).filter((e) => e.store === 'imports').map((e) => [e.id, e.op]), [['imp_n', 'put']], 'première photo : la ligne du journal est capturée (elle part au compte)');
    // Ronde 1 (décision 9) : sans edition_id ni device_id dans `import`, la ligne retombe sur la séance et sur l’appareil \u2014 sur une séance existante d’édition ed1.
    { const r2b = await repo.ajouterPages([fichier('r.jpg', 121)], { session_id: r1.session.id, import: { id: 'imp_r', kind: 'recette', recipe_id: 'rc2' } });
      const lr = await db.get('imports', 'imp_r');
      eq([r2b.importId, lr?.status, lr?.edition_id, lr?.device_id, typeof lr?.device_id, lr?.scan_session_id, lr?.page_ids], ['imp_r', 'a_lancer', 'ed1', repo.deviceId(), 'string', r1.session.id, [r2b.pages[0].id]], 'première photo (ronde 1) : edition_id retombe sur celui de la séance, device_id sur repo.deviceId() \u2014 la ligne n’est jamais orpheline d’édition ni d’appareil'); }
    // Ronde 1 (I-10, I-2) : la CRÉATION de la ligne est conditionnée comme ses transitions \u2014 jamais d’écrasement d’une ligne existante, jamais deux imports ouverts pour la même recette.
    { await db.put('imports', { id: 'imp_x', kind: 'recette', recipe_id: 'rc_x', status: 'enregistre', resultat: { title: 'T' }, page_ids: ['pg_old'], scan_session_id: 'ss_old', created_at: DATE, updated_at: DATE });
      const avantX = { docs: await db.count('source_documents'), pages: await db.count('source_pages'), seances: await db.count('scan_sessions'), files: await db.count('files'), file: (await db.getAll('outbox')).length };
      let ecrase = null; try { await repo.ajouterPages([fichier('x.jpg', 122)], { edition_id: 'ed1', import: { id: 'imp_x', kind: 'recette', recipe_id: 'rc_x' } }); } catch (e) { ecrase = e; }
      const relu = await db.get('imports', 'imp_x');
      eq([ecrase?.name, ecrase?.store, ecrase?.key, ecrase?.statut, relu.status, relu.resultat, relu.page_ids, relu.scan_session_id, relu.created_at], ['TransitionRefusee', 'imports', 'imp_x', 'enregistre', 'enregistre', { title: 'T' }, ['pg_old'], 'ss_old', DATE], 'première photo (ronde 1, I-10) : une ligne du journal qui existe déjà (même id) n’est JAMAIS écrasée \u2014 TransitionRefusee nommée, résultat enregistré, pages, séance et created_at intacts');
      eq([await db.count('source_documents'), await db.count('source_pages'), await db.count('scan_sessions'), await db.count('files'), (await db.getAll('outbox')).length], [avantX.docs, avantX.pages, avantX.seances, avantX.files, avantX.file], 'première photo (ronde 1, I-10) : rien d’écrit \u2014 ni séance, ni page, ni document, ni octets (vérification avant putFile), rien en file');
      let doublon = null; try { await repo.ajouterPages([fichier('y.jpg', 123)], { edition_id: 'ed1', import: { id: 'imp_dup', kind: 'recette', recipe_id: 'rc1' } }); } catch (e) { doublon = e; }
      eq([doublon?.name, doublon?.store, doublon?.key, doublon?.statut, await db.get('imports', 'imp_dup'), await db.count('files')], ['TransitionRefusee', 'imports', 'recipe_id=rc1', 'a_lancer', undefined, avantX.files], 'première photo (ronde 1, I-2) : un second import pour une recette qui en a déjà un NON TERMINÉ (imp_n, a_lancer) est refusé \u2014 nommé par l’index, aucun octet écrit');
      await db.put('imports', { ...(await db.get('imports', 'imp_r')), status: 'ignore' });
      const r2c = await repo.ajouterPages([fichier('z.jpg', 124)], { session_id: r1.session.id, import: { id: 'imp_r2', kind: 'recette', recipe_id: 'rc2' } });
      eq([r2c.importId, (await db.get('imports', 'imp_r2'))?.status], ['imp_r2', 'a_lancer'], 'première photo (ronde 1, I-2) : un import TERMINÉ (ignore) sur la même recette ne bloque pas un nouveau');
      const formes = []; const filesAvantFormes = await db.count('files');
      for (const args of [{ edition_id: 'ed1', import: { id: 'imp_k', kind: 'web', recipe_id: 'rc9' } }, { edition_id: 'ed1', import: { id: 'imp_k', recipe_id: 'rc9' } }, { session_id: r2.session.id, import_id: 'imp_n', import: { id: 'imp_k', kind: 'recette', recipe_id: 'rc9' } }]) {
        try { await repo.ajouterPages([fichier('k.jpg', 125)], args); formes.push('écrit'); } catch (e) { formes.push(e.name); }
      }
      eq([formes, await db.get('imports', 'imp_k'), await db.count('files')], [['TypeError', 'TypeError', 'TypeError'], undefined, filesAvantFormes], 'ajouterPages (ronde 1) : kind hors recette | index, kind absent, import_id ET import ensemble → TypeError avant tout octet, rien d’écrit'); }
    // 3) Pages de plus avec import_id : UN repo.transitionner, page_ids ajoutés EN FIN par patch-fonction, lignes de séance dans la même transaction.
    // Ronde 1 (faux-vert) : la LIGNE porte un sous-ensemble strict des pages de la SÉANCE (« Retirer » a détaché la page c de l’import, la ligne source_pages
    // reste, spec § 4.2.2) : un patch qui recopierait la liste de la séance lue hors transaction ferait revenir c en silence.
    await db.put('imports', { ...(await db.get('imports', 'imp_n')), page_ids: [r2.pages[0].id] });
    const vus3 = []; espionner(vus3, (m) => m.puts.imports?.[0]?.page_ids ?? null);
    let r3; try { r3 = await repo.ajouterPages([fichier('d.jpg', 140)], { session_id: r2.session.id, import_id: 'imp_n' }); } finally { db.onMutate = capture; }
    const apres = await db.get('imports', 'imp_n');
    const seance = await db.get('scan_sessions', r2.session.id);
    eq([apres.page_ids, apres.status, r3.importId, r3.session.id, seance.page_ids, seance.document_ids.length, r3.pages[0].position], [[r2.pages[0].id, r3.pages[0].id], 'a_lancer', 'imp_n', r2.session.id, [...r2.pages.map((p) => p.id), r3.pages[0].id], 3, 3], 'avec import_id : les page_ids neufs s’ajoutent EN FIN de ceux de la LIGNE (lus dans la transaction : [b, d], jamais de la séance [b, c, d]), même statut, séance reprise et complétée');
    eq(horsFiles(vus3), [[['imports', 'scan_sessions', 'source_documents', 'source_pages'], apres.page_ids]], 'avec import_id : imports, source_documents, source_pages et scan_sessions dans le MÊME appel de mutate');
    // Ronde 1 : import_id SANS session_id → la séance est celle de la ligne du journal (aucune séance orpheline) ; une séance qui diverge de celle de la ligne refuse.
    { const seancesAvant = await db.count('scan_sessions');
      const r3b = await repo.ajouterPages([fichier('e.jpg', 141)], { import_id: 'imp_n' });
      eq([r3b.session.id, await db.count('scan_sessions'), (await db.get('imports', 'imp_n')).page_ids.at(-1), (await db.get('scan_sessions', r2.session.id)).page_ids.includes(r3b.pages[0].id)], [r2.session.id, seancesAvant, r3b.pages[0].id, true], 'avec import_id sans session_id (ronde 1) : la page va dans la séance de la LIGNE (scan_session_id), aucune séance neuve');
      await db.put('imports', { id: 'imp_d', kind: 'recette', recipe_id: 'rc_d', status: 'a_lancer', page_ids: ['pg_d'], scan_session_id: 'ss_autre', created_at: DATE, updated_at: DATE });
      const avantD = { pages: await db.count('source_pages'), files: await db.count('files') };
      let diverge = null; try { await repo.ajouterPages([fichier('f.jpg', 142)], { session_id: r2.session.id, import_id: 'imp_d' }); } catch (e) { diverge = e; }
      eq([diverge?.name, (await db.get('imports', 'imp_d')).page_ids, (await db.get('imports', 'imp_d')).scan_session_id, await db.count('source_pages'), await db.count('files')], ['TypeError', ['pg_d'], 'ss_autre', avantD.pages, avantD.files], 'avec import_id (ronde 1) : une séance qui n’est pas celle de la ligne (scan_session_id ss_autre) est refusée par TypeError avant tout octet \u2014 journal et séance ne divergent jamais'); }
    for (const statut of ['a_verifier', 'echec']) {
      await db.put('imports', { ...(await db.get('imports', 'imp_n')), status: statut });
      const r = await repo.ajouterPages([fichier(`${statut}.jpg`, 150)], { session_id: r2.session.id, import_id: 'imp_n' });
      eq([(await db.get('imports', 'imp_n')).status, (await db.get('imports', 'imp_n')).page_ids.at(-1)], [statut, r.pages[0].id], `avec import_id : un import ${statut} accepte des pages, son statut ne change pas`);
    }
    // 4) Import terminé (enregistre) : TransitionRefusee, AUCUNE ligne de séance, de page, de document ni d’import écrite ; la ligne files posée avant reste (assumé).
    await db.put('imports', { id: 'imp_fini', status: 'enregistre', page_ids: ['pg_x'], scan_session_id: null, updated_at: DATE });
    const avant = { docs: await db.count('source_documents'), pages: await db.count('source_pages'), seances: await db.count('scan_sessions'), imports: await db.count('imports'), files: await db.count('files'), file: (await db.getAll('outbox')).length };
    let refus = null;
    try { await repo.ajouterPages([fichier('fini.jpg', 160)], { import_id: 'imp_fini' }); } catch (e) { refus = e; }
    eq([refus?.name, refus?.store, refus?.key, refus?.statut], ['TransitionRefusee', 'imports', 'imp_fini', 'enregistre'], 'import enregistre : TransitionRefusee nommée');
    eq([await db.count('source_documents'), await db.count('source_pages'), await db.count('scan_sessions'), await db.count('imports'), (await db.get('imports', 'imp_fini')).page_ids, await db.count('files'), (await db.getAll('outbox')).length], [avant.docs, avant.pages, avant.seances, avant.imports, ['pg_x'], avant.files, avant.file], 'import enregistre : rien d’écrit (ni séance, ni page, ni document, ni import, rien en file) \u2014 ni la ligne files : la ligne du journal est lue AVANT le premier putFile (ronde 1 ; la condition en transaction reste le mur)');
    for (const statut of ['ignore', 'en_cours']) {
      await db.put('imports', { id: 'imp_' + statut, status: statut, page_ids: [], updated_at: DATE });
      let e = null; try { await repo.ajouterPages([fichier(statut + '.jpg', 170), fichier(statut + '2.jpg', 171)], { import_id: 'imp_' + statut }); } catch (x) { e = x; }
      eq([e?.name, (await db.get('imports', 'imp_' + statut)).page_ids, await db.count('files')], ['TransitionRefusee', [], avant.files], `import ${statut} : refusé, page_ids intacts, aucun des deux fichiers écrit`);
    }
    let absent = null; try { await repo.ajouterPages([fichier('absent.jpg', 180)], { import_id: 'imp_absent' }); } catch (x) { absent = x; }
    eq([absent?.name, absent?.statut], ['TransitionRefusee', undefined], 'import_id inconnu : refusé (statut indéfini), rien d’écrit');
    // 5) startScanSession passe toujours par là \u2014 et navigue, lui (navigation et toast injectés : la page de tests ne bouge pas).
    const I = await import('../src/ui/import.js');
    const navs = [], toasts = [];
    const vus5 = []; espionner(vus5);
    let s; try { s = await I.startScanSession([fichier('g.jpg', 190)], { session_id: r2.session.id, naviguer: (p) => navs.push(p), notifier: (m) => toasts.push(m) }); } finally { db.onMutate = capture; }
    eq([s.id, s.page_ids.length, navs, toasts.length, horsFiles(vus5)], [r2.session.id, 7, [`/import?session=${encodeURIComponent(r2.session.id)}`], 1, [[['scan_sessions', 'source_documents', 'source_pages'], null]]], 'startScanSession : même lot de séance qu’ajouterPages (une transaction pour les trois magasins), puis UNE navigation vers la séance et un toast');
    eq([(await db.get('scan_sessions', r2.session.id)).page_ids.length, location.hash], [7, hashAvant], 'startScanSession : la séance est complétée (b, c, d, a_verifier, echec, e, g) ; la navigation injectée n’a pas touché l’adresse de la page de tests');
    const s2 = await I.startScanSession([fichier('h.jpg', 200)], { edition_id: 'ed1', intention: 'index', naviguer: (p) => navs.push(p), notifier: () => {} });
    eq([s2.edition_id, s2.page_ids.length, navs.at(-1)], ['ed1', 1, `/import?session=${encodeURIComponent(s2.id)}&intention=index`], 'startScanSession : séance neuve, l’intention voyage dans l’adresse comme avant');
  }));

  // --- preparerPhotoLocale (spec § 4.2.3) : le mur d'une couverture, extrait de poserCouverture, pour la photo du plat aussi.
  await run('preparerPhotoLocale', async () => {
    const IM = await import('../src/core/image.js');
    const toile = document.createElement('canvas'); toile.width = 1600; toile.height = 2000; toile.getContext('2d').fillRect(0, 0, 1600, 2000);
    const photo = await new Promise((r) => toile.toBlob(r, 'image/png'));
    const jpeg = await IM.preparerPhotoLocale(photo);
    const dims = await IM.dimensionsImage(jpeg);
    eq([jpeg instanceof Blob, jpeg.type, dims?.largeur, dims?.hauteur], [true, 'image/jpeg', 960, 1200], 'preparerPhotoLocale : rend un Blob JPEG réduit à 1 200 px de grand côté, proportions gardées');
    const code = async (b) => { try { await IM.preparerPhotoLocale(b); return 'acceptée'; } catch (e) { return [e.name, e.code]; } };
    eq(await code(new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: 'image/jpeg' })), ['ErreurImage', 'trop_lourde'], 'preparerPhotoLocale : plus de 25 Mo → trop_lourde (avant toute lecture)');
    eq(await code(new Blob(['<html>'], { type: 'text/html' })), ['ErreurImage', 'type'], 'preparerPhotoLocale : un type hors liste blanche → type');
    eq([await code(new Blob(['%PDF-1.4'], { type: 'application/pdf' })), await code(new Blob(['PK'], { type: 'application/epub+zip' }))], [['ErreurImage', 'type'], ['ErreurImage', 'type']], 'preparerPhotoLocale (ronde 1) : un PDF ou un EPUB choisi comme photo est refusé par `type` (liste des IMAGES, pas ALLOWED_MIME) \u2014 jamais « illisible »');
    const u8 = (...a) => new Uint8Array(a);
    const png = (w, h) => new Blob([u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255, h >>> 24, (h >>> 16) & 255, (h >>> 8) & 255, h & 255, 8, 2, 0, 0, 0)], { type: 'image/png' });
    const vraiBitmap = globalThis.createImageBitmap; let decodages = 0; let grande;
    try { globalThis.createImageBitmap = async (...a) => { decodages += 1; return vraiBitmap.call(globalThis, ...a); }; grande = await code(png(20000, 20000)); } finally { globalThis.createImageBitmap = vraiBitmap; }
    eq([grande, decodages], [['ErreurImage', 'trop_grande'], 0], 'preparerPhotoLocale : plus de 16 Mpx → trop_grande AVANT tout décodage (createImageBitmap jamais appelé, S2)');
    eq([(await code(png(4000, 4000)))[1], (await code(png(4001, 4000)))[1]], ['indecodable', 'trop_grande'], 'preparerPhotoLocale : 16 Mpx exactement passe le mur de pixels (l’en-tête seul échoue ensuite au décodage : indecodable, pas trop_grande) ; 4 001 × 4 000 → trop_grande');
    eq(await code(new Blob(['x'], { type: 'image/png' })), ['ErreurImage', 'indecodable'], 'preparerPhotoLocale : indécodable → indecodable');
    eq([await code(new Blob([await png(100, 100).arrayBuffer()], { type: '' })), await code(new Blob([new Uint8Array(await png(100, 100).arrayBuffer())], { type: 'image/heic' }))], [['ErreurImage', 'indecodable'], ['ErreurImage', 'indecodable']], 'preparerPhotoLocale (ronde 1) : un type VIDE (sélecteur mobile) et image/heic passent le contrôle de type ; c’est le décodage qui tranche (indecodable ici : en-tête seul), jamais `type`');
    eq(await code('pas un blob'), ['ErreurImage', 'indecodable'], 'preparerPhotoLocale : autre chose qu’un Blob → indecodable, jamais une exception brute');
    // poserCouverture reste vert (tests/ajouter.js) et passe par le même mur : même refus, même JPEG, sur une base jetable.
    const LA = await import('../src/ui/livre-ajout.js');
    let ecritures = 0; const repoCompteur = { putFile: async (sha, blob) => { ecritures += 1; return { sha256: sha, blob }; } };
    const { sha256: empreinte, taille } = await LA.poserCouverture(photo, { origine: 'locale', repo: repoCompteur });
    const { sha256Hex } = await import('../src/core/hash.js');
    eq([empreinte, taille, ecritures], [await sha256Hex(jpeg), jpeg.size, 1], 'poserCouverture (locale) : la même empreinte et la même taille que preparerPhotoLocale \u2014 un seul mur');
    let codeCouv = null; try { await LA.poserCouverture(new Blob(['<html>'], { type: 'text/html' }), { origine: 'locale', repo: repoCompteur }); } catch (e) { codeCouv = e.code; }
    eq([codeCouv, ecritures], ['type', 1], 'poserCouverture (locale) : refus `type` sans écriture, comme avant');
  });
}
