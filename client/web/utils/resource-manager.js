import { Logger } from './logger.js';

function getCurrentScriptUrl(logger, contextUrl) {
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

function getVersionFromUrl(logger, url) {
  try {
    const parsedUrl = new URL(url, window.location.origin); // Handle relative or absolute URLs
    return parsedUrl.searchParams.get('v');
  } catch (e) {
    if (logger.isWarnEnabled()) console.warn(...logger.warn("Unable to get version from URL (url):", url, e));
    return null;
  }
}

export class ResourceManager {
  
  // Usage:
  // const resources_manager = new ResourceManager(logger, import.meta.url);
  constructor(logger, contextUrl) {
    this.setLogger(logger);
    this.contextUrl = contextUrl;
  }

  setLogger(logger) {
    this.logger = logger;
  }

  getVersion() {
    const scriptUrl = getCurrentScriptUrl(this.logger, this.contextUrl);
    const version = scriptUrl ? getVersionFromUrl(this.logger, scriptUrl) : null;
    if (this.logger.isDebugEnabled()) console.debug(...this.logger.debug(`Current web-browser loaded resources version is ${version}`));
    return version;
  }
  
  forceRefresh() {
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now()); // Add or replace the 'v' parameter
    window.location.href = url.toString(); // Reload with the updated URL
  }
}
