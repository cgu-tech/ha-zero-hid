import { AnimationConfig } from './animation-config.js';

export class AnimationGroup {

  // private properties
  _items = [];
  _animations = new Set();
  _config;
  _animation;

  constructor(config) {
    this._config = config;
    this._animation = new AnimationConfig(this.getConfigOrStub("animation"));
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

  getName() {
    return this.getConfigOrStub("name");
  }

  getShape() {
    return this.getConfigOrStub("shape");
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
      name: "",
      shape: "",
      colors: ['#FFFFFF'],
      opacities: [1.0, 1.0],
      scales: [1.0, 1.0],
      quantity: 1,
      z_index: 0,
      animation: {}
    }
  }

}