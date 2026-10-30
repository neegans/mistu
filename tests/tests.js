import {runAuditCommandesProtegeesTests} from './audit-commandes-protegees.js';
import {runAuditFichesCycleTests} from './audit-fiches-cycle.js';
import {runAuditVersionBaseTests} from './audit-version-base.js';
import {runAuditArchiveRetraitTests} from './audit-archive-retrait.js';
import {runAuditArchiveFichesInvalidesTests} from './audit-archive-fiches-invalides.js';
import {runAuditArchiveExclusionsUITests} from './audit-archive-exclusions-ui.js';
import {runAuditLivraisonEchecTests} from './audit-livraison-echec.js';
import {runAuditStockagePersistantTests} from './audit-stockage-persistant.js';
import {runAuditDiagnosticStockageTests} from './l10-diagnostic.js';
import {runAuditCycleConflitsTests} from './audit-cycle-conflits.js';
import {runAuditPurgeImportsTests} from './audit-purge-imports.js';
import {runAuditConflitsTests} from './audit-conflits.js';
import {runL10DiagnosticActualisationTests} from './l10-diagnostic.js';
import {runL10HorsLigneActualisationTests} from './l10-hors-ligne.js';
import {runL10ConservationTests} from './l10-conservation.js';
import {runL10ReponseBruteTests} from './l10-conservation.js';
import {runL10GardesMetierTests} from './l10-conservation.js';
import {runL10ConservationConcurrenceTests} from './l10-conservation.js';
import {runL10DemarrageTests} from './l10-demarrage.js';
import {runL10DiagnosticTests} from './l10-diagnostic.js';
import {runL10DiagnosticCollecteTests} from './l10-diagnostic.js';
import {runL10HorsLigneMediasTests} from './l10-hors-ligne-medias.js';
import {runL10HorsLigneCoursesTests} from './l10-hors-ligne-medias.js';
import {runL10HorsLigneCycleTests} from './l10-hors-ligne-medias.js';
import {runL10HorsLigneEchecsTests} from './l10-hors-ligne-medias.js';
import {runL10HorsLigneTests} from './l10-hors-ligne.js';
import {runL10LiensExactsTests} from './l10-hors-ligne.js';
import {runL10HorsLigneEcranTests} from './l10-hors-ligne.js';
import {runL10HorsLigneFermetureTests} from './l10-hors-ligne.js';
import {runL10HorsLigneCandidatesTests} from './l10-hors-ligne.js';
import {runL10LivraisonTests} from './l10-livraison.js';
import {runL10MiseAJourTests} from './l10-mise-a-jour.js';
import {runL10ReessaiFichierTests} from './l10-reessai-fichier.js';
import {runL9CadreTests} from './l9-navigation.js';
import {runL9DialoguesTests} from './l9-dialogues.js';
import {runL9DialoguesRepliTests} from './l9-dialogues.js';
import {runL9DialoguesMetierTests} from './l9-dialogues.js';
import {runL9DialoguesCycleTests} from './l9-dialogues.js';
import {runL9DialoguesMetierRepliTests} from './l9-dialogues.js';
import {runL9LisibiliteTests} from './l9-lisibilite.js';
import {runL9NavigationTests} from './l9-navigation.js';
import {runL9CoquilleTests} from './l9-navigation.js';
import {runL9BarreTests} from './l9-navigation.js';
import {runL9SelecteursTests} from './l9-selecteurs.js';
import {runL9ContraintesRepasTests} from './l9-selecteurs.js';
import {runL9RaccordsSelecteursTests} from './l9-selecteurs.js';
import {runL8InventaireComparaisonRejeuTests} from './l8-inventaire-comparaison.js';
import {runL8InventaireReglagesTests} from './l8-inventaire-reglages.js';
import {runL8SyncAdoptionTests} from './l8-sync.js';
import {runL8SyncBornesTests} from './l8-sync.js';
import {runL8InventaireRejeuTransactionsTests} from './l8-inventaire-transactions.js';
import {runL8CoursesGestesTests} from './l8-repas-courses.js';
import {runL8SyncConflitsTests} from './l8-sync.js';
import {runL8InventaireTransactionsTests} from './l8-inventaire-transactions.js';
import {runL8CoursesAttenteTests} from './l8-repas-courses.js';
import {runL8RepasBornesTests} from './l8-repas-courses.js';
import {runL8SyncTests} from './l8-sync.js';
import {runL8SyncReceptionTests} from './l8-sync.js';
import {runL8SyncAccuseTests} from './l8-sync.js';
import {runL8SyncSourcesTests} from './l8-sync.js';
import {runL8InventaireCopiesTests} from './l8-inventaire-comparaison.js';
import {runL8ArchivesTests} from './l8-archives.js';
import {runL8InventaireAccueilTests} from './l8-inventaire-accueil.js';
import {runL8InventaireComparaisonTests} from './l8-inventaire-comparaison.js';
import {runL8InventaireDepotEcranTests} from './l8-inventaire-depot-ecran.js';
import {runL8InventaireMemoireTests} from './l8-inventaire-persistance.js';
import {runL8RepasConcurrenceTests} from './l8-repas-courses.js';
import {runL8CoursesComparaisonTests} from './l8-repas-courses.js';
import {runL8InventaireArchiveTests} from './l8-inventaire-archive.js';
import {runL8InventaireEcranTests} from './l8-inventaire-ecran.js';
import {runL8InventaireFormatTests} from './l8-inventaire-format.js';
import {runL8InventaireMutationsTests} from './l8-inventaire-mutations.js';
import {runL8InventairePersistanceTests} from './l8-inventaire-persistance.js';
import {runL8InventaireLegacyTests} from './l8-inventaire-persistance.js';
import {runL8InventaireProjectionTests} from './l8-inventaire-projection.js';
import {runL8CoursesQuantitesTests} from './l8-repas-courses.js';
import {runL8RepasModeleTests} from './l8-repas-courses.js';
import {runL8RepasEcranTests} from './l8-repas-courses.js';
import {runL8CoursesEcranTests} from './l8-repas-courses.js';
import {runL8EnviesTests} from './l8-repas-courses.js';
import {runL8RestesTests} from './l8-restes.js';
import {runL7CuisineVolumesTests} from './l7-cuisine-volumes.js';
import {runL7SyncFinTests} from './l7-sync.js';
import {runL7ArchivesTests} from './l7-archives.js';
import {runL7ComparaisonCuisineEcranTests} from './l7-comparaison-cuisine-ecran.js';
import {runL7ComparaisonCuisineTests} from './l7-comparaison-cuisine.js';
import {runL7CuisineProjectionTests} from './l7-cuisine-persistance.js';
import {runL7CuisineFinTests} from './l7-cuisine-persistance.js';
import {runL7CuisineHistoriqueCASTests} from './l7-cuisine-persistance.js';
import {runL7CuisineSourcesTests} from './l7-cuisine-persistance.js';
import {runL7CuisineSnapshotTests} from './l7-cuisine-persistance.js';
import {runL7CuisinePorteeTests} from './l7-cuisine-persistance.js';
import {runL7CuisineAncienPutTests} from './l7-cuisine-persistance.js';
import {runL7SyncTests} from './l7-sync.js';
import {runL7SyncCouvertureTests} from './l7-sync.js';
import {runL7SyncReceptionTests} from './l7-sync.js';
import {runL7SyncAccuseTests} from './l7-sync.js';
import {runL7CuisineArchiveTests} from './l7-cuisine-archive.js';
import {runL7CuisineDepartTests} from './l7-cuisine-depart.js';
import {runL7CuisineEcranTests} from './l7-cuisine-ecran.js';
import {runL7CuisineFormatTests} from './l7-cuisine-format.js';
import {runL7CuisinePersistanceTests} from './l7-cuisine-persistance.js';
import {runL7CuisineConcurrenceTests} from './l7-cuisine-persistance.js';
import {runL7CuissonFinTests} from './l7-cuisson-fin.js';
import {runL7EcranAllumeTests} from './l7-ecran-allume.js';
import {runL7MinuteursCommandesTests} from './l7-minuteurs-commandes.js';
import {runL7MinuteursDepotEcranTests} from './l7-minuteurs-depot-ecran.js';
import {runL7MinuteursEcranTests} from './l7-minuteurs-ecran.js';
import {runL7VoixTests} from './l7-voix.js';
import {runL7ObservationsBaseTests} from './l7-observations-base.js';
import { runL6DepotGardesTests } from './l6-depot-gardes.js';
import { runL6ReglagesSynchronisationTests } from './l6-reglages-synchronisation.js';
import { runL6ArchivesTests } from './l6-archives.js';
import { runL6TransfertsTraductionTests } from './l6-archives.js';
import { runL6ArchivesJournauxTests } from './l6-archives.js';
import { runL6BrouillonsAjouterTests } from './l6-brouillons-liste.js';
import { runL6ComplementsGroupesTests } from './l6-complements-groupes.js';
import { runL6ConsommateursTests } from './l6-consommateurs.js';
import { runL6CuisineLangueTests } from './l6-cuisine-langue.js';
import { runL6DepotTraductionsTests } from './l6-depot-traductions.js';
import { runL6JournalTraductionsTests } from './l6-journal-traductions.js';
import { runL6SyncTraductionsTests } from './l6-sync-traductions.js';
import { runL6TraductionParcoursTests } from './l6-traduction-parcours.js';
import { runL6TraductionsTransactionsTests } from './l6-traductions-transactions.js';
import { runL6VersionsRepoTests } from './l6-versions-repo.js';
import { runL6VersionsStructureesTests } from './l6-versions-structurees.js';
import { runL6TraductionRepriseTests } from './l6-traduction-reprise.js';
import { runL6EditeurTraductionTests } from './l6-editeur-traduction.js';
import { runL6TraductionVolTests } from './l6-traduction-vol.js';
import { runL6BrouillonsListeTests } from './l6-brouillons-liste.js';
import { runL6CommandesTraductionTests } from './l6-commandes-traduction.js';
import { runL6LectureExportsTests } from './l6-lecture-exports.js';
import { runL6LectureEcransTests } from './l6-lecture-ecrans.js';
import { runCorrectifLangueRecetteTests } from './correctif-langue-recette.js';
import { runTraductionGuideeTests } from './traduction-guidee.js';
import { runL6LectureRecetteTests } from './l6-lecture-recette.js';
import { runL6PasserelleBrutTests } from './l6-passerelle-brut.js';
import { runL6StructureIngredientsTests } from './l6-structure-ingredients.js';
import { runL6TraductionsFormatTests } from './l6-traductions-format.js';
import { runL6ExtractionGroupesTests } from './l6-extraction-groupes.js';
import { runL6TraductionProviderTests } from './l6-traduction-provider.js';
import { runL6TraductionPortionsTests } from './l6-traduction-portions.js';
import { runL6EditeurGroupesTests } from './l6-editeur-groupes.js';
import { runL5ComplementsRecetteTests } from './l5-complements-recette.js';
import { runL5ComplementsRecetteUiTests } from './l5-complements-recette-ui.js';
import { runL5JournalSnapshotTests } from './l5-journal-snapshot.js';
import { runL5PremiereLiaisonTests } from './l5-premiere-liaison.js';
import { runL5ComparaisonSourcesUiTests } from './l5-comparaison-sources-ui.js';
import { runL5ComparaisonSourcesTests } from './l5-comparaison-sources.js';
import { runL5TransfertsSourceTests } from './l5-transferts-source.js';
import { runL5SyncSourcesTests } from './l5-sync-sources.js';
import { runL5RevisionsSourceTests } from './l5-revisions-source.js';
import { runL5ReceptionSourcesTests } from './l5-reception-sources.js';
import { runL5ImportSourcesTests } from './l5-import-sources.js';
import { runL5IndexVolTests } from './l5-index-vol.js';
import { runL5IndexTransactionTests } from './l5-index-transaction.js';
import { runL5IndexStockageTests } from './l5-index-stockage.js';
import { runL5IndexApplicationTests } from './l5-index-application.js';
import { runL5ArchivesTests } from './l5-archives.js';
import { runL1CorbeilleDomaineTests } from './l1-corbeille-domaine.js';
import { runL1CorbeilleArchiveTests } from './l1-corbeille-archive.js';
import { runL1CorbeilleSyncTests } from './l1-corbeille-sync.js';
import { runL1CorbeilleUiTests } from './l1-corbeille-ui.js';
import { runL1CorbeilleMutationsTests } from './l1-corbeille-mutations.js';
import { runL2CorbeilleDomaineTests } from './l2-corbeille-domaine.js';
import { runL2CorbeilleArchiveTests } from './l2-corbeille-archive.js';
import { runL2CorbeilleSyncTests } from './l2-corbeille-sync.js';
import { runL2CorbeilleUiTests } from './l2-corbeille-ui.js';
import { runL2CorbeilleMutationsTests } from './l2-corbeille-mutations.js';
import { runL2ContextesImportTests } from './l2-contextes-import.js';
import { runL2LivreMutationsTests } from './l2-livre-mutations.js';
import { runL2CorbeilleImportsTests } from './l2-corbeille-imports.js';
import { runL2SyncRepriseTests } from './l2-sync-reprise.js';
import { runL2SourcesSyncTests } from './l2-sources-sync.js';
import { runL2SourcesProvenanceTests } from './l2-sources-provenance.js';
import { runL3NavigationTests } from './l3-navigation.js';
import { runL3BibliothequeTests } from './l3-bibliotheque.js';
import { runL3ListesTests } from './l3-listes.js';
import { runL3ActionsTests } from './l3-actions.js';
import { runL4BrouillonsListeTests } from './l4-brouillons-liste.js';
import { runL4RendementTests } from './l4-rendement.js';
import { runL4RaccordsTests } from './l4-raccords.js';
import { runL5RaccordsTests, runL5SourcesLecteursTests } from './l5-raccords.js';
import { runL5IndexLectureTests } from './l5-index-lecture.js';
import { runL5SourcesFormatTests } from './l5-sources-format.js';
import { runL4BrouillonsTests } from './l4-brouillons.js';
import { runL4PublicationTests } from './l4-publication.js';
import { runL4EditeurRecetteTests, runL4EditeurRecetteUITests, runL4LectureEditeurTests } from './l4-editeur-recette.js';
import { runL4LivreEditeurTests } from './l4-livre-editeur.js';
import { runL4SortiesTests } from './l4-sorties.js';
import { runL4JournalTests } from './l4-journal.js';
import { runL4LimitesArchivesTests } from './l4-limites-archives.js';
import { runL4BrouillonsSyncTests } from './l4-sync.js';
import { runL0TraductionsTests } from './l0-traductions.js';
import { runL0CuisineTests } from './l0-cuisine.js';
import { runL0RepasCoursesTests } from './l0-repas-courses.js';
import { runL0IntegrationTests } from './l0-integration.js';
import { runVisuelReperesTests } from './visuel-reperes.js';
import { runVisuelPhotosTests } from './visuel-photos.js';
import { runVisuelParcoursTests } from './visuel-parcours.js';
import { runVisuelReperesEcranTests } from './visuel-reperes-ecran.js';
import { runVisuelIntegrationTests } from './visuel-integration.js';
// Tests du domaine, exécutables dans le navigateur (tests/index.html). Aucun outil externe requis.
import { parseQuantity, scaleQuantity, formatQuantity, extractLeadingQuantity } from '../src/domain/quantity.js';
import { matchUnit, convertValue, displayQuantity, normalizeText } from '../src/domain/units.js';
import { parseIngredientLine, buildIngredientIndex, detectTimers, parseStepsBlock } from '../src/domain/lines.js';
import { INGREDIENTS } from '../src/model/seed.js';
import { scaleVersion } from '../src/domain/scaling.js';
import { assessVersion } from '../src/domain/diet.js';
import { buildShoppingList } from '../src/domain/grocery.js';
import { parseQuery, buildLabelIndex, buildDocs, searchDocs } from '../src/domain/search.js';
import { createZip, readZip, textOf, crc32 } from '../src/core/zip.js';
import { sha256Hex } from '../src/core/hash.js';
import { checkRelations } from '../src/domain/backup.js';
import { pickSuggestion } from '../src/domain/rediscover.js';
import { shortcutUrl, siriPhrase } from '../src/domain/timers.js';
import { toPaprikaYaml, toJsonLd } from '../src/domain/exporters.js';
import { parseIndexLines } from '../src/ui/import.js';
import { summarizeMeal } from '../src/domain/pairing.js';
import { compareBundles, proposeDishesForRecipe } from '../src/domain/dishes.js';
import { runBackupTests } from './backup.js';
import { runSyncTests } from './sync.js';
import { runSyncL3Tests } from './sync-l3.js';
import { runAjouterTests } from './ajouter.js';
import { runRechercheWebTests } from './recherche-web.js';
import { runAssistantCompteTests } from './assistant-compte.js';
import { runCreerIaTests } from './creer-ia.js';
import { runPasserelleTests } from './passerelle.js';
import { runImportCibleTests } from './import-cible.js';
import { runCouvertureTests } from './couverture.js';
import { runLectureWebTests } from './lecture-web.js';
import { runSyncL4Tests } from './sync-l4.js';
import { runTableMatieresTests } from './table-matieres.js';
import { runIndexLivreTests } from './index-livre.js';
import { runIndexLivreEcranTests } from './index-livre-ecran.js';
import { runClassementTests } from './classement.js';
import { runThemeTests } from './theme.js';
import { runPhotoPlatTests } from './photo-plat.js';
import { runApercuWebTests } from './apercu-web.js';
import { runCarnetTests } from './carnet.js';
import { runI2LivreTests } from './i2-livre.js';
import { runI2CuisineTests } from './i2-cuisine.js';
import { runI2PhotoPageTests } from './i2-photo-page.js';
import { runI2IntegrationTests } from './i2-integration.js';
import { runI3ThermomixTests } from './i3-thermomix.js';
import { runCorrectifsThermomixSecuriteTests } from './correctifs-thermomix-securite.js';
import { runCorrectifsReponsesJsonTests } from './correctifs-reponses-json.js';
import { runCorrectifsReperesTests } from './correctifs-reperes.js';
import { runCorrectifsBrouillonsTests } from './correctifs-brouillons.js';
import { runCorrectifsAdaptationTests } from './correctifs-adaptation.js';
import { runCorrectifsImportsSyncTests } from './correctifs-imports-sync.js';
import { runI3ParcoursTests } from './i3-parcours.js';
import { runI3EcranTests } from './i3-ecran.js';
import { runI3IntegrationTests } from './i3-integration.js';

