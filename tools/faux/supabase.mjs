// Faux module « @supabase/supabase-js » pour tools/assistant-index.test.mjs : aucun reseau, aucune dependance.
// Le test remplace l'import nu d'index.ts par l'adresse de CE fichier ; il pilote ce que rendent getUser et rpc.
export const registre = [];       // un enregistrement par createClient : { url, key, opts }
export const RPC = [];            // chaque appel rpc : { nom, args, cle } (cle = celle du client qui l'a appele)
export const MAJ = [];            // chaque update('assistant_journal') : { table, v, c, id }
export const evenements = [];     // ordre reel des appels sortants : 'rpc:<nom>', 'update', et 'fetch' (pose par le test)
export const REPONSES = {
  getUser: async () => ({ data: { user: { id: 'compte-1' } }, error: null }),
  rpc: async () => ({ data: null, error: null }),
};
export function createClient(url, key, opts) {
  // Le vrai createClient leve quand l'adresse manque : index.ts doit alors repondre 502 AVEC les en-tetes CORS.
  if (!url) throw new Error('supabaseUrl is required.');
  registre.push({ url, key, opts });
  return {
    auth: { getUser: async (jeton) => REPONSES.getUser(jeton) },
    rpc: async (nom, args) => { RPC.push({ nom, args, cle: key }); evenements.push('rpc:' + nom); return REPONSES.rpc(nom, args, key); },
    from: (table) => ({ update: (v) => ({ eq: async (c, id) => { MAJ.push({ table, v, c, id }); evenements.push('update'); return { error: null }; } }) }),
  };
}
