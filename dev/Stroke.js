"use strict"

class Stroke {

    constructor (colour, brushWidth, canvasWidth, canvasHeight) {

        this.colour = colour
        this.brushWidth = brushWidth
        this.canvasWidth = canvasWidth
        this.canvasHeight = canvasHeight

        this.layers  = [[]]
        this.lastPoint = null

        this.options = {
            fill : true,
            quadratic : true,
            roundLineCap : true
        }
    }

    render (context, doTheClearing) {

        // Set the context data to the Stroke class data
        context.strokeStyle = this.colour
        context.fillStyle = this.colour
        context.lineWidth = this.brushWidth

        if (doTheClearing) {
            context.clearRect(0,0, context.canvas.width, context.canvas.height)
        }

        context.beginPath()

        // Iterate through the layers
        for (let points of this.layers) {

            // If enough points have been gathered for rendering to be possible
            if (points.length>2) {

                // Move to the starting location for this layer
                context.moveTo(points[0].x, points[0].y)

                // Iterate through all coordinates and draw a line through them
                for (let point=1;  point<points.length-1; point++) {

                    // Get halfway point between this point and the next
                    let halfway = {x: (points[point].x + points[point+1].x)/2, y: (points[point].y + points[point+1].y)/2}

                    context.quadraticCurveTo(points[point].x, points[point].y, halfway.x, halfway.y)
                }
            }
        }

        context.stroke()
    }

    add (x,y) {

        let point = {x : x/2+this.canvasWidth/2, y, width: this.brushWidth}

        // Detect wrapping around to the other side of the sphere texture, if there is a last point to check against
        if (this.lastPoint) {

            // Calculate the x difference first between the new point and the last
            let difference = Math.abs(point.x - this.lastPoint.x);

            // Wrap detected. Allow 90 degree leniency for high latency connections
            if (difference > this.canvasWidth/360*270) {

                // Detect if the wrap is to the left or right
                let toTheRight = point.x > this.canvasWidth/2

                // Add or remove the texture width value to in and out points

                // Used to continue the line out of the texture layer
                let drawOutPoint = {x: point.x + this.canvasWidth-Math.abs(point.x) * (toTheRight ? 1 : -1) - (toTheRight ? this.canvasWidth : 0), y: point.y, width: this.brushWidth}

                // Used to bring the line into the texture layer
                let drawInPoint = {x: point.x, y: this.lastPoint.y, width: this.brushWidth}

                // Push the new point in the current layer
                this.layers[this.layers.length-1].push(this.morph(drawOutPoint))

                // Push the updated last element as the first item in the new layer, to draw into the texture,
                // instead of starting the line from wherever the new point is calculated
                this.layers.push([this.morph(drawInPoint)])
            }
        }

        // Add the cursor's canvas coordinates onto the list of points
        this.layers[this.layers.length-1].push(this.morph(point))

        // Assign this point as the last point, for future wrapping detection
        this.lastPoint = point;
    }

    // Adjust the width of the point in the line to counter equirectangular morphing of the 'spherical' texture
    morph (point) {

        // Tissot Indicatrix-ish stuff - works well enough for now

        // 'Temporary' formula, until a more proper one is found to work better
        let distanceFromTopOrBottom = this.canvasHeight/2 - Math.abs(this.canvasHeight/2 - point.y)

        point.width += this.canvasWidth/distanceFromTopOrBottom*10
        return point
    }
}