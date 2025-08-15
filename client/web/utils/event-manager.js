import { Globals } from './globals.js';
import { Logger } from './logger.js';

// Define EventManager helper class
export class EventManager {

  // Constants
  _listenerKeys = ['target', 'callback', 'options', 'eventName', 'managedCallback'];
  _defaultContainer = 'default';

  _origin;
  _eventsMap = new Map();
  _reversedEventsMap = new Map();
  _preferedEventsNames = new Map(); // Cache for prefered discovered listeners (lookup speedup)
  _containers = new Map(); // Registrered listeners for cleanup

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

  addGlobalPointerUpHandlers(handleGlobalPointerUp) {
    this.addPointerUpListener(window, handleGlobalPointerUp);
    this.addPointerLeaveListener(window, handleGlobalPointerUp);
    this.addPointerCancelListener(window, handleGlobalPointerUp);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleGlobalPointerUp added"));
  }

  removeGlobalPointerUpHandlers(handleGlobalPointerUp) {
    this.removePointerUpListener(window, handleGlobalPointerUp);
    this.removePointerLeaveListener(window, handleGlobalPointerUp);
    this.removePointerCancelListener(window, handleGlobalPointerUp);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("handleGlobalPointerUp removed"));
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

  this.registerListener(this.addGivenEventListener(target, callback, options, eventName), containerName || this._defaultContainer);



  addPointerDownListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_DOWN" ); }
  addPointerEnterListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_ENTER" ); }
  addPointerOverListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_OVER" ); }
  addPointerMoveListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_MOVE" ); }
  addPointerLeaveListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_LEAVE" ); }
  addPointerUpListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_UP" ); }
  addPointerCancelListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_CANCEL" ); }
  addPointerOutListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_OUT" ); }
  addPointerClickListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_CLICK" ); }
  addPointerDblClickListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_DBLCLICK" ); }
  addPointerContextmenuListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_POINTER_CTXMENU" ); }
  addLoadListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_LOAD" ); }
  addErrorListener(target, callback, options = null) { return this.addAvailableEventListener(target, callback, options, "EVT_ERROR" ); }

  // Add the available event listener using 
  // - supported event first (when available) 
  // - then falling back to legacy event (when available)
  addAvailableEventListener(target, callback, options, managedEventName) {
    const eventName = this.getSupportedEventListener(target, managedEventName);
    if (eventName) {
      return this.addGivenEventListener(target, callback, options, eventName);
    }
    return null;
  }

