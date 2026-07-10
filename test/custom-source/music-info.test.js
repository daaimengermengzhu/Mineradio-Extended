const test = require('node:test');
const assert = require('node:assert/strict');
const { platformKey, toLxMusicInfo } = require('../../desktop/custom-source/music-info');

test('maps Mineradio providers to LX platform keys', () => {
  assert.equal(platformKey({ provider: 'netease' }), 'wy');
  assert.equal(platformKey({ provider: 'qq' }), 'tx');
  assert.equal(platformKey({ provider: 'kugou' }), 'kg');
  assert.equal(platformKey({ provider: 'kugouMusic' }), 'kg');
  assert.equal(platformKey({ provider: 'qishui' }), null);
});

test('maps NetEase and QQ identifiers to compatible MusicInfo fields', () => {
  const wy = toLxMusicInfo({
    provider: 'netease', id: 123, name: 'Song', artist: 'Singer', album: 'Album', duration: 195000,
  });
  assert.equal(wy.source, 'wy');
  assert.equal(wy.meta.songId, 123);
  assert.equal(wy.interval, '03:15');

  const tx = toLxMusicInfo({
    provider: 'qq', id: 'mid1', qqId: 88, mid: 'mid1', mediaMid: 'media1', albumMid: 'album1', duration: 200,
  });
  assert.equal(tx.source, 'tx');
  assert.equal(tx.songmid, 'mid1');
  assert.equal(tx.meta.strMediaMid, 'media1');
  assert.equal(tx.meta.albumMid, 'album1');
  assert.equal(tx.interval, '03:20');
});

test('maps both KuGou entries to kg without losing hash and album identifiers', () => {
  for (const provider of ['kugou', 'kugouMusic']) {
    const info = toLxMusicInfo({
      provider,
      id: 'track-id',
      hash: 'ABCDEF0123',
      albumAudioId: 9988,
      albumId: 5566,
      name: 'KuGou Song',
      artist: 'Singer',
      album: 'Album',
      duration: 241000,
    });
    assert.equal(info.source, 'kg');
    assert.equal(info.hash, 'abcdef0123');
    assert.equal(info.songmid, 'abcdef0123');
    assert.equal(info.albumId, 5566);
    assert.equal(info.meta.albumAudioId, 9988);
    assert.equal(info.meta.hash, 'abcdef0123');
    assert.equal(info.interval, '04:01');
  }
});

test('rejects providers without an LX standard key', () => {
  assert.throws(() => toLxMusicInfo({ provider: 'qishui', id: '1' }), /SOURCE_UNSUPPORTED/);
});
