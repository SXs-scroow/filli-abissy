/** Diagnóstico local e somente leitura de desempenho do navegador. */
const MONITOR_KEY = '__ashenPerformanceMonitor';

export function startPerformanceMonitor({ performanceObj = globalThis.performance, PerformanceObserverCtor = globalThis.PerformanceObserver, target = globalThis.window } = {}) {
  if (!target || target[MONITOR_KEY]) return target?.[MONITOR_KEY] || null;
  const state = { supported: false, longTaskCount: 0, longTaskTotalMs: 0, longestLongTaskMs: 0, startedAt: Date.now(), observer: null };
  try {
    if (typeof PerformanceObserverCtor === 'function' && PerformanceObserverCtor.supportedEntryTypes?.includes('longtask')) {
      state.observer = new PerformanceObserverCtor((list) => {
        for (const entry of list.getEntries()) {
          const duration = Math.max(0, Number(entry.duration) || 0);
          state.longTaskCount += 1;
          state.longTaskTotalMs += duration;
          state.longestLongTaskMs = Math.max(state.longestLongTaskMs, duration);
        }
      });
      state.observer.observe({ type: 'longtask', buffered: true });
      state.supported = true;
    }
  } catch { /* A API varia por navegador; o diagnóstico deve ser não intrusivo. */ }
  target[MONITOR_KEY] = state;
  return state;
}

function round(value) { return Number.isFinite(value) ? Math.round(value * 10) / 10 : null; }

export function collectPerformanceSnapshot({
  performanceObj = globalThis.performance,
  documentObj = globalThis.document,
  navigatorObj = globalThis.navigator,
  target = globalThis.window,
  now = () => performanceObj?.now?.() ?? Date.now(),
} = {}) {
  const entries = (() => { try { return performanceObj?.getEntriesByType?.('resource') || []; } catch { return []; } })();
  const nav = (() => { try { return performanceObj?.getEntriesByType?.('navigation')?.[0] || null; } catch { return null; } })();
  const resources = entries.map((entry) => ({
    name: String(entry.name || '').split('?')[0].split('/').pop() || String(entry.name || ''),
    durationMs: round(Number(entry.duration) || 0),
    transferBytes: Number(entry.transferSize) > 0 ? Number(entry.transferSize) : null,
    decodedBytes: Number(entry.decodedBodySize) > 0 ? Number(entry.decodedBodySize) : null,
    type: String(entry.initiatorType || 'other'),
  }));
  const transferKnown = resources.filter((item) => item.transferBytes !== null);
  const transferBytes = transferKnown.reduce((sum, item) => sum + item.transferBytes, 0);
  const memory = performanceObj?.memory;
  const monitor = target?.[MONITOR_KEY] || null;
  const navigation = nav ? {
    domContentLoadedMs: round(nav.domContentLoadedEventEnd),
    loadEventMs: round(nav.loadEventEnd),
    responseMs: round(nav.responseEnd - nav.requestStart),
    transferBytes: Number(nav.transferSize) > 0 ? Number(nav.transferSize) : null,
  } : null;
  const largest = [...resources].sort((a, b) => (b.transferBytes || b.decodedBytes || 0) - (a.transferBytes || a.decodedBytes || 0)).slice(0, 5);
  const report = {
    at: Date.now(),
    navigation,
    resources: { count: resources.length, transferBytes: transferKnown.length ? transferBytes : null, transferKnownCount: transferKnown.length, largest },
    dom: { elements: Number(documentObj?.getElementsByTagName?.('*')?.length) || null },
    memory: memory ? { usedHeapBytes: Number(memory.usedJSHeapSize) || null, totalHeapBytes: Number(memory.totalJSHeapSize) || null, heapLimitBytes: Number(memory.jsHeapSizeLimit) || null } : null,
    longTasks: monitor ? { supported: monitor.supported, count: monitor.longTaskCount, totalMs: round(monitor.longTaskTotalMs), longestMs: round(monitor.longestLongTaskMs), monitoredForMs: Math.max(0, Date.now() - monitor.startedAt) } : { supported: false, note: 'monitoramento não estava ativo desde o início da página' },
    device: { hardwareConcurrency: Number(navigatorObj?.hardwareConcurrency) || null, deviceMemoryGB: Number(navigatorObj?.deviceMemory) || null, connection: navigatorObj?.connection?.effectiveType || null },
    notes: [],
  };
  if (!navigation) report.notes.push('Timing de navegação indisponível; talvez a página tenha sido aberta por navegação interna ou o navegador limite a API.');
  if (!transferKnown.length) report.notes.push('Tamanho transferido não exposto pelo navegador/cache; contagem de recursos continua disponível.');
  if (!memory) report.notes.push('Heap JavaScript não é exposto neste navegador; isso não indica falha.');
  if (!monitor?.supported) report.notes.push('Medição de Long Tasks não suportada ou não iniciada no começo desta página.');
  return report;
}


