import { Globals } from './globals.js';

// Define logger helper class
export class Logger {
  constructor(origin, level, hass, pushback) {
    this.origin = origin;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
    this.levelsKeys = Object.fromEntries(Object.entries(this.levels).map(([key, value]) => [value, key]));
    this.update(level, hass, pushback);
    this.objLevelLimit = 1;
    this.objByteLimit = 3000;
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
    if (!this.level || newLevel !== this.level) {
      this.level = newLevel;
      this.logInternal("debug", "setLevel", `Log level of frontend ${this.origin} set to ${level}`);
    }
  }
  setPushback(pushback) {
    if (!this._pushback || pushback !== this._pushback) {
      this._pushback = pushback;
      this._pushbackSetupNeeded = pushback;
    }
    if (this._pushbackSetupNeeded && this._hass && this._pushback) {
      this._hass.callService("logger", "set_level", { [`custom_components.${Globals.COMPONENT_NAME}`]: 'debug' });
      this._pushbackSetupNeeded = false;
      this.logInternal("debug", "setPushback", `Log level of backend ${Globals.COMPONENT_NAME} component set to debug`);
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
      console.log("GET_ARGS", ...args);
      const serializedArgs = (args && args.length && args.length > 0) ? args.map(arg => this.deepSerialize(arg, this.objByteLimit, this.objLevelLimit)) : [];
      if (serializedArgs.length > 0) {
        this._hass.callService(Globals.COMPONENT_NAME, "log", { "level": header, "origin": this.origin, "logs": serializedArgs, });
      }
    }
    
    // Give frontend logs format
    if (args && args.length && args.length > 0) {
      return [`%c[${header}][${this.origin}]`, logStyle, ...args];
    }
    return [`%c[${header}][${this.origin}]`, logStyle];
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
