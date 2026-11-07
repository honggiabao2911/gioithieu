(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const background = document.createElement('div');
  background.className = 'ambient-background';
  background.setAttribute('aria-hidden', 'true');
  background.innerHTML = '<div class="aurora aurora-one"></div><div class="aurora aurora-two"></div><div class="ambient-grid"></div><canvas></canvas>';
  const halo = document.createElement('div');
  halo.className = 'pointer-halo'; halo.setAttribute('aria-hidden', 'true');
  document.body.prepend(background, halo);
  const canvas = background.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, nodes = [], raf = 0, last = 0, previous = 0;
  let pointer = { x: -500, y: -500 }, pointerDirty = false;
  const alive = () => !reduced.matches && !document.body.classList.contains('effects-off');
  const interactive = () => alive() && fine.matches;
  function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = width < 640 || navigator.connection?.saveData ? 16 : 36;
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      vx: (Math.random() - .5) * .12, vy: (Math.random() - .5) * .1,
      radius: Math.random() * 1.3 + .5
    }));
  }
  function draw(now) {
    raf = 0;
    if (!alive() || document.hidden) return;
    if (now - last > 33) {
      const step = previous ? Math.min((now - previous) / 16.67, 3) : 1;
      previous = now; last = now;
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          node.x = (node.x + node.vx * step + width) % width;
          node.y = (node.y + node.vy * step + height) % height;
          ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(196,244,109,.32)'; ctx.fill();
          for (let j = i + 1; j < nodes.length; j++) {
            const other = nodes[j];
            const distance = Math.hypot(node.x - other.x, node.y - other.y);
            if (distance > 135) continue;
            ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(196,244,109,${(1 - distance / 135) * .09})`;
            ctx.stroke();
          }
        }
      }
      if (pointerDirty) {
        halo.style.transform = `translate3d(${pointer.x - 180}px,${pointer.y - 180}px,0)`;
        pointerDirty = false;
      }
    }
    raf = requestAnimationFrame(draw);
  }
  function start() {
    if (!raf && alive() && !document.hidden) { previous = 0; raf = requestAnimationFrame(draw); }
  }
  function syncMode() {
    cancelAnimationFrame(raf); raf = 0;
    background.hidden = !alive();
    halo.hidden = !interactive();
    if (!alive()) {
      document.querySelectorAll('.interaction-spark').forEach(el => { el.getAnimations().forEach(a => a.cancel()); el.remove(); });
      document.querySelectorAll('.project-art,.magnetic').forEach(el => {
        el.style.removeProperty('--tilt-x'); el.style.removeProperty('--tilt-y');
        el.style.removeProperty('--magnet-x'); el.style.removeProperty('--magnet-y');
      });
      document.querySelectorAll('.glitch-once').forEach(el => el.classList.remove('glitch-once'));
    }
    start();
  }
  const title = document.querySelector('h1');
  title.dataset.text = title.textContent;
  title.addEventListener('pointerenter', () => { if (interactive()) title.classList.add('glitch-once'); });
  title.addEventListener('animationend', () => title.classList.remove('glitch-once'));
  document.querySelectorAll('.project-card').forEach(card => {
    const art = card.querySelector('.project-art');
    card.addEventListener('pointermove', event => {
      if (!interactive()) return;
      const r = art.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (event.clientY - r.top) / r.height));
      art.style.setProperty('--tilt-x', `${(y - .5) * -7}deg`);
      art.style.setProperty('--tilt-y', `${(x - .5) * 9}deg`);
      art.style.setProperty('--shine-x', `${x * 100}%`);
      art.style.setProperty('--shine-y', `${y * 100}%`);
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      art.style.setProperty('--tilt-x', '0deg'); art.style.setProperty('--tilt-y', '0deg');
    });
  });
  document.querySelectorAll('.button').forEach(button => {
    button.classList.add('magnetic');
    button.addEventListener('pointermove', event => {
      if (!interactive()) return;
      const r = button.getBoundingClientRect();
      button.style.setProperty('--magnet-x', `${(event.clientX - r.left - r.width / 2) * .08}px`);
      button.style.setProperty('--magnet-y', `${(event.clientY - r.top - r.height / 2) * .12}px`);
    }, { passive: true });
    button.addEventListener('pointerleave', () => {
      button.style.setProperty('--magnet-x', '0px'); button.style.setProperty('--magnet-y', '0px');
    });
  });
  document.addEventListener('pointermove', event => {
    if (!interactive()) return;
    pointer = { x: event.clientX, y: event.clientY }; pointerDirty = true;
    halo.classList.add('is-visible');
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => halo.classList.remove('is-visible'));
  document.addEventListener('click', event => {
    if (!alive() || !event.target.closest('a,button') || event.detail === 0 || !Element.prototype.animate) return;
    // A bounded, short burst. It never intercepts the click or navigation.
    if (document.querySelectorAll('.interaction-spark').length > 24) return;
    for (let i = 0; i < 8; i++) {
      const spark = document.createElement('span');
      spark.className = 'interaction-spark'; spark.setAttribute('aria-hidden', 'true');
      spark.style.left = `${event.clientX}px`; spark.style.top = `${event.clientY}px`;
      document.body.append(spark);
      const angle = i / 8 * Math.PI * 2;
      const animation = spark.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * 42}px,${Math.sin(angle) * 42}px) scale(0)`, opacity: 0 }
      ], { duration: 650, easing: 'cubic-bezier(.15,.65,.3,1)' });
      animation.onfinish = animation.oncancel = () => spark.remove();
    }
  });
  // Navigation feedback remains useful with all animation turned off.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const section = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!section) return;
      document.querySelectorAll('nav a').forEach(link => {
        if (link.hash === `#${section.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-10% 0px -55% 0px', threshold: 0 });
    document.querySelectorAll('.scene').forEach(section => observer.observe(section));
  }
  new MutationObserver(syncMode).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  reduced.addEventListener('change', syncMode);
  fine.addEventListener('change', syncMode);
  document.addEventListener('visibilitychange', syncMode);
  window.addEventListener('resize', resize, { passive: true });
  resize(); syncMode();
})();
