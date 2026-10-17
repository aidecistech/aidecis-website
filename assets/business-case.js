(() => {
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
      ['annual-cost', 'annual-net', 'annual-value-cost-ratio'].forEach((id) => { document.getElementById(id).textContent = '—'; });
      return;
    }
    error.textContent = '';
    const [downtime, expedite, leakage, addressable, reduction] = values;
    const annualValue = (downtime + expedite + leakage) * addressable / 100 * reduction / 100;
    const pricing = window.aidecisPricingEstimate || { annualSubscription: 0, monthly: 0, onboardingLow: 0, onboardingHigh: 0 };
    const subscriptionAnnual = pricing.annualSubscription;
    const onboardingLow = pricing.onboardingLow;
    const onboardingHigh = pricing.onboardingHigh;
    const costLow = subscriptionAnnual + onboardingLow / 5;
    const costHigh = subscriptionAnnual + onboardingHigh / 5;
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
  };
  fields.forEach((field) => field.addEventListener('input', render));
  document.addEventListener('aidecis:languagechange', render);
  render();
})();
