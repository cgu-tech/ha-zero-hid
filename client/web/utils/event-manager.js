import { Globals } from './globals.js';
import { Logger } from './logger.js';

// Define EventManager helper class
export class EventManager {

  // private init required constants
  static _HID_SERVER_ID = 'si';
  static _BUTTON_STATUS_MAP;

  static _BUTTON_INIT = '1';                  // "init"
  static _BUTTON_STATES = '2';                // "states"

  static _BUTTON_STATE_NORMAL = '1';          // "normal"
  static _BUTTON_STATE_HOVER = '2';           // "hover"
  static _BUTTON_STATE_PRESSED = '3';         // "pressed"

  static _BUTTON_ACTIONS = '1';               // "actions"
  static _BUTTON_NEXTS = '2';                 // "nexts"

  static _BUTTON_STATE = '1';                 // "state"
  static _BUTTON_TRIGGER = '2';               // "trigger"
  static _BUTTON_CALLBACK = '3';              // "callback"

  static _BUTTON_CALLBACK_HOVER = '1';        // "BTN_HOVER"
  static _BUTTON_CALLBACK_ABORT_HOVER = '2';  // "BTN_ABORT_HOVER"
  static _BUTTON_CALLBACK_PRESS = '3';        // "BTN_PRESS"
  static _BUTTON_CALLBACK_ABORT_PRESS = '4';  // "BTN_ABORT_PRESS"
  static _BUTTON_CALLBACK_RELEASE = '5';      // "BTN_RELEASE"

  static _BUTTON_ACTION = '1';                // "action"
  static _ACTION_CLASSLIST = '2';             // "class_list"

  static _BUTTON_CLASS_HOVER = "active";
  static _BUTTON_CLASS_PRESSED = "press";

  static _BUTTON_TRIGGER_POINTER_ENTER = '1'; // "BTN_POINTER_ENTER"
  static _BUTTON_TRIGGER_POINTER_LEAVE = '2'; // "BTN_POINTER_LEAVE"
  static _BUTTON_TRIGGER_POINTER_DOWN = '3';  // "BTN_POINTER_DOWN"
  static _BUTTON_TRIGGER_POINTER_UP = '4';    // "BTN_POINTER_UP"

  static _BUTTON_ACTION_ADD = '1';            // "add"
  static _BUTTON_ACTION_REMOVE = '2';         // "remove"


  static _POPIN_STATUS_MAP;
  
  static _POPIN_INIT = '1';
  static _POPIN_STATES = '2';

  static _POPIN_NEXTS = '1';

  static _POPIN_TRIGGER = '1';
  static _POPIN_STATE = '2';
  static _POPIN_CALLBACK = '3';

  static _POPIN_STATE_HIDDEN = '1';
  static _POPIN_STATE_SHOWN = '2';
  
  static _POPIN_TRIGGER_SHOW = '1';
  static _POPIN_TRIGGER_HIDE = '2';

  // Should be initialized in a static block to avoid JS engine to bug on static fields not-already-referenced otherwise
  static {
    this._BUTTON_STATUS_MAP = {
      [this._BUTTON_INIT]: { [this._BUTTON_STATE]: this._BUTTON_STATE_NORMAL },
      [this._BUTTON_STATES]: {
        [this._BUTTON_STATE_NORMAL]: {
          [this._BUTTON_ACTIONS]: [ 
            { [this._BUTTON_ACTION]: this._BUTTON_ACTION_REMOVE, [this._ACTION_CLASSLIST]: [this._BUTTON_CLASS_HOVER, this._BUTTON_CLASS_PRESSED] }
          ],
          [this._BUTTON_NEXTS]: [ 
            { [this._BUTTON_TRIGGER]: this._BUTTON_TRIGGER_POINTER_ENTER, [this._BUTTON_STATE]: this._BUTTON_STATE_HOVER,  [this._BUTTON_CALLBACK]: this._BUTTON_CALLBACK_HOVER }
          ]
        },
        [this._BUTTON_STATE_HOVER]: {
          [this._BUTTON_ACTIONS]: [
            { [this._BUTTON_ACTION]: this._BUTTON_ACTION_REMOVE, [this._ACTION_CLASSLIST]: [this._BUTTON_CLASS_PRESSED] },
            { [this._BUTTON_ACTION]: this._BUTTON_ACTION_ADD,    [this._ACTION_CLASSLIST]: [this._BUTTON_CLASS_HOVER] }
          ],
          [this._BUTTON_NEXTS]: [ 
            { [this._BUTTON_TRIGGER]: this._BUTTON_TRIGGER_POINTER_LEAVE, [this._BUTTON_STATE]: this._BUTTON_STATE_NORMAL,  [this._BUTTON_CALLBACK]: this._BUTTON_CALLBACK_ABORT_HOVER }, 
            { [this._BUTTON_TRIGGER]: this._BUTTON_TRIGGER_POINTER_DOWN,  [this._BUTTON_STATE]: this._BUTTON_STATE_PRESSED, [this._BUTTON_CALLBACK]: this._BUTTON_CALLBACK_PRESS }, // keyPress for 2-states button, popin/long-click/etc timeout for all buttons
          ]
        },
        [this._BUTTON_STATE_PRESSED]: {
          [this._BUTTON_ACTIONS]: [
            { [this._BUTTON_ACTION]: this._BUTTON_ACTION_ADD,    [this._ACTION_CLASSLIST]: [this._BUTTON_CLASS_PRESSED] }
          ],
          [this._BUTTON_NEXTS]: [ 
            { [this._BUTTON_TRIGGER]: this._BUTTON_TRIGGER_POINTER_LEAVE, [this._BUTTON_STATE]: this._BUTTON_STATE_NORMAL, [this._BUTTON_CALLBACK]: this._BUTTON_CALLBACK_ABORT_PRESS }, // onAbort for 2-states button
            { [this._BUTTON_TRIGGER]: this._BUTTON_TRIGGER_POINTER_UP,    [this._BUTTON_STATE]: this._BUTTON_STATE_HOVER,  [this._BUTTON_CALLBACK]: this._BUTTON_CALLBACK_RELEASE }, // keyRelease for 2-states button, key click for 1-state button
          ]
        }
      }
    };
    this._POPIN_STATUS_MAP = {
      [this._POPIN_INIT]: { [this._POPIN_STATE]: this._POPIN_STATE_HIDDEN },
      [this._POPIN_STATES]: {
        [this._POPIN_STATE_HIDDEN]: {
          [this._POPIN_NEXTS]: [ 
            { [this._POPIN_TRIGGER]: this._POPIN_TRIGGER_SHOW, [this._POPIN_STATE]: this._POPIN_STATE_SHOWN,  [this._POPIN_CALLBACK]: this._POPIN_CALLBACK_SHOW }
          ]
        },
        [this._POPIN_STATE_SHOWN]: {
          [this._POPIN_NEXTS]: [ 
            { [this._POPIN_TRIGGER]: this._POPIN_TRIGGER_HIDE, [this._POPIN_STATE]: this._POPIN_STATE_HIDDEN,  [this._POPIN_CALLBACK]: this._POPIN_CALLBACK_HIDE }, 
          ]
        }
      }
    };
  }

