const WS_CORE_CARD_VERSION = '0.3.2';

class WsCoreCard extends HTMLElement {
  setConfig(config) {
    if (!config || config.type !== 'custom:ws-core-card') throw new Error('Set type: custom:ws-core-card');
    this.config = config;
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  set hass(hass) { this._hass = hass; if (this.config) this.render(); }
  getCardSize() { return 7; }

  entity(suffix) {
    const defaults = { hdd_base: 'number.weather_station_core_hdd_base' };
    const id = this.config?.entities?.[suffix] || defaults[suffix] || `${this.config?.ws_core_prefix || 'sensor.weather_station_core_'}${suffix}`;
    return this._hass?.states?.[id];
  }

  weather() { return this._hass?.states?.[this.config?.weather_entity || 'weather.weather_station_core']; }
  unavailable(state) { return !state || state.state === 'unknown' || state.state === 'unavailable'; }
  value(state, fallback = '-') { return this.unavailable(state) ? fallback : state.state; }
  attr(state, name, fallback = '-') { const value = state?.attributes?.[name]; return value === undefined || value === null || value === '' ? fallback : value; }
  unit(state) { return state?.attributes?.unit_of_measurement || ''; }
  number(state) { const value = Number(this.value(state, NaN)); return Number.isFinite(value) ? value : null; }
  display(state, decimals = 1) { const value = this.number(state); return value === null ? '-' : value.toFixed(decimals).replace(/\.0$/, ''); }
  percentage(state) { const value = this.number(state); return value === null ? null : Math.round(value <= 1 ? value * 100 : value); }
  words(value) { return String(value ?? '').replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
  safeInsight(builder, fallback) {
    try { return builder(); } catch (error) { console.warn('[Weather Station Core Card] insight unavailable', error); return fallback; }
  }

  metric(label, state, decimals = 1) {
    const missing = this.unavailable(state);
    return `<div class="metric ${missing ? 'unavailable' : ''}"><span>${label}</span><strong>${missing ? 'Unavailable' : `${this.display(state, decimals)} ${this.unit(state)}`}</strong></div>`;
  }

  confidenceLabel(score) {
    if (score === null) return 'Unavailable';
    if (score >= 85) return 'High confidence';
    if (score >= 60) return 'Good confidence';
    if (score >= 35) return 'Limited confidence';
    return 'Low confidence';
  }

  heatingInsight(hdd, anomaly, temperature, base) {
    const demand = this.number(hdd), departure = this.number(anomaly), temp = this.number(temperature), baseTemp = this.number(base);
    if (demand !== null) {
      const level = demand >= 12 ? 'High heating demand' : demand >= 6 ? 'Moderate heating demand' : demand > 0 ? 'Light heating demand' : 'Little heating demand';
      const context = departure === null ? `Today: ${this.display(hdd, 1)} HDD.` : `${Math.abs(departure).toFixed(1)} degrees ${departure < 0 ? 'below' : 'above'} the 30-day average.`;
      return { level, context };
    }
    if (temp !== null && baseTemp !== null) {
      const gap = baseTemp - temp;
      return { level: gap >= 8 ? 'High heating demand' : gap > 0 ? 'Heating likely' : 'Little heating demand', context: `${Math.abs(gap).toFixed(1)} degrees ${gap >= 0 ? 'below' : 'above'} the ${this.display(base, 0)} degree base.` };
    }
    return { level: 'Heating demand unavailable', context: 'Waiting for heating inputs.' };
  }

  rainInsight(intensity, rain, likelihood, confidence) {
    const amount = this.number(rain), chance = this.percentage(likelihood);
    const intensityText = this.unavailable(intensity) ? '' : this.words(this.value(intensity));
    if (chance !== null) return { level: chance >= 70 ? 'Rain likely soon' : chance >= 35 ? 'Showers possible' : 'Rain unlikely soon', context: `${chance}% likelihood${amount !== null ? `; ${this.display(rain, 1)} ${this.unit(rain)} expected in 60 min` : ''}.` };
    if (amount !== null) return { level: amount > 1 ? 'Rain likely soon' : amount > 0 ? 'Light rain possible' : 'No rain expected soon', context: `${this.display(rain, 1)} ${this.unit(rain)} projected in the next 60 min${intensityText ? `; ${intensityText} now` : ''}.` };
    if (intensityText) return { level: `${intensityText} now`, context: `${this.confidenceLabel(this.percentage(confidence))} nowcast.` };
    return { level: 'Rain likelihood unavailable', context: 'Waiting for nowcast data.' };
  }

  dataInsight(quality, confidence) {
    const qualityScore = this.percentage(quality), nowcastScore = this.percentage(confidence);
    const scores = [qualityScore, nowcastScore].filter(score => score !== null);
    const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
    const sources = [qualityScore !== null && 'station data', nowcastScore !== null && 'rain nowcast'].filter(Boolean);
    return { level: this.confidenceLabel(score), context: score === null ? 'Waiting for data-quality signals.' : `${score}% combined confidence from ${sources.join(' and ')}.` };
  }

  comfortInsight(humidity, dew, temperature) {
    const rh = this.percentage(humidity), dewPoint = this.number(dew), temp = this.number(temperature);
    if (rh === null && dewPoint === null) return { level: 'Comfort unavailable', context: 'Waiting for humidity and dew-point data.' };
    if (rh !== null && rh >= 80) return { level: 'Muggy and condensation-prone', context: `${rh}% humidity${dewPoint !== null ? `; dew point ${this.display(dew, 1)} degrees` : ''}.` };
    if (dewPoint !== null && temp !== null && temp - dewPoint <= 3) return { level: 'Condensation risk', context: `Air temperature is only ${Math.max(0, temp - dewPoint).toFixed(1)} degrees above the dew point.` };
    if (rh !== null && rh <= 35) return { level: 'Dry indoor air likely', context: `${rh}% humidity; consider adding moisture indoors.` };
    return { level: 'Comfortable moisture levels', context: rh !== null ? `${rh}% humidity${dewPoint !== null ? `; dew point ${this.display(dew, 1)} degrees` : ''}.` : `Dew point ${this.display(dew, 1)} degrees.` };
  }

  frostInsight(temperature, dew) {
    const temp = this.number(temperature), dewPoint = this.number(dew);
    if (temp === null) return { level: 'Frost risk unavailable', context: 'Waiting for temperature data.' };
    if (temp <= 0) return { level: 'Frost likely', context: `Temperature is ${temp.toFixed(1)} degrees; protect exposed plants and pipes.` };
    if (temp <= 3 && dewPoint !== null && dewPoint <= 1) return { level: 'Frost possible', context: `Temperature is ${temp.toFixed(1)} degrees with a near-freezing dew point.` };
    return { level: 'Low frost risk', context: `Temperature is ${temp.toFixed(1)} degrees.` };
  }

  windChillInsight(temperature, wind) {
    const temp = this.number(temperature), speed = this.number(wind);
    if (temp === null || speed === null || temp > 10 || speed < 5) return { level: 'No notable wind chill', context: 'Wind and temperature do not indicate significant exposure.' };
    const windUnit = this.unit(wind), kmh = /mph/i.test(windUnit) ? speed * 1.60934 : /m\/s|ms-1/i.test(windUnit) ? speed * 3.6 : speed;
    const chill = 13.12 + 0.6215 * temp - 11.37 * Math.pow(kmh, 0.16) + 0.3965 * temp * Math.pow(kmh, 0.16);
    return { level: chill <= -10 ? 'Strong wind chill' : chill <= 0 ? 'Noticeable wind chill' : 'Mild wind chill', context: `Feels like about ${chill.toFixed(1)} degrees at ${speed.toFixed(1)} ${this.unit(wind) || 'km/h'} wind.` };
  }

  dryingInsight(humidity, rain, likelihood, wind) {
    const rh = this.percentage(humidity), amount = this.number(rain), chance = this.percentage(likelihood), speed = this.number(wind);
    if (rh === null && amount === null && chance === null) return { level: 'Drying outlook unavailable', context: 'Waiting for humidity, rain, or wind data.' };
    if ((chance !== null && chance >= 60) || (amount !== null && amount > 0.5)) return { level: 'Poor drying window', context: 'Rain is likely or expected in the next hour.' };
    if (rh !== null && rh >= 75) return { level: 'Slow drying conditions', context: `${rh}% humidity${speed !== null ? ` with ${speed.toFixed(1)} ${this.unit(wind)} wind` : ''}.` };
    if (rh !== null && rh <= 60 && (speed === null || speed >= 8)) return { level: 'Good drying window', context: `${rh}% humidity${speed !== null ? ` and ${speed.toFixed(1)} ${this.unit(wind)} wind` : ''}; rain not indicated.` };
    return { level: 'Moderate drying conditions', context: 'Some moisture or wind is present; drying may take time.' };
  }

  render() {
    if (!this.shadowRoot) return;
    const temp = this.entity('temperature'), humidity = this.entity('humidity'), dew = this.entity('dew_point');
    const hdd = this.entity('heating_degree_day'), anomaly = this.entity('temperature_anomaly_30_day'), base = this.entity('hdd_base');
    const nowcast = this.entity('nowcast_intensity'), confidence = this.entity('nowcast_confidence'), rain = this.entity('rain_next_60_min'), likelihood = this.entity('rain_likelihood'), wind = this.entity('wind_speed');
    const quality = this.entity('data_quality_score');
    const heating = this.safeInsight(() => this.heatingInsight(hdd, anomaly, temp, base), { level: 'Heating demand unavailable', context: 'Waiting for heating inputs.' });
    const rainOutlook = this.safeInsight(() => this.rainInsight(nowcast, rain, likelihood, confidence), { level: 'Rain likelihood unavailable', context: 'Waiting for nowcast data.' });
    const data = this.safeInsight(() => this.dataInsight(quality, confidence), { level: 'Data confidence unavailable', context: 'Waiting for data-quality signals.' });
    const comfort = this.safeInsight(() => this.comfortInsight(humidity, dew, temp), { level: 'Comfort unavailable', context: 'Waiting for humidity and dew-point data.' });
    const frost = this.safeInsight(() => this.frostInsight(temp, dew), { level: 'Frost risk unavailable', context: 'Waiting for temperature data.' });
    const windChill = this.safeInsight(() => this.windChillInsight(temp, wind), { level: 'Wind chill unavailable', context: 'Waiting for wind and temperature data.' });
    const drying = this.safeInsight(() => this.dryingInsight(humidity, rain, likelihood, wind), { level: 'Drying outlook unavailable', context: 'Waiting for humidity, rain, or wind data.' });
    this.shadowRoot.innerHTML = `<style>${WsCoreCard.styles()}</style><ha-card><div class="content">
      <section class="insights">
        <div class="insight heating"><span class="insight-label">Heating demand</span><strong>${heating.level}</strong><p>${heating.context}</p></div>
        <div class="insight rain"><span class="insight-label">Rain likelihood and nowcast</span><strong>${rainOutlook.level}</strong><p>${rainOutlook.context}</p></div>
        <div class="insight confidence"><span class="insight-label">Data confidence</span><strong>${data.level}</strong><p>${data.context}</p></div>
        <div class="insight comfort"><span class="insight-label">Comfort and condensation</span><strong>${comfort.level}</strong><p>${comfort.context}</p></div>
        <div class="insight frost"><span class="insight-label">Frost risk</span><strong>${frost.level}</strong><p>${frost.context}</p></div>
        <div class="insight wind"><span class="insight-label">Wind-chill exposure</span><strong>${windChill.level}</strong><p>${windChill.context}</p></div>
        <div class="insight drying"><span class="insight-label">Drying window</span><strong>${drying.level}</strong><p>${drying.context}</p></div>
      </section>
    </div></ha-card>`;
  }

  static styles() { return `:host{display:block;container-type:inline-size}ha-card{overflow:hidden}.content{padding:0;color:var(--primary-text-color)}.insights{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px}.insight{border-radius:12px;padding:12px;background:var(--secondary-background-color);border-left:3px solid var(--primary-color)}.insight.rain{border-left-color:#60a5fa}.insight.confidence{border-left-color:#a78bfa}.insight.comfort{border-left-color:#34d399}.insight.frost{border-left-color:#93c5fd}.insight.wind{border-left-color:#fbbf24}.insight.drying{border-left-color:#fb923c}.insight-label{display:block;font-size:.72rem;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.04em}.insight>strong{display:block;font-size:1rem;margin-top:3px}.insight p{font-size:.82rem;color:var(--secondary-text-color);margin:4px 0 0}@container (max-width:520px){.insights{grid-template-columns:1fr}}`; }
}

const registerCard = (tag, klass) => {
  const existing = customElements.get(tag);
  if (!existing) {
    customElements.define(tag, klass);
    return;
  }
  // Home Assistant may load a new resource without rebuilding the existing element.
  // Copy the new prototype methods across so visible cards update in place.
  for (const name of Object.getOwnPropertyNames(klass.prototype)) {
    if (name !== 'constructor') Object.defineProperty(existing.prototype, name, Object.getOwnPropertyDescriptor(klass.prototype, name));
  }
  document.querySelectorAll(tag).forEach(card => card.render?.());
};
registerCard('ws-core-card', WsCoreCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'ws-core-card', name: 'Weather Station Core Card', description: `Interpreted heating, rain, and data-confidence overview (v${WS_CORE_CARD_VERSION}).` });
console.info(`[Weather Station Core Card] loaded v${WS_CORE_CARD_VERSION}`);
