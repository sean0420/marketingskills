// Tests meeting reminders (60 / 30 / 5 minutes before) shown as top alerts with a single 확인 button.
// Usage: node shine/scripts/reminder-test.js <outDir>   (run from repo root, needs Playwright)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || require('os').tmpdir();
fs.writeFileSync(path.join(out, 'reminder.html'), '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('shine/app/shine.html', 'utf8') + '</body></html>');
const items = [{ id: 'm1', type: 'event', title: 'Client weekly sync', area: 'work', date: '2026-11-19', time: '10:00', endTime: '10:30', status: 'open', people: [] }];
(async () => {
  const b = await chromium.launch();
  const check = (l, ok) => console.log((ok ? 'ok  ' : 'FAIL') + ' ' + l);
  const open = async (iso, keepStorage) => {
    const ctx = await b.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
    await ctx.addInitScript(([I, K]) => { localStorage.setItem('hub.items', JSON.stringify(I)); if (K) localStorage.setItem('hub.alerted', K); window.claude = { use: async () => null }; }, [items, keepStorage || '']);
    const p = await ctx.newPage(); await p.clock.install({ time: new Date(iso) });
    await p.goto('file://' + path.join(out, 'reminder.html') + '#today'); await p.waitForTimeout(500);
    return { ctx, p };
  };
  // 9:00 -> 60 min reminder
  let { ctx, p } = await open('2026-11-19T15:00:00Z');
  let t = await p.textContent('.alert').catch(() => '');
  check('60 min before: reminder shown', /미팅 리마인더/.test(t) && /60분 후 시작/.test(t) && /Client weekly sync/.test(t));
  check('reminder has only a 확인 button', (await p.$$('.alert .al-acts .btn')).length === 1 && /확인/.test(await p.textContent('.alert .al-acts')));
  await p.screenshot({ path: path.join(out, 'reminder-60.png') });
  await p.click('[data-act="al-ok"]'); await p.waitForTimeout(200);
  check('확인 closes it', !(await p.$('.alert')));
  // move clock to 9:31 -> 30 min reminder fires on the next tick
  await p.clock.fastForward('31:00'); await p.waitForTimeout(300);
  t = await p.textContent('.alert').catch(() => '');
  check('30 min before: reminder shown', /30분 후 시작/.test(t));
  await p.click('[data-act="al-ok"]');
  await p.clock.fastForward('25:00'); await p.waitForTimeout(300);
  t = await p.textContent('.alert').catch(() => '');
  check('5 min before: reminder shown', /5분 전/.test(t));
  await p.click('[data-act="al-ok"]');
  await p.clock.fastForward('06:00'); await p.waitForTimeout(300);
  check('no reminder after the meeting starts', !(await p.$('.alert')));
  const seen = await p.evaluate(() => localStorage.getItem('hub.alerted'));
  await ctx.close();
  // opening the app 20 min before shows only the 30-min reminder (not the 60)
  ({ ctx, p } = await open('2026-11-19T15:40:00Z'));
  t = await p.textContent('.alert').catch(() => '');
  check('opened 20 min before: only the latest (30 min) reminder', /30분 후 시작/.test(t) && !(await p.textContent('.al-top')).includes('+'));
  await ctx.close();
  // already acknowledged reminders do not come back after reload
  ({ ctx, p } = await open('2026-11-19T15:57:00Z', seen));
  check('acknowledged reminders stay closed after reload', !(await p.$('.alert')));
  await ctx.close(); await b.close();
})();
