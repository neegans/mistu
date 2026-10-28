// Bibliothèque (lot UI-1, D-UI-4) : trois segments — Recettes (la grille des cartes-plat, par défaut), Livres (grille de couvertures, « Liens web gardés »,
// « Recettes créées avec l’IA »), Plats — et la liste « à importer » (?tab=a-importer : segment Recettes actif, retour « ← Recettes »). Les adresses
// ?tab=books et ?tab=dishes d'avant restent valides (dish.js:35 y revient) ; un ?tab inconnu vaut Recettes. Vue Plats : spec §17, §30, §32.
import { el, promptDialog, toast } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { navigate, buildQuery, refresh } from '../core/router.js';
import * as repo from '../model/repo.js';
import { pageHeader, bookCover, segmented, emptyState, section, sectionPlain, recipeCard, grilleCartes, remplacerEnRevoquant, suivreLargeurAuMontage, aUneAdresse, pageAffichable } from './components.js';
import { revoquerUrlDeBlob } from '../core/blob-urls.js';
import { proposeDishesForRecipe } from '../domain/dishes.js';
import { pointeurValide } from '../domain/photo-web.js';
import { logError } from '../core/log.js';
import { icone } from './icones.js';
import { photosPersonnellesParRecette } from '../domain/cuisine-personnelle.js';
import { empreintesPhotos, fichierPhoto } from './components.js';

const TABS = ['recettes', 'books', 'dishes', 'a-importer'];
export const CARTES_PAR_PAGE = 60; // F-9 : la grille est bornée ; « Voir plus » rend la page suivante
// UNE définition de « une adresse » (D-UI-10) : components.js la porte depuis la ronde 1 de T5 (le badge la lit aussi) ; elle est ré-exportée ici, où la fiche
// livre (book.js) lit aussi « à importer » (T4-R1).
export { aUneAdresse };
// B-I-5 : la grille montre les recettes CONSERVÉES et les signets (lus ou non) ; une référence d'index sans adresse est « à importer », pas une recette.
export const dansLaGrille = (r) => r.availability !== 'reference_only' || aUneAdresse(r);
// La liste « à importer » et son pied : les références sans adresse d'un livre (le pied n'est offert que s'il y en a : rien d'inventé).
export const estAImporter = (r) => r.availability === 'reference_only' && !aUneAdresse(r) && !!r.edition_id;
// Puces Toutes / De mes livres / Du web, calculées sur les DONNÉES (edition_id, source_url) : une fiche qui a les deux est dans les deux (B-M-7).
// Un filtre de données, jamais un appel : le segment « Web » de la RECHERCHE reste l'appel payant (I-UI-1).
export const passeLaPuce = (r, puce) => puce === 'toutes' || (puce === 'livres' ? !!r.edition_id : aUneAdresse(r));
// « Le plus récent d'abord » sur des champs de date (le premier présent gagne), sans horodatage en dernier : UNE fabrique pour les deux ordres de la page
// (la grille ; « Liens web gardés » et « Recettes créées avec l’IA »).
const plusRecentDabord = (...champs) => { const quand = (r) => String(champs.map((c) => r?.[c]).find(Boolean) || ''); return (a, b) => (quand(a) < quand(b) ? 1 : quand(a) > quand(b) ? -1 : 0); };
// Tri de la grille : dernière modification d'abord (§ 13, point 5), updated_at puis created_at en repli, sans horodatage en dernier.
const parModification = plusRecentDabord('updated_at', 'created_at');
const derniereModificationDabord = (a, b) => parModification(a.recipe, b.recipe);
// Le filtre local (même mécanique que celui des livres, booksTab) : titre, ingrédients de la version courante, titre du livre — calculé une fois par doc.
const meule = (d) => [d.recipe.original_title, d.recipe.display_title, d.book?.title, ...(d.version?.ingredients || []).map((ri) => ri.name_text || ri.source_text)].filter(Boolean).join(' ').toLowerCase();
// Ordre de la liste « à importer » (celui de la fiche du livre) : page imprimée, puis titre.
const parPageEtTitre = (a, b) => (a.printed_page ?? 99999) - (b.printed_page ?? 99999) || String(a.original_title || '').localeCompare(String(b.original_title || ''));

