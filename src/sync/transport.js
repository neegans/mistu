// Le seul module qui parle au serveur (spec § 5.3, § 5.5). Deux appels : sync_push (RPC) et la lecture d'une table
// par server_seq. Les erreurs sont CLASSÉES ici (type + statut + message pour le journal), jamais rendues brutes à
// l'interface. Dans les tests, ce module est remplacé par tests/transport-factice.js : aucun réseau.
const COLONNES = 'id,data,updated_at,deleted_at,server_seq';

// Classement d'une erreur de supabase-js / PostgREST en cinq types que le moteur sait traiter.
//   reseau  : réessai avec recul (échec réseau, 5xx, 429)
//   auth    : attente de connexion, garde à refaire (401, 403, « adresse non autorisée »)
//   quota   : pause (413, 507, message « exceeded ») — rien n'est perdu
//   refus   : lot entier refusé par une règle du serveur (4xx autre) — dichotomie, seul chemin qui parque une fiche
//   inconnu : journalisé, traité comme un échec passager — recul (R-L3-9), jamais de quarantaine
export function classerErreur({ status = null, code = null, message = '' } = {}) {
  const s = Number.isFinite(status) ? status : null;
  const m = String(message || '');
  const basse = m.toLowerCase();
  let type = 'inconnu';
  // 507 sort de la famille 5xx : « Insufficient Storage » n'est pas une panne passagère à réessayer avec recul,
  // c'est une place qui manque — le moteur met en pause (rien n'est perdu) au lieu de cogner à la porte.
  if (s === null || s === 0 || s === 429 || (s >= 500 && s !== 507)) type = 'reseau';
  else if (s === 401 || s === 403 || basse.includes('adresse non autoris')) type = 'auth';
  else if (s === 413 || s === 507 || basse.includes('exceeded')) type = 'quota';
  else if (s >= 400 && s < 500 && s !== 404) type = 'refus';
  // Le message est gardé pour le JOURNAL (code seul à l'écran) : tronqué, jamais un objet.
  return { type, status: s, message: m.slice(0, 200), code: code ? String(code) : null };
}

const SANS_CLIENT = () => ({ type: 'auth', status: null, message: 'client absent', code: null });

export function createTransport(client) {
  return {
    async capacites() {
      if (!client) return {capacites:null,erreur:SANS_CLIENT()};
      try {const {data,error,status}=await client.rpc('sync_capabilities');return error?{capacites:null,erreur:{...classerErreur({status,code:error.code,message:error.message}),type:['PGRST202','42883'].includes(error.code)?'incompatible':classerErreur({status,code:error.code,message:error.message}).type}}:{capacites:data,erreur:null};}
      catch(error) {return {capacites:null,erreur:classerErreur({status:0,message:error?.message})};}
    },
    async pousser(rows) {
      if (!client) return { reponse: null, erreur: SANS_CLIENT() };
      try {
        const v2=rows.some(r=>['lifecycle','source_batch','source_revision','index_apply','source_transfer','translation_apply','cooking_apply'].includes(r.op)||Object.hasOwn(r,'expected_cycle_id')||r.recipe_contexts||r.edition_contexts||r.archive_import);
        const { data, error, status } = await client.rpc(v2?'sync_push_v2':'sync_push', { rows });
        if(error&&v2&&['PGRST202','42883'].includes(error.code)) return {reponse:null,erreur:{type:'incompatible',status,code:error.code,message:'Contrat de corbeille indisponible'}};
        if (error) return { reponse: null, erreur: classerErreur({ status, code: error.code, message: error.message }) };
        return { reponse: data, erreur: null };
      } catch (error) {
        return { reponse: null, erreur: classerErreur({ status: 0, message: error?.message }) };
      }
    },
    async lire(table, apres, limite = 1000) {
      if (!client) return { lignes: null, erreur: SANS_CLIENT() };
      try {
        const { data, error, status } = await client.from(table).select(COLONNES).gt('server_seq', apres).order('server_seq', { ascending: true }).limit(limite);
        if (error) return { lignes: null, erreur: classerErreur({ status, code: error.code, message: error.message }) };
        return { lignes: Array.isArray(data) ? data : [], erreur: null };
      } catch (error) {
        return { lignes: null, erreur: classerErreur({ status: 0, message: error?.message }) };
      }
    },
  };
}