  // Constants
  _listenerKeys = ['target', 'callback', 'options', 'eventName', 'managedCallback'];
  _defaultContainerName = 'default';
  _globalContainerName = '__window';
  
  _origin;
  _eventsMap = new Map();
  _reversedEventsMap = new Map();
  _preferedEventsNames = new Map(); // Cache for prefered discovered listeners (lookup speedup)
  _containers = new Map(); // Registrered listeners for cleanup
  _globalListeners = new Map(); // Callback with global scopes (document, window) for buttons management
  _buttons = new Set(); // Managed buttons
  _popins = new Set(); // Managed popins
  _servers = []; // Available HID servers
  _currentServer = -1; // Current selected server
  _areServersLoading = false; // Available servers loading in progress lock
  _areServersLoaded = false; // Available servers loaded once lock
  _isManaged = false; // indicates whether or not this event manager origin card is managed by another card (and transitively whether or not some events managements should be delegated to the manager card of the origin card)

  constructor(origin) {
    this._origin = origin;

    // Mapping for "managed" event names with their "real" event names counterparts 
    // that might be supported by device - or not (by preference order)
    this._eventsMap.set("EVT_BLUR",              ["blur"]);
    this._eventsMap.set("EVT_ERROR",             ["error"]);
    this._eventsMap.set("EVT_LOAD",              ["load"]);
    this._eventsMap.set("EVT_POINTER_CANCEL",    ["pointercancel", "touchcancel"]);
    this._eventsMap.set("EVT_POINTER_CLICK",     ["click"]);
    this._eventsMap.set("EVT_POINTER_CTXMENU",   ["contextmenu"]);
    this._eventsMap.set("EVT_POINTER_DBLCLICK",  ["dblclick"]);
    this._eventsMap.set("EVT_POINTER_DOWN",      ["pointerdown", "touchstart", "mousedown"]);
    this._eventsMap.set("EVT_POINTER_ENTER",     ["pointerenter", "mouseenter"]);
    this._eventsMap.set("EVT_POINTER_LEAVE",     ["pointerleave", "mouseleave"]);
    this._eventsMap.set("EVT_POINTER_MOVE",      ["pointermove", "touchmove", "mousemove"]);
    this._eventsMap.set("EVT_POINTER_OUT",       ["pointerout", "mouseout"]);
    this._eventsMap.set("EVT_POINTER_OVER",      ["pointerover", "mouseover"]);
    this._eventsMap.set("EVT_POINTER_UP",        ["pointerup", "touchend", "mouseup"]);
    this._eventsMap.set("EVT_VISIBILITY_CHANGE", ["visibilitychange"]);
    

    // Reversed mapping for each "real" event names with its "managed" event name counterpart
    // ex: "pointerdown" --> "EVT_POINTER_DOWN"
    for (const [managedEventName, eventNames] of this._eventsMap.entries()) {
      for (const eventName of eventNames) {
        this._reversedEventsMap.set(eventName, managedEventName);
      }
    }
  }

  getLogger() {
    return this._origin?._logger;
  }

  getHass() {
    return this._origin?._hass;
  }

  setManaged(managed) {
    this._isManaged = managed;
  }

  isManaged() {
    return this._isManaged;
  }

  getServerId(server) {
    return server?.["id"];
  }

  getServerName(server) {
    return server?.["name"];
  }

  setCurrentServer(server) {
    if (!this._areServersLoaded) return false;

    const serverId = this.getServerId(server);
    const indexes = this._servers ? this._servers.length : 0;
    for (let index = 0; index < indexes; index++) {
      if (this.getServerId(this._servers[index]) === serverId) {
        this._currentServer = index;
        return true;
      }
    }
    return false;
  }

