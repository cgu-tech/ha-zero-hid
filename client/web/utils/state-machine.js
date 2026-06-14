// Define StateMachine helper class
export class StateMachine {

  static INIT = '1';              // "init"
  static STATES = '2';            // "states"

  static ACTIONS = '1';           // "actions"
  static NEXTS = '2';             // "nexts"

  static ACTION_ADD = '1';
  static ACTION_REMOVE = '2';

  static STATE = '1';             // "state"
  static TRIGGER = '2';           // "trigger"
  static CALLBACK = '3';          // "callback"

  static ACTION = '1';            // "action"
  static ACTION_TYPE_CLASSLIST = '2';  // "class_list"
  static ACTION_TYPE_SETTIMEOUT = '3'; // "setTimeout"

  _machine;
  _dataKey;
  _eventKeys;
  _elements = new Set();               // Managed elements

  static checkMachine(machine) {
    if (!machine)
      throw new Error('Invalid machine: expected non-null/empty/undefined machine, got:', machine);
    if (!machine[this.INIT])
      throw new Error(`Invalid machine: expected non-null/empty/undefined machine[this.constructor.INIT] (machine[${this.INIT}]), got:`, machine);
    if (!machine[this.INIT])
      throw new Error(`Invalid machine: expected non-null/empty/undefined machine[this.constructor.INIT][this.constructor.STATE] (machine[${this.INIT}][${this.STATE}]), got:`, machine);
    if (!machine[this.STATES])
      throw new Error(`Invalid machine: expected non-null/empty/undefined machine[this.constructor.STATES] (machine[${this.STATES}]), got:`, machine);
  }

  static normalizeToSet(value) {
    if (value == null) return new Set();
    if (value instanceof Set) return new Set(value);
    if (Array.isArray(value)) return new Set(value);
    return new Set([value]);
  }

  static ensureDefaultEventKeys(eventKeys) {
    const eventKeysSet = this.normalizeToSet(eventKeys);
    eventKeysSet.add("pointerId");
    eventKeysSet.add("currentTarget");
    eventKeysSet.add("target");
    eventKeysSet.add("clientX");
    eventKeysSet.add("clientY");
    return eventKeysSet;
  }

  constructor(machine, dataKey, eventKeys) {
    this.constructor.checkMachine(machine);
    this._machine = machine;
    this._dataKey = dataKey;
    this._eventKeys = this.constructor.ensureDefaultEventKeys(eventKeys);
  }

  createStateEvent(evt) {
    if (!evt) return null;
    const stateEvt = {};
    for (const eventKey of this._eventKeys) {
      stateEvt[eventKey] = evt?.[eventKey];
    }
    return stateEvt;
  }

  getElementFromEvent(evt) {
    return evt.currentTarget ?? evt.target ?? null;
  }

  setElementData(elt, data) {
    if (elt) elt[this._dataKey] = data;
  }

  getElementData(elt) {
    return elt?.[this._dataKey];
  }

  setElementState(elt, state) {
    return this.getElementData(elt).state = state;
  }

  getElementState(elt) {
    return this.getElementData(elt)?.state;
  }

  getElementStateFromEvent(evt) {
    return this.getElementState(this.getElementFromEvent(evt));
  }

  setElementCallbacks(elt, callbacks) {
    if (elt) this.getElementData(elt).callbacks = callbacks;
  }

  getElementCallbacks(elt) {
    return this.getElementData(elt)?.callbacks;
  }

  setElementTimeouts(elt, timeouts) {
    if (elt) this.getElementData(elt).timeouts = timeouts;
  }

  getElementTimeouts(elt) {
    return this.getElementData(elt)?.timeouts;
  }

  getEventId(evt) {
    return evt?.pointerId;
  }

  isNullOrUndefined(value) {
    return value === undefined || value === null;
  }

  clearElementEventFromEvent(evt) {
    this.clearElementEvent(this.getElementFromEvent(evt), this.getEventId(evt));
  }