export async function renderLibrary(params, query, ctx, deps = {}) {
  const { matchMedia = (q) => window.matchMedia(q) } = deps;
  const tab = TABS.includes(query.tab) ? query.tab : 'recettes';
  const segment = tab === 'a-importer' ? 'recettes' : tab;
  // L'action d'en-tête suit le segment : « Ajouter une recette » sur Recettes, « Ajouter un livre » sur Livres (→ #/add/livre, H-15), rien sur Plats.
  const actions = segment === 'books' ? [el('a', { class: 'btn primary', href: '#/add/livre' }, t('Ajouter un livre'))]
    : segment === 'recettes' ? [el('a', { class: 'btn primary', href: '#/add' }, icone('plus'), t('Ajouter une recette'))] : [];
  const root = el('div', null,
    pageHeader(t('Bibliothèque'), { subtitle: t('Tes livres, tes trouvailles, tes recettes.'), actions, back: tab === 'a-importer' ? { href: '/library?tab=recettes', label: t('Recettes') } : null }),
    el('div', { style: { marginBottom: '1rem' } }, onglets(segmented([{ value: 'recettes', label: t('Recettes') }, { value: 'books', label: t('Livres') }, { value: 'dishes', label: t('Plats') }], segment, (v) => navigate('/library' + buildQuery({ tab: v }))))));
  if (tab === 'dishes') root.append(await dishesTab(ctx));
  else if (tab === 'books') {
    root.append(await booksTab(ctx));
    // APRÈS booksTab, y compris quand il rend l'état vide : sous Livres, un signet sans livre n'a pas d'autre place (confort après preuve, 17 octobre).
    // Depuis D-UI-4, il est aussi une carte de la grille Recettes, où ramène désormais le « ← Bibliothèque » de sa fiche (#/library). D-UI-8 : sections PLAIN.
    const liens = liensWebGardes(ctx);
    if (liens) root.append(liens);
    const creees = recettesCreeesIA(ctx); // N-7 : après « Liens web gardés »
    if (creees) root.append(creees);
  } else if (tab === 'a-importer') root.append(aImporterTab(ctx));
  else root.append(await recettesTab(ctx, { matchMedia }));
  return root;
}

