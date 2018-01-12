"use strict"

window.vrscribble = window.vrscribble || {}
window.vrscribble.textures = {}
window.vrscribble.roomName = window.localStorage.getItem("roomName")

let ws

if (window.location.protocol.includes("https"))
     ws = new WebSocket(`wss://${window.document.location.hostname}:443`)
else ws = new WebSocket(`ws://${window.document.location.hostname}:8000`)

const users = {}

let userInterface, effect
let sphereRadius = 1000
let sphereVertexCount = 40
let serverSideFetchSent = false
let hash = window.location.hash.split("#")[1]

// Authorise the user from Google
const authoriseUser = () => {

    if (hash) window.vrscribble.roomName = hash

    if (!window.vrscribble.roomName && !window.localStorage.editRoomName) {
        return splashText.innerHTML = "No room name given"
    }

    splashText.innerHTML = "Authorising..."

    if (!window.localStorage.authenticator) {
        return splashText.innerHTML = "Not logged in. <br><br> Please log in and select the room to join, on the main page"
    }

    gapi.auth2.getAuthInstance().then(response => {

        window.GoogleAuth = response

        if (window.GoogleAuth.isSignedIn.get()) {

            window.GoogleUser = response.currentUser.get()
            window.profile = window.GoogleUser.getBasicProfile()

            serverSideAuthorisation(window.GoogleUser.getAuthResponse().id_token, "Google")

        } else splashText.innerHTML = "Not logged in. <br><br> Please log in and select the room to join, on the main page"
    })
}

// Confirm server-side the user's identity, and if the room exists
const serverSideAuthorisation = (token, authenticator) => {

    window.vrscribble.authenticator = authenticator
    window.vrscribble.token = token

    if (!serverSideFetchSent) {

        serverSideFetchSent = true

        fetch("tokenSignin", {
            method: "Post",
            body: JSON.stringify({token, authenticator, roomName: window.vrscribble.roomName})
        }).then(response => response.json())
        .then(({username, userId, roomExists}) => {

            window.vrscribble.username = username
            window.vrscribble.userId = userId
            splashText.innerHTML = "Connecting to room..."
            console.log(`Username: ${window.vrscribble.username} (ID: ${window.vrscribble.userId}) - Room: ${window.vrscribble.roomName}`)

            if (window.localStorage.editRoomName) {
                const editData = window.localStorage.editRoomName.split("-")
                splashText.innerHTML = "Fetching scribble to edit"

                fetch("/getEditScribble", {
                    method: "Post",
                    body: JSON.stringify({
                        userId: editData[0],
                        scribbleId: editData[1]
                    })
                }).then(response => response.json())
                .then(({imageBase64}) => {

                    if (!imageBase64) {
                        return splashText.innerHTML = "Unable to get scribble"
                    }

                    window.vrscribble.editScribbleBase64 = imageBase64

                    init()
                })

            } else if (!roomExists) {
                return splashText.innerHTML = `Room ${window.vrscribble.roomName} not found`

            } else init()
        })
    }
}

