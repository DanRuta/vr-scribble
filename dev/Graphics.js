"use strict"

class Graphics {

    // Init the canvas to be used for rendering icons on
    constructor (iconsSize, toastHeight, toastWidth, barHeight, barWidth, sliderHeight, sliderWidth) {

        // Icons
        this.canvas = document.createElement("canvas")
        this.canvas.height = this.canvas.width = this.size = iconsSize
        this.context = this.canvas.getContext("2d")

        // Toast
        this.toastCanvas = document.createElement("canvas")
        this.toastCanvas.height = toastHeight
        this.toastCanvas.width = toastWidth
        this.toastContext = this.toastCanvas.getContext("2d")
        this.toastContext.font = "40px Arial"
        this.toastContext.textAlign = "center"

        // Colour Sphere
        this.colourCanvas = document.createElement("canvas")
        this.colourCanvas.height = 1024
        this.colourCanvas.width = 2048
        this.colourContext = this.colourCanvas.getContext("2d")
        this.colourContext.lineWidth = 5
        this.renderColourWheel(false)

        this.colourRenderedTexture = document.createElement("img")

        // Options Bar
        this.barCanvas = document.createElement("canvas")
        this.barCanvas.height = barHeight
        this.barCanvas.width = barWidth
        this.barContext = this.barCanvas.getContext("2d")

        // Slider
        this.sliderCanvas = document.createElement("canvas")
        this.sliderCanvas.height = sliderHeight
        this.sliderCanvas.width = sliderWidth
        this.sliderContext = this.sliderCanvas.getContext("2d")


        setTimeout(() => {

            // Option bar items' labels and icons
            this.barItems = [
                {label: "Undo", active: this.renderUndo(true), inactive: this.renderUndo()},
                {label: "Redo", active: this.renderRedo(true), inactive: this.renderRedo()},
                {label: "Colour", active: this.renderColourWheel(true), inactive: this.renderColourWheel()},
                {label: "Opacity", active: this.renderOpacity(true), inactive: this.renderOpacity()},
                {label: "Thickness", active: this.renderThickness(true), inactive: this.renderThickness()},
                {label: "Screenshot", active: this.renderScreenshot(true), inactive: this.renderScreenshot()},
                {label: "Clear", active: this.renderClear(true), inactive: this.renderClear()}
            ]
        }, 500)
    }

    // Show the toast message for 3 seconds
    renderToast (message) {

        this.toastContext.fillRect(0,0, this.toastCanvas.width, this.toastCanvas.height)
        this.toastContext.fillStyle = "white"
        this.toastContext.fillRect(3,3, this.toastCanvas.width-6, this.toastCanvas.height-6)
        this.toastContext.fillStyle = "black"
        this.toastContext.fillText(message, this.toastCanvas.width/2, this.toastCanvas.height*0.75)

        clearTimeout(this.toastTimeout)

        this.toastTimeout = setTimeout(() => {
            this.toastContext.clearRect(0,0,this.toastCanvas.width, this.toastCanvas.height)
        }, 4000)
    }


    // Render Colour Sphere for picking a colour
    renderColourSphere (sphereOpen) {

        // Clear and exit early if the sphere is not toggled open
        if (!sphereOpen) {
            this.colourContext.clearRect(0,0, this.colourCanvas.width, this.colourCanvas.height)
            return
        }

        if (this.colourRenderedTexture.src) {
            this.colourContext.drawImage(this.colourRenderedTexture,0,0)
            return
        }

        const step = this.colourCanvas.width/360
        this.colourContext.lineWidth = step*2

        // Iterate through the rows and columns of pixels to render gradients to
        let column = 0

        while (column<=360) {

            // Create a new gradient for each column
            let gradient = this.colourContext.createLinearGradient(0,0,0,this.colourCanvas.height)

            for (let row=0; row<=1; row+=0.01) {
                gradient.addColorStop(row, `hsl(${column}, 100%, ${100*(1-row)}%)`)
            }

            // Render the gradient column to the canvas
            this.colourContext.beginPath()
            this.colourContext.moveTo(column*step, 0)
            this.colourContext.strokeStyle = gradient
            this.colourContext.lineTo(column*step, this.colourCanvas.height)
            this.colourContext.stroke()
            this.colourContext.closePath()

            column++
        }

        // Save the texture to an image, to avoid re-rendering it every time it is shown
        this.colourRenderedTexture.src = this.colourCanvas.toDataURL()
    }

