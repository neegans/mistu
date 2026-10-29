// Réception des seules images visibles, via le moteur existant. Aucun accès direct au compte ou au stockage distant.
import { el, downloadBlob } from '../core/dom.js';
import { t } from '../core/i18n.js';
import * as depot from '../model/repo.js';
import { displayUrl, typeAffichage, safeDisplayType, extensionFor } from '../sync/mime.js';
import { remoteDeCeCompte, HASH_FICHIER, lireErreursFichiers } from '../sync/fichiers.js';
import { urlDeBlob, revoquerUrlDeBlob } from '../core/blob-urls.js';

export const LIMITES_PHOTOS_VISIBLES = Object.freeze({ concurrence: 2, parPasse: 20 });
const groupes = new WeakMap();
function recevoir(moteur, cle, travail) {
  let g = groupes.get(moteur);
  if (!g) { g = { vols: new Map(), file: [], actifs: 0, partis: 0, prochain: null }; groupes.set(moteur, g); }
  const partage = g.vols.get(cle);
  if (partage) { partage.travaux.push(travail); return partage.promise; }
  const lancer = () => {
    while (g.actifs < LIMITES_PHOTOS_VISIBLES.concurrence && g.file.length && g.partis < LIMITES_PHOTOS_VISIBLES.parPasse) {
      const job = g.file.shift(); g.actifs++; g.partis++;
      const terminer = (reussie, valeur) => {
        g.actifs--; if (g.vols.get(job.cle) === job) g.vols.delete(job.cle);
        if (reussie) job.resolve(valeur); else job.reject(valeur);
        lancer();
      };
      Promise.resolve().then(async () => {
        // Une vue peut disparaître pendant l’attente. La demande appartient à toutes les vues de cette empreinte.
        for (const candidat of job.travaux) if (await candidat()) return true;
        return false;
      }).then(valeur => terminer(true, valeur), erreur => terminer(false, erreur));
    }
    if (g.file.length && g.partis >= LIMITES_PHOTOS_VISIBLES.parPasse && g.prochain === null) g.prochain = setTimeout(() => { g.prochain = null; g.partis = 0; lancer(); }, 0);
    if (!g.file.length && !g.actifs) g.partis = 0;
  };
  const job = { cle, travaux: [travail] };
  job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
  g.file.push(job); g.vols.set(cle, job); lancer(); return job.promise;
}

function observerVisibilite(node, action) {
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.target === node) action(entry.isIntersecting); }, { rootMargin: '0px' });
    observer.observe(node); return () => observer.disconnect();
  }
  const verifier = () => { const r = node.getBoundingClientRect(); action(node.isConnected && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth); };
  const frame = requestAnimationFrame(verifier); window.addEventListener('scroll', verifier, { passive: true }); window.addEventListener('resize', verifier);
  return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', verifier); window.removeEventListener('resize', verifier); };
}
const vues = new Set(); let nettoyeur = null;
function suivre(node) {
  const maintenant = Date.now();
  // Une route abandonnée peut ne jamais être insérée ; elle ne conserve pas ses observateurs à vie.
  for (const vue of vues) if (!vue.isConnected && (vue.vueMontee || maintenant - vue.creee > 120000)) vue.dispose();
  node.creee = maintenant;
  vues.add(node);
  if (!nettoyeur && typeof MutationObserver === 'function' && document.body) {
    nettoyeur = new MutationObserver(() => { for (const v of vues) { if (v.isConnected) v.vueMontee = true; else if (v.vueMontee) v.dispose(); } });
    nettoyeur.observe(document.body, { childList: true, subtree: true });
  }
}

