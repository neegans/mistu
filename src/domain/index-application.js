// Plans d’index immuables : contexte complet, portions atomiques et reprise sans nouvel appel.
import { canoniqueSources, empreinteSources, comparerUtf8, octetsJsonbSources, projectionRecetteIndex, projectionLectureIndex,
  validerCaptureSources, validerCommandeSources, signerCommandeSources, verifierEmpreinteCommandeSources, ErreurSources, LIMITES_SOURCES } from './sources-format.js';
import { newId as nouvelId } from '../core/ids.js';
import { reconstruirePageIndex } from './index-lecture.js';
import { lireCycleEdition } from './cycle-edition.js';
import { lireEtatRecette } from './cycle-edition.js';
import { projectionSessionSources, projectionIdentitePage, projectionAnnotationPage, pagesActivesSeance } from './sources-format.js';
import { reconstruireResultatIndex } from './index-stockage.js';
import { consolider, cleTitre, fabriquerReferenceIndex, completerExistante, renvoisDe } from './index-livre.js';

const copie = x => structuredClone(x);
const fail = code => { throw new ErreurSources(code); };
const ZERO = '0'.repeat(64);
const parentCoupe = row => row?.kind==='index'&&row.index_call?.kind==='full'&&row.resultat===null&&row.erreur?.raison==='coupe'&&['echec','enregistre'].includes(row.status);
const lectureUtilisable = row => parentCoupe(row)||!!row?.resultat&&['a_verifier','enregistre'].includes(row.status);
const counts = () => ({ creates: 0, patches: 0, decisions: 0 });
const conflits = new Set(['source_changed', 'session_changed', 'edition_cycle', 'owner_changed', 'result_changed', 'index_changed', 'id_collision', 'invalid_shape', 'too_large', 'capability_missing']);

export const projectionPerimetreIndex = (recettes, editionId) => recettes.filter(r => r?.edition_id === editionId)
  .sort((a, b) => comparerUtf8(a.id, b.id)).map(projectionRecetteIndex);
export const empreintePerimetreIndex = (recettes, editionId) => empreinteSources(projectionPerimetreIndex(recettes, editionId));

export async function projeterIndexAffiche({ lecture, edition, recettes }) {
  if (!lecture || !edition?.id || !Array.isArray(recettes)) fail('invalid_shape');
  const used = new Set((lecture.pages || []).flatMap(p => p.lecture_ids || [p.ligne_id]).filter(Boolean));
  const lignes = (lecture.lignes || []).filter(r => used.has(r.id) && r.source_capture && lectureUtilisable(r));
  const ids = new Set(lignes.map(r => r.id));
  const pages = (lecture.pages || []).filter(p => (p.lecture_ids || [p.ligne_id]).some(id => ids.has(id)));
  if (!lignes.length) return { edition: copie(edition), recettes: copie(recettes), lecture: { ...copie(lecture), lignes: [], pages: [] }, groupes: [], consolidation: consolider([], { existantes: recettes }) };
  const read_set = await capturerReadSetIndex(lignes), hashes = new Map(read_set.map(r => [r.journal_id, r.result_sha256]));
  const c = consolider(pages, { existantes: recettes, modeleValide: lecture.modeleValide !== false });
  const groupes = [], connus = new Set();
  for (const [categorie, candidats] of [['certaine', c.certaines], ['deja', c.dejaDans], ['a_verifier', c.aVerifier], ['ecartee', c.ecartees]]) for (const value of candidats) {
    const candidate = copie(value), occurrences = [];
    for (const row of lignes) for (const p of row.resultat?.pages || []) for (const [ordinal, e] of (p.entrees || []).entries()) {
      if (cleTitre(e.titre) !== cleTitre(candidate.titre) || (categorie === 'ecartee' ? e.sorte !== 'autre' || p.page_id !== candidate.page_id || e.renvois !== candidate.renvois : e.sorte === 'autre')) continue;
      occurrences.push({ journal_id: row.id, ordinal, result_sha256: hashes.get(row.id) });
    }
    occurrences.sort((a, b) => comparerUtf8(a.journal_id, b.journal_id) || a.ordinal - b.ordinal);
    if (!occurrences.length) fail('result_changed');
    const restantes=occurrences.filter(o=>!(lignes.find(r=>r.id===o.journal_id)?.index_resolved_occurrences||[]).includes(o.ordinal));
    const toutesResolues=restantes.length===0,actives=toutesResolues?occurrences:restantes;
    const home = actives[0], unit_sha256 = await empreinteSources({ projection: 'index-unit-v1', edition_id: edition.id, occurrences:actives });
    if (connus.has(unit_sha256)) continue; connus.add(unit_sha256);
    if (candidate.options) for (const o of candidate.options) o.option_sha256 = await empreinteSources({ projection: 'index-option-v1', unit_sha256,
      plages: o.plages, existante_id: o.existanteId ?? null, sources: o.sources });
    const existing = lignes.find(r => r.id === home.journal_id)?.index_decisions?.find(d => d.occurrence_ordinal === home.ordinal && d.unit_sha256 === unit_sha256);
    const valide = existing && Object.keys(existing).every(k => ['occurrence_ordinal', 'unit_sha256', 'action', 'option_sha256', 'applied_ids_sha256'].includes(k))
      && typeof existing.applied_ids_sha256 === 'string' && /^[a-f0-9]{64}$/.test(existing.applied_ids_sha256)
      && ['auto', 'garder_option', 'garder_toutes', 'ajouter', 'ecarter', 'est_recette'].includes(existing.action)
      && (existing.action === 'garder_option' ? candidate.options?.some(o => o.option_sha256 === existing.option_sha256) : existing.option_sha256 === null);
    groupes.push({ categorie, candidate, journal_id: home.journal_id, occurrence_ordinal: home.ordinal, occurrences:copie(restantes), unit_sha256, decidee: toutesResolues||!!valide });
  }
  return { edition: copie(edition), recettes: copie(recettes), lecture: { ...copie(lecture), lignes: copie(lignes), pages: copie(pages) }, groupes, consolidation: c };
}

