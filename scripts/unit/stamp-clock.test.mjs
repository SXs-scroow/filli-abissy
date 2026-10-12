// Celular com a hora ERRADA não pode perder a disputa de pontos contra o servidor (V1.5.3).
import test, { beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { nextStamp, observeStamp, observePlayerStamps, resetStampClock, stampFloorValue } from '../../src/stampClock.js';
import { extractFunction, readAppSources, playerPrelude } from '../chaos/extract-app.mjs';

beforeEach(() => { resetStampClock(); mock.restoreAll(); });

test('sem nada visto, o carimbo é a hora do aparelho', () => {
  mock.method(Date, 'now', () => 5000);
  assert.equal(nextStamp(), 5000);
});

test('relógio ATRASADO: carimbo novo fica acima do que o servidor já tem', () => {
  mock.method(Date, 'now', () => 1_000_000);               // celular atrasado
  observePlayerStamps([{ data: { _syncUpdatedAt: 9_000_000, _pointsAt: 8_000_000, _keyAt: { hp: 9_500_000 } }, updated_at: new Date(9_100_000).toISOString() }]);
  assert.ok(nextStamp() > 9_500_000);
});

test('relógio ADIANTADO continua funcionando (usa a própria hora)', () => {
  mock.method(Date, 'now', () => 50_000_000);
  observeStamp(9_000_000);
  assert.equal(nextStamp(), 50_000_000);
});

test('lixo não vira piso: NaN, texto, negativo e data absurda (ano > 2100)', () => {
  for (const bad of [NaN, 'abc', -5, null, undefined, 99_999_999_999_999]) observeStamp(bad);
  assert.equal(stampFloorValue(), 0);
});

test('observePlayerStamps aceita linha do servidor, ficha solta e entrada inválida sem quebrar', () => {
  observePlayerStamps([null, 7, 'x', { _pointsAt: 123 }, { data: { _syncUpdatedAt: 456 } }]);
  observePlayerStamps(undefined);
  assert.equal(stampFloorValue(), 456);
});

test('caso real: celular atrasado salva pontos e eles vencem a cópia do servidor', () => {
  const src = readAppSources();
  const NEEDED = ['imageValue', 'clone', 'sameGlobalValue', 'playerSyncKey', 'keepNewerLocalPoints', 'markLocalPlayerChanges'];
  const SERVER = 2_000_000_000_000;                         // carimbo que o servidor já tem
  const PHONE_NOW = SERVER - 86_400_000;                    // celular com a hora 1 dia atrasada
  const snapshot = JSON.stringify([{ id: 'p1', login: 'ana', attrs: { Corpo: 1 }, skills: {}, _pointsAt: 100 }]);
  const ctx = vm.createContext({ JSON, Math, Map, Set, Object, Array, String, Number, console,
    Date: { now: () => PHONE_NOW, parse: Date.parse },
    state: { players: [], playerTombstones: {}, session: { role: 'player', playerId: 'p1' } } });
  vm.runInContext(`${playerPrelude(snapshot)}
    ${NEEDED.map(n => extractFunction(src, n)).join('\n')}
    const PLAYER_KEY_SKIP=new Set(['attrs','skills','rolls','secretClues','password','newPassword','secretLovedEffect','id','login']);
    state.players=[{id:'p1',login:'ana',attrs:{Corpo:5},skills:{},_pointsAt:100}];
    globalThis.seen=()=>observePlayerStamps([{id:'p1',_pointsAt:${SERVER},_syncUpdatedAt:${SERVER}}]);
    globalThis.run=()=>{markLocalPlayerChanges();return state.players[0]};`, ctx);
  ctx.seen();                                               // o aparelho leu o servidor
  const p = ctx.run();                                      // e o jogador gastou pontos
  assert.ok(p._pointsAt > SERVER, `pontos editados (${p._pointsAt}) precisam ser mais novos que o servidor (${SERVER})`);
});

test('sem o relógio lógico o bug existia (prova do teste): hora atrasada gera carimbo menor', () => {
  mock.method(Date, 'now', () => 1000);
  assert.ok(Date.now() < 2000, 'um carimbo só com Date.now() perderia para o servidor');
  observeStamp(2000);
  assert.ok(nextStamp() > 2000);
});
