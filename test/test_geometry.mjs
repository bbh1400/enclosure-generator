import { writeFileSync } from 'fs';
import Module from 'manifold-3d';
import { makeBuilder } from '../src/geometry.js';
import { meshToBinarySTL } from '../src/stl.js';
import { DRIVE_PRESETS, DEFAULTS } from '../src/presets.js';
import { readFileSync } from 'fs';

const wasm = await Module();
wasm.setup();
const build = makeBuilder(wasm);
const skull = JSON.parse(readFileSync(new URL('../src/assets/intel_skull.json', import.meta.url)));

// merge global defaults + a preset's device values, like the UI does
const cfg = (presetKey, over = {}) => {
  const { preset, ...base } = DEFAULTS;
  return { ...base, ...DRIVE_PRESETS[presetKey].dev, ...over };
};

function run(name, presetKey, over) {
  const p = cfg(presetKey, over);
  const t0 = Date.now();
  const { solid, stats } = build(p);
  const mesh = solid.getMesh();
  console.log(
    `${name.padEnd(22)} size ${stats.size.map(x => x.toFixed(0)).join('x').padEnd(14)}` +
    ` vol ${stats.volCm3.toFixed(1)}cm3  ${stats.grams.toFixed(0)}g  slot ${stats.slotH.toFixed(1)}` +
    `  grip ${stats.engagement.toFixed(1)}  tris ${mesh.triVerts.length / 3}  genus ${solid.genus()}  ${Date.now() - t0}ms`);
  solid.delete();
  return { mesh, stats };
}

const full = run('6x 2.5" (7mm)', '2.5-7', { nDrives: 6 });
writeFileSync(new URL('../test_out_full.stl', import.meta.url), meshToBinarySTL(full.mesh));

const logoed = run('6x 2.5" + skull logo', '2.5-7', { nDrives: 6,
  logo: { polygons: skull.polygons, depth: 1.2, targetH: 70, walls: 'both' } });
writeFileSync(new URL('../test_out_logo.stl', import.meta.url), meshToBinarySTL(logoed.mesh));

run('1x 2.5" tester', '2.5-7', { nDrives: 1 });
run('4x 2.5" custom slot', '2.5-7', { nDrives: 4, driveH: 9.0, gap: 8, slotClr: 0.7 });
run('2x 2.5" print-or', '2.5-7', { nDrives: 2, orientation: 'print' });
run('6x 3.5" HDD', '3.5', { nDrives: 6 });
run('no base/back/top', '2.5-7', { nDrives: 3, baseT: 0, backT: 0, topCap: 0 });

console.log('\nwrote test_out_full.stl');
