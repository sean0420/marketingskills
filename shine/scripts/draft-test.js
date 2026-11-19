// Tests the reply-draft flow with stubbed Gmail (get_thread, create_draft) and Shine AI.
// Usage: node shine/scripts/draft-test.js <outDir>   (run from repo root, needs Playwright)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || require('os').tmpdir();
fs.writeFileSync(path.join(out, 'draft.html'), '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('shine/app/shine.html', 'utf8') + '</body></html>');
const mail = { checkedDay: '2026-11-19', checkedAt: '2026-11-19T14:00:00Z', me: 'me@glozinc.example', seen: { t1: 'm2' }, dismissed: [], results: [
  { id: 't1', kind: 'reply', priority: 'high', tag: 'quote', why: '12화 더빙 단가를 요청했어요', action: '더빙 견적 보내기', due: null, area: 'work', subject: 'Request for quotation: Korean dubbing', from: 'Buyer', url: 'https://mail.google.com/#t1' }] };
const thread = { id: 't1', messages: [
  { id: 'm1', sender: 'me@glozinc.example', toRecipients: ['buyer@ott.example'], subject: 'Intro: GloZ dubbing', date: '2026-11-10T10:00:00Z', plaintextBody: 'Hi, sharing our dubbing capabilities.' },
  { id: 'm2', sender: 'buyer@ott.example', addressDisplayNames: [{ displayName: 'Buyer Kim', emailAddress: 'buyer@ott.example' }], toRecipients: ['me@glozinc.example'], subject: 'Re: Intro: GloZ dubbing', date: '2026-11-18T10:00:00Z', plaintextBody: 'Could you quote 12 episodes of Korean dubbing?\n\nOn Mon, Nov 10, 2026 at 10:00 AM Sean wrote:\n> Hi, sharing our dubbing capabilities.' }] };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 1300 }, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  await ctx.addInitScript(([M, T]) => {
    localStorage.setItem('hub.mail', JSON.stringify(M)); localStorage.setItem('hub.items', '[]');
    window.__calls = []; window.__prompt = '';
    const mcp = { callTool: async (srv, tool, input) => { window.__calls.push({ srv, tool, input });
      if (tool === 'get_thread') return { payload: T };
      if (tool === 'create_draft') return { payload: { id: 'd1', threadId: 't1', viewUrl: 'https://mail.google.com/mail/#drafts/d1' } };
      if (tool === 'list_events') return { payload: { events: [] } };
      return { payload: { threads: [] } }; } };
    const sample = Object.assign(async () => ({ text: '' }), { json: async p => { if (/답장 초안/.test(p)) { window.__prompt = p; return { body: 'Hi Buyer Kim,\n\nThank you for reaching out — we would be glad to help.\n\nCould you share the total runtime and target delivery date? We will send a quote by [날짜].\n\nBest regards,', notes: ['견적 송부 날짜 채우기'] }; } return []; } });
    window.claude = { use: async n => n === 'mcp' ? mcp : n === 'sample' ? sample : null };
  }, [mail, thread]);
  const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-19T15:00:00Z'));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out, 'draft.html') + '#today'); await p.waitForTimeout(1200);
  const check = (l, ok) => console.log((ok ? 'ok  ' : 'FAIL') + ' ' + l);
  await p.click('.mail [data-act="mail-draft"]'); await p.waitForTimeout(800);
  const body = await p.inputValue('#dr-body');
  check('draft generated into editable dialog', /Thank you for reaching out/.test(body));
  check('em dash removed', !/—/.test(body));
  check('reply goes to the other party', (await p.inputValue('#dr-to')) === 'buyer@ott.example');
  check('subject is Re:', /^Re: Intro/.test(await p.inputValue('#dr-subj')));
  check('quoted history stripped from prompt', !/sharing our dubbing capabilities\.\n\nOn Mon/.test(await p.evaluate(() => window.__prompt)) && !/^> /m.test(await p.evaluate(() => window.__prompt)));
  check('notes shown', /견적 송부 날짜 채우기/.test(await p.textContent('.dialog')));
  await p.screenshot({ path: path.join(out, 'draft-dialog.png') });
  await p.fill('#dr-body', body.replace('[날짜]', 'Friday'));
  await p.mouse.click(5, 5); await p.waitForTimeout(200);
  check('background tap does not discard edits', !!(await p.$('#dr-body')));
  await p.click('[data-act="dr-save"]'); await p.waitForTimeout(600);
  const calls = await p.evaluate(() => window.__calls);
  const cd = calls.find(c => c.tool === 'create_draft');
  check('create_draft called as reply with signature', cd && cd.input.replyToMessageId === 'm2' && cd.input.includeSignature === true && /Friday/.test(cd.input.body));
  check('never sends mail', !calls.some(c => /send/.test(c.tool)));
  check('saved state + Gmail link', /임시보관함에 저장했어요/.test(await p.textContent('.dialog')) && !!(await p.$('.dialog a[href*="drafts/d1"]')));
  await p.click('[data-act="dlg-close"]'); await p.waitForTimeout(300);
  check('row shows draft saved', /초안 저장됨/.test(await p.textContent('.mail')));
  console.log('errors:', errs); await b.close();
})();
