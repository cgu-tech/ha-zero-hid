// Define StateMachine helper class
export class StateMachine {

  static _MACHINE_INIT = '1';          // "init"
  static _MACHINE_STATES = '2';        // "states"

  static _MACHINE_ACTIONS = '1';       // "actions"
  static _MACHINE_NEXTS = '2';         // "nexts"

  static _MACHINE_ACTION_ADD = '1';
  static _MACHINE_ACTION_REMOVE = '2';

  static _MACHINE_STATE = '1';         // "state"
  static _MACHINE_TRIGGER = '2';       // "trigger"
  static _MACHINE_CALLBACK = '3';      // "callback"

  static _MACHINE_ACTION = '1';        // "action"
  static _ACTION_CLASSLIST = '2';      // "class_list"
  static _ACTION_SETTIMEOUT = '3';     // "setTimeout"

  _machine;
  _dataKey;
  _elements = new Set();               // Managed elements
  _timeouts = new Map();               // Managed timeouts

  static checkMachine(machine) {
    if (!machine)
      throw new Error('Invalid machine: expected non-null/empty/undefined machine, got:', machine);
    if (!machine[this.constructor._MACHINE_INIT])
      throw new Error(`Invalid machine: expected non-null/empty/undefined machine[this.constructor._MACHINE_INIT] (machine[${this.constructor._MACHINE_INIT}]), got:`, machine);
    if (!machine[this.constructor._MACHINE_INIT])
      throw new Error(`Invalid machine: expected non-null/empty/undefined machine[this.constructor._MACHINE_INIT][this.constructor._MACHINE_STATE] (machine[${this.constructor._MACHINE_INIT}][${this.constructor._MACHINE_STATE}]), got:`, machine);
    if (!machine[this.constructor._MACHINE_STATES])
      throw new Error(`Invalid machine: expected non-null/empty/undefined machine[this.constructor._MACHINE_STATES] (machine[${this.constructor._MACHINE_STATES}]), got:`, machine);
  }

  constructor(machine, dataKey) {
    this.constructor.checkMachine(machine);
    this._machine = machine;
    this._dataKey = dataKey;
  }

  setElementData(elt, data) {
    if (elt) elt[dataKey] = data;
  }

  getElementData(elt) {
    return elt?.[dataKey];
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
    for (const category of Object.keys(timeouts ?? {})) {
      this._timeouts[category] = this._timeouts[category] || new Map();
    }
  }

  getElementTimeouts(elt) {
    return this.getElementData(elt)?.timeouts;
  }

  getElements() {
    return this._elements;
  }

  getTimeouts(category) {
    return this._timeouts[category];
  }

  initElementState(elt, callbacks, timeouts) {
    this.setElementData(elt, {});
    this.setElementState(elt, this._machine[this.constructor._MACHINE_INIT][this.constructor._MACHINE_STATE]);
    this.setElementCallbacks(elt, callbacks);
    this.setElementTimeouts(elt, timeouts);
    this._elements.add(elt);
  }

  removeElement(elt) {
    this._elements.delete(elt);
  }

  getElementCurrentState(elt) {
    return this._machine[this.constructor._MACHINE_STATES][this.getElementState(elt)];
  }

  getElementCurrentActions(elt) {
    return this.getElementCurrentState(elt)?.[this.constructor._MACHINE_ACTIONS];
  }

  getElementNextState(elt, trigger) {
    return this.getElementCurrentState(elt)?.[this.constructor._MACHINE_NEXTS].find(next => next[this.constructor._MACHINE_TRIGGER] === trigger);
  }

  activateElementNextStateFromEvent(trigger, evt) {
    return this.activateElementNextState(evt.currentTarget, trigger, evt);
  }

  activateElementNextState(elt, trigger, evt) {
    if (elt) {
      const nextState = this.getElementNextState(elt, trigger);
      if (nextState) {

        // Change element to next state
        this.setElementState(elt, nextState[this.constructor._MACHINE_STATE]);

        // Update element
        for (const action of (this.getElementCurrentActions(elt) ?? [])) {
          const actionName = action[this.constructor._MACHINE_ACTION];

          // Update element classes
          const actionClassList = action[this.constructor._ACTION_CLASSLIST];
          if (actionClassList) {
            if (actionName === this.constructor._MACHINE_ACTION_ADD) elt.classList.add(...actionClassList);
            if (actionName === this.constructor._MACHINE_ACTION_REMOVE) elt.classList.remove(...actionClassList);
          }

          // Update element timeouts
          const actionSetTimeout = action[this.constructor._ACTION_SETTIMEOUT];
          if (actionSetTimeout) {
            if (actionName === this.constructor._MACHINE_ACTION_ADD) this.addElementTimeouts(evt, elt, ...actionSetTimeout);
            if (actionName === this.constructor._MACHINE_ACTION_REMOVE) this.removeElementTimeouts(evt, elt, ...actionSetTimeout);
          }
        }

        // Execute associated callback (when present)
        const callback = this.getElementCallbacks(elt)?.[nextState[this.constructor._MACHINE_CALLBACK]];
        if (callback) callback(elt, evt);
      }
      return !!nextState;
    }
    return false;
  }

  addElementTimeouts(evt, elt, actionTimeouts) {
    const elementTimeouts = this.getElementTimeouts(elt);
    for (const actionTimeout of (actionTimeouts ?? [])) {
      const elementTimeout = elementTimeouts?.[actionTimeout];
      const timeouts = this.getTimeouts(actionTimeout);
      if (elementTimeout) this.addElementTimeout(evt, elementTimeout, timeouts);
    }
  }

  removeElementTimeouts(evt, elt, actionTimeouts) {
    const elementTimeouts = this.getElementTimeouts(elt);
    for (const actionTimeout of (actionTimeouts ?? [])) {
      const elementTimeout = elementTimeouts?.[actionTimeout];
      const timeouts = this.getTimeouts(actionTimeout);
      if (elementTimeout) this.removeTimeout(evt, elementTimeout, timeouts);
    }
  }

  addElementTimeout(evt, elementTimeout, timeouts) {
    const timeoutId = evt.pointerId;
    timeouts.set(timeoutId, {
      "was-ran": false,                                  // true when action was executed
      "timeout": this.createTimeout(evt, elementTimeout, timeouts, timeoutId)   // when it expires, triggers the associated inner callback to run the action
    });
  }

  createTimeout(evt, elementTimeout, timeouts, timeoutId) {
    const callback = elementTimeout.callback;
    const delay = elementTimeout.delay;
    return setTimeout(() => {
      const timeoutEntry = timeouts.get(timeoutId);

      // When no entry: element state changed before timeout (released, moved, ...)
      if (timeoutEntry && !timeoutEntry["was-ran"]) {
        timeoutEntry["was-ran"] = true;
        if (callback) callback(evt);
      }
    }, delay); // timeout duration
  }

  removeTimeout(evt, elementTimeout, timeouts) {
    const timeoutId = evt.pointerId;
    const timeout = timeouts.get(timeoutId)?.["timeout"];
    if (timeout) clearTimeout(timeout);
    timeouts.delete(timeoutId);
  }

}
