import { Globals } from './globals.js';
import { Logger } from './logger.js';

// Define EventManager helper class
export class EventManager {

  // private init required constants
  static _BUTTON_STATUS_MAP;

  static _BUTTON_STATE_NORMAL = "normal";
  static _BUTTON_STATE_HOVER = "hover";
  static _BUTTON_STATE_PRESSED = "pressed";

  static _BUTTON_CALLBACK_POINTER_HOVER = "BTN_HOVER";
  static _BUTTON_CALLBACK_ABORT_POINTER_HOVER = "BTN_ABORT_HOVER";
  static _BUTTON_CALLBACK_PRESS = "BTN_PRESS";
  static _BUTTON_CALLBACK_ABORT_PRESS = "BTN_ABORT_PRESS";
  static _BUTTON_CALLBACK_RELEASE = "BTN_RELEASE";

  static _TRIGGER_POINTER_ENTER = "EVT_POINTER_ENTER";
  static _TRIGGER_POINTER_LEAVE = "EVT_POINTER_LEAVE";
  static _TRIGGER_POINTER_DOWN = "EVT_POINTER_DOWN";
  static _TRIGGER_POINTER_UP = "EVT_POINTER_UP";

  // Should be initialized in a static block to avoid JS engine to bug on static fields not-already-referenced otherwise
  static {
    this._BUTTON_STATUS_MAP = {
      "init": { "state": this._BUTTON_STATE_NORMAL },
      "states": {
        [this._BUTTON_STATE_NORMAL]: {
          "actions": { "self": [ { "action": "remove", "class_list": ["active", "press"] } ] },
          "nexts": [ 
            { "trigger": this._TRIGGER_POINTER_ENTER, "state": this._BUTTON_STATE_HOVER, "callback": this._BUTTON_CALLBACK_POINTER_HOVER }
          ]
        },
        [this._BUTTON_STATE_HOVER]: {
          "actions": { "self": [ { "action": "add", "class_list": ["active"] } ] },
          "nexts": [ 
            { "trigger": this._TRIGGER_POINTER_LEAVE, "state": this._BUTTON_STATE_NORMAL, "callback": this._BUTTON_CALLBACK_ABORT_POINTER_HOVER }, 
            { "trigger": this._TRIGGER_POINTER_DOWN, "state": this._BUTTON_STATE_PRESSED, "callback": this._BUTTON_CALLBACK_PRESS }, // keyPress for 2-states button, popin/long-click/etc timeout for all buttons
          ]
        },
        [this._BUTTON_STATE_PRESSED]: {
          "actions": { "self": [ { "action": "add", "class_list": ["press"] } ] },
          "nexts": [ 
            { "trigger": this._TRIGGER_POINTER_LEAVE, "state": this._BUTTON_STATE_NORMAL, "callback": this._BUTTON_CALLBACK_ABORT_PRESS }, // onAbort for 2-states button
            { "trigger": this._TRIGGER_POINTER_UP, "state": this._BUTTON_STATE_HOVER, "callback": this._BUTTON_CALLBACK_RELEASE }, // keyRelease for 2-states button, key click for 1-state button
          ]
        }
      }
    };
  }

  // Constants
  _listenerKeys = ['target', 'callback', 'options', 'eventName', 'managedCallback'];
  _defaultContainerName = 'default';
  _windowContainerName = '__window';
  
  _origin;
  _eventsMap = new Map();
  _reversedEventsMap = new Map();
  _preferedEventsNames = new Map(); // Cache for prefered discovered listeners (lookup speedup)
  _containers = new Map(); // Registrered listeners for cleanup
  _buttonsWindowPointerUpListener; // Global windows.pointerUp callback for buttons management
  _buttons = new Set(); // Managed buttons

