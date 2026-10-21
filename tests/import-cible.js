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
    // Vague finale (m14) : les commentaires EN BLOC sont retirés aussi (un appel neutralisé par /* … */ ne compte plus) ; un appel neutralisé autrement
    // (if (false) …) ne se voit qu'au comportement : fabriquerExtraction et le save() de l'éditeur ont chacun leur test de vocabulaire hostile.
    const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // Tâche 3 : fabriquerExtraction (src/domain/import-cible.js) est le cinquième fabricant épinglé (spec § 3.3 : « appelée par fabriquerExtraction »).
    // Lot C, tâche 1 : fabriquerReferences (src/domain/table-matieres.js) est le sixième fabricant (spec C § 3.5 : « appelant ajouté au test de source » ; M32).
    const fabricants = ['../src/domain/creation-ia.js', '../src/ui/signet.js', '../src/ui/recipe-edit.js', '../src/ui/import.js', '../src/domain/import-cible.js', '../src/domain/table-matieres.js'];
    const appels = await Promise.all(fabricants.map(async (f) => (sansCommentaires(await lire(f)).match(/assertVocabulaire\(/g) || []).length >= 1));
    eq(appels, [true, true, true, true, true, true], 'vocabulaire : les six fabricants (dont fabriquerExtraction de import-cible.js et fabriquerReferences de table-matieres.js) appellent assertVocabulaire( hors commentaire (test de source, faible, admis ; M32)');
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
    eq(D.TRANSITIONS, { a_lancer: ['en_cours', 'ignore'], en_cours: ['a_verifier', 'echec'], a_verifier: ['enregistre', 'a_lancer', 'ignore', 'echec'], echec: ['en_cours', 'a_lancer', 'ignore'], enregistre: [], ignore: [] }, 'transitions : la table exacte de la spec (T4-R1 : a_verifier → echec(illisible), résultat relu invalide)');
    eq([D.transitionPermise('inconnu', 'en_cours'), D.transitionPermise('a_lancer', 'inconnu'), D.transitionPermise(undefined, 'ignore'), D.transitionPermise('constructor', 'ignore')], [false, false, false, false], 'transitions : un état inconnu (ou une clé héritée) ne permet rien');
    eq(t('“{x}” ; “{y}” (p. {n})', { x: '{y}', y: 'Tarte aux pommes', n: 132 }), '“{y}” ; “Tarte aux pommes” (p. 132)', 'i18n (T4-R1) : t() remplace en UNE passe \u2014 une valeur insérée (un titre lu « {y} ») n’est jamais relue comme un gabarit : la discordance ne se maquille pas en concordance');
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
    eq(D.RAISONS_ECHEC, ['non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'coupe', 'illisible', 'hors_bornes', 'vide', 'interrompu', 'incertain', 'interdit', 'inaccessible', 'pas_une_page', 'page_trop_lourde', 'page_vide', 'lien'], 'raisons d’échec : la liste fermée § 4.4 \u2014 celles de la passerelle (echecDomaine : un 413 est `requete` + extra trop_lourd, jamais une raison), puis annule, coupe, illisible, hors_bornes, vide, interrompu, incertain, puis les six du lot B (interdit, inaccessible, pas_une_page, page_trop_lourde, page_vide, lien)');
    ok(Object.isFrozen(D.RAISONS_ECHEC) && !D.RAISONS_ECHEC.includes('trop_lourd'), 'raisons d’échec (ronde 1) : aucune valeur morte \u2014 trop_lourd n’est produit par aucun chemin');
    // Séance exclue des rappels génériques (spec § 4.1, N3) : import ciblé = kind recette AVEC recipe_id, non terminé, même séance.
    const seance = { id: 'ss1' };
    const imp = (over = {}) => ({ id: 'imp', kind: 'recette', recipe_id: 'rc1', scan_session_id: 'ss1', status: 'a_lancer', ...over });
    eq([D.seanceDUnImportCible(seance, [imp({ status: 'zzz' })]), D.seanceDUnImportCible(seance, [imp({ status: null })]), D.seanceDUnImportCible(seance, [imp({ status: undefined })])], [false, false, false], 'séance d’un import ciblé (vague finale, m10) : une ligne hors vocabulaire (statut inconnu, nul, absent) ne masque pas sa séance — une seule définition d’« ouvert » (importOuvert)');
    eq(['a_lancer', 'en_cours', 'a_verifier', 'echec'].map((status) => D.seanceDUnImportCible(seance, [imp({ status })])), [true, true, true, true],'séance d’un import ciblé : vrai pour un import ciblé non terminé (a_lancer, en_cours, a_verifier, echec)');
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
    eq(f.version.provenance, { source_page_ids: ['pg2', 'pg1'], source_document_id: 'doc1', generated_by: 'ai', model: 'claude-x', edition_id: 'ed1', convention_snapshot: { id: 'metric_ca', revision: 1, values: { x: 1 } }, import_id: 'imp1', incomplete: false, missing_page: false, titre_lu: 'Tarte aux pommes de ma grand-mère', uncertain_fields: ['sucre'] }, 'fabrication : provenance complète (pages présentes dans l’ordre choisi, document, ai, modèle, édition, convention figée, import_id souple, incomplete, missing_page, titre_lu ; vague finale (m8) : les incertitudes de la lecture)');
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
    // Vague finale (m5) : I-5 vise ce que la personne a écrit et qui peut être courant (saisie à la main, correction) — une adaptation (« Ma version »,
    // remplacement d'ingrédient) ne devient jamais courante : elle ne déclenche pas « Remplacer ? » (sinon « Garder ma version » gardait l'ancienne lecture).
    eq([D.fabriquerExtraction(resultat, { ...opts, versions: [{ id: 'rv0', kind: 'extraction', provenance: { generated_by: 'ai' } }, { id: 'rv1', kind: 'adaptation', parent_version_id: 'rv0', provenance: { generated_by: 'manual', substitution: true } }] }).remplacement,
      D.fabriquerExtraction(resultat, { ...opts, versions: [{ id: 'rv0', kind: 'adaptation', provenance: { generated_by: 'ai' } }, { id: 'rv1', kind: 'adaptation', provenance: { generated_by: 'manual' } }] }).remplacement,
      D.fabriquerExtraction(resultat, { ...opts, versions: [{ id: 'rv0', kind: 'extraction', provenance: { generated_by: 'ai' } }, { id: 'rv1', kind: 'adaptation', provenance: { generated_by: 'manual' } }, { id: 'rv2', kind: 'correction', provenance: { generated_by: 'manual' } }] }).remplacement],
    [false, false, true], 'fabrication (I-5, vague finale m5) : une adaptation à la main ne déclenche pas « Remplacer ? » ; une correction à la main, si');
    // Ronde finale 2 (I-5, couverture) : les pages de la version courante qu'une lecture ne relit pas — tant qu'il en reste, l'écran demande « Remplacer ? ».
    eq([D.pagesNonRelues({ provenance: { source_page_ids: ['pg1', 'pg2'] } }, ['pg2', 'pg3']), D.pagesNonRelues({ provenance: { source_page_ids: ['pg1'] } }, ['pg3', 'pg1']), D.pagesNonRelues(null, ['pg1']), D.pagesNonRelues({ provenance: null }, []),
      D.pagesNonRelues({ provenance: { source_page_ids: ['pg1', 'pg1', '', 7, null] } }, []), D.pagesNonRelues({ provenance: { source_page_ids: ['pg1'] } }, null), D.pagesNonRelues({ provenance: { source_page_ids: 'pg1' } }, [])],
    [['pg1'], [], [], [], ['pg1'], ['pg1'], []], 'pagesNonRelues (ronde finale 2) : les pages de la courante absentes de la lecture, dédoublonnées, dans leur ordre ; sans courante ou sans pages, rien ; des entrées qui ne sont pas des identifiants sont ignorées ; une lecture illisible ne relit rien');
    // Vague finale (m14) : le vocabulaire est vérifié PAR COMPORTEMENT chez ce fabricant (le test de source ne voit pas un appel neutralisé) — une
    // référence reçue hors vocabulaire, recopiée telle quelle sur le chemin « non » (I-5), fait refuser la fabrication.
    let horsVocabulaire = null; try { D.fabriquerExtraction(resultat, { ...opts, reference: { ...reference, availability: 'dispo' }, remplacer: false }); } catch (e) { horsVocabulaire = e; }
    eq([horsVocabulaire?.name, horsVocabulaire?.champ, horsVocabulaire?.valeur], ['ErreurVocabulaire', 'availability', 'dispo'], 'fabrication (vague finale, m14) : une référence au vocabulaire hostile (availability « dispo ») recopiée par le chemin « non » → ErreurVocabulaire, rien à écrire');
    // Vague finale (m7) : « Lecture reçue le {d} » date la RÉCEPTION (départ du vol + durée), jamais updated_at (une photo du plat posée en a_verifier le bouge).
    eq([D.dateReception({ started_at: '2026-10-19T10:00:00.000Z', duree_ms: 30000, updated_at: '2026-10-19T18:00:00.000Z' }), D.dateReception({ updated_at: '2026-10-19T18:00:00.000Z' }), D.dateReception({ started_at: 'pas une date', duree_ms: 5, updated_at: 'U' }), D.dateReception({ started_at: '2026-10-19T10:00:00.000Z', duree_ms: 1e300, updated_at: 'U' }), D.dateReception({ started_at: '2026-10-19T10:00:00.000Z', duree_ms: -1, updated_at: 'U' }), D.dateReception(null)],
      ['2026-10-19T10:00:30.000Z', '2026-10-19T18:00:00.000Z', 'U', 'U', 'U', null], 'dateReception (vague finale, m7) : départ + durée ; sans départ ou durée lisibles (durée hors 0..24 h comprise), updated_at comme avant ; jamais une exception');
    eq([D.fabriquerExtraction(resultat, { ...opts, photo: null }).recipe.photo_sha256,D.fabriquerExtraction(resultat, { ...opts, photo: null }).recipe.photo_origin, D.fabriquerExtraction(resultat, { ...opts, photo: null, reference: { ...reference, photo_sha256: 'ancienne', photo_origin: 'image' } }).recipe.photo_sha256, D.fabriquerExtraction(resultat, { ...opts, photo: { sha256: 'p2', origin: 'nimporte' } }).recipe.photo_origin], [null, null, 'ancienne', null], 'fabrication : sans photo, la fiche garde la sienne (ou null) ; un geste hors liste (photo | image) vaut null');
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
    // Vague finale (Important, faux vert) : les murs EN TRANSACTION, éprouvés seuls. La pré-lecture hors transaction est rendue PÉRIMÉE (db.byIndex /
    // db.get enveloppés, comme le test du démarrage) : elle laisse passer, et seul le mur de la transaction refuse — rien de la séance n'est écrit (les
    // octets, posés avant, restent : assumé).
    { const lireIndex = db.byIndex.bind(db), lireFiche = db.get.bind(db);
      const compter = async () => [await db.count('source_documents'), await db.count('source_pages'), await db.count('scan_sessions'), await db.count('imports')];
      // (a) Deux onglets posent la première photo de la même référence au même moment : la pré-lecture ne voit aucun import ouvert, la base en a un (imp_n).
      const avantA = await compter();
      db.byIndex = async (s, i, v) => (s === 'imports' && i === 'recipe_id' ? [] : lireIndex(s, i, v));
      let murA = null; try { await repo.ajouterPages([fichier('mur-a.jpg', 300)], { edition_id: 'ed1', import: { id: 'imp_mur_a', kind: 'recette', recipe_id: 'rc1' } }); } catch (e) { murA = e; } finally { db.byIndex = lireIndex; }
      eq([murA?.name, murA?.key, await db.get('imports', 'imp_mur_a'), await compter()], ['TransitionRefusee', 'recipe_id=rc1', undefined, avantA], 'ajouterPages (vague finale, mur I-2) : la pré-lecture périmée ne voit aucun import ouvert pour rc1, la TRANSACTION en voit un → refus nommé par l’index, aucune ligne, séance, page ni document');
      // (b) La pré-lecture voit la ligne a_lancer ; dans la base, un autre onglet l'a enregistrée entre-temps.
      await db.put('imports', { id: 'imp_mur_b', kind: 'recette', recipe_id: 'rc_mur_b', status: 'enregistre', page_ids: ['pg_b0'], scan_session_id: null, updated_at: DATE });
      const avantB = await compter(); const ligneB = await db.get('imports', 'imp_mur_b');
      db.get = async (s, k) => (s === 'imports' && k === 'imp_mur_b' ? { ...(await lireFiche(s, k)), status: 'a_lancer' } : lireFiche(s, k));
      let murB = null; try { await repo.ajouterPages([fichier('mur-b.jpg', 301)], { edition_id: 'ed1', import_id: 'imp_mur_b' }); } catch (e) { murB = e; } finally { db.get = lireFiche; }
      eq([murB?.name, murB?.key, murB?.statut, await db.get('imports', 'imp_mur_b'), await compter()], ['TransitionRefusee', 'imp_mur_b', 'enregistre', ligneB, avantB], 'ajouterPages (vague finale, mur des attendus) : la pré-lecture périmée voit a_lancer, la TRANSACTION lit enregistre → refus, la ligne intacte, aucune séance, page ni document');
      // (c) Collision d'identifiant : la pré-lecture ne voit pas la ligne, la base l'a (une ligne d'index sans recipe_id : seul le mur « absente » joue).
      await db.put('imports', { id: 'imp_mur_c', kind: 'index', recipe_id: null, status: 'enregistre', page_ids: ['pg_c0'], scan_session_id: null, resultat: { entries: [] }, updated_at: DATE });
      const avantC = await compter(); const ligneC = await db.get('imports', 'imp_mur_c');
      db.get = async (s, k) => (s === 'imports' && k === 'imp_mur_c' ? undefined : lireFiche(s, k));
      let murC = null; try { await repo.ajouterPages([fichier('mur-c.jpg', 302)], { edition_id: 'ed1', import: { id: 'imp_mur_c', kind: 'index', recipe_id: null } }); } catch (e) { murC = e; } finally { db.get = lireFiche; }
      eq([murC?.name, murC?.key, murC?.statut, await db.get('imports', 'imp_mur_c'), await compter()], ['TransitionRefusee', 'imp_mur_c', 'enregistre', ligneC, avantC], 'ajouterPages (vague finale, mur « absente ») : la pré-lecture périmée ne voit pas la ligne, la TRANSACTION la trouve → refus, jamais écrasée, rien de la séance écrit');
      // Les pages déjà liées en tête d'une première photo (« Relire les pages », vague finale) : une forme mal faite refuse avant tout octet.
      const formesSeed = []; const filesSeed = await db.count('files');
      for (const page_ids of ['pg_x', [''], [7]]) { try { await repo.ajouterPages([fichier('seed.jpg', 303)], { edition_id: 'ed1', import: { id: 'imp_seed', kind: 'recette', recipe_id: 'rc_seed', page_ids } }); formesSeed.push('écrit'); } catch (e) { formesSeed.push(e.name); } }
      const seed = await repo.ajouterPages([fichier('seed.jpg', 304)], { edition_id: 'ed1', import: { id: 'imp_seed', kind: 'recette', recipe_id: 'rc_seed', page_ids: ['pg_vieille', 'pg_vieille'] } });
      eq([formesSeed, filesSeed + 1 === await db.count('files'), (await db.get('imports', 'imp_seed')).page_ids], [['TypeError', 'TypeError', 'TypeError'], true, ['pg_vieille', seed.pages[0].id]], 'ajouterPages (vague finale) : import.page_ids mal formé → TypeError avant tout octet ; bien formé → les pages déjà liées EN TÊTE (sans doublon), puis la page neuve'); }
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

  // --- Vague finale (m12) : le mur d'une page envoyée à l'assistant (pagePourEnvoi, un seul lieu) AVANT tout décodage — octets et pixels lus dans l'en-tête.
  await run('pagePourEnvoi : mur d’octets et de pixels avant le décodage', async () => {
    const L = await import('../src/domain/llm.js');
    const u8 = (...a) => new Uint8Array(a);
    const png = (w, h) => new Blob([u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255, h >>> 24, (h >>> 16) & 255, (h >>> 8) & 255, h & 255, 8, 2, 0, 0, 0)], { type: 'image/png' });
    const code = async (b) => { try { await L.pagePourEnvoi(b); return 'acceptée'; } catch (e) { return [e.name, e.code]; } };
    const vraiBitmap = globalThis.createImageBitmap; let decodages = 0; let refus;
    try {
      globalThis.createImageBitmap = async (...a) => { decodages += 1; return vraiBitmap.call(globalThis, ...a); };
      refus = [await code(png(10000, 5001)), await code(png(30000, 30000)), await code(new Blob([new Uint8Array(L.LIMITES_ENVOI.octets + 1)], { type: 'image/jpeg' }))];
    } finally { globalThis.createImageBitmap = vraiBitmap; }
    eq([L.LIMITES_ENVOI, refus, decodages], [{ octets: 50 * 1024 * 1024, pixels: 50000000 }, [['ErreurImage', 'trop_grande'], ['ErreurImage', 'trop_grande'], ['ErreurImage', 'trop_grande']], 0], 'pagePourEnvoi (vague finale, m12) : au-delà de 50 Mpx (lus dans l’en-tête) ou de 50 Mo → ErreurImage trop_grande AVANT tout décodage (createImageBitmap jamais appelé)');
    eq((await code(png(10000, 5000)))[1], 'indecodable', 'pagePourEnvoi (vague finale, m12) : 50 Mpx exactement passe le mur (une photo de 48 Mpx d’iPhone est un cas réel) ; l’en-tête seul échoue ensuite au décodage');
  });

  // =====================================================================================================================================
  // Tâche 4 — l'écran #/recipes/<id>/importer (spec § 4.1, § 4.2, § 4.3, § 4.4 ; Review Focus 2 et 4). Gestes injectés { repo, navigate, toast,
  // fetch, pickFiles, maintenant } ; base jetable (withRepo) ; fausse fetch qui honore le signal ; aucune écriture dans la bibliothèque.
  await run('écran import ciblé', () => withRepo(async (repo, db) => {
    const UI = await import('../src/ui/import-cible.js');
    const L = await import('../src/domain/llm.js');
    const IM = await import('../src/core/image.js');
    const { sha256Hex } = await import('../src/core/hash.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale();
    setUiLocale('fr'); // des textes français sont affirmés ; une suite antérieure a pu basculer l'interface
    // La scène est HORS ÉCRAN mais visible : le focus (« Descendre la page n ») ne se pose pas dans un conteneur hidden.
    const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(scene);
    const vraiFetch = globalThis.fetch;
    let reseau = 0;
    globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); }; // la fetch des écrans est TOUJOURS injectée
    const NOW = '2026-10-19T12:00:00.000Z';
    const livre = { id: 'b1', title: 'Mon livre', author: 'A. B.', updated_at: DATE };
    const edition = { id: 'ed1', book_id: 'b1', language: 'fr', updated_at: DATE };
    const fiche = (id, over = {}) => ({ id, edition_id: 'ed1', original_title: 'Tarte aux pommes', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: 132, source_page_ids: [], current_version_id: null, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE, ...over });
    const versionDe = (id, recipe_id, generated_by) => ({ id, recipe_id, kind: 'extraction', status: null, servings: 4, ingredients: [{ id: 'ri_' + id, source_text: '1 pomme', name_text: 'pomme', quantity: { value: 1, raw: '1' }, verification_state: 'verified' }], steps: [{ id: 'st_' + id, position: 1, text: 'Cuire.' }], provenance: { generated_by, source_page_ids: [] }, verification_state: 'verified', created_at: DATE, updated_at: DATE });
    const recettes = ['rc_a', 'rc_b', 'rc_c', 'rc_d', 'rc_f', 'rc_g', 'rc_h', 'rc_i', 'rc_j', 'rc_k', 'rc_l', 'rc_o', 'rc_p', 'rc_q', 'rc_r', 'rc_s', 'rc_t', 'rc_v', 'rc_ref', 'rc_w', 'rc_y', 'rc_z', 'rc_bb', 'rc_mort', 'rc_cc', 'rc_dd', 'rc_ee', 'rc_ff'].map((id) => fiche(id)).concat([
      fiche('rc_dispo', { availability: 'available', verification_state: 'verified', current_version_id: 'rv_dispo' }),
      fiche('rc_signet', { edition_id: null, source_url: 'https://exemple.test/x', printed_page: null }),
      fiche('rc_sigpart', { availability: 'partial', source_url: 'https://exemple.test/y', printed_page: null }), // un signet devenu partial (texte saisi à la main)
      fiche('rc_e', { availability: 'partial', verification_state: 'verified', current_version_id: 'rv_e_main', ingredient_ids: ['ing_x'] }),
      fiche('rc_m', { availability: 'partial', verification_state: 'verified', current_version_id: 'rv_m_main' }),
      fiche('rc_n', { availability: 'partial', verification_state: 'verified', current_version_id: 'rv_n_main' }),
      fiche('rc_u', { availability: 'partial', verification_state: 'verified', current_version_id: 'rv_u_main' }),
      fiche('rc_part', { availability: 'partial', verification_state: 'to_verify', current_version_id: 'rv_part' }),
    ]);
    const versions = [versionDe('rv_dispo', 'rc_dispo', 'ai'), versionDe('rv_e_main', 'rc_e', 'manual'), versionDe('rv_m_main', 'rc_m', 'manual'), versionDe('rv_n_main', 'rc_n', 'manual'), versionDe('rv_u_main', 'rc_u', 'manual'), versionDe('rv_part', 'rc_part', 'ai')];
    await db.mutate({ puts: { books: [livre], book_editions: [edition], recipes: recettes, recipe_versions: versions }, origin: 'device' });
    const JETON = 'jeton-import-sentinelle';
    const SESSION = { access_token: JETON, user: { id: 'u1', email: 'a@exemple.invalid' } };
    const ctxDe = async (session = SESSION) => {
      const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions');
      return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])), editionsById: new Map([['ed1', edition]]), booksById: new Map([['b1', livre]]), books: [livre], book_editions: [edition], pagesById: new Map(), imports: await db.getAll('imports'), settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' }, sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } }, conventionFor: () => null };
    };
    const RECETTE = { title: 'Tarte aux pommes', servings: 6, prep_minutes: 20, cook_minutes: 45, ingredients: [{ source_text: '4 pommes', uncertain: false }, { source_text: '? g de sucre', uncertain: true }], steps: [{ text: 'Peler les pommes.' }, { text: 'Cuire 45 min.' }], printed_page: 132, sub_recipes: [], uncertain_fields: [], notes: null, incomplete: false, missing_page: false };
    const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
    const corpsOk = (recette = RECETTE, extra = {}) => ({ model: 'claude-x', stop_reason: 'end_turn', content: [{ type: 'text', text: typeof recette === 'string' ? recette : JSON.stringify(recette) }], ...extra });
    // Une fausse fetch qui HONORE le signal (rejet AbortError) et se résout à la main (a.rendre[i](statut, corps)) ou toute seule (a.auto :
    // [statut, corps] ou une fonction, qui peut lever pour simuler le réseau coupé).
    const fauxFetch = (auto = null) => {
      const a = { appels: [], rendre: [], auto };
      a.fetch = (url, options) => new Promise((resolve, reject) => {
        const appel = { url, options }; a.appels.push(appel);
        const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
        if (options?.signal?.aborted) { abandon(); return; }
        options?.signal?.addEventListener('abort', abandon, { once: true });
        const fin = (status, corps) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(status, corps)); };
        if (a.auto) { let d; try { d = typeof a.auto === 'function' ? a.auto(appel) : a.auto; } catch (e) { reject(e); return; } fin(d[0], d[1]); } else a.rendre.push(fin);
      });
      return a;
    };
    const interdit = async () => { reseau += 1; throw new Error('aucun appel attendu'); };
    // Des IMAGES réelles (pagePourEnvoi décode) : couleur différente → octets et empreinte différents.
    const imageDe = async (nom, couleur, l = 320, h = 240) => { const c = new OffscreenCanvas(l, h); const cx = c.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); cx.fillStyle = '#fff'; cx.fillRect(10, 10, Math.round(l / 2), Math.round(h / 2)); return new File([await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' }); };
    const pick = { appels: [], suivant: [] };
    pick.fn = async (opts) => { pick.appels.push(opts); return pick.suivant.length ? pick.suivant.shift() : []; };
    const navs = [], dits = [];
    const monter = async (id, { session = SESSION, deps = {} } = {}) => { const root = await UI.renderImportCible({ id }, {}, await ctxDe(session), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: interdit, pickFiles: pick.fn, maintenant: () => NOW, ...deps }); scene.append(root); return root; };
    const bouton = (root, texte) => (root ? [...root.querySelectorAll('button')].find((b) => b.textContent === texte) || null : null);
    const lien = (root, texte) => (root ? [...root.querySelectorAll('a')].find((a) => a.textContent === texte) || null : null);
    const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const ligneDe = async (recipeId) => (await db.byIndex('imports', 'recipe_id', recipeId)).find((i) => !['enregistre', 'ignore'].includes(i.status)) || null;
    // Les pages d'un import, posées directement (repo.ajouterPages, chemin de la tâche 3) : l'écran les REPREND (I-2).
    const preparer = async (recipeId, n = 1) => { const files = []; for (let i = 0; i < n; i += 1) files.push(await imageDe(`${recipeId}-${i}.jpg`, ['#811', '#181', '#118'][i % 3])); return (await repo.ajouterPages(files, { edition_id: 'ed1', import: { id: repo.newId('imp'), kind: 'recette', recipe_id: recipeId } })).importId; };
    // Chaque bloc part d'une scène vide (les racines des blocs précédents n'écoutent plus) et de journaux de gestes vides.
    const bloc = (nom, fn) => run('écran — ' + nom, async () => {
      scene.replaceChildren(); navs.length = 0; dits.length = 0;
      try { await fn(); }
      catch (e) { if (UI.volEnCours()) UI.reinitialiserImportCible(); throw e; } // un bloc qui échoue en plein vol ne fait pas tomber les suivants en vol_tenu
    });
    let p1, p2, p3, shaPhoto;
    try {
      eq([typeof UI.DOCUMENT_ID, /^[0-9a-f-]{36}$/.test(UI.DOCUMENT_ID), UI.BATTEMENT_MS, typeof UI.lancerExtraction, typeof UI.annulerVol], ['string', true, 15000, 'function', 'function'], 'module : DOCUMENT_ID (uuid à l’import), BATTEMENT_MS 15000, lancerExtraction et annulerVol exportés pour la tâche 6');

      await bloc('ouverture', async () => {
        const root = await monter('rc_a');
        const texte = root.textContent;
        ok(texte.includes('Importer une recette') && texte.includes('Tarte aux pommes') && texte.includes('Mon livre · p. 132'), 'ouverture : sur-titre « Importer une recette », titre de la référence, « {livre} · p. 132 »');
        eq([...root.querySelectorAll('.badge')].map((b) => b.textContent), ['Repérée dans ton livre'], 'ouverture : badge « Repérée dans ton livre »');
        ok(texte.includes('0 photo ajoutée'), 'ouverture : « 0 photo ajoutée »');
        eq(await db.count('imports'), 0, 'ouverture : aucune ligne imports écrite tant qu’aucune photo n’est ajoutée (spec § 4.1)');
        const primaire = bouton(root, 'Extraire et enregistrer');
        eq([!!primaire, primaire?.disabled, primaire?.classList.contains('primary'), lien(root, 'Retour à la fiche')?.getAttribute('href'), texte.includes('Les pages et la photo seront liées à cette recette.')], [true, true, true, '#/recipes/rc_a', true], 'ouverture : bouton primaire éteint, « Retour à la fiche » à côté, la phrase sous le bouton');
        eq(root.etatRoute(), { importId: null, status: null, pageIds: [], vol: false, discordance: null }, 'ouverture : etatRoute() vide');
        eq([...root.querySelectorAll('button')].filter((b) => ['Prendre une photo', 'Choisir une image'].includes(b.textContent)).map((b) => b.disabled), [true, true], 'ouverture : la photo du plat attend une première page (une visite sans photo n’écrit rien)');
        await monter('rc_dispo');
        eq([dits, navs], [['Cette recette a déjà son texte.'], ['/recipes/rc_dispo']], 'ouverture : une recette available → toast « Cette recette a déjà son texte. » + retour à la fiche (D-11)');
        navs.length = 0; dits.length = 0;
        const variante = await monter('rc_signet');
        eq([dits, navs, variante.textContent.includes('Lire une recette web'), !!variante.querySelector('[data-role="lire-web"]')], [[], [], true, true], 'ouverture (lot B) : un signet → la variante web de l’écran (renderImportWeb, son bouton « Lire la recette avec l’assistant »), ni toast ni retour');
        navs.length = 0; dits.length = 0;
        ok((await monter('rc_inconnue')).textContent.includes('Recette introuvable.'), 'ouverture : une fiche inconnue le dit, sans lever');
        eq([navs, dits, reseau, await db.count('imports')], [[], [], 0, 0], 'ouverture : rien d’autre (ni navigation, ni réseau, ni écriture)');
      });

      await bloc('pages', async () => {
        const root = await monter('rc_a');
        pick.suivant.push([await imageDe('a.jpg', '#c33'), await imageDe('b.jpg', '#3c3')]);
        bouton(root, 'Choisir des photos').click();
        await attendre(() => root.etatRoute().pageIds.length === 2, 'deux pages ajoutées');
        eq(pick.appels.at(-1), { accept: 'image/*', multiple: true }, 'pages : « Choisir des photos » appelle pickFiles SANS capture');
        const ligne = await ligneDe('rc_a');
        [p1, p2] = ligne.page_ids;
        eq([ligne.status, ligne.kind, ligne.recipe_id, ligne.edition_id, typeof ligne.scan_session_id, (await db.getMany('source_pages', [p1, p2])).filter(Boolean).length, (await db.get('scan_sessions', ligne.scan_session_id))?.page_ids, reseau, ligne.appels], ['a_lancer', 'recette', 'rc_a', 'ed1', 'string', 2, [p1, p2], 0, 0], 'pages : AVANT tout appel, une ligne imports a_lancer avec page_ids [p1, p2], la séance liée, deux source_pages, appels 0');
        eq(root.etatRoute(), { importId: ligne.id, status: 'a_lancer', pageIds: [p1, p2], vol: false, discordance: null }, 'pages : etatRoute() reflète la ligne');
        ok(root.textContent.includes('2 photos ajoutées'), 'pages : « 2 photos ajoutées »');
        eq(root.querySelectorAll('.thumbs figure').length, 2, 'pages : deux vignettes, dans l’ordre');
        pick.suivant.push([]);
        bouton(root, 'Photographier').click();
        await attendre(() => pick.appels.length >= 2, 'pickFiles appelé');
        eq(pick.appels.at(-1), { accept: 'image/*', capture: 'environment', multiple: true }, 'pages : « Photographier » appelle pickFiles avec capture environment et multiple');
        eq(root.etatRoute().pageIds, [p1, p2], 'pages : un sélecteur refermé sans fichier n’écrit rien');
        bouton(root, 'Descendre la page 1').click();
        await attendre(() => root.etatRoute().pageIds[0] === p2, 'page descendue et écran redessiné');
        const actif = document.activeElement;
        eq([(await ligneDe('rc_a')).page_ids, actif?.dataset?.page, actif?.dataset?.role], [[p2, p1], p1, 'descendre'], 'pages : « Descendre la page 1 » → page_ids [p2, p1] ; document.activeElement = le bouton Descendre de la page déplacée');
        bouton(root, 'Monter la page 2').click();
        await attendre(() => root.etatRoute().pageIds[0] === p1, 'page remontée');
        eq([(await ligneDe('rc_a')).page_ids, document.activeElement?.dataset?.page, document.activeElement?.dataset?.role], [[p1, p2], p1, 'monter'], 'pages : « Monter la page 2 » → [p1, p2], le focus suit (Monter de la page déplacée)');
        bouton(root, 'Monter la page 1').click(); await tick(); await tick();
        eq((await ligneDe('rc_a')).page_ids, [p1, p2], 'pages : monter la première ne change rien (bouton toujours présent, sans effet)');
        bouton(root, 'Descendre la page 1').click();
        await attendre(() => root.etatRoute().pageIds[0] === p2, 'descendue à nouveau');
        bouton(root, 'Retirer la page 2').click();
        await attendre(() => root.etatRoute().pageIds.length === 1, 'page retirée');
        eq([(await ligneDe('rc_a')).page_ids, await db.count('source_pages'), (await db.get('scan_sessions', ligne.scan_session_id)).page_ids, (await ligneDe('rc_a')).status], [[p2], 2, [p1, p2], 'a_lancer'], 'pages : « Retirer la page 2 » détache p1 de l’import ([p2]) — la ligne source_pages et la séance restent (règle actuelle), même statut');
        ok(root.textContent.includes('1 photo ajoutée') && !root.textContent.includes('photos ajoutées'), 'pages : « 1 photo ajoutée » au singulier');
        const champ = root.querySelector('.thumbs figure input[type="number"]');
        champ.value = '133'; champ.dispatchEvent(new Event('change', { bubbles: true }));
        await attendre(async () => (await db.get('source_pages', p2)).printed_page === 133, 'p. imprimée écrite');
        eq((await db.get('source_pages', p2)).printed_page, 133, 'pages : le champ « p. imprimée » d’une vignette écrit source_pages.printed_page');
        pick.suivant.push([await imageDe('c.jpg', '#33c')]);
        bouton(root, 'Choisir des photos').click();
        await attendre(() => root.etatRoute().pageIds.length === 2, 'troisième page');
        const relue = await ligneDe('rc_a'); p3 = relue.page_ids[1];
        eq([relue.id === ligne.id, relue.page_ids[0], (await db.byIndex('imports', 'recipe_id', 'rc_a')).length, (await db.get('scan_sessions', ligne.scan_session_id)).page_ids.length], [true, p2, 1, 3], 'pages : une page de plus va à la MÊME ligne (un seul import, I-2), en fin de page_ids, dans la même séance');
        const champ0 = root.querySelector('.thumbs figure input[type="number"]'); // la vignette de p2 (133), redessinée
        champ0.value = '0'; champ0.dispatchEvent(new Event('change', { bubbles: true })); // T4-R1 : une saisie illisible (vide, « 0 », hors 1..9999) n'écrit rien
        await attendre(() => champ0.value === '133', 'champ remis à la valeur courante');
        eq([(await db.get('source_pages', p2)).printed_page, champ0.value], [133, '133'], 'pages (T4-R1) : une saisie illisible (« 0 ») n’efface pas le numéro — rien d’écrit, le champ reprend la valeur courante');
      });

      await bloc('photo du plat', async () => {
        const root = await monter('rc_a');
        const ligne = await ligneDe('rc_a');
        eq(root.etatRoute().importId, ligne.id, 'second passage : la même ligne imports est reprise (un seul a_lancer)');
        const img1 = await imageDe('plat.jpg', '#a52', 600, 400);
        pick.suivant.push([img1]);
        bouton(root, 'Choisir une image').click();
        await attendre(async () => !!(await ligneDe('rc_a')).photo_sha256, 'photo posée');
        eq(pick.appels.at(-1), { accept: 'image/*', multiple: false }, 'photo : « Choisir une image » → pickFiles sans capture, une seule image');
        const l1 = await ligneDe('rc_a');
        eq([l1.photo_sha256, l1.photo_origin, (await db.get('files', l1.photo_sha256))?.blob instanceof Blob, (await db.get('files', l1.photo_sha256))?.mime], [await sha256Hex(await IM.preparerPhotoLocale(img1)), 'image', true, 'image/jpeg'], 'photo : imports.photo_sha256 = empreinte du JPEG ré-encodé (le même mur qu’une couverture), photo_origin image, octets dans files');
        await attendre(() => !!root.querySelector('[data-role="apercu-plat"]')?.getAttribute('src'), 'aperçu');
        ok(root.querySelector('[data-role="apercu-plat"]').getAttribute('src').startsWith('blob:'), 'photo : un aperçu blob:');
        eq([!!bouton(root, 'Remplacer'), !!bouton(root, 'Retirer'), bouton(root, 'Prendre une photo'), bouton(root, 'Choisir une image')], [true, true, null, null], 'photo : avec une photo, « Remplacer » et « Retirer » remplacent les deux boutons d’ajout');
        bouton(root, 'Retirer').click();
        await attendre(async () => (await ligneDe('rc_a')).photo_sha256 === null, 'photo retirée');
        eq([(await ligneDe('rc_a')).photo_sha256, (await ligneDe('rc_a')).photo_origin, (await db.get('files', l1.photo_sha256))?.blob instanceof Blob], [null, null, true], 'photo : « Retirer » → null (le pointeur ; les octets restent)');
        await attendre(() => !!bouton(root, 'Prendre une photo'), 'boutons d’ajout revenus');
        pick.suivant.push([await imageDe('plat2.jpg', '#25a', 600, 400)]);
        bouton(root, 'Prendre une photo').click();
        await attendre(async () => !!(await ligneDe('rc_a')).photo_sha256, 'photo prise');
        eq([pick.appels.at(-1), (await ligneDe('rc_a')).photo_origin], [{ accept: 'image/*', capture: 'environment', multiple: false }, 'photo'], 'photo : « Prendre une photo » → capture environment, photo_origin photo');
        const sha2 = (await ligneDe('rc_a')).photo_sha256;
        await attendre(() => !!bouton(root, 'Remplacer'), 'Remplacer offert');
        pick.suivant.push([await imageDe('plat3.jpg', '#5a2', 600, 400)]);
        bouton(root, 'Remplacer').click();
        await attendre(async () => (await ligneDe('rc_a')).photo_sha256 !== sha2, 'photo remplacée');
        shaPhoto = (await ligneDe('rc_a')).photo_sha256;
        eq([shaPhoto !== sha2, typeof shaPhoto, (await ligneDe('rc_a')).photo_origin, pick.appels.at(-1)], [true, 'string', 'image', { accept: 'image/*', multiple: false }], 'photo : « Remplacer » → un nouveau sha256 (image choisie, sans capture)');
        pick.suivant.push([new File(['%PDF-1.4'], 'x.pdf', { type: 'application/pdf' })]);
        bouton(root, 'Remplacer').click();
        await attendre(() => dits.length === 1, 'refus dit');
        eq([(await ligneDe('rc_a')).photo_sha256, dits[0]], [shaPhoto, 'Cette image ne peut pas être lue ici. Essaie une autre photo.'], 'photo : un PDF est refusé par le mur (toast), la photo en place reste');
        eq([(await ligneDe('rc_a')).status, reseau], ['a_lancer', 0], 'photo : la ligne reste a_lancer, aucun réseau');
      });

      await bloc('extraire et enregistrer', async () => {
        const vus = []; const capture = db.onMutate;
        db.onMutate = (m) => { vus.push([Object.keys(m.puts).sort(), m.puts.imports?.[0]?.status ?? null, m.puts.imports?.[0]?.appels ?? null]); return capture ? capture(m) : {}; };
        try {
          const ff = fauxFetch();
          let appelsAuFetch = null; // la ligne RELUE par le fetch factice au moment de l'appel (T4-R1)
          const fetchLisant = async (u, o) => { appelsAuFetch = (await ligneDe('rc_a')).appels; return ff.fetch(u, o); };
          const root = await monter('rc_a', { deps: { fetch: fetchLisant } });
          const ligne = await ligneDe('rc_a');
          const b = bouton(root, 'Extraire et enregistrer');
          eq(b.disabled, false, 'extraction : avec des pages et une session, le bouton est allumé');
          vus.length = 0;
          b.click(); b.click(); // double clic
          await attendre(() => ff.appels.length >= 1, 'fetch parti');
          await tick();
          const enVol = await ligneDe('rc_a');
          const corps = JSON.parse(ff.appels[0].options.body);
          const images = corps.corps.messages[0].content.filter((c) => c.type === 'image').map((c) => c.source.data);
          const attendues = await Promise.all([p2, p3].map(async (id) => (await L.pagePourEnvoi((await db.get('files', (await db.get('source_pages', id)).sha256)).blob)).base64));
          eq([ff.appels.length, corps.outil, corps.corps.max_tokens, images.length, images[0] === attendues[0] && images[1] === attendues[1], ff.appels[0].options.headers.authorization, ff.appels[0].options.signal instanceof AbortSignal], [1, 'extraction', 6000, 2, true, 'Bearer ' + JETON, true], 'extraction : UN POST (double clic compris), outil extraction, max_tokens 6000, les images dans l’ordre de page_ids, la session en Bearer, un signal');
          eq([enVol.status, enVol.appels, enVol.document_id_vol, typeof enVol.started_at, typeof enVol.battement_at, enVol.erreur], ['en_cours', 1, UI.DOCUMENT_ID, 'string', 'string', null], 'extraction : la ligne est en_cours, appels 1 au départ du fetch, document_id_vol = DOCUMENT_ID, started_at et battement_at posés');
          eq([vus.filter((v) => v[1] === 'en_cours').map((v) => v[2]), appelsAuFetch], [[0, 1], 1], 'extraction (T4-R1) : l’écriture en_cours laisse appels à 0 ; une écriture SÉPARÉE le porte à 1 juste avant l’appel (la ligne relue par le fetch au moment de l’appel dit 1)');
          const statut = root.querySelector('.status[role="status"]');
          eq([statut?.textContent, statut?.nextElementSibling?.classList.contains('row'), !!bouton(statut?.nextElementSibling, 'Annuler'), root.etatRoute().vol, root.etatRoute().status, bouton(root, 'Extraire et enregistrer')?.disabled], ['Lecture des pages par l’assistant…', true, true, true, 'en_cours', true], 'extraction (R-VIS-8) : pendant le vol, .status[role=status] puis une .row avec « Annuler » ; etatRoute().vol vrai ; le primaire est éteint');
          eq([root.querySelectorAll('[data-role="monter"], [data-role="descendre"], [data-role="retirer"]').length, bouton(root, 'Photographier'), bouton(root, 'Choisir des photos'), bouton(root, 'Remplacer')?.disabled, bouton(root, 'Retirer')?.disabled], [0, null, null, true, true], 'extraction (T4-R1, décision 5) : pendant le vol, les pages sont figées (ni Monter/Descendre/Retirer, ni ajout) et la photo du plat aussi (« Remplacer » / « Retirer » éteints)');
          eq(await UI.lancerExtraction(ligne.id, { ctx: await ctxDe(), repo, fetch: ff.fetch }), { issue: 'refuse', raison: 'vol_tenu' }, 'extraction (I-7) : lancerExtraction refuse tant qu’un vol est tenu par ce document');
          eq(UI.volEnCours(), { importId: ligne.id }, 'extraction : volEnCours() nomme l’import du vol');
          ff.rendre[0](200, corpsOk());
          await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_a?v=')), 'navigation vers la fiche');
          const iVerif = vus.findIndex((v) => v[1] === 'a_verifier');
          const iEnr = vus.findIndex((v) => v[1] === 'enregistre');
          eq([iVerif >= 0, iEnr > iVerif, vus[iVerif]?.[0], vus[iEnr]?.[0]], [true, true, ['imports'], ['imports', 'recipe_versions', 'recipes', 'scan_sessions', 'source_pages']], 'extraction (I-3) : imports → a_verifier écrit SEUL, puis UNE transaction recipes + recipe_versions + source_pages + scan_sessions + imports(enregistre)');
          ok(!vus.slice(0, iVerif + 1).some((v) => v[0].includes('recipes') || v[0].includes('recipe_versions')), 'extraction (I-3) : aucune écriture recipes ni recipe_versions avant (ou avec) a_verifier');
          const fin = await db.get('imports', ligne.id);
          const rc = await db.get('recipes', 'rc_a');
          const vs = await db.byIndex('recipe_versions', 'recipe_id', 'rc_a');
          const pg = await db.getMany('source_pages', [p2, p3]);
          const ss = await db.get('scan_sessions', ligne.scan_session_id);
          eq([fin.status, fin.reponse_brute, typeof fin.finished_at, fin.resultat?.title, fin.model, fin.document_id_vol, typeof fin.duree_ms], ['enregistre', null, 'string', 'Tarte aux pommes', 'claude-x', null, 'number'], 'extraction : imports enregistre, reponse_brute null, finished_at posé, resultat et modèle gardés, vol libéré sur la ligne');
          eq([rc.id, rc.original_title, rc.availability, rc.verification_state, rc.photo_sha256, rc.photo_origin, rc.current_version_id === vs[0]?.id, rc.source_page_ids, rc.printed_page], ['rc_a', 'Tarte aux pommes', 'available', 'to_verify', shaPhoto, 'image', true, [p2, p3], 132], 'extraction (I-2) : la recette garde id et original_title, devient available / to_verify, photo du plat posée, pages liées, la version devient courante');
          eq([vs.length, vs[0].kind, vs[0].provenance.generated_by, vs[0].provenance.import_id, vs[0].provenance.model, vs[0].provenance.source_page_ids, vs[0].ingredients.length, vs[0].steps.length, vs[0].ingredients[1].uncertain], [1, 'extraction', 'ai', ligne.id, 'claude-x', [p2, p3], 2, 2, true], 'extraction : une version extraction, provenance ai / import_id / modèle du serveur / pages, lignes et étapes du modèle, uncertain recopié');
          eq(pg.map((p) => [p.kind, p.position, p.printed_page]), [['recipe', 1, 133], ['recipe', 2, null]], 'extraction : source_pages kind recipe, position 1..n, printed_page gardé (133 tapé) ; rien d’inventé sur la seconde');
          eq([ss.status, ss.recipe_ids], ['done', ['rc_a']], 'extraction : la séance passe done avec recipe_ids');
          eq([dits.at(-1), navs.at(-1)], ['Recette importée', `/recipes/rc_a?v=${vs[0].id}`], 'extraction : toast « Recette importée » et navigation vers la fiche sur la version');
          eq([UI.volEnCours(), root.etatRoute().vol, reseau], [null, false, 0], 'extraction : le vol est libéré, aucun réseau réel');
        } finally { db.onMutate = capture; }
      });

      await bloc('annuler pendant le vol (Review Focus 4)', async () => {
        const impC = await preparer('rc_c', 1);
        const ff = fauxFetch();
        const root = await monter('rc_c', { deps: { fetch: ff.fetch } });
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => ff.appels.length === 1 && !!bouton(root, 'Annuler'), 'fetch parti, Annuler affiché');
        bouton(root, 'Annuler').click();
        await attendre(async () => (await db.get('imports', impC)).status === 'echec' && root.etatRoute().status === 'echec', 'echec écrit et écran redessiné');
        const l = await db.get('imports', impC);
        eq([ff.appels[0].options.signal.aborted, l.status, l.erreur?.raison, l.document_id_vol, root.etatRoute().vol, UI.volEnCours(), l.appels], [true, 'echec', 'annule', null, false, null, 1], 'Annuler : le fetch est abandonné (signal), echec(annule), document_id_vol libéré, plus de vol, l’appel reste compté');
        ok(root.textContent.includes('Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.'), 'Annuler (I-4) : « Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre. »');
        eq([!!bouton(root, 'Relancer'), bouton(root, 'Annuler'), await db.byIndex('recipe_versions', 'recipe_id', 'rc_c'), (await db.get('recipes', 'rc_c')).availability], [true, null, [], 'reference_only'], 'Annuler : « Relancer » offert, plus d’« Annuler », rien sur la recette');
        // La réponse TARDIVE (spec § 3.1) : l'écriture a_verifier attend une porte ; « Annuler » passe entre la réponse reçue et l'écriture.
        let ouvrir; const porte = new Promise((r) => { ouvrir = r; });
        const espion = { ...repo, transitionner: async (store, key, opts) => { if (opts?.patch?.status === 'a_verifier') await porte; return repo.transitionner(store, key, opts); } };
        const ff2 = fauxFetch();
        const root2 = await monter('rc_c', { deps: { fetch: ff2.fetch, repo: espion } });
        bouton(root2, 'Relancer').click();
        await attendre(() => ff2.appels.length === 1, 'relance partie');
        const texteTardif = JSON.stringify(RECETTE);
        ff2.rendre[0](200, corpsOk(texteTardif));
        await new Promise((r) => setTimeout(r, 60)); // la réponse est lue et validée ; l'écriture a_verifier attend à la porte
        eq((await db.get('imports', impC)).status, 'en_cours', 'réponse tardive : la ligne est encore en_cours quand « Annuler » arrive');
        bouton(root2, 'Annuler').click();
        await attendre(async () => (await db.get('imports', impC)).status === 'echec', 'annulé');
        ouvrir();
        await attendre(async () => (await db.get('imports', impC)).reponse_brute !== null, 'reponse_brute posée');
        const tard = await db.get('imports', impC);
        eq([tard.status, tard.erreur?.raison, tard.reponse_brute, tard.resultat, (await db.get('recipes', 'rc_c')).availability, await db.byIndex('recipe_versions', 'recipe_id', 'rc_c'), root2.etatRoute().status], ['echec', 'annule', texteTardif, null, 'reference_only', [], 'echec'], 'réponse tardive (Review Focus 4) : aucune recette écrite, reponse_brute seule est gardée, l’état reste echec(annule)');
      });

      await bloc('incertain', async () => {
        const impD = await preparer('rc_d', 1);
        let refus = 1;
        const espion = { ...repo, transitionner: async (store, key, opts) => { if (opts?.patch?.status === 'a_verifier' && refus > 0) { refus -= 1; throw new Error('disque plein'); } return repo.transitionner(store, key, opts); } };
        const ff = fauxFetch([200, corpsOk()]);
        const root = await monter('rc_d', { deps: { fetch: ff.fetch, repo: espion } });
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(async () => (await db.get('imports', impD)).status === 'echec' && root.etatRoute().status === 'echec', 'echec incertain');
        const l = await db.get('imports', impD);
        eq([l.erreur?.raison, root.textContent.includes('L’appel a peut-être été compté ; relancer en coûtera un autre.'), !!bouton(root, 'Relancer'), await db.byIndex('recipe_versions', 'recipe_id', 'rc_d'), UI.volEnCours()], ['incertain', true, true, [], null], 'incertain : l’écriture a_verifier rejetée UNE fois → echec(incertain), phrase I-4, « Relancer », rien sur la recette, vol libéré');
        let deux = 2;
        espion.transitionner = async (store, key, opts) => { if (['a_verifier', 'echec'].includes(opts?.patch?.status) && deux > 0) { deux -= 1; throw new Error('disque plein'); } return repo.transitionner(store, key, opts); };
        const erreurs = []; const vraiErreur = console.error; console.error = (...a) => { erreurs.push(String(a[0])); };
        const rejets = []; const surRejet = (e) => { rejets.push(String(e.reason?.message ?? e.reason)); e.preventDefault(); }; // T4-R1 : « ne plante pas » = aucune promesse rejetée sans gestionnaire
        window.addEventListener('unhandledrejection', surRejet);
        try {
          bouton(root, 'Relancer').click();
          await attendre(() => ff.appels.length === 2, 'relance partie');
          await attendre(() => UI.volEnCours() === null, 'vol libéré');
          await tick(); await tick(); await tick();
        } finally { console.error = vraiErreur; window.removeEventListener('unhandledrejection', surRejet); }
        eq([(await db.get('imports', impD)).status, deux, erreurs.some((e) => e.includes('import_cible')), rejets, root.etatRoute().status, root.etatRoute().vol, root.textContent.includes('En cours sur un autre écran')], ['en_cours', 0, true, [], 'en_cours', false, true], 'incertain : rejetée DEUX fois → la ligne reste en_cours (interrompu au prochain démarrage), l’erreur est journalisée, aucun rejet non géré, l’écran redessiné dit l’état réel (en_cours sans vol tenu)');
        await db.put('imports', { ...(await db.get('imports', impD)), status: 'ignore' }); // rangement : plus d’import ouvert sur rc_d
      });

      await bloc('discordance et reponse_brute (Review Focus 2)', async () => {
        const impB = await preparer('rc_b', 1);
        const json = JSON.stringify({ ...RECETTE, title: 'Tarte aux poires', printed_page: 133 });
        const texteLong = json + '😀'.repeat(20000 - Array.from(json).length);
        eq(Array.from(texteLong).length, 20000, 'fixture : une réponse de 20 000 points de code (emoji : deux unités UTF-16 chacun)');
        const ff = fauxFetch([200, corpsOk(texteLong)]);
        const root = await monter('rc_b', { deps: { fetch: ff.fetch } });
        const avantRc = await db.get('recipes', 'rc_b');
        bouton(root, 'Extraire et enregistrer').click();
        // T4-R2 : attendre le panneau DESSINÉ (le verdict est posé deux lectures avant le dessin : un faux rouge a été vu dans cette fenêtre).
        await attendre(() => root.etatRoute().status === 'a_verifier' && !!root.querySelector('[data-role="discordance"]'), 'a_verifier avec le panneau de discordance');
        eq([root.querySelectorAll('[data-role="monter"], [data-role="descendre"], [data-role="retirer"]').length, bouton(root, 'Photographier'), bouton(root, 'Choisir des photos'), bouton(root, 'Prendre une photo')?.disabled], [0, null, null, false], 'discordance (T4-R1, décision 5) : en a_verifier les pages sont figées (ni Monter/Descendre/Retirer, ni ajout) ; la photo du plat reste modifiable (lue à l’enregistrement)');
        const l = await db.get('imports', impB);
        eq([l.status, Array.from(l.reponse_brute).length, l.resultat?.title, l.resultat?.ingredients?.length, JSON.stringify(l).length < 512 * 1024], ['a_verifier', 16000, 'Tarte aux poires', 2, true], 'reponse_brute : coupée à 16 000 points de code, resultat intact, la ligne tient sous 512 Kio');
        eq(root.etatRoute().discordance, { ok: false, raison: 'titre', titreLu: 'Tarte aux poires', pageLue: 133 }, 'discordance (Review Focus 2) : « Tarte aux poires » lue pour « Tarte aux pommes » → verdict titre, avant toute écriture');
        const panneau = root.querySelector('[data-role="discordance"]');
        eq([!!panneau, [...(panneau?.querySelectorAll('button') ?? [])].map((b) => b.textContent), panneau?.textContent.includes('Tarte aux poires') && panneau?.textContent.includes('Tarte aux pommes') && panneau?.textContent.includes('p. 132')], [true, ['Rattacher', 'Garder la lecture sans l’enregistrer', 'Changer les pages'], true], 'discordance : panneau à trois boutons, qui nomme les deux titres et la page de la référence');
        eq([await db.get('recipes', 'rc_b'), await db.byIndex('recipe_versions', 'recipe_id', 'rc_b'), bouton(root, 'Enregistrer cette lecture')], [avantRc, [], null], 'discordance : rien n’est écrit sur la recette ; la question remplace la rangée d’enregistrement');
        bouton(panneau, 'Garder la lecture sans l’enregistrer').click();
        await attendre(() => !root.querySelector('[data-role="discordance"]'), 'panneau fermé');
        eq([(await db.get('imports', impB)).status, !!bouton(root, 'Enregistrer cette lecture'), !!bouton(root, 'Changer les pages'), root.textContent.includes('Lecture reçue le'), bouton(root, 'Extraire et enregistrer'), !!lien(root, 'Retour à la fiche')], ['a_verifier', true, true, true, null, true], 'discordance → « Garder la lecture sans l’enregistrer » : reste a_verifier ; l’écran offre « Enregistrer cette lecture », « Changer les pages », « Lecture reçue le {d} »');
        bouton(root, 'Enregistrer cette lecture').click();
        await attendre(() => !!root.querySelector('[data-role="discordance"]'), 'la question revient');
        eq([(await db.get('imports', impB)).status, ff.appels.length], ['a_verifier', 1], '« Enregistrer cette lecture » : la discordance est redemandée (jamais de rattachement silencieux), aucun appel de plus');
        bouton(root.querySelector('[data-role="discordance"]'), 'Changer les pages').click();
        await attendre(async () => (await db.get('imports', impB)).status === 'a_lancer' && root.etatRoute().status === 'a_lancer', 'a_lancer');
        eq([(await db.get('imports', impB)).resultat, !!bouton(root, 'Extraire et enregistrer'), root.etatRoute().discordance], [null, true, null], '« Changer les pages » → a_lancer, résultat effacé, le primaire revient');
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => !!root.querySelector('[data-role="discordance"]'), 'discordance à nouveau');
        bouton(root.querySelector('[data-role="discordance"]'), 'Rattacher').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_b?v=')), 'enregistrée');
        const rc = await db.get('recipes', 'rc_b'); const [v] = await db.byIndex('recipe_versions', 'recipe_id', 'rc_b');
        eq([rc.original_title, rc.availability, v?.provenance?.titre_lu, (await db.get('imports', impB)).status, ff.appels.length, dits.at(-1)], ['Tarte aux pommes', 'available', 'Tarte aux poires', 'enregistre', 2, 'Recette importée'], '« Rattacher » : la fiche garde SON titre, le titre lu va en provenance.titre_lu, import enregistre');
      });

      await bloc('I-5 remplacer ?', async () => {
        const impE = await preparer('rc_e', 1);
        await db.put('imports', { ...(await db.get('imports', impE)), photo_sha256: shaPhoto, photo_origin: 'photo' });
        const ff = fauxFetch([200, corpsOk()]);
        const root = await monter('rc_e', { deps: { fetch: ff.fetch } });
        eq([...root.querySelectorAll('.badge')].map((b) => b.textContent), ['Partiellement disponible'], 'I-5 : une partial porte son badge');
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => !!root.querySelector('[data-role="remplacer"]'), 'question « Remplacer ? »');
        const q = root.querySelector('[data-role="remplacer"]');
        eq([q.textContent.includes('Remplacer par cette lecture ?'), [...q.querySelectorAll('button')].map((b) => b.textContent), (await db.get('imports', impE)).status, root.etatRoute().discordance?.ok, root.querySelector('[data-role="discordance"]')], [true, ['Garder ma version', 'Remplacer'], 'a_verifier', true, null], 'I-5 (N4) : version courante saisie à la main → « Remplacer par cette lecture ? », « Garder ma version » d’abord (défaut non), reste a_verifier ; titre concordant, pas de discordance');
        eq(q.textContent.includes('Une version écrite à la main existe.'), true, 'I-5 (ronde finale 2) : posée pour une version écrite à la main, la question le dit (la phrase n’est tue que lorsque seule la couverture des pages la pose)');
        bouton(q, 'Garder ma version').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_e?v=')), 'enregistrée');
        const rc = await db.get('recipes', 'rc_e'); const vs = await db.byIndex('recipe_versions', 'recipe_id', 'rc_e'); const neuve = vs.find((v) => v.id !== 'rv_e_main');
        const pages = await db.getMany('source_pages', (await db.get('imports', impE)).page_ids);
        eq([rc.current_version_id, rc.availability, rc.verification_state, rc.ingredient_ids, rc.source_page_ids, rc.photo_sha256, rc.photo_origin, neuve?.kind, neuve?.parent_version_id, pages.map((p) => p.kind), (await db.get('imports', impE)).status], ['rv_e_main', 'partial', 'verified', ['ing_x'], pages.map((p) => p.id), shaPhoto, 'photo', 'extraction', 'rv_e_main', ['recipe'], 'enregistre'], 'I-5 « non » : la version est ajoutée sans devenir courante ; current_version_id, availability, verification_state, ingredient_ids intacts ; source_page_ids (union), kind recipe et photo posés quand même');
        eq(navs.at(-1), `/recipes/rc_e?v=${neuve.id}`, 'I-5 « non » : la fiche s’ouvre sur la version ajoutée');
        // « Remplacer » : la lecture devient courante
        const impM = await preparer('rc_m', 1);
        const rootM = await monter('rc_m', { deps: { fetch: ff.fetch } });
        bouton(rootM, 'Extraire et enregistrer').click();
        await attendre(() => !!rootM.querySelector('[data-role="remplacer"]'), 'question');
        bouton(rootM.querySelector('[data-role="remplacer"]'), 'Remplacer').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_m?v=')), 'enregistrée');
        const rcM = await db.get('recipes', 'rc_m'); const neuveM = (await db.byIndex('recipe_versions', 'recipe_id', 'rc_m')).find((v) => v.id !== 'rv_m_main');
        eq([rcM.current_version_id === neuveM?.id, rcM.availability, rcM.verification_state, neuveM?.parent_version_id, (await db.get('imports', impM)).status], [true, 'available', 'to_verify', 'rv_m_main', 'enregistre'], 'I-5 « oui » : « Remplacer » → la lecture devient courante (parent = l’ancienne courante), fiche recomposée');
      });

      await bloc('relecture et autre onglet', async () => {
        const impF = await preparer('rc_f', 1);
        const ff = fauxFetch([200, corpsOk({ ...RECETTE, title: 'Tarte aux pommes de ma grand-mère' })]);
        const root = await monter('rc_f', { deps: { fetch: ff.fetch } });
        await db.put('recipes', { ...(await db.get('recipes', 'rc_f')), original_title: 'Tarte de grand-mère', tags: ['neuf'] }); // modifiée entre l’ouverture et le clic
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_f?v=')), 'enregistrée');
        const rc = await db.get('recipes', 'rc_f');
        eq([rc.original_title, rc.tags, rc.availability, (await db.get('imports', impF)).status], ['Tarte de grand-mère', ['neuf'], 'available', 'enregistre'], 'relecture (C4) : la fiche écrite porte la valeur RÉCENTE de la référence (relue juste avant la transaction), pas celle du rendu');
        navs.length = 0; dits.length = 0;
        const impG = await preparer('rc_g', 1);
        const ff2 = fauxFetch();
        const root2 = await monter('rc_g', { deps: { fetch: ff2.fetch } });
        let parLAutre = false; // les écritures jouées par « l'autre onglet » ne comptent pas parmi les puts de l'écran
        const vus = []; const capture = db.onMutate; db.onMutate = (m) => { if (!parLAutre) vus.push(Object.keys(m.puts)); return capture ? capture(m) : {}; };
        try {
          await db.put('imports', { ...(await db.get('imports', impG)), status: 'enregistre' }); // un autre onglet a enregistré
          vus.length = 0;
          bouton(root2, 'Extraire et enregistrer').click();
          await attendre(() => root2.etatRoute().importId === null && UI.volEnCours() === null, 'écran redessiné sans import ouvert, vol libéré'); // vague finale (m2) : l'écran se redessine dès la pose du vol
          eq([ff2.appels.length, vus, (await db.get('imports', impG)).status, root2.etatRoute().status, UI.volEnCours(), [...dits], [...navs]], [0, [], 'enregistre', null, null, [], []], 'autre onglet (I-10) : import déjà enregistre au clic → TransitionRefusee, aucun fetch, aucun put, écran redessiné, ni toast ni navigation');
          const impH = await preparer('rc_h', 1);
          await db.put('imports', { ...(await db.get('imports', impH)), status: 'a_verifier', resultat: RECETTE, model: 'claude-x', reponse_brute: 'x' });
          const root3 = await monter('rc_h', { deps: { fetch: interdit } });
          eq([!!bouton(root3, 'Enregistrer cette lecture'), bouton(root3, 'Extraire et enregistrer'), root3.textContent.includes('Lecture reçue le')], [true, null, true], 'reprise : une ligne a_verifier ouvre l’écran en mode « Enregistrer cette lecture » (sans appel)');
          await db.put('imports', { ...(await db.get('imports', impH)), status: 'enregistre' });
          vus.length = 0;
          bouton(root3, 'Enregistrer cette lecture').click();
          await attendre(() => root3.etatRoute().importId === null, 'redessiné');
          eq([vus, await db.byIndex('recipe_versions', 'recipe_id', 'rc_h'), (await db.get('recipes', 'rc_h')).availability, reseau, [...dits], [...navs]], [[], [], 'reference_only', 0, [], []], 'autre onglet (I-10) : enregistre juste avant « Enregistrer cette lecture » → aucun put, rien sur la recette, aucun appel, ni « Recette importée » ni navigation');
          // T4-R1 : l'autre onglet enregistre ENTRE la relecture de la ligne et la transaction (l'espion le joue juste avant l'écriture `enregistre`) :
          // la transaction est refusée, et rien ne dit « importé » (un « sauvegardé » sans écriture est interdit).
          const impP = await preparer('rc_p', 1);
          await db.put('imports', { ...(await db.get('imports', impP)), status: 'a_verifier', resultat: RECETTE, model: 'claude-x', reponse_brute: 'x' });
          // Vague finale : la clôture est un patch-FONCTION (liée à la lecture, m3) ; l'espion la reconnaît à ses puts (la recette part avec elle).
          const estCloture = (opts) => Array.isArray(opts?.puts?.recipes) && opts?.attendus?.includes('a_verifier');
          const espionP = { ...repo, transitionner: async (store, key, opts) => { if (estCloture(opts)) { parLAutre = true; await db.put('imports', { ...(await db.get('imports', key)), status: 'enregistre' }); parLAutre = false; } return repo.transitionner(store, key, opts); } };
          const root4 = await monter('rc_p', { deps: { fetch: interdit, repo: espionP } });
          vus.length = 0; dits.length = 0; navs.length = 0;
          bouton(root4, 'Enregistrer cette lecture').click();
          await attendre(() => root4.etatRoute().importId === null, 'redessiné sans import ouvert');
          eq([vus, [...dits], [...navs], await db.byIndex('recipe_versions', 'recipe_id', 'rc_p'), (await db.get('recipes', 'rc_p')).availability, (await db.get('imports', impP)).status], [[], [], [], [], 'reference_only', 'enregistre'], 'autre onglet (I-10, T4-R1) : enregistre ENTRE la relecture et la transaction → TransitionRefusee, aucun put, ni « Recette importée » ni navigation vers une version qui n’existe pas');
          // Vague finale (m3) : une AUTRE lecture (R2, même ligne, même statut a_verifier) arrive ENTRE la relecture et la transaction : la clôture vaut pour
          // la lecture dont la recette a été fabriquée (R1) — refusée, rien n'est écrit, R2 n'est jamais close sans avoir été vue.
          const impW = await preparer('rc_w', 1);
          await db.put('imports', { ...(await db.get('imports', impW)), status: 'a_verifier', resultat: RECETTE, started_at: NOW, model: 'claude-x', reponse_brute: 'x' });
          const R2 = { ...RECETTE, title: 'Tarte aux pommes R2', ingredients: [{ source_text: '9 pommes', uncertain: false }] };
          const espionW = { ...repo, transitionner: async (store, key, opts) => { if (estCloture(opts)) { parLAutre = true; await db.put('imports', { ...(await db.get('imports', key)), started_at: new Date().toISOString(), resultat: R2 }); parLAutre = false; } return repo.transitionner(store, key, opts); } };
          const root5 = await monter('rc_w', { deps: { fetch: interdit, repo: espionW } });
          vus.length = 0; dits.length = 0; navs.length = 0;
          bouton(root5, 'Enregistrer cette lecture').click();
          await attendre(async () => (await db.get('imports', impW)).resultat?.title === 'Tarte aux pommes R2' && !root5.querySelector('[data-role="discordance"]') && !!bouton(root5, 'Enregistrer cette lecture'), 'R2 arrivée, écran redessiné');
          await tick(); await tick();
          eq([vus, await db.byIndex('recipe_versions', 'recipe_id', 'rc_w'), (await db.get('recipes', 'rc_w')).availability, (await db.get('imports', impW)).status, (await db.get('imports', impW)).reponse_brute, [...dits], [...navs]], [[], [], 'reference_only', 'a_verifier', 'x', [], []], 'enregistrer (vague finale, m3) : une autre lecture arrivée entre la relecture et la transaction → clôture refusée, aucune recette ni version, R2 reste a_verifier (jamais close sans avoir été vue), ni toast ni navigation');
        } finally { db.onMutate = capture; }
      });

      await bloc('I-1 : un résultat relu du journal est revalidé (T4-R1)', async () => {
        const impL = await preparer('rc_l', 1);
        const HOSTILE = { ...RECETTE, title: 'HOSTILE-' + 'x'.repeat(201) };
        await db.put('imports', { ...(await db.get('imports', impL)), status: 'a_verifier', resultat: HOSTILE, model: 'claude-x', reponse_brute: 'x' });
        const enFile = async () => (await db.getAll('outbox')).filter((e) => e.store === 'imports' && e.id === impL).length;
        const n0 = await enFile();
        const root = await monter('rc_l', { deps: { fetch: interdit } });
        const l1 = await db.get('imports', impL);
        eq([l1.status, l1.erreur?.raison, l1.resultat, root.textContent.includes('HOSTILE-'), root.etatRoute().status, !!bouton(root, 'Relancer'), bouton(root, 'Enregistrer cette lecture'), (await enFile()) - n0, reseau], ['echec', 'illisible', null, false, 'echec', true, null, 1, 0], 'I-1 au montage : un resultat hors bornes (titre de 201 points de code) → a_verifier → echec(illisible) (ratifiée T4-R1), resultat null, rien du texte à l’écran, « Relancer » ; UNE entrée d’outbox (origine local : la seule écriture d’une visite), aucun appel');
        await db.put('imports', { ...(await db.get('imports', impL)), status: 'a_verifier', resultat: 'pas une recette', erreur: null });
        const root2 = await monter('rc_l', { deps: { fetch: interdit } });
        eq([(await db.get('imports', impL)).status, (await db.get('imports', impL)).erreur?.raison, (await db.get('imports', impL)).resultat, root2.etatRoute().status], ['echec', 'illisible', null, 'echec'], 'I-1 au montage : un resultat qui n’est pas une recette (chaîne) → echec(illisible), resultat null');
        // Au clic : la ligne redevient a_verifier VALIDE ; sans session, aucune carte « Connecte-toi » (« Enregistrer cette lecture » n'appelle rien, T4-R1) ;
        // puis un autre appareil y dépose un résultat hostile avant le clic.
        await db.put('imports', { ...(await db.get('imports', impL)), status: 'a_verifier', resultat: RECETTE, erreur: null });
        const rootSans = await monter('rc_l', { session: null, deps: { fetch: interdit } });
        eq([rootSans.querySelector('[data-role="connexion-ia"]'), rootSans.textContent.includes('Connecte-toi pour utiliser l’assistant.'), bouton(rootSans, 'Enregistrer cette lecture')?.disabled], [null, false, false], 'a_verifier sans session (T4-R1) : pas de carte « Connecte-toi » — « Enregistrer cette lecture » reste allumé et n’appelle rien');
        const root3 = await monter('rc_l', { deps: { fetch: interdit } });
        eq(!!bouton(root3, 'Enregistrer cette lecture'), true, 'I-1 : résultat valide → mode « Enregistrer cette lecture »');
        await db.put('imports', { ...(await db.get('imports', impL)), resultat: HOSTILE });
        const vus = []; const capture = db.onMutate; db.onMutate = (m) => { vus.push(Object.keys(m.puts).sort()); return capture ? capture(m) : {}; };
        try {
          bouton(root3, 'Enregistrer cette lecture').click();
          await attendre(async () => (await db.get('imports', impL)).status === 'echec' && root3.etatRoute().status === 'echec', 'echec');
        } finally { db.onMutate = capture; }
        eq([vus, await db.byIndex('recipe_versions', 'recipe_id', 'rc_l'), (await db.get('recipes', 'rc_l')).availability, (await db.get('imports', impL)).erreur?.raison, (await db.get('imports', impL)).resultat, root3.textContent.includes('HOSTILE-'), [...dits], [...navs], reseau], [[['imports']], [], 'reference_only', 'illisible', null, false, [], [], 0], 'I-1 au clic : une ligne devenue hostile entre-temps → echec(illisible) écrit SEUL ; ni recipes ni recipe_versions, rien du texte à l’écran, aucun toast, aucune navigation');
        // Deux champs relus du journal passent dans la fiche : bornés avant (model ≤ 80 points de code, photo_sha256 = empreinte hexadécimale de 64).
        const impS = await preparer('rc_s', 1);
        await db.put('imports', { ...(await db.get('imports', impS)), status: 'a_verifier', resultat: RECETTE, model: 'm'.repeat(81), photo_sha256: '../x', photo_origin: 'image', reponse_brute: 'x' });
        const rootS = await monter('rc_s', { deps: { fetch: interdit } });
        bouton(rootS, 'Enregistrer cette lecture').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_s?v=')), 'enregistrée');
        const [vS] = await db.byIndex('recipe_versions', 'recipe_id', 'rc_s'); const rS = await db.get('recipes', 'rc_s');
        eq([vS?.provenance?.model, rS.photo_sha256, rS.photo_origin, rS.availability, (await db.get('imports', impS)).status], [null, null, null, 'available', 'enregistre'], 'T4-R1 : un model de 81 points de code et un photo_sha256 qui n’est pas une empreinte de 64 hexadécimales sont relus comme nuls — la version et la fiche n’en portent rien');
      });

      await bloc('rattacher lié à LA lecture (D-6, deux onglets ; T4-R1)', async () => {
        const impN = await preparer('rc_n', 1);
        const ff = fauxFetch([200, corpsOk({ ...RECETTE, title: 'Tarte aux poires' })]);
        const root = await monter('rc_n', { deps: { fetch: ff.fetch } });
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => !!root.querySelector('[data-role="discordance"]'), 'discordance');
        bouton(root.querySelector('[data-role="discordance"]'), 'Rattacher').click();
        await attendre(() => !!root.querySelector('[data-role="remplacer"]'), 'question « Remplacer ? » (version manuelle)');
        // L'autre onglet : « Changer les pages », d'autres photos, « Extraire » → une NOUVELLE lecture sur la même ligne (même id, même statut a_verifier).
        await db.put('imports', { ...(await db.get('imports', impN)), started_at: '2026-10-19T12:05:00.000Z', resultat: { ...RECETTE, title: 'Gratin de courgettes' }, reponse_brute: 'y' });
        const vus = []; const capture = db.onMutate; db.onMutate = (m) => { vus.push(Object.keys(m.puts)); return capture ? capture(m) : {}; };
        try {
          bouton(root.querySelector('[data-role="remplacer"]'), 'Garder ma version').click();
          await attendre(() => !!root.querySelector('[data-role="discordance"]') || navs.length > 0, 'décision rendue');
          await tick();
        } finally { db.onMutate = capture; }
        const panneau = root.querySelector('[data-role="discordance"]');
        eq([!!panneau, panneau?.textContent.includes('Gratin de courgettes'), vus, [...navs], (await db.get('imports', impN)).status, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_n')).map((v) => v.id), (await db.get('recipes', 'rc_n')).current_version_id], [true, true, [], [], 'a_verifier', ['rv_n_main'], 'rv_n_main'], 'D-6 (T4-R1) : « Rattacher » répondu pour « Tarte aux poires » ne vaut pas pour « Gratin de courgettes » arrivée entre-temps — la discordance est redemandée, rien n’est écrit');
        await db.put('imports', { ...(await db.get('imports', impN)), status: 'ignore' });
      });

      // Ronde 2 (T4-R2) : la réponse à une question vaut pour la lecture pour laquelle la question a été POSÉE, jamais pour la ligne relue au clic.
      // Trois fenêtres : « Rattacher » cliqué après l'arrivée d'une autre lecture (D-6), « Remplacer » cliqué après l'arrivée d'une autre lecture
      // (I-5), et un redessin entre les deux (la question de l'ancienne lecture ne doit pas survivre à la nouvelle).
      await bloc('résidu D-6 : « Rattacher » cliqué après l’arrivée d’une autre lecture (T4-R2)', async () => {
        const impT = await preparer('rc_t', 1);
        const ff = fauxFetch([200, corpsOk({ ...RECETTE, title: 'Tarte aux poires' })]);
        const root = await monter('rc_t', { deps: { fetch: ff.fetch } });
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => !!root.querySelector('[data-role="discordance"]'), 'discordance');
        // L'autre onglet (ou l'autre appareil, par la synchro) : une NOUVELLE lecture sur la même ligne pendant que le panneau reste ouvert ici
        // (/recipes/*/importer est une ROUTE_DE_SAISIE : la passe ne reconstruit pas l'écran, le panneau reste).
        await db.put('imports', { ...(await db.get('imports', impT)), started_at: '2026-10-19T12:05:00.000Z', resultat: { ...RECETTE, title: 'Gratin de courgettes' }, reponse_brute: 'y' });
        const vus = []; const capture = db.onMutate; db.onMutate = (m) => { vus.push(Object.keys(m.puts)); return capture ? capture(m) : {}; };
        try {
          bouton(root.querySelector('[data-role="discordance"]'), 'Rattacher').click();
          await attendre(async () => navs.length > 0 || (await db.get('imports', impT)).status === 'enregistre' || !!root.querySelector('[data-role="discordance"]')?.textContent.includes('Gratin de courgettes'), 'changement d’état');
          await tick(); await tick();
        } finally { db.onMutate = capture; }
        const panneau = root.querySelector('[data-role="discordance"]');
        eq([!!panneau, panneau?.textContent.includes('Gratin de courgettes'), vus, [...navs], (await db.get('imports', impT)).status, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_t')).length], [true, true, [], [], 'a_verifier', 0], 'résidu D-6 (T4-R2) : « Rattacher » répondu pour « Tarte aux poires » ne vaut pas pour « Gratin de courgettes » arrivée AVANT le clic : la discordance est redemandée avec le nouveau titre, rien n’est écrit, aucune navigation');
        // La réponse à la question POSÉE pour « Gratin de courgettes », elle, vaut.
        bouton(panneau, 'Rattacher').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_t?v=')), 'enregistrée');
        const [v] = await db.byIndex('recipe_versions', 'recipe_id', 'rc_t');
        eq([v?.provenance?.titre_lu, (await db.get('imports', impT)).status, (await db.get('recipes', 'rc_t')).original_title, ff.appels.length], ['Gratin de courgettes', 'enregistre', 'Tarte aux pommes', 1], 'résidu D-6 (T4-R2) : « Rattacher » répondu à la question posée pour « Gratin de courgettes » l’enregistre (titre lu en provenance), la fiche garde son titre, aucun appel de plus');
      });

      await bloc('résidu I-5 : « Remplacer » cliqué après l’arrivée d’une autre lecture (T4-R2)', async () => {
        const impU = await preparer('rc_u', 1);
        const ff = fauxFetch([200, corpsOk()]);
        const root = await monter('rc_u', { deps: { fetch: ff.fetch } });
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => !!root.querySelector('[data-role="remplacer"]'), 'question « Remplacer ? »');
        const ancien = root.querySelector('[data-role="remplacer"]');
        // Une autre lecture, CONCORDANTE (même titre, 8 portions), arrive sur la même ligne : « Remplacer » répondu pour la première ne doit pas
        // mettre la seconde en avant sans qu'elle ait été vue (I-5 : la question doit être reposée).
        await db.put('imports', { ...(await db.get('imports', impU)), started_at: '2026-10-19T12:05:00.000Z', resultat: { ...RECETTE, servings: 8 }, reponse_brute: 'y' });
        const vus = []; const capture = db.onMutate; db.onMutate = (m) => { vus.push(Object.keys(m.puts)); return capture ? capture(m) : {}; };
        try {
          bouton(ancien, 'Remplacer').click();
          await attendre(async () => navs.length > 0 || (await db.get('imports', impU)).status === 'enregistre' || (root.querySelector('[data-role="remplacer"]') !== null && root.querySelector('[data-role="remplacer"]') !== ancien), 'décision rendue');
          await tick(); await tick();
        } finally { db.onMutate = capture; }
        const q = root.querySelector('[data-role="remplacer"]');
        eq([!!q && q !== ancien, root.querySelector('[data-role="discordance"]'), vus, [...navs], (await db.get('imports', impU)).status, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_u')).map((x) => x.id), (await db.get('recipes', 'rc_u')).current_version_id], [true, null, [], [], 'a_verifier', ['rv_u_main'], 'rv_u_main'], 'résidu I-5 (T4-R2) : « Remplacer » répondu pour la première lecture ne s’applique pas à la seconde arrivée entre-temps : la question est reposée, rien n’est écrit, la version manuelle reste courante');
        bouton(q, 'Remplacer').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_u?v=')), 'enregistrée');
        const rcU = await db.get('recipes', 'rc_u'); const neuve = (await db.byIndex('recipe_versions', 'recipe_id', 'rc_u')).find((x) => x.id !== 'rv_u_main');
        eq([neuve?.servings, rcU.current_version_id === neuve?.id, (await db.get('imports', impU)).status, ff.appels.length], [8, true, 'enregistre', 1], 'résidu I-5 (T4-R2) : « Remplacer » répondu à la question reposée vaut pour la seconde lecture (8 portions), qui devient courante ; aucun appel de plus');
      });

      await bloc('résidu D-6 : un redessin ne montre plus l’ancien titre pour une nouvelle lecture (T4-R2)', async () => {
        const impV = await preparer('rc_v', 1);
        const ff = fauxFetch([200, corpsOk({ ...RECETTE, title: 'Tarte aux poires' })]);
        const root = await monter('rc_v', { deps: { fetch: ff.fetch } });
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => !!root.querySelector('[data-role="discordance"]'), 'discordance');
        await db.put('imports', { ...(await db.get('imports', impV)), started_at: '2026-10-19T12:05:00.000Z', resultat: { ...RECETTE, title: 'Gratin de courgettes' }, reponse_brute: 'y' });
        // Un redessin venu d'ailleurs (la fin d'un lancement, même refusé, sur un autre import de ce document notifie toutes les vues) : l'écran relit la ligne.
        eq((await UI.lancerExtraction('imp_inexistant', { ctx: await ctxDe(), repo })).raison, 'inconnu', 'fixture (T4-R2) : un lancement refusé (import inconnu) notifie les vues montées');
        await attendre(() => !root.querySelector('[data-role="discordance"]'), 'panneau fermé');
        await tick();
        eq([!!bouton(root, 'Enregistrer cette lecture'), root.etatRoute().discordance, root.textContent.includes('Tarte aux poires'), (await db.get('imports', impV)).status, [...navs]], [true, null, false, 'a_verifier', []], 'redessin (T4-R2) : la question posée pour « Tarte aux poires » ne survit pas à l’arrivée de « Gratin de courgettes » : plus de panneau ni d’ancien titre, « Enregistrer cette lecture » revient, rien n’est écrit');
        bouton(root, 'Enregistrer cette lecture').click();
        await attendre(() => !!root.querySelector('[data-role="discordance"]')?.textContent.includes('Gratin de courgettes'), 'discordance pour la nouvelle lecture');
        eq([(await db.get('imports', impV)).status, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_v')).length], ['a_verifier', 0], 'redessin (T4-R2) : « Enregistrer cette lecture » redemande la discordance pour « Gratin de courgettes », rien n’est écrit');
        await db.put('imports', { ...(await db.get('imports', impV)), status: 'ignore' });
      });

      await bloc('fiche supprimée entre le rendu et l’enregistrement (R57 ; T4-R1)', async () => {
        const impO = await preparer('rc_o', 1);
        await db.put('imports', { ...(await db.get('imports', impO)), status: 'a_verifier', resultat: RECETTE, model: 'claude-x', reponse_brute: 'x' });
        const root = await monter('rc_o', { deps: { fetch: interdit } });
        await repo.remove('recipes', 'rc_o'); // supprimée sur un autre appareil (tombale synchronisée)
        const vus = []; const capture = db.onMutate; db.onMutate = (m) => { vus.push(Object.keys(m.puts)); return capture ? capture(m) : {}; };
        try {
          bouton(root, 'Enregistrer cette lecture').click();
          await attendre(() => dits.length > 0 || navs.length > 0, 'réponse de l’écran');
          await tick(); await tick();
        } finally { db.onMutate = capture; }
        eq([[...dits], [...navs], vus, await db.get('recipes', 'rc_o'), await db.byIndex('recipe_versions', 'recipe_id', 'rc_o'), (await db.get('imports', impO)).status], [['Recette introuvable.'], ['/library'], [], undefined, [], 'a_verifier'], 'fiche supprimée (T4-R1) : « Enregistrer cette lecture » n’écrit RIEN (la copie du ctx ne ressuscite pas la fiche), dit « Recette introuvable. » et ramène à la bibliothèque');
        await db.put('imports', { ...(await db.get('imports', impO)), status: 'ignore' });
      });

      await bloc('vol tenu pour un autre import ; écran quitté pendant le vol (T4-R1)', async () => {
        const impQ = await preparer('rc_q', 1); const impR = await preparer('rc_r', 1);
        const ff = fauxFetch();
        const rootQ = await monter('rc_q', { deps: { fetch: ff.fetch } });
        const rootR = await monter('rc_r', { deps: { fetch: ff.fetch } });
        bouton(rootQ, 'Extraire et enregistrer').click();
        bouton(rootR, 'Extraire et enregistrer').click(); // dans le même tour : le vol de rc_q est déjà tenu (posé avant tout await), rc_r pas encore redessinée
        await attendre(() => ff.appels.length === 1, 'vol sur rc_q');
        await tick(); await tick();
        eq([dits.at(-1), ff.appels.length, (await db.get('imports', impR)).status, (await db.get('imports', impR)).appels, (await db.get('imports', impQ)).status], ['Une lecture est déjà en cours : annule-la d’abord.', 1, 'a_lancer', 0, 'en_cours'], 'vol tenu pour un AUTRE import (I-7) : « Une lecture est déjà en cours : annule-la d’abord. », aucun POST de plus, rc_r intacte');
        // La personne quitte l'écran pendant le vol : la lecture arrive, l'enregistrement (demandé) se fait, mais ni toast ni navigation ne l'arrachent à l'écran où elle est.
        rootQ.remove(); rootR.remove(); dits.length = 0; navs.length = 0;
        ff.rendre[0](200, corpsOk());
        await attendre(async () => (await db.get('imports', impQ)).status === 'enregistre', 'enregistrée');
        await tick(); await tick();
        eq([[...dits], [...navs], (await db.get('recipes', 'rc_q')).availability, UI.volEnCours()], [[], [], 'available', null], 'écran quitté pendant le vol (T4-R1) : la recette est enregistrée, aucun « Recette importée », aucune navigation');
        await db.put('imports', { ...(await db.get('imports', impR)), status: 'ignore' });
      });

      await bloc('raisons → textes et gestes', async () => {
        const impI = await preparer('rc_i', 1);
        const GEN = 'L’assistant n’a pas répondu. Réessaie.';
        const CAS = [
          [403, { erreur: 'non_admis' }, 'non_admis', 'Ce compte n’a pas accès à l’assistant.'],
          [413, { erreur: 'trop_lourd' }, 'requete', 'La demande est trop lourde : choisis moins de pages.'],
          [413, 'pas du json', 'requete', 'La demande est trop lourde : choisis moins de pages.'],
          [429, { erreur: 'quota', quota: 60 }, 'quota', 'Tu as atteint la limite du jour pour l’assistant (60 appels).'],
          [429, { erreur: 'quota' }, 'quota', 'Tu as atteint la limite du jour pour l’assistant.'],
          [429, {}, 'trop_de_demandes', 'Trop de demandes pour l’instant. Réessaie dans une minute.'],
          [401, { erreur: 'non_connecte' }, 'non_connecte', 'Connecte-toi pour utiliser l’assistant.'],
          [502, { erreur: 'serveur' }, 'serveur', GEN + ' Code : serveur'],
          [504, {}, 'delai', GEN + ' Code : delai'],
          [200, corpsOk(RECETTE, { stop_reason: 'max_tokens' }), 'coupe', 'La lecture a été coupée : essaie avec moins de pages.'],
          [200, corpsOk('pas du json'), 'illisible', 'L’assistant n’a pas répondu lisiblement. Réessaie.'],
          [200, corpsOk({ ...RECETTE, title: 'x'.repeat(201) }), 'hors_bornes', 'L’assistant n’a pas répondu lisiblement. Réessaie.'],
          [200, corpsOk({ ...RECETTE, ingredients: [], steps: [] }), 'vide', 'Aucun ingrédient ni étape lus sur ces pages.'],
          [200, 'x', 'reponse_illisible', GEN + ' Code : reponse_illisible'],
          ['reseau', null, 'reseau', GEN + ' Code : reseau'],
        ];
        const ff = fauxFetch();
        const root = await monter('rc_i', { deps: { fetch: ff.fetch } });
        let n = 0;
        for (const [statut, corps, raison, attendu] of CAS) {
          ff.auto = statut === 'reseau' ? () => { throw new TypeError('reseau coupe'); } : [statut, corps]; n += 1;
          (bouton(root, 'Extraire et enregistrer') || bouton(root, 'Relancer')).click();
          await attendre(async () => ff.appels.length === n && (await db.get('imports', impI)).erreur?.raison === raison && root.etatRoute().status === 'echec', `cas ${raison}`);
          const l = await db.get('imports', impI);
          const code = raison === 'illisible' || raison === 'hors_bornes';
          eq([l.status, l.erreur?.raison, root.textContent.includes(attendu), code ? root.textContent.includes('Code : ' + raison) : true, !!bouton(root, 'Relancer'), bouton(root, 'Annuler'), l.appels, l.document_id_vol], ['echec', raison, true, true, true, null, n, null], `raison ${raison} (${statut}) : echec(${raison}), « ${attendu} »${code ? ' + « Code : ' + raison + ' »' : ''}, « Relancer », pas d’« Annuler », appels ${n}`);
          ok(!root.textContent.includes(JETON) && !/Échec :/.test(root.textContent) && (raison !== 'trop_de_demandes' || !root.textContent.includes('limite du jour')), `raison ${raison} : ni le jeton, ni « Échec : », ni « limite du jour » pour un 429 relayé`);
        }
        eq([(await db.get('imports', impI)).reponse_brute !== null, Array.from((await db.get('imports', impI)).reponse_brute ?? '').length <= 16000], [true, true], 'raisons : un refus de l’extraction garde la réponse brute (diagnostic, bornée)');
        for (const raison of ['interrompu', 'incertain']) {
          await db.put('imports', { ...(await db.get('imports', impI)), status: 'echec', erreur: { raison, extra: {} } });
          const r2 = await monter('rc_i', { deps: { fetch: interdit } });
          eq([r2.textContent.includes(raison === 'interrompu' ? 'La lecture a été interrompue. L’appel a peut-être été compté ; relancer en coûtera un autre.' : 'L’appel a peut-être été compté ; relancer en coûtera un autre.'), !!bouton(r2, 'Relancer'), bouton(r2, 'Relancer')?.disabled], [true, true, false], `raison ${raison} (posée au démarrage ou par une écriture impossible) : phrase I-4 + « Relancer »`);
        }
        await db.put('imports', { ...(await db.get('imports', impI)), status: 'en_cours', document_id_vol: 'autre-document', battement_at: NOW, erreur: null });
        const r3 = await monter('rc_i', { deps: { fetch: interdit } });
        eq([r3.textContent.includes('En cours sur un autre écran'), bouton(r3, 'Annuler'), r3.etatRoute().vol, r3.etatRoute().status, bouton(r3, 'Extraire et enregistrer')], [true, null, false, 'en_cours', null], 'en_cours tenu par un autre document (I-7) : « En cours sur un autre écran », sans « Annuler », rien à lancer');
        eq([await UI.annulerVol(impI), (await db.get('imports', impI)).status, (await db.get('imports', impI)).document_id_vol], [false, 'en_cours', 'autre-document'], 'annulerVol : un import que ce document ne tient pas → false, rien d’écrit');
        await db.put('imports', { ...(await db.get('imports', impI)), status: 'ignore' });
      });

      await bloc('hors ligne, session absente, gardes', async () => {
        const impJ = await preparer('rc_j', 1);
        const ff = fauxFetch([200, corpsOk()]);
        const root = await monter('rc_j', { deps: { fetch: ff.fetch } });
        eq(bouton(root, 'Extraire et enregistrer').disabled, false, 'hors ligne : au rendu (en ligne), le bouton est allumé');
        window.dispatchEvent(new Event('offline'));
        await tick();
        const bOff = bouton(root, 'Extraire et enregistrer');
        eq([bOff.disabled, root.textContent.includes('Tu es hors ligne.')], [true, true], 'hors ligne : l’événement offline APRÈS le rendu éteint le bouton et le dit');
        bOff.click(); await tick(); await tick();
        eq([ff.appels.length, (await db.get('imports', impJ)).status, (await db.get('imports', impJ)).appels], [0, 'a_lancer', 0], 'hors ligne : zéro POST, la ligne reste a_lancer, appels 0');
        eq(await UI.lancerExtraction(impJ, { ctx: await ctxDe(), repo, fetch: ff.fetch, enLigne: () => false }), { issue: 'refuse', raison: 'hors_ligne' }, 'lancerExtraction : hors ligne → refus nommé, avant toute écriture');
        window.dispatchEvent(new Event('online'));
        await tick();
        eq([bouton(root, 'Extraire et enregistrer').disabled, root.textContent.includes('Tu es hors ligne.')], [false, false], 'hors ligne : online rallume le bouton');
        // T4-R1 : une page dont les octets ne sont pas sur cet appareil (synchro L4 non faite, octets purgés) fait refuser l'envoi — rien n'est lu à moitié.
        dits.length = 0;
        const pageJ = (await db.get('imports', impJ)).page_ids[0]; const fichierJ = await db.get('files', (await db.get('source_pages', pageJ)).sha256);
        await db.delete('files', fichierJ.sha256);
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => dits.length === 1, 'refus dit');
        eq([dits[0], ff.appels.length, (await db.get('imports', impJ)).status, (await db.get('imports', impJ)).appels, root.etatRoute().vol, UI.volEnCours()], ['Les photos de cette recette ne sont pas sur cet appareil.', 0, 'a_lancer', 0, false, null], 'octets absents (T4-R1) : toast « Les photos de cette recette ne sont pas sur cet appareil. », zéro POST, la ligne reste a_lancer, appels 0, aucun vol tenu');
        await db.put('files', { ...fichierJ, blob: new Blob(['pas une image'], { type: 'image/jpeg' }) });
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => dits.length === 2, 'refus dit');
        eq([dits[1], ff.appels.length, (await db.get('imports', impJ)).status, (await db.get('imports', impJ)).appels], ['Cette image ne peut pas être lue ici. Essaie une autre photo.', 0, 'a_lancer', 0], 'page indécodable (T4-R1) : le toast de messageErreurImage, zéro POST, la ligne reste a_lancer');
        await db.put('files', fichierJ);
        eq(await UI.lancerExtraction(impJ, { ctx: await ctxDe(null), repo, fetch: ff.fetch }), { issue: 'refuse', raison: 'non_connecte' }, 'lancerExtraction : sans session → refus non_connecte, aucun appel');
        eq(await UI.lancerExtraction('imp_inconnu', { ctx: await ctxDe(), repo, fetch: ff.fetch }), { issue: 'refuse', raison: 'inconnu' }, 'lancerExtraction : import inconnu → refus');
        await db.put('imports', { ...(await db.get('imports', impJ)), page_ids: [] });
        eq(await UI.lancerExtraction(impJ, { ctx: await ctxDe(), repo, fetch: ff.fetch }), { issue: 'refuse', raison: 'sans_page' }, 'lancerExtraction : sans page → refus');
        await db.put('imports', { ...(await db.get('imports', impJ)), page_ids: ['pg_absente'] });
        eq(await UI.lancerExtraction(impJ, { ctx: await ctxDe(), repo, fetch: ff.fetch }), { issue: 'refuse', raison: 'sans_page' }, 'lancerExtraction (vague finale, m17) : des page_ids qui ne pointent AUCUNE page présente (tombale reçue, archive partielle) → refus sans_page — jamais un POST payé sans image');
        eq([ff.appels.length, (await db.get('imports', impJ)).status, (await db.get('imports', impJ)).appels, reseau], [0, 'a_lancer', 0, 0], 'lancerExtraction : les refus n’écrivent rien et n’appellent rien');
        await db.put('imports', { ...(await db.get('imports', impJ)), status: 'ignore' });
        const rootS = await monter('rc_j', { session: null, deps: { fetch: ff.fetch } });
        eq([!!rootS.querySelector('[data-role="connexion-ia"]'), rootS.textContent.includes('Connecte-toi pour utiliser l’assistant.'), bouton(rootS, 'Extraire et enregistrer')?.disabled], [true, true, true], 'session absente : la carte « Connecte-toi » et le bouton éteint');
        pick.suivant.push([await imageDe('s.jpg', '#876')]);
        bouton(rootS, 'Choisir des photos').click();
        await attendre(() => rootS.etatRoute().pageIds.length === 1, 'page ajoutée sans session');
        eq([rootS.etatRoute().status, bouton(rootS, 'Extraire et enregistrer')?.disabled, ff.appels.length, (await db.byIndex('imports', 'recipe_id', 'rc_j')).filter((i) => i.status === 'a_lancer').length], ['a_lancer', true, 0, 1], 'session absente : les photos s’ajoutent quand même (une ligne a_lancer), zéro POST');
      });

      await bloc('battement', async () => {
        const impK = await preparer('rc_k', 1);
        const ff = fauxFetch();
        let battements = 0; // T4-R1 : les APPELS de battement sont comptés (vague finale : repo.battre, hors de la ligne synchronisée)
        const espion = { ...repo, battre: async (id, quand) => { battements += 1; return repo.battre(id, quand); } };
        const { decider } = await import('../src/sync/pull.js');
        const changes = []; const desabonner = on('change', (e) => { changes.push(e?.store ?? null); });
        try {
          const root = await monter('rc_k', { deps: { fetch: ff.fetch, repo: espion, battementMs: 20, maintenant: () => new Date().toISOString() } });
          bouton(root, 'Extraire et enregistrer').click();
          await attendre(() => ff.appels.length === 1, 'fetch parti');
          const l0 = await db.get('imports', impK);
          const enFile = () => db.getAll('outbox').then((es) => es.filter((e) => e.store === 'imports' && e.id === impK).length);
          const n0 = await enFile();
          const conflits0 = await db.count('sync_conflicts');
          changes.length = 0;
          await attendre(async () => battements >= 3 && (await db.get('sync_state', 'battement:' + impK))?.status === 'vol', 'trois battements');
          const l1 = await db.get('imports', impK); const hb = await db.get('sync_state', 'battement:' + impK);
          eq([l1, await enFile(), changes, await db.count('sync_conflicts') - conflits0, hb?.status, Date.parse(hb?.value) >= Date.parse(l0.battement_at)], [l0, n0, [], 0, 'vol', true], 'battement (vague finale, m2) : trois battements → la ligne imports IDENTIQUE (ni battement_at ni updated_at réécrits), aucune entrée d’outbox ni de sync_conflicts, aucun `change` (aucune passe de synchro planifiée) ; le battement vit dans une ligne interne de sync_state (statut vol, heure récente)');
          eq(decider({ locale: l1, distante: { updated_at: l0.updated_at, data: l0 } }), 'ignorer', 'battement (vague finale) : l’écho serveur de la ligne partie au départ du vol est identique à la ligne locale après trois battements — ni « conflit » à trancher ni « renvoi » (pull.decider)');
          await UI.annulerVol(impK);
          await attendre(async () => (await db.get('imports', impK)).status === 'echec', 'annulé');
          await attendre(() => UI.volEnCours() === null, 'vol libéré (finally joué)');
          await new Promise((r) => setTimeout(r, 60)); // 3 × battementMs
          const nApres = battements;
          await new Promise((r) => setTimeout(r, 60)); // 3 × battementMs de plus : un intervalle survivant appellerait encore
          eq([battements, nApres >= 3, (await db.get('imports', impK)).status, await db.get('sync_state', 'battement:' + impK)], [nApres, true, 'echec', undefined], 'battement : nettoyé à la fin du vol — plus AUCUN appel de battement après Annuler (les appels sont comptés) ; la ligne interne du battement est effacée');
        } finally { desabonner(); }
      });

      // --- Vague finale de la branche (revue finale : Important et Minor) ---------------------------------------------------------------------------
      await bloc('relire les pages d’une fiche partial (vague finale, Important)', async () => {
        // Une fiche partial dont la version courante (lecture de l'assistant) porte la p. 132 ; la personne ne photographie que la p. 133 (la page manquante).
        const { pages: [vieille] } = await repo.ajouterPages([await imageDe('p132.jpg', '#a33')], { edition_id: 'ed1' });
        await db.put('source_pages', { ...(await db.get('source_pages', vieille.id)), kind: 'recipe', printed_page: 132 });
        const courante = { ...versionDe('rv_bb', 'rc_bb', 'ai'), provenance: { generated_by: 'ai', source_page_ids: [vieille.id], import_id: null, missing_page: true, incomplete: false }, verification_state: 'to_verify' };
        await db.mutate({ puts: { recipes: [fiche('rc_bb', { availability: 'partial', verification_state: 'to_verify', current_version_id: 'rv_bb', source_page_ids: [vieille.id] })], recipe_versions: [courante] }, origin: 'device' });
        const ff = fauxFetch([200, corpsOk()]);
        const root = await monter('rc_bb', { deps: { fetch: ff.fetch } });
        eq([root.textContent.includes('0 photo ajoutée'), await db.byIndex('imports', 'recipe_id', 'rc_bb')], [true, []], 'relire : avant la première photo, aucune ligne (une visite n’écrit rien)');
        pick.suivant.push([await imageDe('p133.jpg', '#3a3')]);
        bouton(root, 'Photographier').click();
        await attendre(() => root.etatRoute().pageIds.length >= 1, 'première photo');
        const pageIds = root.etatRoute().pageIds;
        eq([pageIds.length, pageIds[0], root.textContent.includes('2 photos ajoutées')], [2, vieille.id, true], 'relire (vague finale, Important) : la première photo d’une fiche partial ouvre une ligne qui porte EN TÊTE la page déjà liée (version courante, kind recipe), puis la page neuve');
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_bb?v=')), 'enregistrée');
        const corps = JSON.parse(ff.appels[0].options.body);
        const rc = await db.get('recipes', 'rc_bb'); const v = await db.get('recipe_versions', rc.current_version_id);
        eq([ff.appels.length, corps.corps.messages[0].content.filter((c) => c.type === 'image').length, v.provenance.source_page_ids, v.parent_version_id, rc.source_page_ids], [1, 2, pageIds, 'rv_bb', pageIds], 'relire (vague finale, Important) : UN POST qui porte les DEUX pages (la déjà lue d’abord) ; la nouvelle version couvre les deux — jamais une version faite de la seule page neuve qui remplacerait la courante sans question');
      });

      // Ronde finale 2 (re-revue de la vague, Important) : « Relire les pages » sur un appareil qui n'a PAS les octets d'une page déjà lue (second appareil,
      // PWA réinstallée : la ligne source_pages arrive par la synchro, ses octets non — R58, L4). La page n'est pas placée en tête (la ligne ne porte que ce
      // qui peut partir) ; une lecture qui ne couvre plus les pages de la version courante pose « Remplacer par cette lecture ? » (I-5), jamais d'office.
      const ficheRelue = async (id, couleur, { octets = true } = {}) => {
        const { pages: [lue] } = await repo.ajouterPages([await imageDe(`p132-${id}.jpg`, couleur)], { edition_id: 'ed1' });
        const vieille = { ...(await db.get('source_pages', lue.id)), kind: 'recipe', printed_page: 132 };
        await db.put('source_pages', vieille);
        if (!octets) await db.mutate({ deletes: { files: [vieille.sha256] }, origin: 'device' });
        const courante = { ...versionDe('rv_' + id, id, 'ai'), provenance: { generated_by: 'ai', source_page_ids: [vieille.id], import_id: null, missing_page: true, incomplete: false }, verification_state: 'to_verify' };
        await db.mutate({ puts: { recipes: [fiche(id, { availability: 'partial', verification_state: 'to_verify', current_version_id: courante.id, source_page_ids: [vieille.id] })], recipe_versions: [courante] }, origin: 'device' });
        return vieille;
      };
      const premierePhoto = async (root, nom, couleur) => {
        pick.suivant.push([await imageDe(nom, couleur)]);
        bouton(root, 'Photographier').click();
        await attendre(() => root.etatRoute().pageIds.length >= 1, 'première photo');
        return root.etatRoute();
      };
      const imagesEnvoyees = (ff) => JSON.parse(ff.appels[0].options.body).corps.messages[0].content.filter((c) => c.type === 'image').length;
      const idsVersions = async (id) => (await db.byIndex('recipe_versions', 'recipe_id', id)).map((v) => v.id).sort();

      await bloc('relire : page déjà liée SANS ses octets ici → non placée, l’appel part, question I-5 puis « Remplacer » (ronde finale 2, Important)', async () => {
        const vieille = await ficheRelue('rc_gg', '#5b2', { octets: false });
        eq([(await repo.getFile(vieille.sha256)) ?? null, (await db.get('source_pages', vieille.id))?.kind], [null, 'recipe'], 'relire sans octets (montage) : la ligne source_pages de la p. 132 est sur cet appareil, ses octets non (second appareil, PWA réinstallée)');
        const ff = fauxFetch([200, corpsOk()]);
        const root = await monter('rc_gg', { deps: { fetch: ff.fetch } });
        const { pageIds, importId } = await premierePhoto(root, 'p133-rc_gg.jpg', '#2b5');
        eq([pageIds.length, pageIds.includes(vieille.id), root.textContent.includes('1 photo ajoutée'), (await db.get('imports', importId))?.page_ids], [1, false, true, pageIds], '(a) relire (ronde finale 2) : une page de la version courante SANS ses octets ici n’est pas placée en tête — la ligne ne porte que la page neuve (ce qui peut partir), aucune vignette vide');
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => !!root.querySelector('[data-role="remplacer"]') || navs.length > 0 || UI.volEnCours() === null && ff.appels.length === 0 && dits.length > 0, 'décision après la lecture');
        eq([ff.appels.length, ff.appels.length ? imagesEnvoyees(ff) : 0, dits.includes('Les photos de cette recette ne sont pas sur cet appareil.'), (await db.get('imports', importId)).status], [1, 1, false, 'a_verifier'], '(a) relire (ronde finale 2) : l’appel PART — un POST, une image (la page neuve) ; jamais « Les photos de cette recette ne sont pas sur cet appareil. » pour une photo prise ici ; la lecture est dans le journal (a_verifier)');
        const q = root.querySelector('[data-role="remplacer"]');
        eq([!!q, q?.textContent.includes('Remplacer par cette lecture ?'), q ? [...q.querySelectorAll('button')].map((b) => b.textContent) : null, q?.textContent.includes('Une version écrite à la main existe.'), (await db.get('recipes', 'rc_gg')).current_version_id, await idsVersions('rc_gg'), [...navs]], [true, true, ['Garder ma version', 'Remplacer'], false, 'rv_rc_gg', ['rv_rc_gg'], []], '(b) relire (ronde finale 2) : la lecture ne couvre pas la p. 132 de la version courante → « Remplacer par cette lecture ? » (I-5) au lieu d’une version courante d’office ; current_version_id INCHANGÉ, aucune version écrite ; la phrase « version écrite à la main » n’est pas dite (aucune n’existe : rien d’inventé)');
        // Une seconde instance (reprise, autre onglet) : « Enregistrer cette lecture » repose la question — current_version_id ne bouge pas tant qu'elle n'est pas tranchée.
        const reprise = await monter('rc_gg', { deps: { fetch: ff.fetch } });
        bouton(reprise, 'Enregistrer cette lecture').click();
        await attendre(() => !!reprise.querySelector('[data-role="remplacer"]') || navs.length > 0, 'question reposée');
        eq([!!reprise.querySelector('[data-role="remplacer"]'), (await db.get('recipes', 'rc_gg')).current_version_id, await idsVersions('rc_gg'), (await db.get('imports', importId)).status, ff.appels.length, [...navs]], [true, 'rv_rc_gg', ['rv_rc_gg'], 'a_verifier', 1, []], '(b) relire (ronde finale 2) : repris ailleurs, « Enregistrer cette lecture » repose la question (aucun appel de plus) ; rien n’est écrit tant qu’elle n’est pas tranchée');
        bouton(root.querySelector('[data-role="remplacer"]'), 'Remplacer').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_gg?v=')), 'enregistrée');
        const rc = await db.get('recipes', 'rc_gg'); const neuve = await db.get('recipe_versions', rc.current_version_id);
        eq([rc.current_version_id !== 'rv_rc_gg', neuve?.kind, neuve?.parent_version_id, neuve?.provenance?.source_page_ids, rc.source_page_ids, (await idsVersions('rc_gg')).length, (await db.get('imports', importId)).status], [true, 'extraction', 'rv_rc_gg', pageIds, [vieille.id, ...pageIds], 2, 'enregistre'], '(b) « Remplacer » (ronde finale 2) : la lecture devient courante (parent = l’ancienne courante) ; la fiche garde l’union des pages ; import enregistre');
      });

      await bloc('relire sans octets : « Garder ma version » ajoute la lecture, la courante reste (ronde finale 2)', async () => {
        const vieille = await ficheRelue('rc_hh', '#b52', { octets: false });
        const ff = fauxFetch([200, corpsOk()]);
        const root = await monter('rc_hh', { deps: { fetch: ff.fetch } });
        const { pageIds, importId } = await premierePhoto(root, 'p133-rc_hh.jpg', '#25b');
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => !!root.querySelector('[data-role="remplacer"]') || navs.length > 0, 'question « Remplacer ? »');
        eq([!!root.querySelector('[data-role="remplacer"]'), pageIds.includes(vieille.id), ff.appels.length, (await db.get('recipes', 'rc_hh')).current_version_id], [true, false, 1, 'rv_rc_hh'], '(b) relire sans octets (ronde finale 2) : une page neuve seule, un POST, la question posée, la courante inchangée');
        bouton(root.querySelector('[data-role="remplacer"]'), 'Garder ma version').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc_hh?v=')), 'enregistrée');
        const rc = await db.get('recipes', 'rc_hh'); const neuve = (await db.byIndex('recipe_versions', 'recipe_id', 'rc_hh')).find((v) => v.id !== 'rv_rc_hh');
        eq([rc.current_version_id, rc.availability, rc.verification_state, (await idsVersions('rc_hh')).length, neuve?.kind, neuve?.parent_version_id, neuve?.provenance?.source_page_ids, rc.source_page_ids, (await db.get('source_pages', pageIds[0]))?.kind, (await db.get('imports', importId)).status, navs.at(-1)], ['rv_rc_hh', 'partial', 'to_verify', 2, 'extraction', 'rv_rc_hh', pageIds, [vieille.id, ...pageIds], 'recipe', 'enregistre', `/recipes/rc_hh?v=${neuve?.id}`], '(b) « Garder ma version » (ronde finale 2) : la version est AJOUTÉE sans devenir courante (current_version_id, availability, verification_state intacts) ; union des pages et kind recipe posés quand même ; la fiche s’ouvre sur la version ajoutée');
      });

      await bloc('relire puis « Retirer » la page placée en tête : la lecture ne couvre plus la courante → question I-5 (ronde finale 2)', async () => {
        const vieille = await ficheRelue('rc_ii', '#52b');
        const ff = fauxFetch([200, corpsOk()]);
        const root = await monter('rc_ii', { deps: { fetch: ff.fetch } });
        const avant = await premierePhoto(root, 'p133-rc_ii.jpg', '#b25');
        eq([avant.pageIds.length, avant.pageIds[0]], [2, vieille.id], '(c) témoin (ronde finale 2) : octets présents ici → la page déjà liée est placée en tête, puis la page neuve');
        root.querySelector(`button[data-role="retirer"][data-page="${CSS.escape(vieille.id)}"]`).click();
        await attendre(() => root.etatRoute().pageIds.length === 1, 'page retirée');
        const { pageIds, importId } = root.etatRoute();
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => !!root.querySelector('[data-role="remplacer"]') || navs.length > 0, 'décision après la lecture');
        eq([pageIds.includes(vieille.id), ff.appels.length, ff.appels.length ? imagesEnvoyees(ff) : 0, !!root.querySelector('[data-role="remplacer"]'), (await db.get('recipes', 'rc_ii')).current_version_id, await idsVersions('rc_ii'), (await db.get('imports', importId)).status, [...navs]], [false, 1, 1, true, 'rv_rc_ii', ['rv_rc_ii'], 'a_verifier', []], '(c) « Retirer » la page placée en tête (ronde finale 2) : la lecture d’une seule page ne couvre plus la version courante → « Remplacer par cette lecture ? » (I-5) ; current_version_id inchangé, rien d’écrit (jamais la régression silencieuse que la vague devait fermer)');
        await db.put('imports', { ...(await db.get('imports', importId)), status: 'ignore' });
      });

      await bloc('annulerVol d’un import tenu ailleurs PENDANT un vol réel (vague finale, I-7)', async () => {
        const impA = await preparer('rc_cc', 1);
        const impB = await preparer('rc_dd', 1);
        await db.put('imports', { ...(await db.get('imports', impB)), status: 'en_cours', document_id_vol: 'autre-onglet', battement_at: NOW, started_at: NOW });
        const bAvant = await db.get('imports', impB);
        const ff = fauxFetch();
        const root = await monter('rc_cc', { deps: { fetch: ff.fetch } });
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => ff.appels.length === 1, 'vol de A parti');
        eq([await UI.annulerVol(impB), ff.appels[0].options.signal.aborted, await db.get('imports', impB), (await db.get('imports', impA)).status, UI.volEnCours()], [false, false, bAvant, 'en_cours', { importId: impA }], 'annulerVol (vague finale, I-7) : pendant le vol de A, annuler B (en_cours tenu par un autre onglet) → false ; le fetch PAYÉ de A n’est pas abandonné, B est intacte, A reste en vol');
        await UI.annulerVol(impA);
        await attendre(() => UI.volEnCours() === null, 'vol de A annulé');
        for (const id of [impA, impB]) await db.put('imports', { ...(await db.get('imports', id)), status: 'ignore', document_id_vol: null });
      });

      await bloc('départ lié aux pages lues ; pages figées dès la pose du vol (vague finale, m2)', async () => {
        const impE = await preparer('rc_ee', 2);
        const [pa, pb] = (await db.get('imports', impE)).page_ids;
        let ouvrir; const porte = new Promise((r) => { ouvrir = r; }); let armee = false, atteinte = false;
        const espion = { ...repo, getFile: async (sha) => { if (armee && !atteinte) { atteinte = true; await porte; } return repo.getFile(sha); } };
        const ff = fauxFetch([200, corpsOk()]);
        const root = await monter('rc_ee', { deps: { fetch: ff.fetch, repo: espion } });
        await attendre(() => root.querySelectorAll('[data-role="retirer"]').length === 2 && [...root.querySelectorAll('.thumbs img')].every((i) => i.src.startsWith('blob:')), 'pages affichées, vignettes chargées');
        armee = true;
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => atteinte && root.querySelectorAll('[data-role="retirer"]').length === 0, 'vol posé : pages figées pendant la réduction');
        eq([bouton(root, 'Photographier'), bouton(root, 'Choisir des photos'), (await db.get('imports', impE)).status, ff.appels.length], [null, null, 'a_lancer', 0], 'vol posé (vague finale, m2) : pendant la réduction des pages (avant en_cours), ni Monter/Descendre/Retirer ni ajout — l’écran est redessiné dès la pose du vol');
        await db.put('imports', { ...(await db.get('imports', impE)), page_ids: [pb, pa] }); // un autre geste (autre onglet) réordonne pendant la réduction
        ouvrir();
        await attendre(() => UI.volEnCours() === null, 'départ refusé, vol libéré');
        const l = await db.get('imports', impE);
        eq([ff.appels.length, l.status, l.page_ids, l.appels, l.document_id_vol], [0, 'a_lancer', [pb, pa], 0, null], 'départ (vague finale, m2) : des pages changées entre la lecture et le départ → départ refusé, AUCUN POST (jamais une page envoyée qui ne serait pas liée, ni l’ordre lu désaccordé de l’ordre enregistré)');
        await db.put('imports', { ...l, status: 'ignore' });
      });

      await bloc('vol mort de CET appareil levé sur l’écran ciblé (vague finale, m1)', async () => {
        const impM = await preparer('rc_mort', 1);
        const vieux = new Date(Date.parse(NOW) - 120000).toISOString();
        await db.put('imports', { ...(await db.get('imports', impM)), status: 'en_cours', document_id_vol: 'document-mort', battement_at: vieux, started_at: vieux });
        const root = await monter('rc_mort', { deps: { fetch: interdit } });
        await attendre(async () => (await db.get('imports', impM)).status === 'echec' && root.etatRoute().status === 'echec', 'interrompu sans quitter l’écran');
        eq([(await db.get('imports', impM)).erreur, root.textContent.includes('La lecture a été interrompue. L’appel a peut-être été compté ; relancer en coûtera un autre.'), !!bouton(root, 'Relancer'), root.textContent.includes('En cours sur un autre écran')], [{ raison: 'interrompu', extra: {} }, true, true, false], 'écran ciblé (vague finale, m1) : une ligne en_cours de CET appareil dont le document est mort (battement de 120 s) est levée dès l’affichage — phrase I-4 et « Relancer », plus de « En cours sur un autre écran » sans fin');
        await db.put('imports', { ...(await db.get('imports', impM)), status: 'ignore' });
        // Puis la VEILLE : une ligne encore vivante à l'affichage (battement −30 s : l'app vient d'être relancée) dont le document est mort est levée sans
        // quitter l'écran, à la passe suivante (veilleMs injecté ; BATTEMENT_MORT_MS + 1 s dans l'app).
        const impM2 = await preparer('rc_mort', 1);
        await db.put('imports', { ...(await db.get('imports', impM2)), status: 'en_cours', document_id_vol: 'document-mort', battement_at: new Date(Date.parse(NOW) - 30000).toISOString(), started_at: vieux });
        const root2 = await monter('rc_mort', { deps: { fetch: interdit, veilleMs: 40 } });
        await tick();
        eq([(await db.get('imports', impM2)).status, root2.textContent.includes('En cours sur un autre écran')], ['en_cours', true], 'écran ciblé (vague finale, m1) : battement de 30 s à l’affichage → la ligne attend (son vol peut vivre)');
        await db.put('imports', { ...(await db.get('imports', impM2)), battement_at: vieux }); // le temps passe : plus aucun battement
        await attendre(async () => (await db.get('imports', impM2)).status === 'echec' && root2.etatRoute().status === 'echec' && !!bouton(root2, 'Relancer'), 'levée par la veille');
        eq((await db.get('imports', impM2)).erreur, { raison: 'interrompu', extra: {} }, 'écran ciblé (vague finale, m1) : la veille rejoue la passe tant que la ligne vole ailleurs — levée sans quitter l’écran, « Relancer »');
        await db.put('imports', { ...(await db.get('imports', impM2)), status: 'ignore' });
      });

      await bloc('plusieurs imports ouverts pour une recette après synchro (vague finale, m4, m7)', async () => {
        const { formatDate } = await import('../src/core/dom.js');
        const D = await import('../src/domain/import-cible.js');
        const impMac = await preparer('rc_y', 1);
        await db.put('imports', { ...(await db.get('imports', impMac)), device_id: 'dev-mac' }); // la ligne du Mac, reçue (ses photos, pas d'octets lus ici)
        const ici = { ...(await db.get('imports', impMac)), id: 'imp_y_iphone', device_id: repo.deviceId(), status: 'a_verifier', resultat: RECETTE, model: 'claude-x', started_at: '2026-10-19T08:00:00.000Z', duree_ms: 1000, updated_at: '2026-10-19T18:30:00.000Z' };
        await db.put('imports', ici); // la lecture payée de cet appareil
        const root = await monter('rc_y', { deps: { fetch: interdit } });
        eq([root.etatRoute().importId, root.etatRoute().status, !!bouton(root, 'Enregistrer cette lecture')], ['imp_y_iphone', 'a_verifier', true], 'écran ciblé (vague finale, m4) : deux imports ouverts (Mac a_lancer, iPhone a_verifier) → la lecture reçue d’abord, « Enregistrer cette lecture » sans appel');
        eq([root.textContent.includes(`Lecture reçue le ${formatDate('2026-10-19T08:00:01.000Z', { withTime: true })}`), root.textContent.includes(formatDate('2026-10-19T18:30:00.000Z', { withTime: true }))], [true, false], 'écran ciblé (vague finale, m7) : « Lecture reçue le {d} » = départ du vol + durée, jamais updated_at (bougé par la photo du plat)');
        const rootMac = await UI.renderImportCible({ id: 'rc_y' }, { import: impMac }, await ctxDe(), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: interdit, pickFiles: pick.fn, maintenant: () => NOW });
        scene.append(rootMac);
        eq([rootMac.etatRoute().importId, D.cibleReprise(ici)], [impMac, '/recipes/rc_y/importer?import=imp_y_iphone'], 'écran ciblé (vague finale, m4) : « Reprendre » porte LA ligne (?import=) et l’écran la prend quand elle est ouverte pour cette recette');
        for (const id of [impMac, 'imp_y_iphone']) await db.put('imports', { ...(await db.get('imports', id)), status: 'ignore' });
      });

      await bloc('ligne hors vocabulaire pour la recette (vague finale, m10)', async () => {
        for (const statut of ['zzz', null]) {
          await db.put('imports', { id: 'imp_zzz', kind: 'recette', recipe_id: 'rc_z', status: statut, page_ids: [], scan_session_id: 'ss_zzz', device_id: repo.deviceId(), created_at: NOW, updated_at: NOW });
          const root = await monter('rc_z', { deps: { fetch: interdit } });
          eq([root.etatRoute().importId, root.textContent.includes('0 photo ajoutée')], [null, true], `écran ciblé (vague finale, m10) : une ligne au statut ${statut} n’est pas « l’import ouvert » (une seule définition : importOuvert)`);
          pick.suivant.push([await imageDe(`zzz-${statut}.jpg`, '#456')]);
          bouton(root, 'Photographier').click();
          await attendre(() => root.etatRoute().pageIds.length === 1, 'première photo');
          const neuve = root.etatRoute().importId;
          eq([neuve !== 'imp_zzz', (await db.get('imports', neuve))?.status, (await db.get('imports', 'imp_zzz')).status], [true, 'a_lancer', statut], `écran ciblé (vague finale, m10) : la première photo ouvre une ligne NEUVE (la ligne au statut ${statut} n’est ni reprise ni bloquante), laissée telle quelle`);
          await db.put('imports', { ...(await db.get('imports', neuve)), status: 'ignore' });
        }
      });

      await bloc('une raison hors liste n’est jamais écrite (vague finale, m19)', async () => {
        const impF = await preparer('rc_ff', 1);
        const proto = L.PasserelleProvider.prototype; const vraie = proto.complete;
        proto.complete = async function () { throw new Error('texte libre <b>gras</b>'); }; // un fournisseur qui lève un texte libre
        let root;
        try {
          root = await monter('rc_ff', { deps: { fetch: interdit } });
          bouton(root, 'Extraire et enregistrer').click();
          await attendre(async () => (await db.get('imports', impF)).status === 'echec' && root.etatRoute().status === 'echec', 'echec écrit');
        } finally { proto.complete = vraie; }
        const l = await db.get('imports', impF);
        eq([l.erreur, JSON.stringify(l).includes('texte libre'), root.textContent.includes('texte libre'), root.textContent.includes('Code : interne')], [{ raison: 'interne', extra: {} }, false, false, true], 'raisonDe (vague finale, m19) : une Error au message libre → echec(interne) ; le texte libre n’est ni dans la ligne (synchronisée) ni à l’écran (« Code : interne »)');
        await db.put('imports', { ...l, status: 'ignore' });
      });

      await bloc('entrées (fiche, livre, éditeur, routes)', async () => {
        const { renderRecipe } = await import('../src/ui/recipe.js');
        const { renderBook } = await import('../src/ui/book.js');
        const { renderRecipeEdit } = await import('../src/ui/recipe-edit.js');
        const { ROUTES_DE_SAISIE, estRouteDeSaisie } = await import('../src/ui/state.js');
        const ctx = await ctxDe();
        const ctxFiche = { ...ctx, dishesById: new Map(), cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: [], ingredientsById: new Map(), dishes: [], source_documents: [], source_pages: [], rediscovery_prefs: [], docsByRecipe: new Map(), scan_sessions: [] };
        const page = await renderRecipe({ id: 'rc_ref' }, {}, ctxFiche);
        const importer = lien(page, 'Importer cette recette');
        eq([importer?.getAttribute('href'), importer?.classList.contains('primary'), !!lien(page, 'Saisir à la main'), page.textContent.includes('Scanner cette recette'), lien(page, 'Relire les pages')], ['#/recipes/rc_ref/importer', true, true, false, null], 'fiche d’une référence : « Importer cette recette » (primaire) → /recipes/<id>/importer ; « Saisir à la main » toujours là ; « Scanner cette recette » absent');
        const partielle = await renderRecipe({ id: 'rc_part' }, {}, ctxFiche);
        eq([lien(partielle, 'Relire les pages')?.getAttribute('href'), partielle.textContent.includes('Scanner cette recette'), lien(partielle, 'Importer cette recette')], ['#/recipes/rc_part/importer', false, null], 'fiche partial : « Relire les pages » (secondaire) → même route');
        const dispo = await renderRecipe({ id: 'rc_dispo' }, {}, ctxFiche);
        eq([lien(dispo, 'Relire les pages'), lien(dispo, 'Importer cette recette')], [null, null], 'fiche available : aucune entrée vers l’import (D-11)');
        const sigpart = await renderRecipe({ id: 'rc_sigpart' }, {}, ctxFiche);
        eq([lien(sigpart, 'Relire les pages'), lien(sigpart, 'Importer cette recette')], [null, null], 'fiche d’un signet devenu partial : aucune entrée vers l’import (un lien web s’importe au lot suivant)');
        const fiche = await renderBook({ id: 'ed1' }, {}, { ...ctxFiche, recipes: ctx.recipes.filter((r) => ['rc_ref', 'rc_part', 'rc_dispo', 'rc_sigpart'].includes(r.id)) });
        const importers = [...fiche.querySelectorAll('a, button')].filter((n) => n.textContent === 'Importer');
        const saisies = [...fiche.querySelectorAll('a, button')].filter((n) => n.textContent === 'Saisir à la main');
        eq([importers.length, importers.every((n) => !n.parentElement.closest('a')), importers.map((n) => n.getAttribute('href')).sort(), saisies.length, saisies.every((n) => !n.parentElement.closest('a')), fiche.textContent.includes('Scanner cette recette')], [2, true, ['#/recipes/rc_part/importer', '#/recipes/rc_ref/importer'], 3, true, false], 'fiche du livre (m4, T4-R1) : « Importer » sous la carte de la référence et de la partielle SEULEMENT (pas sous le signet devenu partial : même règle que « Relire les pages »), jamais descendant d’un <a>, vers la route ciblée ; « Saisir à la main » (menu + deux rangées) hors de tout <a> ; « Scanner cette recette » absent');
        ok(importers.every((n) => n.classList.contains('btn') && n.classList.contains('small')), 'fiche du livre : « Importer » est un .btn.small');
        // Vague finale (m15) : D-8 par COMPORTEMENT (le test de source ne voit que l’ancienne clé) — toucher « Importer cette recette » (fiche) ou « Importer »
        // (fiche du livre) ne pose RIEN dans sessionStorage ni localStorage : la référence voyage par la route seule (la navigation est retenue ici).
        const instantane = () => JSON.stringify([Object.entries(sessionStorage).sort(), Object.entries(localStorage).sort()]);
        const sansNavigation = (e) => { if (e.target?.closest?.('a')) e.preventDefault(); };
        const hashAvantClic = location.hash;
        scene.append(page, fiche); scene.addEventListener('click', sansNavigation);
        const avantClic = instantane();
        try { importer.click(); importers.forEach((n) => n.click()); } finally { scene.removeEventListener('click', sansNavigation); }
        eq([instantane() === avantClic, location.hash === hashAvantClic, importers.length + 1], [true, true, 3], 'entrées (vague finale, m15) : trois touchers d’« Importer » ne posent rien en sessionStorage ni en localStorage (aucune référence « en attente », D-8)');
        sessionStorage.setItem('cuisineos.pending_recipe', 'rc_ref');
        let editeur;
        try { editeur = await renderRecipeEdit({ id: null }, { edition: 'ed1' }, ctxFiche); } finally { sessionStorage.removeItem('cuisineos.pending_recipe'); }
        eq([editeur.textContent.includes('Oui, rattacher'), editeur.textContent.includes('Ces pages complètent la référence')], [false, false], 'éditeur (D-8) : plus aucune case « Oui, rattacher », même avec une ancienne clé pending_recipe en sessionStorage');
        eq([ROUTES_DE_SAISIE.includes('/recipes/*/importer'), estRouteDeSaisie('/recipes/rc_a/importer'), estRouteDeSaisie('/recipes/rc_a')], [true, true, false], 'ROUTES_DE_SAISIE (I16) : /recipes/*/importer — une passe de synchro ne reconstruit pas l’écran en plein vol');
      });
    } finally {
      UI.reinitialiserImportCible?.();
      globalThis.fetch = vraiFetch; scene.remove(); setUiLocale(localeAvant);
    }
  }));

  // =====================================================================================================================================
  // Tâche 5 — fiche, mode cuisine, courses et « Corriger » (spec § 4.3.6, § 4.3.7, D-3 ; Review Focus 5). Base jetable (withRepo), aucun réseau,
  // rendus dans une scène hors écran ; le routeur de la page de tests n'est pas démarré : le save() de l'éditeur ne fait que changer l'adresse,
  // restaurée aussitôt. Les deux fonctions pures (banniereLecture, estExtractionNonRelue) sont éprouvées par table avant les rendus.
  await run('fiche, cuisine, courses et Corriger (tâche 5)', () => withRepo(async (repo, db) => {
    const K = await import('../src/ui/components.js');
    const D = await import('../src/domain/import-cible.js');
    const { renderRecipe } = await import('../src/ui/recipe.js');
    const { renderCook } = await import('../src/ui/cook.js');
    const { renderShoppingList } = await import('../src/ui/grocery.js');
    const L = await import('../src/domain/llm.js');
    const { renderRecipeEdit } = await import('../src/ui/recipe-edit.js');
    const { formatDate } = await import('../src/core/dom.js');
    const { sha256Hex } = await import('../src/core/hash.js');
    const { INGREDIENTS } = await import('../src/model/seed.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale(); setUiLocale('fr'); // des textes français sont affirmés
    const adresseAvant = location.href;
    const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(scene);
    const vraiFetch = globalThis.fetch; let reseau = 0;
    globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
    const ING = new Map(INGREDIENTS.map((i) => [i.id, i]));
    const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const texte = (n) => (n ? n.textContent : null);
    const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom) || null;
    const champ = (root, libelle) => [...root.querySelectorAll('.field')].find((f) => f.querySelector('span')?.textContent === libelle) || null;
    try {
      // --- banniereLecture(version, ligne) et estExtractionNonRelue(version) : pures, par table
      const LU = '2026-09-01T12:00:00.000Z'; // ronde 1 : une date de lecture franchement passée — la date d'une correction écrite le jour du test ne la contrefait jamais
      const prov = (over = {}) => ({ source_page_ids: [], source_document_id: null, generated_by: 'ai', model: 'claude-x', edition_id: 'ed5', convention_snapshot: null, import_id: 'imp_fiche', incomplete: false, missing_page: true, titre_lu: 'Tarte aux pommes', ...over });
      const lignes = (...u) => u.map((x, i) => ({ id: 'ri' + i, source_text: 'x', verification_state: 'to_verify', uncertain: x }));
      const extr = (over = {}) => ({ id: 'rv_x', kind: 'extraction', ingredients: lignes(false, true, true), steps: [], provenance: prov(), verification_state: 'to_verify', created_at: LU, ...over });
      eq(K.banniereLecture(extr()), { date: LU, incertaines: 2, missing_page: true, incomplete: false, incertain: null }, 'banniereLecture : une extraction importée → date (created_at), 2 incertaines, missing_page, incomplete, incertain nul sans ligne du journal');
      eq([K.banniereLecture(extr({ provenance: prov({ import_id: null, missing_page: false }) })), K.banniereLecture(extr({ provenance: prov({ import_id: undefined, missing_page: false }) })), K.banniereLecture(extr({ provenance: { generated_by: 'manual' } })), K.banniereLecture(extr({ provenance: null })), K.banniereLecture(null), K.banniereLecture({ kind: 'extraction' })], [null, null, null, null, null, null], 'banniereLecture : null sans import_id ni drapeau de lecture (version saisie à la main, extraction d’avant le lot, provenance absente, version nulle)');
      // Vague finale (m6) : le bandeau est celui d'une LECTURE — une adaptation qui recopie la provenance (« Ma version », remplacement d'ingrédient) ne le
      // porte jamais ; une lecture de l'éditeur DÉTACHÉE de sa ligne (sans import_id) montre quand même ce qu'elle a dit d'incomplet (I-1 : montré).
      eq([K.banniereLecture(extr({ kind: 'adaptation', provenance: prov({ generated_by: 'manual', derived_from: 'rv_x', substitution: true }) })), K.banniereLecture(extr({ kind: 'adaptation', provenance: prov() })), K.banniereLecture(extr({ provenance: prov({ import_id: null, missing_page: false, incomplete: true }) })), K.banniereLecture(extr({ provenance: prov({ import_id: null }) }))?.missing_page, K.banniereLecture(extr({ provenance: prov({ generated_by: 'manual', import_id: null }) }))],
        [null, null, { date: LU, incertaines: 2, missing_page: false, incomplete: true, incertain: null }, true, null], 'banniereLecture (vague finale, m6) : une adaptation (même avec la provenance recopiée d’une lecture) → null ; une lecture de l’assistant sans import_id mais « lecture incomplète » ou « page possiblement manquante » → le bandeau les montre ; une saisie à la main → null');
      eq([K.banniereLecture(extr({ provenance: prov({ uncertain_fields: ['sel', 'sucre'] }) })).incertain, K.banniereLecture(extr({ provenance: prov({ uncertain_fields: ['sel'] }) }), { id: 'imp_fiche', resultat: { uncertain_fields: ['beurre'] } }).incertain, K.banniereLecture(extr({ provenance: prov({ uncertain_fields: 'hostile' }) })).incertain],
        ['sel ; sucre', 'beurre', null], 'banniereLecture (vague finale, m8) : « Incertain » survit à la purge de la ligne du journal (les incertitudes gardées dans la version) ; la ligne présente reste lue d’abord ; une forme hostile → nul');
      eq(K.banniereLecture(extr({ provenance: prov({ incomplete: true, missing_page: 'oui' }), ingredients: lignes(false, false) })), { date: LU, incertaines: 0, missing_page: false, incomplete: true, incertain: null }, 'banniereLecture : incomplete et missing_page sont des booléens stricts ; 0 incertaine ; une ligne uncertain non booléenne ne compte pas');
      eq(K.banniereLecture(extr({ ingredients: [{ uncertain: 'oui' }, { uncertain: 1 }, { uncertain: true }], created_at: 7 })).incertaines, 1, 'banniereLecture : seules les lignes uncertain === true comptent (données reçues ou restaurées)');
      eq(K.banniereLecture(extr({ created_at: 7 })).date, null, 'banniereLecture : une date qui n’est pas une chaîne vaut null (rien d’inventé)');
      eq([K.banniereLecture(extr({ created_at: 'pas une date' })).date, K.banniereLecture(extr({ provenance: prov({ lu_le: '<script>' }) })).date, K.banniereLecture(extr({ provenance: prov({ lu_le: null }) })).date], [null, null, null], 'banniereLecture (ronde 1) : une date illisible vaut null ; une lu_le présente mais illisible ne retombe JAMAIS sur created_at (la date d’une correction n’est pas celle de la lecture)');
      const ligneJ = (uf) => ({ id: 'imp_fiche', status: 'enregistre', resultat: { title: 'T', uncertain_fields: uf } });
      eq(K.banniereLecture(extr(), ligneJ(['sucre', 'lait'])).incertain, 'sucre ; lait', 'banniereLecture : « Incertain » = les uncertain_fields de la ligne du journal, joints par « ; »');
      const coupe = K.banniereLecture(extr(), ligneJ(['sucre', 42, null, 'z'.repeat(400)])).incertain;
      eq([Array.from(coupe).length, coupe.startsWith('sucre ; zzz'), coupe.endsWith('…')], [300, true, true], 'banniereLecture : « Incertain » borné à 300 points de code (coupé avec « … »), les valeurs non chaînes écartées');
      eq(Array.from(K.banniereLecture(extr(), ligneJ(['😀'.repeat(300)])).incertain).length, 300, 'banniereLecture : 300 emoji (deux unités UTF-16 chacun) passent entiers : la borne compte des points de code');
      eq([K.banniereLecture(extr(), ligneJ([])).incertain, K.banniereLecture(extr(), ligneJ('pas une liste')).incertain, K.banniereLecture(extr(), { id: 'imp_fiche', resultat: 'hostile' }).incertain, K.banniereLecture(extr(), { id: 'imp_autre', resultat: { uncertain_fields: ['x'] } }).incertain, K.banniereLecture(extr(), null).incertain, K.banniereLecture(extr(), ligneJ(['  ', '\u0007'])).incertain], [null, null, null, null, null, null], 'banniereLecture : liste vide, forme hostile, résultat non objet, ligne d’un AUTRE import, absente, ou faite de blancs et de caractères de contrôle → incertain nul');
      eq(K.banniereLecture(extr(), ligneJ(['a\u0007b', ' c\n d '])).incertain, 'ab ; c d', 'banniereLecture : caractères de contrôle retirés, espaces repliées, chaque valeur coupée aux bords');
      eq(K.banniereLecture({ ...extr(), kind: 'correction', created_at: '2026-10-20T08:00:00.000Z', provenance: prov({ generated_by: 'manual', lu_le: LU }) }).date, LU, 'banniereLecture : une correction dit la date de la LECTURE héritée (provenance.lu_le), pas la sienne');
      eq([K.texteIncertain(ligneJ(['a', 'b']), 'imp_fiche'), K.texteIncertain(ligneJ(['a']), 'imp_autre'), K.texteIncertain(null, 'imp_fiche'), K.texteIncertain(ligneJ(['a']), null)], ['a ; b', null, null, null], 'texteIncertain(ligne, importId) (ronde 1) : pure, bornée, la ligne de CET import seulement');
      const E = (kind, generated_by, verification_state) => K.estExtractionNonRelue({ kind, provenance: { generated_by }, verification_state });
      eq([E('extraction', 'ai', 'to_verify'), E('extraction', 'ai', 'verified'), E('correction', 'manual', 'to_verify'), E('extraction', 'manual', 'to_verify'), E('adaptation', 'ai', 'to_verify'), K.estExtractionNonRelue(null), K.estExtractionNonRelue({ kind: 'extraction', verification_state: 'to_verify' }), E('correction', 'ai', 'to_verify'), E('correction', 'ai', 'verified'), E('synthesis', 'ai', 'to_verify')], [true, false, false, false, false, false, false, true, false, false], 'estExtractionNonRelue (D-3, ronde 1) : vrai pour une lecture de l’assistant à vérifier (extraction, ou relecture par l’assistant depuis « Corriger », écrite en correction) — faux une fois vérifiée, pour une correction à la main, une saisie à la main, une adaptation, une création, sans provenance');

      // --- Fixture : une recette importée par fabriquerExtraction (7 lignes dont 2 incertaines, une étape sur deux lignes, page possiblement
      // manquante), sa ligne du journal `enregistre` avec uncertain_fields, la photo du plat dans files ; une correction vérifiée faite à part ;
      // une recette saisie à la main sans étape multi-ligne (témoin de l'éditeur d'aujourd'hui) ; une fiche dont la photo n'a pas ses octets.
      const livre = { id: 'b5', title: 'Mon livre', author: 'A. B.', updated_at: DATE };
      const edition = { id: 'ed5', book_id: 'b5', language: 'fr', updated_at: DATE };
      const reference = { id: 'rc_imp', edition_id: 'ed5', original_title: 'Tarte aux pommes', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: 132, source_page_ids: [], current_version_id: null, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE };
      const HOSTILE = '<img src=x onerror="void 0">'; // ronde 1 : un uncertain_fields hostile (reçu, restauré) doit rester du TEXTE affiché tel quel
      const RES = { title: 'Tarte aux pommes', servings: 6, prep_minutes: 20, cook_minutes: 45, ingredients: [{ source_text: '4 pommes', uncertain: false }, { source_text: '? g de sucre', uncertain: true }, { source_text: '1 oeuf', uncertain: false }, { source_text: '100 g de beurre', uncertain: false }, { source_text: '? ml de lait', uncertain: true }, { source_text: '1 pincée de sel', uncertain: false }, { source_text: '200 g de farine', uncertain: false }], steps: [{ text: 'Peler les pommes.\nLes couper en quartiers.' }, { text: 'Cuire 45 min.' }], printed_page: 132, sub_recipes: [], uncertain_fields: [HOSTILE, 'sucre', 'lait', 'z'.repeat(400)], notes: null, incomplete: false, missing_page: true };
      const toile = new OffscreenCanvas(320, 240); const cx = toile.getContext('2d'); cx.fillStyle = '#a52'; cx.fillRect(0, 0, 320, 240);
      const photoBlob = await toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
      const shaPhoto = await sha256Hex(photoBlob);
      await repo.putFile(shaPhoto, photoBlob, { origin: 'device' });
      const fab = D.fabriquerExtraction(RES, { reference, versions: [], pages: [], pageIds: [], edition, importId: 'imp_fiche', modele: 'claude-x', photo: { sha256: shaPhoto, origin: 'image' }, maintenant: LU });
      const extraction = { ...fab.version, updated_at: LU }; const recette = { ...fab.recipe, updated_at: LU };
      const correction = { ...extraction, id: 'rv_corr', kind: 'correction', parent_version_id: extraction.id, ingredients: extraction.ingredients.map((l, i) => ({ ...l, id: 'ri_corr_' + i, verification_state: 'verified', uncertain: false })), provenance: { ...extraction.provenance, generated_by: 'manual', model: null, lu_le: LU }, verification_state: 'verified', created_at: '2026-10-20T08:00:00.000Z', updated_at: '2026-10-20T08:00:00.000Z' };
      const ligneImport = { id: 'imp_fiche', kind: 'recette', edition_id: 'ed5', recipe_id: 'rc_imp', scan_session_id: null, page_ids: [], photo_sha256: shaPhoto, photo_origin: 'image', status: 'enregistre', erreur: null, resultat: RES, reponse_brute: null, appels: 1, model: 'claude-x', duree_ms: 1000, device_id: 'dev', document_id_vol: null, battement_at: null, created_at: LU, updated_at: LU, started_at: LU, finished_at: LU };
      const simple = { ...reference, id: 'rc_simple', original_title: 'Compote', availability: 'available', verification_state: 'verified', current_version_id: 'rv_simple' };
      const versionSimple = { id: 'rv_simple', recipe_id: 'rc_simple', kind: 'extraction', status: null, servings: 4, prep_minutes: null, cook_minutes: null, active_minutes: null, total_minutes: null, ingredients: [{ ...extraction.ingredients[0], id: 'ri_s0', verification_state: 'verified', uncertain: false }], steps: [{ id: 'st_s1', position: 1, text: 'Peler.' }, { id: 'st_s2', position: 2, text: 'Cuire.' }], constraints: {}, changes: '', notes: '', provenance: { source_page_ids: [], source_document_id: null, generated_by: 'manual', model: null, edition_id: 'ed5', convention_snapshot: null }, verification_state: 'verified', created_at: LU, updated_at: LU };
      const sansOctets = { ...recette, id: 'rc_sansoctets', current_version_id: 'rv_so', photo_sha256: 'f'.repeat(64) };
      const versionSansOctets = { ...extraction, id: 'rv_so', recipe_id: 'rc_sansoctets' };
      // Ronde 1 : une SECONDE ligne du journal, rangée AVANT celle de la fiche (clé « imp_aaa ») — la fiche doit trouver la ligne de SON import ;
      // des versions qui discriminent l'état (3 vérifiées sur 7, 1 à vérifier, lecture sans ligne), « lecture incomplète », une date illisible,
      // des formes reçues de `uncertain` ; une photo du plat dont les octets ne sont pas une image ; une étape lue avec une ligne vide interne.
      const ligneAutre = { ...ligneImport, id: 'imp_aaa', recipe_id: 'rc_simple', photo_sha256: null, resultat: { ...RES, uncertain_fields: ['autre import'] } };
      const ligneVerifiee = (l) => ({ ...l, verification_state: 'verified', uncertain: false }); // ce que l'éditeur écrit pour une ligne cochée
      const corrigee = (id, over) => ({ ...extraction, id, kind: 'correction', parent_version_id: extraction.id, provenance: { ...extraction.provenance, generated_by: 'manual', model: null, lu_le: LU }, created_at: '2026-10-20T08:00:00.000Z', updated_at: '2026-10-20T08:00:00.000Z', ...over });
      const mixte = corrigee('rv_mixte', { ingredients: extraction.ingredients.map((l, i) => (i < 3 ? ligneVerifiee(l) : l)) });
      const uneSeule = corrigee('rv_une', { ingredients: extraction.ingredients.map((l, i) => (i < 6 ? ligneVerifiee(l) : l)) });
      const sansLigne = { ...extraction, id: 'rv_sansligne', ingredients: [] }; // une lecture sans ingrédient : fabriquerExtraction la laisse to_verify
      const lectureIncomplete = { ...extraction, id: 'rv_incomplete', provenance: { ...extraction.provenance, incomplete: true } };
      const sansDate = { ...extraction, id: 'rv_sansdate', created_at: 'pas une date' };
      const formes = { ...extraction, id: 'rv_formes', ingredients: extraction.ingredients.slice(0, 3).map((l, i) => ({ ...l, uncertain: ['oui', 1, true][i] })) };
      const pdfBlob = new Blob(['%PDF-1.4 pas une image'], { type: 'application/pdf' });
      const shaPdf = await sha256Hex(pdfBlob);
      await repo.putFile(shaPdf, pdfBlob, { origin: 'device' });
      const avecPdf = { ...recette, id: 'rc_pdf', current_version_id: 'rv_pdf', photo_sha256: shaPdf };
      const versionPdf = { ...extraction, id: 'rv_pdf', recipe_id: 'rc_pdf' };
      const RES_PARA = { ...RES, uncertain_fields: [], steps: [{ text: 'Faire la pâte :\n\nMélanger la farine et le beurre.' }, { text: 'Cuire 45 min.' }] };
      const fabPara = D.fabriquerExtraction(L.validateParsedRecipe(RES_PARA), { reference: { ...reference, id: 'rc_para', original_title: 'Tarte en deux temps' }, versions: [], pages: [], pageIds: [], edition, importId: 'imp_para', modele: 'claude-x', photo: null, maintenant: LU });
      await db.mutate({ puts: { books: [livre], book_editions: [edition], recipes: [recette, simple, sansOctets, avecPdf, { ...fabPara.recipe, updated_at: LU }], recipe_versions: [extraction, correction, versionSimple, versionSansOctets, mixte, uneSeule, sansLigne, lectureIncomplete, sansDate, formes, versionPdf, { ...fabPara.version, updated_at: LU }], imports: [ligneImport, ligneAutre] }, origin: 'device' });
      eq([extraction.steps[0].text.includes('\n'), extraction.ingredients.filter((l) => l.uncertain).length, extraction.ingredients.length, recette.availability, recette.photo_sha256, extraction.provenance.import_id], [true, 2, 7, 'partial', shaPhoto, 'imp_fiche'], 'fixture : étape sur deux lignes, 2 lignes incertaines sur 7, fiche partial (page possiblement manquante), photo du plat pointée, import_id posé');
      const ctxDe = async (over = {}) => {
        const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions');
        return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])), editionsById: new Map([['ed5', edition]]), booksById: new Map([['b5', livre]]), books: [livre], book_editions: [edition], pagesById: new Map(), imports: await db.getAll('imports'), dishesById: new Map(), dishes: [], cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: INGREDIENTS, ingredientsById: ING, source_documents: [], source_pages: [], scan_sessions: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr', llm: { provider: 'none' } }, conventionFor: () => null, ...over };
      };
      const INCERTAIN_ATTENDU = Array.from(HOSTILE + ' ; sucre ; lait ; ' + 'z'.repeat(400)).slice(0, 299).join('') + '…';
      const LIGNE_LECTURE = `Lue par l’assistant le ${formatDate(LU)} · 2 ligne(s) incertaine(s) · page possiblement manquante`;
      const LIGNE_LECTURE_1 = `Lue par l’assistant le ${formatDate(LU)} · 1 ligne(s) incertaine(s) · page possiblement manquante`;
      const textesDirects = (p) => [...p.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent);

      // --- Fiche (spec § 4.3.6) : bandeau de lecture, « Incertain », état de la version affichée, photo du plat, puces « incertain », étape entière
      {
        const page = await renderRecipe({ id: 'rc_imp' }, {}, await ctxDe()); scene.append(page);
        const bandeau = page.querySelector('[data-role="bandeau-lecture"]');
        eq([texte(bandeau?.querySelector('[data-role="ligne-lecture"]')), bandeau?.classList.contains('status')], [LIGNE_LECTURE, true], 'fiche : bandeau « Lue par l’assistant le {d} · 2 ligne(s) incertaine(s) · page possiblement manquante » (sans « lecture incomplète » : incomplete faux)');
        const inc = texte(bandeau?.querySelector('[data-role="incertain-lecture"]'));
        eq([inc, Array.from(inc || '').length], ['Incertain : ' + INCERTAIN_ATTENDU, Array.from('Incertain : ').length + 300], 'fiche : « Incertain : … » lu dans resultat.uncertain_fields de la ligne du journal (import_id, pointeur souple), coupé à 300 points de code');
        const incN = bandeau?.querySelector('[data-role="incertain-lecture"]');
        eq([incN?.children.length, incN?.querySelectorAll('img').length, incN?.textContent.startsWith('Incertain : ' + HOSTILE + ' ; sucre')], [0, 0, true], 'fiche : « Incertain » est un nœud texte — une valeur hostile (<img onerror>) reste du texte affiché tel quel, aucun élément (une sortie de modèle n’est jamais du balisage)');
        const etat = page.querySelector('[data-role="etat-verification"]');
        eq([texte(etat), etat?.classList.contains('warn')], ['7 lignes à vérifier', true], 'fiche : état de la version affichée « 7 lignes à vérifier »');
        const img = page.querySelector('[data-role="photo-plat"] img');
        eq([!!img, img?.getAttribute('src')?.startsWith('blob:'), img?.getAttribute('alt')], [true, true, 'Photo du plat'], 'fiche : la photo du plat est rendue (blob:) quand files a les octets, alt « Photo du plat »');
        const lis = [...page.querySelectorAll('.recipe-body ul.list.plain > li')];
        eq(lis.map((li) => [...li.querySelectorAll('.chip')].some((c) => c.textContent === 'incertain')), [false, true, false, false, true, false, false], 'fiche : la puce « incertain » sur les lignes uncertain seulement (sucre, lait)');
        eq(lis.map((li) => [...li.querySelectorAll('.chip')].filter((c) => c.textContent === 'À vérifier').length), [1, 1, 1, 1, 1, 1, 1], 'fiche : la puce « À vérifier » reste sur chaque ligne non vérifiée');
        const etapes = [...page.querySelectorAll('.steps li [data-role="texte-etape"]')];
        eq([etapes.length, etapes[0]?.textContent, etapes[0]?.style.whiteSpace, etapes[1]?.textContent], [2, 'Peler les pommes.\nLes couper en quartiers.', 'pre-line', 'Cuire 45 min.'], 'fiche : une étape « a\\nb » est rendue entière, avec son saut de ligne (white-space: pre-line)');
        eq(reseau, 0, 'fiche : aucun réseau');
        const pageC = await renderRecipe({ id: 'rc_imp' }, { v: 'rv_corr' }, await ctxDe()); scene.append(pageC);
        const etatC = pageC.querySelector('[data-role="etat-verification"]');
        eq([texte(etatC), etatC?.classList.contains('ok'), texte(pageC.querySelector('[data-role="ligne-lecture"]')), texte(pageC.querySelector('[data-role="incertain-lecture"]')), [...pageC.querySelectorAll('.recipe-body .chip')].filter((c) => c.textContent === 'incertain').length], ['Vérifiée', true, `Lue par l’assistant le ${formatDate(LU)} · page possiblement manquante`, 'Incertain : ' + INCERTAIN_ATTENDU, 0], 'fiche (?v= d’une correction vérifiée) : « Vérifiée » ; bandeau toujours là, daté de la LECTURE, sans « ligne(s) incertaine(s) » ; aucune puce « incertain »');
        const pageSo = await renderRecipe({ id: 'rc_sansoctets' }, {}, await ctxDe()); scene.append(pageSo);
        eq([pageSo.querySelector('[data-role="photo-plat"]'), !!pageSo.querySelector('[data-role="bandeau-lecture"]')], [null, true], 'fiche : un photo_sha256 sans octets dans files ne rend rien (pas même un cadre vide) ; le bandeau reste');
        const pageS = await renderRecipe({ id: 'rc_simple' }, {}, await ctxDe()); scene.append(pageS);
        eq([pageS.querySelector('[data-role="bandeau-lecture"]'), pageS.querySelector('[data-role="etat-verification"]'), pageS.querySelector('[data-role="photo-plat"]'), [...pageS.querySelectorAll('[data-role="texte-etape"]')].map((n) => n.textContent)], [null, null, null, ['Peler.', 'Cuire.']], 'témoin : une recette saisie à la main n’a ni bandeau, ni état de lecture, ni photo ; ses étapes passent par le même rendu');
        // Ronde 1 (Critique) : `Element.append(null)` écrit le nœud texte « null » — la fiche n'a AUCUN nœud texte direct, avec ou sans photo.
        eq([textesDirects(page), textesDirects(pageSo), textesDirects(pageS), pageS.textContent.includes('null')], [[], [], [], false], 'fiche : aucun nœud texte direct sous la racine — ni « null » d’une photo absente (avec photo, octets absents, recette saisie à la main)');
        const etatDe = async (v) => texte((await renderRecipe({ id: 'rc_imp' }, { v }, await ctxDe())).querySelector('[data-role="etat-verification"]'));
        eq([await etatDe('rv_mixte'), await etatDe('rv_une'), await etatDe('rv_sansligne')], ['4 lignes à vérifier', '1 ligne à vérifier', 'À vérifier'], 'fiche : l’état compte les lignes NON vérifiées de la version affichée (3 vérifiées sur 7 → « 4 lignes à vérifier » ; « 1 ligne à vérifier » ; une lecture sans ligne → « À vérifier »)');
        const ligneDe = async (v) => texte((await renderRecipe({ id: 'rc_imp' }, { v }, await ctxDe())).querySelector('[data-role="ligne-lecture"]'));
        eq([await ligneDe('rv_incomplete'), await ligneDe('rv_sansdate'), await ligneDe('rv_sansligne')], [`Lue par l’assistant le ${formatDate(LU)} · 2 ligne(s) incertaine(s) · page possiblement manquante · lecture incomplète`, 'Lue par l’assistant · 2 ligne(s) incertaine(s) · page possiblement manquante', `Lue par l’assistant le ${formatDate(LU)} · page possiblement manquante`], 'fiche : « lecture incomplète » est dite, en dernier (date, incertaines, page manquante, lecture incomplète) ; une date illisible n’est pas dite (jamais « le » suivi de rien) ; 0 incertaine → partie omise');
        const pageF = await renderRecipe({ id: 'rc_imp' }, { v: 'rv_formes' }, await ctxDe());
        eq([...pageF.querySelectorAll('.recipe-body ul.list.plain > li')].map((li) => [...li.querySelectorAll('.chip')].some((c) => c.textContent === 'incertain')), [false, false, true], 'fiche : la puce « incertain » pour uncertain === true seulement — « oui » et 1 (formes reçues ou restaurées) n’en ont pas');
        const pageP = await renderRecipe({ id: 'rc_pdf' }, {}, await ctxDe());
        eq([pageP.querySelector('[data-role="photo-plat"]'), textesDirects(pageP), !!pageP.querySelector('[data-role="bandeau-lecture"]')], [null, [], true], 'fiche : une photo du plat dont les octets ne sont pas une image (application/pdf) ne rend rien (S3), ni cadre ni nœud texte');
        const pageX = await renderRecipe({ id: 'rc_simple' }, { v: extraction.id }, await ctxDe());
        eq([pageX.querySelector('[data-role="bandeau-lecture"]'), [...pageX.querySelectorAll('[data-role="texte-etape"]')].map((n) => n.textContent)], [null, ['Peler.', 'Cuire.']], 'fiche : ?v= d’une version d’une AUTRE recette est ignoré (retour à la version courante) — jamais la lecture d’un autre import sur cette fiche');
      }

      // --- Mode cuisine (D-3) : bandeau « Lue par l'assistant, non relue » tant que la version est une extraction à vérifier ; étape entière
      await db.put('recipe_versions', { ...extraction, id: 'rv_verif', verification_state: 'verified' }); // une extraction reçue vérifiée (cuisine et courses)
      {
        const session = (id, vids) => ({ id, recipe_id: 'rc_imp', selected_version_ids: vids, servings: 6, progress: { done_step_ids: [] }, status: 'active', units: 'original' });
        const ctxCuisine = async (sessions) => ({ ...(await ctxDe()), cook_sessions: sessions });
        const cuisine = await renderCook({ id: 'cs_e' }, {}, await ctxCuisine([session('cs_e', [extraction.id])])); scene.append(cuisine);
        const b = cuisine.querySelector('[data-role="bandeau-non-relue"]');
        eq([texte(b), b?.classList.contains('status'), !!b && b.compareDocumentPosition(cuisine.querySelector('.cook')) === Node.DOCUMENT_POSITION_FOLLOWING], ['Lue par l’assistant, non relue', true, true], 'cuisine (D-3) : bandeau « Lue par l’assistant, non relue » pour une extraction à vérifier, avant l’étape');
        const et = cuisine.querySelector('.step-big [data-role="texte-etape"]');
        eq([et?.textContent, et?.style.whiteSpace], ['Peler les pommes.\nLes couper en quartiers.', 'pre-line'], 'cuisine : l’étape « a\\nb » est rendue entière (pre-line)');
        const cuisineC = await renderCook({ id: 'cs_c' }, {}, await ctxCuisine([session('cs_c', ['rv_corr'])]));
        const cuisineV = await renderCook({ id: 'cs_v' }, {}, await ctxCuisine([session('cs_v', ['rv_verif'])]));
        eq([cuisineC.querySelector('[data-role="bandeau-non-relue"]'), cuisineV.querySelector('[data-role="bandeau-non-relue"]')], [null, null], 'cuisine (D-3) : bandeau absent pour une correction et après vérification');
        const duo = await renderCook({ id: 'cs_duo' }, {}, await ctxCuisine([session('cs_duo', [extraction.id, 'rv_simple'])]));
        eq(texte(duo.querySelector('[data-role="bandeau-non-relue"]')), 'Tarte aux pommes · Lue par l’assistant, non relue', 'cuisine (D-3) : dans un repas, le bandeau nomme la recette non relue (pas l’autre)');
      }

      // --- Courses (D-3)
      {
        const liste = (id, vid) => ({ id, title: 'Courses', items: [{ recipe_id: vid === 'rv_simple' ? 'rc_simple' : 'rc_imp', recipe_version_id: vid, servings: 6, title: 'T' }], checked: {} });
        const ctxCourses = async (listes) => ({ ...(await ctxDe()), shopping_lists: listes });
        const courses = await renderShoppingList({ id: 'sl_e' }, {}, await ctxCourses([liste('sl_e', extraction.id)]));
        const b = courses.querySelector('[data-role="bandeau-non-relue"]');
        const ulCourses = courses.querySelector('ul.list');
        eq([texte(b), b?.classList.contains('status'), courses.querySelectorAll('ul.list > li').length > 0, !!b && !!ulCourses && b.compareDocumentPosition(ulCourses) === Node.DOCUMENT_POSITION_FOLLOWING], ['Lue par l’assistant, non relue', true, true, true], 'courses (D-3) : bandeau « Lue par l’assistant, non relue » pour une extraction à vérifier, AU-DESSUS de la liste (ordre affirmé)');
        const coursesC = await renderShoppingList({ id: 'sl_c' }, {}, await ctxCourses([liste('sl_c', 'rv_corr')]));
        const coursesS = await renderShoppingList({ id: 'sl_s' }, {}, await ctxCourses([liste('sl_s', 'rv_simple')]));
        const coursesV = await renderShoppingList({ id: 'sl_v' }, {}, await ctxCourses([liste('sl_v', 'rv_verif')]));
        eq([coursesC.querySelector('[data-role="bandeau-non-relue"]'), coursesS.querySelector('[data-role="bandeau-non-relue"]'), coursesV.querySelector('[data-role="bandeau-non-relue"]')], [null, null, null], 'courses (D-3) : bandeau absent pour une correction, une recette saisie à la main et une extraction vérifiée');
      }
      await db.delete('recipe_versions', 'rv_verif');

      // --- « Corriger » (Review Focus 5, spec § 4.3.7) : une étape par paragraphe, héritage de uncertain et de la provenance de lecture
      {
        const editeur = await renderRecipeEdit({ id: 'rc_imp' }, { kind: 'correction', v: extraction.id }, await ctxDe()); scene.append(editeur);
        const fEtapes = champ(editeur, 'Étapes'); const stepsTa = fEtapes?.querySelector('textarea');
        eq([stepsTa?.value, stepsTa?.placeholder, texte(fEtapes?.querySelector('small'))], ['Peler les pommes.\nLes couper en quartiers.\n\nCuire 45 min.', 'Une étape par paragraphe (ligne vide entre deux étapes).', 'Une étape par paragraphe (ligne vide entre deux étapes).'], 'Corriger : une étape de la version de départ porte un saut de ligne → zone jointe par une ligne vide, aide « Une étape par paragraphe (ligne vide entre deux étapes). »');
        eq(editeur.textContent.includes('2 étape(s)'), true, 'Corriger : l’aperçu compte 2 étapes (par paragraphe), pas 3 (par ligne)');
        // Enregistrer depuis l'éditeur : la version neuve est celle qui n'existait pas avant le clic ; l'adresse posée par la navigation est rendue.
        const idsDe = async (rid) => new Set((await db.byIndex('recipe_versions', 'recipe_id', rid)).map((v) => v.id));
        const enregistrer = async (ed, rid) => {
          const avant = await idsDe(rid);
          bouton(ed, 'Enregistrer une nouvelle version').click();
          await attendre(async () => (await idsDe(rid)).size === avant.size + 1, 'version écrite (' + rid + ')');
          await tick();
          const neuve = (await db.byIndex('recipe_versions', 'recipe_id', rid)).find((v) => !avant.has(v.id));
          const hash = location.hash; history.replaceState(null, '', adresseAvant);
          return { neuve, hash };
        };
        // Ronde 1 : la ligne retapée est une ligne INCERTAINE (« ? g de sucre » → « 100 g de sucre ») — elle perd uncertain, « ? ml de lait » le garde.
        const ingTa = champ(editeur, 'Ingrédients (une ligne par ingrédient, texte tel qu’imprimé)')?.querySelector('textarea');
        ingTa.value = ingTa.value.replace('? g de sucre', '100 g de sucre'); ingTa.dispatchEvent(new Event('input', { bubbles: true }));
        bouton(editeur, 'Analyser les lignes').click();
        eq(editeur.querySelectorAll('table.compare tbody tr').length, 7, 'Corriger : sept lignes analysées après le changement d’une quantité');
        const { neuve, hash } = await enregistrer(editeur, 'rc_imp');
        const rc = await db.get('recipes', 'rc_imp');
        eq([neuve.kind, neuve.parent_version_id, neuve.provenance.generated_by, neuve.provenance.import_id, neuve.provenance.incomplete, neuve.provenance.missing_page, neuve.provenance.titre_lu, neuve.provenance.lu_le], ['correction', extraction.id, 'manual', 'imp_fiche', false, true, 'Tarte aux pommes', LU], 'Corriger (Review Focus 5) : la version correction hérite import_id, incomplete, missing_page, titre_lu (et la date de lecture, lu_le) de sa parente');
        eq(neuve.ingredients.map((l) => [l.source_text, l.uncertain === true]), [['4 pommes', false], ['100 g de sucre', false], ['1 oeuf', false], ['100 g de beurre', false], ['? ml de lait', true], ['1 pincée de sel', false], ['200 g de farine', false]], 'Corriger (Review Focus 5) : la ligne INCERTAINE retapée (« ? g de sucre » → « 100 g de sucre ») perd uncertain ; l’autre incertaine (« ? ml de lait ») le garde ; les autres restent sans');
        eq([neuve.steps.map((s) => s.text), neuve.verification_state], [['Peler les pommes.\nLes couper en quartiers.', 'Cuire 45 min.'], 'to_verify'], 'Corriger (Review Focus 5) : les étapes multi-lignes restent entières (parParagraphe: true au save()) ; la version reste à vérifier');
        eq([rc.current_version_id, rc.availability, rc.verification_state, hash], [neuve.id, 'partial', 'to_verify', `#/recipes/rc_imp?v=${neuve.id}`], 'Corriger : la correction devient courante ; la fiche reste partial (page possiblement manquante : jamais comblée, I-1) ; navigation vers la version');
        const pageN = await renderRecipe({ id: 'rc_imp' }, { v: neuve.id }, await ctxDe()); scene.append(pageN);
        eq([texte(pageN.querySelector('[data-role="ligne-lecture"]')), texte(pageN.querySelector('[data-role="etat-verification"]')), [...pageN.querySelectorAll('.recipe-body .chip')].filter((c) => c.textContent === 'incertain').length], [LIGNE_LECTURE_1, '7 lignes à vérifier', 1], 'Corriger (Review Focus 5) : après la correction, le bandeau est toujours là (1 incertaine, page possiblement manquante, date de la LECTURE — pas celle du jour), « 7 lignes à vérifier », une puce « incertain »');

        // Vague finale (m18) : une correction d'une CORRECTION (la parente porte déjà lu_le, et sa propre date de création n'est pas LU) garde la date de
        // la LECTURE — jamais celle de la première correction.
        ok(neuve.created_at !== LU && typeof neuve.created_at === 'string', 'fixture (m18) : la première correction est datée du jour, pas de la lecture');
        const editeur2 = await renderRecipeEdit({ id: 'rc_imp' }, { kind: 'correction', v: neuve.id }, await ctxDe()); scene.append(editeur2);
        const ing2 = champ(editeur2, 'Ingrédients (une ligne par ingrédient, texte tel qu’imprimé)')?.querySelector('textarea');
        ing2.value = ing2.value.replace('100 g de sucre', '120 g de sucre'); ing2.dispatchEvent(new Event('input', { bubbles: true }));
        const { neuve: neuve2 } = await enregistrer(editeur2, 'rc_imp');
        const page2 = await renderRecipe({ id: 'rc_imp' }, { v: neuve2.id }, await ctxDe()); scene.append(page2);
        eq([neuve2.parent_version_id, neuve2.provenance.lu_le, texte(page2.querySelector('[data-role="ligne-lecture"]'))?.startsWith(`Lue par l’assistant le ${formatDate(LU)}`)], [neuve.id, LU, true], 'Corriger une correction (vague finale, m18) : lu_le reste la date de la LECTURE (héritée de la parente), et le bandeau la dit');
        // Vague finale (Important) : « lecture incomplète » (incomplete vrai, page présente) est héritée par « Corriger » — la fiche reste partial, le bandeau le dit.
        const fabInc = D.fabriquerExtraction(L.validateParsedRecipe({ ...RES, uncertain_fields: ['sel'], incomplete: true, missing_page: false }), { reference: { ...reference, id: 'rc_inc', original_title: 'Tarte incomplète' }, versions: [], pages: [], pageIds: [], edition, importId: 'imp_inc', modele: 'claude-x', photo: null, maintenant: LU });
        await db.mutate({ puts: { recipes: [{ ...fabInc.recipe, updated_at: LU }], recipe_versions: [{ ...fabInc.version, updated_at: LU }] }, origin: 'device' });
        const editeurI = await renderRecipeEdit({ id: 'rc_inc' }, { kind: 'correction', v: fabInc.version.id }, await ctxDe()); scene.append(editeurI);
        const ingI = champ(editeurI, 'Ingrédients (une ligne par ingrédient, texte tel qu’imprimé)')?.querySelector('textarea');
        ingI.value = ingI.value.replace('? g de sucre', '100 g de sucre'); ingI.dispatchEvent(new Event('input', { bubbles: true }));
        const { neuve: neuveI } = await enregistrer(editeurI, 'rc_inc');
        const pageI = await renderRecipe({ id: 'rc_inc' }, { v: neuveI.id }, await ctxDe()); scene.append(pageI);
        eq([fabInc.recipe.availability, neuveI.provenance.incomplete, neuveI.provenance.missing_page, neuveI.provenance.uncertain_fields, (await db.get('recipes', 'rc_inc')).availability, texte(pageI.querySelector('[data-role="ligne-lecture"]'))?.includes('lecture incomplète'), texte(pageI.querySelector('[data-role="incertain-lecture"]'))],
          ['partial', true, false, ['sel'], 'partial', true, 'Incertain : sel'], 'Corriger (vague finale, Important) : une lecture INCOMPLÈTE (page présente) → la correction hérite incomplete (et les incertitudes, m8), la fiche reste partial (jamais comblée, I-1), le bandeau dit « lecture incomplète » — même sans ligne du journal');
        // Vague finale (m14) : le save() de l'éditeur vérifie le vocabulaire PAR COMPORTEMENT — une adaptation d'une fiche reçue hors vocabulaire n'écrit rien.
        await db.mutate({ puts: { recipes: [{ ...simple, id: 'rc_hostile', current_version_id: 'rv_hostile', availability: 'dispo' }], recipe_versions: [{ ...versionSimple, id: 'rv_hostile', recipe_id: 'rc_hostile' }] }, origin: 'device' });
        const editeurH = await renderRecipeEdit({ id: 'rc_hostile' }, { kind: 'adaptation' }, await ctxDe()); scene.append(editeurH);
        const changementsH = champ(editeurH, 'Résumé des changements, raisons et compromis *')?.querySelector('textarea');
        changementsH.value = 'Moins de sucre'; changementsH.dispatchEvent(new Event('input', { bubbles: true }));
        const rejets = []; const surRejet = (e) => { rejets.push(e.reason?.name ?? String(e.reason)); e.preventDefault(); };
        window.addEventListener('unhandledrejection', surRejet);
        try {
          bouton(editeurH, 'Enregistrer une nouvelle version').click();
          await attendre(() => rejets.length === 1, 'save refusé');
        } finally { window.removeEventListener('unhandledrejection', surRejet); history.replaceState(null, '', adresseAvant); }
        eq([rejets, (await db.byIndex('recipe_versions', 'recipe_id', 'rc_hostile')).length, (await db.get('recipes', 'rc_hostile')).availability], [['ErreurVocabulaire'], 1, 'dispo'], 'éditeur (vague finale, m14) : une adaptation d’une fiche au vocabulaire hostile (availability « dispo ») → ErreurVocabulaire, AUCUNE version ni fiche écrite');

        // Ronde 1 : cocher « Vérifié » sur chaque ligne SANS rien retaper, puis enregistrer — le cas joué PAR l'éditeur (plus par une fixture posée à
        // la main) : une ligne vérifiée n'est plus incertaine (une seule règle, au save()) ; la fiche dit « Vérifiée », sans « ligne(s) incertaine(s) ».
        const editeurV = await renderRecipeEdit({ id: 'rc_imp' }, { kind: 'correction', v: extraction.id }, await ctxDe()); scene.append(editeurV);
        const cases = () => [...editeurV.querySelectorAll('table.compare tbody input[type="checkbox"]')];
        for (let i = 0; i < 7; i += 1) cases()[i].click();
        eq(cases().map((c) => c.checked), [true, true, true, true, true, true, true], 'Corriger : les sept cases « Vérifié » sont cochées (sans texte retapé)');
        const { neuve: neuveV } = await enregistrer(editeurV, 'rc_imp');
        eq([neuveV.verification_state, neuveV.ingredients.map((l) => `${l.verification_state}/${l.uncertain}`)], ['verified', Array(7).fill('verified/false')], 'Corriger : une ligne cochée « Vérifié » est enregistrée sans incertitude (vérifiée ⇒ plus incertaine), même sans texte retapé');
        const pageV = await renderRecipe({ id: 'rc_imp' }, { v: neuveV.id }, await ctxDe());
        eq([texte(pageV.querySelector('[data-role="etat-verification"]')), texte(pageV.querySelector('[data-role="ligne-lecture"]')), [...pageV.querySelectorAll('.recipe-body .chip')].filter((c) => c.textContent === 'incertain').length, [...pageV.querySelectorAll('.recipe-body .chip')].filter((c) => c.textContent === 'À vérifier').length], ['Vérifiée', `Lue par l’assistant le ${formatDate(LU)} · page possiblement manquante`, 0, 0], 'Corriger puis tout cocher : « Vérifiée », ni « ligne(s) incertaine(s) » ni puce « incertain » ; le bandeau de lecture reste (page possiblement manquante, date de la lecture)');

        // Ronde 1 : une étape lue avec une ligne vide INTERNE (gardée par validateParsedRecipe) reste UNE étape à la correction d'une seule quantité.
        const editeurP = await renderRecipeEdit({ id: 'rc_para' }, { kind: 'correction', v: fabPara.version.id }, await ctxDe()); scene.append(editeurP);
        const taP = champ(editeurP, 'Étapes')?.querySelector('textarea');
        eq([fabPara.version.steps.map((s) => s.text), taP?.value, editeurP.textContent.includes('2 étape(s)')], [['Faire la pâte :\n\nMélanger la farine et le beurre.', 'Cuire 45 min.'], 'Faire la pâte :\nMélanger la farine et le beurre.\n\nCuire 45 min.', true], 'Corriger : une étape à ligne vide interne est jointe repliée (un seul saut de ligne) — l’aperçu compte 2 étapes, pas 3');
        const ingP = champ(editeurP, 'Ingrédients (une ligne par ingrédient, texte tel qu’imprimé)')?.querySelector('textarea');
        ingP.value = ingP.value.replace('4 pommes', '5 pommes'); ingP.dispatchEvent(new Event('input', { bubbles: true }));
        const { neuve: neuveP } = await enregistrer(editeurP, 'rc_para');
        eq(neuveP.steps.map((s) => s.text), ['Faire la pâte :\nMélanger la farine et le beurre.', 'Cuire 45 min.'], 'Corriger (Review Focus 5) : l’étape à ligne vide interne survit entière au changement d’une seule quantité (2 étapes, pas 3)');

        // Ronde 1 : relecture par l'assistant DEPUIS « Corriger » (session et fetch factices : aucun réseau réel). La version écrite est de l'assistant :
        // elle n'hérite RIEN de l'ancienne lecture, ses étapes restent séparées en mode « par paragraphe », et le mode cuisine comme les courses disent
        // « Lue par l'assistant, non relue » (D-3).
        const SESSION_IA = { access_token: 'jeton-factice-t5', user: { id: 'u1', email: 'a@exemple.invalid' } };
        const LECTURE_IA = { title: 'Tarte aux pommes', servings: 6, ingredients: [{ source_text: '4 pommes', uncertain: false }, { source_text: '150 g de sucre', uncertain: false }], steps: [{ text: 'Peler les pommes.' }, { text: 'Cuire 45 min.' }], incomplete: false, missing_page: false };
        let appelsIA = 0;
        globalThis.fetch = async () => { appelsIA += 1; return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ model: 'claude-x', content: [{ type: 'text', text: JSON.stringify(LECTURE_IA) }] }) }; };
        try {
          const ctxIA = { ...(await ctxDe()), pagesById: new Map([['pg_ia', { id: 'pg_ia', sha256: shaPhoto, printed_page: 132 }]]), sync: { user: SESSION_IA.user, auth: { jeton: async () => SESSION_IA } } };
          const editeurIA = await renderRecipeEdit({ id: 'rc_imp' }, { kind: 'correction', v: extraction.id, pages: 'pg_ia' }, ctxIA); scene.append(editeurIA);
          const btnIA = bouton(editeurIA, 'Extraire avec l’assistant IA');
          eq(btnIA?.disabled, false, 'Corriger (relecture par l’assistant) : bouton allumé (session, une page)');
          btnIA.click();
          await attendre(() => editeurIA.textContent.includes('Extraction proposée par l’assistant'), 'relecture par l’assistant reçue');
          const { neuve: neuveIA } = await enregistrer(editeurIA, 'rc_imp');
          eq([appelsIA, neuveIA.kind, neuveIA.provenance.generated_by, ['import_id', 'incomplete', 'missing_page', 'titre_lu', 'lu_le'].filter((k) => k in neuveIA.provenance), K.banniereLecture(neuveIA), K.estExtractionNonRelue(neuveIA), neuveIA.steps.map((s) => s.text)], [1, 'correction', 'ai', [], null, true, ['Peler les pommes.', 'Cuire 45 min.']], 'Corriger → relecture par l’assistant : un appel ; la version est de l’assistant et n’hérite RIEN de l’ancienne lecture (ni import_id, ni page manquante, ni titre lu, ni date) ; ses deux étapes restent deux en mode « par paragraphe »');
          const cuisineIA = await renderCook({ id: 'cs_ia' }, {}, { ...(await ctxDe()), cook_sessions: [{ id: 'cs_ia', recipe_id: 'rc_imp', selected_version_ids: [neuveIA.id], servings: 6, progress: { done_step_ids: [] }, status: 'active', units: 'original' }] });
          const coursesIA = await renderShoppingList({ id: 'sl_ia' }, {}, { ...(await ctxDe()), shopping_lists: [{ id: 'sl_ia', title: 'Courses', items: [{ recipe_id: 'rc_imp', recipe_version_id: neuveIA.id, servings: 6, title: 'T' }], checked: {} }] });
          eq([texte(cuisineIA.querySelector('[data-role="bandeau-non-relue"]')), texte(coursesIA.querySelector('[data-role="bandeau-non-relue"]'))], ['Lue par l’assistant, non relue', 'Lue par l’assistant, non relue'], 'Corriger → relecture par l’assistant : mode cuisine et courses disent « Lue par l’assistant, non relue » (D-3), même écrite en correction');
        } finally { globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); }; }

        // Ronde 1 : `?v=` d'une version d'une AUTRE recette n'est jamais la base de l'éditeur (ni son héritage de lecture).
        const editeurX = await renderRecipeEdit({ id: 'rc_simple' }, { kind: 'correction', v: extraction.id }, await ctxDe());
        eq(champ(editeurX, 'Étapes')?.querySelector('textarea')?.value, 'Peler.\nCuire.', 'Corriger : ?v= d’une version d’une AUTRE recette est ignoré — la base est la version courante de cette fiche');
        const editeurS = await renderRecipeEdit({ id: 'rc_simple' }, { kind: 'correction', v: 'rv_simple' }, await ctxDe()); scene.append(editeurS);
        const fS = champ(editeurS, 'Étapes'); const taS = fS?.querySelector('textarea');
        eq([taS?.value, taS?.placeholder, fS?.querySelector('small')], ['Peler.\nCuire.', 'Une étape par ligne ou par paragraphe.', null], 'éditeur d’aujourd’hui : sans étape multi-ligne, une étape par ligne, aide actuelle, pas d’aide « par paragraphe »');
        taS.value = 'Peler.\nCuire.\nServir.'; taS.dispatchEvent(new Event('input', { bubbles: true }));
        bouton(editeurS, 'Enregistrer une nouvelle version').click();
        await attendre(async () => (await db.byIndex('recipe_versions', 'recipe_id', 'rc_simple')).length === 2, 'correction simple écrite');
        await tick();
        const neuveS = (await db.byIndex('recipe_versions', 'recipe_id', 'rc_simple')).find((v) => v.id !== 'rv_simple');
        eq([neuveS.steps.map((s) => s.text), 'import_id' in neuveS.provenance, 'lu_le' in neuveS.provenance, (await db.get('recipes', 'rc_simple')).availability], [['Peler.', 'Cuire.', 'Servir.'], false, false, 'available'], 'éditeur d’aujourd’hui : une étape ajoutée sur une nouvelle ligne reste une étape ; rien d’hérité sans lecture ; disponibilité inchangée');
        history.replaceState(null, '', adresseAvant);
        eq(reseau, 0, 'Corriger : aucun réseau');
      }
    } finally { globalThis.fetch = vraiFetch; scene.remove(); setUiLocale(localeAvant); if (location.href !== adresseAvant) history.replaceState(null, '', adresseAvant); }
  }));

  // =====================================================================================================================================
  // Tâche 6 — la section « Imports » d'Ajouter (spec § 4.5), la reprise par sorte, le journal pour l'éditeur et le panneau d'index (§ 4.6), les
  // séances filtrées (§ 4.1, N3) et les deux passes du démarrage (§ 3.1 : interrompu, purge à 30 jours ; Review Focus 3). Base jetable (withRepo),
  // fetch injectée (l'éditeur et le panneau d'index passent par la fetch GLOBALE, remplacée le temps de leurs blocs), aucune écriture dans la
  // bibliothèque de la personne, jamais le routeur de l'app (les navigations sont injectées, ou l'adresse est restaurée).
  await run('section Imports, reprise, journal, démarrage (tâche 6)', () => withRepo(async (repo, db) => {
    const D = await import('../src/domain/import-cible.js');
    const UI = await import('../src/ui/import-cible.js');
    const A = await import('../src/ui/add.js');
    const B = await import('../src/ui/book.js');
    const I = await import('../src/ui/import.js');
    const R = await import('../src/ui/recipe-edit.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale(); setUiLocale('fr'); // des textes français sont affirmés
    const adresseAvant = location.href;
    const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(scene);
    const vraiFetch = globalThis.fetch; let reseau = 0;
    const fetchInterdite = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
    globalThis.fetch = fetchInterdite;
    const interdit = async () => { reseau += 1; throw new Error('aucun appel attendu'); };
    const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const bouton = (root, nom) => (root ? [...root.querySelectorAll('button')].find((b) => b.textContent === nom) || null : null);
    const boutons = (root) => (root ? [...root.querySelectorAll('button')].map((b) => b.textContent) : null);
    const champ = (root, libelle) => [...root.querySelectorAll('.field')].find((f) => f.querySelector('span')?.textContent === libelle) || null;
    const NOW = '2026-10-19T12:00:00.000Z';
    const JETON = 'jeton-t6-sentinelle';
    const SESSION = { access_token: JETON, user: { id: 'u1', email: 'a@exemple.invalid' } };
    const RECETTE = { title: 'Tarte aux pommes', servings: 6, prep_minutes: 20, cook_minutes: 45, ingredients: [{ source_text: '4 pommes', uncertain: false }, { source_text: '? g de sucre', uncertain: true }], steps: [{ text: 'Peler les pommes.' }, { text: 'Cuire 45 min.' }], printed_page: 10, sub_recipes: [], uncertain_fields: [], notes: null, incomplete: false, missing_page: false };
    const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
    const corpsOk = (contenu = RECETTE) => ({ model: 'claude-x', stop_reason: 'end_turn', content: [{ type: 'text', text: typeof contenu === 'string' ? contenu : JSON.stringify(contenu) }] });
    // La fausse fetch des blocs de l'écran ciblé : elle HONORE le signal, se résout à la main (a.rendre[i]) ou toute seule (a.auto).
    const fauxFetch = (auto = null) => {
      const a = { appels: [], rendre: [], auto };
      a.fetch = (url, options) => new Promise((resolve, reject) => {
        const appel = { url, options }; a.appels.push(appel);
        const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
        if (options?.signal?.aborted) { abandon(); return; }
        options?.signal?.addEventListener('abort', abandon, { once: true });
        const fin = (status, corps) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(status, corps)); };
        if (a.auto) { const d = typeof a.auto === 'function' ? a.auto(appel) : a.auto; fin(d[0], d[1]); } else a.rendre.push(fin);
      });
      return a;
    };
    const imageDe = async (nom, couleur) => { const c = new OffscreenCanvas(320, 240); const cx = c.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, 320, 240); cx.fillStyle = '#fff'; cx.fillRect(10, 10, 160, 120); return new File([await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' }); };
    const images = async (n, tag) => { const f = []; for (let i = 0; i < n; i += 1) f.push(await imageDe(`${tag}-${i}.jpg`, ['#811', '#181', '#118'][i % 3])); return f; };
    const navs = [], dits = [];
    const bloc = (nom, fn) => run('tâche 6 — ' + nom, async () => {
      scene.replaceChildren(); navs.length = 0; dits.length = 0; globalThis.fetch = fetchInterdite;
      try { await fn(); }
      catch (e) { if (UI.volEnCours()) UI.reinitialiserImportCible(); throw e; } // un bloc qui échoue en plein vol ne fait pas tomber les suivants en vol_tenu
      finally { globalThis.fetch = fetchInterdite; }
    });
    // La bibliothèque du bloc : un livre, des références « Repérées dans ton livre » (une par cas de la section).
    const livre = { id: 'b6', title: 'Livre six', author: 'A. B.', updated_at: DATE };
    const edition = { id: 'ed6', book_id: 'b6', language: 'fr', updated_at: DATE };
    const fiche = (id) => ({ id, edition_id: 'ed6', original_title: 'Tarte ' + id, original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: 10, source_page_ids: [], current_version_id: null, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE });
    await db.mutate({ puts: { books: [livre], book_editions: [edition], recipes: ['rc6a', 'rc6b', 'rc6c', 'rc6d', 'rc6e', 'rc6f', 'rc6g'].map(fiche) }, origin: 'device' });
    // Le contexte de l'app (getData), relu dans la base à chaque montage.
    const ctxDe = async (session = SESSION) => {
      const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions'); const pages = await db.getAll('source_pages');
      return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])),
        books: [livre], book_editions: [edition], editionsById: new Map([['ed6', edition]]), booksById: new Map([['b6', livre]]), library_activity: [],
        imports: await db.getAll('imports'), scan_sessions: await db.getAll('scan_sessions'), source_pages: pages, pagesById: new Map(pages.map((p) => [p.id, p])), source_documents: await db.getAll('source_documents'),
        ingredients: [], ingredientsById: new Map(), settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' }, rediscovery_prefs: [], docsByRecipe: new Map(),
        sync: { user: session ? { id: 'u1', email: 'a@exemple.invalid' } : null, auth: { jeton: async () => session } }, conventionFor: () => null, editionLabel: (e) => (e?.id === 'ed6' ? 'Livre six' : '') };
    };
    try {
      // --- 1. Domaine PUR (spec § 4.5) : une ligne par import ouvert et par séance ouverte, par table.
      await bloc('domaine : lignesImports et cibleReprise', async () => {
        const ICI = 'doc-ici', MOI = 'dev-ici', AUTRE = 'dev-ailleurs';
        const ilYa = (min) => new Date(Date.parse(NOW) - min * 60000).toISOString();
        const ctxL = (imports, scan_sessions = []) => ({ imports, scan_sessions, recipesById: new Map([['rc1', { id: 'rc1', edition_id: 'ed1', original_title: 'Tarte aux pommes' }], ['rc_dispo', { id: 'rc_dispo', edition_id: 'ed1', original_title: 'Gâteau', availability: 'available' }]]), editionsById: new Map([['ed1', { id: 'ed1', book_id: 'b1' }]]), booksById: new Map([['b1', { id: 'b1', title: 'Mon livre' }]]) });
        const opts = { maintenant: NOW, documentId: ICI, deviceId: MOI };
        const lig = (id, over = {}) => ({ id, kind: 'recette', recipe_id: 'rc1', edition_id: 'ed1', scan_session_id: 'ss_' + id, page_ids: ['p1', 'p2'], status: 'a_lancer', erreur: null, resultat: null, device_id: MOI, document_id_vol: null, updated_at: ilYa(5), ...over });
        const un = (l) => { const r = D.lignesImports(ctxL([l]), opts); return r.length === 1 ? r[0] : { rien: r }; };
        const resume = (r) => [r.etat, r.titre?.type, r.gestes, r.ailleurs, r.autreAppareil, r.referenceAbsente, r.raison, r.cible];
        const CIBLE = (id) => '/recipes/rc1/importer?import=' + id; // vague finale (m4) : l’écran ciblé reçoit LA ligne
        for (const [nom, l, attendu] of [
          ['a_lancer, recette ciblée → Reprendre (écran, photos en place), Ignorer', lig('i1'), ['a_lancer', 'reference', ['reprendre', 'ignorer'], false, false, false, null, CIBLE('i1')]],
          ['en_cours tenu par CE document → Annuler seulement', lig('i2', { status: 'en_cours', document_id_vol: ICI }), ['en_cours', 'reference', ['annuler'], false, false, false, null, CIBLE('i2')]],
          ['en_cours tenu par un autre document du même appareil → « ailleurs », ni Annuler ni Ignorer', lig('i3', { status: 'en_cours', document_id_vol: 'doc-autre' }), ['en_cours', 'reference', [], true, false, false, null, CIBLE('i3')]],
          ['a_verifier avec résultat → Reprendre, Ignorer', lig('i4', { status: 'a_verifier', resultat: { title: 'T' } }), ['a_verifier', 'reference', ['reprendre', 'ignorer'], false, false, false, null, CIBLE('i4')]],
          ['echec(incertain) → Relancer, Ignorer ; la raison est rendue (phrase I-4 à l’écran)', lig('i5', { status: 'echec', erreur: { raison: 'incertain', extra: {} } }), ['echec', 'reference', ['relancer', 'ignorer'], false, false, false, 'incertain', CIBLE('i5')]],
          ['a_lancer, « Regrouper en recette » (sans recipe_id) → l’éditeur par ?import=', lig('i6', { recipe_id: null }), ['a_lancer', 'regrouper', ['reprendre', 'ignorer'], false, false, false, null, '/recipes/new?import=i6']],
          ['a_verifier, index → le panneau d’index de la séance par ?import=', lig('i7', { kind: 'index', recipe_id: null, status: 'a_verifier', resultat: { entries: [], uncertain: [] } }), ['a_verifier', 'index', ['reprendre', 'ignorer'], false, false, false, null, '/import?session=ss_i7&import=i7']],
          ['echec, index → Relancer, Ignorer', lig('i8', { kind: 'index', recipe_id: null, status: 'echec', erreur: { raison: 'serveur', extra: {} } }), ['echec', 'index', ['relancer', 'ignorer'], false, false, false, 'serveur', '/import?session=ss_i8&import=i8']],
          ['index sans séance : rien où reprendre (Ignorer seulement)', lig('i9', { kind: 'index', recipe_id: null, scan_session_id: null, status: 'a_verifier', resultat: { entries: [] } }), ['a_verifier', 'index', ['ignorer'], false, false, false, null, null]],
          // Ronde 1 : les douze combinaisons (4 états × 3 sortes) — « Recette à regrouper » et index aux états qui manquaient.
          ['en_cours, « Regrouper en recette », tenu par CE document → Annuler seulement', lig('r1', { recipe_id: null, status: 'en_cours', document_id_vol: ICI }), ['en_cours', 'regrouper', ['annuler'], false, false, false, null, '/recipes/new?import=r1']],
          ['a_verifier, « Regrouper en recette » → Reprendre (l’éditeur prérempli), Ignorer', lig('r2', { recipe_id: null, status: 'a_verifier', resultat: { title: 'T' } }), ['a_verifier', 'regrouper', ['reprendre', 'ignorer'], false, false, false, null, '/recipes/new?import=r2']],
          ['echec, « Regrouper en recette » → Relancer, Ignorer', lig('r3', { recipe_id: null, status: 'echec', erreur: { raison: 'delai', extra: {} } }), ['echec', 'regrouper', ['relancer', 'ignorer'], false, false, false, 'delai', '/recipes/new?import=r3']],
          ['a_lancer, index → Reprendre (le panneau de sa séance), Ignorer', lig('x1', { kind: 'index', recipe_id: null }), ['a_lancer', 'index', ['reprendre', 'ignorer'], false, false, false, null, '/import?session=ss_x1&import=x1']],
          ['en_cours, index tenu par CE document → Annuler seulement', lig('x2', { kind: 'index', recipe_id: null, status: 'en_cours', document_id_vol: ICI }), ['en_cours', 'index', ['annuler'], false, false, false, null, '/import?session=ss_x2&import=x2']],
          ['en_cours, index tenu ailleurs → « ailleurs », aucun geste', lig('x4', { kind: 'index', recipe_id: null, status: 'en_cours', document_id_vol: 'doc-autre' }), ['en_cours', 'index', [], true, false, false, null, '/import?session=ss_x4&import=x4']],
          // Ronde 1 (mineurs) : « Relancer » sans page ne lirait rien (refus sans_page, muet) ; une référence devenue available est refusée par l'écran ciblé
          // (« Cette recette a déjà son texte. ») : Ignorer seulement, aucun POST payé pour rien.
          ['echec SANS page → Ignorer seulement', lig('x3', { status: 'echec', page_ids: [], erreur: { raison: 'serveur', extra: {} } }), ['echec', 'reference', ['ignorer'], false, false, false, 'serveur', CIBLE('x3')]],
          ['echec, référence devenue available → Ignorer seulement', lig('d1', { recipe_id: 'rc_dispo', status: 'echec', erreur: { raison: 'serveur', extra: {} } }), ['echec', 'reference', ['ignorer'], false, false, false, 'serveur', '/recipes/rc_dispo/importer?import=d1']],
          ['a_verifier, référence devenue available → Ignorer seulement', lig('d2', { recipe_id: 'rc_dispo', status: 'a_verifier', resultat: { title: 'T' } }), ['a_verifier', 'reference', ['ignorer'], false, false, false, null, '/recipes/rc_dispo/importer?import=d2']],
          ['a_lancer, référence devenue available → Ignorer seulement', lig('d3', { recipe_id: 'rc_dispo' }), ['a_lancer', 'reference', ['ignorer'], false, false, false, null, '/recipes/rc_dispo/importer?import=d3']],
          ['autre appareil, a_lancer → Ignorer seulement (ni Reprendre sans résultat, ni Relancer)', lig('j1', { device_id: AUTRE }), ['a_lancer', 'reference', ['ignorer'], false, true, false, null, CIBLE('j1')]],
          ['autre appareil, a_verifier SANS résultat → sans Reprendre', lig('j2', { device_id: AUTRE, status: 'a_verifier' }), ['a_verifier', 'reference', ['ignorer'], false, true, false, null, CIBLE('j2')]],
          ['autre appareil, a_verifier avec résultat → Reprendre, Ignorer', lig('j3', { device_id: AUTRE, status: 'a_verifier', resultat: { title: 'T' } }), ['a_verifier', 'reference', ['reprendre', 'ignorer'], false, true, false, null, CIBLE('j3')]],
          ['autre appareil, echec → Ignorer seulement', lig('j4', { device_id: AUTRE, status: 'echec', erreur: { raison: 'serveur', extra: {} } }), ['echec', 'reference', ['ignorer'], false, true, false, 'serveur', CIBLE('j4')]],
          ['autre appareil, en_cours → « ailleurs », aucun geste', lig('j5', { device_id: AUTRE, status: 'en_cours', document_id_vol: 'doc-x' }), ['en_cours', 'reference', [], true, true, false, null, CIBLE('j5')]],
          ['recipe_id pas encore reçu → referenceAbsente, aucun geste', lig('j6', { recipe_id: 'rc_inconnue', status: 'a_verifier', resultat: { title: 'T' } }), ['a_verifier', 'reference', [], false, false, true, null, '/recipes/rc_inconnue/importer?import=j6']],
        ]) eq(resume(un(l)), attendu, `lignesImports — ${nom}`);
        const r1 = un(lig('i1'));
        eq([r1.id, r1.kind, r1.titre, r1.age, r1.pages], ['i1', 'recette', { type: 'reference', texte: 'Tarte aux pommes', livre: 'Mon livre' }, { n: 5, unite: 'min' }, 2], 'lignesImports : id, sorte, titre de la référence et son livre, âge, nombre de pages');
        eq([un(lig('i6', { recipe_id: null })).titre, un(lig('i7', { kind: 'index', recipe_id: null, edition_id: null })).titre, un(lig('j6', { recipe_id: 'rc_inconnue' })).titre], [{ type: 'regrouper', texte: null, livre: 'Mon livre' }, { type: 'index', texte: null, livre: null }, { type: 'reference', texte: null, livre: 'Mon livre' }], 'lignesImports : « Recette à regrouper » et « Index » portent le livre (null sans livre) ; une référence absente n’a pas de titre');
        eq([un(lig('k1', { updated_at: ilYa(3 * 60 + 5) })).age, un(lig('k2', { updated_at: ilYa(2 * 1440 + 30) })).age, un(lig('k3', { updated_at: 'pas une date' })).age], [{ n: 3, unite: 'h' }, { n: 2, unite: 'j' }, { n: 0, unite: 'min' }], 'lignesImports : âge en min / h / j ; une date illisible vaut 0 min');
        eq(D.lignesImports(ctxL([lig('t1', { status: 'enregistre' }), lig('t2', { status: 'ignore' }), lig('t3', { status: 'bizarre' }), lig('t4', { kind: 'couverture' }), null, 'x', lig('t5', { id: 7 })]), opts), [], 'lignesImports : enregistre, ignore, un statut inconnu, une sorte réservée (couverture ; « web » est listée depuis le lot B), une ligne mal formée ne sont pas listés (rien d’inventé)');
        eq(D.lignesImports(ctxL([lig('o1', { updated_at: ilYa(30) }), lig('o2', { updated_at: ilYa(2) }), lig('o3', { updated_at: ilYa(10) })]), opts).map((r) => r.id), ['o2', 'o3', 'o1'], 'lignesImports : la plus récente d’abord');
        eq([D.lignesImports(null, opts), D.lignesImports({}, opts)], [[], []], 'lignesImports : un contexte vide ou absent ne lève pas');
        // Séances (spec § 4.1, N3) : une ligne par séance OUVERTE, sauf celle d'un import CIBLÉ non terminé (de retour après ignore) ; une séance où
        // « Regrouper en recette » ou le panneau d'index a écrit un import reste toujours listée.
        const seance = (id, over = {}) => ({ id, status: 'open', edition_id: 'ed1', page_ids: ['p1', 'p2', 'p3'], started_at: ilYa(60), device_id: MOI, ...over });
        const seances = (imports, ss) => D.lignesImports(ctxL(imports, ss), opts).filter((r) => r.kind === 'seance').map((r) => r.id);
        const rs = D.lignesImports(ctxL([], [seance('s1')]), opts);
        eq(rs.map((r) => [r.id, r.kind, r.titre, r.gestes, r.cible, r.pages, r.age, r.etat]), [['s1', 'seance', { type: 'seance', texte: null, livre: 'Mon livre' }, ['ouvrir_seance'], '/import?session=s1', 3, { n: 1, unite: 'h' }, 'open']], 'séance ouverte sans import → une ligne « Photos conservées », geste ouvrir_seance, vers la séance');
        eq([seances([], [seance('s2', { status: 'done' })]), seances([lig('c1', { scan_session_id: 's3' })], [seance('s3')]), seances([lig('c1', { scan_session_id: 's3', status: 'ignore' })], [seance('s3')]),
          seances([lig('g1', { recipe_id: null, scan_session_id: 's4', status: 'a_verifier', resultat: {} })], [seance('s4')]), seances([lig('x1', { kind: 'index', recipe_id: null, scan_session_id: 's5' })], [seance('s5')])],
        [[], [], ['s3'], ['s4'], ['s5']], 'séances : terminée → absente ; celle d’un import CIBLÉ non terminé → absente, de retour après ignore ; celle où « Regrouper en recette » ou le panneau d’index a écrit un import → toujours listée');
        eq(D.lignesImports(ctxL([lig('a1')], [seance('s1', { page_ids: undefined })]), opts).map((r) => [r.kind, r.pages]), [['recette', 2], ['seance', 0]], 'lignesImports : les imports d’abord, puis les séances ; une séance sans page_ids compte 0 page');
        eq([D.cibleReprise({ id: 'imp a', kind: 'recette', recipe_id: 'rc/1' }), D.cibleReprise({ id: 'imp_b', kind: 'recette', recipe_id: null }), D.cibleReprise({ id: 'imp&c', kind: 'index', scan_session_id: 'ss&1' }), D.cibleReprise({ id: 'imp_d', kind: 'index', scan_session_id: null }), D.cibleReprise({ id: 'imp_e', kind: 'couverture', recipe_id: 'rc1' }), D.cibleReprise(null)],
          ['/recipes/rc%2F1/importer?import=imp%20a', '/recipes/new?import=imp_b', '/import?session=ss%261&import=imp%26c', null, null, null], 'cibleReprise : recette ciblée → l’écran ciblé ; recette sans recipe_id → l’éditeur ?import= ; index → le panneau de sa séance ; identifiants encodés ; index sans séance, ou sorte inconnue (couverture, même avec une recipe_id) → null');
        // Ronde 1 (mineur) : validerIndex borne aussi le NOMBRE d'entrées, d'incertitudes et de mentions — un index relu du journal (synchro, archive) en
        // porterait 20 000 sous la borne de 512 Kio, et « Créer les références » écrirait autant de fiches.
        const L = await import('../src/domain/llm.js');
        const raisonIndex = (data) => { try { L.validerIndex(data); return 'ok'; } catch (e) { return e?.raison ?? e?.message; } };
        const n = (k, f) => Array.from({ length: k }, (_, i) => f(i));
        eq([L.BORNES_INDEX_A, raisonIndex({ entries: n(500, (i) => ({ title: 'T' + i, printed_page: 1 })), uncertain: n(40, (i) => 'u' + i) }), raisonIndex({ entries: n(501, (i) => ({ title: 'T' + i })) }), raisonIndex({ entries: [], uncertain: n(41, (i) => 'u' + i) }),
          raisonIndex({ entries: [{ title: 'T', ingredients_mentioned: n(80, (i) => 'm' + i) }] }), raisonIndex({ entries: [{ title: 'T', ingredients_mentioned: n(81, (i) => 'm' + i) }] })],
        [{ entrees: 500, incertains: 40, mentions: 80 }, 'ok', 'hors_bornes', 'hors_bornes', 'ok', 'hors_bornes'], 'validerIndex (ronde 1) : 500 entrées, 40 incertitudes et 80 mentions par entrée au plus ; au-delà → hors_bornes (comme les listes de la recette)');
      });

      // --- 2. Démarrage (spec § 3.1, Review Focus 3) : capture posée PUIS repo.init() rappelé (comme tests/assistant-compte.js).
      await bloc('démarrage : interrompu (> 90 s, cet appareil) et purge à 30 jours ; ronde 1 : battement illisible, autre appareil au-delà de 10 min', async () => {
        try {
          const T = Date.now();
          const avant = (ms) => new Date(T - ms).toISOString();
          const J = 24 * 3600 * 1000;
          const moi = repo.deviceId();
          ok(typeof moi === 'string' && moi.length > 0, 'démarrage : l’appareil a son identité (posée par init)');
          const base = (id, over) => ({ id, kind: 'recette', recipe_id: null, edition_id: null, scan_session_id: null, page_ids: [], photo_sha256: null, erreur: null, resultat: null, reponse_brute: 'brut', appels: 1, model: null, duree_ms: null, device_id: moi, document_id_vol: null, battement_at: null, started_at: avant(200000), finished_at: null, created_at: avant(40 * J), ...over });
          const lignes = [
            base('imp_mort', { status: 'en_cours', document_id_vol: 'doc-ferme', battement_at: avant(120000), updated_at: avant(120000) }),
            base('imp_vif', { status: 'en_cours', document_id_vol: 'doc-ouvert', battement_at: avant(30000), updated_at: avant(30000) }),
            base('imp_ailleurs', { status: 'en_cours', device_id: 'dev-autre', document_id_vol: 'doc-autre', battement_at: avant(120000), updated_at: avant(120000) }),
            base('imp_course', { status: 'en_cours', document_id_vol: 'doc-ouvert', battement_at: avant(10000), updated_at: avant(10000) }),
            base('imp_enr31', { status: 'enregistre', reponse_brute: null, finished_at: avant(31 * J), updated_at: avant(31 * J) }),
            base('imp_ign31', { status: 'ignore', updated_at: avant(31 * J) }),
            base('imp_enr29', { status: 'enregistre', reponse_brute: null, updated_at: avant(29 * J) }),
            base('imp_ign29', { status: 'ignore', updated_at: avant(29 * J) }),
            base('imp_echec60', { status: 'echec', erreur: { raison: 'serveur', extra: {} }, updated_at: avant(60 * J) }),
            // Ronde 1 : un battement ILLISIBLE ne prouve aucun vol vivant (décision 6) ; une ligne d'un AUTRE appareil dont le vol a commencé il y a plus
            // de 10 min (bien au-delà du délai client de 135 s) n'a plus de vol vivant nulle part — iPhone perdu, PWA réinstallée, archive restaurée
            // ailleurs : elle est interrompue sur n'importe quel appareil ; à 9 min, elle reste (son vol peut encore vivre).
            base('imp_sans_battement', { status: 'en_cours', document_id_vol: 'doc-ferme', battement_at: null, updated_at: avant(200000) }),
            base('imp_perdu', { status: 'en_cours', device_id: 'dev-perdu', document_id_vol: 'doc-perdu', battement_at: '2026-01-01T00:00:00.000Z', started_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }),
            base('imp_ailleurs9', { status: 'en_cours', device_id: 'dev-autre', document_id_vol: 'doc-autre', battement_at: avant(9 * 60000), started_at: avant(9 * 60000), updated_at: avant(9 * 60000) }),
          ];
          const version = { id: 'rv_purge', recipe_id: 'rc_purge', kind: 'extraction', ingredients: [], steps: [], provenance: { generated_by: 'ai', import_id: 'imp_enr31' }, verification_state: 'to_verify', created_at: avant(31 * J), updated_at: avant(31 * J) };
          await db.mutate({ puts: { imports: lignes, recipe_versions: [version] }, origin: 'device' });
          const fileAvant = new Set((await db.getAll('outbox')).map((e) => e.seq));
          // La course entre deux onglets : le démarrage LIT un battement vieux pour imp_course, alors que l'autre onglet l'a rafraîchi (−10 s) — la passe
          // relit le battement DANS sa transaction et n'écrit rien.
          const lireIndex = db.byIndex.bind(db);
          db.byIndex = async (s, i, v) => (await lireIndex(s, i, v)).map((l) => (l?.id === 'imp_course' ? { ...l, battement_at: avant(120000) } : l));
          try { await repo.init(); } finally { db.byIndex = lireIndex; }
          const parId = new Map((await db.getAll('imports')).map((l) => [l.id, l]));
          const mort = parId.get('imp_mort');
          eq([mort?.status, mort?.erreur, mort?.document_id_vol, mort?.battement_at], ['echec', { raison: 'interrompu', extra: {} }, null, lignes[0].battement_at], 'démarrage : en_cours de CET appareil dont le battement a 120 s → echec(interrompu), vol libéré');
          eq(['imp_vif', 'imp_ailleurs', 'imp_course'].map((id) => [parId.get(id)?.status, parId.get(id)?.updated_at]), [['en_cours', lignes[1].updated_at], ['en_cours', lignes[2].updated_at], ['en_cours', lignes[3].updated_at]], 'démarrage (Review Focus 3) : battement à −30 s → intact ; ligne d’un AUTRE appareil (−120 s) → intacte ; battement rafraîchi par un autre onglet entre la lecture et la transaction → intact (relu dans la transaction)');
          eq(['imp_sans_battement', 'imp_perdu'].map((id) => [parId.get(id)?.status, parId.get(id)?.erreur?.raison, parId.get(id)?.document_id_vol]), [['echec', 'interrompu', null], ['echec', 'interrompu', null]], 'démarrage (ronde 1) : en_cours de CET appareil sans battement lisible → interrompu ; en_cours d’un AUTRE appareil dont le vol a plus de 10 min → interrompu (plus d’impasse « En cours sur un autre écran » sans geste)');
          eq([parId.get('imp_ailleurs9')?.status, parId.get('imp_ailleurs9')?.updated_at], ['en_cours', lignes.find((l) => l.id === 'imp_ailleurs9').updated_at], 'démarrage (ronde 1) : une ligne d’un autre appareil dont le vol a 9 min reste en_cours, intacte');
          eq(['imp_enr31', 'imp_ign31'].map((id) => parId.has(id)), [false, false], 'démarrage : enregistre et ignore vieux de 31 jours → supprimés');
          eq(['imp_enr29', 'imp_ign29', 'imp_echec60'].map((id) => parId.get(id)?.status), ['enregistre', 'ignore', 'echec'], 'démarrage : vieux de 29 jours → intacts ; un echec de 60 jours reste (un échec attend un geste)');
          eq(await db.get('recipe_versions', 'rv_purge'), version, 'démarrage : la version dont provenance.import_id pointe une ligne purgée reste intacte (pointeur souple)');
          const neuves = (await db.getAll('outbox')).filter((e) => !fileAvant.has(e.seq));
          eq(neuves.map((e) => [e.store, e.id, e.op]).sort(), [['imports', 'imp_enr31', 'delete'], ['imports', 'imp_ign31', 'delete'], ['imports', 'imp_mort', 'put'], ['imports', 'imp_perdu', 'put'], ['imports', 'imp_sans_battement', 'put']], 'démarrage : interrompu (put) et chaque purge (delete, tombale d’origine local : « À envoyer » monte d’autant, assumé) entrent en file ; rien pour les lignes intactes');
          eq(neuves.filter((e) => e.op === 'delete').map((e) => e.payload?.id).sort(), ['imp_enr31', 'imp_ign31'], 'démarrage : la tombale porte la copie de la ligne supprimée');
          const n1 = (await db.getAll('outbox')).length;
          await repo.init();
          eq([(await db.getAll('outbox')).length, (await db.get('imports', 'imp_vif'))?.status, (await db.count('imports'))], [n1, 'en_cours', 10], 'démarrage : un second init() n’écrit rien de plus (rejouable)');
        } finally { await db.mutate({ clearStores: ['imports', 'recipe_versions'], origin: 'device' }); } // les blocs suivants partent d'un journal vide, même après un rouge (ronde 1)
      });

      // --- Vague finale : le battement INTERNE (hors de la ligne synchronisée), relu dans la transaction ; les horloges futures (m11) ; le repli started_at
      // d'une ligne d'un autre appareil (m16) ; le décalage serveur pour les lignes d'ailleurs (m11).
      await bloc('démarrage (vague finale) : battement interne, horloges futures, started_at d’un autre appareil, décalage serveur', async () => {
        const { setClockOffset } = await import('../src/sync/clock.js');
        const cles = ['battement:hb_vif', 'battement:hb_mort', 'battement:hb_course'];
        try {
          const T = Date.now();
          const avant = (ms) => new Date(T - ms).toISOString();
          const apres = (ms) => new Date(T + ms).toISOString();
          const moi = repo.deviceId();
          const base = (id, over) => ({ id, kind: 'recette', recipe_id: null, edition_id: null, scan_session_id: null, page_ids: [], photo_sha256: null, erreur: null, resultat: null, reponse_brute: null, appels: 1, model: null, duree_ms: null, device_id: moi, document_id_vol: 'doc-x', battement_at: avant(120000), started_at: avant(130000), finished_at: null, created_at: avant(140000), updated_at: avant(120000), status: 'en_cours', ...over });
          const ailleurs = { device_id: 'dev-autre' };
          await db.mutate({ puts: { imports: [
            base('hb_vif'), base('hb_mort'), base('hb_course'),
            base('ail_sans_2', { ...ailleurs, battement_at: null, started_at: avant(2 * 60000) }), base('ail_sans_11', { ...ailleurs, battement_at: null, started_at: avant(11 * 60000) }),
            base('ail_futur_1h', { ...ailleurs, battement_at: apres(3600000), started_at: apres(3600000) }), base('ail_futur_an', { ...ailleurs, battement_at: apres(365 * 24 * 3600000), started_at: apres(365 * 24 * 3600000) }),
            base('ici_futur_1h', { battement_at: apres(3600000), started_at: apres(3600000) }), base('ici_futur_5min', { battement_at: apres(5 * 60000) }),
          ], sync_state: [{ key: cles[0], status: 'vol', value: avant(10000) }, { key: cles[1], status: 'vol', value: avant(120000) }, { key: cles[2], status: 'vol', value: avant(5000) }] }, origin: 'device' });
          // La course entre deux onglets, sur le battement INTERNE : la passe le LIT vieux pour hb_course, l'autre onglet l'a rafraîchi (−5 s) dans la base.
          const lireFiche = db.get.bind(db);
          db.get = async (s, k) => (s === 'sync_state' && k === cles[2] ? { ...(await lireFiche(s, k)), value: avant(120000) } : lireFiche(s, k));
          let n1; try { n1 = await repo.marquerInterrompus(T); } finally { db.get = lireFiche; }
          const st = async (id) => (await db.get('imports', id))?.status;
          eq([await st('hb_vif'), await st('hb_mort'), await st('hb_course'), await db.get('sync_state', cles[1]), (await db.get('sync_state', cles[0]))?.value, (await db.get('sync_state', cles[2]))?.value],
            ['en_cours', 'echec', 'en_cours', undefined, avant(10000), avant(5000)], 'démarrage (vague finale) : battement de la ligne vieux mais battement INTERNE frais → intact ; les deux vieux → interrompu, battement interne effacé avec lui ; battement interne lu vieux puis rafraîchi par un autre onglet → intact (relu DANS la transaction)');
          eq([await st('ail_sans_2'), await st('ail_sans_11')], ['en_cours', 'echec'], 'démarrage (vague finale, m16) : une ligne d’un autre appareil SANS battement lisible se juge sur started_at — −2 min : intacte ; −11 min : interrompue');
          eq([await st('ail_futur_1h'), await st('ail_futur_an'), await st('ici_futur_1h'), await st('ici_futur_5min'), n1], ['echec', 'echec', 'echec', 'en_cours', 5], 'démarrage (vague finale, m11) : un battement daté de +1 h ou +1 an (horloge avancée, ligne hostile) ne prouve aucun vol vivant — ici comme ailleurs ; +5 min (horloge un peu reculée) garde son vol');
          // Le décalage serveur (getClockOffset) : cet appareil avance de 5 min ; une ligne d'ailleurs vieille de 12 min à SON heure en a 7 à l'heure du serveur.
          await db.mutate({ puts: { imports: [base('ail_decale', { ...ailleurs, battement_at: avant(12 * 60000), started_at: avant(12 * 60000) }), base('ail_decale16', { ...ailleurs, battement_at: avant(16 * 60000), started_at: avant(16 * 60000) })] }, origin: 'device' });
          setClockOffset(-5 * 60000);
          let n2; try { n2 = await repo.marquerInterrompus(T); } finally { setClockOffset(0); }
          eq([await st('ail_decale'), await st('ail_decale16'), n2], ['en_cours', 'echec', 1], 'démarrage (vague finale, m11) : les lignes d’un autre appareil se comparent à l’heure du SERVEUR — un Mac en avance de 5 min n’interrompt pas un vol de 7 min ; 11 min à l’heure du serveur → interrompue');
        } finally { setClockOffset(0); await db.mutate({ clearStores: ['imports'], deletes: { sync_state: cles }, origin: 'device' }); }
      });

      // --- 3. Page Ajouter (spec § 4.5) : la section, ses lignes et ses gestes câblés ; « Reprendre » sur a_verifier → l'écran ciblé, revalidé.
      await bloc('page Ajouter : section « Imports »', async () => {
        const monterAdd = async (query = {}, deps = {}) => { const root = await A.renderAdd({}, query, await ctxDe(), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: interdit, maintenant: () => NOW, ...deps }); scene.append(root); return root; };
        const sectionDe = (root) => root.querySelector('[data-role="imports"]');
        const ligneDe = (root, id) => root.querySelector(`[data-role="ligne-import"][data-id="${CSS.escape(id)}"]`);
        const vide = await monterAdd();
        eq([sectionDe(vide), !!vide.querySelector('.grid.wide')], [null, true], 'Ajouter : sans import ni séance ouverte, aucune section « Imports » ; la grille est là');
        // Les lignes : des imports ciblés à chaque état, posés par le chemin réel (repo.ajouterPages), puis leurs statuts ; une séance libre.
        const ouvrir = async (recipeId, n, statut, over = {}) => {
          const { importId } = await repo.ajouterPages(await images(n, recipeId), { edition_id: 'ed6', import: { id: 'imp_' + recipeId, kind: 'recette', recipe_id: recipeId } });
          if (statut !== 'a_lancer') await db.put('imports', { ...(await db.get('imports', importId)), status: statut, ...over });
          return importId;
        };
        const impA = await ouvrir('rc6a', 1, 'a_lancer');
        const impB = await ouvrir('rc6b', 2, 'echec', { erreur: { raison: 'incertain', extra: {} }, appels: 1 });
        const impC = await ouvrir('rc6c', 1, 'a_verifier', { resultat: { ...RECETTE, title: 'Tarte rc6c' }, model: 'claude-x' });
        const impD = await ouvrir('rc6d', 1, 'a_verifier', { resultat: { ...RECETTE, title: 'HOSTILE-' + 'x'.repeat(201) } });
        const impE = await ouvrir('rc6e', 1, 'en_cours', { document_id_vol: 'doc-ailleurs', battement_at: new Date().toISOString() });
        const impF = await ouvrir('rc6f', 1, 'echec', { erreur: { raison: 'serveur', extra: {} }, appels: 1 });
        const { session: libre } = await repo.ajouterPages(await images(1, 'libre'), { edition_id: 'ed6' });
        const root = await monterAdd();
        const sec = sectionDe(root); const grille = root.querySelector('.grid.wide');
        ok(!!sec && !!grille && !!(sec.compareDocumentPosition(grille) & Node.DOCUMENT_POSITION_FOLLOWING), 'Ajouter : la section « Imports » est rendue AVANT la grille');
        eq([sec?.querySelector('h2')?.textContent, [...sec.querySelectorAll('[data-role="ligne-import"]')].map((n) => n.dataset.id).sort()], ['Imports', [impA, impB, impC, impD, impE, impF, libre.id].sort()], 'Ajouter : un titre « Imports », une ligne par import ouvert et par séance libre (les séances des imports ciblés n’y sont pas)');
        const lA = ligneDe(root, impA);
        ok(lA.textContent.includes('Tarte rc6a') && lA.textContent.includes('1 photo ajoutée') && /il y a \d+ (min|h|j)/.test(lA.textContent), 'Ajouter : la ligne d’un import a_lancer dit le titre de la référence, ses photos et son âge');
        eq(boutons(lA), ['Reprendre', 'Ignorer'], 'Ajouter : a_lancer → « Reprendre » et « Ignorer »');
        ok([...lA.querySelectorAll('button')].every((b) => b.classList.contains('btn') && !b.classList.contains('small')), 'Ajouter : les gestes sont des .btn (≥ 44 px), pas des .btn.small');
        const lB = ligneDe(root, impB);
        ok(lB.textContent.includes('L’appel a peut-être été compté ; relancer en coûtera un autre.'), 'Ajouter : echec(incertain) → la phrase I-4');
        eq(boutons(lB), ['Relancer', 'Ignorer'], 'Ajouter : echec → « Relancer » et « Ignorer »');
        ok(ligneDe(root, impC).textContent.includes('Lecture reçue le'), 'Ajouter : a_verifier → « Lecture reçue le … »');
        eq([ligneDe(root, impE).textContent.includes('En cours sur un autre écran'), boutons(ligneDe(root, impE))], [true, []], 'Ajouter : un vol tenu ailleurs → « En cours sur un autre écran », ni « Annuler » ni « Ignorer »');
        const lS = ligneDe(root, libre.id);
        eq([lS.textContent.includes('Photos conservées : 1 page(s)'), lS.textContent.includes('Livre six'), boutons(lS)], [true, true, ['Ouvrir la séance']], 'Ajouter : une séance libre → « Photos conservées : 1 page(s) · Livre six » et « Ouvrir la séance »');
        bouton(lA, 'Reprendre').click();
        bouton(lS, 'Ouvrir la séance').click();
        eq([...navs], [`/recipes/rc6a/importer?import=${impA}`, `/import?session=${libre.id}`], 'Ajouter : « Reprendre » navigue vers la cible (écran ciblé sur SA ligne, ?import= — vague finale, m4 ; photos en place) ; « Ouvrir la séance » vers la séance');
        const r2 = await monterAdd({ section: 'imports' });
        await tick();
        eq([document.activeElement === sectionDe(r2), sectionDe(r2)?.getAttribute('tabindex'), !!(sectionDe(r2)?.compareDocumentPosition(r2.querySelector('.grid.wide')) & Node.DOCUMENT_POSITION_FOLLOWING)], [true, '-1', true], 'Ajouter : ?section=imports → la section reçoit le focus (tabindex -1), toujours avant la grille');
        // « Ignorer » → ignore ; la séance de cet import ciblé revient comme « Photos conservées » (spec § 4.1).
        const sessA = (await db.get('imports', impA)).scan_session_id;
        bouton(ligneDe(root, impA), 'Ignorer').click();
        await attendre(async () => (await db.get('imports', impA)).status === 'ignore' && !ligneDe(root, impA) && !!ligneDe(root, sessA), 'ignoré et séance revenue');
        eq([(await db.get('imports', impA)).status, typeof (await db.get('imports', impA)).finished_at, !!ligneDe(root, sessA), reseau], ['ignore', 'string', true, 0], 'Ajouter : « Ignorer » → ignore (finished_at posé), la ligne disparaît, la séance de cet import ciblé revient en « Photos conservées »');
        // « Relancer » → UN POST par lancerExtraction ; aucune page ni séance en double ; « Annuler » pendant le vol (ce document le tient) ; puis « Reprendre ».
        const compter = async () => [await db.count('source_pages'), await db.count('scan_sessions'), await db.count('source_documents'), await db.count('imports')];
        const avant = await compter();
        const ff = fauxFetch();
        const rR = await monterAdd({}, { fetch: ff.fetch, battementMs: 20, maintenant: () => new Date().toISOString() });
        const enFile = async (id) => (await db.getAll('outbox')).filter((e) => e.store === 'imports' && e.id === id).length;
        bouton(ligneDe(rR, impB), 'Relancer').click();
        await attendre(() => ff.appels.length === 1 && !!bouton(ligneDe(rR, impB), 'Annuler'), 'POST parti, « Annuler » offert');
        const enVol = await db.get('imports', impB);
        const corps = JSON.parse(ff.appels[0].options.body);
        eq([enVol.status, enVol.document_id_vol, enVol.appels, corps.outil, corps.corps.max_tokens, corps.corps.messages[0].content.filter((c) => c.type === 'image').length, ff.appels[0].options.headers.authorization, boutons(ligneDe(rR, impB))], ['en_cours', UI.DOCUMENT_ID, 2, 'extraction', 6000, 2, 'Bearer ' + JETON, ['Annuler']], 'Relancer : en_cours tenu par CE document, appels 1 → 2, UN POST (deux pages dans l’ordre), la section offre « Annuler » seul pendant le vol');
        // Le battement (§ 3.1, m2 ; vague finale) : hors de la ligne synchronisée — une ligne interne de sync_state ; la ligne imports intacte, rien en file.
        const n0 = await enFile(impB);
        await attendre(async () => (await db.get('sync_state', 'battement:' + impB))?.status === 'vol', 'battement écrit');
        eq([await db.get('imports', impB), await enFile(impB)], [enVol, n0], 'battement : la ligne imports reste identique (ni battement_at ni updated_at réécrits), aucune entrée d’outbox');
        ff.rendre[0](200, corpsOk({ ...RECETTE, title: 'Tarte rc6b' }));
        await attendre(async () => (await db.get('imports', impB)).status === 'a_verifier' && !!bouton(ligneDe(rR, impB), 'Reprendre'), 'lecture reçue, Reprendre offert');
        eq([ff.appels.length, await compter(), (await db.get('imports', impB)).resultat?.title, boutons(ligneDe(rR, impB)), (await db.byIndex('recipe_versions', 'recipe_id', 'rc6b')).length], [1, avant, 'Tarte rc6b', ['Reprendre', 'Ignorer'], 0], 'Relancer : UN seul POST, aucune page, séance, document ni import en double ; la ligne passe a_verifier (écart T4 : la discordance et l’enregistrement vivent dans l’écran) → « Reprendre »');
        const ff2 = fauxFetch();
        const rA = await monterAdd({}, { fetch: ff2.fetch });
        bouton(ligneDe(rA, impF), 'Relancer').click();
        await attendre(() => ff2.appels.length === 1 && !!bouton(ligneDe(rA, impF), 'Annuler'), 'deuxième vol');
        bouton(ligneDe(rA, impF), 'Annuler').click();
        await attendre(async () => (await db.get('imports', impF)).status === 'echec' && !!bouton(ligneDe(rA, impF), 'Relancer'), 'annulé');
        eq([ff2.appels[0].options.signal.aborted, (await db.get('imports', impF)).erreur?.raison, ligneDe(rA, impF).textContent.includes('Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.'), boutons(ligneDe(rA, impF)), UI.volEnCours()], [true, 'annule', true, ['Relancer', 'Ignorer'], null], 'Annuler (section) : le fetch est abandonné, echec(annule), la phrase I-4, « Relancer » revient');
        // « Reprendre » sur a_verifier → l'écran ciblé en mode « Enregistrer cette lecture » ; résultat REVALIDÉ ; enregistrement sans appel.
        bouton(ligneDe(rR, impC), 'Reprendre').click();
        eq(navs.at(-1), `/recipes/rc6c/importer?import=${impC}`, 'Reprendre (a_verifier) : vers l’écran ciblé, sur sa ligne');
        const ecran = await UI.renderImportCible({ id: 'rc6c' }, {}, await ctxDe(), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: interdit, maintenant: () => NOW });
        scene.append(ecran);
        eq([!!bouton(ecran, 'Enregistrer cette lecture'), bouton(ecran, 'Extraire et enregistrer')], [true, null], 'Reprendre (a_verifier) : l’écran s’ouvre en mode « Enregistrer cette lecture »');
        bouton(ecran, 'Enregistrer cette lecture').click();
        await attendre(() => navs.some((n) => n.startsWith('/recipes/rc6c?v=')), 'enregistrée');
        eq([(await db.get('imports', impC)).status, (await db.get('recipes', 'rc6c')).availability, (await db.byIndex('recipe_versions', 'recipe_id', 'rc6c')).length, reseau], ['enregistre', 'available', 1, 0], 'Reprendre (a_verifier) : enregistrée SANS appel (aucun réseau)');
        bouton(ligneDe(root, impD), 'Reprendre').click();
        const hostile = await UI.renderImportCible({ id: 'rc6d' }, {}, await ctxDe(), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: interdit, maintenant: () => NOW });
        scene.append(hostile);
        eq([(await db.get('imports', impD)).status, (await db.get('imports', impD)).erreur?.raison, (await db.get('imports', impD)).resultat, bouton(hostile, 'Enregistrer cette lecture'), hostile.textContent.includes('HOSTILE-'), reseau], ['echec', 'illisible', null, null, false, 0], 'Reprendre (a_verifier) : un resultat hostile injecté (titre de 201 points de code) → echec(illisible), rien à l’écran, aucun appel');
      });

      // --- 3 bis. Page Ajouter, ronde 1 : les autres sortes et l'autre appareil câblés à la PAGE, les textes exacts des lignes, « Ignorer » lié à la lecture
      // AFFICHÉE (T4-R2), « Relancer » d'un index depuis la section, la passe interrompu à l'affichage, une référence reçue pendant que la page est montée.
      await bloc('page Ajouter : sortes, autre appareil, textes, Ignorer, interrompu (ronde 1)', async () => {
        await db.mutate({ clearStores: ['imports'], origin: 'device' });
        const moi = repo.deviceId();
        const ilYa = (ms) => new Date(Date.parse(NOW) - ms).toISOString(); // l'âge affiché part de maintenant() = NOW
        const reel = (ms) => new Date(Date.now() - ms).toISOString(); // le battement se compare à l'horloge de l'appareil
        const { importId: impX } = await repo.ajouterPages(await images(2, 'idx'), { edition_id: 'ed6', import: { id: 'imp_idx', kind: 'index' } });
        await db.put('imports', { ...(await db.get('imports', impX)), status: 'echec', erreur: { raison: 'serveur', extra: {} }, appels: 1, updated_at: ilYa(3 * 3600000) });
        const { importId: impG } = await repo.ajouterPages(await images(1, 'grp'), { edition_id: 'ed6', import: { id: 'imp_grp', kind: 'recette' } });
        await db.put('imports', { ...(await db.get('imports', impG)), status: 'a_verifier', resultat: { ...RECETTE, title: 'Lecture R1' }, started_at: reel(60000), model: 'claude-x', updated_at: ilYa(2 * 60000) });
        const brut = (id, over) => ({ id, kind: 'recette', recipe_id: null, edition_id: 'ed6', scan_session_id: null, page_ids: ['pg_ailleurs'], photo_sha256: null, status: 'a_lancer', erreur: null, resultat: null, reponse_brute: null, appels: 0, model: null, duree_ms: null, device_id: moi, document_id_vol: null, battement_at: null, started_at: null, finished_at: null, created_at: ilYa(60000), updated_at: ilYa(60000), ...over });
        await db.mutate({ puts: { imports: [
          brut('imp_absente', { recipe_id: 'rc6z', status: 'a_verifier', resultat: { ...RECETTE } }),
          brut('imp_aut_echec', { recipe_id: 'rc6g', device_id: 'dev-iphone', status: 'echec', erreur: { raison: 'serveur', extra: {} } }),
          brut('imp_aut_lancer', { device_id: 'dev-iphone' }),
          brut('imp_mort_ici', { status: 'en_cours', document_id_vol: 'doc-ferme', battement_at: reel(120000), started_at: reel(130000) }),
        ] }, origin: 'device' });
        const ff = fauxFetch();
        const root = await A.renderAdd({}, {}, await ctxDe(), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: ff.fetch, maintenant: () => NOW });
        scene.append(root);
        const ligne = (id) => root.querySelector(`[data-role="ligne-import"][data-id="${CSS.escape(id)}"]`);
        const titre = (id) => ligne(id)?.querySelector('strong')?.textContent ?? null;
        const age = (id) => ligne(id)?.querySelector('.row.between > span.muted')?.textContent ?? null;
        // La passe interrompu tourne aussi à l'affichage de la section (plus d'attente du prochain démarrage) : la ligne morte de CET appareil passe echec.
        await attendre(async () => (await db.get('imports', 'imp_mort_ici')).status === 'echec' && (boutons(ligne('imp_mort_ici')) || []).includes('Relancer'), 'interrompu à l’affichage');
        eq([(await db.get('imports', 'imp_mort_ici')).erreur, ligne('imp_mort_ici').textContent.includes('La lecture a été interrompue. L’appel a peut-être été compté ; relancer en coûtera un autre.')], [{ raison: 'interrompu', extra: {} }, true], 'Ajouter (ronde 1) : une ligne en_cours de CET appareil au battement mort passe interrompu dès l’affichage de la section, avec la phrase I-4');
        eq([titre(impX), titre(impG), titre('imp_absente'), age(impX), age(impG)], ['Index · Livre six', 'Recette à regrouper · Livre six', '(référence pas encore reçue)', 'il y a 3 h', 'il y a 2 min'], 'Ajouter (ronde 1) : titres exacts par sorte (« Index · {livre} », « Recette à regrouper · {livre} », référence pas encore reçue) et âge réel de la ligne');
        eq([boutons(ligne(impX)), boutons(ligne(impG)), boutons(ligne('imp_absente'))], [['Relancer', 'Ignorer'], ['Reprendre', 'Ignorer'], []], 'Ajouter (ronde 1) : un index en échec → Relancer, Ignorer ; une recette à regrouper lue → Reprendre, Ignorer ; une référence pas encore reçue → aucun geste');
        eq([boutons(ligne('imp_aut_echec')), boutons(ligne('imp_aut_lancer')), ligne('imp_aut_echec').textContent.includes('Photos sur un autre appareil'), ligne('imp_aut_lancer').textContent.includes('Photos sur un autre appareil'), ligne(impX).textContent.includes('Photos sur un autre appareil')], [['Ignorer'], ['Ignorer'], true, true, false], 'Ajouter (ronde 1) : une ligne d’un AUTRE appareil (echec, a_lancer) → « Ignorer » seul et « Photos sur un autre appareil » (câblage deviceId de la page) ; rien de tel pour une ligne d’ici');
        bouton(ligne(impG), 'Reprendre').click();
        eq(navs.at(-1), '/recipes/new?import=imp_grp', 'Ajouter (ronde 1) : « Reprendre » d’une recette à regrouper → l’éditeur par ?import=');
        // « Ignorer » vaut pour la lecture AFFICHÉE (T4-R2) : un autre onglet a relancé la ligne et reçu R2 sans que la page se redessine → rien n'est ignoré.
        await db.put('imports', { ...(await db.get('imports', impG)), started_at: reel(1000), resultat: { ...RECETTE, title: 'Lecture R2' } }); // sans bus : la ligne affichée est encore R1
        const avantIgnorer = ligne(impG);
        bouton(avantIgnorer, 'Ignorer').click();
        await attendre(() => !!ligne(impG) && ligne(impG) !== avantIgnorer, 'redessin après le refus');
        eq([(await db.get('imports', impG)).status, (await db.get('imports', impG)).resultat?.title], ['a_verifier', 'Lecture R2'], 'Ignorer (ronde 1, T4-R2) : la ligne a reçu une AUTRE lecture depuis l’affichage → rien n’est ignoré (R2, jamais vue, reste à reprendre)');
        bouton(ligne(impG), 'Ignorer').click();
        await attendre(async () => (await db.get('imports', impG)).status === 'ignore', 'ignorée après redessin');
        // « Relancer » d'un index depuis la section : extraireIndex, le résultat { entries, uncertain } ; le vol tenu ICI dit « Lecture des pages… ».
        bouton(ligne(impX), 'Relancer').click();
        await attendre(() => ff.appels.length === 1 && !!bouton(ligne(impX), 'Annuler'), 'vol d’index parti');
        const corps = JSON.parse(ff.appels[0].options.body);
        eq([ligne(impX).textContent.includes('Lecture des pages par l’assistant…'), ligne(impX).textContent.includes('En cours sur un autre écran'), corps.corps.system.startsWith('Tu lis la table des matières'), corps.corps.messages[0].content.filter((c) => c.type === 'image').length], [true, false, true, 2], 'Relancer (index, section) : le vol tenu ICI dit « Lecture des pages par l’assistant… », jamais « En cours sur un autre écran » ; la consigne de l’index, ses deux pages');
        ff.rendre[0](200, corpsOk({ entries: [{ title: 'Tarte fine', printed_page: 12 }], uncertain: ['p. 41 ?'] }));
        await attendre(async () => (await db.get('imports', impX)).status === 'a_verifier' && !!bouton(ligne(impX), 'Reprendre'), 'index relu');
        eq([(await db.get('imports', impX)).resultat, boutons(ligne(impX))], [{ entries: [{ title: 'Tarte fine', printed_page: 12, section: null, ingredients_mentioned: [] }], uncertain: ['p. 41 ?'] }, ['Reprendre', 'Ignorer']], 'Relancer (index, section) : le journal reçoit { entries, uncertain } (jamais une recette) ; « Reprendre » mène ensuite au panneau');
        // Une référence reçue pendant que la page est montée (synchro) : la ligne prend son titre et ses gestes au redessin, sans navigation.
        await repo.save('recipes', fiche('rc6z'));
        await attendre(() => titre('imp_absente') === 'Tarte rc6z', 'référence reçue');
        eq(boutons(ligne('imp_absente')), ['Reprendre', 'Ignorer'], 'Ajouter (ronde 1) : une référence reçue pendant que la page est montée → titre et gestes au redessin (les recettes sont relues, pas figées au rendu)');
        // La passe finie AVANT le montage de la page (le bus ignore une page pas encore montée) : le redessin suit la passe elle-même.
        await db.put('imports', brut('imp_mort_tot', { status: 'en_cours', document_id_vol: 'doc-ferme', battement_at: reel(120000), started_at: reel(130000) }));
        const tot = await A.renderAdd({}, {}, await ctxDe(), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: ff.fetch, maintenant: () => NOW });
        await attendre(async () => (await db.get('imports', 'imp_mort_tot')).status === 'echec', 'passe finie avant le montage');
        await attendre(() => (boutons(tot.querySelector('[data-role="ligne-import"][data-id="imp_mort_tot"]')) || []).includes('Relancer'), 'redessin après la passe');
        scene.append(tot);
        eq(boutons(tot.querySelector('[data-role="ligne-import"][data-id="imp_mort_tot"]')), ['Relancer', 'Ignorer'], 'Ajouter (ronde 1) : une passe interrompu finie avant le montage redessine quand même la section (Relancer, Ignorer)');
      });

      // --- 4. Fiche du livre (spec § 4.5) et séances filtrées (« Séances à reprendre », § 4.1).
      await bloc('page Ajouter : la passe interrompu rejouée après BATTEMENT_MORT_MS (vague finale, m1)', async () => {
        const recent = new Date(Date.now() - 10000).toISOString();
        await db.put('imports', { id: 'imp_veille', kind: 'recette', recipe_id: null, edition_id: 'ed6', scan_session_id: null, page_ids: ['pg_veille'], photo_sha256: null, status: 'en_cours', erreur: null, resultat: null, reponse_brute: null, appels: 1, model: null, duree_ms: null, device_id: repo.deviceId(), document_id_vol: 'doc-ferme', battement_at: recent, started_at: recent, finished_at: null, created_at: recent, updated_at: recent });
        try {
          const root = await A.renderAdd({}, {}, await ctxDe(), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: interdit, maintenant: () => NOW, veilleMs: 300 });
          scene.append(root);
          await tick();
          eq((await db.get('imports', 'imp_veille')).status, 'en_cours', 'Ajouter (vague finale, m1) : un battement de 10 s à l’affichage → la ligne attend');
          await db.put('imports', { ...(await db.get('imports', 'imp_veille')), battement_at: new Date(Date.now() - 120000).toISOString() }); // le document est mort depuis
          await attendre(async () => (await db.get('imports', 'imp_veille')).status === 'echec' && (boutons(root.querySelector('[data-role="ligne-import"][data-id="imp_veille"]')) || []).includes('Relancer'), 'levée par la seconde passe');
          eq((await db.get('imports', 'imp_veille')).erreur, { raison: 'interrompu', extra: {} }, 'Ajouter (vague finale, m1) : la passe est rejouée une fois encore après BATTEMENT_MORT_MS si la page est montée — la ligne d’un document mort juste avant l’affichage est levée sans quitter la page (« Relancer »)');
        } finally { await db.put('imports', { ...(await db.get('imports', 'imp_veille')), status: 'ignore' }); }
      });

      await bloc('fiche du livre : imports à reprendre ; séances filtrées', async () => {
        const ed7 = { id: 'ed7', book_id: 'b7' }, b7 = { id: 'b7', title: 'Livre sept' };
        const ctxB = (imports, scan_sessions = []) => ({ editionsById: new Map([['ed7', ed7]]), booksById: new Map([['b7', b7]]), books: [b7], recipes: [], recipe_versions: [], source_documents: [], source_pages: [], rediscovery_prefs: [], book_editions: [ed7], docsByRecipe: new Map(), scan_sessions, imports, settings: {}, pagesById: new Map(), recipesById: new Map(), editionLabel: (e) => (e?.id === 'ed7' ? 'Livre sept' : '') });
        const imp = (id, over = {}) => ({ id, kind: 'recette', recipe_id: null, edition_id: 'ed7', scan_session_id: null, page_ids: [], status: 'a_lancer', ...over });
        const liens = (r) => [...r.querySelectorAll('a')].filter((a) => a.getAttribute('href') === '#/add?section=imports').map((a) => a.textContent);
        eq(liens(await B.renderBook({ id: 'ed7' }, {}, ctxB([imp('k1'), imp('k2', { status: 'echec' }), imp('k3', { status: 'enregistre' }), imp('k4', { edition_id: 'autre' }), imp('k5', { status: 'ignore' })]))), ['2 imports à reprendre'], 'fiche du livre : « 2 imports à reprendre » → #/add?section=imports (les imports ouverts de CE livre seulement)');
        eq([liens(await B.renderBook({ id: 'ed7' }, {}, ctxB([imp('k1', { kind: 'index', status: 'a_verifier' })]))), liens(await B.renderBook({ id: 'ed7' }, {}, ctxB([])))], [['1 import à reprendre'], []], 'fiche du livre : « 1 import à reprendre » au singulier ; rien sans import ouvert');
        const s = (id, started_at) => ({ id, status: 'open', edition_id: 'ed7', page_ids: ['p'], started_at });
        const cible = imp('kc', { recipe_id: 'r7', scan_session_id: 's_cible' });
        const seances = [s('s_libre', '2026-10-01T00:00:00.000Z'), s('s_cible', '2026-10-02T00:00:00.000Z')];
        eq([B.seancesOuvertes(ctxB([cible], seances), 'ed7').map((x) => x.id), B.seancesOuvertes(ctxB([{ ...cible, status: 'ignore' }], seances), 'ed7').map((x) => x.id)], [['s_libre'], ['s_cible', 's_libre']], 'seancesOuvertes : la séance d’un import ciblé non terminé est filtrée, de retour après ignore');
        const hrefs = (r) => [...r.querySelectorAll('a.item-link')].map((a) => a.getAttribute('href'));
        eq([hrefs(await I.renderImport({}, {}, ctxB([cible], seances))), hrefs(await I.renderImport({}, {}, ctxB([{ ...cible, status: 'ignore' }], seances)))], [['#/import?session=s_libre'], ['#/import?session=s_cible', '#/import?session=s_libre']], '« Séances à reprendre » (import.js) : filtrée de même, de retour après ignore');
      });

      // --- 5. Éditeur (spec § 4.6) : « Extraire avec l'assistant IA » écrit dans le journal (kind recette, recipe_id null) ; ?import= relit.
      await bloc('éditeur : journal et ?import=', async () => {
        const { session: ssE, pages: [pe1, pe2] } = await repo.ajouterPages(await images(2, 'edit'), { edition_id: 'ed6' });
        const LU = { title: 'Gratin dauphinois', servings: 4, prep_minutes: 15, cook_minutes: 60, ingredients: [{ source_text: '1 kg de pommes de terre', uncertain: false }, { source_text: '500 ml de crème', uncertain: true }], steps: [{ text: 'Trancher.' }, { text: 'Cuire 1 h.' }], printed_page: 77, sub_recipes: [], uncertain_fields: ['crème'], notes: null, incomplete: false, missing_page: false };
        const ff = fauxFetch(); globalThis.fetch = ff.fetch;
        const avantImports = new Set((await db.getAll('imports')).map((i) => i.id));
        const neuve = async () => (await db.getAll('imports')).find((i) => !avantImports.has(i.id)) || null;
        const edit = await R.renderRecipeEdit({ id: null }, { pages: `${pe1.id},${pe2.id}`, edition: 'ed6', session: ssE.id }, await ctxDe());
        scene.append(edit);
        const b = bouton(edit, 'Extraire avec l’assistant IA');
        eq([b?.disabled, await neuve()], [false, null], 'éditeur : avec des pages et une session, le bouton est allumé ; rien n’est écrit avant le clic');
        b.click(); b.click();
        eq(b.disabled, true, 'éditeur : le bouton s’éteint dès le clic (verrou)');
        await attendre(() => ff.appels.length === 1, 'POST parti');
        const enVol = await neuve();
        eq([enVol?.kind, enVol?.recipe_id, enVol?.scan_session_id, enVol?.page_ids, enVol?.edition_id, enVol?.status, enVol?.document_id_vol, b.disabled], ['recette', null, ssE.id, [pe1.id, pe2.id], 'ed6', 'en_cours', UI.DOCUMENT_ID, true], 'éditeur : le clic crée imports{kind recette, recipe_id null} sur ces pages, dans cette séance, puis le vol (en_cours tenu par ce document) ; bouton éteint pendant l’appel');
        eq([(await db.getAll('imports')).filter((i) => !avantImports.has(i.id)).length, ff.appels.length], [1, 1], 'éditeur (ronde 1) : le double clic n’ouvre qu’UNE ligne du journal (aucune orpheline a_lancer) et ne fait qu’un POST');
        eq([ff.appels[0].options.signal instanceof AbortSignal, JSON.parse(ff.appels[0].options.body).corps.max_tokens], [true, 6000], 'éditeur : l’appel porte un signal (Annuler depuis la section) et max_tokens 6000');
        ff.rendre[0](200, corpsOk(LU));
        await attendre(async () => (await db.get('imports', enVol.id)).status === 'a_verifier' && !b.disabled, 'lecture reçue');
        const titre = champ(edit, 'Titre original *')?.querySelector('input'); const ings = champ(edit, 'Ingrédients (une ligne par ingrédient, texte tel qu’imprimé)')?.querySelector('textarea'); const etapes = champ(edit, 'Étapes')?.querySelector('textarea');
        eq([(await db.get('imports', enVol.id)).resultat?.title, titre?.value, ings?.value, etapes?.value, champ(edit, 'Portions')?.querySelector('input')?.value, ff.appels.length], ['Gratin dauphinois', 'Gratin dauphinois', '1 kg de pommes de terre\n500 ml de crème', 'Trancher.\nCuire 1 h.', '4', 1], 'éditeur : la lecture est écrite dans le journal (a_verifier, resultat) AVANT de remplir le formulaire (titre, ingrédients, étapes, portions) ; UN POST');
        ok(edit.textContent.includes('Extraction proposée par l’assistant — toutes les lignes sont à vérifier.'), 'éditeur : « Extraction proposée par l’assistant — toutes les lignes sont à vérifier. »');
        // Ronde 1 : un second « Extraire » REPREND la même ligne (aucune ligne neuve), sur les pages de l'éditeur, et la remet en vol ; un second POST.
        b.click();
        await attendre(() => ff.appels.length === 2, 'second POST');
        const reprise = await db.get('imports', enVol.id);
        eq([(await db.getAll('imports')).filter((i) => !avantImports.has(i.id)).length, reprise.status, reprise.page_ids, reprise.resultat, JSON.parse(ff.appels[1].options.body).corps.messages[0].content.filter((c) => c.type === 'image').length], [1, 'en_cours', [pe1.id, pe2.id], null, 2], 'éditeur (ronde 1) : un second « Extraire » reprend la MÊME ligne (en_cours, résultat effacé au départ du vol), sur les pages de l’éditeur ; un second POST de deux pages');
        ff.rendre[1](200, corpsOk(LU));
        await attendre(async () => (await db.get('imports', enVol.id)).status === 'a_verifier' && !b.disabled, 'seconde lecture reçue');
        // ?import= : un nouvel éditeur relit la ligne et préremplit, SANS POST (pages, livre et séance viennent de la ligne).
        const edit2 = await R.renderRecipeEdit({ id: null }, { import: enVol.id }, await ctxDe());
        scene.append(edit2);
        eq([champ(edit2, 'Titre original *')?.querySelector('input')?.value, champ(edit2, 'Ingrédients (une ligne par ingrédient, texte tel qu’imprimé)')?.querySelector('textarea')?.value, champ(edit2, 'Étapes')?.querySelector('textarea')?.value, edit2.querySelectorAll('img.page-view').length, ff.appels.length, reseau], ['Gratin dauphinois', '1 kg de pommes de terre\n500 ml de crème', 'Trancher.\nCuire 1 h.', 2, 2, 0], '#/recipes/new?import=<imp> : titre, ingrédients et étapes préremplis depuis le résultat, les deux pages de la ligne, sans POST');
        // L'enregistrement ferme la lecture : enregistre, dans la MÊME transaction que la recette.
        const vus = []; const capture = db.onMutate; db.onMutate = (m) => { vus.push(Object.keys(m.puts).sort()); return capture ? capture(m) : {}; };
        try {
          bouton(edit2, 'Enregistrer la recette').click();
          await attendre(async () => (await db.get('imports', enVol.id)).status === 'enregistre', 'enregistrée');
        } finally { db.onMutate = capture; history.replaceState(null, '', adresseAvant); }
        const rec = (await db.getAll('recipes')).find((r) => r.original_title === 'Gratin dauphinois');
        const ver = rec ? await db.get('recipe_versions', rec.current_version_id) : null;
        eq([!!rec, ver?.provenance?.generated_by, ver?.provenance?.model, ver?.provenance?.import_id, (await db.get('imports', enVol.id)).reponse_brute, typeof (await db.get('imports', enVol.id)).finished_at, vus[0], (await db.get('scan_sessions', ssE.id)).recipe_ids.includes(rec?.id)], [true, 'ai', 'claude-x', enVol.id, null, 'string', ['imports', 'recipe_versions', 'recipes', 'scan_sessions', 'source_pages'], true], 'éditeur : « Enregistrer la recette » écrit la recette, la séance (recipe_ids) ET passe la lecture à enregistre (reponse_brute null) dans UNE transaction (I-10, ronde 1) ; la version dit l’assistant, le modèle du serveur et la lecture (import_id)');
        // Un résultat hostile relu du journal est REVALIDÉ (I-1) : echec(illisible), rien de prérempli.
        const hostile = await repo.ouvrirImport({ kind: 'recette', edition_id: 'ed6', scan_session_id: ssE.id, page_ids: [pe1.id] });
        await db.put('imports', { ...(await db.get('imports', hostile.id)), status: 'a_verifier', resultat: { ...LU, title: 'HOSTILE-' + 'x'.repeat(201) } });
        const edit3 = await R.renderRecipeEdit({ id: null }, { import: hostile.id }, await ctxDe());
        eq([(await db.get('imports', hostile.id)).status, (await db.get('imports', hostile.id)).erreur?.raison, (await db.get('imports', hostile.id)).resultat, champ(edit3, 'Titre original *')?.querySelector('input')?.value, edit3.textContent.includes('HOSTILE-'), ff.appels.length], ['echec', 'illisible', null, '', false, 2], '?import= : un résultat hostile (titre de 201 points de code) → echec(illisible), resultat effacé, rien de prérempli, aucun appel');

        // --- Ronde 1 (Critical) : un clic REFUSÉ n'écrit rien dans le journal (spec § 4.4 : hors ligne, session absente → « rien ») — ni la remise à a_lancer
        // d'une lecture déjà reçue (et payée), ni une ligne neuve orpheline.
        const ouvrirLue = async (over = {}) => { const l = await repo.ouvrirImport({ kind: 'recette', edition_id: 'ed6', scan_session_id: ssE.id, page_ids: [pe1.id] }); await db.put('imports', { ...(await db.get('imports', l.id)), status: 'a_verifier', resultat: { ...LU, title: 'Gratin payé', printed_page: 90 }, started_at: NOW, model: 'claude-x', ...over }); return db.get('imports', l.id); };
        const postsAvant = ff.appels.length;
        const payee = await ouvrirLue();
        const nImports = await db.count('imports');
        const edit4 = await R.renderRecipeEdit({ id: null }, { import: payee.id }, await ctxDe());
        scene.append(edit4);
        const editNeuf = await R.renderRecipeEdit({ id: null }, { pages: pe2.id, edition: 'ed6', session: ssE.id }, await ctxDe());
        scene.append(editNeuf);
        eq(champ(edit4, 'Titre original *')?.querySelector('input')?.value, 'Gratin payé', 'éditeur ?import= : la lecture reçue est posée dans le formulaire');
        window.dispatchEvent(new Event('offline'));
        try {
          bouton(edit4, 'Extraire avec l’assistant IA').click();
          await attendre(() => edit4.textContent.includes('Tu es hors ligne.') && !bouton(edit4, 'Extraire avec l’assistant IA').disabled, 'refus hors ligne (reprise)');
          bouton(editNeuf, 'Extraire avec l’assistant IA').click();
          await attendre(() => editNeuf.textContent.includes('Tu es hors ligne.') && !bouton(editNeuf, 'Extraire avec l’assistant IA').disabled, 'refus hors ligne (neuve)');
        } finally { window.dispatchEvent(new Event('online')); }
        eq([await db.get('imports', payee.id), await db.count('imports'), ff.appels.length - postsAvant], [payee, nImports, 0], 'éditeur (ronde 1, Critical) : hors ligne, « Extraire » ne touche PAS le journal — la lecture reçue reste a_verifier avec son résultat, aucune ligne a_lancer orpheline, aucun POST');
        // Octets absents (une lecture reçue d'un AUTRE appareil : les octets des pages sont L4) : même règle, rien n'est écrit.
        await db.put('source_pages', { id: 'pg_sans_octets', edition_id: 'ed6', sha256: 'f'.repeat(64), position: 1, kind: null, printed_page: null, issues: [] });
        const venue = await ouvrirLue({ page_ids: ['pg_sans_octets'], device_id: 'dev-iphone', resultat: { ...LU, title: 'Venue d’ailleurs', printed_page: 95 } });
        const edit5 = await R.renderRecipeEdit({ id: null }, { import: venue.id }, await ctxDe());
        scene.append(edit5);
        bouton(edit5, 'Extraire avec l’assistant IA').click();
        await attendre(() => edit5.textContent.includes('Les photos de cette recette ne sont pas sur cet appareil.'), 'refus octets absents');
        eq([await db.get('imports', venue.id), await db.count('imports'), ff.appels.length - postsAvant], [venue, nImports + 1, 0], 'éditeur (ronde 1, Critical) : octets absents → la lecture reçue d’un autre appareil reste intacte, aucune ligne neuve, aucun POST');
        // I-2 (ronde 1) : ?import= d'un import CIBLÉ (recipe_id posé) n'est jamais repris par l'éditeur d'une recette NEUVE — rien de prérempli, aucune page,
        // la ligne intacte (« Enregistrer » créerait une seconde fiche).
        await db.put('imports', { ...payee, id: 'imp_cible_edit', recipe_id: 'rc6a', resultat: { ...LU, title: 'Ciblée' } });
        const cibleeAvant = await db.get('imports', 'imp_cible_edit');
        const edit6 = await R.renderRecipeEdit({ id: null }, { import: 'imp_cible_edit' }, await ctxDe());
        eq([champ(edit6, 'Titre original *')?.querySelector('input')?.value, edit6.querySelectorAll('img.page-view').length, await db.get('imports', 'imp_cible_edit')], ['', 0, cibleeAvant], '?import= d’un import CIBLÉ : rien de prérempli, aucune page reprise, la ligne intacte (I-2)');
        // La phrase d'un échec (I-4, § 4.4) est à l'écran d'un ?import= en échec.
        await db.put('imports', { ...payee, id: 'imp_echec_edit', status: 'echec', erreur: { raison: 'coupe', extra: {} }, resultat: null });
        const edit7 = await R.renderRecipeEdit({ id: null }, { import: 'imp_echec_edit' }, await ctxDe());
        ok(edit7.textContent.includes('La lecture a été coupée : essaie avec moins de pages.'), '?import= d’une lecture en échec : la phrase de l’échec est à l’écran');
        // Le modèle relu est borné (81 points de code → null) ; « page possiblement manquante » est montrée, et la fiche enregistrée reste partial au plus,
        // avec import_id et le drapeau dans la provenance (I-1 : montré, jamais comblé).
        const longue = await ouvrirLue({ model: 'm'.repeat(81), resultat: { ...LU, title: 'Gratin long', printed_page: 91, missing_page: true } });
        const edit8 = await R.renderRecipeEdit({ id: null }, { import: longue.id }, await ctxDe());
        scene.append(edit8);
        ok(edit8.textContent.includes('page possiblement manquante'), '?import= (ronde 1) : « page possiblement manquante » est montrée avec la lecture');
        try {
          bouton(edit8, 'Enregistrer la recette').click();
          await attendre(async () => (await db.get('imports', longue.id)).status === 'enregistre', 'lecture longue enregistrée');
        } finally { history.replaceState(null, '', adresseAvant); }
        const recL = (await db.getAll('recipes')).find((r) => r.original_title === 'Gratin long');
        const verL = recL ? await db.get('recipe_versions', recL.current_version_id) : null;
        eq([verL?.provenance?.model, verL?.provenance?.import_id, verL?.provenance?.missing_page, verL?.provenance?.incomplete, recL?.availability], [null, longue.id, true, false, 'partial'], 'Enregistrer (ronde 1) : modèle de 81 points de code → null ; import_id et missing_page portés par la version ; la fiche reste partial (jamais comblée)');
        // T4-R2 (ronde 1) : « Enregistrer » ne clôt QUE la lecture posée dans le formulaire. Un autre onglet a relancé la ligne et reçu R2 entre-temps : la
        // recette relue (R1) est enregistrée, R2 reste à reprendre (jamais close sans avoir été vue).
        const r1 = await ouvrirLue({ resultat: { ...LU, title: 'Lecture R1', printed_page: 92 } });
        const edit9 = await R.renderRecipeEdit({ id: null }, { import: r1.id }, await ctxDe());
        scene.append(edit9);
        await db.put('imports', { ...(await db.get('imports', r1.id)), started_at: new Date().toISOString(), resultat: { ...LU, title: 'Lecture R2', printed_page: 93 } });
        try {
          bouton(edit9, 'Enregistrer la recette').click();
          await attendre(async () => (await db.getAll('recipes')).some((r) => r.original_title === 'Lecture R1'), 'R1 enregistrée');
          await tick(); await tick();
        } finally { history.replaceState(null, '', adresseAvant); }
        eq([(await db.get('imports', r1.id)).status, (await db.get('imports', r1.id)).resultat?.title], ['a_verifier', 'Lecture R2'], 'Enregistrer (ronde 1, T4-R2) : la ligne a reçu une autre lecture (R2) depuis le formulaire → R2 n’est pas close, elle reste à reprendre');
        // Clôture refusée (décision 4, ronde 1) : la ligne est ignorée par un autre onglet ENTRE la lecture de l'éditeur et sa transaction → rien n'est écrit
        // (ni recette, ni séance), la phrase est dite ; le second « Enregistrer » écrit sans la ligne, qui reste ignorée.
        const course = await ouvrirLue({ resultat: { ...LU, title: 'Course', printed_page: 94 } });
        const edit10 = await R.renderRecipeEdit({ id: null }, { import: course.id }, await ctxDe());
        scene.append(edit10);
        await db.put('imports', { ...(await db.get('imports', course.id)), status: 'ignore' });
        const lireFiche = db.get.bind(db);
        db.get = async (s, k) => (s === 'imports' && k === course.id ? { ...(await lireFiche(s, k)), status: 'a_verifier' } : lireFiche(s, k)); // la lecture périmée de l'éditeur
        const toastEl = () => document.querySelector('.toast');
        if (toastEl()) toastEl().textContent = '';
        const seanceAvant = await db.get('scan_sessions', ssE.id);
        try {
          bouton(edit10, 'Enregistrer la recette').click();
          await attendre(() => toastEl()?.textContent === 'La recette n’a pas pu être enregistrée. Réessaie.', 'clôture refusée dite');
        } finally { db.get = lireFiche; }
        eq([(await db.getAll('recipes')).some((r) => r.original_title === 'Course'), (await db.get('imports', course.id)).status, (await db.get('scan_sessions', ssE.id)).recipe_ids], [false, 'ignore', seanceAvant.recipe_ids], 'Enregistrer (ronde 1) : clôture refusée → aucune recette, aucune séance écrite, la ligne reste ignorée, la phrase est dite');
        try {
          bouton(edit10, 'Enregistrer la recette').click();
          await attendre(async () => (await db.getAll('recipes')).some((r) => r.original_title === 'Course'), 'second Enregistrer');
        } finally { history.replaceState(null, '', adresseAvant); }
        eq((await db.get('imports', course.id)).status, 'ignore', 'Enregistrer (ronde 1) : le second clic écrit la recette SANS la ligne, qui reste ignorée');
        // La revalidation (I-1) ne marque illisible QUE la lecture relue (T4-R2, ronde 1) : une lecture valide R2 arrivée entre la lecture hostile et la
        // transaction n'est jamais effacée.
        const valide = await ouvrirLue({ resultat: { ...LU, title: 'Valide R2', printed_page: 96 } });
        db.get = async (s, k) => (s === 'imports' && k === valide.id ? { ...(await lireFiche(s, k)), started_at: '2026-01-01T00:00:00.000Z', resultat: { ...LU, title: 'HOSTILE-' + 'x'.repeat(201) } } : lireFiche(s, k)); // la lecture hostile, périmée
        let edit11;
        try { edit11 = await R.renderRecipeEdit({ id: null }, { import: valide.id }, await ctxDe()); } finally { db.get = lireFiche; }
        eq([(await db.get('imports', valide.id)).status, (await db.get('imports', valide.id)).resultat?.title, edit11.textContent.includes('HOSTILE-')], ['a_verifier', 'Valide R2', false], '?import= (ronde 1, T4-R2) : la revalidation d’une lecture hostile ne marque pas illisible une lecture valide arrivée entre-temps (conditionnée à la lecture relue) ; rien d’hostile à l’écran');
        // Vague finale (Important) : une lecture dont une étape tient sur plusieurs lignes (§ 3.4 : gardée entière dans un seul text) bascule l'éditeur en
        // « une étape par paragraphe » — même nombre d'étapes enregistrées que lues (et que l'écran ciblé, I5).
        const multi = await ouvrirLue({ resultat: { ...LU, title: 'Gratin en deux temps', printed_page: 98, steps: [{ text: 'Pâte :\nMélanger farine et beurre.' }, { text: 'Cuire 20 min.' }] } });
        const edit12 = await R.renderRecipeEdit({ id: null }, { import: multi.id }, await ctxDe());
        scene.append(edit12);
        const ch12 = champ(edit12, 'Étapes'); const ta12 = ch12?.querySelector('textarea');
        eq([ta12?.value, ta12?.placeholder, ch12?.querySelector('small')?.textContent, edit12.textContent.includes('2 étape(s)')], ['Pâte :\nMélanger farine et beurre.\n\nCuire 20 min.', 'Une étape par paragraphe (ligne vide entre deux étapes).', 'Une étape par paragraphe (ligne vide entre deux étapes).', true], '?import= (vague finale, Important) : une étape lue sur deux lignes → zone jointe par une ligne vide, aide et placeholder « par paragraphe », l’aperçu compte 2 étapes');
        try {
          bouton(edit12, 'Enregistrer la recette').click();
          await attendre(async () => (await db.get('imports', multi.id)).status === 'enregistre', 'lecture multi-lignes enregistrée');
        } finally { history.replaceState(null, '', adresseAvant); }
        const rec12 = (await db.getAll('recipes')).find((r) => r.original_title === 'Gratin en deux temps');
        eq((await db.get('recipe_versions', rec12?.current_version_id))?.steps?.map((s) => s.text), ['Pâte :\nMélanger farine et beurre.', 'Cuire 20 min.'], 'Enregistrer (vague finale, Important) : 2 étapes enregistrées pour 2 lues (l’étape multi-ligne reste entière), comme l’écran ciblé');
        // Vague finale (Important) : « lecture incomplète » (incomplete vrai, page présente) d'une lecture reprise par ?import= est portée par la version, la
        // fiche reste partial au plus, et le bandeau la dit (banniereLecture).
        const K = await import('../src/ui/components.js');
        const incomplete = await ouvrirLue({ resultat: { ...LU, title: 'Gratin incomplet', printed_page: 99, incomplete: true, missing_page: false } });
        const edit13 = await R.renderRecipeEdit({ id: null }, { import: incomplete.id }, await ctxDe());
        scene.append(edit13);
        ok(edit13.textContent.includes('lecture incomplète'), '?import= (vague finale) : « lecture incomplète » est montrée avec la lecture');
        try {
          bouton(edit13, 'Enregistrer la recette').click();
          await attendre(async () => (await db.get('imports', incomplete.id)).status === 'enregistre', 'lecture incomplète enregistrée');
        } finally { history.replaceState(null, '', adresseAvant); }
        const rec13 = (await db.getAll('recipes')).find((r) => r.original_title === 'Gratin incomplet');
        const ver13 = rec13 ? await db.get('recipe_versions', rec13.current_version_id) : null;
        eq([ver13?.provenance?.incomplete, ver13?.provenance?.missing_page, rec13?.availability, K.banniereLecture(ver13)?.incomplete], [true, false, 'partial', true], 'Enregistrer (vague finale, Important) : incomplete porté par la version, la fiche reste partial (jamais comblée, I-1), le bandeau dit « lecture incomplète »');
        // Vague finale (m20) : la garde « sans référence » est relue DANS la transaction de reprise — une ligne CIBLÉE (recipe_id posé), passée à
        // lireDansLeJournal sans aucune pré-lecture, n'est jamais reprise comme une lecture « à regrouper » : une ligne neuve s'ouvre, la ciblée reste intacte.
        await db.put('imports', { ...payee, id: 'imp_cible_tx', recipe_id: 'rc6g', resultat: { ...LU, title: 'Ciblée tx' } });
        const cibleeTx = await db.get('imports', 'imp_cible_tx');
        const avantTx = new Set((await db.getAll('imports')).map((i) => i.id));
        const ffTx = fauxFetch([200, corpsOk(LU)]); globalThis.fetch = ffTx.fetch;
        const luTx = await UI.lireDansLeJournal({ kind: 'recette', importId: 'imp_cible_tx', pageIds: [pe1.id], editionId: 'ed6', sessionId: ssE.id, ctx: await ctxDe(), repo });
        globalThis.fetch = ff.fetch;
        const neuvesTx = (await db.getAll('imports')).filter((i) => !avantTx.has(i.id));
        eq([await db.get('imports', 'imp_cible_tx'), neuvesTx.length, luTx.importId === neuvesTx[0]?.id, neuvesTx[0]?.recipe_id, neuvesTx[0]?.status, ffTx.appels.length], [cibleeTx, 1, true, null, 'a_verifier', 1], 'lireDansLeJournal (vague finale, m20) : une ligne CIBLÉE n’est jamais reprise par la transaction de départ (garde relue en transaction) — une ligne neuve sans référence s’ouvre et vole, la ciblée reste intacte');
      });

      // --- 6. Panneau d'index (spec § 4.6) : journal kind index, bouton verrouillé (double clic → un POST), ?import= relit.
      await bloc('panneau d’index : journal, verrou et ?import=', async () => {
        const { session: ssI, pages: [pi1, pi2] } = await repo.ajouterPages(await images(2, 'index'), { edition_id: 'ed6' });
        let sel = [pi1.id]; // la sélection de pages du panneau (changée pour la seconde lecture, ronde 1)
        const INDEX = { entries: [{ title: 'Tarte fine', printed_page: 12 }, { title: 'Gratin', printed_page: 40 }], uncertain: ['p. 41 ?'] };
        const ff = fauxFetch(); globalThis.fetch = ff.fetch;
        const avantImports = new Set((await db.getAll('imports')).map((i) => i.id));
        const neuve = async () => (await db.getAll('imports')).find((i) => !avantImports.has(i.id)) || null;
        const panneau = I.indexEntriesPanel(ssI, await ctxDe(), () => sel);
        scene.append(panneau);
        const lire = () => bouton(panneau, 'Lire avec l’assistant IA');
        await attendre(() => !lire().disabled, 'session lue');
        lire().click(); lire().click();
        await attendre(() => ff.appels.length >= 1, 'POST parti');
        await tick(); await tick();
        const enVol = await neuve();
        const corps = JSON.parse(ff.appels[0].options.body);
        eq([ff.appels.length, lire().disabled, enVol?.kind, enVol?.recipe_id, enVol?.scan_session_id, enVol?.page_ids, enVol?.edition_id, enVol?.status, corps.corps.system.startsWith('Tu lis la table des matières')], [1, true, 'index', null, ssI.id, [pi1.id], 'ed6', 'en_cours', true], 'panneau d’index : double clic → UN POST (consigne de l’index) ; imports{kind index} sur la page choisie, dans la séance ; bouton verrouillé pendant l’appel');
        eq((await db.getAll('imports')).filter((i) => !avantImports.has(i.id)).length, 1, 'panneau d’index (ronde 1) : le double clic n’ouvre qu’UNE ligne du journal (aucune orpheline a_lancer)');
        ff.rendre[0](200, corpsOk(INDEX));
        await attendre(async () => (await db.get('imports', enVol.id)).status === 'a_verifier' && !lire().disabled, 'index reçu');
        ok(panneau.textContent.includes('Incertain : p. 41 ?'), 'panneau d’index (ronde 1) : les incertitudes de la lecture sont dites (« Incertain : … »)');
        // Ronde 1 : une seconde lecture, sur une sélection CHANGÉE, reprend la MÊME ligne (aucune ligne neuve) avec les nouvelles pages — c'est elles que
        // le vol lit et envoie.
        sel = [pi1.id, pi2.id];
        lire().click();
        await attendre(() => ff.appels.length === 2, 'second POST');
        const relance = await db.get('imports', enVol.id);
        eq([(await db.getAll('imports')).filter((i) => !avantImports.has(i.id)).length, relance.status, relance.page_ids, JSON.parse(ff.appels[1].options.body).corps.messages[0].content.filter((c) => c.type === 'image').length], [1, 'en_cours', [pi1.id, pi2.id], 2], 'panneau d’index (ronde 1) : une seconde lecture sur une autre sélection reprend la MÊME ligne, ses page_ids remises, et le POST porte les deux pages choisies');
        ff.rendre[1](200, corpsOk(INDEX));
        await attendre(async () => (await db.get('imports', enVol.id)).status === 'a_verifier' && !lire().disabled, 'second index reçu');
        const ta = panneau.querySelector('textarea');
        eq([(await db.get('imports', enVol.id)).resultat, ta.value, panneau.textContent.includes('2 entrée(s) proposée(s) par l’assistant')], [{ entries: [{ title: 'Tarte fine', printed_page: 12, section: null, ingredients_mentioned: [] }, { title: 'Gratin', printed_page: 40, section: null, ingredients_mentioned: [] }], uncertain: ['p. 41 ?'] }, 'Tarte fine — 12\nGratin — 40', true], 'panneau d’index : le résultat { entries, uncertain } est écrit dans le journal (a_verifier) PUIS rempli dans la zone');
        // ?import= : la séance s'ouvre sur le panneau prérempli, ses pages cochées, SANS POST.
        const vue = await I.renderImport({}, { session: ssI.id, import: enVol.id }, await ctxDe());
        scene.append(vue);
        const p2 = vue.querySelector('textarea')?.closest('.card');
        await attendre(() => vue.querySelector('textarea')?.value === 'Tarte fine — 12\nGratin — 40', 'panneau prérempli');
        eq([p2?.hidden, [...vue.querySelectorAll('.thumbs input[type="checkbox"]')].map((c) => c.checked), ff.appels.length, reseau], [false, [true, true], 2, 0], '#/import?session=…&import=<imp> : le panneau d’index est ouvert, prérempli, la page de la lecture cochée, sans POST');
        // « Créer les références » ferme la lecture : enregistre, avec les références et la page d'index, dans UNE transaction.
        bouton(vue, 'Créer les références').click();
        await attendre(async () => (await db.get('imports', enVol.id)).status === 'enregistre', 'références créées');
        const refs = (await db.getAll('recipes')).filter((r) => r.edition_id === 'ed6' && ['Tarte fine', 'Gratin'].includes(r.original_title));
        eq([refs.map((r) => [r.original_title, r.printed_page, r.availability]).sort(), (await db.get('source_pages', pi1.id)).kind, (await db.get('imports', enVol.id)).reponse_brute], [[['Gratin', 40, 'reference_only'], ['Tarte fine', 12, 'reference_only']], 'index', null], 'panneau d’index : « Créer les références » crée les références, marque la page d’index et passe la lecture à enregistre');
        // Un index hostile relu du journal est revalidé : echec(illisible), rien de prérempli.
        const hostile = await repo.ouvrirImport({ kind: 'index', edition_id: 'ed6', scan_session_id: ssI.id, page_ids: [pi1.id] });
        await db.put('imports', { ...(await db.get('imports', hostile.id)), status: 'a_verifier', resultat: { entries: [{ title: 'HOSTILE-' + 'x'.repeat(201), printed_page: 1 }], uncertain: [] } });
        const p3 = I.indexEntriesPanel(ssI, await ctxDe(), () => [pi1.id], { importId: hostile.id });
        await attendre(async () => (await db.get('imports', hostile.id)).status === 'echec', 'revalidé');
        eq([(await db.get('imports', hostile.id)).erreur?.raison, (await db.get('imports', hostile.id)).resultat, p3.querySelector('textarea').value, p3.textContent.includes('HOSTILE-'), ff.appels.length], ['illisible', null, '', false, 2], 'panneau d’index ?import= : un index hostile (titre de 201 points de code) → echec(illisible), rien de prérempli, aucun appel');

        // --- Ronde 1 (Critical) : un clic refusé n'écrit rien. Hors ligne sur une lecture reçue → intacte ; session disparue au clic → aucune ligne neuve.
        const ouvrirIndexLu = async (over = {}) => { const l = await repo.ouvrirImport({ kind: 'index', edition_id: 'ed6', scan_session_id: ssI.id, page_ids: [pi1.id] }); await db.put('imports', { ...(await db.get('imports', l.id)), status: 'a_verifier', resultat: { entries: [{ title: 'Payée', printed_page: 3, section: null, ingredients_mentioned: [] }], uncertain: [] }, started_at: NOW, ...over }); return db.get('imports', l.id); };
        const postsAvant = ff.appels.length;
        const lu = await ouvrirIndexLu();
        const nI = await db.count('imports');
        const pLu = I.indexEntriesPanel(ssI, await ctxDe(), () => [pi1.id], { importId: lu.id });
        scene.append(pLu);
        const lireLu = () => bouton(pLu, 'Lire avec l’assistant IA');
        await attendre(() => pLu.querySelector('textarea').value === 'Payée — 3' && !lireLu().disabled, 'lecture reçue posée');
        window.dispatchEvent(new Event('offline'));
        try { lireLu().click(); await attendre(() => pLu.textContent.includes('Tu es hors ligne.') && !lireLu().disabled, 'refus hors ligne'); }
        finally { window.dispatchEvent(new Event('online')); }
        eq([await db.get('imports', lu.id), await db.count('imports'), ff.appels.length - postsAvant], [lu, nI, 0], 'panneau d’index (ronde 1, Critical) : hors ligne, « Lire » ne touche pas la lecture reçue (ni a_lancer, ni résultat effacé), aucune ligne neuve, aucun POST');
        const jetons = [SESSION, null]; let nj = 0;
        const ctxPerdue = { ...(await ctxDe()), sync: { user: { id: 'u1', email: 'a@exemple.invalid' }, auth: { jeton: async () => jetons[Math.min(nj++, 1)] } } };
        const pPerdue = I.indexEntriesPanel(ssI, ctxPerdue, () => [pi1.id]);
        scene.append(pPerdue);
        await attendre(() => !bouton(pPerdue, 'Lire avec l’assistant IA').disabled, 'session lue');
        bouton(pPerdue, 'Lire avec l’assistant IA').click();
        await attendre(() => pPerdue.querySelector('[data-role="connexion-ia"]')?.hidden === false, 'carte « Connecte-toi »');
        eq([await db.count('imports'), ff.appels.length - postsAvant], [nI, 0], 'panneau d’index (ronde 1, Critical) : la session disparaît au clic → aucune ligne a_lancer créée (journal : rien), aucun POST');
        // T4-R2 (ronde 1) : « Créer les références » ne clôt QUE la lecture posée dans la zone ; R2 reçue entre-temps (autre onglet) reste à reprendre.
        await db.put('imports', { ...(await db.get('imports', lu.id)), started_at: new Date().toISOString(), resultat: { entries: [{ title: 'R2', printed_page: 4, section: null, ingredients_mentioned: [] }], uncertain: [] } });
        bouton(pLu, 'Créer les références').click();
        await attendre(async () => (await db.getAll('recipes')).some((r) => r.original_title === 'Payée'), 'références créées');
        await tick(); await tick();
        eq([(await db.get('imports', lu.id)).status, (await db.get('imports', lu.id)).resultat?.entries?.[0]?.title], ['a_verifier', 'R2'], 'Créer les références (ronde 1, T4-R2) : la ligne a reçu une autre lecture (R2) → R2 n’est pas close, elle reste à reprendre');
        // Clôture refusée (décision 4, ronde 1) : la lecture est ignorée par un autre onglet ENTRE la lecture du panneau et sa transaction → aucune référence,
        // la phrase est dite ; le second « Créer les références » écrit sans la ligne, qui reste ignorée.
        const ignoree = await ouvrirIndexLu({ resultat: { entries: [{ title: 'Ignorée ailleurs', printed_page: 5, section: null, ingredients_mentioned: [] }], uncertain: [] } });
        const pIgn = I.indexEntriesPanel(ssI, await ctxDe(), () => [pi1.id], { importId: ignoree.id });
        scene.append(pIgn);
        await attendre(() => pIgn.querySelector('textarea').value === 'Ignorée ailleurs — 5', 'lecture posée (course)');
        await db.put('imports', { ...(await db.get('imports', ignoree.id)), status: 'ignore' });
        const lireFicheP = db.get.bind(db);
        db.get = async (s, k) => (s === 'imports' && k === ignoree.id ? { ...(await lireFicheP(s, k)), status: 'a_verifier' } : lireFicheP(s, k)); // la lecture périmée du panneau
        const toastP = () => document.querySelector('.toast');
        if (toastP()) toastP().textContent = '';
        try {
          bouton(pIgn, 'Créer les références').click();
          await attendre(() => toastP()?.textContent === 'Les références n’ont pas pu être créées. Réessaie.', 'clôture refusée dite (panneau)');
        } finally { db.get = lireFicheP; }
        eq([(await db.getAll('recipes')).some((r) => r.original_title === 'Ignorée ailleurs'), (await db.get('imports', ignoree.id)).status], [false, 'ignore'], 'Créer les références (ronde 1) : clôture refusée → aucune référence écrite, la ligne reste ignorée, la phrase est dite');
        bouton(pIgn, 'Créer les références').click();
        await attendre(async () => (await db.getAll('recipes')).some((r) => r.original_title === 'Ignorée ailleurs'), 'second Créer les références');
        eq((await db.get('imports', ignoree.id)).status, 'ignore', 'Créer les références (ronde 1) : le second clic écrit les références SANS la ligne, qui reste ignorée');
        // ?import= (ronde 1) : le panneau ne se rouvre que sur une lecture d'index OUVERTE de CETTE séance.
        const { session: ssAutre } = await repo.ajouterPages(await images(1, 'autre'), { edition_id: 'ed6' });
        const autre = await repo.ouvrirImport({ kind: 'index', edition_id: 'ed6', scan_session_id: ssAutre.id, page_ids: [] });
        const vueAutre = await I.renderImport({}, { session: ssI.id, import: autre.id }, await ctxDe());
        const vueClose = await I.renderImport({}, { session: ssI.id, import: enVol.id }, await ctxDe()); // enVol est close (enregistre) par « Créer les références »
        eq([vueAutre.querySelector('textarea')?.closest('.card')?.hidden, vueClose.querySelector('textarea')?.closest('.card')?.hidden], [true, true], '?import= (ronde 1) : une lecture d’une AUTRE séance, ou une lecture déjà close, ne rouvre pas le panneau d’index');
        // Une ligne d'une autre sorte (recette) n'est ni posée, ni revalidée comme un index (rien d'écrit).
        const recetteLue = await repo.ouvrirImport({ kind: 'recette', edition_id: 'ed6', scan_session_id: ssI.id, page_ids: [pi1.id] });
        await db.put('imports', { ...(await db.get('imports', recetteLue.id)), status: 'a_verifier', resultat: { ...RECETTE } });
        const recAvant = await db.get('imports', recetteLue.id);
        const pSorte = I.indexEntriesPanel(ssI, await ctxDe(), () => [pi1.id], { importId: recetteLue.id });
        await new Promise((r) => setTimeout(r, 100)); // rien ne doit arriver : on laisse à une relecture le temps d'écrire
        eq([pSorte.querySelector('textarea').value, await db.get('imports', recetteLue.id)], ['', recAvant], 'panneau d’index (ronde 1) : une ligne d’une autre sorte n’est ni posée ni revalidée comme un index (la ligne reste intacte)');
        // La phrase d'un échec (I-4) est dite sur un ?import= en échec.
        const enEchec = await repo.ouvrirImport({ kind: 'index', edition_id: 'ed6', scan_session_id: ssI.id, page_ids: [pi1.id] });
        await db.put('imports', { ...(await db.get('imports', enEchec.id)), status: 'echec', erreur: { raison: 'coupe', extra: {} } });
        const pEchec = I.indexEntriesPanel(ssI, await ctxDe(), () => [pi1.id], { importId: enEchec.id });
        await attendre(() => pEchec.textContent.includes('La lecture a été coupée : essaie avec moins de pages.'), 'phrase de l’échec');
        ok(pEchec.textContent.includes('La lecture a été coupée : essaie avec moins de pages.'), 'panneau d’index ?import= d’une lecture en échec : la phrase de l’échec est dite');
        // I-7 (ronde 1) : un vol tenu par ce document — un autre « Lire » n'ouvre aucune ligne ; « Extraire » d'une recette EXISTANTE (Corriger, hors
        // journal) ne part pas non plus : un seul POST en vol par document.
        const ffT = fauxFetch(); globalThis.fetch = ffT.fetch;
        const pVol = I.indexEntriesPanel(ssI, await ctxDe(), () => [pi1.id]);
        scene.append(pVol);
        await attendre(() => !bouton(pVol, 'Lire avec l’assistant IA').disabled, 'session lue (vol)');
        bouton(pVol, 'Lire avec l’assistant IA').click();
        await attendre(() => ffT.appels.length === 1, 'vol tenu');
        const nVol = await db.count('imports');
        const pSecond = I.indexEntriesPanel(ssI, await ctxDe(), () => [pi1.id]);
        scene.append(pSecond);
        await attendre(() => !bouton(pSecond, 'Lire avec l’assistant IA').disabled, 'session lue (second)');
        bouton(pSecond, 'Lire avec l’assistant IA').click();
        await attendre(() => pSecond.textContent.includes('Une lecture est déjà en cours : annule-la d’abord.'), 'vol tenu dit');
        const corriger = await R.renderRecipeEdit({ id: 'rc6b' }, { pages: pi1.id }, await ctxDe());
        scene.append(corriger);
        bouton(corriger, 'Extraire avec l’assistant IA').click();
        await attendre(() => corriger.textContent.includes('Une lecture est déjà en cours : annule-la d’abord.'), 'Corriger refusé');
        eq([await db.count('imports'), ffT.appels.length], [nVol, 1], 'vol tenu (ronde 1) : un second « Lire » n’ouvre aucune ligne ; « Extraire » de Corriger ne part pas (un seul POST en vol par document)');
        ffT.rendre[0](200, corpsOk(INDEX));
        await attendre(() => !UI.volEnCours() && !bouton(pVol, 'Lire avec l’assistant IA').disabled, 'vol fini');
        // Vague finale (m13) : I-7 dans l'AUTRE sens — une relecture de « Corriger » (hors journal) en vol TIENT le vol du document (sans ligne) : aucun vol
        // du journal ne part de ce document tant qu'elle court ; elle le libère à sa fin.
        const ffC = fauxFetch(); globalThis.fetch = ffC.fetch;
        const corriger2 = await R.renderRecipeEdit({ id: 'rc6b' }, { pages: pi1.id }, await ctxDe());
        scene.append(corriger2);
        bouton(corriger2, 'Extraire avec l’assistant IA').click();
        await attendre(() => ffC.appels.length === 1, 'relecture de Corriger en vol');
        const nAvantC = await db.count('imports');
        const pBloque = I.indexEntriesPanel(ssI, await ctxDe(), () => [pi1.id]);
        scene.append(pBloque);
        await attendre(() => !bouton(pBloque, 'Lire avec l’assistant IA').disabled, 'session lue (Corriger en vol)');
        bouton(pBloque, 'Lire avec l’assistant IA').click();
        await attendre(() => pBloque.textContent.includes('Une lecture est déjà en cours : annule-la d’abord.'), 'vol de Corriger vu');
        eq([UI.volEnCours(), ffC.appels.length, await db.count('imports')], [{ importId: null }, 1, nAvantC], 'Corriger en vol (vague finale, m13) : le vol du document est tenu (sans ligne) — « Lire » du panneau d’index est refusé, aucune ligne ouverte, aucun second POST');
        ffC.rendre[0](200, corpsOk(RECETTE));
        await attendre(() => UI.volEnCours() === null && corriger2.textContent.includes('Extraction proposée par l’assistant'), 'relecture reçue, vol libéré');
        globalThis.fetch = ff.fetch;
      });
    } finally {
      UI.reinitialiserImportCible?.();
      globalThis.fetch = vraiFetch; scene.remove(); setUiLocale(localeAvant); if (location.href !== adresseAvant) history.replaceState(null, '', adresseAvant);
    }
  }));

  // =====================================================================================================================================
  // Lot B « Recette web complète », tâche 6 (spec docs/superpowers/specs/2026-10-19-recette-web-design.md § 4.7, § 7.4 « Imports » et
  // « Régression ») : une lecture web dans la section « Imports » d'Ajouter — titre « {texte} — Lien web · {hôte} », « Réessayer » (le geste
  // relancer) offert AUSSI pour une ligne d'un autre appareil, jamais « Photos sur un autre appareil » —, sa reprise (#/recipes/<id>/importer),
  // le démarrage (interrompu, purge à 30 jours) et la fiche du livre (D-B17 : un import web n'y compte pas). Base jetable, fetch injectée, aucun
  // réseau réel, jamais le routeur de l'app (navigations injectées).
  await run('lot B — lectures web dans la section Imports (tâche 6)', () => withRepo(async (repo, db) => {
    const D = await import('../src/domain/import-cible.js');
    const A = await import('../src/ui/add.js');
    const B = await import('../src/ui/book.js');
    const S = await import('../src/ui/signet.js');
    const V = await import('../src/ui/vol.js');
    const LW = await import('../src/domain/lecture-web.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale(); setUiLocale('fr'); // des textes français sont affirmés
    const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(scene);
    const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
    const bouton = (root, nom) => (root ? [...root.querySelectorAll('button')].find((b) => b.textContent === nom) || null : null);
    const boutons = (root) => (root ? [...root.querySelectorAll('button')].map((b) => b.textContent) : null);
    const NOW = '2026-10-19T12:00:00.000Z';
    const JETON = 'jeton-b6-sentinelle';
    const SESSION = { access_token: JETON, user: { id: 'u1', email: 'a@exemple.invalid' } };
    const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(corps) });
    // La fausse fetch : elle HONORE le signal et se résout à la main (a.rendre[i]).
    const fauxFetch = () => {
      const a = { appels: [], rendre: [] };
      a.fetch = (url, options) => new Promise((resolve, reject) => {
        a.appels.push({ url, options });
        const abandon = () => reject(Object.assign(new Error('abandon'), { name: 'AbortError' }));
        if (options?.signal?.aborted) { abandon(); return; }
        options?.signal?.addEventListener('abort', abandon, { once: true });
        a.rendre.push((status, corps) => { options?.signal?.removeEventListener('abort', abandon); resolve(reponse(status, corps)); });
      });
      return a;
    };
    let reseau = 0;
    const interdit = async () => { reseau += 1; throw new Error('aucun appel attendu'); };
    const PAGE = { url_finale: 'https://c.test/tarte', hote: 'c.test', titre_page: 'Tarte', auteur: null, site: null, lue_le: NOW, autres_recettes: 0, texte_coupe: false };
    const LUE = { source_kind: 'jsonld', page: PAGE, recette: { title: 'Tarte lue', ingredients: [{ source_text: '3 pommes' }], steps: [{ text: 'Cuire.' }] }, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: null, model: null };
    const ed8 = { id: 'ed8', book_id: 'b8', language: 'fr', updated_at: DATE }, b8 = { id: 'b8', title: 'Livre huit', author: 'A. B.', updated_at: DATE };
    // Des signets par le fabricant réel (ui/signet.js), dont un rangé dans un livre ; leurs imports par fabriquerImportWeb (domaine du lot B).
    const signetDe = (adresse, titre, editionId = '') => S.fabriquerSignet(S.signetModel({ adresse, titre, editionId }), { newId: repo.newId, langue: 'fr' });
    const sA = signetDe('https://www.ricardocuisine.com/recettes/puttanesca?utm_source=x', 'Pâtes puttanesca', 'ed8');
    const sB = signetDe('https://b.test/soupe', 'Soupe');
    const sC = signetDe('https://c.test/tarte', 'Tarte');
    const sD = signetDe('https://d.test/gratin', 'Gratin');
    const sE = signetDe('http://e.test/clair', 'Page en clair');
    await db.mutate({ puts: { books: [b8], book_editions: [ed8], recipes: [sA, sB, sC, sD, sE] }, origin: 'device' });
    const moi = repo.deviceId();
    const ligne = (s, over = {}) => ({ ...LW.fabriquerImportWeb({ id: 'imp_' + s.id, signet: s, deviceId: moi }), updated_at: new Date().toISOString(), ...over });
    const ctxDe = async () => {
      const recipes = await db.getAll('recipes');
      return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: [], versionsByRecipe: new Map(), versionsById: new Map(),
        books: [b8], book_editions: [ed8], editionsById: new Map([['ed8', ed8]]), booksById: new Map([['b8', b8]]), library_activity: [],
        imports: await db.getAll('imports'), scan_sessions: await db.getAll('scan_sessions'), source_pages: [], pagesById: new Map(), source_documents: [],
        ingredients: [], ingredientsById: new Map(), settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' }, rediscovery_prefs: [], docsByRecipe: new Map(),
        sync: { user: { id: 'u1', email: 'a@exemple.invalid' }, auth: { jeton: async () => SESSION } }, conventionFor: () => null, editionLabel: (e) => (e?.id === 'ed8' ? 'Livre huit' : '') };
    };
    const navs = [], dits = [];
    const monterAdd = async (deps = {}) => { const root = await A.renderAdd({}, {}, await ctxDe(), { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: interdit, maintenant: () => new Date().toISOString(), ...deps }); scene.append(root); return root; };
    const ligneDe = (root, id) => root.querySelector(`[data-role="ligne-import"][data-id="${CSS.escape(id)}"]`);
    try {
      // --- 1. Domaine PUR (§ 4.7) : une lecture web est listée, avec ses gestes ; la table entière.
      eq(D.KINDS_IMPORT, ['recette', 'index', 'web'], 'lot B : KINDS_IMPORT connaît « web » (« couverture » reste réservée)');
      eq(D.KINDS_PAGES, ['recette', 'index'], 'lot B (P-1) : KINDS_PAGES — les sortes à pages, seules ouvertes par le chemin photo (« web » listée, jamais ouverte par lui)');
      const ICI = 'doc-ici', MOI = 'dev-ici', AUTRE = 'dev-ailleurs';
      const ilYa = (min) => new Date(Date.parse(NOW) - min * 60000).toISOString();
      const SIG = { id: 'rc_w', edition_id: 'ed1', original_title: 'Pâtes puttanesca', source_url: 'https://www.ricardocuisine.com/recettes/123?utm_source=x' };
      const HOSTILE = { id: 'rc_h', edition_id: null, original_title: 'Page hostile', source_url: 'javascript:alert(1)' };
      const LUE_DEJA = { id: 'rc_d', edition_id: null, original_title: 'Pâtes lues', source_url: 'https://www.ricardocuisine.com/recettes/456', availability: 'available' }; // relecture D-B18
      const ctxL = (imports) => ({ imports, scan_sessions: [], recipesById: new Map([[SIG.id, SIG], [HOSTILE.id, HOSTILE], [LUE_DEJA.id, LUE_DEJA]]), editionsById: new Map([['ed1', { id: 'ed1', book_id: 'b1' }]]), booksById: new Map([['b1', { id: 'b1', title: 'Mon livre' }]]) });
      const opts = { maintenant: NOW, documentId: ICI, deviceId: MOI };
      const lw = (id, over = {}) => ({ id, kind: 'web', recipe_id: 'rc_w', edition_id: null, scan_session_id: null, page_ids: [], status: 'a_lancer', erreur: null, resultat: null, device_id: MOI, document_id_vol: null, updated_at: ilYa(5), ...over });
      const un = (l) => { const r = D.lignesImports(ctxL([l]), opts); return r.length === 1 ? r[0] : { rien: r }; };
      const resume = (r) => [r.etat, r.titre?.type, r.gestes, r.ailleurs, r.autreAppareil, r.referenceAbsente, r.raison, r.cible];
      const CIBLE = (id, rc = 'rc_w') => `/recipes/${rc}/importer?import=${id}`; // R-B-20 (VF-6 du lot A) : la reprise d’une lecture web porte LA ligne
      for (const [nom, l, attendu] of [
        ['a_lancer → Reprendre (l’écran de la fiche), Ignorer', lw('w1'), ['a_lancer', 'web', ['reprendre', 'ignorer'], false, false, false, null, CIBLE('w1')]],
        ['en_cours tenu par CE document → Annuler seulement', lw('w2', { status: 'en_cours', document_id_vol: ICI }), ['en_cours', 'web', ['annuler'], false, false, false, null, CIBLE('w2')]],
        ['en_cours tenu par un autre document → « ailleurs », aucun geste', lw('w3', { status: 'en_cours', document_id_vol: 'doc-autre' }), ['en_cours', 'web', [], true, false, false, null, CIBLE('w3')]],
        ['a_verifier avec résultat → Reprendre, Ignorer', lw('w4', { status: 'a_verifier', resultat: LUE }), ['a_verifier', 'web', ['reprendre', 'ignorer'], false, false, false, null, CIBLE('w4')]],
        ['a_verifier SANS résultat → Ignorer seulement (« Reprendre » exige un résultat)', lw('w5', { status: 'a_verifier' }), ['a_verifier', 'web', ['ignorer'], false, false, false, null, CIBLE('w5')]],
        ['echec(inaccessible), sans page (une lecture web n’en porte jamais, P-10) → Relancer (« Réessayer » à l’écran), Ignorer ; la raison est rendue', lw('w6', { status: 'echec', erreur: { raison: 'inaccessible', extra: {} } }), ['echec', 'web', ['relancer', 'ignorer'], false, false, false, 'inaccessible', CIBLE('w6')]],
        ['AUTRE appareil, echec → Relancer QUAND MÊME (aucune photo requise : l’adresse est dans le signet)', lw('x1', { device_id: AUTRE, status: 'echec', erreur: { raison: 'serveur', extra: {} } }), ['echec', 'web', ['relancer', 'ignorer'], false, true, false, 'serveur', CIBLE('x1')]],
        ['AUTRE appareil, a_lancer → Reprendre, Ignorer', lw('x2', { device_id: AUTRE }), ['a_lancer', 'web', ['reprendre', 'ignorer'], false, true, false, null, CIBLE('x2')]],
        ['AUTRE appareil, a_verifier sans résultat → Ignorer seulement', lw('x3', { device_id: AUTRE, status: 'a_verifier' }), ['a_verifier', 'web', ['ignorer'], false, true, false, null, CIBLE('x3')]],
        ['AUTRE appareil, a_verifier avec résultat → Reprendre, Ignorer', lw('x4', { device_id: AUTRE, status: 'a_verifier', resultat: LUE }), ['a_verifier', 'web', ['reprendre', 'ignorer'], false, true, false, null, CIBLE('x4')]],
        ['AUTRE appareil, en_cours → « ailleurs », aucun geste', lw('x5', { device_id: AUTRE, status: 'en_cours', document_id_vol: 'doc-x' }), ['en_cours', 'web', [], true, true, false, null, CIBLE('x5')]],
        ['signet pas encore reçu → referenceAbsente, aucun geste', lw('x6', { recipe_id: 'rc_inconnue' }), ['a_lancer', 'web', [], false, false, true, null, CIBLE('x6', 'rc_inconnue')]],
        ['relecture d’une fiche déjà lue (available), a_verifier avec résultat → Reprendre, Ignorer (P-10 : la règle « available » du lot A ne vaut pas pour le web)', lw('d1', { recipe_id: 'rc_d', status: 'a_verifier', resultat: LUE }), ['a_verifier', 'web', ['reprendre', 'ignorer'], false, false, false, null, CIBLE('d1', 'rc_d')]],
        ['relecture d’une fiche déjà lue (available), echec → Relancer, Ignorer (P-10)', lw('d2', { recipe_id: 'rc_d', status: 'echec', erreur: { raison: 'inaccessible', extra: {} } }), ['echec', 'web', ['relancer', 'ignorer'], false, false, false, 'inaccessible', CIBLE('d2', 'rc_d')]],
        ['SANS recipe_id (forme reçue hostile : synchro, archive), echec → Ignorer seulement : aucun signet à relire, « Réessayer » ne pourrait jamais aboutir (ronde 1)', lw('n1', { recipe_id: null, status: 'echec', erreur: { raison: 'serveur', extra: {} } }), ['echec', 'web', ['ignorer'], false, false, false, 'serveur', null]],
      ]) eq(resume(un(l)), attendu, `lignesImports (lot B) — ${nom}`);
      eq([un(lw('w1')).titre, un(lw('w1')).pages, un(lw('x6', { recipe_id: 'rc_inconnue' })).titre, un(lw('h1', { recipe_id: 'rc_h' })).titre],
        [{ type: 'web', texte: 'Pâtes puttanesca', livre: 'www.ricardocuisine.com' }, 0, { type: 'web', texte: null, livre: null }, { type: 'web', texte: 'Page hostile', livre: null }],
        'lignesImports (lot B) : titre = celui du signet, « livre » = l’hôte RECALCULÉ de son adresse (jamais le livre du signet) ; signet absent → rien ; adresse illisible → hôte nul ; aucune page');
      eq([D.cibleReprise({ id: 'imp&w', kind: 'web', recipe_id: 'rc/w' }), D.cibleReprise({ id: 'imp_w', kind: 'web', recipe_id: null }), D.cibleReprise({ id: 'imp_c', kind: 'couverture', recipe_id: 'rc1' })],
        ['/recipes/rc%2Fw/importer?import=imp%26w', null, null], 'cibleReprise (lot B, R-B-20) : web → l’écran de la fiche avec LA ligne (?import=, comme VF-6 du lot A ; identifiants encodés) ; sans recipe_id → null ; « couverture » (réservée) → null');
      eq(D.lignesImports(ctxL([lw('t1', { status: 'enregistre' }), lw('t2', { status: 'ignore' }), lw('t3', { kind: 'couverture' })]), opts), [], 'lignesImports (lot B) : une lecture web enregistree ou ignorée n’est pas listée ; « couverture » reste réservée');

      let ouvreWeb = null; try { await repo.ouvrirImport({ kind: 'web', recipe_id: sA.id }); } catch (e) { ouvreWeb = e; }
      eq([ouvreWeb?.name, (await db.byIndex('imports', 'recipe_id', sA.id)).length], ['TypeError', 0], 'repo.ouvrirImport({ kind: web }) → TypeError, rien d’écrit : une lecture web naît par demarrerLectureWeb, jamais par le chemin photo (P-1)');
      // Ronde 1 : une ligne web SANS recipe_id (forme reçue : required.imports = [] l'admet) — lancerLecture la refuse « inconnu » AVANT de lire la base
      // (repo.get('recipes', null) levait une DataError non gérée), zéro POST, rien d'écrit.
      const W = await import('../src/ui/import-web.js');
      const lN = ligne(sB, { id: 'imp_sans_signet', recipe_id: null, status: 'echec', erreur: { raison: 'serveur', extra: {} }, appels: 1 });
      await db.mutate({ puts: { imports: [lN] }, origin: 'device' });
      const lNavant = await db.get('imports', lN.id), ffN = fauxFetch();
      let rN; try { rN = await W.lancerLecture(lN.id, { ctx: await ctxDe(), repo, fetch: ffN.fetch, enLigne: () => true }); } catch (e) { rN = { leve: e?.name ?? String(e) }; }
      eq([rN, ffN.appels.length, await db.get('imports', lN.id), V.volEnCours()], [{ issue: 'refuse', raison: 'inconnu' }, 0, lNavant, null], 'lancerLecture (lot B, ronde 1) : une ligne web sans recipe_id → refus « inconnu » sans lever, zéro POST, la ligne intacte, le vol libéré');

      // --- 2. Page Ajouter (§ 4.7) : textes, gestes, « Reprendre ».
      const lA = ligne(sA);
      const lB = ligne(sB, { status: 'echec', erreur: { raison: 'inaccessible', extra: {} }, appels: 1 });
      const lC = ligne(sC, { status: 'echec', erreur: { raison: 'serveur', extra: {} }, appels: 1, device_id: 'dev-ailleurs' });
      const lD = ligne(sD, { status: 'en_cours', document_id_vol: 'doc-ailleurs', battement_at: new Date().toISOString(), started_at: new Date().toISOString() });
      const lE = ligne(sE, { status: 'echec', erreur: { raison: 'serveur', extra: {} }, appels: 1 });
      await db.mutate({ puts: { imports: [lA, lB, lC, lD, lE] }, origin: 'device' });
      // Ronde 1 (P-1, défense en profondeur) : le chemin photo n'AJOUTE pas non plus de page à une lecture web — refus avant tout octet, ligne intacte.
      const filesAvantW = await db.count('files'), pagesAvantW = await db.count('source_pages'), lAavant = await db.get('imports', lA.id);
      let pagesWeb = null; try { await repo.ajouterPages([new File([new Uint8Array([1, 2, 3, 4])], 'w.jpg', { type: 'image/jpeg' })], { import_id: lA.id }); } catch (e) { pagesWeb = e; }
      eq([pagesWeb?.name, await db.get('imports', lA.id), await db.count('files'), await db.count('source_pages')], ['TypeError', lAavant, filesAvantW, pagesAvantW], 'repo.ajouterPages({ import_id: <ligne web> }) → TypeError avant tout octet ; la ligne web garde page_ids vide et aucune séance (P-1, ronde 1)');
      const root = await monterAdd();
      const [nA, nB, nC, nD] = [lA, lB, lC, lD].map((l) => ligneDe(root, l.id));
      eq([!!nA, !!nB, !!nC, !!nD], [true, true, true, true], 'Ajouter (lot B) : une ligne par lecture web ouverte');
      eq(nA.querySelector('strong')?.textContent, 'Pâtes puttanesca — Lien web · www.ricardocuisine.com', 'Ajouter (lot B) : titre « {texte} — Lien web · {hôte} » (l’hôte recalculé, pas « Livre huit »)');
      eq([nA.textContent.includes('L’app n’a pas encore lu la page.'), nA.textContent.includes('photo'), boutons(nA)], [true, false, ['Reprendre', 'Ignorer']], 'Ajouter (lot B) : a_lancer → « L’app n’a pas encore lu la page. » (aucune photo), Reprendre et Ignorer');
      eq([nB.textContent.includes('La page n’a pas pu être téléchargée (site injoignable, trop lent, ou qui refuse les robots). Ouvre-la toi-même.'), boutons(nB)], [true, ['Réessayer', 'Ignorer']], 'Ajouter (lot B) : echec(inaccessible) → la phrase de l’écran de lecture, « Réessayer » (pas « Relancer ») et Ignorer');
      eq([boutons(nC), nC.textContent.includes('Photos sur un autre appareil')], [['Réessayer', 'Ignorer'], false], 'Ajouter (lot B) : une ligne d’un AUTRE appareil → « Réessayer » offert quand même, jamais « Photos sur un autre appareil »');
      eq([nD.textContent.includes('En cours sur un autre écran'), boutons(nD)], [true, []], 'Ajouter (lot B) : un vol tenu ailleurs → « En cours sur un autre écran », aucun geste');
      bouton(nA, 'Reprendre').click();
      eq(navs.at(-1), `/recipes/${encodeURIComponent(sA.id)}/importer?import=${encodeURIComponent(lA.id)}`, 'Ajouter (lot B, R-B-20) : « Reprendre » → l’écran de la fiche (variante web), avec LA ligne (?import=)');

      // --- 2 bis (ronde 1). Les textes de la section que la tâche ne fixait qu'au domaine : signet pas encore reçu, adresse illisible, échec
      // illisible (« Code : … ») et JSON-LD hors bornes (l'`extra` de l'erreur), ligne sans recipe_id ; le titre reçu isolé de l'hôte recalculé.
      const sH = { ...signetDe('https://h.test/x', 'Page hostile'), source_url: 'javascript:alert(1)' }; // adresse illisible, posée telle quelle (reçue)
      const sJ = signetDe('https://j.test/gros', 'Gros gâteau');
      await db.mutate({ puts: { recipes: [sH, sJ] }, origin: 'device' });
      const lZ = ligne(sA, { id: 'imp_pas_recu', recipe_id: 'rc_pas_recu' });
      const lH = ligne(sH, { status: 'echec', erreur: { raison: 'illisible', extra: {} }, appels: 1 });
      const lJ = ligne(sJ, { status: 'echec', erreur: { raison: 'hors_bornes', extra: { source_kind: 'jsonld' } }, appels: 1 });
      await db.mutate({ puts: { imports: [lZ, lH, lJ] }, origin: 'device' });
      const r2 = await monterAdd();
      const titreDe = (id) => ligneDe(r2, id)?.querySelector('strong')?.textContent ?? null, etatDe = (id) => ligneDe(r2, id)?.querySelector('.status')?.textContent ?? null;
      eq([titreDe(lZ.id), boutons(ligneDe(r2, lZ.id))], ['(référence pas encore reçue)', []], 'Ajouter (lot B, ronde 1) : signet pas encore reçu → « (référence pas encore reçue) », aucun geste (spec § 4.7)');
      eq([titreDe(lH.id), etatDe(lH.id)], ['Page hostile — Lien web', 'L’assistant n’a pas répondu lisiblement. Réessaie. Code : illisible'], 'Ajouter (lot B, ronde 1) : adresse illisible → « … — Lien web » sans hôte ; échec illisible → le texte suivi de « Code : illisible »');
      eq(etatDe(lJ.id), 'La recette de cette page dépasse ce que l’app peut lire (plus de 80 ingrédients ou 60 étapes, ou une ligne trop longue). Ouvre la page.', 'Ajouter (lot B, ronde 1) : echec(hors_bornes) d’un JSON-LD → le texte dépend de l’extra de l’erreur (source_kind), pas de la seule raison');
      eq([titreDe(lN.id), boutons(ligneDe(r2, lN.id))], ['Sans titre — Lien web', ['Ignorer']], 'Ajouter (lot B, ronde 1) : une ligne web sans recipe_id → « Sans titre — Lien web », « Ignorer » seul (jamais « Réessayer »)');
      const strongA = ligneDe(r2, lA.id)?.querySelector('strong'), bdiA = strongA?.querySelector(':scope > bdi') ?? null;
      eq([bdiA?.textContent ?? null, strongA ? [...strongA.childNodes].filter((n) => n !== bdiA).map((n) => n.textContent).join('') : null], ['Pâtes puttanesca', ' — Lien web · www.ricardocuisine.com'],
        'Ajouter (lot B, ronde 1) : le titre du signet (donnée reçue) est isolé dans un <bdi>, l’hôte recalculé hors de lui — un U+202E du titre ne peut pas réordonner « — Lien web · {hôte} »');

      // --- 3. « Réessayer » → UN POST lecture-web ; « Annuler » ; une ligne d'un autre appareil devient celle d'ici ; un signet en http est refusé.
      const ff = fauxFetch();
      const rR = await monterAdd({ fetch: ff.fetch, battementMs: 20 });
      bouton(ligneDe(rR, lB.id), 'Réessayer').click();
      await attendre(() => ff.appels.length === 1 && !!bouton(ligneDe(rR, lB.id), 'Annuler'), 'POST parti, « Annuler » offert');
      const enVol = await db.get('imports', lB.id);
      eq([JSON.parse(ff.appels[0].options.body), ff.appels[0].options.headers.authorization, enVol.status, enVol.document_id_vol, enVol.appels, ligneDe(rR, lB.id).textContent.includes('Lecture de la page par l’assistant…')],
        [{ outil: 'lecture-web', corps: { url: 'https://b.test/soupe' } }, 'Bearer ' + JETON, 'en_cours', V.DOCUMENT_ID, 2, true],
        'Réessayer (lot B) : UN POST lecture-web avec l’adresse du signet, la ligne en_cours tenue par ce document, appels + 1, « Lecture de la page par l’assistant… »');
      bouton(ligneDe(rR, lB.id), 'Annuler').click();
      await attendre(async () => (await db.get('imports', lB.id)).status === 'echec' && !!bouton(ligneDe(rR, lB.id), 'Réessayer'), 'annulé');
      eq([ff.appels[0].options.signal.aborted, (await db.get('imports', lB.id)).erreur?.raison, ligneDe(rR, lB.id).textContent.includes('Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.'), V.volEnCours()],
        [true, 'annule', true, null], 'Annuler (lot B) : le fetch est abandonné, echec(annule), la phrase I-B7, le vol est libéré (annulerVol et annulerLecture agissent sur le même vol de vol.js : l’aiguillage par sorte n’est pas observable ici)');
      const ff2 = fauxFetch();
      const rC = await monterAdd({ fetch: ff2.fetch });
      bouton(ligneDe(rC, lC.id), 'Réessayer').click();
      await attendre(() => ff2.appels.length === 1, 'POST de la ligne d’un autre appareil');
      eq([(await db.get('imports', lC.id)).status, (await db.get('imports', lC.id)).device_id], ['en_cours', moi], 'Réessayer (lot B, P-5) : une ligne d’un AUTRE appareil relancée ici devient celle de CET appareil (l’appareil d’origine ne la juge plus sur 90 s de battement, mais sur VOL_MORT_MS)');
      ff2.rendre[0](200, LUE);
      await attendre(async () => (await db.get('imports', lC.id)).status === 'a_verifier' && !!bouton(ligneDe(rC, lC.id), 'Reprendre'), 'lecture reçue');
      eq([boutons(ligneDe(rC, lC.id)), ligneDe(rC, lC.id).textContent.includes('Lecture reçue le'), (await db.get('imports', lC.id)).resultat?.recette?.title, ff2.appels.length],
        [['Reprendre', 'Ignorer'], true, 'Tarte lue', 1], 'Réessayer (lot B) : la réponse est écrite a_verifier → « Lecture reçue le … », Reprendre et Ignorer ; un seul POST');
      bouton(ligneDe(rC, lC.id), 'Ignorer').click();
      await attendre(async () => (await db.get('imports', lC.id)).status === 'ignore' && !ligneDe(rC, lC.id), 'ignoré');
      eq([(await db.get('imports', lC.id)).status, typeof (await db.get('imports', lC.id)).finished_at], ['ignore', 'string'], 'Ignorer (lot B) : une lecture web → ignore (finished_at posé), la ligne disparaît');
      const ff3 = fauxFetch();
      const rE = await monterAdd({ fetch: ff3.fetch });
      const ditsAvant = dits.length;
      // Ronde 1 : « rien d'écrit » se MESURE — la ligne relue ENTIÈRE avant et après, et chaque db.mutate pendant le geste compté.
      const lEavant = await db.get('imports', lE.id), mutateAvant = db.mutate; let ecrituresE = 0;
      db.mutate = function (...a) { ecrituresE += 1; return mutateAvant.apply(this, a); };
      try {
        bouton(ligneDe(rE, lE.id), 'Réessayer').click();
        await attendre(() => dits.length > ditsAvant, 'refus dit');
      } finally { db.mutate = mutateAvant; }
      eq([dits.at(-1), ff3.appels.length, await db.get('imports', lE.id), ecrituresE], ['Cette adresse ne peut pas être lue par l’assistant : seule une page publique en https est admise. Ouvre-la toi-même.', 0, lEavant, 0],
        'Réessayer (lot B) : un signet en http → refus « interdit » dit par la phrase de l’écran de lecture, zéro POST, rien d’écrit (ligne relue entière identique, aucun db.mutate pendant le geste)');
      eq(reseau, 0, 'lot B (tâche 6) : aucun appel hors des fausses fetch des blocs');

      // --- 4. Démarrage (§ 7.4) : une lecture web en_cours de CET appareil au battement de −120 s → interrompu ; enregistrée il y a 31 jours → purgée.
      const T = Date.now(); const avant = (ms) => new Date(T - ms).toISOString(); const J = 24 * 3600 * 1000;
      const sF = signetDe('https://f.test/x', 'F'); const sG = signetDe('https://g.test/x', 'G');
      await db.mutate({ puts: { recipes: [sF, sG], imports: [ligne(sF, { status: 'en_cours', document_id_vol: 'doc-ferme', battement_at: avant(120000), started_at: avant(130000), updated_at: avant(120000) }), ligne(sG, { status: 'enregistre', finished_at: avant(31 * J), updated_at: avant(31 * J) })] }, origin: 'device' });
      await repo.init();
      const mort = await db.get('imports', 'imp_' + sF.id);
      eq([mort?.status, mort?.erreur, mort?.document_id_vol, await db.get('imports', 'imp_' + sG.id), (await db.get('imports', lD.id))?.status], ['echec', { raison: 'interrompu', extra: {} }, null, undefined, 'en_cours'],
        'démarrage (lot B) : lecture web en_cours de CET appareil à −120 s → echec(interrompu), vol libéré ; enregistrée il y a 31 jours → purgée ; un battement frais reste en_cours');

      // --- 5. Fiche du livre (D-B17) : le signet est rangé dans le livre, son import web (edition_id nul) ne compte pas.
      const ctxB = (imports) => ({ editionsById: new Map([['ed8', ed8]]), booksById: new Map([['b8', b8]]), books: [b8], recipes: [sA], recipe_versions: [], source_documents: [], source_pages: [], rediscovery_prefs: [], book_editions: [ed8], docsByRecipe: new Map(), scan_sessions: [], imports, settings: {}, pagesById: new Map(), recipesById: new Map([[sA.id, sA]]), editionLabel: (e) => (e?.id === 'ed8' ? 'Livre huit' : '') });
      const liens = (r) => [...r.querySelectorAll('a')].filter((a) => a.getAttribute('href') === '#/add?section=imports').map((a) => a.textContent);
      const ciblee = { id: 'k8', kind: 'recette', recipe_id: null, edition_id: 'ed8', scan_session_id: null, page_ids: [], status: 'a_lancer' };
      eq([sA.edition_id, lA.edition_id, liens(await B.renderBook({ id: 'ed8' }, {}, ctxB([lA, ciblee])))], ['ed8', null, ['1 import à reprendre']],
        'fiche du livre (D-B17) : un signet rangé dans le livre, mais son import web (edition_id nul) ne compte pas — seul l’import de pages compte');

      // --- 6. Régression : « lot suivant » a disparu de l'écran ciblé.
      const srcIC = await lire('../src/ui/import-cible.js');
      eq([srcIC.length > 1000, srcIC.includes('lot suivant')], [true, false], 'régression (lot B) : « lot suivant » a disparu de src/ui/import-cible.js (source lu, non vide)');
    } finally {
      V.reinitialiserVol();
      scene.remove(); setUiLocale(localeAvant);
    }
  }));

  // =====================================================================================================================================
  // Lot C, tâche 1 — T-C25 : la primitive de vol est PARTAGÉE (lancerVol, spec C D-C21, N-1). lancerExtraction reste verte telle quelle (blocs
  // « extraire et enregistrer », « annuler », « incertain », « battement » ci-dessus : aucune assertion amendée, M87) ; ici lancerVol avec un
  // `executer` factice : ce qu'il reçoit et quand, appels, a_verifier, echec, Annuler, verrou partagé recette ↔ index, battement face à init().
  await run('vol partagé lancerVol (lot C, T-C25)', () => withRepo(async (repo, db) => {
    const UI = await import('../src/ui/import-cible.js');
    const L = await import('../src/domain/llm.js');
    const D = await import('../src/domain/import-cible.js');
    const { installCapture } = await import('../src/sync/outbox.js');
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
    const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
    const imageDe = async (nom, couleur) => { const c = new OffscreenCanvas(320, 240); const cx = c.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, 320, 240); cx.fillStyle = '#fff'; cx.fillRect(10, 10, 160, 120); return new File([await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' }); };
    const SESSION_VOL = { access_token: 'jeton-vol-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
    const ctx = { sync: { user: { id: 'u1', email: 'a@exemple.invalid' }, auth: { jeton: async () => SESSION_VOL } } };
    const rep = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(corps) });
    const fetchOk = async () => rep(200, { model: 'claude-x', stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] });
    // Une ligne d'index (kind index, recipe_id null) sur deux pages réelles, plus un identifiant de page ABSENT de la base (pointeur souple).
    const preparer = async (kind = 'index') => {
      const r = await repo.ajouterPages([await imageDe('a.jpg', '#a33'), await imageDe('b.jpg', '#3a3')], { import: { id: repo.newId('imp'), kind, ...(kind === 'recette' ? { recipe_id: repo.newId('rc') } : {}) } });
      const l = await db.get('imports', r.importId);
      await db.put('imports', { ...l, page_ids: [r.pages[0].id, 'pg_absente', r.pages[1].id] });
      return { id: r.importId, pages: r.pages.map((p) => p.id) };
    };
    try {
      // 1) Ce qu'executer reçoit, et quand.
      const { id, pages } = await preparer();
      let recu = null; let lueAuDepart = null; let finir;
      const suspendu = new Promise((r) => { finir = r; });
      const vol = UI.lancerVol(id, async (args) => {
        lueAuDepart = await db.get('imports', id);
        recu = args;
        await args.provider.complete([{ role: 'user', content: 'x' }]); // un fetch fait par le fournisseur : appels + 1 (M88)
        await suspendu;
        return { resultat: { x: 1 }, texteBrut: 'brut', modele: 'claude-x' };
      }, { ctx, repo, fetch: fetchOk });
      await attendre(() => recu !== null && UI.volEnCours()?.importId === id, 'executer appelé');
      eq([lueAuDepart.status, lueAuDepart.document_id_vol, typeof lueAuDepart.started_at, typeof lueAuDepart.battement_at], ['en_cours', UI.DOCUMENT_ID, 'string', 'string'], 'T-C25 : la ligne est en_cours, document_id_vol = DOCUMENT_ID, started_at et battement_at posés AVANT qu’executer soit appelé');
      eq([recu.pageIds, recu.images.length, recu.kind, recu.signal instanceof AbortSignal, recu.provider instanceof L.PasserelleProvider], [pages, 2, 'index', true, true], 'T-C25 (M83) : executer reçoit les pages ENVOYÉES (la page absente écartée des deux listes), autant d’images, la sorte de la ligne, un signal, le fournisseur de la passerelle');
      await attendre(async () => (await db.get('imports', id)).appels === 1, 'appels à 1');
      finir();
      eq(await vol, { issue: 'a_verifier' }, 'T-C25 : lancerVol rend { issue: a_verifier }');
      const fin = await db.get('imports', id);
      eq([fin.status, fin.resultat, fin.reponse_brute, fin.model, typeof fin.duree_ms, fin.document_id_vol, fin.erreur, fin.finished_at ?? null, fin.appels, UI.volEnCours()], ['a_verifier', { x: 1 }, 'brut', 'claude-x', 'number', null, null, null, 1, null], 'T-C25 (M88, M89) : a_verifier avec le resultat RENDU PAR executer (jamais celui d’une recette), reponse_brute, model, duree_ms, sans finished_at ; appels 1 ; vol libéré');
      // 2) executer lève une ErreurExtraction : echec(raison), reponse_brute gardée.
      { const p2 = await preparer();
        eq(await UI.lancerVol(p2.id, async () => { throw new L.ErreurExtraction('coupe', { texteBrut: 'coupé' }); }, { ctx, repo, fetch: fetchOk }), { issue: 'echec', raison: 'coupe' }, 'T-C25 : executer lève ErreurExtraction(coupe) → { issue: echec, raison: coupe }');
        const l2 = await db.get('imports', p2.id);
        eq([l2.status, l2.erreur?.raison, l2.reponse_brute, l2.document_id_vol], ['echec', 'coupe', 'coupé', null], 'T-C25 : echec(coupe) écrit avec la réponse brute, vol libéré'); }
      // 3) « Annuler » pendant executer : echec(annule), signal levé.
      { const p3 = await preparer(); let signalVu = null;
        const v3 = UI.lancerVol(p3.id, (args) => new Promise((_, rej) => { signalVu = args.signal; args.signal.addEventListener('abort', () => rej(new Error('annule')), { once: true }); }), { ctx, repo, fetch: fetchOk });
        await attendre(() => signalVu !== null, 'executer suspendu');
        eq(await UI.annulerVol(p3.id), true, 'T-C25 : annulerVol tient le vol de ce document');
        const r3 = await v3; const l3 = await db.get('imports', p3.id);
        eq([r3.issue, signalVu.aborted, l3.status, l3.erreur?.raison, UI.volEnCours()], ['echec', true, 'echec', 'annule', null], 'T-C25 : Annuler → signal levé, echec(annule), plus de vol'); }
      // 4) UN vol par document, recettes ET index (I-C4, M90).
      { const p4 = await preparer(); const p5 = await preparer(); const pr = await preparer('recette');
        let lacher; const tenu = new Promise((r) => { lacher = r; });
        const v4 = UI.lancerVol(p4.id, async () => { await tenu; return { resultat: { y: 1 }, texteBrut: '', modele: null }; }, { ctx, repo, fetch: fetchOk });
        await attendre(() => UI.volEnCours()?.importId === p4.id, 'vol d’index tenu');
        eq([await UI.lancerExtraction(pr.id, { ctx, repo, fetch: fetchOk }), await UI.lancerVol(p5.id, async () => ({ resultat: {}, texteBrut: '', modele: null }), { ctx, repo, fetch: fetchOk })], [{ issue: 'refuse', raison: 'vol_tenu' }, { issue: 'refuse', raison: 'vol_tenu' }], 'T-C25 (M90) : pendant un vol d’index, l’extraction d’une recette ET un autre lancerVol sont refusés (vol_tenu)');
        lacher(); await v4;
        let rendre = null; const fetchLent = () => new Promise((res) => { rendre = () => res(rep(502, { erreur: 'serveur' })); });
        const v6 = UI.lancerExtraction(pr.id, { ctx, repo, fetch: fetchLent });
        await attendre(() => typeof rendre === 'function', 'fetch de la recette parti');
        eq(await UI.lancerVol(p5.id, async () => ({ resultat: {}, texteBrut: '', modele: null }), { ctx, repo, fetch: fetchOk }), { issue: 'refuse', raison: 'vol_tenu' }, 'T-C25 (M90) : … et l’inverse : pendant l’extraction d’une recette, une lecture d’index est refusée');
        rendre(); await v6; }
      // 5) Battement face à la passe `interrompu` de repo.init() (T6 du lot A ; Review Focus 1) et section Imports. La tête finale du lot A bat HORS de
      //    la ligne (vague finale : repo.battre, ligne interne battement:<id> de sync_state) : l'espion compte les appels de repo.battre et l'attente lit
      //    cette ligne (le repli de l'étape 5 ; modèle : le bloc « battement » de tests/import-cible.js).
      { const p6 = await preparer();
        const T0 = Date.now() - 120000; let premier = true;
        const maintenant = () => { if (premier) { premier = false; return new Date(T0).toISOString(); } return new Date().toISOString(); }; // départ à T − 120 s, battements à l'heure réelle
        let battements = 0;
        const espion = { ...repo, battre: async (id, q) => { battements += 1; return repo.battre(id, q); } };
        let lacher; const tenu = new Promise((r) => { lacher = r; });
        const v = UI.lancerVol(p6.id, async () => { await tenu; return { resultat: { z: 1 }, texteBrut: '', modele: null }; }, { ctx, repo: espion, fetch: fetchOk, maintenant, battementMs: 20 });
        await attendre(async () => { const l = await db.get('imports', p6.id); const hb = await db.get('sync_state', 'battement:' + p6.id); return l.status === 'en_cours' && hb?.status === 'vol' && Date.parse(hb.value) > T0 + 60000; }, 'au moins un battement à l’heure réelle (modèle : bloc « battement »)');
        installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
        await repo.init(); // la passe `interrompu` rejouée PENDANT le vol (brief T6 : « capture posée puis repo.init() rappelé »)
        eq((await db.get('imports', p6.id)).status, 'en_cours', 'T-C25 (M91) : un vol d’index rebattu n’est pas marqué interrompu par repo.init() (son départ datait de 120 s)');
        const ctxI = { imports: await db.getAll('imports'), scan_sessions: [], recipesById: new Map(), editionsById: new Map(), booksById: new Map() };
        const la = D.lignesImports(ctxI, { documentId: UI.DOCUMENT_ID, deviceId: repo.deviceId(), maintenant: new Date().toISOString() }).find((x) => x.id === p6.id);
        eq([la?.gestes, la?.ailleurs], [['annuler'], false], 'T-C25 (M92) : la section Imports offre « Annuler » pour ce vol d’index de CE document');
        lacher(); await v;
        const n = battements; await new Promise((r) => setTimeout(r, 80)); // 4 × battementMs : un intervalle survivant appellerait encore
        eq([UI.volEnCours(), battements, n >= 1], [null, n, true], 'T-C25 : après le retour, plus de vol et plus AUCUN appel de battement (modèle : bloc « battement »)'); }
      // 6) Une lecture SANS référence (option `lecture` de T6, ronde 1) : les gardes passent AVANT toute écriture ; puis la ligne naît et vole.
      { const { pages: pg } = await preparer();
        const lecture = { kind: 'index', importId: null, pageIds: pg, editionId: null, sessionId: 'ss_vol' };
        const avant = (await db.getAll('imports')).length;
        eq(await UI.lancerVol(null, async () => ({ resultat: { w: 1 }, texteBrut: '', modele: null }), { ctx, repo, fetch: fetchOk, enLigne: () => false, lecture }), { issue: 'refuse', raison: 'hors_ligne', importId: null }, 'T-C25 (lecture) : hors ligne → refusé, importId null');
        eq((await db.getAll('imports')).length, avant, 'T-C25 (lecture, ronde 1 de T6) : un vol refusé n’écrit RIEN dans le journal');
        let vu = null;
        const r6 = await UI.lancerVol(null, async (args) => { vu = [args.kind, args.pageIds]; return { resultat: { w: 1 }, texteBrut: 'b', modele: 'claude-x' }; }, { ctx, repo, fetch: fetchOk, lecture });
        const l6 = await db.get('imports', r6.importId);
        eq([r6.issue, typeof r6.importId, vu, l6.kind, l6.recipe_id, l6.scan_session_id, l6.page_ids, l6.status, l6.resultat, UI.volEnCours()], ['a_verifier', 'string', ['index', pg], 'index', null, 'ss_vol', pg, 'a_verifier', { w: 1 }, null], 'T-C25 (lecture) : la ligne naît par repo.ouvrirImport sur ces pages, l’exécutant reçoit la sorte et les pages envoyées, le résultat rendu est écrit ; lancerVol rend l’importId'); }
    } finally {
      UI.reinitialiserImportCible?.();
      globalThis.fetch = vraiFetch;
    }
  }));

  // Statique (admis par le brief) : le fournisseur et la base ne sont jamais nommés ; pending_recipe a disparu de tout src/ ; SHELL ; filet i18n.
  await run('écran import ciblé : statique', async () => {
    const src = await lire('../src/ui/import-cible.js');
    ok(src.length > 1000 && /export async function renderImportCible/.test(src), 'statique : src/ui/import-cible.js est lu et exporte renderImportCible (garde contre un source vide)');
    eq(/Anthropic|Supabase/.test(src), false, 'statique (I-9) : aucun texte ne nomme le fournisseur ni la base dans src/ui/import-cible.js');
    const sw = await lire('../sw.js');
    ok(sw.includes("'./src/ui/import-cible.js'"), 'SHELL : ./src/ui/import-cible.js');
    const modules = [...sw.matchAll(/'\.\/(src\/[^']+\.js)'/g)].map((m) => m[1]);
    const porteurs = [];
    for (const m of modules) if ((await lire('../' + m)).includes('pending_recipe')) porteurs.push(m);
    eq([modules.length > 30, porteurs], [true, []], 'régression (D-8) : pending_recipe a disparu de tout src/ (poseurs et lecteur)');
    const { MODULES_NEUFS } = await import('./ajouter.js');
    ok(Array.isArray(MODULES_NEUFS) && MODULES_NEUFS.includes('../src/ui/import-cible.js'), 'filet i18n : MODULES_NEUFS (tests/ajouter.js) contient src/ui/import-cible.js');
  });
}
