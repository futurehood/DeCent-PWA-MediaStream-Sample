import { UIManager} from "./UiManager.js"
import { ConnectionManager} from "./ConnectionManager.js"

export class Application {

    #uiManager = null
    #connectionManager = null

    #events = {
        connectToSignalingServer: (config) => {
            this.#uiManager.setConnectToSignalingServerButtonVisibility(false)
            let address = "wss://"+config.address+":"+config.port
            let signalingServer = this.#connectionManager.getSignalingServerByAddress(address)
            let label = "Signaling server"
            this.#uiManager.addConnectionStateIndicator("signaling-server-connection", label, "signaling")
            this.#uiManager.addMessageList("signaling-server-connection", label)
            if (signalingServer) {
                this.#connectionManager.removeSignalingServer(address)
                // Remove peer connection
            } else {
                this.#connectionManager.addSignalingServer(config)
            }
        },
        signalingServerConnecting: () => {
            this.#uiManager.setConnectionStateIndicator("signaling-server-connection", 2)
        },
        signalingServerConnected: (signalingServer) => {
            this.#uiManager.setConnectionStateIndicator("signaling-server-connection",3)
            let registrationFrame = {
                protocols: [this.#uiManager.getSignalingProtocol()]
            }
            signalingServer.send(registrationFrame)

            if (this.#uiManager.getConnectionId() === "remote-connection") {
                this.#uiManager.setConnectToPeerButtonVisibility(true)
            }
        },
        signalingServerError: () => {
            this.#uiManager.setConnectionStateIndicator("signaling-server-connection",1)
        },
        signalingServerDisconnect: async (context) => {
            if (context.event.code === 1015) {
                let dialogContext = {
                    callback: (node) => {
                        let url = new URL(context.event.target.url)
                        console.log("NODE", node)
                        node.querySelector("dialog>a").href = "https://"+url.host
                        node.querySelector("dialog>a").innerText = "https://"+url.host
                        return node
                    }
                }
                this.#uiManager.addDialog("badCertificate", dialogContext)
            }
            this.#uiManager.setConnectionStateIndicator("signaling-server-connection", 0)
            this.#uiManager.setConnectToSignalingServerButtonVisibility(true)
        },
        signalingServerMessageReceived: async (context) => {
            // Handle RTC SDP
            if (context.message.sdp) {
                console.log("Received sdp signal", context)
                this.#uiManager.addReceivedMessage("signaling-server-connection", context.message)
                return this.#rtcEvents.handleSdpSignal(context)
            }

            // Handle request for DataChannel
            if (context.message.ice) {
                console.log("Received ICE signal", context)
                this.#uiManager.addReceivedMessage("signaling-server-connection", context.message)
                return this.#rtcEvents.handleIceCandidateSignal(context)
            }
        },
        connectToPeer: async (context) => {
            let signalingServer = this.#connectionManager.getSignalingServerByAddress(context.signalingServerAddress)
            if (signalingServer) {
                let peerConnection = this.#connectionManager.addPeerConnection(signalingServer, context.localConnectionId)
                peerConnection.addMediaStream(await this.#uiManager.addLocalMediaStream())
                this.#connectionManager.signalPendingPeerConnections(peerConnection.getSignalingServer())
                this.#uiManager.addConnectionStateIndicator(
                    peerConnection.getLocalConnectionId(),
                    "Peer connection (pending)",
                    "peer"
                )
            }
        },
        closeConnection: (context) => {
            if (context.connectionType === "signaling") {
                this.#connectionManager.disconnectSignalingServer(context.connectionId)
            } else if (context.connectionType === "peer") {
                this.#connectionManager.disconnectPeerConnection(context.connectionId)
            }
        },
        connectionClosed: (id) => {
            this.#uiManager.removeConnectionStateIndicator(id)
           if (id === "signaling-server-connection") {
               this.#uiManager.setConnectToSignalingServerButtonVisibility(true)
           }
        },
        cleanupConnection: (context) => {
            if (context.connectionType === "signaling") {
                // this.#connectionManager.removeSignalingServer(context.connectionId)
            } else if (context.connectionType === "peer") {
                // this.#connectionManager.removePeerConnection(context.connectionId)
            }
            this.#uiManager.removeConnection(context.connectionId)
        }
    }

