'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const api = require('../qishui-api');
const integration = require('../qishui-integration');
function response() {
  return { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
}
test('local audio supports full, open-ended, suffix and invalid byte ranges', () => {
  const audio = { type: 'audio/mp4', buffer: Buffer.from('0123456789') };
  for (const [range, status, body] of [[undefined,200,'0123456789'],['bytes=2-5',206,'2345'],['bytes=8-',206,'89'],['bytes=-3',206,'789'],['bytes=10-',416,undefined],['bytes=-',416,undefined]]) {
    const res = response(); integration._test.sendAudio(res, audio, range);
    assert.equal(res.status,status); assert.equal(res.body && res.body.toString(),body);
  }
});
test('API-issued audio URL keeps media URLs and keys outside the renderer', () => {
  const local = integration._test.issue('https://example.test/audio.mp4#auth=test');
  assert.match(local,/^\/api\/qishui\/audio\?ticket=[0-9a-f]{48}$/);
  assert.throws(() => integration._test.issue('file:///secret'));
});
test('playlist pagination preserves platform order and deduplicates page boundaries', async t => {
  const original = api.handleQishuiPlaylistTracks;
  t.after(() => { api.handleQishuiPlaylistTracks = original; });
  api.handleQishuiPlaylistTracks = async (id, { offset }) => ({ tracks: offset ? [{id:'b'},{id:'c'}] : [{id:'a'},{id:'b'}], hasMore: !offset, nextOffset:2 });
  const result = await integration._test.playlistTracks('test','');
  assert.deepEqual(result.tracks.map(s=>s.id),['a','b','c']);
});
test('account routes reject cross-origin calls and require POST; invalid tickets expire', async () => {
  let res=response();
  await integration.route({ method:'POST', headers:{origin:'https://unrelated.test',host:'127.0.0.1:3137'} },res,new URL('http://localhost/api/qishui/login/qrcode'));
  assert.equal(res.status,403);
  res=response();
  await integration.route({ method:'GET', headers:{} },res,new URL('http://localhost/api/qishui/logout'));
  assert.equal(res.status,405);
  res=response();
  await integration.route({ method:'GET', headers:{} },res,new URL('http://localhost/api/qishui/audio?ticket=missing'));
  assert.equal(res.status,410);
  await integration.dispose();
});
