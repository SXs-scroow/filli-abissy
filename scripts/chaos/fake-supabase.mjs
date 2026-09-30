// Servidor de teste que imita as RPCs de Players do Supabase (PostgREST).
//
// ATENÇÃO: é um MODELO do contrato das RPCs usadas pelo front-end
// (a_profecia_list_players / _player_save / _player_delete), não o Postgres real.
// Ele existe para exercitar o código do navegador contra falhas de rede reais
// (sockets cortados de verdade). As regras de SQL em si continuam sendo validadas
// no banco (veja supabase/migrations/20260930000000_*.sql).
import http from 'node:http';

export function createFakeSupabase() {
  const db = {
    players: new Map(),   // id -> {id, login, data, updated_at, deleted_at}
    sessions: new Map(),  // token -> {role, player_id}   (sessões VIVAS)
    revoked: new Map(),   // token -> player_id  (sessão de Player excluído: só lê a própria tombstone)
    calls: [],            // {rpc, applied, id}
    glitchEmptyReads: 0   // próximas N leituras devolvem [] (resposta 200 vazia)
  };

  const fail = (message) => Object.assign(new Error(message), { rpcMessage: message });

  function auth(token) {
    const s = db.sessions.get(String(token || ''));
    if (!s) throw fail('SESSAO_INVALIDA');
    return s;
  }
  const stampOf = row => Number(row?.data?._syncUpdatedAt) || 0;
  const strip = data => { const d = { ...(data || {}) }; delete d.password; delete d.newPassword; return d; };

  const rpcs = {
    a_profecia_list_players({ p_token }) {
      // Espelha a migration 20260930000000: token revogado de Player excluído
      // serve SOMENTE para ler a própria tombstone.
      if (!db.sessions.has(String(p_token || ''))) {
        const pid = db.revoked.get(String(p_token || ''));
        const row = pid ? db.players.get(pid) : null;
        if (!row?.deleted_at) throw fail('SESSAO_INVALIDA');
        return [{ id: row.id, login: row.login, data: { _syncUpdatedAt: stampOf(row) }, updated_at: row.updated_at, deleted_at: row.deleted_at }];
      }
      const s = auth(p_token);
      if (db.glitchEmptyReads > 0) { db.glitchEmptyReads--; return []; }
      const shape = p => ({
        id: p.id, login: p.login,
        data: p.deleted_at ? { _syncUpdatedAt: stampOf(p) } : strip(p.data),
        updated_at: p.updated_at, deleted_at: p.deleted_at
      });
      if (s.role === 'master') return [...db.players.values()].map(shape);
      // Player: SEMPRE a própria linha, inclusive quando excluída.
      const own = db.players.get(s.player_id);
      return own ? [shape(own)] : [];
    },

    a_profecia_player_save({ p_token, p_id, p_login, p_data, p_sync_updated_at, p_deleted_at }) {
      const s = auth(p_token);
      if (s.role === 'player' && s.player_id !== p_id) throw fail('NAO_AUTORIZADO');
      const existing = db.players.get(p_id);
      if (existing?.deleted_at && !p_deleted_at) throw fail('PLAYER_EXCLUIDO');
      const stamp = Number(p_sync_updated_at) || 0;
      if (existing && stampOf(existing) > stamp) {   // last-write-wins por carimbo
        db.calls.push({ rpc: 'save', id: p_id, applied: false });
        return { id: p_id, updated_at: existing.updated_at, sync_updated_at: stampOf(existing), stale: true };
      }
      const now = new Date().toISOString();
      db.players.set(p_id, {
        id: p_id, login: p_login,
        data: { ...strip(p_data), _syncUpdatedAt: stamp },
        updated_at: now, deleted_at: p_deleted_at || null
      });
      db.calls.push({ rpc: 'save', id: p_id, applied: true });
      return { id: p_id, updated_at: now, sync_updated_at: stamp };
    },

    a_profecia_player_delete({ p_token, p_id }) {
      const s = auth(p_token);
      if (s.role !== 'master') throw fail('NAO_AUTORIZADO');
      const row = db.players.get(String(p_id || '').trim());
      if (!row) return { id: p_id, found: false, already_deleted: false };
      if (row.deleted_at) {
        db.calls.push({ rpc: 'delete', id: row.id, applied: false });
        return { id: row.id, found: true, already_deleted: true, deleted_at: row.deleted_at };
      }
      const ts = new Date();
      row.deleted_at = ts.toISOString();
      row.updated_at = row.deleted_at;
      row.data = { ...row.data, _syncUpdatedAt: ts.getTime() };
      // sessões do Player são APAGADAS (como no banco real); o token vira "revogado"
      for (const [tok, sess] of [...db.sessions]) {
        if (sess.role === 'player' && sess.player_id === row.id) { db.sessions.delete(tok); db.revoked.set(tok, row.id); }
      }
      db.calls.push({ rpc: 'delete', id: row.id, applied: true });
      return { id: row.id, found: true, already_deleted: false, deleted_at: row.deleted_at, sync_updated_at: ts.getTime() };
    }
  };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('aborted', () => {});
    req.on('end', () => {
      const name = (req.url || '').split('?')[0].split('/').pop();
      const send = (status, body) => {
        const text = JSON.stringify(body);
        res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
        res.end(text);
      };
      const fn = rpcs[name];
      if (!fn) return send(404, { message: `função ${name} não existe` });
      try {
        send(200, fn(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')));
      } catch (e) {
        send(400, { code: 'P0001', message: e.rpcMessage || String(e.message) });
      }
    });
  });

  return {
    db,
    addSession(token, role, player_id = null) { db.sessions.set(token, { role, player_id }); },
    seedPlayer(p, { deleted = false } = {}) {
      const stamp = Number(p._syncUpdatedAt) || Date.now();
      db.players.set(p.id, {
        id: p.id, login: p.login,
        data: { ...p, _syncUpdatedAt: stamp },
        updated_at: new Date(stamp).toISOString(),
        deleted_at: deleted ? new Date().toISOString() : null
      });
    },
    reset() { db.players.clear(); db.sessions.clear(); db.revoked.clear(); db.calls.length = 0; db.glitchEmptyReads = 0; },
    listen: () => new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port))),
    close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); })
  };
}
