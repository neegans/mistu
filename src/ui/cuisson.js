// Lot I2 : formulaire partagé et mémoire personnelle. Les écritures relisent les lignes en transaction.
import { el, formatDate, pickFiles as pickDom, confirmDialog as confirmDom, toast as toastDom } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { urlDeBlob, revoquerUrlDeBlob } from '../core/blob-urls.js';
import { sha256Hex } from '../core/hash.js';
import { preparerPhotoLocale, messageErreurImage } from '../core/image.js';
import { displayUrl, typeAffichage } from '../sync/mime.js';
import * as repoModule from '../model/repo.js';
import { sectionPlain, field, vignettePage, gesteTelechargement, relireErreurs } from './components.js';
import { capturerRecette } from './recette-garde.js';
import { protegerSaisie } from './state.js';
import { LIMITES_CUISSON, ErreurCuisson, aujourdHui, photosDeCuisson, textePersonnel, validerTextePersonnel, validerCuisson } from '../domain/cuisine-personnelle.js';

const titreDe = (r) => typeof r?.display_title === 'string' ? r.display_title : typeof r?.original_title === 'string' ? r.original_title : t('Recette');
const erreur = (code, champ, courant) => { throw new ErreurCuisson(code, champ, courant); };
const maintenantParDefaut = () => repoModule.nowIso();
const gardeExistence = (key, valider) => ({ key, fusion: c => { if (!c || !valider(c)) erreur('reference'); return null; } });

export function messageErreurCuisson(e) {
  if (['cycle_change', 'recette_retiree', 'cycle_invalide', 'compte_change', 'historique_seul'].includes(e?.code)) return t('La recette a changé. Rouvre sa fiche avant d’enregistrer.');
  if (e?.code === 'date') return t('Choisis une date valide, aujourd’hui ou avant.');
  if (e?.code === 'texte') return t('La note peut contenir 10 000 caractères au plus.');
  if (e?.code === 'photos') return t('Tu peux garder 6 photos au plus par cuisson.');
  if (e?.code === 'nombre' && e?.champ === 'actual') return t('Le temps réel doit être un entier entre 0 et 10 080 minutes.');
  if (e?.code === 'nombre') return t('Les portions doivent être supérieures à 0 et au plus égales à 1 000.');
  if (e?.code === 'note') return t('Choisis une évaluation valide ou laisse-la vide.');
  if (e?.code === 'reference') return t('La recette ou sa version n’est plus disponible.');
  if (e?.code === 'conflit') return t('Ce texte a changé depuis son ouverture. Choisis le texte à garder.');
  if (e?.code === 'session') return t('La session de cuisine a changé. Rouvre-la avant d’enregistrer.');
  return t('L’enregistrement a échoué. Tes saisies sont conservées ; réessaie.');
}

