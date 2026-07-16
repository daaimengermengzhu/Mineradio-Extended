const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const indexHtml = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const desktopHtml = fs.readFileSync(path.join(root, 'public', 'desktop-lyrics.html'), 'utf8');
const defaultArchive = JSON.parse(fs.readFileSync(path.join(root, 'public', 'default-user-fx-archive.json'), 'utf8'));

test('loads the shared lyric timeline before the player script', () => {
  assert.match(indexHtml, /<script src="lyric-timeline\.js"><\/script>/);
  assert.ok(
    indexHtml.indexOf('<script src="lyric-timeline.js"></script>') < indexHtml.indexOf('<style>'),
    'lyric timeline must be available before the inline player script',
  );
});

test('persists a default-on next lyric preference', () => {
  assert.match(indexHtml, /lyricNextLine:\s*true/);
  assert.match(indexHtml, /lyricNextLine:\s*raw\.lyricNextLine\s*!==\s*false/);
  assert.match(indexHtml, /lyricNextLine:\s*fx\.lyricNextLine\s*!==\s*false/);
  assert.match(indexHtml, /id="t-lyricNextLine"/);
  assert.match(indexHtml, /toggleFx\('lyricNextLine'\)/);
  assert.equal(defaultArchive.snapshot.lyricNextLine, true);
});

test('wires a lightweight next lyric mesh into the 3D stage', () => {
  assert.match(indexHtml, /next:\s*null/);
  assert.match(indexHtml, /nextIdx:\s*-1/);
  assert.match(indexHtml, /nextText:\s*''/);
  assert.match(indexHtml, /function buildNextLyricMesh\(/);
  assert.match(indexHtml, /function showStageNextLine\(/);
  assert.match(indexHtml, /function clearStageNextLyric\(/);
  assert.match(indexHtml, /function selectCurrentLyricWindow\(/);
  assert.match(indexHtml, /MineradioLyricTimeline\.selectLyricWindow/);
});

test('sends and renders nextText in desktop lyrics', () => {
  assert.match(indexHtml, /nextText:\s*fx\.lyricNextLine/);
  assert.match(desktopHtml, /id="nextLine"/);
  assert.match(desktopHtml, /class="next-line"/);
  assert.match(desktopHtml, /nextText:\s*''/);
  assert.match(desktopHtml, /function fitNextLyricText\(/);
  assert.match(desktopHtml, /nextLine\.textContent\s*=\s*nextText/);
});