    // Render options bar
    renderBar (barOpen, selectedIndex) {

        // Clear away the options bar if the user has not opened it
        if (!barOpen) {
            this.barContext.clearRect(0,0, this.barCanvas.width, this.barCanvas.height)
            this.renderSlider()
            return
        }

        // Draw Lines
        this.barContext.fillStyle = "rgb(255,255,255)"
        this.barContext.fillRect(0,0, this.barCanvas.width, this.barCanvas.height)
        this.barContext.fillStyle = "rgb(0,0,0)"
        this.barContext.textAlign = "center"
        this.barContext.font = "bold 35px Arial"
        this.barContext.strokeWidth = 100

        let barItemWidth = this.barCanvas.width/this.barItems.length

        for (let item in this.barItems) {

            // Draw line
            this.barContext.moveTo(barItemWidth*item,0)
            this.barContext.lineTo(barItemWidth*item, this.barCanvas.height)

            // Draw Icon
            let img = document.createElement("img")
            img.src = this.barItems[item].inactive

            this.barContext.drawImage(img, barItemWidth*item+barItemWidth*0.1429, this.barCanvas.height/15)

            // Draw Label
            this.barContext.fillText(this.barItems[item].label, this.barCanvas.width/this.barItems.length/2+this.barCanvas.width/this.barItems.length*item, this.barCanvas.height*0.9)
        }
        this.barContext.stroke()

        // Shade selected Item
        this.barContext.fillStyle = "rgba(0,0,0,0.25)"

        this.barContext.beginPath()
        this.barContext.moveTo(this.barCanvas.width/this.barItems.length*selectedIndex, 0)
        this.barContext.fillRect(this.barCanvas.width/this.barItems.length*selectedIndex,0, barItemWidth, this.barCanvas.height)

        // Draw Icon
        let img = document.createElement("img")
        img.src = this.barItems[selectedIndex].active

        this.barContext.drawImage(img, barItemWidth*selectedIndex+barItemWidth*0.1429, this.barCanvas.height/15)
        this.barContext.stroke()
    }


    // Render the slider used to display opacity or thickness adjustments
    renderSlider (opacityOpen, thicknessOpen, opacity, thickness) {

        const sliderHeight = this.sliderCanvas.height
        const sliderWidth = this.sliderCanvas.width

        // Clear existing content
        this.sliderContext.fillStyle = "rgb(255,255,255)"
        this.sliderContext.fillRect(0,0, this.sliderCanvas.width, this.sliderCanvas.height)

        // Render either the opacity or thickness slider
        if (opacityOpen) {

            // Render the squares
            this.sliderContext.fillStyle = "rgb(100,100,100)"

            const boxSize = 15
            const squaresTall = sliderHeight/boxSize
            const squaresWide = sliderWidth/boxSize

            for (let row=0; row<squaresTall; row++) {

                for (let column=0; column<=squaresWide; column++) {
                    this.sliderContext.beginPath()
                    this.sliderContext.fillStyle = (column+row)%2==0 ? "rgb(240,240,240)" : "rgb(200,200,200)"
                    this.sliderContext.fillRect(column*boxSize, row*boxSize, (column+1)*boxSize, (row+1)*boxSize)
                    this.sliderContext.stroke()
                }
            }

            // Render the circle
            this.sliderContext.beginPath()
            this.sliderContext.strokeStyle = `rgba(0,0,0,${opacity})`
            this.sliderContext.fillStyle = `rgba(0,0,0,${opacity})`
            this.sliderContext.arc(sliderWidth/2, sliderHeight/2, thickness, 2*Math.PI, false)
            this.sliderContext.fill()
            this.sliderContext.stroke()

            // Render white box overlay with text
            this.sliderContext.fillStyle = "white"
            this.sliderContext.fillRect(0,sliderHeight-30, sliderWidth, sliderHeight)
            this.sliderContext.fillStyle = "black"
            this.sliderContext.font = "30px Arial"
            this.sliderContext.textAlign = "center"
            this.sliderContext.fillText(`Opacity: ${opacity.toFixed(2)}`, sliderWidth/2, sliderHeight-10)

            this.sliderContext.stroke()

        } else if (thicknessOpen) {

            this.sliderContext.fillStyle = "rgba(0,0,0,0.7)"

            const triangleHeight = sliderHeight/10*8
            const triangleWidth = sliderWidth/8*6

            const thicknessYPos = triangleHeight-triangleHeight*thickness/100+sliderHeight/10
            const thicknessXPos = thickness/100*triangleWidth/2

            // Render the background triangle
            this.sliderContext.beginPath()
            this.sliderContext.moveTo(sliderWidth/8, sliderHeight/10)
            this.sliderContext.lineTo(sliderWidth/2, sliderHeight/10*9)
            this.sliderContext.lineTo(sliderWidth/8*7, sliderHeight/10)
            this.sliderContext.lineTo(sliderWidth/8, sliderHeight/10)

            this.sliderContext.stroke()

            // Render the thickness triangle
            this.sliderContext.beginPath()
            this.sliderContext.moveTo(sliderWidth/2-thicknessXPos, thicknessYPos)

            this.sliderContext.lineTo(sliderWidth/2, sliderHeight/10*9)

            this.sliderContext.lineTo(sliderWidth/2+thicknessXPos, thicknessYPos)
            this.sliderContext.lineTo(sliderWidth/2-thicknessXPos, thicknessYPos)

            this.sliderContext.fill()

            // Render white box overlay with text
            this.sliderContext.fillStyle = "white"
            this.sliderContext.fillRect(0,sliderHeight-30,sliderWidth, sliderHeight)
            this.sliderContext.fillStyle = "black"
            this.sliderContext.font = "30px Arial"
            this.sliderContext.textAlign = "center"

            this.sliderContext.fillText(`Thickness: ${thickness}`, sliderWidth/2, sliderHeight-10)
            this.sliderContext.stroke()

        } else {
            this.sliderContext.clearRect(0,0, this.sliderCanvas.width, this.sliderCanvas.height)
        }

    }

