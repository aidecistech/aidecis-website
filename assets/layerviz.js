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
  var cloud = q('[data-cloud]'), cloudText = cloud.querySelector('span');
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
      var t0 = performance.now(), last = t0;
      (function step(now) {
        if (paused) t0 += now - last;
        last = now;
        var k = Math.min(1, (now - t0) / ms), pt = p.getPointAtLength(len * k);
        dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
        if (k < 1) requestAnimationFrame(step); else { if (dot.parentNode) dot.parentNode.removeChild(dot); p.classList.remove('is-live'); done(); }
      })(t0);
    });
  }
  // Pause freezes the step in progress: waits count only time that is not paused, and a dot in flight holds still
  // (Codex P2 on website PR 47).
  var wait = function (ms) {
    return new Promise(function (r) {
      if (reduced) return r();
      var left = ms, last = performance.now();
      (function tick() {
        var now = performance.now();
        if (!paused) left -= now - last;
        last = now;
        left <= 0 ? r() : setTimeout(tick, 50);
      })();
    });
  };
  var paused = false, running = false;
  function until() { return new Promise(function (r) { (function c() { paused ? setTimeout(c, 200) : r(); })(); }); }
  /** The explanation in a cloud above the step it is about, and the same words for screen readers. */
  var sayT;
  function say(node, text) {
    caption.textContent = text;
    var el = q('[data-node="' + node + '"]');
    if (!el) return;
    // Fade out, move to the step, then show the new words: the cloud never shows one step's words over another.
    var place = function () {
      cloudText.textContent = text;
      var r = box(el), w = cloud.offsetWidth, h = cloud.offsetHeight, bw = board.offsetWidth;
      var center = (r.l + r.r) / 2, left = Math.max(0, Math.min(bw - w, center - w / 2));
      cloud.style.left = left + 'px';
      // A row of its own above the flow: it moves left to right with the story and never covers a card.
      cloud.style.top = '0px';
      cloud.style.setProperty('--tail', Math.max(14, Math.min(w - 14, center - left)) + 'px');
      cloud.classList.add('is-on');
      // Keep the active step in view when the flow scrolls sideways on a small screen.
      var sc = fig.querySelector('.lv-scroll');
      if (sc && sc.scrollWidth > sc.clientWidth) sc.scrollTo({ left: Math.max(0, center - sc.clientWidth / 2), behavior: reduced ? 'auto' : 'smooth' });
    };
    clearTimeout(sayT);
    if (reduced || !cloud.classList.contains('is-on')) return place();
    cloud.classList.remove('is-on');
    sayT = setTimeout(place, 260);
  }
  function hush() { cloud.classList.remove('is-on'); }
  function active(node, on) { var el = q('[data-node="' + node + '"]'); if (el) el.classList.toggle('is-active', on); }
  function reset() {
    fig.querySelectorAll('.is-sent,.is-in,.is-active').forEach(function (el) { el.classList.remove('is-sent', 'is-in', 'is-active'); });
  }
  function finished() {
    fig.querySelectorAll('.lv-src').forEach(function (el) { el.classList.add('is-sent'); });
    fig.querySelectorAll('[data-chip],[data-route],[data-decided]').forEach(function (el) { el.classList.add('is-in'); });
    caption.textContent = 'Four signals, one case, one decision: recorded with every signal, the rule and the reason.';
    say('person', caption.textContent);
  }
  async function play() {
    if (running) return; running = true;
    for (;;) {
      reset(); hush();
      caption.textContent = 'Four signals arrive in four places.';
      await wait(1000);
      for (var i = 0; i < srcs.length; i++) {
        await until();
        var s = srcs[i];
        active(s, true); q('[data-node="' + s + '"]').classList.add('is-sent');
        say(s, CAPTIONS[i]); await wait(1600);
        await travel(s, 1000); active(s, false);
        active('door', true);
        if (i === 0) { say('door', 'One door: each source becomes one standard signal.'); await wait(1600); }
        await travel('read', 450); active('door', false);
        active('read', true);
        if (i === 0) { say('read', 'S-CLAIM reads which decision this is and what it protects first.'); await wait(1800); }
        await travel('case', 850); active('read', false);
        q('[data-chip="' + (i + 1) + '"]').classList.add('is-in');
        active('case', true); say('case', i === 0 ? 'A new case on PO line 4500077103/00010.' : 'Same PO line: added to the same case, by code.'); await wait(1500); active('case', false);
      }
      await until();
      q('[data-route]').classList.add('is-in'); active('case', true);
      say('case', 'Your authority rule: within €50,000 the procurement manager decides.'); await wait(2200); active('case', false);
      hush(); await travel('person', 1000); active('person', true);
      say('person', 'One question for Anna, with all four signals and the evidence one tap away.'); await wait(2400);
      q('[data-decided]').classList.add('is-in');
      say('person', 'Approved at 08:34. Recorded with every signal, the rule and the reason.');
      await wait(4200); active('person', false); hush();
    }
  }
  draw();
  var resizeT;
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(draw, 150); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { clearTimeout(resizeT); resizeT = setTimeout(draw, 150); }).observe(board);
  if (reduced) { finished(); return; }
  toggle.hidden = false;
  toggle.addEventListener('click', function () { paused = !paused; toggle.textContent = paused ? 'Play' : 'Pause'; });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); play(); } }, { threshold: 0.3 }).observe(fig);
  } else play();
})();

