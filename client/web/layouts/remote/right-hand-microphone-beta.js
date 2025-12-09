export const layoutRemoteRightHandMicrophoneBeta = {
    "Name": "right-hand-v6",
    "Description": "Contains extended right-handed layout for android remote buttons",
    "rows": [
      {
        "cells": [
          { "name": "remote-button-power-tv",       "weight": 1 },
          { "name": "remote-button-power-shield-1", "weight": 1 },
          { "name": "remote-button-power-device",   "weight": 1 },
          { "name": "remote-button-settings",       "weight": 1 },
          { "name": "remote-button-bulb",           "weight": 1 },
        ]
      },
      {
        "filler-top": 1,
        "cells": [
          { "name": "filler",                       "weight": 0.5 },
          { "name": "dpad",                         "weight": 4 },
          { "name": "filler",                       "weight": 0.5 }
        ]
      },
      {
        "filler-top": 1,
        "filler-bottom": 1,
        "cells": [
          { "name": "filler"              ,         "weight": 0.5 },
          { "name": "remote-button-return",         "weight": 2   },
          { "name": "remote-button-home"  ,         "weight": 2   },
          { "name": "filler"              ,         "weight": 0.5 }
        ]
      },
      {
        "filler-top": 1,
        "filler-bottom": 1,
        "cells": [
          { "name": "remote-button-backspace",      "weight": 1 },
          { "name": "ts-toggle-container",          "weight": 3 },
          { "name": "remote-button-microphone",     "weight": 1 },
        ]
      },
      {
        "no-gap": true,
        "cells": [
          { "name": "foldable-container",           "weight": 5 }
        ]
      },
      {
        "cells": [
          { "name": "remote-button-play-pause",     "weight": 1 },
          { "name": "remote-button-hid-server",     "weight": 1 },
          { "name": "remote-button-volume-mute",    "weight": 1 },
          { "name": "remote-button-volume-down",    "weight": 1 },
          { "name": "remote-button-volume-up",      "weight": 1 }
        ]
      }
    ]
}