const results = [];
const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); results.push({ ok, msg, got: a, want: b }); };
const ok = (v, msg) => results.push({ ok: !!v, msg, got: v });
const close = (a, b, msg, eps = 0.01) => results.push({ ok: Math.abs(a - b) < eps, msg, got: a, want: b });

buildIngredientIndex(INGREDIENTS);
buildLabelIndex(INGREDIENTS);
const ingById = new Map(INGREDIENTS.map((i) => [i.id, i]));

// --- Quantités
eq(parseQuantity('1½').value, 1.5, '1½ → 1,5');
eq(parseQuantity('1½').fraction, { whole: 1, num: 1, den: 2 }, 'fraction conservée');
eq(parseQuantity('1,5').value, 1.5, '1,5 → 1,5');
eq(parseQuantity('1 1/2').value, 1.5, '1 1/2 → 1,5');
eq([parseQuantity('2–3').min, parseQuantity('2–3').max], [2, 3], 'plage 2–3');
ok(parseQuantity('au goût').qualitative, 'au goût qualitatif');
eq(formatQuantity(scaleQuantity(parseQuantity('½'), 3)), '1½', '½ × 3 = 1½ à l’affichage');
eq(formatQuantity(parseQuantity('2–3')), '2–3', 'plage affichée');
eq(extractLeadingQuantity('2 oranges').rest, 'oranges', '« or » n’est pas pris pour une plage');

