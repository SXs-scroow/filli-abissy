/**
 * Teste de carga ponta a ponta (gravação + Realtime) com dados descartáveis.
 *
 * Cria fichas "__loadtest_<run>_<n>" já marcadas como excluídas (não aparecem na lista),
 * grava cada uma pelo mesmo RPC do site, mede quanto tempo o aviso "player-changed" leva
 * para chegar a N clientes Realtime independentes e valida a presença. No fim apaga tudo.
 * Nenhuma ficha real é lida ou alterada.
 */
export const LOADTEST_PREFIX = '__loadtest_';

function pct(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] : 0; }
export function summarize(values = []) {
  const s = [...values].sort((a, b) => a - b);
  return { samples: s.length, p50: s.length ? s[Math.floor((s.length - 1) * 0.5)] : 0, p95: pct(s, 0.95), max: s.length ? s[s.length - 1] : 0 };
}

export const E2E_LIMITS = { p95DeliveryMs: 3000, p95WriteMs: 3000, presenceMs: 5000 };

/** Uma linha por etapa, com o valor medido e o limite, para mostrar na tela qual etapa estourou. */
export function describeStages(m, limits = {}) {
  const lim = { ...E2E_LIMITS, ...limits };
  const mark = (ok) => (ok ? 'ok' : 'ACIMA DO LIMITE');
  const out = [];
  out.push(`conexão Realtime: ${m.connect.ok}/${m.clients} clientes${m.connect.retried ? ` (${m.connect.retried} após nova tentativa)` : ''}, p95 ${m.connect.latency?.p95 ?? 0} ms`);
  out.push(m.presence.converged ? `presença: ${m.presence.ms} ms (limite ${lim.presenceMs} ms, ${mark(m.presence.ms <= lim.presenceMs)})` : 'presença: não convergiu');
  out.push(`gravação: p95 ${m.writes.latency.p95} ms (limite ${lim.p95WriteMs} ms, ${mark(m.writes.latency.p95 <= lim.p95WriteMs)})`);
  out.push(`aviso de Realtime: ${m.delivery.received}/${m.delivery.expected} entregues, p95 ${m.delivery.latency.p95} ms (limite ${lim.p95DeliveryMs} ms, ${mark(m.delivery.latency.p95 <= lim.p95DeliveryMs)})`);
  return out;
}

export function evaluateEndToEnd(m, limits = {}) {
  const lim = { ...E2E_LIMITS, ...limits };
  const reasons = [];
  if (!m.connect.ok) return { verdict: 'inconclusive', reasons: ['nenhum cliente Realtime conseguiu conectar (rede ou Realtime indisponível)'], stages: describeStages(m, lim) };
  if (!m.writes.ok) return { verdict: 'inconclusive', reasons: [`nenhuma gravação concluiu${m.errors[0] ? `: ${m.errors[0]}` : ''}`], stages: describeStages(m, lim) };
  if (m.connect.failed > 0) reasons.push(`${m.connect.failed} de ${m.clients} clientes não conectaram ao Realtime, mesmo após nova tentativa`);
  if (!m.presence.converged) reasons.push('a presença não chegou a todos os clientes');
  else if (m.presence.ms > lim.presenceMs) reasons.push(`a presença levou ${m.presence.ms} ms para convergir (limite ${lim.presenceMs} ms)`);
  if (m.writes.failed > 0) reasons.push(`${m.writes.failed} gravações falharam${m.errors[0] ? `: ${m.errors[0]}` : ''}`);
  if (m.delivery.received < m.delivery.expected) reasons.push(`${m.delivery.expected - m.delivery.received} de ${m.delivery.expected} avisos de Realtime não chegaram`);
  if (m.delivery.latency.p95 > lim.p95DeliveryMs) reasons.push(`aviso de Realtime com p95 de ${m.delivery.latency.p95} ms (limite ${lim.p95DeliveryMs} ms)`);
  if (m.writes.latency.p95 > lim.p95WriteMs) reasons.push(`gravação com p95 de ${m.writes.latency.p95} ms (limite ${lim.p95WriteMs} ms)`);
  const expectedClean = m.cleanupExpected ?? m.writes.uniqueIds;
  if (!m.cleanup || m.cleanup.error) reasons.push(`a limpeza falhou: fichas ${LOADTEST_PREFIX}${m.runId}_* podem ter sobrado${m.cleanup?.error ? ` (${m.cleanup.error})` : ''}`);
  else if (Number(m.cleanup.players) !== expectedClean) reasons.push(`limpeza apagou ${m.cleanup.players} de ${expectedClean} fichas de teste`);
  const hints = [];
  if (m.delivery.received < m.delivery.expected) hints.push('DICA: avisos perdidos indicam limite de mensagens/s do plano Realtime do Supabase ou Realtime desligado para a tabela; confira Project Settings → Realtime e o trigger a_profecia_players_realtime.');
  if (!m.presence.converged || m.presence.ms > lim.presenceMs) hints.push('DICA: presença lenta costuma ser rede/WebSocket do aparelho de teste, não do site.');
  if (m.writes.latency.p95 > lim.p95WriteMs) hints.push('DICA: gravação lenta costuma ser distância até a região do Supabase; compare em outra rede.');
  return { verdict: reasons.length ? 'failed' : 'passed', reasons: [...reasons, ...hints], stages: describeStages(m, lim) };
}