export async function unitesApplicationIndex({ projection, decisions = [], automatique = true }, { newId = nouvelId } = {}) {
  if (!projection || !Array.isArray(decisions) || new Set(decisions.map(x => x?.unit_sha256)).size !== decisions.length
    || decisions.some(d => !projection.groupes.some(g => g.unit_sha256 === d.unit_sha256))) fail('invalid_shape');
  const units = [], byId = new Map(projection.recettes.map(r => [r.id, r]));
  for (const g of projection.groupes) {
    const explicit = decisions.find(d => d.unit_sha256 === g.unit_sha256);
    if (g.decidee && !explicit) continue;
    const choix = explicit ?? (automatique && ['certaine', 'deja'].includes(g.categorie) ? { action: 'auto', option_sha256: null } : null);
    if (!choix) continue;
    if (g.decidee && explicit) fail('index_changed');
    const creates = [], patches = [], c = g.candidate;
    const fabriquer = plages => fabriquerReferenceIndex(c, { edition: projection.edition, newId, importId: g.journal_id, plages });
    if (choix.action === 'auto') {
      if (!['certaine', 'deja'].includes(g.categorie)) fail('invalid_shape');
      if (g.categorie === 'certaine') creates.push(fabriquer(c.plages));
      else {
        const old = byId.get(c.existanteId);
        const changes = lireEtatRecette(old, projection.edition).etat === 'active' ? completerExistante(old, c) : null;
        if (changes) patches.push({ id: old.id, base_sha256: await empreinteSources(projectionRecetteIndex(old)), changes });
      }
    } else if (choix.action === 'garder_option') {
      const option = c.options?.find(o => o.option_sha256 === choix.option_sha256);
      if (g.categorie !== 'a_verifier' || !option) fail('invalid_shape');
      if (!option.existanteId) creates.push(fabriquer(option.plages));
    } else if (choix.action === 'garder_toutes') {
      if (g.categorie !== 'a_verifier' || c.raison !== 'contradiction' || !c.options?.length) fail('invalid_shape');
      for (const option of c.options) if (!option.existanteId) creates.push(fabriquer(option.plages));
    } else if (choix.action === 'ajouter') {
      if (g.categorie !== 'a_verifier' || c.options) fail('invalid_shape'); creates.push(fabriquer(c.plages));
    } else if (choix.action === 'est_recette') {
      if (g.categorie !== 'ecartee') fail('invalid_shape');
      creates.push(fabriquerReferenceIndex({ titre: c.titre, renvois: c.renvois, rubriques: c.rubrique ? [c.rubrique] : [], section: null,
        sources: [{ page_id: c.page_id, page_imprimee: c.page_imprimee, rubrique: c.rubrique }] }, { edition: projection.edition, newId, importId: g.journal_id, plages: renvoisDe(c.renvois).plages }));
    } else if (choix.action !== 'ecarter' || g.categorie !== 'a_verifier') fail('invalid_shape');
    units.push({ journal_id: g.journal_id, occurrence_ordinal: g.occurrence_ordinal, occurrences:copie(g.occurrences), unit_sha256: g.unit_sha256, action: choix.action,
      option_sha256: choix.action === 'garder_option' ? choix.option_sha256 : null, creates, patches });
  }
  return units;
}

