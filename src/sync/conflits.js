// Gestes sur un conflit (spec § 5.5). « Garder celle d'ici » : la version locale est restaurée avec un updated_at
// NEUF et mise en file (le serveur l'acceptera : plus récente). « Garder celle d'ailleurs » : la version du serveur
// est écrite sans remise en file. Dans les deux cas le conflit disparaît. Plus de 30 jours : retiré.
// R-L3-30 : sur un conflit `renvoye` (R64), les deux gestes « Garder… » REFUSENT — à une exception, nommée dans
// `garderAilleurs` : une tombale venue d'ailleurs reste acceptable, parce que c'est la seule décision que R-L3-26
// ait laissée à la personne. Le drapeau est relu ici, À L'EXÉCUTION, parce que c'est là que la course se joue : le
// rendu peut avoir montré un conflit ordinaire, puis une passe de réception l'upgrader en « renvoyé » avant le
// clic — et « Garder celle d'ailleurs » écrirait alors la version qui vient de PERDRE l'arbitrage I7.
import { fermetureImportProtegee, importConcerne, gardeImportRelu } from './imports-clos.js';
import { syncNow } from './clock.js';
import { nettoyerChaines } from './lots.js';
import { fusionnerFichier, memeRemote, HASH_FICHIER } from './fichiers.js';
import { CLE_CYCLE_CONFIRME, recettesDe } from './cycle.js';
import { lireCycleRecette } from '../domain/cycle-recette.js';

async function protectionContenu(db,conflit,copie) {
  if (conflit.store === 'imports') {
    const current = await db.get('imports', conflit.record_id);
    if (fermetureImportProtegee(current, copie)) return null;
    if (importConcerne(current) || importConcerne(copie)) {
      const owner = (await db.get('sync_state', 'user_id'))?.value ?? null;
      if (conflit.user_id != null && conflit.user_id !== owner) return null;
      return { conditions: { imports: [{ key: conflit.record_id, fusion: gardeImportRelu(current) }],
        sync_state: [{ key: 'user_id', fusion: row => { if ((row?.value ?? null) !== owner) throw Error('Compte du conflit changé'); return null; } }] }, recettes: [] };
    }
  }
  if(!['recipes','recipe_versions','recipe_translations','substitutions','dish_recipe_links'].includes(conflit.store)) return {conditions:{},recettes:[]};
  let id=conflit.store==='recipes'?conflit.record_id:copie?.recipe_id;
  let version=null;
  if(!id&&copie?.recipe_version_id) {version=await db.get('recipe_versions',copie.recipe_version_id);id=version?.recipe_id;}
  if(!id) return null;
  const contexte=conflit.recipe_contexts?.find(c=>c.recipe_id===id);
  const expected=contexte?.expected_cycle_id??(conflit.store==='recipes'?lireCycleRecette(copie).id:null);
  const owner=(await db.get('sync_state','user_id'))?.value??null;
  const valide=row=>{if(row==null)return expected===null;const cycle=lireCycleRecette(row);return cycle.etat==='active'&&cycle.id===expected;};
  if(!valide(await db.get('recipes',id))) return null;
  const conditions={recipes:[{key:id,fusion:row=>{if(!valide(row)) throw Error('Cycle du conflit changé');return null;}}],sync_state:[{key:'user_id',fusion:row=>{if((row?.value??null)!==owner)throw Error('Compte du conflit changé');return null;}}]};
  if(version) conditions.recipe_versions=[{key:version.id,fusion:row=>{if(row?.recipe_id!==id)throw Error('Source du conflit changée');return null;}}];
  return {conditions,recettes:[{recipe_id:id,expected_cycle_id:expected,owner_id:owner,records:[{store:conflit.store,id:conflit.record_id}]}]};
}