  getCurrentServer() {
    return this._areServersLoaded ? this._servers[this._currentServer] : null;
  }

  getCurrentServerId() {
    return this.getServerId(this.getCurrentServer());
  }

  getCurrentServerName() {
    return this.getServerName(this.getCurrentServer());
  }

  activateNextServer() {
    if (!this._areServersLoaded) return null;

    this._currentServer = 
      (this._currentServer < this._servers.length - 1)
        ? this._currentServer + 1
        : 0;

    return this._servers[this._currentServer];
  }

  // Get elapsed time between a start event and an end event (in milliseconds)
  getElapsedTime(evtStart, evtEnd) {
    return evtEnd.timeStamp - evtStart.timeStamp;
  }

  addButtonListeners(containerName, target, callbacks, options = null) {
    if (!target) throw new Error('Invalid target', target);

    this.initButtonState(target, callbacks);

    const listeners = [];
    listeners.push(this.addPointerEnterListenerToContainer(containerName, target, this.onButtonPointerEnter.bind(this), options));
    listeners.push(this.addPointerLeaveListenerToContainer(containerName, target, this.onButtonPointerLeave.bind(this), options));
    listeners.push(this.addPointerCancelListenerToContainer(containerName, target, this.onButtonPointerCancel.bind(this), options));
    listeners.push(this.addPointerDownListenerToContainer(containerName, target, this.onButtonPointerDown.bind(this), options));
    listeners.push(this.addPointerUpListenerToContainer(containerName, target, this.onButtonPointerUp.bind(this), options));
    return listeners;
  }

  addPopinListeners(containerName, target, callbacks, options = null) {
    if (!target) throw new Error('Invalid target', target);

    this.initPopinState(target, callbacks);
    return [];
  }

  addGlobalListeners() {
    if (this._buttons && this._globalListeners.size === 0) {
      this._globalListeners.set("windowPointerUp", this.addPointerUpListenerToContainer(this._globalContainerName, window, this.onGlobalWindowPointerUp.bind(this)));
      this._globalListeners.set("windowBlur", this.addBlurListenerToContainer(this._globalContainerName, window, this.onGlobalWindowBlur.bind(this)));
      this._globalListeners.set("documentVisibilityChange", this.addVisibilityChangeListenerToContainer(this._globalContainerName, document, this.onGlobalDocumentVisibilityChange.bind(this)));
    }
  }

  removeGlobalListeners() {
    if (this._globalListeners) {
      this.removeListener(this._globalListeners.get("windowPointerUp"));
      this.removeListener(this._globalListeners.get("windowBlur"));
      this.removeListener(this._globalListeners.get("documentVisibilityChange"));
      this._globalListeners.clear();
    }
  }