export async function capturerReadSetIndex(journaux) {
  if (!Array.isArray(journaux) || !journaux.length || new Set(journaux.map(r => r?.id)).size !== journaux.length) fail('invalid_shape');
  return Promise.all([...journaux].sort((a, b) => comparerUtf8(a.id, b.id)).map(async row => {
    if (row.kind !== 'index' || !lectureUtilisable(row)) fail('result_changed');
    validerCaptureSources(row.source_capture);
    return { journal_id: row.id, result_sha256: await empreinteSources(projectionLectureIndex(row)), source_capture_sha256: await empreinteSources(row.source_capture) };
  }));
}

function appliquerEffets(recettes, command) {
  const parId = new Map(recettes.map(r => [r.id, copie(r)]));
  for (const r of command.creates) { if (parId.has(r.id)) fail('id_collision'); parId.set(r.id, copie(r)); }
  for (const p of command.patches) {
    const avant = parId.get(p.id); if (!avant) fail('index_changed');
    parId.set(p.id, { ...avant, ...copie(p.changes) });
  }
  return [...parId.values()];
}

// Entrées privées issues du moteur existant : chaque unité reste indivisible.
export async function preparerPortionsIndex({ edition, journaux, recettes, unites, session, session_id, application_id }, { newId = nouvelId } = {}) {
  if (!edition?.id || lireCycleEdition(edition).etat !== 'active' || !Array.isArray(recettes) || !Array.isArray(unites) || typeof session_id !== 'string'||session?.id!==session_id) fail('invalid_shape');
  const rows = copie(journaux), read_set = await capturerReadSetIndex(rows), leader = read_set[0].journal_id;
  if (rows.some(r => r.edition_id !== edition.id || r.scan_session_id !== session_id || (r.expected_edition_cycle_id ?? null) !== (edition.lifecycle_id ?? null)
    || (r.owner_id ?? null) !== (rows[0].owner_id ?? null))) fail('owner_changed');
  const revisions = new Map(rows.map(r => [r.id, r.index_decision_revision ?? null]));
  const units = copie(unites), ids = new Set(), places = new Set();
  for (const u of units) {
    if (!revisions.has(u.journal_id) || !Number.isInteger(u.occurrence_ordinal) || u.occurrence_ordinal < 0 || u.occurrence_ordinal > 599
      || !Array.isArray(u.creates) || !Array.isArray(u.patches)) fail('invalid_shape');
    const place = `${u.journal_id}\0${u.occurrence_ordinal}`;
    if (places.has(place)) fail('invalid_shape'); places.add(place);
    for (const r of [...u.creates, ...u.patches]) { if (!r?.id || ids.has(r.id)) fail('invalid_shape'); ids.add(r.id); }
    if(!Array.isArray(u.occurrences)||!u.occurrences.length)fail('invalid_shape');
    for(const o of u.occurrences){const row=rows.find(r=>r.id===o.journal_id);if(!row?.resultat?.pages?.[0]?.entrees?.[o.ordinal]||row.index_resolved_occurrences?.includes(o.ordinal))fail('index_changed');}
    u.applied_ids = [...u.creates, ...u.patches].map(r => r.id).sort(comparerUtf8);
    u.applied_ids_sha256 = await empreinteSources(u.applied_ids);
  }
  const shared = { protocol: 1, op: 'index_apply', store: 'imports', id: leader, edition_id: edition.id, base_edition_cycle_id: edition.lifecycle_id ?? null,
    application_id: application_id ?? newId('ia'),base_session_sha256:await empreinteSources(projectionSessionSources(session)), read_set, read_set_sha256: await empreinteSources(read_set),
    source_capture_sha256: await empreinteSources(read_set.map(r => [r.journal_id, r.source_capture_sha256])),
    displayed_result_sha256: await empreinteSources(read_set.map(r => [r.journal_id, r.result_sha256])) };
  let currentRecipes = copie(recettes), scope = await empreintePerimetreIndex(currentRecipes, edition.id), offset = 0, previous = null;
  const initial_recipe_scope_sha256 = scope, commands = [];
  while (offset < units.length || !commands.length) {
    if (commands.length >= 128) fail('too_large');
    const operation_id = newId('iap');
    const construire = end => {
      const selection = units.slice(offset, end), homes = new Map([[leader, []]]);
      for(const parent of rows.filter(r=>parentCoupe(r)||!r.resultat?.pages?.[0]?.entrees?.some(e=>e.sorte!=='autre')))homes.set(parent.id,[]);
      for (const u of selection) {
        if (!homes.has(u.journal_id)) homes.set(u.journal_id, []);
        for(const occurrence of u.occurrences)if(!homes.has(occurrence.journal_id))homes.set(occurrence.journal_id,[]);
        homes.get(u.journal_id).push({ occurrences:copie(u.occurrences), occurrence_ordinal: u.occurrence_ordinal, unit_sha256: u.unit_sha256, action: u.action,
          option_sha256: u.option_sha256 ?? null, applied_ids_sha256: u.applied_ids_sha256, applied_ids: u.applied_ids });
      }
      return { ...copie(shared), operation_id, portion_id: operation_id, predecessor_operation_id: previous, terminal: end === units.length,
        base_decision_revision: revisions.get(leader), recipe_scope_sha256: scope,
        creates: selection.flatMap(u => u.creates), patches: selection.flatMap(u => u.patches),
        decisions: [...homes].sort(([a], [b]) => comparerUtf8(a, b)).map(([journal_id, entries]) => ({ journal_id, expected_decision_revision: revisions.get(journal_id), entries: entries.sort((a, b) => a.occurrence_ordinal - b.occurrence_ordinal) })), payload_sha256: ZERO };
    };
    let end = offset, lignes = 0;
    const homes = new Set([leader,...rows.filter(r=>parentCoupe(r)||!r.resultat?.pages?.[0]?.entrees?.some(e=>e.sorte!=='autre')).map(r=>r.id)]);
    for (let i = offset; i < units.length; i++) {
      const u = units[i], modifies=new Set([u.journal_id,...u.occurrences.map(o=>o.journal_id)]),nouveaux=[...modifies].filter(id=>!homes.has(id)).length;
      if (lignes + u.creates.length + u.patches.length + homes.size + nouveaux > LIMITES_SOURCES.lignes) break;
      lignes += u.creates.length + u.patches.length; for(const id of modifies)homes.add(id); end = i + 1;
    }
    if (end === offset && units.length) fail('too_large');
    const admissible = n => {
      try { validerCommandeSources(construire(n)); return true; }
      catch (e) { if (e.code === 'too_large') return false; throw e; }
    };
    if (!admissible(end)) {
      let bas = offset + 1, haut = end, dernier = offset;
      while (bas <= haut) { const milieu = Math.floor((bas + haut) / 2); if (admissible(milieu)) { dernier = milieu; bas = milieu + 1; } else haut = milieu - 1; }
      end = dernier; if (end === offset && units.length) fail('too_large');
    }
    const command = await signerCommandeSources(construire(end));
    // La prochaine base découle exclusivement des effets de cette portion.
    currentRecipes = appliquerEffets(currentRecipes, command);
    scope = await empreintePerimetreIndex(currentRecipes, edition.id);
    for (const d of command.decisions) revisions.set(d.journal_id, operation_id);
    commands.push(command); previous = operation_id; offset = end;
  }
  const application = { session_id, edition_id: edition.id, base_edition_cycle_id: edition.lifecycle_id ?? null, read_set,
    initial_recipe_scope_sha256, commands, next_portion: 0, local_counts: counts(), last_issue: null };
  // L’enveloppe interne ajoute quelques champs ; la porte de dépôt mesure encore la ligne entière.
  if (octetsJsonbSources(application) > 2 * 1024 * 1024) fail('too_large');
  return application;
}

