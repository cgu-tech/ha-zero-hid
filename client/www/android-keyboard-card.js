console.info("Loading Android Keyboard Card");

class AndroidKeyboardCard extends HTMLElement {
  constructor() {
    super();
    
    this._hass = null;
    this._layoutReady = false;
    this._uiBuilt = false;
    this.layoutUrl = '/local/layouts/android/FR.json'; // Default keyboard layout when not user configured
    
    // 0: normal/shift mode
    // 1: alternative mode
    this.MODE_NORMAL = 0;
    this.MODE_ALT = 1;
    this.currentMode = this.MODE_NORMAL;
    // 0 → State 1: Normal
    // 1 → State 2: Shift-once
    // 2 → State 3: Shift-locked
    this.SHIFT_STATE_NORMAL = 0;
    this.SHIFT_STATE_ONCE = 1;
    this.SHIFT_STATE_LOCKED = 2;
    this.shiftState = this.SHIFT_STATE_NORMAL;
    // 0 → State 1: Alternative symbols page 1
    // 1 → State 2: Alternative symbols page 2
    this.ALT_PAGE_ONE = 0;
    this.ALT_PAGE_TWO = 1;
    this.altState = this.ALT_PAGE_ONE;

    this.popin = null;
    this.popinTimeout = null;
    this.card = null;

    // To track pressed modifiers and keys
    this.pressedModifiers = new Set();
    this.pressedKeys = new Set();
    this.pressedConsumers = new Set();

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
    console.log("Android Keyboard - connectedCallback");
    // Load keyboard layout
    await this.loadLayout(this.layoutUrl);
    this._layoutReady = true;

    // Only build UI if hass is already set
    if (this._hass) {
      this.buildKeyboard(this._hass);
    }
  }

  async loadLayout(layoutUrl) {
    console.log("Android Keyboard - loading keyboard layout:", layoutUrl);
    try {
      const response = await fetch(layoutUrl);
      const layout = await response.json();
      this.keys = layout.keys;
      this.rowsConfig = layout.rowsConfig;
    } catch (e) {
      console.error("Android Keyboard - Failed to load keyboard layout:", e);
      this.keys = [];
      this.rowsConfig = [];
    }
  }

  set hass(hass) {
    console.log("Android Keyboard - set hass():", hass);
    this._hass = hass;
    if (this._layoutReady && !this._uiBuilt) {
      this.buildKeyboard(this._hass);
    }
  }

