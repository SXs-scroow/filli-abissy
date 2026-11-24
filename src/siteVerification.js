/**
 * Verificação REAL do site.
 *
 * Regras deste módulo (existem para que ele nunca "passe" de mentira):
 *  - cada verificação toca o ambiente de verdade (rede, servidor, navegador, dados reais da campanha);
 *  - uma verificação que NÃO pôde rodar vira "não verificado" (skip) e impede o veredito APROVADO;
 *  - exceção, tempo esgotado ou resposta inesperada viram FALHA, com texto de "como corrigir";
 *  - o relatório final lista exatamente o que precisa ser mexido.
 * Tudo entra por parâmetro (deps) para que os testes provem que falhas são detectadas.
 */

export const STATUS = { OK: 'ok', FAIL: 'fail', WARN: 'warn', SKIP: 'skip' };
const ICON = { ok: '🟢', fail: '🔴', warn: '🟠', skip: '⚪' };
const LABEL = { ok: 'OK', fail: 'FALHOU', warn: 'ATENÇÃO', skip: 'NÃO VERIFICADO' };

export const TABLE_MIGRATIONS = {
  a_profecia_session_puzzles: '20261014120000_session_puzzles.sql',
  a_profecia_session_puzzle_attempts: '20261014120000_session_puzzles.sql',
  a_profecia_player_history: '20261005140000_player_history_and_field_merge.sql',
  a_profecia_player_master_secrets: '20260929150000_player_master_secret_effect.sql',
  a_profecia_player_points: '20261026000000_player_autobackup_and_dedicated_points.sql',
  a_profecia_campaign_archive: '20261114160000_campaign_archive.sql',
  a_profecia_ashen_memory: '20261118190000_ashen_ai_memory.sql',
  a_profecia_revoked_player_sessions: '20260926140000_security_hardening.sql'
};

export const API_ROUTES = ['/api/ashen-ai', '/api/maintenance-ai', '/api/resolve-spotify'];

