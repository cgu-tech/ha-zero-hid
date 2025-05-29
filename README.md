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
mkdir -p /config/custom_components && cp -R ha-zero-hid/trackpad_mouse /config/custom_components
```

Setup your RPI IP:
```bash
read -p "RPI IP: " websocket_server_ip && sed -i "s/<websocket_server_ip>/${websocket_server_ip}/g" /config/custom_components/trackpad_mouse/__init__.py
```

Put `trackpad-card.js` in `/config/www/`:
```bash
mkdir -p /config/www && cp -R ha-zero-hid/www /config
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

Reboot Home Assistant **(not reload)**

Add the **Trackpad Mouse** integration into HA configuration:
Add this to your `configuration.yaml`:
```bash
nano /config/configuration.yaml
```
```yaml
trackpad_mouse:
```

Reboot Home Assistant **(not reload)**

Add this card to your Lovelace dashboard via **Manual Card**:
```yaml
type: custom:trackpad-card
```
