"use strict"

let signInRequestSent = false
let userLoggedIn=false
let userAuthenticators
const authTokens = {}

const initPage = () => {

    // Draw the images
    window.vrscribble.scribbles.forEach(scribble => {
        scribbles.appendChild(createScribbleElement({
            id: window.vrscribble.scribbles.indexOf(scribble),
            path: scribble.path
        }))
    })

    if (!window.vrscribble.scribbles.length) {
        scribbles.appendChild(createElem("div", {id: "noScribbles", innerHTML: "No scribbles"}))
    }

    authoriseUser()
    logIn.addEventListener("click", () => window.location = "../")

    // Log the user out
    logOut.addEventListener("click", () => {

        window.localStorage.removeItem("authenticator")

        gapi.auth2.getAuthInstance().signOut().then(() => {
            delete authTokens.Facebook
            delete authTokens.Google
            resolve()
        })
        .then(() => location.reload())
        .catch(e => location.reload())
    })
}

const authoriseUser = () => {

    // Initialise Google Sign-In
    const googleSignInInit = new Promise((resolve, reject) => {
        gapi.auth2.getAuthInstance().then(response => {

            window.GoogleAuth = response

            if (window.GoogleAuth.isSignedIn.get()) {

                window.GoogleUser = response.currentUser.get()
                window.profile = window.GoogleUser.getBasicProfile()

                authTokens.Google = window.GoogleUser.getAuthResponse().id_token

                signInButton.style.display = "none"
                googleName.style.display = "flex !important"
                googleName.innerHTML = window.profile.getName()

                displayLoggedIn(window.profile.getName(), "Google")
                resolve()

            } else {
                googleName.style.display = "none"

                window.GoogleAuth.isSignedIn.listen(loggedIn => {

                    if (!loggedIn) return

                    const googleToken = window.GoogleAuth.currentUser.get().getAuthResponse().id_token,
                    authenticatorTo = Object.keys(authTokens)[0]

                    mergeUserAccount("Google", googleToken, authenticatorTo, authTokens[authenticatorTo])
                })
                resolve()
            }
        })
    })

    googleSignInInit.then(() => {
        // Show the log in button if no authenticators matched a user
        if (!Object.keys(authTokens).length) {
            logIn.style.display = "block"
        }
    })
}

const displayLoggedIn = (name, authenticator) => {

    if (!signInRequestSent) {

        signInRequestSent=true
        logOut.style.display = "block"

        fetch("/tokenSignin", {
            method: "Post",
            body: JSON.stringify({token: authTokens[authenticator], authenticator})
        })
        .then(response => response.json())
        .then(({username, userId, authenticators}) => {

            userarea.innerHTML = username
            userarea.style.display = "block"

            userAuthenticators = authenticators

            window.vrscribble.authUserId = userId

            userarea.addEventListener("click", () => window.location="./"+userarea.innerHTML.toLowerCase().replace(/\s/g, "-"))

            if (window.vrscribble.userId == window.vrscribble.authUserId) {

                userLoggedIn = true

                // Show and enable screenshot deleting
                Array.from(document.querySelectorAll(".deleteIcon"))
                    .forEach(deleteIcon => deleteIcon.style.display = "block")

                // Show and enable username editing
                editUsername.style.display = "inline-block"
                editUsername.addEventListener("click", () => {

                    let newName = prompt("Pick your new username", statsUsername.innerHTML)

                    if (newName) {

                        newName = newName.trim()

                        if (!newName.length) {
                            return alert("Can't have blank usernames")
                        }

                        if (newName.replace(/\s/g, "-").match(/((?![0-9]|[a-zA-Z]|-))+/g).length>1) {
                            return alert("Please enter only letters, numbers, or spaces")
                        }

                        editUsername.innerHTML = "Checking availability..."

                        fetch("/changeUsername", {
                            method: "Post",
                            body: JSON.stringify({newName, token: authTokens[authenticator], authenticator})
                        })
                        .then(response => response.json())
                        .then(({newName}) => {

                            editUsername.innerHTML = "Edit"

                            if (newName) {
                                statsUsername.innerHTML = newName
                                window.history.pushState({}, newName, `/users/${newName.toLowerCase().replace(/\s/g, "-")}`)

                            } else alert("Username taken")
                        })
                    }
                })
            }
        })
    }
}

