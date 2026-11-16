// Interaction test for swipe-to-delete. Usage: node shine/scripts/swipe-test.js <outDir>  (run from repo root)
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('shine/app/shine.html','utf8') + '</body></html>';
fs.writeFileSync(path.join(out,'sw.html'), html);
const items = [
 {id:'a',type:'task',title:'견적 자료 준비',area:'work',date:'2026-11-16',status:'open',people:[]},
 {id:'b',type:'task',title:'계약서 회신',priority:'high',area:'work',date:'2026-11-13',status:'open',people:[]},
 {id:'c',type:'task',title:'어머니 생신 선물',area:'personal',date:'2026-11-18',status:'open',people:[]},
 {id:'old',type:'task',title:'오래된 삭제 항목',area:'work',status:'open',people:[],deletedAt:'2026-10-10T12:00:00Z'},
 {id:'rec',type:'note',title:'최근 삭제 메모',area:'work',status:'open',people:[],deletedAt:'2026-11-10T12:00:00Z'}];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, timezoneId:'America/Chicago' });
  await ctx.addInitScript(d => localStorage.setItem('hub.items', d), JSON.stringify(items));
  const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-16T20:40:00Z'));
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out,'sw.html') + '#tasks'); await p.waitForTimeout(800);
  const drag = async (title, dist) => { const r = await p.locator('.swipe', { hasText: title }).first().boundingBox();
    const y = r.y + r.height/2, x = r.x + r.width * 0.7; await p.mouse.move(x, y); await p.mouse.down();
    for (let i=1;i<=10;i++) await p.mouse.move(x + dist*i/10, y + 1); await p.mouse.up(); await p.waitForTimeout(600); };
  const titles = async () => p.$$eval('.tile .title, .panel .title', n => n.map(x => x.textContent));
  await drag('어머니 생신 선물', -60); console.log('short drag, still there:', (await titles()).includes('어머니 생신 선물'), 'dialog open:', !!(await p.$('.dialog')));
  await drag('견적 자료 준비', -250); console.log('normal delete gone:', !(await titles()).includes('견적 자료 준비'), 'toast:', await p.textContent('#toast-root'));
  await p.click('[data-act="undo-del"]'); await p.waitForTimeout(300); console.log('undo restored:', (await titles()).includes('견적 자료 준비'));
  await drag('계약서 회신', -250); console.log('high -> confirm shown:', !!(await p.$('.confirm')));
  await p.screenshot({ path: path.join(out,'swipe-confirm.png') });
  await p.click('.confirm [data-act="cf-no"]'); await p.waitForTimeout(400); console.log('cancel keeps item:', (await titles()).includes('계약서 회신'));
  await drag('계약서 회신', -250); console.log('scrollX after swipe:', await p.evaluate(()=>scrollX)); await p.click('[data-act="cf-yes"]', {timeout:5000}); await p.waitForTimeout(700); console.log('confirm deletes:', !(await titles()).includes('계약서 회신'));
  await p.goto('file://' + path.join(out,'sw.html') + '#archive'); await p.waitForTimeout(600);
  const arch = async () => p.$$eval('.arow b', n => n.map(x => x.textContent));
  let a = await arch(); console.log('archive has deleted items:', a.includes('계약서 회신'), '| 30+ day item purged:', !a.includes('오래된 삭제 항목'), '| recent kept:', a.includes('최근 삭제 메모'));
  await p.screenshot({ path: path.join(out,'archive.png') });
  await p.click('.arow:has-text("계약서 회신") [data-act="ar-restore"]'); await p.waitForTimeout(300);
  console.log('restore removes from archive:', !(await arch()).includes('계약서 회신'));
  await p.click('.arow:has-text("최근 삭제 메모") [data-act="ar-purge"]'); await p.click('[data-act="cf-yes"]'); await p.waitForTimeout(300);
  console.log('permanent delete:', !(await arch()).includes('최근 삭제 메모'), '| stored left:', await p.evaluate(() => JSON.parse(localStorage.getItem('hub.items')).map(i => i.id).join(',')));
  console.log('errors:', errs); await b.close();
})();
