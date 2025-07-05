// Define logger helper class
export class Logger {
  constructor(level, hass) {
    this.levels = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
    this.levelsKeys = Object.fromEntries(Object.entries(this.levels).map(([key, value]) => [value, key]));
    this._hass = hass;
    this.setLevel(level);
  }
  setLevel(level) {
    this.level = this.levels[level] ?? 0;
    console.log(`Log level set to ${level}`);
    if (this._hass) {
      const backendLevel = (!level || level === 'trace') ? 'debug' : level;
      this._hass.callService("logger", "set_level", { "custom_components.trackpad_mouse": backendLevel });
      console.log(`Log level of custom_components.trackpad_mouse set to ${backendLevel} for log level ${level}`);
    }
  }
  setHass(hass) {
    this._hass = hass;
    console.log(`Hass set to ${hass}`);
    this.setLevel(this.levelsKeys[String(this.level)]);
  }
  isLevelEnabled(level) { return (level <= this.level); }
  isErrorEnabled() { return this.isLevelEnabled(0); }
  isWarnEnabled() { return this.isLevelEnabled(1); }
  isInfoEnabled() { return this.isLevelEnabled(2); }
  isDebugEnabled() { return this.isLevelEnabled(3); }
  isTraceEnabled() { return this.isLevelEnabled(4); }
  
  getArgs(header, logStyle, ...args) {
    if (args && args.length && args.length > 0) {
      if (this._hass) {
        // Deep serialization with limit
        const serializedArgs = args.map(arg => this.deepSerialize(arg, 3000, 1));
        if (serializedArgs.length > 0) {
          this._hass.callService("trackpad_mouse", "log", { "level": header, "logs": serializedArgs, });
        }
      }
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
  deepSerialize(input, maxBytes = Infinity, maxDepth = Infinity) {
    const seen = new WeakSet();
  
    // Step 1: Serialize only up to maxDepth
    const full = this.internalSerialize(input, seen, 0, maxDepth);
  
    // Step 2: Check size and prune if needed
    let json = JSON.stringify(full);
    if (json.length <= maxBytes) return full;
  
    return this.pruneToFit(full, maxBytes);
  }
  
  // Internal deep serialization (bounded by maxDepth)
  internalSerialize(input, seen = new WeakSet(), currentDepth = 0, maxDepth = Infinity) {
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
