// Formats d'échange (spec §31.2) : Recipe/JSON-LD, YAML compatible avec l'import documenté de Paprika, copie HTML lisible.
// Les durées, portions ou compatibilités inconnues sont omises, jamais fabriquées.
import { formatQuantity } from './quantity.js';
import { unitLabel } from './units.js';
import { extFor } from './backup.js';
import { libelleSource } from '../core/lien.js';

function ingredientLine(ri, locale) {
  if (ri.source_text) return ri.source_text;
  const q = formatQuantity(ri.quantity, { locale });
  return [q, ri.unit_id ? unitLabel(ri.unit_id, locale) : ri.unit_text, ri.name_text, ri.preparation ? `, ${ri.preparation}` : ''].filter(Boolean).join(' ').trim();
}

function isoDuration(minutes) {
  if (minutes === null || minutes === undefined) return undefined;
  const m = Math.round(minutes);
  return `PT${Math.floor(m / 60) ? `${Math.floor(m / 60)}H` : ''}${m % 60 ? `${m % 60}M` : ''}` || 'PT0M';
}

// bundle : { recipe, version, book, edition, translation? }
export function toJsonLd(bundle, { locale = 'fr' } = {}) {
  const { recipe, version, book, edition } = bundle;
  const title = recipe.display_title || recipe.original_title;
  const obj = {
    '@context': 'https://schema.org', '@type': 'Recipe', name: title, inLanguage: recipe.original_language || undefined,
    author: book?.author ? { '@type': 'Person', name: book.author } : undefined,
    isBasedOn: book ? `${book.title}${recipe.printed_page ? `, p. ${recipe.printed_page}` : ''}${edition?.isbn ? ` (ISBN ${edition.isbn})` : ''}` : undefined,
    recipeYield: version?.servings ? String(version.servings) : undefined,
    prepTime: isoDuration(version?.prep_minutes), cookTime: isoDuration(version?.cook_minutes), totalTime: isoDuration(version?.total_minutes),
    recipeCategory: recipe.type || undefined,
    recipeCuisine: recipe.cuisines?.length ? recipe.cuisines.join(', ') : undefined,
    recipeIngredient: (version?.ingredients || []).map((ri) => ingredientLine(ri, locale)),
    recipeInstructions: (version?.steps || []).map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s.text })),
    description: version?.kind === 'adaptation' ? `Adaptation personnelle (${version.status === 'tested' ? 'testée' : 'proposée'}) de la recette originale.${version.changes ? ' ' + version.changes : ''}` : undefined,
  };
  obj['cuisineos:provenance'] = {
    recipe_id: recipe.id, version_id: version?.id, version_kind: version?.kind, version_status: version?.status,
    book: book?.title, edition_isbn: edition?.isbn, printed_page: recipe.printed_page, exported_at: new Date().toISOString(),
  };
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)));
}

// YAML : bloc littéral indenté ; guillemets pour les scalaires simples. Champs obligatoires Paprika : name, ingredients, directions.
function yamlStr(s) { return JSON.stringify(String(s ?? '')); }
function yamlBlock(lines, indent = '    ') {
  const arr = (Array.isArray(lines) ? lines : String(lines).split('\n')).map((l) => String(l).replace(/\r/g, ''));
  return `|\n${arr.map((l) => (l.trim() ? indent + l : '')).join('\n')}`;
}

