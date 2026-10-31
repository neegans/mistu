// Routeur par fragment (#/chemin?query) : fonctionne depuis n'importe quel hébergement statique et en PWA installée.

const routes = [];
let notFound = null;
const gardesSortie = new Set();
const contratsSortie = new Map(), demandesExplicites = new WeakMap();
export function enregistrerGardeSortie(garde, contrat = {}) {
  gardesSortie.add(garde); contratsSortie.set(garde, contrat);
  return () => { gardesSortie.delete(garde); contratsSortie.delete(garde); };
}
const refusExplicite = raison => ({issue:'refuse',raison});
const MOTIFS_CONSERVATION = new Set(['formulaire_ouvert','contrat_incomplet','contexte_change','saisie_locale','lecture_en_cours','a_conserver','conservation_echouee','rester']);
export function demanderGardeExplicite({intention, racine, estCourante = () => true} = {}) {
  if (!racine || !['conserver','revoir_sortie'].includes(intention)) return Promise.resolve(refusExplicite('contrat_incomplet'));
  const precedente = demandesExplicites.get(racine);
  if (precedente) return precedente.intention === intention ? precedente.promise : Promise.resolve(refusExplicite('conservation_echouee'));
  const valide = () => { try { return racine.isConnected && estCourante() === true; } catch { return false; } };
  if (!valide()) return Promise.resolve(refusExplicite('contexte_change'));
  let saisieChangee = false;
  const frappe = () => { saisieChangee = true; };
  for (const nom of ['input','change']) racine.addEventListener(nom, frappe, true);
  const promesse = (async () => {
    // Import littéral tardif : le registre de saisie existe déjà dans l'app ; aucune navigation ni écriture.
    const {observerSaisiesMontees} = await import('../ui/state.js');
    if (!valide()) return refusExplicite('contexte_change');
    const candidates = [...contratsSortie].filter(([,c]) => c.racine?.isConnected && (c.racine === racine || racine.contains(c.racine)));
    if (candidates.length > 1) return refusExplicite('contrat_incomplet');
    const [garde, contrat] = candidates[0] || [];
    const cible = contrat?.racine || racine;
    const complet = typeof cible.flushEditeur === 'function' && typeof cible.etatEditeur === 'function';
    const connu = typeof contrat?.demanderExplicite === 'function' || complet;
    if ([...contratsSortie.values()].some(c=>!c.racine)) return refusExplicite('contrat_incomplet');
    const autreSaisie = () => observerSaisiesMontees({exclure:connu ? cible : null}).nombre > 0;
    if (autreSaisie()) return refusExplicite('formulaire_ouvert');
    if (!connu) return (candidates.length || cible.flushEditeur || cible.etatEditeur) ? refusExplicite('contrat_incomplet') : {issue:'sans_saisie_suivie'};
    const toujoursValide = () => valide() && (!garde || contratsSortie.get(garde) === contrat);
    let resultat;
    if (contrat?.demanderExplicite) resultat = await contrat.demanderExplicite({intention,estCourante:toujoursValide});
    else {
      const etatAvant = cible.etatEditeur();
      if (!etatAvant || typeof etatAvant.sale !== 'boolean' || typeof etatAvant.enCours !== 'boolean') return refusExplicite('contrat_incomplet');
      const r = await cible.flushEditeur(), e = cible.etatEditeur();
      resultat = r?.issue === 'ok' && e && !e.sale && !e.enCours ? {issue:'conserve'} : refusExplicite(r?.raison || 'conservation_echouee');
    }
    if (!toujoursValide()) return refusExplicite('contexte_change');
    if (autreSaisie()) return refusExplicite('formulaire_ouvert');
    if (saisieChangee) return refusExplicite('saisie_locale');
    if (resultat?.issue === 'conserve') return {issue:'conserve'};
    if (resultat?.issue === 'quitter_sans_conserver' && intention === 'revoir_sortie') return {issue:'quitter_sans_conserver'};
    return refusExplicite(MOTIFS_CONSERVATION.has(resultat?.raison) ? resultat.raison : 'conservation_echouee');
  })().catch(() => refusExplicite(valide() ? 'conservation_echouee' : 'contexte_change')).finally(() => {
    for (const nom of ['input','change']) racine.removeEventListener(nom, frappe, true);
    demandesExplicites.delete(racine);
  });
  demandesExplicites.set(racine,{intention,promise:promesse});return promesse;
}
function avantNavigation(demande) {
  const gardes = [...gardesSortie];
  const poursuivre = index => {
    for (; index < gardes.length; index++) {
      const accord = gardes[index](demande);
      if (accord?.then) {
        const suivante = index + 1;
        return Promise.resolve(accord).then(valeur => valeur === false ? false : poursuivre(suivante));
      }
      if (accord === false) return false;
    }
    return true;
  };
  // Une ancienne vue démontée autorise immédiatement ; seules les gardes actives imposent une attente.
  return poursuivre(0);
}

export function route(pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^\\/]+)'; }) + '$');
  routes.push({ regex, keys, handler, pattern });
}

export function setNotFound(handler) { notFound = handler; }

export function parseHash(hash = location.hash) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart || '/';
  const query = {};
  for (const [k, v] of new URLSearchParams(queryPart)) query[k] = v;
  return { path, query };
}

export function navigate(path, { replace = false } = {}) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) { remplacerAdresse(target); window.dispatchEvent(new Event('cuisineos:replace')); }
  else location.hash = target;
}

