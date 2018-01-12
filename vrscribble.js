"use strict"

let sendData, returnError, redis, redisPub, redisSub, websocketClients=[], keys

const fs = require("fs")
const pug = require("pug")
const util = require("util")
const fetch = require("node-fetch")
const exec = require("child_process").exec

const FBtemplate = "./template.jpg"
const spotlightImageNames = fs.readdirSync("./spotlight/").filter(file => file.endsWith(".jpg"))
const spotlightImages = spotlightImageNames.map(imageName => new Buffer(fs.readFileSync("./spotlight/"+imageName)).toString("base64"))

try {
    keys = JSON.parse(fs.readFileSync("./keys.json"))
} catch (e) {
    console.log("Could not parse keys. Did you remember to add the keys.json file?\n\n", e)
}
const googleClientId = process.argv.includes("dev") ? keys.dev : keys.dist

let rooms = []
let usersData = []

// GET
// ===
const index = (request, response) => {

    const randomImageIndex = Math.floor(Math.random()*spotlightImages.length)
    const spotlightData = spotlightImageNames[randomImageIndex].split(".")[0].split("-")

    sendData({request, response, code: 200, data: pug.renderFile("./index.pug", {
        googleClientId,
        spotlightImageBase64: spotlightImages[randomImageIndex],
        spotlightUsername : usersData[spotlightData[0]].username,
        spotlightUsernameUrl : usersData[spotlightData[0]].username.toLowerCase().replace(/\s/g, "-"),
        spotlightIndex : spotlightData[1]
    }), contentType: "text/html"})
}

const viewer = (request, response) => {
    sendData({request, response, code: 200, data: pug.renderFile("./viewer.pug", {googleClientId}), contentType: "text/html"})
}

const controller = (request, response) => {
    sendData({request, response, code: 200, data: pug.renderFile("./controller.pug", {googleClientId}), contentType: "text/html"})
}

const userArea = (request, response) => {

    let user
    const username = request.url.split("/users/")[1].toLowerCase()

    for (let userIndex in usersData) {

        const currentUser = usersData[userIndex]

        if (currentUser.username.toLowerCase().replace(/\s/g,"-")==username) {
            user = userIndex
            break
        }
    }


    if (!user) return returnError(response, "404")

    let imagePaths=[]

    try {
        imagePaths = fs.readdirSync(`./screenshots/${user}`)
                       .map(fileName => {return {path: `screenshots/${user}/${fileName}`}})
    } catch(e) {}

    sendData({request, response, code: 200, data: pug.renderFile("./userArea.pug", {
        username: usersData[user].username,
        userId: user,
        scribbles: imagePaths,
        plural: (!imagePaths.length || imagePaths.length>1) ? "s" : "",
        googleClientId
    }), contentType: "text/html"})
}

const vrViewer = (request, response) => {

    const [reqUsername, imageIndex] = request.url.split("/users/")[1].split("/")
    let userId, imageBase64

    for (const userIndex in usersData) {
        if (usersData[userIndex].username.toLowerCase().replace(/\s/g, "-")==reqUsername) {
            userId = userIndex
            break
        }
    }

    try {
        imageBase64 = new Buffer(fs.readFileSync(`./screenshots/${userId}/`+imageIndex+".jpg")).toString("base64")
        sendData({request, response, code: 200, data: pug.renderFile("./vrViewer.pug", {imageBase64}), contentType: "text/html"})

    } catch(e) {sendData({request, response})}
}



// POST
// ====
const roomExists = (request, response, {roomName}) => {
    sendData({request, response, code: 200, data: JSON.stringify({roomExists: rooms.includes(roomName), roomName}), contentType: "text/plain"})
}

const createRoom = (request, response, {roomName}) => {

    let responseData

    if (!rooms.includes(roomName)) {
        rooms.push(roomName)
        responseData = roomName
    }

    sendData({request, response, code: 200, data: JSON.stringify({roomName: responseData}), contentType: "text/plain"})
}

