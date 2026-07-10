const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const { SafeHttpBroker } = require('./http-broker');
const { filterInitPayload, validateActionResponse } = require('./protocol');
const { redactSecrets } = require('./redact');

const inflate = promisify(zlib.inflate);
const deflate = promisify(zlib.deflate);
const RUNTIME_ARGUMENT = '--mineradio-lx-runtime-id=';
const INIT_TIMEOUT = 10_000;
const ACTION_TIMEOUT = 20_000;
const MAX_ZLIB_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_ZLIB_OUTPUT_BYTES = 8 * 1024 * 1024;
const hosts = new WeakMap();
const SCRIPT_INFO_KEYS = ['name', 'description', 'version', 'author', 'homepage'];

function safeScriptInfo(value) {
  const result = {};
  if (!value || typeof value !== 'object') return result;
  for (const key of SCRIPT_INFO_KEYS) if (typeof value[key] === 'string') result[key] = value[key];
  return result;
}

function errorResult(error) {
  return { error: String(error?.message || error).slice(0, 1024) };
}

function limitedBuffer(value, maxBytes, message) {
  if (typeof value === 'string' && Buffer.byteLength(value) > maxBytes) throw new Error(message);
  if (value?.byteLength > maxBytes) throw new Error(message);
  const buffer = Buffer.from(value || []);
  if (buffer.length > maxBytes) throw new Error(message);
  return buffer;
}

async function runZlib(payload = {}) {
  const input = limitedBuffer(payload.data, MAX_ZLIB_INPUT_BYTES, 'ZLIB_FAILED: Input too large');
  if (payload.operation === 'deflate') {
    const output = await deflate(input, { maxOutputLength: MAX_ZLIB_OUTPUT_BYTES });
    if (output.length > MAX_ZLIB_OUTPUT_BYTES) throw new Error('ZLIB_FAILED: Output too large');
    return output;
  }
  if (payload.operation === 'inflate') {
    try {
      const output = await inflate(input, { maxOutputLength: MAX_ZLIB_OUTPUT_BYTES });
      if (output.length > MAX_ZLIB_OUTPUT_BYTES) throw new Error('ZLIB_FAILED: Output too large');
      return output;
    } catch (error) {
      if (/maxOutputLength|too large|BUFFER_TOO_LARGE|larger than/i.test(String(error?.message || error))) {
        throw new Error('ZLIB_FAILED: Output too large');
      }
      throw error;
    }
  }
  throw new Error('ZLIB_FAILED: Unsupported operation');
}

function runCrypto(payload = {}) {
  const args = Array.isArray(payload.args) ? payload.args : [];
  if (payload.operation === 'md5') return crypto.createHash('md5').update(String(args[0] ?? '')).digest('hex');
  if (payload.operation === 'aesEncrypt') {
    const cipher = crypto.createCipheriv(String(args[1]), Buffer.from(args[2]), Buffer.from(args[3]));
    return Buffer.concat([cipher.update(Buffer.from(args[0])), cipher.final()]);
  }
  if (payload.operation === 'rsaEncrypt') {
    let data = Buffer.from(args[0]);
    if (data.length > 128) throw new Error('CRYPTO_FAILED: RSA input is too large');
    data = Buffer.concat([Buffer.alloc(128 - data.length), data]);
    return crypto.publicEncrypt({ key: args[1], padding: crypto.constants.RSA_NO_PADDING }, data);
  }
  if (payload.operation === 'randomBytes') {
    const size = Number(args[0]);
    if (!Number.isInteger(size) || size < 0 || size > 65_536) throw new Error('CRYPTO_FAILED: Invalid random byte count');
    return crypto.randomBytes(size);
  }
  throw new Error('CRYPTO_FAILED: Unsupported operation');
}

function runtimeFor(host, event, payload) {
  const runtime = payload && host.runtimes.get(payload.runtimeId);
  return runtime && runtime.window && event.sender?.id === runtime.window.webContents.id ? runtime : null;
}

