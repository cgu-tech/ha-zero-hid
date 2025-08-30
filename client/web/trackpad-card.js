import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';

console.info("Loading trackpad-card");

export class TrackpadCard extends HTMLElement {

  // private init required constants
  static _LAYOUTS;

  // Should be initialized in a static block to avoid JS engine to bug on static fields not-already-referenced otherwise
  static {
    this._LAYOUTS = [
      { "Name": 'buttons-hidden'           , "buttons": [] },
      { "Name": 'buttons-left'             , "buttons": [ {"button": "single", "event": "clickleft"  } ] },
      { "Name": 'buttons-middle'           , "buttons": [ {"button": "single", "event": "clickmiddle"} ] },
      { "Name": 'buttons-right'            , "buttons": [ {"button": "single", "event": "clickright" } ] },
      { "Name": 'buttons-left-right'       , "buttons": [ {"button": "left"  , "event": "clickleft"  }, {"button": "right" , "event": "clickright" } ] },
      { "Name": 'buttons-left-middle'      , "buttons": [ {"button": "left"  , "event": "clickleft"  }, {"button": "right" , "event": "clickmiddle"} ] },
      { "Name": 'buttons-middle-left'      , "buttons": [ {"button": "left"  , "event": "clickmiddle"}, {"button": "right" , "event": "clickleft"  } ] },
      { "Name": 'buttons-middle-right'     , "buttons": [ {"button": "left"  , "event": "clickmiddle"}, {"button": "right" , "event": "clickright" } ] },
      { "Name": 'buttons-right-left'       , "buttons": [ {"button": "left"  , "event": "clickright" }, {"button": "right" , "event": "clickleft"  } ] },
      { "Name": 'buttons-right-middle'     , "buttons": [ {"button": "left"  , "event": "clickright" }, {"button": "right" , "event": "clickmiddle"} ] },
      { "Name": 'buttons-left-middle-right', "buttons": [ {"button": "left"  , "event": "clickleft"  }, {"button": "middle", "event": "clickmiddle"}, {"button": "right", "event": "clickright"} ] },
      { "Name": 'buttons-right-middle-left', "buttons": [ {"button": "left"  , "event": "clickright" }, {"button": "middle", "event": "clickmiddle"}, {"button": "right", "event": "clickleft" } ] }
    ];
  }

  // private constants
  _allowedTrackpadButtonData = new Set(['button', 'event']);
  _allowedScrollZoneData = new Set(['zone']);
  _scrollMoveId = "0";

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
  _scrollsMove = new Map();

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

