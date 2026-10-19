// Abstraction de l'assistant (spec §12, §15). Sans session, l'application fonctionne entièrement à la main ;
// les écrans de l'assistant disent « Connecte-toi pour utiliser l’assistant. » au lieu de simuler un résultat.
// L'assistant passe par la passerelle (src/domain/passerelle.js) : l'app n'a plus aucune clé de fournisseur d'IA, et plus aucun
// autre fournisseur (le fournisseur compatible OpenAI, configurable par une clé locale, est retiré : Passerelle T4).
import { appelerAssistant, echecDomaine, sessionValide, LIMITES_PASSERELLE } from './passerelle.js';
import { borner } from '../core/bornes.js';
import { reduireImage } from '../core/image.js';

export class LLMProvider {
  constructor(config = {}) { this.config = config; }
  get name() { return 'none'; }
  get configured() { return false; }
  get supportsVision() { return false; }
  get supportsWebSearch() { return false; }
  // messages: [{ role: 'system'|'user', content: string | [{type:'text',text}|{type:'image', mime, base64}] }]
  // Sans session, l'extraction dit la même chose que les écrans : non_connecte (l'écran en fait « Connecte-toi… » si la session disparaît
  // entre le rendu et le clic).
  async complete(/* messages, { json = false, maxTokens, signal } */) { throw new Error('non_connecte'); }
}

export class NoneProvider extends LLMProvider {}

// L'assistant par la passerelle : `complete` poste l'outil « extraction » avec la SESSION de la personne. `name` reste 'anthropic'
// (les gardes des écrans le lisent) ; il est configuré quand une session existe. La session est une donnée (jamais le module d'auth).
// Après l'appel, `this.modele` (le modèle que le SERVEUR a choisi : provenance) et `this.stopReason` (lu dans la réponse, borné : une
// coupure `max_tokens` devient echec(coupe) chez l'appelant) sont posés ; `signal` est relayé à appelerAssistant (« Annuler » coupe le fetch).
export class PasserelleProvider extends LLMProvider {
  constructor(config = {}, { session = null, fetch = undefined } = {}) { super(config); this.session = session; this.fetch = fetch; this.modele = null; this.stopReason = null; }
  get name() { return 'anthropic'; }
  get configured() { return sessionValide(this.session); }
  get supportsVision() { return true; }
  get supportsWebSearch() { return true; }
  async complete(messages, { maxTokens = 4000, signal } = {}) {
    const system = messages.filter((m) => m.role === 'system').map((m) => (typeof m.content === 'string' ? m.content : m.content.map((p) => p.text || '').join('\n'))).join('\n');
    const corps = {
      max_tokens: maxTokens, system: system || undefined,
      messages: messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content.map((p) => p.type === 'text'
          ? { type: 'text', text: p.text }
          : { type: 'image', source: { type: 'base64', media_type: p.mime, data: p.base64 } }),
      })),
    };
    this.stopReason = null; this.modele = null; // ronde 1 : un appel qui échoue ne laisse rien du précédent sur l'instance (contexteDe les relit)
    const r = await appelerAssistant('extraction', corps, { fetch: this.fetch, session: this.session, tentativeMs: LIMITES_PASSERELLE.tentativeMs, signal });
    // Le message de l'erreur est la RAISON d'issue (le classement des écrans, echecDomaine : un 429 non écrit par la passerelle est
    // trop_de_demandes, jamais « quota »), jamais le corps de la réponse ; ses extras (le nombre du quota, trop_lourd) sont portés par l'Error.
    if (r.raison) { const d = echecDomaine(r); throw Object.assign(new Error(d.raison), d.extra ?? {}); }
    this.modele = typeof r.corps.model === 'string' ? borner(r.corps.model, LIMITES_PASSERELLE.modele) || null : null; // le modèle que le SERVEUR a choisi (provenance)
    this.stopReason = typeof r.corps.stop_reason === 'string' ? borner(r.corps.stop_reason, STOP_REASON_MAX) || null : null;
    return (Array.isArray(r.corps.content) ? r.corps.content : []).filter((c) => c && c.type === 'text' && typeof c.text === 'string').map((c) => c.text).join('');
  }
}
const STOP_REASON_MAX = 40;

