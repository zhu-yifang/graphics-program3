//
// flip-book.js
//
// Author: Jim Fix
// CSCI 385: Computer Graphics, Reed College, Spring 2022
//
// Editor that allows its user to construct a scene of objects and a
// walk-through of that scene with a series of camera snapshots.
//
// The user can choose objects from an objects library fed to the
// editor. The user can set up the walk-through of the scene and
// produce a PDF whose pages are the shots of the walk-through
// sequence.
//

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

 SOME CONFIGURATION GLOBALS

*/

//
// Width/height of the canvas in pixels.
//
const gHeight = 300;
const gWidth  = 800;  // This MUST be a bit larger than gHeight.
//
//
const gSceneBounds = {
    //
    left:    0.0, // This needs to be 0.0 for current code to work.
    right:   2.0 * (gWidth - gHeight) / gHeight,
    //
    bottom: -1.0, // These must be +/- C for current code to work,
    top:     1.0
};
//
const INITIAL_OBJECT_NAME = "bunny" // Starting object to place.
//
const OBJECT_PREVIEW_COLOR = {r:0.800, g:0.830, b:0.860}; // Near white.
const OBJECT_SELECT_COLOR  = {r:0.950, g:0.900, b:0.500}; // Yellow.
const WALKTHRU_COLOR = {r:0.325, g:0.575, b:0.675}; // Chalk blue.
const CAMERA_COLOR   = {r:0.825, g:0.475, b:0.175}; // Chalk orange.
const PAPER_COLOR    = {r:0.950, g:0.900, b:0.700}; // Legal pad.
const INK_COLOR      = {r:0.100, g:0.100, b:0.250}; // Micron deep blue.
//
const LIGHT_POSITION = new Vector3d(-1.5, 0.875, 10.0);


//
const gWalkThru = new WalkThru();

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

 SUPPORT FOR A LIBRARY OF OBJECTS THAT CAN BE PLACED
 
 The program's main allows its programmer to provide a dictionary of
 object names with their associated Alias/Wavefront .OBJ file text.
 The code below supports building this as a collection of named
 `CGObject` instances. These each describe the vertices and facets of
 the corresponding object. The program can render these objects as a
 3-D shaded model, as a wireframe, and as a line drawing on a page.

 The code below builds that library and the glBeginEnd of each
 object's geometry.

 The HTML interface should allow users to choose which object in the
 library can be placed by the GUI. The code to do this is
 `chooseObject`

 */ 

//
// Name of the object for next placement.
let gCurrentPlacementName  = INITIAL_OBJECT_NAME; 

function chooseObject(name) {
    /*
     * Select an object to be placed. Used by the web GUI.
     */
    
    console.log("Switching to '"+name+"'...");
    gCurrentPlacementName = name;
}

//
// A map of name -> CGObject pairs of objects that can be placed These
// are loaded by makeObjectsLibrary below.
let gObjectsLibrary = new Map();

