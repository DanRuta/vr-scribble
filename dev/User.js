"use strict"

class User {

    constructor (userData, sphereRadius, sphereVertexCount) {

        this.name = userData.name
        this.isDrawing = false
        this.isPickingColour = false
        this.bufferTextureReady = false
        this.undoneOrRedone = false
        this.screenshotReady = false
        this.clearSelected = false
        this.clearVoteTimeoutFunction = null;

        this.cursor = {
            alpha: 0,
            beta: 0,
            posX : 0,
            posY : 0,
            offsetZ : 0,
            rotationX : 0
        }

        this.brush = {
            strokeNo : 0,
            thickness : 15,
            opacity: 1,
            hsl : {
                h : 221,
                s : 100,
                l : 45
            },
            colour : "hsla(221,100%,45%,1)"
        }

        // Initialise user's cursor, stroke and alphaMap canvases
        this.cursorCanvas = document.createElement("canvas")

        this.cursorCanvas.height = 1024
        this.cursorCanvas.width = 2048
        this.cursorContext = this.cursorCanvas.getContext("2d")

        this.strokeQueue = []
        this.stroke = new Stroke(this.brush.colour, this.brush.thickness, this.cursorCanvas.width, this.cursorCanvas.height)


        // Initialise cursor sphere
        this.cursorTexture = new THREE.Texture(this.cursorCanvas)
        let cursorMaterial = new THREE.MeshBasicMaterial({
            map: this.cursorTexture,
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false
        })
        this.cursorTexture.minFilter = THREE.NearestFilter
        this.cursorSphere = new THREE.Mesh(new THREE.SphereGeometry(sphereRadius-100, sphereVertexCount, sphereVertexCount), cursorMaterial)

        window.vrscribble.scene2.add(this.cursorSphere)
        this.renderCursor()
        this.destination = {a: null, b: null}
    }

    // Class Methods
    renderCursor (keepTransparent) {

        // Clear
        this.cursorContext.clearRect(0,0, this.cursorCanvas.width, this.cursorCanvas.height)

        if (this.isPickingColour) {
            // Fill the inner circle with the hovered over colour if picking colour from colour sphere
            this.cursorContext.beginPath()
            this.cursorContext.fillStyle = this.getColourFromSphere(true)
            this.cursorContext.arc(this.cursorCanvas.width/2, this.cursorCanvas.height/2, this.brush.thickness/2, 0, 2*Math.PI)
            this.cursorContext.fill()
        }

        // Outer black cursor border
        this.cursorContext.beginPath()
        this.cursorContext.strokeStyle = `rgba(0,0,0,${keepTransparent ? 0.1 : 1})`
        this.cursorContext.lineWidth = 6
        this.cursorContext.arc(this.cursorCanvas.width/2, this.cursorCanvas.height/2, this.brush.thickness/2, 0, 2*Math.PI)
        this.cursorContext.stroke()

        this.cursorContext.beginPath()
        this.cursorContext.strokeStyle = `hsla(${this.brush.hsl.h}, ${this.brush.hsl.s}%, ${this.brush.hsl.l}%, ${keepTransparent ? 0.1 : 1})`
        this.cursorContext.lineWidth = 4
        this.cursorContext.arc(this.cursorCanvas.width/2, this.cursorCanvas.height/2, this.brush.thickness/2, 0, 2*Math.PI)
        this.cursorContext.stroke()
    }

    // Determine what colour in the colour sphere the cursor is hovering over
    getColourFromSphere (noUpdate) {

        const h = this.cursor.posX/2048*360
        const l = 100-this.cursor.posY/1024*100

        if (!noUpdate) {
            this.brush.hsl.h = h
            this.brush.hsl.l = l
            this.compileBrushColour()
        }

        return `hsla(${h}, 100%, ${l}%, ${this.brush.opacity.toFixed(2)})`
    }

    // Put together all components of the brush colour
    compileBrushColour () {
        this.brush.colour = `hsla(${this.brush.hsl.h}, ${this.brush.hsl.s}%, ${Math.round(this.brush.hsl.l)}%, ${this.brush.opacity.toFixed(2)})`
        this.stroke.colour = this.brush.colour
    }

