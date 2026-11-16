#!/usr/bin/env node
// Tests Shine's local Korean date/time/timezone parser against a fixed "today".
// Usage: node shine/scripts/test-parser.js   (runs in America/Chicago)
'use strict';
if (process.env.TZ !== 'America/Chicago') {
  const r = require('child_process').spawnSync(process.execPath, [__filename], { stdio: 'inherit', env: { ...process.env, TZ: 'America/Chicago' } });
  process.exit(r.status);
}
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'shine.html'), 'utf8');
const js = src.split('<script>')[1].split('</script>')[0];
const utils = js.split('/* ---------- utils ---------- */')[1].split('/* ---------- state')[0].replace(/const ls[\s\S]*?\};\n/, '');
const parser = js.split('/* ---------- local Korean parser (instant, fallback) ---------- */')[1].split('/* ---------- AI')[0];

// Freeze "today" at Monday 2026-11-16 10:00 Dallas.
const RealDate = Date;
global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [new RealDate('2026-11-16T16:00:00Z').getTime()])); } static now() { return new RealDate('2026-11-16T16:00:00Z').getTime(); } };

const api = new Function(utils + parser + '\nreturn { parseLocal, wallToUtc, utcToTz };')();
const cases = [
  ['다음주 수요일 OOO에게 이메일 전달', { type: 'task', date: '2026-11-25', area: 'work' }],
  ['목요일 3시 Netflix APAC 더빙 견적 미팅', { type: 'event', date: '2026-11-19', time: '15:00' }],
  ['금요일까지 WowSub 데모 덱 수정', { type: 'task', date: '2026-11-20' }],
  ['토요일 어머니 생신 선물', { type: 'task', date: '2026-11-21', area: 'personal' }],
  ['웹툰 현지화에 AI QC 붙이면 차별화 가능할 듯', { type: 'note', date: null }],
  ['12월 3일 오후 2시반 투자사 콜', { type: 'event', date: '2026-12-03', time: '14:30' }],
  ['내일 계약서 회신', { type: 'task', date: '2026-11-17' }],
  ['중요 금요일까지 계약서 회신', { priority: 'high', date: '2026-11-20' }],
  ['수요일 한국시간 오후 2시 CJ ENM 화상 미팅 kim@cjenm.com', { type: 'event', tz: 'Asia/Seoul', tzDate: '2026-11-18', tzTime: '14:00', date: '2026-11-17', time: '23:00' }],
];
let fail = 0;
for (const [q, want] of cases) {
  const got = api.parseLocal(q)[0];
  const bad = Object.entries(want).filter(([k, v]) => got[k] !== v);
  if (bad.length) { fail++; console.log('FAIL', q, bad.map(([k, v]) => `${k}: want ${v}, got ${got[k]}`).join('; ')); }
  else console.log('ok  ', q);
}
const dst = api.utcToTz(api.wallToUtc('2026-03-09', '10:00', 'Asia/Seoul'), 'America/Chicago');
if (dst.date !== '2026-03-08' || dst.time !== '20:00') { fail++; console.log('FAIL DST', dst); } else console.log('ok   DST boundary Seoul 3/9 10:00 = Dallas 3/8 20:00');
console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
