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
    const recettes = ['rc_a', 'rc_b', 'rc_c', 'rc_d', 'rc_f', 'rc_g', 'rc_h', 'rc_i', 'rc_j', 'rc_k', 'rc_l', 'rc_o', 'rc_p', 'rc_q', 'rc_r', 'rc_s', 'rc_t', 'rc_v', 'rc_ref'].map((id) => fiche(id)).concat([
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
        await monter('rc_signet');
        eq([dits, navs], [['Un lien web s’importe au lot suivant.'], ['/recipes/rc_signet']], 'ouverture : un signet → toast du lot suivant + retour à la fiche');
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
          await attendre(() => root2.etatRoute().importId === null, 'écran redessiné sans import ouvert');
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
          const espionP = { ...repo, transitionner: async (store, key, opts) => { if (opts?.patch?.status === 'enregistre') { parLAutre = true; await db.put('imports', { ...(await db.get('imports', key)), status: 'enregistre' }); parLAutre = false; } return repo.transitionner(store, key, opts); } };
          const root4 = await monter('rc_p', { deps: { fetch: interdit, repo: espionP } });
          vus.length = 0; dits.length = 0; navs.length = 0;
          bouton(root4, 'Enregistrer cette lecture').click();
          await attendre(() => root4.etatRoute().importId === null, 'redessiné sans import ouvert');
          eq([vus, [...dits], [...navs], await db.byIndex('recipe_versions', 'recipe_id', 'rc_p'), (await db.get('recipes', 'rc_p')).availability, (await db.get('imports', impP)).status], [[], [], [], [], 'reference_only', 'enregistre'], 'autre onglet (I-10, T4-R1) : enregistre ENTRE la relecture et la transaction → TransitionRefusee, aucun put, ni « Recette importée » ni navigation vers une version qui n’existe pas');
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
        let battements = 0; // T4-R1 : les APPELS de battement sont comptés (une fois en echec, l'écriture est refusée par le mur et la fiche ne bouge plus, intervalle vivant ou mort)
        const espion = { ...repo, transitionner: async (store, key, opts) => { if (opts?.patch && typeof opts.patch === 'object' && 'battement_at' in opts.patch && !('status' in opts.patch)) battements += 1; return repo.transitionner(store, key, opts); } };
        const root = await monter('rc_k', { deps: { fetch: ff.fetch, repo: espion, battementMs: 20, maintenant: () => new Date().toISOString() } });
        bouton(root, 'Extraire et enregistrer').click();
        await attendre(() => ff.appels.length === 1, 'fetch parti');
        const l0 = await db.get('imports', impK);
        const enFile = () => db.getAll('outbox').then((es) => es.filter((e) => e.store === 'imports' && e.id === impK).length);
        const n0 = await enFile();
        await attendre(async () => (await db.get('imports', impK)).battement_at !== l0.battement_at, 'battement écrit');
        const l1 = await db.get('imports', impK);
        eq([l1.status, l1.battement_at > l0.battement_at, l1.document_id_vol, await enFile()], ['en_cours', true, UI.DOCUMENT_ID, n0], 'battement : battement_at réécrit pendant le vol, même statut, origine device (rien de plus en file)');
        await UI.annulerVol(impK);
        await attendre(async () => (await db.get('imports', impK)).status === 'echec', 'annulé');
        await attendre(() => UI.volEnCours() === null, 'vol libéré (finally joué)');
        await new Promise((r) => setTimeout(r, 60)); // 3 × battementMs
        const nApres = battements;
        await new Promise((r) => setTimeout(r, 60)); // 3 × battementMs de plus : un intervalle survivant appellerait encore
        eq([battements, nApres >= 1, (await db.get('imports', impK)).status, (await db.get('imports', impK)).battement_at >= l1.battement_at], [nApres, true, 'echec', true], 'battement : nettoyé à la fin du vol — plus AUCUN appel de battement après Annuler (les appels sont comptés, pas la fiche ; au moins un pendant le vol)');
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
