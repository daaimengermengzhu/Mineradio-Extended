'use strict';
// Manual provenance check: set QISHUI_QR_CONFIG_FILE to an existing local login,
// then run this file and open the printed loopback URL. No other music provider
// implementation or credentials are loaded. Never expose this test server.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

if (!process.env.QISHUI_QR_CONFIG_FILE) throw new Error('Set QISHUI_QR_CONFIG_FILE before this manual test');
const root = path.resolve(__dirname, '..', 'public');
const evidence = { mode: 'qishui-only', upstream: [], audio: [], denied: [], playback: [] };
const originalRequest = https.request;
https.request = function(target, ...args) {
  const url = new URL(target);
  evidence.upstream.push({ host: url.hostname, path: url.pathname });
  return originalRequest.call(this, target, ...args);
};
const originalFetch = global.fetch;
global.fetch = async function(target, options) {
  const response = await originalFetch(target, options);
  evidence.audio.push({ host: new URL(target).hostname, finalHost: new URL(response.url).hostname,
    status: response.status, type: response.headers.get('content-type') });
  return response;
};
const integration = require('../qishui-integration');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/__test/provenance') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(evidence));
    return;
  }
  if (url.pathname.startsWith('/api/qishui/')) {
    if (url.pathname === '/api/qishui/song/url') evidence.playback.push({ id: url.searchParams.get('id') });
    if (await integration.route(req, res, url)) return;
  }
  if (url.pathname.startsWith('/api/')) {
    evidence.denied.push(url.pathname);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NON_QISHUI_DISABLED_FOR_TEST', loggedIn: false }));
    return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await fs.promises.readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (_) { res.writeHead(404); res.end(); }
});
server.listen(Number(process.env.PORT) || 3137, '127.0.0.1', () => {
  console.log('Qishui-only playback verification: http://127.0.0.1:' + server.address().port);
});
process.on('SIGINT', async () => { await integration.dispose(); server.close(); process.exit(0); });
