console.info("Loading AZERTY Keyboard Card");

class AzertyKeyboardCard extends HTMLElement {
  constructor() {
    super();
    this.capsLock = false;
    this.shift = false;
    this.ctrl = false;
    this.gui = false;
    this.alt = false;
    this.altGr = false;
    this.keys = [
      // Row 0
      { code: "KEY_ESC", label: { normal: "Échap" }, special: true, width: "wide" },
      { code: "KEY_F1", label: { normal: "F1" }, special: true },
      { code: "KEY_F2", label: { normal: "F2" }, special: true },
      { code: "KEY_F3", label: { normal: "F3" }, special: true },
      { code: "KEY_F4", label: { normal: "F4" }, special: true },
      { code: "KEY_F5", label: { normal: "F5" }, special: true },
      { code: "KEY_F6", label: { normal: "F6" }, special: true },
      { code: "KEY_F7", label: { normal: "F7" }, special: true },
      { code: "KEY_F8", label: { normal: "F8" }, special: true },
      { code: "KEY_F9", label: { normal: "F9" }, special: true },
      { code: "KEY_F10", label: { normal: "F10" }, special: true },
      { code: "KEY_F11", label: { normal: "F11" }, special: true },
      { code: "KEY_F12", label: { normal: "F12" }, special: true },
      { code: "KEY_SYNC", label: { normal: "\u21BB" }, special: true }, // ↻
      // Row 1
      { code: "KEY_GRAVE", label: { normal: "²", shift: "", altGr: "" }, special: true },
      { code: "KEY_1", label: { normal: "&", shift: "1", altGr: "" } },
      { code: "KEY_2", label: { normal: "é", shift: "2", altGr: "~" } },
      { code: "KEY_3", label: { normal: "\"", shift: "3", altGr: "#" } },
      { code: "KEY_4", label: { normal: "'", shift: "4", altGr: "{" } },
      { code: "KEY_5", label: { normal: "(", shift: "5", altGr: "[" } },
      { code: "KEY_6", label: { normal: "-", shift: "6", altGr: "|" } },
      { code: "KEY_7", label: { normal: "è", shift: "7", altGr: "`" } },
      { code: "KEY_8", label: { normal: "_", shift: "8", altGr: "\\" } },
      { code: "KEY_9", label: { normal: "ç", shift: "9", altGr: "^" } },
      { code: "KEY_0", label: { normal: "à", shift: "0", altGr: "@" } },
      { code: "KEY_MINUS", label: { normal: ")", shift: "°", altGr: "]" } },
      { code: "KEY_EQUAL", label: { normal: "=", shift: "+", altGr: "}" } },
      { code: "KEY_BACKSPACE", label: { normal: "\u232B" }, special: true, width: "wider" }, // ⌫
      // Row 2
      { code: "KEY_TAB", label: { normal: "\u21B9" }, special: true, width: "wide" }, // ↹
      { code: "KEY_Q", label: { normal: "a", shift: "A" } },
      { code: "KEY_W", label: { normal: "z", shift: "Z" } },
      { code: "KEY_E", label: { normal: "e", shift: "E", altGr: "€" } },
      { code: "KEY_R", label: { normal: "r", shift: "R" } },
      { code: "KEY_T", label: { normal: "t", shift: "T" } },
      { code: "KEY_Y", label: { normal: "y", shift: "Y" } },
      { code: "KEY_U", label: { normal: "u", shift: "U" } },
      { code: "KEY_I", label: { normal: "i", shift: "I" } },
      { code: "KEY_O", label: { normal: "o", shift: "O" } },
      { code: "KEY_P", label: { normal: "p", shift: "P" } },
      { code: "KEY_LEFTBRACE", label: { normal: "^", shift: "¨" } },
      { code: "KEY_RIGHTBRACE", label: { normal: "$", shift: "£" } },
      { code: "KEY_ENTER", label: { normal: "Entrée" }, special: true, width: "wider" },
      // Row 3
      { code: "KEY_CAPSLOCK", label: { normal: "\uD83D\uDD12" }, special: true, width: "wider" }, // 🔒
      { code: "KEY_A", label: { normal: "q", shift: "Q" } },
      { code: "KEY_S", label: { normal: "s", shift: "S" } },
      { code: "KEY_D", label: { normal: "d", shift: "D" } },
      { code: "KEY_F", label: { normal: "f", shift: "F" } },
      { code: "KEY_G", label: { normal: "g", shift: "G" } },
      { code: "KEY_H", label: { normal: "h", shift: "H" } },
      { code: "KEY_J", label: { normal: "j", shift: "J" } },
      { code: "KEY_K", label: { normal: "k", shift: "K" } },
      { code: "KEY_L", label: { normal: "l", shift: "L" } },
      { code: "KEY_SEMICOLON", label: { normal: "m", shift: "M" } },
      { code: "KEY_APOSTROPHE", label: { normal: "ù", shift: "%" } },
      { code: "KEY_HASHTILDE", label: { normal: "*", shift: "µ" } },
      // Row 4
      { code: "MOD_LEFT_SHIFT", label: { normal: "\u21EA" }, special: true, width: "wider" }, // ⇪
      { code: "KEY_102ND", label: { normal: "<", shift: ">" } },
      { code: "KEY_Z", label: { normal: "w", shift: "W" } },
      { code: "KEY_X", label: { normal: "x", shift: "X" } },
      { code: "KEY_C", label: { normal: "c", shift: "C" } },
      { code: "KEY_V", label: { normal: "v", shift: "V" } },
      { code: "KEY_B", label: { normal: "b", shift: "B" } },
      { code: "KEY_N", label: { normal: "n", shift: "N" } },
      { code: "KEY_M", label: { normal: ",", shift: "?" } },
      { code: "KEY_COMMA", label: { normal: ";", shift: "." } },
      { code: "KEY_DOT", label: { normal: ":", shift: "/" } },
      { code: "KEY_SLASH", label: { normal: "!", shift: "§" } },
      { code: "MOD_RIGHT_SHIFT", label: { normal: "\u21EA" }, special: true, width: "wider" }, // ⇪
      // Row 5
      { code: "MOD_LEFT_CONTROL", label: { normal: "Ctrl" }, special: true },
      { code: "MOD_LEFT_GUI", label: { normal: "\u229E" }, special: true },
      { code: "MOD_LEFT_ALT", label: { normal: "Alt" }, special: true },
      { code: "KEY_SPACE", label: { normal: " " }, special: true, width: "wider" },
      { code: "MOD_RIGHT_ALT", label: { normal: "AltGr" }, special: true },
      { code: "MOD_RIGHT_GUI", label: { normal: "\u229E" }, special: true },
      { code: "KEY_PROPS", label: { normal: "\u2630" }, special: true },
      { code: "MOD_RIGHT_CONTROL", label: { normal: "Ctrl" }, special: true },
    ];

    // To track pressed modifiers and keys
    this.pressedModifiers = new Set();
    this.pressedKeys = new Set();
  }

