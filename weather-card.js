const WS_CORE_CARD_VERSION = '0.3.0';

class WsCoreCard extends HTMLElement {
  setConfig(config) {
    if (!config || !['custom:ws-core-card', 'custom:ws-core-extremes-card', 'custom:ws-core-climate-card', 'custom:ws-core-streaks-card'].includes(config.type)) throw new Error('Set a valid Weather Station Core card type');
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

  render() {
    if (!this.shadowRoot) return;
    const weather = this.weather(), temp = this.entity('temperature'), feels = this.entity('feels_like'), humidity = this.entity('humidity'), dew = this.entity('dew_point');
    const hdd = this.entity('heating_degree_day'), hddSeason = this.entity('heating_degree_days_season'), anomaly = this.entity('temperature_anomaly_30_day'), avg = this.entity('temperature_average_24h');
    const low = this.entity('temperature_low_24h'), high = this.entity('temperature_high_24h'), base = this.entity('hdd_base');
    const nowcast = this.entity('nowcast_intensity'), confidence = this.entity('nowcast_confidence'), rain = this.entity('rain_next_60_min'), likelihood = this.entity('rain_likelihood');
    const alert = this.entity('alert_state'), quality = this.entity('data_quality_score');
    const condition = weather ? this.value(weather, 'Unavailable') : this.value(this.entity('current_condition'), 'Unavailable');
    const conditionLabel = weather?.attributes?.temperature !== undefined ? `${condition} - ${weather.attributes.temperature} ${weather.attributes.temperature_unit || ''}` : condition;
    const alertState = this.value(alert, 'Unavailable'), heating = this.heatingInsight(hdd, anomaly, temp, base), rainOutlook = this.rainInsight(nowcast, rain, likelihood, confidence), data = this.dataInsight(quality, confidence);
    this.shadowRoot.innerHTML = `<style>${WsCoreCard.styles()}</style><ha-card><div class="content">
      <div class="header"><div><h1>${this.config.title || 'Home Weather'}</h1><div class="condition">${conditionLabel}</div></div><div class="status ${alertState === 'clear' ? 'ok' : 'warn'}">${alertState}</div></div>
      <div class="grid">${this.metric('Temperature', temp)}${this.metric('Feels like', feels)}${this.metric('Humidity', humidity, 0)}${this.metric('Dew point', dew)}</div>
      <section class="insights"><h2>Weather insights</h2>
        <div class="insight heating"><span class="insight-label">Heating demand</span><strong>${heating.level}</strong><p>${heating.context}</p><div class="mini-grid">${this.metric('Today', hdd, 1)}${this.metric('Season', hddSeason, 1)}${this.metric('30-day anomaly', anomaly)}${this.metric('24h average', avg)}</div></div>
        <div class="insight rain"><span class="insight-label">Rain likelihood and nowcast</span><strong>${rainOutlook.level}</strong><p>${rainOutlook.context}</p><div class="mini-grid">${this.metric('Likelihood', likelihood, 0)}${this.metric('Intensity', nowcast, 0)}${this.metric('Next 60 min', rain)}${this.metric('Nowcast confidence', confidence, 0)}</div></div>
        <div class="insight confidence"><span class="insight-label">Data confidence</span><strong>${data.level}</strong><p>${data.context}</p><div class="mini-grid">${this.metric('Station quality', quality, 0)}${this.metric('Nowcast confidence', confidence, 0)}</div></div>
      </section>
      <div class="footer"><span>24h range: ${this.display(low)} ${this.unit(low)} - ${this.display(high)} ${this.unit(high)}</span><span class="source">${this.attr(weather, 'attribution', 'Weather Station Core')}</span></div>
    </div></ha-card>`;
  }

  static styles() { return `:host{display:block}ha-card{overflow:hidden}.content{padding:16px;color:var(--primary-text-color)}.header{display:flex;justify-content:space-between;align-items:start;margin-bottom:14px}h1{font-size:1.25rem;margin:0 0 4px}.condition{color:var(--secondary-text-color);text-transform:capitalize}.status{padding:4px 8px;border-radius:999px;font-size:.75rem;text-transform:capitalize}.status.ok{background:rgba(74,222,128,.16);color:#4ade80}.status.warn{background:rgba(251,191,36,.16);color:#fbbf24}.grid,.extremes,.mini-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.metric{background:var(--secondary-background-color);border-radius:10px;padding:10px;min-width:0}.metric span,.metric strong{display:block}.metric span{font-size:.75rem;color:var(--secondary-text-color)}.metric strong{font-size:1rem;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.unavailable strong{color:var(--disabled-text-color);font-size:.78rem}section{border-top:1px solid var(--divider-color);margin-top:16px;padding-top:12px}h2{font-size:.9rem;margin:0 0 9px}.range{font-size:.78rem;color:var(--secondary-text-color);margin-top:9px}.insights{display:grid;gap:10px}.insight{border-radius:12px;padding:12px;background:var(--secondary-background-color);border-left:3px solid var(--primary-color)}.insight.rain{border-left-color:#60a5fa}.insight.confidence{border-left-color:#a78bfa}.insight-label{display:block;font-size:.72rem;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.04em}.insight>strong{display:block;font-size:1rem;margin-top:3px}.insight p{font-size:.82rem;color:var(--secondary-text-color);margin:4px 0 10px}.mini-grid .metric{background:var(--card-background-color);padding:8px}.mini-grid .metric strong{font-size:.88rem}.footer{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--divider-color);margin-top:16px;padding-top:10px;font-size:.72rem;color:var(--secondary-text-color)}.source{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:500px){.grid,.extremes,.mini-grid{grid-template-columns:repeat(2,1fr)}}`; }
}

class WsCoreExtremesCard extends WsCoreCard {
  render() {
    if (!this.shadowRoot) return;
    const rows = [['24h high', 'temperature_high_24h'], ['24h low', 'temperature_low_24h'], ['Week high', 'temperature_high_week'], ['Week low', 'temperature_low_week'], ['Month high', 'temperature_high_month'], ['Month low', 'temperature_low_month'], ['All-time high', 'temperature_high_all_time'], ['All-time low', 'temperature_low_all_time'], ['24h gust', 'wind_gust_max_24h'], ['Record gust', 'wind_gust_max_all_time']];
    this.shadowRoot.innerHTML = `<style>${WsCoreCard.styles()}</style><ha-card><div class="content"><div class="header"><div><h1>${this.config.title || 'Weather Extremes'}</h1><div class="condition">Temperature and wind records</div></div></div><div class="extremes">${rows.map(([label, key]) => this.metric(label, this.entity(key))).join('')}</div></div></ha-card>`;
  }
}

class WsCoreClimateCard extends WsCoreCard {
  virtual(value, unit) { return value === undefined || value === null ? null : { state: String(value), attributes: { unit_of_measurement: unit } }; }
  render() {
    if (!this.shadowRoot) return;
    const climate = this.entity('climatology_30_day'), rainAnomaly = this.entity('rain_anomaly_30_day'), tempAnomaly = this.entity('temperature_anomaly_30_day'), rainMonth = this.entity('rain_this_month'), rainWeek = this.entity('rain_this_week'), n = climate?.attributes?.n_days;
    this.shadowRoot.innerHTML = `<style>${WsCoreCard.styles()}</style><ha-card><div class="content"><div class="header"><div><h1>${this.config.title || 'Climate'}</h1><div class="condition">Rolling 30-day context${n ? ` - ${n} days recorded` : ''}</div></div></div><div class="grid">${this.metric('Average high', this.virtual(climate?.attributes?.temp_high_avg, '&deg;C'))}${this.metric('Average low', this.virtual(climate?.attributes?.temp_low_avg, '&deg;C'))}${this.metric('Temp anomaly', tempAnomaly)}${this.metric('Rain anomaly', rainAnomaly)}</div><section><h2>Rain totals</h2><div class="grid">${this.metric('30-day total', this.virtual(climate?.attributes?.rain_total_period, 'mm'))}${this.metric('Average per day', this.virtual(climate?.attributes?.rain_total_avg_day, 'mm'))}${this.metric('This month', rainMonth)}${this.metric('This week', rainWeek)}</div><div class="range">Rain days: <b>${climate?.attributes?.days_with_rain ?? 'Unavailable'}</b> - Records ${climate?.attributes?.temp_low_record ?? '-'}&deg; - ${climate?.attributes?.temp_high_record ?? '-'}&deg;</div></section></div></ha-card>`;
  }
}

class WsCoreStreaksCard extends WsCoreCard {
  withUnit(state, unit) { return state ? { ...state, attributes: { ...state.attributes, unit_of_measurement: unit } } : state; }
  render() {
    if (!this.shadowRoot) return;
    const rows = [['Dry streak', 'dry_streak', 'days'], ['Dry record', 'dry_streak_record', 'days'], ['Frost streak', 'frost_streak', 'days'], ['Frost record', 'frost_streak_record', 'days'], ['Heat streak', 'heat_streak', 'days'], ['Heat record', 'heat_streak_record', 'days']];
    this.shadowRoot.innerHTML = `<style>${WsCoreCard.styles()}</style><ha-card><div class="content"><div class="header"><div><h1>${this.config.title || 'Weather Streaks'}</h1><div class="condition">Current runs and records</div></div></div><div class="extremes">${rows.map(([label, key, unit]) => this.metric(label, this.withUnit(this.entity(key), unit), 0)).join('')}</div><div class="range">Last rain: <b>${this.entity('dry_streak')?.attributes?.last_rain_date || 'Unavailable'}</b></div></div></ha-card>`;
  }
}

const registerCard = (tag, klass) => { if (!customElements.get(tag)) customElements.define(tag, klass); };
registerCard('ws-core-card', WsCoreCard);
registerCard('ws-core-extremes-card', WsCoreExtremesCard);
registerCard('ws-core-climate-card', WsCoreClimateCard);
registerCard('ws-core-streaks-card', WsCoreStreaksCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'ws-core-card', name: 'Weather Station Core Card', description: `Interpreted heating, rain, and data-confidence overview (v${WS_CORE_CARD_VERSION}).` });
window.customCards.push({ type: 'ws-core-extremes-card', name: 'Weather Station Core Extremes', description: `Temperature and wind extremes (v${WS_CORE_CARD_VERSION}).` });
window.customCards.push({ type: 'ws-core-climate-card', name: 'Weather Station Core Climate', description: `30-day climate context and rainfall (v${WS_CORE_CARD_VERSION}).` });
window.customCards.push({ type: 'ws-core-streaks-card', name: 'Weather Station Core Streaks', description: `Dry, frost, and heat streaks (v${WS_CORE_CARD_VERSION}).` });
console.info(`[Weather Station Core Card] loaded v${WS_CORE_CARD_VERSION}`);
