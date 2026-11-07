(() => {
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const controls=document.getElementById('swarm-controls'), toggle=document.getElementById('effects-toggle');
 const layer=document.createElement('div');layer.className='swarm-layer';layer.setAttribute('aria-hidden','true');
 const canvas=document.createElement('canvas');layer.append(canvas);document.body.append(layer);const ctx=canvas.getContext('2d');
 const colors=['#c4f46d','#a5c6ff','#e4b2f7','#88d9c4','#edcb8c','#c7ccff'];
 const settings={enabled:true,activity:'normal',follow:false};
 try{const saved=JSON.parse(localStorage.getItem('hb-display-v6')||'null');if(saved){for(const k of ['enabled','follow'])if(typeof saved[k]==='boolean')settings[k]=saved[k];if(['light','normal','lively'].includes(saved.activity))settings.activity=saved.activity;}}catch{}
 let width=innerWidth,height=innerHeight,agents=[],items=[],raf=0,previous=0,dirty=true,clock=0,lastPointer=-100;
 let pointer={x:width/2,y:height/2,known:false};const subscribers=new Set();
 const on=()=>settings.enabled&&!reduced.matches;
 function save(){try{localStorage.setItem('hb-display-v6',JSON.stringify(settings));}catch{}}
 function finish(item){item.done=true;item.q=1;item.owner=null;item.el.classList.remove('scroll-building');item.el.style.removeProperty('--reveal');item.el.style.removeProperty('clip-path');}
 function geometry(el){let x=0,y=0,node=el;while(node){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent;}return{x,y,w:el.offsetWidth,h:el.offsetHeight};}
 function cache(){items.forEach(item=>{item.box=geometry(item.el);});dirty=false;}
 function density(){return width<640?{light:2,normal:2,lively:3}[settings.activity]:{light:3,normal:4,lively:6}[settings.activity];}
 function resize(){width=innerWidth;height=innerHeight;const r=Math.min(devicePixelRatio||1,1.5);canvas.width=width*r;canvas.height=height*r;ctx?.setTransform(r,0,0,r,0,0);items.forEach(i=>{i.owner=null;});agents.forEach(a=>a.el.remove());agents=[];
  for(let i=0;i<density();i++){const el=document.createElement('div');el.className='virtual-cursor living-cursor';el.style.color=colors[i];el.innerHTML='<svg viewBox="0 0 24 30"><path d="M2 2v23l6-6 5 10 5-3-5-9h9Z"/></svg><span><b></b></span>';layer.append(el);agents.push({el,id:i,x:width/2,y:height/2,vx:0,vy:0});}
  document.getElementById('team-count').textContent=agents.length;dirty=true;schedule();
 }
 function reset(){items=[...document.querySelectorAll('.build-item')].map((el,i)=>({el,kind:el.dataset.kind||'type',q:0,done:false,owner:null,box:geometry(el),duration:el.dataset.kind==='frame'?1.1:1.2+(i%3)*.12}));items.forEach(i=>{i.el.classList.add('scroll-building');i.el.style.setProperty('--reveal',0);});dirty=true;}
 function parentReady(item){const parent=item.el.parentElement.closest('.build-item');return !parent||!items.some(i=>i.el===parent&&!i.done);}
 function paint(item){const q=item.q,b={...item.box,x:item.box.x-scrollX,y:item.box.y-scrollY};item.el.style.setProperty('--reveal',q);let tip;
  if(item.kind==='type'){
   const line=parseFloat(getComputedStyle(item.el).lineHeight)||24,n=Math.max(1,Math.ceil(b.h/line)),at=q*n,row=Math.min(n-1,Math.floor(at)),x=at-row;
   item.el.style.clipPath=`polygon(0 0,100% 0,100% ${row*100/n}%,${x*100}% ${row*100/n}%,${x*100}% ${(row+1)*100/n}%,0 ${(row+1)*100/n}%)`;tip={x:b.x+b.w*x,y:b.y+Math.min(b.h,(row+.5)*line)};
  }else if(item.kind==='frame'){tip={x:b.x+b.w*q,y:b.y+b.h*q};}
  else if(item.kind==='align'){tip={x:b.x+b.w*q,y:b.y+b.h*.5};}
  else tip={x:b.x+b.w*.72+(1-q)*24,y:b.y+b.h*.28-(1-q)*16};
  if(ctx){ctx.strokeStyle=colors[item.owner]+'99';ctx.fillStyle=colors[item.owner];ctx.lineWidth=1;
   if(item.kind==='frame')ctx.strokeRect(b.x,b.y,b.w*q,b.h*q);
   else if(item.kind==='place')ctx.strokeRect(b.x+(1-q)*24,b.y-(1-q)*16,b.w,b.h);
   else{ctx.beginPath();ctx.moveTo(b.x,tip.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();}
   ctx.fillRect(tip.x-2,tip.y-2,4,4);
  }return tip;
 }
 function position(a,point,label){a.x=label?point.x:clamp(point.x,8,width-24);a.y=label?point.y:clamp(point.y,36,height-90);a.el.style.transform=`translate3d(${a.x}px,${a.y}px,0)`;a.el.style.opacity='1';a.el.dataset.state=label?'building':'follow';a.el.classList.toggle('has-label',Boolean(label)&&a.id===0&&width>=640);a.el.classList.toggle('label-left',a.x>width-150);a.el.querySelector('b').textContent=label||'';}
 function tick(stamp){raf=0;if(!on()||document.hidden)return;const dt=previous?Math.min((stamp-previous)/1000,.05):.016;previous=stamp;clock+=dt;if(dirty)cache();ctx?.clearRect(0,0,width,height);agents.forEach(a=>{a.el.style.opacity=0;});
  const protect=Boolean(document.activeElement?.closest('input,textarea,select,[contenteditable=true],.chat-panel'))||Boolean(getSelection()?.toString());
  const occupied=new Set();let active=false;
  for(const item of items){if(item.done)continue;const top=item.box.y-scrollY,bottom=top+item.box.h;
   if(bottom<0){finish(item);continue;}
   if(top>height*.91||bottom<35){item.owner=null;continue;}
   if(!parentReady(item))continue;
   if(protect){finish(item);continue;}
   let owner=item.owner;
   if(owner===null||owner>=agents.length||occupied.has(owner)){owner=agents.findIndex(a=>!occupied.has(a.id));if(owner<0)continue;item.owner=owner;}
   occupied.add(owner);active=true;item.q=Math.min(1,item.q+dt/item.duration);
   const tip=paint(item);position(agents[owner],tip,{type:'Tạo chữ',frame:'Kéo khung',place:'Đặt ảnh',align:'Căn hàng'}[item.kind]);
   if(item.q>=1)finish(item);
  }
  if(settings.follow&&pointer.known&&!protect&&clock-lastPointer<2.5){agents.forEach(a=>{if(occupied.has(a.id))return;active=true;const angle=a.id*2.4,radius=85+a.id%2*30;const tx=pointer.x+Math.cos(angle)*radius,ty=pointer.y+Math.sin(angle)*radius*.65;a.vx=(a.vx+(tx-a.x)*dt*8)*Math.exp(-6*dt);a.vy=(a.vy+(ty-a.y)*dt*8)*Math.exp(-6*dt);position(a,{x:a.x+a.vx*dt,y:a.y+a.vy*dt},'');});}
  layer.hidden=protect||!active;layer.dataset.phase=active?'SECTION_BUILDING':'RESTING';layer.dataset.clock=clock.toFixed(2);
  subscribers.forEach(fn=>fn(stamp,dt));if(active)raf=requestAnimationFrame(safeTick);else previous=0;
 }
 function safeTick(stamp){try{tick(stamp);}catch(error){items.forEach(finish);layer.hidden=true;settings.enabled=false;sync();console.error('Hiệu ứng đã dừng; nội dung vẫn hiển thị.',error);}}
 function schedule(){if(!raf&&on()&&!document.hidden)raf=requestAnimationFrame(safeTick);}
 function sync(){cancelAnimationFrame(raf);raf=0;previous=0;document.body.classList.toggle('effects-off',!on());toggle.setAttribute('aria-pressed',String(on()));document.getElementById('effects-state').textContent=on()?'Bật':'Tắt';document.getElementById('replay').disabled=reduced.matches;if(!on()){items.forEach(finish);layer.hidden=true;ctx?.clearRect(0,0,width,height);}else schedule();}
 function completeSection(target){const section=target.closest('.scene');if(section)items.filter(i=>section.contains(i.el)).forEach(finish);}
 window.PortfolioMotion=Object.freeze({active:on,subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},guide(id){const el=document.getElementById(id);if(!el||!['projects','about','contact','school'].includes(id))return;completeSection(el);el.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});}});
 document.getElementById('year').textContent=new Date().getFullYear();const avatar=document.querySelector('.portrait img');avatar.addEventListener('error',()=>avatar.hidden=true);if(avatar.complete&&!avatar.naturalWidth)avatar.hidden=true;
 controls.hidden=false;document.getElementById('activity').value=settings.activity;document.getElementById('follow-pointer').checked=settings.follow;
 toggle.addEventListener('click',()=>{if(reduced.matches)return;settings.enabled=!settings.enabled;if(settings.enabled)reset();save();sync();});
 document.getElementById('activity').addEventListener('change',e=>{settings.activity=e.target.value;resize();save();});
 document.getElementById('follow-pointer').addEventListener('change',e=>{settings.follow=e.target.checked;save();schedule();});
 document.getElementById('replay').addEventListener('click',()=>{if(reduced.matches)return;settings.enabled=true;reset();save();sync();});
 window.addEventListener('scroll',()=>{dirty=true;schedule();},{passive:true});window.addEventListener('resize',resize,{passive:true});window.addEventListener('pageshow',()=>{dirty=true;sync();});document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
 window.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY,known:true};lastPointer=clock;if(settings.follow)schedule();},{passive:true});
 document.addEventListener('focusin',e=>{completeSection(e.target);schedule();});
 document.addEventListener('click',e=>{const link=e.target.closest('a[href^="#"]');if(link)completeSection(document.getElementById(link.hash.slice(1))||link);});
 window.addEventListener('hashchange',()=>{const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target)completeSection(target);dirty=true;schedule();});
 if('ResizeObserver'in window)new ResizeObserver(()=>{dirty=true;schedule();}).observe(document.querySelector('main'));
 reset();resize();if(location.hash){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target){const y=target.getBoundingClientRect().top+scrollY;items.filter(i=>i.box.y<y+target.offsetHeight).forEach(finish);}}sync();
})();
