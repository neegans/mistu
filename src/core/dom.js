import { t } from './i18n.js';

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
  }
  const contenant = document.querySelector('.coquille') || document.body;
  if (t.parentNode !== contenant) contenant.append(t);
  t.textContent = message;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, ms);
}

// Présentation uniquement : aucune décision ni écriture métier n'appartient à ce helper.
let prochainTitreDialogue = 0, sequenceDialogues = 0;
const visibleUtilisable = node => !!(node?.isConnected && !node.disabled && !node.closest('[hidden],[inert]') && node.getClientRects().length);
function focuserDialogue(node) {
  if (!visibleUtilisable(node)) return false;
  if (!node.matches('a[href],button,input,select,textarea,[tabindex]')) node.tabIndex = -1;
  node.focus(); return document.activeElement === node;
}
export function ouvrirDialogue(dlg, { titre = null, focusInitial = null, retourFocus = null, estCourante = () => true } = {}) {
  if (estCourante() === false) { dlg.dispatchEvent(new Event('cancel', { cancelable: true })); return { fermer() {}, dispose() {}, mode: 'ignore' }; }
  const avant = document.activeElement, main = avant?.closest('main') || document.querySelector('main'), route = location.hash;
  const titreNode = titre instanceof Element ? titre : dlg.querySelector('h1,h2,h3');
  if (titreNode) {
    if (!titreNode.id) titreNode.id = `dialogue-titre-${++prochainTitreDialogue}`;
    dlg.setAttribute('aria-labelledby', titreNode.id); dlg.removeAttribute('aria-label');
  } else if (typeof titre === 'string' && titre) dlg.setAttribute('aria-label', titre);
  let mode = 'modal', termine = false, detruit = false, observer;
  ++sequenceDialogues;
  const nettoyer = () => { observer?.disconnect(); dlg.removeEventListener('close', fermetureNative); dlg.removeEventListener('keydown', clavier); };
  const restaurer = () => {
    const sequence = sequenceDialogues, focusAvantRetour = document.activeElement;
    // Les continuations de fermeture peuvent réactiver le déclencheur dans leur finally.
    queueMicrotask(() => queueMicrotask(() => {
      if (detruit || sequence !== sequenceDialogues || location.hash !== route || estCourante() === false) return;
      if (document.activeElement !== focusAvantRetour && document.activeElement !== document.body && visibleUtilisable(document.activeElement)) return;
      const cible = typeof retourFocus === 'function' ? retourFocus() : retourFocus || avant;
      if (focuserDialogue(cible)) return;
      const parent = [...document.querySelectorAll('dialog[open]')].at(-1);
      if (parent && parent !== dlg && focuserDialogue(parent.querySelector('h1,h2,h3') || parent)) return;
      const courant = main?.isConnected ? main : document.querySelector('main');
      focuserDialogue(courant?.querySelector('h1') || courant);
    }));
  };
  const terminer = () => { if (termine) return; termine = true; nettoyer(); restaurer(); };
  function fermetureNative() { terminer(); }
  function clavier(event) {
    if (mode !== 'inline' || event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    if (dlg.dispatchEvent(new Event('cancel', { cancelable: true }))) fermer();
  }
  function fermer() {
    if (termine) return;
    if (mode === 'modal') { try { dlg.close(); } catch {} terminer(); }
    else { dlg.removeAttribute('open'); terminer(); dlg.dispatchEvent(new Event('close')); }
  }
  const dispose = () => { detruit = true; nettoyer(); };
  if (!dlg.isConnected) document.body.append(dlg);
  dlg.addEventListener('close', fermetureNative); dlg.addEventListener('keydown', clavier);
  try { if (typeof HTMLDialogElement === 'undefined' || typeof dlg.showModal !== 'function') throw new Error('dialogue_indisponible'); dlg.showModal(); }
  catch { mode = 'inline'; dlg.setAttribute('open', ''); dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'false'); dlg.classList.add('dialogue-inline'); }
  observer = new MutationObserver(() => { if (!dlg.isConnected) dispose(); });
  observer.observe(document.body, { childList: true, subtree: true });
  const cible = typeof focusInitial === 'function' ? focusInitial() : focusInitial;
  if (estCourante() !== false) focuserDialogue(cible || dlg.querySelector('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]') || titreNode || dlg);
  return { fermer, dispose, mode };
}

// Signatures historiques conservées. Le choix explicite reste identique dans les replis.
function dialogueSimple(message, { body = null, input = null, okLabel, cancelLabel, danger = false, annulation = null, valeur = () => true, repliNatif = null } = {}) {
  return new Promise(resolve => {
    const titre = el('h2', null, message), route = location.hash;
    if (input) { if (!input.id) input.id = `dialogue-champ-${++prochainTitreDialogue}`; }
    const label = input ? el('label', { for: input.id, class: 'dialogue-label' }, message) : null;
    const dlg = el('dialog', null, titre, body, label, input);
    let fini = false, presentation;
    const finir = resultat => {
      if (fini) return; fini = true;
      window.removeEventListener('hashchange', quitter);
      dlg.removeEventListener('close', annuler);
      presentation?.fermer(); dlg.remove(); resolve(resultat);
    };
    const annuler = () => finir(annulation), quitter = () => { if (location.hash !== route) annuler(); };
    const non = el('button', { type: 'button', class: 'btn', onClick: annuler }, cancelLabel);
    const oui = el('button', { type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`, onClick: () => finir(valeur()) }, okLabel);
    dlg.append(el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '.8rem' } }, non, oui));
    dlg.addEventListener('close', annuler); dlg.addEventListener('cancel', event => { event.preventDefault(); annuler(); });
    window.addEventListener('hashchange', quitter);
    presentation = ouvrirDialogue(dlg, { titre, focusInitial: input || non });
    if (presentation.mode === 'inline' && repliNatif) finir(repliNatif());
  });
}
export function confirmDialog(message, { okLabel = t('Confirmer'), cancelLabel = t('Annuler'), danger = false, body = null } = {}) {
  return dialogueSimple(message, { body, okLabel, cancelLabel, danger, annulation: false, repliNatif: body == null ? () => window.confirm(message) : null });
}
export function promptDialog(message, { value = '', placeholder = '', okLabel = t('OK'), multiline = false } = {}) {
  const input = el(multiline ? 'textarea' : 'input', { ...(multiline ? {} : { type: 'text' }), placeholder, value });
  return dialogueSimple(message, { input, okLabel, cancelLabel: t('Annuler'), annulation: null, valeur: () => input.value, repliNatif: () => window.prompt(message, value) });
}
// options = [{value,label,hint?}] ; retourne la valeur choisie ou null.
export function chooseDialog(message, options, { okLabel = t('Choisir') } = {}) {
  const input = el('select', null, ...options.map(o => el('option', { value: o.value }, o.label + (o.hint ? ` — ${o.hint}` : ''))));
  return dialogueSimple(message, { input, okLabel, cancelLabel: t('Annuler'), annulation: null, valeur: () => input.value });
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
