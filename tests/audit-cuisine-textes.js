import { renderKitchen } from '../src/ui/kitchen.js';
import { getData } from '../src/ui/state.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';
import { APPLIANCE_PRESETS } from '../src/model/seed.js';
import { CAPABILITIES } from '../src/model/schema.js';
import { withRepo } from './sync-fixture.js';
import { CHAINES_NEUVES_AILLEURS } from './ajouter.js';

const CLES_CUISINE = ['Ma cuisine', 'Appareils', 'Inventaire', 'Tes appareils, pour adapter les recettes.', 'Ajouter un appareil courant…', 'Appareil ajouté', 'Nom de l’appareil', 'Appareil personnalisé', 'Aucun appareil enregistré.', 'Nom', 'Marque', 'Modèle', 'Notes (capacité, volume utile…)', 'Enregistré', 'Enregistrer', 'Supprimer « {n} » ?', 'Supprimer'];
const bouton = (root, texte) => [...root.querySelectorAll('button')].find(b => b.textContent === texte);
const changer = (input, valeur) => { input.value = valeur; input.dispatchEvent(new Event('change', { bubbles: true })); };
const dialogue = () => [...document.querySelectorAll('dialog[open]')].at(-1);
// Le gestionnaire émet refresh après l'écriture durable ; ne pas nettoyer la base
// après un nombre arbitraire de ticks, alors qu'un save/remove serait encore en vol.
const apresConservation = geste => new Promise((resolve, reject) => {
  const nettoyer = () => { clearTimeout(delai); window.removeEventListener('cuisineos:refresh', termine); };
  const termine = () => { nettoyer(); resolve(); };
  const delai = setTimeout(() => { nettoyer(); reject(new Error('Cuisine : aucune actualisation après le geste')); }, 3000);
  window.addEventListener('cuisineos:refresh', termine, { once: true });
  try { geste(); } catch (e) { nettoyer(); reject(e); }
});

