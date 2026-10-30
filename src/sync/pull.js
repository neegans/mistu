import {estLotProtege,validerLotInventaire} from '../domain/inventaire-format.js';
// Réception (spec § 5.5) : par table, pages par server_seq croissant ; le curseur n'avance qu'avec l'écriture de la
// page (même transaction). Règle I7, la même qu'à l'envoi : le plus récent gagne ; égal + identique = rien ;
// égal + différent = conflit — sauf assistant_config : K-5, la version du compte gagne, sans journal (et plus récent
// ici = remise en file, sans journal non plus). Tout ce qui s'écrit ici porte origin 'remote' : jamais recapturé.
import { preparerFermetureImport, importConcerne, gardeImportRelu } from './imports-clos.js';
import { SYNC_STORES, STORES } from '../model/schema.js';
import { logError } from '../core/log.js';
import { projectionFichier, remoteValide } from './tables.js';
import { conditionFichier, memeRemote, HASH_FICHIER } from './fichiers.js';
import { idCycle, porteCycle, fusionCycle, CLE_CYCLE_CONFIRME, gardeCompteCycle } from './cycle.js';
import { fusionEdition, CLE_EDITION_CONFIRMEE } from './cycle-edition.js';
import { estCommandeSources, ciblesCommandeSources, CLE_SOURCE_CONFIRMEE } from './commandes-sources.js';
import {estCommandeProtegee,ciblesCommandeProtegee,estLectureTraductionSignee,estPhaseJournalTraduction} from './commandes-traduction.js';
import {estLigneCuisine,validerMinuteurCuisine,validerSessionCuisine} from '../domain/cuisine-format.js';
import {CLE_REPARATION_IMPORTS_GERES} from '../domain/imports-geres.js';
import {protegerConflitsCycle} from './reponses.js';
import {CLE_EPOQUE_EDITEUR} from '../domain/brouillons-format.js';
import {lireCycleEdition,lireEtatRecette} from '../domain/cycle-edition.js';

// R-L3-12 : les versions AVANT les recettes. Le pointeur d'une recette reçue désigne presque toujours une version
// créée par le même geste, sur l'autre appareil : lue après la recette, elle serait encore inconnue ici et chaque
// adaptation venue d'ailleurs ressortirait en faux conflit de pointeur.
const ORDRE_PRIORITAIRE = ['recipe_versions'];

// jsonb RÉORDONNE les clés d'un objet : la copie du serveur revient presque toujours dans un autre ordre que la
// fiche locale. Comparées par JSON brut, deux fiches identiques feraient un conflit à chaque égalité d'instant.
// Les clés sont donc triées récursivement ; l'ordre d'un TABLEAU, lui, est du contenu (une liste d'étapes a un ordre).
function stable(valeur) {
  if (Array.isArray(valeur)) return valeur.map(stable);
  if (valeur && typeof valeur === 'object') {
    const trie = {};
    for (const cle of Object.keys(valeur).sort()) trie[cle] = stable(valeur[cle]);
    return trie;
  }
  return valeur;
}
const memeLecture = (a,b) => JSON.stringify(stable(a??null)) === JSON.stringify(stable(b??null));
const refuserLecture = () => {throw Object.assign(new Error('Fiche modifiée pendant la réception'),{code:'SYNC_SOURCE_CHANGED'});};
const refuserBibliotheque = () => {throw Object.assign(new Error('Bibliothèque changée pendant la réception'),{code:'SYNC_LIBRARY_CHANGED'});};
const refuserParent = () => {throw Object.assign(new Error('Édition parente changée pendant le renvoi'),{code:'SYNC_PARENT_CHANGED'});};

// Les deux fiches sont comparées SANS leur updated_at (R-L3-11) : l'égalité d'instant est déjà établie avant
// l'appel, et les deux chaînes qui portent ce même instant ne s'écrivent pas pareil ('.000Z' ici, '+00:00' là).
// Un champ `undefined` équivaut à son absence (JSON les confond) ; un champ `null`, non : c'est une valeur.
// Lot G (R56, D-G8) : une ligne `files` se compare sur sa PROJECTION serveur (CHAMPS_FILES_SERVEUR) — ni blob, ni syncable, ni created_at, qui
// ne voyagent pas : ce qui part est ce qui se compare.
export function identiques(a, b, table = null) {
  const sansHeure = (fiche) => { const { updated_at: _heure, ...reste } = (table === 'files' ? projectionFichier(fiche) : fiche) || {}; return stable(reste); };
  return JSON.stringify(sansHeure(a)) === JSON.stringify(sansHeure(b));
}

