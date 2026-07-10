const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { resolvePublicTarget } = require('./network-policy');

const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const DEFAULT_MAX_HEADER_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT = 60_000;

function headerObject(headers) {
  if (!headers) return {};
  if (typeof headers.entries === 'function') return Object.fromEntries(headers.entries());
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [String(key), String(value)]));
}

function headerValue(headers, name) {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === lower) return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

function formDataBody(formData) {
  const boundary = `----mineradio${crypto.randomBytes(12).toString('hex')}`;
  const chunks = [];
  for (const [key, raw] of Object.entries(formData || {})) {
    const value = Buffer.isBuffer(raw) || raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(String(raw ?? ''));
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${String(key).replace(/["\r\n]/g, '')}"\r\n\r\n`));
    chunks.push(value, Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

function normalizeRequestOptions(options = {}, limits = {}) {
  const headers = headerObject(options.headers);
  const method = String(options.method || 'GET').toUpperCase();
  if (!/^[A-Z]+$/.test(method)) throw new Error('HTTP_FAILED: Invalid method');
  const requestedTimeout = Number(options.timeout);
  const timeout = Number.isFinite(requestedTimeout) ? Math.min(Math.max(requestedTimeout, 1), DEFAULT_TIMEOUT) : DEFAULT_TIMEOUT;
  let body = options.body;
  if (options.form && typeof options.form === 'object') {
    body = Buffer.from(new URLSearchParams(options.form).toString());
    if (!Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }
  } else if (options.formData && typeof options.formData === 'object') {
    const multipart = formDataBody(options.formData);
    body = multipart.body;
    if (!Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) headers['content-type'] = multipart.contentType;
  } else if (body != null && !Buffer.isBuffer(body)) {
    body = body instanceof Uint8Array ? Buffer.from(body) : Buffer.from(String(body));
  }
  if (body != null && !Buffer.isBuffer(body)) body = Buffer.from(body);
  const maxRequestBytes = limits.maxRequestBytes || DEFAULT_MAX_REQUEST_BYTES;
  if (body && body.length > maxRequestBytes) throw new Error('HTTP_FAILED: Request body too large');
  const headerBytes = Buffer.byteLength(JSON.stringify(headers));
  if (headerBytes > (limits.maxHeaderBytes || DEFAULT_MAX_HEADER_BYTES)) throw new Error('HTTP_FAILED: Request headers too large');
  if (body && !Object.keys(headers).some(key => key.toLowerCase() === 'content-length')) headers['content-length'] = String(body.length);
  return { method, headers, body, timeout };
}

function parseBody(buffer) {
  const text = Buffer.from(buffer).toString('utf8');
  try { return JSON.parse(text); } catch { return text; }
}

function decompressBody(buffer, headers, maxBytes) {
  const encoding = String(headerValue(headers, 'content-encoding') || '').toLowerCase();
  let result = buffer;
  if (encoding === 'gzip') result = zlib.gunzipSync(buffer, { maxOutputLength: maxBytes });
  else if (encoding === 'deflate') result = zlib.inflateSync(buffer, { maxOutputLength: maxBytes });
  else if (encoding === 'br') result = zlib.brotliDecompressSync(buffer, { maxOutputLength: maxBytes });
  if (result.length > maxBytes) throw new Error('HTTP_FAILED: Response too large');
  return result;
}

function defaultTransport({ target, method, headers, body, timeout, signal }) {
  return new Promise((resolve, reject) => {
    const lib = target.url.protocol === 'https:' ? https : http;
    const request = lib.request(target.url, {
      method,
      headers: { ...headers, host: target.url.host },
      servername: target.hostname,
      lookup: (_hostname, lookupOptions, callback) => {
        if (lookupOptions && lookupOptions.all) callback(null, [{ address: target.address, family: target.family }]);
        else callback(null, target.address, target.family);
      },
      timeout,
    }, response => {
      const chunks = [];
      let total = 0;
      response.on('data', chunk => {
        total += chunk.length;
        if (total > target.maxResponseBytes) {
          request.destroy(new Error('HTTP_FAILED: Response too large'));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => resolve({
        statusCode: response.statusCode || 0,
        statusMessage: response.statusMessage || '',
        headers: response.headers,
        body: Buffer.concat(chunks, total),
      }));
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('HTTP_FAILED: Timed out')));
    const abort = () => request.destroy(signal.reason || new Error('HTTP_FAILED: Cancelled'));
    if (signal) {
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
      request.once('close', () => signal.removeEventListener('abort', abort));
    }
    if (body) request.write(body);
    request.end();
  });
}

class SafeHttpBroker {
  constructor({
    lookup,
    transport = defaultTransport,
    maxConcurrent = 8,
    maxRedirects = 5,
    maxRequestBytes = DEFAULT_MAX_REQUEST_BYTES,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    maxHeaderBytes = DEFAULT_MAX_HEADER_BYTES,
  } = {}) {
    this.lookup = lookup;
    this.transport = transport;
    this.maxConcurrent = maxConcurrent;
    this.maxRedirects = maxRedirects;
    this.maxRequestBytes = maxRequestBytes;
    this.maxResponseBytes = maxResponseBytes;
    this.maxHeaderBytes = maxHeaderBytes;
    this.active = 0;
  }

  async request(url, options = {}, signal) {
    if (this.active >= this.maxConcurrent) throw new Error('HTTP_FAILED: Too many concurrent requests');
    const normalized = normalizeRequestOptions(options, this);
    this.active += 1;
    try {
      return await this.#requestHop(String(url), normalized, signal, 0);
    } finally {
      this.active -= 1;
    }
  }

  async #requestHop(url, options, signal, redirectCount) {
    const target = await resolvePublicTarget(url, { lookup: this.lookup });
    target.maxResponseBytes = this.maxResponseBytes;
    const response = await this.transport({ target, ...options, signal });
    const headers = headerObject(response.headers);
    const statusCode = Number(response.statusCode) || 0;
    const location = headerValue(headers, 'location');
    if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
      if (redirectCount >= this.maxRedirects) throw new Error('HTTP_FAILED: Too many redirects');
      const nextUrl = new URL(String(location), target.url).toString();
      const nextOptions = { ...options, headers: { ...options.headers } };
      if (statusCode === 303 || ((statusCode === 301 || statusCode === 302) && options.method === 'POST')) {
        nextOptions.method = 'GET';
        nextOptions.body = undefined;
        delete nextOptions.headers['content-length'];
      }
      return this.#requestHop(nextUrl, nextOptions, signal, redirectCount + 1);
    }
    const raw = Buffer.from(response.body || []);
    if (raw.length > this.maxResponseBytes) throw new Error('HTTP_FAILED: Response too large');
    const decoded = decompressBody(raw, headers, this.maxResponseBytes);
    return {
      response: {
        statusCode,
        statusMessage: String(response.statusMessage || ''),
        headers,
        bytes: decoded.length,
        raw: decoded,
      },
      body: parseBody(decoded),
    };
  }
}

module.exports = {
  SafeHttpBroker,
  normalizeRequestOptions,
  parseBody,
  defaultTransport,
};
