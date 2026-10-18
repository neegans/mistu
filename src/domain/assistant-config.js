// Configuration de l'assistant IA (spec 2026-10-17-assistant-par-le-compte § 4.1). Pur : aucune base, aucun DOM.
// Une seule forme, à l'écriture locale ET à la lecture ; la réception écrit la ligne telle que le serveur la porte.
// URL de base (S14, R-CPT-4) : https vers tout hôte, http vers la boucle locale seulement (Ollama, LM Studio), jamais
// d'identifiants. Une URL FOURNIE mais refusée vide TOUTE la configuration (fournisseur 'none') : le fournisseur compatible OpenAI
// (retiré en Passerelle T4 ; cette normalisation reste, le magasin aussi) prenait https://api.openai.com/v1 quand base_url était vide, et la
// clé d'un serveur local partait chez OpenAI en silence. Sans URL (absente ou blanche), openai_compatible gardait le défaut du fournisseur.
import { borner } from '../core/bornes.js';

export const LIGNE_ASSISTANT = 'llm';
export const FOURNISSEURS = Object.freeze(['none', 'openai_compatible', 'anthropic']);
export const BORNES_ASSISTANT = Object.freeze({ model: 200, base_url: 500, api_key: 500 });
const VIDE = Object.freeze({ provider: 'none', model: '', base_url: '', api_key: '' });

// Le premier trim évite qu'une marge mange le budget ; le second retire le blanc que la suppression d'un invisible (Cc/Cf)
// ou la troncature laisse en tête ou en queue : sans lui, N(N(x)) différerait de N(x).
const texte = (v, max) => (typeof v === 'string' ? borner(v.trim(), max).trim() : '');

// S14 / R-CPT-4 : la clé part en Bearer vers cette URL. Elle doit être absolue, sans identifiants, et https — ou http vers
// la boucle locale seulement (`new URL` rend le nom en minuscules et l'IPv6 entre crochets : « [::1] »). Un réseau local
// (192.168.…), un faux localhost (localhost.example…) ou un autre schéma sont refusés.
const BOUCLE_LOCALE = Object.freeze(['localhost', '127.0.0.1', '[::1]', '::1']);
function urlSure(u) {
  if (!u) return '';
  try {
    const x = new URL(u);
    if (x.username || x.password) return '';
    if (x.protocol === 'https:') return u;
    return x.protocol === 'http:' && BOUCLE_LOCALE.includes(x.hostname) ? u : '';
  } catch { return ''; }
}

// R-CPT-4 : une base_url est FOURNIE dès qu'elle n'est ni absente, ni nulle, ni une chaîne blanche. Une valeur qui n'est
// pas une chaîne compte comme fournie (donc refusée) : aucune forme abîmée ne retombe en silence sur OpenAI.
const urlFournie = (v) => (typeof v === 'string' ? v.trim() !== '' : v != null);

export function normaliserConfigAssistant(brut) {
  const src = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const provider = FOURNISSEURS.includes(src.provider) ? src.provider : 'none';
  if (provider === 'none') return { ...VIDE };
  let base_url = ''; // anthropic : toujours vide (son adresse est fixe, S14)
  if (provider === 'openai_compatible') {
    base_url = urlSure(texte(src.base_url, BORNES_ASSISTANT.base_url));
    if (!base_url && urlFournie(src.base_url)) return { ...VIDE }; // R-CPT-4 : jamais de repli silencieux vers OpenAI
  }
  return {
    provider,
    model: texte(src.model, BORNES_ASSISTANT.model),
    base_url,
    api_key: texte(src.api_key, BORNES_ASSISTANT.api_key),
  };
}

// Une seule définition du « vide » : celle de la normalisation (revue Neegan 1.2 : un fournisseur inconnu est vide).
export const configVide = (cfg) => normaliserConfigAssistant(cfg).provider === 'none';
