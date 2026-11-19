// Tests the morning briefing card through the real db code path, using an in-memory fake of the db capability.
// Usage: node shine/scripts/morning-test.js <outDir>   (run from repo root, needs Playwright)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || require('os').tmpdir();
fs.writeFileSync(path.join(out, 'morning.html'), '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('shine/app/shine.html', 'utf8') + '</body></html>');
const brief = { date: '2026-11-19', createdAt: '2026-11-19T12:43:00Z', headline: '오늘은 견적 요청 2건과 미팅 2개가 있어요. 견적 회신부터 시작하세요.',
  focus: ['더빙 견적 회신', 'QC 반려 자막 재납품', '주간 미팅 안건 정리'],
  meetings: [{ time: '12:00', title: 'Team weekly A', meet: 'https://meet.google.com/abc' }, { time: '19:00', title: 'Team weekly B' }],
  mails: [{ subject: 'Request for quotation: Korean dubbing', from: 'Buyer', why: '12화 단가 요청', priority: 'high', url: 'https://mail.google.com/#1' }],
  tasks: [{ title: '계약서 회신', due: '2026-11-17', priority: 'high' }] };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  await ctx.addInitScript(B => {
    const store = { 'items': {}, 'mail/latest': null, 'briefs/morning_2026-11-19': B };
    const listeners = {};
    const snap = (p, v) => ({ id: p.split('/').pop(), exists: v != null, data: () => v, metadata: { fromCache: false, hasPendingWrites: false } });
    const emit = p => (listeners[p] || []).forEach(f => f(snap(p, store[p])));
    const doc = p => ({ id: p.split('/').pop(), path: p, get: async () => snap(p, store[p]), set: async v => { store[p] = v; emit(p); }, update: async v => { store[p] = { ...store[p], ...v }; emit(p); }, delete: async () => { store[p] = null; emit(p); },
      onSnapshot: (f) => { (listeners[p] = listeners[p] || []).push(f); setTimeout(() => f(snap(p, store[p])), 10); return () => {}; } });
    const db = { doc, collection: c => ({ add: async v => ({ id: 'x' }), doc: id => doc(c + '/' + id), onSnapshot: f => { setTimeout(() => f({ docs: [], size: 0, empty: true, metadata: { fromCache: false } }), 10); return () => {}; } }) };
    window.__setBrief = v => { store['briefs/morning_2026-11-19'] = v; emit('briefs/morning_2026-11-19'); };
    window.claude = { use: async n => n === 'db' ? db : null };
  }, brief);
  const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-19T13:05:00Z'));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out, 'morning.html') + '#today'); await p.waitForTimeout(1000);
  const check = (l, ok) => console.log((ok ? 'ok  ' : 'FAIL') + ' ' + l);
  const t = await p.textContent('.morning').catch(() => '');
  check('morning card shown at top from db doc', /견적 회신부터 시작하세요/.test(t) && /Team weekly A/.test(t) && /Request for quotation/.test(t) && /계약서 회신/.test(t));
  check('card is first tile', await p.evaluate(() => document.querySelector('.bento').firstElementChild.classList.contains('morning')));
  await p.screenshot({ path: path.join(out, 'morning-card.png') });
  await p.click('[data-act="morning-ok"]'); await p.waitForTimeout(200);
  check('dismissed for today', !(await p.$('.morning')));
  await p.reload(); await p.waitForTimeout(800);
  check('stays dismissed after reload', !(await p.$('.morning')));
  console.log('errors:', errs); await b.close();
})();
