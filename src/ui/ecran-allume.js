import { el } from '../core/dom.js';
import { t } from '../core/i18n.js';

// La sentinelle est une permission révocable, jamais une preuve de tâche exécutée en arrière-plan.
export function creerControleurEcran({
  document: doc = globalThis.document,
  wakeLock = globalThis.navigator?.wakeLock,
  secureContext = globalThis.isSecureContext,
  estCourante = () => true,
} = {}) {
  const disponible = !!doc && secureContext === true && typeof wakeLock?.request === 'function';
  const abonnes = new Set();
  let voulu = false, detruit = false, numero = 0, sentinelle = null, retirerRelease = null, vol = null, retourAttendu = false;
  let statut = disponible ? 'inactif' : 'indisponible', raison = disponible ? null : 'indisponible';
  const courante = () => { try { return !detruit && estCourante(); } catch { return false; } };
  const visible = () => doc?.visibilityState === 'visible';
  const etat = () => ({ etat: statut, voulu, raison });
  const annoncer = (suivant, motif = null) => {
    statut = suivant; raison = motif;
    for (const fn of abonnes) { try { fn(etat()); } catch { /* Un observateur ne garde pas une sentinelle vivante. */ } }
  };
  const liberer = async s => { try { await s?.release?.(); } catch { /* La révocation peut déjà avoir eu lieu. */ } };
  const retirerSentinelle = () => {
    const ancienne = sentinelle; sentinelle = null; retirerRelease?.(); retirerRelease = null;
    return liberer(ancienne);
  };
  function demander() {
    if (!courante() || !voulu) return Promise.resolve(etat());
    if (!disponible) { annoncer('indisponible', 'indisponible'); return Promise.resolve(etat()); }
    if (!visible()) { annoncer('suspendu'); return Promise.resolve(etat()); }
    if (sentinelle && !sentinelle.released) return Promise.resolve(etat());
    if (vol) return vol;
    const attendu = numero;
    annoncer('demande');
    let reception;
    try { reception = wakeLock.request('screen'); }
    catch { annoncer('refuse', 'refus'); return Promise.resolve(etat()); }
    vol = (async () => {
      try {
        const recue = await reception;
        if (!recue || typeof recue.release !== 'function') throw Error('sentinelle absente');
        if (!courante() || !voulu || !visible() || attendu !== numero) {
          await liberer(recue);
          if (!courante() && !detruit) { voulu = false; annoncer('inactif'); }
          return etat();
        }
        if (recue.released) { annoncer('refuse', 'libere'); return etat(); }
        sentinelle = recue;
        const relachee = () => {
          if (sentinelle !== recue) return;
          sentinelle = null; retirerRelease?.(); retirerRelease = null;
          if (courante() && voulu) annoncer(visible() ? 'refuse' : 'suspendu', 'libere');
        };
        recue.addEventListener?.('release', relachee);
        retirerRelease = () => recue.removeEventListener?.('release', relachee);
        annoncer('actif');
      } catch {
        if (courante() && voulu && attendu === numero) annoncer(visible() ? 'refuse' : 'suspendu', 'refus');
      } finally {
        vol = null;
        if (retourAttendu && courante() && voulu && visible()) { retourAttendu = false; void demander(); }
      }
      return etat();
    })();
    return vol;
  }
  const visibilite = () => {
    if (!courante()) { void desactiver(); return; }
    if (!visible()) {
      numero++; retourAttendu = false; void retirerSentinelle();
      if (voulu) annoncer('suspendu');
    } else if (voulu) {
      if (vol) retourAttendu = true;
      else void demander();
    }
  };
  doc?.addEventListener('visibilitychange', visibilite);
  function activer() {
    if (!courante()) return Promise.resolve(etat());
    if (!disponible) { annoncer('indisponible', 'indisponible'); return Promise.resolve(etat()); }
    voulu = true; return demander();
  }
  async function desactiver() {
    voulu = false; numero++; retourAttendu = false;
    const liberation = retirerSentinelle(); annoncer('inactif'); await liberation;
    return etat();
  }
  async function detruire() {
    if (detruit) return;
    detruit = true; doc?.removeEventListener('visibilitychange', visibilite);
    await desactiver(); abonnes.clear();
  }
  return {
    activer, desactiver, detruire, etat,
    souscrire(fn) { if (detruit) return () => {}; abonnes.add(fn); fn(etat()); return () => abonnes.delete(fn); },
  };
}

export function creerCommandeEcranAllume({ controleur }) {
  let detruite = false;
  const statut = el('span', { class: 'muted', role: 'status', dataset: { role: 'etat-ecran' } });
  const bouton = el('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', onClick: () => {
    if (detruite) return;
    const e = controleur.etat();
    if (e.voulu && ['actif', 'demande', 'suspendu'].includes(e.etat)) void controleur.desactiver();
    else void controleur.activer();
  } }, t('Garder l’écran allumé'));
  const node = el('div', { class: 'cuisine-ecran-allume', dataset: { role: 'commande-ecran' } }, bouton, statut);
  const arreter = controleur.souscrire(e => {
    if (detruite) return;
    bouton.setAttribute('aria-pressed', String(e.voulu));
    bouton.disabled = e.etat === 'indisponible';
    bouton.textContent = e.etat === 'refuse' ? t('Réessayer de garder l’écran allumé') : t('Garder l’écran allumé');
    statut.textContent = e.etat === 'actif' ? t('Actif tant que le navigateur l’autorise.')
      : e.etat === 'demande' ? t('Demande en cours…')
        : e.etat === 'suspendu' ? t('Suspendu pendant que la page est masquée.')
          : ['refuse', 'indisponible'].includes(e.etat) ? t('Le navigateur ne maintient pas l’écran allumé. Tu peux continuer à cuisiner.') : '';
  });
  node.dispose = () => { detruite = true; arreter(); };
  return node;
}
