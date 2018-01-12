# VR Scribble

This is a resurrection of the VR scribbling project found live at [https://vrscribble.danruta.co.uk/](https://vrscribble.danruta.co.uk/).

The codebase has been severely refactored since the last live release, over a year ago. Certain things in this repo don't work (which do, in the outdated, live version), such as Facebook sharing.

---

# Breakdown of code:

*Definition*: Stroke means whatever was drawn by the user in one motion (touch down, to touch up), eg a single line

## Main page
Users connect to a single room by specifying the room name in the input box on the main page. If new, they click create, else they click join. They can pick between viewer/controller via the follow-up buttons.

## Viewer
This is where most of the stuff is. This is where the scripts carry out the drawing, and everything the user sees.

### Spheres/Textures
The VR effect is achieved with the Threejs WebGL framework. The 360 surround drawing is achieved by placing the camera inside a few spheres, and using canvases as textures for these spheres. The spheres/canvases/textures are used for various purposes/stages (for performance reasons, else it would wreck fps to always re-draw everything). These are visible at the same time, and are overlaid on top of each other (except for the colour and screenshot canvas), in this order:

Closest to user
1. Cursor canvas/sphere
2. Colour canvas/sphere (only visible when selected)
3. Stroke canvas/sphere
4. Buffer canvas/sphere
5. Background canvas/sphere
6. Screenshot canvas/sphere (not actually visible)

Furthest from user

#### Background Canvas
This is used to store drawn data, and cannot be changed any more (only added to). When starting a new room, this starts off as white. When editing an existing drawing, from the user area, this starts off with the screenshot/drawing as the data. As the users keep drawing, this canvas will have strokes added to it.

#### Buffer canvas
This where a user’s strokes go, after they are done. Each user has a strokeQueue array of Stroke objects, with a maximum of 10 strokes. When the user chooses to undo/redo strokes, the strokes from this array are rendered to this canvas accordingly. When a user reaches more than 10 strokes, the oldest stroke is moved to the background canvas, and is no longer undo-able.

#### Stroke canvas
This is the canvas that stores the stroke that a user is actively drawing, while they have their finger pressed down on the controller device’s screen. Once finished, the contents is moved into a new Stroke object, and added to their strokeQueue, for rendering on their buffer canvas.

#### Cursor canvas
This canvas stores the circle cursor, and nothing else. Unlike other canvases, the content of this canvas is not changed, except for when the colour/opacity/thickness is changed in the options. The cursor is drawn as a circle. The line colour represents what colour the brush is using, and its opacity. The radius represents the line thickness.

When the cursor is moved, the canvas texture does not get re-rendered. Instead the sphere is rotated in 3D space to simulate the cursor moving on the canvas, for better performance.

#### Colour canvas
This sphere is a part of the user interface. When changing the colour of the brush, instead of using a 2D colour picker, the user is surrounded by a sphere with every possible colour. They pick a colour by moving the cursor to the colour they want and picking it (by tapping the screen - drawing is disabled during this time). When they pick a colour, the canvas disappears again, and they can resume drawing, with this new colour.

#### Screenshot canvas
This is an off-screen canvas which is used for flattening all other stroke canvases and taking a screenshot. This means that, unlike the other canvases, this one is not visible at any time. Once rendered, the contents is encoded to base64 and sent to the server, where it will be stored in a folder, as an image, for later use in the user area (eg viewing, editing).

There is actually another canvas element, the one that actually goes in the HTML, which serves as the target for the WebGL context, but the code does not directly interact with that, only Threejs does.


### Animation Loop
This is the main function, which executes every frame. A number of things happen here:

1. Stroke canvas is cleared (for re-rendering with new content. New stroke content does not just get added on top, and HAS to be re-drawn, to allow opacity to work)
2. For each user:
    a. Render their stroke data to the stroke canvas
    b. Lerp users’ cursor (see notes)
    c. Update the buffer canvas with new stroke items
    d. Add/remove from buffer canvas stroke array any undone/redone strokes (for rendering, see 4)
    e. De-queue any stokes in the user’s strokeQueue (things that got moved to the buffer canvas)
    f. Save a screenshot, and post it to the server, if requested
3. Clear everything, in every canvas, if all the users voted to reset the canvas (see notes)
4. Clear and re-render the buffer canvas stroke content, if there have been changes in 2c
5. Set each texture to needing to update (a Threejs thing)
6. Trigger the rendering of all the objects/textures to the webgl context of the web page

At any point where rendering is done, a function is called to fill the top and bottom 10% of the canvases with black, like a letterbox effect. This is because otherwise, the ‘poles’ of the spheres would be extremely distorted (see notes), and it’s better to just hide that.

### User Interface
The user interface during gameplay is composed of two panels (primary and secondary) that appear in 3D space when requested. A third panel pops up, as a toast message, to display brief info to the user. When choosing a new colour, a colour sphere replaces their drawing canvas, and they pick a colour from there.

Every panel which shows up will appear within the user’s vision, rotating in 3D to appear matching the direction in which the user is looking when they open the menu. Every panel has its own canvas/texture, with the icons drawn to them using the canvas API.

#### Primary panel
This primary panel contains all the options available:
1. Undo
2. Redo
3. Colour
4. Brush opacity
5. Brush thickness
6. Save screenshot
7. Vote to reset drawing

A user can open this panel by using the appropriate voice command into their controller. Once this panel is open, the user moves between the options by moving their controller left and right (as they would when moving the cursor, which is now disabled).

The menu being opened:
<img width="100%" src="readme images/menu.png">

Another option selected by moving the cursor right:
<img width="100%" src="readme images/menuOption.png">

They can select an option by tapping their controller, like clicking. When selecting Undo/Redo, the strokes are done/undone from the canvases. The user can close the menu by using the voice command. When selecting the screenshot option, the menu will close, and the screenshot is taken, as indicated by a toast message (see below). The clear option works the same. The colour option will bring up the colour sphere (see below). The opacity and thickness options will bring up the secondary panel.

#### Secondary panel
This panel is used to complement the primary panel, with more control upon the action taken. It is used for the opacity and thickness options.

Opacity:
<img width="100%" src="readme images/opacityPanel.png">

Thickness:
<img width="100%" src="readme images/thicknessPanel.png">

Once this panel is up, the user can move their controller up or down to change the value of the sliders. They can either click once done, or they can do it while the cursor is pressed down, letting go once they are happy. The cursor is automatically updated with changes (see below)

<img width="100%" src="readme images/thicknessPanel2.png">

#### Toast
This is a little panel that appears in the bottom half of the user’s sight to indicate when something is happening, eg someone connects, your connection status, and certain user actions. For example:

<img width="100%" src="readme images/toast1.png">
<img width="100%" src="readme images/toast2.png">
<img width="100%" src="readme images/toast3.png">
<img width="100%" src="readme images/toast4.png">
<img width="100%" src="readme images/toast5.png">
<img width="100%" src="readme images/toast6.png">

#### Colour
When selecting the colour option in the primary panel, the options menu is closed, and the user is surrounded in a sphere containing every possible colour that can be used. The higher they look, the brighter it is, the lower they look, the darker it is. The user can point their cursor to the colour they want to pick. A rough estimation of the colour that will be picked when selecting, is reflected in the circle inside the cursor. To pick the colour, the user taps their controller, as if drawing a dot, after which the colour over which the cursor is hovering is picked, the colour canvas is hidden and drawing is resumed. To cancel, the user can exit using voice commands.

Looking straight:
<img width="100%" src="readme images/colour1.png">

Looking up:
<img width="100%" src="readme images/colour2.png">

Looking down:
<img width="100%" src="readme images/colour3.png">


#### Cursor
As seen in above images, the cursor is a circle and represents where the user will draw/pick colour from. When changing opacity/thickness, it is updated live, to indicate the result. The colour of the outline represents the selected colour/opacity, and the radius of the inner circle represents thickness.


### Controller
The controller script is used for the device which you wave about as a paintbrush.
It uses the deviceOrientation API to get the rotation data. It then passes this data through WebSockets to the server, where the server broadcasts this data to every device connected to the same ‘room’ (drawing).

While in-game a user can press the bottom bit of the screen to activate voice input, which accepts a number of words. These words map to interface options for in-game actions, such as opening/closing the menu, changing colour, brush opacity/thickness, undoing/redoing strokes, or taking screenshots of the canvas up to that point and saving it in their user area (see below).

Voice commands include:

| Command        | What it does           |
| ------------- |:-------------:|
| close      | Closes whatever menu the user has open |
| options | Opens the primary panel of the options menu |
| undo | Shortcut to the undo option of the options menu, to avoid having to open the menu and selecting it |
| redo | Shortcut to the redo option |
| colour | Shortcut to the colour picking option |
| opacity | Opens options menu, straight to the opacity secondary panel |
| thickness | Opens options menu, straight to the thickness secondary panel |
| screenshot | Takes a screenshot of the existing drawings |

An option for the canvas clearing option is not included to avoid accidental clears.

## Server code
To map the incoming data to only  the people in the correct room (so that people can draw in separate rooms at the same time, without interference), the server groups the WebSocket connections into ‘rooms’ by assigning a meta object to each connection, with required data. To map people’s controllers to their viewers (necessary, so that interface options only activate for the person that needs them), OAuth authentication is used to distinguish connections apart.

## User Area
Here, a user can see their saved screenshots and either view them in a non-editable VR environment (same as viewer, but no drawing), or they can edit them by creating a new room, with the screenshot as the starting canvas contents. They can also share on Facebook in 360 format. Finally, they can download them as images, or delete them.

## Editing Page
When a user clicks on the edit button on an image in the user area, they are just creating a new room, with the drawing as the starting content for the background canvas. There is nothing else different. People can still connect to the room, given the name, the same way as connecting to a new room from the main page. Further screenshots can still be taken. Therefore, taking screenshots is like “Saving” your drawing progress, to continue later.

There is a spotlight folder on the server where spotlight (good) screenshots go, and they are randomly selected to be displayed on the front page, on every reload, through server-side rendering.

## Other/Notes
When there is only a single player, the canvas is cleared when the option is selected. However, when there are multiple people, it only happens when everyone has picked the option.

To avoid the issue of equirectangular distortion affecting each stroke as they are being drawn, the canvas drawing has been re-implemented, and the width of the lines follows a formula similar to the Tissot Indicatrix, to have them retain their width near the sphere poles.

To avoid the issue of a user drawing “off the edge” of a canvas, as they cross from the left to the right side, or vice-versa, the stroke coordinates are saved in layers, with offsets. When lines cross over, the layers are merged into each other and wrapped around/overlaid with the canvas width offsets, as necessary.

To avoid network lag affecting the cursor jumping about, the cursor movements are done using lerping. This is where, instead of jumping, the cursor slides between coordinates with speed relative to distance.











