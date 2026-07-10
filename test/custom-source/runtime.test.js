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

function emitSync(ipcMain, channel, sender, payload) {
  const event = { sender, returnValue: undefined };
  ipcMain.emit(channel, event, payload);
  return event.returnValue;
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

test('sender-checks bootstrap, initializes, and resolves an action response', async () => {
  FakeBrowserWindow.instances.length = 0;
  const ipcMain = new FakeIpcMain();
  const runtime = new LxSourceRuntime({
    script: 'void 0',
    currentScriptInfo: { name: 'source', author: 'tester', secret: 'hidden' },
    broker: { request: async () => ({}) },
    electron: { BrowserWindow: FakeBrowserWindow, ipcMain, app: { isPackaged: false } },
  });
  const started = runtime.start();
  const win = FakeBrowserWindow.instances[0];
  assert.deepEqual(emitSync(ipcMain, 'mineradio-lx-bootstrap', win.webContents, { runtimeId: runtime.runtimeId }), {
    currentScriptInfo: { name: 'source', author: 'tester' },
  });
  assert.deepEqual(emitSync(ipcMain, 'mineradio-lx-bootstrap', { id: 999 }, { runtimeId: runtime.runtimeId }), { error: 'UNAUTHORIZED' });
  await ipcMain.handlers.get('mineradio-lx-inited')({ sender: win.webContents }, {
    runtimeId: runtime.runtimeId,
    data: { sources: { wy: { name: 'WY', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } } },
  });
  await started;

  const pending = runtime.request({ source: 'wy', action: 'musicUrl', info: {} });
  const sent = win.webContents.sent.at(-1);
  assert.equal(sent[0], 'mineradio-lx-request');
  ipcMain.emit('mineradio-lx-response', { sender: win.webContents }, {
    runtimeId: runtime.runtimeId,
    requestKey: sent[1].requestKey,
    result: 'https://audio.example.com/a.mp3',
  });
  assert.equal(await pending, 'https://audio.example.com/a.mp3');
  runtime.stop();
});

test('services crypto and zlib IPC only for the owning runtime', async () => {
  FakeBrowserWindow.instances.length = 0;
  const ipcMain = new FakeIpcMain();
  const runtime = new LxSourceRuntime({
    script: 'void 0',
    broker: { request: async () => ({}) },
    electron: { BrowserWindow: FakeBrowserWindow, ipcMain, app: { isPackaged: false } },
  });
  const started = runtime.start();
  const win = FakeBrowserWindow.instances[0];
  assert.equal(emitSync(ipcMain, 'mineradio-lx-crypto', win.webContents, {
    runtimeId: runtime.runtimeId,
    operation: 'md5',
    args: ['abc'],
  }), '900150983cd24fb0d6963f7d28e17f72');
  const compressed = await ipcMain.handlers.get('mineradio-lx-zlib')({ sender: win.webContents }, {
    runtimeId: runtime.runtimeId,
    operation: 'deflate',
    data: Buffer.from('hello'),
  });
  const inflated = await ipcMain.handlers.get('mineradio-lx-zlib')({ sender: win.webContents }, {
    runtimeId: runtime.runtimeId,
    operation: 'inflate',
    data: compressed,
  });
  assert.equal(Buffer.from(inflated).toString(), 'hello');
  runtime.stop();
  await assert.rejects(started, /stopped/i);
});

test('cancels broker requests and rejects runtimes that never initialize', async () => {
  FakeBrowserWindow.instances.length = 0;
  const ipcMain = new FakeIpcMain();
  const broker = {
    request: async (_url, _options, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  };
  const runtime = new LxSourceRuntime({
    script: 'void 0',
    initTimeout: 20,
    broker,
    electron: { BrowserWindow: FakeBrowserWindow, ipcMain, app: { isPackaged: false } },
  });
  const started = runtime.start();
  const win = FakeBrowserWindow.instances[0];
  const pending = ipcMain.handlers.get('mineradio-lx-http')({ sender: win.webContents }, {
    runtimeId: runtime.runtimeId,
    requestId: 'request-1',
    url: 'https://api.example.com',
    options: {},
  });
  ipcMain.emit('mineradio-lx-http-cancel', { sender: win.webContents }, {
    runtimeId: runtime.runtimeId,
    requestId: 'request-1',
  });
  assert.match((await pending).error, /Cancel/i);
  await assert.rejects(started, /INIT_TIMEOUT/);
  assert.equal(runtime.window, null);
});