// `id` est stable pour toute la vie du formulaire ; une répétition ne crée ni n'écrase une cuisson.
export async function enregistrerCuissons(items, { repo = repoModule, session = null, maintenant = maintenantParDefaut, recettes = null, ctx = null, cuisine = null, memoire = null } = {}) {
  if(session && !cuisine && (session.cooking_state || session.progress?.format === 2)) erreur('contexte_change');
  const signature=JSON.stringify(items?.map?.(item=>({id:item.id,recipe_id:item.recipe?.id,version_id:item.version?.id,form:item.form})));
  const identique=memoire?.signature===signature;
  const instant=identique?memoire.instant:maintenant(),jour=aujourdHui(instant);
  if(memoire&&!identique){memoire.signature=signature;memoire.instant=instant;memoire.intention=null;}
  if (!Array.isArray(items) || !items.length || items.length > 100) erreur('reference');
  recettes ??= await Promise.all([...new Map(items.map(item => [item.recipe?.id,item.recipe])).values()].map(recipe => capturerRecette(repo, recipe, {ctx, historique:!!session})));
  const ids = new Set();
  const rows = items.map(item => {
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || !item.recipe?.id || !item.version?.id || item.version.recipe_id !== item.recipe.id) erreur('reference');
    ids.add(item.id);
    let f;
    try { f = validerCuisson(item.form, { aujourdHui: jour }); } catch (e) { e.cuisson_id = item.id; throw e; }
    if (session && item.form?.date === jour && !item.form?.dateTouchee) f.cooked_at = instant;
    return {
      id: item.id, recipe_id: item.recipe.id, recipe_version_id: item.version.id, ...f,
      appliance_ids: [], cook_session_id: session?.id || null, meal_id: session?.meal_id || null,
      quantities_snapshot: session ? (item.scaled?.ingredients || []).map(ri => Object.fromEntries(Object.entries({ source_text: ri.source_text, quantity: ri.quantity, unit_id: ri.unit_id, ingredient_id: ri.ingredient_id }).filter(([,valeur]) => valeur !== undefined))) : [],
      convention_snapshot: session ? item.version.provenance?.convention_snapshot || null : null,
    };
  });
  // Les octets et leurs liens sont validés et écrits dans la même transaction.
  const fichiers = [];
  for (const item of items) for (const [sha256, blob] of (item.fichiers instanceof Map ? item.fichiers : [])) {
    if (rows.find(r => r.id === item.id).photos.includes(sha256)) fichiers.push({sha256, blob, meta:{mime:blob.type}});
  }
  const conditions = {
    recipes: [...new Set(rows.map(r => r.recipe_id))].map(id => gardeExistence(id, () => true)),
    recipe_versions: [...new Set(rows.map(r => r.recipe_version_id))].map(id => gardeExistence(id, c => rows.some(r => r.recipe_version_id === id && r.recipe_id === c.recipe_id))),
    cook_history: rows.map(row => ({ key: row.id, fusion: c => {
      if (!c) return row;
      if (c.recipe_id !== row.recipe_id || c.recipe_version_id !== row.recipe_version_id) erreur('conflit');
      return null;
    } })),
  };
  const photos = [...new Set(rows.flatMap(r => r.photos))].filter(sha => !fichiers.some(f => f.sha256 === sha));
  if (photos.length) conditions.files = photos.map(sha => gardeExistence(sha, () => true));
  if(session && cuisine){
    let intention=memoire?.intention;
    if(!intention){
      const preparation=await cuisine.service.preparerFin({portee:cuisine.portee,lecture:cuisine.lecture,doneAdd:cuisine.doneAdd||[],cuissons:rows,endedAt:instant});
      if(preparation.issue!=='ok')erreur(preparation.raison||'session');
      intention=preparation.intention;if(memoire)memoire.intention=intention;
    }
    const resultat=await cuisine.service.terminerSession({intention,metier:{puts:{},conditions,recettes},fichiers});
    if(!['conserve','deja_conserve'].includes(resultat.issue))erreur(resultat.raison||'session');
    return{deja:resultat.issue==='deja_conserve',rows:resultat.rows||rows};
  }
  if (session) conditions.cook_sessions = [{ key: session.id, fusion: c => {
    if (!c) erreur('session');
    if (c.status === 'done') erreur('deja');
    if (c.status !== 'active' || !Array.isArray(c.selected_version_ids) || c.selected_version_ids.length !== rows.length || !rows.every(r => c.selected_version_ids.includes(r.recipe_version_id))) erreur('session');
    return { ...c, progress: { ...c.progress, done_step_ids: [...new Set([...(c.progress?.done_step_ids || []), ...(session.progress?.done_step_ids || [])])] }, status: 'done', ended_at: instant };
  } }];
  try { await repo.saveBatch({}, { conditions, recettes, fichiers }); }
  catch (e) { if (e?.code === 'deja') return { deja: true, rows: [] }; throw e; }
  return { deja: false, rows };
}

