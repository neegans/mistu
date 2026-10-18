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
const cleSecrete = (): string => {
  try { const j = JSON.parse(env('SUPABASE_SECRET_KEYS') || '[]'); const k = Array.isArray(j) ? j.find((x: { api_key?: string }) => typeof x?.api_key === 'string')?.api_key : null; if (k) return k; } catch { /* legacy */ }
  return env('SUPABASE_SERVICE_ROLE_KEY');
};
const clePublique = (): string => {
  try { const j = JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '[]'); const k = Array.isArray(j) ? j.find((x: { api_key?: string }) => typeof x?.api_key === 'string')?.api_key : null; if (k) return k; } catch { /* legacy */ }
  return env('SUPABASE_ANON_KEY');
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
  if (req.method === 'GET') return json(200, { modele: modele(), quotaJour: quotaJour() }, cors);
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
  finally { clearTimeout(minuterie); }
  // La mise à jour ne pose que le résultat (statut, jetons, durée) ; son échec n'est pas relayé au client : la ligne reste au statut 0 et compte.
  const l = ligneJournal({ ownerId: u.user.id, outil, statut, usage, dureeMs: Date.now() - debut, octets: bytes.byteLength, maintenant: new Date().toISOString() });
  try { await admin.from('assistant_journal').update({ statut: l.statut, jetons_entree: l.jetons_entree, jetons_sortie: l.jetons_sortie, duree_ms: l.duree_ms }).eq('id', idReserve); } catch { /* la ligne « en vol » compte */ }
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
