/**
 * Executa tarefas com concorrência limitada e preserva a ordem dos resultados.
 * Todas as tarefas iniciadas terminam antes de propagar a primeira falha, evitando
 * gravações de fundo ainda em voo depois que o chamador já tratou um erro.
 */
export async function mapWithConcurrency(items, limit, worker) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  if (typeof worker !== 'function') throw new TypeError('worker deve ser uma função');

  const requestedLimit = Math.floor(Number(limit) || 1);
  const cap = Math.max(1, Math.min(list.length, requestedLimit));
  const results = new Array(list.length);
  const errors = new Array(list.length);
  const failed = new Array(list.length).fill(false);
  let cursor = 0;

  await Promise.all(Array.from({ length: cap }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= list.length) return;
      try {
        results[index] = await worker(list[index], index);
      } catch (error) {
        failed[index] = true;
        errors[index] = error;
      }
    }
  }));

  const failedAt = failed.findIndex(Boolean);
  if (failedAt >= 0) {
    const error = errors[failedAt];
    try {
      if (error && (typeof error === 'object' || typeof error === 'function')) error.taskIndex = failedAt;
    } catch {}
    throw error;
  }
  return results;
}
