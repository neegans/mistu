// Petit constructeur DOM : les contenus utilisateur passent toujours par textContent (pas d'innerHTML).

export function el(tag, attrs = null, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'multiple' || k === 'open' || k === 'readOnly') node[k] = !!v;
      else if (k === 'value') node.value = v;
      else if (k === 'html') node.innerHTML = v; // réservé aux chaînes internes constantes
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function replace(node, ...children) {
  clear(node);
  return append(node, children);
}

let toastTimer = null;
export function toast(message, ms = 2800) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = el('div', { class: 'toast', role: 'status' });
    document.body.append(t);
  }
  t.textContent = message;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, ms);
}

// Boîtes de dialogue basées sur <dialog>, avec repli sur window.confirm/prompt.
export function confirmDialog(message, { okLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false, body = null } = {}) {
  if (typeof HTMLDialogElement === 'undefined') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    const dlg = el('dialog', null,
      el('p', { style: { fontWeight: '600' } }, message),
      body,
      el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '.8rem' } },
        el('button', { class: 'btn', onClick: () => { dlg.close(); resolve(false); } }, cancelLabel),
        el('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onClick: () => { dlg.close(); resolve(true); } }, okLabel)));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(false); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function promptDialog(message, { value = '', placeholder = '', okLabel = 'OK', multiline = false } = {}) {
  if (typeof HTMLDialogElement === 'undefined') return Promise.resolve(window.prompt(message, value));
  return new Promise((resolve) => {
    const input = multiline
      ? el('textarea', { placeholder, value })
      : el('input', { type: 'text', placeholder, value });
    const dlg = el('dialog', null,
      el('p', { style: { fontWeight: '600' } }, message),
      input,
      el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '.8rem' } },
        el('button', { class: 'btn', onClick: () => { dlg.close(); resolve(null); } }, 'Annuler'),
        el('button', { class: 'btn primary', onClick: () => { const v = input.value; dlg.close(); resolve(v); } }, okLabel)));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(null); });
    document.body.append(dlg);
    dlg.showModal();
    setTimeout(() => input.focus(), 30);
  });
}

// Choix parmi une liste : options = [{value, label, hint?}] ; retourne value ou null.
export function chooseDialog(message, options, { okLabel = 'Choisir' } = {}) {
  return new Promise((resolve) => {
    const select = el('select', null, ...options.map((o) => el('option', { value: o.value }, o.label + (o.hint ? ` — ${o.hint}` : ''))));
    const dlg = el('dialog', null,
      el('p', { style: { fontWeight: '600' } }, message),
      select,
      el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '.8rem' } },
        el('button', { class: 'btn', onClick: () => { dlg.close(); resolve(null); } }, 'Annuler'),
        el('button', { class: 'btn primary', onClick: () => { const v = select.value; dlg.close(); resolve(v); } }, okLabel)));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(null); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}

export function pickFiles({ accept = '*/*', multiple = true, capture = null } = {}) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    if (capture) input.setAttribute('capture', capture);
    input.addEventListener('change', () => { resolve([...input.files]); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

export function formatDate(iso, { withTime = false } = {}) {
  if (!iso) return '';
  // I2 : une date de cuisson saisie après coup n'a pas d'heure. Date.parse la lirait en UTC,
  // donc la veille au Québec ; la construire au midi local conserve le jour, sans afficher cette heure technique.
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [annee, mois, jour] = iso.split('-').map(Number);
    const civile = new Date(0); civile.setFullYear(annee, mois - 1, jour); civile.setHours(12, 0, 0, 0);
    if (civile.getFullYear() !== annee || civile.getMonth() !== mois - 1 || civile.getDate() !== jour) return '';
    return new Intl.DateTimeFormat(document.documentElement.lang || 'fr-CA', { dateStyle: 'medium' }).format(civile);
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts = withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
  return new Intl.DateTimeFormat(document.documentElement.lang || 'fr-CA', opts).format(d);
}

export function formatMinutes(min) {
  if (min === null || min === undefined || Number.isNaN(min)) return '';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}
