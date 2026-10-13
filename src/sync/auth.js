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

// Un refus du fournisseur se reconnaît à ces clés ; leur valeur (error_description) n'est jamais montrée.
const REFUS_KEYS = ['error', 'error_code'];

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
  function readError({ search = '', hash = '' } = {}) {
    return carriesRefusal(search) || carriesRefusal(hash) ? t('Cette adresse n’est pas autorisée.') : null;
  }

  function handleReturn() {
    const loc = win?.location || {};
    const search = loc.search || '';
    const hash = loc.hash || '';
    const params = new URLSearchParams(search.replace(/^\?/, ''));
    // Le code d'autorisation ne doit pas rester dans l'historique ; le fragment de route, lui, est conservé.
    if (params.has('code') || carriesRefusal(search)) {
      try { win?.history?.replaceState?.(null, '', (loc.pathname || '/') + hash); }
      catch (error) { logError('auth.retour', { error }); }
    }
    return readError({ search, hash });
  }

  async function signIn() {
    if (!client) return null;
    try {
      // redirectTo sans fragment : avec un « # », GoTrue colle la requête derrière et le code n'est jamais lu.
      const redirectTo = (win?.location?.origin || '') + (win?.location?.pathname || '/');
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) logError('auth.signIn', { error });
      return { error: error || null };
    } catch (error) {
      logError('auth.signIn', { error });
      return { error };
    }
  }

  // Ferme la session de cet appareil seulement : ni les données ni la file d'envoi ne sont touchées.
  async function signOut() {
    if (!client) return null;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) logError('auth.signOut', { error });
      return { error: error || null };
    } catch (error) {
      logError('auth.signOut', { error });
      return { error };
    }
  }

  async function session() {
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) { logError('auth.session', { error }); return null; }
      return stateOf(data?.session);
    } catch (error) {
      logError('auth.session', { error });
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
        try { fn?.(payload); } catch (error) { logError('auth.change', { error }); }
        emit('sync', payload);
      });
      handle = data?.subscription || null;
    } catch (error) {
      logError('auth.change', { error });
    }
    return () => { try { handle?.unsubscribe?.(); } catch (error) { logError('auth.change', { error }); } };
  }

  // Garde de compte (spec § 4.1) : un appareil ne sert qu'un compte. L'adresse connue est lue en base locale et
  // ne la quitte jamais ; un compte différent est refusé sans rien écrire (le geste « Changer de compte sur cet
  // appareil » est à l'interface, tâche 13, et passe par repo.clearDevice).
  async function guard(uid, email) {
    const [idRow, emailRow] = await Promise.all([db.get('sync_state', 'user_id'), db.get('sync_state', 'user_email')]);
    const connu = idRow?.value || null;
    if (!connu) {
      await db.mutate({
        puts: { sync_state: [{ key: 'user_id', value: uid }, { key: 'user_email', value: email || '' }] },
        origin: 'device', // identité de l'appareil : jamais capturée, jamais envoyée
      });
      return { ok: true };
    }
    if (connu === uid) return { ok: true };
    // Les deux clés sont écrites ensemble ; si l'adresse manque malgré tout, l'identifiant connu sert de repère.
    const adresse = emailRow?.value || connu;
    return { ok: false, message: t('Cet appareil a été synchronisé avec {e}.', { e: adresse }) };
  }

  return { available: !!client, reason, signIn, signOut, session, onChange, handleReturn, readError, guard };
}
