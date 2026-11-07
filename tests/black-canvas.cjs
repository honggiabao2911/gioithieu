const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8000/';
function completelyBlack(buffer,label){
 const png=PNG.sync.read(buffer);let colored=0;
 for(let i=0;i<png.data.length;i+=4)if(png.data[i]||png.data[i+1]||png.data[i+2])colored++;
 assert.equal(colored,0,label);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const errors=[];
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+250)));
  completelyBlack(await page.screenshot({fullPage:true}),`the entire ${mobile?'mobile':'desktop'} document starts black, including the footer`);
  const layout=await page.locator('main').evaluate(e=>e.offsetHeight);
  await page.clock.runFor(1250);
  assert.ok(!await page.locator('html').evaluate(e=>e.classList.contains('intro-blank')),'intro overlay is already removed');
  assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 0, 0)');
  assert.equal(await page.locator('#hero-title').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  assert.equal(await page.locator('#chat-launcher').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  completelyBlack(await page.screenshot({fullPage:true,style:'.swarm-layer{visibility:hidden!important}'}),'without active cursor strokes, the actual document remains completely black after the overlay is gone');
  await page.clock.runFor(3000);
  const titleQ=Number(await page.locator('#hero-title').evaluate(e=>e.style.getPropertyValue('--reveal')));
  assert.ok(titleQ>0&&titleQ<1,'the name is only partially written, not shown in one frame');
  assert.equal(await page.locator('.portrait-image').getAttribute('data-build-state'),'waiting','the picture is a separate job after its frame');
  assert.equal(await page.locator('.portrait-image').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  assert.equal(await page.locator('main').evaluate(e=>e.offsetHeight),layout);
  await page.screenshot({path:`/tmp/black-canvas-${mobile?'mobile':'desktop'}-partial.png`});
  await page.mouse.wheel(0,0);await page.clock.runFor(20);
  await page.evaluate(()=>scrollTo({top:document.querySelector('#projects').getBoundingClientRect().top+scrollY,behavior:'instant'}));
  await page.clock.runFor(16);
  completelyBlack(await page.screenshot({style:'.swarm-layer,.construction-ui{visibility:hidden!important}'}),'a new unbuilt viewport is black, not filled with preset project surfaces');
  await context.close();
 }
 const legacy=await browser.newPage();await legacy.addInitScript(()=>localStorage.setItem('hb-display-v9',JSON.stringify({enabled:true,follow:true,speed:'quick',activity:'light'})));
 await legacy.goto(base);assert.equal(await legacy.locator('.living-cursor').count(),5,'upgrading a stored light setting uses the new five-cursor default');assert.equal(await legacy.locator('#build-speed').inputValue(),'slow');assert.equal(await legacy.locator('#follow-pointer').isChecked(),false,'old flying cursors are not carried into the new construction experience');
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: pixel-verified black whole document before and after intro, black future viewport, incremental text, frame before image, desktop/mobile, stable layout and migration of old flying cursors.');
})().catch(e=>{console.error(e);process.exit(1)});
