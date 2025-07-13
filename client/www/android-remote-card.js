import { Logger } from './utils/logger.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';

console.info("Loading Android Remote Card");

class AndroidRemoteCard extends HTMLElement {
  constructor() {
    super();    
    this.attachShadow({ mode: "open" }); // Create shadow root

    this._keycodes = new KeyCodes().getMapping();
    this._consumercodes = new ConsumerCodes().getMapping();

    this._hass = null;
    this._uiBuilt = false;
    this.card = null;

    // Configs
    this.config = null;
    this.loglevel = 'warn';
    this.logpushback = false;
    this.logger = new Logger(this.loglevel, this._hass, this.logpushback);
    this.haptic = false;
    this.layout = 'classic';
    this.layoutUrl = `/local/layouts/remote/${this.layout}.json`;
    this.keyboardConfig = {};
    this.mouseConfig = {};
    this.activitiesConfig = {};

    // Layout loading flags
    this._layoutReady = false;
    this._layoutLoaded = {};

    this.cellContents = { 
      "remote-button-power": {
        code: "CON_POWER",
        html: 
        `<svg id="power-icon" viewBox="0 0 64 68" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="20" stroke-linecap="round" stroke-linejoin="round">
          <!-- Left arc -->20
          <path d="M 6 34 A 26 26 0 0 1 24 8" stroke-width="4" />
          <!-- Right arc -->
          <path d="M 40 8 A 26 26 0 0 1 58 34" stroke-width="4" />
          <!-- Bottom arc -->
          <path d="M 58 34 A 26 26 0 0 1 6 34" stroke-width="4" />
          <!-- Vertical bar -->
          <line x1="32" y1="4" x2="32" y2="32" stroke-width="6" />
        </svg>`
      },
      "remote-button-power-tv": {
        html: 
        `<svg id="tv-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
          <!-- Screen + body -->
          <rect x="64" y="96" width="384" height="256" rx="32" ry="32"/>
          <!-- Stand -->
          <line x1="160" y1="384" x2="352" y2="384"/>
          <!-- Antenna -->
          <line x1="192" y1="96" x2="128" y2="32"/>
          <line x1="320" y1="96" x2="384" y2="32"/>
        </svg>`
      },
      "remote-button-power-device": {
        html: 
        `<svg id="device-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#bfbfbf" stroke="#bfbfbf" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <g>
            <path class="primary-path" d="M11 15H6L13 1V9H18L11 23V15Z" />
          </g>
        </svg>`
      },
      "remote-button-settings": {
        code: "KEY_COMPOSE", 
        html: 
        `<svg id="settings-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <!-- Top line -->
          <line x1="4" y1="6" x2="20" y2="6" />
          <!-- Middle line -->
          <line x1="4" y1="12" x2="20" y2="12" />
          <!-- Bottom line -->
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>`
      },
      "dpad": { 
        tag: "svg"
      },
      "remote-button-arrow-up": {
        code: "KEY_UP"
      },
      "remote-button-arrow-right": {
        code: "KEY_RIGHT"
      },
      "remote-button-arrow-down": {
        code: "KEY_DOWN"
      },
      "remote-button-arrow-left": {
        code: "KEY_LEFT"
      },
      "remote-button-center": {
        code: "KEY_ENTER"
      },
      "remote-button-return": {
        code: "CON_AC_BACK", 
        style: "side-button left", 
        html: 
        `<svg id="return-icon" viewBox="-14 0 80 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
          <!-- Top horizontal line -->
          <line x1="8" y1="17" x2="48" y2="17" />
          <!-- Bottom horizontal line -->
          <line x1="8" y1="47" x2="48" y2="47" />
          <!-- Vertically flipped arc from bottom right to top right -->
          <path d="M48 47 A15 15 0 0 0 48 17" />
          <!-- Left-pointing isosceles triangle with reduced width -->
          <path  fill="#bfbfbf" stroke="#bfbfbf" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" d="M-12 17 L8 7 L8 27 Z" />
        </svg>`
      },
      "remote-button-home": {
        code: "CON_AC_HOME", 
        style: "side-button right", 
        html: 
        `<svg id="home-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
          <!-- Roof (triangle) -->
          <path d="M 12 32 L 32 12 L 52 32" />
          
          <!-- House base without top line -->
          <line x1="16" y1="32" x2="16" y2="52" /> <!-- Left side -->
          <line x1="48" y1="32" x2="48" y2="52" /> <!-- Right side -->
          <line x1="16" y1="52" x2="48" y2="52" /> <!-- Bottom side -->
        </svg>`
      },
      "ts-toggle-container": {
        tag: "div",
        style: "ts-toggle-container", 
        html: 
        `<div class="ts-toggle-indicator"></div>
        <div class="ts-toggle-option active">⌨︎</div>
        <div class="ts-toggle-option">●</div>
        <div class="ts-toggle-option">
          <svg id="mouse-icon" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
            <!-- Mouse body with rounded top and slightly rounded bottom corners -->
            <path d="
              M 20 30 
              Q 20 10, 50 10 
              Q 80 10, 80 30
              L 80 115
              Q 80 125, 70 125
              L 30 125
              Q 20 125, 20 115
              Z
            " />
            
            <!-- Vertical center line (split buttons) -->
            <line x1="50" y1="10" x2="50" y2="70" />
          
            <!-- Larger scroll wheel, moved near the top -->
            <line x1="50" y1="30" x2="50" y2="50" stroke-width="8" stroke-linecap="round" />
          
            <!-- Cable (wire) -->
            <path d="M50 130 C 50 140, 60 145, 70 150" />
          </svg>
        </div>`
      },
      "remote-button-backspace": {
        code: "KEY_BACKSPACE",
        html: 
        `<svg id="backspace-icon" viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
          <!-- Backspace key outline (trapezoid-like shape) -->
          <path d="M8 24 L20 8 H56 V40 H20 Z" />
        
          <!-- 'X' inside the key (representing delete action) -->
          <line x1="28" y1="18" x2="44" y2="30" />
          <line x1="44" y1="18" x2="28" y2="30" />
        </svg>`
      },
      "foldable-container": {
        tag: "div"
      },
      "remote-button-track-previous": {
        code: "CON_SCAN_PREVIOUS_TRACK", 
        html: `|◀◀`
      },
      "remote-button-play-pause": {
        code: "CON_PLAY_PAUSE",
        html: `▶| |`
      },
      "remote-button-track-next": {
        code: "CON_SCAN_NEXT_TRACK",
        html: `▶▶|`
      },
      "remote-button-volume-down": {
        code: "CON_VOLUME_DECREMENT",
        html: 
        `<svg id="volumedown-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <!-- Speaker body (filled) -->
          <path d="M20 24 L28 24 L36 16 V48 L28 40 L20 40 Z" fill="#bfbfbf" />
        
          <!-- Small volume arc -->
          <path d="M42 26 A6 6 0 0 1 42 38" />
        </svg>`
      },
      "remote-button-volume-up": {
        code: "CON_VOLUME_INCREMENT",
        html: 
        `<svg id="volumeup-icon" viewBox="0 0 64 64"  xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <!-- Speaker body with fill -->
          <path d="M16 24 L24 24 L32 16 V48 L24 40 L16 40 Z" fill="#bfbfbf" />
        
          <!-- Volume arcs (wire view) -->
          <path d="M38 26 A6 6 0 0 1 38 38" />
          <path d="M42 22 A10 10 0 0 1 42 42" />
          <path d="M46 18 A14 14 0 0 1 46 46" />
        </svg>`
      }
    };

    // To track pressed modifiers and keys
    this.pressedModifiers = new Set();
    this.pressedKeys = new Set();
    this.pressedConsumers = new Set();

    this.dynamicStyles = new Map();

    // Handle out of bounds mouse releases
    this._handleGlobalPointerUp = this.handleGlobalPointerUp.bind(this);
    this._handleGlobalTouchEnd = this.handleGlobalPointerUp.bind(this); // reuse same logic
  }