// Une session (donnée) → la passerelle ; sans session, rien. `settings` garde sa place dans la signature (les écrans passent toujours
// ctx.settings) mais n'est plus lu : aucune clé ni aucun fournisseur local ne décide de l'assistant (Passerelle T4).
export function providerFrom(_settings, { session = null } = {}) {
  return sessionValide(session) ? new PasserelleProvider({}, { session }) : new NoneProvider({});
}

// --- Extraction : bornes et raisons (spec import-cible § 3.4, I-1). La sortie du modèle est une donnée hostile : validée champ par champ,
// bornée en POINTS DE CODE, et tout dépassement REFUSE le résultat (hors_bornes) — jamais de troncature silencieuse.
export const BORNES_EXTRACTION = Object.freeze({ titre: 200, ligne: 300, etape: 2000, notes: 2000, lignes: 80, etapes: 60, sousRecettes: 20, sousRecetteTitre: 200, sousRecetteRenvoi: 40, champsIncertains: 40, champIncertain: 200 });
// Les nombres du modèle (ronde 1) : au-delà, la valeur vaut null (rien d'inventé : « p. 9007199254740991 » ou une mise à l'échelle par 10^15 ne sont
// pas des lectures). 24 h comme detectTimers (R-CRE-8) ; 999 portions ; 9 999 pages. Un refus (hors_bornes) jetterait une recette lisible pour un nombre.
export const BORNES_NOMBRES = Object.freeze({ portions: 999, minutes: 1440, page: 9999 });
// Les listes d'un index (tâche 6, ronde 1) : comme celles de la recette, un dépassement REFUSE (hors_bornes). 500 entrées est au-delà de ce qu'une réponse
// peut porter (≈ 15 jetons par entrée) ; un index relu du journal (synchro, archive) qui en porterait 20 000 ne devient jamais 20 000 fiches.
export const BORNES_INDEX = Object.freeze({ entrees: 500, incertains: 40, mentions: 80 });
// D-5 : 6 000 jetons de sortie (était 4 000) ; une sortie plus longue frôlerait l'abandon serveur à 120 s — la preuve § 10 mesure.
export const MAX_TOKENS_EXTRACTION = 6000;
// La réponse brute gardée dans le journal (diagnostic, jamais rendue) : coupée à 16 000 points de code (sous la borne de 512 Kio de sync_push).
export const REPONSE_BRUTE_MAX = 16000;

// Un refus d'extraction nommé : raison ∈ coupe (stop_reason max_tokens) | illisible (aucun JSON, forme impossible) | hors_bornes | vide (zéro ligne
// ET zéro étape). Porte la réponse brute (coupée), le stopReason et le modèle quand l'appel les a donnés : le journal les garde sur echec
// (reponse_brute seule, Review Focus 4). Le message est la raison, comme les Error de complete : texteEchecAssistant les lit de la même façon.
export class ErreurExtraction extends Error {
  constructor(raison, { texteBrut = null, stopReason = null, modele = null } = {}) {
    super(raison);
    this.name = 'ErreurExtraction';
    this.raison = raison;
    this.texteBrut = texteBrut;
    this.stopReason = stopReason;
    this.modele = modele;
  }
}

const longueur = (s) => Array.from(s).length;
const tronquer = (s, max) => (longueur(s) > max ? Array.from(s).slice(0, max).join('') : s);