// Lot G (§ 6, D-G9) : le client Storage, INJECTÉ — seul module qui tient client.storage, comme pour sync_push. Trois appels, sur le seau privé
// `pages` : upload (upsert explicite), download, list. Jamais d'URL publique ni signée, jamais de suppression (L5). Chaque erreur est classée
// par classerErreur, puis statusCode et code de StorageApiError sont recopiés : « déjà présent » et « introuvable » ont deux formes chez le
// fournisseur (B-3), lues par dejaPresent et introuvable.
const SEAU = 'pages';
// Une erreur nommée ici (sans réponse du serveur), de la forme commune { type, status, statusCode, code, message } ; neuve à chaque appel.
export const erreurNommee = (type, message) => ({ type, status: null, statusCode: null, code: null, message });
// Ronde 1 (B-3) : storage-api enveloppe souvent le vrai code sous un HTTP 400 — StorageApiError porte alors status 400 et statusCode = celui du
// corps (« 403 » d'un refus RLS, « 544 » d'une base lente…). Sous un 400, un statusCode à trois chiffres est le statut qui CLASSE (401/403 →
// auth, 413 → quota, 429 et ≥ 500 → reseau, autre 4xx → refus) ; le statut HTTP est recopié tel quel. Les codes InvalidJWT et AccessDenied
// valent auth quelle que soit la forme. « Déjà présent » et « introuvable » restent lus AVANT le type (dejaPresent, introuvable). La forme
// réelle de mitsu n'est pas mesurée (spec § 10, geste 7) : ce classement suit le vendor 2.117.3 et storage-api, connus de lecture.
const CODES_AUTH = ['InvalidJWT', 'AccessDenied'];
function erreurStockage(e) {
  const status = Number.isFinite(e?.status) ? e.status : null;
  const statusCode = e?.statusCode != null ? String(e.statusCode) : null;
  const code = e?.code != null ? String(e.code) : null;
  const classant = status === 400 && /^[1-5]\d\d$/.test(statusCode ?? '') ? Number(statusCode) : status;
  const classee = classerErreur({ status: classant, code, message: e?.message ?? '' });
  return { type: CODES_AUTH.includes(code) ? 'auth' : classee.type, status, statusCode, code, message: classee.message };
}

export function createStockage(client) {
  const seau = () => client?.storage?.from?.(SEAU) ?? null;
  const sansSeau = () => erreurNommee('auth', 'client absent');
  return {
    async envoyer(chemin, blob, { upsert = false } = {}) {
      const s = seau();
      if (!s) return { erreur: sansSeau() };
      try {
        const { error } = await s.upload(chemin, blob, { upsert: upsert === true }); // le type part comme blob.type (S-2)
        return { erreur: error ? erreurStockage(error) : null };
      } catch (error) { return { erreur: erreurStockage({ status: 0, message: error?.message }) }; }
    },
    async recevoir(chemin) {
      const s = seau();
      if (!s) return { blob: null, erreur: sansSeau() };
      try {
        const { data, error } = await s.download(chemin);
        if (error) return { blob: null, erreur: erreurStockage(error) };
        if (!(data instanceof Blob)) return { blob: null, erreur: erreurNommee('inconnu', 'corps absent') };
        return { blob: data, erreur: null };
      } catch (error) { return { blob: null, erreur: erreurStockage({ status: 0, message: error?.message }) }; }
    },
    async lister(prefixe, { limit = 100, offset = 0, search = '' } = {}) {
      const s = seau();
      if (!s) return { objets: [], erreur: sansSeau() };
      try {
        const { data, error } = await s.list(prefixe, { limit, offset, search, sortBy: { column: 'name', order: 'asc' } });
        if (error) return { objets: [], erreur: erreurStockage(error) };
        return { objets: Array.isArray(data) ? data : [], erreur: null };
      } catch (error) { return { objets: [], erreur: erreurStockage({ status: 0, message: error?.message }) }; }
    },
  };
}

// Testés AVANT le type (F-13 : classerErreur range un 404 en « inconnu », un 400 en « refus »).
export const dejaPresent = (e) => !!e && (e.statusCode === '409' || e.status === 409 || e.code === 'Duplicate');
export const introuvable = (e) => !!e && (e.statusCode === '404' || e.status === 404 || ['KeyNotFound', 'NoSuchKey', 'not_found'].includes(e.code));
