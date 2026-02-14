import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';
import { androidRemoteCardConfig, androidRemoteCardStyles } from './configs/android-remote-card-config.js';
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
  _defaultCellStyles = androidRemoteCardStyles;
  _defaultCellImages = iconsConfig;
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();
  _allowedClickableData = new Set(['code']);
  _allowedAddonCellData = new Set(['name', 'action', 'entity']);
  _allowedServerCellData = new Set(['name', 'server_id', 'server_name']);
  _visuallyOverridableConfigKeys = ['image_remote_button', 'image_url', 'image_styles'];
  _cellButtonFg = '#bfbfbf';
  _cellButtonBg = '#3a3a3a';
  _sideCellButtonFg = '#bfbfbf';
  _sideCellButtonBg = '#3a3a3a';
  _cellButtonActiveBg = '#4a4a4a';
  _cellButtonPressBg = '#6a6a6a';
  _OVERRIDE_NORMAL_MODE = 'normal_mode';
  _OVERRIDE_ALTERNATIVE_MODE = 'alt_mode';
  _OVERRIDE_SWITCH_SIDE_PANEL = 'switch_side';
  _OVERRIDE_SWITCH_BOTTOM_PANEL = 'switch_bottom';
  _OVERRIDE_TYPE_SHORT_PRESS = 'short_press';
  _OVERRIDE_TYPE_LONG_PRESS = 'long_press';
  _OVERRIDE_SAME = 'same';
  _OVERRIDE_NONE = 'none';
  _STYLENAME_SPAN_RGX = /^span-(\d+)(?:-(\d+))?$/;
  _STYLENAME_SCALE_RGX = /^scale-(\d+)(?:-(\d+))?$/;
  _STYLENAME_ROTATE_RGX = /^rotate-(\d+)(?:-(\d+))?$/;
  _STYLENAME_SCALE_ROTATE_RGX = /^scale-(\d+)(?:-(\d+))?-rotate-(\d+)(?:-(\d+))?$/;

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
  _knownRemoteSwitchSides = new Set([this._OVERRIDE_SWITCH_SIDE_PANEL]);
  _knownRemoteSwitchBottoms = new Set([this._OVERRIDE_SWITCH_BOTTOM_PANEL]);
  _overrideMode = this._OVERRIDE_NORMAL_MODE;
  _overrideRepeatedTimeouts = new Map();
  _overrideLongPressTimeouts = new Map();
  _moreInfoLongPressTimeouts = new Map();
  _sidePanelVisible = false;
  _bottomPanelVisible = false;

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
    this.doUpdateOverridables();
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
    this.doUpdateServers();
    this.doUpdateManagedPreferences();
    this.doUpdateCurrentServer();
    this.doUpdateCellsVisualAndState();
    this.doUpdateAirmouseMode();
  }

  setCurrentServer(server) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("setCurrentServer(server):", server));
    this._eventManager.setCurrentServer(server);
    this.doUpdateCurrentServer();
    this.doUpdateCellsVisualAndState();
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

  getServersConfig() {
    return this._layoutManager.getFromConfigOrDefaultConfig("servers");
  }

  getServersCellsConfig() {
    return this.getServersConfig()?.["cells"];
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
  getButtonOverrideImageRemoteButtonConfig(serverId, buttonId, mode) {
    return this.getButtonOverrideModeConfig(serverId, buttonId, mode)?.['image_remote_button']
  }
  getButtonOverrideImageUrlConfig(serverId, buttonId, mode) {
    return this.getButtonOverrideModeConfig(serverId, buttonId, mode)?.['image_url']
  }
  getButtonOverrideImageStylesConfig(serverId, buttonId, mode) {
    return this.getButtonOverrideModeConfig(serverId, buttonId, mode)?.['image_styles']
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
    const overrideConfig = this.getButtonOverrideConfig(serverId, buttonId, mode, type);
    // Javascript gotcha 'prototype pollution by design':
    // strings already have a .repeat() method, so when we do a generic "give me repeat if it exists", 
    // JS happily hands us the native one instead of nothing.
    if (overrideConfig && typeof overrideConfig === "object" && Object.hasOwn(overrideConfig, "repeat")) {
      return overrideConfig.repeat;
    }
    return undefined;
  }

  getCellConfigOrDefault(defaultCellConfig, cellConfig, key) {
   let value = null;
   if (defaultCellConfig && defaultCellConfig[key]) value = defaultCellConfig[key]; // Default config
   if (cellConfig && cellConfig[key]) value = cellConfig[key]; // User defined Config
   return value;
  }

  getCellConfigImageStyles(defaultCellConfig, cellConfig) {
    return this.getCellConfigOrDefault(defaultCellConfig, cellConfig, "image-styles");
  }

  getCellConfigImage(defaultCellConfig, cellConfig) {
   return this.getCellConfigOrDefault(defaultCellConfig, cellConfig, "image");
  }

  getCellConfigImageHtml(defaultCellConfig, cellConfig) {
   const cellImage = this.getCellConfigImage(defaultCellConfig, cellConfig);
   return this.getCellImageHtml(cellImage);
  }

  isFromCellConfigHtml(defaultCellConfig, cellConfig) {
    return ((defaultCellConfig && defaultCellConfig.html) || cellConfig.html);
  }

  getCellImageHtml(cellImage) {
   return cellImage ? this._defaultCellImages[cellImage]?.["html"] : null;
  }

  getCellsConfigs() {
    return this._elements.cellsConfigs;
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

  getServersWrapper() {
    return this._elements.servers.wrapper;
  }
  
  getServersCells() {
    return this._elements.servers.cells;
  }

  // Per server cell config
  getServerCellLabel(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "label"); 
  }
  getServerCellLabelFontScale(serverCellConfig) {
    return this._layoutManager.getScaleOrDefault(this.getServerCellConfigOrDefault(serverCellConfig, "label_font_scale"), "1rem");
  }
  getServerCellLabelColor(serverCellConfig) {
    return this._sideCellButtonFg;
  }
  getServerCellWidth(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "width");
  }
  getServerCellHeight(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "height");
  }
  getServerCellLabelGap(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "label_gap");
  }
  getServerCellIconUrl(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "icon_url");
  }
  getServerCellIconGap(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "icon_gap");
  }
  getServerCellImageUrl(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "image_url");
  }
  getServerCellImageGap(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "image_gap");
  }
  getServerCellAction(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "action");
  }
  getServerCellEntity(serverCellConfig) {
    return this.getServerCellConfigOrDefault(serverCellConfig, "entity");
  }

  // Per cell config helper
  getServerCellConfigOrDefault(serverCellConfig, property) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("getServerCellConfigOrDefault(serverCellConfig, property):", serverCellConfig, property));
    const cellProperty = `cell_${property}`;
    return serverCellConfig?.[property] || 
          (this._layoutManager.isDefined(this._layoutManager.getFromConfig("servers")?.[cellProperty]) 
            ? this._layoutManager.getFromConfig("servers")?.[cellProperty] 
            : this._layoutManager.getFromDefaultConfig("servers")?.[cellProperty]);
  }

  // Dynamic config
  getDynamicServerCellName(defaultServerCellConfig) {
    return defaultServerCellConfig["name"]; 
  }
  getDynamicServerCellServerId(defaultServerCellConfig) {
    return defaultServerCellConfig["server_id"]; 
  }
  getDynamicServerCellServerName(defaultServerCellConfig) {
    return defaultServerCellConfig["server_name"]; 
  }
  createDynamicServerCellConfig(server) {
    const serverId = server?.id;
    const name = `server-${serverId}`;
    const serverName = server?.name;
    return { "name": name, "server_id": serverId, "server_name": serverName };
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

  createServersContent() {
    this._elements.servers = {};
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
        <div class="servers-wrapper hide">
        </div>
      </div>
    `;

    this.createManagedContent();
    this.createAddonsContent();
    this.createServersContent();
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
      .servers-wrapper {
        width: 100%;
        position: relative;
        bottom: 0;
        left: 0;
        height: 11.1112%; /* 1/9 */
        display: flex;
        flex-direction: row;
        overflow-x: auto;
        box-sizing: border-box;
        border: 1px solid var(--cell-button-bg);
        border-radius: var(--card-border-radius);
      }
      .servers-wrapper.with-addons,
      .wrapper.with-addons {
        width: 83.3333%; /* 5/6 */
      }
      .wrapper.with-servers {
        height: 88.8888%; /* 8/9 */
      }
      .hide {
        display: none;
      }
      .device-cell {
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
      .device-cell.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background-color: var(--cell-active-bg);
      }
      .device-cell.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background-color: var(--cell-press-bg);
        transform: scale(0.95);
      }
      .device-cell.${this._eventManager.constructor._BUTTON_CLASS_HOVER} * {
        opacity: 0.95;
      }
      .device-cell.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} * {
        opacity: 0.85;
      }
      .device-cell-content {
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
      .device-cell-content-part {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      }
      .device-cell-content-part.img.half {
        height: 60%;
      }
      .device-cell-content-part.label.half {
        height: 40%;
      }
      .device-cell-content-part.full {
        height: 100%;
      }
      .device-icon-wrapper {
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
      .device-icon {
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
      .device-icon svg {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .device-img {
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
      .device-img svg {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .device-label {
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
      .circle-button-icon {
        height: 100%;
        width: auto;
        display: block;
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
    this._elements.servers.wrapper = card.querySelector(".servers-wrapper");
    this._elements.animatedBackground = card.querySelector(".animated-background");
  }

  doListen() {
    // Nothing to do here: events are listened per sub-element
  }

  doUpdateConfig() {
    if (this._layoutManager.configuredLayoutChanged()) {
      this.doUpdateLayout();
    }
    this.doUpdateOverridables();
    this.doUpdateAddons();
    this.doUpdateServers();
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
    // Update visually overridable cells and cells bound to state entities
    this.doUpdateCellsVisualAndState();
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
      const stateColor = this._layoutManager.getStateColor();
      if (svg && rgbColor && stateColor === 'rgb') {
        // RGB color available

        // Remove "sensor-on" class just in case (to avoid styles collision)
        img.classList.remove("sensor-on");

        // Apply RGB color
        const [r, g, b] = rgbColor;
        const color = `rgb(${r}, ${g}, ${b})`;
        svg.style.fill = color;
        svg.style.stroke = color;
      } else {
        // RGB color unavailable or RGB state color disabled (entity could be off, or could be unrelated to lights - ie. a switch)
        
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

    // Reset cells configs mapped by id (if any)
    this._elements.cellsConfigs = new Map();

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

    // Append current cell config
    this._elements.cellsConfigs.set(cellName, cellConfig);

    // Retrieve default cell config that matches the cell name (when available)
    const defaultCellConfig = this._defaultCellConfigs[cellName];

    // Define cell content tag
    let cellContentTag = null;
    if (defaultCellConfig && defaultCellConfig.tag) cellContentTag = defaultCellConfig.tag; // Default config
    if (cellConfig.tag) cellContentTag = cellConfig.tag; // Override with user config when specified
    if (!cellContentTag) cellContentTag = "button"; // Fallback to "button" when no default nor user config available

    // Define cell content class
    let cellContentClass = null;
    if (defaultCellConfig && defaultCellConfig.style) cellContentClass = defaultCellConfig.style; // Default config
    if (cellConfig.style) cellContentClass = cellConfig.style; // Override with user config when specified
    if (!cellContentClass && cellContentTag === "button") cellContentClass = "circle-button"; // Fallback to "circle-button" style when no default nor user config available and tag is a button

    // Define cell content inner html (when available)
    let cellContentHtml = null;
    if (defaultCellConfig && defaultCellConfig.image) cellContentHtml = this.getCellImageHtml(defaultCellConfig.image); // Default config (predefined image)
    if (defaultCellConfig && defaultCellConfig.html) cellContentHtml = defaultCellConfig.html; // Default config (predefined html)
    if (cellConfig.image) cellContentHtml = this.getCellImageHtml(cellConfig.image); // Override with user configured image when specified
    if (cellConfig.html) cellContentHtml = cellConfig.html; // Override with user configured html when specified
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

    // Apply cellContent children styles
    let imageStyles = this.getCellConfigImageStyles(defaultCellConfig, cellConfig);
    if (imageStyles) {
      const isFromImage = !this.isFromCellConfigHtml(defaultCellConfig, cellConfig);
      for (const cellContentChild of (cellContent.children ? Array.from(cellContent.children) : [])) {
        for (const imageStyle of imageStyles) {

          // Create cellContent child style
          const cellContentChildStyle = this.createImageClass(imageStyle)

          // Apply style to cellContent child when child is a predefined image 
          // (custom HTML child should manage its own styles)
          if (isFromImage) cellContentChild.classList.add(cellContentChildStyle);
        }
      }
    }

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
      this._elements.serverBtnLabel = (serverBtn.children ? Array.from(serverBtn.children) : []).at(0);
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
    let arrowContentHtml = null;
    if (defaultQuarterConfig && defaultQuarterConfig.image) arrowContentHtml = this.getCellImageHtml(defaultQuarterConfig.image);
    if (defaultQuarterConfig && defaultQuarterConfig.html) arrowContentHtml = defaultQuarterConfig.html;
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

  createImageClass(styleName) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("createImageClass(styleName):", styleName));

    // Default image style (when existing)
    const styleContent = this._defaultCellStyles[styleName];
    if (styleContent) return this.createOrRetrieveClass(styleName, (name) => {
      return `
      .${styleName} ${styleContent}`
    });

    // Custom span style
    const span = this.extractOneNumber(this._STYLENAME_SPAN_RGX, styleName);
    if (span !== null) return this.createSpanClass(flex);

    // Custom scale style
    const scale = this.extractOneNumber(this._STYLENAME_SCALE_RGX, styleName);
    if (scale !== null) return this.createScaleClass(scale);

    // Custom rotate style
    const rotate = this.extractOneNumber(this._STYLENAME_ROTATE_RGX, styleName);
    if (rotate !== null) return this.createRotateClass(rotate);

    // Custom scale then rotate style
    const scaleRotate = this.extractTwoNumbers(this._STYLENAME_SCALE_ROTATE_RGX, styleName);
    if (scaleRotate !== null) return this.createScaleThenRotateClass(scaleRotate[0], scaleRotate[1]);

    return styleName;
  }

  createSpanClass(flex) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("createSpanClass(flex):", flex));
    const styleName = `span-${this.getSafeStyleName(flex)}`;
    return this.createOrRetrieveClass(styleName, (name) => {
        return `
        .${styleName} {
          flex: ${flex};
        }`
    });
  }

  createScaleClass(scale) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("createScaleClass(scale):", scale));
    const styleName = `scale-${this.getSafeStyleName(scale)}`;
    return this.createOrRetrieveClass(styleName, (name) => {
      return `
      .${styleName} {
        transform: scale(${scale}, ${scale});
      }`
    });
  }

  createRotateClass(rotate) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("createRotateClass(rotate):", rotate));
    const styleName = `rotate-${this.getSafeStyleName(rotate)}`;
    return this.createOrRetrieveClass(styleName, (name) => {
      return `
      .${styleName} {
        transform: rotate(${rotate}deg);
      }`
    });
  }

  createScaleThenRotateClass(scale, rotate) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("createScaleThenRotateClass(scale, rotate):", scale, rotate));
    const styleName = `scale-${this.getSafeStyleName(scale)}-rotate-${this.getSafeStyleName(rotate)}`;
    return this.createOrRetrieveClass(styleName, (name) => {
        return `
        .${styleName} {
          transform: scale(${scale}, ${scale}) rotate(${rotate}deg);
        }`
    });
  }

  createOrRetrieveClass(styleName, styleCallback) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("createOrRetrieveClass(styleName, styleCallback):", styleName, styleCallback));
    if (styleName && styleCallback && !this._dynamicStyleNames.has(styleName)) {
      const dynamicStyle = styleCallback(styleName) ?? '';
      this._elements.style.textContent += dynamicStyle;
      this._dynamicStyleNames.add(styleName);
    }
    return styleName;
  }

  extractOneNumber(rgx, styleName) {
    const match = styleName.match(rgx);
    if (!match) return null;
    return this.getNumberFrom(match[1], match[2]);
  }

  extractTwoNumbers(rgx, styleName) {
    const match = styleName.match(rgx);
    if (!match) return null;
    return {
      one: this.getNumberFrom(match[1], match[2]), 
      two: this.getNumberFrom(match[3], match[4])
    };
  }

  getNumberFrom(integerPart, decimalPart) {
    const value = decimalPart !== undefined
      ? `${integerPart}.${decimalPart}`
      : integerPart;
    return Number(value);
  }

  getSafeStyleName(decimal) {
    const decimalStr = String(decimal);
    return decimalStr.replace(/\./g, '-');
  }

  doUpdateOverridables() {
    this.doResetOverridables();
    this.doCreateOverridables();
  }

  doResetOverridables() {
    // Reset overridables elements (if any)
    this._elements.visuallyOverridables = new Set();

    // Reset remote mode overridables elements (if any)
    this._elements.remoteModeOverridables = new Set();

    // Reset side panel overridables elements (if any)
    this._elements.sidePanelOverridables = new Set();

    // Reset bottom panel overridables elements (if any)
    this._elements.bottomPanelOverridables = new Set();
  }

  doCreateOverridables() {
    // Setup visually overridables cells Set()
    this.doSetupOverridables();

    // Update visually overridables cells and update cells states
    this.doUpdateCellsVisualAndState();
  }

  doSetupOverridables() {
    const overrides = this._layoutManager.getFromConfigOrDefaultConfig("buttons_overrides");
    const serversOverrides = (overrides && typeof overrides === "object") ? overrides : {};
    for (const [serverId, serverOverrides] of Object.entries(serversOverrides)) {

      const buttonsOverrides = (serverOverrides && typeof serverOverrides === "object") ? serverOverrides : {};
      for (const [buttonId, buttonOverrides] of Object.entries(buttonsOverrides)) {

        const modesOverrides = (buttonOverrides && typeof buttonOverrides === "object") ? buttonOverrides : {};
        for (const [modeId, modeOverrides] of Object.entries(modesOverrides)) {

          const shortPressOverride = modeOverrides?.[this._OVERRIDE_TYPE_SHORT_PRESS];
          const longPressOverride = modeOverrides?.[this._OVERRIDE_TYPE_LONG_PRESS];

          if (modeOverrides && typeof modeOverrides === "object" && this.hasAnyOwn(modeOverrides, this._visuallyOverridableConfigKeys)) {
            this._elements.visuallyOverridables.add(buttonId);
          }

          if (this._knownRemoteModes.has(shortPressOverride) || this._knownRemoteModes.has(longPressOverride)) {
            this._elements.remoteModeOverridables.add(buttonId);
          }

          if (this._knownRemoteSwitchSides.has(shortPressOverride) || this._knownRemoteSwitchSides.has(longPressOverride)) {
            this._elements.sidePanelOverridables.add(buttonId);
          }

          if (this._knownRemoteSwitchBottoms.has(shortPressOverride) || this._knownRemoteSwitchBottoms.has(longPressOverride)) {
            this._elements.bottomPanelOverridables.add(buttonId);
          }
        }
      }
    }
  }

  doUpdateCellsVisualAndState() {
    // Update buttons overriden with sensors configuration (buttons sensors data + buttons visuals)
    const serverId = this._eventManager.getCurrentServerId();
    const remoteMode = this.getRemoteMode();

    // Update clickable cells visuals
    for (const btn of (this.getClickables() ?? [])) {
      const buttonId = btn.id;

      // When cell visual is visually overridable, update cell visual
      if (this._elements.visuallyOverridables.has(buttonId)) this.doUpdateCellVisual(serverId, buttonId, remoteMode, btn);

      // When cell visual is remote mode overridable, update cell remote mode
      if (this._elements.remoteModeOverridables.has(buttonId)) this.doUpdateCellRemoteMode(serverId, buttonId, remoteMode, btn);

      // When cell visual is side panel mode overridable, update cell side panel mode
      if (this._elements.sidePanelOverridables.has(buttonId)) this.doUpdateCellSidePanelMode(serverId, buttonId, remoteMode, btn);

      // When cell visual is side panel mode overridable, update cell side panel mode
      if (this._elements.bottomPanelOverridables.has(buttonId)) this.doUpdateCellBottomPanelMode(serverId, buttonId, remoteMode, btn);

      // Update cell state and associated visual
      this.doUpdateCellState(serverId, buttonId, remoteMode, btn);
    }

    // Update side panel state
    this.doUpdateSidePanel();

    // Update bottom panel state
    this.doUpdateBottomPanel();
  }

  doUpdateCellVisual(serverId, buttonId, remoteMode, btn) {
    // Retrieve cell configurations overrides related to image
    const overrideCellId = this.getButtonOverrideImageRemoteButtonConfig(serverId, buttonId, remoteMode);
    const overrideImageId = this.getButtonOverrideImageUrlConfig(serverId, buttonId, remoteMode);
    const overrideImageStyles = this.getButtonOverrideImageStylesConfig(serverId, buttonId, remoteMode);

    // Retrieve new cellContent related cell id
    const newCellId = overrideCellId ?? buttonId;
    const newDefaultCellConfig = this._defaultCellConfigs[newCellId];
    const newCellConfig = this.getCellsConfigs().get(newCellId);

    // Retrieve cellContent image new HTML
    const newImageId = overrideImageId ?? this.getCellConfigImage(newDefaultCellConfig, newCellConfig);
    const newHtmlImage = this.getCellImageHtml(newImageId);

    // Retrieve cellContent image new CSS
    const newImageStyles = overrideImageStyles ?? ( ((!overrideCellId && !overrideImageId && !overrideImageStyles) || overrideCellId) ? this.getCellConfigImageStyles(newDefaultCellConfig, newCellConfig) : []);
    const newHtmlImageStyles = (newImageStyles ? (Array.isArray(newImageStyles) ? newImageStyles : [newImageStyles]) : []);

    // Apply cellContent image new HTML + CSS
    btn.innerHTML = newHtmlImage;
    for (const visuallyOverridableCellChild of (btn.children ? Array.from(btn.children) : [])) {
      for (const imageStyle of newHtmlImageStyles) {
        visuallyOverridableCellChild.classList.add(this.createImageClass(imageStyle));
      }
    }
  }

  doUpdateCellRemoteMode(serverId, buttonId, remoteMode, btn) {
    if (this._knownRemoteModes.has(this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_SHORT_PRESS)) ||
        this._knownRemoteModes.has(this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_LONG_PRESS))) {
      if (remoteMode === this._OVERRIDE_ALTERNATIVE_MODE) btn.classList.add("locked");
      if (remoteMode === this._OVERRIDE_NORMAL_MODE) btn.classList.remove("locked");
    } else {
      btn.classList.remove("locked");
    }
  }
  
  doUpdateCellSidePanelMode(serverId, buttonId, remoteMode, btn) {
    if (this._knownRemoteSwitchSides.has(this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_SHORT_PRESS)) ||
        this._knownRemoteSwitchSides.has(this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_LONG_PRESS))) {
       if (this._sidePanelVisible) btn.classList.add("locked");
       if (!this._sidePanelVisible) btn.classList.remove("locked");
    } else {
      btn.classList.remove("locked");
    }
  }

  doUpdateCellBottomPanelMode(serverId, buttonId, remoteMode, btn) {
    if (this._knownRemoteSwitchBottoms.has(this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_SHORT_PRESS)) ||
        this._knownRemoteSwitchBottoms.has(this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_LONG_PRESS))) {
       if (this._bottomPanelVisible) btn.classList.add("locked");
       if (!this._bottomPanelVisible) btn.classList.remove("locked");
    } else {
      btn.classList.remove("locked");
    }
  }

  doUpdateSidePanel() {
    // Expand or collapse side panel
    if (this._sidePanelVisible) {
      this._elements.wrapper.classList.add("with-addons");
      this.getServersWrapper().classList.add("with-addons");
      this.getAddonsWrapper().classList.remove("hide");
    } else {
      this._elements.wrapper.classList.remove("with-addons");
      this.getServersWrapper().classList.remove("with-addons");
      this.getAddonsWrapper().classList.add("hide");
    }
  }

  doUpdateBottomPanel() {
    // Expand or collapse bottom panel
    if (this._bottomPanelVisible) {
      this._elements.wrapper.classList.add("with-servers");
      this.getServersWrapper().classList.remove("hide");
    } else {
      this._elements.wrapper.classList.remove("with-servers");
      this.getServersWrapper().classList.add("hide");
    }
  }

  doUpdateCellState(serverId, buttonId, remoteMode, btn) {
    // Retrieve short or long press config (whatever is defined, in this order)
    const overrideConfigShort = this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_SHORT_PRESS);
    const overrideConfigLong = this.getButtonOverrideConfig(serverId, buttonId, remoteMode, this._OVERRIDE_TYPE_LONG_PRESS);

    // Retrieve watched entity id (entity and sensor supported)
    const entityId =
      overrideConfigShort?.['entity'] ?? overrideConfigLong?.['entity'] ??
      overrideConfigShort?.['sensor'] ?? overrideConfigLong?.['sensor'];
    if (entityId) {

      // Update button _sensorState with up-to-date entity state (on or off)
      const isHassEntityOn = this._eventManager.isHassEntityOn(entityId);
      btn._sensorState = isHassEntityOn ? 'on' : 'off';

      // Update button visuals to reflect updated state, for visual feedback
      for (const child of (btn.children ? Array.from(btn.children) : [])) {
        if (isHassEntityOn) child.classList.add("sensor-on");
        if (!isHassEntityOn) child.classList.remove("sensor-on");
      }
    }
  }

  //#################
  //# SERVERS CELLS #
  //#################

  doUpdateServers() {
    this.doResetServers();
    this.doCreateServers();
  }

  doResetServers() {
    // Clear previous listeners
    this._eventManager.clearListeners("serversContainer");

    // Detach existing layout from DOM
    this._elements.servers.wrapper.innerHTML = '';

    // Reset servers cells elements (if any)
    this._elements.servers.cells = [];
  }

  doCreateServers() {
    // Create all servers cells from :
    // - servers stored into read-only user preferences
    // - servers overrides stored into read-only default configurations
    // - servers overrides stored into read/write user configurations
    const serversCellsConfig = this.getServersCellsConfig();
    for (const server of (this._eventManager.getServers() ?? [])) {
      const serverCellConfig = serversCellsConfig?.[server.id];
      const serverCell = this.doServerCell(server, serverCellConfig);
      this.doStyleServerCell(serverCell, serverCellConfig);
      this.doAttachServerCell(serverCell);
      this.doQueryServerCellElements();
      this.doListenServerCell(serverCell);
    }
  }

  doServerCell(server, serverCellConfig) {

    // Define cell default config
    const defaultServerCellConfig = this.createDynamicServerCellConfig(server);
    const serverCellName = this.getDynamicServerCellName(defaultServerCellConfig);

    // Create a new server cell
    const serverCell = document.createElement("div");
    this.getServersCells().push(serverCell);
    serverCell.classList.add('device-cell');
    serverCell.id = serverCellName;
    this.setServerCellData(serverCell, serverCellConfig, defaultServerCellConfig);

    // Create server cell content
    const serverCellContent = this.doServerCellContent(serverCellConfig, defaultServerCellConfig);
    this.doStyleServerCellContent(serverCellContent, serverCellConfig);
    this.doAttachServerCellContent(serverCell, serverCellContent);
    this.doQueryServerCellContentElements(serverCell, serverCellContent);
    this.doListenServerCellContent();
  
    return serverCell;
  }

  doStyleServerCell(serverCell, serverConfig) {
    serverCell.style.width = this.getServerCellWidth(serverConfig);
    serverCell.style.height = this.getServerCellHeight(serverConfig);
  }
  doAttachServerCell(serverCell) {
    this.getServersWrapper().appendChild(serverCell);
  }
  doQueryServerCellElements() {
    // Nothing to do
  }
  doListenServerCell(serverCell) {
    // Action and visual events
    this._eventManager.addButtonListeners("serversContainer", serverCell, 
      {
        [this._eventManager.constructor._BUTTON_CALLBACK_PRESS]: this.onServerCellPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_ABORT_PRESS]: this.onServerCellAbortPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_RELEASE]: this.onServerCellRelease.bind(this)
      }
    );
  }

  onServerCellPress(serverCell, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doServerCellPress(serverCell, evt);
  }

  onServerCellAbortPress(serverCell, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doServerCellAbortPress(serverCell, evt);
  }

  onServerCellRelease(serverCell, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    this.doServerCellRelease(serverCell, evt);
  }

  doServerCellPress(serverCell, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Server cell ${serverCell.id} press: action will be triggered on release, nothing to do`));
    // Nothing to do: server will be switched on cell release

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doServerCellAbortPress(serverCell, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Server cell ${serverCell.id} abort press: action wont be triggered at all, nothing to do`));
    // Nothing to do: server will be switched on cell release

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doServerCellRelease(serverCell, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Server cell ${serverCell.id} release: triggering associated action...`));

    // Retrieve server cell config
    const serverCellConfig = this._layoutManager.getElementData(serverCell);
    const serverId = serverCellConfig.id;

    // switch to selected HID server (when different than current server)
    const currentServer = this._eventManager.getCurrentServer();
    if (currentServer.id !== serverId) {
      const nextServer = this._eventManager.getServer(serverId);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Server cell ${serverCell.id} release: switching from ${this._eventManager.getServerName(currentServer)} server to ${this._eventManager.getServerName(nextServer)} server...`, btn));
      this.setCurrentServer(nextServer);
    }

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doServerCellContent(serverCellConfig, defaultServerCellConfig) {

    // Create server cell content inner label
    const label = document.createElement("div");
    label.className = "device-label";
    label.textContent = this.getServerCellLabel(serverCellConfig)
      || this.getDynamicServerCellServerName(defaultServerCellConfig)
      || this.getDynamicServerCellName(defaultServerCellConfig);
    label.style.color = this.getServerCellLabelColor(serverCellConfig);
    label.style.fontSize = this.getServerCellLabelFontScale(serverCellConfig);

    const serverCellContentLabel = document.createElement("div");
    serverCellContentLabel.className = "device-cell-content-part label half";
    serverCellContentLabel.style.padding = this.getServerCellLabelGap(serverCellConfig);
    serverCellContentLabel.appendChild(label);


    // Create server cell content inner image
    const imgHtml = this.getServerCellImageUrl(serverCellConfig) ? this.getCellImageHtml(this.getServerCellImageUrl(serverCellConfig)) : '';
    const img = document.createElement("div");
    img.className = "device-img";
    img.innerHTML = imgHtml;
    img._originalFill = this._sideCellButtonFg;
    img._originalStroke = this._sideCellButtonFg;

    const serverCellContentImage = document.createElement("div");
    serverCellContentImage.className = "device-cell-content-part img half";
    serverCellContentImage.style.padding = this.getServerCellImageGap(serverCellConfig);
    serverCellContentImage.appendChild(img);

    // Create server cell content inner icon
    const icoHtml = this.getServerCellIconUrl(serverCellConfig) ? this.getCellImageHtml(this.getServerCellIconUrl(serverCellConfig)) : '';
    const ico = document.createElement("div");
    ico.className = "device-icon";
    ico.innerHTML = icoHtml;

    const serverCellContentIcon = document.createElement("div");
    serverCellContentIcon.className = "device-icon-wrapper";
    serverCellContentIcon.style.padding = this.getServerCellIconGap(serverCellConfig);
    serverCellContentIcon.appendChild(ico);


    // Create server cell content
    const serverCellContent = document.createElement("div");
    serverCellContent.className = "device-cell-content";
    serverCellContent.appendChild(serverCellContentImage);
    serverCellContent.appendChild(serverCellContentLabel);
    serverCellContent.appendChild(serverCellContentIcon);
    return serverCellContent;
  }

  doStyleServerCellContent(serverCellContent, serverCellConfig) {
    // Nothing to do here
  }

  doAttachServerCellContent(serverCell, serverCellContent) {
    serverCell.appendChild(serverCellContent);
  }

  doQueryServerCellContentElements(serverCell, serverCellContent) {
    serverCell._img = serverCellContent.querySelector(".device-img");
    serverCell._svg = serverCell._img.querySelector('svg');
  }

  doListenServerCellContent() {
    // Nothing to do here: no events needed on cell content
  }

  //################
  //# ADDONS CELLS #
  //################

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
    addonCell.classList.add('device-cell');
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
    label.className = "device-label";
    label.textContent = this.getAddonCellLabel(addonCellConfig) || this.getDynamicAddonCellName(defaultAddonCellConfig);
    label.style.color = this.getAddonCellLabelColor(addonCellConfig);
    label.style.fontSize = this.getAddonCellLabelFontScale(addonCellConfig);

    const addonCellContentLabel = document.createElement("div");
    addonCellContentLabel.className = "device-cell-content-part label half";
    addonCellContentLabel.style.padding = this.getAddonCellLabelGap(addonCellConfig);
    addonCellContentLabel.appendChild(label);


    // Create addon cell content inner image
    const imgHtml = this.getAddonCellImageUrl(addonCellConfig) ? this.getCellImageHtml(this.getAddonCellImageUrl(addonCellConfig)) : '';
    const img = document.createElement("div");
    img.className = "device-img";
    img.innerHTML = imgHtml;
    img._originalFill = this._sideCellButtonFg;
    img._originalStroke = this._sideCellButtonFg;

    const addonCellContentImage = document.createElement("div");
    addonCellContentImage.className = "device-cell-content-part img half";
    addonCellContentImage.style.padding = this.getAddonCellImageGap(addonCellConfig);
    addonCellContentImage.appendChild(img);

    // Create addon cell content inner icon
    const icoHtml = this.getAddonCellIconUrl(addonCellConfig) ? this.getCellImageHtml(this.getAddonCellIconUrl(addonCellConfig)) : '';
    const ico = document.createElement("div");
    ico.className = "device-icon";
    ico.innerHTML = icoHtml;

    const addonCellContentIcon = document.createElement("div");
    addonCellContentIcon.className = "device-icon-wrapper";
    addonCellContentIcon.style.padding = this.getAddonCellIconGap(addonCellConfig);
    addonCellContentIcon.appendChild(ico);


    // Create addon cell content
    const addonCellContent = document.createElement("div");
    addonCellContent.className = "device-cell-content";
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
    addonCell._img = addonCellContent.querySelector(".device-img");
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
      state_color: "rgb",
      servers: {
        cell_width: "80px",
        cell_height: "60px",
        cell_label_font_scale: '0.8em',
        cell_image_gap: '0.8em 0.8em 0em 0.8em',
        cell_icon_gap: '0.2em 0.2em 0em 0em',
        cells: {}
      },
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

  // Set server cell data
  setServerCellData(cell, defaultConfig, overrideConfig) {
    this._layoutManager.setElementData(cell, defaultConfig, overrideConfig, (key, value, source) => this._allowedServerCellData.has(key));
  }

  // Set addon cell data
  setAddonCellData(cell, defaultConfig, overrideConfig) {
    this._layoutManager.setElementData(cell, defaultConfig, overrideConfig, (key, value, source) => this._allowedAddonCellData.has(key));
  }

  // Set clickable data
  setClickableData(clickable, defaultConfig, overrideConfig) {
    this.getClickables().push(clickable);
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

  hasAnyOwn(obj, keys) {
    for (let i = 0; i < keys.length; i++) {
      if (Object.hasOwn(obj, keys[i])) return true;
    }
    return false;
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
    if (this.isServerButton(btn) && (!overrideConfig || overrideConfig === this._OVERRIDE_NONE)) {
      // Server button retrieved
      
      // switch to next available HID server
      const currentServer = this._eventManager.getCurrentServer();
      const nextServer = this._eventManager.getNextServer();
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching from ${this._eventManager.getServerName(currentServer)} server to ${this._eventManager.getServerName(nextServer)} server...`, btn));
      this.setCurrentServer(nextServer);
    } else if (this.isAirmouseButton(btn) && (!overrideConfig || overrideConfig === this._OVERRIDE_NONE)) {
      // Airmouse button retrieved
      
      // switch airmouse mode
      const currentAirmouseMode = this.getAirMouse().isMoveEnabled();
      const nextAirmouseMode = !currentAirmouseMode;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching airmouse mode from ${currentAirmouseMode} to ${nextAirmouseMode}...`, btn));
      this.setAirmouseEnabled(nextAirmouseMode);
    } else if (overrideConfig === this._OVERRIDE_NONE) {
      // Typed config "none"
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): none action for ${remoteMode} mode ${pressType} press, nothing to do`, btn));
    } else if (overrideConfig === this._OVERRIDE_ALTERNATIVE_MODE ||
        overrideConfig === this._OVERRIDE_NORMAL_MODE) {
      // Typed config switches mode

      // Switch remote mode (normal/alternative)
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching from ${remoteMode} mode to ${overrideConfig} mode ...`, btn));
      this.setRemoteMode(overrideConfig);
      this.doUpdateCellsVisualAndState();
    } else if (overrideConfig === this._OVERRIDE_SWITCH_SIDE_PANEL) {
      // Typed config switches side panel open/close

      // Switch side panel mode (opened/closed)
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching side panel visibility (from ${this._sidePanelVisible} to ${!this._sidePanelVisible})...`, btn));
      this._sidePanelVisible = !this._sidePanelVisible;
      this.doUpdateCellsVisualAndState();
    } else if (overrideConfig === this._OVERRIDE_SWITCH_BOTTOM_PANEL) {
      // Typed config switches bottom panel open/close

      // Switch bottom panel mode (opened/closed)
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): switching bottom panel visibility (from ${this._bottomPanelVisible} to ${!this._bottomPanelVisible})...`, btn));
      this._bottomPanelVisible = !this._bottomPanelVisible;
      this.doUpdateCellsVisualAndState();
    }  else {
      // Typed config defines an action (related to sensor state or not)

      // Execute action whenever sub-config defined (handled by this._eventManager.executeButtonOverride)
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`executeButtonOverride(btn): executing override action for serverId: ${serverId}, buttonId: ${buttonId}, remoteMode: ${remoteMode}, pressType: ${pressType}...`, btn));
      this._eventManager.executeButtonOverride(btn, overrideConfig);
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