class Skip extends Error {}
export const skip = reason => { throw new Skip(reason); };
const ok = (detail, evidence) => ({ status: STATUS.OK, detail, evidence });
const fail = (detail, fix, evidence) => ({ status: STATUS.FAIL, detail, fix, evidence });
const warn = (detail, fix, evidence) => ({ status: STATUS.WARN, detail, fix, evidence });

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`tempo esgotado (${Math.round(ms / 1000)} s) em: ${label}`)), ms); })
  ]).finally(() => clearTimeout(timer));
}
const msg = e => String(e?.message || e || 'erro desconhecido');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
function isLocalDevelopmentOrigin(location) {
  const host = String(location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
    || /^192\.168\./.test(host) || /^10\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

/* ------------------------------------------------------------------ */
/* Rolagens: valida o motor REAL (funções do app) contra o Manual.     */
/* ------------------------------------------------------------------ */
export function expectedPool(points, adv) {
  const pts = Math.max(0, Math.floor(Number(points)) || 0);
  const a = adv === 'adv' ? 1 : adv === 'dis' ? -1 : 0;
  return { count: Math.max(1, Math.min(3, Math.max(1, Math.min(3, pts)) + a)), bonus: Math.max(0, pts - 3) * 2 };
}
export const GRADE_CASES = [
  // [natural, total, DT, esperado]  — tabela da página Rolagens
  [10, 17, 20, 'Falha'], [10, 22, 20, 'Sucesso'], [10, 24, 20, 'Sucesso'], [10, 25, 20, 'Sucesso elevado'],
  [10, 29, 20, 'Sucesso elevado'], [10, 30, 20, 'Sucesso excepcional'], [10, 10, 20, 'Falha grave'], [10, 11, 20, 'Falha'],
  [20, 12, 20, 'Sucesso crítico'], [1, 40, 20, 'Falha crítica'], [10, 20, 20, 'Sucesso'], [10, 19, 20, 'Falha'], [10, 10, 0, '']
];

function rollChecks(deps) {
  const api = deps.rollApi;
  return [
    {
      id: 'roll-mode', area: 'Rolagens', title: 'Campanha usa o Manual de Rolagens (3d20, maior dado, +2 por ponto acima de 3)',
      run: async () => {
        if (!api) skip('o app não expôs o motor de rolagem para a verificação');
        const mode = api.mode();
        return mode === 'limit'
          ? ok('Modo ativo: Manual de Rolagens.')
          : warn(`Modo ativo é "${mode}" (sistema antigo).`, 'Mestre → Regras → "Rolagem de perícia" → escolher "Manual de Rolagens" → Salvar limites.');
      }
    },
    {
      id: 'roll-pool', area: 'Rolagens', title: 'Quantidade de dados e bônus corretos (pontos 0–12, normal/vantagem/desvantagem)',
      run: async () => {
        if (!api) skip('motor de rolagem indisponível');
        const bad = [];
        let samples = 0;
        for (let pts = 0; pts <= 12; pts++) for (const adv of ['', 'adv', 'dis']) {
          const exp = expectedPool(pts, adv);
          for (let i = 0; i < 200; i++) {
            const r = api.pool(pts, adv); samples++;
            const max = Math.max(...r.dice);
            if (r.dice.length !== exp.count) bad.push(`${pts} pts ${adv || 'normal'}: ${r.dice.length} dados (esperado ${exp.count})`);
            else if (r.bonus !== exp.bonus) bad.push(`${pts} pts ${adv || 'normal'}: bônus +${r.bonus} (esperado +${exp.bonus})`);
            else if (r.natural !== max) bad.push(`${pts} pts: usou ${r.natural}, mas o maior dado era ${max}`);
            else if (r.dice.some(d => !Number.isInteger(d) || d < 1 || d > 20)) bad.push(`${pts} pts: dado fora de 1–20 (${r.dice.join(',')})`);
            if (bad.length) break;
          }
          if (bad.length) break;
        }
        return bad.length
          ? fail(`Motor de rolagem diverge do Manual: ${bad[0]}.`, 'Corrigir rollPoolLimit() em app.js: dados = clamp(pontos,1,3) ± vantagem (mín 1, máx 3); bônus = max(0, pontos−3)×2; vale o maior dado.', bad.slice(0, 5))
          : ok(`${samples} rolagens simuladas no motor real, todas conforme o Manual.`);
      }
    },
    {
      id: 'roll-random', area: 'Rolagens', title: 'Aleatoriedade dos d20 (média do maior dado em 1d, 2d e 3d)',
      run: async () => {
        if (!api) skip('motor de rolagem indisponível');
        const N = 4000, want = { 1: 10.5, 2: 13.825, 3: 15.4875 }, tol = { 1: 0.7, 2: 0.6, 3: 0.5 }, off = [];
        for (const k of [1, 2, 3]) {
          let sum = 0;
          for (let i = 0; i < N; i++) sum += api.pool(k, '').natural;
          const mean = sum / N;
          if (Math.abs(mean - want[k]) > tol[k]) off.push(`${k}d20: média ${mean.toFixed(2)} (esperado ≈ ${want[k]})`);
        }
        return off.length ? fail(`Distribuição suspeita: ${off.join('; ')}.`, 'Conferir o gerador de números (crypto.getRandomValues) e se algum dado está viciado/limitado.', off) : ok(`${N * 3} rolagens: médias dentro do esperado.`);
      }
    },
    {
      id: 'roll-grade', area: 'Rolagens', title: 'Graus de sucesso/falha e críticos contra a DT',
      run: async () => {
        if (!api) skip('motor de rolagem indisponível');
        const bad = GRADE_CASES.filter(([n, v, dt, exp]) => api.grade(n, v, dt) !== exp).map(([n, v, dt, exp]) => `dado ${n}, total ${v}, DT ${dt}: veio "${api.grade(n, v, dt)}", esperado "${exp}"`);
        return bad.length ? fail(`${bad.length} caso(s) de grau divergem da página Rolagens.`, 'Ajustar rollGrade() em app.js para seguir a tabela: ≥+10 excepcional, ≥+5 elevado, ≥0 sucesso, <0 falha, ≤−10 falha grave; 20 natural = crítico; todos 1 = falha crítica.', bad) : ok(`${GRADE_CASES.length} casos conferidos.`);
      }
    },
    {
      id: 'roll-real-data', area: 'Rolagens', title: 'Fichas reais: pontos de perícia/atributo válidos e rolagem calculável',
      run: async () => {
        if (!api) skip('motor de rolagem indisponível');
        const players = Array.isArray(deps.state?.players) ? deps.state.players : [];
        if (!players.length) skip('não há fichas na campanha para conferir');
        const problems = [], sample = [];
        for (const p of players) {
          for (const sk of api.skills()) {
            const v = api.skillPoints(p, sk);
            if (!Number.isFinite(v) || v < 0) { problems.push(`${p.name || p.login}: perícia ${sk} = ${v}`); continue; }
            if (v > 0 && sample.length < 4) { const e = expectedPool(v, ''); sample.push(`${p.name || p.login} · ${sk} ${v} pts → ${e.count}d20${e.bonus ? '+' + e.bonus : ''}`); }
          }
          for (const at of api.attrs()) {
            const v = api.attrPoints(p, at);
            if (!Number.isFinite(v) || v < 0) problems.push(`${p.name || p.login}: atributo ${at} = ${v}`);
          }
        }
        return problems.length ? fail(`${problems.length} valor(es) inválido(s) em fichas reais (impedem rolar).`, 'Abrir a ficha do Player citado (Mestre → Players → Editar) e corrigir o valor; salvar.', problems.slice(0, 8))
          : ok(`${players.length} ficha(s) conferida(s).`, sample);
      }
    }
  ];
}

/* ------------------------------------------------------------------ */
export function buildChecks(deps) {
  const env = deps.env || globalThis;
  const role = deps.role || null;
  const url = deps.supabaseUrl || '';
  const key = deps.supabaseKey || '';
  const checks = [];
  const add = c => checks.push({ critical: true, timeoutMs: 15000, ...c });

  /* ---- Navegador ---- */
  add({
    id: 'env-secure', area: 'Navegador', title: 'Página em HTTPS (exigido por transmissão de tela, WebRTC e área de transferência)',
    run: async () => {
      const secure = env.isSecureContext ?? (env.location?.protocol === 'https:');
      if (secure) return ok(`Contexto seguro (${env.location?.origin || ''}).`);
      if (isLocalDevelopmentOrigin(env.location)) skip('teste executado em endereço local HTTP; HTTPS deve ser validado no deploy público da Vercel');
      return fail('Página aberta sem HTTPS.', 'Abrir o site pelo endereço https:// (Vercel). Sem HTTPS o Nexus não consegue transmitir a tela.');
    }
  });
  add({
    id: 'env-localstorage', area: 'Navegador', title: 'Armazenamento local grava, lê e apaga',
    run: async () => {
      const ls = env.localStorage; if (!ls) return fail('localStorage indisponível.', 'Desativar modo anônimo/bloqueio de dados do site neste navegador.');
      const k = `__ashen_verify_${Date.now()}`;
      ls.setItem(k, 'ok'); const read = ls.getItem(k); ls.removeItem(k);
      return read === 'ok' && ls.getItem(k) === null ? ok('Gravação, leitura e remoção confirmadas.') : fail('Leitura diferente do que foi gravado.', 'Limpar dados do site e tentar de novo; navegador pode estar bloqueando armazenamento.');
    }
  });
  add({
    id: 'env-indexeddb', area: 'Navegador', title: 'IndexedDB (backups locais) grava e lê',
    run: async () => {
      const idb = env.indexedDB; if (!idb) return fail('IndexedDB indisponível.', 'Os backups locais de emergência não funcionarão; usar navegador sem modo privado.');
      const name = `__ashen_verify_${Date.now()}`;
      const db = await new Promise((res, rej) => { const r = idb.open(name, 1); r.onupgradeneeded = () => r.result.createObjectStore('t'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('open falhou')); });
      try {
        await new Promise((res, rej) => { const tx = db.transaction('t', 'readwrite'); tx.objectStore('t').put('v', 'k'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
        const got = await new Promise((res, rej) => { const q = db.transaction('t').objectStore('t').get('k'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
        return got === 'v' ? ok('Gravação e leitura confirmadas.') : fail('IndexedDB devolveu valor diferente.', 'Limpar dados do site.');
      } finally { db.close(); try { idb.deleteDatabase(name); } catch {} }
    }
  });
  add({
    id: 'env-quota', area: 'Navegador', title: 'Espaço de armazenamento do navegador', critical: false,
    run: async () => {
      const est = await env.navigator?.storage?.estimate?.(); if (!est?.quota) skip('o navegador não informa a cota');
      const used = pct(est.usage, est.quota);
      return used >= 80 ? warn(`${used}% da cota usada.`, 'Apagar mídias/backups antigos do site ou liberar espaço no aparelho.') : ok(`${used}% da cota usada.`);
    }
  });

  /* ---- Versão publicada ---- */
  add({
    id: 'deploy', area: 'Versão publicada', title: 'HTML publicado, versão e cabeçalhos de cache',
    run: async () => {
      if (!deps.runDeploymentCacheCheck) skip('verificação de deploy indisponível');
      const r = await deps.runDeploymentCacheCheck();
      const bad = (r.checks || []).filter(c => !c.ok);
      return r.ok ? ok(`Release ${r.release || '?'} • build ${r.buildId || '?'}.`) : fail(`${bad.length} item(ns) de deploy/cache com problema.`, 'Corrigir os itens abaixo no deploy (vercel.json / build) e publicar de novo.', bad.map(c => `${c.name}${c.detail ? ': ' + c.detail : ''}`));
    }
  });

  /* ---- Servidor ---- */
  add({
    id: 'srv-config', area: 'Servidor', title: 'Supabase configurado',
    run: async () => (deps.remoteEnabled && url && key) ? ok(url) : fail('Supabase não configurado: o site roda só local e nada sincroniza.', 'Conferir src/supabaseConfig.js (URL e chave publicável) e republicar.')
  });
  add({
    id: 'srv-reach', area: 'Servidor', title: 'Servidor Supabase responde (latência medida)',
    run: async () => {
      if (!url) skip('sem URL do Supabase');
      const t0 = Date.now();
      const res = await env.fetch(`${url}/rest/v1/`, { headers: { apikey: key }, cache: 'no-store' });
      const ms = Date.now() - t0;
      if (res.status >= 500) return fail(`Servidor respondeu HTTP ${res.status}.`, 'Verificar o painel do Supabase: projeto pausado, em manutenção ou sem recursos.');
      return ms > 2000 ? warn(`Resposta em ${ms} ms (lenta).`, 'Rede lenta ou projeto Supabase hibernando; repetir o teste.') : ok(`HTTP ${res.status} em ${ms} ms.`);
    }
  });
  add({
    id: 'srv-auth', area: 'Servidor', title: 'Sessão autenticada é aceita pelo servidor',
    run: async () => {
      if (!deps.getAuthToken?.()) return fail('Não há sessão autenticada.', 'Sair e entrar novamente como Mestre.');
      const who = await deps.authCheck();
      return who ? ok('Servidor reconheceu a sessão.', typeof who === 'object' ? [`papel: ${who.role || '?'}`] : undefined) : fail('Servidor recusou a sessão.', 'Sair e entrar novamente (a sessão expirou ou foi revogada).');
    }
  });
  add({
    id: 'srv-global', area: 'Servidor', title: 'Estado global da campanha lê e contém as regras de rolagem',
    run: async () => {
      const row = await deps.fetchGlobal(); const data = row?.data || row;
      if (!data || typeof data !== 'object') return fail('O servidor não devolveu o estado global.', 'Conferir a função a_profecia_get_global e a linha id=main em a_profecia_global.');
      const r = data.characterRules;
      if (!r) return warn('O estado global não tem characterRules salvo.', 'Mestre → Regras → Salvar limites (grava o Manual de Rolagens no servidor).');
      if (Number(r.rollSystemV) !== 2 || (r.skillRollMode && r.skillRollMode !== 'limit')) return warn(`Servidor com rollSystemV=${r.rollSystemV ?? '—'}, modo=${r.skillRollMode || '—'}.`, 'Mestre → Regras → escolher "Manual de Rolagens" → Salvar limites, para todos receberem o novo sistema.');
      return ok('Servidor tem o Manual de Rolagens (rollSystemV 2).');
    }
  });
  add({
    id: 'srv-players', area: 'Servidor', title: 'Fichas do servidor × fichas deste aparelho',
    run: async () => {
      if (role !== 'master') skip('comparação completa exige login de Mestre');
      const rows = await deps.fetchPlayers();
      const srv = new Set((rows || []).filter(r => !r.deleted_at).map(r => String(r.id)));
      const loc = new Set((deps.state?.players || []).map(p => String(p.id)));
      const onlyLocal = [...loc].filter(i => !srv.has(i)), onlyServer = [...srv].filter(i => !loc.has(i));
      if (onlyLocal.length || onlyServer.length) return warn(`Divergência: ${onlyLocal.length} só aqui, ${onlyServer.length} só no servidor.`, 'Mestre → Players → "Verificar sincronização real" (botão da seção Sincronização) e conferir de novo.', [...onlyLocal.map(i => `só local: ${i}`), ...onlyServer.map(i => `só servidor: ${i}`)].slice(0, 8));
      return ok(`${srv.size} ficha(s) idênticas em ID nos dois lados.`);
    }
  });
  for (const [table, mig] of Object.entries(TABLE_MIGRATIONS)) {
    add({
      id: `db-${table}`, area: 'Banco de dados', title: `Tabela ${table} existe`, timeoutMs: 10000,
      run: async () => {
        if (!url) skip('sem URL do Supabase');
        const res = await env.fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' });
        if (res.status === 404) return fail(`Tabela ausente no banco (HTTP 404).`, `Rodar a migração supabase/migrations/${mig} no SQL Editor do Supabase.`);
        if (res.status >= 500) return warn(`HTTP ${res.status} ao consultar.`, 'Repetir; se persistir, ver logs do Supabase.');
        return ok(`Existe (HTTP ${res.status}${res.status === 200 ? '' : ', protegida por RLS'}).`);
      }
    });
  }
  add({
    id: 'db-puzzles', area: 'Terminais', title: 'Terminais: lista real carrega e traz o controle de visibilidade',
    run: async () => {
      const sid = deps.state?.combatSession?.sessionId; if (!sid) skip('não há sessão de combate/mesa ativa para listar terminais');
      const list = await deps.listSessionPuzzles(sid);
      if (!Array.isArray(list)) return fail('A lista de terminais não veio como lista.', 'Reaplicar 20261118090000_session_puzzle_master_visibility.sql e 20261027120000_session_puzzles_repair.sql.');
      if (role === 'master' && list.length && list.some(p => !('visibleToPlayers' in p))) return fail('Terminais sem o campo visibleToPlayers.', 'Rodar a migração 20261118090000_session_puzzle_master_visibility.sql.');
      return ok(`${list.length} terminal(is) lido(s) do servidor.`);
    }
  });
  add({
    id: 'db-archive', area: 'Banco de dados', title: 'Arquivo da campanha (RPC) responde', critical: false,
    run: async () => { if (role !== 'master') skip('só Mestre'); const r = await deps.listCampaignArchive(); return Array.isArray(r) || Array.isArray(r?.items) ? ok('RPC respondeu.') : fail('Resposta inesperada.', 'Rodar 20261114160000_campaign_archive.sql.'); }
  });
  add({
    id: 'db-ashen-memory', area: 'Banco de dados', title: 'Memória da Ashen AI (RPC) responde', critical: false,
    run: async () => { if (role !== 'master') skip('só Mestre'); const r = await deps.listAshenMemories('', 1); return Array.isArray(r) || Array.isArray(r?.items) ? ok('RPC respondeu.') : fail('Resposta inesperada.', 'Rodar 20261118190000_ashen_ai_memory.sql.'); }
  });
  add({
    id: 'sync-queue', area: 'Sincronização', title: 'Fila de envio de fichas vazia (nada preso no aparelho)',
    run: async () => {
      let n = deps.pendingPlayerSyncCount?.() ?? 0;
      if (n > 0) { await deps.flushPendingPlayerSync?.(); n = deps.pendingPlayerSyncCount?.() ?? 0; }
      const h = deps.syncHealth?.();
      if (n > 0) return fail(`${n} alteração(ões) de ficha presas na fila após tentar enviar.`, 'Conferir conexão e sessão; usar "Verificar sincronização real". Não limpar o navegador antes de enviar.');
      if (h?.state === 'error') return warn(`Última sincronização global falhou: ${h.message}.`, 'Aguardar nova tentativa automática ou salvar de novo; se persistir, ver conexão.');
      return ok('Fila vazia.');
    }
  });
  add({
    id: 'e2e-write', area: 'Servidor', title: 'Gravação real + Realtime ponta a ponta (fichas descartáveis)', timeoutMs: 120000,
    run: async () => {
      if (role !== 'master') skip('exige login de Mestre');
      if (!deps.e2e?.run) skip('sonda ponta a ponta indisponível');
      if (deps.confirmE2E && !(await deps.confirmE2E())) skip('você não confirmou a gravação de fichas descartáveis');
      const r = await deps.e2e.run({ onStage: deps.onStage });
      if (r?.verdict === 'passed') return ok('Gravação e entrega Realtime confirmadas.', r.stages);
      if (r?.verdict === 'failed') return fail('Falha na gravação/Realtime.', 'Conferir migrações de Realtime (20261027110000_player_realtime_repair.sql) e se Realtime está ligado no Supabase.', r.reasons);
      return warn('Teste inconclusivo.', 'Repetir com a mesa parada.', r?.reasons);
    }
  });

  /* ---- Nexus / TV ---- */
  const wantsShare = role === 'master';
  add({
    id: 'nx-display', area: 'Nexus / TV', title: 'Navegador do Mestre consegue transmitir tela/janela',
    run: async () => {
      const can = !!env.navigator?.mediaDevices?.getDisplayMedia;
      if (can) return ok('getDisplayMedia disponível.');
      if (!env.isSecureContext && isLocalDevelopmentOrigin(env.location)) skip('captura de tela bloqueada pelo contexto HTTP local; validar em HTTPS num computador compatível');
      return wantsShare ? fail('Este navegador não transmite tela.', 'O Mestre deve transmitir de um computador com Chrome/Edge/Firefox atualizado em HTTPS (celular não captura a tela).') : skip('só é necessário no aparelho do Mestre');
    }
  });
  add({
    id: 'nx-loopback', area: 'Nexus / TV', title: 'WebRTC real: vídeo codifica, trafega e decodifica (teste em loopback)', timeoutMs: 15000,
    run: async () => {
      const RTC = env.RTCPeerConnection; if (!RTC) return fail('RTCPeerConnection indisponível.', 'Usar navegador atualizado; TVs antigas podem não suportar.');
      const doc = env.document; if (!doc?.createElement) skip('sem DOM');
      const canvas = doc.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const g = canvas.getContext('2d'); if (!canvas.captureStream) return fail('captureStream indisponível.', 'Navegador sem suporte a captura de vídeo.');
      let n = 0; const timer = setInterval(() => { g.fillStyle = `hsl(${(n += 9) % 360},70%,50%)`; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.fillText(String(n), 20 + (n % 500), 180); }, 66);
      const a = new RTC({ iceServers: deps.iceServers?.() || [] }), b = new RTC({ iceServers: deps.iceServers?.() || [] });
      const video = doc.createElement('video'); video.muted = true; video.playsInline = true;
      try {
        const stream = canvas.captureStream(15);
        stream.getTracks().forEach(t => a.addTrack(t, stream));
        a.onicecandidate = e => e.candidate && b.addIceCandidate(e.candidate).catch(() => {});
        b.onicecandidate = e => e.candidate && a.addIceCandidate(e.candidate).catch(() => {});
        const got = new Promise(res => { b.ontrack = ev => res(ev.streams[0]); });
        await a.setLocalDescription(await a.createOffer());
        await b.setRemoteDescription(a.localDescription);
        await b.setLocalDescription(await b.createAnswer());
        await a.setRemoteDescription(b.localDescription);
        video.srcObject = await got; await video.play().catch(() => {});
        const t0 = Date.now();
        while (Date.now() - t0 < 9000) {
          const frames = video.getVideoPlaybackQuality?.().totalVideoFrames || 0;
          if (video.videoWidth > 0 && (frames > 3 || !video.getVideoPlaybackQuality)) return ok(`Vídeo ${video.videoWidth}x${video.videoHeight} recebido (${frames} quadros).`);
          await new Promise(r => setTimeout(r, 200));
        }
        return fail('A conexão WebRTC abriu mas nenhum quadro chegou.', 'Atualizar o navegador; desativar extensões de VPN/bloqueio de WebRTC neste aparelho.');
      } finally { clearInterval(timer); try { a.close(); b.close(); } catch {} video.srcObject = null; }
    }
  });
  add({
    id: 'nx-stun', area: 'Nexus / TV', title: 'Rede alcança o servidor STUN (necessário para players fora do Wi-Fi do Mestre)', timeoutMs: 12000,
    run: async () => {
      const RTC = env.RTCPeerConnection; if (!RTC) skip('sem WebRTC');
      const pc = new RTC({ iceServers: deps.iceServers?.() || [] }); const kinds = new Set();
      pc.onicecandidate = e => { if (e.candidate) { const m = /typ (\w+)/.exec(e.candidate.candidate); if (m) kinds.add(m[1]); } };
      try {
        pc.createDataChannel('v'); await pc.setLocalDescription(await pc.createOffer());
        const t0 = Date.now(); while (Date.now() - t0 < 6000 && !kinds.has('srflx') && !kinds.has('relay')) await new Promise(r => setTimeout(r, 200));
      } finally { pc.close(); }
      return (kinds.has('srflx') || kinds.has('relay')) ? ok(`Candidatos: ${[...kinds].join(', ')}.`) : fail('Nenhum candidato público (srflx/relay): STUN/UDP bloqueado.', 'Liberar UDP/STUN (stun.l.google.com:19302) no roteador/firewall, ou configurar um servidor TURN em Mestre → Nexus.', [...kinds]);
    }
  });
  add({
    id: 'nx-turn', area: 'Nexus / TV', title: 'Servidor TURN configurado (para players em 4G/5G ou redes restritas)', critical: false,
    run: async () => {
      const has = (deps.iceServers?.() || []).some(s => /^turns?:/i.test([].concat(s.urls)[0] || ''));
      return has ? ok('TURN configurado.') : warn('Sem TURN: players em rede móvel/CGNAT podem não receber o vídeo.', 'Criar um TURN (ex.: Metered/Cloudflare/Twilio) e colar URL, usuário e senha em Mestre → Nexus → Servidor TURN.');
    }
  });
  add({
    id: 'nx-live', area: 'Nexus / TV', title: 'Canal ao vivo entrega mensagem a OUTRO aparelho (cliente independente)', timeoutMs: 15000,
    run: async () => {
      if (!deps.createSecondClient || !deps.broadcastLive) skip('cliente independente indisponível');
      const nonce = `ping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const second = deps.createSecondClient();
      let channel;
      try {
        const received = new Promise(res => {
          channel = second.channel(deps.liveChannelName, { config: { broadcast: { self: false } } });
          channel.on('broadcast', { event: 'verification-ping' }, m => { if (m?.payload?.nonce === nonce) res(Date.now()); });
        });
        await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('o segundo cliente não conseguiu assinar o canal')), 8000); channel.subscribe(s => { if (s === 'SUBSCRIBED') { clearTimeout(to); res(); } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(to); rej(new Error(`canal: ${s}`)); } }); });
        const t0 = Date.now();
        const sent = await deps.broadcastLive('verification-ping', { nonce });
        if (sent !== 'ok') return fail(`Envio não confirmado (${sent}).`, 'Ligar Realtime no Supabase (Project Settings → API → Realtime) e conferir limites do plano.');
        const at = await Promise.race([received, new Promise(r => setTimeout(() => r(0), 6000))]);
        return at ? ok(`Entregue em ${at - t0} ms.`) : fail('Mensagem enviada, mas o outro cliente não recebeu em 6 s.', 'Sem entrega ao vivo a TV e os Players não recebem o Nexus. Conferir Realtime no Supabase e bloqueio de WebSocket (wss) na rede.');
      } finally { try { await second.removeChannel(channel); } catch {} try { second.realtime?.disconnect?.(); } catch {} }
    }
  });
  add({
    id: 'nx-tv', area: 'Nexus / TV', title: 'Endereço da Tela da TV (?tv=1) abre',
    run: async () => {
      const base = `${env.location.origin}${env.location.pathname}?tv=1`;
      const res = await env.fetch(base, { cache: 'no-store' }); const html = await res.text();
      return res.ok && html.includes('id="root"') ? ok(base) : fail(`HTTP ${res.status} ou página inesperada.`, 'Conferir o deploy: o index.html precisa abrir também com ?tv=1.', [base]);
    }
  });
  add({
    id: 'nx-state', area: 'Nexus / TV', title: 'Estado de transmissão coerente (sem "ativo" preso)', critical: false,
    run: async () => {
      if (role !== 'master') skip('só Mestre');
      return deps.state?.nexus?.active && !deps.nexusHasLocalStream?.() ? warn('Servidor marca transmissão ativa, mas este aparelho não está transmitindo.', 'Abrir a aba Nexus e tocar em "Parar transmissão" (ou transmitir de novo).') : ok('Coerente.');
    }
  });

  /* ---- Rotas da API do site ---- */
  for (const route of API_ROUTES) {
    add({
      id: `api-${route}`, area: 'APIs do site', title: `Rota ${route} publicada e viva`, critical: route === '/api/ashen-ai', timeoutMs: 15000,
      run: async () => {
        const res = await env.fetch(`${env.location.origin}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' });
        const ct = res.headers?.get?.('content-type') || '';
        if ((res.status === 404 || ct.includes('text/html')) && isLocalDevelopmentOrigin(env.location)) skip('rotas serverless da Vercel não são servidas pelo Vite dev; validar após deploy ou com Vercel CLI');
        if (res.status === 404 || ct.includes('text/html')) return fail(`Rota ausente (HTTP ${res.status}, ${ct || 'sem content-type'}).`, 'Conferir se o deploy inclui api/*.js e vercel.json; validar os logs de Functions da Vercel.');
        if (res.status >= 500) return fail(`A rota existe mas quebrou (HTTP ${res.status}).`, 'Abrir Vercel → Deployments → Functions → Logs; normalmente falta variável de ambiente (chave da IA).');
        return ok(`Viva (HTTP ${res.status} ao chamar sem credenciais, como esperado).`);
      }
    });
  }

  /* ---- Dados e desempenho ---- */
  add({
    id: 'data-integrity', area: 'Dados da campanha', title: 'Integridade das fichas locais (duplicadas, sem ID, inválidas)',
    run: async () => {
      if (!deps.campaignIntegrityReport) skip('relatório de integridade indisponível');
      const r = deps.campaignIntegrityReport();
      const bad = [...(r.duplicates || []), ...(r.missingId || []), ...(r.invalid || [])];
      return bad.length ? fail(`${bad.length} problema(s) nas fichas.`, 'Mestre → Recuperação de dados → restaurar backup / corrigir as fichas listadas.', bad.slice(0, 8).map(x => typeof x === 'string' ? x : JSON.stringify(x))) : ok(`${r.players ?? (deps.state?.players || []).length} ficha(s) íntegras.`);
    }
  });
  add({
    id: 'perf', area: 'Desempenho', title: 'Desempenho local (memória, DOM, tarefas longas)', critical: false,
    run: async () => {
      if (!deps.perf) skip('diagnóstico indisponível');
      const s = await deps.perf();
      return s.assessment?.level === 'attention' ? fail('Desempenho crítico.', 'Fechar abas pesadas; reduzir imagens/vídeos grandes nas fichas.', s.assessment.findings?.map(f => f.metric)) : s.assessment?.level === 'watch' ? warn('Alguns indicadores acima do ideal.', 'Ver a medição de desempenho detalhada.', s.assessment.findings?.map(f => f.metric)) : ok('Sem alertas.');
    }
  });

  checks.push(...rollChecks(deps).map(c => ({ critical: true, timeoutMs: 20000, ...c })));
  return checks;
}

export async function runSiteVerification(deps, { onProgress } = {}) {
  const checks = buildChecks(deps);
  const results = [];
  const startedAt = Date.now();
  for (const c of checks) {
    onProgress?.({ phase: 'start', check: c, done: results.length, total: checks.length });
    const t0 = Date.now(); let r;
    try { r = await withTimeout(c.run(), c.timeoutMs, c.title); }
    catch (e) {
      r = e instanceof Skip ? { status: STATUS.SKIP, detail: e.message }
        : { status: STATUS.FAIL, detail: `Erro durante o teste: ${msg(e)}`, fix: 'Ver o detalhe do erro; se citar rede/servidor, repetir com conexão estável e conferir o Supabase.' };
    }
    const full = { id: c.id, area: c.area, title: c.title, critical: c.critical, ms: Date.now() - t0, ...r };
    results.push(full);
    onProgress?.({ phase: 'end', check: c, result: full, done: results.length, total: checks.length });
  }
  const count = s => results.filter(r => r.status === s).length;
  const failed = count('fail'), warned = count('warn'), skipped = results.filter(r => r.status === 'skip');
  const criticalSkipped = skipped.filter(r => r.critical).length;
  const verdict = failed ? 'failed' : criticalSkipped ? 'incomplete' : warned ? 'attention' : 'passed';
  return {
    version: deps.version || '', at: new Date().toISOString(), role: deps.role || 'desconhecido', durationMs: Date.now() - startedAt,
    userAgent: deps.env?.navigator?.userAgent || '', origin: deps.env?.location?.origin || '',
    verdict, counts: { total: results.length, ok: count('ok'), fail: failed, warn: warned, skip: skipped.length, criticalSkipped }, results
  };
}

const VERDICT_TEXT = {
  passed: '🟢 APROVADO — todas as verificações foram executadas de verdade e passaram.',
  attention: '🟠 APROVADO COM ATENÇÃO — nada quebrou, mas há pontos a melhorar.',
  incomplete: '⚪ INCOMPLETO — nada falhou, mas verificações importantes não puderam rodar. Isto NÃO é aprovação.',
  failed: '🔴 REPROVADO — há problemas reais a corrigir (lista abaixo).'
};
export const verdictText = v => VERDICT_TEXT[v] || v;

export function formatVerificationReport(rep) {
  const L = [];
  L.push('RELATÓRIO DE VERIFICAÇÃO REAL — Ashen Testimony', `Versão: ${rep.version} • ${rep.at} • papel: ${rep.role} • ${rep.durationMs} ms`, `Site: ${rep.origin}`, `Navegador: ${rep.userAgent}`, '', verdictText(rep.verdict),
    `Resumo: ${rep.counts.ok} OK • ${rep.counts.fail} falhas • ${rep.counts.warn} atenções • ${rep.counts.skip} não verificadas`, '');
  const todo = rep.results.filter(r => r.status === 'fail' || r.status === 'warn');
  if (todo.length) {
    L.push('=== O QUE PRECISA SER RESOLVIDO ===');
    todo.sort((a, b) => (a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1)).forEach((r, i) => {
      L.push(`${i + 1}. [${LABEL[r.status]}] ${r.area} — ${r.title}`, `   Problema: ${r.detail}`, `   COMO CORRIGIR: ${r.fix || '—'}`);
      (r.evidence || []).slice(0, 8).forEach(e => L.push(`   • ${e}`));
    });
    L.push('');
  }
  const sk = rep.results.filter(r => r.status === 'skip');
  if (sk.length) { L.push('=== NÃO VERIFICADO (e por quê) ==='); sk.forEach(r => L.push(`- ${r.area} — ${r.title}: ${r.detail}${r.critical ? ' [importante]' : ''}`)); L.push(''); }
  L.push('=== DETALHE DE TODAS AS VERIFICAÇÕES ===');
  rep.results.forEach(r => L.push(`${ICON[r.status]} ${r.area} — ${r.title} (${r.ms} ms): ${r.detail || ''}`));
  return L.join('\n');
}

/* ------------------------------------------------------------------ */
/* Interface                                                           */
/* ------------------------------------------------------------------ */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function verificationCardMarkup(report) {
  const rows = report ? report.results.map(r => `<li class="sv-row sv-${r.status}"><span>${ICON[r.status]}</span><div><strong>${esc(r.area)} — ${esc(r.title)}</strong><small>${esc(r.detail || '')}</small>${r.fix ? `<small class="sv-fix">Como corrigir: ${esc(r.fix)}</small>` : ''}${(r.evidence || []).slice(0, 6).map(e => `<small>• ${esc(e)}</small>`).join('')}</div></li>`).join('') : '';
  return `<section class="card load-lab-card sv-card"><span class="badge">VERIFICAÇÃO REAL</span><h2>Verificar o site de verdade</h2>
<p>Cada item abaixo toca o site real: navegador, servidor, banco, Realtime, WebRTC, rotas de API e suas fichas verdadeiras. Nada passa sozinho: o que não puder rodar aparece como <strong>não verificado</strong> e o relatório final diz exatamente o que corrigir.</p>
<div class="row-actions"><button class="btn primary" id="runSiteVerification">▶ Executar verificação completa</button><button class="btn" id="copySiteVerification" ${report ? '' : 'disabled'}>📋 Copiar relatório</button><button class="btn" id="downloadSiteVerification" ${report ? '' : 'disabled'}>⬇️ Baixar relatório (.txt)</button></div>
<p id="siteVerificationStatus" class="load-lab-status">${report ? esc(verdictText(report.verdict)) : 'Ainda não executada nesta sessão.'}</p>
<ul id="siteVerificationList" class="sv-list">${rows}</ul>
<p class="tiny muted">Rode como Mestre para cobrir tudo (gravação real e comparação de fichas). Como Player, as verificações exclusivas do Mestre ficam "não verificadas".</p></section>`;
}

export function bindSiteVerification(buildDeps) {
  const btn = document.getElementById('runSiteVerification');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  const status = document.getElementById('siteVerificationStatus'), list = document.getElementById('siteVerificationList');
  const copy = document.getElementById('copySiteVerification'), dl = document.getElementById('downloadSiteVerification');
  const refreshButtons = () => { const has = !!window.__ashenSiteVerification; if (copy) copy.disabled = !has; if (dl) dl.disabled = !has; };
  btn.onclick = async () => {
    btn.disabled = true; list.innerHTML = '';
    try {
      const deps = buildDeps();
      deps.onStage = m => { if (status) status.textContent = m; };
      const rep = await runSiteVerification(deps, {
        onProgress: p => {
          if (p.phase === 'start' && status) status.textContent = `⏳ ${p.done + 1}/${p.total} — ${p.check.title}`;
          if (p.phase === 'end') {
            const r = p.result;
            list.insertAdjacentHTML('beforeend', `<li class="sv-row sv-${r.status}"><span>${ICON[r.status]}</span><div><strong>${esc(r.area)} — ${esc(r.title)}</strong><small>${esc(r.detail || '')}</small>${r.fix ? `<small class="sv-fix">Como corrigir: ${esc(r.fix)}</small>` : ''}${(r.evidence || []).slice(0, 6).map(e => `<small>• ${esc(e)}</small>`).join('')}</div></li>`);
          }
        }
      });
      window.__ashenSiteVerification = rep;
      if (status) status.textContent = verdictText(rep.verdict);
    } catch (e) { if (status) status.textContent = `🔴 A verificação não conseguiu ser executada: ${msg(e)}`; }
    finally { btn.disabled = false; refreshButtons(); }
  };
  if (copy) copy.onclick = async () => { const r = window.__ashenSiteVerification; if (!r) return; try { await navigator.clipboard.writeText(formatVerificationReport(r)); copy.textContent = '✔ Copiado'; } catch { copy.textContent = 'Use "Baixar"'; } };
  if (dl) dl.onclick = () => { const r = window.__ashenSiteVerification; if (!r) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([formatVerificationReport(r)], { type: 'text/plain;charset=utf-8' })); a.download = `verificacao-ashen-${r.at.replace(/[:.]/g, '-')}.txt`; a.click(); URL.revokeObjectURL(a.href); };
}
