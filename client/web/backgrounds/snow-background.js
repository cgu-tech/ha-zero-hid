//import './snow.js';
//
//const card = document.createElement("ha-card");
//card.style.position = "relative";
//
//const background = document.createElement("snow-background");
//card.appendChild(background);
//
//// Then append to main content above it
//const content = document.createElement("div");
//content.style.position = "relative";
//content.style.zIndex = "1"; // ensure content is above flakes
//content.innerHTML = "My Card Here";
//card.appendChild(content);
//
//this._elements.root = card;

class SnowBackground extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const shadow = this.shadowRoot;

    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        display: block;
        overflow: hidden;
      }

      svg {
        width: 100%;
        height: 100%;
        display: block;
        will-change: transform;
      }

      circle {
        will-change: transform;
      }
    `;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    shadow.appendChild(style);
    shadow.appendChild(svg);

    this.svg = svg;
    this.createFlakes();
  }

  createFlakes() {
    const NUM_FLAKES = 50;
    const MAX_DRIFT = 40;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const rand = (min, max) => Math.random() * (max - min) + min;

    const createSnowflake = () => {
      const flake = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      flake.setAttribute("r", rand(1.2, 3.2));
      flake.setAttribute("fill", "#fff");
      flake.setAttribute("opacity", rand(0.4, 0.9));
      this.svg.appendChild(flake);
      return flake;
    };

    const animateSnowflake = (flake) => {
      const startX = rand(0, screenWidth);
      const driftX = rand(-MAX_DRIFT, MAX_DRIFT);
      const duration = rand(8000, 16000);

      flake.setAttribute("transform", `translate(${startX}, -10)`);

      const animation = flake.animate([
        { transform: `translate(${startX}px, -10px)` },
        { transform: `translate(${startX + driftX}px, ${screenHeight + 20}px)` }
      ], {
        duration,
        easing: "linear"
      });

      animation.onfinish = () => {
        animation.cancel();
        animateSnowflake(flake);
      };
    };

    for (let i = 0; i < NUM_FLAKES; i++) {
      const flake = createSnowflake();
      setTimeout(() => animateSnowflake(flake), rand(0, 5000));
    }
  }
}

customElements.define('snow-background', SnowBackground);
