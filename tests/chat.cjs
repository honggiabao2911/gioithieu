const {chromium}=require('playwright');const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8000';
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const errors=[];
 const p=await b.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await p.locator('#chat-launcher').click();assert.match(await p.locator('#chat-mode').innerText(),/Thông tin Bảo/);
 await p.locator('#chat-input').fill('bảo là ai');await p.locator('#chat-send').click();assert.match(await p.locator('.chat-message').last().innerText(),/Hồng Gia Bảo.*iSPACE/);assert.doesNotMatch(await p.locator('.chat-message').last().innerText(),/Chưa kết nối/);await p.locator('#chat-clear').click();
 await p.locator('#chat-input').fill('Mấy giờ rồi?');await p.locator('#chat-send').click();assert.match(await p.locator('.chat-message').last().innerText(),/Asia\/Ho_Chi_Minh/);assert.match(await p.locator('.chat-message').last().innerText(),/đồng hồ thiết bị/);
 const expected=await p.evaluate(()=>PortfolioTools.timeData('Asia/Ho_Chi_Minh').time.slice(0,5));assert.ok((await p.locator('.chat-message').last().innerText()).includes(expected));
 await p.locator('#chat-clear').click();await p.locator('#chat-timezone').selectOption('Asia/Tokyo');await p.locator('#chat-input').fill('Mấy giờ rồi?');await p.locator('#chat-send').click();assert.match(await p.locator('.chat-message').last().innerText(),/Asia\/Tokyo/);
 await p.locator('#chat-clear').click();await p.locator('#chat-input').fill('Chiều nay có mưa không?');await p.locator('#chat-send').click();assert.match(await p.locator('.chat-message').last().innerText(),/thời tiết ở đâu/);
 assert.equal(await p.evaluate(()=>localStorage.getItem('hb-chat-v2')),null,'no history stored without opt-in');
 await p.reload();await p.locator('#chat-launcher').click();assert.equal(await p.locator('.chat-message.user').count(),0);
 await p.locator('#remember-chat').check();await p.locator('[data-question="Xem các dự án"]').click();await p.reload();await p.locator('#chat-launcher').click();assert.equal(await p.locator('.chat-message.user').count(),1);
 await p.locator('#remember-chat').uncheck();assert.equal(await p.evaluate(()=>localStorage.getItem('hb-chat-v2')),null);
 const create=async(handler)=>{
  const page=await b.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/config.js*',r=>r.fulfill({contentType:'application/javascript',body:'window.PORTFOLIO_CHAT_CONFIG={endpoint:"https://chat.test/"};'}));
  await page.route('https://chat.test/**',async route=>{
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Accept','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
   await handler(route,headers);
  });
  await page.goto(base);await page.locator('#chat-launcher').click();return page;
 };
 let retries=0;
 const fail=await create((route,headers)=>route.fulfill({status:++retries===1?429:200,headers,body:retries===1?'{"error":"too_many_requests"}':'{"reply":"Đã kết nối lại.","tools":[]}'}));await fail.locator('#chat-input').fill('Tin mới nhất hôm nay?');await fail.locator('#chat-send').click();await fail.waitForFunction(()=>!document.getElementById('chat-send').disabled);assert.match(await fail.locator('#chat-status').innerText(),/giới hạn/);assert.equal(await fail.locator('.chat-message.assistant').count(),1,'no invented fallback response');assert.ok(await fail.locator('#chat-retry').isVisible());await fail.locator('#chat-retry').click();await fail.waitForFunction(()=>!document.getElementById('chat-send').disabled);assert.match(await fail.locator('.chat-message').last().innerText(),/Đã kết nối lại/);
 const remote=await create((route,headers)=>route.fulfill({status:200,headers,body:JSON.stringify({reply:'Tin mới.\n- Mục thử\n```js\n<img src=x onerror=alert(1)>\n```',sources:[{url:'https://example.com/news',title:'Nguồn thử',accessedAt:new Date().toISOString()},{url:'javascript:alert(1)',title:'bad'}],tools:['web_search'],evidence:[{kind:'calendar_proposal',events:[{title:'Học Python',date:'2030-05-20',time:'14:00',duration:60,timezone:'Asia/Ho_Chi_Minh',notes:''}]}]})}));
 await remote.locator('#chat-input').fill('Lập lịch và tìm tài liệu Python');await remote.locator('#chat-send').click();await remote.waitForFunction(()=>!document.getElementById('chat-send').disabled);
 assert.match(await remote.locator('#chat-mode').innerText(),/AI đã kết nối/);assert.equal(await remote.locator('.chat-message img').count(),0);assert.equal(await remote.locator('.chat-sources a').count(),1);assert.equal(await remote.locator('.chat-message pre').count(),1);
 assert.equal(await remote.evaluate(()=>localStorage.getItem('hb-calendar')),null,'proposal must not auto-save');
 await remote.locator('.chat-action').filter({hasText:'Xem bản dự thảo'}).click();assert.match(await remote.locator('#calendar-preview').innerText(),/Chưa lưu/);assert.equal(await remote.evaluate(()=>localStorage.getItem('hb-calendar')),null);
 await remote.locator('#calendar-preview button').filter({hasText:'Xác nhận'}).click();assert.match(await remote.locator('#calendar-status').innerText(),/Đã lưu 1/);assert.equal(await remote.locator('.calendar-event').count(),1);
 const slow=await create(async(route,headers)=>{await new Promise(r=>setTimeout(r,1800));await route.fulfill({status:200,headers,body:'{"reply":"late"}'}).catch(()=>{});});await slow.locator('#chat-input').fill('Giải thích thuật toán A*');await slow.locator('#chat-send').click();await slow.locator('#chat-stop').click();await slow.waitForFunction(()=>!document.getElementById('chat-send').disabled);assert.match(await slow.locator('#chat-status').innerText(),/Đã dừng/);assert.equal(await slow.locator('.chat-message.assistant').count(),1);
 const streamed=await create((route,headers)=>route.fulfill({status:200,headers:{...headers,'Content-Type':'application/x-ndjson'},body:[{type:'progress',stage:'search'},{type:'result',data:{reply:'Dữ liệu công cụ thử nghiệm.',tools:['web_search'],sources:[]}}].map(e=>JSON.stringify(e)).join('\n')+'\n'}));await streamed.locator('#chat-input').fill('Tra cứu tin công nghệ mới nhất');await streamed.locator('#chat-send').click();await streamed.waitForFunction(()=>!document.getElementById('chat-send').disabled);assert.match(await streamed.locator('#chat-status').innerText(),/web_search/);
 assert.deepEqual(errors,[]);await b.close();console.log('PASS: real local time, missing-location question, correct local profile answers, opt-in history, honest API failure/retry, safe Markdown/sources, calendar preview/confirmation, stop.');
})().catch(e=>{console.error(e);process.exit(1)});