export async function runAuditCuisineTextesTests({ eq, ok }) {
  const langue = getUiLocale(), racines = [];
  const nettoyer = () => {
    document.querySelectorAll('dialog[open]').forEach(d => d.dispatchEvent(new Event('cancel', { cancelable: true })));
    racines.splice(0).forEach(r => { r.dispose?.(); r.remove(); });
  };
  const monter = async query => { const r = await renderKitchen({}, query, await getData(true)); document.body.append(r); racines.push(r); return r; };
  const run = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, `Cuisine11.5 ${nom} : ${e.stack || e}`); } finally { nettoyer(); } };
  try {
    setUiLocale('fr');
    eq([...(CHAINES_NEUVES_AILLEURS['../src/ui/kitchen.js'] || [])].sort(), [...CLES_CUISINE].sort(), 'Cuisine11.5 : le filet déclare les 17 clés du module');
    await run('onglets', async (repo, db) => {
      const appareil = { id: 'cuisine-fixture', name: 'Mon four', brand: 'Marque personnelle', model: 'M', notes: 'Note conservée', capabilities: ['bake'] };
      await db.mutate({ origin: 'remote', puts: { appliances: [appareil] } });
      const avant = await Promise.all(['appliances', 'inventory', 'outbox'].map(s => db.getAll(s)));
      for (const [nom, query] of [['défaut', {}], ['vide', { tab: '' }], ['inconnu', { tab: 'autre' }], ['explicite', { tab: 'inventory' }]]) {
        const r = await monter(query);
        eq(r.querySelector('[data-value=inventory]')?.getAttribute('aria-pressed'), 'true', `Cuisine11.5 ${nom} : Inventaire sélectionné`);
        ok(!!r.querySelector('[data-role=ajouter-lot]') && !r.querySelector('details.card'), `Cuisine11.5 ${nom} : vrai inventaire affiché, sans registre appareils`);
        r.dispose?.(); r.remove();
      }
      const r = await monter({ tab: 'appliances' });
      eq(r.querySelector('[data-value=appliances]')?.getAttribute('aria-pressed'), 'true', 'Cuisine11.5 : lien Appareils explicite conservé');
      eq(r.querySelector('p.muted')?.textContent, 'Tes appareils, pour adapter les recettes.', 'Cuisine11.5 : introduction simple exacte');
      eq(r.querySelector('summary strong')?.textContent, appareil.name, 'Cuisine11.5 : registre affiché depuis le vrai dépôt');
      eq(await Promise.all(['appliances', 'inventory', 'outbox'].map(s => db.getAll(s))), avant, 'Cuisine11.5 : lecture des onglets sans écriture métier ni envoi');
    });
    await run('anglais et gestes réels', async (repo, db) => {
      setUiLocale('en');
      let r = await monter({ tab: 'appliances' });
      eq(r.querySelector('h1')?.textContent, 'My kitchen', 'Cuisine11.5 EN : titre');
      eq([...r.querySelectorAll('.segmented button')].map(b => b.textContent), ['Appliances', 'Inventory'], 'Cuisine11.5 EN : onglets');
      eq(r.querySelector('p.muted')?.textContent, 'Your appliances, for adapting recipes.', 'Cuisine11.5 EN : introduction');
      eq(r.querySelector('select option[value=""]')?.textContent, 'Add a common appliance…', 'Cuisine11.5 EN : invitation du modèle');
      ok(!!bouton(r, 'Custom appliance'), 'Cuisine11.5 EN : bouton appareil personnalisé');
      ok(r.querySelector('.empty')?.textContent.includes('No appliances saved.'), 'Cuisine11.5 EN : état vide traduit');
      await apresConservation(() => changer(r.querySelector('select'), '0'));
      let rows = await repo.all('appliances');
      eq(rows.length, 1, 'Cuisine11.5 : modèle réellement ajouté une seule fois');
      const modele = rows[0], attendu = APPLIANCE_PRESETS[0];
      eq([modele.name, modele.brand, modele.model, modele.capabilities], [attendu.name, attendu.brand, attendu.model, attendu.capabilities], 'Cuisine11.5 : valeurs et capacités du modèle conservées');
      eq(document.querySelector('.toast')?.textContent, 'Appliance added', 'Cuisine11.5 EN : confirmation après ajout durable');
      r.remove(); r = await monter({ tab: 'appliances' });
      const carte = r.querySelector('details.card'); carte.open = true;
      eq([...carte.querySelectorAll('label.chip')].map(n => n.textContent), ['Weigh', 'Chop', 'Blend', 'Emulsify', 'Steam', 'Slow cook', 'Sous vide', 'Controlled heating', 'Knead', 'Bake', 'Convection', 'Broil', 'Grill', 'Smoke', 'Fry', 'Air fry', 'Pressure cook', 'Cook rice', 'Vacuum seal', 'Stir-fry', 'Boil', 'Simmer', 'Ferment', 'Dehydrate'], 'Cuisine11.5 EN : les 24 capacités visibles sont traduites');
      eq([...carte.querySelectorAll('.field > span')].map(n => n.textContent), ['Name', 'Brand', 'Model', 'Notes (capacity, usable volume…)'], 'Cuisine11.5 EN : tous les champs du registre traduits');
      eq([...carte.querySelectorAll('button')].map(n => n.textContent), ['Save', 'Delete'], 'Cuisine11.5 EN : gestes enregistrer et supprimer');
      const inputs = carte.querySelectorAll('input[type=text]'), nom = '<img src=x> Mon appareil';
      [nom, 'Ma marque', 'M2', 'Volume à vérifier'].forEach((v, i) => changer(inputs[i], v));
      const cases = carte.querySelectorAll('input[type=checkbox]'), retrait = CAPABILITIES.indexOf('weigh'), ajout = CAPABILITIES.indexOf('bake');
      cases[retrait].checked = false; cases[retrait].dispatchEvent(new Event('change'));
      cases[ajout].checked = true; cases[ajout].dispatchEvent(new Event('change'));
      await apresConservation(() => carte.querySelector('button.primary').click());
      const sauve = await repo.get('appliances', modele.id);
      eq([sauve.name, sauve.brand, sauve.model, sauve.notes], [nom, 'Ma marque', 'M2', 'Volume à vérifier'], 'Cuisine11.5 : champs modifiés conservés dans le dépôt');
      eq(sauve.capabilities, [...attendu.capabilities.filter(c => c !== 'weigh'), 'bake'], 'Cuisine11.5 : retirer et ajouter une capacité conserve les autres');
      eq(document.querySelector('.toast')?.textContent, 'Saved', 'Cuisine11.5 EN : confirmation après modification durable');
      r.remove(); r = await monter({ tab: 'appliances' });
      eq(r.querySelector('summary strong')?.textContent, nom, 'Cuisine11.5 : nom personnel relu sans traduction');
      eq(r.querySelectorAll('img').length, 0, 'Cuisine11.5 : nom hostile reste du texte');
      // Sélection par position ici pour atteindre le vrai dialogue même avant les traductions.
      r.querySelector('button.btn:not([data-value])').click();
      let dlg = dialogue();
      eq(dlg?.querySelector('h2')?.textContent, 'Appliance name', 'Cuisine11.5 EN : demande du nom traduite');
      dlg.querySelector('input').value = '  Appareil personnel  ';
      await apresConservation(() => dlg.querySelector('button.primary').click());
      rows = await repo.all('appliances'); const personnel = rows.find(a => a.id !== modele.id);
      eq(rows.length, 2, 'Cuisine11.5 : appareil personnalisé réellement ajouté');
      eq([personnel?.name, personnel?.brand, personnel?.model, personnel?.capabilities], ['Appareil personnel', '', '', []], 'Cuisine11.5 : nom personnalisé nettoyé, aucune capacité inventée');
      r.querySelector('button.btn:not([data-value])').click(); dlg = dialogue();
      dlg.dispatchEvent(new Event('cancel', { cancelable: true })); await Promise.resolve();
      eq((await repo.all('appliances')).length, 2, 'Cuisine11.5 : annuler la saisie ne crée aucun appareil');
      r.remove(); r = await monter({ tab: 'appliances' });
      const cible = [...r.querySelectorAll('details.card')].find(c => c.querySelector('strong').textContent === nom); cible.open = true;
      cible.querySelector('button.danger').click(); dlg = dialogue();
      eq(dlg?.querySelector('h2')?.textContent, `Delete “${nom}”?`, 'Cuisine11.5 EN : confirmation de suppression traduite avec nom exact');
      eq(dlg.querySelector('button.danger')?.textContent, 'Delete', 'Cuisine11.5 EN : confirmation explicite traduite');
      eq(dlg.querySelectorAll('img').length, 0, 'Cuisine11.5 : nom du dialogue en texte seul');
      dlg.dispatchEvent(new Event('cancel', { cancelable: true })); await Promise.resolve();
      eq(await repo.get('appliances', modele.id), sauve, 'Cuisine11.5 : annuler la suppression conserve la fiche exacte');
      cible.querySelector('button.danger').click(); dlg = dialogue();
      await apresConservation(() => dlg.querySelector('button.danger').click());
      eq(await repo.get('appliances', modele.id), undefined, 'Cuisine11.5 : confirmation supprime vraiment l’appareil choisi');
      eq(await repo.get('appliances', personnel.id), personnel, 'Cuisine11.5 : autre appareil conservé exactement');
      eq(await db.getAll('inventory'), [], 'Cuisine11.5 : gestes appareils ne changent aucun lot');
    });
  } finally { nettoyer(); setUiLocale(langue); }
}
