// Tests du générateur de migrations (spec § 3.1-3.7). Aucune base Postgres ici : on vérifie le SQL produit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMigrations } from './generer-migrations.mjs';
import { SYNC_STORES } from '../src/model/schema.js';
import { ALLOWED_MIME } from '../src/sync/mime.js';

const { tables: sql, storage } = renderMigrations();

// Corps d'une fonction, borne au premier « $$; » qui suit sa declaration : une assertion portant sur UNE fonction ne
// peut pas etre satisfaite par le texte d'une autre.
function corps(nom) {
  const debut = sql.indexOf(`create or replace function public.${nom}`);
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
test('server_seq : sequence globale, declencheur conditionnel, maintenance', () => {
  assert.match(sql, /create sequence if not exists public\.sync_seq/);
  assert.match(sql, /current_setting\('app\.maintenance', true\) = 'on'/);
  assert.equal((sql.match(/execute function public\.touch_server_seq\(\)/g) || []).length, 25);
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
  assert.match(p, /exception when others then bad := 'forme';/);
  assert.match(p, /bad := 'conflit';/);
  assert.match(p, /exit when bad is not null;/);
  // Le « continue » ne doit jamais etre dans le sous-bloc d'ecriture : il reste au niveau de la boucle externe.
  const ouvre = p.indexOf('if cur_updated is null then');
  const ferme = p.indexOf("exception when others then bad := 'forme';");
  assert.ok(ouvre !== -1 && ferme > ouvre, 'sous-bloc d ecriture localise');
  assert.doesNotMatch(p.slice(ouvre, ferme), /continue;/);
  // Un rejet pose avant le sous-bloc sort par le haut, sans passer par l'ecriture.
  assert.match(p, /if bad is not null then\n\s*rejected := rejected \|\| jsonb_build_object\('store', s, 'id', i, 'reason', bad\); continue;/);
});
test('aucune donnee personnelle, determinisme', () => {
  assert.doesNotMatch(sql + storage, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const again = renderMigrations();
  assert.equal(again.tables, sql); assert.equal(again.storage, storage);
});
