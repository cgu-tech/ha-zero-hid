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
    return this.createFallingWitchHat();
  }

  setRandomOpacity(elt, min, max) {
    elt.setAttribute("opacity", this.getBoundRandom(min, max));
  }

  setRandomScale(elt, min, max) {
    elt.setAttribute("transform", `scale(${this.getBoundRandom(min, max)})`);
  }

  setRandomFill(elt, colors) {
    elt.setAttribute("fill", colors[Math.floor(Math.random() * colors.length)]);
  }

  createFallingLeave() {
    const falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
    falling.classList.add("falling");
    falling.style.visibility = 'hidden';

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M0,0 Q-5,10 0,20 Q5,10 0,0 Z");
    this.setRandomFill(path, ['#D2691E', '#A0522D', '#FF8C00', '#CD853F', '#8B4513']);
    this.setRandomOpacity(path, 0.6, 1);
    this.setRandomScale(path, 1.2, 2.8);

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

    this.setRandomOpacity(webGroup, 0.6, 1);
    this.setRandomScale(webGroup, 1.2, 2.8);

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

    this.setRandomFill(path, ['#000000']);
    this.setRandomOpacity(path, 0.6, 1);
    this.setRandomScale(path, 0.8, 1.8);

    // Append the path to the <g>
    falling.appendChild(path);
    return falling;
  }

  createFallingPumkin() { 
    // Create the <g> wrapper for the spider
    const falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
    falling.classList.add("falling"); // Optional: for animation or styling
    falling.style.visibility = "hidden"; // Optional: show later via animation

    // Create the spider path
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", 
     `M25.6,0C11.4614,0,0,11.4606,0,25.6c0,14.1385,11.4614,25.6,25.6,25.6
      c14.1385,0,25.6-11.4615,25.6-25.6C51.2,11.4606,39.7385,0,25.6,0z 
      M34.082,14.7722l4.1069,5.7534l-7.574,1.8965L34.082,14.7722z 
      M25.6149,22.8399l2.4218,2.6718c0,0-2.1562,0.6808-4.8734-0.0394L25.6149,22.8399z 
      M15.9931,15.0326l3.6855,7.5478l-7.6246-1.679L15.9931,15.0326z 
      M32.1366,38.0412c-0.1206,0.0472-0.2019,0.1407-0.3112,0.2071l-0.117,1.484
      c-0.0097,0.1198-0.0726,0.229-0.1731,0.3041c-0.1014,0.0761-0.2307,0.1102-0.361,0.0962
      l-2.0679,0.2413c-0.2517,0.0297-0.4344,0.2342-0.416,0.4658l0.187,2.2479
      c-1.8144,0.3697-3.8998,0.4064-5.8462,0.146c-0.1363-0.9203-0.221-2.2462-0.221-2.2462
      c-0.0297-0.2133-0.2256-0.374-0.4598-0.3776l-2.0714-0.0402c-0.1372-0.0035-0.2683,0.0473-0.3609,0.1399
      c-0.0926,0.0944-0.1381,0.2176-0.1232,0.3426l-0.0882,1.3722c-0.6171-0.2342-1.179-0.4807-1.6553-0.8207
      c-3.8473-2.7452-5.9842-6.8048-5.9152-11.7735c1.0331,1.3267,3.9382,2.2968,6.18,2.9366
      l0.035,2.4052c0.0026,0.2342,0.1904,0.4282,0.4457,0.4492l2.2881,0.1932
      c0.1373,0.0106,0.2736-0.0305,0.3776-0.1127c0.1031-0.0848,0.1643-0.2028,0.1687-0.3304
      l0.0699-1.8904c1.3774,0.1958,2.7137,0.2824,3.856,0.2648c1.1266-0.0149,2.3624-0.118,3.6253-0.326
      l0.1163,1.8397c0.0087,0.1276,0.0717,0.2448,0.1765,0.3252c0.1058,0.0804,0.2404,0.1188,0.3785,0.1031
      l2.2706-0.2586c0.2526-0.028,0.4266-0.2272,0.4239-0.4614l-0.0341-2.3615
      c2.2218-0.6826,4.9215-1.6982,6.3382-3.1359C39.1984,31.0301,36.4217,36.3702,32.1366,38.0412z`);

    this.setRandomFill(path, ['#BF6C00', '#BF5300', '#D68120']);
    this.setRandomOpacity(path, 0.6, 1);
    this.setRandomScale(path, 0.8, 1.8);

    // Append the path to the <g>
    falling.appendChild(path);
    return falling;
  }

  createFallingGhost() { 
    // Create the <g> wrapper for the spider
    const falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
    falling.classList.add("falling"); // Optional: for animation or styling
    falling.style.visibility = "hidden"; // Optional: show later via animation

    // Create the spider path
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", 
     `M25.0777,10.972c-0.2919-0.2741-0.7139-0.3591-1.0894-0.2189l-2.2505,0.8397
      c0.0035-0.0117,0.007-0.0236,0.0105-0.035c0.3529-0.769,0.5513-1.6235,0.5513-2.5249
      c0-3.3457-2.7125-6.0582-6.0582-6.0582c-2.5498,0-4.6583,1.8848-5.4774,3.4983
      c-0.1704,0.3358-1.0145,1.0626-1.9558,0.4678c-0.9415-0.5943-1.5618-1.6671-2.2299-2.7257
      c-0.8922-1.4123-2.5529-0.9768-3.122,0.4461C2.118,8.006, -1.9086,10.1331,1.0775,10.3846
      c1.7839,0.1506,3.0475-0.8176,3.5677-1.1891c0.5206-0.3716-0.1487,1.3382,0.8922,1.561
      c1.0066,0.2155,1.1231-1.0471,2.0533,0.2927c-1.2264,2.0067-3.2704,3.2704-5.2961,4.6388
      c-2.0945,1.4151-2.5285,2.8061,1.0218,2.195c1.5385-0.2651,1.6822,0.085,0.9787,0.474
      c-0.665,0.368-2.2645,1.0191-3.2641,1.3444c-0.9543,0.311-0.7132,1.8425,1.6422,1.6251
      c1.8316-0.1689,3.5359-0.2061,4.7611-0.6053c0.9993-0.3253,1.3459-0.0341,0.0078,0.5109
      c-2.9842,1.2159,0.6693,2.676,6.8668-0.639c2.3371-1.2501,3.9354-2.6364,5.1454-4.2941
      c0.2046,0.2395,0.5109,0.3688,0.9663,0.1317c1.1344-0.5905,1.6189,0.0249,0.8257,0.7182
      c-0.9305,0.8145-0.846,2.7459,1.7552,1.0719c2.6015-1.6744,2.5429-5.6459,2.5429-5.6459
      C25.7427,11.7022,25.3696,11.2451,25.0777,10.972z 
      M14.2316,7.9994c0,0,0.7225,1.4453,1.5657,1.9271
      C13.7498,11.1304,12.907,8.9629,14.2316,7.9994z 
      M17.4021,10.5546c0.9512-0.1949,2.4531-0.6689,2.4531-0.6689
      C20.3014,11.1122,18.6289,12.6731,17.4021,10.5546z`);

    this.setRandomFill(path, ['#FFFFFF', '#EBEBEB', '#DBDBDB']);
    this.setRandomOpacity(path, 0.6, 1);
    this.setRandomScale(path, 1.8, 3.2);

    // Append the path to the <g>
    falling.appendChild(path);
    return falling;
  }

  createFallingWitchHat() { 
    // Create the <g> wrapper for the spider
    const falling = document.createElementNS("http://www.w3.org/2000/svg", "g");
    falling.classList.add("falling"); // Optional: for animation or styling
    falling.style.visibility = "hidden"; // Optional: show later via animation

    // Create the spider path
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", 
     `M 25.591 17.3092 c -0.0398 -0.2946 -0.7459 -1.5796 -3.9114 -3.313 l -2.1568 -0.5967 l -1.9131 -5.6218 l 4.4091 -3.2786 c 1.4317 -0.8285 0.9044 
     -1.4697 -0.4142 -1.4693 c -7.9944 0.0026 -11.5318 -0.98 -13.19 3.994 c -0.409 1.2264 -1.1555 3.9551 -1.7735 6.2736 C -0.1055 15.1024 -0.1832 16.7448 
     0.0705 17.2187 l 1.182 2.209 l 4.7125 2.2558 l 2.2233 -2.1851 v 2.6378 c 0 0 4.4467 0.98 8.366 0.2261 c 3.9196 -0.7539 6.0297 -1.7334 6.0297 -1.7334 
     l -0.6033 -1.6583 l 1.8849 0.8289 l 1.4777 -1.675 C 25.5402 17.9014 25.6303 17.6038 25.591 17.3092 z M 6.8016 16.1764 c 0.1358 -0.9531 0.5721 -1.9432 
     0.7008 -2.8485 c 3.7045 0.5274 7.4653 0.5274 11.1697 0 c 0.129 0.9053 0.5653 1.8955 0.7013 2.8485 C 15.2037 16.77 10.9712 16.77 6.8016 16.1764 z`);

    this.setRandomFill(path, ['#617A2B', '#673470', '#0F0F0F']);
    this.setRandomOpacity(path, 0.6, 1);
    this.setRandomScale(path, 1.8, 3.2);

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
