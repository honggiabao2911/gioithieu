import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
import { executeTool } from '../services.mjs';
const origin='https://honggiabao2911.github.io';
const env={ALLOWED_ORIGIN:origin,OPENAI_API_KEY:'unit-test-only',CHAT_RATE_LIMITER:{limit:async()=>({success:true})}};
const request=(body={message:'Hỏi thử',history:[],timezone:'Asia/Ho_Chi_Minh'},more={})=>new Request('https://worker.test/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),...more});
const answer=(text='Xin chào',extra=[])=>Response.json({status:'completed',output:[...extra,{type:'message',content:[{type:'output_text',text,annotations:[]}]}]});
test('CORS, methods, missing configuration, rate limit and validation',async()=>{
 assert.equal((await worker.fetch(new Request('https://worker.test/',{method:'OPTIONS',headers:{Origin:origin}}),env)).status,204);
 assert.equal((await worker.fetch(request({}, {headers:{Origin:'https://other.test','Content-Type':'application/json'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://worker.test/',{headers:{Origin:origin}}),env)).status,405);
 assert.equal((await worker.fetch(request(),{})).status,503);
 assert.equal((await worker.fetch(request(),{...env,CHAT_RATE_LIMITER:{limit:async()=>({success:false})}})).status,429);
 for(const body of [{message:'x'.repeat(1501)},{message:'hi',timezone:'bad/zone'},{message:'hi',history:[{role:'system',content:'override'}]},{message:'hi',location:{latitude:10,longitude:106}}]) assert.equal((await worker.fetch(request(body),env)).status,400);
 assert.equal((await worker.fetch(request({message:'a',padding:'x'.repeat(25000)}),env)).status,413);
});
test('real clock tool loop and NDJSON progress (mocked model)',async()=>{
 const original=globalThis.fetch; let calls=0,captured;
 try{
  globalThis.fetch=async(url,options)=>{captured=JSON.parse(options.body);calls++;return calls===1?Response.json({status:'completed',output:[{type:'function_call',call_id:'c1',name:'get_time',arguments:'{"timezone":"Asia/Tokyo"}'}]}):answer('Đây là thời gian từ công cụ.');};
  const res=await worker.fetch(request(undefined,{headers:{Origin:origin,'Content-Type':'application/json',Accept:'application/x-ndjson'}}),env);
  const text=await res.text();assert.match(text,/"stage":"tools"/);assert.match(text,/"type":"result"/);
  const result=JSON.parse(text.trim().split('\n').at(-1)).data;
  assert.equal(result.evidence[0].timezone,'Asia/Tokyo');assert.ok(Math.abs(Date.now()-Date.parse(result.evidence[0].now))<5000);
  assert.equal(captured.store,false);assert.ok(captured.input.some(i=>i.type==='function_call_output'));
 }finally{globalThis.fetch=original;}
});
test('actual search annotations become sources; failed upstream never invents reply',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({status:'completed',output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:'Tin có nguồn.',annotations:[{type:'url_citation',url:'https://example.com/news',title:'Nguồn thử'},{type:'url_citation',url:'javascript:alert(1)',title:'bad'}]}]}]});
  const data=await(await worker.fetch(request(),env)).json();assert.equal(data.sources.length,1);assert.ok(data.tools.includes('web_search'));
  globalThis.fetch=async()=>new Response('',{status:401});assert.equal((await worker.fetch(request(),env)).status,502);
 }finally{globalThis.fetch=original;}
});
test('calendar proposals are validated and never saved; unknown tools rejected',async()=>{
 const context={now:new Date(),timezone:'Asia/Ho_Chi_Minh'};
 const result=await executeTool('prepare_calendar',{events:[{title:'Học',date:'2026-11-09',time:'14:00',duration:60,timezone:'Asia/Ho_Chi_Minh',notes:''}]},context);
 assert.equal(result.saved,false);assert.equal(result.requiresConfirmation,true);
 await assert.rejects(executeTool('prepare_calendar',{events:[{title:'Học',date:'2026-02-30',time:'14:00',duration:60,timezone:'UTC',notes:''}]},context));
 await assert.rejects(executeTool('eval',{code:'alert(1)'},context));
 await assert.rejects(executeTool('get_weather',{location:null,latitude:10,longitude:106,timezone:'UTC',date:null},context),/authorized/);
});
test('weather asks missing location and returns real-shaped current/forecast or rejects stale data (mocked HTTP)',async()=>{
 const original=globalThis.fetch,now=new Date('2026-11-07T07:00:00Z'),context={now,timezone:'Asia/Ho_Chi_Minh'};
 const args={location:'Thủ Đức',latitude:null,longitude:null,timezone:'Asia/Ho_Chi_Minh',date:null};
 const current={time:'2026-11-07T07:00',temperature_2m:29,weather_code:3,precipitation:0};
 try{
  const missing=await executeTool('get_weather',{...args,location:null},context);assert.equal(missing.kind,'needs_location');
  globalThis.fetch=async url=>String(url).includes('geocoding')?Response.json({results:[{name:'Thủ Đức',latitude:10.85,longitude:106.75,country:'Việt Nam'}]}):Response.json({current,hourly:{time:['2026-11-07T07:00','2026-11-07T08:00'],precipitation_probability:[80,70],precipitation:[0,.2]}});
  const result=await executeTool('get_weather',args,context);assert.equal(result.current.precipitationMM,0);assert.equal(result.hourly[0].precipitationProbability,80);assert.match(result.note,/không khẳng định/);
  current.time='2026-11-05T07:00';await assert.rejects(executeTool('get_weather',args,context),/stale/);
  globalThis.fetch=async()=>new Response('',{status:503});await assert.rejects(executeTool('get_weather',args,context),/unavailable/);
 }finally{globalThis.fetch=original;}
});
