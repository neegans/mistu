// Tests du générateur de migrations (spec § 3.1-3.7). Aucune base Postgres ici : on vérifie le SQL produit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderMigrations } from './generer-migrations.mjs';
import { SYNC_STORES_0001, TABLES } from '../src/sync/tables.js';
import { SYNC_STORES } from '../src/model/schema.js';
import { ALLOWED_MIME } from '../src/sync/mime.js';

const { tables: sql, storage, delta } = renderMigrations();
const sha = (s) => createHash('sha256').update(s).digest('hex');

// Corps d'une fonction, borne au premier « $$; » qui suit sa declaration : une assertion portant sur UNE fonction ne
// peut pas etre satisfaite par le texte d'une autre.
// La parenthese ouvrante est indispensable : « sync_purge » est un prefixe de « sync_purge_all ».
function corps(nom) {
  const debut = sql.indexOf(`create or replace function public.${nom}(`);
  assert.notEqual(debut, -1, 'declaration de ' + nom);
  const fin = sql.indexOf('$$;', debut);
  assert.notEqual(fin, -1, 'fin du corps de ' + nom);
  return sql.slice(debut, fin + 3);
}

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
  const litteral = 'array[' + SYNC_STORES_0001.map((s) => `'${s}'`).join(', ') + ']';
  assert.equal(sql.split(litteral).length - 1, 4); // sync_push, sync_purge, sync_purge_all, purge_tombstones
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
  assert.doesNotMatch(sql + storage + delta, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const again = renderMigrations();
  assert.equal(again.tables, sql); assert.equal(again.storage, storage); assert.equal(again.delta, delta);
});

// --- Assistant par le compte, tache 8 : migration 0003 a ajout seul (spec assistant-par-le-compte § 6.1-6.2) -------
// 0001 et 0002 sont appliquees sur mitsu : --check prouve « genere = commite », l'empreinte prouve « commite =
// applique » (F11). Une factorisation du generateur qui bougerait un seul octet de 0001 casse ce test-ci.
test('0001 et 0002 : octet pour octet ceux appliques sur mitsu (empreintes du 17 octobre 2026)', () => {
  assert.equal(sha(sql), 'e90ff35ec7c031f63dfb903e6885103ed7e42202866f59359ce019d00b85ee51');
  assert.equal(sha(storage), '2e90d2b1beb7270601f83c7408b1a2a2be32c800772f14f454960b233a2d5944');
});
test('0003 : une table neuve, revoke anon, quatre fonctions avec les 26 magasins', () => {
  const nouvelles = SYNC_STORES.filter((s) => !SYNC_STORES_0001.includes(s));
  assert.deepEqual(nouvelles, ['assistant_config']);
  assert.equal((delta.match(/create table public\./g) || []).length, 1);
  assert.match(delta, /create table public\.assistant_config \(/);
  assert.equal((delta.match(/create policy[^;]+;/g) || []).length, 4);
  assert.equal((delta.match(/execute function public\.touch_server_seq\(\)/g) || []).length, 1);
  assert.match(delta, /create index assistant_config_recv on public\.assistant_config \(owner_id, server_seq\);/);
  assert.equal((delta.match(/create index /g) || []).length, 1, 'un seul index');
  assert.match(delta, /revoke all on public\.assistant_config from anon;/);
  assert.equal((delta.match(/revoke all on public\./g) || []).length, 1, 'un seul revoke de table');
  const litteral26 = 'array[' + SYNC_STORES.map((s) => `'${s}'`).join(', ') + ']';
  assert.equal(delta.split(litteral26).length - 1, 4, 'sync_push, sync_purge, sync_purge_all, purge_tombstones');
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
  const litteral = (stores) => 'array[' + stores.map((s) => `'${s}'`).join(', ') + ']';
  const ramene = delta.slice(debutDe(delta))
    .split(litteral(SYNC_STORES)).join(litteral(SYNC_STORES_0001))
    .split(enJson(SYNC_STORES, 'key')).join(enJson(SYNC_STORES_0001, 'key'))
    .split(enJson(SYNC_STORES, 'required')).join(enJson(SYNC_STORES_0001, 'required'));
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
const NOMS = ['0001_tables_et_regles.sql', '0002_stockage.sql', '0003_assistant_config.sql'];
const instructions = (texte) => texte.split('\n').map((l) => l.trim()).filter((l) => l !== '');

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
  assert.ok(res.includes('## Preuve `0003_assistant_config.sql` — à jouer (à remplir par Neegan, sans aucune valeur de data)'));
  assert.doesNotMatch(res, /sk-(?!…)[A-Za-z0-9_-]{4,}/, 'aucune cle dans RESULTATS');
});
