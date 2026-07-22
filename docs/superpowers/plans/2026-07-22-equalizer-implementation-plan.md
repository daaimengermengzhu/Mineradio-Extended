# Ten-Band Equalizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, default-off ten-band equalizer with presets and automatic clipping protection to every Mineradio playback source.

**Architecture:** Put preset data, state normalization, state transitions, and headroom calculation in a small UMD module that can run in the browser and Node tests. Keep Web Audio graph construction and bottom-bar UI wiring in the existing player page, inserting the equalizer after the existing analysers and before the existing master volume gain.

**Tech Stack:** Browser Web Audio API, vanilla HTML/CSS/JavaScript, Electron, Node.js built-in test runner.

---

## File Map

- Create `public/equalizer-core.js`: frequencies, presets, persisted-state validation, state transitions, and headroom calculation.
- Create `test/equalizer/equalizer-core.test.js`: pure equalizer behavior tests.
- Create `test/equalizer/app-wiring.test.js`: static checks for script loading, UI wiring, audio graph, persistence, and startup binding.
- Modify `public/index.html`: load the core module, add the EQ button/panel, create Web Audio nodes, apply settings, and bind interactions.
- Modify `package.json`: add the focused `test:equalizer` command.
- Modify `docs/USAGE_GUIDE.md`: document the user-facing controls and distinguish equalizer processing from platform audio quality.
- Modify `CHANGELOG.md`: record the feature under a new current-development entry.

### Task 1: Build the tested equalizer core

**Files:**
- Create: `test/equalizer/equalizer-core.test.js`
- Create: `public/equalizer-core.js`
- Modify: `package.json:13-19`

- [ ] **Step 1: Write the failing core tests**

