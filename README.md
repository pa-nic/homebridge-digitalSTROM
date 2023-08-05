
<p align="center">

<img src="https://github.com/pa-nic/homebridge-digitalSTROM/blob/main/images/logo.png" width="320">

</p>

# Basic Homebridge Platform Plugin for digitalSTROM

This is a (very) basic [Homebridge](https://homebridge.io) platform plugin for the [digitalSTROM](https://www.digitalstrom.com) smart home system.

Plugin status: *EXPERIMENTAL*

## DSS device support

You are currently able to directly control the following functions/devices:

| Group| Color | HW-Info | Functions | 
| --- | --- | --- | --- |
| Light | Yellow | GE- | Turn on/off, brightness |
| Shade | Grey | GR- | Shade position (outside) |

Scenes and other devices are currently **not** supported.

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

## Technical details

I am still experimenting/learning so expect breaking changes!

The plugin makes use of both, the [old](https://developer.digitalstrom.org/Architecture/dss-json.pdf) and [new](https://developer.digitalstrom.org/api/#overview--apartment-status) digitalSTROM API.

While the old API is mainly used to login and apply changes, the new API is used to get details about the appartment structure, device statuses and listen on a websocket channel for status changes. 

I'd like to completely switch to the new API at some point. With the limited documentation available I was not yet able to change the authentication/session handling and executing scenarios to the new API.

Any help/support is appreciated here!