  hassCallback(onServersInitSucess, onServersInitError) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("hassCallback(onServersInitSucess, onServersInitError)", onServersInitSucess, onServersInitError));
    this.getServers(onServersInitSucess, onServersInitError);
  }

  connectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("connectedCallback()"));
    this.addGlobalListeners();
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this.removeGlobalListeners();
  }

  onGlobalWindowPointerUp(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onGlobalWindowPointerUp(evt) + isConnected", evt, this._origin?.isConnected));
    
    if (document.visibilityState === "hidden") {
      this.leaveAllButtons(evt);
      this.hideAllPopins(evt);
    } else {
      const target = this.getKnownTargetOrDefault(evt, this._buttons, this._popins);
      this.leaveAllButtonsExceptTarget(target, evt);
      this.hideAllPopinsExceptTarget(target, evt);
    }
  }
  
  onGlobalWindowBlur(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onGlobalWindowBlur(evt) + isConnected", evt, this._origin?.isConnected));
    this.leaveAllButtons(evt);
    this.hideAllPopins(evt);
  }
  
  onGlobalDocumentVisibilityChange(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onGlobalDocumentVisibilityChange(evt) + isConnected", evt, this._origin?.isConnected));
    if (document.visibilityState === "hidden") {
      this.leaveAllButtons(evt);
      this.hideAllPopins(evt);
    }
  }
  
  leaveAllButtons(evt) {
    for (const btn of this._buttons) {
      this.activateButtonNextState(btn, this.constructor._BUTTON_TRIGGER_POINTER_LEAVE, evt);
    }
  }

  hideAllPopins(evt) {
    for (const pop of this._popins) {
      this.activatePopinNextState(pop, this.constructor._POPIN_TRIGGER_HIDE, evt);
    }
  }

  leaveAllButtonsExceptTarget(target, evt) {
    for (const btn of this._buttons) {
      if (btn !== target) this.activateButtonNextState(btn, this.constructor._BUTTON_TRIGGER_POINTER_LEAVE, evt);
    }
  }

  hideAllPopinsExceptTarget(target, evt) {
    for (const pop of this._popins) {
      if (pop !== target) this.activatePopinNextState(pop, this.constructor._POPIN_TRIGGER_HIDE, evt);
    }
  }

  onButtonPointerEnter(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onButtonPointerEnter(evt)", evt));
    this.activateButtonNextStateFromEvent(this.constructor._BUTTON_TRIGGER_POINTER_ENTER, evt);
  }
  onButtonPointerLeave(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onButtonPointerLeave(evt)", evt));
    this.activateButtonNextStateFromEvent(this.constructor._BUTTON_TRIGGER_POINTER_LEAVE, evt);
  }
  onButtonPointerCancel(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onButtonPointerCancel(evt)", evt));
    this.activateButtonNextStateFromEvent(this.constructor._BUTTON_TRIGGER_POINTER_LEAVE, evt);
  }
  onButtonPointerDown(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onButtonPointerDown(evt)", evt));
    this.activateButtonNextStateFromEvent(this.constructor._BUTTON_TRIGGER_POINTER_DOWN, evt);
  }
  onButtonPointerUp(evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("onButtonPointerUp(evt)", evt));
    this.activateButtonNextStateFromEvent(this.constructor._BUTTON_TRIGGER_POINTER_UP, evt);
  }

  setButtonData(btn, data) {
    if (btn) btn._mngDt = data;
  }

  getButtonData(btn) {
    return btn?._mngDt;
  }

  setButtonState(btn, state) {
    if (btn) this.getButtonData(btn).state = state;
  }
  
  getButtonState(btn) {
    return this.getButtonData(btn)?.state;
  }

  setButtonCallbacks(btn, callbacks) {
    if (btn) this.getButtonData(btn).callbacks = callbacks;
  }

  getButtonCallbacks(btn) {
    return this.getButtonData(btn)?.callbacks;
  }

  initButtonState(btn, callbacks) {
    this.setButtonData(btn, {});
    this.setButtonState(btn, this.constructor._BUTTON_STATUS_MAP[this.constructor._BUTTON_INIT][this.constructor._BUTTON_STATE]);
    this.setButtonCallbacks(btn, callbacks);
    this._buttons.add(btn);
  }


  getButtonCurrentState(btn) {
    return this.constructor._BUTTON_STATUS_MAP[this.constructor._BUTTON_STATES][this.getButtonState(btn)];
  }

  getButtonCurrentActions(btn) {
    return this.getButtonCurrentState(btn)?.[this.constructor._BUTTON_ACTIONS];
  }

  getButtonNextState(btn, trigger) {
    return this.getButtonCurrentState(btn)?.[this.constructor._BUTTON_NEXTS].find(next => next[this.constructor._BUTTON_TRIGGER] === trigger);
  }

  activateButtonNextStateFromEvent(trigger, evt) {
    return this.activateButtonNextState(evt.currentTarget, trigger, evt);
  }

  activateButtonNextState(btn, trigger, evt) {
    if (btn) {
      const nextState = this.getButtonNextState(btn, trigger);
      if (nextState) {

        // Change button to next state
        this.setButtonState(btn, nextState[this.constructor._BUTTON_STATE]);

        // Update button classes
        for (const action of (this.getButtonCurrentActions(btn) ?? [])) {
          const actionName = action[this.constructor._BUTTON_ACTION];
          const actionClassList = action[this.constructor._ACTION_CLASSLIST];
          if (actionName === this.constructor._BUTTON_ACTION_ADD) btn.classList.add(...actionClassList);
          if (actionName === this.constructor._BUTTON_ACTION_REMOVE) btn.classList.remove(...actionClassList);
        }

        // Execute associated callback (when present)
        const callback = this.getButtonCallbacks(btn)?.[nextState[this.constructor._BUTTON_CALLBACK]];
        if (callback) callback(btn, evt);
      }
      return !!nextState;
    }
    return false;
  }

  setPopinData(pop, data) {
    if (pop) pop._mngPopDt = data;
  }

  getPopinData(pop) {
    return pop?._mngPopDt;
  }

  setPopinState(pop, state) {
    if (pop) this.getPopinData(pop).state = state;
  }
  
  getPopinState(pop) {
    return this.getPopinData(pop)?.state;
  }

  setPopinCallbacks(pop, callbacks) {
    if (pop) this.getPopinData(pop).callbacks = callbacks;
  }

  getPopinCallbacks(pop) {
    return this.getPopinData(pop)?.callbacks;
  }

  initPopinState(pop, callbacks) {
    this.setPopinData(pop, {});
    this.setPopinState(pop, this.constructor._POPIN_STATUS_MAP[this.constructor._POPIN_INIT][this.constructor._POPIN_STATE]);
    this.setPopinCallbacks(pop, callbacks);
    this._popins.add(pop);
  }

  getPopinCurrentState(pop) {
    return this.constructor._POPIN_STATUS_MAP[this.constructor._POPIN_STATES][this.getPopinState(pop)];
  }

  getPopinCurrentActions(pop) {
    return this.getPopinCurrentState(pop)?.[this.constructor._POPIN_ACTIONS];
  }

  getPopinNextState(pop, trigger) {
    return this.getPopinCurrentState(pop)?.[this.constructor._POPIN_NEXTS].find(next => next[this.constructor._POPIN_TRIGGER] === trigger);
  }

  activatePopinNextState(pop, trigger, evt) {
    if (pop) {
      const nextState = this.getPopinNextState(pop, trigger);
      if (nextState) {

        // Change popin to next state
        this.setPopinState(pop, nextState[this.constructor._POPIN_STATE]);

        // Execute associated callback (when present)
        const callback = this.getPopinCallbacks(pop)?.[nextState[this.constructor._POPIN_CALLBACK]];
        if (callback) callback(pop, evt);
      }
      return !!nextState;
    }
    return false;
  }

  activatePopinShow(pop, evt) {
    return this.activatePopinNextState(pop, this.constructor._POPIN_TRIGGER_SHOW, evt);
  }
  
  activatePopinHide(pop, evt) {
    return this.activatePopinNextState(pop, this.constructor._POPIN_TRIGGER_HIDE, evt);
  }

  preventDefault(evt) {
    if (typeof evt?.preventDefault === 'function') evt.preventDefault();
  }

  getTypedButtonOverrideConfig(overrideConfig, overrideMode, overrideType) {
    return overrideConfig?.[overrideMode]?.[overrideType];
  }

  executeButtonOverride(btn, overrideConfig) {
    return this.executeTypedButtonOverride(btn, overrideConfig, 'normal_mode', 'short_press');
  }

  executeTypedButtonOverride(btn, overrideConfig, overrideMode, overrideType) {
    if (!this.getHass()) {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`executeButtonOverride(btn, overrideConfig): undefined hass. Unable to execute the override action (called too early before HA hass init or HA unresponsive)`, btn, overrideConfig));
      return;
    }

    // Retrieve override typed config
    const overrideTypedConfig = this.getTypedButtonOverrideConfig(overrideConfig, overrideMode, overrideType);
    if (!overrideTypedConfig) {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`executeButtonOverride(btn, overrideConfig): undefined typed button override. Unable to execute the override action.`, btn, overrideConfig));
      return;
    }
    // Override typed config available

    // When sensor detected in override config, 
    // choose override action to execute according to current sensor state (on/off)
    let overrideAction;
    if (overrideTypedConfig['sensor']) {
      if (btn?._sensorState?.toLowerCase() === 'on') {
        overrideAction = overrideTypedConfig['action_when_on'];
      } else {
        overrideAction = overrideTypedConfig['action_when_off'];
      }
    } else {
      // Otherwise, retrieve the only action to execute
      overrideAction = overrideTypedConfig['action'];
    }

    // Execute selected override action
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Executing override action on ${btn.id}:`, overrideAction));
    this.triggerHaosTapAction(btn, overrideAction);
  }

  setServers(servers) {

    // Ensure not loaded
    if (!this._areServersLoaded) {

      // Check responded servers
      if (!servers || !Array.isArray(servers) || servers.length < 1) {

        // Invalid servers
        if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error('Empty or invalid servers list:', servers));
        return false;
      }

      // Valid servers: store retrieved servers
      for (const server of (servers ?? [])) {
        this._servers.push(server);
      }

      // Update loaded lock
      this._areServersLoaded = true;

      // Setup first server as current server
      const firstServer = this.activateNextServer();
      if (this.getLogger().isInfoEnabled()) console.info(...this.getLogger().info('Valid servers list set, will use first server:', servers, firstServer));
      return true;
    } else {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('Servers list already set (won\'t set):', servers));
      return false;
    }
  }

  // Retrieves authorized list of HID servers asynchronously. 
  // After a call to this function, use "areServersLoaded()" to ensure async call finished.
  // 
  // Returns: 
  //  A promyze :
  //   - on command success: ".then((response) => {...})"
  //   - on command error: ".catch((err) => {...})"
  getServers(onServersInitSucess, onServersInitError) {

    // Servers already successfully loaded
    if (this._areServersLoaded) {
      if (onServersInitSucess) onServersInitSucess();
      return;
    }

    // Command to send to HA backend to get servers list
    const serversListCommand = 'list_servers';

    // Ensure not managed
    if (this.isManaged()) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Event manager origin is managed (wont try to call '${serversListCommand}' HA command)`));
      if (onServersInitError) onServersInitError();
    }

    // Ensure servers not loading
    if (this._areServersLoading) {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`Servers already loading (wont try to call '${serversListCommand}' HA command)`));
      if (onServersInitError) onServersInitError();
    }

    // Ensure HASS object initialized
    if (!this.getHass()) {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`HASS object not initialized (wont try to call '${serversListCommand}' HA command)`));
      if (onServersInitError) onServersInitError();
    }

    // Update loading lock (start)
    this._areServersLoading = true;

    // Start loading servers list asynchronously
    this.callComponentCommand(serversListCommand)?.then((response) => {

      // Retrieve responded servers
      const { servers } = response;

      // Define servers and call backs
      if (this.setServers(servers)) {

        // Update loading lock (end) + execute callback (success)
        this._areServersLoading = false;
        if (onServersInitSucess) onServersInitSucess();

      } else {

        // Update loading lock (end) + execute callback (fail logically)
        this._areServersLoading = false;
        if (onServersInitError) onServersInitError();
      }

    })
    .catch((err) => {
      // Error while trying to communicate with HA
      if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`Error while calling '${serversListCommand}' HA command:`, err));

      // Update loading lock (end) + execute callback (fail technically)
      this._areServersLoading = false;
      if (onServersInitError) onServersInitError();
    });
  }

  // Injects current server id into args["si"] (inject null into the field when not available)
  injectServerId(args) {
    let argsWithServerId = args;
    if (args)
      args[EventManager._HID_SERVER_ID] = this.getCurrentServerId();
    else
      argsWithServerId = { [EventManager._HID_SERVER_ID]: this.getCurrentServerId() };
    return argsWithServerId;
  }

  // Call a service from HAOS custom component 'Globals.COMPONENT_NAME' using WebSockets. 
  // Current HID server id is injected before aalling the service.
  // 
  // Parameters:
  //  - name: the service name to fire (registered into custom component 'Globals.COMPONENT_NAME' Python code)
  // 
  // Returns: 
  //  - void (this is a fire-and-forget HAOS integration call)
  callComponentServiceWithServerId(name, args) {
    this.callComponentService(name, this.injectServerId(args));
  }

  // Call a service from HAOS custom component 'Globals.COMPONENT_NAME' using WebSockets.
  // 
  // Parameters:
  //  - name: the service name to fire (registered into custom component 'Globals.COMPONENT_NAME' Python code)
  // 
  // Returns: 
  //  - void (this is a fire-and-forget HAOS integration call)
  callComponentService(name, args) {
    this.callService(Globals.COMPONENT_NAME, name, args);
  }
  
  // Call a service from HAOS custom component 'Globals.COMPONENT_NAME' using WebSockets.
  // 
  // Parameters:
  //  - domain: the domain where service belongs to (ex: switch, light, ha-zero-hid)
  //  - name: the service name to fire (registered into custom component 'Globals.COMPONENT_NAME' Python code)
  // 
  // Returns: 
  //  - void (this is a fire-and-forget HAOS integration call)
  callService(domain, name, args) {
    if (!this.getHass()) {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`callService(domain, name, args): undefined hass. Unable to execute the service (called too early before HA hass init or HA unresponsive)`, domain, name, args));
      return;
    }
    this.getHass().callService(domain, name, args);
  }

  // Call a command from HAOS custom component 'Globals.COMPONENT_NAME' using WebSockets.
  // Current HID server id is injected before aalling the service.
  // 
  // Parameters:
  //  - name: the command name to fire (registered into custom component 'Globals.COMPONENT_NAME' Python code)
  // 
  // Returns:
  //  A promyze :
  //   - on command success: ".then((response) => {...})"
  //   - on command error: ".catch((err) => {...})"
  callComponentCommandWithServerId(name, args) {
    this.callComponentCommand(name, this.injectServerId(args));
  }

  // Call a command from HAOS custom component 'Globals.COMPONENT_NAME' using WebSockets.
  // 
  // Parameters:
  //  - name: the command name to fire (registered into custom component 'Globals.COMPONENT_NAME' Python code)
  // 
  // Returns:
  //  A promyze :
  //   - on command success: ".then((response) => {...})"
  //   - on command error: ".catch((err) => {...})"
  callComponentCommand(name, args) {
    return this.callCommand(Globals.COMPONENT_NAME, name, args);
  }

  // Call a command from HAOS custom component 'Globals.COMPONENT_NAME' using WebSockets.
  // 
  // Parameters:
  //  - name: the command name to fire (registered into custom component 'Globals.COMPONENT_NAME' Python code)
  // 
  // Returns:
  //  A promyze :
  //   - on command success: ".then((response) => {...})"
  //   - on command error: ".catch((err) => {...})"
  callCommand(domain, name, args) {
    if (!this.getHass()) {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`callCommand(name): undefined hass. Unable to execute the command (called too early before HA hass init or HA unresponsive)`, name));
      return null;
    }
    const msg = {};
    msg["type"] = `${domain}/${name}`;
    if (args) Object.assign(msg, args);
    return this.getHass().connection.sendMessagePromise(msg);
  }

  // Trigger an event into HAOS.
  // This is typically used to make HAOS trigger an action in reaction to the dispatched event.
  // 
  // Parameters:
  //  - target: the HTML element that originated the event (might be any HTML element from the front js)
  //  - type: the event type (knwon types: "hass-action")
  //  - detail: the event configuration (knwon configurations: { config: <ui_action_object_retrieved_from_yaml_config>, action: "tap", })
  //  - options: optional object for options (known options: do not specify)
  triggerHaosEvent(target, type, detail, options = {}) {
    if (!this.getHass()) {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`triggerHaosEvent(target, type, detail, options = {}): undefined hass. Unable to execute the HAOS event (called too early before HA hass init or HA unresponsive)`, target, type, detail, options));
      return;
    }
    const event = new CustomEvent(type, {
      bubbles: options.bubbles ?? true,
      cancelable: Boolean(options.cancelable),
      composed: options.composed ?? true,
      detail,
    });
    target.dispatchEvent(event);
  }

  // Trigger a tap action into HAOS, target
  // This is typically used to make HAOS trigger an action in reaction to the dispatched event.
  // 
  // Parameters:
  //  - target: the HTML element that originated the event (might be any HTML element from the front js)
  //  - actionConfig: the <config> section for the tap action to trigger
  triggerHaosTapAction(target, actionConfig) {
    this.triggerHaosEvent(target, "hass-action", {
      config: actionConfig,
      action: "tap",
    });
  }

  // Trigger a tap action into HAOS, target
  // This is typically used to make HAOS trigger an action in reaction to the dispatched event.
  // 
  // Parameters:
  //  - target: the HTML element that originated the event (might be any HTML element from the front js)
  //  - actionConfig: the <config> section for the tap action to trigger
  triggerHaosMoreInfoAction(target, entityId) {
    this.triggerHaosEvent(target, "hass-more-info", {
      "entityId": entityId 
    },
    {
      "bubbles": true,
      "composed": true,
    });
  }

  addBlurListener(target, callback, options = null) { return this.addBlurListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addErrorListener(target, callback, options = null) { return this.addErrorListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addLoadListener(target, callback, options = null) { return this.addLoadListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerCancelListener(target, callback, options = null) { return this.addPointerCancelListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerClickListener(target, callback, options = null) { return this.addPointerClickListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerContextmenuListener(target, callback, options = null) { return this.addPointerContextmenuListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerDblClickListener(target, callback, options = null) { return this.addPointerDblClickListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerDownListener(target, callback, options = null) { return this.addPointerDownListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerEnterListener(target, callback, options = null) { return this.addPointerEnterListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerLeaveListener(target, callback, options = null) { return this.addPointerLeaveListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerMoveListener(target, callback, options = null) { return this.addPointerMoveListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerOutListener(target, callback, options = null) { return this.addPointerOutListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerOverListener(target, callback, options = null) { return this.addPointerOverListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerUpListener(target, callback, options = null) { return this.addPointerUpListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addVisibilityChangeListener(target, callback, options = null) { return this.addVisibilityChangeListenerToContainer(this._defaultContainerName, target, callback, options ); }


  addBlurListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_BLUR" ); }
  addErrorListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_ERROR" ); }
  addLoadListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_LOAD" ); }
  addPointerCancelListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_CANCEL" ); }
  addPointerClickListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_CLICK" ); }
  addPointerContextmenuListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_CTXMENU" ); }
  addPointerDblClickListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_DBLCLICK" ); }
  addPointerDownListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_DOWN" ); }
  addPointerEnterListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_ENTER" ); }
  addPointerLeaveListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_LEAVE" ); }
  addPointerMoveListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_MOVE" ); }
  addPointerOutListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_OUT" ); }
  addPointerOverListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_OVER" ); }
  addPointerUpListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_UP" ); }
  addVisibilityChangeListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_VISIBILITY_CHANGE" ); }

  // Add the available event listener using 
  // - supported event first (when available) 
  // - then falling back to legacy event (when available)
  addAvailableEventListener(containerName, target, callback, options, managedEventName) {
    const eventName = this.getSupportedEventListener(target, managedEventName);
    if (eventName) {
      return this.addGivenEventListener(containerName, target, callback, options, eventName);
    }
    return null;
  }

  // Add the specified event listener
  addGivenEventListener(containerName, target, callback, options, eventName) {
    const managedCallback = this.onManagedCallback.bind(this, target, callback);
    const listener = this.registerListener(this.createListener(target, callback, options, eventName, managedCallback), containerName);
    
    if (this.isTargetListenable(target)) {
      if (options) {
        if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Adding event listener ${eventName} on target with options:`, target, options));
        target.addEventListener(eventName, managedCallback, options);
      } else {
        if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Adding event listener ${eventName} on target:`, target));
        target.addEventListener(eventName, managedCallback);
      }
    }
    return listener;
  }

  createListener(target, callback, options, eventName, managedCallback) {
    return { "target": target, "callback": callback, "options": options, "eventName": eventName, "managedCallback": managedCallback };
  }

  // Bind a listener to its specified container
  registerListener(listener, containerName) {
    if (this.isValidListener(listener)) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("registerListener(listener, containerName)", listener, containerName));
      
      // Ensure default container name as fallback
      const safeContainerName = containerName || this._defaultContainerName;
      if (containerName !== safeContainerName) if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("registerListener(listener, containerName): using default container", listener, containerName, safeContainerName));
      
      // Retrieve listener container
      let container = this._containers.get(safeContainerName);
      
      // Init listeners container for the specified id
      if (!container) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("registerListener(listener, containerName): first registration of containerName", listener, safeContainerName));
        container = new Set();
        this._containers.set(safeContainerName, container);
      }

      // Register container name into the listener
      listener["containerName"] = safeContainerName;

      // Add listener into the container
      container.add(listener);
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("registerListener(listener, containerName): listener successfully registered", listener, safeContainerName));
    }
    // Usefull for chaining
    return listener;
  }

  // Manages events callbacks (for example to handle erratic touch devices events)
  onManagedCallback(target, callback, evt) {
    if (evt?.pointerType === 'touch') {
      if (!this.onManagedTouchCallback(target, callback, evt)) return; // Do not delegate to unmanaged callback
    }
    // delegate to unmanaged callback
    callback(evt);
  }

  onManagedTouchCallback(target, callback, evt) {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug('onManagedTouchCallback(target, callback, evt):', target, callback, evt));

    // Decides whether or not to delegate according to managedEventName
    if (this.isBoundToManagedEvent(evt, "EVT_POINTER_MOVE") && this.isPointerCapturedByTarget(evt, target) && !this.isPointerHoveringTarget(evt, target)) {
      if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Managed EVT_POINTER_MOVE (real: ${evt.type}): releasing pointer capture and suppressing real event (cause: event target captures a pointer hovering another target)`));
      this.releasePointerFromTarget(evt, target);
      return false; // Prevent delegation to unmanaged callback
    }
    return true;
  }

  isBoundToManagedEvent(evt, managedEventName) {
    return this._reversedEventsMap.get(evt.type) === managedEventName;
  }
  
  isPointerEvent(evt) {
    return !!evt.pointerId;
  }

  isPointerCapturedByTarget(evt, target) {
    return this.isPointerEvent(evt) && target.hasPointerCapture(evt.pointerId);
  }

  releasePointerFromTarget(evt, target) {
    target.releasePointerCapture(evt.pointerId);
  }

  getTargetHoveredByPointer(evt) {
    return document.elementFromPoint(evt.clientX, evt.clientY);
  }

  //getTargetHoveredByPointerThroughShadow(evt) {
  //  return evt?.composedPath()?.[0]; // the most deeply nested element actually interacted with
  //}

  getKnownTargetOrDefault(evt, ...targetsSets) {
    const composedPath = evt?.composedPath?.();
    if (!composedPath) return null;
    
    for (const targets of targetsSets) {
      const match = this.getKnownTarget(composedPath, targets);
      if (match) return match;
    }
    
    // Fallback: return the topmost element from the composed path
    return composedPath[0];
  }

  getKnownTarget(composedPath, targets) {
    return composedPath?.find(target => targets.has(target));
  }

  isPointerHoveringTarget(evt, target) {
    return this.getTargetHoveredByPointer(evt) === target;
  }

  isValidListener(obj) {
    // Falsy or not an object {} -> not a valid listener
    if (!Object.prototype.toString.call(obj) === '[object Object]') return false;

    // Check object contains at least all listener keys
    const objKeys = new Set(Object.keys(obj));;
    return this._listenerKeys.every(listenerKey => objKeys.has(listenerKey));
  }

  removeListener(listener) {
    if (this.isValidListener(listener)) {
      const target = listener["target"];
      const eventName = listener["eventName"];
      const managedCallback = listener["managedCallback"];
      const options = listener["options"];
      
      if (this.isTargetListenable(target)) {
        if (options) {
          if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Removing event listener ${eventName} on target with options:`, target, options));
          target.removeEventListener(eventName, managedCallback, options);
        } else {
          if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Removing event listener ${eventName} on target:`, target));
          target.removeEventListener(eventName, managedCallback);
        }
      }
      return this.destroyListener(this.unregisterListener(listener));
    }
    return listener;
  }

  // Unbind a listener to its specified container
  unregisterListener(listener) {
    if (this.isValidListener(listener)) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("unregisterListener(listener)", listener));
      const target = listener["target"];
      
      // Remove listener target from popins (when present)
      this._popins.delete(target);
      
      // Remove listener target from buttons (when present)
      this._buttons.delete(target);
            
      // Retrieve listener container name
      let containerName = listener["containerName"];
      
      // Listener does not have container name: not registered
      if (!containerName) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("unregisterListener(listener): listener does not have registered container name (unregistered)", listener));
        return listener;
      }
      
      // Unregister from the container
      const container = this._containers.get(containerName);
      
      // Missing container
      if (!container) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("unregisterListener(listener): listener does have a registered container, but container is absent (unregistered)", listener, containerName));
        return listener;
      }
      
      // Existing container: remove from container
      container.delete(listener);
      
      // Destroy container name reference inside listener to prevent further unregistration
      listener["containerName"] = null;
      
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("unregisterListener(listener): listener successfully unregistered from container", listener, containerName));
    }
    // Usefull for chaining
    return listener;
  }

  destroyListener(listener) {
    if (this.isValidListener(listener)) {

      // Destroy references inside listener to allow GC
      listener["target"] = null;
      listener["callback"] = null;
      listener["options"] = null;
      listener["eventName"] = null;
      listener["managedCallback"] = null;
      
      // Conditionnaly destroy option references inside listener to allow GC
      if (listener["containerName"]) listener["containerName"] = null;
    }
    return listener;
  }

  // Clears all registered listeners
  clearAllListeners() {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`clearAllListeners(): clearing ${this._containers.length} containers`));
    for (const [containerName, container] of this._containers.entries()) {
      this.clearListeners(containerName);
    }
  }

  // Clears all registered listeners bound to specified listenersContainerId
  clearListeners(containerName) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("clearListeners(containerName)", containerName));
    const container = this._containers.get(containerName);

    if (!container) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("clearListeners(containerName): no listeners found for container name (all clear)", containerName));
      return;
    }

    // Remove all listeners inside the container
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`clearListeners(containerName): removing ${container.length} listener(s) bound to container name`, containerName));
    for (const listener of container) {
      this.removeListener(listener);
    }

    // Clear the container from listeners references
    container.clear();

    // Remove the container from listeners containers
    this._containers.delete(containerName);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("clearListeners(containerName): listeners cleared from container with name", containerName));
  }

  // Checks whether or not target is listenable
  isTargetListenable(target) {
    if (!target || typeof target.addEventListener !== 'function') {
      if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn(`Invalid target ${target} element provided to isTargetListenable`));
      return false;
    }
    return true;
  }

  // Gets the available event listener using 
  // - supported event first (when available) 
  // - then falling back to legacy event (when available)
  getSupportedEventListener(target, managedEventName) {
    if (!managedEventName) {
      if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`Invalid managedEventName ${managedEventName}: expected a non-empty string`));
      return null;
    }

    // Given managedEventName, then try to retrieve previously cached prefered concrete js event
    const preferedEventName = this._preferedEventsNames.get(managedEventName);
    if (preferedEventName) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cache HIT for event ${managedEventName}: found cached prefered event ${preferedEventName}`));
      return preferedEventName;
    }
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cache MISS for event ${managedEventName}: no supported prefered event cached`));

    // When no prefered concrete js event, then try to retrieve mapped events
    const mappedEvents = this._eventsMap.get(managedEventName);
    if (!mappedEvents) {
      if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`Unknwon managedEventName ${managedEventName}`));
      return null;
    }

    // Check for supported event into all mapped events
    for (const mappedEvent of mappedEvents) {
      if (this.isEventSupported(target, mappedEvent)) {

        // First supported event found: cache-it as prefered concrete js event
        this._preferedEventsNames.set(managedEventName, mappedEvent);

        // Return prefered concrete js event
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cache UPDATE for event ${managedEventName}: set to prefered event ${mappedEvent}`));
        return mappedEvent;
      }
    }

    if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`No concrete js event supported for ${managedEventName}`));
    return null;    
  }

  isEventSupported(target, eventName) {
    return (typeof target[`on${eventName}`] === "function" || `on${eventName}` in target);
  }
}
