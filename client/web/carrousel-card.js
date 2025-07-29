import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';

console.info("Loading Carrousel Card");

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
    this.haptic = false;
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
        this.logger = new Logger(this.loglevel, this._hass, this.logpushback);
      }
      if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("setConfig(config):", this.config));
      
      // Set haptic feedback
      if (config['haptic']) {
        this.haptic = config['haptic'];
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
        margin-left: 4px;
        margin-right: 4px;
        background: #2c2c2c;
        border-radius: 8px;
        overflow: hidden;
        text-align: center;
        color: white;
        font-size: 14px;
        box-sizing: border-box;
        cursor: pointer;
      }

      .carrousel-cell img {
        width: 90%;
        height: 90%;
        object-fit: contain;
      }
      
      .carrousel-cell img.img-half {
        border-radius: 4px 4px 0 0; /* top-left, top-right, bottom-right, bottom-left */
      }
      
      .carrousel-cell img.img-full {
        border-radius: 4px;
      }

      .carrousel-label {
        display: flex;
        justify-content: center; /* Horizontal centering */
        align-items: center;     /* Vertical centering */
        width: 90%;
        height: 90%;
        white-space: normal;       /* allows wrapping */
        word-wrap: break-word;     /* allows breaking long words */
        overflow-wrap: break-word; /* better support for word breaking */
      }
      
      .carrousel-label.label-half {
        border-radius: 0 0 4px 4px; /* top-left, top-right, bottom-right, bottom-left */
      }
      
      .carrousel-label.label-full {
        border-radius: 4px;
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
      const cellName = cell.name;
      const cellDisplayMode = cell["display-mode"];
      const cellIconUrl = cell["icon-url"];
      const cellBackgroundColor = cell["background-color"];
      const cellNameSize = cell["name-size"];
      const targetDisplayMode = this.getDisplayMode(cellDisplayMode);
      
      // Set cell content (image, label)
      if (targetDisplayMode === "image") {
        // Image mode
        const img = this.createImage(cellId, cellName, cellIconUrl, cellBackgroundColor, cellNameSize);
        img.classList.add('img-full');
        cellDiv.appendChild(img);

      } else if (targetDisplayMode === "name") {
        // Label mode
        const label = this.createLabel(cellId, cellName, cellBackgroundColor, cellNameSize);
        label.classList.add('label-full');
        cellDiv.appendChild(label);

      } else {
        // Image and label mode
        const img = this.createImage(cellId, cellName, cellIconUrl, cellBackgroundColor, cellNameSize);
        img.classList.add('img-half');
        const label = this.createLabel(cellId, cellName, cellBackgroundColor, cellNameSize);
        label.classList.add('label-half');
        cellDiv.appendChild(img);
        cellDiv.appendChild(label);

      }
      
      this.addPointerClickListener(cellDiv, (e) => {
        this.handlePointerClick(e, hass, cellDiv);
      });

      container.appendChild(cellDiv);
    });

    card.appendChild(container);
    this.shadowRoot.appendChild(card);
  }
  
  createImage(cellId, cellName, cellIconUrl, cellBackgroundColor, cellNameSize) {
    const img = document.createElement("img");
    img.className = "carrousel-img";
    const targetCellIconUrl = cellIconUrl ? (this.isValidUrl(cellIconUrl) ? cellIconUrl : this.getLocalIconUrl(cellIconUrl)) : "";
    img.addEventListener('error', () => {
      // When image sources fails to load
      if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(`Unable to load image URL:${targetCellIconUrl} for cell:`, (cellName || cellId)));
    
      // Hide image
      img.style.display = 'none';
    
      // Retrieve label with "Name" text as alternative
      const cellDiv = img.parentElement;
      let label = cellDiv.querySelector('.carrousel-label');
      
      // When missing label (because displayMode was set to image for example)
      if (!label) {
    
        // Create a new label inside the cell and display it
        label = this.createLabel(cellId, cellName, cellBackgroundColor, cellNameSize);
        cellDiv.appendChild(label);
      }
      
      // Set the "full" class for the label (to make all rounded corners for example)
      label.classList.remove('label-half');
      label.classList.add('label-full');
    });
    img.src = targetCellIconUrl;
    img.alt = cellName || cellId;
    
    if (cellBackgroundColor) img.style.backgroundColor = cellBackgroundColor;
    return img;
  }

  createLabel(cellId, cellName, cellBackgroundColor, cellNameSize) {
    const label = document.createElement("div");
    label.className = "carrousel-label";
    label.textContent = cellName || cellId;
    if (cellBackgroundColor) label.style.backgroundColor = cellBackgroundColor;
    if (cellNameSize && this.isFiniteNumber(cellNameSize) && Number(value) > 0) label.style.fontSize = cellNameSize + 'px';
    return label;
  }

  handlePointerClick(evt, hass, cell) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const keyData = cell._keyData;
    if (!keyData) return;

    const config = keyData.config;

    if (config.action) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("Firing action for cell:", cell, config.action));
      this.fireEvent(cell, "hass-action", {
        config: config.action,
        action: "tap",
      });
    }
    
    this.hapticFeedback();
  }

  getDisplayMode(cellDisplayMode) {
    let targetDisplayMode = null;
    if (cellDisplayMode) {
      // Lowerize for equality comparizons
      let loweredDisplayMode = cellDisplayMode.toLowerCase();
      if (this.cellImageModes.has(loweredDisplayMode)) {
        targetDisplayMode = "image";
      } else if (this.cellLabelModes.has(loweredDisplayMode)) {
        targetDisplayMode = "name";
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
      if (targetDisplayMode) {
        if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(`Unknown display mode ${cellDisplayMode}: defaulting to 'image'`));
        targetDisplayMode = "image";
      }
    }
    
    // No cellDisplayMode specified by user: defaulting silently
    if (targetDisplayMode) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`No display mode provided: defaulting to 'image'`));
      targetDisplayMode = "image";
    }
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

customElements.define("carrousel-card", CarrouselCard);
