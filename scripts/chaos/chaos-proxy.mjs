// Proxy HTTP que corta a conexão de verdade (socket destruído) em pontos
// escolhidos: no meio do envio do corpo, no meio da resposta, ou depois que o
// servidor já aplicou a operação (resposta perdida).
import http from 'node:http';

export function createChaosProxy(targetPort) {
  const rules = [];   // {match, mode, bytes, times}
  const log = [];     // {rpc, mode}
  const rpcOf = url => (url || '').split('?')[0].split('/').pop();

  function nextRule(name) {
    const i = rules.findIndex(r => r.match === name || r.match === '*');
    if (i < 0) return null;
    const r = rules[i];
    if (r.times !== Infinity && --r.times <= 0) rules.splice(i, 1);
    return r;
  }

  const server = http.createServer((req, res) => {
    const name = rpcOf(req.url);
    const rule = nextRule(name);
    const mode = rule?.mode || 'pass';
    log.push({ rpc: name, mode });

    const upstream = http.request({
      host: '127.0.0.1', port: targetPort, path: req.url, method: req.method,
      headers: { ...req.headers, connection: 'close' }
    }, up => {
      if (mode === 'drop-response') {
        // o servidor já respondeu (= aplicou); o cliente nunca fica sabendo
        up.resume();
        up.on('end', () => req.socket.destroy());
        return;
      }
      const parts = [];
      up.on('data', c => parts.push(c));
      up.on('end', () => {
        const body = Buffer.concat(parts);
        if (mode === 'cut-response') {
          const keep = Math.max(1, Math.floor(body.length * (rule.fraction ?? 0.5)));
          res.writeHead(up.statusCode, { ...up.headers, 'content-length': body.length });
          res.write(body.subarray(0, keep), () => setTimeout(() => req.socket.destroy(), 5));
          return;
        }
        res.writeHead(up.statusCode, up.headers);
        res.end(body);
      });
    });
    upstream.on('error', () => { try { req.socket.destroy(); } catch {} });

    let seen = 0, cut = false;
    req.on('data', chunk => {
      if (cut) return;
      seen += chunk.length;
      if (mode === 'cut-request' && seen >= (rule.bytes ?? 1024)) {
        cut = true;
        upstream.destroy();       // o servidor nunca recebe o corpo completo
        req.socket.destroy();     // o cliente vê a conexão cair no meio do envio
        return;
      }
      upstream.write(chunk);
    });
    req.on('end', () => { if (!cut) upstream.end(); });
    req.on('error', () => { try { upstream.destroy(); } catch {} });
  });

  return {
    log,
    /** Agenda uma falha para as próximas `times` chamadas da RPC `match` ('*' = qualquer). */
    inject(match, mode, opts = {}) { rules.push({ match, mode, times: opts.times ?? 1, bytes: opts.bytes, fraction: opts.fraction }); },
    heal() { rules.length = 0; },
    count: (name, mode) => log.filter(l => l.rpc === name && (!mode || l.mode === mode)).length,
    clearLog() { log.length = 0; },
    listen: () => new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port))),
    close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); })
  };
}
