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

function patchAncestors(startNode, patches) {
  let node = startNode;
  const applied = new Set();

  while (node) {
    for (const { tag, fn } of patches) {
      if (!applied.has(tag) && node.tagName?.toLowerCase() === tag.toLowerCase()) {
        fn(node);
        node.requestUpdate?.();
        console.debug(`[Valetudo] ${tag} patch applied`);
        applied.add(tag);
      }
    }

    if (applied.size === patches.length) break;

    node =
      node.parentNode ||
      node.host ||
      (node.getRootNode && node.getRootNode().host);
  }

  // log missing ones
  for (const { tag } of patches) {
    if (!applied.has(tag)) {
      console.debug(`[Valetudo] ${tag} patch NOT applied`);
    }
  }
}

// Patch HA's ha-more-info-info safely
customElements.whenDefined("ha-more-info-info").then(() => {
  const moreInfoDialog = customElements.get("ha-more-info-info");
  if (!moreInfoDialog) return;

  if (moreInfoDialog.prototype[Globals.COMPONENT_PATCH_KEY]) return;
  moreInfoDialog.prototype[Globals.COMPONENT_PATCH_KEY] = true;

  const originalRender = moreInfoDialog.prototype.render;

  moreInfoDialog.prototype.render = function () {
    try {
      const entityId = this.entityId;
      const entityConfig = Globals.getSideLoadedPayload(this.hass, "more-info-config");

      //if (entityId && entityId.startsWith("vacuum.") && integration === "valetudo") {
      if (entityId && entityId.startsWith("vacuum.")) {
        console.debug("[Valetudo] ha-more-info-info patch", { entityId, entityConfig });

        const result = this.html`
          <more-info-valetudo-dialog
            .config=${entityConfig}
            .hass=${this.hass}
            .entityId=${entityId}>
          </more-info-valetudo-dialog>
        `;
        
        // run AFTER DOM is updated: 
        // patch parent ha-adaptive-dialog to prevent swipe-down gesture
        this.updateComplete?.then(() => {
          const el = this.renderRoot?.querySelector("more-info-valetudo-dialog");
          if (!el) return;
        
          patchAncestors(el, [
            {
              tag: "ha-adaptive-dialog",
              fn: (n) => { n.preventScrimClose = true; }
            },
            {
              tag: "ha-bottom-sheet",
              fn: (n) => { n.preventScrimClose = true; }
            }
          ]);
        });
        
        return result;
      }
      
    } catch (e) {
      console.error("[Valetudo] ha-more-info-info patch error", e);
    }

    return originalRender?.call(this);
  };
});