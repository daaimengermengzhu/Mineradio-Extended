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

  function normalizeGains(values) {
    return values.map(function normalizeGain(value) {
      var number = Number(value);
      return clamp(Number.isFinite(number) ? number : 0, -12, 12);
    });
  }

  function copyGains(values) {
    var source = Array.isArray(values) && values.length === BAND_FREQUENCIES.length
      ? values
      : PRESETS.flat;
    return normalizeGains(source);
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
    if (!Number.isInteger(index)
      || index < 0
      || index >= BAND_FREQUENCIES.length
      || !Number.isFinite(value)) return state;

    var gains = gainsForState(state);
    gains[index] = clamp(value, -12, 12);
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
    var values = Array.isArray(gains) ? gains : PRESETS.flat;
    var highest = normalizeGains(values).reduce(function findHighest(result, value) {
      return Math.max(result, value);
    }, 0);
    return highest > 0 ? clamp(-0.75 * highest, -9, 0) : 0;
  }

  function shouldEnableLimiter(gains) {
    var values = Array.isArray(gains) ? gains : PRESETS.flat;
    return normalizeGains(values).some(function hasBoost(value) { return value > 0; });
  }

  var exportedPresets = Object.keys(PRESETS).reduce(function clonePresets(result, key) {
    result[key] = Object.freeze(copyGains(PRESETS[key]));
    return result;
  }, {});

  return {
    BAND_FREQUENCIES: Object.freeze(BAND_FREQUENCIES.slice()),
    PRESETS: Object.freeze(exportedPresets),
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
