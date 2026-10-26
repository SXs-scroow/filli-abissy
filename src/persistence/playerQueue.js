/**
 * Regras puras para reconciliar a fila local de Players.
 * A memória atual pode conter uma edição que ainda não conseguiu ser gravada
 * no localStorage; por isso um item persistido mais antigo nunca deve apagá-la.
 */
const SENSITIVE_KEYS = new Set(['password', 'newpassword', 'secretlovedeffect']);

function stripSensitiveFields(value) {
  if (Array.isArray(value)) return value.map(stripSensitiveFields);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    clean[key] = stripSensitiveFields(entry);
  }
  return clean;
}

/** Remove segredos antes de qualquer dado entrar na fila ou ser persistido. */
export function sanitizePlayerQueueItem(item) {
  if (!item || typeof item !== 'object') return null;
  const clean = stripSensitiveFields(item);
  if (clean.data && typeof clean.data === 'object') clean.data = stripSensitiveFields(clean.data);
  if (clean.baseData && typeof clean.baseData === 'object') clean.baseData = stripSensitiveFields(clean.baseData);
  return clean;
}

function validItem(item) {
  return Boolean(item && typeof item === 'object' && String(item.id || '').trim());
}

function freshness(item) {
  const stamp = Number(item?.data?._syncUpdatedAt) || 0;
  const queuedAt = Number(item?.queuedAt) || 0;
  return [stamp, queuedAt];
}

function isNewer(candidate, current) {
  const a = freshness(candidate);
  const b = freshness(current);
  if (a[0] !== b[0]) return a[0] > b[0];
  return a[1] > b[1];
}

export function mergePlayerQueueItems(memoryItems = [], storedItems = []) {
  const merged = new Map();
  for (const rawItem of memoryItems) {
    const item = sanitizePlayerQueueItem(rawItem);
    if (validItem(item)) merged.set(String(item.id), item);
  }
  for (const rawItem of storedItems) {
    const item = sanitizePlayerQueueItem(rawItem);
    if (!validItem(item)) continue;
    const id = String(item.id);
    const current = merged.get(id);
    if (!current || isNewer(item, current)) merged.set(id, item);
  }
  return [...merged.values()];
}

/** Persiste todos os itens válidos; nunca descarta silenciosamente a fila por tamanho. */
export function serializePlayerQueue(items = []) {
  return mergePlayerQueueItems([], Array.isArray(items) ? items : []);
}