// Le segment Recettes (§ 4.1 ; D-UI-4, D-UI-5, F-9) : le filtre local, les puces de source, la grille BORNÉE de cartes-plat, « Voir plus », le bouton
// « Ajouter une recette » répété sous 760 px, le pied « à importer ». Rien n'est écrit ; rien ne part.
async function recettesTab(ctx, { matchMedia }) {
  const photosPersonnelles = photosPersonnellesParRecette(ctx.cook_history);
  const docs = (ctx.docs || []).filter((d) => dansLaGrille(d.recipe)).sort(derniereModificationDabord);
  const refs = (ctx.recipes || []).filter(estAImporter);
  const pied = refs.length ? el('p', { style: { marginTop: '1rem' } }, el('a', { href: '#/library?tab=a-importer', dataset: { role: 'a-importer' } }, `${t('Recettes de mes livres à importer')} →`)) : null;
  if (!docs.length) return el('div', null, emptyState('assiette', t('Aucune recette pour l’instant.'), el('a', { class: 'btn primary', href: '#/add' }, t('Ajouter une recette'))), pied);
  const meules = new Map(docs.map((d) => [d.recipe.id, meule(d)]));
  const etat = { puce: 'toutes', limite: CARTES_PAR_PAGE };
  // F-9 : les lignes files des cartes RENDUES, lues en UNE fois par page (repo.getFiles) et gardées — un redessin (filtre, puce) ne relit rien, « Voir
  // plus » ne lit que les empreintes qu'il découvre ; jamais toute la bibliothèque d'un coup. Une empreinte sans ligne vaut null (lue, absente). La carte,
  // elle, ne lit rien (I-UI-5) : elle reçoit sa ligne.
  const fichiers = new Map();
  const lire = async (page) => {
    const empreintes = empreintesPhotos(page.map(d => d.recipe), photosPersonnelles).filter(s => !fichiers.has(s));
    if (!empreintes.length) return;
    const lues = await repo.getFiles(empreintes);
    for (const s of empreintes) fichiers.set(s, lues.get(s) || null);
  };
  const filtre = el('input', { type: 'search', placeholder: t('Une recette, un ingrédient…'), 'aria-label': t('Une recette, un ingrédient…') });
  const puces = el('div', { class: 'puces' });
  const grille = grilleCartes([]);
  const suite = el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '1rem' } });
  const visibles = () => { const q = filtre.value.trim().toLowerCase(); return docs.filter((d) => passeLaPuce(d.recipe, etat.puce) && (!q || meules.get(d.recipe.id).includes(q))); };
  // Un redessin qui attend une lecture de files peut finir APRÈS un redessin plus récent (une frappe de plus, une autre puce) : seul le dernier parti rend
  // (génération) ; le périmé garde ce qu'il a lu dans `fichiers` et ne touche pas la grille.
  let generation = 0;
  const redessiner = async () => {
    const g = ++generation;
    const liste = visibles();
    const page = liste.slice(0, etat.limite);
    await lire(page);
    if (g !== generation) return;
    // D-T9 : les URL blob: des vignettes de la génération précédente sont révoquées APRÈS le remplacement des nœuds (remplacerEnRevoquant relève img.plat-vignette).
    // Vague finale (constat 4) : un filtre ou une puce qui ne retient rien le DIT, sur toute la largeur de la grille (comme « Aucun livre ne correspond. » sous Livres).
    remplacerEnRevoquant(grille, ...(liste.length ? page.map((d) => recipeCard(d, { photoEnTete: true, fichier: fichierPhoto(d.recipe, photosPersonnelles, fichiers) }))
      : [el('p', { class: 'muted', dataset: { role: 'aucune-correspondance' }, style: { gridColumn: '1 / -1' } }, t('Aucune recette ne correspond.'))]));
    suite.replaceChildren(...(liste.length > page.length ? [el('button', { type: 'button', class: 'btn', onClick: () => { etat.limite += CARTES_PAR_PAGE; relancer(); } }, t('Voir plus'))] : []));
  };
  // Un redessin lancé par un geste n'est attendu par personne : une lecture de files refusée (base fermée, erreur IndexedDB) est journalisée, jamais un rejet
  // non géré (ronde 1) ; la grille garde alors ce qu'elle montrait.
  const relancer = () => { redessiner().catch((error) => logError('library.redessin', { error })); };
  for (const [valeur, libelle] of [['toutes', t('Toutes')], ['livres', t('De mes livres')], ['web', t('Du web')]]) {
    puces.append(el('button', { type: 'button', class: 'puce', 'aria-pressed': String(valeur === etat.puce), dataset: { puce: valeur }, onClick: () => {
      etat.puce = valeur; etat.limite = CARTES_PAR_PAGE;
      for (const b of puces.children) b.setAttribute('aria-pressed', String(b.dataset.puce === valeur));
      relancer();
    } }, libelle));
  }
  filtre.addEventListener('input', () => { etat.limite = CARTES_PAR_PAGE; relancer(); });
  await redessiner();
  // Fidélité aux maquettes (28 octobre 2026) : le champ (loupe au trait) et les filtres sur UNE rangée dès qu'il y a la place (flex-wrap : empilés sur l'iPhone).
  return el('div', null, el('div', { class: 'filtre-recettes' }, el('label', { class: 'champ-recherche' }, icone('loupe'), filtre), puces), grille, suite, boutonMobile(matchMedia), pied);
}

