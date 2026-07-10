const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { LxSourceRuntime } = require('../../desktop/custom-source/runtime');

class FakeIpcMain extends EventEmitter {
  constructor() { super(); this.handlers = new Map(); }
  handle(name, handler) { this.handlers.set(name, handler); }
  removeHandler(name) { this.handlers.delete(name); }
}

let nextId = 1;
class FakeWebContents extends EventEmitter {
  constructor() {
    super();
    this.id = nextId++;
    this.sent = [];
    this.session = {
      webRequest: { onBeforeRequest: handler => { this.beforeRequest = handler; } },
      setPermissionRequestHandler: handler => { this.permissionHandler = handler; },
      on: (name, handler) => { if (name === 'will-download') this.downloadHandler = handler; },
      clearStorageData: async () => {},
    };
  }
  send(...args) { this.sent.push(args); }
  setWindowOpenHandler(handler) { this.windowOpenHandler = handler; }
  setAudioMuted(value) { this.audioMuted = value; }
  closeDevTools() { this.devToolsClosed = true; }
}

class FakeBrowserWindow extends EventEmitter {
  static instances = [];
  constructor(options) {
    super();
    this.options = options;
    this.webContents = new FakeWebContents();
    this.destroyed = false;
    FakeBrowserWindow.instances.push(this);
  }
  loadFile(file) { this.loadedFile = file; return Promise.resolve(); }
  destroy() { this.destroyed = true; this.emit('closed'); }
  isDestroyed() { return this.destroyed; }
}

test('runtime document and preload expose only the LX compatibility bridge', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../desktop/custom-source/runtime.html'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../../desktop/custom-source/runtime-preload.js'), 'utf8');
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(preload, /version:\s*['"]2\.0\.0['"]/);
  assert.match(preload, /mineradio-lx-bootstrap/);
  assert.doesNotMatch(preload, /require\(['"]node:(fs|path|child_process)/);
});

test('creates a hidden non-persistent sandbox and blocks direct network escape surfaces', async () => {
  FakeBrowserWindow.instances.length = 0;
  const ipcMain = new FakeIpcMain();
  const runtime = new LxSourceRuntime({
    script: 'void 0',
    currentScriptInfo: { name: 'test' },
    broker: { request: async () => ({}) },
    electron: { BrowserWindow: FakeBrowserWindow, ipcMain, app: { isPackaged: true } },
  });
  const started = runtime.start();
  const win = FakeBrowserWindow.instances[0];
  const prefs = win.options.webPreferences;
  assert.equal(win.options.show, false);
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.nodeIntegrationInWorker, false);
  assert.equal(prefs.partition.startsWith('persist:'), false);
  assert.equal(prefs.devTools, false);
  assert.deepEqual(win.webContents.windowOpenHandler(), { action: 'deny' });

  const directRequest = {};
  win.webContents.beforeRequest({ url: 'https://example.com/pixel' }, value => Object.assign(directRequest, value));
  assert.deepEqual(directRequest, { cancel: true });

  for (const eventName of ['will-navigate', 'will-redirect', 'will-attach-webview']) {
    const event = { prevented: false, preventDefault() { this.prevented = true; } };
    win.webContents.emit(eventName, event);
    assert.equal(event.prevented, true, eventName);
  }

  runtime.stop();
  await assert.rejects(started, /stopped/i);
});
