// Chercher sur le web avec l'assistant (spec docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md, § 4).
// Pur, sauf l'appel réseau de chercherRecettesWeb, qui passe par la PASSERELLE (src/domain/passerelle.js) avec la session de la
// personne : aucune clé ici, jamais d'appel direct au fournisseur d'IA. Un lien n'existe que s'il est dans les RÉSULTATS BRUTS
// du serveur (I-A) ; le texte de l'assistant ne donne que la présentation du plat (bornée au mot) et trois repères typés — temps
// estimé, difficulté, nombre d'ingrédients (I-H) ; rien de la réponse n'est recopié dans l'issue hors ce qui est borné et
// nettoyé (I-C) ; aucune fonction ne lève vers l'appelant.
import { parseJsonLoose } from './llm.js';
import { appelerAssistant, echecDomaine, sessionValide, LIMITES_PASSERELLE } from './passerelle.js';
import { lienSignet } from '../core/lien.js';
import { borner, bornerAuMot } from '../core/bornes.js';
import { logError } from '../core/log.js';

export const LIMITES_WEB = { demande: 500, filtre: 80, filtres: 12, titre: 300, date: 40, presentation: 400, tempsMax: 1440, ingredientsMax: 99, liens: 5, recherches: 3, tentativeMs: 135000, corps: 2 * 1024 * 1024, corpsErreur: 64 * 1024 };
export const OUTIL_RECHERCHE = 'web_search_20250305';
export const DIFFICULTES = Object.freeze(['facile', 'moyen', 'exigeant']); // les trois jetons de difficulté, en français dans les deux langues
// Une adresse web dans une présentation (I2) : schéma, « www. » ou hôte suivi d'un chemin. La présentation est la voix de l'assistant,
// pas une source : une adresse n'y a pas sa place (les liens sont les résultats bruts, I-A). Testé sur le texte NFKC (pleine chasse).
// Lot B, ronde 1 de la tâche 3 : le départ hôte n'est tenté qu'au DÉBUT d'une suite de [a-z0-9-] (lookbehind) — mêmes verdicts (une correspondance
// au milieu d'une suite en a toujours une au début), mais linéaire : sans lui, une longue suite sans point coûtait un temps quadratique, payé à
// chaque ligne, étape et note d'une lecture web (src/domain/lecture-web.js), à chaque relecture.
export const MOTIF_ADRESSE = /(https?:\/\/|www\.|(?<![a-z0-9-])[a-z0-9-]+\.[a-z]{2,}\/)/iu;
// L'HÔTE NU (« la recette est sur evil.com ») : un nom de domaine dont le dernier segment est dans une liste FERMÉE de domaines de premier
// niveau, ni précédé d'une lettre, d'un chiffre, de « @ », « . », « _ » ou « - », ni suivi d'une lettre, d'un chiffre ou d'un tiret. Faux positif
// CONNU et assumé : « Le sel.Ca y est » (point collé et « ca ») est écarté ; « 15 min. Le », « aneth.Tu », « 2.0 » ne le sont pas.
export const MOTIF_HOTE = /(?<![\p{L}\p{N}@._-])[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:com|net|org|ca|quebec|fr|be|ch|io|co|info|app|blog|xyz|site|online|shop|me|tv|us|uk|ly|gl)(?![\p{L}\p{N}-])/iu;
// Le texte est normalisé POUR LE TEST seulement (NFKC, puis « 。 » U+3002 et « ｡ » U+FF61 → « . », « ∕ » U+2215 et « ⁄ » U+2044 → « / ») : le texte affiché
// n'est jamais modifié. Exportés (lot B) : la lecture d'une page web applique la même convention à son contenu (src/domain/lecture-web.js).
export const normaliserPourAdresse = (texte) => texte.normalize('NFKC').replace(/[\u{3002}\u{FF61}]/gu, '.').replace(/[\u{2215}\u{2044}]/gu, '/');
export function porteUneAdresse(texte) {
  const n = normaliserPourAdresse(texte);
  return MOTIF_ADRESSE.test(n) || MOTIF_HOTE.test(n);
}

