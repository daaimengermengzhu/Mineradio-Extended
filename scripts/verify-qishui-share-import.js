const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

const checks = [
  ['server Qishui credential helper', serverSource, 'function qishuiCredentials'],
  ['server Qishui desktop credential helper', serverSource, 'async function qishuiDesktopCredentials'],
  ['server Qishui desktop credential cache', serverSource, 'qishuiDesktopCredentialCache'],
  ['server Qishui desktop signature helper', serverSource, 'generateHttpSignatureHeaders'],
  ['server Qishui router data parser', serverSource, 'function extractQishuiRouterData'],
  ['server Qishui router media item parser', serverSource, 'function extractQishuiRouterMediaItems'],
  ['server Qishui bare router data marker', serverSource, "extractQishuiBalancedJson(text, '_ROUTER_DATA')"],
  ['server Qishui skips playlist id fallback', serverSource, 'playlist_id|\\/share\\/playlist'],
  ['server Qishui share parser', serverSource, 'function extractQishuiTrackIds'],
  ['server Qishui share import limit constant', serverSource, 'QISHUI_SHARE_IMPORT_LIMIT'],
  ['server Qishui video placeholder', serverSource, 'function qishuiVideoPlaceholderSong'],
  ['server Qishui track v2 handler', serverSource, 'async function handleQishuiTrackV2'],
  ['server Qishui share route', serverSource, "pn === '/api/qishui/share'"],
  ['server Qishui song URL route', serverSource, "pn === '/api/qishui/song/url'"],
  ['server Qishui CDN audio proxy referer', serverSource, "host.includes('douyinvod.com')"],
  ['server Qishui audio mime type handling', serverSource, "parsed.searchParams.get('mime_type')"],
  ['server Qishui encrypted audio detector', serverSource, 'qishuiAudioUrlIsBrowserUnsupported'],
  ['server Qishui encrypted audio playback reason', serverSource, 'encrypted_audio_unsupported'],
  ['server Kugou Music quality downgrade fallback', serverSource, 'originalProviderLevel'],
  ['server Kugou quality resolved from real bitrate', serverSource, 'function kugouResolvedQualityFromResponse'],
  ['server Kugou Music playlist add-song route', serverSource, "pn === '/api/kugou-music/playlist/add-song'"],
  ['server Kugou Music playlist create route', serverSource, "pn === '/api/kugou-music/playlist/create'"],
  ['server Kugou Music like check route', serverSource, "pn === '/api/kugou-music/song/like/check'"],
  ['server Kugou Music like write route', serverSource, "pn === '/api/kugou-music/song/like'"],
  ['UI Qishui search tab', uiSource, 'id="search-mode-qishui"'],
  ['UI recognizes Qishui provider', uiSource, "provider === 'qishui'"],
  ['UI imports Qishui share links', uiSource, 'async function importQishuiShare'],
  ['UI stores imported Qishui playlists', uiSource, 'QISHUI_IMPORTED_PLAYLIST_STORE_KEY'],
  ['UI saves imported Qishui playlist', uiSource, 'saveQishuiImportedPlaylist'],
  ['UI preserves Qishui media type', uiSource, 'qishuiMediaType'],
  ['UI renders Qishui playlist group', uiSource, '汽水音乐歌单'],
  ['UI loads Qishui playlist detail locally', uiSource, 'getQishuiImportedPlaylistTracks'],
  ['UI passes manual playback flag to audio play', uiSource, 'return attemptAudioPlay({ manual: !!opts.manual'],
  ['UI primes manual audio playback before async source resolution', uiSource, 'primeManualAudioPlayback'],
  ['UI releases manual audio playback prime before real source', uiSource, 'releaseManualAudioPlaybackPrime'],
  ['UI marks playlist detail play-all as manual playback', uiSource, 'playQueueAt(0, { manual: true })'],
  ['UI marks playlist detail row playback as manual playback', uiSource, 'playQueueAt(index, { manual: true })'],
  ['UI checks fallback provider playback readiness', uiSource, 'function providerPlaybackReady'],
  ['UI ranks alternate playback providers by account state', uiSource, 'function fallbackProviderRank'],
  ['UI lets Qishui use multiple fallback providers', uiSource, 'function alternatePlaybackProviders'],
  ['UI searches alternate providers through provider endpoints', uiSource, 'function providerSearchUrl'],
  ['UI maps quality permission to current playback provider', uiSource, 'function qualityProviderForCurrentTrack'],
  ['UI maps quality labels to current playback provider', uiSource, 'function providerQualityOptionMeta'],
  ['UI renders provider-aware quality labels', uiSource, 'function playbackQualityLabelForProvider'],
  ['UI calls Kugou Music like write route', uiSource, '/api/kugou-music/song/like'],
  ['UI calls Kugou Music playlist add-song route', uiSource, '/api/kugou-music/playlist/add-song'],
  ['UI calls Kugou Music playlist create route', uiSource, '/api/kugou-music/playlist/create'],
  ['UI preserves manual flag during fallback playback', uiSource, 'fallbackDepth: 1, manual: !!opts.manual'],
  ['UI calls Qishui share route', uiSource, '/api/qishui/share'],
  ['UI calls Qishui song URL route', uiSource, '/api/qishui/song/url?id='],
  ['UI passes Qishui media type to playback URL', uiSource, 'mediaType='],
];

const missing = checks
  .filter(([, source, marker]) => !source.includes(marker))
  .map(([label, , marker]) => `${label}: missing "${marker}"`);

if (missing.length) {
  console.error('Qishui share import wiring is incomplete:');
  missing.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

const forbidden = [
  ['server Qishui hard 50-song cap', serverSource, 'slice(0, 50)'],
];
const foundForbidden = forbidden
  .filter(([, source, marker]) => source.includes(marker))
  .map(([label, , marker]) => `${label}: found forbidden "${marker}"`);

if (foundForbidden.length) {
  console.error('Qishui share import still has obsolete behavior:');
  foundForbidden.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Qishui share import wiring markers are present.');
