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

  setConfig(config) {
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
        <div class="header">
          <span class="title"></span>
        </div>
        <div class="content">
          <valetudo-map-card></valetudo-map-card>
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

      #dialog-container {
        box-sizing: border-box;
      }

      .header {
        font-size: 1.2em;
        font-weight: 500;
      }

      .content {
        width: 100%;
        height: 100%;
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
    this._elements.vacuumMap = card.querySelector("valetudo-map-card");
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
              haptic: false,
              log_level: "warn",
              log_pushback: false,
              entityId: "vacuum.valetudo_REPLACEME",
              title: "",
              show_path: true,
              show_status: false,
              show_start_button: false,
              show_pause_button: false,
              show_stop_button: false,
              show_home_button: false,
              show_locate_button: false
          }
      }
  }

  getCardSize() {
    return 4;
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

      console.debug("[Valetudo] ha-more-info-info patch", { entityId, config });

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