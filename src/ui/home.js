import { recetteActive } from '../domain/cycle-recette.js';
import { mentionCycleRecette } from './corbeille.js';
import { recettesActives, documentsActifs, recetteActiveDansContexte, editionsActives } from './state.js';
// Aujourd'hui : recherche, reprendre ma recette, Redécouvrir, favoris, dernières cuissons, ingrédients à utiliser (spec §17).
// Lot UI-1 « Carnet » (spec experience-carnet § 4.4, D-UI-5, D-UI-8) : pageHeader au-dessus de la barre (sur le papier, hors de toute carte), les puces
// d'exemple sous la barre ; « Favoris » et « Dernières cuissons » en grille de cartes-plat — UNE passe repo.getFiles sur les empreintes des cartes
// rendues, la carte ne lit rien elle-même (I-UI-5) ; la date et « Refaire comme la dernière fois » HORS du <a> de la carte (H-16) ; « Reprendre ma
// recette » et « À utiliser en priorité » en sectionPlain ; Redécouvrir (rediscoverCard) et « Bienvenue » ne changent que par le thème.
import { el, formatDate } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { emit } from '../core/bus.js';
import { pickSuggestion, snoozeUntil } from '../domain/rediscover.js';
import { parseQuery } from '../domain/search.js';
import { pointeurValide } from '../domain/photo-web.js';
import { comparerCuissons, photosPersonnellesParRecette } from '../domain/cuisine-personnelle.js';
import { empreintesPhotos, fichierPhoto, contexteFichiers } from './components.js';
import { recipeCard, section, sectionPlain, grilleCartes, pageHeader, emptyState, availabilityBadge, provenanceText, etoiles } from './components.js';
import { creerServiceCuisine } from '../domain/cuisine-persistance.js';
import { projeterSuiviMinuteur } from '../domain/cuisine-format.js';
import { getClockOffset } from '../sync/clock.js';
import { getSyncGeneration } from './state.js';
import { projeterLotInventaire } from '../domain/inventaire-persistance.js';
import { quantiteInventaire, dateLotInventaire } from './inventaire-texte.js';
import { jourRepas } from '../domain/repas-courses.js';
import { lignesImports } from '../domain/import-cible.js';
import { creerServiceBrouillons } from '../domain/brouillons-editeur.js';
import { creerDepotTraductions } from '../domain/depot-traductions.js';

const titreRepas = repas => repas.title || t('Repas sans titre');
const comparerTitres = (a, b) => (a.title || '').localeCompare(b.title || '') || a.id.localeCompare(b.id);
const comparerRepas = (a, b) => a.jour.localeCompare(b.jour)
  || (a.instant === null ? 0 : 1) - (b.instant === null ? 0 : 1)
  || (a.instant ?? 0) - (b.instant ?? 0) || comparerTitres(a.repas, b.repas);
