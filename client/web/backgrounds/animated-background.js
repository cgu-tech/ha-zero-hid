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
    animations.forEach(itemAnimation => itemAnimation.finish());

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
    return new AnimatedGroup(
      {
        names: ["ghost"],
        colors: ['#FFFFFF', '#EBEBEB', '#DBDBDB'],
        opacities: [0.6, 1],
        scales: [2.6, 5.1],
        quantity: 1, 
        animation: {
          name: 'sliding',
          xStart: [-60, -60],
          yStart: [0, 'height'],
          xDrift: [60, 60],
          yDrift: [-80, 80],
          delay: [0, 7000],
          duration: [10000, 20000]
        }
      }
    );
  }

  createSpidersGroup() {
    return new AnimatedGroup(
      {
        names: ["spider"],
        colors: ['#000000'],
        opacities: [0.6, 1],
        scales: [0.8, 1.8],
        quantity: 3,
        animation: {
          name: 'falling',
          xStart: [0, 'width'],
          yStart: [-60, -60],
          xDrift: [-80, 80],
          yDrift: [60, 60],
          rotateStart: [0, 360],
          rotateDrift: [90, 360],
          delay: [0, 7000],
          duration: [10000, 20000]
        }
      }
    );
  }

  createWebsGroup() {
    return new AnimatedGroup(
      {
        names: ["web"],
        colors: ['#636363'],
        opacities: [0.6, 1],
        scales: [1.2, 2.8],
        quantity: 2,
        animation: {
          name: 'falling',
          xStart: [0, 'width'],
          yStart: [-60, -60],
          xDrift: [-80, 80],
          yDrift: [60, 60],
          rotateStart: [0, 360],
          rotateDrift: [90, 360],
          delay: [0, 7000],
          duration: [10000, 20000]
        }
      }
    );
  }

  createWitchHatsGroup() {
    return new AnimatedGroup(
      {
        names: ["witch", "hat"],
        colors: ['#617A2B', '#673470', '#0F0F0F'],
        opacities: [0.6, 1],
        scales: [1.8, 3.2],
        quantity: 2,
        animation: {
          name: 'falling',
          xStart: [0, 'width'],
          yStart: [-60, -60],
          xDrift: [-80, 80],
          yDrift: [60, 60],
          rotateStart: [0, 360],
          rotateDrift: [90, 360],
          delay: [0, 7000],
          duration: [10000, 20000]
        }
      }
    );
  }

  createPumkinsGroup() {
    return new AnimatedGroup(
      {
        names: ["pumkin"],
        colors: ['#BF6C00', '#BF5300', '#D68120'],
        opacities: [0.6, 1],
        scales: [0.8, 1.8],
        quantity: 1,
        animation: {
          name: 'falling',
          xStart: [0, 'width'],
          yStart: [-60, -60],
          xDrift: [-80, 80],
          yDrift: [60, 60],
          rotateStart: [0, 360],
          rotateDrift: [90, 360],
          delay: [0, 7000],
          duration: [10000, 20000]
        }
      }
    );
  }

  createLeaveGroup() {
    return new AnimatedGroup(
      {
        names: ["leave"],
        colors: ['#D2691E', '#A0522D', '#FF8C00', '#CD853F', '#8B4513'],
        opacities: [0.6, 1],
        scales: [1.2, 2.8],
        quantity: 20,
        animation: {
          name: 'falling',
          xStart: [0, 'width'],
          yStart: [-60, -60],
          xDrift: [-80, 80],
          yDrift: [60, 60],
          rotateStart: [0, 360],
          rotateDrift: [90, 360],
          delay: [0, 7000],
          duration: [10000, 20000]
        }
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
    for (let i = 0; i < group.getConfig().quantity; i++) {
      const item = this.createAnimated(group.getConfig());
      group.getItems().push(item);
      this._elements.svg.appendChild(item);
      const delay = group.getConfig().animation.delay;
      setTimeout(() => this.animateItem(group, item), this.getBoundRandom(delay[0], delay[1]));
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

    const config = group.getConfig().animation;
    let animation;
    if (config.name === 'falling') animation = this.getAnimationFalling(bounds, config);
    if (config.name === 'sliding') animation = this.getAnimationSliding(bounds, config);
    if (!animation) return; // Unknown animation type

    // Init item start position
    item.setAttribute("transform", `translate(${animation.xStart}, ${animation.yStart})`);

    // Init animated item
    const itemAnimation = item.animate(animation.steps, 
    {
      duration: animation.duration,
      easing: "ease-in-out"
    });

    // Reference
    group.getAnimations().push(itemAnimation);
    itemAnimation.ready.then(this.onAnimationReady.bind(this, item));  
    itemAnimation.addEventListener('finish', this.onAnimationFinish.bind(this, group, item));
  }

  getAnimVal(bounds, rawVal) {
    if (rawVal === "width") return bounds.width;
    if (rawVal === "height") return bounds.height;
    return rawVal;
  }

  generateAnimationValue(bounds, values) {
    return this.getBoundRandom(this.getAnimVal(bounds, values[0]), this.getAnimVal(bounds, values[1]));
  }

  getAnimationFalling(bounds, config) {

    // Generate random values from config ranges
    const xStart = this.generateAnimationValue(bounds, config.xStart);
    const yStart = this.generateAnimationValue(bounds, config.yStart);
    const xDrift = this.generateAnimationValue(bounds, config.xDrift);
    const yDrift = this.generateAnimationValue(bounds, config.yDrift);
    const rotateStart = this.generateAnimationValue(bounds, config.rotateStart);
    const rotateDrift = this.generateAnimationValue(bounds, config.rotateDrift);
    const duration = this.generateAnimationValue(bounds, config.duration);

    // Generate computed values depending from other values
    const xEnd = xStart + xDrift;
    const yEnd = bounds.height + yDrift;
    const rotateEnd = rotateStart + rotateDrift;
    
    const steps = [
      { transform: `translate(${xStart}px, ${yStart}px) rotate(${rotateStart}deg)` },
      { transform: `translate(${xEnd}px, ${yEnd}px) rotate(${rotateEnd}deg)` }
    ];
    return {
      xStart: xStart,
      yStart: yStart,
      steps: steps,
      duration: duration
    }
  }

  getAnimationSliding(bounds, config) {

    // Generate random values from config ranges
    const xStart = this.generateAnimationValue(bounds, config.xStart);
    const yStart = this.generateAnimationValue(bounds, config.yStart);
    const xDrift = this.generateAnimationValue(bounds, config.xDrift);
    const yDrift = this.generateAnimationValue(bounds, config.yDrift);
    const duration = this.generateAnimationValue(bounds, config.duration);

    // Generate computed values depending from other values
    const xEnd = bounds.width + xDrift;
    const yEnd = yStart + yDrift;

    const steps = [
      { transform: `translate(${xStart}px, ${yStart}px)` },
      { transform: `translate(${xEnd}px, ${yEnd}px)` }
    ];
    return {
      xStart: xStart,
      yStart: yStart,
      steps: steps,
      duration: duration
    }
  }

  onAnimationReady(item) {
    item.style.visibility = 'visible';
  }

  onAnimationFinish(group, item, evt) {
    const itemAnimation = evt.target;
    itemAnimation.cancel();
    group.setAnimations(group.getAnimations().filter(a => a !== itemAnimation));
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
