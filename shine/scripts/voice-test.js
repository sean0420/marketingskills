// Tests the bottom-left voice button: dictation path (stubbed) and the iPad/iPhone keyboard fallback.
// Usage: node shine/scripts/voice-test.js <outDir>   (run from repo root, needs Playwright)
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || require('os').tmpdir();
fs.writeFileSync(path.join(out, 'voice.html'), '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('shine/app/shine.html', 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch();
  const check = (l, ok) => console.log((ok ? 'ok  ' : 'FAIL') + ' ' + l);
  // 1) with dictation (desktop Chrome / Claude desktop app)
  let ctx = await b.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  await ctx.addInitScript(() => {
    localStorage.setItem('hub.items', '[]');
    const H = { final: [], partial: [], state: [] }; let active = false;
    const emit = (k, v) => H[k].forEach(f => f(v));
    const dictation = { onFinal: f => (H.final.push(f), () => {}), onPartial: f => (H.partial.push(f), () => {}), onState: f => (H.state.push(f), () => {}),
      active: () => active,
      start: async () => { active = true; window.__started = (window.__started || 0) + 1; emit('state', { state: 'listening' }); },
      stop: async () => { active = false; emit('state', { state: 'idle', reason: 'stopped' }); } };
    window.__say = (partial, final) => { if (partial) emit('partial', { text: partial }); if (final) emit('final', { text: final }); };
    window.claude = { use: async n => n === 'dictation' ? dictation : null };
  });
  let p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-19T15:00:00Z'));
  let errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out, 'voice.html') + '#today'); await p.waitForTimeout(800);
  const box = await p.locator('#voice-fab').boundingBox();
  check('button sits bottom-left', box.x < 60 && box.y > 900 - 120);
  await p.click('#voice-fab'); await p.waitForTimeout(150);
  check('mic starts and panel shows', (await p.evaluate(() => window.__started)) === 1 && await p.isVisible('#voice-panel'));
  await p.evaluate(() => window.__say('다음주 수요일', null)); await p.waitForTimeout(50);
  check('live partial text shown', /다음주 수요일/.test(await p.textContent('#voice-text')));
  await p.evaluate(() => window.__say('', '다음주 수요일 오후 3시 Netflix 미팅')); await p.waitForTimeout(50);
  await p.screenshot({ path: path.join(out, 'voice-listening.png') });
  await p.click('#voice-done'); await p.waitForTimeout(500);
  check('text moved into Shine input', (await p.inputValue('#quick')) === '다음주 수요일 오후 3시 Netflix 미팅');
  check('Shine interpreted it (preview card)', /Netflix/.test(await p.inputValue('#pv-title-0').catch(() => '')) && (await p.inputValue('#pv-date-0')) === '2026-11-25' && !(await p.isVisible('#voice-panel')));
  await p.click('#voice-fab'); await p.evaluate(() => window.__say('', '취소할 말')); await p.click('#voice-cancel'); await p.waitForTimeout(200);
  check('cancel does not overwrite input', (await p.inputValue('#quick')) === '다음주 수요일 오후 3시 Netflix 미팅');
  console.log('errors:', errs); await ctx.close();
  // 2) iPad / iPhone: no dictation -> keyboard fallback
  ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  await ctx.addInitScript(() => { localStorage.setItem('hub.items', '[]'); window.claude = { use: async () => null }; });
  p = await ctx.newPage(); errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out, 'voice.html') + '#today'); await p.waitForTimeout(800);
  await p.click('#voice-fab'); await p.waitForTimeout(200);
  check('fallback focuses input + shows keyboard-mic hint', (await p.evaluate(() => document.activeElement.id)) === 'quick' && /키보드의 🎤/.test(await p.textContent('#status')));
  const fb = await p.locator('#voice-fab').boundingBox(), tb = await p.locator('#tabs').boundingBox();
  check('phone: button does not overlap tab bar', fb.y + fb.height <= tb.y + 1);
  await p.screenshot({ path: path.join(out, 'voice-phone.png') });
  console.log('errors:', errs); await ctx.close(); await b.close();
})();