// R-L3-11 : PostgREST rend « 2026-10-13T11:00:00+00:00 », et des microsecondes quand il y en a ; le local porte
// « …:00.000Z ». Comparées comme des CHAÎNES, ces deux écritures du MÊME instant donnent `l > d` ('.' > '+',
// 'Z' > un chiffre) : l'écho de nos propres envois revenait en conflit à chaque réception. On compare des instants.
const instant = (valeur) => {
  const ms = Date.parse(valeur);
  return Number.isFinite(ms) ? ms : null;
};

export function decider({ locale, distante, table = null }) {
  if (['recipes','book_editions'].includes(table) && !distante.deleted_at && (porteCycle(locale)||porteCycle(distante.data)) && idCycle(locale)!==idCycle(distante.data)) return 'cycle';
  if (locale === undefined || locale === null) return distante.deleted_at ? 'ignorer' : 'ecrire';
  // Les deux heures, comparées comme des INSTANTS ; repli sur la chaîne si l'une est illisible, pour rester
  // déterministe. C'est la seule question que I7 pose — et elle se pose aussi à une tombale.
  const ici = instant(locale.updated_at), ailleurs = instant(distante.updated_at);
  const lisibles = ici !== null && ailleurs !== null;
  const l = String(locale.updated_at || ''), d = String(distante.updated_at || '');
  const plusRecentIci = lisibles ? ici > ailleurs : l > d;
  const plusRecentAilleurs = lisibles ? ailleurs > ici : d > l;
  // R-L3-26 (amende § 5.5) : une tombale aussi obéit à I7. La lettre de § 5.5 (« ligne reçue avec deleted_at →
  // suppression locale ») faisait gagner une tombale du 10 octobre contre une version locale du 12, sans conflit et
  // sans trace — une perte muette, et atteignable : `lireFile` écarte les entrées en quarantaine SANS produire
  // d'erreur, donc l'envoi « réussit », la réception se poursuit, et la tombale efface la fiche locale plus récente
  // dont l'envoi était justement bloqué (une fiche grossie au-delà de 512 Ko, par exemple). À instant ÉGAL la
  // tombale gagne : une suppression est le dernier mot sur cette heure. Plus ancienne, c'est la personne qui
  // tranche (« Garder celle d'ailleurs » applique alors la suppression) — jamais une suppression silencieuse.
  if (distante.deleted_at) return plusRecentIci ? 'conflit_renvoyer' : 'supprimer';
  if (plusRecentAilleurs) return 'ecrire';
  if (plusRecentIci) return 'conflit_renvoyer';
  // Lot G, ronde 1 (#2) : à instant égal, une ligne files d'ici SANS remote valide (true de L3, absent, nul) adopte le remote valide du serveur —
  // jamais un « conflit ». C'est le cas d'une ligne reçue par un client d'avant G (ficheFichier écrivait `true` ou effaçait remote, l'updated_at
  // du serveur verbatim), relue après la passe unique (D-G12) ; une ligne d'ici sans copie serveur confirmée n'a rien à défendre (I-G2).
  if (table === 'files' && !remoteValide(locale.remote) && remoteValide(distante.data?.remote)) return 'ecrire';
  return identiques(locale, distante.data, table) ? 'ignorer' : 'conflit';
}

// Spec assistant-par-le-compte K-5 (§ 5.5) : pour assistant_config, I7 s'applique SANS écran. `decider` reste pur et
// générique ; la règle du magasin se pose ici, après lui. Une tombale reçue suit le chemin générique : 'supprimer'
// (plus récente ou égale), 'renvoyer_seulement' (plus ancienne que la fiche d'ici) ou 'ignorer' (aucune fiche ici) —
// jamais 'ecrire' d'une tombale : elle porte l'ancienne data, clé comprise (S5/F6). `decider`
// ne rend jamais 'conflit' pour une tombale (il tranche sur `deleted_at` avant de comparer les contenus), donc la
// seule conversion vers 'ecrire' ne peut pas la toucher.
function regleDuMagasin(table, decision) {
  if (table !== 'assistant_config') return decision;
  if (decision === 'conflit') return 'ecrire';
  if (decision === 'conflit_renvoyer') return 'renvoyer_seulement';
  return decision;
}

