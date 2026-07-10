if (!process.versions.electron) process.exit(0);

const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { LxSourceRuntime } = require('../../desktop/custom-source/runtime');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-lx-smoke-')));
app.disableHardwareAcceleration();

async function run() {
  await app.whenReady();
  const sentinel = new BrowserWindow({ show: false });
  const script = fs.readFileSync(path.join(__dirname, 'fixtures/basic-source.js'), 'utf8');
  const runtime = new LxSourceRuntime({
    script,
    currentScriptInfo: { name: 'Mineradio Test Source' },
    electron: { app, BrowserWindow, ipcMain },
  });
  try {
    const initialized = await runtime.start();
    assert.deepEqual(initialized.sources.wy.qualitys, ['128k', '320k', 'flac']);
    assert.deepEqual(initialized.sources.kg.qualitys, ['128k', 'flac']);
    const url = await runtime.request({
      source: 'kg',
      action: 'musicUrl',
      info: { type: 'flac', musicInfo: { hash: 'abc123', meta: { songId: 'track' } } },
    });
    assert.equal(url, 'https://audio.example.com/kg/abc123/flac.mp3');
  } finally {
    runtime.stop();
    sentinel.destroy();
  }
}

run().then(() => app.quit()).catch(error => {
  console.error(error);
  app.exit(1);
});
