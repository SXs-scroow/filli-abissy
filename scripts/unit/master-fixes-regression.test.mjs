import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../../supabase/functions/upload-asset/index.ts', import.meta.url), 'utf8');
const sync = fs.readFileSync(new URL('../../src/globalSync.js', import.meta.url), 'utf8');

function extract(src, startMarker) {
  const i = src.indexOf(startMarker);
  assert.ok(i >= 0, `não achei ${startMarker}`);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error('chaves não fecham');
}

test('upload-asset: formatos de vídeo do seletor (.m4v, .ogv, .ogg em tv/) são aceitos', () => {
  const ts = extract(edge, 'function typeForPath')
    .replace(/\(path: string, supplied: string\)/, '(path, supplied)')
    .replace(/: Record<string, string\[\]>/g, '')
    .replace(/: Record<string, string>/g, '');
  const typeForPath = new Function(`${ts}; return typeForPath;`)();
  assert.equal(typeForPath('tv/cena.mp4', 'video/mp4'), 'video/mp4');
  assert.equal(typeForPath('tv/cena.m4v', 'video/x-m4v'), 'video/mp4');
  assert.equal(typeForPath('tv/cena.ogv', 'video/ogg'), 'video/ogg');
  assert.equal(typeForPath('tv/cena.ogg', 'video/ogg'), 'video/ogg');
  assert.equal(typeForPath('tv/cena.mov', 'video/quicktime'), 'video/quicktime');
  assert.equal(typeForPath('music/faixa.ogg', 'audio/ogg'), 'audio/ogg');
  assert.equal(typeForPath('tv/cena.exe', 'application/octet-stream'), null);
  assert.equal(typeForPath('tv/cena.mp4', 'text/html'), null);
});

