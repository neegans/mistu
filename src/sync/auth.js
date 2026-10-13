// Connexion Google et garde de compte (spec § 4.1). Aucun envoi de données ici : seulement la session, le retour
// du fournisseur et l'identité mémorisée sur cet appareil.
// Rien n'est affiché brut : une erreur du client va au journal (code seul) et l'interface reçoit une phrase fixe.
import { currentConfig } from './config.js';
import { t } from '../core/i18n.js';
import { emit } from '../core/bus.js';
import { logError } from '../core/log.js';

// Options du client : PKCE (le code arrive dans la requête, pas de jeton dans le fragment), session gardée par
// supabase-js, échange automatique au retour. L'ordre des clés est celui de la spec.
const AUTH_OPTIONS = { flowType: 'pkce', persistSession: true, detectSessionInUrl: true };

// Un refus du fournisseur se reconnaît à la seule PRÉSENCE d'une de ces clés (spec § 4.1) ; leur valeur
// (error_description surtout) n'est jamais lue, ni journalisée, ni montrée.
const REFUS_KEYS = ['error', 'error_code', 'error_description'];

// Lit une requête ou un fragment. Un fragment peut porter une route (« #/settings ») et, derrière elle, les
// paramètres du fournisseur (« #/settings?error=… ») : la partie après le premier « ? » est examinée aussi.
function carriesRefusal(chunk) {
  const raw = String(chunk || '').replace(/^[?#]/, '');
  if (!raw) return false;
  const parts = [raw];
  const mark = raw.indexOf('?');
  if (mark >= 0) parts.push(raw.slice(mark + 1));
  return parts.some((part) => {
    const params = new URLSearchParams(part);
    return REFUS_KEYS.some((key) => params.has(key));
  });
}

// Fragment à écrire dans l'historique : un refus porté par le fragment en sort aussi.
// « #/route?error=… » → « #/route » (la route est gardée) ; « #error=… » → fragment vide (rien à garder).
// Sans refus, le fragment est rendu tel quel : la route de l'utilisateur n'est jamais touchée.
function cleanHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!carriesRefusal(raw)) return hash || '';
  const mark = raw.indexOf('?');
  if (mark < 0) return '';
  const route = raw.slice(0, mark);
  return route ? '#' + route : '';
}

// Détails joints au journal : un code et un statut, jamais le texte de l'erreur (la liste blanche de log.js filtre).
const detailsOf = (error) => ({ error, status: error?.status, reason: error?.code });

// Forme rendue à l'interface : jamais l'objet session du client, seulement l'identifiant et l'adresse.
const stateOf = (session) => (session?.user ? { user: { id: session.user.id, email: session.user.email || '' } } : null);

