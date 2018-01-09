"use strict"

class Interface {

    constructor (sphereRadius, sphereVertexCount, WebSocket, connectionRoom) {

        this.sphereRadius = sphereRadius
        this.sphereVertexCount = sphereVertexCount
        this.WebSocket = WebSocket
        this.connectionRoom = connectionRoom

        // Init the Icons rendering class
        this.Graphics = new Graphics(150, 50, 750, 225, 1575, 450, 225)

        this.optionsBarOpen = false
        this.tappingOnOptionsBar = false

        // Set bar selected item index, and slider box status
        this.selectedIndex = 0
        this.colourOpen = false
        this.opacityOpen = false
        this.thicknessOpen = false

        this.selectingOpacity = false
        this.selectingThickness = false

        // Instantiate toast box
        this.toastBox = new InterfaceBox("toastBox", this.Graphics.getToastCanvas(), 1000, 50, 550, -350, -0.75)
        this.toastBox.setLocation(180)

        // Define the coordinate positions for when the controller is used to navigate the interface
        this.startAlpha = 0
        this.startBeta = 0
        this.deltaAlpha = 0
        this.deltaBeta = 0

        // Set the distance needed for the controller to move to activate an interface navigation
        this.horizontalStep = 15
        this.verticalStep = 1

        // Define all interface actions that can be taken, into the window.vrscribble object, for use with voice control, outside interface
        window.vrscribble.optionOpen = (override) => {

            // Toggle the options menu
            this.optionsBarOpen = override || !this.optionsBarOpen

            // Set the interface start coordinates, to allow controller navigation calculations
            this.startAlpha = this.User.cursor.alpha
            this.startBeta = this.User.cursor.beta

            // Place the boxes in the center of the user's vision
            this.optionsBox.setLocation(360-(window.vrscribble.camera.rotation.y*180/Math.PI+270)%360)
            this.sliderBox.setLocation(360-(window.vrscribble.camera.rotation.y*180/Math.PI+270)%360)
            this.toastBox.setLocation(360-(window.vrscribble.camera.rotation.y*180/Math.PI+270)%360)

            this.renderBar()
        }

        window.vrscribble.optionClose = () => {

            if (this.optionsBarOpen) {
                // Close options bar
                this.optionsBarOpen = false
                this.renderBar()

            } else if (this.colourOpen) {

                // Toggle closed the colour sphere
                this.colourOpen = false
                this.User.pickingColour = false
                this.Graphics.renderColourSphere(false)
                this.User.renderCursor()
            }
        }

        window.vrscribble.optionUndo = () => {

            if (this.User.brush.strokeNo>0) {
                this.User.brush.strokeNo--
                this.User.undoneOrRedone = true
            }
        }

        window.vrscribble.optionRedo = () => {

            if (this.User.brush.strokeNo<this.User.strokeQueue.length) {
                this.User.brush.strokeNo++
                this.User.undoneOrRedone = true
            }
        }

        window.vrscribble.optionOpacity = () => {

            // Set the options bar to be open, at the option index of the opacity option
            window.vrscribble.optionOpen(true)
            this.selectedIndex = 3

            this.opacityOpen = true
            this.selectingOpacity = true

            // Update interface
            this.renderBar()
            this.Graphics.renderSlider(this.opacityOpen, this.thicknessOpen, this.User.brush.opacity, this.User.brush.thickness)
        }

        window.vrscribble.optionThickness = () => {

            // Set the options bar to be open, at the option index of the thickness option
            window.vrscribble.optionOpen(true)
            this.selectedIndex = 4

            this.thicknessOpen = true
            this.selectingThickness = true

            // Update interface
            this.renderBar()
            this.Graphics.renderSlider(this.opacityOpen, this.thicknessOpen, this.User.brush.opacity, this.User.brush.thickness)
        }

        window.vrscribble.optionColourSphere = () => {

            this.colourOpen = true
            this.User.pickingColour = true

            // Hide the options bar
            this.optionsBarOpen = false
            this.renderBar()

            // Update colour sphere and user's cursor
            this.Graphics.renderColourSphere(this.colourOpen)
            this.User.renderCursor()
        }

        window.vrscribble.optionScreenshot = () => {

            this.User.screenshotReady = true

            if (this.optionsBarOpen) {
                // Close options bar
                this.optionsBarOpen = false
                this.renderBar()
            }
        }

        window.vrscribble.optionClear = () => {

            this.User.clearSelected = true

            this.clearVoteTimeoutFunction = setTimeout(() => {this.User.clearSelected = false}, 15000)
            window.vrscribble.optionClose()

            WebSocket.send(JSON.stringify({username: this.User.name , room: connectionRoom, type: "viewer", clearVote : true}))
        }
    }

