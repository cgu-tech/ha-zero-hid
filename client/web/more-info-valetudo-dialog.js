import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';
import { ValetudoMapCard } from './libs/valetudo-map-card.js';

console.info("Loading more-info-valetudo-dialog");

class MoreInfoValetudoDialog extends HTMLElement {

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;

  _entityId;

  constructor() {
    super();

    this._logger = new Logger(this, "more-info-valetudo-dialog.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, {});
    this._resourceManager = new ResourceManager(this, import.meta.url);

    this.doCard();
    this.doStyle();
    this.doAttach();
    this.doQueryElements();
    this.doListen();
  }

  getLogger() {
    return this._logger;
  }

  setManaged(managed) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setManaged(managed):", managed));
    this._eventManager.setManaged(managed);
  }

  setUserPreferences(preferences) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setUserPreferences(preferences):", preferences));
    this._eventManager.setUserPreferences(preferences);
  }

  // Injectable reactive property
  set config(config) {
    this.setConfig(config);
  }

  setConfig(config) {
    if (this.deepEqual(this._config, config)) return; // debounce same config
    if (this._config?.type !== config?.type) this.updateContent(config?.type); // Update content when needed
    this._config = config;
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set setConfig(config):", config));
    if (this.getLogger().isDebugEnabled()) this.getLogger().doLogOnError(this.doSetConfig.bind(this)); else this.doSetConfig();
  }
  doSetConfig() {
    this.doCheckConfig();
    this.doUpdateConfig();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass();
    this._eventManager.hassCallback();
  }

  set entityId(entityId) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set entityId(entityId):", entityId));
    this._entityId = entityId;
  }

  connectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("connectedCallback()"));
    this._eventManager.connectedCallback();
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this._eventManager.disconnectedCallback();
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  updateContent(contentType) {    
    // Remove previous content element (when existing)
    this.getContent()?.remove?.();

    // Determine new content element
    const newContentType = contentType ?? "span"; // Default to span when empty content-type
    const newContent = newContentType.includes(":") ? newContentType.split(":")[1] : newContentType;

    // Create new content element
    this._elements.content = document.createElement(newContent);
    this.getWrapper().appendChild(this.getContent());
  }
  
  getWrapper() {
    return this._elements.wrapper;
  }

  getContent() {
    return this._elements.content;
  }

  // jobs
  doCheckConfig() {
    this._layoutManager.checkConfiguredLayout();
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div id="main-container">
        <div class="wrapper">
        </div>
      </div>
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      :host {
        --card-border-radius: 10px;
        --base-font-size: 1rem;
        --ha-card-border-width: 0px;
        display: flex;
        flex-direction: column;
        max-width: 100%;
        background: var(--card-background-color);
        border-radius: 0 0 var(--card-border-radius) var(--card-border-radius);
        overflow: visible;
        font-family: Roboto, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: var(--base-font-size);
      }
      ha-card {
        display: flex;
        flex-direction: column;
        overflow: visible;
        height: 100%;
        min-height: 0;
      }
      #main-container {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
      }
      .wrapper {
        flex: 1 1 auto;
        overflow: visible;
        min-height: 0;
      }
    `;
  }

  doAttach() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.wrapper = card.querySelector(".wrapper");
  }

  doListen() {
    // Nothing to do here: events are listened per sub-element
  }

  doUpdateHass() {
    // Update content hass
    if (this.getContent()) this.getContent().hass = this._hass;
  }

  doUpdateConfig() {
    // Update content config
    this.getContent()?.setConfig?.(this._config);
  }

  static getStubConfig() {
      return {}
  }

  getCardSize() {
    return 4;
  }
  
  deepEqual(a, b) {
    // Same reference or primitive equality
    if (a === b) return true;
  
    // Handle null / non-objects
    if (typeof a !== "object" || a === null ||
        typeof b !== "object" || b === null) {
      return false;
    }
  
    // Arrays check
    if (Array.isArray(a) !== Array.isArray(b)) return false;
  
    // Keys length
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
  
    if (keysA.length !== keysB.length) return false;
  
    // Check every key
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) {
        return false;
      }
  
      if (!this.deepEqual(a[key], b[key])) {
        return false;
      }
    }
  
    return true;
  }
}

// Ensure your dialog class is defined
if (!customElements.get("more-info-valetudo-dialog")) customElements.define("more-info-valetudo-dialog", MoreInfoValetudoDialog);

// Watchdogs to avoid re-patching redundantly already patched functions
const watchdogMoreInfoEvent = `${Globals.COMPONENT_PATCH_KEY}_hass-more-info`;
const watchdogMoreInfoInfoDialog = `${Globals.COMPONENT_PATCH_KEY}_ha-more-info-info`;

// Retrieve shared global component store
const _componentsStore = window[Globals.COMPONENT_PATCH_KEY]
  || (window[Globals.COMPONENT_PATCH_KEY] = {});

// Retrieve shared global custom dialog component elements
const _component = _componentsStore["more-info-custom-dialog"]
  || (_componentsStore["more-info-custom-dialog"] = {});

const _componentConfig = _component["_config"]
  || (_component["_config"] = {});

const _componentLogger = _component["_logger"]
  || (_component["_logger"] = new Logger(_component, "more-info-valetudo-dialog.js"));

const _componentContextes = _component["_contextes"]
  || (_component["_contextes"] = new Map());

// Setup shared global configs
_componentConfig["log_level"] = "trace";

/*************/
/*  HELPERS  */
/*************/

// Starting from "startNode", walk-up into DOM ancestors nodes then :
//  - when patch element "tag" matches current ancestor tag
//  - apply patch function "fn" and tries to update lit element calling "requestUpdate"
function patchAncestors(patchName, startNode, patches) {
  let node = startNode;
  const applied = new Set();

  while (node) {
    for (const { tag, fn } of patches) {
      if (!applied.has(tag) && node.tagName?.toLowerCase() === tag.toLowerCase()) {
        fn(node);
        node.requestUpdate?.();
        if (_componentLogger.isDebugEnabled()) console.debug(..._componentLogger.debug(`patchAncestors(patchName, startNode, patches): ${patchName} applied on ${tag}`, patchName, startNode, patches));
        applied.add(tag);
      }
    }

    if (applied.size === patches.length) break;

    node =
      node.parentNode ||
      node.host ||
      node.getRootNode?.().host;
  }

  // log missing ones
  for (const { tag } of patches) {
    if (!applied.has(tag)) {
      if (_componentLogger.isDebugEnabled()) console.debug(..._componentLogger.debug(`patchAncestors(patchName, startNode, patches): ${patchName} NOT applied on ${tag}`, patchName, startNode, patches));
    }
  }
}


/*************/
/*  PATCHES  */
/*************/

// Store custom dialog contextes as soon as they arrive 
function setupComponentContextes() {
  if (window[watchdogMoreInfoEvent]) return;
  window[watchdogMoreInfoEvent] = true;

  // Hook to hass-more-info Event
  document.addEventListener("hass-more-info", (evt) => {

    // Update custom dialog store with event and entity context
    _componentContextes.set(
      evt.detail.entityId, {
        source: evt.composedPath?.()[0],
        detail: evt.detail,
        ts: Date.now()
      }
    );
  });
}

// Patch ha-more-info-info Dialog
customElements.whenDefined("ha-more-info-info").then(() => {
  const moreInfoInfo = customElements.get("ha-more-info-info");
  if (!moreInfoInfo || moreInfoInfo.prototype[watchdogMoreInfoInfoDialog]) return;
  moreInfoInfo.prototype[watchdogMoreInfoInfoDialog] = true;

  // Path ha-more-info-info.render()
  if (_componentLogger.isDebugEnabled()) console.debug(..._componentLogger.debug(`customElements.whenDefined("ha-more-info-info").then(): patching ha-more-info-info.render()`));
  const originalRender = moreInfoInfo.prototype.render;
  moreInfoInfo.prototype.render = function () {
    const entityId = this.entityId;
    try {
      // Retrieve dialog invocation context
      const eventCtx = _componentContextes.get(this.entityId);
      
      // Custom dialog render
      const customDialog = eventCtx?.detail?.["customDialog"];
      if (customDialog) {
        const entityConfig = customDialog["entityConfig"] ?? {};
        if (_componentLogger.isTraceEnabled()) console.debug(..._componentLogger.trace(`moreInfoInfo.prototype.render(): rendering custom dialog for entity ${entityId}`, entityConfig));

        const result = this.html`
          <more-info-valetudo-dialog
            .config=${entityConfig}
            .hass=${this.hass}
            .entityId=${entityId}>
          </more-info-valetudo-dialog>
        `;

        // Handle disabling "swipe to close" behavior when required
        // enabled by default in HA 2026 mobile version of the HA Dialog ("ha-bottom-sheet" adaptive dialog)
        //
        // This is particularly usefull to prevent this default behavior to mess with other gestures inside 
        // custom rendered elements (like scroll, pan, zoom)
        const swipeToClose = !!(customDialog["swipeToClose"]);
        if (!swipeToClose) {
          if (_componentLogger.isTraceEnabled()) console.debug(..._componentLogger.trace(`moreInfoInfo.prototype.render(): scheduling updateComplete hook for entity ${entityId}`, entityConfig));
            
          // Hook after Dialog DOM initialization
          this.updateComplete?.then(() => {
            if (_componentLogger.isTraceEnabled()) console.debug(..._componentLogger.trace(`moreInfoInfo.prototype.render(): disabling swipe-to-close gesture on dialog`));
            
            // Retrieve child dialog element
            const dialogCommonChild = this.renderRoot?.querySelector("more-info-valetudo-dialog");
            if (!dialogCommonChild) return;

            // Walk-up into DOM ancestors and patch first ancestor of both types (when available)
            // Note: "preventScrimClose" is reverse "swipeToClose"
            patchAncestors("disable swipe-to-close", dialogCommonChild,[
              {
                tag: "ha-adaptive-dialog",
                fn: (dialogElt) => { dialogElt.preventScrimClose = false; }
              },
              {
                tag: "ha-bottom-sheet",
                fn: (dialogElt) => { dialogElt.preventScrimClose = false; }
              }
            ]
            );
          });
        }
        return result;
      }
      
    } catch (err) {
      if (_componentLogger.isErrorEnabled()) console.error(..._componentLogger.error(`moreInfoInfo.prototype.render(): error while rendering custom dialog for entity ${entityId}`, entityConfig, err));
    }

    // Standard dialog render
    if (_componentLogger.isTraceEnabled()) console.debug(..._componentLogger.trace(`moreInfoInfo.prototype.render(): calling native render() for entity ${entityId}`));
    return originalRender?.call(this);
  };
  
  // Path ha-more-info-info.updated(changedProps)
  if (_componentLogger.isDebugEnabled()) console.debug(..._componentLogger.debug(`customElements.whenDefined("ha-more-info-info").then(): patching ha-more-info-info.updated(changedProps)`));
  const originalUpdated = moreInfoInfo.prototype.updated;
  moreInfoInfo.prototype.updated = function (changedProps) {
    const entityId = this.entityId;
    try {
      // detect entity change
      if (changedProps.has("entityId")) {
        const prevEntityId = changedProps.get("entityId");
        const currentEntityId = this.entityId;

        // cleanup previous context
        if (prevEntityId && prevEntityId !== currentEntityId) {
          if (_componentLogger.isTraceEnabled()) console.debug(..._componentLogger.trace(`moreInfoInfo.prototype.updated(changedProps): entity changed, cleaning previous entity context (prevEntityId: ${prevEntityId}, currentEntityId: ${currentEntityId})`, changedProps));
          _componentContextes.delete(prevEntityId);
        }

        // Cleanup when closing dialog
        if (!currentEntityId && prevEntityId) {
          if (_componentLogger.isTraceEnabled()) console.debug(..._componentLogger.trace(`moreInfoInfo.prototype.updated(changedProps): dialog closed, cleaning previous entity context (prevEntityId: ${prevEntityId})`, changedProps));
          _componentContextes.delete(prevEntityId);
        }
      }
    } catch (e) {
      if (_componentLogger.isErrorEnabled()) console.error(..._componentLogger.error(`moreInfoInfo.prototype.updated(changedProps): error while updating custom dialog for entity ${entityId}`, changedProps, err));
    }

    // Standard dialog updated
    if (_componentLogger.isTraceEnabled()) console.debug(..._componentLogger.trace(`moreInfoInfo.prototype.updated(changedProps): calling native updated(changedProps) for entity ${entityId}`, changedProps));
    originalUpdated?.call(this, changedProps);
  };
});

(() => {
  setupComponentContextes();
})();