// Sous 760 px, l'action d'en-tête est répétée pleine largeur sous la grille (maquette mobile 01) ; au-dessus, [hidden] (T-9 ; aucun display:none neuf : T-1).
// La marge est portée par le bouton lui-même : caché, il ne laisse aucune bande vide. La largeur est lue par matchMedia (injectable : deps.matchMedia) et
// suivie sur `change` par AU PLUS UN écouteur dans toute l'app (ronde 1) : l'abonnement attend le MONTAGE — un rendu jamais monté (navigation plus récente,
// rendu qui lève) ne s'abonne pas —, relit la largeur à cet instant (un change reçu entre le rendu et le montage n'est pas perdu, D-T2-b) et retire
// l'écouteur du rendu monté précédent ; celui d'un rendu détaché (route quittée) se retire aussi au premier change. Depuis T4-R1, le motif est UNE aide
// partagée avec la fiche recette et la fiche livre (suivreLargeurAuMontage, components.js).
// Les segments de la Bibliothèque se lisent comme les onglets soulignés de la maquette (« Mes recettes / Mes livres ») : une classe, aucun geste changé.
function onglets(seg) { seg.classList.add('onglets'); return seg; }

function boutonMobile(matchMedia) {
  const mobile = el('a', { class: 'btn primary big block', href: '#/add', dataset: { role: 'ajouter-mobile' }, style: { marginTop: '1rem' } }, icone('plus'), t('Ajouter une recette'));
  const large = matchMedia('(min-width: 760px)');
  mobile.hidden = !!large?.matches;
  suivreLargeurAuMontage('bibliotheque', mobile, large, (e) => { mobile.hidden = !!(e ? e.matches : large.matches); });
  return mobile;
}

// ?tab=a-importer (§ 4.1, B-M-4) : les références sans adresse, groupées par livre (titre du livre en h3, livres par ordre alphabétique), une ligne
// « {titre} · p. N · À importer » → l'écran d'import ciblé (#/recipes/<id>/importer, le même href que la fiche du livre). Section PLAIN (D-UI-8).
function aImporterTab(ctx) {
  const refs = (ctx.recipes || []).filter(estAImporter);
  if (!refs.length) return emptyState('assiette', t('Rien à importer pour l’instant.')); // ronde 1 (D-T2-c) : « aucune recette » serait faux ici
  const groupes = [...repo.groupBy(refs, 'edition_id').entries()]
    // Vague finale (constats 5, 9, 10) : un titre de livre reçu qui n'est pas une chaîne (title: 42) est dit en texte et ne fait plus lever le tri ; la page suit la
    // règle du badge (pageAffichable : un entier de 1 à 9999), jamais une valeur reçue telle quelle.
    .map(([editionId, liste]) => ({ titre: String(ctx.editionLabel?.(ctx.editionsById?.get(editionId)) || t('Sans titre')), liste: [...liste].sort(parPageEtTitre) }))
    .sort((a, b) => a.titre.localeCompare(b.titre));
  return sectionPlain(t('Recettes de mes livres à importer'), ...groupes.map((g) => el('div', { class: 'stack' }, el('h3', null, g.titre),
    el('ul', { class: 'list plain' }, ...g.liste.map((r) => el('li', null, el('a', { href: `#/recipes/${encodeURIComponent(r.id)}/importer` },
      [r.display_title || r.original_title || t('Sans titre'), pageAffichable(r.printed_page) ? `p. ${r.printed_page}` : null, t('À importer')].filter(Boolean).join(' · '))))))));
}

// Ordre commun aux deux sections : le plus récemment créé d'abord (created_at, updated_at en repli), sans horodatage en dernier.
const plusRecentesDabord = plusRecentDabord('created_at', 'updated_at');
const carteOuLien = (ctx, r) => {
  const doc = ctx.docsByRecipe?.get(r.id);
  return doc ? recipeCard(doc) : el('a', { class: 'btn', href: `#/recipes/${encodeURIComponent(r.id)}` }, r.display_title || r.original_title || t('Sans titre'));
};

// Les signets sans livre (edition_id nul, source_url posé), le dernier GARDÉ d'abord : created_at, updated_at en repli
// (un favori touché ne réordonne pas la liste — ronde 1) ; sans horodatage, en dernier. Aucun : rien n'est rendu.
function liensWebGardes(ctx) {
  const signets = (ctx.recipes || []).filter((r) => !r.edition_id && aUneAdresse(r)).sort(plusRecentesDabord);
  if (!signets.length) return null;
  return sectionPlain(t('Liens web gardés'), ...signets.map((r) => carteOuLien(ctx, r)));
}

