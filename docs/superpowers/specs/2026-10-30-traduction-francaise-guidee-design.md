# Obtenir une recette réellement traduite en français

Clarification de Neegan : « c’est écrit que la traduction n’est pas disponible. Je veux une version qui sera traduite ». Le résultat attendu est une traduction française durable du titre, des ingrédients et de la préparation disponibles, lisible dans la fiche après rechargement. Un message d’absence et un formulaire de champs ne suffisent pas.

## Parcours

L’action principale de la fiche devient « Créer la version française » lorsqu’elle manque, et ouvre le mode guidé `assistant=1` de l’éditeur existant. Les traductions existantes restent accessibles par Français. L’original est conservé et aucune version culinaire n’est dupliquée.

1. Préparation locale du plan et coût maximal réel affiché, sans appel à l’assistant. Le contenu source disponible est traduit ; aucune page manquante, quantité ou instruction n’est inventée.
2. Un bouton explicite « Traduire toute la recette » lance les portions confirmées avec le contrôleur existant. Chaque réponse est conservée avant de poursuivre.
3. Aperçu français en lecture et couverture réelle. Les champs manuels passent dans « Corriger la traduction ». Une réception seule n’écrase aucune correction personnelle.
4. Un geste « Enregistrer la version française » adopte les propositions affichées puis les publie avec les transactions existantes. L’adoption et la conservation intermédiaire de chaque journal précèdent la suivante pour ne perdre aucun résultat. L’écriture confirmée ouvre la fiche avec version, langue française et identifiant exact de traduction.

## Conservation et limites

Les nombres/sauts de ligne protégés et validations L6 restent intacts. Aucun résultat refusé, incomplet ou coupé ne devient une traduction complète. Les passages manquants sont explicités ; leur reprise demande un nouveau geste avec coût actualisé, limité aux manques. Les réponses déjà reçues sont retrouvées après rechargement avant de préparer un autre appel, afin de ne pas les payer à nouveau.

Conserver les gardes de source, compte, cycle, candidate et sortie ; récupérer/conserver à nouveau une réponse échouée n’effectue aucun nouvel appel. Plusieurs candidates, contenu ancien et source périmée gardent leurs comparaisons explicites. Réserve8 réponses/8Mio et maximum32 appels inchangés ; aucune libération automatique des réponses pour poursuivre.

## Vérification

Tests rouges avant code, puis vraie base jetable et fournisseur simulé : ouverture/coût sans POST, traduction complète et publication en un geste, deux portions sans perte/provenance, reprise de réponses après rechargement, refus de publication complète avec manques, réessai ciblé, conflits, quota/annulation/réponse tardive, original et quantités/minuteurs inchangés. Parcours navigateur jusqu’à la fiche française et rechargement hors ligne. Aucun compte privé ni appel payé pour les tests. Publication sous l’autorisation de la session, après réception.