  clearElementEvent(elt, eventId) {
    if (this.isNullOrUndefined(eventId)) throw new Error('clearElementEvent(elt, eventId): eventId should not be null or undefined', elt, eventId);
    if (elt) {
      const elementData = this.getElementData(elt);
      if (elementData.events) {
        elementData.events.delete(eventId);
        
        const eventsIndex = elementData.eventsIndex;
        const eventIndex = eventsIndex.get(eventId);
        eventsIndex.delete(eventId);

        this.decreaseIndexesStartingAt(eventsIndex, eventIndex);
      }

      // Debug only
      // const event = elementData.events.get(eventId);
      // const eventCount = (!!event) ? '1' : '0';
      // const eventsCount = elementData.events.size;
      // console.log(`clearElementEvent(elt, eventId): ${eventCount} event for id ${eventId}, ${eventsCount} event(s) in element`, elt, eventId);
    }
  }

  decreaseIndexesStartingAt(eventsIndex, eventIndex) {
    if (eventsIndex.size > eventIndex) { // Ensure map contains at least start index
      let mapIndex = 0;
      for (const [eventId, eventIndexToDecrease] of eventsIndex) {
        if (mapIndex >= eventIndex) {
          eventsIndex.set(eventId, eventIndexToDecrease - 1);
        }
        mapIndex++;
      }
    }
  }

  setElementEventFromEvent(evt) {
    this.setElementEvent(this.getElementFromEvent(evt), this.getEventId(evt), evt);
  }

  setElementEvent(elt, eventId, evt) {
    if (this.isNullOrUndefined(eventId)) throw new Error('setElementEvent(elt, eventId, evt): eventId should not be null or undefined', elt, eventId, evt);
    if (elt) {
      const elementData = this.getElementData(elt);
      if (!elementData.events) {
        elementData.events = new Map();
        elementData.eventsIndex = new Map();
      }
      const eventExists = elementData.events.has(eventId);
      elementData.events.set(eventId, evt);
      if (!eventExists) elementData.eventsIndex.set(eventId, elementData.events.size - 1);

      // Debug only
      // const event = elementData.events.get(eventId);
      // const eventCount = (!!event) ? '1' : '0';
      // const eventsCount = elementData.events.size;
      // console.log(`setElementEvent(elt, eventId, evt): ${eventCount} event for id ${eventId}, ${eventsCount} event(s) in element`, elt, eventId, evt);
    }
  }

  getElementEventFromEvent(evt) {
    return this.getElementEvent(this.getElementFromEvent(evt), this.getEventId(evt));
  }

  getElementEvent(elt, eventId) {
    return this.getElementData(elt)?.events?.get(eventId);
  }

  getElementEventIndexFromEvent(evt) {
    return this.getElementEventIndex(this.getElementFromEvent(evt), this.getEventId(evt));
  }

  getElementEventIndex(elt, eventId) {
    return this.getElementData(elt)?.eventsIndex?.get(eventId);
  }

  getElements() {
    return this._elements;
  }

  initElementState(elt, callbacks, timeouts) {
    this.setElementData(elt, {});
    this.setElementState(elt, this._machine[this.constructor.INIT][this.constructor.STATE]);
    this.setElementCallbacks(elt, callbacks);
    this.setElementTimeouts(elt, timeouts);
    this._elements.add(elt);
  }

  removeElement(elt) {
    this._elements.delete(elt);
  }

  getElementCurrentState(elt) {
    return this._machine[this.constructor.STATES][this.getElementState(elt)];
  }

  getElementCurrentActions(elt) {
    return this.getElementCurrentState(elt)?.[this.constructor.ACTIONS];
  }

  getElementNextState(elt, trigger) {
    return this.getElementCurrentState(elt)?.[this.constructor.NEXTS].find(next => next[this.constructor.TRIGGER] === trigger);
  }

  activateElementNextStateFromEvent(trigger, evt) {
    return this.activateElementNextState(this.getElementFromEvent(evt), trigger, evt);
  }

  activateElementNextState(elt, trigger, evt) {
    if (elt) {
      const nextState = this.getElementNextState(elt, trigger);
      if (nextState) {

        // Change element to next state
        this.setElementState(elt, nextState[this.constructor.STATE]);

        // Update element
        const actions = this.getElementCurrentActions(elt);
        for (const action of (actions ?? [])) {
          const actionName = action[this.constructor.ACTION];

          // Update element classes
          const actionClassList = action[this.constructor.ACTION_TYPE_CLASSLIST];
          if (actionClassList) {
            if (actionName === this.constructor.ACTION_ADD) elt.classList.add(...actionClassList);
            if (actionName === this.constructor.ACTION_REMOVE) elt.classList.remove(...actionClassList);
          }

          // Update element timeouts
          const actionSetTimeout = action[this.constructor.ACTION_TYPE_SETTIMEOUT];
          if (actionSetTimeout) {
            const stateEvt = this.createStateEvent(evt);
            if (actionName === this.constructor.ACTION_ADD) this.addElementTimeouts(stateEvt, elt, ...actionSetTimeout);
            if (actionName === this.constructor.ACTION_REMOVE) this.removeElementTimeouts(stateEvt, elt, ...actionSetTimeout);
          }
        }

        // Execute associated callback (when present)
        const callback = this.getElementCallbacks(elt)?.[nextState[this.constructor.CALLBACK]];
        if (callback) callback(elt, evt);
      }
      return !!nextState;
    }
    return false;
  }