// --- Unités et conventions
eq(matchUnit('c. à soupe d’huile').unit_id, 'tbsp', 'c. à soupe → tbsp');
eq(matchUnit('tasses de farine').unit_id, 'cup', 'tasses → cup');
eq(matchUnit('oz de fromage').candidates, ['oz_mass', 'fl_oz'], 'oz ambigu conservé');
eq(matchUnit('fl oz de lait').unit_id, 'fl_oz', 'fl oz → once liquide');
eq(matchUnit('carottes').unit_id, null, 'carottes n’est pas une unité (c)');
eq(convertValue(1, 'cup', 'ml', {}).reason, 'convention_required', 'tasse sans convention : suspendue');
close(convertValue(1, 'cup', 'ml', { convention_id: 'us_customary' }).value, 236.588, 'tasse US → ml');
close(convertValue(1, 'cup', 'ml', { convention_id: 'metric_ca' }).value, 250, 'tasse métrique CA → ml');
close(convertValue(350, 'fahrenheit', 'celsius').value, 176.67, '350 °F → °C');
eq(convertValue(1, 'cup', 'g', { convention_id: 'metric_ca', ingredient: ingById.get('ing_ap_flour') }).reason, 'equivalence_required', 'volume→masse sans équivalence : refusée');
const flour = { ...ingById.get('ing_ap_flour'), equivalences: [{ volume_unit_id: 'cup', volume_value: 1, mass_g: 125, source: 'table du livre', convention_id: 'us_customary' }] };
const conv = convertValue(2, 'cup', 'g', { convention_id: 'us_customary', ingredient: flour });
close(conv.value, 250, '2 tasses de farine → 250 g via équivalence documentée'); ok(conv.estimate && conv.assumptions.length, 'estimation avec hypothèse visible');
eq(convertValue(2, 'clove', 'g').reason, 'not_convertible', 'gousse non convertible');
eq(displayQuantity({ value: 1, raw: '1' }, 'cup', { system: 'metric' }).blocked, 'convention_required', 'affichage métrique bloqué sans convention');
eq(displayQuantity({ value: 250, raw: '250' }, 'g', { system: 'original' }).text, '250 g', 'original inchangé');
ok(displayQuantity({ value: 250, raw: '250' }, 'g', { system: 'us' }).text.includes('oz'), 'g → oz en système US');

// --- Lignes d'ingrédients FR/EN → même identité
const l1 = parseIngredientLine('2 c. à soupe d’huile d’olive');
eq([l1.quantity.value, l1.unit_id, l1.ingredient_id], [2, 'tbsp', 'ing_olive_oil'], 'ligne FR analysée');
const l2 = parseIngredientLine('2 tbsp olive oil');
eq(l2.ingredient_id, 'ing_olive_oil', 'ligne EN → même identité');
eq(parseIngredientLine('1 boîte (400 g) de tomates italiennes').unit_id, 'can', 'boîte → can, parenthèse conservée');
eq(parseIngredientLine('1 boîte (400 g) de tomates italiennes').preparation, '400 g', 'précision entre parenthèses');
eq(parseIngredientLine('coriandre fraîche, hachée').ingredient_id, 'ing_coriander_leaves', 'coriandre fraîche → feuilles');
eq(parseIngredientLine('1 c. à thé de graines de coriandre').ingredient_id, 'ing_coriander_seeds', 'graines de coriandre → identité distincte');
eq(parseIngredientLine('1 bulbe de fenouil').ingredient_id, 'ing_fennel_bulb', 'fenouil → bulbe (pas les graines)');
eq(parseIngredientLine('sel, au goût').quantity.qualitative, true, 'sel au goût');
eq(parseIngredientLine('Persil (facultatif)').optional, true, 'facultatif détecté');
eq(parseIngredientLine('1 tasse de mystère').ingredient_id, null, 'inconnu reste non identifié');
eq(parseIngredientLine('4 oz de parmesan').unit_candidates, ['oz_mass', 'fl_oz'], 'oz ambigu sur la ligne');
eq(detectTimers('Cuire 8 minutes puis laisser reposer 1 h 30').timers.map((t) => t.seconds), [480, 5400], 'durées détectées');
eq(parseStepsBlock('1. Chauffer\n2. Cuire 10 min').length, 2, 'étapes numérotées');

// --- Portions
const version = { id: 'v1', recipe_id: 'r1', kind: 'extraction', servings: 4, prep_minutes: 10, cook_minutes: 20, ingredients: [parseIngredientLine('400 g de spaghetti'), parseIngredientLine('2 gousses d’ail'), parseIngredientLine('sel, au goût')], steps: parseStepsBlock('Cuire 10 min à 200 °C') };
const scaled = scaleVersion(version, 8);
eq(scaled.ingredients[0].quantity.value, 800, 'portions doublées → 800 g');
ok(scaled.notes.some((n) => n.includes('Durées')), 'les durées ne sont pas multipliées');
eq(scaleVersion({ ...version, servings: null }, 8).ok, false, 'portions inconnues : pas de recalcul');

