export const androidRemoteCardConfig = {
  "remote-button-power": {
    "code": "CON_POWER",
    "image": "icon-power",
    "image-styles": ["standard-grey", "power-icon"]
  },
  "remote-button-power-android": {
    "code": "CON_POWER",
    "image": "icon-power-android",
    "image-styles": ["standard-grey"]
  },
  "remote-button-power-shield-1": {
    "code": "CON_POWER",
    "image": "icon-power-shield-1",
    "image-styles": ["standard-grey", "shield-tv-icon"]
  },
  "remote-button-power-shield-2": {
    "code": "CON_POWER",
    "image": "icon-power-shield-2",
    "image-styles": ["standard-grey", "shield-tv-icon-2"]
  },
  "remote-button-power-tv": {
    "image": "icon-power-tv",
    "image-styles": ["standard-grey", "tv-icon"]
  },
  "remote-button-power-old-tv": {
    "image": "icon-power-old-tv",
    "image-styles": ["standard-grey", "old-tv-icon"]
  },
  "remote-button-power-device": {
    "image": "icon-power-device",
    "image-styles": ["standard-grey", "device-icon"]
  },
  "remote-button-bulb": {
    "image": "icon-light-bulb",
    "image-styles": ["standard-grey", "light-bulb"]
  },
  "remote-button-settings": {
    "code": "KEY_COMPOSE", 
    "image": "icon-settings",
    "image-styles": ["standard-grey", "settings-icon"]
  },
  "dpad": { 
    "tag": "svg"
  },
  "remote-button-arrow-up": {
    "code": "KEY_UP", 
    "image": "icon-arrow-up",
    "image-styles": ["standard-grey", "arrow-up-icon"]
  },
  "remote-button-arrow-right": {
    "code": "KEY_RIGHT", 
    "image": "icon-arrow-right",
    "image-styles": ["standard-grey", "arrow-right-icon"]
  },
  "remote-button-arrow-down": {
    "code": "KEY_DOWN", 
    "image": "icon-arrow-down",
    "image-styles": ["standard-grey", "arrow-down-icon"]
  },
  "remote-button-arrow-left": {
    "code": "KEY_LEFT", 
    "image": "icon-arrow-left",
    "image-styles": ["standard-grey", "arrow-left-icon"]
  },
  "remote-button-center": {
    "code": "KEY_ENTER"
  },
  "remote-button-return": {
    "code": "CON_AC_BACK", 
    "image": "icon-return",
    "image-styles": ["standard-grey", "return-icon"],
    "style": "side-button left",
  },
  "remote-button-home": {
    "code": "CON_AC_HOME",
    "image": "icon-home",
    "image-styles": ["standard-grey", "home-icon"],
    "style": "side-button right"
  },
  "remote-button-keyboard": {
    "image": "icon-keyboard",
    "image-styles": ["standard-grey", "keyboard-icon"]
  },
  "remote-button-dot": {
    "image": "icon-dot",
    "image-styles": ["standard-grey", "toggle-neutral"]
  },
  "remote-button-mouse": {
    "image": "icon-mouse",
    "image-styles": ["standard-grey", "mouse-icon"]
  },
  "ts-toggle-container": {
    "tag": "div",
    "image-styles": ["keyboard-icon", "toggle-neutral", "mouse-icon"],
    "style": "ts-toggle-container", 
    "html": 
    `<div class="ts-toggle-indicator"></div>
    <div class="ts-toggle-option active">
      <svg class="keyboard-icon" viewBox="0 0 66 46" fill="none" stroke="#bfbfbf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Outer keyboard body with transparent background and stroke color #bfbfbf -->
        <rect x="1" y="1" width="64" height="44" rx="4" ry="4" fill="none" stroke="#bfbfbf" />

        <!-- Row 1 -->
        <rect x="5"  y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="15" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="25" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="35" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="45" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="55" y="5"  width="6" height="6" rx="1" fill="#bfbfbf" />

        <!-- Row 2 -->
        <rect x="5"  y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="15" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="25" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="35" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="45" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="55" y="15" width="6" height="6" rx="1" fill="#bfbfbf" />

        <!-- Row 3 -->
        <rect x="5"  y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="15" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="25" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="35" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="45" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />
        <rect x="55" y="25" width="6" height="6" rx="1" fill="#bfbfbf" />

        <!-- Spacebar row -->
        <rect x="12" y="35" width="42" height="6" rx="1" fill="#bfbfbf" />
      </svg>
    </div>
    <div class="ts-toggle-option">
      <svg class="toggle-neutral" xmlns="http://www.w3.org/2000/svg" viewBox="10 10 80 80">
        <circle cx="50" cy="50" r="40" fill="#bfbfbf" />
      </svg>
    </div>
    <div class="ts-toggle-option">
      <svg class="mouse-icon" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#bfbfbf" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
        <!-- Mouse body with rounded top and slightly rounded bottom corners -->
        <path d="
          M 20 30 
          Q 20 10, 50 10 
          Q 80 10, 80 30
          L 80 115
          Q 80 125, 70 125
          L 30 125
          Q 20 125, 20 115
          Z
        " />

        <!-- Vertical center line (split buttons) -->
        <line x1="50" y1="10" x2="50" y2="70" />

        <!-- Larger scroll wheel, moved near the top -->
        <line x1="50" y1="30" x2="50" y2="50" stroke-width="8" stroke-linecap="round" />

        <!-- Cable (wire) -->
        <path d="M50 130 C 50 140, 60 145, 70 150" />
      </svg>
    </div>`
  },
  "remote-button-backspace": {
    "code": "KEY_BACKSPACE",
    "image": "icon-backspace",
    "image-styles": ["standard-grey", "backspace-icon"]
  },
  "foldable-container": {
    "tag": "div"
  },
  "remote-button-track-previous": {
    "code": "CON_SCAN_PREVIOUS_TRACK",
    "image": "icon-track-previous",
    "image-styles": ["standard-grey", "previous-track-icon"]
  },
  "remote-button-play-pause": {
    "code": "CON_PLAY_PAUSE",
    "image": "icon-play-pause",
    "image-styles": ["standard-grey", "play-pause-icon"]
  },
  "remote-button-track-next": {
    "code": "CON_SCAN_NEXT_TRACK",
    "image": "icon-track-next",
    "image-styles": ["standard-grey", "next-track-icon"]
  },
  "remote-button-volume-mute": {
    "code": "CON_MUTE",
    "image": "icon-volume-mute",
    "image-styles": ["standard-grey", "volumemute-icon"]
  },
  "remote-button-volume-down": {
    "code": "CON_VOLUME_DECREMENT",
    "image": "icon-volume-down",
    "image-styles": ["standard-grey", "volumedown-icon"]
  },
  "remote-button-volume-up": {
    "code": "CON_VOLUME_INCREMENT",
    "image": "icon-volume-up",
    "image-styles": ["standard-grey", "volumeup-icon"]
  },
  "remote-button-hid-server": {
    "image": "icon-hid-server"
  },
  "remote-button-air-mouse": {
    "image": "icon-air-mouse",
    "image-styles": ["standard-grey", "airmouse-icon"]
  },
  "remote-button-microphone": {
    "image": "icon-microphone",
    "image-styles": ["standard-grey", "microphone-icon"]
  },
  "remote-button-windows": {
    "image": "icon-windows",
    "image-styles": ["standard-grey", "windows-icon"]
  },
  "remote-button-switch": {
    "image": "icon-switch",
    "image-styles": ["standard-grey", "switch-icon"]
  }
};

