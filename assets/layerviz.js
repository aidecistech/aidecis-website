/* The decision layer visual (19 Nov 2026): each signal travels from its channel through the one door into the case,
   then the rule routes it and one person decides. Reduced motion shows the finished picture; a Pause button stops it. */
(function () {
  var fig = document.querySelector('[data-layerviz]');
  if (!fig) return;
  var board = fig.querySelector('.lv-board');
  var q = function (s) { return fig.querySelector(s); };
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'lv-lines');
  svg.setAttribute('aria-hidden', 'true');
  board.insertBefore(svg, board.firstChild);
  var caption = q('[data-caption]');
  var toggle = q('[data-lv-toggle]');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var srcs = ['sap', 'email', 'o9', 'whatsapp'];
  var CAPTIONS = [
    'SAP: the supplier confirmation moves the delivery a week.',
    'The supplier emails the buyer the new date and price.',
    'o9 sees the plant fall below safety stock.',
    'The planner sends a WhatsApp: the line stops Thursday.',
  ];
  var paths = {};

  function box(el) {
    var b = board.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { l: r.left - b.left, r: r.right - b.left, t: r.top - b.top, b: r.bottom - b.top, cy: r.top - b.top + r.height / 2 };
  }
  function curve(a, b) {
    var mx = (a.x + b.x) / 2;
    return 'M' + a.x + ' ' + a.y + ' C' + mx + ' ' + a.y + ' ' + mx + ' ' + b.y + ' ' + b.x + ' ' + b.y;
  }
  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    paths = {};
    var door = box(q('[data-node="door"]')), read = box(q('[data-node="read"]')), cs = box(q('[data-node="case"]')), person = box(q('[data-node="person"]'));
    var add = function (key, d) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('class', 'lv-path');
      svg.appendChild(p); paths[key] = p;
    };
    srcs.forEach(function (s) {
      var a = box(q('[data-node="' + s + '"]'));
      add(s, curve({ x: a.r, y: a.cy }, { x: door.l, y: door.cy }));
    });
    add('read', 'M' + ((door.l + door.r) / 2) + ' ' + door.b + ' L' + ((read.l + read.r) / 2) + ' ' + read.t);
    add('case', curve({ x: read.r, y: read.cy }, { x: cs.l, y: cs.cy }));
    add('person', curve({ x: cs.r, y: cs.cy }, { x: person.l, y: person.cy }));
  }
  function travel(key, ms) {
    return new Promise(function (done) {
      var p = paths[key];
      if (!p || reduced) return done();
      p.classList.add('is-live');
      var len = p.getTotalLength(), dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '5'); dot.setAttribute('class', 'lv-dot'); svg.appendChild(dot);
      var t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / ms), pt = p.getPointAtLength(len * k);
        dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
        if (k < 1) requestAnimationFrame(step); else { svg.removeChild(dot); p.classList.remove('is-live'); done(); }
      })(t0);
    });
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduced ? 0 : ms); }); };
  var paused = false, running = false;
  function until() { return new Promise(function (r) { (function c() { paused ? setTimeout(c, 200) : r(); })(); }); }
  function active(node, on) { var el = q('[data-node="' + node + '"]'); if (el) el.classList.toggle('is-active', on); }
  function reset() {
    fig.querySelectorAll('.is-sent,.is-in,.is-active').forEach(function (el) { el.classList.remove('is-sent', 'is-in', 'is-active'); });
  }
  function finished() {
    fig.querySelectorAll('.lv-src').forEach(function (el) { el.classList.add('is-sent'); });
    fig.querySelectorAll('[data-chip],[data-route],[data-decided]').forEach(function (el) { el.classList.add('is-in'); });
    caption.textContent = 'Four signals, one case, one decision: recorded with every signal, the rule and the reason.';
  }
  async function play() {
    if (running) return; running = true;
    for (;;) {
      reset();
      caption.textContent = 'Four signals arrive in four places.';
      await wait(1200);
      for (var i = 0; i < srcs.length; i++) {
        await until();
        var s = srcs[i];
        active(s, true); q('[data-node="' + s + '"]').classList.add('is-sent');
        caption.textContent = CAPTIONS[i];
        await travel(s, 1100); active(s, false);
        active('door', true); await travel('read', 500); active('door', false);
        active('read', true); await travel('case', 900); active('read', false);
        q('[data-chip="' + (i + 1) + '"]').classList.add('is-in');
        active('case', true); await wait(700); active('case', false);
      }
      await until();
      caption.textContent = 'Same order line: code joins them into one case and applies your authority rule.';
      q('[data-route]').classList.add('is-in'); active('case', true); await wait(1600); active('case', false);
      caption.textContent = 'One question goes to the person whose mandate covers it.';
      await travel('person', 1100); active('person', true); await wait(1500);
      q('[data-decided]').classList.add('is-in');
      caption.textContent = 'Decided in minutes, and recorded with every signal, the rule and the reason.';
      await wait(4200); active('person', false);
    }
  }
  draw();
  var resizeT;
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(draw, 150); });
  if (reduced) { finished(); return; }
  toggle.hidden = false;
  toggle.addEventListener('click', function () { paused = !paused; toggle.textContent = paused ? 'Play' : 'Pause'; });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); play(); } }, { threshold: 0.3 }).observe(fig);
  } else play();
})();
