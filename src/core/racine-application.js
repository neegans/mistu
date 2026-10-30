// Le démarrage précède le métier ; sa ligne d'information traverse la porte d'entrée et la coquille.
export function remplacerRacineApplication(app,...contenu){
 const avis=[...app.children].find(n=>n.dataset.role==='demarrage-non-verifie');
 app.replaceChildren(...(avis?[avis]:[]),...contenu);
}
