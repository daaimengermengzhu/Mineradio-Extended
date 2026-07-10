const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

function request(port, pathname, { method = 'GET', body, headers = {} } = {}) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers: {
        ...headers,
        ...(raw ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } : {}),
      },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        raw: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end(raw);
  });
}

test('custom source bridge resolves with official failure context and proxies audio by ticket', async t => {
  process.env.PORT = '0';
  process.env.HOST = '127.0.0.1';
  const server = require('../../server');
  t.after(async () => {
    server.setCustomSourceBridge?.(null);
    if (server.listening) await new Promise(resolve => server.close(resolve));
  });
  await new Promise(resolve => server.listening ? resolve() : server.once('listening', resolve));

  const calls = [];
  server.setCustomSourceBridge({
    async resolve(payload) {
      calls.push(['resolve', payload]);
      return {
        attempted: true,
        thirdParty: true,
        provider: 'lx-custom-source',
        source: 'kg',
        level: 'lossless',
        url: 'https://audio.example.com/song.flac',
      };
    },
    issue(url) {
      calls.push(['issue', url]);
      return 'ticket-1';
    },
    async pipe(ticket, req, res) {
      calls.push(['pipe', ticket, req.headers.range]);
      res.writeHead(206, { 'content-type': 'audio/flac', 'content-range': 'bytes 0-3/4' });
      res.end('data');
    },
  });
  const resolved = await request(server.address().port, '/api/custom-source/resolve', {
    method: 'POST',
    body: {
      song: { provider: 'kugouMusic', hash: 'abc' },
      quality: 'lossless',
      officialResult: { url: '', reason: 'url_unavailable' },
    },
  });
  assert.equal(resolved.status, 200);
  const body = JSON.parse(resolved.raw);
  assert.equal(body.url, '/api/custom-source/audio?ticket=ticket-1');
  assert.equal(body.thirdParty, true);
  assert.equal(calls[0][1].officialResult.reason, 'url_unavailable');
  assert.deepEqual(calls[1], ['issue', 'https://audio.example.com/song.flac']);

  const audio = await request(server.address().port, body.url, { headers: { range: 'bytes=0-3' } });
  assert.equal(audio.status, 206);
  assert.equal(audio.raw, 'data');
  assert.deepEqual(calls[2], ['pipe', 'ticket-1', 'bytes=0-3']);
});

test('custom source endpoints report inactive state without a configured bridge', async t => {
  process.env.PORT = '0';
  process.env.HOST = '127.0.0.1';
  delete require.cache[require.resolve('../../server')];
  const server = require('../../server');
  t.after(async () => {
    server.setCustomSourceBridge?.(null);
    if (server.listening) await new Promise(resolve => server.close(resolve));
  });
  await new Promise(resolve => server.listening ? resolve() : server.once('listening', resolve));

  const resolved = await request(server.address().port, '/api/custom-source/resolve', {
    method: 'POST',
    body: { song: { provider: 'netease', id: 1 }, quality: 'standard', officialResult: { reason: 'url_unavailable' } },
  });
  assert.equal(resolved.status, 200);
  assert.deepEqual(JSON.parse(resolved.raw), { attempted: false, reason: 'inactive' });

  const audio = await request(server.address().port, '/api/custom-source/audio?ticket=missing');
  assert.equal(audio.status, 404);
});
