const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const differe = () => { let resolve, reject; const promise = new Promise((oui, non) => { resolve = oui; reject = non; }); return { promise, resolve, reject }; };
class DocumentTest extends EventTarget {
  constructor() { super(); this.visibilityState = 'visible'; this.ecouteurs = new Set(); }
  addEventListener(type, fn, options) { super.addEventListener(type, fn, options); this.ecouteurs.add(fn); }
  removeEventListener(type, fn, options) { super.removeEventListener(type, fn, options); this.ecouteurs.delete(fn); }
  visibilite(value) { this.visibilityState = value; this.dispatchEvent(new Event('visibilitychange')); }
}
class Sentinelle extends EventTarget {
  constructor({ rejet = false } = {}) { super(); this.released = false; this.appels = 0; this.rejet = rejet; }
  async release() { this.appels++; if (this.rejet) throw Error('release refusé'); this.released = true; this.dispatchEvent(new Event('release')); }
}
export async function runL7EcranAllumeTests({ eq, ok }) {
  const { creerControleurEcran, creerCommandeEcranAllume } = await import('../src/ui/ecran-allume.js');
  for (const cas of ['absent', 'insecure']) {
    let appels = 0;
    const c = creerControleurEcran({ document: new DocumentTest(), wakeLock: cas === 'absent' ? null : { request: async () => { appels++; return new Sentinelle(); } }, secureContext: cas !== 'insecure' });
    await c.activer(); eq(c.etat().etat, 'indisponible', `L7 écran : ${cas} annoncé sans succès`); eq(appels, 0, `L7 écran : ${cas} sans demande navigateur`); await c.detruire();
  }
  {
    const doc = new DocumentTest(), sentinelles = [], premier = differe(); let appels = 0;
    const c = creerControleurEcran({ document: doc, secureContext: true, wakeLock: { request: () => { appels++; if (appels === 1) return premier.promise; const s = new Sentinelle(); sentinelles.push(s); return Promise.resolve(s); } } });
    const a = c.activer(), b = c.activer(); eq(appels, 1, 'L7 écran : double geste, une seule demande en vol'); eq(c.etat().etat, 'demande', 'L7 écran : attente distincte d’actif');
    const s = new Sentinelle(); sentinelles.push(s); premier.resolve(s); await Promise.all([a, b]); eq(c.etat().etat, 'actif', 'L7 écran : actif après sentinelle réelle');
    doc.visibilite('hidden'); await pause(); eq(s.appels, 1, 'L7 écran : masquage libère la sentinelle'); eq(c.etat().etat, 'suspendu', 'L7 écran : masquage garde un état suspendu'); ok(doc.ecouteurs.size > 0, 'L7 écran : écoute du retour conservée');
    doc.visibilite('visible'); await pause(); eq(appels, 2, 'L7 écran : retour visible, une seule nouvelle demande'); eq(c.etat().etat, 'actif', 'L7 écran : retour accordé');
    await sentinelles.at(-1).release(); await pause(); eq(c.etat().etat, 'refuse', 'L7 écran : révocation système annoncée'); eq(appels, 2, 'L7 écran : révocation ne boucle pas');
    await c.detruire(); eq(doc.ecouteurs.size, 0, 'L7 écran : dispose retire les écouteurs'); doc.visibilite('visible'); await pause(); eq(appels, 2, 'L7 écran : aucun redémarrage après dispose');
  }
  for (const action of ['desactiver', 'detruire']) {
    const d = differe(), s = new Sentinelle(), doc = new DocumentTest();
    const c = creerControleurEcran({ document: doc, secureContext: true, wakeLock: { request: () => d.promise } });
    const vol = c.activer(); await c[action](); d.resolve(s); await vol;
    eq(s.appels, 1, `L7 écran : réponse tardive après ${action} libérée`); eq(c.etat().etat, 'inactif', `L7 écran : réponse tardive après ${action} sans faux actif`); await c.detruire();
  }
  {
    const doc = new DocumentTest(); let appels = 0;
    const c = creerControleurEcran({ document: doc, secureContext: true, wakeLock: { request: async () => { appels++; throw Error('permission'); } } });
    await c.activer(); eq(c.etat().etat, 'refuse', 'L7 écran : refus explicite'); await pause(); eq(appels, 1, 'L7 écran : pas de nouvelle tentative automatique après refus');
    doc.visibilite('hidden'); doc.visibilite('visible'); await pause(); eq(appels, 2, 'L7 écran : un événement de retour autorise une tentative');
    await c.desactiver(); doc.visibilite('hidden'); doc.visibilite('visible'); await pause(); eq(appels, 2, 'L7 écran : désactivation retire la volonté'); await c.detruire();
  }
  {
    const s = new Sentinelle({ rejet: true }), c = creerControleurEcran({ document: new DocumentTest(), secureContext: true, wakeLock: { request: async () => s } });
    await c.activer(); await c.desactiver(); eq(c.etat().etat, 'inactif', 'L7 écran : release rejeté capturé sans garder actif'); await c.detruire();
  }
  {
    let appels = 0;
    const c = creerControleurEcran({ document: new DocumentTest(), secureContext: true, wakeLock: { request: () => { appels++; throw Error('refus synchrone'); } } });
    await c.activer(); await c.activer(); eq(appels, 2, 'L7 écran : refus synchrone permet un vrai réessai'); await c.detruire();
  }
  {
    let courante = true; const d = differe(), s = new Sentinelle();
    const c = creerControleurEcran({ document: new DocumentTest(), secureContext: true, estCourante: () => courante, wakeLock: { request: () => d.promise } });
    const vol = c.activer(); courante = false; d.resolve(s); await vol; eq(s.appels, 1, 'L7 écran : ancienne portée ne reçoit pas la sentinelle'); ok(c.etat().etat !== 'actif', 'L7 écran : ancienne portée ne devient pas active'); await c.detruire();
  }
  {
    const c = creerControleurEcran({ document: new DocumentTest(), secureContext: true, wakeLock: { request: async () => new Sentinelle() } });
    const node = creerCommandeEcranAllume({ controleur: c }); document.body.append(node);
    try { eq(c.etat().etat, 'inactif', 'L7 écran : montage sans acquisition'); node.querySelector('button').click(); await pause(); eq(node.querySelector('button').getAttribute('aria-pressed'), 'true', 'L7 écran : commande reflète volonté réelle'); ok(node.textContent.includes('Actif'), 'L7 écran : statut actif visible après accord'); }
    finally { node.dispose(); node.remove(); await c.detruire(); }
  }
}
