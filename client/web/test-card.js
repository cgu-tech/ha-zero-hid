import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';
import { KeyCodes } from './utils/keycodes.js';
import { ConsumerCodes } from './utils/consumercodes.js';
import { StateMachine } from './utils/state-machine.js';

console.info("Loading test-card");

export class TestCard extends HTMLElement {

  // private init required constants
  static _TRACKPAD_MACHINE;

  static _TRACKPAD_STATE_INACTIVE = '1';
  static _TRACKPAD_STATE_MOVE = '2';
  static _TRACKPAD_STATE_PRESS_LONG = '3';
  static _TRACKPAD_STATE_TIMEOUT_SHORT = '4';
  static _TRACKPAD_STATE_TIMEOUT_LONG = '5';

  static _TRACKPAD_CALLBACK_TIMEOUT_SHORT  = '1';
  static _TRACKPAD_CALLBACK_TIMEOUT_LONG   = '2';
  static _TRACKPAD_CALLBACK_CLICK_SHORT    = '3';
  static _TRACKPAD_CALLBACK_PRESS_LONG     = '4';
  static _TRACKPAD_CALLBACK_MOVE_START     = '5';
  static _TRACKPAD_CALLBACK_MOVE           = '6';
  static _TRACKPAD_CALLBACK_MOVE_STOP      = '7';
  static _TRACKPAD_CALLBACK_RELEASE_LONG   = '8';

  static _TRACKPAD_TIMEOUT_SHORT = '1';
  static _TRACKPAD_TIMEOUT_LONG = '2';

  static _TRACKPAD_TRIGGER_POINTER_DOWN = '1';
  static _TRACKPAD_TRIGGER_POINTER_MOVE = '2';
  static _TRACKPAD_TRIGGER_POINTER_UP = '3';
  static _TRACKPAD_TRIGGER_TIMEOUT_SHORT_EXPIRED = '4';
  static _TRACKPAD_TRIGGER_TIMEOUT_LONG_EXPIRED = '5';

  // Should be initialized in a static block to avoid JS engine to bug on static fields not-already-referenced otherwise
  static {
    this._TRACKPAD_MACHINE = {
      [this._MACHINE_INIT]: { [this._MACHINE_STATE]: this._TRACKPAD_STATE_INACTIVE },
      [this._MACHINE_STATES]: {
        [this._TRACKPAD_STATE_INACTIVE]: {
          [this._MACHINE_ACTIONS]: [
            { [this._MACHINE_ACTION]: this._MACHINE_ACTION_REMOVE, [this._ACTION_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_SHORT, this._TRACKPAD_TIMEOUT_LONG] }
          ],
          [this._MACHINE_NEXTS]: [ 
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_POINTER_DOWN, [this._MACHINE_STATE]: this._TRACKPAD_STATE_TIMEOUT_SHORT,  [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_TIMEOUT_SHORT }
          ]
        },
        [this._TRACKPAD_STATE_TIMEOUT_SHORT]: {
          [this._MACHINE_ACTIONS]: [
            { [this._MACHINE_ACTION]: this._MACHINE_ACTION_ADD,    [this._ACTION_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_SHORT] }
          ],
          [this._MACHINE_NEXTS]: [ 
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_TIMEOUT_SHORT_EXPIRED, [this._MACHINE_STATE]: this._TRACKPAD_STATE_TIMEOUT_LONG,  [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_TIMEOUT_LONG }, 
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_POINTER_MOVE,  [this._MACHINE_STATE]: this._TRACKPAD_STATE_MOVE, [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_START },
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_POINTER_UP,  [this._MACHINE_STATE]: this._TRACKPAD_STATE_INACTIVE, [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_CLICK_SHORT }
          ]
        },
        [this._TRACKPAD_STATE_TIMEOUT_LONG]: {
          [this._MACHINE_ACTIONS]: [
            { [this._MACHINE_ACTION]: this._MACHINE_ACTION_REMOVE, [this._ACTION_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_SHORT] },
            { [this._MACHINE_ACTION]: this._MACHINE_ACTION_ADD,    [this._ACTION_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG] }
          ],
          [this._MACHINE_NEXTS]: [ 
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_TIMEOUT_LONG_EXPIRED, [this._MACHINE_STATE]: this._TRACKPAD_STATE_PRESS_LONG,  [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_PRESS_LONG }, 
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_POINTER_MOVE,  [this._MACHINE_STATE]: this._TRACKPAD_STATE_MOVE, [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_START },
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_POINTER_UP, [this._MACHINE_STATE]: this._TRACKPAD_STATE_INACTIVE,  [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_CLICK_SHORT }
          ]
        },
        [this._TRACKPAD_STATE_MOVE]: {
          [this._MACHINE_ACTIONS]: [
            { [this._MACHINE_ACTION]: this._MACHINE_ACTION_REMOVE, [this._ACTION_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_SHORT, this._TRACKPAD_TIMEOUT_LONG] }
          ],
          [this._MACHINE_NEXTS]: [ 
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_POINTER_MOVE, [this._MACHINE_STATE]: this._TRACKPAD_STATE_MOVE,  [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_MOVE }, 
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_POINTER_UP,  [this._MACHINE_STATE]: this._TRACKPAD_STATE_INACTIVE, [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_STOP }
          ]
        },
        [this._TRACKPAD_STATE_PRESS_LONG]: {
          [this._MACHINE_ACTIONS]: [
            { [this._MACHINE_ACTION]: this._MACHINE_ACTION_REMOVE, [this._ACTION_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG] }
          ],
          [this._MACHINE_NEXTS]: [ 
            { [this._MACHINE_TRIGGER]: this._TRACKPAD_TRIGGER_POINTER_UP, [this._MACHINE_STATE]: this._TRACKPAD_STATE_INACTIVE,  [this._MACHINE_CALLBACK]: this._TRACKPAD_CALLBACK_RELEASE_LONG }
          ]
        }
      }
    };
  }

