import { Logger } from './logger.js';

export class ResourceManager {

  _importMetaUrl;
  _origin;
  _layouts;
  _layoutsByNames;
  _layoutsNames;
  _attachedLayoutName;

  // Usage:
  // const resources_manager = new ResourceManager(this, import.meta.url, layouts);
  constructor(origin, importMetaUrl, layouts) {
    this._origin = origin;
    this._importMetaUrl = importMetaUrl;
    this._layouts = layouts || {};
    this._layoutsByNames = this.constructor.getLayoutsByNames(this._layouts);
    this._layoutsNames = Array.from(this._layoutsByNames.keys());
  }

  getLogger() {
    return this._origin._logger;
  }

  getHass() {
    return this._origin._hass;
  }

  getConfig() {
    return this._origin._config;
  }

  getStubConfig() {
    return this._origin.constructor.getStubConfig();
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

  getVersion() {
    const scriptUrl = getCurrentScriptUrl(this.getLogger(), this.importMetaUrl);
    const version = scriptUrl ? getVersionFromUrl(this.getLogger(), scriptUrl) : null;
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Current web-browser loaded resources version is ${version}`));
    return version;
  }
  
  forceRefresh() {
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now()); // Add or replace the 'v' parameter
    window.location.href = url.toString(); // Reload with the updated URL
  }
  
  synchronizeResources() {
    hass.connection.sendMessagePromise({
      type: `${Globals.COMPONENT_NAME}/${name}`
    })
    this.eventManager.callComponentCommand('sync_resources').then((response) => {
      // Success handler
      const { resourcesVersion } = response;
      if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("resourcesVersion:", resourcesVersion));

      const uiResourcesVersion = this.getVersion();
      if (!resourcesVersion) {
        if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("Cannot get component resources version (assuming UI up-to-date, HA down?):", uiResourcesVersion));
      } else {
        if (uiResourcesVersion === resourcesVersion) {
          if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Resources versions matches (UI up-to-date):", resourcesVersion));
        } else {
          // Force refresh browser to reflect UI resources new version
          if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Resources versions different (UI out-dated version, component version):", uiResourcesVersion, resourcesVersion));
          this.forceRefresh();
        }
      }
    })
    .catch((err) => {
      if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error("Failed to retrieve resourcesVersion:", err));
    });
  }

  getCurrentScriptUrl(contextUrl) {
    if (logger.isTraceEnabled()) console.debug(...logger.trace("getCurrentScriptUrl(contextUrl)", contextUrl));
    if (contextUrl) {
      const script_url = contextUrl;
      if (logger.isTraceEnabled()) console.debug(...logger.trace("Script URL is context URL:", script_url));
      return script_url;
    }
  
    if (document.currentScript?.src) {
      const script_url = document.currentScript.src;
      if (logger.isTraceEnabled()) console.debug(...logger.trace("Script URL is document current script URL:", script_url));
      return script_url;
    }
  
    const scripts = Array.from(document.getElementsByTagName('script')).filter((script) => script.src);
    if (scripts.length > 0) {
      const script_tag_index = scripts.length - 1;
      const script_url = scripts[script_tag_index].src;
      if (logger.isTraceEnabled()) console.debug(...logger.trace(`Script URL is script tag src URL at index ${script_tag_index}:`, script_url));
      return script_url;
    }
    
    if (logger.isWarnEnabled()) console.warn(...logger.warn("Unable to determine script URL (contextUrl):", contextUrl));
    return null;
  }
  
  getVersionFromUrl(url) {
    try {
      const parsedUrl = new URL(url, window.location.origin); // Handle relative or absolute URLs
      return parsedUrl.searchParams.get('v');
    } catch (e) {
      if (logger.isWarnEnabled()) console.warn(...logger.warn("Unable to get version from URL (url):", url, e));
      return null;
    }
  }

  static getLayoutsByNames(layouts) {
    const layoutsByNames = new Map();
    for (const layout of Object.values(layouts)) {
      layoutsByNames.set(layout.Name, layout);
    }
    return layoutsByNames;
  }
}
