// Heure corrigée par le décalage mesuré avec le serveur (spec § 5.3). Le décalage reste 0 tant que L3 n'existe pas :
// seule la monotonie compte ici, pour qu'un retour d'horloge locale ne fabrique jamais de conflit.
let offsetMs = 0;
let floorIso = '';

export const setClockOffset = (ms) => { offsetMs = Number.isFinite(ms) ? ms : 0; };
export const getClockOffset = () => offsetMs;

// Jamais une valeur inférieure à la dernière rendue, et jamais deux fois la même : sous une horloge reculée,
// le plancher avance d'une milliseconde, sinon deux écritures successives porteraient le même updated_at.
export function syncNow() {
  const iso = new Date(Date.now() + offsetMs).toISOString();
  if (iso > floorIso) return (floorIso = iso);
  return (floorIso = new Date(Date.parse(floorIso) + 1).toISOString());
}
