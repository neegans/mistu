// I2 : un cadrage local de la page, proposé puis confirmé. Aucun appel assistant ici.
import { el, confirmDialog, toast } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { urlDeBlob, revoquerUrlDeBlob } from '../core/blob-urls.js';
import { rectangleValide, dimensionsImage } from '../core/image.js';
import * as repoModule from '../model/repo.js';
import { relirePhotosPage, sourcePhotoIntacte, preparerRecadragePage, enregistrerPhotoPage, clePhotoLecture } from '../domain/photo-page.js';
import { section, field, contexteFichiers, gesteTelechargement, vignettePage } from './components.js';
import { protegerSaisie } from './state.js';

const CENTRE = Object.freeze({ x: 0.25, y: 0.25, largeur: 0.5, hauteur: 0.5 });
const pct = (x) => Math.round(x * 10000) / 100;
const clamp = (x) => Math.max(0, Math.min(1, x));

export async function panneauPhotoPage(recipe, ctx = {}, deps = {}) {
  const repo = deps.repo ?? repoModule, dire = deps.toast ?? toast, confirmer = deps.confirmDialog ?? confirmDialog;
  const imports = typeof repo.byIndex === 'function' ? await repo.byIndex('imports', 'recipe_id', recipe.id) : (ctx.imports || []);
  const lignes = imports.filter((i) => i?.recipe_id === recipe.id && i.kind === 'recette' && i.status === 'enregistre')
    .sort((a, b) => String(b.finished_at || b.updated_at || '').localeCompare(String(a.finished_at || a.updated_at || '')));
  const candidates = lignes.slice(0, 100).map((i) => ({ ligne: i, ...relirePhotosPage(i.resultat, i.page_ids) }));
  const ids = [...new Set((Array.isArray(recipe.source_page_ids) ? recipe.source_page_ids : []).filter((id) => typeof id === 'string' && id.length <= 200))];
  let proposees = candidates.filter((x) => !x.choix).flatMap((x) => x.propositions.filter((source) => ids.includes(source.page_id)).map((source) => ({ source, ligne: x.ligne }))).slice(0, 3);
  const pages = [];
  for (const id of ids.slice(0, 100)) { const p = await repo.get('source_pages', id); if (p) pages.push(p); }
  if (!pages.length) return null;
  const root = section(t('Image du livre'));
  root.dataset.role = 'photo-page';
  const contenu = el('div', { class: 'stack' }); root.append(contenu);
  const ctxF = deps.ctxF ?? await contexteFichiers(ctx);
  let generation = 0, occupe = false, chargement = false, source = null, ligne = null, rectangle = { ...CENTRE }, original = null, previewSource = null, jpeg = null;
  let photoDepart = { ...recipe }, urls = [], forme = null;
  let libererSaisie = null;
  const proteger = () => { if (root.isConnected && !libererSaisie) libererSaisie = protegerSaisie(root); };
  const liberer = () => { libererSaisie?.(); libererSaisie = null; };
  const message = el('p', { role: 'status', class: 'muted', dataset: { role: 'photo-page-message' } });
  const nettoyerUrls = () => { const anciennes = urls; urls = []; for (const u of anciennes) revoquerUrlDeBlob(u); };
  const adresse = (b) => { const u = urlDeBlob(b); urls.push(u); return u; };
  const erreur = (e) => e?.message === 'page_modifiee' ? t('Cette page a changé. Choisis-la à nouveau.')
    : e?.name === 'TransitionRefusee' ? t('La photo du plat a changé ailleurs. Rouvre le cadrage pour choisir.')
      : e?.code === 'trop_petite' ? t('Cette zone est trop petite. Agrandis le cadrage.') : t('Ce cadrage ne peut pas être utilisé. Vérifie la zone et réessaie.');

  async function choisir(pageId, proposition = null) {
    if (occupe) return;
    proteger();
    const g = ++generation;
    chargement = true; jpeg = null; source = null; original = null; previewSource = null; ligne = null;
    if (forme) ++forme.generationApercu;
    actualiserCadre();
    try {
      const page = await repo.get('source_pages', pageId), fichier = page ? await repo.getFile(page.sha256) : null;
      if (g !== generation) return;
      if (!page || (proposition && !sourcePhotoIntacte(proposition.source, page))) throw new Error('page_modifiee');
      if (!(fichier?.blob instanceof Blob)) {
        const telecharger = gesteTelechargement({ moteur: ctxF.moteur, dire, redessiner: () => choisir(pageId, proposition) });
        contenu.replaceChildren(el('p', null, t('La page source n’est pas sur cet appareil.')),
          vignettePage(page, fichier, { ...ctxF, telecharger }), boutonsChoix(), message);
        nettoyerUrls(); forme = null; return;
      }
      const entier = await preparerRecadragePage(fichier.blob, { rotation: page.rotation });
      const dims = await dimensionsImage(entier);
      const depart = await repo.get('recipes', recipe.id) || recipe;
      if (g !== generation) return;
      original = fichier.blob;
      previewSource = entier;
      source = proposition?.source ?? { page_id: page.id, sha256: page.sha256, rotation: [90, 180, 270].includes(page.rotation) ? page.rotation : 0, largeur: dims.largeur, hauteur: dims.hauteur };
      ligne = proposition?.ligne ?? null;
      rectangle = { ...(proposition?.source.rectangle ?? CENTRE) };
      photoDepart = { ...depart };
      chargement = false;
      dessinerCadrage(entier, page, !!proposition);
      await apercu();
    } catch (e) { if (g === generation) message.textContent = erreur(e); }
    finally { if (g === generation) { chargement = false; actualiserCadre(); } }
  }

  function boutonsChoix() {
    const bloc = el('div', { class: 'stack' });
    if (proposees.length) bloc.append(el('p', null, t('Utiliser cette image ?')),
      el('div', { class: 'row' }, ...proposees.map((p, i) => el('button', { type: 'button', class: 'btn', onClick: () => choisir(p.source.page_id, p) }, t('Image proposée {n}', { n: i + 1 })))));
    const choix = el('select', { 'aria-label': t('Page à recadrer'), onChange: (e) => { if (e.target.value) choisir(e.target.value); } },
      el('option', { value: '' }, t('Choisir une zone dans une page')),
      ...pages.map((p, i) => el('option', { value: p.id }, p.printed_page != null ? t('Page {p}', { p: p.printed_page }) : t('Photo {n}', { n: i + 1 }))));
    bloc.append(choix);
    return bloc;
  }

  function dessinerCadrage(entier, page, proposition) {
    contenu.replaceChildren(); nettoyerUrls(); message.textContent = '';
    const apercuImg = el('img', { alt: t('Aperçu de la photo du livre'), style: { maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' } });
    const image = el('img', { src: adresse(entier), alt: t('Page source à recadrer'), draggable: 'false', style: { width: '100%', display: 'block' } });
    const cadre = el('div', { style: { position: 'absolute', border: '3px solid #fff', boxShadow: '0 0 0 1px #222', pointerEvents: 'none', boxSizing: 'border-box' } });
    const scene = el('div', { style: { position: 'relative', maxWidth: '600px', width: 'calc(100% - 44px)', margin: '22px', alignSelf: 'center' } }, image, cadre);
    const inputs = new Map();
    const textes = { x: t('Gauche (%)'), y: t('Haut (%)'), largeur: t('Largeur (%)'), hauteur: t('Hauteur (%)') };
    for (const k of Object.keys(textes)) inputs.set(k, el('input', { type: 'number', min: 0, max: 100, step: 0.1, value: pct(rectangle[k]),
      onInput: (e) => { if (occupe || chargement) return; proteger(); rectangle = { ...rectangle, [k]: e.target.value === '' ? NaN : Number(e.target.value) / 100 }; actualiserCadre(); apercu(); } }));
    const utiliser = el('button', { type: 'button', class: 'btn primary', dataset: { role: 'utiliser-photo-page' }, onClick: enregistrer }, t('Utiliser comme photo du livre'));
    forme = { cadre, scene, inputs, apercuImg, utiliser, generationApercu: 0, urlApercu: null };
    const poignee = (coin) => {
      const b = el('button', { type: 'button', class: 'btn', 'aria-label': coin === 'debut' ? t('Déplacer le coin supérieur gauche') : t('Déplacer le coin inférieur droit'),
        style: { position: 'absolute', minWidth: '44px', minHeight: '44px', padding: '0', touchAction: 'none', pointerEvents: 'auto', transform: 'translate(-50%, -50%)', ...(coin === 'debut' ? { left: '0', top: '0' } : { left: '100%', top: '100%' }) } }, '↔');
      let depart = null;
      const bouger = (x, y) => {
        if (!depart) return;
        if (coin === 'debut') { const droite = depart.x + depart.largeur, bas = depart.y + depart.hauteur; const nx = Math.min(x, droite - .01), ny = Math.min(y, bas - .01); rectangle = { x: nx, y: ny, largeur: droite - nx, hauteur: bas - ny }; }
        else rectangle = { ...depart, largeur: Math.max(.01, x - depart.x), hauteur: Math.max(.01, y - depart.y) };
        actualiserCadre(true); apercu();
      };
      b.addEventListener('pointerdown', (e) => { if (occupe || chargement || !rectangleValide(rectangle)) return; proteger(); depart = { ...rectangle }; b.setPointerCapture(e.pointerId); e.preventDefault(); });
      b.addEventListener('pointermove', (e) => { if (!depart || occupe || chargement) return; const r = scene.getBoundingClientRect(); bouger(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)); });
      b.addEventListener('pointerup', () => { depart = null; }); b.addEventListener('pointercancel', () => { depart = null; });
      b.addEventListener('keydown', (e) => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || occupe || chargement || !rectangleValide(rectangle)) return;
        e.preventDefault(); proteger(); depart = { ...rectangle }; const x = coin === 'debut' ? rectangle.x : rectangle.x + rectangle.largeur, y = coin === 'debut' ? rectangle.y : rectangle.y + rectangle.hauteur;
        bouger(clamp(x + (e.key === 'ArrowLeft' ? -.01 : e.key === 'ArrowRight' ? .01 : 0)), clamp(y + (e.key === 'ArrowUp' ? -.01 : e.key === 'ArrowDown' ? .01 : 0))); depart = null; });
      return b;
    };
    cadre.append(poignee('debut'), poignee('fin'));
    contenu.append(...[boutonsChoix(), el('p', null, proposition ? t('Ajuster le cadrage') : t('Choisis uniquement la photographie du plat.')),
      page.printed_page != null ? el('small', { class: 'muted' }, t('Page {p}', { p: page.printed_page })) : null,
      scene, el('div', { class: 'two-col', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))' } }, ...[...inputs].map(([k, input]) => field(textes[k], input))),
      apercuImg, message, el('div', { class: 'row' }, utiliser,
        el('button', { type: 'button', class: 'btn', onClick: ignorer }, t('Ignorer')))].filter(Boolean));
    actualiserCadre();
  }

  function actualiserCadre(champs = false) {
    if (!forme) return;
    const valide = rectangleValide(rectangle);
    forme.cadre.hidden = !valide;
    if (valide) Object.assign(forme.cadre.style, { left: pct(rectangle.x) + '%', top: pct(rectangle.y) + '%', width: pct(rectangle.largeur) + '%', height: pct(rectangle.hauteur) + '%' });
    if (champs) for (const [k, input] of forme.inputs) input.value = pct(rectangle[k]);
    for (const input of forme.inputs.values()) input.disabled = occupe || chargement;
    forme.utiliser.disabled = !valide || occupe || chargement || !jpeg;
  }

  async function apercu() {
    if (!forme || !previewSource || chargement || occupe) return;
    const f = forme, selection = generation, g = ++f.generationApercu; jpeg = null; f.utiliser.disabled = true;
    if (!rectangleValide(rectangle)) { message.textContent = t('Le cadrage doit rester entièrement dans la page.'); return; }
    try {
      const image = await preparerRecadragePage(previewSource, { rectangle });
      if (forme !== f || g !== f.generationApercu || selection !== generation) return;
      jpeg = image; const ancienne = f.urlApercu; f.urlApercu = adresse(image); f.apercuImg.src = f.urlApercu;
      if (ancienne) revoquerUrlDeBlob(ancienne);
      message.textContent = ''; f.utiliser.disabled = occupe;
    } catch (e) { if (forme === f && g === f.generationApercu && selection === generation) message.textContent = erreur(e); }
  }

  async function enregistrer() {
    if (occupe || chargement || !jpeg || !original || !source || !rectangleValide(rectangle)) return;
    const selection = { ...source, rectangle: { ...rectangle } };
    const imageSource = original, recetteDepart = { ...photoDepart }, importId = ligne?.id ?? null, lectureKey = ligne ? clePhotoLecture(ligne) : null;
    proteger(); ++generation; occupe = true; actualiserCadre();
    try {
      if (recetteDepart.photo_sha256 && !await confirmer(t('Remplacer la photo du livre par ce cadrage ?'), { okLabel: t('Remplacer'), cancelLabel: t('Annuler') })) return;
      const image = await preparerRecadragePage(imageSource, { rotation: selection.rotation, rectangle: selection.rectangle });
      await enregistrerPhotoPage({ repo, recipe: recetteDepart, source: selection, blob: image, importId, lectureKey });
      liberer();
      message.textContent = t('Photo du livre enregistrée.');
      jpeg = null;
      await deps.onPhotoChange?.();
      root.dispatchEvent(new CustomEvent('photo-page-change', { bubbles: true }));
    } catch (e) { message.textContent = erreur(e); }
    finally { occupe = false; actualiserCadre(); if (forme && !jpeg) forme.utiliser.disabled = true; }
  }

  async function ignorer() {
    if (occupe) return;
    ++generation; chargement = false; occupe = true; actualiserCadre();
    try {
      if (ligne) await repo.saveBatch({}, { conditions: { imports: [{ key: ligne.id, fusion: (i) => {
        if (!i || i.recipe_id !== recipe.id || i.status !== 'enregistre' || clePhotoLecture(i) !== clePhotoLecture(ligne)) throw new Error('lecture_modifiee');
        return { ...i, resultat: { ...i.resultat, photo_choice: 'ignoree' } };
      } }] } });
      if (ligne) proposees = proposees.filter((p) => p.ligne.id !== ligne.id);
      liberer();
      ++generation; contenu.replaceChildren(el('p', { role: 'status' }, t('Image ignorée.')), boutonsChoix(), message); nettoyerUrls(); forme = null; jpeg = null;
    } catch (e) { message.textContent = erreur(e); }
    finally { occupe = false; }
  }

  contenu.append(boutonsChoix(), message);
  if (proposees.length) await choisir(proposees[0].source.page_id, proposees[0]);
  return root;
}
