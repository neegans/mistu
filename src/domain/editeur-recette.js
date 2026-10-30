// Modèle de saisie local : une seule représentation, sans réanalyse implicite du texte source.
// Les identités de recette/version, cycles, empreintes et écritures appartiennent au service.
import { detectTimers, parseIngredientLine } from './lines.js';
import { validerStructureIngredients, fabriquerStructureIngredients, deplacerBlocIngredients } from './structure-ingredients.js';

export const CHAMPS_METADATA_RECETTE = ['display_title','original_title','original_language','type','cuisines','tags','printed_page','source_label'];
export const CHAMPS_CONTENU_RECETTE = ['servings','yield_text','prep_minutes','cook_minutes','active_minutes','total_minutes','ingredients','ingredient_structure','steps','changes','notes','status'];
const NOMBRES = ['servings','prep_minutes','cook_minutes','active_minutes','total_minutes'];
const LIGNE = ['id','source_text','quantity','unit_id','unit_text','unit_candidates','name_text','preparation','optional','ingredient_id','verification_state','evidence','match_locale','ingredient_candidates','uncertain','substituted_from'];
const ETAPE = ['id','position','text','timers'];
const objet = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype,null].includes(Object.getPrototypeOf(x));
const copie = x => structuredClone(x);
const garder = (x,keys) => Object.fromEntries(keys.filter(k=>Object.hasOwn(x||{},k)).map(k=>[k,copie(x[k])]));
const canon = x => Array.isArray(x) ? x.map(canon) : objet(x) ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])) : x;
const egal = (a,b) => JSON.stringify(canon(a))===JSON.stringify(canon(b));
const cles = (x,keys) => objet(x) && Object.keys(x).every(k=>keys.includes(k));
const json = (x,n=0) => n<24 && (x===null || typeof x==='string' || typeof x==='boolean' || typeof x==='number' && Number.isFinite(x) || Array.isArray(x) && x.every(v=>json(v,n+1)) || objet(x) && Object.entries(x).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&json(v,n+1)));
const identite = x => typeof x==='string' && x.length>0 && x.length<=256;
const texte = x => x===null || typeof x==='string';
const listeTextes = x => Array.isArray(x) && x.every(v=>typeof v==='string');

export function creerModeleRecette(affiche={}, {intention='correction'}={}) {
  const {recipe,version}=affiche;
  const metadata=garder(recipe,CHAMPS_METADATA_RECETTE.filter(k=>k!=='original_title'));
  if (!recipe) Object.assign(metadata,{original_title:'',original_language:affiche.edition?.language||'fr'});
  const contenu=garder(version,CHAMPS_CONTENU_RECETTE);
  contenu.ingredients=copie(version?.ingredients||[]);contenu.steps=copie(version?.steps||[]);
  if(intention==='adaptation') {contenu.changes='';contenu.status='proposed';}
  const modele={metadata,contenu,source_sans_thermomix:false};
  if(affiche.journal?.resultat&&(!recipe||affiche.journal.editor_base_version_id===version?.id)) {
    let seq=0;
    return poserLectureRecette(modele,affiche.journal.resultat,{newId:prefix=>`${prefix}-${affiche.journal.id}-${++seq}`});
  }
  return modele;
}

// Un résultat déjà validé entre explicitement dans le formulaire ; aucune lecture réseau ici.
export function poserLectureRecette(modele,resultat,{newId}={}) {
  const p=copie(modele);let seq=0;const id=newId||((prefix)=>`${prefix}-lecture-${++seq}`);
  if(!p.metadata.original_title&&Object.hasOwn(p.metadata,'original_title')&&typeof resultat.title==='string')p.metadata.original_title=resultat.title;
  for(const k of ['servings','prep_minutes','cook_minutes'])if(resultat[k]!=null)p.contenu[k]=resultat[k];
  if(resultat.printed_page!=null&&!p.metadata.printed_page)p.metadata.printed_page=resultat.printed_page;
  p.contenu.ingredients=(resultat.ingredients||[]).map(i=>({...parseIngredientLine(i.source_text),id:id('ri'),uncertain:i.uncertain===true}));
  p.contenu.steps=(resultat.steps||[]).map((s,i)=>({id:id('st'),position:i+1,text:s.text,...detectTimers(s.text)}));
  const structure=fabriquerStructureIngredients(resultat,p.contenu.ingredients,{newId:id});if(structure)p.contenu.ingredient_structure=structure;
  if(!p.contenu.notes&&typeof resultat.notes==='string')p.contenu.notes=resultat.notes;
  return p;
}

