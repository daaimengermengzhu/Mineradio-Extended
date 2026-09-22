const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
function between(a, b) { return html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a))); }
test('30/60 FPS pacing stays accurate on 60, 120, 144 and 165 Hz displays', () => {
  for (const hz of [60, 120, 144, 165]) for (const fps of [30, 60]) {
    const ctx = { getAdaptiveRenderFps: () => fps, renderPerfState: { lastRenderAt: 0, skipped: 0 } };
    vm.runInNewContext(between('function shouldSkipAdaptiveRenderFrame(', 'function sampleRenderPerf('), ctx);
    let rendered = 0;
    for (let i = 1; i <= hz * 10; i++) if (!ctx.shouldSkipAdaptiveRenderFrame(i * 1000 / hz)) rendered++;
    assert.ok(Math.abs(rendered - fps * 10) <= 1, `${hz} Hz at ${fps} FPS rendered ${rendered}`);
  }
});
test('hidden windows schedule one timer, then wake immediately without duplicate loops', () => {
  let hidden = true, rafCalls = 0, timerCalls = 0, cleared = 0;
  const ctx = {
    isDeepBackgroundMode: () => hidden,
    setTimeout: (fn, delay) => { assert.equal(delay, 1000); timerCalls++; return 1; },
    clearTimeout: () => cleared++, requestAnimationFrame: () => ++rafCalls,
    animate: () => {}, document: { addEventListener: () => {} },
  };
  vm.runInNewContext(between('var mainLoopRaf = 0;', 'function animate()'), ctx);
  ctx.scheduleMainLoop(); ctx.scheduleMainLoop();
  assert.equal(timerCalls, 1); assert.equal(rafCalls, 0);
  hidden = false;
  ctx.wakeMainLoop(); ctx.wakeMainLoop();
  assert.equal(cleared, 1); assert.equal(rafCalls, 1);
});
test('sleeping frames skip visual work and preserve the separate desktop lyric timer', () => {
  const calls = [];
  const ctx = {
    mainLoopRaf: 1, scheduleMainLoop: () => calls.push('scheduled'), performance: { now: () => 1000 },
    isDeepBackgroundMode: () => true, renderPerfState: {}, maybeTrimRuntimeCaches: () => calls.push('trim'),
  };
  vm.runInNewContext(between('function animate() {', '\nanimate();'), ctx);
  ctx.animate();
  assert.deepEqual(calls, ['scheduled', 'trim']);
  assert.equal(ctx.renderPerfState.mode, 'sleep');
  assert.match(html, /setInterval\(function\(\)\{\s*if \(fx && \(fx.desktopLyrics \|\| fx.wallpaperMode\)\) syncDesktopOverlayState\(\);\s*\}, 320\)/);
});