// Retire ou pose un paramètre d'adresse SANS re-rendu : history.replaceState ne déclenche pas hashchange. Injecté dans les
// vues qui s'en servent (geste `historique.remplacer`), donc espionnable dans la suite.
export const CLE_ENTREE_NAV = 'mistuNavigation';
const nouvelleCle = () => globalThis.crypto?.randomUUID?.() || 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
export function remplacerAdresse(hash, { fenetre = window } = {}) {
  const href = hash.startsWith('#') ? hash : '#' + hash;
  const state = fenetre.history.state && typeof fenetre.history.state === 'object' ? fenetre.history.state : {};
  fenetre.history.replaceState({ ...state, ...(state[CLE_ENTREE_NAV] ? { [CLE_ENTREE_NAV]: { ...state[CLE_ENTREE_NAV], href } } : {}) }, '', href);
}

export function currentPath() { return parseHash().path; }

export function buildQuery(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
}

export function resolve(hash = location.hash) {
  const { path, query } = parseHash(hash);
  for (const r of routes) {
    const m = r.regex.exec(path);
    if (m) {
      const params = {};
      try { r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); } catch { continue; }
      return { handler: r.handler, params, query, path, pattern: r.pattern };
    }
  }
  return { handler: notFound, params: {}, query, path, pattern: null };
}

export function start(onRoute, { fenetre = window, avantRoute = avantNavigation, normaliserAdresse = href => href } = {}) {
  let derniere = null, dernierEtat = null, observee = null, compensation = null, demandeId = 0, arretee = false;
  const run = (event) => {
    const hrefBrut = fenetre.location.hash || '#/';
    const href = normaliserAdresse(hrefBrut);
    const state = fenetre.history.state && typeof fenetre.history.state === 'object' ? fenetre.history.state : {};
    let entree = state[CLE_ENTREE_NAV];
    // Une entrée neuve peut hériter du state précédent : la reconnaître AVANT
    // normalisation empêche de légitimer cette ancienne clé pour sa nouvelle URL.
    const reconnue = entree && typeof entree.cle === 'string' && entree.href === hrefBrut && Number.isSafeInteger(entree.position) && typeof entree.chaine === 'string';
    let type = event?.type === 'cuisineos:refresh' ? 'refresh' : event?.type === 'cuisineos:replace' ? 'replace' : derniere ? 'navigation' : 'initial';
    if (!reconnue) {
      entree = { cle: nouvelleCle(), href, position: (observee?.position ?? derniere?.position ?? -1) + 1, chaine: observee?.chaine || derniere?.chaine || nouvelleCle() };
    } else if (href !== hrefBrut) entree = { ...entree, href };
    // Remplacement de la même entrée, sans événement supplémentaire ni second
    // passage de la garde de sortie. resolve et ses métadonnées partagent l'URL.
    if (!reconnue || href !== hrefBrut) fenetre.history.replaceState({ ...state, [CLE_ENTREE_NAV]: entree }, '', href);
    if (reconnue && derniere && entree.cle !== derniere.cle) type = 'retour';
    const indexNavigateur = fenetre.navigation?.currentEntry?.index;
    entree = { ...entree, indexNavigateur: Number.isSafeInteger(indexNavigateur) ? indexNavigateur : null };
    if (compensation?.cle === entree.cle && compensation.href === href) { compensation = null; observee = { ...entree }; return; }
    if (observee?.cle === entree.cle && observee.href === href && !['refresh', 'replace'].includes(type)) return;
    observee = { ...entree };
    if (derniere?.cle === entree.cle && derniere.href === href && !['refresh', 'replace'].includes(type)) { demandeId++; return; }
    const precedente = derniere, etatPrecedent = dernierEtat, id = ++demandeId;
    const cible = { ...resolve(href), navigation: { type, cleEntree: entree.cle, position: entree.position, chaine: entree.chaine, precedente } };
    const finir = autorisee => {
      if (arretee || id !== demandeId) return;
      if (autorisee !== false) { derniere = { ...entree }; dernierEtat = { ...fenetre.history.state }; onRoute(cible); return; }
      if (!precedente || precedente.cle === entree.cle && precedente.href === href) return;
      // Le navigateur a déjà changé d’entrée. Revenir à la clé exacte sans fabriquer une nouvelle entrée.
      compensation = { ...precedente };
      const delta = precedente.indexNavigateur !== null && entree.indexNavigateur !== null ? precedente.indexNavigateur - entree.indexNavigateur
        : precedente.chaine === entree.chaine ? precedente.position - entree.position : null;
      if (delta !== null && delta !== 0) fenetre.history.go(delta);
      else { compensation = null; fenetre.history.replaceState(etatPrecedent, '', precedente.href); observee = { ...precedente }; }
    };
    if (!precedente) { finir(true); return; }
    let accord;
    try { accord = avantRoute({ ...cible, depuis: { ...precedente }, event: event?.type || 'initial' }); }
    catch { finir(false); return; }
    if (accord?.then) Promise.resolve(accord).then(finir, () => finir(false)); else finir(accord);
  };
  for (const nom of ['popstate', 'hashchange', 'cuisineos:refresh', 'cuisineos:replace']) fenetre.addEventListener(nom, run);
  run();
  return () => { arretee = true; demandeId++; for (const nom of ['popstate', 'hashchange', 'cuisineos:refresh', 'cuisineos:replace']) fenetre.removeEventListener(nom, run); };
}

// Re-rend la route courante (après une écriture ou un changement de réglage).
export function refresh() { window.dispatchEvent(new Event('cuisineos:refresh')); }
