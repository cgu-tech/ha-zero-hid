# ha-zero-hid
Home Assistant integration for zero-hid project

# What it does
Transform your RPI zero as a mouse remotely driven using HA Lovelace user interface. 
The mouse can be used for whatever end device you want (AndroidTV, computer, ...)

`Current state`: beta-mode, fully working HA mouse driven by custom trackpad card. Tons of thing needs to be work on.

# What do you need
- A running Home Assistant instance
- A spare Raspberry Pi that will be used as USB gadget (tested only with RPI zero 2W, should work with RPI 4 too)
- An end-device that will be remote-controlled. The end-device should natively support mouse (test with a real mouse if worried about this point).

**Important:** both Home Assistant and spare Raspberry Pi should be connected to the same network and open to communicate between each-other:
- test ping from HA ssh addon to Raspberry Pi
- test ping from Raspberry Pi ssh to HA instance
Adjust your network until both pings succeed (if needed).

# How it works
```
 _______________________________________        _____________________________________       _____________________________________ 
|   HA instance (ex: RPI 4, RPI 5, VM)  |      |   USB gadget (ex: RPI zero 2W)      |     |   END-DEVICE (ex: AndroidTV, PC)    |
|    |_ ha-zero-hid                     |      |    |_ zero-hid                      | USB |                                     |
|      |_ trackpad_mouse (integration)  | WIFI |       |_USB HID gadget          <------------>                                  |
|          |_ websockets client    <--------------> |_ websockets server             |     |                                     |
|      |_ trackpad_card (lovelace card) |      |    |_ trackpad_card (lovelace card) |     |                                     |
|_______________________________________|      |_____________________________________|     |_____________________________________|

- HA instance :
  - A frontend card that acts as a trackpad and sends pointer deltas.
  - A Home Assistant custom integration to send trackpad pointers deltas to RPI gadget through a lightweight websockets client

- USB gadget :
  - A zero-hid install that enable USB-gadget on RPI zero 2W
  - a lightweight websockets servers that :
    - receives trackpad pointer deltas from HA instance
    - passes those deltas to zero-hid USB-gadget, resulting in mouse pointer moves visible on the end-devices
```

# Installation

## On your USB gadget (RPI zero 2W)

### Install zero-hid: 
[zero-hid installation](https://github.com/cgu-tech/zero-hid)

### Install websockets server: 

Install Python:
```bash
sudo apt-get install -y git python3-pip python3-venv
```

### Create a Python venv for the server:
```bash
python3 -m venv ~/venv_websocket
```

### Clone this repository:
```bash
(rm -rf ha-zero-hid >/dev/null 2>&1 || true) && git clone -b test/integration https://github.com/cgu-tech/ha-zero-hid.git
```

### Activate Python venv:
```bash
venv activation : source ~/venv_websocket/bin/activate
```

### Install server dependencies into venv:
```bash
pip install --editable ~/zero-hid
pip install websockets
```

### Run websockets server:
```bash
python3 ha-zero-hid/server/websockets_server.py
```

`Current state`: as of now, server will not be restarted automatically when USB-gadget shutdown (RPI zero 2w)

## On your HA instance (use HA ssh add-on of your choice)

### Clone this repository :
```bash
(rm -rf ha-zero-hid >/dev/null 2>&1 || true) && git clone -b test/integration https://github.com/cgu-tech/ha-zero-hid.git
```

### Install `trackpad_mouse` integration:
```bash
(rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true) && cp -R ha-zero-hid/custom_components /config
(rm /config/www/trackpad-card.js >/dev/null 2>&1 || true) && cp -R ha-zero-hid/www /config
```

### Setup your zero-hid server IP into the integration (i.e. your RPI zero IP):
```bash
read -p "RPI IP: " websocket_server_ip && sed -i "s/<websocket_server_ip>/${websocket_server_ip}/g" /config/custom_components/trackpad_mouse/__init__.py
```

### Ensure `trackpad_mouse` integration is loaded into your configuration:
Add this to your `configuration.yaml`:
```bash
nano /config/configuration.yaml
```
```yaml
trackpad_mouse:
```

### Add custom card into ressources via the UI:
- Click your profile picture (bottom left)
- Enable "Advanced Mode" if it's not already enabled
- Then go to: `Settings` → `Dashboards` → (`⋮` on your dashboard) → `Resources`
- Click "Add Resource"
  - URL: /local/trackpad-card.js
  - Type: JavaScript Module
  - reload the dashboard (`CTRL` + `F5`)

Reboot Home Assistant **(not reload)**

### Add this card to your Lovelace dashboard via **Manual Card**:
```yaml
type: custom:trackpad-card
```

