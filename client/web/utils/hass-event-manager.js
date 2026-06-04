import { Globals } from './globals.js';
import { Logger } from './logger.js';

// Define HassEventManager helper class
export class HassEventManager {

  _origin;
  _hassEventsCallbacks = new Map(); // event -> Set(fn)
  _managedCallbacks = new Map();
  _unsubscriptions = new Map();     // event -> unsubscribe fn
  _inflightSubscriptions = new Map(); // For subscribing state tracking
  _runner = Promise.resolve(); // serialization gate
  _connected = false;
  _isManaged = false; // indicates whether or not this event manager origin card is managed by another card (and transitively whether or not some events managements should be delegated to the manager card of the origin card)

  constructor(origin) {
    this._origin = origin;
  }

  getLogger() {
    return this._origin?.getLogger();
  }

  getHass() {
    return this._origin?.getHass();
  }

  setManaged(managed) {
    const managedUpdated = !((!!this._isManaged) === (!!managed));
    this._isManaged = managed;
    if (managedUpdated) this.updateListeners();
  }

  isManaged() {
    return this._isManaged;
  }

  hassCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("hassCallback()"));
    this.onUpdateHassListeners();
  }

  connectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("connectedCallback()"));
    this.onConnectHassListeners();
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this.onDisconnectHassListeners();
  }

  updateListeners() {
    this.scheduleNext(async () => {
      await this.disconnectHassListeners();
      if (this._connected)
        await this.connectHassListeners();
    });
  }

  onUpdateHassListeners() {
    this.updateListeners();
  }

  onConnectHassListeners() {
    this._connected = true;
    this.scheduleNext(async () => await this.connectHassListeners());
  }

  onDisconnectHassListeners() {
    this._connected = false;
    this.scheduleNext(async () => await this.disconnectHassListeners());
  }

  async connectHassListeners() {
    for (const eventName of Array.from(this._hassEventsCallbacks.keys())) {
      await this.subscribeHassEvents(eventName);
    }
  }

  async disconnectHassListeners() {
    for (const eventName of Array.from(this._unsubscriptions.keys())) {
      await this.unsubscribeHassEvent(eventName);
    }
  }

  addHassEventListener(eventName, callback) {
    this.scheduleNext(async () => {
      if (!this._hassEventsCallbacks.has(eventName)) {
        this._hassEventsCallbacks.set(eventName, new Set());
      }
  
      this._hassEventsCallbacks.get(eventName).add(callback);
  
      // ensure subscription exists
      await this.subscribeHassEvents(eventName);
    });
  }

  removeHassEventListener(eventName, callback) {
    this.scheduleNext(async () => {
      const hassEventCallbacks = this._hassEventsCallbacks.get(eventName);
      if (!hassEventCallbacks) return;
  
      hassEventCallbacks.delete(callback);
  
      if (hassEventCallbacks.size === 0) {
        this._hassEventsCallbacks.delete(eventName);
        await this.unsubscribeHassEvent(eventName);
      }
    });
  }

  scheduleNext(asyncFunction) {
    this._runner = this._runner
      .then(() =>
        Promise.resolve(asyncFunction()).catch((err) => {
          if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error("scheduleNext(asyncFunction): error resolving promise for asyncFunction", asyncFunction, err));
        })
      )
      .catch((err) => {
        if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("scheduleNext(asyncFunction): promise chain recovery", asyncFunction, err));
      });
    return this._runner;
  }

  async subscribeHassAdminEvents(eventName) {
    if (this.isManaged()) return; // Fail fast when managed (to avoid subscribing event multiple times)
    if (!this._connected) return; // Fail fast when not connected (to avoid subscribing event when disconnected)
    if (this._unsubscriptions.has(eventName)) return;

    if (this._inflightSubscriptions?.has(eventName)) return;
    this._inflightSubscriptions.set(eventName, true);

    try {
      const hass = this.getHass();
      if (hass) {
        const managedCallback = this.getManagedCallback(eventName);
        const unsubscribe = await hass.connection.subscribeEvents(managedCallback, eventName);
        this._unsubscriptions.set(eventName, unsubscribe);
      } else {
        if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("subscribeHassAdminEvents(eventName): event not attached to hass buss (hass is undefined)", eventName));
      }
    } finally {
      this._inflightSubscriptions.delete(eventName);
    }
  }

  async subscribeHassEvents(eventName) {
    if (this.isManaged()) return; // Fail fast when managed (to avoid subscribing event multiple times)
    if (!this._connected) return; // Fail fast when not connected (to avoid subscribing event when disconnected)
    if (this._unsubscriptions.has(eventName)) return;

    if (this._inflightSubscriptions?.has(eventName)) return;
    this._inflightSubscriptions.set(eventName, true);

    try {
      const hass = this.getHass();
      if (hass) {
        const managedCallback = this.getManagedCallback(eventName);
        const unsubPromise = await hass.connection.subscribeMessage(managedCallback, {type: `${eventName}/subscribe_events`});
        const unsubscribe = await unsubPromise;
        this._unsubscriptions.set(eventName, unsubscribe);
      } else {
        if (this.getLogger().isWarnEnabled()) console.warn(...this.getLogger().warn("subscribeHassEvents(eventName): event not attached to hass buss (hass is undefined)", eventName));
      }
    } finally {
      this._inflightSubscriptions.delete(eventName);
    }
  }

  getManagedCallback(eventName) {
    if (!this._managedCallbacks.has(eventName)) {
      this._managedCallbacks.set(
        eventName,
        (evt) => this.onHassEventManagedCallback(eventName, evt)
      );
    }
    return this._managedCallbacks.get(eventName);
  }

  onHassEventManagedCallback(eventName, evt) {
    if (this.isManaged()) return; // Fail fast when managed (to avoid raising event multiple times)
    const callbacks = this._hassEventsCallbacks.get(eventName);
    if (!callbacks) return;

    const managedEvt = new Event("hassbus");
    managedEvt.name = eventName;
    managedEvt.detail = evt;
    for (const callback of callbacks) {
      try {
        callback(managedEvt); // synchronous callback
      } catch (err) {
        if (this.getLogger().isErrorEnabled()) console.error(...this.getLogger().error("onHassEventManagedCallback(eventName, evt): error while excuting callback(managedEvt)", eventName, evt, callback, managedEvt, err));
      }
    }
  }

  async unsubscribeHassEvent(eventName) {
    const unsubscribe = this._unsubscriptions.get(eventName);
    if (!unsubscribe) return;
    unsubscribe();
    this._unsubscriptions.delete(eventName);
  }

}
