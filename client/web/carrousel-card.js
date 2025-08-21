import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';

console.info("Loading carrousel-card");

export class CarrouselCard extends HTMLElement {

  // private init required constants
  static _CELL_MODE_IMAGE = "image";
  static _CELL_MODE_LABEL = "label";
  static _CELL_MODE_MIXED = "mixed";

  static _ORIENTATION_HORIZONTAL = "horizontal";
  static _ORIENTATION_VERTICAL = "vertical";

  // private constants
  _allowedCellData = new Set(['action', 'cellName', 'imageUrl']);

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
  _orientation;

  constructor() {
    super();    

    // Mapping for mode names with their accepted mode names identifiers counterparts
    this._cellModesMap.set(this.constructor._CELL_MODE_IMAGE, ["image", "img", "icon", "ico", "picture", "pic", "photo"]);
    this._cellModesMap.set(this.constructor._CELL_MODE_LABEL, ["label", "lbl", "text", "txt", "name"]);
    this._cellModesMap.set(this.constructor._CELL_MODE_MIXED, ["mixed", "mix", "all" , "both"]);

    // Create mixed combinations mappings dynamically
    const cellModeMixedIds = this._cellModesMap.get(this.constructor._CELL_MODE_MIXED);
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
    if (this.getLogger().isDebugEnabled()) this.getLogger().doLogOnError(this.doSetConfig.bind(this)); else this.doSetConfig();
  }
  doSetConfig() {
    this.doCheckConfig();
    this.doUpdateConfig();
  }

  setOrientation(orientation) {
    this._orientation = orientation;
    this.doUpdateOrientation();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass()
  }

  connectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("connectedCallback()"));
    this._eventManager.connectedCallback();
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this._eventManager.disconnectedCallback();
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  // Global config
  getCells() {
    return this._layoutManager.getFromConfigOrDefaultConfig("cells");
  }
  getOrientation() {
    const orientation = this._orientation || this._layoutManager.getFromConfigOrDefaultConfig("orientation");
    const orientationLow = (typeof orientation === 'string' ? orientation?.toLowerCase() : null);
    return (orientationLow === this.constructor._ORIENTATION_VERTICAL ? this.constructor._ORIENTATION_VERTICAL : this.constructor._ORIENTATION_HORIZONTAL);
  }

  // Global and overridable per cell config
  getCellDisplayMode(cellConfig) {
    return this._reversedCellModesMap.get(this.getCellConfigOrDefault(cellConfig, "display_mode"));
  }
  getCellBackground(cellConfig) {
    return this.getCellConfigOrDefault(cellConfig, "background");
  }
  getCellWidth(cellConfig) {
    return this.getCellConfigOrDefault(cellConfig, "width");
  }
  getCellHeight(cellConfig) {
    return this.getCellConfigOrDefault(cellConfig, "height");
  }
  getCellLabel(cellConfig) {
    return this.getCellConfigOrDefault(cellConfig, "label"); 
  }
  getCellLabelFontScale(cellConfig) {
    return this._layoutManager.getScaleOrDefault(this.getCellConfigOrDefault(cellConfig, "label_font_scale"), "1rem");
  }
  getCellLabelGap(cellConfig) {
    return this.getCellConfigOrDefault(cellConfig, "label_gap");
  }
  getCellLabelColor(cellConfig) {
    return this.getCellConfigOrDefault(cellConfig, "label_color");
  }
  getCellImageUrl(cellConfig) {
    const imageUrl = this.getCellConfigOrDefault(cellConfig, "image_url");
    return imageUrl ? (this._resourceManager.isValidUrl(imageUrl) ? imageUrl : this._resourceManager.getLocalIconUrl(imageUrl)) : "";
  }
  getCellImageGap(cellConfig) {
    return this.getCellConfigOrDefault(cellConfig, "image_gap");
  }
  getCellAction(cellConfig) {
    return this.getCellConfigOrDefault(cellConfig, "cell_action");
  }

  // Per cell config helper
  getCellConfigOrDefault(cellConfig, property) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("getCellConfigOrDefault(cellConfig, property):", cellConfig, property));
    const cellProperty = `cell_${property}`;
    return cellConfig?.[property] || this._layoutManager.getFromConfigOrDefaultConfig(cellProperty);
  }

  // Dynamic config
  getDynamicCellName(defaultCellConfig) {
    return defaultCellConfig["cellName"]; 
  }
  getDynamicCellImageUrl(defaultCellConfig) {
    return defaultCellConfig["cellImageUrl"]; 
  }
  createDynamicCellConfig(cellName, cellImageUrl) {
    return { "cellName": cellName, "cellImageUrl": cellImageUrl };
  }


  // jobs
  doCheckConfig() {
    //TODO: check config in details
    
    // TODO: check configured display mode
    //  // Invalid cellDisplayMode specified by user: warn it
    //  if (!targetDisplayMode) {
    //    if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`Unknown display mode '${cellDisplayMode}' for cell '${cellName}': defaulting to '${defaultDisplayMode}'`));
    //    targetDisplayMode = defaultDisplayMode;
    //  }
    //}
    //
    //// No cellDisplayMode specified by user: defaulting silently
    //if (!targetDisplayMode) {
    //  if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`No display mode provided for cell '${cellName}': defaulting to '${defaultDisplayMode}'`));
    //  targetDisplayMode = defaultDisplayMode;
    //}
    //if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Display mode set to '${targetDisplayMode}' for cell '${cellName}' (user configured mode:'${cellDisplayMode}')`));
    //return targetDisplayMode;
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div class="carrousel-container ${this.getOrientation()}">
      </div>
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      :host {
        --card-corner-radius: 10px;
        --cell-min-corner-radius: 4px;
        --cell-max-corner-radius: 8px;
        --cell-bg: #3b3a3a;
        --cell-active-bg: #4a4a4a;
        --cell-press-bg: #6a6a6a;
      }
      .carrousel-container {
        display: flex;
        scroll-behavior: smooth;
      }
      .carrousel-container.horizontal {
        flex-direction: row;
        width: 100%;
        overflow-x: auto;
        white-space: nowrap;
      }
      .carrousel-container.vertical {
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
      }
      .carrousel-cell {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin: 1px;
        background: var(--cell-bg);
        border-radius: 8px;
        overflow: hidden;
        text-align: center;
        color: white;
        font-size: 14px;
        box-sizing: border-box;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      .carrousel-cell.vertical {
        width: 100%;
      }
      .carrousel-cell.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background-color: var(--cell-active-bg);
      }
      .carrousel-cell.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background-color: var(--cell-press-bg);
        transform: scale(0.95);
      }
      .carrousel-cell.${this._eventManager.constructor._BUTTON_CLASS_HOVER} * {
        opacity: 0.95;
      }
      .carrousel-cell.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} * {
        opacity: 0.85;
      }
      .carrousel-cell-content {
        display: inline-flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 8px;
        overflow: hidden;
        text-align: center;
        color: white;
        font-size: 14px;
        box-sizing: border-box;
        height: 95%;
        width: 95%;       /* fill parent */
        padding: 2px;      /* keep padding if needed */Z
      }
      .carrousel-cell-content-part {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      }
      .carrousel-cell-content-part.img.half {
        height: 70%;
      }
      .carrousel-cell-content-part.label.half {
        height: 30%;
      }
      .carrousel-cell-content-part.full {
        height: 100%;
      }
      .carrousel-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .carrousel-label {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        white-space: normal;       /* allows wrapping */
        word-wrap: break-word;     /* allows breaking long words */
        overflow-wrap: break-word; /* better support for word breaking */
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
    //TODO: treat auto-refresh for all cards: this._resourceManager.synchronizeResources(this._hass);
  }

  doUpdateLayout() {
    this.doResetLayout();
    this.doCreateLayout();
  }

  doResetLayout() {
    // Clear previous listeners
    this._eventManager.clearListeners("layoutContainer");

    // Clear existing container DOM content
    this._elements.container.innerHTML = '';
    
    // Reset associated cells
    this._elements.cells = [];
  }

  doCreateLayout() {
    // Create all cells
    for (const [cellName, cellConfig] of Object.entries(this.getCells())) {
      const cell = this.doCell(cellName, cellConfig);
      this.doStyleCell(cell, cellConfig);
      this.doAttachCell(cell);
      this.doQueryCellElements();
      this.doListenCell(cell);
    }
    
    // Update orientation
    this.doUpdateOrientation();
  }
  
  doUpdateOrientation() {
    // Setup container orientation
    this.doUpdateElementOrientation(this._elements.container);
    
    // Setup cells orientation
    for (const cell of (this._elements?.cells ?? [])) {
      this.doUpdateElementOrientation(cell);
    }
  }
  
  doUpdateElementOrientation(elt) {
    if (this.getOrientation() === this.constructor._ORIENTATION_VERTICAL) {
      elt.classList.remove(this.constructor._ORIENTATION_HORIZONTAL);
      elt.classList.add(this.constructor._ORIENTATION_VERTICAL);
    } else {
      elt.classList.remove(this.constructor._ORIENTATION_VERTICAL);
      elt.classList.add(this.constructor._ORIENTATION_HORIZONTAL);
    }
  }

  doCell(cellName, cellConfig) {

    // Define cell default config
    const defaultCellConfig = this.createDynamicCellConfig(cellName, this.getCellImageUrl(cellConfig))

    // Create a new cell
    const cell = document.createElement("div");
    this._elements.cells.push(cell);
    cell.className = "carrousel-cell";
    cell.id = cellName;
    this.setCellData(cell, cellConfig, defaultCellConfig);

    // Create cell content
    const cellContent = this.doCellContent(cellConfig, defaultCellConfig);
    this.doStyleCellContent(cellContent, cellConfig);
    this.doAttachCellContent(cell, cellContent);
    this.doQueryCellContentElements();
    this.doListenCellContent();
    this.doLoadImage(cellContent, defaultCellConfig);

    return cell;
  }

  doStyleCell(cell, cellConfig) {
    cell.style.width = this.getCellWidth(cellConfig);
    cell.style.height = this.getCellHeight(cellConfig);
  }

  doAttachCell(cell) {
    this._elements.container.appendChild(cell);
  }

  doQueryCellElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenCell(cell) {
    // Action and visual events
    this._eventManager.addButtonListeners("layoutContainer", cell, 
      {
        [this._eventManager.constructor._BUTTON_CALLBACK_PRESS]: this.onCellPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_ABORT_PRESS]: this.onCellAbortPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_RELEASE]: this.onCellRelease.bind(this)
      }
    );
  }

  onCellPress(cell, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doCellPress(cell);
  }

  onCellAbortPress(cell, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doCellAbortPress(cell);
  }

  onCellRelease(cell, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doCellRelease(cell);
  }

  doCellPress(cell) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doCellPress(cell):", cell));

    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cell ${cell.id} press: normal press detected (nothing to do)`));

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doCellAbortPress(cell) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doCellAbortPress(cell):", cell));

    // Nothing to do: default action has not (and wont be) executed because key release wont happen
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cell ${cell.id} abort press: normal press detected (nothing to do)`));

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doCellRelease(cell) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doCellRelease(cell):", cell));

    // Retrieve cell data
    const cellConfig = this._layoutManager.getElementData(cell);
    const cellAction = cellConfig.action;
    if (!cellAction) {
      // Missing action for the cell

      // Nothing to do
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`Cell ${cell.id} release: missing action in config, aborting`));
    } else {
      // Action configured for the cell

      // Execute the action
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cell ${cell.id} release: executing action ${cellAction}...`));
      this._eventManager.triggerHaosTapAction(cell, cellConfig.action);
    }
    this._layoutManager.hapticFeedback();
  }

  doCellContent(cellConfig, defaultCellConfig) {

    // Create cell content
    const cellContent = document.createElement("div");
    cellContent.className = "carrousel-cell-content";

    // Create cell content inner label
    const cellContentLabel = this.doCellContentLabel(cellConfig, defaultCellConfig);
    this.doStyleCellContentLabel(cellContentLabel, cellConfig);
    this.doAttachCellContentLabel(cellContent, cellContentLabel);
    this.doQueryCellContentLabelElements(cellContent, cellContentLabel);
    this.doListenCellContentLabel();

    // Create cell content inner image
    const cellContentImage = this.doCellContentImage(cellConfig, defaultCellConfig);
    this.doStyleCellContentImage(cellContentImage, cellConfig);
    this.doAttachCellContentImage();
    this.doQueryCellContentImageElements(cellContent, cellContentImage, defaultCellConfig);
    this.doListenCellContentImage(cellContent, cellConfig, defaultCellConfig);

    return cellContent;
  }

  doStyleCellContent(cellContent, cellConfig) {

    // Apply user preferences over cell content background
    cellContent.style.background = this.getCellBackground(cellConfig);
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

  doCellContentLabel(cellConfig, defaultCellConfig) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doCellContentLabel(cellConfig, defaultCellConfig):`, cellConfig, defaultCellConfig));

    // Independently of current cell display mode, always create the label (to serve as fallback for image loading error)
    const cellDisplayMode = this.getCellDisplayMode(cellConfig);

    // Instanciates a content wrapper for layout consistency, relatives to image layout circument of chromium-based browser bugs
    const cellContentLabel = document.createElement("div");
    cellContentLabel.className = "carrousel-cell-content-part label";
    cellContentLabel.classList.add('full'); // Always make the label taking full cell space first as fallback

    // Instanciates a new label
    const label = document.createElement("div");
    cellContentLabel._label = label;
    label.className = "carrousel-label";
    label.textContent = this.getCellLabel(cellConfig) || this.getDynamicCellName(defaultCellConfig);

    // Append and return wrapper (not label itself)
    cellContentLabel.appendChild(label);
    return cellContentLabel;
  }

  doStyleCellContentLabel(cellContentLabel, cellConfig) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doStyleCellContentLabel(cellContentLabel, cellConfig):`, cellContentLabel, cellConfig));

    // Apply user preferences on cell content label container style
    cellContentLabel.style.padding = this.getCellLabelGap(cellConfig);
    
    // Apply user preferences on cell content label style
    cellContentLabel._label.style.color = this.getCellLabelColor(cellConfig);
    cellContentLabel._label.style.fontSize = this.getCellLabelFontScale(cellConfig);
  }

  doAttachCellContentLabel(cellContent, cellContentLabel) {
    cellContent.appendChild(cellContentLabel); // Always attach label first as fallback
  }

  doQueryCellContentLabelElements(cellContent, cellContentLabel) {
    // Keep content label wrapper reference into cellContent for further operations
    cellContent._cellContentLabel = cellContentLabel;
  }

  doListenCellContentLabel() {
    // Nothing to do here: no events needed on cell content label
  }

  doCellContentImage(cellConfig, defaultCellConfig) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doCellContentImage(cellConfig, defaultCellConfig):`, cellConfig, defaultCellConfig));

    // When mode is not "image" or "mixed", do not create cell content image
    const cellDisplayMode = this.getCellDisplayMode(cellConfig);
    if (cellDisplayMode !== this.constructor._CELL_MODE_IMAGE && cellDisplayMode !== this.constructor._CELL_MODE_MIXED) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doCellContentImage(cellConfig, defaultCellConfig) + cellDisplayMode: skipping due to cellDisplayMode`, cellConfig, defaultCellConfig, cellDisplayMode));
      return null;
    }

    // Instanciates a content wrapper to avoid chromium-based browser bugs
    // (chromium does not properly apply padding to <img> elements inside flex containers—especially when img is 100% width/height and using object-fit)
    const cellContentImage = document.createElement("div");
    cellContentImage.className = "carrousel-cell-content-part img";

    // Instanciates image (but load its content later)
    const img = document.createElement("img");
    cellContentImage._image = img;
    img.className = "carrousel-img";
    img.alt = this.getDynamicCellName(defaultCellConfig);

    // Append and return wrapper (not image itself)
    cellContentImage.appendChild(img);
    return cellContentImage;
  }

  doStyleCellContentImage(cellContentImage, cellConfig) {

    // Apply user preferences on image style
    if (cellContentImage) cellContentImage.style.padding = this.getCellImageGap(cellConfig);
  }

  doAttachCellContentImage() {
    // Nothing to do here: content image will be attached to DOM later, once successfully loaded
  }

  doQueryCellContentImageElements(cellContent, cellContentImage) {
    // Keep content image wrapper reference into cellContent for further operations
    cellContent._cellContentImage = cellContentImage;
  }

  doListenCellContentImage(cellContent, cellConfig, defaultCellConfig) {
    const img = cellContent._cellContentImage?._image;
    if (img) this._eventManager.addLoadListenerToContainer("layoutContainer", img, this.onLoadImageSuccess.bind(this, cellContent, cellConfig, defaultCellConfig));
    if (img) this._eventManager.addErrorListenerToContainer("layoutContainer", img, this.onLoadImageError.bind(this, cellContent, cellConfig, defaultCellConfig));
  }

  doLoadImage(cellContent, defaultCellConfig) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('doLoadImage(cellContent, defaultCellConfig):', cellContent, defaultCellConfig));
    const cellImageUrl = this.getDynamicCellImageUrl(defaultCellConfig);
    const img = cellContent._cellContentImage?._image;
    if (img && cellImageUrl) img.src = cellImageUrl; // Starts loading image asynchronously
  }

  onLoadImageSuccess(cellContent, cellConfig, defaultCellConfig) {
    const cellName = this.getDynamicCellName(defaultCellConfig);
    const cellImageUrl = this.getDynamicCellImageUrl(defaultCellConfig);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cell ${cellName} image successfully loaded from URL '${cellImageUrl}'`));

    const cellContentLabel = cellContent._cellContentLabel;
    const cellContentImage = cellContent._cellContentImage;
    const cellDisplayMode = this.getCellDisplayMode(cellConfig);

    // 1. Reset fallback label
    cellContentLabel.remove();      // Remove from DOM
    cellContentLabel.classList.remove('full'); // Remove full class

    // 2. update visuals for image + label
    if (cellDisplayMode === this.constructor._CELL_MODE_IMAGE) cellContentImage.classList.add('full');
    if (cellDisplayMode === this.constructor._CELL_MODE_MIXED) cellContentImage.classList.add('half');
    if (cellDisplayMode === this.constructor._CELL_MODE_LABEL) cellContentLabel.classList.add('full');
    if (cellDisplayMode === this.constructor._CELL_MODE_MIXED) cellContentLabel.classList.add('half');

    // 3. attach and position: image into cell content top, label into cell content bottom
    if (cellDisplayMode === this.constructor._CELL_MODE_IMAGE || cellDisplayMode === this.constructor._CELL_MODE_MIXED) cellContent.appendChild(cellContentImage);
    if (cellDisplayMode === this.constructor._CELL_MODE_LABEL || cellDisplayMode === this.constructor._CELL_MODE_MIXED) cellContent.appendChild(cellContentLabel);
  }

  onLoadImageError(cellContent, cellConfig, defaultCellConfig, err) {
    const cellName = this.getDynamicCellName(defaultCellConfig);
    const cellImageUrl = this.getDynamicCellImageUrl(defaultCellConfig);
    if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`Cell ${cellName} image failed to load from URL '${cellImageUrl}' with error:`, err));

    // Nothing more to do: let label as-is into cell content as fallback for image fail
  }

  // configuration defaults
  static getStubConfig() {
    return {
      haptic: true,
      log_level: "warn",
      log_pushback: false,
      orientation: this.constructor._ORIENTATION_HORIZONTAL,
      cell_display_mode: this.constructor._CELL_MODE_MIXED,
      cell_background: "transparent",
      cell_width: 60,
      cell_height: 60,
      cell_label: "",
      cell_label_font_scale: 1,
      cell_label_gap: 0,
      cell_label_color: "white",
      cell_image_url: "",
      cell_image_gap: 0,
      cell_action: {},
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

}

if (!customElements.get("carrousel-card")) customElements.define("carrousel-card", CarrouselCard);
