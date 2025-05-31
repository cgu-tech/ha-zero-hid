console.info("Loading Trackpad Card");

(() => {
  class TrackpadCard extends HTMLElement {
    set hass(hass) {
      if (!this.content) {
        const card = document.createElement("ha-card");
        card.header = "Mouse Trackpad";

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
        this.appendChild(style);

        const container = document.createElement("div");
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
          console.log(`Scroll icon toggled ${isToggledOn ? "ON" : "OFF"}`);
        });

        this.content.appendChild(scrollIcon);

        let lastX = null;
        let lastY = null;

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

            hass.callService("trackpad_mouse", "move", {
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
