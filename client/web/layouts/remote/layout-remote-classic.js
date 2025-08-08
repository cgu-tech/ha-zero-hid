export const layoutRemoteClassic = {
    "Name": "classic",
    "Description": "Contains classic default layout for android remote buttons",
    "rows": [
      {
        "cells": [
          { "name": "remote-button-power",          "weight": 1 },
          { "name": "filler",                       "weight": 4 }
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
          { "name": "remote-button-settings",       "weight": 1 }
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
          { "name": "remote-button-volume-down",    "weight": 1 },
          { "name": "remote-button-track-previous", "weight": 1 },
          { "name": "remote-button-play-pause",     "weight": 1 },
          { "name": "remote-button-track-next",     "weight": 1 },
          { "name": "remote-button-volume-up",      "weight": 1 }
        ]
      }
    ]
};