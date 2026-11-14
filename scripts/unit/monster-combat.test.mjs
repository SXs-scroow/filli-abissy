import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  baseMonsterName, nextMonsterCopyName, applyMonsterHpDelta, isMonsterDown, pickNextParticipant
} from '../../src/monsterUtils.js';

const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('nomes de cópias seguem a série Zumbi, Zumbi 2, Zumbi 3', () => {
  assert.equal(baseMonsterName('Zumbi (cópia)'), 'Zumbi');
  assert.equal(baseMonsterName('Zumbi 7'), 'Zumbi');
  assert.equal(nextMonsterCopyName('Zumbi', [{ name: 'Zumbi' }]), 'Zumbi 2');
  assert.equal(nextMonsterCopyName('Zumbi', [{ name: 'Zumbi' }, { name: 'Zumbi 2' }, { name: 'Zumbi 5' }]), 'Zumbi 6');
  assert.equal(nextMonsterCopyName('C.u(l)t', [{ name: 'C.u(l)t' }]), 'C.u(l)t 2');
  assert.equal(nextMonsterCopyName('Cultista', [{ name: 'Zumbi' }]), 'Cultista 1');
});

test('dano e cura respeitam 0..máx e aceitam vida salva como texto', () => {
  assert.deepEqual(applyMonsterHpDelta({ hp: 20, hpMax: 20 }, -5), { before: 20, after: 15, cap: 20 });
  assert.equal(applyMonsterHpDelta({ hp: '12', hpMax: 12 }, -5).after, 7);
  assert.equal(applyMonsterHpDelta({ hp: 3, hpMax: 20 }, -50).after, 0);
  assert.equal(applyMonsterHpDelta({ hp: 18, hpMax: 20 }, 50).after, 20);
  assert.equal(applyMonsterHpDelta({ hpMax: 9 }, -1).after, 8);
});

test('monstro caído só quando tem vida máxima e vida 0', () => {
  assert.equal(isMonsterDown({ hp: 0, hpMax: 10 }), true);
  assert.equal(isMonsterDown({ hp: 1, hpMax: 10 }), false);
  assert.equal(isMonsterDown({ hp: 0, hpMax: 0 }), false);
  assert.equal(isMonsterDown(null), false);
});

test('a vez pula monstros caídos e nova rodada começa em quem está de pé', () => {
  const rows = [{ key: 'player:a' }, { key: 'monster:1' }, { key: 'monster:2' }];
  const down = r => r.key === 'monster:1';
  let r = pickNextParticipant(rows, 0, new Set(['player:a']), down);
  assert.equal(r.next.key, 'monster:2'); assert.equal(r.newRound, false);
  r = pickNextParticipant(rows, 2, new Set(['player:a', 'monster:2']), down);
  assert.equal(r.newRound, true); assert.equal(r.next.key, 'player:a');
  r = pickNextParticipant(rows, 0, new Set(['player:a']), () => true);
  assert.equal(r.newRound, true);
});

test('regressão: botões do banco de monstros usam listener delegado (não bind antes do render)', () => {
  assert.match(app, /monsterBox\.addEventListener\('click'/);
  assert.doesNotMatch(app, /querySelectorAll\('\[data-monster-damage\]'\)/);
  assert.doesNotMatch(app, /querySelectorAll\('\[data-dup-m\]'\)/);
  for (const attr of ['editM', 'monsterDamage', 'roundM', 'rollMAtk', 'rollMDmg', 'dupM', 'delM']) {
    assert.match(app, new RegExp(`d\\.${attr}!==undefined`), `handler ${attr}`);
  }
});

test('combate: ações do monstro, ocultar e desfazer existem na tela do Mestre', () => {
  for (const a of ['data-combat-monster-hp', 'data-combat-monster-apply', 'data-combat-monster-undo',
    'data-combat-monster-atk', 'data-combat-monster-dmg', 'data-combat-monster-hide', 'combatRollMonsterInit', 'combatCopyQty']) {
    assert.ok(app.includes(a), a);
  }
  assert.match(app, /entry\.hidden===true&&state\.session\?\.role!=='master'/);
});
