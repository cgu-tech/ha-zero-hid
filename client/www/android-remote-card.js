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
        aspect-ratio: 4 / 3;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        background: #2e2e2e;
        border-bottom: 1px solid #111;
      }

      .dpad {
        display: grid;
        grid-template-columns: 60px 60px 60px;
        grid-template-rows: 60px 60px 60px;
        gap: 8px;
      }

      .dpad button {
        background: #3a3a3a;
        border: none;
        color: #eee;
        font-size: 16px;
        cursor: pointer;
        border-radius: 6px;
        transition: background 0.2s;
      }

      .dpad button:hover {
        background: #4a4a4a;
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
      }

      .foldable-button:hover {
        background: #444;
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

    // D-Pad Section
    const dpadContainer = document.createElement("div");
    dpadContainer.className = "dpad-container";

    const dpad = document.createElement("div");
    dpad.className = "dpad";

    const directions = [
      "", "↑", "",
      "←", "⦿", "→",
      "", "↓", ""
    ];

    directions.forEach(dir => {
      const btn = document.createElement("button");
      btn.textContent = dir;
      if (dir) {
        btn.addEventListener("click", () => {
          hass.callService("trackpad_mouse", "move", { direction: dir });
        });
      } else {
        btn.style.visibility = "hidden";
      }
      dpad.appendChild(btn);
    });

    dpadContainer.appendChild(dpad);
    container.appendChild(dpadContainer);

    // Foldable Buttons
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

    // Inject previously defined components
    const trackpadCard = document.createElement("trackpad-card");
    trackpadCard.hass = hass;
    trackpadPanel.appendChild(trackpadCard);

    const keyboardInput = document.createElement("input");
    keyboardInput.type = "text";
    keyboardInput.style.width = "100%";
    keyboardInput.style.padding = "10px";
    keyboardInput.style.fontSize = "16px";
    keyboardInput.style.border = "none";
    keyboardInput.style.boxSizing = "border-box";
    keyboardInput.addEventListener("change", () => {
      hass.callService("trackpad_mouse", "keyboard_input", {
        text: keyboardInput.value
      });
      keyboardInput.value = "";
    });
    keyboardPanel.appendChild(keyboardInput);

    container.appendChild(trackpadPanel);
    container.appendChild(keyboardPanel);

    leftButton.addEventListener("click", () => {
      const isVisible = trackpadPanel.classList.contains("active");
      trackpadPanel.classList.toggle("active", !isVisible);
      keyboardPanel.classList.remove("active");
    });

    rightButton.addEventListener("click", () => {
      const isVisible = keyboardPanel.classList.contains("active");
      keyboardPanel.classList.toggle("active", !isVisible);
      trackpadPanel.classList.remove("active");
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
