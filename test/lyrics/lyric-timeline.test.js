const test = require('node:test');
const assert = require('node:assert/strict');

const {
  lineProgress,
  selectLyricWindow,
} = require('../../public/lyric-timeline');

test('selects the active and next distinct lyric lines', () => {
  const state = selectLyricWindow([
    { t: 2, text: '第一句', duration: 3 },
    { t: 5, text: '第二句', duration: 3 },
    { t: 8, text: '第三句', duration: 3 },
  ], 5.4, { nextEnabled: true, duration: 12 });

  assert.equal(state.current.text, '第二句');
  assert.equal(state.next.text, '第三句');
  assert.equal(state.currentIndex, 1);
  assert.equal(state.nextIndex, 2);
  assert.equal(state.phase, 'active');
});

test('uses song metadata during intro and previews the first lyric', () => {
  const state = selectLyricWindow([{ t: 4, text: '第一句' }], 1, {
    introText: '歌曲名 - 歌手',
    nextEnabled: true,
    duration: 20,
  });

  assert.equal(state.current.text, '歌曲名 - 歌手');
  assert.equal(state.currentIndex, -2);
  assert.equal(state.next.text, '第一句');
  assert.equal(state.nextIndex, 0);
  assert.equal(state.phase, 'intro');
});

test('hides the next line when disabled or at the last lyric', () => {
  const lines = [{ t: 1, text: '第一句' }, { t: 4, text: '第二句' }];

  assert.equal(selectLyricWindow(lines, 1.2, { nextEnabled: false }).next, null);
  assert.equal(selectLyricWindow(lines, 4.2, { nextEnabled: true }).next, null);
});

test('skips invalid placeholders and duplicate next text', () => {
  const state = selectLyricWindow([
    { t: 1, text: '现在这一句' },
    { t: 3, text: '  现在这一句  ' },
    { t: 4, text: '暂无歌词' },
    { t: Number.NaN, text: '无效时间' },
    { t: 6, text: '真正的下一句' },
  ], 1.5, {
    nextEnabled: true,
    isPlaceholder: (text) => text === '暂无歌词',
  });

  assert.equal(state.current.text, '现在这一句');
  assert.equal(state.next.text, '真正的下一句');
  assert.equal(state.nextIndex, 4);
});

test('does not require a playing flag so paused lyrics keep their state', () => {
  const lines = [{ t: 1, text: '当前句' }, { t: 5, text: '下一句' }];
  const beforePause = selectLyricWindow(lines, 2.5, { nextEnabled: true });
  const whilePaused = selectLyricWindow(lines, 2.5, { nextEnabled: true });

  assert.deepEqual(whilePaused, beforePause);
  assert.equal(whilePaused.next.text, '下一句');
});

test('calculates word-timed progress without running past the line', () => {
  const line = {
    t: 2,
    duration: 3,
    charCount: 4,
    words: [
      { t: 2, d: 1, c0: 0, c1: 2 },
      { t: 3, d: 1, c0: 2, c1: 4 },
    ],
  };

  assert.equal(lineProgress(line, null, 1.8, 10), 0);
  assert.ok(lineProgress(line, null, 2.5, 10) > 0.2);
  assert.equal(lineProgress(line, null, 4.5, 10), 1);
});

test('falls back to metadata without inventing a next lyric', () => {
  const state = selectLyricWindow([], 0, {
    introText: '歌曲名',
    nextEnabled: true,
  });

  assert.equal(state.current.text, '歌曲名');
  assert.equal(state.next, null);
  assert.equal(state.phase, 'fallback');
});

test('caps final-line progress to the lyric duration', () => {
  const line = { t: 10, text: 'final line', duration: 4.8 };
  const state = selectLyricWindow([line], 12, {
    duration: 200,
    nextEnabled: true,
  });

  assert.ok(Math.abs(state.progressSpan - 4.8) < 0.000001);
  assert.equal(lineProgress(line, null, 15, 200), 1);
});
