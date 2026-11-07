const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base + '/',{waitUntil:'networkidle'});

 const heights=await page.locator('main').evaluate(e=>e.getBoundingClientRect().height);
 assert.equal(await page.locator('.project-card').count(),4);
 for(let y=0;y<5500;y+=140){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(20)}
 const complete=await page.locator('#about .constructing').count();assert.equal(complete,0);
 await page.evaluate(()=>scrollTo({top:800,behavior:'instant'}));await page.waitForTimeout(50);assert.equal(await page.locator('#about .constructing').count(),0);
 await page.locator('#replay').click();await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>scrollY),0);assert.ok(await page.locator('#about .constructing').count()>0);
 // Pausing scroll pauses cursor and construction progress.
 await page.evaluate(()=>scrollTo({top:110,behavior:'instant'}));await page.waitForTimeout(60);
 const state=()=>page.locator('#home .virtual-cursor').evaluateAll(es=>es.map(e=>e.getAttribute('style')));
 const before=await state();await page.waitForTimeout(120);assert.deepEqual(await state(),before);

 await page.locator('#effects-toggle').click();assert.equal(await page.locator('.constructing').count(),0);
 assert.equal(await page.locator('main').evaluate(e=>e.getBoundingClientRect().height),heights);

 await page.locator('#effects-toggle').click();
 await page.goto(base + '/#projects');await page.waitForTimeout(60);assert.equal(await page.locator('#projects .constructing').count(),0);assert.equal(await page.locator('#about .constructing').count(),0);
 await page.goto(base + '/');await page.locator('#contact a').first().focus();await page.waitForTimeout(30);assert.equal(await page.locator('#contact .constructing').count(),0);
 for(const width of [320,375,390,768,1024,1440]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(60);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#replay').click();await page.locator('#effects-toggle').click();
 // Exercise construction itself on a narrow screen, including resize while active.
 await page.locator('#effects-toggle').click();
 for(let y=0;y<6500;y+=180){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(10)}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#effects-toggle').click();
 await page.reload();assert.equal(await page.locator('#effects-toggle').getAttribute('aria-pressed'),'false');
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const p2=await nojs.newPage();await p2.goto(base + '/');assert.equal(await p2.locator('.constructing').count(),0);assert.ok(await p2.locator('h1').isVisible());assert.ok(await p2.locator('.experience-controls').isHidden());
 const reduced=await browser.newContext({reducedMotion:'reduce'});const p3=await reduced.newPage();await p3.goto(base + '/');assert.equal(await p3.locator('.constructing').count(),0);assert.equal(await p3.locator('#effects-toggle').getAttribute('aria-pressed'),'false');
 assert.deepEqual(errors,[]);console.log('PASS: 4 projects; forward/reverse/fast scroll; pause; replay; effects toggle + persistence; stable layout; deep links; keyboard focus; no overflow at 6 sizes; no-JS; reduced motion; no JS errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
