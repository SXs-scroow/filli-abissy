// Garante que pontos (atributos/perícias) salvos pelo Player não somem quando chega uma cópia remota.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractFunction, readAppSources, playerPrelude } from '../chaos/extract-app.mjs';

const src = readAppSources();
const NEEDED = ['imageValue', 'clone', 'playerSyncKey', 'keepNewerLocalPoints', 'adoptPlayerInPlace', 'playerRowStamp',
  'playerRowDeletedStamp', 'isEmptySheetValue', 'preserveLocalSheetAgainstReset', 'mergeRollHistory', 'mergeSecretClues', 'applyPlayerRows'];

function makeSandbox(localPlayers) {
  let pushes = 0;
  const ctx = vm.createContext({ JSON, Date, Math, Map, Set, Object, Array, String, Number, console,
    playerStoreEnabled: true, normalize: () => {}, queuePlayerDbSave: () => { pushes++; },
    state: { players: localPlayers, playerTombstones: {}, session: { role: 'player', playerId: 'p1', login: 'ana' } } });
  vm.runInContext(`${playerPrelude()}\n${NEEDED.map(n => extractFunction(src, n)).join('\n')}
    globalThis.api={apply:(rows,o)=>applyPlayerRows(rows,o),get players(){return state.players}};`, ctx);
  return { api: ctx.api, pushes: () => pushes };
}
const row = (data, stamp) => ({ id: 'p1', login: 'ana', data: { id: 'p1', login: 'ana', ...data, _syncUpdatedAt: stamp },
  updated_at: new Date(stamp).toISOString(), deleted_at: null });

test('remoto mais novo (outro carimbo) NÃO apaga pontos locais mais novos e pede reenvio', () => {
  const { api, pushes } = makeSandbox([{ id: 'p1', login: 'ana', attrs: { Corpo: 3 }, skills: { Furtividade: 2 }, _pointsAt: 500, _syncUpdatedAt: 100 }]);
  api.apply([row({ attrs: { Corpo: 0 }, skills: {}, hp: 9, _pointsAt: 100 }, 900)]);
  const p = api.players[0];
  assert.equal(p.attrs.Corpo, 3);
  assert.equal(p.skills.Furtividade, 2);
  assert.equal(p.hp, 9, 'o resto da ficha continua vindo do servidor');
  assert.equal(p._pointsAt, 500);
  assert.ok(Number(p._syncUpdatedAt) >= 900);
  assert.equal(pushes(), 1);
});

test('pontos remotos mais novos (ex.: Mestre ajustou) vencem os locais', () => {
  const { api, pushes } = makeSandbox([{ id: 'p1', login: 'ana', attrs: { Corpo: 3 }, skills: {}, _pointsAt: 100, _syncUpdatedAt: 100 }]);
  api.apply([row({ attrs: { Corpo: 5 }, skills: {}, _pointsAt: 700 }, 900)]);
  assert.equal(api.players[0].attrs.Corpo, 5);
  assert.equal(pushes(), 0);
});

test('o objeto da ficha continua o MESMO depois da atualização remota (botão Salvar não perde a referência)', () => {
  const mine = { id: 'p1', login: 'ana', attrs: { Corpo: 1 }, skills: {}, _syncUpdatedAt: 100 };
  const { api } = makeSandbox([mine]);
  api.apply([row({ attrs: { Corpo: 2 }, skills: {} }, 900)]);
  assert.strictEqual(api.players[0], mine);
  assert.equal(mine.attrs.Corpo, 2);
});

test('campo local com carimbo mais novo (ex.: vida) não é apagado por cópia remota com carimbo geral maior', () => {
  const { api, pushes } = makeSandbox([{ id: 'p1', login: 'ana', hp: 4, playerNotes: 'minha nota', _keyAt: { hp: 800, playerNotes: 800 }, _syncUpdatedAt: 100 }]);
  api.apply([row({ hp: 20, playerNotes: 'velha', mochila: 'do-mestre', _keyAt: { hp: 300 } }, 900)]);
  const p = api.players[0];
  assert.equal(p.hp, 4);
  assert.equal(p.playerNotes, 'minha nota');
  assert.equal(p.mochila, 'do-mestre', 'campo sem carimbo local continua vindo do servidor');
  assert.equal(p._keyAt.hp, 800);
  assert.equal(pushes(), 1);
});

test('campo remoto com carimbo mais novo vence o local', () => {
  const { api, pushes } = makeSandbox([{ id: 'p1', login: 'ana', hp: 4, _keyAt: { hp: 200 }, _syncUpdatedAt: 100 }]);
  api.apply([row({ hp: 20, _keyAt: { hp: 700 } }, 900)]);
  assert.equal(api.players[0].hp, 20);
  assert.equal(pushes(), 0);
});

test('cópia remota parcialmente vazia não reseta pontos nem campos preenchidos sem carimbo de limpeza', () => {
  const local = { id: 'p1', login: 'ana', name: 'Personagem', hp: 18, attrs: { Corpo: 3 }, skills: { Furtividade: 2 }, backpack: [{ name: 'Chave' }], _pointsAt: 100, _syncUpdatedAt: 100, _keyAt: { hp: 100, name: 100 } };
  const { api, pushes } = makeSandbox([local]);
  api.apply([row({ name: '', hp: 0, attrs: {}, skills: {}, backpack: [], _pointsAt: 50, _keyAt: {} }, 900)]);
  const p = api.players[0];
  assert.equal(p.name, 'Personagem');
  assert.equal(p.hp, 18);
  assert.equal(p.attrs.Corpo, 3);
  assert.equal(p.skills.Furtividade, 2);
  assert.equal(p.backpack[0].name, 'Chave');
  assert.equal(pushes(), 1);
});

test('limpeza explícita com carimbo de campo mais novo é respeitada', () => {
  const local = { id: 'p1', login: 'ana', name: 'Personagem', hp: 18, _syncUpdatedAt: 100, _keyAt: { name: 100, hp: 100 } };
  const { api } = makeSandbox([local]);
  api.apply([row({ name: '', hp: 0, _keyAt: { name: 950, hp: 950 } }, 900)]);
  assert.equal(api.players[0].name, '');
  assert.equal(api.players[0].hp, 0);
});

test('Mestre zerando pontos (carimbo de pontos mais novo) não é desfeito pela proteção anti-reset', () => {
  const local = { id: 'p1', login: 'ana', name: 'Personagem', attrs: { Corpo: 3 }, skills: { Furtividade: 2 }, _pointsAt: 100, _syncUpdatedAt: 100, _keyAt: { name: 100 } };
  const { api } = makeSandbox([local]);
  api.apply([row({ name: 'Personagem', attrs: { Corpo: 0 }, skills: { Furtividade: 0 }, _pointsAt: 800, _keyAt: { name: 100 } }, 900)]);
  const p = api.players[0];
  assert.equal(p.attrs.Corpo, 0);
  assert.equal(p.skills.Furtividade, 0);
  assert.equal(p._pointsAt, 800);
});
