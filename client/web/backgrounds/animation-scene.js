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

  static stringToDate(dateStr) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1; // JS months are 0-based
    const day = parseInt(dateStr.slice(6, 8), 10);
    const hour = parseInt(dateStr.slice(8, 10), 10);
    const minute = parseInt(dateStr.slice(10, 12), 10);
    const second = parseInt(dateStr.slice(12, 14), 10);
    return new Date(year, month, day, hour, minute, second);
  }

  static dateToString(date) {
    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const DD = String(date.getDate()).padStart(2, '0');
    const HH = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${YYYY}${MM}${DD}${HH}${mm}${ss}`;
  }

  // configuration defaults
  static getStubConfig() {
    return {
      groups: [],
      date_start: '19700101000000',
      date_end: this.dateToString((new Date()).setMinutes((new Date()).getMinutes() + 10))
    }
  }

}