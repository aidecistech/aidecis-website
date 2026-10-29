// First-year economics next to the separate pilot, subscription and implementation figures:
// year one = pilot + annual subscription + one-time implementation; year two and later = subscription only.
(() => {
  const firstYear = document.getElementById('first-year');
  const yearTwo = document.getElementById('year-two');
  if (!firstYear || !yearTwo) return;
  const render = () => {
    const pricing = window.aidecisPricingEstimate;
    if (!pricing) return;
    const lang = window.AidecisI18n?.language || 'en';
    const t = (source) => window.AidecisI18n?.t(source) || source;
    const eur = new Intl.NumberFormat({ en: 'en-IE', nl: 'nl-NL', es: 'es-ES' }[lang] || 'en-IE',
      { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const low = pricing.sprintLow + pricing.annualLow + pricing.onboardingLow;
    const high = pricing.sprintHigh + pricing.annualHigh + pricing.onboardingHigh;
    firstYear.textContent = low === high ? eur.format(low) : `${eur.format(low)} – ${eur.format(high)}`;
    const recurring = pricing.annualLow === pricing.annualHigh
      ? eur.format(pricing.annualLow)
      : `${eur.format(pricing.annualLow)} – ${eur.format(pricing.annualHigh)}`;
    yearTwo.textContent = t('{amount} per year').replace('{amount}', recurring);
  };
  document.addEventListener('aidecis:languagechange', render);
  document.addEventListener('aidecis:pricingchange', render);
  render();
})();

(() => {
  const WRITE_OFF_YEARS = 3;
  const MIN_VALUE_RATIO = 3;
  const MAX_PAYBACK_MONTHS = 24;
  const ids = ['cost-downtime', 'cost-expedite', 'cost-leakage', 'addressable-share', 'improvement-rate',
    'decision-volume', 'review-minutes', 'review-rate', 'compute-cost', 'response-days'];
  const fields = ids.map((id) => document.getElementById(id));
  const valueOutputs = ['business-value', 'business-value-detail'];
  const resultOutputs = ['trust-cost', 'net-after-trust', 'annual-cost', 'annual-net', 'annual-value-cost-ratio', 'payback', 'response-today'];
  const assumptionOutputs = ['assume-value', 'assume-trust', 'assume-payback'];
  if (fields.some((field) => !field)) return;

  const locale = (language) => ({ en: 'en-IE', nl: 'nl-NL', es: 'es-ES' }[language] || 'en-IE');
  const currency = (value, language) => new Intl.NumberFormat(locale(language),
    { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  const between = (low, high, language) => (Math.round(low) === Math.round(high)
    ? currency(low, language)
    : `${currency(low, language)} – ${currency(high, language)}`);
  const render = () => {
    const values = fields.map((field) => Number(field.value));
    const error = document.getElementById('business-case-error');
    const t = (source) => window.AidecisI18n?.t(source) || source;
    if (values.some((value, index) => fields[index].value === '' || !Number.isFinite(value) || value < Number(fields[index].min) || value > Number(fields[index].max))) {
      error.textContent = t('Enter values within the field limits to see the scenario estimate.');
      [...valueOutputs, ...resultOutputs].forEach((id) => { document.getElementById(id).textContent = '—'; });
      document.getElementById('business-case-check').textContent = '';
      assumptionOutputs.forEach((id) => { const item = document.getElementById(id); if (item) item.textContent = ''; });
      return;
    }
    error.textContent = '';
    const [downtime, expedite, leakage, addressable, reduction, decisions, reviewMinutes, reviewRate, compute, responseDays] = values;
    const grossValue = (downtime + expedite + leakage) * addressable / 100 * reduction / 100;
    // The cost of trust: review effort at the loaded hourly cost, plus compute, for every decision in scope.
    const trustCost = decisions * (reviewMinutes / 60 * reviewRate + compute);
    const netValue = grossValue - trustCost;
    const pricing = window.aidecisPricingEstimate || { annualLow: 0, annualHigh: 0, onboardingLow: 0, onboardingHigh: 0, sprintLow: 0, sprintHigh: 0 };
    // Implementation is written off over three years.
    const costLow = pricing.annualLow + pricing.onboardingLow / WRITE_OFF_YEARS;
    const costHigh = pricing.annualHigh + pricing.onboardingHigh / WRITE_OFF_YEARS;
    // Payback: one-time investment (implementation + pilot) / monthly net value after the subscription.
    const paybackMonths = (upfront, annual) => (netValue > annual ? Math.ceil(upfront / ((netValue - annual) / 12)) : Infinity);
    const paybackBest = paybackMonths(pricing.onboardingLow + pricing.sprintLow, pricing.annualLow);
    const paybackWorst = paybackMonths(pricing.onboardingHigh + pricing.sprintHigh, pricing.annualHigh);
    const lang = window.AidecisI18n?.language || 'en';
    valueOutputs.forEach((id) => { document.getElementById(id).textContent = currency(grossValue, lang); });
    document.getElementById('trust-cost').textContent = currency(trustCost, lang);
    document.getElementById('net-after-trust').textContent = currency(netValue, lang);
    document.getElementById('annual-cost').textContent = between(costLow, costHigh, lang);
    document.getElementById('annual-net').textContent = between(netValue - costHigh, netValue - costLow, lang);
    const ratioLow = costHigh > 0 ? Math.max(0, netValue) / costHigh : 0;
    const ratioHigh = costLow > 0 ? Math.max(0, netValue) / costLow : 0;
    const number = (value, digits = 1) => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(value);
    document.getElementById('annual-value-cost-ratio').textContent = number(ratioLow) === number(ratioHigh)
      ? `${number(ratioLow)}×`
      : `${number(ratioLow)}× – ${number(ratioHigh)}×`;
    document.getElementById('payback').textContent = paybackWorst === Infinity
      ? t('No payback at these assumptions')
      : paybackBest === paybackWorst
        ? (paybackWorst === 1 ? t('1 month') : t('{months} months').replace('{months}', paybackWorst))
        : t('{low}–{high} months').replace('{low}', paybackBest).replace('{high}', paybackWorst);
    document.getElementById('response-today').textContent = responseDays === 1
      ? t('1 day')
      : t('{days} days').replace('{days}', number(responseDays));
    // The assumptions behind value and payback, in plain words and with the current inputs.
    const fill = (id, text) => { const item = document.getElementById(id); if (item) item.textContent = text; };
    const fill2 = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), t(template));
    fill('assume-value', fill2('Value: {exposure} in annual costs at risk × {share}% addressable × {reduction}% reduction = {value} a year. It moves with these three inputs only.', {
      exposure: currency(downtime + expedite + leakage, lang), share: number(addressable), reduction: number(reduction), value: currency(grossValue, lang) }));
    fill('assume-trust', fill2('Cost of trust: {decisions} decisions × ({minutes} minutes of review at {rate} an hour + {compute} compute) = {trust} a year, deducted from the value.', {
      decisions: number(decisions, 0), minutes: number(reviewMinutes), rate: currency(reviewRate, lang),
      compute: new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(compute), trust: currency(trustCost, lang) }));
    const upfront = between(pricing.onboardingLow + pricing.sprintLow, pricing.onboardingHigh + pricing.sprintHigh, lang);
    const subscription = between(pricing.annualLow, pricing.annualHigh, lang);
    fill('assume-payback', paybackWorst === Infinity
      ? fill2('Payback: the one-time pilot and implementation ({upfront}) are recovered only from net value left after the {subscription} subscription. At these inputs the net value does not cover the subscription.', { upfront, subscription })
      : fill2('Payback: the one-time pilot and implementation ({upfront}) divided by the monthly net value left after review, compute and the {subscription} subscription ({monthly} a month).', {
        upfront, subscription, monthly: between((netValue - pricing.annualHigh) / 12, (netValue - pricing.annualLow) / 12, lang) }));
    const meets = ratioLow >= MIN_VALUE_RATIO && paybackWorst <= MAX_PAYBACK_MONTHS;
    const check = document.getElementById('business-case-check');
    check.classList.toggle('is-below', !meets);
    check.textContent = meets
      ? t('Meets our business-case threshold across the whole range: net value of at least 3× annual costs and payback within 24 months.')
      : t('Below our business-case threshold of net value at least 3× annual costs and payback within 24 months. Review the assumptions or narrow the scope.');
  };
  fields.forEach((field) => field.addEventListener('input', render));
  document.addEventListener('aidecis:languagechange', render);
  document.addEventListener('aidecis:pricingchange', render);
  render();
})();
