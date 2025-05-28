class TrackpadCard extends HTMLElement {
  set hass(hass) {
    if (!this.content) {
      const card = document.createElement("ha-card");
      card.header = "Mouse Trackpad";

      this.content = document.createElement("div");
      this.content.style.height = "300px";
      this.content.style.background = "#eee";
      this.content.style.touchAction = "none";
      this.content.style.cursor = "crosshair";
      this.content.style.position = "relative";

      let lastX = null;
      let lastY = null;

      this.content.addEventListener("pointerdown", e => {
        lastX = e.clientX;
        lastY = e.clientY;
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

      card.appendChild(this.content);
      this.appendChild(card);
    }
  }

  setConfig(config) {}
  getCardSize() {
    return 3;
  }
}

customElements.define("trackpad-card", TrackpadCard);
