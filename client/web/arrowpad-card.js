import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';
import * as layoutsArrowpad from './layouts/arrowpad/index.js';

console.info("Loading arrowpad-card");

class ArrowPadCard extends HTMLElement {

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _resourceManager;
  _pressedModifiers = new Set();
  _pressedKeys = new Set();
  _pressedConsumers = new Set();

  // private constants
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();

  constructor() {
    super();

    this._logger = new Logger(this, "arrowpad-card.js");
    this._eventManager = new EventManager(this);
    this._resourceManager = new ResourceManager(this, import.meta.url, layoutsArrowpad);

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

  // jobs
  doCheckConfig() {
    this._resourceManager.checkConfiguredLayout();
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
        --squarekey-bg: #3b3a3a;
        --squarekey-hover-bg: #4a4a4a;
        --squarekey-active-bg: #2c2b2b;
        --squarekey-special-bg: #222;
        --squarekey-special-color: #ccc;
        --squarekey-height: 3.5rem;
        --squarekey-margin: 0.15rem;
        display: block;
        width: 100%;
        user-select: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-sizing: border-box;
      }
      .keyboard-container {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.5rem 0.3rem 1rem;
        background: #1a1a1a;
        border-radius: 8px;
        box-sizing: border-box;
        width: 100%;
      }
      .keyboard-row {
        display: flex;
        gap: 0.3rem;
        width: 100%;
      }
      button.squarekey {
        background: var(--squarekey-bg);
        border: none;
        border-radius: 5px;
        color: #eee;
        font-size: 1.1rem;
        cursor: pointer;
        height: var(--squarekey-height);
        width: var(--squarekey-height); /* Ensure square shape */
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-sizing: border-box;
        transition: background 0.15s ease;
        padding: 0 0.5rem;
        white-space: nowrap;
        overflow: hidden;
        -webkit-tap-highlight-color: transparent; /* Remove mobile tap effect */
        outline: none; /* Prevent focus ring override */
        flex: 0 0 auto; /* Prevent stretching */
      }
      button.squarekey.spacer {
        pointer-events: none;
        background: transparent;
        border: none;
        box-shadow: none;
        opacity: 0;
        cursor: default;
      }
      button.squarekey.wide {
        width: calc(var(--squarekey-height) * 2);
      }
      button.squarekey.wider {
        width: calc(var(--squarekey-height) * 3);
      }
      button.squarekey.altkey {
        width: calc(var(--squarekey-height) * 1.5);
      }
      button.squarekey.spacebar {
        width: calc(var(--squarekey-height) * 11);
      }
      button.squarekey.special {
        background: var(--squarekey-special-bg);
        color: var(--squarekey-special-color);
        font-weight: 600;
        font-size: 0.95rem;
      }
      button.squarekey:hover {
        background: var(--squarekey-hover-bg);
      }
      button.squarekey:active {
        background: var(--squarekey-active-bg);
      }
      /* Fix: Ensure active state is visually dominant */
      button.squarekey.active,
      button.squarekey:hover.active,
      button.squarekey:active.active {
        background: #5a5a5a !important;
        color: #fff !important;
      }
      .label-upper {
        position: absolute;
        top: 0.3rem;
        right: 0.5rem;
        font-size: 0.6rem;
        opacity: 0.7;
        user-select: none;
      }
      .label-lower {
        font-size: inherit;
        font-weight: 500;
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
    this._elements.wrapper = card.querySelector(".keyboard-container")
  }

  doListen() {
    //TODO: add global PointerUp listener?
  }

  doUpdateConfig() {
    if (this._resourceManager.configuredLayoutChanged()) {
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
    this._resourceManager.resetAttachedLayout();
  }

  doCreateLayout() {

    // Mark configured layout as attached
    this._resourceManager.configuredLayoutAttached();

    // Create rows
    for (const rowConfig of this._resourceManager.getLayout().rows) {
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
    cell.classList.add("squarekey");
    if (cellConfig.special) cell.classList.add("special");
    if (cellConfig.width) cell.classList.add(cellConfig.width);
    if (cellConfig.code.startsWith("SPACER_")) cell.classList.add("spacer"); // Disable actions on spacers
    cell._keyData = cellConfig;

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
      layout: "common",
      haptic: true,
      log_level: "warn",
      log_pushback: false,
      buttons_overrides: {},
    }
  }

  getCardSize() {
    return 1;
  }

  // Set key data with code to send when a button is clicked
  addClickableData(btn, btnConfig) {
    if (btnConfig && btnConfig.code) btn._keyData = { code: btnConfig.code };
    if (!btn._keyData) btn._keyData = {};
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
    this.doKeyPress(btn);
  }

  onButtonPointerUp(evt) {
    evt.preventDefault(); // prevent unwanted focus or scrolling
    const btn = evt.currentTarget; // Retrieve clickable button attached to the listener that triggered the event
    this.doKeyRelease(btn);
  }

  doKeyPress(btn) {

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

    if (this.hasButtonOverride(btn)) {
      // Override detected: do nothing (override action will be executed on button up)
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Override detected on key press (suppressed):", btn.id));
    } else {
      // Default action

      // Press HID key
      this.appendCode(code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded press event
    this._eventManager.hapticFeedback();
  }

  doKeyRelease(btn) {

    // Unmark clickable button active for visual feedback
    btn.classList.remove("active");

    // Retrieve clickable button data
    const keyData = btn._keyData;
    if (!keyData) return;

    // Key code to release
    const code = keyData.code;
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("Key code to release:", code));

    // Suppress this clickable button release if reference pointer down event was originated from a different clickable button
    const referenceCode = this._referenceBtn?._keyData?.code;
    if (referenceCode !== code) {
      //TODO: foolproof multiples buttons with same code, by using unique ID per button for reference and comparison, instead of key code
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted due to existing reference key code ${referenceCode}`));
      return;
    }

    if (this.hasButtonOverride(btn)) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Key code ${code} release aborted due to detected override on ${btn.id}`));
      this.executeButtonOverride(btn);
    } else {
      // Default action

      // Release HID key
      this.removeCode(code);
    }

    // Send haptic feedback to make user acknownledgable of succeeded release event
    this._eventManager.hapticFeedback();
  }

  getButtonsOverrides() {
    return this._config?.['buttons_overrides'] || this.getStubConfig()['buttons_overrides'];
  }

  hasButtonOverride(btn) {
    return (btn.id && this.getButtonsOverrides()[btn.id]);
  }

  executeButtonOverride(btn) {
    const overrideConfig = this.getButtonsOverrides()[btn.id];

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

customElements.define("arrowpad-card", ArrowPadCard);