function installHost(ipcMain) {
  let host = hosts.get(ipcMain);
  if (host) return host;
  host = { ipcMain, runtimes: new Map(), listeners: new Map(), handles: new Set() };

  const sync = (channel, operation) => {
    const listener = (event, payload) => {
      const runtime = runtimeFor(host, event, payload);
      if (!runtime) { event.returnValue = { error: 'UNAUTHORIZED' }; return; }
      try { event.returnValue = operation(runtime, payload); }
      catch (error) { runtime.logError(channel, error); event.returnValue = errorResult(error); }
    };
    ipcMain.on(channel, listener);
    host.listeners.set(channel, listener);
  };
  const receive = (channel, operation) => {
    const listener = (event, payload) => {
      const runtime = runtimeFor(host, event, payload);
      if (runtime) operation(runtime, payload);
    };
    ipcMain.on(channel, listener);
    host.listeners.set(channel, listener);
  };
  const handle = (channel, operation) => {
    ipcMain.handle(channel, async (event, payload) => {
      const runtime = runtimeFor(host, event, payload);
      if (!runtime) throw new Error('UNAUTHORIZED');
      return operation(runtime, payload);
    });
    host.handles.add(channel);
  };

  sync('mineradio-lx-bootstrap', runtime => ({ currentScriptInfo: { ...runtime.currentScriptInfo } }));
  sync('mineradio-lx-crypto', (_runtime, payload) => runCrypto(payload));
  handle('mineradio-lx-zlib', (_runtime, payload) => runZlib(payload));
  handle('mineradio-lx-http', async (runtime, payload) => {
    try { return await runtime.handleHttp(payload); }
    catch (error) { return errorResult(error); }
  });
  handle('mineradio-lx-inited', (runtime, payload) => runtime.handleInited(payload.data));
  handle('mineradio-lx-update-alert', (runtime, payload) => runtime.handleUpdateAlert(payload.data));
  receive('mineradio-lx-http-cancel', (runtime, payload) => runtime.cancelHttp(payload.requestId));
  receive('mineradio-lx-response', (runtime, payload) => runtime.handleActionResponse(payload));
  receive('mineradio-lx-init-error', (runtime, payload) => runtime.failInit(payload.error, true));
  hosts.set(ipcMain, host);
  return host;
}

function uninstallHostIfUnused(host) {
  if (host.runtimes.size) return;
  for (const [channel, listener] of host.listeners) host.ipcMain.removeListener(channel, listener);
  for (const channel of host.handles) host.ipcMain.removeHandler(channel);
  hosts.delete(host.ipcMain);
}

class LxSourceRuntime {
  constructor({
    script,
    currentScriptInfo = {},
    electron,
    broker,
    logger = console,
    onUpdateAlert,
    initTimeout = INIT_TIMEOUT,
  }) {
    if (typeof script !== 'string') throw new TypeError('script must be a string');
    this.script = script;
    this.currentScriptInfo = safeScriptInfo(currentScriptInfo);
    this.electron = electron || require('electron');
    this.broker = broker || new SafeHttpBroker();
    this.logger = logger;
    this.onUpdateAlert = onUpdateAlert;
    this.initTimeout = Math.min(Math.max(Number(initTimeout) || INIT_TIMEOUT, 1), 60_000);
    this.runtimeId = crypto.randomUUID();
    this.window = null;
    this.host = null;
    this.initState = null;
    this.httpRequests = new Map();
    this.actions = new Map();
    this.stopped = false;
  }

  start() {
    if (this.initState) return this.initState.promise;
    const { BrowserWindow, ipcMain } = this.electron;
    this.host = installHost(ipcMain);
    this.host.runtimes.set(this.runtimeId, this);
    let resolveInit;
    let rejectInit;
    const promise = new Promise((resolve, reject) => { resolveInit = resolve; rejectInit = reject; });
    promise.catch(() => {});
    this.initState = {
      promise,
      resolve: resolveInit,
      reject: rejectInit,
      settled: false,
      timer: setTimeout(() => this.failInit('INIT_TIMEOUT: Script did not initialize', true), this.initTimeout),
    };
    try {
      this.window = new BrowserWindow({
        show: false,
        width: 1,
        height: 1,
        backgroundColor: '#00000000',
        webPreferences: {
          preload: path.join(__dirname, 'runtime-preload.js'),
          nodeIntegration: false,
          nodeIntegrationInWorker: false,
          contextIsolation: true,
          sandbox: true,
          devTools: false,
          webviewTag: false,
          partition: `mineradio-lx-${this.runtimeId}`,
          images: false,
          webgl: false,
          spellcheck: false,
          autoplayPolicy: 'document-user-activation-required',
          additionalArguments: [`${RUNTIME_ARGUMENT}${this.runtimeId}`],
        },
      });
      const contents = this.window.webContents;
      contents.setAudioMuted?.(true);
      for (const eventName of ['will-navigate', 'will-redirect', 'will-attach-webview']) {
        contents.on(eventName, event => event.preventDefault());
      }
      contents.setWindowOpenHandler(() => ({ action: 'deny' }));
      contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      contents.session.on('will-download', event => event.preventDefault());
      contents.session.webRequest.onBeforeRequest((details, callback) => {
        callback({ cancel: /^(?:https?|wss?):/i.test(String(details.url || '')) });
      });
      contents.on('devtools-opened', () => contents.closeDevTools?.());
      contents.once('did-finish-load', () => {
        if (!this.stopped && this.window && !this.window.isDestroyed()) {
          contents.send('mineradio-lx-script', { runtimeId: this.runtimeId, script: this.script });
        }
      });
      this.window.once('closed', () => { if (!this.stopped) this.stop(); });
      Promise.resolve(this.window.loadFile(path.join(__dirname, 'runtime.html')))
        .catch(error => this.failInit(`INIT_FAILED: ${error.message}`, true));
    } catch (error) {
      this.failInit(`INIT_FAILED: ${error.message}`, true);
    }
    return promise;
  }

