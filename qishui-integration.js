'use strict';

const crypto = require('node:crypto');
const api = require('./qishui-api');
const { TrackDecryptor } = require('./qishui-audio-decryptor/track-decryptor');
let bridge;
const tickets = new Map();
const MAX_AUDIO_BYTES = 64 * 1024 * 1024;
let cachedAudio = null;
let pendingAudio = null;
let audioExpiry;
let audioGeneration = 0;
let audioController;
function login() { return bridge || (bridge = require('./qishui-qr-login')); }
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function issue(url) {
  const target = new URL(url);
  if (target.protocol !== 'https:') throw new Error('QISHUI_INVALID_AUDIO_URL');
  for (const [key, entry] of tickets) if (entry.expires < Date.now()) tickets.delete(key);
  while (tickets.size >= 8) tickets.delete(tickets.keys().next().value);
  const key = crypto.randomBytes(24).toString('hex');
  tickets.set(key, { url, expires: Date.now() + 30 * 60 * 1000 });
  return '/api/qishui/audio?ticket=' + key;
}
async function loadAudio(key, entry) {
  if (cachedAudio && cachedAudio.key === key) return cachedAudio;
  if (pendingAudio && pendingAudio.key === key) return pendingAudio.promise;
  // One download/decode at a time keeps rapid track switches from multiplying memory use.
  while (pendingAudio) await pendingAudio.promise.catch(() => {});
  if (!tickets.has(key)) throw new Error('QISHUI_AUDIO_EXPIRED');
  const generation = audioGeneration;
  audioController = new AbortController();
  const signal = AbortSignal.any([audioController.signal, AbortSignal.timeout(45000)]);
  const promise = (async () => {
    const target = new URL(entry.url);
    const auth = new URLSearchParams(target.hash.slice(1)).get('auth');
    target.hash = '';
    const up = await fetch(target, { headers: { Referer: 'https://music.qishui.com/' }, signal });
    if (!up.ok) throw new Error('QISHUI_AUDIO_HTTP_' + up.status);
    const chunks = [];
    let size = 0;
    for await (const chunk of up.body) {
      size += chunk.length;
      if (size > MAX_AUDIO_BYTES) throw new Error('QISHUI_AUDIO_TOO_LARGE');
      chunks.push(Buffer.from(chunk));
    }
    const downloaded = Buffer.concat(chunks);
    chunks.length = 0;
    const decoded = auth ? new TrackDecryptor().decrypt({ encryptedBuffer: downloaded, spadeA: auth }) : null;
    if (generation !== audioGeneration) throw new Error('QISHUI_AUDIO_EXPIRED');
    cachedAudio = { key, buffer: decoded ? decoded.buffer : downloaded,
      type: decoded ? (decoded.extension === '.flac' ? 'audio/flac' : 'audio/mp4') : (up.headers.get('content-type') || 'audio/mpeg') };
    clearTimeout(audioExpiry);
    audioExpiry = setTimeout(() => { cachedAudio = null; }, 90000);
    audioExpiry.unref();
    return cachedAudio;
  })();
  pendingAudio = { key, promise };
  try { return await promise; } finally { if (pendingAudio && pendingAudio.promise === promise) pendingAudio = null; }
}
function sendAudio(res, audio, range) {
  const total = audio.buffer.length;
  let start = 0, end = total - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': 'bytes */' + total }); res.end(); return; }
    if (!match[1]) start = Math.max(0, total - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (start > end || start >= total) { res.writeHead(416, { 'Content-Range': 'bytes */' + total }); res.end(); return; }
  }
  const headers = { 'Content-Type': audio.type, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' };
  if (range) headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + total;
  res.writeHead(range ? 206 : 200, headers);
  res.end(audio.buffer.subarray(start, end + 1));
}
async function playlistTracks(id, cookie) {
  const tracks = [], seen = new Set();
  let offset = 0, result;
  do {
    result = await api.handleQishuiPlaylistTracks(id, { limit: 50, offset }, cookie);
    if (result.error) return { ...result, tracks: [], message: result.message || '汽水歌单读取失败，请重试' };
    for (const song of result.tracks || []) {
      const key = String(song.id || song.providerSongId);
      if (!seen.has(key)) { seen.add(key); tracks.push(song); }
    }
    const next = Number(result.nextOffset);
    if (!result.hasMore || !Number.isFinite(next) || next <= offset || tracks.length >= 5000) break;
    offset = next;
  } while (offset < 5000);
  return { ...result, tracks: tracks.slice(0, 5000), offset: 0 };
}
async function route(req, res, url) {
  const action = url.pathname.replace('/api/qishui/', '');
  if (!url.pathname.startsWith('/api/qishui/') || !['login/qrcode', 'login/check', 'login/cancel', 'status', 'login/status', 'logout', 'search', 'user/playlists', 'playlist/tracks', 'song/url', 'lyric', 'audio'].includes(action)) return false;
  // Account operations and local audio tickets belong to the local application only.
  const origin = req.headers.origin;
  if (origin && origin !== 'http://' + req.headers.host) { json(res, { error: 'ORIGIN_NOT_ALLOWED' }, 403); return true; }
  if (['login/qrcode', 'login/check', 'login/cancel', 'logout'].includes(action) && req.method !== 'POST') { json(res, { error: 'METHOD_NOT_ALLOWED' }, 405); return true; }
  try {
    const cookie = login().getCookie();
    const id = url.searchParams.get('id') || '';
    if (action === 'login/qrcode') {
      if (!process.versions.electron) { json(res, { message: '请在桌面客户端中扫码登录汽水音乐' }, 503); return true; }
      const { data } = await login().createQrCode();
      json(res, { token: data.token, qrcode: data.qrcode });
    } else if (action === 'login/check') {
      const { data } = await login().checkQrConnect(url.searchParams.get('token'));
      if (data.confirmed) {
        const status = await api.handleQishuiStatus(login().getCookie());
        if (status.loggedIn) await login().dispose();
        json(res, { ...status, status: status.loggedIn ? 'confirmed' : 'verifying' });
      } else {
        const code = Number(data.error_code || 0);
        json(res, { loggedIn: false, status: code === 2 ? 'expired' : code === 7 ? 'rate_limited' : String(data.status) === '2' ? 'scanned' : 'waiting' });
      }
    } else if (action === 'login/cancel') {
      await login().dispose(); json(res, { ok: true });
    } else if (action === 'logout') {
      await login().clear(); clearAudio(); api._test.clearQishuiRuntimeCaches(); json(res, { loggedIn: false });
    } else if (action === 'status' || action === 'login/status') json(res, await api.handleQishuiStatus(cookie));
    else if (action === 'search') json(res, await api.handleQishuiSearch(url.searchParams.get('keywords') || '', 20, cookie, 0));
    else if (action === 'user/playlists') json(res, await api.handleQishuiUserPlaylists(cookie));
    else if (action === 'playlist/tracks') json(res, await playlistTracks(id, cookie));
    else if (action === 'lyric') json(res, await api.handleQishuiLyric(id, cookie));
    else if (action === 'song/url') {
      if (url.searchParams.get('mediaType') === 'video') { json(res, { playable: false, reason: 'video_unavailable', message: '汽水视频条目暂不能作为音频播放' }); return true; }
      const data = await api.handleQishuiSongUrl({ id, quality: url.searchParams.get('quality') || '' }, cookie);
      if (data.reason === 'login_required') data.message = '请在登录窗口选择汽水音乐，使用抖音 App 扫码后再播放';
      json(res, data.url ? { ...data, url: issue(data.url), localAudio: true } : data);
    } else if (action === 'audio') {
      const key = url.searchParams.get('ticket');
      const entry = tickets.get(key);
      if (!entry || entry.expires < Date.now()) json(res, { message: '播放地址已过期，请重新播放' }, 410);
      else sendAudio(res, await loadAudio(key, entry), req.headers.range);
    }
  } catch (error) {
    // Avoid echoing upstream request URLs or authentication material.
    json(res, { provider: 'qishui', error: 'QISHUI_REQUEST_FAILED', message: '汽水音乐请求失败，请稍后重试', loggedIn: false }, 502);
  }
  return true;
}
function clearAudio() { audioGeneration++; if (audioController) audioController.abort(); clearTimeout(audioExpiry); tickets.clear(); cachedAudio = null; }
async function dispose() { clearAudio(); if (bridge) await bridge.dispose(); }
module.exports = { route, dispose, _test: { sendAudio, issue, playlistTracks } };