// Un texte du modèle (ronde 1) : CRLF → LF, tabulation → espace, puis les caractères de CONTRÔLE (Cc) et de FORMAT (Cf : RLO U+202E, largeur nulle
// U+200B-D, isolats bidi U+2066-9, BOM U+FEFF…) et les séparateurs U+2028/2029 sont RETIRÉS — sauf le saut de ligne, gardé pour une étape sur
// plusieurs lignes —, comme `borner` (core/bornes.js) pour toute sortie distante ; puis trim, puis la borne en points de code : dépasser REFUSE
// (hors_bornes), jamais de troncature silencieuse. Pas une chaîne → null ; blanc (ou fait de Cf seuls) → null.
const INVISIBLES = /(?!\n)[\p{Cc}\p{Cf}\u{2028}\u{2029}]/gu;
const horsBornes = () => { throw new ErreurExtraction('hors_bornes'); };
const texteBorne = (v, max) => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(INVISIBLES, '').trim();
  if (longueur(s) > max) horsBornes();
  return s || null;
};
// Un entier fini de 0 à `max` ; tout le reste (négatif, NaN, chaîne, décimal, au-delà) vaut null.
const entierBorne = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

// --- Recipe Parser : pages → JSON strict. Le résultat est TOUJOURS marqué « à vérifier » ; rien n'est inventé. `language` n'est plus demandé
// (jamais utilisé) ; `incomplete` et `missing_page` sont demandés et montrés, jamais comblés (spec import-cible § 3.4, I-1).
const PARSER_SYSTEM = `Tu es le Recipe Parser de Cuisine OS. Tu lis des pages de livres de cuisine photographiées.
Réponds UNIQUEMENT par un objet JSON valide avec ce schéma :
{"title": string|null, "servings": number|null, "prep_minutes": number|null, "cook_minutes": number|null,
 "ingredients": [{"source_text": string, "uncertain": boolean}], "steps": [{"text": string}], "printed_page": number|null,
 "sub_recipes": [{"title": string, "page_reference": string|null}], "uncertain_fields": [string], "notes": string|null,
 "incomplete": boolean, "missing_page": boolean}
Règles : recopie le texte exactement (source_text = ligne d'ingrédient telle qu'imprimée, avec quantité et unité d'origine).
N'invente jamais une quantité, une durée ou une portion absente : mets null ou marque "uncertain": true.
Si une quantité est illisible, garde le texte lisible et ajoute la ligne dans uncertain_fields.
Si une page semble manquer (étapes qui commencent au milieu, ingrédients sans étapes, renvoi à une page absente), mets "missing_page": true ; si la recette est visiblement partielle, mets "incomplete": true ; une étape peut tenir sur plusieurs lignes : garde-la entière dans un seul "text".`;

// Ce que l'appel a donné, attaché au résultat comme à un refus : la réponse brute coupée à REPONSE_BRUTE_MAX, le stopReason et le modèle lus.
const contexteDe = (provider, raw) => ({ stopReason: provider.stopReason ?? null, modele: provider.modele ?? null, texteBrut: tronquer(String(raw ?? ''), REPONSE_BRUTE_MAX) });

// Un appel, pages dans l'ordre donné → { recette, stopReason, modele, texteBrut }. Lève Error(non_connecte) sans session (aucun appel), les Error
// de complete (raisons de la passerelle, dont `annule` pour un signal levé), ou ErreurExtraction(coupe | illisible | hors_bornes | vide).
export async function extraireRecette(provider, images /* [{mime, base64}] */, { signal, maxTokens = MAX_TOKENS_EXTRACTION } = {}) {
  if (!provider.configured) throw new Error('non_connecte');
  if (!provider.supportsVision) throw new Error('Ce fournisseur ne prend pas en charge la lecture d’images');
  const content = [{ type: 'text', text: 'Extrais la recette de ces pages. JSON seulement.' }, ...images.map((im) => ({ type: 'image', mime: im.mime, base64: im.base64 }))];
  const raw = await provider.complete([{ role: 'system', content: PARSER_SYSTEM }, { role: 'user', content }], { json: true, maxTokens, signal });
  const contexte = contexteDe(provider, raw);
  if (contexte.stopReason === 'max_tokens') throw new ErreurExtraction('coupe', contexte); // une coupure n'est jamais prise pour une recette, même si le JSON est entier
  let data;
  try { data = parseJsonLoose(raw); } catch { throw new ErreurExtraction('illisible', contexte); }
  try { return { recette: validateParsedRecipe(data), ...contexte }; }
  catch (e) { if (e instanceof ErreurExtraction) Object.assign(e, contexte); throw e; }
}

