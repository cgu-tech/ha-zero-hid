console.info("Loading AZERTY Keyboard Card");

(() => {
  class AzertyKeyboardCard extends HTMLElement {
    constructor() {
      super();
      this.shift = false;
      this.capsLock = false;
      this.altGr = false;

      this.keys = [
        // Row 1
        { code: "Backquote", label: { normal: "²", shift: "", altGr: "" }, special: true },
        { code: "Digit1", label: { normal: "&", shift: "1", altGr: "" } },
        { code: "Digit2", label: { normal: "é", shift: "2", altGr: "~" } },
        { code: "Digit3", label: { normal: "\"", shift: "3", altGr: "#" } },
        { code: "Digit4", label: { normal: "'", shift: "4", altGr: "{" } },
        { code: "Digit5", label: { normal: "(", shift: "5", altGr: "[" } },
        { code: "Digit6", label: { normal: "-", shift: "6", altGr: "|" } },
        { code: "Digit7", label: { normal: "è", shift: "7", altGr: "`" } },
        { code: "Digit8", label: { normal: "_", shift: "8", altGr: "\\" } },
        { code: "Digit9", label: { normal: "ç", shift: "9", altGr: "^" } },
        { code: "Digit0", label: { normal: "à", shift: "0", altGr: "@" } },
        { code: "Minus", label: { normal: ")", shift: "°", altGr: "]" } },
        { code: "Equal", label: { normal: "=", shift: "+", altGr: "}" } },
        { code: "Backspace", label: { normal: "Backspace" }, special: true, width: "wider" },

        // Row 2
        { code: "Tab", label: { normal: "Tab" }, special: true, width: "wide" },
        { code: "KeyA", label: { normal: "a", shift: "A" } },
        { code: "KeyZ", label: { normal: "z", shift: "Z" } },
        { code: "KeyE", label: { normal: "e", shift: "E", altGr: "€" } },
        { code: "KeyR", label: { normal: "r", shift: "R" } },
        { code: "KeyT", label: { normal: "t", shift: "T" } },
        { code: "KeyY", label: { normal: "y", shift: "Y" } },
        { code: "KeyU", label: { normal: "u", shift: "U" } },
        { code: "KeyI", label: { normal: "i", shift: "I" } },
        { code: "KeyO", label: { normal: "o", shift: "O" } },
        { code: "KeyP", label: { normal: "p", shift: "P" } },
        { code: "BracketLeft", label: { normal: "^", shift: "¨" } },
        { code: "BracketRight", label: { normal: "$", shift: "£" } },
        { code: "Enter", label: { normal: "Enter" }, special: true, width: "wider" },

        // Row 3
        { code: "CapsLock", label: { normal: "CapsLock" }, special: true, width: "wider" },
        { code: "KeyQ", label: { normal: "q", shift: "Q" } },
        { code: "KeyS", label: { normal: "s", shift: "S" } },
        { code: "KeyD", label: { normal: "d", shift: "D" } },
        { code: "KeyF", label: { normal: "f", shift: "F" } },
        { code: "KeyG", label: { normal: "g", shift: "G" } },
        { code: "KeyH", label: { normal: "h", shift: "H" } },
        { code: "KeyJ", label: { normal: "j", shift: "J" } },
        { code: "KeyK", label: { normal: "k", shift: "K" } },
        { code: "KeyL", label: { normal: "l", shift: "L" } },
        { code: "KeyM", label: { normal: "m", shift: "M" } },
        { code: "Dead", label: { normal: "ù", shift: "%" } },
        { code: "Backslash", label: { normal: "*", shift: "µ" } },

        // Row 4
        { code: "ShiftLeft", label: { normal: "Shift" }, special: true, width: "wider" },
        { code: "IntlBackslash", label: { normal: "<", shift: ">" } },
        { code: "KeyW", label: { normal: "w", shift: "W" } },
        { code: "KeyX", label: { normal: "x", shift: "X" } },
        { code: "KeyC", label: { normal: "c", shift: "C" } },
        { code: "KeyV", label: { normal: "v", shift: "V" } },
        { code: "KeyB", label: { normal: "b", shift: "B" } },
        { code: "KeyN", label: { normal: "n", shift: "N" } },
        { code: "Comma", label: { normal: ",", shift: "?" } },
        { code: "Semicolon", label: { normal: ";", shift: "." } },
        { code: "Colon", label: { normal: ":", shift: "/" } },
        { code: "Exclam", label: { normal: "!", shift: "§" } },
        { code: "ShiftRight", label: { normal: "Shift" }, special: true, width: "wider" },

        // Row 5
        { code: "ControlLeft", label: { normal: "Ctrl" }, special: true, width: "wide" },
        { code: "MetaLeft", label: { normal: "Win" }, special: true, width: "wide" },
        { code: "AltLeft", label: { normal: "Alt" }, special: true, width: "wide" },
        { code: "Space", label: { normal: " " }, special: true, width: "space" },
        { code: "AltRight", label: { normal: "AltGr" }, special: true, width: "wide" },
        { code: "MetaRight", label: { normal: "Win" }, special: true, width: "wide" },
        { code: "ContextMenu", label: { normal: "Menu" }, special: true, width: "wide" },
        { code: "ControlRight", label: { normal: "Ctrl" }, special: true, width: "wide" },
      ];
    }

    set hass(hass) {
      if (this.content) return;

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
          --key-width-normal: 40px;
          --key-height: 45px;
          --key-margin: 3px;
          user-select: none;
          display: inline-block;       /* changed from block */
          min-width: max-content;      /* fit content width */
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .keyboard-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 5px 15px 5px;
          background: #1a1a1a;
          border-radius: 8px;
          margin: auto;
          box-sizing: border-box;
          user-select: none;
          width: max-content;          /* size container to content */
          /* max-width removed */
        }
        
        .keyboard-row {
          display: flex;
          margin-bottom: 6px;
          width: 100%;
          justify-content: space-between;
          gap: 6px;
        }
        
        button.key {
          background: var(--key-bg);
          border: none;
          border-radius: 5px;
          color: #eee;
          font-size: 14px;
          cursor: pointer;
          height: var(--key-height);
          min-width: var(--key-width-normal);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-sizing: border-box;
          transition: background 0.15s ease;
          user-select: none;
          padding: 0 6px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        
        button.key.wide,
        button.key.wider,
        button.key.space {
          flex-grow: 1;
          min-width: 0;
        }
        
        button.key.space {
          flex-grow: 2;
        }
        
        button.key.special {
          background: var(--key-special-bg);
          color: var(--key-special-color);
          font-weight: 600;
          font-size: 13px;
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
          top: 4px;
          right: 6px;
          font-size: 10px;
          opacity: 0.7;
          user-select: none;
        }
        
        .label-lower {
          font-size: 18px;
          font-weight: 500;
          user-select: none;
        }
      `;
      this.appendChild(style);

      const container = document.createElement("div");
      container.className = "keyboard-container";

      // Rows config for splitting keys array
      const rowsConfig = [14, 14, 13, 13, 8];
      let keyIndex = 0;

      rowsConfig.forEach(rowCount => {
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

          btn.addEventListener("click", (e) => this.handleKeyClick(e, btn));

          row.appendChild(btn);
        }

        container.appendChild(row);
      });

      card.appendChild(container);
      this.appendChild(card);

      this.content = container;
      this.updateLabels();
      this.hass = hass;
    }

    updateLabels() {
      for (const btn of this.content.querySelectorAll("button.key")) {
        const keyData = btn._keyData;

        if (!keyData) continue;

        // Update active states for modifier keys
        if (keyData.code === "ShiftLeft" || keyData.code === "ShiftRight") {
          btn.classList.toggle("active", this.shift);
        }
        if (keyData.code === "CapsLock") {
          btn.classList.toggle("active", this.capsLock);
        }
        if (keyData.code === "AltRight") {
          btn.classList.toggle("active", this.altGr);
        }

        if (keyData.special) continue; // special keys label unchanged

        // Determine displayed character based on modifiers
        let displayLower = keyData.label.normal || "";
        let displayUpper = "";

        if (this.altGr && keyData.label.altGr && keyData.label.altGr !== "") {
          // AltGr overrides Shift and CapsLock
          displayLower = keyData.label.altGr;
          displayUpper = "";
        } else {
          // CapsLock toggles case on letters only, combined with Shift
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

    handleKeyClick(e, button) {
      const code = button.dataset.code;

      if (code === "ShiftLeft" || code === "ShiftRight") {
        this.shift = !this.shift;
        this.updateLabels();
        return;
      }
      if (code === "CapsLock") {
        this.capsLock = !this.capsLock;
        this.updateLabels();
        return;
      }
      if (code === "AltRight") {
        this.altGr = !this.altGr;
        this.updateLabels();
        return;
      }

      const keyData = button._keyData;

      if (!keyData) return;

      let charToSend = null;

      if (keyData.special) {
        // Special keys - send code as command or handle accordingly
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

      console.log("Key pressed:", code, "Char:", charToSend);

      if (this.hass && this.hass.callService) {
        if (charToSend !== null) {
          this.hass.callService("keyboard", "type", { character: charToSend });
        } else {
          // For special keys send code, example:
          this.hass.callService("keyboard", "key_press", { code });
        }
      }
    }

    setConfig(config) {}
    getCardSize() {
      return 3;
    }
  }
  customElements.define("azerty-keyboard-card", AzertyKeyboardCard);
})();
