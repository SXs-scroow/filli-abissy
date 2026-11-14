import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { campaignArchivePage } from '../../src/campaignArchive.js';

const sample = [{
  id: 'entry-1', kind: 'evidence', title: 'A pista <oculta>', content: 'O símbolo aponta para a igreja.',
  occurred_at: '2026-11-14T18:30:00Z', location: 'Distrito Norte', tags: ['ritual'],
  visibility: 'master', revision: 2, linked_player_id: 'p1', visible_player_ids: ['p1']
}];

 test('Arquivo do Mestre oferece operações, histórico e controle de visibilidade', () => {
  const html = campaignArchivePage({ items: sample, isMaster: true, players: [{ id: 'p1', name: 'Jogador Um' }] });
  assert.match(html, /data-archive-new/);
  assert.match(html, /data-archive-edit="entry-1"/);
  assert.match(html, /data-archive-history="entry-1"/);
  assert.match(html, /data-archive-delete="entry-1"/);
  assert.match(html, /Somente Mestre/);
  assert.match(html, /Grupo selecionado/);
  assert.match(html, /Jogadores autorizados/);
  assert.match(html, /Jogador Um/);
});

test('visão do Player é somente leitura e não apresenta controles de segredo', () => {
  const html = campaignArchivePage({ items: sample, isMaster: false });
  assert.match(html, /somente registros compartilhados/i);
  assert.doesNotMatch(html, /data-archive-new|data-archive-edit|data-archive-history|data-archive-delete/);
  assert.doesNotMatch(html, /archiveEditorBackdrop|archiveVisiblePlayers|visible_player_ids/);
  assert.doesNotMatch(html, /Somente Mestre|Grupo selecionado|Jogador específico/);
});

test('conteúdo vindo do banco e nomes de jogadores são escapados no HTML', () => {
  const html = campaignArchivePage({
    items: [{ ...sample[0], title: '<script>alert(1)</script>', content: '<img src=x onerror=alert(1)>', tags: ['<svg onload=alert(1)>'] }],
    isMaster: true,
    players: [{ id: 'p1', name: '<b>Jogador</b>' }]
  });
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;svg onload=alert\(1\)&gt;/);
  assert.match(html, /&lt;b&gt;Jogador&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('migração protege registros privados e exige autenticação por token próprio', () => {
  const migration = readFileSync(new URL('../../supabase/migrations/20261114160000_campaign_archive.sql', import.meta.url), 'utf8');
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.a_profecia_campaign_archive from public, anon, authenticated/i);
  assert.match(migration, /s := public\.a_profecia_auth\(p_token\)/i);
  assert.match(migration, /s\.role is distinct from 'master'/i);
  assert.match(migration, /s\.player_id = any\(a\.visible_player_ids\)/i);
  assert.match(migration, /to_jsonb\(rows\) - 'visible_player_ids' - 'created_by'/i);
  assert.doesNotMatch(migration, /insert into public\.a_profecia_global|update public\.a_profecia_global/i);
});

test('aplicação importa o módulo visual e registra a notificação realtime sem payload privado', () => {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  const sync = readFileSync(new URL('../../src/globalSync.js', import.meta.url), 'utf8');
  assert.match(app, /campaignArchivePage, bindCampaignArchive/);
  assert.match(app, /msg\.event==='campaign-archive-changed'/);
  assert.match(sync, /'campaign-archive-changed'/);
  assert.match(sync, /a_profecia_campaign_archive_list/);
  assert.match(sync, /a_profecia_campaign_archive_save/);
});

test('Mestre consegue consultar e restaurar registros arquivados sem expor esse modo ao Player', () => {
  const archived = { ...sample[0], deleted_at: '2026-11-14T19:00:00Z', revision: 3 };
  const masterHtml = campaignArchivePage({ items: [archived], isMaster: true, showArchived: true });
  const playerHtml = campaignArchivePage({ items: [archived], isMaster: false, showArchived: false });
  assert.match(masterHtml, /Ver arquivados|Voltar aos ativos/);
  assert.match(masterHtml, /Arquivado/);
  assert.match(masterHtml, /data-archive-restore="entry-1"/);
  assert.match(masterHtml, /data-archive-history="entry-1"/);
  assert.doesNotMatch(playerHtml, /data-archive-restore|Voltar aos ativos|Ver arquivados/);
});

test('migração registra restauração, mantém conflito por revisão e limita Realtime a aviso sem conteúdo', () => {
  const migration = readFileSync(new URL('../../supabase/migrations/20261114160000_campaign_archive.sql', import.meta.url), 'utf8');
  assert.match(migration, /a_profecia_campaign_archive_restore/);
  assert.match(migration, /values\(old_row\.id,'restored'/);
  assert.match(migration, /old_row\.revision <> p_expected_revision/);
  assert.match(migration, /jsonb_build_object\('changed', true, 'at'/);
  assert.doesNotMatch(migration, /realtime\.send\(.*(title|content|visible_player_ids)/is);
  assert.match(migration, /p_include_archived boolean default false/);
});

test('cache privado do Arquivo é apagado quando o token de sessão muda', () => {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  assert.match(app, /function ensureCampaignArchiveSession\(\)[\s\S]*campaignArchiveItems=\[\];campaignArchiveLoaded=false;campaignArchiveLoading=false;campaignArchiveError='';campaignArchiveShowDeleted=false/);
  assert.match(app, /function renderCore\(view='home'\)\{\s*ensureCampaignArchiveSession\(\);/);
  assert.match(app, /const requestToken=getAuthToken\(\)[\s\S]*if\(requestToken!==getAuthToken\(\)\)return campaignArchiveItems/);
});

test('entrega integrada preserva iniciativas de Players e criaturas da Central de Combate', () => {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../../styles-polish.css', import.meta.url), 'utf8');
  assert.match(app, /data-combat-participant-key/);
  assert.match(app, /data-combat-remove-monster/);
  assert.match(app, /initiative/);
  assert.match(styles, /\.combat-initiative-field/);
  assert.match(app, /campaignArchivePage, bindCampaignArchive/);
});
