(() => {
  // The site-wide consent manager stores this choice in localStorage. Initialize
  // Google Consent Mode before the container can run, and do not contact Google
  // at all until analytics consent has been granted.
  const consentKey = 'aidecis_consent';
  const measurementId = 'G-249T3D83TS';
  const hostAllowed = /^(www\.)?aidecis\.com$/.test(location.hostname);
  const readConsent = () => {
    try {
      const value = JSON.parse(localStorage.getItem(consentKey) || '{}');
      return { analytics: value.analytics === true, marketing: value.marketing === true };
    } catch (_) {
      return { analytics: false, marketing: false };
    }
  };

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
  window.gtag('js', new Date());

  let loaded = false;
  const applyConsent = (choice) => {
    const consent = {
      analytics: choice?.analytics === true,
      marketing: choice?.marketing === true
    };
    window.gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.analytics && consent.marketing ? 'granted' : 'denied',
      ad_user_data: consent.analytics && consent.marketing ? 'granted' : 'denied',
      ad_personalization: consent.analytics && consent.marketing ? 'granted' : 'denied'
    });
    if (!hostAllowed || !consent.analytics || loaded) return;

    loaded = true;
    window.gtag('config', measurementId);
    const analyticsScript = document.createElement('script');
    analyticsScript.async = true;
    analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(analyticsScript);
  };

  window.aidecisUpdateGoogleConsent = applyConsent;
  applyConsent(readConsent());
})();