Create `test/equalizer/equalizer-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const eq = require('../../public/equalizer-core');

test('uses ten octave-spaced bands and starts disabled', () => {
  assert.deepEqual(eq.BAND_FREQUENCIES, [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
  assert.deepEqual(eq.defaultState(), {
    version: 1,
    enabled: false,
    selectedPreset: 'flat',
    customGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
});

test('normalizes damaged state without enabling processing', () => {
  assert.deepEqual(eq.normalizeState({ version: 99, enabled: true }), eq.defaultState());
  assert.deepEqual(eq.normalizeState({
    version: 1,
    enabled: 'yes',
    selectedPreset: 'missing',
    customGains: [99, -99, 1, 2, 3, 4, 5, 6, 7, 8],
  }), {
    version: 1,
    enabled: false,
    selectedPreset: 'flat',
    customGains: [12, -12, 1, 2, 3, 4, 5, 6, 7, 8],
  });
});

test('keeps one custom curve while switching through built-in presets', () => {
  const custom = eq.updateBand(eq.applyPreset(eq.defaultState(), 'pop'), 4, -3.5);
  assert.equal(custom.selectedPreset, 'custom');
  assert.equal(custom.customGains[4], -3.5);

  const rock = eq.applyPreset(custom, 'rock');
  assert.deepEqual(eq.gainsForState(rock), eq.PRESETS.rock);
  assert.deepEqual(rock.customGains, custom.customGains);
  assert.deepEqual(eq.gainsForState(eq.applyPreset(rock, 'custom')), custom.customGains);
});

test('calculates conservative automatic headroom', () => {
  assert.equal(eq.calculateHeadroomDb([0, -2, -6]), 0);
  assert.equal(eq.calculateHeadroomDb([0, 5, 2]), -3.75);
  assert.equal(eq.calculateHeadroomDb([12, 4, 0]), -9);
  assert.equal(eq.shouldEnableLimiter([0, -1, -4]), false);
  assert.equal(eq.shouldEnableLimiter([0, 0.1, -4]), true);
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run:

```powershell
node --test test/equalizer/equalizer-core.test.js
```

Expected: FAIL with `Cannot find module '../../public/equalizer-core'`.

- [ ] **Step 3: Implement the pure module**

Create `public/equalizer-core.js`:

```js
(function attachEqualizerCore(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MineradioEqualizer = api;
}(typeof window !== 'undefined' ? window : globalThis, function createEqualizerCore() {
  'use strict';

  var BAND_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  var PRESETS = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: [4, 5, 4, 2, 0, -1, -1, 0, 1, 1],
    vocal: [-2, -1, 0, 1, 2, 3, 3, 2, 1, 0],
    pop: [1, 2, 2, 0, -1, 1, 2, 3, 2, 1],
    rock: [3, 2, 1, 0, -1, 1, 2, 3, 3, 2],
    classical: [2, 2, 1, 0, -1, 0, 1, 2, 3, 3],
  };
  var PRESET_IDS = Object.keys(PRESETS);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function copyGains(values) {
    var source = Array.isArray(values) && values.length === BAND_FREQUENCIES.length
      ? values
      : PRESETS.flat;
    return source.map(function normalizeGain(value) {
      var number = Number(value);
      return clamp(Number.isFinite(number) ? number : 0, -12, 12);
    });
  }

  function defaultState() {
    return {
      version: 1,
      enabled: false,
      selectedPreset: 'flat',
      customGains: copyGains(PRESETS.flat),
    };
  }

  function normalizeState(raw) {
    if (!raw || raw.version !== 1) return defaultState();
    var preset = PRESET_IDS.indexOf(raw.selectedPreset) >= 0 || raw.selectedPreset === 'custom'
      ? raw.selectedPreset
      : 'flat';
    return {
      version: 1,
      enabled: raw.enabled === true,
      selectedPreset: preset,
      customGains: copyGains(raw.customGains),
    };
  }

  function gainsForState(raw) {
    var state = normalizeState(raw);
    return copyGains(state.selectedPreset === 'custom'
      ? state.customGains
      : PRESETS[state.selectedPreset]);
  }

  function setEnabled(raw, enabled) {
    var state = normalizeState(raw);
    state.enabled = enabled === true;
    return state;
  }

  function applyPreset(raw, presetId) {
    var state = normalizeState(raw);
    if (presetId === 'custom' || PRESET_IDS.indexOf(presetId) >= 0) state.selectedPreset = presetId;
    return state;
  }

  function updateBand(raw, index, value) {
    var state = normalizeState(raw);
    var gains = gainsForState(state);
    if (Number.isInteger(index) && index >= 0 && index < gains.length) {
      gains[index] = clamp(Number(value) || 0, -12, 12);
    }
    state.selectedPreset = 'custom';
    state.customGains = gains;
    return state;
  }

  function reset(raw) {
    var state = normalizeState(raw);
    state.selectedPreset = 'flat';
    return state;
  }

  function calculateHeadroomDb(gains) {
    var highest = copyGains(gains).reduce(function findHighest(result, value) {
      return Math.max(result, value);
    }, 0);
    return clamp(-0.75 * Math.max(0, highest), -9, 0);
  }

  function shouldEnableLimiter(gains) {
    return copyGains(gains).some(function hasBoost(value) { return value > 0; });
  }

  return {
    BAND_FREQUENCIES: BAND_FREQUENCIES.slice(),
    PRESETS: Object.keys(PRESETS).reduce(function clonePresets(result, key) {
      result[key] = copyGains(PRESETS[key]);
      return result;
    }, {}),
    defaultState: defaultState,
    normalizeState: normalizeState,
    gainsForState: gainsForState,
    setEnabled: setEnabled,
    applyPreset: applyPreset,
    updateBand: updateBand,
    reset: reset,
    calculateHeadroomDb: calculateHeadroomDb,
    shouldEnableLimiter: shouldEnableLimiter,
  };
}));
```

- [ ] **Step 4: Add and run the focused test command**

Add this entry to `package.json` scripts:

```json
"test:equalizer": "node --test test/equalizer/*.test.js"
```

Run:

```powershell
npm run test:equalizer
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit the core**

