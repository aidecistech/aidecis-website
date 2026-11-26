(() => {
  const slices = [
    { id: 'expedite', title: 'Expedite freight', kpi: 'freight', pool: 'freight', share: 1, benchmarkValue: '12%', benchmarkLabel: 'median expedited share of freight costs', benchmarkScope: 'APQC cross-industry benchmark, 5,211 organizations. This is expedite spend, not avoidable savings.', source: 'APQC', url: 'https://www.apqc.org/what-we-do/benchmarking/open-standards-benchmarking/measures/expedited-costs-percentage-freight' },
    { id: 'inventory', title: 'Inventory reallocation', kpi: 'inventory', pool: 'inventory', share: 1, benchmarkValue: '10%', benchmarkLabel: 'median inventory carrying cost as a share of inventory value', benchmarkScope: 'APQC cross-industry benchmark, 6,468 organizations. It is a cost pool, not the amount reallocation can avoid.', source: 'APQC', url: 'https://www.apqc.org/resources/benchmarking/open-standards-benchmarking/measures/inventory-carrying-cost-percentage' },
    { id: 'supplier', title: 'Alternate supplier', kpi: 'revenue', pool: 'disruption', share: .6, benchmarkValue: '1.74%', benchmarkLabel: 'average revenue loss from supply-chain disruption', benchmarkScope: 'FTI survey result reported in an APEC analysis. Broad disruption context, not supplier-specific or an annual Aidecis saving.', source: 'APEC report', url: 'https://www.apec.org/docs/default-source/publications/2024/1/224_psu_resilient-supply-chain.pdf' },
    { id: 'po-exception', title: 'Purchase-order exception', kpi: 'supplyChain', pool: 'procurement', share: .35, benchmarkValue: '1% sensitivity', benchmarkLabel: 'of affected annual spend allocated across procurement decisions', benchmarkScope: 'Aidecis cost-overview sensitivity used as an illustrative cost pool, not a published exception-loss rate. This slice is allocated 35% of that pool.', source: 'Aidecis cost overview', url: 'decision-costs.html#method' },
    { id: 'price-envelope', title: 'Price beyond envelope', kpi: 'supplyChain', pool: 'procurement', share: .3, benchmarkValue: '1% sensitivity', benchmarkLabel: 'of affected annual spend allocated across procurement decisions', benchmarkScope: 'Aidecis cost-overview sensitivity used as an illustrative cost pool, not a published overpayment rate. This slice is allocated 30% of that pool.', source: 'Aidecis cost overview', url: 'decision-costs.html#method' },
    { id: 'spot-buy', title: 'Spot buy outside contract', kpi: 'supplyChain', pool: 'procurement', share: .2, benchmarkValue: '1% sensitivity', benchmarkLabel: 'of affected annual spend allocated across procurement decisions', benchmarkScope: 'Aidecis cost-overview sensitivity used as an illustrative cost pool, not a published spot-buy premium. This slice is allocated 20% of that pool.', source: 'Aidecis cost overview', url: 'decision-costs.html#method' },
    { id: 'policy-order', title: 'Order outside policy', kpi: 'supplyChain', pool: 'procurement', share: .15, benchmarkValue: '1% sensitivity', benchmarkLabel: 'of affected annual spend allocated across procurement decisions', benchmarkScope: 'Aidecis cost-overview sensitivity used as an illustrative cost pool, not a published policy-loss rate. This slice is allocated 15% of that pool.', source: 'Aidecis cost overview', url: 'decision-costs.html#method' },
    { id: 'demand-surge', title: 'Demand surge allocation', kpi: 'revenue', pool: 'disruption', share: .4, benchmarkValue: '~US$25T', benchmarkLabel: 'global merchandise trade in 2024', benchmarkScope: 'UNCTAD trade value. It is not unmet demand, lost sales or recoverable contribution margin.', source: 'UNCTAD', url: 'https://unctad.org/publication/key-statistics-and-trends-in-international-trade-2024' },
    { id: 'express-spare', title: 'Express spare part', kpi: 'downtime', pool: 'downtime', share: .6, benchmarkValue: 'US$1.4T / year', benchmarkLabel: 'estimated unplanned downtime cost across the Global 500', benchmarkScope: 'Siemens / Senseye estimate, equivalent to 11% of Global 500 revenue. Not the share an express part can prevent.', source: 'Siemens / Senseye', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid%3A1b43afb5-2d07-47f7-9eb7-893fe7d0bc59/TCOD-2024_original.pdf' },
    { id: 'breakdown', title: 'Machine-breakdown response', kpi: 'downtime', pool: 'downtime', share: .4, benchmarkValue: 'US$36k–2.3M', benchmarkLabel: 'reported cost per lost hour, FMCG to automotive', benchmarkScope: 'Siemens / Senseye sector examples. Related downtime estimates overlap; do not add them as independent global pools.', source: 'Siemens / Senseye', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid%3A1b43afb5-2d07-47f7-9eb7-893fe7d0bc59/TCOD-2024_original.pdf' }
  ];
  const $ = (id) => document.getElementById(id);
  const t = (source) => window.AidecisI18n?.t(source) || source;
  const selected = new Set();
  const knowledgeId = 'governed-knowledge';
  let lastAnnouncedSliceCount = null;
  const formatMoney = (value, lang) => new Intl.NumberFormat({ en: 'en-IE', es: 'es-ES', nl: 'nl-NL' }[lang] || 'en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  function profile() {
    return {
      revenue: Number($('kpi-revenue').value || 0),
      supplyChain: Number($('kpi-supply-chain').value || 0),
      freight: Number($('kpi-freight').value || 0),
      inventory: Number($('kpi-inventory').value || 0),
      downtime: Number($('kpi-downtime').value || 0)
    };
  }

  function renderOptions() {
    const lang = window.AidecisI18n?.language || 'en';
    $('decision-slice-options').innerHTML = slices.map((slice) => `<label class="decision-slice-option" for="slice-select-${slice.id}"><input id="slice-select-${slice.id}" type="checkbox" data-slice-select="${slice.id}"${selected.has(slice.id) ? ' checked' : ''}><span class="slice-option-copy"><b>${t(slice.title)}</b><small>${slice.benchmarkValue} · ${t(slice.benchmarkLabel)}</small></span></label>`).join('') + `<label class="decision-slice-option knowledge-option" for="slice-select-${knowledgeId}"><input id="slice-select-${knowledgeId}" type="checkbox" data-slice-select="${knowledgeId}"${selected.has(knowledgeId) ? ' checked' : ''}><span class="slice-option-copy"><b>${t('Governed Knowledge')}</b><small>${t('Cross-cutting modeled uplift; no standalone global cost rate')}</small></span></label>`;
    $('decision-slice-options').querySelectorAll('[data-slice-select]').forEach((input) => input.addEventListener('change', () => {
      input.checked ? selected.add(input.dataset.sliceSelect) : selected.delete(input.dataset.sliceSelect);
      renderResults();
    }));
  }

  function renderResults() {
    const lang = window.AidecisI18n?.language || 'en';
    const data = profile();
    const chosen = slices.filter((slice) => selected.has(slice.id));
    const knowledgeSelected = selected.has(knowledgeId);
    const results = chosen.map((slice) => {
      let exposure = data[slice.kpi];
      if (slice.pool === 'freight') exposure *= .12;
      if (slice.pool === 'inventory') exposure *= .10;
      if (slice.pool === 'disruption') exposure *= .0174;
      if (slice.pool === 'procurement') exposure *= .01;
      const potential = exposure * slice.share;
      const enabled = data[slice.kpi] > 0;
      return { slice, exposure, potential, enabled };
    });
    const scenarioRates = (row) => row.slice.id === 'demand-surge'
      ? { low: .10, mid: .10, high: .10 }
      : { low: .05, mid: .10, high: .15 };
    const availableResults = results.filter((row) => row.enabled);
    const low = availableResults.reduce((sum, row) => sum + row.potential * scenarioRates(row).low, 0);
    const mid = availableResults.reduce((sum, row) => sum + row.potential * scenarioRates(row).mid, 0);
    const high = availableResults.reduce((sum, row) => sum + row.potential * scenarioRates(row).high, 0);
    const knowledgeUplift = knowledgeSelected ? mid * .10 : 0;
    const totalLow = low + knowledgeUplift * .5;
    const totalMid = mid + knowledgeUplift;
    const totalHigh = high + knowledgeUplift * 1.5;
    $('selected-slice-count').textContent = t('{count} selected').replace('{count}', chosen.length + (knowledgeSelected ? 1 : 0));
    const selectedCount = chosen.length + (knowledgeSelected ? 1 : 0);
    if (selectedCount !== lastAnnouncedSliceCount) {
      lastAnnouncedSliceCount = selectedCount;
      document.dispatchEvent(new CustomEvent('aidecis:sliceschanged', { detail: { count: selectedCount } }));
    }
    $('slice-value-breakdown').innerHTML = results.map(({ slice, exposure, potential, enabled }) => {
      const rates = scenarioRates({ slice });
      const estimate = rates.low === rates.high
        ? formatMoney(potential * rates.mid, lang)
        : `${formatMoney(potential * rates.low, lang)} – ${formatMoney(potential * rates.high, lang)}`;
      return `<div class="slice-breakdown-row"><span>${t(slice.title)}<small>${enabled ? `${t('Modeled cost pool')}: ${formatMoney(exposure, lang)} · ${Math.round(slice.share * 100)}% allocation` : t('Enter the matching KPI above')}</small>${enabled ? `<details class="slice-scope"><summary>${slice.benchmarkValue} · ${t(slice.benchmarkLabel)}</summary><span>${t(slice.benchmarkScope)} <a href="${slice.url}" target="_blank" rel="noopener">${t(slice.source)} ↗</a></span></details>` : ''}</span><strong>${enabled ? estimate : '—'}</strong></div>`;
    }).join('') + (knowledgeSelected ? `<div class="slice-breakdown-row"><span>${t('Governed Knowledge')}<small>${t('10% modeled uplift on selected slice scenarios')}</small></span><strong>${formatMoney(knowledgeUplift, lang)}</strong></div>` : '');
    const estimateReady = availableResults.length > 0 && data.revenue > 0;
    const missingCount = results.length - availableResults.length;
    $('net-after-trust').textContent = estimateReady ? `${formatMoney(totalLow, lang)} – ${formatMoney(totalHigh, lang)}` : '—';
    $('business-case-check').textContent = !chosen.length && !knowledgeSelected
      ? t('Choose one or more decision slices to see a live scenario.')
      : data.revenue <= 0
        ? t('Enter annual revenue to calculate your company-scale estimate.')
        : !estimateReady
          ? t('Enter the KPI needed for at least one selected slice to see an estimate.')
          : missingCount > 0
            ? t('{available} of {selected} selected decision slices have the KPIs needed for an estimate. Add the missing optional KPI figures to include the other slices.').replace('{available}', availableResults.length).replace('{selected}', results.length)
            : t('Illustrative annual savings range, before investment. Use the method and source notes below to review assumptions.');
    const pricing = window.aidecisPricingEstimate || { annual: 0, implementation: 0 };
    const pilotMidpoint = ((pricing.sprintLow || 0) + (pricing.sprintHigh || 0)) / 2;
    const annualInvestment = (pricing.annual || 0) + ((pricing.implementation || 0) + pilotMidpoint) / 3;
    $('annual-cost').textContent = pricing.annual ? formatMoney(annualInvestment, lang) : '—';
    $('annual-net').textContent = estimateReady ? `${formatMoney(totalLow - annualInvestment, lang)} – ${formatMoney(totalHigh - annualInvestment, lang)}` : '—';
    $('annual-value-cost-ratio').textContent = estimateReady && annualInvestment > 0 ? `${(totalMid / annualInvestment).toFixed(1)}×` : '—';
    const annualSurplus = totalMid - (pricing.annual || 0);
    const paybackMonths = annualSurplus > 0 ? Math.ceil(((pricing.implementation || 0) + pilotMidpoint) / (annualSurplus / 12)) : 0;
    $('payback').textContent = estimateReady && paybackMonths > 0 ? t(paybackMonths === 1 ? '1 month' : '{months} months').replace('{months}', paybackMonths) : '—';
  }

  renderOptions();
  document.querySelectorAll('[data-company-kpi]').forEach((input) => input.addEventListener('input', renderResults));
  document.addEventListener('aidecis:languagechange', () => { renderOptions(); renderResults(); });
  document.addEventListener('aidecis:pricingchange', renderResults);
  renderResults();
})();
