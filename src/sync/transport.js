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
    async pousser(rows) {
      if (!client) return { reponse: null, erreur: SANS_CLIENT() };
      try {
        const { data, error, status } = await client.rpc('sync_push', { rows });
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
