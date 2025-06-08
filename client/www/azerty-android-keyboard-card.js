console.info("Loading AZERTY Android Keyboard Card");

class AzertyKeyboardCard extends HTMLElement {
  constructor() {
    super();
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

    this.keys = [
      // Row 0
      { code: "KEY_ESC",                 label: { normal: "Échap"        }, special: true },
      { code: "KEY_AC_BACK",             label: { normal: "\u2B8C"       }, special: true, width: "android" }, // ⮌
      { code: "KEY_AC_HOME",             label: { normal: "\u2302"       }, special: true, width: "android" }, // ⌂
      { code: "KEY_ALT_TAB",             label: { normal: "🗗"           }, special: true, width: "android" }, // 🗗 \u1F5D7
      { code: "KEY_COMPOSE",             label: { normal: "\u2699"       }, special: true }, // ⚙
      { code: "CON_SCAN_PREVIOUS_TRACK", label: { normal: "\u23EE"       }, special: true }, // ⏮
      { code: "CON_PLAY_PAUSE",          label: { normal: "\u23EF"       }, special: true }, // ⏯
      { code: "CON_SCAN_NEXT_TRACK",     label: { normal: "\u23ED"       }, special: true }, // ⏭
      { code: "KEY_DELETE",              label: { normal: "Suppr"        }, special: true },
      // Row 1
      { code: "KEY_1", label: { normal: "1" } },
      { code: "KEY_2", label: { normal: "2" } },
      { code: "KEY_3", label: { normal: "3" } },
      { code: "KEY_4", label: { normal: "4" } },
      { code: "KEY_5", label: { normal: "5" } },
      { code: "KEY_6", label: { normal: "6" } },
      { code: "KEY_7", label: { normal: "7" } },
      { code: "KEY_8", label: { normal: "8" } },
      { code: "KEY_9", label: { normal: "9" } },
      { code: "KEY_0", label: { normal: "0" } },
      // Row 2
      { code: "KEY_Q", label: { normal: "a", shift: "A", alt1: "+",      alt2: "`" }  },
      { code: "KEY_W", label: { normal: "z", shift: "Z", alt1: "x",      alt2: "~" }  },
      { code: "KEY_E", label: { normal: "e", shift: "E", alt1: "\u00F7", alt2: "\\" }, 
        popinKeys: [
          { code: "KEY_E_ACUTE", label: { normal: "é" } },
          { code: "KEY_E_GRAVE", label: { normal: "è" } },
          { code: "KEY_E_CIRC",  label: { normal: "ê" } },
          { code: "KEY_E_UMLAUT",label: { normal: "ë" } }
        ]
      }, // ÷
      { code: "KEY_R", label: { normal: "r", shift: "R", alt1: "=",      alt2: "|" }  },
      { code: "KEY_T", label: { normal: "t", shift: "T", alt1: "/",      alt2: "{" }  },
      { code: "KEY_Y", label: { normal: "y", shift: "Y", alt1: "_",      alt2: "}" }  },
      { code: "KEY_U", label: { normal: "u", shift: "U", alt1: "<",      alt2: "$" }  },
      { code: "KEY_I", label: { normal: "i", shift: "I", alt1: ">",      alt2: "£" }  },
      { code: "KEY_O", label: { normal: "o", shift: "O", alt1: "[",      alt2: "¥" }  },
      { code: "KEY_P", label: { normal: "p", shift: "P", alt1: "]",      alt2: "₩" }  },
      // Row 3
      { code: "KEY_A",         label: { normal: "q", shift: "Q", alt1: "!", alt2: "°" } },
      { code: "KEY_S",         label: { normal: "s", shift: "S", alt1: "@", alt2: "•" } },
      { code: "KEY_D",         label: { normal: "d", shift: "D", alt1: "#", alt2: "○" } },
      { code: "KEY_F",         label: { normal: "f", shift: "F", alt1: "€", alt2: "●" } },
      { code: "KEY_G",         label: { normal: "g", shift: "G", alt1: "%", alt2: "□" } },
      { code: "KEY_H",         label: { normal: "h", shift: "H", alt1: "^", alt2: "■" } },
      { code: "KEY_J",         label: { normal: "j", shift: "J", alt1: "&", alt2: "♤" } },
      { code: "KEY_K",         label: { normal: "k", shift: "K", alt1: "*", alt2: "♡" } },
      { code: "KEY_L",         label: { normal: "l", shift: "L", alt1: "(", alt2: "♢" } },
      { code: "KEY_SEMICOLON", label: { normal: "m", shift: "M", alt1: ")", alt2: "♧" } },
      // Row 4
      { code: "MOD_LEFT_SHIFT", label: { normal: "\u21EA", shift: "\u21EA", alt1: "1/2", alt2: "2/2" }, special: true, width: "altkey" }, // ⇪
      { code: "KEY_Z",          label: { normal: "w",      shift: "W",      alt1: "-",  alt2: "☆" } },
      { code: "KEY_X",          label: { normal: "x",      shift: "X",      alt1: "'",  alt2: "▪" } },
      { code: "KEY_C",          label: { normal: "c",      shift: "C",      alt1: "\"", alt2: "¤" } },
      { code: "KEY_V",          label: { normal: "v",      shift: "V",      alt1: ":",  alt2: "⟪" } },
      { code: "KEY_B",          label: { normal: "b",      shift: "B",      alt1: ";",  alt2: "⟫" } },
      { code: "KEY_N",          label: { normal: "n",      shift: "N",      alt1: ",",  alt2: "¡" } },
      { code: "KEY_4",          label: { normal: "\u2018", shift: "\u2019", alt1: "?",  alt2: "¿" } }, // "\u2018" = left, "\u2019" = right
      { code: "KEY_BACKSPACE",  label: { normal: "\u232B" }, special: true, width: "altkey" }, // ⌫
      // Row 5
      { code: "KEY_MODE",       label: { normal: "!#1", shift: "!#1", alt1: "ABC", alt2: "ABC" }, special: true, width: "altkey" },
      { code: "KEY_M",          label: { normal: "," } },
      { code: "KEY_SPACE",      label: { normal: " " }, width: "spacebar" },
      { code: "KEY_COMMA",      label: { normal: "." } },
      { code: "KEY_ENTER",      label: { normal: "Entrée" }, special: true, width: "altkey" },
    ];

    // To track pressed modifiers and keys
    this.pressedModifiers = new Set();
    this.pressedKeys = new Set();

    // Handle out of bounds mouse releases
    this._lastHass = null;
    this._handleGlobalPointerUp = this.handleGlobalPointerUp.bind(this);
    this._handleGlobalTouchEnd = this.handleGlobalPointerUp.bind(this); // reuse same logic
  }

