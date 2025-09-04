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
    return this.createFallingSpider();
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

  createFallingSpiderWeb() {  
    // Outer <g> that gets returned
    const falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
    falling.classList.add("falling");
    falling.style.visibility = 'hidden';
  
    // Inner <g> that contains the web and gets scaled
    const webGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    webGroup.setAttribute("fill", "transparent");
    webGroup.setAttribute("stroke", "#6B6C6E");
    webGroup.setAttribute("stroke-width", "1");
    webGroup.setAttribute("stroke-linejoin", "round");
  
    webGroup.setAttribute("opacity", this.getBoundRandom(0.6, 1));
    webGroup.setAttribute("transform", `scale(${this.getBoundRandom(1.2, 2.8)})`);
  
    const paths = [
      // Axes
      "M0,13.5 L31.65,13.5",
      "M7.4,0.05 L24.25,26.95",
      "M7.5,27 L24.15,0",
  
      // Web rings
      "M9,24.95 L2.15,13.5 L9,2.05 L22.65,2.05 L29.5,13.5 L22.65,24.95 L9,24.95 Z",
      "M10.8,22 L5.8,13.5 L10.8,5 L20.8,5 L25.8,13.5 L20.8,22 L10.8,22 Z",
      "M12.8,18.5 L9.8,13.5 L12.8,8.5 L18.8,8.5 L21.8,13.5 L18.8,18.5 L12.8,18.5 Z"
    ];
  
    paths.forEach(d => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      webGroup.appendChild(path);
    });
  
    falling.appendChild(webGroup);
    return falling;
  }

  createFallingSpider() { 
    // Create the <g> wrapper for the spider
    const falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
    falling.classList.add("falling"); // Optional: for animation or styling
    falling.style.visibility = "hidden"; // Optional: show later via animation

    // Create the spider path
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M29,15c-1,0-2-0.4-2.7-1.1l-0.6-0.6c-0.3-0.3-0.8-0.4-1.2-0.2l-2.6,1.3l1.9-2.9
      c0.1-0.1,0.1-0.3,0.2-0.4L24.5,8c0.3-1.6,1-3.1,2.2-4.2c0.4-0.4,0.4-1,0-1.4s-1-0.4-1.4,0c-1.5,1.5-2.4,3.3-2.7,5.3l-0.5,3
      l-0.2,0.3C21.1,7.4,18,5.5,16.3,5C16.1,5,15.9,5,15.7,5c-1.7,0.5-4.8,2.3-5.6,5.9L10,10.6l-0.5-3c-0.3-2-1.3-3.9-2.7-5.3
      c-0.4-0.4-1-0.4-1.4,0s-0.4,1,0,1.4C6.5,4.9,7.2,6.3,7.5,8L8,11.2c0,0.1,0.1,0.3,0.2,0.4l1.9,2.9l-2.6-1.3c-0.4-0.2-0.8-0.1-1.2,0.2
      l-0.6,0.6C5,14.6,4,15,3,15c-0.6,0-1,0.4-1,1s0.4,1,1,1c1.5,0,3-0.6,4.1-1.7l0.1-0.1l2.7,1.4L7.8,17c-0.3,0.1-0.6,0.3-0.7,0.5
      l-1.3,2.6c-0.4,0.7-1,1.3-1.7,1.7l-0.6,0.3c-0.5,0.2-0.7,0.8-0.4,1.3C3.3,23.8,3.6,24,4,24c0.2,0,0.3,0,0.4-0.1L5,23.6
      c1.1-0.6,2-1.5,2.6-2.6l1.1-2.1l1.3-0.3l-0.7,0.7c-0.1,0.1-0.2,0.3-0.3,0.4l-1.4,4.9c-0.3,1.1-1.1,2-2.1,2.5
      c-0.5,0.2-0.7,0.8-0.4,1.3C5.3,28.8,5.6,29,6,29c0.2,0,0.3,0,0.4-0.1c1.5-0.8,2.7-2.1,3.1-3.8l1.3-4.6l1.3-1.3
      c0,1.2,0.6,2.2,1.5,2.9C13.2,22.7,13,23.3,13,24c0,0.6,0.4,1,1,1s1-0.4,1-1c0-0.6,0.4-1,1-1s1,0.4,1,1c0,0.6,0.4,1,1,1s1-0.4,1-1
      c0-0.7-0.2-1.3-0.6-1.8c0.9-0.7,1.4-1.7,1.5-2.9l1.3,1.3l1.3,4.6c0.5,1.6,1.6,3,3.1,3.8C25.7,29,25.8,29,26,29
      c0.4,0,0.7-0.2,0.9-0.6c0.2-0.5,0-1.1-0.4-1.3c-1-0.5-1.8-1.4-2.1-2.5L23,19.7c0-0.2-0.1-0.3-0.3-0.4L22,18.6l1.3,0.3l1.1,2.1
      c0.6,1.1,1.5,2,2.6,2.6l0.6,0.3C27.7,24,27.8,24,28,24c0.4,0,0.7-0.2,0.9-0.6c0.2-0.5,0-1.1-0.4-1.3l-0.6-0.3
      c-0.7-0.4-1.3-1-1.7-1.7l-1.3-2.6c-0.1-0.3-0.4-0.5-0.7-0.5l-2.1-0.4l2.7-1.4l0.1,0.1C26,16.4,27.5,17,29,17c0.6,0,1-0.4,1-1
      S29.6,15,29,15z`);

    path.setAttribute("fill", "#000"); // Or any other color you want
    path.setAttribute("transform", `scale(${this.getBoundRandom(1.0, 2.4)})`);
    path.setAttribute("opacity", this.getBoundRandom(0.6, 1));

    // Append the path to the <g>
    falling.appendChild(path);
    return falling;
  }


  createFallingHalloween() {
    let falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
    //falling.setAttribute("transform", `scale(${this.getBoundRandom(1.0, 1.0)})`);

    const typeRoll = Math.random(); // Random selector
    if (typeRoll < 0.25) {
      // 🎃 Pumpkin (simple circle with a stem)
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

      falling.appendChild(pumpkin);
      falling.appendChild(stem);
    } else if (typeRoll < 0.5) {
      // 👻 Ghost (stylized path)
      const ghost = document.createElementNS("http://www.w3.org/2000/svg", "path");
      ghost.setAttribute("d", "M0,-10 Q5,-20 10,-10 Q15,-5 10,0 Q5,5 0,0 Q-5,-5 -10,0 Q-15,-5 -10,-10 Q-5,-20 0,-10 Z");
      ghost.setAttribute("fill", "#eeeeee");
      ghost.setAttribute("stroke", "#999");
      ghost.setAttribute("stroke-width", "0.5");
      ghost.setAttribute("opacity", this.getBoundRandom(0.7, 1));

      falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
      falling.appendChild(ghost);
    } else if (typeRoll < 0.75) {
      // 🕷️ Spider (circle with 8 legs)
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

      falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
      falling.appendChild(body);

      // Add 8 legs
      falling.appendChild(createLeg(-5, 0, -10, -5));
      falling.appendChild(createLeg(-5, 0, -10, 5));
      falling.appendChild(createLeg(5, 0, 10, -5));
      falling.appendChild(createLeg(5, 0, 10, 5));
      falling.appendChild(createLeg(-4, -3, -9, -8));
      falling.appendChild(createLeg(-4, 3, -9, 8));
      falling.appendChild(createLeg(4, -3, 9, -8));
      falling.appendChild(createLeg(4, 3, 9, 8));
    } else {
      // Spider web
      falling = this.createFallingSpiderWeb();
    }

    // Random scale (applies to whole group)
    falling.classList.add("falling");
    falling.style.visibility = 'hidden'; // Hide until animation begins
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
