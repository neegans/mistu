// Abstraction fournisseur-agnostique (spec §12, §15). Sans configuration, l'application fonctionne entièrement à la main ;
// les fonctions IA affichent « assistant non configuré » au lieu de simuler un résultat.
// Les fournisseurs distants ci-dessous n'ont pas été exercés dans cet environnement : à valider avec une clé réelle.

export class LLMProvider {
  constructor(config = {}) { this.config = config; }
  get name() { return 'none'; }
  get configured() { return false; }
  get supportsVision() { return false; }
  // messages: [{ role: 'system'|'user', content: string | [{type:'text',text}|{type:'image', mime, base64}] }]
  async complete(/* messages, { json = false } */) { throw new Error('Aucun assistant IA configuré. Réglages → Assistant IA.'); }
}

export class NoneProvider extends LLMProvider {}

export class OpenAICompatibleProvider extends LLMProvider {
  get name() { return 'openai_compatible'; }
  get configured() { return !!(this.config.api_key && this.config.model); }
  get supportsVision() { return this.config.vision !== false; }
  async complete(messages, { json = false, maxTokens = 4000 } = {}) {
    const base = (this.config.base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
    const body = {
      model: this.config.model, max_tokens: maxTokens, temperature: 0.2,
      messages: messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content.map((p) => p.type === 'text'
          ? { type: 'text', text: p.text }
          : { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.base64}` } }),
      })),
    };
    if (json) body.response_format = { type: 'json_object' };
    const res = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.api_key}` }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Fournisseur IA : ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}

export class AnthropicProvider extends LLMProvider {
  get name() { return 'anthropic'; }
  get configured() { return !!(this.config.api_key && this.config.model); }
  get supportsVision() { return true; }
  async complete(messages, { maxTokens = 4000 } = {}) {
    const system = messages.filter((m) => m.role === 'system').map((m) => (typeof m.content === 'string' ? m.content : m.content.map((p) => p.text || '').join('\n'))).join('\n');
    const body = {
      model: this.config.model, max_tokens: maxTokens, system: system || undefined,
      messages: messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content.map((p) => p.type === 'text'
          ? { type: 'text', text: p.text }
          : { type: 'image', source: { type: 'base64', media_type: p.mime, data: p.base64 } }),
      })),
    };
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.config.api_key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Fournisseur IA : ${res.status} ${await res.text()}`);
    const data = await res.json();
    return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  }
}

export function providerFrom(settings) {
  const cfg = settings?.llm || { provider: 'none' };
  if (cfg.provider === 'openai_compatible') return new OpenAICompatibleProvider(cfg);
  if (cfg.provider === 'anthropic') return new AnthropicProvider(cfg);
  return new NoneProvider(cfg);
}

// --- Recipe Parser : pages → JSON strict. Le résultat est TOUJOURS marqué « à vérifier » ; rien n'est inventé.
const PARSER_SYSTEM = `Tu es le Recipe Parser de Cuisine OS. Tu lis des pages de livres de cuisine photographiées.
Réponds UNIQUEMENT par un objet JSON valide avec ce schéma :
{"title": string|null, "language": "fr"|"en"|null, "servings": number|null, "prep_minutes": number|null, "cook_minutes": number|null,
 "ingredients": [{"source_text": string, "uncertain": boolean}], "steps": [{"text": string}], "printed_page": number|null,
 "sub_recipes": [{"title": string, "page_reference": string|null}], "uncertain_fields": [string], "notes": string|null}
Règles : recopie le texte exactement (source_text = ligne d'ingrédient telle qu'imprimée, avec quantité et unité d'origine).
N'invente jamais une quantité, une durée ou une portion absente : mets null ou marque "uncertain": true.
Si une quantité est illisible, garde le texte lisible et ajoute la ligne dans uncertain_fields.`;

export async function extractRecipeFromImages(provider, images /* [{mime, base64}] */) {
  if (!provider.configured) throw new Error('Assistant IA non configuré');
  if (!provider.supportsVision) throw new Error('Ce fournisseur ne prend pas en charge la lecture d’images');
  const content = [{ type: 'text', text: 'Extrais la recette de ces pages. JSON seulement.' }, ...images.map((im) => ({ type: 'image', mime: im.mime, base64: im.base64 }))];
  const raw = await provider.complete([{ role: 'system', content: PARSER_SYSTEM }, { role: 'user', content }], { json: true });
  return validateParsedRecipe(parseJsonLoose(raw));
}

const INDEX_SYSTEM = `Tu lis la table des matières ou l'index d'un livre de cuisine. Réponds UNIQUEMENT en JSON :
{"entries": [{"title": string, "printed_page": number|null, "section": string|null, "ingredients_mentioned": [string]}], "uncertain": [string]}
Ne déduis aucun ingrédient d'un titre ; "ingredients_mentioned" ne contient que des mots explicitement imprimés dans l'entrée.`;

export async function extractIndexFromImages(provider, images) {
  if (!provider.configured) throw new Error('Assistant IA non configuré');
  const content = [{ type: 'text', text: 'Liste les entrées de cet index. JSON seulement.' }, ...images.map((im) => ({ type: 'image', mime: im.mime, base64: im.base64 }))];
  const raw = await provider.complete([{ role: 'system', content: INDEX_SYSTEM }, { role: 'user', content }], { json: true });
  const data = parseJsonLoose(raw);
  if (!Array.isArray(data?.entries)) throw new Error('Réponse IA sans liste d’entrées');
  return { entries: data.entries.filter((e) => e && typeof e.title === 'string').map((e) => ({ title: e.title.trim(), printed_page: Number.isFinite(e.printed_page) ? e.printed_page : null, section: e.section || null, ingredients_mentioned: Array.isArray(e.ingredients_mentioned) ? e.ingredients_mentioned : [] })), uncertain: data.uncertain || [] };
}

export function parseJsonLoose(text) {
  const s = String(text || '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Réponse IA sans JSON');
  return JSON.parse(s.slice(start, end + 1));
}

export function validateParsedRecipe(data) {
  if (!data || typeof data !== 'object') throw new Error('JSON de recette invalide');
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  return {
    title: typeof data.title === 'string' ? data.title.trim() : null,
    language: ['fr', 'en'].includes(data.language) ? data.language : null,
    servings: num(data.servings), prep_minutes: num(data.prep_minutes), cook_minutes: num(data.cook_minutes),
    ingredients: (Array.isArray(data.ingredients) ? data.ingredients : []).filter((i) => i && typeof i.source_text === 'string').map((i) => ({ source_text: i.source_text.trim(), uncertain: !!i.uncertain })),
    steps: (Array.isArray(data.steps) ? data.steps : []).filter((s) => s && typeof s.text === 'string').map((s) => ({ text: s.text.trim() })),
    printed_page: num(data.printed_page),
    sub_recipes: Array.isArray(data.sub_recipes) ? data.sub_recipes : [],
    uncertain_fields: Array.isArray(data.uncertain_fields) ? data.uncertain_fields : [],
    notes: typeof data.notes === 'string' ? data.notes : null,
  };
}

export async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
