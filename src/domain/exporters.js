// Formats d'échange (spec §31.2) : Recipe/JSON-LD, YAML compatible avec l'import documenté de Paprika, copie HTML lisible.
// Les durées, portions ou compatibilités inconnues sont omises, jamais fabriquées.
import {lireStructureIngredients} from './structure-ingredients.js';
import { estThermomix, etiquetteThermomix, gardeThermomix, AVERTISSEMENT_TM7 } from './thermomix.js';
import { EN } from '../i18n/en.js';
import { lireRendementTexte } from './rendement.js';
import { formatQuantity } from './quantity.js';
import { unitLabel } from './units.js';
import { extFor } from './backup.js';
import { libelleSource } from '../core/lien.js';
import { estCreationIA, etiquetteCreationIA, lireCreation, AVERTISSEMENT_CREATION_IA } from './creation-ia.js';
import { lireReperes, lireTemps, formaterDureeReperes, LIMITES_REPERES } from './reperes.js';

function ingredientLine(ri, locale) {
  if (ri.source_text) return ri.source_text;
  const q = formatQuantity(ri.quantity, { locale });
  return [q, ri.unit_id ? unitLabel(ri.unit_id, locale) : ri.unit_text, ri.name_text, ri.preparation ? `, ${ri.preparation}` : ''].filter(Boolean).join(' ').trim();
}

// Les écrans fournissent leur projection déjà choisie. Sans elle, l'export historique reste documentaire.
function lectureExport(bundle, locale) {
  const p=bundle.lecture;
  if(p&&p.recipe_id===bundle.recipe.id&&p.version_id===bundle.version?.id)return p;
  const v=bundle.version||{},r=bundle.recipe,segment=texte=>({texte:String(texte??''),langReelle:r.original_language||null,etat:'original'});
  const ingredients=(v.ingredients||[]).map(ri=>({kind:'ingredient',id:ri.id,texte:ingredientLine(ri,locale),principal:segment(ri.name_text||ri.source_text),preparation:segment(ri.preparation),sansQuantiteCalculee:false}));
  const structure=lireStructureIngredients(v),byId=new Map(ingredients.map(i=>[i.id,i]));
  return{titre:segment(r.display_title||r.original_title),notes:segment(v.notes),rendement:segment(lireRendementTexte(v)),ingredients,blocs:structure.etat==='courante'?structure.blocks.map(b=>b.kind==='heading'?{kind:'heading',...segment(b.text)}:byId.get(b.ingredient_id)):ingredients,etapes:(v.steps||[]).map(s=>({...s,...segment(s.text)})),manque:false,locale:r.original_language||locale,scaled:{servings:v.servings}};
}
const manqueSegment=s=>s?.etat==='manquant'||s?.etat==='perime';
const avertissementLecture=p=>p.manque?'Passages non traduits : les textes correspondants restent dans leur langue d’origine.':null;
const annotationLigne=i=>i.sansQuantiteCalculee&&!i.ingredient?.name_text?'Texte conservé aux quantités d’origine ; quantité non recalculable.':null;
function languesLecture(p){const segments=[p.titre,p.notes,p.rendement,...p.blocs.filter(x=>x.kind==='heading'),...p.ingredients.flatMap(x=>[x.principal,...(!x.sansQuantiteCalculee?[x.preparation]:[])]),...p.etapes].filter(x=>x?.texte);if(segments.some(x=>!x.langReelle))return undefined;const langues=[...new Set(segments.map(x=>x.langReelle))];return langues.length===1?langues[0]:langues.length?langues:undefined;}
function lignesIngredients(p){return p.blocs.map(i=>i.kind==='heading'?i.texte:[i.texte,annotationLigne(i),manqueSegment(i.principal)?'Passage non traduit ; texte original.':null].filter(Boolean).join(' — '));}
function isoDuration(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > LIMITES_REPERES.minutes) return undefined;
  const m = minutes;
  return m === 0 ? 'PT0M' : `PT${Math.floor(m / 60) ? `${Math.floor(m / 60)}H` : ''}${m % 60 ? `${m % 60}M` : ''}`;
}

