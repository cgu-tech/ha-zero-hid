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

  getEntityIdConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("entityId");
  }

  getVacuumMap() {
    return this._elements.vacuumMap;
  }

  getVacuumMapConfig() {
    return this._layoutManager.getTargetConfig(this.getVacuumMap());
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
        padding: 16px;
        box-sizing: border-box;
      }

      .header {
        font-size: 1.2em;
        font-weight: 500;
        margin-bottom: 16px;
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

  doUpdateConfig() {
    // Update valetudo cards configs

    // Create valetudo map card config from specified config entityId
    const entityId = this.getEntityIdConfig();
    const vacuum = entityId?.split('.')?.[1] ?? entityId;
    const vacuumMapConfig = { "vacuum": vacuum };
    
    // Set valetudo map card config
    this.getVacuumMap().setConfig(vacuumMapConfig);
  }

  doUpdateHass() {
    // Update valetudo cards HASS object

    // Ensure valid valetudo map card config
    if (!this.getVacuumMapConfig()) this.doUpdateConfig();

    // Set valetudo map card HASS object
    this.getVacuumMap().hass = this._hass;
  }

  static getStubConfig() {
      return {
          entityId: "vacuum.valetudo_REPLACEME"
      }
  }

  getCardSize() {
    return 4;
  }
}

// Ensure your dialog class is defined
if (!customElements.get("more-info-valetudo-dialog")) customElements.define("more-info-valetudo-dialog", MoreInfoValetudoDialog);

// Patch HA's more-info-content safely

// Patch HA more-info-content LitElement render
customElements.whenDefined("more-info-content").then(() => {
  const MoreInfoContent = customElements.get("more-info-content");
  if (!MoreInfoContent) return;

  if (MoreInfoContent.prototype.__valetudo_render_patched) return;
  MoreInfoContent.prototype.__valetudo_render_patched = true;

  const originalRender = MoreInfoContent.prototype.render;

  MoreInfoContent.prototype.render = function () {
    try {
      // <-- use stateObj.entity_id instead of entityId
      const entityId = this.stateObj?.entity_id;
      const integration = this.stateObj?.attributes?.integration;

      console.debug("[Valetudo] more-info-content render patch", { entityId, integration });

      //if (entityId && entityId.startsWith("vacuum.") && integration === "valetudo") {
      if (entityId && entityId.startsWith("vacuum.")) {
        return this.html`
          <more-info-valetudo-dialog
            .hass=${this.hass}
            .entityId=${entityId}>
          </more-info-valetudo-dialog>
        `;
      }
    } catch (e) {
      console.error("[Valetudo] patch error", e);
    }

    return originalRender?.call(this);
  };
});

// customElements.whenDefined("more-info-content").then(() => {
//   const MoreInfoContent = customElements.get("more-info-content");
//   console.log("customElements.whenDefined(\"more-info-content\"): MoreInfoContent.prototype.__valetudo_patched=",MoreInfoContent.prototype.__valetudo_patched);
// 
//   // Idempotent patch: avoid double override
//   if (MoreInfoContent.prototype.__valetudo_patched) return;
//   MoreInfoContent.prototype.__valetudo_patched = true;
// 
//   const originalRender = MoreInfoContent.prototype.render;
// 
//   MoreInfoContent.prototype.render = function () {
//     const entityId = this.entityId;
//     console.log("MoreInfoContent.prototype.render entityId=",entityId);
// 
//     // Only override content for Valetudo vacuums
//     if (
//       entityId &&
//       entityId.startsWith("vacuum.")
//     ) {
//     //if (
//     //  entityId &&
//     //  entityId.startsWith("vacuum.") &&
//     //  this.hass?.states[entityId]?.attributes?.integration === "valetudo"
//     //) {
//       // Use HA built-in html template helper
//       console.log("invoking more-info-valetudo-dialog render");
//       return this.html`
//         <more-info-valetudo-dialog
//           .hass=${this.hass}
//           .entityId=${entityId}>
//         </more-info-valetudo-dialog>
//       `;
//     }
// 
//     // Default HA rendering for all other entities
//     console.log("invoking original render");
//     return originalRender.call(this);
//   };
// });