import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignMapPage } from '../../src/campaignMap.js';
import { readFileSync } from 'node:fs';

const state = {
  campaignMap: { regions: [{ id: 'r1', name: 'Distrito <Norte>', points: '100,100 150,90 170,130 120,145', color: '#77515b', description: 'Registro de teste' }] },
  players: [{ id: 'p1', name: 'Player <um>', mapMarkers: [{ id: 'm1', title: 'Casa "Vazia"', x: 120, y: 120, color: '#d7a65a' }] }]
};

test('mapa renderiza o conceito Atlas e mantém as regiões e marcadores antigos', () => {
  const html = campaignMapPage(state, false, { id: 'p1' });
  assert.match(html, /campaign-atlas/);
  assert.match(html, /campaignMapSvg/);
  assert.match(html, /data-region-id="r1"/);
  assert.match(html, /data-marker-id="m1"/);
  assert.match(html, /atlas-compass/);
  assert.match(html, /mapMarkerTitle/);
});

test('nomes e descrições do mapa são escapados antes de entrar no SVG/HTML', () => {
  const html = campaignMapPage(state, false, { id: 'p1' });
  assert.match(html, /Distrito &lt;Norte&gt;/);
  assert.doesNotMatch(html, /<polygon[^>]*Distrito <Norte>/);
  assert.match(html, /Casa &quot;Vazia&quot;/);
  assert.match(html, /Player &lt;um&gt;/);
});

test('painel do Mestre preserva ferramentas de geração e edição', () => {
  const html = campaignMapPage(state, true, null);
  assert.match(html, /generateMapShape/);
  assert.match(html, /saveMapRegion/);
  assert.doesNotMatch(html, /mapMarkerTitle/);
});


test('importação de mapa de 10 MiB otimiza antes de sincronizar o estado global', () => {
  const source = readFileSync(new URL('../../src/campaignMap.js', import.meta.url), 'utf8');
  assert.match(source, /file\.size>10\*1024\*1024/);
  assert.match(source, /async function optimizeImportedMap\(file\)/);
  assert.match(source, /optimizeImportedMap\(file\)\.then\(async src=>/);
  assert.match(source, /MAX_IMPORTED_MAP_DATA_URL_LENGTH = 2 \* 1024 \* 1024/);
  assert.ok(source.indexOf('optimizeImportedMap(file).then(async src=>') < source.indexOf('importedMap:src'), 'imagem deve ser otimizada antes de entrar no estado');
});

test('edição de região e remoção de asset não escondem falhas de sincronização', () => {
  const source = readFileSync(new URL('../../src/campaignMap.js', import.meta.url), 'utf8');
  assert.match(source, /Região salva neste dispositivo, mas a sincronização falhou/);
  assert.match(source, /Asset removido neste dispositivo, mas a sincronização falhou/);
  assert.doesNotMatch(source, /await saveGlobal\?\.\(\)\.catch\(\(\)=>\{\}\)/);
});
