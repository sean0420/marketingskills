// Tests Google Calendar read sync with a stubbed connector (same response shape as list_events).
// Usage: node shine/scripts/gcal-test.js <outDir>   (run from repo root, needs Playwright)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || require('os').tmpdir();
fs.writeFileSync(path.join(out, 'gcal.html'), '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('shine/app/shine.html', 'utf8') + '</body></html>');
const ev = (id, summary, s, e, extra = {}) => ({ id, summary, status: 'confirmed', start: s, end: e, htmlLink: 'https://www.google.com/calendar/event?eid=' + id, attendees: [{ email: 'me@example.com', self: true, responseStatus: 'accepted' }, { email: 'client@example.com', responseStatus: 'accepted' }], ...extra });
const events = [
  ev('e1', 'Client weekly sync', { dateTime: '2026-11-18T10:00:00-06:00', timeZone: 'America/Chicago' }, { dateTime: '2026-11-18T10:30:00-06:00' }, { conferenceUrl: 'https://meet.google.com/abc-defg-hij', description: 'Agenda in notes' }),
  ev('e2', 'Partner call (Seoul)', { dateTime: '2026-11-18T19:00:00-06:00', timeZone: 'Asia/Seoul' }, { dateTime: '2026-11-18T20:00:00-06:00' }),
  ev('e3', 'Declined meeting', { dateTime: '2026-11-18T13:00:00-06:00' }, { dateTime: '2026-11-18T14:00:00-06:00' }, { attendees: [{ email: 'me@example.com', self: true, responseStatus: 'declined' }] }),
  ev('e4', 'Conference day', { date: '2026-11-19' }, { date: '2026-11-21' }),
  ev('e5', 'Shine-made meeting', { dateTime: '2026-11-18T15:00:00-06:00' }, { dateTime: '2026-11-18T16:00:00-06:00' }),
];
const items = [{ id: 's1', type: 'event', title: 'Shine-made meeting', area: 'work', date: '2026-11-18', time: '15:00', endTime: '16:00', status: 'open', people: [] }];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 1100 }, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  await ctx.addInitScript(([E, I]) => {
    localStorage.setItem('hub.items', JSON.stringify(I));
    localStorage.setItem('hub.mail', JSON.stringify({ checkedDay: '2026-11-18', checkedAt: '2026-11-18T14:00:00Z', results: [], seen: {} }));
    window.__calls = [];
    const mcp = { callTool: async (srv, tool, input) => { window.__calls.push(srv + ':' + tool + ':' + (input && input.query || '')); return srv === 'Google Calendar' ? { payload: { events: E } } : { payload: { threads: /from:example.com/.test(input.query || '') ? [{ id: 'x1', viewUrl: '#x1', messageCount: 2, messages: [{ id: 'm1', sender: 'client@example.com', subject: 'Re: 2027 rates', snippet: 'Looking forward to the new rate card', date: '2026-11-15T10:00:00Z', labelIds: ['INBOX'] }] }] : [] } }; } };
    window.__briefCalls = 0;
    const sample = Object.assign(async () => ({ text: '' }), { json: async (prompt) => { if (/준비 브리핑/.test(prompt)) { window.__briefCalls++; return { summary: '분기 계약 갱신을 앞둔 정기 미팅이에요.', points: ['2027 단가표 공유', 'QC 일정 확인'], open: ['견적서 회신'] }; } return []; } });
    window.claude = { use: async n => n === 'mcp' ? mcp : n === 'sample' ? sample : null };
  }, [events, items]);
  const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-18T15:20:00Z')); // 9:20 Dallas
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out, 'gcal.html') + '#today'); await p.waitForTimeout(1500);
  const check = (l, ok) => console.log((ok ? 'ok  ' : 'FAIL') + ' ' + l);
  const blocks = await p.$$eval('.flow .ev', n => n.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  check('called Google Calendar list_events', (await p.evaluate(() => window.__calls)).some(c => c.startsWith('Google Calendar:list_events')));
  check('prep card shows next meeting within 2h', /Client weekly sync/.test(await p.textContent('.prep')) && /40분 후 시작/.test(await p.textContent('#prep-cd')));
  check('no auto brief 40 min before', (await p.evaluate(() => window.__briefCalls)) === 0);
  await p.click('[data-act="prep-brief"]'); await p.waitForTimeout(500);
  const prep = await p.textContent('.prep');
  check('brief built with points + related mail search', /2027 단가표 공유/.test(prep) && /Re: 2027 rates/.test(prep) && (await p.evaluate(() => window.__calls)).some(c => /from:example.com/.test(c)));
  await p.screenshot({ path: path.join(out, 'prep-card.png') });
  check('Google events on today timeline', blocks.some(t => /Client weekly sync/.test(t)) && blocks.some(t => /Partner call/.test(t)));
  check('declined event hidden', !blocks.some(t => /Declined/.test(t)));
  check('no duplicate of Shine-made meeting', blocks.filter(t => /Shine-made/.test(t)).length === 1);
  check('greeting counts down to next Google event', /Client weekly sync/.test(await p.textContent('#greet-s')));
  check('next-event stat shows 10:00', /10:00/.test(await p.textContent('.stat.next')));
  await p.click('.flow .ev:has-text("Client weekly sync")'); await p.waitForTimeout(300);
  const dlg = await p.textContent('.dialog');
  check('read-only Google dialog with Meet + attendees', /Meet 참여/.test(dlg) && /client@example.com/.test(dlg) && /Google 캘린더에서 열기/.test(dlg));
  await p.screenshot({ path: path.join(out, 'gcal-dialog.png') });
  await p.click('[data-act="gc-prep"]'); await p.waitForTimeout(300);
  check('prep task created', await p.evaluate(() => JSON.parse(localStorage.getItem('hub.items')).some(i => i.title === 'Client weekly sync 준비')));
  await p.click('[data-act="flow-mode"][data-v="week"]'); await p.waitForTimeout(500);
  const wk = await p.$$eval('.flow .chip, .flow .ev', n => n.map(x => x.textContent));
  check('all-day multi-day event spans 2 days in week view', wk.filter(t => /Conference day/.test(t)).length === 2);
  await p.screenshot({ path: path.join(out, 'gcal-week.png') });
  check('Google rows have no swipe/star', await p.evaluate(() => [...document.querySelectorAll('.row')].filter(r => (r.querySelector('.title') || {}).textContent === 'Client weekly sync').every(r => !r.querySelector('.star') && !r.closest('.swipe'))));
  // auto brief 25 min before (fresh page, nothing cached)
  const p2 = await ctx.newPage(); await p2.clock.setFixedTime(new Date('2026-11-18T15:35:00Z'));
  await p2.evaluate(() => 0).catch(() => {});
  await p2.goto('file://' + path.join(out, 'gcal.html') + '#today');
  await p2.evaluate(() => { try { Object.keys(localStorage).filter(k => k.startsWith('hub.brief.')).forEach(k => localStorage.removeItem(k)); } catch {} });
  await p2.reload(); await p2.waitForTimeout(3000);
  const dbg = await p2.evaluate(() => ({ prep: (document.querySelector('.prep') || {}).textContent, calls: window.__briefCalls, keys: Object.keys(localStorage) }));
  if (!/분기 계약 갱신/.test(dbg.prep || '')) console.log('debug', JSON.stringify(dbg).slice(0, 600));
  check('auto brief 25 min before', /분기 계약 갱신/.test(dbg.prep || ''));
  console.log('errors:', errs); await b.close();
})();
