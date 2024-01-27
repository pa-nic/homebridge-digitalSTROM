
<p align="center">

<img src="https://github.com/pa-nic/homebridge-digitalSTROM/blob/main/images/logo.png" width="320">

</p>

# Basic Homebridge Platform Plugin for digitalSTROM

This is a (very) basic [Homebridge](https://homebridge.io) platform plugin for the [digitalSTROM](https://www.digitalstrom.com) smart home system.

The idea is **not** to expose all the zones, scenes etc. of the digitalSTROM setup but rather be able to control all the devices directly and do most/all of the automation stuff within HomeKit. 

For example, if you've configured a button (SW-) to turn on a group (zone) of lights (GE-) in your living room, you could do the following in HomeKit: Take the lights, put them in your living room and a) combine them to a group or b) create a scene.
You're now able to control the group of lights or the scene with "Hey Siri, ...".

## DSS device support

You are currently able to directly control the following functions/devices:

| Group| Color | HW-Info | Functions | 
| --- | --- | --- | --- |
| Light | Yellow | GE- | Turn on/off, brightness |
| Shade | Grey | GR- | Shade position (outside) |

Limitations: There is currently no way to automatically asign devices to floors, rooms, groups in HomeKit. So this has to be done manually within HomeKit.

## Setup

### DSS

To grant this Homebridge plugin access to your digitalSTROM environment you first need to register and enable an applicationToken in your digitalSTROM server (dSS).
 
https://dss.local:8080/json/system/requestApplicationToken?applicationName=Homebridge

Open the above link in your browser and note down the returned applicationToken.
You might need to replace `dss.local` with the IP of your dSS. You can also change the applicationName (`Homebridge`) to something else.

````
{"result":{"applicationToken":"2dfcc0a85r22a39b0c317c1d27b287cc0a6fc714kfw012d9a4d557f3b36efbf13"},"ok":true}
`````

If you've received an applicationToken like in the example above, access the web interface of your dSS, enable *Advanced View* (at the bottom right corner), open the *System* tab and browse to *Accesss rights*.

There you need to check the checkbox next to your just registered token and apply the changes.

### Homebridge

Install the plugin and open its settings page. 

Enter the `IP` of your digitalSTROM server and your `applicationToken`

<p align="center">

<img src="https://github.com/pa-nic/homebridge-digitalSTROM/blob/main/images/settings.png" width="480">

</p>

<p align="center" style="margin-top:20px">And that's just about it!</p>