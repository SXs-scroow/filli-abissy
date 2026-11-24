import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../supabase/migrations/20261118190000_ashen_ai_memory.sql', import.meta.url), 'utf8');

test('Ashen memory storage is private, RLS-enabled and has no direct client table grants', () => {
  assert.match(sql, /create table if not exists public\.a_profecia_ashen_memory/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.a_profecia_ashen_memory from public, anon, authenticated/i);
});

test('all memory RPCs authenticate the custom Master session and pin an empty search path', () => {
  const functions = sql.match(/create or replace function public\.a_profecia_ashen_memory_[\s\S]*?\$function\$;/gi) || [];
  assert.equal(functions.length, 3);
  for (const fn of functions) {
    assert.match(fn, /security definer/i);
    assert.match(fn, /set search_path = ''/i);
    assert.match(fn, /public\.a_profecia_auth\(p_token\)/i);
    assert.match(fn, /s\.role is distinct from 'master'/i);
  }
  assert.match(sql, /grant execute on function public\.a_profecia_ashen_memory_list[\s\S]*?to anon/i);
  assert.match(sql, /grant execute on function public\.a_profecia_ashen_memory_save[\s\S]*?to anon/i);
  assert.match(sql, /grant execute on function public\.a_profecia_ashen_memory_archive[\s\S]*?to anon/i);
});