    renderBar () {

        // Clear away the options bar and slider states if bar not open
        if (!this.optionsBarOpen) {
            this.opacityOpen = false
            this.thicknessOpen = false
        }

        this.Graphics.renderBar(this.optionsBarOpen, this.selectedIndex)
    }

    // A pass-through for toasts rendered from the view.js file, which updates the toast box location as well
    renderToast (message) {

        this.toastBox.setLocation(360-(window.vrscribble.camera.rotation.y*180/Math.PI+270)%360)
        this.Graphics.renderToast(message)
    }

    // Apply the actions corresponding to the user's inputs
    handleAction (actions) {

        for(let action of actions) {

            switch(action) {

                // Cursor Controller options
                case("up"):

                    // Increase either the brush opacity or thickness if either are open
                    if (this.opacityOpen) {
                        this.User.brushOpacity = Math.min(1, this.User.brush.opacity+0.05)
                    } else if (this.thicknessOpen) {
                        this.User.brushThickness = Math.min(100, this.User.brush.thickness+1)
                    }

                    this.User.renderCursor()
                    this.Graphics.renderSlider(this.opacityOpen, this.thicknessOpen, this.User.brush.opacity, this.User.brush.thickness)
                    break

                case("down"):

                    // Lower the User's opacity or thickness if either options are open
                    if (this.opacityOpen) {
                        this.User.brushOpacity = Math.max(0, this.User.brush.opacity-0.05)
                    } else if (this.thicknessOpen) {
                        this.User.brushThickness = Math.max(0, this.User.brush.thickness-1)
                    }

                    this.User.renderCursor()
                    this.Graphics.renderSlider(this.opacityOpen, this.thicknessOpen, this.User.brush.opacity, this.User.brush.thickness)
                    break

                case("left"):

                    // Don't navigate options if sliders are open
                    if (this.opacityOpen || this.thicknessOpen) {
                        break
                    }

                    this.selectedIndex = Math.max(0, this.selectedIndex-1)
                    this.renderBar()
                    break

                case("right"):

                    // Don't navigate options if sliders are open
                    if (this.opacityOpen || this.thicknessOpen) {
                        break
                    }

                    this.selectedIndex = Math.min(6, this.selectedIndex+1)
                    this.renderBar()
                    break

                // Touch Controlled options
                case("mousedown"):
                    this.selectOption()
                    break

                case("mouseup"):
                    this.finishSelection()
                    break

                // Voice Controlled options
                case("options"):
                case("space"):
                    window.vrscribble.optionOpen(true)
                    break

                case("close"):
                    window.vrscribble.optionClose()
                    break

                case("undo"):
                    window.vrscribble.optionUndo()
                    break

                case("redo"):
                    window.vrscribble.optionRedo()
                    break

                case("colour"):
                    window.vrscribble.optionColourSphere()
                    break

                case("opacity"):
                    window.vrscribble.optionOpacity()
                    break

                case("thickness"):
                    window.vrscribble.optionThickness()
                    break

                case("screenshot"):
                    window.vrscribble.optionScreenshot()
                    break
            }
        }
    }

