// Repères : données synthétiques, aucune requête assistant ni donnée personnelle.
export function sourceReperes() {
  return { recipe: { id: 'rep-recette', original_title: 'Soupe de tomates', availability: 'available' },
    version: { id: 'rep-version', recipe_id: 'rep-recette', servings: 2, ingredients: [{ source_text: '400 g de tomates', quantity: { value: 400 }, name_text: 'tomates', unit_id: 'g' }],
      steps: [{ id: 's1', text: 'Cuire les tomates pendant 15 minutes puis mixer.' }], prep_minutes: 5, cook_minutes: 15, active_minutes: 10, total_minutes: null } };
}
export function reponseReperes() {
  return { description_fr: { texte: 'Une soupe de tomates mixées.', references: [{ type: 'ingredient', index: 0, extrait: 'tomates' }] },
    difficulte: { niveau: 'facile', raison: 'Cuire puis mixer.', references: [{ type: 'etape', index: 0, extrait: 'puis mixer' }] },
    temps: { total: { min: 20, max: 25, origine: 'estimation_ia', complet: true }, actif: { min: 10, max: 10, origine: 'source' }, cuisson: null, attentes: null,
      attentes_incluses: true, explication: 'La préparation précède la cuisson et le mixage.', references: [{ type: 'etape', index: 0, extrait: '15 minutes' }, { type: 'duree', champ: 'active_minutes', extrait: '10' }] } };
}
const clone = (x) => JSON.parse(JSON.stringify(x));
export async function runVisuelReperesTests({ eq, ok }) {
  const R = await import('../src/domain/reperes.js');
  const { recipe, version } = sourceReperes(), contexte = R.construireContexteReperes({ recipe, version });
  const refus = (fn, raison, msg) => { let e; try { fn(); } catch (x) { e = x; } eq(e?.raison, raison, 'Repères : ' + msg); };
  const proposition = (ctx = contexte, raw = reponseReperes()) => R.fabriquerPropositionReperes({ contexte: ctx, resultat: R.validerReponseReperes(raw, ctx), modele: 'modele-test', maintenant: '2026-10-28T12:00:00.000Z' });
  const fiche = (raw = reponseReperes()) => ({ ...recipe, reperes: R.fusionnerReperes(null, { proposition: proposition(contexte, raw) }) });
  eq(contexte.source.ingredients, ['400 g de tomates'], 'Repères : références d’ingrédients stables');
  eq(contexte.source.etapes, [version.steps[0].text], 'Repères : étapes textuelles envoyées');
  const prives = R.construireContexteReperes({ recipe: { ...recipe, photo_sha256: 'photo', personal_notes: 'privé', favorite: true }, version: { ...version, notes: 'privé', status: 'tested', provenance: { secret: 'privé' } } });
  eq(prives.signature, contexte.signature, 'Repères : photos, notes et statut ne périment rien');
  ok(!JSON.stringify(prives).includes('privé'), 'Repères : données privées absentes');
  for (const patch of [{ servings: 4 }, { total_minutes: 30 }, { ingredients: [{ ...version.ingredients[0], quantity: { value: 800 } }] }, { steps: [{ ...version.steps[0], timers: [{ seconds: 60, label: 'Cuire' }] }] }, { incomplete: true }]) {
    ok(R.construireContexteReperes({ recipe, version: { ...version, ...patch } }).signature !== contexte.signature, 'Repères : changement culinaire périme la signature');
  }
  ok(R.construireContexteReperes({ recipe: { ...recipe, original_title: 'Autre soupe' }, version }).signature !== contexte.signature, 'Repères : changement de titre périme');
  const ordered = { ...version, ingredients: [{ unit_id: 'g', name_text: 'tomates', quantity: { value: 400 }, source_text: '400 g de tomates' }] };
  eq(R.construireContexteReperes({ recipe, version: ordered }).signature, contexte.signature, 'Repères : ordre des propriétés sans effet');
  refus(() => R.construireContexteReperes({ recipe, version: { ...version, recipe_id: 'étrangère' } }), 'source_etrangere', 'version étrangère refusée');
  refus(() => R.construireContexteReperes({ recipe, version: { ...version, steps: [{ text: 'a'.repeat(8001) }] } }), 'texte', 'contexte trop long refusé sans troncature');
  eq(R.validerReponseReperes({ description_fr: null, difficulte: null, temps: null }, contexte), { description_fr: null, difficulte: null, temps: null }, 'Repères : inconnus explicites');
  const reference = R.construireContexteReperes({ recipe: { ...recipe, availability: 'reference_only' }, version: null });
  eq(R.validerReponseReperes({ description_fr: { texte: 'Une soupe de tomates.', references: [{ type: 'titre', extrait: 'Soupe de tomates' }] }, difficulte: null, temps: null }, reference).temps, null, 'Repères : référence sans version descriptible sans durée inventée');
  refus(() => R.validerReponseReperes(reponseReperes(), reference), 'reference_inventee', 'description citant un ingrédient absent de la référence refusée');
  refus(() => R.validerReponseReperes({ ...reponseReperes(), description_fr: null }, reference), 'etapes_absentes', 'référence sans étapes ne reçoit pas de difficulté ni temps');
  for (const value of ['<b>Soupe</b>', 'Voir https://evil.test', 'Voir www.exemple.org', 'Voir exemple.xyz', 'ｈｔｔｐｓ：／／ｅｘｅｍｐｌｅ．ｘｙｚ', 'javascript:alert(1)', 'a'.repeat(401), 'Sans gluten garanti.']) {
    const raw = reponseReperes(); raw.description_fr.texte = value;
    refus(() => R.validerReponseReperes(raw, contexte), value.length > 400 ? 'texte' : 'texte_interdit', 'texte hostile ou non borné refusé');
  }
  const nuit = reponseReperes(); nuit.temps.attentes = { min: 720, max: 720, origine: 'estimation_ia' };
  refus(() => R.validerReponseReperes(nuit, contexte), 'total_incompatible', 'total complet incompatible avec une attente plus longue refusé');
  for (const [raison, change] of [
    ['structure', r => { r.url = 'intrus'; }],
    ['reference_inventee', r => { r.description_fr.references[0].index = 1; }],
    ['reference_inventee', r => { r.description_fr.references[0].extrait = 'carottes'; }],
    ['niveau', r => { r.difficulte.niveau = 'expert'; }],
    ['plage', r => { r.temps.total.max = 19; }],
    ...[-1, Infinity, 43201, 20.5].map(n => ['minutes', r => { r.temps.total[n === -1 ? 'min' : 'max'] = n; }]),
    ['duree_non_sourcee', r => { r.temps.actif.min = 40; r.temps.actif.max = 40; }],
    ['actif_incompatible', r => { r.temps.actif = { min: 40, max: 40, origine: 'estimation_ia' }; }],
    ['duree_non_sourcee', r => { r.temps.total.origine = 'source'; }],
    ['duree_non_sourcee', r => { r.temps.actif.min = 9; r.temps.actif.max = 9; }],
    ['duree_non_sourcee', r => { r.temps.total.min = 0; }],
    ['attentes', r => { r.temps.attentes_incluses = false; }],
  ]) {
    const raw = reponseReperes(); change(raw); refus(() => R.validerReponseReperes(raw, contexte), raison, 'réponse incohérente ou référence fabriquée refusée : ' + raison);
  }
  const known = R.lireReperes(fiche(), version);
  eq(known.description_fr, 'Une soupe de tomates mixées.', 'Repères : description française relue');
  eq([known.champs.description_fr.origine, known.temps.actif.origine], ['estimation_ia', 'source'], 'Repères : origine par champ');
  eq(known.rapide, true, 'Repères : rapide si borne haute complète ≤ 30');
  for (const change of [r => { r.temps.total.max = 40; }, r => { r.temps.total.complet = false; }, r => { r.temps.total = null; }]) {
    const raw = reponseReperes(); change(raw); eq(R.lireReperes(fiche(raw), version).rapide, false, 'Repères : fourchette longue, total incomplet ou inconnu jamais rapide');
  }
  eq(R.lireReperes({ ...fiche(), availability: 'partial' }, version).rapide, false, 'Repères : recette partielle jamais rapide');
  const videVersion = { ...version, steps: [{ text: '' }] }, videContexte = R.construireContexteReperes({ recipe, version: videVersion });
  const videFiche = { ...recipe, reperes: R.fusionnerReperes(null, { corrections: R.fabriquerCorrectionsReperes({ temps: { ...reponseReperes().temps, references: [] } }, videContexte) }) };
  const correction = R.fabriquerCorrectionsReperes({ description_fr: null, temps: { ...reponseReperes().temps, total: { min: 30, max: 30, origine: 'manuel', complet: true } } }, contexte, '2026-10-28T13:00:00.000Z');
  const corrigee = { ...fiche(), reperes: R.fusionnerReperes(fiche().reperes, { corrections: correction }) };
  eq(R.lireReperes(corrigee, version).description_fr, null, 'Repères : effacer ne révèle pas la proposition');
  eq(R.lireReperes(corrigee, version).temps.total.origine, 'manuel', 'Repères : origine manuelle conservée');
  const nouvelleVersion = { ...version, id: 'rep-version-b', steps: [{ text: 'Cuire les tomates pendant 15 minutes puis mixer. Laisser reposer une nuit.' }] };
  const contexteB = R.construireContexteReperes({ recipe, version: nouvelleVersion });
  const actualisee = { ...corrigee, reperes: R.fusionnerReperes(corrigee.reperes, { proposition: proposition(contexteB) }) };
  const luB = R.lireReperes(actualisee, nouvelleVersion);
  eq([luB.temps.total.max, luB.rapide, luB.champs.temps.etat], [25, true, 'courant'], 'Repères : nouvelle analyse B utilise ses propres repères sans reprendre la correction A');
  eq(R.lireReperes(actualisee, version).champs.temps.valeur.total.max, 30, 'Repères : ancienne correction A reste éditable sur A');
  eq(R.lireReperes(fiche(), nouvelleVersion).difficulte, null, 'Repères : autre version n’emprunte pas le niveau');
  const corrompue = clone(fiche()); corrompue.reperes.proposition.temps.total.max = 1e9;
  eq(R.lireReperes(corrompue, version).temps, null, 'Repères : revalidation après restauration');
  eq(R.lireReperes({ ...recipe, reperes: { revision: 999 } }, version).description_fr, null, 'Repères : enveloppe inconnue non affichée');
  eq(R.lireTemps(recipe, version).total, null, 'Repères : préparation + cuisson ne devient pas total');
  eq(R.lireTemps(recipe, { ...version, active_minutes: null }).actif, null, 'Repères : préparation ne devient pas actif');
  eq(R.lireTemps(recipe, { ...version, total_minutes: 20 }).total.complet, false, 'Repères : total ancien non certifié complet');
  eq(R.lireTemps(corrigee, nouvelleVersion).total, null, 'Repères : ancien total ne masque pas une correction périmée');
  const creation = { ...version, kind: 'synthesis', provenance: { generated_by: 'ai', creation: { minutes_estimees: 20 } }, total_minutes: 20 };
  eq(R.lireTemps(recipe, creation).total, null, 'Repères : ancienne création IA sans durée certaine');
  eq(R.construireContexteReperes({ recipe, version: creation }).source.durees.total_minutes, null, 'Repères : total hérité d’une création IA non envoyé comme source certaine');
  const tm = { ...version, total_minutes: 20, provenance: { thermomix: {} } };
  eq(R.lireTemps(recipe, tm).total, null, 'Repères : ancien plan TM7 sans durée globale certaine');
  refus(() => R.fabriquerCorrectionsReperes({ temps: reponseReperes().temps }, reference), 'etapes_absentes', 'référence sans version ne reçoit pas de temps manuel');
  refus(() => R.fabriquerCorrectionsReperes({ difficulte: reponseReperes().difficulte }, reference), 'etapes_absentes', 'référence sans version ne reçoit pas de difficulté manuelle');
  const { buildDocs, searchDocs, parseQuery } = await import('../src/domain/search.js');
  const documents = (recipes, versions) => buildDocs({ recipes, versions, books: [], editions: [], dishes: [], links: [], translations: [], history: [] });
  const docs = documents([fiche()], [version]);
  eq(searchDocs(docs, parseQuery('rapide'), {}).admissible.length, 1, 'Repères : recherche rapide avec même lecteur');
  eq(searchDocs(documents([recipe], [version]), parseQuery('rapide'), {}).time_unknown.length, 1, 'Repères : somme ancienne ne passe pas un filtre de temps');
  eq(searchDocs(documents([actualisee], [nouvelleVersion]), parseQuery('rapide'), {}).admissible.length, 1, 'Repères : le filtre rapide utilise la proposition B liée à B');
  eq(searchDocs(documents([videFiche], [videVersion]), parseQuery('rapide'), {}).time_unknown.length, 1, 'Repères : mêmes critères de recette renseignée dans recherche et badge');
  const { summarizeMeal } = await import('../src/domain/pairing.js');
  const repas = summarizeMeal([{ recipe: fiche(), version, title: 'Soupe' }, { title: 'Référence', version: null }]);
  eq(repas.unknown, ['Référence'], 'Repères : inconnue à sa vraie position dans un repas');
  eq([repas.estimate, repas.activeSum], [null, null], 'Repères : repas incomplet sans total ni actif fabriqué');
  const complet = summarizeMeal([{ recipe: fiche(), version, title: 'Soupe' }]);
  eq(complet.estimate, { low: 20, high: 25 }, 'Repères : fourchette du repas conservée');
  ok(complet.notes.some(x => x.includes('estim')), 'Repères : résumé garde son origine estimée');
  const { toJsonLd, toPaprikaYaml, toReadableSite } = await import('../src/domain/exporters.js');
  const bundle = { recipe: fiche(), version };
  eq(toJsonLd(bundle).totalTime, undefined, 'Repères : estimation jamais convertie en durée JSON-LD exacte');
  ok(toJsonLd(bundle).description.includes('20–25') && toJsonLd(bundle).description.toLowerCase().includes('estim'), 'Repères : estimation annotée dans JSON-LD');
  ok(toPaprikaYaml([bundle]).includes('20–25'), 'Repères : annotations Paprika');
  ok(toReadableSite([bundle], new Map()).entries[1].data.includes('20–25'), 'Repères : annotations HTML lisible');
  ok(!JSON.stringify(toJsonLd({ recipe: actualisee, version: nouvelleVersion })).includes('Total : 30'), 'Repères : temps périmé absent des exports');
  eq(version.total_minutes, null, 'Repères : version culinaire inchangée');
  const T = await import('../src/domain/thermomix.js'), fixtures = await import('./i3-thermomix.js');
  const sourceTM = fixtures.sourceThermomix(), contexteTM = T.construireContexteThermomix({ version: sourceTM, selection: ['s1'] });
  let seq = 0;
  const versionTM = T.fabriquerVersionThermomix({ source: sourceTM, contexte: contexteTM, resultat: fixtures.propositionThermomix(), id: 'reperes-tm', newId: () => 'reperes-etape-' + (++seq), maintenant: '2026-10-28T12:00:00Z', modele: 'fixture' });
  const recetteTM = { id: sourceTM.recipe_id, original_title: 'Sauce aux tomates', availability: 'available' }, avantTM = JSON.stringify(versionTM);
  const ctxTM = R.construireContexteReperes({ recipe: recetteTM, version: versionTM });
  const repTM = { ...recetteTM, reperes: R.fusionnerReperes(null, { corrections: R.fabriquerCorrectionsReperes({ temps: { ...reponseReperes().temps, references: [] } }, ctxTM) }) };
  eq(R.lireReperes(repTM, versionTM).temps.total.origine, 'manuel', 'Repères : temps de présentation sur une adaptation TM7');
  eq(JSON.stringify(versionTM), avantTM, 'Repères : plan, signature, étapes et durées I3 inchangés');
  eq(T.gardeThermomix(versionTM).ok, true, 'Repères : plan I3 toujours lisible');
  eq([toJsonLd({ recipe: repTM, version: versionTM }).totalTime, toJsonLd({ recipe: repTM, version: versionTM }).cookTime], [undefined, undefined], 'Repères : I3 ne reçoit aucune durée structurée globale');
  const manuelNul = { ...recipe, reperes: R.fusionnerReperes(fiche().reperes, { corrections: R.fabriquerCorrectionsReperes({ temps: null }, contexte) }) };
  eq([R.lireTemps(manuelNul, version).total, R.lireTemps(manuelNul, version).actif], [null, null], 'Repères : effacement total masque également le temps actif historique');
  eq([toJsonLd({ recipe: manuelNul, version }).totalTime, toJsonLd({ recipe: manuelNul, version }).cookTime], [undefined, undefined], 'Repères : export respecte les durées explicitement effacées');
  const ancienneInvalide = { recipe, version: { ...version, prep_minutes: '15', cook_minutes: 999999, total_minutes: 20.5 } };
  const exportAncien = toJsonLd(ancienneInvalide);
  eq([exportAncien.prepTime, exportAncien.cookTime, exportAncien.totalTime], [undefined, undefined, undefined], 'Repères : anciens temps hors contrat omis du JSON-LD sans arrondi');
  ok(!toPaprikaYaml([ancienneInvalide]).includes('prep_time:') && !toPaprikaYaml([ancienneInvalide]).includes('cook_time:'), 'Repères : anciens temps hors contrat omis de Paprika');
  ok(!toReadableSite([ancienneInvalide], new Map()).entries[1].data.includes('999999'), 'Repères : ancienne durée énorme absente du HTML');
  eq(toJsonLd({ recipe, version: { ...version, total_minutes: 43200 } }).totalTime, 'PT720H', 'Repères : borne de trente jours exportable sans troncature');
  eq(toJsonLd({ recipe, version: { ...version, total_minutes: 0 } }).totalTime, 'PT0M', 'Repères : zéro explicite garde une durée ISO valide');
}
