// Passerelle de l'assistant (spec 2026-10-18-passerelle-assistant). Ordre des gardes : OPTIONS → origine → méthode → session → liste admise → corps → quota → (lecture-web : téléchargement de la page →) Anthropic.
// Lot B (spec 2026-10-19-recette-web § 6.3) : pour `lecture-web`, après la réservation, la page est téléchargée (telechargerPage), lue (lirePageHtml)
// et, SEULEMENT sans JSON-LD lisible, son texte est confié au modèle ; un seul point d'appel au modèle et un seul point d'écriture du journal.
// Jamais : la clé dans une réponse ou un journal ; un corps de demande, de réponse ou de PAGE dans le journal ; un appel Anthropic avant la dernière garde.
import { createClient } from '@supabase/supabase-js';
import { LIMITES, OUTILS, corpsErreur, corpsLectureModele, entetesCors, ligneJournal, lireDemande as lireDemandeJs, origineAdmise, statutRelaye } from './logique.js';
import { LIMITES_LECTURE, lireCharset, lirePageHtml as lirePageHtmlJs, typeAdmis, valideAdresse as valideAdresseJs } from './lecture-web.js';

// logique.js et lecture-web.js sont du JS : tsc ne lit pas la forme réelle de leurs paramètres déstructurés. On la déclare ici, une fois (aucun effet à l'exécution).
type Demande = { ok: true; corps: unknown; statut?: never; raison?: never } | { ok: false; statut: number; raison: string; corps?: never };
const lireDemande = lireDemandeJs as unknown as (texte: string, o: { outil: string; modele: string; maxTokens: number; octets: number; hotesRefuses: string[] }) => Demande;
type PageLue = { jsonld: { recette: unknown; autres: number } | null; texte: string | null; texte_coupe: boolean; page: Record<string, unknown> };
const lirePageHtml = lirePageHtmlJs as unknown as (o: { html: string; urlFinale: string; contentType: string }) => PageLue;
const valideAdresse = valideAdresseJs as unknown as (url: string, o: { hotesRefuses: string[] }) => { ok: true; href: string; hote: string } | { ok: false; raison: string };

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const env = (k: string) => Deno.env.get(k) ?? '';
// Les secrets sont lus À CHAQUE REQUÊTE (Deno.env.get est bon marché) : un secret changé est pris au prochain appel ; un isolat déjà chaud peut garder l'ancienne valeur jusqu'à son recyclage (non prouvé).
const origines = () => (env('ASSISTANT_ORIGINES') || 'https://neegans.github.io').split(',').map((s) => s.trim()).filter(Boolean);
const modele = () => env('ASSISTANT_MODELE') || 'claude-sonnet-5-5';
// p_quota est un `integer` SQL (int4) : au-delà de 2147483647 la réservation échouerait en 502 pour tous ; on retombe sur le défaut.
const INT4_MAX = 2147483647;
const quotaJour = (): number => { const brut = Number.parseInt(env('ASSISTANT_QUOTA_JOUR') || '', 10); return Number.isInteger(brut) && brut > 0 && brut <= INT4_MAX ? brut : LIMITES.quotaJour; };
// S-12 : l'hôte de SUPABASE_URL (PostgREST, et les fonctions sous /functions/v1) et ses sous-domaines ne sont jamais une page à lire — ni l'adresse
// tapée, ni la cible d'une redirection. R-B-23 (ronde finale 2, § 6.1 amendé) : quand cet hôte a la forme `<ref>.supabase.co`, l'alias historique
// `<ref>.functions.supabase.co` (la même fonction, par un autre nom) est refusé lui aussi, avec ses sous-domaines (hoteAdmis). Un domaine propre
// (hôte hors `.supabase.co`) n'a pas d'alias dérivé : seul l'hôte lui-même est refusé.
const ALIAS_FONCTIONS = /^([a-z0-9-]+)\.supabase\.co$/;
const hotesRefuses = (): string[] => {
  try {
    const u = env('SUPABASE_URL');
    if (!u) return [];
    const hote = new URL(u).hostname.toLowerCase().replace(/\.$/, '');
    const ref = ALIAS_FONCTIONS.exec(hote);
    return ref ? [hote, `${ref[1]}.functions.supabase.co`] : [hote];
  } catch { return []; }
};
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

