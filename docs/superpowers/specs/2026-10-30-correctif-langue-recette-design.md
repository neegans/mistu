# Boutons de langue de la fiche — correctif du 30 octobre 2026

Signalement de Neegan : Français / Anglais semblent sans effet sur la fiche Trinity bread. Base publiée : 0.32.0-3. Les clics changent la projection, mais sans traduction le texte original reste affiché. L’explication et les accès à la traduction sont loin du sélecteur, dans Ingrédients ; l’onglet Préparation les masque sur mobile. Le choix local de langue disparaît aussi à la reconstruction de la fiche.

## Contrat du correctif

- Afficher l’état de lecture et les actions de traduction directement sous Original / Français / Anglais, avant la description. Distinguer original, langue déjà originale, traduction absente, partielle et plusieurs candidates. Conserver l’original, sans traduction inventée ni appel payant au simple changement de langue.
- Garder ce bloc visible quel que soit l’onglet Ingrédients / Préparation. Les traductions existantes continuent de changer titre, ingrédients et étapes ; aucune candidate concurrente choisie arbitrairement.
- Conserver langue et candidate explicites dans l’adresse par remplacement de l’entrée courante, sans remontage ni perte de focus. Préserver le contexte de retour et la version. Une actualisation ou un rechargement doit relire ce choix.
- Le lien vers l’assistant ouvre une préparation explicite : coût visible et confirmation avant appel. Avec assistant=1, cette préparation précède les longs champs manuels. Les commandes d’annulation, de réessai et de récupération ne doivent être actives que lorsqu’elles ont une action possible.

## Vérification et livraison

Tests de comportement rouges avant correction : fiche anglaise partielle sans traduction, état/action auprès des boutons, bascule de langue après remontage, choix concurrent. Tests de l’éditeur avec appels simulés. Contrôle réel Chrome à largeur ordinateur et mobile, onglet Préparation, navigation vers l’éditeur et rechargement. Aucun compte privé ni appel payé.

Correctif de la livraison 0.32.0 : suffixe neuf, manifeste généré après gel, suite navigateur et outils requis, publication GitHub Pages autorisée par les instructions de promotion/déploiement de la session. Aucune migration. Revue technique distincte d’une relecture personnelle de Neegan.
