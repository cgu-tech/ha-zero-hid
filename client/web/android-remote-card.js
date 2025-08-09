import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';
import { androidRemoteCardConfig } from './configs/android-remote-card-config.js';
import * as layoutsRemote from './layouts/remote/index.js';

console.info("Loading android-remote-card");

class AndroidRemoteCard extends HTMLElement {

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _dynamicStyleNames = new Set();
  _pressedModifiers = new Set();
  _pressedKeys = new Set();
  _pressedConsumers = new Set();

  // private constants
  _layoutsByNames = this.constructor.getLayoutsByNames(layoutsRemote);
  _defaultCellConfigs = androidRemoteCardConfig;
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();

  constructor() {
    super();

    this._logger = new Logger("android-remote-card.js", this);
    this.eventManager = new EventManager(this);

    this.doCard();
    this.doStyle();
    this.doAttach();
    this.doQueryElements();
    this.doListen();

    this.doUpdateLayout();
  }

  getLogger() {
    return this._logger;
  }

  setConfig(config) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set setConfig(config):", config));
    this._config = config;
    this.doCheckConfig();
    this.doUpdateConfig();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass()
  }

  getAttachedLayoutName() {
    return this._elements.wrapper._layoutData?.name;
  }

  getLayoutName() {
    return this._config?.['layout'] || this.constructor.getStubConfig()['layout'];
  }

  getLayout() {
    return this._layoutsByNames[this.getLayoutName()];
  }

  getLayoutsNames() {
    return Object.keys(this._layoutsByNames);
  }

  // jobs
  doCheckConfig() {
    if (this._config.['layout'] && !this._layoutsByNames.has(this._config.['layout'])) {
      throw new Error(`Unknown layout "${this._config.['layout']}". Please define a known layout (${this.getLayoutsNames()}).`);
    }
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div id="main-container" class="card-content">
        <div class="wrapper">
        </div>
      </div>
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      :host {
        display: block;
        box-sizing: border-box;
        max-width: 100%;
        background: var(--card-background-color, white);
        border-radius: 0.5em;
        overflow: hidden; /* prevent overflow outside card */
        font-family: sans-serif;
      }
      #main-container {
        --base-font-size: 1rem; /* base scaling unit */
        font-size: var(--base-font-size);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        max-width: 100%;
      }
      .wrapper {
        display: flex;
        flex-direction: column;
      }
      .row {
        display: flex;
        flex-direction: row;
        width: 100%;
        flex-wrap: nowrap; /* to keep all items in a row */
        overflow-x: hidden; /* to prevent horizontal scroll */
      }
      .row.gap-top {
        margin-top: clamp(1px, 1vw, 6px);
      }
      .row.gap-bottom {
        margin-bottom: clamp(1px, 1vw, 6px);
      }
      .cell {
        min-width: 0; /* to allow shrinking */
        max-width: 100%;
        padding: clamp(1px, 1vw, 6px);
      }
      .cell.highlight {
        border-bottom-left-radius: 5px;
        border-bottom-right-radius: 5px;
        border-bottom-style: solid;
        border-bottom-width: 2px;
        border-image-outset: 0;
        border-image-repeat: stretch;
        border-image-slice: 100%;
        border-image-source: none;
        border-image-width: 1;
        border-left-color: rgb(155, 80, 0);
        border-left-style: solid;
        border-left-width: 2px;
        border-right-color: rgb(155, 80, 0);
        border-right-style: solid;
        border-right-width: 2px;
        border-top-color: rgb(155, 80, 0);
        border-top-left-radius: 5px;
        border-top-right-radius: 5px;
        border-top-style: solid;
        border-top-width: 2px;
        color: rgb(241, 108, 55);
        color-scheme: dark;
      }
      .cell.no-gap {
        padding: 0;
      }
      .standard-grey {
        fill: #bfbfbf;
        stroke: #bfbfbf;
      }
      .highlight-yellow {
        fill: #ffc107;
        stroke: #ffc107;
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
        font-size: clamp(1px, 4vw, 24px);
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
        font-size: clamp(1px, 5vw, 30px);
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
      #shield-tv-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      #shield-tv-icon-2 {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      #tv-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      #old-tv-icon {
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
      #arrow-up-icon {
        height: 100%;
        width: auto;
        display: block;
      }
      #arrow-right-icon {
        height: 100%;
        width: auto;
        display: block;
      }
      #arrow-down-icon {
        height: 100%;
        width: auto;
        display: block;
      }
      #arrow-left-icon {
        height: 100%;
        width: auto;
        display: block;
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
      #keyboard-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4);
      }
      #toggle-neutral {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.1, 0.1);
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
      #previous-track-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #play-pause-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #next-track-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #volumemute-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
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
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.wrapper = card.querySelector(".wrapper")
  }

  doListen() {
    //TODO: add global PointerUp listener?
  }

  doUpdateConfig() {
    if (this.getLayoutName() !== this.getAttachedLayoutName()) {
      this.doUpdateLayout();
    }
  }

  doUpdateHass() {
    // TODO: update overriden cells bounds to sensors
  }

  doUpdateLayout() {
    this.doResetLayout();
    this.doCreateLayout();
  }

  doResetLayout() {
    // Detach existing layout from DOM
    this._elements.wrapper.innerHTML = '';

    // Reset cells contents elements (if any)
    this._elements.cellContents = []

    // Reset cells elements (if any)
    this._elements.cells = []

    // Reset rows elements (if any)
    this._elements.rows = []
    
    // Reset layout name
    this._elements.wrapper._layoutData = { name: null };
  }

  doCreateLayout() {
    
    // Define layout name
    this._elements.wrapper._layoutData = { name: this.getLayoutName() };
    
    // Create rows
    for (const rowConfig of this.getLayout().rows) {
      const row = this.doRow(rowConfig);
      this.doStyleRow();
      this.doAttachRow(row);
      this.doQueryRowElements();
      this.doListenRow();
    }
  }

  doRow(rowConfig) {
    const row = document.createElement("div");
    this._elements.rows.push(row);
    row.classList.add('row');
    if (rowConfig["filler-top"]) row.classList.add('gap-top');
    if (rowConfig["filler-bottom"]) row.classList.add('gap-bottom');

    // Create cells
    for (const cellConfig of rowConfig.cells) {
      const cell = this.doCell(rowConfig, cellConfig);
      this.doStyleCell();
      this.doAttachCell(row, cell);
      this.doQueryCellElements();
      this.doListenCell();
    }

    return row;
  }

  doStyleRow() {
    // Nothing to do here: already included into card style
  }

  doAttachRow(row) {
    this._elements.wrapper.appendChild(row);
  }

  doQueryRowElements() {
    // Nothing to do here: element already referenced and sub-elements already are included by them
  }

  doListenRow() {
    // Nothing to do here: no listener on element and sub-elements listeners are included by them
  }

  doCell(rowConfig, cellConfig) {
    const cell = document.createElement("div");
    this._elements.cells.push(cell);
    cell.classList.add('cell');
    cell.classList.add(this.createSpanClass(cellConfig.weight));
    if (rowConfig["no-gap"]) cell.classList.add('no-gap'); // Remove internal padding on cell when required by the row

    // Create cell content
    const cellContent = this.doCellContent(cellConfig);
    this.doStyleCellContent();
    this.doAttachCellContent(cell, cellContent);
    this.doQueryCellContentElements();
    this.doListenCellContent(cellContent);

    return cell;
  }

  doStyleCell() {
    // Nothing to do here: already included into card style
  }

  doAttachCell(row, cell) {
    row.appendChild(cell);
  }

  doQueryCellElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenCell() {
    // Nothing to do here: no listener on element and sub-elements listeners are included by them
  }
  
  doCellContent(cellConfig) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("doCellContent(cellConfig):", cellConfig));

    // Retrieve target cell identifier (content will be created according to this name)
    const cellName = cellConfig.name;

    // Filler does not have cell content: skip cell content creation
    if (cellName === "filler") return null;

    // Retrieve default cell config that matches the cell name (when available)
    const defaultCellConfig = this._defaultCellConfigs[cellName];

    // Define cell content tag
    let cellContentTag = null;
    if (defaultCellConfig && defaultCellConfig.tag) cellContentTag = defaultCellConfig.tag; // Default config
    if (cellConfig.tag) cellContentTag = cellConfig.tag; // Override with user config when specified
    if (!cellContentTag) cellContentTag = "button"; // Fallback to "button" when no default nor user config available

    // Define cell content class
    let cellContentClass = null;
    if (defaultCellConfig && defaultCellConfig.visual) cellContentClass = defaultCellConfig.visual; // Default config
    if (cellConfig.visual) cellContentClass = cellConfig.visual; // Override with user config when specified
    if (!cellContentClass && cellContentTag === "button") cellContentClass = "circle-button"; // Fallback to "circle-button" visual when no default nor user config available and tag is a button

    // Define cell content inner html (when available)
    let cellContentHtml = null;
    if (defaultCellConfig && defaultCellConfig.html) cellContentHtml = defaultCellConfig.html; // Default config
    if (cellConfig.html) cellContentHtml = cellConfig.html; // Override with user config when specified
    // No default html fallback

    // Build cell content using previously defined tag + style + inner html
    let cellContent;
    if (cellContentTag === "svg") {
      cellContent = document.createElementNS(this.constructor.getSvgNamespace(), "svg");
      // Create Dpad content
      if (!cellContentHtml && cellName === "dpad") {
        const dpad = cellContent;
        const dpadConfig = cellConfig;
        this.doDpad(dpad, dpadConfig);
        this.doStyleDpad();
        this.doAttachDpad();
        this.doQueryDpadElements();
        this.doListenDpad();
      }
    } else {
      cellContent = document.createElement(cellContentTag);
    }
    this._elements.cellContents.push(cellContent);
    cellContent.id = cellName;
    if (cellContentClass) cellContent.className = cellContentClass;
    if (cellContentHtml) cellContent.innerHTML = cellContentHtml;

    // Add cell content data when cell content is a button
    if (cellContentTag === "button") this.addClickableData(cellContent, defaultCellConfig);

    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("created cellContent:", cellContent));
    return cellContent;
  }

  doStyleCellContent() {
    // Nothing to do here: already included into card style
  }

  doAttachCellContent(cell, cellContent) {
    cell.appendChild(cellContent);
  }

  doQueryCellContentElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenCellContent(cellContent) {
    this.addClickableListeners(cellContent);
  }

  doDpad(dpad, dpadConfig) {
    // Dpad config
    //TODO: externalize
    const padRadius = 100;
    const padPadding = 56;
    const padLineThick = 5;
    const center = padRadius;
    const rOuter = padRadius;
    const rInner = padRadius - padPadding;
    const centerRadius = padRadius - padPadding - padLineThick;
    const svgSize = padRadius * 2;

    dpad.setAttribute("viewBox", `0 0 ${svgSize} ${svgSize}`);
    dpad.setAttribute("preserveAspectRatio", "xMidYMid meet");
    dpad.style.width = "100%";
    dpad.style.height = "auto";
    dpad.style.flex = dpadConfig.weight;
    dpad.style["aspect-ratio"] = "1 / 1";

    const defs = document.createElementNS(this.constructor.getSvgNamespace(), "defs");
    dpad.appendChild(defs);

    // Dpad quarters config
    //TODO: externalize
    const quarters = [
      { quarterId: "remote-button-arrow-up"   , clipId: 'clip-quarter-1', angleStart: 225 },
      { quarterId: "remote-button-arrow-right", clipId: 'clip-quarter-2', angleStart: 315 },
      { quarterId: "remote-button-arrow-down" , clipId: 'clip-quarter-3', angleStart: 45  },
      { quarterId: "remote-button-arrow-left" , clipId: 'clip-quarter-4', angleStart: 135 }
    ];
    const arrowColor = "#bfbfbf";  // ← dynamic color
    const arrowScale = 0.6;          // ← 1 = normal size, <1 = smaller, >1 = larger

    for (const quarterConfig of quarters) {
      const dpadQuarter = this.doDpadQuarter(dpad, defs, center, rOuter, rInner, arrowColor, arrowScale, quarterConfig);
      this.doStyleDpadQuarter();
      this.doAttachDpadQuarter();
      this.doQueryDpadQuarterElements();
      this.doListenDpadQuarter(dpadQuarter);
    }

    const dpadCenter = this.doDpadCenter(dpad, center, centerRadius);
    this.doStyleDpadCenter();
    this.doAttachDpadCenter();
    this.doQueryDpadCenterElements();
    this.doListenDpadCenter(dpadCenter);
  }

  doStyleDpad() {
    // Nothing to do here: already included into card style
  }

  doAttachDpad() {
    // Nothing to do here: already attached by its parent
  }

  doQueryDpadElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenDpad() {
    // Nothing to do here: no listener on element and sub-elements listeners are included by them
  }

  doDpadQuarter(dpad, defs, center, rOuter, rInner, arrowColor, arrowScale, quarterConfig) {    

    // Quarter specific config
    const angleStart = quarterConfig.angleStart;
    const clipId = quarterConfig.clipId;
    const quarterId = quarterConfig.quarterId;

    const quarterPath = this.createQuarterPath(angleStart, center, rOuter, rInner);
    const clip = document.createElementNS(this.constructor.getSvgNamespace(), "clipPath");
    clip.setAttribute("id", clipId);
    const clipShape = document.createElementNS(this.constructor.getSvgNamespace(), "path");
    clipShape.setAttribute("d", quarterPath);
    clip.appendChild(clipShape);
    defs.appendChild(clip);

    const bg = document.createElementNS(this.constructor.getSvgNamespace(), "path");
    bg.setAttribute("d", quarterPath);
    bg.setAttribute("fill", "#4a4a4a");
    bg.setAttribute("clip-path", `url(#${clipId})`);
    dpad.appendChild(bg);

    const btn = document.createElementNS(this.constructor.getSvgNamespace(), "path");
    btn.setAttribute("d", quarterPath);
    btn.setAttribute("fill", "#3a3a3a");
    btn.setAttribute("clip-path", `url(#${clipId})`);
    btn.setAttribute("class", "quarter");
    btn.setAttribute("id", quarterId);
    this.addClickableData(btn, this._defaultCellConfigs[btn.id]);
    dpad.appendChild(btn);

    // Retrieve arrow content from default config
    const defaultCellConfig = this._defaultCellConfigs[quarterId];
    const arrowContentHtml = defaultCellConfig.html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(arrowContentHtml, "image/svg+xml");
    const arrowSvg = doc.documentElement;

    // Clean ID to avoid duplicate IDs in document
    arrowSvg.removeAttribute("id");

    // Set fill color on inner shapes
    const shapes = arrowSvg.querySelectorAll("path, polygon, circle, rect");
    shapes.forEach(shape => shape.setAttribute("fill", arrowColor));

    // Get the original viewBox
    const vb = arrowSvg.getAttribute("viewBox").split(" ").map(parseFloat);
    const [vbX, vbY, vbWidth, vbHeight] = vb;

    // Desired on-screen size (in your SVG coordinate system before scaling)
    const baseSize = 20; // adjust to your taste

    // Scale to fit iconSize in both dimensions
    const scaleX = (baseSize / vbWidth) * arrowScale;
    const scaleY = (baseSize / vbHeight) * arrowScale;

    // Create a group to wrap and position the arrow
    const iconGroup = document.createElementNS(this.constructor.getSvgNamespace(), "g");

    // Centered position in D-Pad arc
    const angle = (angleStart + 45) % 360;
    const labelPos = this.pointOnCircle(center, center, (rOuter + rInner) / 2, angle);

    // Position and center the viewBox origin
    iconGroup.setAttribute(
      "transform",
      `translate(${labelPos.x}, ${labelPos.y}) scale(${scaleX}, ${scaleY}) translate(${-vbX - vbWidth / 2}, ${-vbY - vbHeight / 2})`
    );

    // Move all children of the parsed SVG into the group
    while (arrowSvg.firstChild) {
      iconGroup.appendChild(arrowSvg.firstChild);
    }

    dpad.appendChild(iconGroup);

    return btn;
  }

  doStyleDpadQuarter() {
    // Nothing to do here: already included into card style
  }

  doAttachDpadQuarter() {
    // Nothing to do here: already attached during creation
    //TODO refactor in the future
  }

  doQueryDpadQuarterElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenDpadQuarter(dpadQuarter) {
    this.addClickableListeners(dpadQuarter);
  }

  doDpadCenter(dpad, center, centerRadius) {
    const centerCircle = document.createElementNS(this.constructor.getSvgNamespace(), "circle");
    centerCircle.setAttribute("cx", center);
    centerCircle.setAttribute("cy", center);
    centerCircle.setAttribute("r", centerRadius);
    centerCircle.setAttribute("fill", "#4a4a4a");
    dpad.appendChild(centerCircle);

    const btn = document.createElementNS(this.constructor.getSvgNamespace(), "circle");
    btn.setAttribute("cx", center);
    btn.setAttribute("cy", center);
    btn.setAttribute("r", centerRadius);
    btn.setAttribute("fill", "#3a3a3a");
    btn.setAttribute("class", "quarter");
    btn.setAttribute("id", "remote-button-center");
    this.addClickableData(btn, this._defaultCellConfigs[btn.id]);
    dpad.appendChild(btn);

    const centerLabel = document.createElementNS(this.constructor.getSvgNamespace(), "text");
    centerLabel.setAttribute("x", center);
    centerLabel.setAttribute("y", center);
    centerLabel.setAttribute("text-anchor", "middle");
    centerLabel.setAttribute("dominant-baseline", "middle");
    centerLabel.textContent = "OK";
    dpad.appendChild(centerLabel);

    return btn;
  }

  doStyleDpadCenter() {
    // Nothing to do here: already included into card style
  }

  doAttachDpadCenter() {
    //TODO
  }

  doQueryDpadCenterElements() {
    //TODO or 
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenDpadCenter(dpadCenter) {
    this.addClickableListeners(dpadCenter);
  }

  // Set key data with code to send when a button is clicked
  addClickableData(btn, btnConfig) {
    if (btnConfig && btnConfig.code) btn._keyData = { code: btnConfig.code };
    if (!btn._keyData) btn._keyData = {};
  }
  
  // Set listeners on a clickable button
  addClickableListeners(btn) {
    this.eventManager.addPointerDownListener(btn, this.onButtonPointerDown.bind(this));
    this.eventManager.addPointerUpListener(btn, this.onButtonPointerUp.bind(this));
    this.eventManager.addPointerCancelListener(btn, this.onButtonPointerUp.bind(this));
  }

  degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  pointOnCircle(cx, cy, r, deg) {
    const rad = this.degToRad(deg);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  createQuarterPath(angleStart, center, rOuter, rInner) {
    const angleEnd = (angleStart + 90) % 360;
    const p1 = this.pointOnCircle(center, center, rOuter, angleStart);
    const p2 = this.pointOnCircle(center, center, rOuter, angleEnd);
    const p3 = this.pointOnCircle(center, center, rInner, angleEnd);
    const p4 = this.pointOnCircle(center, center, rInner, angleStart);
    return `M ${p1.x} ${p1.y}
            A ${rOuter} ${rOuter} 0 0 1 ${p2.x} ${p2.y}
            L ${p3.x} ${p3.y}
            A ${rInner} ${rInner} 0 0 0 ${p4.x} ${p4.y}
            Z`;
  }

  createSpanClass(flex) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("createSpanClass(flex):", flex));
    const styleName = this.getStyleSpanName(flex);
    if (!this._dynamicStyleNames.has(styleName)) {
      const dynamicStyle = `
        .${styleName} {
          flex: ${flex};
        }`;
      this._elements.style.textContent += dynamicStyle;
      this._dynamicStyleNames.add(styleName);
    }
    return styleName;
  }

  getStyleSpanName(flex) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("getStyleSpanName(flex):", flex));
    const flexStr = String(flex);
    const styleId = flexStr.replace(/\./g, '-');
    return `span-${styleId}`;
  }

  // configuration defaults
  static getStubConfig() {
    return {
      log_level: "warn",
      log_pushback: false,
      layout: "classic",
      haptic: true,
      keyboard: {},
      mouse: {},
      activities: {},
      auto_scroll: true
    }
  }

  static getSvgNamespace() {
    return "http://www.w3.org/2000/svg";
  }

  static getLayoutsByNames(layouts) {
    const layoutsByNames = {};
    for (const layout of Object.values(layouts)) {
      layoutsByNames[layout.Name] = layout;
    }
    return layoutsByNames;
  }

  getCardSize() {
    return 4;
  }

  onButtonPointerDown(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const btn = evt.currentTarget; // Retrieve clickable button attached to the listener that triggered the event
    this.doKeyPress(btn);
  }

  onButtonPointerUp(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const btn = evt.currentTarget; // Retrieve clickable button attached to the listener that triggered the event
    this.doKeyRelease(btn);
  }

  doKeyPress(btn) {

    // Mark clickable button active for visual feedback
    btn.classList.add("active");

    // Retrieve clickable button data
    const keyData = btn._keyData;
    if (!keyData) return;

    // Key code to press
    const code = keyData.code;
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Key code to press:", code));

    // Make this clickable button press the reference button to prevent unwanted releases trigger from other clickable buttons in the future
    this._referenceBtn = btn;

    if (this.hasOverrideAction(btn)) {
      // Override detected: do nothing (override action will be executed on button up)
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Override detected on key press (suppressed):", btn.id));
    } else {
      // Default action

      // Press HID key
      this.appendCode(code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded press event
    this.eventManager.hapticFeedback();
  }

  doKeyRelease(btn) {

    // Unmark clickable button active for visual feedback
    btn.classList.remove("active");

    // Retrieve clickable button data
    const keyData = btn._keyData;
    if (!keyData) return;

    // Key code to release
    const code = keyData.code;
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Key code to release:", code));

    // Suppress this clickable button release if reference pointer down event was originated from a different clickable button
    const referenceCode = this._referenceBtn?._keyData?.code;
    if (referenceCode !== code) {
      //TODO: foolproof multiples buttons with same code, by using unique ID per button for reference and comparison, instead of key code
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted due to existing reference key code ${referenceCode}`));
      return;
    }

    if (this.hasOverrideAction(btn)) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Override detected on key release:", btn.id));
      this.executeOverrideAction(btn);
    } else {
      // Default action

      // Release HID key
      this.removeCode(hass, code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded release event
    this.eventManager.hapticFeedback();
  }

  hasOverrideAction(btn) {
    const overridesConfig = this._config['buttons-override'];
    return (btn.id && overridesConfig && overridesConfig[btn.id]);
  }

  executeOverrideAction(btn) {
    const btnId = btn.id;
    const overridesConfig = this._config['buttons-override'][btnId];

    // Select override action
    let overrideAction;
    if (overridesConfig['sensor']) {
      if (btn._sensorState && btn._sensorState.toLowerCase() === "on") {
        overrideAction = overridesConfig['action-when-on'];
      } else {
        overrideAction = overridesConfig['action-when-off'];
      }
    } else {
      overrideAction = overridesConfig['action'];
    }

    // Trigger override action
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Triggering override action for:", btnId, overrideAction));
    this.eventManager.triggerHaosTapAction(btn, overrideAction);
  }

  appendCode(code) {
    if (code) {
      if (this.isKey(code) || this.isModifier(code)) {
        this.appendKeyCode(code);
      } else if (this.isConsumer(code)) {
        this.appendConsumerCode(code);
      } else {
        if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("Unknown code type:", code));
      }
    }
  }

  appendKeyCode(code) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Key pressed:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key pressed
        this._pressedModifiers.add(intCode);
      } else {
        // Standard key pressed
        this._pressedKeys.add(intCode);
      }
    }
    this.sendKeyboardUpdate();
  }

  appendConsumerCode(hass, code) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Consumer pressed:", code));
    if (code) {
      const intCode = this._consumercodes[code];
      this._pressedConsumers.add(intCode);
    }
    this.sendConsumerUpdate();
  }

  removeCode(hass, code) {
    if (code) {
      if (this.isKey(code) || this.isModifier(code)) {
        this.removeKeyCode(hass, code);
      } else if (this.isConsumer(code)) {
        this.removeConsumerCode(hass, code);
      } else {
        if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("Unknown code type:", code));
      }
    }
  }

  removeKeyCode(hass, code) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Key released:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key released
        this._pressedModifiers.delete(intCode);
      } else {
        // Standard key released
        this._pressedKeys.delete(intCode);
      }
    }
    this.sendKeyboardUpdate();
  }

  removeConsumerCode(hass, code) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Consumer released:", code));
    if (code) {
      const intCode = this._consumercodes[code];
      this._pressedConsumers.delete(intCode);
    }
    this.sendConsumerUpdate();
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
  sendKeyboardUpdate() {
    this.eventManager.callComponentService(this._hass, "keypress", {
      sendModifiers: Array.from(this._pressedModifiers),
      sendKeys: Array.from(this._pressedKeys),
    });
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendConsumerUpdate() {
    this.eventManager.callComponentService(this._hass, "conpress", {
      sendCons: Array.from(this._pressedConsumers),
    });
  }

}

customElements.define("android-remote-card", AndroidRemoteCard);
