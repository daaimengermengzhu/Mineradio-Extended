const test = require('node:test');
const assert = require('node:assert/strict');
const { CustomSourceManager } = require('../../desktop/custom-source/manager');

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createStore(items = [], activeId = '') {
  const state = {
    activeId,
    items: items.map(item => ({ status: 'idle', message: '', allowUpdateAlert: true, ...clone(item) })),
    scripts: new Map(items.map(item => [item.id, item.script || `/**\n * @name ${item.name || item.id}\n */`])),
  };
  return {
    state,
    list: () => state.items.map(item => ({ ...clone(item), active: item.id === state.activeId })),
    get: id => clone(state.items.find(item => item.id === id) || null),
    getActive: () => clone(state.items.find(item => item.id === state.activeId) || null),
    getScript: id => state.scripts.get(id),
    setActive(id) { state.activeId = id || ''; },
    setStatus(id, status, message, sources) {
      const item = state.items.find(value => value.id === id);
      if (item) Object.assign(item, { status, message: String(message || ''), sources: clone(sources || item.sources || {}) });
    },
    importScript(script, sourceFileName) {
      const item = { id: `imported-${state.items.length + 1}`, name: 'Imported', sourceFileName, status: 'idle', message: '' };
      state.items.push(item);
      state.scripts.set(item.id, script);
      return clone(item);
    },
    replaceScript(id, script) { state.scripts.set(id, script); return this.get(id); },
    remove(id) {
      state.items = state.items.filter(item => item.id !== id);
      state.scripts.delete(id);
      if (state.activeId === id) state.activeId = '';
    },
  };
}

test('uses an active source only after an eligible official technical failure', async () => {
  const sources = { kg: { actions: ['musicUrl'], qualitys: ['128k', 'flac'] } };
  const store = createStore([{ id: 'a', name: 'A', sources }], 'a');
  let requestPayload;
  const runtime = {
    start: async () => ({ sources }),
    request: async payload => { requestPayload = payload; return 'https://audio.example.com/song.flac'; },
    stop() {},
  };
  const manager = new CustomSourceManager({
    store,
    runtimeFactory: () => runtime,
    validateResolvedUrl: async url => url,
  });
  await manager.startActive();

  const denied = await manager.resolveFallback({
    song: { provider: 'kugou', hash: 'ABC', id: 1 },
    quality: 'hires',
    officialResult: { url: '', reason: 'vip_required' },
  });
  assert.equal(denied.attempted, false);

  const result = await manager.resolveFallback({
    song: { provider: 'kugouMusic', hash: 'ABC', id: 1 },
    quality: 'hires',
    officialResult: { url: '', reason: 'url_unavailable' },
  });
  assert.equal(result.url, 'https://audio.example.com/song.flac');
  assert.equal(result.source, 'kg');
  assert.equal(result.level, 'lossless');
  assert.equal(requestPayload.source, 'kg');
  assert.equal(requestPayload.info.musicInfo.hash, 'abc');
});

test('validates an imported script before persisting it', async () => {
  const store = createStore();
  const order = [];
  const runtime = {
    start: async () => { order.push('validate'); return { sources: { wy: { actions: ['musicUrl'], qualitys: ['128k'] } } }; },
    stop: async () => { order.push('stop'); },
  };
  const originalImport = store.importScript;
  store.importScript = (script, name) => { order.push('persist'); return originalImport.call(store, script, name); };
  const manager = new CustomSourceManager({ store, runtimeFactory: () => runtime });
  const result = await manager.importScript('/**\n * @name Imported\n */\nvoid 0', 'imported.js');
  assert.equal(result.sourceFileName, 'imported.js');
  assert.deepEqual(order, ['validate', 'persist', 'stop']);
});

test('keeps the current runtime when activating a candidate fails', async () => {
  const sources = { wy: { actions: ['musicUrl'], qualitys: ['128k'] } };
  const store = createStore([{ id: 'a', sources }, { id: 'b' }], 'a');
  let oldStops = 0;
  const queue = [
    { start: async () => ({ sources }), stop: () => { oldStops += 1; } },
    { start: async () => { throw new Error('INIT_FAILED: bad source'); }, stop() {} },
  ];
  const manager = new CustomSourceManager({ store, runtimeFactory: () => queue.shift() });
  await manager.startActive();
  await assert.rejects(manager.activate('b'), /bad source/);
  assert.equal(manager.getStatus().activeId, 'a');
  assert.equal(store.state.activeId, 'a');
  assert.equal(oldStops, 0);
});

test('does not resolve unsupported Qishui tracks', async () => {
  const sources = { kg: { actions: ['musicUrl'], qualitys: ['128k'] } };
  const store = createStore([{ id: 'a', sources }], 'a');
  const manager = new CustomSourceManager({
    store,
    runtimeFactory: () => ({ start: async () => ({ sources }), request: async () => { throw new Error('unused'); }, stop() {} }),
  });
  await manager.startActive();
  const result = await manager.resolveFallback({
    song: { provider: 'qishui', id: 1 },
    quality: 'standard',
    officialResult: { url: '', reason: 'url_unavailable' },
  });
  assert.equal(result.attempted, true);
  assert.equal(result.reason, 'source_unsupported');
});