export async function verifierPortionIndex(command, { journaux, recettes }) {
  await verifierEmpreinteCommandeSources(command);
  const rows = new Map(journaux.map(r => [r.id, r]));
  for (const read of command.read_set) {
    const row = rows.get(read.journal_id);
    if (!row || !lectureUtilisable(row)) fail('result_changed');
    if (await empreinteSources(row.source_capture) !== read.source_capture_sha256) fail('source_changed');
    if (await empreinteSources(projectionLectureIndex(row)) !== read.result_sha256) fail('result_changed');
  }
  for(const d of command.decisions)for(const e of d.entries)for(const o of e.occurrences)if(rows.get(o.journal_id)?.index_resolved_occurrences?.includes(o.ordinal))fail('index_changed');
  for (const d of command.decisions) if ((rows.get(d.journal_id)?.index_decision_revision ?? null) !== d.expected_decision_revision) fail('index_changed');
  if (await empreintePerimetreIndex(recettes, command.edition_id) !== command.recipe_scope_sha256) fail('index_changed');
  const byId = new Map(recettes.map(r => [r.id, r]));
  for (const r of command.creates) if (byId.has(r.id)) fail('id_collision');
  for (const p of command.patches) if (!byId.has(p.id) || await empreinteSources(projectionRecetteIndex(byId.get(p.id))) !== p.base_sha256) fail('index_changed');
  return true;
}

