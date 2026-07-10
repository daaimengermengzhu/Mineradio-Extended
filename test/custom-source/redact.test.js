const test = require('node:test');
const assert = require('node:assert/strict');
const { redactSecrets } = require('../../desktop/custom-source/redact');

test('redacts nested credentials without mutating safe fields or input', () => {
  const input = {
    headers: { Authorization: 'Bearer abc', Cookie: 'a=b', Accept: 'json' },
    access_token: 'secret',
    apiKey: 'key',
    author: 'writer',
  };
  const output = redactSecrets(input);
  assert.equal(output.headers.Authorization, '[REDACTED]');
  assert.equal(output.headers.Cookie, '[REDACTED]');
  assert.equal(output.headers.Accept, 'json');
  assert.equal(output.access_token, '[REDACTED]');
  assert.equal(output.apiKey, '[REDACTED]');
  assert.equal(output.author, 'writer');
  assert.equal(input.access_token, 'secret');
});

test('redacts circular references and credential key variants', () => {
  const input = { password: 'one', proxyAuth: 'two' };
  input.self = input;
  assert.deepEqual(redactSecrets(input), {
    password: '[REDACTED]',
    proxyAuth: '[REDACTED]',
    self: '[CIRCULAR]',
  });
});
