import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../../src/ashenAI.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../api/ashen-ai.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');

test('Ashen AI aparece no Modo Sessão e não substitui a IA de Manutenção', () => {
  assert.match(app, /import \{ bindAshenAI \} from '\.\/src\/ashenAI\.js'/);
  assert.match(app, /data-ashen-ai-root/);
  assert.match(app, /bindAshenAI\(/);
  assert.match(main, /maintenanceAgent\.js/);
});

test('a interface exige confirmação explícita antes de executar uma ação proposta', () => {
  assert.match(ui, /data-ashen-ai-confirm/);
  assert.match(ui, /data-ashen-ai-cancel/);
  assert.match(ui, /pendingActions\.map/);
  assert.match(ui, /CONFIRME INDIVIDUALMENTE/);
  assert.match(ui, /executeAction\(action\)/);
});

test('a rota do Ashen é autenticada e usa o motor de validação de ações', () => {
  assert.match(api, /requireMaster\(req\)/);
  assert.match(api, /parseAshenProviderResponse/);
  assert.match(api, /SUPABASE_URL/);
});

test('a interface oferece voz com ativação manual e mantém a confirmação das ações', () => {
  assert.match(ui, /data-ashen-ai-voice-input/);
  assert.match(ui, /data-ashen-ai-voice-toggle/);
  assert.match(ui, /SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(ui, /voiceDraft/);
  assert.match(ui, /data-ashen-ai-confirm/);
});

test('a aplicação conecta a memória persistente e as ações expandidas ao motor', () => {
  assert.match(app, /listAshenMemories/);
  assert.match(app, /saveAshenMemory/);
  assert.match(app, /archiveAshenMemory/);
  assert.match(app, /manage_inventory/);
  assert.match(app, /record_campaign_event/);
  assert.match(api, /roll_skill_check/);
});
