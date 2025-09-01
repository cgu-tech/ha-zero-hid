export class FallingLeavesBackground extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._resizeObserver = null;
    this._leaves = [];
  }

  connectedCallback() {
    const shadow = this.shadowRoot;

    // Create styles
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

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    shadow.appendChild(style);
    shadow.appendChild(svg);

    this.svg = svg;

    // Observe size changes
    this._resizeObserver = new ResizeObserver(() => {
      this._onResize();
    });
    this._resizeObserver.observe(this);
  }

  disconnectedCallback() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }

  _onResize() {
    const width = this.offsetWidth;
    const height = this.offsetHeight;

    if (width === 0 || height === 0) return;

    // Update SVG viewBox
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Remove existing leaves if any
    for (const leaf of this._leaves) {
      leaf.remove();
    }
    this._leaves = [];

    // Recreate leaves
    this.createLeaves(width, height);
  }

  createLeaves(screenWidth, screenHeight) {
    const NUM_LEAVES = 30;
    const colors = ['#D2691E', '#A0522D', '#FF8C00', '#CD853F', '#8B4513'];
    const rand = (min, max) => Math.random() * (max - min) + min;

    const createLeaf = () => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.classList.add("leaf");

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

      // Bigger stylized leaf
      path.setAttribute("d", "M0,0 Q-5,10 0,20 Q5,10 0,0 Z");
      path.setAttribute("fill", colors[Math.floor(Math.random() * colors.length)]);
      path.setAttribute("opacity", rand(0.6, 1));

      const scale = rand(1.2, 2.8);
      path.setAttribute("transform", `scale(${scale})`);

      g.appendChild(path);
      this.svg.appendChild(g);
      this._leaves.push(g);
      return g;
    };

    const animateLeaf = (leaf) => {
      const startX = rand(0, screenWidth);
      const driftX = rand(-80, 80);
      const duration = rand(10000, 20000);
      const rotateStart = rand(0, 360);
      const rotateEnd = rotateStart + rand(90, 360);

      leaf.setAttribute("transform", `translate(${startX}, -60)`);
      leaf.style.visibility = 'hidden'; // Hide until animation begins

      const animation = leaf.animate([
        {
          transform: `
            translate(${startX}px, -60px)
            rotate(${rotateStart}deg)
          `
        },
        {
          transform: `
            translate(${startX + driftX}px, ${screenHeight + 60}px)
            rotate(${rotateEnd}deg)
          `
        }
      ], {
        duration,
        easing: "ease-in-out"
      });

      // Show the leaf once animation actually starts
      animation.onready = () => {
        leaf.style.visibility = 'visible';
      };

      animation.onfinish = () => {
        animation.cancel();
        animateLeaf(leaf); // loop
      };
    };

    for (let i = 0; i < NUM_LEAVES; i++) {
      const leaf = createLeaf();
      setTimeout(() => animateLeaf(leaf), rand(0, 7000));
    }
  }
}

customElements.define('falling-leaves-background', FallingLeavesBackground);
