# zero-hid-ha
Home Assistant integration for zero-hid project

# How it works
- A persistent client that can receive commands over a WebSocket.
- A Home Assistant custom integration to register a move service.
- A frontend card that acts as a trackpad and sends pointer deltas.
 
# Installation
Install zero-hid on your Raspberry Pi: 
[zero-hid installation](https://github.com/cgu-tech/zero-hid)

Using HA SSH addon, clone this repository:
```bash
git clone https://github.com/cgu-tech/ha-zero-hid.git
```

Put `trackpad_mouse` directory in `/config/custom_components`:
```bash
mkdir -p /config/custom_components && cp ha-zero-hid/trackpad_mouse /config/custom_components
```

Put `trackpad-card.js` in `/config/www/`:
```bash
mkdir -p /config/www && cp ha-zero-hid/trackpad-card.js /config/www/trackpad-card.js
```

Ensure the file is served by HA frontend:
Add this to your `configuration.yaml`:
```bash
nano /config/configuration.yaml
```
```yaml
frontend:
  extra_module_url:
    - /local/trackpad-card.js
```


Add this card to your Lovelace dashboard via **Manual Card**:
```yaml
type: custom:trackpad-card
```
