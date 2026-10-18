// Configuration de l'assistant IA (spec 2026-10-17-assistant-par-le-compte § 4.1). Pur : aucune base, aucun DOM.
// Une seule forme, à l'écriture locale ET à la lecture ; la réception écrit la ligne telle que le serveur la porte.
import { borner } from '../core/bornes.js';

export const LIGNE_ASSISTANT = 'llm';
export const FOURNISSEURS = Object.freeze(['none', 'openai_compatible', 'anthropic']);
export const BORNES_ASSISTANT = Object.freeze({ model: 200, base_url: 500, api_key: 500 });
const VIDE = Object.freeze({ provider: 'none', model: '', base_url: '', api_key: '' });

// Le premier trim évite qu'une marge mange le budget ; le second retire le blanc que la suppression d'un invisible (Cc/Cf)
// ou la troncature laisse en tête ou en queue : sans lui, N(N(x)) différerait de N(x).
const texte = (v, max) => (typeof v === 'string' ? borner(v.trim(), max).trim() : '');

// S14 : une URL de base ne voyage que si elle est https, absolue, sans identifiants — la clé part en Bearer vers elle.
function urlSure(u) {
  if (!u) return '';
  try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password ? u : ''; } catch { return ''; }
}

export function normaliserConfigAssistant(brut) {
  const src = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const provider = FOURNISSEURS.includes(src.provider) ? src.provider : 'none';
  if (provider === 'none') return { ...VIDE };
  return {
    provider,
    model: texte(src.model, BORNES_ASSISTANT.model),
    base_url: provider === 'anthropic' ? '' : urlSure(texte(src.base_url, BORNES_ASSISTANT.base_url)),
    api_key: texte(src.api_key, BORNES_ASSISTANT.api_key),
  };
}

// Une seule définition du « vide » : celle de la normalisation (revue Neegan 1.2 : un fournisseur inconnu est vide).
export const configVide = (cfg) => normaliserConfigAssistant(cfg).provider === 'none';
