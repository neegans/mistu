import { boutonsActions, menuActions, actionsRecette, actionsLivre } from '../src/ui/actions-contenu.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';
import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';

const ATTENTE = 'Vérification de la disponibilité…';
const ECHEC = 'La disponibilité de cette action n’a pas pu être vérifiée. Rouvre cet écran pour réessayer.';
const differer = () => { let resoudre, rejeter; const promesse = new Promise((ok, non) => { resoudre = ok; rejeter = non; }); return { promesse, resoudre, rejeter }; };
const terminee = async p => { await p.catch(() => {}); await Promise.resolve(); };
const motif = node => node.parentElement.querySelector('[data-role=motif-action]');
const description = node => document.getElementById(node.getAttribute('aria-describedby'));
const clic = node => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

export async function runAuditActionsMotifsTests({ eq, ok }) {
  const langue = getUiLocale(), racines = [];
  const monter = root => { document.body.append(root); racines.push(root); return root; };
  const direct = a => monter(boutonsActions([a], [a.id], { onResultat: () => {} })).querySelector('[data-action]');
  const action = extra => ({ id: 'refus', libelle: 'Action de fixture', nomAccessible: 'Action de fixture', eligible: false, executer: async () => ({ issue: 'annule' }), ...extra });
  const run = async (nom, f) => { try { await f(); } catch (e) { ok(false, `Motifs11.2 ${nom} : ${e.stack || e}`); } finally {
    document.querySelectorAll('[data-role=dialogue-actions]').forEach(d => { if (d.open) d.close(); d.remove(); });
    racines.splice(0).forEach(r => r.remove());
  } };
  try {
    setUiLocale('fr');
    await run('refus direct', async () => {
      let executions = 0; const texte = '<img src=x> Cette action attend une vérification.';
      const bouton = direct(action({ motif: texte, executer: async () => { executions++; } })), small = motif(bouton);
      eq(small?.tagName, 'SMALL', 'Motifs11.2 : motif direct dans small');
      eq(small?.textContent, texte, 'Motifs11.2 : motif complet en texte seul');
      ok(small && !small.hidden && small.getClientRects().length, 'Motifs11.2 : motif visible sans survol');
      eq(small?.querySelector('img') ?? null, null, 'Motifs11.2 : aucune balise issue du motif');
      ok(small && bouton.nextElementSibling === small, 'Motifs11.2 : motif placé après le contrôle dans son groupe');
      ok(description(bouton) === small && !!small?.id, 'Motifs11.2 : contrôle décrit par son motif');
      eq(bouton.disabled, true, 'Motifs11.2 : refus métier reste désactivé');
      clic(bouton); eq(executions, 0, 'Motifs11.2 : clic synthétique refusé sans commande');
    });
    await run('lien refusé', async () => {
      let verifications = 0; const a = direct(action({ href: '#/recipe-fixture', motif: 'Source à relire', verifier: async () => { verifications++; } }));
      eq(a.tagName, 'A', 'Motifs11.2 : action de navigation reste un vrai lien');
      eq(a.getAttribute('href'), '#/recipe-fixture', 'Motifs11.2 : destination inchangée');
      eq(a.getAttribute('aria-disabled'), 'true', 'Motifs11.2 : lien inéligible annoncé');
      eq(description(a)?.textContent, 'Source à relire', 'Motifs11.2 : lien décrit par son refus visible');
      eq(clic(a), false, 'Motifs11.2 : navigation ordinaire refusée'); eq(verifications, 0, 'Motifs11.2 : refus ne déclenche pas de vérification tardive');
    });
    await run('menu et identifiants', async () => {
      const a = action({ motif: 'Capacité inconnue' }), bouton = direct(a);
      const trigger = monter(menuActions([action({ id: 'possible', eligible: true }), a], { titre: 'Titre', onResultat: () => {} }));
      trigger.click(); const dialogue = document.querySelector('[data-role=dialogue-actions]'), menu = dialogue.querySelector('[data-action=refus]');
      eq(description(menu)?.textContent, a.motif, 'Motifs11.2 : menu montre le même motif visible');
      ok(!!bouton.getAttribute('aria-describedby') && bouton.getAttribute('aria-describedby') !== menu.getAttribute('aria-describedby'), 'Motifs11.2 : même action directe et menu ont deux identifiants distincts');
      ok(description(bouton) === motif(bouton) && description(menu) === motif(menu), 'Motifs11.2 : chaque contrôle décrit seulement son propre texte');
      eq(dialogue.querySelectorAll('a button,button small').length, 0, 'Motifs11.2 : motif extérieur au contrôle');
      dialogue.dispatchEvent(new Event('cancel', { cancelable: true }));
      eq(document.activeElement, trigger, 'Motifs11.2 : fermeture du menu rend encore le focus');
    });
    for (const autorise of [false, true]) await run('résolution ' + autorise, async () => {
      const attente = differer(); let executions = 0;
      const a = action({ motif: 'Ancien motif', executer: async () => { executions++; return { issue: 'annule' }; } });
      a.pret = attente.promesse.then(() => { a.eligible = autorise; if (!autorise) a.motif = 'Capacité actuelle refusée'; });
      const bouton = direct(a);
      eq(description(bouton)?.textContent, ATTENTE, `Motifs11.2 ${autorise} : attente annoncée sans reprendre ancien motif`);
      eq(bouton.disabled, true, `Motifs11.2 ${autorise} : attente reste désactivée`);
      attente.resoudre(); await terminee(a.pret);
      eq(bouton.disabled, !autorise, `Motifs11.2 ${autorise} : seule décision du descripteur règle éligibilité`);
      if (autorise) {
        eq(bouton.getAttribute('aria-describedby'), null, 'Motifs11.2 : description périmée retirée après autorisation');
        eq(bouton.getAttribute('title'), null, 'Motifs11.2 : title périmé retiré après autorisation');
        ok(!motif(bouton) || motif(bouton).hidden && motif(bouton).textContent === '', 'Motifs11.2 : texte périmé retiré même si descripteur garde ancien motif');
      } else {
        eq(description(bouton)?.textContent, a.motif, 'Motifs11.2 : motif refusé apparaît après vérification');
        eq(bouton.title, a.motif, 'Motifs11.2 : infobulle facultative suit le motif actuel');
      }
      clic(bouton); await Promise.resolve(); eq(executions, autorise ? 1 : 0, `Motifs11.2 ${autorise} : geste conserve autorisation métier`);
    });
    await run('vérification rejetée', async () => {
      const attente = differer(), a = action({ eligible: true, pret: attente.promesse }), bouton = direct(a);
      attente.rejeter(new Error('Lecture de fixture refusée')); await terminee(a.pret);
      eq(bouton.disabled, true, 'Motifs11.2 : rejet ne rend jamais action autorisée');
      eq(description(bouton)?.textContent, ECHEC, 'Motifs11.2 : rejet expliqué sans prétendre capacité connue');
      eq(bouton.title, ECHEC, 'Motifs11.2 : rejet remplace aussi infobulle');
    });
    await run('refus sans précision', async () => {
      const bouton = direct(action());
      eq(description(bouton)?.textContent, 'Cette action n’est pas disponible pour le moment.', 'Motifs11.2 : refus sans précision reste expliqué sans inventer sa cause');
      eq(bouton.disabled, true, 'Motifs11.2 : phrase de repli ne modifie pas éligibilité');
    });
    await run('occupation', async () => {
      const fin = differer(); let executions = 0;
      const bouton = direct(action({ eligible: true, executer: () => { executions++; return fin.promesse; } }));
      clic(bouton); clic(bouton);
      eq(bouton.disabled, true, 'Motifs11.2 : geste occupé reste désactivé');
      eq(bouton.getAttribute('aria-describedby'), null, 'Motifs11.2 : occupation seule ne fabrique aucun refus');
      eq(executions, 1, 'Motifs11.2 : double clic toujours une seule exécution');
      fin.resoudre({ issue: 'annule' }); await terminee(fin.promesse);
      eq(bouton.disabled, false, 'Motifs11.2 : fin du geste rétablit action autorisée');
    });
    await run('capacités réelles', () => withRepo(async (repo, db) => {
      const recipe = { id: 'motif-recette', original_title: 'Recette', availability: 'reference_only' }, edition = { id: 'motif-edition', book_id: 'motif-livre' };
      await db.mutate({ origin: 'remote', puts: { recipes: [recipe], book_editions: [edition], books: [{ id: edition.book_id, title: 'Livre' }], sync_state: [{ key: 'user_id', value: 'u1' }] } });
      const ctx = await getData(true), avant = await db.getAll('outbox');
      for (const a of [actionsRecette({ recipe, ctx }, { repo }).find(a => a.id === 'retirer'), actionsLivre({ edition, ctx }, { repo }).find(a => a.id === 'retirer-livre')]) {
        await a.pret; const bouton = direct(a); await terminee(a.pret);
        eq(a.eligible, false, `Motifs11.2 ${a.id} : vraie capacité absente refuse`);
        eq(description(bouton)?.textContent, a.motif, `Motifs11.2 ${a.id} : vrai motif de capacité visible`);
      }
      eq(await db.getAll('outbox'), avant, 'Motifs11.2 : lecture des capacités ne crée aucune commande');
    }));
    await run('anglais', async () => {
      setUiLocale('en'); const attente = differer(), a = action({ eligible: true, pret: attente.promesse }), bouton = direct(a);
      eq(description(bouton)?.textContent, 'Checking availability…', 'Motifs11.2 EN : attente traduite');
      attente.rejeter(new Error('fixture')); await terminee(a.pret);
      eq(description(bouton)?.textContent, 'Availability for this action could not be checked. Reopen this screen to try again.', 'Motifs11.2 EN : rejet traduit');
      eq(description(direct(action()))?.textContent, 'This action is currently unavailable.', 'Motifs11.2 EN : refus sans précision traduit');
    });
  } finally { setUiLocale(langue); }
}
