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
