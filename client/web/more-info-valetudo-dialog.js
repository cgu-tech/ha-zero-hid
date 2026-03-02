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
  __initializing=false;
  __initialized=false;

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
    if (this._tryInitialize()) {
      this.doCheckConfig();
      this.doUpdateConfig();
    }
    this.setupIframe();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    if (this._tryInitialize()) {
      this.doUpdateHass();
    }
    this.setupIframe();
    this._eventManager.hassCallback();
  }
  
  setupIframe() {
    if (!this._hass) return;
    if (this._elements.card.iframeCard) return;

    // Load card helpers via Promise
    window.loadCardHelpers().then((helpers) => {
      if (this._elements.card.iframeCard) return;
    
      // Create the iframe card properly
      const iframeCard = helpers.createCardElement({
        type: 'iframe',
        url: 'https://192.168.0.60:8443',
        aspect_ratio: '50%',
      });
      iframeCard.hass = this._hass;

      this._elements.card.appendChild(iframeCard);
      this._elements.card.iframeCard = iframeCard;
    });
    
    //customElements.whenDefined('hui-iframe-card')
    //  .then(() => {
    //    if (this._elements.card.iframeCard) return;
    //    const iframeCard = document.createElement('hui-iframe-card');    
    //    iframeCard.setConfig({
    //      url: 'https://192.168.0.60:8443',
    //      aspect_ratio: '50%',
    //    });
    //    
    //    // set hass so it can render
    //    iframeCard.hass = this._hass;
    //    this._elements.card.appendChild(iframeCard);
    //  });
  }

  set entityId(entityId) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set entityId(entityId):", entityId));
    this._entityId = entityId;
    this.__initialized = false;
    this.__initializing = false;
    this.setConfig(this.createConfig());
  }

  _tryInitialize() {
    if (!this._hass || !this._entityId) return false;
    if (this.__initialized) return true;
    if (this.__initializing) return false;
    this.__initializing = true;

    this.doUpdateVacuumMapConfig();
    this.doUpdateVacuumMapHass();

    this.__initialized = true;
    this.__initializing = false;
    return false;
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

  createConfig() {
    const config = {};

    // Copy default config values
    for (const [key, value] of Object.entries(this._layoutManager.getStubConfig() ?? {})) {
      config[key] = value;
    }

    // Override config with initialization config
    config["entityId"] = this._entityId ?? config["entityId"];

    // Override config with user defined config
    for (const [key, value] of Object.entries(this._config ?? {})) {
      config[key] = value;
    }
    return config;
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
        <div class="content">
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
    //this._elements.iframeCard = card.querySelector("hui-iframe-card");
    //this._elements.title = card.querySelector(".title");
    this._elements.content = card.querySelector(".content");
    //this._elements.vacuumMap = card.querySelector("valetudo-map-card");
  }

  doListen() {
    // Nothing to do here: events are listened per sub-element
  }

  doUpdateConfig() {
    // Update valetudo cards configs
    this.doUpdateVacuumMapConfig();
  }

  doUpdateHass() {
    // Update valetudo cards HASS object
    this.doUpdateVacuumMapHass();
  }

  doUpdateVacuumMapConfig() {
  }

  doUpdateVacuumMapHass() {
  }

  static getStubConfig() {
      return {
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

  getCardSize() {
    return 2;
  }
}

// Ensure your dialog class is defined
if (!customElements.get("more-info-valetudo-dialog")) customElements.define("more-info-valetudo-dialog", MoreInfoValetudoDialog);

// Patch HA's ha-more-info-info safely
customElements.whenDefined("ha-more-info-info").then(() => {
  const HaMoreInfoInfo = customElements.get("ha-more-info-info");
  if (!HaMoreInfoInfo) return;

  if (HaMoreInfoInfo.prototype.__valetudo_patched) return;
  HaMoreInfoInfo.prototype.__valetudo_patched = true;

  const originalRender = HaMoreInfoInfo.prototype.render;

  HaMoreInfoInfo.prototype.render = function () {
    try {
      const entityId = this.entityId;
      const integration = this.hass?.states?.[entityId]?.attributes?.integration;

      console.debug("[Valetudo] ha-more-info-info patch", { entityId, integration });

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
      console.error("[Valetudo] ha-more-info-info patch error", e);
    }

    return originalRender?.call(this);
  };
});

//import { Globals } from './utils/globals.js';
//import { Logger } from './utils/logger.js';
//import { EventManager } from './utils/event-manager.js';
//import { ResourceManager } from './utils/resource-manager.js';
//import { LayoutManager } from './utils/layout-manager.js';
//import { ValetudoMapCard } from './libs/valetudo-map-card.js';
//
//console.info("Loading more-info-valetudo-dialog");
//
//class MoreInfoValetudoDialog extends HTMLElement {
//
//  // private properties
//  _config;
//  _hass;
//  _elements = {};
//  _logger;
//  _eventManager;
//  _layoutManager;
//  _resourceManager;
//
//  _entityId;
//  __initializing=false;
//  __initialized=false;
//
//  constructor() {
//    super();
//
//    this._logger = new Logger(this, "more-info-valetudo-dialog.js");
//    this._eventManager = new EventManager(this);
//    this._layoutManager = new LayoutManager(this, {});
//    this._resourceManager = new ResourceManager(this, import.meta.url);
//
//    this.doCard();
//    this.doStyle();
//    this.doAttach();
//    this.doQueryElements();
//    this.doListen();
//  }
//
//  getLogger() {
//    return this._logger;
//  }
//
//  setManaged(managed) {
//    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setManaged(managed):", managed));
//    this._eventManager.setManaged(managed);
//  }
//
//  setUserPreferences(preferences) {
//    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setUserPreferences(preferences):", preferences));
//    this._eventManager.setUserPreferences(preferences);
//  }
//
//  setConfig(config) {
//    this._config = config;
//    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set setConfig(config):", config));
//    if (this.getLogger().isDebugEnabled()) this.getLogger().doLogOnError(this.doSetConfig.bind(this)); else this.doSetConfig();
//  }
//  doSetConfig() {
//    if (this._tryInitialize()) {
//      this.doCheckConfig();
//      this.doUpdateConfig();
//    }
//  }
//
//  set hass(hass) {
//    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
//    this._hass = hass;
//    if (this._tryInitialize()) {
//      this.doUpdateHass();
//    }
//    this._eventManager.hassCallback();
//  }
//
//  set entityId(entityId) {
//    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set entityId(entityId):", entityId));
//    this._entityId = entityId;
//    this.__initialized = false;
//    this.__initializing = false;
//    this.setConfig(this.createConfig());
//  }
//
//  _tryInitialize() {
//    if (!this._hass || !this._entityId) return false;
//    if (this.__initialized) return true;
//    if (this.__initializing) return false;
//    this.__initializing = true;
//
//    this.doUpdateVacuumMapConfig();
//    this.doUpdateVacuumMapHass();
//
//    this.__initialized = true;
//    this.__initializing = false;
//    return false;
//  }
//
//  connectedCallback() {
//    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("connectedCallback()"));
//    this._eventManager.connectedCallback();
//  }
//
//  disconnectedCallback() {
//    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
//    this._eventManager.disconnectedCallback();
//  }
//
//  adoptedCallback() {
//    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
//  }
//
//  createConfig() {
//    const config = {};
//
//    // Copy default config values
//    for (const [key, value] of Object.entries(this._layoutManager.getStubConfig() ?? {})) {
//      config[key] = value;
//    }
//
//    // Override config with initialization config
//    config["entityId"] = this._entityId ?? config["entityId"];
//
//    // Override config with user defined config
//    for (const [key, value] of Object.entries(this._config ?? {})) {
//      config[key] = value;
//    }
//    return config;
//  }
//
//  getEntityIdConfig() {
//    return this._layoutManager.getFromConfigOrDefaultConfig("entityId");
//  }
//
//  getVacuumMap() {
//    return this._elements.vacuumMap;
//  }
//
//  getVacuumMapConfig() {
//    return this._layoutManager.getTargetConfig(this.getVacuumMap());
//  }
//
//  // jobs
//  doCheckConfig() {
//    this._layoutManager.checkConfiguredLayout();
//  }
//
//  doCard() {
//    this._elements.card = document.createElement("ha-card");
//    this._elements.card.innerHTML = `
//      <div id="dialog-container">
//        <div class="header">
//          <span class="title"></span>
//        </div>
//        <div class="content">
//          <valetudo-map-card></valetudo-map-card>
//        </div>
//      </div>
//    `;
//  }
//
//  doStyle() {
//    this._elements.style = document.createElement("style");
//    this._elements.style.textContent = `
//      :host {
//        --card-border-radius: 10px;
//        --base-font-size: 1rem; /* base scaling unit */
//        display: block;
//        box-sizing: border-box;
//        max-width: 100%;
//        background: var(--card-background-color);
//        border-radius: var(--card-border-radius);
//        overflow: hidden; /* prevent overflow outside card */
//        font-family: Roboto, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//        font-size: var(--base-font-size);
//        height: 100%;
//      }
//
//      #dialog-container {
//        box-sizing: border-box;
//      }
//
//      .header {
//        font-size: 1.2em;
//        font-weight: 500;
//      }
//
//      .content {
//        width: 100%;
//        height: 100%;
//      }
//    `;
//  }
//
//  doAttach() {
//    this.attachShadow({ mode: 'open' });
//    this.shadowRoot.append(this._elements.style, this._elements.card);
//  }
//
//  doQueryElements() {
//    const card = this._elements.card;
//    this._elements.title = card.querySelector(".title");
//    this._elements.content = card.querySelector(".content");
//    this._elements.vacuumMap = card.querySelector("valetudo-map-card");
//  }
//
//  doListen() {
//    // Nothing to do here: events are listened per sub-element
//  }
//
//  doUpdateConfig() {
//    // Update valetudo cards configs
//    this.doUpdateVacuumMapConfig();
//  }
//
//  doUpdateHass() {
//    // Update valetudo cards HASS object
//    this.doUpdateVacuumMapHass();
//  }
//
//  doUpdateVacuumMapConfig() {
//    // Create valetudo map card config from specified config entityId
//    const entityId = this.getEntityIdConfig();
//    
//    const vacuum_robot = entityId?.split('.')?.[1] ?? entityId ?? '';
//    
//    // HA default referencable entity is the vacuum entity created by valetudo MQTT, 
//    // which by default ends with "_robot" suffix: since we need the valid entity configured by user
//    // the only option is to remove this suffix
//    const vacuum = vacuum_robot.endsWith('_robot') ? vacuum_robot.slice(0, -6) : vacuum_robot;
//    
//    const vacuumMapConfig = {
//        "title": this._layoutManager.getFromConfigOrDefaultConfig("title"),
//        "vacuum": vacuum,
//        "show_path": this._layoutManager.getFromConfigOrDefaultConfig("show_path"),
//        "show_status": this._layoutManager.getFromConfigOrDefaultConfig("show_status"),
//        "show_start_button": this._layoutManager.getFromConfigOrDefaultConfig("show_start_button"),
//        "show_pause_button": this._layoutManager.getFromConfigOrDefaultConfig("show_pause_button"),
//        "show_stop_button": this._layoutManager.getFromConfigOrDefaultConfig("show_stop_button"),
//        "show_home_button": this._layoutManager.getFromConfigOrDefaultConfig("show_home_button"),
//        "show_locate_button": this._layoutManager.getFromConfigOrDefaultConfig("show_locate_button")
//    };
//
//    // Set valetudo map card config
//    this.getVacuumMap().setConfig(vacuumMapConfig);
//  }
//
//  doUpdateVacuumMapHass() {
//    // Ensure valid valetudo map card config
//    if (!this.getVacuumMapConfig()) this.doUpdateVacuumMapConfig();
//
//    // Set valetudo map card HASS object
//    this.getVacuumMap().hass = this._hass;
//  }
//
//  static getStubConfig() {
//      return {
//          haptic: false,
//          log_level: "warn",
//          log_pushback: false,
//          entityId: "vacuum.valetudo_REPLACEME",
//          title: "",
//          show_path: true,
//          show_status: false,
//          show_start_button: false,
//          show_pause_button: false,
//          show_stop_button: false,
//          show_home_button: false,
//          show_locate_button: false
//      }
//  }
//
//  getCardSize() {
//    return 2;
//  }
//}
//
//// Ensure your dialog class is defined
//if (!customElements.get("more-info-valetudo-dialog")) customElements.define("more-info-valetudo-dialog", MoreInfoValetudoDialog);
//
//function isInsideMoreInfoDialog(el) {
//  let node = el;
//
//  while (node) {
//    if (node.tagName === "HA-MORE-INFO-DIALOG") {
//      return true;
//    }
//
//    const root = node.getRootNode();
//    node = root && root.host;
//  }
//
//  return false;
//}
//
//// Patch HA more-info-content LitElement render
//customElements.whenDefined("state-card-content").then(() => {
//  const StateCardContent = customElements.get("state-card-content");
//  if (!StateCardContent) return;
//
//  if (StateCardContent.prototype.__valetudo_render_patched) return;
//  StateCardContent.prototype.__valetudo_render_patched = true;
//
//  const originalRender = StateCardContent.prototype.render;
//
//  StateCardContent.prototype.render = function () {
//    try {
//      if (!isInsideMoreInfoDialog(this)) {
//        return originalRender?.call(this);
//      }
//        
//      // <-- use stateObj.entity_id instead of entityId
//      const entityId = this.stateObj?.entity_id;
//      const integration = this.stateObj?.attributes?.integration;
//
//      //if (entityId && entityId.startsWith("vacuum.") && integration === "valetudo") {
//      if (entityId && entityId.startsWith("vacuum.")) {
//        return this.html`
//          <more-info-valetudo-dialog
//            .hass=${this.hass}
//            .entityId=${entityId}>
//          </more-info-valetudo-dialog>
//        `;
//      }
//    } catch (e) {
//      console.error("[Valetudo] patch error", e);
//    }
//
//    return originalRender?.call(this);
//  };
//});
