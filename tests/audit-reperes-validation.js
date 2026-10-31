import * as R from '../src/domain/reperes.js';
import { sourceReperes } from './visuel-reperes.js';
const vide = () => ({ total: null, actif: null, cuisson: null, attentes: null, attentes_incluses: null, explication: '', references: [] });
const reponse = temps => ({ description_fr: null, difficulte: null, temps });
const lire = fn => { try { return { valeur: fn() }; } catch (e) { return { raison: e.raison }; } };
function casDuree(texte, min, max = min, champ = 'cuisson', patch = {}) {
  const f = sourceReperes(), version = { ...f.version, ...patch, steps: [{ id: 'etape', text: texte }] };
  const contexte = R.construireContexteReperes({ recipe: f.recipe, version });
  const valeur = { min, max, origine: 'source', ...(champ === 'total' ? { complet: false } : {}) };
  return { contexte, valeur, raw: reponse({ ...vide(), [champ]: valeur, references: [{ type: 'etape', index: 0, extrait: texte }] }) };
}
export async function runAuditReperesValidationTests({ eq }) {
  const accepte = (texte, min, max = min, champ = 'cuisson') => {
    const c = casDuree(texte, min, max, champ), r = lire(() => R.validerReponseReperes(c.raw, c.contexte));
    eq(r.valeur?.temps[champ] ?? r.raison, c.valeur, `Repères10.6 : durée entière source ${texte} → ${min}–${max}`);
  };
  const refuseDuree = (texte, min, max = min, champ = 'cuisson', patch) => {
    const c = casDuree(texte, min, max, champ, patch);
    eq(lire(() => R.validerReponseReperes(c.raw, c.contexte)).raison, 'duree_non_sourcee', `Repères10.6 : aucune durée fabriquée ${texte} → ${champ} ${min}–${max}`);
  };
  for (const verbe of ['Mijoter', 'Mijotez', 'Enfourner', 'Enfournez']) {
    accepte(`${verbe} pendant 20 minutes.`, 20);
    accepte(`${verbe} de 20 à 25 min.`, 20, 25);
  }
  for (const texte of ['Cuire 20–25 min.', 'Cuire 20 min à 25 min.', 'Cuire 1 h à 2 h.', 'Cuire 1 heure à 90 minutes.']) {
    const [min, max] = texte.includes('1 h') ? [60, texte.includes('90') ? 90 : 120] : [20, 25]; accepte(texte, min, max);
  }
  for (const texte of ['Cuire 1 h 30.', 'Cuire 1h30 min.', 'Cuire 1 h 30 min.', 'Cuire 1 h 30 à 180 °C.', 'Laisser reposer 1 h 30.']) {
    const champ = texte.startsWith('Laisser') ? 'attentes' : 'cuisson'; accepte(texte, 90, 90, champ); refuseDuree(texte, 60, 60, champ); refuseDuree(texte, 30, 30, champ);
  }
  accepte('Cuire 1 h 60 min.', 120); accepte('Cuire 1 h 99 min.', 159);
  for (const n of [20, 25]) refuseDuree('Mijoter 20 à 25 minutes.', n);
  for (const texte of ['Cuire 1 h puis ajouter 30 g.', 'Cuire 1 h 30 g.', 'Cuire 1 h 30 °C.', 'Cuire 1 h 30 secondes.', 'Cuire 1 h 30,5 min.', 'Cuire 1 h 30 à 45 min.']) refuseDuree(texte, 90);
  refuseDuree('Cuire 1 h 60.', 120); refuseDuree('Cuire 1 h 99.', 159);
  // Une plage composée ne se transforme pas en borne exacte, même si cette syntaxe reste prudente.
  refuseDuree('Cuire 1 h 30 à 2 h.', 60); refuseDuree('Cuire 1 h 30 à 2 h.', 90); refuseDuree('Cuire 1 h 30 à 2 h.', 120);
  accepte('Cuire 1 h puis ajouter 30 g.', 60); accepte('Cuire 1 h 30 g.', 60);
  for (const champ of ['actif', 'total']) refuseDuree('Cuire 1 h 30.', 90, 90, champ);
  refuseDuree('Cuire 1 h 30.', 90, 90, 'cuisson', { kind: 'synthesis', provenance: { generated_by: 'ai', creation: { minutes_estimees: 90 } } });

  const f = sourceReperes(), contextes = [
    ['avec étapes', R.construireContexteReperes(f)],
    ['étapes vides', R.construireContexteReperes({ ...f, version: { ...f.version, steps: [] } })],
    ['sans version', R.construireContexteReperes({ recipe: { ...f.recipe, availability: 'reference_only' } })],
  ];
  for (const [nom, contexte] of contextes) {
    const inconnu = vide(), r = lire(() => R.validerReponseReperes(reponse(inconnu), contexte));
    eq(r.valeur?.temps ?? r.raison, inconnu, `Repères10.6 : temps explicitement inconnus admis ${nom}`);
    const manuel = lire(() => R.fabriquerCorrectionsReperes({ temps: inconnu }, contexte));
    eq(manuel.valeur?.temps.valeur ?? manuel.raison, inconnu, `Repères10.6 : inconnu manuel sans durée inventée ${nom}`);
  }
  const contexte = contextes[0][1];
  for (const [nom, changer, raison] of [
    ['références null', v => { v.references = null; }, 'limite'],
    ['références absentes', v => { delete v.references; }, 'structure'],
    ['références non tableau', v => { v.references = {}; }, 'limite'],
    ['référence inventée', v => { v.references = [{ type: 'titre', extrait: 'Source inventée' }]; }, 'reference_inventee'],
    ['propriété inconnue', v => { v.inconnue = true; }, 'structure'],
    ['durée absente', v => { delete v.cuisson; }, 'structure'],
    ['attentes incluses mal typées', v => { v.attentes_incluses = 'oui'; }, 'attentes'],
    ['explication hostile', v => { v.explication = '<b>Texte</b>'; }, 'texte_interdit'],
    ['durée connue sans référence', v => { v.cuisson = { min: 20, max: 20, origine: 'estimation_ia' }; v.explication = 'Estimation.'; }, 'references'],
  ]) {
    const v = vide(); changer(v);
    eq(lire(() => R.validerReponseReperes(reponse(v), contexte)).raison, raison, `Repères10.6 : inconnu ne blanchit pas ${nom}`);
  }
  const sourcee = { ...vide(), references: [{ type: 'titre', extrait: f.recipe.original_title }] };
  eq(lire(() => R.validerReponseReperes(reponse(sourcee), contexte)).valeur?.temps, sourcee, 'Repères10.6 : référence fournie et valable reste conservée pour des inconnus');
  for (const [nom, c] of contextes.slice(1)) {
    const connu = { ...vide(), cuisson: { min: 20, max: 20, origine: 'estimation_ia' }, explication: 'Estimation.' };
    eq(lire(() => R.validerReponseReperes(reponse(connu), c)).raison, 'etapes_absentes', `Repères10.6 : durée connue reste interdite ${nom}`);
  }
  const sansRefs = vide(); delete sansRefs.references;
  eq(lire(() => R.fabriquerCorrectionsReperes({ temps: sansRefs }, contexte)).valeur?.temps.valeur.references, [], 'Repères10.6 : défaut manuel historique des références inchangé');

  const vegetarien = R.construireContexteReperes({ ...f, recipe: { ...f.recipe, original_title: 'Chili végétarien' } });
  for (const texte of ['Chili végétarien.', 'Un plat végétarien à partager.']) {
    const raw = { ...reponse(null), description_fr: { texte, references: [{ type: 'titre', extrait: 'Chili végétarien' }] } };
    eq(lire(() => R.validerReponseReperes(raw, vegetarien)).valeur?.description_fr.texte, texte, 'Repères10.6 : végétarien ordinaire admis dans la réponse');
    eq(lire(() => R.fabriquerCorrectionsReperes({ description_fr: { texte } }, vegetarien)).valeur?.description_fr.valeur.texte, texte, 'Repères10.6 : végétarien ordinaire admis en correction manuelle');
  }
  for (const texte of ['Végétarien garanti.', 'Sans gluten garanti.', 'Voir exemple.io', '<b>Végétarien</b>', 'Un plat végétalien.', 'Un plat vegan.']) {
    eq(lire(() => R.validerReponseReperes({ ...reponse(null), description_fr: { texte, references: [{ type: 'titre', extrait: 'Chili végétarien' }] } }, vegetarien)).raison, 'texte_interdit', 'Repères10.6 : autre filtre préservé ' + texte);
  }
}
