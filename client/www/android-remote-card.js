console.info("Loading Android Remote Card");

class AndroidRemoteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    if (this.content) return;

    const card = document.createElement("ha-card");
    const style = document.createElement("style");
    style.textContent = `
      .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        background: #1e1e1e;
        color: #fff;
        font-family: sans-serif;
      }

      .dpad-container {
        width: 100%;
        max-width: 400px;
        aspect-ratio: 1 / 1;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0000;
        border-bottom: 1px solid #111;
      }

      svg.dpad {
        width: 85%;
        height: auto;
      }

      .dpad-button {
        fill: #3a3a3a;
        stroke: #2e2e2e;
        cursor: pointer;
        transition: fill 0.2s;
      }

      .dpad-button:hover {
        fill: #4a4a4a;
      }

      .center-button {
        fill: #3a3a3a;
        cursor: pointer;
        transition: fill 0.2s;
      }

      .center-button:hover {
        fill: #4a4a4a;
      }

      .foldable-buttons {
        display: flex;
        width: 100%;
        background: #1a1a1a;
      }

      .foldable-button {
        flex: 1;
        background: #333;
        color: white;
        padding: 10px;
        cursor: pointer;
        text-align: center;
        user-select: none;
        border: none;
        font-weight: bold;
        transition: background 0.2s;
      }

      .foldable-button:hover {
        background: #444;
      }

      .foldable-button.active {
        background: #555;
        color: #00eaff;
      }

      .panel {
        display: none;
        width: 100%;
        background: #2b2b2b;
      }

      .panel.active {
        display: block;
      }
    `;
    this.shadowRoot.appendChild(style);

    const container = document.createElement("div");
    container.className = "container";

    const dpadContainer = document.createElement("div");
    dpadContainer.className = "dpad-container";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "dpad");

    const directions = {
      top: { label: "↑", angle: -90 },
      right: { label: "→", angle: 0 },
      bottom: { label: "↓", angle: 90 },
      left: { label: "←", angle: 180 }
    };

    const rOuter = 95;   // Larger radius
    const rInner = 41;   // Increased inner radius for bigger button size
    const gap = 1;       // Small gap between buttons

    Object.entries(directions).forEach(([dir, { label, angle }]) => {
      const path = document.createElementNS(svgNS, "path");

      const startAngle = angle - 45 + gap;
      const endAngle = angle + 45 - gap;

      const rad = a => (a * Math.PI) / 180;
      const x1 = 100 + rInner * Math.cos(rad(startAngle));
      const y1 = 100 + rInner * Math.sin(rad(startAngle));
      const x2 = 100 + rOuter * Math.cos(rad(startAngle));
      const y2 = 100 + rOuter * Math.sin(rad(startAngle));
      const x3 = 100 + rOuter * Math.cos(rad(endAngle));
      const y3 = 100 + rOuter * Math.sin(rad(endAngle));
      const x4 = 100 + rInner * Math.cos(rad(endAngle));
      const y4 = 100 + rInner * Math.sin(rad(endAngle));

      const d = [
        `M ${x1} ${y1}`,
        `L ${x2} ${y2}`,
        `A ${rOuter} ${rOuter} 0 0 1 ${x3} ${y3}`,
        `L ${x4} ${y4}`,
        `A ${rInner} ${rInner} 0 0 0 ${x1} ${y1}`,
        "Z"
      ].join(" ");

      path.setAttribute("d", d);
      path.setAttribute("class", "dpad-button");
      path.addEventListener("click", () => {
        hass.callService("trackpad_mouse", "move", { direction: label });
      });

      svg.appendChild(path);
    });

    // Center button
    const center = document.createElementNS(svgNS, "circle");
    center.setAttribute("cx", "100");
    center.setAttribute("cy", "100");
    center.setAttribute("r", "38");
    center.setAttribute("class", "center-button");
    center.addEventListener("click", () => {
      hass.callService("trackpad_mouse", "move", { direction: "⦿" });
    });

    svg.appendChild(center);
    dpadContainer.appendChild(svg);
    container.appendChild(dpadContainer);

    // Foldable buttons
    const foldableButtons = document.createElement("div");
    foldableButtons.className = "foldable-buttons";

    const leftButton = document.createElement("button");
    leftButton.className = "foldable-button";
    leftButton.textContent = "Trackpad";

    const rightButton = document.createElement("button");
    rightButton.className = "foldable-button";
    rightButton.textContent = "Keyboard";

    foldableButtons.appendChild(leftButton);
    foldableButtons.appendChild(rightButton);
    container.appendChild(foldableButtons);

    // Panels
    const trackpadPanel = document.createElement("div");
    trackpadPanel.className = "panel";

    const keyboardPanel = document.createElement("div");
    keyboardPanel.className = "panel";

    const keyboardCard = document.createElement("android-keyboard-card");
    keyboardCard.hass = hass;
    keyboardPanel.appendChild(keyboardCard);

    const trackpadCard = document.createElement("trackpad-card");
    trackpadCard.hass = hass;
    trackpadPanel.appendChild(trackpadCard);

    container.appendChild(trackpadPanel);
    container.appendChild(keyboardPanel);

    // Toggle panel logic
    leftButton.addEventListener("click", () => {
      const isVisible = trackpadPanel.classList.contains("active");
      trackpadPanel.classList.toggle("active", !isVisible);
      keyboardPanel.classList.remove("active");
      leftButton.classList.toggle("active", !isVisible);
      rightButton.classList.remove("active");
    });

    rightButton.addEventListener("click", () => {
      const isVisible = keyboardPanel.classList.contains("active");
      keyboardPanel.classList.toggle("active", !isVisible);
      trackpadPanel.classList.remove("active");
      rightButton.classList.toggle("active", !isVisible);
      leftButton.classList.remove("active");
    });

    card.appendChild(container);
    this.shadowRoot.appendChild(card);
    this.content = container;
  }

  setConfig(config) {}
  getCardSize() {
    return 5;
  }
}

customElements.define("android-remote-card", AndroidRemoteCard);