// C-2 : une fiche IA dans un export, texte BRUT (un autre logiciel le lit : jamais t()). L'étiquette vient de etiquetteCreationIA —
// « X · statut » s'écrit « X (statut) » dans une phrase —, puis, pour une création, ce que la fiche montre (§ 3.3, C-9), relu et
// reborné par lireCreation. null pour une recette ordinaire et pour une extraction IA de livre (F6).
const enParentheses = (etiquette) => etiquette.replace(/ · (.+)$/u, ' ($1)');
const texteTM = (texte, locale) => locale === 'en' && Object.hasOwn(EN, texte) ? EN[texte] : texte;
function lignesReperes(recipe, version, locale) {
  const lu = lireReperes(recipe, version), lignes = [], tr = s => texteTM(s, locale);
  const origine = o => tr({ source: 'Durée explicite de la source', estimation_ia: 'Estimation IA', manuel: 'Correction manuelle' }[o]);
  if (lu.description_fr) lignes.push(`${tr('Description')} (${origine(lu.champs.description_fr.origine)}) : ${lu.description_fr}`);
  if (lu.difficulte) {
    const niveau = tr({ facile: 'Facile', intermediaire: 'Intermédiaire', avance: 'Avancé', chef: 'Chef' }[lu.difficulte.niveau]);
    lignes.push(`${tr('Niveau')} : ${niveau} (${origine(lu.champs.difficulte.origine)}). ${lu.difficulte.raison}`);
  }
  for (const [cle, label] of [['total', 'Total'], ['actif', 'Temps actif'], ['cuisson', 'Cuisson'], ['attentes', 'Attentes']]) {
    const d = lu.temps?.[cle];
    if (d) lignes.push(`${tr(label)} : ${formaterDureeReperes(d)} (${origine(d.origine)}${cle === 'total' && !d.complet ? ` ; ${tr('Total incomplet')}` : ''}).`);
  }
  if (lu.temps?.total?.complet && lu.temps.attentes_incluses === true) lignes.push(tr('Repos inclus'));
  if (lu.temps?.explication) lignes.push(lu.temps.explication);
  return lignes;
}
function dureesExport(recipe, version) {
  if (estCreationIA(version) || estThermomix(version)) return {};
  const lu = lireReperes(recipe, version);
  if (lu.champs.temps.etat === 'absent') {
    const anciens = lireTemps(recipe, version), prep = version?.prep_minutes;
    return { prep: Number.isInteger(prep) && prep >= 0 && prep <= LIMITES_REPERES.minutes ? prep : undefined,
      cuisson: anciens.cuisson?.max, total: anciens.total?.max };
  }
  // Une annotation estimée/manuelle/périmée ne devient jamais une durée structurée exacte.
  const exacte = d => d?.origine === 'source' && d.min === d.max ? d.min : undefined;
  return { cuisson: exacte(lu.temps?.cuisson), total: lu.temps?.total?.complet ? exacte(lu.temps.total) : undefined };
}
export const DOCUMENT_THERMOMIX = 'Document à revoir — ne pas utiliser les anciens réglages TM7.';
function documentThermomix(version, documentaire) {
  if (gardeThermomix(version).ok) return null;
  if (!documentaire) throw new Error('thermomix_invalide');
  return { etat: 'a_revoir', version_id: version?.id,
    instructions: (Array.isArray(version?.steps) ? version.steps : []).map(s => String(s?.text ?? '')) };
}
function lignesIA(recipe, version, locale = 'fr', document = null) {
  if (document) return [texteTM(DOCUMENT_THERMOMIX, locale)];
  const garde = gardeThermomix(version);
  if (!garde.ok) throw new Error('thermomix_invalide');
  const etiquette = etiquetteThermomix(version) || etiquetteCreationIA(version, recipe);
  if (!etiquette) return null;
  if (estThermomix(version)) return [texteTM(etiquette, locale) + '.', texteTM(AVERTISSEMENT_TM7, locale)];
  const statut = version?.kind === 'adaptation' && !estCreationIA(version) ? ` (${version.status === 'tested' ? 'testée' : 'proposée'})` : '';
  const c = lireCreation(version);
  return [`${enParentheses(etiquette)}${statut}.`,
    c?.description ? `Selon l’assistant : ${c.description}` : null,
    c?.minutes ? `Environ ${c.minutes} min (estimé par l’assistant).` : null,
    ...(c?.conseils || []).map((x) => `Conseil, selon l’assistant : ${x}`),
    c?.notes.length ? `À vérifier avant de servir : ${c.notes.join(' ; ')}` : null,
    c ? AVERTISSEMENT_CREATION_IA : null].filter(Boolean);
}
// C-2 : jamais un livre (ni son ISBN) comme provenance d'une création ; C-6 : jamais de durée exportée pour une création.
const livreDe = (recipe, book) => (recipe.origine === 'ia' ? null : book);

