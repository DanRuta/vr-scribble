"use strict"

window.addEventListener("load", () => {

    let roomName
    let instructionsShown = false
    let signInRequestSent = false
    const authTokens = {}

    // Init the texture canvas
    const textureCanvas = document.createElement("canvas")
    textureCanvas.height = main.scrollHeight
    textureCanvas.width = main.scrollWidth
    const textureContext = textureCanvas.getContext("2d")

    // Load the spotlight image into the canvas
    const spotlightImage = document.createElement("img")
    spotlightImage.addEventListener("load", () => {
        textureContext.scale(-1,1)
        textureContext.drawImage(spotlightImage,0,0,-textureCanvas.width,textureCanvas.height)
        document.querySelector("canvas").style.opacity = 1
    })
    spotlightImage.src = "data:image/jpeg;base64,"+window.vrscribble.spotlightImageBase64

    // Init the Three.js stuff
    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true})
    renderer.setSize(main.scrollWidth, main.scrollHeight)
    canvasHolder.insertBefore(renderer.domElement, canvasOverlay)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, main.scrollWidth/main.scrollHeight, 1, 2000)
    scene.add(camera)

    const texture = new THREE.Texture(textureCanvas)
    const material = new THREE.MeshBasicMaterial({map: texture, side: THREE.BackSide, color: 0xffffff})
    const geometry = new THREE.SphereGeometry(1000, 50, 50)
    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)

    texture.minFilter = THREE.NearestFilter

    const animate = () => {
        requestAnimationFrame(animate)

        sphere.rotation.y += 0.0025
        texture.needsUpdate = true
        renderer.render(scene, camera)
    }
    animate()

    window.addEventListener("resize", () => {
        renderer.setSize(main.scrollWidth, main.scrollHeight)
        camera.aspect = main.scrollWidth/main.scrollHeight
        camera.updateProjectionMatrix()

        textureCanvas.height = main.scrollHeight
        textureCanvas.width = main.scrollWidth
        textureContext.drawImage(spotlightImage,0,0,textureCanvas.width,textureCanvas.height)
    })


    // The rest of the page
    // ====================
    viewer.addEventListener("click", () => window.location=`./viewer#${window.localStorage.getItem("roomName")}`)
    controller.addEventListener("click", () => window.location=`./controller#${window.localStorage.getItem("roomName")}`)
    userarea.addEventListener("click", () => window.location="./users/"+userarea.innerHTML.toLowerCase().replace(/\s/g, "-"))

    instructions.addEventListener("click", () => {

        instructionsShown = !instructionsShown

        // Toggle DOM elements
        mainLogo.style.display = instructionsShown ? "none" : "block"
        instructionsContent.style.display = instructionsShown ? "flex" : "none"
        instructions.innerHTML = instructionsShown ? "Hide Instructions" : "Show Instructions"
        box.style.height = instructionsShown ? "auto" : "300px"
        spotlightData.style.display = instructionsShown ? "none" : "block"
    })


    const validateRoomName = () => {

        if (room.value.includes("-")) {
            showItem("message", "Please enter only letters, numbers, or spaces")
            return
        }

        let name = room.value.trim().replace(/\s/g, "-").toLowerCase()

        if (!name.length) {
            showItem("message", "Please enter a room name, first")

        } else if (name.match(/((?![0-9]|[a-zA-Z]|-))+/g).length>1) {
            showItem("message", "Please enter only letters, numbers, or spaces")

        } else if (name.length>=20) {
            showItem("message", "Please enter a shorter name (max 20 characters)")

        } else return name
    }

    const showItem = (item, messageText) => {
        appButtons.style.display = item=="buttons" ? "flex" : "none"
        authItems.style.display = item=="auth" ? "flex" : "none"
        message.style.display = item=="message" ? "block" : "none"
        subPanel.style.display = "flex"

        if (messageText) {
            message.innerHTML = messageText
        }
    }

    join.addEventListener("click", () => {

        // Use authTokens when sending data. If not present, show the log in items
        if (authTokens.Google || authTokens.Facebook) {

            roomName = validateRoomName()

            if (roomName) {
                fetch("roomExists", {
                    method: "Post",
                    body: JSON.stringify({roomName})
                }).then(response => response.json())
                .then(({roomExists, roomName}) => {

                    if (roomExists && roomName) {
                        window.localStorage.removeItem("editRoomName")
                        window.localStorage.setItem("roomName", roomName)
                        showItem("buttons")

                    } else showItem("message", "This room doesn't exist. Why not create it?")
                })
            }
        } else showItem("auth")
    })

    create.addEventListener("click", () => {

        // Use authTokens when sending data. If not present, show the log in items
        if (authTokens.Google || authTokens.Facebook ) {

            roomName = validateRoomName()

            if (roomName) {
                fetch("createRoom", {
                    method: "Post",
                    body: JSON.stringify({roomName})
                }).then(response => response.json())
                .then(({roomName}) => {

                    if (roomName) {
                        window.localStorage.removeItem("editRoomName")
                        window.localStorage.setItem("roomName", roomName)
                        showItem("buttons")

                    } else showItem("message", "This room already exists. Why not join it?")
                })
            }
        } else showItem("auth")
    })


    // Bring up the sub panel with the auth items
    logIn.addEventListener("click", () => showItem("auth"))

    // Log the user out
    logOut.addEventListener("click", () => {

        window.localStorage.removeItem("authenticator")

        gapi.auth2.getAuthInstance().signOut().then(() => {
            delete authTokens.Google
            location.reload()
        })
    })


    // Will need to put this in after a fetch if custom usernames will be a thing
    const displayLoggedIn = (name, authenticator) => {

        window.localStorage.authenticator = authenticator

        if (!signInRequestSent) {

            signInRequestSent = true
            logOut.style.display = "block"
            logIn.style.display = "none"
            signInButton.style.display = "none"

            fetch("/tokenSignin", {
                method: "Post",
                body: JSON.stringify({token: authTokens[authenticator], authenticator})
            })
            .then(response => response.json())
            .then(({username, newUser}) => {

                userarea.innerHTML = username
                userarea.style.display = "block"

                if (newUser) showItem("message", "New user? Change your username from the user area by clicking the top right button")
            })
        }
    }

    // Initialise Google Sign-In
    gapi.auth2.getAuthInstance().then(response => {

        window.GoogleAuth = response

        if (window.GoogleAuth.isSignedIn.get()) {

            window.GoogleUser = response.currentUser.get()
            window.profile = window.GoogleUser.getBasicProfile()

            authTokens.Google = window.GoogleUser.getAuthResponse().id_token
            displayLoggedIn(window.profile.getName(), "Google")

        } else {
            window.GoogleAuth.isSignedIn.listen(loggedIn => location.reload())
            logIn.style.display = "block"
        }
    })
})