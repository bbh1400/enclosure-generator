import Module from 'manifold-3d';
import { makeBuilder } from './geometry.js';
import { meshToBinarySTL } from './stl.js';
import { createViewer } from './viewer.js';
import { builtinSkull, traceImage } from './logo.js';
import { DRIVE_PRESETS, DEFAULTS, DEVICE_FIELDS } from './presets.js';

const $ = (id) => document.getElementById(id);
const CONTROLS = ['preset', 'driveW', 'driveL', 'driveH', 'nDrives', 'gap',
  'slotClr', 'sideClr', 'wallT', 'railDepth', 'railT', 'baseT', 'backT', 'topCap',
  'bumps', 'bumpH', 'bumpHalf', 'bumpYc',
  'logoMode', 'logoThreshold', 'logoScale', 'logoDepth', 'logoWalls',
  'baseVent', 'backWindow'];
const RANGE_OUT = {
  nDrives: '', gap: ' mm', slotClr: ' mm', sideClr: ' mm', bumpH: ' mm',
  logoScale: ' mm', logoDepth: ' mm', logoThreshold: '',
};

let build = null, viewer = null, currentMesh = null, tracedLogo = null;
const state = { ...DEFAULTS };

for (const [k, v] of Object.entries(DRIVE_PRESETS)) {
  const o = document.createElement('option');
  o.value = k; o.textContent = v.label;
  $('preset').appendChild(o);
}

// ---- state <-> URL ----
const encodeState = () => {
  const s = {}; for (const k of CONTROLS) s[k] = state[k];
  return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
};
const decodeState = () => {
  if (!location.hash.length) return;
  try { Object.assign(state, JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))))); }
  catch { /* ignore */ }
};

// ---- inputs <-> state ----
function applyStateToInputs() {
  for (const k of CONTROLS) {
    const el = $(k); if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!state[k];
    else el.value = state[k];
  }
  updateOutputs();
  updateLogoVisibility();
}
function updateLogoVisibility() {
  $('customLogo').hidden = state.logoMode !== 'custom';
  $('logoOpts').hidden = state.logoMode === 'none';
}
function updateOutputs() {
  for (const [k, unit] of Object.entries(RANGE_OUT)) {
    const o = $(k + 'Out'); if (o) o.textContent = state[k] + unit;
  }
  $('slotNote').textContent =
    `Slot height ≈ ${(+state.driveH + +state.slotClr).toFixed(2)} mm · ` +
    `width cavity ≈ ${(+state.driveW + 2 * +state.sideClr).toFixed(2)} mm`;
}
function readInputs() {
  for (const k of CONTROLS) {
    const el = $(k); if (!el) continue;
    if (el.type === 'checkbox') state[k] = el.checked;
    else if (el.type === 'range' || el.type === 'number') {
      const v = parseFloat(el.value);
      if (Number.isFinite(v)) state[k] = v;
    } else state[k] = el.value;
  }
}

// picking a drive type resets device-specific fields to that type's starting
// point (keeping the drive count), then leaves everything editable.
function applyPreset(key) {
  const dev = DRIVE_PRESETS[key].dev;
  for (const f of DEVICE_FIELDS) state[f] = (f in dev) ? dev[f] : DEFAULTS[f];
  state.preset = key;
  applyStateToInputs();
}

function currentLogo() {
  if (state.logoMode === 'skull') return builtinSkull();
  if (state.logoMode === 'custom' && tracedLogo) return tracedLogo;
  return null;
}