export function photoVisible(sha256, { fichier = null, repo = depot, ctxF = {}, alt = '', classe = '', classeImage = 'plat-vignette', personnelle = false, observer = observerVisibilite,
  enLigne = () => navigator.onLine !== false, telechargerFichier = downloadBlob } = {}) {
  if (typeof sha256 !== 'string' || !HASH_FICHIER.test(sha256)) return null;
  const root = el('div', { class: `photo-visible ${classe}`.trim(), dataset: { role: 'photo-visible', sha256 } });
  let row = fichier, visible = false, disposed = false, tried = false, echec = false, charge = false, url = null, blobAffiche = null, illisibleAffichee = null, pauseLue = false, lecture = Promise.resolve();
  const moteur = ctxF.moteur, uid = ctxF.uid;
  const courant = () => { try { return typeof ctxF.courant === 'function' ? ctxF.courant() : ctxF; } catch { return {}; } };
  const memeCompte = () => { const c = courant(); return c.uid === uid && c.moteur === moteur && c.connecte === ctxF.connecte; };
  const pause = () => { try { const e = moteur?.etat?.() || {}; return !!(pauseLue || e.pauseFichiers || e.pause); } catch { return true; } };
  const type = () => row?.blob instanceof Blob ? typeAffichage(row) : safeDisplayType(row?.remote?.mime) ?? safeDisplayType(row?.mime);
  const erreur = () => echec || !!ctxF.erreurs?.has?.(sha256);
  const possible = () => !disposed && memeCompte() && ctxF.connecte === true && !!moteur && enLigne() && !pause() && remoteDeCeCompte(row?.remote, uid) && type()?.startsWith('image/');
  const liberer = () => { if (url) revoquerUrlDeBlob(url); url = null; blobAffiche = null; };
  const message = texte => { liberer(); root.replaceChildren(el('small', { role: 'status' }, texte)); };
  const identiteBlob = () => row?.blob instanceof Blob ? JSON.stringify([type(), row.blob.size, row.remote?.sha256 || null]) : null;
  function illisible() {
    illisibleAffichee = identiteBlob();
    message(t('Cette image ne peut pas être affichée sur cet appareil.'));
    if (row?.blob instanceof Blob) root.append(el('button', { type: 'button', class: 'btn small', dataset: { role: 'telecharger-image' }, onClick: () => telechargerFichier(row.blob, row.original_filename || `photo.${extensionFor(typeAffichage(row))}`) }, t('Télécharger le fichier')));
  }
  function dessiner() {
    if (disposed) return;
    if (!memeCompte()) { message(t('Le compte a changé. Rouvre cette photo.')); return; }
    if (row?.blob instanceof Blob) {
      const identite = identiteBlob();
      if (blobAffiche === identite && root.querySelector('img')) return;
      if (illisibleAffichee === identite) { illisible(); return; }
      if (!type()?.startsWith('image/')) { illisible(); return; }
      liberer(); url = displayUrl(row, urlDeBlob); blobAffiche = identite; illisibleAffichee = null;
      const img = el('img', { src: url, alt, loading: 'lazy', class: classeImage }); img.addEventListener('error', illisible, { once: true });
      root.replaceChildren(img); return;
    }
    if (charge) { message(t('Téléchargement de la photo…')); return; }
    let texte;
    if (!row) texte = t('Photo pas encore reçue sur cet appareil.');
    else if (pause()) texte = t('Téléchargement des photos en pause.');
    else if (erreur()) texte = t('Le téléchargement de la photo a échoué.');
    else if (!type()?.startsWith('image/')) texte = t('Ce fichier ne peut pas être affiché comme photo.');
    else if (!ctxF.connecte) texte = t('Connecte-toi pour télécharger cette photo.');
    else if (!remoteDeCeCompte(row.remote, uid)) texte = t('Photo pas encore envoyée par l’appareil qui l’a prise.');
    else texte = personnelle ? t('Ma photo du plat · Photo à télécharger') : t('Photo à télécharger');
    message(texte);
    if (possible()) root.append(el('button', { type: 'button', class: 'btn small', onClick: () => actualiser(true) }, erreur() ? t('Réessayer') : t('Télécharger')));
  }
  async function relire() {
    if (typeof repo.getFile === 'function') row = await repo.getFile(sha256) ?? row;
    if (repo.db) ctxF.erreurs = await lireErreursFichiers(repo.db);
    if (typeof repo.get === 'function') pauseLue = !!(await repo.get('sync_state', 'pause_fichiers'))?.value;
  }
  function actualiser(manuel = false) {
    lecture = lecture.catch(() => {}).then(async () => {
      if (disposed) return;
      await relire(); dessiner();
      if (row?.blob instanceof Blob || !possible() || (!manuel && (!root.isConnected || !visible || tried || erreur()))) return;
      tried = true; charge = true; dessiner();
      try {
        const tentee = await recevoir(moteur, `${uid}:${sha256}`, async () => {
          await relire();
          if (!possible() || (!manuel && (!root.isConnected || !visible)) || row?.blob instanceof Blob) return false;
          if (typeof repo.get === 'function' && (await repo.get('sync_state', 'pause_fichiers'))?.value) { pauseLue = true; return false; }
          if (!possible()) return false;
          if (manuel && erreur() && typeof moteur.reessayerFichier === 'function') await moteur.reessayerFichier(sha256);
          else await moteur.telecharger([sha256]);
          return true;
        });
        await relire(); echec = tentee && !(row?.blob instanceof Blob);
        if (!tentee) tried = false;
      } catch { echec = true; }
      finally { charge = false; dessiner(); }
    }).catch(() => { echec = true; charge = false; dessiner(); });
    return lecture;
  }
  let stopEtat = null;
  const stopObserver = observer(root, v => {
    visible = !!v;
    if (visible) {
      if (root.isConnected) root.vueMontee = true;
      if (!stopEtat && root.isConnected) stopEtat = moteur?.onEtat?.(() => { if (!root.isConnected) root.dispose(); else if (!charge && visible) actualiser(); }) || null;
      actualiser();
    }
  });
  const online = () => { if (root.isConnected) actualiser(); else if (root.vueMontee) root.dispose(); }; window.addEventListener('online', online);
  root.dispose = () => { if (disposed) return; disposed = true; stopObserver?.(); stopEtat?.(); window.removeEventListener('online', online); liberer(); vues.delete(root); };
  root.actualiser = actualiser; root.attendre = () => lecture; suivre(root); dessiner();
  // La lecture locale ne déclenche aucune réception tant que l’élément n’est pas visible.
  if (!fichier) actualiser(); return root;
}
