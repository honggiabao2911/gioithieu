/* Optional, on-device model. No API key and no inference server. Never auto-load. */
(() => {
 'use strict';
 let engine=null,worker=null,phase='off',revision=0,rejectLoad=null,rejectGeneration=null,loadedModel='';
 const $=id=>document.getElementById(id),status=$('local-ai-status'),enable=$('local-ai-enable'),disable=$('local-ai-disable');
 const scriptURL=new URL(document.currentScript.src);
 const moduleURL=new URL('assets/vendor/webllm-0.2.87.mjs',scriptURL).href;
 const workerURL=new URL('local-ai-worker.mjs',scriptURL);
 function update(state,text){phase=state;status.textContent=text;enable.disabled=['loading','ready','generating'].includes(state);disable.hidden=state==='off';disable.textContent=state==='loading'?'Hủy tải':'Tắt AI trên máy';document.dispatchEvent(new CustomEvent('portfolio-local-ai',{detail:{state}}));}
 function errorMessage(error){
  if(error?.name==='AbortError')return 'Đã hủy. Bạn vẫn có thể dùng chế độ cơ bản.';
  if(/gpu|adapter|device|shader|memory|buffer|limit/i.test(error?.message||''))return 'Thiết bị chưa đáp ứng WebGPU hoặc bộ nhớ cần thiết. Không có phí API; vẫn dùng được chế độ cơ bản.';
  return 'Chưa tải được mô hình. Hãy kiểm tra mạng và khả năng WebGPU; chưa có câu trả lời AI.';
 }
 async function stopModel(){revision++;rejectGeneration?.(new DOMException('Cancelled','AbortError'));rejectGeneration=null;rejectLoad?.(new DOMException('Cancelled','AbortError'));rejectLoad=null;const old=engine;engine=null;if(old){try{old.interruptGenerate();}catch{}}worker?.terminate();worker=null;loadedModel='';update('off','Đã tắt AI trên máy. Các công cụ khác vẫn dùng được.');}
 async function load(){
  if(phase!=='off')return;
  const token=++revision;update('loading','Đang kiểm tra WebGPU…');
  let timer;
  try{
   if(!isSecureContext||!navigator.gpu)throw new Error('WebGPU unavailable');
   const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('WebGPU adapter unavailable');if(token!==revision)return;
   const model=adapter.features.has('shader-f16')?'Qwen2.5-1.5B-Instruct-q4f16_1-MLC':'Qwen2.5-1.5B-Instruct-q4f32_1-MLC';
   const cancelled=new Promise((_,reject)=>{rejectLoad=reject;timer=setTimeout(()=>reject(new Error('Model download timed out')),600000);});
   const loading=(async()=>{
    const {CreateWebWorkerMLCEngine}=await import(moduleURL);if(token!==revision)throw new DOMException('Cancelled','AbortError');
    worker=new Worker(workerURL,{type:'module'});worker.addEventListener('error',()=>rejectLoad?.(new Error('WebGPU worker error')),{once:true});
    const modelEngine=await CreateWebWorkerMLCEngine(worker,model,{initProgressCallback:report=>{if(token!==revision)return;const percent=Number.isFinite(report.progress)?Math.max(0,Math.min(100,Math.round(report.progress*100))):0;const text=`Đang tải mô hình trên máy · ${percent}% · Có thể hủy bất cứ lúc nào.`;if(status.textContent!==text)status.textContent=text;}});
    if(token!==revision)throw new DOMException('Cancelled','AbortError');return modelEngine;
   })();
   engine=await Promise.race([loading,cancelled]);if(token!==revision)return;loadedModel=model;update('ready','AI trên máy đã sẵn sàng · Không gọi API trả phí. Có thể sai; không tự tra web.');
  }catch(error){if(token!==revision)return;worker?.terminate();worker=null;engine=null;update('off',errorMessage(error));}
  finally{clearTimeout(timer);if(token===revision)rejectLoad=null;}
 }
 async function generate(question,history,{signal}={}){
  if(!engine||phase!=='ready')throw new Error('Local model not ready');
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const current=engine;let rejectRequest;const cancelled=new Promise((_,reject)=>{rejectRequest=reject;rejectGeneration=reject;});const interrupt=()=>{current.interruptGenerate();rejectRequest(new DOMException('Cancelled','AbortError'));};signal?.addEventListener('abort',interrupt,{once:true});phase='generating';
  try{
   const recent=history.slice(-6).map(m=>({role:m.role,content:m.content.slice(0,900)}));while(recent.reduce((n,m)=>n+m.content.length,0)>3500)recent.shift();
   const zone=document.getElementById('chat-timezone').value;const time=window.PortfolioTools.timeData(zone);
   const messages=[{role:'system',content:'Bạn là Bảo Bot, trợ lý AI chạy trên máy, trả lời tiếng Việt thân thiện và ngắn gọn. Lắng nghe khi người dùng chia sẻ cảm xúc, hỏi nhẹ nhàng; không chẩn đoán hay nhận mình là chuyên gia. Bảo là Hồng Gia Bảo, tân sinh viên An ninh mạng iSPACE, cộng tác viên tuyển sinh, thích công nghệ/quay chụp/CapCut. Không bịa thông tin cá nhân. Bạn không có web hay dữ liệu thời tiết trực tiếp: các công cụ riêng của trang xử lý việc đó. Nếu không biết, nói rõ. Không thực thi mã hoặc nhận mình đã lưu lịch/nhắc việc. Khi được hỏi lập lịch, chỉ đưa dự thảo bằng văn bản, hỏi thông tin thiết yếu còn thiếu và nhắc khách tự lưu ở tab Lịch.'+` Ngày giờ thiết bị hiện tại: ${time.date} ${time.time} (${zone}).`},...recent,{role:'user',content:question.slice(0,1500)}];
   const result=await Promise.race([current.chat.completions.create({messages,temperature:.65,max_tokens:384,stream:false}),cancelled]);if(signal?.aborted||engine!==current)throw new DOMException('Cancelled','AbortError');
   const reply=result.choices?.[0]?.message?.content;if(typeof reply!=='string'||!reply.trim())throw new Error('Local model empty response');return reply.slice(0,12000);
  }finally{if(rejectGeneration===rejectRequest)rejectGeneration=null;signal?.removeEventListener('abort',interrupt);if(engine===current&&phase==='generating')phase='ready';}
 }
 enable.addEventListener('click',load);disable.addEventListener('click',stopModel);
 window.PortfolioLocalAI=Object.freeze({ready:()=>Boolean(engine&&phase==='ready'),state:()=>phase,generate,disable:stopModel,model:()=>loadedModel});
})();
