// Passerelle de l'assistant (spec 2026-10-18-passerelle-assistant). Ordre des gardes : OPTIONS → origine → méthode → session → liste admise → corps → quota → Anthropic.
// Jamais : la clé dans une réponse ou un journal ; un corps de demande ou de réponse dans le journal ; un appel Anthropic avant la dernière garde.
import { createClient } from '@supabase/supabase-js';
import { LIMITES, OUTILS, corpsErreur, decisionQuota, entetesCors, ligneJournal, lireDemande as lireDemandeJs, origineAdmise, statutRelaye } from './logique.js';

// logique.js est du JS : tsc ne lit pas la forme réelle de son paramètre déstructuré. On la déclare ici, une fois (aucun effet à l'exécution).
type Demande = { ok: true; corps: unknown; statut?: never; raison?: never } | { ok: false; statut: number; raison: string; corps?: never };
const lireDemande = lireDemandeJs as (texte: string, o: { outil: string; modele: string; maxTokens: number; octets: number }) => Demande;

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const env = (k: string) => Deno.env.get(k) ?? '';
const ORIGINES = (env('ASSISTANT_ORIGINES') || 'https://neegans.github.io').split(',').map((s) => s.trim()).filter(Boolean);
const MODELE = env('ASSISTANT_MODELE') || 'claude-sonnet-5-5';
const QUOTA = Number.parseInt(env('ASSISTANT_QUOTA_JOUR') || String(LIMITES.quotaJour), 10);
const cleSecrete = (): string => {
  try { const j = JSON.parse(env('SUPABASE_SECRET_KEYS') || '[]'); const k = Array.isArray(j) ? j.find((x: { api_key?: string }) => typeof x?.api_key === 'string')?.api_key : null; if (k) return k; } catch { /* legacy */ }
  return env('SUPABASE_SERVICE_ROLE_KEY');
};
const clePublique = (): string => {
  try { const j = JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '[]'); const k = Array.isArray(j) ? j.find((x: { api_key?: string }) => typeof x?.api_key === 'string')?.api_key : null; if (k) return k; } catch { /* legacy */ }
  return env('SUPABASE_ANON_KEY');
};
const json = (statut: number, corps: unknown, entetes: Record<string, string>) => new Response(JSON.stringify(corps), { status: statut, headers: { ...entetes, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

Deno.serve(async (req: Request): Promise<Response> => {
  const origine = req.headers.get('origin') ?? '';
  const cors = entetesCors(origine, ORIGINES);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!origineAdmise(origine, ORIGINES)) return json(403, corpsErreur('origine'), cors);
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
  if (req.method === 'GET') return json(200, { modele: MODELE, quotaJour: QUOTA }, cors);
  // Le corps est lu en OCTETS : la borne de lireDemande et le journal comptent des octets, pas des unités UTF-16.
  const bytes = new Uint8Array(await req.arrayBuffer());
  const texte = new TextDecoder().decode(bytes);
  let enveloppe: { outil?: unknown } = {};
  try { enveloppe = JSON.parse(texte); } catch { return json(400, corpsErreur('requete'), cors); }
  const outil = typeof enveloppe?.outil === 'string' && OUTILS.includes(enveloppe.outil) ? enveloppe.outil : '';
  const lu = lireDemande(texte, { outil, modele: MODELE, maxTokens: LIMITES.maxTokens, octets: bytes.byteLength });
  if (!lu.ok) return json(lu.statut, corpsErreur(lu.raison === 'trop_lourd' ? 'trop_lourd' : lu.raison === 'bornes' ? 'bornes' : lu.raison === 'serveur' ? 'serveur' : 'requete'), cors);
  const admin = createClient(url, cleSecrete(), { auth: { persistSession: false, autoRefreshToken: false } });
  const jour = new Date().toISOString().slice(0, 10);
  const { count, error: ec } = await admin.from('assistant_journal').select('id', { count: 'exact', head: true }).eq('owner_id', u.user.id).eq('jour', jour);
  if (ec) return json(502, corpsErreur('serveur'), cors);
  const q = decisionQuota(count ?? NaN, QUOTA);
  if (!q.ok) return json(429, corpsErreur('quota', { quota: QUOTA }), cors);
  // Réservation : la ligne est écrite AVANT l'appel (statut 0 = en vol) ; mise à jour après. Un plantage laisse une ligne « en vol » qui compte.
  const debut = Date.now();
  const { data: ins, error: ei } = await admin.from('assistant_journal').insert(ligneJournal({ ownerId: u.user.id, outil, statut: 0, usage: null, dureeMs: 0, octets: bytes.byteLength, maintenant: new Date().toISOString() })).select('id').single();
  if (ei || !ins?.id) return json(502, corpsErreur('serveur'), cors);
  const ctl = new AbortController(); const minuterie = setTimeout(() => ctl.abort(), LIMITES.attenteMs);
  let statut = 504; let corpsReponse = ''; let usage: unknown = null;
  try {
    const r = await fetch(ANTHROPIC, { method: 'POST', redirect: 'error', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, body: JSON.stringify(lu.corps) });
    statut = statutRelaye(r.status);
    corpsReponse = await r.text();
    if (corpsReponse.length > LIMITES.reponse) { statut = 502; corpsReponse = ''; }
    if (r.status === 200) { try { usage = JSON.parse(corpsReponse)?.usage ?? null; } catch { statut = 502; corpsReponse = ''; } }
    else if (statut === 502 || statut === 503) corpsReponse = '';   // jamais le message brut d'une panne (il peut nommer la clé)
  } catch { statut = ctl.signal.aborted ? 504 : 502; corpsReponse = ''; }
  finally { clearTimeout(minuterie); }
  await admin.from('assistant_journal').update(ligneJournal({ ownerId: u.user.id, outil, statut, usage, dureeMs: Date.now() - debut, octets: bytes.byteLength, maintenant: new Date().toISOString() })).eq('id', ins.id);
  if (!corpsReponse) return json(statut, corpsErreur(statut === 504 ? 'delai' : 'serveur'), cors);
  return new Response(corpsReponse, { status: statut, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
});
