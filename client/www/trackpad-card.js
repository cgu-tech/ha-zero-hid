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
          btn.addEventListener("click", () => {
            hass.callService("trackpad_mouse", serviceCall, {});
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