// --- Régimes
eq(assessVersion(version, ingById, 'sans_gluten').state, 'incompatible', 'spaghetti → incompatible sans gluten');
// N-8 (T5) : « compatible » se mesure sur des lignes VÉRIFIÉES — une identité proposée par le parseur ne certifie rien. Les lignes de `version`
// restent non vérifiées pour les gardes anti-régression : le spaghetti bloque encore (ci-dessus), le parmesan facultatif reste une adaptation,
// un inconnu reste à vérifier (ci-dessous). `V` pose l'état « vérifié » sur une copie de la version.
const V = (v) => ({ ...v, ingredients: v.ingredients.map((l) => ({ ...l, verification_state: 'verified' })) });
eq(assessVersion(V(version), ingById, 'vegetarien').state, 'compatible', 'végétarien compatible (lignes vérifiées)');
eq(assessVersion(version, ingById, 'vegetarien').state, 'to_verify', 'N-8 : les mêmes lignes NON vérifiées → à vérifier, jamais compatible');
const vUnknown = { ...version, ingredients: [parseIngredientLine('1 tasse de mystère')] };
eq(assessVersion(vUnknown, ingById, 'sans_gluten').state, 'to_verify', 'inconnu → à vérifier, jamais compatible par défaut');
const vOpt = { ...version, ingredients: [parseIngredientLine('parmesan (facultatif)')] };
eq(assessVersion(vOpt, ingById, 'vegetalien').state, 'adaptation', 'ingrédient facultatif bloquant → adaptation');

// --- Courses
const v2 = { id: 'v2', recipe_id: 'r2', servings: 2, ingredients: [parseIngredientLine('200 g de spaghetti'), parseIngredientLine('1 gousse d’ail'), parseIngredientLine('250 ml de bouillon de poulet'), parseIngredientLine('250 ml d’eau')] };
const list = buildShoppingList([{ version: V(version), servings: 4, title: 'A' }, { version: V(v2), servings: 2, title: 'B' }], ingById);
const pasta = list.find((g) => g.ingredient_id === 'ing_wheat_pasta');
eq(pasta.totals[0].text, '600 g', 'spaghetti consolidés 400 + 200');
eq(list.find((g) => g.ingredient_id === 'ing_garlic').totals[0].text, '3 gousse', 'gousses additionnées (même unité)');
ok(list.some((g) => g.ingredient_id === 'ing_chicken_stock') && list.some((g) => g.ingredient_id === 'ing_water'), 'bouillon et eau distincts');
// N-9 (T5) : les mêmes lignes NON vérifiées se regroupent par leur texte (jamais par l'identité proposée) et additionnent encore les quantités.
const listeNV = buildShoppingList([{ version, servings: 4, title: 'A' }, { version: v2, servings: 2, title: 'B' }], ingById);
eq(listeNV.map((g) => [g.key, g.ingredient_id, g.label, g.totals.map((x) => x.text)]).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  [['name:ail', null, 'ail', ['3 gousse']], ['name:bouillon de poulet', null, 'bouillon de poulet', ['250 ml']], ['name:eau', null, 'eau', ['250 ml']], ['name:sel', null, 'sel', []], ['name:spaghetti', null, 'spaghetti', ['600 g']]],
  'N-9 : lignes non vérifiées → groupes par texte, ingredient_id null, quantités additionnées');

// --- Recherche
const q = parseQuery('une salade avec du concombre, sans gluten, en 15 minutes');
eq([q.filters.type, q.filters.diets, q.filters.include, q.filters.max_total_minutes], ['salade', ['sans_gluten'], ['ing_cucumber'], 15], 'langage naturel → filtres');
eq(parseQuery('poulet sans coriandre').filters.exclude, ['ing_coriander_leaves'], 'exclusion d’ingrédient');
const recipes = [
  { id: 'r1', edition_id: 'e1', original_title: 'Pâtes puttanesca', availability: 'available', type: 'plat_principal', current_version_id: 'v1' },
  { id: 'r3', edition_id: 'e1', original_title: 'Salade de concombre', availability: 'available', type: 'salade', current_version_id: 'v3' },
  { id: 'r4', edition_id: 'e1', original_title: 'Cucumber salad', availability: 'reference_only', type: null, printed_page: 58 },
];
const v3 = { id: 'v3', recipe_id: 'r3', kind: 'extraction', servings: 2, total_minutes: 10, ingredients: [parseIngredientLine('1 cucumber'), parseIngredientLine('2 tbsp olive oil')], steps: [] };
const docs = buildDocs({ recipes, versions: [version, v3], editions: [{ id: 'e1', book_id: 'b1' }], books: [{ id: 'b1', title: 'Livre', author: 'A' }], dishes: [], links: [] });
const res = searchDocs(docs, parseQuery('salade de concombre'), { mode: 'all', ingredientsById: ingById });
eq(res.admissible.map((h) => h.doc.recipe.id), ['r3'], 'FR « concombre » retrouve la recette EN « cucumber »');
eq(res.references.map((h) => h.doc.recipe.id), ['r4'], 'référence d’index signalée à part');
const resGf = searchDocs(docs, parseQuery('plat principal sans gluten'), { mode: 'all', ingredientsById: ingById });
eq([resGf.admissible.length, resGf.incompatible], [0, 1], 'restriction jamais assouplie : puttanesca écartée');
eq(searchDocs(docs, parseQuery('salade'), { mode: 'web' }).admissible.length, 0, 'mode Web sans source : aucun résultat inventé');

