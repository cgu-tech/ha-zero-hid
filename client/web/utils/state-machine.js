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

  constructor(machine, dataKey) {
    this.constructor.checkMachine(machine);
    this._machine = machine;
    this._dataKey = dataKey;
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
    return this.activateElementNextState(evt.currentTarget || evt.originalTarget, trigger, evt);
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
            if (actionName === this.constructor.ACTION_ADD) this.addElementTimeouts(evt, elt, ...actionSetTimeout);
            if (actionName === this.constructor.ACTION_REMOVE) this.removeElementTimeouts(evt, elt, ...actionSetTimeout);
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
    const elementTimeouts = this.getElementTimeouts(elt);
    for (const actionTimeout of (actionTimeouts ?? [])) {
      // Retrieve element timeout
      const elementTimeout = elementTimeouts?.[actionTimeout];
      if (!elementTimeout) return; // Fail fast when no timeout config defined by user (might be intentionnal)

      // Add element timeout
      this.addElementTimeout(evt, elementTimeout);
    }
  }

  removeElementTimeouts(evt, elt, actionTimeouts) {
    const elementTimeouts = this.getElementTimeouts(elt);
    for (const actionTimeout of (actionTimeouts ?? [])) {
      // Retrieve element timeout
      const elementTimeout = elementTimeouts?.[actionTimeout];
      if (!elementTimeout) return; // Fail fast when no timeout config defined by user (might be intentionnal)

      // Remove element timeout
      this.removeElementTimeout(evt, elementTimeout);
    }
  }

  addElementTimeout(evt, elementTimeout) {      
    // Init concrete timeout entries
    if (!elementTimeout.entries) elementTimeout.entries = new Map();

    // Retrieve previous timeout entry that matches same timeoutId
    const timeoutId = evt.pointerId;
    const timeoutEntry = elementTimeout.entries.get(timeoutId);

    // Prevent timeout duplicates when old exist and did not expired
    if (timeoutEntry && !timeoutEntry["was-ran"]) throw new Error(
      `Cannot add timeout of type ${elementTimeout} with id ${timeoutId}:` + 
      `timeout entry ${timeoutEntry} already defined and not expired`, evt, elementTimeout, timeoutEntry);

    // Create new concrete timeout entry
    elementTimeout.entries.set(timeoutId, {
      "was-ran": false,                                  // true when action was executed
      "timeout": this.createTimeout(evt, elementTimeout, timeoutId)   // when it expires, triggers the associated inner callback to run the action
    });
  }

  createTimeout(evt, elementTimeout, timeoutId) {
    const callback = elementTimeout.callback;
    const delay = elementTimeout.delay;
    return setTimeout(() => {
      const timeoutEntry = elementTimeout.entries.get(timeoutId);

      // When no entry: element state changed before timeout (released, moved, ...)
      if (timeoutEntry && !timeoutEntry["was-ran"]) {
        timeoutEntry["was-ran"] = true;
        if (callback) callback(evt);
      }
    }, delay); // timeout duration
  }

  removeElementTimeout(evt, elementTimeout) {
    const timeoutId = evt.pointerId;
    const timeoutEntry = elementTimeout.entries?.get(timeoutId);
    const timeout = timeoutEntry?.["timeout"];
    if (timeout) clearTimeout(timeout);
    elementTimeout.entries?.delete(timeoutId);
  }

}
