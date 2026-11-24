import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanAshenMessages, sanitizeAshenContext, validateAshenResult, parseAshenProviderResponse, executeAshenReadTool, parseAshenDiceExpression } from '../../src/ashenAIEngine.js';

test('cleanAshenMessages limits history and starts with a user message', () => {
  const result = cleanAshenMessages([
    { role: 'assistant', content: 'orphan' },
    { role: 'user', content: '  olá  ' },
    { role: 'assistant', content: 'resposta' }
  ]);
  assert.deepEqual(result, [{ role: 'user', content: 'olá' }, { role: 'assistant', content: 'resposta' }]);
});

test('sanitizeAshenContext keeps only bounded, relevant session fields', () => {
  const result = sanitizeAshenContext({
    session: { title: 'Noite', round: 2, turn: 3, secret: 'não enviar' },
    players: [{ id: 'p1', name: 'Engel', hp: 8, hpMax: 12, password: 'secret' }]
  });
  assert.equal(result.session.title, 'Noite');
  assert.equal(result.players[0].hp, 8);
  assert.equal('password' in result.players[0], false);
  assert.equal('secret' in result.session, false);
});

test('validates a clear resource action against an exact player', () => {
  const context = sanitizeAshenContext({ players: [{ id: 'p1', name: 'Engel', hp: 10, hpMax: 12 }] });
  const result = validateAshenResult({ reply: 'Engel sofreu dano.', action: { type: 'change_resource', target: 'Engel', resource: 'hp', delta: -2 } }, context);
  assert.deepEqual(result.action, { type: 'change_resource', targetType: 'player', target: 'p1', targetName: 'Engel', resource: 'hp', delta: -2 });
});

test('rejects ambiguous targets and unsupported action types', () => {
  const context = sanitizeAshenContext({ players: [{ id: 'p1', name: 'Engel' }, { id: 'p2', name: 'Engel' }] });
  assert.equal(validateAshenResult({ reply: 'Qual Engel?', action: { type: 'change_resource', target: 'Engel', resource: 'hp', delta: -2 } }, context).action, null);
  assert.equal(validateAshenResult({ reply: 'Não posso.', action: { type: 'delete_player', target: 'p1' } }, context).action, null);
});

test('validates initiative and turn actions only when the target exists', () => {
  const context = sanitizeAshenContext({ participants: [{ key: 'player:p1', name: 'Engel', kind: 'player' }] });
  assert.deepEqual(validateAshenResult({ reply: 'Iniciativa ajustada.', action: { type: 'set_initiative', target: 'Engel', value: 18 } }, context).action,
    { type: 'set_initiative', target: 'player:p1', targetName: 'Engel', value: 18 });
  assert.equal(validateAshenResult({ reply: 'Avançando.', action: { type: 'advance_turn' } }, { ...context, session: { active: true } }).action.type, 'advance_turn');
  assert.equal(validateAshenResult({ reply: 'Não iniciado.', action: { type: 'advance_turn' } }, context).action, null);
});

test('parses provider JSON and safely falls back to plain text', () => {
  const context = sanitizeAshenContext({});
  assert.equal(parseAshenProviderResponse('{"reply":"Olá","action":null}', context).reply, 'Olá');
  assert.equal(parseAshenProviderResponse('Resposta simples.', context).reply, 'Resposta simples.');
});

test('sanitizes detailed sheets, inventory, condition catalog and persistent campaign memory', () => {
  const result = sanitizeAshenContext({
    players: [{ id: 'p1', name: 'Engel', attrs: { Corpo: 4 }, skills: { Investigação: 8 }, backpack: [{ id: 12, name: 'Revólver', qty: 2 }], masterNotes: 'must not leak' }],
    monsters: [{ id: 'm1', name: 'Criatura', abilities: ['Mordida'], conditions: ['bleeding'] }],
    items: [{ id: 12, name: 'Revólver', damage: '1d8' }],
    conditionCatalog: [{ id: 'bleeding', name: 'Sangramento', effect: '2 dano' }],
    memories: [{ id: 'mem1', title: 'A igreja', content: 'O sino tocou', category: 'event' }]
  });
  assert.equal(result.players[0].attrs.Corpo, 4);
  assert.equal(result.players[0].skills.Investigação, 8);
  assert.equal(result.players[0].backpack[0].name, 'Revólver');
  assert.equal('masterNotes' in result.players[0], false);
  assert.equal(result.monsters[0].abilities[0], 'Mordida');
  assert.equal(result.items[0].damage, '1d8');
  assert.equal(result.conditionCatalog[0].id, 'bleeding');
  assert.equal(result.memories[0].content, 'O sino tocou');
});

