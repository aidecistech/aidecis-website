// News is published in English only. In Spanish and Dutch, mark each article card on news.html with an
// "In English" badge and show a notice at the top of each article. Nothing is added in English.
// Load after site.js (it uses window.AidecisI18n); styles are in news.css.
(() => {
  const i18n = window.AidecisI18n;
  if (!i18n) return;
  const cards = [...document.querySelectorAll('.news-directory .news-row')];
  const head = document.querySelector('.news-head');
  const update = () => {
    const foreign = i18n.language !== 'en';
    document.querySelectorAll('.news-lang-badge, .news-lang-notice').forEach((el) => el.remove());
    if (!foreign) return;
    cards.forEach((card) => {
      const badge = document.createElement('span');
      badge.className = 'news-lang-badge';
      badge.textContent = i18n.t('In English');
      const summary = card.querySelector('p');
      (summary || card).prepend(badge);
    });
    if (head && !cards.length) {
      const notice = document.createElement('p');
      notice.className = 'news-lang-notice';
      notice.setAttribute('role', 'note');
      notice.textContent = i18n.t('This article is available in English only.');
      const eyebrow = head.querySelector('.eyebrow');
      if (eyebrow) eyebrow.after(notice); else head.prepend(notice);
    }
  };
  document.addEventListener('aidecis:languagechange', update);
  update();
})();