  addElementTimeouts(evt, elt, actionTimeouts) {
    for (const actionTimeout of (actionTimeouts ?? [])) {
      this.addElementTimeout(evt, elt, actionTimeout);
    }
  }

  removeElementTimeouts(evt, elt, actionTimeouts) {
    for (const actionTimeout of (actionTimeouts ?? [])) {
      this.removeElementTimeout(evt, elt, actionTimeout);
    }
  }

  addElementTimeout(evt, elt, actionTimeout) {
    const elementTimeouts = this.getElementTimeouts(elt);
    if (!elementTimeouts)
      throw new Error(`Cannot add timeout with id ${actionTimeout}: no timeouts configs defined on target element`, evt, elt, elementTimeouts);

    const elementTimeout = elementTimeouts[actionTimeout];
    if (!elementTimeout)
      throw new Error(`Cannot add timeout with id ${actionTimeout}: no timeout config avaible for id ${actionTimeout} on target element`, evt, elt, elementTimeouts, elementTimeout);

    // Prevent timeout duplicates when old exist and did not expired
    const timeoutEntry = elementTimeout["entry"];
    if (timeoutEntry && !timeoutEntry["was-ran"])
      throw new Error(`Cannot add timeout with id ${actionTimeout}: non-expired timeout entry with same id ${actionTimeout} detected on target element`, evt, elt, elementTimeouts, elementTimeout, timeoutEntry);

    // Create new concrete timeout entry
    elementTimeout["entry"] = {
      "was-ran": false,                                  // true when action was executed
      "timeout": this.createTimeout(evt, elementTimeout)   // when it expires, triggers the associated inner callback to run the action
    };
  }

  createTimeout(evt, elementTimeout) {
    return setTimeout(() => {
      const timeoutEntry = elementTimeout["entry"];

      // When no entry: element state changed before timeout (released, moved, ...)
      if (timeoutEntry && !timeoutEntry["was-ran"]) {
        timeoutEntry["was-ran"] = true;
        const callback = elementTimeout.callback;
        if (callback) callback(evt);
      }
    }, elementTimeout.delay); // timeout duration
  }

  removeElementTimeout(evt, elt, actionTimeout) {
    const elementTimeouts = this.getElementTimeouts(elt);
    if (!elementTimeouts) return;

    const elementTimeout = elementTimeouts[actionTimeout];
    if (!elementTimeout) return;

    const timeoutEntry = elementTimeout["entry"];
    if (!timeoutEntry) return;

    const timeout = timeoutEntry["timeout"];
    if (timeout) clearTimeout(timeout);

    elementTimeout["entry"] = null;
  }

