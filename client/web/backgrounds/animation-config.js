export class AnimationConfig {

  // private properties
  _config;

  constructor(config) {
    this._config = config;
  }

  getConfigOrStub(configName) {
    return this._config?.[configName] || this.constructor.getStubConfig(this._config?.["name"])[configName];
  }

  getName() {
    return this.getConfigOrStub("name");
  }

  getXStart() {
    return this.getConfigOrStub("x_start");
  }

  getYStart() {
    return this.getConfigOrStub("y_start");
  }

  getXEnd() {
    return this.getConfigOrStub("x_end");
  }

  getYEnd() {
    return this.getConfigOrStub("y_end");
  }

  getXDrift() {
    return this.getConfigOrStub("x_drift");
  }

  getYDrift() {
    return this.getConfigOrStub("y_drift");
  }

  getRotateStart() {
    return this.getConfigOrStub("rotate_start");
  }

  getRotateEnd() {
    return this.getConfigOrStub("rotate_end");
  }

  getRotateDrift() {
    return this.getConfigOrStub("rotate_drift");
  }

  getDelay() {
    return this.getConfigOrStub("delay");
  }

  getDuration() {
    return this.getConfigOrStub("duration");
  }

  static getStubConfigTranslateAndRotate() {
    return {
      name: 'translate-rotate',
      xStart: [-60, -60],
      yStart: [0, 'height'],
      xEnd: ['width', 'width'],
      yEnd: [0, 'height'],
      rotateStart: [0, 360],
      rotateEnd: [90, 720],
      delay: [0, 7000],
      duration: [10000, 20000]
    }
  }

  static getStubConfigTranslate() {
    return {
      name: 'translate',
      xStart: [0, 'width'],
      yStart: [-60, -60],
      xEnd: [0, 'width'],
      yEnd: ['height', 'height'],
      delay: [0, 7000],
      duration: [10000, 20000]
    }
  }
  
  static getStubConfigSlide() {
    return {
      name: 'slide',
      xStart: [-60, -60],
      yStart: [0, 'height'],
      xDrift: [60, 60],
      yDrift: [-80, 80],
      delay: [0, 7000],
      duration: [10000, 20000]
    }
  }

  static getStubConfigFall() {
    return {
      name: 'fall',
      xStart: [0, 'width'],
      yStart: [-10, -10],
      xDrift: [-80, 80],
      yDrift: [10, 10],
      rotateStart: [0, 360],
      rotateDrift: [90, 360],
      delay: [0, 5000],
      duration: [10000, 20000]
    }
  }

  // configuration defaults
  static getStubConfig(name) {
    if (name === 'translate-rotate') return this.getStubConfigTranslateAndRotate();
    if (name === 'translate') steps = this.getStubConfigTranslate();
    if (name === 'slide') return this.getStubConfigSlide();
    return this.getStubConfigFall();
  }

}