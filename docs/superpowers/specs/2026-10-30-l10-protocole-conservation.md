# L10 — préparation du contrat C, conservation et diagnostic

30 octobre2026. **Contrat documentaire C relu techniquement, aucun code L10.** Base reçue14cc996, L9 public11262/11262, version0.31.0/DB6/archive7 ; cible0.32.0 selon spec/plan L10. Le GO commun L10 reste requis. A possède démarrage/livraison/worker ; B disponibilité du repas. Aucun changement SQL/archives.

## Fichiers C au GO

- `src/core/router.js` : point de demande explicite, adaptation booléenne historique intacte.
- `src/ui/sortie-editeur.js` : résultat structuré du même contrôleur/dialogue, distinction commit/abandon.
- `src/ui/state.js` : observation readonly bornée des protections de saisie déjà montées.
- `src/app.js` : racine/portée courantes, hôte de statut stable et retrait du register SW historique seulement après raccord du démarrage A.
- `src/ui/mise-a-jour.js` (neuf) : présentation sans activation ni reload, souscription/désabonnement de l’observation A, demandes de garde.
- `src/domain/diagnostic-app.js` (neuf) : projection fermée et texte copiable ; aucun IO, données métier ou exception brute dans sa sortie.
- `src/ui/settings.js` : collecte readonly au geste, panneau et copie avec repli sélectionnable ; aucune lecture arbitraire de CacheStorage.
- `tests/l10-conservation.js`, `tests/l10-mise-a-jour.js`, `tests/l10-diagnostic.js` (neufs) : rouges puis verts du périmètre C. Les vrais éditeurs et formulaires sont importés dans ces tests ; les anciens fichiers de tests ne deviennent pas la propriété C par défaut.

Root garde styles/i18n/versions/runner ; A garde index/démarrage/service/worker/générateur ; B garde repas/lecture exacte/hors ligne. Les harnais de deux livraisons et de réception restent dans le dossier ignoré. Aucun autre fichier produit n’est nécessaire à cette fermeture à ce stade.

## Ce qui est déjà exploitable

L4/L6 donnent à la racine `flushEditeur()` et `etatEditeur()`, plus une garde de sortie enregistrée au routeur. L6 inclut HTTP en cours et réponse brute après quota ; flush ne recommence pas le POST. L8 Repas/Courses refuse honnêtement une saisie seulement en mémoire. La garde précède dispose. L9 fournit dialogue nommé/repli et focus sûr. Ces contrôleurs doivent rester les autorités, sans seconde sauvegarde dans la bannière.

Le routeur interne retourne actuellement un accord booléen. Il ne peut pas distinguer à lui seul flush confirmé et « Quitter sans conserver ». Exposer une demande explicite structurée avant de raccorder l’UI ; ne pas convertir un booléen true historique en conservation réussie. Aucun appel navigate/refresh/reload pour demander ce contrôle.

## Fermeture minimale à intégrer avant code

**Dialogue de cuisson ouvert : la protection existante n’est pas une sauvegarde.** ui/cuisson et les formulaires stock/restes enregistrent `protegerSaisie(dlg)` dans ui/state.js. Ce registre empêche un refresh automatique ; il n’expose pas flush/état et ne fait pas partie des gardes du routeur. Une bannière regardant uniquement la racine de fiche pourrait manquer le dialogue et répondre « aucune saisie suivie ».

Fermeture validée par root le 30 octobre, raccord `ui/state.js` attribué à C pour L10 seulement : exposer une observation bornée des protections de saisie montées, en excluant uniquement la racine dont le contrat de conservation est effectivement consulté, par identité de nœud exacte. Si une autre saisie connue est montée (bilan, note, photo, formulaire de stock), le geste de conservation répond refus et demande de terminer ou annuler ce formulaire par ses commandes existantes. Ne pas cliquer Enregistrer pour lui, ne pas fermer le dialogue, ne pas faire croire que son texte/photos sont durables. Aucun nouveau champ ni registre persistant. Le registre purge déjà les nœuds détachés. Cette précision ferme le cas concret sans transformer tous les dialogues en nouveaux éditeurs. B, seul éditeur de la spec L10, en intègre le contrat et le témoin T4 ; aucun code pendant cette préparation.

## API C retenue

Deux intentions de présentation distinctes sur le point de garde partagé :

- **Conserver** : capturer la racine et la portée, appeler uniquement son flush, puis relire son état. Réponse `conserve` seulement si flush confirme et qu’aucune nouvelle saisie/HTTP n’est apparue ; sinon `refuse`. Absence de contrat et de protection connue donne `sans_saisie_suivie`, jamais « tout est sauvegardé ».
- **Revoir la sortie** : réutiliser le choix Rester/texte récupérable/Quitter sans conserver du contrôleur, sans URL, dispose ou reload. Un abandon explicite donne `quitter_sans_conserver` ; cette réponse ne devient pas `conserve` et ne ferme aucune autre fenêtre.

