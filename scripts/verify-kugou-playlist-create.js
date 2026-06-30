const fs = require('fs');

const serverSource = fs.readFileSync('server.js', 'utf8');
const uiSource = fs.readFileSync('public/index.html', 'utf8');

const checks = [
  ['server KuGou playlist create handler', serverSource, 'async function handleKugouPlaylistCreate'],
  ['server KuGou playlist create route', serverSource, "pn === '/api/kugou/playlist/create'"],
  ['server KuGou add_list endpoint', serverSource, "'/cloudlist.service/v5/add_list'"],
  ['UI posts KuGou playlist create route', uiSource, "/api/kugou/playlist/create"],
  ['UI shows create row for KuGou collect modal', uiSource, "provider === 'netease' || provider === 'kugou'"],
  ['UI handles KuGou create branch', uiSource, "collectTargetProvider === 'kugou'"],
];

const missing = checks.filter(([, source, marker]) => !source.includes(marker));
if (missing.length) {
  console.error('KuGou playlist create wiring is incomplete:');
  missing.forEach(([label]) => console.error(`- ${label}`));
  process.exit(1);
}

console.log('KuGou playlist create markers are present.');
