// Tests du générateur de migrations (spec § 3.1-3.7). Aucune base Postgres ici : on vérifie le SQL produit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderMigrations } from './generer-migrations.mjs';
import { SYNC_STORES_0001, SYNC_STORES_0003, TABLES } from '../src/sync/tables.js';
import { SYNC_STORES } from '../src/model/schema.js';
import { ALLOWED_MIME } from '../src/sync/mime.js';

const { tables: sql, storage, delta, imports } = renderMigrations();
const sha = (s) => createHash('sha256').update(s).digest('hex');

// Corps d'une fonction, borne au premier « $$; » qui suit sa declaration : une assertion portant sur UNE fonction ne
// peut pas etre satisfaite par le texte d'une autre.
// La parenthese ouvrante est indispensable : « sync_purge » est un prefixe de « sync_purge_all ».
const corpsDe = (texte, nom) => {
  const debut = texte.indexOf(`create or replace function public.${nom}(`);
  assert.notEqual(debut, -1, 'declaration de ' + nom);
  const fin = texte.indexOf('$$;', debut);
  assert.notEqual(fin, -1, 'fin du corps de ' + nom);
  return texte.slice(debut, fin + 3);
};
const corps = (nom) => corpsDe(sql, nom);
// La liste litterale des magasins telle que les quatre fonctions la portent : array['books', …].
const litteralDe = (stores) => 'array[' + stores.map((s) => `'${s}'`).join(', ') + ']';
// Un fichier sans ses lignes de commentaire (-- en SQL, // en JS/TS) : un filet de texte ne doit jamais etre satisfait par un commentaire.
const sansCommentaires = (texte) => texte.split('\n').filter((ligne) => !/^\s*(--|\/\/)/.test(ligne)).join('\n');

