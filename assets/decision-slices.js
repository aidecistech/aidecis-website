(() => {
  const slices = [
    { id: 'expedite', title: 'Expedite freight', impactLabel: 'Avoidable freight and delay cost (€ per year)', note: 'Enter the annual avoidable freight premium and downstream delay cost. Compare the actual landed premium with a feasible standard mode and its expected cost of delay.', benchmark: 'UNCTAD observed Shanghai–US container spot rates more than double from December 2023 to July 2024: US$8,103/FEU westbound and US$9,945/FEU eastbound. Route rates are context, not your annual expedite savings.', source: 'UNCTAD, Review of Maritime Transport 2024', url: 'https://unctad.org/system/files/official-document/rmt2024_en.pdf' },
    { id: 'inventory', title: 'Inventory reallocation', impactLabel: 'Carrying, obsolescence and stockout cost (€ per year)', note: 'Use carrying cost, markdowns or write-offs avoided, and stockout contribution margin recovered. Exclude inventory principal; deduct transfer and handling costs from your baseline.', benchmark: 'There is no single global total for avoidable inventory imbalance. Inventory principal is working capital, not profit.', source: 'Eurostat and supply-chain research; see cost overview sources', url: 'https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Businesses_in_the_manufacturing_sector' },
    { id: 'supplier', title: 'Alternate supplier', impactLabel: 'Expected annual disruption loss with current sourcing (€)', note: 'Enter the expected annual disruption loss difference with and without a qualified alternate, net of qualification, switching and capacity costs.', benchmark: 'McKinsey modelled expected disruption losses near 45% of one year’s profit over a decade across 13 industries. This is broad risk context, not supplier-attributable savings.', source: 'McKinsey Global Institute, 2020', url: 'https://www.mckinsey.com/capabilities/operations/our-insights/risk-resilience-and-rebalancing-in-global-value-chains' },
    { id: 'po-exception', title: 'Purchase-order exception', impactLabel: 'Incremental exception handling and evidenced leakage (€ per year)', note: 'Enter incremental exception handling and rework, plus evidenced duplicate-payment recovery, missed discount or price correction. Do not use total invoice-processing cost as exception savings.', benchmark: 'APQC reports a US$6 median cost per invoice and US$1.36 per invoice line. These are process baselines, not the incremental cost of an exception.', source: 'APQC, invoice-processing benchmark', url: 'https://www.apqc.org/What-Is-the-Average-Cost-to-Process-an-Invoice' },
    { id: 'price-envelope', title: 'Price beyond envelope', impactLabel: 'Validated avoidable price variance (€ per year)', note: 'Enter validated, avoidable net price variance on matched specification, volume, Incoterms, service and timing. Separate a policy breach from an economically adverse price.', benchmark: 'EU manufacturing purchases were €7.50T in 2023. This is the scale of the input base, not off-envelope spend or overpayment.', source: 'Eurostat, Businesses in the manufacturing sector', url: 'https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Businesses_in_the_manufacturing_sector' },
    { id: 'spot-buy', title: 'Spot buy outside contract', impactLabel: 'Net spot-buy premium versus a feasible contract (€ per year)', note: 'Compare the spot order with the contract available at that time, adjusted for quantity, quality, delivery, landed cost and production loss avoided.', benchmark: 'Freight spot-rate changes do not measure commodity, component or corporate spot-buy premiums. Use the feasible contract at order time as the comparison.', source: 'UNCTAD, Review of Maritime Transport 2024', url: 'https://unctad.org/system/files/official-document/rmt2024_en.pdf' },
    { id: 'policy-order', title: 'Order outside policy', impactLabel: 'Adverse order economics versus a compliant alternative (€ per year)', note: 'Enter adverse incremental economics versus the best feasible compliant alternative, including fulfillment, logistics, returns, service and risk. A policy exception alone is not a loss.', benchmark: 'No global loss rate is applied. Measure the order’s actual economics and risk against its feasible alternative.', source: 'Aidecis cost overview methodology', url: 'decision-costs.html#method' },
    { id: 'demand-surge', title: 'Demand surge allocation', impactLabel: 'Contribution margin recoverable from allocation (€ per year)', note: 'Count contribution margin from units actually fulfilled because of the allocation, less incremental logistics, penalties and contribution displaced from another customer.', benchmark: 'Global merchandise trade was about US$25T in 2024. Trade value is not constrained demand or lost contribution margin.', source: 'UNCTAD, Key Statistics and Trends in International Trade 2024', url: 'https://unctad.org/publication/key-statistics-and-trends-in-international-trade-2024' },
    { id: 'express-spare', title: 'Express spare part', impactLabel: 'Downtime value attributable to the express part (€ per year)', note: 'Count only verified bottleneck hours recovered because the part arrived earlier, valued at your contribution per hour. Deduct the express premium, part difference and repair cost.', benchmark: 'Siemens estimated US$1.4T in annual unplanned downtime cost across the Global 500; its automotive lost-hour example reached US$2.3M. Neither is spare-part-attributable savings.', source: 'Siemens / Senseye, The True Cost of Downtime 2024', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid%3A1b43afb5-2d07-47f7-9eb7-893fe7d0bc59/TCOD-2024_original.pdf' },
    { id: 'breakdown', title: 'Machine-breakdown response', impactLabel: 'Downtime value attributable to response time (€ per year)', note: 'Compare actual recovery with a feasible response baseline using diagnosed cause, response timestamps and line-level contribution. If this is the same outage as an express-spare case, deduct the overlap.', benchmark: 'Siemens reported lost-hour examples from US$36,000 in FMCG to US$2.3M in automotive. This and the US$1.4T Global 500 estimate overlap with the express-spare context; do not add them as separate global pools.', source: 'Siemens / Senseye, The True Cost of Downtime 2024', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid%3A1b43afb5-2d07-47f7-9eb7-893fe7d0bc59/TCOD-2024_original.pdf' }
  ];

  const knowledgeChecks = [
    'Decision types and accountable owners are documented.',
    'Evidence sources and their permitted use are verified.',
    'The applicable policy version and authority limits are known.',
    'Missing or uncertain evidence is visible to reviewers.',
    'Outcome measures and a human review path are defined.'
  ];
  const $ = (id) => document.getElementById(id);
  const t = (source) => window.AidecisI18n?.t(source) || source;
  const selected = new Set();
  const savedSliceValues = {};
  const savedKnowledgeChecks = new Set();
  const number = (value, lang) => new Intl.NumberFormat({ en: 'en-IE', es: 'es-ES', nl: 'nl-NL' }[lang] || 'en-IE', { maximumFractionDigits: 1 }).format(value);
  const money = (value, lang) => new Intl.NumberFormat({ en: 'en-IE', es: 'es-ES', nl: 'nl-NL' }[lang] || 'en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  const currencyRange = (low, high, lang) => Math.round(low) === Math.round(high) ? money(low, lang) : `${money(low, lang)} – ${money(high, lang)}`;

  function renderOptions() {
    $('decision-slice-options').innerHTML = slices.map((slice) => `<label class="decision-slice-option" for="slice-select-${slice.id}"><input id="slice-select-${slice.id}" type="checkbox" data-slice-select="${slice.id}"${selected.has(slice.id) ? ' checked' : ''}><span class="slice-option-copy"><b>${t(slice.title)}</b></span></label>`).join('');
    $('decision-slice-options').querySelectorAll('[data-slice-select]').forEach((input) => input.addEventListener('change', () => {
      input.checked ? selected.add(input.dataset.sliceSelect) : selected.delete(input.dataset.sliceSelect);
      renderCards(); renderResults();
    }));
  }

  function renderCards() {
    const lang = window.AidecisI18n?.language || 'en';
    $('decision-slice-cards').innerHTML = slices.filter((slice) => selected.has(slice.id)).map((slice) => `<article class="decision-slice-card" data-slice-card="${slice.id}">
      <header><span class="slice-card-index">${String(slices.indexOf(slice) + 1).padStart(2, '0')}</span><h4>${t(slice.title)}</h4><button class="slice-remove" type="button" data-remove-slice="${slice.id}" aria-label="${t('Remove')} ${t(slice.title)}">${t('Remove')}</button></header>
      <p class="slice-measure-note">${t(slice.note)}</p>
      <p class="slice-benchmark">${t(slice.benchmark)} <a href="${slice.url}" target="_blank" rel="noopener">${t(slice.source)}</a></p>
      <div class="slice-input-grid">
        <div class="business-case-field"><label for="slice-impact-${slice.id}">${t(slice.impactLabel)}</label><input id="slice-impact-${slice.id}" data-slice-impact="${slice.id}" type="number" min="0" max="100000000000" step="1000" placeholder="${t('Enter your baseline')}"><small>${t('Use your company data; do not enter the global benchmark as savings.')}</small></div>
        <div class="business-case-field"><label for="slice-share-${slice.id}">${t('Share directly addressable (%)')}</label><input id="slice-share-${slice.id}" data-slice-share="${slice.id}" type="number" min="0" max="100" step="1" value="40"><small>${t('Illustrative starting assumption; replace with your evidence.')}</small></div>
        <div class="business-case-field"><label for="slice-reduction-${slice.id}">${t('Expected change in addressed cost (%)')}</label><input id="slice-reduction-${slice.id}" data-slice-reduction="${slice.id}" type="number" min="0" max="100" step="1" value="10"><small>${t('Illustrative starting assumption; validate in a pilot.')}</small></div>
        <div class="business-case-field"><label for="slice-volume-${slice.id}">${t('Decisions of this type per year')}</label><input id="slice-volume-${slice.id}" data-slice-volume="${slice.id}" type="number" min="0" max="10000000" step="1" value=""><small>${t('Used to estimate review and compute costs.')}</small></div>
        <div class="business-case-field"><label for="slice-minutes-${slice.id}">${t('Review minutes per decision')}</label><input id="slice-minutes-${slice.id}" data-slice-minutes="${slice.id}" type="number" min="0" max="600" step="1" value="15"></div>
      </div>
      <p class="slice-estimate-line"><span>${t('Modeled annual opportunity for this slice')}</span><strong data-slice-estimate="${slice.id}">—</strong></p>
    </article>`).join('');
    $('decision-slice-cards').querySelectorAll('input').forEach((input) => {
      const key = input.dataset.sliceImpact ? `${input.dataset.sliceImpact}-impact` : input.dataset.sliceShare ? `${input.dataset.sliceShare}-share` : input.dataset.sliceReduction ? `${input.dataset.sliceReduction}-reduction` : input.dataset.sliceVolume ? `${input.dataset.sliceVolume}-volume` : `${input.dataset.sliceMinutes}-minutes`;
      if (Object.prototype.hasOwnProperty.call(savedSliceValues, key)) input.value = savedSliceValues[key];
      input.addEventListener('input', () => { savedSliceValues[key] = input.value; renderResults(); });
    });
    $('decision-slice-cards').querySelectorAll('[data-remove-slice]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.removeSlice; selected.delete(id); const checkbox = $(`slice-select-${id}`); if (checkbox) checkbox.checked = false; renderCards(); renderResults();
    }));
  }

  function renderKnowledge() {
    $('knowledge-checks').innerHTML = knowledgeChecks.map((label, i) => `<label class="knowledge-check"><input type="checkbox" data-knowledge-check="${i}"><span>${t(label)}</span></label>`).join('');
    $('knowledge-checks').querySelectorAll('input').forEach((input) => {
      input.checked = savedKnowledgeChecks.has(Number(input.dataset.knowledgeCheck));
      input.addEventListener('change', () => {
        const index = Number(input.dataset.knowledgeCheck);
        input.checked ? savedKnowledgeChecks.add(index) : savedKnowledgeChecks.delete(index);
        renderKnowledgeScore();
      });
    });
    renderKnowledgeScore();
  }
  function renderKnowledgeScore() {
    const count = $('knowledge-checks').querySelectorAll('input:checked').length;
    $('knowledge-score').textContent = `${count} / ${knowledgeChecks.length}`;
    $('knowledge-score').setAttribute('aria-label', t('{count} of {total} governance checks in place').replace('{count}', count).replace('{total}', knowledgeChecks.length));
  }

  function renderResults() {
    const lang = window.AidecisI18n?.language || 'en';
    const fmt = (value) => money(value, lang);
    const selectedSlices = slices.filter((slice) => selected.has(slice.id));
    $('selected-slice-count').textContent = selectedSlices.length
      ? t('{count} decision slices selected').replace('{count}', selectedSlices.length)
      : t('No decision slices selected.');
    const breakdown = [];
    let gross = 0, reviewCost = 0, totalEvents = 0, complete = 0, volumeComplete = 0;
    selectedSlices.forEach((slice) => {
      const impact = $(`slice-impact-${slice.id}`);
      const share = $(`slice-share-${slice.id}`);
      const reduction = $(`slice-reduction-${slice.id}`);
      const events = $(`slice-volume-${slice.id}`);
      const minutes = $(`slice-minutes-${slice.id}`);
      const estimateOut = document.querySelector(`[data-slice-estimate="${slice.id}"]`);
      const entered = impact && impact.value !== '' && Number.isFinite(Number(impact.value));
      const value = entered ? Number(impact.value) * Number(share.value) / 100 * Number(reduction.value) / 100 : 0;
      gross += value;
      if (entered) complete++;
      if (estimateOut) estimateOut.textContent = entered ? fmt(value) : t('Enter a company baseline');
      if (events && events.value !== '') {
        const eventCount = Number(events.value);
        totalEvents += eventCount; volumeComplete++;
        reviewCost += eventCount * (Number(minutes?.value || 0) / 60 * Number($('review-rate').value || 0) + Number($('compute-cost').value || 0));
      }
      breakdown.push(`<div class="slice-breakdown-row"><span>${t(slice.title)}${entered ? '' : ` <small>${t('baseline needed')}</small>`}</span><strong>${entered ? fmt(value) : '—'}</strong></div>`);
    });
    $('slice-value-breakdown').innerHTML = breakdown.join('');
    $('business-value-detail').textContent = !selectedSlices.length ? '—' : complete < selectedSlices.length ? t('Enter baselines to estimate') : fmt(gross);
    $('overlap-value').textContent = fmt(Number($('overlap-deduction').value || 0));
    $('trust-cost').textContent = !selectedSlices.length ? '—' : volumeComplete < selectedSlices.length ? t('Enter decision volumes') : fmt(reviewCost);
    const overlap = Number($('overlap-deduction').value || 0);
    const adjustedGross = gross - overlap;
    const net = adjustedGross - reviewCost;
    const scenarioComplete = selectedSlices.length > 0 && complete === selectedSlices.length && volumeComplete === selectedSlices.length;
    $('net-after-trust').textContent = scenarioComplete ? fmt(net) : '—';
    const pricing = window.aidecisPricingEstimate || { annualLow: 0, annualHigh: 0, onboardingLow: 0, onboardingHigh: 0, sprintLow: 0, sprintHigh: 0 };
    const costLow = pricing.annualLow + pricing.onboardingLow / 3;
    const costHigh = pricing.annualHigh + pricing.onboardingHigh / 3;
    $('annual-cost').textContent = currencyRange(costLow, costHigh, lang);
    $('annual-net').textContent = scenarioComplete ? currencyRange(net - costHigh, net - costLow, lang) : '—';
    const ratioLow = costHigh > 0 ? Math.max(0, net) / costHigh : 0;
    const ratioHigh = costLow > 0 ? Math.max(0, net) / costLow : 0;
    const ratioText = number(ratioLow, lang) === number(ratioHigh, lang) ? `${number(ratioLow, lang)}×` : `${number(ratioLow, lang)}× – ${number(ratioHigh, lang)}×`;
    $('annual-value-cost-ratio').textContent = scenarioComplete ? ratioText : '—';
    const paybackMonths = (upfront, annual) => net > annual ? Math.ceil(upfront / ((net - annual) / 12)) : Infinity;
    const paybackBest = paybackMonths(pricing.onboardingLow + pricing.sprintLow, pricing.annualLow);
    const paybackWorst = paybackMonths(pricing.onboardingHigh + pricing.sprintHigh, pricing.annualHigh);
    const paybackText = paybackBest === paybackWorst ? t('{months} months').replace('{months}', paybackWorst) : t('{low}–{high} months').replace('{low}', paybackBest).replace('{high}', paybackWorst);
    $('payback').textContent = !scenarioComplete ? '—' : paybackWorst === Infinity ? t('No payback at these assumptions') : paybackText;
    $('response-today').textContent = `${number(Number($('response-days').value || 0), lang)} ${t('days')}`;
    const check = $('business-case-check');
    if (!selectedSlices.length) check.textContent = t('Choose at least one decision slice to build a scenario.');
    else if (complete < selectedSlices.length) check.textContent = t('{count} selected slices still need company baselines before the portfolio estimate is complete.').replace('{count}', selectedSlices.length - complete);
    else if (volumeComplete < selectedSlices.length) check.textContent = t('Enter decision volumes for every selected slice to include review and compute costs.');
    else if (overlap > gross) check.textContent = t('The overlap deduction exceeds the modeled opportunity; review the value entered.');
    else if (selectedSlices.length > 1 && overlap === 0) check.textContent = t('Review event overlap across slices before relying on the combined total.');
    else if (net <= 0) check.textContent = t('At these assumptions, review, compute and overlap costs use up the modeled opportunity.');
    else check.textContent = t('{events} decisions per year are included in review and compute cost.').replace('{events}', number(totalEvents, lang));
    check.classList.toggle('is-below', net <= 0);
  }

  renderOptions(); renderKnowledge();
  $('review-rate').addEventListener('input', renderResults);
  $('compute-cost').addEventListener('input', renderResults);
  $('response-days').addEventListener('input', renderResults);
  $('overlap-deduction').addEventListener('input', renderResults);
  document.addEventListener('aidecis:languagechange', () => { renderOptions(); renderCards(); renderKnowledge(); renderResults(); });
  document.addEventListener('aidecis:pricingchange', renderResults);
  renderResults();
})();
