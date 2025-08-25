import { Globals } from './globals.js';
import { parse, stringify, toJSON, fromJSON } from '../libs/flatted_3.3.3_min.js';

// Define logger helper class
//
// Usage in target classes:
// - to instanciate: this.logger = new Logger("my-js-module.js", this);
// - to log ERROR: if (this.logger.isErrorEnabled()) console.error(...this.logger.error(args));
// - to log WARN: if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(args));
// - to log INFO: if (this.logger.isInfoEnabled()) console.info(...this.logger.info(args));
// - to log DEBUG: if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(args));
// - to log TRACE: if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(args));
export class Logger {

  _pushbackLimit = 150; // Default pushback limit
  _levels = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
  _guid;
  _origin;
  _originName;
  _userAgentLevelTrigger;
  _userAgentValueTrigger;
  _userAgentIsPushbackRequired;
  _highlightRegExpCache = new Map();

  constructor(origin, originName) {
    this._guid = this.constructor.generateUUID();
    this._origin = origin;
    this._originName = originName;
  }

  getHass() {
    return this._origin?._hass;
  }

  getServerId() {
    return this._origin?._serverId;
  }

  getLevel() {
    const level = this._origin?._config?.['log_level'] || 'warn';
    return this._levels[level] ?? -1;
  }

  getHighlight() {
    return this._origin?._config?.['log_highlight'];
  }

  getPushback() {
    return !!this._origin?._config?.['log_pushback'];
  }

  getPushbackLimit() {
    const num = Number(this._origin?._config?.['log_pushback_limit']);
    return Number.isFinite(num) ? num : -1;
  }

  isLevelEnabled(level) { return (level <= this.getLevel()); }
  isErrorEnabled() { return this.isLevelEnabled(0); }
  isWarnEnabled() { return this.isLevelEnabled(1); }
  isInfoEnabled() { return this.isLevelEnabled(2); }
  isDebugEnabled() { return this.isLevelEnabled(3); }
  isTraceEnabled() { return this.isLevelEnabled(4); }

  doLogOnError(callback,...args) {
    try {
      callback(...args);
    } catch (err) {
      if (this.isErrorEnabled()) console.error(...this.error(err));
      throw err; // Rethrow the same error after logging
    }
  }

  getArgs(header, logStyle, ...args) {
    let useStyle = logStyle;
    let useHighlight = "";
    
    // Retrieve highlight regexp when highlight is activated
    const highlightRegExp = this.getHighlightRegExp();
    if (highlightRegExp) {
      // Check if highlight is required due to:
      // - level
      // - origin
      // - guid (should never match as newer guid is created each time)
      // - args
      const isRequiredByHeader = highlightRegExp.test(header);
      const isRequiredByOrigin = highlightRegExp.test(this._originName);
      const isRequiredByGuid = highlightRegExp.test(this._guid);
      const isRequiredByArgs = args && args.some(arg => highlightRegExp.test(arg));
      const isHighlightRequired = isRequiredByHeader || isRequiredByOrigin || isRequiredByGuid || isRequiredByArgs;
      if (isHighlightRequired) {

        // Highlight is required: replace current style with highlight style and prepend [HIGH]
        useStyle = this.getHighlightStyle();
        useHighlight = "[HIGH]";
      }
    }

    // Push logs to backend when needed (and when possible)
    const hass = this.getHass();
    if (this.canPushback(hass)) {

      // Get user configured pushback limit or use logger default limit
      const limit = this.getPushbackLimit();
      const appliedLimit = limit > 0 ? limit : this._pushbackLimit;

      // Serialize and limit serialized args before pushing to HA backend
      const serializedArgs = (args && args.length && args.length > 0) ? args.map(arg => this.truncateArg(this.constructor.safeSerialize(arg), appliedLimit)) : [];
      
      // Call to HA backend service for custom log pushback
      if (serializedArgs.length > 0) {
        hass.callService(
          Globals.COMPONENT_NAME, "log", { "si": this.getServerId(), "level": header, "origin": this._originName, "logger_id": this._guid, "highlight": useHighlight, "logs": serializedArgs }
        ).catch(err => {
          // Pushback fail fallback: notify pushback fail into web console without resorting to this logger
          console.warn("Unable to do log pushback (log might be too long or HA unresponsive):", err);
        });
      }
    }

    // Format args for frontend logs
    if (args && args.length && args.length > 0) {
      return [`%c[${header}][${this._originName}][${this._guid}]${useHighlight}`, useStyle, ...args];
    }
    return [`%c[${header}][${this._originName}][${this._guid}]${useHighlight}`, useStyle];
  }

