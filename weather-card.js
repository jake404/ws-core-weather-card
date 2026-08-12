class WsCoreCard extends HTMLElement {
  setConfig(config) {
    if (!config || config.type !== 'custom:ws-core-card') {
      throw new Error('Set a type of custom:ws-core-card');
    }
    this.config = config;
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.config) this.render();
  }

  getCardSize() { return 5; }

  entity(suffix) {
    const defaults = {
      hdd_base: 'number.weather_station_core_hdd_base',
    };
    const id = this.config?.entities?.[suffix] || defaults[suffix] || `${this.config?.ws_core_prefix || 'sensor.weather_station_core_'}${suffix}`;
    return this._hass?.states?.[id];
  }

  weather() {
    const id = this.config?.weather_entity || 'weather.weather_station_core';
    return this._hass?.states?.[id];
  }

  value(state, fallback = '—') {
    return state && state.state !== 'unknown' && state.state !== 'unavailable' ? state.state : fallback;
  }

  attr(state, name, fallback = '—') {
    const value = state?.attributes?.[name];
    return value === undefined || value === null || value === '' ? fallback : value;
  }

  unit(state) { return state?.attributes?.unit_of_measurement || ''; }

  display(state, decimals = 1) {
    const value = this.value(state);
    if (value === '—') return value;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(decimals).replace(/\.0$/, '') : value;
  }

  unavailable(state) { return !state || state.state === 'unknown' || state.state === 'unavailable'; }

  metric(label, state, decimals = 1) {
    const unavailable = this.unavailable(state);
    return `<div class="metric ${unavailable ? 'unavailable' : ''}"><span>${label}</span><strong>${unavailable ? 'Unavailable' : `${this.display(state, decimals)} ${this.unit(state)}`}</strong></div>`;
  }

  render() {
    if (!this.shadowRoot) return;
    const weather = this.weather();
    const temp = this.entity('temperature');
    const feels = this.entity('feels_like');
    const humidity = this.entity('humidity');
    const dew = this.entity('dew_point');
    const hdd = this.entity('heating_degree_day');
    const hddSeason = this.entity('heating_degree_days_season');
    const anomaly = this.entity('temperature_anomaly_30_day');
    const avg = this.entity('temperature_average_24h');
    const low = this.entity('temperature_low_24h');
    const high = this.entity('temperature_high_24h');
    const nowcast = this.entity('nowcast_intensity');
    const confidence = this.entity('nowcast_confidence');
    const rain = this.entity('rain_next_60_min');
    const alert = this.entity('alert_state');
    const quality = this.entity('data_quality_score');
    const tiles = this.entity('forecast_tiles');
    const forecast = Array.isArray(tiles?.attributes?.tiles) ? tiles.attributes.tiles : [];
    const condition = weather ? this.value(weather, 'Unavailable') : this.value(this.entity('current_condition'), 'Unavailable');
    const conditionLabel = weather?.attributes?.temperature !== undefined ? `${condition} · ${weather.attributes.temperature} ${weather.attributes.temperature_unit || ''}` : condition;
    const rainIntensity = this.value(nowcast, 'Unavailable');
    const alertState = this.value(alert, 'Unavailable');

    this.shadowRoot.innerHTML = `<style>${WsCoreCard.styles()}</style>
      <ha-card><div class="content">
        <div class="header"><div><h1>${this.config.title || 'Home Weather'}</h1><div class="condition">${conditionLabel}</div></div><div class="status ${alertState === 'clear' ? 'ok' : 'warn'}">${alertState}</div></div>
        <div class="grid">${this.metric('Temperature', temp)}${this.metric('Feels like', feels)}${this.metric('Humidity', humidity, 0)}${this.metric('Dew point', dew)}</div>
        <section><h2>Heating outlook</h2><div class="grid">${this.metric('Today', hdd, 2)}${this.metric('Season', hddSeason, 1)}${this.metric('30-day anomaly', anomaly)}${this.metric('24h average', avg)}</div><div class="range">24h range: <b>${this.display(low)} ${this.unit(low)}</b> – <b>${this.display(high)} ${this.unit(high)}</b>${this.entity('hdd_base') ? ` · Base ${this.display(this.entity('hdd_base'))} ${this.unit(this.entity('hdd_base'))}` : ''}</div></section>
        <section><h2>Forecast</h2><div class="forecast">${forecast.length ? forecast.map(tile => `<div class="tile"><span>${tile.label || ''}</span><strong>${tile.tmin ?? '—'}° – ${tile.tmax ?? '—'}°</strong><small>${tile.precip_prob ?? '—'}% rain</small></div>`).join('') : '<div class="empty">Unavailable</div>'}</div></section>
        <section><h2>Rain nowcast</h2><div class="nowcast"><div><strong>${rainIntensity}</strong><span>intensity</span></div><div><strong>${this.value(confidence, 'Unavailable')}</strong><span>confidence</span></div><div><strong>${this.unavailable(rain) ? 'Unavailable' : `${this.display(rain)} ${this.unit(rain)}`}</strong><span>next 60 min</span></div></div></section>
        <div class="footer"><span>Data quality: ${this.unavailable(quality) ? 'Unavailable' : `${this.display(quality, 0)}%`}</span><span class="source">${this.attr(weather, 'attribution', 'Weather Station Core')}</span></div>
      </div></ha-card>`;
  }

  static styles() { return `:host{display:block}ha-card{overflow:hidden}.content{padding:16px;color:var(--primary-text-color)}.header{display:flex;justify-content:space-between;align-items:start;margin-bottom:14px}h1{font-size:1.25rem;margin:0 0 4px}.condition{color:var(--secondary-text-color);text-transform:capitalize}.status{padding:4px 8px;border-radius:999px;font-size:.75rem;text-transform:capitalize}.status.ok{background:rgba(74,222,128,.16);color:#4ade80}.status.warn{background:rgba(251,191,36,.16);color:#fbbf24}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.metric{background:var(--secondary-background-color);border-radius:10px;padding:10px;min-width:0}.metric span,.metric strong{display:block}.metric span{font-size:.75rem;color:var(--secondary-text-color)}.metric strong{font-size:1rem;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.unavailable strong{color:var(--disabled-text-color);font-size:.78rem}section{border-top:1px solid var(--divider-color);margin-top:16px;padding-top:12px}h2{font-size:.9rem;margin:0 0 9px}.range{font-size:.78rem;color:var(--secondary-text-color);margin-top:9px}.forecast{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.tile{background:var(--secondary-background-color);padding:8px 6px;border-radius:8px;text-align:center}.tile span,.tile strong,.tile small{display:block}.tile span{font-size:.7rem;color:var(--secondary-text-color)}.tile strong{font-size:.82rem;margin:5px 0}.tile small{font-size:.68rem}.empty{color:var(--disabled-text-color)}.nowcast{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.nowcast div{display:flex;flex-direction:column}.nowcast strong{font-size:1rem;text-transform:capitalize}.nowcast span{font-size:.72rem;color:var(--secondary-text-color)}.footer{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--divider-color);margin-top:16px;padding-top:10px;font-size:.72rem;color:var(--secondary-text-color)}.source{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:500px){.grid{grid-template-columns:repeat(2,1fr)}.forecast{grid-template-columns:repeat(3,1fr)}.tile:nth-child(n+4){display:none}}`; }
}

customElements.define('ws-core-card', WsCoreCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'ws-core-card', name: 'Weather Station Core Card', description: 'Heating-focused weather overview for Weather Station Core.' });
