export class AnimationConfig {

  // private properties
  _config;

  constructor(config) {
    this._config = config;
  }

  getConfigOrStub(configName) {
    return this._config?.[configName] || this.constructor.getStubConfig()[configName];
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

  getXDrifts() {
    return this.getConfigOrStub("x_drifts");
  }

  getYDrifts() {
    return this.getConfigOrStub("y_drifts");
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

  getRotateDrifts() {
    return this.getConfigOrStub("rotate_drifts");
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
      x_start: [-60, -60],
      y_start: [0, 'height'],
      x_end: ['width', 'width'],
      y_end: [0, 'height'],
      rotate_start: [0, 360],
      rotate_end: [90, 720],
      delay: [0, 7000],
      duration: [10000, 20000]
    }
  }

  static getStubConfigTranslate() {
    return {
      name: 'translate',
      x_start: [0, 'width'],
      y_start: [-60, -60],
      x_end: [0, 'width'],
      y_end: ['height', 'height'],
      delay: [0, 7000],
      duration: [10000, 20000]
    }
  }
  
  static getStubConfigSlide() {
    return {
      name: 'slide',
      x_start: [-60, -60],
      y_start: [0, 'height'],
      x_drift: [60, 60],
      y_drift: [-80, 80],
      delay: [0, 7000],
      duration: [10000, 20000]
    }
  }

  static getStubConfigFall() {
    return {
      name: 'fall',
      x_start: [0, 'width'],
      y_start: [-10, -10],
      x_drift: [-80, 80],
      y_drift: [10, 10],
      rotate_start: [0, 360],
      rotate_drift: [90, 360],
      delay: [0, 5000],
      duration: [10000, 20000]
    }
  }

  static getStubConfigSway() {
    return {
      name: 'sway',
      x_start: [0, 'width'],
      y_start: [-60, -60],
      x_drifts: [-50, 50],
      y_drifts: [100, 130],
      rotate_drifts: [-20, 20],
      delay: [0, 7000],
      duration: [10000, 20000]
    }
  }

  // configuration defaults
  static getStubConfig() {
    const name = this._config?.["name"];
    if (name === 'translate-rotate') return this.getStubConfigTranslateAndRotate();
    if (name === 'translate') steps = this.getStubConfigTranslate();
    if (name === 'slide') return this.getStubConfigSlide();
    if (name === 'sway') return this.getStubConfigSway();
    return this.getStubConfigFall();
  }

}