test('validates condition, inventory, archive and persistent memory proposals', () => {
  const context = sanitizeAshenContext({
    players: [{ id: 'p1', name: 'Engel' }],
    items: [{ id: 12, name: 'Revólver', maxQty: 3 }],
    conditionCatalog: [{ id: 'bleeding', name: 'Sangramento' }]
  });
  assert.deepEqual(validateAshenResult({ reply: 'Aplicar condição.', action: { type: 'set_condition', target: 'Engel', condition: 'Sangramento' } }, context).action,
    { type: 'set_condition', targetType: 'player', target: 'p1', targetName: 'Engel', conditionId: 'bleeding', conditionName: 'Sangramento' });
  assert.deepEqual(validateAshenResult({ reply: 'Adicionar item.', action: { type: 'manage_inventory', target: 'Engel', operation: 'add', item: 'Revólver', quantity: 1 } }, context).action,
    { type: 'manage_inventory', target: 'p1', targetName: 'Engel', operation: 'add', itemId: 12, itemName: 'Revólver', quantity: 1 });
  assert.equal(validateAshenResult({ reply: 'Registrar.', action: { type: 'record_campaign_event', title: 'O sino', content: 'Tocou' } }, context).action.kind, 'event');
  assert.equal(validateAshenResult({ reply: 'Lembrar.', action: { type: 'save_memory', title: 'Igreja', content: 'O sino tocou' } }, context).action.category, 'fact');
});

test('read tools search archive, memory and character sheets without mutating context', async () => {
  const context = sanitizeAshenContext({
    players: [{ id: 'p1', name: 'Engel', hp: 9, hpMax: 12, attrs: { Corpo: 4 } }],
    archive: [{ title: 'A igreja velha', content: 'O sino tocou à meia-noite' }],
    memories: [{ id: 'mem1', title: 'Sino', content: 'O sino toca quando Rher aparece' }]
  });
  const archive = await executeAshenReadTool('search_archive', { query: 'sino' }, context);
  const memory = await executeAshenReadTool('search_memory', { query: 'Rher' }, context);
  const character = await executeAshenReadTool('get_character', { name: 'Engel' }, context);
  assert.equal(archive.results.length, 1);
  assert.equal(memory.results.length, 1);
  assert.equal(character.character.hp, 9);
  assert.equal(context.players[0].hp, 9);
});

test('validates dice expressions with bounded count, sides and modifier', () => {
  assert.deepEqual(parseAshenDiceExpression('2d6+3'), { count: 2, sides: 6, modifier: 3, label: '2d6+3' });
  assert.equal(parseAshenDiceExpression('999d6'), null);
  assert.equal(parseAshenDiceExpression('1d1'), null);
});

test('rolls skill checks using the configured linked attribute and records actual dice values', async () => {
  const context = sanitizeAshenContext({ players: [{ id: 'p1', name: 'Engel', attrs: { Agilidade: 3 }, skills: { Furtividade: 2 } }], rules: { skillRollMode: 'cris' } });
  const values = [4, 19, 7];
  const result = await executeAshenReadTool('roll_skill_check', { target: 'Engel', skill: 'Furtividade' }, context, () => values.shift());
  assert.deepEqual(result.dice, [4, 19, 7]);
  assert.equal(result.pool, 3);
  assert.equal(result.keep, 'highest');
  assert.equal(result.natural, 19);
  assert.equal(result.modifier, 2);
  assert.equal(result.total, 21);
  assert.equal(result.critical, false);
});