// Lot B, D-B1 / D-B26 : la page, téléchargée par la fonction (jamais par le téléphone). https seulement, chaque cible de redirection revalidée par
// valideAdresse, au plus 3 sauts, 15 s par saut et 30 s en tout, corps lu borné à 2 Mio, content-type html seulement ; aucun cookie, aucune
// identité, trois en-têtes posés par le code. La vérification TLS n'est jamais relâchée (aucun client HTTP sur mesure). Rend la page décodée,
// ou un refus typé { erreur, statut }. Un abandon par `signal` (le budget de 120 s, ou le client parti) est RELANCÉ : traiter() en fait 504 ou 499.
const REDIRECTIONS = [301, 302, 303, 307, 308];
type PageTelechargee = { html: string; urlFinale: string; contentType: string };
type RefusPage = { erreur: string; statut: number };
async function telechargerPage(href: string, { signal, hotesRefuses: refuses }: { signal: AbortSignal; hotesRefuses: string[] }): Promise<PageTelechargee | RefusPage> {
  const inaccessible: RefusPage = { erreur: 'inaccessible', statut: 502 };
  const total = new AbortController();
  const minuterieTotale = setTimeout(() => total.abort(), LIMITES_LECTURE.delaiTotalMs);
  let courant = href;
  try {
    for (let saut = 0; ; saut += 1) {
      const ctlSaut = new AbortController();
      const couper = () => ctlSaut.abort();
      const minuterieSaut = setTimeout(couper, LIMITES_LECTURE.delaiSautMs);
      signal.addEventListener('abort', couper, { once: true });
      total.signal.addEventListener('abort', couper, { once: true });
      if (signal.aborted || total.signal.aborted) ctlSaut.abort(); // un écouteur posé sur un signal déjà levé ne se déclenche jamais
      try {
        let r: Response;
        try {
          r = await fetch(courant, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: ctlSaut.signal, headers: { 'user-agent': 'Mitsu/0.10 (+https://neegans.github.io/mistu/)', accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.5' } });
        } catch (e) { if (signal.aborted) throw e; return inaccessible; }
        // Vague finale (SSRF, défense en profondeur) : le mur des redirections (valideAdresse sur chaque cible) suppose que le runtime honore
        // redirect: 'manual'. Une réponse SUIVIE quand même (r.redirected) vient d'une adresse jamais revalidée : refusée, son corps jamais lu.
        if (r.redirected) { void r.body?.cancel().catch(() => {}); return { erreur: 'interdit', statut: 422 }; }
        if (REDIRECTIONS.includes(r.status)) {
          void r.body?.cancel().catch(() => {}); // S-9 : le corps d'une redirection n'est jamais lu
          const loc = r.headers.get('location');
          if (!loc) return inaccessible;
          let cible: string;
          try { cible = new URL(loc, courant).href; } catch { return inaccessible; }
          const v = valideAdresse(cible, { hotesRefuses: refuses });
          if (!v.ok) return { erreur: 'interdit', statut: 422 };
          if (saut + 1 > LIMITES_LECTURE.redirections) return inaccessible;
          courant = v.href;
          continue;
        }
        if (r.status < 200 || r.status > 299) { void r.body?.cancel().catch(() => {}); return inaccessible; }
        const type = r.headers.get('content-type') ?? '';
        if (!typeAdmis(type)) { void r.body?.cancel().catch(() => {}); return { erreur: 'pas_une_page', statut: 422 }; }
        let octets: Uint8Array | null;
        try { octets = await lireCorpsBorne(r, LIMITES_LECTURE.page); } catch (e) { if (signal.aborted) throw e; return inaccessible; }
        if (octets === null) return { erreur: 'trop_lourde', statut: 413 };
        return { html: new TextDecoder(lireCharset(type, octets)).decode(octets), urlFinale: courant, contentType: type };
      } finally {
        clearTimeout(minuterieSaut);
        signal.removeEventListener('abort', couper);
        total.signal.removeEventListener('abort', couper);
      }
    }
  } finally { clearTimeout(minuterieTotale); }
}

// L'appel au modèle, partagé par les quatre outils : mêmes en-têtes, `redirect: 'error'`, réponse lue bornée, statut relayé. Une exception (réseau,
// abandon) remonte à traiter(). `json` est la réponse lue d'un 200 (pour la mise en forme de lecture-web), sinon null.
async function appelerAnthropic(corps: unknown, ctl: AbortController): Promise<{ statut: number; corpsReponse: string; usage: unknown; json: unknown }> {
  const r = await fetch(ANTHROPIC, { method: 'POST', redirect: 'error', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, body: JSON.stringify(corps) });
  const statut = statutRelaye(r.status);
  const brut = await lireCorpsBorne(r, LIMITES.reponse);
  if (brut === null) return { statut: 502, corpsReponse: '', usage: null, json: null };
  const corpsReponse = new TextDecoder().decode(brut);
  if (r.status === 200) {
    try { const reponseJson = JSON.parse(corpsReponse); return { statut, corpsReponse, usage: reponseJson?.usage ?? null, json: reponseJson }; }
    catch { return { statut: 502, corpsReponse: '', usage: null, json: null }; }
  }
  if (statut === 502 || statut === 503) return { statut, corpsReponse: '', usage: null, json: null }; // jamais le message brut d'une panne (il peut nommer la clé)
  return { statut, corpsReponse, usage: null, json: null };
}
// Le texte des blocs `text` d'une réponse du modèle, concaténé ; la sortie n'est PAS validée ici (le client le fait : donnée hostile).
const texteDesBlocs = (reponse: unknown): string => {
  const contenu = (reponse as { content?: unknown })?.content;
  return (Array.isArray(contenu) ? contenu : []).filter((b) => b && typeof b === 'object' && (b as { type?: unknown }).type === 'text' && typeof (b as { text?: unknown }).text === 'string').map((b) => (b as { text: string }).text).join('');
};
const chaineOuNul = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const points = (s: string): number => { let n = 0; for (const _ of s) n += 1; return n; };

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
  const refuses = hotesRefuses();
  const lu = lireDemande(texte, { outil, modele: modele(), maxTokens: LIMITES.maxTokens, octets: bytes.byteLength, hotesRefuses: refuses });
  // `interdit` (lecture-web : adresse refusée) part AVANT la réservation : un refus sur l'adresse tapée ne coûte rien (I-B10).
  if (!lu.ok) return json(lu.statut, corpsErreur(lu.raison === 'trop_lourd' ? 'trop_lourd' : lu.raison === 'bornes' ? 'bornes' : lu.raison === 'serveur' ? 'serveur' : lu.raison === 'interdit' ? 'interdit' : 'requete'), cors);
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
  let corpsModele: unknown = lu.corps; // pour lecture-web : posé seulement quand la page n'a pas de JSON-LD lisible
  try {
    if (outil === 'lecture-web') {
      corpsModele = null;
      const telechargee = await telechargerPage((lu.corps as { url: string }).url, { signal: ctl.signal, hotesRefuses: refuses });
      if ('erreur' in telechargee) { statut = telechargee.statut; corpsReponse = JSON.stringify(corpsErreur(telechargee.erreur)); }
      else {
        const lue = lirePageHtml({ html: telechargee.html, urlFinale: telechargee.urlFinale, contentType: telechargee.contentType });
        const page = { ...lue.page, lue_le: new Date().toISOString() };
        if (lue.jsonld) {
          // D-B2 : un JSON-LD lisible → AUCUN appel au modèle, zéro jeton (journal 0 / 0).
          statut = 200; usage = { input_tokens: 0, output_tokens: 0 };
          corpsReponse = JSON.stringify({ source_kind: 'jsonld', page, recette: lue.jsonld.recette, usage, stop_reason: null, model: null });
        } else if (typeof lue.texte !== 'string' || points(lue.texte) < LIMITES_LECTURE.texteMin) {
          statut = 422; corpsReponse = JSON.stringify(corpsErreur('vide'));
        } else corpsModele = { page, corps: corpsLectureModele({ modele: modele(), texte: lue.texte }) };
      }
    }
    if (corpsModele !== null) {
      const enLecture = outil === 'lecture-web';
      const envoi = enLecture ? (corpsModele as { corps: unknown }).corps : corpsModele;
      const r = await appelerAnthropic(envoi, ctl);
      statut = r.statut; corpsReponse = r.corpsReponse; usage = r.usage;
      if (enLecture && statut === 200) {
        const j = r.json as { stop_reason?: unknown; model?: unknown };
        corpsReponse = JSON.stringify({ source_kind: 'modele', page: (corpsModele as { page: unknown }).page, recette: texteDesBlocs(r.json), usage, stop_reason: chaineOuNul(j?.stop_reason), model: chaineOuNul(j?.model) });
      }
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
