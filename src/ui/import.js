// Séance de scan continue (spec §16) : photos et fichiers conservés sur l'appareil, miniatures numérotées, regroupement,
// remplacement d'une page, entrées d'index, états fondés sur des événements réels. Aucune page n'est annoncée « sur le serveur ».
import { el, toast, pickFiles, confirmDialog, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { sha256Hex } from '../core/hash.js';
import { normalizeText } from '../domain/units.js';
import { providerFrom, extractIndexFromImages, blobToBase64 } from '../domain/llm.js';
import { pageHeader, section, emptyState, select, field, aiNotice } from './components.js';

const SMALL_IMAGE_BYTES = 80 * 1024;

export async function startScanSession(files, { edition_id = null, session_id = null } = {}) {
  let session = session_id ? await repo.get('scan_sessions', session_id) : null;
  if (!session) session = { id: repo.newId('ss'), status: 'open', edition_id, started_at: repo.nowIso(), page_ids: [], document_ids: [], device_id: deviceId() };
  const docs = [], pages = [];
  let position = session.page_ids.length;
  for (const file of files) {
    const sha256 = await sha256Hex(file);
    await repo.putFile(sha256, file, { original_filename: file.name });
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isEpub = file.type === 'application/epub+zip' || /\.epub$/i.test(file.name);
    const doc = { id: repo.newId('doc'), edition_id: session.edition_id || edition_id || null, source_type: isPdf ? 'pdf' : isEpub ? 'epub' : 'photo', original_filename: file.name, blob_path: `files/${sha256}`, sha256, size: file.size, mime: file.type, scan_session_id: session.id, captured_at: repo.nowIso() };
    docs.push(doc);
    session.document_ids.push(doc.id);
    if (!isPdf && !isEpub) {
      const issues = [];
      if (file.size < SMALL_IMAGE_BYTES) issues.push(t('Image très légère : possiblement floue ou trop petite'));
      const page = { id: repo.newId('pg'), document_id: doc.id, edition_id: doc.edition_id, sha256, printed_page: null, file_position: null, locator: null, position: ++position, issues, kind: null };
      pages.push(page);
      session.page_ids.push(page.id);
    }
  }
  session.status = 'open';
  await repo.saveBatch({ source_documents: docs, source_pages: pages, scan_sessions: [session] });
  toast(t('{n} fichier(s) conservé(s) sur cet appareil', { n: files.length }));
  navigate(`/import?session=${session.id}`);
  return session;
}

export function deviceId() {
  let id = localStorage.getItem('cuisineos.device');
  if (!id) { id = repo.newId('dev'); localStorage.setItem('cuisineos.device', id); }
  return id;
}

export async function renderImport(params, query, ctx) {
  if (!query.session) return sessionsList(ctx);
  const session = ctx.scan_sessions.find((s) => s.id === query.session);
  if (!session) return el('div', { class: 'card' }, t('Séance introuvable.'));
  return sessionView(session, ctx);
}

function sessionsList(ctx) {
  const open = ctx.scan_sessions.filter((s) => s.status === 'open').sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
  const root = el('div', null, pageHeader(t('Importer'), { back: { href: '/add', label: t('Ajouter') } }));
  root.append(el('div', { class: 'row', style: { marginBottom: '1rem' } },
    el('button', { class: 'btn primary', onClick: async () => { const f = await pickFiles({ accept: 'image/*', capture: 'environment' }); if (f.length) startScanSession(f); } }, t('Photographier des pages')),
    el('button', { class: 'btn', onClick: async () => { const f = await pickFiles({ accept: 'image/*,application/pdf,application/epub+zip' }); if (f.length) startScanSession(f); } }, t('Choisir des fichiers'))));
  if (!open.length) root.append(emptyState('📷', t('Aucune séance en cours.')));
  else root.append(section(t('Séances à reprendre'), ...open.map((s) => el('a', { class: 'item-link card flat', href: `#/import?session=${s.id}` },
    el('div', { class: 'row between' }, el('strong', null, `${t('Séance du')} ${formatDate(s.started_at, { withTime: true })}`), el('span', { class: 'muted' }, t('{n} page(s)', { n: s.page_ids.length }))),
    el('div', { class: 'muted', style: { fontSize: '.85rem' } }, s.edition_id ? ctx.editionLabel(ctx.editionsById.get(s.edition_id)) : t('Livre non associé'))))));
  return root;
}

function sessionView(session, ctx) {
  const pages = session.page_ids.map((id) => ctx.pagesById.get(id)).filter(Boolean);
  const docs = session.document_ids.map((id) => ctx.source_documents.find((d) => d.id === id)).filter(Boolean);
  const fileDocs = docs.filter((d) => d.source_type !== 'photo');
  const selected = new Set();
  const edition = session.edition_id ? ctx.editionsById.get(session.edition_id) : null;
  const root = el('div', null);
  root.append(pageHeader(t('Séance de scan'), { subtitle: `${t('Débutée le')} ${formatDate(session.started_at, { withTime: true })}`, back: { href: '/import', label: t('Séances') } }));

  // États fondés sur des événements réels : ce qui est effectivement écrit dans la base locale.
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    el('span', { class: 'status ok' }, t('{n} page(s) conservée(s) sur cet appareil', { n: pages.length })),
    fileDocs.length ? el('span', { class: 'status info' }, t('{n} fichier(s) PDF/EPUB', { n: fileDocs.length })) : null,
    el('span', { class: 'status info' }, t('Aucune synchronisation serveur configurée : sauvegarde via Réglages'))));

  // Livre associé
  const editionOptions = [{ value: '', label: t('— Aucun livre (à associer plus tard) —') }, ...ctx.book_editions.map((e) => ({ value: e.id, label: ctx.editionLabel(e) }))];
  root.append(el('div', { class: 'card flat row between' },
    field(t('Livre de cette séance'), select(editionOptions, session.edition_id || '', async (v) => {
      session.edition_id = v || null;
      const upd = { scan_sessions: [session], source_pages: pages.map((p) => ({ ...p, edition_id: session.edition_id })), source_documents: docs.map((d) => ({ ...d, edition_id: session.edition_id })) };
      await repo.saveBatch(upd); refresh();
    })),
    el('a', { class: 'btn small', href: '#/add' }, t('Nouveau livre'))));

  // Ajouter des pages
  root.append(el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    el('button', { class: 'btn primary', onClick: async () => { const f = await pickFiles({ accept: 'image/*', capture: 'environment' }); if (f.length) startScanSession(f, { session_id: session.id }); } }, t('+ Photographier')),
    el('button', { class: 'btn', onClick: async () => { const f = await pickFiles({ accept: 'image/*,application/pdf' }); if (f.length) startScanSession(f, { session_id: session.id }); } }, t('+ Fichiers'))));

  // Miniatures
  const thumbs = el('div', { class: 'thumbs' });
  const actions = el('div', { class: 'row', style: { margin: '.8rem 0' } });
  const drawActions = () => {
    actions.replaceChildren();
    const n = selected.size;
    actions.append(el('span', { class: 'muted' }, n ? t('{n} page(s) sélectionnée(s)', { n }) : t('Sélectionne des pages pour les regrouper.')));
    if (n) {
      const ids = [...selected].join(',');
      actions.append(
        el('a', { class: 'btn primary', href: `#/recipes/new${buildQuery({ pages: ids, edition: session.edition_id || '', session: session.id })}` }, t('Regrouper en recette')),
        el('button', { class: 'btn', onClick: () => { indexPanel.hidden = false; indexPanel.scrollIntoView({ behavior: 'smooth' }); } }, t('Index / table des matières')),
        n === 1 ? el('button', { class: 'btn', onClick: () => replacePage([...selected][0]) }, t('Remplacer cette page')) : null,
        el('button', { class: 'btn danger', onClick: () => removePages([...selected]) }, t('Retirer')));
    }
  };
  for (const p of pages) {
    const img = el('img', { alt: `${t('Page')} ${p.position}`, loading: 'lazy' });
    repo.getFile(p.sha256).then((f) => { if (f) img.src = URL.createObjectURL(f.blob); });
    const check = el('input', { type: 'checkbox', onChange: (e) => { if (e.target.checked) selected.add(p.id); else selected.delete(p.id); drawActions(); } });
    const pageInput = el('input', { type: 'number', placeholder: t('p. imprimée'), value: p.printed_page ?? '', style: { minHeight: '30px', padding: '.2rem .4rem', fontSize: '.8rem' }, onChange: async (e) => { p.printed_page = e.target.value ? parseInt(e.target.value, 10) : null; await repo.save('source_pages', p); } });
    thumbs.append(el('figure', null, el('span', { class: 'num' }, String(p.position)), img,
      el('figcaption', null, el('label', { class: 'check' }, check, p.kind ? t(p.kind === 'index' ? 'Index' : 'Recette') : t('Sélectionner')), pageInput,
        ...(p.issues || []).map((i) => el('div', { class: 'chip warn' }, i)))));
  }
  root.append(thumbs, actions);
  drawActions();

  // Fichiers PDF / EPUB
  if (fileDocs.length) {
    root.append(section(t('Fichiers'), ...fileDocs.map((d) => {
      const box = el('div', { class: 'card flat stack' },
        el('div', { class: 'row between' }, el('strong', null, d.original_filename), el('span', { class: 'badge' }, d.source_type.toUpperCase())),
        el('div', { class: 'row' },
          el('a', { class: 'btn primary', href: `#/recipes/new${buildQuery({ doc: d.id, edition: session.edition_id || '', session: session.id })}` }, t('Créer une recette depuis ce fichier')),
          el('button', { class: 'btn', onClick: () => { indexPanel.hidden = false; indexPanel.dataset.doc = d.id; indexPanel.scrollIntoView({ behavior: 'smooth' }); } }, t('Indexer le livre'))));
      if (d.source_type === 'pdf') {
        const frame = el('iframe', { class: 'pdf', title: d.original_filename });
        repo.getFile(d.sha256).then((f) => { if (f) frame.src = URL.createObjectURL(f.blob); });
        box.append(frame);
      } else box.append(el('p', { class: 'muted' }, t('EPUB conservé. La lecture intégrée n’est pas encore disponible : indexe les recettes à la main ou exporte les pages en images.')));
      return box;
    })));
  }

  // Entrées d'index
  const indexPanel = indexEntriesPanel(session, ctx, () => [...selected]);
  indexPanel.hidden = true;
  root.append(indexPanel);

  root.append(el('div', { class: 'row', style: { marginTop: '1rem' } },
    el('button', { class: 'btn', onClick: async () => { session.status = 'done'; await repo.save('scan_sessions', session); toast(t('Séance terminée')); navigate(session.edition_id ? `/books/${session.edition_id}` : '/library'); } }, t('Terminer la séance')),
    el('span', { class: 'muted' }, t('Une séance interrompue reste disponible dans Importer.'))));

  async function replacePage(pageId) {
    const files = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' });
    if (!files.length) return;
    const p = ctx.pagesById.get(pageId);
    const file = files[0];
    const sha256 = await sha256Hex(file);
    await repo.putFile(sha256, file, { original_filename: file.name });
    const doc = { id: repo.newId('doc'), edition_id: p.edition_id, source_type: 'photo', original_filename: file.name, blob_path: `files/${sha256}`, sha256, size: file.size, mime: file.type, scan_session_id: session.id, captured_at: repo.nowIso(), replaces_document_id: p.document_id };
    const issues = file.size < SMALL_IMAGE_BYTES ? [t('Image très légère : possiblement floue ou trop petite')] : [];
    await repo.saveBatch({ source_documents: [doc], source_pages: [{ ...p, document_id: doc.id, sha256, issues, replaced_at: repo.nowIso() }] });
    toast(t('Page remplacée')); refresh();
  }
  async function removePages(ids) {
    const used = ids.filter((id) => ctx.recipes.some((r) => (r.source_page_ids || []).includes(id)));
    if (used.length) { toast(t('{n} page(s) déjà liée(s) à une recette : retire d’abord la recette.', { n: used.length })); return; }
    if (!(await confirmDialog(t('Retirer {n} page(s) de la séance ? Les fichiers restent dans la base tant qu’une autre référence existe.', { n: ids.length }), { danger: true, okLabel: t('Retirer') }))) return;
    session.page_ids = session.page_ids.filter((id) => !ids.includes(id));
    await repo.db.deleteMany('source_pages', ids);
    await repo.save('scan_sessions', session);
    refresh();
  }
  return root;
}