  // private constants
  _keycodes = new KeyCodes().getMapping();
  _consumercodes = new ConsumerCodes().getMapping();
  _allowedCellData = new Set(['code', 'special', 'popinConfig', 'label', 'fallback']);
  
  _trackpadShortDelay = 150;
  _trackpadLongDelay = 250;

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;
  _trackpadMachine;

  _trackpads = new Set(); // Managed trackpads
  _trackpadShortTimeouts = new Map();
  _trackpadLongTimeouts = new Map();

  constructor() {
    super();

    this._logger = new Logger(this, "test-card.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, null);
    this._resourceManager = new ResourceManager(this, import.meta.url);
    this._trackpadMachine = new StateMachine();

    this.doCard();
    this.doStyle();
    this.doAttach();
    this.doQueryElements();
    this.doListen();
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
    // this._deviceOrientationListener = this._eventManager.addDeviceOrientationListenerToContainer('test-orientation', window, this.onDeviceOrientation.bind(this));
    this._deviceMotionListener = this._eventManager.addDeviceMotionListenerToContainer('test-motion', window, this.onDeviceMotion.bind(this));
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this._eventManager.disconnectedCallback();
    // this._eventManager.removeListener(this._deviceOrientationListener);
    this._eventManager.removeListener(this._deviceMotionListener);
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  onTrackpadPointerDown(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadPointerDown(evt)", evt));
    this._trackpadMachine.activateElementNextStateFromEvent(this.constructor._TRACKPAD_TRIGGER_POINTER_DOWN, evt);
  }
  onTrackpadPointerMove(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadPointerMove(evt):", evt));
    this._trackpadMachine.activateElementNextStateFromEvent(this.constructor._TRACKPAD_TRIGGER_POINTER_MOVE, evt);
  }
  onTrackpadPointerLeave(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadPointerLeave(evt)", evt));
    this._trackpadMachine.activateElementNextStateFromEvent(this.constructor._TRACKPAD_TRIGGER_POINTER_UP, evt);
  }
  onTrackpadPointerCancel(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadPointerCancel(evt)", evt));
    this._trackpadMachine.activateElementNextStateFromEvent(this.constructor._TRACKPAD_TRIGGER_POINTER_UP, evt);
  }
  onTrackpadPointerUp(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadPointerUp(evt)", evt));
    this._trackpadMachine.activateElementNextStateFromEvent(this.constructor._TRACKPAD_TRIGGER_POINTER_UP, evt);
  }
  onTrackpadShortTimeout(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadShortTimeout(evt)", evt));
    this._trackpadMachine.activateElementNextStateFromEvent(this.constructor._TRACKPAD_TRIGGER_TIMEOUT_SHORT_EXPIRED, evt);
  }
  onTrackpadLongTimeout(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadLongTimeout(evt)", evt));
    this._trackpadMachine.activateElementNextStateFromEvent(this.constructor._TRACKPAD_TRIGGER_TIMEOUT_LONG_EXPIRED, evt);
  }

  initTrackpadMachine() {
    this._trackpadMachine.initMachine(this.constructor._TRACKPAD_MACHINE, "_mngDtTrck");
  }

  addTrackpadListeners(containerName, target, callbacks, options = null) {
    if (!target) throw new Error('Invalid target', target);

    const timeouts = {
      [this.constructor._TRACKPAD_TIMEOUT_SHORT]: {"delay": this._trackpadShortDelay, "callback": this.onTrackpadShortTimeout.bind(this)},
      [this.constructor._TRACKPAD_TIMEOUT_LONG]:  {"delay": this._trackpadLongDelay,  "callback": this.onTrackpadLongTimeout.bind(this)}
    };
    this._trackpadMachine.initElementState(target, callbacks, timeouts);

    const listeners = [];
    listeners.push(this._eventManager.addPointerDownListenerToContainer(containerName, target, this.onTrackpadPointerDown.bind(this), options));
    listeners.push(this._eventManager.addPointerMoveListenerToContainer(containerName, target, this.onTrackpadPointerMove.bind(this), options));
    listeners.push(this._eventManager.addPointerLeaveListenerToContainer(containerName, target, this.onTrackpadPointerLeave.bind(this), options));
    listeners.push(this._eventManager.addPointerCancelListenerToContainer(containerName, target, this.onTrackpadPointerCancel.bind(this), options));
    listeners.push(this._eventManager.addPointerUpListenerToContainer(containerName, target, this.onTrackpadPointerUp.bind(this), options));
    return listeners;
  }

  // jobs
  doCheckConfig() {
    // Do your checks here
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div id="cursor"></div>
      <div class="container">
        <div class="test-button">
          <div class="test-button-label">Test</div>
        </div>
      </div>
      <div class="trackpad-container">
        <div class="trackpad-area">
          <div class="trackpad">
          </div>
        </div>
      </div>
      <div class="popin" hidden>Hello from popin!</div> 
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      body {
        margin: 0;
        overflow: hidden;
        background: #111;
      }

      .container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 200px;
        height: 200px;
        background: #3a3a3a;
      }

      .trackpad-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0;
        background-color: #00000000; /* transparent black */
      }

      .trackpad-area {
        position: relative;
        width: 100%;
        height: 200px;
        border-top-left-radius: var(--card-corner-radius);
        border-top-right-radius: var(--card-corner-radius);
        border-bottom: 1px solid #0a0a0a;
        padding: 0;
        background-color: #00000000; /* transparent black */
      }
      .trackpad-area.no-buttons {
        height: 260px;
        border-bottom-left-radius: var(--card-corner-radius);
        border-bottom-right-radius: var(--card-corner-radius);
        border-bottom: none;
      }

      .trackpad {
        z-index: 1;
        width: 100%;
        height: 100%;
        border-top-left-radius: var(--card-corner-radius);
        border-top-right-radius: var(--card-corner-radius);
        cursor: crosshair;
        background: #3b3a3a;
        touch-action: none;
        transition: background 0.2s ease;
      }

      .test-button {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100px;
        height: 40px;
        background: #555;
        transition: background 0.3s ease, transform 0.1s ease;
      }

      .test-button.${this._eventManager.constructor._BUTTON_CLASS_HOVER} {
        background: #888;
      }

      .test-button.${this._eventManager.constructor._BUTTON_CLASS_PRESSED} {
        background: #BBB;
        transform: scale(0.95);
      }

      .test-button-label {
        text-align: center;
        color: white;
      }
      
      .popin {
        position: fixed;
        transform: translate(-50%, -50%);
        background: white;
        color: black;
        padding: 10px;
        border: 1px solid #ccc;
        z-index: 9999;
      }

      #cursor {
        position: fixed;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        background: red;
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
      }
    `;
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.container = card.querySelector(".container");
    this._elements.testButton = card.querySelector(".test-button");
    this._elements.popin = card.querySelector(".popin");
    this._elements.cursor = card.querySelector('#cursor');
    this._elements.trackpad = card.querySelector('.trackpad');
  }

  doListen() {
    this._eventManager.addButtonListeners("buttons", this._elements.testButton, 
      {
        [this._eventManager.constructor._BUTTON_CALLBACK_TIMEOUT_SHORT]: this.onTestButtonHover.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_TIMEOUT_LONG]: this.onTestButtonAbortHover.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_PRESS]: this.onTestButtonPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_ABORT_PRESS]: this.onTestButtonAbortPress.bind(this),
        [this._eventManager.constructor._BUTTON_CALLBACK_RELEASE]: this.onTestButtonRelease.bind(this)
      }
    );

    this.initTrackpadMachine();
    this.addTrackpadListeners("trackpad", this._elements.trackpad, 
      {
        [this.constructor._TRACKPAD_CALLBACK_TIMEOUT_SHORT]: this.onTrackpadTimeoutShort.bind(this),
        [this.constructor._TRACKPAD_CALLBACK_TIMEOUT_LONG]: this.onTrackpadTimeoutLong.bind(this),
        [this.constructor._TRACKPAD_CALLBACK_CLICK_SHORT]: this.onTrackpadClickShort.bind(this),
        [this.constructor._TRACKPAD_CALLBACK_PRESS_LONG]: this.onTrackpadPressLong.bind(this),
        [this.constructor._TRACKPAD_CALLBACK_RELEASE_LONG]: this.onTrackpadReleaseLong.bind(this),
        [this.constructor._TRACKPAD_CALLBACK_MOVE_START]: this.onTrackpadMoveStart.bind(this),
        [this.constructor._TRACKPAD_CALLBACK_MOVE]: this.onTrackpadMove.bind(this),
        [this.constructor._TRACKPAD_CALLBACK_MOVE_STOP]: this.onTrackpadMoveStop.bind(this)
      }
    );

    //this._eventManager.addPointerEnterListener(this._elements.testButton, this.onTestButtonPointerEnter.bind(this));
    //this._eventManager.addPointerLeaveListener(this._elements.testButton, this.onTestButtonPointerLeave.bind(this));
    //this._eventManager.addPointerDownListener(this._elements.testButton, this.onTestButtonPointerDown.bind(this));
    //this._eventManager.addPointerCancelListener(this._elements.testButton, this.onTestButtonPointerCancel.bind(this));
    //this._eventManager.addPointerUpListener(this._elements.testButton, this.onTestButtonPointerUp.bind(this));
    //
    //document.addEventListener('visibilitychange', this.onDocumentVisibilityChange.bind(this));
    //window.addEventListener('focus', this.onWindowFocus.bind(this));
    //window.addEventListener('blur', this.onWindowBlur.bind(this));
  }

  onTrackpadTimeoutShort(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadTimeoutShort(evt)", evt));
  }
  onTrackpadTimeoutLong(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadTimeoutLong(evt)", evt));
  }
  onTrackpadClickShort(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadClickShort(evt)", evt));
  }
  onTrackpadPressLong(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadPressLong(evt)", evt));
  }
  onTrackpadReleaseLong(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadReleaseLong(evt)", evt));
  }
  onTrackpadMoveStart(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadMoveStart(evt)", evt));
  }
  onTrackpadMove(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadMove(evt)", evt));
  }
  onTrackpadMoveStop(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onTrackpadMoveStop(evt)", evt));
  }

  _sensitivity = 2;
  _deadZone = 1.5; // degrees
  _smoothingAlpha = 0.2;

  _lastGamma = null;
  _lastBeta = null;
  _cursorX = window.innerWidth / 2;
  _cursorY = window.innerHeight / 2;

  clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  smooth(prev, curr, alpha = 0.2) {
    return alpha * curr + (1 - alpha) * prev;
  }

  onDeviceOrientation(evt) {
    const { gamma, beta } = evt;

    if (this._lastGamma !== null && this._lastBeta !== null) {
      let deltaX = gamma - this._lastGamma;
      let deltaY = beta - this._lastBeta;

      // Dead zone filtering
      if (Math.abs(deltaX) < this._deadZone) deltaX = 0;
      if (Math.abs(deltaY) < this._deadZone) deltaY = 0;

      // Apply sensitivity
      deltaX *= this._sensitivity;
      deltaY *= this._sensitivity;

      // Update cursor
      this._cursorX = this.clamp(this._cursorX + deltaX, 0, window.innerWidth);
      this._cursorY = this.clamp(this._cursorY + deltaY, 0, window.innerHeight);

      // Smooth position
      const smoothedX = this.smooth(parseFloat(this._elements.cursor.style.left || 0), this._cursorX);
      const smoothedY = this.smooth(parseFloat(this._elements.cursor.style.top || 0), this._cursorY);

      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`onDeviceOrientation(evt): x=${smoothedX}px, y=${smoothedY}px`, evt));
      this._elements.cursor.style.left = `${smoothedX}px`;
      this._elements.cursor.style.top = `${smoothedY}px`;
    }

    this._lastGamma = gamma;
    this._lastBeta = beta;
  }

  _cursorSpeed = 5.0; // from 2 to 10 (highest to slowest)
  _cursorDeadZone = 0.5; // Dead zone micromovements filter trigger

  onDeviceMotion(evt) {
    // Gyroscope equivalent: rotationRate (deg/s)
    const gx = evt.rotationRate.alpha || 0; // X-axis
    const gy = evt.rotationRate.beta || 0;  // Y-axis
    const gz = evt.rotationRate.gamma || 0; // Z-axis

    // Process gx, gy, gz
    const vx = -gz / this._cursorSpeed;
    const vy = gy / this._cursorSpeed;

    // Filter micromovements
    if (Math.abs(vx) > this._cursorDeadZone || Math.abs(vy) > this._cursorDeadZone) {
      // Simulate action (e.g., mouse move)
      const dx = vx.toFixed(1);
      const dy = vy.toFixed(1);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Move cursor by: dx=${dx}, dy=${dy}`));
    }
  }


  //let lastX = window.innerWidth / 2;
  //let lastY = window.innerHeight / 2;
  //
  //onDeviceOrientation(evt) {
  //  if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onDeviceOrientation(evt)", evt));
  //  
  //  // Get the alpha, beta, and gamma values
  //  const alpha = event.alpha; // Rotation around Z-axis (0 - 360 degrees)
  //  const beta = event.beta;   // Rotation around X-axis (-180 to 180 degrees)
  //  const gamma = event.gamma; // Rotation around Y-axis (-90 to 90 degrees)
  //  
  //  // Map the orientation values to screen coordinates
  //  // Assuming the center of the screen is the origin (lastX, lastY)
  //  
  //  const sensitivity = 10; // Control the sensitivity of mouse movement
  //  
  //  // Adjust mouse position based on device rotation (alpha, beta, gamma)
  //  let newX = lastX + (gamma * sensitivity);
  //  let newY = lastY + (beta * sensitivity);
  //  
  //  // Clamp the new positions to screen dimensions
  //  newX = Math.max(0, Math.min(window.innerWidth, newX));
  //  newY = Math.max(0, Math.min(window.innerHeight, newY));
  //  
  //  // Update last position for next movement
  //  lastX = newX;
  //  lastY = newY;
  //  
  //  // Create a mousemove event
  //  const mouseMoveEvent = new MouseEvent("mousemove", {
  //    clientX: newX,
  //    clientY: newY,
  //    bubbles: true,
  //    cancelable: true,
  //  });
  //  
  //  // Dispatch the mousemove event
  //  document.dispatchEvent(mouseMoveEvent);
  //}

  onTestButtonHover(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonHover(btn, evt)", btn, evt));
  }
  onTestButtonAbortHover(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonAbortHover(btn, evt)", btn, evt));
  }
  onTestButtonPress(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPress(btn, evt)", btn, evt));
  }
  onTestButtonAbortPress(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonAbortPress(btn, evt)", btn, evt));
  }
  onTestButtonRelease(btn, evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonRelease(btn, evt)", btn, evt));
  }

  onTestButtonPointerEnter(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerEnter(evt)", evt));
  }
  onTestButtonPointerLeave(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerLeave(evt)", evt));
  }
  onTestButtonPointerDown(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerDown(evt)", evt));
    this.triggerPopinOrPopup(evt);
  }
  onTestButtonPointerCancel(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerCancel(evt)", evt));
  }
  onTestButtonPointerUp(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onTestButtonPointerUp(evt)", evt));
  }

  onDocumentVisibilityChange(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onDocumentVisibilityChange(evt) + document.visibilityState", evt, document.visibilityState));
  }
  onWindowFocus(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onWindowFocus(evt) + document.visibilityState", evt, document.visibilityState));
  }
  onWindowBlur(evt) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("onWindowBlur(evt) + document.visibilityState", evt, document.visibilityState));
  }

  triggerPopinOrPopup(evt) {
    if (this._config?.["pop_mode"] === "popin") this.triggerPopin(evt);
    if (this._config?.["pop_mode"] === "popup") this.triggerPopup();
  }

  triggerPopin(evt) {
    // Store mouse position
    const mouseX = evt.clientX;
    const mouseY = evt.clientY;
    setTimeout(() => {
      // Show the popin after 500 milliseconds
      this._elements.popin.style.left = `${mouseX}px`;
      this._elements.popin.style.top = `${mouseY}px`;
      this._elements.popin.hidden = false;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("triggerPopinShown(evt)", evt));
      setTimeout(() => {
        // Hide the popin after 2 seconds
        this._elements.popin.hidden = true;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("triggerPopinHidden(evt)", evt));
      }, 2000);
    }, 500);
  }

  triggerPopup(evt) {
    alert("Hello from popup!");
  }

  doUpdateConfig() {
    // Nothing to do here
  }

  doUpdateHass() {
    // Nothing to do here
  }

  // configuration defaults
  static getStubConfig() {
    return {
      haptic: true,
      log_level: "warn",
      log_pushback: false
    }
  }

  getCardSize() {
    return 1;
  }
}

if (!customElements.get("test-card")) customElements.define("test-card", TestCard);