/** Classificação heurística local; serve para triagem, não como SLO universal. */
export function classifyPerformanceSnapshot(snapshot = {}) {
  const findings = [];
  const loadMs = Number(snapshot.navigation?.loadEventMs);
  if (Number.isFinite(loadMs) && loadMs > 0) {
    if (loadMs > 8000) findings.push({ level: 'attention', metric: 'loadEventMs', value: loadMs, message: 'Carregamento acima de 8 s; revisar rede, cache e recursos.' });
    else if (loadMs > 4000) findings.push({ level: 'watch', metric: 'loadEventMs', value: loadMs, message: 'Carregamento acima de 4 s; comparar em condições equivalentes.' });
  }
  const longCount = Number(snapshot.longTasks?.count);
  const longest = Number(snapshot.longTasks?.longestMs);
  if (snapshot.longTasks?.supported && longCount > 0) findings.push({ level: longest >= 200 ? 'attention' : 'watch', metric: 'longTasks', value: longCount, message: `${longCount} tarefa(s) longa(s); maior duração ${Number.isFinite(longest) ? longest : 'indisponível'} ms.` });
  const delay = Number(snapshot.responsiveness?.maxDelayMs);
  if (Number.isFinite(delay) && delay > 100) findings.push({ level: delay > 250 ? 'attention' : 'watch', metric: 'responsiveness', value: delay, message: `Atraso máximo local de ${delay} ms; repita a medição e compare o dispositivo.` });
  const heap = Number(snapshot.memory?.usedHeapBytes);
  const limit = Number(snapshot.memory?.heapLimitBytes);
  if (Number.isFinite(heap) && heap > 0 && Number.isFinite(limit) && limit > 0 && heap / limit > 0.75) findings.push({ level: 'attention', metric: 'heapRatio', value: round(heap / limit), message: 'Heap reportado acima de 75% do limite exposto pelo navegador.' });
  const level = findings.some(item => item.level === 'attention') ? 'attention' : findings.length ? 'watch' : 'clear';
  return { level, findings, summary: level === 'clear' ? 'Nenhum alerta heurístico encontrado; isso não garante ausência de gargalos.' : level === 'watch' ? 'Há sinais para comparar com novas medições.' : 'Há sinais relevantes para investigar antes de otimizar.', thresholds: { loadWatchMs: 4000, loadAttentionMs: 8000, responsivenessWatchMs: 100, heapAttentionRatio: 0.75 } };
}

export async function runResponsivenessProbe({ now = () => globalThis.performance?.now?.() ?? Date.now(), setTimeoutImpl = globalThis.setTimeout } = {}) {
  const samples = [];
  for (let i = 0; i < 5; i += 1) {
    const scheduledAt = now();
    await new Promise((resolve) => setTimeoutImpl(resolve, 0));
    samples.push(Math.max(0, now() - scheduledAt));
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return { samples: samples.length, medianDelayMs: round(sorted[Math.floor(sorted.length / 2)] || 0), maxDelayMs: round(Math.max(...samples, 0)), rawMs: samples.map(round) };
}
