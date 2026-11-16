#!/usr/bin/env node
// Renders Shine with sample data at iPad and phone sizes and saves screenshots.
// Usage: node shine/scripts/preview.js [outDir]   (needs Playwright + Chromium)
'use strict';
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const app = path.join(__dirname, '..', 'app', 'shine.html');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'shine-preview'));
fs.mkdirSync(out, { recursive: true });
const page = path.join(out, 'page.html');
fs.writeFileSync(page, '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(app, 'utf8') + '</body></html>');

const T = '2026-11-16';
const items = [
  { id: '1', type: 'event', title: 'Netflix APAC 더빙 견적 미팅', priority: 'high', area: 'work', date: T, time: '15:00', endTime: '16:00', status: 'open', org: 'Netflix', people: [] },
  { id: '2', type: 'event', title: 'CJ ENM 화상 미팅', area: 'work', date: T, time: '09:00', endTime: '10:00', status: 'open', org: 'CJ ENM', tz: 'Asia/Seoul', tzDate: '2026-11-17', tzTime: '00:00', people: [] },
  { id: '3', type: 'event', title: '팀 싱크', area: 'work', date: T, time: '15:30', endTime: '16:00', status: 'open', people: [] },
  { id: '4', type: 'event', title: '아이 픽업', area: 'personal', date: T, time: '17:30', endTime: '18:00', status: 'open', people: [] },
  { id: '5', type: 'task', title: '견적 자료 준비', area: 'work', date: T, status: 'open', org: 'Netflix', people: [] },
  { id: '6', type: 'task', title: 'OOO에게 이메일 전달', area: 'work', date: '2026-11-18', status: 'open', people: ['OOO'] },
  { id: '7', type: 'task', title: '계약서 회신', priority: 'high', area: 'work', date: '2026-11-13', status: 'open', people: [] },
  { id: '8', type: 'task', title: '어머니 생신 선물 사기', area: 'personal', date: '2026-11-21', status: 'open', people: [] },
  { id: '9', type: 'event', title: '투자사 콜', area: 'work', date: '2026-11-18', time: '10:00', endTime: '11:00', status: 'open', people: [] },
  { id: '10', type: 'note', title: '웹툰 AI QC 아이디어', area: 'work', date: T, status: 'open', people: [] },
];
const mail = { checkedAt: '2026-11-16T13:02:00Z', checkedDay: T, dismissed: [], results: [
  { id: 'm1', kind: 'reply', priority: 'high', why: '단가표 회신을 오늘까지 요청했어요', action: '단가표 회신하기', due: T, area: 'work', subject: 'Re: Subtitling rate card for 2027', from: 'Sample Sender', url: 'https://mail.google.com' },
  { id: 'm2', kind: 'followup', priority: 'normal', why: '3일 전 제안서를 보냈는데 답이 없어요', action: '제안서 후속 메일', due: null, area: 'work', subject: 'Localization proposal', from: 'Sean Park', url: 'https://mail.google.com' }] };

const L = { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true };
const runs = [
  ['ipad-landscape-day', L, 'light', 'day'], ['ipad-landscape-week', L, 'light', 'week'], ['ipad-landscape-month-dark', L, 'dark', 'month'],
  ['ipad-portrait', { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }, 'light', 'day'],
  ['phone-dark', devices['iPhone 13'], 'dark', 'day'],
];
(async () => {
  const browser = await chromium.launch();
  for (const [name, opts, scheme, flow] of runs) {
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1, colorScheme: scheme, timezoneId: 'America/Chicago' });
    await ctx.addInitScript(([d, m, f]) => { localStorage.setItem('hub.items', d); localStorage.setItem('hub.mail', m); localStorage.setItem('hub.flowMode', JSON.stringify(f)); }, [JSON.stringify(items), JSON.stringify(mail), flow]);
    const p = await ctx.newPage();
    await p.clock.setFixedTime(new Date('2026-11-16T20:40:00Z'));
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + page + '#today');
    await p.waitForTimeout(1000);
    await p.evaluate(() => { const b = document.getElementById('banner'); if (b) b.innerHTML = ''; });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await p.screenshot({ path: path.join(out, name + '.png') });
    console.log(`${name}: horizontal overflow ${overflow}px${errs.length ? ', errors: ' + errs.join(' | ') : ''}`);
    await ctx.close();
  }
  await browser.close();
  console.log('saved to', out);
})();
