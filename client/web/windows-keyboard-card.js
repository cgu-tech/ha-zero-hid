import { Globals } from './utils/globals.js';

console.info("Loading Windows Keyboard Card");

class WindowsKeyboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); // Create shadow root

    this._hass = null;
    this._layoutReady = false;
    this._uiBuilt = false;
    this.card = null;

    this.layoutUrl = `${Globals.DIR_LAYOUTS}/windows/FR.json`; // Default keyboard layout when not user configured
    this._layoutLoaded = null;

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
    this._handleGlobalTouchEnd = this.handleGlobalPointerUp.bind(this); // reuse same logic
  }

  setConfig(config) {
    this.config = config;

    // Retrieve user configured logging level
    if (config['log_level']) {
      this.loglevel = config['log_level'];
    }

    // Retrieve user configured layout
    if (config['layout_url']) {
      this.layoutUrl = config['layout_url'];
    }

    // Retrieve user configured haptic feedback
    if (config['haptic']) {
      this.haptic = config['haptic'];
    }
  }

  getCardSize() {
    return 3;
  }

  async connectedCallback() {
    console.log("Windows Keyboard - connectedCallback");
    // Load keyboard layout
    if (!this._layoutLoaded || this._layoutLoaded !== this.layoutUrl) {
      this._layoutReady = false;
      await this.loadLayout(this.layoutUrl);
      this._layoutLoaded = this.layoutUrl;
      this._layoutReady = true;
    }

    // Only build UI if hass is already set
    if (this._hass) {
      this.buildKeyboard(this._hass);
    }
  }

  async loadLayout(layoutUrl) {
    console.log("Windows Keyboard - loading keyboard layout:", layoutUrl);
    try {
      const response = await fetch(layoutUrl);
      const layout = await response.json();
      this.keys = layout.keys;
      this.rowsConfig = layout.rowsConfig;
    } catch (e) {
      console.error("Windows Keyboard - Failed to load keyboard layout:", e);
      this.keys = [];
      this.rowsConfig = [];
    }
  }

  set hass(hass) {
    console.log("Windows Keyboard - set hass():", hass);
    this._hass = hass;
    if (this._layoutReady && !this._uiBuilt) {
      this.buildKeyboard(this._hass);
    }
  }

  buildKeyboard(hass) {
    if (this._uiBuilt) {
      console.log("Windows Keyboard - buildKeyboard() SKIPPED");
      return;
    }
    console.log("Windows Keyboard - buildKeyboard() ENTER");

    // Clear existing content (if any)
    this.shadowRoot.innerHTML = "";

    this._uiBuilt = true;
    // Re-add global handlers to ensure proper out-of-bound handling
    this.removeGlobalHandlers();
    this.addGlobalHandlers();

    const card = document.createElement("ha-card");
    // card.header = "Windows Keyboard";

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
        btn.addEventListener("pointerdown", (e) => this.handlePointerDown(e, hass, btn));
        btn.addEventListener("pointerup", (e) => this.handlePointerUp(e, hass, btn));
        btn.addEventListener("pointercancel", (e) => this.handlePointerCancel(e, hass, btn));
        // For older touch devices fallback
        btn.addEventListener("touchend", (e) => this.handlePointerUp(e, hass, btn));
        btn.addEventListener("touchcancel", (e) => this.handlePointerCancel(e, hass, btn));

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

  addGlobalHandlers() {
    window.addEventListener("pointerup", this._handleGlobalPointerUp);
    window.addEventListener("touchend", this._handleGlobalTouchEnd);
    window.addEventListener("mouseleave", this._handleGlobalPointerUp);
    window.addEventListener("touchcancel", this._handleGlobalPointerUp);
    console.log("handleGlobalPointerUp added");
  }

  removeGlobalHandlers() {
    window.removeEventListener("pointerup", this._handleGlobalPointerUp);
    window.removeEventListener("touchend", this._handleGlobalTouchEnd);
    window.removeEventListener("mouseleave", this._handleGlobalPointerUp);
    window.removeEventListener("touchcancel", this._handleGlobalPointerUp);
    console.log("handleGlobalPointerUp removed");
  }

  handleGlobalPointerUp(evt) {
    //console.log("handleGlobalPointerUp", this.content, this._hass);
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

  handlePointerCancel(evt, hass, btn) {
    evt.preventDefault();
    this.handleKeyRelease(hass, btn);
  }

  handleKeyPress(hass, btn) {
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

    // Pressed key symbol (keyboard layout dependant, for information only)
    const charToSend = btn._lowerLabel.textContent || "";

    // Send keyboard changes
    this.appendCode(hass, code, charToSend);
  }

  handleKeyRelease(hass, btn) {
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
    this.removeCode(hass, code);
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

  appendCode(hass, code, charToSend) {
    console.log("Key pressed:", code, "Char:", charToSend);
    if (code) {
      if (this.isModifier(code)) {
        // Modifier key pressed
        this.pressedModifiers.add(code);
      } else {
        // Standard key pressed
        this.pressedKeys.add(code);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  removeCode(hass, code) {
    console.log("Key released:", code);
    if (code) {
      if (this.isModifier(code)) {
        // Modifier key released
        this.pressedModifiers.delete(code);
      } else {
        // Standard key released
        this.pressedKeys.delete(code);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendKeyboardUpdate(hass) {
    hass.callService(Globals.COMPONENT_NAME, "keypress", {
      sendModifiers: Array.from(this.pressedModifiers),
      sendKeys: Array.from(this.pressedKeys),
    });
  }

  // Synchronize with remote keyboard current state through HA websockets API
  syncKeyboard(hass) {
    hass.connection.sendMessagePromise({
      type: `${Globals.COMPONENT_NAME}/sync_keyboard`
    })
    .then((response) => {
      // Success handler
      const { syncModifiers, syncKeys, syncNumlock, syncCapslock, syncScrolllock } = response;
      console.log("Synced Modifiers:", syncModifiers);
      console.log("Synced Keys:", syncKeys);
      console.log("Synced Numlock:", syncNumlock);
      console.log("Synced Capslock:", syncCapslock);
      console.log("Synced Scrolllock:", syncScrolllock);
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
      console.error("Failed to sync keyboard state:", err);
    });
  }

}

customElements.define("windows-keyboard-card", WindowsKeyboardCard);