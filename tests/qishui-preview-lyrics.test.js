'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const start = html.indexOf('function lyricsForPlaybackClip(');
const end = html.indexOf('async function fetchLyric(', start);
const ctx = vm.createContext({ cloneLyricLine: line => structuredClone(line) });
vm.runInContext(html.slice(start, end), ctx);

test('a Qishui excerpt aligns line and karaoke times without mutating full lyrics', () => {
  const lines = [
    { t: 0, text: 'intro' },
    { t: 118, text: 'current', words: [{ t: 118, d: 4 }] },
    { t: 124, text: 'next' },
    { t: 152, text: 'outside' },
  ];
  const clipped = ctx.lyricsForPlaybackClip(lines, { provider: 'qishui', trial: true, clipStart: 120, duration: 30 });
  assert.deepEqual(Array.from(clipped, line => line.text), ['current', 'next']);
  assert.equal(clipped[0].t, -2);
  assert.equal(clipped[0].words[0].t, -2);
  assert.equal(clipped[1].t, 4);
  assert.equal(lines[1].words[0].t, 118);
  assert.equal(ctx.lyricsForPlaybackClip(lines, { provider: 'qishui', trial: false }), lines);
  assert.equal(ctx.lyricsForPlaybackClip(lines, { provider: 'netease', trial: true }), lines);
});
