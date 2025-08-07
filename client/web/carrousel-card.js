import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';

console.info("Loading carrousel-card");

class CarrouselCard extends HTMLElement {
  constructor() {
    super();    
    this.attachShadow({ mode: "open" }); // Create shadow root

    this._hass = null;
    this._uiBuilt = false;
    this.card = null;
    
    // Configs
    this.config = null;
    this.loglevel = 'warn';
    this.logpushback = false;
    this.logger = new Logger(this.loglevel, this._hass, this.logpushback);
    this.eventManager = new EventManager(this.logger);
    this.resourceManager = new ResourceManager(this.logger, this.eventManager, import.meta.url);
    this.cellsWidth = 60;
    this.cellsHeight = 60;
    this.cells = [];

    this.cellImageModes = new Set(["img", "image", "ico", "icon", "pic", "picture", "photo"]);
    this.cellLabelModes = new Set(["txt", "text", "lbl", "label", "name"]);
    this.cellMixedModes = new Set(["mix", "mixed", "both", "all"]);
    
    // Layout loading flags
    this._layoutReady = false;
    this._layoutLoaded = {};
  }

  setConfig(config) {
    this.config = config;

    if (config) {
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
        this.logger.update(this.loglevel, this._hass, this.logpushback);
      }
      if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("setConfig(config):", this.config));
      
      // Set haptic feedback
      if (config['haptic']) {
        this.eventManager.setHaptic(config['haptic']);
      }
      
      // Set cells width
      if (config['cell_width']) {
        this.cellsWidth = config['cell_width'];
      }
      
      // Set cells height
      if (config['cell_height']) {
        this.cellsHeight = config['cell_height'];
      }
      
