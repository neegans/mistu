// Scan de tous les fichiers suivis, y compris tests, documentation et contenus binaires.
// Le résultat public ne contient jamais les lignes ni les valeurs candidates.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MOTIF = 'sk-ant-|sbp_|eyJ[A-Za-z0-9_-]{30,}\\.';
const DELIMITEUR = /[\s\0"'`<>\\()[\]{}|,;:=]/u;
const MENTIONS = new Set(['sk-ant-', 'sk-ant-…', 'sbp_']);
const SENTINELLE = {
  fichier: 'docs/superpowers/plans/2026-10-17-chercher-sur-le-web.md',
  valeur: ['sk', 'ant', 'cle', 'test', 'sentinelle'].join('-'),
};

function git(args, cwd) {
  const resultat = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
  if (resultat.error || resultat.signal || ![0, 1].includes(resultat.status)) throw new Error('Commande Git échouée.');
  return resultat;
}

function candidats(texte) {
  const trouves = [];
  for (const debut of texte.matchAll(new RegExp(MOTIF, 'g'))) {
    let fin = debut.index + debut[0].length;
    while (fin < texte.length && !DELIMITEUR.test(texte[fin])) fin++;
    const valeur = texte.slice(debut.index, fin);
    trouves.push({ debut: debut.index, fin, valeur, type: valeur.startsWith('sk-ant-') ? 'Anthropic' : valeur.startsWith('sbp_') ? 'Supabase' : 'JWT' });
  }
  return trouves;
}

function cheminAffichable(fichier) {
  let expurge = fichier;
  for (const candidat of candidats(fichier).reverse()) expurge = expurge.slice(0, candidat.debut) + '[valeur masquée]' + expurge.slice(candidat.fin);
  return JSON.stringify(expurge).slice(1, -1);
}

export function verifierSecrets({ cwd = process.cwd() } = {}) {
  const racine = git(['rev-parse', '--show-toplevel'], cwd);
  if (racine.status !== 0 || !racine.stdout.endsWith('\n')) throw new Error('Racine Git indisponible.');
  const resultat = git(['grep', '--no-color', '--no-heading', '--no-break', '--no-column', '--full-name', '-n', '-z', '-a', '-E', MOTIF, '--'], racine.stdout.slice(0, -1));
  if (resultat.status === 1) return { mentions: 0, interdits: [] };
  const interdits = [];
  let position = 0, mentions = 0;
  while (position < resultat.stdout.length) {
    const finFichier = resultat.stdout.indexOf('\0', position);
    const finNumero = resultat.stdout.indexOf('\0', finFichier + 1);
    const finLigne = resultat.stdout.indexOf('\n', finNumero + 1);
    if (finFichier < position || finNumero < finFichier || finLigne < finNumero) throw new Error('Sortie Git non reconnue.');
    const fichier = resultat.stdout.slice(position, finFichier);
    const numero = resultat.stdout.slice(finFichier + 1, finNumero);
    if (!/^[1-9][0-9]*$/.test(numero)) throw new Error('Numéro de ligne Git non reconnu.');
    // La ligne complète reste privée : une exception ne blanchit jamais ses voisins.
    const ligne = resultat.stdout.slice(finNumero + 1, finLigne);
    for (const candidat of candidats(ligne)) {
      mentions++;
      if (MENTIONS.has(candidat.valeur)) continue;
      if (fichier === SENTINELLE.fichier && candidat.valeur === SENTINELLE.valeur) continue;
      interdits.push({ fichier: cheminAffichable(fichier), ligne: Number(numero), type: candidat.type });
    }
    position = finLigne + 1;
  }
  return { mentions, interdits };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const bilan = verifierSecrets();
    if (bilan.interdits.length) {
      console.error('Scan des secrets : candidats interdits détectés. Valeurs masquées.');
      for (const ligne of bilan.interdits) console.error(`${ligne.fichier}:${ligne.ligne} — ${ligne.type}`);
      process.exitCode = 1;
    } else console.log(`Scan des secrets : aucune valeur interdite (${bilan.mentions} mentions examinées).`);
  } catch {
    console.error('Vérification impossible : commande ou sortie Git non exploitable.');
    process.exitCode = 1;
  }
}
