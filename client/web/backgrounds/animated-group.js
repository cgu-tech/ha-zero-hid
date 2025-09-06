import { AnimationConfig } from './animation-config.js';

export class AnimatedGroup {

  // private properties
  _items = [];
  _animations = new Set();
  _config;
  _animation;

  constructor(config) {
    this._config = config;
    this._animation = new AnimationConfig(this._config?.["animation"]);
  }

  getItems() {
    return this._items;
  }

  getAnimations() {
    return this._animations;
  }

  getAnimation() {
    return this._animation;
  }

  getConfigOrStub(configName) {
    return this._config?.[configName] || this.constructor.getStubConfig()[configName];
  }

  getNames() {
    return this.getConfigOrStub("names");
  }

  getColors() {
    return this.getConfigOrStub("colors");
  }

  getOpacities() {
    return this.getConfigOrStub("opacities");
  }

  getScales() {
    return this.getConfigOrStub("scales");
  }

  getQuantity() {
    return this.getConfigOrStub("quantity");
  }

  getZIndex() {
    return this.getConfigOrStub("z_index");
  }

  // configuration defaults
  static getStubConfig() {
    return {
      names: ["circle"],
      colors: ['#FFFFFF'],
      opacities: [0.4, 0.9],
      scales: [1.2, 3.2],
      quantity: 5,
      zIndex: 0,
      animation: AnimationConfig.getStubConfig()
    }
  }

}