import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';
import { androidRemoteCardConfig } from './configs/android-remote-card-config.js';
import * as layoutsRemote from './layouts/remote/index.js';

// <ha_resources_version> dynamically injected at install time
import { AndroidKeyboardCard } from './android-keyboard-card.js?v=<ha_resources_version>';
import { TrackpadCard } from './trackpad-card.js?v=<ha_resources_version>';
import { CarrouselCard } from './carrousel-card.js?v=<ha_resources_version>';

console.info("Loading android-remote-card");

class AndroidRemoteCard extends HTMLElement {

  // private constants
  _defaultCellConfigs = androidRemoteCardConfig;
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();
  _allowedClickableData = new Set(['code']);
  _cellButtonFg = '#bfbfbf';
  _cellButtonBg = '#3a3a3a';
  _sideCellButtonFg = '#bfbfbf';
  _sideCellButtonBg = '#3a3a3a';
  _cellButtonActiveBg = '#4a4a4a';
  _cellButtonPressBg = '#6a6a6a';
  _OVERRIDE_NORMAL_MODE = 'normal_mode';
  _OVERRIDE_ALTERNATIVE_MODE = 'alt_mode';
  _OVERRIDE_SWITCH_SIDE_PANEL = 'switch_side';
  _OVERRIDE_TYPE_SHORT_PRESS = 'short_press';
  _OVERRIDE_TYPE_LONG_PRESS = 'long_press';
  _OVERRIDE_SAME = 'same';

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;
  _dynamicStyleNames = new Set();
  _pressedModifiers = new Set();
  _pressedKeys = new Set();
  _pressedConsumers = new Set();
  _threeStatesToggleState;
  _overrideMode = this._OVERRIDE_NORMAL_MODE;
  _overrideLongPressTimeouts = new Map();
  _sidePanelVisible = false;

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

  setConfig(config) {
    this._config = config;
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set setConfig(config):", config));
    if (this.getLogger().isDebugEnabled()) this.getLogger().doLogOnError(this.doSetConfig.bind(this)); else this.doSetConfig();
  }
  doSetConfig() {
    this.doCheckConfig();
    this.doUpdateConfig();
    this.doUpdateFoldablesConfig();
    this.doUpdateSidesConfig();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass();
    this.doUpdateFoldablesHass();
    this.doUpdateSidesHass();
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

  getKeyboardConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("keyboard");
  }

  getTrackpadConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trackpad");
  }

  getActivitiesConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("activities");
  }
  
  getAddonsConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("addons");
  }

  getTriggerLongClickDelay() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_click_delay");
  }

  getKeyboard() {
    return this._elements.foldables.keyboard;
  }

  getTrackpad() {
    return this._elements.foldables.trackpad;
  }

  getActivities() {
    return this._elements.foldables.activities;
  }
  
  getAddons() {
    return this._elements.sides.addons;
  }

  getFoldableChild() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("getFoldableChild() + _threeStatesToggleState:", this._threeStatesToggleState));
    if (this._threeStatesToggleState === 0) return this.getKeyboard();
    if (this._threeStatesToggleState === 1) return this.getActivities();
    if (this._threeStatesToggleState === 2) return this.getTrackpad();
    if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`getFoldableChild(): invalid _threeStatesToggleState ${this._threeStatesToggleState} (cannot map it to a foldable child)`));
    return null;
  }

  createFoldableContent() {
    this._elements.foldables = {};
    this._elements.foldables.keyboard = document.createElement("android-keyboard-card");
    this._elements.foldables.trackpad = document.createElement("trackpad-card");
    this._elements.foldables.activities = document.createElement("carrousel-card");
  }

  createSidesContent() {
    this._elements.sides = {};
    this._elements.sides.addons = document.createElement("carrousel-card");
    this._elements.sides.addons.setOrientation(CarrouselCard._ORIENTATION_VERTICAL);
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
        </div>
        <div class="side-wrapper hide">
          <div class="cell side-span">
            <button class="side-circle-button">01</button>
            <button class="side-circle-button">02</button>
            <button class="side-circle-button">03</button>
            <button class="side-circle-button">04</button>
            <button class="side-circle-button">05</button>
            <button class="side-circle-button">06</button>
            <button class="side-circle-button">07</button>
            <button class="side-circle-button">08</button>
            <button class="side-circle-button">09</button>
            <button class="side-circle-button bottom">10</button>
          </div>
        </div>
      </div>
    `;

    this.createFoldableContent();
    this.createSidesContent();
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      :host {
        --cell-button-fg: ${this._cellButtonFg};
        --cell-button-bg: ${this._cellButtonBg};
        --cell-button-active-bg: ${this._cellButtonActiveBg};
        --cell-button-press-bg: ${this._cellButtonPressBg};
        --cell-button-locked-bg: #0073e6; /* blue */
        --cell-button-locked-active-bg: #3399ff; /* blue */
        --cell-button-locked-press-bg: #80bfff; /* lighter blue */
        --cell-sensor-on-fg: #ffc107;
        --side-cell-button-bg: ${this._sideCellButtonBg};
        --side-cell-button-fg: ${this._sideCellButtonFg};
        --card-border-radius: 10px;
        display: block;
        box-sizing: border-box;
        max-width: 100%;
        background: var(--card-background-color);
        border-radius: var(--card-border-radius);
        overflow: hidden; /* prevent overflow outside card */
        font-family: sans-serif;
      }
      .card-content {
        padding: 0 !important;
      }
      #main-container {
        --base-font-size: 1rem; /* base scaling unit */
        font-size: var(--base-font-size);
        font-family: Roboto, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        max-width: 100%;
        flex-shrink: 1; /* allow shrinking */
        min-width: 0;   /* allow content to shrink inside */
        display: flex;
        flex-direction: row;
      }
      .wrapper {
        display: flex;
        flex-direction: column;
        flex: 5 1 0%; /* Allow growing and shrinking */
        min-width: 0;
      }
      .side-wrapper {
        border: 1px solid var(--cell-button-bg);
        border-radius: var(--card-border-radius);
        display: flex;
        flex-direction: column;
        flex: 1 1 0%; /* Allow growing and shrinking */
        min-width: 0;
      }
      .hide {
        display: none;
      }
      .side-span {
        flex: 1 1 auto; /* Allow growing and shrinking */
      }
      .side-circle-button {
        width: 100%;  /* maintain aspect ratio */
        flex: 1 1 0;
        aspect-ratio: 1 / 1;
        background-color: var(--side-cell-button-bg);
        color: var(--side-cell-button-fg);
        border: none;
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        font-size: clamp(1px, 4vw, 24px);
        transition: background-color 0.2s ease;
        align-items: center;
        justify-content: center;
        display: flex;
        border-radius: 50%;
        margin-bottom: 4px;
      }
      .side-circle-button.bottom {
        margin-bottom: 0px;
      }
      .row {
        display: flex;
        flex-direction: row;
        width: 100%;
        flex-wrap: nowrap; /* to keep all items in a row */
        overflow-x: hidden; /* to prevent horizontal scroll */
      }
      .row.gap-top {
        margin-top: clamp(1px, 1vw, 6px);
      }
      .row.gap-bottom {
        margin-bottom: clamp(1px, 1vw, 6px);
      }
      .cell {
        min-width: 0; /* to allow shrinking */
        max-width: 100%;
        padding: clamp(1px, 1vw, 6px);
      }
      .cell.no-gap {
        padding: 0;
      }
      .standard-grey {
        fill: var(--cell-button-fg);
        stroke: var(--cell-button-fg);
      }
      .sensor-on {
        fill: var(--cell-sensor-on-fg);
        stroke: var(--cell-sensor-on-fg);
      }
      .circle-button {
        height: 100%;
        width: 100%;  /* maintain aspect ratio */
        flex: 1 1 0;
        aspect-ratio: 1 / 1;
        background-color: var(--cell-button-bg);
        color: var(--cell-button-fg);
        border: none;
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        font-size: clamp(1px, 4vw, 24px);
        transition: background-color 0.2s ease;
        align-items: center;
        justify-content: center;
        display: flex;
        border-radius: 50%;   /* This makes the button circular */
      }
      .circle-button.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background-color: var(--cell-button-active-bg);
      }
      .circle-button.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background-color: var(--cell-button-press-bg);
        transform: scale(0.95);
      }
      .circle-button.locked {
        background: var(--cell-button-locked-bg);
        font-weight: bold;
      }
      .circle-button.locked.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background: var(--cell-button-locked-active-bg);
      }
      .circle-button.locked.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background: var(--cell-button-locked-press-bg);
      }
      .side-button {
        aspect-ratio: 3 / 1;
        width: 100%;  /* maintain aspect ratio */
        flex: 1 1 0;
        background-color: var(--cell-button-bg);
        color: var(--cell-button-fg);
        border: none;
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        transition: background-color 0.2s ease;
        align-items: center;
        justify-content: center;
        display: flex;
      }
      .side-button.left {
        border-top-left-radius: 999px;
        border-bottom-left-radius: 999px;
      }
      .side-button.right {
        border-top-right-radius: 999px;
        border-bottom-right-radius: 999px;
      }
      .side-button.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background-color: var(--cell-button-active-bg);
      }
      .side-button.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background-color: var(--cell-button-press-bg);
        transform: scale(0.95);
      }
      .ts-toggle-container {
        min-width: 0;
        text-align: center;
        flex: 1 1 0;
        background-color: var(--cell-button-bg);
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        transition: background-color 0.2s ease, transform 0.1s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0;
        user-select: none;
        position: relative; /* Needed for absolute children */
      }
      .ts-toggle-option {
        flex: 1 1 0;
        aspect-ratio: 1 / 1;
        max-width: 100%;
        position: relative;
        z-index: 1;
        font-size: clamp(1px, 5vw, 30px);
        color: var(--cell-button-fg);
        border-radius: 999px;
        user-select: none;
        display: flex;
        align-items: center;   /* vertical alignment */
        justify-content: center; /* horizontal alignment */
      }
      .ts-toggle-indicator {
        position: absolute;
        top: 0;
        bottom: 0;
        width: calc(100% / 3); /* Assuming 3 options */
        left: 0;
        z-index: 0;
        background-color: var(--cell-button-active-bg);
        border-radius: 999px;
        transition: left 0.3s ease;
      }
      ${this._layoutManager.isTouchDevice() ? "" : ".ts-toggle-option:hover { background-color: rgba(0, 0, 0, 0.05); }" }
      .ts-toggle-option.active {
        font-weight: bold;
      }
      .quarter {
        cursor: pointer;
        transition: fill 0.2s ease;
      }
      .quarter.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        fill: var(--cell-button-active-bg);
      }
      .quarter.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        fill: var(--cell-button-press-bg);
      }
      text {
        font-family: sans-serif;
        fill: var(--cell-button-fg);
        pointer-events: none;
        user-select: none;
      }
      .pass-through {
        pointer-events: none;
      }
      #foldable-container {
        width: 100%;
        display: none;
      }
      #power-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4);
      }
      #shield-tv-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      #shield-tv-icon-2 {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      #tv-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      #old-tv-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #device-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #light-bulb {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #arrow-up-icon {
        height: 100%;
        width: auto;
        display: block;
      }
      #arrow-right-icon {
        height: 100%;
        width: auto;
        display: block;
      }
      #arrow-down-icon {
        height: 100%;
        width: auto;
        display: block;
      }
      #arrow-left-icon {
        height: 100%;
        width: auto;
        display: block;
      }
      #return-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      #home-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.6, 0.6);
      }
      #backspace-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4);
      }
      #keyboard-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4);
      }
      #toggle-neutral {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.1, 0.1);
      }
      #mouse-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4) rotate(315deg);
      }
      #settings-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.4, 0.4);
      }
      #previous-track-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #play-pause-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #next-track-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #volumemute-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #volumedown-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #volumeup-icon {
        height: 100%;
        width: auto;  /* maintain aspect ratio */
        display: block; /* removes any inline space */
        transform: scale(0.5, 0.5);
      }
    `;
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.wrapper = card.querySelector(".wrapper");
    this._elements.sidewrapper = card.querySelector(".side-wrapper");
  }

  doListen() {
    // Nothing to do here: events are listened per sub-element
  }

  doUpdateConfig() {
    if (this._layoutManager.configuredLayoutChanged()) {
      this.doUpdateLayout();
    }
  }
  
  doUpdateFoldablesConfig() {
    // Update foldables cards configs
    const foldables = this._elements.foldables;
    foldables.keyboard.setConfig(this.getKeyboardConfig());
    foldables.trackpad.setConfig(this.getTrackpadConfig());
    foldables.activities.setConfig(this.getActivitiesConfig());
  }
  
  doUpdateSidesConfig() {
    // Update sides cards configs
    const sides = this._elements.sides;
    sides.addons.setConfig(this.getAddonsConfig());
  }

  doUpdateHass() {

    // Update buttons overriden with sensors configuration (buttons sensors data + buttons visuals)
    const overridesConfigs = this._layoutManager.getButtonsOverrides();
    Object.keys(overridesConfigs).forEach((btnId) => {

      // Search if current override configuration does have a declared sensor
      const sensorEntityId = overridesConfigs[btnId]?.['sensor'];
      if (sensorEntityId) {

        // Search if current override configuration matches an element from DOM
        const btn = this._elements.wrapper.querySelector(`#${btnId}`);
        if (btn) {

          // The current override configuration does have a declared sensor and matches an element from DOM

          // Update overriden button with up-to-date sensor state
          const sensorState = this._hass.states[sensorEntityId];
          if (sensorState) {
            btn._sensorState = sensorState.state;
          } else {
            btn._sensorState = sensorState;
          }

          // Set overriden button content classes relative to sensor current state, for visual feedback
          if (btn.children) {
            const children = Array.from(btn.children);
            const isSensorOn = btn._sensorState && btn._sensorState === 'on';
            children.forEach(child => {
              if (isSensorOn) {
                child.classList.add("sensor-on");
              } else {
                child.classList.remove("sensor-on");
              }
            });
          }
          if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Updated ${btnId} with ${sensorEntityId} state:`, btn._sensorState));
        }
      }
    });
  }

  doUpdateFoldablesHass() {
    // Update foldables cards configs
    const foldables = this._elements.foldables;
    foldables.keyboard.hass = this._hass;
    foldables.trackpad.hass = this._hass;
    foldables.activities.hass = this._hass;
  }

  doUpdateSidesHass() {
    // Update sides cards configs
    const sides = this._elements.sides;
    sides.addons.hass = this._hass;
  }

  doUpdateLayout() {
    this.doResetLayout();
    this.doCreateLayout();
  }

  doResetLayout() {
    // Clear previous listeners
    this._eventManager.clearListeners("layoutContainer");

    // Detach existing layout from DOM
    this._elements.wrapper.innerHTML = '';

    // Reset cells contents elements (if any)
    this._elements.cellContents = [];

    // Reset cells elements (if any)
    this._elements.cells = [];

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

    // Setup sides addons
    // this.setupSides();
  }

  doRow(rowConfig) {
    const row = document.createElement("div");
    this._elements.rows.push(row);
    row.classList.add('row');
    if (rowConfig["filler-top"]) row.classList.add('gap-top');
    if (rowConfig["filler-bottom"]) row.classList.add('gap-bottom');

    // Create cells
    for (const cellConfig of rowConfig.cells) {
      const cell = this.doCell(rowConfig, cellConfig);
      this.doStyleCell();
      this.doAttachCell(row, cell);
      this.doQueryCellElements();
      this.doListenCell();
    }

    return row;
  }

  doStyleRow() {
    // Nothing to do here: already included into card style
  }

  doAttachRow(row) {
    this._elements.wrapper.appendChild(row);
  }

  doQueryRowElements() {
    // Nothing to do here: element already referenced and sub-elements already are included by them
  }

  doListenRow() {
    // Nothing to do here: no listener on element and sub-elements listeners are included by them
  }

  doCell(rowConfig, cellConfig) {
    const cell = document.createElement("div");
    this._elements.cells.push(cell);
    cell.classList.add('cell');
    cell.classList.add(this.createSpanClass(cellConfig.weight));
    if (rowConfig["no-gap"]) cell.classList.add('no-gap'); // Remove internal padding on cell when required by the row

    // Create cell content
    const cellContent = this.doCellContent(cellConfig);
    this.doStyleCellContent();
    this.doAttachCellContent(cell, cellContent);
    this.doQueryCellContentElements(cellContent);
    this.doListenCellContent(cellContent);

    return cell;
  }

  doStyleCell() {
    // Nothing to do here: already included into card style
  }

  doAttachCell(row, cell) {
    row.appendChild(cell);
  }

  doQueryCellElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenCell() {
    // Nothing to do here: no listener on element and sub-elements listeners are included by them
  }

  doCellContent(cellConfig) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("doCellContent(cellConfig):", cellConfig));

    // Retrieve target cell identifier (content will be created according to this name)
    const cellName = cellConfig.name;

    // Filler does not have cell content: skip cell content creation
    if (cellName === "filler") return null;

    // Retrieve default cell config that matches the cell name (when available)
    const defaultCellConfig = this._defaultCellConfigs[cellName];

    // Define cell content tag
    let cellContentTag = null;
    if (defaultCellConfig && defaultCellConfig.tag) cellContentTag = defaultCellConfig.tag; // Default config
    if (cellConfig.tag) cellContentTag = cellConfig.tag; // Override with user config when specified
    if (!cellContentTag) cellContentTag = "button"; // Fallback to "button" when no default nor user config available

    // Define cell content class
    let cellContentClass = null;
    if (defaultCellConfig && defaultCellConfig.visual) cellContentClass = defaultCellConfig.visual; // Default config
    if (cellConfig.visual) cellContentClass = cellConfig.visual; // Override with user config when specified
    if (!cellContentClass && cellContentTag === "button") cellContentClass = "circle-button"; // Fallback to "circle-button" visual when no default nor user config available and tag is a button

    // Define cell content inner html (when available)
    let cellContentHtml = null;
    if (defaultCellConfig && defaultCellConfig.html) cellContentHtml = defaultCellConfig.html; // Default config
    if (cellConfig.html) cellContentHtml = cellConfig.html; // Override with user config when specified
    // No default html fallback

    // Build cell content using previously defined tag + style + inner html
    let cellContent;
    if (cellContentTag === "svg") {
      cellContent = document.createElementNS(Globals.SVG_NAMESPACE, "svg");
      if (!cellContentHtml && cellName === "dpad") this.createDpad(cellContent, cellConfig); // When Dpad cell, create Dpad content
    } else {
      cellContent = document.createElement(cellContentTag);
    }
    this._elements.cellContents.push(cellContent);
    cellContent.id = cellName;
    if (cellContentClass) cellContent.className = cellContentClass;
    if (cellContentHtml) cellContent.innerHTML = cellContentHtml;

    // Add cell content data when cell content is a button
    if (cellContentTag === "button") this.setClickableData(cellContent, defaultCellConfig, cellConfig);

    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("created cellContent:", cellContent));
    return cellContent;
  }

  doStyleCellContent() {
    // Nothing to do here: already included into card style
  }

  doAttachCellContent(cell, cellContent) {
    if (cellContent) cell.appendChild(cellContent); // Fillers does not have any content
  }

  doQueryCellContentElements(cellContent) {
    // Query three-states-toggle elements
    if (cellContent?.id === "ts-toggle-container") {
      const toggle = cellContent;
      this._elements.threeStatesToggle = toggle;
      this._elements.threeStatesToggleIndicator = toggle.querySelector(".ts-toggle-indicator");
      this._elements.threeStatesToggleOptions = Array.from(toggle.querySelectorAll(".ts-toggle-option"));
    }
    // Query foldable elements
    if (cellContent?.id === "foldable-container") {
      const foldable = cellContent;
      this._elements.threeStatesToggleFoldable = foldable;
    }
  }

  doListenCellContent(cellContent) {
    // Add a listener if cell content is not:
    // - a filler
    // - the Dpad
    // - the three-states-toggle
    // - the foldables container
    if (cellContent
        && cellContent?.id !== "dpad"
        && cellContent?.id !== "ts-toggle-container" 
        && cellContent?.id !== "foldable-container") {
      this.addClickableListeners(cellContent); 
    }
  }

  createDpad(dpad, dpadConfig) {
    this.doDpad(dpad, dpadConfig);
    this.doStyleDpad();
    this.doAttachDpad();
    this.doQueryDpadElements();
    this.doListenDpad();
  }

  doDpad(dpad, dpadConfig) {
    // Dpad config
    //TODO: externalize
    const padRadius = 100;
    const padPadding = 56;
    const padLineThick = 5;
    const center = padRadius;
    const rOuter = padRadius;
    const rInner = padRadius - padPadding;
    const centerRadius = padRadius - padPadding - padLineThick;
    const svgSize = padRadius * 2;

    dpad.setAttribute("viewBox", `0 0 ${svgSize} ${svgSize}`);
    dpad.setAttribute("preserveAspectRatio", "xMidYMid meet");
    dpad.style.width = "100%";
    dpad.style.height = "auto";
    dpad.style.flex = dpadConfig.weight;
    dpad.style["aspect-ratio"] = "1 / 1";

    const defs = document.createElementNS(Globals.SVG_NAMESPACE, "defs");
    dpad.appendChild(defs);

    // Dpad quarters config
    //TODO: externalize
    const quarters = [
      { quarterId: "remote-button-arrow-up"   , clipId: 'clip-quarter-1', angleStart: 225 },
      { quarterId: "remote-button-arrow-right", clipId: 'clip-quarter-2', angleStart: 315 },
      { quarterId: "remote-button-arrow-down" , clipId: 'clip-quarter-3', angleStart: 45  },
      { quarterId: "remote-button-arrow-left" , clipId: 'clip-quarter-4', angleStart: 135 }
    ];
    const arrowScale = 0.6;          // ← 1 = normal size, <1 = smaller, >1 = larger

    for (const quarterConfig of quarters) {
      const dpadQuarter = this.doDpadQuarter(dpad, defs, center, rOuter, rInner, this._cellButtonFg, arrowScale, quarterConfig);
      this.doStyleDpadQuarter();
      this.doAttachDpadQuarter();
      this.doQueryDpadQuarterElements();
      this.doListenDpadQuarter(dpadQuarter);
    }

    const dpadCenter = this.doDpadCenter(dpad, center, centerRadius);
    this.doStyleDpadCenter();
    this.doAttachDpadCenter();
    this.doQueryDpadCenterElements();
    this.doListenDpadCenter(dpadCenter);
  }

  doStyleDpad() {
    // Nothing to do here: already included into card style
  }

  doAttachDpad() {
    // Nothing to do here: already attached by its parent
  }

  doQueryDpadElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenDpad() {
    // Nothing to do here: no listener on element and sub-elements listeners are included by them
  }

  doDpadQuarter(dpad, defs, center, rOuter, rInner, arrowColor, arrowScale, quarterConfig) {    

    // Quarter specific config
    const angleStart = quarterConfig.angleStart;
    const clipId = quarterConfig.clipId;
    const quarterId = quarterConfig.quarterId;
    const defaultQuarterConfig = this._defaultCellConfigs[quarterId];

    const quarterPath = this.createQuarterPath(angleStart, center, rOuter, rInner);
    const clip = document.createElementNS(Globals.SVG_NAMESPACE, "clipPath");
    clip.setAttribute("id", clipId);
    const clipShape = document.createElementNS(Globals.SVG_NAMESPACE, "path");
    clipShape.setAttribute("d", quarterPath);
    clip.appendChild(clipShape);
    defs.appendChild(clip);

    const btn = document.createElementNS(Globals.SVG_NAMESPACE, "path");
    btn.setAttribute("d", quarterPath);
    btn.setAttribute("fill", this._cellButtonBg);
    btn.setAttribute("clip-path", `url(#${clipId})`);
    btn.setAttribute("class", "quarter");
    btn.setAttribute("id", quarterId);
    this.setClickableData(btn, defaultQuarterConfig, null);
    dpad.appendChild(btn);

    // Retrieve arrow content from default config
    const arrowContentHtml = defaultQuarterConfig.html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(arrowContentHtml, "image/svg+xml");
    const arrowSvg = doc.documentElement;

    // Clean ID to avoid duplicate IDs in document
    arrowSvg.removeAttribute("id");

    // Set fill color on inner shapes
    const shapes = arrowSvg.querySelectorAll("path, polygon, circle, rect");
    shapes.forEach(shape => shape.setAttribute("fill", arrowColor));

    // Get the original viewBox
    const vb = arrowSvg.getAttribute("viewBox").split(" ").map(parseFloat);
    const [vbX, vbY, vbWidth, vbHeight] = vb;

    // Desired on-screen size (in your SVG coordinate system before scaling)
    const baseSize = 20; // adjust to your taste

    // Scale to fit iconSize in both dimensions
    const scaleX = (baseSize / vbWidth) * arrowScale;
    const scaleY = (baseSize / vbHeight) * arrowScale;

    // Create a group to wrap and position the arrow
    const iconGroup = document.createElementNS(Globals.SVG_NAMESPACE, "g");

    // Centered position in D-Pad arc
    const angle = (angleStart + 45) % 360;
    const labelPos = this.pointOnCircle(center, center, (rOuter + rInner) / 2, angle);

    // Position and center the viewBox origin
    iconGroup.setAttribute(
      "transform",
      `translate(${labelPos.x}, ${labelPos.y}) scale(${scaleX}, ${scaleY}) translate(${-vbX - vbWidth / 2}, ${-vbY - vbHeight / 2})`
    );

    // Move all children of the parsed SVG into the group
    while (arrowSvg.firstChild) {
      iconGroup.appendChild(arrowSvg.firstChild);
    }

    // Mark each triangle icon as "pass-through" to avoid blocking events
    iconGroup.classList.add("pass-through");

    dpad.appendChild(iconGroup);

    return btn;
  }

  doStyleDpadQuarter() {
    // Nothing to do here: already included into card style
  }

  doAttachDpadQuarter() {
    // Nothing to do here: already attached during creation
  }

  doQueryDpadQuarterElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenDpadQuarter(dpadQuarter) {
    this.addClickableListeners(dpadQuarter);
  }

  doDpadCenter(dpad, center, centerRadius) {
    const centerId = "remote-button-center";
    const defaultCenterConfig = this._defaultCellConfigs[centerId];

    const btn = document.createElementNS(Globals.SVG_NAMESPACE, "circle");
    btn.setAttribute("cx", center);
    btn.setAttribute("cy", center);
    btn.setAttribute("r", centerRadius);
    btn.setAttribute("fill", this._cellButtonBg);
    btn.setAttribute("class", "quarter");
    btn.setAttribute("id", centerId);
    this.setClickableData(btn, defaultCenterConfig, null);
    dpad.appendChild(btn);

    const centerLabel = document.createElementNS(Globals.SVG_NAMESPACE, "text");
    centerLabel.setAttribute("x", center);
    centerLabel.setAttribute("y", center);
    centerLabel.setAttribute("text-anchor", "middle");
    centerLabel.setAttribute("dominant-baseline", "middle");
    centerLabel.textContent = "OK";
    dpad.appendChild(centerLabel);

    return btn;
  }

  doStyleDpadCenter() {
    // Nothing to do here: already included into card style
  }

  doAttachDpadCenter() {
    // Nothing to do here: dpad center already attached to dpad
  }

  doQueryDpadCenterElements() {
    // Nothing to do here: element already referenced and sub-elements are not needed
  }

  doListenDpadCenter(dpadCenter) {
    this.addClickableListeners(dpadCenter);
  }

  degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  pointOnCircle(cx, cy, r, deg) {
    const rad = this.degToRad(deg);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  createQuarterPath(angleStart, center, rOuter, rInner) {
    const angleEnd = (angleStart + 90) % 360;
    const p1 = this.pointOnCircle(center, center, rOuter, angleStart);
    const p2 = this.pointOnCircle(center, center, rOuter, angleEnd);
    const p3 = this.pointOnCircle(center, center, rInner, angleEnd);
    const p4 = this.pointOnCircle(center, center, rInner, angleStart);
    return `M ${p1.x} ${p1.y}
            A ${rOuter} ${rOuter} 0 0 1 ${p2.x} ${p2.y}
            L ${p3.x} ${p3.y}
            A ${rInner} ${rInner} 0 0 0 ${p4.x} ${p4.y}
            Z`;
  }

  setupFoldable() {
    // Reset toggle state
    this._threeStatesToggleState = 1;

    this.doUpdateThreeStateToggle();
    this.doUpdateFoldable();

    for (const [optionIndex, opt] of (this._elements.threeStatesToggleOptions ?? []).entries()) {
      this._eventManager.addPointerClickListenerToContainer("layoutContainer", opt, this.onThreeStateToggleOptionPointerClick.bind(this, optionIndex));
    }
  }

  onThreeStateToggleOptionPointerClick(optionIndex, evt) {
    
    // When clicked option changed
    if (this._threeStatesToggleState !== optionIndex) {
      
      // Select the clicked option
      this._threeStatesToggleState = optionIndex;
      
      // Update toggle state and associated foldable
      this.doUpdateThreeStateToggle();
      this.doUpdateFoldable();
      
      this._layoutManager.hapticFeedback();
    }
  }

  doUpdateThreeStateToggle() {
    // Safe guard against missing three-state-toggle (ie. not declared into layout for example)
    if (!this._elements.threeStatesToggleIndicator) return;

    // Move indicator over selected state
    const leftPercentages = ["0%", "33.33%", "66.66%"];
    this._elements.threeStatesToggleIndicator.style.left = leftPercentages[this._threeStatesToggleState];

    // Activate visually selected option + de-activate visually the two others
    for (const [optionIndex, opt] of (this._elements.threeStatesToggleOptions ?? []).entries()) {
      opt.classList.toggle("active", this._threeStatesToggleState === optionIndex)
    }
  }

  doUpdateFoldable() {
    // Safe guard against missing foldable (ie. not declared into layout for example)
    if (!this._elements.threeStatesToggleFoldable) return;

    // Remove foldable content from DOM (ie. hide it)
    const foldable = this._elements.threeStatesToggleFoldable;
    foldable.innerHTML = "";  
    foldable.style.display = "block";

    // Retrieve and prepare next foldable content
    const foldableContent = this.getFoldableChild();
    foldableContent.setAttribute("style", "width: 100%;");

    // Append next foldable content into DOM (ie. show it)
    foldable.appendChild(foldableContent);

    // Automatically scroll-down to the added foldable
    this._layoutManager.autoScrollTo(foldable);
  }

  createSpanClass(flex) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("createSpanClass(flex):", flex));
    const styleName = this.getStyleSpanName(flex);
    if (!this._dynamicStyleNames.has(styleName)) {
      const dynamicStyle = `
        .${styleName} {
          flex: ${flex};
        }`;
      this._elements.style.textContent += dynamicStyle;
      this._dynamicStyleNames.add(styleName);
    }
    return styleName;
  }

  getStyleSpanName(flex) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("getStyleSpanName(flex):", flex));
    const flexStr = String(flex);
    const styleId = flexStr.replace(/\./g, '-');
    return `span-${styleId}`;
  }

  setupSides() {
    this.doUpdateAddons();
  }
  
  doUpdateAddons() {
    // Remove addons content from DOM (ie. hide it)
    const sidewrapper = this._elements.sidewrapper;
    sidewrapper.innerHTML = "";

    // Append next addons content into DOM (ie. show it)
    sidewrapper.appendChild(this.getAddons());
  }

  // configuration defaults
  static getStubConfig() {
    return {
      layout: "classic",
      haptic: true,
      auto_scroll: true,
      log_level: "warn",
      log_pushback: false,
      buttons_overrides: {},
      trigger_long_click_delay: 500,
      keyboard: {},
      trackpad: {},
      activities: {},
      addons: {}
    }
  }

  getCardSize() {
    return 4;
  }

  // Set key data
  setClickableData(clickable, defaultConfig, overrideConfig) {
    this._layoutManager.setElementData(clickable, defaultConfig, overrideConfig, (key, value, source) => this._allowedClickableData.has(key));
  }

  // Set listeners on a clickable button
  addClickableListeners(btn) {
    this._eventManager.addButtonListeners("layoutContainer", btn, 
      {
        [this._eventManager.constructor._BUTTON_CALLBACK_PRESS]: this.onButtonPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_ABORT_PRESS]: this.onButtonAbortPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_RELEASE]: this.onButtonRelease.bind(this)
      }
    );
  }

  onButtonPress(btn, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doKeyPress(btn, evt);
  }

  onButtonAbortPress(btn, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doKeyAbortPress(btn, evt);
  }

  onButtonRelease(btn, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doKeyRelease(btn, evt);
  }

  doKeyPress(btn, evt) {

    // Retrieve clickable button data
    const btnData = this._layoutManager.getElementData(btn);
    if (!btnData) return;

    // Key code to press
    const code = btnData.code;
    if (this.hasTypedButtonOverrideShort(btn) || this.hasTypedButtonOverrideLong(btn)) {

      // Nothing to do: overriden action will be executed on key release
      if (this.hasTypedButtonOverrideShort(btn)) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: overridden key for ${this._overrideMode} on ${this._OVERRIDE_TYPE_SHORT_PRESS} detected, nothing to press`));
      }

      // Triggering long click timeout
      if (this.hasTypedButtonOverrideLong(btn)) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: overridden key for ${this._overrideMode} on ${this._OVERRIDE_TYPE_LONG_PRESS} detected, triggering long-press timeout...`));
        this._overrideLongPressTimeouts.set(evt.pointerId, { 
          "can-run": true,                   // until proven wrong, long press action can be run
          "was-ran": false,                      // true when action was executed
          "source": btn,                        // long press source button
          "source-mode": this._overrideMode,          // long press source mode when timeout starts
          "timeout": this.addOverrideLongPressTimeout(evt)   // when it expires, triggers the associated inner callback to run the action
        });
      }
    } else {
      // Default action

      // Press HID key
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: standard key detected, pressing ${code}...`));
      this.appendCode(code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doKeyAbortPress(btn, evt) {

    // Remove override long press timeout (when set before)
    this.clearOverrideLongPressTimeout(evt);
    this._overrideLongPressTimeouts.delete(evt.pointerId);

    // Retrieve clickable button data
    const btnData = this._layoutManager.getElementData(btn);
    if (!btnData) return;

    // Key code to abort press
    const code = btnData.code;
    if (this.hasTypedButtonOverrideShort(btn) || this.hasTypedButtonOverrideLong(btn)) {

      // Nothing to do: overriden action has not (and wont be) executed because key release wont happen
      if (this._layoutManager.hasTypedButtonOverride(btn, this._overrideMode, this._OVERRIDE_TYPE_SHORT_PRESS)) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} abort press: overridden short key press detected, nothing to abort`));
      }

      // Overriden long click did not happened: nothing to do, overriden action has not (and wont be) executed because key release wont happen
      if (this._layoutManager.hasTypedButtonOverride(btn, this._overrideMode, this._OVERRIDE_TYPE_LONG_PRESS)) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} abort press: overridden long key press detected, nothing to abort`));
      }
    } else {
      // Default action

      // Release HID key to prevent infinite key press
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} abort press: standard key detected, releasing ${code}...`));
      this.removeCode(code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doKeyRelease(btn, evt) {

    const overrideLongPressEntry = this._overrideLongPressTimeouts.get(evt.pointerId);
    
    // Remove override long press timeout (when set before)
    this.clearOverrideLongPressTimeout(evt);
    this._overrideLongPressTimeouts.delete(evt.pointerId);

    // Retrieve clickable button data
    const btnData = this._layoutManager.getElementData(btn);
    if (!btnData) return;

    // Key code to release
    const code = btnData.code;
    if (overrideLongPressEntry && overrideLongPressEntry["was-ran"]) {
      // Overriden action already executed into its long-press Form
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} release: overridden key detected but action already executed into ${this._overrideMode} ${this._OVERRIDE_TYPE_LONG_PRESS}, nothing else to do`));
    } else if (this.hasTypedButtonOverrideShort(btn)) {
      // Overriden action
      
      // Execute the override action
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} release: overridden key detected, suppressing ${code} to execute override...`));
      this.executeButtonOverride(btn, this._OVERRIDE_TYPE_SHORT_PRESS);
    } else {
      // Default action

      // Release HID key
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} release: standard key detected, releasing ${code}...`));
      this.removeCode(code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  hasTypedButtonOverrideShort(btn) {
    return this._layoutManager.hasTypedButtonOverride(btn, this._overrideMode, this._OVERRIDE_TYPE_SHORT_PRESS);
  }
  hasTypedButtonOverrideLong(btn) {
    return this._layoutManager.hasTypedButtonOverride(btn, this._overrideMode, this._OVERRIDE_TYPE_LONG_PRESS);
  }

  addOverrideLongPressTimeout(evt) {
    return setTimeout(() => {
      const overrideLongPressEntry = this._overrideLongPressTimeouts.get(evt.pointerId);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addOverrideLongPressTimeout(evt) + overrideLongPressEntry:`, evt, overrideLongPressEntry));

      // When no entry: key has been released before timeout
      if (overrideLongPressEntry && overrideLongPressEntry["can-run"] && !overrideLongPressEntry["was-ran"]) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Long action waiting to be executed...`));
        const btn = overrideLongPressEntry["source"];

        // Check whether or not long click action can be run in current mode
        overrideLongPressEntry["can-run"] = (overrideLongPressEntry["source-mode"] === this._overrideMode);
        if (!overrideLongPressEntry["can-run"]) return;

        // Mark action as ran
        overrideLongPressEntry["was-ran"] = true;

        // Execute action
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addOverrideLongPressTimeout(evt) + overrideLongPressEntry: executing ${this._overrideMode} ${this._OVERRIDE_TYPE_LONG_PRESS} action...`, evt, overrideLongPressEntry));
        this.executeButtonOverride(btn, this._OVERRIDE_TYPE_LONG_PRESS);
      }
    }, this.getTriggerLongClickDelay()); // long-press duration
  }

  clearOverrideLongPressTimeout(evt) {
    const timeout = this._overrideLongPressTimeouts.get(evt.pointerId)?.["timeout"];
    if (timeout) clearTimeout(timeout);
  }

  executeButtonOverride(btn, pressType) {

    // Retrieve override config
    const overrideConfig = this._layoutManager.getButtonOverride(btn);
    
    // Retrieve override typed config
    let overrideTypedConfig = this._eventManager.getTypedButtonOverrideConfig(overrideConfig, this._overrideMode, pressType);
    
    // When "same" config specified, retrieve reference config from the other config type
    if (overrideTypedConfig === this._OVERRIDE_SAME) {
      const referencePressType = (pressType === this._OVERRIDE_TYPE_SHORT_PRESS ? this._OVERRIDE_TYPE_LONG_PRESS : this._OVERRIDE_TYPE_SHORT_PRESS);
      overrideTypedConfig = this._eventManager.getTypedButtonOverrideConfig(overrideConfig, this._overrideMode, referencePressType);
    }

    // When both config types are "same": error
    if (overrideTypedConfig === this._OVERRIDE_SAME) {
      if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`executeButtonOverride(btn): invalid config ${this._overrideMode} for btn ${btn.id} (both ${this._OVERRIDE_TYPE_SHORT_PRESS} and ${this._OVERRIDE_TYPE_LONG_PRESS} reference "${this._OVERRIDE_SAME}". Aborting...`, btn));
    }

    if (overrideTypedConfig ===  this._OVERRIDE_ALTERNATIVE_MODE || 
        overrideTypedConfig === this._OVERRIDE_NORMAL_MODE) {
      // Typed config switches mode

      // Switch mode
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching from ${this._overrideMode} to ${overrideTypedConfig}...`, btn));
      this._overrideMode = overrideTypedConfig;
      if (this._overrideMode === this._OVERRIDE_ALTERNATIVE_MODE) btn.classList.add("locked");
      if (this._overrideMode === this._OVERRIDE_NORMAL_MODE) btn.classList.remove("locked");
    } else if (overrideTypedConfig ===  this._OVERRIDE_SWITCH_SIDE_PANEL) {
      // Typed config switches side panel open/close

      // Switch mode
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching from ${this._overrideMode} to ${overrideTypedConfig}...`, btn));
      this._sidePanelVisible = !this._sidePanelVisible;
      if (this._sidePanelVisible) {
        btn.classList.add("locked");
        this._elements.sidewrapper.classList.remove("hide");
      } else {
        btn.classList.remove("locked");
        this._elements.sidewrapper.classList.add("hide");
      }
    } else {
      // Typed config defines an action (related to sensor state or not)

      // Execute action whenever sub-config defined (handled by this._eventManager.executeTypedButtonOverride)
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): executing ${pressType} action into ${this._overrideMode}...`, btn));
      this._eventManager.executeTypedButtonOverride(btn, overrideConfig, this._overrideMode, pressType);
    }
  }

  appendCode(code) {
    if (code) {
      if (this.isKey(code) || this.isModifier(code)) {
        this.appendKeyCode(code);
      } else if (this.isConsumer(code)) {
        this.appendConsumerCode(code);
      } else {
        if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("Unknown code type:", code));
      }
    }
  }

  appendKeyCode(code) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Key pressed:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key pressed
        this._pressedModifiers.add(intCode);
      } else {
        // Standard key pressed
        this._pressedKeys.add(intCode);
      }
    }
    this.sendKeyboardUpdate();
  }

  appendConsumerCode(code) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Consumer pressed:", code));
    if (code) {
      const intCode = this._consumercodes[code];
      this._pressedConsumers.add(intCode);
    }
    this.sendConsumerUpdate();
  }

  removeCode(code) {
    if (code) {
      if (this.isKey(code) || this.isModifier(code)) {
        this.removeKeyCode(code);
      } else if (this.isConsumer(code)) {
        this.removeConsumerCode(code);
      } else {
        if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("Unknown code type:", code));
      }
    }
  }

  removeKeyCode(code) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Key released:", code));
    if (code) {
      const intCode = this._keycodes[code];
      if (this.isModifier(code)) {
        // Modifier key released
        this._pressedModifiers.delete(intCode);
      } else {
        // Standard key released
        this._pressedKeys.delete(intCode);
      }
    }
    this.sendKeyboardUpdate();
  }

  removeConsumerCode(code) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("Consumer released:", code));
    if (code) {
      const intCode = this._consumercodes[code];
      this._pressedConsumers.delete(intCode);
    }
    this.sendConsumerUpdate();
  }

  isKey(code) {
    return code && code.startsWith("KEY_");
  }

  isModifier(code) {
    return code && code.startsWith("MOD_");
  }

  isConsumer(code) {
    return code && code.startsWith("CON_");
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendKeyboardUpdate() {
    this._eventManager.callComponentService("keypress", {
      sendModifiers: Array.from(this._pressedModifiers),
      sendKeys: Array.from(this._pressedKeys),
    });
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendConsumerUpdate() {
    this._eventManager.callComponentService("conpress", {
      sendCons: Array.from(this._pressedConsumers),
    });
  }

}

if (!customElements.get("android-remote-card")) customElements.define("android-remote-card", AndroidRemoteCard);
