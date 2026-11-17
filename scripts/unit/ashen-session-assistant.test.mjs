import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateHpChange, parseSessionCommand, resolveSessionTarget } from '../../src/ashenSessionAssistant.js';

test('identifica perda de PV falada em português sem executar a alteração', () => {
  assert.deepEqual(parseSessionCommand('Engel, você perde 2 pontos de vida'), {
    type: 'hp', targetName: 'Engel', delta: -2, resource: 'hp', requiresConfirmation: true,
  });
});

test('identifica recuperação de PV e aceita o nome após a palavra de ativação', () => {
  assert.deepEqual(parseSessionCommand('Ashen, Engel recupera 5 PV'), {
    type: 'hp', targetName: 'Engel', delta: 5, resource: 'hp', requiresConfirmation: true,
  });
});

test('não interpreta conversa comum nem comandos ambíguos como operações', () => {
  assert.equal(parseSessionCommand('Acho que Engel perdeu dois pontos ontem'), null);
  assert.equal(parseSessionCommand('Engel perde muitos pontos de vida'), null);
});

test('não escolhe entre personagens com nomes ambíguos', () => {
  const result = resolveSessionTarget('Engel', [
    { id: '1', name: 'Engel' },
    { id: '2', name: 'Engel' },
  ]);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.matches.length, 2);
});

test('resolve o alvo somente por correspondência exata normalizada', () => {
  const result = resolveSessionTarget('engel', [{ id: '1', name: 'Engel Silva' }, { id: '2', name: 'Engel' }]);
  assert.equal(result.status, 'found');
  assert.equal(result.target.id, '2');
});

test('calcula PV sem ultrapassar zero ou o máximo da ficha', () => {
  assert.deepEqual(calculateHpChange(2, 20, -5), { previousHp: 2, hp: 0, appliedDelta: -2 });
  assert.deepEqual(calculateHpChange(18, 20, 5), { previousHp: 18, hp: 20, appliedDelta: 2 });
  assert.equal(calculateHpChange(10, 20, Number.NaN), null);
});

test('deploy permite captura de microfone somente na própria origem', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const policy = config.headers.find((entry) => entry.headers.some((header) => header.key === 'Permissions-Policy'))?.headers.find((header) => header.key === 'Permissions-Policy')?.value || '';
  assert.match(policy, /microphone=\(self\)/);
  assert.doesNotMatch(policy, /microphone=\(\)/);
});

test('a ponte de escrita só é exposta para o Mestre e valida estado esperado da ficha', () => {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  assert.match(app, /window\.__ashenApplySessionHp=async/);
  assert.match(app, /state\.session\?\.role!=='master'/);
  assert.match(app, /previousHp!==Number\(expectedHp\)/);
  assert.match(app, /flushSave\(true\)/);
});

test('a janela Ashen AI oferece o modo presencial e dispara a verificação antes de consultar a IA', () => {
  const manager = readFileSync(new URL('../../src/windowManager.js', import.meta.url), 'utf8');
  assert.match(manager, /data-ashen-presence-toggle/);
  assert.match(manager, /SpeechRecognition/);
  assert.match(manager, /parseSessionCommand/);
  assert.match(manager, /__aProfeciaRunIntegrityCheck/);
  assert.match(manager, /data-ashen-ai-integrity/);
});
