// Les avis de démarrage et de version traversent la porte d'entrée, la coquille et l'erreur fatale.
export function remplacerRacineApplication(app,...contenu){
 const avis=[...app.children].filter(n=>['demarrage-non-verifie','bandeau-version'].includes(n.dataset.role));
 app.replaceChildren(...avis,...contenu);
}
