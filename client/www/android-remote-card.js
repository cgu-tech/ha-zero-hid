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
        position: relative;
        width: 180px;
        height: 180px;
      }
      
      .dpad button {
        position: absolute;
        width: 80px;
        height: 80px;
        background: #3a3a3a;
        border: none;
        color: #eee;
        font-size: 24px;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .dpad button:hover,
      .dpad button:focus {
        background: #4a4a4a;
      }
      
      /* Position & shape overrides */
      .dpad .top {
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        border-top-left-radius: 40px;
        border-top-right-radius: 40px;
      }
      
      .dpad .bottom {
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        border-bottom-left-radius: 40px;
        border-bottom-right-radius: 40px;
      }
      
      .dpad .left {
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        border-top-left-radius: 40px;
        border-bottom-left-radius: 40px;
      }
      
      .dpad .right {
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        border-top-right-radius: 40px;
        border-bottom-right-radius: 40px;
      }
      
      .dpad .center {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80px;
        height: 80px;
        border-radius: 50%;
      }
      
      /* Keep all other styles unchanged */
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

    const positionClasses = [
      "", "top", "",
      "left", "center", "right",
      "", "bottom", ""
    ];
    
    directions.forEach((dir, idx) => {
      const btn = document.createElement("button");
      btn.textContent = dir;
      btn.className = positionClasses[idx];
    
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
    const keyboardCard = document.createElement("android-keyboard-card");
    // keyboardCard.setConfig({
    //   language: this.language || "FR",
    //   layoutUrl: `/local/layouts/android/${this.language || "FR"}.json`
    // });
    keyboardCard.hass = hass;
    keyboardPanel.appendChild(keyboardCard);

    // Inject previously defined components
    const trackpadCard = document.createElement("trackpad-card");
    trackpadCard.hass = hass;
    trackpadPanel.appendChild(trackpadCard);

    container.appendChild(trackpadPanel);
    container.appendChild(keyboardPanel);

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
