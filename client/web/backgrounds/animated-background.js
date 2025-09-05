import { Globals } from '../utils/globals.js';
import { Logger } from '../utils/logger.js';
import { EventManager } from '../utils/event-manager.js';
import { ResourceManager } from '../utils/resource-manager.js';
import { LayoutManager } from '../utils/layout-manager.js';
import * as items from './items/index.js';

export class AnimatedBackground extends HTMLElement {

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;

  _maxFallings = 30;
  _resizeObserver;
  _configChangeRequested = false;
  _screenWidth;
  _screenHeight;

  constructor() {
    super();

    this._logger = new Logger(this, "animated-background.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, {});
    this._resourceManager = new ResourceManager(this, import.meta.url);

    this.doCard();
    this.doStyle();
    this.doAttach();
    this.doQueryElements();
    this.doListen();
  }

  getLogger() {
    return this._logger;
  }

  setConfig(config) {
    this._config = config;
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set setConfig(config):", config));
    if (this.getLogger().isDebugEnabled()) this.getLogger().doLogOnError(this.doSetConfig.bind(this)); else this.doSetConfig();
  }
  doSetConfig() {
    this.doCheckConfig();
    this.doUpdateConfig();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
  }

  connectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("connectedCallback()"));
    this.doUpdateLayout();
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  // jobs
  doCheckConfig() {
  }

  doCard() {
    // Create SVG background
    this._elements.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._elements.svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    this._elements.fallings = [];
    this._elements.animations = [];
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
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
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.svg);
  }

  doQueryElements() {
    // Nothing to do
  }

  doListen() {
    // Observe size changes
    this._resizeObserver = new ResizeObserver(this.onResize.bind(this));
    this._resizeObserver.observe(this);
  }

  doUpdateConfig() {
    this.doUpdateLayout();
  }

  onResize() {
    this.doResizeBackground();
  }

  doResizeBackground() {
    const width = this.offsetWidth;
    const height = this.offsetHeight;
    if (width && height) {

      // Update SVG viewBox
      this._elements.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

      // Store new dimensions for future animations
      this._screenWidth = width;
      this._screenHeight = height;
      return true;
    }
    return false;
  }

  doUpdateLayout() {
    const fallings = this._elements.fallings;
    const animations = this._elements.animations;
    
    // Lock to prevent new animations from looping
    this._configChangeRequested = true;

    // Finish all animations now
    animations.forEach(animation => animation.finish());

    // Remove old fallings from DOM
    for (const falling of fallings) {
      falling.remove();
    }

    // Reset fallings and animations arrays
    fallings.length = 0;
    animations.length = 0;

    // Unlock to allow new animations from looping
    this._configChangeRequested = false;

    // Wait for layout to be ready beofre creating new fallings
    requestAnimationFrame(this.doCreateFallings.bind(this));
  }

  doCreateFallings() {
    // Resize viewbox to parent container dimensions (whenever possible)
    if (this.doResizeBackground()) {
      // Create new fallings using current configuration
      this.createFallings();
    }
  }

  createFallings() {
    for (let i = 0; i < this._maxFallings; i++) {
      const falling = this.createFalling();
      this.addFalling(falling);
      setTimeout(() => this.animateFalling(falling), this.getBoundRandom(0, 7000));
    }
  }

  addFalling(falling) {
    this._elements.svg.appendChild(falling);
    this._elements.fallings.push(falling);
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
    this._elements.animations.push(animation);

    animation.ready.then(this.onFallingAnimationReady.bind(this, falling));  
    animation.addEventListener('finish', this.onFallingAnimationFinish.bind(this, falling));
  }

  onFallingAnimationReady(falling) {
    falling.style.visibility = 'visible';
  }

  onFallingAnimationFinish(falling, evt) {
    const animation = evt.target;
    animation.cancel();
    this._elements.animations = this._elements.animations.filter(a => a !== animation);
    if (!this._configChangeRequested) {
      this.animateFalling(falling); // loop only if config change not requested
    }
  }

  getBoundRandom(min, max) {
    return Math.random() * (max - min) + min;
  }

  getRandomColor(colors) {
    return colors[Math.floor(Math.random() * colors.length)];
  }

  capitalizeFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : null;
  }

  createItem(names, colors, opacities, scales) {
    return items[`create${names.map(name => this.capitalizeFirst(name)).join('')}`](this.getRandomColor(colors), this.getBoundRandom(opacities[0], opacities[1]), this.getBoundRandom(scales[0], scales[1]));
  }

  createFalling() {
    let falling;
    const typeRoll = Math.random();
    if (typeRoll < 0.1) {
      falling = this.createItem(["ghost"], ['#FFFFFF', '#EBEBEB', '#DBDBDB'], [0.6, 1], [1.8, 3.2]);
    } else if (typeRoll < 0.2) {
      falling = this.createItem(["spider"], ['#000000'], [0.6, 1], [0.8, 1.8]);
    } else if (typeRoll < 0.3) {
      falling = this.createItem(["web"], ['#000000'], [0.6, 1], [1.2, 2.8]);
    } else if (typeRoll < 0.4) {
      falling = this.createItem(["witch", "hat"], ['#617A2B', '#673470', '#0F0F0F'], [0.6, 1], [1.8, 3.2]);
    } else if (typeRoll < 0.5) {
      falling = this.createItem(["pumkin"], ['#BF6C00', '#BF5300', '#D68120'], [0.6, 1], [0.8, 1.8]);
    } else {
      falling = this.createItem(["leave"], ['#D2691E', '#A0522D', '#FF8C00', '#CD853F', '#8B4513'], [0.6, 1], [1.2, 2.8]);
    }
    falling.classList.add("falling");
    falling.style.visibility = "hidden";
    return falling;
  }

}

customElements.define('animated-background', AnimatedBackground);
