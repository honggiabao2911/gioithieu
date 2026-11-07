const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8000/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[];
 if(process.env.TOUR_PART!=='tail'){
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 assert.ok(await page.locator('html').evaluate(e=>e.classList.contains('intro-blank')),'first paint is covered by a solid black screen');
 assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e,'::before').backgroundColor),'rgb(0, 0, 0)');
 assert.equal(await page.locator('#hero-title').evaluate(e=>e.style.getPropertyValue('--reveal')),'0');
 await page.screenshot({path:'/tmp/portfolio-black-intro.png'});
 await page.waitForTimeout(500);
 assert.equal(await page.locator('#hero-title').evaluate(e=>e.style.getPropertyValue('--reveal')),'0','nothing builds behind the blank intro');
 await page.waitForFunction(()=>Number(document.querySelector('#hero-title').style.getPropertyValue('--reveal'))>0,null,{timeout:10000});
 assert.equal(await page.evaluate(()=>scrollY),0,'stay still while constructing the first viewport');
 const layout=await page.locator('main').evaluate(e=>e.offsetHeight);
 assert.ok(await page.locator('#projects .scroll-building').count()>0,'later sections remain unbuilt');
 await page.waitForFunction(()=>scrollY>60,null,{timeout:35000});
 assert.equal(await page.locator('#hero-title').getAttribute('data-build-state'),'done','the first viewport finishes before scrolling');
 assert.equal(await page.locator('.site-header').getAttribute('data-build-state'),'done');
 await page.mouse.wheel(0,0);
 const stopped=await page.evaluate(()=>scrollY);await page.waitForTimeout(2800);
 assert.equal(await page.evaluate(()=>scrollY),stopped,'wheel input cancels scrolling without a delayed restart');
 assert.equal(await page.locator('body').getAttribute('data-tour'),'off');
 assert.ok(await page.locator('#tour-controls').isHidden());
 assert.equal(await page.locator('main').evaluate(e=>e.offsetHeight),layout,'building and automatic scrolling preserve layout');
 await page.locator('#swarm-controls summary').click();await page.locator('#tour-replay').click();
 assert.equal(await page.evaluate(()=>scrollY),0);assert.ok(await page.locator('html').evaluate(e=>e.classList.contains('intro-blank')));
 await page.waitForFunction(()=>!document.documentElement.classList.contains('intro-blank'));
 await page.locator('#tour-stop').click();assert.equal(await page.locator('body').getAttribute('data-tour'),'off');
 await page.keyboard.press('Tab');
 assert.deepEqual(errors,[]);await page.close();
 console.log('PASS: real-time black intro, paced first viewport, automatic scroll, cancellation and replay.');

 // Speed up the browser clock for an end-to-end completion check, using the real engine.
 const full=await browser.newPage({viewport:{width:1440,height:1000}});full.on('pageerror',e=>errors.push(e.message));
 await full.clock.install();await full.goto(base,{waitUntil:'networkidle'});
 let reachedBottom=false;
 for(let n=0;n<60;n++){
  await full.clock.runFor(10000);
  if(await full.locator('body').getAttribute('data-tour')==='off'){reachedBottom=true;break;}
 }
 assert.ok(reachedBottom,'the tour reaches its natural end');
 assert.ok(await full.evaluate(()=>scrollY+innerHeight>=document.documentElement.scrollHeight-3),'ends at the bottom, not halfway');
 assert.equal(await full.locator('.scroll-building').count(),0,'all content is finished at the end');
 await full.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await full.clock.runFor(2000);
 assert.equal(await full.locator('#hero-title').getAttribute('data-build-state'),'done','reverse scroll preserves content');
 assert.equal(await full.evaluate(()=>scrollY),0,'the tour does not restart itself');await full.close();
 console.log('PASS: complete automatic tour with accelerated browser clock; all content built and reverse scroll preserved.');
 }

 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));await m.goto(base);
 await m.waitForFunction(()=>document.body.dataset.tour==='building');
 assert.equal(await m.locator('.living-cursor').count(),2);await m.touchscreen.tap(200,200);
 assert.equal(await m.locator('body').getAttribute('data-tour'),'off','touch takes control immediately');
 await m.waitForTimeout(100);assert.equal(await m.evaluate(()=>scrollY),0);await mobile.close();

 const deep=await browser.newPage();await deep.goto(base+'#projects');
 assert.equal(await deep.locator('body').getAttribute('data-tour'),'off');
 assert.ok(!await deep.locator('html').evaluate(e=>e.classList.contains('intro-blank')));
 await deep.waitForFunction(()=>Math.abs(document.querySelector('#projects').getBoundingClientRect().top-parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop))<3);
 const anchorY=await deep.evaluate(()=>scrollY);await deep.waitForTimeout(1800);assert.ok(Math.abs(await deep.evaluate(()=>scrollY)-anchorY)<4,'direct links keep their destination, allowing the final pixels of native smooth scrolling');await deep.close();
 const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(base);
 assert.equal(await reduced.locator('.scroll-building').count(),0);assert.equal(await reduced.locator('body').getAttribute('data-tour'),'off');
 assert.ok(!await reduced.locator('html').evaluate(e=>e.classList.contains('intro-blank')));await reduced.close();

 // Fail-open first-paint guard, even if the main animation script cannot load.
 const failed=await browser.newPage();await failed.route('**/app.js*',r=>r.abort());await failed.goto(base);
 await failed.waitForFunction(()=>!document.documentElement.classList.contains('intro-blank'),null,{timeout:6000});
 assert.equal(await failed.locator('h1').evaluate(e=>getComputedStyle(e).visibility),'visible');
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: mobile touch, deep links, reduced motion and failed-script fallback.');
})().catch(e=>{console.error(e);process.exit(1)});