const createScribbleElement = (data) => {

    // Create and append the elements
    const scribble = createElem("div", {id: data.id, className: "scribble"})
    const imageHolder = createElem("div", {className: "imageHolder"})
        const image = createElem("img", {src: `../${data.path}`})
    const scribbleOverlay = createElem("div", {className: "scribbleOverlay"})
        const topOptions = createElem("div", {className: "topOptions"})
            const editOption = createElem("div")
                const editIcon = createElem("img", {src: "../images/pencil.png", className: "icon"})
            const deleteOption = createElem("div")
                const deleteIcon = createElem("img", {src: "../images/delete.png", className: "icon deleteIcon"})
    const scribbleOptions = createElem("div", {className: "scribbleOptions"})
        const downloadOption = createElem("div")
            const downloadIcon = createElem("img", {src: "../images/download.png", className: "icon"})
            const vrViewLink = createElem("a", {href: `./${statsUsername.innerHTML.toLowerCase().replace(/\s/g, "-")}/${data.path.split(".")[0].split("/")[2]}`})
                const vrViewIcon = createElem("img", {src: "../images/vr.png", className: "icon"})
        const shareOption = createElem("div", {innerHTML: "Share"})
            const facebookShareIcon = createElem("img", {src: "../images/facebook.png", className: "icon facebookIcon"})

    imageHolder.appendChild(image)

    editOption.appendChild(editIcon)
    deleteOption.appendChild(deleteIcon)

    topOptions.appendChild(editOption)
    topOptions.appendChild(deleteOption)
    downloadOption.appendChild(downloadIcon)

    vrViewLink.appendChild(vrViewIcon)
    downloadOption.appendChild(vrViewLink)

    shareOption.appendChild(facebookShareIcon)
    scribbleOverlay.appendChild(topOptions)
    scribbleOptions.appendChild(downloadOption)
    scribbleOptions.appendChild(shareOption)

    scribble.appendChild(imageHolder)
    scribble.appendChild(scribbleOverlay)
    scribble.appendChild(scribbleOptions)

    editOption.addEventListener("click", () => {

        // The authorisation fetch has not yet responded. Cancel, buy some time until second press
        if (!window.vrscribble.authUserId) return

        const roomName = `${window.vrscribble.userId}${data.path.split(".")[0].split("/")[2]}${window.vrscribble.authUserId}`

        fetch("/createEditRoom", {
            method: "Post",
            body: JSON.stringify({roomName})
        }).then(response => response.json())
        .then((response) => {
            if (confirm(`Create room ${response.roomName} and start editing this scribble?`)) {

                fetch("/createRoom", {
                    method: "Post",
                    body: JSON.stringify({roomName: response.roomName})
                }).then(response2 => response2.json())
                .then((response2) => {

                    if (response2.roomName) {
                        window.localStorage.removeItem("roomName")
                        window.localStorage.editRoomName = `${window.vrscribble.userId}-${data.path.split(".")[0].split("/")[2]}-${window.vrscribble.authUserId}`
                        window.location = "../viewer"
                    }
                })
            }
        })
    })

    deleteOption.addEventListener("click", () => {

        if (confirm("Are you sure you'd like to delete this screenshot?")) {
            const authenticator = Object.keys(authTokens)[0]

            fetch("/deleteScreenshot", {
                method: "Post",
                body: JSON.stringify({path: data.path, token: authTokens[authenticator], authenticator })
            }).then(response => response.json())
            .then(({error}) => {

                if (error) return alert(error)

                scribbles.removeChild(scribble)

                const scribblesCount = parseInt(scribbles.innerHTML.split(" ")[0])
                scribbles.innerHTML = `${scribblesCount} Scribbles`
            })
        }
    })

    downloadIcon.addEventListener("click", () => createElem("a", {href: image.src, download: "scribble.png"}).click())

    facebookShareIcon.addEventListener("click", () => {

        const path = "http://vrscribble.danruta.co.uk/"+data.path
        const authenticators = Object.keys(authTokens)

        const proceedSharing = () => {
            const imagePath = `http://vrscribble.danruta.co.uk/${data.path}`,
            caption = prompt("Write a caption")

            if (caption!=null) {

                FB.api("/me/photos", "POST", {
                    url: imagePath,
                    caption: caption,
                    allow_spherical_photo : true
                }, response => {

                    if (response.error) {
                        return alert(`There was an error posting: ${response.error.message}`)
                    } else alert("Posted")

                    fetch("/shareLink", {
                        method: "Post",
                        body: JSON.stringify({FBid: response.id, username: statsUsername.innerHTML})
                    })
                })
            }
        }


        // if (authenticators.includes("Facebook")) {
        //     proceedSharing()
        // } else{

            FB.login(response => {
                if (response.authResponse!=null) {

                    FB.api("/me", response => {

                        authTokens.Facebook = response.authResponse.accessToken

                        fetch("/tokenSignin", {
                            method: "Post",
                            body: JSON.stringify({token: response.authResponse.accessToken, authenticator: "Facebook"})
                        }).then(() => proceedSharing())
                    })
                }
            })
        // }
    })

    return scribble
}

// Helper function
const createElem = (type, properties) => {

    const newElem = document.createElement(type)

    // For every element property given, apply it to the new element
    for(let property in properties) {
        newElem[property] = properties[property]
    }

    return newElem;
}

window.addEventListener("load", initPage)