// Heure corrigée par le décalage mesuré avec le serveur (spec § 5.3). Le décalage reste 0 tant que L3 n'existe pas :
// seule la monotonie compte ici, pour qu'un retour d'horloge locale ne fabrique jamais de conflit.
let offsetMs = 0;
let floorIso = '';

export const setClockOffset = (ms) => { offsetMs = Number.isFinite(ms) ? ms : 0; };
export const getClockOffset = () => offsetMs;
// Réservé aux tests (comme bindDatabase) : remet le décalage ET le plancher à zéro, pour qu'une suite ne lègue pas à la suivante un
// plancher poussé de plusieurs jours par une heure serveur future. Jamais appelé par l'app.
export const resetClock = () => { offsetMs = 0; floorIso = ''; };

// Jamais une valeur inférieure à la dernière rendue, et jamais deux fois la même : sous une horloge reculée,
// le plancher avance d'une milliseconde, sinon deux écritures successives porteraient le même updated_at.
export function syncNow() {
  const iso = new Date(Date.now() + offsetMs).toISOString();
  if (iso > floorIso) return (floorIso = iso);
  return (floorIso = new Date(Date.parse(floorIso) + 1).toISOString());
}

// Décalage mesuré à chaque réponse du serveur (spec § 5.3) : syncNow() = local + décalage, et jamais sous la
// dernière heure serveur vue. Au-delà de 5 minutes, l'appelant avertit UNE fois (clock_warned_at, moteur).
export function appliquerHeureServeur(serverIso, localMs = Date.now()) {
  const serverMs = Date.parse(serverIso);
  // Heure illisible : rien n'est mesuré, rien n'est avancé, et rien n'est signalé à tort.
  if (!Number.isFinite(serverMs)) return { decalageMs: offsetMs, avertir: false, minutes: 0 };
  offsetMs = serverMs - localMs;
  const normalisee = new Date(serverMs).toISOString();
  if (normalisee > floorIso) floorIso = normalisee;
  const minutes = Math.round(Math.abs(offsetMs) / 60000);
  return { decalageMs: offsetMs, avertir: Math.abs(offsetMs) > 5 * 60000, minutes };
}