export async function runEndToEndProbe(deps, options = {}) {
  const {
    clients = 15, rows = 10, waves = 2, writeConcurrency = 4,
    connectTimeoutMs = 10000, presenceTimeoutMs = 10000, deliveryTimeoutMs = 8000, onStage = () => {},
  } = options;
  const now = deps.now || (() => globalThis.performance?.now?.() ?? Date.now());
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const runId = deps.runId || Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  const idFor = (j) => `${LOADTEST_PREFIX}${runId}_${j}`;
  const m = {
    runId, clients, rows, waves,
    connect: { ok: 0, failed: 0, retried: 0, latency: summarize() },
    presence: { converged: false, ms: null },
    writes: { ok: 0, failed: 0, uniqueIds: 0, latency: summarize() },
    delivery: { expected: 0, received: 0, latency: summarize() },
    cleanup: null, cleanupExpected: 0, errors: [],
  };

  // Pré-checagem: confirma que a limpeza existe e que a sessão é de Mestre ANTES de criar qualquer dado.
  try { await deps.cleanup(runId); }
  catch (error) { return { verdict: 'inconclusive', reasons: [`a função de limpeza não respondeu: ${String(error?.message || error)}`], metrics: m }; }

  const handles = [];
  const events = [];
  const okIds = new Set();
  const createdIds = new Set();
  const writeLog = [];
  let verdictInfo;
  try {
    onStage(`Conectando ${clients} clientes Realtime...`);
    const connectLat = [];
    const connectOnce = async (i, h) => {
      h.client = deps.createRealtimeClient();
      h.ch = h.client.channel('a-profecia-players-events');
      h.ch.on('broadcast', { event: 'player-changed' }, (msg) => {
        const id = String(msg?.payload?.id || '');
        if (id.startsWith(`${LOADTEST_PREFIX}${runId}_`)) events.push({ client: i, id, op: String(msg?.payload?.op || '').toLowerCase(), at: now() });
      });
      const t0 = now();
      const res = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), connectTimeoutMs);
        h.ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(true); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { clearTimeout(timer); resolve(false); }
        });
      });
      if (!res) {
        try { await h.client.removeChannel(h.ch); } catch { /* ignora */ }
        try { h.client.realtime?.disconnect?.(); } catch { /* ignora */ }
      }
      return { ok: res, ms: Math.round(now() - t0) };
    };
    await Promise.all(Array.from({ length: clients }, async (_, i) => {
      const h = { client: null, ch: null, pres: null, connected: false };
      handles.push(h);
      // Uma segunda tentativa evita reprovar por um soluço de rede; só falha quem não conecta de verdade.
      for (let attempt = 1; attempt <= 2 && !h.connected; attempt++) {
        const res = await connectOnce(i, h);
        if (res.ok) { h.connected = true; m.connect.ok++; if (attempt === 2) m.connect.retried++; connectLat.push(res.ms); }
      }
      if (!h.connected) m.connect.failed++;
    }));
    m.connect.latency = summarize(connectLat);
    const live = handles.filter((h) => h.connected);

    if (live.length) {
      onStage('Testando presença online entre os clientes...');
      const seen = new Map();
      await Promise.all(live.map((h, i) => new Promise((resolve) => {
        h.pres = h.client.channel(`a-profecia-presence-loadtest-${runId}`, { config: { presence: { key: `c${i}` } } });
        const upd = () => { try { seen.set(i, Object.keys(h.pres.presenceState()).length); } catch { /* ignora */ } };
        h.pres.on('presence', { event: 'sync' }, upd);
        h.pres.on('presence', { event: 'join' }, upd);
        const timer = setTimeout(resolve, connectTimeoutMs);
        h.pres.subscribe((status) => { if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); } });
      })));
      const tracked = now();
      await Promise.all(live.map((h, i) => Promise.resolve(h.pres?.track?.({ client: i, at: Date.now() })).catch(() => {})));
      while (now() - tracked < presenceTimeoutMs) {
        if (live.every((_, i) => (seen.get(i) || 0) >= live.length)) { m.presence.converged = true; m.presence.ms = Math.round(now() - tracked); break; }
        await sleep(100);
      }
    }

    const base = Date.now();
    const deletedAt = new Date().toISOString();
    // Aquecimento: a primeira chamada ao servidor costuma ser mais lenta e não representa o uso normal.
    // Esta gravação não entra nas medições; só garante que o caminho de gravação e de Realtime já está quente.
    const warmId = idFor('warm');
    onStage('Aquecendo o servidor antes de medir...');
    try {
      await deps.savePlayer({ id: warmId, login: warmId, data: { name: 'Aquecimento', _loadtest: true, wave: 0 }, syncStamp: base, deletedAt });
      createdIds.add(warmId);
      const warmStart = now();
      while (now() - warmStart < 1500) {
        const got = new Set(events.filter((e) => e.id === warmId).map((e) => e.client));
        if (got.size >= live.length) break;
        await sleep(50);
      }
    } catch (error) { if (m.errors.length < 3) m.errors.push(`aquecimento: ${String(error?.message || error)}`); }
    onStage(`Gravando ${rows} fichas descartáveis em ${waves} rodadas...`);
    const writeLat = [];
    for (let w = 1; w <= waves; w++) {
      // Concorrência limitada: uma mesa real não grava 10 fichas no mesmo instante; 150+ avisos simultâneos
      // medem o limite de mensagens do plano Realtime, não a experiência de jogo.
      let next = 0;
      const worker = async () => {
        while (next < rows) {
          const j = next++;
          const id = idFor(j);
          const t0 = now();
          try {
            await deps.savePlayer({ id, login: id, data: { name: `Teste ${j}`, _loadtest: true, wave: w }, syncStamp: base + w * 1000 + j, deletedAt });
            const t1 = now();
            writeLat.push(Math.round(t1 - t0)); m.writes.ok++; okIds.add(id); createdIds.add(id);
            writeLog.push({ id, op: w === 1 ? 'insert' : 'update', t0, t1 });
          } catch (error) { m.writes.failed++; if (m.errors.length < 3) m.errors.push(String(error?.message || error)); }
        }
      };
      await Promise.all(Array.from({ length: Math.max(1, Math.min(rows, writeConcurrency)) }, worker));
    }
    m.writes.latency = summarize(writeLat);
    m.writes.uniqueIds = okIds.size;
    m.cleanupExpected = createdIds.size;

    onStage('Aguardando os avisos de Realtime chegarem...');
    m.delivery.expected = live.length * writeLog.length;
    const keyOf = (c, id, op) => `${c}|${id}|${op}`;
    const index = () => { const map = new Map(); for (const e of events) { const k = keyOf(e.client, e.id, e.op); if (!map.has(k)) map.set(k, e.at); } return map; };
    const waitStart = now();
    while (now() - waitStart < deliveryTimeoutMs) { if (index().size >= m.delivery.expected) break; await sleep(100); }
    const got = index();
    const dl = [];
    for (const h of live) {
      const i = handles.indexOf(h);
      for (const wr of writeLog) { const at = got.get(keyOf(i, wr.id, wr.op)); if (at !== undefined) { m.delivery.received++; dl.push(Math.max(0, Math.round(at - wr.t1))); } }
    }
    m.delivery.latency = summarize(dl);
  } catch (error) {
    m.errors.push(String(error?.message || error));
  } finally {
    onStage('Apagando as fichas de teste...');
    try { m.cleanup = await deps.cleanup(runId); } catch (error) { m.cleanup = { error: String(error?.message || error) }; }
    for (const h of handles) {
      for (const ch of [h.ch, h.pres]) { if (ch) { try { await h.client.removeChannel(ch); } catch { /* ignora */ } } }
      try { h.client.realtime?.disconnect?.(); } catch { /* ignora */ }
    }
  }
  verdictInfo = evaluateEndToEnd(m);
  return { ...verdictInfo, metrics: m };
}

