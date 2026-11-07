/* Quiet interactions: static navigation feedback, no particles, glitch or mouse halo. */
(() => {
 const links=[...document.querySelectorAll('nav a')];
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(!visible)return;links.forEach(a=>{if(a.hash==='#'+visible.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});},{rootMargin:'-10% 0px -55% 0px'});document.querySelectorAll('.scene').forEach(s=>observer.observe(s));}
})();
