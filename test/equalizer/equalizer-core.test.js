const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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

test('ignores invalid band updates and preserves remembered custom gains', () => {
  const raw = {
    version: 1,
    enabled: true,
    selectedPreset: 'rock',
    customGains: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  };
  const expected = eq.normalizeState(raw);

  [-1, 10, 1.5].forEach((index) => {
    assert.deepEqual(eq.updateBand(raw, index, 4), expected);
  });
  [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '4'].forEach((value) => {
    assert.deepEqual(eq.updateBand(raw, 3, value), expected);
  });
});

test('setEnabled and reset preserve unrelated normalized state', () => {
  const rememberedGains = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const enabled = eq.setEnabled({
    version: 1,
    enabled: false,
    selectedPreset: 'custom',
    customGains: rememberedGains,
  }, true);

  assert.equal(enabled.enabled, true);
  assert.equal(eq.setEnabled(enabled, 'yes').enabled, false);

  const reset = eq.reset(enabled);
  assert.equal(reset.enabled, true);
  assert.equal(reset.selectedPreset, 'flat');
  assert.deepEqual(reset.customGains, rememberedGains);
  assert.deepEqual(eq.gainsForState(reset), eq.PRESETS.flat);
});

test('returns isolated state and gain arrays', () => {
  const inputGains = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const normalized = eq.normalizeState({
    version: 1,
    enabled: false,
    selectedPreset: 'custom',
    customGains: inputGains,
  });
  inputGains[0] = -12;
  assert.equal(normalized.customGains[0], 1);

  const firstDefault = eq.defaultState();
  firstDefault.customGains[0] = 12;
  assert.equal(eq.defaultState().customGains[0], 0);

  const rockState = eq.applyPreset(eq.defaultState(), 'rock');
  const rockGains = eq.gainsForState(rockState);
  rockGains[0] = -12;
  assert.equal(eq.gainsForState(rockState)[0], 3);
});

test('replaces malformed custom gain shapes with a flat ten-band curve', () => {
  [null, {}, [1, 2, 3], Array(11).fill(1)].forEach((customGains) => {
    const state = eq.normalizeState({
      version: 1,
      enabled: false,
      selectedPreset: 'custom',
      customGains: customGains,
    });
    assert.deepEqual(state.customGains, eq.PRESETS.flat);
  });
});

test('exposes immutable frequency and preset snapshots', () => {
  assert.equal(Object.isFrozen(eq.BAND_FREQUENCIES), true);
  assert.equal(Object.isFrozen(eq.PRESETS), true);
  Object.values(eq.PRESETS).forEach((gains) => {
    assert.equal(Object.isFrozen(gains), true);
  });

  assert.equal(Reflect.set(eq.BAND_FREQUENCIES, 0, 999), false);
  assert.equal(Reflect.set(eq.PRESETS.rock, 0, 999), false);
  assert.equal(Reflect.set(eq.PRESETS, 'rock', []), false);
  assert.equal(eq.BAND_FREQUENCIES[0], 31);
  assert.equal(eq.gainsForState(eq.applyPreset(eq.defaultState(), 'rock'))[0], 3);
});

test('attaches the UMD API to a browser global', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../public/equalizer-core.js'), 'utf8');
  const window = {};

  vm.runInNewContext(source, { window: window });

  assert.equal(typeof window.MineradioEqualizer.defaultState, 'function');
  assert.equal(window.MineradioEqualizer.defaultState().enabled, false);
  assert.equal(window.MineradioEqualizer.BAND_FREQUENCIES.length, 10);
  assert.equal(window.MineradioEqualizer.PRESETS.rock[0], 3);
});

test('calculates conservative automatic headroom', () => {
  assert.equal(eq.calculateHeadroomDb([0, -2, -6]), 0);
  assert.equal(eq.calculateHeadroomDb([0, 5, 2]), -3.75);
  assert.equal(eq.calculateHeadroomDb([12, 4, 0]), -9);
  assert.equal(eq.shouldEnableLimiter([0, -1, -4]), false);
  assert.equal(eq.shouldEnableLimiter([0, 0.1, -4]), true);
});