export function validerModeleRecette(payload,{publication=false}={}) {
  const refus=()=>({ok:false,raison:'contenu_invalide'});
  try {
    if(!cles(payload,['metadata','contenu','source_sans_thermomix']) || !cles(payload.metadata,CHAMPS_METADATA_RECETTE) || !cles(payload.contenu,CHAMPS_CONTENU_RECETTE) || typeof payload.source_sans_thermomix!=='boolean' || !json(payload)) return refus();
    if(new TextEncoder().encode(JSON.stringify(payload)).byteLength>2097152) return refus();
    const p=copie(payload),m=p.metadata,c=p.contenu;
    for(const [k,v] of Object.entries(m)) {
      if(['cuisines','tags'].includes(k) ? !listeTextes(v) : k==='printed_page' ? !(v===null||typeof v==='string'||Number.isFinite(v)) : !texte(v)) return refus();
    }
    for(const [k,v] of Object.entries(c)) {
      if(NOMBRES.includes(k)) {if(!(v===null||typeof v==='string'||Number.isFinite(v)))return refus();}
      else if(!['ingredients','steps','ingredient_structure'].includes(k)&&!texte(v)) return refus();
    }
    if(!Array.isArray(c.ingredients)||!Array.isArray(c.steps))return refus();
    for(const [rows,keys,step] of [[c.ingredients,LIGNE,false],[c.steps,ETAPE,true]]) {
      const ids=new Set();
      for(const r of rows) {
        if(!cles(r,keys))return refus();
        // De très anciennes lignes sans identifiant restent lisibles ; une édition en ajoute un explicitement.
        if(Object.hasOwn(r,'id')) {if(!identite(r.id)||ids.has(r.id))return refus();ids.add(r.id);}
        if(step) {if(typeof r.text!=='string'||Object.hasOwn(r,'position')&&(!Number.isInteger(r.position)||r.position<1))return refus();}
        else {
          for(const k of ['source_text','name_text','preparation','unit_text','evidence','match_locale'])if(Object.hasOwn(r,k)&&!texte(r[k]))return refus();
          for(const k of ['ingredient_id','unit_id'])if(Object.hasOwn(r,k)&&r[k]!==null&&!identite(r[k]))return refus();
          if(Object.hasOwn(r,'verification_state')&&!['verified','to_verify'].includes(r.verification_state))return refus();
          for(const k of ['optional','uncertain'])if(Object.hasOwn(r,k)&&typeof r[k]!=='boolean')return refus();
          if(Object.hasOwn(r,'quantity')&&r.quantity!==null&&!objet(r.quantity))return refus();
        }
      }
    }
    if(publication) {
      if(Object.hasOwn(c,'ingredient_structure')&&!validerStructureIngredients(c.ingredient_structure,c.ingredients).ok)return refus();
      for(const k of NOMBRES) if(Object.hasOwn(c,k)) { const n=nombre(c[k]);if(n===undefined||n!==null&&(n<0||k==='servings'&&n===0))return refus();c[k]=n; }
      if(Object.hasOwn(m,'printed_page')) {const n=nombre(m.printed_page);if(n===undefined||n!==null&&(!Number.isInteger(n)||n<1))return refus();m.printed_page=n;}
      if(Object.hasOwn(c,'yield_text')&&c.yield_text!==null&&Array.from(c.yield_text).length>200)return refus();
      if(Object.hasOwn(m,'original_title')&&(!m.original_title||!m.original_title.trim()))return refus();
      if(m.original_language!=null&&(m.original_language.length>80||/[\u0000-\u001f\u007f]/.test(m.original_language)))return refus();
      if(Object.hasOwn(c,'status')&&c.status!==null&&!['proposed','tested'].includes(c.status))return refus();
    }
    return {ok:true,modele:p};
  } catch {return refus();}
}
function nombre(v) {if(v===null||v==='')return null;if(typeof v==='number')return Number.isFinite(v)?v:undefined;return typeof v==='string'&&/^\d+(?:[.,]\d+)?$/.test(v.trim())?Number(v.trim().replace(',','.')):undefined;}

export function decrireChangementsRecette(payload,baseModele) {
  const dif=(a,b,keys)=>keys.filter(k=>Object.hasOwn(a,k)!==Object.hasOwn(b,k)||!egal(a[k],b[k]));
  const metadata=dif(payload.metadata,baseModele.metadata,CHAMPS_METADATA_RECETTE),contenu=dif(payload.contenu,baseModele.contenu,CHAMPS_CONTENU_RECETTE);
  if(payload.source_sans_thermomix!==baseModele.source_sans_thermomix)contenu.push('source_sans_thermomix');
  return {metadata,contenu,sansChangement:!metadata.length&&!contenu.length,metadataSeules:!!metadata.length&&!contenu.length};
}

