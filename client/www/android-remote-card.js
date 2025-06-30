console.info("Loading Android Remote Card");

class AndroidRemoteCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" }); // Create shadow root
    
    this._hass = null;
    this._uiBuilt = false;
    this.card = null;
    
    // when not user configured, fallback to default 
    // international language and keyboard layout
    this.language = "FR";
    this.layoutUrl = `/local/layouts/android/${this.language}-remote.json`;

    this.remoteButtons = [
      { id: "remote-power-button",          code: "CON_POWER"               },
      { id: "remote-arrow-up-button",       code: "KEY_UP"                  },
      { id: "remote-arrow-right-button",    code: "KEY_RIGHT"               },
      { id: "remote-arrow-down-button",     code: "KEY_DOWN"                },
      { id: "remote-arrow-left-button",     code: "KEY_LEFT"                },
      { id: "remote-ok-button",             code: "KEY_ENTER"               },
      { id: "remote-return-button",         code: "CON_AC_BACK"             },
      { id: "remote-home-button",           code: "CON_AC_HOME"             },
      { id: "remote-backspace-button",      code: "KEY_BACKSPACE"           },
      { id: "remote-settings-button",       code: "KEY_COMPOSE"             },
      { id: "remote-volume-down-button",    code: "CON_VOLUME_DECREMENT"    },
      { id: "remote-previous-track-button", code: "CON_SCAN_PREVIOUS_TRACK" },
      { id: "remote-play-pause-button",     code: "CON_PLAY_PAUSE"          },
      { id: "remote-next-track-button",     code: "CON_SCAN_NEXT_TRACK"     },
      { id: "remote-volume-up-button",      code: "CON_VOLUME_INCREMENT"    }
    ]

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
    
    // Retrieve user configured language
    if (config.language) {
      this.language = config.language;
    }
    
    // Retrieve user configured layout
    if (config.layoutUrl) {
      this.layoutUrl = config.layoutUrl;
    }
  }
  
  getCardSize() {
    return 5;
  }

  async connectedCallback() {
    console.log("Android Remote - connectedCallback");

    // Only build UI if hass is already set
    if (this._hass) {
      this.buildUi(this._hass);
    }
  }

  set hass(hass) {
    console.log("Android Remote - set hass():", hass);
    this._hass = hass;
    if (!this._uiBuilt) {
      this.buildUi(this._hass);
    }
  }

  buildUi(hass) {
    if (this._uiBuilt) {
      console.log("Android Remote - buildUi() SKIPPED");
      return;
    }
    console.log("Android Remote - buildUi() ENTER");

    // Clear existing content (if any)
    if (this._uiBuilt) return;
    this.shadowRoot.innerHTML = '';

    this._uiBuilt = true;

    // Re-add global handlers to ensure proper out-of-bound handling
    this.removeGlobalHandlers();
    this.addGlobalHandlers();

    const card = document.createElement("ha-card");
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
      }
      
      .remote-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      /* Flex containers */
      .circular-buttons, .circular-buttons-center, .bottom-buttons {
        display: flex;
        align-items: stretch;    /* stretch children vertically */
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
      }

      /* D‑pad SVG scales as square */
      .circular-buttons-center svg {
        flex: 1 1 0;
        aspect-ratio: 1 / 1;
        max-width: 100%;
      }

      /* Circle buttons scale proportionally */
      .circle-button {
        flex: 1 1 0;
        aspect-ratio: 1 / 1;
        background-color: #3a3a3a;
        color: #bfbfbf;
        border: none;
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        transition: background-color 0.2s ease, transform 0.1s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;   /* This makes the button circular */
      }
      .circle-button:hover { background-color: #4a4a4a; }
      .circle-button:active,
      .circle-button.pressed { transform: scale(0.95); }

      #remote-power-button {
        flex: 1;          /* 1/5 of space */
        min-width: 0;
        text-align: center;
      }
            
      #remote-power-filler {
        flex: 4;          /* 4/5 of space */
        height: 100%;     /* fill vertically */
        /* optionally background-color: transparent; */
      }
      
      /* Side buttons scale with flex-ratio ~200 width vs 70px baseline */
      .side-button {
        flex: 20 1 0;
        aspect-ratio: 200 / 60;
        background-color: #3a3a3a;
        cursor: pointer;
        transition: background-color 0.2s ease, transform 0.1s ease;
        border: none;
        font-family: sans-serif;
        color: #bfbfbf;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
      }
      .side-button.left {
        border-top-left-radius: 999px;
        border-bottom-left-radius: 999px;
      }
      .side-button.right {
        border-top-right-radius: 999px;
        border-bottom-right-radius: 999px;
      }
      .side-button:hover { background-color: #4a4a4a; }
      .side-button:active,
      .side-button.pressed { transform: scale(0.95); }

      #ts-toggle-threeStateToggle {
        flex: 3.4;          /* 3/5 of space */
        min-width: 0;
        text-align: center;
        height: 100%;          /* Fill parent's height */
        display: flex;         /* If you want inner content to align well */
        align-items: center;
      }

      .ts-toggle-container {
        flex: 1 1 0;
        aspect-ratio: 3 / 1;
        background-color: #3a3a3a;
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        transition: background-color 0.2s ease, transform 0.1s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0 10px;
        user-select: none;
        position: relative; /* Needed for absolute children */
      }
            
      .ts-toggle-option {
        flex: 1 1 0;
        aspect-ratio: 1 / 1;
        max-width: 100%;
        z-index: 1;
        font-size: 20px;
        color: #bfbfbf;
        border-radius: 999px;
        user-select: none;
      }
      
      .ts-toggle-indicator {
        position: absolute;
        top: 0;
        bottom: 0;
        width: calc(100% / 3); /* Assuming 3 options */
        left: 0;
        z-index: 0;
        background: #007bff;
        border-radius: 999px;
        transition: left 0.3s ease;
      }
      
      .ts-toggle-option.active {
        color: white;
      }
      
      .ts-toggle-kb, .ts-toggle-mouse-triangle, .ts-toggle-mouse-power {
        pointer-events: none; /* so clicks bubble up */
      }

      /* SVG styling */
      svg {
        display: block;
      }
      .quarter {
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .quarter:hover { opacity: 0.0; }
      .gap {
        fill: currentColor;
        pointer-events: none !important;
      }
      text {
        font-family: sans-serif;
        font-size: 1rem;
        fill: #bfbfbf;
        pointer-events: none;
        user-select: none;
      }

      #foldable-container {
        width: 100%;
        display: none;
      }
    `;
    this.shadowRoot.appendChild(style);

    const container = document.createElement("div");
    container.className = "remote-container";

    const wrapper = document.createElement("div");
    wrapper.className = "circular-buttons-wrapper";
    wrapper.innerHTML = `
      <div class="circular-buttons no-margin-bottom">
        <button class="circle-button left" id="remote-power-button">⏻</button>
        <div id="remote-power-filler"></div>
      </div>
      <div class="circular-buttons-center">
        <svg id="dpad"></svg>
      </div>
      <div class="circular-buttons-center">
        <div class="bottom-buttons">
          <button class="side-button left" id="remote-return-button"><div class="return-button">↩</div></button>
          <button class="side-button right" id="remote-home-button"><div class="home-button">⌂</div></button>
        </div>
      </div>
      <div class="circular-buttons">
        <button class="circle-button left" id="remote-backspace-button">⌫</button>
        <div id="ts-toggle-threeStateToggle" class="ts-toggle-container center" data-state="1">
          <div class="ts-toggle-indicator"></div>
          <div class="ts-toggle-option active"><div class="ts-toggle-kb">⌨︎</div></div>
          <div class="ts-toggle-option">●</div>
          <div class="ts-toggle-option">
            <div class="ts-toggle-mouse-triangle">▲</div>
            <div class="ts-toggle-mouse-power">⏻</div>
          </div>
        </div>
        <button class="circle-button right" id="remote-settings-button">☰</button>
      </div>
      <div id="foldable-container" style="margin-top:10px;"></div>
      <div class="circular-buttons">
        <button class="circle-button left"   id="remote-volume-down-button"><div class="speaker">🔈</div><div class="volume-low">)</div></button>
        <button class="circle-button left"   id="remote-previous-track-button"><div class="track-triangle">|◀◀</div></button>
        <button class="circle-button center" id="remote-play-pause-button"><div class="track-triangle">▶| |</div></button>
        <button class="circle-button right"  id="remote-next-track-button"><div class="track-triangle">▶▶|</div></button>
        <button class="circle-button right"  id="remote-volume-up-button"><div class="speaker">🔈</div><div class="volume-low">)</div><div class="volume-medium">)</div><div class="volume-high">)</div></button>
      </div>
    `;
    container.appendChild(wrapper);
    card.appendChild(container);
    this.shadowRoot.appendChild(card);

    this.card = card;
    this.content = container;

    this.setupDpad();
    this.setupFoldables();

    // Init all interractions
    this.remoteButtons.forEach((remoteButton) => {
      const btn = this.content.querySelector(`#${remoteButton.id}`);
      btn._keyData = { code: remoteButton.code };
      
      // Add pointer Down events:
      btn.addEventListener("pointerdown", (e) => {
        this.handlePointerDown(e, hass, btn);
      });

      // Add pointer Up events:
      btn.addEventListener("pointerup", (e) => {
        this.handlePointerUp(e, hass, btn);
      });
      btn.addEventListener("pointercancel", (e) => {
        this.handlePointerUp(e, hass, btn);
      });

      // Add pointer Up events: for older touch devices fallback
      btn.addEventListener("touchend", (e) => {
        this.handlePointerUp(e, hass, btn);
      });
      btn.addEventListener("touchcancel", (e) => {
        this.handlePointerUp(e, hass, btn);
      });
    });

  }

  setupDpad() {
    const svg = this.content.querySelector("#dpad");
    const padRadius = 160;
    const padPadding = 90;
    const padLineThick = 8;
    const center = padRadius;
    const rOuter = padRadius;
    const rInner = padRadius - padPadding;
    const centerRadius = padRadius - padPadding - padLineThick;
    const svgSize = padRadius * 2;
    
    svg.setAttribute("viewBox", `0 0 ${svgSize} ${svgSize}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "auto";

    const ns = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(ns, "defs");
    svg.appendChild(defs);

    const degToRad = (deg) => (deg * Math.PI) / 180;
    const pointOnCircle = (cx, cy, r, deg) => {
      const rad = degToRad(deg);
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const createQuarterPath = (angleStart) => {
      const angleEnd = (angleStart + 90) % 360;
      const p1 = pointOnCircle(center, center, rOuter, angleStart);
      const p2 = pointOnCircle(center, center, rOuter, angleEnd);
      const p3 = pointOnCircle(center, center, rInner, angleEnd);
      const p4 = pointOnCircle(center, center, rInner, angleStart);

      return `M ${p1.x} ${p1.y}
              A ${rOuter} ${rOuter} 0 0 1 ${p2.x} ${p2.y}
              L ${p3.x} ${p3.y}
              A ${rInner} ${rInner} 0 0 0 ${p4.x} ${p4.y}
              Z`;
    };

    const quarters = [
      { id: 1, angleStart: 225, keyId: "remote-arrow-up-button", label: "▲" },
      { id: 2, angleStart: 315, keyId: "remote-arrow-right-button", label: "▶" },
      { id: 3, angleStart: 45,  keyId: "remote-arrow-down-button", label: "▼" },
      { id: 4, angleStart: 135, keyId: "remote-arrow-left-button", label: "◀" }
    ];

    quarters.forEach(({ id, keyId, angleStart, label }) => {
      const quarterPath = createQuarterPath(angleStart);
      const clipId = `clip-quarter-${id}`;
      const clip = document.createElementNS(ns, "clipPath");
      clip.setAttribute("id", clipId);
      const clipShape = document.createElementNS(ns, "path");
      clipShape.setAttribute("d", quarterPath);
      clip.appendChild(clipShape);
      defs.appendChild(clip);

      const bg = document.createElementNS(ns, "path");
      bg.setAttribute("d", quarterPath);
      bg.setAttribute("fill", "#4a4a4a");
      bg.setAttribute("clip-path", `url(#${clipId})`);
      svg.appendChild(bg);

      const btn = document.createElementNS(ns, "path");
      btn.setAttribute("d", quarterPath);
      btn.setAttribute("fill", "#3a3a3a");
      btn.setAttribute("clip-path", `url(#${clipId})`);
      btn.setAttribute("class", "quarter");
      btn.setAttribute("id", keyId);
      svg.appendChild(btn);

      const angle = (angleStart + 45) % 360;
      const labelPos = pointOnCircle(center, center, (rOuter + rInner) / 2, angle);
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", labelPos.x);
      text.setAttribute("y", labelPos.y);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.textContent = label;
      svg.appendChild(text);
    });

    const centerCircle = document.createElementNS(ns, "circle");
    centerCircle.setAttribute("cx", center);
    centerCircle.setAttribute("cy", center);
    centerCircle.setAttribute("r", centerRadius);
    centerCircle.setAttribute("fill", "#4a4a4a");
    svg.appendChild(centerCircle);

    const centerButton = document.createElementNS(ns, "circle");
    centerButton.setAttribute("cx", center);
    centerButton.setAttribute("cy", center);
    centerButton.setAttribute("r", centerRadius);
    centerButton.setAttribute("fill", "#3a3a3a");
    centerButton.setAttribute("class", "quarter");
    centerButton.setAttribute("id", "remote-ok-button");
    svg.appendChild(centerButton);

    const centerLabel = document.createElementNS(ns, "text");
    centerLabel.setAttribute("x", center);
    centerLabel.setAttribute("y", center);
    centerLabel.setAttribute("text-anchor", "middle");
    centerLabel.setAttribute("dominant-baseline", "middle");
    centerLabel.textContent = "OK";
    svg.appendChild(centerLabel);
  }

  setupFoldables() {
    const toggle = this.content.querySelector("#ts-toggle-threeStateToggle");
    const indicator = toggle.querySelector(".ts-toggle-indicator");
    const options = Array.from(toggle.querySelectorAll(".ts-toggle-option"));
    const foldable = this.content.querySelector("#foldable-container");
    const foldableKeyboardName = "android-keyboard-card";
    const foldableMouseName = "trackpad-card";
    let foldableKeyboard;
    let foldableMouse;

    let state = 1;
    
    const updateFoldable = () => {
      foldable.innerHTML = "";
      if (state === 1) {
        foldable.style.display = "none";
        return;
      }
  
      foldable.style.display = "block";
      let foldableContentName;
      if (state === 0) {
        foldableContentName = foldableKeyboardName;
      } else if (state === 2) {
        foldableContentName = foldableMouseName;
      }
      
      if (foldableContentName) {
        customElements.whenDefined(foldableContentName).then(() => {
          let foldableContent;
          if (foldableContentName === foldableKeyboardName) {
            if (!foldableKeyboard) foldableKeyboard = document.createElement(foldableKeyboardName); // Safe init of imported component
            foldableContent = foldableKeyboard;
          } else if (foldableContentName === foldableMouseName) {
            if (!foldableMouse) foldableMouse = document.createElement(foldableMouseName); // Safe init of imported component
            foldableContent = foldableMouse;
          } else {
            throw new Error(`Unkwnon foldable component ${foldableContentName}`);
          }
          foldableContent.setAttribute("style", "width: 100%;");
          foldableContent.hass = this._hass;
          foldableContent.setConfig(this.config);
          foldable.appendChild(foldableContent);
        });
      }
    };

    const updateFoldableUI = () => {
      const leftPercentages = ["0%", "33.33%", "66.66%"];
      indicator.style.left = leftPercentages[state];
    
      options.forEach((opt, idx) => opt.classList.toggle("active", idx === state));
      updateFoldable();
    };


    options.forEach((option, index) => {
      option.addEventListener("click", () => {
        if (state !== index) {
          state = index;
          updateFoldableUI();
        }
      });
    });
  
    updateFoldableUI();
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
      this.remoteButtons.forEach((remoteButton) => {
        const btn = this.content.querySelector(`#${remoteButton.id}`);
        if (btn.classList.contains("active")) {
          this.handleKeyRelease(this._hass, btn);
        }
      });
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

    // track the key press to avoid unwanted other key release
    this._currentBaseKey = btn;

    // Pressed key code (keyboard layout independant, later send to remote keyboard)
    const code = keyData.code;

    // Press HID key
    this.appendCode(hass, code);
  }

  handleKeyRelease(hass, btn) {
    const keyData = btn._keyData;
    if (!keyData) return;

    const code = keyData.code;

    // Remove active visual for all other keys / states
    btn.classList.remove("active");

    // When the mouse is released over another key than the first pressed key
    if (this._currentBaseKey && this._currentBaseKey._keyData.code !== keyData.code) {
      //console.log("handleKeyRelease->suppressed-key:", keyData.code, "Char:", btn._lowerLabel.textContent || "", "wanted-key:", this._currentBaseKey._keyData.code);
      return; // suppress the unwanted other key release
    }

    // Release HID key
    this.removeCode(hass, code);
  }
  
  appendCode(hass, code) {
    if (code) {
      if (this.isKey(code) || this.isModifier(code)) {
        this.appendKeyCode(hass, code);
      } else if (this.isConsumer(code)) {
        this.appendConsumerCode(hass, code);
      } else {
        console.log("appendCode->Unknown code type:", code);
      }
    }
  }

  appendKeyCode(hass, code) {
    console.log("Key pressed:", code);
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

  appendConsumerCode(hass, code) {
    console.log("Consumer pressed:", code);
    if (code) {
      this.pressedConsumers.add(code);
    }
    this.sendConsumerUpdate(hass);
  }

  removeCode(hass, code) {
    if (code) {
      if (this.isKey(code) || this.isModifier(code)) {
        this.removeKeyCode(hass, code);
      } else if (this.isConsumer(code)) {
        this.removeConsumerCode(hass, code);
      } else {
        console.log("removeCode->Unknown code type:", code);
      }
    }
  }

  removeKeyCode(hass, code) {
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

  removeConsumerCode(hass, code) {
    console.log("Consumer released:", code);
    if (code) {
      this.pressedConsumers.delete(code);
    }
    this.sendConsumerUpdate(hass);
  }

  isKey(code) {
    return code && code.startsWith("KEY_");
  }

  isModifier(code) {
    return code && code.startsWith("MOD_");
  }
  
  isConsumer(code) {
    return code && code.startsWith("CON_");
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
  
}

customElements.define("android-remote-card", AndroidRemoteCard);
