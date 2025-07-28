import { Globals } from './utils/globals.js';

// Define logger helper class
export class Logger {
  constructor(level, hass, pushback) {
    this.levels = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
    this.levelsKeys = Object.fromEntries(Object.entries(this.levels).map(([key, value]) => [value, key]));
    this._hass = hass;
    this.setPushback(pushback);
    this.setLevel(level);
    this.objLevelLimit = 1;
    this.objByteLimit = 3000;
  }
  setLevel(level) {
    this.level = this.levels[level] ?? 0;
    console.log(`Log level set to ${level}`);
    this.setPushback(this._pushback);
  }
  setPushback(pushback) {
    this._pushback = pushback;
    if (this._hass && this._pushback) {
      this._hass.callService("logger", "set_level", { `custom_components.${Globals.COMPONENT_NAME}`: 'debug' });
      console.log(`Log level of custom_components.${Globals.COMPONENT_NAME} set to debug`);
    }
  }
  setHass(hass) {
    this._hass = hass;
    console.log(`Hass set to ${hass}`);
    this.setPushback(this._pushback);
  }
  isLevelEnabled(level) { return (level <= this.level); }
  isErrorEnabled() { return this.isLevelEnabled(0); }
  isWarnEnabled() { return this.isLevelEnabled(1); }
  isInfoEnabled() { return this.isLevelEnabled(2); }
  isDebugEnabled() { return this.isLevelEnabled(3); }
  isTraceEnabled() { return this.isLevelEnabled(4); }
  
  getArgs(header, logStyle, ...args) {
    // Push logs to backend when needed
    if (this._hass && this._pushback) {
      const serializedArgs = (args && args.length && args.length > 0) ? args.map(arg => this.deepSerialize(arg, this.objByteLimit, this.objLevelLimit)) : [];
      if (serializedArgs.length > 0) {
        this._hass.callService(Globals.COMPONENT_NAME, "log", { "level": header, "logs": serializedArgs, });
      }
    }
    
    // Give frontend logs format
    if (args && args.length && args.length > 0) {
      return [`%c[${header}]`, logStyle, ...args];
    }
    return [`%c[${header}]`, logStyle];
  }

  // ERROR: if (this.logger.isErrorEnabled()) console.error(...this.logger.error(args));
  error(...args) { return this.getArgs('ERR', 'background: #d6a1a1; color: black; font-weight: bold;', ...args); }
  // WARN: if (this.logger.isWarnEnabled()) console.warn(...this.logger.warn(args));
  warn(...args)  { return this.getArgs('WRN', 'background: #d6c8a1; color: black; font-weight: bold;', ...args); }
  // INFO: if (this.logger.isInfoEnabled()) console.info(...this.logger.info(args));
  info(...args)  { return this.getArgs('INF', 'background: #a2d6a1; color: black; font-weight: bold;', ...args); }
  // DEBUG: if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(args));
  debug(...args) { return this.getArgs('DBG', 'background: #75aaff; color: black; font-weight: bold;', ...args); }
  // TRACE: if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace(args));
  trace(...args) { return this.getArgs('TRA', 'background: #b7b8b6; color: black; font-weight: bold;', ...args); }
  
  // Entry point
  deepSerialize(input, maxBytes, maxDepth) {
    const seen = new WeakSet();
  
    // Step 1: Serialize only up to maxDepth
    const full = this.internalSerialize(input, seen, 0, maxDepth);
  
    // Step 2: Check size and prune if needed
    let json = JSON.stringify(full);
    if (json.length <= maxBytes) return full;
  
    return this.pruneToFit(full, maxBytes);
  }
  
  // Internal deep serialization (bounded by maxDepth)
  internalSerialize(input, seen = new WeakSet(), currentDepth = 0, maxDepth) {
    if (
      input === null ||
      typeof input !== "object" ||
      input instanceof Date ||
      input instanceof RegExp
    ) {
      return input;
    }
  
    if (seen.has(input)) return "[Circular]";
    seen.add(input);
  
    const tag = Object.prototype.toString.call(input);
    const forbidden = [];
    if (forbidden.includes(tag)) {
      return `[uncloneable: ${tag}]`;
    }
  
    if (currentDepth >= maxDepth) return "[truncated]";
  
    if (Array.isArray(input)) {
      return input.map(item =>
        this.internalSerialize(item, seen, currentDepth + 1, maxDepth)
      );
    }
  
    const result = {};
    let current = input;
  
    while (current && current !== Object.prototype) {
      for (const key of Object.getOwnPropertyNames(current)) {
        if (key in result) continue;
        try {
          const value = input[key];
          if (typeof value === "function") continue;
          result[key] = this.internalSerialize(value, seen, currentDepth + 1, maxDepth);
        } catch (err) {
          result[key] = `[unreadable: ${err.message}]`;
        }
      }
      current = Object.getPrototypeOf(current);
    }
  
    return result;
  }
  
  // Byte-limit fallback
  pruneToFit(obj, maxBytes) {
    const clone = JSON.parse(JSON.stringify(obj)); // already serialized safely
    let json = JSON.stringify(clone);
  
    if (json.length <= maxBytes) return clone;
  
    while (json.length > maxBytes) {
      this.pruneOneLevel(clone);
      json = JSON.stringify(clone);
    }
  
    return clone;
  }
  
  // Prune objects one level deeper
  pruneOneLevel(obj) {
    if (typeof obj !== "object" || obj === null) return;
  
    for (const key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        obj[key] = "[pruned]";
      }
    }
  }

}
