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

  _levels = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
  _guid = this.constructor.generateUUID();
  _originName;
  _origin;

  constructor(originName, origin) {
    this._originName = originName;
    this._origin = origin;
  }

  getLevel() {
    const level = this._origin?._config?.['log_level'] || 'warn';
    return this._levels[level] ?? -1;
  }

  getPushback() {
    return !!this._origin?._config?.['log_pushback'];
  }

  getHass() {
    return this._origin?._hass;
  }

  isLevelEnabled(level) { return (level <= this.getLevel()); }
  isErrorEnabled() { return this.isLevelEnabled(0); }
  isWarnEnabled() { return this.isLevelEnabled(1); }
  isInfoEnabled() { return this.isLevelEnabled(2); }
  isDebugEnabled() { return this.isLevelEnabled(3); }
  isTraceEnabled() { return this.isLevelEnabled(4); }

  getArgs(header, logStyle, ...args) {
    const hass = this.getHass();
    
    // Push logs to backend when needed
    if (hass && this.getPushback()) {
      const serializedArgs = (args && args.length && args.length > 0) ? args.map(arg => this.constructor.deepSerialize(arg)) : [];
      if (serializedArgs.length > 0) {
        hass.callService(Globals.COMPONENT_NAME, "log", { "level": header, "origin": this._originName, "logs": serializedArgs, });
      }
    }

    // Give frontend logs format
    if (args && args.length && args.length > 0) {
      return [`%c[${header}][${this._originName}][${this._guid}]`, logStyle, ...args];
    }
    return [`%c[${header}][${this._originName}][${this._guid}]`, logStyle];
  }

  error(...args) { return this.getArgs('ERR', 'background: #d6a1a1; color: black; font-weight: bold;', ...args); }
  warn(...args)  { return this.getArgs('WRN', 'background: #d6c8a1; color: black; font-weight: bold;', ...args); }
  info(...args)  { return this.getArgs('INF', 'background: #a2d6a1; color: black; font-weight: bold;', ...args); }
  debug(...args) { return this.getArgs('DBG', 'background: #75aaff; color: black; font-weight: bold;', ...args); }
  trace(...args) { return this.getArgs('TRA', 'background: #b7b8b6; color: black; font-weight: bold;', ...args); }

  // Entry point
  static deepSerialize(input) {
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
