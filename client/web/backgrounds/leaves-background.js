export class FallingLeavesBackground extends HTMLElement {

  const _NUM_LEAVES = 30;
  const _colors = ['#D2691E', '#A0522D', '#FF8C00', '#CD853F', '#8B4513'];

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
    for (let i = 0; i < this._NUM_LEAVES; i++) {
      const leaf = this.createLeaf();
      setTimeout(() => this.animateLeaf(leaf), this.rand(0, 7000));
    }
  }
  
  rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  
  createLeaf() {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("leaf");
    g.style.visibility = 'hidden'; // Hide until animation begins

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // Bigger stylized leaf
    path.setAttribute("d", "M0,0 Q-5,10 0,20 Q5,10 0,0 Z");
    path.setAttribute("fill", this._colors[Math.floor(Math.random() * this._colors.length)]);
    path.setAttribute("opacity", this.rand(0.6, 1));

    const scale = this.rand(1.2, 2.8);
    path.setAttribute("transform", `scale(${scale})`);

    g.appendChild(path);
    this.svg.appendChild(g);
    this._leaves.push(g);
    return g;
  }
  
  animateLeaf(leaf) => {
    const startX = this.rand(0, screenWidth);
    const driftX = this.rand(-80, 80);
    const duration = this.rand(10000, 20000);
    const rotateStart = this.rand(0, 360);
    const rotateEnd = rotateStart + this.rand(90, 360);

    leaf.setAttribute("transform", `translate(${startX}, -60)`);

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
    animation.ready.then(() => {
      leaf.style.visibility = 'visible';
    });

    animation.onfinish = () => {
      animation.cancel();
      animateLeaf(leaf); // loop
    };
  }
  
}

customElements.define('falling-leaves-background', FallingLeavesBackground);
