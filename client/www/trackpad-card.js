import { Logger } from './utils/logger.js';

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
    this.loglevel = 'trace';
    this.logpushback = false;
    this.logger = new Logger(this.loglevel, this._hass, this.logpushback);
    this.haptic = false;
    this.buttonsMode = 'left-middle-right';
    
    // Layout loading flags
    this._layoutReady = false;
    this._layoutLoaded = {};
    
    this.isToggledOn = false;
    this.pointersClick = new Map();
    this.pointersStart = new Map();
    this.pointersEnd = new Map();

    this.triggerDeltaX = 2;
    this.triggerDeltaY = 2;
    this.triggerLongClick = 500;
    
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
    
    // Set layout buttons
    if (config['buttons']) {
      this.buttonsMode = config['buttons'];
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
        top: 8px;
        right: 8px;
        width: 42px;
        height: 42px;
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
        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;
      }
      .scroll-icon.toggled-on {
        stroke: #44739e !important;
        fill: #44739e !important;
        color: #44739e !important;
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

    const svgNS = "http://www.w3.org/2000/svg";
    const scrollIcon = document.createElementNS(svgNS, "svg");
    scrollIcon.setAttribute("viewBox", "0 0 84 84");
    scrollIcon.setAttribute("class", "scroll-icon");
    scrollIcon.innerHTML = `
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
    `;
    
    this.addPointerClickListener(scrollIcon, e => {
      e.stopPropagation();
      this.isToggledOn = !this.isToggledOn;
      scrollIcon.classList.toggle("toggled-on", this.isToggledOn);
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("scroll mode toggle on:", this.isToggledOn));
    });

    trackpad.appendChild(scrollIcon);

    // Track touches
    this.addPointerDownListener(trackpad, (e) => {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("pointerDown(e):", e));
      this.pointersClick.set(e.pointerId, { "move-detected": false, "event": e , "long-click-timeout": this.addLongClickTimeout(e) } );
      this.pointersStart.set(e.pointerId, e);
      this.pointersEnd.set(e.pointerId);
    });

    this.addPointerUpListener(trackpad, (e) => {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("pointerUp(e):", e));
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

    this.addPointerCancelListener(trackpad, (e) => {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("pointerCancel(e):", e));
      this.clearLongClickTimeout(e);
      this.pointersEnd.delete(e.pointerId);
      this.pointersStart.delete(e.pointerId);
      this.pointersClick.delete(e.pointerId);
    });

    this.addPointerLeaveListener(trackpad, (e) => {
      if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("pointerLeave(e):", e));
      this.clearLongClickTimeout(e);
      this.pointersEnd.delete(e.pointerId);
      this.pointersStart.delete(e.pointerId);
      this.pointersClick.delete(e.pointerId);
    });

    this.addPointerMoveListener(trackpad, (e) => {
      const clickEntry = this.pointersClick.get(e.pointerId);
      if (clickEntry && !clickEntry["move-detected"]) {
        // No move detected as-of now:
        // check if pointer moved enough this time to trigger move-detection
        const { dx, dy } = this.getPointerDelta(clickEntry["event"], e);

        if (Math.abs(dx) > this.triggerDeltaX || Math.abs(dy) > this.triggerDeltaY) {
          if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("Move detected for pointer:", e));
          clickEntry["move-detected"] = true;
        }
      }

      if (this.pointersStart.has(e.pointerId)) {
        this.pointersEnd.set(e.pointerId, e);

        if (this.pointersStart.size === 1) {
          // Single touch: mouse move
          this.handleSinglePointerMove(e);
        } else if (this.pointersStart.size === 2 && this.pointersEnd.size === 2) {
          // Double-touch: mouse scroll
          this.handleDoublePointersMove(e);
        }

        this.pointersStart.set(e.pointerId, e);
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
        this.addPointerDownListener(btn, () => {
          hass.callService("trackpad_mouse", serviceCall, {});
        });
        this.addPointerUpListener(btn, () => {
          hass.callService("trackpad_mouse", "clickrelease", {});
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
    this._hass.callService("trackpad_mouse", "clickleft", {});
    this._hass.callService("trackpad_mouse", "clickrelease", {});
  }
  
  handleSinglePointerLeftDblClick(e) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleSinglePointerLeftDblClick(e):", e));
    this._hass.callService("trackpad_mouse", "clickleft", {});
    this._hass.callService("trackpad_mouse", "clickrelease", {});
    this._hass.callService("trackpad_mouse", "clickleft", {});
    this._hass.callService("trackpad_mouse", "clickrelease", {});
  }

  handleSinglePointerMove(e) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleSinglePointerMove(e):", e));
    const startEvent = this.pointersStart.get(e.pointerId);
    const endEvent = this.pointersEnd.get(e.pointerId);
    const { dx, dy } = this.getPointerDelta(startEvent, endEvent);
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Delta detected for one pointer:${e.pointerId}`, dx, dy));
    if (dx !== 0 || dy !== 0) {
      this._hass.callService("trackpad_mouse", this.getTrackpadMode(), { x: dx, y: dy, });
    }
  }

  handleDoublePointersMove(e) {
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("handleDoublePointersMove(e):", e));
    const { dx, dy } = this.getDoublePointerDelta(this.pointersStart, this.pointersEnd);
    if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Delta detected for two pointers:`, dx, dy));
    if (dx !== 0 || dy !== 0) {
      this._hass.callService("trackpad_mouse", "scroll", { x: dx, y: dy, });
    }
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


customElements.define("trackpad-card", TrackpadCard);
