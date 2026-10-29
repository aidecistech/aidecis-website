/* Aidecis decorative number-to-icon update
   Built against the live homepage inspected on 2026-10-10.
   Does not change operational values, dates, pricing, or film progress. */
(() => {
  'use strict';

  const paths = {
    proposal: '<path d="M13 8h15l7 7v25H13z"/><path d="M28 8v8h8M19 23h10M19 29h10M19 35h6"/><path d="M37 27v10M32 32h10"/>',
    evaluate: '<path d="M10 13h28M10 24h28M10 35h28"/><circle cx="19" cy="13" r="4"/><circle cx="30" cy="24" r="4"/><circle cx="22" cy="35" r="4"/>',
    approve: '<path d="M24 7 38 13v10c0 9-5.8 14.7-14 18-8.2-3.3-14-9-14-18V13z"/><path d="m17 24 5 5 10-11"/>',
    execute: '<path d="M9 15h21l-5-5M39 33H18l5 5"/><path d="M30 10 37 15l-7 5M18 28l-7 5 7 5"/>',
    learn: '<path d="M36 17a15 15 0 0 0-25 4"/><path d="M11 11v10h10M12 31a15 15 0 0 0 25-4"/><path d="M36 37V27H26"/>',
    logistics: '<path d="M5 13h23v21H5zM28 21h9l6 7v6H28z"/><circle cx="14" cy="36" r="4"/><circle cx="35" cy="36" r="4"/><path d="M33 22v7h8"/>',
    manufacturing: '<circle cx="24" cy="24" r="7"/><path d="m24 6 3 4 5 1 1 5 4 3-2 5 2 5-4 3-1 5-5 1-3 4-5-2-5 2-3-4-5-1-1-5-4-3 2-5-2-5 4-3 1-5 5-1 3-4z"/><circle cx="24" cy="24" r="2"/>',
    procurement: '<path d="m7 16 17-9 17 9-17 9zM7 16v17l17 9 17-9V16M24 25v17"/><path d="m17 20 5 3 9-5"/>',
    explore: '<circle cx="24" cy="24" r="17"/><path d="m30 18-4 10-9 4 4-10zM24 7v4M41 24h-4M24 41v-4M7 24h4"/>',
    decide: '<circle cx="12" cy="12" r="5"/><circle cx="36" cy="24" r="5"/><circle cx="12" cy="36" r="5"/><path d="M17 12h8a6 6 0 0 1 6 6v0M17 36h8a6 6 0 0 0 6-6v0"/>',
    simulate: '<path d="M8 24h7l5-12 8 24 5-12h7"/><circle cx="24" cy="24" r="18"/>',
    europe: '<circle cx="24" cy="24" r="17"/><path d="M7 24h34M24 7c5 5 7 11 7 17s-2 12-7 17c-5-5-7-11-7-17s2-12 7-17z"/>',
    residency: '<path d="M24 6 39 13v11c0 9-6 14-15 18-9-4-15-9-15-18V13z"/><ellipse cx="24" cy="19" rx="8" ry="3"/><path d="M16 19v9c0 2 4 4 8 4s8-2 8-4v-9M16 24c0 2 4 4 8 4s8-2 8-4"/>',
    control: '<circle cx="24" cy="11" r="5"/><circle cx="12" cy="35" r="5"/><circle cx="36" cy="35" r="5"/><path d="M22 16 14 30M26 16l8 14M17 35h14"/>',
    auto: '<path d="M7 28h34l-3-10H11zM10 28v8h28v-8"/><circle cx="16" cy="36" r="3"/><circle cx="32" cy="36" r="3"/><path d="M15 18l4-6h10l4 6"/>',
    pharma: '<path d="M15 8h18M19 8v12l-8 14a5 5 0 0 0 4 8h18a5 5 0 0 0 4-8l-8-14V8"/><path d="M15 31h18M20 25h8"/>',
    food: '<path d="M11 40h26l-3-26H14zM17 14c-2-4 0-7 3-9M24 14c-2-4 0-7 3-9M31 14c-2-4 0-7 3-9"/>',
    logisticsIndustry: '<path d="M6 14h22v20H6zM28 21h9l6 7v6H28z"/><circle cx="14" cy="37" r="4"/><circle cx="35" cy="37" r="4"/>',
    aerospace: '<path d="m24 5 4 15 14 8-1 4-14-4-2 13-3 2-3-15-12 4-2-3 12-9z"/>',
    electronics: '<rect x="11" y="11" width="26" height="26" rx="3"/><path d="M18 18h12v12H18zM17 5v6M24 5v6M31 5v6M17 37v6M24 37v6M31 37v6M5 17h6M5 24h6M5 31h6M37 17h6M37 24h6M37 31h6"/>',
    medical: '<path d="M24 41s-16-9-16-21a9 9 0 0 1 16-6 9 9 0 0 1 16 6c0 12-16 21-16 21z"/><path d="M17 24h5l3-6 4 12 3-6h4"/>',
    chemicals: '<path d="M18 7h12M21 7v13L11 36a4 4 0 0 0 4 6h18a4 4 0 0 0 4-6L27 20V7"/><path d="M16 33h16M20 28h8"/>',
    machinery: '<circle cx="24" cy="24" r="7"/><path d="m24 6 3 4 5 1 1 5 4 3-2 5 2 5-4 3-1 5-5 1-3 4-5-2-5 2-3-4-5-1-1-5-4-3 2-5-2-5 4-3 1-5 5-1 3-4z"/>',
    fashion: '<path d="m17 8 7 4 7-4 8 6-5 7-4-3v22H18V18l-4 3-5-7z"/><path d="M20 13c0 5 8 5 8 0"/>',
    evidence: '<circle cx="20" cy="20" r="11"/><path d="m28 28 11 11M15 20h10M20 15v10"/>',
    rules: '<path d="M13 7h16l7 7v27H13z"/><path d="M29 7v8h7M19 23h11M19 29h11M19 35h5"/><path d="m30 32 3 3 6-7"/>',
    owner: '<circle cx="24" cy="16" r="7"/><path d="M10 40c1-8 6-12 14-12s13 4 14 12"/><path d="m31 34 3 3 6-7"/>',
    variation: '<circle cx="10" cy="11" r="4"/><circle cx="38" cy="11" r="4"/><circle cx="24" cy="37" r="4"/><path d="M14 13 22 32M34 13 26 32M14 11h20"/>',
    repeat: '<path d="M36 18a14 14 0 0 0-25-4L8 18M8 18h9M8 18V9M12 30a14 14 0 0 0 25 4l3-4M40 30h-9M40 30v9"/>',
    alert: '<path d="m24 6 20 35H4z"/><path d="M24 18v11M24 35h.01"/>',
    automation: '<rect x="10" y="14" width="28" height="25" rx="5"/><path d="M18 25h.01M30 25h.01M18 32h12M24 8v6M7 23h3M38 23h3"/>',
    handoff: '<path d="M7 14h13a5 5 0 0 1 5 5v10M41 34H28a5 5 0 0 1-5-5V19"/><path d="m16 9 5 5-5 5M32 29l-5 5 5 5"/>',
    people: '<circle cx="24" cy="15" r="7"/><path d="M10 41c1-9 7-14 14-14s13 5 14 14"/>',
    hybrid: '<circle cx="16" cy="16" r="6"/><path d="M5 38c1-7 5-11 11-11 3 0 6 1 8 3"/><rect x="27" y="24" width="15" height="15" rx="3"/><path d="M31 31h7M34.5 20v4"/>',
    bot: '<rect x="11" y="15" width="26" height="22" rx="4"/><path d="M18 24h3M27 24h3M19 31h10"/><path d="M24 9v6M7 24v6M41 24v6"/>',
    enforced: '<rect x="11" y="21" width="26" height="19" rx="3"/><path d="M17 21v-5a7 7 0 0 1 14 0v5"/><path d="M24 28v5"/>',
    observed: '<path d="M5 24c5-8 11-12 19-12s14 4 19 12c-5 8-11 12-19 12S10 32 5 24z"/><circle cx="24" cy="24" r="6"/>',
    benefit: '<path d="M8 38V25h8v13M20 38V17h8v21M32 38V9h8v29"/><path d="m9 18 9-7 8 3L39 7"/>',
    subscription: '<circle cx="24" cy="24" r="17"/><path d="M30 17c-2-3-10-4-12 0-3 6 12 5 12 11 0 5-8 7-13 3M24 11v26M8 24a16 16 0 0 1 3-9M40 24a16 16 0 0 1-3 9"/>',
    implementation: '<path d="M8 36 26 18M22 11a10 10 0 0 0 13 13l-7 7 9 9 7-7a10 10 0 0 0-13-13M7 28l13 13"/><circle cx="14" cy="34" r="3"/>'
  };

  const icons = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name,
    `<svg class="aidecis-icon-svg" viewBox="0 0 48 48" focusable="false" aria-hidden="true"><g>${path}</g></svg>`
  ]));

  const crisisIcons = ['approve', 'control', 'evidence', 'rules', 'owner', 'variation', 'repeat', 'alert', 'automation', 'handoff', 'procurement'];

  const industryIcons = [
    ['auto', /automotive/], ['pharma', /pharma/], ['food', /food/],
    ['logisticsIndustry', /logistics/], ['aerospace', /aerospace/], ['electronics', /semiconductor|electronics/],
    ['medical', /medical/], ['chemicals', /chemical/], ['machinery', /machinery/], ['fashion', /fashion|retail/]
  ];

  function setIcon(el, name, keepTextHidden = true) {
    if (!el || el.querySelector(':scope > .aidecis-icon-svg')) return;
    const original = el.textContent.trim();
    const hasLabel = el.classList.contains('demo-icon-step') || el.classList.contains('benefit-icon-label');
    const label = hasLabel ? original.replace(/^\s*\d+\s*(?:[·.]\s*)?/, '') : '';
    el.classList.add('aidecis-icon-mark');
    el.dataset.aidecisIcon = name;
    el.replaceChildren();
    el.insertAdjacentHTML('afterbegin', icons[name] || icons.control);
    if ((keepTextHidden || label) && original) {
      const hidden = document.createElement('span');
      hidden.className = 'aidecis-icon-source';
      hidden.setAttribute('aria-hidden', 'true');
      const numberPrefix = original.match(/^\d+/)?.[0];
      hidden.textContent = label ? (original.match(/^\s*\d+\s*(?:[·.]\s*)?/)?.[0] || '') : (numberPrefix || original);
      el.append(hidden);
    }
    if (label) {
      const visibleLabel = document.createElement('span');
      visibleLabel.className = 'aidecis-icon-label';
      visibleLabel.textContent = window.AidecisI18n?.t(label) || label;
      el.append(visibleLabel);
    }
  }

  function enhance() {
    document.querySelectorAll('.decision-modes-grid > article > span:first-child').forEach((el) => {
      const control = el.closest('.control-levels');
      const index = [...el.closest('.decision-modes-grid').children].indexOf(el.parentElement);
      setIcon(el, (control ? ['enforced', 'observed'] : ['people', 'hybrid', 'bot'])[index] || 'control');
    });
    document.querySelectorAll('.lifecycle-grid > li > span:first-child').forEach((el, i) => setIcon(el, ['proposal', 'evaluate', 'approve', 'execute', 'learn'][i]));
    document.querySelectorAll('.shared-workflow [data-workflow-icon]').forEach((el) => setIcon(el, ['evidence', 'evaluate', 'control', 'execute', 'learn'][Number(el.dataset.workflowIcon) - 1] || 'control'));
    document.querySelectorAll('.decision-proof-grid .proof-icon[data-proof-icon]').forEach((el) => setIcon(el, el.dataset.proofIcon));
    document.querySelectorAll('.use-case .case-no').forEach((el, i) => setIcon(el, ['logistics', 'manufacturing', 'procurement'][i]));
    document.querySelectorAll('.crisis-card .crisis-number').forEach((el, i) => setIcon(el, crisisIcons[i] || 'control'));

    document.querySelectorAll('.result > .label').forEach(el => {
      if (/^\s*\d+\s*[·.]/.test(el.textContent || '')) {
        el.classList.add('benefit-icon-label');
        const n = Number((el.textContent || '').match(/^\s*(\d+)/)?.[1] || 1);
        setIcon(el, ['benefit', 'subscription', 'implementation'][n - 1] || 'benefit', false);
      }
    });
    document.querySelectorAll('.europe-points > div > span:first-child').forEach((el, i) => setIcon(el, ['europe', 'residency', 'control'][i]));

    document.querySelectorAll('.industry-teaser > a > span:first-child, .industry-row .industry-no').forEach(el => {
      const href = el.closest('a')?.getAttribute('href') || '';
      const match = industryIcons.find(([, pattern]) => pattern.test(href));
      if (match) setIcon(el, match[0]);
    });

    document.querySelectorAll('.demo-panel-steps > span').forEach((el, i) => {
      if (!el.classList.contains('aidecis-icon-mark')) {
        el.classList.add('demo-icon-step');
        setIcon(el, ['explore', 'decide', 'simulate'][i], false);
      }
    });
  }

  enhance();
  // Reapply after the existing EN/ES/NL text switch replaces these nodes.
  const observer = new MutationObserver(() => enhance());
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
})();
