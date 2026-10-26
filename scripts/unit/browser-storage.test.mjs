import test from 'node:test';
import assert from 'node:assert/strict';
import { readStoredJson, writeStoredJson, removeStoredValue } from '../../src/persistence/browserStorage.js';

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    data
  };
}

test('browser storage serializes and restores JSON values', () => {
  const storage = memoryStorage();
  assert.equal(writeStoredJson('queue', { pending: [1, 2] }, storage), true);
  assert.deepEqual(readStoredJson('queue', null, storage), { pending: [1, 2] });
});

test('invalid JSON returns fallback without throwing', () => {
  const storage = memoryStorage({ queue: '{broken' });
  assert.deepEqual(readStoredJson('queue', [], storage), []);
});

test('storage failures are reported instead of silently treated as durable', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('blocked'); }
  };
  assert.equal(readStoredJson('queue', 'fallback', broken), 'fallback');
  assert.equal(writeStoredJson('queue', {}, broken), false);
  assert.equal(removeStoredValue('queue', broken), false);
});

test('removing stored data reports success only when it succeeds', () => {
  const storage = memoryStorage({ queue: '1' });
  assert.equal(removeStoredValue('queue', storage), true);
  assert.equal(readStoredJson('queue', null, storage), null);
});