// bundle : { recipe, version, book, edition, translation? }
export function toJsonLd(bundle, { locale = 'fr', documentaire = false } = {}) {
  const { recipe, version } = bundle;
  const book = livreDe(recipe, bundle.book);
  const edition = livreDe(recipe, bundle.edition);
  const document = documentThermomix(version, documentaire);
  const ia = lignesIA(recipe, version, locale, document);
  const reperes = lignesReperes(recipe, version, locale), durees = dureesExport(recipe, version);
  const lecture=lectureExport(bundle,locale),title=lecture.titre.texte;
  const obj = {
    '@context': 'https://schema.org', '@type': 'Recipe', name: title, inLanguage: languesLecture(lecture),
    author: book?.author ? { '@type': 'Person', name: book.author } : undefined,
    isBasedOn: book ? `${book.title}${recipe.printed_page ? `, p. ${recipe.printed_page}` : ''}${edition?.isbn ? ` (ISBN ${edition.isbn})` : ''}` : undefined,
    recipeYield: lecture.rendement.texte || (lecture.scaled?.servings ? String(lecture.scaled.servings) : version?.servings ? String(version.servings) : undefined),
    prepTime: isoDuration(durees.prep), cookTime: isoDuration(durees.cuisson), totalTime: isoDuration(durees.total),
    recipeCategory: recipe.type || undefined,
    recipeCuisine: recipe.cuisines?.length ? recipe.cuisines.join(', ') : undefined,
    recipeIngredient: lecture.ingredients.map(i=>i.texte),
    recipeInstructions: document ? undefined : lecture.etapes.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s.texte })),
    description: ia ? [ia[0], version?.changes || null, ...ia.slice(1)].filter(Boolean).join(' ')
      : version?.kind === 'adaptation' ? `Adaptation personnelle (${version.status === 'tested' ? 'testée' : 'proposée'}) de la recette originale.${version.changes ? ' ' + version.changes : ''}` : undefined,
  };
  if (document) obj['cuisineos:document_conserve'] = document;
  const groupes=lecture.blocs.some(x=>x.kind==='heading')?'Les titres de groupes sont conservés dans les exports lisibles, pas dans recipeIngredient.':null;
  if(reperes.length||lecture.notes.texte||lecture.manque||groupes)obj.description=[obj.description,...reperes,lecture.notes.texte,avertissementLecture(lecture),groupes].filter(Boolean).join(' ');
  obj['cuisineos:provenance'] = {
    recipe_id: recipe.id, version_id: version?.id, version_kind: version?.kind, version_status: version?.status,
    book: book?.title, edition_isbn: edition?.isbn, printed_page: recipe.origine === 'ia' ? undefined : recipe.printed_page, exported_at: new Date().toISOString(),
    ...(ia ? { origine: recipe.origine ?? undefined, generated_by: version?.provenance?.generated_by ?? undefined } : {}),
  };
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)));
}

// YAML : bloc littéral indenté ; guillemets pour les scalaires simples. Champs obligatoires Paprika : name, ingredients, directions.
function yamlStr(s) { return JSON.stringify(String(s ?? '')); }
function yamlBlock(lines, indent = '    ') {
  const arr = (Array.isArray(lines) ? lines : String(lines).split('\n')).map((l) => String(l).replace(/\r/g, ''));
  return `|\n${arr.map((l) => (l.trim() ? indent + l : '')).join('\n')}`;
}

