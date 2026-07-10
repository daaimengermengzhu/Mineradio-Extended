const dns = require('node:dns');
const net = require('node:net');

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.lan', '.home', '.internal'];

function parseIpv4(address) {
  if (net.isIP(address) !== 4) return null;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

function ipv4FromMappedIpv6(address) {
  const normalized = String(address || '').toLowerCase().split('%')[0];
  if (!normalized.startsWith('::ffff:')) return null;
  const tail = normalized.slice(7);
  if (net.isIP(tail) === 4) return tail;
  const parts = tail.split(':');
  if (parts.length !== 2 || parts.some(part => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  const high = parseInt(parts[0], 16);
  const low = parseInt(parts[1], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function isPublicIpv4(address) {
  const parts = parseIpv4(address);
  if (!parts) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function ipv6Segments(address) {
  let normalized = String(address || '').toLowerCase().split('%')[0];
  const mapped = ipv4FromMappedIpv6(normalized);
  if (mapped) {
    const parts = parseIpv4(mapped);
    normalized = `::ffff:${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  } else if (normalized.includes('.')) {
    return null;
  }
  if (net.isIP(normalized) !== 6) return null;
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const segments = [...left, ...Array(missing).fill('0'), ...right].map(part => parseInt(part || '0', 16));
  return segments.length === 8 && segments.every(Number.isFinite) ? segments : null;
}

function isPublicIpv6(address) {
  const mapped = ipv4FromMappedIpv6(address);
  if (mapped) return isPublicIpv4(mapped);
  const segments = ipv6Segments(address);
  if (!segments) return false;
  const [first, second] = segments;
  if (segments.every(value => value === 0)) return false;
  if (segments.slice(0, 7).every(value => value === 0) && segments[7] === 1) return false;
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  if ((first & 0xff00) === 0xff00) return false;
  if (first === 0x2001 && second === 0x0db8) return false;
  if (first === 0x2001 && second === 0) return false;
  if (first === 0x2002) return false;
  return true;
}

function isPublicAddress(address) {
  const value = String(address || '').replace(/^\[|\]$/g, '').split('%')[0];
  const family = net.isIP(value);
  if (family === 4) return isPublicIpv4(value);
  if (family === 6) return isPublicIpv6(value);
  return false;
}

function validateRemoteUrl(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 2048 ||
    value !== value.trim() ||
    !/^https?:\/\//i.test(value) ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('HTTP_FAILED: Invalid URL');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('HTTP_FAILED: Invalid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('HTTP_FAILED: Invalid URL');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    BLOCKED_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix)) ||
    (!net.isIP(hostname) && !hostname.includes('.')) ||
    (net.isIP(hostname) && !isPublicAddress(hostname))
  ) {
    throw new Error('HTTP_FAILED: Local or private targets are blocked');
  }
  return url;
}

async function resolvePublicTarget(value, { lookup = dns.promises.lookup } = {}) {
  const url = validateRemoteUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = net.isIP(hostname);
  const answers = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!Array.isArray(answers) || answers.length === 0) throw new Error('HTTP_FAILED: DNS returned no addresses');
  const normalized = answers.map(answer => ({
    address: String(answer?.address || ''),
    family: Number(answer?.family) || net.isIP(String(answer?.address || '')),
  }));
  if (normalized.some(answer => !answer.family || !isPublicAddress(answer.address))) {
    throw new Error('HTTP_FAILED: DNS resolved to a local, private or reserved address');
  }
  return { url, hostname, address: normalized[0].address, family: normalized[0].family, addresses: normalized };
}

module.exports = {
  isPublicAddress,
  validateRemoteUrl,
  resolvePublicTarget,
};
