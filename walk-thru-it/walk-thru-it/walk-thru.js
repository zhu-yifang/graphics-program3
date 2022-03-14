//
// walk-thru.js
//
// Author: Jim Fix
// CSCI 385: Computer Graphics, Reed College, Spring 2022
//
// This defines five object types that support the laying out of a
// walk-through of a scene of objects, made up of several camera
// shots of that scene.
//
// It defines these classes
//
//  * Shot; the position and direction of a camera shot placed in the scene.
//
//  * Placememt: the positioning, sizing, and orientation of an object from
//      a preloaded object library/
//
//  * WalkThru: a collection of shots and placements that make up the
//      walk-through of a scene.
//
// It provides the template for code for these classes:
//
//  * SceneCamera: the geometric information for producing a snapsot of the
//      scene from a particular shot in the walk-through of a scene.
//
//  * SceneObject: the geometric information for the placememt of an
//      object within a scene.
//
// ------
//
// Assignment
//
// Your job is to complete the code for the `toPDF` method of a
// `WalkThru`.  It compiles all the geometric information for the
// shots and object placements of the scene walk-through. From that,
// it should then produce a series of lines on the pages of a PDF
// documemt. Each page should correspond to a snapshot of the objects
// in the scene from some camera location, as directed by the series
// of shots.
//
// Each page should render the objects according to a perspective
// drawing of the edges/facets of each object in the scene, with
// "hidden lines removed." This means that if a portion of an edge is
// hidden behind a face of an object that sits closer to the camera,
// then that portion of the edge should not be drawn.
//

const MINIMUM_PLACEMENT_SCALE = 0.1; // Smallest object we can place.
const EPSILON = 0.00000001;

class Shot {
    constructor(position0, direction0) {
	this.position = position0;
	this.direction = direction0;
    }
}

class Placement {
    //
    // Class representing the placement of a library object in the scene.
    //
    constructor(name, position0) {
	//
        // `name`: string of the object cloned from the library. This name is
        //    used to access the object's geometric info (its faceted
        //    surface) and also to render it with glBeginEnd.
	//
	// `position`, `scale`, `direction`: a `point`, number, and `vector`
        //    representing the location, size, and orientation of this
        //    object's placement in the scene.
	//
	this.name        = name;
	this.position    = position0;
	this.scale       = MINIMUM_PLACEMENT_SCALE;
	this.orientation = 0.0;
    }
    
    resize(scale, bounds) {
	//
        // Return the 2D orientation of the object as an angle in degrees.
        // This gives the "spin" of the clone around its base.
	//
	// Some checks prevent growing the clone beyond the scene bounds.
        //
	scale = Math.max(scale, MINIMUM_PLACEMENT_SCALE);
	scale = Math.min(scale, bounds.right - this.position.x);
	scale = Math.min(scale, bounds.top - this.position.y);
	scale = Math.min(scale, this.position.x - bounds.left);
	scale = Math.min(scale, this.position.y - bounds.bottom) ;
	this.scale = scale;    
    }

    moveTo(position, bounds) {
	//
	// Relocate the object.
	//
	// Some checks prevent the object from being placed outside
        // the scene bounds.
	//
	position.x = Math.max(position.x ,bounds.left + this.scale);
	position.y = Math.max(position.y, bounds.bottom + this.scale);
	position.x = Math.min(position.x, bounds.right - this.scale);
	position.y = Math.min(position.y, bounds.top - this.scale);
	this.position = position;
    }

    rotateBy(angle) {
	//
        // Re-orient the clone by spinning it further by and angle.
	//
	this.orientation += angle;
    }

    baseIncludes(queryPoint) {
	//
	// Checks whether the `queryPoint` lives within the circular base
	// of the clone.
	//
	const distance = this.position.dist2(queryPoint);
	return (distance < this.scale*this.scale);
    }

    draw(objectColor, highlightColor, drawBase, drawShaded) {
	//
        // Draws the object within the current WebGL/opengl context.
	//
	glPushMatrix();
	const position = this.position;
	const angle = this.orientation;
	const scale = this.scale;
	glTranslatef(this.position.x, this.position.y, this.position.z);
	glRotatef(angle, 0.0, 0.0, 1.0);
	glScalef(this.scale, this.scale, this.scale);
	//
	// draw
	if (drawShaded) {
	    // Turn on lighting.
	    glEnable(GL_LIGHTING);
	    glEnable(GL_LIGHT0);
	}
	glColor3f(objectColor.r, objectColor.g, objectColor.b);
	glBeginEnd(this.name);
	if (drawShaded) {
	    // Turn on lighting.
	    glDisable(GL_LIGHT0);
	    glDisable(GL_LIGHTING);
	}

	// draw with highlights
	if (highlightColor != null) {
	    
	    glColor3f(highlightColor.r,
		      highlightColor.g,
		      highlightColor.b);
	    //
	    // Draw its wireframe.
	    glBeginEnd(this.name+"-wireframe");
	    if (drawBase) {
		// Show its extent as a circle.
		glBeginEnd("BASE");
	    }
	    
	}

	glPopMatrix();
    }	
}

