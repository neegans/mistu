// Quantités : texte brut conservé, valeur ou plage interprétable, fraction préservée, arrondi seulement à l'affichage (spec §14, §29.2).

const UNICODE_FRACTIONS = { '½': [1, 2], '¼': [1, 4], '¾': [3, 4], '⅓': [1, 3], '⅔': [2, 3], '⅛': [1, 8], '⅜': [3, 8], '⅝': [5, 8], '⅞': [7, 8], '⅕': [1, 5], '⅙': [1, 6] };
const QUALITATIVE = ['au goût', 'au gout', 'to taste', 'q.s.', 'qs', 'selon le goût', 'un peu', 'a little', 'quelques', 'some', 'a few', 'as needed', 'au besoin'];

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

function parseNumber(token) {
  // "1½", "1 1/2", "1/2", "1,5", "1.5", "½", "3"
  let s = token.trim().replace(/\s+/g, ' ');
  let whole = 0, num = 0, den = 1, matched = false;
  for (const [ch, [n, d]] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.endsWith(ch)) { num = n; den = d; s = s.slice(0, -1).trim(); matched = true; break; }
  }
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (mixed) { whole = +mixed[1]; num = +mixed[2]; den = +mixed[3]; matched = true; }
  else if (frac) { num = +frac[1]; den = +frac[2]; matched = true; }
  else if (s !== '') {
    const dec = s.replace(',', '.');
    if (!/^\d*\.?\d+$/.test(dec)) return null;
    const v = parseFloat(dec);
    if (!matched) {
      const decimals = (dec.split('.')[1] || '').length;
      return { value: v, precision: decimals ? { decimals } : { integer: true } };
    }
    whole = v;
  }
  if (!matched) return null;
  if (!den) return null;
  const value = whole + num / den;
  return { value, fraction: { whole, num, den }, precision: { den } };
}

const NUM_RE = '(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|\\d+[.,]\\d+|\\d+\\s*[½¼¾⅓⅔⅛⅜⅝⅞⅕⅙]|[½¼¾⅓⅔⅛⅜⅝⅞⅕⅙]|\\d+)';
const LEADING_RE = new RegExp(`^(${NUM_RE})(?:\\s*(?:[-–—]|à|to|ou|or)\\s*(${NUM_RE}))?\\s*(.*)$`, 'iu');

// Retourne { quantity, rest } : quantity = null si la ligne ne commence pas par un nombre.
export function extractLeadingQuantity(text) {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();
  const m = LEADING_RE.exec(raw);
  if (m) {
    const a = parseNumber(m[1]);
    const b = m[2] ? parseNumber(m[2]) : null;
    if (a) {
      const rawQty = raw.slice(0, raw.length - m[3].length).trim();
      const q = { raw: rawQty };
      if (b && b.value !== a.value) {
        q.min = Math.min(a.value, b.value); q.max = Math.max(a.value, b.value);
        q.precision = a.precision;
      } else {
        q.value = a.value;
        if (a.fraction) q.fraction = a.fraction;
        q.precision = a.precision;
      }
      return { quantity: q, rest: m[3] };
    }
  }
  for (const word of QUALITATIVE) {
    if (lower.startsWith(word)) return { quantity: { raw: raw.slice(0, word.length), qualitative: true }, rest: raw.slice(word.length).trim() };
  }
  return { quantity: null, rest: raw };
}

export function parseQuantity(text) {
  const { quantity, rest } = extractLeadingQuantity(text);
  if (quantity && rest.trim() === '') return quantity;
  const lower = (text || '').trim().toLowerCase();
  if (QUALITATIVE.some((w) => lower.includes(w))) return { raw: text.trim(), qualitative: true };
  return quantity ? { ...quantity, raw: text.trim() } : (text && text.trim() ? { raw: text.trim() } : null);
}

export function isNumeric(q) { return !!q && (typeof q.value === 'number' || typeof q.min === 'number'); }

export function scaleQuantity(q, factor) {
  if (!isNumeric(q) || !Number.isFinite(factor) || factor === 1) return q;
  const out = { ...q, scaled_from: q.raw, scale_factor: factor };
  delete out.fraction;
  if (typeof q.value === 'number') out.value = q.value * factor;
  if (typeof q.min === 'number') { out.min = q.min * factor; out.max = q.max * factor; }
  return out;
}

const NICE = [[1, 8], [1, 6], [1, 5], [1, 4], [1, 3], [3, 8], [1, 2], [5, 8], [2, 3], [3, 4], [5, 6], [7, 8]];
const FRACTION_CHARS = { '1/2': '½', '1/4': '¼', '3/4': '¾', '1/3': '⅓', '2/3': '⅔', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞', '1/5': '⅕', '1/6': '⅙' };

export function formatNumber(v, { fractions = true, locale = 'fr' } = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  if (fractions && v < 20) {
    const whole = Math.floor(v);
    const frac = v - whole;
    if (frac < 0.02) return String(whole);
    for (const [n, d] of NICE) {
      if (Math.abs(frac - n / d) < 0.02) {
        const ch = FRACTION_CHARS[`${n}/${d}`];
        return (whole ? whole : '') + (ch || `${whole ? ' ' : ''}${n}/${d}`);
      }
    }
  }
  const rounded = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  const s = String(rounded);
  return locale === 'fr' ? s.replace('.', ',') : s;
}

export function formatQuantity(q, opts = {}) {
  if (!q) return '';
  if (q.qualitative) return q.raw;
  if (typeof q.min === 'number') return `${formatNumber(q.min, opts)}–${formatNumber(q.max, opts)}`;
  if (typeof q.value === 'number') {
    if (q.fraction && !q.scaled_from) {
      const { whole, num, den } = q.fraction;
      const ch = FRACTION_CHARS[`${num}/${den}`];
      if (num) return (whole ? whole : '') + (ch || `${whole ? ' ' : ''}${num}/${den}`);
      return String(whole);
    }
    return formatNumber(q.value, opts);
  }
  return q.raw || '';
}

export function simplifyFraction(num, den) {
  const g = gcd(num, den) || 1;
  return [num / g, den / g];
}
