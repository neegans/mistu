// Tests du générateur de migrations (spec § 3.1-3.7). Aucune base Postgres ici : on vérifie le SQL produit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMigrations } from './generer-migrations.mjs';
import { SYNC_STORES } from '../src/model/schema.js';
import { ALLOWED_MIME } from '../src/sync/mime.js';

const { tables: sql, storage } = renderMigrations();

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
  for (const t of SYNC_STORES) assert.match(sql, new RegExp(`create table public\\.${t} \\(`));
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
test('la liste litterale vaut exactement SYNC_STORES, aux quatre endroits (spec § 3.1)', () => {
  const litteral = 'array[' + SYNC_STORES.map((s) => `'${s}'`).join(', ') + ']';
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
  assert.doesNotMatch(sql + storage, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const again = renderMigrations();
  assert.equal(again.tables, sql); assert.equal(again.storage, storage);
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
const NOMS = ['0001_tables_et_regles.sql', '0002_stockage.sql'];
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
