const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CustomSourceStore, MAX_SCRIPT_BYTES } = require('../../desktop/custom-source/store');

function tempStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-source-'));
  return { root, store: new CustomSourceStore(root) };
}

const SCRIPT_A = '/**\n * @name Source A\n * @version 1\n */\nvoid 0';

test('initializes an empty index and stores scripts without a local absolute path', () => {
  const { root, store } = tempStore();
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'sources.json'), 'utf8')), { activeId: '', items: [] });

  const item = store.importScript(SCRIPT_A, 'C:\\Users\\name\\Downloads\\source-a.js');
  assert.equal(item.name, 'Source A');
  assert.equal(item.sourceFileName, 'source-a.js');
  assert.equal(Object.hasOwn(item, 'originalPath'), false);
  assert.equal(JSON.stringify(store.list()).includes('Users'), false);
});

test('rejects oversized, duplicate and non-string scripts', () => {
  const { store } = tempStore();
  assert.throws(() => store.importScript('x'.repeat(MAX_SCRIPT_BYTES + 1), 'large.js'), /too large/i);
  assert.throws(() => store.importScript(Buffer.from('x'), 'buffer.js'), /string/i);
  store.importScript(SCRIPT_A, 'a.js');
  assert.throws(() => store.importScript(SCRIPT_A, 'copy.js'), /duplicate/i);
});

test('activates, replaces and removes a source atomically from the public state', () => {
  const { store } = tempStore();
  const item = store.importScript(SCRIPT_A, 'a.js');
  store.setActive(item.id);
  assert.equal(store.getActive().id, item.id);

  const replaced = store.replaceScript(item.id, '/**\n * @name Source A\n * @version 2\n */\nvoid 0', 'source-a-v2.js');
  assert.equal(replaced.version, '2');
  assert.equal(replaced.sourceFileName, 'source-a-v2.js');
  assert.match(store.getScript(item.id), /@version 2/);

  store.remove(item.id);
  assert.equal(store.getActive(), null);
  assert.deepEqual(store.list(), []);
});

test('backs up a malformed index and does not accept traversal ids', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-source-'));
  fs.writeFileSync(path.join(root, 'sources.json'), JSON.stringify({ activeId: '', items: [{ id: '../escape' }] }), 'utf8');
  const store = new CustomSourceStore(root);
  assert.deepEqual(store.list(), []);
  assert.equal(fs.readdirSync(root).some(name => name.startsWith('sources.json.corrupt.')), true);
  assert.throws(() => store.remove('../escape'), /SOURCE_NOT_FOUND/);
});

test('persists isolated status capabilities and update-alert preferences', () => {
  const { store } = tempStore();
  const item = store.importScript(SCRIPT_A, 'a.js');
  const sources = { wy: { actions: ['musicUrl'], qualitys: ['128k'] } };
  store.setStatus(item.id, 'ready', '', sources);
  sources.wy.actions.length = 0;
  assert.deepEqual(store.get(item.id).sources.wy.actions, ['musicUrl']);
  store.setAllowUpdateAlert(item.id, false);
  assert.equal(store.get(item.id).allowUpdateAlert, false);
  assert.throws(() => store.setAllowUpdateAlert('missing', true), /SOURCE_NOT_FOUND/);
});
