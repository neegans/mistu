// Logique pure de la passerelle de l'assistant (spec 2026-10-18-passerelle-assistant § 2-5). Tourne sous Node (tests) et sous Deno (index.ts).
// Le client est une DONNÉE HOSTILE : liste blanche par outil, modèle forcé, plafonds, propriétés propres seulement. Le journal ne porte que des compteurs.
export const OUTILS = Object.freeze(['recherche-web', 'creation', 'extraction']);
export const LIMITES = Object.freeze({ corps: 512 * 1024, corpsExtraction: 8 * 1024 * 1024, maxTokens: 16000, quotaJour: 60, attenteMs: 120000, reponse: 2 * 1024 * 1024, system: 20000, messages: 20, maxUses: 5 });
const TYPES_IMAGE = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const OUTIL_WEB = 'web_search_20250305';
const own = (o, k) => (o && typeof o === 'object' && !Array.isArray(o) && Object.hasOwn(o, k) ? o[k] : undefined);
const objetNu = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

export function origineAdmise(origine, admises) {
  return typeof origine === 'string' && origine !== '' && Array.isArray(admises) && admises.includes(origine);
}
export function entetesCors(origine, admises) {
  const h = { 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
  if (origineAdmise(origine, admises)) h['Access-Control-Allow-Origin'] = origine;
  return h;
}
const refus = (statut, raison) => ({ ok: false, statut, raison });
function bloc(b, outil) {
  if (!objetNu(b)) return null;
  const type = own(b, 'type');
  if (type === 'text') { const t = own(b, 'text'); return typeof t === 'string' ? { type: 'text', text: t } : null; }
  if (type === 'image' && outil === 'extraction') {
    const s = own(b, 'source'); if (!objetNu(s) || own(s, 'type') !== 'base64') return null;
    const mt = own(s, 'media_type'), data = own(s, 'data');
    if (!TYPES_IMAGE.includes(mt) || typeof data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
    return { type: 'image', source: { type: 'base64', media_type: mt, data } };
  }
  return null;
}
export function lireDemande(texte, { outil, modele, maxTokens = LIMITES.maxTokens, octets } = {}) {
  if (!OUTILS.includes(outil)) return refus(400, 'outil');
  if (typeof modele !== 'string' || modele === '') return refus(502, 'serveur');
  if (typeof texte !== 'string') return refus(400, 'forme');
  const borne = outil === 'extraction' ? LIMITES.corpsExtraction : LIMITES.corps;
  const taille = Number.isInteger(octets) && octets >= 0 ? Math.max(octets, texte.length) : texte.length;
  if (taille > borne) return refus(413, 'trop_lourd');
  const plafond = Number.isInteger(maxTokens) ? Math.min(maxTokens, LIMITES.maxTokens) : LIMITES.maxTokens;
  let enveloppe; try { enveloppe = JSON.parse(texte); } catch { return refus(400, 'forme'); }
  const corps = own(enveloppe, 'corps');
  if (!objetNu(corps)) return refus(400, 'forme');
  const out = { model: modele };
  const system = own(corps, 'system');
  if (system !== undefined) { if (typeof system !== 'string') return refus(400, 'forme'); if (system.length > LIMITES.system) return refus(422, 'bornes'); out.system = system; }
  const msgs = own(corps, 'messages');
  if (!Array.isArray(msgs) || msgs.length < 1) return refus(400, 'forme');
  if (msgs.length > LIMITES.messages) return refus(422, 'bornes');
  out.messages = [];
  for (const m of msgs) {
    if (!objetNu(m)) return refus(400, 'forme');
    const role = own(m, 'role'), content = own(m, 'content');
    if (role !== 'user' && role !== 'assistant') return refus(400, 'forme');
    if (typeof content === 'string') { out.messages.push({ role, content }); continue; }
    if (!Array.isArray(content) || content.length < 1) return refus(400, 'forme');
    const blocs = content.map((b) => bloc(b, outil));
    if (blocs.some((b) => b === null)) return refus(400, 'forme');
    out.messages.push({ role, content: blocs });
  }
  const mt = own(corps, 'max_tokens');
  if (mt === undefined) out.max_tokens = Math.min(4000, plafond);
  else if (!Number.isInteger(mt)) return refus(400, 'forme');
  else if (mt < 1 || mt > plafond) return refus(422, 'bornes');
  else out.max_tokens = mt;
  if (outil === 'recherche-web') {
    const tools = own(corps, 'tools');
    if (tools !== undefined) {
      if (!Array.isArray(tools)) return refus(400, 'forme');
      if (tools.length !== 1) return refus(422, 'bornes');
      const t = tools[0];
      if (!objetNu(t) || own(t, 'type') !== OUTIL_WEB || own(t, 'name') !== 'web_search') return refus(400, 'forme');
      const mu = own(t, 'max_uses');
      if (mu !== undefined && (!Number.isInteger(mu) || mu < 1 || mu > LIMITES.maxUses)) return refus(422, 'bornes');
      const outilNu = { type: OUTIL_WEB, name: 'web_search', max_uses: mu === undefined ? LIMITES.maxUses : mu };
      const loc = own(t, 'user_location');
      if (loc !== undefined) {
        if (!objetNu(loc) || own(loc, 'type') !== 'approximate') return refus(400, 'forme');
        const l = { type: 'approximate' };
        for (const k of ['country', 'timezone', 'city', 'region']) { const v = own(loc, k); if (v !== undefined) { if (typeof v !== 'string' || v.length > 64) return refus(400, 'forme'); l[k] = v; } }
        outilNu.user_location = l;
      }
      out.tools = [outilNu];
    }
  }
  return { ok: true, corps: out };
}
export function decisionQuota(appelsDuJour, quotaJour) {
  return Number.isInteger(appelsDuJour) && appelsDuJour >= 0 && Number.isInteger(quotaJour) && appelsDuJour < quotaJour ? { ok: true } : { ok: false, statut: 429, raison: 'quota' };
}
export function statutRelaye(s) {
  if (s === 200 || s === 400 || s === 403 || s === 413 || s === 429) return s;
  if (s === 529) return 503;
  return 502;   // 401 (clé serveur refusée), 404, 5xx, redirections : panne de la passerelle, jamais « ta clé »
}
const entierOuNul = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
// Une chaîne, une Date ou un nombre d'époque seulement (new Date(null) et new Date(true) rendraient 1970 sans erreur), et le résultat doit être AAAA-MM-JJ
// (une époque extrême rend « +275760-09 » ou « -271821-04 »). Sinon null.
const jourDe = (maintenant) => {
  if (typeof maintenant !== 'string' && typeof maintenant !== 'number' && !(maintenant instanceof Date)) return null;
  try { const j = new Date(maintenant).toISOString().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(j) ? j : null; } catch { return null; }
};
export function ligneJournal({ ownerId, outil, statut, usage, dureeMs, octets, maintenant }) {
  const duree = Number(dureeMs);
  return { owner_id: ownerId, outil: OUTILS.includes(outil) ? outil : null, statut: Number.isInteger(statut) ? statut : null, jetons_entree: entierOuNul(own(usage, 'input_tokens')), jetons_sortie: entierOuNul(own(usage, 'output_tokens')), duree_ms: Number.isFinite(duree) ? Math.max(0, Math.floor(duree)) : 0, octets: entierOuNul(octets), jour: jourDe(maintenant) };
}
export function corpsErreur(raison, extra = {}) { return { ...extra, erreur: raison }; }
