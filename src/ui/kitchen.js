import { capturerRecette } from './recette-garde.js';
import { mentionCycleRecette, TEXTE_NOUVEL_USAGE_REFUSE } from './corbeille.js';
import { recettesActives } from './state.js';
// Ma cuisine : registre d'appareils par capacités (spec §5) et inventaire de lots (spec §10, MVP).
import { el, toast, confirmDialog, promptDialog, formatDate } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { APPLIANCE_PRESETS } from '../model/seed.js';
import { CAPABILITIES } from '../model/schema.js';
import { pageHeader, section, segmented, field, select, emptyState } from './components.js';

export async function renderKitchen(params, query, ctx) {
  const tab = query.tab || 'appliances';
  const root = el('div', null, pageHeader(t('Ma cuisine')),
    el('div', { style: { marginBottom: '1rem' } }, segmented([{ value: 'appliances', label: t('Appareils') }, { value: 'inventory', label: t('Inventaire') }], tab, (v) => navigate('/kitchen' + buildQuery({ tab: v })))));
  root.append(tab === 'inventory' ? inventoryTab(ctx, query) : appliancesTab(ctx));
  return root;
}

function appliancesTab(ctx) {
  const root = el('div', null);
  root.append(el('p', { class: 'muted' }, t('Le moteur raisonne sur les capacités, pas sur la marque. Les adaptations aux appareils arrivent au palier V1 ; le registre se prépare dès maintenant.')));
  const addRow = el('div', { class: 'row', style: { marginBottom: '.8rem' } },
    select([{ value: '', label: t('Ajouter un appareil courant…') }, ...APPLIANCE_PRESETS.map((p, i) => ({ value: String(i), label: p.name }))], '', async (v) => {
      if (v === '') return;
      const p = APPLIANCE_PRESETS[Number(v)];
      await repo.save('appliances', { id: repo.newId('app'), name: p.name, brand: p.brand, model: p.model, capabilities: [...p.capabilities], notes: '' });
      toast(t('Appareil ajouté')); refresh();
    }),
    el('button', { class: 'btn', onClick: async () => { const name = await promptDialog(t('Nom de l’appareil')); if (!name) return; await repo.save('appliances', { id: repo.newId('app'), name: name.trim(), brand: '', model: '', capabilities: [], notes: '' }); refresh(); } }, t('Appareil personnalisé')));
  root.append(addRow);
  if (!ctx.appliances.length) { root.append(emptyState('toque', t('Aucun appareil enregistré.'))); return root; }
  for (const a of [...ctx.appliances].sort((x, y) => x.name.localeCompare(y.name))) {
    const caps = new Set(a.capabilities || []);
    root.append(el('details', { class: 'card' },
      el('summary', null, el('strong', null, a.name), a.brand || a.model ? el('span', { class: 'muted' }, ` · ${[a.brand, a.model].filter(Boolean).join(' ')}`) : null,
        el('div', { class: 'chips', style: { marginTop: '.3rem' } }, ...[...caps].map((c) => el('span', { class: 'chip' }, label('capability', c))))),
      el('div', { class: 'stack', style: { marginTop: '.8rem' } },
        el('div', { class: 'two-col' },
          field(t('Nom'), el('input', { type: 'text', value: a.name, onChange: (e) => { a.name = e.target.value; } })),
          field(t('Marque'), el('input', { type: 'text', value: a.brand || '', onChange: (e) => { a.brand = e.target.value; } })),
          field(t('Modèle'), el('input', { type: 'text', value: a.model || '', onChange: (e) => { a.model = e.target.value; } })),
          field(t('Notes (capacité, volume utile…)'), el('input', { type: 'text', value: a.notes || '', onChange: (e) => { a.notes = e.target.value; } }))),
        el('div', { class: 'chips' }, ...CAPABILITIES.map((c) => el('label', { class: `chip clickable ${caps.has(c) ? '' : 'outline'}` }, el('input', { type: 'checkbox', checked: caps.has(c), style: { display: 'none' }, onChange: (e) => { if (e.target.checked) caps.add(c); else caps.delete(c); e.target.parentNode.className = `chip clickable ${caps.has(c) ? '' : 'outline'}`; } }), label('capability', c)))),
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onClick: async () => { await repo.save('appliances', { ...a, capabilities: [...caps] }); toast(t('Enregistré')); refresh(); } }, t('Enregistrer')),
          el('button', { class: 'btn danger', onClick: async () => { if (await confirmDialog(t('Supprimer « {n} » ?', { n: a.name }), { danger: true, okLabel: t('Supprimer') })) { await repo.remove('appliances', a.id); refresh(); } } }, t('Supprimer'))))));
  }
  return root;
}