// commettre écrit ensemble effets, reçu, outbox ET progression. Rien n’est confirmé avant son retour.
export async function executerApplicationIndex({ application, commettre, estCourante = () => true }) {
  if (!application || !Array.isArray(application.commands) || !Number.isInteger(application.next_portion) || application.next_portion < 0
    || application.next_portion > application.commands.length || typeof commettre !== 'function') fail('invalid_shape');
  let current = copie(application);
  while (current.next_portion < current.commands.length) {
    if (!estCourante()) return { issue: 'bloque', raison: 'owner_changed', application: current };
    const command = current.commands[current.next_portion];
    const next = { ...copie(current), next_portion: current.next_portion + 1, last_issue: null,
      local_counts: { creates: current.local_counts.creates + command.creates.length, patches: current.local_counts.patches + command.patches.length,
        decisions: current.local_counts.decisions + command.decisions.reduce((n, d) => n + d.entries.length, 0) } };
    try {
      const r = await commettre({ commande: copie(command), progression: copie(next) });
      if (!['applied', 'already_applied'].includes(r?.issue) || r.operation_id !== command.operation_id) fail('invalid_shape');
      current = next;
    } catch (e) {
      const reason = e?.code ?? (e?.name === 'QuotaExceededError' ? 'quota' : 'ecriture');
      return { issue: conflits.has(reason) ? 'bloque' : 'interrompu', raison: reason, application: { ...current, last_issue: reason } };
    }
  }
  return { issue: 'complete', application: current };
}

const erreurNormalisee = e => ['compte_change', 'contexte_change', 'bibliotheque_remplacee'].includes(e?.code) ? 'owner_changed'
  : e?.code === 'edition_retiree' ? 'edition_cycle' : e?.code ?? (e?.name === 'QuotaExceededError' ? 'quota' : 'ecriture');
const retourErreur = e => { const raison = erreurNormalisee(e); return { issue: conflits.has(raison) ? 'bloque' : 'interrompu', raison }; };
const cleApplication = id => `index_application:v1:${id}`;

