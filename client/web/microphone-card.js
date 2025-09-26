import { Globals } from './utils/globals.js';
import { Logger } from './utils/logger.js';
import { EventManager } from './utils/event-manager.js';
import { ResourceManager } from './utils/resource-manager.js';
import { LayoutManager } from './utils/layout-manager.js';

console.info("Loading microphone-card");

export class MicrophoneCard extends HTMLElement {

  // private properties
  _config;
  _hass;
  _elements = {};
  _logger;
  _eventManager;
  _layoutManager;
  _resourceManager;

  _audioContext;
  _mediaStream;
  _sourceNode;
  _workletNode;

  constructor() {
    super();

    this._logger = new Logger(this, "microphone-card.js");
    this._eventManager = new EventManager(this);
    this._layoutManager = new LayoutManager(this, this.constructor._LAYOUTS);
    this._resourceManager = new ResourceManager(this, import.meta.url);

    this.doCard();
    this.doStyle();
    this.doAttach();
    this.doQueryElements();
    this.doListen();

    this.doUpdateLayout();
  }

  getLogger() {
    return this._logger;
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
  }

  disconnectedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("disconnectedCallback()"));
    this._eventManager.disconnectedCallback();
  }

  adoptedCallback() {
    if (this.getLogger().isDebugEnabled()) console.debug(...this.getLogger().debug("adoptedCallback()"));
  }

  // jobs
  doCheckConfig() {
    this._layoutManager.checkConfiguredLayout();
  }

  doCard() {
    this._elements.card = document.createElement("ha-card");
    this._elements.card.innerHTML = `
      <div>
        <button class="micro-start">Start</button>
        <button class="micro-stop" disabled>Stop</button>
        <p class="micro-status">Status: Idle</p>
      </div>
    `;
  }

  doStyle() {
    this._elements.style = document.createElement("style");
    this._elements.style.textContent = `
      <style>
        button {
          margin-right: 10px;
          padding: 8px 16px;
          font-size: 14px;
        }
        p {
          margin-top: 10px;
          font-size: 14px;
          color: var(--primary-text-color);
        }
      </style>
    `;
  }

  doAttach() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(this._elements.style, this._elements.card);
  }

  doQueryElements() {
    const card = this._elements.card;
    this._elements.startBtn = card.querySelector(".micro-start");
    this._elements.stopBtn = card.querySelector(".micro-stop");
    this._elements.statusLbl = card.querySelector(".micro-status");
  }

  doListen() {
    this._eventManager.addButtonListeners("layoutContainer", this._elements.startBtn, 
      {
        [this._eventManager.constructor._BUTTON_CALLBACK_RELEASE]: this.onStartButtonRelease.bind(this)
      }
    );
    this._eventManager.addButtonListeners("layoutContainer", this._elements.stopBtn, 
      {
        [this._eventManager.constructor._BUTTON_CALLBACK_RELEASE]: this.onStopButtonRelease.bind(this)
      }
    );
  }

  async onStartButtonRelease(btn, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    
    const startBtn = this._elements.startBtn;
    const stopBtn = this._elements.stopBtn;
    const statusLbl = this._elements.statusLbl;
    try {
      statusLbl.textContent = "Starting...";
      startBtn.disabled = true;
      stopBtn.disabled = false;

      this._audioContext = new AudioContext(); // Let browser decide

      await this._audioContext.audioWorklet.addModule(URL.createObjectURL(new Blob([`
        class MicProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.inputSampleRate = sampleRate; // whatever the browser gives us
            this.outputSampleRate = 16000;
            this.ratio = this.inputSampleRate / this.outputSampleRate;
          }
        
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0) {
              const channelData = input[0];
              const resampledLength = Math.floor(channelData.length / this.ratio);
              const resampled = new Float32Array(resampledLength);
              for (let i = 0; i < resampledLength; i++) {
                const index = Math.floor(i * this.ratio);
                resampled[i] = channelData[index];
              }
        
              const pcm = new Int16Array(resampled.length);
              for (let i = 0; i < resampled.length; i++) {
                let s = Math.max(-1, Math.min(1, resampled[i]));
                pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
        
              this.port.postMessage(pcm.buffer, [pcm.buffer]);
            }
            return true;
          }
        }
        registerProcessor('mic-processor', MicProcessor);
      `], { type: 'application/javascript' })));

      this._mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._sourceNode = this._audioContext.createMediaStreamSource(this._mediaStream);
      this._workletNode = new AudioWorkletNode(this._audioContext, 'mic-processor');

      this._sourceNode.connect(this._workletNode);
      this._workletNode.connect(this._audioContext.destination);

      this._workletNode.port.onmessage = (event) => {
        if (event.data) {
          // Send audio data to HA
          const buffer = Array.from(new Uint8Array(event.data));
          this.sendAudio(buffer);
        }
      };

      // Start stream notification
      //this._hass.connection.sendMessage({
      //  type: "your_integration/start_stream"
      //});

      statusLbl.textContent = "Streaming audio...";
    } catch (err) {
      statusLbl.textContent = "Error: " + err.message;
      this.stopMicrophone();
    }

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  async onStopButtonRelease(btn, evt) {
    this._eventManager.preventDefault(evt); // prevent unwanted focus or scrolling
    
    statusLbl.textContent = "Stopping...";
    this.stopMicrophone();
    statusLbl.textContent = "Stopped.";

    // Send haptic feedback to make user acknownledgable of succeeded event
    this._layoutManager.hapticFeedback();
  }

  stopMicrophone() {
    const startBtn = this._elements.startBtn;
    const stopBtn = this._elements.stopBtn;

    startBtn.disabled = false;
    stopBtn.disabled = true;

    //this._hass?.connection.sendMessage({
    //  type: "your_integration/stop_stream"
    //});

    if (this._audioContext) {
      this._audioContext.close();
    }
    this._audioContext = null;

    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach(track => track.stop());
    }
    this._mediaStream = null;

    if (this._sourceNode) {
      this._sourceNode.disconnect();
    }
    if (this._workletNode) {
      this._workletNode.disconnect();
    }
    this._sourceNode = null;
    this._workletNode = null;
  };

  doUpdateConfig() {
    if (this._layoutManager.configuredLayoutChanged()) {
      this.doUpdateLayout();
    }
  }

  doUpdateHass() {
    // Nothing to do here: no specific HA entity state to listen for this card
  }

  doUpdateLayout() {
    this.doResetLayout();
    this.doCreateLayout();
    this.doAttachLayout();
  }

  doResetLayout() {
    // Reset attached layout
    this._layoutManager.resetAttachedLayout();
  }

  doCreateLayout() {
    // Mark configured layout as attached
    this._layoutManager.configuredLayoutAttached();
  }

  doAttachLayout() {
  }

  // configuration defaults
  static getStubConfig() {
    return {
      layout: "",
      haptic: true,
      log_level: "warn",
      log_pushback: false
    };
  }

  getCardSize() {
    return 3;
  }

  sendAudio(buffer) {
    this._eventManager.callComponentServiceWithServerId("aux", { "buf": buffer, });
  }

}

if (!customElements.get("microphone-card")) customElements.define("microphone-card", MicrophoneCard);
