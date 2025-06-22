console.info("Loading Arrow Pad Card");

class ArrowPadCard extends HTMLElement {
  constructor() {
    super();

    this._hass = null;
    this._layoutReady = false;
    this._uiBuilt = false;
    this.layoutUrl = '/local/layouts/arrowpad/common.json'; // Default keyboard layout when not user configured

    // To track pressed modifiers and keys
    this.pressedModifiers = new Set();
    this.pressedKeys = new Set();

    // Handle out of bounds mouse releases
    this._handleGlobalPointerUp = this.handleGlobalPointerUp.bind(this);
    this._handleGlobalTouchEnd = this.handleGlobalPointerUp.bind(this); // reuse same logic
  }

  setConfig(config) {
    this.config = config;
    
    // Retrieve user configured layout
    if (config.layoutUrl) {
      this.layoutUrl = config.layoutUrl;
    }
  }

  getCardSize() {
    return 1;
  }

  async connectedCallback() {
    console.log("Arrow Pad - connectedCallback");
    // Load keyboard layout
    await this.loadLayout(this.layoutUrl);
    this._layoutReady = true;

    // Only build UI if hass is already set
    if (this._hass) {
      this.buildKeyboard(this._hass);
    }
  }

  async loadLayout(layoutUrl) {
    console.log("Arrow Pad - loading keyboard layout:", layoutUrl);
    try {
      const response = await fetch(layoutUrl);
      const layout = await response.json();
      this.keys = layout.keys;
      this.rowsConfig = layout.rowsConfig;
    } catch (e) {
      console.error("Arrow Pad - Failed to load keyboard layout:", e);
      this.keys = [];
      this.rowsConfig = [];
    }
  }

  set hass(hass) {
    console.log("Arrow Pad - set hass():", hass);
    this._hass = hass;
    if (this._layoutReady && !this._uiBuilt) {
      this.buildKeyboard(this._hass);
    }
  }

  buildKeyboard(hass) {
    if (this._uiBuilt) {
      console.log("Arrow Pad - buildKeyboard() SKIPPED");
      return;
    }
    console.log("Arrow Pad - buildKeyboard() ENTER");

    // Clear existing content (if any)
    this.innerHTML = '';

    this._uiBuilt = true;
    // Re-add global handlers to ensure proper out-of-bound handling
    this.removeGlobalHandlers();
    this.addGlobalHandlers();

    const card = document.createElement("ha-card");
    card.header = "Arrow Pad";

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
    this.appendChild(style);

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

        btn.appendChild(lowerLabel);

        btn._lowerLabel = lowerLabel;
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
    this.appendChild(card);

    this.content = container;
    this.updateLabels();
  }

  updateLabels() {
    for (const btn of this.content.querySelectorAll("button.key")) {
      const keyData = btn._keyData;
      if (!keyData) continue;

      // Set displayed labels
      btn._lowerLabel.textContent = keyData.label.normal || "";
    }
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

    // Pressed key symbol (keyboard layout dependant, for information only)
    const charToSend = btn._lowerLabel.textContent || "";

    // Send keyboard changes
    this.appendCode(hass, keyData.code, charToSend);
  }

  handleKeyRelease(hass, btn) {
    const keyData = btn._keyData;
    if (!keyData) return;

    // Remove active visual for all other keys / states
    btn.classList.remove("active");

    // Release modifier or key through websockets
    this.removeCode(hass, keyData.code);
  }

  appendCode(hass, code, charToSend) {
    console.log("Key pressed:", code, "Char:", charToSend);
    if (code) {
      // Standard key pressed
      this.pressedKeys.add(code);
    }
    this.sendKeyboardUpdate(hass);
  }

  removeCode(hass, code) {
    console.log("Key released:", code);
    if (code) {
      // Standard key released
      this.pressedKeys.delete(code);
    }
    this.sendKeyboardUpdate(hass);
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendKeyboardUpdate(hass) {
    hass.callService("trackpad_mouse", "keypress", {
      sendModifiers: Array.from(this.pressedModifiers),
      sendKeys: Array.from(this.pressedKeys),
    });
  }

}

customElements.define("arrowpad-card", ArrowPadCard);