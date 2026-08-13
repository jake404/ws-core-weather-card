const WS_CORE_CARD_VERSION = '0.5.1';

class WsCoreCard extends HTMLElement {
  setConfig(config) {
    if (!config || config.type !== 'custom:ws-core-card' || !config.entity) throw new Error('Choose an insight sensor entity');
    this.config = config;
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  set hass(hass) { this._hass = hass; if (this.config) this.render(); }
  getCardSize() { return 2; }
  getGridOptions() { return { auto_height: true, columns: 6, min_columns: 3, max_columns: 12 }; }

  static getConfigElement() { return document.createElement('ws-core-card-editor-v2'); }
  static getStubConfig() { return { type: 'custom:ws-core-card', entity: 'sensor.weather_station_core_rain_outlook' }; }
  esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

  render() {
    if (!this.shadowRoot) return;
    const state = this._hass?.states?.[this.config.entity];
    const attributes = state?.attributes || {};
    const unavailable = !state || ['unknown', 'unavailable'].includes(state.state);
    const severity = String(attributes.severity || attributes.status || (unavailable ? 'unavailable' : 'normal')).toLowerCase();
    const title = this.config.title || attributes.friendly_name || this.config.entity;
    const explanation = attributes.explanation || attributes.context || attributes.description || '';
    const confidence = attributes.confidence ?? attributes.data_confidence;
    const icon = attributes.icon || '';
    this.shadowRoot.innerHTML = `<style>${WsCoreCard.styles()}</style><ha-card class="${this.esc(severity)}"><div class="content">
      <div class="label">${icon.startsWith('mdi:') ? `<ha-icon class="icon" icon="${this.esc(icon)}"></ha-icon>` : icon ? `<span class="icon">${this.esc(icon)}</span>` : ''}${this.esc(title)}</div>
      <div class="state">${this.esc(unavailable ? 'Unavailable' : state.state)}</div>
      ${explanation ? `<div class="explanation">${this.esc(explanation)}</div>` : ''}
      ${confidence !== undefined && confidence !== null && !this.config.entity.includes('data_confidence') && !this.config.entity.includes('forecast_quality') ? `<div class="confidence">Confidence ${this.esc(confidence)}${String(confidence).includes('%') ? '' : '%'}</div>` : ''}
    </div></ha-card>`;
    this.shadowRoot.querySelector('ha-card').addEventListener('click', () => this.handleTap());
  }

  handleTap() {
    const action = this.config.tap_action || { action: 'more-info' };
    if (action.action === 'none') return;
    if (action.action === 'url' && action.url_path) { window.open(action.url_path, '_blank', 'noopener'); return; }
    if (action.action === 'navigate' && action.navigation_path) { window.history.pushState({}, '', action.navigation_path); window.dispatchEvent(new Event('location-changed')); return; }
    this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: this.config.entity } }));
  }

  static styles() { return `:host{display:block}ha-card{overflow:hidden;border-left:4px solid var(--primary-color);cursor:pointer}.content{padding:14px 16px}.label{font-size:.75rem;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center}.icon{margin-right:6px;--mdc-icon-size:18px}.state{font-size:1.15rem;font-weight:600;margin-top:5px}.explanation{font-size:.84rem;color:var(--secondary-text-color);margin-top:5px}.confidence{font-size:.72rem;color:var(--secondary-text-color);margin-top:10px}.rain,.warning,.alert,.high,.critical{border-left-color:#f59e0b}.rain{border-left-color:#60a5fa}.good,.normal,.clear,.low{border-left-color:#34d399}.limited,.medium{border-left-color:#fbbf24}.unavailable{border-left-color:var(--disabled-text-color)}@media (max-width:500px){.content{padding:12px}}`; }
}

class WsCoreCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { type: 'custom:ws-core-card', ...config };
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    if (!this._form) this.render();
    else this.updateFormData();
  }

  render() {
    this.shadowRoot.innerHTML = `<ha-form></ha-form>`;
    this._form = this.shadowRoot.querySelector('ha-form');
    this._form.schema = [
      { name: 'Entity', required: true, selector: { entity: { domain: 'sensor' } } },
      { name: 'Title', selector: { text: {} } },
      { name: 'Tap action', selector: { ui_action: {} } },
    ];
    this._form.addEventListener('value-changed', event => {
      const value = event.detail.value || {};
      this._config = { ...this._config, entity: value.Entity ?? this._config.entity, title: value.Title ?? this._config.title, tap_action: value['Tap action'] ?? this._config.tap_action };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });
    this.updateFormData();
  }

  updateFormData() {
    if (!this._form) return;
    this._form.hass = this._hass;
    const formData = { Entity: this._config.entity || '', Title: this._config.title || '', 'Tap action': this._config.tap_action || { action: 'more-info' } };
    const serialized = JSON.stringify(formData);
    if (serialized !== this._lastConfig) {
      this._form.data = formData;
      this._lastConfig = serialized;
    }
  }

  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; }
}

const existingCard = customElements.get('ws-core-card');
if (!existingCard) customElements.define('ws-core-card', WsCoreCard);
else {
  existingCard.getConfigElement = WsCoreCard.getConfigElement;
  existingCard.getStubConfig = WsCoreCard.getStubConfig;
  for (const name of Object.getOwnPropertyNames(WsCoreCard.prototype)) if (name !== 'constructor') Object.defineProperty(existingCard.prototype, name, Object.getOwnPropertyDescriptor(WsCoreCard.prototype, name));
  document.querySelectorAll('ws-core-card').forEach(card => card.render?.());
}
if (!customElements.get('ws-core-card-editor-v2')) customElements.define('ws-core-card-editor-v2', WsCoreCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'ws-core-card', name: 'Weather Station Insight Card', description: `Generic MQTT insight sensor card (v${WS_CORE_CARD_VERSION}).` });
console.info(`[Weather Station Core Card] loaded v${WS_CORE_CARD_VERSION}`);