    // Return the canvas used for the toast box texture
    getToastCanvas () {
        return this.toastCanvas
    }

    // Return the canvas used for the colour sphere texture
    getColourSphereCanvas () {
        return this.colourCanvas
    }

    // Return the canvas used for the options bar texture
    getBarCanvas () {
        return this.barCanvas
    }

    // Return the canvas used for the slider texture
    getSliderCanvas () {
        return this.sliderCanvas
    }

    // Render Icons
    renderUndo (isActive) {

        const S = this.size

        this.context.clearRect(0,0,S,S)
        this.context.beginPath()

        this.context.moveTo(S/10*2,  S/10*2)
        this.context.lineTo(S/10*2,  S/10*5.5)
        this.context.lineTo(S/2,     S/10*5)
        this.context.lineTo(S/10*4,  S/10*4)

        this.context.bezierCurveTo(S/2, S/10*2, S/10*8, S/10*4, S/10*7.5, S/10*6)
        this.context.bezierCurveTo(S/10*9, S/10*2, S/10*4, S/10  , S/10*3, S/10*3)

        this.context.lineTo(S/10*2, S/10*2)

        this.context.stroke()

        this.context.fillStyle = isActive ? "rgb(30,150,180)" : "rgba(100,100,100,0.8)"
        this.context.fill()

        return this.canvas.toDataURL();
    }

    renderRedo (isActive) {

        const S = this.size

        this.context.clearRect(0,0,S,S)
        this.context.beginPath()

        this.context.moveTo(S/10*8,  S/10*2)
        this.context.lineTo(S/10*8,  S/10*5.5)
        this.context.lineTo(S/2,     S/10*5)
        this.context.lineTo(S/10*6,  S/10*4)

        this.context.bezierCurveTo(S/2, S/10*2, S/10*2, S/10*4, S/10*2.5, S/10*6)
        this.context.bezierCurveTo(S/10, S/10*2, S/10*6, S/10  , S/10*7, S/10*3)

        this.context.lineTo(S/10*8, S/10*2)

        this.context.stroke()

        this.context.fillStyle = isActive ? "rgb(30,150,180)" : "rgba(100,100,100,0.8)"
        this.context.fill()

        return this.canvas.toDataURL()
    }