// --- ZIP et empreintes
const zip = createZip([{ path: 'a/é.txt', data: 'héllo' }, { path: 'b.bin', data: new Uint8Array([1, 2, 3]) }]);
const back = readZip(zip);
eq(textOf(back.get('a/é.txt')), 'héllo', 'ZIP aller-retour UTF-8');
eq([...back.get('b.bin').data], [1, 2, 3], 'ZIP binaire'); ok(back.get('b.bin').crcOk, 'CRC valide');
eq(crc32(new TextEncoder().encode('123456789')).toString(16), 'cbf43926', 'CRC-32 vecteur de test');
const hashes = await sha256Hex('abc');
eq(hashes, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256(abc)');
eq(checkRelations({ recipes: [{ id: 'r1', edition_id: 'eX' }], book_editions: [] }, new Set()).length, 1, 'relation cassée détectée');
eq(checkRelations({ recipes: [{ id: 'r1', edition_id: null }] }, new Set()).length, 0, 'relation nulle acceptée');

// --- Redécouvrir
const now = new Date('2026-09-07T12:00:00Z');
const s1 = pickSuggestion({ editions: [{ id: 'e1', book_id: 'b1' }], books: [{ id: 'b1', title: 'L' }], recipes: [recipes[0]], activity: [], prefs: [], now });
eq(s1.mode, 'explore', 'sans historique : « À explorer », aucune durée inventée');
const act = [{ edition_id: 'e1', event_type: 'open_book', occurred_at: '2026-01-01T00:00:00Z' }];
eq(pickSuggestion({ editions: [{ id: 'e1', book_id: 'b1' }], books: [{ id: 'b1' }], recipes: [recipes[0]], activity: act, prefs: [], now }).months_since, 8, 'durée depuis la dernière consultation observée');
eq(pickSuggestion({ editions: [{ id: 'e1', book_id: 'b1' }], books: [{ id: 'b1' }], recipes: [recipes[0]], activity: act, prefs: [{ edition_id: 'e1', hidden: true }], now }), null, 'livre masqué non proposé');

// --- Minuterie
eq(shortcutUrl(480), 'shortcuts://run-shortcut?name=CuisineOS-Minuterie&input=text&text=480', 'URL du raccourci');
ok(siriPhrase(480).includes('8 minutes'), 'phrase Siri');

// --- Exports
const yaml = toPaprikaYaml([{ recipe: recipes[0], version, book: { title: 'Livre', author: 'A' }, edition: {} }]);
ok(yaml.includes('- name: "Pâtes puttanesca"') && yaml.includes('ingredients: |') && yaml.includes('directions: |'), 'YAML Paprika : champs obligatoires');
const ld = toJsonLd({ recipe: recipes[0], version, book: { title: 'Livre' }, edition: {} });
eq([ld['@type'], ld.recipeYield, ld.totalTime], ['Recipe', '4', undefined], 'JSON-LD : durée totale inconnue omise');

// --- Index et plats
eq(parseIndexLines('Magret de canard — 132\nSalade, p. 58\n212 Puttanesca').map((e) => e.printed_page), [132, 58, 212], 'entrées d’index');
const dish = { id: 'd1', labels: { fr: { label: 'Puttanesca', aliases: [] }, en: { label: 'Puttanesca', aliases: [] } } };
ok(proposeDishesForRecipe(recipes[0], [dish], []).length === 1, 'rapprochement proposé par titre');
eq(proposeDishesForRecipe(recipes[0], [dish], [{ recipe_id: 'r1', dish_id: 'd1', state: 'refused' }]).length, 0, 'refus mémorisé');
const cmp = compareBundles([{ recipe: recipes[0], version, history: [] }, { recipe: recipes[1], version: v3, history: [] }], ingById);
ok(cmp.only[0].some((x) => x.id === 'ing_wheat_pasta') && cmp.technique[1].prep === null, 'comparaison : différences et inconnues visibles');
const meal = summarizeMeal([{ version: { ...version, steps: parseStepsBlock('Cuire à 200 °C') }, title: 'A' }, { version: { ...v3, steps: parseStepsBlock('Rôtir à 180 °C'), active_minutes: 10 }, title: 'B' }]);
ok(meal.conflicts.length === 1, 'conflit de four détecté');

// --- Sauvegarde : bases IndexedDB temporaires, jamais la bibliothèque de l'utilisateur.
try { await runBackupTests({ eq, ok }); }
catch (error) { ok(false, `Suite sauvegarde interrompue : ${error?.message || String(error)}`); }

// --- Synchronisation : constantes, tables, types, base, capture, connexion.
try { await runSyncTests({ eq, ok }); }
catch (error) { ok(false, `Suite synchronisation interrompue : ${error?.message || String(error)}`); }

// --- Synchronisation L3 : transport (envoi et réception), transport factice.
try { await runSyncL3Tests({ eq, ok }); }
catch (error) { ok(false, `Suite L3 interrompue : ${error?.message || String(error)}`); }

// --- Page Ajouter et flux des livres : modèles purs et rendus DOM à gestes injectés.
try { await runAjouterTests({ eq, ok }); }
catch (error) { ok(false, `Suite Ajouter interrompue : ${error?.message || String(error)}`); }

// --- Chercher sur le web : bornes communes, lecture de la réponse, issues, écran à gestes injectés.
try { await runRechercheWebTests({ eq, ok }); }
catch (error) { ok(false, `Suite recherche web interrompue : ${error?.message || String(error)}`); }

// --- La configuration de l'assistant suit le compte : schéma, module de normalisation, magasin synchronisé.
try { await runAssistantCompteTests({ eq, ok }); }
catch (error) { ok(false, `Suite assistant par le compte interrompue : ${error?.message || String(error)}`); }

// --- Créer une recette avec l'assistant IA : module pur (demande, validation, fabrication), minuteurs bornés.
try { await runCreerIaTests({ eq, ok }); }
catch (error) { ok(false, `Suite créer avec l'IA interrompue : ${error?.message || String(error)}`); }

// --- Passerelle de l'assistant : l'app poste à la fonction Supabase avec la session, jamais à api.anthropic.com ; jeton jamais rendu.
try { await runPasserelleTests({ eq, ok }); }
catch (error) { ok(false, `Suite passerelle interrompue : ${error?.message || String(error)}`); }
try { await runL6ArchivesTests({ eq, ok }); }
catch (e) { ok(false, 'runL6ArchivesTests : ' + (e.stack || e)); }
try { await runL6TransfertsTraductionTests({ eq, ok }); }
catch (e) { ok(false, 'runL6TransfertsTraductionTests : ' + (e.stack || e)); }
try { await runL6ArchivesJournauxTests({ eq, ok }); }
catch (e) { ok(false, 'runL6ArchivesJournauxTests : ' + (e.stack || e)); }
try { await runL6BrouillonsAjouterTests({ eq, ok }); }
catch (e) { ok(false, 'runL6BrouillonsAjouterTests : ' + (e.stack || e)); }
try { await runL6ComplementsGroupesTests({ eq, ok }); }
catch (e) { ok(false, 'runL6ComplementsGroupesTests : ' + (e.stack || e)); }
try { await runL6ConsommateursTests({ eq, ok }); }
catch (e) { ok(false, 'runL6ConsommateursTests : ' + (e.stack || e)); }
try { await runL6CuisineLangueTests({ eq, ok }); }
catch (e) { ok(false, 'runL6CuisineLangueTests : ' + (e.stack || e)); }
try { await runL6DepotTraductionsTests({ eq, ok }); }
catch (e) { ok(false, 'runL6DepotTraductionsTests : ' + (e.stack || e)); }
try { await runL6JournalTraductionsTests({ eq, ok }); }
catch (e) { ok(false, 'runL6JournalTraductionsTests : ' + (e.stack || e)); }
try { await runL6SyncTraductionsTests({ eq, ok }); }
catch (e) { ok(false, 'runL6SyncTraductionsTests : ' + (e.stack || e)); }
try { await runL6TraductionParcoursTests({ eq, ok }); }
catch (e) { ok(false, 'runL6TraductionParcoursTests : ' + (e.stack || e)); }
try { await runL6TraductionsTransactionsTests({ eq, ok }); }
catch (e) { ok(false, 'runL6TraductionsTransactionsTests : ' + (e.stack || e)); }
try { await runL6VersionsRepoTests({ eq, ok }); }
catch (e) { ok(false, 'runL6VersionsRepoTests : ' + (e.stack || e)); }
try { await runL6VersionsStructureesTests({ eq, ok }); }
catch (e) { ok(false, 'runL6VersionsStructureesTests : ' + (e.stack || e)); }
try { await runL6DepotGardesTests({ eq, ok }); }
catch (e) { ok(false, 'runL6DepotGardesTests : ' + (e.stack || e)); }
try { await runL6ReglagesSynchronisationTests({ eq, ok }); }
catch (e) { ok(false, 'runL6ReglagesSynchronisationTests : ' + (e.stack || e)); }
try { await runL6LectureRecetteTests({ eq, ok }); }
catch (e) { ok(false, 'L6 lecture-recette : ' + (e.stack || e)); }
try { await runCorrectifLangueRecetteTests({ eq, ok }); }
catch (e) { ok(false, 'Correctif langue recette : ' + (e.stack || e)); }
try { await runTraductionGuideeTests({ eq, ok }); }
catch (e) { ok(false, 'Traduction guidée : ' + (e.stack || e)); }
try { await runL6LectureEcransTests({ eq, ok }); }
catch (e) { ok(false, 'L6 lecture-ecrans : ' + (e.stack || e)); }
try { await runL6LectureExportsTests({ eq, ok }); }
catch (e) { ok(false, 'L6 lecture-exports : ' + (e.stack || e)); }
try { await runL6CommandesTraductionTests({ eq, ok }); }
catch (e) { ok(false, 'L6 commandes-traduction : ' + (e.stack || e)); }
try { await runL6BrouillonsListeTests({ eq, ok }); }
catch (e) { ok(false, 'L6 brouillons-liste : ' + (e.stack || e)); }
try { await runL6TraductionVolTests({ eq, ok }); }
catch (e) { ok(false, 'L6 traduction-vol : ' + (e.stack || e)); }
try { await runL6EditeurTraductionTests({ eq, ok }); }
catch (e) { ok(false, 'L6 editeur-traduction : ' + (e.stack || e)); }
try { await runL6TraductionRepriseTests({ eq, ok }); }
catch (e) { ok(false, 'L6 traduction-reprise : ' + (e.stack || e)); }
try { await runL6PasserelleBrutTests({ eq, ok }); }
catch (error) { ok(false, `Suite récupération brute L6 interrompue : ${error?.message || String(error)}`); }
try { await runL6StructureIngredientsTests({ eq, ok }); }
catch (error) { ok(false, `Suite groupes d’ingrédients L6 interrompue : ${error?.message || String(error)}`); }
try { await runL6TraductionsFormatTests({ eq, ok }); }
catch (error) { ok(false, `Suite format traduction L6 interrompue : ${error?.message || String(error)}`); }
try { await runL6ExtractionGroupesTests({ eq, ok }); }
catch (error) { ok(false, `Suite extraction des groupes L6 interrompue : ${error?.message || String(error)}`); }
try { await runL6TraductionProviderTests({ eq, ok }); }
catch (error) { ok(false, `Suite appel traduction L6 interrompue : ${error?.message || String(error)}`); }
try { await runL6TraductionPortionsTests({ eq, ok }); }
catch (error) { ok(false, `Suite portions de traduction L6 interrompue : ${error?.message || String(error)}`); }
try { await runL6EditeurGroupesTests({ eq, ok }); }
catch (error) { ok(false, `Suite éditeur de groupes L6 interrompue : ${error?.message || String(error)}`); }

// --- Importer une recette repérée (lot A, tâche 1) : schéma imports (DB_VERSION 4), conditions de db.mutate, repo.transitionner, archives tolérantes, vocabulaire.
try { await runImportCibleTests({ eq, ok }); }
catch (error) { ok(false, `Suite import ciblé interrompue : ${error?.message || String(error)}`); }

// --- Lot E « Un livre reconnu depuis sa couverture » : domaine, lecture par l'assistant, vol, section Imports, suppression, traces orphelines.
try { await runCouvertureTests({ eq, ok }); }
catch (error) { ok(false, `Suite couverture interrompue : ${error?.message || String(error)}`); }

// --- Recette web complète (lot B) : outil lecture-web côté app — domaine, vol partagé, signet, onglet Web, écran, fiche, section Imports.
try { await runLectureWebTests({ eq, ok }); }
catch (error) { ok(false, `Suite lecture web interrompue : ${error?.message || String(error)}`); }

// --- Les photos voyagent entre appareils (lot G) : projection, réception, archive, passe fichiers, moteur, Réglages, écrans.
try { await runSyncL4Tests({ eq, ok }); }
catch (error) { ok(false, `Suite photos entre appareils interrompue : ${error?.message || String(error)}`); }

// --- Table des matières sur plusieurs pages (lot C) : contrat du modèle, domaine, vol partagé, écran, fiche livre et recherche.
try { await runTableMatieresTests({ eq, ok }); }
catch (error) { ok(false, `Suite table des matières interrompue : ${error?.message || String(error)}`); }
try { await runIndexLivreTests({ eq, ok }); }
catch (e) { ok(false, `Index livre : bloc interrompu — ${e?.message || e}`); }
try { await runIndexLivreEcranTests({ eq, ok }); }
catch (e) { ok(false, `Index livre (écran) : suite interrompue — ${e?.message || e}`); }

// --- Un lot de recettes photographiées (lot D) : classement, regroupement, appariement, lecture du lot, enregistrement d'une lecture de séance.
try { await runClassementTests({ eq, ok }); }
catch (error) { ok(false, `Suite lot de recettes interrompue : ${error?.message || String(error)}`); }

// --- Les plats en images (lot F) : photo du plat, rapatriement par la fonction, cartes illustrées.
try { await runPhotoPlatTests({ eq, ok }); }
catch (error) { ok(false, `Suite photo du plat interrompue : ${error?.message || String(error)}`); }

// --- Aperçus des résultats web (lot UI-2) : lireApercusWeb, mur sans ré-encodage, vol d'aperçus, figures et ligne d'état de l'onglet Web.
try { await runApercuWebTests({ eq, ok }); }
catch (error) { ok(false, `Suite aperçus web interrompue : ${error?.message || String(error)}`); }
// --- Lot UI-1 « Carnet » : jetons olive, typographie, sectionPlain, pageHeader({ classeTitre }), icônes au trait, états vides ; T2 à T6 y ajoutent leurs blocs.
try { await runCarnetTests({ eq, ok }); }
catch (error) { ok(false, `Suite carnet interrompue : ${error?.message || String(error)}`); }

// --- Thème « magazine culinaire » : la feuille servie est lue (jetons, contrastes, inventaire) et mesurée (scène hors écran visible).
try { await runThemeTests({ eq, ok }); }
catch (error) { ok(false, `Suite thème interrompue : ${error?.message || String(error)}`); }

// --- Lot I2 : livres, cuissons personnelles, photos de pages et intégration.
for (const [nom, suite] of [['livre', runI2LivreTests], ['cuisine', runI2CuisineTests], ['photo page', runI2PhotoPageTests], ['intégration', runI2IntegrationTests]]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite I2 ${nom} interrompue : ${error?.message || String(error)}`); }
}

// --- Lot I3 : domaine TM7, journal, écrans et gardes transversales.
for (const [nom, suite] of [['domaine', runI3ThermomixTests], ['sécurité corrigée', runCorrectifsThermomixSecuriteTests], ['réponses JSON', runCorrectifsReponsesJsonTests], ['journal', runI3ParcoursTests], ['écran', runI3EcranTests], ['intégration', runI3IntegrationTests]]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite I3 ${nom} interrompue : ${error?.message || String(error)}`); }
}

