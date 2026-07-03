const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

const checks = [
  ['server ordinary KuGou cookie file', serverSource, 'KUGOU_MUSIC_COOKIE_FILE'],
  ['server ordinary KuGou app id', serverSource, 'KUGOU_MUSIC_APPID'],
  ['server ordinary KuGou session provider', serverSource, "provider: 'kugouMusic'"],
  ['server ordinary KuGou login status route', serverSource, "pn === '/api/kugou-music/login/status'"],
  ['server ordinary KuGou QR key route', serverSource, "pn === '/api/kugou-music/login/qr/key'"],
  ['server ordinary KuGou QR check route', serverSource, "pn === '/api/kugou-music/login/qr/check'"],
  ['server ordinary KuGou search route', serverSource, "pn === '/api/kugou-music/search'"],
  ['server ordinary KuGou song URL route', serverSource, "pn === '/api/kugou-music/song/url'"],
  ['server ordinary KuGou playlists route', serverSource, "pn === '/api/kugou-music/user/playlists'"],
  ['server ordinary KuGou playlist tracks route', serverSource, "pn === '/api/kugou-music/playlist/tracks'"],
  ['server ordinary KuGou lyric route', serverSource, "pn === '/api/kugou-music/lyric'"],
  ['UI ordinary KuGou search tab', uiSource, 'id="search-mode-kugou-music"'],
  ['UI ordinary KuGou login tab', uiSource, 'id="login-provider-kugou-music"'],
  ['UI ordinary KuGou account tab', uiSource, 'id="user-provider-kugouMusic"'],
  ['UI ordinary KuGou login state', uiSource, 'var kugouMusicLoginStatus'],
  ['UI recognizes ordinary KuGou provider', uiSource, "provider === 'kugouMusic'"],
  ['UI ordinary KuGou search route', uiSource, '/api/kugou-music/search?keywords='],
  ['UI ordinary KuGou song URL route', uiSource, '/api/kugou-music/song/url?hash='],
  ['UI ordinary KuGou playlists route', uiSource, "/api/kugou-music/user/playlists"],
  ['UI ordinary KuGou playlist tracks route', uiSource, "/api/kugou-music/playlist/tracks?id="],
  ['UI ordinary KuGou startup status', uiSource, 'refreshKugouMusicLoginStatus()'],
];

const missing = checks.filter(([, source, marker]) => !source.includes(marker));

if (missing.length) {
  console.error('Ordinary KuGou Music wiring is incomplete:');
  missing.forEach(([name, , marker]) => {
    console.error(`- ${name}: missing ${marker}`);
  });
  process.exit(1);
}

console.log('Ordinary KuGou Music basic wiring markers found.');