const init = () => {

    // Prevent the device from going into sleep mode, to keep the screen turned on
    screen.keepAwake = true

    // Initialise THREEjs components, starting with the renderer
    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true})
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.autoClear = false

    document.body.appendChild(renderer.domElement)
    splash.style.display = "none"

    renderer.domElement.addEventListener("click", () => {

        new NoSleep().enable()

        if (!window.location.href.includes("localhost") && (
           document.fullscreenEnabled && renderer.domElement.requestFullScreen() ||
           document.webkitFullscreenEnabled && renderer.domElement.webkitRequestFullScreen() ||
           document.mozFullScreenEnabled && renderer.domElement.mozRequestFullScreen() ||
           document.msFullScreenEnabled && renderer.domElement.msRequestFullScreen())) {}
    })


    // Stereo Effect
    // Separate the Gear VR browser from normal phone browsers to avoid current issue with VREffect not
    // rendering multiple scenes. StereoEffect is used in non-gearvr browsers
    // effect = navigator.userAgent.includes("Mobile VR") ? new THREE.VREffect(renderer) : new THREE.StereoEffect(renderer)

    // effect = new THREE.StereoEffect(renderer)
    effect = new THREE.VREffect(renderer)
    effect.separation = 0
    effect.setSize(window.innerWidth, window.innerHeight)


    let vrDisplay
    navigator.getVRDisplays().then(displays => {
        if (displays.length > 0) {
            vrDisplay = displays[0]
        }
    })

    // Add button to enable the VR mode
    const vrButton = VRSamplesUtil.addButton("Enter VR", "E", "/images/cardboard64.png", () => {

        if (navigator.userAgent.includes("Mobile VR")) {
            vrDisplay.requestPresent([{source: renderer.domElement}])
        } else {
            effect = new THREE.StereoEffect(renderer)
            effect.separation = 0
            effect.setSize(window.innerWidth, window.innerHeight)
            document.getElementById("vr-sample-button-container").style.display = "none"
        }
    })

    // Scenes and camera
    window.vrscribble.scene = new THREE.Scene()
    window.vrscribble.scene2 = new THREE.Scene()
    window.vrscribble.scene3 = new THREE.Scene()

    window.vrscribble.camera = new THREE.PerspectiveCamera(100, window.innerWidth/window.innerHeight, 1, 4000)
    // Uncomment to move camera to outside the sphere (debuging)
    // window.vrscribble.camera.position.z = sphereRadius*2
    window.vrscribble.scene.add(window.vrscribble.camera)
    window.vrscribble.camera.rotation.order = "YXZ"


    // Initialise Canvases
    const backgroundCanvas = document.createElement("canvas")
    const bufferCanvas = document.createElement("canvas")
    const strokeCanvas = document.createElement("canvas")
    const screenshotCanvas = document.createElement("canvas")

    backgroundCanvas.height = bufferCanvas.height =  strokeCanvas.height = screenshotCanvas.height = 1024
    backgroundCanvas.width = bufferCanvas.width = strokeCanvas.width = screenshotCanvas.width = 2048
    backgroundCanvas.id = "backgroundCanvas"

    const backgroundCanvasContext = backgroundCanvas.getContext("2d")
    const bufferCanvasContext = bufferCanvas.getContext("2d")
    const strokeCanvasContext = strokeCanvas.getContext("2d")
    const screenshotCanvasContext = screenshotCanvas.getContext("2d")

    // Colour in the background sphere
    backgroundCanvasContext.beginPath()
    backgroundCanvasContext.rect(0,0,backgroundCanvas.width, backgroundCanvas.height)
    backgroundCanvasContext.fillStyle = "white"
    backgroundCanvasContext.fill()

    // Add edit image if one exists
    if (window.vrscribble.editScribbleBase64) {
        const editImg = document.createElement("img")
        editImg.addEventListener("load", () => {
            backgroundCanvasContext.scale(-1, 1)
            backgroundCanvasContext.drawImage(editImg, 0, 0, backgroundCanvas.width*-1, backgroundCanvas.height)
        })
        editImg.src = "data:image/jpeg;base64,"+window.vrscribble.editScribbleBase64
    }

    // SPHERE ELEMENTS
    // Background
    window.vrscribble.textures.backgroundTexture = new THREE.Texture(backgroundCanvas)
    const backgroundMaterial = new THREE.MeshBasicMaterial({map: window.vrscribble.textures.backgroundTexture, side: THREE.BackSide, color: 0xffffff})
    window.vrscribble.scene.add(new THREE.Mesh(new THREE.SphereGeometry(sphereRadius, sphereVertexCount, sphereVertexCount), backgroundMaterial))


    // Buffer
    window.vrscribble.textures.bufferTexture = new THREE.Texture(bufferCanvas)
    const bufferMaterial = new THREE.MeshBasicMaterial({map: window.vrscribble.textures.bufferTexture,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    })
    window.vrscribble.scene.add(new THREE.Mesh(new THREE.SphereGeometry(sphereRadius-25, sphereVertexCount, sphereVertexCount), bufferMaterial))


    // Strokes
    window.vrscribble.textures.strokesTexture = new THREE.Texture(strokeCanvas)
    const strokesMaterial = new THREE.MeshBasicMaterial({map: window.vrscribble.textures.strokesTexture,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    })
    window.vrscribble.scene.add(new THREE.Mesh(new THREE.SphereGeometry(sphereRadius-50, sphereVertexCount, sphereVertexCount), strokesMaterial))


    // Set minFilter value, to resolve the power of two issue
    for (let texture in window.vrscribble.textures) {
        window.vrscribble.textures[texture].minFilter = THREE.NearestFilter
    }

    // Controls
    let controls = new THREE.OrbitControls(window.vrscribble.camera, renderer.domElement)
    controls.target.set(
        window.vrscribble.camera.position.x+0.15,
        window.vrscribble.camera.position.y,
        window.vrscribble.camera.position.z
    )
    controls.noPan  = true;
    controls.noZoom = true;


    // Set VR controls if available
    const setOrientationControls = event => {

        if (!event.alpha) return

        // controls = new THREE.DeviceOrientationControls(window.vrscribble.camera, true)
        controls = new THREE.VRControls(window.vrscribble.camera)
        // controls.connect()
        controls.update()

        window.removeEventListener("deviceorientation", setOrientationControls)
    }
    window.addEventListener("deviceorientation", setOrientationControls)

    // Init the user interface (with WebSocket and room name, for broadcasting canvas clearing votes)
    userInterface = new Interface(sphereRadius, sphereVertexCount, ws, window.vrscribble.roomName)


    // Animation loop
    const animate = () => {

        requestAnimationFrame(animate)
        controls.update()

        strokeCanvasContext.clearRect(0,0, strokeCanvas.width, strokeCanvas.height)

        let bufferNeedsReRender = false
        let willClear = Object.keys(users).length > 0

        // Update all users' cursor textures
        for (let user in users) {

            let currentUser = users[user]

            currentUser.cursorTexture.needsUpdate = true

            if (currentUser.isDrawing) {
                currentUser.stroke.render(strokeCanvasContext)
            }

            // Lerp the user's cursor sphere rotation
            currentUser.lerpCursor()

            // Get the user's buffer texture if buffer ready
            if (currentUser.bufferTextureReady) {
                currentUser.bufferItem.render(bufferCanvasContext)
                fillTopAndBottom()
            }

            // Check if the user has done or undone a stroke, and re-render the buffer canvas
            if (currentUser.undoneOrRedone) {
                bufferNeedsReRender = true
                currentUser.undoneOrRedone = false
            }

            // Move over old strokes to the permanent background canvas
            if (currentUser.strokeQueue.length == 11) {
                currentUser.strokeQueue[0].render(backgroundCanvasContext)
                currentUser.strokeQueue = currentUser.strokeQueue.slice(1)
            }

            // Handle the user's screenshot option actions]
            if (currentUser.screenshotReady && currentUser.name == window.vrscribble.username) {

                currentUser.screenshotReady = false

                // Flip the contents horizontally, as the 'seen' canvas is the reverse side, which is flipped
                screenshotCanvasContext.scale(-1,1)

                // Compile the image
                screenshotCanvasContext.drawImage(backgroundCanvas, 0, 0, screenshotCanvas.width*-1, screenshotCanvas.height)
                screenshotCanvasContext.drawImage(bufferCanvas, 0, 0, screenshotCanvas.width*-1, screenshotCanvas.height)
                screenshotCanvasContext.drawImage(strokeCanvas, 0, 0, screenshotCanvas.width*-1, screenshotCanvas.height)

                userInterface.renderToast(`Screenshot taken`)

                fetch("vrscreenshot", {
                    method: "Post",
                    body: JSON.stringify({
                        username : window.vrscribble.username,
                        base64Screenshot : screenshotCanvas.toDataURL("image/jpeg").replace("data:image/jpeg;base64,", ""),
                        authenticator: window.vrscribble.authenticator,
                        token: window.vrscribble.token
                    })
                }).then(response => userInterface.renderToast(response.status == 204 ? "Screenshot saved successfully!" : "Error saving screenshot !"))
            }

            willClear = willClear && currentUser.clearSelected
        }

        // If all current users have voted to clear the canvas, then clear it and reset their votes
        if (willClear) {

            userInterface.renderToast("Clearing canvas")

            backgroundCanvasContext.fillStyle = bufferCanvasContext.fillStyle = strokeCanvasContext.fillStyle = "white"
            backgroundCanvasContext.fillRect(0,0,backgroundCanvas.width, backgroundCanvas.height)
            bufferCanvasContext.fillRect(0,0,bufferCanvas.width, bufferCanvas.height)
            strokeCanvasContext.fillRect(0,0,strokeCanvas.width, strokeCanvas.height)

            for (let user in users) {

                let currentUser = users[user]

                // Clear each user's stroke data, reset strokeNo and other data
                currentUser.strokeQueue = []
                currentUser.brush.strokeNo = 0

                currentUser.clearSelected = false
                clearTimeout(currentUser.clearVoteTimeoutFunction)
            }
            fillTopAndBottom()
        }

        // Once all users' strokes are in, re-render the buffer canvas if a user has undone/redone a stroke
        if (bufferNeedsReRender) {

            bufferCanvasContext.clearRect(0,0, bufferCanvas.width, bufferCanvas.height)

            for (let user in users) {

                let currentUser = users[user]

                for (let strokeNo=0; strokeNo<currentUser.strokeQueue.length && strokeNo<currentUser.brush.strokeNo; strokeNo++) {
                    currentUser.strokeQueue[strokeNo].render(bufferCanvasContext)
                }
            }
            bufferNeedsReRender = false
        }

        // Update sphere textures
        for (let texture in window.vrscribble.textures) {
            window.vrscribble.textures[texture].needsUpdate = true
        }

        renderer.clear()
        effect.render(window.vrscribble.scene, window.vrscribble.camera)
        renderer.clearDepth()

        effect.render(window.vrscribble.scene2, window.vrscribble.camera)
        effect.render(window.vrscribble.scene3, window.vrscribble.camera)
    },

    // Iterate through the background and buffer canvases, determine average colours at the top and bottom, and render
    fillTopAndBottom = () => {
        backgroundCanvasContext.fillStyle = bufferCanvasContext.fillStyle = "#000"
        backgroundCanvasContext.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height/180*10)
        backgroundCanvasContext.fillRect(0, backgroundCanvas.height/180*170, backgroundCanvas.width, backgroundCanvas.height/180*10)
        bufferCanvasContext.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height/180*10)
        bufferCanvasContext.fillRect(0, backgroundCanvas.height/180*170, backgroundCanvas.width, backgroundCanvas.height/180*10)
    }

    animate()
    connectWebSocket()
    fillTopAndBottom()
}

