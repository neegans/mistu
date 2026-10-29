// Clôture volontaire d'une proposition, y compris illisible ou créée sur un ancien appareil.
// Aucun résultat appliqué : seule l'intention affichée est clôturée, sous garde de compte et de cycle.
import { lireCycleRecette } from './cycle-recette.js';
const OUVERTS = ['a_lancer', 'en_cours', 'a_verifier', 'echec'];
const erreur = code => Object.assign(new Error(code), { code, raison: code });
const canon = x => JSON.stringify(x, (_k, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const CHAMPS = ['id','kind','recipe_id','source_version_id','device_id','status','revision_brouillon','tentative_id','document_id_vol',
  'proposition_precedente','expected_cycle_id','owner_id','contexte','resultat','reponse_brute','questions','questions_tour_id','reponses_questions_id','version_id','started_at','finished_at','updated_at'];
const empreinte = row => canon(Object.fromEntries(CHAMPS.map(k => [k, row?.[k] ?? null])));
export async function ignorerPropositionImport(importId, { repo, contexteRecette = null, attendu = null, maintenant = () => new Date().toISOString() } = {}) {
  const row = await repo.get('imports', importId);
  if (!row || !['thermomix','reperes'].includes(row.kind) || !row.recipe_id || row.id !== importId) throw erreur('reprise_absente');
  const vue = attendu?.journal_attendu || attendu || row;
  if (empreinte(vue) !== empreinte(row)) throw erreur('reprise_modifiee');
  if (!OUVERTS.includes(row.status) && row.status !== 'ignore') throw erreur('reprise_modifiee');
  const recipe = await repo.get('recipes', row.recipe_id);
  const contexte = contexteRecette || await repo.capturerContexteRecette(recipe, { historique: true });
  if (contexte.recipe_id !== row.recipe_id) throw erreur('reprise_modifiee');
  if (Object.hasOwn(row,'owner_id') && row.owner_id !== contexte.owner_id) throw erreur('compte_change');
  let resultat;
  await repo.saveBatch({}, { recettes: [{ ...contexte, historique: true }], conditions: {
    recipes: [{key: row.recipe_id, fusion: current => {
      if (!current || lireCycleRecette(current).id !== contexte.expected_cycle_id) throw erreur('cycle_change');
      return null;
    }}],
    imports: [{key: importId, fusion: current => {
      if (!current || empreinte(current) !== empreinte(vue)) throw erreur('reprise_modifiee');
      if (current.status === 'ignore') { resultat = current; return null; }
      resultat = { ...current, status:'ignore', phase:'termine', tentative_id:null, document_id_vol:null,
        revision_brouillon:(Number.isSafeInteger(current.revision_brouillon) ? current.revision_brouillon : 0) + 1, finished_at:maintenant() };
      return resultat;
    }}],
  }});
  return resultat;
}