// Enveloppe compatible (m5) : la recette seule, ordre existant des arguments, jusqu'à ce que ses appelants passent au journal (tâches 4 et 6).
export async function extractRecipeFromImages(provider, images) {
  return (await extraireRecette(provider, images)).recette;
}

const INDEX_SYSTEM = `Tu lis la table des matières ou l'index d'un livre de cuisine. Réponds UNIQUEMENT en JSON :
{"entries": [{"title": string, "printed_page": number|null, "section": string|null, "ingredients_mentioned": [string]}], "uncertain": [string]}
Ne déduis aucun ingrédient d'un titre ; "ingredients_mentioned" ne contient que des mots explicitement imprimés dans l'entrée.`;

// Un appel → { index: { entries, uncertain }, stopReason, modele, texteBrut }. Mêmes refus que extraireRecette (coupe, illisible : aucun JSON ou
// pas de liste d'entrées) ; les entrées gardent leur typage existant (la table des matières structurée est le lot C).
export async function extraireIndex(provider, images, { signal } = {}) {
  if (!provider.configured) throw new Error('non_connecte');
  const content = [{ type: 'text', text: 'Liste les entrées de cet index. JSON seulement.' }, ...images.map((im) => ({ type: 'image', mime: im.mime, base64: im.base64 }))];
  const raw = await provider.complete([{ role: 'system', content: INDEX_SYSTEM }, { role: 'user', content }], { json: true, signal });
  const contexte = contexteDe(provider, raw);
  if (contexte.stopReason === 'max_tokens') throw new ErreurExtraction('coupe', contexte);
  let data;
  try { data = parseJsonLoose(raw); } catch { throw new ErreurExtraction('illisible', contexte); }
  try { return { index: validerIndex(data), ...contexte }; }
  catch (e) { if (e instanceof ErreurExtraction) Object.assign(e, contexte); throw e; }
}

// La forme d'un index (ronde 1 de la tâche 3) : les entrées deviennent des fiches (« Créer les références ») — typées et bornées comme la recette
// (titre ≤ 200 points de code sinon hors_bornes, Cc/Cf retirés, page entier ≤ 9 999, section chaîne ou null, mentions chaînes seulement) ; une
// entrée au titre vide est écartée ; pas de liste d'entrées → illisible. Exportée (tâche 6) : UNE définition, pour la réponse du modèle ET pour un
// résultat relu du journal (synchro, archive), REVALIDÉ avant tout usage par le panneau d'index (I-1), comme validateParsedRecipe pour une recette.
// Ronde 1 de la tâche 6 : les NOMBRES d'entrées, d'incertitudes et de mentions sont bornés aussi (BORNES_INDEX, hors_bornes au-delà).
export function validerIndex(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.entries)) throw new ErreurExtraction('illisible');
  const mentions = (m) => { const l = (Array.isArray(m) ? m : []).map((x) => texteBorne(x, BORNES_EXTRACTION.ligne)).filter(Boolean); if (l.length > BORNES_INDEX.mentions) horsBornes(); return l; };
  const entries = data.entries.filter((e) => e && typeof e.title === 'string')
    .map((e) => ({ title: texteBorne(e.title, BORNES_EXTRACTION.titre), printed_page: entierBorne(e.printed_page, BORNES_NOMBRES.page), section: texteBorne(e.section, BORNES_EXTRACTION.titre), ingredients_mentioned: mentions(e.ingredients_mentioned) }))
    .filter((e) => e.title);
  if (entries.length > BORNES_INDEX.entrees) horsBornes();
  const uncertain = (Array.isArray(data.uncertain) ? data.uncertain : []).map((u) => texteBorne(u, BORNES_EXTRACTION.champIncertain)).filter(Boolean);
  if (uncertain.length > BORNES_INDEX.incertains) horsBornes();
  return { entries, uncertain };
}
// (Ronde 1 de la tâche 6 : l'enveloppe m5 extractIndexFromImages est retirée — son seul appelant, le panneau d'index, lit désormais par le journal.)

