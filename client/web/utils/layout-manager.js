import { Logger } from './logger.js';

export class LayoutManager {

  _origin;
  _layouts;
  _layoutsByNames;
  _layoutsNames;
  _attachedLayoutName;

  // Usage:
  // const layoutManager = new LayoutManager(this, layouts);
  constructor(origin, layouts) {
    this._origin = origin;
    this._layouts = layouts || {};
    this._layoutsByNames = this.constructor.getLayoutsByNames(this._layouts);
    this._layoutsNames = Array.from(this._layoutsByNames.keys());
  }

  getLogger() {
    return this._origin._logger;
  }

  getConfig() {
    return this._origin._config;
  }

  getStubConfig() {
    return this._origin.constructor.getStubConfig();
  }

  getFromConfig(configName) {
    return this.getConfig()?.[configName];
  }

  getFromDefaultConfig(configName) {
    return this.getStubConfig()[configName];
  }

  getFromConfigOrDefaultConfig(configName) {
    return this.getFromConfig(configName) || this.getFromDefaultConfig(configName);
  }

  getFontScale() {
    return this.getFromConfigOrDefaultConfig('font_scale');
  }

  getSafeFontScale() {
    return this.getScaleOrDefault(this.getFontScale(), '1rem');
  }

  getButtonsOverrides() {
    return this.getFromConfigOrDefaultConfig('buttons_overrides');
  }

  getButtonOverride(btn) {
    return this.getButtonsOverrides()[btn.id];
  }

  hasButtonOverride(btn) {
    return (btn.id && this.getButtonOverride(btn.id));
  }

  getLayoutsNames() {
    return this._layoutsNames;
  }

  getLayoutNameFromConfig() {
    return this.getFromConfig('layout');
  }

  getLayoutName() {
    return this.getFromConfigOrDefaultConfig('layout');
  }

  getLayout() {
    return this._layoutsByNames.get(this.getLayoutName());
  }

  hasLayout(layoutName) {
    return this._layoutsByNames.has(layoutName);
  }

  getAttachedLayoutName() {
    return this._attachedLayoutName;
  }
  
  setAttachedLayoutName(layoutName) {
    this._attachedLayoutName = layoutName;
  }

  checkConfiguredLayout() {
    if (this.getLayoutNameFromConfig() && !this.hasLayout(this.getLayoutNameFromConfig())) {
      throw new Error(`Unknown layout "${this.getLayoutNameFromConfig()}". Please define a known layout (${this.getLayoutsNames()}).`);
    }
  }

  resetAttachedLayout() {
    this.setAttachedLayoutName(null);
  }

  configuredLayoutAttached() {
    this.setAttachedLayoutName(this.getLayoutName());
  }

  configuredLayoutChanged() {
    return this.getLayoutName() !== this.getAttachedLayoutName();
  }

  getElementData(elt) {
    return elt?._keyData;
  }

  setElementData(elt, defaultConfig, overrideConfig, accept) {
    if (!elt._keyData) elt._keyData = {};

    // Process defaults first
    if (defaultConfig && typeof defaultConfig === 'object') {
      for (const [key, value] of Object.entries(defaultConfig)) {
        if (accept?.(key, value, 'default')) {
          elt._keyData[key] = value;
        }
      }
    }

    // Then override
    if (overrideConfig && typeof overrideConfig === 'object') {
      for (const [key, value] of Object.entries(overrideConfig)) {
        if (accept?.(key, value, 'user')) {
          elt._keyData[key] = value;
        }
      }
    }
  }

  isTouchDevice(evt) {
    return evt?.pointerType === 'touch';
  }

  forceRefresh(target) {
    target?.offsetHeight; // Force reflow
  }

  forceRefreshForTouchDevice(evt, target) {
    if (this.isTouchDevice(evt)) this.forceRefresh(target);
  }

  getScaleOrDefault(scale, defaultScale) {
    let scaleOrDefault;
    if (this.constructor.isValidScale(scale)) {
      scaleOrDefault = this.toScale(scale);
    } else {
      scaleOrDefault = defaultScale;
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`Invalid scale ${scale}, falling back to default scale ${defaultScale}`));
    }
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`getScaleOrDefault(${scale}):`, scaleOrDefault));
    return scaleOrDefault;
  }

  toScale(value) {
    let scale;
    if (this.constructor.isNumber(value) || this.constructor.isStringNumber(value)) {
      scale = value + 'rem';
    } else if (this.constructor.isRelativeUnit(value) || this.constructor.isAbsoluteUnit(value)) {
      scale = value;
    } else {
      throw new Error(`Invalid value ${value} for scale`);
    }
    return scale;
  }

  static isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  static isStringNumber(value) {
    const num = Number(value);
    return typeof num === 'number' && Number.isFinite(num);
  }

  static isRelativeUnit(value) {
    const RELATIVE_UNIT_REGEX = /^\s*\d+(\.\d+)?\s*(%|em|rem|vw|vh|vmin|vmax|svw|svh|lvw|lvh)\s*$/i;
    return typeof value === "string" && RELATIVE_UNIT_REGEX.test(value);
  }

  static isAbsoluteUnit(value) {
    const ABSOLUTE_UNIT_REGEX = /^\s*\d+(\.\d+)?\s*(px|cm|mm|in|pt|pc|ex|ch)\s*$/i;
    return typeof value === "string" && ABSOLUTE_UNIT_REGEX.test(value);
  }

  static isValidScale(value) {
    return this.isNumber(value) || this.isStringNumber(value) || this.isRelativeUnit(value) || this.isAbsoluteUnit(value);
  }

  static getLayoutsByNames(layouts) {
    const layoutsByNames = new Map();
    for (const layout of Object.values(layouts)) {
      layoutsByNames.set(layout.Name, layout);
    }
    return layoutsByNames;
  }
}