test('rules search returns only structured catalog entries and exposes memory setup state', async () => {
  const context = sanitizeAshenContext({
    spells: [{ id: 's1', name: 'Olhos do Abismo', description: 'Percebe passagens ocultas.' }, { id: 's2', name: 'Chama', description: 'Fogo.' }],
    rules: { skillRollMode: 'cris', bookTitle: 'Manual', bookAvailable: true },
    memoryStatus: 'migration_required', archiveStatus: 'available'
  });
  const result = await executeAshenReadTool('search_rules', { query: 'Abismo' }, context);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].id, 's1');
  assert.equal(context.memoryStatus, 'migration_required');
  assert.equal(context.rules.bookAvailable, true);
});

test('archive memory only accepts a memory that exists in the current context', () => {
  const context = sanitizeAshenContext({ memories: [{ id: 'memory-1', title: 'O sino' }] });
  assert.deepEqual(validateAshenResult({ reply: 'Vou arquivar.', action: { type: 'archive_memory', memory: 'O sino' } }, context).action,
    { type: 'archive_memory', memoryId: 'memory-1', title: 'O sino' });
  assert.equal(validateAshenResult({ reply: 'Não encontrei.', action: { type: 'archive_memory', memory: 'Outra' } }, context).action, null);
});

test('skill rolls obey Simple mode and reject trained-only skills without training', async () => {
  const simple = sanitizeAshenContext({ players: [{ id: 'p1', name: 'Engel', attrs: { Agilidade: 8 }, skills: { Furtividade: 3 } }], rules: { skillRollMode: 'simple' } });
  const result = await executeAshenReadTool('roll_skill_check', { target: 'Engel', skill: 'Furtividade' }, simple, () => 12);
  assert.equal(result.pool, 1);
  assert.deepEqual(result.dice, [12]);
  const untrained = sanitizeAshenContext({ players: [{ id: 'p2', name: 'Mavka', attrs: { Conhecimento: 4 }, skills: { Ocultismo: 0 } }] });
  const blocked = await executeAshenReadTool('roll_skill_check', { target: 'Mavka', skill: 'Ocultismo' }, untrained, () => 20);
  assert.match(blocked.error, /somente.*treinamento|treinamento/i);
});

test('condition removal is proposed only when the target has that condition', () => {
  const context = sanitizeAshenContext({
    players: [{ id: 'p1', name: 'Engel', conditions: ['Sangramento'] }],
    conditionCatalog: [{ id: 'bleeding', name: 'Sangramento' }, { id: 'poison', name: 'Veneno' }]
  });
  assert.equal(validateAshenResult({ reply: 'Remover.', action: { type: 'remove_condition', target: 'Engel', condition: 'Sangramento' } }, context).action.conditionId, 'bleeding');
  assert.equal(validateAshenResult({ reply: 'Remover.', action: { type: 'remove_condition', target: 'Engel', condition: 'Veneno' } }, context).action, null);
});

test('Manual de Rolagens: até 3d20, maior dado e +2 por ponto acima de 3', async () => {
  const context = sanitizeAshenContext({ players: [{ id: 'p1', name: 'Engel', attrs: { Agilidade: 1 }, skills: { Furtividade: 5 } }] });
  const values = [7, 12, 18, 3];
  const result = await executeAshenReadTool('roll_skill_check', { target: 'Engel', skill: 'Furtividade' }, context, () => values.shift());
  assert.equal(result.mode, 'limit');
  assert.deepEqual(result.dice, [7, 12, 18]);
  assert.equal(result.pool, 3);
  assert.equal(result.natural, 18);
  assert.equal(result.modifier, 4);
  assert.equal(result.total, 22);
});

test('Manual de Rolagens: 0 ponto rola 1d20 e falha crítica é o maior dado ser 1', async () => {
  const context = sanitizeAshenContext({ players: [{ id: 'p1', name: 'Engel', attrs: { Agilidade: 0 }, skills: { Luta: 0 } }] });
  const result = await executeAshenReadTool('roll_skill_check', { target: 'Engel', skill: 'Luta' }, context, () => 1);
  assert.equal(result.pool, 1);
  assert.equal(result.fumble, true);
  assert.equal(result.modifier, 0);
});
