
<p align="center">

<img src="https://github.com/pa-nic/homebridge-digitalSTROM/blob/main/images/logo.png" width="320">

</p>

# Basic Homebridge Platform Plugin for digitalSTROM

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

This is a (very) basic [Homebridge](https://homebridge.io) platform plugin for the [digitalSTROM](https://www.digitalstrom.com) smart home system.

The idea is **not** to expose all the zones, scenes etc. of the digitalSTROM setup but rather be able to control all the devices directly and do most/all of the automation stuff within HomeKit. 

For example, if you've configured a button (SW-) to turn on a group (zone) of lights (GE-) in your living room, you could do the following in HomeKit: Take the lights, put them in your living room and a) combine them to a group or b) create a scene.
You're now able to control the group of lights or the scene with "Hey Siri, ...".

## DSS device support

You are currently able to directly control the following functions/devices:

| HW-Info | Group | Color | Functions | 
| --- | --- | --- | --- |
| GE-* | Lights | yellow | Turn on/off, brightness |
| GSW-KL200 | Lights | black | Turn on/off, brightness |
| GR-* | Shades | gray | Shade position (outside) |

Limitations: There is currently no way to automatically assign devices to floors, rooms, groups in HomeKit. So this has to be done manually within HomeKit.

## Install instructions

See [Wiki](https://github.com/pa-nic/homebridge-digitalSTROM/wiki/wiki)

<p align="center" style="margin-top:20px">And that's just about it!</p>