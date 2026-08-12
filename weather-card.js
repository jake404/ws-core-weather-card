const WS_CORE_CARD_VERSION = '0.3.0';

class WsCoreCard extends HTMLElement {
  setConfig(config) {
    if (!config || config.type !== 'custom:ws-core-card') throw new Error('Set type: custom:ws-core-card');
    this.config = config;
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  set hass(hass) { this._hass = hass; if (this.config) this.render(); }
  getCardSize() { return 4; }

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

  render() {
    if (!this.shadowRoot) return;
    const weather = this.weather(), temp = this.entity('temperature'), humidity = this.entity('humidity'), dew = this.entity('dew_point');
    const hdd = this.entity('heating_degree_day'), anomaly = this.entity('temperature_anomaly_30_day'), base = this.entity('hdd_base');
    const nowcast = this.entity('nowcast_intensity'), confidence = this.entity('nowcast_confidence'), rain = this.entity('rain_next_60_min'), likelihood = this.entity('rain_likelihood');
    const alert = this.entity('alert_state'), quality = this.entity('data_quality_score');
    const condition = weather ? this.value(weather, 'Unavailable') : this.value(this.entity('current_condition'), 'Unavailable');
    const conditionLabel = weather?.attributes?.temperature !== undefined ? `${condition} - ${weather.attributes.temperature} ${weather.attributes.temperature_unit || ''}` : condition;
    const alertState = this.value(alert, 'Unavailable'), heating = this.heatingInsight(hdd, anomaly, temp, base), rainOutlook = this.rainInsight(nowcast, rain, likelihood, confidence), data = this.dataInsight(quality, confidence), comfort = this.comfortInsight(humidity, dew, temp);
    this.shadowRoot.innerHTML = `<style>${WsCoreCard.styles()}</style><ha-card><div class="content">
      <div class="header"><div><h1>${this.config.title || 'Home Weather'}</h1><div class="condition">${conditionLabel}</div></div><div class="status ${alertState === 'clear' ? 'ok' : 'warn'}">${alertState}</div></div>
      <section class="insights"><h2>Weather insights</h2>
        <div class="insight heating"><span class="insight-label">Heating demand</span><strong>${heating.level}</strong><p>${heating.context}</p></div>
        <div class="insight rain"><span class="insight-label">Rain likelihood and nowcast</span><strong>${rainOutlook.level}</strong><p>${rainOutlook.context}</p></div>
        <div class="insight confidence"><span class="insight-label">Data confidence</span><strong>${data.level}</strong><p>${data.context}</p></div>
        <div class="insight comfort"><span class="insight-label">Comfort and condensation</span><strong>${comfort.level}</strong><p>${comfort.context}</p></div>
      </section>
      <div class="footer"><span>Interpreted from station readings and derived sensors</span><span class="source">${this.attr(weather, 'attribution', 'Weather Station Core')}</span></div>
    </div></ha-card>`;
  }

  static styles() { return `:host{display:block}ha-card{overflow:hidden}.content{padding:16px;color:var(--primary-text-color)}.header{display:flex;justify-content:space-between;align-items:start;margin-bottom:14px}h1{font-size:1.25rem;margin:0 0 4px}.condition{color:var(--secondary-text-color);text-transform:capitalize}.status{padding:4px 8px;border-radius:999px;font-size:.75rem;text-transform:capitalize}.status.ok{background:rgba(74,222,128,.16);color:#4ade80}.status.warn{background:rgba(251,191,36,.16);color:#fbbf24}.insights{display:grid;gap:10px}.insight{border-radius:12px;padding:12px;background:var(--secondary-background-color);border-left:3px solid var(--primary-color)}.insight.rain{border-left-color:#60a5fa}.insight.confidence{border-left-color:#a78bfa}.insight.comfort{border-left-color:#34d399}.insight-label{display:block;font-size:.72rem;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.04em}.insight>strong{display:block;font-size:1rem;margin-top:3px}.insight p{font-size:.82rem;color:var(--secondary-text-color);margin:4px 0 0}.footer{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--divider-color);margin-top:16px;padding-top:10px;font-size:.72rem;color:var(--secondary-text-color)}.source{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:500px){.footer{display:block}.source{margin-top:4px}}`; }
}

const registerCard = (tag, klass) => { if (!customElements.get(tag)) customElements.define(tag, klass); };
registerCard('ws-core-card', WsCoreCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'ws-core-card', name: 'Weather Station Core Card', description: `Interpreted heating, rain, and data-confidence overview (v${WS_CORE_CARD_VERSION}).` });
console.info(`[Weather Station Core Card] loaded v${WS_CORE_CARD_VERSION}`);
