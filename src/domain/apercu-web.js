// Les aperçus des résultats web (lot UI-2 « Aperçus », spec docs/superpowers/specs/2026-10-23-experience-carnet-design.md § 6, D-UI-12) : UN appel,
// `lireApercusWeb`, par la passerelle de l'assistant avec la session (outil `apercu-web`, sans modèle) pour au plus cinq adresses — jamais un fetch
// direct vers un site (I-UI-2 : l'adresse IP de l'appareil ne part jamais chez lui). La réponse est une DONNÉE HOSTILE : chaque champ lu par
// Object.hasOwn, UNE entrée par adresse DEMANDÉE (une adresse absente de la réponse vaut `illisible` : rien n'est redemandé en boucle ; une adresse
// non demandée est ignorée), le type dans la liste des couvertures, la taille bornée AVANT tout décodage, le base64 relu à la longueur exacte
// (base64.js), puis LE mur de F sans ré-encodage (preparerPhotoDistante, reencoder: false : en-tête, puis structure — une image animée ou tronquée
// est refusée sans décodage, revue finale). Décodage adresse par adresse : un binaire à la fois
// (S-12). Aucune fonction ne lève ; le jeton n'entre dans aucun objet rendu.
import { appelerAssistant, echecDomaine } from './passerelle.js';
import { lireOctetsBase64 } from './base64.js';
import { COTE_MIN_DISTANT, preparerPhotoDistante } from '../core/image.js';
import { COVER_INPUT_MIME } from '../sync/mime.js';

// § 6 : 5 adresses de 2 048 points au plus ; 1 Mio par image (le `max` que la fonction passe à telechargerImage, épinglé des deux côtés : P-UI2-4, R-UI2-4 —
// si la sonde impose 2 Mio, les DEUX copies bougent ensemble) ; la réponse de cinq images à la borne (5 × 1 398 104 caractères de base64 plus l'enveloppe)
// tient dans 8 Mio ; 135 s = le délai de la passerelle, au-dessus du budget serveur de 60 s et du transfert de 7 Mio (≈ 56 s à 1 Mbit/s). `types` est
// COVER_INPUT_MIME (R-UI2-15), la liste des couvertures — jamais ALLOWED_MIME de typeAffichage (HEIC, PDF, EPUB n'illustrent pas une page web).
export const LIMITES_APERCU_WEB = Object.freeze({ adresses: 5, url: 2048, octets: 1024 * 1024, corpsReponse: 8 * 1024 * 1024, tentativeMs: 135000, types: COVER_INPUT_MIME });
// Les raisons d'une ENTRÉE (une adresse sans image) : les six que la fonction écrit (§ 6), plus les deux de la lecture ici (forme illisible, mur).
export const RAISONS_ENTREE_APERCU = Object.freeze(['interdit', 'inaccessible', 'pas_de_recette', 'pas_d_image', 'image_trop_lourde', 'delai', 'illisible', 'image_refusee']);
// Les raisons d'un ÉCHEC de l'appel entier (liste FERMÉE : toute autre est `interne`) ; `interdit` = 422 sans réservation (aucune adresse admise).
export const RAISONS_ECHEC_APERCU = Object.freeze(['adresse', 'non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'requete', 'serveur', 'delai', 'reseau', 'interne', 'reponse_illisible', 'annule', 'interdit']);

const echecDe = (raison, extra = {}) => ({ etat: 'echec', raison, extra });
const lu = (o, k) => (o && typeof o === 'object' && Object.hasOwn(o, k) ? o[k] : undefined);

// Une image de la réponse → { blob, type } | { raison } ; jamais une levée (une image refusée par le mur de F est `image_refusee`).
async function lireImage(image) {
  const type = lu(image, 'type'); const taille = lu(image, 'taille');
  if (typeof type !== 'string' || !LIMITES_APERCU_WEB.types.includes(type)) return { raison: 'illisible' };
  if (!Number.isSafeInteger(taille) || taille < 1) return { raison: 'illisible' };
  if (taille > LIMITES_APERCU_WEB.octets) return { raison: 'image_trop_lourde' };
  const octets = lireOctetsBase64(lu(image, 'octets'), taille);
  if (octets === null) return { raison: 'illisible' };
  try { return { blob: await preparerPhotoDistante(new Blob([octets], { type }), { coteMin: COTE_MIN_DISTANT, reencoder: false }), type }; }
  catch { return { raison: 'image_refusee' }; }
}

// UN POST { outil: 'apercu-web', corps: { urls } } (corpsMax 8 Mio, 135 s). Rend { etat: 'recus', apercus: Map(url → { blob, type } | { raison }) }, une clé par
// adresse demandée, dans l'ordre de la demande, ou { etat: 'echec', raison ∈ RAISONS_ECHEC_APERCU, extra }. `config` : tests seulement. La déstructuration
// vit DANS le try : des arguments nuls rendent un échec, jamais un rejet. Forme d'appel : lireApercusWeb({ urls, session }, { fetch, signal, tentativeMs, corpsMax, config }).
// R-UI2-1 : une adresse de plus de 2 048 unités n'est JAMAIS envoyée — le serveur refuserait la FORME entière (400) et priverait les autres de leur aperçu ;
// elle vaut `interdit` ici même, posé localement. Rien d'admis à envoyer → `adresse` (zéro fetch).
export async function lireApercusWeb(args, opts) {
  try {
    const { urls, session } = args ?? {};
    const { fetch, signal, tentativeMs = LIMITES_APERCU_WEB.tentativeMs, corpsMax = LIMITES_APERCU_WEB.corpsReponse, config } = opts ?? {};
    if (!Array.isArray(urls) || urls.length < 1 || urls.length > LIMITES_APERCU_WEB.adresses || urls.some((u) => typeof u !== 'string' || !u)) return echecDe('adresse');
    const demandees = [...urls];
    const envoyees = demandees.filter((u) => u.length <= LIMITES_APERCU_WEB.url);
    if (!envoyees.length) return echecDe('adresse');
    const r = await appelerAssistant('apercu-web', { urls: envoyees }, { fetch, session, config, signal, tentativeMs, corpsMax });
    if (r.raison) { const d = echecDomaine(r); return echecDe(RAISONS_ECHEC_APERCU.includes(d.raison) ? d.raison : 'interne', d.extra ?? {}); }
    const liste = lu(r.corps, 'apercus');
    if (!Array.isArray(liste)) return echecDe('reponse_illisible');
    const recus = new Map();
    for (const entree of liste) {
      const url = lu(entree, 'url');
      if (typeof url !== 'string' || !envoyees.includes(url) || recus.has(url)) continue; // non demandée (ou jamais envoyée), ou déjà lue (la première entrée gagne) : ignorée
      const image = lu(entree, 'image');
      if (image === null || image === undefined) { const raison = lu(entree, 'raison'); recus.set(url, { raison: RAISONS_ENTREE_APERCU.includes(raison) ? raison : 'illisible' }); continue; }
      recus.set(url, await lireImage(image)); // l'une après l'autre : un binaire décodé à la fois (S-12)
    }
    const apercus = new Map();
    for (const url of demandees) apercus.set(url, recus.get(url) ?? { raison: url.length > LIMITES_APERCU_WEB.url ? 'interdit' : 'illisible' });
    return { etat: 'recus', apercus };
  } catch { return echecDe('interne'); }
}
