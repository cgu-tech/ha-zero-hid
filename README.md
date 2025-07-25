# HA zero-hid
Home Assistant (HA) integration for zero-hid project

# What it does
Transform your Raspberry Pi zero into a remote mouse controlled through Home Assistant dashboard (Lovelace UI). 
The mouse can be used to control whatever end-device that accept standard USB mouse (AndroidTV, computer, ...).

`Project status`:
- beta stage
- 5 HomeAssistant cards:
  - Trackpad with mouse, left click, middle click, right click, horizontal sroll, vertical scroll
  - Arrowpad with left, up, right, down arrows keys
  - Windows keyboard with keyboard layouts (US qwerty + FR azerty)
  - Android keyboard with keyboard layouts (US qwerty + FR azerty)
  - Android remote control with android functions, trackpad and simplified keyboard layouts (US qwerty + FR azerty)
- Optionnal haptic feedback support
- manual installation
- dedicated cards cannot be customized

# What's needed
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
|   HA instance (ex: RPI 4, RPI 5, VM)  |      |   USB gadget (ex: RPI zero 2W)      |     |   End-device (ex: AndroidTV, PC)    |
|    |_ ha-zero-hid                     |      |    |_ zero-hid                      | USB |                                     |
|      |_ trackpad_mouse (integration)  | WIFI |       |_USB HID gadget          <------------>                                  |
|          |_ websockets client    <--------------> |_ websockets server             |     |                                     |
|      |_ trackpad_card (lovelace card) |      |                                     |     |                                     |
|_______________________________________|      |_____________________________________|     |_____________________________________|
```

- HA instance :
  - A frontend card that acts as a trackpad and sends pointer deltas
  - A Home Assistant custom integration to send trackpad pointers deltas to USB gadget through a lightweight websockets client

- USB gadget :
  - A zero-hid install that enable USB-gadget on RPI zero 2W
  - A lightweight websockets servers that:
    - receives trackpad pointer deltas from HA instance
    - passes those deltas to zero-hid, thus effectively moving mouse on the end-device

- End-device :
  - Any mouse controllable device, to be remote controlled

# How to install

## On USB gadget device (RPI zero 2W)

### Install USB gadget module

Retrieve latest version of zero-hid repository:
```bash
cd ~ && (sudo rm -rf zero-hid >/dev/null 2>&1 || true) && git clone -b main https://github.com/cgu-tech/zero-hid.git
```

Execute gadget install script (reboot at the end):
```bash
cd ~/zero-hid/usb_gadget && sudo ./installer
```

### Install websockets server

Retrieve latest version of this repository:
```bash
cd ~ && (sudo rm -rf ha-zero-hid >/dev/null 2>&1 || true) && git clone -b main https://github.com/cgu-tech/ha-zero-hid.git
```

Execute server install script:
```bash
cd ~/ha-zero-hid/server/ && sudo /bin/bash install.sh
```
**Parameters:**
- **optional** \[branch\]: the target zero-hid branch (default: "main", example: "feat/add-acback")
- **optional** \[skip_package\]: when set to non-empty string, skips system package manager updates and installations to speedup installation (default: "", example: "skip_package")

**Note:**
- in case of an upgrade, choose "reinstall or update".
- a system user `ha_zero_hid` will be automatically created during installation. It is required to run the webserver.

## On your HA instance

### Enable Advanced mode into HA
- Click your profile picture (bottom left)
- Enable "Advanced Mode" if it's not already enabled

### Install SSH add-on into HA
- Click `Settings` → `Add-ons store` → search `Terminal & SSH`
- Install `Terminal & SSH` add-on
- In the add-on details page, find the toggle:
  - `Start on boot` → Enable this
  - `Show in sidebar` → Enable this
  - Hit `Start`

### Install HA websockets client integration, HA custom trackpad card
Open SSH session from `Terminal & SSH` add-on

Retrieve latest version of this repository:
```bash
cd ~ && (rm -rf ha-zero-hid >/dev/null 2>&1 || true) && cd && git clone -b main https://github.com/cgu-tech/ha-zero-hid.git
```

Execute client install script as root (default shell on `Terminal & SSH` add-on):
```bash
cd ~/ha-zero-hid/client/ && /bin/bash install.sh
```

**Note:**
- in case of an upgrade, uninstall first when prompted, then run the install script again.

### Add custom cards into HA ressources
- Go to: `Settings` → `Dashboards` → (`⋮` on your dashboard) → `Resources`
- Click `Add Resource`

| URL                               | Resource type       |
| --------------------------------- | ------------------- |
| `/local/trackpad-card.js`         | `JavaScript Module` |
| `/local/arrowpad-card.js`         | `JavaScript Module` |
| `/local/windows-keyboard-card.js` | `JavaScript Module` |
| `/local/android-keyboard-card.js` | `JavaScript Module` |
| `/local/carrousel-card.js`        | `JavaScript Module` |
| `/local/android-remote-card.js`   | `JavaScript Module` |

Reboot Home Assistant **(not reload)**

### Add custom cards into your Lovelace dashboard(s)
- Go to your dashboard > Edit dashboard
- Click `add a card`
- Search for **Manual Card**
- Into yaml editor, replace `type: ""` by the following code according to your needs:

#### Trackpad card
```yaml
type: custom:trackpad-card
```

#### Arrowpad card
```yaml
type: custom:arrowpad-card
```

#### Windows keyboard card
```yaml
type: custom:windows-keyboard-card
layoutUrl: /local/layouts/windows/US.json
```

#### Android keyboard card
```yaml
type: custom:android-keyboard-card
layoutUrl: /local/layouts/android/US.json
haptic: true
```

#### Carrousel card
```yaml
type: custom:carrousel-card
cell_width: 60px
cell_height: 60px
cells:
  netflix-activity:
    name: Netflix
    icon-url: https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg
    action:
      tap_action:
        action: perform-action
        perform_action: remote.turn_on
        target:
          entity_id: remote.android_tv
        data:
          activity: com.netflix.ninja
  canal-activity:
    name: Amazon
    icon-url: https://upload.wikimedia.org/wikipedia/commons/c/ca/Amazon_Prime_Video_logo_%282024%29.svg
    action:
      tap_action:
        action: perform-action
        perform_action: remote.turn_on
        target:
          entity_id: remote.android_tv
        data:
          activity: https://app.primevideo.com
