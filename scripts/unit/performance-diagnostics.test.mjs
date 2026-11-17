import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPerformanceSnapshot, collectPerformanceSnapshot, runResponsivenessProbe, startPerformanceMonitor } from '../../src/performance/performanceDiagnostics.js';

test('performance snapshot collects navigation, resources, DOM, memory and monitor metrics', () => {
  const target = { __ashenPerformanceMonitor: { supported: true, longTaskCount: 2, longTaskTotalMs: 130.4, longestLongTaskMs: 80.2, startedAt: Date.now() - 1000 } };
  const report = collectPerformanceSnapshot({
    performanceObj: {
      getEntriesByType: (type) => type === 'navigation'
        ? [{ domContentLoadedEventEnd: 120, loadEventEnd: 180, responseEnd: 50, requestStart: 10, transferSize: 900 }]
        : [{ name: 'https://example.test/app.js?v=1', duration: 25.5, transferSize: 700, decodedBodySize: 1200, initiatorType: 'script' }],
      memory: { usedJSHeapSize: 1000, totalJSHeapSize: 2000, jsHeapSizeLimit: 9000 },
    },
    documentObj: { getElementsByTagName: () => ({ length: 42 }) },
    navigatorObj: { hardwareConcurrency: 4, deviceMemory: 8, connection: { effectiveType: '4g' } },
    target,
  });
  assert.equal(report.navigation.loadEventMs, 180);
  assert.equal(report.resources.count, 1);
  assert.equal(report.resources.transferBytes, 700);
  assert.equal(report.resources.largest[0].name, 'app.js');
  assert.equal(report.dom.elements, 42);
  assert.equal(report.memory.usedHeapBytes, 1000);
  assert.equal(report.longTasks.count, 2);
  assert.equal(report.device.hardwareConcurrency, 4);
});

test('performance snapshot degrades gracefully when browser metrics are unavailable', () => {
  const report = collectPerformanceSnapshot({ performanceObj: {}, documentObj: {}, navigatorObj: {}, target: {} });
  assert.equal(report.navigation, null);
  assert.equal(report.memory, null);
  assert.equal(report.longTasks.supported, false);
  assert.ok(report.notes.length >= 3);
});

test('long-task monitor initializes once and tolerates unsupported browsers', () => {
  const target = {};
  const first = startPerformanceMonitor({ target, PerformanceObserverCtor: undefined, performanceObj: {} });
  const second = startPerformanceMonitor({ target, PerformanceObserverCtor: undefined, performanceObj: {} });
  assert.equal(first, second);
  assert.equal(first.supported, false);
});

test('responsiveness probe takes five samples and returns a bounded summary', async () => {
  let time = 0;
  const report = await runResponsivenessProbe({ now: () => time, setTimeoutImpl: (cb) => { time += 7; cb(); } });
  assert.equal(report.samples, 5);
  assert.equal(report.medianDelayMs, 7);
  assert.equal(report.maxDelayMs, 7);
});

test('performance classification reports high load and responsiveness delay', () => {
  const assessment = classifyPerformanceSnapshot({
    navigation: { loadEventMs: 9000 },
    responsiveness: { maxDelayMs: 300 },
    longTasks: { supported: true, count: 2, longestMs: 220 },
    memory: { usedHeapBytes: 80, heapLimitBytes: 100 },
  });
  assert.equal(assessment.level, 'attention');
  assert.ok(assessment.findings.some(item => item.metric === 'loadEventMs'));
  assert.ok(assessment.findings.some(item => item.metric === 'responsiveness'));
  assert.ok(assessment.findings.some(item => item.metric === 'heapRatio'));
});

test('performance classification avoids false certainty when metrics are absent', () => {
  const assessment = classifyPerformanceSnapshot({ navigation: null, responsiveness: null, longTasks: { supported: false }, memory: null });
  assert.equal(assessment.level, 'clear');
  assert.equal(assessment.findings.length, 0);
  assert.match(assessment.summary, /não garante ausência/);
});

test('tarefa longa só do carregamento inicial vira observação, não atenção', () => {
  const boot = classifyPerformanceSnapshot({ navigation: { loadEventMs: 1186 }, longTasks: { supported: true, count: 1, longestMs: 1177, boot: { count: 1, longestMs: 1177 }, afterLoad: { count: 0, totalMs: 0, longestMs: 0 } } });
  assert.equal(boot.level, 'watch');
  assert.ok(boot.findings.some((f) => f.metric === 'bootLongTask'));
});

test('tarefa longa durante o uso continua sendo atenção', () => {
  const use = classifyPerformanceSnapshot({ longTasks: { supported: true, count: 2, longestMs: 400, boot: { count: 1, longestMs: 90 }, afterLoad: { count: 1, totalMs: 400, longestMs: 400 } } });
  assert.equal(use.level, 'attention');
});

test('o monitor separa as tarefas do carregamento das posteriores', () => {
  const entries = [{ startMs: 300, durationMs: 1177 }, { startMs: 90000, durationMs: 230 }];
  const target = { __ashenPerformanceMonitor: { supported: true, longTaskCount: 2, longTaskTotalMs: 1407, longestLongTaskMs: 1177, entries, startedAt: Date.now() } };
  const report = collectPerformanceSnapshot({ performanceObj: { getEntriesByType: (t) => t === 'navigation' ? [{ loadEventEnd: 1186, domContentLoadedEventEnd: 900, responseEnd: 60, requestStart: 10 }] : [], now: () => 1 }, documentObj: { getElementsByTagName: () => [] }, navigatorObj: {}, target });
  assert.equal(report.longTasks.boot.longestMs, 1177);
  assert.equal(report.longTasks.afterLoad.count, 1);
  assert.equal(report.longTasks.afterLoad.longestMs, 230);
});
