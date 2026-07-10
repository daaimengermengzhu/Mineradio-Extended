const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LX_API_VERSION,
  parseScriptInfo,
  filterInitPayload,
  selectLxQuality,
  validateActionResponse,
} = require('../../desktop/custom-source/protocol');

test('parses API 2.0.0 metadata and applies advertised length limits', () => {
  const info = parseScriptInfo(`/**
 * @name Test Source
 * @description URL resolver
 * @version 1.2.3
 * @author Mineradio
 * @homepage https://example.com/source
 */`);
  assert.equal(LX_API_VERSION, '2.0.0');
  assert.equal(info.name, 'Test Source');
  assert.equal(info.version, '1.2.3');

  const long = parseScriptInfo(`/**
 * @name ${'n'.repeat(100)}
 * @description ${'d'.repeat(100)}
 * @version ${'1'.repeat(100)}
 * @author ${'a'.repeat(100)}
 * @homepage https://example.com/${'h'.repeat(1100)}
 */`);
  assert.equal(long.name.length, 24);
  assert.ok(long.name.endsWith('...'));
  assert.ok(long.description.length <= 36);
  assert.ok(long.version.length <= 36);
  assert.ok(long.author.length <= 56);
  assert.ok(long.homepage.length <= 1024);
});

test('filters sources, actions and qualities to the supported contract', () => {
  const result = filterInitPayload({
    openDevTools: true,
    sources: {
      wy: { name: 'WY', type: 'music', actions: ['musicUrl', 'bad'], qualitys: ['128k', 'flac', 'bad'] },
      kg: { name: 'KG', type: 'music', actions: ['musicUrl'], qualitys: ['320k', 'flac24bit'] },
      local: { name: 'Local', type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k'] },
      bad: { name: 'Bad', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] },
    },
  });
  assert.deepEqual(result.sources.wy.actions, ['musicUrl']);
  assert.deepEqual(result.sources.wy.qualitys, ['128k', 'flac']);
  assert.deepEqual(result.sources.kg.qualitys, ['320k', 'flac24bit']);
  assert.deepEqual(result.sources.local.actions, ['musicUrl', 'lyric', 'pic']);
  assert.deepEqual(result.sources.local.qualitys, []);
  assert.equal(result.sources.bad, undefined);
  assert.equal(result.openDevTools, false);
});

test('selects the highest declared quality not above the requested level', () => {
  assert.equal(selectLxQuality('hires', ['128k', '320k', 'flac']), 'flac');
  assert.equal(selectLxQuality('lossless', ['128k', 'flac24bit']), '128k');
  assert.equal(selectLxQuality('standard', ['320k']), null);
});

test('accepts only clean HTTP playback URLs', () => {
  assert.equal(validateActionResponse('musicUrl', 'https://example.com/a.flac'), 'https://example.com/a.flac');
  assert.equal(validateActionResponse('musicUrl', 'http://example.com/a.mp3'), 'http://example.com/a.mp3');
  for (const value of [
    'file:///tmp/a.mp3',
    'https:foo',
    ' https://example.com/a.mp3',
    'https://example.com/a.mp3\n',
    'https://example.com/a.mp3\t',
  ]) {
    assert.throws(() => validateActionResponse('musicUrl', value), /INVALID_RESPONSE/);
  }
});