export function toPaprikaYaml(bundles, { locale = 'fr' } = {}) {
  const docs = bundles.map(({ recipe, version, book, edition }) => {
    const title = recipe.display_title || recipe.original_title;
    const lines = [`- name: ${yamlStr(title)}`];
    if (version?.servings) lines.push(`  servings: ${yamlStr(`${version.servings} portions`)}`);
    // S8 : hors livre, la source est l'hôte RECALCULÉ depuis l'adresse — jamais `source_label` stocké, qu'une
    // archive ou le serveur peut avoir rempli avec n'importe quoi (S7). Un export est lu par un autre logiciel.
    const source = book ? `${book.title}${book.author ? ` — ${book.author}` : ''}${recipe.printed_page ? `, p. ${recipe.printed_page}` : ''}` : libelleSource(recipe);
    if (source) lines.push(`  source: ${yamlStr(source)}`);
    if (recipe.source_url) lines.push(`  source_url: ${yamlStr(recipe.source_url)}`);
    if (version?.prep_minutes != null) lines.push(`  prep_time: ${yamlStr(`${version.prep_minutes} minutes`)}`);
    if (version?.cook_minutes != null) lines.push(`  cook_time: ${yamlStr(`${version.cook_minutes} minutes`)}`);
    if (recipe.favorite) lines.push('  on_favorites: yes');
    const cats = [recipe.type, ...(recipe.cuisines || [])].filter(Boolean);
    if (cats.length) lines.push(`  categories: [${cats.map(yamlStr).join(', ')}]`);
    const notes = [];
    if (version?.kind === 'adaptation') notes.push(`Adaptation personnelle (${version.status === 'tested' ? 'testée' : 'proposée'}), distincte de l’original.`);
    if (version?.changes) notes.push(`Changements : ${version.changes}`);
    if (edition?.isbn) notes.push(`ISBN ${edition.isbn}`);
    notes.push(`Exporté de Cuisine OS — recette ${recipe.id}, version ${version?.id || '—'}, langue ${recipe.original_language || '—'}`);
    lines.push(`  notes: ${yamlBlock(notes)}`);
    lines.push(`  ingredients: ${yamlBlock((version?.ingredients || []).map((ri) => ingredientLine(ri, locale)))}`);
    lines.push(`  directions: ${yamlBlock((version?.steps || []).map((s) => s.text))}`);
    return lines.join('\n');
  });
  return docs.join('\n') + '\n';
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HTML_CSS = 'body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1d231f;background:#f6f1e7;line-height:1.5}h1,h2{color:#1f4d3a}.meta{color:#5f6b63;font-size:.9rem}img{max-width:100%;border-radius:8px}li{margin:.2rem 0}a{color:#1f4d3a}.badge{font-size:.75rem;background:#d7e3d8;padding:.1rem .4rem;border-radius:6px}';

// Retourne les entrées ZIP d'une copie lisible : index.html, recipes/<id>.html, images/<sha>.<ext>
export function toReadableSite(bundles, filesBySha, { locale = 'fr' } = {}) {
  const entries = [];
  const usedImages = new Map();
  const items = bundles.map(({ recipe, version, book, pages = [] }) => {
    const title = recipe.display_title || recipe.original_title;
    const file = `recipes/${recipe.id}.html`;
    const imgs = [];
    for (const p of pages) {
      const f = filesBySha.get(p.sha256);
      if (!f) continue;
      const path = `images/${p.sha256}.${extFor(f.mime)}`;
      usedImages.set(path, f);
      imgs.push(path);
    }
    const body = `<!doctype html><html lang="${esc(recipe.original_language || locale)}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${HTML_CSS}</style></head><body>
<p><a href="../index.html">← Index</a></p>
<h1>${esc(title)}</h1>
<p class="meta">${book ? esc(`${book.title}${book.author ? ` — ${book.author}` : ''}`) : esc(libelleSource(recipe) || 'Source personnelle')}${recipe.printed_page ? `, page ${recipe.printed_page}` : ''}
${version?.kind === 'adaptation' ? ' · <span class="badge">Adaptation personnelle</span>' : version ? ' · <span class="badge">Original</span>' : ''}</p>
${version?.servings ? `<p class="meta">${esc(`${version.servings} portions`)}${version.prep_minutes != null ? ` · préparation ${version.prep_minutes} min` : ''}${version.cook_minutes != null ? ` · cuisson ${version.cook_minutes} min` : ''}</p>` : ''}
${version ? `<h2>Ingrédients</h2><ul>${(version.ingredients || []).map((ri) => `<li>${esc(ingredientLine(ri, locale))}</li>`).join('')}</ul>
<h2>Préparation</h2><ol>${(version.steps || []).map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>` : '<p><em>Référence d’index seulement : la recette n’a pas encore été numérisée.</em></p>'}
${version?.changes ? `<h2>Changements</h2><p>${esc(version.changes)}</p>` : ''}
${imgs.length ? `<h2>Pages originales</h2>${imgs.map((p) => `<p><img src="../${p}" alt="Page originale"></p>`).join('')}` : ''}
<p class="meta">Exporté de Cuisine OS le ${esc(new Date().toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA'))}. Identifiant ${esc(recipe.id)}.</p>
</body></html>`;
    entries.push({ path: file, data: body });
    return { title, file, book };
  });
  items.sort((a, b) => a.title.localeCompare(b.title, locale));
  const index = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>Mes recettes — Cuisine OS</title><style>${HTML_CSS}</style></head><body>
<h1>Mes recettes</h1><p class="meta">${items.length} recette(s) — copie lisible hors connexion, produite par Cuisine OS.</p>
<ul>${items.map((it) => `<li><a href="${it.file}">${esc(it.title)}</a>${it.book ? ` <span class="meta">— ${esc(it.book.title)}</span>` : ''}</li>`).join('')}</ul></body></html>`;
  entries.unshift({ path: 'index.html', data: index });
  return { entries, images: usedImages };
}
