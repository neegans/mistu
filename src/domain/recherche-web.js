// Chercher sur le web avec l'assistant (spec docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md, § 4).
// Pur, sauf l'appel réseau de chercherRecettesWeb (tâche 4). Un lien n'existe que s'il est dans les RÉSULTATS BRUTS du
// serveur (I-A) ; le texte de l'assistant ne donne que « pourquoi », borné (I-H) ; rien de l'API n'est recopié dans
// l'issue (I-C) ; aucune fonction ne lève vers l'appelant.
import { parseJsonLoose, ANTHROPIC_MESSAGES_URL, anthropicHeaders } from './llm.js';
import { lienSignet } from '../core/lien.js';
import { borner, lireBornee, signalDelai, OPTIONS_FETCH } from '../core/bornes.js';
import { logError } from '../core/log.js';

export const LIMITES_WEB = { demande: 500, filtre: 80, filtres: 12, titre: 300, date: 40, pourquoi: 200, liens: 5, recherches: 3, tentativeMs: 45000, corps: 2 * 1024 * 1024, corpsErreur: 64 * 1024 };
export const OUTIL_RECHERCHE = 'web_search_20250305';

// Le system par langue (§ 4.1). Il cherche TOUJOURS, n'affirme JAMAIS une restriction (I-K), répond en JSON `choix`.
const SYSTEM = {
  fr: [
    'Tu trouves des pages de recettes sur le web pour Cuisine OS, une bibliothèque de recettes personnelle.',
    'Cherche TOUJOURS sur le web avec l’outil web_search (1 à 3 recherches), même si tu crois connaître des recettes.',
    'Préfère les pages de recettes complètes ; en français du Québec d’abord.',
    'N’affirme JAMAIS qu’une page respecte une restriction alimentaire ou une durée : dis seulement ce que la page annonce.',
    'Puis réponds UNIQUEMENT par un objet JSON de cette forme : {"choix":[{"url":"…","pourquoi":"…"}]}',
    '— 5 entrées au plus ; chaque url est l’adresse EXACTE d’une page trouvée par la recherche ; n’invente ni page ni adresse ;',
    'pourquoi = une phrase courte qui relie la page à la demande.',
  ].join('\n'),
  en: [
    'You find recipe pages on the web for Cuisine OS, a personal recipe library.',
    'ALWAYS search the web with the web_search tool (1 to 3 searches), even if you think you know recipes.',
    'Prefer complete recipe pages.',
    'NEVER claim that a page meets a dietary restriction or a duration: only say what the page announces.',
    'Then answer ONLY with a JSON object of this shape: {"choix":[{"url":"…","pourquoi":"…"}]}',
    '— at most 5 entries; each url is the EXACT address of a page found by the search; never invent a page or an address;',
    'pourquoi = one short sentence linking the page to the request.',
  ].join('\n'),
};

export function construireDemande(args) {
  const { q, filtres, langue } = args ?? {}; // null ne lève pas (même garde que chercherRecettesWeb)
  const demande = borner(q, LIMITES_WEB.demande).trim();
  const propres = (Array.isArray(filtres) ? filtres : []).map((f) => borner(f, LIMITES_WEB.filtre).trim()).filter(Boolean).slice(0, LIMITES_WEB.filtres);
  const lang = langue === 'fr' ? 'fr' : 'en';
  if (!demande) return { system: null, user: null, cle: null, q: '', filtres: [] };
  const user = propres.length ? `${demande}\n${lang === 'fr' ? 'Contraintes' : 'Constraints'} : ${propres.join(' ; ')}` : demande;
  // q et filtres rendus = NETTOYÉS : l'écran rappelle ce qui est parti, jamais la saisie brute (I-J, R-WEB-1).
  return { system: SYSTEM[lang], user, cle: JSON.stringify([demande, propres, lang]), q: demande, filtres: propres };
}

