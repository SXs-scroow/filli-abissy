/**
 * Acesso defensivo ao armazenamento do navegador.
 * localStorage pode lançar exceções (modo privado, quota, políticas do browser).
 * Chamadores mantêm o estado em memória quando a persistência não está disponível.
 */
export function getBrowserStorage() {
  try {
    return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

export function readStoredJson(key, fallback = null, storage = getBrowserStorage()) {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(String(key));
    if (raw == null || raw === '') return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value, storage = getBrowserStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(String(key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStoredValue(key, storage = getBrowserStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(String(key));
    return true;
  } catch {
    return false;
  }
}