// Register the page, serverside. Allow 5 attempts, until connection deemed too bad to continue
const connectWebSocket = (attempt=1) => {

    if (attempt>5) {
        return userInterface.renderToast(`Cannot connect to WebSocket server`)
    }

    userInterface.renderToast(`Attempt to connect WebSockets (${attempt}/5)`)

    try {
        ws.send(JSON.stringify({username: window.vrscribble.username, userId: window.vrscribble.userId, room: window.vrscribble.roomName, type: "viewer"}))
        initWebSockets()
    } catch(e) {
        setTimeout(connectWebSocket, 750, ++attempt)
    }
}

// Listen for any messages from the server and take appropriate action
const initWebSockets = () => {

    console.log("Websocket listening...")
    userInterface.renderToast(`Connected!`)

    // Websocket input
    ws.onmessage = event => {

        const data = JSON.parse(event.data)

        // Route all message types to their respective actions
        switch(true) {

            // Exit early if a message without a valid connection type is received
            case (data.type && data.type!="controller" && data.type!="viewer"):
                return

            // Handle a new connection, or a vote for clearing the canvas by a viewer device
            case (data.type && data.type=="viewer"):
                // Assign the vote to the right user, and exit
                if (data.clearVote) {

                    let usersWithVote = 0
                    let userNewVoteFrom

                    for (let user in users) {
                        if (users[user].name == data.username) {
                            userNewVoteFrom = users[user]
                        }
                    }

                    if (userNewVoteFrom) {

                        userNewVoteFrom.clearSelected = true
                        userNewVoteFrom.clearVoteTimeoutFunction = setTimeout(() => {userNewVoteFrom.clearSelected = false}, 15000)

                        for (let user in users) {
                            if (users[user].clearSelected) {
                                usersWithVote++
                            }
                        }

                        // Show a toast message to the viewer with eiter 'You' for same voter, and username for other voters
                        if (userNewVoteFrom.name == window.vrscribble.username) {
                            return userInterface.renderToast(`You voted to clear (${usersWithVote}/${Object.keys(users).length} needed)`)
                        }

                        userInterface.renderToast(`User ${userNewVoteFrom.name} voted to clear (${usersWithVote}/${Object.keys(users).length} needed)`)
                        return
                    }
                }

                // Display a toast, to otherwise announce the new viewer connection
                if (data.userId != window.vrscribble.userId) {
                    return userInterface.renderToast(`User ${data.username}'s ${data.type} connected`)
                }
                break

            // If a new controller connects, create a new User instance
            case(!users[data.username]):

                users[data.username] = new User({name: data.username}, sphereRadius, sphereVertexCount)

                // If the controller belongs to the same account as the viewer, instantiate the user interface
                if (data.userId == window.vrscribble.userId) {
                    userInterface.user = users[data.username]
                }
                break

            // Handle any interface actions from the user's controller
            case (data.interfaceActions && data.interfaceActions.length && data.userId==window.vrscribble.userId):
                userInterface.handleAction(data.interfaceActions)
                break

            // When a user disconnects, clear their data
            case (data.hasOwnProperty("disconnectedType")):

                if (data.username==window.vrscribble.username) {

                    users[data.username].activateCursor(false)
                    requestAnimationFrame(() => {

                        userInterface.renderToast(`Your ${data.disconnectedType} disconnected`)

                        // Remove the cursor object from the view and delete the user class
                        window.vrscribble.scene2.remove(users[data.username].cursorSphere)
                        delete users[data.username]

                    })

                    // Close the options bar if it was open on controller disconnect
                    if (userInterface.optionsBarOpen) {
                        window.vrscribble.optionClose()
                    }

                } else {

                    userInterface.renderToast(`${data.username}'s ${data.disconnectedType} disconnected`)

                    // Remove the cursor object from the view and delete the user class
                    window.vrscribble.scene2.remove(users[data.username].cursorSphere)
                    delete users[data.username]
                }
                break

            default:

                // If the interface options bar is open, use controller to navigate options instead
                if (userInterface.optionsBarOpen) {
                    userInterface.currentCoords = {alpha: -data.alpha/2, beta: data.beta, actions: data.interfaceActions, isDrawing: data.isDrawing}

                } else {
                    // Otherwise update the User cursor with new position and activation data
                    users[data.username].position = {alpha: -data.alpha, beta: data.beta}
                    users[data.username].activateCursor(data.isDrawing)
                }
        }
    }
}

// Resize the rendered element on window resize
window.addEventListener("resize", () => {
    effect.setSize(window.innerWidth, window.innerHeight)
    window.vrscribble.camera.aspect = window.innerWidth / window.innerHeight
    window.vrscribble.camera.updateProjectionMatrix()
})

window.addEventListener("load", authoriseUser)