  setManaged(managed) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setManaged(managed):", managed));
    this._eventManager.setManaged(managed);
  }

  setServers(servers) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setServers(servers):", servers));
    this._eventManager.setServers(servers);
  }

  setCurrentServer(server) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setCurrentServer(server):", server));
    this._eventManager.setCurrentServer(server);
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

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass();
    this._eventManager.hassCallback();
  }

  connectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("connectedCallback()"));
    this._eventManager.connectedCallback();
    this._deviceMotionListener = this._eventManager.addDeviceMotionListenerToContainer('test-motion', window, this.onDeviceMotion.bind(this)); //TODO: refactor
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this._eventManager.disconnectedCallback();
    this._eventManager.removeListener(this._deviceMotionListener); //TODO: refactor
  }

  //TODO: refactor
  _cursorSpeed = 5.0; // from 2 to 10 (highest to slowest)
  _cursorDeadZone = 0.5; // Dead zone micromovements filter trigger
  onDeviceMotion(evt) {
    // Gyroscope equivalent: rotationRate (deg/s)
    const gx = evt.rotationRate.beta || 0; // X-axis
    const gy = evt.rotationRate.alpha || 0;  // Y-axis
    const gz = evt.rotationRate.gamma || 0; // Z-axis

    // Process gx, gy, gz
    const vx = -gz / this._cursorSpeed;
    const vy = gy / this._cursorSpeed;

    // Filter micromovements
    if (Math.abs(vx) > this._cursorDeadZone || Math.abs(vy) > this._cursorDeadZone) {
      // Simulate action (e.g., mouse move)
      const dx = vx.toFixed(1);
      const dy = vy.toFixed(1);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Move cursor by: dx=${dx}, dy=${dy}`));
      if (this._hass) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`this.sendMouseMove(dx, dy): dx=${dx}, dy=${dy}`));
        this.sendMouseMove(dx, dy); //TODO: refactor
      }
    }
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  // Trackpad short click/log click detection (with move debouncing)
  getTriggerMoveHorizontalDelta() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_move_horizontal_delta");
  }
  getTriggerMoveVerticalDelta() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_move_vertical_delta");
  }
  getTriggerLongClickDelay() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_click_delay");
  }

  // When two pointers scroll
  getTriggerScrollHorizontalDelta() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_scroll_horizontal_delta");
  }
  getTriggerScrollVerticalDelta() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_scroll_vertical_delta");
  }
  getTriggerScrollDelay() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_scroll_delay");
  }

  // When scroll toggle on
  getTriggerLongScrollDelay() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_scroll_delay");
  }
  getTriggerLongScrollDecreaseInterval() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_scroll_decrease_interval");
  }
  getTriggerLongScrollMinInterval() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_scroll_min_interval");
  }

  disableScrollToggleEvents() {
    this._elements.scrollToggle.classList.add("pass-through");
  }
  enableScrollToggleEvents() {
    this._elements.scrollToggle.classList.remove("pass-through");
  }
  
  disableNoButtonsVisuals() {
    const noButtonsClass = "no-buttons";
    this._elements.trackpadArea.classList.remove(noButtonsClass);
    this._elements.trackpad.classList.remove(noButtonsClass);
    this._elements.scrollZonesContainer.classList.remove(noButtonsClass);
    this._elements.scrollZoneStackLeft.classList.remove(noButtonsClass);
    this._elements.scrollZoneStackRight.classList.remove(noButtonsClass);
    this._elements.scrollZoneLeft.classList.remove(noButtonsClass);
    this._elements.scrollZoneRight.classList.remove(noButtonsClass);
  }
  
  enableNoButtonsVisuals() {
    const noButtonsClass = "no-buttons";
    this._elements.trackpadArea.classList.add(noButtonsClass);
    this._elements.trackpad.classList.add(noButtonsClass);
    this._elements.scrollZonesContainer.classList.add(noButtonsClass);
    this._elements.scrollZoneStackLeft.classList.remove(noButtonsClass);
    this._elements.scrollZoneStackRight.classList.remove(noButtonsClass);
    this._elements.scrollZoneLeft.classList.add(noButtonsClass);
    this._elements.scrollZoneRight.classList.add(noButtonsClass);
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
          <div class="trackpad">
          </div>
          <div class="scroll-toggle">
            <svg xmlns="http://www.w3.org/2000/svg" class="scroll-toggle-icon" viewBox="20 14.75 44 54.5">
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
        </div>
      </div>
    `;

    // Create detached elements
    this.createScrollZones();
    this.createButtonsArea();
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      :host {
        --card-corner-radius: 10px;
      }
      .ha-card {
        border-radius: var(--card-corner-radius);
      }
      .trackpad-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0;
        background-color: #00000000; /* transparent black */
      }

      .trackpad-area {
        position: relative;
        width: 100%;
        height: 200px;
        border-top-left-radius: var(--card-corner-radius);
        border-top-right-radius: var(--card-corner-radius);
        border-bottom: 1px solid #0a0a0a;
        padding: 0;
        background-color: #00000000; /* transparent black */
      }
      .trackpad-area.no-buttons {
        height: 260px;
        border-bottom-left-radius: var(--card-corner-radius);
        border-bottom-right-radius: var(--card-corner-radius);
        border-bottom: none;
      }

      .trackpad {
        z-index: 1;
        width: 100%;
        height: 100%;
        border-top-left-radius: var(--card-corner-radius);
        border-top-right-radius: var(--card-corner-radius);
        cursor: crosshair;
        background: #3b3a3a;
        touch-action: none;
        transition: background 0.2s ease;
      }
      .trackpad:active {
        background: #2c2b2b !important;
      }
      .trackpad.dragging .scroll-toggle-icon {
        cursor: crosshair;
      }
      .trackpad.no-buttons {
        border-bottom-left-radius: var(--card-corner-radius);
        border-bottom-right-radius: var(--card-corner-radius);
      }

      .scroll-zones {
        z-index: 2;
        width: 100%;
        height: 100%;
        border-top-left-radius: var(--card-corner-radius);
        border-top-right-radius: var(--card-corner-radius);
        display: flex;
        flex-direction: row;
        padding: 0;
        background-color: #00000000; /* transparent black */
      }
      .scroll-zones.no-buttons {
        border-bottom-left-radius: var(--card-corner-radius);
        border-bottom-right-radius: var(--card-corner-radius);
      }
      .scroll-zone-stack {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .scroll-zone-stack.left {
        flex: 1;
        border-top-left-radius: var(--card-corner-radius);
      }
      .scroll-zone-stack.middle {
        flex: 4;
      }
      .scroll-zone-stack.right {
        flex: 1;
        border-top-right-radius: var(--card-corner-radius);
      }
      .scroll-zone {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(255, 255, 255, 0.05);
        pointer-events: auto;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-sizing: border-box;
        transition: background-color 0.2s ease;
        color: white; /* for currentColor */
      }
      .scroll-zone.left {
        border-top-left-radius: var(--card-corner-radius);
      }
      .scroll-zone.right {
        border-top-right-radius: var(--card-corner-radius);
      }
      .scroll-zone.active {
        background-color: rgba(255, 255, 255, 0.12);
      }
      ${this._layoutManager.isTouchDevice() ? "" : ".scroll-zone:hover { background-color: rgba(255, 255, 255, 0.12); }" }
      .left.no-buttons {
        border-bottom-left-radius: var(--card-corner-radius);
      }
      .right.no-buttons {
        border-bottom-right-radius: var(--card-corner-radius);
      }

      .scroll-toggle {
        background: transparent !important;
        transition: none !important;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        user-select: none;
        pointer-events: none;
        z-index: 3;
        position: absolute;
        width: auto;
        height: 22.5%;
        aspect-ratio: 1 / 2.4;
        top: 0px;
        right: 0px;
        padding-top: 2%;
        padding-bottom: 3%;
        padding-left: 3%;
        padding-right: 3%;
        background: transparent !important;
        transition: none !important;
      }
      .scroll-toggle-icon {
        background: transparent !important;
        transition: none !important;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        user-select: none;
        pointer-events: auto;
        height: 100%;
        width: auto;
        opacity: 0.7;
        fill: #eee;
        stroke: #eee;
        filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.6));
        cursor: pointer;
      }
      .scroll-toggle-icon.toggled-on {
        stroke: #44739e !important;
        fill: #44739e !important;
        color: #44739e !important;
      }
      .scroll-toggle-icon.pass-through {
        pointer-events: none;
      }

      .trackpad-button {
        height: 60px;
        background: #3b3a3a;
        border: none;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      ${this._layoutManager.isTouchDevice() ? "" : ".trackpad-button:hover { background: #4a4a4a; }" }
      .trackpad-button:active {
        background: #2c2b2b;
      }
      .trackpad-button.left {
        border-bottom-left-radius: var(--card-corner-radius);
        flex: 3;
      }
      .trackpad-button.middle {
        flex: 1;
      }
      .trackpad-button.right {
        border-bottom-right-radius: var(--card-corner-radius);
        flex: 3;
      }
      .trackpad-button.single {
        border-bottom-left-radius: var(--card-corner-radius);
        border-bottom-right-radius: var(--card-corner-radius);
        flex: 7;
      }

      .trackpad-button-separator {
        width: 1px;
        background-color: #0a0a0a;
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
    this._elements.trackpadArea = card.querySelector(".trackpad-area");
    this._elements.trackpad = card.querySelector(".trackpad");
    this._elements.scrollZones = card.querySelector(".scroll-zones");
    this._elements.scrollToggle = card.querySelector(".scroll-toggle-icon");
  }

  doListen() {
    this.doListenScrollToggle();
    this.doListenTrackpad();
  }

  doListenScrollToggle() {
    const scrollToggle = this._elements.scrollToggle;
    this._eventManager.addPointerDownListenerToContainer("cardContainer", scrollToggle, this.onScrollTogglePointerDown.bind(this));
    this._eventManager.addPointerUpListenerToContainer("cardContainer", scrollToggle, this.onScrollTogglePointerUp.bind(this));
    this._eventManager.addPointerCancelListenerToContainer("cardContainer", scrollToggle, this.onScrollTogglePointerCancel.bind(this));
    this._eventManager.addPointerLeaveListenerToContainer("cardContainer", scrollToggle, this.onScrollTogglePointerLeave.bind(this));
  }

  onScrollTogglePointerDown(evt) {
    this._eventManager.preventDefault(evt);
    evt.stopPropagation(); // Prevents underneath trackpad click
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollTogglePointerDown(evt):", evt));

    // Track current pointer into scroll pointers
    this._scrollPointers.set(evt.pointerId, {});
  }

  onScrollTogglePointerUp(evt) {
    evt.stopPropagation(); // Prevents underneath trackpad click
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollTogglePointerUp(evt):", evt));

    // Retrieve current pointer entry from tracked scroll pointers (when existing, then clear)
    const scrollEntry = this._scrollPointers.get(evt.pointerId);
    this._scrollPointers.delete(evt.pointerId);

    if (scrollEntry) {

      // When pointer was pressed over scroll toggle before this release event: toggle scroll mode
      this._isScrollModeOn = !this._isScrollModeOn;
      this._elements.scrollToggle.classList.toggle("toggled-on", this._isScrollModeOn);

      // Update scroll zones to reflect new scroll mode
      this.doUpdateScrollZones();
    }
  }
  
  onScrollTogglePointerCancel(evt) {
    evt.stopPropagation(); // Prevents underneath trackpad click
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollTogglePointerCancel(evt):", evt));
    this.onScrollTogglePointerOut(evt);
  }

  onScrollTogglePointerLeave(evt) {
    evt.stopPropagation(); // Prevents underneath trackpad click
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollTogglePointerLeave(evt):", evt));
    this.onScrollTogglePointerOut(evt);
  }

  onScrollTogglePointerOut(evt) {
    // Remove current pointer entry from tracked scroll pointers (when existing)
    this._scrollPointers.delete(evt.pointerId);
  }

  doListenTrackpad() {
    const trackpad = this._elements.trackpad;
    this._eventManager.addPointerDownListenerToContainer("cardContainer", trackpad, this.onTrackpadPointerDown.bind(this));
    this._eventManager.addPointerMoveListenerToContainer("cardContainer", trackpad, this.onTrackpadPointerMove.bind(this));
    this._eventManager.addPointerUpListenerToContainer("cardContainer", trackpad, this.onTrackpadPointerUp.bind(this));
    this._eventManager.addPointerCancelListenerToContainer("cardContainer", trackpad, this.onTrackpadPointerCancel.bind(this));
    this._eventManager.addPointerLeaveListenerToContainer("cardContainer", trackpad, this.onTrackpadPointerLeave.bind(this));
  }

  onTrackpadPointerDown(evt) {
    this._eventManager.preventDefault(evt);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTrackpadPointerDown(evt):", evt));
    this.disableScrollToggleEvents();

    // Track current pointer into trackpad pointers
    this._pointersClick.set(evt.pointerId, { "move-detected": false, "event": evt, "long-click-timeout": this.addTrackpadLongClickTimeout(evt) } );
    this._pointersStart.set(evt.pointerId, evt);
    this._pointersEnd.set(evt.pointerId);
  }

  onTrackpadPointerMove(evt) {
    this._eventManager.preventDefault(evt);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTrackpadPointerMove(evt):", evt));

    // Retrieve current pointer from tracked trackpad click pointers
    const clickEntry = this._pointersClick.get(evt.pointerId);
    if (clickEntry && !clickEntry["move-detected"]) {
      // No pointer "move-detection" triggered as-of-now

      // Check if pointer physically moved enough this time, to trigger "move-detection"
      const { dx, dy } = this.getPointerDelta(clickEntry["event"], evt);
      if (Math.abs(dx) > this.getTriggerMoveHorizontalDelta() || Math.abs(dy) > this.getTriggerMoveVerticalDelta()) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Move detected for evt:", evt));
        clickEntry["move-detected"] = true;
      }
    }

    if (this._pointersStart.has(evt.pointerId)) {
      this._pointersEnd.set(evt.pointerId, evt);

      let updateStartPoint = true;
      if (this._pointersStart.size === 1) {
        // Single pointer move
        updateStartPoint = this.handleSinglePointerMove(evt);
      } else if (this._pointersStart.size === 2 && this._pointersEnd.size === 2) {
        // Double pointers move
        updateStartPoint = this.handleDoublePointersMove(evt);
      }

      if (updateStartPoint) this._pointersStart.set(evt.pointerId, evt);
    }
  }

  onTrackpadPointerUp(evt) {
    this._eventManager.preventDefault(evt);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTrackpadPointerUp(evt):", evt));
    this.enableScrollToggleEvents();

    // Clear current pointer long click timeout and retrieve current pointer click entry (when existing)
    const clickEntry = this.clearTrackpadLongClickTimeout(evt);

    // Remove current pointer entry from tracked trackpad pointers (when existing)
    this._pointersEnd.delete(evt.pointerId);
    this._pointersStart.delete(evt.pointerId);
    this._pointersClick.delete(evt.pointerId);

    // Remove any pointer from trackpad scroll pointers
    this.clearScrollZoneLongMoveTimeout();
    this._scrollsMove.delete(this._scrollMoveId);

    if (clickEntry && !clickEntry["move-detected"]) {

      // Check if short click or long click
      const duration = this._eventManager.getElapsedTime(clickEntry["event"], evt);
      if (duration < this.getTriggerLongClickDelay()) {
        // Short click
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Trackpad short click of ${duration}ms detected for evt:`, evt));
        this.handleSinglePointerLeftClick(evt);
      } else {
        // Too long click
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Trackpad debounced too-long click of ${duration}ms detected for evt:`, evt));
      }
    }
  }

  onTrackpadPointerCancel(evt) {
    this._eventManager.preventDefault(evt);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTrackpadPointerCancel(evt):", evt));
    this.onTrackpadPointerOut(evt);
  }

  onTrackpadPointerLeave(evt) {
    this._eventManager.preventDefault(evt);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTrackpadPointerLeave(evt):", evt));
    this.onTrackpadPointerOut(evt);
  }

  onTrackpadPointerOut(evt) {
    this.enableScrollToggleEvents();

    // Remove current pointer from all trackpad pointers
    this.clearTrackpadLongClickTimeout(evt);
    this._pointersEnd.delete(evt.pointerId);
    this._pointersStart.delete(evt.pointerId);
    this._pointersClick.delete(evt.pointerId);

    // Remove any pointer from trackpad scroll pointers
    this.clearScrollZoneLongMoveTimeout();
    this._scrollsMove.delete(this._scrollMoveId);
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
      <div class="scroll-zone-stack left">
        <div class="scroll-zone left">
          <svg xmlns="http://www.w3.org/2000/svg" class="scroll-arrow-left" viewBox="0 0 24 24" width="24" height="24" fill="none">
            <polyline 
              points="14,6 8,12 14,18"
              stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <polyline 
              points="20,6 14,12 20,18"
              stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </div>
      </div>
      <div class="scroll-zone-stack middle">
        <div class="scroll-zone top">
          <svg xmlns="http://www.w3.org/2000/svg" class="scroll-arrow-top" viewBox="0 0 24 24" width="24" height="24" fill="none">
            <polyline 
              points="6,14 12,8 18,14"
              stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <polyline 
              points="6,20 12,14 18,20"
              stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </div>
        <div class="scroll-zone bottom">
          <svg xmlns="http://www.w3.org/2000/svg" class="scroll-arrow-bottom" viewBox="0 0 24 24" width="24" height="24" fill="none">
            <polyline 
              points="6,4 12,10 18,4"
              stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <polyline 
              points="6,10 12,16 18,10"
              stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </div>
      </div>
      <div class="scroll-zone-stack right">
        <div class="scroll-zone right">
          <svg xmlns="http://www.w3.org/2000/svg" class="scroll-arrow-right" viewBox="0 0 24 24" width="24" height="24" fill="none">
            <polyline 
              points="10,6 16,12 10,18"
              stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <polyline 
              points="4,6 10,12 4,18"
              stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </div>
      </div>
    `;

    // Attach zones to elements (a bit derogatory to our design, but needed here)
    this._elements.scrollZoneTop = scrollZonesContainer.querySelector(".scroll-zone.top");
    this._elements.scrollZoneBottom = scrollZonesContainer.querySelector(".scroll-zone.bottom");
    this._elements.scrollZoneLeft = scrollZonesContainer.querySelector(".scroll-zone.left");
    this._elements.scrollZoneRight = scrollZonesContainer.querySelector(".scroll-zone.right");

    // Set zones data
    this.setScrollZoneData(this._elements.scrollZoneTop, null, {zone: "top"});
    this.setScrollZoneData(this._elements.scrollZoneBottom, null, {zone: "bottom"});
    this.setScrollZoneData(this._elements.scrollZoneLeft, null, {zone: "left"});
    this.setScrollZoneData(this._elements.scrollZoneRight, null, {zone: "right"});
  }

  doStyleScrollZones() {
    // Nothing to do: styles already included in card style
  }

  doAttachScrollZones() {
    // Nothing to do: scroll zones are dynamically attached on-demand during card runtime
  }

  doQueryScrollZonesElements() {
    const scrollZonesContainer = this._elements.scrollZonesContainer;
    this._elements.scrollZoneStackLeft = scrollZonesContainer.querySelector(".scroll-zone-stack.left");
    this._elements.scrollZoneStackRight = scrollZonesContainer.querySelector(".scroll-zone-stack.right");
    this._elements.scrollZones = [
      this._elements.scrollZoneTop, 
      this._elements.scrollZoneBottom, 
      this._elements.scrollZoneLeft, 
      this._elements.scrollZoneRight
    ];
  }

  doListenScrollZones() {
    for (const scrollZone of this._elements.scrollZones) {
      this._eventManager.addPointerDownListenerToContainer("cardContainer", scrollZone, this.onScrollZonePointerDown.bind(this));
      this._eventManager.addPointerUpListenerToContainer("cardContainer", scrollZone, this.onScrollZonePointerUp.bind(this));
      this._eventManager.addPointerCancelListenerToContainer("cardContainer", scrollZone, this.onScrollZonePointerCancel.bind(this));
      this._eventManager.addPointerLeaveListenerToContainer("cardContainer", scrollZone, this.onScrollZonePointerLeave.bind(this));
    }
  }

  onScrollZonePointerDown(evt) {
    evt.stopImmediatePropagation();
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollZonePointerDown(evt):", evt));
    this.onScrollZonePointerIn(evt);
  }

  onScrollZonePointerUp(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollZonePointerUp(evt):", evt));
    this.onScrollZonePointersOut(evt);
  }

  onScrollZonePointerCancel(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollZonePointerCancel(evt):", evt));
    this.onScrollZonePointersOut(evt);
  }

  onScrollZonePointerLeave(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onScrollZonePointerLeave(evt):", evt));
    this.onScrollZonePointersOut(evt);
  }

  onScrollZonePointerIn(evt) {
    this.disableScrollToggleEvents();

    // Retrieve clicked scroll zone
    const scrollZone = evt.currentTarget;
    const scrollZoneConfig = this._layoutManager.getElementData(scrollZone);
    
    scrollZone.classList.add("active");

    // Scroll once using clicked scroll zone
    this.doScrollOnce(scrollZoneConfig);

    // Setup repeated scrolls when scroll zone is long-press maintained
    this._scrollsClick.set(evt.pointerId, { "event": evt , "long-scroll-timeout": this.addScrollZoneLongClickTimeout(evt, scrollZoneConfig, this.getTriggerLongScrollDelay()) } );
  }

  onScrollZonePointersOut(evt) {
    this.enableScrollToggleEvents();

    // Retrieve clicked scroll zone
    const scrollZone = evt.currentTarget;

    scrollZone.classList.remove("active");

    this.clearScrollZoneLongClickTimeout(evt);
    this._scrollsClick.delete(evt.pointerId);
  }

  createButtonsArea() {
    this.doButtonsArea();
    this.doStyleButtonsArea();
    this.doAttachButtonsArea();
    this.doQueryButtonsAreaElements();
    this.doListenButtonsArea();
  }

  doButtonsArea() {
    const buttonsRow = document.createElement("div");
    this._elements.buttonsRow = buttonsRow;
    buttonsRow.classList.add("buttons-area");
  }

  doStyleButtonsArea() {
    const buttonsRow = this._elements.buttonsRow;
    buttonsRow.style.display = "flex";
    buttonsRow.style.width = "100%";
    buttonsRow.style.background = "#00000000";
  }

  doAttachButtonsArea() {
    // Nothing to do: buttons row is dynamically attached at runtime
  }

  doQueryButtonsAreaElements() {
    // Nothing to do: buttons row elements reference is not needed
  }

  doListenButtonsArea() {
    // Nothing to do: buttons row does not need to be listened
  }

  doUpdateConfig() {
    if (this._layoutManager.configuredLayoutChanged()) {
      this.doUpdateLayout();
    }
  }

  doUpdateHass() {
    // Nothing to do here: no specific HA entity state to listen for this card
  }

  doUpdateLayout() {
    this.doResetLayout();
    this.doCreateLayout();
    this.doAttachLayout();
  }

  doResetLayout() {
    const buttonsRow = this._elements.buttonsRow;

    // Clear previous listeners
    this._eventManager.clearListeners("layoutContainer");

    // Detach existing buttonsRow from DOM
    if (buttonsRow.parentElement) buttonsRow.remove();

    // Clear existing buttonsRow DOM content
    buttonsRow.innerHTML = '';

    // No buttons anymore, so enable no-buttons visuals
    this.enableNoButtonsVisuals();

    // Reset attached layout
    this._layoutManager.resetAttachedLayout();
  }

  doCreateLayout() {
    // Mark configured layout as attached
    this._layoutManager.configuredLayoutAttached();

    // Update no-buttons style according to selected trackpad buttons layout
    if (this._layoutManager.getLayoutName() === "buttons-hidden") {
      this.enableNoButtonsVisuals();
    } else {
      this.disableNoButtonsVisuals();
    }

    // Create trackpad buttons parts
    for (const [trackpadButtonIndex, trackpadButtonConfig] of this._layoutManager.getLayout()["buttons"].entries()) {
      const trackpadButtonParts = this.doTrackpadButtonParts(trackpadButtonIndex, trackpadButtonConfig);
      this.doStyleTrackpadButtonParts();
      this.doAttachTrackpadButtonParts(this._elements.buttonsRow, trackpadButtonParts);
      this.doQueryTrackpadButtonPartsElements();
      this.doListenTrackpadButtonParts();
    }
  }

  doAttachLayout() {
    if (this._layoutManager.getLayoutName() !== "buttons-hidden") this._elements.container.appendChild(this._elements.buttonsRow);
  }

  doTrackpadButtonParts(trackpadButtonIndex, trackpadButtonConfig) {
    return trackpadButtonIndex === 0 ? 
      this.createFirstButtonParts(trackpadButtonConfig) :
      this.createSecondaryButtonParts(trackpadButtonConfig);
  }

  doStyleTrackpadButtonParts() {
    // Nothing to do: already carried by card style
  }

  doAttachTrackpadButtonParts(buttonsRow, trackpadButtonParts) {
    for (const trackpadButtonPart of trackpadButtonParts) {
      buttonsRow.appendChild(trackpadButtonPart);
    }
  }

  doQueryTrackpadButtonPartsElements() {
    // Nothing to do: elements references not needed
  }

  doListenTrackpadButtonParts() {
    // Nothing to do: buttons interractions already handled at buttons level
  }

  createFirstButtonParts(trackpadButtonConfig) {
    return [
      this.createTrackpadButton(trackpadButtonConfig)
    ];
  }

  createSecondaryButtonParts(trackpadButtonConfig) {
    return [
      this.createTrackpadButtonSeparator(),
      this.createTrackpadButton(trackpadButtonConfig)
    ];
  }

  createTrackpadButton(trackpadButtonConfig) {
    const trackpadButton = this.doTrackpadButton(trackpadButtonConfig);
    this.doStyleTrackpadButton();
    this.doAttachTrackpadButton();
    this.doQueryTrackpadButtonElements();
    this.doListenTrackpadButton(trackpadButton);
    return trackpadButton;
  }

  doTrackpadButton(trackpadButtonConfig) {
    const trackpadButton = document.createElement("button");
    trackpadButton.className = `trackpad-button ${trackpadButtonConfig["button"]}`;
    this.setTrackpadButtonData(trackpadButton, null, trackpadButtonConfig);
    return trackpadButton;
  }

  doStyleTrackpadButton() {
    // Nothing to do: already carried by card style
  }

  doAttachTrackpadButton() {
    // Nothing to do: will be attached later into buttonsRow
  }

  doQueryTrackpadButtonElements() {
    // Nothing to do: no needs for trackpad button elements
  }

  doListenTrackpadButton(trackpadButton) {
    this._eventManager.addPointerDownListenerToContainer("layoutContainer", trackpadButton, this.onTrackpadButtonPointerDown.bind(this));
    this._eventManager.addPointerUpListenerToContainer("layoutContainer", trackpadButton, this.onTrackpadButtonPointerUp.bind(this));
  }
  
  onTrackpadButtonPointerDown(evt) {
    const trackpadButton = evt.currentTarget;
    const trackpadButtonData = this._layoutManager.getElementData(trackpadButton);
    this.sendMouse(trackpadButtonData["event"], {});
  }

  onTrackpadButtonPointerUp(evt) {
    this.sendMouseClickRelease();
  }
  
  createTrackpadButtonSeparator() {
    const trackpadButtonSeparator = this.doTrackpadButtonSeparator();
    this.doStyleTrackpadButtonSeparator();
    this.doAttachTrackpadButtonSeparator();
    this.doQueryTrackpadButtonSeparatorElements();
    this.doListenTrackpadButtonSeparator();
    return trackpadButtonSeparator;
  }

  doTrackpadButtonSeparator() {
    const trackpadButtonSeparator = document.createElement("div");
    trackpadButtonSeparator.className = "trackpad-button-separator";
    return trackpadButtonSeparator;
  }

  doStyleTrackpadButtonSeparator() {
    // Nothing to do: already carried by card style
  }

  doAttachTrackpadButtonSeparator() {
    // Nothing to do: will be attached later into buttonsRow
  }

  doQueryTrackpadButtonSeparatorElements() {
    // Nothing to do: no needs for trackpad button elements
  }

  doListenTrackpadButtonSeparator() {
    // Nothing to do: non-interactable object
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
      trigger_scroll_horizontal_delta: 2,
      trigger_scroll_vertical_delta: 2,
      trigger_scroll_delay: 250,
      trigger_long_scroll_delay: 350,
      trigger_long_scroll_decrease_interval: 25,
      trigger_long_scroll_min_interval: 75
    };
  }

  getCardSize() {
    return 3;
  }

  doUpdateScrollZones() {
    const trackpadArea = this._elements.trackpad;
    const scrollZonesContainer = this._elements.scrollZonesContainer;

    if (this._isScrollModeOn) {
      trackpadArea.appendChild(scrollZonesContainer);
    } else {
      trackpadArea.removeChild(scrollZonesContainer);
    }
  }

  doScrollOnce(scrollZoneConfig) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doScrollOnce(scrollZoneConfig):`, scrollZoneConfig));
    const scrollZone = scrollZoneConfig.zone;
    switch (scrollZone) {
      case "top":
        this.sendMouseScroll(0, 1);
        this._layoutManager.hapticFeedbackShort();
        break;
      case "bottom":
        this.sendMouseScroll(0, -1);
        this._layoutManager.hapticFeedbackShort();
        break;
      case "left":
        this.sendMouseScroll(-1, 0);
        this._layoutManager.hapticFeedbackShort();
        break;
      case "right":
        this.sendMouseScroll(1, 0);
        this._layoutManager.hapticFeedbackShort();
        break;
    }
  }

  addScrollZoneLongClickTimeout(evt, scrollZoneConfig, triggerDelay) {
    return setTimeout(() => {
      const clickEntry = this._scrollsClick.get(evt.pointerId);
      if (clickEntry) {

        const duration = this._eventManager.getElapsedTime(clickEntry["event"], evt);
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Scroll zone ${scrollZoneConfig.zone} long click of ${duration}ms detected for evt:`, evt));

        // Scroll once into current scrollZoneConfig direction
        this.doScrollOnce(scrollZoneConfig);

        // Compute next trigger delay
        const nextTriggerDelay = Math.max(this.getTriggerLongScrollMinInterval(), triggerDelay - this.getTriggerLongScrollDecreaseInterval())
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Next scroll zone long click ${scrollZoneConfig.zone} will be triggered in ${nextTriggerDelay}ms`));

        // Add next scroll event
        this._scrollsClick.set(evt.pointerId, { "event": evt , "long-scroll-timeout": this.addScrollZoneLongClickTimeout(evt, scrollZoneConfig, nextTriggerDelay) } );
      }
    }, triggerDelay); // next long-scroll duration
  }

  clearScrollZoneLongClickTimeout(evt) {
    const clickEntry = this._scrollsClick.get(evt.pointerId);
    if (clickEntry && clickEntry["long-scroll-timeout"]) clearTimeout(clickEntry["long-scroll-timeout"]);
    return clickEntry;
  }

  addTrackpadLongClickTimeout(evt) {
    return setTimeout(() => {

      // Retrieve current pointer from tracked trackpad click pointers
      const clickEntry = this._pointersClick.get(evt.pointerId);
      if (clickEntry && !clickEntry["move-detected"]) {

        const duration = this._eventManager.getElapsedTime(clickEntry["event"], evt);
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Trackpad long-click of ${duration}ms detected for evt:`, evt));

        this.handleSinglePointerLeftDblClick(evt);
      }
    }, this.getTriggerLongClickDelay()); // long-press duration
  }
  
  clearTrackpadLongClickTimeout(evt) {
    const clickEntry = this._pointersClick.get(evt.pointerId);
    if (clickEntry && clickEntry["long-click-timeout"]) clearTimeout(clickEntry["long-click-timeout"]);
    return clickEntry;
  }

  handleSinglePointerLeftClick(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleSinglePointerLeftClick(evt):", evt));
    this.sendMouseClickLeft();
    this.sendMouseClickRelease();
    this._layoutManager.hapticFeedback();
  }

  handleSinglePointerLeftDblClick(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleSinglePointerLeftDblClick(evt):", evt));
    this.sendMouseClickLeft();
    this.sendMouseClickRelease();
    this.sendMouseClickLeft();
    this.sendMouseClickRelease();
    this._layoutManager.hapticFeedbackLong();
  }

  handleSinglePointerMove(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleSinglePointerMove(evt):", evt));
    let updateStartPoint = true;
    if (this.getTrackpadMode() === "move") {
      updateStartPoint = this.handleMouseMove(evt);
    }
    return updateStartPoint;
  }

  handleDoublePointersMove(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleDoublePointersMove(evt):", evt));
    return this.handleMouseScroll(evt);
  }

  handleMouseMove(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleMouseMove(evt):", evt));
    const updateStartPoint = true;
    const startEvent = this._pointersStart.get(evt.pointerId);
    const endEvent = this._pointersEnd.get(evt.pointerId);
    const { dx, dy } = this.getPointerDelta(startEvent, endEvent);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Delta detected for one pointer:${evt.pointerId}`, dx, dy));
    if (dx !== 0 || dy !== 0) {
      this.sendMouseMove(dx, dy);
      this._layoutManager.hapticFeedbackShort();
    }
    return updateStartPoint;
  }

  handleMouseScroll(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleMouseScroll(evt):", evt));

    // Check if pointer physically moved enough this time, to trigger "scroll-detection"
    const { dx, dy } = this.getDoublePointerDelta(this._pointersStart, this._pointersEnd);
    const horizontalTrigger = Math.abs(dx) > this.getTriggerMoveHorizontalDelta();
    const verticalTrigger = Math.abs(dy) > this.getTriggerMoveVerticalDelta();
    if (horizontalTrigger || verticalTrigger) {
      // Check if not already scrolling
      if (this._scrollsMove.size === 0) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Scroll detected for evt:", evt));

        // Determine scroll direction
        const scrollZone = verticalTrigger ? (dy > 0 ? "bottom" : "top") : (dx > 0 ? "right" : "left");
        const scrollZoneConfig = { "zone":  scrollZone };

        // Scroll once using clicked scroll zone
        this.doScrollOnce(scrollZoneConfig);
        
        // Setup repeated scrolls when scroll zone is long-press maintained (with fixed single ID due to multiple pointers)
        this._scrollsMove.set(this._scrollMoveId, { "scroll-timeout": this.addScrollZoneLongMoveTimeout(scrollZoneConfig, this.getTriggerScrollDelay()) } );
      }
      return true;
    }
    return false;
  }

  addScrollZoneLongMoveTimeout(scrollZoneConfig, triggerDelay) {
    return setTimeout(() => {
      const clickEntry = this._scrollsMove.get(this._scrollMoveId); // Fixed single ID due to multiple pointers
      if (clickEntry) {

        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Scroll zone ${scrollZoneConfig.zone} long move detected with delay of ${triggerDelay}ms`));

        // Scroll once into current scrollZoneConfig direction
        this.doScrollOnce(scrollZoneConfig);

        // Add next move scroll event with the same delay
        this._scrollsClick.set(this._scrollMoveId, { "scroll-timeout": this.addScrollZoneLongMoveTimeout(scrollZoneConfig, triggerDelay) } );
      }
    }, triggerDelay); // next move-scroll duration
  }

  clearScrollZoneLongMoveTimeout() {
    const clickEntry = this._scrollsMove.get(this._scrollMoveId); // Fixed single ID due to multiple pointers
    if (clickEntry && clickEntry["scroll-timeout"]) clearTimeout(clickEntry["scroll-timeout"]);
    return clickEntry;
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
    this._eventManager.callComponentServiceWithServerId(serviceName, serviceArgs);
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

  setTrackpadButtonData(btn, defaultConfig, overrideConfig) {
    this._layoutManager.setElementData(btn, defaultConfig, overrideConfig, (key, value, source) => this._allowedTrackpadButtonData.has(key));
  }

  setScrollZoneData(scrollZone, defaultConfig, overrideConfig) {
    this._layoutManager.setElementData(scrollZone, defaultConfig, overrideConfig, (key, value, source) => this._allowedScrollZoneData.has(key));
  }

}

if (!customElements.get("trackpad-card")) customElements.define("trackpad-card", TrackpadCard);