// Une version est l'ancêtre d'une autre si on la retrouve en remontant parent_version_id (elle-même comprise).
// `vus` arrête une chaîne bouclée (fiche bricolée, archive incohérente) au lieu de tourner sans fin.
export function estAncetre(versions, candidatId, cibleId) {
  const parId = new Map(versions.map((v) => [v.id, v]));
  let courant = cibleId;
  const vus = new Set();
  while (courant && !vus.has(courant)) {
    if (courant === candidatId) return true;
    vus.add(courant);
    courant = parId.get(courant)?.parent_version_id || null;
  }
  return false;
}

// Forme d'une ligne reçue (R9, jeton « forme »). Une seule ligne douteuse fait refuser la PAGE ENTIÈRE : écrire la
// moitié d'une page puis avancer le curseur perdrait le reste pour toujours. `Object.hasOwn` : la clé doit être
// portée par l'objet nu, jamais héritée d'un prototype. Le server_seq est vérifié sur TOUTES les lignes, tombales
// comprises — c'est lui qui devient le curseur, et un curseur illisible ferait reprendre la table à zéro.
function refusDeForme(table, ligne, clePrimaire) {
  if (!Number.isFinite(ligne?.server_seq)) return { type: 'forme', status: null, message: 'server_seq ' + table };
  if (ligne.deleted_at) return null;
  const data = ligne.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { type: 'forme', status: null, message: 'data ' + table };
  if (!Object.hasOwn(data, clePrimaire) || data[clePrimaire] !== ligne.id) return { type: 'forme', status: null, message: 'cle ' + table };
  return null;
}

