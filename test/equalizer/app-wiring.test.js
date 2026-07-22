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