/* Inside S-CLAIM (19 Nov 2026): one signal, read by four modules in turn, each adding one line to the case. Same
   grammar as the flow above: left to right, the explanation in a cloud above the step, pause, reduced motion. */
(function () {
  var fig = document.querySelector('[data-claimviz]');
  if (!fig) return;
  var board = fig.querySelector('.lv-board');
  var q = function (s) { return fig.querySelector(s); };
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'lv-lines');
  svg.setAttribute('aria-hidden', 'true');
  board.insertBefore(svg, board.firstChild);
  var caption = q('[data-caption]'), toggle = q('[data-lv-toggle]');
  var cloud = q('[data-cloud]'), cloudText = cloud.querySelector('span');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mods = ['llm', 'policy', 'history', 'language'];
  var SAY = {
    llm: 'Trained by Aidecis on 71 kinds of supply-chain decision, from expediting freight to a recall. This one: a purchase-order exception, urgent today.',
    policy: 'Your policies, applied by code: within €50,000 the procurement manager decides.',
    history: 'Your own history, computed in your environment: this supplier is often late.',
    language: 'The language model reads it as people write it, and puts the reason in plain words.',
  };
  var paths = {};
  function box(el) {
    var b = board.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { l: r.left - b.left, r: r.right - b.left, t: r.top - b.top, b: r.bottom - b.top, cy: r.top - b.top + r.height / 2 };
  }
  function curve(a, b) { var mx = (a.x + b.x) / 2; return 'M' + a.x + ' ' + a.y + ' C' + mx + ' ' + a.y + ' ' + mx + ' ' + b.y + ' ' + b.x + ' ' + b.y; }
  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    paths = {};
    var sig = box(q('[data-node="signal"]')), out = box(q('[data-node="reading"]'));
    var add = function (key, d) { var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'lv-path'); svg.appendChild(p); paths[key] = p; };
    mods.forEach(function (m) {
      var r = box(q('[data-node="' + m + '"]'));
      add('in-' + m, curve({ x: sig.r, y: sig.cy }, { x: r.l, y: r.cy }));
      add('out-' + m, curve({ x: r.r, y: r.cy }, { x: out.l, y: out.cy }));
    });
  }
  function travel(key, ms) {
    return new Promise(function (done) {
      var p = paths[key];
      if (!p || reduced) return done();
      p.classList.add('is-live');
      var len = p.getTotalLength(), dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '5'); dot.setAttribute('class', 'lv-dot'); svg.appendChild(dot);
      var t0 = performance.now(), last = t0;
      (function step(now) {
        if (paused) t0 += now - last;
        last = now;
        var k = Math.min(1, (now - t0) / ms), pt = p.getPointAtLength(len * k);
        dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
        if (k < 1) requestAnimationFrame(step); else { if (dot.parentNode) dot.parentNode.removeChild(dot); p.classList.remove('is-live'); done(); }
      })(t0);
    });
  }
  var sayT;
  function say(node, text) {
    caption.textContent = text;
    var el = q('[data-node="' + node + '"]');
    var place = function () {
      cloudText.textContent = text;
      var r = box(el), w = cloud.offsetWidth, bw = board.offsetWidth;
      var center = (r.l + r.r) / 2, left = Math.max(0, Math.min(bw - w, center - w / 2));
      cloud.style.left = left + 'px'; cloud.style.top = '0px';
      cloud.style.setProperty('--tail', Math.max(14, Math.min(w - 14, center - left)) + 'px');
      cloud.classList.add('is-on');
      var sc = fig.querySelector('.lv-scroll');
      if (sc && sc.scrollWidth > sc.clientWidth) sc.scrollTo({ left: Math.max(0, center - sc.clientWidth / 2), behavior: reduced ? 'auto' : 'smooth' });
    };
    clearTimeout(sayT);
    if (reduced || !cloud.classList.contains('is-on')) return place();
    cloud.classList.remove('is-on');
    sayT = setTimeout(place, 260);
  }
  // Pause freezes the step in progress: waits count only time that is not paused, and a dot in flight holds still
  // (Codex P2 on website PR 47).
  var wait = function (ms) {
    return new Promise(function (r) {
      if (reduced) return r();
      var left = ms, last = performance.now();
      (function tick() {
        var now = performance.now();
        if (!paused) left -= now - last;
        last = now;
        left <= 0 ? r() : setTimeout(tick, 50);
      })();
    });
  };
  var paused = false;
  function until() { return new Promise(function (r) { (function c() { paused ? setTimeout(c, 200) : r(); })(); }); }
  function node(n) { return q('[data-node="' + n + '"]'); }
  function reset() { fig.querySelectorAll('.is-in,.is-active,.is-done').forEach(function (el) { el.classList.remove('is-in', 'is-active', 'is-done'); }); cloud.classList.remove('is-on'); }
  function finished() {
    mods.forEach(function (m) { node(m).classList.add('is-done'); });
    fig.querySelectorAll('[data-chip],[data-route]').forEach(function (el) { el.classList.add('is-in'); });
    say('reading', 'One reading on the case, each line traceable to its module. The person decides.');
  }
  async function play() {
    for (;;) {
      reset();
      node('signal').classList.add('is-active');
      say('signal', 'A signal reaches S-CLAIM: one supplier confirmation from SAP.');
      await wait(2000);
      node('signal').classList.remove('is-active');
      for (var i = 0; i < mods.length; i++) {
        await until();
        var m = mods[i];
        await travel('in-' + m, 800);
        node(m).classList.add('is-active');
        say(m, SAY[m]); await wait(700);
        node(m).classList.add('is-done'); await wait(1900);
        await travel('out-' + m, 800);
        node(m).classList.remove('is-active');
        q('[data-chip="' + (i + 1) + '"]').classList.add('is-in');
      }
      await until();
      q('[data-route]').classList.add('is-in'); node('reading').classList.add('is-active');
      say('reading', 'One reading on the case, each line traceable to its module. A missing fact is asked for, never guessed.');
      await wait(4500); node('reading').classList.remove('is-active');
    }
  }
  draw();
  var t;
  var redraw = function () { clearTimeout(t); t = setTimeout(draw, 150); };
  window.addEventListener('resize', redraw);
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(board);
  if (reduced) { finished(); return; }
  toggle.hidden = false;
  toggle.addEventListener('click', function () { paused = !paused; toggle.textContent = paused ? 'Play' : 'Pause'; });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); play(); } }, { threshold: 0.3 }).observe(fig);
  else play();
})();
