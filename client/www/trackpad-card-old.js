console.info("Loading Trackpad Card");

// Define logger helper class
class Logger {
  constructor(level = 'info') {
    this.levels = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
    this.setLevel(level);
  }
  setLevel(level) { this.level = this.levels[level] ?? 0; }
  isLevelEnabled(level) { return (level <= this.level); }
  isErrorEnabled() { return this.isLevelEnabled(0); }
  isWarnEnabled() { return this.isLevelEnabled(1); }
  isInfoEnabled() { return this.isLevelEnabled(2); }
  isDebugEnabled() { return this.isLevelEnabled(3); }
  isTraceEnabled() { return this.isLevelEnabled(4); }
  
  getArgs(header, logStyle, ...args) {
    if (args && args.length && args.length > 0) {
      return [`%c[${header}]`, logStyle, ...args];
    }
    return [`%c[${header}]`, logStyle];
  }

  // ERROR: if (this.logger.isErrorEnabled()) console.error(...this.logger.error(args));
  error(...args) { return this.getArgs('ERR', 'background: #d6a1a1; color: black; font-weight: bold;', ...args); }
  // WARN: if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(args));
  warn(...args)  { return this.getArgs('WRN', 'background: #d6c8a1; color: black; font-weight: bold;', ...args); }
  // INFO: if (this.logger.isInfoEnabled()) console.info(...this.logger.info(args));
  info(...args)  { return this.getArgs('INF', 'background: #a2d6a1; color: black; font-weight: bold;', ...args); }
  // DEBUG: if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(args));
  debug(...args) { return this.getArgs('DBG', 'background: #75aaff; color: black; font-weight: bold;', ...args); }
  // TRACE: if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(args));
  trace(...args) { return this.getArgs('TRA', 'background: #b7b8b6; color: black; font-weight: bold;', ...args); }
}

class TrackpadCard extends HTMLElement {
  constructor() {
    super();
    this.loglevel = 'warn';
    this.logger = new Logger(this.loglevel);

    this.attachShadow({ mode: "open" }); // Create shadow root
    
    this._hass = null;
    this._uiBuilt = false;
    this.card = null;
    
    this.haptic = false;
  }

  setConfig(config) {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("setConfig(config):", this.config, config));
    this.config = config;

    // Retrieve user configured logging level
    if (config.loglevel) {
      this.loglevel = config.loglevel;
    }