function toPDFcoords(p) {
    /*
     * Computes the point in 2D projection coordinates to
     * a pair of coordinates corresponding to the millimeters
     * left and down from the top-left corner of a credit
     * card-sized PDF 54mm wide and 86mm tall.
     */

    // The 2D points are assumed to live in the box
    //
    //     [-1.0,1.0] x [0.0,2.0]
    //
    // This puts ant such points into [0,54] x [0,54].
    //
    const x = (p.x + 1.0) * 27;
    const y = (2.0 - p.y) * 27;
    
    return {x:x, y:y};
}


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
   WALK THRU
*/

class WalkThru {
    
    constructor() {
	/*
	 * new WalkThru
	 *
	 * Initializes an empty scene with a single shot of it.
	 * The shot is on the left side facing right.
	 */
	this.shot0 = new Shot(ORIGIN3D(), X_VECTOR3D());
	this.shots = [this.shot0];
	this.placements = [];
    }

    toPDF(document, startNewPage) {
	/*
	 * Issue line/circle commands with a jsPDF object `document` 
	 * relying on the function `startNewPage` to add and set-up
	 * each page of the resulting PDF file.
	 */
	
	//
	// Make all the cameras from the walk-through's shots.
	//
	const cameras = [];
	for (let shot of this.shots) {
	    const camera = new SceneCamera(shot.position,
					   shot.direction,
					   Z_VECTOR3D());
	    cameras.push(camera);
	}

	//
	// Make all the scene objects from their placements.
	//
	const objects = [];
	for (let placement of this.placements) {
	    const prototype = gObjectsLibrary.get(placement.name);
	    const object = new SceneObject(prototype, placement);
	    objects.push(object);
	}

	//
	// Render each page of the walk-through.
	//
	for (let camera of cameras) {
	    
	    // For now, one page per shot.
	    startNewPage(document);

	    // Compute projected vertex information and draw the lines of
	    // each edge.
	    for (let object of objects) {

		// Project the vertices of this object.
		let pvs = object.projectVertices(camera);

		// Draw each edge, projected, within the PDF.
		for (let edge of object.allEdges()) {
		    //
		    // Get the vertex information for each endpoint.
		    const v0 = edge.vertex(0,object);
		    const v1 = edge.vertex(1,object);
		    //
		    // Get the projected position of each.
		    const pp0 = pvs.get(v0).projection;
		    const pp1 = pvs.get(v1).projection;
		    //
		    // Locate each on the page.
		    const p0 = toPDFcoords(pp0);
		    const p1 = toPDFcoords(pp1);
		    //
		    // Draw blue-green dots and a line for the edge.
		    document.setFillColor(0, 96, 128);
		    document.circle(p0.x, p0.y, 0.35, "F");
		    document.circle(p1.x, p1.y, 0.35, "F");
		    //
		    document.setLineWidth(0.1);
		    document.setDrawColor(25, 25, 25);
		    document.line(p0.x, p0.y, p1.x, p1.y);
		}
	    }
	}			
    }
}		

class SceneCamera {
    //
    // new SceneCamera(center, towards, upward)
    //
    // Represents the parameters of a 2-D snapshot of a 3-D scene.
    // This yields a perspective projection of a camera looking at
    // the scene in a direction `towards`, from the given `center` of
    // projection, with an orientation that puts a certain direction
    // `upward`.
    // 
    // Underlying the `Camera` object is an orthonormal frame whose
    // origin sits at `center`, and whose axes are `right`, `up`, and
    // `into`. This is a *left-handed* system. The vectors `right` and
    // `up` form a basis for the projection onto the virtual
    // film/screen/paper.  The `into` vector points towards/into
    // the scene.
    //
    constructor(center, towards, upward) {
	//
	// Constructs a left-handed orthonormal frame for projection.
	//
	this.center = center;
	// into = e3
	this.into   = towards.unit();
	//
	// TO-DO: Fix this!
	// I am using the method in the solution
	// right = e1
	// up = e2
	this.right  = this.into.cross(upward.unit());             
	this.up     = this.right.cross(this.into); 
    }

    project(aPoint) {
	//
	// Projects a 3D point into 2D with perspective using this camera.
	//

	//
	// TO-DO: Fix this!

	// ** Right now this just performs an orthonormal
	//    projection onto the x=0 left wall. **
	
	
	// Compute a 2D projected point and its depth.
	// I am calculating by the solution way 
	// pPrime is P', origin is O in the solution
		let depth = (aPoint.minus(this.center)).dot(this.into);
		let pPrime = this.center.plus(aPoint.minus(this.center).times(1/depth));
		let origin = this.center.plus(this.into);
		let y = pPrime.minus(origin).dot(this.right);
		let z = pPrime.minus(origin).dot(this.up);

        const result = {
		    point: aPoint,
		    projection: new Point2d(y, z),
		    distance: depth
		};
	
	return result;
    }
}

//
// class SceneObject (extends CGObject)
//
// This object represents a CGObject that results from placing
// another CGObject at a certain position, scaled, and oriented.
//
// It shares the edge and face information with the provided
// object, but then its vertices are at new positions based on
// the placement.
//
class SceneObject extends CGObject {

    // new SceneObject(cgobject, placement):
    //
    // Builds a new object as a placement of the given object.
    //
    constructor(cgobject, placement) {
	// Compile geometric info from a placed object,
	super();
	this.cloneFromObject(cgobject, placement);
    }

    projectVertices(camera) {
	const vertexInfo = new Map();
	for (let v of this.allVertices()) {
            const projection = camera.project(v.position);
	    vertexInfo.set(v,projection);
	}
	return vertexInfo;
    }
}



					   
