// Le tableau d'une table des matières lue sur plusieurs photos (lot C, spec docs/superpowers/specs/2026-10-19-table-des-matieres-design.md, § 4.3,
// § 4.4) : creerReferences (sans DOM, testable seule) ; la séquence proposée des photos et le tableau d'entrées arrivent aux tâches 3 et 4. Rendu PAR
// indexEntriesPanel (src/ui/import.js), qui reste la porte. Tout texte par t() avec son entrée en.js (MODULES_NEUFS) ; toute donnée du modèle en nœuds
// texte ; écritures par repo.transitionner seulement (I-C1). Aucun texte ne nomme le fournisseur ni la base.
import { toast as toastDom } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { TransitionRefusee } from '../core/db.js';
import * as repoModule from '../model/repo.js';
import { recalculer, planCreation, fabriquerReferences, revaliderResultatIndex, pageIndexee } from '../domain/table-matieres.js';
import { cleLecture } from './import-cible.js';

const horloge = () => new Date().toISOString();
const estRefus = (e) => e instanceof TransitionRefusee;
const liste = (v) => (Array.isArray(v) ? v : []);

// « Créer {n} références » (§ 4.4, D-C5, R-C-2, I-C7, I-C11) : l'édition RELUE, la ligne RELUE (la même lecture : cleLecture, T4-R2), puis tout se lit dans
// la ligne RELUE (ronde 1 : cleLecture ne couvre pas page_ids, qu'« Appliquer cet ordre » réécrit) — son résultat REVALIDÉ (I-C2), les références existantes
// RELUES et un dernier recalculer (un autre onglet a pu créer entre-temps), les pages relues dans une Map, fabriquerReferences —, puis UNE transaction : la
// ligne a_verifier → enregistre (reponse_brute effacée, finished_at posé), les fiches neuves, et chaque page réécrite sur sa fiche RELUE DANS la transaction
// (condition de fusion, ronde 1 : une « p. imprimée », une position ou une réception arrivée depuis la relecture survit ; une page retirée n'est jamais
// ressuscitée, et si une fiche la cite, la transaction refuse : I-C11). Rend { issue: 'enregistre', n, doublons } | { issue: 'refuse' } (un autre chemin
// l'a enregistrée : rien d'écrit, le toast le dit) | { issue: 'sans_livre' } (l'écran le dit : sa phrase n'a pas d'entrée en.js, elle reste dans import.js)
// | { issue: 'illisible' } (résultat relu invalide : rien d'écrit, l'appelant relit) | { issue: 'change' } (T4-R2 du lot A : la ligne porte une autre
// lecture ou n'existe plus — relue avant, sans toast ; ou la clé, le statut ou une page citée a changé entre la relecture et l'écriture, vérifiés DANS la
// transaction : « Les références n’ont pas pu être créées. Réessaie. », décision 4 de la ronde 1 de T6 — rien d'écrit, l'appelant relit).
export async function creerReferences(ligne, lignes, { repo = repoModule, ctx = null, editionId = null, toast = toastDom, maintenant = horloge } = {}) {
  void ctx; // gardé dans la signature (spec § 4.4) : les relectures se font dans la base, jamais dans le contexte du rendu
  const edId = editionId || ligne?.edition_id || null;
  const edition = edId ? await repo.get('book_editions', edId) : null;
  if (!edition) return { issue: 'sans_livre' };
  const lue = ligne?.id ? await repo.get('imports', ligne.id) : null;
  if (lue?.status === 'enregistre') { toast(t('La lecture a déjà été enregistrée.')); return { issue: 'refuse' }; }
  const cle = cleLecture(ligne);
  if (!lue || cleLecture(lue) !== cle) return { issue: 'change' };
  const resultat = revaliderResultatIndex(lue.resultat, lue.page_ids);
  if (!resultat) return { issue: 'illisible' };
  const existantes = await repo.byIndex('recipes', 'edition_id', edition.id);
  const plan = planCreation(recalculer(liste(lignes), existantes));
  const ids = [...new Set([...resultat.photos.map((p) => p.page_id), ...liste(lue.page_ids)].filter((id) => typeof id === 'string'))];
  const pagesParId = new Map();
  for (const id of ids) { const p = await repo.get('source_pages', id); if (p) pagesParId.set(id, p); }
  const { recipes, pageUpdates } = fabriquerReferences(plan, { edition, pagesParId, resultat, pageIdsLigne: lue.page_ids, newId: repo.newId });
  const plages = new Map(pageUpdates.map((p) => [p.id, p.printed_page_range]));
  const citees = new Set(recipes.flatMap((r) => [r.index_page_id, ...liste(r.source_page_ids)]).filter((id) => typeof id === 'string'));
  const pages = [...new Set([...plages.keys(), ...citees])].map((id) => ({ key: id, fusion: (courant) => {
    if (!courant) { if (citees.has(id)) throw new TransitionRefusee('source_pages', id, null); return null; } // I-C11 : jamais une fiche vers une page absente
    return plages.has(id) ? pageIndexee(courant, plages.get(id)) : null; // citée sans plage à poser : vérifiée seulement
  } }));
  const fin = maintenant();
  const cloture = (c) => { if (cleLecture(c) !== cle) throw new TransitionRefusee('imports', ligne.id, c.status); return { status: 'enregistre', reponse_brute: null, finished_at: fin }; };
  try {
    await repo.transitionner('imports', ligne.id, { attendus: ['a_verifier'], patch: cloture, puts: { recipes }, conditions: pages.length ? { source_pages: pages } : {} });
  } catch (e) {
    if (!estRefus(e)) throw e;
    if ((await repo.get('imports', ligne.id))?.status === 'enregistre') { toast(t('La lecture a déjà été enregistrée.')); return { issue: 'refuse' }; }
    toast(t('Les références n’ont pas pu être créées. Réessaie.'));
    return { issue: 'change' };
  }
  const doublons = plan.ecartees.dejaReperees + plan.ecartees.enDouble;
  toast(t('{n} référence(s) créée(s){d}', { n: recipes.length, d: doublons ? `, ${t('{n} doublon(s) ignoré(s)', { n: doublons })}` : '' }));
  return { issue: 'enregistre', n: recipes.length, doublons };
}