    // Select the interface item
    selectOption () {

        // Define an action for each option index
        let indexActions = [

            window.vrscribble.optionUndo,
            window.vrscribble.optionRedo,
            window.vrscribble.optionColourSphere,

            () => {
                if (!this.selectingOpacity) {

                    this.opacityOpen = true
                    this.selectingOpacity = true

                } else this.selectingOpacity = false
            },

            () => {
                if (!this.selectingThickness) {

                    this.thicknessOpen = true
                    this.selectingThickness = true

                } else this.selectingThickness = false
            },

            window.vrscribble.optionScreenshot,
            window.vrscribble.optionClear
        ]

        indexActions[this.selectedIndex]()

        // Update options bar, slider and cursor textures
        this.renderBar()
        this.Graphics.renderSlider(this.opacityOpen, this.thicknessOpen, this.User.brush.opacity, this.User.brush.thickness)
        this.User.renderCursor()
    }

    //  Determine what to close, if it is time to close anything
    finishSelection () {

        // Close the bar and Opacity slider on the second touch end
        if (!this.selectingOpacity && this.opacityOpen) {
            this.optionsBarOpen = false
            this.opacityOpen = false
        }

        // Close the bar and Thickness slider on the second touch end
        if (!this.selectingThickness && this.thicknessOpen) {
            this.optionsBarOpen = false
            this.thicknessOpen = false
        }

        // Update bar and slider textures
        this.renderBar()
        this.Graphics.renderSlider(this.opacityOpen, this.thicknessOpen, this.User.brush.opacity, this.User.brush.thickness)
    }

    // Apply a user class to this interface
    set user (user) {

        this.User = user

        // Show message during controller connection
        this.Graphics.renderToast("Connecting controller...")
        this.toastBox.setLocation(360-(window.vrscribble.camera.rotation.y*180/Math.PI+270)%360)

        // Instantiate options box
         this.renderBar()
        this.optionsBox = new InterfaceBox("optionsBar", this.Graphics.getBarCanvas(), 1575, 225, 750, -300, -0.5)

         // Instantiate option slider
         this.Graphics.renderSlider(false, false, this.User.brush.opacity, this.User.brush.thickness)
         this.sliderBox = new InterfaceBox("optionSlider", this.Graphics.getSliderCanvas(), 225, 450, 800, 50)

         // Instantiate Colour Sphere
         window.vrscribble.textures.colourTexture = new THREE.Texture(this.Graphics.getColourSphereCanvas())
        const colourMaterial = new THREE.MeshBasicMaterial({
            map: window.vrscribble.textures.colourTexture,
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false
        })
        window.vrscribble.scene.add(new THREE.Mesh(new THREE.SphereGeometry(this.sphereRadius-75, this.sphereVertexCount, this.sphereVertexCount), colourMaterial))
        window.vrscribble.textures.colourTexture.minFilter = THREE.NearestFilter
    }

    // Set the controller current coordinates, relative to starting coordinates, for navigating the interface
    set currentCoords ({alpha, beta, actions=[], isDrawing}) {

        // Get the distance moved
        this.deltaAlpha = alpha - this.startAlpha
        this.deltaBeta = beta - this.startBeta

        // Determine if the user has pressed down/lifted up tap on the screen for an action
        if (!this.tappingOnOptionsBar && isDrawing) {
            this.handleAction(["mousedown"])
        } else if (this.tappingOnOptionsBar && !isDrawing) {
            this.handleAction(["mouseup"])
        }

        this.tappingOnOptionsBar = isDrawing

        // If the controller has moved more than the needed step, navigate the interface
        switch(true) {

            // Moving left
            case(this.deltaAlpha<=-this.horizontalStep):
                actions.push("left")
                this.startAlpha+= this.deltaAlpha
                break

            // Moving right
            case(this.deltaAlpha>=this.horizontalStep):
                actions.push("right")
                this.startAlpha+= this.deltaAlpha
                break

            // Moving up
            case(this.deltaBeta>=this.verticalStep):
                actions.push("up")
                this.startBeta+= this.deltaBeta
                break

            // Moving down
            case(this.deltaBeta<=-this.verticalStep):
                actions.push("down")
                this.startBeta+= this.deltaBeta
                break
        }

        this.handleAction(actions)
    }
}