// Un repas porte un instant ISO. Le formulaire en expose les composantes dans le fuseau de l’appareil.
// Les heures sautées ne sont pas normalisées ; les heures répétées donnent toutes leurs occurrences.
const deux = n => String(n).padStart(2, '0');

export function formaterHeureLocale(instant) {
  if (typeof instant !== 'string' || !instant) return '';
  const d = new Date(instant);
  if (!Number.isFinite(d.getTime()) || d.getFullYear() < 1 || d.getFullYear() > 9999) return '';
  return `${String(d.getFullYear()).padStart(4, '0')}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

export function analyserHeureLocale(valeur) {
  if (valeur === '') return { etat: 'vide', occurrences: [] };
  if (typeof valeur !== 'string') return { etat: 'invalide', occurrences: [] };
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valeur);
  if (!m) return { etat: 'invalide', occurrences: [] };
  const [annee, mois, jour, heure, minute] = m.slice(1).map(Number);
  const mur = new Date(0);
  mur.setUTCFullYear(annee, mois - 1, jour);
  mur.setUTCHours(heure, minute, 0, 0);
  if (annee < 1 || mur.getUTCFullYear() !== annee || mur.getUTCMonth() !== mois - 1 || mur.getUTCDate() !== jour || mur.getUTCHours() !== heure || mur.getUTCMinutes() !== minute) return { etat: 'invalide', occurrences: [] };
  // Collecter les décalages avant/après une transition, y compris de 30 minutes ou d’un jour entier.
  const offsets = new Set();
  for (let h = -48; h <= 48; h += 3) offsets.add(new Date(mur.getTime() + h * 3600000).getTimezoneOffset());
  const occurrences = [...offsets].map(offset => {
    const d = new Date(mur.getTime() + offset * 60000);
    return { iso: d.toISOString(), offset_minutes: -d.getTimezoneOffset() };
  }).filter(x => formaterHeureLocale(x.iso) === valeur).sort((a, b) => a.iso.localeCompare(b.iso));
  return { etat: occurrences.length ? 'valide' : 'inexistante', occurrences };
}

export function decalageUTC(minutes) {
  const absolu = Math.abs(minutes);
  return `UTC${minutes < 0 ? '−' : '+'}${deux(Math.floor(absolu / 60))}:${deux(absolu % 60)}`;
}
