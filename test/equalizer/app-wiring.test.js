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

test('uses a safe default before equalizer UI state is initialized', () => {
  assert.match(indexHtml, /typeof equalizerState === 'undefined'/);
  assert.match(indexHtml, /MineradioEqualizer\.defaultState\(\)/);
});

test('falls back to the existing audible path when equalizer setup fails', () => {
  assert.match(indexHtml, /catch \(equalizerError\)[\s\S]*?analyser\.connect\(gainNode\)/);
});