export function corpsRequete({ cfg, demande, fuseau } = {}) {
  const user_location = { type: 'approximate', country: 'CA' };
  if (typeof fuseau === 'string' && fuseau) user_location.timezone = fuseau;
  return {
    model: cfg.model, max_tokens: 4096, system: demande.system,
    messages: [{ role: 'user', content: demande.user }],
    tools: [{ type: OUTIL_RECHERCHE, name: 'web_search', max_uses: LIMITES_WEB.recherches, user_location }],
  };
}

// § 4.3 : la liste brute des pages (dédoublonnée par href exact — deux adresses différentes sont deux pages), les
// erreurs d'outil, le texte recollé SANS séparateur (les citations coupent une chaîne JSON au milieu — F7), le
// stop_reason et le compte de recherches. Toute forme hostile est ignorée, jamais levée.
export function lireReponse(json) {
  const vide = { resultats: [], erreursOutil: [], aCherche: false, texte: '', stopReason: null, recherches: null };
  if (!json || typeof json !== 'object' || !Array.isArray(json.content)) return vide;
  const vus = new Set(); const resultats = []; const erreursOutil = []; let aCherche = false; let texte = '';
  for (const bloc of json.content) {
    if (!bloc || typeof bloc !== 'object') continue;
    if (bloc.type === 'text') { if (typeof bloc.text === 'string') texte += bloc.text; continue; }
    if (bloc.type === 'server_tool_use') { aCherche = true; continue; }
    if (bloc.type !== 'web_search_tool_result') continue;
    aCherche = true;
    const contenu = bloc.content;
    if (Array.isArray(contenu)) {
      for (const r of contenu) {
        if (!r || typeof r !== 'object' || r.type !== 'web_search_result' || typeof r.url !== 'string' || !r.url) continue;
        const lien = lienSignet(r.url);
        if (!lien.ok || vus.has(lien.href)) continue;
        vus.add(lien.href);
        const date = typeof r.page_age === 'string' ? borner(r.page_age, LIMITES_WEB.date).trim() : '';
        resultats.push({ href: lien.href, hote: lien.hote, titre: borner(r.title, LIMITES_WEB.titre).trim(), date: date || null });
      }
    } else if (contenu && typeof contenu === 'object' && typeof contenu.error_code === 'string') {
      erreursOutil.push(contenu.error_code);
    }
  }
  const n = json.usage?.server_tool_use?.web_search_requests;
  return { resultats, erreursOutil, aCherche, texte, stopReason: typeof json.stop_reason === 'string' ? json.stop_reason : null, recherches: Number.isInteger(n) && n >= 0 ? n : null };
}

// Confort après preuve (17 octobre) : `page_age` arrive brut (« 654 days ago », parfois « April 30, 2025 ») et lireReponse
// le garde tel quel, borné. L'écran ne le montre que s'il se lit comme une date, mis en forme dans la langue demandée ;
// sinon (relatif, vide, pas une chaîne) → null, et la date est masquée. Pure, ne lève pas.
export function dateLisible(texte, langue) {
  if (typeof texte !== 'string' || !texte) return null;
  const ms = Date.parse(texte);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-CA' : 'fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ms));
}

// § 4.4 : les choix de l'assistant ne SURVIVENT que s'ils désignent exactement un résultat (I-A) ; titre, hôte et
// date viennent du résultat. PAS de complément automatique (K2) : les résultats non choisis vont dans `autres`, que
// l'écran replie. repli = aucun choix n'a survécu : `liens` = les premiers résultats tels quels.
export function choisirLiens(lu, { max = LIMITES_WEB.liens } = {}) {
  const resultats = Array.isArray(lu?.resultats) ? lu.resultats : [];
  const parHref = new Map(resultats.map((r) => [r.href, r]));
  const liens = []; const pris = new Set();
  let choix = null;
  try { const data = parseJsonLoose(lu?.texte); choix = Array.isArray(data?.choix) ? data.choix : null; } catch { choix = null; }
  for (const c of choix || []) {
    if (liens.length >= max) break;
    if (!c || typeof c !== 'object' || typeof c.url !== 'string') continue;
    const lien = lienSignet(c.url);
    if (!lien.ok || !parHref.has(lien.href) || pris.has(lien.href)) continue;
    pris.add(lien.href);
    const pourquoi = borner(c.pourquoi, LIMITES_WEB.pourquoi).trim();
    liens.push({ ...parHref.get(lien.href), pourquoi: pourquoi || null });
  }
  const repli = liens.length === 0;
  if (repli) for (const r of resultats) { if (liens.length >= max) break; pris.add(r.href); liens.push({ ...r, pourquoi: null }); }
  const autres = resultats.filter((r) => !pris.has(r.href)).map((r) => ({ ...r, pourquoi: null }));
  const nommer = (l) => ({ ...l, titre: l.titre || l.hote });
  return { liens: liens.map(nommer), autres: autres.map(nommer), repli };
}

