import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePlayerQueueItems, serializePlayerQueue, sanitizePlayerQueueItem } from '../../src/persistence/playerQueue.js';

const item = (id, stamp, queuedAt = stamp, extra = {}) => ({
  id, login: id, data: { id, _syncUpdatedAt: stamp }, queuedAt, attempts: 0, ...extra
});

test('a fila persistida antiga não substitui uma edição mais nova mantida em memória', () => {
  const memory = item('P1', 300, 100);
  const stored = item('P1', 200, 200);
  assert.deepEqual(mergePlayerQueueItems([memory], [stored]), [memory]);
});

test('uma entrada persistida mais nova é recuperada após reinicialização', () => {
  const memory = item('P1', 200, 300);
  const stored = item('P1', 300, 200);
  assert.deepEqual(mergePlayerQueueItems([memory], [stored]), [stored]);
});

test('a reconciliação mantém itens distintos sem duplicar IDs', () => {
  const result = mergePlayerQueueItems([item('A', 1), item('B', 1)], [item('A', 1), item('C', 1)]);
  assert.deepEqual(result.map(x => x.id).sort(), ['A', 'B', 'C']);
});

test('serialização não trunca filas grandes nem itens pendentes mais antigos', () => {
  const source = Array.from({ length: 175 }, (_, i) => item(`P${i}`, i + 1));
  const saved = serializePlayerQueue(source);
  assert.equal(saved.length, 175);
  assert.equal(saved[0].id, 'P0');
  assert.equal(saved[174].id, 'P174');
});

test('entradas sem ID são ignoradas', () => {
  assert.deepEqual(serializePlayerQueue([null, {}, item('ok', 1)]).map(x => x.id), ['ok']);
});


test('a fila remove senha e segredos antes de persistir, tanto da memória quanto do armazenamento antigo', () => {
  const unsafeMemory = item('P1', 10, 10, {
    password: 'senha-raiz', newPassword: 'nova-raiz', secretLovedEffect: 'segredo-raiz',
    data: { id: 'P1', _syncUpdatedAt: 10, password: 'senha', newPassword: 'nova', secretLovedEffect: 'efeito', nested: { password: 'senha-aninhada' } },
    baseData: { password: 'senha-base', hp: 7 }
  });
  const unsafeStored = item('P2', 20, 20, {
    data: { id: 'P2', _syncUpdatedAt: 20, password: 'senha-antiga', hp: 8 }
  });
  const result = serializePlayerQueue([unsafeMemory, unsafeStored]);
  assert.equal(result.length, 2);
  const serialized = JSON.stringify(result).toLowerCase();
  for (const secret of ['senha-raiz', 'nova-raiz', 'segredo-raiz', 'senha-aninhada', 'senha-base', 'senha-antiga', '"password"', '"newpassword"', '"secretlovedeffect"']) {
    assert.equal(serialized.includes(secret), false, `fila ainda contém ${secret}`);
  }
  assert.equal(result.find(x => x.id === 'P1').data.hp, undefined);
  assert.equal(result.find(x => x.id === 'P1').baseData.hp, 7);
});

test('sanitização não altera o objeto original da ficha em memória', () => {
  const source = { id: 'P1', data: { password: 'segredo', hp: 10 } };
  const safe = sanitizePlayerQueueItem(source);
  assert.equal(source.data.password, 'segredo');
  assert.equal(safe.data.password, undefined);
  assert.equal(safe.data.hp, 10);
});

test('recuperação sanitiza entradas legadas sem descartar dados legítimos', () => {
  const restored = mergePlayerQueueItems([], [{ id: 'P3', queuedAt: 5, data: { password: 'legado', hp: 12, _syncUpdatedAt: 5 } }]);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].data.password, undefined);
  assert.equal(restored[0].data.hp, 12);
});

test('botão de laboratório executa a bateria de persistência isolada', async () => {
  const { runPersistenceSelfTest } = await import('../../src/loadTest.js');
  const nodes = new Map([
    ['playerPersistenceStatus', { textContent: '' }],
    ['playerPersistenceDetails', { textContent: '' }],
    ['runPersistenceSelfTest', { disabled: false }]
  ]);
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  globalThis.document = { getElementById: id => nodes.get(id) || null };
  globalThis.window = {};
  try {
    const report = runPersistenceSelfTest();
    assert.equal(report.ok, true, report.problems.join(', '));
    assert.equal(report.checksPassed, 4);
    assert.equal(nodes.get('runPersistenceSelfTest').disabled, false);
    assert.match(nodes.get('playerPersistenceStatus').textContent, /PASSOU/);
  } finally {
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
  }
});