      // Set cells
      if (config['cells']) {
        this.cells = config['cells'];
      }
    }
    
  }

  getCardSize() {
    return 1;
  }

  async connectedCallback() {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("connectedCallback()"));

    // Check if layout needs loading
    if (!this._layoutLoaded.cellsWidth || this._layoutLoaded.cellsWidth !== this.cellsWidth
         || !this._layoutLoaded.cellsHeight || this._layoutLoaded.cellsHeight !== this.cellsHeight
         || !this._layoutLoaded.cells || (this.cells && !this.arraysEqual(this._layoutLoaded.cells, this.cells))
       ) {
      this._layoutReady = false;

      // Load layout
      await this.loadLayout();

      // Update loaded layout
      this._layoutLoaded.cellsWidth = this.cellsWidth;
      this._layoutLoaded.cellsHeight = this.cellsHeight;
      this._layoutLoaded.cells = this.cells;
      this._layoutReady = true;
    }

    // Only build UI if hass is already set
    if (this._hass) {
      this.resourceManager.synchronizeResources(this._hass);
      this.buildUi(this._hass);
    }
  }

  async loadLayout() {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("loadLayout():"));
    if (this.cells) {
      const allCells = Object.entries(this.cells);
      for (const [id, cell] of allCells) {
        const cellIconUrl = cell["icon-url"];
        if (cellIconUrl) {
          if (this.isValidUrl(cellIconUrl)) {
            if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Found image URL:${cellIconUrl}`, id));
          } else {
            // Local image requested: create the relative URL dynamically
            const newIconUrl = this.getLocalIconUrl(cellIconUrl);
            if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Found local image:${cellIconUrl}, will set it to relative URL:${newIconUrl}`, id));
          }
        }
      }
    }
  }

  set hass(hass) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("set hass(hass):", hass));
    this._hass = hass;
    if (!this._uiBuilt) {
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

    const card = document.createElement("ha-card");
    const style = document.createElement("style");
    style.textContent = `
      .carrousel-container {
        display: flex;
        width: 100%;
        overflow-x: auto; /* instead of hidden */
        white-space: nowrap;
        scroll-behavior: smooth; /* Optional */
      }
      .carrousel-cell {
        display: inline-flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: ${this.cellsWidth};
        height: ${this.cellsHeight};
        margin-left: 2px;
        margin-right: 2px;
        margin-top: 4px;
        margin-bottom: 4px;
        background: #2c2c2c;
        border-radius: 8px;
        overflow: hidden;
        text-align: center;
        color: white;
        font-size: 14px;
        box-sizing: border-box;
        cursor: pointer;
      }
      .carrousel-cell-content {
        display: inline-flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 4px;
        overflow: hidden;
        text-align: center;
        color: white;
        font-size: 14px;
        box-sizing: border-box;
        width: 90%;
        height: 90%;
        padding: 4px;
      }
      .carrousel-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .carrousel-cell .carrousel-content-wrapper {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      }
      .carrousel-cell .carrousel-content-wrapper.img-half {
        height: 70%;
      }
      .carrousel-cell .carrousel-content-wrapper.img-full {
        height: 100%;
      }
      .carrousel-label {
        display: flex;
        justify-content: center; /* Horizontal centering */
        align-items: center;     /* Vertical centering */
        width: 100%;
        height: 100%;
        white-space: normal;       /* allows wrapping */
        word-wrap: break-word;     /* allows breaking long words */
        overflow-wrap: break-word; /* better support for word breaking */
      }
      .carrousel-label.label-half {
        height: 30%;
      }
      .carrousel-label.label-full {
        height: 100%;
      }
    `;
    this.shadowRoot.appendChild(style);

    const container = document.createElement("div");
    container.className = "carrousel-container";

    Object.entries(this.cells).forEach(([id, cell]) => {
      // Create a new cell
      const cellDiv = document.createElement("div");
      cellDiv.className = "carrousel-cell";
      cellDiv.id = id;
      cellDiv._keyData = { config: cell };

      // Retrieve cell user configurations
      const cellId = id;
      const cellLabel = cell["label"] || cellId;

      const cellDisplayMode = cell["display-mode"];
      const cellBackgroundColor = cell["background-color"];
      const cellBackground = cell["background"];
      const targetDisplayMode = this.getDisplayMode(cellDisplayMode, cellId);

      // Create cell content
      const cellContent = document.createElement("div");
      cellContent.className = "carrousel-cell-content";

      // Set cell inner content (image, label)
      if (targetDisplayMode === "image") {
        // Image mode
        const img = this.createImage(cellId, cellLabel, cell);
        img.classList.add('img-full');
        cellContent.appendChild(img);

      } else if (targetDisplayMode === "label") {
        // Label mode
        const label = this.createLabel(cellId, cellLabel, cell);
        label.classList.add('label-full');
        cellContent.appendChild(label);

      } else {
        // Image and label mode
        const img = this.createImage(cellId, cellLabel, cell);
        img.classList.add('img-half');
        const label = this.createLabel(cellId, cellLabel, cell);
        label.classList.add('label-half');
        cellContent.appendChild(img);
        cellContent.appendChild(label);

      }

      // Apply user preferences over label style
      if (cellBackgroundColor) cellContent.style.backgroundColor = cellBackgroundColor;
      if (cellBackground) cellContent.style.background = cellBackground;

      cellDiv.appendChild(cellContent);

      this.eventManager.addPointerClickListener(cellDiv, (e) => {
        this.handlePointerClick(e, hass, cellDiv);
      });

      container.appendChild(cellDiv);
    });

    card.appendChild(container);
    this.shadowRoot.appendChild(card);
  }

  createImage(cellId, cellLabel, cell) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Creating image for cell '${cellId}'`));

    // Retrieve user preferences for image
    const cellIconUrl = cell["icon-url"];
    const cellIconGap = cell["icon-gap"];

    // Define image source URL
    const imgCellIconUrl = cellIconUrl ? (this.isValidUrl(cellIconUrl) ? cellIconUrl : this.getLocalIconUrl(cellIconUrl)) : "";
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Determined image URL '${imgCellIconUrl}' for cell '${cellId}'`));

    // Instanciates a content wrapper to avoid chromium-based browser bugs
    // (chromium does not properly apply padding to <img> elements inside flex containers—especially when img is 100% width/height and using object-fit)
    const wrapper = document.createElement("div");
    wrapper.className = "carrousel-content-wrapper";

    // Instanciates a new image
    const img = document.createElement("img");
    img.className = "carrousel-img";
    img.alt = cellLabel;
    img.addEventListener('error', () => {
      // Handle image loading error
      if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(`Unable to load image URL '${imgCellIconUrl}' for cell '${cellId}'`));

      // Hide image
      img.style.display = 'none';

      // Retrieve label with "Name" text as alternative
      const cellContent = img.parentElement;
      let label = cellContent.querySelector('.carrousel-label');

      // When missing label (because displayMode was set to image for example)
      // Create a new label inside the cell and display it
      if (!label) {
        label = this.createLabel(cellId, cellLabel, cell);
        cellContent.appendChild(label);
      }
      // Set the "full" class for the label (to make all rounded corners for example)
      label.classList.remove('label-half');
      label.classList.add('label-full');
    });

    // Apply user preferences on image style
    if (imgCellIconUrl) img.src = imgCellIconUrl;
    if (cellIconGap) wrapper.style.padding = cellIconGap; // apply gap on wrapper to avoid chrome bug

    // Append and return wrapper (not image itself)
    wrapper.appendChild(img);
    return wrapper;
  }

  createLabel(cellId, cellLabel, cell) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Creating label for cell '${cellId}'`));

    // Retrieve user preferences for label
    const cellLabelColor = cell["label-color"];
    const cellLabelSize = cell["label-size"];
    const cellLabelGap = cell["label-gap"];

    // Create wrapper (to align with image structure)
    const wrapper = document.createElement("div");
    wrapper.className = "carrousel-content-wrapper";

    // Instanciates a new label
    const label = document.createElement("div");
    label.className = "carrousel-label";
    label.textContent = cellLabel;

    // Apply user preferences on label style
    if (cellLabelColor) label.style.color = cellLabelColor;
    if (cellLabelSize) label.style.fontSize = cellLabelSize;
    if (cellLabelGap) wrapper.style.padding = cellLabelGap;

    // Append and return wrapper (not label itself)
    wrapper.appendChild(label);
    return wrapper;
  }

  handlePointerClick(evt, hass, cell) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const keyData = cell._keyData;
    if (!keyData) return;

    const config = keyData.config;

    if (config.action) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("Triggering action for cell:", cell, config.action));
      this.eventManager.triggerHaosTapAction(cell, config.action);
    }

    this.eventManager.hapticFeedback();
  }

  getDisplayMode(cellDisplayMode, cellId) {
    const defaultDisplayMode = 'image';
    let targetDisplayMode = null;
    if (cellDisplayMode) {
      // Lowerize for equality comparizons
      let loweredDisplayMode = cellDisplayMode.toLowerCase();
      if (this.cellImageModes.has(loweredDisplayMode)) {
        targetDisplayMode = "image";
      } else if (this.cellLabelModes.has(loweredDisplayMode)) {
        targetDisplayMode = "label";
      } else if (this.cellMixedModes.has(loweredDisplayMode)) {
        targetDisplayMode = "mixed";
      } else {
        const regex = /^\s*([^\s]+)\s*-\s*([^\s]+)\s*$/;
        const match = loweredDisplayMode.match(regex);
        if (match) {
          const displayModeOne = match[1];
          const displayModeTwo = match[2];

          // Both labels matches one then the other display mode: mixed mode
          if (
              (this.cellImageModes.has(displayModeOne) && this.cellLabelModes.has(displayModeTwo)) ||
              (this.cellLabelModes.has(displayModeOne) && this.cellImageModes.has(displayModeTwo))
             ) {
            targetDisplayMode = "mixed";
          }
        }
      }

      // Invalid cellDisplayMode specified by user: warn it
      if (!targetDisplayMode) {
        if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(`Unknown display mode '${cellDisplayMode}' for cell '${cellId}': defaulting to '${defaultDisplayMode}'`));
        targetDisplayMode = defaultDisplayMode;
      }
    }

    // No cellDisplayMode specified by user: defaulting silently
    if (!targetDisplayMode) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`No display mode provided for cell '${cellId}': defaulting to '${defaultDisplayMode}'`));
      targetDisplayMode = defaultDisplayMode;
    }
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Display mode set to '${targetDisplayMode}' for cell '${cellId}' (user configured mode:'${cellDisplayMode}')`));
    return targetDisplayMode;
  }

  isFiniteNumber(value) {
    return Number.isFinite(Number(value));
  }

  getLocalIconUrl(str) {
    return `${Globals.DIR_ICONS}/${str}`;
  }

  isValidUrl(str) {
    if (!str) return false;
    try {
      new URL(str);
      return true;
    } catch (_) {
      return false;
    }
  }

  arraysEqual(a, b) {
    return Array.isArray(a) &&
           Array.isArray(b) &&
           a.length === b.length &&
           a.every((val, index) => val === b[index]);
  }
}

customElements.define("carrousel-card", CarrouselCard);
