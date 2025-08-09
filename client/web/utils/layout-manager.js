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

  getButtonsOverrides() {
    return this.getConfig()?.['buttons_overrides'] || this.getStubConfig()['buttons_overrides'];
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

  getConfiguredLayoutName() {
    return this.getConfig()?.['layout'];
  }

  getLayoutName() {
    return this.getConfiguredLayoutName() || this.getStubConfig()['layout'];
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
    if (this.getConfiguredLayoutName() && !this.hasLayout(this.getConfiguredLayoutName())) {
      throw new Error(`Unknown layout "${this.getConfiguredLayoutName()}". Please define a known layout (${this.getLayoutsNames()}).`);
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

  static getLayoutsByNames(layouts) {
    const layoutsByNames = new Map();
    for (const layout of Object.values(layouts)) {
      layoutsByNames.set(layout.Name, layout);
    }
    return layoutsByNames;
  }
}
