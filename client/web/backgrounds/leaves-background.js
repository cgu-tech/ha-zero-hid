//import './leaves.js';
//
//const card = document.createElement("ha-card");
//card.style.position = "relative";
//
//const background = document.createElement("falling-leaves-background");
//card.appendChild(background);
//
//const content = document.createElement("div");
//content.style.position = "relative";
//content.style.zIndex = "1";
//content.innerHTML = "My Card Here";
//card.appendChild(content);
//
//this._elements.root = card;


export class FallingLeavesBackground extends HTMLElement {
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

      .leaf {
        will-change: transform;
      }
    `;

    const width = this.offsetWidth;
    const height = this.offsetHeight;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    shadow.appendChild(style);
    shadow.appendChild(svg);

    this.svg = svg;
    this.createLeaves(width, height);
  }

  createLeaves(width, height) {
    const NUM_LEAVES = 30;
    const screenWidth = width;
    const screenHeight = height;
    const colors = ['#D2691E', '#A0522D', '#FF8C00', '#CD853F', '#8B4513'];

    const rand = (min, max) => Math.random() * (max - min) + min;

    const createLeaf = () => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.classList.add("leaf");

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

      path.setAttribute("d", "M0,0 Q-5,10 0,20 Q5,10 0,0 Z"); // Simple stylized leaf
      path.setAttribute("fill", colors[Math.floor(Math.random() * colors.length)]);
      path.setAttribute("opacity", rand(0.7, 1));
      path.setAttribute("transform", `scale(${rand(0.6, 1.4)})`);

      g.appendChild(path);
      this.svg.appendChild(g);
      return g;
    };

    const animateLeaf = (leaf) => {
      const startX = rand(0, screenWidth);
      const driftX = rand(-80, 80);
      const duration = rand(10000, 20000);
      const rotateStart = rand(0, 360);
      const rotateEnd = rotateStart + rand(90, 360);

      leaf.setAttribute("transform", `translate(${startX}, -20)`);

      const animation = leaf.animate([
        {
          transform: `
            translate(${startX}px, -20px)
            rotate(${rotateStart}deg)
          `
        },
        {
          transform: `
            translate(${startX + driftX}px, ${screenHeight + 40}px)
            rotate(${rotateEnd}deg)
          `
        }
      ], {
        duration,
        easing: "ease-in-out"
      });

      animation.onfinish = () => {
        animation.cancel();
        animateLeaf(leaf);
      };
    };

    for (let i = 0; i < NUM_LEAVES; i++) {
      const leaf = createLeaf();
      setTimeout(() => animateLeaf(leaf), rand(0, 7000));
    }
  }
}

customElements.define('falling-leaves-background', FallingLeavesBackground);
