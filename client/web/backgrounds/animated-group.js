export class AnimatedGroup {

  // private properties
  _items = [];
  _animations = [];
  _maxItems;
  _config;

  constructor(maxItems, config) {
    this._maxItems = maxItems;
    this._config = config;
  }

  getItems() {
    return this._items;
  }

  getAnimations() {
    return this._animations;
  }

  getMaxItems() {
    return this._maxItems;
  }

  getAnimation() {
    return this._animation;
  }

  getConfig() {
    return this._config;
  }

}