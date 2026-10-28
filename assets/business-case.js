(() => {
  const WRITE_OFF_YEARS = 3;
  const MIN_VALUE_RATIO = 3;
  const MAX_PAYBACK_MONTHS = 24;
  const ids = ['cost-downtime', 'cost-expedite', 'cost-leakage', 'addressable-share', 'improvement-rate'];
  const fields = ids.map((id) => document.getElementById(id));
  const valueOutputs = ['business-value', 'business-value-detail'];
  if (fields.some((field) => !field)) return;

  const currency = (value, language) => new Intl.NumberFormat(
    { en: 'en-IE', nl: 'nl-NL', es: 'es-ES' }[language] || 'en-IE',
    { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }
  ).format(value);
  const render = () => {
    const values = fields.map((field) => Number(field.value));
    const error = document.getElementById('business-case-error');
    const t = (source) => window.AidecisI18n?.t(source) || source;
    if (values.some((value, index) => !Number.isFinite(value) || value < Number(fields[index].min) || value > Number(fields[index].max))) {
      error.textContent = t('Enter values within the field limits to see the scenario estimate.');
      valueOutputs.forEach((id) => { document.getElementById(id).textContent = '—'; });
      document.getElementById('business-case-check').textContent = '';
      ['annual-cost', 'annual-net', 'annual-value-cost-ratio', 'payback'].forEach((id) => { document.getElementById(id).textContent = '—'; });
      return;
    }
    error.textContent = '';
    const [downtime, expedite, leakage, addressable, reduction] = values;
    const annualValue = (downtime + expedite + leakage) * addressable / 100 * reduction / 100;
    const pricing = window.aidecisPricingEstimate || { annualLow: 0, annualHigh: 0, onboardingLow: 0, onboardingHigh: 0, sprintLow: 0, sprintHigh: 0 };
    // Implementation is written off over three years.
    const costLow = pricing.annualLow + pricing.onboardingLow / WRITE_OFF_YEARS;
    const costHigh = pricing.annualHigh + pricing.onboardingHigh / WRITE_OFF_YEARS;
    // Payback: one-time investment (implementation + evidence sprint) / monthly value after the platform programme.
    const paybackMonths = (upfront, annual) => (annualValue > annual ? Math.ceil(upfront / ((annualValue - annual) / 12)) : Infinity);
    const paybackBest = paybackMonths(pricing.onboardingLow + pricing.sprintLow, pricing.annualLow);
    const paybackWorst = paybackMonths(pricing.onboardingHigh + pricing.sprintHigh, pricing.annualHigh);
    const netLow = annualValue - costHigh;
    const netHigh = annualValue - costLow;
    const lang = window.AidecisI18n?.language || 'en';
    valueOutputs.forEach((id) => { document.getElementById(id).textContent = currency(annualValue, lang); });
    document.getElementById('annual-cost').textContent = `${currency(costLow, lang)} – ${currency(costHigh, lang)}`;
    document.getElementById('annual-net').textContent = `${currency(netLow, lang)} – ${currency(netHigh, lang)}`;
    const ratioLow = costHigh > 0 ? annualValue / costHigh : 0;
    const ratioHigh = costLow > 0 ? annualValue / costLow : 0;
    const number = (value) => new Intl.NumberFormat({ en: 'en-IE', nl: 'nl-NL', es: 'es-ES' }[lang] || 'en-IE', { maximumFractionDigits: 1 }).format(value);
    document.getElementById('annual-value-cost-ratio').textContent = `${number(ratioLow)}× – ${number(ratioHigh)}×`;
    document.getElementById('payback').textContent = paybackWorst === Infinity
      ? t('No payback at these assumptions')
      : t('{low}–{high} months').replace('{low}', paybackBest).replace('{high}', paybackWorst);
    const meets = ratioLow >= MIN_VALUE_RATIO && paybackWorst <= MAX_PAYBACK_MONTHS;
    const check = document.getElementById('business-case-check');
    check.classList.toggle('is-below', !meets);
    check.textContent = meets
      ? t('Meets our business-case threshold across the whole range: value of at least 3× annual costs and payback within 24 months.')
      : t('Below our business-case threshold of value at least 3× annual costs and payback within 24 months. Review the assumptions or narrow the scope.');
  };
  fields.forEach((field) => field.addEventListener('input', render));
  document.addEventListener('aidecis:languagechange', render);
  document.addEventListener('aidecis:pricingchange', render);
  render();
})();