Le routeur garde son adaptation booléenne pour les navigations ordinaires. Sa nouvelle demande explicite consomme les mêmes contrôleurs avec résultat fermé, au lieu d’interpréter leur ancien booléen. Coalescer une demande identique en cours ; capturer racine/compte/base/époque/génération et invalider une réponse tardive. Si une autre vue est devenue courante, ne pas publier son ancien bilan dans la nouvelle.

Export retenu dans `core/router.js` : `demanderGardeExplicite({intention:'conserver'|'revoir_sortie',racine,estCourante})` → Promise de `{issue:'conserve'|'sans_saisie_suivie'|'refuse'|'quitter_sans_conserver',raison?}`. La racine est celle réellement montée et capturée par app ; `estCourante` ferme aussi la portée durable, pas seulement `isConnected`. Motifs fermés : `formulaire_ouvert`, `contrat_incomplet`, `contexte_change`, `saisie_locale`, `lecture_en_cours`, `a_conserver`, `conservation_echouee`, `rester`. Aucun message d’exception arbitraire dans ce résultat.

Raccord compatible : `enregistrerGardeSortie(garde,{racine,demanderExplicite}={})` conserve son désabonnement et le comportement des anciens appels à un argument. `protegerSortieEditeur` fournit ce raccord en interne pour son propre contrôleur ; la voie de navigation reste booléenne. La demande explicite ne transforme pas une ancienne garde opaque en accord de conservation. Contrat incomplet/ambigu : refus honnête. Le choix de sortie ne produit aucun effet métier par lui-même.

Le livre encapsule aujourd’hui l’éditeur dans une racine de page et délègue flush/état. Pour éviter une fausse protection étrangère sans exclure toute la page, le point commun peut retenir l’unique garde explicitement enregistrée pour cette racine ou un de ses descendants montés. Il consulte alors CE contrôleur et exclut seulement SON nœud exact du registre de protections. Plusieurs contrôleurs admissibles refusent `contrat_incomplet` ; une note/photo protégée à côté reste bloquante. Aucun rapprochement par texte, type de route ou simple inclusion de tous les descendants. Ce cas reçoit un témoin avec un livre encapsulé et une seconde protection ouverte.

Les protections sont relues après le flush et après un choix asynchrone. Nouveau formulaire, nouvelle saisie, vue ou portée changée empêchent le succès ancien. `sans_saisie_suivie` exige à la fois absence de contrat pertinent et absence de toute autre protection montée ; une méthode flush présente avec état inexploitable ne suffit jamais. `conserve` n’est pas un certificat persistant : une frappe ultérieure l’invalide, aucune donnée d’interface n’est enregistrée pour le maintenir au prochain chargement.

## Mise à jour et cycle d’interface

API A relue le 30 octobre dans contrat-a-livraison.md : `obtenirControleLivraison()` renvoie le singleton initialisé par bootstrap ou null ; `verifier()` rend une observation figée, `etat()` le dernier constat sans nouvelle vérification, `observer(fn)` un désabonnement, `estCourante(observation)` sa validité et `dispose()` son nettoyage. États admis : verifiee, incomplete, inconnue, incompatible, non_controlee. L’observation distingue execution, controleur, actif et attente. La disponibilité du worker en attente exige sa confirmation complète exacte ; attente complète ne désigne jamais la livraison exécutée. C ne détruit pas le singleton en quittant une route : il retire sa propre souscription ; le propriétaire du démarrage conserve la durée de vie du service.

C consomme le diagnostic A de la livraison exécutée, du worker contrôlant et de celui en attente. La bannière n’apparaît comme prête qu’après confirmation complète du waiting capturé ; timeout/absence de protocole restent inconnus. N’avoir qu’un hôte stable hors du contenu de route, avec dispose lors de reconstruction de coquille, et conserver les gardes avant toute action.

Le texte explique conservation puis fermeture/réouverture des fenêtres/PWA. Aucun bouton ne promet qu’un seul reload active B. `controllerchange`, updatefound et messages ne remplacent pas le DOM, ne ferment pas de fenêtre et ne font aucune écriture métier. C ne duplique pas le MessageChannel/versionnement d’A ; il souscrit à son observation et l’arrête proprement. Seul le démarrage A peut effectuer la reprise bornée avant montage, jamais cette bannière métier.