    renderColourWheel (isActive) {

        const S = this.size
        const r = S/10*4

        let i = 0

        this.context.clearRect(0,0,S,S)

        while (i<360) {

            this.context.save()
            this.context.translate(S/10*5,S/10*5)
            this.context.rotate(Math.PI * i/180)

            let gradient = this.context.createLinearGradient(0,0,r,r)

            for (let step=0; step<0.5; step+=0.01) {
                gradient.addColorStop(step,`hsl(${i}, ${isActive ? 100 : 0}%, ${100*(1-step)}%)`)
            }

            this.context.beginPath()
            this.context.moveTo(0,0)
            this.context.strokeStyle = gradient

            this.context.lineTo(0,r)
            this.context.stroke()
            this.context.closePath()

            this.context.restore()

            i += 0.1;
        }

        return this.canvas.toDataURL()
    }

    renderOpacity (isActive) {

        const S = this.size
        this.context.clearRect(0,0,S,S)

        // Render the squares
        this.context.strokeStyle = `rgba(150,150,150,${isActive ? 1 : 0.8})`
        this.context.rect(S*0.5,S*0.2,S*0.3,S*0.6)

        this.context.fillStyle = "white"
        this.context.fill()

        this.context.fillStyle = `rgba(200,200,200,${isActive ? 1 : 0.8})`
        this.context.fillRect(S*0.5,S*0.2,S*0.15,S*0.2)
        this.context.fillRect(S*0.65,S*0.4,S*0.15,S*0.2)
        this.context.fillRect(S*0.5,S*0.6,S*0.15,S*0.2)

        this.context.stroke()

        // Render circle
        this.context.beginPath()
        this.context.fillStyle = isActive ? "rgba(0,0,0,0.75)" : "rgba(100,100,100,0.75)"
        this.context.arc(S/2, S/2, 25, 2*Math.PI, false)
        this.context.fill()

        return this.canvas.toDataURL()
    }

    renderThickness (isActive) {

        const S = this.size
        this.context.clearRect(0,0,S,S)

        this.context.strokeStyle = `rgba(0,0,0,${isActive ? 1 : 0.7})`
        this.context.fillStyle = "white"

        // Render the triangle
        this.context.beginPath()

        this.context.moveTo(S/8, S/10)
        this.context.lineTo(S/2, S/10*9)
        this.context.lineTo(S/8*7, S/10)
        this.context.lineTo(S/8, S/10)

        this.context.stroke()
        this.context.fill()

        this.context.fillStyle = `rgba(0,0,0,${isActive ? 1 : 0.7})`

        // Render the filled in triangle
        this.context.beginPath()

        this.context.moveTo(S/4, S/10*3.8)
        this.context.lineTo(S/2, S/10*9)
        this.context.lineTo(S/4*3, S/10*3.8)
        this.context.lineTo(S/4, S/10*3.8)

        this.context.fill()

        return this.canvas.toDataURL()
    }

    renderScreenshot (isActive) {

        const S = this.size

        this.context.clearRect(0,0,S,S)
        this.context.beginPath()

        this.context.fillStyle = isActive ? "rgb(20,200,20)" : "rgba(100,100,100,0.8)"

        this.context.moveTo(S/10*3.5, S/8*1)
        this.context.lineTo(S/10*3.5, S/8*5)
        this.context.lineTo(S/10*1.5, S/8*5)
        this.context.lineTo(S/2, S/8*7)
        this.context.lineTo(S/10*8.5, S/8*5)
        this.context.lineTo(S/10*6.5, S/8*5)
        this.context.lineTo(S/10*6.5, S/8*1)
        this.context.lineTo(S/10*3.5, S/8*1)

        this.context.stroke()
        this.context.fill()

        return this.canvas.toDataURL()
    }

    renderClear (isActive) {

        const S = this.size

        this.context.clearRect(0,0,S,S)
        this.context.beginPath()

        this.context.fillStyle = isActive ? "rgb(250,0,0)" : "rgba(100,100,100,0.8)"

        this.context.moveTo(S/10,   S/10*3)
        this.context.lineTo(S/10*3, S/2)
        this.context.lineTo(S/10,   S/10*7)
        this.context.lineTo(S/10*3, S/10*9)
        this.context.lineTo(S/2,    S/10*7)
        this.context.lineTo(S/10*7, S/10*9)
        this.context.lineTo(S/10*9, S/10*7)
        this.context.lineTo(S/10*7, S/2)
        this.context.lineTo(S/10*9, S/10*3)
        this.context.lineTo(S/10*7, S/10)
        this.context.lineTo(S/2,    S/10*3)
        this.context.lineTo(S/10*3, S/10)
        this.context.lineTo(S/10,   S/10*3)

        this.context.stroke()
        this.context.fill()

        return this.canvas.toDataURL()
    }
}