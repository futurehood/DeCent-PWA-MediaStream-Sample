export class PeerConnection {

    #connectionManager = null
    #signalingServer = null
    #id = null
    #remoteConnectionId = null
    #sessionId = null
    #signalingRequired = true
    #rtc = new RTCPeerConnection()
    #pendingIceCandidates = []
    #dataChannels = []

    #connectionEvents = {
        negotiationNeeded: async (e) => {
            console.log("Negotiation needed", this.#id, e, this.#rtc.signalingState)
            console.log("Tracks exist?", this.#rtc.getSenders())
            if (this.#signalingRequired) {
                console.log("Signaling requird", this.#id)
                let sdp = await this.createOffer()
                await this.setLocalDescription(sdp)
            } else {
                console.log("SIgnaling not required", this.#id)

            }
        },
        signalingStateChange: async (e) => {
            console.log("Signaling State change", this.#id, e.target.signalingState, e)
            if (e.target.signalingState === "have-local-offer") {
                console.log("Send an offer!")
                let signalingFrame = {
                    // local_id: this.#remoteConnectionId,
                    remote_id: this.#id,
                    sdp: JSON.stringify(this.#rtc.localDescription)
                }
                if (this.#sessionId) {
                    signalingFrame.session_id = this.#sessionId
                }
                this.#signalingServer.send(signalingFrame)
            }
            if (e.target.signalingState === "have-remote-offer") {
                // Send answer
                console.log("Send an answer!")
                let sdp = await this.createAnswer()
                await this.setLocalDescription(sdp)
                let signalingFrame = {
                    local_id: this.#remoteConnectionId,
                    remote_id: this.#id,
                    sdp: JSON.stringify(sdp)
                }
                if (this.#sessionId) {
                    signalingFrame.session_id = this.#sessionId
                }
                this.#signalingServer.send(signalingFrame)
                console.log("Sent an answer!", signalingFrame)
            }
            if (e.target.signalingState === "stable") {
                console.log("Turn loose the ICEs!", this.#id, this.#pendingIceCandidates)
                this.flushPendingIceCandidates()
            }
            // this.#connectionManager.getApplication().broadcastEvent("signalingStateChange", e)
        },
        connectionStateChange: (e) => {
            console.log("RTC Connection state change", e)
            this.#connectionManager.getApplication().broadcastEvent("connectionStateChange", e)
        },
        dataChannel: (e) => {
            console.log("Data channel added by peer", e)
            this.#connectionManager.getApplication().broadcastEvent("dataChannelReceived", e)
        },
        track: (e) => {
            // console.log("Track received in peerC", this.#id, track, stream)
            // stream.onremovetrack = ({track}) => {
            //     console.log(`GGGGGGGGG ${track.kind} track was removed. ${this.#id}`)
            //     if (!stream.getTracks().length) {
            //         console.log(`stream ${stream.id} emptied (effectively removed).`)
            //     }
            // }
            let context = {
                peerConnection: this,
                event: e
            }
            e.streams[0].addEventListener("removetrack", (e) => {
                console.log("Removed track on stream", this.#id, e)
                this.#connectionManager.getApplication().broadcastEvent("trackRemoved", context)
                this.#rtc.close()
            })
            e.track.addEventListener("mute", () => {
                console.log("STREAM MUTED", this.#id, e)
                this.close()
            })
            e.track.addEventListener("ended", () => {
                console.log("STREAM ENDED", this.#id, e)
                this.close()
            })
            this.#connectionManager.getApplication().broadcastEvent("trackReceived", context)
        }
    }

    #iceEvents = {
        iceCandidate: (e) => {
            if (e.candidate !== null) {
                this.#pendingIceCandidates.push(e.candidate)
            }
            if (this.#rtc.signalingState === "stable") {
                this.flushPendingIceCandidates()
            }
        },
        iceCandidateError: (e) => {
            console.log("Error generating ice candidates", e)
            this.#connectionManager.getApplication().broadcastEvent("iceCandidateStateChange", e)
        },
        iceConnectionStateChange: (e) => {
            console.log("Ice connection state change,", this.getLocalConnectionId(), e.target.iceConnectionState,  e)
            if (e.target.iceConnectionState === "failed") {
                console.log("PEER FAILED!!!!!!!!!!!! ::::::::::::::::>",e)
                let context = {
                    peerConnection: this,
                    event: e
                }
                this.#connectionManager.getApplication().broadcastEvent("peerFailed", context)
            }
            if (e.target.iceConnectionState === "connected") {
                console.log("PEER CONNECTED!!!!!!!!!!!! ::::::::::::::::>",e)
                let context = {
                    peerConnection: this,
                    event: e
                }
                this.#connectionManager.getApplication().broadcastEvent("peerConnected", context)
            }
            if (e.target.iceConnectionState === "disconnected") {
                console.log("PEER DISCONNECTED!!!!!!!!!!!! ::::::::::::::::>",e)
                let context = {
                    peerConnection: this,
                    event: e
                }
                this.#connectionManager.getApplication().broadcastEvent("peerDisconnected", context)
            }
            if (e.target.iceConnectionState === "closed") {
                console.log("PEER CLOSED BY ITESLEF LOCAL!!!!!!!!!!!! ::::::::::::::::>",e)
                let context = {
                    peerConnection: this,
                    event: e
                }
                this.#connectionManager.getApplication().broadcastEvent("peerFailed", context)
            }
        },
        iceGatheringStateChange: (e) => {
            console.log("Ice gathering state change", e)
            this.#connectionManager.getApplication().broadcastEvent("iceGatheringStateChange", e)
        },
    }

    #dataChannelEvents = {
        error: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().broadcastEvent("dataChannelError", context)
        },
        bufferedamountlow: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().broadcastEvent("dataChannelBufferedAmountLow", context)
        },
        open: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().broadcastEvent("dataChannelOpen", context)
        },
        message: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().broadcastEvent("dataChannelMessage", context)
        },
        closing: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().broadcastEvent("dataChannelClosing", context)
        },
        close: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().broadcastEvent("dataChannelClose", context)
        },
    }

    #mediaStreamEvents = {
        // addTrack: (e) => {
        //     console.log("Track added", e)
        //     this.#connectionManager.getApplication().broadcastEvent("trackAdded", e)
        // },
        // removeTrack: (e) => {
        //     console.log("Track removed", e)
        //     this.#connectionManager.getApplication().broadcastEvent("trackRemoved", e)
        // }
    }
    //
    // #mediaStreamTrackEvents = {
    //     ended: (e) => {
    //         console.log("Track added by peer", e)
    //         this.#connectionManager.getApplication().broadcastEvent("trackEnded", e)
    //     },
    //     mute: (e) => {
    //         console.log("Track added by peer", e)
    //         this.#connectionManager.getApplication().broadcastEvent("trackMuted", e)
    //     },
    //     unmute: (e) => {
    //         console.log("Track added by peer", e)
    //         this.#connectionManager.getApplication().broadcastEvent("trackUnmuted", e)
    //     }
    // }

    constructor (connectionManager, signalingServer, id) {
        this.#connectionManager = connectionManager
        this.#signalingServer = signalingServer
        this.#id = id
        this.setUpRtcConnectionObject()
    }
    setUpRtcConnectionObject () {
        console.log("Creating a rtc with this signaling server:", this.#signalingServer)
        let config= {
            iceServers: [
                {
                    urls: "stun:iphone-stun.strato-iphone.de:3478"
                },
            ]
        }
        this.#rtc = new RTCPeerConnection(config)
        this.#rtc.addEventListener("signalingstatechange", this.#connectionEvents.signalingStateChange)
        this.#rtc.addEventListener("connectionstatechange", this.#connectionEvents.connectionStateChange)
        this.#rtc.addEventListener("negotiationneeded", this.#connectionEvents.negotiationNeeded)
        this.#rtc.addEventListener("datachannel", this.#dataChannelEvents.dataChannel)
        this.#rtc.addEventListener("track", this.#connectionEvents.track)
        this.#rtc.addEventListener("icecandidate", this.#iceEvents.iceCandidate)
        this.#rtc.addEventListener("icecandidateerror", this.#iceEvents.iceCandidateError)
        this.#rtc.addEventListener("iceconnectionstatechange", this.#iceEvents.iceConnectionStateChange)
        this.#rtc.addEventListener("icegatheringstatechange", this.#iceEvents.iceGatheringStateChange)
    }

    refreshConnectionObject () {
        console.log("Refreshing connection object", this.#id)
        this.#dataChannels.forEach(dataChannel => dataChannel.close())
        this.#dataChannels = []
        this.#rtc = null
        this.setUpRtcConnectionObject()
    }

    // createDataChannel (name) {
    //     console.log("Creating a data channel", name)
    //     let dataChannel = this.#rtc.createDataChannel(name, {negotiated: true, id: 0})
    //     dataChannel.addEventListener("error", this.#dataChannelEvents.error)
    //     dataChannel.addEventListener("bufferedamountlow", this.#dataChannelEvents.bufferedamountlow)
    //     dataChannel.addEventListener("open", this.#dataChannelEvents.open)
    //     dataChannel.addEventListener("message", this.#dataChannelEvents.message)
    //     dataChannel.addEventListener("closing", this.#dataChannelEvents.closing)
    //     dataChannel.addEventListener("close", this.#dataChannelEvents.close)
    //     this.#dataChannels.push(dataChannel)
    //     return this.#dataChannels[this.#dataChannels.size - 1]
    // }

    // removeDataChannel (label) {
    //     let index = this.#dataChannels.findIndex(dataChannel => dataChannel.label === label)
    //     this.#dataChannels[index].close()
    //     this.#dataChannels.splice(index, 1)
    // }
    // sendDataChannelMessage (id, message) {
    //     console.log("DATA CHANNELS:", this.#id, this.#dataChannels)
    //     let dataChannel = this.#dataChannels.find(dc => dc.label === id)
    //     if (dataChannel.readyState === "open") {
    //         dataChannel.send(message)
    //     }
    // }

    addMediaStream (mediaStream) {
        console.log("Adding media stream to peer connection", this.#id, mediaStream)
        mediaStream.getTracks().forEach(track => this.#rtc.addTrack(track, mediaStream))
    }

    removeTrack (sender) {
        console.log("")
        return this.#rtc.removeTrack(sender)
    }

    getTracks () {
        return this.#rtc.getSenders()
    }

    removeLocalTracks () {
        this.#rtc.getSenders().forEach(sender => {
            this.#rtc.removeTrack(sender)
        })
    }

    flushPendingIceCandidates () {
        if (this.#remoteConnectionId) {
            this.#pendingIceCandidates.forEach((candidate) => {
                let signalingFrame = {
                    local_id: this.#remoteConnectionId,
                    remote_id: this.#id,
                    ice: JSON.stringify(candidate)
                }
                if (this.#sessionId) {
                    signalingFrame.session_id = this.#sessionId
                }
                this.#signalingServer.send(signalingFrame)
            })
            this.#pendingIceCandidates = []
        }
    }

    getConnectionState () {
        return this.#rtc.iceConnectionState
    }

    close () {
        console.log("Closing connection", this.#id)
        this.#signalingRequired = true
        this.#rtc.close()
    }

    setSignalingRequired (bool) {
        this.#signalingRequired = bool
    }

    getSignalingRequired () {
        return this.#signalingRequired
    }

    getSignalingServer () {
        return this.#signalingServer
    }

    setSessionId(id) {
        this.#sessionId = id
    }

    getSessionId() {
        return this.#sessionId
    }

    getLocalConnectionId () {
        return this.#id
    }

    setRemoteConnectionId (id) {
        this.#remoteConnectionId = id
    }

    getRemoteConnectionId () {
        return this.#remoteConnectionId
    }

    async createOffer () {
        return this.#rtc.createOffer()
    }

    async createAnswer () {
        return this.#rtc.createAnswer()
    }

    async setLocalDescription (sdp) {
        console.log("Setting local desc", sdp)
        return this.#rtc.setLocalDescription(sdp)
    }

    async setRemoteDescription (sdp) {
        console.log("Setting remote desc", sdp)
        return this.#rtc.setRemoteDescription(sdp)
    }

    async addIceCandidate (candidate) {
        console.log("Adding ICE candidate to peer connection")
        return this.#rtc.addIceCandidate(candidate)
    }
}
