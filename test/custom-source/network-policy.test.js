const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isPublicAddress,
  validateRemoteUrl,
  resolvePublicTarget,
} = require('../../desktop/custom-source/network-policy');

test('accepts public addresses and rejects local, private and reserved addresses', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPublicAddress(address), true, address);
  }
  for (const address of [
    '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.10.1',
    '172.16.0.1', '192.168.1.1', '224.0.0.1', '::', '::1', 'fc00::1', 'fe80::1',
    '::ffff:127.0.0.1', '2001:db8::1',
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test('rejects local hostnames and non-http protocols before DNS lookup', () => {
  for (const value of [
    'http://localhost/a',
    'https://service.local/a',
    'http://router.lan/a',
    'file:///tmp/a',
    'data:text/plain,a',
    'ws://example.com/socket',
  ]) {
    assert.throws(() => validateRemoteUrl(value), /HTTP_FAILED/);
  }
  assert.equal(validateRemoteUrl('https://audio.example.com/a.mp3').hostname, 'audio.example.com');
});

test('rejects DNS answers containing private targets and returns a pinned public address', async () => {
  await assert.rejects(
    resolvePublicTarget('https://audio.example.com/a', {
      lookup: async () => [{ address: '203.0.113.9', family: 4 }, { address: '127.0.0.1', family: 4 }],
    }),
    /HTTP_FAILED/,
  );

  const target = await resolvePublicTarget('https://audio.example.com/a', {
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
  });
  assert.equal(target.address, '8.8.8.8');
  assert.equal(target.family, 4);
  assert.equal(target.hostname, 'audio.example.com');
});
