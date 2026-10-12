import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {docxParagraphs} from './helpers/docx-reader.mjs';
let server,browser,url;
before(async()=>{
 const root=path.resolve('dist');
 server=createServer((req,res)=>{
   const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/check\//,'/');
   const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
   if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':'application/octet-stream');res.end(readFileSync(file));}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/check/`;
 // 한글 파일 이름(원고_날짜.docx)은 UTF-8 로캘이 없으면 Chromium이 'download'로 바꾼다. 테스트 환경을 고정한다.
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,env:{...process.env,LANG:'C.UTF-8',LC_ALL:'C.UTF-8'},args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
async function pageReady(){const p=await browser.newPage();await p.goto(url);await p.waitForFunction(()=>document.querySelector('#engineStatus').textContent.includes('Garu 실측 확인'));return p;}
async function settled(page){await page.waitForFunction(()=>!document.querySelector('#issueList').textContent.includes('기다리는 중'));}
test('production /check/ path loads dictionary, worker, WASM and model; red underlines and apply',async()=>{
 const page=await pageReady();try{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  assert.match(await page.locator('#engineStatus').innerText(),/436,587행/);
  await page.locator('#editor').fill('😀 엉망 진창이었다.\n살펴 보았다. 읽어보았다.');await settled(page);
  assert.deepEqual(await page.locator('#mirror mark').allTextContents(),['엉망 진창이었다','살펴 보았다','읽어보았다']);
  assert.equal(await page.locator('#mirror mark').first().evaluate(e=>getComputedStyle(e).textDecorationStyle),'wavy');
  assert.equal(await page.locator('#mirror mark').first().evaluate(e=>getComputedStyle(e).textDecorationColor),'rgb(201, 46, 67)');
  await page.locator('[data-action="fix"]').first().click();await settled(page);
  assert.equal(await page.locator('#editor').inputValue(),'😀 엉망진창이었다.\n살펴 보았다. 읽어보았다.');
  assert.equal(await page.locator('#mirror mark').count(),2);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('rapid edits invalidate old results; position-based ignore is local to occurrence',async()=>{
 const page=await pageReady();try{
  await page.locator('#editor').fill('엉망 진창 '.repeat(100));
  await page.locator('#editor').fill('큰 집에서 살았다.');await settled(page);
  // 정책 변경(2026-10-09): 큰 집 → 큰집(사전 등재어)은 '문맥 확인'으로 1건 표시된다.
  // 이 테스트의 목적(이전 원고의 결과 100건이 남지 않음)은 그대로 검증한다.
  assert.deepEqual(await page.locator('#mirror mark').allTextContents(),['큰 집에서']);
  assert.match(await page.locator('#issueList').innerText(),/문맥 확인/);
  await page.locator('#editor').fill('엉망 진창. 엉망 진창.');await settled(page);
  await page.locator('[data-action="ignore"]').first().click();
  assert.equal(await page.locator('#mirror mark').count(),1);
  assert.equal(await page.locator('#editor').inputValue(),'엉망 진창. 엉망 진창.');
 }finally{await page.close();}
});
test('only series rules appear and persist; additions affect the unchanged editor',async()=>{
 const page=await pageReady();try{
  await page.locator('[data-tab="rules"]').click();
  assert.equal(await page.locator('#ruleList .rule-row').count(),0);
  assert(!((await page.locator('#ruleList').innerText()).includes('기본 규칙')));
  for(const [id,value]of Object.entries({ruleName:'용어 통일',ruleFrom:'프린트물',ruleTo:'인쇄물',ruleReason:'시리즈 표기 통일'}))await page.locator('#'+id).fill(value);
  await page.locator('#saveRule').click();assert.equal(await page.locator('#ruleList .rule-row').count(),1);
  await page.reload();await page.locator('[data-tab="rules"]').click();assert.equal(await page.locator('#ruleList .rule-row').count(),1);
  await page.locator('[data-tab="proof"]').click();await page.locator('#editor').fill('프린트물');
  await page.locator('[data-action="fix"]').click();assert.equal(await page.locator('#editor').inputValue(),'인쇄물');
 }finally{await page.close();}
});
test('counts and manuscript target survive engine replacement',async()=>{
 const page=await pageReady();try{
  await page.locator('#editor').fill('가 나\n😀');await page.locator('#targetValue').fill('1');
  assert.equal(await page.locator('#allCount').innerText(),'5자');assert.equal(await page.locator('#noSpaceCount').innerText(),'3자');
  assert.equal(await page.locator('#sheetsCount').innerText(),'0.02매');
  assert.match(await page.locator('#targetSummary').innerText(),/부족 197자/);
 }finally{await page.close();}
});
// 요청서 2절: 엑셀 내보내기 → Word(.docx). 편집 영역의 최신 원고 텍스트만 저장한다.
test('Word export saves only the latest manuscript text, with paragraphs and line breaks',async()=>{
 const page=await pageReady();try{
  assert.equal(await page.locator('#excelBtn').count(),0);
  assert.match(await page.locator('#wordBtn').innerText(),/Word로 내보내기/);
  await page.locator('#editor').fill('😀 엉망 진창이었다.\n\n둘째 문단입니다.\t탭과  공백\n셋째 줄');await settled(page);
  await page.locator('[data-action="fix"]').first().click();
  const latest=await page.locator('#editor').inputValue();
  assert(latest.startsWith('😀 엉망진창이었다.'));
  const download=page.waitForEvent('download');await page.locator('#wordBtn').click();const item=await download;
  assert.match(item.suggestedFilename(),/^원고_\d{4}-\d{2}-\d{2}\.docx$/);
  const bytes=readFileSync(await item.path());assert.equal(bytes.readUInt32LE(0),0x04034b50);
  assert.deepEqual(docxParagraphs(bytes),latest.split('\n'));
  const all=bytes.toString('latin1');
  assert(!/sheet|xl\//.test(all));
  assert.match(await page.locator('#exportStatus').innerText(),/Word/);
 }finally{await page.close();}
});
test('dictionary failure is reported, never shown as a clean manuscript',async()=>{
 const page=await browser.newPage();try{
  await page.route('**/data/stdict-lexicon.json',route=>route.fulfill({status:503,body:'unavailable'}));await page.goto(url);
  await page.waitForFunction(()=>document.querySelector('#engineStatus').textContent.includes('사전 미연결'));
  await page.locator('#editor').fill('엉망 진창');await page.waitForFunction(()=>document.querySelector('#issueList').textContent.includes('분석을 완료하지 못했습니다'));
  assert.equal(await page.locator('#mirror mark').count(),0);
 }finally{await page.close();}
});
// 결정(2026-10-10): 형태소 분석기(WASM)가 실패하면 '분석 실패'가 아니라 사전 기반 제한 모드로 검사를 계속한다.
// 제한 모드임을 화면에 알리고, 검출이 없더라도 오류가 없다는 뜻이 아님을 표시한다.
test('WASM failure falls back to the dictionary-only limited mode and says so; custom rules still work',async()=>{
 const page=await browser.newPage();try{
  await page.route('**/*.wasm',route=>route.fulfill({status:503,body:'unavailable'}));await page.goto(url);
  await page.waitForFunction(()=>{const t=document.querySelector('#engineStatus').textContent;return t.includes('Garu 미연결')&&t.includes('436,587')&&t.includes('제한 모드');});
  assert.match(await page.locator('#engineStatus').innerText(),/오류가 없다는 의미가 아닙니다/);
  await page.locator('#editor').fill('몇일 동안 기다렸다.');await settled(page);
  assert.deepEqual(await page.locator('#mirror mark').allTextContents(),['몇일']);
  assert(!(await page.locator('#issueList').innerText()).includes('분석을 완료하지 못했습니다'));
  assert.match(await page.locator('#issueList').innerText(),/제한 모드/);
  await page.locator('[data-tab="rules"]').click();
  for(const [id,value]of Object.entries({ruleName:'용어',ruleFrom:'프린트물',ruleTo:'인쇄물',ruleReason:'통일'}))await page.locator('#'+id).fill(value);
  await page.locator('#saveRule').click();await page.locator('[data-tab="proof"]').click();await page.locator('#editor').fill('프린트물');
  assert.equal(await page.locator('#mirror mark').innerText(),'프린트물');
 }finally{await page.close();}
});

test('failed worker script remains a failure after further edits',async()=>{
 const page=await browser.newPage();try{
  await page.route('**/engine-worker-*.js',route=>route.abort());await page.goto(url);
  await page.waitForFunction(()=>document.querySelector('#engineStatus').textContent.includes('분석 작업'));
  await page.locator('#editor').fill('새 원고를 살펴 보았다.');
  await page.waitForFunction(()=>document.querySelector('#issueList').textContent.includes('분석을 완료하지 못했습니다'));
 }finally{await page.close();}
});
