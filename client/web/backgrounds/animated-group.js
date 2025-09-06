export class AnimatedGroup {

  // private properties
  _items = [];
  _animations = new Set();
  _config;

  constructor(config) {
    this._config = config;
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

  getConfig() {
    return this._config;
  }

}