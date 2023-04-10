import { SignalingServer } from "./SignalingServer.js";
import { PeerConnection } from "./PeerConnection.js";

export class ConnectionManager {

    #application = null
    #signalingProtocols = []
    #signalingServers = []

    #peerConnections = []
    #pendingIceCandidates = []

    constructor (application, signalingProtocols) {
        this.#application = application
        this.#signalingProtocols = signalingProtocols
    }

    getApplication () {
        return this.#application
    }



    /**
     * Add a signaling server connection by address
     * @param address
     */
    addSignalingServer (config) {
        console.log("Add signlaing server config: ", config)
        let signalingServer = null
        if (!this.#signalingServers.find(e => e.getAddress() === config.address)) {
            signalingServer = new SignalingServer(this, config)
            this.#signalingServers.push(signalingServer)
            return signalingServer
        }
        return signalingServer
    }

    /**
     * Remove a signaling server by address
     * @param address
     * @returns {boolean}
     */
    removeSignalingServer (address) {
        let index = this.#signalingServers.findIndex((e) => e.getAddress() == address)
        if (index >= 0) {
            // Do disconnect
            let signalingServer = this.getSignalingServerByIndex(index)
            signalingServer.disconnect()
            // Remove from array
            this.#signalingServers.splice(index, 1)
            return true
        }
        return false
    }

    getSignalingServerByIndex (index) {
        return this.#signalingServers[index]
    }

    getSignalingServerByAddress (address) {
        return this.#signalingServers.find(e => e.getAddress().includes(address))
    }

    disconnectSignalingServer (id) {
        if (this.#signalingServers[0].getReadyState() === 1) {
            this.#signalingServers[0].disconnect()
        }
    }

    getSignalingServers () {
        return this.#signalingServers
    }

    addPeerConnection (signalingServer, localConnectionId) {
        let peerConnection = new PeerConnection(this, signalingServer, localConnectionId)
        this.#peerConnections.push(peerConnection)
        return peerConnection
    }

    getPeerConnectionById (id) {
        return this.#peerConnections.find(el => el.getLocalConnectionId() === id)
    }

    getPeerConnectionByRemoteConnectionId (id) {
        console.log("Looking for remote connection wit id", id, this.#peerConnections)
        return this.#peerConnections.find(el => el.getRemoteConnectionId() === id)
    }

    disconnectPeerConnection (id) {
        let peerConnection = this.#peerConnections.find(pc => pc.getLocalConnectionId() === id)

        peerConnection.removeLocalTracks()

        // peerConnection.close()
    }

    getPeerConnections () {
        return this.#peerConnections
    }

    removePeerConnection (peerConnection) {
        peerConnection.close()
        let index = this.#peerConnections.findIndex(pc => pc === peerConnection)
        this.#peerConnections.splice(index, 1)
    }

    signalPendingPeerConnections (signalingServer) {
        this.#peerConnections.forEach(async (peerConnection) => {
            if (peerConnection.getSignalingServer() === signalingServer &&
                peerConnection.getSignalingRequired()) {
                console.log("TIME TO SIGNAL THEN!!!!!!!")
                // Compose signaling frame and send
                let sdp = await peerConnection.createOffer()
                peerConnection.addMediaStream(mediaStream)
                await peerConnection.setLocalDescription(sdp)
            }
        })
    }

}