  //addElementTimeouts(evt, elt, actionTimeouts) {
  //  const elementTimeouts = this.getElementTimeouts(elt);
  //  for (const actionTimeout of (actionTimeouts ?? [])) {
  //    // Retrieve element timeout
  //    const elementTimeout = elementTimeouts?.[actionTimeout];
  //    if (!elementTimeout) return; // Fail fast when no timeout config defined by user (might be intentionnal)
  //
  //    // Add element timeout
  //    this.addElementTimeout(evt, elementTimeout);
  //  }
  //}
  //
  //removeElementTimeouts(evt, elt, actionTimeouts) {
  //  const elementTimeouts = this.getElementTimeouts(elt);
  //  for (const actionTimeout of (actionTimeouts ?? [])) {
  //    // Retrieve element timeout
  //    const elementTimeout = elementTimeouts?.[actionTimeout];
  //    if (!elementTimeout) return; // Fail fast when no timeout config defined by user (might be intentionnal)
  //
  //    // Remove element timeout
  //    this.removeElementTimeout(evt, elementTimeout);
  //  }
  //}
  //
  //addElementTimeout(evt, elementTimeout) {      
  //  // Init concrete timeout entries
  //  if (!elementTimeout.entries) elementTimeout.entries = new Map();
  //
  //  // Retrieve previous timeout entry that matches same timeoutId
  //  const timeoutId = evt.pointerId;
  //  const timeoutEntry = elementTimeout.entries.get(timeoutId);
  //
  //  // Prevent timeout duplicates when old exist and did not expired
  //  if (timeoutEntry && !timeoutEntry["was-ran"]) throw new Error(
  //    `Cannot add timeout of type ${elementTimeout} with id ${timeoutId}:` + 
  //    `timeout entry ${timeoutEntry} already defined and not expired`, evt, elementTimeout, timeoutEntry);
  //
  //  // Create new concrete timeout entry
  //  elementTimeout.entries.set(timeoutId, {
  //    "was-ran": false,                                  // true when action was executed
  //    "timeout": this.createTimeout(evt, elementTimeout, timeoutId)   // when it expires, triggers the associated inner callback to run the action
  //  });
  //}
  //
  //createTimeout(evt, elementTimeout, timeoutId) {
  //  const callback = elementTimeout.callback;
  //  const delay = elementTimeout.delay;
  //  return setTimeout(() => {
  //    const timeoutEntry = elementTimeout.entries.get(timeoutId);
  //
  //    // When no entry: element state changed before timeout (released, moved, ...)
  //    if (timeoutEntry && !timeoutEntry["was-ran"]) {
  //      timeoutEntry["was-ran"] = true;
  //      if (callback) callback(evt);
  //    }
  //  }, delay); // timeout duration
  //}
  //
  //removeElementTimeout(evt, elementTimeout) {
  //  const timeoutId = evt.pointerId;
  //  const timeoutEntry = elementTimeout.entries?.get(timeoutId);
  //  const timeout = timeoutEntry?.["timeout"];
  //  if (timeout) clearTimeout(timeout);
  //  elementTimeout.entries?.delete(timeoutId);
  //}

  getPointerEventX(evt) {
    return evt.clientX;
  }

  getPointerEventY(evt) {
    return evt.clientY;
  }

  getVectorFromPointerEvent(evt) {
    return {
     "x": this.getPointerEventX(evt),
     "y": this.getPointerEventY(evt),
    };
  }

  getDeltaFromPoints(pointOneX, pointOneY, pointTwoX, pointTwoY, absolute = false) {
    const dx = Math.round(pointTwoX - pointOneX);
    const dy = Math.round(pointTwoY - pointOneY);
    return {
      "dx": absolute ? Math.abs(dx) : dx, 
      "dy": absolute ? Math.abs(dy) : dy
    };
  }

  getDeltaFromVectors(vectorOne, vectorTwo, absolute = false) {
    return this.getDeltaFromPoints(vectorOne.x, vectorOne.y, vectorTwo.x, vectorTwo.y, absolute);
  }

  getDeltaFromPointerEvents(evtOne, evtTwo, absolute = false) {
    return this.getDeltaFromPoints(
      this.getPointerEventX(evtOne), this.getPointerEventY(evtOne),
      this.getPointerEventX(evtTwo), this.getPointerEventY(evtTwo),
      absolute);
  }

  isDeltaFromPointsGreaterThanMax(pointOneX, pointOneY, pointTwoX, pointTwoY, maxHorizontal, maxVertical) {
    const absDelta = this.getDeltaFromPoints(pointOneX, pointOneY, pointTwoX, pointTwoY, true);
    return absDelta.dx > maxHorizontal || absDelta.dy > maxVertical;
  }

  isDeltaFromVectorsGreaterThanMax(vectorOne, vectorTwo, maxHorizontal, maxVertical) {
    return this.isDeltaFromPointsGreaterThanMax(
      vectorOne.x, vectorOne.y, 
      vectorTwo.x, vectorTwo.y, 
      maxHorizontal, maxVertical);
  }

  isDeltaFromPointerEventsGreaterThanMax(evtOne, evtTwo, maxHorizontal, maxVertical) {
    return this.isDeltaFromPointsGreaterThanMax(
      this.getPointerEventX(evtOne), this.getPointerEventY(evtOne),
      this.getPointerEventX(evtTwo), this.getPointerEventY(evtTwo),
      maxHorizontal, maxVertical);
  }

}
