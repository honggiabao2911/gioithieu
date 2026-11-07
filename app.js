(() => {
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const ease=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const controls=document.getElementById('swarm-controls'), toggle=document.getElementById('effects-toggle');
 const layer=document.createElement('div');layer.className='swarm-layer';layer.setAttribute('aria-hidden','true');
 const canvas=document.createElement('canvas');layer.append(canvas);document.body.append(layer);const ctx=canvas.getContext('2d');
 const colors=['#c4f46d','#a5c6ff','#e4b2f7','#88d9c4','#edcb8c','#c7ccff','#f4a88a','#8ad5ef'];
 const teamSize=8;
 const settings={enabled:true,follow:false,speed:'slow'};
 const buildAssist=document.getElementById('build-assist');
 const tourControls=document.getElementById('tour-controls');
 const tour={phase:'off',until:0,start:0,from:0,target:0,hiddenAt:0};
 try{const current=localStorage.getItem('hb-display-v12'),saved=JSON.parse(current||localStorage.getItem('hb-display-v9')||localStorage.getItem('hb-display-v6')||'null');if(saved){if(typeof saved.enabled==='boolean')settings.enabled=saved.enabled;if(current){if(typeof saved.follow==='boolean')settings.follow=saved.follow;if(['slow','slower','quick'].includes(saved.speed))settings.speed=saved.speed;}}}catch{}
 let width=innerWidth,height=innerHeight,agents=[],items=[],raf=0,previous=0,dirty=true,clock=0,lastPointer=-100;
 let pointer={x:width/2,y:height/2,known:false},keyboardNavigation=false;const subscribers=new Set();
 const on=()=>settings.enabled&&!reduced.matches;
 function save(){try{localStorage.setItem('hb-display-v12',JSON.stringify(settings));}catch{}}
 function finish(item){item.done=true;item.q=1;item.owner=null;item.el.dataset.buildState='done';item.el.classList.remove('scroll-building');item.el.style.removeProperty('--reveal');item.el.style.removeProperty('clip-path');}
 function geometry(el){let x=0,y=0,node=el;while(node){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent;}return{x,y,w:el.offsetWidth,h:el.offsetHeight};}
 function textLines(item){
  if(item.lines&&item.lineWidth===item.box.w)return item.lines;
  const base=item.el.getBoundingClientRect(),walker=document.createTreeWalker(item.el,NodeFilter.SHOW_TEXT),range=document.createRange(),lines=[];
  let node;while((node=walker.nextNode())){if(!node.textContent.trim())continue;range.selectNodeContents(node);for(const rect of range.getClientRects()){
   if(!rect.width||!rect.height)continue;const y=rect.top+rect.height/2-base.top;
   let line=lines.find(l=>Math.abs(l.mid-y)<Math.min(8,rect.height*.3));
   if(!line){line={left:rect.left-base.left,right:rect.right-base.left,top:rect.top-base.top-2,bottom:rect.bottom-base.top+2,mid:y};lines.push(line);}
   else{line.left=Math.min(line.left,rect.left-base.left);line.right=Math.max(line.right,rect.right-base.left);line.top=Math.min(line.top,rect.top-base.top-2);line.bottom=Math.max(line.bottom,rect.bottom-base.top+2);}
  }}
  lines.sort((a,b)=>a.top-b.top);item.lines=lines.length?lines:[{left:0,right:item.box.w,top:0,bottom:item.box.h,mid:item.box.h/2}];item.lineWidth=item.box.w;return item.lines;
 }
 function cache(){items.forEach(item=>{item.box=geometry(item.el);});dirty=false;}
 function resize(){width=innerWidth;height=innerHeight;const r=Math.min(devicePixelRatio||1,1.5);canvas.width=width*r;canvas.height=height*r;ctx?.setTransform(r,0,0,r,0,0);items.forEach(i=>{i.owner=null;});agents.forEach(a=>a.el.remove());agents=[];
  for(let i=0;i<teamSize;i++){const el=document.createElement('div');el.className='virtual-cursor living-cursor';el.style.color=colors[i];el.innerHTML='<svg viewBox="0 0 24 30"><path d="M2 2v23l6-6 5 10 5-3-5-9h9Z"/></svg><span><b></b></span>';layer.append(el);agents.push({el,id:i,x:width/2,y:height/2,vx:0,vy:0});}
  document.getElementById('team-count').textContent=agents.length;dirty=true;schedule();
 }
 function reset(){
  document.documentElement.classList.add('construction-mode');document.documentElement.classList.remove('construction-ui-ready');
  document.querySelectorAll('.site-header nav a').forEach(el=>{el.classList.add('build-item','build-chrome');el.dataset.kind='align';});
  document.querySelectorAll('.site-header,.section-meta,.hero-bottom,.interest-strip,.section-label,.skill-group,.contact-confirm,.eyebrow').forEach(el=>{el.classList.add('build-item','build-chrome');if(!el.dataset.kind)el.dataset.kind='frame';});
  items=[...document.querySelectorAll('.build-item')].map((el,i)=>({el,kind:el.dataset.kind||'type',q:0,elapsed:0,done:false,visited:false,owner:null,box:geometry(el),minor:el.classList.contains('build-chrome')&&!el.classList.contains('site-header'),order:i}));
  // Put the name and portrait to work immediately; decorative labels use shorter jobs.
  items.sort((a,b)=>{const rank=x=>x.el.id==='hero-title'?0:x.el.classList.contains('portrait')?1:2;return rank(a)-rank(b)||a.order-b.order;});
  items.forEach(i=>{i.el.classList.add('scroll-building');i.el.style.setProperty('--reveal',0);i.el.style.removeProperty('clip-path');i.el.dataset.buildState='waiting';});dirty=true;
 }
 function duration(item){return item.minor?{quick:1.4,slow:2.1,slower:3.5}[settings.speed]:{quick:3.2,slow:5,slower:11}[settings.speed];}
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
   const t=clamp((stamp-tour.start)/2500,0,1),e=ease(t);
   scrollTo({top:tour.from+(tour.target-tour.from)*e,behavior:'instant'});
   if(t>=1){tourPhase('building');tour.until=0;dirty=true;}
   return true;
  }
  return false;
 }
 function nextTourStep(stamp,building){
  if(tour.phase!=='building')return;
  if(building){tour.until=0;return;}
  if(!tour.until){tour.until=stamp+1300;return;}
  if(stamp<tour.until)return;
  const limit=Math.max(0,document.documentElement.scrollHeight-height);
  if(scrollY>=limit-2){stopTour();return;}
  tour.from=scrollY;tour.target=Math.min(limit,scrollY+height*.62);tour.start=stamp;tourPhase('moving');
 }

 function parentReady(item){const parent=item.el.parentElement.closest('.build-item');return !parent||!items.some(i=>i.el===parent&&!i.done);}
 function outline(b,q){
  const points=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h},{x:b.x,y:b.y}];
  let left=(b.w+b.h)*2*q,tip=points[0];ctx?.beginPath();ctx?.moveTo(tip.x,tip.y);
  for(let i=1;i<points.length;i++){const from=points[i-1],to=points[i],length=Math.hypot(to.x-from.x,to.y-from.y),u=Math.min(1,left/Math.max(1,length));tip={x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u};ctx?.lineTo(tip.x,tip.y);left-=length;if(left<=0)break;}
  ctx?.stroke();return tip;
 }
 function paint(item){
  const t=clamp(item.elapsed/duration(item),0,1),raw=clamp((t-.32)/.62,0,1),q=item.kind==='type'?raw:ease(raw),b={...item.box,x:item.box.x-scrollX,y:item.box.y-scrollY};
  item.q=q;item.el.style.setProperty('--reveal',q);if(q>.03&&!item.minor)document.documentElement.classList.add('construction-ui-ready');
  const color=colors[item.owner],frame=ease((t-.12)/.2),settle=1-ease((t-.94)/.06),offset=item.kind==='place'?{x:(1-q)*24,y:-(1-q)*16}:{x:0,y:0},visual={...b,x:b.x+offset.x,y:b.y+offset.y};
  let tip,stage,label;
  if(ctx){ctx.globalAlpha=settle;ctx.lineWidth=1;ctx.setLineDash([]);ctx.strokeStyle=color+'88';ctx.fillStyle=color;}
  if(t<.12){
   stage='approach';label='Đến vị trí';const u=ease(t/.12),from=item.approachFrom||{x:b.x-30,y:b.y-25};tip={x:from.x+(visual.x-from.x)*u,y:from.y+(visual.y-from.y)*u-Math.sin(Math.PI*u)*Math.min(34,Math.abs(visual.x-from.x)*.08)};
  }else if(t<.32){
   stage='frame';label='Dựng khung';tip=outline(visual,frame);
  }else{
   stage=t>.94?'settle':'content';label=t>.94?'Hoàn tất':{type:'Viết từng dòng',frame:'Đưa nội dung vào',surface:'Dựng bề mặt',place:'Đặt ảnh',align:'Căn chỉnh'}[item.kind];
   if(item.kind==='type'){
    const lines=textLines(item),at=q*lines.length,row=Math.min(lines.length-1,Math.floor(at)),line=lines[row],local=at-row,returning=row>0&&local<.16,write=ease(row>0?(local-.16)/.84:local),x=line.left+(line.right-line.left)*write;
    const top=clamp(line.top/b.h*100,0,100),bottom=clamp(line.bottom/b.h*100,0,100),edge=clamp(x/b.w*100,0,100);
    item.el.style.clipPath=q>=1?'inset(0)':`polygon(0 0,100% 0,100% ${top}%,${edge}% ${top}%,${edge}% ${bottom}%,0 ${bottom}%)`;
    if(returning){const previousLine=lines[row-1],u=ease(local/.16);tip={x:b.x+previousLine.right+(line.left-previousLine.right)*u,y:b.y+previousLine.mid+(line.mid-previousLine.mid)*u};}
    else{tip={x:b.x+x,y:b.y+line.mid};if(ctx){ctx.beginPath();ctx.moveTo(b.x+line.left,tip.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();}}
   }else if(item.kind==='frame'){tip={x:b.x+b.w*q,y:b.y+b.h*q};if(ctx)ctx.strokeRect(b.x,b.y,b.w*q,b.h*q);}
   else if(item.kind==='surface'){tip=outline(b,1);}
   else if(item.kind==='align'){tip={x:b.x+b.w*q,y:b.y+b.h*.5};if(ctx){ctx.beginPath();ctx.moveTo(b.x,tip.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();}}
   else {tip={x:visual.x,y:visual.y};if(ctx)ctx.strokeRect(visual.x,visual.y,b.w,b.h);}
  }
  item.el.dataset.buildState=stage;
  if(ctx){if(stage!=='approach')ctx.fillRect(tip.x-2,tip.y-2,4,4);ctx.globalAlpha=1;}
  return{tip,stage,label,opacity:Math.min(1,t/.04)*settle};
 }
 function position(a,point,label){a.x=label?point.x:clamp(point.x,8,width-24);a.y=label?point.y:clamp(point.y,36,height-90);a.el.style.transform=`translate3d(${a.x}px,${a.y}px,0)`;a.el.style.opacity='1';a.el.dataset.state=label?'building':'follow';a.el.classList.toggle('has-label',Boolean(label)&&a.id===0&&width>=640);a.el.classList.toggle('label-left',a.x>width-150);a.el.querySelector('b').textContent=label||'';}
 function tick(stamp){raf=0;if(!on()||document.hidden)return;const dt=previous?Math.min((stamp-previous)/1000,.05):.016;previous=stamp;clock+=dt;if(dirty)cache();ctx?.clearRect(0,0,width,height);agents.forEach(a=>{a.el.style.opacity=0;});
  if(tourTransition(stamp)){layer.hidden=true;buildAssist.hidden=true;layer.dataset.phase=tour.phase==='intro'?'INTRO':'AUTO_SCROLLING';raf=requestAnimationFrame(safeTick);return;}
  const focused=document.activeElement;const protect=Boolean(focused?.closest('input,textarea,select,[contenteditable=true],.chat-panel')&&!focused.closest('#swarm-controls'))||Boolean(getSelection()?.toString());
  const occupied=new Set();let active=false;
  for(const item of items){if(item.done)continue;const top=item.box.y-scrollY,bottom=top+item.box.h;
   if(!item.box.w||!item.box.h){finish(item);continue;}
   // An anchor/restored scroll position is not proof that earlier content was built.
   // The header always keeps its real progress, even after a fast scroll past it.
   if(bottom<0){if(item.visited&&!item.el.closest('.site-header'))finish(item);else item.owner=null;continue;}
   if(top>height*.91||bottom<35){item.owner=null;continue;}
   item.visited=true;
   if(!parentReady(item))continue;
   if(protect)continue;
   let owner=item.owner;
   if(owner===null||owner>=agents.length||occupied.has(owner)){owner=agents.findIndex(a=>!occupied.has(a.id));if(owner<0)continue;item.owner=owner;item.approachFrom={x:agents[owner].x,y:agents[owner].y};}
   occupied.add(owner);active=true;item.elapsed+=dt;
   const work=paint(item);position(agents[owner],work.tip,work.label);agents[owner].el.dataset.stage=work.stage;agents[owner].el.style.opacity=String(work.opacity);agents[owner].el.classList.toggle('has-label',work.stage==='content'&&owner===0&&width>=640);
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
 function sync(){cancelAnimationFrame(raf);raf=0;previous=0;document.body.classList.toggle('effects-off',!on());document.documentElement.classList.toggle('construction-mode',on());toggle.setAttribute('aria-pressed',String(on()));document.getElementById('effects-state').textContent=on()?'Bật':'Tắt';document.getElementById('replay').disabled=reduced.matches;document.getElementById('tour-replay').disabled=reduced.matches;if(!on()){stopTour();items.forEach(finish);layer.hidden=true;buildAssist.hidden=true;ctx?.clearRect(0,0,width,height);}else schedule();}
 function revealFocused(target){for(let el=target;el&&el!==document.body;el=el.parentElement){const item=items.find(i=>i.el===el);if(item)finish(item);}}
 window.PortfolioMotion=Object.freeze({active:on,subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},guide(id){const el=document.getElementById(id);if(!el||!['projects','about','contact','school'].includes(id))return;stopTour();el.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});}});
 document.getElementById('year').textContent=new Date().getFullYear();const avatar=document.querySelector('.portrait img');avatar.addEventListener('error',()=>avatar.hidden=true);if(avatar.complete&&!avatar.naturalWidth)avatar.hidden=true;
 controls.hidden=false;document.getElementById('build-speed').value=settings.speed;document.getElementById('follow-pointer').checked=settings.follow;
 toggle.addEventListener('click',()=>{if(reduced.matches)return;settings.enabled=!settings.enabled;if(settings.enabled)reset();save();sync();});
 document.getElementById('build-speed').addEventListener('change',e=>{const ratios=items.map(i=>i.elapsed/duration(i));settings.speed=e.target.value;items.forEach((i,n)=>{i.elapsed=ratios[n]*duration(i);});save();schedule();});
 document.getElementById('reveal-now').addEventListener('click',finishVisible);
 document.getElementById('follow-pointer').addEventListener('change',e=>{settings.follow=e.target.checked;save();schedule();});
 document.getElementById('replay').addEventListener('click',()=>{if(reduced.matches)return;settings.enabled=true;reset();save();sync();});
 document.getElementById('tour-stop').addEventListener('click',stopTour);
 document.getElementById('tour-replay').addEventListener('click',()=>{if(reduced.matches)return;settings.enabled=true;reset();save();sync();controls.open=false;startTour();});
 for(const event of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(event,e=>{if(event==='keydown')keyboardNavigation=true;else if(event==='pointerdown'||event==='touchstart')keyboardNavigation=false;if(event==='keydown'||event==='pointerdown'||event==='touchstart')document.documentElement.classList.add('construction-ui-ready');if(tour.phase!=='off'&&(event==='wheel'||!e.target.closest?.('#tour-stop')))stopTour();},{passive:true,capture:true});
 window.addEventListener('scroll',()=>{dirty=true;schedule();},{passive:true});window.addEventListener('resize',()=>{if(tour.phase!=='intro')stopTour();resize();},{passive:true});window.addEventListener('pageshow',e=>{if(e.persisted)stopTour();dirty=true;sync();});document.addEventListener('visibilitychange',()=>{const now=performance.now();if(document.hidden)tour.hiddenAt=now;else if(tour.hiddenAt){const pause=now-tour.hiddenAt;tour.until+=pause;tour.start+=pause;tour.hiddenAt=0;}sync();});reduced.addEventListener('change',sync);
 window.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY,known:true};lastPointer=clock;if(settings.follow)schedule();},{passive:true});
 document.addEventListener('focusin',e=>{if(!e.target.closest('#tour-stop'))stopTour();if(keyboardNavigation)revealFocused(e.target);schedule();});
 document.addEventListener('focusout',schedule);document.addEventListener('selectionchange',schedule);
 window.addEventListener('hashchange',()=>{stopTour();dirty=true;schedule();});
 if('ResizeObserver'in window)new ResizeObserver(()=>{dirty=true;schedule();}).observe(document.querySelector('main'));
 reset();resize();if(location.hash){let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{}if(target)target.scrollIntoView({behavior:'instant',block:'start'});}sync();
 document.documentElement.classList.remove('construction-pending');
 document.fonts.ready.then(()=>{items.forEach(item=>{item.lines=null;});dirty=true;schedule();});
 if(on()&&!location.hash&&scrollY<2)startTour();else stopTour();
})();
