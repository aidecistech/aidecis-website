// Inside S-CLAIM (17 Nov 2026): one signal travels the steps. Dashed connectors join the steps; a gold pulse runs the
// connector to the next step, which then lights up. All text stays visible; motion only highlights.
(() => {
  const fig = document.querySelector('[data-sclaimviz]');
  if (!fig) return;
  const board = fig.querySelector('.sv-board');
  const steps = [...fig.querySelectorAll('.sv-step')];
  const toggle = fig.querySelector('[data-sv-toggle]');
  if (!board || !steps.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = window.matchMedia('(min-width: 901px)');
  const NS = 'http://www.w3.org/2000/svg';
  const STEP_MS = 3000, MOVE_MS = 1000;

  const layer = (cls) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); board.appendChild(s); return s; };
  const lines = layer('sv-lines');
  const top = layer('sv-pulse-layer');
  const halo = document.createElementNS(NS, 'circle'); halo.setAttribute('class', 'sv-pulse-halo'); halo.setAttribute('r', '15');
  const dot = document.createElementNS(NS, 'circle'); dot.setAttribute('class', 'sv-pulse'); dot.setAttribute('r', '7');
  top.append(halo, dot);
  let paths = [];

  // An elbow from the centre of one step to the centre of the next: across in one row, or down through the gap between rows.
  const draw = () => {
    lines.innerHTML = '';
    paths = [];
    const b = board.getBoundingClientRect();
    [lines, top].forEach((s) => { s.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`); });
    if (!wide.matches) return;
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - b.left, r: r.right - b.left, t: r.top - b.top, b: r.bottom - b.top, x: (r.left + r.right) / 2 - b.left, y: (r.top + r.bottom) / 2 - b.top }; };
    for (let i = 1; i < steps.length; i++) {
      const a = box(steps[i - 1]), c = box(steps[i]);
      let d;
      if (c.t >= a.b - 1) { const my = (a.b + c.t) / 2; d = `M${a.x},${a.b} V${my} H${c.x} V${c.t}`; }
      else d = `M${a.r},${a.y} H${c.l}`;
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'sv-path'); lines.appendChild(p);
      paths.push(p);
    }
  };
  draw();
  window.addEventListener('resize', () => { draw(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  document.addEventListener('aidecis:languagechange', () => requestAnimationFrame(draw));
  if (reduce) return;

  let start = performance.now(), paused = false, pausedAt = 0, visible = false;
  const ease = (x) => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const place = (x, y) => { [dot, halo].forEach((c) => { c.setAttribute('cx', x); c.setAttribute('cy', y); }); };
  const render = (t) => {
    const total = steps.length * STEP_MS;
    const e = ((t % total) + total) % total;
    const k = Math.floor(e / STEP_MS), within = e - k * STEP_MS;
    const path = k > 0 ? paths[k - 1] : null;
    const moving = !!path && within < MOVE_MS;
    paths.forEach((p, i) => p.classList.toggle('is-live', i === k - 1));
    if (moving) { const pt = path.getPointAtLength(path.getTotalLength() * ease(within / MOVE_MS)); place(pt.x, pt.y); }
    else place(-50, -50);
    steps.forEach((s, i) => s.classList.toggle('is-active', i === k && !moving));
  };
  const frame = (now) => { if (!paused && visible) render(now - start); requestAnimationFrame(frame); };
  const setPlaying = () => fig.classList.toggle('is-playing', !paused && visible);
  if (toggle) {
    toggle.hidden = false;
    const label = () => { const w = paused ? 'Play' : 'Pause'; toggle.textContent = window.AidecisI18n ? window.AidecisI18n.t(w) : w; };
    toggle.addEventListener('click', () => {
      paused = !paused;
      if (paused) pausedAt = performance.now() - start; else start = performance.now() - pausedAt;
      label(); setPlaying();
    });
    document.addEventListener('aidecis:languagechange', label);
    label();
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      const was = visible; visible = en.isIntersecting;
      if (visible && !was && !paused) { start = performance.now() - (pausedAt || 0); draw(); }
      if (!visible && was) pausedAt = performance.now() - start;
      setPlaying();
    }, { threshold: 0.15 }).observe(fig);
  } else { visible = true; setPlaying(); }
  requestAnimationFrame(frame);
})();
