import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';

console.info("Loading selectable-list-card");

class SelectableListCard extends HTMLElement {

  // Private constants
  _cellButtonFg = '#bfbfbf';
  _cellButtonBg = '#3a3a3a';
  _cellButtonActiveBg = '#4a4a4a';
  _cellButtonPressBg = '#6a6a6a';

  // Private properties
  _config;
  _hass;
  _elements = {};
  _items = [];
  _selectedIds = new Set();
  _listeners = [];

  constructor() {
    super();

    this._logger = new Logger(this, "android-remote-card.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, layoutsRemote);
    this._resourceManager = new ResourceManager(this, import.meta.url);

    this.doCard();
    this.doStyle();
    this.doAttach();
    this.doQueryElements();
    this.doListen();

    this.doUpdateLayout();
  }

  getLogger() {
    return this._logger;
  }

  getHass() {
    return this._hass;
  }

  setManaged(managed) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setManaged(managed):", managed));
    this._eventManager.setManaged(managed);
  }

  setUserPreferences(preferences) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setUserPreferences(preferences):", preferences));
    this._eventManager.setUserPreferences(preferences);
  }

  setConfig(config) {
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

  // jobs
  doCheckConfig() {
    this._layoutManager.checkConfiguredLayout();
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div id="main-container" class="card-content">
        <div class="wrapper">
          <div class="header hide">
            <span class="title"></span>
          </div>
          <div class="selectable-list"></div>
        </div>
      </div>
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      :host {
        --cell-button-fg: ${this._cellButtonFg};
        --cell-button-bg: ${this._cellButtonBg};
        --cell-button-active-bg: ${this._cellButtonActiveBg};
        --cell-button-press-bg: ${this._cellButtonPressBg};
        --card-border-radius: 10px;
        display: block;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        font-family: Roboto, 'Segoe UI', Tahoma, sans-serif;
        background: var(--card-background-color);
        border-radius: var(--card-border-radius);
        overflow: hidden;
      }
      ha-card {
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
      }
      .card-content {
        padding: 0 !important;
      }
      #main-container {
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
      }
      .wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        padding: 8px;
      }
      /* Header */
      .header {
        display: flex;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        padding: 4px 8px 10px;
        color: var(--cell-button-fg);
      }
      .title {
        font-size: 1rem;
        font-weight: 500;
      }
      .hide {
        display: none;
      }
      /* List */
      .selectable-list {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        gap: 4px;
      }
      /* Row */
      .selectable-list-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        gap: 10px;
        padding: 6px 8px;
        background: var(--cell-button-bg);
        color: var(--cell-button-fg);
        border: 1px solid transparent;
        border-radius: 10px;
        transition:
          background-color 0.2s ease,
          border-color 0.2s ease;
      }
      .selectable-list-row.selected {
        background: var(--cell-button-active-bg);
      }
      /* Checkbox */
      .selectable-list-checkbox {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        margin: 0;
        accent-color: var(--cell-button-fg);
        cursor: pointer;
      }
      /* Label */
      .selectable-list-name {
        flex: 1 1 0;
        min-width: 0;
        font-size: 0.9rem;
        color: var(--cell-button-fg);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        user-select: none;
      }
      /* Action buttons */
      .selectable-list-action {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 6px;
        background: var(--cell-button-bg);
        color: var(--cell-button-fg);
        border: none;
        outline: none;
        border-radius: 50%;
        cursor: pointer;
        transition:
          background-color 0.2s ease,
          transform 0.1s ease;
      }
      .selectable-list-action svg {
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
      }
      .selectable-list-action:hover {
        background: var(--cell-button-active-bg);
      }
      .selectable-list-action:active {
        background: var(--cell-button-press-bg);
        transform: scale(0.95);
      }
      .selectable-list-action.delete:hover {
        color: #ff6b6b;
      }
      .selectable-list-action:focus-visible,
      .selectable-list-checkbox:focus-visible {
        outline: 2px solid var(--cell-button-fg);
        outline-offset: 2px;
      }
      .selectable-list-empty {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        padding: 12px;
        box-sizing: border-box;
        color: var(--cell-button-fg);
        opacity: 0.6;
        font-size: 0.85rem;
      }
    `;
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(
      this._elements.style,
      this._elements.card
    );
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.wrapper = card.querySelector(".wrapper");
    this._elements.header = card.querySelector(".header");
    this._elements.title = card.querySelector(".title");
    this._elements.list = card.querySelector(".selectable-list");
  }

  doListen() {
    // Event listeners are attached to individual rows
  }

  doUpdateConfig() {
    if (!this._config) return;
    const title = this._config.title;
    if (title) {
      this._elements.header.classList.remove("hide");
      this._elements.title.textContent = title;
    } else {
      this._elements.header.classList.add("hide");
    }
    if (Array.isArray(this._config.items)) {
      this.setItems(this._config.items);
    }
  }

  doUpdateHass() {
    // Nothing to do here: no specific HA entity state to listen for this card
  }

  doUpdateLayout() {
    this.doResetLayout();
    this.doCreateLayout();
    this.doAttachLayout();
  }

  doResetLayout() {
    // Clear previous listeners
    this._eventManager.clearListeners("layoutContainer");

    // Reset rows elements (if any)
    this._elements.rows = [];

    // Reset attached layout
    this._layoutManager.resetAttachedLayout();
  }

  doCreateLayout() {

    // Mark configured layout as attached
    this._layoutManager.configuredLayoutAttached();

    // Create rows
    for (const rowConfig of this._layoutManager.getLayout().rows) {
      const row = this.doRow(rowConfig);
      this.doStyleRow();
      this.doAttachRow(row);
      this.doQueryRowElements();
      this.doListenRow();
    }

    // Setup three-states-toggle foldables
    this.setupFoldable();
  }

  setItems(items) {
    this._items = Array.isArray(items) ? items : [];
    // Keep selection only for entries that still exist
    const validIds = new Set(this._items.map(item => item.id));
    this._selectedIds = new Set(
      [...this._selectedIds].filter(id => validIds.has(id))
    );
    this.doUpdateItems();
  }

  getItems() {
    return this._items;
  }

  getSelectedItems() {
    return this._items.filter(item =>
      this._selectedIds.has(item.id)
    );
  }

  selectAll(selected = true) {
    this._selectedIds.clear();
    if (selected) {
      this._items.forEach(item => {
        this._selectedIds.add(item.id);
      });
    }
    this.doUpdateItems();
    this.fireSelectionChanged();
  }

  clearSelection() {
    this.selectAll(false);
  }

  // =========================================
  // Home Assistant card API
  // =========================================
  getCardSize() {
    return Math.max(1, this._items.length);
  }
  static getConfigElement() {
    return null;
  }
  static getStubConfig() {
    return {
      type: "custom:selectable-list-card",
      title: "Selectable list",
      items: []
    };
  }

  // =========================================
  // Events
  // =========================================

  doListenElement(element, event, callback) {
    element.addEventListener(event, callback);
    this._listeners.push(() => {
      element.removeEventListener(event, callback);
    });
  }

  // =========================================
  // Rendering
  // =========================================
  doUpdateItems() {
    const list = this._elements.list;
    list.replaceChildren();
    if (this._items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "selectable-list-empty";
      empty.textContent = "No entries";
      list.appendChild(empty);
      return;
    }
    for (const item of this._items) {
      list.appendChild(this.doCreateItem(item));
    }
  }
  doCreateItem(item) {
    const row = document.createElement("div");
    row.className = "selectable-list-row";
    row.dataset.id = item.id;
    const selected = this._selectedIds.has(item.id);
    if (selected) {
      row.classList.add("selected");
    }
    // Checkbox
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "selectable-list-checkbox";
    checkbox.checked = selected;
    this.doListenElement(checkbox, "change", () => {
      if (checkbox.checked) {
        this._selectedIds.add(item.id);
      } else {
        this._selectedIds.delete(item.id);
      }
      row.classList.toggle("selected", checkbox.checked);
      this.fireSelectionChanged();
    });
    // Name
    const name = document.createElement("span");
    name.className = "selectable-list-name";
    name.textContent = item.name ?? "";
    // Edit
    const edit = this.doCreateAction(
      "edit",
      "Edit entry",
      `
        <svg viewBox="0 0 24 24">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>
        </svg>
      `
    );
    this.doListenElement(edit, "click", () => {
      this.fireEvent("edit", item);
    });
    // Delete
    const remove = this.doCreateAction(
      "delete",
      "Delete entry",
      `
        <svg viewBox="0 0 24 24">
          <path d="M3 6h18"/>
          <path d="M8 6V4h8v2"/>
          <path d="m19 6-1 14H6L5 6"/>
          <path d="M10 11v5"/>
          <path d="M14 11v5"/>
        </svg>
      `
    );
    this.doListenElement(remove, "click", () => {
      this.fireEvent("delete", item);
    });
    row.append(
      checkbox,
      name,
      edit,
      remove
    );
    return row;
  }
  doCreateAction(action, title, html) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `selectable-list-action ${action}`;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.innerHTML = html;
    return button;
  }
  // =========================================
  // Custom events
  // =========================================
  fireEvent(type, detail = {}) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: true,
        composed: true
      })
    );
  }

  fireSelectionChanged() {
    this.fireEvent(
      "selection-changed",
      this.getSelectedItems()
    );
  }

}

if (!customElements.get("selectable-list-card")) customElements.define("selectable-list-card", SelectableListCard);
