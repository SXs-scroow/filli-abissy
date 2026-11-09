import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const start = app.indexOf('const TRASH_KEY');
const end = app.indexOf('function toastUndo');
assert.ok(start > 0 && end > start, 'bloco da lixeira não encontrado');
const core = app.slice(start, end);

function sandbox() {
  const store = {};
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const state = {
    creatures: [{ id: 'e-1', name: 'Rastejante', hpMax: 20 }],
    items: [{ id: 1, name: 'Faca', category: 'Armas' }, { id: 2, name: 'Corda', category: 'Diversos' }],
    customContent: { abilities: [{ id: 'a1', name: 'Grito' }, { id: 'a2', name: 'Sussurro' }] }
  };
  const calls = { save: 0, global: 0, toasts: [] };
  const clone = x => JSON.parse(JSON.stringify(x));
  const make = new Function('state', 'storageGet', 'localStorage', 'clone', 'toast', 'save', 'saveGlobalNow', 'nextItemId',
    `${core}; return { trashLoad, trashSave, trashPush, trashRestore, trashKindLabel, trashAge };`);
  const nextItemId = () => Math.max(0, ...state.items.map(i => Number(i.id))) + 1;
  const api = make(state, k => localStorage.getItem(k), localStorage, clone, m => calls.toasts.push(m),
    () => { calls.save++; }, async () => { calls.global++; }, nextItemId);
  return { api, state, calls, store };
}

test('monstro excluído vai para a lixeira e volta intacto', async () => {
  const { api, state, calls } = sandbox();
  const m = state.creatures[0];
  const entry = api.trashPush('monster', m.name, m);
  state.creatures.splice(0, 1);
  assert.equal(api.trashLoad().length, 1);
  const r = await api.trashRestore(entry.tid);
  assert.equal(r.label, 'Rastejante');
  assert.deepEqual(state.creatures.map(c => c.name), ['Rastejante']);
  assert.equal(state.creatures[0].hpMax, 20);
  assert.equal(calls.global, 1, 'sincroniza com o servidor ao restaurar');
  assert.equal(api.trashLoad().length, 0, 'sai da lixeira depois de restaurar');
});

test('item/arma volta com o mesmo ID (mantém vínculo com mochilas); ID ocupado ganha um novo', async () => {
  const { api, state } = sandbox();
  const knife = state.items[0];
  const e1 = api.trashPush('item', knife.name, knife);
  state.items = state.items.filter(i => i.id !== 1);
  await api.trashRestore(e1.tid);
  assert.deepEqual(state.items.map(i => i.id), [1, 2]);

  const e2 = api.trashPush('item', 'Faca', { id: 2, name: 'Faca clone', category: 'Armas' });
  const r = await api.trashRestore(e2.tid);
  assert.ok(r);
  assert.equal(state.items.length, 3);
  assert.equal(new Set(state.items.map(i => i.id)).size, 3, 'sem IDs duplicados');
});

test('conteúdo personalizado volta na mesma posição', async () => {
  const { api, state } = sandbox();
  const list = state.customContent.abilities;
  const removed = list[0];
  const e = api.trashPush('custom', removed.name, removed, { key: 'abilities', index: 0 });
  list.splice(0, 1);
  await api.trashRestore(e.tid);
  assert.deepEqual(state.customContent.abilities.map(a => a.name), ['Grito', 'Sussurro']);
  assert.equal(api.trashKindLabel(e), 'Habilidade');
});

test('entradas com mais de 14 dias expiram e a lixeira guarda no máximo 60', () => {
  const { api, store } = sandbox();
  api.trashPush('monster', 'Velho', { id: 'x' });
  const list = JSON.parse(store.ashen_trash_v1);
  list[0].deletedAt = Date.now() - 15 * 864e5;
  store.ashen_trash_v1 = JSON.stringify(list);
  assert.equal(api.trashLoad().length, 0);
  for (let i = 0; i < 70; i++) api.trashPush('monster', 'M' + i, { id: 'm' + i });
  assert.equal(api.trashLoad().length, 60);
  assert.equal(api.trashLoad()[0].label, 'M69', 'mais recente primeiro');
});

test('restaurar algo que não existe mais não quebra', async () => {
  const { api } = sandbox();
  assert.equal(await api.trashRestore('t-inexistente'), null);
});

test('as exclusões do painel passam pela lixeira e oferecem Desfazer', () => {
  assert.match(app, /trashPush\('monster'/);
  assert.match(app, /trashPush\('item'/);
  assert.match(app, /trashPush\('custom'/);
  assert.match(app, /toastUndo\('Monstro excluído\.'/);
  assert.match(app, /\['trash','⌫','Lixeira'/);
  assert.match(app, /t==='trash'\?trashAdmin\(\)/);
});
