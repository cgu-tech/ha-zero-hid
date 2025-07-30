import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';

console.info("Loading Trackpad Card");

class TrackpadCard extends HTMLElement {
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
    this.eventManager = new EventManager(this.logger, this.haptic);
    this.buttonsMode = 'left-middle-right';
    
    // Layout loading flags
    this._layoutReady = false;
    this._layoutLoaded = {};
    
    this.isToggleClick = false;
    this.isToggledOn = false;
    this.pointersClick = new Map();
    this.pointersStart = new Map();
    this.pointersEnd = new Map();

    this.triggerMoveDeltaX = 2;
    this.triggerMoveDeltaY = 2;
    this.triggerLongClick = 500;
    this.triggerScroll = 10;
    this.triggerScrollMin = -1;
    this.triggerScrollMax = 1;
    this.scrollContainer = null;
    this.scrollsClick = new Map();
    this.triggerLongScroll = 350;
    this.triggerLongScrollInterval = 25;
    this.triggerLongScrollMin = 75;
    
    this.buttonsLayouts = [
      { mode: 'hidden'           , layout: [] },
      { mode: 'left'             , layout: [ {serviceCall: "clickleft"  , className: "trackpad-solo"  } ] },
      { mode: 'middle'           , layout: [ {serviceCall: "clickmiddle", className: "trackpad-solo"  } ] },
      { mode: 'right'            , layout: [ {serviceCall: "clickright" , className: "trackpad-solo"  } ] },
      { mode: 'left-right'       , layout: [ {serviceCall: "clickleft"  , className: "trackpad-left"  }, {serviceCall: "clickright" , className: "trackpad-right" } ] },
      { mode: 'left-middle'      , layout: [ {serviceCall: "clickleft"  , className: "trackpad-left"  }, {serviceCall: "clickmiddle", className: "trackpad-right" } ] },
      { mode: 'middle-left'      , layout: [ {serviceCall: "clickmiddle", className: "trackpad-left"  }, {serviceCall: "clickleft"  , className: "trackpad-right" } ] },
      { mode: 'middle-right'     , layout: [ {serviceCall: "clickmiddle", className: "trackpad-left"  }, {serviceCall: "clickright" , className: "trackpad-right" } ] },
      { mode: 'right-left'       , layout: [ {serviceCall: "clickright" , className: "trackpad-left"  }, {serviceCall: "clickleft"  , className: "trackpad-right" } ] },
      { mode: 'right-middle'     , layout: [ {serviceCall: "clickright" , className: "trackpad-left"  }, {serviceCall: "clickmiddle", className: "trackpad-right" } ] },
      { mode: 'left-middle-right', layout: [ {serviceCall: "clickleft"  , className: "trackpad-left"  }, {serviceCall: "clickmiddle", className: "trackpad-middle" }, {serviceCall: "clickright" , className: "trackpad-right" } ] },
      { mode: 'right-middle-left', layout: [ {serviceCall: "clickright" , className: "trackpad-left"  }, {serviceCall: "clickmiddle", className: "trackpad-middle" }, {serviceCall: "clickleft"  , className: "trackpad-right" } ] }
    ];
    this.buttonsLayoutDefault = this.buttonsLayouts.find(buttonsMode => buttonsMode.mode === 'left-middle-right');
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
        this.haptic = config['haptic'];
      }
      
      // Set layout buttons
      if (config['buttons']) {
        this.buttonsMode = config['buttons'];
      }

      // Set real pointer minimal move delta on X-axis to trigger a virtual pointer move (in px)
      if (config['trigger-move-delta-x']) {
        this.triggerMoveDeltaX = config['trigger-move-delta-x'];
      }

      // Set real pointer minimal move delta on Y-axis to trigger a virtual pointer move (in px)
      if (config['trigger-move-delta-y']) {
        this.triggerMoveDeltaY = config['trigger-move-delta-y'];
      }

      // Set scroll long click duration (in ms)
      if (config['trigger-long-click']) {
        this.triggerLongClick = config['trigger-long-click'];
      }

      // Set scroll trigger event (in real px)
      if (config['trigger-scroll']) {
        this.triggerScroll = config['trigger-scroll'];
      }

      // Set scroll min per triggered scroll event (in unit)
      if (config['trigger-scroll-min']) {
        this.triggerScrollMin = config['trigger-scroll-min'];
      }

      // Set scroll max per triggered scroll event (in unit)
      if (config['trigger-scroll-max']) {
        this.triggerScrollMax = config['trigger-scroll-max'];
      }
      
      // Set initial long-press duration that trigger scroll event (in ms)
      if (config['trigger-long-scroll']) {
        this.triggerLongScroll = config['trigger-long-scroll'];
      }
      
      // Set long-press duration interval to decrease between each scroll event (in ms)
      if (config['trigger-long-scroll-interval']) {
        this.triggerLongScrollInterval = config['trigger-long-scroll-interval'];
      }
      
      // Set long-press duration that could not be decreased further between each scroll event (in ms)
      if (config['trigger-long-scroll-min']) {
        this.triggerLongScrollMin = config['trigger-long-scroll-min'];
      }
    }
  }

  getCardSize() {
    return 3;
  }

  async connectedCallback() {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("connectedCallback()"));

    // Check if layout needs loading
    if (!this._layoutLoaded.buttonsMode || this._layoutLoaded.buttonsMode !== this.buttonsMode) {
      this._layoutReady = false;

      // Load layout
      await this.loadLayout(this.buttonsMode);

      // Update loaded layout
      this._layoutLoaded.buttonsMode = this.buttonsMode;
      this._layoutReady = true;
    }

    // Only build UI if hass is already set
    if (this._hass) {
      this.buildUi(this._hass);
    }
  }
  
  async loadLayout(buttonsMode) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("loadLayout(buttonsMode):", buttonsMode));
    const buttonsFullLayout = this.buttonsLayouts.find(buttonsLayout => buttonsLayout.mode === buttonsMode);
    if (buttonsFullLayout) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Buttons layout found for buttons mode:${buttonsMode}:`, buttonsFullLayout.layout));
      this.buttonsLayout = buttonsFullLayout.layout;
    } else {
      if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(`No buttons layout found for buttons mode:${buttonsMode}. Using default buttons layout:`, this.buttonsLayoutDefault.layout));
      this.buttonsLayout = this.buttonsLayoutDefault.layout;
    }
  }

  set hass(hass) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("set hass(hass):", hass));
    this._hass = hass;
    this.logger.setHass(hass);
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

    const card = document.createElement("ha-card");
    card.style.borderRadius = "10px";

    const style = document.createElement("style");
    style.textContent = `
      .trackpad-btn {
        height: 60px;
        background: #3b3a3a;
        border: none;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .trackpad-btn:hover {
        background: #4a4a4a;
      }
      .trackpad-btn:active {
        background: #2c2b2b;
      }
      .trackpad-left {
        border-bottom-left-radius: 10px;
        flex: 3;
      }
      .trackpad-middle {
        flex: 1;
      }
      .trackpad-right {
        border-bottom-right-radius: 10px;
        flex: 3;
      }
      .trackpad-solo {
        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;
        flex: 7;
      }
      .btn-separator {
        width: 1px;
        background-color: #0a0a0a;
      }
      .trackpad-area {
        cursor: crosshair;
        background: #3b3a3a;
        height: 200px;
        width: 100%;
        touch-action: none;
        position: relative;
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        border-bottom: 1px solid #0a0a0a;
        transition: background 0.2s ease;
      }
      .trackpad-area:active {
        background: #2c2b2b !important;
      }
      .scroll-icon {
        position: absolute;
        top: 0px;
        right: 0px;
        padding-top: 2%;
        padding-bottom: 3%;
        padding-left: 3%;
        padding-right: 3%;
        width: auto;
        height: 22.5%;
        z-index: 2;
        pointer-events: auto;
        opacity: 0.7;
        fill: #eee;
        stroke: #eee;
        cursor: pointer;
        transition: stroke 0.3s ease, fill 0.3s ease;
        filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.6));
      }
      .trackpad-area.dragging .scroll-icon {
        cursor: crosshair;
      }
      .no-buttons {
        height: 260px;
        border-bottom: none; /* or your desired override */
        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;
      }
      .scroll-icon.toggled-on {
        stroke: #44739e !important;
        fill: #44739e !important;
        color: #44739e !important;
      }
      .scroll-zones {
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none; /* base layer is non-interactive */
      }
      
      .scroll-zones .zone {
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        background-color: rgba(255, 255, 255, 0.05);
        pointer-events: auto;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-sizing: border-box;
        transition: background-color 0.2s ease;
        color: white; /* for currentColor */
      }
      
      .scroll-zones .zone:hover {
        background-color: rgba(255, 255, 255, 0.12);
      }
    `;
    this.shadowRoot.appendChild(style);

    const container = document.createElement("div");
    container.className = "trackpad-container";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "center";
    container.style.padding = "0";
    container.style.backgroundColor = "#00000000";

    const trackpad = document.createElement("div");
    trackpad.className = "trackpad-area";

    // Scroll icon dimensions calculations
    const strokeWidth = 2;
    const halfStroke = strokeWidth / 2;

    // Scroll icon bounding Box of Inner Content
    const bbox = {
      x: 21,
      y: 15.75,
      width: 42,
      height: 52.5
    };

    // Scroll icon ViewBox with padding for Stroke
    const viewBoxX = bbox.x - halfStroke;
    const viewBoxY = bbox.y - halfStroke;
    const viewBoxWidth = bbox.width + strokeWidth;
    const viewBoxHeight = bbox.height + strokeWidth;

    // Create scroll icon element
    const svgNS = "http://www.w3.org/2000/svg";
    const scrollIcon = document.createElementNS(svgNS, "svg");
    scrollIcon.setAttribute("class", "scroll-icon");
    scrollIcon.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
    scrollIcon.innerHTML = `
      <rect 
        x="${bbox.x}" y="${bbox.y}"
        width="${bbox.width}" height="${bbox.height}"
        rx="15.75" ry="15.75"
        stroke="currentColor" stroke-width="${strokeWidth}" fill="none" />
      <line 
        x1="42" y1="26.25"
        x2="42" y2="57.75"
        stroke="currentColor" stroke-width="${strokeWidth}" />
      <polyline 
        points="36.75,31.5 42,26.25 47.25,31.5"
        fill="none" stroke="currentColor" stroke-width="${strokeWidth}" />
      <polyline 
        points="36.75,52.5 42,57.75 47.25,52.5"
        fill="none" stroke="currentColor" stroke-width="${strokeWidth}" />
      <line 
        x1="26.25" y1="42"
        x2="57.75" y2="42"
        stroke="currentColor" stroke-width="${strokeWidth}" />
      <polyline 
        points="31.5,36.75 26.25,42 31.5,47.25"
        fill="none" stroke="currentColor" stroke-width="${strokeWidth}" />
      <polyline 
        points="52.5,36.75 57.75,42 52.5,47.25"
        fill="none" stroke="currentColor" stroke-width="${strokeWidth}" />
    `;

 
    // Track scrollIcon toggle
    this.eventManager.addPointerDownListener(scrollIcon, (e) => {
      e.stopPropagation(); // Prevents underneath trackpad click
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("scrollIcon pointerDown(e):", e));
      this.isToggleClick = true;
    });

    this.scrollContainer = document.createElement("div");
    this.scrollContainer.classList.add("scroll-zones");
    
    for (const zone of ["top", "bottom", "left", "right"]) {
      const el = document.createElement("div");
      el.classList.add("zone", zone);
      el.dataset.zone = zone;

      this.eventManager.addPointerDownListener(el, (e) => {
        e.stopImmediatePropagation();
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("scroll pointerDown(e):", e));

        // Scroll once
        const zone = e.currentTarget.dataset.zone;
        this.scrollZone(zone);

        // Setup repeated scrolls for long-press of scroll button
        this.scrollsClick.set(e.pointerId, { "event": e , "long-scroll-timeout": this.addLongScrollTimeout(zone, e, this.triggerLongScroll) } );
      });
      this.eventManager.addPointerUpListener(el, (e) => {
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("scroll pointerUp(e):", e));
        this.clearLongScrollTimeout(e);
        this.scrollsClick.delete(e.pointerId);
      });
      this.eventManager.addPointerCancelListener(el, (e) => {
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("scroll Cancel(e):", e));
        this.clearLongScrollTimeout(e);
        this.scrollsClick.delete(e.pointerId);
      });
      this.eventManager.addPointerLeaveListener(el, (e) => {
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("scroll Leave(e):", e));
        this.clearLongScrollTimeout(e);
        this.scrollsClick.delete(e.pointerId);
      });
      
      const scrollArrowIcon = this.createArrowSvg(zone);
      el.appendChild(scrollArrowIcon);
      
      this.scrollContainer.appendChild(el);
    }

    this.eventManager.addPointerUpListener(scrollIcon, (e) => {
      e.stopPropagation(); // Prevents underneath trackpad click
      if (this.isToggleClick) {
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("scrollIcon pointerUp(e):", e));
        this.isToggledOn = !this.isToggledOn;
        scrollIcon.classList.toggle("toggled-on", this.isToggledOn);
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("scroll mode toggle on:", this.isToggledOn));
      }
      this.isToggleClick = false;
      
      this.updateScrollZones(trackpad);
    });

    trackpad.appendChild(scrollIcon);

    // Track touches
    this.eventManager.addPointerDownListener(trackpad, (e) => {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("touches pointerDown(e):", e));
      this.isToggleClick = false;
      this.pointersClick.set(e.pointerId, { "move-detected": false, "event": e , "long-click-timeout": this.addLongClickTimeout(e) } );
      this.pointersStart.set(e.pointerId, e);
      this.pointersEnd.set(e.pointerId);
    });

    this.eventManager.addPointerUpListener(trackpad, (e) => {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("touches pointerUp(e):", e));
      this.isToggleClick = false;
      const clickEntry = this.pointersClick.get(e.pointerId);

      this.clearLongClickTimeout(e);
      this.pointersEnd.delete(e.pointerId);
      this.pointersStart.delete(e.pointerId);
      this.pointersClick.delete(e.pointerId);

      if (clickEntry && !clickEntry["move-detected"]) {
        // No move detected as-of now:
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("No move detected for:", e));

        // Check if short click or long click
        const startTime = clickEntry["event"].timeStamp;
        const endTime = e.timeStamp;
        const duration = endTime - startTime; // in milliseconds
        if (duration < this.triggerLongClick) {
          // Short click
          if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Click of ${duration}ms detected for:`, e));
          this.handleSinglePointerLeftClick(e);
        } else {
          // Too long click
          if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Debounced click of ${duration}ms detected for:`, e));
        }
      }
    });

    this.eventManager.addPointerCancelListener(trackpad, (e) => {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("pointerCancel(e):", e));
      this.clearLongClickTimeout(e);
      this.pointersEnd.delete(e.pointerId);
      this.pointersStart.delete(e.pointerId);
      this.pointersClick.delete(e.pointerId);
    });

    this.eventManager.addPointerLeaveListener(trackpad, (e) => {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("pointerLeave(e):", e));
      this.clearLongClickTimeout(e);
      this.pointersEnd.delete(e.pointerId);
      this.pointersStart.delete(e.pointerId);
      this.pointersClick.delete(e.pointerId);
    });

    this.eventManager.addPointerMoveListener(trackpad, (e) => {
      const clickEntry = this.pointersClick.get(e.pointerId);
      if (clickEntry && !clickEntry["move-detected"]) {
        // No move detected as-of now:
        // check if pointer moved enough this time to trigger move-detection
        const { dx, dy } = this.getPointerDelta(clickEntry["event"], e);

        if (Math.abs(dx) > this.triggerMoveDeltaX || Math.abs(dy) > this.triggerMoveDeltaY) {
          if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("Move detected for pointer:", e));
          clickEntry["move-detected"] = true;
        }
      }

      if (this.pointersStart.has(e.pointerId)) {
        this.pointersEnd.set(e.pointerId, e);

        let updateStartPoint = true;
        if (this.pointersStart.size === 1) {
          // Single touch: mouse move
          updateStartPoint = this.handleSinglePointerMove(e);
        } else if (this.pointersStart.size === 2 && this.pointersEnd.size === 2) {
          // Double-touch: mouse scroll
          updateStartPoint = this.handleDoublePointersMove(e);
        }

        if (updateStartPoint) this.pointersStart.set(e.pointerId, e);
      }
    });
    container.appendChild(trackpad);

    // Buttons
    if (this.buttonsLayout && this.buttonsLayout.length > 0) {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Creating buttons for mode:${this.buttonsMode}`));

      const buttonRow = document.createElement("div");
      buttonRow.style.display = "flex";
      buttonRow.style.width = "100%";
      buttonRow.style.background = "#00000000";

      const createButton = (serviceCall, className) => {
        const btn = document.createElement("button");
        btn.className = `trackpad-btn ${className}`;
        this.eventManager.addPointerDownListener(btn, () => {
          this.sendMouse(serviceCall, {});
        });
        this.eventManager.addPointerUpListener(btn, () => {
          this.sendMouseClickRelease();
        });
        return btn;
      };
      
      const createFirstButton = (serviceCall, className) => {
        const bnt = createButton(serviceCall, className);
        buttonRow.appendChild(bnt);
      };
      
      const createSecondaryButton = (serviceCall, className) => {
        const sep = document.createElement("div");
        sep.className = "btn-separator";
        buttonRow.appendChild(sep);
        const bnt = createButton(serviceCall, className);
        buttonRow.appendChild(bnt);
      };

      const buttonsQueue = [...this.buttonsLayout];
      let isFirstButton = true;

      while (buttonsQueue.length > 0) {
        const buttonLayout = buttonsQueue.shift(); // Retrieves and removes one button
        if (isFirstButton) {
          isFirstButton = false;
          createFirstButton(buttonLayout.serviceCall, buttonLayout.className);
        } else {
          createSecondaryButton(buttonLayout.serviceCall, buttonLayout.className);
        }
      }
      container.appendChild(buttonRow);
    } else {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Layout does not contain any buttons for mode:${this.buttonsMode}`));
      // Add special no-buttons class
      trackpad.classList.add('no-buttons');
    }

    card.appendChild(container);
    this.shadowRoot.appendChild(card);
    
    this.card = card;
    this.content = container;
  }
  
  updateScrollZones(trackpad) {
    if (this.isToggledOn) {      
      trackpad.appendChild(this.scrollContainer);
      const { width, height } = trackpad.getBoundingClientRect();
      
      const zoneStyles = {
        left: {
          left: 0,
          top: 0,
          width: width / 6,
          height,
        },
        right: {
          right: 0,
          top: 0,
          width: width / 6,
          height,
        },
        top: {
          left: width / 6,
          top: 0,
          width: (4 / 6) * width,
          height: height / 2,
        },
        bottom: {
          left: width / 6,
          bottom: 0,
          width: (4 / 6) * width,
          height: height / 2,
        },
      };
      
      for (const [zoneName, style] of Object.entries(zoneStyles)) {
        const zoneEl = this.scrollContainer.querySelector(`.zone.${zoneName}`);
        if (!zoneEl) continue;
        Object.assign(zoneEl.style, {
          left: style.left !== undefined ? `${style.left}px` : '',
          right: style.right !== undefined ? `${style.right}px` : '',
          top: style.top !== undefined ? `${style.top}px` : '',
          bottom: style.bottom !== undefined ? `${style.bottom}px` : '',
          width: `${style.width}px`,
          height: `${style.height}px`,
        });
      }
    
    } else {
      if (this.scrollContainer) {
        trackpad.removeChild(this.scrollContainer);
      }
    }
  }

  createArrowSvg(direction) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("fill", "none");
  
    const arrow1 = document.createElementNS(svgNS, "polyline");
    const arrow2 = document.createElementNS(svgNS, "polyline");
  
    [arrow1, arrow2].forEach(arrow => {
      arrow.setAttribute("stroke", "currentColor");
      arrow.setAttribute("stroke-width", "2.25");
      arrow.setAttribute("stroke-linecap", "round");
      arrow.setAttribute("stroke-linejoin", "round");
      arrow.setAttribute("fill", "none");
    });
  
    if (direction === "left") {
      // Stylized << arrows
      arrow1.setAttribute("points", "14,6 8,12 14,18");
      arrow2.setAttribute("points", "20,6 14,12 20,18");
    } else if (direction === "right") {
      // Stylized >> arrows
      arrow1.setAttribute("points", "10,6 16,12 10,18");
      arrow2.setAttribute("points", "4,6 10,12 4,18");
    } else if (direction === "top") {
      // Stylized ^^ arrows stacked vertically
      arrow1.setAttribute("points", "6,14 12,8 18,14");
      arrow2.setAttribute("points", "6,20 12,14 18,20");
    } else if (direction === "bottom") {
      // Stylized vv arrows stacked vertically
      arrow1.setAttribute("points", "6,4 12,10 18,4");
      arrow2.setAttribute("points", "6,10 12,16 18,10");
    }
  
    svg.appendChild(arrow1);
    svg.appendChild(arrow2);
    return svg;
  }

  scrollZone(zone) {
    switch (zone) {
      case "top":
        this.sendMouseScroll(0, 1);
        this.eventManager.hapticFeedbackShort();
        break;
      case "bottom":
        this.sendMouseScroll(0, -1);
        this.eventManager.hapticFeedbackShort();
        break;
      case "left":
        this.sendMouseScroll(-1, 0);
        this.eventManager.hapticFeedbackShort();
        break;
      case "right":
        this.sendMouseScroll(1, 0);
        this.eventManager.hapticFeedbackShort();
        break;
    }
  }

  addLongScrollTimeout(zone, e, thisTriggerLongScroll) {
    return setTimeout(() => {
      const clickEntry = this.scrollsClick.get(e.pointerId);
      if (clickEntry) {
        const startTime = clickEntry["event"].timeStamp;
        const endTime = e.timeStamp;
        const duration = endTime - startTime; // current long-scroll duration
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`startTime:${startTime}, endTime:${endTime}, duration:${duration}`));
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Long-scroll of ${duration}ms detected for:`, e));
        
        // Scroll current direction
        this.scrollZone(zone);
        
        // Compute next trigger time
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`this.triggerLongScrollMin:${this.triggerLongScrollMin}, thisTriggerLongScroll:${thisTriggerLongScroll}, this.triggerLongScrollInterval:${this.triggerLongScrollInterval}`));
        const nextTriggerLongScroll = Math.max(this.triggerLongScrollMin, thisTriggerLongScroll - this.triggerLongScrollInterval)
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`nextTriggerLongScroll:${nextTriggerLongScroll}`));
        
        // Add next scroll event
        this.scrollsClick.set(e.pointerId, { "event": e , "long-scroll-timeout": this.addLongScrollTimeout(zone, e, nextTriggerLongScroll) } );
      }
    }, thisTriggerLongScroll); // next long-scroll duration
  }

  clearLongScrollTimeout(e) {
    const clickEntry = this.scrollsClick.get(e.pointerId);
    if (clickEntry && clickEntry["long-scroll-timeout"]) clearTimeout(clickEntry["long-scroll-timeout"]);
  }

  addLongClickTimeout(e) {
    return setTimeout(() => {
      const clickEntry = this.pointersClick.get(e.pointerId);
      if (clickEntry && !clickEntry["move-detected"]) {
        // No move detected as-of now:
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("No move detected for:", e));
        
        const startTime = clickEntry["event"].timeStamp;
        const endTime = e.timeStamp;
        const duration = endTime - startTime; // in milliseconds
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Long-click of ${duration}ms detected for:`, e));
        this.handleSinglePointerLeftDblClick(e);
      }
    }, this.triggerLongClick); // long-press duration
  }
  
  clearLongClickTimeout(e) {
    const clickEntry = this.pointersClick.get(e.pointerId);
    if (clickEntry && clickEntry["long-click-timeout"]) clearTimeout(clickEntry["long-click-timeout"]);
  }

  handleSinglePointerLeftClick(e) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleSinglePointerLeftClick(e):", e));
    this.sendMouseClickLeft();
    this.sendMouseClickRelease();
    this.eventManager.hapticFeedback();
  }
  
  handleSinglePointerLeftDblClick(e) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleSinglePointerLeftDblClick(e):", e));
    this.sendMouseClickLeft();
    this.sendMouseClickRelease();
    this.sendMouseClickLeft();
    this.sendMouseClickRelease();
    this.eventManager.hapticFeedbackLong();
  }

  handleSinglePointerMove(e) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleSinglePointerMove(e):", e));
    let updateStartPoint = true;
    if (this.getTrackpadMode() === "move") {
      updateStartPoint = this.handleMouseMove(e);
    } else if (this.getTrackpadMode() === "scroll") {
      updateStartPoint = this.handleMouseScroll(e);
    }
    return updateStartPoint;
  }

  handleDoublePointersMove(e) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleDoublePointersMove(e):", e));
    return this.handleMouseScroll(e);
  }

  handleMouseMove(e) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleMouseMove(e):", e));
    const updateStartPoint = true;
    const startEvent = this.pointersStart.get(e.pointerId);
    const endEvent = this.pointersEnd.get(e.pointerId);
    const { dx, dy } = this.getPointerDelta(startEvent, endEvent);
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Delta detected for one pointer:${e.pointerId}`, dx, dy));
    if (dx !== 0 || dy !== 0) {
      this.sendMouseMove(dx, dy);
      this.eventManager.hapticFeedbackShort();
    }
    return updateStartPoint;
  }

  handleMouseScroll(e) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleMouseScroll(e):", e));

    const { dx, dy } = this.getDoublePointerDelta(this.pointersStart, this.pointersEnd);
    const dxAbs = Math.abs(dx);
    const dyAbs = Math.abs(dy);
    const updateStartPoint = (dxAbs >= this.triggerScroll || dyAbs >= this.triggerScroll);
    if (updateStartPoint) {
      // Scroll trigger reached
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Delta detected for two pointers:`, dx, dy));

      let dxAdjusted = dx;
      let dyAdjusted = dy;

      // Trim axis where movement was minor than other axis
      if (dyAbs >= dxAbs) {
        dxAdjusted = 0;
        dyAdjusted = Math.max(this.triggerScrollMin, Math.min(this.triggerScrollMax, dyAdjusted)) * Math.round(dyAbs / this.triggerScroll);
      } else {
        dxAdjusted = Math.max(this.triggerScrollMin, Math.min(this.triggerScrollMax, dxAdjusted)) * Math.round(dxAbs / this.triggerScroll);
        dyAdjusted = 0;
      }
      
      // Revert dy to get human natural gesture order
      dyAdjusted = -dyAdjusted;

      this.sendMouseScroll(dxAdjusted, dyAdjusted);
      this.eventManager.hapticFeedbackShort();
    }
    return updateStartPoint;
  }
  
  sendMouseClickLeft() {
    this.sendMouse("clickleft", {});
  }
  
  sendMouseClickRelease() {
    this.sendMouse("clickrelease", {});
  }
  
  sendMouseMove(dx, dy) {
    this.sendMouse("move", { "x": dx, "y": dy, });
  }
  
  sendMouseScroll(dx, dy) {
    this.sendMouse("scroll", { "x": dx, "y": dy, });
  }
  
  sendMouse(serviceName, serviceArgs) {
    this.eventManager.callIntegration(this._hass, serviceName, serviceArgs);
  }

  getTrackpadMode() {
    if (this.isToggledOn) {
      return "scroll";
    } else {
      return "move";
    }
  }

  getPointerDelta(startEvent, endEvent) {
    const dx = endEvent.clientX - startEvent.clientX;
    const dy = endEvent.clientY - startEvent.clientY;
    const dxRound = Math.round(dx);
    const dyRound = Math.round(dy);
    return { dx: dxRound, dy: dyRound };
  }

  getDoublePointerTimeDelta(startMap, endMap) {
    let startTime = null;
    let endTime = null;
    for (const [id, start] of startMap.entries()) {
      const end = endMap.get(id);
      if (end) {
        if (!startTime || (startTime && start.timeStamp > startTime)) startTime = start.timeStamp;
        if (!endTime || (endTime && end.timeStamp > endTime)) endTime = end.timeStamp;
      }
    }
    return endTime - startTime;
  }

  getDoublePointerDelta(startMap, endMap) {
    let dx = 0;
    let dy = 0;
    let count = 0;
    for (const [id, start] of startMap.entries()) {
      const end = endMap.get(id);
      if (end) {
        dx += end.clientX - start.clientX;
        dy += end.clientY - start.clientY;
        count++;
      }
    }
    if (count === 0) return { dx: 0, dy: 0 };
    const dxRound = Math.round(dx / count);
    const dyRound = Math.round(dy / count);
    return { dx: dxRound, dy: dyRound };
  }

}


customElements.define("trackpad-card", TrackpadCard);
