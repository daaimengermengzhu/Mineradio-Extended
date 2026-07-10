const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { SafeHttpBroker, normalizeRequestOptions, defaultTransport } = require('../../desktop/custom-source/http-broker');

const publicLookup = async hostname => [{
  address: hostname === 'cdn.example.com' ? '1.1.1.1' : '8.8.8.8',
  family: 4,
}];

test('pins the validated address and parses JSON responses', async () => {
  const seen = [];
  const broker = new SafeHttpBroker({
    lookup: publicLookup,
    transport: async request => {
      seen.push(request.target);
      return {
        statusCode: 200,
        statusMessage: 'OK',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from('{"ok":true}'),
      };
    },
  });
  const result = await broker.request('https://api.example.com/data', { method: 'GET' });
  assert.equal(seen[0].address, '8.8.8.8');
  assert.equal(seen[0].hostname, 'api.example.com');
  assert.deepEqual(result.body, { ok: true });
  assert.equal(result.response.statusCode, 200);
});

test('validates every redirect before issuing the next request', async () => {
  let transports = 0;
  const broker = new SafeHttpBroker({
    lookup: async hostname => [{ address: hostname === 'private.example.com' ? '127.0.0.1' : '8.8.8.8', family: 4 }],
    transport: async () => {
      transports += 1;
      return { statusCode: 302, statusMessage: 'Found', headers: { location: 'http://private.example.com/admin' }, body: Buffer.alloc(0) };
    },
  });
  await assert.rejects(broker.request('https://api.example.com/start'), /local, private or reserved/i);
  assert.equal(transports, 1);
});

test('enforces request and response size limits', async () => {
  const broker = new SafeHttpBroker({
    lookup: publicLookup,
    maxRequestBytes: 16,
    maxResponseBytes: 32,
    transport: async () => ({
      statusCode: 200,
      statusMessage: 'OK',
      headers: {},
      body: Buffer.alloc(33),
    }),
  });
  await assert.rejects(broker.request('https://api.example.com', { body: 'x'.repeat(17) }), /Request body too large/);
  await assert.rejects(broker.request('https://api.example.com'), /Response too large/);
});

test('limits concurrent requests per broker instance', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const broker = new SafeHttpBroker({
    lookup: publicLookup,
    maxConcurrent: 1,
    transport: async () => {
      await pending;
      return { statusCode: 200, statusMessage: 'OK', headers: {}, body: Buffer.from('ok') };
    },
  });
  const first = broker.request('https://api.example.com/one');
  await assert.rejects(broker.request('https://api.example.com/two'), /Too many concurrent requests/);
  release();
  await first;
});

test('normalizes form and multipart request bodies within limits', () => {
  const form = normalizeRequestOptions({ method: 'post', form: { a: 'b c' }, timeout: 90_000 });
  assert.equal(form.method, 'POST');
  assert.equal(form.timeout, 60_000);
  assert.equal(form.body.toString(), 'a=b+c');
  assert.equal(form.headers['content-type'], 'application/x-www-form-urlencoded');

  const multipart = normalizeRequestOptions({ formData: { file: 'hello' } });
  assert.match(multipart.headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.match(multipart.body.toString(), /hello/);
  assert.throws(() => normalizeRequestOptions({ method: 'GET BAD' }), /Invalid method/);
});

test('default transport pins the supplied address and streams a bounded response', async t => {
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.host, `localhost:${server.address().port}`);
    res.end('transport-ok');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const target = {
    url: new URL(`http://localhost:${server.address().port}/test`),
    hostname: 'localhost',
    address: '127.0.0.1',
    family: 4,
    maxResponseBytes: 1024,
  };
  const response = await defaultTransport({ target, method: 'GET', headers: {}, timeout: 1000 });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.toString(), 'transport-ok');
});