export function parseJsonLoose(text) {
  const s = String(text || '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Réponse IA sans JSON');
  return JSON.parse(s.slice(start, end + 1));
}

// Validation durcie (spec import-cible § 3.4) : titre ≤ 200 points de code, ligne ≤ 300, étape ≤ 2 000, notes ≤ 2 000, ≤ 80 lignes, ≤ 60 étapes,
// sub_recipes ≤ 20 × (titre ≤ 200, renvoi ≤ 40), uncertain_fields ≤ 40 × 200 ; Cc/Cf retirés de chaque texte (ronde 1) ; entiers finis de 0 à
// BORNES_NOMBRES (sinon null) pour portions, durées, page ;
// `incomplete` et `missing_page` vrais seulement s'ils valent `true` ; textes trim (un saut de ligne INTERNE d'une étape est gardé) ; une entrée
// mal formée ou blanche est écartée. Tout dépassement → ErreurExtraction(hors_bornes) ; pas un objet → illisible ; zéro ligne ET zéro étape → vide.
export function validateParsedRecipe(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ErreurExtraction('illisible');
  const B = BORNES_EXTRACTION, N = BORNES_NOMBRES;
  const texte = texteBorne; // Cc/Cf retirés, trim, borne en points de code (ronde 1)
  const liste = (v) => (Array.isArray(v) ? v : []);
  const ingredients = liste(data.ingredients).filter((i) => i && typeof i.source_text === 'string').map((i) => ({ source_text: texte(i.source_text, B.ligne), uncertain: !!i.uncertain })).filter((i) => i.source_text);
  if (ingredients.length > B.lignes) horsBornes();
  const steps = liste(data.steps).filter((s) => s && typeof s.text === 'string').map((s) => ({ text: texte(s.text, B.etape) })).filter((s) => s.text);
  if (steps.length > B.etapes) horsBornes();
  const sub_recipes = liste(data.sub_recipes).filter((s) => s && typeof s.title === 'string').map((s) => ({ title: texte(s.title, B.sousRecetteTitre), page_reference: typeof s.page_reference === 'string' ? texte(s.page_reference, B.sousRecetteRenvoi) : null })).filter((s) => s.title);
  if (sub_recipes.length > B.sousRecettes) horsBornes();
  const uncertain_fields = liste(data.uncertain_fields).filter((u) => typeof u === 'string').map((u) => texte(u, B.champIncertain)).filter(Boolean);
  if (uncertain_fields.length > B.champsIncertains) horsBornes();
  const recette = {
    title: texte(data.title, B.titre),
    servings: entierBorne(data.servings, N.portions), prep_minutes: entierBorne(data.prep_minutes, N.minutes), cook_minutes: entierBorne(data.cook_minutes, N.minutes),
    ingredients, steps,
    printed_page: entierBorne(data.printed_page, N.page),
    sub_recipes, uncertain_fields,
    notes: texte(data.notes, B.notes),
    incomplete: data.incomplete === true, missing_page: data.missing_page === true,
  };
  if (!ingredients.length && !steps.length) throw new ErreurExtraction('vide'); // I13 : rien n'est écrit sur la recette
  return recette;
}

// La copie d'une page qui PART à l'assistant (F-3) : réduite à 1568 px de côté au plus, et toujours en JPEG (reduireImage ré-encode). Sans cela,
// trois photos de téléphone de 3-5 Mo, en base64, dépassent la borne de 8 Mio de la passerelle (413) avant d'avoir servi à quoi que ce soit.
// 1568 px est la taille au-delà de laquelle le fournisseur réduit lui-même l'image : rien n'est perdu à l'envoyer plus petite. La page STOCKÉE
// n'est jamais touchée. Une page qui ne se décode pas lève (ErreurImage « indecodable ») : jamais envoyée telle quelle, elle contournerait la borne.
export const COTE_MAX_ENVOI = 1568;
export async function pagePourEnvoi(blob) {
  const reduite = await reduireImage(blob, { maxCote: COTE_MAX_ENVOI });
  return { mime: reduite.type, base64: await blobToBase64(reduite) };
}

export async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