// Le system par langue (§ 4.1). Il cherche TOUJOURS, n'affirme JAMAIS une restriction (I-K), répond en JSON `choix`.
const SYSTEM = {
  fr: [
    'Tu trouves des pages de recettes sur le web pour Cuisine OS, une bibliothèque de recettes personnelle.',
    'Cherche TOUJOURS sur le web avec l’outil web_search (1 à 3 recherches), même si tu crois connaître des recettes.',
    'Préfère les pages de recettes complètes ; en français du Québec d’abord.',
    'N’affirme JAMAIS qu’une page respecte une restriction alimentaire ou une durée : dis seulement ce que la page annonce.',
    'Puis réponds UNIQUEMENT par un objet JSON de cette forme : {"choix":[{"url":"…","presentation":"…","temps_min":15,"difficulte":"facile","ingredients":7}]}',
    '— 5 entrées au plus ; chaque url est l’adresse EXACTE d’une page trouvée par la recherche ; n’invente ni page ni adresse ;',
    'presentation = deux ou trois phrases, comme un serveur qui présente le plat à table, en tutoyant : les ingrédients principaux, ce qui fait son charme, et en dernière phrase le lien avec la demande ; le temps ou les portions seulement si la page les donne ; n’affirme jamais qu’elle respecte une restriction ou une durée, dis ce que la page annonce ; aucune adresse web dans le texte ; 400 caractères au plus ;',
    'temps_min = durée totale estimée en minutes (le chiffre de la page si elle en donne un) ; difficulte = "facile", "moyen" ou "exigeant" ; ingredients = nombre d’ingrédients de la page sans compter sel et poivre ; omets tout champ que tu ne peux pas établir.',
  ].join('\n'),
  en: [
    'You find recipe pages on the web for Cuisine OS, a personal recipe library.',
    'ALWAYS search the web with the web_search tool (1 to 3 searches), even if you think you know recipes.',
    'Prefer complete recipe pages.',
    'NEVER claim that a page meets a dietary restriction or a duration: only say what the page announces.',
    'Then answer ONLY with a JSON object of this shape: {"choix":[{"url":"…","presentation":"…","temps_min":15,"difficulte":"facile","ingredients":7}]}',
    '— at most 5 entries; each url is the EXACT address of a page found by the search; never invent a page or an address;',
    'presentation = two or three sentences, like a waiter presenting the dish at the table, addressing the reader as "you": the main ingredients, what makes it appealing, and in the last sentence the link with the request; time or servings only if the page gives them; never claim it meets a restriction or a duration, say what the page announces; no web address in the text; 400 characters at most;',
    'temps_min = estimated total time in minutes (the page’s figure if it gives one); difficulte = "facile", "moyen" or "exigeant" (keep these French tokens); ingredients = number of ingredients on the page, not counting salt and pepper; omit any field you cannot establish.',
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

// Le corps de l'outil « recherche-web » de la passerelle : SANS `model` (le serveur choisit le modèle).
export function corpsRequete({ demande, fuseau } = {}) {
  const user_location = { type: 'approximate', country: 'CA' };
  if (typeof fuseau === 'string' && fuseau) user_location.timezone = fuseau;
  return {
    max_tokens: 4096, system: demande.system,
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
// le garde tel quel, borné. L'écran ne le montre que sous une forme de LISTE BLANCHE (« rien d'inventé », rondes 1-2),
// SANS Date.parse (sa lecture des formes non ISO dépend du moteur et accepte « Mayhem 5, 2025 ») :
// « Mois jour, année » avec un mois de la liste FERMÉE ci-dessous (casse libre, point facultatif, année 1000-2999), ou la
// date ISO seule « 2025-04-30 » (même plage d'années). La date est construite en UTC et refusée si elle déborde (« Feb 30 », « Feb 29, 2025 »),
// puis rendue en UTC (jamais la veille). Tout le reste — relatif, jour absent, année seule, nombre, barres, RFC 1123,
// mois français, pas une chaîne — → null, et la date est masquée. Pure, ne lève pas.
const MOIS_ANGLAIS = new Map([
  ['january', 0], ['jan', 0], ['february', 1], ['feb', 1], ['march', 2], ['mar', 2], ['april', 3], ['apr', 3], ['may', 4],
  ['june', 5], ['jun', 5], ['july', 6], ['jul', 6], ['august', 7], ['aug', 7], ['september', 8], ['sep', 8], ['sept', 8],
  ['october', 9], ['oct', 9], ['november', 10], ['nov', 10], ['december', 11], ['dec', 11],
]);
function dateUtcLisible(annee, mois, jour, langue) { // mois : 0-11
  if (mois < 0 || mois > 11 || jour < 1 || jour > 31) return null;
  const d = new Date(Date.UTC(annee, mois, jour));
  if (d.getUTCFullYear() !== annee || d.getUTCMonth() !== mois || d.getUTCDate() !== jour) return null; // débord, ou année < 100 décalée en 19xx
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-CA' : 'fr-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d);
}
export function dateLisible(texte, langue) {
  if (typeof texte !== 'string') return null;
  const s = texte.trim();
  const mja = /^([a-z]+)\.? (\d{1,2}), ([12]\d{3})$/i.exec(s);
  if (mja) {
    const mois = MOIS_ANGLAIS.get(mja[1].toLowerCase());
    return mois === undefined ? null : dateUtcLisible(Number(mja[3]), mois, Number(mja[2]), langue);
  }
  const iso = /^([12]\d{3})-(\d{2})-(\d{2})$/.exec(s); // même plage d'années que la forme mois-jour-année (ronde 3)
  if (iso) return dateUtcLisible(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), langue);
  return null;
}

// § 4.4 : les choix de l'assistant ne SURVIVENT que s'ils désignent exactement un résultat (I-A) ; titre, hôte et
// date viennent du résultat. PAS de complément automatique (K2) : les résultats non choisis vont dans `autres`, que
// l'écran replie. repli = aucun choix n'a survécu : `liens` = les premiers résultats tels quels.
// Un choix vivant apporte, en plus, sa présentation et ses trois repères (présentation du serveur, 18 octobre) : lus PROPRES
// (Object.hasOwn, jamais la chaîne de prototype), typés et bornés champ par champ ; ce qui n'est pas lisible vaut null. Le repli
// et `autres` portent les quatre champs à null : rien de l'assistant n'y est présenté.
const SANS_FICHE = Object.freeze({ presentation: null, temps_min: null, difficulte: null, ingredients: null });
const propre = (o, cle) => (Object.hasOwn(o, cle) ? o[cle] : undefined);
const entierDe = (x, max) => (Number.isInteger(x) && x >= 1 && x <= max ? x : null);
export function ficheDe(c) {
  const p = propre(c, 'presentation');
  const d = propre(c, 'difficulte');
  const jeton = typeof d === 'string' ? d.trim().toLowerCase() : ''; // pas de String(d) : un objet à toString hostile lèverait
  const texte = typeof p === 'string' ? bornerAuMot(p, LIMITES_WEB.presentation) : '';
  return {
    presentation: texte && !porteUneAdresse(texte) ? texte : null,
    temps_min: entierDe(propre(c, 'temps_min'), LIMITES_WEB.tempsMax),
    difficulte: DIFFICULTES.includes(jeton) ? jeton : null,
    ingredients: entierDe(propre(c, 'ingredients'), LIMITES_WEB.ingredientsMax),
  };
}
// Lot B (D-B6) : les repères d'une CARTE de résultat (ses quatre champs, déjà lus par ficheDe mais revenus de la mémoire de l'écran) REVALIDÉS par
// ficheDe ; null si les quatre valent null. « Garder et lire » les garde sur le signet (web_reperes).
export function reperesDe(lien) {
  if (!lien || typeof lien !== 'object') return null;
  const f = ficheDe(lien);
  return f.presentation === null && f.temps_min === null && f.difficulte === null && f.ingredients === null ? null : f;
}
export function choisirLiens(lu, { max = LIMITES_WEB.liens } = {}) {
  const resultats = Array.isArray(lu?.resultats) ? lu.resultats : [];
  const parHref = new Map(resultats.map((r) => [r.href, r]));
  const liens = []; const pris = new Set();
  let choix = null;
  try { const data = parseJsonLoose(lu?.texte); choix = data && typeof data === 'object' && Object.hasOwn(data, 'choix') && Array.isArray(data.choix) ? data.choix : null; } catch { choix = null; }
  for (const c of choix || []) {
    if (liens.length >= max) break;
    if (!c || typeof c !== 'object') continue;
    const url = propre(c, 'url');
    if (typeof url !== 'string') continue;
    const lien = lienSignet(url);
    if (!lien.ok || !parHref.has(lien.href) || pris.has(lien.href)) continue;
    pris.add(lien.href);
    liens.push({ ...parHref.get(lien.href), ...ficheDe(c) });
  }
  const repli = liens.length === 0;
  if (repli) for (const r of resultats) { if (liens.length >= max) break; pris.add(r.href); liens.push({ ...r, ...SANS_FICHE }); }
  const autres = resultats.filter((r) => !pris.has(r.href)).map((r) => ({ ...r, ...SANS_FICHE }));
  const nommer = (l) => ({ ...l, titre: l.titre || l.hote });
  return { liens: liens.map(nommer), autres: autres.map(nommer), repli };
}

function fuseauAppareil() {
  try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; return typeof z === 'string' ? z : ''; } catch { return ''; }
}

// § 4.5 : UN appel, délai et abandon extérieur combinés (dans la passerelle). Ne lève jamais : toute exception inattendue devient
// `interne` (journal sans aucun champ de la session).
export async function chercherRecettesWeb(args, deps = {}) {
  let modele = null;                                        // porté par la RÉPONSE (json.model), connu seulement après elle
  const issue = (etat, raison = null, extra = {}) => ({ etat, raison, liens: [], autres: [], repli: false, recherches: null, modele, ...extra });
  try {
    const { q, filtres, langue, session } = args ?? {};
    if (!sessionValide(session)) return issue('indisponible', 'non_connecte');
    const demande = construireDemande({ q, filtres, langue });
    if (!demande.cle) return issue('indisponible', 'requete');
    const enLigne = deps.enLigne ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
    if (!enLigne()) return issue('indisponible', 'hors_ligne');
    if (deps.signal?.aborted) return issue('indisponible', 'annule');
    const corpsMax = deps.corpsMax ?? LIMITES_WEB.corps;
    const corpsErreurMax = deps.corpsErreurMax ?? LIMITES_WEB.corpsErreur;
    const fuseau = deps.fuseau ?? fuseauAppareil();
    // Le corps est calculé HORS du réseau : une exception ici est `interne` (filet), jamais `reseau`.
    const corps = corpsRequete({ demande, fuseau });
    const r = await appelerAssistant('recherche-web', corps, { fetch: deps.fetch, session, config: deps.config, signal: deps.signal, tentativeMs: deps.tentativeMs ?? LIMITES_WEB.tentativeMs, corpsMax, corpsErreurMax });
    if (r.raison) { const c = echecDomaine(r); return issue('indisponible', c.raison, c.extra); }
    const json = r.corps;
    if (!Array.isArray(json.content)) return issue('indisponible', 'reponse_illisible');
    modele = typeof json.model === 'string' ? borner(json.model, LIMITES_PASSERELLE.modele) || null : null;
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
  } catch (e) {
    logError('web_recherche', { reason: 'interne', error: e });
    return issue('indisponible', 'interne');
  }
}
