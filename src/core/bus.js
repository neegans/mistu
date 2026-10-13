// Bus d'événements minimal pour rafraîchir les vues après une écriture.
import { logError } from './log.js';

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  for (const fn of listeners.get(event) || []) {
    try { fn(payload); } catch (e) { logError('bus', { error: e }); }
  }
  for (const fn of listeners.get('*') || []) {
    try { fn(event, payload); } catch (e) { logError('bus', { error: e }); }
  }
}