    #rtcEvents = {
        handleSdpSignal: async (context) => {
            try {
                let sdp = JSON.parse(context.message.sdp)
                if (sdp.type === "offer") {

                    let remoteConnectionId = context.message.remote_id
                    if (!remoteConnectionId) throw Error("Missing remote ID in handleSDPSignal")
                    let peerConnection = this.#connectionManager.getPeerConnectionByRemoteConnectionId(remoteConnectionId)

                    // If a local id was sent, try to locate
                    if (peerConnection === undefined) {
                        if (window.confirm(`Accept a connection request from ${context.message.from}?`)) {
                            peerConnection = this.#connectionManager.addPeerConnection(
                                context.signalingServer,
                                this.#uiManager.getConnectionId()
                            )
                            peerConnection.setSessionId(context.message.session_id)
                            console.log("SESSION ID CHECK", context.message)
                            peerConnection.setRemoteConnectionId(context.message.remote_id)
                            let mediaStream = await this.#uiManager.addLocalMediaStream()
                            peerConnection.addMediaStream(mediaStream)
                        }
                    }
                    console.log("About to proceed with THIS peerconn", peerConnection)
                    await peerConnection.setRemoteDescription(sdp)
                    this.#uiManager.addConnectionStateIndicator(
                        peerConnection.getLocalConnectionId(),
                        "Peer connection (negotiating)",
                        "peer"
                    )


                }
                if (sdp.type === "answer") {
                    console.log("Received ANSWER")
                    let peerConnection = this.#connectionManager.getPeerConnectionById(context.message.local_id)
                    peerConnection.setRemoteConnectionId(context.message.remote_id)
                    console.log("Setting answer", peerConnection)
                    await peerConnection.setRemoteDescription(sdp)
                }
            } catch (e) {
                console.log("Caught EXCEPTION in handleSdpSignal", e)
            }
        },
        handleIceCandidateSignal: async (context) => {
            console.log("Handling ICE candidate msg", context)
            let peerConnection = this.#connectionManager.getPeerConnectionById(context.message.local_id)
            await peerConnection.addIceCandidate(JSON.parse(context.message.ice))
        },
        peerConnected: async (context) => {
            this.#uiManager.setConnectionStateIndicator(
                context.peerConnection.getLocalConnectionId(),
                3,
                "Peer connection ("+context.peerConnection.getRemoteConnectionId()+")"
            )
        },
        trackReceived: (context) => {
            console.log("Got a track!", context)
            this.#uiManager.addRemoteMediaStream(context)
        },
        trackRemoved: (context) => {
            console.log("Track removed caught in application", context)
            this.#uiManager.setConnectionStateIndicator(
                context.peerConnection.getLocalConnectionId(),
                0,
                "Peer connection ("+context.peerConnection.getRemoteConnectionId()+")"
            )
        },
        dataChannelReceived: (e) => {
            // Not implemented here
            console.log("Data channel added!!!!!!!!!!!!!!!!!!!!!!!!! ->>>>>", e)
        },
        dataChannelOpen: (context) => {
            console.log("Data channel open", context)
            this.#uiManager.setConnectToPeerButtonVisibility(false)
        },
        dataChannelMessage: async (context) => {
            try {
                console.log("DataChannel message received", context.event)
                this.#uiManager.addReceivedMessage(context.peerConnection.getRemoteConnectionId(), context.event)
            } catch (e) {
                console.log(e)
            }
        },
        dataChannelClose: (context) => {
            console.log("Data channel closed", context)
            console.log("Data channel closed state", context.peerConnection.getConnectionState())
            context.peerConnection.removeDataChannel(context.event.target.label)
            context.peerConnection.refreshConnectionObject()
            this.#uiManager.setConnectionStateIndicator(context.peerConnection.getLocalConnectionId(), 0)
            if (this.#uiManager.getConnectionId() === "remote-connection") {
                this.#uiManager.setConnectToPeerButtonVisibility(true)
            }
        },
        peerDisconnected: (context) => {
            // this.#uiManager.removeConnectionStateIndicator(context.peerConnection.getLocalConnectionId())
        },
        sendDataChannelMessage: async (context) => {
            try {
                console.log("Send DataChannel message", context)
                let peerConnection = this.#connectionManager.getPeerConnectionByRemoteConnectionId(context.peerConnectionId)
                console.log("DataChannel peer connection", peerConnection)
                if (peerConnection) {
                    console.log("Sending that shit now.")
                    peerConnection.sendDataChannelMessage("messaging", context.message)
                }
            } catch (e) {
                console.log(e)
            }
        }
    }
    constructor () {
        this.#uiManager = new UIManager(this)
        this.#connectionManager = new ConnectionManager(this)
    }

    getEventCallback (eventName) {
        if (this.#events[eventName]) {
             return this.#events[eventName]
        }
        if (this.#rtcEvents[eventName]) {
            return this.#rtcEvents[eventName]
        }
        return null
    }

    broadcastEvent (eventName, context) {
        console.log("Broadcasted event recevied!", eventName, context)
        let callback = this.getEventCallback(eventName)
        if (callback !== null) {
            console.log("Located event callback: ", callback)
            callback.call(this, context)
        }
    }

}
