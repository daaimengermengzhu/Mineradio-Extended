'use strict';
// Manual live smoke: electron tests/qishui-desktop-smoke.js. Never uses the user's profile.
// Set MINERADIO_TEST_APP_DIR to dist/win-unpacked/resources/app to check packaged assets.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app, BrowserWindow } = require('electron');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-qs-smoke-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
process.env.QISHUI_QR_CONFIG_FILE = path.join(profile, 'auth.json');
process.env.QISHUI_TOKEN_FILE = path.join(profile, 'token.json');
let integration, server;
const timer = setTimeout(() => { console.error('QISHUI_SMOKE_TIMEOUT'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  integration = require(path.join(process.env.MINERADIO_TEST_APP_DIR || path.resolve(__dirname, '..'), 'qishui-integration'));
  server = http.createServer(async (req,res) => {
    if (!await integration.route(req,res,new URL(req.url,'http://localhost'))) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (action, method='GET') => {
    const response = await fetch(base+'/api/qishui/'+action,{method});
    assert.equal(response.status,200,action.split('?')[0]);
    return response.json();
  };
  const qr = await request('login/qrcode','POST');
  assert.ok(qr.token && qr.qrcode.startsWith('data:image/png;base64,'));
  const poll = await request('login/check?token='+encodeURIComponent(qr.token),'POST');
  assert.equal(poll.loggedIn,false);
  assert.equal(poll.status,'waiting');
  await request('login/cancel','POST');
  assert.equal(BrowserWindow.getAllWindows().length,0,'signing window must close after cancel');
  const search = await request('search?keywords='+encodeURIComponent('周杰伦'));
  assert.ok(search.songs.length > 0);
  const playback = await request('song/url?id='+encodeURIComponent(search.songs[0].id));
  assert.equal(playback.playable,false);
  assert.equal(playback.reason,'login_required');
  console.log(JSON.stringify({ok:true, qr:true, poll:true, cancelReleasedWindow:true, publicSearchCount:search.songs.length, loginRequired:true}));
  await integration.dispose(); server.close(); clearTimeout(timer); app.exit(0);
}).catch(async error => {
  console.error(error.message);
  if (integration) await integration.dispose().catch(()=>{});
  if (server) server.close(); clearTimeout(timer); app.exit(1);
});
