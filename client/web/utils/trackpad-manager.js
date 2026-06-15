import { StateMachine } from './utils/state-machine.js';

export class TrackpadManager {

  // private init required constants
  static _TRACKPAD_MACHINE;

  static _TRACKPAD_STATE_ALL_INACTIVE         = '1';
  static _TRACKPAD_STATE_ONE_INACTIVE         = '2';
  static _TRACKPAD_STATE_MOVE_SINGLE          = '3';
  static _TRACKPAD_STATE_PRESS_LONG_SINGLE    = '4';
  static _TRACKPAD_STATE_TIMEOUT_SHORT_SINGLE = '5';
  static _TRACKPAD_STATE_TIMEOUT_LONG_SINGLE  = '6';
  static _TRACKPAD_STATE_MOVE_DOUBLE          = '7';
  static _TRACKPAD_STATE_PRESS_LONG_DOUBLE    = '8';
  static _TRACKPAD_STATE_TIMEOUT_SHORT_DOUBLE = '9';
  static _TRACKPAD_STATE_TIMEOUT_LONG_DOUBLE  = '10';

  static _TRACKPAD_CALLBACK_TIMEOUT_LONG_SINGLE   = '1';
  static _TRACKPAD_CALLBACK_CLICK_SHORT_SINGLE    = '2';
  static _TRACKPAD_CALLBACK_PRESS_LONG_SINGLE     = '3';
  static _TRACKPAD_CALLBACK_MOVE_START_SINGLE     = '4';
  static _TRACKPAD_CALLBACK_MOVE_SINGLE           = '5';
  static _TRACKPAD_CALLBACK_MOVE_STOP_SINGLE      = '6';
  static _TRACKPAD_CALLBACK_RELEASE_LONG_SINGLE   = '7';
  static _TRACKPAD_CALLBACK_TIMEOUT_LONG_DOUBLE   = '8';
  static _TRACKPAD_CALLBACK_CLICK_SHORT_DOUBLE    = '9';
  static _TRACKPAD_CALLBACK_PRESS_LONG_DOUBLE     = '10';
  static _TRACKPAD_CALLBACK_MOVE_START_DOUBLE     = '11';
  static _TRACKPAD_CALLBACK_MOVE_DOUBLE           = '12';
  static _TRACKPAD_CALLBACK_MOVE_STOP_DOUBLE      = '13';
  static _TRACKPAD_CALLBACK_RELEASE_LONG_DOUBLE   = '14';

  static _TRACKPAD_TIMEOUT_LONG_SINGLE = '1';
  static _TRACKPAD_TIMEOUT_LONG_DOUBLE = '2';

  static _TRACKPAD_TRIGGER_P1_DOWN                     = '1';
  static _TRACKPAD_TRIGGER_P1_MOVE                     = '2';
  static _TRACKPAD_TRIGGER_P1_UP                       = '3';
  static _TRACKPAD_TRIGGER_P2_DOWN                     = '4';
  static _TRACKPAD_TRIGGER_P2_MOVE                     = '5';
  static _TRACKPAD_TRIGGER_P2_UP                       = '6';
  static _TRACKPAD_TRIGGER_TIMEOUT_LONG_SINGLE_EXPIRED = '7';
  static _TRACKPAD_TRIGGER_TIMEOUT_LONG_DOUBLE_EXPIRED = '8';

