/**
 * Real Supabase end-to-end load probe for Ashen Testimony.
 *
 * SAFETY: this deliberately has NO production defaults. It writes a temporary
 * HP value to 15 disposable staging Players and restores the original values
 * in finally{}. Run only against an isolated staging Supabase project with
 * disposable test accounts.
 */
import { performance } from 'node:perf_hooks';

let createClient;

const REQUIRED_CONFIRMATION = 'I_CONFIRM_DISPOSABLE_STAGING_ONLY';
const USER_COUNT = 15;
const REALTIME_TOPIC = 'a-profecia-players-events';
const REALTIME_EVENT = 'player-changed';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function unwrap(result, action) {
  if (result?.error) {
    const error = new Error(`${action}: ${result.error.message || 'erro Supabase'}`);
    error.code = result.error.code;
    throw error;
  }
  return result?.data;
}

function stampOf(row) {
  const dataStamp = Number(row?.data?._syncUpdatedAt) || 0;
  const dbStamp = row?.updated_at ? new Date(row.updated_at).getTime() : 0;
  return Math.max(dataStamp, Number.isFinite(dbStamp) ? dbStamp : 0);
}

function summarize(values) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { count: 0, p50Ms: null, p95Ms: null, maxMs: null };
  const pct = q => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  return { count: sorted.length, p50Ms: Number(pct(0.50).toFixed(1)), p95Ms: Number(pct(0.95).toFixed(1)), maxMs: Number(sorted.at(-1).toFixed(1)) };
}

async function waitUntil(predicate, timeoutMs, description) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (predicate()) return;
    await sleep(100);
  }
  throw new Error(`Tempo esgotado aguardando: ${description}`);
}

async function authenticatePlayer(url, key, credentials, index) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const loginResult = await client.rpc('a_profecia_player_login', {
    p_login: credentials.login,
    p_password: credentials.password
  });
  const auth = unwrap(loginResult, `Login do usuário de teste #${index + 1}`);
  if (!auth?.token) throw new Error(`Login do usuário de teste #${index + 1} não retornou token.`);
  const who = unwrap(await client.rpc('a_profecia_whoami', { p_token: auth.token }), `Validação de sessão #${index + 1}`);
  if (who?.role !== 'player' || !who?.player_id) throw new Error(`Conta de teste #${index + 1} não é um Player válido.`);
  const roster = unwrap(await client.rpc('a_profecia_list_players', { p_token: auth.token }), `Leitura inicial #${index + 1}`);
  const ownRow = (Array.isArray(roster) ? roster : []).find(row => String(row?.id) === String(who.player_id));
  if (!ownRow || ownRow.deleted_at) throw new Error(`Ficha de teste #${index + 1} não está ativa ou não pôde ser lida.`);
  if (!ownRow.data || typeof ownRow.data !== 'object' || !Number.isFinite(Number(ownRow.data.hp))) {
    throw new Error(`Ficha de teste #${index + 1} não possui HP numérico para o teste reversível.`);
  }
  return { client, token: auth.token, id: String(who.player_id), login: String(credentials.login), baseline: ownRow };
}

async function saveHp(testUser, hp, syncStamp, action) {
  const originalData = testUser.baseline.data || {};
  const keyStamps = originalData._keyAt && typeof originalData._keyAt === 'object' ? originalData._keyAt : {};
  const data = {
    ...originalData,
    hp,
    _syncUpdatedAt: syncStamp,
    _keyAt: { ...keyStamps, hp: syncStamp }
  };
  return unwrap(await testUser.client.rpc('a_profecia_player_save', {
    p_token: testUser.token,
    p_id: testUser.id,
    p_login: testUser.login,
    p_data: data,
    p_sync_updated_at: syncStamp,
    p_deleted_at: null
  }), action);
}

function attachRealtime(testUser, index) {
  const seenIds = new Set();
  const errors = [];
  let subscribed = false;
  const channel = testUser.client
    .channel(REALTIME_TOPIC)
    .on('broadcast', { event: REALTIME_EVENT }, message => {
      const id = String(message?.payload?.id || '').trim();
      if (id) seenIds.add(id);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') subscribed = true;
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        errors.push(String(status));
      }
    });
  return { channel, client: testUser.client, seenIds, errors, index, isSubscribed: () => subscribed };
}

