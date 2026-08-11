const RIGHTS_RESTRICTIONS = new Set([
  'login_required',
  'vip_required',
  'paid_required',
  'trial_only',
  'copyright_unavailable',
  'credentials_required',
  'video_unavailable',
  'encrypted_audio_unsupported',
]);

const TECHNICAL_FAILURES = new Set([
  'url_unavailable',
  'network_error',
  'request_failed',
  'format_unsupported',
  'http_error',
  'timeout',
  'playback_error',
]);

const CUSTOM_SOURCE_PREFERENCES = new Set(['officialFirst', 'lxFirst', 'officialOnly']);

function resultCategory(result) {
  return String(result?.reason || result?.restriction?.category || '').trim().toLowerCase();
}

function normalizeCustomSourcePreference(preference) {
  return CUSTOM_SOURCE_PREFERENCES.has(preference) ? preference : 'officialFirst';
}

function officialPlaybackAvailable(result) {
  return !!(result && (result.url || result.playable === true));
}

function shouldAttemptCustomSource({ enabled, officialResult, preference } = {}) {
  if (!enabled || !officialResult) return false;
  preference = normalizeCustomSourcePreference(preference);
  if (preference === 'officialOnly') return false;
  if (officialResult.trial === true) return false;
  const category = resultCategory(officialResult);
  if (RIGHTS_RESTRICTIONS.has(category)) return false;
  if (officialPlaybackAvailable(officialResult)) return preference === 'lxFirst';
  if (TECHNICAL_FAILURES.has(category)) return true;
  return !category && !!officialResult.error;
}

module.exports = {
  RIGHTS_RESTRICTIONS,
  TECHNICAL_FAILURES,
  CUSTOM_SOURCE_PREFERENCES,
  resultCategory,
  normalizeCustomSourcePreference,
  officialPlaybackAvailable,
  shouldAttemptCustomSource,
};
