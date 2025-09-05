export class AnimatedGroup {

  // private properties
  _items = [];
  _animations = [];
  _maxItems;
  _animation;
  _config;

  constructor(maxItems, animation, config) {
    this._maxItems = maxItems;
    this._animation = animation;
    this._config = config;
  }

  getItems() {
    return this._items;
  }

  getAnimations() {
    return this._items;
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