export function createPull({ db, transport, isActivitySynced = () => false, configSuitLeCompte = () => false, getUserId = () => null, surProgression = () => {}, limite = 1000 }) {
  // La fiche d'ici, plus récente, repart : une entrée `put` écrite EXPLICITEMENT (l'origine 'remote' de la page fait que
  // la capture ne la verrait pas). Une seule définition pour les deux chemins (conflit renvoyé, K-5 sans journal).
  const remiseEnFile = (table, ligne, locale, owner) => ({ user_id: owner, store: table, id: ligne.id, op: 'put', updated_at: locale.updated_at || null, tries: 0 });
  const verifierPortee = portee => {
    if(getUserId()!==portee.owner)throw new Error('Compte de synchronisation changé');
    if(db.idb!==portee.connexion)refuserBibliotheque();
  };
  const verifierEpoque = async portee => {
    verifierPortee(portee);
    const epoque=await db.get('sync_state',CLE_EPOQUE_EDITEUR);
    verifierPortee(portee);
    if(!memeLecture(epoque,portee.epoque))refuserBibliotheque();
  };

  // SYNC_STORES n'est pas modifié : seule la liste de réception est réordonnée (R-L3-12).
  function tables() {
    // K-9 : « assistant_config en dernier » repose sur l'ordre de déclaration de STORES (dont SYNC_STORES est dérivée), pas sur ORDRE_PRIORITAIRE.
    const retenues = SYNC_STORES.filter((t) => (t !== 'library_activity' || isActivitySynced()) && (t !== 'assistant_config' || configSuitLeCompte()));
    const prioritaires = ORDRE_PRIORITAIRE.filter((t) => retenues.includes(t));
    return [...prioritaires, ...retenues.filter((t) => !prioritaires.includes(t))];
  }

  // Pointeur de version (spec § 5.5) : si la version locale pointée n'est pas un ancêtre de celle qu'on reçoit, les
  // deux appareils ont adapté la recette en parallèle. La fiche reçue (plus récente) est écrite — l'original n'est
  // jamais réécrit et AUCUNE version n'est masquée : seul le pointeur est signalé, la personne tranchera.
  async function conflitDePointeur(ligne, locale, garderVersions = null) {
    const ici = locale?.current_version_id;
    const ailleurs = ligne.data?.current_version_id;
    if (!ici || !ailleurs || ici === ailleurs) return null;
    const versions = (await db.getAll('recipe_versions')).filter((v) => v.recipe_id === ligne.id);
    garderVersions?.(ligne.id,versions);
    // R-L3-12 : la version pointée par la fiche reçue n'est pas encore arrivée ici (table retardée, page suivante,
    // passe interrompue). Rien à comparer, donc rien à signaler : un conflit annoncé sur une chaîne qu'on ne
    // connaît pas encore serait faux, et il masquerait le vrai quand elle arriverait.
    if (!versions.some((v) => v.id === ailleurs)) return null;
    if (estAncetre(versions, ici, ailleurs)) return null;
    return { id: `recipes:${ligne.id}`, store: 'recipes', record_id: ligne.id, local: locale, server: { data: ligne.data, updated_at: ligne.updated_at, deleted_at: null }, at: new Date().toISOString(), kind: 'version' };
  }

  async function appliquerPage(table, lignes, bilan, curseur, tentative, reparationImports, portee, parentsInitiaux = new Map()) {
    verifierPortee(portee);
    const owner=portee.owner;
    const commandesSources=rows=>rows.filter(e=>(estCommandeProtegee(e)||estPhaseJournalTraduction(e))&&(e.user_id==null||e.user_id===owner));
    const fileInitiale=await db.getAll('outbox'),fileSources=commandesSources(fileInitiale),filesCibles=new Map();
    const cibleFile=(rows,store,id)=>rows.filter(e=>e.store===store&&e.id===id&&(e.user_id==null||e.user_id===owner));
    const garderFileCible=(store,id)=>{const lignes=cibleFile(fileInitiale,store,id);filesCibles.set(JSON.stringify([store,id]),{store,id,lignes});return lignes;};
    const signatureFile=JSON.stringify(stable(fileSources));
    const gardeFile={toutes:true,verifier:rows=>{
      if(JSON.stringify(stable(commandesSources(rows)))!==signatureFile)refuserLecture();
      for(const c of filesCibles.values())if(!memeLecture(cibleFile(rows,c.store,c.id),c.lignes))refuserLecture();
    }};
    const puts = {}; const deletes = {}; const conflits = []; const refile = [];
    // Lot G, ronde 1 (#4, I-G3) : les lignes files ne s'écrivent pas depuis l'instantané lu plus haut (`locale`, hors transaction) mais par une
    // condition `fusion` refaite sur la ligne RELUE dans la transaction de la page (conditionFichier) : une copie téléchargée ou un original
    // importé pendant la page n'est jamais effacé. Une clé par fiche (la dernière ligne reçue d'une même clé gagne, comme un put).
    const fusions = new Map(), confirmations = new Map(), parents = new Map(), versionsLues = new Map();
    // Un renvoi est une copie de cette lecture, avec ses vrais contextes. Une intention
    // déjà en attente garde sa base et sa place : elle ne peut être rebâtie implicitement.
    async function renvoiCycle(ligne,locale) {
      if(garderFileCible(table,ligne.id).length)return null;
      const entree={...remiseEnFile(table,ligne,locale,owner),snapshot:structuredClone(locale)};
      if(table==='book_editions')return lireCycleEdition(locale).etat==='active'
        ?{...entree,edition_contexts:[{edition_id:locale.id,expected_cycle_id:idCycle(locale)}]}:null;
      const eid=locale.edition_id??null,parent=eid?await db.get('book_editions',eid):null;
      if(eid){
        // La première lecture de ce parent reste la base pour toute la page et ses reprises.
        // Une autre garde peut refuser avant celle du parent : relire ne vaut pas rebâtir une intention.
        if(parentsInitiaux.has(eid)&&!memeLecture(parent,parentsInitiaux.get(eid)))refuserParent();
        if(!parentsInitiaux.has(eid))parentsInitiaux.set(eid,parent);
        parents.set(eid,{key:eid,fusion:actuelle=>{
        if(!memeLecture(actuelle,parentsInitiaux.get(eid)))refuserParent();
        return null;
      }});if(garderFileCible('book_editions',eid).length)return null;}
      if(lireEtatRecette(locale,parent).etat!=='active')return null;
      return {...entree,recipe_id:locale.id,expected_cycle_id:idCycle(locale),expected_edition_id:eid,
        ...(parent?{edition_contexts:[{edition_id:eid,expected_cycle_id:idCycle(parent),recipe_id:locale.id}]}:{})};
    }
    // F-7 (§ 3.2) : un remote qui CHANGE — ligne écrite ou tombale — lève l'erreur de réception posée sur l'ancien, dans la même transaction ;
    // une erreur d'ENVOI reste (trop_gros, type : la renvoyer échouerait encore). Remotes comparés validés (memeRemote : true, absent → aucun).
    async function leverErreurReception(id, avant, apres) {
      if (!HASH_FICHIER.test(id) || memeRemote(avant, apres)) return;
      const cle = 'file_error:' + id;
      if ((await db.get('sync_state', cle))?.value?.sens === 'reception') (deletes.sync_state ||= []).push(cle);
    }
    const clePrimaire = STORES[table].keyPath;
    let supprimees = 0; let recues = 0;
    for (const ligne of lignes) {
      const refus = refusDeForme(table, ligne, clePrimaire);
      if (refus) return { erreur: refus };
      const locale = await db.get(table, ligne.id);
      const commandes=fileSources.filter(e=>(estPhaseJournalTraduction(e)?[{store:e.store,id:e.id}]:ciblesCommandeProtegee(e.payload)).some(r=>r.store===table&&r.id===ligne.id));
      const cleSource=CLE_SOURCE_CONFIRMEE(table,ligne.id),confirmationSource=await db.get('sync_state',cleSource);
      const geree=row=>!!row&&(row.source_state!==undefined||row.source_revision!==undefined||row.source_copy!==undefined||row.index_storage!==undefined||row.index_decision_revision!==undefined||row.index_application_receipts!==undefined||row.index_resolved_occurrences!==undefined||estLectureTraductionSignee(table,row)||estLigneCuisine(table,row)||table==='inventory'&&estLotProtege(row));
      if(commandes.length||confirmationSource||geree(locale)||geree(ligne.data)){
        confirmations.set(cleSource,{key:cleSource,fusion:row=>{if(JSON.stringify(stable(row??null))!==JSON.stringify(stable(confirmationSource??null)))throw Object.assign(new Error('Confirmation source modifiée pendant la réception'),{code:'SYNC_CONFIRMATION_CHANGED'});return null;}});
        if(confirmationSource?.value?.user_id===owner&&Number.isFinite(confirmationSource.value.server_seq)&&confirmationSource.value.server_seq>ligne.server_seq)continue;
        const cuisine=estLigneCuisine(table,locale)||estLigneCuisine(table,ligne.data),inventaire=table==='inventory'&&(estLotProtege(locale)||estLotProtege(ligne.data));
        if(inventaire&&(!Number.isSafeInteger(ligne.server_seq)||ligne.server_seq<0))return{erreur:{type:'forme'}};
        if(inventaire&&!ligne.deleted_at&&!validerLotInventaire(ligne.data).ok)return{erreur:{type:'forme'}};
        if(cuisine&&!ligne.deleted_at&&!(table==='timer_launches'?validerMinuteurCuisine(ligne.data):validerSessionCuisine(ligne.data)).ok)return{erreur:{type:'forme'}};
        const confirme={user_id:owner,data:ligne.deleted_at?null:cuisine||inventaire?ligne.data:{...ligne.data,updated_at:ligne.updated_at},server_seq:ligne.server_seq,updated_at:ligne.updated_at,deleted_at:ligne.deleted_at??null};
        (puts.sync_state||=[]).push({key:cleSource,value:confirme});
        // L'intention locale garde toutes ses lignes, même bloquée ou face à une tombale.
        // Seul son accusé exact ou une comparaison explicite pourra la résoudre.
        if(commandes.length){fusions.set(ligne.id,{key:ligne.id,fusion:courante=>courante??null});recues+=1;continue;}
        if(cuisine||inventaire){
          if(ligne.deleted_at){(deletes[table]||=[]).push(ligne.id);supprimees+=1;}
          else{fusions.set(ligne.id,{key:ligne.id,fusion:courante=>{if(!identiques(courante,locale,table))throw Object.assign(new Error('Cuisine modifiée pendant réception'),{code:'SYNC_SOURCE_CHANGED'});return ligne.data;}});recues+=1;}
          continue;
        }
      }
      if (table === 'imports' && (importConcerne(locale) || importConcerne(ligne.data))) {
        fusions.set(ligne.id, { key: ligne.id, fusion: gardeImportRelu(locale) });
        const fermeture = await preparerFermetureImport(locale, ligne, owner);
        if (fermeture) {
          (puts.imports ||= []).push(fermeture.row);
          if (!await db.get('sync_conflicts', fermeture.copie.id)) conflits.push(fermeture.copie);
          if (fermeture.entree) refile.push(fermeture.entree);
          recues += 1;
          continue;
        }
      }
      const decision = regleDuMagasin(table, decider({ locale, distante: ligne, table }));
      if (['recipes','book_editions'].includes(table) && !ligne.deleted_at && (decision==='cycle'||porteCycle(ligne.data)||porteCycle(locale))) {
        const commandes=garderFileCible(table,ligne.id).filter(e=>e.op==='lifecycle');
        const serveur={...ligne.data,updated_at:ligne.updated_at};
        const fusion=table==='book_editions'?fusionEdition:fusionCycle,cleConfirmee=table==='book_editions'?CLE_EDITION_CONFIRMEE:CLE_CYCLE_CONFIRME;
        const cle = cleConfirmee(ligne.id), connue = await db.get('sync_state', cle);
        confirmations.set(cle, { key: cle, fusion: actuelle => {
          if (JSON.stringify(actuelle ?? null) !== JSON.stringify(connue ?? null)) throw Object.assign(new Error('Confirmation reçue pendant la page'), { code: 'SYNC_CONFIRMATION_CHANGED' });
          return null;
        } });
        if (connue?.value?.user_id === owner && Number.isFinite(connue.value.server_seq) && connue.value.server_seq > ligne.server_seq) continue;
        const resultat=fusion(locale,serveur,commandes);
        let retenue=resultat.row;
        // Le cycle serveur brut doit être le même. Un cycle seulement égal après une
        // commande pendante reste traité par la superposition, sans nouveau put ordinaire.
        const contenu=!resultat.conflit&&!resultat.bloquees.length&&idCycle(locale)===idCycle(serveur);
        if(contenu){
          if(['ignorer','conflit','conflit_renvoyer'].includes(decision))retenue=locale;
          if(['conflit','conflit_renvoyer'].includes(decision)){
            const renvoi=decision==='conflit_renvoyer'?await renvoiCycle(ligne,locale):null;
            if(renvoi)refile.push(renvoi);
            conflits.push({id:`${table}:${ligne.id}`,store:table,record_id:ligne.id,local:locale,
              server:{data:ligne.data,updated_at:ligne.updated_at,deleted_at:null},at:new Date().toISOString(),kind:'donnees',...(renvoi?{renvoye:true}:{})});
          }else if(decision==='ecrire'&&table==='recipes'){
            const pointeur=await conflitDePointeur(ligne,locale,(id,versions)=>versionsLues.set(id,versions));
            if(pointeur)conflits.push(pointeur);
          }
        }
        fusions.set(ligne.id,{key:ligne.id,fusion:courant=>{
          if(!memeLecture(courant,locale))refuserLecture();
          return retenue;
        }});
        (puts.sync_state ||= []).push({key:cleConfirmee(ligne.id),value:{data:serveur,server_seq:ligne.server_seq,user_id:owner}});
        if(resultat.conflit||resultat.bloquees.length) conflits.push({id:`${table}:${ligne.id}`,store:table,record_id:ligne.id,local:locale,server:ligne,at:new Date().toISOString(),kind:'cycle'});
        for(const e of resultat.bloquees) (puts.outbox ||= []).push({...e,lifecycle_blocked:true,last_error:'cycle'});
        recues+=1;continue;
      }
      if (decision === 'renvoyer_seulement') { // K-5 : plus récent ici → repart, SANS entrée de journal
        refile.push(remiseEnFile(table, ligne, locale, owner));
        continue;
      }
      if (decision === 'supprimer') {
        if (table === 'files') {
          // D-G15 / N-4 : une tombale files dit « cette copie serveur n'existe plus », jamais « efface l'original » : ligne et blob restent,
          // remote passe à null. Comptée en recues, jamais en supprimees ; rien ne repart (origine remote).
          fusions.set(ligne.id, conditionFichier(ligne.id, locale, { remote: null }, ligne.updated_at));
          await leverErreurReception(ligne.id, locale?.remote, null);
          recues += 1;
          logError('sync.pull.tombale_files', { table });
          continue;
        }
        (deletes[table] ||= []).push(ligne.id); supprimees += 1; continue;
      }
      if (decision === 'ignorer') continue;
      if (decision === 'ecrire') {
        // L'updated_at du serveur est stocké VERBATIM (R-L3-11) : microsecondes et décalage compris. Un renvoi doit
        // être égal, côté serveur, à la microseconde — et le serveur a pu ajuster l'heure à l'écriture (R25).
        if (table === 'files') {
          // D-G16 : une ligne files n'apporte JAMAIS d'octets ici — une seule règle de fusion (fusionnerFichier, refaite sur la ligne relue en
          // transaction : conditionFichier) : blob, syncable et created_at locaux gardés, remote tel que la ligne reçue le porte (D-G12 : jamais
          // `true`, jamais effacé sous un blob local).
          fusions.set(ligne.id, conditionFichier(ligne.id, locale ?? null, ligne.data, ligne.updated_at));
          await leverErreurReception(ligne.id, locale?.remote, ligne.data?.remote);
        } else (puts[table] ||= []).push({ ...ligne.data, updated_at: ligne.updated_at });
        recues += 1;
        if (table === 'recipes') {
          const pointeur = await conflitDePointeur(ligne, locale);
          if (pointeur) conflits.push(pointeur);
        }
        continue;
      }
      // R-L3-26 : la version du serveur, telle qu'il la porte VRAIMENT. Pour une tombale, `data` est nul — le
      // serveur garde bien le corps de la ligne supprimée, mais le journal ne doit pas offrir à la personne une
      // fiche qui n'existe plus là-bas, et c'est `deleted_at` qui dit à `garderAilleurs` d'appliquer la suppression.
      const versionServeur = ligne.deleted_at
        ? { data: null, updated_at: ligne.updated_at, deleted_at: ligne.deleted_at }
        : { data: ligne.data, updated_at: ligne.updated_at, deleted_at: null };
      // R-L3-29 : un conflit dont la version d'ici REPART est marqué comme tel. Il n'y a rien à trancher — le
      // serveur acceptera cette version, elle est plus récente — et l'entrée de journal n'est là que pour que la
      // personne le sache. Réglages ne lui offre donc que « Ignorer », et l'accusé du serveur la range tout seul.
      conflits.push({ id: `${table}:${ligne.id}`, store: table, record_id: ligne.id, local: locale, server: versionServeur, at: new Date().toISOString(), kind: 'donnees', ...(decision === 'conflit_renvoyer' ? { renvoye: true } : {}) });
      // conflit_renvoyer : la fiche d'ici est plus récente, elle est conservée ET remise en file — le serveur
      // l'acceptera. L'entrée est écrite EXPLICITEMENT : l'origine 'remote' de la transaction fait que la capture
      // ne la verrait pas (c'est voulu : rien d'autre dans cette page ne doit repartir).
      if (decision === 'conflit_renvoyer') refile.push(remiseEnFile(table, ligne, locale, owner));
    }
    if (refile.length) (puts.outbox ||= []).push(...refile);
    // Curseur atomique : il part dans la MÊME transaction que les écritures de sa page. Une page refusée plus haut
    // n'arrive jamais ici, donc rien n'est écrit et le curseur ne bouge pas : la page sera relue telle quelle. Et il
    // ne RECULE jamais — une page dont les server_seq sont sous le curseur est écrite, mais sans le ramener en
    // arrière, sinon tout ce qui est déjà reçu repartirait en boucle.
    const dernier = Math.max(...lignes.map((l) => l.server_seq));
    (puts.sync_state ||= []).push({ key: `cursor:${table}`, value: Math.max(curseur, dernier) });
    try {
      await db.mutate({ puts, deletes, origin: 'remote', conditions: { ...(fusions.size ? { [table]: [...fusions.values()] } : {}),
        ...(parents.size?{book_editions:[...parents.values()]}:{}),
        ...(versionsLues.size?{recipe_versions:[{toutes:true,verifier:rows=>{for(const[id,versions]of versionsLues)if(!memeLecture(rows.filter(r=>r.recipe_id===id),versions))refuserLecture();}}]}:{}),
        ...(conflits.length?{sync_conflicts:protegerConflitsCycle(conflits)}:{}), outbox:[gardeFile], sync_state: [gardeCompteCycle(owner,getUserId),
        {key:CLE_EPOQUE_EDITEUR,fusion:epoque=>{verifierPortee(portee);if(!memeLecture(epoque,portee.epoque))refuserBibliotheque();return null;}},
        ...(table==='imports'?[{key:CLE_REPARATION_IMPORTS_GERES,fusion:courante=>{if(JSON.stringify(stable(courante??null))!==JSON.stringify(stable(reparationImports)))throw Object.assign(new Error('Réparation des imports modifiée pendant la réception'),{code:'SYNC_IMPORTS_REPAIR_CHANGED'});return null;}}]:[]),...confirmations.values()] } });
    } catch (error) {
      if (['SYNC_CONFIRMATION_CHANGED','SYNC_SOURCE_CHANGED'].includes(error.code) && tentative < 3) return appliquerPage(table, lignes, bilan, curseur, tentative + 1,reparationImports,portee,parentsInitiaux);
      throw error;
    }
    bilan.recues += recues;
    bilan.supprimees += supprimees;
    bilan.conflits += conflits.length;
    return { erreur: null, dernier };
  }

  async function recevoir() {
    const bilan = { recues: 0, supprimees: 0, conflits: 0, erreur: null };
    const owner=getUserId(),connexion=await db.open(),epoque=await db.get('sync_state',CLE_EPOQUE_EDITEUR);
    const portee={owner,connexion,epoque};
    verifierPortee(portee);
    const liste = tables();
    for (const [i, table] of liste.entries()) {
      surProgression({ phase: 'reception', table, n: i + 1, total: liste.length });
      // Capturer la garde AVANT le curseur : une réparation à partir de cet instant invalide la page en vol.
      // Sinon une ancienne réponse partie de50 pourrait remettre80 après le reset0 et perdre les fragments à relire.
      let reparationImports=table==='imports'?(await db.get('sync_state',CLE_REPARATION_IMPORTS_GERES))??null:null,reprisesImports=0;
      let curseur = (await db.get('sync_state', `cursor:${table}`))?.value || 0;
      for (;;) {
        await verifierEpoque(portee);
        const { lignes, erreur } = await transport.lire(table, curseur, limite);
        if(getUserId()!==owner) {bilan.erreur={type:'auth',status:null};return bilan;}
        await verifierEpoque(portee);
        if (erreur) { bilan.erreur = erreur; logError('sync.pull', { table, reason: erreur.type, status: erreur.status }); return bilan; }
        let r;
        try{
          const reparationCourante=table==='imports'?(await db.get('sync_state',CLE_REPARATION_IMPORTS_GERES))??null:null;
          if(getUserId()!==owner){bilan.erreur={type:'auth',status:null};return bilan;}
          if(table==='imports'&&JSON.stringify(stable(reparationCourante))!==JSON.stringify(stable(reparationImports)))throw Object.assign(new Error('Réparation des imports modifiée pendant la réception'),{code:'SYNC_IMPORTS_REPAIR_CHANGED'});
          if (!lignes.length) break;
          r = await appliquerPage(table, lignes, bilan, curseur,0,reparationImports,portee);
        }catch(e){
          if(e?.code!=='SYNC_IMPORTS_REPAIR_CHANGED'||reprisesImports>=2)throw e;
          if(getUserId()!==owner){bilan.erreur={type:'auth',status:null};return bilan;}
          reprisesImports++;reparationImports=(await db.get('sync_state',CLE_REPARATION_IMPORTS_GERES))??null;
          curseur=(await db.get('sync_state','cursor:imports'))?.value||0;
          if(getUserId()!==owner){bilan.erreur={type:'auth',status:null};return bilan;}continue;
        }
        if (r.erreur) { bilan.erreur = r.erreur; logError('sync.pull.forme', { table }); return bilan; }
        // Une page courte ne clôt PAS la table : la suivante est demandée, et c'est une page vide qui arrête. Et le
        // curseur doit avancer — un serveur qui renverrait la même page ferait tourner cette boucle sans fin.
        if (!(r.dernier > curseur)) break;
        curseur = r.dernier;
      }
    }
    return bilan;
  }

  return { recevoir };
}
