#!/usr/bin/env python3
from zero_hid import Keyboard, KeyCodes
from time import sleep, perf_counter

last_time = perf_counter()

def watch(label="Elapsed"):
    global last_time
    now = perf_counter()
    elapsed = now - last_time
    print(f"[{label}] {elapsed:.6f} seconds")
    last_time = now

watch("Start")
sleep(5)
watch("After 5s")

with Keyboard() as k:
    watch("After Keyboard init")
    for i in range(1, 1000):
        k.press([], KeyCodes.KEY_SPACE)
    watch("After Keyboard range")
