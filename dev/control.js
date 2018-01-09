"use strict"

let ws, serverSideFetchSent = false
let hash = window.location.hash.split("#")[1]

window.vrscribble = {roomName : window.localStorage.getItem("roomName")}

if (window.location.protocol.includes("https"))
     ws = new WebSocket(`wss://${window.document.location.hostname}:443`)
else ws = new WebSocket(`ws://${window.document.location.hostname}:8000`)

const authoriseUser = () => {

    coordsBox.style.color = "rgba(150,150,150,0.8)"

    if (hash) window.vrscribble.roomName = hash

    if (!window.vrscribble.roomName) {
        return coordsBox.innerHTML = "No room name given"
    }

    coordsBox.innerHTML = "Authorising..."

    if (!window.localStorage.authenticator) {
        return coordsBox.innerHTML = "Not logged in. <br><br> Please log in and select the room to join, on the main page"
    }

    gapi.auth2.getAuthInstance().then(response => {

        window.GoogleAuth = response

        if (window.GoogleAuth.isSignedIn.get()){

            window.GoogleUser = response.currentUser.get()
            window.profile = window.GoogleUser.getBasicProfile()

            serverSideAuthorisation(window.GoogleUser.getAuthResponse().id_token)

        } else {
            coordsBox.innerHTML = "Not logged in. <br><br> Please log in and select the room to join, on the main page"
        }
    })
}

// Confirm server-side the user's identity, and if the room exists
const serverSideAuthorisation = (token) => {

    if (!serverSideFetchSent){
        serverSideFetchSent=true

        fetch("tokenSignin", {
            method: "Post",
            body: JSON.stringify({token, roomName: window.vrscribble.roomName})
        }).then(response => response.json())
        .then(({username, userId, roomExists}) => {

            window.vrscribble.username = username
            window.vrscribble.userId = userId
            coordsBox.innerHTML = "Connecting to room..."

            if (!roomExists) return coordsBox.innerHTML = `Room ${window.vrscribble.roomName} not found`

            initPage()
        })
    }
}

const initPage = () => {

    coordsBox.style.color = "rgba(50,50,50,0.8)"
    usernameDisplay.innerHTML = window.vrscribble.username
    roomNameDisplay.innerHTML = window.vrscribble.roomName

    const voiceListItems = Array.from(commandList.querySelectorAll("div:not(:first-child)"))

    enableFullScreen()

    let isDrawing = false
    let interfaceActions = []

    // Speech Recognition
    let recognition = new webkitSpeechRecognition()
    recognition.continuous = true
    recognition.lang = "en-GB"
    recognition.onresult = event => handleCommand(event.results[event.results.length-1][0].transcript.trim().toLowerCase(), interfaceActions)
    voiceButton.addEventListener("click", () => recognition.start())

    window.addEventListener("deviceorientation", () => {

        drawingArea.style.backgroundColor = isDrawing ? "#111" : "#000"

        const alpha = Math.round(event.alpha)-360
        const beta = Math.max(Math.min(Math.round(event.beta)*2, 150), -150)

        // Display the alpha and beta values
        coordsBox.innerHTML = `(Alpha: ${alpha}, Beta: ${beta})`
        coordsBox.innerHTML += isDrawing ? "\nDrawing" : ""

        // Compile the payload
        const payload = {
            username : window.vrscribble.username,
            userId: window.vrscribble.userId,
            room: window.vrscribble.roomName,
            type: "controller",
            alpha: alpha,
            beta: beta,
            isDrawing: isDrawing,
            interfaceActions: interfaceActions
        }

        // Send the payload
        ws.send(JSON.stringify(payload))

        // Clear the interface actions list
        interfaceActions = []
    })

    drawingArea.addEventListener("touchstart", () => {event.preventDefault();isDrawing = true})
    drawingArea.addEventListener("touchend", () => {isDrawing = false})
}

const handleCommand = (transcript, interfaceActions) => {

    let command

    switch(transcript){

        case "close": case "clues": case "clothes":
            command = "close"
            break

        case "options": case "option": case "auctions": case "auction": case "stop shins":
            command = "options"
            break

        case "undo": case "under": case "andy": case "london": case "and do":
            command = "undo"
            break

        case "redo": case "reading": case "we do": case "radio":
            command = "redo"
            break

        case "colour": case "color":
            command = "colour"
            break

        case "opacity": case "audacity": case "passivity": case "pacity": case "Spacity": case "capacity":
        case "passive d": case "passenger": case "past due": case "apache":
            command = "opacity"
            break

        case "thickness": case "sickness": case "hypnos":
            command = "thickness"
            break

        case "screenshot": case "screenshots": case "save": case "saved":
            command = "screenshot"
            break

        default:
            console.log("Unrecognised... "+transcript)
            return
    }

    if (!command) return

    const voiceListItem = document.getElementById(command)
    voiceListItem.style.color = "white"
    setTimeout(() => voiceListItem.style.color = "rgba(50,50,50,0.8)", 500)

    interfaceActions.push(command)
}

const enableFullScreen = () => {

    const getFullScreen = () => {

        main.removeEventListener("click", getFullScreen)
        drawingArea.removeEventListener("click", getFullScreen)

        new NoSleep().enable()

        if (!window.location.href.includes("localhost") && (
           document.fullscreenEnabled && main.requestFullScreen() ||
           document.webkitFullscreenEnabled && main.webkitRequestFullScreen() ||
           document.mozFullScreenEnabled && main.mozRequestFullScreen() ||
           document.msFullScreenEnabled && main.msRequestFullScreen())){}
    }

    main.addEventListener("click", getFullScreen)
    drawingArea.addEventListener("click", getFullScreen, true)
}

window.addEventListener("load", authoriseUser)