  setConfig(config) {
    this.config = config;

    // Set log level
    const oldLoglevel = this.loglevel;
    if (config['log_level']) {
      this.loglevel = config['log_level'];
    }

    // Set log pushback
    const oldLogpushback = this.logpushback;
    if (config['log_pushback']) {
      this.logpushback = config['log_pushback'];
    }

    // Update logger when needed
    if (!oldLoglevel || oldLoglevel !== this.loglevel || !oldLogpushback || oldLogpushback !== this.logpushback) {
      this.logger = new Logger(this.loglevel, this._hass, this.logpushback);
    }
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("setConfig(config):", this.config));

    // Set haptic feedback
    if (config['haptic']) {
      this.haptic = config['haptic'];
    }

    // Set layout
    if (config['layout']) {
      this.layout = config['layout'];
    }

    // Set layout URL
    if (config['layout_url']) {
      this.layoutUrl = config['layout_url'];
    } else {
      this.layoutUrl = `/local/layouts/remote/${this.layout}.json`;
    }

    // Set keyboard configs
    if (config['keyboard']) {
      this.keyboardConfig = config['keyboard'];
    }

    // Set mouse configs
    if (config['mouse']) {
      this.mouseConfig = config['mouse'];
    }

    // Set activites configs
    if (config['activities']) {
      this.activitiesConfig = config['activities'];
    }
  }

  getCardSize() {
    return 5;
  }

  async connectedCallback() {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("connectedCallback()"));

    // Check if layout needs loading
    if (!this._layoutLoaded.layoutUrl || this._layoutLoaded.layoutUrl !== this.layoutUrl) {
      this._layoutReady = false;

      // Load layout
      await this.loadLayout(this.layoutUrl);

      // Update loaded layout
      this._layoutLoaded.layoutUrl = this.layoutUrl;
      this._layoutReady = true;
    }

    // Only build UI if hass is already set
    if (this._hass) {
      this.buildUi(this._hass);
    }
  }

  async loadLayout(layoutUrl) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("loadLayout(layoutUrl):", layoutUrl));
    try {
      const response = await fetch(layoutUrl);
      const layout = await response.json();
      this.rows = layout.rows;
    } catch (e) {
      if (this.logger.isErrorEnabled()) console.error(...this.logger.error(`Failed to load remote layout ${layoutUrl}`, e));
      this.rows = {};
    }
  }

  set hass(hass) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("set hass(hass):", hass));
    this._hass = hass;
    if (this._layoutReady && !this._uiBuilt) {
      this.buildUi(this._hass);
    }
  }

  buildUi(hass) {
    if (this._uiBuilt) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("buildUi(hass) - already built"));
      return;
    }
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("buildUi(hass):", hass));

    // Clear existing content (if any)
    this.shadowRoot.innerHTML = '';

    // Mark UI as "built" to prevent re-enter
    this._uiBuilt = true;

    // Re-add global handlers to ensure proper out-of-bound handling
    this.removeGlobalHandlers();
    this.addGlobalHandlers();

    const card = document.createElement("ha-card");
    const style = document.createElement("style");
    style.textContent = `
      :host {
        --base-font-size: 1rem; /* base scaling unit */
        font-size: var(--base-font-size);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
      }

      .wrapper {
        display: flex;
        flex-direction: column;
      }
      
      .row {
        display: flex;
        flex-direction: row;
      }
      .row.gap-top {
        margin-top: 1vw;
      }
      .row.gap-bottom {
        margin-bottom: 1vw;
      }
      
      .cell {
        padding: 1vw;
      }
      .cell.no-gap {
        padding: 0;
      }
      
      .circle-button {
        height: 100%;
        width: 100%;  /* maintain aspect ratio */
        flex: 1 1 0;
        aspect-ratio: 1 / 1;
        background-color: #3a3a3a;
        color: #bfbfbf;
        border: none;
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        font-size: 4vw;
        transition: background-color 0.2s ease;
        align-items: center;
        justify-content: center;
        display: flex;
        border-radius: 50%;   /* This makes the button circular */
      }
      .circle-button:hover { background-color: #4a4a4a; }
      .circle-button:active,
      .circle-button.pressed { transform: scale(0.95); }
      
      .side-button {
        aspect-ratio: 3 / 1;
        width: 100%;  /* maintain aspect ratio */
        flex: 1 1 0;
        background-color: #3a3a3a;
        color: #bfbfbf;
        border: none;
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        transition: background-color 0.2s ease;
        align-items: center;
        justify-content: center;
        display: flex;
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
      
      .ts-toggle-container {
        min-width: 0;
        text-align: center;
        flex: 1 1 0;
        background-color: #3a3a3a;
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        transition: background-color 0.2s ease, transform 0.1s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0;
        user-select: none;
        position: relative; /* Needed for absolute children */
      }
      .ts-toggle-option {
        flex: 1 1 0;
        aspect-ratio: 1 / 1;
        max-width: 100%;
        position: relative;
        z-index: 1;
        font-size: 5vw;
        color: #bfbfbf;
        border-radius: 999px;
        user-select: none;
        
        display: flex;
        align-items: center;   /* vertical alignment */
        justify-content: center; /* horizontal alignment */
      }
      .ts-toggle-indicator {
        position: absolute;
        top: 0;
        bottom: 0;
        width: calc(100% / 3); /* Assuming 3 options */
        left: 0;
        z-index: 0;
        background-color: #4a4a4a;
        border-radius: 999px;
        transition: left 0.3s ease;
      }
      .ts-toggle-option:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }
      .ts-toggle-option.active {
        color: #bfbfbf;
        font-weight: bold;
      }
      
      .quarter {
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .quarter:hover { opacity: 0.0; }
      text {
        font-family: sans-serif;
        fill: #bfbfbf;
        pointer-events: none;
        user-select: none;
      }
      
      #foldable-container {
        width: 100%;
        display: none;
      }
      
      #power-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4);
      }
      
      #tv-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      
      #device-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      
      #return-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      
      #home-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      
      #backspace-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4);
      }
      
      #mouse-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4) rotate(315deg);
      }
      
      #settings-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4);
      }
      
      #volumedown-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      
      #volumeup-icon {
        height: 100%;
        width: auto;  /* maintain aspect ratio */
        display: block; /* removes any inline space */
        transform: scale(0.5, 0.5);
      }
    `;
    this.shadowRoot.appendChild(style);

    const container = document.createElement("div");
    container.className = "wrapper";

    this.rows.forEach((rowConfig, rowIndex) => {
      
      // Create a row
      const row = document.createElement("div");
      row.classList.add('row');
      if (rowConfig["filler-top"]) row.classList.add('gap-top');
      if (rowConfig["filler-top"]) row.classList.add('gap-bottom');
      
      // Add cells to row
      rowConfig.cells.forEach((cellConfig, cellIndex) => {

        // Create cell
        const cell = document.createElement("div");
        cell.classList.add('cell');
        cell.classList.add(this.addStyleSpan(style, cellConfig.weight));

        // Remove internal padding on cell when required by the row
        if (rowConfig["no-gap"]) cell.classList.add('no-gap');
        
        // Create cell content
        const cellContent = this.createCellContent(cellConfig);
        
        // Add key element into row
        if (cellContent) cell.appendChild(cellContent);
        row.appendChild(cell);
      });
      
      // Add row into container
      container.appendChild(row);
    });
    
    card.appendChild(container);
    this.shadowRoot.appendChild(card);

    this.card = card;
    this.content = container;

    this.setupDpad();
    this.setupFoldables();
  }
  
  addStyleSpan(style, flex) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("addStyleSpan(style, flex):", style, flex));
    const styleName = this.getStyleSpanName(flex);
    let dynamicStyle = this.dynamicStyles.get(styleName);
    if (!dynamicStyle) {
      dynamicStyle = `
        .${styleName} {
          flex: ${flex};
        }`;
      style.textContent += dynamicStyle;
      this.dynamicStyles.set(styleName, dynamicStyle);
    }
    return styleName;
  }

  getStyleSpanName(flex) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("getStyleSpanName(flex):", flex));
    const flexStr = String(flex);
    const styleId = flexStr.replace(/\./g, '-');
    return `span-${styleId}`;
  }

  createCellContent(cellConfig) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("createCellContent(cellConfig):", cellConfig));

    // Create element inside cell, according to its name
    const cellName = cellConfig.name;
    if (cellName === "filler") return null; // No content for filler cell

    // Retrieve known default config for cell content (when available)
    const knownConfig = this.cellContents[cellName];

    // Retrieve cell content tag
    let cellContentTag = null;
    if (knownConfig && knownConfig.tag) cellContentTag = knownConfig.tag; // Known config
    if (cellConfig.tag) cellContentTag = cellConfig.tag; // User config override
    if (!cellContentTag) cellContentTag = "button"; // Default tag fallback

    // Retrieve cell content style
    let cellContentStyle = null;
    if (knownConfig && knownConfig.style) cellContentStyle = knownConfig.style; // Known config
    if (cellConfig.style) cellContentStyle = cellConfig.style; // User config override
    if (!cellContentStyle && cellContentTag === "button") {
      cellContentStyle = "circle-button"; // Default style fallback (button tag only)
    }

    // Retrieve cell content html
    let cellContentHtml = null;
    if (knownConfig && knownConfig.html) cellContentHtml = knownConfig.html; // Known config
    if (cellConfig.html) cellContentHtml = cellConfig.html; // User config override
    // No default html fallback

    // Build cell content
    const cellContent = document.createElement(cellContentTag);
    cellContent.id = cellName;
    if (cellContentStyle) cellContent.className = cellContentStyle;
    if (cellContentHtml) cellContent.innerHTML = cellContentHtml;

    // Add cell content data and event (button tag only)
    if (cellContentTag === "button") this.setDataAndEvents(cellContent);
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("created cellContent:", cellContent));

    return cellContent;
  }
  
  setDataAndEvents(btn) {

    // Retrieve known default config for cell content (when available)
    const knownConfig = this.cellContents[btn.id];

    // Set cell content data
    if (knownConfig && knownConfig.code) {
      btn._keyData = { code: knownConfig.code };
    } else {
      btn._keyData = {};
    }

    // Add pointer Down events:
    this.addPointerDownListener(btn, (e) => {
      this.handlePointerDown(e, hass, btn);
    });

    // Add pointer Up events:
    this.addPointerUpListener(btn, (e) => {
      this.handlePointerUp(e, hass, btn);
    });
    this.addPointerCancelListener(btn, (e) => {
      this.handlePointerUp(e, hass, btn);
    });
  }

  setupDpad() {
    const svg = this.content.querySelector("#dpad");
    const padRadius = 100;
    const padPadding = 56;
    const padLineThick = 5;
    const center = padRadius;
    const rOuter = padRadius;
    const rInner = padRadius - padPadding;
    const centerRadius = padRadius - padPadding - padLineThick;
    const svgSize = padRadius * 2;
    
    svg.setAttribute("viewBox", `0 0 ${svgSize} ${svgSize}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.flex = "4";
    svg.style["aspect-ratio"] = "1 / 1";

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
      { id: 1, angleStart: 225, keyId: "remote-button-arrow-up", label: "▲" },
      { id: 2, angleStart: 315, keyId: "remote-button-arrow-right", label: "▶" },
      { id: 3, angleStart: 45,  keyId: "remote-button-arrow-down", label: "▼" },
      { id: 4, angleStart: 135, keyId: "remote-button-arrow-left", label: "◀" }
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
      this.setDataAndEvents(btn);
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
    centerButton.setAttribute("id", "remote-button-center");
    this.setDataAndEvents(centerButton);
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
    const foldableActivitiesName = "carrousel-card";
    const foldableMouseName = "trackpad-card";
    let foldableKeyboard;
    let foldableActivites;
    let foldableMouse;

    let state = 1;
    
    const updateFoldable = () => {
      foldable.innerHTML = "";  
      foldable.style.display = "block";
      let foldableContentName;
      if (state === 0) {
        foldableContentName = foldableKeyboardName;
      } else if (state === 1) {
        foldableContentName = foldableActivitiesName;
      } else if (state === 2) {
        foldableContentName = foldableMouseName;
      }
      
      if (foldableContentName) {
        customElements.whenDefined(foldableContentName).then(() => {
          let foldableContent;
          let foldableContentConfig;
          if (foldableContentName === foldableKeyboardName) {
            if (!foldableKeyboard) foldableKeyboard = document.createElement(foldableKeyboardName); // Safe init of imported component
            foldableContent = foldableKeyboard;
            foldableContentConfig = this.keyboardConfig;
          } else if (foldableContentName === foldableActivitiesName) {
            if (!foldableActivites) foldableActivites = document.createElement(foldableActivitiesName); // Safe init of imported component
            foldableContent = foldableActivites;
            foldableContentConfig = this.activitiesConfig;
          } else if (foldableContentName === foldableMouseName) {
            if (!foldableMouse) foldableMouse = document.createElement(foldableMouseName); // Safe init of imported component
            foldableContent = foldableMouse;
            foldableContentConfig = this.mouseConfig;
          } else {
            throw new Error(`Unkwnon foldable component ${foldableContentName}`);
          }
          foldableContent.setAttribute("style", "width: 100%;");
          foldableContent.setConfig(foldableContentConfig);
          foldableContent.hass = this._hass;
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
      this.addPointerClickListener(option, () => {
        if (state !== index) {
          state = index;
          updateFoldableUI();
          this.hapticFeedback();
        }
      });
    });
  
    updateFoldableUI();
  }

  handleGlobalPointerUp(evt) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleGlobalPointerUp(evt):", evt));
    if (this.content && this._hass) {
      this.cellContents.forEach((remoteButton) => {
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
  
  // A wrapper for handleKeyPressInternal internal logic, used to avoid clutering code with hapticFeedback calls
  handleKeyPress(hass, btn) {
    this.handleKeyPressInternal(hass, btn);

    // Send haptic feedback to make user acknownledgable of succeeded press event
    this.hapticFeedback();
  }
  
  handleKeyPressInternal(hass, btn) {
    // Mark button active visually
    btn.classList.add("active");

    // Retrieve key data
    const keyData = btn._keyData;
    if (!keyData) return;

    // track the key press to avoid unwanted other key release
    this._currentBaseKey = btn;

    // Pressed key code (keyboard layout independant, later send to remote keyboard)
    const code = keyData.code;
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("key-pressed:", code));

    const btnId = btn.id;
    if (btnId && this.config['buttons-override'] && this.config['buttons-override'][btnId]) {
      // Override detected: do nothing (override action will be executed on button up)
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("override detected for button-down:", btnId));
    } else {
      // Default action

      // Press HID key
      this.appendCode(hass, code);
    }
  }

  // A wrapper for handleKeyRelease internal logic, used to avoid clutering code with hapticFeedback calls
  handleKeyRelease(hass, btn) {
    this.handleKeyReleaseInternal(hass, btn);

    // Send haptic feedback to make user acknownledgable of succeeded release event
    this.hapticFeedback();
  }

  handleKeyReleaseInternal(hass, btn) {
    const keyData = btn._keyData;
    if (!keyData) return;

    const code = keyData.code;

    // Remove active visual for all other keys / states
    btn.classList.remove("active");

    // When the mouse is released over another key than the first pressed key
    if (this._currentBaseKey && this._currentBaseKey._keyData.code !== keyData.code) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("key-suppressed:", keyData.code, "char:", btn._lowerLabel.textContent || "", "in-favor-of-key:", this._currentBaseKey._keyData.code));
      return; // suppress the unwanted other key release
    }
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("key-released:", code));

    const btnId = btn.id;
    if (btnId && this.config['buttons-override'] && this.config['buttons-override'][btnId]) {
      // Override detected: do override action
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("override detected for button-up:", btnId, this.config['buttons-override'][btnId]));
      const override = this.config['buttons-override'][btnId];
      this.fireEvent(btn, "hass-action", {
        config: override,
        action: "tap",
      });
    } else {
      // Default action

      // Release HID key
      this.removeCode(hass, code);
    }
  }
    
  appendCode(hass, code) {
    if (code) {
      if (this.isKey(code) || this.isModifier(code)) {
        this.appendKeyCode(hass, code);
      } else if (this.isConsumer(code)) {
        this.appendConsumerCode(hass, code);
      } else {
        if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn("Unknown code type:", code));
      }
    }
  }

  appendKeyCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Key pressed:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key pressed
        this.pressedModifiers.add(intCode);
      } else {
        // Standard key pressed
        this.pressedKeys.add(intCode);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  appendConsumerCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Consumer pressed:", code));
    if (code) {
      const intCode = this._consumercodes[code];
      this.pressedConsumers.add(intCode);
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
        if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn("Unknown code type:", code));
      }
    }
  }

  removeKeyCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Key released:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key released
        this.pressedModifiers.delete(intCode);
      } else {
        // Standard key released
        this.pressedKeys.delete(intCode);
      }
    }
    this.sendKeyboardUpdate(hass);
  }

  removeConsumerCode(hass, code) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("Consumer released:", code));
    if (code) {
      const intCode = this._consumercodes[code];
      this.pressedConsumers.delete(intCode);
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

  addGlobalHandlers() {
    this.addPointerUpListener(window, this._handleGlobalPointerUp);
    this.addPointerLeaveListener(window, this._handleGlobalPointerUp);
    this.addPointerCancelListener(window, this._handleGlobalPointerUp);
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleGlobalPointerUp added"));
  }

  removeGlobalHandlers() {
    this.removePointerUpListener(window, this._handleGlobalPointerUp);
    this.removePointerLeaveListener(window, this._handleGlobalPointerUp);
    this.removePointerCancelListener(window, this._handleGlobalPointerUp);
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleGlobalPointerUp removed"));
  }

  // Fires HomeAssistant event
  fireEvent(node, type, detail, options = {}) {
    const event = new CustomEvent(type, {
      bubbles: options.bubbles ?? true,
      cancelable: Boolean(options.cancelable),
      composed: options.composed ?? true,
      detail,
    });
    node.dispatchEvent(event);
  }

  addPointerDownListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_DOWN" ); }
  addPointerEnterListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_ENTER" ); }
  addPointerOverListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_OVER" ); }
  addPointerMoveListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_MOVE" ); }
  addPointerLeaveListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_LEAVE" ); }
  addPointerUpListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_UP" ); }
  addPointerCancelListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_CANCEL" ); }
  addPointerOutListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_OUT" ); }
  addPointerClickListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_CLICK" ); }
  addPointerDblClickListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_DBLCLICK" ); }
  addPointerContextmenuListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_CTXMENU" ); }

  // Add the available event listener using 
  // - supported event first (when available) 
  // - then falling back to legacy event (when available)
  addAvailableEventListener(target, callback, options, events) {
    const eventName = this.getSupportedEventListener(target, events);
    if (eventName) {
      this.addGivenEventListener(target, callback, options, eventName);
    }
    return eventName;
  }

  // Add the specified event listener
  addGivenEventListener(target, callback, options, eventName) {
    if (this.isTargetListenable(target)) {
      if (options) {
        if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(`Adding event listener ${eventName} on target with options:`, target, options));
        target.addEventListener(eventName, callback, options);
      } else {
        if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(`Adding event listener ${eventName} on target:`, target));
        target.addEventListener(eventName, callback);
      }
    }
  }

  removePointerDownListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_DOWN" ); }
  removePointerEnterListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_ENTER" ); }
  removePointerOverListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_OVER" ); }
  removePointerMoveListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_MOVE" ); }
  removePointerLeaveListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_LEAVE" ); }
  removePointerUpListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_UP" ); }
  removePointerCancelListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_CANCEL" ); }
  removePointerOutListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_OUT" ); }
  removePointerClickListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_CLICK" ); }
  removePointerDblClickListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_DBLCLICK" ); }
  removePointerContextmenuListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_CTXMENU" ); }

  // Remove the available event listener using 
  // - supported event first (when available) 
  // - then falling back to legacy event (when available)
  removeAvailableEventListener(target, callback, options, abstractEventName) {
    const eventName = this.getSupportedEventListener(target, abstractEventName);
    if (eventName) {
      this.removeGivenEventListener(target, callback, options, eventName);
    }
    return eventName;
  }

  // Remove the specified event listener
  removeGivenEventListener(target, callback, options, eventName) {
    if (this.isTargetListenable(target)) {
      if (options) {
        if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(`Removing event listener ${eventName} on target with options:`, target, options));
        target.removeEventListener(eventName, callback, options);
      } else {
        if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(`Removing event listener ${eventName} on target:`, target));
        target.removeEventListener(eventName, callback);
      }
    }
  }

  // Checks whether or not target is listenable
  isTargetListenable(target) {
    if (!target || typeof target.addEventListener !== 'function') {
      if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(`Invalid target ${target} element provided to isTargetListenable`));
      return false;
    }
    return true;
  }

  // Gets the available event listener using 
  // - supported event first (when available) 
  // - then falling back to legacy event (when available)
  getSupportedEventListener(target, abstractEventName) {
    if (!abstractEventName) {
      if (this.logger.isErrorEnabled()) console.error(...this.logger.error(`Invalid abstractEventName ${abstractEventName}: expected a non-empty string`));
      return null;
    }
    
    // Init events mapping and cache when needed
    if (!this.eventsMap) {
      
      // Mapping for "virtual" event names with their "real" event names counterparts 
      // that might be supported by device - or not (by preference order)
      this.eventsMap = new Map();
      this.eventsMap.set("EVT_POINTER_DOWN",     ["pointerdown", "touchstart", "mousedown"]);
      this.eventsMap.set("EVT_POINTER_ENTER",    ["pointerenter", "mouseenter"]);
      this.eventsMap.set("EVT_POINTER_OVER",     ["pointerover", "mouseover"]);
      this.eventsMap.set("EVT_POINTER_MOVE",     ["pointermove", "touchmove", "mousemove"]);
      this.eventsMap.set("EVT_POINTER_LEAVE",    ["pointerleave", "mouseleave"]);
      this.eventsMap.set("EVT_POINTER_UP",       ["pointerup", "touchend", "mouseup"]);
      this.eventsMap.set("EVT_POINTER_CANCEL",   ["pointercancel", "touchcancel"]);
      this.eventsMap.set("EVT_POINTER_OUT",      ["pointerout", "mouseout"]);
      this.eventsMap.set("EVT_POINTER_CLICK",    ["click"]);
      this.eventsMap.set("EVT_POINTER_DBLCLICK", ["dblclick"]);
      this.eventsMap.set("EVT_POINTER_CTXMENU",  ["contextmenu"]);
      
      // Cache for prefered listeners (lookup speedup)
      this.preferedEventsNames = new Map();
    }

    // Given abstractEventName, then try to retrieve previously cached prefered concrete js event
    const preferedEventName = this.preferedEventsNames.get(abstractEventName);
    if (preferedEventName) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Cache HIT for event ${abstractEventName}: found cached prefered event ${preferedEventName}`));
      return preferedEventName;
    }
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Cache MISS for event ${abstractEventName}: no supported prefered event cached`));

    // When no prefered concrete js event, then try to retrieve mapped events
    const mappedEvents = this.eventsMap.get(abstractEventName);
    if (!mappedEvents) {
      if (this.logger.isErrorEnabled()) console.error(...this.logger.error(`Unknwon abstractEventName ${abstractEventName}`));
      return null;
    }

    // Check for supported event into all mapped events
    for (const mappedEvent of mappedEvents) {
      if (this.isEventSupported(target, mappedEvent)) {

        // First supported event found: cache-it as prefered concrete js event
        this.preferedEventsNames.set(abstractEventName, mappedEvent);

        // Return prefered concrete js event
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Cache UPDATE for event ${abstractEventName}: set to prefered event ${mappedEvent}`));
        return mappedEvent;
      }
    }

    if (this.logger.isErrorEnabled()) console.error(...this.logger.error(`No concrete js event supported for ${abstractEventName}`));
    return null;    
  }

  isEventSupported(target, eventName) {
    return (typeof target[`on${eventName}`] === "function" || `on${eventName}` in target);
  }

  // vibrate the device like an haptic feedback
  hapticFeedback() {
    if (this.haptic) this.vibrateDevice(10);
  }

  // vibrate the device during specified duration (in milliseconds)
  vibrateDevice(duration) {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    } else {
      if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug('Vibration not supported on this device.'));
    }
  }

}

customElements.define("android-remote-card", AndroidRemoteCard);
