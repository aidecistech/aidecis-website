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
      if (!node.nodeValue.trim() || node.parentElement.closest('script,style,#benefits,#monthly,#onboarding,#days,#monthly-per-site,#onboarding-per-site,#annual,#annual-per-site,#sprint,#error,.film-index,#film-toggle,#intro-sound-toggle')) return NodeFilter.FILTER_REJECT;
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
  // Consent-gated visit counter for the Aidecis CRM (Web visitors). Sends only an anonymous
  // random token, the page path, the referring host and whether marketing cookies were accepted,
  // and only after analytics consent. Runs on every page, also those without the consent banner.
  // With marketing consent it also sends the reference of a personal link (?aidref=...) that the
  // Aidecis team sent, so the CRM can recognise this visitor as that contact.
  const trackUrl = 'https://crm.aidecis.com/track.php';
  const visitorKey = 'aidecis_visitor';
  const pendingRevokeKey = 'aidecis_visitor_revoke';
  const refKey = 'aidecis_visitor_ref';
  const tabStorage = (() => { try { return window.sessionStorage; } catch (_) { return null; } })();
  // A personal link reference leaves the address bar at once and is kept for this tab only.
  (() => {
    try {
      const url = new URL(location.href);
      const ref = url.searchParams.get('aidref');
      if (ref === null) return;
      url.searchParams.delete('aidref');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      if (/^[a-f0-9]{32}$/.test(ref) && tabStorage) tabStorage.setItem(refKey, ref);
    } catch (_) { /* no reference kept */ }
  })();
  const pendingRef = () => { try { return tabStorage ? tabStorage.getItem(refKey) : null; } catch (_) { return null; } };
  const liveSite = /^(www\.)?aidecis\.com$/.test(location.hostname);
  const sendVisitEvent = (body) => {
    if (!liveSite || !window.fetch) return Promise.resolve(false);
    return fetch(trackUrl, { method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((response) => response.ok, () => false);
  };
  const visitorToken = () => {
    let token = reviewStorage.getItem(visitorKey);
    if (!token || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      reviewStorage.setItem(visitorKey, token);
    }
    return token;
  };
  const referrerHost = () => {
    try { return document.referrer ? new URL(document.referrer).host.toLowerCase().slice(0, 190) : ''; } catch (_) { return ''; }
  };
  const trackVisit = () => {
    const marketing = hasMarketingConsent();
    const body = { session: visitorToken(), path: (location.pathname || '/').slice(0, 300), referrer: referrerHost(), marketing };
    const ref = marketing ? pendingRef() : null;
    if (ref) body.ref = ref;
    return sendVisitEvent(body).then((ok) => {
      if (ok && ref) try { tabStorage.removeItem(refKey); } catch (_) { /* sent again on the next page */ }
    });
  };
  // Marketing consent withdrawn (analytics kept): the CRM forgets which contact this visitor is.
  const unlinkVisitor = () => {
    const token = reviewStorage.getItem(visitorKey);
    if (token) sendVisitEvent({ session: token, path: '', unlink: true });
  };
  // Withdrawal stops tracking at once; the deletion request is kept and retried until the CRM confirms it.
  const flushRevoke = () => {
    const token = reviewStorage.getItem(pendingRevokeKey);
    if (!token) return;
    sendVisitEvent({ session: token, path: '', revoke: true }).then((ok) => {
      if (ok && reviewStorage.getItem(pendingRevokeKey) === token) reviewStorage.removeItem(pendingRevokeKey);
    });
  };
  const revokeVisits = () => {
    const token = reviewStorage.getItem(visitorKey);
    if (token) reviewStorage.setItem(pendingRevokeKey, token);
    reviewStorage.removeItem(visitorKey);
    flushRevoke();
  };
  const hasAnalyticsConsent = () => {
    try { return Boolean(JSON.parse(reviewStorage.getItem(storageKey) || '{}').analytics); } catch (_) { return false; }
  };
  function hasMarketingConsent() {
    try { const c = JSON.parse(reviewStorage.getItem(storageKey) || '{}'); return Boolean(c.analytics && c.marketing); } catch (_) { return false; }
  }
  flushRevoke();
  if (hasAnalyticsConsent()) trackVisit();
  // The contact form carries the anonymous visitor token only with marketing consent, so the CRM can
  // show this visitor's pages with the message.
  const contactForm = document.getElementById('contact-form');
  if (contactForm) contactForm.addEventListener('submit', () => {
    contactForm.querySelectorAll('input[data-visitor-field]').forEach((el) => el.remove());
    if (!hasMarketingConsent()) return;
    [['visitor', visitorToken()], ['visitor_marketing', '1']].forEach(([name, value]) => {
      const input = document.createElement('input');
      Object.assign(input, { type: 'hidden', name, value });
      input.dataset.visitorField = '';
      contactForm.append(input);
    });
  });

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
    const before = hasAnalyticsConsent();
    const beforeMarketing = hasMarketingConsent();
    reviewStorage.setItem(storageKey, JSON.stringify(consent));
    if (consent.analytics && (!before || (consent.marketing && !beforeMarketing && pendingRef()))) trackVisit();
    if (!consent.analytics && before) revokeVisits();
    else if (consent.analytics && beforeMarketing && !consent.marketing) unlinkVisitor();
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