function paramsFromState() {
  const logo = currentLogo();
  return {
    driveW: +state.driveW, driveL: +state.driveL, driveH: +state.driveH,
    nDrives: Math.max(1, Math.round(state.nDrives)), gap: +state.gap,
    slotClr: +state.slotClr, sideClr: +state.sideClr,
    wallT: +state.wallT, railDepth: +state.railDepth, railT: +state.railT,
    baseT: +state.baseT, backT: +state.backT, topCap: +state.topCap,
    bumps: !!state.bumps, bumpH: +state.bumpH, bumpHalf: +state.bumpHalf, bumpYc: +state.bumpYc,
    logo: logo ? { polygons: logo.polygons, depth: +state.logoDepth, targetH: +state.logoScale, walls: state.logoWalls } : null,
    baseVent: !!state.baseVent, backWindow: !!state.backWindow,
    orientation: 'print',   // always export print-ready (no supports)
  };
}

// ---- status ----
let statusTimer = null;
function status(msg, isErr = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('err', isErr);
  el.classList.toggle('show', !!msg);
  clearTimeout(statusTimer);
  if (msg && !isErr) statusTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ---- regenerate ----
let pending = null;
const scheduleRegen = () => { clearTimeout(pending); pending = setTimeout(regenerate, 100); };
function regenerate() {
  if (!build) return;
  try {
    const t0 = performance.now();
    const { solid, stats } = build(paramsFromState());
    currentMesh = solid.getMesh();
    solid.delete();
    viewer.setGeometry(currentMesh);
    renderStats(stats, performance.now() - t0);
    if ($('status').classList.contains('err')) status('');
  } catch (e) {
    console.error(e);
    status('Error: ' + e.message, true);
  }
}
function renderStats(s, ms) {
  const [x, y, z] = s.size.map(v => v.toFixed(0));
  $('stats').innerHTML =
    `<span><b>${x} × ${y} × ${z}</b> mm</span>` +
    `<span><b>${s.volCm3.toFixed(1)}</b> cm³</span>` +
    `<span>~<b>${s.grams.toFixed(0)}</b> g PLA</span>` +
    `<span>~<b>${s.filamentM.toFixed(1)}</b> m</span>` +
    `<span>slot <b>${s.slotH.toFixed(1)}</b> mm · edge grip <b>${s.engagement.toFixed(1)}</b> mm</span>` +
    (s.logo ? `<span>logo <b>${s.logo.width.toFixed(0)}×${s.logo.height.toFixed(0)}</b> mm</span>` : '') +
    `<span style="margin-left:auto;opacity:.6">${ms.toFixed(0)} ms</span>`;
}

async function retrace() {
  const f = $('logoFile').files[0];
  if (!f) return;
  status('Tracing image…');
  try {
    tracedLogo = await traceImage(f, +state.logoThreshold);
    status('Traced ✓');
    regenerate();
  } catch (e) {
    tracedLogo = null;
    status(e.message, true);
  }
}

// ---- events ----
function onInput(e) {
  if (e.target.id === 'preset') { applyPreset(e.target.value); }
  else { readInputs(); updateOutputs(); }
  if (e.target.id === 'logoMode') updateLogoVisibility();
  if (e.target.id === 'logoThreshold' && state.logoMode === 'custom') { retrace(); return; }
  location.replace('#' + encodeState());
  scheduleRegen();
}

async function boot() {
  viewer = createViewer($('view'));
  decodeState();
  applyStateToInputs();

  status('Loading CAD engine…');
  const wasm = await Module();
  wasm.setup();
  build = makeBuilder(wasm);
  status('');

  for (const k of CONTROLS) $(k)?.addEventListener('input', onInput);
  $('logoFile').addEventListener('change', retrace);
  $('btnExport').addEventListener('click', exportSTL);
  $('btnShare').addEventListener('click', share);
  regenerate();
}

function exportSTL() {
  if (!currentMesh) return;
  const bytes = meshToBinarySTL(currentMesh);
  const name = `ssd_cage_${state.nDrives}x_${state.preset.replace('.', '')}.stl`;
  const blob = new Blob([bytes], { type: 'model/stl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  status('Saved ' + name);
}
async function share() {
  location.replace('#' + encodeState());
  try { await navigator.clipboard.writeText(location.href); status('Link copied ✓'); }
  catch { status('Copy the URL from the address bar'); }
}

boot();