L’enregistrement actuel du SW dans boot doit être retiré ou délégué au démarrage A après coordination, afin de n’avoir qu’une autorité. Garder le comportement d’ouverture sans compte et les erreurs métier ; ne pas transformer les recours historiques d’archive/effacement en activation L10.

## Diagnostic copiable

Construire une projection fermée de compteurs et codes admis : versions/livraisons bornées, état réseau, compte décrit seulement comme présent/absent/inconnu, lignes à envoyer/bloquées, fichiers déclarés/locaux/manquants, tailles réellement connues et estimation de stockage nommée comme telle. Lecture impossible donne inconnu, pas zéro.

Ne copier ni les objets sync, ni logError brut (ses identifiants ne conviennent pas au diagnostic L10), ni erreurs arbitraires, hashes de médias, URLs, compte, JWT, recettes ou réponses assistant. Les codes d’erreur sont issus d’une liste fermée avec nombres agrégés. La collecte ne déclenche ni envoi, ni téléchargement, ni cache cleanup. Presse-papiers refusé : texte expurgé sélectionnable ; « copié » uniquement après écriture confirmée.

### Bilan repas fourni par B

API convenue avec B, documentaire seulement : export pur `diagnosticPreparationHorsLigne(observation)` ; le panneau le remet explicitement à C, sans bus ni persistance. Forme fermée :

```js
{
  format: 1,
  etat: 'pret' | 'partiel' | 'perime' | 'inconnu',
  observe_le: string | null,
  recettes: { total, disponibles, indisponibles, inconnues },
  medias: { selectionnes, exclus, utilisables, manquants, illisibles, inconnus },
  octets_connus: number | null
}
```

Compteurs et octets sont des entiers sûrs non négatifs ; horodatage UTC borné valide ou null. Les sommes sont cohérentes avec les totaux concernés. C revalide cette forme avant inclusion ; pas de panneau ou de bilan actuel donne null, aucun retour depuis le stockage au prochain chargement. Aucun ID, SHA, titre, texte, chemin, URL ou query. `octets_connus` ne signifie pas que tous les octets exclus ou encore inconnus ont été mesurés.

## Petites preuves causales prévues

1. Vrai L6 : réponse seulement en mémoire, puis Conserver ; quota garde les octets et ne relance pas le fournisseur. HTTP en vol refuse. Nouvelle frappe pendant flush empêche le succès ancien.
2. L8 ligne libre/date non enregistrée, puis commande ; aucun clic métier, saisie/focus intacts. Bilan de cuisson ouvert avec note/photos : refus explicite, aucun faux « sans saisie suivie ».
3. Rester/Échap/abandon explicite en modal et repli, forme structurée distincte du succès durable. Aucune URL/histoire/dispose/reload. Compte ou racine changé pendant attente invalide le bilan.
4. Deux onglets A et B waiting : bannière informative, aucun accord inter-onglets implicite. Consommation du vrai protocole A, mauvais worker/réponse tardive ignorés.
5. Diagnostic rempli de secrets/textes/URLs dans la fixture : aucun ne sort de la projection ; seuls les champs admis restent. Échec partiel de lecture et presse-papiers refusé honnêtes.

Réception future sur deux livraisons locales réellement servies avec A, puis parcours public de la livraison effectivement déployée. Aucun succès L10 anticipé dans cette note.

## Avis indépendant sur le contrat A

Favorable, aucun blocage concret relevé à cette lecture. La correspondance request_id ne remplace pas l’identité Worker/registration/portée capturée ; changement de cycle invalide la preuve avant notification. Les ports/timers sont fermés sur toutes les fins et le manque de réponse reste inconnu. Le statut complet procède d’une lecture du cache concerné et pas du nom du cache/état activated. Le nettoyage utilise seulement l’ancien cache actif démontré de la même portée ; les caches inconnus ou en attente restent préservés.

Le document ferme aussi la frontière de C : mode de repli en ligne non certifiable rétroactivement, reprise automatique bornée uniquement avant métier, aucun geste de mise à jour ne sauvegarde ou abandonne une saisie, ni ne recharge/démonte le contenu. Le marqueur de reprise ne contient pas d’URL. Les preuves à exécuter portent sur les fichiers réellement exécutés et la transition historique séparée, pas seulement les noms de versions. Cet avis documentaire ne constitue pas encore une preuve d’implémentation ou de navigateur L10.

Couture B relue : contrat de protection après flush et DTO fermé acceptés. Sans panneau actuel, le diagnostic de préparation vaut null (notamment après navigation vers Réglages), aucune mémoire globale ou persistance créée pour récupérer un ancien prêt. La préparation est indépendante de l’autorisation de cuisine et ne modifie pas les choix durables de séance.