const createEditRoom = (request, response, {roomName}) => {

    let responseData, counter

    // Check if the room name is available. If not, incrementally assign a suffix number to it
    do {
        responseData = roomName+(counter ? counter : "")
        counter = counter ? counter+1 : 1

    } while (rooms.includes(responseData))

    sendData({request, response, code: 200, data: JSON.stringify({roomName: responseData}), contentType: "text/plain"})
}

const getEditScribble = (request, response, {userId, scribbleId}) => {
    const imageBase64 = new Buffer(fs.readFileSync(`./screenshots/${userId}/${scribbleId}.jpg`)).toString("base64")
    sendData({request, response, code: 200, data: JSON.stringify({imageBase64}), contentType: "text/plain"})
}

const tokenSignin = (request, response, {authenticator, token, roomName}) => {

    let roomExists

    authenticateUser(token, authenticator, ({id, name, email}) => {

        let username
        let newUser = false
        let userFound = false
        let userId

        // Check if the user exists, by looping through usersData object
        for (let userIndex in usersData) {

            const currentUser = usersData[userIndex]

            // Update existing user data
            // if (currentUser.authUserID[authenticator]==id) {
            if (currentUser.authUserID==id) {

                userFound = true
                userId = userIndex
                username = currentUser.username

                if (currentUser.email != email) {
                    currentUser.email = email
                }

                usersData[userId].timesLoggedIn++

                break
            }
        }

        if (!userFound) {
            console.log("Creating new user")

            // Create new user with incremental ID, and name defaulted to name from authenticator
            userId = Object.keys(usersData).length

            // Check if the username is taken
            let usernameCount = 0

            for(let userId in usersData) {
                if (usersData[userId].username==name) {
                    usernameCount++
                }
            }

            const newUserData = {
                username : usernameCount>0 ? name+usernameCount : name,
                authUserID: id,
                email: undefined,
                timesLoggedIn: 1,
                screenshotsTaken: 0
            }


            newUserData.email = email

            username = newUserData.username
            newUser = true

            // Add new user to the user data
            usersData[userId] = newUserData
        }

        fs.writeFile("./usersData.json", JSON.stringify(usersData, null, 4),()=>{})

        const finishAndSend = () => sendData({request, response, code: 200, data: JSON.stringify({username, userId, newUser, roomExists})})

        // console.log(rooms)
        if (roomName) {

            roomExists = rooms.includes(roomName)
            finishAndSend()

        } else {
            finishAndSend()
        }
    })
}

const changeUsername = (request, response, {newName, token, authenticator}) => {
    authenticateUser(token, authenticator, ({id}) => {

        let existingNameFound = false
        let userToChange

        for (let userIndex in usersData) {

            const currentUser = usersData[userIndex]

            if (currentUser.authUserID==id) {
                userToChange = userIndex
            } else if (currentUser.username==newName) {
                existingNameFound=true
            }
        }

        if (existingNameFound) {
            return sendData({request, response, code: 200, data: JSON.stringify({})})
        }

        usersData[userToChange].username = newName

        fs.writeFile("./usersData.json", JSON.stringify(usersData, null, 4), ()=>{})
        sendData({request, response, code: 200, data: JSON.stringify({newName})})
    })
}

const saveScreenshot = (request, response, {username, base64Screenshot, authenticator, token}) => {

    authenticateUser(token, authenticator, ({id}) => {

        let userIndexValue, screenshotCount

        for (let userIndex in usersData) {

            if (usersData[userIndex].authUserID==id) {
                userIndexValue = userIndex
                screenshotCount = usersData[userIndex].screenshotsTaken
            }
        }

        if (userIndexValue) {

            const imageBuffer = new Buffer(base64Screenshot, "base64")
            const imagePath = `./screenshots/${userIndexValue}/${screenshotCount}.jpg`

            try {
                fs.mkdirSync(`./screenshots/${userIndexValue}`)
            }catch(e) {
                // console.log(`Directory ./screenshots/${userIndexValue} already exists... Continuing...`)
            }finally{
                fs.writeFileSync(imagePath, imageBuffer)
                console.log("Screenshot saved successfully")

                // Add meta data from the Facebook template
                exec(`exiftool -TagsFromFile ${FBtemplate} ${imagePath}`, (error, stdout, stderr) => {
                    if (error)   console.log(error)
                    if (stdout)  console.log(stdout)
                    if (stderr)  console.log(stderr)
                    console.log("Added the metadata")

                    fs.unlink(imagePath+"_original")
                })
            }

            sendData({request, response})

            usersData[userIndexValue].screenshotsTaken++
            fs.writeFile("./usersData.json", JSON.stringify(usersData, null, 4),()=>{})
        }
    })
}

