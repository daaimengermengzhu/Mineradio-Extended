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

function resultCategory(result) {
  return String(result?.reason || result?.restriction?.category || '').trim().toLowerCase();
}

function shouldAttemptCustomSource({ enabled, officialResult } = {}) {
  if (!enabled || !officialResult || officialResult.url) return false;
  const category = resultCategory(officialResult);
  if (RIGHTS_RESTRICTIONS.has(category)) return false;
  if (TECHNICAL_FAILURES.has(category)) return true;
  return !category && !!officialResult.error;
}

module.exports = { RIGHTS_RESTRICTIONS, TECHNICAL_FAILURES, resultCategory, shouldAttemptCustomSource };
