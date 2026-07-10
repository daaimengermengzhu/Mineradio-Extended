const test = require('node:test');
const assert = require('node:assert/strict');
const { CustomSourceAudioProxy } = require('../../desktop/custom-source/audio-proxy');

test('issues short-lived bounded tickets without exposing the remote URL', () => {
  let now = 1000;
  const proxy = new CustomSourceAudioProxy({ now: () => now, ttlMs: 5000, maxTickets: 2 });
  const first = proxy.issue('https://audio.example.com/one.mp3');
  const second = proxy.issue('https://audio.example.com/two.mp3');
  const third = proxy.issue('https://audio.example.com/three.mp3');
  assert.match(first, /^[a-f0-9]{32}$/);
  assert.equal(proxy.lookup(first), null);
  assert.equal(proxy.lookup(second).url, 'https://audio.example.com/two.mp3');
  assert.equal(proxy.lookup(third).url, 'https://audio.example.com/three.mp3');
  now += 6000;
  assert.equal(proxy.lookup(second), null);
});

test('refuses invalid ticket ids before opening the network', async () => {
  let opens = 0;
  const proxy = new CustomSourceAudioProxy({
    openRemote: async () => { opens += 1; },
  });
  const response = {
    statusCode: 0,
    writeHead(code) { this.statusCode = code; },
    end() { this.ended = true; },
  };
  await proxy.pipe('../bad', { headers: {} }, response);
  assert.equal(response.statusCode, 404);
  assert.equal(opens, 0);
});
