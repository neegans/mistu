import { t } from '../core/i18n.js';
import { normaliserLocaleSource } from '../domain/traductions-format.js';

export function creerControleurVoix({
  speechSynthesis: speech = globalThis.speechSynthesis,
  SpeechSynthesisUtterance: Utterance = globalThis.SpeechSynthesisUtterance,
  estCourante = () => true,
} = {}) {
  const abonnes = new Set();
  let detruit = false, numero = 0, statut = 'arretee', raison = null;
  const etat = () => ({ etat: statut, raison });
  const annoncer = (valeur, motif = null) => {
    statut = valeur; raison = motif;
    for (const fn of abonnes) { try { fn(etat()); } catch { /* La synthèse ne dépend pas de son observateur. */ } }
  };
  const courante = () => { try { return !detruit && estCourante(); } catch { return false; } };
  function arreter() { numero++; try { speech?.cancel(); } catch { /* API révocable. */ } annoncer('arretee'); }
  function lire({ texte, langReelle } = {}) {
    if (!courante()) return etat();
    arreter();
    if (!speech || !Utterance || typeof speech.speak !== 'function') { annoncer('refuse', 'indisponible'); return etat(); }
    const locale = normaliserLocaleSource(langReelle);
    if (!locale) { annoncer('refuse', 'langue_inconnue'); return etat(); }
    if (typeof texte !== 'string' || !texte.length) { annoncer('refuse', 'texte_absent'); return etat(); }
    const attendu = numero, valide = () => courante() && attendu === numero;
    try {
      const langue = locale.toLowerCase(), voix = speech.getVoices?.() || [];
      const voice = voix.find(v => v.lang?.toLowerCase() === langue)
        || voix.find(v => v.lang?.toLowerCase().split('-')[0] === langue.split('-')[0]);
      if (!voice) { annoncer('refuse', 'voix_absente'); return etat(); }
      const lecture = new Utterance(texte);
      lecture.lang = voice.lang; lecture.voice = voice;
      lecture.onstart = () => { if (valide()) annoncer('lecture'); };
      lecture.onend = () => { if (valide()) annoncer('arretee'); };
      lecture.onerror = () => { if (valide()) annoncer('refuse', 'lecture_refusee'); };
      annoncer('demande'); speech.speak(lecture);
    } catch { if (valide()) annoncer('refuse', 'lecture_refusee'); }
    return etat();
  }
  function detruire() { if (detruit) return; detruit = true; arreter(); abonnes.clear(); }
  return { lire, arreter, detruire, etat, souscrire(fn) { if (detruit) return () => {}; abonnes.add(fn); fn(etat()); return () => abonnes.delete(fn); } };
}

export function texteEtatVoix(etat) {
  if (etat?.etat === 'lecture') return t('Lecture en cours');
  if (etat?.raison === 'langue_inconnue') return t('Langue du texte inconnue : aucune voix choisie automatiquement.');
  if (etat?.raison === 'voix_absente') return t('Aucune voix disponible pour la langue de ce texte.');
  if (etat?.raison === 'indisponible') return t('La lecture vocale n’est pas disponible dans ce navigateur.');
  if (etat?.raison === 'lecture_refusee') return t('La lecture vocale n’a pas démarré. Réessaie.');
  return '';
}
