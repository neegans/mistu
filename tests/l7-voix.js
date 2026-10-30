export async function runL7VoixTests({ eq, ok }) {
  const { creerControleurVoix } = await import('../src/ui/voix-cuisine.js');
  const lus = []; let arrets = 0, courante = true;
  const speech = { getVoices: () => [{ lang: 'fr-CA' }, { lang: 'en-CA' }], speak: u => lus.push(u), cancel: () => { arrets++; } };
  const c = creerControleurVoix({ speechSynthesis: speech, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } }, estCourante: () => courante });
  eq(lus.length, 0, 'L7 voix : aucun départ au montage');
  c.lire({ texte: 'Original exact\nDeuxième paragraphe', langReelle: 'en' });
  eq(lus[0].text, 'Original exact\nDeuxième paragraphe', 'L7 voix : texte projeté exact'); eq(lus[0].lang, 'en-CA', 'L7 voix : langue réelle, pas menus français'); eq(c.etat().etat, 'demande', 'L7 voix : pas de lecture annoncée avant onstart');
  lus[0].onstart(); eq(c.etat().etat, 'lecture', 'L7 voix : lecture après événement réel');
  c.arreter(); eq(c.etat().etat, 'arretee', 'L7 voix : arrêt explicite'); lus[0].onstart(); lus[0].onerror(); eq(c.etat().etat, 'arretee', 'L7 voix : événements tardifs ignorés après arrêt');
  c.lire({ texte: 'Sans langue', langReelle: null }); eq(lus.length, 1, 'L7 voix : aucune langue devinée'); eq(c.etat().raison, 'langue_inconnue', 'L7 voix : langue inconnue expliquée');
  c.lire({ texte: 'Deutsch', langReelle: 'de' }); eq(lus.length, 1, 'L7 voix : aucune voix arbitraire'); eq(c.etat().raison, 'voix_absente', 'L7 voix : voix absente expliquée');
  c.lire({ texte: 'Texte', langReelle: 'fr\n' }); eq(c.etat().raison, 'langue_inconnue', 'L7 voix : locale malformée refusée sans nettoyage');
  c.lire({ texte: 'Texte français', langReelle: 'fr' }); eq(lus[1].lang, 'fr-CA', 'L7 voix : voix française pour texte français');
  const ancien = lus[1]; c.lire({ texte: 'Other', langReelle: 'en' }); lus[2].onstart(); ancien.onend(); eq(c.etat().etat, 'lecture', 'L7 voix : fin de lecture précédente sans effet');
  c.detruire(); lus[2].onerror(); eq(c.etat().etat, 'arretee', 'L7 voix : dispose arrête sans erreur tardive'); c.lire({ texte: 'Après sortie', langReelle: 'fr' }); eq(lus.length, 3, 'L7 voix : aucun départ après sortie'); ok(arrets >= 3, 'L7 voix : synthèse réellement interrompue');
  const absent = creerControleurVoix({ speechSynthesis: null, SpeechSynthesisUtterance: null }); absent.lire({ texte: 'Texte', langReelle: 'fr' }); eq(absent.etat().raison, 'indisponible', 'L7 voix : API absente explicitée'); absent.detruire();
  const stale = creerControleurVoix({ speechSynthesis: speech, SpeechSynthesisUtterance: class {}, estCourante: () => courante }); courante = false; stale.lire({ texte: 'Ancien compte', langReelle: 'fr' }); eq(lus.length, 3, 'L7 voix : ancienne portée ne parle pas'); stale.detruire();
}