// Panneau d'entrées d'index : « Titre — 132 » par ligne ; création de références (reference_only) sans inventer d'ingrédients.
export function indexEntriesPanel(session, ctx, getSelectedPageIds, { editionId = null } = {}) {
  const panel = el('div', { class: 'card stack' }, el('h2', null, t('Entrées d’index ou de table des matières')));
  const ta = el('textarea', { placeholder: 'Magret de canard aux cerises — 132\nSalade de fenouil, p. 58\n212 Pâtes puttanesca', rows: 8 });
  const preview = el('div', null);
  const status = el('div', { class: 'muted' });
  const provider = providerFrom(ctx.settings);
  const parse = () => parseIndexLines(ta.value);
  const draw = () => {
    const entries = parse();
    preview.replaceChildren(entries.length ? el('ul', { class: 'list plain' }, ...entries.map((e) => el('li', null, el('strong', null, e.title), e.printed_page ? el('span', { class: 'muted' }, ` — ${t('page')} ${e.printed_page}`) : el('span', { class: 'chip warn' }, t('page inconnue'))))) : null);
  };
  ta.addEventListener('input', draw);
  const aiBtn = el('button', { class: 'btn', disabled: !provider.configured, onClick: async () => {
    const ids = getSelectedPageIds();
    if (!ids.length) { toast(t('Sélectionne les pages d’index à lire')); return; }
    status.textContent = t('Lecture des pages par l’assistant…');
    try {
      const images = [];
      for (const id of ids) { const p = ctx.pagesById.get(id); const f = await repo.getFile(p.sha256); images.push({ mime: f.mime, base64: await blobToBase64(f.blob) }); }
      const res = await extractIndexFromImages(provider, images);
      ta.value = res.entries.map((e) => `${e.title} — ${e.printed_page ?? ''}`).join('\n');
      status.textContent = t('{n} entrée(s) proposée(s) par l’assistant — vérifie avant de créer.', { n: res.entries.length }) + (res.uncertain.length ? ` ${t('Incertain')} : ${res.uncertain.join('; ')}` : '');
      draw();
    } catch (e) { status.textContent = `${t('Échec')} : ${e.message}`; }
  } }, t('Lire avec l’assistant IA'));
  const create = async () => {
    const edId = editionId || session?.edition_id;
    if (!edId) { toast(t('Associe d’abord un livre à cette séance')); return; }
    const entries = parse();
    if (!entries.length) return;
    const edition = ctx.editionsById.get(edId);
    const existing = ctx.recipes.filter((r) => r.edition_id === edId);
    const key = (title, page) => `${normalizeText(title)}|${page ?? ''}`;
    const seen = new Set(existing.map((r) => key(r.original_title, r.printed_page)));
    const pageIds = getSelectedPageIds().filter((id) => ctx.pagesById.get(id));
    const created = [];
    let dupes = 0;
    for (const e of entries) {
      const k = key(e.title, e.printed_page);
      if (seen.has(k)) { dupes++; continue; }
      seen.add(k);
      created.push({ id: repo.newId('rc'), edition_id: edId, original_title: e.title, original_language: edition?.language || null, availability: 'reference_only', verification_state: 'unverified', printed_page: e.printed_page, section: e.section || null, type: null, tags: [], cuisines: [], favorite: false, source_page_ids: pageIds, current_version_id: null, ingredient_ids: [] });
    }
    if (pageIds.length) await repo.saveBatch({ source_pages: pageIds.map((id) => ({ ...ctx.pagesById.get(id), kind: 'index' })) });
    if (created.length) await repo.saveBatch({ recipes: created });
    toast(t('{n} référence(s) créée(s){d}', { n: created.length, d: dupes ? `, ${t('{n} doublon(s) ignoré(s)', { n: dupes })}` : '' }));
    ta.value = ''; draw(); refresh();
  };
  panel.append(el('p', { class: 'muted' }, t('Une ligne par recette : titre puis numéro de page. Un titre ne suffit pas à déduire des ingrédients : ces entrées deviennent des références « Repérée dans ton livre ».')),
    aiNotice(ctx), ta, el('div', { class: 'row' }, aiBtn, el('button', { class: 'btn primary', onClick: create }, t('Créer les références'))), status, preview);
  return panel;
}

export function parseIndexLines(text) {
  const out = [];
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m = /^(.*?)\s*(?:[—–-]|,|\.{2,}|\s+p\.?|\s+page)\s*p?\.?\s*(\d{1,4})\s*$/i.exec(line);
    if (m && m[1].trim()) { out.push({ title: m[1].trim().replace(/[,.]+$/, ''), printed_page: parseInt(m[2], 10) }); continue; }
    m = /^(\d{1,4})\s+(.+)$/.exec(line);
    if (m) { out.push({ title: m[2].trim(), printed_page: parseInt(m[1], 10) }); continue; }
    out.push({ title: line, printed_page: null });
  }
  return out;
}
