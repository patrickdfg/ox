// Opt-in integration against Firebase and the deployed grading function.
// Only anonymous test accounts and sessions created here are removed.
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
if(process.env.QUIZ_LIVE_TEST!=='1')throw Error('Set QUIZ_LIVE_TEST=1 to run the isolated live integration.');
const root=path.resolve('.'),out=path.resolve(process.env.QUIZ_SCREENSHOT_DIR||'test-results/live');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))throw Error();const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(4175,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),contexts=[],pins=new Set();let host;
const base='http://localhost:4175',errors=[];
async function context(viewport){const c=await browser.newContext({viewport,serviceWorkers:'block'});contexts.push(c);await c.route('**/js/questions.js',r=>r.fulfill({contentType:'text/javascript',body:`export const TIME_LIMIT=20;export const questions=[{q:'브라우저 검증: 1+1=2',a:'O',exp:'1과 1은 2'},{q:'브라우저 검증: 1+1=3',a:'X',exp:'1과 1은 2'}];`}));return c;}
async function wait(page,fn){await page.waitForFunction(fn,null,{timeout:60000});}
try {
 const hc=await context({width:1440,height:1000}),sc=await context({width:390,height:844});host=await hc.newPage();const student=await sc.newPage();
 for(const p of [host,student])p.on('pageerror',e=>errors.push(e.message));
 await host.goto(base+'/host.html?quiz=sample&mode=battle');await wait(host,()=>/^\d{6}$/.test(document.getElementById('pin').textContent));const pin=await host.locator('#pin').textContent();pins.add(pin);
 await student.goto(base+'/play.html?pin='+pin);await student.locator('#name-input').fill('검증 별');await student.locator('#join-form button').click();await wait(host,()=>document.getElementById('player-count').textContent==='1');await host.locator('#start-btn').click();
 await student.locator('[data-answer="0"]').click();await wait(host,()=>!document.getElementById('reveal').hidden);await wait(student,()=>!document.getElementById('result').hidden);assert.match(await student.locator('#result-title').textContent(),/정답/);
 const first=await student.locator('#result-points').textContent();await host.reload();await wait(host,()=>!document.getElementById('reveal').hidden);assert.equal(await student.locator('#result-points').textContent(),first);
 await host.locator('#next-btn').click();await student.locator('[data-answer="1"]').click();await wait(host,()=>!document.getElementById('reveal').hidden);await host.locator('#next-btn').click();await wait(host,()=>!document.getElementById('end').hidden);await wait(student,()=>!document.getElementById('end').hidden);
 assert.ok(await host.locator('#race-panel .race-lane').count());assert.ok(await host.locator('#podium').textContent());
 await host.waitForTimeout(9200);
 for(const[p,name]of [[host,'live-desktop.png'],[student,'live-mobile.png']]){assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(out,name),animations:'disabled'});}
 await host.goto(base+'/reports.html');await host.locator(`[data-open="${pin}"]`).click();await wait(host,()=>!document.getElementById('report-detail').hidden);assert.match(await host.locator('#student-stats').textContent(),/100%/);
 assert.match(await host.locator('#report-overview').textContent(),/1명/);assert.equal(await host.locator('#option-stats article').count(),2);
 const download=host.waitForEvent('download');await host.locator('#csv').click();assert.equal((await download).suggestedFilename(),'quiz-report.csv');
 await host.goto(base+'/host.html?quiz=sample&mode=self&direct=1');await host.waitForURL(/play.html\?pin=\d+&solo=1/,{timeout:60000});const solo=new URL(host.url()).searchParams.get('pin');pins.add(solo);await host.locator('[data-answer="0"]').click();await wait(host,()=>!document.getElementById('result').hidden);await host.locator('#personal-next').click();await host.reload();await wait(host,()=>!document.getElementById('question').hidden);assert.match(await host.locator('#pq-text').textContent(),/1\+1=3/);
 await host.locator('[data-answer="0"]').click();await host.locator('#personal-next').click();await wait(host,()=>!document.getElementById('end').hidden);assert.match(await host.locator('#personal-review').textContent(),/1\+1=3/);
 await host.goto(base+'/host.html?quiz=sample&mode=self&direct=1&feedback=end&visual=race');await host.waitForURL(/play.html\?pin=\d+&solo=1/,{timeout:60000});pins.add(new URL(host.url()).searchParams.get('pin'));await host.locator('[data-answer="0"]').click();await wait(host,()=>!document.getElementById('result').hidden);assert.match(await host.locator('#result-title').textContent(),/제출/);assert.doesNotMatch(await host.locator('#result-answer').textContent(),/정답: O/);await host.locator('#personal-next').click();await host.locator('[data-answer="1"]').click();await host.locator('#personal-next').click();await wait(host,()=>!document.getElementById('end').hidden);assert.ok(await host.locator('#race-panel .race-lane').count());
 await host.locator('.motion-toggle').click();assert.equal(await host.locator('.motion-toggle').getAttribute('aria-pressed'),'true');assert.ok(await host.evaluate(()=>document.documentElement.classList.contains('reduce-motion')));
 assert.deepEqual(errors,[]);console.log('PASS: live PIN/QR, server grading, race, resume, podium, report/CSV, direct self-study, desktop/mobile');
}finally{
 if(host) {
  await host.evaluate(async owned=>{const {at,remove}=await import('./js/db.js'),{auth,authReady}=await import('./js/auth.js');await authReady;for(const pin of owned){await remove(at(`sessionKeys/${pin}`));await remove(at(`reports/${auth.currentUser.uid}/${pin}`));await remove(at(`sessions/${pin}`));}},[...pins]).catch(e=>console.error('Test session cleanup requires retry:',e.message));
 }
 for(const c of contexts){const p=c.pages()[0];if(p)await p.evaluate(async()=>{const {auth}=await import('./js/auth.js');if(auth.currentUser?.isAnonymous){const {deleteUser}=await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js');await deleteUser(auth.currentUser);}}).catch(e=>console.error('Test account cleanup requires retry:',e.message));}
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