export async function enregistrerTextePersonnel(store, id, champ, attendu, texte, { repo = repoModule, recettes = null, recipe = null, ctx = null } = {}) {
  if (!((store === 'recipes' && champ === 'personal_notes') || (store === 'cook_history' && champ === 'notes'))) erreur('reference');
  const valeur = validerTextePersonnel(texte);
  if (!recettes) {
    const source = recipe ?? await repo.get('recipes', store === 'recipes' ? id : (await repo.get('cook_history', id))?.recipe_id);
    recettes = [await capturerRecette(repo, source, {ctx, historique:store === 'cook_history'})].filter(Boolean);
  }
  await repo.saveBatch({}, { recettes, conditions: { [store]: [{ key: id, fusion: c => {
    if (!c) erreur('reference');
    if (textePersonnel(c[champ]) !== attendu) erreur('conflit', champ, textePersonnel(c[champ]));
    return { ...c, [champ]: valeur };
  } }] } });
  return valeur;
}

export async function modifierPhotosCuisson(id, { ajouter = [], retirer = [] } = {}, { repo = repoModule, recettes = null, fichiers = [], recipe = null, ctx = null } = {}) {
  if (!recettes) {
    const source = recipe ?? await repo.get('recipes', (await repo.get('cook_history', id))?.recipe_id);
    recettes = [await capturerRecette(repo, source, {ctx, historique:true})].filter(Boolean);
  }
  const ajoutees = photosDeCuisson({ photos: ajouter });
  if (!Array.isArray(ajouter) || ajoutees.length !== new Set(ajouter).size || ajouter.length > 100 || !Array.isArray(retirer)) erreur('photos');
  const conditions = { cook_history: [{ key: id, fusion: c => {
    if (!c) erreur('reference');
    const photos = [...new Set([...photosDeCuisson(c), ...ajoutees])].filter(s => !retirer.includes(s));
    if (photos.length > LIMITES_CUISSON.photos) erreur('photos');
    return { ...c, photos };
  } }] };
  const dejaPresentes = ajoutees.filter(sha => !fichiers.some(f => f.sha256 === sha));
  if (dejaPresentes.length) conditions.files = dejaPresentes.map(sha => gardeExistence(sha, () => true));
  await repo.saveBatch({}, { conditions, recettes, fichiers });
}

function choix(options, valeur) {
  return el('select', { value: valeur }, ...options.map(([value, label]) => el('option', { value, selected: value === valeur }, label)));
}

// Partagé par le bilan et l'ajout à une cuisson existante : aucun pointeur ni fichier avant confirmation.
function creerChoixPhotos({ pickFiles = pickDom, existantes = [], signaler = () => {}, avant = () => {} } = {}) {
  const fichiers = new Map(), images = [], urls = new Set();
  let traitement = false, ferme = false, verrouille = false;
  const apercus = el('div', { class: 'thumbs', dataset: { role: 'photos-cuisson' } });
  const controls = el('div', { class: 'row' });
  const root = el('div', { class: 'stack' }, controls, apercus);
  const bloquer = () => { for (const b of root.querySelectorAll('button')) b.disabled = traitement || verrouille; };
  const dessiner = () => {
    const anciennes = [...urls]; urls.clear();
    apercus.replaceChildren(...images.map(sha => {
      const src = urlDeBlob(fichiers.get(sha)); urls.add(src);
      return el('figure', null, el('img', { src, alt: t('Ma photo du plat'), style: { maxWidth: '160px', maxHeight: '160px' } }),
        el('button', { type: 'button', class: 'btn small', onClick: () => { if (traitement || verrouille || ferme) return; images.splice(images.indexOf(sha), 1); fichiers.delete(sha); dessiner(); } }, t('Retirer cette photo')));
    }));
    bloquer();
    for (const u of anciennes) revoquerUrlDeBlob(u);
  };
  const preparer = async selection => {
    if (!selection?.length || ferme) return;
    avant();
    for (const file of selection) {
      if (ferme) break;
      try {
        const blob = await preparerPhotoLocale(file); if (ferme) break;
        const sha = await sha256Hex(blob); if (ferme) break;
        if (images.includes(sha) || existantes.includes(sha)) continue;
        if (images.length + existantes.length >= LIMITES_CUISSON.photos) erreur('photos');
        fichiers.set(sha, blob); images.push(sha); dessiner();
      } catch (e) { if (!ferme) signaler(e); }
    }
  };
  const ajouter = async (capture, selection) => {
    if (traitement || ferme || verrouille) return;
    traitement = true; bloquer();
    try {
      await preparer(selection ?? await pickFiles({ accept: 'image/*', multiple: !capture, capture }));
    } catch (e) { if (!ferme) signaler(e); }
    finally { traitement = false; bloquer(); }
  };
  controls.append(el('button', { type: 'button', class: 'btn', onClick: () => ajouter('environment') }, t('Ajouter une photo de mon plat')),
    el('button', { type: 'button', class: 'btn', onClick: () => ajouter(null) }, t('Choisir des photos')));
  return { root, fichiers, lire: () => [...images], ajouter: selection => ajouter(null, selection), occupe: () => traitement,
    verrouiller: valeur => { verrouille = valeur; bloquer(); },
    detruire: () => { ferme = true; for (const u of urls) revoquerUrlDeBlob(u); urls.clear(); } };
}

