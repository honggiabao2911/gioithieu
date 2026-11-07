(() => {
  'use strict';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, q) => a + (b - a) * q;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const colors = ['#c4f46d', '#a5c6ff', '#e4b2f7', '#ffcc80', '#78e5d5', '#ff9db9', '#c7ccff', '#e5ecae', '#9be7a9', '#ffc7e5', '#8cd3ff', '#edb981'];
  const personalities = ['Tò mò', 'Khám phá', 'Cẩn thận', 'Năng động'];
  const roles = ['Layout', 'Visual', 'Type', 'Motion', 'Network'];
  const actions = ['frame', 'label', 'network', 'terminal', 'wire', 'inspect'];
  const names = { frame: 'Dựng khung', label: 'Đặt nhãn', network: 'Nối mạng', terminal: 'Viết mã', wire: 'Dựng mô hình', inspect: 'Căn chỉnh' };
  const settings = { enabled: true, activity: 'normal', follow: true, idle: true };
  try {
    const old = localStorage.getItem('hb-build-effects');
    if (old === 'off') settings.enabled = false;
    const saved = JSON.parse(localStorage.getItem('hb-swarm-settings') || 'null');
    if (saved) {
      for (const key of ['enabled', 'follow', 'idle']) if (typeof saved[key] === 'boolean') settings[key] = saved[key];
      if (['light', 'normal', 'lively'].includes(saved.activity)) settings.activity = saved.activity;
    }
  } catch { /* Storage is optional. */ }
  const controls = document.getElementById('swarm-controls');
  const toggle = document.getElementById('effects-toggle');
  const replay = document.getElementById('replay');
  const status = document.getElementById('swarm-status');
  const log = document.getElementById('task-log');
  const canvas = document.createElement('canvas');
  const layer = document.createElement('div');
  layer.className = 'swarm-layer'; layer.setAttribute('aria-hidden', 'true');
  canvas.className = 'swarm-canvas'; layer.append(canvas); document.body.append(layer);
  const ctx = canvas.getContext('2d');
  let width = innerWidth, height = innerHeight, agents = [], targets = [], tasks = [], waves = [];
  let raf = 0, previous = 0, clock = 0, lastInput = 0, nextTask = 1.3, count = 0, dirty = true;
  let hovered = null, guide = null, selectedText = false;
  let phase = 'FOLLOWING', buildStart = 0, finishAt = 0, buildItems = [], buildRectsDirty = true;
  const buildUI = document.getElementById('build-progress');
  let pointer = { x: width * .54, y: height * .42, known: false, down: false };
  const subscribers = new Set();
  const enabled = () => settings.enabled && !reduced.matches;
  const weak = (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory || 4) <= 2;
  const compact = () => width < 640 || matchMedia('(pointer: coarse)').matches;
  const nowState = state => { if (status.textContent !== state) status.textContent = state; };
  function save() {
    try { localStorage.setItem('hb-swarm-settings', JSON.stringify(settings)); localStorage.setItem('hb-build-effects', settings.enabled ? 'on' : 'off'); } catch { /* Optional. */ }
  }
  function setState(agent, state, label) {
    if (agent.state !== state || agent.label !== label) {
      agent.state = state; agent.label = label;
      agent.el.dataset.state = state;
      agent.el.querySelector('b').textContent = `${String(agent.id + 1).padStart(2, '0')} · ${label}`;
    }
  }
  function rebuildAgents() {
    const desired = compact() || weak ? { light: 3, normal: 4, lively: 6 }[settings.activity] : { light: 8, normal: 10, lively: 12 }[settings.activity];
    cancelTasks();
    while (agents.length > desired) agents.pop().el.remove();
    while (agents.length < desired) {
      const i = agents.length;
      const el = document.createElement('div'); el.className = 'virtual-cursor living-cursor'; el.style.color = colors[i];
      el.innerHTML = '<svg viewBox="0 0 24 30"><path d="M2 2v23l6-6 5 10 5-3-5-9h9Z"/></svg><span><b></b></span>';
      layer.append(el);
      const angle = i * 2.4;
      agents.push({ id: i, el, x: clamp(width * .5 + Math.cos(angle) * 160, 15, width - 35), y: clamp(height * .45 + Math.sin(angle) * 110, 60, height - 100), vx: 0, vy: 0, ax: 0, ay: 0, tx: 0, ty: 0, speed: 135 + i % 4 * 24, temperament: personalities[i % 4], state: '', label: '', rest: 0, cooldown: 0, job: null, trail: [] });
    }
    document.getElementById('team-count').textContent = desired;
  }
  function resize() {
    const wasCompact = width < 640;
    width = innerWidth; height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    agents.forEach(a => { a.x = clamp(a.x, 10, width - 30); a.y = clamp(a.y, 40, height - 90); });
    if (wasCompact !== (width < 640)) rebuildAgents();
    dirty = true; buildRectsDirty = true;
  }
  function cacheTargets() {
    const elements = document.querySelectorAll('.portrait,.project-art,.skill-row,.profile-note,.school-mark,.wire-space,.hero-actions,h1,h2');
    const old = new Map(targets.map(t => [t.el, t]));
    targets = [...elements].map(el => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left, y: r.top, w: r.width, h: r.height, last: old.get(el)?.last ?? -100, kind: old.get(el)?.kind || '' };
    }).filter(t => t.w > 10 && t.h > 8 && t.y > 45 && t.y < height - 145 && t.y + t.h > 90 && !t.el.closest('[hidden]'));
    for (const task of tasks) {
      const target = targets.find(t => t.el === task.target.el);
      if (!target) { task.cancelled = true; task.opacity = 0; }
      else task.target = target;
    }
    if (guide) guide.rect = guide.el.getBoundingClientRect();
    dirty = false;
  }
  function cancelTasks() {
    tasks.forEach(t => { t.cancelled = true; });
    agents.forEach(a => { a.job = null; });
  }
  function addLog(text) {
    const p = document.createElement('p'); p.textContent = `> ${text}`; log.append(p);
    while (log.children.length > 6) log.firstElementChild.remove();
  }
  function taskPoint(task, member, q) {
    const t = task.target;
    const x = clamp(t.x - 5, 12, width - 75), y = clamp(t.y - 5, 55, height - 155);
    const w = Math.min(t.w + 10, width - x - 18), h = Math.min(t.h + 10, height - y - 110);
    if (task.type === 'frame' || task.type === 'inspect') {
      return member === 0 ? { x: x + w * q, y: y + h * q } : { x, y: y + h * q };
    }
    if (task.type === 'label') return member === 0 ? { x: x + w * .65 * q, y: y + 12 } : { x: x + w * .65 * q + 38, y: y + 38 };
    if (task.type === 'terminal') return { x: x + 12 + q * Math.min(w - 30, 230), y: y + h * (.3 + member * .3) };
    const points = [[.1, .25], [.5, .08], [.9, .5], [.5, .88], [.1, .25]];
    const position = q * (points.length - 1), i = Math.min(points.length - 2, Math.floor(position));
    const r = position - i, p = points[i], n = points[i + 1];
    return member === 0 ? { x: x + w * lerp(p[0], n[0], r), y: y + h * lerp(p[1], n[1], r) } : { x: x + w * .5, y: y + h * .5 };
  }
  function assignTask() {
    const free = agents.filter(a => !a.job && a.cooldown < clock);
    const possible = targets.filter(t => clock - t.last > 9 && !tasks.some(job => job.target.el === t.el && !job.cancelled));
    if (free.length < 2 || !possible.length) return;
    possible.sort((a, b) => a.last - b.last);
    const target = possible[Math.floor(Math.random() * Math.min(3, possible.length))];
    const types = actions.filter(type => type !== target.kind);
    const type = types[Math.floor(Math.random() * types.length)];
    free.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
    const task = { target, type, members: free.slice(0, 2), age: 0, work: 0, duration: 3.8 + Math.random() * 2, phase: 'approach', cancelled: false, opacity: 1 };
    target.last = clock; target.kind = type;
    task.members.forEach(a => { a.job = task; });
    tasks.push(task);
    layer.dataset.taskSerial = String(Number(layer.dataset.taskSerial || 0) + 1);
  }
  function protectedInput() {
    return Boolean(document.activeElement?.closest('input,textarea,select,[contenteditable="true"],.chat-panel')) || selectedText || pointer.down;
  }
  function tickTasks(dt, idle, protect) {
    const limit = compact() || settings.activity === 'light' ? 1 : 2;
    for (const task of tasks) {
      task.age += dt;
      if ((!idle || protect || !settings.idle) && !task.cancelled) task.cancelled = true;
      if (task.cancelled || task.phase === 'done') { task.opacity = Math.max(0, task.opacity - dt * 2.2); continue; }
      const points = task.members.map((a, i) => taskPoint(task, i, 0));
      if (task.phase === 'approach') {
        if (task.members.every((a, i) => Math.hypot(a.x - points[i].x, a.y - points[i].y) < 15) || task.age > 3.5) task.phase = 'work';
      } else {
        task.work = Math.min(task.duration, task.work + dt);
        if (task.work >= task.duration) {
          task.phase = 'done'; count++;
          document.getElementById('task-count').textContent = count;
          layer.dataset.completed = count;
          addLog(`${names[task.type]} ✓ · ${roles[task.members[0].id % roles.length]} + ${roles[task.members[1].id % roles.length]}`);
        }
      }
    }
    tasks = tasks.filter(task => {
      if (task.opacity > 0) return true;
      task.members.forEach(a => { if (a.job === task) { a.job = null; a.cooldown = clock + .6 + Math.random(); } });
      return false;
    });
    if (idle && settings.idle && !protect && tasks.length < limit && clock > nextTask) {
      cacheTargets(); assignTask(); nextTask = clock + (settings.activity === 'lively' ? 1.2 : 2);
    }
  }
  function chooseTargets(dt, idle, protect) {
    const followCount = Math.ceil(agents.length * .65);
    agents.forEach((a, i) => {
      if (a.job && (a.job.cancelled || a.job.phase === 'done')) {
        a.rest = Math.min(a.rest, clock);
        setState(a, 'depart', 'Thu dọn');
      }
      if (phase === 'FINISHING') {
        a.tx = width * .5 + (i - agents.length / 2) * 25; a.ty = height * .4;
        setState(a, 'finishing', 'Website ready');
      } else if (a.job && !a.job.cancelled && a.job.phase !== 'done') {
        const job = a.job, member = job.members.indexOf(a), q = job.phase === 'work' ? job.work / job.duration : 0;
        const point = taskPoint(job, member, q);
        a.tx = point.x; a.ty = point.y;
        setState(a, job.phase === 'work' ? 'work' : 'approach', `${names[job.type]}${member ? ' · Hỗ trợ' : ''}`);
      } else if (protect) {
        a.tx = i % 2 ? width - 36 : 12; a.ty = 80 + i / agents.length * Math.max(60, height - 240);
        setState(a, 'rest', 'Nhường chỗ');
      } else if (guide && clock < guide.until) {
        const r = guide.rect || { left: 30, top: 65, width: width - 60 };
        a.tx = clamp(r.left + r.width * ((i + 1) / (agents.length + 1)), 20, width - 40);
        a.ty = clamp(r.top + 30 + i % 2 * 35, 65, height - 150);
        setState(a, 'guide', 'Dẫn đường');
      } else if (!idle && settings.follow && pointer.known && i < followCount) {
        const angle = i * 2.399 + clock * (.1 + i % 3 * .03);
        const radius = (compact() ? 65 : 90) + (i % 3) * 34;
        a.tx = pointer.x + Math.cos(angle) * radius; a.ty = pointer.y + Math.sin(angle) * radius * .65;
        setState(a, 'follow', `${a.temperament} · Theo bạn`);
      } else if (hovered && !idle && i >= followCount && targets.some(t => hovered.contains(t.el) || t.el === hovered)) {
        const t = targets.find(t => hovered.contains(t.el) || t.el === hovered);
        a.tx = t.x + (i % 2 ? t.w : 0); a.ty = t.y + (i % 2 ? t.h * .5 : 0);
        setState(a, 'explore', 'Tò mò · Quan sát');
      } else if (clock > a.rest || !a.tx) {
        const t = targets[Math.floor(Math.random() * Math.max(1, targets.length))];
        a.tx = t ? t.x + Math.random() * t.w : 30 + Math.random() * Math.max(10, width - 80);
        a.ty = t ? t.y - 22 + Math.random() * (t.h + 30) : 70 + Math.random() * Math.max(10, height - 200);
        a.rest = clock + 1.5 + Math.random() * 2.5;
        setState(a, 'explore', `${a.temperament} · Khám phá`);
      }
      a.tx = clamp(a.tx, 12, width - 32); a.ty = clamp(a.ty, 55, height - 105);
      const dx = a.tx - a.x, dy = a.ty - a.y;
      a.ax = dx * (a.state === 'work' ? 24 : 8); a.ay = dy * (a.state === 'work' ? 24 : 8);
      for (const other of agents) {
        if (other === a) continue;
        const sx = a.x - other.x, sy = a.y - other.y, d = Math.hypot(sx, sy) || .1;
        if (d < 37 && a.state !== 'work') { a.ax += sx / d * (37 - d) * 11; a.ay += sy / d * (37 - d) * 11; }
      }
      if (pointer.known && !idle) {
        const sx = a.x - pointer.x, sy = a.y - pointer.y, d = Math.hypot(sx, sy) || 1;
        if (d < 52) { a.ax += sx / d * (52 - d) * 22; a.ay += sy / d * (52 - d) * 22; }
      }
      a.vx = (a.vx + a.ax * dt) * Math.exp(-5.5 * dt);
      a.vy = (a.vy + a.ay * dt) * Math.exp(-5.5 * dt);
      const speed = Math.hypot(a.vx, a.vy), max = a.state === 'work' ? a.speed * 2 : a.speed;
      if (speed > max) { a.vx *= max / speed; a.vy *= max / speed; }
      a.x = clamp(a.x + a.vx * dt, 5, width - 25); a.y = clamp(a.y + a.vy * dt, 45, height - 95);
      a.trail.push({ x: a.x + 2, y: a.y + 2 }); if (a.trail.length > (compact() ? 5 : 9)) a.trail.shift();
      a.el.style.transform = `translate3d(${a.x}px,${a.y}px,0)`;
      a.el.style.opacity = '1';
      a.el.classList.toggle('label-left', a.x > width - 155);
      a.el.classList.toggle('has-label', a.state === 'work' || a.state === 'approach' || i < 2);
    });
  }
  function drawTasks() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    agents.forEach(a => {
      if (a.trail.length < 2) return;
      ctx.beginPath(); ctx.moveTo(a.trail[0].x, a.trail[0].y); a.trail.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = colors[a.id] + '40'; ctx.lineWidth = 1; ctx.stroke();
    });
    for (const task of tasks) {
      if (task.phase === 'approach' || task.stale) continue;
      const a = task.members[0], b = task.members[1], t = task.target;
      ctx.save(); ctx.globalAlpha = task.opacity * .8; ctx.strokeStyle = colors[a.id]; ctx.fillStyle = colors[a.id]; ctx.lineWidth = 1.2;
      const origin = taskPoint(task, 0, 0);
      if (task.type === 'frame' || task.type === 'inspect') {
        const x = Math.min(origin.x, a.x), y = Math.min(origin.y, a.y), w = Math.max(4, Math.abs(a.x - origin.x)), h = Math.max(4, Math.abs(a.y - origin.y));
        ctx.setLineDash(task.type === 'inspect' ? [4, 5] : []); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
        ctx.fillRect(a.x - 3, a.y - 3, 6, 6); ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
      } else if (task.type === 'label' || task.type === 'terminal') {
        ctx.font = '11px monospace';
        const text = task.type === 'label' ? '[ aligned / ready ]' : '> const curiosity = true;';
        const shown = text.slice(0, Math.ceil(task.work / task.duration * text.length));
        const x = clamp(a.x - shown.length * 6.5, t.x, width - 190);
        ctx.fillStyle = '#101310eb'; ctx.fillRect(x - 5, a.y - 17, shown.length * 6.5 + 12, 23);
        ctx.fillStyle = colors[a.id]; ctx.fillText(shown, x, a.y);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y + 5); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke();
        for (const p of [origin, a, b]) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); }
      }
      if (task.phase === 'done') { ctx.font = '13px monospace'; ctx.fillText('✓', a.x + 10, a.y - 10); }
      ctx.restore();
    }
    waves = waves.filter(w => clock - w.start < .7);
    waves.forEach(w => { const q = (clock - w.start) / .7; ctx.beginPath(); ctx.arc(w.x, w.y, 8 + q * 55, 0, Math.PI * 2); ctx.strokeStyle = `rgba(196,244,109,${1 - q})`; ctx.stroke(); });
  }
  function buildBox(el) {
    let x = 0, y = 0, node = el;
    while (node) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function clearBuildItem(item) {
    item.el.classList.remove('startup-item');
    item.el.style.removeProperty('--build-q'); item.el.style.removeProperty('clip-path');
  }
  function completeStartup(showReady = true) {
    buildItems.forEach(clearBuildItem);
    phase = showReady && enabled() ? 'FINISHING' : 'FOLLOWING';
    finishAt = clock + .55; lastInput = clock;
    layer.dataset.phase = phase;
    buildUI.hidden = !showReady || !enabled();
    document.getElementById('build-caption').textContent = 'Website ready · Tất cả các mục đã hoàn thiện';
    document.getElementById('build-percent').textContent = '100%';
    document.getElementById('build-meter').value = 100;
    document.getElementById('build-skip').hidden = true;
  }
  function beginStartup() {
    if (!enabled()) { completeStartup(false); return; }
    cancelTasks(); tasks = []; buildStart = clock; phase = 'BUILDING'; layer.dataset.phase = phase;
    const elements = [...document.querySelectorAll('.brand,.site-header nav,.build-item,.playground-grid>div')];
    const sections = [...document.querySelectorAll('main>section')];
    buildItems = elements.map((el, i) => {
      const section = el.closest('main>section');
      const group = Math.max(0, sections.indexOf(section));
      const start = group === 0 ? Math.min(1, i * .11) : .6 + group * .3 + i % 3 * .1;
      return { el, start, duration: group === 0 ? 2.2 : 2.1, box: buildBox(el), kind: el.dataset.kind || 'type', q: 0 };
    });
    buildItems.forEach(item => { item.el.classList.add('startup-item'); item.el.style.setProperty('--build-q', 0); });
    buildRectsDirty = true; buildUI.hidden = false;
    document.getElementById('build-caption').textContent = 'Đội đang dựng toàn bộ website';
    document.getElementById('build-skip').hidden = false;
  }
  function tickStartup() {
    if (buildRectsDirty) { buildItems.forEach(item => { item.box = buildBox(item.el); }); buildRectsDirty = false; }
    const elapsed = clock - buildStart;
    const active = [];
    let total = 0;
    buildItems.forEach(item => {
      const q = clamp((elapsed - item.start) / item.duration, 0, 1); item.q = q; total += q;
      const b = { ...item.box, x: item.box.x - scrollX, y: item.box.y - scrollY };
      item.viewport = b;
      if (q >= 1) { clearBuildItem(item); return; }
      item.el.style.setProperty('--build-q', q);
      if (item.kind === 'type') {
        const line = parseFloat(getComputedStyle(item.el).lineHeight) || 24;
        const count = Math.max(1, Math.ceil(b.h / line)), at = q * count;
        const row = Math.min(count - 1, Math.floor(at)), x = at - row;
        item.el.style.clipPath = `polygon(0 0,100% 0,100% ${row * 100 / count}%,${x * 100}% ${row * 100 / count}%,${x * 100}% ${(row + 1) * 100 / count}%,0 ${(row + 1) * 100 / count}%)`;
        item.tip = { x: b.x + b.w * x, y: b.y + Math.min(b.h, (row + .5) * line) };
      } else if (item.kind === 'frame' || item.kind === 'align') {
        item.tip = { x: b.x + b.w * q, y: b.y + b.h * (item.kind === 'frame' ? q : .5) };
      } else item.tip = { x: b.x + b.w * .75 + (1 - q) * 32, y: b.y + b.h * .3 - (1 - q) * 24 };
      if (elapsed >= item.start && b.y < height - 85 && b.y + b.h > 30) active.push(item);
    });
    const progress = Math.round(total / Math.max(1, buildItems.length) * 100);
    document.getElementById('build-percent').textContent = `${progress}%`;
    document.getElementById('build-meter').value = progress;
    if (ctx) ctx.clearRect(0, 0, width, height);
    agents.forEach((a, i) => {
      const item = active[i % Math.max(1, active.length)];
      let tip, label;
      if (item) {
        const b = item.viewport, assist = Math.floor(i / active.length);
        tip = assist ? { x: b.x + b.w * item.q * (assist % 2), y: b.y + b.h * item.q } : item.tip;
        label = assist ? 'Căn chỉnh · Phối hợp' : ({ type: 'Tạo chữ', frame: 'Kéo khung', place: 'Đặt hình', align: 'Căn hàng' }[item.kind]);
        if (ctx) {
          ctx.strokeStyle = colors[i] + 'bb'; ctx.fillStyle = colors[i]; ctx.lineWidth = 1;
          if (!assist) {
            if (item.kind === 'frame') ctx.strokeRect(b.x, b.y, b.w * item.q, b.h * item.q);
            else if (item.kind === 'place') ctx.strokeRect(b.x + (1 - item.q) * 32, b.y - (1 - item.q) * 24, b.w, b.h);
            else { ctx.beginPath(); ctx.moveTo(b.x, tip.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); }
          }
          ctx.fillRect(tip.x - 3, tip.y - 3, 6, 6);
        }
      } else {
        tip = { x: width * .5 + (i - agents.length / 2) * (compact() ? 22 : 38), y: height * .36 + i % 2 * 35 };
        label = 'Dựng các mục ngoài màn hình';
      }
      a.x = clamp(tip.x, 8, width - 28); a.y = clamp(tip.y, 40, height - 95); a.vx = 0; a.vy = 0; a.trail = [];
      a.el.style.transform = `translate3d(${a.x}px,${a.y}px,0)`; a.el.style.opacity = '1';
      a.el.classList.toggle('label-left', a.x > width - 160); a.el.classList.toggle('has-label', i < (compact() ? 2 : 5));
      setState(a, 'building', label);
    });
    nowState(`Đang dựng toàn trang · ${progress}%`);
    if (buildItems.every(item => item.q >= 1) || elapsed >= 5.3) completeStartup();
  }
  function tick(stamp) {
    raf = 0;
    if (!enabled() || document.hidden) return;
    const elapsed = previous ? Math.min((stamp - previous) / 1000, .25) : .016;
    const dt = Math.min(elapsed, .04);
    previous = stamp; clock += elapsed;
    if (dirty) cacheTargets();
    layer.dataset.phase = phase;
    if (phase === 'BUILDING') {
      tickStartup(); subscribers.forEach(fn => fn(stamp, dt)); raf = requestAnimationFrame(safeTick); return;
    }
    if (phase === 'FINISHING') {
      cancelTasks(); tasks = [];
      agents.forEach((a, i) => { a.tx = width * .5 + (i - agents.length / 2) * 25; a.ty = height * .4; a.rest = clock + .7; });
      if (clock >= finishAt) { phase = 'FOLLOWING'; lastInput = clock; buildUI.hidden = true; }
    }
    const protect = protectedInput(), idle = clock - lastInput > 3;
    layer.dataset.phase = phase === 'FINISHING' ? 'FINISHING' : idle && settings.idle ? 'IDLE_WORKING' : 'FOLLOWING';
    layer.dataset.mode = protect ? 'yield' : idle ? 'idle' : 'follow';
    layer.dataset.clock = clock.toFixed(2);
    nowState(protect ? 'Đội đang nhường chỗ cho bạn' : idle ? (settings.idle ? 'Tự phối hợp · Không cần cuộn' : 'Nghỉ ngơi · Tự làm đã tắt') : 'Đang lắng nghe chuyển động của bạn');
    tickTasks(Math.min(elapsed, .1), idle, protect); chooseTargets(dt, idle, protect); drawTasks();
    subscribers.forEach(fn => fn(stamp, dt));
    raf = requestAnimationFrame(safeTick);
  }
  function safeTick(stamp) {
    try { tick(stamp); } catch (error) { settings.enabled = false; completeStartup(false); sync(); console.error('Motion stopped; portfolio content remains available.', error); }
  }
  function start() { if (!raf && enabled() && !document.hidden) { previous = 0; raf = requestAnimationFrame(safeTick); } }
  function sync() {
    cancelAnimationFrame(raf); raf = 0; previous = 0;
    const on = enabled(); layer.hidden = !on;
    document.body.classList.toggle('effects-off', !on);
    toggle.setAttribute('aria-pressed', String(on)); document.getElementById('effects-state').textContent = on ? 'Bật' : 'Tắt';
    replay.disabled = reduced.matches;
    if (!on) { completeStartup(false); cancelTasks(); tasks = []; ctx?.clearRect(0, 0, width, height); nowState(reduced.matches ? 'Giảm chuyển động · Nội dung đầy đủ' : 'Đội con trỏ đang nghỉ'); }
    start();
  }
  function interact(event) {
    lastInput = clock;
    if (event && event.type !== 'scroll' && 'clientX' in event) { pointer.x = event.clientX; pointer.y = event.clientY; pointer.known = true; }
    tasks.forEach(t => { t.cancelled = true; });
    start();
  }
  // A shared animation clock for the swarm and all ambient drawing.
  window.PortfolioMotion = Object.freeze({
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    active: enabled,
    guide(id) {
      const el = document.getElementById(id);
      if (!el || !['projects', 'about', 'contact', 'school'].includes(id)) return;
      if (phase === 'BUILDING') completeStartup();
      guide = { el, until: clock + 5 }; interact(); dirty = true;
      el.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    }
  });
  document.getElementById('year').textContent = new Date().getFullYear();
  const avatar = document.querySelector('.portrait img');
  avatar.addEventListener('error', () => { avatar.hidden = true; });
  if (avatar.complete && !avatar.naturalWidth) avatar.hidden = true;
  controls.hidden = false;
  document.getElementById('activity').value = settings.activity;
  document.getElementById('follow-pointer').checked = settings.follow;
  document.getElementById('idle-work').checked = settings.idle;
  toggle.addEventListener('click', () => { if (reduced.matches) return; settings.enabled = !settings.enabled; save(); sync(); });
  document.getElementById('activity').addEventListener('change', e => { settings.activity = e.target.value; rebuildAgents(); save(); });
  document.getElementById('follow-pointer').addEventListener('change', e => { settings.follow = e.target.checked; save(); interact(); });
  document.getElementById('idle-work').addEventListener('change', e => { settings.idle = e.target.checked; save(); interact(); });
  replay.addEventListener('click', () => {
    if (reduced.matches) return;
    settings.enabled = true; beginStartup(); pointer = { ...pointer, x: width * .5, y: height * .4, known: true }; interact(); save(); sync();
  });
  document.getElementById('build-skip').addEventListener('click', () => completeStartup());
  document.addEventListener('focusin', e => { if (phase === 'BUILDING' && !e.target.closest('#build-progress,#swarm-controls')) completeStartup(); });
  window.addEventListener('pointermove', interact, { passive: true });
  window.addEventListener('pointerdown', e => { pointer.down = true; interact(e); }, { passive: true });
  window.addEventListener('pointerup', () => { pointer.down = false; });
  window.addEventListener('pointercancel', () => { pointer.down = false; });
  window.addEventListener('keydown', () => interact(), { passive: true });
  window.addEventListener('scroll', () => { dirty = true; tasks.forEach(t => { t.stale = true; }); interact(); }, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pageshow', () => { dirty = true; sync(); });
  document.addEventListener('visibilitychange', () => { dirty = true; sync(); });
  document.addEventListener('selectionchange', () => { selectedText = Boolean(getSelection()?.toString()); if (selectedText) interact(); });
  document.addEventListener('pointerover', e => { hovered = e.target.closest('.project-card,.button'); }, { passive: true });
  document.addEventListener('pointerout', e => { if (!e.relatedTarget || !hovered?.contains(e.relatedTarget)) hovered = null; }, { passive: true });
  document.addEventListener('click', e => { if (enabled() && e.detail) { waves.push({ x: e.clientX, y: e.clientY, start: clock }); if (waves.length > 5) waves.shift(); } });
  reduced.addEventListener('change', sync);
  if ('ResizeObserver' in window) new ResizeObserver(() => { dirty = true; }).observe(document.querySelector('main'));
  resize(); rebuildAgents(); beginStartup(); sync();
})();
