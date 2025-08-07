import { Globals } from './globals.js';
import { parse, stringify, toJSON, fromJSON } from '../libs/flatted_3.3.3_min.js';

// Define logger helper class
export class Logger {
  constructor(origin, level, hass, pushback) {
    this.guid = this.generateUUID(); // Replace static ID
    console.debug(`[Logger constructor] New instance created: ${this.guid}`, new Error().stack);
    this.origin = origin;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
    this.levelsKeys = Object.fromEntries(Object.entries(this.levels).map(([key, value]) => [value, key]));
    this.update(level, hass, pushback);
    this.objLevelLimit = 1;
    this.objByteLimit = 3000;
  }
  
  generateUUID() {
    // Simple RFC4122-compliant UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  
  update(level, hass, pushback) {
    this._hass = hass;
    this.setLevel(level);
    this.setPushback(pushback);
  }
  setLevel(level) {
    if (!(level in this.levels)) {
      this.logInternal("warn", "setLevel", `Invalid log level: ${level} (will default to warn)`);
      level = 'warn';
    }
    const newLevel = this.levels[level] ?? 0;
    if (newLevel !== this.level) {
      this.level = newLevel;
      this.logInternal("debug", "setLevel", `Log level of frontend ${this.origin} set to ${level}`);
    }
  }
  setPushback(pushback) {
    if (pushback !== this._pushback) {
      this._pushback = pushback;
      this._pushbackSetupNeeded = pushback;
    }
    if (this._pushback) {
      if (this._pushbackSetupNeeded && this._hass) {
        this._hass.callService("logger", "set_level", { [`custom_components.${Globals.COMPONENT_NAME}`]: 'debug' });
        this._pushbackSetupNeeded = false;
        this.logInternal("debug", "setPushback", `Log level of backend ${Globals.COMPONENT_NAME} component set to debug`);
      }
      this.logInternal("debug", "setPushback", `Push frontend log into backend logger enabled`);
    } else {
      this.logInternal("debug", "setPushback", `Push frontend log into backend logger disabled`);
    }
  }
  setHass(hass) {
    this._hass = hass;
    this.logInternal("debug", "setHass", `Hass set to ${hass}`);
    this.setPushback(this._pushback);
  }
  isLevelEnabled(level) { return (level <= this.level); }
  isErrorEnabled() { return this.isLevelEnabled(0); }
  isWarnEnabled() { return this.isLevelEnabled(1); }
  isInfoEnabled() { return this.isLevelEnabled(2); }
  isDebugEnabled() { return this.isLevelEnabled(3); }
  isTraceEnabled() { return this.isLevelEnabled(4); }
  
  getArgs(skipPushback, header, logStyle, ...args) {
    // Push logs to backend when needed
    if (!skipPushback && this._hass && this._pushback) {
      console.log(`[${this.guid}]skipPushback:${skipPushback},this._hass:${this._hass},this._pushback:${this._pushback}`);
      const serializedArgs = (args && args.length && args.length > 0) ? args.map(arg => this.deepSerialize(arg, this.objByteLimit, this.objLevelLimit)) : [];
      if (serializedArgs.length > 0) {
        this._hass.callService(Globals.COMPONENT_NAME, "log", { "level": header, "origin": this.origin, "logs": serializedArgs, });
      }
    }
    
    // Give frontend logs format
    if (args && args.length && args.length > 0) {
      return [`%c[${header}][${this.origin}][${this.guid}]`, logStyle, ...args];
    }
    return [`%c[${header}][${this.origin}][${this.guid}]`, logStyle];
  }

  // ERROR: if (this.logger.isErrorEnabled()) console.error(...this.logger.error(args));
  error(...args) { return this.getArgsError(false, ...args); }
  // WARN: if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(args));
  warn(...args)  { return this.getArgsWarn(false, ...args); }
  // INFO: if (this.logger.isInfoEnabled()) console.info(...this.logger.info(args));
  info(...args)  { return this.getArgsInfo(false, ...args); }
  // DEBUG: if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(args));
  debug(...args) { return this.getArgsDebug(false, ...args); }
  // TRACE: if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(args));
  trace(...args) { return this.getArgsTrace(false, ...args); }

  getArgsError(skipPushback, ...args) { return this.getArgs(skipPushback, 'ERR', 'background: #d6a1a1; color: black; font-weight: bold;', ...args); }
  getArgsWarn(skipPushback, ...args)  { return this.getArgs(skipPushback, 'WRN', 'background: #d6c8a1; color: black; font-weight: bold;', ...args); }
  getArgsInfo(skipPushback, ...args)  { return this.getArgs(skipPushback, 'INF', 'background: #a2d6a1; color: black; font-weight: bold;', ...args); }
  getArgsDebug(skipPushback, ...args) { return this.getArgs(skipPushback, 'DBG', 'background: #75aaff; color: black; font-weight: bold;', ...args); }
  getArgsTrace(skipPushback, ...args) { return this.getArgs(skipPushback, 'TRA', 'background: #b7b8b6; color: black; font-weight: bold;', ...args); }

  logInternal(level, caller, ...args) {
    const internalLevel = this.levels[level] ?? 0;
    const internalArgs = [`[${caller}]`, ...args];
    if (this.isLevelEnabled(internalLevel)) {
      if (internalLevel === 0) { console.error(...this.getArgsError(true, ...internalArgs)); return; }
      if (internalLevel === 1) { console.warn(...this.getArgsWarn(true, ...internalArgs)); return; }
      if (internalLevel === 2) { console.info(...this.getArgsInfo(true, ...internalArgs)); return; }
      if (internalLevel === 3) { console.debug(...this.getArgsDebug(true, ...internalArgs)); return; }
      if (internalLevel === 4) { console.debug(...this.getArgsTrace(true, ...internalArgs)); return; }
    }
  }

  // Entry point
  deepSerialize(input, maxBytes, maxDepth) {
    try {
      return stringify(input); // Use Flatted to serialize
    } catch (e) {
      return '[unserializable]';
    }
  }
}