test('upload direto: função assina o envio e o cliente usa URL assinada acima de 4 MB', () => {
  assert.match(edge, /x-asset-mode"\) === "sign"/);
  assert.match(edge, /createSignedUploadUrl/);
  assert.match(sync, /uploadToSignedUrl/);
  assert.match(sync, /file\.size > 4 \* 1024 \* 1024/);
});

test('monstros: normalize não limita a Vida de monstros (Players de campanha: máx. 45) e o editor tem os campos novos', () => {
  assert.match(app, /isMonsterEntity\?9999:\(e\?\.campaignType==='slasher'\?9999:45\)/);
  for (const id of ['mSanMax', 'mSan', 'mDamage', 'mDesc', 'mAbilities', 'mPreset']) assert.ok(app.includes(`id="${id}"`), id);
});

test('rolagem de monstro: expressão de dano é interpretada corretamente', () => {
  const fn = extract(app, 'function rollDiceExpression');
  const roll = new Function('window', `${fn}; return rollDiceExpression;`)({ crypto: undefined });
  for (let i = 0; i < 200; i++) {
    const r = roll('2d6 + 3');
    assert.equal(r.rolls.length, 2);
    assert.ok(r.total >= 5 && r.total <= 15);
    assert.equal(r.label, '2d6+3');
  }
  assert.equal(roll('1d8-1').label, '1d8-1');
  assert.equal(roll('texto'), null);
});

test('Mestre não é bloqueado por limite de pontos: excedente vira pontos concedidos', () => {
  assert.doesNotMatch(app, /const err=validateAllocation\(e\);if\(err\)\{toast\(err\);return\}/);
  assert.match(app, /e\.attrBonusPoints=\(Number\(e\.attrBonusPoints\)\|\|0\)\+needA/);
  assert.match(app, /e\.skillBonusPoints=\(Number\(e\.skillBonusPoints\)\|\|0\)\+needS/);
});

test('senha do Player: troca por RPC própria, sem depender da sincronização', () => {
  const block = app.slice(app.indexOf('if(passwordToSet&&(passwordToSet.length<4'));
  assert.match(block.slice(0, 1200), /changePlayerPassword\(e\.id,passwordToSet\)/);
  assert.match(block.slice(0, 900), /catch\(err\)\{console\.error\('Sync do Player falhou/);
  assert.match(block, /4 a 72 caracteres/);
});

test('habilidades personalizadas: cadastro, edição e exibição na ficha', () => {
  assert.match(app, /function customAbilitiesFor\(p\)/);
  assert.match(app, /data-edit-ability/);
  assert.match(app, /customAbilitiesFor\(p\)\.map/);
});

test('menu Mais ferramentas: painel próprio no body, não fecha por resize/scroll e abre a aba escolhida', () => {
  assert.match(app, /function openMasterTools\(\)/);
  assert.match(app, /document\.body\.appendChild\(wrap\)/);
  assert.match(app, /function setAdminTab\(t\)/);
  assert.match(app, /id="masterMoreBtn"/);
  assert.doesNotMatch(app, /window\.addEventListener\('resize',close\)/);
  assert.match(app, /<div id="adminContent">\$\{adminTabContent\(adminTabCurrent\)\}<\/div>/);
});

test('Modo Sessão é a tela inicial do Player e mantém a cortina abrindo', () => {
  assert.match(app, /if\(view==='home'&&state\.session\?\.role==='player'\)view='immersive'/);
  assert.match(app, /function curtainReveal\(\)/);
  assert.match(app, /curtainRevealPending/);
  assert.match(app, /\$\{master\?'Início':CURTAIN_CLOSED_SVG\}/);
  assert.match(app, /if\(target==='home'&&state\.session\?\.role==='player'\)\{if\(!curtainBusy\)curtainTransition/);
  assert.doesNotMatch(app, /\?'Início':'Informações básicas'/);
  const css = fs.readFileSync(new URL('../../styles-bloodborne.css', import.meta.url), 'utf8');
  assert.match(css, /\.curtain-fx\.instant/);
});

test('Modo Sessão mostra só atributos e perícias com pontos, com o valor ao lado', () => {
  const fn = extract(app, 'function immTrainedPanel');
  const esc = x => String(x);
  const attrs = { Corpo: 3, Mente: 0, Força: 2 }, skills = { Luta: 4, Furtividade: 0, Medicina: 1 };
  const panel = new Function('allAttrs', 'allSkills', 'effectiveAttr', 'effectiveSkill', 'uiAttrIcon', 'uiSkillIcon', 'esc', 'MAX_ATTR', 'MAX_SKILL',
    `${fn}; return immTrainedPanel;`)(
    () => Object.keys(attrs), () => Object.keys(skills), (p, a) => attrs[a], (p, s) => skills[s], () => '', () => '', esc, 8, 15);
  const html = panel({});
  assert.match(html, />\s*Corpo<\/span><b>3<\/b>/);
  assert.match(html, />\s*Força<\/span><b>2<\/b>/);
  assert.match(html, />\s*Luta<\/span><b>4<\/b>/);
  assert.match(html, />\s*Medicina<\/span><b>1<\/b>/);
  assert.doesNotMatch(html, /Mente/);
  assert.doesNotMatch(html, /Furtividade/);
});

test('Modo Sessão: layout em coluna lateral + principal, folha de estilo própria e movimento reduzido', () => {
  assert.match(app, /<div class="imm-layout"><aside class="imm-rail"/);
  assert.match(app, /<\/aside><div class="imm-main"><nav class="imm-tabs">/);
  const main = fs.readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /import '\.\.\/styles-session\.css'/);
  const css = fs.readFileSync(new URL('../../styles-session.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.imm-chip::after/);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'chaves balanceadas');
});

test('controlador de sessão: tela do Mestre separa quem está na sessão de quem está fora', () => {
  assert.match(app, /const members=\(state\.players\|\|\[\]\)\.filter\(isMember\)/);
  assert.match(app, /Na sessão \(\$\{members\.length\}\)/);
  assert.match(app, /Fora da sessão \(\$\{outsiders\.length\}\)/);
  assert.match(app, /id="combatNewSessionEmpty"/);
  assert.match(app, /'FORA DESTA SESSÃO'/);
});

test('aviso de vez: vibra, toca sinal padrão e avisa quando você é o próximo', () => {
  assert.match(app, /function playTurnChime\(kind='turn'\)/);
  assert.match(app, /alertVibrate\(\[120,60,120,60,220\]\);playTurnAlertSound\('turn'\)/);
  assert.match(app, /alertVibrate\(\[90\]\);playTurnAlertSound\('next'\);toast\('Prepare-se: você é o próximo\.'\)/);
  assert.match(app, /alertVibrate\(\[180,90,180\]\);\s*playTurnAlertSound\('hurt'\)/);
  assert.match(app, /id="turnVibrateEnabled"/);
  assert.match(app, /id="turnChimeEnabled"/);
});

test('sinal de vez: som próprio tem prioridade; sem som próprio toca o padrão, a menos que desligado', () => {
  const fn = (() => {
    const i = app.indexOf('function playTurnAlertSound');
    let depth = 0;
    for (let k = app.indexOf('{', i); k < app.length; k++) {
      if (app[k] === '{') depth++;
      else if (app[k] === '}' && --depth === 0) return app.slice(i, k + 1);
    }
  })();
  const run = (cfg) => {
    const log = [];
    class FakeAudio { constructor() { this.src = ''; this.currentTime = 0; } play() { log.push('custom:' + this.src); return Promise.resolve(); } }
    const f = new Function('player', 'turnAlertAudioEl', 'Audio', 'playTurnChime', `${fn}; return playTurnAlertSound;`)(
      () => ({ turnAlertSound: cfg }), null, FakeAudio, k => log.push('chime:' + k));
    f('next');
    return log;
  };
  assert.deepEqual(run({ enabled: true, url: 'x.mp3' }), ['custom:x.mp3']);
  assert.deepEqual(run({ enabled: false, url: '' }), ['chime:next']);
  assert.deepEqual(run({ enabled: false, url: '', chimeOff: true }), []);
  assert.deepEqual(run(undefined), ['chime:next']);
});
