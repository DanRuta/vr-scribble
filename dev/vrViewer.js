"use strict"

window.addEventListener("load", () => {

    // Load the image into the texture canvas

    // Init the texture canvas
    const textureCanvas = document.createElement("canvas")
    textureCanvas.height = window.innerHeight
    textureCanvas.width = window.innerWidth
    const textureContext = textureCanvas.getContext("2d")

    // Load the spotlight image into the canvas
    const backgroundImage = document.createElement("img")
    backgroundImage.addEventListener("load", () => {
        textureContext.scale(-1,1)
        textureContext.drawImage(backgroundImage,0,0,textureCanvas.width*-1,textureCanvas.height)
    })
    backgroundImage.src = "data:image/jpeg;base64,"+window.vrscribble.imageBase64

    // Initialise the viewer

    // Prevent the device from going into sleep mode, to keep the screen turned on
    screen.keepAwake = true

    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true})
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    const effect = new THREE.VREffect(renderer)
    effect.separation = 0
    effect.setSize(window.innerWidth, window.innerHeight)


    // WebVR stuff
    let vrDisplay
    navigator.getVRDisplays().then(displays => {
        if (displays.length > 0) {
            vrDisplay = displays[0]
        }
    })

    // Add button to enable the VR mode
    const vrButton = VRSamplesUtil.addButton("Enter VR", "E", "/images/cardboard64.png", () => {
        vrDisplay.requestPresent([{source: renderer.domElement}])
    })

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(110, window.innerWidth/window.innerHeight, 1, 4000)
    scene.add(camera)


    const texture = new THREE.Texture(textureCanvas)
    const material = new THREE.MeshBasicMaterial({map: texture, side: THREE.BackSide, color: 0xffffff})
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 40, 40), material)
    texture.minFilter = THREE.NearestFilter
    scene.add(mesh)

    // Set up controls
    let controls = new THREE.OrbitControls(camera, renderer.domElement)
    controls.target.set(camera.position.x+0.15, camera.position.y, camera.position.z)
    controls.noPan = true
    controls.noZoom = true

    // Set the controls to VR, if available
    if (navigator.userAgent.toLowerCase().includes("mobile")) {
        controls = new THREE.VRControls(camera)
        controls.update()
    } else {
        const setOrientationControls = event => {

            if (!event.alpha)    return

            controls = new THREE.VRControls(camera)
            controls.update()

            window.removeEventListener("deviceorientation", setOrientationControls)
        }
        window.addEventListener("deviceorientation", setOrientationControls)
    }


    // Resize the rendered element on window resize
    window.addEventListener("resize", () => {
        effect.setSize(window.innerWidth, window.innerHeight)
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
    })

    const renderLoop = () => {
        requestAnimationFrame(renderLoop)
        controls.update()
        texture.needsUpdate = true
        effect.render(scene, camera)
    }

    renderLoop()
})