  set hass(hass) {
    console.log("AZERTY Keyboard hass received:", hass);
    if (!this.content) {
      const card = document.createElement("ha-card");
      card.header = "AZERTY Keyboard";
      
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
      
      // Define number of keys per row
      const rowsConfig = [14, 14, 14, 13, 13, 8];
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
      this.appendChild(card);
      
      this.content = container;
      this.updateLabels();

      // Initial synchronization to retrieve remote keyboard state
      this.syncKeyboard(hass);
    }
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
        displayLower = this.getlLabelNormal(keyData) || "";
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
      modifiedLabel = this.getlLabelNormal(keyData);
    }
    return modifiedLabel;
  }

  getLabelAlternativeAltGr(keyData) {
    return this.getLabelAlternative(keyData, this.getlLabelAltGr(keyData));
  }

  getLabelAlternativeShift(keyData) {
    return this.getLabelAlternative(keyData, this.getlLabelShift(keyData));
  }

  getlLabelNormal(keyData) {
    return keyData.label.normal;
  }

  getlLabelAltGr(keyData) {
    return keyData.label.altGr;
  }

  getlLabelShift(keyData) {
    return keyData.label.shift;
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
    hass.callService("trackpad_mouse", "keypress", {
      sendModifiers: Array.from(this.pressedModifiers),
      sendKeys: Array.from(this.pressedKeys),
    });
  }

  // Synchronize with remote keyboard current state through HA websockets API
  syncKeyboard(hass) {
    hass.connection.sendMessagePromise({
      type: "trackpad_mouse/sync_keyboard"
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

  setConfig(config) {}
  getCardSize() {
    return 3;
  }
}

customElements.define("azerty-keyboard-card", AzertyKeyboardCard);