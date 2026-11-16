// End-to-end test of the mail briefing with stubbed Gmail + Shine AI.
// Usage: node shine/scripts/mail-test.js <outDir>   (run from repo root, needs Playwright)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || '/tmp';
fs.writeFileSync(path.join(out, 'mail.html'), '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('shine/app/shine.html', 'utf8') + '</body></html>');
const th = (id, subject, snippet, from) => ({ id, viewUrl: 'https://mail.google.com/#' + id, messageCount: 1, messages: [{ sender: from, subject, snippet, date: '2026-11-16T14:00:00Z', labelIds: ['INBOX', 'UNREAD'], toRecipients: ['sean@glozinc.com'] }] });
const threads = [
  th('t1', 'Request for quotation: Korean dubbing, 12 episodes', 'Could you send your best rate by Friday?', 'buyer@ott.example'),
  th('t2', 'URGENT: subtitle file rejected by QC', 'Please fix and redeliver ASAP', 'ops@studio.example'),
  th('t3', 'Lunch next week?', 'Are you free Tuesday or Wednesday?', 'partner@example.com'),
  th('t4', 'FYI: updated style guide', 'Sharing the latest version for reference', 'pm@client.example'),
];
const sent = [th('s1', 'Proposal', 'Following up', 'sean@glozinc.com')];
const ai = [ // AI deliberately under-rates the quote mail; the rule boost must raise it
  { id: 't1', kind: 'reply', priority: 'normal', tag: 'inquiry', why: '12화 더빙 단가를 요청했어요', action: '더빙 견적 보내기', due: '2026-11-20', area: 'work' },
  { id: 't2', kind: 'reply', priority: 'normal', tag: 'info', why: 'QC 반려로 재납품을 요청했어요', action: '자막 수정 후 재납품', due: null, area: 'work' },
  { id: 't3', kind: 'reply', priority: 'normal', tag: 'meeting', why: '점심 일정을 물었어요', action: '점심 일정 답장', due: null, area: 'work' },
  { id: 't4', kind: 'reply', priority: 'low', tag: 'info', why: '참고용 스타일 가이드예요', action: '스타일 가이드 확인', due: null, area: 'work' },
  { id: 't5', kind: 'reply', priority: 'normal', tag: 'inquiry', why: '게임 현지화 단가 문의예요', action: '게임 현지화 견적 보내기', due: null, area: 'work' },
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 1400 }, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  await ctx.addInitScript(([T, A]) => {
    window.__T = T; window.__aiCalls = 0; window.__gmailCalls = 0;
    const sample = Object.assign(async () => ({ text: '' }), { json: async (prompt) => { window.__aiCalls++; const ids = [...prompt.matchAll(/id:(\w+)/g)].map(m => m[1]); return A.filter(a => ids.includes(a.id)); } });
    const mcp = { callTool: async (srv, tool, input) => { window.__gmailCalls++; return { payload: { threads: /in:inbox/.test(input.query) ? window.__T : window.__SENT } }; } };
    window.claude = { use: async n => n === 'sample' ? sample : n === 'mcp' ? mcp : null };
  }, [threads, ai]);
  await ctx.addInitScript(S0 => { window.__SENT = S0; }, sent);
  const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-16T15:00:00Z'));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out, 'mail.html') + '#today'); await p.waitForTimeout(1500);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('hub.mail') || '{}').results || []);
  const by = Object.fromEntries(stored.map(r => [r.id, r]));
  const check = (label, ok) => console.log((ok ? 'ok  ' : 'FAIL') + ' ' + label);
  check('quote mail boosted to high + tagged 견적 요청', by.t1 && by.t1.priority === 'high' && by.t1.tag === 'quote');
  check('urgent mail boosted to high + tagged 긴급', by.t2 && by.t2.priority === 'high' && by.t2.tag === 'urgent');
  check('normal mail stays normal', by.t3 && by.t3.priority === 'normal');
  check('FYI stays low', by.t4 && by.t4.priority === 'low');
  check('sorted high first', stored[0].priority === 'high' && stored[stored.length - 1].priority === 'low');
  const focusMails = await p.$$eval('.focus .row .title', n => n.map(x => x.textContent));
  check('important mails shown on main focus card', focusMails.some(t => /quotation/.test(t)) && focusMails.some(t => /URGENT/.test(t)));
  const lowHidden = !(await p.$$eval('.mail .mrow b', n => n.map(x => x.textContent))).some(t => /FYI/.test(t));
  check('low (FYI) collapsed by default', lowHidden);
  await p.screenshot({ path: path.join(out, 'mail-priority.png') });
  // live watch: nothing new -> no AI call
  const ai0 = await p.evaluate(() => window.__aiCalls); const g0 = await p.evaluate(() => window.__gmailCalls);
  await p.waitForTimeout(11000);
  check('polls Gmail again within ~10s', (await p.evaluate(() => window.__gmailCalls)) > g0);
  check('no AI call when inbox unchanged', (await p.evaluate(() => window.__aiCalls)) === ai0);
  // a new quote mail arrives, and Sean replies to t3
  await p.evaluate(() => {
    window.__T = [{ id: 't5', viewUrl: '#t5', messageCount: 1, messages: [{ id: 'm5', sender: 'lead@game.example', subject: 'Pricing for game localization (JA/KO)', snippet: 'What is your rate per word?', date: '2026-11-16T15:01:00Z', labelIds: ['INBOX','UNREAD'], toRecipients: ['sean@glozinc.com'] }] },
      ...window.__T.map(t => t.id === 't3' ? { ...t, messageCount: 2, messages: [{ ...t.messages[0], id: 'm3b', sender: 'sean@glozinc.com' }] } : t)];
  });
  await p.waitForTimeout(11500);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('hub.mail') || '{}').results || []);
  const a5 = after.find(r => r.id === 't5');
  check('new mail picked up automatically as high + 견적 요청', a5 && a5.priority === 'high' && a5.tag === 'quote');
  check('only the new thread was sent to AI', (await p.evaluate(() => window.__aiCalls)) === ai0 + 1);
  check('mail Sean replied to is removed', !after.some(r => r.id === 't3'));
  check('NEW badge shown', (await p.$$eval('.mail .mrow b', n => n.map(x => x.textContent))).some(t => /^NEW/.test(t)));
  await p.screenshot({ path: path.join(out, 'mail-live.png') });
  console.log('errors:', errs); await b.close();
})();
