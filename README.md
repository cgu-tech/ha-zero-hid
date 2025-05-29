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
(rm -rf ha-zero-hid >/dev/null 2>&1 || true) && git clone https://github.com/cgu-tech/ha-zero-hid.git
```

Install `trackpad_mouse` integration:
```bash
(rm -rf /config/addons/trackpad_ws >/dev/null 2>&1 || true) && cp -R ha-zero-hid/addons /config
```

Setup your zero-hid server IP (i.e. your RPI zero IP):
```bash
read -p "RPI IP: " websocket_server_ip && sed -i "s/<websocket_server_ip>/${websocket_server_ip}/g" /config/addons/trackpad_ws/run.py
```

Reboot Home Assistant **(not reload)**

Install `trackpad_mouse` integration:
```bash
(rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true) && cp -R ha-zero-hid/custom_components /config
(rm /config/www/trackpad-card.js >/dev/null 2>&1 || true) && cp -R ha-zero-hid/www /config
```

Ensure `trackpad_mouse` integration is loaded into your configuration:
Add this to your `configuration.yaml`:
```bash
nano /config/configuration.yaml
```
```yaml
frontend:
  extra_module_url:
    - /local/trackpad-card.js

trackpad_mouse:
```

Reboot Home Assistant **(not reload)**

Add this card to your Lovelace dashboard via **Manual Card**:
```yaml
type: custom:trackpad-card
```
