(() => {
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const controls=document.getElementById('swarm-controls'), toggle=document.getElementById('effects-toggle');
 const layer=document.createElement('div');layer.className='swarm-layer';layer.setAttribute('aria-hidden','true');
 const canvas=document.createElement('canvas');layer.append(canvas);document.body.append(layer);const ctx=canvas.getContext('2d');
 const colors=['#c4f46d','#a5c6ff','#e4b2f7','#88d9c4','#edcb8c','#c7ccff'];
 const settings={enabled:true,activity:'normal',follow:false,speed:'slow'};
 const buildAssist=document.getElementById('build-assist');
 const tourControls=document.getElementById('tour-controls');
 const tour={phase:'off',until:0,start:0,from:0,target:0,hiddenAt:0};
 try{const saved=JSON.parse(localStorage.getItem('hb-display-v6')||'null');if(saved){for(const k of ['enabled','follow'])if(typeof saved[k]==='boolean')settings[k]=saved[k];if(['light','normal','lively'].includes(saved.activity))settings.activity=saved.activity;if(['slow','slower','quick'].includes(saved.speed))settings.speed=saved.speed;}}catch{}
 let width=innerWidth,height=innerHeight,agents=[],items=[],raf=0,previous=0,dirty=true,clock=0,lastPointer=-100;
 let pointer={x:width/2,y:height/2,known:false};const subscribers=new Set();
 const on=()=>settings.enabled&&!reduced.matches;
 function save(){try{localStorage.setItem('hb-display-v6',JSON.stringify(settings));}catch{}}
 function finish(item){item.done=true;item.q=1;item.owner=null;item.el.dataset.buildState='done';item.el.classList.remove('scroll-building');item.el.style.removeProperty('--reveal');item.el.style.removeProperty('clip-path');}
 function geometry(el){let x=0,y=0,node=el;while(node){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent;}return{x,y,w:el.offsetWidth,h:el.offsetHeight};}
 function cache(){items.forEach(item=>{item.box=geometry(item.el);});dirty=false;}
 function density(){return width<640?{light:2,normal:2,lively:3}[settings.activity]:{light:3,normal:4,lively:6}[settings.activity];}
 function resize(){width=innerWidth;height=innerHeight;const r=Math.min(devicePixelRatio||1,1.5);canvas.width=width*r;canvas.height=height*r;ctx?.setTransform(r,0,0,r,0,0);items.forEach(i=>{i.owner=null;});agents.forEach(a=>a.el.remove());agents=[];
  for(let i=0;i<density();i++){const el=document.createElement('div');el.className='virtual-cursor living-cursor';el.style.color=colors[i];el.innerHTML='<svg viewBox="0 0 24 30"><path d="M2 2v23l6-6 5 10 5-3-5-9h9Z"/></svg><span><b></b></span>';layer.append(el);agents.push({el,id:i,x:width/2,y:height/2,vx:0,vy:0});}
  document.getElementById('team-count').textContent=agents.length;dirty=true;schedule();
 }
 function reset(){
  document.querySelectorAll('.site-header,.section-meta,.hero-bottom,.interest-strip,.section-label,.skill-group,.contact-confirm,.eyebrow').forEach(el=>{el.classList.add('build-item','build-chrome');if(!el.dataset.kind)el.dataset.kind='frame';});
  items=[...document.querySelectorAll('.build-item')].map((el,i)=>({el,kind:el.dataset.kind||'type',q:0,elapsed:0,done:false,owner:null,box:geometry(el),minor:el.classList.contains('build-chrome')&&!el.classList.contains('site-header'),order:i}));
  // Put the name and portrait to work immediately; decorative labels use shorter jobs.
  items.sort((a,b)=>{const rank=x=>x.el.id==='hero-title'?0:x.el.classList.contains('portrait')?1:2;return rank(a)-rank(b)||a.order-b.order;});
  items.forEach(i=>{i.el.classList.add('scroll-building');i.el.style.setProperty('--reveal',0);i.el.style.removeProperty('clip-path');i.el.dataset.buildState='waiting';});dirty=true;
 }
 function duration(item){return item.minor?{quick:1.2,slow:2.2,slower:3}[settings.speed]:{quick:2.8,slow:6.2,slower:9}[settings.speed];}
 function inView(item){const y=item.box.y-scrollY;return y<height*.91&&y+item.box.h>35;}
 function finishVisible(){if(dirty)cache();items.filter(inView).forEach(finish);schedule();}

 function tourPhase(phase){tour.phase=phase;document.body.dataset.tour=phase;}
 function stopTour(){tourPhase('off');tour.until=0;clearTimeout(window.portfolioBootFallback);document.documentElement.classList.remove('intro-blank');tourControls.hidden=true;schedule();}
 function startTour(){
  if(!on())return;
  clearTimeout(window.portfolioBootFallback);document.documentElement.classList.add('intro-blank');
  scrollTo({top:0,left:0,behavior:'instant'});tourPhase('intro');tour.until=performance.now()+1000;tourControls.hidden=true;dirty=true;schedule();
 }
 // Each viewport finishes before the next small, eased scroll. No queued scrolls.
 function tourTransition(stamp){
  if(tour.phase==='intro'){
   if(stamp<tour.until)return true;
   document.documentElement.classList.remove('intro-blank');tourPhase('building');tour.until=0;tourControls.hidden=false;
  }
  if(tour.phase==='moving'){
   const t=clamp((stamp-tour.start)/2400,0,1),e=t*t*(3-2*t);
   scrollTo({top:tour.from+(tour.target-tour.from)*e,behavior:'instant'});
   if(t>=1){tourPhase('building');tour.until=0;dirty=true;}
   return true;
  }
  return false;
 }
 function nextTourStep(stamp,building){
  if(tour.phase!=='building')return;
  if(building){tour.until=0;return;}
  if(!tour.until){tour.until=stamp+1600;return;}
  if(stamp<tour.until)return;
  const limit=Math.max(0,document.documentElement.scrollHeight-height);
  if(scrollY>=limit-2){stopTour();return;}
  tour.from=scrollY;tour.target=Math.min(limit,scrollY+height*.68);tour.start=stamp;tourPhase('moving');
 }

 function parentReady(item){const parent=item.el.parentElement.closest('.build-item');return !parent||!items.some(i=>i.el===parent&&!i.done);}
 function paint(item){
  const t=clamp(item.elapsed/duration(item),0,1),q=clamp((t-.38)/.54,0,1),b={...item.box,x:item.box.x-scrollX,y:item.box.y-scrollY};
  item.q=q;item.el.style.setProperty('--reveal',q);
  const color=colors[item.owner],frame=clamp((t-.14)/.24,0,1);
  let tip,stage,label;
  if(ctx){ctx.strokeStyle=color+'20';ctx.lineWidth=1;ctx.setLineDash([4,6]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.setLineDash([]);ctx.strokeStyle=color+'bb';ctx.fillStyle=color;}
  if(t<.14){
   stage='approach';label='Đến vị trí';const u=1-Math.pow(1-t/.14,2),from=item.approachFrom||{x:b.x-30,y:b.y-25};tip={x:from.x+(b.x-from.x)*u,y:from.y+(b.y-from.y)*u};
  }else if(t<.38){
   stage='frame';label='Dựng khung';tip={x:b.x+b.w*frame,y:b.y+b.h*frame};if(ctx)ctx.strokeRect(b.x,b.y,b.w*frame,b.h*frame);
  }else{
   stage=t>.92?'settle':'content';label=t>.92?'Hoàn tất':{type:'Viết từng dòng',frame:'Đưa nội dung vào',place:'Đặt ảnh',align:'Căn chỉnh'}[item.kind];
   if(item.kind==='type'){
    const line=parseFloat(getComputedStyle(item.el).lineHeight)||24,n=Math.max(1,Math.ceil(b.h/line)),at=q*n,row=Math.min(n-1,Math.floor(at)),x=at-row;
    item.el.style.clipPath=`polygon(0 0,100% 0,100% ${row*100/n}%,${x*100}% ${row*100/n}%,${x*100}% ${(row+1)*100/n}%,0 ${(row+1)*100/n}%)`;
    tip={x:b.x+b.w*x,y:b.y+Math.min(b.h,(row+.5)*line)};
    if(ctx){ctx.beginPath();ctx.moveTo(b.x,tip.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();}
   }else if(item.kind==='frame'){tip={x:b.x+b.w*q,y:b.y+b.h*q};if(ctx)ctx.strokeRect(b.x,b.y,b.w*q,b.h*q);}
   else if(item.kind==='align'){tip={x:b.x+b.w*q,y:b.y+b.h*.5};if(ctx){ctx.beginPath();ctx.moveTo(b.x,tip.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();}}
   else {tip={x:b.x+b.w*.72+(1-q)*24,y:b.y+b.h*.28-(1-q)*16};if(ctx)ctx.strokeRect(b.x+(1-q)*24,b.y-(1-q)*16,b.w,b.h);}
  }
  item.el.dataset.buildState=stage;
  if(ctx)ctx.fillRect(tip.x-3,tip.y-3,6,6);
  return{tip,stage,label};
 }
 function position(a,point,label){a.x=label?point.x:clamp(point.x,8,width-24);a.y=label?point.y:clamp(point.y,36,height-90);a.el.style.transform=`translate3d(${a.x}px,${a.y}px,0)`;a.el.style.opacity='1';a.el.dataset.state=label?'building':'follow';a.el.classList.toggle('has-label',Boolean(label)&&a.id===0&&width>=640);a.el.classList.toggle('label-left',a.x>width-150);a.el.querySelector('b').textContent=label||'';}
 function tick(stamp){raf=0;if(!on()||document.hidden)return;const dt=previous?Math.min((stamp-previous)/1000,.05):.016;previous=stamp;clock+=dt;if(dirty)cache();ctx?.clearRect(0,0,width,height);agents.forEach(a=>{a.el.style.opacity=0;});
  if(tourTransition(stamp)){layer.hidden=true;buildAssist.hidden=true;layer.dataset.phase=tour.phase==='intro'?'INTRO':'AUTO_SCROLLING';raf=requestAnimationFrame(safeTick);return;}
  const focused=document.activeElement;const protect=Boolean(focused?.closest('input,textarea,select,[contenteditable=true],.chat-panel')&&!focused.closest('#swarm-controls'))||Boolean(getSelection()?.toString());
  const occupied=new Set();let active=false;
  for(const item of items){if(item.done)continue;const top=item.box.y-scrollY,bottom=top+item.box.h;
   if(bottom<0){finish(item);continue;}
   if(top>height*.91||bottom<35){item.owner=null;continue;}
   if(!parentReady(item))continue;
   if(protect)continue;
   let owner=item.owner;
   if(owner===null||owner>=agents.length||occupied.has(owner)){owner=agents.findIndex(a=>!occupied.has(a.id));if(owner<0)continue;item.owner=owner;item.approachFrom={x:agents[owner].x,y:agents[owner].y};}
   occupied.add(owner);active=true;item.elapsed+=dt;
   const work=paint(item);position(agents[owner],work.tip,work.label);agents[owner].el.dataset.stage=work.stage;
   if(item.elapsed>=duration(item))finish(item);
  }
  if(settings.follow&&pointer.known&&!protect&&clock-lastPointer<2.5){agents.forEach(a=>{if(occupied.has(a.id))return;active=true;const angle=a.id*2.4,radius=85+a.id%2*30;const tx=pointer.x+Math.cos(angle)*radius,ty=pointer.y+Math.sin(angle)*radius*.65;a.vx=(a.vx+(tx-a.x)*dt*8)*Math.exp(-6*dt);a.vy=(a.vy+(ty-a.y)*dt*8)*Math.exp(-6*dt);position(a,{x:a.x+a.vx*dt,y:a.y+a.vy*dt},'');});}
  layer.hidden=protect||!active;
  const viewed=items.filter(inView);const building=viewed.some(i=>!i.done);buildAssist.hidden=protect||!building;
  if(building){const percent=Math.round(viewed.reduce((sum,i)=>sum+(i.done?1:i.q),0)/Math.max(1,viewed.length)*100);document.getElementById('view-build-meter').value=percent;document.getElementById('build-message').textContent=`Đang dựng vùng đang xem · ${percent}%`;}
  layer.dataset.phase=protect?'PAUSED':active?'SECTION_BUILDING':'RESTING';layer.dataset.clock=clock.toFixed(2);
  nextTourStep(stamp,building);
  subscribers.forEach(fn=>fn(stamp,dt));if(active||tour.phase!=='off')raf=requestAnimationFrame(safeTick);else previous=0;
 }
 function safeTick(stamp){try{tick(stamp);}catch(error){stopTour();items.forEach(finish);layer.hidden=true;settings.enabled=false;sync();console.error('Hiệu ứng đã dừng; nội dung vẫn hiển thị.',error);}}
 function schedule(){if(!raf&&on()&&!document.hidden)raf=requestAnimationFrame(safeTick);}
 function sync(){cancelAnimationFrame(raf);raf=0;previous=0;document.body.classList.toggle('effects-off',!on());toggle.setAttribute('aria-pressed',String(on()));document.getElementById('effects-state').textContent=on()?'Bật':'Tắt';document.getElementById('replay').disabled=reduced.matches;document.getElementById('tour-replay').disabled=reduced.matches;if(!on()){stopTour();items.forEach(finish);layer.hidden=true;buildAssist.hidden=true;ctx?.clearRect(0,0,width,height);}else schedule();}
 function completeSection(target){const section=target.closest('.scene')||target.closest('.site-header');if(section)items.filter(i=>section.contains(i.el)||i.el===section).forEach(finish);}
 window.PortfolioMotion=Object.freeze({active:on,subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},guide(id){const el=document.getElementById(id);if(!el||!['projects','about','contact','school'].includes(id))return;stopTour();el.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});}});
 document.getElementById('year').textContent=new Date().getFullYear();const avatar=document.querySelector('.portrait img');avatar.addEventListener('error',()=>avatar.hidden=true);if(avatar.complete&&!avatar.naturalWidth)avatar.hidden=true;
 controls.hidden=false;document.getElementById('build-speed').value=settings.speed;document.getElementById('activity').value=settings.activity;document.getElementById('follow-pointer').checked=settings.follow;
 toggle.addEventListener('click',()=>{if(reduced.matches)return;settings.enabled=!settings.enabled;if(settings.enabled)reset();save();sync();});
 document.getElementById('build-speed').addEventListener('change',e=>{const ratios=items.map(i=>i.elapsed/duration(i));settings.speed=e.target.value;items.forEach((i,n)=>{i.elapsed=ratios[n]*duration(i);});save();schedule();});
 document.getElementById('reveal-now').addEventListener('click',finishVisible);
 document.getElementById('activity').addEventListener('change',e=>{settings.activity=e.target.value;resize();save();});
 document.getElementById('follow-pointer').addEventListener('change',e=>{settings.follow=e.target.checked;save();schedule();});
 document.getElementById('replay').addEventListener('click',()=>{if(reduced.matches)return;settings.enabled=true;reset();save();sync();});
 document.getElementById('tour-stop').addEventListener('click',stopTour);
 document.getElementById('tour-replay').addEventListener('click',()=>{if(reduced.matches)return;settings.enabled=true;reset();save();sync();controls.open=false;startTour();});
 for(const event of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(event,e=>{if(tour.phase!=='off'&&(event==='wheel'||!e.target.closest?.('#tour-stop')))stopTour();},{passive:true,capture:true});
 window.addEventListener('scroll',()=>{dirty=true;schedule();},{passive:true});window.addEventListener('resize',()=>{if(tour.phase!=='intro')stopTour();resize();},{passive:true});window.addEventListener('pageshow',e=>{if(e.persisted)stopTour();dirty=true;sync();});document.addEventListener('visibilitychange',()=>{const now=performance.now();if(document.hidden)tour.hiddenAt=now;else if(tour.hiddenAt){const pause=now-tour.hiddenAt;tour.until+=pause;tour.start+=pause;tour.hiddenAt=0;}sync();});reduced.addEventListener('change',sync);
 window.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY,known:true};lastPointer=clock;if(settings.follow)schedule();},{passive:true});
 document.addEventListener('focusin',e=>{if(!e.target.closest('#tour-stop'))stopTour();completeSection(e.target);schedule();});
 document.addEventListener('focusout',schedule);document.addEventListener('selectionchange',schedule);
 window.addEventListener('hashchange',()=>{stopTour();dirty=true;schedule();});
 if('ResizeObserver'in window)new ResizeObserver(()=>{dirty=true;schedule();}).observe(document.querySelector('main'));
 reset();resize();if(location.hash){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target){const y=target.getBoundingClientRect().top+scrollY;items.filter(i=>i.box.y+i.box.h<y).forEach(finish);}}sync();
 if(on()&&!location.hash&&scrollY<2)startTour();else stopTour();
})();
