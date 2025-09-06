export class AnimatedGroup {

  // private properties
  _items = [];
  _animations = [];
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

  setAnimations(animations) {
    this._animations = animations;
  }

  getAnimation() {
    return this._animation;
  }

  getConfig() {
    return this._config;
  }

}