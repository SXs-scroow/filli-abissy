import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('nexus-start entra direto na transmissão sem depender do estado global já ter chegado', () => {
  assert.match(app, /event==='nexus-start'&&!nexusIsMaster\(\)\)\{state\.nexus=.*?active:true.*?nexusRetryCount=0;setTimeout\(\(\)=>nexusJoin\(\{force:true\}\)/);
});
test('a Tela da TV (?tv=1) tem camada de vídeo do Nexus e entra na transmissão', () => {
  const tv = app.slice(app.indexOf('function tvPage()'), app.indexOf('function tvStageMarkup'));
  assert.match(tv, /tv-nexus-layer[\s\S]*id="nexusPlayerVideo"/);
  assert.match(app, /function bindTvPage\(\)[\s\S]*?nexusJoin\(\{force:true\}\)/);
  assert.match(app, /if\(d\.includes\('nexus'\)\)\{if\(state\.nexus\?\.active&&!nexusRemoteStream\)nexusJoin/);
});
test('TV e celulares se identificam e recebem qualidades diferentes', () => {
  assert.match(app, /broadcastLive\('nexus-join',\{[^}]*kind:nexusIsTv\(\)\?'tv':'player'/);
  assert.match(app, /nexus-join'&&nexusIsMaster\(\)\)\{await nexusCreatePeer\(payload\.from,payload\.kind\)/);
  assert.match(app, /maxBitrate/);
});
test('TURN opcional é usado nos dois lados da conexão', () => {
  assert.equal((app.match(/new RTCPeerConnection\(\{iceServers:nexusIceServers\(\)\}\)/g) || []).length, 2);
  assert.doesNotMatch(app, /new RTCPeerConnection\(\{iceServers:\[\{urls:'stun/);
});
test('o espectador tenta reconectar sozinho e o vídeo recorre ao modo mudo se o som for bloqueado', () => {
  assert.match(app, /function nexusScheduleRetry/);
  assert.match(app, /v\.muted=true;v\.play\(\)/);
});
test('a central de testes exibe a verificação real e não oferece mais o teste "sem dados reais"', () => {
  const lt = fs.readFileSync(new URL('../../src/loadTest.js', import.meta.url), 'utf8');
  assert.match(lt, /verificationCardMarkup/);
  assert.doesNotMatch(lt, /Testar persistência sem dados reais/);
});