export const androidRemoteCardStyles = {
  "power-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.4, 0.4);
  }`,
  "shield-tv-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.6, 0.6);
  }`,
  "shield-tv-icon-2": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.6, 0.6);
  }`,
  "tv-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.6, 0.6);
  }`,
  "old-tv-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "device-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "light-bulb": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "settings-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.4, 0.4);
  }`,
  "arrow-up-icon": `{
    height: 100%;
    width: auto;
    display: block;
  }`,
  "arrow-right-icon": `{
    height: 100%;
    width: auto;
    display: block;
  }`,
  "arrow-down-icon": `{
    height: 100%;
    width: auto;
    display: block;
  }`,
  "arrow-left-icon": `{
    height: 100%;
    width: auto;
    display: block;
  }`,
  "return-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.6, 0.6);
  }`,
  "home-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.6, 0.6);
  }`,
  "toggle-neutral": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.1, 0.1);
  }`,
  "mouse-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.4, 0.4) rotate(315deg);
  }`,
  "keyboard-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.4, 0.4);
  }`,
  "backspace-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.4, 0.4);
  }`,
  "previous-track-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "play-pause-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "next-track-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "volumemute-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "volumedown-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "volumeup-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "airmouse-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "microphone-icon": `{
    height: 100%;
    width: auto;  /* maintain aspect ratio */
    display: block; /* removes any inline space */
    transform: scale(0.8, 0.8);
  }`,
  "windows-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`,
  "swicth-icon": `{
    height: 100%;
    width: auto;
    display: block;
    transform: scale(0.5, 0.5);
  }`
};