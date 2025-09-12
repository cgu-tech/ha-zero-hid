import { Globals } from '../utils/globals.js';
import { Logger } from '../utils/logger.js';
import { EventManager } from '../utils/event-manager.js';
import { ResourceManager } from '../utils/resource-manager.js';
import { LayoutManager } from '../utils/layout-manager.js';
import { SortedLinkedMap } from '../utils/sorted-linked-map.js';
import { AnimationGroup } from './animation-group.js';
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
    this.doResetLayout();
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  getAnimations() {
    return this._layoutManager.getFromConfigOrDefaultConfig("animations");
  }

  getGroups() {
    return this._elements.groups;
  }

  // jobs
  doCheckConfig() {
  }

  doCard() {
    // Create SVG background
    this._elements.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._elements.svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    this._elements.groups = new Set();
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
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('doUpdateConfig()'));
    this.doResetLayout();
    this.doUpdateLayout();
  }

  onResize() {
    this.doResizeBackground();
  }

  doResizeBackground() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('doResizeBackground()'));
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
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('doResetLayout()'));

    // Reset groups
    this.doResetGroups();

    // Reset items
    this.doResetZIndexedItems();
  }

  doResetGroups() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('doResetGroups()'));
    const groups = this.getGroups();
    for (const group of groups) {
      this.doResetGroup(group);
    }
    groups.clear();
  }

  doResetGroup(group) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doResetGroup(group): ${group.getName()} (guid: ${group.getGuid()}, items: ${group.getItems().size})`, group));
    const animations = group.getAnimations();
    const items = group.getItems();

    // Finish all animations now
    for (const animation of animations) {
      animation.finish();
    }

    // Remove old items from DOM
    for (const item of items) {
      item.remove();
    }

    // Reset items and animations arrays
    items.clear();
    animations.clear();
  }

  doResetZIndexedItems() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('doResetZIndexedItems()'));
    for (const [zIndex, zIndexItems] of this._elements.zIndexedItems) {
      zIndexItems.clear();
    }
  }

  doUpdateLayout() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('doUpdateLayout()'));

    // Create groups from config
    for (const [animationName, animationConfig] of Object.entries(this.getAnimations() || {})) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doUpdateLayout(): creating group ${animationName}...`));
      const group = this.doCreateGroup(animationName, animationConfig);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doUpdateLayout(): group ${group.getName()} (guid: ${group.getGuid()}, items: ${group.getItems().size}) created:`, group));
      this.getGroups().add(group);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`doUpdateLayout(): pushing group ${group.getName()} (guid: ${group.getGuid()}, items: ${group.getItems().size}) into groups:`, this.getGroups()));
    }

    // Wait for layout to be ready before creating new fallings
    requestAnimationFrame(this.doCreateAnimateds.bind(this));
  }

  doCreateGroup(animationName, animationConfig) {
    return new AnimationGroup(
      {
        name: animationName,
        ...animationConfig
      }
    );
  }

  doCreateAnimateds() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('doCreateAnimateds()'));

    // Resize viewbox to parent container dimensions (whenever possible)
    if (this.doResizeBackground()) {

      // Create new fallings using current configuration
      this.createAnimateds();
    }
  }

  createAnimateds() {
    this.doResetZIndexedItems();
    for (const group of this.getGroups()) {
      this.doResetGroup(group);
      this.doCreateAnimatedGroup(group);
    }
  }

  doCreateAnimatedGroup(group) {
    for (let i = 0; i < group.getQuantity(); i++) {
      // Retrieve or create zIndexItems set
      const zIndexedItems = this._elements.zIndexedItems;
      const zIndex = group.getZIndex();
      let zIndexItems = zIndexedItems.get(zIndex);
      if (!zIndexItems) {
        zIndexItems = new Set();
        zIndexedItems.set(zIndex, zIndexItems);
      }

      const item = this.createAnimated(group);
      if (!item) continue; // Skip item when invalid

      group.getItems().add(item); // Push new item into its group items
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
      const delay = group.getAnimation().getDelay();
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

    const animationConfig = group.getAnimation();

    // Generate random values for each config values ranges
    const xStart = this.generateAnimationValue(bounds, animationConfig.getXStart());
    const yStart = this.generateAnimationValue(bounds, animationConfig.getYStart());
    const xEnd = this.generateAnimationValue(bounds, animationConfig.getXEnd());
    const yEnd = this.generateAnimationValue(bounds, animationConfig.getYEnd());
    const xDrift = this.generateAnimationValue(bounds, animationConfig.getXDrift());
    const yDrift = this.generateAnimationValue(bounds, animationConfig.getYDrift());
    const rotateStart = this.generateAnimationValue(bounds, animationConfig.getRotateStart());
    const rotateEnd = this.generateAnimationValue(bounds, animationConfig.getRotateEnd());
    const rotateDrift = this.generateAnimationValue(bounds, animationConfig.getRotateDrift());
    const duration = this.generateAnimationValue(bounds, animationConfig.getDuration());

    // Prepare item animation steps
    let steps;
    if (animationConfig.getName() === 'fall') steps = this.getStepsFall(bounds, xStart, yStart, xDrift, yDrift, rotateStart, rotateDrift);
    if (animationConfig.getName() === 'slide') steps = this.getStepsSlide(bounds, xStart, yStart, xDrift, yDrift);
    if (animationConfig.getName() === 'translate-rotate') steps = this.getStepsTranslateAndRotate(xStart, yStart, xEnd, yEnd, rotateStart, rotateEnd);
    if (animationConfig.getName() === 'translate') steps = this.getStepsTranslate(xStart, yStart, xEnd, yEnd);
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
    if (this.getGroups().has(group) && group.getItems().has(item)) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`onAnimationFinish(group, item, evt): restarting animateItem(group, item) for group ${group.getGuid()}...`, group, item, evt));
      this.animateItem(group, item); // loop only if config did not changed
    } else {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`onAnimationFinish(group, item, evt): aborting animateItem(group, item) for group ${group.getGuid()}...`, group, item, evt));
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

  createItem(name, colors, opacities, scales) {
    const nameParts = name ? name.split('-') : [];
    const functionName = `create${nameParts.map(namePart => this.capitalizeFirst(namePart)).join('')}`;
    return items[functionName]?.(this.getRandomColor(colors), this.getBoundRandom(opacities[0], opacities[1]), this.getBoundRandom(scales[0], scales[1]));
  }

  createAnimated(group) {
    const item = this.createItem(
      group.getShape(),
      group.getColors(),
      group.getOpacities(),
      group.getScales());
    if (!item) return null;
    item.classList.add("animated");
    item.style.visibility = "hidden";
    return item;
  }

}

customElements.define('animated-background', AnimatedBackground);
