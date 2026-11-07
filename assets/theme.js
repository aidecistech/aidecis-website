// Dark / Light / System theme toggle for the public site, mirroring the app's ThemeSwitch.
// Dark is the default. The choice is stored in this browser; System follows the OS live.
// A tiny inline script in <head> sets data-theme before paint (no flash); this file renders the control.
(function () {
  var KEY = 'aidecis_theme';
  var root = document.documentElement;
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function choice() { var c = stored(); return c === 'light' || c === 'system' ? c : 'dark'; }
  function sysDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function resolved(c) { return c === 'dark' || (c === 'system' && sysDark()) ? 'dark' : 'light'; }
  function swapLogos(mode) {
    // Logo swap is now handled entirely in CSS (.logo-light / .logo-dark toggled by
    // [data-theme]), so it is set before paint with no flash and no JS/cache dependency.
    // This stays a no-op for backward compatibility with any cached caller.
  }
  function apply(c) { var m = resolved(c); root.setAttribute('data-theme', m); root.setAttribute('data-theme-choice', c); swapLogos(m); }
  apply(choice());
  var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (choice() === 'system') { apply('system'); refresh(); } });

  var ICONS = {
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/></svg>',
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12.5" rx="1.6"/><path d="M8.5 20.5h7M12 16.5v4"/></svg>'
  };
  var OPTS = [['dark', 'Dark'], ['light', 'Light'], ['system', 'System']];

  function refresh() {
    // Update the pressed state in place so the focused button is never removed from the DOM.
    var host = document.getElementById('theme-switch');
    if (!host) return;
    var c = choice();
    [].forEach.call(host.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-value') === c));
    });
  }
  function render() {
    var host = document.getElementById('theme-switch');
    if (!host) return;
    var c = choice();
    host.innerHTML = OPTS.map(function (o) {
      return '<button type="button" data-theme-value="' + o[0] + '" aria-pressed="' + (c === o[0]) +
        '" title="' + o[1] + ' theme" aria-label="' + o[1] + ' theme">' + ICONS[o[0]] + '</button>';
    }).join('');
    [].forEach.call(host.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-theme-value');
        try { localStorage.setItem(KEY, v); } catch (e) { }
        apply(v);
        refresh();   // keeps b in the DOM, so its focus and focus ring stay
      });
    });
  }

  function mount() {
    var ls = document.querySelector('.language-selector');
    if (ls && !document.getElementById('theme-switch')) {
      var g = document.createElement('div');
      g.id = 'theme-switch';
      g.className = 'theme-switch';
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', 'Theme');
      ls.parentNode.insertBefore(g, ls);
      render();
    }
  }
  if (document.readyState !== 'loading') mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