```

#### Android remote control card

Minimal recommended version:
```yaml
type: custom:android-remote-card
keyboard:
  layout: US-remote
  font_scale: 1.4
mouse:
  haptic: true
  buttons: hidden
```

Extended version with haptic feedback enabled, four activities, volume buttons overrides:
```yaml
type: custom:android-remote-card
haptic: true
buttons-override:
  remote-volume-down-button:
    tap_action:
      action: toggle
    entity: script.tv-volume-down
  remote-volume-up-button:
    tap_action:
      action: toggle
    entity: script.tv-volume-up
keyboard:
  layout: US-remote
  haptic: true
  font_scale: 1.4
mouse:
  haptic: true
  buttons: hidden
  haptic: true
activities:
  cell_width: 80px
  cell_height: 60px
  cells:
    netflix-activity:
      name: Netflix
      icon-url: https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg
      action:
        tap_action:
          action: perform-action
          perform_action: remote.turn_on
          target:
            entity_id: remote.android_tv
          data:
            activity: com.netflix.ninja
    disney-activity:
      name: Disney+
      icon-url: https://upload.wikimedia.org/wikipedia/commons/f/fa/Disney_plus_icon.png
      action:
        tap_action:
          action: perform-action
          perform_action: remote.turn_on
          target:
            entity_id: remote.android_tv
          data:
            activity: com.disney.disneyplus
    youtube-activity:
      name: Youtube
      icon-url: https://upload.wikimedia.org/wikipedia/commons/7/72/YouTube_social_white_square_%282017%29.svg
      action:
        tap_action:
          action: perform-action
          perform_action: remote.turn_on
          target:
            entity_id: remote.android_tv
          data:
            activity: app.revanced.android.youtube
    prime-activity:
      name: Amazon
      icon-url: https://upload.wikimedia.org/wikipedia/commons/c/ca/Amazon_Prime_Video_logo_%282024%29.svg
      action:
        tap_action:
          action: perform-action
          perform_action: remote.turn_on
          target:
            entity_id: remote.android_tv
          data:
            activity: https://app.primevideo.com
```

## F.A.Q

### Home Assistant instance and USB "RPI zero 2w" gadget fails to communicate
Check your network settings:
- both devices should be connected to the same network, check each device IP:
```bash
ip a
```
Check your network router:
  - ensure you have no AP isolation on the network → disable AP isolation
  - ensure there is no explicit firewall rules on the network → disable blocking rules
  - ensure ICMP protocol is not explicitely disabled on LAN → allow ICMP protocol
  - assign static IP address to each device through DHCP into your network router
    - hard + soft reboot your network router
    - hard + soft reboot each device one by one

Retry `ping` from/to each device:
```bash
ping <device_ip>
```
**Important:** even when network settings are correct, it happens that devices cannot ping each-other. 
This is likely due to bugs in the network stack of one (router) or more (HA device, RPI device) devices. 
Such bugs can be corrupted ARP tables, routes and caches. 

Most of the time these bugs :
- occurs only for the time between when you assign static IP through DHCP on your router and the time those network components refresh.
- can be definitively fixed after multiple hard **and** soft reboot of all devices, starting with the router followed by eaech device one-by-one.

### I want to debug HA zero-hid server
Check server is running:
```bash
sudo systemctl status websockets_server
```
Check server logs in real-time with websockets low-level server logs:
```bash
sudo journalctl -u websockets_server -f
```
or only high level logs:
```bash
sudo journalctl -u websockets_server -f --no-pager | sed 's/\x1b\[[0-9;]*m//g' | grep -v "websockets\\.server"
```
