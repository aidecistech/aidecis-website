// Inside a decision (17 Nov 2026): a signal from the client's systems fans out to the models, their answers come
// together in one decision dossier, and the dossier goes to the person who decides. Motion only highlights.
(() => {
  const fig = document.querySelector('[data-sclaimviz]');
  if (!fig) return;
  const board = fig.querySelector('.sv-board');
  const node = (id) => fig.querySelector(`[data-node="${id}"]`);
  const MODELS = ['sclaim', 'policy', 'history', 'language'];
  const src = node('source'), dossier = node('dossier'), person = node('person');
  if (!board || !src || !dossier || !person || MODELS.some((m) => !node(m))) return;
  const toggle = fig.querySelector('[data-sv-toggle]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = window.matchMedia('(min-width: 901px)');
  const NS = 'http://www.w3.org/2000/svg';
  const layer = (cls) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); board.appendChild(s); return s; };
  const lines = layer('sv-lines'), top = layer('sv-pulse-layer');
  const pulses = MODELS.map(() => {
    const h = document.createElementNS(NS, 'circle'); h.setAttribute('class', 'sv-pulse-halo'); h.setAttribute('r', '14');
    const d = document.createElementNS(NS, 'circle'); d.setAttribute('class', 'sv-pulse'); d.setAttribute('r', '6');
    top.append(h, d); return [h, d];
  });
  // Paths: out[i] source -> model i, in[i] model i -> dossier, last dossier -> person.
  // Speech bubbles: one per stage, above (or below) the part they explain, kept inside the board.
  const bubbles = { source: src, models: fig.querySelector('.sv-models'), dossier, person };
  const bubbleEls = Object.fromEntries(Object.keys(bubbles).map((k) => [k, fig.querySelector(`[data-bubble="${k}"]`)]));
  const placeBubbles = (b) => {
    Object.entries(bubbles).forEach(([k, target]) => {
      const el = bubbleEls[k];
      if (!el || !target) return;
      const r = target.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      const cx = (r.left + r.right) / 2 - b.left;
      const left = Math.max(0, Math.min(b.width - w, cx - w / 2));
      const top = el.classList.contains('sv-below') ? r.bottom - b.top + 12 : r.top - b.top - h - 12;
      el.style.left = `${left}px`; el.style.top = `${top}px`;
      el.style.setProperty('--tail', `${Math.max(16, Math.min(w - 16, cx - left))}px`);
    });
  };
  let out = [], into = [], last = null;
  const draw = () => {
    lines.innerHTML = ''; out = []; into = []; last = null;
    const b = board.getBoundingClientRect();
    [lines, top].forEach((s) => s.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`));
    if (!wide.matches) return;
    placeBubbles(b);
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - b.left, r: r.right - b.left, t: r.top - b.top, b: r.bottom - b.top, y: (r.top + r.bottom) / 2 - b.top, x: (r.left + r.right) / 2 - b.left }; };
    const add = (d) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'sv-path'); lines.appendChild(p); return p; };
    const s = box(src), dz = box(dossier), pe = box(person);
    MODELS.forEach((m) => {
      const k = box(node(m));
      const mx1 = (s.r + k.l) / 2, mx2 = (k.r + dz.l) / 2;
      out.push(add(`M${s.r},${s.y} H${mx1} V${k.y} H${k.l}`));
      into.push(add(`M${k.r},${k.y} H${mx2} V${dz.y} H${dz.l}`));
    });
    last = add(`M${dz.x},${dz.b} V${pe.t}`);
  };
  draw();
  window.addEventListener('resize', draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  document.addEventListener('aidecis:languagechange', () => requestAnimationFrame(draw));
  if (reduce) return;

  // One cycle: the source lights, pulses run out to the four models, the models light, pulses run in to the dossier,
  // the dossier lights, a pulse runs to the person, the person lights.
  const PH = [['source', 1600], ['out', 1000], ['models', 2600], ['in', 1000], ['dossier', 1500], ['last', 800], ['person', 2600]];
  const TOTAL = PH.reduce((a, [, ms]) => a + ms, 0);
  const ease = (x) => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const set = (c, x, y) => { c.forEach((e) => { e.setAttribute('cx', x); e.setAttribute('cy', y); }); };
  const hideAll = () => pulses.forEach((p) => set(p, -50, -50));
  const at = (path, f) => path.getPointAtLength(path.getTotalLength() * ease(f));
  let start = performance.now(), paused = false, pausedAt = 0, visible = false;
  const say = (k) => Object.entries(bubbleEls).forEach(([id, el]) => { if (el) el.classList.toggle('is-on', id === k); });
  const lit = (ids) => { ['source', ...MODELS, 'dossier', 'person'].forEach((id) => node(id).classList.toggle('is-active', ids.includes(id))); };
  const render = (t) => {
    let e = ((t % TOTAL) + TOTAL) % TOTAL, k = 0;
    while (e >= PH[k][1]) { e -= PH[k][1]; k++; }
    const [name, ms] = PH[k], f = e / ms;
    [...out, ...into, ...(last ? [last] : [])].forEach((p) => p.classList.remove('is-live'));
    hideAll();
    say(name === 'source' ? 'source' : name === 'out' || name === 'models' ? 'models' : name === 'in' || name === 'dossier' ? 'dossier' : 'person');
    if (name === 'source') lit(['source']);
    else if (name === 'out') { lit([]); out.forEach((p, i) => { p.classList.add('is-live'); const pt = at(p, f); set(pulses[i], pt.x, pt.y); }); }
    else if (name === 'models') lit(MODELS);
    else if (name === 'in') { lit([]); into.forEach((p, i) => { p.classList.add('is-live'); const pt = at(p, f); set(pulses[i], pt.x, pt.y); }); }
    else if (name === 'dossier') lit(['dossier']);
    else if (name === 'last') { lit([]); if (last) { last.classList.add('is-live'); const pt = at(last, f); set(pulses[0], pt.x, pt.y); } }
    else lit(['person']);
  };
  const frame = (now) => { if (!paused && visible) render(now - start); requestAnimationFrame(frame); };
  if (toggle) {
    toggle.hidden = false;
    const label = () => { const w = paused ? 'Play' : 'Pause'; toggle.textContent = window.AidecisI18n ? window.AidecisI18n.t(w) : w; };
    toggle.addEventListener('click', () => {
      paused = !paused;
      if (paused) pausedAt = performance.now() - start; else start = performance.now() - pausedAt;
      label();
    });
    document.addEventListener('aidecis:languagechange', label);
    label();
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      const was = visible; visible = en.isIntersecting;
      if (visible && !was && !paused) { start = performance.now() - (pausedAt || 0); draw(); }
      if (!visible && was) pausedAt = performance.now() - start;
    }, { threshold: 0.15 }).observe(fig);
  } else visible = true;
  requestAnimationFrame(frame);
})();
