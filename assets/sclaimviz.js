// Inside S-CLAIM (17 Nov 2026): steps one signal takes, highlighted in turn. All text stays visible; motion only highlights.
(() => {
  const fig = document.querySelector('[data-sclaimviz]');
  if (!fig) return;
  const steps = [...fig.querySelectorAll('.sv-step')];
  const toggle = fig.querySelector('[data-sv-toggle]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !steps.length) return;
  const STEP_MS = 2800;
  let i = 0, paused = false, visible = false, timer = null;
  const show = () => { steps.forEach((s, k) => s.classList.toggle('is-active', k === i)); };
  const tick = () => { i = (i + 1) % steps.length; show(); };
  const run = () => {
    const on = !paused && visible;
    fig.classList.toggle('is-playing', on);
    if (on && !timer) { show(); timer = setInterval(tick, STEP_MS); }
    if (!on && timer) { clearInterval(timer); timer = null; }
  };
  if (toggle) {
    toggle.hidden = false;
    const label = () => { const w = paused ? 'Play' : 'Pause'; toggle.textContent = window.AidecisI18n ? window.AidecisI18n.t(w) : w; };
    toggle.addEventListener('click', () => { paused = !paused; label(); run(); });
    document.addEventListener('aidecis:languagechange', label);
    label();
  }
  // A step the visitor points at or focuses is the step shown.
  steps.forEach((s, k) => {
    s.tabIndex = 0;
    const pick = () => { if (!paused) { i = k; show(); if (timer) { clearInterval(timer); timer = setInterval(tick, STEP_MS); } } };
    s.addEventListener('mouseenter', pick);
    s.addEventListener('focus', pick);
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { threshold: 0.2 }).observe(fig);
  } else { visible = true; run(); }
})();
