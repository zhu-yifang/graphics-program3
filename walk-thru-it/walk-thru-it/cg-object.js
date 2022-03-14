//
// cg-object.py
//
// Author: Jim Fix
// CSCI 385, Reed College, Spring 2022
//
// This defines a `CGObject` class that represents a faceted surface
// as specified by the text contents of an Alias/Wavefront .OBJ file.
// It stores them as a mesh of triangular faces, made up of shared
// vertices and shared edges. These components are each defined as
// these classes
//
//   Vertex: a corner of a faceted surface.  It has a 3D position 
//         and participates in faces.
//
//   Face: a triangular face on a surface of some object in the 
//         scene.  It has three vertices ordered in counter-
//         clockwise fashion.
//
//   Edge: a border of a face and/or the meeting of two hinged
//         faces on the surface.
//


//
// class Edge
//
// Defines an object class that represents a hinge's crease 
// or a face boundary of a faceted surface.
//
// An edge spans two vertices and participates in one or two
// faces.
//
class Edge {
    
    // new Edge(v1,v2,f,id)
    //
    // Builds a new edge, one that spans the two given vertices v1,v2
    // and forms the boundary of the given face f.
    // 
    // This would likely never be called directly.  Instead it will be
    // used by `cgObject.addVertex`.  This is because we don't want to
    // build an edge that has already been created (perhaps on a
    // neighboring face).
    //
    constructor(vi1, vi2, f, id) {
	
        this.id        = id;
        this.sourcei   = vi1;
        this.targeti   = vi2;

        this.face     = f;
        this.twin     = null;
    }

    // e.addFace(f):
    //
    // This edge occurs on a hinged pair of faces.  Here we record the
    // second face on that hinge in the attribute 'e.twin'.
    //
    addFace(f) {
        if (this.twin == null) {
            this.twin = f;
	}
    }

    //
    // e.vertex(i, owner):
    // 
    // Returns either the 0th or the 1st vertex.
    //
    vertex(i, owner) {
        if (i == 0) {
            return owner.vertex(this.sourcei);
	} else if (i == 1) {
            return owner.vertex(this.targeti);
	} else {
	    return null;
	}
    }

    //
    // f.position(i,owner):
    // 
    // Returns the position of either the 0th or the 1st vertex.
    //
    position(i, owner) {
        if (i > 1) {
            return null;
        } else {
            return owner.vertex(i,owner).position;
	}
    }
    
    //
    // e.faces()
    // 
    // Returns a list of one or two faces associated with this edge.
    // 
    // If just one face, then this edge sits on the border of a
    // surface.  If two, then this edge acts a hinge between two
    // faces.
    //
    faces() {
	if (this.twin == null) {
	    return [this.face];
	} else {
	    return [this.face, this.twin];
	}
    }
}
            
//
//  class Vertex: 
//
//  Its instances are corners of a faceted surface. 
//
class Vertex {

    // new Vertex(P,id)
    //
    // (Creates and) initializes a new vertex object at position P
    // with the given id.
    //
    constructor(P,id) {
        this.position = P;
        this.id       = id;
        this.normal   = null;
    }

    getRelativePosition(placement) {
	/*
	 * This code does the work of placing a vertex according
	 * to an object placement. A placement specifies a new position,
	 * size, and orientation of a CGObject.
	 *
	 * Here, we translate, scale and rotate the vertex coordinates
	 * to compute a vertex position from that information.
	 */

	const r = placement.scale;
	const c = this.position.minus(ORIGIN3D()).times(r);
	const a = placement.orientation * Math.PI / 180.0;
	const dx = c.dx * Math.cos(a) - c.dy * Math.sin(a);
	const dy = c.dy * Math.cos(a) + c.dx * Math.sin(a);
	const v = new Vector3d(dx, dy, c.dz);
	return placement.position.plus(v);
    }    
}
	
//
// class Face: 
//
// Its instances are triangular facets on the surface.  It has three
// vertices as its corners.
//
class Face {

    //
    // new Face(vi1, vi2, vi3, id)
    //
    // Create and initialize a new face instance.
    //
    // Instance attributes:
    //
    //   * vertices: vertex instances that form the face
    //   * fn: face normal
    //   * id: integer id identifying this vertex
    //
    constructor(vi1,vi2,vi3,id) {
	this.id = id;
	this.vertexi = [vi1,vi2,vi3];
	this.fn = null;
    }

    //
    // f.normal(owner):
    //
    // Returns the surface normal of this face.  Computes 
    // that normal if it hasn't been computed yet.
    //
    normal(owner) {
        if (this.fn == null) {
            const p0 = this.position(0,owner);
            const p1 = this.position(1,owner);
            const p2 = this.position(2,owner);
            const v1 = p1.minus(p0);
            const v2 = p2.minus(p0);
            this.fn = v1.cross(v2).unit();
	}
        return this.fn;
    }

    //
    // f.vertex(i,owner):
    // 
    // Returns either the 0th, the 1st, or the 2nd vertex.
    //
    vertex(i, owner) {
        if (i > 2) {
            return null;
        } else {
            return owner.vertex(this.vertexi[i]);
	}
    }
    
