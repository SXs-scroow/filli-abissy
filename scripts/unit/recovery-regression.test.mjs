import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('app.js', 'utf8');
const sync = readFileSync('src/globalSync.js', 'utf8');
const migrations = readFileSync('supabase/migrations/20261118170000_global_backup_repair.sql', 'utf8');

test('falha de gravação do backup local chega ao botão em vez de virar falso sucesso', () => {
  const localBackup = app.match(/async function saveLocalRecovery[\s\S]*?\n}\nconst PLAYER_SHEET_BACKUP_DB/)?.[0] || '';
  assert.match(localBackup, /catch\(e\)[\s\S]*?console\.warn\('Backup local de recuperação falhou:'/);
  assert.match(localBackup, /throw new Error\(`Backup local não foi criado:/);
  assert.match(app, /data-remote-recovery[\s\S]*?pushGlobalTracked\(globalPayload\(\)\)[\s\S]*?if\(!saved\?\.verified\)/);
  assert.match(app, /Falha ao consultar backups remotos:[\s\S]*?esc\(e\?\.message/);
  const recoveryBindings = app.slice(app.indexOf('async function bindRecovery'), app.indexOf('async function renderPlayerTrash'));
  assert.match(recoveryBindings, /makeRecoveryNow[\s\S]*?backupGlobal\(currentData,'backup-manual'\)/);
  assert.match(recoveryBindings, /catch\(e\)[\s\S]*?toast\(e\?\.message/);
});

test('salvar o estado global cria snapshot remoto do estado anterior antes do push', () => {
  assert.match(sync, /async function backupCurrentGlobalBeforePush[\s\S]*?await backupGlobal\(currentData,\s*'automatico-antes-de-salvar'\)/);
  assert.match(sync, /await backupCurrentGlobalBeforePush\(data\);[\s\S]*?for \(let attempt = 1; attempt <= 3; attempt\+\+\)/);
});

test('RPC de backup remoto só aceita Mestre, registra metadados e limita retenção', () => {
  assert.match(migrations, /create or replace function public\.a_profecia_backup_global\(\s*p_token text,\s*p_data jsonb,\s*p_label text\s*\)/i);
  assert.match(migrations, /s\.role is distinct from 'master'/i);
  assert.match(migrations, /'__backup'/i);
  assert.match(migrations, /limit 50/i);
  assert.match(migrations, /grant execute on function public\.a_profecia_backup_global\(text,\s*jsonb,\s*text\) to anon/i);
});
