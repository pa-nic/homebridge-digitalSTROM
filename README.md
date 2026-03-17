
<p align="center">

<img src="https://github.com/pa-nic/homebridge-digitalSTROM/blob/main/images/logo.png" width="320">

</p>

# Basic Homebridge Platform Plugin for digitalSTROM

[![verified-by-homebridge](https://img.shields.io/badge/homebridge-verified-blueviolet?color=%23491F59&style=flat)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

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

# Install instructions

To use the digitalStrom plugin you need to configure your digitalStrom server (dSS) and the Homebridge plugin as follows:

## Setup dSS

Grant the plugin access to your digitalSTROM environment, by registering and enabling an applicationToken in your digitalSTROM server (dSS).
 
https://dss.local:8080/json/system/requestApplicationToken?applicationName=Homebridge

Open the above link in your browser and **note down the returned applicationToken**.
You might need to replace `dss.local` with the IP of your dSS. You can also change the applicationName (`Homebridge`) to something else.

````
{"result":{"applicationToken":"2dfcc0a85r22a39d0c317c8d27b287cc0a6fc714kfw012d9a4d557f3b24efaf13"},"ok":true}
`````

If you've received an applicationToken like in the example above, access the web interface of your dSS, enable *Advanced View* (at the bottom right corner), open the *System* tab and browse to *Accesss rights*.

Enable the checkbox next to your just registered token and apply the changes. **You've now successfully granted access rights to your dSS for this token**.

## Setup Homebridge plugin

Install the plugin and open its settings page. 

Enter the `IP` of your digitalSTROM server and your `applicationToken`

<p align="center">
<img width="480" src="https://github.com/user-attachments/assets/61ca60bf-8d87-49d8-bc53-95c1809c5e91" />
</p>

> [!WARNING]
> You could now disable the certificate validation by enabling the checkbox (**not recommended**), save the settings and you're done.

To add an extra layer of security you need to enter the dSS certificate fingerprint.
Save the settings as they are and restart your homebridge.

During start-up the plugin tries to retrieve the certificate fingerprint and present it to you in the Homebridge **logs**;

```
[digitalSTROM] ================================================================================
[digitalSTROM] # SAVE YOUR DSS CERTIFICATE FINGERPRINT TO YOUR DSS PLUGIN CONFIG:
[digitalSTROM] #
[digitalSTROM] # Fingerprint: 7274bad7a7f9e82ddc2f7d417050f84147dbc6b2e76344ddad53dc4bcbf9265b
[digitalSTROM] #
[digitalSTROM] ================================================================================
[digitalSTROM] Fingerprint not configured yet, disabling plugin.
```

Copy & paste the fingerprint into your plugin settings.

<p align="center">
<img width="480" src="https://github.com/user-attachments/assets/0db49f82-8bc0-4d82-acbd-53a41f17ed4d" />
</p>

Save, restart your Homebridge and you're set and done.

> [!WARNING]
> If you do not want to set the fingerprint, disable the validation check! Otherwise the plugin won't start.


> [!TIP]
> You can get the certificate fingerprint also manually via your browser as described [here](https://github.com/pa-nic/homebridge-digitalSTROM/wiki/Get-fingerprint-(manually))

<p align="center" style="margin-top:20px">And that's just about it!</p>
