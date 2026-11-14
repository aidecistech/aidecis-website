// Animated architecture on the home page (14 Nov 2026): one clock drives the pulse, the active node and the bubble.
(() => {
  const fig = document.querySelector('[data-flowviz]');
  if (!fig) return;
  const STEPS = [{"node": "systems", "path": null}, {"node": "gateway", "path": "a"}, {"node": "sclaim", "path": "b"}, {"node": "policy", "path": "c"}, {"node": "approval", "path": "d"}, {"node": "people", "path": "e"}, {"node": "systems", "path": "f"}, {"node": "record", "path": "g"}];
  const STEP_MS = 3000, MOVE_MS = 900, SHOW_UNTIL = 2750;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = window.matchMedia('(max-width: 900px)');
  const nodes = {}; fig.querySelectorAll('[data-node]').forEach((n) => { nodes[n.dataset.node] = n; });
  const bubbles = [...fig.querySelectorAll('[data-bubble]')];
  const toggle = fig.querySelector('[data-fv-toggle]');
  const svg = () => fig.querySelector(narrow.matches ? '.fv-port' : '.fv-land');
  let start = performance.now(), paused = false, pausedAt = 0, visible = true, last = -1;
  const ease = (x) => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const place = (s, p) => {
    const pulse = s.querySelector('.fv-pulse'), halo = s.querySelector('.fv-pulse-halo');
    const set = (x, y) => { [pulse, halo].forEach((c) => { c.setAttribute('cx', x); c.setAttribute('cy', y); }); };
    if (!p) { set(-50, -50); return; }
    const path = s.querySelector('[data-path="' + p.path + '"]');
    const pt = path.getPointAtLength(path.getTotalLength() * p.f);
    set(pt.x, pt.y);
  };
  const render = (t) => {
    const total = STEPS.length * STEP_MS;
    const e = ((t % total) + total) % total;
    const k = Math.floor(e / STEP_MS), within = e - k * STEP_MS;
    const step = STEPS[k];
    const moving = step.path && within < MOVE_MS && !reduce;
    const shown = (!step.path || within >= MOVE_MS || reduce) && within < SHOW_UNTIL;
    fig.querySelectorAll('.fv-lines').forEach((s) => {
      s.querySelectorAll('.fv-path').forEach((p) => p.classList.toggle('is-live', p.dataset.path === step.path && within < SHOW_UNTIL));
      place(s, moving ? { path: step.path, f: ease(within / MOVE_MS) } : null);
    });
    Object.entries(nodes).forEach(([id, n]) => n.classList.toggle('is-active', shown && id === step.node));
    bubbles.forEach((b, i) => b.classList.toggle('is-on', shown && i === k));
    last = k;
  };
  const frame = (now) => {
    if (!paused && visible) render(now - start);
    requestAnimationFrame(frame);
  };
  if (toggle) {
    toggle.hidden = false;
    const label = () => { toggle.textContent = window.AidecisI18n ? window.AidecisI18n.t(paused ? 'Play' : 'Pause') : (paused ? 'Play' : 'Pause'); };
    toggle.addEventListener('click', () => {
      paused = !paused;
      if (paused) pausedAt = performance.now() - start; else start = performance.now() - pausedAt;
      label();
    });
    document.addEventListener('aidecis:languagechange', label);
    label();
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      const was = visible; visible = entry.isIntersecting;
      if (visible && !was && !paused) start = performance.now() - (pausedAt || 0);
      if (!visible && was) pausedAt = performance.now() - start;
    }).observe(fig);
  }
  render(0);
  requestAnimationFrame(frame);
})();