let numeroFormulaire = 0;
export function creerFormulaireCuisson(item, { repo = repoModule, maintenant = maintenantParDefaut, pickFiles = pickDom } = {}) {
  const jour = aujourdHui(maintenant());
  let dateTouchee = false;
  const date = el('input', { type: 'date', value: jour, max: jour, required: true, onInput: () => { dateTouchee = true; } });
  const notes = el('textarea', { rows: 3, placeholder: t('Excellent, mais moins de câpres ; poisson un peu trop cuit.') });
  const actual = el('input', { type: 'number', min: 0, max: LIMITES_CUISSON.minutes, step: 1 });
  const servings = el('input', { type: 'number', min: 0.01, max: LIMITES_CUISSON.portions, step: 'any', value: item.servings ?? '' });
  const redo = choix([['', t('Sans avis')], ['oui', t('Oui, à refaire')], ['non', t('Non')]], '');
  const rating = choix([['', t('Sans note')], ...[1, 2, 3, 4, 5].map(n => [String(n), '★'.repeat(n)])], '');
  const erreurId = `erreur-cuisson-${++numeroFormulaire}`;
  const erreurEl = el('p', { id: erreurId, class: 'status warn', role: 'alert', hidden: true });
  const champs = { date, notes, actual, servings, redo, rating };
  const signaler = e => {
    erreurEl.hidden = false; erreurEl.textContent = e?.code && ['trop_lourde', 'trop_grande', 'indecodable', 'type'].includes(e.code) ? messageErreurImage(e) : messageErreurCuisson(e);
    for (const champ of Object.values(champs)) { champ.removeAttribute('aria-invalid'); champ.removeAttribute('aria-describedby'); }
    if (champs[e?.champ]) { champs[e.champ].setAttribute('aria-invalid', 'true'); champs[e.champ].setAttribute('aria-describedby', erreurId); champs[e.champ].focus(); }
  };
  const photos = creerChoixPhotos({ pickFiles, signaler, avant: () => { erreurEl.hidden = true; } });
  const root = el('fieldset', { class: 'stack', style: { minWidth: '0', overflowWrap: 'anywhere' }, dataset: { role: 'formulaire-cuisson', recipe: item.recipe.id, version: item.version.id } },
    el('legend', null, titreDe(item.recipe)),
    el('small', { class: 'muted' }, t('Cuisson liée à la version affichée de cette recette.')),
    field(t('Date de cuisson'), date),
    el('div', { class: 'row' }, field(t('À refaire ?'), redo), field(t('Étoiles'), rating)),
    field(t('Observations (liées à cette cuisson)'), notes),
    el('div', { class: 'row' }, field(t('Temps réel (min)'), actual), field(t('Portions'), servings)),
    photos.root, erreurEl);
  return { root, fichiers: photos.fichiers, lire: () => ({ date: date.value, dateTouchee, notes: notes.value, actual: actual.value, servings: servings.value, redo: redo.value === 'oui' ? true : redo.value === 'non' ? false : null, rating: rating.value ? Number(rating.value) : null, photos: photos.lire() }),
    occupe: photos.occupe, signaler, detruire: photos.detruire, verrouiller: photos.verrouiller };
}

