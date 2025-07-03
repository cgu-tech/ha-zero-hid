console.info("Loading Enhanced Trackpad Card");

class TrackpadCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._uiBuilt = false;
    this.card = null;
  }

  setConfig(config) {}

  getCardSize() {
    return 3;
  }

  async connectedCallback() {
    if (this._hass) {
      this.buildUi(this._hass);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._uiBuilt) {
      this.buildUi(this._hass);
    }
  }

  buildUi(hass) {
    if (this._uiBuilt) return;

    this._uiBuilt = true;
    this.shadowRoot.innerHTML = '';

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

    let isToggledOn = false;
    let lastX = null;
    let lastY = null;
    let trackpadMode = null;
    
    // let tapStartTime = 0;
    // let longPressTimeout;
    // let lastTapTime = 0;
    // let doubleTapMode = false;
    // let scrollDirection = null;

    scrollIcon.addEventListener("click", e => {
      e.stopPropagation();
      isToggledOn = !isToggledOn;
      scrollIcon.classList.toggle("toggled-on", isToggledOn);
    });

    trackpad.appendChild(scrollIcon);

    // Two-finger tap detection
    const activePointers = new Map();
    let twoFingerTapTimeout = null;
    const twoFingerSwipes = {
      startPositions: new Map(),
      endPositions: new Map(),
    };
    
    function getAverageDelta(startMap, endMap) {
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
      return { dx: dx / count, dy: dy / count };
    }
    
    // Track touches
    trackpad.addEventListener("pointerdown", (e) => {
      activePointers.set(e.pointerId, e);
    });

    trackpad.addEventListener("pointerup", (e) => {
      activePointers.delete(e.pointerId);
    });

    trackpad.addEventListener("pointercancel", (e) => {
      activePointers.delete(e.pointerId);
    });

    trackpad.addEventListener("pointerleave", (e) => {
      activePointers.delete(e.pointerId);
    });

    trackpad.addEventListener("pointermove", (e) => {      
      if (activePointers.has(e.pointerId)) {
        twoFingerSwipes.endPositions.set(e.pointerId, e);

        if (activePointers.size === 1) {
          // Single touch: mouse move
          const lastE = activePointers.get(e.pointerId);
          const lastX = lastE.clientX;
          const lastY = lastE.clientY;
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          activePointers.set(e.pointerId, e);

          if (isToggledOn) {
            trackpadMode = "scroll";
          } else {
            trackpadMode = "move";
          }
          hass.callService("trackpad_mouse", trackpadMode, {
            x: dx,
            y: dy,
          });
        } else if (activePointers.size === 2 && twoFingerSwipes.endPositions.size === 2) {
          // Double-touch: mouse scroll
          const { dx, dy } = getAverageDelta(
            activePointers,
            twoFingerSwipes.endPositions
          );
          activePointers.set(e.pointerId, e);

          hass.callService("trackpad_mouse", "scroll", {
            x: dx,
            y: dy,
          });
        }
      }
    });

    //// POINTER EVENTS
    //trackpad.addEventListener("pointerdown", e => {
    //  const now = Date.now();
    //
    //  if (now - lastTapTime < 300) {
    //    doubleTapMode = true;
    //    scrollDirection = null;
    //  } else {
    //    doubleTapMode = false;
    //  }
    //
    //  lastTapTime = now;
    //  tapStartTime = now;
    //
    //  longPressTimeout = setTimeout(() => {
    //    hass.callService("trackpad_mouse", "clickright", {});
    //    setTimeout(() => hass.callService("trackpad_mouse", "clickrelease", {}), 100);
    //  }, 600);
    //
    //  lastX = e.clientX;
    //  lastY = e.clientY;
    //  trackpad.classList.add("dragging");
    //});
    //
    //trackpad.addEventListener("pointerup", e => {
    //  trackpad.classList.remove("dragging");
    //  clearTimeout(longPressTimeout);
    //
    //  const tapDuration = Date.now() - tapStartTime;
    //  if (tapDuration < 300 && !doubleTapMode) {
    //    hass.callService("trackpad_mouse", "clickleft", {});
    //    setTimeout(() => hass.callService("trackpad_mouse", "clickrelease", {}), 100);
    //  }
    //
    //  doubleTapMode = false;
    //  scrollDirection = null;
    //  lastX = null;
    //  lastY = null;
    //});
    //
    //trackpad.addEventListener("pointerleave", () => {
    //  trackpad.classList.remove("dragging");
    //  clearTimeout(longPressTimeout);
    //  lastX = null;
    //  lastY = null;
    //  doubleTapMode = false;
    //  scrollDirection = null;
    //});
    //
    //trackpad.addEventListener("pointermove", e => {
    //  if (e.buttons === 1 && lastX !== null && lastY !== null) {
    //    let dx = e.clientX - lastX;
    //    let dy = e.clientY - lastY;
    //    lastX = e.clientX;
    //    lastY = e.clientY;
    //
    //    if (doubleTapMode) {
    //      if (!scrollDirection) {
    //        scrollDirection = Math.abs(dx) > Math.abs(dy) ? "vertical" : "horizontal";
    //      }
    //
    //      if (scrollDirection === "vertical") {
    //        hass.callService("trackpad_mouse", "scroll", { x: 0, y: dx });
    //      } else {
    //        hass.callService("trackpad_mouse", "scroll", { x: dy, y: 0 });
    //      }
    //    } else if (isToggledOn) {
    //      hass.callService("trackpad_mouse", "scroll", { x: dx, y: dy });
    //    } else {
    //      hass.callService("trackpad_mouse", "move", { x: dx, y: dy });
    //    }
    //  }
    //});

    // Buttons
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

    container.appendChild(trackpad);
    container.appendChild(buttonRow);

    card.appendChild(container);
    this.shadowRoot.appendChild(card);
    
    this.card = card;
    this.content = container;
  }
}

customElements.define("trackpad-card", TrackpadCard);
