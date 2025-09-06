export class AnimationScene {

  // private properties
  _config;

  constructor(config) {
    this._config = config;
  }

  getConfigOrStub(configName) {
    return this._config?.[configName] || this.constructor.getStubConfig()[configName];
  }

  getGroups() {
    return this.getConfigOrStub("groups");
  }

  getDateStart() {
    return this.getConfigOrStub("date_start");
  }

  getDateEnd() {
    return this.getConfigOrStub("date_end");
  }

  // configuration defaults
  static getStubConfig() {
    return {
      names: ["circle"],
      colors: ['#FFFFFF'],
      opacities: [0.4, 0.9],
      scales: [1.2, 3.2],
      quantity: 5,
      z_index: 0,
      animation: {}
    }
  }

}