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
