// Projection locale pure : mêmes recettes et mêmes repères pour les cartes, listes et compteurs.
import { normalizeText } from './units.js';
import { currentVersion } from './search.js';
import { lireEtatRecette } from './cycle-edition.js';
import { lireReperes, lireTemps } from './reperes.js';
import { lireThermomix } from './thermomix.js';

export const SOURCES_BIBLIOTHEQUE = Object.freeze(['livres','web','ia','personnelles']);
export const DISPONIBILITES_BIBLIOTHEQUE = Object.freeze(['available','partial','reference_only','unknown']);
const tableau = x => Array.isArray(x) ? x : [];
const id = x => typeof x === 'string' && x.length > 0 && x.length <= 200 && !/[\u0000-\u001f\u007f]/.test(x) ? x : null;
const choix = (x,values,fallback) => values.includes(x) ? x : fallback;
const liste = (x,values) => [...new Set(tableau(x).filter(v=>values ? values.includes(v) : id(v)))].slice(0,40);
const texte = x => typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,500) : '';
export function normaliserEtatBibliotheque(x={}) {
  return { q:texte(x.q), sources:liste(x.sources,SOURCES_BIBLIOTHEQUE), editionId:id(x.editionId), disponibilites:liste(x.disponibilites,DISPONIBILITES_BIBLIOTHEQUE),
    favoris:x.favoris===true,aRelire:x.aRelire===true,cuisinees:x.cuisinees===true,rapide:x.rapide===true,
    maxMinutes:Number.isInteger(x.maxMinutes)&&x.maxMinutes>=1&&x.maxMinutes<=10080?x.maxMinutes:null,
    ingredientIds:liste(x.ingredientIds),appareil:x.appareil==='tm7'?'tm7':null,
    tri:choix(x.tri,['modification','titre','page'],'modification'),presentation:choix(x.presentation,['grille','liste'],'grille'),
    limite:Number.isFinite(x.limite)?Math.max(60,Math.min(6000,Math.floor(x.limite/60)*60)):60 };
}
export function sourcesRecette(recipe) {
  const result=[];
  if(recipe.edition_id)result.push('livres');
  if(typeof recipe.source_url==='string'&&recipe.source_url.trim())result.push('web');
  if(recipe.origine==='ia')result.push('ia');
  return result.length?result:['personnelles'];
}
export function compterDisponibilites(items) {
  const compteurs={available:0,partial:0,reference_only:0,unknown:0};
  for(const i of items)compteurs[choix(i.disponibilite??i.recipe?.availability??i.availability,DISPONIBILITES_BIBLIOTHEQUE,'unknown')]++;
  return compteurs;
}
const index = (rows,map) => map instanceof Map ? map : new Map(tableau(rows).map(r=>[r.id,r]));
const titre = i => String(i.recipe.display_title||i.recipe.original_title||'');
const date = r => {const n=Date.parse(r.updated_at||r.created_at||'');return Number.isFinite(n)?n:-Infinity;};
const page = r => Number.isInteger(r.printed_page)&&r.printed_page>=1&&r.printed_page<=9999?r.printed_page:Infinity;
export function projeterBibliotheque(ctx={},etat={}) {
  const e=normaliserEtatBibliotheque(etat),editions=index(ctx.book_editions,ctx.editionsById),books=index(ctx.books,ctx.booksById);
  const versions=tableau(ctx.recipe_versions),cuisinees=new Map();
  for(const h of tableau(ctx.cook_history))cuisinees.set(h.recipe_id,(cuisinees.get(h.recipe_id)||0)+1);
  const versionsParRecette=new Map();
  for(const v of versions){if(!versionsParRecette.has(v.recipe_id))versionsParRecette.set(v.recipe_id,[]);versionsParRecette.get(v.recipe_id).push(v);}
  const tous=tableau(ctx.recipes).flatMap(recipe=>{
    const edition=editions.get(recipe.edition_id)||null,etatEffectif=lireEtatRecette(recipe,edition);
    if(etatEffectif.etat!=='active')return [];
    const candidates=tableau(ctx.versionsByRecipe?.get(recipe.id)??versionsParRecette.get(recipe.id)).filter(v=>v.recipe_id===recipe.id);
    // Une clé explicite absente ou étrangère ne récupère jamais les repères d'une autre version.
    const version=recipe.current_version_id?candidates.find(v=>v.id===recipe.current_version_id)||null:currentVersion(recipe,candidates);
    const book=books.get(edition?.book_id)||null,reperes=lireReperes(recipe,version),temps=lireTemps(recipe,version);
    const ingredientIds=new Set(tableau(version?.ingredients).map(i=>i.ingredient_id).filter(Boolean));
    const sources=sourcesRecette(recipe),disponibilite=choix(recipe.availability,DISPONIBILITES_BIBLIOTHEQUE,'unknown');
    const recherche=normalizeText([recipe.original_title,recipe.display_title,book?.title,...tableau(version?.ingredients).map(i=>i.name_text||i.source_text)].filter(Boolean).join(' '));
    return [{...(ctx.docsByRecipe?.get(recipe.id)||{}),recipe,version,edition,book,reperes,temps,ingredientIds,sources,disponibilite,etatEffectif,cooked:cuisinees.get(recipe.id)||0,recherche}];
  });
  const termes=normalizeText(e.q).split(/\s+/).filter(Boolean);
  const items=tous.filter(i=>{
    if(e.editionId&&i.recipe.edition_id!==e.editionId)return false;
    if(e.sources.length&&!e.sources.some(s=>i.sources.includes(s)))return false;
    if(e.disponibilites.length&&!e.disponibilites.includes(i.disponibilite))return false;
    if(e.favoris&&!i.recipe.favorite||e.cuisinees&&!i.cooked)return false;
    if(e.aRelire&&!['unverified','to_verify'].includes(i.version?.verification_state))return false;
    if(e.rapide&&!i.reperes.rapide)return false;
    if(e.maxMinutes&&!(i.temps.disponible&&i.temps.total?.complet&&i.temps.attentes_incluses===true&&i.temps.total.max<=e.maxMinutes))return false;
    if(e.ingredientIds.some(id=>!i.ingredientIds.has(id)))return false;
    if(e.appareil==='tm7'&&lireThermomix(i.version)?.ok!==true)return false;
    const mots=i.recherche.split(/[^a-z0-9]+/).filter(Boolean);
    return termes.every(t=>mots.some(m=>m.startsWith(t)));
  });
  items.sort((a,b)=>{
    const ordre=e.tri==='page'?page(a.recipe)-page(b.recipe):e.tri==='modification'?date(b.recipe)-date(a.recipe):0;
    return (Number.isNaN(ordre)?0:ordre)||titre(a).localeCompare(titre(b),'fr')||String(a.recipe.id).localeCompare(String(b.recipe.id));
  });
  return {items,total:items.length,compteurs:compterDisponibilites(items),filtresIndisponibles:e.editionId&&!editions.has(e.editionId)?[{champ:'editionId',valeur:e.editionId}]:[]};
}
