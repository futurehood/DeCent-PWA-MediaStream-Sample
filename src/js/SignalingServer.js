export class SignalingServer {

    #connectionManager = null
    #wss = null
    #applicationProtocols = []

    #wssEvents = {
        open: (e) => {
            console.log("OPEN WSS", e)
            this.#connectionManager.getApplication().broadcastEvent(
                "signalingServerConnected",
                this
            )
        },
        message: (e) => {
            console.log("WebSocket message received:", e)
            try {
                let json = JSON.parse(e.data)
                if (json !== undefined) {
                    let context = {
                        signalingServer: this,
                        message: json
                    }
                    this.#connectionManager.getApplication().broadcastEvent(
                        "signalingServerMessageReceived",
                        context
                    )
                } else {
                    throw new Error("JSON parsing error")
                }
            } catch (e) {
                // The remote client is misbehaving
                this.#wss.close()
                console.log("Exception on signaling server message handler", e)

            }
        },
        error: (e) => {
            console.log("ERRIR WSS")
            this.#connectionManager.getApplication().broadcastEvent("signalingServerError", e)
        },
        close: (ev) => {
            console.log("CLOSE WSS")
            let context = {
                signalingServer: this,
                event: ev
            }
            this.#connectionManager.getApplication().broadcastEvent("signalingServerDisconnect", context)
        }
    }

    constructor (connectionManager, config) {
        this.#connectionManager = connectionManager
        this.#applicationProtocols.push(config.applicationProtocols)
        this.setUpWebSocketConnectionObject(config)
    }

    setUpWebSocketConnectionObject (config) {
        let address = config.address+":"+config.port
        if (window.location.host === address) {
            console.log("Local conn")
            address+=window.location.pathname
        }
        console.log("Prepared address for signlaing server connection", address, window.location.host)
        this.#connectionManager.getApplication().broadcastEvent("signalingServerConnecting", this)
        this.#wss = new WebSocket("wss://"+address, "DCNT")
        this.#wss.addEventListener("open", this.#wssEvents.open)
        this.#wss.addEventListener("error", this.#wssEvents.error)
        this.#wss.addEventListener("message", this.#wssEvents.message)
        this.#wss.addEventListener("close", this.#wssEvents.close)
    }

    getAddress () {
        return this.#wss.url
    }

    getReadyState () {
        return this.#wss.readyState
    }

    send (frame) {
        try {
            this.#wss.send(JSON.stringify(frame))
            console.log("WebSocket message sent:", frame)
        } catch (e) {
            console.log("Caught exception on signaling server send", e)
        }
    }

    disconnect () {
        console.log("Disconnect wss state:", this.#wss)
        this.#wss.close()
    }

}