    //
    // f.position(i,owner):
    // 
    // Returns the position of either the 0th, the 1st, or the 2nd vertex.
    //
    position(i, owner) {
        if (i > 2) {
            return null;
        } else {
            return this.vertex(i, owner).position;
	}
    }
}


class CGObject {
    
    //
    // new CGObject(objText)
    //
    // Houses the vertices, edges, and triangular faces of a 3D surface.
    // These are created by processing the text of an Alias/Wavefront .obj
    // file. 
    //
    // See `read` for more details.
    //
    constructor() {
	//
	// Initialize.
	this.vertices = [];
	this.faces    = [];
	this.edges    = [];
	this.edgeMap  = new Map();
	this.lock     = false; 
    }

    cloneFromObject(cgobject, placement) {
	/*
	 * Sets the faces, edges, and vertices of a CGObject so
	 * that they share the topology of another object, and 
	 * so that the vertex locations correspond to a placement
	 * of the vertices of that other object.
	 */
	this.faces = cgobject.faces;
	this.edges = cgobject.edges;
	this.edgeMap = cgobject.edgeMap;

	const vs = cgobject.allVertices();
	let vi = 0;
	for (let v of vs) {
	    this.addVertex(v.getRelativePosition(placement));
	    vi++;
	}
	this.lock = true;
    }

    buildFromOBJ(objText, isFlipped) {
	/*
	 * Sets the faces, edges, and vertices of a CGObject 
	 * acording to a specification in a .OBJ file. Relies
	 * on `read` to process that file text, and then 
	 * performs some extra processing to scale and place
	 * the vertices.
	 */
	
	//
	// Process the text of the .OBJ file.
	this.read(objText, isFlipped);
	this.lock = true;
	//
	// Rescale and center the points.
	this.recenter();
	//
	// Make the base sit at Z=0; scale for unit radius in X-Y.
	this.regirthAndSeat();
    }

    //
    // vertex(vi):
    //
    // Return the vi-th vertex of the object's surface.
    //
    vertex(vi) {
	return this.vertices[vi];
    }
    
    //
    // allVertices():
    //
    // Return all the vertices on the object's surface.
    //
    allVertices() {
	return this.vertices;
    }

    //
    // allEdges():
    //
    // Return all the edges on the object's surface.
    //
    allEdges() {
	return this.edges;
    }
    
    //
    // allFaces():
    //
    // Return all the triangular facets on the object's surface.
    //
    allFaces() {
	return this.faces;
    }
    
    // addVertex(p):
    //
    // Creates and returns a new vertex instance at position.
    //
    addVertex(position) {
	console.assert(!this.lock, "Object surface is read-only!");
	const vi = this.vertices.length;
	const v = new Vertex(position,vi);
	this.vertices.push(v);
    }

    // addFace(p);
    //
    // Constructs a face with the indices of three vertices .
    addFace(vi1,vi2,vi3) {
	console.assert(!this.lock, "Object surface is read-only!");
	
        const fi = this.faces.length;
        const f = new Face(vi1, vi2, vi3, fi);

        this.addEdge(vi1, vi2, f);
        this.addEdge(vi2, vi3, f);
        this.addEdge(vi3, vi1, f);

        this.faces.push(f);
    }
    
    // edgeName(vi1,vi2):
    //
    // String used to name each edge uniquely.
    //
    edgeName(vi1,vi2) {
        // Devise the correct identifier(s) for this edge.
        if (vi1 < vi2) {
	    return vi1.toString() + " " + vi2.toString();
	} else {
	    return vi2.toString() + " " + vi1.toString();
	}
    }

    // getEdge(vi1,vi2):
    //
    // Lookup and return an edge with this identifying pair of vertex
    // indices.
    //
    getEdge(vi1,vi2) {
        return this.edges.get(this.edgeName(vi1,vi2));
    }

    // addEdge(vi1,vi2,fi):
    //
    // Considers whether to build a new edge instance that connects
    // the two vertices v1 and v2 on the face f.  If the edge v2->v1
    // already has been built, then this hinge face (the "twin") is
    // recorded.
    //
    // If a new edge, the edge constructor is called.
    //
    addEdge(vi1,vi2,f) {
	console.assert(!this.lock, "Object surface is read-only!");
	
        // If the edge already exists, record this hinge face.
	const enm = this.edgeName(vi1,vi2);
        if (this.edgeMap.has(enm)) {
	    const e = this.edgeMap.get(enm);
            e.addFace(f);
        } else {
            // Otherwise, add a new edge.
            const ei = this.edges.length;
            const e = new Edge(vi1,vi2,f,ei);
	    this.edgeMap.set(enm,e);
            this.edges.push(e);
	}
    }

