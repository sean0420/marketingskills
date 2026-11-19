// Tests the people & company timeline with stubbed Gmail, Google Calendar and Shine AI.
// Usage: node shine/scripts/people-test.js <outDir>   (run from repo root, needs Playwright)
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || require('os').tmpdir();
fs.writeFileSync(path.join(out, 'people.html'), '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('shine/app/shine.html', 'utf8') + '</body></html>');
const items = [
  { id: 'a', type: 'task', title: '더빙 견적 보내기', org: 'Acme', area: 'work', date: '2026-11-20', status: 'open', priority: 'high', people: ['Kim'], createdAt: '2026-11-15T10:00:00Z' },
  { id: 'b', type: 'note', title: 'Acme 킥오프 메모', org: 'Acme', area: 'work', date: '2026-10-02', status: 'open', people: [], createdAt: '2026-10-02T10:00:00Z' },
  { id: 'c', type: 'task', title: '다른 회사 일', org: 'Other', area: 'work', date: '2026-11-21', status: 'open', people: [] },
];
const ev = (id, summary, date, time) => ({ id, summary, status: 'confirmed', start: { dateTime: `${date}T${time}:00-06:00` }, end: { dateTime: `${date}T${time}:00-06:00` }, htmlLink: '#' + id, attendees: [{ email: 'me@ourco.example', self: true, responseStatus: 'accepted' }, { email: 'kim@acme.example', displayName: 'Kim Lee', responseStatus: 'accepted' }] });
(async () => {
  const b = await chromium.launch();
  const run = async (opts, name) => {
    const ctx = await b.newContext({ ...opts, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
    await ctx.addInitScript(([I, E1, E2]) => {
      localStorage.setItem('hub.items', JSON.stringify(I));
      localStorage.setItem('hub.mail', JSON.stringify({ checkedDay: '2026-11-19', checkedAt: '2026-11-19T14:00:00Z', me: 'me@ourco.example', seen: {}, results: [] }));
      window.__q = [];
      const mcp = { callTool: async (srv, tool, input) => { window.__q.push(tool + ':' + (input.query || input.fullText || ''));
        if (tool === 'list_events') return { payload: { events: input.fullText ? [E2] : [E1] } };
        if (/acme\.example/.test(input.query || '')) return { payload: { threads: [{ id: 't9', viewUrl: '#t9', messageCount: 3, messages: [{ id: 'm9', sender: 'kim@acme.example', subject: 'Re: Dubbing scope', snippet: 'Here is the episode list', date: '2026-11-12T10:00:00Z', labelIds: [] }] }] } };
        return { payload: { threads: [] } }; } };
      const sample = Object.assign(async () => ({ text: '' }), { json: async p => /관련된 최근 기록/.test(p) ? { summary: 'Acme와 더빙 견적을 논의 중이에요.', open: ['견적 회신'], next: ['금요일까지 견적 송부'] } : [] });
      window.claude = { use: async n => n === 'mcp' ? mcp : n === 'sample' ? sample : null };
    }, [items, ev('e1', 'Acme weekly', '2026-11-19', '14:00'), ev('e0', 'Acme kickoff call', '2026-09-30', '09:00')]);
    const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-19T15:00:00Z'));
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(out, 'people.html') + '#tasks'); await p.waitForTimeout(1200);
    return { ctx, p, errs };
  };
  const check = (l, ok) => console.log((ok ? 'ok  ' : 'FAIL') + ' ' + l);
  // iPad
  let { ctx, p, errs } = await run({ viewport: { width: 1180, height: 1100 } }, 'ipad');
  await p.click('.row:has-text("더빙 견적 보내기") .ent:has-text("Acme")'); await p.waitForTimeout(800);
  check('org link opens people view', /#people$/.test(p.url()) && /Acme/.test(await p.textContent('.ent-detail h2')));
  check('item dialog did not open', !(await p.$('.dialog')));
  const tl = await p.textContent('.tline');
  check('timeline merges task, note, meetings (current + 1y search), mail', /더빙 견적 보내기/.test(tl) && /킥오프 메모/.test(tl) && /Acme weekly/.test(tl) && /Acme kickoff call/.test(tl) && /Re: Dubbing scope/.test(tl));
  check('other company excluded', !/다른 회사 일/.test(tl));
  check('searched Gmail + Calendar by domain', (await p.evaluate(() => window.__q)).some(q => /from:acme\.example/.test(q)) && (await p.evaluate(() => window.__q)).some(q => q === 'list_events:acme.example'));
  check('newest first', (await p.$$eval('.tent .td', n => n.map(x => x.textContent)))[0] === '11/20');
  await p.click('[data-act="ent-sum"]'); await p.waitForTimeout(400);
  check('Shine relationship summary', /더빙 견적을 논의 중/.test(await p.textContent('.ent-detail')));
  check('list has company + person', /Acme/.test(await p.textContent('#ent-items')) && /Kim/.test(await p.textContent('#ent-items')));
  await p.fill('#ent-q', 'oth'); await p.waitForTimeout(150);
  check('search filters list', /Other/.test(await p.textContent('#ent-items')) && !/Acme/.test(await p.textContent('#ent-items')));
  await p.fill('#ent-q', ''); await p.screenshot({ path: path.join(out, 'people-ipad.png') });
  console.log('errors:', errs); await ctx.close();
  // phone: list -> detail -> back
  ({ ctx, p, errs } = await run(devices['iPhone 13'], 'phone'));
  await p.goto(p.url().replace('#tasks', '#people')); await p.waitForTimeout(800);
  await p.click('.ent-row:has-text("Acme")'); await p.waitForTimeout(600);
  check('phone shows detail only', await p.isVisible('.ent-detail') && !(await p.isVisible('.ent-list')));
  await p.screenshot({ path: path.join(out, 'people-phone.png') });
  await p.click('[data-act="ent-back"]'); await p.waitForTimeout(300);
  check('phone back returns to list', await p.isVisible('.ent-list'));
  console.log('errors:', errs); await ctx.close(); await b.close();
})();
