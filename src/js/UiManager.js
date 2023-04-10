export class UIManager {

    #application = null
    #connectionStatusList = document.getElementById("connectionStatusList")
    #dialogsList = document.getElementById("dialogsList")
    #messagesList = document.getElementById("messagesList")
    #mediaForm = document.forms["media"]
    #configurationForm = document.forms["configuration"]
    #applicationProtocol = this.#configurationForm.querySelector("input[name=application_protocol]")
    #connectionId = this.#configurationForm.querySelector("input[name=connection_id]")
    #address = this.#configurationForm.querySelector("input[name=address]")
    #port = this.#configurationForm.querySelector("input[name=port]")
    #mediaSource = this.#configurationForm.querySelector("select")
    #connectSignalingServerButton = document.getElementById("connectSignalingServer")
    #connectPeerButton = document.getElementById("connectPeer")

    constructor(application) {
        this.#application = application
        console.log("Form", this.#configurationForm)
        this.#connectSignalingServerButton.addEventListener("click", () => {
            let eventData = {
                applicationProtocols: this.#applicationProtocol.value,
                localConnectionId: this.#connectionId.value,
                address: this.#address.value,
                port: this.#port.value
            }
            this.#application.broadcastEvent("connectToSignalingServer", eventData)
        })
        if (this.#connectPeerButton) {
            this.#connectPeerButton.addEventListener("click", (e) => {
                console.log("Peer connecting.")
                let context = {
                    signalingServerAddress: "wss://"+this.getAddress()+":"+this.getPort(),
                    localConnectionId: this.#connectionId.value,
                }
                this.#application.broadcastEvent("connectToPeer", context)
            })
        }
    }

    async addLocalMediaStream () {
        let template = this.#mediaForm.querySelector("template")
        let video = template.content.firstElementChild.cloneNode()
        let mediaStream = null
        if (this.#mediaSource.selectedIndex === 0) {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } else if (this.#mediaSource.selectedIndex === 1) {
            mediaStream = await navigator.mediaDevices.getDisplayMedia({})
        }
        video.srcObject = mediaStream
        video.dataset.connectionId = this.#connectionId.value
        video.muted = true
        this.#mediaForm.append(video)
        video.play()
        return mediaStream
    }

    addRemoteMediaStream (context) {
        const mediaStream = new MediaStream()
        mediaStream.addTrack(context.event.track)
        console.log("Inside addRemoteMediaStream", context)
        let template = this.#mediaForm.querySelector("template")
        let video = template.content.firstElementChild.cloneNode()
        video.dataset.connectionId = context.peerConnection.getRemoteConnectionId()
        this.#mediaForm.append(video)
        console.log("Setting VIDEO SRC as ", context.event.track)
        video.srcObject = mediaStream
        video.play()
    }

    setConnectToSignalingServerButtonVisibility (visible) {
        console.log("Setting connect button disabled state", this.#connectSignalingServerButton)
        if (visible) {
            this.#connectSignalingServerButton.removeAttribute("disabled")
        } else {
            this.#connectSignalingServerButton.setAttribute("disabled", "")
        }
    }

    setConnectToPeerButtonVisibility (visible) {
        console.log("Setting connect button disabled state", this.#connectPeerButton)
        if (this.#connectPeerButton && visible) {
            this.#connectPeerButton.removeAttribute("disabled")
        } else if (this.#connectPeerButton) {
            this.#connectPeerButton.setAttribute("disabled", "")
        }
    }

    getSignalingProtocol () {
        return this.#applicationProtocol.value
    }

    getConnectionId () {
        return this.#connectionId.value
    }

    getAddress () {
        return this.#address.value
    }

    getPort () {
        return this.#port.value
    }

    removeConnection (id) {
        let connectionStatusIndicator = this.#connectionStatusList.querySelector(`li>label[for=${id}]`)
        connectionStatusIndicator.parentNode.removeChild(connectionStatusIndicator)
        let connectionMessageList = this.#messagesList.querySelector(`[data-source-id=${id}]`)
        connectionMessageList.parentNode.removeChild(connectionMessageList)
    }

    addConnectionStateIndicator (id, label, connectionType) {
        if (!this.#connectionStatusList.querySelector(`li>label[for=${id}]`)) {
            let template = this.#connectionStatusList.firstElementChild.content.cloneNode(true)
            template.querySelector("label").setAttribute("for", id)
            template.querySelector("label").setAttribute("for", id)
            template.querySelector("span:first-of-type").innerText = label+":"
            template.querySelector("span:nth-of-type(2)").innerText = "Disconnected"
            template.querySelector("button").addEventListener("click", e => {
                let context = {
                    connectionId: id,
                    connectionType: connectionType
                }
                switch(e.currentTarget.previousElementSibling.innerText) {
                    case "Connecting":
                        this.#application.broadcastEvent("closeConnection", context)
                        break
                    case "Connected":
                        this.#application.broadcastEvent("closeConnection", context)
                        break
                    case "Disconnected":
                        this.#application.broadcastEvent("cleanupConnection", context)
                        break
                }
            })
            this.#connectionStatusList.append(template)
        }
    }

    setConnectionStateIndicator (id, value, text = null) {
        let state, progress
        switch (value) {
            case 0:
                state = "Disconnected"
                progress = 0
                break
            case 1:
                state = "Error"
                progress = 0
                break
            case 2:
                state = "Connecting"
                progress = null
                break
            case 3:
                state = "Connected"
                progress = 100
        }
        let label = this.#connectionStatusList.querySelector(`li>label[for=${id}]`)
        label.querySelector("span:nth-of-type(2)").innerText = state
        if (text !== null) {
            label.querySelector("span:nth-of-type(1)").innerText = text+":"
        }
        if (progress === null) {
            label.querySelector("progress").removeAttribute("value")
        } else if (typeof(progress) == "number") {
            label.querySelector("progress").value = progress
        }
    }

    cleanupConnectionStateIndicator (id) {
        let label = this.#connectionStatusList.querySelector(`li>label[for=${id}]`)
        label.parentNode.removeChild(label)
    }

    addDialog (id, context) {
        let template = document.getElementById(id)
        if (template) {
            let li = template.content.firstElementChild.cloneNode(true)
            console.log("GOT LI: ", li)
            this.#dialogsList.append(context.callback(li))
        }
    }

    addMessageList (id, label) {
        let template = this.#messagesList.parentNode.querySelector("ul#messagesList>template")
        console.log("Template?", template, this.#messagesList)
        let li = template.content.firstElementChild.cloneNode(true)

        li.setAttribute("data-source-id", id)
        li.querySelector("details>summary>span").innerText = label+" messages"
        li.querySelector("details>summary>input").addEventListener("change", (e) => {
            e.target.parentNode.nextElementSibling.querySelectorAll("details").forEach(el => {
                if (e.target.checked) {
                    el.setAttribute("open", "")
                } else {
                    el.removeAttribute("open")
                }
            })
        })
        this.#messagesList.prepend(li)
        if (id !== "signaling-server-connection") {
            let template = this.#messagesList.querySelector("template:nth-of-type(2)")
            let label = template.content.firstElementChild.cloneNode(true)
            li.querySelector("details").append(label)
            let button = li.querySelector("button")
            button.addEventListener("click", e => {
                if (e.currentTarget.previousElementSibling.value.length > 0) {
                    let context = {
                        peerConnectionId: id,
                        peerConnectionDataChannelId: "messaging",
                        message: e.currentTarget.previousElementSibling.value
                    }
                    this.#application.broadcastEvent("sendDataChannelMessage", context)
                    e.currentTarget.previousElementSibling.value = ""
                    e.currentTarget.previousElementSibling.focus()
                }
            }, {capture: false})
        }
        return li
    }

    addReceivedMessage (id, message, from = null) {
        let container = this.#messagesList.querySelector(`li[data-source-id=${id}]`)
        if (!container) {
            console.log("Missing container, making one...")
            container = this.addMessageList(id, "DataChannel ("+id+")")
            console.log("Newly created container", container)
        } else {
            console.log("Container found...", container)
        }
        let template = container.querySelector("details>ul>template")
        console.log("Got this tempalte:", template)
        if (message.request) {
            let li = template.content.firstElementChild.cloneNode(true)
            console.log("Got this li:", li)

            li.querySelector("details>summary>samp").innerText = "REQ"
            li.querySelector("details>summary>time").innerText = Date().toString()
            li.querySelector("details>p").innerText = JSON.stringify(message)
            // li.querySelector("details").setAttribute("open", "")
            container.querySelector("details>ul").append(li)
        }
        if (message.sdp) {
            let li = template.content.firstElementChild.cloneNode(true)
            li.querySelector("details>summary>samp").innerText = "SDP"
            li.querySelector("details>summary>time").innerText = Date().toString()
            li.querySelector("details>p").innerText = JSON.stringify(message)
            // li.querySelector("details").setAttribute("open", "")
            container.querySelector("details>ul").append(li)
        }
        if (message.ice) {
            let li = template.content.firstElementChild.cloneNode(true)
            li.querySelector("details>summary>samp").innerText = "ICE"
            li.querySelector("details>summary>time").innerText = Date().toString()
            li.querySelector("details>p").innerText = JSON.stringify(message)
            // li.querySelector("details").setAttribute("open", "")
            container.querySelector("details>ul").append(li)
        }
        if (message.data) {
            let li = template.content.firstElementChild.cloneNode(true)
            li.querySelector("details>summary>samp").innerText = "DATA"
            li.querySelector("details>summary>time").innerText = Date().toString()
            li.querySelector("details>p").innerText = id+": "+message.data
            // li.querySelector("details").setAttribute("open", "")
            container.querySelector("details>ul").append(li)
        }
        console.log("Messages block done")
    }
}