```powershell
git add public/equalizer-core.js test/equalizer/equalizer-core.test.js package.json
git commit -m "feat: add tested equalizer core"
```

### Task 2: Insert the equalizer into the Web Audio graph

**Files:**
- Create: `test/equalizer/app-wiring.test.js`
- Modify: `public/index.html:9-13, 2982, 18932-18952`

- [ ] **Step 1: Write failing audio-wiring checks**

Create `test/equalizer/app-wiring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const indexHtml = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

test('loads the equalizer core before the inline player', () => {
  assert.match(indexHtml, /<script src="equalizer-core\.js"><\/script>/);
  assert.ok(
    indexHtml.indexOf('<script src="equalizer-core.js"></script>') < indexHtml.indexOf('<style>'),
    'equalizer core must load before the inline player script',
  );
});

test('keeps beat analysis before equalizer processing', () => {
  assert.match(indexHtml, /source\.connect\(beatAnalyser\)/);
  assert.match(indexHtml, /analyser\.connect\(equalizerFilters\[0\]\)/);
  assert.match(indexHtml, /equalizerLimiter\.connect\(gainNode\)/);
  assert.match(indexHtml, /filter\.type\s*=\s*'peaking'/);
  assert.match(indexHtml, /filter\.Q\.value\s*=\s*1\.4/);
});

test('applies headroom and limiter only through equalizer state', () => {
  assert.match(indexHtml, /function applyEqualizerAudioState\(/);
  assert.match(indexHtml, /MineradioEqualizer\.calculateHeadroomDb/);
  assert.match(indexHtml, /MineradioEqualizer\.shouldEnableLimiter/);
  assert.match(indexHtml, /equalizerLimiter\.ratio/);
});
```

- [ ] **Step 2: Run the wiring test and verify failure**

```powershell
npm run test:equalizer
```

Expected: core tests pass and app-wiring tests fail because no player integration exists.

- [ ] **Step 3: Load the module and declare audio state**

Add after `lyric-timeline.js`:

```html
<script src="equalizer-core.js"></script>
```

Extend the audio globals near the existing `audio`, `audioCtx`, and `gainNode` declarations:

```js
var equalizerFilters = [];
var equalizerHeadroom = null;
var equalizerLimiter = null;
var equalizerAudioSupported = !!(window.AudioContext || window.webkitAudioContext);
```

- [ ] **Step 4: Add graph construction and state application**

Insert immediately before `initAudio()`:

```js
function setEqualizerAudioParam(param, value, immediate) {
  if (!param || !audioCtx) return;
  var now = audioCtx.currentTime || 0;
  param.cancelScheduledValues(now);
  if (immediate) param.setValueAtTime(value, now);
  else param.setTargetAtTime(value, now, 0.020);
}

function createEqualizerAudioGraph() {
  var frequencies = window.MineradioEqualizer.BAND_FREQUENCIES;
  var filters = frequencies.map(function createBand(frequency) {
    var filter = audioCtx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = frequency;
    filter.Q.value = 1.4;
    filter.gain.value = 0;
    return filter;
  });
  var headroom = audioCtx.createGain();
  var limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 1;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;

  for (var i = 0; i < filters.length - 1; i += 1) filters[i].connect(filters[i + 1]);
  filters[filters.length - 1].connect(headroom);
  headroom.connect(limiter);

  equalizerFilters = filters;
  equalizerHeadroom = headroom;
  equalizerLimiter = limiter;
}

function applyEqualizerAudioState(immediate) {
  if (!equalizerFilters.length || !equalizerHeadroom || !equalizerLimiter) return;
  var active = equalizerState && equalizerState.enabled;
  var savedGains = window.MineradioEqualizer.gainsForState(equalizerState);
  var gains = active ? savedGains : savedGains.map(function zeroGain() { return 0; });
  equalizerFilters.forEach(function applyBand(filter, index) {
    setEqualizerAudioParam(filter.gain, gains[index], immediate);
  });
  setEqualizerAudioParam(
    equalizerHeadroom.gain,
    Math.pow(10, (active ? window.MineradioEqualizer.calculateHeadroomDb(gains) : 0) / 20),
    immediate,
  );
  setEqualizerAudioParam(
    equalizerLimiter.ratio,
    active && window.MineradioEqualizer.shouldEnableLimiter(gains) ? 20 : 1,
    immediate,
  );
}
```

