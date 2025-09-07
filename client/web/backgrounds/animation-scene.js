import { AnimationDate } from './animation-date.js';

export class AnimationScene {

  // private constants
  _DATE_FIELDS = ['year', 'month', 'day', 'hour', 'minute', 'second'];
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
    let partDegree = this._DATE_DEGREE_MAX;
    for (const part of this._DATE_FIELDS) {
      _DATE_PARTS.add(part);
      _DATE_DEGREES_PARTS.set(partDegree, part);
      _DATE_PARTS_DEGREES.set(part, partDegree);
      partDegree--;
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

  enforceDatePartValue(part, value) {
    const integerOrNull = this.tryCastAsInteger(value);
    if (!integerOrNull) return null;

    if (this._DATE_PARTS.has(part) && this.getDatePartMin(part) <= integerOrNull && integerOrNull <= this.getDatePartMax(part)) return integerOrNull;
    return null;
  }

  getDatePartForDegree(degree) {
    return this._DATE_DEGREES_PARTS.get(degree);
  }

  getDatePartValue(animationDate, part) {
    if (!part) return null;
    return this.enforceDatePartValue(part, animationDate[`get${this.capitalizeFirst(part)}`]());
  }

  getDatePartValueForDegree(animationDate, degree) {
    const part = this.getDatePartForDegree(degree);
    return this.getDatePartValue(animationDate, part);
  }

  setDatePartValue(animationDate, part, value) {
    if (!part) return null;
    animationDate[`set${this.capitalizeFirst(part)}`](value);
  }

  setDatePartAtDegree(animationDate, degree, value) {
    const part = this.getDatePartForDegree(degree);
    this.setDatePartValue(animationDate, part, value);
  }

  isLeapYear(year) {
    return (year % 4 === 0) && (year % 100 !== 0 || year % 400 === 0);
  }

  getDaysInMonth(year, month) {
    // Array of days in each month, index 0 = January (month 1)
    const daysInMonth = [31, this.isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    // month is 1-based (1 = January), so subtract 1 for array index
    return daysInMonth[month - 1];
  }

  findNextValidMonthForDay(dayOfMonth, currentMonth, currentYear) {
    let month = currentMonth;
    let year = currentYear;
  
    for (let i = 0; i < 12; i++) { // max of 12 iterations
      const maxDays = this.getDaysInMonth(year, month);
  
      if (dayOfMonth <= maxDays) {
        return { year, month };
      }
  
      // Move to next month
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  
    // Should never happen with dayOfMonth <= 31
    return null;
  }

  getDateCompletionDegree(animationDate) {
    let degree = this._DATE_DEGREE_MAX;
    let partValue;
    do {
      partValue = this.getDatePartValueForDegree(animationDate, degree);
    } while (!partValue && --degree > 0);
    return degree;
  }

  fromDate(date) {
    const animationDate = new AnimationDate({});
    animationDate.setYear(date.getFullYear());
    animationDate.setMonth(date.getMonth() + 1); // JS months are 0-based; AnimationDate expects 1-based
    animationDate.setDay(date.getDate());
    animationDate.setHour(date.getHours());
    animationDate.setMinute(date.getMinutes());
    animationDate.setSecond(date.getSeconds());
    return animationDate;
  }

  toDate(animationDate) {
    return new Date(
      animationDate.getYear(), 
      animationDate.getMonth() - 1, 
      animationDate.getDay(), 
      animationDate.getHour(), 
      animationDate.getMinute(), 
      animationDate.getSecond());
  }

  fillDateBeforeCompletionDegree(animationDate) {
    // Retrieve completion degree
    const lastFilledDegree = this.getDateCompletionDegree(animationDate);

    // Fill all missing values BEFORE completion degree with minimum values
    for (let degree = this._DATE_DEGREE_MIN; degree < lastFilledDegree; degree++) {
      let datePartValue = this.getDatePartValueForDegree(animationDate, degree);
      if (!datePartValue) {
        const part = this.getDatePartForDegree(degree);
        datePartValue = this.getDatePartMin(part);
        this.setDatePartAtDegree(animationDate, degree, datePartValue);
      }
    }
  }

  fillEndDate(endDate) {
    // Fill all missing values BEFORE completion degree
    this.fillDateBeforeCompletionDegree(endDate); 

    // Retrieve now date to use it as reference for post-completion-degree filling
    const now = this.fromDate(new Date());
    const nowYearValue = this.getDatePartValue(now, 'year');
    const nowMonthValue = this.getDatePartValue(now, 'month');

    // Retrieve completion degree
    const lastFilledDegree = this.getDateCompletionDegree(endDate);

    // Fill all missing values AFTER completion degree with current values (and adjust when needed)
    for (let degree = lastFilledDegree + 1; degree <= this._DATE_DEGREE_MAX; degree++) {
      let datePartValue = this.getDatePartValueForDegree(now, degree);
      const part = this.getDatePartForDegree(degree);
      if (part === 'month') {
        // Will set month and year in one shot to ensure global cohesion
        const endDateDayValue = this.getDatePartValue(endDate, 'day');
        const { yearValue, monthValue } = this.findNextValidMonthForDay(endDateDayValue, nowMonthValue, nowYearValue);
        this.setDatePartAtDegree(endDate, degree, monthValue);
        this.setDatePartAtDegree(endDate, ++degree, yearValue);
      } else if (part === 'year') {
        // Will set year in one shot to ensure global cohesion
        const endDateDayValue = this.getDatePartValue(endDate, 'day');
        const endDateMonthValue = this.getDatePartValue(endDate, 'month');
        const { yearValue, monthValue } = this.findNextValidMonthForDay(endDateDayValue, endDateMonthValue, nowYearValue);
        this.setDatePartAtDegree(endDate, degree, yearValue);
      } else {
        // Will set anything except year and month to the "now" value
        this.setDatePartAtDegree(endDate, degree, datePartValue);
      }
    }
  }

  fillStartDate(startDate, endDate) {

    // Fill all missing values BEFORE completion degree
    this.fillDateBeforeCompletionDegree(startDate); 

    // Retrieve completion degree
    const lastFilledDegree = this.getDateCompletionDegree(startDate);

    // Fill all missing values AFTER completion degree with current values (and adjust when needed)
    for (let degree = lastFilledDegree + 1; degree <= this._DATE_DEGREE_MAX; degree++) {
      let datePartValue = this.getDatePartValueForDegree(now, degree);
      const part = this.getDatePartForDegree(degree);
      if (part === 'month') {
        // Will set month and year in one shot to ensure global cohesion
        const endDateDayValue = this.getDatePartValue(endDate, 'day');
        const { yearValue, monthValue } = this.findNextValidMonthForDay(endDateDayValue, nowMonthValue, nowYearValue);
        this.setDatePartAtDegree(endDate, degree, monthValue);
        this.setDatePartAtDegree(endDate, ++degree, yearValue);
      } else if (part === 'year') {
        // Will set year in one shot to ensure global cohesion
        const endDateDayValue = this.getDatePartValue(endDate, 'day');
        const endDateMonthValue = this.getDatePartValue(endDate, 'month');
        const { yearValue, monthValue } = this.findNextValidMonthForDay(endDateDayValue, endDateMonthValue, nowYearValue);
        this.setDatePartAtDegree(endDate, degree, yearValue);
      } else {
        // Will set anything except year and month to the "now" value
        this.setDatePartAtDegree(endDate, degree, datePartValue);
      }
    }
  }

  //fillNextDegree(sourceDate, targetDate, isSourceBeforeTarget) {
  //  const targetLastFilledDegree = this.getDateCompletionDegree(targetDate);
  //  const targetNextDegreeToFill = targetLastFilledDegree + 1;
  //
  //  const targetLastFilledDegreeValue = this.getDatePartValueForDegree(targetDate, targetLastFilledDegree);
  //  const sourceLastFilledDegreeValue = this.getDatePartValueForDegree(sourceDate, targetLastFilledDegree);
  //
  //  if (isSourceBeforeTarget) {
  //    // Source < Target
  //    if (sourceLastFilledDegreeValue < targetLastFilledDegreeValue) {
  //      const sourceNextDegreeValue = this.getDatePartValueForDegree(sourceDate, targetNextDegreeToFill);
  //      this.setDatePartAtDegree(targetDate, targetNextDegreeToFill, sourceNextDegreeValue);
  //    } else {
  //      // TODO
  //    }
  //  } else {
  //    // Source > Target
  //    if (sourceLastFilledDegreeValue >= targetLastFilledDegreeValue) {
  //      const sourceNextDegreeValue = this.getDatePartValueForDegree(sourceDate, targetNextDegreeToFill);
  //      this.setDatePartAtDegree(targetDate, targetNextDegreeToFill, sourceNextDegreeValue);
  //    } else {
  //      // TODO
  //    }
  //  }
  //}




  // configuration defaults
  static getStubConfig() {
    return {
      groups: [],
      date_start: null,
      date_end: null
    }
  }

  isCompleteDate(animationDate) {
    return this.getDateCompletionDegree(animationDate) === this._DATE_DEGREE_MAX;
  }

  isPartialDate(animationDate) {
    return !this.isCompleteDate(animationDate);
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

}