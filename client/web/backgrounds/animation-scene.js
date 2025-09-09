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
  _DATE_DEGREE_MIN = 1;
  _DATE_DEGREE_MAX = 6;

  // private properties
  _config;
  _dateStart;
  _dateEnd;

  constructor(config) {
    let partDegree = this._DATE_DEGREE_MAX;
    for (const part of this._DATE_FIELDS) {
      this._DATE_PARTS.add(part);
      this._DATE_DEGREES_PARTS.set(partDegree, part);
      this._DATE_PARTS_DEGREES.set(part, partDegree);
      partDegree--;
    }
    this._config = config;
    this._dateStart = new AnimationDate(this.getConfigOrStub("date_start"));
    this._dateEnd = new AnimationDate(this.getConfigOrStub("date_end"));
    this.fillEndDate(this._dateEnd);
    this.fillStartDate(this._dateStart, this._dateEnd);
  }

  getConfigOrStub(configName) {
    return this._config?.[configName] || this.constructor.getStubConfig()[configName];
  }

  getGroups() {
    return this.getConfigOrStub("groups");
  }

  getDateStart() {
    return this._dateStart;
  }

  getDateEnd() {
    return this._dateEnd;
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

  findNextValidMonthForDay(currentYear, currentMonth, dayOfMonth) {
    let month = currentMonth + 1;
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

  findNextValidYearForDay(currentYear, currentMonth, dayOfMonth) {
    let year = currentYear + 1;
    let month = currentMonth;
  
    for (let i = 0; i < 8; i++) {
      const maxDays = this.getDaysInMonth(year, month);
  
      if (dayOfMonth <= maxDays) {
        return { year };
      }
  
      // Move to previous year
      year++;
    }
  
    // Should never happen if dayOfMonth <= 31
    return null;
  }

  findPreviousValidYearForDay(currentYear, currentMonth, dayOfMonth) {
    let year = currentYear - 1;
    let month = currentMonth;
  
    for (let i = 0; i < 12; i++) {
      const maxDays = this.getDaysInMonth(year, month);
  
      if (dayOfMonth <= maxDays) {
        return { year };
      }
  
      // Move to previous year
      year--;
    }
  
    // Should never happen if dayOfMonth <= 31
    return null;
  }

  findPreviousValidMonthForDay(currentYear, currentMonth, dayOfMonth) {
    let year = currentYear;
    let month = currentMonth - 1;
    if (month < 1) {
      month = 12;
      year--;
    }

    for (let i = 0; i < 12; i++) {
      const maxDays = this.getDaysInMonth(year, month);
  
      if (dayOfMonth <= maxDays) {
        return { year, month };
      }
  
      // Move to previous month
      month--;
      if (month < 1) {
        month = 12;
        year--;
      }
    }
  
    // Should never happen if dayOfMonth <= 31
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
    const now = AnimationDate.fromDate(new Date());
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
        const { year, month } = this.findNextValidMonthForDay(nowYearValue, nowMonthValue, endDateDayValue);
        this.setDatePartAtDegree(endDate, degree, month);
        this.setDatePartAtDegree(endDate, ++degree, year);
      } else if (part === 'year') {
        // Will set year in one shot to ensure global cohesion
        const endDateDayValue = this.getDatePartValue(endDate, 'day');
        const endDateMonthValue = this.getDatePartValue(endDate, 'month');
        const { year } = this.findNextValidYearForDay(nowYearValue, nowMonthValue, endDateDayValue);
        this.setDatePartAtDegree(endDate, degree, year);
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
    const firstDegreeToFill = lastFilledDegree + 1;
    if (this.isFirstDateLessThanSecondDate(startDate, endDate)) {

      // Fill all missing values AFTER completion degree with end date values (and adjust when needed)
      for (let degree = firstDegreeToFill; degree <= this._DATE_DEGREE_MAX; degree++) {
        const endDatePartValue = this.getDatePartValueForDegree(endDate, degree);
        this.setDatePartAtDegree(startDate, degree, endDatePartValue);
      }

    } else if (firstDegreeToFill <= this._DATE_DEGREE_MAX) {

      // Fill all missing values AFTER completion degree with end date values (and adjust when needed)
      const part = this.getDatePartForDegree(firstDegreeToFill);
      const startDateMonth = this.getDatePartValue(startDate, 'month');
      const startDateDay = this.getDatePartValue(startDate, 'day');
      
      const endDateYear = this.getDatePartValue(endDate, 'year');
      const endDateMonth = this.getDatePartValue(endDate, 'month');
      const endDateDay = this.getDatePartValue(endDate, 'day');
      const endDateHour = this.getDatePartValue(endDate, 'hour');
      const endDateMinute = this.getDatePartValue(endDate, 'minute');
      const endDateSecond = this.getDatePartValue(endDate, 'second');

      // Retrieve missing parts values
      let missingParts;
      if (part === 'year') {
        missingParts = this.findPreviousValidYearForDay(endDateYear, startDateMonth, startDateDay);
      } else if (part === 'month') {
        missingParts = this.findPreviousValidMonthForDay(endDateYear, endDateMonth, startDateDay);
      } else if (part === 'day') {
        missingParts = this.getPreviousDay(endDateYear, endDateMonth, endDateDay);
      } else if (part === 'hour') {
        missingParts = this.getPreviousHour(endDateYear, endDateMonth, endDateDay, endDateHour);
      } else if (part === 'minute') {
        missingParts = this.getPreviousMinute(endDateYear, endDateMonth, endDateDay, endDateHour, endDateMinute);
      } else {
        missingParts = this.getPreviousSecond(endDateYear, endDateMonth, endDateDay, endDateHour, endDateMinute, endDateSecond);
      }
      
      // Fill start date with retrieved values
      for (const [part, partValue] of Object.entries(missingParts)) {
        this.setDatePartValue(startDate, part, partValue);
      }
    } else {
      throw new RangeError(`startDate is fully filled with a greater value than endDate (expected lesser or remaining part to determine lesser value):`, startDate, endDate);
    }
  }

  getPreviousYear(currentYear) {
    let previousYear = currentYear - 1;

    if (previousYear < this.getDatePartMin('year')) {
      // Should never happend in normal cases
      throw new RangeError(`previousYear value ${previousYear} out of range (expected greater than ${this.getDatePartMin('year')})`);
    }

    return { year: previousYear };
  }

  getPreviousMonth(currentYear, currentMonth) {
    let year = currentYear;
    let previousMonth = currentMonth - 1;

    if (previousMonth < this.getDatePartMin('month')) {
      ({ year } = this.getPreviousYear(currentYear));
      previousMonth = this.getDatePartMax('month');
    }

    return { year, month: previousMonth };
  }

  getPreviousDay(currentYear, currentMonth, currentDay) {
    let year = currentYear;
    let month = currentMonth;
    let previousDay = currentDay - 1;

    if (previousDay < this.getDatePartMin('day')) {
      ({ year, month } = this.getPreviousMonth(currentYear, currentMonth));
      previousDay = this.getDaysInMonth(year, month);
    }

    return { year, month, day: previousDay };
  }

  getPreviousHour(currentYear, currentMonth, currentDay, currentHour) {
    let year = currentYear;
    let month = currentMonth;
    let day = currentDay;
    let previousHour = currentHour - 1;

    if (previousHour < this.getDatePartMin('hour')) {
      ({ year, month, day } = this.getPreviousDay(currentYear, currentMonth, currentDay));
      previousHour = this.getDatePartMax('hour');
    }

    return { year, month, day, hour: previousHour };
  }

  getPreviousMinute(currentYear, currentMonth, currentDay, currentHour, currentMinute) {
    let year = currentYear;
    let month = currentMonth;
    let day = currentDay;
    let hour = currentHour;
    let previousMinute = currentMinute - 1;

    if (previousMinute < this.getDatePartMin('minute')) {
      ({ year, month, day, hour } = this.getPreviousHour(currentYear, currentMonth, currentDay, currentHour));
      previousMinute = this.getDatePartMax('minute');
    }

    return { year, month, day, hour, minute: previousMinute };
  }

  getPreviousSecond(currentYear, currentMonth, currentDay, currentHour, currentMinute, currentSecond) {
    let year = currentYear;
    let month = currentMonth;
    let day = currentDay;
    let hour = currentHour;
    let minute = currentMinute;
    let previousSecond = currentSecond - 1;

    if (previousSecond < this.getDatePartMin('second')) {
      ({ year, month, day, hour, minute } = this.getPreviousMinute(currentYear, currentMonth, currentDay, currentHour, currentMinute));
      previousSecond = this.getDatePartMax('second');
    }

    return { year, month, day, hour, minute, second: previousSecond };
  }

  isFirstDateLessThanSecondDate(firstDate, secondDate) {
    for (let degree = this._DATE_DEGREE_MAX; degree >= this._DATE_DEGREE_MIN; degree--) {
      const firstDatePartValue = this.getDatePartValueForDegree(firstDate, degree);
      const secondDatePartValue = this.getDatePartValueForDegree(secondDate, degree);
      if (firstDatePartValue && 
         secondDatePartValue && 
         firstDatePartValue < secondDatePartValue) return true;
    }
    return false;
  }

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