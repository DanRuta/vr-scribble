"use strict"
process.on(`uncaughtException`, console.error)

const fs = require("fs")
const http = require("http")
const https = require("https")
const url = require("url")
const crypto = require("crypto")
const mimes = require("mime-types")
const zlib = require("zlib")
const pug = require("pug")

const WebSocket = require("ws").Server
const DEVMODE = process.argv.includes("dev")

const hostname =  DEVMODE ? "localhost" : "danruta"
const ETags = {}

const getHandlers = []
const postHandlers= []
const WebSocketHandlers = {}

const PORTS = {http: 1337, https: 443, ws: 8000}

if (DEVMODE) {
    console.log("Dev mode")
}

const sendData = ({request, response, code=204, data, stream, contentType="text/plain", ETag, cacheControl}) =>  {

    stream && stream.on("error", () => error(response, 404)) && stream.on("end", stream.destroy)

    try {
        const send = isGZippedStream => {
            if (cacheControl && !DEVMODE) response.setHeader("Cache-Control", "public, max-age="+cacheControl)
            if (ETag && !DEVMODE)         response.setHeader("ETag", ETag)

            response.writeHead(code, {"Content-Type" : contentType})

            if (stream){
                if (isGZippedStream) {
                    stream.pipe(zlib.createGzip()).pipe(response)
                } else {
                    stream.pipe(response)
                }
            } else {
                response.end(data)
            }
        }

        // Add Gzip compression, if supported
        if (request.headers["accept-encoding"] && request.headers["accept-encoding"].includes("gzip")){

            if (data){
                zlib.gzip(data, (error, result) => {
                    data = result
                    response.setHeader("Content-Encoding", "gzip")
                    send()
                })
            } else if (stream){
                response.setHeader("Content-Encoding", "gzip")
                send(true)
            }
        } else send()

    }catch(e){console.log("Error sending data", e);console.trace()}
}

const error = (response, code, e) => {

    if (e) console.log(e)

    // Replace with server-side rendering of an error page
    response.writeHead(code, {"Content-Type": "text/html"})
    response.end(pug.renderFile("errorPage.pug", {code, codeDetails: http.STATUS_CODES[code]}))
}



const vrScribble = require("./vrscribble.js").initProject({sendDataCallback: sendData, error})

/*
    NOTE:
        This likely makes no sense without context, but it is done this way to allow the
        project to be hot-swappable in the production server, where many different projects
        are hot-swappable, being bound by the exposed RegExp API route bindings
*/

// Insert the project name into the start of each regex route
for (let getRoute in vrScribble.get) {
    vrScribble.get["/^\\/"+getRoute.slice(1,getRoute.length)] = vrScribble.get[getRoute]
    delete vrScribble.get[getRoute]
}

for (let postRoute in vrScribble.post) {
    vrScribble.post["/^\\/"+postRoute.slice(1,postRoute.length)] = vrScribble.post[postRoute]
    delete vrScribble.post[postRoute]
}

getHandlers.push(vrScribble.get)
postHandlers.push(vrScribble.post)
WebSocketHandlers["vrscribble"] = vrScribble.ws


// Compile all the request handlers
const compileHandlers = (getHandlers, postHandlers) => {

    let routesArray = []
    const routes = {
        GET: getHandlers.reduce((prev, curr) => Object.assign(prev, curr), {}),
        POST: postHandlers.reduce((prev, curr) => Object.assign(prev, curr), {})
    }

    for (let method in routes) {
        routesArray = routesArray.concat(Object.keys(routes[method]).map(regex => buildRegex(regex)))
    }

    return [routes, routesArray]
}

const buildRegex = route => {
    const withoutDelimiters = route.slice(1, route.lastIndexOf("/")),
    modifier = route.slice(route.lastIndexOf("/")+1)
    return new RegExp(withoutDelimiters, modifier)
}

const [requestRoutes, requestRoutesArray] = compileHandlers(getHandlers, postHandlers)

const handleRequests = (request, response) => {

    const subDomain = request.headers ? request.headers.host.split(hostname)[0].slice(0,-1) : ""
    let requestPath = url.parse(request.url).pathname
    let jsonData = ""

    console.log(`${new Date().toLocaleString()} ${request.method}:\t ${requestPath}`)

    // Build up the request data, from GET or more importantly, POST
    request.on("data", chunk => jsonData += chunk)
    request.on("end", () => {

        try {
            jsonData = jsonData.length ? JSON.parse(jsonData) : jsonData

            // Search for a route to match the request to, and default to static requests on failure
            const route = requestRoutesArray.filter(route => (requestPath).match(route))
            const action = requestRoutes[request.method][route]

            if (action) {
                action(request, response, jsonData)
            } else {
                // Default the requests without file extensions or just "/" to .html or "index.html", respectively
                if (!requestPath.match(/\.[^\/]+$/)) {
                    requestPath = requestPath=="/" ? "/index.html" : requestPath+".html"
                }

                // const serverFilePath = `./${subDomain || "portfolio"}${requestPath}`,
                const serverFilePath = `./${requestPath}`
                const extension = requestPath.split(".").pop()
                const contentType = mimes.contentType(extension)

                // Return an error if the extension given is not supported
                if (!contentType && extension!="wasm" || contentType=="application/json; charset=utf-8" && !requestPath.endsWith("manifest.json")) {
                    return error(response, 400)
                }

                fs.readFile(serverFilePath.replace(/%20/g, " "), (err, fileData) => {

                    if (fileData) {
                        const ETag = crypto.createHash("md5").update(fileData).digest("hex")
                        sendData({request, response, stream: fs.createReadStream(serverFilePath.replace(/%20/g, " ")), code: 200, contentType, ETag, cacheControl: 86400})
                    } else {
                        error(response, 404)
                    }
                })
            }

        } catch(e) {
            // catch no request data error
            error(response, 500, e)
        }
    })
}

// Start HTTP server
http.createServer((request,response) => {
    if (DEVMODE) {
        handleRequests(request, response)
    } else {
        if (request.headers.protocol=="http") {
            request.setHeader("Location", (request.headers.host+url.parse(request.url).pathname).replace("http:", "https:"))
            sendData({request, response, code: 302})
        } else handleRequests(request, response)
    }
}).listen(PORTS.http, () => console.log(`HTTP - Port: ${PORTS.http}`))

// Start WebSocket and secure WebSocket servers
const wsServers = [new WebSocket({port: PORTS.ws})]

// Start HTTPs server if not in dev mode
if (!DEVMODE) {
    httpsServer = https.createServer({
        key : fs.readFileSync("/etc/letsencrypt/keys/0012_key-certbot.pem"),
        cert: fs.readFileSync("/etc/letsencrypt/live/danruta.co.uk-0003/fullchain.pem")
    }, handleRequests).listen(PORTS.https, () =>  console.log(`HTTPs - Port: ${PORTS.https}`))

    wsServers.push(new WebSocket({server: httpsServer}))
}

wsServers.forEach(wss => {

    wss.on("connection", connection => {

        // Get the subdomain that the connection originates from, for routing
        const host = connection.upgradeReq.headers.origin
        const subDomain = host.slice(host.indexOf("//")+2, host.indexOf("."))
        console.log("New WS connection")

        // Compile a list of clients from both the normal and secure WebSocket servers
        const clients = wsServers.reduce((prev, curr) => {
            return {clients: prev.clients.concat(curr.clients)}
        }, {clients: []})

        // Route the connection and further messages to its project file, only if registered
        if (WebSocketHandlers.hasOwnProperty(subDomain)) {
           WebSocketHandlers[subDomain](connection, clients.clients)
        }
    })
})