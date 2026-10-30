// Le vol commun reste propriétaire de l'authentification, du quota et de l'annulation.
// Une réponse de zone est durable avant que l'orchestrateur puisse demander la suivante.
import { lancerVol, cleLecture } from './import-cible.js';
import { lirePageIndex } from '../domain/index-livre.js';
import { preparerImageAppelIndex, executerAppelsIndex } from '../domain/index-lecture.js';
import { preparerStockageIndex, reconstruireResultatIndex } from '../domain/index-stockage.js';
import { preparerTransfertSources } from '../domain/transferts-source.js';
import { canoniqueSources, projectionIdentitePage, projectionAnnotationPage, projectionSessionSources, ErreurSources } from '../domain/sources-format.js';
import { capturerEdition } from './recette-garde.js';

const clone = x => structuredClone(x);
const fail = code => { throw new ErreurSources(code); };

export function creerLectureIndexCapturee({ repo, ctx, edition, session, page, serviceSources, captureSources,
  lire = lirePageIndex, fetch, maintenant = () => new Date().toISOString(), enLigne, battementMs, contexteEdition = null, estCourante = () => true } = {}) {
  const source = clone(page), seance = clone(session), livre = clone(edition);
  let enAttente = null;
  const identite = canoniqueSources(projectionIdentitePage(source)), annotation = canoniqueSources(projectionAnnotationPage(source)), sessionExacte = canoniqueSources(projectionSessionSources(seance));
  async function scope() {
    const s = await serviceSources.contexteMutationSources({ capture: captureSources });
    if (s.issue !== 'ok') fail(s.raison || 'owner_changed');
    return s;
  }
  function gardes(s,historique=false) {
    return { sync_state: s.internes.conditions.map(c=>({...c,fusion:current=>{
      if ((!historique&&!estCourante()) || repo.db !== s.options.baseAttendue || !s.options.contexteValide()) fail('owner_changed');return c.fusion(current);
    }})) };
  }
  const conditionsLecture = {
    source_pages: [{ key: source.id, fusion: current => {
      if (!current || canoniqueSources(projectionIdentitePage(current)) !== identite || canoniqueSources(projectionAnnotationPage(current)) !== annotation) fail('source_changed'); return null;
    } }],
    scan_sessions: [{ key: seance.id, fusion: current => {
      if (!current || canoniqueSources(projectionSessionSources(current)) !== sessionExacte) fail('session_changed'); return null;
    } }],
  };
  async function ecrireReception(reception) {
    const s = await scope(), { base, stockage, protectionsHistoriques } = reception;
    const exact = canoniqueSources(base), conditions = { ...protectionsHistoriques.conditions, ...gardes(s,true), imports: [{ key: base.id, fusion: current => {
      if (!current || canoniqueSources(current) !== exact) fail('result_changed'); return null;
    } }] };
    if (!stockage.fragments.length) {
      const {imports,...autres}=conditions;
      await repo.transitionner('imports', base.id, { ...protectionsHistoriques, conditions:autres, attendus: ['en_cours'], patch:current=>{imports[0].fusion(current);return reception.patch;} });
    } else {
      const transfert = await preparerTransfertSources({ purpose: 'index_result', owner_id: s.portee.owner_id, target: stockage.journal,
        rows: stockage.fragments.map(data => ({ store: 'imports', id: data.id, data })), baseTarget: base, edition_id: livre.id,
        base_edition_cycle_id: base.expected_edition_cycle_id ?? null, requested_at: maintenant() });
      const {sync_state,...metierConditions}=conditions;
      await repo.muterSources({ metier: { puts: { imports: [...stockage.fragments, transfert.cible] }, conditions:metierConditions,
        editions: protectionsHistoriques.editions, recettes: [] }, internes: { conditions: sync_state }, commandes: transfert.commandes }, s.options);
    }
    enAttente = null;
  }
  async function lireCapture({ series_id, appels = [], signal } = {}) {
    if(appels.some(r=>r.index_call?.series_id===series_id&&(r.source_capture?.source_state_revision??null)!==(seance.source_state?.revision??null)))return{issue:'interrompu',raison:'capture_changee',appels:clone(appels)};
    const s = await scope(), editionCapturee = contexteEdition || await capturerEdition(repo, livre, { ctx });
    const file = await repo.getFile(source.sha256);
    if (!(file?.blob instanceof Blob)) return { issue: 'interrompu', raison: 'octets_absents', appels };
    const importsExacts=await repo.all('imports');
    const logique = await Promise.all(appels.map(async row => ({ ...clone(row), resultat: await reconstruireResultatIndex({ journal: row, imports: importsExacts }) })));
    return executerAppelsIndex({ page_id: source.id, series_id, appels: logique, signal, estCourante,
      effectuer: async ({ kind, parent_call_id, precedent, signal: abandon }) => {
        const preparation = await preparerImageAppelIndex({ page: source, session: seance, blob: file.blob, kind });
        const index_call = { format: 1, series_id, page_id: source.id, kind, parent_call_id };
        const importId = precedent?.id ?? null;
        const r = await lancerVol(importId, async ({ provider, images, signal }) => {
          const reply = await lire(provider, images[0], { signal, moitie: kind === 'full' ? null : kind === 'left_half' ? 'gauche' : 'droite' });
          return { resultat: { format: 2, pages: [{ ...reply.page, page_id: source.id, etat: 'lue', modele: reply.modele ?? null, moities: 0 }] }, texteBrut: reply.texteBrut, modele: reply.modele };
        }, { ctx, repo, fetch, maintenant, enLigne, battementMs, signal: abandon, contexteEdition: editionCapturee,
          conditionsLecture:{...conditionsLecture,...gardes(s)}, conditionsHistoriqueLecture: gardes(s,true), preparer: async () => ({ images: [preparation.image], pageIds: [source.id] }),
          lecture: { kind: 'index', importId, pageIds: [source.id], editionId: livre.id, sessionId: seance.id, cle: precedent ? cleLecture(precedent) : null,
            indexLecture: { source_capture: preparation.capture, index_call } },
          conserverReponse: async ({ importId: id, patch, protectionsHistoriques }) => {
            const base = await repo.get('imports', id);
            if (base?.status !== 'en_cours') fail('result_changed');
            // Dès le retour du fournisseur, la copie exacte reste récupérable même si le stockage refuse.
            enAttente = { base, patch: clone(patch), protectionsHistoriques, stockage: null };
            enAttente.stockage = await preparerStockageIndex({ journal: { ...base, ...patch }, resultat: patch.resultat });
            await ecrireReception(enAttente);
          },
        });
        const id = r.importId ?? importId;
        let journal = id ? await repo.get('imports', id) : null;
        if (r.issue === 'conservation_echec' && enAttente) journal = { ...enAttente.base, ...enAttente.patch };
        else if (journal?.index_storage) journal = { ...journal, resultat: await reconstruireResultatIndex({ journal, imports: await repo.all('imports') }) };
        return { ...r, journal };
      },
      conserver: async result => { if (result.issue === 'conservation_echec') throw result.raison === 'quota' ? new DOMException('plein', 'QuotaExceededError') : Error('conservation'); },
    });
  }
  return {
    lire: async options => { try { return await lireCapture(options); } catch (e) { return { issue: 'interrompu', raison: e.code || e.raison || 'ecriture' }; } },
    reponseNonConservee: () => enAttente ? clone(enAttente.patch.resultat) : null,
    reessayerConservation: async () => {
      if (!enAttente) return { issue: 'absente' };
      try {
        if (!enAttente.stockage) enAttente.stockage = await preparerStockageIndex({ journal: { ...enAttente.base, ...enAttente.patch }, resultat: enAttente.patch.resultat });
        await ecrireReception(enAttente); return { issue: 'conserve' };
      } catch (e) { return { issue: 'conservation_echec', raison: e?.name === 'QuotaExceededError' ? 'quota' : e.code || 'ecriture' }; }
    },
  };
}