// Valeurs par défaut : config = currentConfig(), factory = globalThis.supabase?.createClient, win = window.
// Elles sont lues par Object.hasOwn et non par un paramètre par défaut : passer « factory: undefined » signifie
// « pas de bibliothèque » et doit le rester. Avec un paramètre par défaut, un tel appel retomberait sur le vrai
// createClient du bundle embarqué — un client réel serait créé et signIn() ferait une vraie redirection.
export function createAuth(options = {}) {
  const { db } = options;
  const config = Object.hasOwn(options, 'config') ? options.config : currentConfig();
  const factory = Object.hasOwn(options, 'factory') ? options.factory : globalThis.supabase?.createClient;
  const win = Object.hasOwn(options, 'win') && options.win !== undefined ? options.win : globalThis.window;
  // Deux indisponibilités distinctes, nommées : la bibliothèque n'a pas été chargée, ou l'origine n'a pas de config.
  let client = null;
  let reason = null;
  if (typeof factory !== 'function') reason = 'bibliotheque';
  else if (!config || !config.url || !config.anonKey) reason = 'config';
  else {
    try {
      // Une seule fois, ici. Copie des options : la constante partagée ne peut pas être modifiée par le client.
      client = factory(config.url, config.anonKey, { auth: { ...AUTH_OPTIONS } });
    } catch (error) {
      logError('auth.client', { error });
      client = null;
      reason = 'bibliotheque';
    }
  }

  // readError, handleReturn et guard ne touchent pas au client : ils restent utiles même sans lui (nettoyer l'URL
  // du retour, nommer un refus, protéger les données locales). Les quatre méthodes qui parlent au serveur, elles,
  // ne font rien et rendent null tant que le client manque.
  // R36 : la phrase est NEUTRE sur la cause. Les clés de refus ne la disent pas — une adresse hors liste, un écran
  // de consentement annulé par la personne et une panne du fournisseur arrivent tous en « error=… ». Affirmer
  // « Cette adresse n'est pas autorisée. » quand quelqu'un a simplement annulé serait un état sans événement réel
  // (invariant I5). La valeur d'error_description n'est jamais lue : elle vient du fournisseur.
  function readError({ search = '', hash = '' } = {}) {
    return carriesRefusal(search) || carriesRefusal(hash) ? t('La connexion a été refusée ou annulée.') : null;
  }

  // Retour du fournisseur, appelé une fois au démarrage (câblage en tâche 13). ASYNCHRONE à dessein.
  // Contrat : rend { error, codeSansSession, present }.
  //   error            = la phrase fixe du refus, ou null (jamais le texte du fournisseur).
  //   codeSansSession  = vrai quand un code est revenu, que l'échange a été attendu et qu'aucune session n'en est
  //                      sortie (tâche 13 : « La connexion n'a pas abouti »). Faux sans client : rien n'a été tenté.
  //   present          = vrai seulement si l'URL portait vraiment un retour (un code ou une clé de refus). Un
  //                      chargement ordinaire rend faux : sans ce drapeau, rien ne distingue les deux (R23).
  // L'ordre compte : le code n'est retiré de l'URL qu'APRÈS l'échange. supabase-js lit l'URL à sa création et
  // getSession() attend la fin de cet échange ; nettoyer avant reviendrait à retirer le code sous ses pieds — ça ne
  // tient aujourd'hui que par la lecture synchrone du bundle 2.117.3, et ce n'est pas un contrat publié.
  async function handleReturn() {
    const loc = win?.location || {};
    const search = loc.search || '';
    const hash = loc.hash || '';
    const params = new URLSearchParams(search.replace(/^\?/, ''));
    const aCode = params.has('code');
    const refus = carriesRefusal(search) || carriesRefusal(hash);
    let codeSansSession = false;
    if (aCode && client) {
      let etat = null;
      try {
        const { data, error } = await client.auth.getSession();
        if (error) logError('auth.retour', detailsOf(error));
        else etat = stateOf(data?.session);
      } catch (error) {
        logError('auth.retour', detailsOf(error));
      }
      // Retour muet : un code est bien revenu mais l'échange n'a donné aucune session. Jamais silencieux.
      if (!etat) { codeSansSession = true; logError('auth.retour', { reason: 'sans_session' }); }
    }
    // Le code et les paramètres de refus ne restent pas dans l'historique ; la route du fragment est conservée.
    // Sans client, il n'y a rien à échanger mais l'URL est nettoyée quand même.
    if (aCode || refus) {
      try { win?.history?.replaceState?.(null, '', (loc.pathname || '/') + cleanHash(hash)); }
      catch (error) { logError('auth.retour', detailsOf(error)); }
    }
    return { error: readError({ search, hash }), codeSansSession, present: aCode || refus };
  }

  async function signIn() {
    if (!client) return null;
    try {
      // redirectTo sans fragment : avec un « # », GoTrue colle la requête derrière et le code n'est jamais lu.
      const redirectTo = (win?.location?.origin || '') + (win?.location?.pathname || '/');
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) logError('auth.signIn', detailsOf(error));
      return { error: error || null };
    } catch (error) {
      logError('auth.signIn', detailsOf(error));
      return { error };
    }
  }

  // Ferme la session de cet appareil seulement : ni les données ni la file d'envoi ne sont touchées.
  async function signOut() {
    if (!client) return null;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) logError('auth.signOut', detailsOf(error));
      return { error: error || null };
    } catch (error) {
      logError('auth.signOut', detailsOf(error));
      return { error };
    }
  }

  async function session() {
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) { logError('auth.session', detailsOf(error)); return null; }
      return stateOf(data?.session);
    } catch (error) {
      logError('auth.session', detailsOf(error));
      return null;
    }
  }

  function onChange(fn) {
    if (!client) return () => {};
    let handle = null;
    try {
      const { data } = client.auth.onAuthStateChange((event, current) => {
        const state = stateOf(current);
        const payload = { user: state?.user || null };
        try { fn?.(payload); } catch (error) { logError('auth.change', detailsOf(error)); }
        emit('sync', payload);
      });
      handle = data?.subscription || null;
    } catch (error) {
      logError('auth.change', detailsOf(error));
    }
    return () => { try { handle?.unsubscribe?.(); } catch (error) { logError('auth.change', detailsOf(error)); } };
  }

  // Garde de compte (spec § 4.1) : un appareil ne sert qu'un compte. L'adresse connue est lue en base locale et
  // ne la quitte jamais ; un compte différent est refusé sans rien écrire (le geste « Changer de compte sur cet
  // appareil » est à l'interface, tâche 13, et passe par repo.clearDevice).
  // Échoue FERMÉ : si la base ne répond pas, la garde refuse au lieu de laisser passer. Une base muette ne doit
  // jamais devenir une autorisation.
  async function guard(uid, email) {
    try {
      const [idRow, emailRow] = await Promise.all([db.get('sync_state', 'user_id'), db.get('sync_state', 'user_email')]);
      const connu = idRow?.value || null;
      if (!connu) {
        await db.mutate({
          puts: { sync_state: [{ key: 'user_id', value: uid }, { key: 'user_email', value: email || '' }] },
          origin: 'device', // identité de l'appareil : jamais capturée, jamais envoyée
        });
        return { ok: true };
      }
      if (connu === uid) {
        // Même compte : rien à réécrire, sauf si l'adresse du compte a réellement changé (jamais effacée par un vide).
        const adresse = email || '';
        if (adresse && emailRow?.value !== adresse) {
          await db.mutate({ puts: { sync_state: [{ key: 'user_email', value: adresse }] }, origin: 'device' });
        }
        return { ok: true };
      }
      // Les deux clés sont écrites ensemble ; si l'adresse manque malgré tout, l'identifiant connu sert de repère.
      const adresse = emailRow?.value || connu;
      return { ok: false, message: t('Cet appareil a été synchronisé avec {e}.', { e: adresse }) };
    } catch (error) {
      logError('auth.garde', detailsOf(error));
      return { ok: false, message: t('Cet appareil ne peut pas vérifier le compte.') };
    }
  }

  return { available: !!client, reason, signIn, signOut, session, onChange, handleReturn, readError, guard };
}
