import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';
import { androidRemoteCardConfig } from './configs/android-remote-card-config.js';
import { iconsConfig } from './configs/icons-config.js';
import * as layoutsRemote from './layouts/remote/index.js';

// <ha_resources_version> dynamically injected at install time
import { AndroidKeyboardCard } from './android-keyboard-card.js?v=<ha_resources_version>';
import { TrackpadCard } from './trackpad-card.js?v=<ha_resources_version>';
import { CarrouselCard } from './carrousel-card.js?v=<ha_resources_version>';
import { AirMouseCard } from './air-mouse-card.js?v=<ha_resources_version>';

// backgrounds
import { AnimatedBackground } from './backgrounds/animated-background.js?v=<ha_resources_version>';

console.info("Loading android-remote-card");

class AndroidRemoteCard extends HTMLElement {

  // private constants
  _defaultCellConfigs = androidRemoteCardConfig;
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();
  _allowedClickableData = new Set(['code', 'html']);
  _allowedAddonCellData = new Set(['name', 'action', 'entity']);
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
  _OVERRIDE_NONE = 'none';

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
  _knownRemoteModes = new Set([this._OVERRIDE_NORMAL_MODE, this._OVERRIDE_ALTERNATIVE_MODE]);
  _overrideMode = this._OVERRIDE_NORMAL_MODE;
  _overrideRepeatedTimeouts = new Map();
  _overrideLongPressTimeouts = new Map();
  _moreInfoLongPressTimeouts = new Map();
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
    this.doUpdateAddons();
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
    this.doUpdateManagedPreferences();
    this.doUpdateCurrentServer();
    this.doUpdateRemoteMode();
    this.doUpdateAirmouseMode();
  }

  setCurrentServer(server) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setCurrentServer(server):", server));
    this._eventManager.setCurrentServer(server);
    this.doUpdateCurrentServer();
  }

  setAirmouseEnabled(enable) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setAirmouseEnabled(enable):", enable));
    this.getAirMouse().setMoveEnabled(enable);
    this.doUpdateAirmouseMode();
  }

  setConfig(config) {
    this._config = config;
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set setConfig(config):", config));
    if (this.getLogger().isDebugEnabled()) this.getLogger().doLogOnError(this.doSetConfig.bind(this)); else this.doSetConfig();
  }
  doSetConfig() {
    this.doCheckConfig();
    this.doUpdateConfig();
    this.doUpdateManagedConfigs();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass();
    this.doUpdateManagedHass();
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

  getKeyboardConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("keyboard");
  }

  getTrackpadConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trackpad");
  }

  getActivitiesConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("activities");
  }

  getAirMouseConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("airmouse");
  }

  getAnimatedBackgroundConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("animated_background");
  }

  getAddonsConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("addons");
  }

  getAddonsCellsConfig() {
    return this.getAddonsConfig()?.["cells"];
  }

  getTriggerLongClickDelay() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_long_click_delay");
  }

  getTriggerRepeatOverrideDelay() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_repeat_override_delay");
  }
  getTriggerRepeatOverrideDecreaseInterval() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_repeat_override_decrease_interval");
  }
  getTriggerRepeatOverrideMinInterval() {
    return this._layoutManager.getFromConfigOrDefaultConfig("trigger_repeat_override_min_interval");
  }
  getButtonsOverridesConfigForServer(serverId) {
    return this._layoutManager.getFromConfigOrDefaultConfigForServer('buttons_overrides', serverId);
  }
  getButtonOverrideModeConfig(serverId, buttonId, mode) {
    return this.getButtonsOverridesConfigForServer(serverId)?.[buttonId]?.[mode];
  }
  getButtonOverrideImageUrlConfig(serverId, buttonId, mode) {
    return this.getButtonOverrideModeConfig(serverId, buttonId, mode)?.['image_url']
  }
  getButtonOverrideRawConfig(serverId, buttonId, mode, type) {
    return this.getButtonOverrideModeConfig(serverId, buttonId, mode)?.[type];
  }
  getButtonOverrideConfig(serverId, buttonId, mode, type) {
    // Retrieve raw button override config
    let overrideConfig = this.getButtonOverrideRawConfig(serverId, buttonId, mode, type);

    // Config shortcut "same" specified
    if (overrideConfig === this._OVERRIDE_SAME) {

      // Retrieve opposite raw button override config
      const referenceType = (type === this._OVERRIDE_TYPE_SHORT_PRESS ? this._OVERRIDE_TYPE_LONG_PRESS : this._OVERRIDE_TYPE_SHORT_PRESS);
      overrideConfig = this.getButtonOverrideRawConfig(serverId, buttonId, mode, referenceType);
    }

    // When both config types are "same": error
    if (overrideConfig === this._OVERRIDE_SAME) {
      if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`getButtonOverrideConfig(serverId, buttonId, mode, type): invalid config (serverId: ${serverId}, buttonId: ${buttonId}). Both ${this._OVERRIDE_TYPE_SHORT_PRESS} and ${this._OVERRIDE_TYPE_LONG_PRESS} are referencing "${this._OVERRIDE_SAME}" (only one reference expected)`, serverId, buttonId, mode, type));
    }

    return overrideConfig;
  }
  getButtonOverrideRepeatConfig(serverId, buttonId, mode, type) {
    return this.getButtonOverrideConfig(serverId, buttonId, mode, type)?.['repeat'];
  }

  getClickables() {
    return this._elements.clickables;
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

  getAirMouse() {
    return this._elements.airmouse;
  }

  getAnimatedBackground() {
    return this._elements.animatedBackground;
  }

  getAddonsWrapper() {
    return this._elements.addons.wrapper;
  }
  
  getAddonsCells() {
    return this._elements.addons.cells;
  }

  // Per addon cell config
  getAddonCellLabel(addonCellConfig) {
    return this.getAddonCellConfigOrDefault(addonCellConfig, "label"); 
  }
  getAddonCellLabelFontScale(addonCellConfig) {
    return this._layoutManager.getScaleOrDefault(this.getAddonCellConfigOrDefault(addonCellConfig, "label_font_scale"), "1rem");
  }
  getAddonCellLabelColor(addonCellConfig) {
    return this._sideCellButtonFg;
  }
  getAddonCellLabelGap(addonCellConfig) {
    return this.getAddonCellConfigOrDefault(addonCellConfig, "label_gap");
  }
  getAddonCellIconUrl(addonCellConfig) {
    return this.getAddonCellConfigOrDefault(addonCellConfig, "icon_url");
  }
  getAddonCellIconGap(addonCellConfig) {
    return this.getAddonCellConfigOrDefault(addonCellConfig, "icon_gap");
  }
  getAddonCellImageUrl(addonCellConfig) {
    return this.getAddonCellConfigOrDefault(addonCellConfig, "image_url");
  }
  getAddonCellImageGap(addonCellConfig) {
    return this.getAddonCellConfigOrDefault(addonCellConfig, "image_gap");
  }
  getAddonCellAction(addonCellConfig) {
    return this.getAddonCellConfigOrDefault(addonCellConfig, "action");
  }
  getAddonCellEntity(addonCellConfig) {
    return this.getAddonCellConfigOrDefault(addonCellConfig, "entity");
  }

  // Per cell config helper
  getAddonCellConfigOrDefault(addonCellConfig, property) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("getAddonCellConfigOrDefault(addonCellConfig, property):", addonCellConfig, property));
    const cellProperty = `cell_${property}`;
    return addonCellConfig?.[property] || 
          (this._layoutManager.isDefined(this._layoutManager.getFromConfig("addons")?.[cellProperty]) 
            ? this._layoutManager.getFromConfig("addons")?.[cellProperty] 
            : this._layoutManager.getFromDefaultConfig("addons")?.[cellProperty]);
  }

  // Dynamic config
  getDynamicAddonCellName(defaultAddonCellConfig) {
    return defaultAddonCellConfig["name"]; 
  }
  createDynamicAddonCellConfig(addonCellName) {
    return { "name": addonCellName };
  }

  getFoldableChild() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("getFoldableChild() + _threeStatesToggleState:", this._threeStatesToggleState));
    if (this._threeStatesToggleState === 0) return this.getKeyboard();
    if (this._threeStatesToggleState === 1) return this.getActivities();
    if (this._threeStatesToggleState === 2) return this.getTrackpad();
    if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`getFoldableChild(): invalid _threeStatesToggleState ${this._threeStatesToggleState} (cannot map it to a foldable child)`));
    return null;
  }

  createManagedContent() {

    // Create managed foldables
    this._elements.foldables = {};
    this._elements.foldables.keyboard = document.createElement("android-keyboard-card");
    this._elements.foldables.trackpad = document.createElement("trackpad-card");
    this._elements.foldables.activities = document.createElement("carrousel-card");
    this.getKeyboard().setManaged(true);
    this.getTrackpad().setManaged(true);
    this.getActivities().setManaged(true);

    // Create managed air-mouse
    this._elements.airmouse = document.createElement("air-mouse-card");
    this.getAirMouse().setManaged(true);
    this._elements.card.appendChild(this.getAirMouse()); // Append air-mouse at the end of card
  }

  createAddonsContent() {
    this._elements.addons = {};
  }

  // jobs
  doCheckConfig() {
    this._layoutManager.checkConfiguredLayout();
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div id="main-container" class="card-content">
        <animated-background class="animated-background"></animated-background>
        <div class="wrapper">
        </div>
        <div class="addons-wrapper hide">
        </div>
      </div>
    `;

    this.createManagedContent();
    this.createAddonsContent();
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
        --base-font-size: 1rem; /* base scaling unit */
        display: block;
        box-sizing: border-box;
        max-width: 100%;
        background: var(--card-background-color);
        border-radius: var(--card-border-radius);
        overflow: hidden; /* prevent overflow outside card */
        font-family: Roboto, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: var(--base-font-size);
        height: 100%;
      }
      .card-content {
        padding: 0 !important;
      }
      #main-container {
        position: relative;
        display: block;
        width: 100%;
        box-sizing: border-box;
        overflow-x: hidden;
      }
      .animated-background {
        z-index: 0; /* sits behind */
      }
      .wrapper {
        width: 100%;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        position: relative;
         z-index: 1; /* sits above */
      }
      .wrapper.with-addons {
        width: 83.3333%; /* 5/6 */
      }
      .addons-wrapper {
        width: 16.6667%; /* 1/6 */
        position: absolute;
        top: 0;
        right: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        box-sizing: border-box;
        border: 1px solid var(--cell-button-bg);
        border-radius: var(--card-border-radius);
      }
      .hide {
        display: none;
      }
      .addon-cell {
        display: flex;
        justify-content: center;
        align-items: center;
        max-width: 100%;
        aspect-ratio: 1 / 1;
        flex: 0 1 0%;
        background-color: var(--side-cell-button-bg);
        color: var(--side-cell-button-fg);
        border: none;
        outline: none;
        cursor: pointer;
        font-family: sans-serif;
        font-size: clamp(1px, 4vw, 24px);
        border-radius: 15%;
        margin-top: 4px;
        margin-bottom: 4px;
        margin-left: 4px;
        margin-right: 4px;
        box-sizing: border-box;
        transition: background-color 0.2s ease;
      }
      .addon-cell.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background-color: var(--cell-active-bg);
      }
      .addon-cell.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background-color: var(--cell-press-bg);
        transform: scale(0.95);
      }
      .addon-cell.${this._eventManager.constructor._BUTTON_CLASS_HOVER} * {
        opacity: 0.95;
      }
      .addon-cell.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} * {
        opacity: 0.85;
      }
      .addon-cell-content {
        position: relative;
        display: inline-flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 8px;
        overflow: hidden;
        text-align: center;
        color: white;
        font-size: 14px;
        box-sizing: border-box;
        height: 100%;
        width: 100%;
        padding: 2px;
      }
      .addon-cell-content-part {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      }
      .addon-cell-content-part.img.half {
        height: 60%;
      }
      .addon-cell-content-part.label.half {
        height: 40%;
      }
      .addon-cell-content-part.full {
        height: 100%;
      }
      .addon-icon-wrapper {
        background: transparent !important;
        transition: none !important;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        user-select: none;
        pointer-events: none;
        z-index: 3;
        position: absolute;
        width: auto;
        height: 30%;
        aspect-ratio: 1 / 1;
        top: 0px;
        left: 0px;
        padding: 0;
        background: transparent !important;
        transition: none !important;
      }
      .addon-icon {
        background: transparent !important;
        transition: none !important;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        user-select: none;
        pointer-events: none;
        height: 100%;
        width: auto;
        fill: var(--side-cell-button-fg);
        stroke: var(--side-cell-button-fg);
        cursor: pointer;
      }
      .addon-icon svg {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .addon-img {
        background: transparent !important;
        transition: none !important;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        user-select: none;
        pointer-events: none;
        height: 100%;
        width: auto;
        fill: var(--side-cell-button-fg);
        stroke: var(--side-cell-button-fg);
        cursor: pointer;
      }
      .addon-img svg {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .addon-label {
        display: flex;
        justify-content: center;
        align-items: center;
        min-width: 0%;
        min-height: 0%;
        width: 100%;
        height: 100%;
        white-space: normal;       /* allows wrapping */
        word-wrap: break-word;     /* allows breaking long words */
        overflow-wrap: break-word; /* better support for word breaking */
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
        background: transparent !important;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
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
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #airmouse-icon {
        height: 100%;
        width: auto;
        display: block;
        transform: scale(0.5, 0.5);
      }
      #microphone-icon {
        height: 100%;
        width: auto;  /* maintain aspect ratio */
        display: block; /* removes any inline space */
        transform: scale(0.8, 0.8);
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
    this._elements.addons.wrapper = card.querySelector(".addons-wrapper");
    this._elements.animatedBackground = card.querySelector(".animated-background");
  }

  doListen() {
    // Nothing to do here: events are listened per sub-element
  }

  doUpdateConfig() {
    if (this._layoutManager.configuredLayoutChanged()) {
      this.doUpdateLayout();
    }
    this.doUpdateAddons();
  }

  doUpdateManagedConfigs() {
    // Update foldables cards configs
    this.getKeyboard().setConfig(this.getKeyboardConfig());
    this.getTrackpad().setConfig(this.getTrackpadConfig());
    this.getActivities().setConfig(this.getActivitiesConfig());

    // Update air-mouse config
    this.getAirMouse().setConfig(this.getAirMouseConfig());
    
    // Update animated background config
    this.getAnimatedBackground().setConfig(this.getAnimatedBackgroundConfig());
  }

  doUpdateHass() {
    this.doUpdateLayoutHass();
    this.doUpdateAddonsHass();
  }

  doUpdateLayoutHass() {
    // Update buttons overriden with sensors configuration (buttons sensors data + buttons visuals)
    const serverId = this._eventManager.getCurrentServerId();
    const remoteMode = this.getRemoteMode();

    // Update all clickables content according to their override config (or default config)
    for (const clickable of this.getClickables()) {

      // Retrieve clickable buttonId
      const buttonId = clickable.id;

      // Retrieve clickable config
      const clickableConfig = this._layoutManager.getElementData(clickable);

      // Check if clickable HTML is overridable
      if (clickableConfig && clickableConfig.html) {
        const overrideImageUrl = this.getButtonOverrideImageUrlConfig(serverId, buttonId, remoteMode);

        // clickable has an HTML override in current configuration
        const imgHtml = overrideImageUrl ? iconsConfig[overrideImageUrl]?.["html"] : '';

        // Apply new imgHtml (when set) or restore default (when empty)
        clickable.innerHTML = imgHtml ? imgHtml : clickableConfig.html;
      }

      // Retrieve short or long press config (whatever is defined, in this order)
      const overrideConfigShort = this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_SHORT_PRESS);
      const overrideConfigLong = this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_LONG_PRESS);

      // Supports entity or sensor
      const entityId =
        overrideConfigShort?.['entity'] ?? overrideConfigLong?.['entity'] ??
        overrideConfigShort?.['sensor'] ?? overrideConfigLong?.['sensor'];
      if (entityId) {

        // Search if current override configuration matches an element from DOM
        const btn = this._elements.wrapper.querySelector(`#${buttonId}`);
        if (btn) {

          // Update overriden button with up-to-date sensor state
          const isHassEntityOn = this._eventManager.isHassEntityOn(entityId);
          btn._sensorState = isHassEntityOn ? 'on' : 'off';

          // Set overriden button content classes relative to sensor current state, for visual feedback
          for (const child of (btn.children ? Array.from(btn.children) : [])) {
            if (isHassEntityOn) child.classList.add("sensor-on");
            if (!isHassEntityOn) child.classList.remove("sensor-on");
          }
        }
      }
    }
  }

  doUpdateAddonsHass() {
    // Update all addons cells according to bound entities
    for (const addonCell of this.getAddonsCells()) {

      // Retrieve addon cell config
      const addonCellConfig = this._layoutManager.getElementData(addonCell);

      // Checks whether cell configured entity is ON (when entity is configured and exists into HA)
      const entityId = this.getAddonCellEntity(addonCellConfig);
      const isHassEntityOn = this._eventManager.isHassEntityOn(entityId);
      this.setSensorClass(addonCell, entityId, isHassEntityOn);
    }
  }
  
  setSensorClass(addonCell, entityId, isSensorOn) {
    const img = addonCell?._img;
    if (img) {
      const svg = img.querySelector('svg');
      const rgbColor = this._eventManager.getEntityRgbColor(entityId);
      if (svg && rgbColor) {
        // RGB color available

        // Remove "sensor-on" class just in case (to avoid styles collision)
        img.classList.remove("sensor-on");

        // Apply RGB color
        const [r, g, b] = rgbColor;
        const color = `rgb(${r}, ${g}, ${b})`;
        svg.style.fill = color;
        svg.style.stroke = color;
      } else {
        // RGB color unavailable (entity could be off, or could be unrelated to lights - ie. a switch)
        
        // Revert to original styles or empty string
        if (svg) svg.style.removeProperty('fill');
        if (svg) svg.style.removeProperty('stroke');
        
        if (isSensorOn) img.classList.add("sensor-on");
        if (!isSensorOn) img.classList.remove("sensor-on");
      }
    }
  }
  
  doUpdateManagedHass() {
    // Update foldables cards HASS object
    this.getKeyboard().hass = this._hass;
    this.getTrackpad().hass = this._hass;
    this.getActivities().hass = this._hass;

    // Update air mouse card HASS object
    this.getAirMouse().hass = this._hass;
  }

  doUpdateCurrentServer() {
    // Update remote UI to display current server to end user
    const serverLabel = this._elements.serverBtnLabel;
    if (serverLabel) serverLabel.innerHTML = this._eventManager.getCurrentServerName() ?? 'No server';

    // Update layout server dependent parts
    // Note: this code is racing with set hass,
    // so check hass is safe before attempting layout refresh
    if (this._hass) this.doUpdateLayoutHass();
  }

  doUpdateManagedPreferences() {
    const preferences = this._eventManager.getUserPreferences();

    // Update foldables current server
    this.getKeyboard().setUserPreferences(preferences);
    this.getTrackpad().setUserPreferences(preferences);
    this.getActivities().setUserPreferences(preferences);

    // Update air mouse current server
    this.getAirMouse().setUserPreferences(preferences);
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

    // Reset airmouse button element (if any)
    this._elements.airmouseBtn = null;

    // Reset HID server button label element (if any)
    this._elements.serverBtnLabel = null;

    // Reset HID server button element (if any)
    this._elements.serverBtn = null;

    // Reset clickable elements (if any)
    this._elements.clickables = [];

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
    // Query HID server button
    if (cellContent?.id === "remote-button-hid-server") {
      const serverBtn = cellContent;
      this._elements.serverBtn = serverBtn;
      this._elements.serverBtnLabel = serverBtn.querySelector("#hid-server-status");
    }
    // Query airmouse button
    if (cellContent?.id === "remote-button-air-mouse") {
      const airmouseBtn = cellContent;
      this._elements.airmouseBtn = airmouseBtn;
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

  doUpdateAddons() {
    this.doResetAddons();
    this.doCreateAddons();
  }

  doResetAddons() {
    // Clear previous listeners
    this._eventManager.clearListeners("addonsContainer");

    // Detach existing layout from DOM
    this._elements.addons.wrapper.innerHTML = '';

    // Reset addons cells elements (if any)
    this._elements.addons.cells = [];
  }

  doCreateAddons() {
    // Create all addons cells
    for (const [addonCellName, addonCellConfig] of Object.entries(this.getAddonsCellsConfig())) {
      const addonCell = this.doAddonCell(addonCellName, addonCellConfig);
      this.doStyleAddonCell(addonCell, addonCellConfig);
      this.doAttachAddonCell(addonCell);
      this.doQueryAddonCellElements();
      this.doListenAddonCell(addonCell);
    }
  }

  doAddonCell(addonCellName, addonCellConfig) {

    // Define cell default config
    const defaultAddonCellConfig = this.createDynamicAddonCellConfig(addonCellName);

    // Create a new addon cell
    const addonCell = document.createElement("div");
    this.getAddonsCells().push(addonCell);
    addonCell.classList.add('addon-cell');
    addonCell.id = addonCellName;
    this.setAddonCellData(addonCell, addonCellConfig, defaultAddonCellConfig);

    // Create addon cell content
    const addonCellContent = this.doAddonCellContent(addonCellConfig, defaultAddonCellConfig);
    this.doStyleAddonCellContent(addonCellContent, addonCellConfig);
    this.doAttachAddonCellContent(addonCell, addonCellContent);
    this.doQueryAddonCellContentElements(addonCell, addonCellContent);
    this.doListenAddonCellContent();
  
    return addonCell;
  }

  doStyleAddonCell(addonCell, addonConfig) {
    // Nothing to do
  }
  doAttachAddonCell(addonCell) {
    this.getAddonsWrapper().appendChild(addonCell);
  }
  doQueryAddonCellElements() {
    // Nothing to do
  }
  doListenAddonCell(addonCell) {
    // Action and visual events
    this._eventManager.addButtonListeners("addonsContainer", addonCell, 
      {
        [this._eventManager.constructor._BUTTON_CALLBACK_PRESS]: this.onAddonCellPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_ABORT_PRESS]: this.onAddonCellAbortPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_RELEASE]: this.onAddonCellRelease.bind(this)
      }
    );
  }

  onAddonCellPress(addonCell, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doAddonCellPress(addonCell, evt);
  }

  onAddonCellAbortPress(addonCell, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doAddonCellAbortPress(addonCell, evt);
  }

  onAddonCellRelease(addonCell, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doAddonCellRelease(addonCell, evt);
  }

  doAddonCellPress(addonCell, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Addon cell ${addonCell.id} press: action will be triggered on release, nothing to do`));

    // Trigger long press timeout
    this._moreInfoLongPressTimeouts.set(evt.pointerId, { 
      "can-run": true,                   // until proven wrong, long press action can be run
      "was-ran": false,                      // true when action was executed
      "source": addonCell,                        // long press source button
      "timeout": this.addMoreInfoLongPressTimeout(evt)   // when it expires, triggers the associated inner callback to run the action
    });

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doAddonCellAbortPress(addonCell, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Addon cell ${addonCell.id} abort press: action wont be triggered at all, nothing to do`));

    // Remove more info long press timeout (when set before)
    this.clearMoreInfoLongPressTimeout(evt);
    this._moreInfoLongPressTimeouts.delete(evt.pointerId);

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doAddonCellRelease(addonCell, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Addon cell ${addonCell.id} release: triggering associated action...`));

    const moreInfoLongPressEntry = this._moreInfoLongPressTimeouts.get(evt.pointerId);
    
    // Remove override long press timeout (when set before)
    this.clearMoreInfoLongPressTimeout(evt);
    this._moreInfoLongPressTimeouts.delete(evt.pointerId);

    // Retrieve addon cell config
    const addonCellConfig = this._layoutManager.getElementData(addonCell);
    if (moreInfoLongPressEntry && moreInfoLongPressEntry["was-ran"]) {
      // more info action already executed into its long-press Form
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Addon cell ${addonCell.id} release: more info action already executed, nothing else to do`));
    } else {
      // no "more info" action executed: execute standard release Action

      // Retrieve service parameters
      const entityId = this.getAddonCellEntity(addonCellConfig);
      const domain = entityId?.split('.')?.[0];
      const service = this._eventManager.isHassEntityOn(entityId) ? 'turn_off' : 'turn_on';

      // Call service to switch the entity state
      this._eventManager.callService(domain, service, {
        "entity_id": entityId,
      });
    }

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  addMoreInfoLongPressTimeout(evt) {
    return setTimeout(() => {
      const moreInfoLongPressEntry = this._moreInfoLongPressTimeouts.get(evt.pointerId);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addMoreInfoLongPressTimeout(evt) + moreInfoLongPressEntry:`, evt, moreInfoLongPressEntry));

      // When no entry: key has been released before timeout
      if (moreInfoLongPressEntry && moreInfoLongPressEntry["can-run"] && !moreInfoLongPressEntry["was-ran"]) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Long more info action waiting to be executed...`));
        const addonCell = moreInfoLongPressEntry["source"];

        // Check whether or not long click action can be run in current mode
        moreInfoLongPressEntry["can-run"] = true;
        if (!moreInfoLongPressEntry["can-run"]) return;

        // Mark action as ran
        moreInfoLongPressEntry["was-ran"] = true;

        // Execute action
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addMoreInfoLongPressTimeout(evt) + moreInfoLongPressEntry: executing more info action...`, evt, moreInfoLongPressEntry));
        this.executeMoreInfo(addonCell);
      }
    }, this.getTriggerLongClickDelay()); // long-press duration
  }

  clearMoreInfoLongPressTimeout(evt) {
    const timeout = this._moreInfoLongPressTimeouts.get(evt.pointerId)?.["timeout"];
    if (timeout) clearTimeout(timeout);
  }
  
  executeMoreInfo(addonCell) {

    // Retrieve addon cell config
    const addonCellConfig = this._layoutManager.getElementData(addonCell);

    // Checks whether cell configured entity is ON (when entity is configured and exists into HA)
    const entityId = this.getAddonCellEntity(addonCellConfig);
    // const haEntity = document.querySelector("home-assistant");
    this._eventManager.triggerHaosMoreInfoAction(addonCell, entityId);
  }

  doAddonCellContent(addonCellConfig, defaultAddonCellConfig) {

    // Create addon cell content inner label
    const label = document.createElement("div");
    label.className = "addon-label";
    label.textContent = this.getAddonCellLabel(addonCellConfig) || this.getDynamicAddonCellName(defaultAddonCellConfig);
    label.style.color = this.getAddonCellLabelColor(addonCellConfig);
    label.style.fontSize = this.getAddonCellLabelFontScale(addonCellConfig);

    const addonCellContentLabel = document.createElement("div");
    addonCellContentLabel.className = "addon-cell-content-part label half";
    addonCellContentLabel.style.padding = this.getAddonCellLabelGap(addonCellConfig);
    addonCellContentLabel.appendChild(label);


    // Create addon cell content inner image
    const imgHtml = this.getAddonCellImageUrl(addonCellConfig) ? iconsConfig[this.getAddonCellImageUrl(addonCellConfig)]?.["html"] : '';
    const img = document.createElement("div");
    img.className = "addon-img";
    img.innerHTML = imgHtml;
    img._originalFill = this._sideCellButtonFg;
    img._originalStroke = this._sideCellButtonFg;

    const addonCellContentImage = document.createElement("div");
    addonCellContentImage.className = "addon-cell-content-part img half";
    addonCellContentImage.style.padding = this.getAddonCellImageGap(addonCellConfig);
    addonCellContentImage.appendChild(img);

    // Create addon cell content inner icon
    const icoHtml = this.getAddonCellIconUrl(addonCellConfig) ? iconsConfig[this.getAddonCellIconUrl(addonCellConfig)]?.["html"] : '';
    const ico = document.createElement("div");
    ico.className = "addon-icon";
    ico.innerHTML = icoHtml;

    const addonCellContentIcon = document.createElement("div");
    addonCellContentIcon.className = "addon-icon-wrapper";
    addonCellContentIcon.style.padding = this.getAddonCellIconGap(addonCellConfig);
    addonCellContentIcon.appendChild(ico);


    // Create addon cell content
    const addonCellContent = document.createElement("div");
    addonCellContent.className = "addon-cell-content";
    addonCellContent.appendChild(addonCellContentImage);
    addonCellContent.appendChild(addonCellContentLabel);
    addonCellContent.appendChild(addonCellContentIcon);
    return addonCellContent;
  }

  doStyleAddonCellContent(addonCellContent, addonCellConfig) {
    // Nothing to do here
  }

  doAttachAddonCellContent(addonCell, addonCellContent) {
    addonCell.appendChild(addonCellContent);
  }

  doQueryAddonCellContentElements(addonCell, addonCellContent) {
    addonCell._img = addonCellContent.querySelector(".addon-img");
    addonCell._svg = addonCell._img.querySelector('svg');
  }

  doListenAddonCellContent() {
    // Nothing to do here: no events needed on cell content
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
      trigger_repeat_override_delay: 500,
      trigger_repeat_override_decrease_interval: 50,
      trigger_repeat_override_min_interval: 350,
      keyboard: {},
      trackpad: {},
      activities: {},
      airmouse: {},
      addons: {
        cell_label_font_scale: '0.8em',
        cell_image_gap: '0.8em 0.8em 0em 0.8em',
        cell_icon_gap: '0.2em 0.2em 0em 0em',
        cells: {}
      },
      animated_background: {}
    }
  }

  getCardSize() {
    return 4;
  }

  // Set addon cell data
  setAddonCellData(cell, defaultConfig, overrideConfig) {
    this._layoutManager.setElementData(cell, defaultConfig, overrideConfig, (key, value, source) => this._allowedAddonCellData.has(key));
  }

  // Set clickable data
  setClickableData(clickable, defaultConfig, overrideConfig) {
    this._elements.clickables.push(clickable);
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
    if (this.hasValidButtonOverrideRepeatConfigShort(btn)) {
      // Overriden repeated action

      // Execute the override action once
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: overridden repeated key detected, suppressing ${code} to execute override...`));
      this.executeButtonOverride(btn, this._OVERRIDE_TYPE_SHORT_PRESS);

      // Setup repeated override action short while overriden button is pressed
      this.setupOverrideRepeatedTimeout(evt, btn, this._OVERRIDE_TYPE_SHORT_PRESS);

    } else if (this.hasButtonOverrideConfigShort(btn) || this.hasButtonOverrideConfigLong(btn) || this.isServerButton(btn) || this.isAirmouseButton(btn)) {

      // Nothing to do: overriden action will be executed on key release
      if (this.hasButtonOverrideConfigShort(btn)) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: overridden key for ${this.getRemoteMode()} on ${this._OVERRIDE_TYPE_SHORT_PRESS} detected, nothing to press`));
      }

      // Triggering override long click timeout
      if (this.hasButtonOverrideConfigLong(btn) || this.isServerButton(btn) || this.isAirmouseButton(btn)) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: server switch or overridden key for ${this.getRemoteMode()} on ${this._OVERRIDE_TYPE_LONG_PRESS} detected, triggering long-press timeout...`));
        this._overrideLongPressTimeouts.set(evt.pointerId, { 
          "can-run": true,                                   // until proven wrong, long press action can be run
          "was-ran": false,                                  // true when action was executed
          "source": btn,                                     // long press source button
          "source-mode": this.getRemoteMode(),               // long press source mode when timeout starts (normal, alt)
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

    // Remove repeated override timeout (when set before)
    this.clearOverrideRepeatedTimeout(evt)
    this._overrideRepeatedTimeouts.delete(evt.pointerId);

    // Retrieve clickable button data
    const btnData = this._layoutManager.getElementData(btn);
    if (!btnData) return;

    // Key code to abort press
    const code = btnData.code;
    if (this.hasButtonOverrideConfigShort(btn) || this.hasButtonOverrideConfigLong(btn) || this.isServerButton(btn) || this.isAirmouseButton(btn)) {

      // Nothing to do: overriden action has not (and wont be) executed because key release wont happen
      if (this.hasButtonOverrideConfigShort(btn)) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} abort press: overridden short key press detected, nothing to abort`));
      }

      // Overriden long click did not happened: nothing to do, overriden action has not (and wont be) executed because key release wont happen
      if (this.hasButtonOverrideConfigLong(btn)) {
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
    const overrideRepeatedEntry = this._overrideRepeatedTimeouts.get(evt.pointerId);
    
    // Remove override long press timeout (when set before)
    this.clearOverrideLongPressTimeout(evt);
    this._overrideLongPressTimeouts.delete(evt.pointerId);

    // Remove repeated override timeout (when set before)
    this.clearOverrideRepeatedTimeout(evt)
    this._overrideRepeatedTimeouts.delete(evt.pointerId);

    // Retrieve clickable button data
    const btnData = this._layoutManager.getElementData(btn);
    if (!btnData) return;

    // Key code to release
    const code = btnData.code;
    if (overrideRepeatedEntry) {
      // Overriden repeated action already executed into its short-press or long-press Form
      const overrideType = overrideRepeatedEntry['source-type'];
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} release: overridden repeated key detected but action already executed into ${this.getRemoteMode()} ${overrideType}, nothing else to do`));
    } else if (overrideLongPressEntry && overrideLongPressEntry["was-ran"]) {
      // Overriden action already executed into its long-press Form
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} release: overridden key detected but action already executed into ${this.getRemoteMode()} ${this._OVERRIDE_TYPE_LONG_PRESS}, nothing else to do`));
    } else if (this.isAirmouseButton(btn)) {
      // Airmouse button can be short pressed but not overriden
      const currentAirmouseMode = this.getAirMouse().isMoveEnabled();
      const nextAirmouseMode = !currentAirmouseMode;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} release: switching airmouse mode from ${currentAirmouseMode} to ${nextAirmouseMode}...`, btn));
      this.setAirmouseEnabled(nextAirmouseMode);
    } else if (this.hasButtonOverrideConfigShort(btn)) {
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

  hasValidButtonOverrideRepeatConfigShort(btn) {
    return this.hasButtonOverrideRepeatConfigShort(btn);
  }
  hasValidButtonOverrideRepeatConfigLong(btn) {
    return this.hasButtonOverrideRepeatConfigLong(btn) && !this.hasButtonOverrideRepeatConfigShort(btn);
  }
  hasButtonOverrideRepeatConfigShort(btn) {
    return (btn.id && this.getButtonOverrideRepeatConfig(this._eventManager.getCurrentServerId(), btn.id, this.getRemoteMode(), this._OVERRIDE_TYPE_SHORT_PRESS));
  }
  hasButtonOverrideRepeatConfigLong(btn) {
    return (btn.id && this.getButtonOverrideRepeatConfig(this._eventManager.getCurrentServerId(), btn.id, this.getRemoteMode(), this._OVERRIDE_TYPE_LONG_PRESS));
  }
  hasButtonOverrideConfigShort(btn) {
    return (btn.id && this.getButtonOverrideRawConfig(this._eventManager.getCurrentServerId(), btn.id, this.getRemoteMode(), this._OVERRIDE_TYPE_SHORT_PRESS));
  }
  hasButtonOverrideConfigLong(btn) {
    return (btn.id && this.getButtonOverrideRawConfig(this._eventManager.getCurrentServerId(), btn.id, this.getRemoteMode(), this._OVERRIDE_TYPE_LONG_PRESS));
  }

  isServerButton(btn) {
    return (btn && this._elements.serverBtn === btn);
  }
  isAirmouseButton(btn) {
    return (btn && this._elements.airmouseBtn === btn);
  }
  getRemoteMode() {
    const mode = this._eventManager.getUserPreferenceRemoteMode();
    return this._knownRemoteModes.has(mode) ? mode : this._OVERRIDE_NORMAL_MODE; // Default to normal mode when unknown mode (undefined, not in known modes...)
  }
  setRemoteMode(mode) {
    this._eventManager.setUserPreferenceRemoteMode(mode);
  }

  addOverrideLongPressTimeout(evt) {
    return setTimeout(() => {
      const overrideLongPressEntry = this._overrideLongPressTimeouts.get(evt.pointerId);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addOverrideLongPressTimeout(evt) + overrideLongPressEntry:`, evt, overrideLongPressEntry));

      // When no entry: key has been released before timeout
      if (overrideLongPressEntry && overrideLongPressEntry["can-run"] && !overrideLongPressEntry["was-ran"]) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addOverrideLongPressTimeout(evt) + overrideLongPressEntry: Long action waiting to be executed...`, evt, overrideLongPressEntry));
        const btn = overrideLongPressEntry["source"];

        // Check whether or not long click action can be run in current mode
        overrideLongPressEntry["can-run"] = (overrideLongPressEntry["source-mode"] === this.getRemoteMode());
        if (!overrideLongPressEntry["can-run"]) return;

        // Mark action as ran
        overrideLongPressEntry["was-ran"] = true;

        // Execute action
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addOverrideLongPressTimeout(evt) + overrideLongPressEntry: executing ${this.getRemoteMode()} ${this._OVERRIDE_TYPE_LONG_PRESS} action...`, evt, overrideLongPressEntry));
        this.executeButtonOverride(btn, this._OVERRIDE_TYPE_LONG_PRESS);

        if (this.hasValidButtonOverrideRepeatConfigLong(btn)) {
          // Overriden repeated action

          // Setup repeated override action long while overriden button is pressed
          this.setupOverrideRepeatedTimeout(evt, btn, this._OVERRIDE_TYPE_LONG_PRESS);
        }

      }
    }, this.getTriggerLongClickDelay()); // long-press duration
  }

  clearOverrideLongPressTimeout(evt) {
    const timeout = this._overrideLongPressTimeouts.get(evt.pointerId)?.["timeout"];
    if (timeout) clearTimeout(timeout);
  }

  setupOverrideRepeatedTimeout(evt, btn, overridetype) {
    this._overrideRepeatedTimeouts.set(evt.pointerId, {
      "can-run": true,                                      // until proven wrong, repeated override action can be run
      "source": btn,                                        // source button
      "source-mode": this.getRemoteMode(),                  // source mode when timeout starts (normal, alt)
      "source-type": overridetype,       // source type when timeout starts (short, long)
      "timeout": this.addOverrideRepeatedTimeout(evt, this.getTriggerRepeatOverrideDelay())  // when it expires, triggers the associated inner callback to run the action
    });
  }

  addOverrideRepeatedTimeout(evt, triggerDelay) {
    return setTimeout(() => {
      const overrideRepeatedTriggerEntry = this._overrideRepeatedTimeouts.get(evt.pointerId);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addOverrideRepeatedTimeout(evt, triggerDelay)`, evt, triggerDelay));

      if (overrideRepeatedTriggerEntry && overrideRepeatedTriggerEntry["can-run"]) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addOverrideRepeatedTimeout(evt, triggerDelay) + overrideRepeatedTriggerEntry: repeated override action waiting to be executed...`, evt, triggerDelay, overrideLongPressEntry));
        const btn = overrideRepeatedTriggerEntry["source"];

        // Check whether or not long click action can be run in current mode
        overrideRepeatedTriggerEntry["can-run"] = (overrideRepeatedTriggerEntry["source-mode"] === this.getRemoteMode());
        if (!overrideRepeatedTriggerEntry["can-run"]) return;

        // Execute action
        const overrideType = overrideRepeatedTriggerEntry["source-type"];
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addOverrideRepeatedTimeout(evt, triggerDelay) + overrideRepeatedTriggerEntry: executing ${this.getRemoteMode()} ${overrideType} action...`, evt, triggerDelay, overrideLongPressEntry));
        this.executeButtonOverride(btn, overrideType);

        // Compute next trigger delay
        const nextTriggerDelay = Math.max(this.getTriggerRepeatOverrideMinInterval(), triggerDelay - this.getTriggerRepeatOverrideDecreaseInterval())
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`addOverrideRepeatedTimeout(evt, triggerDelay): next override action will be triggered in ${nextTriggerDelay}ms`));

        // Add next override trigger event
        this._overrideRepeatedTimeouts.set(evt.pointerId, {
          "can-run": overrideRepeatedTriggerEntry["can-run"],
          "source": overrideRepeatedTriggerEntry["source"],
          "source-mode": overrideRepeatedTriggerEntry["source-mode"],
          "source-type": overrideRepeatedTriggerEntry["source-type"],
          "timeout": this.addOverrideRepeatedTimeout(evt, nextTriggerDelay)  // New delay before next override action
        });
      }
    }, triggerDelay); // next override action duration
  }

  clearOverrideRepeatedTimeout(evt) {
    const timeout = this._overrideRepeatedTimeouts.get(evt.pointerId)?.["timeout"];
    if (timeout) clearTimeout(timeout);
  }

  executeButtonOverride(btn, pressType) {

    // Retrieve button override config
    const serverId = this._eventManager.getCurrentServerId();
    const buttonId = btn.id;
    const remoteMode = this.getRemoteMode();
    const overrideConfig = this.getButtonOverrideConfig(serverId, buttonId, remoteMode, pressType);
    if (this.isServerButton(btn)) {
      // Server button retrieved
      
      // switch to next available HID server
      const currentServer = this._eventManager.getCurrentServer();
      const nextServer = this._eventManager.getNextServer();
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching from ${this._eventManager.getServerName(currentServer)} server to ${this._eventManager.getServerName(nextServer)} server...`, btn));
      this.setCurrentServer(nextServer);
    } else if (this.isAirmouseButton(btn)) {
      // Airmouse button retrieved
      
      // switch airmouse mode
      const currentAirmouseMode = this.getAirMouse().isMoveEnabled();
      const nextAirmouseMode = !currentAirmouseMode;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching airmouse mode from ${currentAirmouseMode} to ${nextAirmouseMode}...`, btn));
      this.setAirmouseEnabled(nextAirmouseMode);
    } else if (overrideConfig ===  this._OVERRIDE_NONE) {
      // Typed config "none"
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): none action for ${remoteMode} mode ${pressType} press, nothing to do`, btn));
    } else if (overrideConfig ===  this._OVERRIDE_ALTERNATIVE_MODE ||
        overrideConfig === this._OVERRIDE_NORMAL_MODE) {
      // Typed config switches mode

      // Switch mode
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching from ${remoteMode} mode to ${overrideConfig} mode ...`, btn));
      this.setRemoteMode(overrideConfig);
      this.doUpdateRemoteMode();
    } else if (overrideConfig ===  this._OVERRIDE_SWITCH_SIDE_PANEL) {
      // Typed config switches side panel open/close

      // Switch mode
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching side panel visibility (from ${this._sidePanelVisible} to ${!this._sidePanelVisible})...`, btn));
      this._sidePanelVisible = !this._sidePanelVisible;
      if (this._sidePanelVisible) {
        btn.classList.add("locked");
        this._elements.wrapper.classList.add("with-addons");
        this.getAddonsWrapper().classList.remove("hide");
      } else {
        btn.classList.remove("locked");
        this._elements.wrapper.classList.remove("with-addons");
        this.getAddonsWrapper().classList.add("hide");
      }
    } else {
      // Typed config defines an action (related to sensor state or not)

      // Execute action whenever sub-config defined (handled by this._eventManager.executeButtonOverride)
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): executing override action for serverId: ${serverId}, buttonId: ${buttonId}, remoteMode: ${remoteMode}, pressType: ${pressType}...`, btn));
      this._eventManager.executeButtonOverride(btn, overrideConfig);
    }
  }

  doUpdateRemoteMode() {
    const serverId = this._eventManager.getCurrentServerId();
    const remoteMode = this.getRemoteMode();
    const remoteModeBtns = (this.getClickables() ?? []).filter(btn => {
      const buttonId = btn.id;
      return this._knownRemoteModes.has(this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_SHORT_PRESS)) ||
             this._knownRemoteModes.has(this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_LONG_PRESS));
    });
    for (const remoteModeBtn of remoteModeBtns) {
      if (remoteMode === this._OVERRIDE_ALTERNATIVE_MODE) remoteModeBtn.classList.add("locked");
      if (remoteMode === this._OVERRIDE_NORMAL_MODE) remoteModeBtn.classList.remove("locked");
    }
  }
  
  doUpdateAirmouseMode() {
    const airMouseBtn = this._elements.airmouseBtn;
    if (airMouseBtn) {
      const isAirmouseEnabled = this.getAirMouse().isMoveEnabled();
      if (isAirmouseEnabled) airMouseBtn.classList.add("locked");
      if (!isAirmouseEnabled) airMouseBtn.classList.remove("locked");
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
    this._eventManager.callComponentServiceWithServerId("keypress", {
      sendModifiers: Array.from(this._pressedModifiers),
      sendKeys: Array.from(this._pressedKeys),
    });
  }

  // Send all current pressed modifiers and keys to HID keyboard
  sendConsumerUpdate() {
    this._eventManager.callComponentServiceWithServerId("conpress", {
      sendCons: Array.from(this._pressedConsumers),
    });
  }

}

if (!customElements.get("android-remote-card")) customElements.define("android-remote-card", AndroidRemoteCard);
