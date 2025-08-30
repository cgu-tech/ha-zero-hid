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

  getEventManager() {
    return this._eventManager;
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

  // jobs
  doCheckConfig() {
    // Do your checks here
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
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