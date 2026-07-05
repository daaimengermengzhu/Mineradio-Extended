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
  ['shape curve primitive definition', uiSource, "curve: { name: '曲线环'"],
  ['shape curve primitive order', uiSource, "'curve'"],
  ['shape curve primitive render formula', uiSource, "primitive.type === 'curve'"],
  ['shape param slider uses count max', uiSource, 'var countMax = shapePrimitiveCountMax(primitive)'],
  ['shape recipe stability config', uiSource, 'driftLock: stability.driftLock === true'],
  ['shape recipe drift lock checker', uiSource, 'function shapeRecipeDriftLockEnabled'],
  ['custom shape layer drift lock', uiSource, 'layerDriftLock'],
  ['shape workshop drift lock toggle', uiSource, 'function shapeWorkshopToggleDriftLock'],
  ['shape workshop stabilize recipe action', uiSource, 'function shapeWorkshopStabilizeRecipe'],
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
  ['old generated builtin registry', 'builtinShapePresetKeys'],
  ['old generated builtin edit copy button', '编辑副本'],
  ['old generated builtin copy class', 'builtin-shape-copy'],
  ['old generated builtin data key', 'data-builtin-shape-key'],
  ['personal generated shape name', '\u661f\u6cb3' + '\u83ab\u6bd4' + '\u4e4c\u65af'],
  ['personal generated shape recipe function', 'mo' + 'biusGalaxyUserShapeRecipe'],
  ['personal generated shape seed key', 'MO' + 'BIUS_GALAXY_USER_PRESET_SEED_KEY'],
  ['personal generated shape seed action', 'seedMo' + 'biusGalaxyUserShapePreset'],
  ['personal generated shape cover id', 'mo' + 'bius-cover-nebula'],
  ['personal generated shape ring id', 'mo' + 'bius-infinity-ring'],
  ['personal generated shape lyric layout', 'mo' + 'biusGalaxyLyrics'],
  ['personal ring primitive key', 'mo' + 'bius: { name:'],
  ['personal ring primitive order entry', "'mo" + "bius'"],
  ['personal ring primitive render formula', "primitive.type === 'mo" + "bius'"],
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