async function main() {
  if (process.env.ASHEN_STAGING_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(`Bloqueado por segurança. Defina ASHEN_STAGING_CONFIRM=${REQUIRED_CONFIRMATION} somente para um projeto Supabase descartável de homologação.`);
  }
  const url = requiredEnv('ASHEN_TEST_SUPABASE_URL');
  const key = requiredEnv('ASHEN_TEST_SUPABASE_ANON_KEY');
  const masterPassword = requiredEnv('ASHEN_TEST_MASTER_PASSWORD');
  let credentials;
  try { credentials = JSON.parse(requiredEnv('ASHEN_TEST_USERS_JSON')); }
  catch { throw new Error('ASHEN_TEST_USERS_JSON deve ser um JSON válido com objetos {"login":"...","password":"..."}.'); }
  if (!Array.isArray(credentials) || credentials.length < USER_COUNT) {
    throw new Error(`Forneça pelo menos ${USER_COUNT} contas de Player descartáveis em ASHEN_TEST_USERS_JSON.`);
  }
  credentials = credentials.slice(0, USER_COUNT);
  if (credentials.some(c => !c || !String(c.login || '').trim() || !String(c.password || ''))) {
    throw new Error('Cada conta de teste precisa de login e senha.');
  }
  if (new Set(credentials.map(c => String(c.login).toLowerCase())).size !== USER_COUNT) {
    throw new Error(`As ${USER_COUNT} contas de teste precisam ter logins distintos.`);
  }
  if (!/^https:\/\//i.test(url)) throw new Error('ASHEN_TEST_SUPABASE_URL precisa usar HTTPS.');

  // Import only after the staging guard and all required inputs pass.
  ({ createClient } = await import('@supabase/supabase-js'));

  // Isolated clients approximate independent browser sessions, not just 15 Promise.all calls on one client.
  const users = [];
  const subscriptions = [];
  let masterClient = null;
  let masterToken = '';
  const latencies = [];
  const restoreErrors = [];
  const failures = [];
  let writesStarted = false;
  let realtimeConfirmedClients = 0;
  const testStartedAt = new Date().toISOString();

  try {
    for (let i = 0; i < USER_COUNT; i++) users.push(await authenticatePlayer(url, key, credentials[i], i));
    if (new Set(users.map(user => user.id)).size !== USER_COUNT) throw new Error('As contas de teste não mapeiam para 15 fichas distintas.');

    masterClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    masterToken = unwrap(await masterClient.rpc('a_profecia_master_login', { p_password: masterPassword }), 'Login do Mestre de teste');
    if (!masterToken) throw new Error('O login do Mestre de homologação não retornou token.');
    const masterWho = unwrap(await masterClient.rpc('a_profecia_whoami', { p_token: masterToken }), 'Validação da sessão de Mestre');
    if (masterWho?.role !== 'master') throw new Error('A credencial de validação não é uma conta Mestre.');

    for (let i = 0; i < users.length; i++) subscriptions.push(attachRealtime(users[i], i));
    await waitUntil(() => subscriptions.every(sub => sub.isSubscribed()), 20000, 'as 15 sessões Realtime ficarem SUBSCRIBED');

    const baseNow = Date.now();
    const probes = users.map((user, index) => {
      const originalHp = Number(user.baseline.data.hp);
      const maxHp = Math.max(1, Number(user.baseline.data.hpMax) || 65);
      const probeHp = originalHp < maxHp ? originalHp + 1 : Math.max(0, originalHp - 1);
      if (probeHp === originalHp) throw new Error(`Ficha de teste #${index + 1} não permite variar HP temporariamente.`);
      const syncStamp = Math.max(baseNow + index, stampOf(user.baseline) + 100, Number(user.baseline.data?._keyAt?.hp) + 100 || 0);
      return { user, index, originalHp, probeHp, syncStamp, startedAt: 0, endedAt: 0, error: null };
    });

    writesStarted = true;
    const concurrentStart = performance.now();
    await Promise.all(probes.map(async probe => {
      probe.startedAt = performance.now();
      try {
        await saveHp(probe.user, probe.probeHp, probe.syncStamp, `Gravação concorrente #${probe.index + 1}`);
        probe.endedAt = performance.now();
        latencies.push(probe.endedAt - probe.startedAt);
      } catch (error) {
        probe.endedAt = performance.now();
        probe.error = String(error?.message || error);
        failures.push(`Escrita #${probe.index + 1}: ${probe.error}`);
      }
    }));
    const concurrentWriteMs = performance.now() - concurrentStart;

    // Each token verifies its own saved row through the same restricted RPC used by the application.
    const readResults = await Promise.allSettled(probes.map(async probe => {
      const rows = unwrap(await probe.user.client.rpc('a_profecia_get_players_by_ids', {
        p_token: probe.user.token, p_ids: [probe.user.id]
      }), `Leitura pós-gravação #${probe.index + 1}`);
      const row = (Array.isArray(rows) ? rows : []).find(item => String(item?.id) === probe.user.id);
      if (!row || Number(row.data?.hp) !== probe.probeHp) throw new Error(`HP não confirmou para sessão #${probe.index + 1}.`);
      return row;
    }));
    readResults.forEach((result, index) => { if (result.status === 'rejected') failures.push(`Leitura pós-gravação #${index + 1}: ${String(result.reason?.message || result.reason)}`); });

    // The master reads the complete roster after all independent users write concurrently.
    const masterRoster = unwrap(await masterClient.rpc('a_profecia_list_players', { p_token: masterToken }), 'Leitura final do roster pelo Mestre');
    const masterById = new Map((Array.isArray(masterRoster) ? masterRoster : []).map(row => [String(row.id), row]));
    for (const probe of probes) {
      const row = masterById.get(probe.user.id);
      if (!row || Number(row.data?.hp) !== probe.probeHp) failures.push(`Roster do Mestre não confirmou a gravação da sessão #${probe.index + 1}.`);
    }

    try {
      await waitUntil(() => subscriptions.every(sub => sub.seenIds.size >= USER_COUNT), 15000, 'cada sessão receber os 15 eventos Realtime de mudança');
    } catch (error) {
      const minimum = Math.min(...subscriptions.map(sub => sub.seenIds.size));
      failures.push(`${error.message}; menor total observado por uma sessão: ${minimum}/${USER_COUNT} eventos distintos.`);
    }
    realtimeConfirmedClients = subscriptions.filter(sub => sub.seenIds.size >= USER_COUNT).length;

    if (subscriptions.some(sub => sub.errors.length)) {
      subscriptions.forEach(sub => { if (sub.errors.length) failures.push(`Realtime sessão #${sub.index + 1}: ${sub.errors.join(', ')}`); });
    }

    const result = {
      test: 'ashen-staging-sync-load',
      startedAt: testStartedAt,
      finishedAt: new Date().toISOString(),
      scope: 'isolated staging; 15 independent Player sessions + 1 Master read session',
      targetUsers: USER_COUNT,
      independentSessions: users.length,
      concurrentWriteSuccesses: probes.filter(p => !p.error).length,
      concurrentWriteFailures: probes.filter(p => p.error).length,
      concurrentWriteTotalMs: Number(concurrentWriteMs.toFixed(1)),
      writeLatency: summarize(latencies),
      postWriteReadSuccesses: readResults.filter(r => r.status === 'fulfilled').length,
      postWriteReadFailures: readResults.filter(r => r.status === 'rejected').length,
      masterRosterConfirmations: probes.filter(p => masterById.has(p.user.id) && Number(masterById.get(p.user.id)?.data?.hp) === p.probeHp).length,
      realtimeClientsReceivingAllEvents: realtimeConfirmedClients,
      realtimeMinimumDistinctEvents: subscriptions.length ? Math.min(...subscriptions.map(sub => sub.seenIds.size)) : 0,
      pass: failures.length === 0 && probes.every(p => !p.error) && readResults.every(r => r.status === 'fulfilled') && realtimeConfirmedClients === USER_COUNT,
      failures
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exitCode = 1;
  } finally {
    // Always attempt to put each disposable staging ficha's original HP back.
    // A cleanup failure is surfaced as a test failure; it is never hidden.
    if (writesStarted) {
      const settled = await Promise.allSettled(users.map(async (user, index) => {
        const probe = user ? users[index] : null;
        if (!probe) return;
        const originalHp = Number(user.baseline.data.hp);
        const baseStamp = stampOf(user.baseline);
        const cleanupStamp = Math.max(Date.now(), baseStamp + 200000) + index;
        await saveHp(user, originalHp, cleanupStamp, `Restauração de limpeza #${index + 1}`);
      }));
      settled.forEach((item, index) => { if (item.status === 'rejected') restoreErrors.push(`Limpeza #${index + 1}: ${String(item.reason?.message || item.reason)}`); });
      const restoredReads = await Promise.allSettled(users.map(async (user, index) => {
        const rows = unwrap(await user.client.rpc('a_profecia_get_players_by_ids', { p_token: user.token, p_ids: [user.id] }), `Verificação da restauração #${index + 1}`);
        const row = (Array.isArray(rows) ? rows : []).find(item => String(item?.id) === user.id);
        if (!row || Number(row.data?.hp) !== Number(user.baseline.data.hp)) throw new Error(`HP original não foi confirmado para a ficha de teste #${index + 1}.`);
      }));
      restoredReads.forEach((item, index) => { if (item.status === 'rejected') restoreErrors.push(`Verificação da limpeza #${index + 1}: ${String(item.reason?.message || item.reason)}`); });
      if (restoreErrors.length) {
        console.error(JSON.stringify({ cleanup: 'FAILED', restoreErrors }, null, 2));
        process.exitCode = 1;
      } else {
        console.log(JSON.stringify({ cleanup: 'PASS', restoredDisposablePlayerHps: users.length }));
      }
    }
    await Promise.allSettled(subscriptions.map(sub => sub.client.removeChannel(sub.channel)));
    for (const user of users) {
      try { await user.client.removeAllChannels(); } catch {}
    }
    try { await masterClient?.removeAllChannels(); } catch {}
  }
}

main().catch(error => {
  console.error(`STAGING E2E ABORTADO: ${String(error?.message || error)}`);
  process.exitCode = 1;
});
