'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createQishuiQrLoginBridge, hasLoginCookie } = require('../qishui-qr-login');

test('Qishui Passport QR bridge persists a confirmed official web session and clears it', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-qishui-passport-'));
  const configFile = path.join(tempDir, 'qishui-qr.json');
  let hooks = null;
  let clearCount = 0;
  let pollCount = 0;
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const auth = {
    configure(value) {
      hooks = value;
    },
    async getQrCode() {
      return {
        message: 'success',
        data: {
          token: 'official-passport-token',
          qrcode: 'data:image/png;base64,TEST',
          qrcode_index_url: 'https://api.qishui.com/passport/web/get_qrcode/?token=official-passport-token',
        },
      };
    },
    async checkQrConnect(token) {
      pollCount++;
      assert.equal(token, 'official-passport-token');
      hooks.updateConfig({
        deviceId: '386088-device',
        installId: '386088-install',
        cookie: 'sessionid=official-session; sessionid_ss=official-session',
        msToken: 'signed-ms-token',
      });
      return { message: 'success', data: { error_code: 0, status: '3' } };
    },
    async clear() {
      clearCount += 1;
    },
  };

  const bridge = createQishuiQrLoginBridge({ auth, configFile });
  const qr = await bridge.createQrCode();
  assert.equal(qr.data.token, 'official-passport-token');

  const confirmed = await bridge.checkQrConnect(qr.data.token);
  assert.equal(confirmed.data.confirmed, true);
  assert.equal((await bridge.checkQrConnect(qr.data.token)).data.confirmed, true);
  assert.equal(pollCount, 1, 'account verification retries reuse a confirmed QR without consuming its upstream token again');
  assert.equal(bridge.getStatus().loggedIn, true);
  assert.match(bridge.getCookie(), /sessionid=official-session/);
  const saved = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(saved.deviceId, '386088-device');
  assert.equal(saved.installId, '386088-install');
  assert.equal(saved.msToken, 'signed-ms-token');

  await bridge.clear();
  assert.equal(clearCount, 1);
  assert.equal(bridge.getStatus().loggedIn, false);
  const cleared = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(cleared.cookie, '');
  assert.equal(cleared.msToken, '');
  assert.equal(cleared.deviceId, '386088-device');
});

test('an old saved cookie or superseded QR poll cannot confirm a new login', async t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-qishui-qr-scope-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  let nextToken = 0;
  let finishPoll;
  const auth = {
    configure() {},
    async getQrCode() { return { data: { token: 'qr-' + (++nextToken), qrcode: 'data:image/png;base64,TEST' } }; },
    checkQrConnect() { return new Promise(resolve => { finishPoll = resolve; }); },
    async clear() {},
  };
  const bridge = createQishuiQrLoginBridge({ auth, configFile: path.join(tempDir, 'login.json'),
    initialConfig: { cookie: 'sessionid=old-saved-fixture' } });
  const first = await bridge.createQrCode();
  assert.equal(bridge.getStatus().loggedIn, false, 'existing cookie is not a fresh QR confirmation');
  assert.equal(bridge.getStatus().cookieReady, true, 'starting QR login preserves the saved account');
  const poll = bridge.checkQrConnect(first.data.token);
  const second = await bridge.createQrCode();
  finishPoll({ data: { error_code: 0, status: '3' } });
  assert.equal((await poll).data.confirmed, false);
  assert.equal(bridge.getStatus().qrConfirmed, false);
  assert.equal(bridge.getStatus().loggedIn, false);
  assert.equal((await bridge.checkQrConnect(first.data.token)).data.status, 'expired');
  const waiting = bridge.checkQrConnect(second.data.token);
  finishPoll({ data: { error_code: 0, status: 'new' } });
  assert.equal((await waiting).data.confirmed, false);
  assert.equal(bridge.getStatus().loggedIn, false);
  assert.equal(hasLoginCookie('sessionid=; sid_tt= '), false);
});
