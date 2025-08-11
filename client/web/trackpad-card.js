import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';

console.info("Loading trackpad-card");

class TrackpadCard extends HTMLElement {

  // private init required constants
  static _LAYOUTS;

  // Should be initialized in a static block to avoid JS engine to bug on static fields not-already-referenced otherwise
  static {
    this._LAYOUTS = {
        'buttons-hidden'           : [],
        'buttons-left'             : [ {serviceCall: "clickleft"  , className: "trackpad-solo"  } ],
        'buttons-middle'           : [ {serviceCall: "clickmiddle", className: "trackpad-solo"  } ],
        'buttons-right'            : [ {serviceCall: "clickright" , className: "trackpad-solo"  } ],
        'buttons-left-right'       : [ {serviceCall: "clickleft"  , className: "trackpad-left"  }, {serviceCall: "clickright" , className: "trackpad-right" } ],
        'buttons-left-middle'      : [ {serviceCall: "clickleft"  , className: "trackpad-left"  }, {serviceCall: "clickmiddle", className: "trackpad-right" } ],
        'buttons-middle-left'      : [ {serviceCall: "clickmiddle", className: "trackpad-left"  }, {serviceCall: "clickleft"  , className: "trackpad-right" } ],
        'buttons-middle-right'     : [ {serviceCall: "clickmiddle", className: "trackpad-left"  }, {serviceCall: "clickright" , className: "trackpad-right" } ],
        'buttons-right-left'       : [ {serviceCall: "clickright" , className: "trackpad-left"  }, {serviceCall: "clickleft"  , className: "trackpad-right" } ],
        'buttons-right-middle'     : [ {serviceCall: "clickright" , className: "trackpad-left"  }, {serviceCall: "clickmiddle", className: "trackpad-right" } ],
        'buttons-left-middle-right': [ {serviceCall: "clickleft"  , className: "trackpad-left"  }, {serviceCall: "clickmiddle", className: "trackpad-middle" }, {serviceCall: "clickright" , className: "trackpad-right" } ],
        'buttons-right-middle-left': [ {serviceCall: "clickright" , className: "trackpad-left"  }, {serviceCall: "clickmiddle", className: "trackpad-middle" }, {serviceCall: "clickleft"  , className: "trackpad-right" } ]
      }
    };
    console.log(this._LAYOUTS);
  }

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;

  _isToggleClick = false;
  _isToggledOn = false;
  _pointersClick = new Map();
  _pointersStart = new Map();
  _pointersEnd = new Map();

  _scrollContainer = null;
  _scrollsClick = new Map();

  constructor() {
    super();

    this._logger = new Logger(this, "trackpad-card.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, this.constructor._LAYOUTS);
    this._resourceManager = new ResourceManager(this, import.meta.url);

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

  getTriggerMoveHorizontalDelta() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_move_horizontal_delta");
  }

  getTriggerMoveVerticalDelta() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_move_vertical_delta");
  }

  getTriggerLongClickDelay() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_click_delay");
  }

  getTriggerScroll() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_scroll");
  }

  getTriggerScrollMinValue() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_scroll_min_value");
  }

  getTriggerScrollMaxValue() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_scroll_max_value");
  }

  getTriggerLongScrollDelay() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_scroll_delay");
  }

  getTriggerLongScrollDecreaseInterval() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_scroll_decrease_interval");
  }

  getTriggerLongScrollMinInterval() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_scroll_min_interval");
  }

  // jobs
  doCheckConfig() {
    this._layoutManager.checkConfiguredLayout();
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div class="trackpad-container">
        <div class="trackpad-area">
          <svg xmlns="http://www.w3.org/2000/svg" class="scroll-icon" viewBox="20 14.75 44 54.5">
            <rect 
              x="21" y="15.75"
              width="42" height="52.5"
              rx="15.75" ry="15.75"
              stroke="currentColor" stroke-width="2" fill="none" />
            <line 
              x1="42" y1="26.25"
              x2="42" y2="57.75"
              stroke="currentColor" stroke-width="2" />
            <polyline 
              points="36.75,31.5 42,26.25 47.25,31.5"
              fill="none" stroke="currentColor" stroke-width="2" />
            <polyline 
              points="36.75,52.5 42,57.75 47.25,52.5"
              fill="none" stroke="currentColor" stroke-width="2" />
            <line 
              x1="26.25" y1="42"
              x2="57.75" y2="42"
              stroke="currentColor" stroke-width="2" />
            <polyline 
              points="31.5,36.75 26.25,42 31.5,47.25"
              fill="none" stroke="currentColor" stroke-width="2" />
            <polyline 
              points="52.5,36.75 57.75,42 52.5,47.25"
              fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </div>
        <div class="buttons-area">
        </div>
      </div>
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      .ha-card {
        border-radius: 10px;
      }
      .trackpad-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0;
        background-color: #00000000; /* transparent black */
      }
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
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.container = card.querySelector(".trackpad-container");
    this._elements.trackpad = card.querySelector(".trackpad-area");
    this._elements.scrollButton = card.querySelector(".scroll-icon");
    this._elements.buttons = card.querySelector(".buttons-area");
  }

  doListen() {
    //TODO: add global PointerUp listener?

    //TODO: setup instance bindings

    // Track scrollIcon toggle
    this.eventManager.addPointerDownListener(scrollIcon, (e) => {
      e.stopPropagation(); // Prevents underneath trackpad click
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("scrollIcon pointerDown(e):", e));
      this.isToggleClick = true;
    });

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
  }

  doUpdateConfig() {
    if (this._layoutManager.configuredLayoutChanged()) {
      this.doUpdateLayout();
    }
  }

  doUpdateHass() {
    //TODO
  }

  doUpdateLayout() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doUpdateLayout() + this._currentMode, this._currentState", this._currentMode, this._currentState));
    this.doResetLayout();
    this.doCreateLayout();
  }

  doResetLayout() {
    // Clear existing layout content from DOM
    this._elements.container.innerHTML = '';

    // Reset attached layout
    this._layoutManager.resetAttachedLayout();
  }

  doCreateLayout() {
    // Mark configured layout as attached
    this._layoutManager.configuredLayoutAttached();

    // TODO
  }

  doScrollZones() {
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
  }
  
  doButtons() {
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
  }

  // configuration defaults
  static getStubConfig() {
    return {
      layout: "left-middle-right",
      haptic: true,
      log_level: "warn",
      log_pushback: false,
      trigger_move_horizontal_delta: 2,
      trigger_move_vertical_delta: 2,
      trigger_long_click_delay: 500,
      trigger_scroll: 10,
      trigger_scroll_min_value: -1,
      trigger_scroll_max_value: 1,
      trigger_long_scroll_delay: 350,
      trigger_long_scroll_decrease_interval: 25,
      trigger_long_scroll_min_interval: 75
    }
  }

  getCardSize() {
    return 3;
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
    const svg = document.createElementNS(Globals.SVG_NAMESPACE, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("fill", "none");

    const arrow1 = document.createElementNS(Globals.SVG_NAMESPACE, "polyline");
    const arrow2 = document.createElementNS(Globals.SVG_NAMESPACE, "polyline");

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
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`this.getTriggerLongScrollMinInterval():${this.getTriggerLongScrollMinInterval()}, thisTriggerLongScroll:${thisTriggerLongScroll}, this.getTriggerLongScrollDecreaseInterval():${this.getTriggerLongScrollDecreaseInterval()}`));
        const nextTriggerLongScroll = Math.max(this.getTriggerLongScrollMinInterval(), thisTriggerLongScroll - this.getTriggerLongScrollDecreaseInterval())
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
    }, this.getTriggerLongClickDelay()); // long-press duration
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
    const updateStartPoint = (dxAbs >= this.getTriggerScrollDelta() || dyAbs >= this.getTriggerScrollDelta());
    if (updateStartPoint) {
      // Scroll trigger reached
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Delta detected for two pointers:`, dx, dy));

      let dxAdjusted = dx;
      let dyAdjusted = dy;

      // Trim axis where movement was minor than other axis
      if (dyAbs >= dxAbs) {
        dxAdjusted = 0;
        dyAdjusted = Math.max(this.getTriggerScrollMinValue(), Math.min(this.getTriggerScrollMaxValue(), dyAdjusted)) * Math.round(dyAbs / this.getTriggerScrollDelta());
      } else {
        dxAdjusted = Math.max(this.getTriggerScrollMinValue(), Math.min(this.getTriggerScrollMaxValue(), dxAdjusted)) * Math.round(dxAbs / this.getTriggerScrollDelta());
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
    this.eventManager.callComponentService(this._hass, serviceName, serviceArgs);
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
