// La passerelle de l'assistant (spec docs/superpowers/specs/2026-10-18-passerelle-assistant-design.md, § 5). L'app n'appelle
// JAMAIS l'API du fournisseur d'IA : elle poste à la fonction `assistant` du projet Supabase, avec la SESSION de la personne
// (Authorization: Bearer <access_token>) et la clé PUBLIQUE du projet (apikey). La clé du fournisseur vit côté serveur seulement ;
// il n'y a plus aucune clé ici. Module PUR : `fetch`, la session et la configuration arrivent en paramètres, rien n'est lu
// ailleurs que `currentConfig()` par défaut, et AUCUNE fonction ne lève vers l'appelant.
//
// La session est une DONNÉE `{ access_token, user? } | null` (jamais le module d'auth, jamais le contexte d'un écran). Le jeton
// n'entre dans AUCUN objet rendu — ni résultat, ni journal, ni message d'erreur : il ne sert qu'à construire l'en-tête.
import { currentConfig } from '../sync/config.js';
import { OPTIONS_FETCH, lireBornee, signalDelai, borner } from '../core/bornes.js';

export const CHEMIN_ASSISTANT = '/functions/v1/assistant';
// Délai de repli d'un appel (les modules de domaine passent le leur), taille des corps lus : la réponse d'un succès, et celle
// d'une erreur (qui ne sert qu'à lire le champ `erreur` de la passerelle).
export const LIMITES_PASSERELLE = { tentativeMs: 120000, etatMs: 15000, corps: 2 * 1024 * 1024, corpsErreur: 64 * 1024, corpsEtat: 16 * 1024, modele: 80 };

// Le champ `erreur` d'une réponse de la passerelle (T2) ramené aux raisons connues de l'app (lu par Object.hasOwn : « constructor »
// n'est pas une raison). Une origine refusée est un 403 de plus (« non_admis ») ; une méthode ou des bornes refusées sont une
// requête refusée.
const RAISON_DE_ERREUR = { non_connecte: 'non_connecte', non_admis: 'non_admis', origine: 'non_admis', methode: 'requete', requete: 'requete', trop_lourd: 'trop_lourd', bornes: 'requete', quota: 'quota', serveur: 'serveur', delai: 'delai' };

export function urlAssistant(config = currentConfig()) {
  const base = typeof config?.url === 'string' ? config.url.replace(/\/+$/, '') : '';
  return base ? `${base}${CHEMIN_ASSISTANT}` : null;
}

// Une session utilisable : un jeton non vide fait de caractères ASCII visibles seulement. Un jeton avec une espace ou un
// caractère invisible ferait lever fetch (« ByteString ») avant tout réseau : ce n'est pas une session.
export function sessionValide(session) {
  const jeton = session?.access_token;
  return typeof jeton === 'string' && /^[\x21-\x7e]+$/.test(jeton);
}

const echec = (raison, statut = 0, quota = null, ecrite = false) => ({ statut, corps: null, raison, quota, ecrite });

// Le classement d'une réponse en erreur : le champ `erreur` de la passerelle quand elle l'a écrit, sinon le statut seul
// (R-T3-4). `ecrite` dit lequel des deux : vrai quand le corps portait un champ `erreur` de la passerelle. Un statut SANS champ
// `erreur` est celui d'Anthropic, relayé : un 429 y est « trop de demandes » (pas « limite du jour »), un 403 y est une panne
// de service (`serveur`) — jamais « compte non admis », que la passerelle écrit toujours elle-même (`non_admis`, `origine`).
function classerReponse(statut, corps) {
  const brut = corps && typeof corps === 'object' && !Array.isArray(corps) ? corps.erreur : undefined;
  const ecrite = typeof brut === 'string' && Object.hasOwn(RAISON_DE_ERREUR, brut) ? RAISON_DE_ERREUR[brut] : null;
  const raison = ecrite ?? (statut === 401 ? 'non_connecte' : statut === 429 ? 'quota' : statut === 413 ? 'trop_lourd'
    : statut === 504 ? 'delai' : statut >= 500 || statut < 400 || statut === 403 ? 'serveur' : 'requete');
  const n = ecrite === 'quota' && Number.isInteger(corps.quota) && corps.quota >= 0 ? corps.quota : null;
  return { raison, quota: n, ecrite: ecrite !== null };
}