    // Retrieve user configured haptic feedback
    if (config.haptic) {
      this.haptic = config.haptic;
    }
  }

  getCardSize() {
    return 3;
  }

  async connectedCallback() {
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug("connectedCallback()"));

    // Only build UI if hass is already set
    if (this._hass) {
      this.buildUi(this._hass);
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

    // Create a new logger
    this.logger = new Logger(this.loglevel);

    const card = document.createElement("ha-card");
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
      .btn-separator {
        width: 1px;
        background-color: #0a0a0a;
      }
      .trackpad-area {
        cursor: crosshair;
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
        filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.6)); /* soft black shadow */
      }
      .trackpad-area.dragging .scroll-icon {
        cursor: crosshair;
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

    this.content = document.createElement("div");
    this.content.className = "trackpad-area";
    this.content.style.height = "200px";
    this.content.style.width = "100%";
    this.content.style.background = "#3b3a3a";
    this.content.style.touchAction = "none";
    this.content.style.position = "relative";
    this.content.style.borderBottom = "1px solid #0a0a0a";
    this.content.style.transition = "background 0.2s ease";

    // Create scroll icon SVG
    const svgNS = "http://www.w3.org/2000/svg";
    const scrollIcon = document.createElementNS(svgNS, "svg");
    scrollIcon.setAttribute("viewBox", "0 0 84 84");
    scrollIcon.setAttribute("class", "scroll-icon");

    let isToggledOn = false;

    const scale = 1.3125;
    const scalePoints = points =>
      points
        .split(" ")
        .map(pair => {
          const [x, y] = pair.split(",").map(Number);
          return `${x * scale},${y * scale}`;
        })
        .join(" ");

    const createSvgElement = (name, attributes) => {
      const el = document.createElementNS(svgNS, name);
      for (const key in attributes) el.setAttribute(key, attributes[key]);
      return el;
    };

    scrollIcon.appendChild(
      createSvgElement("rect", {
        x: 16 * scale,
        y: 12 * scale,
        width: 32 * scale,
        height: 40 * scale,
        rx: 12 * scale,
        ry: 12 * scale,
        stroke: "currentColor",
        "stroke-width": "2",
        fill: "none",
      })
    );

    scrollIcon.appendChild(
      createSvgElement("line", {
        x1: 32 * scale,
        y1: 20 * scale,
        x2: 32 * scale,
        y2: 44 * scale,
        stroke: "currentColor",
        "stroke-width": "2",
      })
    );

    scrollIcon.appendChild(
      createSvgElement("polyline", {
        points: scalePoints("28,24 32,20 36,24"),
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
      })
    );

    scrollIcon.appendChild(
      createSvgElement("polyline", {
        points: scalePoints("28,40 32,44 36,40"),
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
      })
    );

    scrollIcon.appendChild(
      createSvgElement("line", {
        x1: 20 * scale,
        y1: 32 * scale,
        x2: 44 * scale,
        y2: 32 * scale,
        stroke: "currentColor",
        "stroke-width": "2",
      })
    );

    scrollIcon.appendChild(
      createSvgElement("polyline", {
        points: scalePoints("24,28 20,32 24,36"),
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
      })
    );

    scrollIcon.appendChild(
      createSvgElement("polyline", {
        points: scalePoints("40,28 44,32 40,36"),
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
      })
    );

    scrollIcon.addEventListener("click", e => {
      e.stopPropagation();
      isToggledOn = !isToggledOn;
      scrollIcon.classList.toggle("toggled-on", isToggledOn);
    });

    this.content.appendChild(scrollIcon);

    let lastX = null;
    let lastY = null;
    let trackpadMode = null;

    this.content.addEventListener("pointerdown", e => {
      lastX = e.clientX;
      lastY = e.clientY;
      this.content.classList.add("dragging");
    });

    this.content.addEventListener("pointerup", () => {
      lastX = null;
      lastY = null;
      this.content.classList.remove("dragging");
    });

    this.content.addEventListener("pointerleave", () => {
      lastX = null;
      lastY = null;
      this.content.classList.remove("dragging");
    });

    this.content.addEventListener("pointermove", e => {
      if (e.buttons === 1 && lastX !== null && lastY !== null) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        if (isToggledOn) {
          trackpadMode = "scroll";
        } else {
          trackpadMode = "move";
        }
        hass.callService("trackpad_mouse", trackpadMode, {
          x: dx,
          y: dy,
        });
      }
    });

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.width = "100%";
    buttonRow.style.background = "#00000000";

    const createButton = (serviceCall, className) => {
      const btn = document.createElement("button");
      btn.className = `trackpad-btn ${className}`;
      btn.addEventListener("pointerdown", () => {
        hass.callService("trackpad_mouse", serviceCall, {});
      });
      btn.addEventListener("pointerup", () => {
        hass.callService("trackpad_mouse", "clickrelease", {});
      });
      btn.addEventListener("touchend", () => {
        hass.callService("trackpad_mouse", "clickrelease", {});
      });
      return btn;
    };

    const leftBtn = createButton("clickleft", "trackpad-left");
    const middleBtn = createButton("clickmiddle", "trackpad-middle");
    const rightBtn = createButton("clickright", "trackpad-right");

    const sep1 = document.createElement("div");
    sep1.className = "btn-separator";

    const sep2 = document.createElement("div");
    sep2.className = "btn-separator";

    buttonRow.appendChild(leftBtn);
    buttonRow.appendChild(sep1);
    buttonRow.appendChild(middleBtn);
    buttonRow.appendChild(sep2);
    buttonRow.appendChild(rightBtn);

    container.appendChild(this.content);
    container.appendChild(buttonRow);

    card.appendChild(container);
    this.shadowRoot.appendChild(card);
    
    this.card = card;
    this.content = container;
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
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Adding event listener ${eventName} on ${target} with options ${options}`));
        target.addEventListener(eventName, callback, options);
      } else {
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Adding event listener ${eventName} on ${target}`));
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
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Removing event listener ${eventName} on ${target} with options ${options}`));
        target.removeEventListener(eventName, callback, options);
      } else {
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Removing event listener ${eventName} on ${target}`));
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

    // Given abstractEventName, then try to retrieve previously cached prefered concrete js event
    const preferedEventName = this.preferedEventsNames.get(abstractEventName);
    if (preferedEventName) return preferedEventName;

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
        this.preferedEventsNames.set(preferedEventName, mappedEvent);

        // Return prefered concrete js event
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(`Cached supported concrete js event ${mappedEvent} as prefered event for ${abstractEventName}`));
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