// Photos et repères : domaine, transfert, journal, édition et intégration.
for (const suite of [runVisuelReperesTests, runVisuelPhotosTests, runVisuelParcoursTests, runVisuelReperesEcranTests, runVisuelIntegrationTests]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite photos et repères interrompue : ${error?.message || String(error)}`); }
}

// Correctifs prioritaires : travail payé, reprise des brouillons et documents Thermomix.
for (const suite of [runCorrectifsReperesTests, runCorrectifsBrouillonsTests, runCorrectifsAdaptationTests, runCorrectifsImportsSyncTests]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite correctifs prioritaires interrompue : ${error?.message || String(error)}`); }
}

// L0 : cohérence des traductions, repas, cuisine et sorties de courses.
for (const suite of [runL0TraductionsTests, runL0CuisineTests, runL0RepasCoursesTests, runL0IntegrationTests]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite L0 interrompue : ${error?.message || String(error)}`); }
}

// L1 : corbeille, écritures tardives, archives et synchronisation.
for (const suite of [runL1CorbeilleDomaineTests, runL1CorbeilleArchiveTests, runL1CorbeilleSyncTests, runL1CorbeilleUiTests, runL1CorbeilleMutationsTests]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite L1 interrompue : ${error?.message || String(error)}`); }
}

// L2 : corbeille des livres, deux bases de cycle et sources conservées.
for (const suite of [runL2CorbeilleDomaineTests, runL2CorbeilleArchiveTests, runL2CorbeilleSyncTests, runL2CorbeilleUiTests, runL2CorbeilleMutationsTests, runL2ContextesImportTests, runL2LivreMutationsTests, runL2CorbeilleImportsTests, runL2SyncRepriseTests, runL2SourcesSyncTests, runL2SourcesProvenanceTests]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite L2 interrompue : ${error?.message || String(error)}`); }
}

// L3 : contexte de navigation, filtres, listes et commandes capturées depuis le contenu affiché.
for (const suite of [runL3NavigationTests, runL3BibliothequeTests, runL3ListesTests, runL3ActionsTests]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite L3 interrompue : ${error?.message || String(error)}`); }
}

