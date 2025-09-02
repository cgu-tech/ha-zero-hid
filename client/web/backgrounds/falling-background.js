export class FallingBackground extends HTMLElement {

  _maxFallings = 30;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._resizeObserver = null;
    this._fallings = [];
    this._animations = [];
    this._configChangeRequested = false;
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

      .falling {
        will-change: transform;
      }
    `;

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    shadow.appendChild(style);
    shadow.appendChild(svg);
    this._svg = svg;

    // Observe size changes
    this._resizeObserver = new ResizeObserver(() => this.onResize());
    this._resizeObserver.observe(this);
    
    // Wait for layout before creating fallings
    requestAnimationFrame(() => {
      const width = this.offsetWidth;
      const height = this.offsetHeight;
      if (width && height) {
        this._svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this._screenWidth = width;
        this._screenHeight = height;
        this.createFallings(); // Call it once here
      }
    });
  }

  disconnectedCallback() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }

  /**
   * Call this to change config and restart fallings
   */
  async changeConfig() {
    // Prevent new animations from looping
    this._configChangeRequested = true;

    // Wait for all animations to finish naturally
    await Promise.allSettled(this._animations.map(anim => anim.finished));

    // Remove old elements
    for (const falling of this._fallings) {
      falling.remove();
    }

    this._fallings = [];
    this._animations = [];
    this._configChangeRequested = false;

    // Start again
    this.createFallings();
  }

  onResize() {
    const width = this.offsetWidth;
    const height = this.offsetHeight;

    if (width === 0 || height === 0) return;

    // Update SVG viewBox
    this._svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Optionally store new dimensions for future animations
    this._screenWidth = width;
    this._screenHeight = height;
  }

  createFallings() {
    for (let i = 0; i < this._maxFallings; i++) {
      const falling = this.createFalling();
      this.addFalling(falling);
      setTimeout(() => this.animateFalling(falling), this.getBoundRandom(0, 7000));
    }
  }

  getBoundRandom(min, max) {
    return Math.random() * (max - min) + min;
  }

  createFalling() {
    const colors = ['#D2691E', '#A0522D', '#FF8C00', '#CD853F', '#8B4513'];

    const falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
    falling.classList.add("falling");
    falling.style.visibility = 'hidden';

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M0,0 Q-5,10 0,20 Q5,10 0,0 Z");
    path.setAttribute("fill", colors[Math.floor(Math.random() * colors.length)]);
    path.setAttribute("opacity", this.getBoundRandom(0.6, 1));
    path.setAttribute("transform", `scale(${this.getBoundRandom(1.2, 2.8)})`);

    falling.appendChild(path);
    return falling;
  }
  
  addFalling(falling) {
    this._svg.appendChild(falling);
    this._fallings.push(falling);
  }

  animateFalling(falling) {
    const screenWidth = this._screenWidth || this.offsetWidth;
    const screenHeight = this._screenHeight || this.offsetHeight;
    if (!screenWidth || !screenHeight) return;

    const startX = this.getBoundRandom(0, screenWidth);
    const driftX = this.getBoundRandom(-80, 80);
    const duration = this.getBoundRandom(10000, 20000);
    const rotateStart = this.getBoundRandom(0, 360);
    const rotateEnd = rotateStart + this.getBoundRandom(90, 360);

    falling.setAttribute("transform", `translate(${startX}, -60)`);

    const animation = falling.animate([
      {
        transform: `translate(${startX}px, -60px) rotate(${rotateStart}deg)`
      },
      {
        transform: `translate(${startX + driftX}px, ${screenHeight + 60}px) rotate(${rotateEnd}deg)`
      }
    ], {
      duration,
      easing: "ease-in-out"
    });
    this._animations.push(animation);

    animation.ready.then(this.onAnimationReady.bind(this, falling));  
    animation.addEventListener('finish', this.onAnimationFinish.bind(this, falling));
  }

  onAnimationReady(falling) {
    falling.style.visibility = 'visible';
  }

  onAnimationFinish(falling, evt) {
    const animation = evt.target;
    animation.cancel();
    this._animations = this._animations.filter(a => a !== animation);
    if (!this._configChangeRequested) {
      this.animateFalling(falling); // loop only if config change not requested
    }
  }

}

customElements.define('falling-background', FallingBackground);