  handleGlobalPointerUp(evt) {
    //console.log("handleGlobalPointerUp:", this.content, this._lastHass);
    if (this.content && this._lastHass) {
      for (const btn of this.content.querySelectorAll("button.key.active")) {
        this.handleKeyRelease(this._lastHass, btn);
      }

      // Also close popin if it's open
      if (this.popinElement) {
        this.closePopin();
      }
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

  set hass(hass) {
    console.log("AZERTY Android Keyboard hass received:", hass);
    if (!this.content) {
      
      // Re-add global handlers to ensure proper out-of-bound handling
      this.removeGlobalHandlers();
      this._lastHass = hass;
      this.addGlobalHandlers();
      
      const card = document.createElement("ha-card");
      card.header = "AZERTY Android Keyboard";
      
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
        ha-card {
          position: relative;
        }
      `;


      this.appendChild(style);
      
      const container = document.createElement("div");
      container.className = "keyboard-container";
      
      // Define number of keys per row
      const rowsConfig = [9, 10, 10, 10, 9, 5];
      let keyIndex = 0;

      rowsConfig.forEach((rowCount) => {
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

          // Add pointer and touch events:
          // btn.addEventListener("pointerdown", (e) => this.handlePointerDown(e, hass, btn));
          btn.addEventListener("pointerdown", (e) => {
            this.handlePointerDown(e, hass, btn);
          
            // Long press timer (only for non-special keys)
            if (!btn._keyData.special) {
              console.log("pointerdown->!btn._keyData.special");
              this.popinTimeout = setTimeout(() => {
                this.showPopin(e, hass, card, btn);
              }, 500); // 500ms long-press duration
            }
          });

          btn.addEventListener("pointerup", (e) => {
            this.handlePointerUp(e, hass, btn);
            clearTimeout(this.popinTimeout);
            console.log("pointerup->clearTimeout");
          });
          btn.addEventListener("pointercancel", (e) => {
            this.handlePointerCancel(e, hass, btn);
            clearTimeout(this.popinTimeout);
            console.log("pointercancel->clearTimeout");
          });
          // For older touch devices fallback
          btn.addEventListener("touchend", (e) => {
            this.handlePointerUp(e, hass, btn);
            clearTimeout(this.popinTimeout);
            console.log("touchend->clearTimeout");
          });
          btn.addEventListener("touchcancel", (e) => {
            this.handlePointerCancel(e, hass, btn);
            clearTimeout(this.popinTimeout);
            console.log("touchcancel->clearTimeout");
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
  }

  showPopin(evt, hass, card, btn) {
    console.log("showPopin:", btn);
    if (this.popin) this.closePopin();

    // Retrieve key data
    const keyData = btn._keyData;
    if (!keyData) return;

    const popinKeys = keyData.popinKeys;
    if (!popinKeys) return;

    const popin = document.createElement("div");
    popin.className = "key-popin";
    popin.style.position = "absolute"; // relative to card
    card.style.position = "relative"; // ensure card is anchor

    // Normalize popinKeys to always be an array of arrays
    const popinRows = Array.isArray(popinKeys[0]) ? popinKeys : [popinKeys];

    popinRows.forEach(rowKeys => {
      const popinRow = document.createElement("div");
      popinRow.className = "key-popin-row";
      rowKeys.forEach(popinKeyData => {
        const popinBtn = document.createElement("button");
        popinBtn.classList.add("key");
        
        if (popinKeyData.width) popinBtn.classList.add(popinKeyData.width);

        popinBtn.dataset.code = popinKeyData.code;

        const lowerLabel = document.createElement("span");
        lowerLabel.className = "label-lower";
        lowerLabel.textContent = popinKeyData.label.normal || "";

        popinBtn.appendChild(lowerLabel);

        popinBtn._lowerLabel = lowerLabel;
        popinBtn._keyData = keyData;

        // Here is the important part:
        const baseBtnWidth = btn.getBoundingClientRect().width;
        popinBtn.style.width = `${baseBtnWidth}px`;

        popinBtn.addEventListener("pointerenter", () => popinBtn.classList.add("active"));
        popinBtn.addEventListener("pointerleave", () => popinBtn.classList.remove("active"));
        popinBtn.addEventListener("pointerup", (e) => {
          this.handleKeyPress(hass, popinBtn);
          this.handleKeyRelease(hass, popinBtn);
          this.closePopin();
        });

        popinRow.appendChild(popinBtn);
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
    console.log("closePopin");
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
      
      if (!displayLower) {
        displayLower = this.getlLabelNormal(keyData) || "";
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
      // resetCode();
      return;
    }

    // Pressed key symbol (keyboard layout dependant, for information only)
    const charToSend = btn._lowerLabel.textContent || "";

    // Send keyboard changes
    // this.appendCode(hass, code, charToSend);
  }

  handleKeyRelease(hass, btn) {
    const keyData = btn._keyData;
    if (!keyData) return;

    const code = keyData.code;

    // Do not release virtual modifiers
    if (code === "MOD_LEFT_SHIFT") return;

    // Remove active visual for all other keys / states
    btn.classList.remove("active");
    
    // Switch back to normal when "shift-once" was set and a key different from SHIFT was pressed
    if (this.shiftState === this.SHIFT_STATE_ONCE) {
      this.shiftState = this.SHIFT_STATE_NORMAL;
      this.updateLabels();
    }

    // Release modifier or key through websockets
    // this.removeCode(hass, code);
  }

  // When key code is a virtual modifier key, returns true. Returns false otherwise.
  isVirtualModifier(code) {
    return code === "KEY_MODE" || code === "MOD_LEFT_SHIFT";
  }

  resetCode(hass) {
    console.log("Keyboard reset:");
    this.pressedModifiers.clear();
    this.pressedKeys.clear();
    this.sendKeyboardUpdate(hass);
  }

  appendCode(hass, code, charToSend) {
    console.log("Key pressed:", code, "Char:", charToSend);
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

  removeCode(hass, code) {
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

  // Send all current pressed modifiers and keys to HID keyboard
  sendKeyboardUpdate(hass) {
    hass.callService("trackpad_mouse", "keypress", {
      sendModifiers: Array.from(this.pressedModifiers),
      sendKeys: Array.from(this.pressedKeys),
    });
  }

  setConfig(config) {}
  getCardSize() {
    return 3;
  }
}

customElements.define("azerty-android-keyboard-card", AzertyKeyboardCard);