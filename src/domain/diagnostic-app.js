// Projection fermée du diagnostic partageable. Aucun IO, texte métier ou erreur brute.
import {releaseValide} from '../core/livraison-format.js';
const objet = v => v && typeof v === 'object' && !Array.isArray(v);
const compte = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
const enumDe = (v, valeurs, repli='inconnu') => valeurs.includes(v) ? v : repli;
const version = v => releaseValide(v) ? v : null;
const versionApp = v => typeof v === 'string' && releaseValide(v+'-1') ? v : null;
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v ? v : null;
const comptes = (v, cles) => Object.fromEntries(cles.map(k=>[k,compte(v?.[k])]));
const ferme = (v, cles) => objet(v) && Object.keys(v).length === cles.length && cles.every(k=>Object.hasOwn(v,k));
const worker = v => v === null || v === undefined ? null : {release:version(v.release),complete:typeof v.complete==='boolean'?v.complete:null};
function preparation(v) {
  if(!ferme(v,['format','etat','observe_le','recettes','medias','octets_connus']) || v.format!==1 || !['pret','partiel','perime','inconnu'].includes(v.etat))return null;
  const r=['total','disponibles','indisponibles','inconnues'],m=['selectionnes','exclus','utilisables','manquants','illisibles','inconnus'];
  if(!ferme(v.recettes,r)||!ferme(v.medias,m)||r.some(k=>compte(v.recettes[k])===null)||m.some(k=>compte(v.medias[k])===null))return null;
  if(v.recettes.disponibles+v.recettes.indisponibles+v.recettes.inconnues!==v.recettes.total || v.medias.utilisables+v.medias.manquants+v.medias.illisibles+v.medias.inconnus!==v.medias.selectionnes)return null;
  if(v.observe_le!==null&&!date(v.observe_le)||v.octets_connus!==null&&compte(v.octets_connus)===null)return null;
  return{format:1,etat:v.etat,observe_le:date(v.observe_le),recettes:comptes(v.recettes,r),medias:comptes(v.medias,m),octets_connus:compte(v.octets_connus)};
}
export function projeterDiagnosticApp(source={}) {
  const l=source?.livraison;
  return{format:1,version:versionApp(source?.version),observe_le:date(source?.observe_le),
    livraison:{etat:enumDe(l?.etat,['verifiee','incomplete','inconnue','incompatible','non_controlee'],'inconnue'),
      execution:{release:version(l?.execution?.release),mode:enumDe(l?.execution?.mode,['controlee','en_ligne_non_verifiee'],'inconnu')},
      controleur:worker(l?.controleur),actif:worker(l?.actif),attente:worker(l?.attente),
      raison:enumDe(l?.raison,['indisponible','delai','reponse_invalide','worker_change','portee_incompatible','livraison_incompatible','cache_incomplet','non_controlee','dispose'],null)},
    reseau:enumDe(source?.reseau,['en_ligne','hors_ligne']),proprietaire:enumDe(source?.proprietaire,['present','absent']),
    envois:comptes(source?.envois,['en_attente','bloques','conflits']),
    fichiers:comptes(source?.fichiers,['declares','locaux','manquants','octets_locaux']),
    stockage:{...comptes(source?.stockage,['utilisation_estimee','quota_estime']),persistant:typeof source?.stockage?.persistant==='boolean'?source.stockage.persistant:null},erreurs:comptes(source?.erreurs,['reseau','quota','refus','autre']),
    preparation:preparation(source?.preparation)};
}
export function texteDiagnosticApp(diagnostic) {
  return JSON.stringify(projeterDiagnosticApp(diagnostic),null,2);
}
