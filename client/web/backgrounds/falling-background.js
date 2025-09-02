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
    return this.createFallingLeave();
  }

  createFallingLeave() {
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

  createFallingHalloween() {
    const falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
    falling.classList.add("falling");
    falling.style.visibility = 'hidden'; // Hide until animation begins
    
    const typeRoll = Math.random(); // Random selector
    let fallingContent;
    if (typeRoll < 0.25) {
      // 🎃 Pumpkin (simple circle with a stem)
      fallingContent = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const pumpkin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pumpkin.setAttribute("r", "8");
      pumpkin.setAttribute("cx", "0");
      pumpkin.setAttribute("cy", "0");
      pumpkin.setAttribute("fill", "#FF7518");
      pumpkin.setAttribute("stroke", "#A0522D");
      pumpkin.setAttribute("stroke-width", "1");
    
      const stem = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      stem.setAttribute("x", "-1");
      stem.setAttribute("y", "-10");
      stem.setAttribute("width", "2");
      stem.setAttribute("height", "4");
      stem.setAttribute("fill", "#654321");
    
      fallingContent.appendChild(pumpkin);
      fallingContent.appendChild(stem);
    } else if (typeRoll < 0.5) {
      // 👻 Ghost (stylized path)
      fallingContent = document.createElementNS("http://www.w3.org/2000/svg", "path");
      fallingContent.setAttribute("d", "M0,-10 Q5,-20 10,-10 Q15,-5 10,0 Q5,5 0,0 Q-5,-5 -10,0 Q-15,-5 -10,-10 Q-5,-20 0,-10 Z");
      fallingContent.setAttribute("fill", "#eeeeee");
      fallingContent.setAttribute("stroke", "#999");
      fallingContent.setAttribute("stroke-width", "0.5");
      fallingContent.setAttribute("opacity", this.getBoundRandom(0.7, 1));
    } else if (typeRoll < 0.75) {
      // 🕷️ Spider (circle with 8 legs)
      fallingContent = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
      const body = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      body.setAttribute("r", "5");
      body.setAttribute("cx", "0");
      body.setAttribute("cy", "0");
      body.setAttribute("fill", "black");
    
      const createLeg = (x1, y1, x2, y2) => {
        const leg = document.createElementNS("http://www.w3.org/2000/svg", "line");
        leg.setAttribute("x1", x1);
        leg.setAttribute("y1", y1);
        leg.setAttribute("x2", x2);
        leg.setAttribute("y2", y2);
        leg.setAttribute("stroke", "black");
        leg.setAttribute("stroke-width", "1");
        return leg;
      };
    
      fallingContent.appendChild(body);
      // Add 8 legs
      fallingContent.appendChild(createLeg(-5, 0, -10, -5));
      fallingContent.appendChild(createLeg(-5, 0, -10, 5));
      fallingContent.appendChild(createLeg(5, 0, 10, -5));
      fallingContent.appendChild(createLeg(5, 0, 10, 5));
      fallingContent.appendChild(createLeg(-4, -3, -9, -8));
      fallingContent.appendChild(createLeg(-4, 3, -9, 8));
      fallingContent.appendChild(createLeg(4, -3, 9, -8));
      fallingContent.appendChild(createLeg(4, 3, 9, 8));
    } else {
      // 🕸️ Spider web (simple web shape)
      fallingContent = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", "8");
      circle.setAttribute("cx", "0");
      circle.setAttribute("cy", "0");
      circle.setAttribute("stroke", "#ccc");
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke-width", "0.5");
    
      const lines = [
        [-8, 0, 8, 0],
        [0, -8, 0, 8],
        [-6, -6, 6, 6],
        [-6, 6, 6, -6],
      ];
    
      fallingContent.appendChild(circle);
      for (const [x1, y1, x2, y2] of lines) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", "#ccc");
        line.setAttribute("stroke-width", "0.5");
        fallingContent.appendChild(line);
      }
    }
    
    // Random scale + opacity (applies to whole group)
    const scale = this.getBoundRandom(1.2, 2.8);
    fallingContent.setAttribute("transform", `scale(${scale})`);
    falling.appendChild(fallingContent);
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
