import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';

console.info("Loading carrousel-card");

class CarrouselCard extends HTMLElement {

  // private constants
  static _CELL_MODE_IMAGE = "image";
  static _CELL_MODE_LABEL = "label";
  static _CELL_MODE_MIXED = "mixed";

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;

  _cellModesMap = new Map();
  _reversedCellModesMap = new Map();

  constructor() {
    super();    

    // Mapping for mode names with their accepted mode names identifiers counterparts
    this._cellModesMap.set(this.constructor._CELL_MODE_IMAGE, ["image", "img", "icon", "ico", "picture", "pic", "photo"]);
    this._cellModesMap.set(this.constructor._CELL_MODE_LABEL, ["label", "lbl", "text", "txt", "name"]);
    this._cellModesMap.set(this.constructor._CELL_MODE_MIXED, ["mixed", "mix", "all" , "both"]);

    // Create mixed combinations mappings dynamically
    const cellModeMixedIds = this._cellModesMap.get(this.constructor._CELL_MODE_MIXED;
    for (const cellModeImageId of this._cellModesMap.get(this.constructor._CELL_MODE_IMAGE)) {
      for (const cellModeLabelId of this._cellModesMap.get(this.constructor._CELL_MODE_LABEL)) {
        cellModeMixedIds.push(`${cellModeImageId}-${cellModeLabelId}`);
        cellModeMixedIds.push(`${cellModeLabelId}-${cellModeImageId}`);
      }
    }

    // Reversed mapping for each mode name identifier with its mode name counterpart
    // ex: "ico" --> "image"
    for (const [cellMode, cellModeIdentifiers] of this._cellModesMap.entries()) {
      for (const cellModeIdentifier of cellModeIdentifiers) {
        this._reversedCellModesMap.set(cellModeIdentifier, cellMode);
      }
    }

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
  getDisplayMode() {
    return this._layoutManager.getFromConfigOrDefaultConfig("display_mode");
  }
  
  getCellDisplayMode(cellConfig) {
    const configDisplayMode = (cellConfig?.["display_mode"] || this.getDisplayMode()).toLowerCase();
    return this._reversedCellModesMap.get(configDisplayMode);
  }

  // jobs
  doCheckConfig() {
    //TODO: check config in details
    
    // TODO: check configured display mode
    //  // Invalid cellDisplayMode specified by user: warn it
    //  if (!targetDisplayMode) {
    //    if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(`Unknown display mode '${cellDisplayMode}' for cell '${cellId}': defaulting to '${defaultDisplayMode}'`));
    //    targetDisplayMode = defaultDisplayMode;
    //  }
    //}
    //
    //// No cellDisplayMode specified by user: defaulting silently
    //if (!targetDisplayMode) {
    //  if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`No display mode provided for cell '${cellId}': defaulting to '${defaultDisplayMode}'`));
    //  targetDisplayMode = defaultDisplayMode;
    //}
    //if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Display mode set to '${targetDisplayMode}' for cell '${cellId}' (user configured mode:'${cellDisplayMode}')`));
    //return targetDisplayMode;
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
    const cell = document.createElement("div");
    cell.className = "carrousel-cell";
    cell.id = cellId;
    this.setCellData(cell, null, { "cellConfig": cellConfig });

    // Create cell content
    const cellContent = this.doCellContent(cellId, cellConfig);
    this.doStyleCellContent();
    this.doAttachCellContent();
    this.doQueryCellContentElements();
    this.doListenCellContentElements();

    return cell;
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
    this.eventManager.addPointerClickListener(cell, this.onCellPointerClick().bind(this));
  }

  onCellPointerClick(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("onCellPointerClick(evt):", evt));
    const cell = evt.currentTarget; // Retrieve clickable button attached to the listener that triggered the event
    this.doCellPointerClick(cell);
  }

  doCellPointerClick(cell) {
    const cellData = this._layoutManager.getElementData(cell);
    if (!cellData) return;

    const cellConfig = cellData.cellConfig;
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Cell config to execute:", cellConfig));

    if (!cellConfig.action) {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`Cell config ${cellConfig} release aborted due to missing action`));
    } else {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("Triggering action for cell:", cell, cellConfig.action));
      this.eventManager.triggerHaosTapAction(cell, cellConfig.action);
    }

    this.eventManager.hapticFeedback();
  }

  doCellContent(cellId, cellConfig) {

    // Retrieve cell user configurations
    const cellLabel = cellConfig["label"] || cellId;

    // Create cell content
    const cellContent = document.createElement("div");
    cellContent.className = "carrousel-cell-content";

    // Create cell content inner label
    const cellContentLabel = this.doCellContentLabel(cellId, cellLabel, cellConfig);
    this.doStyleCellContentLabel(cellContentLabel, cellConfig);
    this.doAttachCellContentLabel(cellContent, cellContentLabel);
    this.doQueryCellContentLabelElements();
    this.doListenCellContentLabel();

    // Create cell content inner image
    const cellContentImage = this.doCellContentImage(cellId, cellLabel, cellConfig);
    this.doStyleCellContentImage();
    this.doAttachCellContentImage(cellContent, cellContentImage);
    this.doQueryCellContentImageElements();
    this.doListenCellContentImage();

    return cellContent;
  }

  doStyleCellContent(cellContent, cellConfig) {
    // Apply user preferences over cell content background
    const cellBackgroundColor = cellConfig["background_color"];
    const cellBackground = cellConfig["background"];
    if (cellBackgroundColor) cellContent.style.backgroundColor = cellBackgroundColor;
    if (cellBackground) cellContent.style.background = cellBackground;
  }

  doAttachCellContent(cell, cellContent) {
    cell.appendChild(cellContent);
  }

  doQueryCellContentElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenCellContent() {
    // Nothing to do here: no events needed on cell content
  }

  doCellContentImage(cellId, cellLabel, cellConfig) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`doCellContentImage(cellId, cellLabel, cellConfig):`, cellId, cellLabel, cellConfig));

    // When mode is not "image" or "mixed", do not create cell content image
    const cellDisplayMode = this.getCellDisplayMode(cellConfig);
    if (cellDisplayMode !== "image" && cellDisplayMode !== "mixed") return null;

    // Retrieve user preferences for image
    const cellIconUrl = cellConfig["icon_url"];

    // Define image source URL
    const imgCellIconUrl = cellIconUrl ? (this.isValidUrl(cellIconUrl) ? cellIconUrl : this.getLocalIconUrl(cellIconUrl)) : "";
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Determined image URL '${imgCellIconUrl}' for cell '${cellId}'`));

    // Instanciates a content wrapper to avoid chromium-based browser bugs
    // (chromium does not properly apply padding to <img> elements inside flex containers—especially when img is 100% width/height and using object-fit)
    const cellContentImage = document.createElement("div");
    cellContentImage.className = "carrousel-content-wrapper";
    if (cellDisplayMode === "image") cellContentImage.classList.add('img-full');
    if (cellDisplayMode === "mixed") cellContentImage.classList.add('img-half');

    // Instanciates image (but do not load it for now)
    const img = document.createElement("img");
    cellContentImage._image = img;
    img.className = "carrousel-img";
    img.alt = cellLabel;
    img.addEventListener('error', this.onImageLoadError.bind(this, img, imgCellIconUrl, cellId));

    // Append and return wrapper (not image itself)
    cellContentImage.appendChild(img);
    return cellContentImage;
  }

  doStyleCellContentImage(cellContentImage, cellConfig) {
    // Retrieve user preferences for image
    const cellIconGap = cellConfig["image_gap"];

    // Apply user preferences on image style
    if (cellIconGap) cellContentImage.style.padding = cellIconGap;
  }

  doAttachCellContentImage(cellContent, cellContentImage) {
    cellContent.appendChild(cellContentImage);
  }

  doQueryCellContentImageElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenCellContentImage() {
    // Nothing to do here: no events needed on cell content
  }

  doLoadImage(img, imgCellIconUrl) {
    if (imgCellIconUrl) img.src = imgCellIconUrl;
  }

  onImageLoadError(img, imgCellIconUrl, cellId, err) {
    // Handle image source loading error
    if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(`Unable to load image URL '${imgCellIconUrl}' for cell '${cellId}'`));

    // Hide image
    img.style.display = 'none';

    // Retrieve label with "Name" text as alternative
    const cellContent = img.parentElement;
    let label = cellContent.querySelector('.carrousel-label');

    // When missing label (because displayMode was set to image for example)
    // Create a new label inside the cell and display it
    if (!label) {
      label = this.createCellContentLabel(cellId, cellLabel, cellConfig);
      cellContent.appendChild(label);
    }
    // Set the "full" class for the label (to make all rounded corners for example)
    label.classList.remove('label-half');
    label.classList.add('label-full');
  }

  doCellContentLabel(cellId, cellLabel, cell) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`doCellContentLabel(cellId, cellLabel, cellConfig):`, cellId, cellLabel, cellConfig));

    // Independently of current cell display mode, always create the label (to serve as fallback for image loading error)
    const cellDisplayMode = this.getCellDisplayMode(cellConfig);

    // Instanciates a content wrapper for layout consistency, relatives to image layout circument of chromium-based browser bugs
    // (see doCellContentImage for details about this specificity)
    const cellContentLabel = document.createElement("div");
    cellContentLabel.className = "carrousel-content-wrapper";
    if (cellDisplayMode === "label") cellContentLabel.classList.add('label-full');
    if (cellDisplayMode === "mixed") cellContentLabel.classList.add('label-half');

    // Instanciates a new label
    const label = document.createElement("div");
    cellContentLabel._label = label;
    label.className = "carrousel-label";
    label.textContent = cellLabel;

    // Append and return wrapper (not label itself)
    cellContentLabel.appendChild(label);
    return cellContentLabel;
  }

  doStyleCellContentLabel(cellContentLabel, cellConfig) {
    // Retrieve user preferences for label
    const cellLabelGap = cellConfig["label_gap"];
    const cellLabelColor = cellConfig["label_color"];
    const cellLabelSize = cellConfig["label_size"];

    // Apply user preferences on cell content label container style
    if (cellLabelGap) cellContentLabel.style.padding = cellLabelGap;
    
    // Apply user preferences on cell content label style
    if (cellLabelColor) cellContentLabel._label.style.color = cellLabelColor;
    if (cellLabelSize) cellContentLabel._label.style.fontSize = cellLabelSize;
  }

  doAttachCellContentLabel(cellContent, cellContentLabel) {

    // When display mode requires it explicitely, attach label to cell content
    const cellDisplayMode = this.getCellDisplayMode(cellConfig);
    if (cellDisplayMode === "label" && cellDisplayMode === "mixed") cellContent.appendChild(cellContentLabel);
  }

  doQueryCellContentLabelElements() {
    // Nothing to do here: element does not need to be referenced and sub-element is already referenced
  }

  doListenCellContentLabel() {
    // Nothing to do here: no events needed on cell content label
  }

  // configuration defaults
  static getStubConfig() {
    return {
      haptic: true,
      log_level: "warn",
      log_pushback: false,
      display_mode: "mixed",
      cell_width: 60,
      cell_height: 60,
      cells: []
    };
  }

  getCardSize() {
    return 1;
  }

  // Set key data
  setCellData(cell, defaultConfig, overrideConfig) {
    this._layoutManager.setElementData(cell, defaultConfig, overrideConfig, (key, value, source) => this._allowedCellData.has(key));
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