function inventoryTab(ctx, query) {
  const root = el('div', null);
  root.append(el('div', { class: 'status warn', style: { marginBottom: '.8rem' } }, t('Les durées de conservation ne sont pas calculées : le moteur de salubrité sourcé arrive au palier V1. Indique toi-même la date limite.')));
  const f = { label: '', quantity_text: '', portions: '', location: 'congelateur', prepared_at: new Date().toISOString().slice(0, 10), use_by: '', source_recipe_version_id: '', reheat: '', quality: '', notes: '' };
  const versionOptions = [{ value: '', label: t('— aucune recette source —') }, ...ctx.recipe_versions.filter(v => recettesActives(ctx).some(r => r.id === v.recipe_id)).map((v) => { const r = ctx.recipesById.get(v.recipe_id); return { value: v.id, label: `${r?.original_title || '?'} · ${label('version_kind', v.kind)} ${formatDate(v.created_at)}` }; }).sort((a, b) => a.label.localeCompare(b.label))];
  const form = el('details', { class: 'card', open: query.add === '1' }, el('summary', null, el('strong', null, t('Ajouter un lot'))),
    el('div', { class: 'two-col', style: { marginTop: '.8rem' } },
      field(t('Quoi *'), el('input', { type: 'text', placeholder: t('Bœuf braisé'), onInput: (e) => { f.label = e.target.value; } })),
      field(t('Quantité (texte)'), el('input', { type: 'text', placeholder: '4 portions / 800 g', onInput: (e) => { f.quantity_text = e.target.value; } })),
      field(t('Portions'), el('input', { type: 'number', min: 0, onInput: (e) => { f.portions = e.target.value; } })),
      field(t('Emplacement'), select([{ value: 'congelateur', label: t('Congélateur') }, { value: 'frigo', label: t('Frigo') }, { value: 'garde_manger', label: t('Garde-manger') }], f.location, (v) => { f.location = v; })),
      field(t('Préparé / congelé le'), el('input', { type: 'date', value: f.prepared_at, onInput: (e) => { f.prepared_at = e.target.value; } })),
      field(t('À consommer avant le'), el('input', { type: 'date', onInput: (e) => { f.use_by = e.target.value; } })),
      field(t('Recette source (version)'), select(versionOptions, '', (v) => { f.source_recipe_version_id = v; })),
      field(t('Méthode de réchauffage'), el('input', { type: 'text', placeholder: t('Four 160 °C couvert, 25 min'), onInput: (e) => { f.reheat = e.target.value; } })),
      field(t('Qualité attendue'), el('input', { type: 'text', placeholder: t('Très bonne ; sauce à détendre'), onInput: (e) => { f.quality = e.target.value; } })),
      field(t('Notes'), el('input', { type: 'text', onInput: (e) => { f.notes = e.target.value; } }))),
    el('div', { class: 'row', style: { marginTop: '.8rem' } }, el('button', { class: 'btn primary', onClick: async () => {
      if (!f.label.trim()) { toast(t('Indique quoi')); return; }
      try {
      const v = f.source_recipe_version_id ? ctx.versionsById.get(f.source_recipe_version_id) : null;
      const recettes = v ? [await capturerRecette(repo, ctx.recipesById.get(v.recipe_id), {ctx})] : [];
      await repo.save('inventory', { id: repo.newId('inv'), label: f.label.trim(), ingredient_id: null, source_recipe_version_id: v?.id || null, source_recipe_id: v?.recipe_id || null, quantity_text: f.quantity_text.trim(), portions: f.portions ? Number(f.portions) : null, location: f.location, prepared_at: f.prepared_at ? new Date(f.prepared_at).toISOString() : null, use_by: f.use_by ? new Date(f.use_by).toISOString() : null, use_by_origin: f.use_by ? 'user' : null, reheat_method: f.reheat.trim(), expected_quality: f.quality.trim(), notes: f.notes.trim() }, {recettes});
      toast(t('Lot ajouté')); navigate('/kitchen?tab=inventory');
      } catch { toast(t(TEXTE_NOUVEL_USAGE_REFUSE)); }
    } }, t('Ajouter'))));
  root.append(form);
  const lots = [...ctx.inventory].sort((a, b) => (a.use_by || '9').localeCompare(b.use_by || '9'));
  if (!lots.length) { root.append(emptyState('flocon', t('Inventaire vide. Exemple : « J’ai congelé quatre portions de bœuf braisé. »'))); return root; }
  for (const loc of ['congelateur', 'frigo', 'garde_manger']) {
    const rows = lots.filter((l) => l.location === loc);
    if (!rows.length) continue;
    root.append(section({ congelateur: t('Congélateur'), frigo: t('Frigo'), garde_manger: t('Garde-manger') }[loc], el('ul', { class: 'list' }, ...rows.map((l) => {
      const r = ctx.recipesById.get(l.source_recipe_id || ctx.versionsById.get(l.source_recipe_version_id)?.recipe_id) || null;
      const late = l.use_by && Date.parse(l.use_by) < Date.now();
      return el('li', { class: 'row between top' },
        el('div', null, el('strong', null, l.label), l.quantity_text ? ` — ${l.quantity_text}` : '', l.portions ? ` · ${l.portions} ${t('portions')}` : '',
          el('div', { class: 'muted', style: { fontSize: '.85rem' } }, [l.prepared_at ? `${t('préparé le')} ${formatDate(l.prepared_at)}` : null, l.use_by ? `${t('avant le')} ${formatDate(l.use_by)}` : t('date limite non indiquée'), r ? `${t('source')} : ${r.original_title}` : null, l.reheat_method ? `${t('réchauffage')} : ${l.reheat_method}` : null, l.expected_quality ? `${t('qualité')} : ${l.expected_quality}` : null].filter(Boolean).join(' · ')),
          r ? mentionCycleRecette(r) : null,
          late ? el('span', { class: 'chip danger' }, t('date dépassée')) : null),
        el('div', { class: 'row' },
          r ? el('a', { class: 'btn small', href: `#/recipes/${r.id}` }, t('Recette')) : null,
          l.portions > 1 ? el('button', { class: 'btn small', onClick: async () => { try { const recettes = r ? [await capturerRecette(repo,r,{ctx,historique:true})] : []; await repo.save('inventory', { ...l, portions: l.portions - 1 }, {recettes}); refresh(); } catch { toast(t('La recette a changé. Recharge sa fiche avant de réessayer.')); } } }, t('−1 portion')) : null,
          el('button', { class: 'btn small', onClick: async () => { try { const recettes = r ? [await capturerRecette(repo,r,{ctx,historique:true})] : []; await repo.remove('inventory', l.id, {recettes}); refresh(); } catch { toast(t('La recette a changé. Recharge sa fiche avant de réessayer.')); } } }, t('Consommé'))));
    }))));
  }
  return root;
}