export function toPaprikaYaml(bundles, { locale = 'fr', documentaire = false } = {}) {
  const docs = bundles.map(({ recipe, version, ...b }) => {
    const book = livreDe(recipe, b.book);
    const edition = livreDe(recipe, b.edition);
    const document = documentThermomix(version, documentaire);
    const ia = lignesIA(recipe, version, locale, document);
    const reperes = lignesReperes(recipe, version, locale), durees = dureesExport(recipe, version);
    const lecture=lectureExport({recipe,version,...b},locale),title=lecture.titre.texte;
    const lines = [`- name: ${yamlStr(title)}`];
    const rendement=lecture.rendement.texte;
    if (rendement || version?.servings) lines.push(`  servings: ${yamlStr([version?.servings ? `${version.servings} portions` : null, rendement].filter(Boolean).join(' · '))}`);
    // S8 : hors livre, la source est l'hôte RECALCULÉ depuis l'adresse — jamais `source_label` stocké, qu'une
    // archive ou le serveur peut avoir rempli avec n'importe quoi (S7). Un export est lu par un autre logiciel.
    const source = book ? `${book.title}${book.author ? ` — ${book.author}` : ''}${recipe.printed_page ? `, p. ${recipe.printed_page}` : ''}` : libelleSource(recipe);
    if (source) lines.push(`  source: ${yamlStr(source)}`);
    if (recipe.source_url && recipe.origine !== 'ia') lines.push(`  source_url: ${yamlStr(recipe.source_url)}`); // C-2 : jamais un site
    if (durees.prep != null) lines.push(`  prep_time: ${yamlStr(`${durees.prep} minutes`)}`);
    if (durees.cuisson != null) lines.push(`  cook_time: ${yamlStr(`${durees.cuisson} minutes`)}`);
    if (recipe.favorite) lines.push('  on_favorites: yes');
    const cats = [recipe.type, ...(recipe.cuisines || [])].filter(Boolean);
    if (cats.length) lines.push(`  categories: [${cats.map(yamlStr).join(', ')}]`);
    const notes = [];
    if (ia) notes.push(...ia);
    else if (version?.kind === 'adaptation') notes.push(`Adaptation personnelle (${version.status === 'tested' ? 'testée' : 'proposée'}), distincte de l’original.`);
    notes.push(...reperes);
    if(lecture.notes.texte)notes.push(lecture.notes.texte);
    if(lecture.manque)notes.push(avertissementLecture(lecture));
    if (version?.changes) notes.push(`Changements : ${version.changes}`);
    if (edition?.isbn) notes.push(`ISBN ${edition.isbn}`);
    notes.push(`Exporté de Mistu — recette ${recipe.id}, version ${version?.id || '—'}, langue ${recipe.original_language || '—'}`);
    if (document) notes.push(texteTM('Texte conservé pour relecture :', locale), ...document.instructions);
    lines.push(`  notes: ${yamlBlock(notes)}`);
    lines.push(`  ingredients: ${yamlBlock(lignesIngredients(lecture))}`);
    lines.push(`  directions: ${yamlBlock(document ? [texteTM(DOCUMENT_THERMOMIX, locale)] : lecture.etapes.map(s=>[s.texte,manqueSegment(s)?'Passage non traduit ; texte original.':null].filter(Boolean).join(' — ')))}`);
    return lines.join('\n');
  });
  return docs.join('\n') + '\n';
}

// Vague finale (B6) : TOUT texte d'une fiche passe par esc() — titre, page tapée, identifiant (dans l'adresse d'un lien), empreinte d'une
// page (dans l'adresse d'une image) : une ligne reçue ou restaurée peut porter du balisage, exécuté à l'ouverture du site exporté.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function htmlSegment(s){return `<span${s.langReelle?` lang="${esc(s.langReelle)}"`:''} style="white-space:pre-wrap">${esc(s.texte)}</span>${manqueSegment(s)?'<small> — Passage non traduit ; texte original.</small>':''}${s.citationSource?'<small> — Réglages traduits ; noms d’aliments cités dans la langue source.</small>':''}`;}
const HTML_CSS = 'body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1d231f;background:#f6f1e7;line-height:1.5}h1,h2{color:#1f4d3a}.meta{color:#5f6b63;font-size:.9rem}img{max-width:100%;border-radius:8px}li{margin:.2rem 0}a{color:#1f4d3a}.badge{font-size:.75rem;background:#d7e3d8;padding:.1rem .4rem;border-radius:6px}';