// Rend `true` si le geste a été appliqué. `garderIci` écrit avec origin 'local' EXPRÈS : c'est la capture qui remet
// la fiche en file, et c'est précisément le renvoi voulu. Le retrait du conflit voyage dans la même transaction et
// reste interne (sync_conflicts n'est pas un magasin synchronisé : la capture ne le regarde pas).
export async function garderIci(db, conflit) {
  if(['cycle','import_cloture'].includes(conflit?.kind)) return false;
  if (conflit?.store === 'assistant_config') return false; // K-5 : ce magasin n'a jamais de conflit à trancher
  if (conflit?.renvoye === true) return false; // R-L3-30 : la version d'ici part déjà, rien à trancher ici
  if (conflit?.store === 'files') return garderIciFichier(db, conflit);
  const protection=await protectionContenu(db,conflit,conflit.local);
  if(!protection) return false;
  // Version locale nulle : la fiche a été supprimée ici pendant l'aller-retour. « Garder celle d'ici » veut alors
  // dire garder la suppression — jamais écrire une fiche sans clé, que la base refuserait. Le payload porte un
  // updated_at NEUF : sans lui, la capture mettrait en file une tombale sans heure, que le serveur refuserait
  // (motif « updated_at ») et qui finirait en quarantaine. La version du serveur sert de corps à la tombale.
  if (!conflit.local || typeof conflit.local !== 'object') {
    await db.mutate({
      deletes: { [conflit.store]: [conflit.record_id], sync_conflicts: [conflit.id] },
      origin: 'local',
      payloads: { [conflit.store]: { [conflit.record_id]: nettoyerChaines({ ...(conflit.server?.data || {}), updated_at: syncNow() }) } },
      ...protection,
    });
    return true;
  }
  // R-L3-27 : la fiche restaurée est NETTOYÉE avant d'être écrite. Un conflit ne porte que des magasins
  // synchronisés, donc la question ne se pose pas ailleurs. Raison : R61 nettoie à l'écriture et à la restauration,
  // mais une fiche écrite AVANT cette vague est encore sale en base ; son écho propre (le serveur reçoit ce que
  // `lots.js` nettoie) fait un conflit à instants égaux, et renvoyer la version sale faisait renettoyer le serveur,
  // revenir le conflit, indéfiniment — la boucle I4, ici même, dans le geste censé la clore. Un `Blob` traverse
  // intact : les octets d'une photo ne sont pas du texte.
  const fiche = nettoyerChaines({ ...conflit.local, updated_at: syncNow() });
  await db.mutate({ puts: { [conflit.store]: [fiche] }, deletes: { sync_conflicts: [conflit.id] }, origin: 'local', ...protection });
  return true;
}

export async function garderAilleurs(db, conflit) {
  if(['cycle','import_cloture'].includes(conflit?.kind)) return false; // la résolution doit conserver/réconcilier la commande explicite
  if (conflit?.store === 'assistant_config') return false; // K-5 : ce magasin n'a jamais de conflit à trancher
  const serveur = conflit.server;
  // R-L3-30 : refusé sur un conflit renvoyé — c'est ce geste-là qui écrasait la version d'ici par celle qui a
  // perdu l'arbitrage. SAUF quand la version d'ailleurs est une TOMBALE : là, le choix n'est pas « une version plus
  // vieille des données », c'est « est-ce que j'accepte la suppression ? » — la seule décision que R-L3-26 ait
  // laissée à la personne quand une tombale plus ancienne que la fiche locale arrive. La lui retirer ferait
  // disparaître l'entrée de journal pendant que la fiche locale repart : la suppression venue d'ailleurs serait
  // annulée sans un mot, le miroir exact de la perte muette que R-L3-26 a supprimée.
  if (conflit?.renvoye === true && !serveur?.deleted_at) return false;
  // Un conflit dont le serveur n'a pas joint sa version (clé nommée sans contenu) : il n'y a rien à appliquer. Aucune
  // fiche n'est inventée et le conflit RESTE — mieux vaut un conflit qui attend qu'une perte muette.
  if (!serveur || (!serveur.deleted_at && (!serveur.data || typeof serveur.data !== 'object'))) return false;
  const protection=await protectionContenu(db,conflit,serveur.data||conflit.local);
  if(!protection) return false;
  const puts = {};
  const deletes = { sync_conflicts: [conflit.id] };
  let conditions = protection.conditions;
  // Tombale : la suppression du serveur est appliquée ici. Sinon la version du serveur est écrite avec EXACTEMENT
  // son updated_at. Origine 'remote' dans les deux cas : rien ne repart (le serveur a déjà cette version).
  if (conflit.store === 'files') {
    // D-G15 / D-G16 : ni la version d'ailleurs ni sa tombale ne remplacent la ligne d'ici — remote suit le serveur. Ronde 1 (I-G3) : la fusion
    // porte sur la ligne RELUE dans la transaction (un blob arrivé depuis le conflit reste), à défaut sur l'instantané ; une tombale sans
    // ligne n'écrit rien. F-7 (§ 3.2) : un remote qui change lève l'erreur de réception, dans la même transaction.
    const data = serveur.deleted_at ? { remote: null } : serveur.data;
    conditions = { files: [{ key: conflit.record_id, fusion: (courant) => {
      const ici = courant ?? conflit.local ?? null;
      return ici || !serveur.deleted_at ? fusionnerFichier(ici, data, serveur.updated_at) : null;
    } }] };
    const avant = (await db.get('files', conflit.record_id)) ?? conflit.local ?? null;
    const cle = 'file_error:' + conflit.record_id;
    if (HASH_FICHIER.test(conflit.record_id) && !memeRemote(avant?.remote, data.remote) && (await db.get('sync_state', cle))?.value?.sens === 'reception') deletes.sync_state = [cle];
  } else if (serveur.deleted_at) deletes[conflit.store] = [conflit.record_id];
  else puts[conflit.store] = [{ ...serveur.data, updated_at: serveur.updated_at }];
  await db.mutate({ puts, deletes, origin: 'remote', conditions });
  return true;
}