export function ouvrirCuissons(items, options = {}) {
  const repo = options.repo ?? repoModule, maintenant = options.maintenant ?? maintenantParDefaut;
  const capture = options.recettes ? Promise.resolve({recettes:options.recettes}) : Promise.all([...new Map(items.map(item => [item.recipe?.id,item.recipe])).values()].map(recipe => capturerRecette(repo, recipe, {ctx:options.ctx, historique:!!options.session}))).then(recettes => ({recettes}), erreur => ({erreur}));
  const stables = items.map(item => ({ ...item, id: item.id || repo.newId('ch') }));
  const forms = stables.map(item => creerFormulaireCuisson(item, { ...options, repo, maintenant }));
  const memoire={};
  const message = el('p', { role: 'alert', class: 'status warn', hidden: true });
  const dlg = el('dialog', { dataset: { role: 'dialogue-cuissons' }, style: { maxWidth: 'min(42rem, calc(100vw - 2rem))' } },
    el('h2', null, options.session ? t('Cuisson terminée — à refaire ?') : t('J’ai cuisiné ce plat')), ...(options.suivisActifs>0?[el('p',{class:'status warn'},t('{n} suivis de durée sont encore en cours. Terminer la séance ne les arrête pas.',{n:options.suivisActifs}))]:[]), ...forms.map(f => f.root), message);
  const liberer = protegerSaisie(dlg);
  return new Promise(resolve => {
    let enCours = false, fini = false;
    const fermer = resultat => { if (fini) return; fini = true; forms.forEach(f => f.detruire()); dlg.close(); dlg.remove(); liberer(); resolve(resultat); };
    const annuler = el('button', { type: 'button', class: 'btn', onClick: () => { if (!enCours) fermer(false); } }, t('Annuler'));
    const enregistrer = el('button', { type: 'button', class: 'btn primary', onClick: async () => {
      if (enCours) return;
      if (forms.some(f => f.occupe())) { message.hidden = false; message.textContent = t('La photo est en cours de préparation.'); return; }
      enCours = true; enregistrer.disabled = true; annuler.disabled = true; message.hidden = true;
      forms.forEach(f => f.verrouiller(true));
      try {
        const contexte = await capture; if (contexte.erreur) throw contexte.erreur;
        const result = await enregistrerCuissons(stables.map((item, i) => ({ ...item, form: forms[i].lire(), fichiers: forms[i].fichiers })), { ...options, repo, maintenant, recettes:contexte.recettes, memoire });
        (options.toast ?? toastDom)(result.deja ? t('Cette cuisson est déjà enregistrée.') : t('Cuisson enregistrée'));
        fermer(true);
        if(result.rows.length&&typeof options.onEnregistre==='function')Promise.resolve().then(()=>options.onEnregistre(result)).catch(()=>{});
      } catch (e) {
        message.hidden = false; message.textContent = messageErreurCuisson(e);
        const n = stables.findIndex(item => item.id === e?.cuisson_id); if (n >= 0) forms[n].signaler(e);
      }
      finally { enCours = false; enregistrer.disabled = false; annuler.disabled = false; forms.forEach(f => f.verrouiller(false)); }
    } }, t('Enregistrer'));
    dlg.append(el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '1rem' } }, annuler, enregistrer));
    dlg.addEventListener('cancel', e => { e.preventDefault(); if (!enCours) fermer(false); });
    document.body.append(dlg); dlg.showModal();
  });
}

