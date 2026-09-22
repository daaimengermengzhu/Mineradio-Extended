const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
function source(text, name, next) {
  const start = text.indexOf('function ' + name + '(');
  const end = text.indexOf('function ' + next + '(', start + 1);
  assert.ok(start >= 0 && end > start);
  return text.slice(start, end);
}
function context(code, stubs = {}) {
  const ctx = vm.createContext(stubs);
  vm.runInContext(code, ctx);
  return ctx;
}
test('platform order and explicit reverse stay consistent across all providers without mutating input', () => {
  let mode = 'saved';
  const ctx = context(source(html, 'sortPlaylistTracksForDisplay', 'playlistTracksForPlayback'), {
    normalizePlaylistProvider: p => p,
    effectivePlaylistDetailSortMode: () => mode,
  });
  const songs = [{ id: 'latest' }, { id: 'middle' }, { id: 'oldest' }];
  for (const provider of ['netease', 'qq', 'kugou', 'kugouMusic', 'qishui']) {
    mode = 'saved';
    assert.deepEqual(Array.from(ctx.sortPlaylistTracksForDisplay(songs, provider), s => s.id), ['latest', 'middle', 'oldest']);
    mode = 'reverse';
    assert.deepEqual(Array.from(ctx.sortPlaylistTracksForDisplay(songs, provider), s => s.id), ['oldest', 'middle', 'latest']);
  }
  assert.equal(songs[0].id, 'latest');
});
test('empty artist arrays fall through to filename or singer metadata', () => {
  const ctx = context(source(html, 'playlistDetailCleanTitle', 'setPlaylistDetailSortMode') + source(html, 'playlistDetailSongArtist', 'playlistDetailSongName'));
  assert.equal(ctx.playlistDetailSongArtist({ name: 'Artist - Song', artists: [] }), 'Artist');
  assert.equal(ctx.playlistDetailSongArtist({ name: 'Song', artists: [{}], singername: 'Singer' }), 'Singer');
  assert.equal(ctx.playlistDetailSongArtist({ artists: [{ name: 'A' }, { name: 'B' }] }), 'A / B');
});
test('KuGou playlist responses preserve nested singers, album covers and outer metadata', () => {
  const ctx = context(source(server, 'firstKugouValue', 'extractKugouSearchList'), {
    normalizeKugouSession: () => ({ provider: 'kugou', source: 'kugou', type: 'kugou' }),
  });
  const song = ctx.mapKugouSearchSong({ singerinfo: [{ id: 1, name: 'Singer' }], Singers: [],
    info: { name: 'Song', hash: 'ABC' }, albuminfo: { name: 'Album' },
    trans_param: { union_cover: 'https://example.test/{size}/cover.jpg' } });
  assert.equal(song.artist, 'Singer');
  assert.equal(song.hash, 'abc');
  assert.equal(song.album, 'Album');
  assert.equal(song.cover, 'https://example.test/400/cover.jpg');
});
test('liked playlists receive a local cover immediately and a song cover after loading', () => {
  const playlist = { id: '1', provider: 'qq', name: '我喜欢' };
  const ctx = context(source(html, 'playlistCoverForProvider', 'playlistPanelProviderId'), {
    coverUrlWithSize: s => s, normalizePlaylistProvider: p => p,
    userPlaylists: [playlist], playlistPanelDetailState: { key: 'qq:1', playlist },
  });
  assert.equal(ctx.playlistCoverForProvider(playlist), '/assets/liked-playlist.svg');
  ctx.rememberPlaylistCover('qq', '1', { tracks: [{ cover: 'https://example.test/song.jpg' }] });
  assert.equal(ctx.playlistCoverForProvider(playlist), 'https://example.test/song.jpg');
  ctx.rememberPlaylistCover('qq', '1', { playlist: { cover: 'https://example.test/other.jpg' } });
  assert.equal(playlist.cover, 'https://example.test/song.jpg');
  assert.equal(ctx.playlistCoverForProvider({ name: 'Empty playlist' }), '/assets/playlist-placeholder.svg');
});