// L4 : brouillons récupérables et rendement textuel distinct du calcul de portions.
for (const suite of [runL4BrouillonsListeTests, runL4RendementTests, runL4RaccordsTests, runL4BrouillonsTests, runL4PublicationTests, runL4EditeurRecetteTests, runL4EditeurRecetteUITests, runL4LectureEditeurTests, runL4LivreEditeurTests, runL4SortiesTests, runL4JournalTests, runL4LimitesArchivesTests, runL4BrouillonsSyncTests]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite L4 interrompue : ${error?.message || String(error)}`); }
}

// L5 : une révision source conserve son orientation et les lecteurs distinguent sélection et historique.
for (const suite of [runL5ComplementsRecetteTests, runL5ComplementsRecetteUiTests, runL5JournalSnapshotTests, runL5PremiereLiaisonTests, runL5ComparaisonSourcesUiTests, runL5ComparaisonSourcesTests, runL5ArchivesTests, runL5IndexApplicationTests, runL5IndexStockageTests, runL5IndexTransactionTests, runL5IndexVolTests, runL5ImportSourcesTests, runL5ReceptionSourcesTests, runL5RevisionsSourceTests, runL5SyncSourcesTests, runL5TransfertsSourceTests, runL5RaccordsTests, runL5SourcesLecteursTests, runL5IndexLectureTests, runL5SourcesFormatTests]) {
  try { await suite({ eq, ok, close }); }
  catch (error) { ok(false, `Suite L5 interrompue : ${error?.message || String(error)}`); }
}

// --- Compte total épinglé (F2). Une assertion qui DISPARAÎT — un bloc supprimé, une boucle qui ne tourne plus, une
// suite interrompue tôt dont le `catch` ne rend qu'une ligne rouge — ne doit pas passer pour un total un peu plus
// petit que personne ne regarde. Le nombre est celui mesuré AVANT cette assertion même (elle s'ajoute ensuite), et
// il se met à jour en même temps que le compte annoncé dans CLAUDE.md et dans la spec.
try { await runL7ArchivesTests({eq,ok}); } catch (e) { ok(false, 'runL7ArchivesTests : ' + (e.stack || e)); }
try { await runL7ComparaisonCuisineEcranTests({eq,ok}); } catch (e) { ok(false, 'runL7ComparaisonCuisineEcranTests : ' + (e.stack || e)); }
try { await runL7ComparaisonCuisineTests({eq,ok}); } catch (e) { ok(false, 'runL7ComparaisonCuisineTests : ' + (e.stack || e)); }
try { await runL7CuisineProjectionTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineProjectionTests : ' + (e.stack || e)); }
try { await runL7CuisineFinTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineFinTests : ' + (e.stack || e)); }
try { await runL7CuisineHistoriqueCASTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineHistoriqueCASTests : ' + (e.stack || e)); }
try { await runL7CuisineSourcesTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineSourcesTests : ' + (e.stack || e)); }
try { await runL7CuisineSnapshotTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineSnapshotTests : ' + (e.stack || e)); }
try { await runL7CuisinePorteeTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisinePorteeTests : ' + (e.stack || e)); }
try { await runL7CuisineAncienPutTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineAncienPutTests : ' + (e.stack || e)); }
try { await runL7SyncTests({eq,ok}); } catch (e) { ok(false, 'runL7SyncTests : ' + (e.stack || e)); }
try { await runL7SyncCouvertureTests({eq,ok}); } catch (e) { ok(false, 'runL7SyncCouvertureTests : ' + (e.stack || e)); }
try { await runL7SyncReceptionTests({eq,ok}); } catch (e) { ok(false, 'runL7SyncReceptionTests : ' + (e.stack || e)); }
try { await runL7SyncAccuseTests({eq,ok}); } catch (e) { ok(false, 'runL7SyncAccuseTests : ' + (e.stack || e)); }
try { await runL7CuisineVolumesTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineVolumesTests : ' + (e.stack || e)); }
try { await runL7SyncFinTests({eq,ok}); } catch (e) { ok(false, 'runL7SyncFinTests : ' + (e.stack || e)); }
try { await runL8InventaireArchiveTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireArchiveTests : ' + (e.stack || e)); }
try { await runL8InventaireEcranTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireEcranTests : ' + (e.stack || e)); }
try { await runL8InventaireFormatTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireFormatTests : ' + (e.stack || e)); }
try { await runL8InventaireMutationsTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireMutationsTests : ' + (e.stack || e)); }
try { await runL8InventairePersistanceTests({eq,ok}); } catch (e) { ok(false, 'runL8InventairePersistanceTests : ' + (e.stack || e)); }
try { await runL8InventaireLegacyTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireLegacyTests : ' + (e.stack || e)); }
try { await runL8InventaireProjectionTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireProjectionTests : ' + (e.stack || e)); }
try { await runL8CoursesQuantitesTests({eq,ok}); } catch (e) { ok(false, 'runL8CoursesQuantitesTests : ' + (e.stack || e)); }
try { await runL8RepasModeleTests({eq,ok}); } catch (e) { ok(false, 'runL8RepasModeleTests : ' + (e.stack || e)); }
try { await runL8RepasEcranTests({eq,ok}); } catch (e) { ok(false, 'runL8RepasEcranTests : ' + (e.stack || e)); }
try { await runL8CoursesEcranTests({eq,ok}); } catch (e) { ok(false, 'runL8CoursesEcranTests : ' + (e.stack || e)); }
try { await runL8EnviesTests({eq,ok}); } catch (e) { ok(false, 'runL8EnviesTests : ' + (e.stack || e)); }
try { await runL8RestesTests({eq,ok}); } catch (e) { ok(false, 'runL8RestesTests : ' + (e.stack || e)); }
try { await runL8ArchivesTests({eq,ok}); } catch (e) { ok(false, 'runL8ArchivesTests : ' + (e.stack || e)); }
try { await runL8InventaireAccueilTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireAccueilTests : ' + (e.stack || e)); }
try { await runL8InventaireComparaisonTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireComparaisonTests : ' + (e.stack || e)); }
try { await runL8InventaireDepotEcranTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireDepotEcranTests : ' + (e.stack || e)); }
try { await runL8InventaireMemoireTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireMemoireTests : ' + (e.stack || e)); }
try { await runL8RepasConcurrenceTests({eq,ok}); } catch (e) { ok(false, 'runL8RepasConcurrenceTests : ' + (e.stack || e)); }
try { await runL8CoursesComparaisonTests({eq,ok}); } catch (e) { ok(false, 'runL8CoursesComparaisonTests : ' + (e.stack || e)); }
try { await runL8InventaireCopiesTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireCopiesTests : ' + (e.stack || e)); }
try { await runL8InventaireTransactionsTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireTransactionsTests : ' + (e.stack || e)); }
try { await runL8CoursesAttenteTests({eq,ok}); } catch (e) { ok(false, 'runL8CoursesAttenteTests : ' + (e.stack || e)); }
try { await runL8RepasBornesTests({eq,ok}); } catch (e) { ok(false, 'runL8RepasBornesTests : ' + (e.stack || e)); }
try { await runL8SyncTests({eq,ok}); } catch (e) { ok(false, 'runL8SyncTests : ' + (e.stack || e)); }
try { await runL8SyncReceptionTests({eq,ok}); } catch (e) { ok(false, 'runL8SyncReceptionTests : ' + (e.stack || e)); }
try { await runL8SyncAccuseTests({eq,ok}); } catch (e) { ok(false, 'runL8SyncAccuseTests : ' + (e.stack || e)); }
try { await runL8SyncSourcesTests({eq,ok}); } catch (e) { ok(false, 'runL8SyncSourcesTests : ' + (e.stack || e)); }
try { await runL8InventaireRejeuTransactionsTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireRejeuTransactionsTests : ' + (e.stack || e)); }
try { await runL8CoursesGestesTests({eq,ok}); } catch (e) { ok(false, 'runL8CoursesGestesTests : ' + (e.stack || e)); }
try { await runL8SyncConflitsTests({eq,ok}); } catch (e) { ok(false, 'runL8SyncConflitsTests : ' + (e.stack || e)); }
try { await runL8InventaireComparaisonRejeuTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireComparaisonRejeuTests : ' + (e.stack || e)); }
try { await runL8InventaireReglagesTests({eq,ok}); } catch (e) { ok(false, 'runL8InventaireReglagesTests : ' + (e.stack || e)); }
try { await runL8SyncAdoptionTests({eq,ok}); } catch (e) { ok(false, 'runL8SyncAdoptionTests : ' + (e.stack || e)); }
try { await runL8SyncBornesTests({eq,ok}); } catch (e) { ok(false, 'runL8SyncBornesTests : ' + (e.stack || e)); }
try { await runL9DialoguesTests({eq,ok}); } catch (e) { ok(false, 'runL9DialoguesTests : ' + (e.stack || e)); }
try { await runL9DialoguesRepliTests({eq,ok}); } catch (e) { ok(false, 'runL9DialoguesRepliTests : ' + (e.stack || e)); }
try { await runL9DialoguesMetierTests({eq,ok}); } catch (e) { ok(false, 'runL9DialoguesMetierTests : ' + (e.stack || e)); }
try { await runL9DialoguesCycleTests({eq,ok}); } catch (e) { ok(false, 'runL9DialoguesCycleTests : ' + (e.stack || e)); }
try { await runL9DialoguesMetierRepliTests({eq,ok}); } catch (e) { ok(false, 'runL9DialoguesMetierRepliTests : ' + (e.stack || e)); }
try { await runL9LisibiliteTests({eq,ok}); } catch (e) { ok(false, 'runL9LisibiliteTests : ' + (e.stack || e)); }
try { await runL9NavigationTests({eq,ok}); } catch (e) { ok(false, 'runL9NavigationTests : ' + (e.stack || e)); }
try { await runL9CoquilleTests({eq,ok}); } catch (e) { ok(false, 'runL9CoquilleTests : ' + (e.stack || e)); }
try { await runL9BarreTests({eq,ok}); } catch (e) { ok(false, 'runL9BarreTests : ' + (e.stack || e)); }
try { await runL9SelecteursTests({eq,ok}); } catch (e) { ok(false, 'runL9SelecteursTests : ' + (e.stack || e)); }
try { await runL9ContraintesRepasTests({eq,ok}); } catch (e) { ok(false, 'runL9ContraintesRepasTests : ' + (e.stack || e)); }
try { await runL9RaccordsSelecteursTests({eq,ok}); } catch (e) { ok(false, 'runL9RaccordsSelecteursTests : ' + (e.stack || e)); }
try { await runL9CadreTests({eq,ok}); } catch (e) { ok(false, 'runL9CadreTests : ' + (e.stack || e)); }
try { await runL10ConservationTests({eq,ok}); } catch (e) { ok(false, 'runL10ConservationTests : ' + (e.stack || e)); }
try { await runL10ReponseBruteTests({eq,ok}); } catch (e) { ok(false, 'runL10ReponseBruteTests : ' + (e.stack || e)); }
try { await runL10GardesMetierTests({eq,ok}); } catch (e) { ok(false, 'runL10GardesMetierTests : ' + (e.stack || e)); }
try { await runL10ConservationConcurrenceTests({eq,ok}); } catch (e) { ok(false, 'runL10ConservationConcurrenceTests : ' + (e.stack || e)); }
try { await runL10DemarrageTests({eq,ok}); } catch (e) { ok(false, 'runL10DemarrageTests : ' + (e.stack || e)); }
try { await runL10DiagnosticTests({eq,ok}); } catch (e) { ok(false, 'runL10DiagnosticTests : ' + (e.stack || e)); }
try { await runL10DiagnosticCollecteTests({eq,ok}); } catch (e) { ok(false, 'runL10DiagnosticCollecteTests : ' + (e.stack || e)); }
try { await runL10HorsLigneMediasTests({eq,ok}); } catch (e) { ok(false, 'runL10HorsLigneMediasTests : ' + (e.stack || e)); }
try { await runL10HorsLigneCoursesTests({eq,ok}); } catch (e) { ok(false, 'runL10HorsLigneCoursesTests : ' + (e.stack || e)); }
try { await runL10HorsLigneCycleTests({eq,ok}); } catch (e) { ok(false, 'runL10HorsLigneCycleTests : ' + (e.stack || e)); }
try { await runL10HorsLigneEchecsTests({eq,ok}); } catch (e) { ok(false, 'runL10HorsLigneEchecsTests : ' + (e.stack || e)); }
try { await runL10HorsLigneTests({eq,ok}); } catch (e) { ok(false, 'runL10HorsLigneTests : ' + (e.stack || e)); }
try { await runL10LiensExactsTests({eq,ok}); } catch (e) { ok(false, 'runL10LiensExactsTests : ' + (e.stack || e)); }
try { await runL10HorsLigneEcranTests({eq,ok}); } catch (e) { ok(false, 'runL10HorsLigneEcranTests : ' + (e.stack || e)); }
try { await runL10HorsLigneFermetureTests({eq,ok}); } catch (e) { ok(false, 'runL10HorsLigneFermetureTests : ' + (e.stack || e)); }
try { await runL10HorsLigneCandidatesTests({eq,ok}); } catch (e) { ok(false, 'runL10HorsLigneCandidatesTests : ' + (e.stack || e)); }
try { await runL10LivraisonTests({eq,ok}); } catch (e) { ok(false, 'runL10LivraisonTests : ' + (e.stack || e)); }
try { await runL10MiseAJourTests({eq,ok}); } catch (e) { ok(false, 'runL10MiseAJourTests : ' + (e.stack || e)); }
try { await runL10ReessaiFichierTests({eq,ok}); } catch (e) { ok(false, 'runL10ReessaiFichierTests : ' + (e.stack || e)); }
try { await runL10HorsLigneActualisationTests({eq,ok}); } catch (e) { ok(false, 'runL10HorsLigneActualisationTests : ' + (e.stack || e)); }
try { await runL10DiagnosticActualisationTests({eq,ok}); } catch (e) { ok(false, 'runL10DiagnosticActualisationTests : ' + (e.stack || e)); }
try { await runL7ObservationsBaseTests({eq,ok}); } catch (e) { ok(false, 'runL7ObservationsBaseTests : ' + (e.stack || e)); }

try { await runL7CuisineArchiveTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineArchiveTests : ' + (e.stack || e)); }
try { await runL7CuisineDepartTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineDepartTests : ' + (e.stack || e)); }
try { await runL7CuisineEcranTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineEcranTests : ' + (e.stack || e)); }
try { await runL7CuisineFormatTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineFormatTests : ' + (e.stack || e)); }
try { await runL7CuisinePersistanceTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisinePersistanceTests : ' + (e.stack || e)); }
try { await runL7CuisineConcurrenceTests({eq,ok}); } catch (e) { ok(false, 'runL7CuisineConcurrenceTests : ' + (e.stack || e)); }
try { await runL7CuissonFinTests({eq,ok}); } catch (e) { ok(false, 'runL7CuissonFinTests : ' + (e.stack || e)); }
try { await runL7EcranAllumeTests({eq,ok}); } catch (e) { ok(false, 'runL7EcranAllumeTests : ' + (e.stack || e)); }
try { await runL7MinuteursCommandesTests({eq,ok}); } catch (e) { ok(false, 'runL7MinuteursCommandesTests : ' + (e.stack || e)); }
try { await runL7MinuteursDepotEcranTests({eq,ok}); } catch (e) { ok(false, 'runL7MinuteursDepotEcranTests : ' + (e.stack || e)); }
try { await runL7MinuteursEcranTests({eq,ok}); } catch (e) { ok(false, 'runL7MinuteursEcranTests : ' + (e.stack || e)); }
try { await runL7VoixTests({eq,ok}); } catch (e) { ok(false, 'runL7VoixTests : ' + (e.stack || e)); }
try { await runAuditConflitsTests({eq,ok}); } catch (e) { ok(false, 'runAuditConflitsTests : ' + (e.stack || e)); }
try { await runAuditPurgeImportsTests({eq,ok}); } catch (e) { ok(false, 'runAuditPurgeImportsTests : ' + (e.stack || e)); }
try { await runAuditCycleConflitsTests({eq,ok}); } catch (e) { ok(false, 'runAuditCycleConflitsTests : ' + (e.stack || e)); }
try { await runAuditLivraisonEchecTests({eq,ok}); } catch (e) { ok(false, 'runAuditLivraisonEchecTests : ' + (e.stack || e)); }
try { await runAuditStockagePersistantTests({eq,ok}); } catch (e) { ok(false, 'runAuditStockagePersistantTests : ' + (e.stack || e)); }
try { await runAuditDiagnosticStockageTests({eq,ok}); } catch (e) { ok(false, 'runAuditDiagnosticStockageTests : ' + (e.stack || e)); }
try { await runAuditCommandesProtegeesTests({eq,ok}); } catch (e) { ok(false, 'runAuditCommandesProtegeesTests : ' + (e.stack || e)); }
try { await runAuditArchiveRetraitTests({eq,ok}); } catch (e) { ok(false, 'runAuditArchiveRetraitTests : ' + (e.stack || e)); }
try { await runAuditArchiveFichesInvalidesTests({eq,ok}); } catch (e) { ok(false, 'runAuditArchiveFichesInvalidesTests : ' + (e.stack || e)); }
try { await runAuditArchiveExclusionsUITests({eq,ok}); } catch (e) { ok(false, 'runAuditArchiveExclusionsUITests : ' + (e.stack || e)); }
try { await runAuditFichesCycleTests({eq,ok}); } catch (e) { ok(false, 'runAuditFichesCycleTests : ' + (e.stack || e)); }
try { await runAuditVersionBaseTests({eq,ok}); } catch (e) { ok(false, 'runAuditVersionBaseTests : ' + (e.stack || e)); }
eq(results.length, 12622,'compte d’assertions : une assertion qui disparait est un rouge');

// --- Sortie
const failed = results.filter((r) => !r.ok);
const out = document.getElementById('out');
// Le bilan est fait de NŒUDS TEXTE (jamais innerHTML) : un libellé, un « obtenu » ou un « attendu » portent souvent une sortie de modèle
// hostile (I-H) — rendue en HTML, une assertion qui échoue exécuterait ce balisage dans la page de tests.
const bloc = (tag, cls, texte) => { const n = document.createElement(tag); if (cls) n.className = cls; n.textContent = texte; return n; };
out.replaceChildren(bloc('h2', null, `${failed.length ? '❌' : '✅'} ${results.length - failed.length}/${results.length} tests réussis`),
  ...results.map((r) => { const d = bloc('div', r.ok ? 'ok' : 'ko', `${r.ok ? '✓' : '✗'} ${r.msg}`); if (!r.ok) d.append(bloc('pre', null, `obtenu : ${JSON.stringify(r.got)}\nattendu : ${JSON.stringify(r.want)}`)); return d; }));
