const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const main = fs.readFileSync(path.join(root, 'desktop/main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'desktop/preload.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

test('desktop main and preload expose sender-checked custom source management', () => {
  assert.match(main, /CustomSourceManager/);
  assert.match(main, /CUSTOM_SOURCE_UNAUTHORIZED/);
  assert.match(main, /mineradio-custom-source-import/);
  assert.match(main, /mineradio-custom-source-activate/);
  assert.match(main, /setCustomSourceBridge/);
  assert.match(preload, /listCustomSources/);
  assert.match(preload, /importCustomSource/);
  assert.match(preload, /activateCustomSource/);
  assert.match(preload, /removeCustomSource/);
});

test('player presents a script manager and keeps official playback first', () => {
  assert.match(page, /id="custom-source-btn"/);
  assert.match(page, /aria-label="第三方音源"/);
  assert.match(page, /第三方脚本可以向网络发送歌曲信息/);
  assert.match(page, /function resolveOfficialPlaybackData\(/);
  assert.match(page, /function resolveOnlinePlaybackData\(/);

  const resolverStart = page.indexOf('function resolveOnlinePlaybackData(');
  const resolverEnd = page.indexOf('\n}', resolverStart);
  const resolver = page.slice(resolverStart, resolverEnd + 2);
  assert.ok(resolver.indexOf('resolveOfficialPlaybackData') >= 0);
  assert.ok(resolver.indexOf('/api/custom-source/resolve') > resolver.indexOf('resolveOfficialPlaybackData'));
  assert.match(resolver, /officialResult/);
});

test('custom playback uses the ticket proxy directly and is visibly identified', () => {
  assert.match(page, /data\.thirdParty\s*\?\s*data\.url/);
  assert.match(page, /第三方音源/);
  assert.match(page, /currentPlaybackProvider\s*=\s*['"]lx-custom-source['"]/);
});
