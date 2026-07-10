const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseScriptInfo } = require('./protocol');

const MAX_SCRIPT_BYTES = 1024 * 1024;
const MAX_SOURCE_COUNT = 20;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeScriptId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
}

function sourceFileName(value) {
  return path.basename(String(value || '').replace(/\\/g, '/')).slice(0, 160);
}

function validateScript(script) {
  if (typeof script !== 'string') throw new TypeError('IMPORT_INVALID: script must be a string');
  if (Buffer.byteLength(script, 'utf8') > MAX_SCRIPT_BYTES) throw new Error('IMPORT_INVALID: script is too large');
  return script;
}

class CustomSourceStore {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.scriptDir = path.join(rootDir, 'scripts');
    this.indexFile = path.join(rootDir, 'sources.json');
    fs.mkdirSync(this.scriptDir, { recursive: true });
    this.state = this.#readState();
  }

  #readState() {
    let raw;
    try {
      raw = fs.readFileSync(this.indexFile, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const state = { activeId: '', items: [] };
      this.#writeState(state);
      return state;
    }
    try {
      return this.#normalizeState(JSON.parse(raw));
    } catch {
      this.#backupCorruptIndex();
      const state = { activeId: '', items: [] };
      this.#writeState(state);
      return state;
    }
  }

  #normalizeState(parsed) {
    if (!isPlainObject(parsed) || typeof parsed.activeId !== 'string' || !Array.isArray(parsed.items)) {
      throw new Error('Invalid source index');
    }
    if (!parsed.items.every(item => isPlainObject(item) && isSafeScriptId(item.id))) {
      throw new Error('Invalid source item');
    }
    if (parsed.activeId && !parsed.items.some(item => item.id === parsed.activeId)) {
      throw new Error('Invalid active source');
    }
    return { activeId: parsed.activeId, items: clone(parsed.items) };
  }

  #backupCorruptIndex() {
    const backup = `${this.indexFile}.corrupt.${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    fs.copyFileSync(this.indexFile, backup);
  }

  #writeState(state) {
    fs.mkdirSync(this.rootDir, { recursive: true });
    const temp = `${this.indexFile}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(temp, this.indexFile);
    } catch (error) {
      fs.rmSync(temp, { force: true });
      throw error;
    }
  }

  #save() {
    this.#writeState(this.state);
  }

  #scriptPath(id) {
    if (!isSafeScriptId(id)) throw new Error('SOURCE_NOT_FOUND');
    return path.join(this.scriptDir, `${id}.js`);
  }

  #hash(script) {
    return crypto.createHash('sha256').update(script).digest('hex');
  }

  #writeScript(id, script) {
    const destination = this.#scriptPath(id);
    const temp = `${destination}.${Date.now()}_${crypto.randomBytes(3).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(temp, script, 'utf8');
      fs.renameSync(temp, destination);
    } catch (error) {
      fs.rmSync(temp, { force: true });
      throw error;
    }
  }

  importScript(script, fileName = '') {
    validateScript(script);
    if (this.state.items.length >= MAX_SOURCE_COUNT) throw new Error('IMPORT_INVALID: too many custom sources');
    const hash = this.#hash(script);
    if (this.state.items.some(item => item.hash === hash)) throw new Error('IMPORT_INVALID: duplicate script');
    const now = Date.now();
    const id = `user_api_${now}_${crypto.randomBytes(4).toString('hex')}`;
    const item = {
      id,
      ...parseScriptInfo(script),
      sourceFileName: sourceFileName(fileName),
      hash,
      allowUpdateAlert: true,
      status: 'idle',
      message: '',
      sources: {},
      createdAt: now,
      updatedAt: now,
    };
    this.#writeScript(id, script);
    this.state.items.push(item);
    try {
      this.#save();
    } catch (error) {
      this.state.items.pop();
      fs.rmSync(this.#scriptPath(id), { force: true });
      throw error;
    }
    return clone(item);
  }

  list() {
    return this.state.items.map(item => ({ ...clone(item), active: item.id === this.state.activeId }));
  }

  get(id) {
    const item = this.state.items.find(value => value.id === id);
    return item ? clone(item) : null;
  }

  getScript(id) {
    if (!this.get(id)) throw new Error('SOURCE_NOT_FOUND');
    return fs.readFileSync(this.#scriptPath(id), 'utf8');
  }

  getActive() {
    return this.get(this.state.activeId);
  }

  setActive(id) {
    if (id && !this.get(id)) throw new Error('SOURCE_NOT_FOUND');
    const previous = this.state.activeId;
    this.state.activeId = id || '';
    try {
      this.#save();
    } catch (error) {
      this.state.activeId = previous;
      throw error;
    }
  }

  setStatus(id, status, message = '', sources) {
    const index = this.state.items.findIndex(item => item.id === id);
    if (index < 0) return;
    const previous = clone(this.state.items[index]);
    Object.assign(this.state.items[index], {
      status: String(status || 'idle'),
      message: String(message || '').slice(0, 1024),
      sources: sources ? clone(sources) : clone(this.state.items[index].sources || {}),
      updatedAt: Date.now(),
    });
    try {
      this.#save();
    } catch (error) {
      this.state.items[index] = previous;
      throw error;
    }
  }

  setAllowUpdateAlert(id, enabled) {
    const index = this.state.items.findIndex(item => item.id === id);
    if (index < 0) throw new Error('SOURCE_NOT_FOUND');
    const previous = this.state.items[index].allowUpdateAlert;
    this.state.items[index].allowUpdateAlert = !!enabled;
    try {
      this.#save();
    } catch (error) {
      this.state.items[index].allowUpdateAlert = previous;
      throw error;
    }
  }

  replaceScript(id, script, fileName = '') {
    validateScript(script);
    const index = this.state.items.findIndex(item => item.id === id);
    if (index < 0) throw new Error('SOURCE_NOT_FOUND');
    const hash = this.#hash(script);
    if (this.state.items.some(item => item.id !== id && item.hash === hash)) throw new Error('IMPORT_INVALID: duplicate script');

    const destination = this.#scriptPath(id);
    const next = `${destination}.next`;
    const previous = `${destination}.previous`;
    fs.rmSync(next, { force: true });
    fs.rmSync(previous, { force: true });
    fs.writeFileSync(next, script, 'utf8');
    fs.renameSync(destination, previous);
    try {
      fs.renameSync(next, destination);
    } catch (error) {
      fs.renameSync(previous, destination);
      throw error;
    }

    const previousItem = clone(this.state.items[index]);
    Object.assign(this.state.items[index], parseScriptInfo(script), {
      hash,
      sourceFileName: fileName ? sourceFileName(fileName) : previousItem.sourceFileName,
      status: 'idle',
      message: '',
      sources: {},
      updatedAt: Date.now(),
    });
    try {
      this.#save();
    } catch (error) {
      this.state.items[index] = previousItem;
      fs.rmSync(destination, { force: true });
      fs.renameSync(previous, destination);
      throw error;
    }
    try { fs.rmSync(previous, { force: true }); } catch {}
    return clone(this.state.items[index]);
  }

  remove(id) {
    const index = this.state.items.findIndex(item => item.id === id);
    if (index < 0) throw new Error('SOURCE_NOT_FOUND');
    const destination = this.#scriptPath(id);
    const staged = `${destination}.remove`;
    fs.rmSync(staged, { force: true });
    fs.renameSync(destination, staged);
    const previousState = this.state;
    this.state = {
      activeId: this.state.activeId === id ? '' : this.state.activeId,
      items: this.state.items.filter(item => item.id !== id),
    };
    try {
      this.#save();
    } catch (error) {
      this.state = previousState;
      fs.renameSync(staged, destination);
      throw error;
    }
    try { fs.rmSync(staged, { force: true }); } catch {}
  }
}

module.exports = { CustomSourceStore, MAX_SCRIPT_BYTES, MAX_SOURCE_COUNT };