// Retourne les entrées ZIP d'une copie lisible : index.html, recipes/<id>.html, images/<sha>.<ext>
export function toReadableSite(bundles, filesBySha, { locale = 'fr', documentaire = false } = {}) {
  const entries = [];
  const usedImages = new Map();
  const items = bundles.map(({ recipe, version, pages = [], ...b }) => {
    const book = livreDe(recipe, b.book);
    const document = documentThermomix(version, documentaire);
    const etiquette = document ? texteTM(DOCUMENT_THERMOMIX, locale) : estThermomix(version) ? texteTM(etiquetteThermomix(version), locale) : etiquetteCreationIA(version, recipe);
    const ia = lignesIA(recipe, version, locale, document);
    const reperes = lignesReperes(recipe, version, locale), durees = dureesExport(recipe, version);
    const lecture=lectureExport({recipe,version,...b},locale),title=lecture.titre.texte;
    const file = `recipes/${recipe.id}.html`;
    const imgs = [];
    for (const p of pages) {
      const f = filesBySha.get(p.sha256);
      if (!f) continue;
      const path = `images/${p.sha256}.${extFor(f.mime)}`;
      usedImages.set(path, f);
      imgs.push(path);
    }
    const body = `<!doctype html><html lang="${esc(typeof languesLecture(lecture)==='string'?languesLecture(lecture):'')}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${HTML_CSS}</style></head><body>
<p><a href="../index.html">← Index</a></p>
<h1>${htmlSegment(lecture.titre)}</h1>
<p class="meta">${book ? esc(`${book.title}${book.author ? ` — ${book.author}` : ''}`) : esc(libelleSource(recipe) || 'Source personnelle')}${recipe.printed_page && recipe.origine !== 'ia' ? `, page ${esc(recipe.printed_page)}` : ''}
${etiquette ? ` · <span class="badge">${esc(etiquette)}</span>` : version?.kind === 'adaptation' ? ' · <span class="badge">Adaptation personnelle</span>' : version ? ' · <span class="badge">Original</span>' : ''}</p>
${version?.servings ? `<p class="meta">${esc(`${version.servings} portions`)}${durees.prep != null ? ` · préparation ${durees.prep} min` : ''}${durees.cuisson != null ? ` · cuisson ${durees.cuisson} min` : ''}</p>` : ''}${ia ? ia.slice(1).map((l) => `<p>${esc(l)}</p>`).join('') : ''}
${lecture.rendement.texte ? `<p class="meta">${htmlSegment(lecture.rendement)}</p>` : ''}
${lecture.manque?`<p>${esc(avertissementLecture(lecture))}</p>`:''}
${lecture.notes.texte?`<p>${htmlSegment(lecture.notes)}</p>`:''}
${reperes.map(l => `<p>${esc(l)}</p>`).join('')}
${version ? `<h2>Ingrédients</h2><ul>${lecture.blocs.map(i=>i.kind==='heading'?`<li style="list-style:none"><h3>${htmlSegment(i)}</h3></li>`:`<li>${esc(i.texte)}${annotationLigne(i)?`<small> — ${esc(annotationLigne(i))}</small>`:''}${manqueSegment(i.principal)?'<small> — Passage non traduit ; texte original.</small>':''}</li>`).join('')}</ul>
<h2>${document ? esc(texteTM('Texte conservé pour relecture :', locale)) : 'Préparation'}</h2><ol>${(document ? document.instructions.map(texte=>({texte,langReelle:recipe.original_language})) : lecture.etapes).map(s => `<li>${htmlSegment(s)}</li>`).join('')}</ol>` : '<p><em>Référence d’index seulement : la recette n’a pas encore été numérisée.</em></p>'}
${version?.changes ? `<h2>Changements</h2><p>${esc(version.changes)}</p>` : ''}
${imgs.length ? `<h2>Pages originales</h2>${imgs.map((p) => `<p><img src="../${esc(p)}" alt="Page originale"></p>`).join('')}` : ''}
<p class="meta">Exporté de Mistu le ${esc(new Date().toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA'))}. Identifiant ${esc(recipe.id)}.</p>
</body></html>`;
    entries.push({ path: file, data: body });
    return { title, file, book };
  });
  items.sort((a, b) => a.title.localeCompare(b.title, locale));
  const index = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>Mes recettes — Mistu</title><style>${HTML_CSS}</style></head><body>
<h1>Mes recettes</h1><p class="meta">${items.length} recette(s) — copie lisible hors connexion, produite par Mistu.</p>
<ul>${items.map((it) => `<li><a href="${esc(it.file)}">${esc(it.title)}</a>${it.book ? ` <span class="meta">— ${esc(it.book.title)}</span>` : ''}</li>`).join('')}</ul></body></html>`;
  entries.unshift({ path: 'index.html', data: index });
  return { entries, images: usedImages };
}

// Copies documentaires du même choix de lecture, sans journal ni appel supplémentaire.
export function toMarkdown(bundle,{locale='fr',documentaire=true}={}){
 const {recipe,version}=bundle,p=lectureExport(bundle,locale),doc=documentThermomix(version,documentaire);
 const lignes=[`# ${p.titre.texte}`,...lignesIA(recipe,version,locale,doc)||[],avertissementLecture(p),p.rendement.texte,'## Ingrédients'];
 for(const b of p.blocs)lignes.push(b.kind==='heading'?`### ${b.texte}`:`- ${b.texte}${annotationLigne(b)?` — ${annotationLigne(b)}`:''}${manqueSegment(b.principal)?' — Passage non traduit ; texte original.':''}`);
 lignes.push('## Préparation',...(doc?doc.instructions.map(texte=>({texte})):p.etapes).map((s,i)=>`${i+1}. ${s.texte}${manqueSegment(s)?' — Passage non traduit ; texte original.':''}`));
 if(p.notes.texte)lignes.push('## Notes',p.notes.texte);
 lignes.push(...lignesReperes(recipe,version,locale),`Source : ${bundle.book?.title||libelleSource(recipe)||recipe.original_title||''}`,`Recette ${recipe.id} · version ${version?.id||'—'}`);
 return lignes.filter(Boolean).join('\n\n')+'\n';
}
export function toRecipeText(bundle,options={}){return toMarkdown(bundle,options).replace(/^#{1,3} /gm,'');}