  constructor(origin) {
    this._origin = origin;

    // Mapping for "managed" event names with their "real" event names counterparts 
    // that might be supported by device - or not (by preference order)
    this._eventsMap.set("EVT_POINTER_DOWN",     ["pointerdown", "touchstart", "mousedown"]);
    this._eventsMap.set("EVT_POINTER_ENTER",    ["pointerenter", "mouseenter"]);
    this._eventsMap.set("EVT_POINTER_OVER",     ["pointerover", "mouseover"]);
    this._eventsMap.set("EVT_POINTER_MOVE",     ["pointermove", "touchmove", "mousemove"]);
    this._eventsMap.set("EVT_POINTER_LEAVE",    ["pointerleave", "mouseleave"]);
    this._eventsMap.set("EVT_POINTER_UP",       ["pointerup", "touchend", "mouseup"]);
    this._eventsMap.set("EVT_POINTER_CANCEL",   ["pointercancel", "touchcancel"]);
    this._eventsMap.set("EVT_POINTER_OUT",      ["pointerout", "mouseout"]);
    this._eventsMap.set("EVT_POINTER_CLICK",    ["click"]);
    this._eventsMap.set("EVT_POINTER_DBLCLICK", ["dblclick"]);
    this._eventsMap.set("EVT_POINTER_CTXMENU",  ["contextmenu"]);
    this._eventsMap.set("EVT_LOAD",             ["load"]);
    this._eventsMap.set("EVT_ERROR",            ["error"]);

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

  // Get elapsed time between a start event and an end event (in milliseconds)
  getElapsedTime(evtStart, evtEnd) {
    return evtEnd.timeStamp - evtStart.timeStamp;
  }

  addButtonListeners(containerName, target, callbacks, options = null) {
    if (!target) throw new Error('Invalid target', target);
    this.initButtonState(target);
    this._buttons.add(target);

    const listeners = [];
    listeners.push(this.addPointerEnterListenerToContainer(containerName, target, this.onButtonPointerEnter.bind(this, callbacks), options));
    listeners.push(this.addPointerLeaveListenerToContainer(containerName, target, this.onButtonPointerLeave.bind(this, callbacks), options));
    listeners.push(this.addPointerCancelListenerToContainer(containerName, target, this.onButtonPointerCancel.bind(this, callbacks), options));
    listeners.push(this.addPointerDownListenerToContainer(containerName, target, this.onButtonPointerDown.bind(this, callbacks), options));
    listeners.push(this.addPointerUpListenerToContainer(containerName, target, this.onButtonPointerUp.bind(this, callbacks), options));

    if (!this._buttonsWindowPointerUpListener) 
      this._buttonsWindowPointerUpListener = this.addPointerUpListenerToContainer(this._windowContainerName, window, this.onButtonWindowPointerUp.bind(this, callbacks));
    
    return listeners;
  }
  
  onButtonPointerEnter(callbacks, evt) {
    this.activateButtonNextState(callbacks, evt, this.constructor._TRIGGER_POINTER_ENTER);
  }
  onButtonPointerLeave(callbacks, evt) {
    this.activateButtonNextState(callbacks, evt, this.constructor._TRIGGER_POINTER_LEAVE);
  }
  onButtonPointerCancel(callbacks, evt) {
    this.activateButtonNextState(callbacks, evt, this.constructor._TRIGGER_POINTER_LEAVE);
  }
  onButtonPointerDown(callbacks, evt) {
    this.activateButtonNextState(callbacks, evt, this.constructor._TRIGGER_POINTER_DOWN);
  }
  onButtonPointerUp(callbacks, evt) {
    this.activateButtonNextState(callbacks, evt, this.constructor._TRIGGER_POINTER_UP);
  }
  onButtonWindowPointerUp(callbacks, evt) {
    const hovered = this.getTargetHoveredByPointer(evt);
    for (const btn of this._buttons) {
      if (btn !== hovered) this.activateButtonNextState(callbacks, evt, this.constructor._TRIGGER_POINTER_LEAVE);
    }
  }
  
  initButtonState(btn) {
    return if (btn) btn._managedButtonState = this.constructor._BUTTON_STATUS_MAP["init"]["state"];
  }

  getButtonCurrentStateName(btn) {
    return if (btn) btn._managedButtonState;
  }

  getButtonCurrentState(btn) {
    return if (btn) this.constructor._BUTTON_STATUS_MAP["states"][this.getButtonCurrentStateName(btn)];
  }

  getButtonCurrentActions(btn) {
    return this.getButtonCurrentState(btn)?.["actions"];
  }

  getButtonNextState(btn, trigger) {
    return this.getButtonCurrentState(btn)?.["nexts"].find(next => next["trigger"] === trigger);
  }

  isButtonNextStateTrigger(btn, trigger) {
    return !!this.getButtonNextState(btn, trigger);
  }

  activateButtonNextState(callbacks, evt, trigger) {
    const btn = evt.currentTarget;
    if (btn) {
      const nextState = this.getButtonNextState(btn, trigger);
      if (nextState) {
        // Change button state
        btn._managedButtonState = nextState["state"];

        // Execute associated callback (when present)
        const callback = callbacks?.[nextState["callback"]];
        if (callback) callback(evt);
      }
      return !!nextState;
    }
  }

  executeButtonOverride(btn, overrideConfig) {

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
    this.triggerHaosTapAction(btn, overrideAction);
  }

  // Call a service from HAOS custom component 'Globals.COMPONENT_NAME' using WebSockets.
  // 
  // Parameters:
  //  - name: the service name to fire (registered into custom component 'Globals.COMPONENT_NAME' Python code)
  // 
  // Returns: 
  //  - void (this is a fire-and-forget HAOS integration call)
  callComponentService(name, args) {
    this.getHass().callService(Globals.COMPONENT_NAME, name, args);
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
  callComponentCommand(name) {
    return this.getHass().connection.sendMessagePromise({
      type: `${Globals.COMPONENT_NAME}/${name}`
    });
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

  addPointerDownListener(target, callback, options = null) { return this.addPointerDownListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerEnterListener(target, callback, options = null) { return this.addPointerEnterListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerOverListener(target, callback, options = null) { return this.addPointerOverListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerMoveListener(target, callback, options = null) { return this.addPointerMoveListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerLeaveListener(target, callback, options = null) { return this.addPointerLeaveListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerUpListener(target, callback, options = null) { return this.addPointerUpListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerCancelListener(target, callback, options = null) { return this.addPointerCancelListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerOutListener(target, callback, options = null) { return this.addPointerOutListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerClickListener(target, callback, options = null) { return this.addPointerClickListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerDblClickListener(target, callback, options = null) { return this.addPointerDblClickListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addPointerContextmenuListener(target, callback, options = null) { return this.addPointerContextmenuListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addLoadListener(target, callback, options = null) { return this.addLoadListenerToContainer(this._defaultContainerName, target, callback, options ); }
  addErrorListener(target, callback, options = null) { return this.addErrorListenerToContainer(this._defaultContainerName, target, callback, options ); }

  addPointerDownListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_DOWN" ); }
  addPointerEnterListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_ENTER" ); }
  addPointerOverListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_OVER" ); }
  addPointerMoveListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_MOVE" ); }
  addPointerLeaveListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_LEAVE" ); }
  addPointerUpListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_UP" ); }
  addPointerCancelListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_CANCEL" ); }
  addPointerOutListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_OUT" ); }
  addPointerClickListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_CLICK" ); }
  addPointerDblClickListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_DBLCLICK" ); }
  addPointerContextmenuListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_POINTER_CTXMENU" ); }
  addLoadListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_LOAD" ); }
  addErrorListenerToContainer(containerName, target, callback, options = null) { return this.addAvailableEventListener(containerName, target, callback, options, "EVT_ERROR" ); }

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
    const listener = this.registerListener(this.createListener(target, callback, options, eventName, callback), containerName);
    
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
      
      // Retrieve listener container name
      let containerName = this.listener["containerName"];
      
      // Listener does not have container name: not registered
      if (!containerName) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("unregisterListener(listener): listener does not have registered container name (unregistered)", listener));
        return listener;
      }
      
      // Unregister from the container
      const container = this._containers.get(safeContainerName);
      
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