function fuseauAppareil() {
  try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; return typeof z === 'string' ? z : ''; } catch { return ''; }
}

// Un 400 peut dire « recherche web non activée sur ce compte » (S12) : lu dans error.message du JSON BORNÉ, jamais
// recopié. Toute autre forme → false (le 400 reste `requete`).
async function rechercheDesactivee(r, max) {
  try {
    const morceaux = await lireBornee(r, max);
    if (morceaux === null) return false;
    const texte = morceaux === false ? await r.text() : await new Blob(morceaux).text();
    if (typeof texte !== 'string' || texte.length > max) return false;
    const msg = String(JSON.parse(texte)?.error?.message ?? '').toLowerCase();
    return /web.?search/.test(msg) && /not enabled|disabled/.test(msg);
  } catch { return false; }
}

// § 4.5 : UN appel, délai et abandon extérieur combinés, classement dans l'ordre du tableau de la spec. Ne lève jamais :
// toute exception inattendue devient `interne` (journal sans aucun champ de cfg — S10/F12).
export async function chercherRecettesWeb(args, deps = {}) {
  let cfg = null;                                           // lu par `issue` ; affecté DANS le try (args peut être null)
  const issue = (etat, raison = null, extra = {}) => ({ etat, raison, liens: [], autres: [], repli: false, recherches: null, modele: typeof cfg?.model === 'string' ? cfg.model : null, ...extra });
  try {
    const { q, filtres, langue, cfg: cfgRecue } = args ?? {};
    cfg = cfgRecue;
    if (!cfg || typeof cfg !== 'object' || !cfg.provider || cfg.provider === 'none' || !cfg.api_key || !cfg.model) return issue('non_configure');
    if (cfg.provider !== 'anthropic') return issue('non_pris_en_charge');
    // Une clé collée avec un caractère invisible ou hors ASCII ferait lever fetch (« ByteString ») avant tout réseau : c'est une clé refusée, pas une panne.
    if (!/^[\x21-\x7e]+$/.test(cfg.api_key)) return issue('indisponible', 'cle_refusee');
    const demande = construireDemande({ q, filtres, langue });
    if (!demande.cle) return issue('indisponible', 'requete');
    const enLigne = deps.enLigne ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
    if (!enLigne()) return issue('indisponible', 'hors_ligne');
    if (deps.signal?.aborted) return issue('indisponible', 'annule');
    const f = deps.fetch ?? globalThis.fetch;                 // fonction LIBRE : jamais deps.fetch(...) (Illegal invocation)
    const corpsMax = deps.corpsMax ?? LIMITES_WEB.corps;
    const corpsErreurMax = deps.corpsErreurMax ?? LIMITES_WEB.corpsErreur;
    const fuseau = deps.fuseau ?? fuseauAppareil();
    const ctl = new AbortController();
    const delai = signalDelai(deps.tentativeMs ?? LIMITES_WEB.tentativeMs);
    const relaisDelai = () => ctl.abort();
    const relaisExterne = () => ctl.abort();
    if (delai.aborted) ctl.abort(); else delai.addEventListener('abort', relaisDelai, { once: true });
    deps.signal?.addEventListener('abort', relaisExterne, { once: true });
    const motifAbandon = () => (deps.signal?.aborted ? 'annule' : 'delai');
    try {
      // Le corps est calculé HORS du try du réseau : une exception ici est `interne` (filet), jamais `reseau`.
      const corps = JSON.stringify(corpsRequete({ cfg, demande, fuseau }));
      const entetes = anthropicHeaders(cfg.api_key);
      let r;
      try {
        // redirect: 'error' — l'en-tête x-api-key ne doit JAMAIS suivre une redirection vers un autre hôte (I-C).
        r = await f(ANTHROPIC_MESSAGES_URL, { ...OPTIONS_FETCH, method: 'POST', redirect: 'error', headers: entetes, body: corps, signal: ctl.signal });
      } catch { return issue('indisponible', ctl.signal.aborted ? motifAbandon() : 'reseau'); }
      if (!r || typeof r.status !== 'number') return issue('indisponible', 'interne');
      if (r.status === 401) return issue('indisponible', 'cle_refusee');
      if (r.status === 429) return issue('indisponible', 'trop_de_demandes');
      if (r.status === 400 || r.status === 403) {
        // Un 403 « recherche web non activée » est une fonction désactivée, pas une clé refusée : même lecture bornée que le 400.
        const desactivee = await rechercheDesactivee(r, corpsErreurMax);
        if (ctl.signal.aborted) return issue('indisponible', motifAbandon());   // abandon pendant la lecture du corps d'erreur
        if (desactivee) return issue('indisponible', 'recherche_desactivee');
        return issue('indisponible', r.status === 403 ? 'cle_refusee' : 'requete');
      }
      if (r.status >= 400 && r.status < 500) return issue('indisponible', 'requete');
      if (r.status >= 500) return issue('indisponible', 'serveur');
      // V-C6 : une réponse sans flux lisible NI text() n'est pas une panne réseau — c'est une forme impossible : interne.
      if (typeof r.text !== 'function' && !(r.body && typeof r.body.getReader === 'function')) return issue('indisponible', 'interne');
      let texte;
      try {
        const morceaux = await lireBornee(r, corpsMax);
        if (morceaux === null) return issue('indisponible', 'reponse_illisible');
        texte = morceaux === false ? await r.text() : await new Blob(morceaux).text();
      } catch { return issue('indisponible', ctl.signal.aborted ? motifAbandon() : 'reseau'); }
      if (typeof texte !== 'string' || texte.length > corpsMax) return issue('indisponible', 'reponse_illisible');
      let json;
      try { json = JSON.parse(texte); } catch { return issue('indisponible', 'reponse_illisible'); }
      if (!json || typeof json !== 'object' || !Array.isArray(json.content)) return issue('indisponible', 'reponse_illisible');
      const lu = lireReponse(json);
      const avec = { recherches: lu.recherches };
      if (lu.stopReason === 'refusal') return issue('indisponible', 'refus', avec);
      if (lu.resultats.length === 0) {
        if (lu.erreursOutil.includes('too_many_requests')) return issue('indisponible', 'trop_de_demandes', avec);
        if (lu.erreursOutil.length) return issue('indisponible', 'outil', avec);
        if (lu.stopReason === 'pause_turn' || lu.stopReason === 'max_tokens') return issue('indisponible', 'interrompu', avec);
        if (!lu.aCherche) return issue('indisponible', 'pas_cherche', avec);
        return issue('rien', null, avec);
      }
      const { liens, autres, repli } = choisirLiens(lu);
      return issue('trouve', null, { ...avec, liens, autres, repli });
    } finally {
      delai.removeEventListener('abort', relaisDelai);
      deps.signal?.removeEventListener('abort', relaisExterne);
      ctl.abort();                                            // libère le flux d'une sortie anticipée ; sans effet après une lecture complète
    }
  } catch (e) {
    logError('web_recherche', { reason: 'interne', error: e });
    return issue('indisponible', 'interne');
  }
}
