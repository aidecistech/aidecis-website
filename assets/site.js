const reviewStorage = (() => { const fallback={}; try { const s=window.localStorage; s.setItem("aidecis_review_check","1"); s.removeItem("aidecis_review_check"); return s; } catch (_) { return {getItem:k=>fallback[k]??null,setItem:(k,v)=>{fallback[k]=String(v)},removeItem:k=>{delete fallback[k]}}; } })();
(() => {
  const catalog = window.AIDECIS_TRANSLATIONS || {};
  const buttons = [...document.querySelectorAll('[data-language]')];
  const storageKey = 'aidecis_language';
  let selected = 'en';
  try {
    const saved = reviewStorage.getItem(storageKey);
    if (saved === 'es' || saved === 'nl') selected = saved;
  } catch (_) { /* language selection still works for restricted storage */ }
  // A link from the story demo (demo.app.aidecis.com) brings the visitor's language along as ?lang=.
  const fromLink = new URLSearchParams(window.location.search).get('lang');
  const linked = fromLink === 'en' || fromLink === 'es' || fromLink === 'nl' ? fromLink : null;
  if (linked) selected = linked;
  // The story demo runs on its own site and cannot see this one's choice, so its links carry it.
  const tourLinks = [...document.querySelectorAll('a[href^="https://demo.app.aidecis.com/#/tour"]')];
  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim() || node.parentElement.closest('script,style,#benefits,#monthly,#onboarding,#days,#monthly-per-site,#onboarding-per-site,#error,.film-index,#film-toggle,#intro-sound-toggle')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) textNodes.push({ node: walker.currentNode, source: walker.currentNode.nodeValue });
  const translatableAttributes = [];
  document.querySelectorAll('[aria-label],[title],[placeholder],[alt],meta[name="description"]').forEach((element) => {
    ['aria-label', 'title', 'placeholder', 'alt', 'content'].forEach((attribute) => {
      if (element.hasAttribute(attribute)) translatableAttributes.push({ element, attribute, source: element.getAttribute(attribute) });
    });
  });
  const sourceTitle = document.title;
  const applyLanguage = (language, persist = true) => {
    const dictionary = catalog[language] || {};
    textNodes.forEach(({ node, source }) => {
      const trimmed = source.trim();
      const translated = dictionary[trimmed];
      node.nodeValue = translated === undefined ? source : source.replace(trimmed, translated);
    });
    translatableAttributes.forEach(({ element, attribute, source }) => {
      element.setAttribute(attribute, dictionary[source] || source);
    });
    document.title = dictionary[sourceTitle] || sourceTitle;
    document.documentElement.lang = language === 'en' ? 'en' : language === 'es' ? 'es' : 'nl';
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
    tourLinks.forEach((link) => { link.href = 'https://demo.app.aidecis.com/#/tour?lang=' + language; });
    selected = language;
    if (persist) {
      try { reviewStorage.setItem(storageKey, language); } catch (_) { /* selection remains active until navigation */ }
    }
    document.dispatchEvent(new Event('aidecis:languagechange'));
  };
  buttons.forEach((button) => button.addEventListener('click', () => applyLanguage(button.dataset.language)));
  window.AidecisI18n = { get language() { return selected; }, t: (source) => (catalog[selected] || {})[source] || source };
  applyLanguage(selected, Boolean(linked));
})();

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  });
});

(() => {
  const banner = document.getElementById('cookie-consent-banner');
  const modal = document.getElementById('cookie-preferences-modal');
  const trigger = document.querySelector('.cookie-settings-trigger');
  const analytics = document.getElementById('pref-analytics');
  const marketing = document.getElementById('pref-marketing');
  const storageKey = 'aidecis_consent';
  if (!banner || !modal || !trigger) return;

  const stored = reviewStorage.getItem(storageKey);
  if (stored) {
    banner.hidden = true;
    try {
      const consent = JSON.parse(stored);
      analytics.checked = Boolean(consent.analytics);
      marketing.checked = Boolean(consent.marketing);
    } catch (_) { /* a fresh choice will overwrite an invalid stored value */ }
  }

  const openModal = () => { modal.hidden = false; };
  const closeModal = () => { modal.hidden = true; };
  const saveConsent = (consent) => {
    reviewStorage.setItem(storageKey, JSON.stringify(consent));
    banner.hidden = true;
    closeModal();
  };

  trigger.addEventListener('click', openModal);
  document.getElementById('cookie-preferences').addEventListener('click', openModal);
  document.getElementById('cookie-accept-all').addEventListener('click', () => {
    analytics.checked = true;
    marketing.checked = true;
    saveConsent({ analytics: true, marketing: true });
  });
  document.getElementById('cookie-reject-all').addEventListener('click', () => {
    analytics.checked = false;
    marketing.checked = false;
    saveConsent({ analytics: false, marketing: false });
  });
  document.getElementById('cookie-save-prefs').addEventListener('click', () => {
    saveConsent({ analytics: analytics.checked, marketing: marketing.checked });
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
})();

(() => {
  const video = document.getElementById('intro-video');
  const toggle = document.getElementById('intro-sound-toggle');
  if (!video || !toggle) return;

  const refreshSoundLabel = () => { toggle.textContent = window.AidecisI18n.t(video.muted ? 'Sound on' : 'Sound off'); };
  document.addEventListener('aidecis:languagechange', refreshSoundLabel);
  refreshSoundLabel();
  toggle.addEventListener('click', () => {
    video.muted = !video.muted;
    const soundIsOn = !video.muted;
    toggle.textContent = window.AidecisI18n.t(soundIsOn ? 'Sound off' : 'Sound on');
    toggle.setAttribute('aria-pressed', String(soundIsOn));
  });
})();

(() => {
  const trigger = document.getElementById('flow-animation-open');
  const viewer = document.getElementById('flow-animation-viewer');
  const closeButton = document.getElementById('flow-animation-close');
  if (!trigger || !viewer || !closeButton) return;

  const closeViewer = () => {
    viewer.hidden = true;
    document.body.classList.remove('flow-viewer-open');
    trigger.focus();
  };
  trigger.addEventListener('click', () => {
    viewer.hidden = false;
    document.body.classList.add('flow-viewer-open');
    closeButton.focus();
  });
  closeButton.addEventListener('click', closeViewer);
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer) closeViewer();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !viewer.hidden) closeViewer();
  });
})();

(() => {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('contact-form-status');
  if (!form || !status) return;
  const t = window.AidecisI18n.t;
  const params = new URLSearchParams(window.location.search);
  if (params.has('submitted')) {
    status.textContent = t('Thanks — your message has been sent. Our team will follow up soon.');
    status.classList.add('contact-form-success');
    form.reset();
  } else if (params.has('submit_error')) {
    status.textContent = t('We could not send your message right now. Please try again or email william.johnson@aidecis.com.');
    status.classList.add('contact-form-error');
  }
})();
