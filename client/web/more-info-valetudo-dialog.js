import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';
import { ValetudoMapCard } from './libs/valetudo-map-card.js';

console.info("Loading more-info-valetudo-dialog");

class MoreInfoValetudoDialog extends HTMLElement {

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;

  _entityId;

  constructor() {
    super();

    this._logger = new Logger(this, "more-info-valetudo-dialog.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, {});
    this._resourceManager = new ResourceManager(this, import.meta.url);

    this.doCard();
    this.doStyle();
    this.doAttach();
    this.doQueryElements();
    this.doListen();
  }

  getLogger() {
    return this._logger;
  }

  setManaged(managed) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setManaged(managed):", managed));
    this._eventManager.setManaged(managed);
  }

  setUserPreferences(preferences) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setUserPreferences(preferences):", preferences));
    this._eventManager.setUserPreferences(preferences);
  }

  // Injectable property
  set config(config) {
    this.setConfig(config);
  }

  setConfig(config) {
    if (this.deepEqual(this._config, config)) return; // debounce same config
    this._config = config;
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set setConfig(config):", config));
    if (this.getLogger().isDebugEnabled()) this.getLogger().doLogOnError(this.doSetConfig.bind(this)); else this.doSetConfig();
  }
  doSetConfig() {
    this.doCheckConfig();
    this.doUpdateConfig();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass();
    this._eventManager.hassCallback();
  }

  set entityId(entityId) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set entityId(entityId):", entityId));
    this._entityId = entityId;
  }

  connectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("connectedCallback()"));
    this._eventManager.connectedCallback();
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this._eventManager.disconnectedCallback();
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  getVacuumMapConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("vacuum_map");
  }

  getVacuumMap() {
    return this._elements.vacuumMap;
  }

  // jobs
  doCheckConfig() {
    this._layoutManager.checkConfiguredLayout();
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div id="dialog-container">
        <div class="content">
          <xiaomi-vacuum-map-card></xiaomi-vacuum-map-card>
        </div>
      </div>
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      :host {
        --card-border-radius: 10px;
        --base-font-size: 1rem; /* base scaling unit */
        --ha-card-border-width: 0px;
        display: block;
        box-sizing: border-box;
        max-width: 100%;
        background: var(--card-background-color);
        border-radius: var(--card-border-radius);
        overflow: hidden; /* prevent overflow outside card */
        font-family: Roboto, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: var(--base-font-size);
        height: 100%;
      }

      .body {
        height: 100%;
        min-height: 0;
      }

      #dialog-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }

      .header {
        font-size: 1.2em;
        font-weight: 500;
        flex: 0 0 auto;
      }

      .content {
        flex: 1 1 auto;
        overflow-y: auto;
        min-height: 0; /* critical for flexbox scrolling */
      }
    `;
  }

  doAttach() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.title = card.querySelector(".title");
    this._elements.content = card.querySelector(".content");
    this._elements.vacuumMap = card.querySelector("xiaomi-vacuum-map-card");
  }

  doListen() {
    // Nothing to do here: events are listened per sub-element
  }

  doUpdateHass() {
    // Set valetudo map card HASS object
    this.getVacuumMap().hass = this._hass;
  }

  doUpdateConfig() {
    // Update valetudo cards configs
    const vacuumMapConfig = this.getVacuumMapConfig();
    this.getVacuumMap().setConfig(vacuumMapConfig);
  }

  static getStubConfig() {
      return {
          vacuum_map: {
          }
      }
  }

  getCardSize() {
    return 4;
  }
  
  deepEqual(a, b) {
    // Same reference or primitive equality
    if (a === b) return true;
  
    // Handle null / non-objects
    if (typeof a !== "object" || a === null ||
        typeof b !== "object" || b === null) {
      return false;
    }
  
    // Arrays check
    if (Array.isArray(a) !== Array.isArray(b)) return false;
  
    // Keys length
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
  
    if (keysA.length !== keysB.length) return false;
  
    // Check every key
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) {
        return false;
      }
  
      if (!this.deepEqual(a[key], b[key])) {
        return false;
      }
    }
  
    return true;
  }
}

// Ensure your dialog class is defined
if (!customElements.get("more-info-valetudo-dialog")) customElements.define("more-info-valetudo-dialog", MoreInfoValetudoDialog);

// Patch HA's ha-more-info-info safely
customElements.whenDefined("ha-more-info-info").then(() => {
  const moreInfoDialog = customElements.get("ha-more-info-info");
  if (!moreInfoDialog) return;

  if (moreInfoDialog.prototype[Globals.COMPONENT_PATCH_KEY]) return;
  moreInfoDialog.prototype[Globals.COMPONENT_PATCH_KEY] = true;

  const originalRender = moreInfoDialog.prototype.render;

  moreInfoDialog.prototype.render = function () {
    try {
      const entityId = this.entityId;
      const vacuumMapConfig = Globals.getSideLoadedPayload(this.hass, "more-info-config");
      const moreInfoConfig = { vacuum_map: vacuumMapConfig };

      console.debug("[Valetudo] ha-more-info-info patch", { entityId, moreInfoConfig });

      //if (entityId && entityId.startsWith("vacuum.") && integration === "valetudo") {
      if (entityId && entityId.startsWith("vacuum.")) {
        return this.html`
          <more-info-valetudo-dialog
            .config=${moreInfoConfig}
            .hass=${this.hass}
            .entityId=${entityId}>
          </more-info-valetudo-dialog>
        `;
      }
    } catch (e) {
      console.error("[Valetudo] ha-more-info-info patch error", e);
    }

    return originalRender?.call(this);
  };
});