  handleInited(data) {
    if (!this.initState || this.initState.settled) throw new Error('INIT_FAILED: Script is already initialized');
    let filtered;
    try { filtered = filterInitPayload(data); }
    catch (error) { this.failInit(error.message, true); throw error; }
    this.initState.settled = true;
    clearTimeout(this.initState.timer);
    this.initState.resolve(filtered);
    return filtered;
  }

  failInit(message, stopRuntime = false) {
    if (this.initState && !this.initState.settled) {
      this.initState.settled = true;
      clearTimeout(this.initState.timer);
      this.initState.reject(new Error(String(message || 'INIT_FAILED').slice(0, 1024)));
    }
    if (stopRuntime) this.stop();
  }

  async handleHttp(payload = {}) {
    const requestId = String(payload.requestId || '');
    if (!requestId || requestId.length > 128 || this.httpRequests.has(requestId)) {
      throw new Error('HTTP_FAILED: Invalid request id');
    }
    const controller = new AbortController();
    this.httpRequests.set(requestId, controller);
    try {
      return await this.broker.request(payload.url, payload.options || {}, controller.signal);
    } finally {
      this.httpRequests.delete(requestId);
    }
  }

  cancelHttp(requestId) {
    this.httpRequests.get(String(requestId))?.abort(new Error('HTTP_FAILED: Cancelled'));
  }

  request(data, signal) {
    if (!this.window || this.stopped) return Promise.reject(new Error('RUNTIME_STOPPED'));
    const requestKey = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const finish = () => {
        const pending = this.actions.get(requestKey);
        if (!pending) return null;
        clearTimeout(pending.timer);
        signal?.removeEventListener('abort', pending.abort);
        this.actions.delete(requestKey);
        return pending;
      };
      const timer = setTimeout(() => {
        if (finish()) reject(new Error('REQUEST_FAILED: Timed out'));
      }, ACTION_TIMEOUT);
      const abort = () => {
        if (finish()) reject(signal.reason || new Error('REQUEST_FAILED: Cancelled'));
      };
      this.actions.set(requestKey, { resolve, reject, timer, abort, action: data.action });
      if (signal) {
        if (signal.aborted) { abort(); return; }
        signal.addEventListener('abort', abort, { once: true });
      }
      this.window.webContents.send('mineradio-lx-request', { requestKey, data });
    });
  }

  handleActionResponse(payload = {}) {
    const pending = this.actions.get(payload.requestKey);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.actions.delete(payload.requestKey);
    if (payload.error) { pending.reject(new Error(String(payload.error).slice(0, 1024))); return; }
    try { pending.resolve(validateActionResponse(pending.action, payload.result)); }
    catch (error) { pending.reject(error); }
  }

  handleUpdateAlert(data) {
    const safe = redactSecrets(data);
    if (!safe || typeof safe !== 'object' || typeof safe.log !== 'string') {
      throw new Error('UPDATE_ALERT_FAILED: Invalid data');
    }
    let updateUrl;
    if (safe.updateUrl != null && safe.updateUrl !== '') {
      if (typeof safe.updateUrl !== 'string' || !/^https?:\/\//i.test(safe.updateUrl) || safe.updateUrl.length > 1024) {
        throw new Error('UPDATE_ALERT_FAILED: Invalid update URL');
      }
      updateUrl = safe.updateUrl;
    }
    this.onUpdateAlert?.({ log: safe.log.slice(0, 1024), updateUrl });
  }

  logError(scope, error) {
    this.logger?.error?.(`[custom-source:${scope}]`, redactSecrets({ message: String(error?.message || error).slice(0, 1024) }));
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.failInit('Runtime stopped');
    for (const controller of this.httpRequests.values()) controller.abort(new Error('Runtime stopped'));
    this.httpRequests.clear();
    for (const pending of this.actions.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Runtime stopped'));
    }
    this.actions.clear();
    if (this.host) {
      this.host.runtimes.delete(this.runtimeId);
      uninstallHostIfUnused(this.host);
      this.host = null;
    }
    const win = this.window;
    this.window = null;
    Promise.resolve(win?.webContents?.session?.clearStorageData?.()).catch(() => {});
    if (win && !win.isDestroyed()) win.destroy();
  }
}

module.exports = { LxSourceRuntime, runCrypto, runZlib };