function ouvrirPhotosCuisson(recipe, cuisson, selection, { repo, pickFiles, toast, recettes }) {
  const message = el('p', { role: 'alert', class: 'status warn', hidden: true });
  const signaler = e => { message.hidden = false; message.textContent = ['trop_lourde', 'trop_grande', 'indecodable', 'type'].includes(e?.code) ? messageErreurImage(e) : messageErreurCuisson(e); };
  const photos = creerChoixPhotos({ pickFiles, existantes: photosDeCuisson(cuisson), signaler, avant: () => { message.hidden = true; } });
  const dlg = el('dialog', { dataset: { role: 'dialogue-photos-cuisson' }, style: { maxWidth: 'min(42rem, calc(100vw - 2rem))' } },
    el('h2', null, t('Ajouter une photo à cette cuisson')), el('p', { class: 'muted' }, titreDe(recipe) + ' · ' + formatDate(cuisson.cooked_at)), photos.root, message);
  const liberer = protegerSaisie(dlg);
  return new Promise(resolve => {
    let enCours = false, fini = false;
    const fermer = resultat => { if (fini) return; fini = true; photos.detruire(); dlg.close(); dlg.remove(); liberer(); resolve(resultat); };
    const annuler = el('button', { type: 'button', class: 'btn', onClick: () => { if (!enCours) fermer(false); } }, t('Annuler'));
    const enregistrer = el('button', { type: 'button', class: 'btn primary', onClick: async () => {
      if (enCours) return;
      if (photos.occupe()) { message.hidden = false; message.textContent = t('La photo est en cours de préparation.'); return; }
      const ajouter = photos.lire();
      if (!ajouter.length) { fermer(false); return; }
      enCours = true; photos.verrouiller(true); enregistrer.disabled = true; annuler.disabled = true; message.hidden = true;
      try {
        const fichiers = ajouter.map(sha256 => { const blob=photos.fichiers.get(sha256); return {sha256,blob,meta:{mime:blob.type}}; });
        await modifierPhotosCuisson(cuisson.id, { ajouter }, { repo, recettes, fichiers });
        toast(t('Photos enregistrées.')); fermer(true);
      } catch (e) { signaler(e); }
      finally { enCours = false; photos.verrouiller(false); enregistrer.disabled = false; annuler.disabled = false; }
    } }, t('Enregistrer'));
    dlg.append(el('div', { class: 'row' }, annuler, enregistrer));
    dlg.addEventListener('cancel', e => { e.preventDefault(); if (!enCours) fermer(false); });
    document.body.append(dlg); dlg.showModal(); photos.ajouter(selection);
  });
}