- [ ] **Step 5: Replace the audible connection in `initAudio()`**

After creating the existing analysers and `gainNode`, use:

```js
source.connect(analyser);
source.connect(beatAnalyser);
try {
  createEqualizerAudioGraph();
  analyser.connect(equalizerFilters[0]);
  equalizerLimiter.connect(gainNode);
  equalizerAudioSupported = true;
  applyEqualizerAudioState(true);
} catch (equalizerError) {
  console.warn('equalizer audio graph unavailable:', equalizerError);
  equalizerFilters = [];
  equalizerHeadroom = null;
  equalizerLimiter = null;
  equalizerAudioSupported = false;
  analyser.connect(gainNode);
  if (typeof updateEqualizerUi === 'function') updateEqualizerUi();
}
gainNode.connect(audioCtx.destination);
```

Keep the existing analyser configuration, volume application, data resets, and `audioReady = true` statements unchanged.

- [ ] **Step 6: Run focused tests and commit**

```powershell
npm run test:equalizer
git add public/index.html test/equalizer/app-wiring.test.js
git commit -m "feat: add equalizer audio graph"
```

Expected: all equalizer core and audio-wiring tests pass.

### Task 3: Add the persistent bottom-bar EQ panel

**Files:**
- Modify: `public/index.html:612-630, 797-801, 1600-1625, 2696-2706, 3185-3210, 15858-15873, 30770-30776`
- Modify: `test/equalizer/app-wiring.test.js`

- [ ] **Step 1: Extend the wiring tests for the UI contract**

Append to `test/equalizer/app-wiring.test.js`:

```js
test('renders and binds an independent equalizer control', () => {
  assert.match(indexHtml, /id="equalizer-control"/);
  assert.match(indexHtml, /id="equalizer-btn"/);
  assert.match(indexHtml, /id="equalizer-panel"/);
  assert.match(indexHtml, /id="equalizer-band-list"/);
  assert.match(indexHtml, /function bindEqualizerControl\(/);
  assert.match(indexHtml, /bindEqualizerControl\(\)/);
  assert.match(indexHtml, /function closeEqualizerPanel\(/);
  assert.match(indexHtml, /function isEqualizerPanelOpen\(/);
});

test('persists a versioned default-off equalizer state', () => {
  assert.match(indexHtml, /mineradio-equalizer-state-v1/);
  assert.match(indexHtml, /MineradioEqualizer\.normalizeState/);
  assert.match(indexHtml, /localStorage\.setItem\(EQUALIZER_STORE_KEY/);
  assert.match(indexHtml, /equalizerState\.enabled/);
});
```

Run `npm run test:equalizer` and expect these two new checks to fail.

- [ ] **Step 2: Add the control markup**

Insert after `quality-control` in the actions cluster:

