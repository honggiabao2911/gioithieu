const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8000/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const errors=[];
 for(const mobile of (process.env.HEADER_MOBILE_ONLY==='1'?[true]:[false,true])){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/app.js*',async route=>{await gate;await route.continue();});
  await page.goto(base+'#skills',{waitUntil:'commit'});
  await page.waitForFunction(()=>document.querySelector('.site-header')&&document.styleSheets.length>=4);
  assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('construction-pending')),true);
  assert.equal(await page.locator('.site-header').evaluate(e=>getComputedStyle(e).visibility),'hidden','the header must not flash while the deferred app is still downloading, even with a hash');
  const png=PNG.sync.read(await page.screenshot({fullPage:true}));
  assert.ok(png.data.every((value,index)=>index%4===3||value===0),'a slow script on #skills still starts with an entirely black document');
  release();await page.waitForLoadState('load');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  assert.equal(await page.locator('body').getAttribute('data-tour'),'off','keep the requested anchor instead of starting an automatic tour');
  await page.waitForFunction(()=>Math.abs(document.querySelector('#skills').getBoundingClientRect().top-parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop))<4,null,{timeout:5000});
  assert.equal(await page.locator('.site-header').getAttribute('data-build-state'),'waiting');
  assert.equal(await page.locator('#hero-title').getAttribute('data-build-state'),'waiting','opening a lower section does not complete the hero behind the scenes');
  const headerItems=page.locator('.site-header .build-item');
  assert.ok((await headerItems.evaluateAll(es=>es.filter(e=>e.offsetWidth&&e.offsetHeight).map(e=>e.dataset.buildState))).every(state=>state==='waiting'));
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(100);
  assert.equal(await page.locator('.site-header').evaluate(e=>getComputedStyle(e).visibility),'hidden','returning to the header starts its construction rather than showing it already finished');
  await page.screenshot({path:`/tmp/header-${mobile?'mobile':'desktop'}-empty.png`});
  await page.waitForFunction(()=>document.querySelector('.site-header').dataset.buildState==='done',null,{timeout:20000});
  assert.notEqual(await page.locator('.brand').getAttribute('data-build-state'),'done','the logo is still a separate job after the header surface');
  await page.waitForFunction(()=>{const q=Number(document.querySelector('.brand').style.getPropertyValue('--reveal'));return q>0&&q<1;},null,{timeout:10000});
  const nav=page.locator('nav a').first();
  // Native anchor focus (or a pointer focus) must not finish every item in the header.
  await nav.dispatchEvent('focusin');
  assert.ok(await page.locator('.site-header .scroll-building').count()>0);
  assert.notEqual(await page.locator('.brand').getAttribute('data-build-state'),'done');
  // Once a menu item is visible, keyboard focus can finish that item, not its siblings.
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('nav a')).visibility==='visible');
  await page.keyboard.press('Shift');await nav.focus();
  assert.equal(await nav.getAttribute('data-build-state'),'done');
  assert.notEqual(await page.locator('nav a').nth(3).getAttribute('data-build-state'),'done');
  await page.waitForFunction(()=>!document.querySelector('.site-header .scroll-building'),null,{timeout:15000});
  const completed=await headerItems.evaluateAll(es=>es.map(e=>e.dataset.buildState));assert.ok(completed.every(state=>state==='done'));
  await page.evaluate(()=>scrollTo({top:1800,behavior:'instant'}));await page.waitForTimeout(50);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(50);
  assert.deepEqual(await headerItems.evaluateAll(es=>es.map(e=>e.dataset.buildState)),completed,'completed header content stays readable on reverse scroll');
  await context.close();
 }
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: black header before script load on #skills, no unseen header/hero completion, staged logo/menu/status on desktop/mobile, pointer/native focus does not reveal siblings, keyboard focus and reverse scroll.');
})().catch(e=>{console.error(e);process.exit(1)});