function sectionAccueil(role, titre, ...contenu) {
  const section = sectionPlain(titre, ...contenu); section.dataset.role = role; return section;
}
const autreContexte = r => ['contexte_change', 'compte_change', 'bibliotheque_remplacee'].includes(r?.raison);
const avertissementBrouillons = () => el('p', { role: 'status', class: 'status warn' }, t('La liste des brouillons n’a pas pu être lue. Recharge cette page pour réessayer.'));
async function resumeBrouillons(ctx, depot, estCourante) {
  // Comme Ajouter, lire les deux dépôts sous leur portée ; aucun comptage de clés brutes.
  if (typeof depot.muterEditeur !== 'function') return null;
  try {
    const owner_id = Object.hasOwn(ctx, 'proprietaireDonnees') ? ctx.proprietaireDonnees : (await depot.get('sync_state', 'user_id'))?.value ?? null;
    const service = creerServiceBrouillons({ repo: depot, getGeneration: getSyncGeneration });
    const services = [service];
    if (typeof depot.muterTraductions === 'function') services.push(creerDepotTraductions({ repo: depot, getGeneration: getSyncGeneration }));
    const captures = await Promise.all(services.map(s => s.capturerPortee({ owner_id, estCourante })));
    if (!estCourante() || captures.some(autreContexte)) return null;
    const lectures = await Promise.all(services.map((s, i) => captures[i].issue === 'ok'
      ? s.listerBrouillons({ portee: captures[i].portee, inclureDetaches: true }) : captures[i]));
    if (!estCourante() || lectures.some(autreContexte)) return null;
    // Relire la portée après les résumés : base/génération seules ne voient pas un
    // remplacement durable du compte ou de la bibliothèque dans le même onglet.
    const finale = await service.capturerPortee({ owner_id, estCourante });
    if (!estCourante() || autreContexte(finale)) return null;
    if (finale.issue !== 'ok') return avertissementBrouillons();
    if (captures.some(c => c.issue === 'ok' && (c.portee.database_name !== finale.portee.database_name || c.portee.library_epoch !== finale.portee.library_epoch))) return null;
    const incomplet = lectures.some(r => r.issue !== 'ok');
    const nombre = lectures.reduce((n, r) => n + (r.issue === 'ok' ? r.brouillons.length : 0), 0);
    if (!nombre) return incomplet ? avertissementBrouillons() : null;
    return sectionAccueil('brouillons-accueil', t('Brouillons sur cet appareil'),
      incomplet ? avertissementBrouillons() : el('p', null, nombre === 1 ? t('1 brouillon') : t('{n} brouillons', { n: nombre })),
      el('a', { class: 'btn small', href: '#/add?section=brouillons' }, t('Voir les brouillons')));
  } catch { return estCourante() ? avertissementBrouillons() : null; }
}