// N-7 / N-10 : les fiches créées avec l'assistant, filtrées sur `origine` (pas sur la version courante : une fiche corrigée y reste),
// la plus récemment créée d'abord (même ordre que les signets) ; la carte dit l'étiquette C-2. Aucune : rien n'est rendu.
function recettesCreeesIA(ctx) {
  const creees = (ctx.recipes || []).filter((r) => r.origine === 'ia').sort(plusRecentesDabord);
  if (!creees.length) return null;
  return sectionPlain(t('Recettes créées avec l’IA'), ...creees.map((r) => carteOuLien(ctx, r)));
}

async function booksTab(ctx) {
  if (!ctx.book_editions.length) return emptyState('livres', t('Aucun livre pour l’instant.'), el('a', { class: 'btn primary', href: '#/add' }, t('Ajouter un livre')));
  const recipesByEdition = repo.groupBy(ctx.recipes.filter((r) => r.edition_id), 'edition_id');
  // Les octets des couvertures sont lus UNE fois, en une transaction : la grille se redessine à chaque touche du
  // filtre et ne peut pas aller en base à chaque fois. Une empreinte sans ligne ici = couverture pas sur l'appareil.
  const fichiers = await repo.getFiles(ctx.book_editions.map((e) => e.cover_sha256).filter(Boolean));
  const filter = el('input', { type: 'search', placeholder: t('Filtrer par titre, auteur, cuisine…') });
  const grid = el('div', { class: 'grid livres' }); // § 3.3 : couvertures minmax(170px, 1fr) — la règle .grid.livres de T1
  const draw = () => {
    const q = filter.value.trim().toLowerCase();
    const eds = [...ctx.book_editions].sort((a, b) => String(ctx.editionLabel(a) || '').localeCompare(String(ctx.editionLabel(b) || ''))); // vague finale : titre reçu non-chaîne
    const noeuds = [];
    for (const ed of eds) {
      const book = ctx.booksById.get(ed.book_id);
      const hay = `${book?.title || ''} ${book?.author || ''} ${(book?.cuisines || []).join(' ')} ${(book?.tags || []).join(' ')}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const list = recipesByEdition.get(ed.id) || [];
      // Lot UI-1 « Carnet » (D-UI-10, H-19) : « à importer » = les références SANS adresse (estAImporter, la définition de la fiche livre et de l'onglet
      // « À importer ») ; un signet rangé dans le livre est un lien web, compté ni « disponible » ni « à importer » (EI-T5-1). Rien à compter : « Aucune recette indexée ».
      const available = list.filter((r) => r.availability !== 'reference_only').length;
      const refs = list.filter(estAImporter).length;
      noeuds.push(el('div', null, bookCover(ed, book, { fichier: ed.cover_sha256 ? fichiers.get(ed.cover_sha256) : null }),
        el('div', { class: 'muted', style: { fontSize: '.78rem', marginTop: '.3rem' } },
          available || refs ? `${available ? t('{n} disponible(s)', { n: available }) : ''}${available && refs ? ' · ' : ''}${refs ? t('{n} à importer', { n: refs }) : ''}` : t('Aucune recette indexée'))));
    }
    if (!noeuds.length) noeuds.push(el('p', { class: 'muted' }, t('Aucun livre ne correspond.')));
    // D-T9 : les URL blob: de la génération précédente sont révoquées APRÈS le remplacement des nœuds — avant, un
    // <img> encore dans le document pointait sur une URL morte (erreur de console). Et seules les anciennes sont
    // révoquées : « tout révoquer » ici emporterait les vignettes qu'on vient de créer (le filtre redessine à
    // chaque touche).
    const anciennes = [...grid.querySelectorAll('img.cover-img')].map((i) => i.src);
    grid.replaceChildren(...noeuds);
    for (const u of anciennes) revoquerUrlDeBlob(u);
  };
  filter.addEventListener('input', draw);
  draw();
  return el('div', null, el('div', { style: { marginBottom: '.8rem' } }, filter), grid);
}

async function dishesTab(ctx) {
  const links = ctx.dish_recipe_links;
  const root = el('div', null);
  const newDish = async () => {
    const fr = await promptDialog(t('Nom du plat (français)'), { placeholder: 'Puttanesca' });
    if (!fr) return;
    const en = await promptDialog(t('Nom du plat (anglais, facultatif)'), { placeholder: 'Puttanesca' });
    await repo.save('dishes', { id: repo.newId('dish'), labels: { fr: { label: fr.trim(), aliases: [] }, en: { label: (en || fr).trim(), aliases: [] } } });
    toast(t('Plat créé'));
    refresh();
  };
  root.append(el('div', { class: 'row between', style: { marginBottom: '.8rem' } },
    el('p', { class: 'muted', style: { margin: 0 } }, t('Un plat rassemble des recettes apparentées de plusieurs livres, sans écraser leurs sources.')),
    el('button', { class: 'btn', onClick: newDish }, t('Nouveau plat'))));
  if (!ctx.dishes.length) { root.append(emptyState('assiette', t('Aucun plat défini. Crée « Puttanesca », puis rattache-lui les recettes de tes livres.'))); return root; }
  const list = el('ul', { class: 'list' });
  for (const dish of [...ctx.dishes].sort((a, b) => a.labels.fr.label.localeCompare(b.labels.fr.label))) {
    const confirmed = links.filter((l) => l.dish_id === dish.id && l.state === 'confirmed');
    const proposed = links.filter((l) => l.dish_id === dish.id && l.state === 'proposed').length;
    const editions = new Set(confirmed.map((l) => ctx.recipesById.get(l.recipe_id)?.edition_id).filter(Boolean));
    list.append(el('li', null, el('a', { class: 'item-link', href: `#/dishes/${dish.id}` },
      el('div', { class: 'row between' },
        el('div', null, el('h3', null, dish.labels.fr.label, dish.labels.en?.label && dish.labels.en.label !== dish.labels.fr.label ? el('span', { class: 'muted' }, ` · ${dish.labels.en.label}`) : null),
          el('div', { class: 'muted', style: { fontSize: '.85rem' } }, t('{n} recette(s) dans {m} livre(s)', { n: confirmed.length, m: editions.size }))),
        proposed ? el('span', { class: 'chip warn' }, t('{n} à confirmer', { n: proposed })) : null))));
  }
  root.append(list);
  // Propositions de rapprochement pour les recettes sans plat
  const linkedRecipeIds = new Set(links.filter((l) => l.state !== 'refused').map((l) => l.recipe_id));
  const proposals = [];
  for (const r of ctx.recipes) {
    if (linkedRecipeIds.has(r.id)) continue;
    const p = proposeDishesForRecipe(r, ctx.dishes, links)[0];
    if (p) proposals.push({ recipe: r, ...p });
  }
  if (proposals.length) {
    root.append(section(t('Rapprochements proposés'), el('p', { class: 'muted' }, t('Similarité de titre seulement. Confirmer ou refuser ; un refus est mémorisé et reste réversible.')),
      ...proposals.slice(0, 10).map((p) => el('div', { class: 'row between card flat' },
        el('div', null, el('strong', null, p.recipe.display_title || p.recipe.original_title), el('div', { class: 'muted', style: { fontSize: '.85rem' } }, `→ ${p.dish.labels.fr.label} · ${p.evidence}`)),
        el('div', { class: 'row' },
          el('button', { class: 'btn small primary', onClick: async () => { await repo.save('dish_recipe_links', { id: repo.newId('drl'), dish_id: p.dish.id, recipe_id: p.recipe.id, state: 'confirmed', proposed_by: 'title_similarity', evidence: p.evidence, reviewed_at: repo.nowIso() }); refresh(); } }, t('Confirmer')),
          el('button', { class: 'btn small', onClick: async () => { await repo.save('dish_recipe_links', { id: repo.newId('drl'), dish_id: p.dish.id, recipe_id: p.recipe.id, state: 'refused', proposed_by: 'title_similarity', evidence: p.evidence, reviewed_at: repo.nowIso() }); refresh(); } }, t('Refuser')))))));
  }
  return root;
}
