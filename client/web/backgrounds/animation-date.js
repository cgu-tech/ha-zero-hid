export class AnimationDate {

  // private properties
  _config;
  _year;
  _month;
  _day;
  _hour;
  _minute;
  _second;

  constructor(config) {
    this._config = config;
  }

  getConfigOrStub(configName) {
    return this._config?.[configName] || this.constructor.getStubConfig()[configName];
  }

  getYear() {
    return this._year ?? this.getConfigOrStub("year");
  }

  getMonth() {
    return this._month ?? this.getConfigOrStub("month");
  }

  getDay() {
    return this._day ?? this.getConfigOrStub("day");
  }

  getHour() {
    return this._hour ?? this.getConfigOrStub("hour");
  }

  getMinute() {
    return this._minute ?? this.getConfigOrStub("minute");
  }

  getSecond() {
    return this._second ?? this.getConfigOrStub("second");
  }

  setYear(value) {
    this._year = value;
  }

  setMonth(value) {
    this._month = value;
  }

  setDay(value) {
    this._day = value;
  }

  setHour(value) {
    this._hour = value;
  }

  setMinute(value) {
    this._minute = value;
  }

  setSecond(value) {
    this._second = value;
  }

  // configuration defaults
  static getStubConfig() {
    return {
      year: null,
      month: null,
      day: null,
      hour: null,
      minute: null,
      second: null
    }
  }

  static fromDate(date) {
    const animationDate = new AnimationDate({});
    animationDate.setYear(date.getFullYear());
    animationDate.setMonth(date.getMonth() + 1); // JS months are 0-based; AnimationDate expects 1-based
    animationDate.setDay(date.getDate());
    animationDate.setHour(date.getHours());
    animationDate.setMinute(date.getMinutes());
    animationDate.setSecond(date.getSeconds());
    return animationDate;
  }

  static toDate(animationDate) {
    return new Date(
      animationDate.getYear(), 
      animationDate.getMonth() - 1, 
      animationDate.getDay(), 
      animationDate.getHour(), 
      animationDate.getMinute(), 
      animationDate.getSecond());
  }

}