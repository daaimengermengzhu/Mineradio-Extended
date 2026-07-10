const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { resolvePublicTarget, validateRemoteUrl } = require('./network-policy');

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_TICKETS = 100;
const DEFAULT_MAX_AUDIO_BYTES = 512 * 1024 * 1024;

function openPinnedResponse(url, {
  lookup,
  range = '',
  signal,
  redirectCount = 0,
  maxRedirects = 5,
  maxAudioBytes = DEFAULT_MAX_AUDIO_BYTES,
} = {}) {
  return resolvePublicTarget(url, { lookup }).then(target => new Promise((resolve, reject) => {
    const lib = target.url.protocol === 'https:' ? https : http;
    const headers = {
      host: target.url.host,
      accept: '*/*',
      'accept-encoding': 'identity',
      'user-agent': 'Mineradio-Custom-Source/1.0',
    };
    if (/^bytes=\d*-\d*$/i.test(range)) headers.range = range;
    const request = lib.request(target.url, {
      method: 'GET',
      headers,
      servername: target.hostname,
      lookup: (_hostname, lookupOptions, callback) => {
        if (lookupOptions && lookupOptions.all) callback(null, [{ address: target.address, family: target.family }]);
        else callback(null, target.address, target.family);
      },
      timeout: 30_000,
    }, response => {
      const statusCode = response.statusCode || 0;
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
        response.resume();
        if (redirectCount >= maxRedirects) {
          reject(new Error('AUDIO_PROXY_FAILED: Too many redirects'));
          return;
        }
        resolve(openPinnedResponse(new URL(String(location), target.url).toString(), {
          lookup,
          range,
          signal,
          redirectCount: redirectCount + 1,
          maxRedirects,
          maxAudioBytes,
        }));
        return;
      }
      const contentLength = Number(response.headers['content-length']) || 0;
      if (contentLength > maxAudioBytes) {
        response.destroy();
        reject(new Error('AUDIO_PROXY_FAILED: Audio response too large'));
        return;
      }
      resolve({ statusCode, headers: response.headers, stream: response, request });
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('AUDIO_PROXY_FAILED: Timed out')));
    const abort = () => request.destroy(signal.reason || new Error('AUDIO_PROXY_FAILED: Cancelled'));
    if (signal) {
      if (signal.aborted) { abort(); return; }
      signal.addEventListener('abort', abort, { once: true });
      request.once('close', () => signal.removeEventListener('abort', abort));
    }
    request.end();
  }));
}

function responseHeaders(remoteHeaders = {}) {
  const out = {
    'Content-Type': String(remoteHeaders['content-type'] || 'audio/mpeg'),
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Accept-Ranges': String(remoteHeaders['accept-ranges'] || 'bytes'),
    'Cache-Control': 'private, max-age=300',
  };
  if (remoteHeaders['content-length']) out['Content-Length'] = String(remoteHeaders['content-length']);
  if (remoteHeaders['content-range']) out['Content-Range'] = String(remoteHeaders['content-range']);
  return out;
}

class CustomSourceAudioProxy {
  constructor({
    now = Date.now,
    ttlMs = DEFAULT_TTL_MS,
    maxTickets = DEFAULT_MAX_TICKETS,
    maxAudioBytes = DEFAULT_MAX_AUDIO_BYTES,
    lookup,
    openRemote = openPinnedResponse,
  } = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxTickets = maxTickets;
    this.maxAudioBytes = maxAudioBytes;
    this.dnsLookup = lookup;
    this.openRemote = openRemote;
    this.tickets = new Map();
  }

  #prune() {
    const now = this.now();
    for (const [ticket, entry] of this.tickets) {
      if (entry.expiresAt <= now) this.tickets.delete(ticket);
    }
    while (this.tickets.size >= this.maxTickets) {
      this.tickets.delete(this.tickets.keys().next().value);
    }
  }

  issue(url) {
    validateRemoteUrl(url);
    this.#prune();
    const ticket = crypto.randomBytes(16).toString('hex');
    this.tickets.set(ticket, { url, expiresAt: this.now() + this.ttlMs });
    return ticket;
  }

  lookup(ticket) {
    if (!/^[a-f0-9]{32}$/.test(String(ticket || ''))) return null;
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.tickets.delete(ticket);
      return null;
    }
    return { ...entry };
  }

  async pipe(ticket, incoming, outgoing) {
    const entry = this.lookup(ticket);
    if (!entry) {
      outgoing.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      outgoing.end('Unknown or expired audio ticket');
      return;
    }
    const controller = new AbortController();
    const abort = () => controller.abort(new Error('AUDIO_PROXY_FAILED: Client disconnected'));
    const abortOutgoing = () => { if (!outgoing.writableEnded) abort(); };
    incoming?.once?.('aborted', abort);
    outgoing?.once?.('close', abortOutgoing);
    try {
      const remote = await this.openRemote(entry.url, {
        lookup: this.dnsLookup,
        range: incoming?.headers?.range || '',
        signal: controller.signal,
        maxAudioBytes: this.maxAudioBytes,
      });
      const statusCode = remote.statusCode === 206 ? 206 : (remote.statusCode >= 200 && remote.statusCode < 300 ? remote.statusCode : 502);
      outgoing.writeHead(statusCode, responseHeaders(remote.headers));
      let transferred = 0;
      const limiter = new Transform({
        transform: (chunk, _encoding, callback) => {
          transferred += chunk.length;
          if (transferred > this.maxAudioBytes) callback(new Error('AUDIO_PROXY_FAILED: Audio response too large'));
          else callback(null, chunk);
        },
      });
      limiter.on('error', error => {
        remote.stream.destroy(error);
        outgoing.destroy?.(error);
      });
      remote.stream.on('error', error => outgoing.destroy?.(error));
      remote.stream.pipe(limiter).pipe(outgoing);
      const cleanup = () => {
        incoming?.removeListener?.('aborted', abort);
        outgoing?.removeListener?.('close', abortOutgoing);
      };
      outgoing.once?.('finish', cleanup);
      outgoing.once?.('close', cleanup);
    } catch (error) {
      if (!outgoing.headersSent) {
        outgoing.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        outgoing.end('Custom source audio proxy failed');
      } else {
        outgoing.destroy?.(error);
      }
      incoming?.removeListener?.('aborted', abort);
      outgoing?.removeListener?.('close', abortOutgoing);
    }
  }

  clear() {
    this.tickets.clear();
  }
}

module.exports = {
  CustomSourceAudioProxy,
  openPinnedResponse,
  responseHeaders,
};
