import { spawn } from 'child_process';
import { chromium } from 'playwright';
import { statSync } from 'fs';

const PORT = 4173;
const srv = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' });

async function waitPort() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('preview server did not start');
}

let code = 1;
try {
  await waitPort();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  // wait until stats populate (means a mesh was generated)
  await page.waitForFunction(() => document.getElementById('stats').textContent.includes('cm³'), { timeout: 40000 });
  const clean = s => s.replace(/\s+/g, ' ').trim();
  console.log('STATS:', clean(await page.textContent('#stats')));

  // customise a bay variable: bump drive thickness, expect slot to grow
  const before = await page.textContent('#stats');
  await page.fill('#driveH', '9.5');
  await page.dispatchEvent('#driveH', 'input');
  await page.waitForFunction(t => document.getElementById('stats').textContent !== t, before, { timeout: 20000 });
  console.log('driveH=9.5 STATS:', clean(await page.textContent('#stats')));
  console.log('slotNote:', clean(await page.textContent('#slotNote')));

  // switch to 3.5" preset -> device defaults reset (thickness back to preset)
  const s2 = await page.textContent('#stats');
  await page.selectOption('#preset', '3.5');
  await page.waitForFunction(t => document.getElementById('stats').textContent !== t, s2, { timeout: 20000 });
  console.log('3.5" STATS:', clean(await page.textContent('#stats')));
  console.log('3.5" driveH input =', await page.inputValue('#driveH'));

  // back to 2.5 + export
  await page.selectOption('#preset', '2.5-7');
  await page.waitForTimeout(500);
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.click('#btnExport'),
  ]);
  const path = await dl.path();
  console.log('DOWNLOAD:', dl.suggestedFilename(), statSync(path).size, 'bytes');

  await page.screenshot({ path: 'test/app_screenshot.png' });
  console.log('CONSOLE ERRORS:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  code = errors.length ? 2 : 0;
} catch (e) {
  console.error('VERIFY FAILED:', e.message);
} finally {
  srv.kill();
  process.exit(code);
}
