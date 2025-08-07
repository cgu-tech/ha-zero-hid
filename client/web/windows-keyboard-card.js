import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { KeyCodes } from './utils/keycodes.js';

console.info("Loading windows-keyboard-card");

class WindowsKeyboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); // Create shadow root

    this._keycodes = new KeyCodes().getMapping();

    this._hass = null;
    this._uiBuilt = false;
    this.card = null;

    // Configs
    this.config = null;
    this.loglevel = 'warn';
    this.logpushback = false;
    this.logger = new Logger("windows-keyboard-card.js", this.loglevel, this._hass, this.logpushback);
    this.eventManager = new EventManager(this.logger);
    this.resourceManager = new ResourceManager(this.logger, this.eventManager, import.meta.url);
    this.layout = 'US';
    this.layoutUrl = `${Globals.DIR_LAYOUTS}/windows/${this.layout}.json`;

    // Layout loading flags
    this._layoutReady = false;
    this._layoutLoaded = {};

    // To track pressed modifiers
    this.capsLock = false;
    this.shift = false;
    this.ctrl = false;
    this.gui = false;
    this.alt = false;
    this.altGr = false;

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
        this.logger.update(this.loglevel, this._hass, this.logpushback);
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
        this.layoutUrl = `${Globals.DIR_LAYOUTS}/windows/${this.layout}.json`;
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
      this.resourceManager.synchronizeResources(this._hass);
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
      if (this.logger.isErrorEnabled()) console.error(...this.logger.error(`Failed to load layout ${layoutUrl}`, e));
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

    // Update the logger
    this.logger.update(this.loglevel, hass, this.logpushback);

    const card = document.createElement("ha-card");

    const style = document.createElement("style");
    style.textContent = `
      :host {
        --key-bg: #3b3a3a;
        --key-hover-bg: #4a4a4a;
        --key-active-bg: #2c2b2b;
        --key-special-bg: #222;
        --key-special-color: #ccc;
        --key-height: 3.5rem;
        --key-margin: 0.15rem;
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
      button.key {
        background: var(--key-bg);
        border: none;
        border-radius: 5px;
        color: #eee;
        font-size: 1.1rem;
        cursor: pointer;
        height: var(--key-height);
        flex-grow: 1;
        flex-basis: 0;
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
      }
      button.key.wide {
        flex-grow: 2;
      }
      button.key.wider {
        flex-grow: 3;
      }
      button.key.altkey {
        flex-grow: 1.5;
      }
      button.key.spacebar {
        flex-grow: 11;
      }
      button.key.special {
        background: var(--key-special-bg);
        color: var(--key-special-color);
        font-weight: 600;
        font-size: 0.95rem;
      }
      button.key:hover {
        background: var(--key-hover-bg);
      }
      button.key:active {
        background: var(--key-active-bg);
      }
      /* Fix: Ensure active state is visually dominant */
      button.key.active,
      button.key:hover.active,
      button.key:active.active {
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
        btn.classList.add("key");
        if (keyData.special) btn.classList.add("special");
        if (keyData.width) btn.classList.add(keyData.width);

        btn.dataset.code = keyData.code;

        const lowerLabel = document.createElement("span");
        lowerLabel.className = "label-lower";

        const upperLabel = document.createElement("span");
        upperLabel.className = "label-upper";

        lowerLabel.textContent = keyData.label.normal || "";
        if (keyData.label.shift) {
          upperLabel.textContent = keyData.label.shift;
        } else if (keyData.label.altGr) {
          upperLabel.textContent = keyData.label.altGr;
        } else {
          upperLabel.textContent = "";
        }

        btn.appendChild(lowerLabel);
        btn.appendChild(upperLabel);

        btn._lowerLabel = lowerLabel;
        btn._upperLabel = upperLabel;
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

    // Initial synchronization to retrieve remote keyboard state
    this.syncKeyboard(hass);
  }

  updateLabels() {
    for (const btn of this.content.querySelectorAll("button.key")) {
      const keyData = btn._keyData;
      if (!keyData) continue;

      // Pressed key code (keyboard layout independant, later send to remote keyboard)
      const code = keyData.code;

      // Toggle visual state
      if (code === "KEY_CAPSLOCK") {
        btn.classList.toggle("active", this.capsLock);
      }
      if (code === "MOD_LEFT_SHIFT" || code === "MOD_RIGHT_SHIFT") {
        btn.classList.toggle("active", this.shift);
      }
      if (code === "MOD_LEFT_CONTROL" || code === "MOD_RIGHT_CONTROL") {
        btn.classList.toggle("active", this.ctrl);
      }
      if (code === "MOD_LEFT_GUI" || code === "MOD_RIGHT_GUI") {
        btn.classList.toggle("active", this.gui);
      }
      if (code === "MOD_LEFT_ALT") {
        btn.classList.toggle("active", this.alt);
      }
      if (code === "MOD_RIGHT_ALT") {
        btn.classList.toggle("active", this.altGr);
      }

      // Determine displayed labels
      let displayLower = "";
      let displayUpper = "";

      if (this.altGr) {
        displayLower = this.getLabelAlternativeAltGr(keyData);
      } else if (this.shift !== this.capsLock) {
        displayLower = this.getLabelAlternativeShift(keyData);
      } else {
        displayLower = this.getLabelNormal(keyData) || "";
      }

      // Set displayed labels
      btn._lowerLabel.textContent = displayLower;
      btn._upperLabel.textContent = displayUpper;
    }
  }

  // Given:
  // - keyData: a <button>.keyData object
  // - alternativeLabel: an alternative label
  // When:
  // - alternativeLabel is defined, then alternativeLabel is returned
  // - keyData.special is truthy, then normal label from keyData is returned
  // - otherwise, empty label is returned
  getLabelAlternative(keyData, alternativeLabel) {
    let modifiedLabel = "";
    if (alternativeLabel != null) {
      modifiedLabel = alternativeLabel;
    } else if (keyData.special) {
      modifiedLabel = this.getLabelNormal(keyData);
    }
    return modifiedLabel;
  }

  getLabelAlternativeAltGr(keyData) {
    return this.getLabelAlternative(keyData, this.getLabelAltGr(keyData));
  }

  getLabelAlternativeShift(keyData) {
    return this.getLabelAlternative(keyData, this.getLabelShift(keyData));
  }

  getLabelNormal(keyData) {
    return keyData.label.normal;
  }

  getLabelAltGr(keyData) {
    return keyData.label.altGr;
  }

  getLabelShift(keyData) {
    return keyData.label.shift;
  }

  handleGlobalPointerUp(evt) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleGlobalPointerUp(evt):", evt));
    if (this.content && this._hass) {
      for (const btn of this.content.querySelectorAll("button.key.active")) {
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

  // A wrapper for handleKeyPressInternal internal logic, used to avoid clutering code with hapticFeedback calls
  handleKeyPress(hass, btn) {
    this.handleKeyPressInternal(hass, btn);

    // Send haptic feedback to make user acknownledgable of succeeded press event
    this.eventManager.hapticFeedback();
  }

  handleKeyPressInternal(hass, btn) {
    // Mark button active visually
    btn.classList.add("active");

    // Retrieve key data
    const keyData = btn._keyData;
    if (!keyData) return;

    // Pressed key code (keyboard layout independant, later send to remote keyboard)
    const code = keyData.code;

    // Special buttons handling
    if (code === "KEY_SYNC") {
        this.syncKeyboard(hass);
        return;
    }

    // Change and retrieve modifiers + capslock states
    if (this.isModifierOrCapslock(code)) {
      if (code === "KEY_CAPSLOCK") {
        this.capsLock = !this.capsLock;
      } else if (code === "MOD_LEFT_SHIFT" || code === "MOD_RIGHT_SHIFT") {
        this.shift = !this.shift;
      } else if (code === "MOD_LEFT_CONTROL" || code === "MOD_RIGHT_CONTROL") {
        this.ctrl = !this.ctrl;
      } else if (code === "MOD_LEFT_GUI" || code === "MOD_RIGHT_GUI") {
        this.gui = !this.gui;
      } else if (code === "MOD_LEFT_ALT") {
        this.alt = !this.alt;
      } else if (code === "MOD_RIGHT_ALT") {
        this.altGr = !this.altGr;
      }
      // Update visual layout with modified modifiers + capslock states
      this.updateLabels();
    }

    // Send keyboard changes
    this.appendKeyCode(hass, code);
  }

  // A wrapper for handleKeyRelease internal logic, used to avoid clutering code with hapticFeedback calls
  handleKeyRelease(hass, btn) {
    this.handleKeyReleaseInternal(hass, btn);

    // Send haptic feedback to make user acknownledgable of succeeded release event
    this.eventManager.hapticFeedback();
  }

  handleKeyReleaseInternal(hass, btn) {
    const keyData = btn._keyData;
    if (!keyData) return;

    const code = keyData.code;

    // Special buttons handling
    if (code === "KEY_SYNC") {
        btn.classList.remove("active");
        return;
    }

    // Do not release modifiers when explicitly active
    if (code === "MOD_LEFT_SHIFT" || code === "MOD_RIGHT_SHIFT") {
      if (this.shift) return;
    } else if (code === "MOD_LEFT_CONTROL" || code === "MOD_RIGHT_CONTROL") {
      if (this.ctrl) return;
    } else if (code === "MOD_LEFT_GUI" || code === "MOD_RIGHT_GUI") {
      if (this.gui) return;
    } else if (code === "MOD_LEFT_ALT") {
      if (this.alt) return;
    } else if (code === "MOD_RIGHT_ALT") {
      if (this.altGr) return;
    }

    // Do not disable capslock active when explicitly active
    if (code === "KEY_CAPSLOCK") {
      if (!this.capsLock) btn.classList.remove("active");
    } else {
      // Remove active visual for all other keys / states
      btn.classList.remove("active");
    }

    // Release modifier or key through websockets
    this.removeKeyCode(hass, code);
  }

  // When key code is a modifier key, returns true. Returns false otherwise.
  isModifier(code) {
    return code.startsWith("MOD_");
  }

  // When key code is the capslock key, returns true. Returns false otherwise.
  isCapslock(code) {
    return code === "KEY_CAPSLOCK";
  }

  // When key code is a modifier key or the capslock key, returns true. Returns false otherwise.
  isModifierOrCapslock(code) {
    return this.isModifier(code) || this.isCapslock(code);
  }

  appendKeyCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Key pressed:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key pressed
        this.pressedModifiers.add(intCode);
      } else {
        // Standard key pressed
        this.pressedKeys.add(intCode);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  removeKeyCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Key released:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key released
        this.pressedModifiers.delete(intCode);
      } else {
        // Standard key released
        this.pressedKeys.delete(intCode);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendKeyboardUpdate(hass) {
    this.eventManager.callComponentService(hass, "keypress", {
      sendModifiers: Array.from(this.pressedModifiers),
      sendKeys: Array.from(this.pressedKeys),
    });
  }

  // Synchronize with remote keyboard current state through HA websockets API
  syncKeyboard(hass) {
   this.eventManager.callComponentCommand(hass, 'sync_keyboard').then((response) => {
      // Success handler
      const { syncModifiers, syncKeys, syncNumlock, syncCapslock, syncScrolllock } = response;
      if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("syncModifiers:", syncModifiers));
      if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("syncKeys:", syncKeys));
      if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("syncNumlock:", syncNumlock));
      if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("syncCapslock:", syncCapslock));
      if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("syncScrolllock:", syncScrolllock));
      // Update intenal states
      this.capsLock = syncCapslock;
      this.shift = syncModifiers && (syncModifiers.includes("MOD_LEFT_SHIFT") || syncModifiers.includes("MOD_RIGHT_SHIFT"));
      this.ctrl = syncModifiers && (syncModifiers.includes("MOD_LEFT_CONTROL") || syncModifiers.includes("MOD_RIGHT_CONTROL"));
      this.gui = syncModifiers && (syncModifiers.includes("MOD_LEFT_GUI") || syncModifiers.includes("MOD_RIGHT_GUI"));
      this.alt = syncModifiers && syncModifiers.includes("MOD_LEFT_ALT");
      this.altGr = syncModifiers && syncModifiers.includes("MOD_RIGHT_ALT");
      this.updateLabels();
    })
    .catch((err) => {
      if (this.logger.isErrorEnabled()) console.error(...this.logger.error("Failed to sync keyboard state:", err));
    });
  }

}

customElements.define("windows-keyboard-card", WindowsKeyboardCard);