// Un échange avec la fonction : POST (corps) ou GET (sans corps). Ne lève jamais ; toute exception inattendue est `interne`
// (le journal est tenu par l'appelant : aucun texte d'erreur ne sort d'ici). Aucun `await` avant le fetch : un abandon extérieur
// arrive donc toujours à un fetch déjà posé.
async function echanger({ methode, corps = null, fetch: f = globalThis.fetch, session, config, signal, tentativeMs, corpsMax, corpsErreurMax }) {
  try {
    if (!sessionValide(session)) return echec('non_connecte');
    const conf = config === undefined ? currentConfig() : config;
    const url = urlAssistant(conf);
    if (!url || typeof conf.anonKey !== 'string' || !conf.anonKey) return echec('non_connecte'); // pas de projet sur cette origine : aucune connexion possible
    if (signal?.aborted) return echec('annule');
    // En-têtes et options HORS du try du réseau : une exception ici est `interne`, jamais `reseau`.
    const entetes = { 'content-type': 'application/json', apikey: conf.anonKey, authorization: `Bearer ${session.access_token}` };
    const options = { ...OPTIONS_FETCH, method: methode, redirect: 'error', headers: entetes, ...(corps === null ? {} : { body: corps }) };
    const tmax = tentativeMs ?? LIMITES_PASSERELLE.tentativeMs;
    const cmax = corpsMax ?? LIMITES_PASSERELLE.corps;
    const emax = corpsErreurMax ?? LIMITES_PASSERELLE.corpsErreur;
    const ctl = new AbortController();
    const delai = signalDelai(tmax);
    const relaisDelai = () => ctl.abort();
    const relaisExterne = () => ctl.abort();
    if (delai.aborted) ctl.abort(); else delai.addEventListener('abort', relaisDelai, { once: true });
    signal?.addEventListener('abort', relaisExterne, { once: true });
    const motifAbandon = () => (signal?.aborted ? 'annule' : 'delai');
    try {
      let r;
      try { r = await f(url, { ...options, signal: ctl.signal }); } // fonction LIBRE : jamais deps.fetch(...) (Illegal invocation)
      catch { return echec(ctl.signal.aborted ? motifAbandon() : 'reseau'); }
      if (!r || typeof r.status !== 'number') return echec('interne');
      // Une réponse sans flux lisible NI text() n'est pas une panne réseau : c'est une forme impossible.
      if (typeof r.text !== 'function' && !(r.body && typeof r.body.getReader === 'function')) return echec('interne', r.status);
      const succes = r.status === 200;
      const borne = succes ? cmax : emax;
      let texte = null;
      try {
        const morceaux = await lireBornee(r, borne);
        if (morceaux !== null) texte = morceaux === false ? await r.text() : await new Blob(morceaux).text();
      } catch { return echec(ctl.signal.aborted ? motifAbandon() : 'reseau', r.status); }
      // Un fetch sourd au signal (ou une réponse déjà arrivée) ne rend jamais un résultat après un abandon extérieur.
      if (signal?.aborted) return echec('annule', r.status);
      if (texte !== null && (typeof texte !== 'string' || texte.length > borne)) texte = null;
      let json = null;
      if (texte !== null) { try { json = JSON.parse(texte); } catch { json = null; } }
      if (succes) {
        if (!json || typeof json !== 'object' || Array.isArray(json)) return echec('reponse_illisible', 200);
        return { statut: 200, corps: json, raison: null, quota: null, ecrite: false };
      }
      // Un corps d'erreur n'est JAMAIS relayé : seul son champ `erreur` (et le nombre du quota) classe l'échec.
      const { raison, quota, ecrite } = classerReponse(r.status, json);
      return echec(raison, r.status, quota, ecrite);
    } finally {
      delai.removeEventListener('abort', relaisDelai);
      signal?.removeEventListener('abort', relaisExterne);
      ctl.abort(); // libère le flux d'une sortie anticipée ; sans effet après une lecture complète
    }
  } catch {
    return echec('interne');
  }
}

