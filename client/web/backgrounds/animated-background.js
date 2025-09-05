import { Globals } from '../utils/globals.js';
import { Logger } from '../utils/logger.js';
import { EventManager } from '../utils/event-manager.js';
import { ResourceManager } from '../utils/resource-manager.js';
import { LayoutManager } from '../utils/layout-manager.js';
import { AnimatedGroup } from './animated-group.js';
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

  _resizeObserver;
  _configChangeRequested = false;
  _screenWidth;
  _screenHeight;
  _groups = [];

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
    this.doUpdateConfig();
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
    this._elements.groups = [];
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

      .animated {
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
    this.doResetLayout();
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

  doResetLayout() {
    
    // Lock to prevent new animations from looping
    this._configChangeRequested = true;

    // Reset groups
    this.doResetGroups();

    // Unlock to allow new animations from looping
    this._configChangeRequested = false;
  }

  doUpdateLayout() {
    const groups = this._elements.groups;
    
    // Wait for layout to be ready beofre creating new fallings
    requestAnimationFrame(this.doCreateAnimateds.bind(this));
  }

  doResetGroups() {
    for (const group of this._elements.groups) {
      this.doResetGroup(group);
    }
  }

  doResetGroup(group) {
    const animations = group.getAnimations();
    const items = group.getItems();

    // Finish all animations now
    animations.forEach(animation => animation.finish());

    // Remove old items from DOM
    for (const item of items) {
      item.remove();
    }

    // Reset items and animations arrays
    items.length = 0;
    animations.length = 0;
  }

  doCreateAnimateds() {

    // Resize viewbox to parent container dimensions (whenever possible)
    if (this.doResizeBackground()) {

      // Create new fallings using current configuration
      this.createAnimateds();
    }
  }

  createGhostsGroup() {
    return new AnimatedGroup(1, 'sliding', 
      {
        names: ["ghost"],
        colors: ['#FFFFFF', '#EBEBEB', '#DBDBDB'],
        opacities: [0.6, 1],
        scales: [2.6, 5.1]
      }
    );
  }

  createSpidersGroup() {
    return new AnimatedGroup(3, 'falling', 
      {
        names: ["spider"],
        colors: ['#000000'],
        opacities: [0.6, 1],
        scales: [0.8, 1.8]
      }
    );
  }

  createWebsGroup() {
    return new AnimatedGroup(2, 'falling', 
      {
        names: ["web"],
        colors: ['#636363'],
        opacities: [0.6, 1],
        scales: [1.2, 2.8]
      }
    );
  }

  createWitchHatsGroup() {
    return new AnimatedGroup(2, 'falling', 
      {
        names: ["witch", "hat"],
        colors: ['#617A2B', '#673470', '#0F0F0F'],
        opacities: [0.6, 1],
        scales: [1.8, 3.2]
      }
    );
  }

  createPumkinsGroup() {
    return new AnimatedGroup(1, 'falling', 
      {
        names: ["pumkin"],
        colors: ['#BF6C00', '#BF5300', '#D68120'],
        opacities: [0.6, 1],
        scales: [0.8, 1.8]
      }
    );
  }

  createLeaveGroup() {
    return new AnimatedGroup(20, 'falling', 
      {
        names: ["leave"],
        colors: ['#D2691E', '#A0522D', '#FF8C00', '#CD853F', '#8B4513'],
        opacities: [0.6, 1],
        scales: [1.2, 2.8]
      }
    );
  }

  createAnimateds() {
    //TODO: replace fake groups with real ones from config
    this._elements.groups.push(this.createGhostsGroup());
    this._elements.groups.push(this.createSpidersGroup());
    this._elements.groups.push(this.createWebsGroup());
    //this._elements.groups.push(this.createWitchHatsGroup());
    this._elements.groups.push(this.createPumkinsGroup());
    this._elements.groups.push(this.createLeaveGroup());

    for (const group of this._elements.groups) {
      this.doAnimateGroup(group);
    }
  }

  doAnimateGroup(group) {
    for (let i = 0; i < group.getMaxItems(); i++) {
      const item = this.createAnimated(group.getConfig());
      group.getItems().push(item);
      this._elements.svg.appendChild(item);
      setTimeout(() => this.animateItem(group, item), this.getBoundRandom(0, 7000));
    }
  }

  getBounds() {
    return {
      width: (this._screenWidth || this.offsetWidth),
      height: (this._screenHeight || this.offsetHeight)
    }
  }

  areValidBounds(bounds) {
    return bounds && bounds.width && bounds.height;
  }

  animateItem(group, item) {
    const bounds = this.getBounds();
    if (!this.areValidBounds(bounds)) return; // Invalid bounds dimensions

    let animationConfig;
    const animationType = group.getAnimation();
    if (animationType === 'falling') animationConfig = this.getAnimationFalling(bounds);
    if (animationType === 'sliding') animationConfig = this.getAnimationSliding(bounds);
    if (!animationConfig) return; // Unknown animation type

    // Init item start position
    item.setAttribute("transform", `translate(${animationConfig.startX}, ${animationConfig.startY})`);

    // Init item animation
    const animation = item.animate(animationConfig.steps, 
    {
      duration: animationConfig.duration,
      easing: "ease-in-out"
    });

    // Reference
    group.getAnimations().push(animation);
    animation.ready.then(this.onAnimationReady.bind(this, item));  
    animation.addEventListener('finish', this.onAnimationFinish.bind(this, group, item));
  }
  
  getAnimationFalling(bounds) {
    const startX = this.getBoundRandom(0, bounds.width);
    const startY = -60;
    const driftX = this.getBoundRandom(-80, 80);
    const rotateStart = this.getBoundRandom(0, 360);
    const rotateEnd = rotateStart + this.getBoundRandom(90, 360);
    const duration = this.getBoundRandom(10000, 20000);
    const steps = [
      { transform: `translate(${startX}px, ${startY}px) rotate(${rotateStart}deg)` },
      { transform: `translate(${startX + driftX}px, ${bounds.height - startY}px) rotate(${rotateEnd}deg)` }
    ];
    return {
      startX: startX,
      startY: startY,
      steps: steps,
      duration: duration
    }
  }

  getAnimationSliding(bounds) {
    const startX = -60;
    const startY = this.getBoundRandom(0, bounds.height - 100);
    const endX = bounds.width + 60;
    const endY = endX;
    const duration = this.getBoundRandom(10000, 20000);
    const steps = [
      { transform: `translate(${startX}px, ${startY}px)` },
      { transform: `translate(${endX}px, ${endY}px)` }
    ];
    return {
      startX: startX,
      startY: startY,
      steps: steps,
      duration: duration
    }
  }

  onAnimationReady(item) {
    item.style.visibility = 'visible';
  }

  onAnimationFinish(group, item, evt) {
    const animation = evt.target;
    animation.cancel();
    this._elements.animations = group.getAnimations().filter(a => a !== animation);
    if (!this._configChangeRequested) {
      this.animateItem(group, item); // loop only if config change not requested
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

  createAnimated(config) {
    const item = this.createItem(
      config.names,
      config.colors,
      config.opacities,
      config.scales);
    item.classList.add("animated");
    item.style.visibility = "hidden";
    return item;
  }

}

customElements.define('animated-background', AnimatedBackground);
