// Le rapatriement de l'image d'une page web (lot F « Les plats en images », spec docs/superpowers/specs/2026-10-19-plats-en-images-design.md § 3.4) :
// des fonctions PURES (adresse admise, comparaison, candidat) et UN appel, `lireImageWeb`, par la passerelle de l'assistant avec la session (outil
// `image-web`) — jamais un fetch direct vers l'hôte de l'image (I-F3 : l'adresse IP de l'appareil ne part jamais chez lui). La réponse est une
// DONNÉE HOSTILE : chaque champ lu par Object.hasOwn, le type dans la liste, la taille bornée AVANT tout décodage, le base64 relu à la longueur
// exacte (base64.js). Aucune fonction ne lève ; le jeton n'entre dans aucun objet rendu.
import { appelerAssistant, echecDomaine } from './passerelle.js';
import { lireOctetsBase64 } from './base64.js';
import { lienSignet } from '../core/lien.js';
import { HASH } from '../model/schema.js';
import { COVER_INPUT_MIME } from '../sync/mime.js';

// R-F-4, D-F13 : 2 Mio par image (le même littéral que LIMITES_IMAGE.octets du serveur, épinglé des deux côtés) ; la réponse JSON d'une image à la
// borne (2 796 204 caractères de base64 plus une enveloppe de moins de 4 Kio) tient dans 3 Mio ; 90 s couvrent le téléchargement côté serveur
// (30 s au plus) ET le transfert de la réponse vers le téléphone.
export const LIMITES_IMAGE_WEB = Object.freeze({ url: 2048, octets: 2 * 1024 * 1024, corpsReponse: 3 * 1024 * 1024, tentativeMs: 90000, types: COVER_INPUT_MIME });
// Liste FERMÉE des raisons que lireImageWeb et rapatrierPhotoWeb peuvent rendre (journal, tests) ; les définitives disent que l'image de CETTE
// adresse ne sera jamais utilisable : « Réessayer » n'est plus offert pour elle (D-F17).
export const RAISONS_PHOTO_WEB = Object.freeze(['adresse', 'fiche_absente', 'fiche_changee', 'photo_manuelle', 'deja_la', 'vol_tenu', 'hors_ligne', 'non_connecte', 'non_admis', 'quota',
  'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'interdit', 'inaccessible', 'pas_une_image', 'image_trop_lourde', 'illisible',
  'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde', 'ecriture']);
export const RAISONS_DEFINITIVES = Object.freeze(['interdit', 'pas_une_image', 'image_trop_lourde', 'type', 'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde']);

const ASCII_VISIBLE = /^[\x21-\x7e]+$/;
// Une adresse d'image admise (I-F2) : https seul, ASCII visible, ≤ 2 048 AVANT et APRÈS la normalisation de lienSignet (qui retire les identifiants
// et peut allonger par encodage : un href qui dépasse serait refusé par le serveur, échec permanent). Rend l'href normalisé, sinon null.
export function adresseImageAdmise(valeur) {
  try {
    if (typeof valeur !== 'string' || valeur.length > LIMITES_IMAGE_WEB.url || !ASCII_VISIBLE.test(valeur)) return null;
    const l = lienSignet(valeur);
    if (!l.ok || new URL(l.href).protocol !== 'https:') return null;
    return l.href.length <= LIMITES_IMAGE_WEB.url && ASCII_VISIBLE.test(l.href) ? l.href : null;
  } catch { return null; }
}
// UNE comparaison d'adresses d'image (candidat, garde des trois champs, raisons gardées, S-10) : sous leur forme normalisée ; refusée = jamais égale.
export function memeAdresseImage(a, b) {
  const x = adresseImageAdmise(a);
  return x !== null && x === adresseImageAdmise(b);
}
// UNE définition du « pointeur valide » d'une photo du plat (candidat ici, fabriquerLectureWeb dans lecture-web.js) : un pointeur hostile vaut « pas de photo ».
export const pointeurValide = (f) => typeof f?.photo_sha256 === 'string' && HASH.test(f.photo_sha256);
// D-F10 : l'adresse à rapatrier pour cette fiche, ou null — jamais quand la personne a sa photo (origine photo, image, ou inconnue, avec un pointeur
// valide), jamais quand cette image-là est déjà en place ; une photo web se remplace par une image différente.
export function candidatPhotoWeb(fiche, imageUrl) {
  const href = adresseImageAdmise(imageUrl);
  if (href === null) return null;
  const photo = pointeurValide(fiche);
  if (photo && fiche.photo_origin !== 'web') return null;
  if (photo && memeAdresseImage(fiche.photo_source_url, href)) return null;
  return href;
}
const echecDe = (raison, extra = {}) => ({ etat: 'echec', raison, extra });
// UN POST { outil: 'image-web', corps: { url } } (corpsMax 3 Mio : le défaut de 2 Mio de la passerelle ne suffit pas à une image à la borne).
// Rend { etat: 'recue', blob, urlFinale } ou { etat: 'echec', raison ∈ RAISONS_PHOTO_WEB, extra }. `config` : tests seulement (P-3).
// Forme d'appel : lireImageWeb({ url, session }, { fetch, signal, tentativeMs = 90 000, config }) ; la déstructuration vit DANS le try (ronde 1) :
// des arguments nuls rendent un échec, jamais un rejet.
export async function lireImageWeb(args, opts) {
  try {
    const { url, session } = args ?? {};
    const { fetch, signal, tentativeMs = LIMITES_IMAGE_WEB.tentativeMs, config } = opts ?? {};
    const href = adresseImageAdmise(url);
    if (href === null) return echecDe('adresse');
    const r = await appelerAssistant('image-web', { url: href }, { fetch, session, config, signal, tentativeMs, corpsMax: LIMITES_IMAGE_WEB.corpsReponse });
    if (r.raison) { const d = echecDomaine(r); return echecDe(RAISONS_PHOTO_WEB.includes(d.raison) ? d.raison : 'interne', d.extra ?? {}); }
    const c = r.corps;
    const lu = (k) => (c && typeof c === 'object' && Object.hasOwn(c, k) ? c[k] : undefined);
    const type = lu('type'); const taille = lu('taille');
    if (typeof type !== 'string' || !LIMITES_IMAGE_WEB.types.includes(type)) return echecDe('illisible');
    if (!Number.isSafeInteger(taille) || taille < 1) return echecDe('illisible');
    if (taille > LIMITES_IMAGE_WEB.octets) return echecDe('image_trop_lourde');
    const octets = lireOctetsBase64(lu('octets'), taille);
    if (octets === null) return echecDe('illisible');
    return { etat: 'recue', blob: new Blob([octets], { type }), urlFinale: adresseImageAdmise(lu('url_finale')) };
  } catch { return echecDe('interne'); }
}