export function ouvrirTextePersonnel({ store, id, champ, valeur, titre }, { repo = repoModule, toast = toastDom, apres = () => {}, recipe = null, ctx = null, recettes = null } = {}) {
  const capture = (async () => {
    if (recettes) return {recettes};
    const source = recipe ?? await repo.get('recipes', store === 'recipes' ? id : (await repo.get('cook_history', id))?.recipe_id);
    return {recettes:[await capturerRecette(repo, source, {ctx, historique:store === 'cook_history'})].filter(Boolean)};
  })().catch(erreur => ({erreur}));
  let attendu = textePersonnel(valeur), enCours = false;
  const input = el('textarea', { value: attendu, rows: 7, 'aria-label': titre, style: { width: '100%', minWidth: '0' } });
  const message = el('div', { role: 'alert', class: 'stack' });
  const dlg = el('dialog', { dataset: { role: 'dialogue-note' }, style: { maxWidth: 'min(36rem, calc(100vw - 2rem))' } }, el('h2', null, titre), input,
    el('small', { class: 'muted' }, t('Facultatif · 10 000 caractères au plus.')), message);
  const liberer = protegerSaisie(dlg);
  const fermer = () => { dlg.close(); dlg.remove(); liberer(); };
  const bouton = el('button', { type: 'button', class: 'btn primary', onClick: async () => {
    if (enCours) return;
    enCours = true; bouton.disabled = true; message.replaceChildren();
    try { const contexte = await capture; if (contexte.erreur) throw contexte.erreur; const texte = await enregistrerTextePersonnel(store, id, champ, attendu, input.value, { repo, recettes:contexte.recettes }); fermer(); toast(t('Note enregistrée.')); await apres(texte); }
    catch (e) {
      message.append(el('p', { class: 'status warn' }, messageErreurCuisson(e)));
      if (e?.code === 'conflit') {
        message.append(el('p', null, t('Texte enregistré entre-temps :')), el('div', { style: { whiteSpace: 'pre-wrap' } }, e.courant),
          el('button', { type: 'button', class: 'btn', onClick: () => { attendu = e.courant; message.replaceChildren(el('p', null, t('Ta saisie sera gardée au prochain enregistrement.'))); } }, t('Garder ma saisie')),
          el('button', { type: 'button', class: 'btn', onClick: () => { attendu = e.courant; input.value = e.courant; message.replaceChildren(); } }, t('Utiliser l’autre texte')));
      }
    } finally { enCours = false; bouton.disabled = false; }
  } }, t('Enregistrer'));
  dlg.append(el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', onClick: () => { if (!enCours) fermer(); } }, t('Annuler')), bouton));
  dlg.addEventListener('cancel', e => { e.preventDefault(); if (!enCours) fermer(); });
  document.body.append(dlg); dlg.showModal(); input.focus(); return dlg;
}

export async function monterNotesPersonnelles(recipe, options = {}) {
  let valeur = textePersonnel(recipe.personal_notes);
  const contenu = el('div', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, dataset: { role: 'texte-notes-personnelles' } }, valeur);
  const btn = el('button', { type: 'button', class: 'btn link', onClick: () => ouvrirTextePersonnel({ store: 'recipes', id: recipe.id, champ: 'personal_notes', valeur, titre: t('Mes notes') }, { ...options, recipe, apres: texte => { valeur = texte; contenu.textContent = texte; btn.textContent = texte ? t('Modifier mes notes') : t('Ajouter une note personnelle'); options.apres?.(texte); } }) }, valeur ? t('Modifier mes notes') : t('Ajouter une note personnelle'));
  const root = sectionPlain(t('Mes notes'), contenu, btn); root.dataset.role = 'notes-personnelles'; return root;
}

export function noteEnCuisine(recipe) {
  const texte = textePersonnel(recipe?.personal_notes);
  return texte ? el('details', { class: 'card', open: true, dataset: { role: 'notes-personnelles-cuisine' } }, el('summary', null, t('Mes notes')), el('div', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, texte)) : null;
}

export function boutonModifierObservation(h, { apres = () => {}, ...options } = {}) {
  let valeur = textePersonnel(h.notes);
  return el('button', { type: 'button', class: 'btn small', dataset: { role: 'modifier-observation' }, onClick: () => ouvrirTextePersonnel({ store: 'cook_history', id: h.id, champ: 'notes', valeur, titre: t('Modifier mes observations') }, { ...options, apres: texte => { valeur = texte; apres(texte); } }) }, t('Modifier mes observations'));
}

