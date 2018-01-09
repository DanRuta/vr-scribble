"use strict"

class InterfaceBox {

    constructor (name, canvas, sizeX, sizeY, distance, yOffset, xRotation=0) {

        // Set distance from sphere circle
        this.distance = distance
        this.xRotation = xRotation

        window.vrscribble.textures[`${name}Texture`] = new THREE.Texture(canvas)
        window.vrscribble.textures[`${name}Texture`].minFilter = THREE.NearestFilter
        this.boxGeometry = new THREE.BoxGeometry(sizeX,sizeY,1)
        this.boxMaterial = new THREE.MeshBasicMaterial({map: window.vrscribble.textures[`${name}Texture`], transparent: true, depthWrite: false})
        this.box = new THREE.Mesh(this.boxGeometry, this.boxMaterial)

        this.box.position.y = yOffset

        // Tilted rotation, for 3D GUI effect
        this.box.rotation.x = this.xRotation
        this.box.rotation.order = "YXZ"

        window.vrscribble.scene3.add(this.box)
    }

    // Setter methods
    setLocation (alpha) {

        alpha = alpha*Math.PI/180

        let deltaTheta = 2*Math.PI-alpha

        this.box.position.x = -1*Math.cos(alpha)*this.distance
        this.box.position.z = -1*Math.sin(alpha)*this.distance
        this.box.rotation.y = Math.abs(deltaTheta+0.5*Math.PI)%(2*Math.PI)
    }
}