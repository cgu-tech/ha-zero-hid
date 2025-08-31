import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';

console.info("Loading air-mouse-card");

export class AirMouseCard extends HTMLElement {

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

    this._logger = new Logger(this, "air-mouse-card.js");
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
    this.doRegisterGlobalEvents();
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this._eventManager.disconnectedCallback();
    this.doUnregisterGlobalEvents();
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  doRegisterGlobalEvents() {
    this._eventManager.addDeviceMotionListenerToContainer('air-mouse', window, this.onDeviceMotion.bind(this));
  }

  doUnregisterGlobalEvents() {
    this._eventManager.clearListeners('air-mouse');
  }

  getCursorSpeed() {
    return this._layoutManager.getFromConfigOrDefaultConfig("cursor_speed");
  }
  getDeadZone() {
    return this._layoutManager.getFromConfigOrDefaultConfig("dead_zone");
  }

  isMoveEnabled() {
    return this._eventManager.getUserPreferenceAirmouseMode() === "on";
  }
  setMoveEnabled(enable) {
    this._eventManager.setUserPreferenceAirmouseMode(enable ? "on" : "off");
  }

  // jobs
  doCheckConfig() {
    this._layoutManager.checkConfiguredLayout();
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = '';

    // Forcing inline styles into card to ensure this html element invisibility
    Object.assign(this._elements.card.style, {
      borderRadius: "0px",
      pointerEvents: "none",
      visibility: "hidden",
      opacity: "0",
      width: "0px",
      height: "0px",
      background: "transparent",
    });
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      .ha-card {
        border-radius: 0px !important;
        pointer-events: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        width: 0px !important;
        height: 0px !important;
        background: transparent !important;
      }
    `;
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    // Nothing to do here
  }

  doListen() {
    // Nothing to do here
  }

  doUpdateHass() {
    // Nothing to do here
  }

  doUpdateConfig() {
    // Nothing to do here
  }

  onDeviceMotion(evt) {
    // Do not compute if HASS object is unavailable or if move is disabled (to limit computationnal usage of this high-frequency event)
    if (this._hass && this.isMoveEnabled()) {

      // Gyroscope rotationRate (deg/s)
      const gx = evt.rotationRate.beta || 0;  // X-axis
      const gy = evt.rotationRate.alpha || 0; // Y-axis
      const gz = evt.rotationRate.gamma || 0; // Z-axis

      // Process gx, gy, gz
      const cursorSpeed = this.fromHumanToCursorSpeed(this.getCursorSpeed());
      const vx = -gz / cursorSpeed;
      const vy = -gy / cursorSpeed;

      // Filter micromovements
      const moveTrigger = this.getDeadZone();
      if (Math.abs(vx) > moveTrigger || Math.abs(vy) > moveTrigger) {

        // Get move deltas
        const dx = vx.toFixed(1);
        const dy = vy.toFixed(1);

        // Send mouse move to HID server
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`onDeviceMotion(evt)->sendMouseMove(dx, dy): ${dx},${dy}`));
        this.sendMouseMove(dx, dy);
      }
    }
  }

  // Scales the cursor speed from human (1 slowest, 10 fastest) to cursor (10 slowest, 2 fastest)
  fromHumanToCursorSpeed(speed) {
    return this.toCursorScale(10, 2, 1, 10, speed); // 10 + (2 - 10) * (humanSpeed - 1) / (10 - 1) === 10 + (humanSpeed - 1) * -8 / 9 
  }

  toTargetScale(targetSlowest, targetFastest, humanSlowest, humanFastest, humanValue) {
    return targetSlowest + (humanValue - humanSlowest) * (targetFastest - targetSlowest) / (humanFastest - humanSlowest);
  }

  // configuration defaults
  static getStubConfig() {
    return {
      layout: "buttons-left-middle-right",
      haptic: true,
      log_level: "warn",
      log_pushback: false,
      cursor_speed: 5, // From 1 (slowest) to 10 (fastest)
      dead_zone: 0.5 // Floating delta to filter micro movements
    };
  }

  getCardSize() {
    return 1;
  }

  sendMouseMove(dx, dy) {
    this.sendMouse("move", { "x": dx, "y": dy, });
  }

  sendMouse(serviceName, serviceArgs) {
    this._eventManager.callComponentServiceWithServerId(serviceName, serviceArgs);
  }
}

if (!customElements.get("air-mouse-card")) customElements.define("air-mouse-card", AirMouseCard);
