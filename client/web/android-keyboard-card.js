import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';
import * as layoutsAndroid from './layouts/android/index.js';

console.info("Loading android-keyboard-card");

class AndroidKeyboardCard extends HTMLElement {

  // private init required constants
  static _STATUS_MAP;
  static _MODE_NORMAL = "normal";  
  static _MODE_ALT = "alt";

  static _STATE_NORMAL = "normal";
  static _STATE_SHIFT_ONCE = "shift_once";
  static _STATE_SHIFT_LOCKED = "shift_locked";
  static _STATE_ALT_PAGE_ONE = "alt_page_one";
  static _STATE_ALT_PAGE_TWO = "alt_page_two";

  static _LABEL_NORMAL = "normal";
  static _LABEL_SHIFT = "shift";
  static _LABEL_ALT1 = "alt1";
  static _LABEL_ALT2 = "alt2";

  static _TRIGGER_NEXT_SHIFT = /^MOD_LEFT_SHIFT$/; // MOD_LEFT_SHIFT pressed
  static _TRIGGER_BACK_TO_NORMAL = /^(?!MOD_LEFT_SHIFT$).*/; // Anything except MOD_LEFT_SHIFT pressed
  static _TRIGGER_NEXT_MODE = /^KEY_MODE$/; // KEY_MODE pressed

  // Should be initialized in a static block to avoid JS engine to bug on static fields not-already-referenced otherwise
  static {
    this._STATUS_MAP = {
      "init": { "mode": this._MODE_NORMAL, "state": this._STATE_NORMAL },
      "modes": {
        [this._MODE_NORMAL]: {
          "states": {
            [this._STATE_NORMAL]: {
              "label": this._LABEL_NORMAL,
              "actions": { "MOD_LEFT_SHIFT": [ { "action": "remove", "class_list": ["shift-once", "locked"] } ] },
              "nexts": [ { "trigger": this._TRIGGER_NEXT_SHIFT, "mode": this._MODE_NORMAL, "state": this._STATE_SHIFT_ONCE } ]
            },
            [this._STATE_SHIFT_ONCE]: {
              "label": this._LABEL_SHIFT,
              "actions": { "MOD_LEFT_SHIFT": [ { "action": "add", "class_list": ["shift-once"] } ] },
              "nexts": [ 
                { "trigger": this._TRIGGER_NEXT_SHIFT, "mode": this._MODE_NORMAL, "state": this._STATE_SHIFT_LOCKED },
                { "trigger": this._TRIGGER_BACK_TO_NORMAL, "mode": this._MODE_NORMAL, "state": this._STATE_NORMAL },
              ]
            },
            [this._STATE_SHIFT_LOCKED]: {
              "label": this._LABEL_SHIFT,
              "actions": { "MOD_LEFT_SHIFT": [ { "action": "remove", "class_list": ["shift-once"] }, { "action": "add", "class_list": ["locked"] } ] },
              "nexts": [ { "trigger": this._TRIGGER_NEXT_SHIFT, "mode": this._MODE_NORMAL, "state": this._STATE_NORMAL } ]
            }
          },
          "nexts": [ { "trigger": this._TRIGGER_NEXT_MODE, "mode": this._MODE_ALT, "state": this._STATE_ALT_PAGE_ONE } ]
        },
        [this._MODE_ALT]: {
          "states": {
            [this._STATE_ALT_PAGE_ONE]: {
              "label": this._LABEL_ALT1,
              "actions": { "MOD_LEFT_SHIFT": [ { "action": "remove", "class_list": ["active", "locked"] } ] },
              "nexts": [ { "trigger": this._TRIGGER_NEXT_SHIFT, "mode": this._MODE_ALT, "state": this._STATE_ALT_PAGE_TWO } ]
            },
            [this._STATE_ALT_PAGE_TWO]: {
              "label": this._LABEL_ALT2,
              "actions": { "MOD_LEFT_SHIFT": [ { "action": "remove", "class_list": ["active", "locked"] } ] },
              "nexts": [ { "trigger": this._TRIGGER_NEXT_SHIFT, "mode": this._MODE_ALT, "state": this._STATE_ALT_PAGE_ONE } ]
            }
          },
          "nexts": [ { "trigger": this._TRIGGER_NEXT_MODE, "mode": this._MODE_NORMAL, "state": this._STATE_NORMAL } ]
        }
      }
    };
  }

