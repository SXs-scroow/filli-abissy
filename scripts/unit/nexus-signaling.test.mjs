import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { waitForIceGatheringComplete } from '../../src/nexusSignaling.js';

class FakePeerConnection {
  iceGatheringState = 'gathering';
  listeners = new Set();
  addEventListener(name, listener) {
    if (name === 'icegatheringstatechange') this.listeners.add(listener);
  }
  removeEventListener(name, listener) {
    if (name === 'icegatheringstatechange') this.listeners.delete(listener);
  }
  completeGathering() {
    this.iceGatheringState = 'complete';
    for (const listener of [...this.listeners]) listener();
  }
}

test('Nexus waits for ICE candidates before sending the offer/answer', async () => {
  const pc = new FakePeerConnection();
  let settled = false;
  const pending = waitForIceGatheringComplete(pc, 100).then(value => {
    settled = true;
    return value;
  });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(settled, false, 'must not send an incomplete local description');
  pc.completeGathering();
  assert.equal(await pending, true);
  assert.equal(pc.listeners.size, 0, 'event listener must be removed after completion');
});

test('Nexus does not wait when ICE gathering already completed', async () => {
  const pc = new FakePeerConnection();
  pc.iceGatheringState = 'complete';
  assert.equal(await waitForIceGatheringComplete(pc, 100), true);
});

test('Nexus offerer and viewer both wait for gathered ICE before signaling', () => {
  const app = readFileSync('app.js', 'utf8');
  assert.match(app, /await waitForIceGatheringComplete\(pc\)/);
  assert.match(app, /await waitForIceGatheringComplete\(pc\)/g);
});

test('Nexus encerra a espera e retorna falha quando a coleta ICE expira', async () => {
  const pc = new FakePeerConnection();
  assert.equal(await waitForIceGatheringComplete(pc, 10), false);
  assert.equal(pc.listeners.size, 0, 'event listener must be removed after timeout');
});

test('Nexus aceita uma conexão sem suporte à API addEventListener', async () => {
  let handler = null;
  const pc = {
    iceGatheringState: 'gathering',
    onicegatheringstatechange: null,
  };
  const pending = waitForIceGatheringComplete(pc, 100);
  handler = pc.onicegatheringstatechange;
  pc.iceGatheringState = 'complete';
  handler();
  assert.equal(await pending, true);
  assert.equal(pc.onicegatheringstatechange, null);
});
