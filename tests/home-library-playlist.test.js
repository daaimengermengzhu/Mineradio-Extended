const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPicker() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const match = html.match(/function pickHomeLibraryPlaylist\(playlists\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'pickHomeLibraryPlaylist should exist in public/index.html');
  const context = {};
  vm.runInNewContext(match[0] + '\nthis.pickHomeLibraryPlaylist = pickHomeLibraryPlaylist;', context);
  return context.pickHomeLibraryPlaylist;
}

test('home library prefers the largest liked playlist over unrelated recommendations', () => {
  const pickHomeLibraryPlaylist = loadPicker();
  const playlists = [
    { provider: 'netease', name: '用户喜欢的音乐', trackCount: 4 },
    { provider: 'kugou', name: '默认收藏', trackCount: 0 },
    { provider: 'kugou', name: '我喜欢', trackCount: 418 },
    { provider: 'kugou', name: '梦境旅程', trackCount: 299 },
  ];

  assert.equal(pickHomeLibraryPlaylist(playlists), playlists[2]);
});

test('home library falls back to the largest non-empty personal playlist', () => {
  const pickHomeLibraryPlaylist = loadPicker();
  const playlists = [
    { provider: 'netease', name: '歌单 A', trackCount: 30 },
    { provider: 'qishui', name: '歌单 B', trackCount: 89 },
  ];

  assert.equal(pickHomeLibraryPlaylist(playlists), playlists[1]);
});

test('home library returns null before personal playlists are available', () => {
  const pickHomeLibraryPlaylist = loadPicker();
  assert.equal(pickHomeLibraryPlaylist([]), null);
});
