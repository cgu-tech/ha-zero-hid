import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';

console.info("Loading test-card");

export class TestCard extends HTMLElement {

  // private constants
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();
  _allowedCellData = new Set(['code', 'special', 'popinConfig', 'label', 'fallback']);

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

    this._logger = new Logger(this, "test-card.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, null);
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

  setServers(servers) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setServers(servers):", servers));
    this._eventManager.setServers(servers);
  }

  setCurrentServer(server) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setCurrentServer(server):", server));
    this._eventManager.setCurrentServer(server);
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
    this._deviceOrientationListener = this._eventManager.addDeviceOrientationListenerToContainer('test-orientation', window, this.onDeviceOrientation.bind(this));
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this._eventManager.disconnectedCallback();
    this._eventManager.removeListener(this._deviceOrientationListener);
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  // jobs
  doCheckConfig() {
    // Do your checks here
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div id="cursor"></div>
      <div class="container">
        <div class="test-button">
          <div class="test-button-label">Test</div>
        </div>
      </div>
      <div class="popin" hidden>Hello from popin!</div> 
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      body {
        margin: 0;
        overflow: hidden;
        background: #111;
      }

      .container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 200px;
        height: 200px;
        background: #3a3a3a;
      }

      .test-button {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100px;
        height: 40px;
        background: #555;
        transition: background 0.3s ease, transform 0.1s ease;
      }

