const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const uiSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

const inlineScripts = [...uiSource.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]);

inlineScripts.forEach((code, index) => {
  new vm.Script(code, { filename: `inline-script-${index}.js` });
});

const checks = [
  ['shape preset store key', uiSource, 'USER_SHAPE_PRESET_STORE_KEY'],
  ['active shape preset store key', uiSource, 'ACTIVE_SHAPE_PRESET_STORE_KEY'],
  ['shape recipe normalizer', uiSource, 'function normalizeShapeRecipe'],
  ['shape primitive normalizer', uiSource, 'function normalizeShapePrimitive'],
  ['shape render key', uiSource, 'function shapeRecipeRenderKey'],
  ['custom shape 3D object builder', uiSource, 'function buildCustomShapePrimitiveObject'],
  ['custom shape layer sync', uiSource, 'function syncCustomShapeLayer'],
  ['custom shape animation update', uiSource, 'function updateCustomShapeLayer'],
  ['custom shape apply to player', uiSource, 'function applyShapeRecipeToPlayer'],
  ['custom shape active restore', uiSource, 'function readActiveUserShapeRecipe'],
  ['shape preset management list', uiSource, 'function renderShapeSavedPresets'],
  ['shape preset update save', uiSource, 'saveCurrentShapePreset(false,false)'],
  ['shape preset save as new', uiSource, 'saveCurrentShapePreset(false,true)'],
  ['shape preset duplicate', uiSource, 'function duplicateUserShapePreset'],
  ['shape preset delete', uiSource, 'function deleteUserShapePreset'],
  ['shape preset export payload', uiSource, 'function shapePresetExportPayload'],
  ['shape preset export action', uiSource, 'function exportUserShapePreset'],
  ['shape preset import payload', uiSource, 'function normalizeImportedShapePresetPayload'],
  ['shape preset import action', uiSource, 'function importUserShapePresetText'],
  ['shape preset import picker', uiSource, 'function importUserShapePresetFromDialog'],
  ['shape preset file reader', uiSource, 'function readUserShapePresetImportFile'],
  ['shape preset grid cards', uiSource, 'function renderPresetGridUserShapeCards'],
  ['shape preset grid apply', uiSource, 'function applyUserShapePresetFromGrid'],
  ['shape preset grid card class', uiSource, 'user-shape-preset'],
  ['shape preset grid user cards before builtins', uiSource, 'renderPresetGridUserShapeCards() +\n    builtinCards'],
  ['shape preset file extension', uiSource, '.mineradio-shape.json'],
  ['custom shape uses Three Points', uiSource, 'new THREE.Points'],
  ['custom shape render loop call', uiSource, 'updateCustomShapeLayer(dt)'],
  ['shape workshop keeps canvas visible', uiSource, 'body.shape-workshop-mode #canvas-container{opacity:1'],
];

const missing = checks
  .filter(([, source, marker]) => !source.includes(marker))
  .map(([label, , marker]) => `${label}: missing "${marker}"`);

if (missing.length) {
  console.error('Shape preset wiring is incomplete:');
  missing.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Shape preset wiring markers are present. Inline scripts compiled: ${inlineScripts.length}.`);
