// Tests du générateur de migrations (spec § 3.1-3.7). Aucune base Postgres ici : on vérifie le SQL produit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMigrations } from './generer-migrations.mjs';
import { SYNC_STORES } from '../src/model/schema.js';
import { ALLOWED_MIME } from '../src/sync/mime.js';

const { tables: sql, storage } = renderMigrations();

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
test('aucune donnee personnelle, determinisme', () => {
  assert.doesNotMatch(sql + storage, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const again = renderMigrations();
  assert.equal(again.tables, sql); assert.equal(again.storage, storage);
});