// Lot G, ronde 1 (D-G15, I-G3) : « Garder celle d'ici » sur une ligne files. Jamais une suppression locale de files — une version d'ici nulle
// est refusée (le conflit reste) ; sinon la version d'ici est réécrite SUR la ligne relue dans la transaction : un blob arrivé depuis le conflit
// (copie téléchargée, original importé) reste. Origine 'local' : la capture remet la ligne en file si son remote est de ce compte (D-G8).
async function garderIciFichier(db, conflit) {
  if (!conflit.local || typeof conflit.local !== 'object') return false;
  const fiche = nettoyerChaines({ ...conflit.local, updated_at: syncNow() });
  await db.mutate({
    conditions: { files: [{ key: conflit.record_id, fusion: (courant) => (courant?.blob instanceof Blob ? { ...fiche, blob: courant.blob } : fiche) }] },
    deletes: { sync_conflicts: [conflit.id] },
    origin: 'local',
  });
  return true;
}

// R-L3-29 : « Ignorer » un conflit DÉJÀ RENVOYÉ (la version d'ici est repartie, § 5.5). Il retire l'entrée de
// journal et RIEN d'autre : le serveur acceptera cette version (elle est plus récente), et il n'y a aucune
// décision à prendre. Le drapeau est REVÉRIFIÉ ici — défense en profondeur : même appelé par erreur sur un conflit
// ordinaire, ce geste refuse, parce que celui-là attend vraiment une décision de la personne. Origine 'remote' :
// un retrait de journal n'est pas un geste sur les données et ne repart jamais au serveur.
export async function ignorerRenvoye(db, conflit) {
  if (conflit?.kind === 'import_cloture') return false;
  if (conflit?.store === 'assistant_config') return false; // K-5 : ce magasin n'a jamais de conflit à trancher
  if (conflit?.renvoye !== true) return false;
  await db.mutate({ deletes: { sync_conflicts: [conflit.id] }, origin: 'remote' });
  return true;
}

export async function purgerAnciens(db, maintenantMs = Date.now(), joursMax = 30) {
  const limite = maintenantMs - joursMax * 86400000;
  // Un `at` illisible ne se date pas : le conflit reste plutôt que d'être retiré par accident (la personne le voit
  // dans Réglages et peut trancher). Origine 'remote' : un retrait de journal n'est pas un geste sur les données.
  const vieux = (await db.getAll('sync_conflicts')).filter((c) => !['cycle','import_cloture'].includes(c.kind) && Date.parse(c.at) < limite).map((c) => c.id);
  if (vieux.length) await db.mutate({ deletes: { sync_conflicts: vieux }, origin: 'remote' });
  return vieux.length;
}

// Geste explicite après consultation de la copie : un état serveur confirmé est obligatoire.
// Les enfants refusés gardent leur copie : leur réponse serveur décrit le parent, pas leur propre contenu.
export async function abandonnerConflitCycle(db, conflit) {
  if(conflit?.kind!=='cycle'||conflit.store!=='recipes') return false;
  const id=conflit.record_id,owner=(await db.get('sync_state','user_id'))?.value??null;
  const confirmation=await db.get('sync_state',CLE_CYCLE_CONFIRME(id));
  if(!confirmation?.value?.data||confirmation.value.user_id!==owner) return false;
  const locale=await db.get('recipes',id),file=await db.getAll('outbox');
  const concerne=file.filter(e=>(e.user_id==null||e.user_id===owner)&&recettesDe(e).includes(id));
  const retirer=concerne.filter(e=>e.store==='recipes'&&e.id===id);
  const bloquer=concerne.filter(e=>!retirer.includes(e));
  const identique=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const garde=(attendu)=>courant=>{if(!identique(courant,attendu)) throw Error('La copie à relire a changé');return null;};
  try {
    await db.mutate({origin:'remote',puts:{recipes:[confirmation.value.data],...(bloquer.length?{outbox:bloquer.map(e=>({...e,lifecycle_blocked:true,last_error:'cycle'}))}:{})},
      deletes:{sync_conflicts:[conflit.id],outbox:retirer.map(e=>e.seq)},conditions:{
        sync_state:[{key:'user_id',fusion:row=>{if((row?.value??null)!==owner)throw Error('Compte changé');return null;}},{key:confirmation.key,fusion:garde(confirmation)}],
        sync_conflicts:[{key:conflit.id,fusion:garde(conflit)}],recipes:[{key:id,fusion:garde(locale)}],
        outbox:concerne.map(e=>({key:e.seq,fusion:garde(e)}))
      }});
    return true;
  } catch(e) {if(e.message==='La copie à relire a changé'||e.message==='Compte changé')return false;throw e;}
}
