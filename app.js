(() => {
  'use strict';
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('effects-toggle');
  const replay = document.getElementById('replay');
  const announcement = document.getElementById('announcement');
  const colors = ['#c4f46d', '#a5c6ff', '#e4b2f7', '#ffcc80', '#78e5d5', '#ff9db9'];
  const roles = { frame: 'Kéo khung', type: 'Viết chữ', place: 'Đặt hình', align: 'Căn hàng' };
  const arrow = '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M2 2v23l6-6 5 10 5-3-5-9h9Z"/></svg>';
  let saved = null;
  try { saved = localStorage.getItem('hb-build-effects'); } catch { /* Storage is optional. */ }
  let enabled = !reducedMotion.matches && saved !== 'off';
  let raf = 0;
  let scenes = [];

  function moveTo(cursor, point, opacity, label, width) {
    // Keep labels inside the scene without moving the pointer's actual tip.
    cursor.classList.toggle('label-left', point.x > width - 130);
    cursor.style.transform = `translate3d(${point.x}px,${point.y}px,0)`;
    cursor.style.opacity = opacity;
    cursor.querySelector('b').textContent = label;
  }
  function paintFrame(frame, box, opacity) {
    Object.assign(frame.style, {
      left: `${box.x}px`, top: `${box.y}px`, width: `${Math.max(1, box.w)}px`,
      height: `${Math.max(1, box.h)}px`, opacity
    });
  }
  function dragFrame(frame, box, q, opacity) {
    paintFrame(frame, { ...box, w: box.w * q, h: box.h * q }, opacity);
    return { x: box.x + box.w * q, y: box.y + box.h * q };
  }
  function placeElement(frame, box, q, opacity) {
    const x = box.x + (1 - q) * 32, y = box.y - (1 - q) * 24;
    paintFrame(frame, { ...box, x, y }, opacity);
    return { x: x + box.w * .8, y: y + box.h * .25 };
  }
  function revealText(item, frame, box, q, opacity) {
    const line = parseFloat(getComputedStyle(item).lineHeight) || 24;
    const count = Math.max(1, Math.ceil(box.h / line));
    const position = q * count;
    const row = Math.min(count - 1, Math.floor(position));
    const x = clamp(position - row);
    const y1 = Math.min(100, row * line / box.h * 100);
    const y2 = Math.min(100, (row + 1) * line / box.h * 100);
    item.style.clipPath = `polygon(0 0,100% 0,100% ${y1}%,${x * 100}% ${y1}%,${x * 100}% ${y2}%,0 ${y2}%)`;
    paintFrame(frame, { x: box.x, y: box.y + row * line, w: box.w * x, h: Math.min(line, box.h) }, opacity);
    return { x: box.x + box.w * x, y: box.y + Math.min(box.h, (row + .5) * line) };
  }
  function alignElement(frame, box, q, opacity) {
    paintFrame(frame, { ...box, w: box.w * q }, opacity);
    return { x: box.x + box.w * q, y: box.y + box.h / 2 };
  }
  function layoutBox(el, section) {
    // Read the reserved layout, not the temporarily translated/rotated visual.
    let x = 0, y = 0, node = el;
    while (node && node !== section) {
      x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function finishItem(item) {
    item.high = 1;
    item.el.classList.remove('constructing');
    item.el.style.removeProperty('--q');
    item.el.style.removeProperty('clip-path');
  }
  function finishSection(scene) {
    scene.items.forEach(finishItem);
    scene.tools.hidden = true;
  }
  function failOpen(error) {
    enabled = false;
    scenes.forEach(finishSection);
    document.body.classList.add('effects-off');
    toggle.setAttribute('aria-pressed', 'false');
    document.getElementById('effects-state').textContent = 'Tắt';
    console.error('Construction effect disabled; content remains available.', error);
  }
  function update() {
    raf = 0;
    try {
      const vh = innerHeight;
      const maxScroll = document.documentElement.scrollHeight - vh;
      document.querySelector('.experience-controls').style.setProperty('--scroll', maxScroll > 0 ? scrollY / maxScroll : 1);
      if (!enabled) return;
      scenes.forEach(scene => {
        const rect = scene.el.getBoundingClientRect();
        const visible = rect.top < vh && rect.bottom > 0;
        scene.cursors.forEach(c => { c.style.opacity = 0; });
        scene.frames.forEach(f => { f.style.opacity = 0; });
        const active = [];
        scene.items.forEach(item => {
          if (item.high >= 1) return;
          const box = layoutBox(item.el, scene.el);
          const top = rect.top + box.y;
          // Each component gets nearly a full viewport of scroll travel. Tall mobile
          // sections no longer finish their timelines before their content is visible.
          const travel = vh * .85 + Math.min(box.h, vh * .55);
          item.high = Math.max(item.high, clamp((vh * .98 - top) / travel));
          if (item.high >= 1) { finishItem(item); return; }
          item.el.classList.add('constructing');
          const kind = item.el.dataset.kind;
          const q = clamp((item.high - .04) / (kind === 'frame' ? .62 : .83));
          item.el.style.setProperty('--q', q);
          // Use a private frame to update the reveal even when it is off screen.
          let point;
          switch (kind) {
            case 'frame': point = dragFrame(item.frame, box, q, 0); break;
            case 'place': point = placeElement(item.frame, box, q, 0); break;
            case 'align': point = alignElement(item.frame, box, q, 0); break;
            default: point = revealText(item.el, item.frame, box, q, 0);
          }
          // The last scroll segment is a visible alignment/confirmation phase.
          if (q >= 1) {
            item.el.classList.remove('constructing');
            item.el.style.removeProperty('clip-path');
          }
          if (visible && item.high > 0 && top + box.h > 45 && top < vh - 60) {
            active.push({ item, box, point, q });
          }
        });
        scene.tools.hidden = !active.length;
        // Give independent visible components their own pointer first. Fill unused
        // slots with collaborators anchored to the same frame, never overwriting
        // another operation just because it has the same role.
        const jobs = active.slice(0, 6).map(job => ({ ...job, assistant: 0 }));
        for (let i = 0; jobs.length < 6 && active.length; i++) {
          jobs.push({ ...active[i % active.length], assistant: 1 + Math.floor(i / active.length) });
        }
        jobs.forEach((job, i) => {
          const { item, box, point, q, assistant } = job;
          const opacity = '1';
          let tip = point;
          let label = `${String(i + 1).padStart(2, '0')} · ${q >= 1 ? 'Hoàn thiện ✓' : roles[item.el.dataset.kind]}`;
          if (!assistant) {
            // Show the operation's own frame and pointer together.
            const source = item.frame.style;
            Object.assign(scene.frames[i].style, {
              left: source.left, top: source.top, width: source.width, height: source.height, opacity
            });
          } else {
            // A collaborator handles another edge of that exact same component.
            const w = item.el.dataset.kind === 'frame' ? box.w * q : box.w;
            const h = item.el.dataset.kind === 'frame' ? box.h * q : box.h;
            const edge = assistant % 3;
            tip = edge === 1 ? { x: box.x + w * .12, y: box.y + h }
              : edge === 2 ? { x: box.x + w, y: box.y + h * .3 }
              : { x: box.x + w * .5, y: box.y };
            paintFrame(scene.frames[i], { x: tip.x - 4, y: tip.y - 4, w: 8, h: 8 }, opacity);
            label = `${String(i + 1).padStart(2, '0')} · ${edge === 1 ? 'Căn lề' : edge === 2 ? 'Giữ khung' : 'Đặt điểm neo'}`;
          }
          // If an operation is on a partly offscreen component, place its pointer
          // on the nearest visible edge of that component, rather than offscreen.
          const y = clamp(tip.y, Math.max(box.y, 60 - rect.top), Math.min(box.y + box.h, vh - 100 - rect.top));
          const x = clamp(tip.x, 3, rect.width - 28);
          moveTo(scene.cursors[i], { x, y }, opacity, label, rect.width);
        });
      });
    } catch (error) { failOpen(error); }
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(update); }
  function applyMode() {
    document.body.classList.toggle('effects-off', !enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    document.getElementById('effects-state').textContent = enabled ? 'Bật' : 'Tắt';
    replay.disabled = reducedMotion.matches;
    if (!enabled) scenes.forEach(finishSection);
    schedule();
  }
  function reset() {
    scenes.forEach(scene => {
      scene.items.forEach(item => {
        item.high = 0;
        item.el.classList.add('constructing');
        item.el.style.setProperty('--q', 0);
        item.el.style.removeProperty('clip-path');
      });
      scene.tools.hidden = !enabled;
    });
  }
  function completeBefore(target) {
    const index = scenes.findIndex(scene => scene.el === target.closest('.scene'));
    if (index >= 0) scenes.slice(0, index + 1).forEach(finishSection);
  }
  function rememberMode() {
    try { localStorage.setItem('hb-build-effects', enabled ? 'on' : 'off'); } catch { /* Optional preference. */ }
  }
  try {
    scenes = [...document.querySelectorAll('.scene')].map(el => {
      const tools = document.createElement('div');
      tools.className = 'build-tools'; tools.setAttribute('aria-hidden', 'true');
      const cursors = [], frames = [];
      colors.forEach(color => {
        const frame = document.createElement('div'); frame.className = 'selection-frame'; frame.style.color = color;
        const cursor = document.createElement('div'); cursor.className = 'virtual-cursor'; cursor.style.color = color;
        cursor.innerHTML = `${arrow}<span><b></b></span>`;
        tools.append(frame, cursor); frames.push(frame); cursors.push(cursor);
      });
      const items = [...el.querySelectorAll('.build-item')].map(item => {
        const frame = document.createElement('div');
        return { el: item, frame, high: 0 };
      });
      el.append(tools);
      return { el, items, tools, cursors, frames };
    });
    document.querySelector('.experience-controls').hidden = false;
    document.getElementById('year').textContent = new Date().getFullYear();
    const avatar = document.querySelector('.portrait img');
    avatar.addEventListener('error', () => { avatar.hidden = true; });
    if (avatar.complete && !avatar.naturalWidth) avatar.hidden = true;
    if (enabled) reset();
    applyMode();
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) completeBefore(target);
    }
    toggle.addEventListener('click', () => {
      if (reducedMotion.matches) {
        announcement.textContent = 'Thiết bị đang bật chế độ giảm chuyển động. Nội dung được hiển thị đầy đủ.';
        return;
      }
      enabled = !enabled;
      rememberMode();
      if (enabled) reset();
      applyMode();
      announcement.textContent = `Đã ${enabled ? 'bật' : 'tắt'} hiệu ứng dựng web.`;
    });
    replay.addEventListener('click', () => {
      if (reducedMotion.matches) return;
      enabled = true; rememberMode();
      history.replaceState(null, '', location.pathname + location.search);
      window.scrollTo({ top: 0, behavior: 'instant' });
      reset(); applyMode();
      announcement.textContent = 'Đã dựng lại. Sáu con trỏ cùng thao tác. Cuộn chậm để xem rõ từng bước.';
    });
    document.addEventListener('focusin', e => { if (e.target instanceof Element) completeBefore(e.target); });
    document.addEventListener('click', e => {
      const anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;
      const target = document.getElementById(anchor.hash.slice(1));
      if (target) completeBefore(target);
    });
    window.addEventListener('hashchange', () => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) completeBefore(target);
      schedule();
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) enabled = false; applyMode(); });
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.querySelector('main'));
  } catch (error) { failOpen(error); }
})();
