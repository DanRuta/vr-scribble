"use strict"

// let pos = {},
let isDrawing = false
let canvasRectangle
let context
let interfaceActions = []
let alpha = 0
let beta = 0

const keyboardInputs = {
    32 : "space",
    38 : "up",
    40 : "down",
    37 : "left",
    39 : "right",
    13 : "enter"
}

// mousedownActive = false,
// mouseupActive = false,

// Speech recognition
let recognition = new webkitSpeechRecognition()
recognition.continuous = true
recognition.lang = "en-GB"

recognition.onresult = event => {
    handleCommand(event.results[event.results.length-1][0].transcript.trim().toLowerCase())
}


let ws

if (window.location.protocol.includes("https")) {
    ws = new WebSocket(`wss://${window.document.location.hostname}:443`)
} else {
	ws = new WebSocket(`ws://${window.document.location.hostname}:8000`)
}

ws.onmessage = event => {
    const data = JSON.parse(event.data)
    console.log("oops: ", data)
}

const initPage = () => {
    // voiceControl.addEventListener("click", recognition.start)
    voiceControl.addEventListener("click", () =>  recognition.start())

    document.getElementById("optionsBTN").addEventListener("click", () => {
        interfaceActions.push("options")
        sendData()
    })

    canvasRectangle = control.getBoundingClientRect()

    control.addEventListener("mousedown", start)
    control.addEventListener("mouseup", stop)

    context = control.getContext("2d")

    context.fillStyle = "rgba(0,0,0,0.2)"
    context.fillRect(0,0, 360, 360)

    alphaSlider.addEventListener("input", toggleSendData)
    betaSlider.addEventListener("input", toggleSendData)

    mouseDownButton.addEventListener("click", event => {
        interfaceActions.push("mousedown")
        sendData()
    })

    mouseUpButton.addEventListener("click", event => {
        interfaceActions.push("mouseup")
        sendData()
    })

    listenInterfaceActions()
}

const start = () => {
    control.addEventListener("mousemove", toggleSendData)
}

const stop = () => {
    control.removeEventListener("mousemove", toggleSendData)
}

const toggleSendData = event => {


    // if (mousedownActive) {
    //     interfaceActions.push("mousedown")
    //     mousedownActive = false
    // }

    // if (mouseupActive) {
    //     interfaceActions.push("mouseup")
    //     mouseupActive = false
    // }


    context.clearRect(0,0,control.width, control.height)
    context.beginPath()

    if (event.target.id=="control") {

        alpha = (event.clientX - canvasRectangle.left)%360
        beta = 180- (event.clientY - canvasRectangle.top)
        context.arc(event.clientX - canvasRectangle.left, event.clientY - canvasRectangle.top, 10, 0, 2*Math.PI)

        alphaSlider.value = alpha
        betaSlider.value = beta
    } else {
        alpha = alphaSlider.value,
        beta = betaSlider.value
        context.arc(beta, alpha , 10, 0, 2*Math.PI)
    }

    context.stroke()
    context.fillRect(0,0, 360, 360)

    // Display these things
    alphaSliderOutput.innerHTML = "Alpha (x): "+ alpha
    betaSliderOutput.innerHTML = "Beta (y):" +beta

    sendData()
}

const listenInterfaceActions = () => {
    document.addEventListener("keydown", event => {

        if (!keyboardInputs.hasOwnProperty(event.keyCode))
            return

        event.preventDefault()

        interfaceActions.push(keyboardInputs[event.keyCode])
        sendData()
    })
}

const sendData = () => {

    // Simulate terrible network traffic
    // if (Math.floor(Math.random()*10%10) != 5)
        // return

    // Send the data
    ws.send(JSON.stringify({
        username: "test16",
        userId : "0",
        room: roomID.value,
        type: "controller",
        alpha: -alpha,
        beta: 0.5*Math.max(Math.min(beta, 150), -150),
        isDrawing: isDrawingCheckbox.checked,
        interfaceActions: interfaceActions
    }))

    // Clear the interface actions list
    interfaceActions = []

    // Start the voice listening again, if it has stopped
    // try{
    //     recognition.start()
    // }catch(e) {
    //     // Do nothing
    // }
}

// Given a spoken interpretation, handle it if there are any actions for a set of matching or similar interpretations
const handleCommand = transcript => {

    let command;

    switch(transcript) {

        case "close":
        case "clues":
        case "clothes":
            command = "close"
            break

        case "options":
        case "option":
        case "auctions":
        case "auction":
        case "stop shins":
            command = "options"
            break

        case "undo":
        case "under":
        case "andy":
        case "london":
        case "and do":
            command = "undo"
            break

        case "redo":
        case "reading":
        case "we do":
        case "radio":
            command = "redo"
            break

        case "colour":
        case "color":
            command = "colour"
            break

        case "opacity":
        case "audacity":
        case "passivity":
        case "pacity":
        case "spacity":
        case "capacity":
        case "passive d":
        case "passenger":
        case "past due":
        case "apache":
            command = "opacity"
            break

        case "thickness":
        case "sickness":
        case "hypnos":
            command = "thickness"
            break

        case "screenshot":
        case "screenshots":
        case "save":
        case "saved":
            command = "screenshot"
            break

        default:
            console.log("Unrecognised... "+transcript)
    }


    if (command) {
        console.log("Command recognised: ", command)
        interfaceActions.push(command)
        sendData()
    }
}

window.addEventListener("load", initPage)