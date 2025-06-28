console.info("Loading Android Remote Card");

class AndroidRemoteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); // Create shadow root
    
    this._hass = null;
    this._layoutReady = false;
    this._uiBuilt = false;
    this.card = null;
    
    // when not user configured, fallback to default 
    // international language and keyboard layout
    this.language = "FR";
    this.layoutUrl = `/local/layouts/android/${this.language}-remote.json`;
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
    // Load keyboard layout
    await this.loadLayout(this.layoutUrl);
    this._layoutReady = true;

    // Only build UI if hass is already set
    if (this._hass) {
      this.buildUi(this._hass);
    }
  }

  async loadLayout(layoutUrl) {
    console.log("Android Remote - loading keyboard layout:", layoutUrl);
    try {
      const response = await fetch(layoutUrl);
      const layout = await response.json();
      this.keys = layout.keys;
      this.rowsConfig = layout.rowsConfig;
    } catch (e) {
      console.error("Android Remote - Failed to load keyboard layout:", e);
      this.keys = [];
      this.rowsConfig = [];
    }
  }

  set hass(hass) {
    console.log("Android Remote - set hass():", hass);
    this._hass = hass;
    if (this._layoutReady && !this._uiBuilt) {
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
    this.shadowRoot.innerHTML = '';

    this._uiBuilt = true;
    
    const card = document.createElement("ha-card");
    const style = document.createElement("style");
    style.textContent = `
      :host {
        --background-color: #f0f0f0;
        --pad-radius: 30;
        --pad-line-thick: 5px;
        --circle-button-height: 70px;
        --circle-button-width: 70px;
        --ts-button-height: 70px; /* full height of toggle button */
        --ts-button-width: 83px; /* width per toggle state */
        --side-button-height: 60px;
        --side-button-width: 200px;
        background: var(--background-color);
        color: var(--background-color);
      }
      .remote-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        gap: 20px;
      }
      svg {
        display: block;
      }
      .quarter {
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .quarter:hover {
        opacity: 0.0
      }
      .gap {
        fill: currentColor;
        pointer-events: none !important;
      }
      text {
        font-family: sans-serif;
        font-size: 20px;
        fill: #bfbfbf;
        pointer-events: none;
        user-select: none;
      }
      /* Container for the two bottom buttons */
      .bottom-buttons {
        width: calc(2 * var(--pad-radius) + var(--pad-line-thick));
        display: flex;
        justify-content: space-between;
        gap: 6px; /* padLineThick */
        margin-top: 20px;
        margin-bottom: 20px;
      }
      .side-button {
        width: var(--side-button-width);
        height: var(--side-button-height);
        background-color: #3a3a3a;
        cursor: pointer;
        transition: background-color 0.2s ease, transform 0.1s ease;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #bfbfbf;
        font-family: sans-serif;
        font-size: 24px;
        border: none;
        outline: none;
        padding: 0 20px;
        margin-top: 10px;
        user-select: none;
      }
      /* Left button: semi-circular convex on left side */
      .side-button.left {
        border-top-left-radius: calc(var(--side-button-height) / 2);
        border-bottom-left-radius: calc(var(--side-button-height) / 2);
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
      /* Right button: semi-circular convex on right side */
      .side-button.right {
        border-top-right-radius: calc(var(--side-button-height) / 2);
        border-bottom-right-radius: calc(var(--side-button-height) / 2);
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
      /* Hover and pressed effect similar to dpad */
      .side-button:hover {
        background-color: #4a4a4a;
      }
      .side-button.pressed {
        transform: scale(0.95);
      }
      .side-button:active {
        transform: scale(0.95);
      }
      .return-button {
        transform: scaleY(-1);
      }
      .home-button {
        transform: translate(0px, -5px) scale(2.25, 1.5); /* 1.0 is original size, 1.5 is 150% */
        transition: transform 0.3s ease; /* optional: smooth scaling */
      }
      .circular-buttons-center {
        display: flex;
        flex-direction: column;
        align-items: center; /* horizontally center each child row */
        justify-content: space-between;
        padding: 0;
      }
      .circular-buttons {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 0;
        margin-top: 15px;
        margin-bottom: 15px;
        margin-left: 30px;
        margin-right: 30px;
      }
      .circular-buttons.no-margin-bottom {
        margin-bottom: 0;
      }
      .circle-button {
        width: var(--circle-button-width);
        height: var(--circle-button-height);
        border-radius: 50%;
        background-color: #3a3a3a;
        color: #bfbfbf;
        font-size: 20px;
        border: none;
        outline: none;
        cursor: pointer;
        transition: background-color 0.2s ease, transform 0.1s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: sans-serif;
      }
      .circle-button:hover {
        background-color: #4a4a4a;
      }
      .circle-button:active {
        transform: scale(0.95);
      }
      .kb {
        transform: scale(1.3, 1.3);
      }
      .speaker {
        transform: scale(1.0, 1.3);
      }
      .volume-low {
        transform: scale(1.0, 0.4);
      }
      .volume-medium {
        transform: scale(1.0, 0.7);
      }
      .volume-high {
        transform: scale(1.0, 1.0);
      }
      .track-triangle {
        transform: scale(1.0, 1.0);
      }
      .mouse-triangle {
        display: inline-block; /* keep it inline for better control */
        transform: rotate(315deg) scale(1.0, 1.5) translate(4px, -5px);
      }
      .mouse-power {
        display: inline-block; /* keep it inline for better control */
        transform: translate(-4px, 8px) rotate(315deg) scale(1.0, 1.0);
      }
      .ts-toggle-container {
        display: flex;
        align-items: center;
        position: relative;
        width: calc(var(--ts-button-width) * 3);
        height: var(--ts-button-height);
        background-color: #3a3a3a;
        border-radius: 999px;
        user-select: none;
      }
      .ts-toggle-option {
        flex: 0 0 var(--ts-button-width);
        text-align: center;
        line-height: var(--ts-button-height);
        font-size: 16px;
        z-index: 1;
        color: #bfbfbf;
        font-weight: normal;
        cursor: pointer;
        transition: color 0.2s ease, font-weight 0.2s ease, background-color 0.2s ease;
        border-radius: 999px;
        box-sizing: border-box;
      }
      .ts-toggle-option:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }
      .ts-toggle-option.active {
        color: #bfbfbf;
        font-weight: bold;
      }
      .ts-toggle-indicator {
        position: absolute;
        top: calc(var(--ts-button-height) * 0.05);
        bottom: calc(var(--ts-button-height) * 0.05);
        width: calc(var(--ts-button-width) - calc(var(--ts-button-height) * 0.1));
        background-color: #4a4a4a;
        border-radius: 999px;
        transition: left 0.25s ease;
        z-index: 0;
        box-sizing: border-box;
      }
      .ts-toggle-kb {
        transform: scale(1.3);
        display: inline-block;
      }
      .ts-toggle-mouse-triangle {
        display: inline-block;
        transform: translate(2px, calc(-1 * var(--ts-button-height) * 0.1)) rotate(315deg) scale(1.0, 1.5);
      }
      .ts-toggle-mouse-power {
        display: inline-block;
        transform: translate(0px, calc(var(--ts-button-height) * 0.1)) rotate(315deg) scale(1.0, 1.0);
      }
      #foldable-container > * {
        width: 100%;
        box-sizing: border-box;
      }
    `;
    this.shadowRoot.appendChild(style);

    const container = document.createElement("div");
    container.className = "remote-container";

    // --- Move content from HTML into this container ---
    const wrapper = document.createElement("div");
    wrapper.className = "circular-buttons-wrapper";
    wrapper.innerHTML = `
      <div class="circular-buttons no-margin-bottom">
        <button class="circle-button left">⏻</button>
      </div>
      <div class="circular-buttons-center">
        <svg id="dpad"></svg>
      </div>
      <div class="circular-buttons-center">
        <div class="bottom-buttons">
          <button class="side-button left"><div class="return-button">↩</div></button>
          <button class="side-button right"><div class="home-button">⌂</div></button>
        </div>
      </div>
      <div class="circular-buttons">
        <button class="circle-button left">⌫</button>
        <div id="ts-toggle-threeStateToggle" class="ts-toggle-container center" data-state="1">
          <div class="ts-toggle-indicator"></div>
          <div class="ts-toggle-option"><div class="ts-toggle-kb">⌨︎</div></div>
          <div class="ts-toggle-option">●</div>
          <div class="ts-toggle-option">
            <div class="ts-toggle-mouse-triangle">▲</div>
            <div class="ts-toggle-mouse-power">⏻</div>
          </div>
        </div>
        <button class="circle-button right">☰</button>
      </div>
      <div id="foldable-container" style="width: 100%; display: none; margin-top: 10px;"></div>
      <div class="circular-buttons">
        <button class="circle-button left"><div class="speaker">🔈</div><div class="volume-low">)</div></button>
        <button class="circle-button left"><div class="track-triangle">|◀◀</div></button>
        <button class="circle-button center"><div class="track-triangle">▶| |</div></button>
        <button class="circle-button right"><div class="track-triangle">▶▶|</div></button>
        <button class="circle-button right"><div class="speaker">🔈</div><div class="volume-low">)</div><div class="volume-medium">)</div><div class="volume-high">)</div></button>
      </div>
    `;
    container.appendChild(wrapper);
    
    card.appendChild(container);
    this.shadowRoot.appendChild(card);

    this.card
    this.content = container;

    this.renderSVG();
    this.setupInteractions();
    
    // update dynamic children with new hass
    const foldable = this.shadowRoot.getElementById("foldable-container");
    if (foldable && foldable.firstChild && foldable.firstChild.tagName) {
      foldable.firstChild.hass = hass;
    }
  }

  renderSVG() {
    const svg = this.shadowRoot.getElementById("dpad");

    const padRadius = 160;
    const padPadding = 90;
    const padLineThick = 8;
    const center = padRadius;
    const rOuter = padRadius;
    const rInner = padRadius - padPadding;
    const centerRadius = padRadius - padPadding - padLineThick;

    const svgSize = padRadius * 2;
    svg.setAttribute("width", svgSize);
    svg.setAttribute("height", svgSize);
    svg.setAttribute("viewBox", `0 0 ${svgSize} ${svgSize}`);

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
      { id: 1, angleStart: 225, label: "▲" },
      { id: 2, angleStart: 315, label: "▶" },
      { id: 3, angleStart: 45, label: "▼" },
      { id: 4, angleStart: 135, label: "◀" }
    ];

    quarters.forEach(({ id, angleStart, label }) => {
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
    svg.appendChild(centerButton);

    const centerLabel = document.createElementNS(ns, "text");
    centerLabel.setAttribute("x", center);
    centerLabel.setAttribute("y", center);
    centerLabel.setAttribute("text-anchor", "middle");
    centerLabel.setAttribute("dominant-baseline", "middle");
    centerLabel.textContent = "OK";
    svg.appendChild(centerLabel);
  }

  setupInteractions() {
    const toggle = this.shadowRoot.getElementById("ts-toggle-threeStateToggle");
    const indicator = toggle.querySelector(".ts-toggle-indicator");
    const options = Array.from(toggle.querySelectorAll(".ts-toggle-option"));
    const foldable = this.shadowRoot.getElementById("foldable-container");
    const foldableKeyboard = document.createElement("android-keyboard-card");
    //const foldableKeyboard.hass = this._hass;
    //const foldableKeyboard.setConfig(this.config);
    const foldableMouse = document.createElement("trackpad-card");
    //const foldableMouse.hass = this._hass;
    //const foldableMouse.setConfig(this.config);

    let state = 1;
    
    const updateFoldable = () => {
      foldable.innerHTML = "";
      if (state === 1) {
        foldable.style.display = "none";
        return;
      }
  
      foldable.style.display = "block";
      let foldableContent;
      if (state === 0) {
        foldableContent = foldableKeyboard;
      } else if (state === 2) {
        foldableContent = foldableMouse;
      }
  
      if (foldableContent) {
        foldableContent.setAttribute("style", "width: 100%;");
        foldableContent.hass = this._hass;
        foldableContent.setConfig(this.config);
        foldable.appendChild(foldableContent);
      }
    };
  
    const updateUI = () => {
      const btnWidth = 83;
      indicator.style.left = `${state * btnWidth + 3.5}px`;
      options.forEach((opt, idx) => opt.classList.toggle("active", idx === state));
      updateFoldable();
    };
  
    options.forEach((option, index) => {
      option.addEventListener("click", () => {
        if (state !== index) {
          state = index;
          updateUI();
        }
      });
    });
  
    updateUI();
  }
  
}

customElements.define("android-remote-card", AndroidRemoteCard);