  getHighlightRegExp() {
    const highlight = this.getHighlight();
    let highlightRegExp = null;
    if (highlight) {
      if (!this._highlightRegExpCache.has(highlight)) {
        try {
          highlightRegExp = new RegExp(highlight);
        } catch (err) {
          highlightRegExp = null;
          console.warn(`Invalid log_highlight regex ${highlight}`, err);
        }
        this._highlightRegExpCache.set(highlight, highlightRegExp);
      } else {
        highlightRegExp = this._highlightRegExpCache.get(highlight);
      }
    }
    return highlightRegExp;
  }

  getHighlightStyle() {
    return 'background: #c589e0; color: black; font-weight: bold;';
  }

  error(...args) { this.logUserAgent(); return this._error(...args); }
  warn(...args)  { this.logUserAgent(); return this._warn(...args); }
  info(...args)  { this.logUserAgent(); return this._info(...args); }
  debug(...args) { this.logUserAgent(); return this._debug(...args); }
  trace(...args) { this.logUserAgent(); return this._trace(...args); }

  _error(...args) { return this.getArgs('ERR', 'background: #d6a1a1; color: black; font-weight: bold;', ...args); }
  _warn(...args)  { return this.getArgs('WRN', 'background: #d6c8a1; color: black; font-weight: bold;', ...args); }
  _info(...args)  { return this.getArgs('INF', 'background: #a2d6a1; color: black; font-weight: bold;', ...args); }
  _debug(...args) { return this.getArgs('DBG', 'background: #75aaff; color: black; font-weight: bold;', ...args); }
  _trace(...args) { return this.getArgs('TRA', 'background: #b7b8b6; color: black; font-weight: bold;', ...args); }

  logUserAgent() {
    if (this.shouldLogUserAgent()) this._userAgentIsPushbackRequired = true;
    if (this._userAgentIsPushbackRequired && this.canPushback(this.getHass())) {
      if (this.isTraceEnabled()) console.debug(...this._trace(`User_agent: ${this._userAgentValueTrigger}`));
      this._userAgentIsPushbackRequired = false;
    }
  }

  // Determines whether or not we should log level agent
  shouldLogUserAgent() {
    if (this._userAgentLevelTrigger !== this.getLevel()) {
      this._userAgentLevelTrigger = this.getLevel();
      if (this._userAgentValueTrigger !== navigator.userAgent) {
        this._userAgentValueTrigger = navigator.userAgent;
        return true;
      }
    }
    return false;
  }

  canPushback(hass) {
    return hass && this.getPushback();
  }

  // Truncate argument to the limit, appending "...[truncated|<limit>|<total>]" at the end when truncation occurs
  truncateArg(arg, limit) {
    if (typeof arg !== "string") return arg;
    return (arg?.length || -1) > limit ? arg.slice(0, limit) + `...[truncated|${limit}|${arg.length}]` : arg;
  }

  // Serialize an object safely
  static safeSerialize(input) {
    try {
      return stringify(input); // Use Flatted to serialize
    } catch (e) {
      return '[unserializable]';
    }
  }
  
  // Simple RFC4122-compliant UUID v4 generator
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
