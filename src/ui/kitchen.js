import { creerInventaire } from './inventaire.js';
// Ma cuisine : registre d'appareils par capacités (spec §5) et inventaire de lots (spec §10, MVP).
import { el, toast, confirmDialog, promptDialog, formatDate } from '../core/dom.js';
import { t, label } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { APPLIANCE_PRESETS } from '../model/seed.js';
import { CAPABILITIES } from '../model/schema.js';
import { pageHeader, section, segmented, field, select, emptyState } from './components.js';

export async function renderKitchen(params, query, ctx, deps = {}) {
  const tab = query.tab || 'appliances';
  const root = el('div', null, pageHeader(t('Ma cuisine')),
    el('div', { style: { marginBottom: '1rem' } }, segmented([{ value: 'appliances', label: t('Appareils') }, { value: 'inventory', label: t('Inventaire') }], tab, (v) => navigate('/kitchen' + buildQuery({ tab: v })))));
  const contenu = tab === 'inventory' ? await creerInventaire({ctx,query,...deps}) : appliancesTab(ctx);
  root.append(contenu); root.dispose=()=>contenu.dispose?.(); root.actualiser=()=>contenu.actualiser?.();
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