  // Should be initialized in a static block to avoid JS engine to bug on static fields not-already-referenced otherwise
  static {
    this._TRACKPAD_MACHINE = {
      [StateMachine.INIT]: { [StateMachine.STATE]: this._TRACKPAD_STATE_ALL_INACTIVE },
      [StateMachine.STATES]: {
        [this._TRACKPAD_STATE_ALL_INACTIVE]: {
          [StateMachine.ACTIONS]: [
            { [StateMachine.ACTION]: StateMachine.ACTION_REMOVE, [StateMachine.ACTION_TYPE_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG_SINGLE, this._TRACKPAD_TIMEOUT_LONG_DOUBLE] }
          ],
          [StateMachine.NEXTS]: [
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_DOWN, [StateMachine.STATE]: this._TRACKPAD_STATE_TIMEOUT_LONG_SINGLE, [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_TIMEOUT_LONG_SINGLE }
          ]
        },
        [this._TRACKPAD_STATE_ONE_INACTIVE]: {
          [StateMachine.ACTIONS]: [
            { [StateMachine.ACTION]: StateMachine.ACTION_REMOVE, [StateMachine.ACTION_TYPE_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG_DOUBLE] }
          ],
          [StateMachine.NEXTS]: [
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_UP  , [StateMachine.STATE]: this._TRACKPAD_STATE_ALL_INACTIVE       , [StateMachine.CALLBACK]: null                                        }, // remaining pointer released (reset) 
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_MOVE, [StateMachine.STATE]: this._TRACKPAD_STATE_MOVE_SINGLE        , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_START_SINGLE   },
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P2_DOWN, [StateMachine.STATE]: this._TRACKPAD_STATE_TIMEOUT_LONG_DOUBLE, [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_TIMEOUT_LONG_DOUBLE }
          ]
        },
        [this._TRACKPAD_STATE_TIMEOUT_LONG_SINGLE]: {
          [StateMachine.ACTIONS]: [
            { [StateMachine.ACTION]: StateMachine.ACTION_ADD,    [StateMachine.ACTION_TYPE_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG_SINGLE] }
          ],
          [StateMachine.NEXTS]: [
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_TIMEOUT_LONG_SINGLE_EXPIRED, [StateMachine.STATE]: this._TRACKPAD_STATE_PRESS_LONG_SINGLE  , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_PRESS_LONG_SINGLE   },
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_MOVE                    , [StateMachine.STATE]: this._TRACKPAD_STATE_MOVE_SINGLE        , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_START_SINGLE   },
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_UP                      , [StateMachine.STATE]: this._TRACKPAD_STATE_ALL_INACTIVE       , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_CLICK_SHORT_SINGLE  },
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P2_DOWN                    , [StateMachine.STATE]: this._TRACKPAD_STATE_TIMEOUT_LONG_DOUBLE, [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_TIMEOUT_LONG_DOUBLE }
          ]
        },
        [this._TRACKPAD_STATE_TIMEOUT_LONG_DOUBLE]: {
          [StateMachine.ACTIONS]: [
            { [StateMachine.ACTION]: StateMachine.ACTION_REMOVE, [StateMachine.ACTION_TYPE_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG_SINGLE] },
            { [StateMachine.ACTION]: StateMachine.ACTION_ADD,    [StateMachine.ACTION_TYPE_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG_DOUBLE] }
          ],
          [StateMachine.NEXTS]: [
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_TIMEOUT_LONG_DOUBLE_EXPIRED, [StateMachine.STATE]: this._TRACKPAD_STATE_PRESS_LONG_DOUBLE, [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_PRESS_LONG_DOUBLE  }, 
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_MOVE                    , [StateMachine.STATE]: this._TRACKPAD_STATE_MOVE_DOUBLE      , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_START_DOUBLE  },
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_UP                      , [StateMachine.STATE]: this._TRACKPAD_STATE_ONE_INACTIVE     , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_CLICK_SHORT_DOUBLE },
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P2_MOVE                    , [StateMachine.STATE]: this._TRACKPAD_STATE_MOVE_DOUBLE      , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_START_DOUBLE  },
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P2_UP                      , [StateMachine.STATE]: this._TRACKPAD_STATE_ONE_INACTIVE     , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_CLICK_SHORT_DOUBLE }
          ]
        },
        [this._TRACKPAD_STATE_MOVE_SINGLE]: {
          [StateMachine.ACTIONS]: [
            { [StateMachine.ACTION]: StateMachine.ACTION_REMOVE, [StateMachine.ACTION_TYPE_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG_SINGLE] }
          ],
          [StateMachine.NEXTS]: [ 
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_MOVE, [StateMachine.STATE]: this._TRACKPAD_STATE_MOVE_SINGLE , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_SINGLE      }, 
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_UP  , [StateMachine.STATE]: this._TRACKPAD_STATE_ALL_INACTIVE, [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_STOP_SINGLE }
          ]
        },
        [this._TRACKPAD_STATE_MOVE_DOUBLE]: {
          [StateMachine.ACTIONS]: [
            { [StateMachine.ACTION]: StateMachine.ACTION_REMOVE, [StateMachine.ACTION_TYPE_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG_DOUBLE] }
          ],
          [StateMachine.NEXTS]: [ 
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_MOVE, [StateMachine.STATE]: this._TRACKPAD_STATE_MOVE_DOUBLE , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_DOUBLE      }, 
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_UP  , [StateMachine.STATE]: this._TRACKPAD_STATE_ONE_INACTIVE, [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_STOP_DOUBLE },
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P2_MOVE, [StateMachine.STATE]: this._TRACKPAD_STATE_MOVE_DOUBLE , [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_DOUBLE      }, 
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P2_UP  , [StateMachine.STATE]: this._TRACKPAD_STATE_ONE_INACTIVE, [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_MOVE_STOP_DOUBLE }
          ]
        },
        [this._TRACKPAD_STATE_PRESS_LONG_SINGLE]: {
          [StateMachine.ACTIONS]: [
            { [StateMachine.ACTION]: StateMachine.ACTION_REMOVE, [StateMachine.ACTION_TYPE_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG_SINGLE] }
          ],
          [StateMachine.NEXTS]: [ 
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_UP, [StateMachine.STATE]: this._TRACKPAD_STATE_ALL_INACTIVE,  [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_RELEASE_LONG_SINGLE }
          ]
        },
        [this._TRACKPAD_STATE_PRESS_LONG_DOUBLE]: {
          [StateMachine.ACTIONS]: [
            { [StateMachine.ACTION]: StateMachine.ACTION_REMOVE, [StateMachine.ACTION_TYPE_SETTIMEOUT]: [this._TRACKPAD_TIMEOUT_LONG_DOUBLE] }
          ],
          [StateMachine.NEXTS]: [ 
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P1_UP, [StateMachine.STATE]: this._TRACKPAD_STATE_ONE_INACTIVE,  [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_RELEASE_LONG_DOUBLE },
            { [StateMachine.TRIGGER]: this._TRACKPAD_TRIGGER_P2_UP, [StateMachine.STATE]: this._TRACKPAD_STATE_ONE_INACTIVE,  [StateMachine.CALLBACK]: this._TRACKPAD_CALLBACK_RELEASE_LONG_DOUBLE }
          ]
        }
      }
    };
  }

  _trackpadLongDelay = 500;               // milliseconds
  _trackpadDeadzoneHorizontalOffset = 50; // pixels (TODO: pixel agnostic unit and computation, to make user experience identical whatever the screen density is)
  _trackpadDeadzoneVerticalOffset = 50;   // pixels (TODO: same as above)

  // private properties
  _origin;
  _stateMachine;
  _trackpads = new Set(); // Managed trackpads
  _trackpadShortTimeouts = new Map();
  _trackpadLongTimeouts = new Map();

  constructor(origin) {
    this._origin = origin;
    this._stateMachine = new StateMachine(this.constructor._TRACKPAD_MACHINE, "_mngDtTrck");
  }

  getEventManager() {
    return this._origin?._eventManager;
  }

  getLogger() {
    return this._origin?._logger;
  }

  addTrackpadListeners(containerName, target, callbacks, options = null) {
    if (!target) throw new Error('Invalid target', target);

    const timeouts = {
      [this.constructor._TRACKPAD_TIMEOUT_LONG_SINGLE]:  {"delay": this._trackpadLongDelay,  "callback": this.onTrackpadLongTimeoutSingle.bind(this)},
      [this.constructor._TRACKPAD_TIMEOUT_LONG_DOUBLE]:  {"delay": this._trackpadLongDelay,  "callback": this.onTrackpadLongTimeoutDouble.bind(this)}
    };
    this._stateMachine.initElementState(target, callbacks, timeouts);

    const listeners = [];
    listeners.push(this.getEventManager().addPointerDownListenerToContainer(containerName, target, this.onTrackpadPointerDown.bind(this), options));
    listeners.push(this.getEventManager().addPointerMoveListenerToContainer(containerName, target, this.onTrackpadPointerMove.bind(this), options));
    listeners.push(this.getEventManager().addPointerLeaveListenerToContainer(containerName, target, this.onTrackpadPointerLeave.bind(this), options));
    listeners.push(this.getEventManager().addPointerCancelListenerToContainer(containerName, target, this.onTrackpadPointerCancel.bind(this), options));
    listeners.push(this.getEventManager().addPointerUpListenerToContainer(containerName, target, this.onTrackpadPointerUp.bind(this), options));
    return listeners;
  }

  onTrackpadPointerDown(evt) {
    this.onLogBefore("onTrackpadPointerDown", evt);
    this._stateMachine.setElementEventFromEvent(evt);
    const nextState = this.getNextStateFromPointerEvent(evt, this.constructor._TRACKPAD_TRIGGER_P1_DOWN, this.constructor._TRACKPAD_TRIGGER_P2_DOWN);
    this.onLogAfter("onTrackpadPointerDown", evt, nextState);
    this.activateNextStateFromPointerEvent(evt, nextState);
  }
  onTrackpadPointerMove(evt) {
    this.onLogBefore("onTrackpadPointerMove", evt);
    const currentState = this._stateMachine.getElementStateFromEvent(evt);
    if (this.isPointerMoving(evt)) {
      this._stateMachine.setElementEventFromEvent(evt);
      const nextState = this.getNextStateFromPointerEvent(evt, this.constructor._TRACKPAD_TRIGGER_P1_MOVE, this.constructor._TRACKPAD_TRIGGER_P2_MOVE);
      this.onLogAfter("onTrackpadPointerMove[MOVING]", evt, nextState);
      this.activateNextStateFromPointerEvent(evt, nextState);
    } else {
      this.onLogAfter("onTrackpadPointerMove[NOT_MOVING]", evt, null);
    }
  }
  onTrackpadPointerLeave(evt) {
    this.onLogBefore("onTrackpadPointerLeave", evt);
    const nextState = this.getNextStateFromPointerEvent(evt, this.constructor._TRACKPAD_TRIGGER_P1_UP, this.constructor._TRACKPAD_TRIGGER_P2_UP);
    this._stateMachine.clearElementEventFromEvent(evt);
    this.onLogAfter("onTrackpadPointerLeave", evt, nextState);
    this.activateNextStateFromPointerEvent(evt, nextState);
  }
  onTrackpadPointerCancel(evt) {
    this.onLogBefore("onTrackpadPointerCancel", evt);
    const nextState = this.getNextStateFromPointerEvent(evt, this.constructor._TRACKPAD_TRIGGER_P1_UP, this.constructor._TRACKPAD_TRIGGER_P2_UP);
    this._stateMachine.clearElementEventFromEvent(evt);
    this.onLogAfter("onTrackpadPointerCancel", evt, nextState);
    this.activateNextStateFromPointerEvent(evt, nextState);
  }
  onTrackpadPointerUp(evt) {
    this.onLogBefore("onTrackpadPointerUp", evt);
    const nextState = this.getNextStateFromPointerEvent(evt, this.constructor._TRACKPAD_TRIGGER_P1_UP, this.constructor._TRACKPAD_TRIGGER_P2_UP);
    this._stateMachine.clearElementEventFromEvent(evt);
    this.onLogAfter("onTrackpadPointerUp", evt, nextState);
    this.activateNextStateFromPointerEvent(evt, nextState);
  }
  onTrackpadLongTimeoutSingle(evt) {
    this.onLogBefore("onTrackpadLongTimeoutSingle", evt);
    this._stateMachine.setElementEventFromEvent(evt);
    this.onLogAfter("onTrackpadLongTimeoutSingle", evt, this.constructor._TRACKPAD_TRIGGER_TIMEOUT_LONG_SINGLE_EXPIRED);
    this._stateMachine.activateElementNextStateFromEvent(this.constructor._TRACKPAD_TRIGGER_TIMEOUT_LONG_SINGLE_EXPIRED, evt);
  }
  onTrackpadLongTimeoutDouble(evt) {
    this.onLogBefore("onTrackpadLongTimeoutDouble", evt);
    this._stateMachine.setElementEventFromEvent(evt);
    this.onLogAfter("onTrackpadLongTimeoutDouble", evt, this.constructor._TRACKPAD_TRIGGER_TIMEOUT_LONG_DOUBLE_EXPIRED);
    this._stateMachine.activateElementNextStateFromEvent(this.constructor._TRACKPAD_TRIGGER_TIMEOUT_LONG_DOUBLE_EXPIRED, evt);
  }

  isP1(pointerIndex) {
    return pointerIndex === 0;
  }

  isP2(pointerIndex) {
    return pointerIndex === 1;
  }

  getNextStateFromPointerEvent(evt, nextStateP1, nextStateP2) {
    const pointerIndex = this._stateMachine.getElementEventIndexFromEvent(evt);
    const nextState = 
      this.isP1(pointerIndex) ? nextStateP1 : (
      this.isP2(pointerIndex) ? nextStateP2 : (
      null));
    return nextState;
  }

  activateNextStateFromPointerEvent(evt, nextState) {
    if (nextState) this._stateMachine.activateElementNextStateFromEvent(nextState, evt);
  }

  isPointerMoving(evt) {
    const currentState = this._stateMachine.getElementStateFromEvent(evt);
    const hasMoveStarted = 
      (currentState === this.constructor._TRACKPAD_STATE_MOVE_SINGLE) ||
      (currentState === this.constructor._TRACKPAD_STATE_MOVE_DOUBLE);
    if (hasMoveStarted) return true;

    const prevEvt = this._stateMachine.getElementEventFromEvent(evt);
    const isMovingOutOfDeadZone = prevEvt 
      ? this._stateMachine.isDeltaFromPointerEventsGreaterThanMax(prevEvt, evt, this._trackpadDeadzoneHorizontalOffset, this._trackpadDeadzoneVerticalOffset) 
      : false;
    if (isMovingOutOfDeadZone) return true;

    return false;
  }

  onLogBefore(evtName, evt) { this.onLog(evtName, "BEFORE", evt); }
  onLogAfter(evtName, evt, nextStep) { this.onLog(evtName, "AFTER", evt, nextStep, true); }
  onLog(evtName, step, evt, nextStep = null, logNextStep = false) {
    if (this.getLogger().isTraceEnabled()) {
      const elt = this._stateMachine.getElementFromEvent(evt);
      const state = this._stateMachine.getElementStateFromEvent(evt);
      const stateEvt = this._stateMachine.createStateEvent(evt);
      const pointerIndex = this._stateMachine.getElementEventIndexFromEvent(evt);
      console.debug(...this.getLogger().trace(`${evtName}(evt)->${step}, pointerIndex=${pointerIndex}, ${logNextStep ? 'nextStep=' : ''}${logNextStep ? nextStep : ''}`, stateEvt, state, !!evt, !!elt));
    }
  }

}