/** Monta o teste para o navegador real: clientes Realtime independentes e o login de Mestre atual. */
export function buildBrowserE2E() {
  return {
    async run(options = {}) {
      const [globalSync, supa, cfg] = await Promise.all([import('./globalSync.js'), import('@supabase/supabase-js'), import('./supabaseConfig.js')]);
      const { supabase, getAuthToken } = globalSync;
      const token = getAuthToken?.();
      if (!supabase || !token) return { verdict: 'inconclusive', reasons: ['é preciso estar logado como Mestre no servidor'], metrics: null };
      const deps = {
        createRealtimeClient: () => supa.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          realtime: { params: { eventsPerSecond: 50 } },
        }),
        savePlayer: async ({ id, login, data, syncStamp, deletedAt }) => {
          const { error } = await supabase.rpc('a_profecia_player_save', { p_token: token, p_id: id, p_login: login, p_data: data, p_sync_updated_at: syncStamp, p_deleted_at: deletedAt });
          if (error) throw new Error(error.message || String(error));
        },
        cleanup: async (runId) => {
          const { data, error } = await supabase.rpc('a_profecia_loadtest_cleanup', { p_token: token, p_run: runId });
          if (error) throw new Error(error.message || String(error));
          return data;
        },
      };
      const main = await runEndToEndProbe(deps, { clients: 15, rows: 10, waves: 2, ...options });
      if (main.verdict !== 'passed') return main;
      options.onStage?.('Meta de 15 clientes aprovada. Repetindo com 30 clientes...');
      const extended = await runEndToEndProbe(deps, { clients: 30, rows: 10, waves: 2, ...options });
      return { ...main, extended: { verdict: extended.verdict, reasons: extended.reasons, metrics: extended.metrics } };
    },
  };
}
