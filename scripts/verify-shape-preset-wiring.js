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
  ['mobius primitive definition', uiSource, 'mobius: { name:'],
  ['mobius primitive render formula', uiSource, "primitive.type === 'mobius'"],
  ['mobius galaxy user preset recipe', uiSource, 'function mobiusGalaxyUserShapeRecipe'],
  ['mobius galaxy user preset seed key', uiSource, 'MOBIUS_GALAXY_USER_PRESET_SEED_KEY'],
  ['mobius galaxy user preset version key', uiSource, 'MOBIUS_GALAXY_USER_PRESET_VERSION_KEY'],
  ['mobius galaxy saved preset refresh check', uiSource, 'function mobiusGalaxyPresetNeedsRefresh'],
  ['mobius galaxy user preset seed action', uiSource, 'function seedMobiusGalaxyUserShapePreset'],
  ['mobius galaxy recipe ring layer', uiSource, 'mobius-infinity-ring'],
  ['mobius galaxy larger cover disc size', uiSource, "id: 'mobius-cover-nebula', type: 'plane', x: 0, y: 0.02, z: -0.14, count: 2200, size: 0.80"],
  ['mobius galaxy larger cover primitive count max', uiSource, "raw && raw.id === 'mobius-cover-nebula' ? 2600 : 1200"],
  ['mobius galaxy param slider uses count max', uiSource, 'var countMax = shapePrimitiveCountMax(primitive)'],
  ['mobius galaxy cover detail layer', uiSource, 'detailCover'],
  ['mobius galaxy detail cover particle cap', uiSource, 'detailCover ? 2600 : 1400'],
  ['mobius galaxy circular cover disc', uiSource, 'discRadius'],
  ['mobius galaxy active checker', uiSource, 'function isMobiusGalaxyShapeActive'],
  ['mobius galaxy recipe checker', uiSource, 'function isMobiusGalaxyRecipe'],
  ['shape recipe stability config', uiSource, 'stability: { driftLock: true }'],
  ['shape recipe drift lock checker', uiSource, 'function shapeRecipeDriftLockEnabled'],
  ['custom shape layer drift lock', uiSource, 'layerDriftLock'],
  ['shape workshop drift lock toggle', uiSource, 'function shapeWorkshopToggleDriftLock'],
  ['shape workshop stabilize recipe action', uiSource, 'function shapeWorkshopStabilizeRecipe'],
  ['mobius galaxy skips square cover plane', uiSource, "primitive.id === 'mobius-cover-nebula') return"],
  ['mobius galaxy lyric alignment', uiSource, 'mobiusGalaxyLyrics'],
  ['shape material fx state', uiSource, 'shapeMaterialMedia: null'],
  ['shape material image-only normalizer', uiSource, 'function normalizeShapeMaterialMedia'],
  ['shape material input', uiSource, 'shape-material-input'],
  ['shape material upload reader', uiSource, 'function readShapeMaterialImageFile'],
  ['shape material canvas loader', uiSource, 'function loadShapeMaterialCanvas'],
  ['shape material sampler priority', uiSource, 'ensureShapeMaterialCanvas() || coverPickerCanvas'],
  ['shape material upload decoupled from background media', uiSource, "document.getElementById('shape-material-input')"],
  ['shape material archive export source', uiSource, 'uploaded-shape-material'],
  ['active shape edit action', uiSource, 'function openShapeWorkshopFromActiveShape'],
  ['shape render key', uiSource, 'function shapeRecipeRenderKey'],
  ['custom shape 3D object builder', uiSource, 'function buildCustomShapePrimitiveObject'],
  ['custom shape cover particle builder', uiSource, 'function buildCustomShapeCoverParticlePoints'],
  ['custom shape cover texture primitive', uiSource, 'function buildCustomShapePrimitiveCoverObject'],
  ['custom shape cover texture plate', uiSource, 'function buildCustomShapeCoverPlate'],
  ['custom shape cover particles marker', uiSource, 'coverParticles'],
  ['custom shape cover particles use vertex colors', uiSource, 'vertexColors: true'],
  ['custom shape pointer uses active custom group', uiSource, 'isCustomShapeRenderActive() && customShapeGroup'],
  ['custom shape rotation uses gesture target', uiSource, 'gestureRotation.y) + customShapeGroup.userData.autoSpinY'],
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
  ['shape preset grid delete button', uiSource, 'user-shape-card-delete'],
  ['shape preset grid user cards before author presets', uiSource, 'renderPresetGridUserShapeCards() +\n    builtinCards'],
  ['shape preset file extension', uiSource, '.mineradio-shape.json'],
  ['custom shape uses Three Points', uiSource, 'new THREE.Points'],
  ['custom shape render loop call', uiSource, 'updateCustomShapeLayer(dt)'],
  ['shape workshop keeps canvas visible', uiSource, 'body.shape-workshop-mode #canvas-container{opacity:1'],
  ['shape workshop hides preset grid while editing', uiSource, 'body.shape-workshop-mode #preset-grid'],
  ['shape workshop hides sandbox builder while editing', uiSource, 'body.shape-workshop-mode #sandbox-builder-grid'],
  ['shape workshop hides user archives while editing', uiSource, 'body.shape-workshop-mode #user-archive-grid'],
  ['shape workshop label class', uiSource, 'shape-workshop-label'],
  ['creative sandbox label softened', uiSource, '作品组合'],
  ['shape workshop closes when leaving presets tab', uiSource, "nextTab !== 'presets' && typeof shapeWorkshopState"],
  ['shape workshop 3D stage status', uiSource, 'shape-stage-status'],
  ['shape workshop disables 2D stage items', uiSource, "var items = '';"],
  ['shape workshop 3D summary card', uiSource, 'shape-workshop-preview shape-workshop-preview-summary'],
  ['shape workshop expanded editor panel', uiSource, 'body.shape-workshop-mode #fx-panel{right:24px;top:92px'],
  ['shape workshop non-sticky parameter section', uiSource, '.shape-workshop-params-section{position:relative'],
  ['shape workshop smooth slider input', uiSource, 'shapeWorkshopUpdatePrimitive(\\\''],
  ['shape workshop slider edit finish', uiSource, 'shapeWorkshopFinishParamEdit()'],
  ['shape workshop selected layer refresh', uiSource, 'syncCustomShapeLayer(true);\n  renderShapeWorkshop();\n}'],
  ['shape workshop selected layer point boost', uiSource, 'selected ? 0.014 : 0'],
  ['shape workshop undo stack', uiSource, 'function shapeWorkshopPushUndo'],
  ['shape workshop undo action', uiSource, 'function shapeWorkshopUndo'],
  ['shape workshop redo action', uiSource, 'function shapeWorkshopRedo'],
  ['shape workshop static motion default', uiSource, 'motionPreview: false'],
  ['shape workshop motion control', uiSource, 'function renderShapeMotionControl'],
  ['shape workshop motion toggle action', uiSource, 'function shapeWorkshopSetMotionPreview'],
  ['shape workshop demo beat', uiSource, 'function shapeWorkshopDemoAudioEnergy'],
  ['shape workshop live audio detection', uiSource, 'function shapeWorkshopHasLiveAudio'],
  ['shape workshop static render guard', uiSource, 'workshopStatic'],
  ['shape workshop static edit label', uiSource, '静态编辑'],
  ['shape workshop motion preview label', uiSource, '律动预览'],
  ['shape workshop clearer depth label', uiSource, '前后厚度'],
  ['shape workshop clearer audio follow label', uiSource, '随音乐动'],
  ['shape workshop edit gizmo html', uiSource, 'function shapeStageGizmoHtml'],
  ['shape workshop move gizmo class', uiSource, 'shape-stage-gizmo-move'],
  ['shape workshop rotate gizmo class', uiSource, 'shape-stage-gizmo-rotate'],
  ['shape workshop rotate drag action', uiSource, 'function beginShapeStageRotate'],
  ['shape workshop primitive patch helper', uiSource, 'function shapeWorkshopPatchPrimitive'],
  ['shape workshop rotation setter', uiSource, 'function shapeWorkshopSetPrimitiveRotation'],
  ['shape workshop preview visibility state', uiSource, 'hiddenIds: {}'],
  ['shape workshop preview recipe filter', uiSource, 'function shapeWorkshopPreviewRecipeForRender'],
  ['shape workshop visibility controls', uiSource, 'function renderShapeVisibilityControl'],
  ['shape workshop show all layers action', uiSource, 'function shapeWorkshopShowAllLayers'],
  ['shape workshop solo layer action', uiSource, 'function shapeWorkshopSoloPrimitive'],
  ['shape workshop hide layer action', uiSource, 'function shapeWorkshopTogglePrimitiveHidden'],
  ['shape workshop visibility button class', uiSource, 'shape-layer-visibility'],
];

const missing = checks
  .filter(([, source, marker]) => !source.includes(marker))
  .map(([label, , marker]) => `${label}: missing "${marker}"`);

const forbidden = [
  ['mobius galaxy old builtin registry', 'builtinShapePresetKeys'],
  ['mobius galaxy old builtin edit copy button', '编辑副本'],
  ['mobius galaxy old builtin copy class', 'builtin-shape-copy'],
  ['mobius galaxy old builtin data key', 'data-builtin-shape-key'],
];

const presentForbidden = forbidden
  .filter(([, marker]) => uiSource.includes(marker))
  .map(([label, marker]) => `${label}: should not contain "${marker}"`);

if (missing.length || presentForbidden.length) {
  console.error('Shape preset wiring is incomplete:');
  missing.forEach(item => console.error(`- ${item}`));
  presentForbidden.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Shape preset wiring markers are present. Inline scripts compiled: ${inlineScripts.length}.`);
