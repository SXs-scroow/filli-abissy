import { readStoredJson, writeStoredJson, removeStoredValue, getBrowserStorage } from './persistence/browserStorage.js';

/**
 * Coordenador único para gravações do estado global.
 * Mantém o último snapshot pendente em armazenamento local e só o remove
 * depois de o servidor confirmar o salvamento. Não substitui backups do servidor.
 */
const PENDING_KEY = 'a_profecia_global_pending_v2';
let pending = null;
let sender = null;
let running = false;
let waiters = [];
let retryTimer = 0;
let attempts = 0;

function storage() { return getBrowserStorage(); }
function readPending() {
  if (pending) return pending;
  const restored = readStoredJson(PENDING_KEY, null, storage());
  if (restored && typeof restored === 'object') pending = restored;
  return pending;
}
function persistPending(value) {
  pending = value;
  const s = storage();
  const saved = value ? writeStoredJson(PENDING_KEY, value, s) : removeStoredValue(PENDING_KEY, s);
  if (!saved) {
    // Mantém o item em memória e avisa: sem persistência local, uma recarga pode perder esta fila.
    try { console.warn('Não foi possível persistir a fila de sincronização no navegador.'); } catch {}
    notify('storage-error', { reason: 'PENDING_QUEUE_NOT_DURABLE' });
  }
}
function notify(status, detail = {}) {
  try { window.dispatchEvent(new CustomEvent('a-profecia-sync-queue', { detail: { status, attempts, pending: !!readPending(), ...detail } })); } catch {}
}
function scheduleRetry() {
  if (retryTimer || typeof window === 'undefined') return;
  const delay = Math.min(30000, 1000 * (2 ** Math.min(attempts, 5)));
  retryTimer = window.setTimeout(() => { retryTimer = 0; flushPending().catch(() => {}); }, delay);
}
export function configureSyncCoordinator(push) {
  if (typeof push === 'function') sender = push;
  if (typeof window !== 'undefined' && !window.__ashenSyncCoordinatorBound) {
    window.__ashenSyncCoordinatorBound = true;
    window.addEventListener('online', () => flushPending().catch(() => {}));
    window.addEventListener('pageshow', () => { if (!document.hidden) flushPending().catch(() => {}); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) flushPending().catch(() => {}); });
  }
  return flushPending();
}
export function enqueueGlobalSnapshot(payload) {
  if (!payload || typeof payload !== 'object') return Promise.reject(new Error('SNAPSHOT_INVALIDO'));
  const item = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, createdAt: Date.now(), payload };
  // A global payload is a complete snapshot: newer snapshots include earlier local edits.
  // Replacing an unsent snapshot avoids replaying stale whole-state writes out of order.
  persistPending(item);
  notify('pending', { createdAt: item.createdAt });
  const promise = new Promise((resolve, reject) => waiters.push({ id: item.id, resolve, reject }));
  flushPending().catch(() => {});
  return promise;
}
export async function flushPending() {
  if (running || !sender || !readPending()) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { notify('offline'); return null; }
  running = true;
  let result = null;
  try {
    while (readPending()) {
      const current = readPending();
      notify('sending', { id: current.id });
      try {
        result = await sender(current.payload);
      } catch (error) {
        attempts += 1;
        notify('error', { message: String(error?.message || error) });
        const failed = waiters.splice(0);
        failed.forEach(w => w.reject(error));
        scheduleRetry();
        throw error;
      }
      // Do not clear a newer snapshot enqueued while this request was in flight.
      if (readPending()?.id === current.id) persistPending(null);
      attempts = 0;
      notify('saved', { id: current.id, updatedAt: result?.updated_at || null });
    }
    const done = waiters.splice(0);
    done.forEach(w => w.resolve(result));
    return result;
  } finally {
    running = false;
    if (readPending() && typeof navigator !== 'undefined' && navigator.onLine !== false) scheduleRetry();
  }
}
export function syncQueueStatus() {
  const p = readPending();
  return { pending: !!p, createdAt: p?.createdAt || 0, attempts, running };
}
