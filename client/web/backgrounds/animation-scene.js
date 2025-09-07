import { AnimationDate } from './animation-date.js';

export class AnimationScene {

  // private constants
  _DATE_PARTS = new Set();
  _DATE_DEGREES_PARTS = new Map();
  _DATE_PARTS_DEGREES = new Map();
  _DATE_BOUNDS = {
      year:   { min: -271821, max: 275760 },
      month:  { min:       1, max:     12 },
      day:    { min:       1, max:     31 },
      hour:   { min:       0, max:     23 },
      minute: { min:       0, max:     59 },
      second: { min:       0, max:     59 }
    };
  _DATE_DEGREE_MIN = 0;
  _DATE_DEGREE_MAX = 6;

  // private properties
  _config;

  constructor(config) {
    this._config = config;
    const dateParts = ['year', 'month', 'day', 'hour', 'minute', 'second'];
    let datePartsIndex = 6;
    for (const part of dateParts) {
      _DATE_PARTS.add(part);
      _DATE_DEGREES_PARTS.set(datePartsIndex, part);
      _DATE_PARTS_DEGREES.set(part, datePartsIndex);
      datePartsIndex--;
    }
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

  isInActivationRange(date=new Date()) {
    const start = this.getDateStart();
    const end = this.getDateEnd();

    if (start && end) return start <= date && date <= end; // Check specified date is in between
    if (!start && !end) return true; // No start and no end date: we are always in
    if (!start) return date <= end; // No start date: check end date is after
    return start <= date; // No end date: check start date is before
  }

  isValidDateString(str) {
    if (!/^\d{14}$/.test(str)) return false; // Must be exactly 14 digits
  
    const year = parseInt(str.slice(0, 4), 10);
    const month = parseInt(str.slice(4, 6), 10);
    const day = parseInt(str.slice(6, 8), 10);
    const hour = parseInt(str.slice(8, 10), 10);
    const minute = parseInt(str.slice(10, 12), 10);
    const second = parseInt(str.slice(12, 14), 10);
  
    // Quick range checks (eliminates obvious invalid values)
    if (
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      hour < 0 || hour > 23 ||
      minute < 0 || minute > 59 ||
      second < 0 || second > 59
    ) return false;
  
    // JS Date months are 0-based
    const date = new Date(year, month - 1, day, hour, minute, second);
  
    // Validate that Date didn't autocorrect an invalid date
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second
    );
  }

  tryCastAsNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && Number.isFinite(Number(trimmed))) return trimmed;
    }
    return null;
  }

  tryCastAsInteger(value) {
    const numberOrNull = this.tryCastAsNumber(value);
    if (!numberOrNull) return null;
    
    if (Number.isInteger(numberOrNull)) return numberOrNull;
    return null;
  }

  getDatePartMin(part) { return this._DATE_BOUNDS[part].min; }
  getDatePartMax(part) { return this._DATE_BOUNDS[part].max; }

  capitalizeFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : null;
  }

  getDatePart(part, value) {
    const integerOrNull = this.tryCastAsInteger(value);
    if (!integerOrNull) return null;

    if (this._DATE_PARTS.has(part) && this.getDatePartMin(part) <= integerOrNull && integerOrNull <= this.getDatePartMax(part)) return integerOrNull;
    return null;
  }

  getDatePartForDegree(animationDate, degree) {
    const part = _DATE_DEGREES_PARTS.get(degree);
    if (!part) return null;
    return this.getDatePart(part, animationDate[`get${this.capitalizeFirst(part)}`]());
  }

  getDateCompletionDegree(animationDate) {
    let degree = this._DATE_DEGREE_MAX;
    let part;
    do {
      part = this.getDatePartForDegree(animationDate, degree);
    } while (!part && --degree > 0);
    return degree;
  }

  setDatePartFromDegree(animationDate, degree, value) {
    if (degree === this._DATE_DEGREE_MAX) animationDate.setYear(value);
    if (degree === this._DATE_DEGREE_MAX-1) animationDate.setMonth(value);
    if (degree === this._DATE_DEGREE_MAX-2) animationDate.setDay(value);
    if (degree === this._DATE_DEGREE_MAX-3) animationDate.setHour(value);
    if (degree === this._DATE_DEGREE_MAX-4) animationDate.setMinute(value);
    if (degree === this._DATE_DEGREE_MAX-5) animationDate.setSecond(value);
  }

  isCompleteDate(animationDate) {
    return this.getDateCompletionDegree(animationDate) === this._DATE_DEGREE_MAX;
  }

  isPartialDate(animationDate) {
    return !this.isCompleteDate(animationDate);
  }

  fillNextDegree(sourceDate, targetDate, isSourceBeforeTarget) {
    const targetLastFilledDegree = this.getDateCompletionDegree(targetDate);
    const targetLastFilledDegreeValue = this.getDatePartForDegree(targetDate, targetLastFilledDegree);
    const targetNextDegreeToFill = targetLastFilledDegree + 1;

    const sourceLastFilledDegreeValue = this.getDatePartForDegree(sourceDate, targetLastFilledDegree);
    const sourceNextDegreeToFillValue = this.getDatePartForDegree(sourceDate, targetNextDegreeToFill);

    if (isSourceBeforeTarget) {
      if (sourceLastFilledDegreeValue < targetLastFilledDegreeValue) {
        this.setDatePartFromDegree(targetDate, targetNextDegreeToFill, sourceNextDegreeToFillValue);
      } else {
        
      }
    }
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
      date_start: null,
      date_end: null
    }
  }

}