    //
    // read(objText, isFlipped)
    //
    // Read in the contents of a .OBJ file and create the vertices, edges,
    // and triangular faces of the object it describes.
    //
    //  objText: string that has the text of the .OBJ file
    //
    //  isFlipped: boolean value.
    //
    //    * When set to false, this means that the object has its base in the
    //      x-y plane and its central axis is in the z direction.
    //
    //    * When set to true, this means that the objevt has its base in the
    //      y-z plane and its central axis is in the x direction.
    //
    read(objText, isFlipped) {

	//
	// The coordinate positions for object's base versus its height.
	//     [1,2,3] means the object's central axis is in Z direction.
	//     [3,1,2] means it is in the X direction.
	//
	let xyz = [1,2,3];
	if (isFlipped) {
	    xyz = [3,1,2];
	}
	
	const lines = objText.split("\n");
	//
	// Process each line of the .OBJ file.
	for (let line of lines) {
	    
            const parts = line.split(" ")

            if (parts.length > 0) {
		
		// Lines that start with v are a vertex spec.
		//
		// v x-coord y-coord z-coord
		//
		if (parts[0] == 'v') {
		    // Read a vertex description line.
                    const x = parseFloat(parts[xyz[0]]);
                    const y = parseFloat(parts[xyz[1]]);
                    const z = parseFloat(parts[xyz[2]]);
                    const P = new Point3d(x,y,z);
                    this.addVertex(P);
		}

		// Lines that start with f are a face spec.
		//
		// f vi1 vi2 ... vik
                //
		// These are vertex indices.
		//
		// Since we only handle triangles, we build a
		// "fan of triangles", one triangle for each
		// edge on the face, all sharing the corner vi1.
		//
		// .OBJ files allow each to be of the form
		//
		//  f vi1/vt1/vn1 vi2/...
		//
		// but we currently ignore vertex texture and
		// vertex normal specifications for facets.
		//
		if (parts[0] == 'f') {
		    let viList = [];
		    for (let i = 1; i < parts.length; i++) {
			//
			// Ignores vertex textures/normals with split.
			const vi = parseInt(parts[i].split('/')[0]) - 1;
			//
			// NOTE: subtracts one bc .OBJ starts at 1
			viList.push(vi);
		    }
                    // Add a triangle for each edge of the face,
		    // excepting the first and last edges.
                    const vi1 = viList[0];
		    for (let i = 1; i < viList.length-1; i++) {
			const vi2 = viList[i];
			const vi3 = viList[i+1];
			this.addFace(vi1,vi2,vi3);
		    }
		}
	    }
	}
    }

    // regirthAndSet()
    //
    // Rescales the vertex points so that the distance of the furthest
    // point from the central axis is length 1.0.
    //
    // Translates so that the bottom-most point of the surface is at Z=0.
    //
    regirthAndSeat() {
	let radius2 = 0.0;
	let bottom = Number.MAX_VALUE;
	for (let V of this.allVertices()) {
	    const r2 = V.position.x * V.position.x
		  + V.position.y * V.position.y;
	    if (r2 > radius2) {
		radius2 = r2;
	    }
	    if (V.position.z < bottom) {
		bottom = V.position.z;
	    }
	}
	for (let V of this.allVertices()) {
	    V.position.z -= bottom;
	}
	const radius = Math.sqrt(radius2);
	for (let V of this.allVertices()) {
	    V.position.x /= radius;
	    V.position.y /= radius;
	    V.position.z /= radius;
	}
    }

    // recenter()
    //
    // Finds the bounding box of the surface and translates all the
    // vertex points so that their origin is the center of the bounding
    // box.
    //
    recenter() {
	let maxDims = new Point3d(Number.MIN_VALUE,
				 Number.MIN_VALUE,
				 Number.MIN_VALUE);
	let minDims = new Point3d(Number.MAX_VALUE,
				 Number.MAX_VALUE,
				 Number.MAX_VALUE);
	for (let V of this.allVertices()) {
	    maxDims = maxDims.max(V.position);
	    minDims = minDims.min(V.position);
	}
	const center = new Point3d((minDims.x + maxDims.x)/2.0,
				   (minDims.y + maxDims.y)/2.0,
				   (minDims.z + maxDims.z)/2.0);
	for (let V of this.allVertices()) {
	    V.position = ORIGIN3D().plus(V.position.minus(center));
	}
    }

    compileSurface() {
	/*
	 * Issues OPENGL instructions to render the triangulat
	 * facets of the object, also subhmittinge the facet
	 * normals.
	 *
	 * It makes a series of glVertex3fv and glNormal3fv calls.
	 */
	for (let f of this.allFaces()) {
	    f.normal(this).glNormal3fv();
	    const v1 = f.vertex(0,this);
	    v1.position.glVertex3fv();
	    const v2 = f.vertex(1,this);
	    v2.position.glVertex3fv();
	    const v3 = f.vertex(2,this);
	    v3.position.glVertex3fv();
	}
    }
    
    compileMesh() {
	/*
	 * Issues OPENGL instructions to render the edges of the
	 * object so as to depict its wireframe mesh.
	 *
	 * It makes a series of glVertex3fv calls.
	 */
	for (let e of this.allEdges()) {
	    const v1 = e.vertex(0,this);
	    v1.position.glVertex3fv();
	    const v2 = e.vertex(1,this);
	    v2.position.glVertex3fv();
	}
    }
}
