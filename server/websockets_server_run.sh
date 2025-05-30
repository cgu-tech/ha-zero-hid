#!/bin/bash

# Activate the Python virtual environment
source /opt/ha_zero_hid/venv/bin/activate

# Run the Python script forever
exec python /opt/ha_zero_hid/websockets_server.py
