// Indices d’invalidation seulement : les vues relisent la base après un commit réussi.
// Aucune donnée métier, preuve d’écriture ou identité de compte ne transite ici.
const abonnements = new Set();

export function signalerCommit(base, magasins) {
  if (!base || !Array.isArray(magasins) || !magasins.length) return;
  const noms = [...new Set(magasins.filter(n => typeof n === 'string' && Object.hasOwn(base.stores || {}, n)))].sort();
  if (!noms.length) return;
  for (const fn of abonnements) {
    try { fn(base, noms); } catch { /* Une notification ne doit jamais faire échouer une écriture déjà commise. */ }
  }
}

export function observerBase({base, estCourante = () => true, surChangement, creerCanal = nom => typeof BroadcastChannel === 'function' ? new BroadcastChannel(nom) : null}) {
  if (!base || typeof base.name !== 'string' || typeof surChangement !== 'function') throw new TypeError('Observation de base invalide');
  let ferme = false, programme = false, canal = null;
  const attente = new Set();
  const courante = () => { try { return !ferme && estCourante(); } catch { return false; } };
  const ajouter = magasins => {
    if (!courante()) return;
    for (const nom of magasins) attente.add(nom);
    if (programme || !attente.size) return;
    programme = true;
    Promise.resolve().then(() => {
      programme = false;
      const noms = [...attente].sort(); attente.clear();
      if (!courante() || !noms.length) return;
      try { Promise.resolve(surChangement({base, magasins:noms})).catch(() => {}); } catch { /* Vue quittée ou défaillante. */ }
    });
  };
  const recevoir = event => {
    const message = event?.data;
    if (!message || typeof message !== 'object' || Array.isArray(message) || Object.keys(message).sort().join(',') !== 'format,magasins' || message.format !== 1) return;
    const noms = message.magasins;
    if (!Array.isArray(noms) || !noms.length || noms.length > 200 || !noms.every(n => typeof n === 'string' && n.length <= 128 && Object.hasOwn(base.stores || {}, n))) return;
    ajouter(noms); // Ne jamais renvoyer ce message, ni appliquer son contenu à IndexedDB.
  };
  try { canal = creerCanal('mistu-base-v1:' + base.name); canal?.addEventListener('message', recevoir); } catch { canal = null; }
  const local = (source, magasins) => {
    if (!courante() || source.name !== base.name) return;
    ajouter(magasins);
    if (source === base) {
      try { canal?.postMessage({format:1, magasins}); } catch { /* Repli : relecture au retour visible. */ }
    }
  };
  abonnements.add(local);
  return () => {
    if (ferme) return;
    ferme = true; attente.clear(); abonnements.delete(local);
    try { canal?.removeEventListener('message', recevoir); } catch {}
    try { canal?.close(); } catch {}
    canal = null;
  };
}
