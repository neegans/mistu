// Passerelle de l'assistant (spec 2026-10-18-passerelle-assistant). Ordre des gardes : OPTIONS → origine → méthode → session → liste admise → corps → quota → Anthropic.
// Jamais : la clé dans une réponse ou un journal ; un corps de demande ou de réponse dans le journal ; un appel Anthropic avant la dernière garde.
import { createClient } from '@supabase/supabase-js';
import { LIMITES, OUTILS, corpsErreur, entetesCors, ligneJournal, lireDemande as lireDemandeJs, origineAdmise, statutRelaye } from './logique.js';

// logique.js est du JS : tsc ne lit pas la forme réelle de son paramètre déstructuré. On la déclare ici, une fois (aucun effet à l'exécution).
type Demande = { ok: true; corps: unknown; statut?: never; raison?: never } | { ok: false; statut: number; raison: string; corps?: never };
const lireDemande = lireDemandeJs as (texte: string, o: { outil: string; modele: string; maxTokens: number; octets: number }) => Demande;

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const env = (k: string) => Deno.env.get(k) ?? '';
// Les secrets sont lus À CHAQUE REQUÊTE (Deno.env.get est bon marché) : un secret changé est pris au prochain appel ; un isolat déjà chaud peut garder l'ancienne valeur jusqu'à son recyclage (non prouvé).
const origines = () => (env('ASSISTANT_ORIGINES') || 'https://neegans.github.io').split(',').map((s) => s.trim()).filter(Boolean);
const modele = () => env('ASSISTANT_MODELE') || 'claude-sonnet-5-5';
// p_quota est un `integer` SQL (int4) : au-delà de 2147483647 la réservation échouerait en 502 pour tous ; on retombe sur le défaut.
const INT4_MAX = 2147483647;
const quotaJour = (): number => { const brut = Number.parseInt(env('ASSISTANT_QUOTA_JOUR') || '', 10); return Number.isInteger(brut) && brut > 0 && brut <= INT4_MAX ? brut : LIMITES.quotaJour; };
// Les clés Supabase injectées dans la fonction (SUPABASE_PUBLISHABLE_KEYS, SUPABASE_SECRET_KEYS) n'ont pas une forme garantie : une liste
// d'objets { api_key }, une liste de chaînes, un objet ({ default: … }), ou la clé nue. Le lecteur est tolérant sur la FORME, jamais sur le
// PRÉFIXE : une clé n'est prise que si elle commence par le sien (`sb_publishable_` / `sb_secret_`), si bien qu'une clé secrète posée dans la
// variable publique (ou l'inverse) n'est jamais prise pour l'autre. Tout le reste → null, et l'appelant retombe sur la clé legacy
// (SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY). Profondeur bornée : la structure vient de la plateforme, pas d'un client, mais rien ne boucle.
const PREFIXE_PUBLIQUE = 'sb_publishable_';
const PREFIXE_SECRET = 'sb_secret_';
const PROFONDEUR_CLES = 3;
function cleDepuis(brut: string, prefixe: string): string | null {
  const texte = brut.trim();
  if (!texte) return null;
  let valeur: unknown = texte;
  try { valeur = JSON.parse(texte); } catch { /* pas du JSON : la clé nue */ }
  const lire = (v: unknown, profondeur: number): string | null => {
    if (typeof v === 'string') { const k = v.trim(); return k.startsWith(prefixe) ? k : null; }
    if (v === null || typeof v !== 'object' || profondeur >= PROFONDEUR_CLES) return null;
    const o = v as Record<string, unknown>;
    for (const c of Array.isArray(v) ? v : [o.api_key, o.default, ...Object.values(o)]) { const k = lire(c, profondeur + 1); if (k) return k; }
    return null;
  };
  return lire(valeur, 0);
}
const cleNouvellePublique = (): string | null => cleDepuis(env('SUPABASE_PUBLISHABLE_KEYS'), PREFIXE_PUBLIQUE);
const cleNouvelleSecrete = (): string | null => cleDepuis(env('SUPABASE_SECRET_KEYS'), PREFIXE_SECRET);
const cleSecrete = (): string => cleNouvelleSecrete() ?? env('SUPABASE_SERVICE_ROLE_KEY');
const clePublique = (): string => cleNouvellePublique() ?? env('SUPABASE_ANON_KEY');
// Un repère NON secret pour le GET : par quelle voie les deux clés ont été lues ('mixte' si elles diffèrent). Jamais la clé elle-même.
const voieDesCles = (): 'nouvelles' | 'legacy' | 'mixte' => {
  const p = cleNouvellePublique() !== null; const s = cleNouvelleSecrete() !== null;
  return p && s ? 'nouvelles' : !p && !s ? 'legacy' : 'mixte';
};
const json = (statut: number, corps: unknown, entetes: Record<string, string>) => new Response(JSON.stringify(corps), { status: statut, headers: { ...entetes, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// Lit un corps (la demande du client, ou la réponse d'Anthropic) en refusant d'en lire plus que `max` OCTETS : `content-length`
// déclaré trop grand → corps annulé (connexion libérée), null sans rien lire ; sinon lecture par morceaux, annulée dès que le total dépasse. null = trop lourd.
async function lireCorpsBorne(source: Request | Response, max: number): Promise<Uint8Array | null> {
  const declare = source.headers.get('content-length');
  if (declare !== null && /^\d+$/.test(declare.trim()) && Number(declare) > max) { void source.body?.cancel().catch(() => {}); return null; }
  const reader = source.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const morceaux: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { void reader.cancel().catch(() => {}); return null; }
    morceaux.push(value);
  }
  const out = new Uint8Array(total); let o = 0;
  for (const m of morceaux) { out.set(m, o); o += m.byteLength; }
  return out;
}

async function traiter(req: Request, cors: Record<string, string>, origine: string): Promise<Response> {
  const admises = origines();
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!origineAdmise(origine, admises)) return json(403, corpsErreur('origine'), cors);
  if (req.method !== 'POST' && req.method !== 'GET') return json(405, corpsErreur('methode'), cors);
  const jeton = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jeton || !/^[A-Za-z0-9._-]+$/.test(jeton)) return json(401, corpsErreur('non_connecte'), cors);
  const url = env('SUPABASE_URL');
  const commeUtilisateur = createClient(url, clePublique(), { global: { headers: { Authorization: `Bearer ${jeton}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u, error: eu } = await commeUtilisateur.auth.getUser(jeton);
  if (eu || !u?.user?.id) return json(401, corpsErreur('non_connecte'), cors);
  // La liste admise : la même règle que la synchronisation (is_allowed() lit l'adresse du jeton), appelée COMME l'utilisateur.
  const { data: admis, error: ea } = await commeUtilisateur.rpc('is_allowed');
  if (ea || admis !== true) return json(403, corpsErreur('non_admis'), cors);
  if (req.method === 'GET') return json(200, { modele: modele(), quotaJour: quotaJour(), cles: voieDesCles() }, cors);
  // Le corps est lu BORNÉ (8 Mio, la plus grande borne d'outil ; la borne propre à chaque outil reste celle de lireDemande) et en OCTETS.
  const bytes = await lireCorpsBorne(req, LIMITES.corpsExtraction);
  if (bytes === null) return json(413, corpsErreur('trop_lourd'), cors);
  const texte = new TextDecoder().decode(bytes);
  let enveloppe: { outil?: unknown } = {};
  try { enveloppe = JSON.parse(texte); } catch { return json(400, corpsErreur('requete'), cors); }
  const outil = typeof enveloppe?.outil === 'string' && OUTILS.includes(enveloppe.outil) ? enveloppe.outil : '';
  const lu = lireDemande(texte, { outil, modele: modele(), maxTokens: LIMITES.maxTokens, octets: bytes.byteLength });
  if (!lu.ok) return json(lu.statut, corpsErreur(lu.raison === 'trop_lourd' ? 'trop_lourd' : lu.raison === 'bornes' ? 'bornes' : lu.raison === 'serveur' ? 'serveur' : 'requete'), cors);
  // Réservation ATOMIQUE (0004, assistant_reserver) : verrou par compte, comptage du jour UTC et insertion de la ligne « en vol » (statut 0)
  // en une seule transaction. null = quota atteint. Un plantage laisse une ligne « en vol » qui compte : voulu.
  const admin = createClient(url, cleSecrete(), { auth: { persistSession: false, autoRefreshToken: false } });
  const quota = quotaJour();
  const { data: idReserve, error: er } = await admin.rpc('assistant_reserver', { p_owner: u.user.id, p_outil: outil, p_octets: bytes.byteLength, p_quota: quota });
  if (er) return json(502, corpsErreur('serveur'), cors);
  if (idReserve == null) return json(429, corpsErreur('quota', { quota }), cors);
  const debut = Date.now();
  const ctl = new AbortController(); const minuterie = setTimeout(() => ctl.abort(), LIMITES.attenteMs);
  // « Annuler » dans l'app ferme la connexion de la requête : l'appel amont est alors abandonné (sans cela, la passerelle attendrait Anthropic
  // jusqu'à 120 s pour personne). Un client déjà parti n'envoie plus rien : le signal déjà levé abandonne l'appel avant qu'il ne parte.
  const relais = () => ctl.abort();
  if (req.signal.aborted) ctl.abort(); else req.signal.addEventListener('abort', relais, { once: true });
  let statut = 504; let corpsReponse = ''; let usage: unknown = null;
  try {
    const r = await fetch(ANTHROPIC, { method: 'POST', redirect: 'error', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, body: JSON.stringify(lu.corps) });
    statut = statutRelaye(r.status);
    const brut = await lireCorpsBorne(r, LIMITES.reponse);
    if (brut === null) { statut = 502; corpsReponse = ''; }
    else {
      corpsReponse = new TextDecoder().decode(brut);
      if (r.status === 200) { try { usage = JSON.parse(corpsReponse)?.usage ?? null; } catch { statut = 502; corpsReponse = ''; } }
      else if (statut === 502 || statut === 503) corpsReponse = '';   // jamais le message brut d'une panne (il peut nommer la clé)
    }
  } catch { statut = ctl.signal.aborted ? 504 : 502; corpsReponse = ''; }
  finally { clearTimeout(minuterie); req.signal.removeEventListener('abort', relais); }
  // Le client est parti (499, la convention des passerelles) : journalisé tel quel, et rien n'est relayé — même une réponse déjà lue.
  if (req.signal.aborted) { statut = 499; corpsReponse = ''; }
  // La mise à jour ne pose que le résultat (statut, jetons, durée) ; son échec n'est pas relayé au client : la ligne reste au statut 0 et compte.
  const l = ligneJournal({ ownerId: u.user.id, outil, statut, usage, dureeMs: Date.now() - debut, octets: bytes.byteLength, maintenant: new Date().toISOString() });
  try { await admin.from('assistant_journal').update({ statut: l.statut, jetons_entree: l.jetons_entree, jetons_sortie: l.jetons_sortie, duree_ms: l.duree_ms }).eq('id', idReserve); } catch { /* la ligne « en vol » compte */ }
  if (statut === 499) return new Response(null, { status: 499, headers: { ...cors, 'cache-control': 'no-store' } });
  if (!corpsReponse) return json(statut, corpsErreur(statut === 504 ? 'delai' : 'serveur'), cors);
  return new Response(corpsReponse, { status: statut, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origine = req.headers.get('origin') ?? '';
  const cors = entetesCors(origine, origines());
  try {
    return await traiter(req, cors, origine);
  } catch {
    return json(502, corpsErreur('serveur'), cors);   // aucune exception ne sort sans CORS ni sans { erreur } ; rien n'est journalisé
  }
});
