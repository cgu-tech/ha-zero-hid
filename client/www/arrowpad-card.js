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
    return 3;
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
    for (const btn of this.content.querySelectorAll("button.squarekey")) {
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