  // Add the specified event listener
  addGivenEventListener(target, callback, options, eventName) {
    const listener = { "target": target, "callback": callback, "options": options, "eventName": eventName, "managedCallback": this.onManagedCallback.bind(this, target, callback) };
    if (this.isTargetListenable(target)) {
      if (options) {
        if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Adding event listener ${eventName} on target with options:`, target, options));
        target.addEventListener(eventName, listener["managedCallback"], options);
      } else {
        if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Adding event listener ${eventName} on target:`, target));
        target.addEventListener(eventName, listener["managedCallback"]);
      }
    }
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

  // Bind a listener to its specified container
  registerListener(listener, containerName) {
    if (this.isValidListener(listener)) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("registerListener(listener, containerName)", listener, containerName));
      
      // Ensure default container name as fallback
      const safeContainerName = containerName || this._defaultContainer;
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
  
  // Unbind a listener to its specified container
  unregisterListener(listener) {
    if (this.isValidListener(listener)) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("unregisterListener(listener)", listener));
      
      // Retrieve listener container raw name
      let containerName = this.listener["containerName"];

      // Worst case: trying to unregister a listener not registered or with corrupted registration
      if (!containerName) {
        if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("unregisterListener(listener): missing registration container name (will perform containers lookup)", listener));
        const containersNames = this.lookForMatchingContainerNames(listener);
        if (containersNames.length === 0) {
          if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("unregisterListener(listener): missing registration container name and no matching containers found (cannot unregister)", listener));
          return;
        } else if (containersNames.length > 1) {
          if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("unregisterListener(listener): missing registration container name and multiple matching containers found (cannot unregister)", listener, containersNames));
          return;
        }
        if (this.getLogger().isInfoEnabled()) console.info(...this.getLogger().info("unregisterListener(listener): missing registration container name, found a single matching container", listener, containersNames));
        
        // Update listener container raw name to lookup result
        containerName = mySet.values().next().value;
      }

      // Unregister from the container
      const container = this._containers.get(safeContainerName);

      // Missing container
      if (!container) {
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("unregisterListener(listener): missing container, nothing to unregister", listener, containerName));
        return;
      }

      // Existing container: remove from container
      container.delete(listener);
      
      // Destroy container name reference inside listener to allow GC
      listener["containerName"] = null;
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("unregisterListener(listener): listener successfully unregistered from container", listener, containerName));
    }
    // Usefull for chaining
    return listener;
  }
  
  lookForMatchingContainerNames(listener) {
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace('lookForMatchingContainerNames(listener):', listener));
    const containerNames = new Set();
    for (const [containerName, container] of this._containers.entries()) {
      if (container.has(listener)) containerNames.push(containerName);
    }
    return containerNames;
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
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("clearListeners(containerName): no listeners found for containerName", containerName));
      return;
    }

    // Remove all listeners inside the container
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`clearListeners(containerName): removing ${container.length} listeners bound to containerName`, containerName));
    for (const listener of container) {
      this.removeListener(listener);
    }

    // Clear the container from listeners references
    container.clear();

    // Remove the container from listeners containers
    this._containers.delete(containerName);
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace("clearListeners(containerName): listeners with containerName cleared", containerName));
  }

  removeListener(listener) {
    if (this.isValidListener(listener)) {
        
      // Remove managed callback
      this.removeGivenEventListener(listener["target"], listener["managedCallback"], listener["options"], listener["eventName"]);

      // Destroy references inside listener to allow GC
      listener["target"] = null;
      listener["callback"] = null;
      listener["options"] = null;
      listener["eventName"] = null;
      listener["managedCallback"] = null;

      // Conditionnaly destroy option references inside listener to allow GC
      if (listener["containerName"]) listener["containerName"] = null;
    }
    return null;
  }

  removePointerDownListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_DOWN" ); }
  removePointerEnterListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_ENTER" ); }
  removePointerOverListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_OVER" ); }
  removePointerMoveListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_MOVE" ); }
  removePointerLeaveListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_LEAVE" ); }
  removePointerUpListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_UP" ); }
  removePointerCancelListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_CANCEL" ); }
  removePointerOutListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_OUT" ); }
  removePointerClickListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_CLICK" ); }
  removePointerDblClickListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_DBLCLICK" ); }
  removePointerContextmenuListener(target, callback, options = null) { this.removeAvailableEventListener(target, callback, options, "EVT_POINTER_CTXMENU" ); }
  removeLoadListener(target, callback, options = null) { return this.removeAvailableEventListener(target, callback, options, "EVT_LOAD" ); }
  removeErrorListener(target, callback, options = null) { return this.removeAvailableEventListener(target, callback, options, "EVT_ERROR" ); }
  
  isValidListener(listener) {
    // Falsy or not an object {} -> not a valid listener
    if (!Object.prototype.toString.call(listener) === '[object Object]') return false;

    // Check object contains at least all listener keys
    const objKeys = new Set(Object.keys(obj));;
    return this._listenerKeys.every(listenerKey => objKeys.has(listenerKey));
  }

  // Remove the available event listener using 
  // - supported event first (when available) 
  // - then falling back to legacy event (when available)
  removeAvailableEventListener(target, callback, options, managedEventName) {
    const eventName = this.getSupportedEventListener(target, managedEventName);
    if (eventName) {
      this.removeGivenEventListener(target, callback, options, eventName);
    }
    return eventName;
  }

  // Remove the specified event listener
  removeGivenEventListener(target, callback, options, eventName) {
    if (this.isTargetListenable(target)) {
      if (options) {
        if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Removing event listener ${eventName} on target with options:`, target, options));
        target.removeEventListener(eventName, callback, options);
      } else {
        if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Removing event listener ${eventName} on target:`, target));
        target.removeEventListener(eventName, callback);
      }
    }
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
