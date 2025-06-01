console.info("Loading AZERTY Keyboard Card");

class AzertyKeyboardCard extends HTMLElement {
  constructor() {
    super();
    this.shift = false;
    this.capsLock = false;
    this.altGr = false;
    this.keys = [
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
      { code: "KEY_ENTER", label: { normal: "Enter" }, special: true, width: "wider" },
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
      { code: "KEY_BACKSLASH", label: { normal: "<", shift: ">" } },
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
      { code: "MOD_LEFT_CONTROL", label: { normal: "Ctrl" }, special: true, width: "wide" },
      { code: "MOD_LEFT_GUI", label: { normal: "\u229E" }, special: true, width: "wide" },
      { code: "MOD_LEFT_ALT", label: { normal: "Alt" }, special: true, width: "wide" },
      { code: "KEY_SPACE", label: { normal: " " }, special: true, width: "wider" },
      { code: "MOD_RIGHT_ALT", label: { normal: "AltGr" }, special: true, width: "wide" },
      { code: "MOD_RIGHT_GUI", label: { normal: "\u229E" }, special: true, width: "wide" },
      { code: "KEY_PROPS", label: { normal: "\u2630" }, special: true, width: "wide" },
      { code: "MOD_RIGHT_CONTROL", label: { normal: "Ctrl" }, special: true, width: "wide" },
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
          font-size: 1.1rem; /* Uniform font size for all keys */
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
      
        button.key.active {
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
      const rowsConfig = [14, 14, 13, 13, 8];
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
          if (keyData.label.shift && keyData.label.shift !== "") {
            upperLabel.textContent = keyData.label.shift;
          } else if (keyData.label.altGr && keyData.label.altGr !== "") {
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
    }
  }

  updateLabels() {
    for (const btn of this.content.querySelectorAll("button.key")) {
      const keyData = btn._keyData;
      if (!keyData) continue;

      if (keyData.code === "MOD_LEFT_SHIFT" || keyData.code === "MOD_RIGHT_SHIFT") {
        btn.classList.toggle("active", this.shift);
      }
      if (keyData.code === "KEY_CAPSLOCK") {
        btn.classList.toggle("active", this.capsLock);
      }
      if (keyData.code === "MOD_RIGHT_ALT") {
        btn.classList.toggle("active", this.altGr);
      }

      if (keyData.special) continue;

      let displayLower = keyData.label.normal || "";
      let displayUpper = "";

      if (this.altGr && keyData.label.altGr && keyData.label.altGr !== "") {
        displayLower = keyData.label.altGr;
      } else {
        let useShift = this.shift;
        if (this.capsLock && keyData.label.normal.match(/^[a-z]$/i)) {
          useShift = !useShift;
        }

        if (useShift && keyData.label.shift && keyData.label.shift !== "") {
          displayLower = keyData.label.shift;
        } else {
          displayLower = keyData.label.normal;
        }
      }

      btn._lowerLabel.textContent = displayLower;
      btn._upperLabel.textContent = displayUpper;
    }
  }

  handlePointerDown(event, hass, button) {
    event.preventDefault(); // prevent unwanted focus or scrolling
    // Mark button active visually
    button.classList.add("active");
    this.handleKeyPress(hass, button);
  }

  handlePointerUp(event, hass, button) {
    event.preventDefault();
    // Remove active visual
    button.classList.remove("active");
    this.handleKeyRelease(hass, button);
  }

  handlePointerCancel(event, hass, button) {
    event.preventDefault();
    button.classList.remove("active");
    this.handleKeyRelease(hass, button);
  }

  handleKeyPress(hass, button) {
    const code = button.dataset.code;
    let charToSend = null;
    
    if (code === "MOD_LEFT_SHIFT" || code === "MOD_RIGHT_SHIFT") {
      this.shift = !this.shift;
      this.updateLabels();
      this.appendCode(hass, code, charToSend);
      return;
    }
    if (code === "KEY_CAPSLOCK") {
      this.capsLock = !this.capsLock;
      this.updateLabels();
      this.appendCode(hass, code, charToSend);
      return;
    }
    if (code === "MOD_RIGHT_ALT") {
      this.altGr = !this.altGr;
      this.updateLabels();
      this.appendCode(hass, code, charToSend);
      return;
    }
    
    const keyData = button._keyData;
    if (!keyData) return;

    if (keyData.special) {
      charToSend = null;
    } else {
      if (this.altGr && keyData.label.altGr && keyData.label.altGr !== "") {
        charToSend = keyData.label.altGr;
      } else {
        let useShift = this.shift;
        if (this.capsLock && keyData.label.normal.match(/^[a-z]$/i)) {
          useShift = !useShift;
        }

        if (useShift && keyData.label.shift && keyData.label.shift !== "") {
          charToSend = keyData.label.shift;
        } else {
          charToSend = keyData.label.normal;
        }
      }
    }
    this.appendCode(hass, code, charToSend);
  }

  handleKeyRelease(hass, button) {
    const code = button.dataset.code;

    if (code === "MOD_LEFT_SHIFT" || code === "MOD_RIGHT_SHIFT") {
      if (this.shift) return; // Do not release shift when explicitly active
    }
    if (code === "KEY_CAPSLOCK") {
      if (this.capsLock) return; // Do not release KEY_CAPSLOCK when explicitly active
    }
    if (code === "MOD_RIGHT_ALT") {
      if (this.altGr) return; // Do not release KEY_CAPSLOCK when explicitly active
    }
    
    this.removeCode(hass, code);
  }

  appendCode(hass, code, charToSend) {
    console.log("Key pressed:", code, "Char:", charToSend);
    if (code) {
      if (code.startsWith("MOD_")) {
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
      if (code.startsWith("MOD_")) {
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

customElements.define("azerty-keyboard-card", AzertyKeyboardCard);