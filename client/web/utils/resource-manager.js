import { Logger } from './logger.js';

export class ResourceManager {

  _importMetaUrl;
  _origin;

  // Usage:
  // const resourceManager = new ResourceManager(this, import.meta.url);
  constructor(origin, importMetaUrl, layouts) {
    this._origin = origin;
    this._importMetaUrl = importMetaUrl;
  }

  getLogger() {
    return this._origin._logger;
  }

  getHass() {
    return this._origin._hass;
  }

  forceRefresh() {
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now()); // Add or replace the 'v' parameter
    window.location.href = url.toString(); // Reload with the updated URL
  }

  synchronizeResources() {
    this.getHass().connection.sendMessagePromise({ type: `${Globals.COMPONENT_NAME}/sync_resources` }).then((response) => {
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

  getVersion() {
    const scriptUrl = this.getCurrentScriptUrl(this._importMetaUrl);
    const version = scriptUrl ? this.getVersionFromUrl(scriptUrl) : null;
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Current web-browser loaded resources version is ${version}`));
    return version;
  }

  getCurrentScriptUrl(contextUrl) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("getCurrentScriptUrl(contextUrl)", contextUrl));
    if (contextUrl) {
      const script_url = contextUrl;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Script URL is context URL:", script_url));
      return script_url;
    }
  
    if (document.currentScript?.src) {
      const script_url = document.currentScript.src;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Script URL is document current script URL:", script_url));
      return script_url;
    }
  
    const scripts = Array.from(document.getElementsByTagName('script')).filter((script) => script.src);
    if (scripts.length > 0) {
      const script_tag_index = scripts.length - 1;
      const script_url = scripts[script_tag_index].src;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Script URL is script tag src URL at index ${script_tag_index}:`, script_url));
      return script_url;
    }
    
    if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("Unable to determine script URL (contextUrl):", contextUrl));
    return null;
  }

  getVersionFromUrl(url) {
    try {
      const parsedUrl = new URL(url, window.location.origin); // Handle relative or absolute URLs
      return parsedUrl.searchParams.get('v');
    } catch (e) {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("Unable to get version from URL (url):", url, e));
      return null;
    }
  }
}
