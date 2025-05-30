# HA zero-hid
Home Assistant (HA) integration for zero-hid project

# What it does
Transform your RPI zero as a mouse remote controlled through HA Lovelace UI. 
The mouse can be used for whatever end-device to be remote controlled (AndroidTV, computer, ...).

`Project status`: beta stage, fully working mouse with trackpad card. Manual installation. Trackpad card cannot be customized.

# What do you need
- A running Home Assistant instance
- A Raspberry Pi that will be used as USB gadget - should be distinct from Home Assistant host. The project is tested on RPI zero 2W, but might work on RPI 4 too.
- An end-device to be remote controlled. The end-device should natively support mouse. 
When in doubt and before going any further, test with a real mouse directly plugged in the end-device and check if cursor moves.

**Important:** both Home Assistant host and Raspberry Pi should be connected to the same network and able to communicate between each-other:
- ping Raspberry Pi from HA using ssh addon
- ping HA instance from Raspberry Pi using ssh client (ex: Putty). 

Adjust your network settings until both pings succeed.

# How it works
```
 _______________________________________        _____________________________________       _____________________________________ 
|   HA instance (ex: RPI 4, RPI 5, VM)  |      |   USB gadget (ex: RPI zero 2W)      |     |   END-DEVICE (ex: AndroidTV, PC)    |
|    |_ ha-zero-hid                     |      |    |_ zero-hid                      | USB |                                     |
|      |_ trackpad_mouse (integration)  | WIFI |       |_USB HID gadget          <------------>                                  |
|          |_ websockets client    <--------------> |_ websockets server             |     |                                     |
|      |_ trackpad_card (lovelace card) |      |                                     |     |                                     |
|_______________________________________|      |_____________________________________|     |_____________________________________|
```

- HA instance :
  - A frontend card that acts as a trackpad and sends pointer deltas.
  - A Home Assistant custom integration to send trackpad pointers deltas to USB gadget through a lightweight websockets client

- USB gadget :
  - A zero-hid install that enable USB-gadget on RPI zero 2W
  - A lightweight websockets servers that :
    - receives trackpad pointer deltas from HA instance
    - passes those deltas to zero-hid, thus effectively moving mouse on the end-device

# Installation

## On your USB gadget (RPI zero 2W)

### Install USB gadget module

Follow zero-hid USB gadget module [install instructions](https://github.com/thewh1teagle/zero-hid/tree/main/usb_gadget#usb-gadget-module-configuration-for-zero-hid)

### Install websockets server

Retrieve latest version:
```bash
(sudo rm -rf ha-zero-hid >/dev/null 2>&1 || true) && git clone -b main https://github.com/cgu-tech/ha-zero-hid.git
```

Go to install script directory:
```bash
cd ha-zero-hid/server/
```

Run the install script:
```bash
sudo /bin/bash install.sh
```
**Note:**
- in case of an upgrade, uninstall first when prompted, then run the install script again.
- system user `ha_zero_hid` will automatically be created by install script. It is a non-interractive user that serves to run the webserver.

## On your HA instance (use ssh HA add-on of your choice)

#### Clone this repository
```bash
(rm -rf ha-zero-hid >/dev/null 2>&1 || true) && git clone -b main https://github.com/cgu-tech/ha-zero-hid.git
```

#### Install `trackpad_mouse` integration
```bash
(rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true) && cp -R ha-zero-hid/custom_components /config
(rm /config/www/trackpad-card.js >/dev/null 2>&1 || true) && cp -R ha-zero-hid/www /config
```

#### Setup your zero-hid server IP into the integration (i.e. your RPI zero IP)
```bash
read -p "RPI IP: " websocket_server_ip && sed -i "s/<websocket_server_ip>/${websocket_server_ip}/g" /config/custom_components/trackpad_mouse/__init__.py
```

#### Ensure `trackpad_mouse` integration is loaded into your configuration
Add this to your `configuration.yaml`:
```bash
nano /config/configuration.yaml
```
```yaml
trackpad_mouse:
```

#### Add custom card into HA ressources
- Click your profile picture (bottom left)
- Enable "Advanced Mode" if it's not already enabled
- Then go to: `Settings` → `Dashboards` → (`⋮` on your dashboard) → `Resources`
- Click "Add Resource"
  - URL: /local/trackpad-card.js
  - Type: JavaScript Module
  - reload the dashboard (`CTRL` + `F5`)

Reboot Home Assistant **(not reload)**

#### Add custom card into Lovelace dashboard
- Click add a card
- Search for **Manual Card**
- Into yaml editor, replace `type: ""` by the following code:
```yaml
type: custom:trackpad-card
```