    // Update the cursor sphere's rotation, to match user brush location
    updateCursorSphereRotation (alpha, beta) {
        this.destination = {a: -0.0174533*alpha, b: -0.0174533*(beta+360)/2}
    }

    // Smoothly move the cursor to the destination coordinates
    lerpCursor () {

        // Get the midpoint between the current and destination coordinates, to lerp between
        this.midpoint = {a: (this.cursorSphere.rotation.y+this.destination.a)/2, b: (this.cursorSphere.rotation.z+this.destination.b)/2}

        // Get the distances to move (for checking in the following if statement)
        let distances = {
            a: this.midpoint.a-this.cursorSphere.rotation.y,
            b: this.midpoint.b-this.cursorSphere.rotation.z
        }

        // Detect if the cursor has moved around the entire axis (360 <-> 0) and move directly instead of lerping
        // The values are very small because these are calculated every frame

        if (Math.abs(distances.a)>1 || Math.abs(distances.b)>1) {

            this.cursorSphere.rotation.y = this.destination.a
            this.cursorSphere.rotation.z = this.destination.b

        } else {
            // Lerp as normal
            // Update the cursor sphere rotation
            this.cursorSphere.rotation.y += distances.a / 3
            this.cursorSphere.rotation.z += distances.b / 3
        }
    }


    // Either select colour from colour sphere, or draw, when clicked/tapped
    activateCursor (isActive) {

        if (this.isPickingColour && isActive) {
            // Select colour from colour sphere
            this.getColourFromSphere()

        } else {
            // Draw onto the canvas, as normal
            // Stop the drawing if the drawing state differs from the WS message's drawing state
            if (this.isDrawing && !isActive) {

                // Increment stroke number
                this.brush.strokeNo++

                // Remove old 'undone' strokes (to write over with new strokes)
                this.strokeQueue = this.strokeQueue.slice(0, this.brush.strokeNo-1)

                // Add the current stroke to the queue, and start a new stroke
                this.strokeQueue.push(this.stroke)
                // this.stroke = new Stroke(this.brush.colour, this.brush.thickness/4, this.cursorCanvas.width, this.cursorCanvas.height)
                this.stroke = new Stroke(this.brush.colour, this.brush.thickness, this.cursorCanvas.width, this.cursorCanvas.height)

                // Set this user's buffer canvas ready state to true, so that the render loop picks the stroke data up
                this.bufferTextureReady = true;

                // Restore the cursor
                this.renderCursor()
            }

            // Update the class' drawing state for correct handling of future messages
            this.isDrawing = isActive;
        }
    }

    // Getters
    get username () {
        return this.name;
    }

    get posX () {
        return this.cursor.posX;
    }

    get posY () {
        return this.cursor.posY;
    }

    // Send the new stroke item to the buffer texture, to be displayed
    get bufferItem () {
        this.bufferTextureReady = false;
        return this.strokeQueue[this.strokeQueue.length-1]
    }

    // Setters
    // Set wether or not the user has the colour sphere open or not
    set pickingColour (bool) {
        this.isPickingColour = bool
    }

    set brushOpacity (opacity) {
        this.brush.opacity = opacity
        this.compileBrushColour()
    }

    set brushThickness (thickness) {
        this.brush.thickness = thickness
        this.stroke.brushWidth = thickness
    }

    set position (cursorData) {

        this.updateCursorSphereRotation(cursorData.alpha, cursorData.beta)

        // Used for setting init position when opening interface using voice commands
        this.cursor.alpha = cursorData.alpha
        this.cursor.beta = cursorData.beta

        this.cursor.rotationX = Math.sin(cursorData.beta*Math.PI/180)

        this.cursor.posX = this.cursorCanvas.width - parseInt(cursorData.alpha)/90 * this.cursorCanvas.width/2
        this.cursor.posY = this.cursorCanvas.height - this.cursorCanvas.height*((cursorData.beta+180)/360)

        // Add points to render points, if drawing
        if (this.isDrawing) {

            // Hide the cursor while drawing, to avoid the lerping causing non-alignment
            if (this.stroke.layers[0].length==0) {
                this.renderCursor(true)
            }

            this.stroke.add(this.cursor.posX, this.cursor.posY)

        } else if (this.isPickingColour) {

            // Else, if picking colour, re-render the cursor with the hovered over
            // colour as the inner circle colour
            this.renderCursor()
        }
    }
}