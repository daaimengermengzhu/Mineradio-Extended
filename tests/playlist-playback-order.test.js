const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function functionSource(name, nextName) {
  const start = html.indexOf(`function ${name}(`);
  const end = html.indexOf(`function ${nextName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `${name} should exist before ${nextName}`);
  return html.slice(start, end);
}

test('playlist playback builds the queue in the same normalized display order', () => {
  const source = functionSource('playlistTracksForPlayback', 'getPlaylistPanelSortedTracks');
  const context = {
    normalizePlaylistPanelTrack: song => ({ ...song, normalized: true }),
    sortPlaylistTracksForDisplay: tracks => tracks.slice().reverse(),
    cloneSong: song => ({ ...song, cloned: true }),
  };
  vm.runInNewContext(`${source}\nthis.playlistTracksForPlayback = playlistTracksForPlayback;`, context);

  const input = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const result = context.playlistTracksForPlayback(input, 'kugou');

  assert.deepEqual(Array.from(result, song => song.id), [3, 2, 1]);
  assert.ok(result.every(song => song.normalized && song.cloned));
  assert.deepEqual(input, [{ id: 1 }, { id: 2 }, { id: 3 }]);
});

test('direct and detail playlist playback share the queue builder', () => {
  const direct = html.slice(
    html.indexOf('async function loadPlaylistIntoQueueById('),
    html.indexOf('// 进度条', html.indexOf('async function loadPlaylistIntoQueueById(')),
  );
  const detail = functionSource('playPlaylistPanelDetail', 'openPlaylistPanelDetailArtist');

  assert.match(direct, /playQueue\s*=\s*playlistTracksForPlayback\(r\.tracks, provider\)/);
  assert.match(detail, /playlistTracksForPlayback\(st\.tracks, playlistDetailCurrentProvider\(\)\)/);
  assert.match(detail, /playlistTracksForPlayback\(playlistPanelDetailState\.tracks, playlistDetailCurrentProvider\(\)\)/);
});
