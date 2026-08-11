const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldAttemptCustomSource } = require('../../desktop/custom-source/playback-policy');

test('keeps official playback first by default and supports explicit per-platform preferences', () => {
  assert.equal(shouldAttemptCustomSource({ enabled: true, officialResult: { url: 'https://audio.example/a.mp3' } }), false);
  assert.equal(shouldAttemptCustomSource({ enabled: true, officialResult: { playable: true }, preference: 'officialFirst' }), false);
  assert.equal(shouldAttemptCustomSource({ enabled: true, officialResult: { playable: true }, preference: 'lxFirst' }), true);
  assert.equal(shouldAttemptCustomSource({ enabled: true, officialResult: { reason: 'url_unavailable' }, preference: 'officialOnly' }), false);
  assert.equal(shouldAttemptCustomSource({ enabled: false, officialResult: { reason: 'url_unavailable' } }), false);
});

test('does not use third-party fallback for account or rights restrictions', () => {
  assert.equal(shouldAttemptCustomSource({
    enabled: true,
    preference: 'lxFirst',
    officialResult: { playable: true, trial: true },
  }), false, 'trial flag');
  for (const reason of [
    'login_required',
    'vip_required',
    'paid_required',
    'trial_only',
    'copyright_unavailable',
    'credentials_required',
  ]) {
    assert.equal(shouldAttemptCustomSource({ enabled: true, officialResult: { url: '', reason } }), false, reason);
    assert.equal(shouldAttemptCustomSource({
      enabled: true,
      preference: 'lxFirst',
      officialResult: { playable: true, restriction: { category: reason } },
    }), false, `restriction:${reason}`);
  }
});

test('allows fallback only for technical playback failures', () => {
  for (const reason of ['url_unavailable', 'network_error', 'request_failed', 'format_unsupported', 'http_error']) {
    assert.equal(shouldAttemptCustomSource({ enabled: true, officialResult: { url: '', reason } }), true, reason);
  }
  assert.equal(shouldAttemptCustomSource({ enabled: true, officialResult: { url: '', error: 'socket hang up' } }), true);
  assert.equal(shouldAttemptCustomSource({ enabled: true, officialResult: { url: '', reason: 'unknown_business_rule' } }), false);
});
