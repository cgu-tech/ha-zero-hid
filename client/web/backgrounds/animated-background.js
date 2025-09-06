import { Globals } from '../utils/globals.js';
import { Logger } from '../utils/logger.js';
import { EventManager } from '../utils/event-manager.js';
import { ResourceManager } from '../utils/resource-manager.js';
import { LayoutManager } from '../utils/layout-manager.js';
import { SortedLinkedMap } from '../utils/sorted-linked-map.js';
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
    this._elements.zIndexedItems = new SortedLinkedMap();
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

    // Reset items
    this.doResetZIndexedItems();

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
    animations.clear();
  }

  doResetZIndexedItems() {
    for (const [zIndex, zIndexItems] of this._elements.zIndexedItems) {
      zIndexItems.clear();
    }
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
        opacities: [1, 1],
        scales: [2.6, 5.1],
        quantity: 1, 
        zIndex: 4,
        animation: {
          name: 'slide',
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
        opacities: [1, 1],
        scales: [0.8, 1.8],
        quantity: 3,
        zIndex: 3,
        animation: {
          name: 'fall',
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
        opacities: [1, 1],
        scales: [1.2, 2.8],
        quantity: 2,
        zIndex: 1,
        animation: {
          name: 'fall',
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
        opacities: [1, 1],
        scales: [1.8, 3.2],
        quantity: 2,
        zIndex: 0,
        animation: {
          name: 'fall',
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
        opacities: [1, 1],
        scales: [0.8, 1.8],
        quantity: 1,
        zIndex: 2,
        animation: {
          name: 'fall',
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
        opacities: [1, 1],
        scales: [1.2, 2.8],
        quantity: 20,
        zIndex: 0,
        animation: {
          name: 'fall',
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
    this._elements.groups.length = 0;
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
      // Retrieve or create zIndexItems set
      const zIndexedItems = this._elements.zIndexedItems;
      const zIndex = group.getConfig().zIndex;
      let zIndexItems = zIndexedItems.get(zIndex);
      if (!zIndexItems) {
        zIndexItems = new Set();
        zIndexedItems.set(zIndex, zIndexItems);
      }

      const item = this.createAnimated(group.getConfig());
      group.getItems().push(item); // Push new item into its group items
      zIndexItems.add(item); // Push new item into its correlated zIndexItems Set()

      // Look for first item with next zIndex
      const nextZIndex = zIndexedItems.nextKey(zIndex);
      const nextZIndexItems = nextZIndex ? zIndexedItems.get(nextZIndex) : null;
      const nextZIndexItem = nextZIndexItems 
        ? (nextZIndexItems.size > 0 
           ? nextZIndexItems.values().next().value
           : null)
        : null;

      // Insert before first item with next zIndex (so new item will appear behind first item with next zIndex)
      this._elements.svg.insertBefore(item, nextZIndexItem);
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

  getAnimVal(bounds, rawVal) {
    if (rawVal === "width") return bounds.width;
    if (rawVal === "height") return bounds.height;
    return rawVal;
  }

  generateAnimationValue(bounds, values) {
    if (!values) return null; // Not all values are required for every animation
    return this.getBoundRandom(this.getAnimVal(bounds, values[0]), this.getAnimVal(bounds, values[1]));
  }

  animateItem(group, item) {
    const bounds = this.getBounds();
    if (!this.areValidBounds(bounds)) return; // Invalid bounds dimensions

    const config = group.getConfig().animation;

    // Generate random values for each config values ranges
    const xStart = this.generateAnimationValue(bounds, config.xStart);
    const yStart = this.generateAnimationValue(bounds, config.yStart);
    const xEnd = this.generateAnimationValue(bounds, config.xEnd);
    const yEnd = this.generateAnimationValue(bounds, config.yEnd);
    const xDrift = this.generateAnimationValue(bounds, config.xDrift);
    const yDrift = this.generateAnimationValue(bounds, config.yDrift);
    const rotateStart = this.generateAnimationValue(bounds, config.rotateStart);
    const rotateEnd = this.generateAnimationValue(bounds, config.rotateEnd);
    const rotateDrift = this.generateAnimationValue(bounds, config.rotateDrift);
    const duration = this.generateAnimationValue(bounds, config.duration);

    // Prepare item animation steps
    let steps;
    if (config.name === 'fall') steps = this.getStepsFall(bounds, xStart, yStart, xDrift, yDrift, rotateStart, rotateDrift);
    if (config.name === 'slide') steps = this.getStepsSlide(bounds, xStart, yStart, xDrift, yDrift);
    if (config.name === 'translate-rotate') steps = this.getStepsTranslateAndRotate(xStart, yStart, xEnd, yEnd, rotateStart, rotateEnd);
    if (config.name === 'translate') steps = this.getStepsTranslate(xStart, yStart, xEnd, yEnd);
    if (!steps) return; // Unknown animation type

    // Set item start position
    item.setAttribute("transform", `translate(${xStart}, ${yStart})`);

    // Animate item using prepared animation steps + duration + in/out effect
    const animation = item.animate(steps, { duration: duration, easing: "ease-in-out" });

    // Reference animation
    group.getAnimations().add(animation);

    // Add animation ready/stop listeners
    animation.ready.then(this.onAnimationReady.bind(this, item));  
    animation.addEventListener('finish', this.onAnimationFinish.bind(this, group, item));
  }

  getStepsFall(bounds, xStart, yStart, xDrift, yDrift, rotateStart, rotateDrift) {
    const xEnd = xStart + xDrift;
    const yEnd = bounds.height + yDrift;
    const rotateEnd = rotateStart + rotateDrift;
    return this.getStepsTranslateAndRotate(xStart, yStart, xEnd, yEnd, rotateStart, rotateEnd);
  }

  getStepsSlide(bounds, xStart, yStart, xDrift, yDrift) {
    const xEnd = bounds.width + xDrift;
    const yEnd = yStart + yDrift;
    return this.getStepsTranslate(xStart, yStart, xEnd, yEnd);
  }

  getStepsTranslateAndRotate(xStart, yStart, xEnd, yEnd, rotateStart, rotateEnd) {
    return [
      { transform: `translate(${xStart}px, ${yStart}px) rotate(${rotateStart}deg)` },
      { transform: `translate(${xEnd}px, ${yEnd}px) rotate(${rotateEnd}deg)` }
    ];
  }

  getStepsTranslate(xStart, yStart, xEnd, yEnd) {
    return [
      { transform: `translate(${xStart}px, ${yStart}px)` },
      { transform: `translate(${xEnd}px, ${yEnd}px)` }
    ];
  }

  onAnimationReady(item) {
    item.style.visibility = 'visible';
  }

  onAnimationFinish(group, item, evt) {
    const animation = evt.target;
    animation.cancel();
    group.getAnimations().delete(animation);
    if (!this._configChangeRequested) {
      this.animateItem(group, item); // loop only if config change not requested
    }
  }

  getBoundRandom(min, max) {
    if (min === max) return min; // optimization when both have same value
    return Math.random() * (max - min) + min;
  }

  getRandomColor(colors) {
    if (!colors || colors.length < 1) return null; // optimization when no value
    if (colors.length === 1) return colors[0]; // optimization when only one value
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
