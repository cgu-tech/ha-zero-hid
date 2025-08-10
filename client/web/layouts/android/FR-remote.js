export const layoutAndroidFrRemote = {
    "Name": "FR-remote",
    "layoutName": "AZERTY",
    "Description": "Contains key mappings for android keyboard AZERTY (French)",
    "rows": [
      {
        "cells": [
          { "code": "KEY_1", "label": { "normal": "1" }, "fallback": "normal" },
          { "code": "KEY_2", "label": { "normal": "2" }, "fallback": "normal", 
            "popin": [
              { "code": "KEY_GRAVE", "label": { "normal": "²", "shift": "²" } }
            ]
          },
          { "code": "KEY_3", "label": { "normal": "3" }, "fallback": "normal" },
          { "code": "KEY_4", "label": { "normal": "4" }, "fallback": "normal" },
          { "code": "KEY_5", "label": { "normal": "5" }, "fallback": "normal" },
          { "code": "KEY_6", "label": { "normal": "6" }, "fallback": "normal" },
          { "code": "KEY_7", "label": { "normal": "7" }, "fallback": "normal" },
          { "code": "KEY_8", "label": { "normal": "8" }, "fallback": "normal" },
          { "code": "KEY_9", "label": { "normal": "9" }, "fallback": "normal" },
          { "code": "KEY_0", "label": { "normal": "0" }, "fallback": "normal" }
        ]
      },
      {
        "cells": [
          { "code": "KEY_Q", "label": { "normal": "a", "shift": "A", "alt1": "+", "alt2": "`" }, 
            "popin": [
              { "code": "KEY_Q_GRAVE", "label": { "normal": "à", "shift": "À" } },
              { "code": "KEY_Q_CIRC",  "label": { "normal": "â", "shift": "Â" } },
              { "code": "KEY_Q_TILDE", "label": { "normal": "ã", "shift": "Ã" } },
              { "code": "KEY_Q_UMLAUT","label": { "normal": "ä", "shift": "Ä" } }
            ]
          },
          { "code": "KEY_W", "label": { "normal": "z", "shift": "Z", "alt1": "x",  "alt2": "~" }  },
          { "code": "KEY_E", "label": { "normal": "e", "shift": "E", "alt1": "\\", "alt2": "\\"}, 
            "popin": [
              { "code": "KEY_E_ACUTE", "label": { "normal": "é" } },
              { "code": "KEY_E_GRAVE", "label": { "normal": "è", "shift": "È" } },
              { "code": "KEY_E_CIRC",  "label": { "normal": "ê", "shift": "Ê" } },
              { "code": "KEY_E_UMLAUT","label": { "normal": "ë", "shift": "Ë" } }
            ]
          },
          { "code": "KEY_R", "label": { "normal": "r", "shift": "R", "alt1": "=", "alt2": "|" }  },
          { "code": "KEY_T", "label": { "normal": "t", "shift": "T", "alt1": "/", "alt2": "{" }  },
          { "code": "KEY_Y", "label": { "normal": "y", "shift": "Y", "alt1": "_", "alt2": "}" }, 
            "popin": [
              { "code": "KEY_Y_UMLAUT","label": { "normal": "ÿ" } }
            ]
          },
          { "code": "KEY_U", "label": { "normal": "u", "shift": "U", "alt1": "<", "alt2": "$" }, 
            "popin": [
              { "code": "KEY_U_GRAVE", "label": { "normal": "ù", "shift": "Ù" } },
              { "code": "KEY_U_CIRC",  "label": { "normal": "û", "shift": "Û" } },
              { "code": "KEY_U_UMLAUT","label": { "normal": "ü", "shift": "Ü" } },
              { "code": "KEY_U_ACUTE", "label": { "normal": "ú", "shift": "Ú" } }
            ]
          },
          { "code": "KEY_I", "label": { "normal": "i", "shift": "I", "alt1": ">", "alt2": "£" }, 
            "popin": [
              { "code": "KEY_I_CIRC",  "label": { "normal": "î", "shift": "Î" } },
              { "code": "KEY_I_UMLAUT","label": { "normal": "ï", "shift": "Ï" } },
              { "code": "KEY_I_GRAVE", "label": { "normal": "ì", "shift": "Ì" } }
            ]
          },
          { "code": "KEY_O", "label": { "normal": "o", "shift": "O", "alt1": "[", "alt2": "°" }, 
            "popin": [
              { "code": "KEY_O_CIRC",  "label": { "normal": "ô", "shift": "Ô" } },
              { "code": "KEY_O_GRAVE", "label": { "normal": "ò", "shift": "Ò" } },
              { "code": "KEY_O_TILDE", "label": { "normal": "õ", "shift": "Õ" } },
              { "code": "KEY_O_UMLAUT","label": { "normal": "ö", "shift": "Ö" } }
            ]
          },
          { "code": "KEY_P", "label": { "normal": "p", "shift": "P", "alt1": "]" }  }
        ]
      },
      {
        "cells": [
          { "code": "KEY_A",         "label": { "normal": "q", "shift": "Q", "alt1": "!" } },
          { "code": "KEY_S",         "label": { "normal": "s", "shift": "S", "alt1": "@" } },
          { "code": "KEY_D",         "label": { "normal": "d", "shift": "D", "alt1": "#" } },
          { "code": "KEY_F",         "label": { "normal": "f", "shift": "F", "alt1": "€" } },
          { "code": "KEY_G",         "label": { "normal": "g", "shift": "G", "alt1": "%" } },
          { "code": "KEY_H",         "label": { "normal": "h", "shift": "H", "alt1": "^" } },
          { "code": "KEY_J",         "label": { "normal": "j", "shift": "J", "alt1": "&" } },
          { "code": "KEY_K",         "label": { "normal": "k", "shift": "K", "alt1": "*" } },
          { "code": "KEY_L",         "label": { "normal": "l", "shift": "L", "alt1": "(" } },
          { "code": "KEY_M",         "label": { "normal": "m", "shift": "M", "alt1": ")" } }
        ]
      },
      {
        "cells": [
          { "code": "MOD_LEFT_SHIFT", "label": { "normal": "\u21EA", "shift": "\u21EA", "alt1": "1/2", "alt2": "2/2" }, "special": true, "width": "altkey" },
          { "code": "KEY_Z",          "label": { "normal": "w",      "shift": "W",      "alt1": "-" } },
          { "code": "KEY_X",          "label": { "normal": "x",      "shift": "X",      "alt1": "'" } },
          { "code": "KEY_C",          "label": { "normal": "c",      "shift": "C",      "alt1": "\"" } },
          { "code": "KEY_V",          "label": { "normal": "v",      "shift": "V",      "alt1": ":" } },
          { "code": "KEY_B",          "label": { "normal": "b",      "shift": "B",      "alt1": ";" } },
          { "code": "KEY_N",          "label": { "normal": "n",      "shift": "N",      "alt1": "," }, 
            "popin": [
              { "code": "KEY_N_TILDE", "label": { "normal": "ñ", "shift": "Ñ" } }
            ]
          },
          { "code": "KEY_QUOTE",      "label": { "normal": "'", "shift": "'", "alt1": "?" } },
          { "code": "KEY_BACKSPACE",  "label": { "normal": "\u232B" }, "special": true, "width": "altkey" }
        ]
      },
      {
        "cells": [
          { "code": "KEY_MODE",       "label": { "normal": "!#1", "shift": "!#1", "alt1": "ABC", "alt2": "ABC" }, "special": true, "width": "altkey" },
          { "code": "KEY_COMMA",      "label": { "normal": "," }, "fallback": "normal" },
          { "code": "KEY_SPACE",      "label": { "normal": " " }, "fallback": "normal", "width": "spacebar" },
          { "code": "KEY_DOT",        "label": { "normal": "." }, "fallback": "normal" },
          { "code": "KEY_ENTER",      "label": { "normal": "Entrée" }, "special": true, "width": "altkey" }
        ]
      }
    ]
};