import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';

console.info("Loading carrousel-card");

class CarrouselCard extends HTMLElement {

  // private constants
  _cellImageModes = new Set(["img", "image", "ico", "icon", "pic", "picture", "photo"]);
  _cellLabelModes = new Set(["txt", "text", "lbl", "label", "name"]);
  _cellMixedModes = new Set(["mix", "mixed", "both", "all"]);

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;

  constructor() {
    super();    

    this._logger = new Logger(this, "carrousel-card.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, null);
    this._resourceManager = new ResourceManager(this, import.meta.url);

    this.doCard();
    this.doStyle();
    this.doAttach();
    this.doQueryElements();
    this.doListen();
  }

  getLogger() {
    return this._logger;
  }

  setConfig(config) {
    this._config = config;
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set setConfig(config):", config));
    this.doCheckConfig();
    this.doUpdateConfig();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass()
  }

  getCellWidth() {
    return this._layoutManager.getFromConfigOrDefaultConfig("cell_width");
  }
  getCellHeight() {
    return this._layoutManager.getFromConfigOrDefaultConfig("cell_height");
  }
  getCells() {
    return this._layoutManager.getFromConfigOrDefaultConfig("cells");
  }

  // jobs
  doCheckConfig() {
    //TODO: check config in details
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div class="carrousel-container">
      </div>
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
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
        width: ${this.getCellWidth()};
        height: ${this.getCellHeight()};
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
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.container = card.querySelector(".carrousel-container");
  }

  doListen() {
    // Nothing to do here: events are listened per sub-element
  }

  doUpdateConfig() {
    // Layout is user defined complex structure: always rebuild
    this.doUpdateLayout();
  }

  doUpdateHass() {
    // Nothing to do here: no specific HA entity state to listen for this card
    //TODO: treat auto-refresh for all cards: this.resourceManager.synchronizeResources(this._hass);
  }

  doUpdateLayout() {
    this.doResetLayout();
    this.doCreateLayout();
  }

  doResetLayout() {
    // Clear existing container DOM content
    this._elements.container.innerHTML = '';
    
    // Reset associated cells
    this._elements.cells = [];
  }

  doCreateLayout() {

    // Create all cells
    for (const [cellId, cellConfig] of this.getCells().entries()) {
      const cell = this.doCell(cellId, cellConfig);
      this.doStyleCell();
      this.doAttachCell(cell);
      this.doQueryCellElements();
      this.doListenCell(cell);
    }
  }

  doCell(cellId, cellConfig) {

    // Create a new cell
    const cellDiv = document.createElement("div");
    cellDiv.className = "carrousel-cell";
    cellDiv.id = id;
    cellDiv._keyData = { config: cell };

    // Retrieve cell user configurations
    const cellLabel = cellConfig["label"] || cellId;

    const cellDisplayMode = cellConfig["display-mode"];
    const cellBackgroundColor = cellConfig["background-color"];
    const cellBackground = cellConfig["background"];
    const targetDisplayMode = this.getDisplayMode(cellDisplayMode, cellId);

    // Create cell content
    const cellContent = document.createElement("div");
    cellContent.className = "carrousel-cell-content";

    // Set cell inner content (image, label)
    if (targetDisplayMode === "image") {
      // Image mode
      const img = this.createImage(cellId, cellLabel, cellConfig);
      img.classList.add('img-full');
      cellContent.appendChild(img);

    } else if (targetDisplayMode === "label") {
      // Label mode
      const label = this.createLabel(cellId, cellLabel, cellConfig);
      label.classList.add('label-full');
      cellContent.appendChild(label);

    } else {
      // Image and label mode
      const img = this.createImage(cellId, cellLabel, cellConfig);
      img.classList.add('img-half');
      const label = this.createLabel(cellId, cellLabel, cellConfig);
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
  }

  doStyleCell() {
    // Nothing to do here: already included into card style
  }

  doAttachCell(cell) {
    this._elements.container.appendChild(cell);
  }

  doQueryCellElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenCell(cell) {
    this.addClickableListeners(cell);
  }

  // configuration defaults
  static getStubConfig() {
    return {
      haptic: true,
      log_level: "warn",
      log_pushback: false,
      cell_width: 60,
      cell_height: 60,
      cells: []
    };
  }

  getCardSize() {
    return 1;
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
      if (this._cellImageModes.has(loweredDisplayMode)) {
        targetDisplayMode = "image";
      } else if (this._cellLabelModes.has(loweredDisplayMode)) {
        targetDisplayMode = "label";
      } else if (this._cellMixedModes.has(loweredDisplayMode)) {
        targetDisplayMode = "mixed";
      } else {
        const regex = /^\s*([^\s]+)\s*-\s*([^\s]+)\s*$/;
        const match = loweredDisplayMode.match(regex);
        if (match) {
          const displayModeOne = match[1];
          const displayModeTwo = match[2];

          // Both labels matches one then the other display mode: mixed mode
          if (
              (this._cellImageModes.has(displayModeOne) && this._cellLabelModes.has(displayModeTwo)) ||
              (this._cellLabelModes.has(displayModeOne) && this._cellImageModes.has(displayModeTwo))
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

  arraysEqual(a, b) {
    return Array.isArray(a) &&
           Array.isArray(b) &&
           a.length === b.length &&
           a.every((val, index) => val === b[index]);
  }
}

customElements.define("carrousel-card", CarrouselCard);