```html
<div id="equalizer-control" class="equalizer-control">
  <button id="equalizer-btn" class="ctrl-btn equalizer-pill" type="button" title="均衡器" aria-label="均衡器" aria-expanded="false" onclick="toggleEqualizerPanel(event)">EQ</button>
  <div id="equalizer-panel" class="equalizer-popover" role="dialog" aria-label="十段均衡器" onclick="event.stopPropagation()">
    <div class="equalizer-head">
      <strong>均衡器</strong>
      <button id="equalizer-switch" class="equalizer-switch" type="button" role="switch" aria-checked="false">关闭</button>
    </div>
    <div id="equalizer-presets" class="equalizer-presets">
      <button type="button" data-eq-preset="flat">原声</button>
      <button type="button" data-eq-preset="bass">低音增强</button>
      <button type="button" data-eq-preset="vocal">人声清晰</button>
      <button type="button" data-eq-preset="pop">流行</button>
      <button type="button" data-eq-preset="rock">摇滚</button>
      <button type="button" data-eq-preset="classical">古典</button>
      <button type="button" data-eq-preset="custom">自定义</button>
    </div>
    <div id="equalizer-band-scroll" class="equalizer-band-scroll">
      <div id="equalizer-band-list" class="equalizer-band-list"></div>
    </div>
    <div class="equalizer-foot">
      <span id="equalizer-protection-state">自动保护</span>
      <button id="equalizer-reset" type="button">重置为原声</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add responsive panel styles**

Add beside the existing quality and volume styles:

```css
.equalizer-control{position:relative;display:flex;align-items:center;justify-content:center}
.equalizer-control .ctrl-btn{position:relative;z-index:2}
#equalizer-btn.equalizer-pill{width:38px;font-size:10px;font-weight:800;letter-spacing:0;color:rgba(237,245,255,.82);background:rgba(255,255,255,.038)}
#equalizer-btn.active{color:#fff;background:rgba(var(--fc-accent-rgb),.12)}
.equalizer-popover{position:fixed;left:50%;bottom:96px;transform:translate(-50%,8px);width:min(620px,calc(100vw - 24px));padding:16px;border-radius:8px;border:1px solid rgba(255,255,255,.10);background:rgba(10,11,14,.90);box-shadow:0 24px 70px rgba(0,0,0,.48);backdrop-filter:blur(24px) saturate(1.2);opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;z-index:30}
.equalizer-control.open .equalizer-popover{opacity:1;pointer-events:auto;transform:translate(-50%,0)}
.equalizer-head,.equalizer-foot{display:flex;align-items:center;justify-content:space-between;gap:12px}
.equalizer-head strong{font-size:14px;color:rgba(255,255,255,.92)}
.equalizer-switch,.equalizer-presets button,.equalizer-foot button{min-height:30px;padding:0 10px;border-radius:7px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);color:rgba(255,255,255,.68);font:inherit;font-size:10.5px;cursor:pointer}
.equalizer-switch[aria-checked="true"],.equalizer-presets button.active{border-color:rgba(var(--fc-accent-rgb),.36);background:rgba(var(--fc-accent-rgb),.12);color:#fff}
.equalizer-presets{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.equalizer-band-scroll{margin-top:14px;overflow-x:auto;overscroll-behavior-x:contain;padding-bottom:4px}
.equalizer-band-list{display:grid;grid-template-columns:repeat(10,48px);gap:8px;min-width:552px;height:210px;padding:8px 4px}
.equalizer-band{display:grid;grid-template-rows:18px 150px 18px;justify-items:center;align-items:center;min-width:0}
.equalizer-band output{font-size:9px;color:rgba(255,255,255,.70);font-variant-numeric:tabular-nums}
.equalizer-band input{width:134px;transform:rotate(-90deg);accent-color:var(--fc-accent);cursor:pointer}
.equalizer-band label{font-size:9.5px;color:rgba(255,255,255,.48)}
.equalizer-foot{padding-top:12px;border-top:1px solid rgba(255,255,255,.07)}
.equalizer-foot span{font-size:10px;color:rgba(255,255,255,.46)}
body.immersive-mode #equalizer-control{display:none!important}
@media (max-width:620px){.equalizer-popover{bottom:156px;padding:13px}.equalizer-presets{flex-wrap:nowrap;overflow-x:auto}.equalizer-presets button{flex:0 0 auto}}
```

- [ ] **Step 4: Add state loading, rendering, and interactions**

Add near the saved-volume helpers and control bindings:

```js
var EQUALIZER_STORE_KEY = 'mineradio-equalizer-state-v1';
var equalizerState = loadEqualizerState();
var equalizerSaveTimer = 0;

function loadEqualizerState() {
  try {
    return window.MineradioEqualizer.normalizeState(JSON.parse(localStorage.getItem(EQUALIZER_STORE_KEY) || 'null'));
  } catch (e) {
    return window.MineradioEqualizer.defaultState();
  }
}

function saveEqualizerState() {
  if (equalizerSaveTimer) {
    clearTimeout(equalizerSaveTimer);
    equalizerSaveTimer = 0;
  }
  try { localStorage.setItem(EQUALIZER_STORE_KEY, JSON.stringify(equalizerState)); } catch (e) {}
}

function scheduleEqualizerSave() {
  if (equalizerSaveTimer) clearTimeout(equalizerSaveTimer);
  equalizerSaveTimer = setTimeout(saveEqualizerState, 120);
}

function formatEqualizerFrequency(value) {
  return value >= 1000 ? (value / 1000) + 'K' : String(value);
}

function formatEqualizerGain(value) {
  var number = Number(value) || 0;
  return (number > 0 ? '+' : '') + number.toFixed(1);
}

function renderEqualizerBands() {
  var list = document.getElementById('equalizer-band-list');
  if (!list || list.children.length) return;
  window.MineradioEqualizer.BAND_FREQUENCIES.forEach(function addBand(frequency, index) {
    var band = document.createElement('div');
    band.className = 'equalizer-band';
    var output = document.createElement('output');
    output.id = 'equalizer-gain-' + index;
    output.textContent = '0.0';
    var input = document.createElement('input');
    input.type = 'range';
    input.min = '-12';
    input.max = '12';
    input.step = '0.5';
    input.value = '0';
    input.dataset.eqBand = String(index);
    input.setAttribute('aria-label', formatEqualizerFrequency(frequency) + ' Hz 增益');
    var label = document.createElement('label');
    label.htmlFor = input.id = 'equalizer-band-' + index;
    label.textContent = formatEqualizerFrequency(frequency);
    band.append(output, input, label);
    list.appendChild(band);
  });
}

function updateEqualizerUi() {
  var gains = window.MineradioEqualizer.gainsForState(equalizerState);
  var button = document.getElementById('equalizer-btn');
  var toggle = document.getElementById('equalizer-switch');
  if (button) {
    button.classList.toggle('active', equalizerState.enabled);
    button.disabled = !equalizerAudioSupported;
    button.title = equalizerAudioSupported ? '均衡器' : '当前环境不支持均衡器';
  }
  if (toggle) {
    toggle.setAttribute('aria-checked', equalizerState.enabled ? 'true' : 'false');
    toggle.textContent = equalizerState.enabled ? '开启' : '关闭';
  }
  document.querySelectorAll('[data-eq-preset]').forEach(function syncPreset(item) {
    item.classList.toggle('active', item.dataset.eqPreset === equalizerState.selectedPreset);
  });
  gains.forEach(function syncBand(value, index) {
    var input = document.getElementById('equalizer-band-' + index);
    var output = document.getElementById('equalizer-gain-' + index);
    if (input) input.value = String(value);
    if (output) output.textContent = formatEqualizerGain(value);
  });
}

function setEqualizerEnabled(enabled) {
  equalizerState = window.MineradioEqualizer.setEnabled(equalizerState, enabled);
  saveEqualizerState();
  applyEqualizerAudioState(false);
  updateEqualizerUi();
}

function selectEqualizerPreset(presetId) {
  equalizerState = window.MineradioEqualizer.applyPreset(equalizerState, presetId);
  saveEqualizerState();
  applyEqualizerAudioState(false);
  updateEqualizerUi();
}

function setEqualizerBand(index, value, finalChange) {
  equalizerState = window.MineradioEqualizer.updateBand(equalizerState, index, value);
  if (finalChange) saveEqualizerState();
  else scheduleEqualizerSave();
  applyEqualizerAudioState(false);
  updateEqualizerUi();
}

function resetEqualizer() {
  equalizerState = window.MineradioEqualizer.reset(equalizerState);
  saveEqualizerState();
  applyEqualizerAudioState(false);
  updateEqualizerUi();
}

function toggleEqualizerPanel(event) {
  if (event) event.stopPropagation();
  if (!equalizerAudioSupported) {
    showToast('当前环境不支持均衡器');
    return;
  }
  var wrap = document.getElementById('equalizer-control');
  if (!wrap) return;
  if (wrap.classList.contains('open')) closeEqualizerPanel();
  else {
    wrap.classList.add('open');
    revealBottomControls(900);
    if (controlsHideTimer) {
      clearTimeout(controlsHideTimer);
      controlsHideTimer = null;
    }
  }
  var button = document.getElementById('equalizer-btn');
  if (button) button.setAttribute('aria-expanded', wrap.classList.contains('open') ? 'true' : 'false');
}

function isEqualizerPanelOpen() {
  var wrap = document.getElementById('equalizer-control');
  return !!(wrap && wrap.classList.contains('open'));
}

function closeEqualizerPanel() {
  var wrap = document.getElementById('equalizer-control');
  if (wrap) wrap.classList.remove('open');
  var button = document.getElementById('equalizer-btn');
  if (button) button.setAttribute('aria-expanded', 'false');
  if (controlsAutoHide) scheduleControlsHide(520);
}

function bindEqualizerControl() {
  renderEqualizerBands();
  var wrap = document.getElementById('equalizer-control');
  var toggle = document.getElementById('equalizer-switch');
  var reset = document.getElementById('equalizer-reset');
  var list = document.getElementById('equalizer-band-list');
  var presets = document.getElementById('equalizer-presets');
  if (toggle) toggle.addEventListener('click', function(){ setEqualizerEnabled(!equalizerState.enabled); });
  if (reset) reset.addEventListener('click', resetEqualizer);
  if (presets) presets.addEventListener('click', function(event){
    var button = event.target.closest('[data-eq-preset]');
    if (button) selectEqualizerPreset(button.dataset.eqPreset);
  });
  if (list) {
    list.addEventListener('input', function(event){
      if (event.target.matches('[data-eq-band]')) setEqualizerBand(Number(event.target.dataset.eqBand), Number(event.target.value), false);
    });
    list.addEventListener('change', function(event){
      if (event.target.matches('[data-eq-band]')) setEqualizerBand(Number(event.target.dataset.eqBand), Number(event.target.value), true);
    });
  }
  document.addEventListener('click', function(event){
    if (wrap && !wrap.contains(event.target)) closeEqualizerPanel();
  });
  document.addEventListener('keydown', function(event){
    if (event.code === 'Escape' && wrap && wrap.classList.contains('open')) {
      closeEqualizerPanel();
    }
  });
  updateEqualizerUi();
}
```

Call `bindEqualizerControl();` immediately after `bindQualityControl();` in the startup block.

Update the existing auto-hide callback so an open EQ panel keeps the bottom controls available:

```js
controlsHideTimer = setTimeout(function(){
  controlsHideTimer = null;
  if (!controlsHovering && !isEqualizerPanelOpen()) setControlsHidden(true);
}, delay == null ? 480 : delay);
```

- [ ] **Step 5: Run equalizer and lyric wiring tests**

```powershell
npm run test:equalizer
npm run test:lyrics
```

Expected: all tests pass. The lyric tests confirm that adding the new module and bottom control did not break the existing next-line feature.

- [ ] **Step 6: Commit the UI and persistence**

```powershell
git add public/index.html test/equalizer/app-wiring.test.js
git commit -m "feat: add equalizer controls and persistence"
```

### Task 4: Document user behavior and run repository regressions

**Files:**
- Modify: `docs/USAGE_GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the usage guide section**

Add before the current common-questions section in `docs/USAGE_GUIDE.md`:

```markdown
## 均衡器

播放器底栏的 `EQ` 按钮可以打开十段均衡器。均衡器首次使用默认为关闭，开启后会对当前播放器里的所有音源和本地歌曲生效。

- 选择“原声、低音增强、人声清晰、流行、摇滚、古典”可以立即试听预设。
- 拖动任意频段后会保存为一套“自定义”曲线。
- 关闭均衡器不会清除曲线，再次开启会恢复上次设置。
- “重置为原声”会把十个频段恢复为 `0 dB`。

均衡器是播放器本机的声音调整，不会改变歌曲文件，也不同于网易云、QQ 或酷狗的音质档位和官方音效。
```

- [ ] **Step 2: Add a current-development changelog entry**

Insert below `# Changelog`:

```markdown
## main / 2026-07-22 十段均衡器

- 播放器底栏新增独立十段均衡器，提供六个预设、一套自定义曲线、状态保存和一键重置。
- 均衡器对所有播放来源统一生效，默认关闭，不修改歌曲文件或平台音质设置。
- 增加自动余量和峰值保护，降低多频段增强造成爆音和削波的风险；节拍分析与粒子律动继续使用原始音频信号。
```

- [ ] **Step 3: Run all available Node test suites**

```powershell
npm run test:equalizer
npm run test:lyrics
npm run test:custom-source
node --test tests/home-library-playlist.test.js
```

Expected: every command exits with code 0.

- [ ] **Step 4: Commit documentation**

```powershell
git add docs/USAGE_GUIDE.md CHANGELOG.md
git commit -m "docs: explain equalizer controls"
```

### Task 5: Build and perform real playback acceptance

**Files:**
- Verify: `public/index.html`
- Build output: `dist/win-unpacked/`

- [ ] **Step 1: Build the unpacked Windows application**

```powershell
npm run build:win:dir
```

Expected: exit code 0 and `dist/win-unpacked/Mineradio.exe` exists.

- [ ] **Step 2: Launch the built executable**

```powershell
Start-Process -FilePath (Resolve-Path 'dist/win-unpacked/Mineradio.exe')
```

Expected: Mineradio opens visibly without a startup error so the acceptance steps can be performed.

- [ ] **Step 3: Verify default and persistence behavior**

On a clean equalizer state:

1. Confirm the `EQ` button is visible and not active.
2. Start one playable song and confirm its initial sound and particle response match the previous build.
3. Open EQ, enable it, select “低音增强”, and confirm the bass changes without a playback restart.
4. Move 1 kHz to `+3.0 dB`; confirm the active preset becomes “自定义”.
5. Close and reopen the app; confirm the enabled state and custom curve return.
6. Reset to “原声”; confirm all ten values return to `0.0`.

- [ ] **Step 4: Verify source coverage and protection**

Play at least one available track from each currently logged-in source plus one local file. Confirm every source uses the same saved EQ curve. Raise several bands to `+12 dB`, listen at a safe system volume, and confirm there is no obvious crackle, clipping, or severe compressor pumping. Confirm the 3D particle beat remains stable while switching between “低音增强” and “人声清晰”.

- [ ] **Step 5: Verify layout and diagnostics**

Check the normal desktop window, a narrow window, DIY mode, and immersive mode. The panel must remain inside the viewport, the band area must scroll horizontally when needed, and immersive mode must hide the EQ control consistently with quality and volume. Inspect the renderer console and confirm there are no new equalizer errors.

- [ ] **Step 6: Record final verification without publishing**

```powershell
git status --short --branch
git log -6 --oneline
```

Expected: only the planned commits are present and there are no untracked build or test artifacts. Do not push, publish a release, replace the installed application, or upload an installer until the user explicitly authorizes those external or system-wide actions.