test('25 tables, cle composee, proprietaire non nul, aucun owner_id is null', () => {
  assert.equal((sql.match(/create table public\./g) || []).length, 25);
  for (const t of SYNC_STORES_0001) assert.match(sql, new RegExp(`create table public\\.${t} \\(`));
  assert.equal((sql.match(/primary key \(owner_id, id\)/g) || []).length, 25);
  assert.equal((sql.match(/owner_id\s+uuid not null default auth\.uid\(\)/g) || []).length, 25);
  assert.doesNotMatch(sql, /owner_id is null/);
});
test('chaque regle porte is_allowed et owner_id ; delete gardee par app.purge', () => {
  const policies = sql.match(/create policy[^;]+;/g) || [];
  assert.equal(policies.length, 25 * 4);
  for (const p of policies) assert.match(p, /public\.is_allowed\(\) and owner_id = auth\.uid\(\)/);
  const deletes = policies.filter((p) => / for delete /.test(p));
  assert.equal(deletes.length, 25);
  for (const p of deletes) assert.match(p, /current_setting\('app\.purge', true\) = 'on'/);
});
test('sync_push : liste litterale, format %I, bornes, motifs, idempotence sans ecriture', () => {
  assert.match(sql, /stores constant text\[\] := array\['books'/);
  assert.doesNotMatch(sql, /'select updated_at, data, deleted_at from public\.' \|\|/);
  assert.match(sql, /format\('select updated_at, data, deleted_at from public\.%I/);
  for (const needle of ['jsonb_array_length(rows) > 500', 'pg_column_size(rows) > 1048576', "interval '5 minutes'", "'updated_at'", "'forme'", "'cle'", "'taille'", "'conflit'", "'server_time'"]) assert.ok(sql.includes(needle), needle);
  assert.match(sql, /security invoker/);
  // Ajustement au brief : la tranche est bornee au corps de sync_push (public.purge_tombstones, plus bas dans le
  // meme fichier, est legitimement security definer ; la tranche ouverte du brief echouait toujours).
  const debut = sql.indexOf('function public.sync_push');
  const corpsPush = sql.slice(debut, sql.indexOf('create or replace function', debut));
  assert.ok(corpsPush.includes('rows jsonb'), 'corps de sync_push isole');
  assert.doesNotMatch(corpsPush, /security definer/);
});
test('la liste litterale vaut exactement SYNC_STORES_0001, aux quatre endroits (spec § 3.1)', () => {
  assert.equal(sql.split(litteralDe(SYNC_STORES_0001)).length - 1, 4); // sync_push, sync_purge, sync_purge_all, purge_tombstones
});
test('files : pas de blob en base ; colonnes size et mime', () => {
  assert.match(sql, /check \(not \(data \? 'blob'\)\)/);
  assert.match(sql, /size\s+bigint generated always as \(\(data->>'size'\)::bigint\) stored/);
});
test('server_seq : sequence globale, declencheur sur les 25 tables, maintenance', () => {
  assert.match(sql, /create sequence if not exists public\.sync_seq/);
  assert.match(sql, /current_setting\('app\.maintenance', true\) = 'on'/);
  assert.equal((sql.match(/execute function public\.touch_server_seq\(\)/g) || []).length, 25);
});
// R25 : server_seq appartient au serveur. L'assertion porte sur le SQL que le generateur vient de produire
// (renderMigrations() en tete de ce fichier), jamais sur le fichier commite : un correctif oublie dans le generateur
// ne peut pas etre masque par un SQL deja ecrit. La colonne est posee a CHAQUE insert et a CHAQUE update (hors
// maintenance) : la valeur fournie par l'appelant n'est jamais lue, donc jamais conservee.
test('R25 : touch_server_seq pose nextval a chaque insert ET update, sans jamais lire la valeur de lappelant', () => {
  const p = corps('touch_server_seq');
  assert.match(p, /if tg_op = 'INSERT' then new\.server_seq := nextval\('public\.sync_seq'\); return new; end if;/);
  // Deux poses seulement : celle de l'insert et celle de l'update. Aucune troisieme branche, aucune condition.
  assert.equal((p.match(/new\.server_seq := nextval\('public\.sync_seq'\)/g) || []).length, 2);
  // La valeur fournie par l'appelant n'est jamais lue : ni « si null », ni comparaison de contenu. Depuis S2, la
  // SEULE mention de old.server_seq est la repose de l'ancienne valeur sous maintenance — jamais une lecture de
  // new.server_seq pour decider quoi que ce soit.
  assert.doesNotMatch(p, /is distinct from/);
  assert.doesNotMatch(p, /server_seq is null/);
  assert.equal((p.match(/old\.server_seq/g) || []).length, 1);
  assert.match(p, /new\.server_seq := old\.server_seq;/);
  // Et la seule sortie sans pose est la maintenance, AVANT la pose de l'update (sinon purge_tombstones reemettrait).
  const iMaintenance = p.indexOf("if current_setting('app.maintenance', true) = 'on' then new.server_seq := old.server_seq; return new; end if;");
  const iUpdate = p.lastIndexOf("new.server_seq := nextval('public.sync_seq');");
  assert.notEqual(iMaintenance, -1, 'sortie de maintenance presente');
  assert.ok(iUpdate > iMaintenance, 'la maintenance sort avant la pose de la valeur de lupdate');
});
test('barrieres : hook B1, declencheur secondaire, grants, revocations', () => {
  assert.match(sql, /function public\.before_user_created\(event jsonb\)/);
  assert.match(sql, /grant execute on function public\.before_user_created\(jsonb\) to supabase_auth_admin/);
  assert.match(sql, /'http_code', 403/);
  assert.match(sql, /before insert on auth\.users/);
  assert.match(sql, /revoke all on all tables in schema public from anon/);
  for (const f of ['sync_push(jsonb)', 'sync_purge(text, text)', 'sync_purge_all()']) assert.match(sql, new RegExp(`revoke execute on function public\\.${f.replace(/[()]/g, '\\$&')} from public, anon`));
  assert.match(sql, /email = lower\(email\) and email like '%@%'/);
  // Spec § 3.2 : le schema private n'est pas expose a l'API.
  assert.match(sql, /revoke usage on schema private from anon, authenticated/);
});
test('purge : set_config app.purge local, compte renvoye, tombales 90 jours sous maintenance', () => {
  assert.match(sql, /set_config\('app\.purge', 'on', true\)/);
  assert.match(sql, /get diagnostics n = row_count/);
  assert.match(sql, /interval '90 days'/);
  assert.match(sql, /set_config\('app\.maintenance', 'on', true\)/);
});
test('stockage : bucket prive, limites, liste blanche, regles par dossier', () => {
  assert.match(storage, /'pages', 'pages', false, 52428800/);
  for (const m of ALLOWED_MIME) assert.ok(storage.includes(`'${m}'`), m);
  // Ajustement R2 : la regle update porte la condition deux fois (using + with check) -> 5 et non 4.
  assert.equal((storage.match(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g) || []).length, 5);
  assert.match(storage, /create or replace view private\.storage_usage/);
});
test('RLS activee sur les 25 tables et sur private.allowed_users', () => {
  assert.equal((sql.match(/alter table public\.\w+ enable row level security;/g) || []).length, 25);
  assert.match(sql, /alter table private\.allowed_users enable row level security;/);
});
test('cascade de suppression de compte sur les 25 tables', () => {
  assert.equal((sql.match(/references auth\.users\(id\) on delete cascade/g) || []).length, 25);
});
test('search_path vide partout ; invoker ou definer comme voulu, dans le corps de chaque fonction', () => {
  for (const f of ['is_allowed', 'before_user_created', 'enforce_allowed_user', 'purge_tombstones']) {
    assert.match(corps(f), /security definer set search_path = ''/, f);
  }
  for (const f of ['sync_push', 'sync_purge', 'sync_purge_all']) {
    assert.match(corps(f), /security invoker set search_path = ''/, f);
    assert.doesNotMatch(corps(f), /security definer/, f);
  }
  assert.match(corps('touch_server_seq'), /language plpgsql set search_path = ''/);
  assert.match(sql, /revoke execute on function public\.touch_server_seq\(\) from public, anon, authenticated/);
});
test('les trois fonctions appelables par l app sont accordees a authenticated', () => {
  for (const f of ['sync_push(jsonb)', 'sync_purge(text, text)', 'sync_purge_all()']) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${f.replace(/[()]/g, '\\$&')} to authenticated`), f);
  }
});
test('les garde-fous de public.files sont DANS le bloc create table', () => {
  const debut = sql.indexOf('create table public.files (');
  assert.notEqual(debut, -1);
  const bloc = sql.slice(debut, sql.indexOf('\n);', debut));
  assert.match(bloc, /check \(not \(data \? 'blob'\)\)/);
  assert.match(bloc, /mime text generated always as \(data->>'mime'\) stored/);
  assert.match(bloc, /size bigint generated always as \(\(data->>'size'\)::bigint\) stored/);
});
test('R12 : 0001 ne touche jamais storage.objects ; 0002 seul le fait', () => {
  assert.doesNotMatch(sql, /storage\.objects/);
  assert.match(storage, /storage\.objects/);
  assert.doesNotMatch(corps('sync_purge'), /storage/);
  assert.doesNotMatch(corps('sync_purge_all'), /storage/);
  assert.match(corps('sync_purge'), /get diagnostics n = row_count;/);
  assert.match(corps('sync_purge_all'), /get diagnostics k = row_count;/);
});
test('sync_push : aucun element ne peut faire echouer le lot (spec § 3.4)', () => {
  const p = corps('sync_push');
  // (a) cle absente ou vide : rejetee pour TOUS les elements, tombale comprise (la colonne id est not null).
  assert.match(p, /if i is null or i = '' then bad := 'cle'; end if;/);
  // (b) « deleted » non booleen : rejet, pas d'exception qui emporte le lot.
  assert.match(p, /begin del := coalesce\(\(r->>'deleted'\)::boolean, false\); exception when others then del := false;/);
  assert.match(p, /begin u := \(r->>'updated_at'\)::timestamptz; exception when others then u := null; end;/);
  // (c) contraintes de table : sous-bloc autour de l'ecriture + controles explicites pour files.
  assert.match(p, /if d \? 'blob' then bad := 'forme';/);
  assert.match(p, /d->>'size' is not null and d->>'size' !~ '\^\[0-9\]\+\$'/);
  assert.match(p, /bad := 'conflit';/);
  assert.match(p, /exit when bad is not null;/);
  // Le « continue » ne doit jamais etre dans le sous-bloc d'ecriture : il reste au niveau de la boucle externe.
  const ouvre = p.indexOf('if cur_updated is null then');
  const ferme = p.lastIndexOf('exception when others then'); // le gestionnaire du sous-bloc est le dernier du corps
  assert.ok(ouvre !== -1 && ferme > ouvre, 'sous-bloc d ecriture localise');
  assert.doesNotMatch(p.slice(ouvre, ferme), /continue;/);
  // N2 : ancre sur le debut de ligne, sinon « elsif bad is not null » suffirait a satisfaire le test ; et verifie la
  // position, pour que la suppression du rejet d'avant le sous-bloc ne passe pas inapercue.
  const rejetAvant = "\n    if bad is not null then\n      rejected := rejected || jsonb_build_object('store', s, 'id', i, 'reason', bad); continue;";
  const iRejetAvant = p.indexOf(rejetAvant);
  assert.notEqual(iRejetAvant, -1, 'rejet avant le sous-bloc, en debut de ligne');
  assert.ok(iRejetAvant < p.indexOf('cur_updated := null;'), 'ce rejet precede la lecture de la ligne courante');
});
test('N1 : un echec non imputable a l element remonte au lieu de devenir un rejet', () => {
  const p = corps('sync_push');
  // (1) autorisation verifiee une fois, avant la boucle : une adresse retiree de la liste donne un echec franc.
  const iAllowed = p.indexOf("if not public.is_allowed() then raise exception");
  const iBoucle = p.indexOf('for r in select * from jsonb_array_elements(rows) loop');
  assert.notEqual(iAllowed, -1, 'controle public.is_allowed() en tete de sync_push');
  assert.ok(iBoucle > iAllowed, 'le controle precede la boucle');
  // (2) le gestionnaire du sous-bloc releve les classes qui ne concernent pas l'element, AVANT de poser « forme ».
  const gestionnaire = p.slice(p.lastIndexOf('exception when others then'));
  const liste = "if sqlstate in ('42501','40001','40P01','53100','53200','57P03') then raise; end if;";
  const iListe = gestionnaire.indexOf(liste);
  const iForme = gestionnaire.indexOf("bad := 'forme';");
  assert.notEqual(iListe, -1, 'liste exacte des sqlstate qui remontent');
  assert.ok(iForme > iListe, 'les classes remontent avant que « forme » ne soit pose');
});
test('aucune donnee personnelle, determinisme', () => {
  assert.doesNotMatch(sql + storage + delta + imports, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const again = renderMigrations();
  assert.equal(again.tables, sql); assert.equal(again.storage, storage); assert.equal(again.delta, delta); assert.equal(again.imports, imports);
});

// --- Assistant par le compte, tache 8 : migration 0003 a ajout seul (spec assistant-par-le-compte § 6.1-6.2) -------
// 0001 et 0002 sont appliquees sur mitsu : --check prouve « genere = commite », l'empreinte prouve « commite =
// applique » (F11). Une factorisation du generateur qui bougerait un seul octet de 0001 casse ce test-ci.
test('0001 et 0002 : octet pour octet ceux appliques sur mitsu (empreintes du 17 octobre 2026)', () => {
  assert.equal(sha(sql), 'e90ff35ec7c031f63dfb903e6885103ed7e42202866f59359ce019d00b85ee51');
  assert.equal(sha(storage), '2e90d2b1beb7270601f83c7408b1a2a2be32c800772f14f454960b233a2d5944');
});
// Lot A (import ciblé), tâche 1 : 0003 est appliquée sur mitsu (18 octobre 2026). Sa liste de 26 magasins est FIGÉE dans
// src/sync/tables.js (SYNC_STORES_0003) et 0003 est rendue depuis elle, plus depuis le SYNC_STORES vivant : un 27e magasin
// (imports) ne change plus un octet de 0003 — l'empreinte le prouve, et la comparaison au fichier commité aussi.
test('SYNC_STORES_0003 : 26 noms figes, les 25 de 0001 puis assistant_config, geles', () => {
  assert.equal(SYNC_STORES_0003.length, 26);
  assert.equal(SYNC_STORES_0003.at(-1), 'assistant_config');
  assert.deepEqual(SYNC_STORES_0003.slice(0, 25), [...SYNC_STORES_0001]);
  assert.ok(Object.isFrozen(SYNC_STORES_0003), 'gelee');
});
test('0003 : octet pour octet celle commitee et appliquee sur mitsu (empreinte du 18 octobre 2026), meme avec un 27e magasin dans SYNC_STORES', () => {
  assert.equal(sha(delta), '37f9f80d62cf82457b177f35979892ce7deeaf2067567a506228e145ad8efd39');
  assert.equal(delta, lire('supabase/migrations/0003_assistant_config.sql'), 'identique au fichier commite');
  assert.ok(SYNC_STORES.length > SYNC_STORES_0003.length && SYNC_STORES.includes('imports'), 'le schema vivant a un magasin de plus (imports) : la liste figee tient quand meme');
});
test('0003 : une table neuve, revoke anon, quatre fonctions avec les 26 magasins', () => {
  const nouvelles = SYNC_STORES_0003.filter((s) => !SYNC_STORES_0001.includes(s));
  assert.deepEqual(nouvelles, ['assistant_config']);
  assert.equal((delta.match(/create table public\./g) || []).length, 1);
  assert.match(delta, /create table public\.assistant_config \(/);
  assert.equal((delta.match(/create policy[^;]+;/g) || []).length, 4);
  assert.equal((delta.match(/execute function public\.touch_server_seq\(\)/g) || []).length, 1);
  assert.match(delta, /create index assistant_config_recv on public\.assistant_config \(owner_id, server_seq\);/);
  assert.equal((delta.match(/create index /g) || []).length, 1, 'un seul index');
  assert.match(delta, /revoke all on public\.assistant_config from anon;/);
  assert.equal((delta.match(/revoke all on public\./g) || []).length, 1, 'un seul revoke de table');
  assert.equal(delta.split(litteralDe(SYNC_STORES_0003)).length - 1, 4, 'sync_push, sync_purge, sync_purge_all, purge_tombstones');
  assert.match(delta, /"assistant_config":"id"/);
  assert.match(delta, /"assistant_config":\[\]/);
  assert.doesNotMatch(delta, /cron\.schedule/);
  assert.doesNotMatch(delta, /create table public\.books/);
  assert.match(delta, /grant execute on function public\.sync_push\(jsonb\) to authenticated;/);
});
// Les quatre fonctions de 0003 sont celles de 0001, aux seules listes pres : rien d'autre ne doit changer en les
// recreant sur mitsu. On remplace dans 0003 les trois constantes a 26 noms par celles a 25, et le bloc doit etre
// identique a celui de 0001 (du commentaire « -- Envoi » jusqu'a la ligne cron.schedule, exclue).
test('0003 : les quatre fonctions recreees sont celles de 0001, aux trois listes pres', () => {
  const debutDe = (texte) => texte.indexOf('-- Envoi (spec § 3.4)');
  assert.notEqual(debutDe(sql), -1); assert.notEqual(debutDe(delta), -1);
  const bloc0001 = sql.slice(debutDe(sql), sql.indexOf("select cron.schedule('cuisine-os-tombales'"));
  const enJson = (stores, champ) => JSON.stringify(Object.fromEntries(stores.map((s) => [s, TABLES[s][champ]]))).replace(/'/g, "''");
  const ramene = delta.slice(debutDe(delta))
    .split(litteralDe(SYNC_STORES_0003)).join(litteralDe(SYNC_STORES_0001))
    .split(enJson(SYNC_STORES_0003, 'key')).join(enJson(SYNC_STORES_0001, 'key'))
    .split(enJson(SYNC_STORES_0003, 'required')).join(enJson(SYNC_STORES_0001, 'required'));
  assert.equal(ramene, bloc0001);
  // Et 0003 ne touche a rien d'autre que sa table et ces quatre fonctions.
  assert.equal((delta.match(/create or replace function public\.(\w+)\(/g) || []).length, 4);
  for (const autre of ['touch_server_seq() returns', 'is_allowed() returns', 'before_user_created(', 'enforce_allowed_user() returns', 'storage.objects', 'storage.buckets', 'create schema', 'create sequence', 'create extension', 'private.allowed_users (', 'revoke all on all tables']) {
    assert.ok(!delta.includes(autre), autre);
  }
});

// --- Tache 4 : preuves SQL, gabarits de preuve et mode d'emploi -------------------------------------------------
// Ces fichiers ne sont pas generes : ils sont ecrits a la main et relus contre le SQL genere ci-dessus. Les tests
// qui suivent verifient ce qu'une relecture humaine laisse passer : un motif oublie, une adresse reelle, un
// « rollback; » qui ne serait plus la derniere instruction, et le mode d'emploi qui cite 0001 de travers.
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const lire = (chemin) => readFileSync(new URL('../' + chemin, import.meta.url), 'utf8');
// F1 : le script lui-même est lancé par spawnSync (modèle de tools/verifier-vendor.test.mjs), dans un répertoire
// temporaire — jamais sur les fichiers du dépôt, qui doivent rester tels qu'ils sont commités.
const RACINE_MIG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPT_MIG = path.join(RACINE_MIG, 'tools', 'generer-migrations.mjs');
const MIGRATIONS = path.join(RACINE_MIG, 'supabase', 'migrations');
const NOMS = ['0001_tables_et_regles.sql', '0002_stockage.sql', '0003_assistant_config.sql', '0005_imports.sql', '0008_corbeille_recettes.sql', '0009_corbeille_livres.sql', '0010_sources_index.sql'];
const instructions = (texte) => texte.split('\n').map((l) => l.trim()).filter((l) => l !== '');
// Une rubrique du README : du titre donne a la prochaine rubrique (## ou ###), pas seulement au prochain « ## » — depuis la tache 2 du
// lot A, l'etape 10 est suivie de l'etape 11 (###), et une tranche ouverte jusqu'au « ## » suivant compterait deux fois `notify pgrst`.
const rubrique = (texte, titre) => {
  const debut = texte.indexOf(titre);
  assert.notEqual(debut, -1, 'rubrique : ' + titre);
  const fins = [texte.indexOf('\n## ', debut), texte.indexOf('\n### ', debut)].filter((i) => i !== -1);
  return texte.slice(debut, fins.length ? Math.min(...fins) : undefined);
};

test('preuve 0001 : les cinq motifs, les privileges, R12, rollback final, aucune adresse reelle', () => {
  const p = lire('supabase/proofs/0001_tables_et_regles.sql');
  for (const m of ["'cle'", "'forme'", "'taille'", "'updated_at'", 'conflit', 'updated_at']) assert.ok(p.includes(m), m);
  for (const m of ['has_table_privilege', 'has_sequence_privilege', 'has_function_privilege',
    "set_config('app.maintenance'", 'before_user_created(', 'sync_purge(', 'sync_purge_all(']) assert.ok(p.includes(m), m);
  // R12 : la preuve de 0001 ne parle jamais de la table des objets du stockage (l app supprime l objet par l API).
  assert.ok(!p.includes('storage.objects'), 'storage.objects absent de la preuve 0001');
  // La preuve ne laisse rien : derniere instruction non vide = rollback;
  const l = instructions(p);
  assert.equal(l[l.length - 1], 'rollback;');
  // Aucune adresse reelle : seuls les jetons et le domaine reserve exemple.invalid sont toleres.
  const sansJetons = p.replace(/[A-Za-z0-9._%+-]+@exemple\.invalid/g, '').replace(/A_EMAIL|B_EMAIL/g, '');
  assert.doesNotMatch(sansJetons, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  // Les quatre jetons sont bien presents (sinon il n y a rien a remplacer).
  for (const j of ['A_UUID', 'A_EMAIL', 'B_UUID', 'B_EMAIL']) assert.ok(p.includes(j), j);
});
test('preuve 0002 et gabarits : seau, regles pages_*, vue, renvoi a L4, captures', () => {
  const p = lire('supabase/proofs/0002_stockage.sql');
  assert.ok(p.includes("from storage.buckets"), 'lecture du seau');
  assert.ok(p.includes('52428800'), 'limite de 50 Mo');
  for (const m of ALLOWED_MIME) assert.ok(p.includes(m), m);
  assert.ok(p.includes("policyname like 'pages_%'"), 'les quatre regles pages_*');
  assert.ok(p.includes('private.storage_usage'), 'la vue');
  assert.match(p, /L4/, 'les refus reels sont renvoyes au lot L4');
  assert.doesNotMatch(p, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const hook = lire('supabase/proofs/0001_hook.md');
  assert.ok(hook.includes('public.before_user_created') && /Before User Created/.test(hook));
  const providers = lire('supabase/proofs/0001_providers.md');
  for (const m of ['Google', 'Email', 'Phone', 'Anonymous']) assert.ok(providers.includes(m), m);
});
test('README : cite mot pour mot la derniere instruction de 0001 (celle a coller a part)', () => {
  const surDisque = instructions(lire('supabase/migrations/0001_tables_et_regles.sql'));
  const derniere = surDisque[surDisque.length - 1];
  assert.match(derniere, /^select cron\.schedule\(/, 'la derniere instruction de 0001 est bien le cron');
  const generees = instructions(sql);
  assert.equal(generees[generees.length - 1], derniere, 'le fichier sur disque est bien celui du generateur');
  const readme = lire('supabase/README.md');
  assert.ok(readme.includes(derniere), 'le README cite la derniere instruction mot pour mot');
  for (const m of ['mistu-dev', 'pg_cron', 'RESULTATS-', 'allowed_users', '0002_stockage.sql']) assert.ok(readme.includes(m), m);
  assert.doesNotMatch(readme, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
});

// --- Ronde de correction 1 : R14 (borne par element), R15 (vue revoquee), blindage du schema temporaire ---------
test('R14 : borne par element a 512 Ko, borne du lot a 1 Mo (le motif taille devient atteignable)', () => {
  const p = corps('sync_push');
  assert.match(p, /pg_column_size\(rows\) > 1048576 then raise exception 'rows : 1 Mo au plus'/);
  assert.match(p, /pg_column_size\(d\) > 524288 then bad := 'taille'/);
  // Au meme seuil que le lot, « taille » ne pourrait jamais etre pose : un element trop gros rend le lot trop gros.
  assert.doesNotMatch(p, /pg_column_size\(d\) > 1048576/);
});
test('R15 : private.storage_usage est revoquee pour anon et authenticated, apres sa creation', () => {
  assert.match(storage, /revoke all on private\.storage_usage from anon, authenticated;/);
  assert.ok(storage.indexOf('revoke all on private.storage_usage')
    > storage.indexOf('create or replace view private.storage_usage'), 'le revoke suit la creation');
});
test('preuve 0001 : verdict taille, et grant dynamique sur le schema temporaire', () => {
  const p = lire('supabase/proofs/0001_tables_et_regles.sql');
  assert.ok(p.includes('"reason":"taille"'), 'un verdict attend rejected{taille}');
  assert.ok(p.includes("repeat('x', 600000)"), 'un element de plus de 512 Ko mais de moins de 1 Mo');
  assert.ok(p.includes('pg_my_temp_schema()'), 'le nom reel du schema temporaire');
  assert.match(p, /grant usage on schema %I to authenticated/, 'grant usage dynamique');
});
// --- Ronde finale : R25 (server_seq appartient au serveur), prouve aussi dans la preuve SQL ------------------------
test('preuve 0001 : un update qui pose server_seq lui-meme est ignore (R25)', () => {
  const p = lire('supabase/proofs/0001_tables_et_regles.sql');
  assert.match(p, /update public\.books set server_seq = 1 where id = 'i1';/, 'lupdate pirate est joue');
  assert.ok(p.includes('server_seq > (select obtenu from pg_temp.preuve where ordre = 6.10)::bigint'),
    'le verdict compare a la valeur relevee AVANT lupdate, en strictement superieur');
  // La valeur de reference est relevee avant l'update, sinon le verdict comparerait a lui-meme.
  assert.ok(p.indexOf('(6.10') !== -1 || p.includes('select 6.10'), 'releve de reference numerote 6.10');
  assert.ok(p.indexOf('select 6.10') < p.indexOf("update public.books set server_seq = 1"), 'le releve precede lupdate');
});
// --- Vague des residus /verify : S2 (deleted_at appartient au serveur) et F1 (--dir, --check eprouve) -----------
// S2 precise la section 3.1 « posee par le serveur » : la regle *_update n autorise que par LIGNE, jamais par
// colonne, et authenticated a le privilege update sur les 25 tables. Un PATCH direct pouvait donc poser
// deleted_at = now() sur n importe quelle fiche : la tombale aurait fait disparaitre la fiche de TOUS les
// appareils, sans passer par sync_push et sans qu aucun client ne puisse distinguer cela d une vraie suppression.
test('S2 : le declencheur fige deleted_at, sauf sous app.sync_push', () => {
  const p = corps('touch_server_seq');
  assert.match(p, /if current_setting\('app\.sync_push', true\) <> 'on' then new\.deleted_at := old\.deleted_at; end if;/);
  // Le degel est examine APRES la sortie de maintenance et AVANT la pose de la sequence : sous maintenance, le
  // declencheur ne touche a rien (purge_tombstones ne doit rien reemettre).
  const iMaintenance = p.indexOf("if current_setting('app.maintenance', true) = 'on'");
  const iGel = p.indexOf("if current_setting('app.sync_push', true) <> 'on'");
  const iSeq = p.lastIndexOf("new.server_seq := nextval('public.sync_seq');");
  assert.ok(iMaintenance < iGel && iGel < iSeq, 'ordre : maintenance, puis gel, puis sequence');
  // Et sous maintenance, server_seq est repose a son ancienne valeur : la valeur de l appelant ne survit nulle part.
  assert.match(p, /if current_setting\('app\.maintenance', true\) = 'on' then new\.server_seq := old\.server_seq; return new; end if;/);
});
test('S2 : sync_push est la seule a poser app.sync_push, apres is_allowed() et avant la boucle', () => {
  const p = corps('sync_push');
  assert.match(p, /perform set_config\('app\.sync_push', 'on', true\);/);
  const iAllowed = p.indexOf('if not public.is_allowed() then raise exception');
  const iFlag = p.indexOf("perform set_config('app.sync_push', 'on', true);");
  const iBoucle = p.indexOf('for r in select * from jsonb_array_elements(rows) loop');
  assert.ok(iAllowed !== -1 && iAllowed < iFlag, 'le drapeau est pose APRES le controle d autorisation');
  assert.ok(iFlag < iBoucle, 'et avant la boucle');
  // Une seule pose dans tout le fichier : aucune autre fonction ne degele deleted_at.
  assert.equal((sql.match(/set_config\('app\.sync_push'/g) || []).length, 1);
});
test('preuve 0001 : deleted_at figee par un update direct, modifiable par sync_push (S2)', () => {
  const p = lire('supabase/proofs/0001_tables_et_regles.sql');
  const iDirect = p.indexOf("update public.books set deleted_at = now() where id = 'i1';");
  assert.notEqual(iDirect, -1, 'lupdate direct est joue');
  assert.ok(p.includes('deleted_at inchange'), 'un verdict attend deleted_at inchange');
  const iDegel = p.indexOf("set_config('app.sync_push', 'on', true)");
  assert.notEqual(iDegel, -1, 'le degel est joue dans la meme transaction');
  assert.ok(iDirect < iDegel, 'le refus est prouve AVANT le degel (sinon il ne prouve rien)');
  // Le drapeau est remis a vide apres la preuve : un sync_push plus haut dans la transaction ne doit pas
  // degeler le verdict, et le degel ne doit pas fuir sur la suite de la preuve.
  assert.ok(p.includes("set_config('app.sync_push', '', true)"), 'le drapeau est remis a vide');
  assert.ok(p.indexOf("set_config('app.sync_push', '', true)") < iDirect, 'et il est vide AVANT lupdate direct');
});

test('F1 : --check --dir rend 0 sur une copie conforme, 1 des quun fichier est altere (avec son nom)', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'cuisine-os-migrations-'));
  try {
    for (const nom of NOMS) copyFileSync(path.join(MIGRATIONS, nom), path.join(tmp, nom));
    const vert = spawnSync(process.execPath, [SCRIPT_MIG, '--check', '--dir', tmp], { cwd: RACINE_MIG, encoding: 'utf8' });
    assert.equal(vert.status, 0, 'copie conforme : ' + vert.stderr);
    const cible = path.join(tmp, NOMS[0]);
    const texte = readFileSync(cible, 'utf8');
    const altere = texte.replace('create sequence if not exists public.sync_seq;', 'create sequence if not exists public.sync_seq_altere;');
    assert.notEqual(altere, texte, 'laltration a bien mordu sur le fichier copie');
    writeFileSync(cible, altere);
    const rouge = spawnSync(process.execPath, [SCRIPT_MIG, '--check', '--dir', tmp], { cwd: RACINE_MIG, encoding: 'utf8' });
    assert.equal(rouge.status, 1, 'fichier altere : code 1 attendu');
    assert.match(rouge.stderr, /0001_tables_et_regles\.sql/);
    assert.doesNotMatch(rouge.stderr, /0002_stockage\.sql/, 'seul le fichier altere est nomme');
    assert.doesNotMatch(rouge.stderr, /0003_assistant_config\.sql/, 'seul le fichier altere est nomme');
    assert.doesNotMatch(rouge.stderr, /0005_imports\.sql/, 'seul le fichier altere est nomme');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('F1 : --dir vaut aussi pour lecriture, et le depot nest pas touche', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'cuisine-os-migrations-ecrit-'));
  try {
    const ecrit = spawnSync(process.execPath, [SCRIPT_MIG, '--dir', tmp], { cwd: RACINE_MIG, encoding: 'utf8' });
    assert.equal(ecrit.status, 0, ecrit.stderr);
    for (const nom of NOMS) assert.equal(readFileSync(path.join(tmp, nom), 'utf8'), readFileSync(path.join(MIGRATIONS, nom), 'utf8'), nom);
    const verif = spawnSync(process.execPath, [SCRIPT_MIG, '--check', '--dir', tmp], { cwd: RACINE_MIG, encoding: 'utf8' });
    assert.equal(verif.status, 0, verif.stderr);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('F1 : --dir sans chemin est un usage incorrect (code 2), rien nest ecrit', () => {
  const r = spawnSync(process.execPath, [SCRIPT_MIG, '--check', '--dir'], { cwd: RACINE_MIG, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--dir/);
});

test('README : schema temporaire refuse, et colonnes not null de auth.users', () => {
  const r = lire('supabase/README.md');
  assert.ok(r.includes('pg_temp'), 'quoi faire si permission denied for schema pg_temp_...');
  assert.ok(r.includes('encrypted_password'), 'colonnes not null sans defaut cote GoTrue');
});

// --- Assistant par le compte, tache 8 : preuve 0003, README et RESULTATS (spec assistant-par-le-compte § 6.3, § 7) --
// La preuve 0003 est ecrite a la main et jouee par Neegan ; sa sortie va dans un depot PUBLIC. Ce test verifie ce
// qu'une relecture laisse passer : une lecture de la colonne data (la cle de l'assistant, en clair sur le serveur),
// une reponse de sync_push affichee telle quelle (un conflit porte server.data), une cle qui ne serait pas factice,
// une adresse reelle, et un rollback qui ne serait plus la derniere instruction.
test('preuve 0003 : rollback final, aucune adresse reelle, jamais la colonne data, cles factices, 26 tables', () => {
  const p = lire('supabase/proofs/0003_assistant_config.sql');
  const l = instructions(p);
  assert.equal(l[l.length - 1], 'rollback;');
  assert.equal(l.filter((x) => x === 'begin;').length, 1, 'une seule transaction');
  // Aucune adresse : une fois les jetons et l'operateur jsonb « @> » retires, il ne reste aucun « @ ».
  const sansJetons = p.replace(/A_EMAIL|B_EMAIL|@>/g, '');
  assert.doesNotMatch(sansJetons, /@/, 'aucune adresse : seuls les jetons');
  for (const j of ['A_UUID', 'A_EMAIL', 'B_UUID', 'B_EMAIL']) assert.ok(p.includes(j), j);
  // Regle de lecture (S7) : la longueur de la cle, jamais la colonne entiere.
  assert.ok(p.includes("length(data->>'api_key')"), 'la cle est relue par sa longueur');
  // Liste BLANCHE (ronde 1) : une liste de formes interdites laissait vivre max(data->>'api_key'),
  // cast(data as text) et jsonb_pretty(data). Hors commentaires (la preuve n'a que des commentaires en ligne entiere,
  // donc seules ces lignes sont retirees : un « -- » en fin de ligne de code ne cacherait rien), chaque mot « data »
  // doit etre l'une des quatre formes ci-dessous, relevees dans le fichier : la longueur de la cle, la fiche privee de
  // sa cle comparee a une constante, la cle « data » du JSON pousse, la liste de colonnes de l'insert pirate (4.04).
  const code = p.split('\n').filter((ligne) => !/^\s*--/.test(ligne)).join('\n');
  const AUTORISEES = ["length(data->>'api_key')", "(data - 'api_key') = '", '"data":{', 'owner_id, id, data, updated_at)'];
  for (const a of AUTORISEES) assert.ok(code.includes(a), 'forme autorisee presente : ' + a);
  const reste = AUTORISEES.reduce((t, a) => t.split(a).join(''), code);
  const hors = reste.match(/.{0,40}\bdata\b.{0,40}/gi) || [];
  assert.deepEqual(hors, [], 'data hors des formes autorisees');
  // Ronde 1 (4.06) : hors RLS (sous postgres), la table contient aussi les vraies lignes « llm » des comptes reels.
  // Toute lecture de public.assistant_config jouee sous postgres est donc bornee aux deux comptes de preuve ; sous
  // authenticated, la RLS borne d'elle-meme. Le role courant suit les « set local role » / « reset role » du fichier.
  let role = 'postgres'; let bornees = 0;
  for (const instr of code.split(';').map((x) => x.trim())) {
    if (instr === 'set local role authenticated') role = 'authenticated';
    else if (instr === 'reset role') role = 'postgres';
    else if (role === 'postgres' && /from public\.assistant_config\b/.test(instr)) {
      assert.match(instr, /owner_id in \('A_UUID', 'B_UUID'\)/, 'lecture hors RLS non bornee : ' + instr.slice(0, 120));
      bornees += 1;
    }
  }
  assert.ok(bornees >= 2, 'les verdicts 4.06 et 4.07 sont bien lus sous postgres');
  // Et rien qui affiche une ligne ENTIERE sans nommer data (alias de ligne, agregat de lignes).
  for (const interdit of ['select *', '.*', 'to_jsonb(', 'row_to_json', 'jsonb_agg(', 'json_agg(', 'array_agg(', 'jsonb_pretty(']) {
    assert.ok(!code.toLowerCase().includes(interdit), interdit);
  }
  // Toute reponse de sync_push s'appelle « reponse » et n'est jamais convertie en texte : seuls ses compteurs et
  // son motif sont affiches (la reponse a un conflit porte server.data, donc la cle).
  // Un appel = « public.sync_push(' » suivi du lot ; les autres mentions (privileges, corps relus) passent sa signature.
  const appels = (p.match(/public\.sync_push\('\[/g) || []).length;
  assert.equal(appels, 4, 'quatre envois : 3.01, 3.04, 3.06, 4.02');
  assert.equal((p.match(/\) as reponse\) t;/g) || []).length, appels, 'chaque envoi est nomme reponse');
  assert.ok(!p.includes('reponse::text') && !p.includes("reponse->'rejected'->0->'server'"), 'reponse jamais affichee');
  // Cles factices seulement.
  const cles = p.match(/sk-[A-Za-z0-9_-]*/g) || [];
  assert.ok(cles.length >= 4, 'des cles poussees');
  for (const c of cles) assert.ok(c === 'sk-' || c.startsWith('sk-factice-'), c);
  // Privileges sur les 26 tables (S4), relus comme 8.01 de 0001, et les quatre fonctions recreees.
  assert.ok(p.includes("has_table_privilege('anon'"), 'privileges de anon');
  // Borne au verdict 2.02 : « count(*) = 26 » figure aussi ailleurs (2.11), et ne doit pas suffire.
  const d202 = p.indexOf('select 2.02,');
  assert.notEqual(d202, -1, 'verdict 2.02');
  const v202 = p.slice(d202, p.indexOf('insert into pg_temp.preuve', d202));
  assert.ok(v202.includes('count(*) = 26 and bool_and('), '26 tables, toutes sans privilege anon');
  for (const priv of ['select', 'insert', 'update', 'delete']) {
    assert.ok(v202.includes(`not has_table_privilege('anon', 'public.' || tablename, '${priv}')`), priv);
  }
  assert.ok(v202.includes("from pg_tables where schemaname = 'public'"), 'toutes les tables de public');
  for (const f of ['sync_push(jsonb)', 'sync_purge(text, text)', 'sync_purge_all()', 'purge_tombstones()']) {
    assert.ok(p.includes(`has_function_privilege('anon', 'public.${f}', 'execute'), false`), 'anon sans execute : ' + f);
    assert.ok(p.includes(`'public.${f}'),`) || p.includes(`'public.${f}')`), 'definition relue : ' + f);
  }
  assert.ok(p.includes('pg_get_functiondef'), 'les quatre corps sont relus');
  // Conflit sur le meme compte, delete sans app.purge, journaux de Postgres mesures (S8, S9).
  assert.ok(p.includes("= 'conflit'"), 'motif conflit');
  assert.match(p, /with d as \(delete from public\.assistant_config where id = 'llm' returning 1\)/);
  for (const g of ['log_min_error_statement', 'log_parameter_max_length_on_error']) assert.ok(p.includes(g), g);
  assert.ok(p.includes("'Run without RLS'") || p.includes('« Run without RLS »'), 'le piege du tableau de bord est rappele');
});
test('README : etape 8 bis (0003 et sa preuve) et procedure « appareil perdu ou cle exposee »', () => {
  const r = lire('supabase/README.md');
  const debut = r.indexOf('### 8 bis. Coller `0003_assistant_config.sql`, puis jouer sa preuve');
  assert.notEqual(debut, -1, 'etape 8 bis');
  // Ronde 1 : l'etape 8 bis est placee entre 8 et 9 (ordre de lecture) ; elle s'arrete au titre de l'etape 9.
  assert.ok(r.indexOf('### 8. Brancher le crochet') < debut && debut < r.indexOf('### 9. Fermer les autres portes'), '8 bis entre 8 et 9');
  const etape = r.slice(debut, r.indexOf('\n### 9. ', debut));
  for (const m of ['migrations/0003_assistant_config.sql', 'proofs/0003_assistant_config.sql', 'exemple.invalid', 'Run without RLS',
    "notify pgrst, 'reload schema';", 'push', 'A_UUID', 'B_EMAIL', 'RESULTATS-mitsu.md', "length(data->>'api_key')",
    'SYNC_STORES_0003', 'shasum -a 256 supabase/migrations/0003_assistant_config.sql']) assert.ok(etape.includes(m), m);
  const perdu = r.slice(r.indexOf('## Appareil perdu ou clé exposée'));
  assert.ok(perdu.startsWith('## Appareil perdu'), 'section appareil perdu');
  // L'ordre de la spec § 7 (amende R-CPT-6) : retirer l'adresse, fermer les sessions, revoquer la cle, ATTENDRE
  // l'expiration des jetons d'acces (un jeton deja emis reste valide), remettre l'adresse et entrer la cle neuve.
  const i = ["private.allowed_users where email = lower('...');", 'Authentication → Users', 'console Anthropic', '« JWT expiry »',
    'insert into private.allowed_users', 'entrer la nouvelle clé'].map((m) => perdu.indexOf(m));
  assert.ok(i.every((x) => x !== -1), 'six gestes presents : ' + i.join(','));
  assert.ok(perdu.includes('3600 s par défaut'), 'la valeur par defaut du reglage');
  assert.deepEqual([...i].sort((a, b) => a - b), i, 'dans l ordre de la spec');
  const res = lire('supabase/proofs/RESULTATS-mitsu.md');
  assert.ok(res.includes('## Preuve `0003_assistant_config.sql` — ')) // titre provisoire « à jouer » avant le collage, puis « 45 verdicts, 0 faux » une fois jouee (18 oct);
  assert.doesNotMatch(res, /sk-(?!…)[A-Za-z0-9_-]{4,}/, 'aucune cle dans RESULTATS');
});

// --- Passerelle, tache 2 : 0004, preuve, index.ts, README (spec 2026-10-18-passerelle-assistant § 4-5) -----------------
// 0004 est ecrite a la main (comme les preuves) : NOMS et le generateur n'y touchent pas, et `--check` ne la lit pas.
// Ces tests relisent ce qu'une relecture laisse passer : une regle de lecture, un privilege client, une colonne qui
// pourrait porter du contenu, une adresse reelle, un import hors liste, un journal de console, une cle, des gardes
// dans le mauvais ordre. Les tests de texte du SOURCE d'index.ts restent des filets : le comportement des gardes se
// prouve par les sondes du deploiement (README, etape 10), pas ici.
import { OUTILS as OUTILS_PASSERELLE } from '../supabase/functions/assistant/logique.js';
const FONCTION = 'supabase/functions/assistant';
// F-2 (lot B) : 0004 est APPLIQUÉE et figée ; sa liste d'outils est un littéral (comme SYNC_STORES_0001). OUTILS ne fait que croître : ses trois
// premiers sont ceux de 0004 ; le quatrième (lecture-web) entre par 0006.
const OUTILS_0004 = ['recherche-web', 'creation', 'extraction'];

test('0004 : une transaction a ajout seul, journal de compteurs sans contenu, RLS sans regle, aucun privilege client', () => {
  const m = lire('supabase/migrations/0004_assistant_journal.sql');
  const code = sansCommentaires(m);
  const l = instructions(code);
  assert.equal(l[0], 'begin;'); assert.equal(l[l.length - 1], 'commit;');
  assert.equal(l.filter((x) => x === 'begin;').length, 1, 'une seule transaction');
  assert.equal(code, code.toLowerCase(), 'SQL en minuscules');
  // A ajout seul : rien de supprime, rien de modifie, aucune fonction recreee ; un seul `alter table`, celui de la RLS.
  assert.doesNotMatch(code, /\b(drop|truncate)\b|\bcreate or replace\b|^\s*(delete|update)\b/m);   // « on delete cascade » (cle etrangere) reste permis
  assert.deepEqual(code.match(/\balter table [^;]+;/g), ['alter table public.assistant_journal enable row level security;']);
  assert.match(code, /create table public\.assistant_journal \(/);
  assert.equal((code.match(/create table /g) || []).length, 1, 'une seule table');
  // Compteurs seulement : les colonnes du brief, une seule colonne texte (l'outil), jamais jsonb ni bytea.
  for (const c of ['owner_id uuid not null references auth.users (id) on delete cascade', 'outil text not null', 'statut integer not null', 'jetons_entree integer', 'jetons_sortie integer', 'duree_ms integer not null default 0', 'octets integer', 'jour date not null', 'cree_le timestamptz not null default now()']) assert.ok(code.includes(c), c);
  const bloc = code.slice(code.indexOf('create table public.assistant_journal ('), code.indexOf('\n);', code.indexOf('create table public.assistant_journal (')));
  assert.equal((bloc.match(/\btext\b/g) || []).length, 1, 'une seule colonne texte dans la table : l outil');
  assert.doesNotMatch(code, /\b(jsonb?|bytea|varchar|char)\b/);
  // La liste blanche des outils du journal est celle de 0004, figée ; OUTILS la prolonge sans la changer (F-2).
  assert.ok(code.includes(`check (outil in (${OUTILS_0004.map((o) => `'${o}'`).join(', ')}))`), 'outils du journal de 0004 = OUTILS_0004');
  assert.deepEqual(OUTILS_PASSERELLE.slice(0, 3), OUTILS_0004, 'OUTILS commence par les trois outils de 0004');
  // RLS activee SANS aucune regle, et plus aucun privilege pour les roles clients (table, sequence, vue).
  assert.doesNotMatch(code, /create policy/);
  assert.ok(code.includes('alter table public.assistant_journal enable row level security;'));
  assert.ok(code.includes('revoke all on public.assistant_journal from anon, authenticated;'));
  assert.ok(code.includes('revoke all on sequence public.assistant_journal_id_seq from anon, authenticated;'));
  assert.ok(code.includes('create index assistant_journal_owner_jour on public.assistant_journal (owner_id, jour);'));
  assert.equal((code.match(/create index /g) || []).length, 1, 'un seul index');
  assert.match(code, /create view public\.assistant_usage_jour with \(security_invoker = true\) as/);
  assert.ok(code.includes('revoke all on public.assistant_usage_jour from anon, authenticated;'));
  // Le seul grant du fichier : l'execution de la fonction de reservation par la cle secrete du projet (service_role).
  assert.deepEqual(code.match(/\bgrant [^;]+;/g), ['grant execute on function public.assistant_reserver(uuid, text, integer, integer) to service_role;']);
  // La reservation atomique (fix 1) : verrou par compte, comptage du jour UTC, insertion statut 0 ; security INVOKER.
  assert.equal((code.match(/create function /g) || []).length, 1, 'une seule fonction');
  assert.ok(code.includes('create function public.assistant_reserver(p_owner uuid, p_outil text, p_octets integer, p_quota integer)'));
  assert.ok(code.includes('returns bigint language plpgsql security invoker set search_path = \'\' as $$'), 'security invoker, search_path vide');
  assert.doesNotMatch(code, /security definer/);
  assert.ok(code.includes("perform pg_advisory_xact_lock(hashtext('assistant_journal'), hashtext(p_owner::text));"), 'verrou par compte');
  assert.ok(code.includes("v_jour date := (now() at time zone 'utc')::date"), 'jour UTC');
  assert.ok(code.includes('if v_n >= p_quota then return null; end if;'), 'quota atteint : null');
  assert.ok(code.includes('insert into public.assistant_journal (owner_id, outil, statut, octets, jour) values (p_owner, p_outil, 0, p_octets, v_jour) returning id into v_id;'));
  assert.ok(code.includes('revoke all on function public.assistant_reserver(uuid, text, integer, integer) from public, anon, authenticated;'));
  assert.doesNotMatch(m, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'aucune adresse');
  assert.ok(!m.includes('sk-'), 'aucune cle');
});
test('0004 (P-8) : le commentaire dit l hypothese READ COMMITTED juste au-dessus de la fonction', () => {
  const m = lire('supabase/migrations/0004_assistant_journal.sql');
  const fn = m.indexOf('create function public.assistant_reserver(');
  assert.notEqual(fn, -1);
  const avant = m.slice(0, fn).split('\n');
  assert.equal(avant.at(-1), '', 'la fonction commence en debut de ligne');
  assert.equal(avant.at(-2), "-- Le motif verrou-puis-comptage suppose READ COMMITTED (défaut de PostgREST) : en REPEATABLE READ l'instantané précéderait le verrou.");
});
test('0004 : hors du generateur — absente de NOMS (six generees depuis L2), le dossier de migrations la contient', () => {
  assert.deepEqual(NOMS, ['0001_tables_et_regles.sql', '0002_stockage.sql', '0003_assistant_config.sql', '0005_imports.sql', '0008_corbeille_recettes.sql', '0009_corbeille_livres.sql', '0010_sources_index.sql']);
  assert.ok(!NOMS.some((n) => n.startsWith('0004')), '0004 n est pas generee');
  assert.ok(readFileSync(path.join(MIGRATIONS, '0004_assistant_journal.sql'), 'utf8').length > 0);
});

test('preuve 0004 : rollback final, BILAN, aucune adresse ni jeton, privileges et refus 42501 des deux roles clients', () => {
  const p = lire('supabase/proofs/0004_assistant_journal.sql');
  const code = sansCommentaires(p);
  const l = instructions(code);
  assert.equal(l[l.length - 1], 'rollback;');
  assert.equal(l[l.length - 2], 'select ordre, etape, attendu, obtenu, ok from pg_temp.preuve order by ordre;');
  assert.equal(l.filter((x) => x === 'begin;').length, 1, 'une seule transaction');
  assert.match(code, /select 999,\s*'BILAN'/);
  // Aucune adresse : ni reelle, ni meme exemple.invalid — la preuve emprunte un compte existant sans jamais le nommer.
  assert.doesNotMatch(p, /@(?!exemple\.invalid)[a-z0-9.-]+\.[a-z]{2,}/i, 'aucune adresse reelle');
  assert.ok(!p.includes('@'), 'aucun arobase du tout');
  assert.doesNotMatch(p, /A_UUID|B_UUID|A_EMAIL|B_EMAIL/, 'aucun jeton a remplacer');
  assert.doesNotMatch(code, /allowed_users/, 'la liste des adresses n est pas touchee');
  assert.doesNotMatch(code, /\bemail\b/i, 'aucune adresse lue ni affichee');
  assert.ok(!p.includes('sk-'), 'aucune cle');
  // Les verdicts du brief : 1.01-1.05 (presence, RLS, aucune regle, privileges, index, vue), 2.01-2.02 (refus), 3.01.
  for (const n of ['0.01', '1.01', '1.02', '1.03', '1.04', '1.05', '1.06', '1.07', '1.08', '1.09', '1.10', '1.11', '2.01', '2.02', '2.03', '2.04', '3.01', '3.02', '3.03', '3.04']) assert.ok(code.includes(`${n},`), 'verdict ' + n);
  assert.ok(code.includes("to_regclass('public.assistant_journal') is null"), 'garde : 0004 collee d abord');
  assert.ok(code.includes('relrowsecurity'), 'RLS activee');
  assert.ok(code.includes('pg_policies'), 'aucune regle');
  for (const role of ['anon', 'authenticated']) {
    assert.ok(code.includes(`has_table_privilege('${role}', 'public.assistant_journal'`), 'privileges de ' + role);
    assert.ok(code.includes(`has_table_privilege('${role}', 'public.assistant_usage_jour'`), 'privileges de ' + role + ' sur la vue');
  }
  assert.ok(code.includes('select, insert, update, delete'), 'les quatre privileges de donnees');
  assert.ok(code.includes('assistant_journal_owner_jour'), 'index (owner_id, jour)');
  assert.ok(code.includes('security_invoker=true'), 'vue en security invoker');
  // Refus sous le role authenticated : lecture ET ecriture levent 42501 (attrapes), puis le role est remis.
  assert.ok(code.includes('insufficient_privilege') || code.includes('42501'), '42501 attendu');
  // P-3 : 2.04 ne se contente pas d un 42501 quelconque (un refus de schema serait aussi un 42501) : le message doit NOMMER la fonction.
  const v204 = code.slice(code.indexOf('(2.04,'), code.indexOf('end $$;', code.indexOf('(2.04,')));
  assert.ok(v204.includes("v like '42501%' and (v like '%assistant_reserver%' or v like '%function%')"), '2.04 : 42501 ET message qui nomme la fonction');
  assert.ok(!/(2\.04,[^;]*), v like '42501%'\);/.test(v204), '2.04 : plus de verdict sur le seul 42501');
  assert.equal(l[l.length - 1], 'rollback;', 'rollback reste la derniere instruction');
  assert.ok(code.includes('select count(*) from public.assistant_journal') || code.includes('perform count(*) from public.assistant_journal'), 'lecture tentee');
  assert.match(code, /insert into public\.assistant_journal/, 'ecriture tentee ou de preuve');
  const posRole = (re) => [...code.matchAll(re)].map((m) => m.index);
  const sets = posRole(/set local role authenticated;/g); const resets = posRole(/reset role;/g);
  assert.ok(sets.length >= 1 && sets.length === resets.length, 'chaque role pris est rendu');
  assert.ok(sets.every((s, i) => s < resets[i] && (i + 1 === sets.length || resets[i] < sets[i + 1])), 'set local role / reset role alternent');
  // 3.01 : compte existant, jamais affiche ; sans compte, etape sautee mais verdict vert.
  assert.ok(code.includes('from auth.users order by created_at limit 1'), 'compte existant le plus ancien');
  assert.ok(code.includes("'aucun compte : etape sautee'"), 'auth.users vide');
  assert.ok(code.includes('from public.assistant_usage_jour'), 'la vue est lue');
  // Fix 1 : la fonction de reservation est prouvee (existence, security invoker, volatile, search_path, privileges des trois roles,
  // refus 42501 sous authenticated, puis quota atteint sous postgres) ; la concurrence elle-meme est dite non prouvable ici.
  assert.ok(code.includes("to_regprocedure('public.assistant_reserver(uuid,text,integer,integer)') is null"), 'garde : fonction absente');
  for (const m of ['prosecdef', 'provolatile', "like 'search_path=%'", 'public.assistant_reserver(uuid,text,integer,integer)']) assert.ok(code.includes(m), m);
  for (const role of ['anon', 'authenticated', 'service_role']) assert.ok(code.includes(`has_function_privilege('${role}', 'public.assistant_reserver(uuid,text,integer,integer)', 'execute')`), 'execute de ' + role);
  assert.ok(code.includes("perform public.assistant_reserver('00000000-0000-0000-0000-000000000000'"), 'appel refuse sous authenticated');
  assert.ok(code.includes('public.assistant_reserver(uid, \'creation\', 1, c::integer + 1)') || code.includes('public.assistant_reserver(uid, '), 'reservation sous postgres');
  assert.ok(/non prouvable|ne se prouve pas/.test(p), 'la concurrence n est pas revendiquee');
  // 1.09 : un has_table_privilege PAR privilege, relies par `and` (une liste ne demande que l\'un d\'eux).
  const v109 = code.slice(code.indexOf('select 1.09,'), code.indexOf('insert into pg_temp.preuve', code.indexOf('select 1.09,')));
  for (const priv of ['select', 'insert', 'update']) assert.ok(v109.includes(`has_table_privilege('service_role', 'public.assistant_journal', '${priv}')`), '1.09 ' + priv);
  assert.doesNotMatch(v109, /has_table_privilege\('service_role', 'public\.assistant_journal', '[a-z]+,/, '1.09 : pas de liste de privileges');
  // F-12 (M10) : l'id est un bigserial — l'insertion de la reservation (service_role) appelle nextval, donc exige USAGE sur la sequence. Le verdict
  // 1.09 le prouve avec les autres droits de la cle secrete (un seul privilege, relie par `and` aux autres).
  assert.ok(v109.includes("has_sequence_privilege('service_role', 'public.assistant_journal_id_seq', 'usage')"), '1.09 : usage sur la sequence de id');
  assert.doesNotMatch(v109, /has_sequence_privilege\('service_role', 'public\.assistant_journal_id_seq', '[a-z]+,/, '1.09 : pas de liste de privileges de sequence');
  assert.ok(v109.includes("'true / true / true / true / true'") && v109.includes('s and i and u and v and q'), '1.09 : cinq verdicts relies par and');
  // Le jeton de la requete est pose par un `perform` dans un bloc do : aucun `select set_config` ne renvoie l\'UUID emprunte.
  assert.ok(code.includes('perform set_config('));
  assert.doesNotMatch(code, /^select set_config\(/m);
});

test('index.ts : imports fermes, deno.json epingle, aucune cle ni journal de console, gardes dans l ordre', () => {
  const src = lire(`${FONCTION}/index.ts`);
  const code = sansCommentaires(src);
  // Imports : exactement trois (lot B), ./logique.js, ./lecture-web.js et le specificateur nu resolu par deno.json.
  assert.equal((code.match(/^\s*import\b/gm) || []).length, 3, 'trois imports');
  const specs = [...code.matchAll(/^\s*import\s[^;]*?\sfrom\s+(['"])([^'"]+)\1/gm)].map((m) => m[2]).sort();
  assert.deepEqual(specs, ['./lecture-web.js', './logique.js', '@supabase/supabase-js']);
  const importes = (code.match(/import \{([^}]*)\} from '\.\/logique\.js'/) || [])[1] || '';
  assert.ok(importes.includes('lireDemande'), 'lireDemande importee');
  assert.ok(!/\bdecisionQuota\b/.test(code), 'decisionQuota reste dans logique.js, plus dans index.ts');
  assert.doesNotMatch(code, /\bimport\s*\(/); assert.doesNotMatch(code, /\brequire\s*\(/);
  assert.doesNotMatch(code, /\bfrom\s+['"](?:https?:|npm:|jsr:|node:)/);
  const deno = JSON.parse(lire(`${FONCTION}/deno.json`));
  assert.deepEqual(deno, { imports: { '@supabase/supabase-js': 'npm:@supabase/supabase-js@2.118.0' } });
  assert.ok(code.includes('Deno.serve('));
  // Jamais : une cle, l'acces direct du navigateur, un journal de console (aucun corps de demande ou de reponse n'est journalise).
  assert.ok(!src.includes('sk-'), 'aucune cle');
  assert.ok(!src.includes('anthropic-dangerous-direct-browser-access'));
  assert.ok(!src.includes('console.log('));
  assert.doesNotMatch(src, /\bconsole\s*\./, 'aucun journal du tout');
  assert.equal((code.match(/ANTHROPIC_API_KEY/g) || []).length, 1, 'la cle n est lue qu une fois : dans l en-tete x-api-key');
  assert.ok(code.includes("'x-api-key': env('ANTHROPIC_API_KEY')"));
  assert.ok(code.includes("redirect: 'error'"), 'Anthropic : redirect error');
  // Lot B (D-B1, S-12, I-B8) : la page est demandée sans suivre les redirections (chacune est revalidée), sans identité, avec un User-Agent qui
  // nomme Mitsu ; la vérification TLS n'est jamais relâchée (aucun client HTTP sur mesure).
  assert.ok(code.includes("redirect: 'manual'") && code.includes("credentials: 'omit'"), 'la page : redirect manual, credentials omit');
  assert.ok(code.includes("'user-agent': 'Mitsu/"), 'User-Agent nomme Mitsu');
  assert.doesNotMatch(code, /Deno\.createHttpClient|caCerts/, 'TLS jamais relache');
  assert.ok(code.includes("'anthropic-version': '2023-06-01'"));
  assert.ok(code.includes('LIMITES.attenteMs'), 'delai de 120 s');
  // Octets : la taille en OCTETS du corps lu (pas les unites UTF-16 du texte), a la lecture et au journal.
  // Fix 2 : le corps est lu BORNE (content-length, puis flux par morceaux), jamais par req.text() ni arrayBuffer().
  assert.ok(code.includes("async function lireCorpsBorne(") && code.includes("headers.get('content-length')") && code.includes('getReader('));
  assert.ok(code.includes('await lireCorpsBorne(req, LIMITES.corpsExtraction)') && code.includes('await lireCorpsBorne(r, LIMITES.reponse)'));
  assert.ok(code.includes('new TextDecoder().decode('));
  assert.doesNotMatch(code, /\.arrayBuffer\(|\.text\(\)|\.json\(\)/, 'aucune lecture non bornee');
  // Fix 3 : aucune exception ne sort sans CORS ni { erreur }.
  assert.match(code, /try \{\s*return await traiter\(req, cors, origine\);\s*\} catch \{\s*return json\(502, corpsErreur\('serveur'\), cors\);/);
  // Fix 4 : les secrets sont lus par requete, pas au chargement du module.
  assert.doesNotMatch(code, /^const (ORIGINES|MODELE|QUOTA)\b/m);
  assert.ok(code.includes("Number.isInteger(brut) && brut > 0 && brut <= INT4_MAX ? brut : LIMITES.quotaJour"), 'P-5 : quota borne a l int4');
  assert.ok(code.includes('const INT4_MAX = 2147483647;'), 'P-5 : la borne est celle de l integer SQL (p_quota)');
  // P-6 : un secret change est pris au prochain appel — un isolat deja chaud peut garder l ancienne valeur (non prouve).
  assert.ok(src.includes("un isolat déjà chaud peut garder l'ancienne valeur jusqu'à son recyclage (non prouvé)"), 'P-6 : le commentaire ne promet plus « meme par un isolat deja chaud »');
  assert.ok(!src.includes('même par un isolat déjà chaud'));
  // Fix 5 : la mise a jour ne pose que quatre champs.
  assert.ok(code.includes('update({ statut: l.statut, jetons_entree: l.jetons_entree, jetons_sortie: l.jetons_sortie, duree_ms: l.duree_ms })'));
  assert.doesNotMatch(code, /texte\.length/);
  assert.equal((code.match(/\boctets: bytes\.byteLength/g) || []).length, 2, 'lireDemande + la ligne du journal');
  assert.equal((code.match(/p_octets: bytes\.byteLength/g) || []).length, 1, 'la reservation compte des octets');
  assert.ok(code.includes('maxTokens: LIMITES.maxTokens'));
  assert.equal((code.match(/maintenant: new Date\(\)\.toISOString\(\)/g) || []).length, 1, 'la mise a jour (la reservation est en SQL)');
  // Les raisons de lireDemande rejoignent la liste fermee de l'erreur HTTP.
  assert.ok(code.includes("lu.raison === 'trop_lourd' ? 'trop_lourd' : lu.raison === 'bornes' ? 'bornes' : lu.raison === 'serveur' ? 'serveur' : lu.raison === 'interdit' ? 'interdit' : 'requete'"), 'interdit rejoint la liste fermee (lot B)');
  assert.ok(code.includes('json(lu.statut,'));
  // Ordre du flux (lot B, N-1 ; lot F) : épinglé par les POINTS D'APPEL de traiter(), jamais par la place des déclarations — gardes, réservation,
  // téléchargement de la page, lecture de la page, téléchargement de l'image, appel au modèle (en repli seulement), mise à jour du journal. Les
  // quatre déclarations (async function suivreRedirections<T>(, telechargerPage(, telechargerImage( et appelerAnthropic() et le cast local de
  // lirePageHtml ne portent aucun de ces marqueurs.
  assert.deepEqual(ordreDuFlux(code), { presents: true, croissants: true }, 'gardes, reservation, telechargement, lecture, modele, journal : dans cet ordre');
  for (const m of ['await fetch(ANTHROPIC', "redirect: 'manual'", "redirect: 'error'", 'async function telechargerPage(', 'async function appelerAnthropic(']) assert.ok(code.includes(m), m);
  assert.equal((code.match(/await fetch\(/g) || []).length, 2, 'deux appels sortants : la page ou l image dans suivreRedirections, le fournisseur dans appelerAnthropic');
  assert.ok(code.includes('await fetch(courant, {') && code.includes('await fetch(ANTHROPIC, {'), 'les deux appels sortants nommes');
});
// Les marqueurs du flux de traiter() (N-1) et leur ordre : présents ET strictement croissants. Exportée en fonction pour rejouer le mutant
// « réservation après le téléchargement » et le témoin « appelerAnthropic déclarée avant traiter » sur un texte modifié.
const ORDRE_DU_FLUX = ["req.method === 'OPTIONS'", 'origineAdmise(origine, admises)', "req.method !== 'POST'", 'auth.getUser(jeton)', "rpc('is_allowed')",
  "req.method === 'GET'", 'await lireCorpsBorne(req,', 'lireDemande(texte', ".rpc('assistant_reserver'", 'await telechargerPage(', 'lirePageHtml(', 'await telechargerImage(', 'await appelerAnthropic(', '.update('];
function ordreDuFlux(code) {
  const pos = ORDRE_DU_FLUX.map((s) => code.indexOf(s));
  return { presents: pos.every((x) => x !== -1), croissants: pos.every((x, i) => i === 0 || x > pos[i - 1]) };
}
test('index.ts (N-1) : le test d ordre tient par les points d appel — mutant « reservation apres le telechargement » rouge, temoin « declarations deplacees » vert', () => {
  const code = sansCommentaires(lire(`${FONCTION}/index.ts`));
  for (const nom of ['async function suivreRedirections<T>(', 'async function telechargerPage(', 'async function telechargerImage(', 'async function appelerAnthropic(']) {
    const debut = code.indexOf(nom); assert.notEqual(debut, -1, nom + ' : declaration trouvee');
    const corps = code.slice(debut, code.indexOf('\n}\n', debut));
    assert.ok(!/await (telechargerPage|telechargerImage|appelerAnthropic)\(/.test(corps) && !corps.includes('lirePageHtml('), nom + ' ne porte aucun marqueur du flux');
  }
  const ligneImport = code.split('\n').find((l) => l.includes("from './lecture-web.js'")) || '';
  const cast = code.split('\n').find((l) => l.startsWith('const lirePageHtml = ')) || '';
  assert.ok(ligneImport && cast && !ligneImport.includes('lirePageHtml(') && !cast.includes('lirePageHtml('), 'ni l import ni le cast ne portent lirePageHtml(');
  // Mutant : la réservation déplacée sous le téléchargement → l'ordre casse.
  const reservation = code.slice(code.indexOf('  const { data: idReserve'), code.indexOf('\n', code.indexOf('  const { data: idReserve')) + 1);
  const apres = code.indexOf('\n', code.indexOf('await telechargerPage(')) + 1;
  const mutant = code.replace(reservation, '').slice(0, apres - reservation.length) + reservation + code.replace(reservation, '').slice(apres - reservation.length);
  assert.ok(mutant.indexOf(".rpc('assistant_reserver'") > mutant.indexOf('await telechargerPage('), 'le mutant porte bien la reservation sous le telechargement');
  assert.deepEqual(ordreDuFlux(mutant), { presents: true, croissants: false }, 'mutant « reservation apres le telechargement » : rouge');
  // Témoin : les quatre déclarations (suivreRedirections<T>, telechargerPage, telechargerImage, appelerAnthropic) AVANT traiter (elles le sont)
  // ou APRÈS : le test reste vert.
  const decl = (nom) => { const d = code.indexOf(nom); assert.notEqual(d, -1, nom + ' : declaration trouvee'); return code.slice(d, code.indexOf('\n}\n', d) + 3); };
  const deplacees = [decl('async function suivreRedirections<T>('), decl('async function telechargerPage('), decl('async function telechargerImage('), decl('async function appelerAnthropic(')];
  let temoin = code; for (const d of deplacees) temoin = temoin.replace(d, '');
  temoin = temoin + '\n' + deplacees.join('\n');
  assert.deepEqual(ordreDuFlux(temoin), { presents: true, croissants: true }, 'temoin : les declarations peuvent etre n importe ou');
});
test('deno.d.ts : declarations minimales pour tsc, jamais importees', () => {
  const d = lire(`${FONCTION}/deno.d.ts`);
  assert.match(d, /declare namespace Deno/);
  assert.match(d, /declare module '@supabase\/supabase-js'/);
  assert.ok(!sansCommentaires(lire(`${FONCTION}/index.ts`)).includes('deno.d'), 'index.ts n importe pas deno.d.ts');
  assert.ok(!d.includes('sk-'));
});

test('README : etape 10 (secrets, deploiement --no-verify-jwt, 0004 et sa preuve, sondes, quota, rotation)', () => {
  const r = lire('supabase/README.md');
  const debut = r.indexOf("### 10. La passerelle de l'assistant : secret, fonction, `0004` et sa preuve");
  assert.notEqual(debut, -1, 'etape 10');
  assert.ok(r.indexOf('### 9. Fermer les autres portes') < debut && debut < r.indexOf('## Où coller les sorties'), '10 apres 9, avant « Où coller les sorties »');
  const etape = rubrique(r, "### 10. La passerelle de l'assistant : secret, fonction, `0004` et sa preuve");
  for (const m of ['--no-verify-jwt', 'ANTHROPIC_API_KEY', 'OPTIONS', '0004', 'ASSISTANT_MODELE', 'ASSISTANT_QUOTA_JOUR', 'ASSISTANT_ORIGINES',
    'Edge Functions', 'Secrets', 'supabase login', 'supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt',
    'migrations/0004_assistant_journal.sql', 'proofs/0004_assistant_journal.sql', 'Run without RLS', '999 BILAN',
    '204', '401', '"erreur":"non_connecte"', 'quotaJour', 'supabase secrets set ASSISTANT_QUOTA_JOUR=', 'rotation']) assert.ok(etape.includes(m), m);
  // Ordre de lecture : secret, deploiement, 0004 puis sa preuve, sondes, quota, rotation.
  const i = ['ANTHROPIC_API_KEY', 'supabase functions deploy assistant', 'migrations/0004_assistant_journal.sql', 'proofs/0004_assistant_journal.sql', '"erreur":"non_connecte"', 'supabase secrets set ASSISTANT_QUOTA_JOUR=', 'rotation'].map((m) => etape.indexOf(m));
  assert.deepEqual([...i].sort((a, b) => a - b), i, 'dans l ordre : ' + i.join(','));
  // Le secret ne vit jamais dans un fichier ni dans le depot : on ne cite que son NOM.
  assert.doesNotMatch(etape, /sk-[A-Za-z0-9_-]{4,}/, 'aucune cle');
  assert.ok(/jamais dans un fichier/i.test(etape), 'secret jamais en fichier');
  // Fix 6 : le jeton de session n'est jamais colle en clair dans une commande ; ASSISTANT_ORIGINES remplace le defaut ; 0004 porte la reservation.
  assert.ok(etape.includes('read -rs JETON') && etape.includes('"Authorization: Bearer $JETON"') && etape.includes('unset JETON'), 'jeton lu sans echo');
  assert.doesNotMatch(etape, /Bearer <jeton>/, 'jamais le jeton en clair dans une commande');
  assert.ok(etape.includes('REMPLACE la valeur par défaut') && etape.includes('lister les deux origines'), 'ASSISTANT_ORIGINES remplace le defaut');
  assert.ok(etape.includes('assistant_reserver'), 'la reservation atomique est nommee');
  // P-7 : apres 0004 et avant sa preuve, la ligne de rechargement du schema de PostgREST, collee seule, avec sa raison.
  const notify = "notify pgrst, 'reload schema';";
  assert.equal(etape.split(notify).length - 1, 1, 'P-7 : la ligne est donnee une fois');
  assert.ok(etape.indexOf('migrations/0004_assistant_journal.sql') < etape.indexOf(notify) && etape.indexOf(notify) < etape.indexOf('proofs/0004_assistant_journal.sql'), 'P-7 : apres 0004, avant sa preuve');
  assert.ok(etape.includes('PGRST202') && etape.includes('502') && /seule/.test(etape.slice(etape.indexOf(notify) - 200, etape.indexOf(notify) + 300)), 'P-7 : collee seule, raison dite (PGRST202, les POST rendent 502)');
  // P-6 : un isolat deja chaud peut garder l ancienne valeur d un secret.
  assert.ok(etape.replace(/\s+/g, ' ').includes("prise au prochain appel ; un isolat déjà chaud peut garder l'ancienne valeur jusqu'à son recyclage (non prouvé)"), 'P-6 : README (a la coupure de ligne pres)');
  // L'arbre du README nomme les nouveaux fichiers.
  for (const f of ['migrations/0004_assistant_journal.sql', 'proofs/0004_assistant_journal.sql', 'functions/assistant/']) assert.ok(r.slice(0, debut).includes(f), 'arbre : ' + f);
});

// --- Vague finale : README racine (F-2), README du serveur étape 10 (F-1, F-9, F-14), RESULTATS (F-1, une phrase) ----------
test('README racine (F-2) : plus de cle ni de fournisseur a configurer — l assistant est servi par le compte, la cle vit cote serveur', () => {
  const r = lire('README.md');
  for (const motif of [/Anthropic configur/, /clé réelle/, /Tester/, /compatible OpenAI/, /compte Anthropic/, /Anthropic seulement/, /assistant Anthropic/, /dans Réglages\)/, /clé locale/]) assert.doesNotMatch(r, motif, 'README racine : ' + motif);
  assert.ok(r.includes("Web (avec l'assistant, une fois connecté)"), 'la ligne de la recherche Web');
  // Une phrase, aux deux endroits qui parlaient de configurer : la ligne du tableau et la verification sur appareil.
  const tableau = r.split('\n').find((l) => l.startsWith('| Assistant IA'));
  assert.ok(tableau && tableau.includes('servi par ton compte') && tableau.includes('la clé vit côté serveur') && tableau.includes('rien à configurer'), 'tableau : ' + tableau);
  const verif = r.split('\n').find((l) => l.startsWith('5. '));
  assert.ok(verif && verif.includes('servi par le compte') && verif.includes('la clé vit côté serveur') && verif.includes('rien à configurer'), 'verification 5 : ' + verif);
  assert.ok(r.includes("Un appel à l'assistant par clic"), 'Creer avec l IA : un appel a l assistant par clic');
});

test('README etape 10 (F-14) : deploiement avec --use-api, exemple d origine locale sur 8086', () => {
  const r = lire('supabase/README.md');
  const etape = rubrique(r, "### 10. La passerelle de l'assistant");
  assert.ok(etape.includes('supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api'), 'commande avec --use-api');
  assert.ok(/--use-api[^\n]*\n|`--use-api`/.test(etape) && /Docker/.test(etape), '--use-api est expliqué : sans Docker');
  assert.ok(!etape.includes('8083') && etape.includes('http://localhost:8086'), 'exemple d origine locale : le port 8086, plus 8083');
});

test('README etape 10 (F-1) : la sonde GET montre { modele, quotaJour, cles } — le repere des cles, jamais une cle', () => {
  const r = lire('supabase/README.md');
  const etape = rubrique(r, "### 10. La passerelle de l'assistant");
  assert.ok(etape.includes('"modele":"claude-sonnet-5-5","quotaJour":60,"cles":') , 'le GET montre cles');
  for (const m of ['nouvelles', 'legacy', 'mixte', 'sb_publishable_', 'sb_secret_']) assert.ok(etape.includes(m), 'cles : ' + m);
  assert.doesNotMatch(etape, /sb_(publishable|secret)_[A-Za-z0-9]{6,}/, 'aucune cle reelle : les prefixes seulement');
});

test('README etape 10 (F-9) : un geste FACULTATIF pour vider cote serveur toute ligne qui porterait encore une cle', () => {
  const r = lire('supabase/README.md');
  const etape = rubrique(r, "### 10. La passerelle de l'assistant");
  const sql = `update public.assistant_config set data = data || '{"provider":"none","model":"","base_url":"","api_key":""}'::jsonb, updated_at = now() where coalesce(data->>'api_key','') <> '' or coalesce(data->>'provider','none') <> 'none';`;
  assert.ok(etape.includes(sql), 'la commande SQL exacte');
  const i = etape.indexOf(sql);
  const entour = etape.slice(Math.max(0, i - 900), i + 900);
  assert.ok(/facultatif/i.test(entour), 'dite facultative');
  assert.ok(i > etape.indexOf('rotation'), 'apres la rotation, en dernier geste de l etape');
  // Les noms de colonnes sont ceux de 0003 (table public.assistant_config, colonne jsonb `data`, `updated_at`).
  const m3 = lire('supabase/migrations/0003_assistant_config.sql');
  for (const col of ['create table public.assistant_config', '  data       jsonb not null,', '  updated_at timestamptz not null,']) assert.ok(m3.includes(col), '0003 : ' + col);
});

test('RESULTATS-mitsu (F-1) : la note de S5 ne dit plus « cle publique nouvelle » — nouvelle ou legacy, la sonde ne les distingue pas', () => {
  const res = lire('supabase/proofs/RESULTATS-mitsu.md');
  const s5 = res.split('\n').find((l) => l.startsWith('| S5 |'));
  assert.ok(s5, 'ligne S5');
  assert.ok(s5.includes('donc `createClient` a reçu une clé publique valide — nouvelle ou legacy, cette sonde ne les distingue pas ; le GET avec une session réelle le dira (`cles`)'), s5);
  assert.ok(!s5.includes('a bien reçu') && !s5.includes('SUPABASE_PUBLISHABLE_KEYS` lu'), 'ancienne affirmation retiree');
});

// --- Lot A (import cible), tache 2 : migration 0005 a ajout seul, sa preuve, README etape 11, RESULTATS (spec import-cible § 3.5, § 7) ------
// 0005 est rendue pour les magasins de SYNC_STORES absents de la liste FIGEE SYNC_STORES_0003 (aujourd'hui : imports, le dernier, K-9), avec
// les quatre fonctions recreees sur les 27 noms. 0001, 0002 et 0003 ne bougent pas d'un octet (empreintes plus haut). Les tests relisent le
// SQL PRODUIT (renderMigrations) puis le fichier commite, la preuve, le README et RESULTATS, comme pour 0003.
const QUATRE = ['sync_push', 'sync_purge', 'sync_purge_all', 'purge_tombstones'];

test('SYNC_STORES : 27 noms, les 26 figes de 0003 puis imports, le dernier (K-9) ; 0005 ne porte qu imports', () => {
  assert.equal(SYNC_STORES.length, 27);
  assert.deepEqual(SYNC_STORES.slice(0, 26), [...SYNC_STORES_0003]);
  assert.equal(SYNC_STORES.at(-1), 'imports');
  assert.deepEqual(SYNC_STORES.filter((s) => !SYNC_STORES_0003.includes(s)), ['imports']);
});
test('0005 : une seule table neuve, public.imports, du gabarit (cle composee, RLS, quatre regles, declencheur, cascade)', () => {
  assert.equal(typeof imports, 'string', 'renderMigrations rend une quatrieme cible : imports');
  assert.equal((imports.match(/create table public\./g) || []).length, 1);
  assert.match(imports, /create table public\.imports \(/);
  assert.doesNotMatch(imports, /create table public\.(assistant_config|books|files)/);
  assert.equal((imports.match(/primary key \(owner_id, id\)/g) || []).length, 1);
  assert.equal((imports.match(/references auth\.users\(id\) on delete cascade/g) || []).length, 1);
  assert.match(imports, /alter table public\.imports enable row level security;/);
  const policies = imports.match(/create policy[^;]+;/g) || [];
  assert.equal(policies.length, 4);
  for (const p of policies) { assert.match(p, /on public\.imports for /); assert.match(p, /to authenticated/); assert.match(p, /public\.is_allowed\(\) and owner_id = auth\.uid\(\)/); }
  assert.deepEqual(policies.map((p) => p.match(/ for (\w+) /)[1]), ['select', 'insert', 'update', 'delete']);
  assert.match(policies[3], /current_setting\('app\.purge', true\) = 'on'/);
  assert.match(imports, /create trigger imports_seq before insert or update on public\.imports for each row execute function public\.touch_server_seq\(\);/);
  assert.equal((imports.match(/execute function public\.touch_server_seq\(\)/g) || []).length, 1);
});
test('0005 : colonnes generees edition_id, recipe_id, status (text, (data->>…) stored), DANS le bloc create table', () => {
  const debut = imports.indexOf('create table public.imports (');
  assert.notEqual(debut, -1);
  const bloc = imports.slice(debut, imports.indexOf('\n);', debut));
  for (const c of ['edition_id', 'recipe_id', 'status']) {
    assert.match(bloc, new RegExp(`\\n  ${c} text generated always as \\(data->>'${c}'\\) stored`), c);
  }
  assert.equal((bloc.match(/generated always as/g) || []).length, 3, 'trois colonnes generees, pas une de plus');
  assert.doesNotMatch(bloc, /check \(not \(data \? 'blob'\)\)/, 'la contrainte de files ne deborde pas sur imports');
  // Celles du schema : les trois index declares de STORES.imports, ni plus ni moins ; cle id ; aucun champ requis (recipe_id est nul pour un index).
  assert.deepEqual(TABLES.imports.generated.map((g) => g.name), ['edition_id', 'recipe_id', 'status']);
  assert.equal(TABLES.imports.key, 'id');
  assert.deepEqual(TABLES.imports.required, []);
});
test('0005 : index imports_recv (owner_id, server_seq) et un index par colonne generee ; revoke anon une fois, entre la table et les fonctions', () => {
  assert.match(imports, /create index imports_recv on public\.imports \(owner_id, server_seq\);/);
  for (const c of ['edition_id', 'recipe_id', 'status']) assert.match(imports, new RegExp(`create index imports_${c} on public\\.imports \\(owner_id, ${c}\\);`), c);
  assert.equal((imports.match(/create index /g) || []).length, 4, 'quatre index : recv + trois colonnes');
  assert.match(imports, /revoke all on public\.imports from anon;/);
  assert.equal((imports.match(/revoke all on public\./g) || []).length, 1, 'un seul revoke de table');
  assert.doesNotMatch(imports, /revoke all on all tables/);
  assert.ok(imports.indexOf('create table public.imports (') < imports.indexOf('revoke all on public.imports from anon;'), 'revoke apres la table');
  assert.ok(imports.indexOf('revoke all on public.imports from anon;') < imports.indexOf('create or replace function public.sync_push('), 'revoke avant les fonctions');
});
test('0005 : quatre fonctions recreees avec les 27 magasins ; imports present dans CHACUNE, en dernier ; keys et required le connaissent', () => {
  assert.equal((imports.match(/create or replace function public\.(\w+)\(/g) || []).length, 4);
  assert.equal(imports.split(litteralDe(SYNC_STORES)).length - 1, 4, 'sync_push, sync_purge, sync_purge_all, purge_tombstones');
  assert.equal(imports.split(litteralDe(SYNC_STORES_0003)).length - 1, 0, 'plus aucune liste a 26');
  for (const f of QUATRE) {
    const c = corpsDe(imports, f);
    assert.ok(c.includes("'imports'"), f + ' connait imports');
    assert.ok(c.includes("'assistant_config', 'imports']"), f + ' : imports est le dernier, apres assistant_config (K-9)');
  }
  const push = corpsDe(imports, 'sync_push');
  assert.ok(push.includes('"assistant_config":"id","imports":"id"}'), 'keys : imports dernier, cle id');
  assert.ok(push.includes('"assistant_config":[],"imports":[]}'), 'required : imports dernier, vide');
  for (const f of ['sync_push(jsonb)', 'sync_purge(text, text)', 'sync_purge_all()']) {
    assert.match(imports, new RegExp(`revoke execute on function public\\.${f.replace(/[()]/g, '\\$&')} from public, anon;`), f);
    assert.match(imports, new RegExp(`grant execute on function public\\.${f.replace(/[()]/g, '\\$&')} to authenticated;`), f);
  }
  assert.match(imports, /revoke execute on function public\.purge_tombstones\(\) from public, anon, authenticated;/);
  assert.doesNotMatch(imports, /cron\.schedule/);
});
test('0005 : les quatre fonctions recreees sont celles de 0001, aux trois listes pres ; rien d autre n est touche', () => {
  const debutDe = (texte) => texte.indexOf('-- Envoi (spec § 3.4)');
  assert.notEqual(debutDe(imports), -1);
  const bloc0001 = sql.slice(debutDe(sql), sql.indexOf("select cron.schedule('cuisine-os-tombales'"));
  const enJson = (stores, champ) => JSON.stringify(Object.fromEntries(stores.map((s) => [s, TABLES[s][champ]]))).replace(/'/g, "''");
  const ramene = imports.slice(debutDe(imports))
    .split(litteralDe(SYNC_STORES)).join(litteralDe(SYNC_STORES_0001))
    .split(enJson(SYNC_STORES, 'key')).join(enJson(SYNC_STORES_0001, 'key'))
    .split(enJson(SYNC_STORES, 'required')).join(enJson(SYNC_STORES_0001, 'required'));
  assert.equal(ramene, bloc0001);
  for (const autre of ['touch_server_seq() returns', 'is_allowed() returns', 'before_user_created(', 'enforce_allowed_user() returns', 'storage.objects', 'storage.buckets', 'create schema', 'create sequence', 'create extension', 'private.allowed_users (', 'revoke all on all tables', 'assistant_journal', 'assistant_reserver']) {
    assert.ok(!imports.includes(autre), autre);
  }
});
test('0005 : en-tete (spec import-cible § 3.5, 27 magasins, apres 0001-0003), 0003 intacte, commitee = generee', () => {
  const tete = imports.slice(0, imports.indexOf('create table public.imports ('));
  assert.ok(tete.startsWith('-- 0005_imports.sql — généré par tools/generer-migrations.mjs ; ne pas éditer à la main.'), 'premiere ligne');
  assert.ok(tete.includes('docs/superpowers/specs/2026-10-18-import-cible-design.md'), 'la spec du lot A');
  assert.ok(tete.includes('À AJOUT SEUL : 1 table(s) neuve(s) et les quatre fonctions recréées avec la liste des 27 magasins.'), 'le compte des magasins');
  assert.ok(tete.includes('APRÈS 0001, 0002 et 0003'), 'ordre des collages');
  assert.doesNotMatch(tete, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  // 0003 ne bouge pas quand 0005 existe (empreinte deja epinglee plus haut : relue ici, a cote de 0005).
  assert.equal(sha(delta), '37f9f80d62cf82457b177f35979892ce7deeaf2067567a506228e145ad8efd39');
  assert.ok(!delta.includes("'imports'"), '0003 ne connait pas imports');
  assert.equal(imports, lire('supabase/migrations/0005_imports.sql'), '0005 commitee = generee');
});
test('0005 : --check rend 0 sur le depot, 1 (en nommant 0005 seule) sur une copie sans 0005', () => {
  const depot = spawnSync(process.execPath, [SCRIPT_MIG, '--check'], { cwd: RACINE_MIG, encoding: 'utf8' });
  assert.equal(depot.status, 0, 'depot : ' + depot.stderr);
  const tmp = mkdtempSync(path.join(tmpdir(), 'cuisine-os-migrations-sans-0005-'));
  try {
    for (const nom of NOMS.filter((n) => n !== '0005_imports.sql')) copyFileSync(path.join(MIGRATIONS, nom), path.join(tmp, nom));
    const rouge = spawnSync(process.execPath, [SCRIPT_MIG, '--check', '--dir', tmp], { cwd: RACINE_MIG, encoding: 'utf8' });
    assert.equal(rouge.status, 1, 'copie sans 0005 : code 1 attendu');
    assert.match(rouge.stderr, /0005_imports\.sql/);
    for (const autre of ['0001_tables_et_regles', '0002_stockage', '0003_assistant_config']) assert.doesNotMatch(rouge.stderr, new RegExp(autre), 'seule 0005 est nommee');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// La preuve 0005 est ecrite a la main (gabarit : la preuve 0003) et jouee par Neegan ; sa sortie va dans un depot PUBLIC. Memes filets que
// 0003, UN TEST PAR INVARIANT (ronde 1) : rollback et transaction ; jetons et adresses ; LISTE BLANCHE de ce que chaque instruction qui
// touche public.imports peut porter ; lectures sous RLS seulement ; reponses de sync_push jamais converties ; puis les verdicts, section
// par section. Ronde 1 (Important) : la liste NOIRE de formes (« select * », « to_jsonb( »…) laissait VERTS trois mutants qui affichaient la
// fiche entiere (`i::text`, `to_json(i)::text` sur un alias de table) ou la reponse de sync_push (`(reponse->'rejected')::text`) ; mesure
// sur une copie : 5 mutants sur 5 survivaient, 5 sur 5 rougissent avec les listes blanches ci-dessous.
const PREUVE_0005 = 'supabase/proofs/0005_imports.sql';
const preuve0005 = () => { const p = lire(PREUVE_0005); return { p, code: sansCommentaires(p) }; };
// Les instructions (hors commentaires) qui lisent ou touchent public.imports : les relectures 3.02, 3.03, 3.05, 3.07, le delete 4.01, 4.02.
const instructionsImports = (code) => code.split(';').map((x) => x.trim()).filter((x) => /\bfrom public\.imports\b/.test(x));

test('preuve 0005 : rollback final, une seule transaction, BILAN, « Run without RLS » rappele', () => {
  const { p, code } = preuve0005();
  const l = instructions(code);
  assert.equal(instructions(p).at(-1), 'rollback;', 'rollback est la derniere ligne non vide, commentaires compris');
  assert.equal(l[l.length - 1], 'rollback;');
  assert.equal(l[l.length - 2], 'select ordre, etape, attendu, obtenu, ok from pg_temp.preuve order by ordre;');
  assert.equal(l.filter((x) => x === 'begin;').length, 1, 'une seule transaction');
  assert.match(p, /select 999, 'BILAN'/);
  assert.ok(p.includes('« Run without RLS »'), 'le piege du tableau de bord est rappele');
});
test('preuve 0005 : jeton A seul, aucune adresse, aucune cle', () => {
  const { p } = preuve0005();
  const sansJetons = p.replace(/A_EMAIL|@>/g, '');
  assert.doesNotMatch(sansJetons, /@/, 'aucune adresse : seul le jeton A_EMAIL');
  for (const j of ["'A_UUID'", "'A_EMAIL'"]) assert.ok(p.includes(j), j);
  assert.doesNotMatch(p, /B_UUID|B_EMAIL/, 'un seul compte de preuve');
  assert.ok(!p.includes('sk-'), 'aucune cle, meme factice : imports n en porte pas');
});
// LISTE BLANCHE des lectures de public.imports. Une fois les litteraux vides et les quatre formes admises retirees — la fiche entiere
// COMPAREE par bool_and(data = '…'::jsonb), un compte affiche par count(*)::text, count(*) nu, « from public.imports where » —, il ne
// doit rester AUCUNE conversion (::), aucune etoile, aucun chemin json (-> / #>), aucun alias ni jointure derriere le nom de la table, et
// aucun identifiant hors des mots ci-dessous (les colonnes generees, owner_id et id en comparaison, auth.uid(), la plomberie de
// l'insertion dans pg_temp.preuve et du CTE `d` de 4.01). Un identifiant de plus (string_agg, to_json, format, un alias `i`) rougit avec
// son instruction : c'est ce qui aurait ete AFFICHE dans RESULTATS-mitsu.md. Une forme legitime de plus s'ajoute ICI, explicitement.
const FORMES_IMPORTS = ["bool_and(data = ''::jsonb)", 'count(*)::text', 'count(*)', 'from public.imports where'];
const MOTS_IMPORTS = new Set(['insert', 'into', 'pg_temp', 'preuve', 'select', 'case', 'when', 'then', 'else', 'end', 'coalesce', 'bool_and', 'and', 'or', 'not',
  'is', 'null', 'true', 'false', 'with', 'd', 'as', 'delete', 'returning', 'from', 'where', 'owner_id', 'auth', 'uid', 'id', 'edition_id', 'recipe_id', 'status']);
test('preuve 0005 : jamais la colonne data ni une ligne entiere — liste blanche de chaque instruction qui touche public.imports', () => {
  const { code } = preuve0005();
  const lectures = instructionsImports(code);
  assert.equal(lectures.length, 6, 'six instructions touchent public.imports : 3.02, 3.03, 3.05, 3.07, 4.01 (delete) et 4.02');
  assert.equal(code.split("bool_and(data = '").length - 1, 2, 'la fiche entiere est comparee deux fois (3.03 : obtenu et ok), jamais ailleurs');
  for (const instr of lectures) {
    const ou = instr.replace(/\s+/g, ' ').slice(0, 70);
    assert.doesNotMatch(instr, /from public\.imports\s+(?!where\b)\S/, 'ni alias ni jointure derriere public.imports : ' + ou);
    const sansLitteraux = instr.replace(/'(?:[^']|'')*'/g, "''");
    const reste = FORMES_IMPORTS.reduce((t, f) => t.split(f).join(' '), sansLitteraux);
    assert.doesNotMatch(reste, /::|\*|->|#>/, 'conversion, etoile ou chemin json hors des formes admises : ' + ou);
    const inconnus = (reste.match(/\b[a-z_][a-z0-9_]*\b/gi) || []).filter((m) => !MOTS_IMPORTS.has(m.toLowerCase()));
    assert.deepEqual(inconnus, [], 'identifiants hors liste blanche dans : ' + ou);
  }
  // Hors de ces six instructions, le mot « data » n'est que la cle du JSON pousse a sync_push.
  const horsLectures = lectures.reduce((t, i) => t.split(i).join(''), code);
  assert.deepEqual((horsLectures.match(/.{0,40}\bdata\b.{0,40}/gi) || []).filter((x) => !x.includes('"data":{')), [], 'data hors des lectures et hors du JSON pousse');
});
test('preuve 0005 : toute lecture de public.imports se fait sous authenticated (RLS) — six, pas une de moins ; set/reset role en nombre egal', () => {
  const { code } = preuve0005();
  let role = 'postgres';
  let sousRls = 0;
  for (const instr of code.split(';').map((x) => x.trim())) {
    if (instr === 'set local role authenticated') role = 'authenticated';
    else if (instr === 'reset role') role = 'postgres';
    else if (/\bfrom public\.imports\b/.test(instr)) { assert.equal(role, 'authenticated', 'lecture hors RLS : ' + instr.slice(0, 120)); sousRls += 1; }
  }
  assert.equal(sousRls, 6, 'les relectures 3.02, 3.03, 3.05, 3.07, le delete 4.01 et 4.02 sont joues sous RLS : ' + sousRls);
  const sets = (code.match(/set local role authenticated;/g) || []).length;
  assert.ok(sets >= 1 && sets === (code.match(/reset role;/g) || []).length, 'set local role / reset role en nombre egal');
});
// LISTE BLANCHE des reponses de sync_push : « reponse » n'existe que nommee en sortie d'un envoi, COMPTEE par jsonb_array_length sur
// accepted / adjusted / rejected, ou COMPAREE par @> a la cle de la fiche. Jamais convertie (::text, ->>, #>>), jamais parcourue
// (->0->'server' porterait la ligne du serveur dans un conflit). Le mot hors de ces formes rougit.
const COMPTES_REPONSE = ["jsonb_array_length(reponse->'accepted')", "jsonb_array_length(reponse->'adjusted')", "jsonb_array_length(reponse->'rejected')",
  `reponse->'accepted' @> '[{"store":"imports","id":"imp_preuve"}]'::jsonb`];
const FORMES_REPONSE = [...COMPTES_REPONSE, ') as reponse) t;'];
test('preuve 0005 : trois envois sync_push nommes reponse, comptes ou compares, jamais convertis ni parcourus', () => {
  const { p, code } = preuve0005();
  const appels = (p.match(/public\.sync_push\('\[/g) || []).length;
  assert.equal(appels, 3, 'trois envois : 3.01, 3.04, 3.06');
  assert.equal((p.match(/\) as reponse\) t;/g) || []).length, appels, 'chaque envoi est nomme reponse');
  const reste = FORMES_REPONSE.reduce((t, f) => t.split(f).join(' '), code);
  assert.deepEqual(reste.match(/.{0,30}\breponse\b.{0,30}/g) || [], [], 'reponse hors des formes admises');
});
// Ronde 2 (Important) : la liste ci-dessus ne garde que le MOT reponse ; l'alias `t` de la sous-requete « from (select public.sync_push(…)
// as reponse) t » restait une porte — ` || t::text`, ` || row_to_json(t)::text`, ` || to_jsonb(t)::text`, ` || to_json(t)::text` dans l'obtenu
// de 3.01 collent la reponse ENTIERE dans RESULTATS-mitsu.md (en cas de conflit, rejected[0].server porte la ligne du serveur, data
// comprise). Mesure sur une copie : 4 mutants sur 4 survivaient (73/73). Meme discipline que pour public.imports : exactement trois
// instructions envoient ; dans chacune, une fois les comptes et la comparaison retires, les litteraux vides et la sous-requete nommee
// retiree AVEC son alias, il ne reste ni conversion, ni etoile, ni chemin json, ni identifiant hors de la plomberie de l'insertion dans
// pg_temp.preuve (`t`, `row_to_json`, `to_json`, `to_jsonb`, `json_agg`, `format`, `string_agg` rougissent avec leur instruction).
const ENVOI = "from (select public.sync_push(''::jsonb) as reponse) t";
const MOTS_ENVOI = new Set(['insert', 'into', 'pg_temp', 'preuve', 'select', 'and', 'or', 'not', 'true', 'false', 'null', 'coalesce', 'case', 'when', 'then', 'else', 'end']);
const viderLitteraux = (instr) => instr.replace(/'(?:[^']|'')*'/g, "''");
const instructionsEnvoi = (code) => code.split(';').map((x) => x.trim()).filter((x) => viderLitteraux(x).includes("public.sync_push(''::jsonb)"));
test('preuve 0005 : chaque envoi sync_push ne porte que ses comptes et sa comparaison — ni l alias t de la sous-requete, ni conversion, ni identifiant de plus', () => {
  const { code } = preuve0005();
  const envois = instructionsEnvoi(code);
  assert.equal(envois.length, 3, 'trois instructions envoient : 3.01, 3.04, 3.06');
  for (const instr of envois) {
    const ou = instr.replace(/\s+/g, ' ').slice(0, 70);
    const vide = viderLitteraux(COMPTES_REPONSE.reduce((t, f) => t.split(f).join(' '), instr));
    assert.ok(vide.includes(ENVOI), 'la sous-requete nommee reponse, alias t compris, est exactement celle attendue : ' + ou);
    const reste = vide.split(ENVOI).join(' ');
    assert.doesNotMatch(reste, /::|\*|->|#>/, 'conversion, etoile ou chemin json hors des formes admises : ' + ou);
    const inconnus = (reste.match(/\b[a-z_][a-z0-9_]*\b/gi) || []).filter((m) => !MOTS_ENVOI.has(m.toLowerCase()));
    assert.deepEqual(inconnus, [], 'identifiants hors liste blanche dans : ' + ou);
  }
});
test('preuve 0005 § 0 : gardes de lecture (table, sync_push connait imports, adresse listee, sans compte) et les 35 verdicts numerotes', () => {
  const { code } = preuve0005();
  assert.ok(code.includes("to_regclass('public.imports') is null"), 'garde : table');
  assert.ok(code.includes("position('''imports''' in pg_get_functiondef('public.sync_push(jsonb)'::regprocedure)) = 0"), 'garde : sync_push connait imports');
  assert.ok(code.includes("from private.allowed_users where email = 'A_EMAIL'"), 'garde : adresse listee');
  assert.ok(code.includes("from auth.users where email = 'A_EMAIL'"), 'garde : pas de compte');
  for (const n of ['0.01', '0.02', '1.01', '1.02', '1.03', '1.04', '1.05', '1.06', '1.07', '1.08', '2.01', '2.02', '2.03', '2.04', '2.05', '2.06', '2.07', '2.08', '2.09', '2.10', '2.11',
    '3.01', '3.02', '3.03', '3.04', '3.05', '3.06', '3.07', '4.01', '4.02', '5.01', '5.02', '5.03', '5.04', '5.05']) assert.ok(code.includes(`${n},`), 'verdict ' + n);
});
test('preuve 0005 § 1 : RLS, quatre regles (delete sous app.purge), declencheur, index recv, cle primaire, cascade, colonnes generees stockees et leurs index', () => {
  const { code } = preuve0005();
  assert.ok(code.includes("relrowsecurity from pg_class where oid = to_regclass('public.imports')"), '1.01 RLS');
  assert.ok(code.includes("tablename = 'imports'") && code.includes("qual like '%app.purge%'"), '1.02 regles');
  assert.ok(code.includes("tgname = 'imports_seq'") && code.includes("tgfoid = 'public.touch_server_seq()'::regprocedure"), '1.03 declencheur');
  assert.ok(code.includes("indexname = 'imports_recv'") && code.includes("indexdef like '%(owner_id, server_seq)'"), '1.04 index recv');
  assert.ok(code.includes("indexname = 'imports_pkey'") && code.includes("indexdef like 'CREATE UNIQUE INDEX%(owner_id, id)'"), '1.05 cle primaire');
  assert.ok(code.includes("confrelid = 'auth.users'::regclass and confdeltype = 'c'"), '1.06 cascade');
  assert.ok(code.includes("attname in ('edition_id', 'recipe_id', 'status')") && code.includes("attgenerated = 's'") && code.includes("atttypid = 'text'::regtype") && code.includes('not attisdropped'), '1.07 colonnes generees stockees, text');
  assert.ok(code.includes("indexname in ('imports_edition_id', 'imports_recipe_id', 'imports_status')"), '1.08 index des colonnes generees');
});
test('preuve 0005 § 2 : authenticated sur imports ; anon sur aucune table de public, les 27 synchronisees nommees ; execute des quatre ; RLS des 27', () => {
  const { code } = preuve0005();
  for (const priv of ['select', 'insert', 'update']) assert.ok(code.includes(`has_table_privilege('authenticated', 'public.imports', '${priv}')`), '2.01 ' + priv);
  const d202 = code.indexOf('select 2.02,');
  assert.notEqual(d202, -1, 'verdict 2.02');
  const v202 = code.slice(d202, code.indexOf('insert into pg_temp.preuve', d202));
  assert.ok(v202.includes(litteralDe(SYNC_STORES)), '2.02 : la liste des 27 magasins, dans l ordre de SYNC_STORES');
  assert.ok(v202.includes('from pg_tables') && v202.includes("schemaname = 'public'"), '2.02 : toutes les tables de public');
  for (const priv of ['select', 'insert', 'update', 'delete']) assert.ok(v202.includes(`not has_table_privilege('anon', 'public.' || tablename, '${priv}')`), '2.02 ' + priv);
  assert.ok(v202.includes('= 27'), '2.02 : 27 synchronisees presentes');
  for (const f of ['sync_push(jsonb)', 'sync_purge(text, text)', 'sync_purge_all()', 'purge_tombstones()']) {
    assert.ok(code.includes(`has_function_privilege('anon', 'public.${f}', 'execute'), false`), 'anon sans execute : ' + f);
    assert.ok(code.includes(`has_function_privilege('authenticated', 'public.${f}', 'execute'), ${f === 'purge_tombstones()' ? 'false' : 'true'}`), 'authenticated : ' + f);
  }
  const d211 = code.indexOf('select 2.11,');
  assert.notEqual(d211, -1, 'verdict 2.11');
  const v211 = code.slice(d211, code.indexOf('insert into pg_temp.preuve', d211));
  assert.ok(v211.includes('relrowsecurity') && v211.includes(litteralDe(SYNC_STORES)) && v211.includes('= 27'), '2.11 : RLS sur les 27');
});
test('preuve 0005 § 3 : session de A, envoi imports accepte et nomme, relu par ses colonnes generees, transition suivie, import d index sans recipe_id', () => {
  const { code } = preuve0005();
  assert.ok(code.includes('set local request.jwt.claims = \'{"sub":"A_UUID","email":"A_EMAIL","role":"authenticated"}\''), 'session de A');
  assert.ok(code.includes('"store":"imports","id":"imp_preuve","data":{"id":"imp_preuve"'), '3.01 : la fiche poussee porte sa cle');
  assert.ok(code.includes(`reponse->'accepted' @> '[{"store":"imports","id":"imp_preuve"}]'::jsonb`), '3.01 : accepted nomme la ligne');
  assert.ok(code.includes("edition_id = 'ed_preuve' and recipe_id = 'rc_preuve' and status = 'a_lancer'"), '3.02 : colonnes generees relues (comparees, pas affichees)');
  assert.ok(code.includes("status = 'a_verifier'"), '3.05 : la colonne generee suit la fiche');
  assert.ok(code.includes('"id":"imp_index"') && code.includes('"recipe_id":null'), '3.06 : import d index sans recipe_id');
  assert.ok(code.includes('recipe_id is null'), '3.07 : colonne generee nulle');
});
test('preuve 0005 § 4 : delete direct sans app.purge, drapeau remis a vide, rien de supprime', () => {
  const { code } = preuve0005();
  assert.ok(code.includes("set_config('app.purge', '', true)"), 'drapeau remis a vide');
  assert.match(code, /with d as \(delete from public\.imports where id = 'imp_preuve' returning 1\)/);
  assert.ok(code.includes("'A garde ses deux lignes apres le delete', '2'"), '4.02 : les deux lignes restent');
});
test('preuve 0005 § 5 : les quatre fonctions relues a 27, liste finissant par assistant_config, imports ; keys et required', () => {
  const { code } = preuve0005();
  for (const f of ['public.sync_push(jsonb)', 'public.sync_purge(text, text)', 'public.sync_purge_all()', 'public.purge_tombstones()']) assert.ok(code.includes(`'${f}')`), 'definition relue : ' + f);
  assert.ok(code.includes('pg_get_functiondef(to_regprocedure(f))'), 'les quatre corps sont relus');
  assert.ok(code.includes("position('''assistant_config'', ''imports'']' in y.d) > 0"), 'imports dernier (K-9)');
  assert.ok(code.includes('nb = 27'), '27 magasins');
  assert.ok(code.includes(`position('"imports":"id"' in d) > 0 and position('"imports":[]' in d) > 0`), '5.05 keys et required');
});
test('README : etape 11 (0005, notify seule, preuve, RESULTATS) entre 10 et « Où coller les sorties » ; un ancien client refuse une archive plus recente', () => {
  const r = lire('supabase/README.md');
  const titre = '### 11. Coller `0005_imports.sql`, puis jouer sa preuve';
  const debut = r.indexOf(titre);
  assert.notEqual(debut, -1, 'etape 11');
  assert.ok(r.indexOf("### 10. La passerelle de l'assistant") < debut && debut < r.indexOf('## Où coller les sorties'), '11 apres 10, avant « Où coller les sorties »');
  const etape = rubrique(r, titre);
  for (const m of ['migrations/0005_imports.sql', 'proofs/0005_imports.sql', "notify pgrst, 'reload schema';", 'Run without RLS', 'exemple.invalid', 'A_UUID', 'A_EMAIL',
    'RESULTATS-mitsu.md', 'SYNC_STORES_0003', 'SYNC_STORES_0005', 'shasum -a 256 supabase/migrations/0005_imports.sql', 'edition_id', 'recipe_id', 'status', '27',
    'sync_push', 'sync_purge', 'sync_purge_all', 'purge_tombstones', 'Description de magasin absente ou inconnue', 'Décompte de magasin inconnu : imports',
    "mets l'app à jour", 'Ensuite seulement : fusion et `push`.', 'quarantaine']) assert.ok(etape.includes(m), m);
  // Ordre des gestes : adresse de preuve, 0005, notify (collee seule), preuve, retrait de l'adresse, RESULTATS.
  const i = ['insert into private.allowed_users', 'migrations/0005_imports.sql', "notify pgrst, 'reload schema';", 'proofs/0005_imports.sql', 'delete from private.allowed_users', 'RESULTATS-mitsu.md'].map((m) => etape.indexOf(m));
  assert.ok(i.every((x) => x !== -1), 'six gestes presents : ' + i.join(','));
  assert.deepEqual([...i].sort((a, b) => a - b), i, 'dans l ordre : ' + i.join(','));
  assert.equal(etape.split("notify pgrst, 'reload schema';").length - 1, 1, 'notify donnee une fois');
  assert.match(etape.slice(etape.indexOf('notify pgrst') - 200, etape.indexOf('notify pgrst')), /seule/, 'collee seule');
  assert.doesNotMatch(etape, /B_UUID|B_EMAIL/, 'un seul compte de preuve');
  assert.doesNotMatch(etape, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  // L'arbre du README conserve les deux fichiers du lot A ; L1 porte le total à cinq migrations générées.
  const arbre = r.slice(0, r.indexOf('## Un seul projet'));
  for (const f of ['migrations/0005_imports.sql', 'proofs/0005_imports.sql']) assert.ok(arbre.includes(f), 'arbre : ' + f);
  assert.ok(arbre.includes('cinq migrations générées'), 'intro : cinq generees avec la corbeille L1');
});
test('RESULTATS-mitsu : section « Preuve 0005_imports.sql — à jouer » preparee, sans cle ni adresse', () => {
  const res = lire('supabase/proofs/RESULTATS-mitsu.md');
  const debut = res.indexOf('## Preuve `0005_imports.sql` — ');
  assert.notEqual(debut, -1, 'section 0005');
  const section = res.slice(debut);
  for (const m of ['étape 11', 'migrations/0005_imports.sql', 'shasum -a 256 supabase/migrations/0005_imports.sql', "notify pgrst, 'reload schema';", 'Run without RLS', '999 BILAN', 'A_EMAIL', 'A_UUID', '| ordre | etape | attendu | obtenu | ok |']) assert.ok(section.includes(m), m);
  assert.doesNotMatch(res, /sk-(?!…)[A-Za-z0-9_-]{4,}/, 'aucune cle dans RESULTATS');
  assert.doesNotMatch(section, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'aucune adresse');
});

// --- Lot B « Recette web complète » (spec 2026-10-19-recette-web § 3.7, § 6.4, D-B11, D-B23) : 0006 écrite à la main, sa preuve, le README,
// RESULTATS et le commentaire du générateur. 0006 est hors de NOMS et de --check, comme 0004.
// R-B-6 (= R-F-1 du lot F) : la contrainte de 0006 porte CINQ valeurs, figées en littéral comme OUTILS_0004 ; la cinquième, image-web, sert le lot F
// (qui n'écrira aucune migration). Depuis le lot F, OUTILS (logique.js) porte les cinq : OUTILS = OUTILS_0006 (R-F-9). Depuis UI-2, OUTILS = OUTILS_0007
// et 0006 est un préfixe historique.
const OUTILS_0006 = ['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'];
const OUTILS_0007 = [...OUTILS_0006, 'apercu-web'];
test('0006 : hors NOMS, une transaction, 4 instructions — drop puis add de la contrainte, avec les cinq valeurs d OUTILS_0006 dans l ordre ; rien d autre', () => {
  assert.ok(!NOMS.some((n) => n.startsWith('0006')), '0006 n est pas generee');
  const m = lire('supabase/migrations/0006_lecture_web.sql');
  const code = sansCommentaires(m);
  const l = instructions(code);
  assert.deepEqual(l, ['begin;', 'alter table public.assistant_journal drop constraint assistant_journal_outil_check;',
    `alter table public.assistant_journal add constraint assistant_journal_outil_check check (outil in (${OUTILS_0006.map((o) => `'${o}'`).join(', ')}));`, 'commit;'],
    'quatre instructions ; la liste SQL est le litteral OUTILS_0006 (cinq valeurs, image-web pour le lot F)');
  assert.deepEqual(OUTILS_PASSERELLE.slice(0, OUTILS_0006.length), OUTILS_0006, 'lot UI-2 : 0006 redevient un PREFIXE d OUTILS (la 0007 ajoute apercu-web ; l egalite vit au test « lot F puis UI-2 »)');
  assert.doesNotMatch(code, /\b(create|grant|revoke|insert|update|delete|truncate)\b/, 'ni table, ni fonction, ni privilege, ni donnee');
  assert.equal(code, code.toLowerCase(), 'SQL en minuscules');
  assert.ok(m.includes('de colonne') && m.includes('23514') && m.includes('502'), 'l en-tete dit pourquoi (check de colonne de 0004, 23514, 502)');
  assert.doesNotMatch(m, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'aucune adresse'); assert.ok(!m.includes('sk-'), 'aucune cle');
});
test('preuve 0006 : rollback final, une transaction, BILAN, gardes, verdicts nommes, aucune adresse ni jeton', () => {
  const p = lire('supabase/proofs/0006_lecture_web.sql');
  const code = sansCommentaires(p);
  const l = instructions(code);
  assert.equal(l[l.length - 1], 'rollback;', 'rollback dernier');
  assert.equal(l.filter((x) => x === 'begin;').length, 1, 'une seule transaction');
  assert.match(code, /select 999,\s*'BILAN'/);
  for (const n of ['1.01', '1.02', '1.03', '1.04', '1.05', '2.01', '2.02', '2.03', '2.031', '3.01']) assert.ok(code.includes(`${n},`), 'verdict ' + n);
  for (const m of ['pg_get_constraintdef', "'23514'", 'public.assistant_reserver(uid, \'lecture-web\', 1, c::integer + 1)', "'lecture-web'", "'aucun compte : etape sautee'", 'security_invoker=true',
    'les cinq outils, dans l ordre d OUTILS_0006', "public.assistant_reserver(uid, 'image-web', 1, c::integer + 1)", "'image-web'", "2.03 bis : assistant_reserver(uid, ''image-web'', 1, c + 1) -> id non nul",
    "conname = 'assistant_journal_outil_check'", "string_agg(conname, ', ')", "contype = 'c'"]) assert.ok(code.includes(m), m);
  for (const outil of OUTILS_0006) assert.ok(code.includes(`'''${outil}'''`), '1.01 cherche ' + outil);
  // Ronde 1 (spec § 6.4) : c RECOMPTÉ entre 2.03 et l'appel image-web (sinon le quota c + 1 est atteint par la ligne de 2.03 : faux rouge) ; chaque
  // appel d'assistant_reserver dans un bloc exception, comme 2.01 et 2.02 (une 0006 collée sans image-web : 2.031 rend 23514 en verdict lisible au
  // BILAN, au lieu d'annuler le collage entier) ; les verdicts 2.03 et 2.031 portent sur l'id rendu.
  const plat = code.replace(/\s+/g, ' ');
  const entre = plat.slice(plat.lastIndexOf("(2.03, 'assistant_reserver accepte"), plat.indexOf("r := public.assistant_reserver(uid, 'image-web'"));
  assert.ok(entre.includes("select count(*) into c from public.assistant_journal where owner_id = uid and jour = (now() at time zone 'utc')::date;"), 'c RECOMPTE entre 2.03 et 2.031');
  for (const outil of ['lecture-web', 'image-web']) {
    assert.ok(plat.includes(`begin r := public.assistant_reserver(uid, '${outil}', 1, c::integer + 1); v := case when r is null then 'null' else 'id non nul' end; exception when others then v := sqlstate; end;`), outil + ' : appel dans un bloc exception');
  }
  assert.ok(plat.includes("(2.03, 'assistant_reserver accepte lecture-web : un id non nul', 'id non nul', v, v = 'id non nul');"), 'verdict 2.03 sur l id');
  assert.ok(plat.includes("(2.031, '2.03 bis : assistant_reserver(uid, ''image-web'', 1, c + 1) -> id non nul (la valeur du lot F)', 'id non nul', v, v = 'id non nul');"), 'verdict 2.031 sur l id');
  assert.ok(!p.includes('@'), 'aucun arobase'); assert.doesNotMatch(p, /A_UUID|B_UUID|A_EMAIL|B_EMAIL/, 'aucun jeton a remplacer');
  assert.doesNotMatch(code, /\bemail\b/i, 'aucune adresse lue'); assert.ok(!p.includes('sk-'), 'aucune cle');
  assert.ok(code.includes('from auth.users order by created_at limit 1'), 'compte emprunte, jamais affiche');
});
test('README : etape 12 (0006, preuve, ordre 0006 → redeploiement → sondes → fusion → push, la phrase du 502) entre 11 et « Où coller les sorties »', () => {
  const r = lire('supabase/README.md');
  const titre = '### 12. Coller `0006_lecture_web.sql`, puis jouer sa preuve';
  const debut = r.indexOf(titre);
  assert.notEqual(debut, -1, 'etape 12');
  assert.ok(r.indexOf('### 11. Coller `0005_imports.sql`') < debut && debut < r.indexOf('## Où coller les sorties'), '12 apres 11, avant « Où coller les sorties »');
  const etape = rubrique(r, titre).replace(/\s+/g, ' '); // les retours à la ligne du Markdown ne comptent pas
  for (const m of ['migrations/0006_lecture_web.sql', 'proofs/0006_lecture_web.sql', 'Run without RLS', '999 BILAN', 'RESULTATS-mitsu.md',
    'un code servi avant `0006` : chaque lecture web répond 502 `serveur` (la réservation refuse l\'outil), rien d\'autre ne change.',
    'supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api', 'S13', 'S17', 'Facultatif',
    'la contrainte admet aussi `image-web` (lot F, à venir)', '2.03 bis', 'JSON-LD `Recipe` complet', 'ronde sur `telechargerPage`']) assert.ok(etape.includes(m), m);
  // Ronde 1 (spec § 10, 2 et 2 bis) : les neuf sondes S1-S9 nommées là où elles vivent ; la session lue par `read -rs JETON` ; S17 vérifiée par
  // `curl -sI` avec LE User-Agent de la fonction (relu dans index.ts : un site qui redirige selon l'agent montrerait autre chose à curl).
  const ua = (sansCommentaires(lire(`${FONCTION}/index.ts`)).match(/'user-agent': '([^']+)'/) || [])[1];
  assert.ok(ua && ua.startsWith('Mitsu/'), 'User-Agent relu dans index.ts');
  for (const m of ['S1-S9 du lot 4', 'section « Passerelle `assistant` »', 'read -rs JETON', `curl -sI -A '${ua}'`]) assert.ok(etape.includes(m), m);
  const i = ['migrations/0006_lecture_web.sql', 'proofs/0006_lecture_web.sql', 'supabase functions deploy assistant', 'S13', 'S17', 'fusion', '`push`'].map((m) => etape.lastIndexOf(m) === -1 ? -1 : etape.indexOf(m));
  assert.ok(i.every((x) => x !== -1), 'gestes presents : ' + i.join(','));
  assert.deepEqual([...i].sort((a, b) => a - b), i, 'dans l ordre : ' + i.join(','));
  const arbre = r.slice(0, r.indexOf('## Un seul projet'));
  for (const f of ['migrations/0006_lecture_web.sql', 'proofs/0006_lecture_web.sql', 'lecture-web.js']) assert.ok(arbre.includes(f), 'arbre : ' + f);
  assert.ok(arbre.replace(/\s+/g, ' ').includes('trois écrites à la main (`0004`, `0006`, `0007`)'), 'intro : trois ecrites a la main');
  assert.doesNotMatch(etape, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
});
test('RESULTATS-mitsu : sections « Preuve 0006_lecture_web.sql — à jouer » et « Sondes lecture-web » preparees, sans cle ni adresse', () => {
  const res = lire('supabase/proofs/RESULTATS-mitsu.md');
  const debut = res.indexOf('## Preuve `0006_lecture_web.sql` — ');
  assert.notEqual(debut, -1, 'section 0006');
  assert.ok(debut > res.indexOf('## Preuve `0005_imports.sql` — '), 'apres la section 0005');
  const section = res.slice(debut);
  for (const m of ['étape 12', 'migrations/0006_lecture_web.sql', 'Run without RLS', '999 BILAN', '| ordre | etape | attendu | obtenu | ok |', '## Sondes `lecture-web`', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18',
    '2.03 bis', '`image-web`', 'JSON-LD `Recipe` complet', 'sans dépense Anthropic']) assert.ok(section.includes(m), m);
  // Ronde 1 : la session des sondes et le User-Agent de S17, comme au README ; et aucune ligne vide en fin de fichier (`git diff --check`).
  const ua = (sansCommentaires(lire(`${FONCTION}/index.ts`)).match(/'user-agent': '([^']+)'/) || [])[1];
  for (const m of ['read -rs JETON', `curl -sI -A '${ua}'`]) assert.ok(section.includes(m), m);
  assert.ok(res.endsWith('\n') && !res.endsWith('\n\n'), 'une seule fin de ligne en fin de fichier');
  assert.doesNotMatch(section, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'aucune adresse');
  assert.doesNotMatch(res, /sk-(?!…)[A-Za-z0-9_-]{4,}/, 'aucune cle');
});
test('generateur (D-B11, B-M-10) : le commentaire dit « la 0008 à venir » (l. 202) et « dans une 0008 » (l. 322) ; plus aucune 0006 ni 0007 a generer', () => {
  const g = lire('tools/generer-migrations.mjs');
  assert.equal(g.split('la 0008 à venir').length - 1, 1, 'la prochaine migration generee est 0008');
  assert.ok(g.includes('dans une 0008 ('), 'le magasin suivant va dans une 0008');
  assert.doesNotMatch(g, /la 000[67] à venir|dans une 000[67] \(/, 'ni 0006 ni 0007 promises par le generateur : toutes deux ecrites a la main (lots B et UI-2)');
});

// --- Lot F « Les plats en images » (spec § 6.3, § 7.2-7.3), puis UI-2 : OUTILS = OUTILS_0007, 0006 en est le prefixe
test('lot F puis UI-2 : OUTILS porte les six outils de 0007, apercu-web dernier ; 0006 en est le prefixe', () => {
  assert.equal(OUTILS_PASSERELLE.length, 6);
  assert.deepEqual(OUTILS_PASSERELLE, OUTILS_0007);
  assert.deepEqual(OUTILS_PASSERELLE.slice(0, 5), OUTILS_0006);
});
test('index.ts (lot F) : image-web dans l ordre du flux, une seule boucle de redirections, corpsModele par OUTILS_MODELE ; mutant « telechargerImage avant la reservation » rouge', () => {
  const code = sansCommentaires(lire(`${FONCTION}/index.ts`));
  assert.deepEqual(ordreDuFlux(code), { presents: true, croissants: true });
  assert.equal((code.match(/redirect: 'manual'/g) || []).length, 1, 'une seule boucle (suivreRedirections)');
  assert.equal((code.match(/await fetch\(/g) || []).length, 2, 'deux appels sortants : la page ou l image dans suivreRedirections, le fournisseur dans appelerAnthropic');
  assert.ok(code.includes('OUTILS_MODELE.includes(outil)'), 'corpsModele initialise par la liste fermee');
  for (const nom of ['async function suivreRedirections<T>(', 'async function telechargerPage(', 'async function telechargerImage(']) assert.notEqual(code.indexOf(nom), -1, nom);
  // Mutant (ronde 1) : la ligne qui télécharge l'IMAGE remontée AU-DESSUS de la réservation → l'ordre casse. Il ne rougit QUE si
  // 'await telechargerImage(' est dans ORDRE_DU_FLUX (l'ancien mutant, la réservation déplacée sous l'image, passait aussi sous
  // telechargerPage : il rougissait sans cette entrée). « Un second await fetch( dans telechargerImage » se rejoue sur une COPIE d'index.ts
  // (Step 10) : le compte ci-dessus le tue.
  const appelImage = code.indexOf('await telechargerImage(');
  assert.notEqual(appelImage, -1, 'l appel de telechargerImage est trouve');
  const debutImage = code.lastIndexOf('\n', appelImage) + 1;
  const ligneImage = code.slice(debutImage, code.indexOf('\n', appelImage) + 1);
  const sansImage = code.replace(ligneImage, '');
  const debutRes = sansImage.indexOf('  const { data: idReserve');
  assert.notEqual(debutRes, -1, 'la ligne de reservation est trouvee');
  const mutant1 = sansImage.slice(0, debutRes) + ligneImage + sansImage.slice(debutRes);
  assert.ok(mutant1.indexOf('await telechargerImage(') < mutant1.indexOf(".rpc('assistant_reserver'"), 'le mutant porte bien le telechargement de l image au-dessus de la reservation');
  assert.deepEqual(ordreDuFlux(mutant1), { presents: true, croissants: false }, 'mutant « telechargerImage avant la reservation » : rouge');
});

// --- Lot UI-2 « Aperçus des résultats web » (spec 2026-10-23-experience-carnet § 6, D-UI-14, S-13, B-M-10) : 0007 écrite à la main, sa preuve, le README
// (étape 13), RESULTATS, le générateur (« la 0008 à venir ») et le flux d'index.ts. 0007 est hors de NOMS et de --check, comme 0004 et 0006.
test('0007 : hors NOMS, une transaction, 4 instructions — drop puis add de la contrainte, avec les six valeurs d OUTILS_0007 dans l ordre ; rien d autre ; 0006 intacte', () => {
  assert.ok(!NOMS.some((n) => n.startsWith('0007')), '0007 n est pas generee');
  const m = lire('supabase/migrations/0007_apercu_web.sql');
  const code = sansCommentaires(m);
  assert.deepEqual(instructions(code), ['begin;', 'alter table public.assistant_journal drop constraint assistant_journal_outil_check;',
    `alter table public.assistant_journal add constraint assistant_journal_outil_check check (outil in (${OUTILS_0007.map((o) => `'${o}'`).join(', ')}));`, 'commit;'],
    'quatre instructions ; la liste SQL est le litteral OUTILS_0007 (six valeurs, apercu-web derniere)');
  assert.deepEqual(OUTILS_PASSERELLE, OUTILS_0007, 'OUTILS = OUTILS_0007');
  assert.doesNotMatch(code, /\b(create|grant|revoke|insert|update|delete|truncate)\b/, 'ni table, ni fonction, ni privilege, ni donnee');
  assert.equal(code, code.toLowerCase(), 'SQL en minuscules');
  assert.ok(m.includes('de colonne') && m.includes('23514') && m.includes('502') && m.includes('sans image'), 'l en-tete dit pourquoi (check de colonne de 0006, 23514, 502, l app montre les resultats sans image : D-UI-14)');
  assert.ok(m.includes('transactionnel'), 'DDL transactionnel : aucune fenetre sans contrainte');
  assert.doesNotMatch(m, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'aucune adresse'); assert.ok(!m.includes('sk-'), 'aucune cle');
  assert.equal(instructions(sansCommentaires(lire('supabase/migrations/0006_lecture_web.sql')))[2], `alter table public.assistant_journal add constraint assistant_journal_outil_check check (outil in (${OUTILS_0006.map((o) => `'${o}'`).join(', ')}));`, '0006 n a pas bouge (historique, collee le 23 octobre)');
});
test('preuve 0007 : rollback final, une transaction, BILAN, gardes, 1.01 a six valeurs, 2.03 ter apercu-web dans un bloc exception, c recompte trois fois, les cinq anciens, aucune adresse ni jeton', () => {
  const p = lire('supabase/proofs/0007_apercu_web.sql');
  const code = sansCommentaires(p);
  const l = instructions(code);
  assert.equal(l[l.length - 1], 'rollback;', 'rollback dernier');
  assert.equal(l.filter((x) => x === 'begin;').length, 1, 'une seule transaction');
  assert.match(code, /select 999,\s*'BILAN'/);
  for (const n of ['1.01', '1.02', '1.03', '1.04', '1.05', '2.01', '2.02', '2.03', '2.031', '2.032', '3.01']) assert.ok(code.includes(`${n},`), 'verdict ' + n);
  for (const m of ['pg_get_constraintdef', "'23514'", 'les six outils, dans l ordre d OUTILS_0007', 'and f > e', "public.assistant_reserver(uid, 'lecture-web', 1, c::integer + 1)",
    "public.assistant_reserver(uid, 'image-web', 1, c::integer + 1)", "public.assistant_reserver(uid, 'apercu-web', 1, c::integer + 1)", "2.03 ter : assistant_reserver(uid, ''apercu-web'', 1, c + 1) -> id non nul",
    "'les cinq anciens outils passent encore'", "'aucun compte : etape sautee'", 'security_invoker=true', "conname = 'assistant_journal_outil_check'", "string_agg(conname, ', ')", "contype = 'c'"]) assert.ok(code.includes(m), m);
  for (const outil of OUTILS_0007) assert.ok(code.includes(`'''${outil}'''`), '1.01 cherche ' + outil);
  const plat = code.replace(/\s+/g, ' ');
  for (const outil of ['lecture-web', 'image-web', 'apercu-web']) assert.ok(plat.includes(`begin r := public.assistant_reserver(uid, '${outil}', 1, c::integer + 1); v := case when r is null then 'null' else 'id non nul' end; exception when others then v := sqlstate; end;`), outil + ' : appel dans un bloc exception');
  assert.equal(plat.split("select count(*) into c from public.assistant_journal where owner_id = uid and jour = (now() at time zone 'utc')::date;").length - 1, 3, 'c RECOMPTE avant 2.03, 2.031 et 2.032 (chaque reservation ecrit une ligne du jour)');
  assert.ok(plat.includes("(2.032, '2.03 ter : assistant_reserver(uid, ''apercu-web'', 1, c + 1) -> id non nul (la valeur du lot UI-2)', 'id non nul', v, v = 'id non nul');"), 'verdict 2.032 sur l id');
  assert.ok(plat.includes("values (uid, 'recherche-web', 200, date '2000-01-01'), (uid, 'creation', 200, date '2000-01-01'), (uid, 'extraction', 200, date '2000-01-01'), (uid, 'lecture-web', 200, date '2000-01-01'), (uid, 'image-web', 200, date '2000-01-01')"), '3.01 : les cinq anciens outils');
  assert.ok(!p.includes('@'), 'aucun arobase'); assert.doesNotMatch(p, /A_UUID|B_UUID|A_EMAIL|B_EMAIL/, 'aucun jeton a remplacer');
  assert.doesNotMatch(code, /\bemail\b/i, 'aucune adresse lue'); assert.ok(!p.includes('sk-'), 'aucune cle');
  assert.ok(code.includes('from auth.users order by created_at limit 1'), 'compte emprunte, jamais affiche');
  // Revue finale du lot UI-2 : sans compte, les six verdicts sautes ont `ok` NUL (jamais vrai) et le BILAN compte `ok is not true` : jamais vert sans compte.
  assert.equal(plat.split("'aucun compte : etape sautee', null)").length - 1, 6, 'les six verdicts sautes portent ok nul');
  assert.ok(!plat.includes("'aucun compte : etape sautee', true)"), 'aucun verdict saute compte vrai');
  assert.equal(plat.split('(select count(*) from pg_temp.preuve where ok is not true)').length - 1, 2, 'le BILAN compte ok is not true (un nul est faux)');
});
test('README : etape 13 (0007, preuve a 11 verdicts, 0006 historique, ordre 0007 → redeploiement → sondes apercu-web → fusion → push, la phrase du 502 sans image) entre 12 et « Où coller les sorties »', () => {
  const r = lire('supabase/README.md');
  const titre = '### 13. Coller `0007_apercu_web.sql`, puis jouer sa preuve';
  const debut = r.indexOf(titre);
  assert.notEqual(debut, -1, 'etape 13');
  assert.ok(r.indexOf('### 12. Coller `0006_lecture_web.sql`') < debut && debut < r.indexOf('## Où coller les sorties'), '13 apres 12, avant « Où coller les sorties »');
  const etape = rubrique(r, titre).replace(/\s+/g, ' ');
  for (const m of ['migrations/0007_apercu_web.sql', 'proofs/0007_apercu_web.sql', 'Run without RLS', '999 BILAN', '0 faux sur 11', 'RESULTATS-mitsu.md', '2.03 ter', 'les six outils',
    'un code servi avant `0007` : chaque demande d\'aperçus répond 502 `serveur` (la réservation refuse l\'outil) ; l\'app montre les résultats sans image, rien d\'autre ne change.',
    'la preuve `0006` devient historique', 'son 1.01 rougit', 'transactionnel', 'aucune fenêtre sans contrainte', 'shasum -a 256 supabase/migrations/0007_apercu_web.sql',
    'supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api', 'S-A1', 'S-A4', 'S-A5', 'S-A7', 'puttanesca', 'cinq pages hostiles', 'zéro jeton',
    'presse-papiers', 'jamais le jeton dans une commande', 'S1-S9 du lot 4', 'Il faut un compte dans `auth.users`', '« aucun compte : etape sautee »', '`6 faux sur 11` : ce n\'est PAS vert']) assert.ok(etape.includes(m), m);
  const i = ['migrations/0007_apercu_web.sql', 'proofs/0007_apercu_web.sql', 'supabase functions deploy assistant', 'S-A1', 'S-A5', 'fusion', '`push`'].map((m) => etape.indexOf(m));
  assert.ok(i.every((x) => x !== -1), 'gestes presents : ' + i.join(','));
  assert.deepEqual([...i].sort((a, b) => a - b), i, 'dans l ordre : ' + i.join(','));
  const arbre = r.slice(0, r.indexOf('## Un seul projet'));
  for (const f of ['migrations/0007_apercu_web.sql', 'proofs/0007_apercu_web.sql']) assert.ok(arbre.includes(f), 'arbre : ' + f);
  assert.ok(arbre.replace(/\s+/g, ' ').includes('trois écrites à la main (`0004`, `0006`, `0007`)'), 'intro : trois ecrites a la main');
  assert.doesNotMatch(etape, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
});
test('RESULTATS-mitsu : sections « Preuve 0007_apercu_web.sql — à jouer » et « Sondes apercu-web » preparees en fin de fichier, sans cle ni adresse', () => {
  const res = lire('supabase/proofs/RESULTATS-mitsu.md');
  const debut = res.indexOf('## Preuve `0007_apercu_web.sql` — ');
  assert.notEqual(debut, -1, 'section 0007');
  assert.ok(debut > res.indexOf('## Sondes `image-web`'), 'apres les sondes image-web');
  const section = res.slice(debut);
  for (const m of ['étape 13', 'migrations/0007_apercu_web.sql', 'shasum -a 256 supabase/migrations/0007_apercu_web.sql', 'Run without RLS', '999 BILAN', '0 faux sur 11', '| ordre | etape | attendu | obtenu | ok |',
    '2.03 ter', '`apercu-web`', 'la preuve `0006` devient historique', '## Sondes `apercu-web`', 'S-A1', 'S-A2', 'S-A3', 'S-A4', 'S-A5', 'S-A6', 'S-A7', 'sans dépense', 'zéro jeton', 'puttanesca',
    'cinq pages hostiles', 'image_trop_lourde', 'pas_de_recette', 'presse-papiers', 'jamais le jeton dans une commande', 'S1-S9', 'aucune ligne « aucun compte : etape sautee »']) assert.ok(section.includes(m), m);
  assert.ok(res.endsWith('\n') && !res.endsWith('\n\n'), 'une seule fin de ligne en fin de fichier');
  assert.doesNotMatch(section, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'aucune adresse');
  assert.doesNotMatch(res, /sk-(?!…)[A-Za-z0-9_-]{4,}/, 'aucune cle');
});
test('index.ts (UI-2) : apercu-web dans le flux apres image-web et avant le modele, une seule boucle, deux fetch sortants, budget et parallelisme par leurs constantes, telechargerImage avec max, apercuDe declaree APRES traiter (N-1) ; mutant « apercuDe avant traiter » rouge', () => {
  const code = sansCommentaires(lire(`${FONCTION}/index.ts`));
  assert.deepEqual(ordreDuFlux(code), { presents: true, croissants: true });
  assert.equal((code.match(/redirect: 'manual'/g) || []).length, 1, 'une seule boucle (suivreRedirections)');
  assert.equal((code.match(/await fetch\(/g) || []).length, 2, 'deux appels sortants : la page ou l image dans suivreRedirections, le fournisseur dans appelerAnthropic');
  // Revue finale du lot UI-2 : les formes de code `async function enParallele<T>(`, `await lireCorpsBorne(rep, max)` et « apercuDe sans appelerAnthropic » ne sont
  // plus épinglées par le texte (hors de la liste admise du plan) : le comportement les tient (v4 et v5 : la borne max ; v6 à v8 : le parallélisme ; v2 à v8 :
  // aucun appel du modèle).
  for (const m of ["if (outil === 'apercu-web') {", 'LIMITES_APERCU.budgetMs', 'PARALLELISME_APERCU)', 'max: LIMITES_APERCU.image', 'async function apercuDe(', 'max = LIMITES_IMAGE.octets']) assert.ok(code.includes(m), m);
  assert.ok(code.indexOf("if (outil === 'image-web') {") < code.indexOf("if (outil === 'apercu-web') {") && code.indexOf("if (outil === 'apercu-web') {") < code.indexOf('if (corpsModele !== null) {'), 'le bloc apercu-web entre image-web et le modele');
  assert.ok(code.indexOf('async function traiter(') < code.indexOf('async function apercuDe(') && code.indexOf('async function apercuDe(') < code.indexOf('Deno.serve('), 'apercuDe (qui porte telechargerPage, lirePageHtml et telechargerImage) est declaree apres traiter, avant Deno.serve');
  // Mutant : apercuDe (et ses marqueurs) remontee AVANT traiter → la premiere occurrence d « await telechargerPage( » precede la reservation : l ordre casse.
  const d = code.indexOf('async function apercuDe('); const f = code.indexOf('\n}\n', d) + 3;
  const decl = code.slice(d, f); const sans = code.replace(decl, '');
  const t = sans.indexOf('async function traiter(');
  assert.deepEqual(ordreDuFlux(sans.slice(0, t) + decl + sans.slice(t)), { presents: true, croissants: false }, 'mutant « apercuDe avant traiter » : rouge');
});
