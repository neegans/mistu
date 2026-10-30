import {ErreurInventaire,validerCommandeInventaire,validerLotInventaire,estLotProtege,lireRecuInventaire,projectionInventaireSeed,egalesInventaire} from '../domain/inventaire-format.js';
import {appliquerTransitionInventaire} from '../domain/inventaire-mutations.js';
import {MAGASINS_SOURCES_INVENTAIRE} from '../domain/inventaire-sources.js';
export const estCommandeInventaire=x=>x?.op==='inventory_change';
export const ciblesCommandeInventaire=c=>estCommandeInventaire(c)?[{store:'inventory',id:c.id}]:[];
export const lecturesCommandeInventaire=c=>estCommandeInventaire(c)?Object.entries(MAGASINS_SOURCES_INVENTAIRE).flatMap(([k,store])=>c.source?.[k]?[{store,id:c.source[k].id}]:[]):[];
export function preparerCommandesInventaire({puts={},commandes=[],lecture}={}){
 const fail=()=>{throw new ErreurInventaire('commande_non_couverte');};if(!Array.isArray(commandes)||commandes.length&&typeof lecture!=='function')fail();const covered=new Set(),ops=new Set(),expected=new Map();
 for(const c of commandes){if(!validerCommandeInventaire(c).ok||ops.has(c.operation_id))fail();ops.add(c.operation_id);const rows=(puts.inventory||[]).filter(r=>r.id===c.id);if(rows.length!==1||!validerLotInventaire(rows[0]).ok||!lireRecuInventaire(rows[0],c))fail();const before=expected.has(c.id)?expected.get(c.id):lecture('inventory',c.id)??null;expected.set(c.id,appliquerTransitionInventaire(c,before,{attendue:before}));covered.add('inventory:'+c.id);}
 for(const[id,row]of expected)if(!egalesInventaire(projectionInventaireSeed(row),projectionInventaireSeed(puts.inventory.find(r=>r.id===id))))fail();
 for(const r of puts.inventory||[])if(estLotProtege(r)&&!covered.has('inventory:'+r.id))fail();return covered;
}

export function idsSourcesSyncInventaire(stores={},entrees=[],champ){const ids=new Set();for(const r of stores.inventory||[])if(estLotProtege(r)&&r[champ])ids.add(r[champ]);for(const e of entrees){const c=e.payload;if(estCommandeInventaire(c)){const r=champ==='source_recipe_version_id'?c.source?.version:c.source?.history;if(r?.id)ids.add(r.id);}if(e.store==='inventory'&&estLotProtege(e.snapshot)&&e.snapshot[champ])ids.add(e.snapshot[champ]);}return ids;}
export const idsVersionsSourcesInventaire=(s,e)=>idsSourcesSyncInventaire(s,e,'source_recipe_version_id');
export const idsHistoriquesSourcesInventaire=(s,e)=>idsSourcesSyncInventaire(s,e,'source_cook_history_id');
