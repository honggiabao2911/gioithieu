const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8000';
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:390,height:844},acceptDownloads:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await p.locator('#chat-launcher').click();await p.locator('#show-calendar').click();
 await p.locator('#calendar-new').click();const form=p.locator('#calendar-form');
 await form.locator('[name=title]').fill('Học Python');await form.locator('[name=date]').fill('2030-05-20');await form.locator('[name=time]').fill('09:00');await form.locator('[name=duration]').fill('45');await form.locator('[name=notes]').fill('Ôn tập vòng lặp');
 await form.locator('[type=submit]').click();assert.match(await p.locator('#calendar-status').innerText(),/Đã lưu/);assert.equal(await p.locator('.calendar-event').count(),1);
 await p.locator('.calendar-event button').filter({hasText:'Sửa'}).click();await form.locator('[name=title]').fill('Python nâng cao');await form.locator('[type=submit]').click();
 await p.locator('#calendar-search').fill('không có');assert.equal(await p.locator('.calendar-event').count(),0);await p.locator('#calendar-search').fill('Python');assert.equal(await p.locator('.calendar-event').count(),1);
 const downloadPromise=p.waitForEvent('download');await p.locator('#calendar-export').click();const download=await downloadPromise;const ics=fs.readFileSync(await download.path(),'utf8');assert.match(ics,/BEGIN:VEVENT/);assert.match(ics,/DTSTART:20300520T020000Z/);assert.match(ics,/DTEND:20300520T024500Z/);
 await p.reload();await p.locator('#chat-launcher').click();await p.locator('#show-calendar').click();assert.equal(await p.locator('.calendar-event').count(),1);assert.match(await p.locator('.calendar-event strong').innerText(),/Python nâng cao/);
 await p.locator('.calendar-event button').filter({hasText:'Xóa'}).click();assert.equal(await p.locator('.calendar-event').count(),0);
 // Simulate unavailable device storage; never claim a successful save.
 await p.evaluate(()=>{const save=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hb-calendar')throw new DOMException('full','QuotaExceededError');return save.call(this,k,v);};});
 await p.locator('#calendar-new').click();await form.locator('[name=title]').fill('Không lưu được');await form.locator('[name=date]').fill('2030-05-20');await form.locator('[name=time]').fill('09:00');await form.locator('[type=submit]').click();assert.match(await p.locator('#calendar-status').innerText(),/Chưa lưu/);assert.equal(await p.locator('.calendar-event').count(),0);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await b.close();console.log('PASS: local calendar create/edit/search/delete, persistence, real ICS download with UTC instants, failed-save honesty, mobile layout.');
})().catch(e=>{console.error(e);process.exit(1)});
