# zero-hid-ha
Home Assistant integration for zero-hid project

# How it works
- A persistent client that can receive commands over a WebSocket.
- A Home Assistant custom integration to register a move service.
- A frontend card that acts as a trackpad and sends pointer deltas.
 
# Installation
Install zero-hid on your Raspberry Pi: 
(zero-hid installation)[https://github.com/cgu-tech/zero-hid]

Add this card to your Lovelace dashboard via **Manual Card**:
```yaml
type: custom:trackpad-card
```

Ensure the file is served by HA frontend:
Add this to your `configuration.yaml`:
```yaml
frontend:
  extra_module_url:
    - /local/trackpad-card.js
```

Put `trackpad-card.js` in `/config/www/`.
