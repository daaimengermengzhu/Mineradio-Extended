const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const equalizer = require('../../public/equalizer-core');

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
  assert.match(indexHtml, /analyser\.connect\(candidateGraph\.filters\[0\]\)/);
  assert.match(indexHtml, /candidateGraph\.limiter\.connect\(gainNode\)/);
  assert.match(indexHtml, /filter\.type\s*=\s*'peaking'/);
  assert.match(indexHtml, /filter\.Q\.value\s*=\s*1\.4/);
});

test('applies headroom and limiter only through equalizer state', () => {
  assert.match(indexHtml, /function applyEqualizerAudioState\(/);
  assert.match(indexHtml, /MineradioEqualizer\.calculateHeadroomDb/);
  assert.match(indexHtml, /MineradioEqualizer\.shouldEnableLimiter/);
  assert.match(indexHtml, /(?:equalizerLimiter|graph\.limiter)\.ratio/);
});

test('uses a safe default before equalizer UI state is initialized', () => {
  assert.match(indexHtml, /typeof equalizerState === 'undefined'/);
  assert.match(indexHtml, /MineradioEqualizer\.defaultState\(\)/);
});

test('falls back to the existing audible path when equalizer setup fails', () => {
  assert.match(indexHtml, /catch \(equalizerError\)[\s\S]*?analyser\.connect\(gainNode\)/);
});

const audioFunctionsStart = indexHtml.indexOf('function setEqualizerAudioParam(');
const audioFunctionsEnd = indexHtml.indexOf('function resumeAudioAnalysis(');
assert.notEqual(audioFunctionsStart, -1, 'equalizer audio functions must exist');
assert.notEqual(audioFunctionsEnd, -1, 'audio function boundary must exist');
const audioFunctionsSource = indexHtml.slice(audioFunctionsStart, audioFunctionsEnd);

class FakeAudioParam {
  constructor(context, label, value) {
    this.context = context;
    this.label = label;
    this.value = value;
  }

  cancelScheduledValues() {
    this.context.events.push(this.label + ':cancelScheduledValues');
    this.context.maybeFail(this.label + ':cancelScheduledValues');
  }

  setValueAtTime(value) {
    this.value = value;
    this.context.events.push(this.label + ':setValueAtTime');
    this.context.maybeFail(this.label + ':setValueAtTime');
  }

  setTargetAtTime(value) {
    this.value = value;
    this.context.events.push(this.label + ':setTargetAtTime');
    this.context.maybeFail(this.label + ':setTargetAtTime');
  }
}

class FakeAudioNode {
  constructor(context, label) {
    this.context = context;
    this.label = label;
    this.connections = [];
    context.nodes.push(this);
  }

  connect(target) {
    const stage = this.label + '->' + target.label;
    this.context.connectCalls.push(stage);
    this.context.events.push(stage);
    this.connections.push(target);
    this.context.maybeFail(stage);
    return target;
  }

  disconnect(target) {
    this.context.disconnectCalls.push(this.label + (target ? '->' + target.label : '->*'));
    this.connections = target
      ? this.connections.filter((connection) => connection !== target)
      : [];
  }
}

class FakeAudioContext {
  constructor(failAt) {
    this.failAt = failAt;
    this.failed = false;
    this.currentTime = 1;
    this.nodes = [];
    this.connectCalls = [];
    this.disconnectCalls = [];
    this.events = [];
    this.filterCount = 0;
    this.analyserCount = 0;
    this.gainCount = 0;
    this.mediaSourceCreations = 0;
    this.destination = new FakeAudioNode(this, 'destination');
  }

  maybeFail(stage) {
    if (!this.failed && this.failAt === stage) {
      this.failed = true;
      throw new Error('injected failure at ' + stage);
    }
  }

  createMediaElementSource() {
    this.mediaSourceCreations += 1;
    return new FakeAudioNode(this, 'source');
  }

  createAnalyser() {
    const label = this.analyserCount === 0 ? 'analyser' : 'beatAnalyser';
    this.analyserCount += 1;
    return new FakeAudioNode(this, label);
  }

  createGain() {
    const label = this.gainCount === 0 ? 'gain' : 'headroom';
    this.gainCount += 1;
    const node = new FakeAudioNode(this, label);
    node.gain = new FakeAudioParam(this, label + '.gain', 1);
    return node;
  }

  createBiquadFilter() {
    const index = this.filterCount;
    this.maybeFail('create-filter-' + index);
    this.filterCount += 1;
    const node = new FakeAudioNode(this, 'filter-' + index);
    node.type = 'lowpass';
    node.frequency = new FakeAudioParam(this, node.label + '.frequency', 350);
    node.Q = new FakeAudioParam(this, node.label + '.Q', 1);
    node.gain = new FakeAudioParam(this, node.label + '.gain', 0);
    return node;
  }

  createDynamicsCompressor() {
    const node = new FakeAudioNode(this, 'limiter');
    node.threshold = new FakeAudioParam(this, 'limiter.threshold', -24);
    node.knee = new FakeAudioParam(this, 'limiter.knee', 30);
    node.ratio = new FakeAudioParam(this, 'limiter.ratio', 12);
    node.attack = new FakeAudioParam(this, 'limiter.attack', 0.003);
    node.release = new FakeAudioParam(this, 'limiter.release', 0.25);
    return node;
  }
}

function createAudioHarness(options = {}) {
  const audioContext = new FakeAudioContext(options.failAt);
  const warnings = [];
  const sandbox = {
    console: { warn: (...args) => warnings.push(args) },
    window: {
      AudioContext: function AudioContext() { return audioContext; },
      MineradioEqualizer: equalizer,
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    'use strict';
    var audio = {};
    var audioCtx = null;
    var source = null;
    var analyser = null;
    var beatAnalyser = null;
    var gainNode = null;
    var audioReady = false;
    var equalizerFilters = [];
    var equalizerHeadroom = null;
    var equalizerLimiter = null;
    var equalizerAudioSupported = true;
    var FFT_SIZE = 2048;
    var BEAT_FFT_SIZE = 1024;
    var frequencyData = { fill: function fill() {} };
    var beatFrequencyData = { fill: function fill() {} };
    var beatTimeDomainData = { fill: function fill() {} };
    var volumeApplyCount = 0;
    var beatResetCount = 0;
    function applyVolumeToAudio() { volumeApplyCount += 1; }
    function resetRealtimeBeatEngine() { beatResetCount += 1; }
    ${audioFunctionsSource}
  `, sandbox);
  if (options.state) sandbox.equalizerState = options.state;
  return { audioContext, sandbox, warnings };
}

function countPaths(from, destination, visited = new Set()) {
  if (from === destination) return 1;
  if (visited.has(from)) return 0;
  const nextVisited = new Set(visited);
  nextVisited.add(from);
  return from.connections.reduce(
    (count, connection) => count + countPaths(connection, destination, nextVisited),
    0,
  );
}

function connectionCount(audioContext) {
  return audioContext.nodes.reduce((count, node) => count + node.connections.length, 0);
}

function assertSingleFallback(harness) {
  const { audioContext, sandbox } = harness;
  assert.equal(sandbox.audioReady, true);
  assert.equal(sandbox.equalizerAudioSupported, false);
  assert.equal(sandbox.equalizerFilters.length, 0);
  assert.equal(sandbox.equalizerHeadroom, null);
  assert.equal(sandbox.equalizerLimiter, null);
  assert.equal(sandbox.analyser.connections.length, 1);
  assert.equal(sandbox.analyser.connections[0], sandbox.gainNode);
  assert.equal(
    audioContext.connectCalls.filter((stage) => stage === 'analyser->gain').length,
    1,
  );
  assert.equal(countPaths(sandbox.source, audioContext.destination), 1);
  assert.equal(countPaths(sandbox.beatAnalyser, audioContext.destination), 0);
  audioContext.nodes
    .filter((node) => /^(filter-|headroom|limiter)/.test(node.label))
    .forEach((node) => assert.equal(node.connections.length, 0, node.label + ' must be disconnected'));
}

test('builds one ordered ten-band audible route while beat analysis stays isolated', () => {
  const harness = createAudioHarness();
  const { audioContext, sandbox } = harness;

  sandbox.initAudio();

  assert.equal(countPaths(sandbox.source, audioContext.destination), 1);
  assert.equal(countPaths(sandbox.beatAnalyser, audioContext.destination), 0);
  assert.deepEqual(
    Array.from(sandbox.equalizerFilters, (filter) => filter.frequency.value),
    equalizer.BAND_FREQUENCIES,
  );
  sandbox.equalizerFilters.forEach((filter, index) => {
    const expected = index === sandbox.equalizerFilters.length - 1
      ? sandbox.equalizerHeadroom
      : sandbox.equalizerFilters[index + 1];
    assert.equal(filter.connections.length, 1);
    assert.equal(filter.connections[0], expected);
  });
  assert.equal(sandbox.analyser.connections.length, 1);
  assert.equal(sandbox.analyser.connections[0], sandbox.equalizerFilters[0]);
  assert.equal(sandbox.equalizerHeadroom.connections.length, 1);
  assert.equal(sandbox.equalizerHeadroom.connections[0], sandbox.equalizerLimiter);
  assert.equal(sandbox.equalizerLimiter.connections.length, 1);
  assert.equal(sandbox.equalizerLimiter.connections[0], sandbox.gainNode);
  assert.equal(sandbox.gainNode.connections.length, 1);
  assert.equal(sandbox.gainNode.connections[0], audioContext.destination);
});

test('keeps the default disabled equalizer acoustically transparent', () => {
  const { sandbox } = createAudioHarness();

  sandbox.initAudio();

  assert.deepEqual(Array.from(sandbox.equalizerFilters, (filter) => filter.gain.value), Array(10).fill(0));
  assert.equal(sandbox.equalizerHeadroom.gain.value, 1);
  assert.equal(sandbox.equalizerLimiter.ratio.value, 1);
});

test('applies headroom and limiting to an enabled boosted candidate before it becomes audible', () => {
  const gains = [4, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const { audioContext, sandbox } = createAudioHarness({
    state: {
      version: 1,
      enabled: true,
      selectedPreset: 'custom',
      customGains: gains,
    },
  });

  sandbox.initAudio();

  assert.deepEqual(Array.from(sandbox.equalizerFilters, (filter) => filter.gain.value), gains);
  assert.ok(Math.abs(sandbox.equalizerHeadroom.gain.value - Math.pow(10, -3 / 20)) < 1e-12);
  assert.equal(sandbox.equalizerLimiter.ratio.value, 20);
  assert.ok(
    audioContext.events.indexOf('limiter.ratio:setValueAtTime')
      < audioContext.events.indexOf('analyser->filter-0'),
    'initial limiter state must be applied before the candidate graph becomes audible',
  );
});

[
  ['node creation', 'create-filter-4'],
  ['candidate chain connection', 'filter-0->filter-1'],
  ['initial parameter application', 'filter-4.gain:setValueAtTime'],
  ['analyser input connection', 'analyser->filter-0'],
  ['limiter output connection', 'limiter->gain'],
].forEach(([label, failAt]) => {
  test('cleans candidates and installs one fallback after ' + label + ' failure', () => {
    const harness = createAudioHarness({ failAt });

    harness.sandbox.initAudio();

    assertSingleFallback(harness);
  });
});

test('does not create or connect audio nodes again after initAudio succeeds', () => {
  const harness = createAudioHarness();
  const { audioContext, sandbox } = harness;
  sandbox.initAudio();
  const nodeCount = audioContext.nodes.length;
  const edgeCount = connectionCount(audioContext);
  const connectCallCount = audioContext.connectCalls.length;

  sandbox.initAudio();

  assert.equal(audioContext.nodes.length, nodeCount);
  assert.equal(connectionCount(audioContext), edgeCount);
  assert.equal(audioContext.connectCalls.length, connectCallCount);
  assert.equal(audioContext.mediaSourceCreations, 1);
  assert.equal(sandbox.volumeApplyCount, 1);
  assert.equal(sandbox.beatResetCount, 1);
});

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

test('uses the corrected equalizer labels and responsive overflow contract', () => {
  [
    '均衡器',
    '十段均衡器',
    '关闭',
    '原声',
    '低音增强',
    '人声清晰',
    '流行',
    '摇滚',
    '古典',
    '自定义',
    '自动保护',
    '重置为原声',
    '当前环境不支持均衡器',
  ].forEach((label) => assert.ok(indexHtml.includes(label), 'missing corrected label: ' + label));
  assert.match(indexHtml, /formatEqualizerFrequency\(frequency\) \+ ' Hz 增益'/);
  assert.match(indexHtml, /\.equalizer-band-scroll\{[^}]*overflow-x:auto/);
  assert.match(indexHtml, /grid-template-columns:repeat\(10,48px\)/);
  assert.match(indexHtml, /body\.immersive-mode #equalizer-control\{display:none!important\}/);
});

function extractSource(startMarker, endMarker) {
  const start = indexHtml.indexOf(startMarker);
  const end = indexHtml.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, 'missing source marker: ' + startMarker);
  assert.notEqual(end, -1, 'missing source boundary: ' + endMarker);
  return indexHtml.slice(start, end);
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.contains(name) : Boolean(force);
    if (enabled) this.add(name);
    else this.remove(name);
    return enabled;
  }
}

class FakeElement {
  constructor(tagName, id = '') {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = id;
    this.children = [];
    this.parentElement = null;
    this.classList = new FakeClassList();
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.inert = false;
    this.title = '';
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  addEventListener(type, listener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  dispatch(type, event = {}) {
    const nextEvent = Object.assign({ target: this }, event);
    (this.listeners[type] || []).forEach((listener) => listener(nextEvent));
  }

  matches(selector) {
    return selector === '[data-eq-band]' && this.dataset.eqBand !== undefined;
  }

  closest(selector) {
    if (selector === '[data-eq-preset]' && this.dataset.eqPreset !== undefined) return this;
    return this.parentElement ? this.parentElement.closest(selector) : null;
  }

  contains(target) {
    for (let node = target; node; node = node.parentElement) {
      if (node === this) return true;
    }
    return false;
  }
}

function createFakeDocument() {
  const elements = [];
  const listeners = {};
  const document = {
    body: new FakeElement('body', 'body'),
    createElement(tagName) {
      const element = new FakeElement(tagName);
      elements.push(element);
      return element;
    },
    getElementById(id) {
      return elements.find((element) => element.id === id) || null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-eq-preset]') {
        return elements.filter((element) => element.dataset.eqPreset !== undefined);
      }
      if (selector === '#equalizer-panel button, #equalizer-panel input') {
        const panel = this.getElementById('equalizer-panel');
        return elements.filter((element) => (
          (element.tagName === 'BUTTON' || element.tagName === 'INPUT')
          && panel
          && panel.contains(element)
        ));
      }
      return [];
    },
    addEventListener(type, listener) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(listener);
    },
    dispatch(type, event) {
      (listeners[type] || []).forEach((listener) => listener(event));
    },
  };
  elements.push(document.body);

  function add(tagName, id, parent = document.body) {
    const element = new FakeElement(tagName, id);
    elements.push(element);
    parent.appendChild(element);
    return element;
  }

  const wrap = add('div', 'equalizer-control');
  const button = add('button', 'equalizer-btn', wrap);
  const panel = add('div', 'equalizer-panel', wrap);
  const toggle = add('button', 'equalizer-switch', panel);
  const presets = add('div', 'equalizer-presets', panel);
  ['flat', 'bass', 'vocal', 'pop', 'rock', 'classical', 'custom'].forEach((presetId) => {
    const preset = add('button', '', presets);
    preset.dataset.eqPreset = presetId;
  });
  const list = add('div', 'equalizer-band-list', panel);
  const protection = add('span', 'equalizer-protection-state', panel);
  const reset = add('button', 'equalizer-reset', panel);
  const outside = add('div', 'outside');

  return { document, elements, wrap, button, panel, toggle, presets, list, protection, reset, outside };
}

function createEqualizerUiHarness(options = {}) {
  const key = 'mineradio-equalizer-state-v1';
  const stored = new Map();
  if (Object.hasOwn(options, 'storedValue')) stored.set(key, options.storedValue);
  const writes = [];
  const timers = new Map();
  const clearedTimers = [];
  const dom = createFakeDocument();
  const toasts = [];
  let nextTimerId = 1;
  const sandbox = {
    console,
    document: dom.document,
    localStorage: {
      getItem(storageKey) {
        return stored.has(storageKey) ? stored.get(storageKey) : null;
      },
      setItem(storageKey, value) {
        stored.set(storageKey, value);
        writes.push([storageKey, value]);
      },
    },
    setTimeout(callback) {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      clearedTimers.push(id);
      timers.delete(id);
    },
    window: { MineradioEqualizer: equalizer },
  };
  vm.createContext(sandbox);
  const stateSource = extractSource('var EQUALIZER_STORE_KEY', 'function readDiyModePreference(');
  const uiSource = extractSource('function formatEqualizerFrequency(', 'function isTypingTarget(');
  vm.runInContext(`
    var equalizerAudioSupported = ${options.supported === false ? 'false' : 'true'};
    var controlsHideTimer = 77;
    var controlsAutoHide = true;
    var audioApplyCount = 0;
    var revealCount = 0;
    var scheduledHideDelays = [];
    function applyEqualizerAudioState() { audioApplyCount += 1; }
    function revealBottomControls() { revealCount += 1; }
    function scheduleControlsHide(delay) { scheduledHideDelays.push(delay); }
    function showToast(message) { toasts.push(message); }
    ${stateSource}
    ${uiSource}
  `, Object.assign(sandbox, { toasts }));
  return { sandbox, stored, writes, timers, clearedTimers, dom, toasts };
}

test('loads invalid equalizer JSON as a disabled version-one state and saves normalized state', () => {
  const harness = createEqualizerUiHarness({ storedValue: '{invalid' });

  assert.deepEqual(
    JSON.parse(JSON.stringify(harness.sandbox.equalizerState)),
    equalizer.defaultState(),
  );
  harness.sandbox.setEqualizerEnabled(true);

  assert.equal(harness.writes.length, 1);
  assert.deepEqual(JSON.parse(harness.writes[0][1]), {
    version: 1,
    enabled: true,
    selectedPreset: 'flat',
    customGains: Array(10).fill(0),
  });
});

test('applies slider input live, debounces storage, and flushes on change', () => {
  const harness = createEqualizerUiHarness();
  harness.sandbox.bindEqualizerControl();
  const input = harness.dom.document.getElementById('equalizer-band-2');
  assert.ok(input);

  input.value = '3.5';
  harness.dom.list.dispatch('input', { target: input });
  input.value = '4';
  harness.dom.list.dispatch('input', { target: input });

  assert.equal(harness.sandbox.audioApplyCount, 2);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.timers.size, 1);
  assert.equal(harness.clearedTimers.length, 1);

  harness.dom.list.dispatch('change', { target: input });

  assert.equal(harness.sandbox.audioApplyCount, 3);
  assert.equal(harness.timers.size, 0);
  assert.equal(harness.writes.length, 1);
  const persisted = JSON.parse(harness.writes[0][1]);
  assert.equal(persisted.selectedPreset, 'custom');
  assert.equal(persisted.customGains[2], 4);
});

test('reset selects original without changing the enabled toggle', () => {
  const harness = createEqualizerUiHarness();

  harness.sandbox.setEqualizerEnabled(true);
  harness.sandbox.selectEqualizerPreset('rock');
  harness.sandbox.resetEqualizer();

  assert.equal(harness.sandbox.equalizerState.enabled, true);
  assert.equal(harness.sandbox.equalizerState.selectedPreset, 'flat');
  assert.equal(harness.dom.toggle.getAttribute('aria-checked'), 'true');
  assert.equal(harness.dom.toggle.textContent, '开启');
});

test('opens independently and closes on outside click or Escape with synchronized aria state', () => {
  const harness = createEqualizerUiHarness();
  harness.sandbox.bindEqualizerControl();
  let stopped = 0;

  harness.sandbox.toggleEqualizerPanel({ stopPropagation() { stopped += 1; } });
  assert.equal(stopped, 1);
  assert.equal(harness.dom.wrap.classList.contains('open'), true);
  assert.equal(harness.dom.button.getAttribute('aria-expanded'), 'true');
  assert.equal(harness.sandbox.revealCount, 1);
  assert.ok(harness.clearedTimers.includes(77));

  harness.dom.document.dispatch('click', { target: harness.dom.outside });
  assert.equal(harness.dom.wrap.classList.contains('open'), false);
  assert.equal(harness.dom.button.getAttribute('aria-expanded'), 'false');

  harness.sandbox.toggleEqualizerPanel({ stopPropagation() {} });
  harness.dom.document.dispatch('keydown', { code: 'Escape' });
  assert.equal(harness.dom.wrap.classList.contains('open'), false);
  assert.equal(harness.dom.button.getAttribute('aria-expanded'), 'false');
});

test('shows a safe disabled state when Web Audio equalizer support is unavailable', () => {
  const harness = createEqualizerUiHarness({ supported: false });
  harness.sandbox.bindEqualizerControl();

  assert.equal(harness.dom.button.disabled, true);
  assert.equal(harness.dom.button.title, '当前环境不支持均衡器');
  harness.sandbox.toggleEqualizerPanel({ stopPropagation() {} });
  assert.equal(harness.dom.wrap.classList.contains('open'), false);
  assert.deepEqual(harness.toasts, ['当前环境不支持均衡器']);
});

test('closes and disables the open panel when equalizer audio support fails at runtime', () => {
  const harness = createEqualizerUiHarness();
  harness.sandbox.bindEqualizerControl();
  harness.sandbox.toggleEqualizerPanel({ stopPropagation() {} });
  assert.equal(harness.dom.wrap.classList.contains('open'), true);

  harness.sandbox.equalizerAudioSupported = false;
  harness.sandbox.updateEqualizerUi();

  assert.equal(harness.dom.wrap.classList.contains('open'), false);
  assert.equal(harness.dom.button.getAttribute('aria-expanded'), 'false');
  assert.equal(harness.dom.panel.getAttribute('aria-hidden'), 'true');
  assert.equal(harness.dom.panel.getAttribute('aria-disabled'), 'true');
  assert.equal(harness.dom.panel.inert, true);
  const panelControls = harness.dom.document.querySelectorAll('#equalizer-panel button, #equalizer-panel input');
  assert.equal(panelControls.length, 19);
  panelControls.forEach((control) => assert.equal(control.disabled, true));

  const writesBeforeDisabledEvents = harness.writes.length;
  const audioUpdatesBeforeDisabledEvents = harness.sandbox.audioApplyCount;
  const firstPreset = harness.dom.document.querySelectorAll('[data-eq-preset]')[0];
  const firstBand = harness.dom.document.getElementById('equalizer-band-0');
  harness.dom.toggle.dispatch('click');
  harness.dom.presets.dispatch('click', { target: firstPreset });
  harness.dom.list.dispatch('input', { target: firstBand });
  harness.dom.list.dispatch('change', { target: firstBand });
  harness.dom.reset.dispatch('click');
  assert.equal(harness.writes.length, writesBeforeDisabledEvents);
  assert.equal(harness.sandbox.audioApplyCount, audioUpdatesBeforeDisabledEvents);

  harness.sandbox.equalizerAudioSupported = true;
  harness.sandbox.updateEqualizerUi();
  assert.equal(harness.dom.panel.getAttribute('aria-disabled'), 'false');
  assert.equal(harness.dom.panel.inert, false);
  panelControls.forEach((control) => assert.equal(control.disabled, false));
});

test('does not auto-hide bottom controls while the equalizer panel is open', () => {
  const source = extractSource('function scheduleControlsHide(', 'function revealBottomControls(');
  let timerCallback = null;
  const hiddenStates = [];
  const sandbox = {
    controlsHideTimer: null,
    controlsAutoHide: true,
    controlsHovering: false,
    clearTimeout() {},
    setTimeout(callback) {
      timerCallback = callback;
      return 1;
    },
    isEqualizerPanelOpen() { return true; },
    setControlsHidden(value) { hiddenStates.push(value); },
  };
  vm.runInNewContext(source, sandbox);

  sandbox.scheduleControlsHide(10);
  timerCallback();

  assert.deepEqual(hiddenStates, []);
});
