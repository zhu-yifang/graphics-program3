//
// geometry-2d.js
//
// Author: Jim Fix
// CSCI 385, Reed College, Spring 2022
//
// This defines two classes:
//
//    Point2d: a class of locations in 2-space
//    Vector2d: a class of offsets between points within 2-space
//
// The two classes are designed based on Chapter 3 of "Coordinate-Free
// Geometric Programming" (UW-CSE TR-89-09-16) by Tony DeRose.
//

const EPSILON2D = 0.00000001;

// class Point2d
//
// Description of 2-D point objects and their methods.
//
class Point2d {

    constructor(_x,_y) {
        //
	// Construct a new point instance from its coordinates.
	//
        this.x = _x;
        this.y = _y;
    }

    components() {
        //
	// Return the components as an array.
	//
        return [this.x,this.y];
    }

    plus(offset) {
        //
	// Computes a point-vector sum, yielding a new point.
	//
        return new Point2d(this.x+offset.dx, this.y+offset.dy);
    }

    minus(other) {
	if (other instanceof Point2d) {
            //
	    // Compute point-point subtraction, yielding a vector.
	    //
            return new Vector2d(this.x-other.x,
				this.y-other.y);
	} else if (other instanceof Vector2d) {
            //
	    // Compute point-vector subtraction, yielding a point.
	    //
            return new Point2d(this.x-other.dx,
			       this.y-other.dy);
	} else {
	    return this;
	}
    }

    dist2(other) {
        //
	// Computes the squared distance between this and other.
	//
        return this.minus(other).norm2();
    }

    dist(other) {
        //
	// Computes the distance between this and other.
	//
        return this.minus(other).norm();
    }
    
    combo(scalar,other) {
        //
	// Computes the affine combination of this with other.
	//
        return this.plus(other.minus(this).times(scalar))

    }

    combos(scalars,others) {
        //
	// Computes the affine combination of this with other.
	//
        P = this;
	const n = Math.min(len(scalars),len(others));
        for (let i = 0; i < n; i++) {
            P = P.plus(others[i].minus(this).times(scalars[i]));
	}
        return P;
    }

    max(other) {
	//
	// Componentwise maximum of two points' coordinates.
	//
        return new Point2d(Math.max(this.x,other.x),Math.max(this.y,other.y))

    }

    min(other) {
	//
	// Componentwise minimum of two points' coordinates.
	//
        return new Point2d(Math.min(this.x,other.x),Math.min(this.y,other.y));
    }

}

Point2d.prototype.withComponents = function(cs) {
    //
    // Construct a point from a Python list.
    //
    return Point2d(cs[0],cs[1]);
}


// class Vector2d
//
// Description of 2-D vector objects and their methods.
//
class Vector2d {

    constructor(_dx,_dy) {
        //
	// Construct a new vector instance.
	//
        this.dx = _dx
        this.dy = _dy
    }

    components() {
        //
	// Return the components as an array.
	//
        return [this.dx,this.dy]
    }

    plus(other) {
        //
	// Vector sum of this and other.
	//
        return Vector2d(this.dx+other.dx,this.dy+other.dy)

    }

    minus(other) {
        //
	// Vector that results from subtracting other from this.
	//
        return this.plus(other.neg())

    }

    times(scalar) {
        //
	// Same vector as this, but scaled by the given value.
	//
        return new Vector2d(scalar*this.dx, scalar*this.dy);
    }

    neg() {
        //
	// Additive inverse of this.
	//
        return this.times(-1.0);
    }

    dot(other) {
        //
	// Dot product of this with other.
	//
        return this.dx*other.dx + this.dy*other.dy;
    }

    cross(other) {
        //
	// Cross product of this with other.
	//
        return this.dx*other.dy-this.dy*other.dx;
    }

    perp() {
	//
	// A vector rotated 90 degrees clockwise from this.
	//
        return new Vector2d(-this.dy,this.dx);
    }

    norm2() {
        //
	// Length of this, squared.
	//
        return this.dot(this);
    }

    norm() {
        //
	// Length of this.
	//
        return Math.sqrt(this.norm2());
    }

    unit() {
        //
	// Unit vector in the same direction as this.
	//
        const n = this.norm();
        if (n < EPSILON2D) {
            return new Vector2d(1.0,0.0);
        } else {
            return this.times(1.0/n);
	}
    }

    div(scalar) {
        //
	// Defines v / a as v * 1/a
	//
        return this.times(1.0/scalar);
    }
    
}

Vector2d.prototype.withComponents = function(cs) {
    //
    // Construct a vector from an array.
    //
    return new Vector2d(cs[0],cs[1]);
}

Vector2d.prototype.randomUnit = function() {
    //
    // Construct a random unit vector.
    //
    const theta = Math.random() * Math.PI * 2.0;
    return new Vector2d(Math.cos(theta), Math.sin(theta));
}

function ORIGIN2D()   { return new Point2d(0.0,0.0); }
function X_VECTOR2D() { return new Vector2d(1.0,0.0); }
function Y_VECTOR2D() { return new Vector2d(0.0,1.0); }

