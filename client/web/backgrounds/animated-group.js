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

  // configuration defaults
  static getStubConfig() {
    return {
      names: ["circle"],
      colors: ['#FFFFFF'],
      opacities: [0.4, 0.9],
      scales: [1.2, 3.2],
      quantity: 5,
      zIndex: 0,
      animation: {
        name: 'fall',
        xStart: [0, 'width'],
        yStart: [-10, -10],
        xDrift: [-80, 80],
        yDrift: [10, 10],
        rotateStart: [0, 360],
        rotateDrift: [90, 360],
        delay: [0, 500],
        duration: [10000, 20000]
      }
    }
  }

}