// Le classement d'un échec de la passerelle en raison d'ISSUE des modules de domaine (R-T3-4) — UNE définition pour la recherche
// web et la création : non_connecte / non_admis / quota → issues homonymes (`quota` porte son nombre dans `extra`, `null` si la
// passerelle ne l'a pas donné) ; un 429 que la passerelle n'a pas écrit (`ecrite` faux : Anthropic relayé) → trop_de_demandes ;
// 413 → requete avec `trop_lourd: true` (texte à part) ; 400, 422 → requete ; 502, 503 et un 403 relayé → serveur ; 504 et délai
// local → delai ; abandon → annule ; réseau coupé → reseau.
export function echecDomaine({ raison, quota = null, ecrite = false } = {}) {
  if (raison === 'quota') return ecrite ? { raison: 'quota', extra: { quota } } : { raison: 'trop_de_demandes', extra: {} };
  if (raison === 'trop_lourd') return { raison: 'requete', extra: { trop_lourd: true } };
  if (['non_connecte', 'non_admis', 'requete', 'serveur', 'delai', 'reseau', 'annule', 'reponse_illisible'].includes(raison)) return { raison, extra: {} };
  return { raison: 'interne', extra: {} };
}

// POST { outil, corps } → { statut, corps, raison, quota, ecrite }.
//   raison ∈ non_connecte | non_admis | quota | requete | trop_lourd | delai | serveur | reseau | reponse_illisible | annule | interne | null
//   (null = 200, `corps` = le JSON de la réponse). `quota` = le nombre du quota du jour quand la passerelle l'a écrit, sinon null ;
//   `ecrite` = le corps d'erreur portait un champ `erreur` écrit par la passerelle (faux : erreur d'Anthropic relayée, ou pas de corps).
export async function appelerAssistant(outil, corps, { fetch, session, config, signal, tentativeMs, corpsMax, corpsErreurMax } = {}) {
  let envoi;
  try { envoi = JSON.stringify({ outil, corps }); } catch { return echec('interne'); } // calculé hors du réseau : jamais `reseau`
  return echanger({ methode: 'POST', corps: envoi, fetch, session, config, signal, tentativeMs, corpsMax, corpsErreurMax });
}

// GET → { statut, corps: { modele, quotaJour } | null, raison, quota, ecrite } : l'état de l'assistant, sans appeler le fournisseur
// (Réglages, sondes). Mêmes en-têtes, mêmes options réseau ; le corps rendu est reconstruit, jamais recopié. `ecrite` comme pour
// appelerAssistant : vrai quand le corps d'erreur portait un champ `erreur` de la passerelle (toujours faux sur un 200).
export async function etatAssistant({ fetch, session, config, signal, tentativeMs } = {}) {
  const r = await echanger({ methode: 'GET', fetch, session, config, signal, tentativeMs: tentativeMs ?? LIMITES_PASSERELLE.etatMs, corpsMax: LIMITES_PASSERELLE.corpsEtat });
  if (r.raison) return r;
  const c = r.corps;
  return {
    statut: 200, raison: null, quota: null, ecrite: false,
    corps: { modele: typeof c.modele === 'string' ? borner(c.modele, LIMITES_PASSERELLE.modele) || null : null, quotaJour: Number.isInteger(c.quotaJour) && c.quotaJour >= 0 ? c.quotaJour : null },
  };
}
