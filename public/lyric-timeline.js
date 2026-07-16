(function attachLyricTimeline(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MineradioLyricTimeline = api;
}(typeof window !== 'undefined' ? window : globalThis, function createLyricTimeline() {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function lineEndTime(line, nextLine, now, duration) {
    if (nextLine && Number.isFinite(nextLine.t) && nextLine.t > line.t) return nextLine.t;
    var fallbackEnd = line.t + (Number.isFinite(line.duration) && line.duration > 0 ? line.duration : 4.8);
    if (Number.isFinite(duration) && duration > line.t) return Math.min(duration, fallbackEnd);
    return fallbackEnd;
  }

  function lineProgress(line, nextLine, now, duration) {
    if (!line || !Number.isFinite(line.t)) return 0;
    var adjustedNow = Number.isFinite(now) ? now : 0;
    adjustedNow += line.words && line.words.length ? 0.030 : 0.020;

    if (line.words && line.words.length && line.charCount > 0) {
      var lastProgress = 0;
      for (var i = 0; i < line.words.length; i += 1) {
        var word = line.words[i] || {};
        var start = Number(word.t);
        if (!Number.isFinite(start)) continue;
        var end = start + Math.max(0.08, Number(word.d) || 0.24);
        if (adjustedNow < start) return lastProgress;
        var local = adjustedNow >= end ? 1 : (adjustedNow - start) / Math.max(0.08, end - start);
        local = clamp(local, 0, 1);
        var progress = (Number(word.c0) + (Number(word.c1) - Number(word.c0)) * local) / line.charCount;
        lastProgress = Math.max(lastProgress, clamp(Number.isFinite(progress) ? progress : 0, 0, 1));
        if (adjustedNow < end) return lastProgress;
      }
      return 1;
    }

    var endTime = lineEndTime(line, nextLine, adjustedNow, duration);
    var span = Math.max(0.75, endTime - line.t);
    var raw = clamp((adjustedNow - line.t) / span, 0, 1);
    return raw * raw * (3 - 2 * raw);
  }

  function selectLyricWindow(lines, time, options) {
    options = options || {};
    var isPlaceholder = typeof options.isPlaceholder === 'function'
      ? options.isPlaceholder
      : function neverPlaceholder() { return false; };
    var usable = [];

    (Array.isArray(lines) ? lines : []).forEach(function collect(line, index) {
      var lyric = line || {};
      var text = normalizeText(lyric.text);
      if (!Number.isFinite(lyric.t) || !text || isPlaceholder(text)) return;
      usable.push({
        index: index,
        line: Object.assign({}, lyric, { text: text }),
      });
    });

    usable.sort(function byTime(a, b) {
      return a.line.t === b.line.t ? a.index - b.index : a.line.t - b.line.t;
    });

    var now = Number.isFinite(time) ? time : 0;
    var tolerance = Number.isFinite(options.tolerance) ? Math.max(0, options.tolerance) : 0.05;
    var introText = normalizeText(options.introText);
    var nextEnabled = options.nextEnabled !== false;
    var activePosition = -1;

    for (var i = 0; i < usable.length; i += 1) {
      if (usable[i].line.t <= now + tolerance) activePosition = i;
      else break;
    }

    if (activePosition < 0) {
      var first = usable.length ? usable[0] : null;
      if (!introText) {
        return {
          current: null,
          next: nextEnabled && first ? first.line : null,
          currentIndex: -1,
          nextIndex: nextEnabled && first ? first.index : -1,
          progress: 0,
          progressSpan: first ? Math.max(0.8, first.line.t) : 4.8,
          phase: first ? 'intro' : 'empty',
        };
      }

      if (!first) {
        return {
          current: { t: 0, text: introText, duration: 4.8, charCount: Math.max(1, introText.length), fallback: true },
          next: null,
          currentIndex: -2,
          nextIndex: -1,
          progress: 0,
          progressSpan: 4.8,
          phase: 'fallback',
        };
      }

      var introSpan = Math.max(0.8, first.line.t > 0 ? first.line.t : 4.8);
      var introLine = { t: 0, text: introText, duration: introSpan, charCount: Math.max(1, introText.length), fallback: true };
      return {
        current: introLine,
        next: nextEnabled ? first.line : null,
        currentIndex: -2,
        nextIndex: nextEnabled ? first.index : -1,
        progress: lineProgress(introLine, null, now, introSpan),
        progressSpan: introSpan,
        phase: 'intro',
      };
    }

    var active = usable[activePosition];
    var next = null;
    for (var nextPosition = activePosition + 1; nextPosition < usable.length; nextPosition += 1) {
      var candidate = usable[nextPosition];
      if (candidate.line.t <= active.line.t) continue;
      if (normalizeText(candidate.line.text) === normalizeText(active.line.text)) continue;
      next = candidate;
      break;
    }

    var endTime = lineEndTime(active.line, next && next.line, now, Number(options.duration) || 0);
    return {
      current: active.line,
      next: nextEnabled && next ? next.line : null,
      currentIndex: active.index,
      nextIndex: nextEnabled && next ? next.index : -1,
      progress: lineProgress(active.line, next && next.line, now, Number(options.duration) || 0),
      progressSpan: Math.max(0.75, endTime - active.line.t),
      phase: 'active',
    };
  }

  return {
    lineProgress: lineProgress,
    normalizeText: normalizeText,
    selectLyricWindow: selectLyricWindow,
  };
}));
