import test from 'node:test';
import assert from 'node:assert/strict';
import { clampWindowPosition, normalizeWindowPreferences } from '../../src/windowManager.js';

test('window preferences keep only known IDs and remove duplicates', () => {
  assert.deepEqual(normalizeWindowPreferences({ open: ['command', 'command', 'unknown'], minimized: ['session', 'session'] }), {
    open: ['command'], minimized: ['session'],
  });
});

test('window preferences tolerate missing or invalid data', () => {
  assert.deepEqual(normalizeWindowPreferences(null), { open: [], minimized: [] });
  assert.deepEqual(normalizeWindowPreferences({ open: 'command' }), { open: [], minimized: [] });
});

test('window positions stay inside the usable viewport', () => {
  assert.deepEqual(clampWindowPosition({ x: -100, y: 900 }, { width: 900, height: 700 }), { x: 8, y: 520 });
});

test('window positions use safe defaults for invalid coordinates', () => {
  assert.deepEqual(clampWindowPosition({ x: Number.NaN, y: Infinity }, { width: 1200, height: 900 }), { x: 24, y: 80 });
});

test('window preferences recognize the Ashen AI window', () => {
  assert.deepEqual(normalizeWindowPreferences({ open: ['ashen-ai'], minimized: [] }), { open: ['ashen-ai'], minimized: [] });
});