  // private constants
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();
  _triggerPopin = 500;
  _allowedCellDataFields = new Set(['code', 'special', 'popinConfig', 'label', 'fallback']);

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
  _popinTimeouts = new Map();

  constructor() {
    super();

    this._logger = new Logger(this, "android-keyboard-card.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, layoutsAndroid);
    this._resourceManager = new ResourceManager(this, import.meta.url);

    this._currentMode = this.constructor._STATUS_MAP["init"]["mode"];
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
    this.doCheckConfig();
    this.doUpdateConfig();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass()
  }

  doUpdateCells() {
    const statusActions = this.getStatusCurrentActions();
    const statusLabel = this.getStatusCurrentLabel();
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doUpdateCells(statusActions, statusLabel):", statusActions, statusLabel));

    for (const cell of this._elements.cells) {

      const cellConfig = this._layoutManager.getElementData(cell);
      if (!cellConfig) continue;

      this.doUpdateCell(cell, cellConfig, statusActions, statusLabel);
    }
  }

  // Synchronize cell visuals and label with given mode and state
  doUpdateCell(cell, cellConfig, statusActions, statusLabel) {
    this.doUpdateCellVisuals(cell, cellConfig, statusActions);
    this.doUpdateCellLabel(cell, cellConfig, statusLabel);
  }

  // Synchronize cell visuals with given mode and state
  // using per-matching-cell-code configured actions
  doUpdateCellVisuals(cell, cellConfig, statusActions) {
    const cellActions = statusActions?.[cellConfig.code] || [];
    for (const cellAction of cellActions) {
      const actionName = cellAction["action"];
      const actionClassList = cellAction["class_list"];
      if (actionName === "add") cell.classList.add(...actionClassList);
      if (actionName === "remove") cell.classList.remove(...actionClassList);
    }
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
        --base-font-size: 1rem; /* base scaling unit */
        --key-bg: #3b3a3a;
        --key-hover-bg: #4a4a4a;
        --key-active-bg: #2c2b2b;
        --key-special-bg: #222;
        --key-special-color: #ccc;
        --key-height: 3.5rem;
        --key-margin: 0.15rem;
        font-size: var(--base-font-size);
        display: block;
        width: 100%;
        user-select: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-sizing: border-box;
      }
      .keyboard-container {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        padding: 0.5em 0.3em 1em;
        background: #1a1a1a;
        border-radius: 0.5em;
        box-sizing: border-box;
        width: 100%;
      }
      .keyboard-row {
        display: flex;
        gap: 0.3em;
        width: 100%;
      }
      button.key {
        background: var(--key-bg);
        border: none;
        border-radius: 0.4em;
        color: #eee;
        font-size: 1em;
        cursor: pointer;
        height: var(--key-height);
        flex-grow: 1;
        flex-basis: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-sizing: border-box;
        transition: background 0.15s ease;
        padding: 0 0.8em;
        white-space: nowrap;
        overflow: hidden;
        -webkit-tap-highlight-color: transparent; /* Remove mobile tap effect */
        outline: none; /* Prevent focus ring override */
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
      button.key.special {
        background: var(--key-special-bg);
        color: var(--key-special-color);
        font-weight: 600;
        font-size: 0.95em;
      }
      button.key:hover {
        background: var(--key-hover-bg);
      }
      button.key:active {
        background: var(--key-active-bg);
      }
      /* Fix: Ensure active state is visually dominant */
      button.key.active,
      button.key:hover.active,
      button.key:active.active {
        background: #5a5a5a !important;
        color: #fff !important;
      }
      /* Fix: Ensure shift-once state is visually dominant */
      button.key.shift-once,
      button.key:hover.shift-once,
      button.key:active.shift-once {
        background: #374553 !important; /* grey-blue */
        color: #fff !important;
        font-weight: bold;
      }
      /* Fix: Ensure locked state is visually dominant */
      button.key.locked,
      button.key:hover.locked,
      button.key:active.locked {
        background: #3399ff !important; /* blue */
        color: #fff !important;
        font-weight: bold;
      }
      .label-upper {
        position: absolute;
        top: 0.3em;
        right: 0.5em;
        font-size: 0.6em;
        opacity: 0.7;
        user-select: none;
      }
      .label-lower {
        font-size: 1em;
        font-weight: 500;
        user-select: none;
      }
      .key-popin {
        position: fixed; /* Use fixed instead of absolute for document.body */
        background: var(--key-bg, #3b3a3a); /* Fallback if var is missing */
        border-radius: 0.5em;
        padding: 0.3em;
        box-shadow: 0 0.2em 0.8em rgba(0,0,0,0.4);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        user-select: none;
      }
      .key-popin-row {
        display: flex;
      }
      .key-popin button.key {
        margin: var(--key-margin);
        height: var(--key-height);
        background: var(--key-bg, #3b3a3a);
        color: #fff;
        border: none;
        border-radius: 5px;
        font-size: 0.9em;
        padding: 0 0.8em;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .key-popin button.key.active {
        background: #3399ff !important; /* blue */
        color: #000 !important;
      }
      .key-popin.visible {
        opacity: 1;
        transform: scale(1);
      }
      /* Initial state: hidden and scaled down */
      .key-popin-row .key {
        opacity: 0;
        transform: scale(0.8);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      /* When entering: visible and full size */
      .key-popin-row .key.enter-active {
        opacity: 1;
        transform: scale(1);
      }
      /* When leaving: fade out and scale down */
      .key-popin-row .key.leave-active {
        opacity: 0;
        transform: scale(0.8);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      ha-card {
        position: relative;
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
    //TODO: add global PointerUp listener?
  }

  doUpdateConfig() {
    // Adjust host font scale to serve has a reference and properly scale the whole UI
    if (this.shadowRoot.host?.style) {
      this.shadowRoot.host?.style.setProperty('--base-font-size', this._layoutManager.getSafeFontScale());
    }

    if (this._layoutManager.configuredLayoutChanged()) {
      this.doUpdateLayout();
    }
  }

  doUpdateHass() {
    //TODO
  }

  doUpdateLayout() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doUpdateLayout() + this._currentMode, this._currentState", this._currentMode, this._currentState));
    this.doResetLayout();
    this.doCreateLayout();
  }

  doResetLayout() {
    // Reset popin (if any)
    this.doResetPopin();

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
    const overrideCellConfig = { "popinConfig": this.createPopinConfig(cellConfig) };

    // Create cell
    const cell = document.createElement("button");
    this._elements.cells.push(cell);
    cell.classList.add("key");
    if (cellConfig.special) cell.classList.add("special");
    if (cellConfig.width) cell.classList.add(cellConfig.width);
    if (cellConfig.code.startsWith("SPACER_")) cell.classList.add("spacer"); // Disable actions on spacers
    this.setCellData(cell, cellConfig, overrideCellConfig);

    // Create cell content
    const cellContent = this.doCellContent(cellConfig);
    this.doStyleCellContent();
    this.doAttachCellContent(cell, cellContent);
    this.doQueryCellContentElements(cell, cellContent);
    this.doListenCellContent();

    // Update cell visuals and content label (to match current mode and state)
    this.doUpdateCell(cell, cellConfig, this.getStatusCurrentActions(), this.getStatusCurrentLabel());

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
      font_scale: 1.4
    }
  }

  getCardSize() {
    return 1;
  }

  getStatusCurrentMode() {
    return this.constructor._STATUS_MAP["modes"][this._currentMode];
  }

  getStatusCurrentState() {
    return this.getStatusCurrentMode()["states"][this._currentState];
  }

  getStatusCurrentActions() {
    return this.getStatusCurrentState()["actions"];
  }
  
  getStatusCurrentLabel() {
    return this.getStatusCurrentState()["label"];
  }

  isStatusTriggerForMode(trigger) {
    return !!this.getStatusCurrentMode()["nexts"].find(next => next["trigger"].test(trigger));
  }

  isStatusTriggerForState(trigger) {
    return !!this.getStatusCurrentState()["nexts"].find(next => next["trigger"].test(trigger));
  }

  isStatusTrigger(trigger) {
    return this.isStatusTriggerForState(trigger) || this.isStatusTriggerForMode(trigger);
  }

  activateNextStatusMode(trigger) {
    const nextMode = this.getStatusCurrentMode()["nexts"].find(next => next["trigger"].test(trigger));
    if (nextMode) {
      this._currentMode = nextMode["mode"];
      this._currentState = nextMode["state"];
    }
    return !!nextMode;
  }

  activateNextStatusState(trigger) {
    const nextState = this.getStatusCurrentState()["nexts"].find(next => next["trigger"].test(trigger));
    if (nextState) {
      this._currentMode = nextState["mode"];
      this._currentState = nextState["state"];
    }
    return !!nextState;
  }
  
  activateNextStatus(trigger) {
    return this.activateNextStatusState(trigger) || this.activateNextStatusMode(trigger);
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

  // Transform user popin config per (rows/)cell/label
  //
  // "popin": [
  //   [                                                                      <-- [optional] rows. When absent, all cells will form a single row.
  //     { "code": "KEY_E_ACUTE", "label": { "normal": "é" } },               <-- cells / labels
  //     { "code": "KEY_E_GRAVE", "label": { "normal": "è", "shift": "È" } },
  //   ],
  //   [
  //     { "code": "KEY_E_CIRC",  "label": { "normal": "ê", "shift": "Ê" } }
  //   ]
  // ]
  //
  // Into popin config per label/row/cell:
  //
  // "popinConfig": {
  //   "normal": [                                                            <-- labels
  //     [                                                                    <-- rows
  //       { "code": "KEY_E_ACUTE", "label": "é" },                           <-- cells
  //       { "code": "KEY_E_GRAVE", "label": "è" },
  //     ],
  //     [
  //       { "code": "KEY_E_CIRC",  "label": "ê" }
  //     ]
  //   ],
  //   "shift": [
  //     [
  //       { "code": "KEY_E_GRAVE",  "label": "È" },
  //       { "code": "KEY_E_CIRC",   "label": "Ê" },
  //     ]
  //   ]
  // }
  createPopinConfig(cellConfig) {

    // Unlike static keyboard layout cells that always display and figure their label relative to current combination mode of code/mode/state,
    // popin layout cells are not displayed when their is no content for current combination of code/mode/state.
    // So to decide whether or not a popin is displayable on a key, 
    // we need to figure out in advance whether or not there is at least one cell to display 
    // in the future popin to come (or not) for the combination of code/mode/state.
    
    // We use this function to help serving this goal: a popin 

    // Create new popin config
    const popinConfig = {};

    // Retrieve user popin config per (rows/)cell/label
    let popinRows;
    const rawPopinConfig = cellConfig["popin"];
    const firstPopinKeysConfig = rawPopinConfig?.[0];
    if (firstPopinKeysConfig) {
      // single implicit row assumed when only one array of cells defined by user
      popinRows = Array.isArray(firstPopinKeysConfig) ? rawPopinConfig : [rawPopinConfig];
    } else {
      popinRows = [];
    }

    for (const row of popinRows) {
      const modeToRow = {};

      for (const { code, label } of row) {
        for (const [mode, char] of Object.entries(label)) {
          if (!modeToRow[mode]) modeToRow[mode] = [];
          modeToRow[mode].push({ code, label: char });
        }
      }

      // Push each row to the corresponding mode
      for (const [mode, rowItems] of Object.entries(modeToRow)) {
        if (!popinConfig[mode]) popinConfig[mode] = [];
        popinConfig[mode].push(rowItems);
      }
    }

    return popinConfig;
  }

  addPopinTimeout(evt) {
    return setTimeout(() => {
      const popinEntry = this._popinTimeouts.get(evt.pointerId);

      // When no poppin entry: key has been released before timeout
      if (popinEntry && popinEntry["popin-can-show"] && !popinEntry["popin-shown"]) {
        const cell = popinEntry["source"];
        
        // Check whether or not popin can be shown in current mode and state
        popinEntry["popin-can-show"] = this.canShowPopin(cell);
        if (!popinEntry["popin-can-show"]) return;

        // Mark popin as shown
        popinEntry["popin-shown"] = true;
        
        // Show popin
        this.doShowPopin(evt, cell);
      }
    }, this.triggerLongClick); // long-press duration
  }

  clearPopinTimeout(evt) {
    const popinTimeout = this._popinTimeouts.get(evt.pointerId)?.["popin-timeout"];
    if (popinTimeout) clearTimeout(popinTimeout);
  }

  // Popin can be shown when its config exists and contains current status label
  canShowPopin(cell) {
    return !!this._layoutManager.getElementData(cell)?.cellConfig?.["popinConfig"]?.[this.getStatusCurrentLabel()];
  }

  doShowPopin(evt, cell) {
    this.doResetPopin();
    this.doCreatePopin(evt, cell);
  }

  doResetPopin() {
    const popin = this._elements.popin;

    // Detach existing popin from DOM
    if (popin?.parentElement) popin.remove();

    // Clear existing popin DOM content
    if (popin) popin.innerHTML = '';

    // Reset popin cells elements (if any)
    this._elements.popinCells = [];

    // Reset popin rows elements (if any)
    this._elements.popinRows = [];

    // nullify popin reference
    this._elements.popin = null;
  }

  doCreatePopin(evt, cell) {
    const popin = this.doPopin(evt, cell);
    this.doStylePopin();
    this.doAttachPopin(popin);
    this.doQueryPopinElements();
    this.doListenPopin();
    this.doPromptPopin();
    this.doPositionPopin();
  }

  doPopin(evt, cell) {

    // Create popin
    const popin = document.createElement("div");
    this._elements.popin = popin;
    popin.className = "key-popin";

    // Create popin rows
    const popinConfig = this._layoutManager.getElementData(cell)["popinConfig"];
    for (const rowConfig of popinConfig) {
      const popinRow = this.doPopinRow(rowConfig);
      this.doStylePopinRow();
      this.doAttachPopinRow(popin, popinRow);
      this.doQueryPopinRowElements();
      this.doListenPopinRow();
    }
  }

  doStylePopin() {
    // Make popin position absolute (relative to card)
    popin.style.position = "absolute";
  }

  doAttachPopin(popin) {
    const card = this._elements.card;
    card.appendChild(popin);
  }

  doQueryPopinElements() {
    // nothing to do: element already attached during creation
  }

  doListenPopin() {
    // When any pointer is up anywhere: close popin
    this._eventManager.addPointerUpListener(document, this.onClosingPopin.bind(this), { once: true });
  }

  doPromptPopin() {
    // Trigger cells animations to prompt popin (requires attached popin)
    requestAnimationFrame(() => {
      popinCell.classList.add("enter-active");
    });
  }

  doPositionPopin() {
    // Absolute positionning computation and style of popin (requires popin to already be added into DOM as card child)
    const card = this._elements.card;
    const popin = this._elements.popin;
    
    // 1. Get popin bounding box
    const cardRect = card.getBoundingClientRect();
    const popinRect = popin.getBoundingClientRect();

    // 2. Compute initial popin position relative to card
    let popinLeft = evt.clientX - cardRect.left - popinRect.width / 2;
    let popinTop = evt.clientY - cardRect.top - popinRect.height - 8; // 8px vertical gap

    // 3. Clamp horizontally (inside card)
    if (popinLeft < 0) {
      popinLeft = 0;
    } else if (popinLeft + popinRect.width > cardRect.width) {
      popinLeft = cardRect.width - popinRect.width;
    }

    // 4. Clamp vertically (inside card)
    if (popinTop < 0) {
      // If not enough space above, show below
      popinTop = evt.clientY - cardRect.top + 8;
      // If that too overflows bottom, clamp
      if (popinTop + popinRect.height > cardRect.height) {
        popinTop = cardRect.height - popinRect.height;
      }
    }

    // 5. Set popin absolute position
    popin.style.position = "absolute";
    popin.style.left = `${popinLeft}px`;
    popin.style.top = `${popinTop}px`;
  }

  doPopinRow(rowConfig) {

    // Create popin row
    const popinRow = document.createElement("div");
    this._elements.popinRows.push(popinRow);
    popinRow.className = "key-popin-row";

    // Create popin row cells
    for (const cellConfig of rowConfig) {
      const popinCell = this.doPopinCell(cellConfig);
      this.doStylePopinCell();
      this.doAttachPopinCell(popinRow, popinCell);
      this.doQueryPopinCellElements();
      this.doListenPopinCell();
    }
  }

  doStylePopinRow() {
    // nothing to do: style already included into card style
  }

  doAttachPopinRow(popin, popinRow) {
    popin.appendChild(popinRow);
  }

  doQueryPopinRowElements() {
    // nothing to do: element already attached during creation
  }

  doListenPopinRow() {
    // nothing to do: no needs to listen events for this element
  }

  doPopinCell(cellConfig) {
    
    // Create popin cell 
    const popinCell = document.createElement("button");
    this._elements.popinCells.push(popinCell);
    popinCell.classList.add("key");
    if (cellConfig.width) popinCell.classList.add(cellConfig.width);
    this.setCellData(popinCell, defaultCellConfig, cellConfig);

    // Create popin cell content
    const row = this.doPopinCellContent(popinCell, popinCellContent);
    this.doStylePopinCellContent();
    this.doAttachPopinCellContent(popinRow);
    this.doQueryPopinCellContentElements();
    this.doListenPopinCellContent();
  }

  doStylePopinCell() {
    // Make popin cell the same width than popin base button
    const baseBtnWidth = btn.getBoundingClientRect().width;
    popinCell.style.width = `${baseBtnWidth}px`;
  }

  doAttachPopinCell(popinRow, popinCell) {
    popinRow.appendChild(popinCell);
  }

  doQueryPopinCellElements(popinCell) {
    // nothing to do: element already attached during creation
  }

  doListenPopinCell(popinCell) {
    // Visual events
    this._eventManager.addPointerEnterListener(popinCell, this.onPopinButtonPointerEnter.bind(this));
    this._eventManager.addPointerLeaveListener(popinCell, this.onPopinButtonPointerLeave.bind(this));

    // Action and visual events
    this._eventManager.addPointerDownListener(popinCell, this.onPopinButtonPointerDown.bind(this));
    this._eventManager.addPointerUpListener(popinCell, this.onPopinButtonPointerUp.bind(this));
    this._eventManager.addPointerCancelListener(popinCell, this.onPopinButtonPointerUp.bind(this));
  }

  doPopinCellContent(cellConfig) {
    // Create popin cell content
    const popinCellContent = document.createElement("span");
    popinCellContent.className = "label-lower";

    // Set popin cell content label
    popinCellContent.textContent = cellConfig["label"];
    return popinCellContent;
  }

  doStylePopinCellContent() {
    // nothing to do: style already included into card style
  }

  doAttachPopinCellContent(popinCell, popinCellContent) {
    popinCell.appendChild(popinCellContent);
  }

  doQueryPopinCellContentElements() {
    popinCell._label = popinCellContent;
  }

  doListenPopinCellContent() {
    // nothing to do: no needs to listen events for this element
  }

  onClosingPopin(evt) {
    this.doClosePopin();
  }

  doClosePopin() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("doClosePopin()"));
    this.doResetPopin();
  }

  onPopinButtonPointerEnter(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const btn = evt.currentTarget; // Retrieve clickable popin button attached to the listener that triggered the event

    btn.classList.add("active");
  }

  onPopinButtonPointerLeave(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const btn = evt.currentTarget; // Retrieve clickable popin button attached to the listener that triggered the event

    btn.classList.remove("active");
  }

  onPopinButtonPointerDown(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const btn = evt.currentTarget; // Retrieve clickable popin button attached to the listener that triggered the event

    btn.classList.add("active");
    this._eventManager.hapticFeedback();
  }

  onPopinButtonPointerUp(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const btn = evt.currentTarget; // Retrieve clickable popin button attached to the listener that triggered the event

    btn.classList.remove("active");
    //this.handleKeyPress(btn);
    //this.handleKeyRelease(btn);
    this.doClosePopin();
  }

  setCellData(cell, defaultConfig, overrideConfig) {
    this._layoutManager.setElementData(cell, defaultConfig, overrideConfig, (key, value, source) => this._allowedCellDataFields.has(key));
  }

  // Set listeners on a clickable button
  addClickableListeners(btn) {
    this._eventManager.addPointerDownListener(btn, this.onButtonPointerDown.bind(this));
    this._eventManager.addPointerUpListener(btn, this.onButtonPointerUp.bind(this));
    this._eventManager.addPointerCancelListener(btn, this.onButtonPointerUp.bind(this));
  }

  onButtonPointerDown(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const btn = evt.currentTarget; // Retrieve clickable button attached to the listener that triggered the event
    this.doKeyPress(evt, btn);
  }

  onButtonPointerUp(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const btn = evt.currentTarget; // Retrieve clickable button attached to the listener that triggered the event
    this.doKeyRelease(evt, btn);
  }

  doKeyPress(evt, btn) {

    // Mark clickable button active for visual feedback
    btn.classList.add("active");

    // Retrieve clickable button data
    const cellConfig = this._layoutManager.getElementData(btn);
    if (!cellConfig) return;

    // Key code to press
    const code = cellConfig.code;
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Key code to press:", code));

    // Make this clickable button press the reference button to prevent unwanted releases trigger from other clickable buttons in the future
    this._referenceBtn = btn;

    if (this.activateNextStatus(code)) {
      // Pressed key code triggered keyboard status change

      // Update all cells labels and visuals
      this.doUpdateCells();
    } else {
      // Pressed key code does not triggered keyboard status change

      // Special key pressed
      if (cellConfig.special) {

        // Send special key press to HID
        this.appendCode(code);
      } else {
        // Normal key pressed

        // Do not send pressed key to HID (key will be send to HID on release)

        // add popin timeout
        this._popinTimeouts.set(evt.pointerId, { 
          "popin-can-show": true,                     // until proven wrong, popin can be shown
          "popin-shown": false,                       // true when popin was shown
          "source": btn ,                             // popin source button
          "popin-timeout": this.addPopinTimeout(evt)  // when it expires, triggers the associated inner callback to show (or not) popin
        });
      }
    }

    // Send haptic feedback to make user acknownledgable of succeeded press event
    this._eventManager.hapticFeedback();
  }

  doKeyRelease(evt, btn) {

    // Retrieve popin entry (when existing)
    const popinEntry = this._popinTimeouts.get(evt.pointerId);

    // Remove popin timeout (when set before)
    this.clearPopinTimeout(evt);
    this._popinTimeouts.delete(evt.pointerId);

    // Unmark clickable button active for visual feedback
    btn.classList.remove("active");

    // Retrieve clickable button data
    const cellConfig = this._layoutManager.getElementData(btn);
    if (!cellConfig) return;

    // Key code to release
    const code = cellConfig.code;
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Key code to release:", code));

    // Suppress when pointer was originated from a different button
    const referenceCode = this._layoutManager.getElementData(this._referenceBtn)?.code;
    if (referenceCode !== code) {
      //TODO: foolproof multiples buttons with same code, by using unique ID per button for reference and comparison, instead of key code
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted due to existing reference key code ${referenceCode}`));
      return;
    }

    // Suppress when pointer released over a key code that is a virtual modifier (ie. not a real key to send to HID)
    if (this.isVirtualModifier(code)) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted (virtual modifier)`));
      return;
    }

    // Suppress when pointer triggered a popin with extended chars
    if (popinEntry && popinEntry["popin-shown"]) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted (button was used to trigger popin for extended chars)`));
      return;
    }

    // Special but not virtual key released
    if (cellConfig.special) {

      if (this._layoutManager.hasButtonOverride(btn)) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted due to detected override on ${btn.id}`));
        this.executeButtonOverride(btn);
      } else {
        // Default action
      
        // Release HID key
        this.removeCode(code);
      }

    } else {

      // Non-special and not virtual key clicked
      const charToSend = btn._label.textContent || "";
      if (charToSend) {

        // Click HID key
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("key-normal-clicked:", code, "char:", charToSend));
        this.sendKeyboardChar(charToSend);
      }
    }

    // Switch to next state when "shift-once" was set and a key was pressed (other than MOD_LEFT_SHIFT, previously debounced)
    if (this._currentState === this.constructor._STATE_SHIFT_ONCE) {
      this.activateNextState();
      this.doUpdateCells();
    }

    // Send haptic feedback to make user acknownledgable of succeeded release event
    this._eventManager.hapticFeedback();
  }

  executeButtonOverride(btn) {
    const overrideConfig = this._layoutManager.getButtonOverride(btn.id);

    // When sensor detected in override configuration, 
    // choose override action to execute according to current sensor state (on/off)
    let overrideAction;
    if (overrideConfig['sensor']) {
      if (btn._sensorState && btn._sensorState.toLowerCase() === "on") {
        overrideAction = overrideConfig['action_when_on'];
      } else {
        overrideAction = overrideConfig['action_when_off'];
      }
    } else {
      overrideAction = overrideConfig['action'];
    }

    // Execute override action
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Executing override action on ${btn.id}:`, overrideAction));
    this._eventManager.triggerHaosTapAction(btn, overrideAction);
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

  // When key code is a virtual modifier key, returns true. Returns false otherwise.
  isVirtualModifier(code) {
    return code === "KEY_MODE" || code === "MOD_LEFT_SHIFT";
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

  // Send clicked char symbols to HID keyboard 
  // and let it handle the right key-press combination using current kb layout
  sendKeyboardChar(charToSend) {
    this._eventManager.callComponentService("chartap", {
      sendChars: charToSend,
    });
  }
}

customElements.define("android-keyboard-card", AndroidKeyboardCard);