// Tests Node de src/core/lien.js (lot B « Recette web complète », vague finale, sécurité). Aucun réseau.
// Pourquoi sous Node : Chrome bascule sur un moteur linéaire quand une regex revient trop en arrière, ce qui masque un retrait quadratique dans la
// suite du navigateur (mesuré : vert sur l'ancien code) ; V8 sous Node n'a pas ce repli, comme les moteurs qui n'en ont pas (rien n'est mesuré sur
// l'iPhone) — un retrait quadratique s'y voit (≈ 6 s pour 100 000 barres).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const L = await import(pathToFileURL(path.join(ICI, '..', 'src', 'core', 'lien.js')).href);

test('adresseNormalisee : 100 000 barres, en temps linéaire (une fiche reçue ne fige pas l’onglet)', () => {
  const barres = 'https://a.test/' + '/'.repeat(100000) + 'a';
  const t0 = performance.now();
  assert.equal(L.adresseNormalisee(barres), barres, 'barres suivies d’un caractère : rien de retiré');
  assert.equal(L.adresseNormalisee('https://a.test/x' + '/'.repeat(100000)), 'https://a.test/x', 'barres finales : retirées');
  const duree = performance.now() - t0;
  assert.ok(duree < 1000, `retrait linéaire attendu (obtenu ${Math.round(duree)} ms)`);
});

test('doublonDAdresse : une fiche reçue de 100 000 barres, en temps linéaire, n’est le doublon de rien', () => {
  const barres = 'https://a.test/' + '/'.repeat(100000) + 'a';
  const t0 = performance.now();
  assert.equal(L.doublonDAdresse([{ id: 'rc_barres', source_url: barres }], 'https://b.test/recette'), null);
  const duree = performance.now() - t0;
  assert.ok(duree < 1000, `recherche bornée attendue (obtenu ${Math.round(duree)} ms)`);
});
