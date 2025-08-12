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

  _scrollPointers = new Map();
  _isScrollModeOn = false;
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
    
    this.createScrollZones();
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
    this._elements.scrollIcon = card.querySelector(".scroll-icon");
    this._elements.buttons = card.querySelector(".buttons-area");
  }

  doListen() {
    //TODO: add global PointerUp listener?
    this.doListenScrollIcon();
    this.doListenTrackpad();
  }

  doListenScrollIcon() {
    const scrollIcon = this._elements.scrollIcon;
    this._eventManager.addPointerDownListener(scrollIcon, this.onScrollIconPointerDown.bind(this));
    this._eventManager.addPointerUpListener(scrollIcon, this.onScrollIconPointerUp.bind(this));
    this._eventManager.addPointerCancelListener(scrollIcon, this.onScrollIconPointerCancel.bind(this));
    this._eventManager.addPointerLeaveListener(scrollIcon, this.onScrollIconPointerCancel.bind(this));
  }

  onScrollIconPointerDown(evt) {
    evt.stopPropagation(); // Prevents underneath trackpad click
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollIconPointerDown(evt):", evt));

    // Track current pointer into scroll pointers
    this._scrollPointers.set(evt.pointerId, {});
  }

  onScrollIconPointerUp(evt) {
    evt.stopPropagation(); // Prevents underneath trackpad click
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollIconPointerUp(evt):", evt));

    // Retrieve current pointer entry from tracked scroll pointers (when existing, then clear)
    const scrollEntry = this._scrollPointers.get(evt.pointerId);
    this._scrollPointers.delete(evt.pointerId);

    if (scrollEntry) {

      // When pointer was pressed over scroll icon before this release event: toggle scroll mode
      this._isScrollModeOn = !this._isScrollModeOn;
      scrollIcon.classList.toggle("toggled-on", this._isScrollModeOn);

      // Update scroll zones to reflect new scroll mode
      this.doUpdateScrollZones();
    }
  }
  
  onScrollIconPointerCancel(evt) {

    // Remove current pointer entry from tracked scroll pointers (when existing)
    this._scrollPointers.delete(evt.pointerId);
  }

  doListenTrackpad() {
    const trackpad = this._elements.trackpad;
    this._eventManager.addPointerDownListener(trackpad, this.onTrackpadPointerDown.bind(this));
    this._eventManager.addPointerMoveListener(trackpad, this.onTrackpadPointerMove.bind(this));
    this._eventManager.addPointerUpListener(trackpad, this.onTrackpadPointerUp.bind(this));
    this._eventManager.addPointerCancelListener(trackpad, this.onTrackpadPointerCancel.bind(this));
    this._eventManager.addPointerLeaveListener(trackpad, this.onTrackpadPointerCancel.bind(this));
  }

  onTrackpadPointerDown(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTrackpadPointerDown(evt):", evt));

    // Track current pointer into trackpad pointers
    this._pointersClick.set(evt.pointerId, { "move-detected": false, "event": evt, "long-click-timeout": this.addTrackpadLongClickTimeout(evt) } );
    this._pointersStart.set(evt.pointerId, evt);
    this._pointersEnd.set(evt.pointerId);
  }

  onTrackpadPointerMove(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTrackpadPointerMove(evt):", evt));

    // Retrieve current pointer from tracked trackpad click pointers
    const clickEntry = this._pointersClick.get(evt.pointerId);
    if (clickEntry && !clickEntry["move-detected"]) {
      // No pointer "move-detection" triggered as-of-now

      // Check if pointer physically moved enough this time, to trigger "move-detection"
      const { dx, dy } = this.getPointerDelta(clickEntry["event"], evt);
      if (Math.abs(dx) > this.triggerMoveDeltaX || Math.abs(dy) > this.triggerMoveDeltaY) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Move detected for evt:", evt));
        clickEntry["move-detected"] = true;
      }
    }

    if (this._pointersStart.has(evt.pointerId)) {
      this._pointersEnd.set(evt.pointerId, evt);

      let updateStartPoint = true;
      if (this._pointersStart.size === 1) {
        // Single touch: mouse move
        updateStartPoint = this.handleSinglePointerMove(evt);
      } else if (this._pointersStart.size === 2 && this._pointersEnd.size === 2) {
        // Double-touch: mouse scroll
        updateStartPoint = this.handleDoublePointersMove(evt);
      }

      if (updateStartPoint) this._pointersStart.set(evt.pointerId, evt);
    }
  }

  onTrackpadPointerUp(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTrackpadPointerUp(evt):", evt));

    // Clear current pointer long click timeout and retrieve current pointer click entry (when existing)
    const clickEntry = this.clearTrackpadLongClickTimeout(evt);

    // Remove current pointer entry from tracked trackpad pointers (when existing)
    this._pointersEnd.delete(evt.pointerId);
    this._pointersStart.delete(evt.pointerId);
    this._pointersClick.delete(evt.pointerId);

    if (clickEntry && !clickEntry["move-detected"]) {

      // Check if short click or long click
      const duration = this._eventManager.getElapsedTime(clickEntry["event"], evt);
      if (duration < this.triggerLongClick) {
        // Short click
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Click of ${duration}ms detected for evt:`, evt));
        this.handleSinglePointerLeftClick(evt);
      } else {
        // Too long click
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Debounced click of ${duration}ms detected for evt:`, evt));
      }
    }
  }

  onTrackpadPointerCancel(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTrackpadPointerCancel(evt):", evt));

    // Remove current pointer from all trackpad pointers
    this.clearTrackpadLongClickTimeout(evt);
    this._pointersEnd.delete(evt.pointerId);
    this._pointersStart.delete(evt.pointerId);
    this._pointersClick.delete(evt.pointerId);
  }

  createScrollZones() {
    this.doScrollZones();
    this.doStyleScrollZones();
    this.doAttachScrollZones();
    this.doQueryScrollZonesElements();
    this.doListenScrollZones();
  }

  doScrollZones() {
    const scrollZonesContainer = document.createElement("div");
    this._elements.scrollZonesContainer = scrollZonesContainer;
    scrollZonesContainer.classList.add("scroll-zones");
    scrollZonesContainer.innerHTML = `
      <div class="zone top">
        <svg xmlns="http://www.w3.org/2000/svg" class="scroll-arrow-top" viewBox="0 0 24 24" width="24" height="24" fill="none">
          <polyline 
            points="6,14 12,8 18,14"
            stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <polyline 
            points="6,20 12,14 18,20"
            stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      </div>
      <div class="zone bottom">
        <svg xmlns="http://www.w3.org/2000/svg" class="scroll-arrow-bottom" viewBox="0 0 24 24" width="24" height="24" fill="none">
          <polyline 
            points="6,4 12,10 18,4"
            stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <polyline 
            points="6,10 12,16 18,10"
            stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      </div>
      <div class="zone left">
        <svg xmlns="http://www.w3.org/2000/svg" class="scroll-arrow-left" viewBox="0 0 24 24" width="24" height="24" fill="none">
          <polyline 
            points="14,6 8,12 14,18"
            stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <polyline 
            points="20,6 14,12 20,18"
            stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      </div>
      <div class="zone right">
        <svg xmlns="http://www.w3.org/2000/svg" class="scroll-arrow-right" viewBox="0 0 24 24" width="24" height="24" fill="none">
          <polyline 
            points="10,6 16,12 10,18"
            stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <polyline 
            points="4,6 10,12 4,18"
            stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      </div>
    `;

    // Set zones data
    scrollZonesContainer.querySelector(".zone.top")._keyData = {zone: "top"};
    scrollZonesContainer.querySelector(".zone.bottom")._keyData = {zone: "bottom"};
    scrollZonesContainer.querySelector(".zone.left")._keyData = {zone: "left"};
    scrollZonesContainer.querySelector(".zone.right")._keyData = {zone: "right"};
  }

  doStyleScrollZones() {
    // Nothing to do: styles already included in card style
  }

  doAttachScrollZones() {
    // Nothing to do: scroll zones are dynamically attached on-demand during card runtime
  }

  doQueryScrollZonesElements() {
    const scrollZonesContainer = this._elements.scrollZonesContainer;
    this._elements.scrollZoneTop = scrollZonesContainer.querySelector(".zone.top");
    this._elements.scrollZoneBottom = scrollZonesContainer.querySelector(".zone.bottom");
    this._elements.scrollZoneLeft = scrollZonesContainer.querySelector(".zone.left");
    this._elements.scrollZoneRight = scrollZonesContainer.querySelector(".zone.right");
    this._elements.scrollZones = [scrollZoneTop, scrollZoneBottom, scrollZoneLeft, scrollZoneRight];
  }

  doListenScrollZones() {
    for (const scrollZone of this._elements.scrollZones) {
      this._eventManager.addPointerDownListener(scrollZone, this.onScrollZonePointerDown.bind(this));
      this._eventManager.addPointerUpListener(scrollZone, this.onScrollZonePointerCancel.bind(this));
      this._eventManager.addPointerCancelListener(scrollZone, this.onScrollZonePointerCancel.bind(this));
      this._eventManager.addPointerLeaveListener(scrollZone, this.onScrollZonePointerCancel.bind(this));
    }
  }

  onScrollZonePointerDown(evt) {
    evt.stopImmediatePropagation();
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollZonePointerDown(evt):", evt));

    // Retrieve clicked scroll zone
    const scrollZone = evt.currentTarget;
    const scrollZoneConfig = scrollZone._keyData;

    // Scroll once using clicked scroll zone
    this.doScrollOnce(scrollZoneConfig);

    // Setup repeated scrolls when scroll zone is long-press maintained
    this.scrollsClick.set(evt.pointerId, { "event": evt , "long-scroll-timeout": this.addScrollZoneLongClickTimeout(evt, scrollZoneConfig, this.getTriggerLongScrollDelay()) } );
  }

  onScrollZonePointerCancel(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollZonePointerCancel(evt):", evt));

    this.clearScrollZoneLongClickTimeout(evt);
    this.scrollsClick.delete(evt.pointerId);
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
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doUpdateLayout()"));
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

  doButtons() {
    // Buttons
    if (this.buttonsLayout && this.buttonsLayout.length > 0) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Creating buttons for mode:${this.buttonsMode}`));

      const buttonRow = document.createElement("div");
      buttonRow.style.display = "flex";
      buttonRow.style.width = "100%";
      buttonRow.style.background = "#00000000";

      const createButton = (serviceCall, className) => {
        const btn = document.createElement("button");
        btn.className = `trackpad-btn ${className}`;
        this._eventManager.addPointerDownListener(btn, () => {
          this.sendMouse(serviceCall, {});
        });
        this._eventManager.addPointerUpListener(btn, () => {
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
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Layout does not contain any buttons for mode:${this.buttonsMode}`));
      // Add special no-buttons class
      trackpad.classList.add('no-buttons');
    }
  }

  // configuration defaults
  static getStubConfig() {
    return {
      layout: "buttons-left-middle-right",
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

  doUpdateScrollZones() {
    const trackpad = this._elements.trackpad;
    const scrollZonesContainer = this._elements.scrollZonesContainer;

    if (this._isScrollModeOn) {
      trackpad.appendChild(scrollZonesContainer);
      this.doPositionAndScaleScrollZones();
    } else {
      trackpad.removeChild(scrollZonesContainer);
    }
  }
  
  doPositionAndScaleScrollZones() {
    const trackpad = this._elements.trackpad;
    const scrollZones = this._elements.scrollZones;

    //TODO: enhance this whole "scroll-zone layout" by making it using flex 
    // instead of brute-forcing width and positions when adding them

    // Retrieve trackpad visual dimensions 
    const { trackpadWidth, trackpadHeight } = trackpad.getBoundingClientRect();

    // Compute scroll zones dimensions
    const scrollZoneStyles = {
      left: {
        left: 0,
        top: 0,
        width: trackpadWidth / 6,
        height,
      },
      right: {
        right: 0,
        top: 0,
        width: trackpadWidth / 6,
        height,
      },
      top: {
        left: trackpadWidth / 6,
        top: 0,
        width: (4 / 6) * trackpadWidth,
        height: trackpadHeight / 2,
      },
      bottom: {
        left: trackpadWidth / 6,
        bottom: 0,
        width: (4 / 6) * trackpadWidth,
        height: trackpadHeight / 2,
      },
    };

    // Apply scroll zones dimensions, per scroll zone
    for (const scrollZone of scrollZones) {
      const zone = scrollZone._keyData.zone;
      const zoneStyle = scrollZoneStyles[zone];

      Object.assign(scrollZone.style, {
        left: zoneStyle.left !== undefined ? `${zoneStyle.left}px` : '',
        right: zoneStyle.right !== undefined ? `${zoneStyle.right}px` : '',
        top: zoneStyle.top !== undefined ? `${zoneStyle.top}px` : '',
        bottom: zoneStyle.bottom !== undefined ? `${zoneStyle.bottom}px` : '',
        width: `${zoneStyle.width}px`,
        height: `${zoneStyle.height}px`,
      });
    }
  }

  doScrollOnce(scrollZoneConfig) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doScrollOnce(scrollZoneConfig):`, scrollZoneConfig));
    const scrollZone = scrollZoneConfig.zone;
    switch (scrollZone) {
      case "top":
        this.sendMouseScroll(0, 1);
        this._eventManager.hapticFeedbackShort();
        break;
      case "bottom":
        this.sendMouseScroll(0, -1);
        this._eventManager.hapticFeedbackShort();
        break;
      case "left":
        this.sendMouseScroll(-1, 0);
        this._eventManager.hapticFeedbackShort();
        break;
      case "right":
        this.sendMouseScroll(1, 0);
        this._eventManager.hapticFeedbackShort();
        break;
    }
  }

  addScrollZoneLongClickTimeout(evt, scrollZoneConfig, triggerDelay) {
    return setTimeout(() => {
      const clickEntry = this.scrollsClick.get(evt.pointerId);
      if (clickEntry) {

        const duration = this._eventManager.getElapsedTime(clickEntry["event"], evt);
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Scroll ${scrollZoneConfig.zone} long press of ${duration}ms detected for evt:`, evt));

        // Scroll once into current scrollZoneConfig direction
        this.doScrollOnce(scrollZoneConfig);

        // Compute next trigger delay
        const nextTriggerDelay = Math.max(this.getTriggerLongScrollMinInterval(), triggerDelay - this.getTriggerLongScrollDecreaseInterval())
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Next ${scrollZoneConfig.zone} scroll will be triggered in ${nextTriggerDelay}ms`));

        // Add next scroll event
        this.scrollsClick.set(evt.pointerId, { "event": evt , "long-scroll-timeout": this.addScrollZoneLongClickTimeout(zone, evt, nextTriggerDelay) } );
      }
    }, triggerDelay); // next long-scroll duration
  }

  clearScrollZoneLongClickTimeout(e) {
    const clickEntry = this.scrollsClick.get(e.pointerId);
    if (clickEntry && clickEntry["long-scroll-timeout"]) clearTimeout(clickEntry["long-scroll-timeout"]);
    return clickEntry;
  }

  addTrackpadLongClickTimeout(e) {
    return setTimeout(() => {

      // Retrieve current pointer from tracked trackpad click pointers
      const clickEntry = this._pointersClick.get(e.pointerId);
      if (clickEntry && !clickEntry["move-detected"]) {

        // No move detected as-of now:
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("No move detected for:", e));

        const startTime = clickEntry["event"].timeStamp;
        const endTime = e.timeStamp;
        const duration = endTime - startTime; // in milliseconds
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Long-click of ${duration}ms detected for:`, e));
        this.handleSinglePointerLeftDblClick(e);
      }
    }, this.getTriggerLongClickDelay()); // long-press duration
  }
  
  clearTrackpadLongClickTimeout(evt) {
    const clickEntry = this._pointersClick.get(evt.pointerId);
    if (clickEntry && clickEntry["long-click-timeout"]) clearTimeout(clickEntry["long-click-timeout"]);
    return clickEntry;
  }

  handleSinglePointerLeftClick(e) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleSinglePointerLeftClick(e):", e));
    this.sendMouseClickLeft();
    this.sendMouseClickRelease();
    this._eventManager.hapticFeedback();
  }

  handleSinglePointerLeftDblClick(e) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleSinglePointerLeftDblClick(e):", e));
    this.sendMouseClickLeft();
    this.sendMouseClickRelease();
    this.sendMouseClickLeft();
    this.sendMouseClickRelease();
    this._eventManager.hapticFeedbackLong();
  }

  handleSinglePointerMove(e) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleSinglePointerMove(e):", e));
    let updateStartPoint = true;
    if (this.getTrackpadMode() === "move") {
      updateStartPoint = this.handleMouseMove(e);
    } else if (this.getTrackpadMode() === "scroll") {
      updateStartPoint = this.handleMouseScroll(e);
    }
    return updateStartPoint;
  }

  handleDoublePointersMove(e) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleDoublePointersMove(e):", e));
    return this.handleMouseScroll(e);
  }

  handleMouseMove(e) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleMouseMove(e):", e));
    const updateStartPoint = true;
    const startEvent = this._pointersStart.get(e.pointerId);
    const endEvent = this._pointersEnd.get(e.pointerId);
    const { dx, dy } = this.getPointerDelta(startEvent, endEvent);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Delta detected for one pointer:${e.pointerId}`, dx, dy));
    if (dx !== 0 || dy !== 0) {
      this.sendMouseMove(dx, dy);
      this._eventManager.hapticFeedbackShort();
    }
    return updateStartPoint;
  }

  handleMouseScroll(e) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleMouseScroll(e):", e));

    const { dx, dy } = this.getDoublePointerDelta(this._pointersStart, this._pointersEnd);
    const dxAbs = Math.abs(dx);
    const dyAbs = Math.abs(dy);
    const updateStartPoint = (dxAbs >= this.getTriggerScrollDelta() || dyAbs >= this.getTriggerScrollDelta());
    if (updateStartPoint) {
      // Scroll trigger reached
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Delta detected for two pointers:`, dx, dy));

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
      this._eventManager.hapticFeedbackShort();
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
    this._eventManager.callComponentService(this._hass, serviceName, serviceArgs);
  }

  getTrackpadMode() {
    if (this._isScrollModeOn) {
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
