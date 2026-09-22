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

test('player presents a script manager and checks official playback before source preference', () => {
  assert.match(page, /id="custom-source-btn"/);
  assert.match(page, /aria-label="第三方音源"/);
  assert.match(page, /第三方脚本可以向网络发送歌曲信息/);
  assert.match(page, /id="custom-source-priority-list"/);
  assert.match(page, /mineradio-custom-source-priority-v1/);
  assert.match(page, /officialFirst/);
  assert.match(page, /lxFirst/);
  assert.match(page, /officialOnly/);
  assert.match(page, /function resolveOfficialPlaybackData\(/);
  assert.match(page, /function resolveOnlinePlaybackData\(/);

  const resolverStart = page.indexOf('function resolveOnlinePlaybackData(');
  const resolverEnd = page.indexOf('\n}', resolverStart);
  const resolver = page.slice(resolverStart, resolverEnd + 2);
  assert.ok(resolver.indexOf('resolveOfficialPlaybackData') >= 0);
  assert.ok(resolver.indexOf('/api/custom-source/resolve') > resolver.indexOf('resolveOfficialPlaybackData'));
  assert.match(resolver, /officialResult/);
  assert.match(resolver, /preference:\s*sourcePreference/);
  assert.match(resolver, /playable:\s*!!officialResult\.url/);
  assert.match(resolver, /trial:\s*officialResult\.trial === true/);
});

test('custom playback uses the ticket proxy directly and is visibly identified', () => {
  const route = page.match(/var proxyAudioUrl = ([^;]+);/);
  assert.ok(route);
  const resolve = new Function('data', 'return ' + route[1]);
  assert.equal(resolve({ thirdParty: true, url: '/api/custom-source/audio?ticket=test' }), '/api/custom-source/audio?ticket=test');
  assert.equal(resolve({ localAudio: true, url: '/api/qishui/audio?ticket=test' }), '/api/qishui/audio?ticket=test');
  assert.equal(resolve({ url: 'https://example.test/song.mp3' }), '/api/audio?url=https%3A%2F%2Fexample.test%2Fsong.mp3');
  assert.match(page, /第三方音源/);
  assert.match(page, /currentPlaybackProvider\s*=\s*['"]lx-custom-source['"]/);
});

test('closing the main window quits hidden runtimes and reuses an active server port', () => {
  assert.match(main, /function requestAppQuit\(\)/);
  assert.match(main, /if \(win === mainWindow\) \{\s*requestAppQuit\(\)/);
  assert.match(main, /mainWindow\.on\('closed',[\s\S]*?mainWindow = null;\s*if \(process\.platform !== 'darwin'\) requestAppQuit\(\)/);
  assert.match(main, /const port = listeningServerPort\(localServer\) \|\| await findOpenPort\(3000\)/);
  assert.match(main, /app\.on\('before-quit',[\s\S]*?customSourceManager\.dispose\(\)/);
  assert.match(main, /function handleWindowCreateFailure\(scope, error\)[\s\S]*?requestAppQuit\(\)/);
  assert.match(main, /Initial window creation failed:/);
  assert.match(main, /Second instance window restore failed:/);
  assert.match(main, /Activated window creation failed:/);
});