      .test-button.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background: #888;
      }

      .test-button.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background: #BBB;
        transform: scale(0.95);
      }

      .test-button-label {
        text-align: center;
        color: white;
      }
      
      .popin {
        position: fixed;
        transform: translate(-50%, -50%);
        background: white;
        color: black;
        padding: 10px;
        border: 1px solid #ccc;
        z-index: 9999;
      }

      #cursor {
        position: fixed;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        background: red;
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
      }
    `;
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.container = card.querySelector(".container");
    this._elements.testButton = card.querySelector(".test-button");
    this._elements.popin = card.querySelector(".popin");
    this._elements.cursor = card.querySelector('#cursor');
  }

  doListen() {
    this._eventManager.addButtonListeners("buttons", this._elements.testButton, 
      {
        [this._eventManager.constructor._BUTTON_CALLBACK_HOVER]: this.onTestButtonHover.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_ABORT_HOVER]: this.onTestButtonAbortHover.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_PRESS]: this.onTestButtonPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_ABORT_PRESS]: this.onTestButtonAbortPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_RELEASE]: this.onTestButtonRelease.bind(this)
      }
    );

    //this._eventManager.addPointerEnterListener(this._elements.testButton, this.onTestButtonPointerEnter.bind(this));
    //this._eventManager.addPointerLeaveListener(this._elements.testButton, this.onTestButtonPointerLeave.bind(this));
    //this._eventManager.addPointerDownListener(this._elements.testButton, this.onTestButtonPointerDown.bind(this));
    //this._eventManager.addPointerCancelListener(this._elements.testButton, this.onTestButtonPointerCancel.bind(this));
    //this._eventManager.addPointerUpListener(this._elements.testButton, this.onTestButtonPointerUp.bind(this));
    //
    //document.addEventListener('visibilitychange', this.onDocumentVisibilityChange.bind(this));
    //window.addEventListener('focus', this.onWindowFocus.bind(this));
    //window.addEventListener('blur', this.onWindowBlur.bind(this));
  }

  _sensitivity = 2;
  _deadZone = 1.5; // degrees
  _smoothingAlpha = 0.2;

  _lastGamma = null;
  _lastBeta = null;
  _cursorX = window.innerWidth / 2;
  _cursorY = window.innerHeight / 2;

  clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  smooth(prev, curr, alpha = 0.2) {
    return alpha * curr + (1 - alpha) * prev;
  }

  onDeviceOrientation(evt) {
    const { gamma, beta } = evt;

    if (lastGamma !== null && lastBeta !== null) {
      let deltaX = gamma - lastGamma;
      let deltaY = beta - lastBeta;

      // Dead zone filtering
      if (Math.abs(deltaX) < deadZone) deltaX = 0;
      if (Math.abs(deltaY) < deadZone) deltaY = 0;

      // Apply sensitivity
      deltaX *= sensitivity;
      deltaY *= sensitivity;

      // Update cursor
      cursorX = clamp(cursorX + deltaX, 0, window.innerWidth);
      cursorY = clamp(cursorY + deltaY, 0, window.innerHeight);

      // Smooth position
      const smoothedX = smooth(parseFloat(this._elements.cursor.style.left || 0), cursorX);
      const smoothedY = smooth(parseFloat(this._elements.cursor.style.top || 0), cursorY);

      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`onDeviceOrientation(evt): x=${smoothedX}px, y=${smoothedY}px`, evt));
      this._elements.cursor.style.left = `${smoothedX}px`;
      this._elements.cursor.style.top = `${smoothedY}px`;
    }

    lastGamma = gamma;
    lastBeta = beta;
  }

  //let lastX = window.innerWidth / 2;
  //let lastY = window.innerHeight / 2;
  //
  //onDeviceOrientation(evt) {
  //  if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onDeviceOrientation(evt)", evt));
  //  
  //  // Get the alpha, beta, and gamma values
  //  const alpha = event.alpha; // Rotation around Z-axis (0 - 360 degrees)
  //  const beta = event.beta;   // Rotation around X-axis (-180 to 180 degrees)
  //  const gamma = event.gamma; // Rotation around Y-axis (-90 to 90 degrees)
  //  
  //  // Map the orientation values to screen coordinates
  //  // Assuming the center of the screen is the origin (lastX, lastY)
  //  
  //  const sensitivity = 10; // Control the sensitivity of mouse movement
  //  
  //  // Adjust mouse position based on device rotation (alpha, beta, gamma)
  //  let newX = lastX + (gamma * sensitivity);
  //  let newY = lastY + (beta * sensitivity);
  //  
  //  // Clamp the new positions to screen dimensions
  //  newX = Math.max(0, Math.min(window.innerWidth, newX));
  //  newY = Math.max(0, Math.min(window.innerHeight, newY));
  //  
  //  // Update last position for next movement
  //  lastX = newX;
  //  lastY = newY;
  //  
  //  // Create a mousemove event
  //  const mouseMoveEvent = new MouseEvent("mousemove", {
  //    clientX: newX,
  //    clientY: newY,
  //    bubbles: true,
  //    cancelable: true,
  //  });
  //  
  //  // Dispatch the mousemove event
  //  document.dispatchEvent(mouseMoveEvent);
  //}

  onTestButtonHover(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonHover(btn, evt)", btn, evt));
  }
  onTestButtonAbortHover(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonAbortHover(btn, evt)", btn, evt));
  }
  onTestButtonPress(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPress(btn, evt)", btn, evt));
  }
  onTestButtonAbortPress(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonAbortPress(btn, evt)", btn, evt));
  }
  onTestButtonRelease(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonRelease(btn, evt)", btn, evt));
  }

  onTestButtonPointerEnter(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerEnter(evt)", evt));
  }
  onTestButtonPointerLeave(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerLeave(evt)", evt));
  }
  onTestButtonPointerDown(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerDown(evt)", evt));
    this.triggerPopinOrPopup(evt);
  }
  onTestButtonPointerCancel(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerCancel(evt)", evt));
  }
  onTestButtonPointerUp(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerUp(evt)", evt));
  }

  onDocumentVisibilityChange(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onDocumentVisibilityChange(evt) + document.visibilityState", evt, document.visibilityState));
  }
  onWindowFocus(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onWindowFocus(evt) + document.visibilityState", evt, document.visibilityState));
  }
  onWindowBlur(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onWindowBlur(evt) + document.visibilityState", evt, document.visibilityState));
  }

  triggerPopinOrPopup(evt) {
    if (this._config?.["pop_mode"] === "popin") this.triggerPopin(evt);
    if (this._config?.["pop_mode"] === "popup") this.triggerPopup();
  }

  triggerPopin(evt) {
    // Store mouse position
    const mouseX = evt.clientX;
    const mouseY = evt.clientY;
    setTimeout(() => {
      // Show the popin after 500 milliseconds
      this._elements.popin.style.left = `${mouseX}px`;
      this._elements.popin.style.top = `${mouseY}px`;
      this._elements.popin.hidden = false;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("triggerPopinShown(evt)", evt));
      setTimeout(() => {
        // Hide the popin after 2 seconds
        this._elements.popin.hidden = true;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("triggerPopinHidden(evt)", evt));
      }, 2000);
    }, 500);
  }

  triggerPopup(evt) {
    alert("Hello from popup!");
  }

  doUpdateConfig() {
    // Nothing to do here
  }

  doUpdateHass() {
    // Nothing to do here
  }

  // configuration defaults
  static getStubConfig() {
    return {
      haptic: true,
      log_level: "warn",
      log_pushback: false
    }
  }

  getCardSize() {
    return 1;
  }
}

if (!customElements.get("test-card")) customElements.define("test-card", TestCard);