function shouldRedact(key) {
  const normalized = String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!normalized || normalized === 'author') return false;
  return normalized.includes('authorization') ||
    normalized === 'auth' || normalized.endsWith('auth') || normalized.includes('authentication') ||
    normalized.includes('cookie') || normalized.includes('token') || normalized.includes('secret') ||
    normalized.includes('apikey') || normalized.includes('password') || normalized.includes('passwd') ||
    normalized === 'pwd' || normalized.includes('credential');
}

function redactSecrets(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => redactSecrets(item, seen));
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = shouldRedact(key) ? '[REDACTED]' : redactSecrets(child, seen);
  }
  return result;
}

module.exports = { redactSecrets, shouldRedact };
