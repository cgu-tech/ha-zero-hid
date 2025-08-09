import { Globals } from './globals.js';
import { Logger } from './logger.js';

// Define EventManager helper class
export class EventManager {

  _origin;

  constructor(origin) {
    this._origin = origin;
  }

  getLogger() {
    return this._origin?._logger;
  }

  getHass() {
    return this._origin?._hass;
  }

  getHaptic() {
    return !!this._origin?._config?.['haptic'];
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

  addPointerDownListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_DOWN" ); }
  addPointerEnterListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_ENTER" ); }
  addPointerOverListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_OVER" ); }
  addPointerMoveListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_MOVE" ); }
  addPointerLeaveListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_LEAVE" ); }
  addPointerUpListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_UP" ); }
  addPointerCancelListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_CANCEL" ); }
  addPointerOutListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_OUT" ); }
  addPointerClickListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_CLICK" ); }
  addPointerDblClickListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_DBLCLICK" ); }
  addPointerContextmenuListener(target, callback, options = null) { this.addAvailableEventListener(target, callback, options, "EVT_POINTER_CTXMENU" ); }

  // Add the available event listener using 
  // - supported event first (when available) 
  // - then falling back to legacy event (when available)
  addAvailableEventListener(target, callback, options, events) {
    const eventName = this.getSupportedEventListener(target, events);
    if (eventName) {
      this.addGivenEventListener(target, callback, options, eventName);
    }
    return eventName;
  }

  // Add the specified event listener
  addGivenEventListener(target, callback, options, eventName) {
    if (this.isTargetListenable(target)) {
      if (options) {
        if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Adding event listener ${eventName} on target with options:`, target, options));
        target.addEventListener(eventName, callback, options);
      } else {
        if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug(`Adding event listener ${eventName} on target:`, target));
        target.addEventListener(eventName, callback);
      }
    }
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

  // Remove the available event listener using 
  // - supported event first (when available) 
  // - then falling back to legacy event (when available)
  removeAvailableEventListener(target, callback, options, abstractEventName) {
    const eventName = this.getSupportedEventListener(target, abstractEventName);
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
  getSupportedEventListener(target, abstractEventName) {
    if (!abstractEventName) {
      if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`Invalid abstractEventName ${abstractEventName}: expected a non-empty string`));
      return null;
    }
    
    // Init events mapping and cache when needed
    if (!this.eventsMap) {
      
      // Mapping for "virtual" event names with their "real" event names counterparts 
      // that might be supported by device - or not (by preference order)
      this.eventsMap = new Map();
      this.eventsMap.set("EVT_POINTER_DOWN",     ["pointerdown", "touchstart", "mousedown"]);
      this.eventsMap.set("EVT_POINTER_ENTER",    ["pointerenter", "mouseenter"]);
      this.eventsMap.set("EVT_POINTER_OVER",     ["pointerover", "mouseover"]);
      this.eventsMap.set("EVT_POINTER_MOVE",     ["pointermove", "touchmove", "mousemove"]);
      this.eventsMap.set("EVT_POINTER_LEAVE",    ["pointerleave", "mouseleave"]);
      this.eventsMap.set("EVT_POINTER_UP",       ["pointerup", "touchend", "mouseup"]);
      this.eventsMap.set("EVT_POINTER_CANCEL",   ["pointercancel", "touchcancel"]);
      this.eventsMap.set("EVT_POINTER_OUT",      ["pointerout", "mouseout"]);
      this.eventsMap.set("EVT_POINTER_CLICK",    ["click"]);
      this.eventsMap.set("EVT_POINTER_DBLCLICK", ["dblclick"]);
      this.eventsMap.set("EVT_POINTER_CTXMENU",  ["contextmenu"]);
      
      // Cache for prefered listeners (lookup speedup)
      this.preferedEventsNames = new Map();
    }

    // Given abstractEventName, then try to retrieve previously cached prefered concrete js event
    const preferedEventName = this.preferedEventsNames.get(abstractEventName);
    if (preferedEventName) {
      if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cache HIT for event ${abstractEventName}: found cached prefered event ${preferedEventName}`));
      return preferedEventName;
    }
    if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cache MISS for event ${abstractEventName}: no supported prefered event cached`));

    // When no prefered concrete js event, then try to retrieve mapped events
    const mappedEvents = this.eventsMap.get(abstractEventName);
    if (!mappedEvents) {
      if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`Unknwon abstractEventName ${abstractEventName}`));
      return null;
    }

    // Check for supported event into all mapped events
    for (const mappedEvent of mappedEvents) {
      if (this.isEventSupported(target, mappedEvent)) {

        // First supported event found: cache-it as prefered concrete js event
        this.preferedEventsNames.set(abstractEventName, mappedEvent);

        // Return prefered concrete js event
        if (this.getLogger().isTraceEnabled()) console.debug(...this.getLogger().trace(`Cache UPDATE for event ${abstractEventName}: set to prefered event ${mappedEvent}`));
        return mappedEvent;
      }
    }

    if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error(`No concrete js event supported for ${abstractEventName}`));
    return null;    
  }

  isEventSupported(target, eventName) {
    return (typeof target[`on${eventName}`] === "function" || `on${eventName}` in target);
  }

  // vibrate the device like a long haptic feedback (ex: button long-click)
  hapticFeedbackLong() {
    if (this.getHaptic()) this.vibrateDevice(20);
  }

  // vibrate the device like a standard haptic feedback (ex: button click)
  hapticFeedback() {
    if (this.getHaptic()) this.vibrateDevice(10);
  }

  // vibrate the device like a short haptic feedback (ex: mouse move)
  hapticFeedbackShort() {
    if (this.getHaptic()) this.vibrateDevice(5);
  }

  // vibrate the device during specified duration (in milliseconds)
  vibrateDevice(duration) {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    } else {
      if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug('Vibration not supported on this device.'));
    }
  }

}