// `deps.repo` : le sac injecté des routes (la suite y compte la passe getFiles) ; l'app ne passe rien (route('/', renderHome) : trois arguments) et le
// module sert. T5 ronde 1 : Redécouvrir écrit par ce MÊME sac (rediscoverCard), jamais par le module en dehors de lui.
const heureLocale = () => Date.now();
export async function renderHome(params, query, ctx, { repo: depot = repo, service: serviceInjecte, maintenant = heureLocale } = {}) {
  const root = el('div', null);
  let dispose = false; const generation = getSyncGeneration(), base = depot.db;
  const estCourante = () => !dispose && getSyncGeneration() === generation && depot.db === base;
  root.dispose = () => { dispose = true; };
  const input = el('input', { type: 'search', placeholder: t('Qu’est-ce qu’on cuisine ?'), 'aria-label': t('Recherche'), enterkeyhint: 'search' });
  const go = () => { if (input.value.trim()) navigate('/search' + buildQuery({ q: input.value.trim(), mode: 'all' })); else navigate('/search'); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.append(pageHeader(t('Qu’est-ce qu’on cuisine ?'), { subtitle: t('Cherche une recette, un ingrédient, une envie.') }),
    el('div', { class: 'recherche-accueil stack' },
      el('div', { class: 'search-bar' }, input, el('button', { class: 'btn primary', onClick: go }, t('Chercher'))),
      el('div', { class: 'chips' },
        ...['saumon fenouil', 'salade concombre sans gluten 15 minutes', 'soupe rapide', 'puttanesca'].map((ex) => el('span', { class: 'chip clickable', onClick: () => { input.value = ex; go(); } }, ex)))));

  // Reprendre ma recette
  const active = ctx.cook_sessions.filter((s) => s.status === 'active').sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const suivis = new Set(); let lectureSuivisImpossible = false;
  try {
    const minuteurs = await depot.all('timer_launches'), instantSuivis = maintenant() + (maintenant === heureLocale ? getClockOffset() : 0);
    for (const timer of minuteurs) if (timer.cook_session_id && projeterSuiviMinuteur(timer, instantSuivis).etat === 'en_cours') suivis.add(timer.cook_session_id);
  }
  catch { lectureSuivisImpossible = true; }
  const reprises = [...new Map([...active.slice(0, 3), ...ctx.cook_sessions.filter(s => suivis.has(s.id))].map(s => [s.id, s])).values()];
  if (reprises.length) {
    const service = serviceInjecte ?? creerServiceCuisine({ repo: depot, getGeneration: getSyncGeneration });
    const capture = await service.capturerPortee({ owner_id: ctx.proprietaireDonnees ?? null, estCourante });
    const cartes = await Promise.all(reprises.map(async s => {
      const lecture = capture.issue === 'ok' ? await service.lireSession({ portee: capture.portee, sessionId: s.id }) : null;
      const p = lecture?.issue === 'ok' ? lecture.projection : null;
      const entree = lecture?.affiche?.versions.find(v => v.version_id === p?.active_version_id);
      const recipe = entree?.recipe;
      const total = p?.total_steps ?? null, done = p?.done_count ?? 0;
      return el('a', { class: 'item-link card flat', href: `#/cook/${encodeURIComponent(s.id)}` },
        el('div', { class: 'row between' }, el('strong', null, recipe?.display_title || recipe?.original_title || t('Séance de cuisine')), el('span', { class: 'muted' }, total === null ? t('Progression partielle') : t('{d}/{n} étapes', { d: done, n: total }))),
        suivis.has(s.id) ? el('p', { class: 'muted' }, s.status === 'active' ? t('Un suivi de durée est encore en cours.') : t('Séance terminée · suivi de durée encore en cours.')) : null,
        total === null ? null : el('div', { class: 'progress', style: { marginTop: '.4rem' } }, el('div', { style: { width: total ? `${Math.min(100, Math.round(done / total * 100))}%` : '0%' } })));
    }));
    if (estCourante()) root.append(sectionPlain(t('Reprendre ma recette'), ...cartes));
  }
  if (lectureSuivisImpossible && estCourante()) root.append(el('p', { class: 'status warn' }, t('Les suivis de durée n’ont pas pu être relus. Ouvre ta séance pour réessayer.')));

  // Les repas et les courses suivent le jour civil local, sans inventer d'heure.
  const instantAccueil = maintenant(), jourAccueil = jourRepas({ serve_at: new Date(instantAccueil).toISOString() });
  const repasDates = (ctx.meals || []).filter(m => !m.archived_at).map(repas => ({ repas, jour: jourRepas(repas), instant: repas.serve_at ? Date.parse(repas.serve_at) : null })).filter(m => m.jour);
  const prochain = repasDates.filter(m => m.jour >= jourAccueil && (m.instant === null || m.instant >= instantAccueil)).sort(comparerRepas)[0];
  if (prochain && estCourante()) root.append(sectionAccueil('prochain-repas', t('Prochain repas'),
    el('a', { class: 'item-link card flat', href: `#/meals/${encodeURIComponent(prochain.repas.id)}` },
      el('strong', null, titreRepas(prochain.repas)), el('p', { class: 'muted' }, prochain.instant === null
        ? `${formatDate(prochain.jour)} · ${t('Heure non précisée')}` : formatDate(prochain.repas.serve_at, { withTime: true })))));
  const repasDuJour = new Map(repasDates.filter(m => m.jour === jourAccueil).map(m => [m.repas.id, m]));
  const listesDuJour = (ctx.shopping_lists || []).filter(l => repasDuJour.has(l.meal_id)).sort((a, b) => comparerRepas(repasDuJour.get(a.meal_id), repasDuJour.get(b.meal_id)) || comparerTitres(a, b));
  if (listesDuJour.length && estCourante()) root.append(sectionAccueil('courses-du-jour', t('Courses du jour'),
    ...listesDuJour.map(l => el('a', { class: 'item-link card flat', href: `#/lists/${encodeURIComponent(l.id)}` },
      el('strong', null, l.title || t('Courses')), el('p', { class: 'muted' }, titreRepas(repasDuJour.get(l.meal_id).repas))))));
  const brouillons = await resumeBrouillons(ctx, depot, estCourante);
  if (brouillons && estCourante()) root.append(brouillons);
  if (estCourante() && lignesImports(ctx).some(l => l.etat === 'echec' && l.raison === 'interrompu')) root.append(sectionAccueil('import-interrompu', t('Import interrompu'),
    el('a', { class: 'btn small', href: '#/add?section=imports' }, t('Voir les imports'))));

  // Redécouvrir
  if (ctx.settings.rediscover_enabled) root.append(await rediscoverCard(ctx, query, depot));

  // Favoris et Dernières cuissons (D-UI-5, F-3) : les docs à rendre d'abord, puis UNE lecture groupée des lignes files de leurs photos — la carte-plat
  // reçoit sa ligne et décide au rendu (I-UI-5) ; sans empreinte, aucune lecture. Un pointeur qui n'est pas une empreinte (pointeurValide, comme la
  // bibliothèque et la fiche livre) n'est ni lu ni passé. Les URL blob: sont celles d'urlDeBlob : révoquées au changement de route (D-T9).
  const favs = documentsActifs(ctx).filter((d) => d.recipe.favorite).slice(0, 6);
  const recent = [...ctx.cook_history].sort(comparerCuissons).slice(0, 4)
    .map((h) => ({ h, doc: ctx.docsByRecipe.get(h.recipe_id) })).filter((x) => x.doc); // une cuisson d'une fiche inconnue n'est pas rendue (comme avant)
  const photosPersonnelles = photosPersonnellesParRecette(ctx.cook_history);
  const ctxF = await contexteFichiers(ctx);
  const empreintes = empreintesPhotos([...favs, ...recent.map(x => x.doc)].map(d => d.recipe), photosPersonnelles);
  const fichiers = empreintes.length ? await depot.getFiles(empreintes) : new Map();
  const cartePlat = (d) => { const carte=recipeCard(d, { photoEnTete: true, fichier: fichierPhoto(d.recipe, photosPersonnelles, fichiers), ctxF }); if (!recetteActiveDansContexte(d.recipe, ctx)) {carte.querySelector('.carte-plat-actions')?.remove();carte.append(mentionCycleRecette(d.recipe, ctx.editionsById?.get(d.recipe.edition_id)));} return carte; };
  if (favs.length) root.append(sectionPlain(t('Favoris'), grilleCartes(favs.map(cartePlat))));

  // Dernières cuissons → Refaire comme la dernière fois : la date et le bouton HORS du <a> de la carte, sous elle, dans la cellule de grille (§ 4.4, H-16).
  if (recent.length) {
    root.append(sectionPlain(t('Dernières cuissons'), grilleCartes(recent.map(({ h, doc }) => el('div', { class: 'cellule-cuisson' },
      cartePlat(doc),
      el('div', { class: 'muted cuisson-date' }, `${formatDate(h.cooked_at)}${etoiles(h.rating) ? ` · ${etoiles(h.rating)}` : ''}${h.redo === false ? ` · ${t('à ne pas refaire')}` : ''}`),
      el('a', { class: 'btn small', href: `#/recipes/${encodeURIComponent(h.recipe_id)}${buildQuery({ v: h.recipe_version_id, servings: h.servings || '' })}` }, recetteActiveDansContexte(doc.recipe, ctx) ? t('Refaire comme la dernière fois') : t('Consulter cette cuisson')))))));
  }

  // Ingrédients à utiliser (inventaire)
  const jourLocal = d => `${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const instant = new Date(maintenant()), aujourdhui = jourLocal(instant), limite = new Date(instant);
  limite.setDate(limite.getDate()+4);
  const soon = ctx.inventory.map(lot => {
    const p = projeterLotInventaire({lot}, {aujourdhui}), date = p.dates.use_by;
    const ancienne = date.origine === 'legacy' ? new Date(date.valeur) : null;
    const jour = date.origine === 'civil' ? date.valeur : ancienne && Number.isFinite(ancienne.getTime()) ? jourLocal(ancienne) : null;
    return {p,date,jour};
  }).filter(x => x.p.etat !== 'finished' && x.jour && x.jour < jourLocal(limite)).sort((a,b) => a.jour.localeCompare(b.jour)).slice(0,5);
  if (soon.length) {
    root.append(sectionPlain(t('À utiliser en priorité'), el('ul', { class: 'list' }, ...soon.map(({p,date,jour}) => el('li', { class: 'row between' },
      el('span', null, `${p.label || t('Lot sans nom')} — ${quantiteInventaire(p)}`),
      el('span', { class: `chip ${jour < aujourdhui ? 'danger' : 'warn'}` }, `${t('à consommer avant le')} ${dateLotInventaire(date)}`)))),
      el('a', { class: 'btn small', href: '#/kitchen?tab=inventory' }, t('Voir l’inventaire'))));
  }

  if (!recettesActives(ctx).length) {
    root.append(section(t('Bienvenue'), el('p', null, t('Ta bibliothèque est vide. Commence par ajouter un livre, puis photographie sa table des matières ou une recette.')),
      el('div', { class: 'row' }, el('a', { class: 'btn primary', href: '#/add' }, t('Ajouter')), el('a', { class: 'btn', href: '#/settings' }, t('Restaurer une sauvegarde')))));
  }
  return root;
}

async function rediscoverCard(ctx, query, depot = repo) {
  const context = query.q ? parseQuery(query.q).filters : {};
  const s = pickSuggestion({ editions: editionsActives(ctx), books: ctx.books, recipes: recettesActives(ctx), activity: ctx.library_activity, prefs: ctx.rediscovery_prefs, context });
  if (!s) return el('div');
  const pref = ctx.rediscovery_prefs.find((p) => p.edition_id === s.edition.id) || { edition_id: s.edition.id };
  if (!pref.last_suggested_at || Date.now() - Date.parse(pref.last_suggested_at) > 86400000) {
    await depot.save('rediscovery_prefs', { ...pref, last_suggested_at: new Date().toISOString() });
  }
  const title = s.mode === 'rediscover'
    ? t('À redécouvrir : ce livre n’a pas été consulté dans Cuisine OS depuis {n} mois.', { n: s.months_since })
    : t('À explorer dans ta bibliothèque');
  const savePref = async (patch) => { await depot.save('rediscovery_prefs', { ...pref, ...patch }); emit('change', { store: 'rediscovery_prefs' }); refresh(); };
  return el('div', { class: 'card', style: { borderLeft: '4px solid var(--sage)' } },
    el('div', { class: 'muted', style: { fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.04em' } }, t('Redécouvrir')),
    el('h2', null, title),
    el('p', null, el('strong', null, s.book?.title || ''), s.book?.author ? ` — ${s.book.author}` : ''),
    s.recipe ? el('div', { class: 'card flat' },
      el('div', { class: 'row between' }, el('strong', null, s.recipe.display_title || s.recipe.original_title), availabilityBadge(s.recipe)),
      el('p', { class: 'muted', style: { fontSize: '.9rem' } }, s.reason)) : null,
    el('div', { class: 'row' },
      s.recipe ? el('a', { class: 'btn primary', href: `#/recipes/${s.recipe.id}` }, s.recipe.availability === 'reference_only' ? t('Voir la page du livre') : t('Voir la recette')) : null,
      el('button', { class: 'btn', onClick: () => refresh() }, t('Autre idée')),
      el('button', { class: 'btn', onClick: () => savePref({ snoozed_until: snoozeUntil(14) }) }, t('Plus tard')),
      el('button', { class: 'btn', onClick: () => savePref({ hidden: true }) }, t('Masquer ce livre'))));
}

export { emptyState, provenanceText };
