import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';

console.info("Loading arrowpad-card");

class ArrowPadCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); // Create shadow root

    this._hass = null;
    this._uiBuilt = false;

    // Configs
    this.loglevel = 'warn';
    this.logpushback = false;
    this.logger = new Logger(this.loglevel, this._hass, this.logpushback);
    this.eventManager = new EventManager(this.logger);
    this.layout = 'common';
    this.layoutUrl = `${Globals.DIR_LAYOUTS}/arrowpad/${this.layout}.json`;

    // Layout loading flags
    this._layoutReady = false;
    this._layoutLoaded = {};

    // To track pressed modifiers and keys
    this.pressedModifiers = new Set();
    this.pressedKeys = new Set();

    // Handle out of bounds mouse releases
    this._handleGlobalPointerUp = this.handleGlobalPointerUp.bind(this);
  }

  setConfig(config) {
    this.config = config;

    if (config) {
      // Set log level
      const oldLoglevel = this.loglevel;
      if (config['log_level']) {
        this.loglevel = config['log_level'];
      }
      
      // Set log pushback
      const oldLogpushback = this.logpushback;
      if (config['log_pushback']) {
        this.logpushback = config['log_pushback'];
      }
      
      // Update logger when needed
      if (!oldLoglevel || oldLoglevel !== this.loglevel || !oldLogpushback || oldLogpushback !== this.logpushback) {
        this.logger = this.logger.update(this.loglevel, this._hass, this.logpushback);
      }
      if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("setConfig(config):", this.config));
      
      // Set haptic feedback
      if (config['haptic']) {
        this.eventManager.setHaptic(config['haptic']);
      }

      // Set layout
      if (config['layout']) {
        this.layout = config['layout'];
      }
      
      // Set layout URL
      if (config['layout_url']) {
        this.layoutUrl = config['layout_url'];
      } else {
        this.layoutUrl = `${Globals.DIR_LAYOUTS}/arrowpad/${this.layout}.json`;
      }
    }
  }

  getCardSize() {
    return 3;
  }

  async connectedCallback() {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("connectedCallback()"));

    // Check if layout needs loading
    if (!this._layoutLoaded.layoutUrl || this._layoutLoaded.layoutUrl !== this.layoutUrl) {
      this._layoutReady = false;

      // Load layout
      await this.loadLayout(this.layoutUrl);

      // Update loaded layout
      this._layoutLoaded.layoutUrl = this.layoutUrl;
      this._layoutReady = true;
    }

    // Only build UI if hass is already set
    if (this._hass) {
      this.buildUi(this._hass);
    }
  }

  async loadLayout(layoutUrl) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("loadLayout(layoutUrl):", layoutUrl));
    try {
      const response = await fetch(layoutUrl);
      const layout = await response.json();
      this.keys = layout.keys;
      this.rowsConfig = layout.rowsConfig;
    } catch (e) {
      if (this.logger.isErrorEnabled()) console.error(...this.logger.error(`Failed to load remote layout ${layoutUrl}`, e));
      this.keys = [];
      this.rowsConfig = [];
    }
  }

  set hass(hass) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("set hass(hass):", hass));
    this._hass = hass;
    if (this._layoutReady && !this._uiBuilt) {
      // Render UI
      this.buildUi(this._hass);
    }
  }

  buildUi(hass) {
    if (this._uiBuilt) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("buildUi(hass) - already built"));
      return;
    }
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("buildUi(hass):", hass));

    // Clear existing content (if any)
    this.shadowRoot.innerHTML = '';

    this._uiBuilt = true;

    // Re-add global handlers to ensure proper out-of-bound handling
    this.eventManager.removeGlobalPointerUpHandlers(this._handleGlobalPointerUp);
    this.eventManager.addGlobalPointerUpHandlers(this._handleGlobalPointerUp);

    const card = document.createElement("ha-card");
    // card.header = "Arrow Pad";

    const style = document.createElement("style");
    style.textContent = `
      :host {
        --squarekey-bg: #3b3a3a;
        --squarekey-hover-bg: #4a4a4a;
        --squarekey-active-bg: #2c2b2b;
        --squarekey-special-bg: #222;
        --squarekey-special-color: #ccc;
        --squarekey-height: 3.5rem;
        --squarekey-margin: 0.15rem;
        display: block;
        width: 100%;
        user-select: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-sizing: border-box;
      }
      .keyboard-container {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.5rem 0.3rem 1rem;
        background: #1a1a1a;
        border-radius: 8px;
        box-sizing: border-box;
        width: 100%;
      }
      .keyboard-row {
        display: flex;
        gap: 0.3rem;
        width: 100%;
      }
      button.squarekey {
        background: var(--squarekey-bg);
        border: none;
        border-radius: 5px;
        color: #eee;
        font-size: 1.1rem;
        cursor: pointer;
        height: var(--squarekey-height);
        width: var(--squarekey-height); /* Ensure square shape */
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-sizing: border-box;
        transition: background 0.15s ease;
        padding: 0 0.5rem;
        white-space: nowrap;
        overflow: hidden;
        -webkit-tap-highlight-color: transparent; /* Remove mobile tap effect */
        outline: none; /* Prevent focus ring override */
        flex: 0 0 auto; /* Prevent stretching */
      }
      button.squarekey.spacer {
        pointer-events: none;
        background: transparent;
        border: none;
        box-shadow: none;
        opacity: 0;
        cursor: default;
      }
      button.squarekey.wide {
        width: calc(var(--squarekey-height) * 2);
      }
      button.squarekey.wider {
        width: calc(var(--squarekey-height) * 3);
      }
      button.squarekey.altkey {
        width: calc(var(--squarekey-height) * 1.5);
      }
      button.squarekey.spacebar {
        width: calc(var(--squarekey-height) * 11);
      }
      button.squarekey.special {
        background: var(--squarekey-special-bg);
        color: var(--squarekey-special-color);
        font-weight: 600;
        font-size: 0.95rem;
      }
      button.squarekey:hover {
        background: var(--squarekey-hover-bg);
      }
      button.squarekey:active {
        background: var(--squarekey-active-bg);
      }
      /* Fix: Ensure active state is visually dominant */
      button.squarekey.active,
      button.squarekey:hover.active,
      button.squarekey:active.active {
        background: #5a5a5a !important;
        color: #fff !important;
      }
      .label-upper {
        position: absolute;
        top: 0.3rem;
        right: 0.5rem;
        font-size: 0.6rem;
        opacity: 0.7;
        user-select: none;
      }
      .label-lower {
        font-size: inherit;
        font-weight: 500;
        user-select: none;
      }
    `;
    this.shadowRoot.appendChild(style);

    const container = document.createElement("div");
    container.className = "keyboard-container";

    let keyIndex = 0;
    this.rowsConfig.forEach((rowCount) => {
      const row = document.createElement("div");
      row.className = "keyboard-row";

      for (let i = 0; i < rowCount; i++, keyIndex++) {
        const keyData = this.keys[keyIndex];
        if (!keyData) continue;

        const btn = document.createElement("button");
        btn.classList.add("squarekey");
        if (keyData.special) btn.classList.add("special");
        if (keyData.width) btn.classList.add(keyData.width);

        // Disable actions on spacers
        if (keyData.code.startsWith("SPACER_")) {
          btn.classList.add("spacer");
        }

        btn.dataset.code = keyData.code;

        const lowerLabel = document.createElement("span");
        lowerLabel.className = "label-lower";

        btn.appendChild(lowerLabel);

        btn._lowerLabel = lowerLabel;
        btn._keyData = keyData;

        // Add pointer and touch events:
        this.eventManager.addPointerDownListener(btn, (e) => this.handlePointerDown(e, hass, btn));
        this.eventManager.addPointerUpListener(btn, (e) => this.handlePointerUp(e, hass, btn));
        this.eventManager.addPointerCancelListener(btn, (e) => this.handlePointerUp(e, hass, btn));

        row.appendChild(btn);
      }

      container.appendChild(row);
    });

    card.appendChild(container);
    this.shadowRoot.appendChild(card);

    this.content = container;
    this.updateLabels();
  }

  updateLabels() {
    for (const btn of this.content.querySelectorAll("button.squarekey")) {
      const keyData = btn._keyData;
      if (!keyData) continue;

      // Set displayed labels
      btn._lowerLabel.textContent = keyData.label.normal || "";
    }
  }

  handleGlobalPointerUp(evt) {
    //console.log("handleGlobalPointerUp", this.content, this._hass);
    if (this.content && this._hass) {
      for (const btn of this.content.querySelectorAll("button.squarekey.active")) {
        this.handleKeyRelease(this._hass, btn);
      }
    }
  }

  handlePointerDown(evt, hass, btn) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    this.handleKeyPress(hass, btn);
  }

  handlePointerUp(evt, hass, btn) {
    evt.preventDefault();
    this.handleKeyRelease(hass, btn);
  }

  handleKeyPress(hass, btn) {
    // Mark button active visually
    btn.classList.add("active");

    // Retrieve key data
    const keyData = btn._keyData;
    if (!keyData) return;

    // Send keyboard changes
    this.appendKeyCode(hass, keyData.code);
  }

  handleKeyRelease(hass, btn) {
    const keyData = btn._keyData;
    if (!keyData) return;

    // Remove active visual for all other keys / states
    btn.classList.remove("active");

    // Release modifier or key through websockets
    this.removeKeyCode(hass, keyData.code);
  }

  appendKeyCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Key pressed:", code));
    if (code) {
      // Standard key pressed
      this.pressedKeys.add(code);
    }
    this.sendKeyboardUpdate(hass);
  }

  removeKeyCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Key released:", code));
    if (code) {
      // Standard key released
      this.pressedKeys.delete(code);
    }
    this.sendKeyboardUpdate(hass);
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendKeyboardUpdate(hass) {
    this.eventManager.callIntegration(hass, "keypress", {
      sendModifiers: Array.from(this.pressedModifiers),
      sendKeys: Array.from(this.pressedKeys),
    });
  }

}

customElements.define("arrowpad-card", ArrowPadCard);