const LX_API_VERSION = '2.0.0';
const LX_ENV = 'desktop';
const EVENT_NAMES = Object.freeze({ request: 'request', inited: 'inited', updateAlert: 'updateAlert' });
const SOURCE_KEYS = Object.freeze(['kw', 'kg', 'tx', 'wy', 'mg', 'local']);
const QUALITY_KEYS = Object.freeze(['128k', '320k', 'flac', 'flac24bit']);
const ACTIONS = Object.freeze({
  kw: ['musicUrl'],
  kg: ['musicUrl'],
  tx: ['musicUrl'],
  wy: ['musicUrl'],
  mg: ['musicUrl'],
  local: ['musicUrl', 'lyric', 'pic'],
});
const META_LIMITS = Object.freeze({ name: 24, description: 36, author: 56, homepage: 1024, version: 36 });
const TARGET_QUALITY = Object.freeze({
  standard: '128k',
  exhigh: '320k',
  lossless: 'flac',
  hires: 'flac24bit',
  jymaster: 'flac24bit',
});

function parseScriptInfo(script) {
  const header = /^\/\*[\s\S]+?\*\//.exec(String(script || ''));
  if (!header) throw new Error('IMPORT_INVALID: 无效的自定义音源脚本');
  const values = {};
  for (const line of header[0].split(/\r?\n/)) {
    const match = /^\s?\*\s?@(\w+)\s(.+)$/.exec(line);
    if (match && META_LIMITS[match[1]] != null) values[match[1]] = match[2].trim();
  }
  for (const [key, limit] of Object.entries(META_LIMITS)) {
    values[key] = String(values[key] || '');
    if (values[key].length > limit) values[key] = `${values[key].slice(0, limit - 3)}...`;
  }
  values.name ||= `user_api_${Date.now()}`;
  return values;
}

function filterInitPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.sources || typeof payload.sources !== 'object') {
    throw new Error('INIT_FAILED: Missing source information');
  }
  const sources = {};
  for (const key of SOURCE_KEYS) {
    const item = payload.sources[key];
    if (!item || item.type !== 'music') continue;
    const declaredActions = Array.isArray(item.actions) ? item.actions : [];
    const declaredQualities = Array.isArray(item.qualitys) ? item.qualitys : [];
    sources[key] = {
      name: String(item.name || key).slice(0, 64),
      type: 'music',
      actions: ACTIONS[key].filter(action => declaredActions.includes(action)),
      qualitys: key === 'local' ? [] : QUALITY_KEYS.filter(quality => declaredQualities.includes(quality)),
    };
  }
  return { openDevTools: false, sources };
}

function selectLxQuality(target, supported) {
  const desired = TARGET_QUALITY[target] || 'flac24bit';
  const maxIndex = QUALITY_KEYS.indexOf(desired);
  const declared = Array.isArray(supported) ? supported : [];
  for (let index = maxIndex; index >= 0; index -= 1) {
    if (declared.includes(QUALITY_KEYS[index])) return QUALITY_KEYS[index];
  }
  return null;
}

function validateActionResponse(action, value) {
  if (action !== 'musicUrl' && action !== 'pic') {
    throw new Error(`INVALID_RESPONSE: Unsupported action ${action}`);
  }
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 2048 ||
    value !== value.trim() ||
    !/^https?:\/\//i.test(value) ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('INVALID_RESPONSE: Expected a clean HTTP URL');
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('INVALID_RESPONSE: Expected a clean HTTP URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('INVALID_RESPONSE: Expected a clean HTTP URL');
  }
  return value;
}

module.exports = {
  LX_API_VERSION,
  LX_ENV,
  EVENT_NAMES,
  SOURCE_KEYS,
  QUALITY_KEYS,
  ACTIONS,
  parseScriptInfo,
  filterInitPayload,
  selectLxQuality,
  validateActionResponse,
};