export async function monterMesPhotos(recipe, history, { repo = repoModule, ctxF = {}, ctx = null, lectureSeule = false, consultation = false, pickFiles = pickDom, confirmDialog = confirmDom, toast = toastDom, apres = () => {} } = {}) {
  const root = sectionPlain(t('Mes photos')); root.dataset.role = 'mes-photos';
  const corps = el('div', { class: 'stack' }); root.append(corps);
  let generation = 0, occupe = false;
  const redessiner = async () => {
    const g = ++generation;
    const lignes = [];
    for (const ancienne of history) {
      const h = await repo.get('cook_history', ancienne.id); if (!h || h.recipe_id !== recipe.id) continue;
      const photos = photosDeCuisson(h), images = el('div', { class: 'thumbs' });
      const groupe = el('div', { class: 'stack' }, el('strong', null, formatDate(h.cooked_at)), images);
      for (const sha of photos) {
        const file = await repo.getFile(sha);
        let image = typeAffichage(file)?.startsWith('image/') ? el('img', { src: displayUrl(file, urlDeBlob), alt: t('Ma photo du plat'), loading: 'lazy', style: { maxWidth: '180px', maxHeight: '180px' } }) : null;
        if (!image) {
          const telecharger = gesteTelechargement({ moteur: ctxF.moteur, redessiner: async () => { await relireErreurs(ctxF); await redessiner(); await apres(); } });
          image = el('div', null, el('p', { class: 'muted' }, t('Ta photo n’est pas sur cet appareil.')), vignettePage({ id: 'cuisson-' + h.id, sha256: sha }, file, { ...ctxF, telecharger }));
        }
        images.append(el('figure', null, image, lectureSeule ? null : el('button', { type: 'button', class: 'btn small', onClick: async () => {
          if (occupe) return;
          occupe = true; const liberer = protegerSaisie(root);
          try {
            const recettes = [await capturerRecette(repo, recipe, {ctx, historique:true})];
            if (!await confirmDialog(t('Retirer cette photo de la cuisson ?'), { okLabel: t('Retirer'), cancelLabel: t('Annuler') }) || !root.isConnected) return;
            await modifierPhotosCuisson(h.id, { retirer: [sha] }, { repo, recettes }); await redessiner(); await apres();
          }
          catch (e) { toast(messageErreurCuisson(e)); } finally { occupe = false; liberer(); }
        } }, t('Retirer cette photo'))));
      }
      if (!lectureSeule) groupe.append(el('button', { type: 'button', class: 'btn small', onClick: async () => {
        if (occupe) return;
        occupe = true; const liberer = protegerSaisie(root);
        try {
          const recettes = [await capturerRecette(repo, recipe, {ctx, historique:true})];
          const selection = await pickFiles({ accept: 'image/*', multiple: true }); if (!selection?.length || !root.isConnected) return;
          const courante = await repo.get('cook_history', h.id);
          if (!courante || courante.recipe_id !== recipe.id) erreur('reference');
          if (!root.isConnected) return;
          await ouvrirPhotosCuisson(recipe, courante, selection, { repo, pickFiles, toast, recettes });
        } catch (e) { toast(e?.code && ['trop_lourde', 'trop_grande', 'indecodable', 'type'].includes(e.code) ? messageErreurImage(e) : messageErreurCuisson(e)); }
        finally { try { if (root.isConnected) { await redessiner(); await apres(); } } finally { occupe = false; liberer(); } }
      } }, t('Ajouter une photo à cette cuisson')));
      lignes.push(groupe);
    }
    if (g !== generation) { for (const ligne of lignes) for (const img of ligne.querySelectorAll('img')) revoquerUrlDeBlob(img.getAttribute('src')); return; }
    const anciennes = [...corps.querySelectorAll('img')].map(img => img.getAttribute('src')).filter(u => u?.startsWith('blob:'));
    corps.replaceChildren(...lignes); for (const u of anciennes) revoquerUrlDeBlob(u);
    if (!lignes.length) corps.append(el('p', { class: 'muted' }, consultation ? t('Aucune photo de cuisson enregistrée.') : t('Ajoute tes photos en enregistrant une cuisson avec « J’ai cuisiné ce plat ».')));
  };
  await redessiner(); return root;
}
