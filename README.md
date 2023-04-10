# Welcome - DeCent PWA MediaStream Sample #


<a align="right" href=".\mediastream-sample-screenshot.png">
    <img align="right" style="width: 30%; padding: 0 0 2em 2em;" src=".\mediastream-sample-screenshot.png">
</a>

This repository is intended to serve as an example of how a WebRTC peer connection with a single MediaStream can be obtained using a DeCent-Core signaling server and the ```DCNT``` decentralized peer-to-peer RTC signaling protocol.

## Overview ##

This repository contains a web application written in HTML, CSS, and Javascript. It is intended to be run in a secure browser environment and locally-hosted by a DeCent-Core instance which will provide both the HTTPS/TLS context and expose a WebSocket server that is used for signaling. This application can be installed directly on a DeCent-Core instance using the link above, or here: <a href="">https://github.com/nice1</a>

This particular sample application aims to clarify the expectations of connecting to, and using a DeCent-Core server to signal RTC MediaStream connections. While the code presented here is functional and complete enough to demonstrate the concept, it is not ambitious in features, nor does it offer complete coverage of the WebRTC APIs. Specific notes below.

## Notes ##

1. This application listens for the RTC MediaStream ```removetrack``` event to signal a disconnect. This is not necessarily the recommended approach for achieving this goal, but for the purpose of maintaining simplicity in the demo, the design choice was made. A real-world application may offer the option to switch MediaStreams in or out on-the-fly, and closing the connection upon handling the ```removetrack``` event preempts that possibility.

2. For the sake of simplicity, this application uses hard-coded identifiers (```"local-connection"```, ```"remote-connection"```) for signaling the RTC connection. It would be unwise to do this in production. Use UUIDs or something non-deterministic to avoid creating security exploits.

## Installation ##

1. Open DeCent-Core and navigate to the "Apps" section.
2. Click "Add App" and paste the repository archive (.zip) URL in to the ```URL``` field of the dialog.
3. Click "Next", the application files will be downloaded, authorize the application when prompted.
4. The application is now available locally when the DeCent-Core server is running.
5. Click on the app in the DeCent-Core apps list to open it's dialog.
6. Click "Open" to launch the application in the default browser.

## Usage ##

The application is fairly straightforward once a few key points are made clear.

The ```STUN server``` value may be optionally changed out for any functional STUN server URL that is preferred, do not include the ```STUN:``` prefix.

The ```application protocol``` and ```local/remote connection identifier``` fields can also be changed without consequence. 

Both the ```local WSS reachable address``` and ```remote WSS reachable address``` fields need to match specific cases. The local field should contain the local IP address or hostname that DeCent-Core is listening on, usually 127.0.0.1 or localhost. The remote field should contain the public/private IP address or hostname that Decent-Core is listening on. 

Both the ```local WSS port``` and ```remote WSS port``` fields need to be set to the HTTPS port that DeCent-Core is listening on.

The order in which connections are made is important here. This is because in reality, a ```DCNT``` server will be either online or offline. If the server is offline, it simply cannot be called. If the server is online, then it is waiting for incoming connections. This must be emulated here.

1. Connect to the signaling server for the local connection first.
2. Connect to the signaling server for the remote connection second.
3. Initiate a peer connection by sending a signal from the remote connection to the local connection third.

<br><br>
