import { withRepo } from './sync-fixture.js';
import { fixtureDemandeThermomix } from './audit-thermomix-demande.js';
import { ouvrirThermomix } from '../src/domain/thermomix-parcours.js';
import { renderThermomixRoute } from '../src/ui/thermomix.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';

const messages = {
  fr: 'Une étape proposée est trop longue pour être ajoutée à la recette.',
  en: 'A proposed step is too long to be added to the recipe.',
};

// Seul le fournisseur est simulé : route, parcours, Response, dépôt, reçu et réouverture sont réels.
export async function runAuditThermomixLongueurEcranTests({ eq, ok }) {
  const langueAvant = getUiLocale();
  try {
    for (const langue of ['fr', 'en']) await withRepo(async (repo, db) => {
      setUiLocale(langue);
      const nom = `10.5 écran TM7 ${langue}`, f = fixtureDemandeThermomix({ points: 2001, langue });
      eq([...f.texte].length, 2001, `${nom} : dépassement réel du texte final, en points de code`);
      await db.mutate({ origin: 'device', puts: { sync_state: [
        { key: 'user_id', value: 'u1' }, { key: 'editor_library_epoch:v1', value: 'epoque-longueur-ecran' },
      ] } });
      const recipe = { id: f.source.recipe_id, original_title: 'Sauce du carnet', original_language: langue, availability: 'available', current_version_id: f.source.id };
      await repo.saveBatch({ recipes: [recipe], recipe_versions: [f.source] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const row = await ouvrirThermomix({ recipeId: recipe.id, versionId: f.source.id, selection: f.contexte.selection, precisions: f.contexte.precisions, langue }, { repo });
      const avant = await db.getSnapshot(['recipes', 'recipe_versions']);
      const brut = new TextEncoder().encode(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(f.resultat) }], stop_reason: 'end_turn', model: 'fixture-longueur' }));
      const session = { access_token: 'session-fixture', user: { id: 'u1' } }, fichiers = [], methodes = [];
      let root;
      const fermer = () => { root?.dispose?.(); root?.remove(); root = null; };
      const monter = async () => {
        root = await renderThermomixRoute({ id: recipe.id }, { import: row.id }, {}, {
          repo, sessionAssistant: async () => session, sessionCourante: () => session, enLigne: () => true,
          config: { url: 'https://assistant.example', anonKey: 'publique-factice' },
          fetch: async (_url, init) => { methodes.push(init.method); return new Response(brut, { status: 200 }); },
          navigate: () => {}, remplacerAdresse: () => {}, toast: () => {},
          telechargerReponse: (blob, nomFichier) => fichiers.push({ blob, nom: nomFichier }),
        });
        document.body.append(root); await root.attendreEcritures();
      };
      const verifierEcran = phase => {
        eq(root.querySelector('[data-role=etat-tm7]')?.textContent, messages[langue], `${nom} ${phase} : motif exact dans l’état de l’appel`);
        eq(root.querySelector('[data-role=motif-reponse-refusee]')?.textContent, messages[langue], `${nom} ${phase} : motif exact près du reçu`);
        const panneau = root.querySelector('[data-role=reponse-refusee]');
        ok(!!panneau && !panneau.hidden, `${nom} ${phase} : reçu visible sur cet appareil`);
        eq(panneau?.querySelector('pre')?.textContent ?? null, new TextDecoder().decode(brut), `${nom} ${phase} : corps intégral rendu comme texte`);
        eq(root.querySelector('[data-role=garder-tm7]:not([hidden]):not(:disabled)'), null, `${nom} ${phase} : aucun Garder utilisable`);
        eq(root.querySelector('[data-role=proposition-tm7]')?.childElementCount, 0, `${nom} ${phase} : aucune proposition présentée à l’adoption`);
      };
      try {
        await monter();
        eq(methodes.length, 0, `${nom} : montage sans appel automatique`);
        const proposer = root.querySelector('[data-role=proposer-tm7]');
        eq(proposer?.disabled, false, `${nom} : demande volontaire disponible`);
        proposer?.click(); await root.attendreEcritures();
        eq(methodes, ['POST'], `${nom} : un seul POST volontaire`);
        const conservee = await repo.get('imports', row.id);
        eq(conservee.status, 'echec', `${nom} : refus avant la présentation`);
        eq(conservee.resultat, null, `${nom} : résultat refusé strictement nul`);
        eq(conservee.erreur?.raison, 'etape_trop_longue', `${nom} : motif domaine exact conservé`);
        eq(conservee.reponse_refusee?.motif, 'etape_trop_longue', `${nom} : reçu durable attribué au bon refus`);
        verifierEcran('après réponse');
        root.querySelector('[data-role=recuperer-reponse]')?.click(); await root.attendreEcritures();
        eq(fichiers.length, 1, `${nom} : récupération volontaire du reçu`);
        eq(fichiers[0] ? [...new Uint8Array(await fichiers[0].blob.arrayBuffer())] : null, [...brut], `${nom} : récupération de tous les octets de la vraie Response`);
        eq(await db.getSnapshot(['recipes', 'recipe_versions']), avant, `${nom} : original et pointeur inchangés, aucune nouvelle version`);
        fermer(); await monter();
        verifierEcran('après réouverture');
        root.querySelector('[data-role=recuperer-reponse]')?.click(); await root.attendreEcritures();
        eq(fichiers.length, 2, `${nom} : reçu récupérable par un nouveau contrôleur`);
        eq(fichiers[1] ? [...new Uint8Array(await fichiers[1].blob.arrayBuffer())] : null, [...brut], `${nom} : octets durables exacts après réouverture`);
        eq(methodes, ['POST'], `${nom} : récupération et réouverture sans nouvel appel`);
        eq(await repo.get('imports', row.id), conservee, `${nom} : consultation ne réécrit pas le refus`);
        eq(await db.getSnapshot(['recipes', 'recipe_versions']), avant, `${nom} : consultation conserve aussi l’original exact`);
      } finally { fermer(); }
    });
  } finally { setUiLocale(langueAvant); }
}
