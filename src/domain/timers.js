// Minuteries système (spec §33) : Siri ou raccourci installé ; états honnêtes, aucune prétention de connaître l'état d'Horloge.
import { newId, nowIso } from '../core/ids.js';

export const SHORTCUT_NAME = 'CuisineOS-Minuterie';

export function shortcutUrl(seconds) {
  const s = Math.max(1, Math.round(seconds));
  return `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${s}`;
}

export function describeDuration(seconds, locale = 'fr') {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const parts = [];
  if (h) parts.push(locale === 'en' ? `${h} hour${h > 1 ? 's' : ''}` : `${h} heure${h > 1 ? 's' : ''}`);
  if (m) parts.push(`${m} min`);
  if (sec && !h) parts.push(locale === 'en' ? `${sec} s` : `${sec} s`);
  return parts.join(' ') || (locale === 'en' ? '0 s' : '0 s');
}

export function siriPhrase(seconds, locale = 'fr') {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  const dur = locale === 'en'
    ? [h ? `${h} hour${h > 1 ? 's' : ''}` : '', m ? `${m} minute${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ')
    : [h ? `${h} heure${h > 1 ? 's' : ''}` : '', m ? `${m} minute${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(' et ');
  return locale === 'en' ? `Hey Siri, set a timer for ${dur || `${s} seconds`}` : `Dis Siri, mets une minuterie de ${dur || `${s} secondes`}`;
}

export function isAppleTouchDevice() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

// Crée l'enregistrement de demande. handoff_state : requested → opening → unconfirmed | failed ; « siri » = demande vocale par l'utilisateur.
export function createTimerLaunch({ cook_session_id = null, recipe_version_id, step_id = null, device_id, duration_seconds, channel }) {
  return {
    id: newId('tl'), cook_session_id, recipe_version_id, step_id, device_id, duration_seconds: Math.round(duration_seconds),
    channel, // 'shortcut' | 'siri'
    requested_at: nowIso(), handoff_state: channel === 'siri' ? 'siri' : 'requested', updated_at: nowIso(),
  };
}

export const TIMER_STATE_HELP = {
  requested: 'Demande enregistrée sur cet appareil.',
  opening: 'Ouverture de Raccourcis… Le système gère l’ouverture et les autorisations.',
  unconfirmed: 'Aucun accusé fiable : vérifie dans Horloge que la minuterie tourne.',
  failed: 'Tu as indiqué qu’elle n’a pas démarré. Utilise Siri ou Horloge directement.',
  siri: 'Demande à faire toi-même à Siri ; l’app ne déclenche pas Siri.',
};
