import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';
import * as layoutsWindows from './layouts/windows/index.js';

console.info("Loading windows-keyboard-card");

export class WindowsKeyboardCard extends HTMLElement {

  // private init required constants
  static _STATUS_MAP;

  static _STATE_NORMAL = '1';
  static _STATE_SHIFT = '2';
  static _STATE_RIGHT_ALT = '3';

  static _LABEL_NORMAL = "normal";
  static _LABEL_SHIFT = "shift";
  static _LABEL_RIGHT_ALT = "altGr";

  static _TRIGGER_CAPSLOCK = 'KEY_CAPSLOCK';
  static _TRIGGER_SHIFT_LEFT = 'MOD_LEFT_SHIFT';
  static _TRIGGER_SHIFT_RIGHT = 'MOD_RIGHT_SHIFT';
  static _TRIGGER_CTRL_LEFT = 'MOD_LEFT_CONTROL';
  static _TRIGGER_CTRL_RIGHT = 'MOD_RIGHT_CONTROL';
  static _TRIGGER_ALT_LEFT = 'MOD_LEFT_ALT';
  static _TRIGGER_ALT_RIGHT = 'MOD_RIGHT_ALT';

  static _TRIGGERS;

  // Should be initialized in a static block to avoid JS engine to bug on static fields not-already-referenced otherwise
  static {
    this._TRIGGERS = new Set([this._TRIGGER_CAPSLOCK, this._TRIGGER_SHIFT_LEFT, this._TRIGGER_SHIFT_RIGHT, this._TRIGGER_CTRL_LEFT, this._TRIGGER_CTRL_RIGHT, this._TRIGGER_ALT_LEFT, this._TRIGGER_ALT_RIGHT]);
    this._TRIGGER_SHIFTS = [this._TRIGGER_SHIFT_LEFT, this._TRIGGER_SHIFT_RIGHT];
    this._TRIGGER_CTRLS = [this._TRIGGER_CTRL_LEFT, this._TRIGGER_CTRL_RIGHT];
    this._TRIGGER_ALTS = [this._TRIGGER_ALT_LEFT, this._TRIGGER_ALT_RIGHT];

    this._STATUS_MAP = {
      "init": { "state": this._STATE_NORMAL },
      "states": {
        [this._STATE_NORMAL]: {
          "label": this._LABEL_NORMAL,
          "nexts": [
            { "pressed": [this._TRIGGER_SHIFT_LEFT],  "released": [...this._TRIGGER_CTRLS, ...this._TRIGGER_ALTS, this._TRIGGER_CAPSLOCK],     "state": this._STATE_SHIFT     },
            { "pressed": [this._TRIGGER_SHIFT_RIGHT], "released": [...this._TRIGGER_CTRLS, ...this._TRIGGER_ALTS, this._TRIGGER_CAPSLOCK],     "state": this._STATE_SHIFT     },
            { "pressed": [this._TRIGGER_CAPSLOCK],    "released": [...this._TRIGGER_SHIFTS],                                                   "state": this._STATE_SHIFT     },
            { "pressed": [this._TRIGGER_ALT_RIGHT],   "released": [...this._TRIGGER_SHIFTS, this._TRIGGER_ALT_LEFT, this._TRIGGER_CTRL_RIGHT], "state": this._STATE_RIGHT_ALT }
          ]
        },
        [this._STATE_SHIFT]: {
          "label": this._LABEL_SHIFT,
          "nexts": [
            { "pressed": [],                                                    "released": [this._TRIGGER_CAPSLOCK, ...this._TRIGGER_SHIFTS], "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_LEFT, this._TRIGGER_CTRL_LEFT],   "released": [],                                                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_LEFT, this._TRIGGER_CTRL_RIGHT],  "released": [],                                                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_LEFT, this._TRIGGER_ALT_LEFT],    "released": [],                                                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_LEFT, this._TRIGGER_ALT_RIGHT],   "released": [],                                                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_LEFT, this._TRIGGER_CAPSLOCK],    "released": [],                                                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_RIGHT, this._TRIGGER_CTRL_LEFT],  "released": [],                                                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_RIGHT, this._TRIGGER_CTRL_RIGHT], "released": [],                                                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_RIGHT, this._TRIGGER_ALT_LEFT],   "released": [],                                                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_RIGHT, this._TRIGGER_ALT_RIGHT],  "released": [],                                                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_SHIFT_RIGHT, this._TRIGGER_CAPSLOCK],   "released": [],                                                "state": this._STATE_NORMAL    }
          ]
        },
        [this._STATE_RIGHT_ALT]: {
          "label": this._LABEL_RIGHT_ALT,
          "nexts": [
            { "pressed": [],                                                    "released": [this._TRIGGER_ALT_RIGHT],                "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_ALT_RIGHT, this._TRIGGER_SHIFT_LEFT],   "released": [],                                       "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_ALT_RIGHT, this._TRIGGER_SHIFT_RIGHT],  "released": [],                                       "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_ALT_RIGHT, this._TRIGGER_ALT_LEFT],     "released": [],                                       "state": this._STATE_NORMAL    },
            { "pressed": [this._TRIGGER_ALT_RIGHT, this._TRIGGER_CTRL_RIGHT],   "released": [],                                       "state": this._STATE_NORMAL    }
          ]
        }
      }
    };
  }

  // private constants
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();
  _allowedCellData = new Set(['code', 'special', 'label', 'fallback']);
  _toggables = new Set(['KEY_CAPSLOCK', 'MOD_LEFT_SHIFT', 'MOD_RIGHT_SHIFT', 'MOD_LEFT_CONTROL', 'MOD_RIGHT_CONTROL', 'MOD_LEFT_ALT', 'MOD_RIGHT_ALT', 'MOD_LEFT_GUI', 'MOD_RIGHT_GUI']);

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;
  _pressedModifiers = new Set();
  _pressedKeys = new Set();
  _pressedConsumers = new Set();
  _triggers = new Set();

  constructor() {
    super();

    this._logger = new Logger(this, "windows-keyboard-card.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, layoutsWindows);
    this._resourceManager = new ResourceManager(this, import.meta.url);

    this._currentState = this.constructor._STATUS_MAP["init"]["state"];

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
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass()
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

  doUpdateCells() {
    const statusLabel = this.getCurrentLabel();
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doUpdateCells(statusLabel):", statusLabel));

    for (const cell of this._elements.cells) {

      const cellConfig = this._layoutManager.getElementData(cell);
      if (!cellConfig) continue;

      this.doUpdateCell(cell, cellConfig, statusLabel);
    }
  }

  // Synchronize cell visuals and label with given mode and state
  doUpdateCell(cell, cellConfig, statusLabel) {
    this.doUpdateCellVisuals(cell, cellConfig);
    this.doUpdateCellLabel(cell, cellConfig, statusLabel);
  }

  // Synchronize cell visuals with given mode and state
  // using per-matching-cell-code configured actions
  doUpdateCellVisuals(cell, cellConfig) {
    // Nothing to do
  }

  // Synchronize cell label with given mode and state
  // using configured given label selection mode
  doUpdateCellLabel(cell, cellConfig, statusLabel) {
    cell._label.textContent = this.getLabel(cellConfig, statusLabel);
  }

  // jobs
  doCheckConfig() {
    this._layoutManager.checkConfiguredLayout();
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div class="keyboard-container">
      </div>
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      :host {
        --card-corner-radius: 10px;
        --key-min-corner-radius: 4px;
        --key-max-corner-radius: 8px;
        --base-font-size: 3rem; /* base scaling unit */
        --key-bg: #3b3a3a;
        --key-active-bg: #4a4a4a;
        --key-press-bg: #6a6a6a;
        --key-special-bg: #222;
        --key-special-active-bg: #333;
        --key-special-press-bg: #444;
        --key-special-color: #ccc;
        --key-shif-once-bg: #2e4b6b; /* grey-blue */
        --key-shif-once-active-bg: #4571a1; /* grey-blue-light */
        --key-shif-once-press-bg: #7098c2; /* grey-blue-lightest */
        --key-locked-bg: #0073e6; /* blue */
        --key-locked-active-bg: #3399ff; /* blue */
        --key-locked-press-bg: #80bfff; /* lighter blue */
        --key-height: clamp(2rem, 9vh, 3.5rem);
        --key-margin: 0.15rem;
        font-size: var(--base-font-size);
        display: block;
        width: 100%;
        user-select: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-sizing: border-box;
      }
      ha-card {
        border-radius: var(--card-corner-radius);
        position: relative;
        font-size: var(--base-font-size);
      }
      .keyboard-container {
        border-radius: var(--card-corner-radius);
        display: flex;
        flex-direction: column;
        gap: clamp(4px, 10vw, 8px);
        padding: clamp(3px, 10vw, 6px) clamp(3px, 10vw, 6px);
        background: #1a1a1a;
        box-sizing: border-box;
        width: 100%;
      }
      .keyboard-row {
        display: flex;
        flex-wrap: nowrap;  /* prevent wrapping */
        overflow: hidden;   /* prevent horizontal overflow */
        width: 100%;
        box-sizing: border-box;
        flex-shrink: 1;
        gap: clamp(3px, 1vw, 6px);
      }
      button.key {
        border-radius: clamp(var(--key-min-corner-radius), 1vw, var(--key-max-corner-radius));
        flex: 1 1 0;
        min-width: 0;      /* prevent content from forcing expansion */
        font-size: clamp(0.6em, 10vw, 1em);
        padding: clamp(2px, 10vw, 4px); clamp(2px, 10vw, 4px);
        cursor: pointer;
        height: var(--key-height);
        background: var(--key-bg);
        border: none;
        color: #eee;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-sizing: border-box;
        transition: background 0.15s ease;
        white-space: nowrap;
        overflow: hidden;
        -webkit-tap-highlight-color: transparent; /* Remove mobile tap effect */
        outline: none; /* Prevent focus ring override */
      }
      button.key.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background: var(--key-active-bg);
        color: #fff;
      }
      button.key.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background: var(--key-press-bg);
      }
      button.key.special {
        flex: 1 1 auto;
        font-size: clamp(0.55em, 10vw, 0.95em);
        font-weight: bold;
        padding: clamp(1px, 10vw, 4px); clamp(0px, 10vw, 2px);
        background: var(--key-special-bg);
        color: var(--key-special-color);
      }
      button.key.special.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background: var(--key-special-active-bg);
      }
      button.key.special.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background: var(--key-special-press-bg);
      }
      button.key.spacer {
        pointer-events: none;
        background: transparent;
        border: none;
        box-shadow: none;
        opacity: 0;
        cursor: default;
      }
      button.key.half {
        flex-grow: 0.4;
      }
      button.key.wide {
        flex-grow: 2;
      }
      button.key.wider {
        flex-grow: 3;
      }
      button.key.android {
        flex-grow: 1.55;
      }
      button.key.altkey {
        flex-grow: 1.5;
      }
      button.key.spacebar {
        flex-grow: 7.4;
      }
      button.key.shift-once {
        background: var(--key-shif-once-bg);
        font-weight: bold;
      }
      button.key.shift-once.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background: var(--key-shif-once-active-bg);
      }
      button.key.shift-once.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} { 
        background: var(--key-shif-once-press-bg);
      }
      button.key.locked {
        background: var(--key-locked-bg);
        font-weight: bold;
      }
      button.key.locked.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background: var(--key-locked-active-bg);
      }
      button.key.locked.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background: var(--key-locked-press-bg);
      }
      .label-lower {
        font-size: 1em;
        font-weight: normal;
        user-select: none;
      }
    `;
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.container = card.querySelector(".keyboard-container");
  }

  doListen() {
    // Nothing to do here: events are listened per sub-element
  }

  doUpdateConfig() {
    // Adjust ha-card font scale to serve has a reference and properly scale the whole UI
    if (this._elements.card.style) {
      this._elements.card.style.setProperty('--base-font-size', this._layoutManager.getSafeFontScale());
    }

    if (this._layoutManager.configuredLayoutChanged()) {
      this.doUpdateLayout();
    }
  }

  doUpdateHass() {
    // Nothing to do here: no specific HA entity state to listen for this card
  }

  doUpdateLayout() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doUpdateLayout() + this._currentMode, this._currentState", this._currentMode, this._currentState));
    this.doResetLayout();
    this.doCreateLayout();
    this.syncKeyboard();
  }

  doResetLayout() {
    // Clear previous listeners
    this._eventManager.clearListeners("layoutContainer");

    // Clear existing layout content from DOM
    this._elements.container.innerHTML = '';

    // Reset cells contents elements (if any)
    this._elements.cellContents = []

    // Reset cells elements (if any)
    this._elements.cells = []

    // Reset rows elements (if any)
    this._elements.rows = []

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
  }

  doRow(rowConfig) {
    const row = document.createElement("div");
    this._elements.rows.push(row);
    row.className = "keyboard-row";

    // Create cells
    for (const cellConfig of rowConfig.cells) {
      const cell = this.doCell(rowConfig, cellConfig);
      this.doStyleCell();
      this.doAttachCell(row, cell);
      this.doQueryCellElements();
      this.doListenCell(cell);
    }

    return row;
  }

  doStyleRow() {
    // Nothing to do here: already included into card style
  }

  doAttachRow(row) {
    this._elements.container.appendChild(row);
  }

  doQueryRowElements() {
    // Nothing to do here: element already referenced and sub-elements already are included by them
  }

  doListenRow() {
    // Nothing to do here: no listener on element and sub-elements listeners are included by them
  }

  doCell(rowConfig, cellConfig) {

    // Create cell popin config
    const overrideCellConfig = {};

    // Create cell
    const cell = document.createElement("button");
    this._elements.cells.push(cell);
    cell.id = cellConfig["code"];
    cell.classList.add("key");
    if (cellConfig.special) cell.classList.add("special");
    if (cellConfig.width) cell.classList.add(cellConfig["width"]);
    if (cellConfig.code.startsWith("SPACER_")) cell.classList.add("spacer"); // Disable actions on spacers
    this.setCellData(cell, cellConfig, overrideCellConfig);

    // Create cell content
    const cellContent = this.doCellContent(cellConfig);
    this.doStyleCellContent();
    this.doAttachCellContent(cell, cellContent);
    this.doQueryCellContentElements(cell, cellContent);
    this.doListenCellContent();

    // Update cell visuals and content label (to match current mode and state)
    this.doUpdateCell(cell, cellConfig, this.getCurrentLabel());

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

  doListenCell(cell) {
    this.addClickableListeners(cell);
  }

  doCellContent(cellConfig) {
    const cellContent = document.createElement("span");
    cellContent.className = "label-lower";
    cellContent.textContent = "";
    return cellContent;
  }

  doStyleCellContent() {
    // Nothing to do here: already included into card style
  }

  doAttachCellContent(cell, cellContent) {
    cell.appendChild(cellContent);
  }

  doQueryCellContentElements(cell, cellContent) {
    cell._label = cellContent;
  }

  doListenCellContent() {
    // Nothing to do: only parent is clickable
  }

  // configuration defaults
  static getStubConfig() {
    return {
      layout: "US",
      haptic: true,
      log_level: "warn",
      log_pushback: false,
      buttons_overrides: {},
      font_scale: 1
    }
  }

  getCardSize() {
    return 1;
  }

  getCurrentState() {
    return this.constructor._STATUS_MAP["states"][this._currentState];
  }

  getCurrentLabel() {
    return this.getCurrentState()["label"];
  }

  getNextState() {
    return this.getCurrentState()["nexts"]
      .find(next => 
        next["pressed"].every(pressed => this._triggers.has(pressed)) && 
        next["released"].every(released => !this._triggers.has(released))
      );
  }

  isNextStateTrigger() {
    return !!this.getNextState();
  }

  activateNextState() {
    const nextState = this.getNextState();
    if (nextState) {
      this._currentState = nextState["state"];
    }
    return !!nextState;
  }

  getStandardLabel(cellConfig, statusLabel) {
    return cellConfig?.label?.[statusLabel] || "";
  }

  getSpecialLabel(cellConfig, statusLabel) {
    return cellConfig?.label?.[statusLabel] || this.getStandardLabel(cellConfig, this.constructor._LABEL_NORMAL);
  }

  getLabel(cellConfig, statusLabel) {
    const label = cellConfig.special 
      ? this.getSpecialLabel(cellConfig, statusLabel) 
      : this.getStandardLabel(cellConfig, statusLabel);
    return label ? label : this.getStandardLabel(cellConfig, cellConfig.fallback || "");
  }

  setCellData(cell, defaultConfig, overrideConfig) {
    this._layoutManager.setElementData(cell, defaultConfig, overrideConfig, (key, value, source) => this._allowedCellData.has(key));
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
    if (this.isToggable(code)) {
      // Togglable modifier pressed: they cannot be overriden

      // Update the toggle button
      const isBtnPressed = this.toggle(btn);

      // Update all cells labels and visuals
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: modifier key detected, updating layout...`));
      if (this.activateNextState()) this.doUpdateCells();

      // Press or release HID key
      this.executePressToggable(btn, code, isBtnPressed);
    } else if (code === "KEY_SYNC") {
      // Special synchronization key, cannot be overriden
      
      // Execute keyboard synchronization
      this.syncKeyboard();
    } else if (this._layoutManager.hasButtonOverride(btn)) {
      // Overriden action
      
      // Nothing to do: overriden action will be executed on key release
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: overridden key detected, nothing to press`));
    } else {
      // Standard key pressed

      // Press HID key
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: standard key detected, pressing ${code}...`));
      this.appendCode(code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doKeyAbortPress(btn, evt) {

    // Retrieve clickable button data
    const btnData = this._layoutManager.getElementData(btn);
    if (!btnData) return;

    // Key code to abort
    const code = btnData.code;
    if (this.isToggable(code)) {
      // Togglable modifier pressed: they cannot be overriden

      // Nothing to do: action has already been executed on key press (modifiers can stay infinitely pressed)
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} abort press: modifier key detected, nothing to abort`));
    }  else if (this._layoutManager.hasButtonOverride(btn)) {
      // Overriden action
      
      // Nothing to do: overriden action has not (and wont be) executed because key release wont happen
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} abort press: overridden key detected, nothing to abort`));
    } else {
      // Standard key pressed

      // Release HID key to prevent infinite key press
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} abort press: standard key detected, releasing ${code}...`));
      this.removeCode(code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  doKeyRelease(btn, evt) {

    // Retrieve clickable button data
    const btnData = this._layoutManager.getElementData(btn);
    if (!btnData) return;

    // Key code to release
    const code = btnData.code;
    const charToSend = btn._label.textContent || "";
    if (this.isToggable(code)) {
      // Togglable modifier released: they cannot be overriden

      // Nothing to do: action has already been executed on key press
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} release: modifier key detected, nothing to release`));
    } else if (this._layoutManager.hasButtonOverride(btn)) {
      // Overriden action
      
      // Execute the override action
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} release: overridden key detected, executing override action...`));
      this.executeButtonOverride(btn);
    } else {
      // Standard key released

      // Release HID key to prevent infinite key press
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} release: standard key detected, releasing ${code}...`));
      this.removeCode(code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  // Press or release HID key according, whether respectively it is pressed or not pressed after toggling
  executePressToggable(btn, code, isBtnPressed) {
    if (code === "KEY_CAPSLOCK") {
      // Special treatment for the unique CAPSLOCK key that... is a modifier that needs to be physically released to work
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: modifier key detected, pressing then releasing ${code}...`));
      this.appendCode(code);
      this.removeCode(code);
    } else {
      // For any other button, press it if toggled, release it if not toggled
      if (isBtnPressed) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: modifier key detected, pressing ${code}...`));
        this.appendCode(code);
      } else {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key ${btn.id} press: modifier key detected, releasing ${code}...`));
        this.removeCode(code);
      }
    }
  }

  executeButtonOverride(btn) {
    this._eventManager.executeButtonOverride(btn, this._layoutManager.getButtonOverride(btn));
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

  toggle(btn) {
    // Toggles button state
    const btnData = this._layoutManager.getElementData(btn);
    return this.setToggle(!btnData.toggled);
  }
  
  setToggle(btn, value) {

    // Toggles button state
    const btnData = this._layoutManager.getElementData(btn);
    btnData.toggled = value;

    // Update button visuals
    if (btnData.toggled) btn.classList.add("locked");
    if (!btnData.toggled) btn.classList.remove("locked");

    // Update triggers
    if (btnData.toggled) this._triggers.add(btnData.code);
    if (!btnData.toggled) this._triggers.delete(btnData.code);

    return !!btnData.toggled;
  }

  isToggable(code) {
    return code && this._toggables.has(code);
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

  // Synchronize with remote keyboard current state through HA websockets API
  syncKeyboard() {
    this._eventManager.callComponentCommand(hass, 'sync_keyboard').then((response) => {
      // Keyboard sync success handler
      const { syncModifiers, syncKeys, syncNumlock, syncCapslock, syncScrolllock } = response;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('Keyboard synchronization: succeed (syncModifiers, syncKeys, syncNumlock, syncCapslock, syncScrolllock):', syncModifiers, syncKeys, syncNumlock, syncCapslock, syncScrolllock));
      
      const modifiers = [...(this.syncModifiers ?? []), ...(syncCapslock ? [this.constructor._TRIGGER_CAPSLOCK] : [])];
      
      // Update triggers
      this._triggers.clear();
      const triggers = modifiers.filter(modifier => this.constructor._TRIGGERS.has(modifier));
      for (const trigger of triggers) {
        this._triggers.add(trigger);
      }
      
      // Visually toggle pressed/released toggables
      const pressedToggables = modifiers.filter(modifier => this._toggables.has(modifier));
      const releasedToggables = this._toggables.filter(toggable => !pressedToggables.has(toggable));
      for (const cell of (this._elements.cells ?? [])) {
        if (pressedToggables.includes(cell)) this.setToggle(cell, true);
        if (releasedToggables.includes(cell)) this.setToggle(cell, false);
      }
      
      // Update all cells labels and visuals
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Keyboard synchronization: succeed, updating layout...`));
      if (this.activateNextState()) this.doUpdateCells();
    })
    .catch((err) => {
      if (this.logger.isErrorEnabled()) console.error(...this.logger.error("Failed to sync keyboard state:", err));
    });
  }

}

if (!customElements.get("windows-keyboard-card")) customElements.define("windows-keyboard-card", WindowsKeyboardCard);
