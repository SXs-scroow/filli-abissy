import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAshenSystemPrompt, buildCampaignContext } from '../../src/ashenAIContext.js';

const records = [
  { id: 'ev-1', kind: 'evidence', title: 'Fotografia no porão', content: 'A imagem mostra o padre ao lado de uma janela quebrada.', location: 'Porão da igreja', tags: ['padre', 'fotografia'], occurred_at: '2026-11-10T10:00:00Z', visibility: 'master' },
  { id: 'ev-2', kind: 'event', title: 'Desaparecimento do padre', content: 'O padre desapareceu depois da última missa.', location: 'Igreja', tags: ['padre'], occurred_at: '2026-11-08T10:00:00Z', visibility: 'master' },
  { id: 'ev-3', kind: 'document', title: 'Bilhete rasgado', content: 'Texto sem relação com o caso.', location: '', tags: [], occurred_at: '2026-11-01T10:00:00Z', visibility: 'master' },
];

test('prioriza registros que correspondem aos termos da pergunta', () => {
  const result = buildCampaignContext(records, 'O que sabemos sobre a fotografia do padre no porão?');
  assert.equal(result.records[0].id, 'ev-1');
  assert.ok(result.records.some((item) => item.id === 'ev-2'));
  assert.ok(!result.records.some((item) => item.id === 'ev-3'));
});

test('limita o contexto e remove campos internos que não devem ir ao modelo', () => {
  const noisy = Array.from({ length: 30 }, (_, i) => ({ ...records[0], id: `r-${i}`, content: 'x'.repeat(9000), visible_player_ids: ['player-secret'], created_by: 'internal' }));
  const result = buildCampaignContext(noisy, 'fotografia padre', { maxRecords: 4, maxChars: 5000 });
  assert.ok(result.records.length <= 4);
  assert.ok(result.characterCount <= 5000);
  assert.ok(!JSON.stringify(result).includes('visible_player_ids'));
  assert.ok(!JSON.stringify(result).includes('player-secret'));
});

test('retorna contexto vazio de forma explícita quando não há registros', () => {
  const result = buildCampaignContext([], 'quem é o padre?');
  assert.equal(result.records.length, 0);
  assert.equal(result.hasRelevantRecords, false);
});

test('inclui o diagnóstico de integridade como dado, nunca como instrução', () => {
  const prompt = buildAshenSystemPrompt(buildCampaignContext([], 'integridade'), 'geral', { campaign: { ok: false, duplicates: ['id-1'] } });
  assert.match(prompt, /DIAGNÓSTICO DE INTEGRIDADE DO SITE/);
  assert.match(prompt, /\"ok\":false/);
  assert.match(prompt, /dados não confiáveis/);
  assert.match(prompt, /Não afirme que executou reparos/);
});