function makeObjectsLibrary(objectTexts) {
    /*
     * Processes the Wavefront .OBJ file information stored in the
     * name->(text,bool) `objectTexts`. It builds a `CGObject`
     * instance for each one, putting each in `objects`. It then
     * creates two `glBeginEnd` renderings for each:
     *
     *  "object": is the triangular facets of the object,
     *            using one surface material.
     *
     *  "object-wireframe": description of all the edges of the faceted
     *               object.
     *
     */

    for (const [name, [text,flip]] of objectTexts.entries()) {
	//
	// name: the root name of the .OBJ file.
	// text: the text contents of the .OBJ file.
	// flip: true/false for reorienting the axes. See CGOobject.read.
	//

	console.log("Compiling " + name + ".obj info...");

	//
	// Build a cloneable object from the .obj text.
	const object = new CGObject();
	object.buildFromOBJ(text,flip);
	console.log("...",object.vertices.length,"vertices.")
	gObjectsLibrary.set(name, object);

	//
	// Make faceted object.
	glBegin(GL_TRIANGLES, name);
	object.compileSurface() // a series of trios of glVertex3f
	glEnd();
    
	//
	// Make wireframe.
	glBegin(GL_LINES, name+"-wireframe");
	object.compileMesh() // a series of pairs of glVertex3f
	glEnd();
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 
 SUPPORT FOR PLACEMENT OF SCENCE OBJECTS

 The code below is used for placing "clones" of the pre-loaded object
 library, placing copied of them into a 3D scene. It implements the
 GUI for placing them in the scene, sizing, and orienting them.

 Each such scene object is described by an `ObjectPlacement`
 instance. This object contains the attributes:

 * `name`: string of the object cloned from the library. This name is
           used to access the object's geometric info (its faceted
           surface) and also to render it with glBeginEnd.

 `* `object`: a `CGObject` describing the geometry of the clone.

 * `position`, `scale`, `direction`: a `point`, number, and `vector`
           representing the location, size, and orientation of this
           clone's placement in the scene.

 There are several functions for handling mouse events (clicks and 
 drags) along with global variables that manage the GUI state of 
 those handlers.

 Scxene objects can only be placed within a 2D region, standing upward
 (like chess pieces might be placed on a board). This means that the
 positions are points of the form (x, y, 0).

 The objects themselves are assumed to live in their own 3D frame,
 centered at the origin, with x-y being their "girth" dimensions, and
 z being their up-down dimension. Their base is at z=0 and their
 vertices sit at positive heights above the x-y plane. The object
 vertex coordinates are scaled so that the distance of any point
 on the object away from its central axis is at most 1.0.

 ---

 Placement editing by mouse events:
 
 * Mouse clicks either select a nearby object or place a new clone
   from the object library.  Subsequent dragging motion can be used to
   resize and reorient the object until the mouse is released, but
   this behavior only gets engaged if the drag extends a certain
   radius from the initial click.

 * A quick click (with no significant drag) instead puts the
   program in "object placement" mode, where the user can instead
   place the object somewhere else. A subsequent click drops
   the object in that spot.

*/

let gPlacing       = false; // Whether the user has selected and is placing an object.
let gPlacement     = null;  // Which object we are currently placing, or null.
let gLastPlacement = null;  // Position used to determine reorientation.
//
// How we are editing the currently selected scene object...
const PLACING          = 0;
const PLACEMENT_MOVE   = 1;
const PLACEMENT_RESIZE = 2;
let   gPlacementMode   = PLACING
const PLACEMENT_THRESHOLD = 1.1; // Have we dragged far enough to resize?
//

function removeSelectedPlacement() {
    /*
     * Removes the current placement from the scene.
     */
    
    //
    // Scan the placements, remove the one that's selected.
    for (let index = 0; index < gWalkThru.placements.length; index++) {
	if (gWalkThru.placements[index] == gPlacement) {
	    gWalkThru.placements.splice(index,1);
	    // No placement is selected as a result.
	    gPlacement = null;
	    gPlacing = false;
	    return;
	}
    }
}

function selectOrCreatePlacement(mouseXY) {
    /*
     * Chooses which placement the user wants to edit, given a
     * location of the mouse pointer.
     */
    
    let click = new Point3d(mouseXY.x, mouseXY.y, 0.0);

    //
    // See if we clicked near some item.
    let selected = null;
    for (let placement of gWalkThru.placements) {
	if (placement.baseIncludes(click)) {
	    selected = placement;
	}
    }

    //
    // If not, make a new item at that place.
    if (selected == null) {
	const name = gCurrentPlacementName;
	selected = new Placement(name, click);
	gWalkThru.placements.push(selected);
    }

    //
    // Return selected or created item.
    return selected;

}

function handlePlacement(mouseXY, down, drag) {
    /*
     * Handles a mouse click with the button pressed down or released,
     * and also a mouse drag with the button pressed or not, and whenever
     * the mouse movement should be interpreted for placing cloned objects
     * within the scene.
     *
     * When the mouse is first clicked, either a new cloned object
     * gets placed in the scene, or else a nearby one is
     * selected. This puts the GUI in CLONE_SELECTED mode. If this is
     * followed by a dragging of the mouse, then this code checks to
     * see whether the movement extends beyond a certain radius. If
     * so, it enters CLONE_SCALE mode to resize the object.  If not,
     * and the mouse button is released, it enters CLONE_LOCATE mode
     * so that the clone be moved around. A later click in this mode
     * places the object, de-selects it.
     *
     */
  
    const mouseLocation = new Point3d(mouseXY.x, mouseXY.y, 0.0);

    if (down && !drag) { 
	//
	// Just clicked the mouse button...
	//
	
	if (gPlacing && gPlacementMode == PLACEMENT_MOVE) {
	    //
	    // Relocate then deselect.
	    gPlacement.moveTo(mouseLocation,gSceneBounds);
	    //
	    gPlacing   = false;
	    gPlacement = null;
	    
	    //
	    glutPostRedisplay();
	    
	} else if (!gPlacing) {
	    //
	    // Create or select a clone.
	    gPlacing   = true;
	    gPlacement = selectOrCreatePlacement(mouseLocation);
	    //
	    gPlacementMode = PLACING;
	    //
	    glutPostRedisplay();
	}
	
    } else if (!down && !drag) {
	//
	// Just released the mouse button...
	//
	
	if (gPlacing && gPlacementMode == PLACING) {
	    //
	    // Haven't started resizing, so put in relocate mode.
	    gPlacementMode = PLACEMENT_MOVE;
	    
	} else {
	    //
	    // Done resizing, deselect.
	    gPlacing   = false;
	    gPlacement = null;
	    //
	    glutPostRedisplay();
	    
	}
	
    } else if (down && drag) {
	// Dragging the mouse (with mouse button pressed)...
	//
	if (gPlacing && gPlacementMode == PLACING) {
	    //
	    // Check if we should start resizing.
	    const position = gPlacement.position
	    const distance = position.dist(mouseLocation);
	    const radius   = gPlacement.scale;
	    if (distance > PLACEMENT_THRESHOLD * radius) {
		gPlacementMode = PLACEMENT_RESIZE;
		gLastPlacement = mouseLocation;
	    }
	}

	//
	// Resize the selected clone.
	if (gPlacing && gPlacementMode == PLACEMENT_RESIZE) {
	    const center     = gPlacement.position
	    const distance   = center.dist(mouseLocation);
	    const direction0 = gLastPlacement.minus(center).unit();
	    const direction1 = mouseLocation.minus(center).unit();
	    const angle0     = Math.atan2(direction0.dy,
					  direction0.dx) * 180.0 / Math.PI;
	    const angle1     = Math.atan2(direction1.dy,
					  direction1.dx) * 180.0 / Math.PI;
	    gPlacement.rotateBy(angle1 - angle0);
	    gPlacement.resize(distance, gSceneBounds);
	    gLastPlacement = mouseLocation;
	    //
	    glutPostRedisplay();
	}
    } else if (!down && drag) {
	// Moving the mouse (with mouse button released)...
	//
	if (gPlacing) {
	    //
	    // Move the selected clone.
	    gPlacement.moveTo(mouseLocation, gSceneBounds);
	    //
	    glutPostRedisplay();
	}
    }
}
	

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 
 SUPPORT FOR EDITING THE SCENE WALK-THRU

 The code below is used for placing a sequence of camera shots that
 direct the walk-through of the scene.

 Each shot in the sequence is represented as a `Shot` object instance.
 This places the camera at a x-y position in the scene, looking in an
 x-y direction.

 Camera shots can only be placed within a 2D region, with the camera
 sitting on the floor. The camera can pan around within the scene.
 Each camera shot can be selected so that its view of the scene can be
 previewed. Shot placement is made within the scene editor, shot
 direction is edited within the shot's preview.

 There are several functions for handling mouse events (clicks and 
 drags) along with global variables that manage the GUI state of 
 those handlers.

 ---

 Shot editing with mouse events:

 * Camera shot placement is done by clicking and dragging with the 
 center mouse button. On some systems this is also a [SHIFT-click].
 
 * Camera shot direction (panning) is controlled by clicking and
 dragging within the shot preview.

*/

//
// Support for GUI layout of the camera path.
//
let gEditingShot     = false;
let gMovingShot      = false;
let gShotBeingEdited = gWalkThru.shots[0];
//
const EDITING_SHOT_POSITION  = 1;
const EDITING_SHOT_DIRECTION = 2;
let   gEditingShotMode = EDITING_SHOT_POSITION;
//
let gLastTrack = null;

function startTrackballAt(mouseXY) {
    /*
     * Begins tracking mouse movement, registering the latest position.
     */
    gLastTrack = mouseXY;
}

function moveTrackballTo(mouseXY) {
    /*
     * Update camera direction based on mouse movement.
     */

    //
    // Treat a swipe movement as a rotation of a virtual wheel in
    // the +/- x direction.
    //
    const dx     = mouseXY.x - gLastTrack.x;
    const angle0 = Math.atan2(gShotBeingEdited.direction.dy,
			      gShotBeingEdited.direction.dx);
    const angle1 = Math.asin(Math.max(Math.min(dx,1.0),-1.0));
    gShotBeingEdited.direction = new Vector3d(Math.cos(angle0+angle1),
					      Math.sin(angle0+angle1),
					      0.0);

    //
    // Remember the current position for handling the next mouse move.
    gLastTrack = mouseXY;

    //
    glutPostRedisplay()
}

function selectedShotNumber() {
    /*
     * Computes the array index of the selected shot.
     */
    for (let index = 0; index < gWalkThru.shots.length; index++) { 
	if (gWalkThru.shots[index] == gShotBeingEdited) {
	    return index;
	}
    }
    return 0;
}

function advanceShot() {
    /*
     * Advances to select the next shot in the walk-through sequence.
     */
    const index = selectedShotNumber();
    if (index < gWalkThru.shots.length-1) {
	gShotBeingEdited = gWalkThru.shots[index+1];
    }
}

function rewindShot() {
    /*
     * Rewinds to select the prior shot in the walk-through sequence.
     */
    const index = selectedShotNumber();
    if (index > 0) {
	gShotBeingEdited = gWalkThru.shots[index-1];
    }
}

function removeSelectedShot() {
    /*
     * Removes the currently selected shot from the walk-thru.
     * Perform only if there is more than one shot.
     */
    if (gWalkThru.shots.length > 1) {
	let index = selectedShotNumber();
	gWalkThru.shots.splice(index,1);
	if (index > gWalkThru.shots.length - 1) {
	    index = gWalkThru.shots.length - 1;
	}
	gShotBeingEdited = gWalkThru.shots[index];
    }
}    

function selectOrCreateShot(location) {
    /*
     * Chooses which clone the user wants to place, given a location
     * of the mouse pointer.
     */

    let click = new Point3d(location.x, location.y, 0.0);

    //
    // See if we clicked near some camera.
    selected = null;
    for (let shot of gWalkThru.shots) {
	if (shot.position.dist(click) < 0.2) {
	    selected = shot;
	}
    }
    //
    // If not, make a new one.
    if (selected == null) {
	selected = new Shot(click, X_VECTOR3D());
	gWalkThru.shots.push(selected);
    }
    
    return selected;
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 
   MOUSE HANDLERS

*/

function mouseToSceneCoords(mousex, mousey) {
    /*
     * Convert mouse screen coordinates to scene coordinates.
     */
    
    //
    // A hack to adjust for the corner of the canvas.  There is a
    // javascript way of handling this probably.
    //
    mousex -= 10;
    mousey -= 10;
    
    //
    // Use the inverse of the GL_PROJECTION matrix to map from screen
    // coordinates to our scene coordinates.
    //
    const pj = mat4.create();
    glGetFloatv(GL_PROJECTION_MATRIX,pj);
    const pj_inv = mat4.create();
    mat4.invert(pj_inv,pj);
    const vp = [0,0,0,0];
    glGetIntegerv(GL_VIEWPORT,vp);
    const mousecoords = vec4.fromValues(2.0*mousex/vp[2]-1.0,
					1.0-2.0*mousey/vp[3],
					0.0, 1.0);
    vec4.transformMat4(location,mousecoords,pj_inv);
    //
    return {x:location[0], y:location[1]};
}    

function handleMouseClick(button, state, x, y) {
    /*
     * Records the location of a mouse click in object world coordinates.
     */

    const mouseXY = mouseToSceneCoords(x,y);

    //
    // Start tracking mouse for drags.
    if (state == GLUT_DOWN && !gPlacing && mouseXY.x > gSceneBounds.right) {
	//
	// Handle drags within the snapshot preview section.
	gEditingShot = true;
	startTrackballAt(mouseXY);
	
    } else if (state == GLUT_DOWN && button == GLUT_LEFT_BUTTON) {
	//
	// Handle dragging of an object within the scene.
	handlePlacement(mouseXY, true, false);
	
    } else if (state == GLUT_DOWN && button == GLUT_MIDDLE_BUTTON) {
	//
	// Handle dragging of a shot if the walk-through.
	gShotBeingEdited = selectOrCreateShot(mouseXY);
	gMovingShot = true;
	
    }
    
    //
    // Stop tracking mouse for drags, excepting object placements.
    if (state == GLUT_UP) {
	if (gEditingShot) {
	    gEditingShot = false;
	} else if (gMovingShot) {
	    gMovingShot = false;
	} else {
	    //
	    // A quick click starts placement of an object.
	    handlePlacement(mouseXY, false, false);
	}
    }
}

function handleMouseDrag(x, y) {
    /*
     * Handle the mouse movement resulting from a drag.
     */
    const mouseXY = mouseToSceneCoords(x,y);
    if (gPlacing) {
	//
	// Moving a selected object's placement...
	handlePlacement(mouseXY, true, true);
    }
    if (gMovingShot) {
	//
	// Moving a selected shot's placement...
	gShotBeingEdited.position.x = Math.min(mouseXY.x,3.0);
	gShotBeingEdited.position.y = mouseXY.y;
    }
    if (gEditingShot) {
	//
	// Within the snapshot preview...
	moveTrackballTo(mouseXY);
    }
}

function handleMouseMove(x, y) {
    /*
     * Handle the mouse movement with the mouse button not pressed.
     */
    const mouseXY = mouseToSceneCoords(x,y);
    
    if (gPlacing) {
	//
	// Only handle if placing a selected object.
	handlePlacement(mouseXY, false, true);
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 
 SCENE WALK-THRU PREVIEW SUPPORT

 The functions below render the scene, showing its objects and the 
 series of camera shots.

*/

function drawScene() {
    /*
     * Renders all the placed objects within the WebGL/opengl context.
     *
     * Uses Phong shading (set by GL_LIGHTING) illuminated by a single
     * light, GL_LIGHT0.
     *
     */

    //
    // Turn on lighting.
    glEnable(GL_LIGHTING);
    glEnable(GL_LIGHT0);
    glLightfv(GL_LIGHT0, GL_POSITION, LIGHT_POSITION.components());

    //
    // Draw each placed object, highlighting the selected one.
    for (let placement of gWalkThru.placements) {
	selected = null;
	if (placement == gPlacement) {
	    selected = OBJECT_SELECT_COLOR;
	}
	placement.draw(OBJECT_PREVIEW_COLOR, selected, true, true);
    }

    glDisable(GL_LIGHT0);
    glDisable(GL_LIGHTING);
}

function drawShotPreview() {
    /*
     * Renders the placed objects within the WebGL/UT context 
     * as flat-shaded wireframes with hidden surfaces removed.
     */

    glPushMatrix();
    glTranslatef(2*gWidth/gHeight - 1.0, 0.0, 0.0);
    //
    {
	// Clear the page for the virtual PDF view.
	glPushMatrix();
	glTranslatef(0.0, 0.0, -10.0); // Put way in the back.
	glColor3f(PAPER_COLOR.r, PAPER_COLOR.g, PAPER_COLOR.b);
	glBeginEnd("square");
	glPopMatrix();
    }

    {
	//
	// Set up the camera's perspective.
	glPushMatrix();
	glTranslatef(0.0, -1.0, 1.0); // Place the camera on the floor.
	gluPerspective(Math.PI/2, 1.0,  10, 0.01);
	gluLookAt(gShotBeingEdited.position,
		  gShotBeingEdited.position.plus(gShotBeingEdited.direction),
		  Z_VECTOR3D());

	//
	// Draw the scene in perspective and as wireframes.
	glEnable(GL_SCISSOR_TEST);
	glScissor(gWidth - gHeight, 0, gHeight, gHeight); // Limit where it is drawn.
	for (let placement of gWalkThru.placements) {
	    // Draw each object.
	    placement.draw(PAPER_COLOR, INK_COLOR, false, false);
	}
	glDisable(GL_SCISSOR_TEST);
	glPopMatrix();
    }
    //
    glPopMatrix();
}

function drawCameraPath() {
    /*
     * Renders the path of shots on the walk-through of the scene.
     */
    
    const cc = CAMERA_COLOR;
    const pc = WALKTHRU_COLOR;

    //
    // Draw a camera cone for each shot. Highlight the edited shot.
    for (let shot of gWalkThru.shots) {

	//
	// Set up the transformations for placing an icon.
	const position = shot.position;
	const direction = shot.direction;
	const angle = Math.atan2(direction.dy, direction.dx) * 180.0 / Math.PI;
	//
	// Perform the transformations.
	glPushMatrix();
	glTranslatef(position.x, position.y, position.z);
	glRotatef(angle, 0.0, 0.0, 1.0);
	glScalef(0.1, 0.1, 0.1);
	//
	// Color it.
	if (shot == gShotBeingEdited) {
	    // Highlighted.
	    glColor3f(cc.r, cc.g, cc.b);
	} else {
	    // Unhighlighted.
	    glColor3f(pc.r, pc.g, pc.b);
	}
	//
	// Draw it.
	glBeginEnd("SHOT")
	glPopMatrix();
    }
    //
    // Draw the path from shot to shot.
    for (let index = 1; index < gWalkThru.shots.length; index++) {
	const shot0 = gWalkThru.shots[index-1];
	const shot1 = gWalkThru.shots[index];
	//
	// Set up the transformations for connecting two shots.
	const position0 = shot0.position;
	const position1 = shot1.position;
	const direction = position1.minus(position0).unit();
	const length    = position0.dist(position1);
	const angle = Math.atan2(direction.dy, direction.dx) * 180.0 / Math.PI;
	//
	// Perform the transformations.
	glPushMatrix();
	glTranslatef(position0.x, position0.y, position0.z);
	glRotatef(angle, 0.0, 0.0, 1.0);
	glRotatef(90,0.0,1.0,0.0);
	//
	// Scale a brick wireframe to be the length of the path step.
	glScalef(0.01, 0.01, length);
	glColor3f(pc.r, pc.g, pc.b);
	glBeginEnd("PATH")
	glPopMatrix();
    }
}

function draw() {
    /*
     * Issue GL calls to draw the scene.
     */

    //
    // Clear the rendering information.
    glClearColor(0.2,0.2,0.3);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glEnable(GL_DEPTH_TEST);
    //
    // Set up the scene coordinates.
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glViewport(0, 0, gWidth, gHeight);
    glOrtho(0, 2*gWidth/gHeight, -1.0, 1.0, -10.0, 10.0);
    //
    // Clear the transformation stack.
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    //
    // Draw all the objects in the scene.
    glEnable(GL_SCISSOR_TEST);
    glScissor(0, 0, gWidth - gHeight, gHeight); // Limit the area where it's drawn.
    drawScene();
    drawCameraPath();
    glDisable(GL_SCISSOR_TEST);
    //
    // Draw the current camera's view.
    drawShotPreview();
    
    glFlush();
}


function handleKey(key, x, y) {
    /*
     * Handle a keypress.
     */
    
    //
    // Turn the light on/off.
    if (key == "l") {
	lightOn = !lightOn;
    }

    //
    // Delete the selected object.
    if (key == "x") {
	if (gPlacing) {
	    // Delete selected object placement.
	    removeSelectedPlacement();
	}
    }

    //
    // Select the prior shot.
    if (key == "i") {
	rewindShot();
    }
    //
    // Advance to the next shot.
    if (key == "o") {
	advanceShot();
    }
    //
    // Delete the selected shot.
    if (key == "p") {
	removeSelectedShot();
    }

    glutPostRedisplay();
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
   GUI OBJECT DEFINTIONS FOR OPENGL
 */
 
function makeSquare() {
    glBegin(GL_TRIANGLES, "square");
    //
    glVertex3f(-1.0,-1.0,0.0);
    glVertex3f( 1.0,-1.0,0.0);
    glVertex3f( 1.0, 1.0,0.0);
    //
    glVertex3f(-1.0,-1.0,0.0);
    glVertex3f( 1.0, 1.0,0.0);
    glVertex3f(-1.0, 1.0,0.0);
    //
    glEnd();
}    

function makeBase() {
    const numSides = 24;
    const dangle = 2.0 * Math.PI / numSides;
    glBegin(GL_LINES, "BASE");
    let angle = 0.0;
    for (let i=0; i<numSides; i++) {
	glVertex3f(0.0, 0.0, 0.0);
	glVertex3f(Math.cos(angle), Math.sin(angle), 0.0);
	glVertex3f(Math.cos(angle), Math.sin(angle), 0.0);
	angle += dangle;
	glVertex3f(Math.cos(angle), Math.sin(angle), 0.0);
	glVertex3f(Math.cos(angle), Math.sin(angle), 0.0);
	glVertex3f(0.0, 0.0, 0.0);
    }
    glEnd();
}

function makeShot() {
    const numSides = 24;
    const dangle = 2.0 * Math.PI / numSides;
    glBegin(GL_LINES, "SHOT");
    let angle = 0.0;
    for (let i=0; i<numSides; i++) {
	glVertex3f(0.0, 0.0, 0.0);
	glVertex3f(1.0, Math.cos(angle), Math.sin(angle));
	glVertex3f(1.0, Math.cos(angle), Math.sin(angle));
	angle += dangle;
	glVertex3f(1.0, Math.cos(angle), Math.sin(angle));
	glVertex3f(1.0, Math.cos(angle), Math.sin(angle));
	glVertex3f(0.0, 0.0, 0.0);
    }
    glEnd();
}

function makePath() {
    const numSides = 8;
    const dangle = 2.0 * Math.PI / numSides;
    glBegin(GL_LINES, "PATH");
    let angle = 0.0;
    for (let i=0; i<numSides; i++) {
	//
	glVertex3f(Math.cos(angle), Math.sin(angle), 0.0);
	glVertex3f(Math.cos(angle), Math.sin(angle), 1.0);
	//
	glVertex3f(Math.cos(angle), Math.sin(angle), 0.0);
	glVertex3f(Math.cos(angle+dangle), Math.sin(angle+dangle), 0.0);
	//
	glVertex3f(Math.cos(angle), Math.sin(angle), 1.0);
	glVertex3f(Math.cos(angle+dangle), Math.sin(angle+dangle), 1.0);
	//
	angle += dangle;
    }
    glEnd();
}


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
  THE MAIN PROGRAM 
*/
function editor(objectTexts) {
    /*
     * The main procedure, sets up OPENGL and loads the object library.
     */

    // set up GL/UT, its canvas, and other components.
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB | GLUT_DEPTH);
    glutInitWindowPosition(0, 0);
    glutInitWindowSize(gWidth, gHeight);
    glutCreateWindow('flip book walk thru editor')
    
    // Build the renderable objects.
    makeObjectsLibrary(objectTexts);
    
    // Editor objects.
    makeBase();
    makeShot();
    makePath();
    makeSquare();

    // Register interaction callbacks.
    glutKeyboardFunc(handleKey);
    glutDisplayFunc(draw);
    glutMouseFunc(handleMouseClick)
    glutMotionFunc(handleMouseDrag)
    glutPassiveMotionFunc(handleMouseMove)
    
    // Go!
    glutMainLoop();

    return 0;
}

//
// Read all the .obj files specified, embedded in the HTML.
//
let objectTextLibrary = new Map();
for (let object of flipBookLibrary) {
    const objectName = object[0];
    const objectFlip = object[1];
    const objectFileName = objectName + ".obj";
    const objectFileText = document.getElementById(objectFileName).text;
    objectTextLibrary.set(objectName,[objectFileText,objectFlip]);
}  

glRun(() => { editor(objectTextLibrary); }, true);

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
   TOP-LEVEL SUPPORT FOR RENDERING A PDF DOCUMENT

   Relies on WalkThru.toPDF

 */

function randomHex(size) {
    let hex = "";
    const digits = "0123456789abcdef";
    while (size > 0) {
	digit = Math.floor(Math.random()*16)
	hex += digits[digit];
	size -= 1;
    }
    return hex;
}

function makeBinding(document) {
    /*
     * Makes floor/binding marks on the bottom portion of the
     * flip-book PDF. It is credit card-sized, so 54mm x 86mm.
     */
    document.setLineWidth(0.075);
    document.setDrawColor(128,128,128);
    let i = 3;
    // Upper left corner hash marks.
    for (; i <= 18; i += 3) {
	document.line(i,54,0,54+i);
    }
    // Middle hash marks.
    for (; i <= 54; i += 3) {
	document.line(i,54,i-18,54+18);
    }
    // Lower right hash marks.
    for (i = 3; i <= 18; i += 3) {
	document.line(54, 54 + i, 54 - 18 + i, 54 + 18);
    }
    // Top and bottom lines.
    document.line(0,54,54,54);
    document.line(0,54+18,54,54+18);
}

function staple(document) {
    /*
     * Makes two appropriately spaced staple marks on the bottom
     * section of the flip-book PDF. It is credit card-sized, and so
     * 54mm x 86mm.
     */
    document.setLineWidth(0.5);
   
    document.setDrawColor(50,50,50);
    document.line(9,54+24,21,54+24);    // Left top.
    document.line(9,54+24,9,54+25);
    document.line(21,54+24,21,54+25);
    document.setDrawColor(150,150,150);
    document.line(9,54+25,9,54+26);     // Left tines.
    document.line(21,54+25,21,54+26);
    document.line(9,54+26,14,54+25);
    document.line(21,54+26,16,54+25);
    
    document.setDrawColor(50,50,50);
    document.line(33,54+24,45,54+24);   // Right top.
    document.line(33,54+24,33,54+25);
    document.line(45,54+24,45,54+25);
    document.setDrawColor(150,150,150);
    document.line(33,54+25,33,54+26);   // Right tines.
    document.line(45,54+25,45,54+26);
    document.line(33,54+26,38,54+25);
    document.line(45,54+26,40,54+25);
}

async function makePDF() {
    /*
     * Constructs a PDF flip book that renders snapshots of 
     * a walk-through of a scene of objects, one page per shot.
     * 
     * The PDF document is credit card-sized, and so 54mm x 86mm.
     *
     */
    const doc = new jsPDF({unit:'mm', format:'credit-card'});
    const id = randomHex(4);
    const filename = "flip-book-"+id+".pdf";

    //
    // Cover page.
    doc.setFont("helvetica");
    doc.text("CSCI 385",27, 15, null, null, "center");
    doc.setFont("helvetica", "bold");
    doc.text("My Flip Book", 27, 25, null, null, "center");
    doc.setFont("courier", "bold");
    doc.text("#"+id, 27, 35, null, null, "center");
    makeBinding(doc);
    staple(doc);

    //
    // Function we'll pass to start a new page.
    newPage = function(document) {
	document.addPage("credit-card","p");
	makeBinding(document);
        staple(document);
        document.setDrawColor(50,50,50);
	document.setLineWidth(0.05);
    }

    //
    // Generate several pages from the walk-through.
    gWalkThru.toPDF(doc,newPage);

    //
    // Save it.
    doc.save(filename);
}