export function modifierIngredient(modele,id,patch) {
  const p=copie(modele),ligne=p.contenu.ingredients.find(l=>l.id===id);if(!ligne)return p;
  const admis=garder(patch,LIGNE.filter(k=>!['id','source_text','verification_state','evidence','uncertain','substituted_from'].includes(k)));
  if(Object.entries(admis).some(([k,v])=>!egal(ligne[k],v)))Object.assign(ligne,admis,{verification_state:'to_verify',evidence:'manual'},Object.hasOwn(ligne,'uncertain')?{uncertain:false}:{});
  return p;
}
export function confirmerIngredient(modele,id,verifie) {const p=copie(modele),l=p.contenu.ingredients.find(i=>i.id===id);if(l){l.verification_state=verifie?'verified':'to_verify';if(verifie&&Object.hasOwn(l,'uncertain'))l.uncertain=false;}return p;}
export function modifierEtape(modele,id,text) {const p=copie(modele),s=p.contenu.steps.find(x=>x.id===id);if(s&&s.text!==text){s.text=text;delete s.timers;Object.assign(s,detectTimers(text));}return p;}
export function deplacerElement(modele,liste,id,sens) {if(liste==='ingredients'&&Object.hasOwn(modele.contenu,'ingredient_structure'))return deplacerBlocIngredients(modele,id,sens).modele||copie(modele);const p=copie(modele),rows=p.contenu[liste];if(!['ingredients','steps'].includes(liste))return p;const i=rows.findIndex(x=>x.id===id),j=i+sens;if(i>=0&&j>=0&&j<rows.length&&[-1,1].includes(sens)){[rows[i],rows[j]]=[rows[j],rows[i]];if(liste==='steps')rows.forEach((s,k)=>s.position=k+1);}return p;}
export function retirerElement(modele,liste,id) {const p=copie(modele);if(['ingredients','steps'].includes(liste)){p.contenu[liste]=p.contenu[liste].filter(x=>x.id!==id);if(liste==='steps')p.contenu.steps.forEach((s,k)=>s.position=k+1);if(liste==='ingredients'&&Array.isArray(p.contenu.ingredient_structure?.blocks))p.contenu.ingredient_structure.blocks=p.contenu.ingredient_structure.blocks.filter(b=>b.kind!=='ingredient'||b.ingredient_id!==id);}return p;}

export function construireContenuRecette(payload,{base=null,intention='correction',sourceSansThermomix=null,journal=null}={}) {
  const validation=validerModeleRecette(payload,{publication:true});if(!validation.ok)return null;
  const c=copie(validation.modele.contenu);
  const ingredientsSource=journal?creerModeleRecette({...(base?{recipe:{id:base.recipe_id},version:base}:{}),journal}).contenu.ingredients:base?.ingredients||[];
  const culinaires=['quantity','unit_id','unit_text','name_text','preparation','optional','ingredient_id'];
  for(const ligne of c.ingredients){
    const ancienne=ingredientsSource.find(i=>ligne.id?i.id===ligne.id:egal(i,ligne));
    if(ancienne&&culinaires.every(k=>egal(ligne[k],ancienne[k])))continue;
    if(!ancienne&&ligne.evidence!=='manual'&&ligne.source_text)continue;
    // Le texte publié doit servir les mêmes valeurs aux exports, au chef et au lecteur.
    // La page et la version parente gardent le texte source d’origine, sans deuxième copie dans le brouillon.
    if(typeof ligne.name_text!=='string'||!ligne.name_text.trim()){
      if(ancienne||!ligne.source_text)return null;
      continue; // une ligne historique complète, sans structure éditée, reste documentaire
    }
    const q=ligne.quantity?.raw||'',u=ligne.unit_text||ligne.unit_id||'';
    ligne.source_text=[q,u,ligne.name_text].filter(Boolean).join(' ').trim()+(ligne.preparation?`, ${ligne.preparation}`:'')+(ligne.optional?' (facultatif)':'');
    ligne.evidence='manual';
  }
  c.constraints=copie(base?.constraints||{});c.provenance=copie(base?.provenance||{});
  if(base?.id&&Object.hasOwn(c.provenance,'derived_from'))c.provenance.derived_from=base.id;
  if(c.provenance.import_id&&!Object.hasOwn(c.provenance,'lu_le'))c.provenance.lu_le=typeof base?.created_at==='string'&&Number.isFinite(Date.parse(base.created_at))?new Date(base.created_at).toISOString():null;
  c.verification_state=c.ingredients.some(l=>l.verification_state!=='verified')||!base||!egal(c.steps,base.steps||[])?'to_verify':'verified';
  if(base?.provenance?.thermomix) {
    if(payload.source_sans_thermomix) {if(!sourceSansThermomix)return null;delete c.provenance.thermomix;delete c.provenance.thermomix_invalide;c.provenance.derived_from=base.id;c.provenance.thermomix_source_version_id=sourceSansThermomix.id;}
    else c.provenance.thermomix_invalide=true;
  }
  if(intention==='adaptation')c.status=c.status||'proposed';
  return c;
}