  buildKeyboard(hass) {
    if (this._uiBuilt) {
      console.log("Android Keyboard - buildKeyboard() SKIPPED");
      return;
    }
    console.log("Android Keyboard - buildKeyboard() ENTER");
    
    // Clear existing content (if any)
    this.innerHTML = '';

    this._uiBuilt = true;
    
    // Re-add global handlers to ensure proper out-of-bound handling
    this.removeGlobalHandlers();
    this.addGlobalHandlers();
    
    const card = document.createElement("ha-card");
    card.header = "Android Keyboard";
    
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
      button.key.half {
        flex-grow: 0.5;
      }
      button.key.wide {
        flex-grow: 2;
      }
      button.key.wider {
        flex-grow: 3;
      }
      button.key.android {
        flex-grow: 1.55;
      }
      button.key.altkey {
        flex-grow: 1.5;
      }
      button.key.spacebar {
        flex-grow: 7.4;
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
      button.key.locked {
        background: #777 !important;
        color: #fff !important;
        font-weight: bold;
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
    
    style.textContent += `
      .key-popin {
        position: fixed; /* Use fixed instead of absolute for document.body */
        background: var(--key-bg, #3b3a3a); /* Fallback if var is missing */
        border-radius: 6px;
        padding: 0.25rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        user-select: none;
      }
      .key-popin-row {
        display: flex;
      }
      .key-popin button.key {
        margin: var(--key-margin, 0.15rem);
        height: var(--key-height, 3.5rem);
        background: var(--key-bg, #3b3a3a);
        color: #fff;
        border: none;
        border-radius: 5px;
        font-size: 1rem;
        padding: 0 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .key-popin button.key.active {
        background: #3399ff !important; /* blue */
        color: #000 !important;
      }
      .key-popin.visible {
        opacity: 1;
        transform: scale(1);
      }
      /* Initial state: hidden and scaled down */
      .key-popin-row .key {
        opacity: 0;
        transform: scale(0.8);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      /* When entering: visible and full size */
      .key-popin-row .key.enter-active {
        opacity: 1;
        transform: scale(1);
      }
      /* When leaving: fade out and scale down */
      .key-popin-row .key.leave-active {
        opacity: 0;
        transform: scale(0.8);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      ha-card {
        position: relative;
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
        lowerLabel.textContent = keyData.label.normal || "";
        
        btn.appendChild(lowerLabel);

        btn._lowerLabel = lowerLabel;
        btn._keyData = keyData;
        btn._pointerDown = false;
        btn._usedPopin = false;

        // Add pointer and touch events:
        btn.addEventListener("pointerdown", (e) => {
          this.handlePointerDown(e, hass, btn);
          btn._pointerDown = true;
        
          // Long press timer (only for non-special keys)
          if (!btn._keyData.special) {
            //console.log("pointerdown->!btn._keyData.special");
            this.popinTimeout = setTimeout(() => {
              // Check for poppin race condition
              if (btn._pointerDown) {
                btn._usedPopin = true;
                this.showPopin(e, hass, card, btn);
              }
            }, 500); // 500ms long-press duration
          }
        });

        btn.addEventListener("pointerup", (e) => {
          btn._pointerDown = false;
          clearTimeout(this.popinTimeout);
          this.handlePointerUp(e, hass, btn);
          //console.log("pointerup->clearTimeout");
        });
        btn.addEventListener("pointercancel", (e) => {
          btn._pointerDown = false;
          clearTimeout(this.popinTimeout);
          this.handlePointerCancel(e, hass, btn);
          //console.log("pointercancel->clearTimeout");
        });
        // For older touch devices fallback
        btn.addEventListener("touchend", (e) => {
          btn._pointerDown = false;
          clearTimeout(this.popinTimeout);
          this.handlePointerUp(e, hass, btn);
          //console.log("touchend->clearTimeout");
        });
        btn.addEventListener("touchcancel", (e) => {
          btn._pointerDown = false;
          clearTimeout(this.popinTimeout);
          this.handlePointerCancel(e, hass, btn);
          //console.log("touchcancel->clearTimeout");
        });

        row.appendChild(btn);
      }
    
      container.appendChild(row);
    });
    
    card.appendChild(container);
    this.appendChild(card);
    
    this.card = card;
    this.content = container;
    this.updateLabels();
  }

  showPopin(evt, hass, card, btn) {
    //console.log("showPopin:", btn);
    if (this.popin) this.closePopin();
        
    // Retrieve key data
    const keyData = btn._keyData;
    if (!keyData) return; // abort popin when no KeyData

    const popinKeys = keyData.popinKeys;
    if (!popinKeys) return; // abort popin when no popin keys at all

    // Normalize popinKeys to always be an array of arrays
    const popinRows = Array.isArray(popinKeys[0]) ? popinKeys : [popinKeys];

    const hasKeyToDisplay = popinRows.some(rowKeys => {
        return rowKeys.some(popinKeyData => {
          if (this.currentMode === this.MODE_NORMAL) {
            if (this.shiftState === this.SHIFT_STATE_NORMAL) {
              return popinKeyData.label?.normal?.length > 0;
            } else if (this.shiftState === this.SHIFT_STATE_ONCE) {
              return popinKeyData.label?.shift?.length > 0;
            } else if (this.shiftState === this.SHIFT_STATE_LOCKED) {
              return popinKeyData.label?.shift?.length > 0;
            }
          } else if (this.currentMode === this.MODE_ALT) {
            if (this.altState === this.ALT_PAGE_ONE) {
              return popinKeyData.label?.alt1?.length > 0;
            } else if (this.altState === this.ALT_PAGE_TWO) {
              return popinKeyData.label?.alt2?.length > 0;
            }
          }
          return false;
        });
    });
    if (!hasKeyToDisplay) return; // abort popin when all popin keys are not displayable

    // Here we know for sure that popin needs to be displayed
    this._currentPopinBaseKey = btn; // set the base key when we are sure poppin will be displayed

    // Create popin
    const popin = document.createElement("div");
    popin.className = "key-popin";
    popin.style.position = "absolute"; // relative to card
    card.style.position = "relative"; // ensure card is anchor

    // Fill popin content, row by row
    popinRows.forEach(rowKeys => {
      const popinRow = document.createElement("div");
      popinRow.className = "key-popin-row";
      
      // Fill row content, key by key
      rowKeys.forEach(popinKeyData => {

        // Determine displayed label on key
        // Note: contrary to keyboard keys, when popin keys don't have a label 
        // for the current combination of currentMode / shiftState / altState,
        // then they do not fallback to normal label: they are simply skipped
        let displayLower = null;
        if (this.currentMode === this.MODE_NORMAL) {
          if (this.shiftState === this.SHIFT_STATE_NORMAL) {
            displayLower = popinKeyData.label.normal;
          } else if (this.shiftState === this.SHIFT_STATE_ONCE) {
            displayLower = popinKeyData.label.shift;
          } else if (this.shiftState === this.SHIFT_STATE_LOCKED) {
            displayLower = popinKeyData.label.shift;
          }
        } else if (this.currentMode === this.MODE_ALT) {
          if (this.altState === this.ALT_PAGE_ONE) {
            displayLower = popinKeyData.label.alt1;
          } else if (this.altState === this.ALT_PAGE_TWO) {
            displayLower = popinKeyData.label.alt2;
          }
        }
        if (!displayLower) return; // When label is missing, skip the whole key
        
        // When label exists: 
        // create and add the popin key (ie popinBtn) into the popin content 
        const popinBtn = document.createElement("button");
        popinBtn.classList.add("key");
        
        if (popinKeyData.width) popinBtn.classList.add(popinKeyData.width);

        popinBtn.dataset.code = popinKeyData.code;

        const lowerLabel = document.createElement("span");
        lowerLabel.className = "label-lower";
        lowerLabel.textContent = popinKeyData.label.normal || "";

        popinBtn.appendChild(lowerLabel);

        popinBtn._lowerLabel = lowerLabel;
        popinBtn._keyData = popinKeyData;

        // Set displayed labels
        popinBtn._lowerLabel.textContent = displayLower;

        // Make same width than base button
        const baseBtnWidth = btn.getBoundingClientRect().width;
        popinBtn.style.width = `${baseBtnWidth}px`;

        // Handle events on button
        popinBtn.addEventListener("pointerenter", () => popinBtn.classList.add("active"));
        popinBtn.addEventListener("pointerleave", () => popinBtn.classList.remove("active"));
        popinBtn.addEventListener("pointerup", (e) => {
          this.handleKeyPress(hass, popinBtn);
          this.handleKeyRelease(hass, popinBtn);
          this.closePopin();
        });

        popinRow.appendChild(popinBtn);
        
        // trigger animation after the element is attached
        requestAnimationFrame(() => {
          popinBtn.classList.add("enter-active");
        });
      });
      popin.appendChild(popinRow);
    });

    this.popin = popin;

    // 1. Add to card and get its bounding box
    card.appendChild(popin);
    const cardRect = card.getBoundingClientRect();
    const popinRect = popin.getBoundingClientRect();

    // 2. Compute initial popin position relative to card
    let left = evt.clientX - cardRect.left - popinRect.width / 2;
    let top = evt.clientY - cardRect.top - popinRect.height - 8; // 8px vertical gap

    // 3. Clamp horizontally (inside card)
    if (left < 0) {
      left = 0;
    } else if (left + popinRect.width > cardRect.width) {
      left = cardRect.width - popinRect.width;
    }

    // 4. Clamp vertically (inside card)
    if (top < 0) {
      // If not enough space above, show below
      top = evt.clientY - cardRect.top + 8;
      // If that too overflows bottom, clamp
      if (top + popinRect.height > cardRect.height) {
        top = cardRect.height - popinRect.height;
      }
    }

    // 5. Apply style
    popin.style.left = `${left}px`;
    popin.style.top = `${top}px`;
    popin.style.position = "absolute";

    popin.style.left = `${left}px`;
    popin.style.top = `${top}px`;

    // Close on pointerup anywhere
    const close = () => this.closePopin();
    document.addEventListener("pointerup", close, { once: true });
  }

  closePopin() {
    //console.log("closePopin");
    if (this.popin && this.popin.parentElement) {
      this.popin.remove();
      this.popin = null;
    }
  }

  updateLabels() {
    for (const btn of this.content.querySelectorAll("button.key")) {
      const keyData = btn._keyData;
      if (!keyData) continue;

      // Pressed key code (keyboard layout independant, later send to remote keyboard)
      const code = keyData.code;

      // Special handling of virtual shift key

      // Determine displayed labels
      let displayLower = "";

      if (this.currentMode === this.MODE_NORMAL) {
        if (this.shiftState === this.SHIFT_STATE_NORMAL) {
          if (code === "MOD_LEFT_SHIFT") btn.classList.remove("active", "locked");
          displayLower = this.getlLabelNormal(keyData);
        } else if (this.shiftState === this.SHIFT_STATE_ONCE) {
          if (code === "MOD_LEFT_SHIFT") btn.classList.add("active");
          displayLower = this.getLabelAlternativeShift(keyData);
        } else if (this.shiftState === this.SHIFT_STATE_LOCKED) {
          if (code === "MOD_LEFT_SHIFT") btn.classList.add("locked");
          displayLower = this.getLabelAlternativeShift(keyData);
        }
      } else if (this.currentMode === this.MODE_ALT) {
        if (code === "MOD_LEFT_SHIFT") btn.classList.remove("active", "locked");
        if (this.altState === this.ALT_PAGE_ONE) {
          displayLower = this.getLabelAlternativeAlt1(keyData);
        } else if (this.altState === this.ALT_PAGE_TWO) {
          displayLower = this.getLabelAlternativeAlt2(keyData);
        }
      }

      if (!displayLower && keyData.fallback) {
        displayLower = keyData.label[keyData.fallback] || "";
      }

      // Set displayed labels
      btn._lowerLabel.textContent = displayLower;
    }
  }

  getlLabelNormal(keyData) {
    return keyData.label.normal;
  }

  getLabelAlternativeShift(keyData) {
    return this.getLabelAlternative(keyData, keyData.label.shift);
  }

  getLabelAlternativeAlt1(keyData) {
    return this.getLabelAlternative(keyData, keyData.label.alt1);
  }

  getLabelAlternativeAlt2(keyData) {
    return this.getLabelAlternative(keyData, keyData.label.alt2);
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
      modifiedLabel = this.getlLabelNormal(keyData);
    }
    return modifiedLabel;
  }

  addGlobalHandlers() {
    window.addEventListener("pointerup", this._handleGlobalPointerUp);
    window.addEventListener("touchend", this._handleGlobalTouchEnd);
    window.addEventListener("mouseleave", this._handleGlobalPointerUp);
    window.addEventListener("touchcancel", this._handleGlobalPointerUp);
    //console.log("handleGlobalPointerUp added");
  }

  removeGlobalHandlers() {
    window.removeEventListener("pointerup", this._handleGlobalPointerUp);
    window.removeEventListener("touchend", this._handleGlobalTouchEnd);
    window.removeEventListener("mouseleave", this._handleGlobalPointerUp);
    window.removeEventListener("touchcancel", this._handleGlobalPointerUp);
    //console.log("handleGlobalPointerUp removed");
  }

  handleGlobalPointerUp(evt) {
    //console.log("handleGlobalPointerUp:", this.content, this._hass);
    if (this.content && this._hass) {
      for (const btn of this.content.querySelectorAll("button.key.active")) {
        this.handleKeyRelease(this._hass, btn);
      }
      
      // close popin if it's open
      if (this.popinElement) {
        this.closePopin();
      }
    }
  }

  handlePointerDown(evt, hass, btn) {
    evt.preventDefault(); // prevent unwanted focus or scrolling

    // reset the poppin base key unconditionally to ensure 
    // it does not stay stuck forever in odd conditions
    this._currentPopinBaseKey = null;

    this.handleKeyPress(hass, btn);
  }

  handlePointerUp(evt, hass, btn) {
    evt.preventDefault();
    if (btn._usedPopin) {
      btn._usedPopin = false;
      return; // Skip base key release
    }
    this.handleKeyRelease(hass, btn);
  }

  handlePointerCancel(evt, hass, btn) {
    evt.preventDefault();
    if (btn._usedPopin) {
      btn._usedPopin = false;
      return; // Skip base key release
    }
    this.handleKeyRelease(hass, btn);
  }

  handleKeyPress(hass, btn) {
    // Mark button active visually
    btn.classList.add("active");

    // Retrieve key data
    const keyData = btn._keyData;
    if (!keyData) return;

    // track the key press to avoid unwanted other key release
    this._currentBaseKey = btn;

    // Pressed key code (keyboard layout independant, later send to remote keyboard)
    const code = keyData.code;

    // Change and retrieve virtual modifiers
    if (this.isVirtualModifier(code)) {
      if (code === "KEY_MODE") {
        // Switch current mode
        if (this.currentMode === this.MODE_NORMAL) {
          this.currentMode = this.MODE_ALT;
          this.altState = this.ALT_PAGE_ONE;
        } else if (this.currentMode === this.MODE_ALT) {
          this.currentMode = this.MODE_NORMAL;
        }
      }
      if (code === "MOD_LEFT_SHIFT") {
        // Normal mode: switch shift state
        if (this.currentMode === this.MODE_NORMAL) {
          if (this.shiftState === this.SHIFT_STATE_NORMAL) {
            this.shiftState = this.SHIFT_STATE_ONCE;
          } else if (this.shiftState === this.SHIFT_STATE_ONCE) {
            this.shiftState = this.SHIFT_STATE_LOCKED;
          } else if (this.shiftState === this.SHIFT_STATE_LOCKED) {
            this.shiftState = this.SHIFT_STATE_NORMAL;
          }
        } else if (this.currentMode === this.MODE_ALT) {
          // Alternative mode: switch alternative page
          if (this.altState === this.ALT_PAGE_ONE) {
            this.altState = this.ALT_PAGE_TWO;
          } else if (this.altState === this.ALT_PAGE_TWO) {
            this.altState = this.ALT_PAGE_ONE;
          }
        }
      }
      
      // Update visual layout with modified virtual modifiers
      this.updateLabels();
      
      // Do not send any key
      return;
    }

    // Pressed key symbol (keyboard layout dependant, for information only)

    // Special key pressed
    if (btn._keyData.special) {
      //console.log("handleKeyPress->special-key-pressed:", code);
      // Release special key press through websockets
      this.appendCode(hass, code);
    }
  }

  handleKeyRelease(hass, btn) {
    const keyData = btn._keyData;
    if (!keyData) return;

    const code = keyData.code;

    // Do not release virtual modifiers
    if (code === "MOD_LEFT_SHIFT") return;

    // Remove active visual for all other keys / states
    btn.classList.remove("active");

    // When the mouse is released over another key than the first pressed key
    if (this._currentBaseKey && this._currentBaseKey._keyData.code !== keyData.code) {
      //console.log("handleKeyRelease->suppressed-key:", keyData.code, "Char:", btn._lowerLabel.textContent || "", "wanted-key:", this._currentBaseKey._keyData.code);
      return; // suppress the unwanted other key release
    }

    // Do not send virtual modifier keys
    if (this.isVirtualModifier(code)) return;

    // Special but not virtual key released
    if (btn._keyData.special) {
      //console.log("handleKeyRelease->special-key-released:", code);
      // Release special key release through websockets
      this.removeCode(hass, code);
    } else {

      // When post-poppin base key release event is handled
      if (this._currentPopinBaseKey && this._currentPopinBaseKey._keyData.code === keyData.code) {
        this._currentPopinBaseKey = null;
        return; // suppress the unwanted base key release
      }
      
      // Non-special and not virtual key clicked
      const charToSend = btn._lowerLabel.textContent || "";
      if (charToSend) {
        //console.log("handleKeyRelease->normal-key-clicked:", code, "Char:", charToSend);
        this.clickChar(hass, code, charToSend);
      }
    }

    // Switch back to normal when "shift-once" was set and a key different from SHIFT was pressed
    if (this.shiftState === this.SHIFT_STATE_ONCE) {
      this.shiftState = this.SHIFT_STATE_NORMAL;
      this.updateLabels();
    }
  }

  // When key code is a virtual modifier key, returns true. Returns false otherwise.
  isVirtualModifier(code) {
    return code === "KEY_MODE" || code === "MOD_LEFT_SHIFT";
  }

  clickChar(hass, code, charToSend) {
    console.log("Key clicked:", code, "Char:", charToSend);
    this.sendKeyboardClick(hass, charToSend);
  }

  appendCode(hass, code) {
    if (code) {
      if (code.startsWith("KEY_") || code.startsWith("MOD_")) {
        this.appendKeyCode(hass, code);
      } else if (code.startsWith("CON_")) {
        this.appendConsumerCode(hass, code);
      } else {
        console.log("appendCode->Unknown code type:", code);
      }
    }
  }

  appendKeyCode(hass, code) {
    console.log("Key pressed:", code);
    if (code) {
      if (this.isVirtualModifier(code)) {
        // Modifier key pressed
        this.pressedModifiers.add(code);
      } else {
        // Standard key pressed
        this.pressedKeys.add(code);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  appendConsumerCode(hass, code) {
    console.log("Consumer pressed:", code);
    if (code) {
      this.pressedConsumers.add(code);
    }
    this.sendConsumerUpdate(hass);
  }

  removeCode(hass, code) {
    if (code) {
      if (code.startsWith("KEY_") || code.startsWith("MOD_")) {
        this.removeKeyCode(hass, code);
      } else if (code.startsWith("CON_")) {
        this.removeConsumerCode(hass, code);
      } else {
        console.log("removeCode->Unknown code type:", code);
      }
    }
  }

  removeKeyCode(hass, code) {
    console.log("Key released:", code);
    if (code) {
      if (this.isVirtualModifier(code)) {
        // Modifier key released
        this.pressedModifiers.delete(code);
      } else {
        // Standard key released
        this.pressedKeys.delete(code);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  removeConsumerCode(hass, code) {
    console.log("Consumer released:", code);
    if (code) {
      this.pressedConsumers.delete(code);
    }
    this.sendConsumerUpdate(hass);
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendKeyboardUpdate(hass) {
    hass.callService("trackpad_mouse", "keypress", {
      sendModifiers: Array.from(this.pressedModifiers),
      sendKeys: Array.from(this.pressedKeys),
    });
  }
  
  // Send all current pressed modifiers and keys to HID keyboard
  sendConsumerUpdate(hass) {
    hass.callService("trackpad_mouse", "conpress", {
      sendCons: Array.from(this.pressedConsumers),
    });
  }

  // Send clicked char symbols to HID keyboard 
  // and let it handle the right key-press combination using current kb layout
  sendKeyboardClick(hass, charToSend) {
    hass.callService("trackpad_mouse", "chartap", {
      sendChars: charToSend,
    });
  }

}

customElements.define("android-keyboard-card", AndroidKeyboardCard);