export function creerServiceApplicationIndex({ repo, serviceSources, maintenant = () => new Date().toISOString(), newId = nouvelId } = {}) {
  if (!repo || !serviceSources) throw new TypeError('Dépôt et capture de sources requis');
  const plans = new WeakMap();
  async function scope(p) {
    const c = await serviceSources.contexteMutationSources({ capture: p.captureSources });
    if (c.issue !== 'ok') throw new ErreurSources(c.raison ?? 'owner_changed');
    return c;
  }
  async function lignesLogiques(rows) {
    const all = await repo.all('imports');
    return Promise.all(rows.map(async row => ({ ...copie(row), resultat: await reconstruireResultatIndex({ journal: row, imports: all }) })));
  }
  async function preparerApplicationIndex({ edition, journaux, recettes, unites, session, pages, captureSources }) {
    try {
      const p = { id: newId('ia'), edition: copie(edition), session: copie(session), pages: copie(pages), captureSources, row: null, travail: null };
      const c = await scope(p); p.portee = copie(c.portee);
      const logical = await lignesLogiques(journaux);
      p.application = await preparerPortionsIndex({ edition, journaux: logical, recettes, unites, session,session_id: session.id, application_id: p.id }, { newId });
      const plan = {}; plans.set(plan, p);
      return { issue: 'ok', plan, id: p.id, nombrePortions: p.application.commands.length };
    } catch (e) { return retourErreur(e); }
  }
  async function conserver(p) {
    const c = await scope(p), key = cleApplication(p.id), stored = await repo.get('sync_state', key);
    if (stored) {
      if (stored.value?.owner_id !== c.portee.owner_id || stored.value.database_name !== c.portee.database_name || stored.value.library_epoch !== c.portee.library_epoch
        || canoniqueSources(stored.value.payload.commands) !== canoniqueSources(p.application.commands)) fail('owner_changed');
      p.row = copie(stored); p.application = copie(stored.value.payload); return;
    }
    const date = maintenant(), row = { key, value: { format: 1, id: p.id, ...copie(c.portee), revision: 0, state: 'ready', created_at: date, saved_at: date, payload: copie(p.application) } };
    const remplacement=p.remplace?[{key:p.remplace.key,fusion:current=>{if(!current||canoniqueSources(current)!==canoniqueSources(p.remplace))fail('index_changed');return null;}}]:[];
    await repo.muterSources({ internes: { puts: [row],deletes:p.remplace?[p.remplace.key]:[], conditions: [...c.internes.conditions, { key, absente: true },...remplacement] } }, { ...c.options, origin: 'device' });
    p.row = row;
  }
  async function commettre(p, { commande, progression }) {
    const c = await scope(p), raw = await Promise.all(commande.read_set.map(x => repo.get('imports', x.journal_id)));
    if (raw.some(x => !x)) fail('result_changed');
    const logical = await lignesLogiques(raw), recettes = await repo.byIndex('recipes', 'edition_id', commande.edition_id);
    await verifierPortionIndex(commande, { journaux: logical, recettes });
    const capturePages = new Map();
    for (const row of logical) for (const page of row.source_capture.pages) {
      const old = capturePages.get(page.id);
      if (old && (old.identity_sha256 !== page.identity_sha256 || old.annotation_sha256 !== page.annotation_sha256)) fail('source_changed');
      capturePages.set(page.id, page);
    }
    if(await empreinteSources(projectionSessionSources(p.session))!==commande.base_session_sha256)fail('session_changed');
    const expectedSession = canoniqueSources(projectionSessionSources(p.session)), active = new Set(pagesActivesSeance(p.session));
    const pages = new Map(p.pages.map(x => [x.id, x]));
    const conditions = { scan_sessions: [{ key: p.session.id, fusion: current => {
      if (!current || canoniqueSources(projectionSessionSources(current)) !== expectedSession) fail('session_changed'); return null;
    } }], source_pages: [], imports: [], recipes: [] };
    for (const [id, expected] of capturePages) {
      const page = pages.get(id);
      if (!page || !active.has(id) || await empreinteSources(projectionIdentitePage(page)) !== expected.identity_sha256 || await empreinteSources(projectionAnnotationPage(page)) !== expected.annotation_sha256) fail('source_changed');
      const identite = canoniqueSources(projectionIdentitePage(page)), annotation = canoniqueSources(projectionAnnotationPage(page));
      conditions.source_pages.push({ key: id, fusion: current => {
        if (!current || canoniqueSources(projectionIdentitePage(current)) !== identite || canoniqueSources(projectionAnnotationPage(current)) !== annotation) fail('source_changed'); return null;
      } });
    }
    const expectedRecipes = canoniqueSources(projectionPerimetreIndex(recettes, commande.edition_id));
    conditions.recipes.push({ index: 'edition_id', valeur: commande.edition_id, verifier: current => {
      if (canoniqueSources(projectionPerimetreIndex(current, commande.edition_id)) !== expectedRecipes) fail('index_changed');
    } });
    const after = appliquerEffets(recettes, commande), applied = [...commande.creates, ...commande.patches].map(x => x.id).sort(comparerUtf8);
    const recu = { application_id: commande.application_id, operation_id: commande.operation_id, predecessor_operation_id: commande.predecessor_operation_id,
      payload_sha256: commande.payload_sha256, result_sha256: commande.displayed_result_sha256, base_decision_revision: commande.base_decision_revision,
      result_decision_revision: commande.operation_id, scope_after_sha256: await empreintePerimetreIndex(after, commande.edition_id), committed_at: maintenant(),
      counts: { creates: commande.creates.length, patches: commande.patches.length, decisions: commande.decisions.reduce((n, d) => n + d.entries.length, 0) }, applied_ids_sha256: await empreinteSources(applied) };
    const couvertures=new Map(logical.map(r=>[r.id,new Set(r.index_resolved_occurrences||[])]));
    for(const d of commande.decisions)for(const e of d.entries)for(const o of e.occurrences){const row=logical.find(r=>r.id===o.journal_id);if(!row?.resultat?.pages?.[0]?.entrees?.[o.ordinal])fail('result_changed');couvertures.get(o.journal_id).add(o.ordinal);}
    const resolus=new Set(logical.filter(row=>row.resultat?.pages?.length===1&&row.resultat.pages[0].etat==='lue'&&row.resultat.pages[0].entrees.every((e,i)=>e.sorte==='autre'||couvertures.get(row.id).has(i))).map(r=>r.id));
    for(const parent of logical.filter(parentCoupe)){const enfants=logical.filter(r=>r.index_call?.parent_call_id===parent.id&&r.index_call?.series_id===parent.index_call.series_id),left=enfants.find(r=>r.index_call.kind==='left_half'),right=enfants.find(r=>r.index_call.kind==='right_half');if(left&&right&&resolus.has(left.id)&&resolus.has(right.id)){const vue=reconstruirePageIndex({format:1,page_id:parent.index_call.page_id,full_call_id:parent.id,left_call_id:left.id,right_call_id:right.id},[parent,left,right]);if(vue.etat==='lue')resolus.add(parent.id);}}
    for (const row of logical) {
      const expected = canoniqueSources(projectionLectureIndex(row)), sourceRaw = raw.find(x => x.id === row.id), storage = canoniqueSources(sourceRaw.index_storage ?? null);
      const decision = commande.decisions.find(x => x.journal_id === row.id);
      conditions.imports.push({ key: row.id, fusion: current => {
        if (!current || !lectureUtilisable(current) || canoniqueSources(current.index_storage ?? null) !== storage
          || canoniqueSources(projectionLectureIndex(current, current.index_storage ? row.resultat : current.resultat)) !== expected) fail('result_changed');
        if (!decision) return null;
        if ((current.index_decision_revision ?? null) !== decision.expected_decision_revision) fail('index_changed');
        const places = new Map((current.index_decisions || []).map(x => [x.occurrence_ordinal, copie(x)]));
        for (const entry of decision.entries) { const saved = copie(entry); delete saved.applied_ids;delete saved.occurrences; places.set(saved.occurrence_ordinal, saved); }
        const next = { ...current, index_decisions: [...places.values()].sort((a, b) => a.occurrence_ordinal - b.occurrence_ordinal), index_decision_revision: commande.operation_id,index_resolved_occurrences:[...couvertures.get(row.id)].sort((a,b)=>a-b),...(resolus.has(row.id)?{status:'enregistre',finished_at:recu.committed_at}:{}) };
        if (current.id === commande.id) next.index_application_receipts = [...(current.index_application_receipts || []), recu].slice(-128);
        // Clôture par couverture exacte des occurrences et, pour un parent coupé, ses deux moitiés ; jamais par terminal.
        return next;
      } });
    }
    const contextes = [], byId = new Map(recettes.map(r => [r.id, r]));
    for (const r of commande.creates) {
      conditions.recipes.push({ key: r.id, absente: true });
      contextes.push({ recipe_id: r.id, expected_cycle_id: null, expected_edition_id: commande.edition_id, expected_edition_cycle_id: commande.base_edition_cycle_id, owner_id: c.portee.owner_id, creation: true, contexteValide: c.options.contexteValide });
    }
    for (const patch of commande.patches) {
      const old = byId.get(patch.id), expected = canoniqueSources(projectionRecetteIndex(old));
      if (lireEtatRecette(old, p.edition).etat !== 'active' || old.availability !== 'reference_only') fail('index_changed');
      conditions.recipes.push({ key: patch.id, fusion: current => {
        if (!current || canoniqueSources(projectionRecetteIndex(current)) !== expected || lireEtatRecette(current, p.edition).etat !== 'active') fail('index_changed');
        return { ...current, ...copie(patch.changes) };
      } });
      contextes.push({ recipe_id: old.id, expected_cycle_id: old.lifecycle_id ?? null, expected_edition_id: commande.edition_id, expected_edition_cycle_id: commande.base_edition_cycle_id, owner_id: c.portee.owner_id, contexteValide: c.options.contexteValide });
    }
    const expectedDraft = canoniqueSources(p.row), nextRow = { key: p.row.key, value: { ...copie(p.row.value), revision: p.row.value.revision + 1,
      state: progression.next_portion === progression.commands.length ? 'complete' : 'applying', saved_at: maintenant(), payload: copie(progression) } };
    await repo.muterSources({ metier: { puts: { recipes: commande.creates }, conditions, recettes: contextes, editions: c.editions },
      internes: { conditions: [...c.internes.conditions, { key: p.row.key, fusion: current => { if (!current || canoniqueSources(current) !== expectedDraft) fail('index_changed'); return nextRow; } }] }, commandes: [commande] }, c.options);
    p.row = nextRow;
    return { issue: 'applied', operation_id: commande.operation_id, recu };
  }
  async function appliquerIndex({ plan }) {
    const p = plans.get(plan); if (!p) return { issue: 'bloque', raison: 'invalid_shape' };
    if (p.travail) return p.travail;
    p.travail = (async () => {
      try { await conserver(p); const r = await executerApplicationIndex({ application: p.application, commettre: x => commettre(p, x) }); p.application = copie(r.application); return r; }
      catch (e) { return { ...retourErreur(e), application: copie(p.application) }; }
      finally { p.travail = null; }
    })();
    return p.travail;
  }
  async function reprendreApplicationIndex({ id, captureSources, session, pages, edition }) {
    try {
      const p = { id, captureSources, session: copie(session), pages: copie(pages), edition: copie(edition), travail: null }, c = await scope(p);
      const row = await repo.get('sync_state', cleApplication(id));
      if (!row || row.value.owner_id !== c.portee.owner_id || row.value.database_name !== c.portee.database_name || row.value.library_epoch !== c.portee.library_epoch) fail('owner_changed');
      p.row = copie(row); p.application = copie(row.value.payload); p.portee = copie(c.portee);
      if (p.application.session_id !== session.id || p.application.edition_id !== edition.id || p.application.base_edition_cycle_id !== (edition.lifecycle_id ?? null)) fail('source_changed');
      const plan = {}; plans.set(plan, p); return { issue: 'ok', plan, id, nombrePortions: p.application.commands.length };
    } catch (e) { return retourErreur(e); }
  }
  async function preparerRepriseApplicationIndex({id,projection,session,pages,captureSources,decisions=[]}){
    try{
      const ancien=await repo.get('sync_state',cleApplication(id)),c=await scope({captureSources});
      if(!ancien||ancien.value.owner_id!==c.portee.owner_id||ancien.value.database_name!==c.portee.database_name||ancien.value.library_epoch!==c.portee.library_epoch)fail('owner_changed');
      const hashes=new Map((await capturerReadSetIndex(projection.lecture.lignes)).map(r=>[r.journal_id,r.result_sha256]));
      const restants=ancien.value.payload.commands.slice(ancien.value.payload.next_portion).flatMap(cmd=>cmd.decisions.flatMap(d=>d.entries)),choix=[],conflits=[];
      for(const old of restants){
        if(old.occurrences.every(o=>hashes.get(o.journal_id)===o.result_sha256&&projection.lecture.lignes.find(r=>r.id===o.journal_id)?.index_resolved_occurrences?.includes(o.ordinal)))continue;
        const g=projection.groupes.find(x=>x.unit_sha256===old.unit_sha256)||projection.groupes.find(x=>old.occurrences.every(o=>x.occurrences.some(n=>n.journal_id===o.journal_id&&n.ordinal===o.ordinal&&n.result_sha256===o.result_sha256))),override=decisions.find(x=>x.unit_sha256===(g?.unit_sha256??old.unit_sha256));
        if(!g){conflits.push({unit_sha256:old.unit_sha256,action:old.action,raison:'result_changed'});continue;}
        if(g.decidee)continue;
        let candidate=override??{unit_sha256:g.unit_sha256,action:old.action,option_sha256:old.option_sha256};
        if(!override&&candidate.action==='garder_option'&&!g.candidate.options?.some(o=>o.option_sha256===candidate.option_sha256)){
          const creates=ancien.value.payload.commands.flatMap(cmd=>cmd.creates).filter(r=>old.applied_ids.includes(r.id));
          const option=creates.length===1&&g.candidate.options?.find(o=>canoniqueSources(o.plages)===canoniqueSources(creates[0].printed_pages));
          if(option)candidate={...candidate,option_sha256:option.option_sha256};
        }
        if(!override&&candidate.action==='ajouter'&&g.categorie==='deja')candidate={...candidate,action:'auto',option_sha256:null};
        try{await unitesApplicationIndex({projection,decisions:[candidate],automatique:false},{newId});choix.push(candidate);}catch{conflits.push({unit_sha256:old.unit_sha256,titre:g.candidate.titre,action:old.action,raison:'index_changed'});}
      }
      if(conflits.length)return{issue:'a_comparer',conflits};
      const unites=await unitesApplicationIndex({projection,decisions:choix,automatique:false},{newId});
      const result=await preparerApplicationIndex({edition:projection.edition,journaux:projection.lecture.lignes,recettes:projection.recettes,unites,session,pages,captureSources});
      if(result.issue!=='ok')return result;
      const p=plans.get(result.plan);p.remplace=copie(ancien);p.application.local_counts=copie(ancien.value.payload.local_counts);
      return result;
    }catch(e){return retourErreur(e);}
  }
  return { preparerApplicationIndex, appliquerIndex, reprendreApplicationIndex,preparerRepriseApplicationIndex };
}