const deleteScreenshot = (request, response, {path, token, authenticator}) => {

    const pageUsername = path.split("/")[1]

    authenticateUser(token, authenticator, ({id}) => {

        let error = "Something went wrong..."

        for (let userId in usersData) {

            if (usersData[userId].authUserID==id && userId==pageUsername) {
                error = null
                fs.mkdir(`./private/vrscribble/deletedScreenshots/${userId}`, err => {
                    fs.rename(`./${path}`, `./private/vrscribble/deletedScreenshots/${userId}/${path.split("/")[2]}`, err => {
                        console.log(`Deleted screenshot ${path} from user area`)
                    })
                })
                break
            }
        }

        sendData({request, response, code:200, data: JSON.stringify({error})})
    })
}


const handleWebSocket = (connection, clients) => {

    websocketClients = clients

    try {
        connection.on("message", message => {

            message = JSON.parse(message)

            // Register the user data to the connection
            if (!connection.meta) {
                connection.meta = {
                    userId: message.userId,
                    username : message.username,
                    room: message.room,
                    type: message.type,
                    time: new Date()
                }
            }

            websocketClients.forEach(client => {
                if (client.meta && client.meta.room == connection.meta.room && client.meta.type=="viewer") {
                    client.send(JSON.stringify(message))
                }
            })
        })

        connection.on("close", () => {

            // Remove the connection from the websocketClients list
            websocketClients.splice(websocketClients.indexOf(connection), 1)

            if (!connection.meta) {
                return
            }

            let roomIsEmpty = true

            websocketClients.forEach(client => {

                if (!client.meta)   return

                if (client.meta.room==connection.meta.room) {

                    roomIsEmpty = false

                    try {
                        client.send(JSON.stringify({username: connection.meta.username, disconnectedType: connection.meta.type}))
                    } catch(e) {
                        console.warn("Error broadcasting closed connection", connection.meta, e)
                    }
                }
            })

            if (roomIsEmpty) {
                setTimeout(() => {

                    let roomStillEmpty = true

                    websocketClients.forEach(client => {
                        if (client.meta.room==connection.meta.room) {
                            roomStillEmpty = false
                        }
                    })

                    if (roomStillEmpty) {
                        rooms.splice(rooms.indexOf(connection.meta.room), 1)
                    }

                }, 10000)
            }
        })
    } catch(e) {console.log(`\nPrevented WebSocket crash. Rooms: ${rooms} Meta: ${connection.meta}`)}
}



// Helper Functions
// ================
const authenticateUser = (token, authenticator, callback) => {

    fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`)
    .then(googleResponse => googleResponse.json())
    .then(({aud,name,sub,email,picture}) => {

        if (aud.includes(googleClientId)) {
            callback({id: sub, name, email, picture})
        }
    })
}

// Export routes to these functions to the server
exports.initProject = ({sendDataCallback, error, r, rPub, rSub}) => {
    sendData = sendDataCallback
    returnError = error

    usersData = JSON.parse(fs.readFileSync("./usersData.json"))
    rooms = []

    return {
        get: {
            [/$/] : index,
            [/viewer$/] : viewer,
            [/controller$/] : controller,
            [/users\/[^\/]+$/] : userArea,
            [/users\/[^\/]+\/[0-9]+/]: vrViewer
        },
        post: {
            [/roomExists/] : roomExists,
            [/createRoom/] : createRoom,
            [/createEditRoom/] : createEditRoom,
            [/getEditScribble/] : getEditScribble,
            [/tokenSignin/] : tokenSignin,
            [/changeUsername/] : changeUsername,
            [/vrscreenshot/] : saveScreenshot,
            [/deleteScreenshot/] : deleteScreenshot
        },
        ws: handleWebSocket
    }
}