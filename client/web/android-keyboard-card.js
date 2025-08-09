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

  // private constants
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();
  _MODE_NORMAL = 0; // Mode state 1: normal/shift mode
  _MODE_ALT = 1;    // Mode state 2: alternative mode
  _SHIFT_STATE_NORMAL = 0; // Shift state 1: Normal
  _SHIFT_STATE_ONCE = 1;   // Shift state 2: Shift-once
  _SHIFT_STATE_LOCKED = 2; // Shift state 3: Shift-locked
  _ALT_PAGE_ONE = 0; // Alt state 1: Alternative symbols page 1
  _ALT_PAGE_TWO = 1; // Alt state 2: Alternative symbols page 2
  _triggerPopin = 500;
  _allowedDataFields = new Set(['code', 'special', 'popinKeys', 'label', 'fallback']);

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _layoutManager;
  _pressedModifiers = new Set();
  _pressedKeys = new Set();
  _pressedConsumers = new Set();
  _currentMode = _MODE_NORMAL;
  _shiftState = _SHIFT_STATE_NORMAL;
  _altState = _ALT_PAGE_ONE;
  _popin = null;
  _popinTimeouts = new Map();

  constructor() {
    super();

    this._logger = new Logger(this, "android-keyboard-card.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, layoutsAndroid);
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
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set setConfig(config):", config));
    this._config = config;
    this.doCheckConfig();
    this.doUpdateConfig();
  }

  set hass(hass) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("set hass(hass):", hass));
    this._hass = hass;
    this.doUpdateHass()
  }

  updateModeAndStates(code) {
    if (code === "KEY_MODE") {
      // Switch current mode
      if (this._currentMode === this._MODE_NORMAL) {
        this._currentMode = this._MODE_ALT;
        this._altState = this._ALT_PAGE_ONE;
      } else if (this._currentMode === this._MODE_ALT) {
        this._currentMode = this._MODE_NORMAL;
      }
    }
    if (code === "MOD_LEFT_SHIFT") {
      // Normal mode: switch shift state
      if (this._currentMode === this._MODE_NORMAL) {
        if (this._shiftState === this._SHIFT_STATE_NORMAL) {
          this._shiftState = this._SHIFT_STATE_ONCE;
        } else if (this._shiftState === this._SHIFT_STATE_ONCE) {
          this._shiftState = this._SHIFT_STATE_LOCKED;
        } else if (this._shiftState === this._SHIFT_STATE_LOCKED) {
          this._shiftState = this._SHIFT_STATE_NORMAL;
        }
      } else if (this._currentMode === this._MODE_ALT) {
        // Alternative mode: switch alternative page
        if (this._altState === this._ALT_PAGE_ONE) {
          this._altState = this._ALT_PAGE_TWO;
        } else if (this._altState === this._ALT_PAGE_TWO) {
          this._altState = this._ALT_PAGE_ONE;
        }
      }
    }

    // Update visual layout with modified virtual modifiers
    this.updateLabels();
  }

  updateLabels() {
    for (const btn of this._elements.cells) {

      const keyData = btn._keyData;
      if (!keyData) continue;

      // Pressed key code (keyboard layout independant, later send to remote keyboard)
      const code = keyData.code;

      // Special handling of virtual shift key

      // Determine displayed labels
      let displayLower = "";

      if (this._currentMode === this._MODE_NORMAL) {
        if (this._shiftState === this._SHIFT_STATE_NORMAL) {
          if (code === "MOD_LEFT_SHIFT") btn.classList.remove("active", "locked");
          displayLower = this.getlLabelNormal(keyData);
        } else if (this._shiftState === this._SHIFT_STATE_ONCE) {
          if (code === "MOD_LEFT_SHIFT") btn.classList.add("active");
          displayLower = this.getLabelAlternativeShift(keyData);
        } else if (this._shiftState === this._SHIFT_STATE_LOCKED) {
          if (code === "MOD_LEFT_SHIFT") btn.classList.add("locked");
          displayLower = this.getLabelAlternativeShift(keyData);
        }
      } else if (this._currentMode === this._MODE_ALT) {
        if (code === "MOD_LEFT_SHIFT") btn.classList.remove("active", "locked");
        if (this._altState === this._ALT_PAGE_ONE) {
          displayLower = this.getLabelAlternativeAlt1(keyData);
        } else if (this._altState === this._ALT_PAGE_TWO) {
          displayLower = this.getLabelAlternativeAlt2(keyData);
        }
      }

      if (!displayLower && keyData.fallback) {
        displayLower = keyData.label[keyData.fallback] || "";
      }

      // Set displayed labels
      btn._lowerLabel.textContent = displayLower;
    }
  }

  getlLabelNormal(keyData) {
    return keyData.label.normal;
  }

  getLabelAlternativeShift(keyData) {
    return this.getLabelAlternative(keyData, keyData.label.shift);
  }

  getLabelAlternativeAlt1(keyData) {
    return this.getLabelAlternative(keyData, keyData.label.alt1);
  }

  getLabelAlternativeAlt2(keyData) {
    return this.getLabelAlternative(keyData, keyData.label.alt2);
  }

  // Given:
  // - keyData: a <button>.keyData object
  // - alternativeLabel: an alternative label
  // When:
  // - alternativeLabel is defined, then alternativeLabel is returned
  // - keyData.special is truthy, then normal label from keyData is returned
  // - otherwise, empty label is returned
  getLabelAlternative(keyData, alternativeLabel) {
    let modifiedLabel = "";
    if (alternativeLabel != null) {
      modifiedLabel = alternativeLabel;
    } else if (keyData.special) {
      modifiedLabel = this.getlLabelNormal(keyData);
    }
    return modifiedLabel;
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
      button.key.locked {
        background: #777 !important;
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
    this._elements.wrapper = card.querySelector(".keyboard-container");
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
    this.doResetLayout();
    this.doCreateLayout();
  }

  doResetLayout() {
    // Detach existing layout from DOM
    this._elements.wrapper.innerHTML = '';

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
    this._elements.wrapper.appendChild(row);
  }

  doQueryRowElements() {
    // Nothing to do here: element already referenced and sub-elements already are included by them
  }

  doListenRow() {
    // Nothing to do here: no listener on element and sub-elements listeners are included by them
  }

  doCell(rowConfig, cellConfig) {
    const cell = document.createElement("button");
    this._elements.cells.push(cell);
    cell.classList.add("key");
    if (cellConfig.special) cell.classList.add("special");
    if (cellConfig.width) cell.classList.add(cellConfig.width);
    if (cellConfig.code.startsWith("SPACER_")) cell.classList.add("spacer"); // Disable actions on spacers
    this.addClickableData(cell, null, cellConfig);

    // Create cell content
    const cellContent = this.doCellContent(cellConfig);
    this.doStyleCellContent();
    this.doAttachCellContent(cell, cellContent);
    this.doQueryCellContentElements(cell, cellContent);
    this.doListenCellContent();

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
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("doCellContent(cellConfig):", cellConfig));

    const cellContent = document.createElement("span");
    cellContent.className = "label-lower";
    cellContent.textContent = cellConfig.label.normal || "";

    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("created cellContent:", cellContent));
    return cellContent;
  }

  doStyleCellContent() {
    // Nothing to do here: already included into card style
  }

  doAttachCellContent(cell, cellContent) {
    cell.appendChild(cellContent);
  }

  doQueryCellContentElements(cell, cellContent) {
    cell._lowerLabel = cellContent;
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
      font_scale = 1.4
    }
  }

  getCardSize() {
    return 1;
  }

  // Set key data
  addClickableData(btn, defaultBtnConfig, btnConfig) {
    this.addClickableFilteredData(btn, defaultBtnConfig, btnConfig, (key, value, source) => this._allowedDataFields.has(key));
  }

  addClickableFilteredData(btn, defaultBtnConfig, btnConfig, accept) {
    if (!btn._keyData) btn._keyData = {};

    // Process defaults first
    if (defaultBtnConfig && typeof defaultBtnConfig === 'object') {
      for (const [key, value] of Object.entries(defaultBtnConfig)) {
        if (accept?.(key, value, 'default')) {
          btn._keyData[key] = value;
        }
      }
    }

    // Then override with user config
    if (btnConfig && typeof btnConfig === 'object') {
      for (const [key, value] of Object.entries(btnConfig)) {
        if (accept?.(key, value, 'user')) {
          btn._keyData[key] = value;
        }
      }
    }
  }

  // Set listeners on a clickable button
  addClickableListeners(btn) {
    this._eventManager.addPointerDownListener(btn, this.onButtonPointerDown.bind(this));
    this._eventManager.addPointerUpListener(btn, this.onButtonPointerUp.bind(this));
    this._eventManager.addPointerCancelListener(btn, this.onButtonPointerUp.bind(this));
  }

  addPopinTimeout(evt) {
    return setTimeout(() => {
      const popinEntry = this._popinTimeouts.get(evt.pointerId);
      if (popinEntry && !popinEntry["popin-detected"]) {
        // Button is still pressed and popin as not been already been shown
        popinEntry["popin-detected"] = true; // Mark popin as shown
        const btn = popinEntry?.["source"];
        this.showPopin(e, hass, card, btn); //TODO: treat this function
      }
    }, this.triggerLongClick); // long-press duration
  }

  clearPopinTimeout(evt) {
    const popinTimeout = this._popinTimeouts.get(evt.pointerId)?.["popin-timeout"];
    if (popinTimeout) clearTimeout(popinTimeout);
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
    // reset the poppin base key unconditionally to ensure 
    // it does not stay stuck forever in odd conditions
    this._currentPopinBaseKey = null;

    // Mark clickable button active for visual feedback
    btn.classList.add("active");

    // Retrieve clickable button data
    const keyData = btn._keyData;
    if (!keyData) return;

    // Key code to press
    const code = keyData.code;
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Key code to press:", code));

    // Make this clickable button press the reference button to prevent unwanted releases trigger from other clickable buttons in the future
    this._referenceBtn = btn;

    if (this.isVirtualModifier(code)) {
      // Virtual modifier key press
      this.updateModeAndStates(code);
    } else {
      // Non-virtual modifier key press
      
      if (this._layoutManager.hasButtonOverride(btn)) {
        // Override detected: do nothing (override action will be executed on button up)
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Override detected on key press (suppressed):", btn.id));
      } else {
        // Default action

        // Special key pressed
        if (btn._keyData.special) {
        
          // Press HID special key
          if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("key-special-pressed:", code));
          this.appendCode(hass, code);
        
        } else {
          // Normal key pressed: add popin timeout
          this._popinTimeouts.set(evt.pointerId, { "popin-detected": false, "source": btn , "popin-timeout": this.addPopinTimeout(evt) } );
        }
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

    // Retrieve clickable button data
    const keyData = btn._keyData;
    if (!keyData) return;

    // Key code to release
    const code = keyData.code;
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Key code to release:", code));

    // Suppress this clickable button release if toggable virtual modifier
    if (code === "MOD_LEFT_SHIFT") {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted (toggable virtual modifier)`));
      return;
    }

    // Unmark clickable button active for visual feedback
    btn.classList.remove("active");

    // Suppress this clickable button release if used to trigger popin for extended chars
    if (popinEntry && popinEntry["popin-detected"]) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted (button was used to trigger popin for extended chars)`));
      return;
    }

    // Suppress this clickable button release if reference pointer down event was originated from a different clickable button
    const referenceCode = this._referenceBtn?._keyData?.code;
    if (referenceCode !== code) {
      //TODO: foolproof multiples buttons with same code, by using unique ID per button for reference and comparison, instead of key code
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted due to existing reference key code ${referenceCode}`));
      return;
    }

    // Do not send virtual modifier keys
    if (this.isVirtualModifier(code)) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted (virtual modifier)`));
      return;
    }

    // Special but not virtual key released
    if (btn._keyData.special) {

      if (this._layoutManager.hasButtonOverride(btn)) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted due to detected override on ${btn.id}`));
        this.executeButtonOverride(btn);
      } else {
        // Default action
      
        // Release HID key
        this.removeCode(code);
      }

    } else {

      // Suppress the unwanted post-poppin base key release event fired by poppin release front button
      if (this._currentPopinBaseKey && this._currentPopinBaseKey._keyData.code === keyData.code) {
        this._currentPopinBaseKey = null;
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted (release transmitted to popin base button when releasing extended char)`));
        return; 
      }

      // Non-special and not virtual key clicked
      const charToSend = btn._lowerLabel.textContent || "";
      if (charToSend) {

        // Click HID key
        if (this.logger.isTraceEnabled()) console.debug(...this.logger.trace("key-normal-clicked:", code, "char:", charToSend));
        this.sendKeyboardChar(charToSend);
      }
    }

    // Switch back to normal when "shift-once" was set and a key different from SHIFT was pressed
    if (this._shiftState === this._SHIFT_STATE_ONCE) {
      this._shiftState = this._SHIFT_STATE_NORMAL;
      this.updateLabels();
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