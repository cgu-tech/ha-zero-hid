console.info("Loading Trackpad Card");

(() => {
  class TrackpadCard extends HTMLElement {
    set hass(hass) {
      if (!this.content) {
        const card = document.createElement("ha-card");
        card.header = "Mouse Trackpad";

        // Inject shared styles
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
          .trackpad-area:active {
            background: #2c2b2b !important;
          }
          /* New styles for the overlay icon */
          .scroll-icon {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 42px;       /* increased from 32 */
            height: 42px;      /* increased from 32 */
            pointer-events: none; /* so it doesn't block pointer events */
            opacity: 0.7;
            fill: #eee;
            stroke: #eee;
          }
        `;
        this.appendChild(style);

        // Main container
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.alignItems = "center";
        container.style.padding = "0";
        container.style.backgroundColor = "#00000000";

        // Trackpad area
        this.content = document.createElement("div");
        this.content.className = "trackpad-area";
        this.content.style.height = "200px";
        this.content.style.width = "100%";
        this.content.style.background = "#3b3a3a";
        this.content.style.touchAction = "none";
        this.content.style.cursor = "crosshair";
        this.content.style.position = "relative";
        this.content.style.borderBottom = "1px solid #0a0a0a";
        this.content.style.transition = "background 0.2s ease";

        // Add the scrolling icon SVG overlay
        const svgNS = "http://www.w3.org/2000/svg";
        const scrollIcon = document.createElementNS(svgNS, "svg");
        scrollIcon.setAttribute("viewBox", "0 0 84 84"); // scaled 64 * 1.3125 = 84
        scrollIcon.setAttribute("class", "scroll-icon");

        const scale = 1.3125; // 42 / 32

        // Helper to scale points string
        function scalePoints(points) {
          return points
            .split(" ")
            .map(pair => {
              const [x, y] = pair.split(",").map(Number);
              return `${x * scale},${y * scale}`;
            })
            .join(" ");
        }

        // Mouse outline
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", (16 * scale).toString());
        rect.setAttribute("y", (12 * scale).toString());
        rect.setAttribute("width", (32 * scale).toString());
        rect.setAttribute("height", (40 * scale).toString());
        rect.setAttribute("rx", (12 * scale).toString());
        rect.setAttribute("ry", (12 * scale).toString());
        rect.setAttribute("stroke", "currentColor");
        rect.setAttribute("stroke-width", "2");
        rect.setAttribute("fill", "none");
        scrollIcon.appendChild(rect);

        // Vertical arrow line
        const vLine = document.createElementNS(svgNS, "line");
        vLine.setAttribute("x1", (32 * scale).toString());
        vLine.setAttribute("y1", (20 * scale).toString());
        vLine.setAttribute("x2", (32 * scale).toString());
        vLine.setAttribute("y2", (44 * scale).toString());
        vLine.setAttribute("stroke", "currentColor");
        vLine.setAttribute("stroke-width", "2");
        scrollIcon.appendChild(vLine);

        // Vertical arrowheads
        const vUpArrow = document.createElementNS(svgNS, "polyline");
        vUpArrow.setAttribute("points", scalePoints("28,24 32,20 36,24"));
        vUpArrow.setAttribute("fill", "none");
        vUpArrow.setAttribute("stroke", "currentColor");
        vUpArrow.setAttribute("stroke-width", "2");
        scrollIcon.appendChild(vUpArrow);

        const vDownArrow = document.createElementNS(svgNS, "polyline");
        vDownArrow.setAttribute("points", scalePoints("28,40 32,44 36,40"));
        vDownArrow.setAttribute("fill", "none");
        vDownArrow.setAttribute("stroke", "currentColor");
        vDownArrow.setAttribute("stroke-width", "2");
        scrollIcon.appendChild(vDownArrow);

        // Horizontal arrow line
        const hLine = document.createElementNS(svgNS, "line");
        hLine.setAttribute("x1", (20 * scale).toString());
        hLine.setAttribute("y1", (32 * scale).toString());
        hLine.setAttribute("x2", (44 * scale).toString());
        hLine.setAttribute("y2", (32 * scale).toString());
        hLine.setAttribute("stroke", "currentColor");
        hLine.setAttribute("stroke-width", "2");
        scrollIcon.appendChild(hLine);

        // Horizontal arrowheads
        const hLeftArrow = document.createElementNS(svgNS, "polyline");
        hLeftArrow.setAttribute("points", scalePoints("24,28 20,32 24,36"));
        hLeftArrow.setAttribute("fill", "none");
        hLeftArrow.setAttribute("stroke", "currentColor");
        hLeftArrow.setAttribute("stroke-width", "2");
        scrollIcon.appendChild(hLeftArrow);

        const hRightArrow = document.createElementNS(svgNS, "polyline");
        hRightArrow.setAttribute("points", scalePoints("40,28 44,32 40,36"));
        hRightArrow.setAttribute("fill", "none");
        hRightArrow.setAttribute("stroke", "currentColor");
        hRightArrow.setAttribute("stroke-width", "2");
        scrollIcon.appendChild(hRightArrow);

        this.content.appendChild(scrollIcon);

        let lastX = null;
        let lastY = null;

        this.content.addEventListener("pointerdown", e => {
          lastX = e.clientX;
          lastY = e.clientY;
        });

        this.content.addEventListener("pointerup", () => {
          lastX = null;
          lastY = null;
        });

        this.content.addEventListener("pointermove", e => {
          if (e.buttons === 1 && lastX !== null && lastY !== null) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            hass.callService("trackpad_mouse", "move", {
              x: dx,
              y: dy
            });
          }
        });

        // Button row
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

        // Create buttons with classes
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

        // Assemble card
        container.appendChild(this.content);
        container.appendChild(buttonRow);
        card.appendChild(container);
        this.appendChild(card);
      }
    }

    setConfig(config) {}
    getCardSize() {
      return 3;
    }
  }

  customElements.define("trackpad-card", TrackpadCard);
})();
